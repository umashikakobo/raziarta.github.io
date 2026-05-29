// ═══════════════════════════════════════════════════════
//  network.js — マルチプレイ (PeerJS)
// ═══════════════════════════════════════════════════════
'use strict';

function packData(eventId, data) {
    if (eventId === 1) {
        return [1, data.id, Math.round(data.x * 100) / 100, Math.round(data.y * 100) / 100, Math.round(data.z * 100) / 100, data.jumps];
    }
    if (eventId === 0) {
        return { event: 0, seed: data.seed, hostId: data.hostId, hostName: data.name, hostConfig: data.hostConfig, density: data.density };
    }
    if (eventId === 5) {
        return { event: 5, id: data.id, name: data.name };
    }
    if (eventId === 6) {
        return { event: 6, seed: data.seed, mode: data.mode, areaSize: data.areaSize, density: data.density, goalHeight: data.goalHeight, maxLives: data.maxLives, deathFallMode: data.deathFallMode, raceType: data.raceType };
    }
    if (eventId === 7) {
        return { event: 7, config: data.config };
    }
    if (eventId === 10) {
        const p = data.props;
        let packedProps = null;
        if (p) packedProps = data.type === 1 ? [p.damage] : [p.radiusMult, p.passWall?1:0, p.bounces, p.rangeMult, p.damage, p.isNeedle?1:0, p.speed];
        return [10, data.type, 
            Math.round(data.x*100)/100, Math.round(data.y*100)/100, Math.round(data.z*100)/100, 
            Math.round(data.vx*100)/100, Math.round(data.vy*100)/100, Math.round(data.vz*100)/100, 
            packedProps, data.ownerName || null];
    }
    if (eventId === 11) {
        const p = data.props;
        let packedProps = null;
        if (p) packedProps = data.type === 1 ? [p.damage] : [p.radiusMult, p.passWall?1:0, p.bounces, p.rangeMult, p.damage, p.isNeedle?1:0, p.speed];
        return [11, data.netId, data.type, 
            Math.round(data.x*100)/100, Math.round(data.y*100)/100, Math.round(data.z*100)/100, 
            Math.round(data.vx*100)/100, Math.round(data.vy*100)/100, Math.round(data.vz*100)/100, 
            packedProps, data.ownerName || null];
    }
    if (eventId === 12) {
        return [12, data.list];
    }
    if (eventId === 13) {
        return [13, data.netId, data.type, Math.round(data.x*100)/100, Math.round(data.y*100)/100, Math.round(data.z*100)/100];
    }
    if (eventId === 20) {
        return { event: 20 };
    }
    if (eventId === 21) {
        return [21, data.targetPeerId, data.damage,
            Math.round(data.kbx * 100) / 100,
            Math.round(data.kby * 100) / 100,
            Math.round(data.kbz * 100) / 100,
            data.attackerId || null];
    }
    if (eventId === 22) {
        // [UPDATED] Stats Sync Events
        return { event: 22 };
    }
    if (eventId === 25) {
        return { event: 25, list: data.list };
    }
    if (eventId === 33) {
        return { event: 33, peerId: data.peerId, isDead: data.isDead };
    }
    if (eventId === 30) {
        return { event: 30, peerId: data.peerId, deaths: data.deaths, killedBy: data.killedBy || null };
    }
    if (eventId === 31) {
        return { event: 31, stats: data.stats };
    }
    if (eventId === 32) {
        return { event: 32, peerId: data.peerId, invincible: data.invincible };
    }
    if (eventId === 34) {
        return { event: 34, killerName: data.killerName, victimName: data.victimName };
    }
}

