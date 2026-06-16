// ユーティリティ関数

function packData(d) {
            switch (d.type) {
                case 'sync': return [PKT.SYNC, d.entities.map(e => [e.id, round2(e.pos.x), round2(e.pos.y), round2(e.pos.z), round2(e.vel.x), round2(e.vel.y), round2(e.vel.z), e.color, e.name, e.kills, e.team, e.isAlive ? 1 : 0])];
                case 'client_update': return [PKT.CLIENT_UPDATE, [round2(d.input.x), round2(d.input.z)], d.name];
                case 'log': return [PKT.LOG, d.msg];
                case 'apply_settings': return [PKT.APPLY_SETTINGS, d.isSurvival ? 1 : 0, d.isKnockback ? 1 : 0, d.isEscalation ? 1 : 0, d.lives || 0, d.kbRate || 1, d.remoteTeams || {}, d.kbExp || 2, d.isOriginal ? 1 : 0, d.syncParams || {}, d.escStart || ESC_DEFAULT_START_SPEED, d.escMax || ESC_DEFAULT_MAX_SPEED];
                case 'stop_custom_match': return [PKT.STOP_MATCH, d.syncParams || {}];
                case 'ai_added': return [PKT.AI_ADDED, d.id, round2(d.pos.x), round2(d.pos.y), round2(d.pos.z), d.name, d.color, d.team];
                case 'ai_removed': return [PKT.AI_REMOVED, d.id];
                case 'reset_event': return [PKT.RESET, d.id, round2(d.pos.x), round2(d.pos.y), round2(d.pos.z), d.lives || 0, d.stress || 0, d.given || 0];
                case 'player_eliminated': return [PKT.ELIMINATED, d.id];
                case 'event':
                    if (d.eventType === 'name_change') return [PKT.NAME_CHANGE, d.id, d.name];
                    if (d.eventType === 'stat_change') {
                        const safeLives = (typeof d.lives === 'number') ? d.lives : -1;
                        const safeStress = (typeof d.stress === 'number') ? Math.round(d.stress * 100) / 100 : 0;
                        const safeGiven = (typeof d.given === 'number') ? Math.round(d.given * 100) / 100 : 0;
                        return [PKT.STAT_CHANGE, d.id, safeLives, safeStress, safeGiven];
                    }
                    if (d.eventType === 'param_update') return [PKT.PARAM_UPDATE, round2(d.maxSpeed), parseFloat(d.accel.toFixed(3))];
                    return d;
                case 'request_all_restart': return [PKT.REQ_RESTART];
                case 'request_self_reset': return [PKT.REQ_RESET];
                case 'request_add_ai': return [PKT.REQ_ADD_AI];
                case 'request_remove_ai': return [PKT.REQ_REM_AI];
                default: return d;
            }
        }


function unpackData(arr) {
            if (!Array.isArray(arr)) return arr;
            const type = arr[0];
            switch (type) {
                case PKT.SYNC: return { type: 'sync', entities: arr[1].map(e => ({ id: e[0], pos: { x: e[1], y: e[2], z: e[3] }, vel: { x: e[4], y: e[5], z: e[6] }, color: e[7], name: e[8], kills: e[9], team: e[10], isAlive: !!e[11] })) };
                case PKT.CLIENT_UPDATE: return { type: 'client_update', input: { x: arr[1][0], z: arr[1][1] }, name: arr[2] };
                case PKT.LOG: return { type: 'log', msg: arr[1] };
                case PKT.APPLY_SETTINGS: return { type: 'apply_settings', isSurvival: !!arr[1], isKnockback: !!arr[2], isEscalation: !!arr[3], lives: arr[4], kbRate: arr[5], remoteTeams: arr[6], kbExp: arr[7] || 2, isOriginal: !!arr[8], syncParams: arr[9] || null, escStart: arr[10] || ESC_DEFAULT_START_SPEED, escMax: arr[11] || ESC_DEFAULT_MAX_SPEED };
                case PKT.STOP_MATCH: return { type: 'stop_custom_match', syncParams: arr[1] || null };
                case PKT.AI_ADDED: return { type: 'ai_added', id: arr[1], pos: { x: arr[2], y: arr[3], z: arr[4] }, name: arr[5], color: arr[6], team: arr[7] };
                case PKT.AI_REMOVED: return { type: 'ai_removed', id: arr[1] };
                case PKT.RESET: return { type: 'reset_event', id: arr[1], pos: { x: arr[2], y: arr[3], z: arr[4] }, lives: arr[5], stress: arr[6], given: arr[7] || 0 };
                case PKT.ELIMINATED: return { type: 'player_eliminated', id: arr[1] };
                case PKT.NAME_CHANGE: return { type: 'event', eventType: 'name_change', id: arr[1], name: arr[2] };
                case PKT.STAT_CHANGE: return { type: 'event', eventType: 'stat_change', id: arr[1], lives: arr[2], stress: arr[3], given: arr[4] || 0 };
                case PKT.PARAM_UPDATE: return { type: 'event', eventType: 'param_update', maxSpeed: arr[1], accel: arr[2] };
                case PKT.REQ_RESTART: return { type: 'request_all_restart' };
                case PKT.REQ_RESET: return { type: 'request_self_reset' };
                case PKT.REQ_ADD_AI: return { type: 'request_add_ai' };
                case PKT.REQ_REM_AI: return { type: 'request_remove_ai' };
                default: return arr;
            }
        }


