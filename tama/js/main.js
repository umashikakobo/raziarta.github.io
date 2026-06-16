// メイン初期化・ゲームループ
// 他のjsファイルが先に読み込まれている前提

// DOM参照キャッシュ (const宣言はTDZがあるため使用箇所より前に置く)
const playerNameEl = document.getElementById('player-name');
const elEscStart = document.getElementById('sel-esc-start-speed');
const elEscMax = document.getElementById('sel-esc-max-speed');
const moveJoyOuter = document.getElementById('joystick-outer');
const moveJoyInner = document.getElementById('joystick-inner');
const elOrigCamFov = document.getElementById('sel-orig-cam-fov');
const elOrigMaxSpeed = document.getElementById('sel-orig-max-speed');
const elOrigAccel = document.getElementById('sel-orig-accel');
const elOrigJerk = document.getElementById('sel-orig-jerk');
const elOrigGrav = document.getElementById('sel-orig-grav');
const elOrigBallSize = document.getElementById('sel-orig-ball-size');
const elOrigSize = document.getElementById('sel-orig-size');
const elOrigWallT = document.getElementById('sel-orig-wall-t');
const elOrigRestitution = document.getElementById('sel-orig-restitution');
const camJoyOuter = document.getElementById('cam-joystick-outer');
const camJoyInner = document.getElementById('cam-joystick-inner');

let controlMode = 1;
let lastSyncTime = 0;
let lastSendTime = 0;

// エンティティをIDで取得するヘルパー
function getEntityById(id) {
    if (id === myPeerId) return { body: ballBody, mesh: sphere, isMe: true };
    if (remoteEntities[id]) return remoteEntities[id];
    return aiEntities.find(e => e.id === id);
}

