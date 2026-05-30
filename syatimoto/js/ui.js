// ═══════════════════════════════════════════════════════
//  ui.js — UI更新・HUD・名前スプライト・デバッグGUI
// ═══════════════════════════════════════════════════════
'use strict';

function updateLifeHUD() {
    const lifeEl = document.getElementById('life-display');
    if (!lifeEl) return;
    if (G.playerLives <= 0) {
        lifeEl.textContent = '✕';
    } else {
        lifeEl.textContent = '■'.repeat(Math.max(0, G.playerLives));
    }
    updateAmmoHUD();
}

function updateAmmoHUD() {
    const pGroup = document.getElementById('gauge-shot-group');
    if (pGroup) {
        const maxP = Math.floor(config.maxProjectileStock || 2);
        while (pGroup.children.length < maxP) {
            const idx = pGroup.children.length;
            const seg = document.createElement('div');
            seg.className = 'ammo-segment';
            seg.innerHTML = `<div id="shot-seg-${idx}" class="ammo-segment-inner shot-inner"></div>`;
            pGroup.appendChild(seg);
        }
        for (let i = 0; i < pGroup.children.length; i++) {
            const seg = document.getElementById(`shot-seg-${i}`);
            if (seg) {
                if (i >= maxP) {
                    seg.parentElement.style.display = 'none';
                } else {
                    seg.parentElement.style.display = '';
                    const fill = Math.min(1.0, Math.max(0, G.playerProjectileStock - i));
                    seg.style.width = (fill * 100) + '%';
                }
            }
        }
    }
    const bGroup = document.getElementById('gauge-bubble-group');
    if (bGroup) {
        const maxB = Math.floor(config.maxBubbleStock || 2);
        while (bGroup.children.length < maxB) {
            const idx = bGroup.children.length;
            const seg = document.createElement('div');
            seg.className = 'ammo-segment';
            seg.innerHTML = `<div id="bubble-seg-${idx}" class="ammo-segment-inner bubble-inner"></div>`;
            bGroup.appendChild(seg);
        }
        for (let i = 0; i < bGroup.children.length; i++) {
            const seg = document.getElementById(`bubble-seg-${i}`);
            if (seg) {
                if (i >= maxB) {
                    seg.parentElement.style.display = 'none';
                } else {
                    seg.parentElement.style.display = '';
                    const fill = Math.min(1.0, Math.max(0, G.playerBubbleStock - i));
                    seg.style.width = (fill * 100) + '%';
                }
            }
        }
    }
}


function resetUpgradeDisplay() {
    const move = document.getElementById('upg-move');
    const proj = document.getElementById('upg-proj');
    const bubb = document.getElementById('upg-bubb');
    if (move) move.textContent = 'MOVE: ---';
    if (proj) proj.textContent = 'PROJ: ---';
    if (bubb) bubb.textContent = 'BUBB: ---';
}

function createNameSprite(nameText) {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');

    const updateTexture = (text) => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.font = 'bold 54px "Segoe UI", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#ffffff';
        // 縁取り
        ctx.strokeStyle = 'rgba(0,0,0,0.5)';
        ctx.lineWidth = 6;
        ctx.strokeText(text, 512, 64);
        ctx.fillText(text, 512, 64);
        tex.needsUpdate = true;
    };

    const tex = new THREE.CanvasTexture(canvas);
    updateTexture(nameText);

    const spriteMat = new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true });
    const sprite = new THREE.Sprite(spriteMat);
    sprite.scale.set(12.0, 1.5, 1);
    sprite.position.y = 2.0;
    sprite.renderOrder = 999;
    sprite.updateText = updateTexture;
    return sprite;
}

function logStatus(msg) {
    document.getElementById('mp-status').innerText = msg;
}

