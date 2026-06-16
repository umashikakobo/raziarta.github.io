// ルール：速度アップ（エスカレーション）

function startEscalation(startSpd, maxSpd) {
            stopEscalation();
            isEscalationMode = true;

            const sSpd = startSpd !== undefined ? startSpd : parseFloat(elEscStart.value);
            const mSpd = maxSpd !== undefined ? maxSpd : parseFloat(elEscMax.value);

            params.maxSpeed = sSpd;
            const ratio = (sSpd - ESC_DEFAULT_START_SPEED) / 10;
            params.accel = 4.025 + ratio * 0.22;
            params.jerk = 0.075 + ratio * 0.004;

            updateSpeedStats(); updateCameraPos();
            if (isClientMode) return;

            escalationTimer = setInterval(() => {
                if (params.maxSpeed < mSpd) {
                    params.maxSpeed = Math.min(mSpd, params.maxSpeed + 10.0);
                    params.accel += 0.22;
                    params.jerk += 0.004;
                    updateSpeedStats(); updateCameraPos();
                    broadcastEvent({ eventType: 'param_update', maxSpeed: params.maxSpeed, accel: params.accel });
                }
            }, 10000);
        }


function stopEscalation() {
            isEscalationMode = false;
            if (escalationTimer) clearInterval(escalationTimer);
            escalationTimer = null;
            if (isOriginalActive) {
                params.maxSpeed = origParams.maxSpeed;
                params.accel = origParams.accel;
                params.jerk = origParams.jerk;
            } else {
                params.maxSpeed = initialParams.maxSpeed;
                params.accel = initialParams.accel;
                params.jerk = initialParams.jerk;
            }
            updateSpeedStats(); updateCameraPos();
            if (!isClientMode && activeConns.length > 0) broadcastEvent({ eventType: 'param_update', maxSpeed: params.maxSpeed, accel: params.accel });
        }


function syncEscSettings(source) {
            const sInp = elEscStart;
            const mInp = elEscMax;
            let sSpd = parseFloat(sInp.value) || 0;
            let mSpd = parseFloat(mInp.value) || 0;
            if (source === 'start') {
                if (sSpd > mSpd) { mInp.value = sSpd; mSpd = sSpd; }
                const oMaxInp = elOrigMaxSpeed;
                if (oMaxInp) { oMaxInp.value = sSpd; applyOrigLive('from_esc'); }
            } else if (source === 'max') {
                if (mSpd < sSpd) {
                    sInp.value = mSpd; sSpd = mSpd;
                    const oMaxInp = elOrigMaxSpeed;
                    if (oMaxInp) { oMaxInp.value = sSpd; applyOrigLive('from_esc'); }
                }
            }
        }

