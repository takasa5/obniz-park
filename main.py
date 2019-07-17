import json
import random
import secrets

import responder

api = responder.API()

OBNIZ_WS_LIST = {} # 接続情報など，サーバ側で照合するためのデータ
OBNIZ_COORDS = {} # 座標をはじめとする，クライアント側に送信するデータ
FOOD_COORDS = []
FOOD_MAX = 100

@api.route('/')
def hello(req, resp):
    resp.content = api.template('index.html')

# フォームからデータを受け取る
@api.route('/obnizid')
async def login(req, resp):
    if req.method == "post":
        data = await req.media()
        if 'token' in data:
            api.redirect(resp, '/' + data['id'] + "?access_token=" + data['token'])
        else:
            api.redirect(resp, '/' + data['id'])

# 受け取ったデータをhtml->JSに流す(ほんとは/obnizidから直接やりたい)
@api.route('/{obnizid}')
def home(req, resp, *, obnizid):
    resp.content = api.template(
        'home.html', obniz_id=obnizid,
        access_token=req.params.get("access_token", None)
    )

# WS待ち受け
@api.route('/ws', websocket=True)
async def process_ws(ws):
    global OBNIZ_WS_LIST, OBNIZ_COORDS, FOOD_COORDS
    await ws.accept()
    while True:
        rcv = await ws.receive_json() # クライアントからのsendを待ち受ける
        print("WS:", rcv)
        if not check_rcv(rcv):
            continue
        # 新規ユーザの登録(wsと座標を登録)，認証トークンの発行
        if rcv["name"] == "registrate":
            # wsが既に存在していた場合，追加しない(invalid registrate 対策)
            ws_list = [dic["ws"] for dic in OBNIZ_WS_LIST.values()]
            if ws in ws_list:
                print("ws already exist")
                continue
            token = secrets.token_hex()
            OBNIZ_WS_LIST[rcv["id"]] = {"ws": ws, "token": token}
            OBNIZ_COORDS[rcv["id"]] = {"x": 0, "y": 0, "point": 0}
            await ws.send_json({"name": "token", "token": token})
        # 座標の更新
        elif rcv["name"] == "update":
            # トークンの確認
            if not check_token(rcv["id"], rcv["token"]):
                print("Invalid Token")
                continue
            if rcv.get("x") is not None:
                if abs(OBNIZ_COORDS[rcv["id"]]["x"] - rcv["x"]) <= 1:
                    OBNIZ_COORDS[rcv["id"]]["x"] = rcv["x"]
            if rcv.get("y") is not None:
                if abs(OBNIZ_COORDS[rcv["id"]]["y"] - rcv["y"]) <= 1:
                    OBNIZ_COORDS[rcv["id"]]["y"] = rcv["y"]
            # エサの取得処理
            r = rcv["height"]
            prev_count = len(FOOD_COORDS)
            FOOD_COORDS = [{"x": coord["x"], "y": coord["y"]} for coord in FOOD_COORDS if not include_coord({"x": coord["x"] * r, "y": coord["y"] * r}, OBNIZ_COORDS[rcv["id"]])]
            OBNIZ_COORDS[rcv["id"]]["point"] += prev_count - len(FOOD_COORDS)
            # エサの再配置
            if len(FOOD_COORDS) <= 20:
                for _ in range(FOOD_MAX - len(FOOD_COORDS)):
                    FOOD_COORDS.append({"x": random.uniform(0, 2.0), "y": random.uniform(0, 1.0)})
        # 座標リセット
        elif rcv["name"] == "reset":
            # トークンの確認
            if not check_token(rcv["id"], rcv["token"]):
                continue
            OBNIZ_COORDS[rcv["id"]] = {"x": 0, "y": 0, "point": 0}
        # 全員に変更を送信
        await bloadcast()

def include_coord(point, area_ul):
    return ((area_ul["x"] <= point["x"] and point["x"] <= area_ul["x"] + 10) and
            (area_ul["y"] <= point["y"] and point["y"] <= area_ul["y"] + 10))

async def bloadcast():
    global OBNIZ_WS_LIST, OBNIZ_COORDS, FOOD_COORDS
    for obniz_id in OBNIZ_WS_LIST.keys():
        try:
            await OBNIZ_WS_LIST[obniz_id]["ws"].send_json({
                    "name": "coords",
                    "obniz": OBNIZ_COORDS,
                    "food": FOOD_COORDS
                  })
        except RuntimeError as e:
            print("delete", obniz_id)
            OBNIZ_WS_LIST[obniz_id] = None
            OBNIZ_COORDS.pop(obniz_id)
    # 更新(WS_LISTから切断されたものを消去)
    OBNIZ_WS_LIST = {key: value for key, value in OBNIZ_WS_LIST.items() if value is not None}

def check_rcv(rcv):
    if "name" not in rcv:
        return False
    if "id" not in rcv:
        return False
    return True

def check_token(obniz_id, token):
    global OBNIZ_WS_LIST
    return secrets.compare_digest(
        OBNIZ_WS_LIST[obniz_id]["token"],
        token
    )

if __name__ == "__main__":
    FOOD_COORDS = [{"x": random.uniform(0, 2.0), "y": random.uniform(0, 1.0)} for i in range(FOOD_MAX)]
    api.run()