function takeDamage(amount, attackerId = null) {
    if (G.isDead || G.isInvincible) return;
    G.playerLives -= amount;
    if (attackerId) G.lastDamageSourceId = attackerId;
    updateLifeHUD();

    const flash = document.createElement('div');
    flash.style.position = 'absolute';
    flash.style.inset = '0';
    flash.style.backgroundColor = 'rgba(255,0,0,0.4)';
    flash.style.pointerEvents = 'none';
    flash.style.zIndex = '9999';
    document.body.appendChild(flash);
    setTimeout(() => flash.remove(), 100);

    if (G.playerLives <= 0) {
        startDeathSequence();
    }
}

function addKillLog(killer, victim) {
    const container = document.getElementById('kill-log-container');
    if (!container) return;

    const entry = document.createElement('div');
    entry.className = 'kill-log-entry';
    
    // 自分の名前なら「あなた」に変換
    const finalKiller = (killer === G.myPlayerName) ? "あなた" : killer;
    const finalVictim = (victim === G.myPlayerName) ? "あなた" : victim;

    // 名前のエスケープ
    const escape = (str) => {
        const p = document.createElement('p');
        p.textContent = str;
        return p.innerHTML;
    };

    entry.innerHTML = `
        <span class="kill-log-killer">${escape(finalKiller)}</span>
        <span style="margin: 0 4px;">が</span>
        <span class="kill-log-victim">${escape(finalVictim)}</span>
        <span style="margin-left: 4px;">を倒した。</span>
    `;

    container.appendChild(entry);

    // 5秒後にフェードアウトして削除
    setTimeout(() => {
        entry.style.animation = 'logFadeOut 0.5s ease-in forwards';
        setTimeout(() => entry.remove(), 500);
    }, 5000);
}
window.addKillLog = addKillLog;

