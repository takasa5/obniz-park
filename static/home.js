// obniz ID取得
const obnizId = document.getElementById('obnizId').textContent;
console.log(obnizId);
const regex = new RegExp(/[0-9]{4}-?[0-9]{4}/);
if (!regex.test(obnizId)) {
    alert("ログインフォームにobniz IDを入力してログインしてください。");
    window.location.href = "/"
} else {
    // obniz接続
    obniz = new Obniz(obnizId, {
        auto_connect: false,
        access_token: document.getElementById('accessToken').textContent
    });
    tryConnect(obniz);
    // websocket確立
    webSocket = new WebSocket('ws://localhost:5042/ws');
}

document.addEventListener("DOMContentLoaded", function(event) {
    let editor = ace.edit("editor", {
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
        let code = editor.getValue();
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
        // webSocket.send(JSON.stringify({name: "reset", id: obniz.id}));
        reset(obniz);
    });

});

webSocket.onmessage = function(e) {
    let data = JSON.parse(e.data);
    let pointList = [];
    switch (data["name"]) {
        case "coords":
            obnizCoords = data["obniz"];
            foodCoords = data["food"];
            let canvas = document.getElementById('park');
            let ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            for (let id in obnizCoords) {
                let coord = obnizCoords[id];
                if (id == obnizId) {
                    ctx.fillStyle = "#00afd5";
                } else {
                    ctx.fillStyle = "#000000";
                }
                ctx.fillRect(coord.x, coord.y, 10, 10);
                pointList.push(obnizCoords[id].point);
            }
            for (let id in foodCoords) {
                let coord = foodCoords[id];
                ctx.beginPath();
                ctx.fillStyle = "yellow";
                ctx.arc(coord.x * canvas.height, coord.y * canvas.height, 1, 0, Math.PI*2, false);
                ctx.fill();
            }
            if (document.getElementById("score").textContent != obnizCoords[obnizId]["point"]) {
                document.getElementById("score").textContent = obnizCoords[obnizId]["point"];
            }
            if (document.getElementById("connected").textContent != Object.keys(obnizCoords).length) {
                document.getElementById("connected").textContent = Object.keys(obnizCoords).length;
            }
            pointList.sort((a, b) => b - a);
            let myRank = pointList.indexOf(obnizCoords[obnizId].point) + 1;
            if (document.getElementById("rank").textContent != myRank) {
                document.getElementById("rank").textContent = myRank;
            }
            break;
        case "token":
            myToken = data["token"];
            break;
        default:
            console.log("missing data");
    }
}

async function tryConnect(obniz) {
    let connected = await obniz.connectWait();
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
    let canvas = document.getElementById('park');
    webSocket.send(JSON.stringify({
        token: myToken,
        name: "update", id: obniz.id, x: obnizCoords[obniz.id].x + 1,
        height: canvas.height
    }));
}

function goLeft(obniz) {
    let canvas = document.getElementById('park');
    webSocket.send(JSON.stringify({
        token: myToken,
        name: "update", id: obniz.id, x: obnizCoords[obniz.id].x - 1,
        height: canvas.height
    }));
}

function goUp(obniz) {
    let canvas = document.getElementById('park');
    webSocket.send(JSON.stringify({
        token: myToken,
        name: "update", id: obniz.id, y: obnizCoords[obniz.id].y - 1,
        height: canvas.height
    }));
}

function goDown(obniz) {
    let canvas = document.getElementById('park');
    webSocket.send(JSON.stringify({
        token: myToken,
        name: "update", id: obniz.id, y: obnizCoords[obniz.id].y + 1,
        height: canvas.height
    }));
}

function reset(obniz) {
    webSocket.send(JSON.stringify({
        token: myToken,
        name: "reset", id: obniz.id
    }))
}