// 復元: isMobile判定 (config.jsで定義済み)

        // 速度アップモードの初期値 (基本の最高速度を起点に共有する)
        if (elEscStart) elEscStart.value = ESC_DEFAULT_START_SPEED;
        if (elEscMax) elEscMax.value = ESC_DEFAULT_MAX_SPEED;

        // ジョイスティック共通処理: 中心からのドラッグ量を -1〜1 の範囲に正規化して返す

        // ジョイスティック共通処理: 状態と見た目を中央位置にリセットする

        // 復元: カメラジョイスティック

        camJoyOuter.addEventListener('touchstart', (e) => {
            e.preventDefault();
            for (let i = 0; i < e.changedTouches.length; i++) {
                if (camJoy.touchId === null) {
                    camJoy.touchId = e.changedTouches[i].identifier;
                    camJoy.active = true;
                    updateCamJoystick(e.changedTouches[i]);
                }
            }
        }, { passive: false });

        camJoyOuter.addEventListener('touchmove', (e) => {
            e.preventDefault();
            for (let i = 0; i < e.changedTouches.length; i++) {
                if (e.changedTouches[i].identifier === camJoy.touchId) {
                    updateCamJoystick(e.changedTouches[i]);
                }
            }
        }, { passive: false });

        const endCamJoy = (e) => {
            for (let i = 0; i < e.changedTouches.length; i++) {
                if (e.changedTouches[i].identifier === camJoy.touchId) {
                    if (camJoyInner) resetJoystick(camJoy, camJoyInner, 'x', 'y');
                }
            }
        };
        camJoyOuter.addEventListener('touchend', endCamJoy);
        camJoyOuter.addEventListener('touchcancel', endCamJoy);

        // 移動用ジョイスティック (TYPE 3) - タッチした場所に表示

        window.addEventListener('touchstart', (e) => {
            if (controlMode !== 3) return;

            // 直前のタッチのtouchend/touchcancelが取得できず touchId が
            // 残ってしまうと、次のタップが無視されてしまう(2回に1回反応しない原因)。
            // 現在アクティブなタッチ一覧に存在しなければ状態をリセットする。
            if (touchData.touchId !== null) {
                let stillActive = false;
                for (let i = 0; i < e.touches.length; i++) {
                    if (e.touches[i].identifier === touchData.touchId) { stillActive = true; break; }
                }
                if (!stillActive) {
                        if (moveJoyInner) resetJoystick(touchData, moveJoyInner, 'moveX', 'moveZ');
                    moveJoyOuter.style.display = 'none';
                }
            }

            for (let i = 0; i < e.changedTouches.length; i++) {
                if (touchData.touchId !== null) continue;
                const t = e.changedTouches[i];
                if (t.clientX > window.innerWidth / 2) {
                    // 右側画面でも、カメラ用ジョイスティック(1ST/3RD視点時のみ表示)が
                    // 表示されていない(=上から視点 DEFAULT)場合は移動ジョイスティックを使用可能にする
                    const camContainer = document.getElementById('cam-joystick-container');
                    const camVisible = camContainer && getComputedStyle(camContainer).display !== 'none';
                    if (camVisible) continue;
                }
                const target = document.elementFromPoint(t.clientX, t.clientY);
                if (target && target.closest && target.closest('button, input, select, a, .dpad-btn, .drag-handle, #ui, #custom-dialog, #settings-modal, #server-dialog, #help-mdns-dialog, #full-log-modal')) continue;

                touchData.touchId = t.identifier;
                touchData.active = true;
                moveJoyOuter.style.left = (t.clientX - JOY_SIZE / 2) + 'px';
                moveJoyOuter.style.top = (t.clientY - JOY_SIZE / 2) + 'px';
                moveJoyOuter.style.display = 'flex';
                updateMoveJoystick(t);
                e.preventDefault();
            }
        }, { passive: false });

        window.addEventListener('touchmove', (e) => {
            for (let i = 0; i < e.changedTouches.length; i++) {
                if (e.changedTouches[i].identifier === touchData.touchId) {
                    updateMoveJoystick(e.changedTouches[i]);
                    e.preventDefault();
                }
            }
        }, { passive: false });

        const endMoveJoy = (e) => {
            for (let i = 0; i < e.changedTouches.length; i++) {
                if (e.changedTouches[i].identifier === touchData.touchId) {
                    if (moveJoyInner) resetJoystick(touchData, moveJoyInner, 'moveX', 'moveZ');
                    moveJoyOuter.style.display = 'none';
                }
            }
        };
        window.addEventListener('touchend', endMoveJoy);
        window.addEventListener('touchcancel', endMoveJoy);




        window.addEventListener('load', () => {
            if (playerNameEl) playerNameEl.value = "";
            if (typeof ballBody !== 'undefined') ballBody.name = "";

            const randomName = defaultNames[Math.floor(Math.random() * defaultNames.length)];
            if (playerNameEl) playerNameEl.value = randomName;
            if (typeof ballBody !== 'undefined') {
                ballBody.name = randomName;
            }

            if (isMobile) setControlMode(3); else setControlMode(1);
            updateCameraPos();
            updateLeaderboard();

            document.addEventListener('mousedown', (e) => {
                if (e.button === 0 && cameraMode !== 'DEFAULT' && !isPointerLocked) {
                    if (e.target === renderer.domElement) {
                        renderer.domElement.requestPointerLock();
                    }
                }
            });

            document.addEventListener('contextmenu', (e) => {
                if (cameraMode !== 'DEFAULT') {
                    e.preventDefault();
                    if (document.pointerLockElement) {
                        document.exitPointerLock();
                    }
                }
            });

            document.addEventListener('pointerlockchange', () => {
                isPointerLocked = (document.pointerLockElement === renderer.domElement);
            });

            document.addEventListener('mousemove', (e) => {
                if (isPointerLocked && cameraMode !== 'DEFAULT') {
                    const speedX = Math.abs(e.movementX);
                    const accelMult = speedX > 15 ? 2.5 : 1.0;
                    camYaw -= e.movementX * 0.0006 * accelMult;
                    camPitch -= e.movementY * 0.00045;
                    const limit = 80 * Math.PI / 180;
                    camPitch = Math.max(-limit, Math.min(limit, camPitch));
                }
            });

            renderer.domElement.addEventListener('touchstart', e => {
                for (let i = 0; i < e.changedTouches.length; i++) {
                    const t = e.changedTouches[i];
                    if (t.clientX > window.innerWidth / 2 && cameraMode !== 'DEFAULT') {
                        touchCamId = t.identifier;
                        lastTouchCamX = t.clientX;
                        lastTouchCamY = t.clientY;
                    }
                }
            }, { passive: false });

            renderer.domElement.addEventListener('touchmove', e => {
                for (let i = 0; i < e.changedTouches.length; i++) {
                    const t = e.changedTouches[i];
                    if (t.identifier === touchCamId && cameraMode !== 'DEFAULT') {
                        camYaw -= (t.clientX - lastTouchCamX) * 0.0015;
                        camPitch -= (t.clientY - lastTouchCamY) * 0.0015;
                        const limit = 80 * Math.PI / 180;
                        camPitch = Math.max(-limit, Math.min(limit, camPitch));
                        lastTouchCamX = t.clientX;
                        lastTouchCamY = t.clientY;
                    }
                }
            }, { passive: false });

            renderer.domElement.addEventListener('touchend', e => {
                for (let i = 0; i < e.changedTouches.length; i++) {
                    if (e.changedTouches[i].identifier === touchCamId) touchCamId = null;
                }
            });

            window.addEventListener('keydown', e => {
                if (document.activeElement && document.activeElement.tagName === 'INPUT') return;
                if (e.key === '1' || e.code === 'Digit1' || e.code === 'Numpad1') setCameraMode('DEFAULT', true);
                if (e.key === '2' || e.code === 'Digit2' || e.code === 'Numpad2') setCameraMode('1ST', true);
                if (e.key === '3' || e.code === 'Digit3' || e.code === 'Numpad3') setCameraMode('3RD', true);

                if (!ballBody.isAlive && cameraMode !== 'DEFAULT') {
                    if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') selectNextSpectatorTarget(-1);
                    if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') selectNextSpectatorTarget(1);
                }
            });

        });

        window.addEventListener('resize', () => {
            camera.aspect = window.innerWidth / window.innerHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(window.innerWidth, window.innerHeight);
            updateCameraPos();
        });

