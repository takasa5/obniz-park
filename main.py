import random

import responder

api = responder.API()

class Obniz_ws:
    def __init__(self):
        self.ws_list = []
        self.id_list = []
    
    def append(self, ws, obniz_id):
        self.ws_list.append(ws)
        self.id_list.append(obniz_id)
    
    def id_from_ws(self, ws):
        idx = self.ws_list.index(ws)
        return self.id_list[idx]
    
    def tuplelist(self):
        return list(zip(self.ws_list, self.id_list))
    
    def clean(self):
        if None in self.ws_list:
            delete_idx = [i for i, ws in enumerate(self.ws_list) if ws is None]
            for idx in delete_idx:
                self.ws_list.pop(idx)
                self.id_list.pop(idx)
    

OBNIZ_WS_LIST = Obniz_ws() # 接続情報など，サーバ側で照合するためのデータ
OBNIZ_COORDS = {} # 座標をはじめとする，クライアント側に送信するデータ
FOOD_COORDS = []
FOOD_MAX = 100


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
    global OBNIZ_WS_LIST, OBNIZ_COORDS, FOOD_COORDS
    await ws.accept()
    while True:
        rcv = await ws.receive_json() # クライアントからのsendを待ち受ける
        print("WS:", rcv)
        print(dir(ws))
        if not check_rcv(rcv):
            continue
        # 新規ユーザの登録(wsと座標を登録)，認証トークンの発行
        if rcv["name"] == "registrate":
            # OBNIZ_WS_LIST[rcv["id"]] = {"ws": ws, "token": token}
            OBNIZ_WS_LIST.append(ws, rcv["id"])
            OBNIZ_COORDS[rcv["id"]] = {"x": 0, "y": 0, "point": 0}
        # 座標の更新
        elif rcv["name"] == "update":
            obniz_id = OBNIZ_WS_LIST.id_from_ws(ws)
            if rcv.get("x") is not None:
                if abs(OBNIZ_COORDS[obniz_id]["x"] - rcv["x"]) <= 1:
                    OBNIZ_COORDS[obniz_id]["x"] = rcv["x"]
            if rcv.get("y") is not None:
                if abs(OBNIZ_COORDS[obniz_id]["y"] - rcv["y"]) <= 1:
                    OBNIZ_COORDS[obniz_id]["y"] = rcv["y"]
            # エサの取得処理
            r = rcv["height"]
            prev_count = len(FOOD_COORDS)
            FOOD_COORDS = [
                coord for coord in FOOD_COORDS
                if not include_coord(
                    {"x": coord["x"] * r, "y": coord["y"] * r},
                    OBNIZ_COORDS[obniz_id]
                )
            ]
            OBNIZ_COORDS[obniz_id]["point"] += prev_count - len(FOOD_COORDS)
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
            obniz_id = OBNIZ_WS_LIST.id_from_ws(ws)
            OBNIZ_COORDS[obniz_id] = {"x": 0, "y": 0, "point": 0}
        # 全員に変更を送信
        await bloadcast()

def include_coord(point, area_ul):
    return ((area_ul["x"] <= point["x"] and point["x"] <= area_ul["x"] + 10) and
            (area_ul["y"] <= point["y"] and point["y"] <= area_ul["y"] + 10))

async def bloadcast():
    global OBNIZ_WS_LIST, OBNIZ_COORDS, FOOD_COORDS
    for i, ws in enumerate(OBNIZ_WS_LIST.ws_list):
        if ws is None:
            continue
        try:
            await ws.send_json({
                    "name": "coords",
                    "obniz": OBNIZ_COORDS,
                    "food": FOOD_COORDS
                  })
        except RuntimeError as e:
            OBNIZ_WS_LIST.ws_list[i] = None
    if len(OBNIZ_WS_LIST.ws_list) > 10:
        OBNIZ_WS_LIST.clean()

def check_rcv(rcv):
    if "name" not in rcv:
        return False
    return True

if __name__ == "__main__":
    FOOD_COORDS = [
        {"x": random.uniform(0, 2.0), "y": random.uniform(0, 1.0)}
        for i in range(FOOD_MAX)
    ]
    api.run(address="0.0.0.0", port=5042)