function startDeathSequence() {
    G.isDead = true;
    G.deathTimer = 8.0;
    G.playerLives = 0;
    G.deathPositionY = G.playerBody.position.y;

    // 被害者の名前（固有名称を使用）
    const victimName = G.myPlayerName || "Player";
    let killerName = "落下 / 罠";
    if (G.lastDamageSourceId) {
        // IDから攻撃者の名前を解決
        const ent = G.networkEntities.get(G.lastDamageSourceId);
        if (ent) killerName = ent.name;
        else if (G.lastDamageSourceId === G.myPeerId) killerName = victimName; // 自爆など
    }
    // 自分自身の死亡ログを表示（オフライン時、またはホスト時）
    if (!G.isOnline || G.isHost) {
        addKillLog(killerName, victimName);
    }

    // デス・キル情報をホストへ送信
    if (G.isOnline && !G.isHost) {
        if (!G.myDeaths) G.myDeaths = 0;
        G.myDeaths++;
        console.log(`[DEBUG] Client reporting death to host. Deaths: ${G.myDeaths}, KilledBy: ${G.lastDamageSourceId}`);
        broadcastEvent(30, {
            peerId: G.myPeerId,
            deaths: G.myDeaths,
            killedBy: G.lastDamageSourceId || null
        });
        G.lastDamageSourceId = null;
    } else if (G.isHost && G.isOnline) {
        // ホスト自身が死んだ場合はローカルで直接処理
        if (!G.myDeaths) G.myDeaths = 0;
        G.myDeaths++;
        console.log(`[DEBUG] Host (Self) died. Deaths: ${G.myDeaths}, KilledBy: ${G.lastDamageSourceId}`);
        if (!G.peerStats) G.peerStats = new Map();
        const myId = G.myPeerId;
        if (!G.peerStats.has(myId)) G.peerStats.set(myId, { kills: 0, deaths: 0 });
        G.peerStats.get(myId).deaths = G.myDeaths;
        if (G.lastDamageSourceId) {
            if (!G.peerStats.has(G.lastDamageSourceId)) {
                G.peerStats.set(G.lastDamageSourceId, { kills: 0, deaths: 0 });
            }
            G.peerStats.get(G.lastDamageSourceId).kills++;
        }
        G.lastDamageSourceId = null;
        // 全クライアントに配信
        const statsObj = {};
        G.peerStats.forEach((v, k) => { statsObj[k] = v; });
        broadcastEvent(31, { stats: statsObj });
        
        // [NEW] キルログ通知を全員に送信
        broadcastEvent(34, { killerName: killerName, victimName: victimName });

        if (typeof updateScoreboard === 'function') updateScoreboard();
    }

    // 死亡状態を全員に通知（十字架表示のため）
    if (G.isOnline) {
        broadcastEvent(33, { peerId: G.myPeerId, isDead: true });
    }

    updateLifeHUD();

    if (!G.deathTextEl) {
        G.deathTextEl = document.createElement('div');
        G.deathTextEl.style.position = 'absolute';
        G.deathTextEl.style.top = '50%';
        G.deathTextEl.style.left = '50%';
        G.deathTextEl.style.transform = 'translate(-50%, -50%)';
        G.deathTextEl.style.color = '#ff3333';
        G.deathTextEl.style.fontSize = '80px';
        G.deathTextEl.style.fontWeight = '800';
        G.deathTextEl.style.textShadow = '0 0 20px rgba(255,0,0,0.5)';
        G.deathTextEl.style.zIndex = '1000';
        G.deathTextEl.style.pointerEvents = 'none';
        document.body.appendChild(G.deathTextEl);
    }
    G.deathTextEl.innerText = 'YOU DIED';
    G.deathTextEl.style.display = 'block';

    G.playerBody.linearVelocity.set(0, 0, 0);
    // 自機を確実に非表示にする
    const myEnt = G.entities.find(e => e.body === G.playerBody);
    if (myEnt && myEnt.mesh) myEnt.mesh.visible = false;
    // 古い十字架があれば完全に削除・破棄
    if (G.crossMesh) {
        G.scene.remove(G.crossMesh);
        G.crossMesh.traverse(n => { if (n.geometry) n.geometry.dispose(); });
        G.crossMesh = null;
    }
    // 十字架メッシュを新しく生成して配置
    const crossV = new THREE.CylinderGeometry(0.08, 0.08, 1.8, 6);
    const crossH = new THREE.CylinderGeometry(0.08, 0.08, 1.0, 6);
    const crossMat = new THREE.MeshStandardMaterial({ color: 0xdddddd, emissive: 0x888888 });
    const crossVMesh = new THREE.Mesh(crossV, crossMat);
    const crossHMesh = new THREE.Mesh(crossH, crossMat);
    crossHMesh.rotation.z = Math.PI / 2;
    crossHMesh.position.y = 0.4;
    G.crossMesh = new THREE.Group();
    G.crossMesh.add(crossVMesh);
    G.crossMesh.add(crossHMesh);
    G.crossMesh.position.set(G.playerBody.position.x, G.playerBody.position.y, G.playerBody.position.z);
    G.scene.add(G.crossMesh);
}

