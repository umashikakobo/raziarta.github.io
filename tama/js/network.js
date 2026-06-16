// ネットワーク（P2P・PeerJS）

function startHostMode() {
            if (peer) return;
            isClientMode = false;
            document.getElementById('btn-host').classList.add('active');
            const restBtn = document.getElementById('restart-btn'); if (restBtn) restBtn.style.display = 'block';

            addLog("Starting Host...");
            const roomNum = Math.floor(Math.random() * 15);
            const roomId = LOBBY_PREFIX + roomNum;
            peer = new Peer(roomId, {
                debug: 2,
                secure: true,
                config: {
                    'iceServers': [
                        { urls: 'stun:stun.l.google.com:19302' },
                        { urls: 'stun:stun1.l.google.com:19302' },
                        { urls: 'stun:stun2.l.google.com:19302' }
                    ]
                }
            });

            peer.on('open', id => {
                myPeerId = id;
                const status = document.getElementById('match-status');
                const displayId = id.replace(LOBBY_PREFIX, '');
                if (status) status.innerText = "Hosting (" + displayId + ")";
                addLog("Room created. Waiting for players...");
            });
            peer.on('connection', c => { setupConn(c); });
            peer.on('error', err => {
                if (err.type === 'peer-unavailable') return;

                if (err.type === 'unavailable-id') {
                    addLog("Room ID taken, trying another...");
                    peer.destroy(); peer = null; startHostMode(); return;
                }
                addLog("Network Error: " + err.type);
            });
        }


function setupConn(c) {
            c.on('open', () => {
                if (!activeConns.find(n => n.peer === c.peer)) {
                    activeConns.push(c); updatePeerCount();
                    if (isCustomMatchActive) {
                        if (remotePlayerParticipation[c.peer] === undefined) {
                            remotePlayerParticipation[c.peer] = false;
                        }
                        const np = Object.keys(remotePlayerParticipation).filter(id => remotePlayerParticipation[id] === false);
                        const settingsPkt = { type: 'apply_settings', isSurvival: isSurvivalMode, isKnockback: isKnockbackMode, isEscalation: isEscalationMode, lives: initialLives, kbRate: knockbackRate, remoteTeams: remotePlayerTeams, nonParticipants: np };

                        broadcastEvent(settingsPkt);

                        if (isEscalationMode) { c.send(packData({ type: 'event', eventType: 'param_update', maxSpeed: params.maxSpeed, accel: params.accel })); }
                    }
                }
            });
            c.on('data', rawData => {
                const data = unpackData(rawData);
                if (data.type === 'sync') {
                    data.entities.forEach(ent => {
                        updateRemoteEntity(ent.id, ent.pos, ent.vel, ent.color, ent.name, ent.kills, ent.team, ent.isAlive);
                        const re = remoteEntities[ent.id];
                        if (re && isClientMode) { re.lastSyncPos = { x: ent.pos.x, y: ent.pos.y, z: ent.pos.z }; re.lastSyncVel = { x: ent.vel.x, y: ent.vel.y, z: ent.vel.z }; re.lastSyncTs = Date.now(); }
                    });
                    if (isClientMode) {
                        const serverIds = data.entities.map(e => e.id);
                        for (let id in remoteEntities) {
                            if (id !== myPeerId && !serverIds.includes(id)) {
                                destroyEntity(remoteEntities[id], true, id);
                            }
                        }
                    }
                }
                const remoteEvents = ['event', 'apply_settings', 'stop_custom_match', 'reset_event', 'player_eliminated', 'ai_added', 'ai_removed'];
                if (remoteEvents.includes(data.type)) { handleRemoteEvent(data); }

                if (data.type === 'log') {
                    const log = document.getElementById('kill-log'); const entry = document.createElement('div'); entry.textContent = data.msg; log.appendChild(entry); if (log.childNodes.length > 15) log.removeChild(log.firstChild);
                    const fullLog = document.getElementById('full-log-list');
                    if (fullLog) { const fullEntry = document.createElement('div'); fullEntry.textContent = `[${new Date().toLocaleTimeString()}] ${data.msg}`; fullEntry.style.borderBottom = "1px solid rgba(255,255,255,0.1)"; fullLog.appendChild(fullEntry); fullLog.scrollTop = fullLog.scrollHeight; }
                }
                if (data.type === 'client_update' && !isClientMode) {
                    if (!remoteEntities[c.peer]) { const currentClientName = data.name || "Guest"; updateRemoteEntity(c.peer, { x: 0, y: 50, z: 0 }, { x: 0, y: 0, z: 0 }, 0x00F2FF, currentClientName, 0, "none"); }
                    const re = remoteEntities[c.peer];
                    if (re && re.isInputDriven && re.body.isAlive) { re.input = { x: data.input.x || 0, z: data.input.z || 0, jump: data.input.jump || false }; if (data.name) re.body.name = data.name; re.lastUpdate = Date.now(); }
                    else if (re && re.isInputDriven) { re.lastUpdate = Date.now(); }
                }
                if (!isClientMode) {
                    if (data.type === 'request_all_restart') resetAll();
                    if (data.type === 'request_self_reset') {
                        const re = remoteEntities[c.peer];
                        if (re && re.body.isAlive) { const p = getRandomPos(); re.body.resetPosition(p.x, 50, p.z); re.body.linearVelocity.set(0, 0, 0); re.accel.set(0, 0, 0); re.body.kills = 0; broadcastEvent({ type: 'reset_event', id: c.peer, pos: p }); }
                    }
                    if (data.type === 'request_add_ai') addAI();
                    if (data.type === 'request_remove_ai') removeAI();
                }
            });
            c.on('close', () => {
                if (remoteEntities[c.peer]) {
                    const name = remoteEntities[c.peer].body.name || "A player"; addLog(`${name} has left the game.`);
                    destroyEntity(remoteEntities[c.peer], true, c.peer);
                }
                activeConns = activeConns.filter(n => n.peer !== c.peer); updatePeerCount();
            });
        }


