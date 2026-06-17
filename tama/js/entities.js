// エンティティ管理（AI・リモートプレイヤー）

function addAI(color, team) {
            if (isClientMode && hostConn) { hostConn.send(packData({ type: 'request_add_ai' })); return; }
            if (isCustomMatchActive) return;
            aiCounter++; const pos = getRandomPos(); const body = world.add({ type: 'sphere', size: [params.ballRadius], pos: [pos.x, 50, pos.z], move: true, density: 1, friction: params.friction, restitution: params.restitution });
            const finalColor = (color !== undefined) ? color : 0x7CEE00; const finalTeam = team || "none";
            body.name = `AI ${aiCounter}`; body.kills = 0; body.lastTouchedBy = null; body.team = finalTeam; body.lives = initialLives; body.isAlive = true; body.stress = 0;
            const mesh = new THREE.Mesh(sharedSphereGeom, createSphereMaterial(finalColor));
            mesh.castShadow = true;
            const shadow = createShadow(); scene.add(mesh); scene.add(shadow);
            const newAI = { body, mesh, shadow, _spriteRes: null, accel: new THREE.Vector3(0, 0, 0), id: 'ai_' + Math.random().toString(36).substr(2, 9), frameCount: Math.floor(Math.random() * 10), lastTX: 0, lastTZ: 0, stress: 0, aiNum: aiCounter, aiLv: 10, updateInterval: 0, lastDisplayName: "", lastKills: -1, lastLives: -1, lastStress: -1, lastModeKey: "", color: finalColor };
            aiEntities.push(newAI);
            if (!isClientMode) broadcastEvent({ type: 'ai_added', id: newAI.id, pos: pos, name: body.name, color: finalColor, team: finalTeam });
            updateLeaderboard();
        }


function removeAI(id) {
            if (isClientMode && hostConn) { hostConn.send(packData({ type: 'request_remove_ai' })); return; }
            if (isCustomMatchActive) return; if (aiEntities.length === 0) return;
            const idx = (id === undefined) ? Math.floor(Math.random() * aiEntities.length) : aiEntities.findIndex(e => e.id === id);
            if (idx === -1) return;

            const removedId = aiEntities[idx].id;

            destroyEntity(aiEntities[idx], false, null, idx);

            if (!isClientMode) broadcastEvent({ type: 'ai_removed', id: removedId });
            updateLeaderboard();
        }


function destroyEntity(entity, isRemoteDict, id, aiIndex) {
            if (!entity) return;

            if (entity.body) {
                world.removeRigidBody(entity.body);
                entity.body = null;
            }

            if (entity.mesh) {
                scene.remove(entity.mesh);
                if (entity.mesh.geometry) entity.mesh.geometry.dispose();
                if (entity.mesh.material) {
                    if (Array.isArray(entity.mesh.material)) entity.mesh.material.forEach(m => m.dispose());
                    else entity.mesh.material.dispose();
                }
            }
            if (entity.shadow) {
                scene.remove(entity.shadow);
                if (entity.shadow.material) entity.shadow.material.dispose();
            }
            const res = entity._spriteRes;
            if (res) { scene.remove(res.sprite); res.tex.dispose(); res.sprite.material.dispose(); entity._spriteRes = null; }

            if (isRemoteDict && id) {
                delete remoteEntities[id];
            }
            if (aiIndex !== undefined && aiIndex !== -1) {
                aiEntities.splice(aiIndex, 1);
            }
            updateLeaderboard();
        }