function unpackData(arr) {
    if (!arr) return null;
    if (arr.event === 0 || arr.event === 5 || arr.event === 6 || arr.event === 7 ||
        arr.event === 20 || arr.event === 22 || arr.event === 25 ||
        arr.event === 30 || arr.event === 31 || arr.event === 32 || arr.event === 33 || arr.event === 34) return arr;

    if (Array.isArray(arr)) {
        const ev = arr[0];
        if (ev === 1) return { event: 1, id: arr[1], x: arr[2], y: arr[3], z: arr[4], jumps: arr[5] };
        if (ev === 10) {
            const pp = arr[8], type = arr[1];
            const props = pp ? (type === 1 ? { damage: pp[0] } : { radiusMult: pp[0], passWall: !!pp[1], bounces: pp[2], rangeMult: pp[3], damage: pp[4], isNeedle: !!pp[5], speed: pp[6] }) : null;
            return { event: 10, type, x: arr[2], y: arr[3], z: arr[4], vx: arr[5], vy: arr[6], vz: arr[7], props, ownerName: arr[9] || null };
        }
        if (ev === 11) {
            const pp = arr[9], type = arr[2];
            const props = pp ? (type === 1 ? { damage: pp[0] } : { radiusMult: pp[0], passWall: !!pp[1], bounces: pp[2], rangeMult: pp[3], damage: pp[4], isNeedle: !!pp[5], speed: pp[6] }) : null;
            return { event: 11, netId: arr[1], type, x: arr[3], y: arr[4], z: arr[5], vx: arr[6], vy: arr[7], vz: arr[8], props, ownerName: arr[10] || null };
        }
        if (ev === 12) return { event: 12, list: arr[1] };
        if (ev === 13) return { event: 13, netId: arr[1], type: arr[2], x: arr[3], y: arr[4], z: arr[5] };
        if (ev === 21) return { event: 21, targetPeerId: arr[1], damage: arr[2], kbx: arr[3], kby: arr[4], kbz: arr[5], attackerId: arr[6] };
    }
    return arr;
}

let _isBroadcasting = false;
function broadcastEvent(eventId, rawData) {
    if (!G.isOnline || _isBroadcasting) return;
    

    
    const packed = packData(eventId, rawData);
    if (packed === undefined || packed === null) {
        console.warn(`[Multiplayer] Skipping broadcast for Event ${eventId}: Packed data is null/undefined.`);
        return;
    }

    _isBroadcasting = true;
    if (G.isHost) {
        // ホスト自身にも適用
        const data = unpackData(packed);
        handleNetworkData(data, null);

        G.connections.forEach(c => {
            if (c.open) {
                try {
                    c.send(packed);
                } catch (e) {
                    console.error(`[Multiplayer] Failed to send Event ${eventId} to ${c.peer}:`, e);
                }
            }
        });
    } else if (G.hostConn && G.hostConn.open) {
        try {
            G.hostConn.send(packed);
        } catch (e) {
            console.error(`[Multiplayer] Failed to send Event ${eventId} to host:`, e);
        }
    }
    _isBroadcasting = false;
}

function sendToClient(peerId, eventId, rawData) {
    if (!G.isHost || !G.isOnline) return;
    const packed = packData(eventId, rawData);
    const conn = G.connections.find(c => c.peer === peerId && c.open);
    if (conn) conn.send(packed);
}

const PEER_OPTIONS = {
    debug: 1, // エラーのみ表示 (3は詳細ログすぎてコンソールが埋まるため)
    secure: true,
    config: {
        iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
            {
                urls: 'turn:relay.metered.ca:80',
                username: 'openrelayproject',
                credential: 'openrelayproject'
            },
            {
                urls: 'turn:relay.metered.ca:443',
                username: 'openrelayproject',
                credential: 'openrelayproject'
            },
            {
                urls: 'turn:relay.metered.ca:443?transport=tcp',
                username: 'openrelayproject',
                credential: 'openrelayproject'
            }
        ]
    }
};