function openServerDialog() {
            const dialog = document.getElementById('server-dialog'); const list = document.getElementById('server-list'); dialog.style.display = 'block'; list.innerHTML = "Connecting to network...";

            if (!peer) {
                peer = new Peer({
                    debug: 2,
                    secure: true,
                    config: {
                        'iceServers': [
                            { urls: 'stun:stun.l.google.com:19302' },
                            { urls: 'stun:stun1.l.google.com:19302' },
                            { urls: 'stun:stun2.l.google.com:19302' }
                        ]
                    }
                });
                peer.on('open', id => {
                    myPeerId = id;
                    const status = document.getElementById('match-status');
                    if (status) status.innerText = "Searching...";
                    scanForServers(list);
                });
                peer.on('error', err => {
                    if (err.type === 'peer-unavailable') return;
                    addLog("Network Error: " + err.type);
                    list.innerHTML = "Network Error.";
                });
            } else {
                scanForServers(list);
            }
        }


function scanForServers(list) {
            if (scanTimer) { clearInterval(scanTimer); scanTimer = null; }

            list.innerHTML = "Scanning WiFi...";
            let count = 0;

            scanTimer = setInterval(() => {
                const target = LOBBY_PREFIX + count;
                if (target !== myPeerId) {
                    const conn = peer.connect(target, { reliable: false });
                    conn.on('open', () => {
                        if (!document.getElementById('item-' + target)) {
                            const item = document.createElement('div'); item.id = 'item-' + target; item.style.padding = '8px'; item.style.cursor = 'pointer'; item.style.borderBottom = '1px solid rgba(255,255,255,0.1)';
                            item.innerText = `Server ID: ${count}`;
                            item.onclick = () => {
                                isClientMode = true; hostConn = conn; setupConn(conn);
                                ballBody.resetPosition(0, -2000, 0);
                                addLog(`Connected to Server ${count}`);
                                const status = document.getElementById('match-status');
                                if (status) status.innerText = "Client (" + count + ")";
                                closeServerDialog();
                            };
                            list.appendChild(item); if (list.innerText === "Scanning WiFi...") list.innerText = "";
                        }
                    });
                }
                count++;
                if (count >= 15) {
                    clearInterval(scanTimer);
                    scanTimer = null;
                    setTimeout(() => { if (list.innerHTML === "Scanning WiFi...") list.innerHTML = "No server found."; }, 1000);
                }
            }, 150);
        }


