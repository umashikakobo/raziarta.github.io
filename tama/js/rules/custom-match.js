// カスタムマッチ設定・管理

function openCustomDialog() {
            if (isCustomMatchActive) return;
            document.getElementById('custom-dialog').style.display = 'flex';
            if (!isClientMode) {
                for (let id in remoteEntities) { if (!remotePlayerTeams[id]) remotePlayerTeams[id] = remoteEntities[id].body.team !== "none" ? remoteEntities[id].body.team : "B"; }
            }
            loadTeams();
            renderSpawnList(); updateRuleUI();
        }


function closeCustomDialog() { saveTeams(); document.getElementById('custom-dialog').style.display = 'none'; }


function saveTeams() {
            const aiData = pendingSpawnList.map(ai => ({ team: ai.team }));
            const remoteData = [];
            for (let id in remoteEntities) {
                if (remoteEntities[id].body && remoteEntities[id].body.name) {
                    remoteData.push({ peerId: id, name: remoteEntities[id].body.name, team: remotePlayerTeams[id] || remoteEntities[id].body.team || "B", participation: remotePlayerParticipation[id] });
                }
            }
            localStorage.setItem("rigidBallTeams", JSON.stringify({ playerTeam, localParticipation: localPlayerParticipation, aiList: aiData, remotePlayers: remoteData }));
        }


function loadTeams() {
            const dataStr = localStorage.getItem("rigidBallTeams");
            if (!dataStr) return;
            try {
                const teamConfig = JSON.parse(dataStr);
                if (teamConfig.playerTeam) playerTeam = teamConfig.playerTeam;
                if (typeof teamConfig.localParticipation !== "undefined") localPlayerParticipation = teamConfig.localParticipation;
                if (teamConfig.aiList && Array.isArray(teamConfig.aiList)) {
                    pendingSpawnList = [];
                    teamConfig.aiList.forEach(ai => {
                        pendingSpawnList.push({ team: ai.team, id: Date.now() + Math.random() });
                    });
                }
                if (teamConfig.remotePlayers && Array.isArray(teamConfig.remotePlayers)) {
                    teamConfig.remotePlayers.forEach(rp => {
                        let foundId = null;
                        for (let curId in remoteEntities) {
                            if (remoteEntities[curId].body && remoteEntities[curId].body.name === rp.name) { foundId = curId; break; }
                        }
                        if (foundId) {
                            remotePlayerTeams[foundId] = rp.team;
                            if (typeof rp.participation !== "undefined") remotePlayerParticipation[foundId] = rp.participation;
                        }
                    });
                }
            } catch (e) { console.error("Failed to load teams", e); }
        }


function addToList() {
            const tVal = parseInt(document.getElementById('sel-ai-team-range').value); const team = teamNames[tVal];
            pendingSpawnList.push({ team, id: Date.now() + Math.random() }); renderSpawnList(); saveTeams();
        }


function removeFromList(id) { pendingSpawnList = pendingSpawnList.filter(item => item.id !== id); renderSpawnList(); saveTeams(); }


function updateAiTeam(id, team) {
            const ai = pendingSpawnList.find(i => i.id === id);
            if (ai) ai.team = team;
            renderSpawnList(); saveTeams();
        }


function updateSpecificTeam(id, newTeam, isSelf) {
            if (isSelf) {
                playerTeam = newTeam;
                const label = document.getElementById('player-team-label');
                if (label) { label.innerText = "Team " + newTeam; label.style.color = teamColorMap[newTeam] || 'white'; }
            } else { remotePlayerTeams[id] = newTeam; }
            renderSpawnList(); updateLeaderboard();
        }


function toggleParticipation(id) {
            remotePlayerParticipation[id] = (remotePlayerParticipation[id] !== false) ? false : true;
            renderSpawnList(); saveTeams(); updateLeaderboard();
        }


function toggleLocalParticipation() {
            localPlayerParticipation = (localPlayerParticipation !== false) ? false : true;
            renderSpawnList(); saveTeams(); updateLeaderboard();
        }


