// ルール：元モード（オリジナルモード）

function applyOrigToggleButton(btnId, isOn, label) {
            const btn = document.getElementById(btnId);
            if (!btn) return;
            btn.textContent = `${label}: ${isOn ? 'ON' : 'OFF'}`;
            btn.style.background = isOn ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.8)';
            btn.style.color = isOn ? '#fff' : '#aaa';
        }


function toggleOrigSoftcap() {
            origSoftcapEnabled = !origSoftcapEnabled;
            applyOrigToggleButton('btn-orig-softcap', origSoftcapEnabled, '速度解放');
        }


function updateOrigFOV() {
            const size = parseFloat(elOrigSize.value) || 298.25;
            const wallT = parseFloat(elOrigWallT.value) || 31;

            const reqRadius = (size / 2 + wallT) * 1.07;
            const dist = 413.4;
            const minHalfFovTan = reqRadius / dist;
            let recommendedFov = Math.atan(minHalfFovTan) * 2 * (180 / Math.PI);
            recommendedFov = Math.min(170, Math.max(10, Math.round(recommendedFov)));

            const fovInp = elOrigCamFov;
            if (fovInp) fovInp.value = recommendedFov;

            applyOrigLive();
        }


function applyOrigLive(source) {
            const ms = parseFloat(elOrigMaxSpeed.value) || 200;
            if (source !== 'from_esc') {
                const eStartInp = elEscStart;
                if (eStartInp) { eStartInp.value = ms; syncEscSettings('start'); }
            }
            if (!isOriginalActive) return;

            const ac = parseFloat(elOrigAccel.value) || 2.25;
            const jk = parseFloat(elOrigJerk.value) || 0.35;
            const gr = parseFloat(elOrigGrav.value) || 3.3;
            const re = parseFloat(elOrigRestitution.value);
            const rawFov = parseFloat(elOrigCamFov.value);
            const fov = isNaN(rawFov) ? 50 : rawFov;

            origParams.camFov = fov; origParams.maxSpeed = ms; origParams.accel = ac; origParams.jerk = jk; origParams.gravity = gr; origParams.restitution = isNaN(re) ? 0.4875 : re;
            params.maxSpeed = ms; params.accel = ac; params.jerk = jk; params.gravity = gr; params.restitution = origParams.restitution;
            if (typeof world !== 'undefined' && world.gravity) world.gravity.set(0, -gr * 60, 0);
            camera.fov = fov; camera.updateProjectionMatrix(); updateCameraPos();
            updateSpeedStats();
            if (!isClientMode && activeConns.length > 0) broadcastSettings();
        }


function resetOrigSettings() {
            elOrigCamFov.value = 50;
            elOrigMaxSpeed.value = 200;
            elOrigAccel.value = 2.25;
            elOrigJerk.value = 0.35;
            elOrigGrav.value = 3.3;
            elOrigBallSize.value = 14.50;
            elOrigSize.value = 298.25;
            document.getElementById('sel-orig-wall-h').value = 4.2;
            elOrigWallT.value = 31;
            document.getElementById('sel-orig-slope').value = 0;
            elOrigRestitution.value = 0.4875;
            applyOrigLive();
        }