function respawnPlayer() {
    G.isDead = false;
    if (G.deathTextEl) G.deathTextEl.style.display = 'none';
    // 自機を再表示
    const myEnt = G.entities.find(e => e.body === G.playerBody);
    if (myEnt && myEnt.mesh) myEnt.mesh.visible = true;
    // 十字架をシーンから削除し、ジオメトリを破棄
    if (G.crossMesh && G.scene) {
        G.scene.remove(G.crossMesh);
        G.crossMesh.traverse(n => { if (n.geometry) n.geometry.dispose(); });
        G.crossMesh = null;
    }
    
    // 復活を通知
    if (G.isOnline) {
        broadcastEvent(33, { peerId: G.myPeerId, isDead: false });
    }

    // 無敵開始（5秒）
    G.isInvincible = true;
    G.invincibilityTimer = 5.0;
    if (G.playerBody) {
        G._savedPlayerLayer = G.playerBody.belongsTo;
        G.playerBody.belongsTo = 0;   // 全レイヤーとの物理衝突を無効化
    }

    // プレイヤーメッシュを半透明白にする
    if (G.playerMesh) {
        G._savedMaterials = [];
        G.playerMesh.traverse(n => {
            if (n.isMesh) {
                G._savedMaterials.push({ mesh: n, material: n.material });
                n.material = n.material.clone();
                n.material.color.set(0xffffff);
                n.material.transparent = true;
                n.material.opacity = 0.6;
            }
        });
    }

    // 無敵状態をネットワーク同期
    if (G.isOnline) {
        broadcastEvent(32, { peerId: G.myPeerId, invincible: true });
        broadcastEvent(33, { peerId: G.myPeerId, isDead: false });
    }

    let spawnX, spawnY, spawnZ;

    if (G.currentMode === 'tutorial') {
        spawnX = 1.5;
        spawnY = 5.0;
        spawnZ = 1.5;
    } else {
        // [FIXED] 死んだ瞬間の高度を基準に計算する
        const currentY = G.deathPositionY || G.playerBody.position.y;
        const fallMode = config.deathFallMode || 'none';

        if (fallMode === 'none') {
            spawnX = G.playerBody.position.x;
            spawnY = currentY + 0.5;
            spawnZ = G.playerBody.position.z;
        } else {
            const fallLimit = (fallMode === '50') ? 50 : 25;
            const targetY = Math.max(2.0, currentY - fallLimit);

            // 途中にチェックポイント（膜）があるか探す
            let highestMembraneUnderMe = -1;
            G.membranes.forEach(m => {
                // 自分より下、かつ 落下目標(targetY) より上にある「最も高い膜」
                if (m.y < currentY && m.y >= targetY - 1.0) {
                    if (m.y > highestMembraneUnderMe) {
                        highestMembraneUnderMe = m.y;
                    }
                }
            });

            if (highestMembraneUnderMe !== -1) {
                // 途中に膜があればそこで止まる
                spawnY = highestMembraneUnderMe + 2.0;
            } else {
                // 途中に膜がなければ、予定通り一律落下
                spawnY = targetY;
            }
            spawnX = config.areaSize / 2 + (Math.random() - 0.5) * 2;
            spawnZ = config.areaSize / 2 + (Math.random() - 0.5) * 2;
        }
    }

    G.entities.forEach(ent => {
        ent.currentMembraneY = -Infinity;
        if (ent.dedicatedMembraneFloor) {
            G.world.removeRigidBody(ent.dedicatedMembraneFloor);
            ent.dedicatedMembraneFloor = null;
        }
    });

    G.playerBody.resetPosition(spawnX, spawnY, spawnZ);
    G.playerBody.linearVelocity.set(0, 0, 0);
    G.playerLives = config.maxLives;
    updateLifeHUD();
    logStatus(`リスポーンしました`);
}

// 無敵解除処理（engine.jsのanimate内から毎フレーム呼ぶ）
function updateInvincibility(dt) {
    if (!G.isInvincible) return;
    G.invincibilityTimer -= dt;
    if (G.invincibilityTimer <= 0) {
        G.isInvincible = false;
        G.invincibilityTimer = 0;
        if (G._savedPlayerLayer !== undefined) {
            if (G.playerBody) G.playerBody.belongsTo = G._savedPlayerLayer;
            G._savedPlayerLayer = undefined;
        }
        // マテリアルを復元
        if (G._savedMaterials) {
            G._savedMaterials.forEach(entry => {
                entry.mesh.material = entry.material;
            });
            G._savedMaterials = null;
        }
        // ネットワーク同期
        if (G.isOnline) {
            broadcastEvent(32, { peerId: G.myPeerId, invincible: false });
        }
    }
}

