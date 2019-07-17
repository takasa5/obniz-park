// JoyStick
obniz.onconnect = async function() {
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
}

// Button
obniz.onconnect = async function() {
    var button = obniz.wired("Button", {signal: 0, gnd: 1});
    while(true) {
        var pressed = await button.isPressedWait();
        if (pressed)
            goLeft(obniz);
        else
            goRight(obniz);
    }
}

// Potentiometer
obniz.onconnect = async function() {
    let meter = obniz.wired("Potentiometer", {pin0: 0, pin1: 1, pin2: 2});
    let exVal = 0.5;
    meter.onchange = function(position) {
        if (position > 0.98) {
            goDown(obniz);
        } else if (position < 0.02) {
            goUp(obniz);
        } else if (exVal < position) {
            goDown(obniz);
        } else if (exVal > position) {
            goUp(obniz);
        }
        exVal = position;
    }
}

// GyroSensor
obniz.onconnect = async function() {
    let sensor = obniz.wired("KXR94-2050",
        { vcc:0, gnd:1, x:2, y:3, z:4, enable:5, self_test:6 }
    );
    sensor.onChange = function(value) {
        if (value.x > 0.2) {
            goLeft(obniz);
        } else if (value.x < -0.2) {
            goRight(obniz);
        }
        if (value.y > 0.2) {
            goDown(obniz);
        } else if (value.y < -0.2) {
            goUp(obniz);
        }
    }
}