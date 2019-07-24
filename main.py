import random

import responder

api = responder.API()    

OBNIZ_WS_LIST = {} # 接続情報など，サーバ側で照合するためのデータ
OBNIZ_COORDS = {} # 座標をはじめとする，クライアント側に送信するデータ
FOOD_COORDS = []
LOST_FOOD_COORDS = []
FOOD_MAX = 100
MOVE_MAX = 2


@api.route('/')
def hello(req, resp):
    resp.html = api.template('index.html')

# フォームからデータを受け取る
@api.route('/obnizid')
async def login(req, resp):
    if req.method == "post":
        data = await req.media()
        if 'token' in data:
            api.redirect(resp, '/' + data['id'] + "?access_token=" + data['token'])
        else:
            api.redirect(resp, '/' + data['id'])

# 受け取ったデータをhtml->JSに流す
@api.route('/{obnizid}')
def home(req, resp, *, obnizid):
    resp.html = api.template(
        'home.html', obniz_id=obnizid,
        access_token=req.params.get("access_token", None)
    )

# WS待ち受け
@api.route('/ws', websocket=True)
async def process_ws(ws):
    global OBNIZ_WS_LIST, OBNIZ_COORDS, FOOD_COORDS, LOST_FOOD_COORDS
    await ws.accept()
    while True:
        rcv = await ws.receive_json() # クライアントからのsendを待ち受ける
        if not check_rcv(rcv):
            continue
        # 新規ユーザの登録
        if rcv["name"] == "registrate":
            # OBNIZ_WS_LIST[rcv["id"]] = {"ws": ws, "token": token}
            OBNIZ_WS_LIST[rcv["uuid"]] = {"ws": ws, "id": rcv["id"]}
            OBNIZ_COORDS[rcv["id"]] = {"x": 0, "y": 0, "point": 0}
            await ws.send_json({"name": "foodInit", "food": FOOD_COORDS})
        # 座標の更新
        elif rcv["name"] == "update":
            if ws != OBNIZ_WS_LIST[rcv["uuid"]]["ws"]:
                continue
            obniz_id = OBNIZ_WS_LIST[rcv["uuid"]]["id"]
            if rcv.get("x") is not None:
                if abs(OBNIZ_COORDS[obniz_id]["x"] - rcv["x"]) <= MOVE_MAX:
                    OBNIZ_COORDS[obniz_id]["x"] = rcv["x"]
            if rcv.get("y") is not None:
                if abs(OBNIZ_COORDS[obniz_id]["y"] - rcv["y"]) <= MOVE_MAX:
                    OBNIZ_COORDS[obniz_id]["y"] = rcv["y"]
            # エサの取得処理
            r = rcv["height"]
            # prev_count = len(FOOD_COORDS)
            # FOOD_COORDS = [
            #     coord for coord in FOOD_COORDS
            #     if not include_coord(
            #         {"x": coord["x"] * r, "y": coord["y"] * r},
            #         OBNIZ_COORDS[obniz_id]
            #     )
            # ]
            LOST_FOOD_COORDS = [
                coord for coord in FOOD_COORDS
                if include_coord(
                    {"x": coord["x"] * r, "y": coord["y"] * r},
                    OBNIZ_COORDS[obniz_id]
                )
            ]
            OBNIZ_COORDS[obniz_id]["point"] += len(LOST_FOOD_COORDS)
            # エサの再配置
            if len(FOOD_COORDS) <= 20:
                for _ in range(FOOD_MAX - len(FOOD_COORDS)):
                    FOOD_COORDS.append(
                        {
                            "x": random.uniform(0, 2.0),
                            "y": random.uniform(0, 1.0)
                        }
                    )
        # 座標リセット
        elif rcv["name"] == "reset":
            if ws != OBNIZ_WS_LIST[rcv["uuid"]]["ws"]:
                continue
            obniz_id = OBNIZ_WS_LIST[rcv["uuid"]]["id"]
            OBNIZ_COORDS[obniz_id] = {"x": 0, "y": 0, "point": 0}
        # 全員に変更を送信
        await bloadcast()

def include_coord(point, area_ul):
    return ((area_ul["x"] <= point["x"] and point["x"] <= area_ul["x"] + 10) and
            (area_ul["y"] <= point["y"] and point["y"] <= area_ul["y"] + 10))

async def bloadcast():
    global OBNIZ_WS_LIST, OBNIZ_COORDS, FOOD_COORDS, LOST_FOOD_COORDS
    disconnected_list = []
    for uuid, value in OBNIZ_WS_LIST.items():
        obniz_id = value["id"]
        ws = value["ws"]
        try:
            await ws.send_json({
                    "name": "coords",
                    "obniz": OBNIZ_COORDS,
                    "lost": LOST_FOOD_COORDS
                  })
        except RuntimeError as e:
            disconnected_list.append(uuid)
    for coords in LOST_FOOD_COORDS:
        FOOD_COORDS.remove(coords)
    LOST_FOOD_COORDS = []
    for uuid in disconnected_list:
        print("disconnect", uuid)
        online_obniz = [v["id"] for v in OBNIZ_WS_LIST.values()]
        if OBNIZ_WS_LIST[uuid]["id"] not in online_obniz:
            OBNIZ_COORDS.pop(OBNIZ_WS_LIST[uuid]["id"])
        OBNIZ_WS_LIST.pop(uuid)

def check_rcv(rcv):
    if "name" not in rcv:
        return False
    if "uuid" not in rcv:
        return False
    return True

if __name__ == "__main__":
    FOOD_COORDS = [
        {"x": random.uniform(0, 2.0), "y": random.uniform(0, 1.0)}
        for i in range(FOOD_MAX)
    ]
    api.run(address="0.0.0.0", port=5042)