// obniz ID取得
var obnizId = document.getElementById('obnizId').textContent;
console.log(obnizId);
// obniz接続
var obniz = new Obniz(obnizId, {auto_connect: false});
tryConnect(obniz);
// websocket確立
const webSocket = new WebSocket('ws://localhost:5042/ws');


document.addEventListener("DOMContentLoaded", function(event) {
    var editor = ace.edit("editor", {
        useWorker: false
    });
    editor.setTheme("ace/theme/tomorrow");
    editor.session.setMode("ace/mode/javascript");
    editor.setValue(`obniz.onconnect = async function() {
    var joystick = obniz.wired('JoyStick', {sw: 0, y: 1, x: 2, vcc: 3, gnd: 4});
    joystick.onchangex = function(val) {
        if (val > 0.8)
            goRight(obniz);
        else if (val < -0.8)
            goLeft(obniz);
    };
    joystick.onchangey = function(val) {
        if (val > 0.8)
            goDown(obniz);
        else if (val < -0.8)
            goUp(obniz);
    };
}`);

    // コード適用ボタン
    document.getElementById('apply-btn').addEventListener("click", function() {
        var code = editor.getValue();
        try {
            eval(code); 
            obniz.close();
            obniz.connect();
        } catch (e) {
            if (e instanceof SyntaxError) {
                alert(e.message);
            }
        }
    });
    // リセットボタン
    document.getElementById('reset-btn').addEventListener("click", function() {
        obniz.onconnect = null;
        obniz.close();
        obniz.connect();
        webSocket.send(JSON.stringify({name: "reset", id: obniz.id}));
    });

});

webSocket.onmessage = function(e) {
    obnizCoords = JSON.parse(e.data);
    var canvas = document.getElementById('park');
    var ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (var id in obnizCoords) {
        var coord = obnizCoords[id];
        ctx.fillRect(coord.x, coord.y, 10, 10);
    }
}
// JoyStick example
// obniz.onconnect = async function() {
//     var joystick = obniz.wired('JoyStick', {sw: 0, y: 1, x: 2, vcc: 3, gnd: 4});
//     joystick.onchangex = function(val) {
//         if (val > 0.8)
//             goRight(obniz);
//         else if (val < -0.8)
//             goLeft(obniz);
//     };
//     joystick.onchangey = function(val) {
//         if (val > 0.8)
//             goDown(obniz);
//         else if (val < -0.8)
//             goUp(obniz);
//     };
// }

// button example
// obniz.onconnect = async function() {
//     var button = obniz.wired("Button", {signal: 0, gnd: 1});
//     while(true) {
//         var pressed = await button.isPressedWait();
//         if (pressed)
//             goLeft(obniz);
//         else
//             goRight(obniz);
//     }
// }

async function tryConnect(obniz) {
    var connected = await obniz.connectWait();
    console.log(connected);
    if (connected) {
        console.log(obniz);
        webSocket.send(JSON.stringify({name: "registrate", id: obniz.id}));
    } else {
        alert("ログインに失敗しました。やり直してください。");
        window.location.href = "/"
    }
}

function goRight(obniz) {
    webSocket.send(JSON.stringify({
        name: "update", id: obniz.id, x: obnizCoords[obniz.id].x + 1
    }));
}

function goLeft(obniz) {
    webSocket.send(JSON.stringify({
        name: "update", id: obniz.id, x: obnizCoords[obniz.id].x - 1
    }));
}

function goUp(obniz) {
    webSocket.send(JSON.stringify({
        name: "update", id: obniz.id, y: obnizCoords[obniz.id].y - 1
    }));
}

function goDown(obniz) {
    webSocket.send(JSON.stringify({
        name: "update", id: obniz.id, y: obnizCoords[obniz.id].y + 1
    }));
}