function setupHost() {
    if (G.isOnline || G.peer) {
        console.warn("[Multiplayer] Already hosting or connected.");
        return;
    }
    logStatus("Creating room...");
    let attempt = 1;
    function tryBind() {
        if (attempt > 10) {
            logStatus("Failed to create room. (Servers full)");
            return;
        }
        const tryId = ROOM_PREFIX + attempt;
        console.log(`[Multiplayer] Attempting to host room: ${tryId}`);
        G.peer = new Peer(tryId, PEER_OPTIONS);

        G.peer.on('open', (id) => {
            console.log(`[Multiplayer] Successfully opened peer with ID: ${id}`);
            logStatus(`Room Hosted! (Room ID: ${attempt})`);
            G.myPeerId = id;
            G.isHost = true;
            G.isOnline = true;
            G.randomSeed = Math.random();
            // Exit Lobbyボタンを表示
            const exitBtn = document.getElementById('btn-exit-lobby');
            if (exitBtn) exitBtn.style.display = 'block';
            // プレイヤーリスト表示開始
            updateLobbyPlayerList();
        });

        G.peer.on('error', (err) => {
            console.error(`[Multiplayer] PeerJS Host Error: ${err.type}`, err);
            if (err.type === 'unavailable-id') {
                console.warn(`[Multiplayer] ID ${tryId} is already taken, trying next...`);
                attempt++;
                G.peer.destroy();
                tryBind();
            } else {
                logStatus("PeerJS Error: " + err.type);
            }
        });

        G.peer.on('disconnected', () => {
            console.warn("[Multiplayer] Peer disconnected from server. Attempting to reconnect...");
            G.peer.reconnect();
        });

        G.peer.on('close', () => {
            console.error("[Multiplayer] Peer connection closed.");
            G.isOnline = false;
        });

        G.peer.on('connection', (conn) => {
            console.log("[Multiplayer] New client connection request from:", conn.peer);
            G.connections.push(conn);
            conn.on('open', () => {
                // ホスト自身の名前を送信
                conn.send(packData(0, {
                    seed: G.randomSeed,
                    hostId: G.myPeerId,
                    name: G.myPlayerName,
                    density: config.density,
                    hostConfig: {
                        deathFallMode: config.deathFallMode,
                        areaSize: config.areaSize,
                        goalHeight: config.goalHeight,
                        density: config.density,
                        raceType: config.raceType,
                        maxLives: config.maxLives
                    }
                }));
                // 既存の全プレイヤーの名前リストを新規接続者に同期
                G.peerNames.forEach((name, id) => {
                    if (id !== G.myPeerId) {
                        conn.send(packData(5, { id: id, name: name }));
                    }
                });
                updateLobbyPlayerList();
            });
            conn.on('data', (data) => {
                handleNetworkData(data, conn);
            });
            conn.on('close', () => {
                logStatus('プレイヤーが離脱しました: ' + (G.peerNames.get(conn.peer) || conn.peer));
                const ent = G.networkEntities.get(conn.peer);
                if (ent) {
                    if (ent.mesh && G.scene) G.scene.remove(ent.mesh);
                    if (G.isHost && ent.body && G.world) G.world.removeRigidBody(ent.body);
                    G.networkEntities.delete(conn.peer);
                }
                G.peerNames.delete(conn.peer);
                G.connections = G.connections.filter(c => c !== conn);
                updateLobbyPlayerList();
            });
        });
    }
    tryBind();
}

function setupClient(targetRoomId) {
    if (!targetRoomId) {
        logStatus("No room selected.");
        return;
    }
    console.log("[Multiplayer] Initializing Peer for Client...");
    G.peer = new Peer(PEER_OPTIONS);

    G.peer.on('open', (id) => {
        console.log(`[Multiplayer] Client Peer opened with ID: ${id}`);
        G.myPeerId = id;

        const tryId = ROOM_PREFIX + targetRoomId;
        console.log(`[Multiplayer] Trying to connect to Room ID: ${tryId}...`);
        logStatus(`Connecting to room ${targetRoomId}...`);
        const conn = G.peer.connect(tryId, { reliable: true });

        conn.on('open', () => {
            console.log(`[Multiplayer] Connected to host: ${conn.peer}`);
            G.hostConn = conn;
            G.isOnline = true;
            logStatus("Connected to Room " + targetRoomId + "!");
            enterClientLobby();

            conn.on('data', (data) => {
                handleNetworkData(data, conn);
            });
        });

        conn.on('error', (err) => {
            console.error(`[Multiplayer] Connection error for ${tryId}:`, err);
        });

        conn.on('close', () => {
            console.warn(`[Multiplayer] Connection to host ${conn.peer} closed.`);
            G.isOnline = false;
            logStatus("Connection closed.");
            if (G.isStarted) {
                resetToHome();
            }
            exitClientLobby();
            const exitBtn = document.getElementById('btn-exit-lobby');
            if (exitBtn) exitBtn.style.display = 'none';
        });

        G.peer.on('error', (err) => {
            console.error(`[Multiplayer] PeerJS Client Error: ${err.type}`, err);
            if (err.type === 'peer-unavailable') {
                logStatus("Room " + targetRoomId + " not found or unavailable.");
                G.peer.destroy();
            } else {
                logStatus("PeerJS Error: " + err.type);
            }
        });

        G.peer.on('disconnected', () => {
            console.warn("[Multiplayer] Client Peer disconnected. Reconnecting...");
            G.peer.reconnect();
        });
    });
}

// ═══════════════════════════════════════════════════════
//  クライアント専用ロビー管理
// ═══════════════════════════════════════════════════════

