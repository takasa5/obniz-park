var obnizId = document.getElementById('obnizId').textContent;
console.log(obnizId);
var obniz = new Obniz(obnizId, {auto_connect: false});
tryConnect(obniz);
const ws = new WebSocket('ws://localhost:5042/ws');

ws.onmessage = function(e) {
    obnizCoords = JSON.parse(e.data);
    console.log(obnizCoords);
    var canvas = document.getElementById('park');
    var ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (var id in obnizCoords) {
        var coord = obnizCoords[id];
        console.log(coord);
        ctx.fillRect(coord.x, coord.y, 10, 10);
    }
}

obniz.onconnect = async function() {
    var joystick = obniz.wired('JoyStick', {sw: 0, y: 1, x: 2, vcc: 3, gnd: 4});
    joystick.onchangex = function(val) {
        if (val > 0.8)
            ws.send(JSON.stringify({name: "update", id: obniz.id, x: obnizCoords[obniz.id].x + 1}))
        else if (val < -0.8)
        ws.send(JSON.stringify({name: "update", id: obniz.id, x: obnizCoords[obniz.id].x - 1}))
    };
    joystick.onchangey = function(val) {
        if (val > 0.8)
            ws.send(JSON.stringify({name: "update", id: obniz.id, y: obnizCoords[obniz.id].y + 1}))
        else if (val < -0.8)
            ws.send(JSON.stringify({name: "update", id: obniz.id, y: obnizCoords[obniz.id].y - 1}))
    };
}

async function tryConnect(obniz) {
    var connected = await obniz.connectWait();
    console.log(connected);
    if (connected) {
        console.log(obniz);
        ws.send(JSON.stringify({name: "registrate", id: obniz.id}));
    } else {
        alert("ログインに失敗しました。やり直してください。");
        window.location.href = "/"
    }
}