function updateRemoteEntity(id, pos, vel, color, name, kills, team, isAlive) {
            if (id === myPeerId) {
                if (isClientMode) {
                    // 自機の生存状態の同期
                    if (isAlive !== undefined) {
                        // 高頻度のsyncパケットによる「非表示」への勝手な上書きを防ぐ。
                        // 生存（true）への復帰は受け入れるが、非表示化はエリミネーション等の確定イベントに任せる。
                        if (isAlive === true) {
                            ballBody.isAlive = true;
                            sphere.visible = true;
                        }
                    }
                    // 自機の同期情報をデバッグ出力（座標が届いているか確認）
                    if (Math.random() < 0.05) console.debug(`[Sync-Self] ServerPos: ${Math.round(pos.x)}, ${Math.round(pos.z)}`);
                    selfSync.pos.set(pos.x, pos.y, pos.z); selfSync.vel.set(vel.x, vel.y, vel.z); selfSync.ts = Date.now();
                    if (kills !== undefined) {
                        if (ballBody.kills !== kills) console.debug(`[Sync-Self] Kills updated from ${ballBody.kills} to ${kills}`);
                        ballBody.kills = kills;
                    }
                }
                return;
            }

            let meshColor = color;
            if (!isCustomMatchActive && isClientMode && (color === 0xE6B422 || color === 0xffd700)) {
                meshColor = 0x00F2FF;
            }

            if (!remoteEntities[id]) {
                // SYNCパケット（nameがundefined）から新規作成されるのを防ぐ
                if (name === undefined || name === null) return;

                const isPart = !isCustomMatchActive; 
                const body = world.add({ type: 'sphere', size: [params.ballRadius], pos: [pos.x, pos.y, pos.z], move: true, isKinematic: isClientMode });
                body.name = (name !== undefined && name !== null) ? name : "Guest"; 
                body.kills = (kills !== undefined && kills !== null) ? kills : 0; 
                body.team = team || "none"; 
                body.isAlive = (isAlive !== undefined) ? isAlive : isPart;
                body.stress = 0;
                body.totalStressGiven = 0;

                const mesh = new THREE.Mesh(sharedSphereGeom, createSphereMaterial(meshColor || 0x00F2FF));
                mesh.castShadow = true;
                const shadow = createShadow(); scene.add(mesh); scene.add(shadow);
                remoteEntities[id] = { body, mesh, shadow, _spriteRes: null, lastUpdate: Date.now(), pos: new THREE.Vector3(pos.x, pos.y, pos.z), velocity: new THREE.Vector3(vel.x, vel.y, vel.z), isInputDriven: true, input: { x: 0, z: 0, jump: false }, accel: new THREE.Vector3(0, 0, 0), lastDisplayName: "", lastKills: -1, lastLives: -1, lastStress: -1, lastModeKey: "", isMatchParticipant: isPart };
            }
            const re = remoteEntities[id];
            re.pos.set(pos.x, pos.y, pos.z); 
            re.velocity.set(vel.x, vel.y, vel.z); 
            // 受信データがある場合のみ上書きし、undefinedによる初期化を防ぐ
            if (name !== undefined && name !== null) {
                re.body.name = name;
            } else if (!re.body.name) {
                re.body.name = "Guest";
            }
            if (kills !== undefined && kills !== null) re.body.kills = kills;
            if (team !== undefined && team !== null) re.body.team = team;
            if (isAlive !== undefined) re.body.isAlive = isAlive;

            if (meshColor !== undefined && meshColor !== null && re.mesh.material.color.getHex() !== meshColor) {
                re.mesh.material.color.setHex(meshColor);
            }

            re.lastUpdate = Date.now();
            re.lastSyncTs = Date.now(); // 補完計算のためにタイムスタンプを更新
            updateLeaderboard();
        }


function broadcastEvent(eventData) { if (activeConns.length > 0) { const payload = { type: 'event', ...eventData }; activeConns.forEach(c => { if (c.open) c.send(packData(payload)); }); } }


function broadcastSettings() {
            if (isClientMode) return;
            const chkE = document.getElementById('chk-escalation');
            const chkO = document.getElementById('chk-original');
            const isEscalation = chkE ? chkE.checked : false;
            const isOriginal = chkO ? chkO.checked : false;
            const sSpd = parseFloat(elEscStart.value) || ESC_DEFAULT_START_SPEED;
            const mSpd = parseFloat(elEscMax.value) || ESC_DEFAULT_MAX_SPEED;

            broadcastEvent({
                type: 'apply_settings',
                isSync: true, // 同期目的であることを明示
                isSurvival: isSurvivalMode, isKnockback: isKnockbackMode, isEscalation: isEscalation,
                escStart: sSpd, escMax: mSpd, isOriginal: isOriginal, lives: initialLives,
                kbRate: knockbackRate, remoteTeams: remotePlayerTeams,
                nonParticipants: Object.keys(remotePlayerParticipation).filter(id => remotePlayerParticipation[id] === false),
                kbExp: knockbackExponent,
                syncParams: {
                    maxSpeed: params.maxSpeed, accel: params.accel, jerk: params.jerk, gravity: params.gravity,
                    size: params.size, wallH: params.wallH, wallT: params.wallT, ballRadius: params.ballRadius,
                    camFov: origParams.camFov, slopeAngle: origParams.slopeAngle,
                    restitution: params.restitution
                }
            });
        }