function enterClientLobby() {
    G.isClientInLobby = true;
    const btnTut = document.getElementById('btn-tutorial');
    const btnMain = document.getElementById('btn-main');
    if (btnTut) { btnTut.disabled = true; btnTut.style.opacity = '0.3'; }
    if (btnMain) { btnMain.disabled = true; btnMain.style.opacity = '0.3'; }

    logStatus("ホストのゲーム開始を待っています… (ロビー)");

    const mainTitle = document.querySelector('.main-title');
    if (mainTitle) mainTitle.textContent = 'LOBBY';
    const screenTitle = document.querySelector('.screen-title');
    if (screenTitle) screenTitle.textContent = '■ CLIENT MODE';

    const exitBtn = document.getElementById('btn-exit-lobby');
    if (exitBtn) exitBtn.style.display = 'block';
    
    const listEl = document.getElementById('lobby-player-list');
    if (listEl) {
        const panel = document.getElementById('lobby-panel');
        if (panel) panel.style.display = 'block';
    }
}

function exitClientLobby() {
    G.isClientInLobby = false;
    const btnTut = document.getElementById('btn-tutorial');
    const btnMain = document.getElementById('btn-main');
    if (btnTut) { btnTut.disabled = false; btnTut.style.opacity = '1'; }
    if (btnMain) { btnMain.disabled = false; btnMain.style.opacity = '1'; }

    const mainTitle = document.querySelector('.main-title');
    if (mainTitle) mainTitle.textContent = 'MAIN MENU';
    const screenTitle = document.querySelector('.screen-title');
    if (screenTitle) screenTitle.textContent = '■ SCREEN TITLE';

    const exitBtn = document.getElementById('btn-exit-lobby');
    if (exitBtn) exitBtn.style.display = 'none';
    const panel = document.getElementById('lobby-panel');
    if (panel) panel.style.display = 'none';
    const playerList = document.getElementById('lobby-player-list');
    if (playerList) playerList.innerHTML = '';
}

// ロビープレイヤーリスト更新（ホスト用）
function updateLobbyPlayerList() {
    const listEl = document.getElementById('lobby-player-list');
    if (!listEl) return;

    const names = [];
    // ホスト自身
    names.push(`<span style="color:#0ea5e9; font-weight:bold;">★ ${G.myPlayerName} (HOST)</span>`);
    // 接続中のクライアント
    G.peerNames.forEach((name, id) => {
        if (id !== G.myPeerId) names.push(`<span style="color:#f1f5f9;">● ${name}</span>`);
    });
    // まだ名前を受信していない接続
    G.connections.forEach(c => {
        if (!G.peerNames.has(c.peer)) {
            names.push(`<span style="color:#94a3b8;">● Connecting...</span>`);
        }
    });

    listEl.innerHTML = names.join('<br>');
    
    const panel = document.getElementById('lobby-panel');
    if (panel) panel.style.display = 'block';

    updateLobbySettingsUI();
}

function updateLobbySettingsUI() {
    const listEl = document.getElementById('lobby-settings-list');
    if (!listEl) return;

    const rows = [
        { label: 'RACE MODE', val: config.raceType || 'BATTLE' },
        { label: 'AREA SIZE', val: config.areaSize },
        { label: 'DENSITY', val: (config.density * 100).toFixed(0) + '%' },
        { label: 'GOAL HEIGHT', val: config.goalHeight + 'm' },
        { label: 'MAX LIVES', val: config.maxLives },
        { label: 'DEATH FALL', val: config.deathFallMode === 'none' ? 'OFF' : config.deathFallMode + 'm' }
    ];

    listEl.innerHTML = rows.map(r => `
        <div class="setting-item">
            <span>${r.label}</span>
            <span class="setting-val">${r.val}</span>
        </div>
    `).join('');
}