function exitGame() {
            if (scanTimer) { clearInterval(scanTimer); scanTimer = null; }

            const myName = playerNameEl.value; addLog(`${myName} is leaving...`);
            const restBtn = document.getElementById('restart-btn'); if (restBtn) restBtn.style.display = 'block';
            activeConns.forEach(c => { if (c.open) { c.send(packData({ type: 'log', msg: `${myName} has left the game.` })); setTimeout(() => c.close(), 100); } });

            if (isClientMode) { isClientMode = false; hostConn = null; resetSelf(); }

            document.getElementById('btn-host').classList.remove('active');
            document.getElementById('btn-client').classList.remove('active');

            for (let id in remoteEntities) {
                destroyEntity(remoteEntities[id], true, id);
            }
            for (let i = aiEntities.length - 1; i >= 0; i--) {
                destroyEntity(aiEntities[i], false, null, i);
            }

            activeConns = []; updatePeerCount();

            if (peer) {
                peer.destroy();
                peer = null;
            }
            myPeerId = "offline_player";
            const status = document.getElementById('match-status');
            if (status) status.innerText = "Offline";

            addLog("Returned to Offline Solo Mode.");
        }


function handleRemoteEvent(data) {
            if (data.type === 'apply_settings') {
                isCustomMatchActive = true; 
                isSurvivalMode = data.isSurvival; isKnockbackMode = data.isKnockback; initialLives = data.lives; knockbackRate = data.kbRate || 1.0;
                knockbackExponent = data.kbExp || 2.0;

                if (isClientMode) {
                    const lVal = document.getElementById('sel-lives-val'); if (lVal) lVal.value = initialLives;
                    const kbR = document.getElementById('sel-kb-rate'); if (kbR) kbR.value = knockbackRate;
                    const survChk = document.getElementById('chk-survival'); if (survChk) survChk.checked = isSurvivalMode;
                    const kbChk = document.getElementById('chk-knockback'); if (kbChk) kbChk.checked = isKnockbackMode;
                    const escChk = document.getElementById('chk-escalation'); if (escChk) escChk.checked = data.isEscalation;
                }

                if (data.nonParticipants && data.nonParticipants.includes(myPeerId)) {
                    ballBody.lives = 0; ballBody.stress = 0; ballBody.isAlive = false;
                    ballBody.resetPosition(10000, -5000, 0); sphere.visible = false;
                    ballBody.isMatchParticipant = false;
                } else {
                    ballBody.lives = initialLives; ballBody.stress = 0; ballBody.isAlive = true; sphere.visible = true;
                    ballBody.isMatchParticipant = true;
                }

                if (isClientMode) {
                    if (data.isOriginal) {
                        isOriginalActive = true;
                        if (data.syncParams) {
                            Object.assign(params, data.syncParams);
                            Object.assign(origParams, data.syncParams);
                            if (typeof world !== 'undefined' && world.gravity) world.gravity.set(0, -params.gravity * 60, 0);

                            const oFov = elOrigCamFov; if (oFov) oFov.value = data.syncParams.camFov;
                            const oSpd = elOrigMaxSpeed; if (oSpd) oSpd.value = data.syncParams.maxSpeed;
                            const oAcc = elOrigAccel; if (oAcc) oAcc.value = data.syncParams.accel;
                            const oJrk = elOrigJerk; if (oJrk) oJrk.value = data.syncParams.jerk;
                            const oGrv = elOrigGrav; if (oGrv) oGrv.value = data.syncParams.gravity;
                            const oRad = elOrigBallSize; if (oRad) oRad.value = data.syncParams.ballRadius;
                            const oSiz = elOrigSize; if (oSiz) oSiz.value = data.syncParams.size;
                            const oSlp = document.getElementById('sel-orig-slope'); if (oSlp) oSlp.value = data.syncParams.slopeAngle || 0;
                            const oRes = elOrigRestitution; if (oRes) oRes.value = data.syncParams.restitution;
                        }
                        buildStadium(true);
                        updateCameraPos(true);
                    } else {
                        dirLight.intensity = 0.60;
                        isOriginalActive = false;
                        if (originalModeLight) { scene.remove(originalModeLight); originalModeLight = null; }
                        if (data.syncParams) {
                            Object.assign(params, data.syncParams);
                            if (typeof world !== 'undefined' && world.gravity) world.gravity.set(0, -params.gravity * 60, 0);
                        }
                        buildStadium(false);
                        updateCameraPos(true);
                    }
                    if (data.syncParams && typeof data.syncParams.ballRadius === 'number') {
                        params.ballRadius = data.syncParams.ballRadius;
                        const sizeInput = elOrigBallSize;
                        if (sizeInput) sizeInput.value = params.ballRadius.toFixed(2);
                        rebuildAllBalls();
                    }
                }

                if (data.remoteTeams && data.remoteTeams[myPeerId]) {
                    const newTeam = data.remoteTeams[myPeerId]; ballBody.team = newTeam; sphere.material.color.setHex(teamColors[newTeam]);
                    playerTeam = newTeam;
                    const playerTeamRangeElement = document.getElementById('sel-player-team-range');
                    if (playerTeamRangeElement) { playerTeamRangeElement.value = teamNames.indexOf(newTeam); updateTeamLabel(); }
                }

                playerSpriteObj.lastLives = null; playerSpriteObj.lastStress = null;
                for (let id in remoteEntities) {
                    const isP = !data.nonParticipants || !data.nonParticipants.includes(id);
                    remoteEntities[id].isMatchParticipant = isP;
                    remoteEntities[id].body.isAlive = isP;
                    remoteEntities[id].body.stress = 0;
                    remoteEntities[id].lastLives = null;
                    remoteEntities[id].lastStress = null;
                    if (!isP) {
                        remoteEntities[id].body.resetPosition(10000, -5000, 0);
                        remoteEntities[id].mesh.visible = false;
                        remoteEntities[id].body.lives = 0;
                    } else {
                        remoteEntities[id].mesh.visible = true;
                        remoteEntities[id].body.lives = initialLives;

                        if (data.remoteTeams && data.remoteTeams[id]) {
                            const team = data.remoteTeams[id];
                            remoteEntities[id].body.team = team;
                            remoteEntities[id].mesh.material.color.setHex(teamColors[team]);
                        }
                    }
                }
                aiEntities.forEach(ai => { ai.body.lives = initialLives; ai.body.stress = 0; ai.lastLives = null; ai.lastStress = null; });

                if (isClientMode) document.getElementById('main-ctrl-btns').style.display = 'none';
                if (data.isEscalation) { isEscalationMode = true; startEscalation(data.escStart, data.escMax); } else { isEscalationMode = false; stopEscalation(); }
                updateSpeedStats(); updateLeaderboard(); return;
            }
            if (data.eventType === 'param_update') {
                if (isClientMode) {
                    params.maxSpeed = data.maxSpeed; params.accel = data.accel;
                    if (!isEscalationMode) { isEscalationMode = true; document.getElementById('speed-stats').style.display = "block"; document.getElementById('zoom-toggle-btn').style.display = "block"; }
                    updateSpeedStats();
                    updateCameraPos(true);
                }
            }
            if (data.type === 'stop_custom_match') {
                isCustomMatchActive = false; 
                addLog("Custom Match Stopped by Host.");
                isSurvivalMode = false; isKnockbackMode = false; stopEscalation();

                if (isClientMode) {
                    dirLight.intensity = 0.60;
                    isOriginalActive = false;
                    if (originalModeLight) { scene.remove(originalModeLight); originalModeLight = null; }
                    if (data.syncParams) {
                        Object.assign(params, data.syncParams);
                        Object.assign(origParams, data.syncParams);
                        const oRad = elOrigBallSize; if (oRad) oRad.value = params.ballRadius;
                        const oFov = elOrigCamFov; if (oFov) oFov.value = origParams.camFov;
                    }

                    resetOrigSettings();

                    buildStadium(false);
                    rebuildAllBalls();
                    updateSpeedStats();
                }

                sphere.material.color.setHex(0xE6B422); ballBody.team = "A";
                ballBody.isMatchParticipant = true; ballBody.isAlive = true; sphere.visible = true;
                playerSpriteObj.lastLives = null; playerSpriteObj.lastStress = null;

                for (let id in remoteEntities) {
                    const re = remoteEntities[id];
                    re.isMatchParticipant = true;
                    if (re.mesh) { re.mesh.material.color.setHex(0x00F2ff); re.mesh.visible = true; }
                    if (re.body) { re.body.team = "none"; re.body.stress = 0; re.body.isAlive = true; }
                    re.lastLives = null; re.lastStress = null;
                    if (re._spriteRes) { re.lastDisplayName = ""; }
                }
                aiEntities.forEach(ai => {
                    ai.lastLives = null; ai.lastStress = null; ai.lastDisplayName = "";
                });

                if (isClientMode) {
                    document.getElementById('main-ctrl-btns').style.display = 'flex';
                    setCameraMode(cameraMode, true);
                }
                updateLeaderboard(); return;
            }
            if (data.eventType === 'name_change') {
                if (remoteEntities[data.id]) { const oldName = remoteEntities[data.id].body.name; remoteEntities[data.id].body.name = data.name; addLog(`${oldName} は名前を ${data.name} に変更した。`); if (!isClientMode) broadcastEvent({ type: 'event', eventType: 'name_change', id: data.id, name: data.name }); }
            }
            if (data.eventType === 'stat_change') {
                const newLives = (data.lives !== undefined && data.lives !== -1) ? data.lives : null;
                const newStress = (typeof data.stress === 'number') ? data.stress : null;
                const newGiven = (typeof data.given === 'number') ? data.given : null;

                if (data.id === myPeerId) {
                    if (isClientMode) {
                        if (newLives !== null) ballBody.lives = newLives;
                        if (newStress !== null) ballBody.stress = newStress;
                        if (newGiven !== null) {
                            if (!ballBody.isAlive && ballBody.lives > 0) {
                                
                            } else {
                                ballBody.totalStressGiven = newGiven;
                            }
                        }
                        playerSpriteObj.lastLives = null; playerSpriteObj.lastStress = null;
                    }
                } else {
                    let target = remoteEntities[data.id]; let isAI = false;
                    if (!target) { target = aiEntities.find(e => e.id === data.id); isAI = true; }
                    if (target && target.body) {
                        if (newLives !== null) target.body.lives = newLives;
                        if (newStress !== null) target.body.stress = newStress;
                        if (newGiven !== null) {
                            if (!target.body.isAlive && target.body.lives > 0) {  }
                            else { target.body.totalStressGiven = newGiven; }
                        }
                        target.lastLives = null; target.lastStress = null;
                    }
                }
                updateLeaderboard();
            }

            if (data.type === 'reset_event') {
                const newLives = (typeof data.lives === 'number') ? data.lives : initialLives;
                const newStress = (typeof data.stress === 'number') ? data.stress : 0;
                const newGiven = (typeof data.given === 'number') ? data.given : null;
                if (data.id === myPeerId) {
                    if (isClientMode) {
                        sphere.position.set(data.pos.x, data.pos.y, data.pos.z); ballBody.resetPosition(data.pos.x, data.pos.y, data.pos.z); ballBody.linearVelocity.set(0, 0, 0);
                        ballBody.lives = newLives; ballBody.stress = newStress; ballBody.isAlive = true; ballBody.isProcessingFall = false; sphere.visible = true; selfSync.ts = 0;
                        if (newGiven !== null) {
                            ballBody.totalStressGiven = newGiven;
                        }
                        playerSpriteObj.lastLives = null; playerSpriteObj.lastStress = null;
                    }
                } else {
                    let target = remoteEntities[data.id]; let isAI = false;
                    if (!target) { target = aiEntities.find(e => e.id === data.id); isAI = true; }
                    if (target) {
                        if (!isClientMode && target.body) { target.body.resetPosition(data.pos.x, data.pos.y, data.pos.z); target.body.linearVelocity.set(0, 0, 0); }
                        if (target.body) {
                            target.body.lives = newLives; target.body.stress = newStress; target.body.isAlive = true;
                            if (newGiven !== null) {
                                target.body.totalStressGiven = newGiven;
                            }
                        }
                        if (!isAI) { target.pos.set(data.pos.x, data.pos.y, data.pos.z); target.velocity.set(0, 0, 0); target.mesh.visible = true; } else { target.mesh.visible = true; }
                        target.lastDisplayName = ""; target.lastLives = null; target.lastStress = null;
                    }
                }
                updateLeaderboard();
            }
            if (data.type === 'player_eliminated') {
                if (data.id === myPeerId) {
                    ballBody.isAlive = false; ballBody.lives = 0; sphere.visible = false;
                    if (isClientMode) { selfSync.ts = 0; ballBody.resetPosition(10000, -5000, 0); sphere.position.set(10000, -5000, 0); ballBody.linearVelocity.set(0, 0, 0); ballBody.angularVelocity.set(0, 0, 0); }
                } else {
                    if (remoteEntities[data.id]) { const re = remoteEntities[data.id]; re.body.isAlive = false; re.body.lives = 0; re.mesh.visible = false; if (isClientMode) { re.body.resetPosition(10000, -5000, 0); re.mesh.position.set(10000, -5000, 0); } }
                    else { const ai = aiEntities.find(e => e.id === data.id); if (ai) { ai.body.isAlive = false; ai.body.lives = 0; ai.mesh.visible = false; } }
                }
                updateLeaderboard();
            }
            if (data.type === 'ai_added') { updateRemoteEntity(data.id, data.pos, { x: 0, y: 0, z: 0 }, data.color, data.name, 0, data.team, true); }
            if (data.type === 'ai_removed') {
                if (remoteEntities[data.id]) {
                    destroyEntity(remoteEntities[data.id], true, data.id);
                }
                const aiIndex = aiEntities.findIndex(e => e.id === data.id);
                if (aiIndex !== -1) {
                    destroyEntity(aiEntities[aiIndex], false, null, aiIndex);
                }
            }
        }


function updateTeamLabel() {
            const val = parseInt(document.getElementById('sel-player-team-range').value);
            const team = teamNames[val];
            const label = document.getElementById('player-team-label');
            if (label) {
                label.innerText = "Team " + team;
                label.style.color = teamColors[team] || 'white';
            }
            renderSpawnList();
            if (typeof saveTeams === "function") saveTeams();
        }


function updateAiTeamLabel() {
            const val = parseInt(document.getElementById('sel-ai-team-range').value);
            const team = teamNames[val];
            const label = document.getElementById('ai-team-label');
            label.innerText = "Team " + team;
            label.style.color = teamColors[team] || 'white';
            const slider = document.getElementById('sel-ai-team-range');
            const sliderWidth = slider.offsetWidth;
            const thumbWidth = 16;
            const trackWidth = sliderWidth - thumbWidth;
            const ratio = (slider.value - slider.min) / (slider.max - slider.min);
            const left = (thumbWidth / 2) + (ratio * trackWidth);
            label.style.left = left + "px";
        }