function handleFall(body) {
            if (body.isProcessingFall || !body.isAlive) return;
            body.isProcessingFall = true;

            const victimName = body.name || "Unknown";
            if (body.lastTouchedBy && body.lastTouchedBy.team !== body.team) {
                body.lastTouchedBy.kills = (body.lastTouchedBy.kills || 0) + 1;
                addLog(`${body.lastTouchedBy.name} が ${victimName} を倒した。`);
                
                // 加害者の統計を即座にブロードキャスト
                let killerBody = body.lastTouchedBy;
                let killerId = (killerBody === ballBody) ? myPeerId : null;
                if (!killerId) {
                    let ai = aiEntities.find(e => e.body === killerBody);
                    if (ai) killerId = ai.id;
                    else {
                        for (let rid in remoteEntities) {
                            if (remoteEntities[rid].body === killerBody) { killerId = rid; break; }
                        }
                    }
                }
                if (killerId) {
                    broadcastEvent({ eventType: 'stat_change', id: killerId, stress: killerBody.stress || 0, lives: killerBody.lives || 0, given: killerBody.totalStressGiven || 0, kills: killerBody.kills || 0 });
                }
            }
            else { addLog(`${victimName} が自滅した。`); }

            let eliminated = false;
            if (!isSurvivalMode) { eliminated = true; }
            else { if (body.lives > 0) { body.lives--; if (body.lives === 0) eliminated = true; } else { eliminated = true; } }

            body.stress = 0;
            updateLeaderboard();

            let fallId = (body === ballBody) ? myPeerId : aiEntities.find(e => e.body === body)?.id;
            if (!fallId) { for (let id in remoteEntities) { if (remoteEntities[id].body === body) fallId = id; } }

            if (fallId && !isClientMode) {
                broadcastEvent({ eventType: 'stat_change', id: fallId, lives: body.lives, stress: body.stress, given: body.totalStressGiven || 0, kills: body.kills || 0 });
                if (body === ballBody) { playerSpriteObj.lastLives = null; playerSpriteObj.lastStress = null; }
                else {
                    const ai = aiEntities.find(e => e.id === fallId); if (ai) { ai.lastLives = null; ai.lastStress = null; }
                    const re = remoteEntities[fallId]; if (re) { re.lastLives = null; re.lastStress = null; }
                }
            }

            if (eliminated) {
                body.isAlive = false; body.resetPosition(10000, -5000, 0); body.linearVelocity.set(0, 0, 0); body.angularVelocity.set(0, 0, 0);
                if (body === ballBody) sphere.visible = false;
                else { const ai = aiEntities.find(e => e.body === body); if (ai) ai.mesh.visible = false; else { const rem = Object.values(remoteEntities).find(r => r.body === body); if (rem) rem.mesh.visible = false; } }
                if (!isClientMode && fallId) broadcastEvent({ type: 'player_eliminated', id: fallId });
                body.isProcessingFall = false; return;
            } else {
                body.resetPosition(0, -5000, 0);
                setTimeout(() => {
                    if (!isSurvivalMode) { body.resetPosition(10000, -5000, 0); body.linearVelocity.set(0, 0, 0); if (!isClientMode && fallId) broadcastEvent({ type: 'player_eliminated', id: fallId }); body.isProcessingFall = false; return; }
                    if (body.lives <= 0) return;
                    const respawnP = getRandomPos(); body.resetPosition(respawnP.x, 50, respawnP.z); body.linearVelocity.set(0, 0, 0); body.lastTouchedBy = null; body.isProcessingFall = false;
                    body.stress = 0;
                    if (body === ballBody) { playerSpriteObj.lastLives = null; playerSpriteObj.lastStress = null; }
                    if (!isClientMode && fallId) broadcastEvent({ type: 'reset_event', id: fallId, pos: respawnP, lives: body.lives, stress: body.stress, given: body.totalStressGiven, kills: body.kills || 0 });
                }, 3000);
            }
            updateLeaderboard();
        }


function startCountdown(type) {
            let count = 3.0; const btn = type === 'restart' ? document.getElementById('restart-btn') : document.getElementById('self-reset-btn');
            const originalText = type === 'restart' ? 'Restart' : 'Self Reset (R)';
            if (type === 'restart' && restartTimer) return; if (type === 'reset' && resetTimer) return;
            const updateBtn = () => {
                btn.innerText = count.toFixed(1);
                if (count <= 0) { btn.innerText = originalText; if (type === 'restart') { restartTimer = null; resetAll(); } else { resetTimer = null; resetSelf(); } }
                else { count = Math.max(0, count - 0.1); if (type === 'restart') restartTimer = setTimeout(updateBtn, 100); else resetTimer = setTimeout(updateBtn, 100); }
            };
            updateBtn();
        }


