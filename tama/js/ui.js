// UI表示・スプライト

function initSpriteResources() {
            const canvas = document.createElement('canvas');
            canvas.width = SPRITE_W; canvas.height = SPRITE_H;
            const ctx = canvas.getContext('2d');
            ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#ffffff';
            const tex = new THREE.CanvasTexture(canvas);
            tex.minFilter = THREE.LinearFilter;
            const mat = new THREE.SpriteMaterial({ map: tex });
            const sprite = new THREE.Sprite(mat);
            return { canvas, ctx, tex, sprite };
        }


function drawSpriteContent(res, name, kills, lives, extraText) {
            const { ctx, tex } = res;
            ctx.clearRect(0, 0, SPRITE_W, SPRITE_H);
            ctx.font = SPRITE_FONT;

            let str = kills > 0 ? `[${kills}] ` : '';
            str += name;

            const hasLives = lives >= 0;
            const cleanExtra = extraText ? extraText.replace(/[\(\)\+]/g, '') : '';
            const hasStress = cleanExtra !== '';

            if (hasLives && hasStress) str += ` (${lives}|${cleanExtra})`;
            else if (hasLives) str += ` (${lives})`;
            else if (hasStress) str += ` (${cleanExtra})`;

            ctx.fillText(str, SPRITE_W / 2, SPRITE_H / 2);
            res.sprite.scale.set((hasLives || hasStress) ? 110 : 160, 25, 1);
            tex.needsUpdate = true;
        }


function updateSprite(obj, body, extraOverride) {
            let livesVal = -1;
            if (isSurvivalMode) livesVal = (typeof body.lives === 'number') ? body.lives : initialLives;
            let stressVal = -1;
            if (isKnockbackMode || (typeof body.stress === 'number' && body.stress > 0)) stressVal = body.stress || 0;
            const modeKey = (isSurvivalMode ? 'S' : '') + (isKnockbackMode ? 'K' : '');
            // stress は毎フレーム微変動するが表示は整数%なので、表示値で比較してムダな再描画を防ぐ
            const stressDisplay = stressVal >= 0 ? Math.round(Math.max(0, stressVal) * 2) : -1;
            const lastStressDisplay = obj.lastStress >= 0 ? Math.round(Math.max(0, obj.lastStress) * 2) : -1;

            const unchanged = obj._spriteRes &&
                obj.lastDisplayName === body.name && obj.lastKills === body.kills &&
                obj.lastLives === livesVal && stressDisplay === lastStressDisplay &&
                obj.lastModeKey === modeKey && obj.lastStress !== null && obj.lastLives !== null;
            if (unchanged) return obj._spriteRes.sprite;

            if (!obj._spriteRes) { obj._spriteRes = initSpriteResources(); scene.add(obj._spriteRes.sprite); }

            const extra = extraOverride !== undefined ? extraOverride
                : (isKnockbackMode || stressVal > 0) ? `(${stressDisplay}%)` : '';

            drawSpriteContent(obj._spriteRes, body.name, body.kills, livesVal, extra);
            obj.lastDisplayName = body.name; obj.lastKills = body.kills; obj.lastLives = livesVal;
            obj.lastStress = stressVal; obj.lastModeKey = modeKey;
            return obj._spriteRes.sprite;
        }


function updateShadow(shadow, pos) {
            if (!isEscalationMode || pos.y < -50) { shadow.visible = false; return; }

            const stadiumLimit = (params.size / 2) + (params.wallH * TAN_35) + params.wallT;
            const shadowActivationLimit = stadiumLimit - (params.ballRadius * 2.0);

            if (Math.abs(pos.x) <= shadowActivationLimit && Math.abs(pos.z) <= shadowActivationLimit) {
                shadow.visible = false;
                return;
            }

            shadow.visible = true;
            const shadowY = Math.min(params.wallH, pos.y - params.ballRadius - 0.1);
            shadow.position.set(pos.x, shadowY, pos.z);
            const opacity = Math.max(0.12, 0.5 - pos.y / 600);
            shadow.material.opacity = opacity;

            shadow.material.depthTest = true;
        }


function updateSpeedStats() {
            const el = document.getElementById('speed-stats');
            const btn = document.getElementById('zoom-toggle-btn');
            if (isEscalationMode) {
                el.style.display = "block"; // オートズームボタンは常に非表示のため、ここでは制御しない
                el.innerHTML = `MAX: ${params.maxSpeed.toFixed(1)}<br>ACC: ${params.accel.toFixed(3)}`;
            } else {
                el.style.display = "none"; // オートズームボタンは常に非表示のため、ここでは制御しない
            }
        }


