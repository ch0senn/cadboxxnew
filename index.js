// JavaScript source code

    function exportGLTF(input, options) {
        AFRAME.scenes[0].systems['gltf-exporter'].export(input, options);
        }

    document.getElementById('export-scene').addEventListener('click', function () {
        exportGLTF();
        });

    document.getElementById('export-scene-bin').addEventListener('click', function () {
        exportGLTF(undefined, { binary: true });
        });

    document.getElementById('export-yellowSphere').addEventListener('click', function () {
        exportGLTF(document.getElementById('yellowSphere'), { binary: true });
        });

    document.getElementById('export-orb2').addEventListener('click', function () {
        exportGLTF(document.getElementById('orb2'), { binary: true });
        });

    document.getElementById('export-orb3').addEventListener('click', function () {
        exportGLTF(document.getElementById('orb3'), { binary: true });
        });

    // Object which we're going to modify
    var targetEntity = document.querySelector('#target');

    // picks random color buttonCustom
    var buttonCustom = document.querySelector('#buttonCustom');
    buttonCustom.addEventListener('pressed', function (e) {
                        var scene = document.querySelector('a-scene');
    if (scene.getAttribute('stats')) {
        scene.setAttribute('stats', 'false');
                        } else {
        scene.setAttribute('stats', 'true');
                        }
                    });

    // picks random color buttonCustom
    var buttonStd = document.querySelector('#buttonStd');
    buttonStd.addEventListener('pressed', function () {
                        var randomHexColor = Math.floor(Math.random() * 0xffffff).toString(16);
    targetEntity.setAttribute('material', {
        color: '#' + randomHexColor
                        });
                    });

    // changes size
    var valueSlider = document.querySelector('#valueSlider');
    valueSlider.addEventListener('change', function (e) {
        targetEntity.setAttribute('geometry', { q: e.detail.value });
                    });

    // animates object
    var toggleSwitch = document.querySelector('#toggleSwitch');
    var interval;
    toggleSwitch.addEventListener('change', function (e) {
                        if (e.detail.value) {
        interval = setInterval(function () {
            targetEntity.setAttribute('rotation', {
                y: targetEntity.getAttribute('rotation').y + 1
            })
        }, 10);
                        } else {
        clearInterval(interval);
                        }
                    });

    // animates object
    var toggleSwitch2 = document.querySelector('#toggleSwitch2');
    var interval;
    toggleSwitch2.addEventListener('change', function (e) {
                        if (e.detail.value) {
        interval = setInterval(function () {
            targetEntity.setAttribute('rotation', {
                y: targetEntity.getAttribute('rotation').y - 1
            })
        }, 10);
                        } else {
        clearInterval(interval);
                        }
                    });

    // animates object
    var toggleSwitch3 = document.querySelector('#toggleSwitch3');
    var interval;
    toggleSwitch3.addEventListener('change', function (e) {
                        if (e.detail.value) {
        interval = setInterval(function () {
            targetEntity.setAttribute('rotation', {
                y: targetEntity.getAttribute('rotation').y + 5
            })
        }, 10);
                        } else {
        clearInterval(interval);
                        }
                    });

    // animates object
    var toggleSwitch4 = document.querySelector('#toggleSwitch4');
    var interval;
    toggleSwitch4.addEventListener('change', function (e) {
                        if (e.detail.value) {
        interval = setInterval(function () {
            targetEntity.setAttribute('rotation', {
                y: targetEntity.getAttribute('rotation').y - 5
            })
        }, 10);
                        } else {
        clearInterval(interval);
                        }
                    });


    // changes tubular radius
    var rotaryKnob = document.querySelector('#rotaryKnob');
    rotaryKnob.addEventListener('change', function (e) {
                        var value = e.detail.value * 0.01;
    targetEntity.setAttribute('geometry', {
        radiusTubular: targetEntity.getAttribute('geometry').radiusTubular + value
                        });
                    });
