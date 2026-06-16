// 入力処理（キーボード・ジョイスティック・ジャイロ）
var keys = {};
var camJoy = { active: false, x: 0, y: 0, touchId: null };
var gyroData = { active: false, moveX: 0, moveZ: 0 };
var touchData = { active: false, touchId: null, moveX: 0, moveZ: 0 };
var JOY_SIZE = 160;

function computeJoystickVector(outerEl, touch) {
            const rect = outerEl.getBoundingClientRect();
            const centerX = rect.left + rect.width / 2;
            const centerY = rect.top + rect.height / 2;
            let dx = touch.clientX - centerX;
            let dy = touch.clientY - centerY;
            const distance = Math.sqrt(dx * dx + dy * dy);
            const maxRadius = rect.width / 2;

            if (distance > maxRadius) {
                const ratio = maxRadius / distance;
                dx *= ratio;
                dy *= ratio;
            }

            return { dx, dy, x: dx / maxRadius, y: dy / maxRadius };
        }


function resetJoystick(state, innerEl, xKey, yKey) {
            state.active = false;
            state.touchId = null;
            state[xKey] = 0;
            state[yKey] = 0;
            innerEl.style.transform = `translate(0px, 0px)`;
        }


function updateMoveJoystick(touch) {
            const v = computeJoystickVector(moveJoyOuter, touch);
            touchData.moveX = v.x;
            touchData.moveZ = v.y;
            moveJoyInner.style.transform = `translate(${v.dx}px, ${v.dy}px)`;
        }


function updateCamJoystick(touch) {
            const v = computeJoystickVector(camJoyOuter, touch);
            camJoy.x = v.x;
            camJoy.y = v.y;
            camJoyInner.style.transform = `translate(${v.dx}px, ${v.dy}px)`;
        }


function readMoveInput() {
            let x = 0, z = 0;
            if (keys['w'] || keys['arrowup'])    z -= 1;
            if (keys['s'] || keys['arrowdown'])  z += 1;
            if (keys['a'] || keys['arrowleft'])  x -= 1;
            if (keys['d'] || keys['arrowright']) x += 1;
            if (touchData && touchData.active) { x += touchData.moveX; z += touchData.moveZ; }
            if (gyroData  && gyroData.active)  { x += gyroData.moveX;  z += gyroData.moveZ; }
            return { x, z };
        }


function getInputVector(moveX, moveZ) {
            if (cameraMode !== 'DEFAULT' && (moveX !== 0 || moveZ !== 0)) {
                const sinY = Math.sin(camYaw), cosY = Math.cos(camYaw);
                const tx = moveZ * sinY + moveX * cosY;
                const tz = moveZ * cosY - moveX * sinY;
                const mag = Math.min(1.0, Math.sqrt(moveX * moveX + moveZ * moveZ));
                const tMag = Math.sqrt(tx * tx + tz * tz) || 1;
                return { x: (tx / tMag) * mag, z: (tz / tMag) * mag };
            }
            return { x: moveX, z: moveZ };
        }


function setupDraggableDpad(handleId, containerId) {
            const handle = document.getElementById(handleId);
            const container = document.getElementById(containerId);
            if (!handle || !container) return;

            let isDragging = false;
            let startX, startY, initialLeft, initialTop;

            const onStart = (e) => {
                isDragging = true;
                const touch = e.touches ? e.touches[0] : e;
                startX = touch.clientX;
                startY = touch.clientY;
                const rect = container.getBoundingClientRect();
                initialLeft = rect.left;
                initialTop = rect.top;

                container.style.right = 'auto';
                container.style.bottom = 'auto';
                e.preventDefault();
            };

            const onMove = (e) => {
                if (!isDragging) return;
                const touch = e.touches ? e.touches[0] : e;
                const dx = touch.clientX - startX;
                const dy = touch.clientY - startY;
                container.style.left = (initialLeft + dx) + 'px';
                container.style.top = (initialTop + dy) + 'px';
                e.preventDefault();
            };

            const onEnd = () => { isDragging = false; };

            handle.addEventListener('touchstart', onStart, { passive: false });
            handle.addEventListener('touchmove', onMove, { passive: false });
            handle.addEventListener('touchend', onEnd);
            handle.addEventListener('mousedown', onStart);
            document.addEventListener('mousemove', onMove);
            document.addEventListener('mouseup', onEnd);
        }