const UPGRADE_POOLS = {
    movement: [
        { id: 'm1', name: "スピード", desc: "速度：ややはやい\n跳躍：ふつう", stats: { playerSpeed: 7.5, jumpVelocity: 2.6, jumpMultiplier: 0.65, holdBoost: 0.38, maxHoldTime: 9 } },
        { id: 'm2', name: "ジャンプ", desc: "速度：ふつう\n跳躍：ややたかい", stats: { playerSpeed: 6.0, jumpVelocity: 3.0, jumpMultiplier: 0.65, holdBoost: 0.38, maxHoldTime: 9 } },
        { id: 'm3', name: "アクロバット", desc: "速度：ふつう\n空中制御：たかい", stats: { playerSpeed: 6.0, jumpVelocity: 2.7, jumpMultiplier: 0.77, holdBoost: 0.38, maxHoldTime: 9 } },
        { id: 'm4', name: "ムーンウォーク", desc: "速度：ふつう\n長押し：ながい", stats: { playerSpeed: 6.0, jumpVelocity: 2.6, jumpMultiplier: 0.65, holdBoost: 0.38, maxHoldTime: 12 } },
        { id: 'm5', name: "バイタリティ", desc: "速度：ふつう\n最大ライフ：＋２", stats: { playerSpeed: 6.0, jumpVelocity: 2.6, jumpMultiplier: 0.65, holdBoost: 0.38, maxHoldTime: 9 }, lifeBoost: 2 }
    ],
    projectile: [
        { id: 'p1', name: "マシンガン", desc: "回復速度：とてもはやい\nダメージ：ちいさい", stats: { projectileRecoveryRate: 20.0, damageProjectile: 1, projectileSpeed: 20.0, projectileAutoFire: true, projectileRangeMult: 0.5, projectileRadiusMult: 0.4} },
        { id: 'p2', name: "ハヤイ", desc: "弾速：とてもはやい\nダメージ：おおきい", stats: { projectileRecoveryRate: 1.0, damageProjectile: 2, projectileSpeed: 45.0, projectileRangeMult: 2.0 } },
        { id: 'p3', name: "キャノン", desc: "右クリックでスコープ\nスコープ中のみ発射可能\nダメージ：とてもおおきい", stats: { projectileRecoveryRate: 0.33, damageProjectile: 5, projectileSpeed: 20.0, projectileRadiusMult: 2.0, projectileRequiresScope: true, maxProjectileStock: 2.0 } },
        { id: 'p4', name: "マガジン", desc: "最大装弾数が\n2発増加する", stats: { projectileRecoveryRate: 1.0, damageProjectile: 1, projectileSpeed: 20.0, maxProjectileStock: 4.0 } },
        { id: 'p5', name: "ブロック", desc: "弾のサイズが大きく\nダメージも少し高い", stats: { projectileRecoveryRate: 1.0, damageProjectile: 2, projectileSpeed: 15.0, projectileRadiusMult: 1.6 } },
        { id: 'p6', name: "ブンレツ", desc: "弾が斜め2方向に\n分裂して飛ぶ", stats: { projectileRecoveryRate: 1.0, damageProjectile: 1, projectileSpeed: 20.0, projectileSplit: 2 } },
        { id: 'p7', name: "サンタク", desc: "弾が正面と斜めの\n3方向に飛ぶ", stats: { projectileRecoveryRate: 1.0, damageProjectile: 1, projectileSpeed: 20.0, projectileSplit: 3 } },
        { id: 'p8', name: "バラマキ", desc: "周囲12方向に\n弾をばらまく", stats: { projectileRecoveryRate: 1.0, damageProjectile: 1, projectileSpeed: 20.0, projectileSplit: 12 } },
        { id: 'p9', name: "トゲ", desc: "弾が壁を\n貫通する", stats: { projectileRecoveryRate: 1.0, damageProjectile: 1, projectileSpeed: 25.0, projectilePassWall: true, projectileIsNeedle: true } },
        { id: 'p10', name: "ミサイル", desc: "高速の弾が\n壁を貫通する", stats: { projectileRecoveryRate: 1.0, damageProjectile: 1, projectileSpeed: 35.0, projectilePassWall: true, projectileIsNeedle: true } },
        { id: 'p11', name: "バウンド", desc: "壁で2回まで\n跳ね返る弾", stats: { projectileRecoveryRate: 1.0, damageProjectile: 1, projectileSpeed: 20.0, projectileBounces: 2 } },
        { id: 'p12', name: "ナガイ", desc: "弾の射程が\n大幅に伸びる", stats: { projectileRecoveryRate: 1.0, damageProjectile: 1, projectileSpeed: 20.0, projectileRangeMult: 3.0, projectileRequiresScope: false } }
    ],
    bubble: [
        { id: 'b1', name: "シャワー", desc: "回復速度：とてもはやい\nダメージ：ちいさい", stats: { bubbleRecoveryRate: 0.216, damageBubble: 1, bubbleSpeedY: 5.0 } },
        { id: 'b2', name: "ヘビー", desc: "上昇速度：おそい\nダメージ：とてもおおきい", stats: { bubbleRecoveryRate: 0.108, damageBubble: 5, bubbleSpeedY: 2.8 } },
        { id: 'b3', name: "ロケット", desc: "上昇速度：とてもはやい\nダメージ：ふつう", stats: { bubbleRecoveryRate: 0.108, damageBubble: 2, bubbleSpeedY: 10.0 } },
        { id: 'b4', name: "スロー", desc: "上昇速度：とてもおそい\nじっくりと浮上", stats: { bubbleRecoveryRate: 0.108, damageBubble: 2, bubbleSpeedY: 2.0 } },
        { id: 'b5', name: "ツイン", desc: "シャボン玉を\n同時に2発撃つ", stats: { bubbleRecoveryRate: 0.108, damageBubble: 2, bubbleSpeedY: 5.0, bubbleSplit: 2 } },
        { id: 'b6', name: "ダメージ", desc: "シャボン玉の\nダメージが大幅増加", stats: { bubbleRecoveryRate: 0.108, damageBubble: 4, bubbleSpeedY: 5.0 } },
        { id: 'b7', name: "クイック", desc: "シャボン玉の\nリロード速度向上", stats: { bubbleRecoveryRate: 0.135, damageBubble: 2, bubbleSpeedY: 5.0 } },
        { id: 'b8', name: "カホル", desc: "シャボン玉を\n同時に4発撃つ", stats: { bubbleRecoveryRate: 0.135, damageBubble: 2, bubbleSpeedY: 5.0, bubbleSplit: 4 } },
        { id: 'b9', name: "ダンゴ", desc: "シャボン玉を\n団子状に撃つ", stats: { bubbleRecoveryRate: 0.133, damageBubble: 3, bubbleSpeedY: 3.0, bubbleSplit: 3 } }
    ]
};