function addLog(msg) {
            const log = document.getElementById('kill-log'); const entry = document.createElement('div'); entry.textContent = msg; log.appendChild(entry); if (log.childNodes.length > 15) log.removeChild(log.firstChild);
            const fullLog = document.getElementById('full-log-list');
            if (fullLog) { const fullEntry = document.createElement('div'); fullEntry.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`; fullEntry.style.borderBottom = "1px solid rgba(255,255,255,0.1)"; fullLog.appendChild(fullEntry); fullLog.scrollTop = fullLog.scrollHeight; }
            if (!isClientMode && activeConns.length > 0) { activeConns.forEach(c => { if (c.open) c.send(packData({ type: 'log', msg: msg })); }); }
        }


function toFullWidth(str) {
    if (!str) return "";
    return str.toString().replace(/[!-~]/g, function(s) {
        return String.fromCharCode(s.charCodeAt(0) + 0xFEE0);
    }).replace(/ /g, "　");
}

function getRandomPos() { const range = (params.size / 2) * 0.7; return { x: (Math.random() - 0.5) * range * 2, z: (Math.random() - 0.5) * range * 2 }; }



function calculateLightFactor(normal, isOriginal) {
            let dirLightL = new THREE.Vector3(200, 400, 200).normalize();
            let shadowLightL = new THREE.Vector3(0, 1, 0).normalize();

            let ambient = 0.74;
            let dirIntensity = isOriginal ? 0 : (0.60 * Math.max(0, normal.dot(dirLightL)));
            let shadowIntensity = 0.08 * Math.max(0, normal.dot(shadowLightL));

            let extraSunIntensity = 0;
            if (isOriginal) {
                let sunLightL = new THREE.Vector3(40, 290, 250).normalize();
                extraSunIntensity = 0.6 * Math.max(0, normal.dot(sunLightL));
            }

            let totalIntensity = ambient + dirIntensity + shadowIntensity + extraSunIntensity;

            return 1.0 / Math.max(0.1, totalIntensity);
        }


function getCompensatedColor(r, g, b, normal, isOriginal) {
            const factor = calculateLightFactor(normal, isOriginal);
            let compR = Math.min(255, Math.max(0, r * factor));
            let compG = Math.min(255, Math.max(0, g * factor));
            let compB = Math.min(255, Math.max(0, b * factor));
            return new THREE.Color(`rgb(${Math.round(compR)}, ${Math.round(compG)}, ${Math.round(compB)})`);
        }


function createSphereMaterial(hexColor) {
            return new THREE.MeshStandardMaterial({
                color: hexColor,
                metalness: 0.67,
                roughness: 0.45
            });
        }


function broadcastNameChange() { const oldName = ballBody.name; const newName = playerNameEl.value; ballBody.name = newName; addLog(`${oldName} は名前を ${newName} に変更した。`); updateLeaderboard(); if (isClientMode && hostConn) { hostConn.send(packData({ type: 'event', eventType: 'name_change', name: newName })); } else { broadcastEvent({ type: 'event', eventType: 'name_change', id: myPeerId, name: newName }); } }