// 実行時変数の初期化
        let selfSync = { pos: new THREE.Vector3(), vel: new THREE.Vector3(), ts: 0 };
        const SYNC_RATE = 30;
        lastSyncTime = 0;
        lastSendTime = 0;

        // 復元: ドラッグ＆ドロップ用関数

        setupDraggableDpad('drag-1', 'dpad-type1');
        setupDraggableDpad('drag-2l', 'dpad-type2-left');
        setupDraggableDpad('drag-2r', 'dpad-type2-right');
        setupDraggableDpad('drag-cam', 'cam-joystick-container');

        // 復元: ジャイロデータ処理
        gyroData = { active: false, moveX: 0, moveZ: 0 };

        async function lockLandscape() {
            try {
                if (screen.orientation && screen.orientation.lock) {
                    await screen.orientation.lock('landscape');
                } else if (document.documentElement.requestFullscreen) {
                    await document.documentElement.requestFullscreen();
                    if (screen.orientation && screen.orientation.lock) {
                        await screen.orientation.lock('landscape');
                    }
                }
            } catch (err) {
                console.warn("Screen orientation lock failed:", err);
            }
        }

        window.addEventListener('deviceorientation', (e) => {
            if (!gyroData.active) return;

            let beta = e.beta;
            let gamma = e.gamma;
            let tiltX = 0; let tiltZ = 0;
            const orientation = window.orientation || screen.orientation?.angle || 0;

            if (orientation === 90) {
                tiltX = -beta; tiltZ = gamma;
            } else if (orientation === -90 || orientation === 270) {
                tiltX = beta; tiltZ = -gamma;
            } else {
                tiltX = gamma; tiltZ = beta;
            }

            const deadzone = 5;
            const maxTilt = 30;

            if (Math.abs(tiltX) < deadzone) { gyroData.moveX = 0; }
            else {
                let val = (Math.abs(tiltX) - deadzone) / (maxTilt - deadzone);
                gyroData.moveX = tiltX > 0 ? Math.min(1.0, val) : -Math.min(1.0, val);
            }

            if (Math.abs(tiltZ) < deadzone) { gyroData.moveZ = 0; }
            else {
                let val = (Math.abs(tiltZ) - deadzone) / (maxTilt - deadzone);
                gyroData.moveZ = tiltZ > 0 ? Math.min(1.0, val) : -Math.min(1.0, val);
            }
        });

        // 復元: D-padタッチ処理
        window.addEventListener('touchstart', handleDpadTouch, { passive: false });
        window.addEventListener('touchmove', handleDpadTouch, { passive: false });
        window.addEventListener('touchend', handleDpadTouch);

originalModeLight = null;
defaultParamsBackup = null;