const NETWORK_EVENT_HANDLERS = {
    0: (data, sourceConn, from) => {
        if (!G.isHost) {
            G.randomSeed = data.seed;
            console.log("Received Seed:", G.randomSeed);
            G.peerNames.set(data.hostId, data.hostName);
            if (data.density !== undefined) config.density = data.density;
            if (data.hostConfig) {
                Object.assign(config, data.hostConfig);
            }
            updateLobbySettingsUI();
            broadcastEvent(5, { id: G.myPeerId, name: G.myPlayerName });
        }
    },
    1: (data, sourceConn, from) => {
        updateNetworkEntity(data, sourceConn);
    },
    5: (data, sourceConn, from) => {
        G.peerNames.set(data.id, data.name);
        if (G.networkEntities.has(data.id)) {
            const ent = G.networkEntities.get(data.id);
            if (ent.sprite) ent.mesh.remove(ent.sprite);
            ent.sprite = createNameSprite(data.name);
            ent.mesh.add(ent.sprite);
        }
        if (G.isHost && sourceConn !== null) {
            broadcastEvent(5, data);
            updateLobbyPlayerList();

            const lobbyList = [];
            lobbyList.push({ id: G.myPeerId, name: G.myPlayerName, isHost: true });
            G.peerNames.forEach((name, id) => { if (id !== G.myPeerId) lobbyList.push({ id, name, isHost: false }) });
            broadcastEvent(25, { list: lobbyList });

            G.projectiles.forEach(p => {
                if (p.netId != null) broadcastEvent(11, { netId: p.netId, type: 0, x: p.position.x, y: p.position.y, z: p.position.z, vx: p.velocity.x, vy: p.velocity.y, vz: p.velocity.z, props: p.props, ownerName: resolveName(p.ownerBody) });
            });
            G.bubbles.forEach(b => {
                if (b.netId != null && b.body) broadcastEvent(11, { netId: b.netId, type: 1, x: b.body.position.x, y: b.body.position.y, z: b.body.position.z, vx: b.body.linearVelocity.x, vy: b.body.linearVelocity.y, vz: b.body.linearVelocity.z, props: b.props, ownerName: b.ownerId });
            });
        }
    },
    25: (data, sourceConn, from) => {
        if (!G.isHost) {
            const listEl = document.getElementById('lobby-player-list');
            if (!listEl) return;
            const names = data.list.map(p =>
                p.isHost
                ? `<span style="color:#0ea5e9; font-weight:bold;">★ ${p.name} (HOST)</span>`
                : `<span style="color:#f1f5f9;">● ${p.name}${p.id === G.myPeerId ? ' (YOU)' : ''}</span>`
            );
            listEl.innerHTML = names.join('<br>');
            listEl.style.display = 'block';
        }
    },
    6: (data, sourceConn, from) => {
        if (!G.isHost && !G.isStarted) {
            if (data.seed !== undefined) G.randomSeed = data.seed;
            Object.assign(config, {
                areaSize: data.areaSize !== undefined ? data.areaSize : config.areaSize,
                density: data.density !== undefined ? data.density : config.density,
                goalHeight: data.goalHeight !== undefined ? data.goalHeight : config.goalHeight,
                maxLives: data.maxLives !== undefined ? data.maxLives : config.maxLives,
                deathFallMode: data.deathFallMode !== undefined ? data.deathFallMode : config.deathFallMode,
                raceType: data.raceType !== undefined ? data.raceType : config.raceType
            });

            G.isStarted = true;
            G.currentMode = data.mode || 'main';
            G.playerLives = config.maxLives;
            updateLifeHUD();
            if (G.currentMode === 'tutorial') {
                document.getElementById('tutorial-ui').classList.remove('hidden');
            } else {
                document.getElementById('tutorial-ui').classList.add('hidden');
            }
            document.getElementById('multiplayer-ui').classList.add('hidden');
            document.getElementById('start-screen').style.display = 'none';
            if (window.stopMenuOcean) window.stopMenuOcean();
            document.getElementById('ui-layer').style.display = 'block';
            init();
            G.startTime = Date.now();
            logStatus('ゲーム開始！画面をクリックして操作を開始してください');
            if (G.controls) {
                try { G.controls.lock(); } catch (e) { }
            }
        }
    },
    7: (data, sourceConn, from) => {
        // [NEW] ホストからのリアルタイム設定同期
        if (!G.isHost && data.config) {
            Object.assign(config, data.config);
            updateLobbySettingsUI();
        }
    },
    10: (data, sourceConn, from) => {
        if (G.isHost) {
            let reqOwnerBody = null;
            let reqOwnerId = null;
            if (sourceConn) {
                reqOwnerId = sourceConn.peer;
                const ent = G.networkEntities.get(reqOwnerId);
                if (ent) reqOwnerBody = ent.body;
            }
            if (data.type === 0) {
                const p = fireProjectile(data.x, data.y, data.z, data.vx, data.vy, data.vz, reqOwnerBody, null, data.props);
                if (p) p.ownerId = reqOwnerId; // 直接IDを紐付け
            } else {
                createBubble(data.x, data.y, data.z, data.vx, data.vy, data.vz, reqOwnerBody, null, reqOwnerId, data.props);
            }
        }
    },
    11: (data, sourceConn, from) => {
        if (!G.isHost) {
            const myId = G.myPeerId ? String(G.myPeerId).trim() : "";
            const ownId = data.ownerName ? String(data.ownerName).trim() : "";
            if (myId && ownId === myId) {
                // 自分自身の出した弾/泡なら、ローカルで生成済みのものに netId を紐付ける
                if (data.type === 0) {
                    const p = G.projectiles.find(p => p.ownerBody === G.playerBody && p.netId == null);
                    if (p) {
                        p.netId = data.netId;
                        if (p.netId != null) G.netObjects.set(p.netId, p.mesh);
                    }
                } else {
                    const b = G.bubbles.find(b => b.ownerBody === G.playerBody && b.netId == null);
                    if (b) {
                        b.netId = data.netId;
                        if (b.netId != null) G.netObjects.set(b.netId, b.mesh);
                    }
                }
                return;
            }

            if (data.type === 0) {
                fireProjectile(data.x, data.y, data.z, data.vx, data.vy, data.vz, resolveBody(data.ownerName), data.netId, data.props);
            } else {
                createBubble(data.x, data.y, data.z, data.vx, data.vy, data.vz, resolveBody(data.ownerName), data.netId, data.ownerName, data.props);
            }
        }
    },
    12: (data, sourceConn, from) => {
        if (!G.isHost) {
            const list = data.list;
            if (!list) return;
            for (let i = 0; i < list.length; i += 4) {
                const id = list[i];
                const x = list[i+1];
                const y = list[i+2];
                const z = list[i+3];
                
                const proj = G.projectiles.find(p => p.netId === id);
                if (proj) {
                    proj.position.set(x, y, z);
                    proj.mesh.position.copy(proj.position);
                } else {
                    const bub = G.bubbles.find(b => b.netId === id);
                    if (bub) {
                        if (bub.body) {
                            bub.body.resetPosition(x, y, z);
                        }
                        bub.mesh.position.set(x, y, z);
                    }
                }
            }
        }
    },
    13: (data, sourceConn, from) => {
        if (!G.isHost) {
            if (data.type === 0) {
                const idx = G.projectiles.findIndex(p => p.netId === data.netId);
                if (idx !== -1) {
                    const p = G.projectiles[idx];
                    createExplosion(data.x, data.y, data.z);
                    p.mesh.visible = false;
                    G.projectilePool.push(p.mesh);
                    if (p.netId != null) G.netObjects.delete(p.netId);
                    G.projectiles.splice(idx, 1);
                }
            } else {
                const idx = G.bubbles.findIndex(b => b.netId === data.netId);
                if (idx !== -1) {
                    const b = G.bubbles[idx];
                    createExplosion(data.x, data.y, data.z);
                    b.mesh.visible = false;
                    G.bubblePool.push(b.mesh);
                    if (b.netId != null) G.netObjects.delete(b.netId);
                    if (b.body) G.world.removeRigidBody(b.body);
                    b.body = null;
                    b.mesh = null;
                    G.bubbles.splice(idx, 1);
                }
            }
        }
    },
    20: (data, sourceConn, from) => {
        // ホストがロビーに戻った → クライアントも追従（通知なし）
        if (!G.isHost) {
            console.log("[Multiplayer] Host returned to lobby. Following...");
            if (G.isStarted) {
                resetToHome();
            }
            G.isClientInLobby = true;
            enterClientLobby();
        }
    },
    21: (data, sourceConn, from) => {
        // ホストからのダメージ＋ノックバック通知
        if (!G.isHost) {
            const myId = G.myPeerId ? String(G.myPeerId).trim() : "";
            const targetId = data.targetPeerId ? String(data.targetPeerId).trim() : "";
            if (myId && targetId === myId) {
                if (G.isInvincible) return;   // ← 追加：無敵中はノックバックもダメージも無視
                G.lastDamageSourceId = data.attackerId;
                takeDamage(data.damage);
                if (G.playerBody) {
                    G.playerBody.linearVelocity.x += data.kbx;
                    G.playerBody.linearVelocity.y += data.kby;
                    G.playerBody.linearVelocity.z += data.kbz;
                }
            }
        }
    },
    22: (data, sourceConn, from) => {
        // ロビー解散通知
        if (!G.isHost) {
            console.log("[Multiplayer] Host dissolved the lobby.");
            if (G.isStarted) {
                resetToHome();
            }
            G.isOnline = false;
            G.isClientInLobby = false;
            if (G.hostConn) { G.hostConn.close(); G.hostConn = null; }
            if (G.peer) { G.peer.destroy(); G.peer = null; }
            G.networkEntities.clear();
            G.peerNames.clear();
            exitClientLobby();
            logStatus("ホストがロビーを解散しました");
        }
    },
    30: (data, sourceConn, from) => {
        // [UPDATED] Stats Processing
        // クライアントが死亡を通知 → ホストがキル加算してから全員にブロードキャスト
        if (G.isHost) {
            if (!G.peerStats) G.peerStats = new Map();

            // デス加算
            if (!G.peerStats.has(data.peerId)) {
                G.peerStats.set(data.peerId, { kills: 0, deaths: 0 });
            }
            G.peerStats.get(data.peerId).deaths = data.deaths;

            // キル加算（killedBy がホスト自身でも他クライアントでも同じ処理）
            if (data.killedBy) {
                if (!G.peerStats.has(data.killedBy)) {
                    G.peerStats.set(data.killedBy, { kills: 0, deaths: 0 });
                }
                G.peerStats.get(data.killedBy).kills++;
            }

            // 全員に最新 stats をブロードキャスト（ホスト自身も更新）
            const statsObj = {};
            G.peerStats.forEach((v, k) => { 
                statsObj[k] = { 
                    kills: v.kills || 0, 
                    deaths: v.deaths || 0 
                }; 
            });
            broadcastEvent(31, { stats: statsObj });

            // [NEW] キルログ通知を全員に送信
            const victimEnt = (data.peerId === G.myPeerId) ? { name: G.myPlayerName } : G.networkEntities.get(data.peerId);
            const victimName = victimEnt ? victimEnt.name : "Player";
            let killerName = "落下 / 罠";
            if (data.killedBy) {
                const kEnt = (data.killedBy === G.myPeerId) ? { name: G.myPlayerName } : G.networkEntities.get(data.killedBy);
                if (kEnt) killerName = kEnt.name;
            }
            broadcastEvent(34, { killerName, victimName });

            // ホスト自身の画面も更新
            if (typeof updateScoreboard === 'function') updateScoreboard();
        }
    },
    31: (data, sourceConn, from) => {
        // ホストからの stats 全体更新（クライアント側で受け取る）
        if (!G.isHost) {
            if (!G.peerStats) G.peerStats = new Map();
            if (data.stats) {
                Object.entries(data.stats).forEach(([k, v]) => G.peerStats.set(k, v));
            }
            if (typeof updateScoreboard === 'function') updateScoreboard();
        }
    },
    32: (data, sourceConn, from) => {
        // 無敵状態の同期
        const ent = G.networkEntities.get(data.peerId);
        if (ent) {
            ent.isInvincible = data.invincible;
            if (ent.rawMesh) {
                if (data.invincible) {
                    ent.rawMesh.traverse(n => {
                        if (n.isMesh) {
                            if (!n._origMaterial) n._origMaterial = n.material;
                            n.material = n.material.clone();
                            if (n.material.color) n.material.color.set(0xffffff);
                            if (n.material.emissive) {
                                n.material.emissive.set(0xffffff);
                                n.material.emissiveIntensity = 1.0;
                            }
                        }
                    });
                } else {
                    ent.rawMesh.traverse(n => {
                        if (n.isMesh && n._origMaterial) {
                            n.material = n._origMaterial;
                            n._origMaterial = null;
                        }
                    });
                }
            }
        }
        if (G.isHost && ent && ent.body) {
            if (data.invincible) {
                ent._savedLayer = ent.body.belongsTo;
                ent.body.belongsTo = 0;
            } else if (ent._savedLayer !== undefined) {
                ent.body.belongsTo = ent._savedLayer;
                ent._savedLayer = undefined;
            }
        }
        // ホストなら他のクライアントにも転送
        if (G.isHost) {
            G.connections.forEach(c => {
                if (c.open && sourceConn && c.peer !== sourceConn.peer) {
                    c.send(packData(32, data));
                }
            });
        }
    },
    33: (data, sourceConn, from) => {
        // 死亡状態（十字架メッシュの切り替え）同期
        const ent = G.networkEntities.get(data.peerId);
        if (ent && G.scene) {
            ent.isDead = data.isDead;
            if (data.isDead) {
                if (ent.mesh) ent.mesh.visible = false;
                if (!ent._deathCrossMesh) {
                    if (G.crossModel) {
                        ent._deathCrossMesh = G.crossModel.clone();
                    } else {
                        // ジオメトリから十字架を組み立てる
                        const crossV = new THREE.CylinderGeometry(0.08, 0.08, 1.8, 6);
                        const crossH = new THREE.CylinderGeometry(0.08, 0.08, 1.0, 6);
                        const crossMat = new THREE.MeshStandardMaterial({ color: 0xdddddd, emissive: 0x888888 });
                        const vMesh = new THREE.Mesh(crossV, crossMat);
                        const hMesh = new THREE.Mesh(crossH, crossMat);
                        hMesh.rotation.z = Math.PI / 2;
                        hMesh.position.y = 0.4;
                        ent._deathCrossMesh = new THREE.Group();
                        ent._deathCrossMesh.add(vMesh);
                        ent._deathCrossMesh.add(hMesh);
                    }
                }
                ent._deathCrossMesh.position.copy(ent.mesh.position);
                G.scene.add(ent._deathCrossMesh);
            } else {
                if (ent.mesh) ent.mesh.visible = true;
                if (ent._deathCrossMesh) {
                    G.scene.remove(ent._deathCrossMesh);
                    ent._deathCrossMesh.traverse(n => { if (n.geometry) n.geometry.dispose(); });
                    ent._deathCrossMesh = null;
                }
            }
        }
        if (G.isHost) {
            G.connections.forEach(c => {
                if (c.open && sourceConn && c.peer !== sourceConn.peer) {
                    c.send(packData(33, data));
                }
            });
        }
    },
    34: (data, sourceConn, from) => {
        // [NEW] キルログ通知を受信
        if (typeof addKillLog === 'function') {
            // ホストの場合、自分自身の死亡ログは ui.js で表示済みなのでスキップ
            if (G.isHost && data.victimName === G.myPlayerName) return;
            addKillLog(data.killerName, data.victimName);
        }
    }
};

