// obniz ID取得
const obnizId = document.getElementById('obnizId').textContent;
const regex = new RegExp(/[0-9]{4}-?[0-9]{4}/);
const movePx = 2;
if (!regex.test(obnizId)) {
    alert("ログインフォームにobniz IDを入力してログインしてください。");
    window.location.href = "/"
} else {
    // websocket確立
    webSocket = new WebSocket('ws://' + location.host + '/ws');
    // obniz接続
    obniz = new Obniz(obnizId, {
        auto_connect: false,
        access_token: document.getElementById('accessToken').textContent
    });
    tryConnect(obniz);
}

document.addEventListener("DOMContentLoaded", function(event) {
    let editor = ace.edit("editor", {
        useWorker: false
    });
    editor.setTheme("ace/theme/tomorrow");
    editor.session.setMode("ace/mode/javascript");
    editor.setValue(`obniz.onconnect = async function() {
    let joystick = obniz.wired('JoyStick', {sw: 0, y: 1, x: 2, vcc: 3, gnd: 4});
    while (true) {
        let x = await joystick.getXWait()
        let y = await joystick.getYWait()
        if (x > 0.8)
            goDown(obniz);
        else if (x < -0.8)
            goUp(obniz);
        if (y > 0.8)
            goLeft(obniz);
        else if (y < -0.8)
            goRight(obniz);
    }
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
            let lostFoodCoords = data["lost"];
            // foodCoords = data["food"];
            let canvas = document.getElementById('park');
            let ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            for (let id in obnizCoords) {
                let coord = obnizCoords[id];
                if (id == obnizId) {
                    ctx.fillStyle = "#00afd5";
                    myCoord = coord;
                } else {
                    ctx.fillStyle = "#000000";
                }
                ctx.fillRect(coord.x, coord.y, 10, 10);
                pointList.push(obnizCoords[id].point);
            }
            // なくなったエサを削除
            foodCoords = foodCoords.filter(e => checkLostFoods(e, lostFoodCoords));
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
        case "foodInit":
            foodCoords = data["food"];
            break;
        default:
            console.log("missing data");
    }
}

async function tryConnect(obniz) {
    let connected = await obniz.connectWait();
    if (connected) {
        myUuid = generateUuid();
        webSocket.send(JSON.stringify({name: "registrate", id: obniz.id, uuid: myUuid}));
    } else {
        alert("ログインに失敗しました。やり直してください。");
        window.location.href = "/"
    }
}

function goRight(obniz) {
    let canvas = document.getElementById('park');
    myCoord.x += movePx;
    webSocket.send(JSON.stringify({
        name: "update", x: myCoord.x,
        height: canvas.height,
        uuid: myUuid
    }));
}

function goLeft(obniz) {
    let canvas = document.getElementById('park');
    myCoord.x -= movePx;
    webSocket.send(JSON.stringify({
        name: "update", x: myCoord.x,
        height: canvas.height,
        uuid: myUuid
    }));
}

function goUp(obniz) {
    let canvas = document.getElementById('park');
    myCoord.y -= movePx;
    webSocket.send(JSON.stringify({
        name: "update", y: myCoord.y,
        height: canvas.height,
        uuid: myUuid
    }));
}

function goDown(obniz) {
    let canvas = document.getElementById('park');
    myCoord.y += movePx;
    webSocket.send(JSON.stringify({
        name: "update", y: myCoord.y,
        height: canvas.height,
        uuid: myUuid
    }));
}

function reset(obniz) {
    webSocket.send(JSON.stringify({
        name: "reset",
        uuid: myUuid
    }))
}

function checkLostFoods(coord, lostFoodCoords) {
    for (let lostCoord of lostFoodCoords) {
        if (lostCoord.x == coord.x && lostCoord.y == coord.y)
            return false
    }
    return true
}

function generateUuid() {
    // https://github.com/GoogleChrome/chrome-platform-analytics/blob/master/src/internal/identifier.js
    // const FORMAT: string = "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx";
    let chars = "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".split("");
    for (let i = 0, len = chars.length; i < len; i++) {
        switch (chars[i]) {
            case "x":
                chars[i] = Math.floor(Math.random() * 16).toString(16);
                break;
            case "y":
                chars[i] = (Math.floor(Math.random() * 4) + 8).toString(16);
                break;
        }
    }
    return chars.join("");
}