function restoreDefaultStage(opts = {}) {
    if (!dirLight) return;
    dirLight.intensity = 0.60;
    isOriginalActive = false;
    if (defaultParamsBackup) {
        Object.assign(params, defaultParamsBackup);
    }
    if (opts.resetGravity && typeof world !== 'undefined' && world.gravity) {
        world.gravity.set(0, -params.gravity * 60, 0);
    }
    params.ballRadius = initialParams.ballRadius;
    if (opts.resetRestitution) params.restitution = initialParams.restitution;
    if (originalModeLight) {
        scene.remove(originalModeLight);
        originalModeLight = null;
    }
    buildStadium(false);
    rebuildAllBalls();
    if (opts.updateCamera) updateCameraPos();
}


world = new OIMO.World({ timestep: 1 / 60, iterations: 8, broadphase: 2, worldscale: 1, random: true, info: false, gravity: [0, -params.gravity * 60, 0] });
scene = new THREE.Scene(); scene.background = new THREE.Color(0xdddddd);
camera = new THREE.PerspectiveCamera(25, window.innerWidth / window.innerHeight, 1, 5000);
renderer = new THREE.WebGLRenderer({ antialias: false }); renderer.setPixelRatio(Math.min(window.devicePixelRatio * 0.6, 1)); renderer.setSize(window.innerWidth, window.innerHeight); renderer.localClippingEnabled = true; renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.BasicShadowMap; document.body.appendChild(renderer.domElement);

        const floorHalf = params.size / 2; const wallW = (params.wallH * TAN_35) + params.wallT; const limit = floorHalf + wallW;
        clipPlanes = [
            new THREE.Plane(new THREE.Vector3(1, 0, 0), limit), new THREE.Plane(new THREE.Vector3(-1, 0, 0), limit),
            new THREE.Plane(new THREE.Vector3(0, 0, 1), limit), new THREE.Plane(new THREE.Vector3(0, 0, -1), limit)
        ];
        scene.add(new THREE.AmbientLight(0xffffff, 0.74));
dirLight = new THREE.DirectionalLight(0xffffff, 0.60);
        dirLight.position.set(200, 400, 200);
        scene.add(dirLight);
shadowLight = new THREE.DirectionalLight(0xffffff, 0.08);
        shadowLight.position.set(0, 600, 0);
        shadowLight.castShadow = true;
        shadowLight.shadow.mapSize.width = 512;
        shadowLight.shadow.mapSize.height = 512;
        shadowLight.shadow.camera.near = 100;
        shadowLight.shadow.camera.far = 700;
        const shadowCamSize = params.size * 0.9;
        shadowLight.shadow.camera.left = -shadowCamSize;
        shadowLight.shadow.camera.right = shadowCamSize;
        shadowLight.shadow.camera.top = shadowCamSize;
        shadowLight.shadow.camera.bottom = -shadowCamSize;
        shadowLight.shadow.bias = -0.001;
        scene.add(shadowLight);

stadiumBodies = [];
stadiumMeshes = [];

        buildStadium(false);

        const GOLDEN_COLOR = 0xE6B422;

sharedSphereGeom = new THREE.SphereGeometry(params.ballRadius, 32, 32);
        const light = new THREE.PointLight(0xffffff, 0.15);
        light.position.set(135, 100, 160);
        scene.add(light);
        ballBody = world.add({ type: 'sphere', size: [params.ballRadius], pos: [20, 50, 0], move: true, density: 1, friction: params.friction, restitution: params.restitution });
        ballBody.name = "Player"; ballBody.kills = 0; ballBody.lastTouchedBy = null; ballBody.team = "A"; ballBody.lives = 3; ballBody.isAlive = true; ballBody.stress = 0;

        sphere = new THREE.Mesh(sharedSphereGeom, createSphereMaterial(GOLDEN_COLOR));
        sphere.castShadow = true;
        scene.add(sphere);

        // 復元: スプライト生成時に太字を排除
sharedTorusGeom = new THREE.TorusGeometry(params.ballRadius * 0.5, 0.2, 8, 24);
sharedSparkGeom = new THREE.BoxGeometry(0.8, 0.8, 0.8);

        const createShadow = () => {
            const sh = new THREE.Mesh(
                sharedShadowGeom,
                new THREE.MeshBasicMaterial({
                    color: 0x343434, transparent: true, opacity: 0.5,
                    depthWrite: false,
                    depthTest: true,
                    polygonOffset: true,
                    polygonOffsetFactor: -1,
                    polygonOffsetUnits: -4
                })
            );
            sh.rotation.x = -Math.PI / 2;
            sh.visible = false;
            return sh;
        };
        ballShadow = createShadow(); scene.add(ballShadow);