function handleNetworkData(rawData, sourceConn) {
    const data = unpackData(rawData);
    if (!data) return;

    const from = sourceConn ? sourceConn.peer : "LOCAL(HOST)";

    if (NETWORK_EVENT_HANDLERS[data.event]) {
        NETWORK_EVENT_HANDLERS[data.event](data, sourceConn, from);
    } else {
        console.warn("[Multiplayer] Unhandled event type:", data.event);
    }
}

function updateNetworkEntity(data, conn = null) {
    if (data.id === G.myPeerId) return;

    if (G.isHost && conn) {
        const rawData = packData(1, data);
        G.connections.forEach(c => {
            if (c !== conn && c.open) c.send(rawData);
        });
    }

    if (!G.networkEntities.has(data.id)) {
        const ent = createNetworkPlayer(data.id);
        G.networkEntities.set(data.id, ent);
    }

    const ent = G.networkEntities.get(data.id);
    if (!ent) return;

    // メッシュが現在のシーンにない場合（シーン再生成後など）は再追加
    if (ent.mesh && G.scene && ent.mesh.parent !== G.scene) {
        G.scene.add(ent.mesh);
    }

    ent.targetNetPos = new THREE.Vector3(data.x, data.y, data.z);
    ent.jumpCount = data.jumps;

    if (G.isHost && ent.body && G.world) {
        ent.body.resetPosition(data.x, data.y, data.z);
        ent.body.linearVelocity.set(0, 0, 0);
    }
}