function requestGyroPermission() {
            if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
                DeviceOrientationEvent.requestPermission()
                    .then(permissionState => {
                        if (permissionState === 'granted') {
                            gyroData.active = true;
                            lockLandscape();
                        } else {
                            alert('Gyroscope permission denied.');
                            setControlMode(3);
                        }
                    })
                    .catch(console.error);
            } else {
                gyroData.active = true;
                lockLandscape();
            }
        }


function setControlMode(mode) {
            controlMode = mode;

            const btn1 = document.getElementById('btn-ctrl-1');
            const btn2 = document.getElementById('btn-ctrl-2');
            const btn3 = document.getElementById('btn-ctrl-3');
            const btn4 = document.getElementById('btn-ctrl-4');
            if (btn1) btn1.className = (mode === 1) ? 'mode-btn active' : 'mode-btn';
            if (btn2) btn2.className = (mode === 2) ? 'mode-btn active' : 'mode-btn';
            if (btn3) btn3.className = (mode === 3) ? 'mode-btn active' : 'mode-btn';
            if (btn4) btn4.className = (mode === 4) ? 'mode-btn active' : 'mode-btn';

            const d1 = document.getElementById('dpad-type1');
            const d2l = document.getElementById('dpad-type2-left');
            const d2r = document.getElementById('dpad-type2-right');
            const joy = document.getElementById('joystick-outer');
            const camContainer = document.getElementById('cam-joystick-container');

            if (d1) d1.style.display = 'none';
            if (d2l) d2l.style.display = 'none';
            if (d2r) d2r.style.display = 'none';
            if (joy) joy.style.display = 'none';
            if (camContainer) camContainer.style.display = 'none';

            if (mode !== 4) { gyroData.active = false; }
            if (mode !== 3) {
                touchData.active = false;
                touchData.touchId = null;
                touchData.moveX = 0;
                touchData.moveZ = 0;
                if (moveJoyInner) moveJoyInner.style.transform = `translate(0px, 0px)`;
                if (moveJoyOuter) moveJoyOuter.style.display = 'none';
            }

            if (isMobile) {
                if (mode === 1) { if (d1) d1.style.display = 'flex'; }
                else if (mode === 2) { if (d2l) d2l.style.display = 'flex'; if (d2r) d2r.style.display = 'flex'; }
                else if (mode === 3) { /* ジョイスティックはタッチ時に表示 */ }

                if (camContainer && (cameraMode === '1ST' || cameraMode === '3RD')) {
                    camContainer.style.display = 'flex';
                }
            }

            if (mode === 4) {
                requestGyroPermission();
            }
        }


function handleDpadTouch(e) {
            if (controlMode === 3) return;
            const isTargetDpad = e.target && e.target.classList.contains('dpad-btn');
            let onDpad = false;
            const activeKeys = new Set();
            for (let i = 0; i < e.touches.length; i++) {
                const t = e.touches[i]; const el = document.elementFromPoint(t.clientX, t.clientY);
                if (el && el.dataset.key) { activeKeys.add(el.dataset.key); onDpad = true; }
            }
            if (!isTargetDpad && !onDpad) return;
            e.preventDefault();
            ['w', 'a', 's', 'd'].forEach(k => {
                const pressed = activeKeys.has(k); keys[k] = pressed;
                const btns = document.querySelectorAll(`.dpad-btn[data-key="${k}"]`);
                btns.forEach(b => { if (pressed) b.classList.add('active'); else b.classList.remove('active'); });
            });
        }