function renderSpawnList() {
            const listDiv = document.getElementById('spawn-list');
            if (!listDiv) return;
            listDiv.innerHTML = '';
            const teams = ['A', 'B', 'C', 'D', 'E', 'F'];
            teams.forEach(t => {
                const group = document.createElement('div'); group.className = 'team-group';
                group.ondragover = function (e) { e.preventDefault(); group.style.border = "1px dashed #fff"; };
                group.ondragleave = function (e) { group.style.border = "none"; };
                group.ondrop = function (e) {
                    e.preventDefault(); group.style.border = "none";
                    const dropData = e.dataTransfer.getData("text/plain");
                    if (!dropData) return;
                    try {
                        const parsed = JSON.parse(dropData);
                        if (parsed.type === 'player') updateSpecificTeam(myPeerId, t, true);
                        else if (parsed.type === 'remote') updateSpecificTeam(parsed.id, t, false);
                        else if (parsed.type === 'ai') updateAiTeam(parsed.id, t);
                    } catch (err) { }
                };
                const tHeader = document.createElement('div'); tHeader.className = 'team-title'; tHeader.style.borderLeftColor = '#' + teamColors[t].toString(16).padStart(6, '0'); tHeader.innerText = `TEAM ${t}`; group.appendChild(tHeader);
                if (playerTeam === t) {
                    const pItem = document.createElement('div'); pItem.className = 'spawn-item player-item';
                    pItem.draggable = true;
                    pItem.ondragstart = function (e) { e.dataTransfer.setData("text/plain", JSON.stringify({ type: 'player' })); };
                    let selHtml = `<select onchange="updateSpecificTeam('${myPeerId}', this.value, true)" class="team-select">`;
                    teams.forEach(optT => { selHtml += `<option value="${optT}" ${optT === t ? 'selected' : ''}>${optT}</option>`; });
                    selHtml += `</select>`;
                    const isP = (localPlayerParticipation !== false);
                    pItem.innerHTML = `<span>[PLAYER] ${playerNameEl.value}</span><div class="spawn-control-row">${selHtml}  <button onclick="toggleLocalParticipation()" class="participation-toggle-btn" style="background:${isP ? 'rgba(0,0,0,0.8)' : '#fff'}; color:${isP ? '#fff' : '#000'};">${isP ? '✕' : '〇'}</button></div>`;
                    if (!isP) pItem.style.opacity = '0.5';
                    group.appendChild(pItem);
                }
                if (!isClientMode) {
                    for (let id in remoteEntities) {
                        const assigned = remotePlayerTeams[id] || remoteEntities[id].body.team || "B";
                        if (assigned === t) {
                            const rItem = document.createElement('div'); rItem.className = 'spawn-item remote-item';
                            rItem.draggable = true;
                            rItem.ondragstart = function (e) { e.dataTransfer.setData("text/plain", JSON.stringify({ type: 'remote', id: id })); };
                            if (remotePlayerParticipation[id] === false) rItem.style.opacity = '0.5';
                            let selHtml = `<select onchange="updateSpecificTeam('${id}', this.value, false)" class="team-select">`;
                            teams.forEach(optT => { selHtml += `<option value="${optT}" ${optT === t ? 'selected' : ''}>${optT}</option>`; });
                            selHtml += `</select>`;
                            const isP = (remotePlayerParticipation[id] !== false);
                            rItem.innerHTML = `<span>[NET] ${remoteEntities[id].body.name}</span> <div class="spawn-control-row">${selHtml} <button onclick="toggleParticipation('${id}')" class="participation-toggle-btn" style="background:${isP ? 'rgba(0,0,0,0.8)' : '#fff'}; color:${isP ? '#fff' : '#000'};">${isP ? '✕' : '〇'}</button></div>`;
                            group.appendChild(rItem);
                        }
                    }
                }
                pendingSpawnList.filter(item => item.team === t).forEach(item => {
                    const div = document.createElement('div'); div.className = 'spawn-item';
                    div.draggable = true;
                    div.ondragstart = function (e) { e.dataTransfer.setData("text/plain", JSON.stringify({ type: 'ai', id: item.id })); };
                    let selHtml = `<select onchange="updateAiTeam(${item.id}, this.value)" class="team-select">`;
                    teams.forEach(optT => { selHtml += `<option value="${optT}" ${optT === t ? 'selected' : ''}>${optT}</option>`; });
                    selHtml += `</select>`;
                    div.innerHTML = `<span>AI</span><div class="spawn-control-row">${selHtml}<button onclick="removeFromList(${item.id})">✕</button></div>`; group.appendChild(div);
                });
                listDiv.appendChild(group);
            });
        }