let currentUpgradeOptions = [];
let rewardScreenKeydownHandler = null;

function showRewardScreen() {
    const screen = document.getElementById('reward-screen');
    if (!screen) return;
    
    // Pick one random from each category
    const m = UPGRADE_POOLS.movement[Math.floor(Math.random() * UPGRADE_POOLS.movement.length)];
    const p = UPGRADE_POOLS.projectile[Math.floor(Math.random() * UPGRADE_POOLS.projectile.length)];
    const b = UPGRADE_POOLS.bubble[Math.floor(Math.random() * UPGRADE_POOLS.bubble.length)];
    
    const OMAKE_OPTIONS = [
        { text: "おまけなし", type: "none" },
        { text: "おまけでライフ", type: "life" },
        { text: "おまけなし", type: "none" }
    ];

    currentUpgradeOptions = [m, p, b].map(opt => ({
        ...opt,
        omake: OMAKE_OPTIONS[Math.floor(Math.random() * OMAKE_OPTIONS.length)]
    }));
    
    const container = document.getElementById('reward-options-container');
    if (container) {
        container.innerHTML = '';
        currentUpgradeOptions.forEach((opt, index) => {
            const num = index + 1;
            const html = `
                <div class="reward-option" onclick="applyUpgrade(${index})" style="width: 260px; height: 320px; padding: 30px 20px; background: #22222d; border: 1px solid #ffcccc; text-align: center; cursor: pointer; transition: 0.2s; position: relative; display: flex; flex-direction: column; justify-content: space-between;">
                    <div style="font-size: 22px; font-weight: normal; color: #fff; letter-spacing: 2px;">${opt.name}</div>
                    <div style="font-size: 16px; color: #fff; line-height: 2.2; font-weight: normal; margin-top: auto; margin-bottom: auto; white-space: pre-wrap;">${opt.desc}</div>
                    <div style="font-size: 15px; color: #fff; font-weight: normal;">${opt.omake.text}</div>
                </div>
            `;
            container.innerHTML += html;
        });
    }
    
    screen.classList.remove('hidden');
    G.isRewarding = true;
    // G.isStarted = false; // 時間を止めない
    // if (G.controls) G.controls.unlock(); // カメラ操作を維持
    
    screen.style.pointerEvents = 'none'; // マウスロック中なのでクリック不可（キー選択のみ）
    
    if (!rewardScreenKeydownHandler) {
        rewardScreenKeydownHandler = (e) => {
            if (screen.classList.contains('hidden')) return;
            if (e.key === '1') applyUpgrade(0);
            if (e.key === '2') applyUpgrade(1);
            if (e.key === '3') applyUpgrade(2);
        };
        window.addEventListener('keydown', rewardScreenKeydownHandler);
    }
}