aiEntities = []; aiCounter = 0;
        const effects = [];


        window.onkeydown = e => {
            keys[e.key.toLowerCase()] = true;
            if (e.key.toLowerCase() === 'r') startCountdown('reset');
            if (e.key.toLowerCase() === 'h') toggleUI();
        };
        window.onkeyup = e => keys[e.key.toLowerCase()] = false;

        const currentAccel = new THREE.Vector3(0, 0, 0);
        const LOBBY_PREFIX = "KINTA3D_WIFI_";

        let peer = null;
myPeerId = "offline_player";
        let activeConns = [];
remoteEntities = {};
        let scanTimer = null;

        window.closeServerDialog = function () {
            if (scanTimer) {
                clearInterval(scanTimer);
                scanTimer = null;
            }
            const dialog = document.getElementById('server-dialog');
            if (dialog) dialog.style.display = 'none';
            const list = document.getElementById('server-list');
            if (list) list.innerHTML = "";
        };

        restartTimer = null; resetTimer = null;

        // キー/ジョイスティック/ジャイロの合成移動入力を返す

        // カメラ方向を考慮して moveX/moveZ をワールド軸に変換した正規化ベクトルを返す

lastTime = performance.now();
        _tempVector = new THREE.Vector3();
        _tempHV = new THREE.Vector2();
        _gcBodies = [];
        _gcIds = [];
        _allBodies = [];

        function animate() {
            const currentTime = performance.now();

            if (camJoy.active && cameraMode !== 'DEFAULT') {
                const sensitivity = 0.04000000000;
                camYaw -= camJoy.x * 1.5 * sensitivity;
                camPitch -= camJoy.y * 0.75 * sensitivity;

                const limit = 80 * Math.PI / 180;
                camPitch = Math.max(-limit, Math.min(limit, camPitch));
            }

            const deltaTime = currentTime - lastTime;
            if (deltaTime >= frameTime) {
                lastTime = currentTime - (deltaTime % frameTime);
                const now = Date.now();
                maxSpeedSq = params.maxSpeed * params.maxSpeed;
                const maxSpeed3  = params.maxSpeed * 3;
                const remoteEntries = Object.entries(remoteEntities);

                if (!isClientMode) {
                    if (ballBody.isAlive) {
                        _tempVector.set(0, 0, 0); 
                        const targetAccel = _tempVector;
                        const { x: moveX, z: moveZ } = readMoveInput();
                        const iv = getInputVector(moveX, moveZ);
                        targetAccel.x = iv.x * params.accel;
                        targetAccel.z = iv.z * params.accel;

                        const bPos = ballBody.getPosition();
                        const pAirMult = (bPos.y < 10.5 || (bPos.y >= 10.5 && (Math.abs(bPos.x) > params.size / 2 || Math.abs(bPos.z) > params.size / 2))) ? 1.0 : 0.8;
                        currentAccel.x += (targetAccel.x * pAirMult - currentAccel.x) * params.jerk;
                        currentAccel.z += (targetAccel.z * pAirMult - currentAccel.z) * params.jerk;
                        const bvx = ballBody.linearVelocity.x, bvz = ballBody.linearVelocity.z;
                        const spd2 = bvx * bvx + bvz * bvz;

                        if (spd2 > maxSpeedSq) {
                            if (origSoftcapEnabled) {
                                const dot = currentAccel.x * bvx + currentAccel.z * bvz;
                                if (dot > 0) { const vLen = Math.sqrt(spd2); const vNx = bvx / vLen, vNz = bvz / vLen; currentAccel.x -= vNx * dot / spd2 * vLen; currentAccel.z -= vNz * dot / spd2 * vLen; }
                            }
                        }

                        ballBody.linearVelocity.x += currentAccel.x;
                        ballBody.linearVelocity.z += currentAccel.z;

                        if (!origSoftcapEnabled) {
                            const newBvx = ballBody.linearVelocity.x, newBvz = ballBody.linearVelocity.z;
                            const newSpd2 = newBvx * newBvx + newBvz * newBvz;
                            if (newSpd2 > maxSpeedSq) {
                                _tempHV.set(newBvx, newBvz); _tempHV.setLength(params.maxSpeed);
                                ballBody.linearVelocity.x = _tempHV.x;
                                ballBody.linearVelocity.z = _tempHV.y;
                            }
                        }
                        if (keys[' '] && bPos.y < 15) { ballBody.applyImpulse(bPos, { x: 0, y: 260, z: 0 }); }
                    } else { ballBody.resetPosition(10000, -5000, 0); }

                    // AI共通キャッシュ: 全候補ボディとその座標を1回だけ取得し全AIで共有
                    const _aiCandidates = [ballBody];
                    for (let i = 0; i < aiEntities.length; i++) _aiCandidates.push(aiEntities[i].body);
                    for (const [, re] of remoteEntries) { if (re.body) _aiCandidates.push(re.body); }

                    const _aiPosCache = new Map();
                    for (const b of _aiCandidates) {
                        if (b && b.isAlive) _aiPosCache.set(b, b.getPosition());
                    }

                    aiEntities.forEach(e => updateAI(e, _aiCandidates, _aiPosCache));
                    for (const [id, re] of remoteEntries) {
                        if (re.isInputDriven && re.body) {
                            if (re.body.isAlive) {
                                const rb = re.body; const rbPos = rb.getPosition(); const rAirMult = (rbPos.y < 10.5 || (rbPos.y >= 10.5 && (Math.abs(rbPos.x) > params.size / 2 || Math.abs(rbPos.z) > params.size / 2))) ? 1.0 : 0.8;
                                re.accel.x += (re.input.x * params.accel * rAirMult - re.accel.x) * params.jerk;
                                re.accel.z += (re.input.z * params.accel * rAirMult - re.accel.z) * params.jerk;
                                
                                const rbvx = rb.linearVelocity.x, rbvz = rb.linearVelocity.z;
                                const rspd2 = rbvx * rbvx + rbvz * rbvz;

                                if (rspd2 > maxSpeedSq) {
                                    if (origSoftcapEnabled) {
                                        const rdot = re.accel.x * rbvx + re.accel.z * rbvz;
                                        if (rdot > 0) { const rLen = Math.sqrt(rspd2); const rNx = rbvx / rLen, rNz = rbvz / rLen; re.accel.x -= rNx * rdot / rspd2 * rLen; re.accel.z -= rNz * rdot / rspd2 * rLen; }
                                    }
                                }

                                rb.linearVelocity.x += re.accel.x;
                                rb.linearVelocity.z += re.accel.z;

                                if (!origSoftcapEnabled) {
                                    const nBvx = rb.linearVelocity.x, nBvz = rb.linearVelocity.z;
                                    const nSpd2 = nBvx * nBvx + nBvz * nBvz;
                                    if (nSpd2 > maxSpeedSq) {
                                        _tempHV.set(nBvx, nBvz); _tempHV.setLength(params.maxSpeed);
                                        rb.linearVelocity.x = _tempHV.x;
                                        rb.linearVelocity.z = _tempHV.y;
                                    }
                                }
                                if (re.input.jump && rbPos.y < 15) { rb.applyImpulse(rbPos, { x: 0, y: 260, z: 0 }); re.input.jump = false; }
                            } else { re.body.resetPosition(10000, -5000, 0); }
                        }
                    }
                    
                    _allBodies.length = 0;
                    _allBodies.push(ballBody);
                    for (let i = 0; i < aiEntities.length; i++) _allBodies.push(aiEntities[i].body);
                    for (const [id, r] of remoteEntries) { if (r.body) _allBodies.push(r.body); }
                    for (let i = 0; i < _allBodies.length; i++) {
                        const b = _allBodies[i];
                        if (!b.isAlive) continue;
                        if (b.linearVelocity.y > 0.1) b.linearVelocity.y += 0.5;

                        b.angularVelocity.x *= 0.95;
                        b.angularVelocity.y *= 0.95;
                        b.angularVelocity.z *= 0.95;

                        _tempHV.set(b.linearVelocity.x, b.linearVelocity.z);
                        if (_tempHV.length() > maxSpeed3) { _tempHV.setLength(maxSpeed3); b.linearVelocity.x = _tempHV.x; b.linearVelocity.z = _tempHV.y; }
                    }
                    handleGlobalCollisions();
                    world.step();

                    if (now - lastSyncTime >= SYNC_INTERVAL) {
                        const syncData = {
                            type: 'sync', entities: [
                                { id: myPeerId, pos: { x: ballBody.getPosition().x, y: ballBody.getPosition().y, z: ballBody.getPosition().z }, vel: { x: ballBody.linearVelocity.x, y: ballBody.linearVelocity.y, z: ballBody.linearVelocity.z }, color: sphere.material.color.getHex(), name: ballBody.name, kills: ballBody.kills, team: ballBody.team, isAlive: ballBody.isAlive },
                                ...aiEntities.map(e => ({ id: e.id, pos: { x: e.body.getPosition().x, y: e.body.getPosition().y, z: e.body.getPosition().z }, vel: { x: e.body.linearVelocity.x, y: e.body.linearVelocity.y, z: e.body.linearVelocity.z }, color: e.color, name: e.body.name, kills: e.body.kills, team: e.body.team, isAlive: e.body.isAlive }))
                            ]
                        };
                        for (const [id, re] of remoteEntries) { if (re.isInputDriven) { syncData.entities.push({ id: id, pos: { x: re.body.getPosition().x, y: re.body.getPosition().y, z: re.body.getPosition().z }, vel: { x: re.body.linearVelocity.x, y: re.body.linearVelocity.y, z: re.body.linearVelocity.z }, color: re.mesh.material.color.getHex(), name: re.body.name, kills: re.body.kills, team: re.body.team, isAlive: re.body.isAlive }); } }
                        broadcastEvent(syncData); lastSyncTime = now;
                    }
                } else {
                    if (selfSync.ts > 0 && ballBody.isAlive) {
                        const timeSinceUpdate = (Date.now() - selfSync.ts) / 1000; const predictedPos = selfSync.pos.clone().addScaledVector(selfSync.vel, timeSinceUpdate);
                        sphere.position.lerp(predictedPos, 0.4); ballBody.resetPosition(sphere.position.x, sphere.position.y, sphere.position.z);
                        ballBody.linearVelocity.copy(selfSync.vel);
                        updateShadow(ballShadow, sphere.position);
                    } else if (!ballBody.isAlive) { sphere.position.set(10000, -5000, 0); ballBody.resetPosition(10000, -5000, 0); }
                    for (const [id, re] of remoteEntries) {
                        if (re && re.lastSyncPos && re.lastSyncVel && re.body.isAlive) {
                            const timeSinceUpdate = (Date.now() - re.lastSyncTs) / 1000; const predictedPos = re.pos.clone().addScaledVector(re.velocity, timeSinceUpdate);
                            re.mesh.position.lerp(predictedPos, 0.4); re.body.resetPosition(re.mesh.position.x, re.mesh.position.y, re.mesh.position.z); updateShadow(re.shadow, re.mesh.position);
                        } else if (re && !re.body.isAlive) { re.mesh.position.set(10000, -5000, 0); re.body.resetPosition(10000, -5000, 0); }
                    }
                    if (hostConn && hostConn.open) {
                        if (now - lastSendTime >= SYNC_INTERVAL) {
                            const targetInput = { x: 0, z: 0, jump: false, name: playerNameEl.value };
                            if (ballBody.isAlive) {
                                const { x: moveX, z: moveZ } = readMoveInput();
                                if (keys[' ']) targetInput.jump = true;
                                const iv = getInputVector(moveX, moveZ);
                                targetInput.x = iv.x;
                                targetInput.z = iv.z;
                            }

                            hostConn.send(packData({ type: 'client_update', input: targetInput, name: playerNameEl.value }));
                            lastSendTime = now;
                        }
                    }
                    handleClientVisualCollisions();
                }


                if (!isClientMode) { const bp = ballBody.getPosition(); sphere.position.set(bp.x, bp.y, bp.z); updateShadow(ballShadow, sphere.position); }


                const pName = playerNameEl.value;
                const currentModeKey = (isSurvivalMode ? 'S' : '') + (isKnockbackMode ? 'K' : '');
                const currentLivesVal = isSurvivalMode ? ((typeof ballBody.lives !== 'undefined') ? ballBody.lives : initialLives) : -1;
                const currentStressVal = (isKnockbackMode || ballBody.stress > 0) ? (ballBody.stress || 0) : -1;

                const playerExtra = (isKnockbackMode || currentStressVal > 0)
                    ? `(+${Math.round(Math.max(0, currentStressVal) * 2)}%)` : '';
                // ballBody.name を pName と同期してから updateSprite に渡す
                ballBody.name = pName;
                const mySprite = updateSprite(playerSpriteObj, ballBody, playerExtra);
                if (mySprite) {
                    mySprite.visible = ballBody.isAlive;
                    mySprite.position.set(sphere.position.x, sphere.position.y + 35, sphere.position.z);
                }

                aiEntities.forEach(e => {
                    const ep = e.body.getPosition(); e.mesh.position.copy(ep);
                    const sp = updateSprite(e, e.body);
                    if (sp) { sp.visible = e.body.isAlive; sp.position.set(ep.x, ep.y + 35, ep.z); updateShadow(e.shadow, ep); }
                });
                for (const [id, re] of remoteEntries) {
                    if (Date.now() - re.lastUpdate > 2500) {
                        destroyEntity(re, true, id);
                        continue;
                    }
                    if (!isClientMode) { re.mesh.position.copy(re.body.getPosition()); }
                    const rsp = updateSprite(re, re.body);
                    if (rsp) { rsp.visible = re.body.isAlive; rsp.position.set(re.mesh.position.x, re.mesh.position.y + 35, re.mesh.position.z); updateShadow(re.shadow, re.mesh.position); }
                }

                // モードに関わらず常にカメラ位置とオートズームを更新
                updateCameraPos();

                for (let i = effects.length - 1; i >= 0; i--) {
                    const ef = effects[i];
                    ef.life -= (ef.decayRate || 0.0111);
                    if (ef.type === 'ring') {
                        ef.mesh.scale.addScalar(ef.speed);
                        ef.speed *= 0.92; 
                    } else if (ef.type === 'spark') {
                        ef.mesh.position.add(ef.velocity);
                        ef.velocity.multiplyScalar(0.99); 
                    }
                    if (ef.mesh.material) ef.mesh.material.opacity = ef.life;
                    if (ef.life <=0) {
                        scene.remove(ef.mesh);
                        if (ef.mesh.material) ef.mesh.material.dispose();
                        effects.splice(i, 1);
                    }
                }

                if (!isClientMode) {
                    if (ballBody.getPosition().y < -400.0 && ballBody.getPosition().y > -1000.0) handleFall(ballBody);
                    aiEntities.forEach(e => { if (e.body.getPosition().y < -400.0 && e.body.getPosition().y > -1000.0) handleFall(e.body); });
                    for (const [, re] of remoteEntries) { if (re.body && re.body.getPosition().y < -400.0 && re.body.getPosition().y > -1000.0) handleFall(re.body); }
                }
                
                // HUD表示データの取得 (自分または観戦対象)
                const hudId = (!ballBody.isAlive || ballBody.lives <= 0) ? spectatorTargetId : myPeerId;
                const hudTarget = getEntityById(hudId);
                if (cameraMode !== 'DEFAULT' && hudTarget && hudTarget.body) {
                    const speed = Math.sqrt(hudTarget.body.linearVelocity.x ** 2 + hudTarget.body.linearVelocity.z ** 2);
                    // 自視点(hudId == myPeerId)なら名前なし、他視点なら名前を表示
                    const label = (hudId === myPeerId) ? "" : `${toFullWidth(hudTarget.body.name)}｜`;
                    document.getElementById('speedometer').innerText = `${label}ＳＰＤ：${toFullWidth(Math.round(speed))}`;
                    
                    const livesVal = (isSurvivalMode && typeof hudTarget.body.lives === 'number') ? hudTarget.body.lives : '-';
                    const stressVal = typeof hudTarget.body.stress === 'number' ? Math.max(0, Math.round(hudTarget.body.stress * 2)) : 0;
                    const kbText = isKnockbackMode ? `｜ＫＢ：${toFullWidth(knockbackRate.toFixed(1))}ｘ` : "";
                    document.getElementById('status-3rd').innerText = `ＬＩＶＥＳ：${toFullWidth(livesVal)}｜ＤＭＧ：${toFullWidth(stressVal)}％${kbText}`;
                }
                renderer.render(scene, camera);
            }
            requestAnimationFrame(animate);
        }
        animate();