function startCustomMatch() {
            if (isClientMode) { alert("Only Host can change custom settings."); return; }
            isSurvivalMode = document.getElementById('chk-survival').checked;
            isKnockbackMode = document.getElementById('chk-knockback').checked;
            const isEscalation = document.getElementById('chk-escalation').checked;
            const isOriginal = document.getElementById('chk-original').checked;

            if (isOriginal) {
                if (!defaultParamsBackup) {
                    defaultParamsBackup = {
                        maxSpeed: params.maxSpeed,
                        accel: params.accel,
                        jerk: params.jerk,
                        gravity: params.gravity,
                        size: params.size,
                        wallH: params.wallH,
                        wallT: params.wallT,
                        ballRadius: params.ballRadius
                    };
                }

                origParams.camFov = parseFloat(document.getElementById('sel-orig-cam-fov')?.value) || 50;
                origParams.maxSpeed = parseFloat(document.getElementById('sel-orig-max-speed')?.value) || 200;
                origParams.accel = parseFloat(document.getElementById('sel-orig-accel')?.value) || 2.25;
                origParams.jerk = parseFloat(document.getElementById('sel-orig-jerk')?.value) || 0.35;
                origParams.gravity = parseFloat(document.getElementById('sel-orig-grav')?.value) || 3.3;
                origParams.size = parseFloat(document.getElementById('sel-orig-size')?.value) || 298.25;
                origParams.wallH = parseFloat(document.getElementById('sel-orig-wall-h').value) || 4.2;
                origParams.wallT = parseFloat(document.getElementById('sel-orig-wall-t')?.value) || 31;
                origParams.slopeAngle = parseFloat(document.getElementById('sel-orig-slope').value) || 0;
                origParams.ballRadius = parseFloat(document.getElementById('sel-orig-ball-size')?.value) || 14.50;
                const re = parseFloat(document.getElementById('sel-orig-restitution')?.value); origParams.restitution = isNaN(re) ? 0.4875 : re;
                params.restitution = origParams.restitution;

                params.maxSpeed = origParams.maxSpeed;
                params.accel = origParams.accel;
                params.jerk = origParams.jerk;
                params.gravity = origParams.gravity;
                if (typeof world !== 'undefined' && world.gravity) {
                    world.gravity.set(0, -params.gravity * 60, 0); 
                }
                params.size = origParams.size;
                params.wallH = origParams.wallH;
                params.wallT = origParams.wallT;
                params.ballRadius = origParams.ballRadius;
                params.restitution = origParams.restitution;

                isOriginalActive = true;
                spectatorTargetId = null;

                buildStadium(true);
                rebuildAllBalls();
                updateCameraPos();
            } else {
                restoreDefaultStage({ resetGravity: true, updateCamera: true });
            }

            let sSpd = parseFloat(document.getElementById('sel-esc-start-speed')?.value);
            let mSpd = parseFloat(document.getElementById('sel-esc-max-speed')?.value);
            const elEscMax = document.getElementById('sel-esc-max-speed');
            if (mSpd < sSpd) { mSpd = sSpd; elEscMax.value = mSpd; }

            if (isEscalation) startEscalation(sSpd, mSpd); else stopEscalation();

            initialLives = isSurvivalMode ? (parseInt(document.getElementById('sel-lives-val').value) || 3) : 999;
            knockbackRate = isKnockbackMode ? (parseFloat(document.getElementById('sel-kb-rate').value) || 1.0) : 1.0;
            knockbackExponent = 2.0;
            const expRadios = document.getElementsByName('kb-exp');
            for (let i = 0; i < expRadios.length; i++) { if (expRadios[i].checked) { knockbackExponent = parseFloat(expRadios[i].value); break; } }

            sphere.material.color.setHex(teamColors[playerTeam]); ballBody.team = playerTeam; ballBody.stress = 0; ballBody.totalStressGiven = 0; ballBody.lastTouchedBy = null; ballBody.kills = 0;
            ballBody.isMatchParticipant = (localPlayerParticipation !== false);
            if (!ballBody.isMatchParticipant) {
                ballBody.isAlive = false; sphere.visible = false;
                if (playerSpriteObj._spriteRes) playerSpriteObj._spriteRes.sprite.visible = false;
                ballBody.resetPosition(10000, -5000, 0);
            }

            while (aiEntities.length > 0) removeAI();
            pendingSpawnList.forEach(item => { addAI(teamColors[item.team], item.team); });
            aiEntities.forEach(ai => { ai.body.stress = 0; ai.body.totalStressGiven = 0; ai.body.lastTouchedBy = null; ai.body.kills = 0; });
            for (let id in remoteEntities) {
                const isP = (remotePlayerParticipation[id] !== false);
                remoteEntities[id].isMatchParticipant = isP;
                remoteEntities[id].body.isAlive = isP;
                if (!isP) {
                    remoteEntities[id].body.resetPosition(10000, -5000, 0);
                    remoteEntities[id].mesh.visible = false;
                    remoteEntities[id].body.lives = 0;
                } else {
                    remoteEntities[id].mesh.visible = true;
                    if (remotePlayerTeams[id]) {
                        remoteEntities[id].body.team = remotePlayerTeams[id];
                        remoteEntities[id].mesh.material.color.setHex(teamColors[remotePlayerTeams[id]]);
                    }
                    remoteEntities[id].body.stress = 0;
                    remoteEntities[id].body.totalStressGiven = 0;
                    remoteEntities[id].body.lives = initialLives;
                    remoteEntities[id].body.lastTouchedBy = null;
                    remoteEntities[id].body.kills = 0;
                }
            }

            broadcastEvent({
                type: 'apply_settings',
                isSurvival: isSurvivalMode,
                isKnockback: isKnockbackMode,
                isEscalation: isEscalation,
                escStart: sSpd,
                escMax: mSpd,
                isOriginal: isOriginalActive,
                lives: initialLives,
                kbRate: knockbackRate,
                remoteTeams: remotePlayerTeams,
                nonParticipants: Object.keys(remotePlayerParticipation).filter(id => remotePlayerParticipation[id] === false),
                kbExp: knockbackExponent,
                syncParams: {
                    maxSpeed: params.maxSpeed,
                    accel: params.accel,
                    jerk: params.jerk,
                    gravity: params.gravity,
                    size: params.size,
                    wallH: params.wallH,
                    wallT: params.wallT,
                    ballRadius: params.ballRadius,
                    camFov: origParams.camFov,
                    slopeAngle: origParams.slopeAngle,
                    restitution: params.restitution
                }
            });
            isCustomMatchActive = true; document.getElementById('main-ctrl-btns').style.display = 'none'; document.getElementById('stop-ctrl-btns').style.display = 'flex';
            resetAll(); closeCustomDialog();

            let logMsg = `Match Started! Surv:${isSurvivalMode} KB:${isKnockbackMode ? `(x${knockbackRate.toFixed(2)})` : false} Orig:${isOriginalActive}`;
            if (isEscalation) logMsg += ` Esc:(Spd ${sSpd}-${mSpd})`;
            addLog(logMsg);
            broadcastEvent({ type: 'event', eventType: 'log', msg: logMsg });
            pendingSpawnList = [];
        }