function resetAll() {
            if (isClientMode && hostConn) { hostConn.send(packData({ type: 'request_all_restart' })); return; }
            resetSelf();
            aiEntities.forEach(e => {
                const ep = getRandomPos(); e.body.resetPosition(ep.x, 50, ep.z); e.body.linearVelocity.set(0, 0, 0); e.accel.set(0, 0, 0);
                e.frameCount = Math.floor(Math.random() * 10); e.body.kills = 0; e.body.lastTouchedBy = null;
                e.body.lives = initialLives; e.body.isAlive = true; e.body.stress = 0; e.body.totalStressGiven = 0; e.body.isProcessingFall = false; e.mesh.visible = true;
                e.lastLives = null; e.lastStress = null;
                broadcastEvent({ type: 'reset_event', id: e.id, pos: ep, lives: e.body.lives, stress: e.body.stress, given: e.body.totalStressGiven });
            });
            for (let id in remoteEntities) {
                const re = remoteEntities[id];
                if (re.isInputDriven && re.body) {
                    if (isCustomMatchActive && re.isMatchParticipant === false) {
                        re.body.isAlive = false; re.mesh.visible = false;
                        re.body.resetPosition(10000, -5000, 0);
                        continue;
                    }
                    const rp = getRandomPos(); re.body.resetPosition(rp.x, 50, rp.z); re.body.linearVelocity.set(0, 0, 0); re.accel.set(0, 0, 0);
                    re.body.kills = 0; re.body.lives = initialLives; re.body.isAlive = true; re.body.stress = 0; re.body.totalStressGiven = 0; re.mesh.visible = true;
                    re.lastLives = null; re.lastStress = null;
                    broadcastEvent({ type: 'reset_event', id: id, pos: rp, lives: re.body.lives, stress: re.body.stress, given: re.body.totalStressGiven });
                }
            }
            addLog("----All Restart-------"); updateLeaderboard();
        }


function resetSelf() {
            if (isClientMode && hostConn) { hostConn.send(packData({ type: 'request_self_reset' })); return; }
            if (isCustomMatchActive && ballBody.isMatchParticipant === false) return;

            ballBody.isAlive = true;
            sphere.visible = true;
            const p = getRandomPos(); ballBody.resetPosition(p.x, 50, p.z); ballBody.linearVelocity.set(0, 0, 0); currentAccel.set(0, 0, 0);
            ballBody.kills = 0; ballBody.lastTouchedBy = null; ballBody.lives = initialLives; ballBody.stress = 0; ballBody.totalStressGiven = 0; ballBody.isProcessingFall = false;
            playerSpriteObj.lastLives = null; playerSpriteObj.lastStress = null;
            addLog(`Reset: ${ballBody.name}`);
            if (!isClientMode) broadcastEvent({ type: 'reset_event', id: myPeerId, pos: p, lives: ballBody.lives, stress: ballBody.stress, given: ballBody.totalStressGiven });
            updateLeaderboard();
        }




function initSharedGeometry() {
    if (sharedSphereGeom) sharedSphereGeom.dispose();
    if (sharedShadowGeom) sharedShadowGeom.dispose();
    sharedSphereGeom = new THREE.SphereGeometry(params.ballRadius, 32, 32);
    sharedShadowGeom = new THREE.CircleGeometry(params.ballRadius, 32);
}

function rebuildAllBalls() {
    initSharedGeometry();

    const updateBody = (oldBody, isKinematic = false) => {
        if (!oldBody) return null;
        const p = oldBody.getPosition();
        const v = oldBody.linearVelocity;
        const props = {
            name: oldBody.name,
            kills: oldBody.kills,
            team: oldBody.team,
            lives: oldBody.lives,
            stress: oldBody.stress,
            isAlive: oldBody.isAlive,
            lastTouchedBy: oldBody.lastTouchedBy,
            totalStressGiven: oldBody.totalStressGiven,
            isMatchParticipant: oldBody.isMatchParticipant
        };
        world.removeRigidBody(oldBody);
        const newBody = world.add({
            type: 'sphere', size: [params.ballRadius], pos: [p.x, p.y, p.z],
            move: !isKinematic, isKinematic: isKinematic,
            density: 1, friction: params.friction, restitution: params.restitution
        });
        Object.assign(newBody, props);
        newBody.linearVelocity.set(v.x, v.y, v.z);
        return newBody;
    };

    ballBody = updateBody(ballBody);
    if (sphere) sphere.geometry = sharedSphereGeom;
    if (ballShadow) ballShadow.geometry = sharedShadowGeom;

    aiEntities.forEach(ai => {
        ai.body = updateBody(ai.body);
        if (ai.mesh) ai.mesh.geometry = sharedSphereGeom;
        if (ai.shadow) ai.shadow.geometry = sharedShadowGeom;
    });

    for (let id in remoteEntities) {
        const re = remoteEntities[id];
        re.body = updateBody(re.body, isClientMode);
        if (re.mesh) re.mesh.geometry = sharedSphereGeom;
        if (re.shadow) re.shadow.geometry = sharedShadowGeom;
    }
}