window.applyUpgrade = function(index) {
    const screen = document.getElementById('reward-screen');
    if (screen) screen.classList.add('hidden');
    G.isRewarding = false;
    
    const opt = currentUpgradeOptions[index];
    if (opt) {
        if (opt.id.startsWith('m')) {
            config.playerSpeed = 6.0;
            config.jumpVelocity = 2.6;
            config.jumpMultiplier = 0.65;
            config.holdBoost = 0.38;
            config.maxHoldTime = 9;
        } else if (opt.id.startsWith('p')) {
            config.projectileRecoveryRate = 1.0;
            config.damageProjectile = 1;
            config.projectileSpeed = 20.0;
            config.maxProjectileStock = 2.0;
            config.projectileRadiusMult = 1.0;
            config.projectileSplit = 1;
            config.projectilePassWall = false;
            config.projectileBounces = 0;
            config.projectileRangeMult = 1.0;
            config.projectileAutoFire = false;
            config.projectileIsNeedle = false;
            config.projectileRequiresScope = false;
        } else if (opt.id.startsWith('b')) {
            config.bubbleRecoveryRate = 0.108;
            config.damageBubble = 2;
            config.bubbleSpeedY = 5.0;
            config.maxBubbleStock = 2;
            config.bubbleSplit = 1;
        }

        for (const [key, value] of Object.entries(opt.stats)) {
            config[key] = value;
        }

        if (opt.lifeBoost) {
            config.maxLives += opt.lifeBoost;
            G.playerLives += opt.lifeBoost;
        }

        if (opt.omake.type === 'life') {
            G.playerLives++;
        }
        
        updateLifeHUD();
        updateAmmoHUD();
        
        // Update active upgrade display
        if (opt.id.startsWith('m')) {
            const el = document.getElementById('upg-move');
            if (el) el.textContent = `MOVE: ${opt.name}`;
        } else if (opt.id.startsWith('p')) {
            const el = document.getElementById('upg-proj');
            if (el) el.textContent = `PROJ: ${opt.name}`;
        } else if (opt.id.startsWith('b')) {
            const el = document.getElementById('upg-bubb');
            if (el) el.textContent = `BUBB: ${opt.name}`;
        }
    }
    
}