function createNetworkPlayer(id) {
    const isAINet = id.startsWith("AI_");
    let mesh;

    if (G.playerModel) {
        const matColor = isAINet ? 0x90ee90 : null;
        mesh = clonePlayerModel(matColor);
        if (isAINet) {
            mesh.traverse(n => {
                if (n.isMesh) {
                    n.material.emissive.set(0x225522);
                }
            });
        }
        addXrayMeshToModel(mesh, 0xffaa33);

    } else {
        const matColor = isAINet ? 0x90ee90 : 0x4488ff;
        mesh = new THREE.Mesh(
            new THREE.BoxGeometry(0.5, 0.5, 0.5),
            new THREE.MeshStandardMaterial({ color: matColor })
        );
    }

    const container = new THREE.Group();
    container.add(mesh);

    const pName = G.peerNames.get(id) || (isAINet ? "RIVAL AI" : "Player");
    const sprite = createNameSprite(pName);
    container.add(sprite);
    if (G.scene) G.scene.add(container);

    let body = null;
    if (!G._netEntIndexCounter) G._netEntIndexCounter = 11;
    const entIndex = G._netEntIndexCounter++;

    if (G.isHost && G.world) {
        body = G.world.add({
            type: 'sphere',
            size: [0.37],
            pos: [0, -100, 0],
            move: true,
            belongsTo: 1 << (entIndex + 1),
            collidesWith: 1 | BUBBLE_LAYER | PROJECTILE_LAYER,
            density: 1, friction: 0.2, restitution: 0.1
        });
    }

    return { id: id, mesh: container, body: body, targetNetPos: container.position.clone(), sprite: sprite, name: pName, rawMesh: mesh, entIndex: entIndex };
}