function stopCustomMatch() {
            if (isClientMode) return;
            isCustomMatchActive = false; isSurvivalMode = false; isKnockbackMode = false; stopEscalation();
            document.getElementById('main-ctrl-btns').style.display = 'flex'; document.getElementById('stop-ctrl-btns').style.display = 'none';

            ballBody.isMatchParticipant = true;
            ballBody.isAlive = true;
            sphere.visible = true;
            for (let id in remoteEntities) {
                const re = remoteEntities[id];
                re.isMatchParticipant = true;
                if (re.body) re.body.isAlive = true;
                if (re.mesh) re.mesh.visible = true;
                if (re.body && re.body.getPosition().y < -100) {
                    const rp = getRandomPos();
                    re.body.resetPosition(rp.x, 50, rp.z);
                }
            }
            updateLeaderboard();

            restoreDefaultStage({ resetRestitution: true });

            for (let i = aiEntities.length - 1; i >= 0; i--) {
                destroyEntity(aiEntities[i], false, null, i);
            }

            sphere.material.color.setHex(0xE6B422); ballBody.team = "A";

            for (let id in remoteEntities) {
                if (remoteEntities[id].mesh) { remoteEntities[id].mesh.material.color.setHex(0x00F2FF); }
                if (remoteEntities[id].body) { remoteEntities[id].body.team = "none"; remoteEntities[id].body.stress = 0; }
            }

            broadcastEvent({
                type: 'stop_custom_match',
                syncParams: {
                    maxSpeed: params.maxSpeed,
                    accel: params.accel,
                    jerk: params.jerk,
                    gravity: params.gravity,
                    size: params.size,
                    wallH: params.wallH,
                    wallT: params.wallT,
                    ballRadius: params.ballRadius,
                    camFov: origParams.camFov,
                    restitution: params.restitution
                }
            });
            resetAll();
            setCameraMode(cameraMode, true);
            addLog("Match Stopped. Returned to Standard.");
        }