function showNotification(msg) {
    const notif = document.createElement('div');
    notif.style.position = 'absolute';
    notif.style.top = '20%';
    notif.style.left = '50%';
    notif.style.transform = 'translateX(-50%)';
    notif.style.padding = '10px 20px';
    notif.style.background = 'rgba(0,0,0,0.7)';
    notif.style.color = '#fff';
    notif.style.borderRadius = '20px';
    notif.style.fontSize = '14px';
    notif.style.fontWeight = 'bold';
    notif.style.border = '1px solid rgba(255,255,255,0.2)';
    notif.style.zIndex = '3000';
    notif.innerText = msg;
    document.body.appendChild(notif);
    
    setTimeout(() => {
        notif.style.transition = 'opacity 0.5s, transform 0.5s';
        notif.style.opacity = '0';
        notif.style.transform = 'translateX(-50%) translateY(-20px)';
        setTimeout(() => notif.remove(), 500);
    }, 2000);
}

function initGUI() {
    const gui = new dat.GUI();
    gui.domElement.style.display = 'none'; // デフォルトで非表示
    document.addEventListener('keydown', (e) => {
        if (e.key === '^') {
            gui.domElement.style.display = gui.domElement.style.display === 'none' ? 'block' : 'none';
        }
    });

    const fEnv = gui.addFolder('Environment');
    const envSettings = {
        exposure: G.renderer.toneMappingExposure,
        ambient: G.ambientLight.intensity,
        sun: G.d1.intensity
    };
    fEnv.add(envSettings, 'exposure', 0.0, 3.0).name('Exposure').onChange(v => {
        G.renderer.toneMappingExposure = v;
    });
    fEnv.add(envSettings, 'ambient', 0.0, 2.0).name('Ambient').onChange(v => {
        G.ambientLight.intensity = v;
    });
    fEnv.add(envSettings, 'sun', 0.0, 2.0).name('Sun (D-Lights)').onChange(v => {
        G.d1.intensity = G.d2.intensity = G.d3.intensity = G.d4.intensity = v;
    });
    fEnv.open();

    const fMove = gui.addFolder('Move');
    fMove.add(config, 'playerSpeed', 1.0, 20.0).name('Speed');
    fMove.add(config, 'mouseSensitivity', 0.1, 5.0).step(0.05).name('Sensitivity');
    fMove.open();

    const fJump = gui.addFolder('Jump');
    fJump.add(config, 'jumpVelocity', 1.0, 25.0).name('Power');
    fJump.add(config, 'jumpMultiplier', 0.1, 1.5).name('Air Multi');
    fJump.add(config, 'holdBoost', 0.0, 1.0).name('Hold Boost');
    fJump.add(config, 'maxHoldTime', 0, 60).step(1).name('Max Hold');
    fJump.open();

    const fWorld = gui.addFolder('World');
    fWorld.add(config, 'gravity', -50.0, -1.0).name('Gravity').onChange(v => {
        if (G.world) G.world.gravity.set(0, v, 0);
    });
    fWorld.open();

    const fDebug = gui.addFolder('Debug');
    fDebug.add(config, 'showHitboxes').name('Show Hitboxes');
    
    const testActions = {
        showRandomReward: () => showRewardScreen()
    };
    const fRewards = fDebug.addFolder('Test Rewards');
    fRewards.add(testActions, 'showRandomReward').name('Open Reward Screen');
    
    ['movement', 'projectile', 'bubble'].forEach(category => {
        const catFolder = fRewards.addFolder(category.toUpperCase());
        UPGRADE_POOLS[category].forEach(opt => {
            testActions[opt.id] = () => {
                currentUpgradeOptions = [ { ...opt, omake: { text: "DEBUG TEST", type: "none" } } ];
                applyUpgrade(0);
            };
            catFolder.add(testActions, opt.id).name(opt.name);
        });
    });
    
    fDebug.open();
}