function updateLeaderboard() {
            const board = document.getElementById('kill-leaderboard'); if (!board) return;
            const getSuffix = (b) => {
                // 全角化してサイズを統一
                let s = `${toFullWidth(b.kills || 0)}Ｋ`;
                if (isKnockbackMode) {
                    const given = Math.round((b.totalStressGiven || 0) * 2);
                    s += `／${toFullWidth(given)}％`;
                }
                if (isSurvivalMode) {
                    const l = (typeof b.lives === 'number') ? b.lives : initialLives;
                    s += `（${toFullWidth(l)}）`;
                }
                return s;
            };
            let html = "";
            const isMeP = !isCustomMatchActive || (ballBody && ballBody.isMatchParticipant === true);
            if (isMeP && ballBody) {
                html += `<div class="kill-row"><span>${toFullWidth(ballBody.name)}</span><span>${getSuffix(ballBody)}</span></div>`;
            }
            aiEntities.forEach(e => { html += `<div class="kill-row"><span>${toFullWidth(e.body.name)}</span><span>${getSuffix(e.body)}</span></div>`; });
            for (let id in remoteEntities) {
                const re = remoteEntities[id];
                const isRP = !isCustomMatchActive || (re.isMatchParticipant === true);
                if (!isRP) continue;
                html += `<div class="kill-row"><span>${toFullWidth(re.body.name)}</span><span>${getSuffix(re.body)}</span></div>`;
            }
            board.innerHTML = html;
        }


function updateRuleUI() {
            const chkS = document.getElementById('chk-survival');
            const chkK = document.getElementById('chk-knockback');
            const chkE = document.getElementById('chk-escalation');
            const chkO = document.getElementById('chk-original');
            if (chkS && document.getElementById('setting-survival')) document.getElementById('setting-survival').style.display = chkS.checked ? 'block' : 'none';
            if (chkK && document.getElementById('setting-knockback')) document.getElementById('setting-knockback').style.display = chkK.checked ? 'block' : 'none';
            if (chkE && document.getElementById('setting-escalation')) document.getElementById('setting-escalation').style.display = chkE.checked ? 'block' : 'none';
            if (chkO && document.getElementById('setting-original')) document.getElementById('setting-original').style.display = chkO.checked ? 'block' : 'none';
        }


function toggleUI() {
            const ui = document.getElementById('ui');
            const btn = document.getElementById('ui-toggle-btn');
            ui.classList.toggle('minimized');
            if (ui.classList.contains('minimized')) {
                btn.innerText = '＋';
            } else {
                btn.innerText = '−';
            }
        }


function toggleSettings() {
            const m = document.getElementById('settings-modal');
            const o = document.getElementById('settings-overlay');
            if (m.style.display === 'block') { m.style.display = 'none'; o.style.display = 'none'; }
            else { m.style.display = 'block'; o.style.display = 'block'; }
        }


function closeSettings() { document.getElementById('settings-modal').style.display = 'none'; document.getElementById('settings-overlay').style.display = 'none'; }


function toggleFullScreen() {
            if (!document.fullscreenElement) document.documentElement.requestFullscreen();
            else if (document.exitFullscreen) document.exitFullscreen();
        }


function openFullLog() { closeSettings(); document.getElementById('full-log-modal').style.display = 'flex'; }


function closeFullLog() { document.getElementById('full-log-modal').style.display = 'none'; }


function toggleCameraZoom() {
            isCameraAutoZoom = !isCameraAutoZoom;
            const btn = document.getElementById('zoom-toggle-btn');
            btn.innerText = `AUTO ZOOM: ${isCameraAutoZoom ? 'ON' : 'OFF'}`;
            if (isCameraAutoZoom) btn.classList.add('active');
            else btn.classList.remove('active');
        }


function updatePeerCount() { const el = document.getElementById('peer-count'); if (el) el.innerText = activeConns.length; }


function setMode(mode) {
            if (peer) {
                addLog("Please press 'EXIT GAME' to disconnect first.");
                return;
            }
            if (mode === 'host') {
                startHostMode();
            }
            else if (mode === 'client') {
                isClientMode = true;
                document.getElementById('btn-client').classList.add('active');
                const restBtn = document.getElementById('restart-btn'); if (restBtn) restBtn.style.display = 'none';
                openServerDialog();
            }
        }
