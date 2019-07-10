import json

import responder
from obniz import Obniz

api = responder.API()

OBNIZ_WS_LIST = {}
OBNIZ_COORDS = {}

@api.route('/')
def hello(req, resp):
    resp.content = api.template('index.html')

# フォームからデータを受け取る
@api.route('/obnizid')
async def login(req, resp):
    if req.method == "post":
        data = await req.media()
        api.redirect(resp, '/' + data['id'])

# 受け取ったデータをhtml->JSに流す(ほんとは/obnizidから直接やりたい)
@api.route('/{obnizid}')
def home(req, resp, *, obnizid):
    resp.content = api.template('home.html', obniz_id=obnizid)

# WS待ち受け
@api.route('/ws', websocket=True)
async def process_ws(ws):
    global OBNIZ_WS_LIST, OBNIZ_COORDS
    await ws.accept()
    while True:
        rcv = await ws.receive_json() # クライアントからのsendを待ち受ける
        print(rcv)
        if not check_rcv(rcv):
            continue
        # 新規ユーザの登録(wsと座標を登録)
        if rcv["name"] == "registrate":
            OBNIZ_WS_LIST[rcv["id"]] = {"ws": ws}
            OBNIZ_COORDS[rcv["id"]] = {"x": 0, "y": 0}
        # 座標の更新
        elif rcv["name"] == "update":
            if rcv.get("x") is not None:
                if abs(OBNIZ_COORDS[rcv["id"]]["x"] - rcv["x"]) <= 1:
                    OBNIZ_COORDS[rcv["id"]]["x"] = rcv["x"]
            if rcv.get("y") is not None:
                if abs(OBNIZ_COORDS[rcv["id"]]["y"] - rcv["y"]) <= 1:
                    OBNIZ_COORDS[rcv["id"]]["y"] = rcv["y"]
        # 座標リセット
        elif rcv["name"] == "reset":
            OBNIZ_COORDS[rcv["id"]] = {"x": 0, "y": 0}
        # 全員に変更を送信
        await bloadcast()

async def bloadcast():
    global OBNIZ_WS_LIST, OBNIZ_COORDS
    for obniz_id in OBNIZ_WS_LIST.keys():
        try:
            await OBNIZ_WS_LIST[obniz_id]["ws"].send_json(OBNIZ_COORDS)
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

if __name__ == "__main__":
    api.run()