// ═══════════════════════════════════════════════════════
//  roguelike.js — ローグライクモード（32ステージ制）
// ═══════════════════════════════════════════════════════
'use strict';

const ROGUE_AREA = 20;

const RogueState = {
    stage: 0,
    maxStages: 32,
    enemies: [],
    enemiesAlive: 0,
    isActive: false,
    stageClearTimer: 0,
    isStageClearShowing: false,
    isVictory: false,
};

// 敵タイプ定義
const ENEMY_TYPES = [
    { name: 'Idle',       color: 0xff4444, speed: 0,   behavior: 'idle' },
    { name: 'Patrol',     color: 0xffcc00, speed: 2.0, behavior: 'patrol' },
    { name: 'Chase',      color: 0xaa44ff, speed: 1.5, behavior: 'chase' },
    { name: 'Shooter',    color: 0x00ff88, speed: 0.8, behavior: 'shooter' },
    { name: 'HorizMover', color: 0xff8800, speed: 3.0, behavior: 'horiz' },
    { name: 'VertMover',  color: 0x00aaff, speed: 3.0, behavior: 'vert' },
    { name: 'Shield',     color: 0xcccccc, speed: 1.2, behavior: 'shield', minStage: 4 },
    { name: 'Spinner',    color: 0xff00ff, speed: 0,   behavior: 'spinner', minStage: 6 },
    { name: 'Diver',      color: 0xffff00, speed: 0,   behavior: 'diver', minStage: 8 },
    { name: 'ZPatrol',    color: 0xcccc00, speed: 3.0, behavior: 'zpatrol', minStage: 2 },
    { name: 'Bouncer',    color: 0xffffff, speed: 5.0, behavior: 'bouncer', minStage: 5 },
    { name: 'Dasher',     color: 0xff2222, speed: 12.0,behavior: 'dasher', minStage: 7 },
    { name: 'SantaBomber',color: 0xff88aa, speed: 1.0, behavior: 'santabomber', minStage: 9 },
    { name: 'VertBomber', color: 0xaa88ff, speed: 1.0, behavior: 'vertsantabomber', minStage: 9 },
    { name: 'OrbitShield',color: 0x44cc44, speed: 0,   behavior: 'orbitshield', minStage: 5 },
    { name: 'Sniper',     color: 0xff44aa, speed: 0,   behavior: 'sniper', minStage: 3 },
    { name: '3DCharge',   color: 0xff6600, speed: 15.0,behavior: '3dcharge', minStage: 10 },
    { name: 'YChaser4Way',color: 0x00ffcc, speed: 2.0, behavior: 'ychaser4way', minStage: 11 },
    { name: 'YSpinner',   color: 0xcc00ff, speed: 2.5, behavior: 'yspinner', minStage: 12 },
    { name: 'Diver8Way',  color: 0xffff88, speed: 0,   behavior: 'diver8way', minStage: 13 },
    { name: '3WaySlowBomber', color: 0x88ffff, speed: 1.5, behavior: '3wayslowbomber', minStage: 10 },
];

// ── ローグライク用マップ生成 ──
function buildRoguelikeMap() {
    // 既存のマップがあれば削除
    if (RogueState.mapMesh) {
        G.scene.remove(RogueState.mapMesh);
        RogueState.mapMesh = null;
    }
    if (RogueState.mapBodies) {
        RogueState.mapBodies.forEach(b => {
            try { G.world.removeRigidBody(b); } catch (e) {}
        });
        RogueState.mapBodies = [];
    } else {
        RogueState.mapBodies = [];
    }
    G.mapGrid.clear(); // 既存のグリッドをクリア

    const positionsSet = new Set();
    const positions = [];

    const addPos = (x, y, z) => {
        const key = `${x},${y},${z}`;
        if (!positionsSet.has(key) && x >= 0 && x < ROGUE_AREA && z >= 0 && z < ROGUE_AREA) {
            positionsSet.add(key);
            positions.push({ x, y, z });
        }
    };

    // 1. 床面全体を配置 (y=0)
    for (let x = 0; x < ROGUE_AREA; x++) {
        for (let z = 0; z < ROGUE_AREA; z++) {
            addPos(x, 0, z);
        }
    }

    // 2. 空間全体(20x7x20)に対して密度0.03でブロックを配置
    for (let x = 0; x < ROGUE_AREA; x++) {
        for (let y = 1; y <= 7; y++) {
            for (let z = 0; z < ROGUE_AREA; z++) {
                if (Math.random() < 0.03) {
                    addPos(x, y, z);
                }
            }
        }
    }

    // 3. インスタンスメッシュと物理ボディを構築
    if (positions.length > 0) {
        const instMesh = new THREE.InstancedMesh(G.sharedBlockGeo, G.sharedBlockMat, positions.length);
        instMesh.castShadow = true;
        instMesh.receiveShadow = true;
        const dummy = new THREE.Object3D();

        positions.forEach((p, idx) => {
            const body = G.world.add({
                type: 'box', size: [1, 1, 1],
                pos: [p.x + 0.5, p.y + 0.5, p.z + 0.5],
                move: false, friction: 0.3, restitution: 0.0,
                belongsTo: 1, collidesWith: ~0
            });
            RogueState.mapBodies.push(body);

            dummy.position.set(p.x + 0.5, p.y + 0.5, p.z + 0.5);
            dummy.updateMatrix();
            instMesh.setMatrixAt(idx, dummy.matrix);

            G.mapGrid.set(`${p.x},${p.y},${p.z}`, {
                mesh: { visible: true }, // 本来はMesh参照だがローグライクではダミー
                position: new THREE.Vector3(p.x + 0.5, p.y + 0.5, p.z + 0.5)
            });
        });

        G.scene.add(instMesh);
        RogueState.mapMesh = instMesh;
    }
}

// ── ローグライクモード開始 ──
function startRoguelike() {
    RogueState.stage = 0;
    RogueState.enemies = [];
    RogueState.enemiesAlive = 0;
    RogueState.isActive = true;
    RogueState.stageClearTimer = 0;
    RogueState.isStageClearShowing = false;
    RogueState.isVictory = false;
    spawnStageEnemies(0);
    updateRogueHUD();
}

// ── 敵スポーン ──
function spawnStageEnemies(stageNumber) {
    // 前ステージの敵と地形を削除・再生成
    clearRogueEnemies();
    if (stageNumber % 4 === 0) {
        buildRoguelikeMap();
    }

    // ステージに応じた敵タイプフィルタ
    const available = ENEMY_TYPES.filter(t => !t.minStage || stageNumber >= t.minStage);

    let enemyCount = 0;
    let isBossStage = false;
    let bossType = '';

    if (stageNumber === 7) {
        isBossStage = true;
        enemyCount = 1;
        bossType = 'bossstage8';
    } else if (stageNumber === 15) {
        isBossStage = true;
        enemyCount = 1;
        bossType = 'bossstage16';
    } else if (stageNumber === 23) {
        isBossStage = true;
        enemyCount = 1;
        bossType = 'bossstage24';
    } else if (stageNumber === 31) {
        isBossStage = true;
        enemyCount = 1;
        bossType = 'bossstage32';
    } else {
        // 湧く数: 3~7体スタート、16ステージごとにベースが1ずつ増加
        const wave = Math.floor(stageNumber / 16);
        const minCount = 3 + wave;
        const maxCount = 7 + wave;
        enemyCount = minCount + Math.floor(Math.random() * (maxCount - minCount + 1));
    }
    
    RogueState.enemiesAlive = enemyCount;

    for (let i = 0; i < enemyCount; i++) {
        let type;
        if (isBossStage) {
            type = { name: 'Boss', color: 0xff0000, speed: 4.0, behavior: bossType };
        } else {
            const typeIdx = Math.floor(Math.random() * available.length);
            type = available[typeIdx];
        }

        // ランダムな位置（プレイヤーの初期位置 10,10 から離して）
        let sx, sz, blockY = 0;
        
        if (type.behavior === 'sniper') {
            // スナイパーは3箇所試して一番高い場所を選ぶ（完全な最高地点である必要はない）
            let bestY = -1;
            for(let k=0; k<3; k++) {
                let tx, tz, ty = 0;
                do {
                    tx = Math.floor(1 + Math.random() * (ROGUE_AREA - 2));
                    tz = Math.floor(1 + Math.random() * (ROGUE_AREA - 2));
                } while (Math.abs(tx - 10) < 3 && Math.abs(tz - 10) < 3);
                for (let y = 15; y >= 0; y--) {
                    if (G.mapGrid.has(`${tx},${y},${tz}`)) { ty = y; break; }
                }
                if (ty > bestY) {
                    bestY = ty; sx = tx; sz = tz; blockY = ty;
                }
            }
        } else {
            // 通常の敵スポーン
            do {
                sx = Math.floor(1 + Math.random() * (ROGUE_AREA - 2));
                sz = Math.floor(1 + Math.random() * (ROGUE_AREA - 2));
            } while (Math.abs(sx - 10) < 3 && Math.abs(sz - 10) < 3);
            for (let y = 15; y >= 0; y--) {
                if (G.mapGrid.has(`${sx},${y},${sz}`)) { blockY = y; break; }
            }
        }

        const sy = (type.behavior === 'diver') ? blockY + 8.0 : 
                   (type.behavior === 'santabomber' || type.behavior === 'vertsantabomber') ? blockY + 3.0 : blockY + 1.5;

        // メッシュ生成
        const mat = new THREE.MeshStandardMaterial({
            color: type.color,
            emissive: new THREE.Color(type.color).multiplyScalar(0.3),
            metalness: 0.5,
            roughness: 0.4
        });

        const isBoss = isBossStage; // ボス全般
        const bSize = isBoss ? 0.9 : 0.6;
        let bodyMesh;

        let specificModel = G.enemyModels && G.enemyModels[type.behavior];
        let useOriginalColors = false;
        if (type.behavior === 'bossstage32') {
            specificModel = G.playerModel; // プレイヤーモデルを使用
            useOriginalColors = true; // 色をそのままにする
        }

        if (specificModel) {
            bodyMesh = specificModel.clone();
            if (type.behavior === 'bossstage32') {
                bodyMesh.scale.set(0.175, 0.175, 0.175); // プレイヤーのスケールに合わせる
                // 自機のマテリアルを汚染しないようにディープクローン
                bodyMesh.traverse(n => {
                    if (n.isMesh && n.material) {
                        n.material = n.material.clone();
                    }
                });
            } else {
                bodyMesh.traverse(n => {
                    if (n.isMesh && n.material) {
                        n.material = n.material.clone();
                        n.material.color = mat.color;
                        n.material.emissive = mat.emissive;
                        n.material.emissiveIntensity = mat.emissiveIntensity;
                    }
                });
            }
        } else {
            bodyMesh = new THREE.Mesh(new THREE.BoxGeometry(bSize, bSize, bSize), mat);
        }
        bodyMesh.castShadow = true;

        let mesh;
        if (type.behavior === 'shield' || type.behavior === 'orbitshield' || isBoss) {
            mesh = new THREE.Group();
            mesh.add(bodyMesh);

            if (type.behavior === 'shield') {
                const shieldMat = new THREE.MeshStandardMaterial({
                    color: 0x4488ff, emissive: 0x2244aa, metalness: 0.9, roughness: 0.1,
                    transparent: true, opacity: 0.8, side: THREE.DoubleSide
                });
                const shieldMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.9), shieldMat);
                shieldMesh.position.z = 0.4;
                shieldMesh.name = 'shield';
                mesh.add(shieldMesh);
            } else if (type.behavior === 'bossstage8') {
                const shieldMat = new THREE.MeshStandardMaterial({
                    color: 0x4488ff, emissive: 0x2244aa, metalness: 0.9, roughness: 0.1,
                    transparent: true, opacity: 0.8, side: THREE.DoubleSide
                });
                const shieldMesh = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.5), shieldMat);
                shieldMesh.position.z = 0.6; 
                shieldMesh.name = 'shield';
                mesh.add(shieldMesh);
                const stickMat = new THREE.MeshStandardMaterial({ color: 0x884400, roughness: 0.8 });
                const stickMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 2.0), stickMat);
                stickMesh.position.set(0.6, 0.5, 0);
                stickMesh.rotation.x = Math.PI / 2;
                stickMesh.name = 'stick';
                mesh.add(stickMesh);
            } else if (type.behavior === 'bossstage16') {
                bodyMesh.traverse(n => { if (n.isMesh) { n.material.color.setHex(0x00ffff); n.material.emissive.setHex(0x004488); }});
            } else if (type.behavior === 'bossstage24') {
                bodyMesh.traverse(n => { if (n.isMesh) { n.material.color.setHex(0xff00ff); n.material.emissive.setHex(0x880088); }});
            } else if (type.behavior === 'bossstage32') {
                bodyMesh.traverse(n => { if (n.isMesh) { n.material.color.setHex(0x222222); n.material.emissive.setHex(0xddaa00); n.material.emissiveIntensity = 0.5; }});
            }
        } else {
            mesh = new THREE.Group();
            mesh.add(bodyMesh);
        }

        // 透視（X-Ray）用のメッシュを追加
        if (typeof addXrayMeshToModel === 'function') {
            addXrayMeshToModel(mesh, 0xffaa33, bodyMesh);
        }

        mesh.position.set(sx, sy, sz);
        G.scene.add(mesh);

        // 物理ボディ（GLBバウンディングボックスまたはデフォルトに合わせる）
        let pSize = [bSize, bSize, bSize];
        let pOffset = null;
        if (specificModel && type.behavior !== 'bossstage32' && G.enemyModelInfo && G.enemyModelInfo[type.behavior]) {
            const info = G.enemyModelInfo[type.behavior];
            pSize = [info.size.x || bSize, info.size.y || bSize, info.size.z || bSize];
            pOffset = [info.center.x, info.center.y, info.center.z];
        }

        const bodyX = pOffset ? sx + pOffset[0] : sx;
        const bodyY = pOffset ? sy + pOffset[1] : sy;
        const bodyZ = pOffset ? sz + pOffset[2] : sz;

        const body = G.world.add({
            type: 'box',
            size: pSize,
            pos: [bodyX, bodyY, bodyZ],
            move: true,
            belongsTo: 1 << 22,   // 敵専用レイヤー
            collidesWith: 1 | PROJECTILE_LAYER | BUBBLE_LAYER,
            density: 1,
            friction: 0.5,
            restitution: 0.1
        });
        body.allowSleep = false;

        // パトロール用の往復ポイント
        const patrolA = { x: sx, z: sz };
        const patrolB = {
            x: Math.max(1, Math.min(ROGUE_AREA - 1, sx + (Math.random() - 0.5) * 8)),
            z: Math.max(1, Math.min(ROGUE_AREA - 1, sz + (Math.random() - 0.5) * 8))
        };

        const enemy = {
            mesh,
            body,
            pOffset,
            type: type.behavior,
            speed: type.speed,
            hp: (type.behavior === 'bossstage32') ? 5 : 1,
            alive: true,
            patrolA,
            patrolB,
            patrolTarget: 'B',
            idlePhase: Math.random() * Math.PI * 2,
            // Shooter / Spinner用
            canFireTime: Date.now() + 2000,
            lastFireTime: 0,
            fireCooldown: 2000 + Math.random() * 1500,
            // HorizMover用
            horizDir: (Math.random() < 0.5) ? 1 : -1,
            // VertMover用
            vertDir: (Math.random() < 0.5) ? 1 : -1,
            // 接触ダメージクールダウン
            contactCooldown: 0,
            // Shield用: ゆっくり回転する角度
            facingAngle: Math.random() * Math.PI * 2,
            // Spinner用: 回転角度
            spinAngle: 0,
            spinFireInterval: 200, // 0.2秒ごとに弾
            // Diver用: 上空待機 → 急降下
            diverState: 'hovering', // 'hovering' | 'diving' | 'returning'
            diverTimer: 2.0 + Math.random() * 3.0,
            diverHomeY: 8.0,
            diverSpawnX: sx,
            diverSpawnZ: sz,
            // Bouncer用
            bounceVX: (Math.random() < 0.5 ? 1 : -1) * (0.5 + Math.random() * 0.5),
            bounceVZ: (Math.random() < 0.5 ? 1 : -1) * (0.5 + Math.random() * 0.5),
            // Dasher, 3DCharge用
            dasherState: 'waiting', // 'waiting' | 'dashing'
            dasherTimer: 1.0 + Math.random() * 1.0,
            dashDirX: 0,
            dashDirY: 0,
            dashDirZ: 0,
            // ZPatrol用
            zPatrolCenter: sz,
            zPatrolPhase: Math.random() * Math.PI * 2,
            // OrbitShield, Boss24, Boss32用
            orbiters: [],
            orbitPhase: 0,
            // BossStage8用
            bossState: 'hopping', // 'hopping' | 'shooting' | 'dashing'
            bossTimer: 2.0,
            bossStickPhase: 0,
            // Boss16 (OrbitBoss)用
            orbitersH: [],
            orbitersV: [],
            // Boss24 (TrapBoss)用
            trapTapes: [],
            // Boss32 (GravityBoss)用
            gravState: 'combat', // 'combat' | 'reloading' | 'diving' | 'pounding'
            bossAmmo: 20,
            bossMode: 'missile', // 'missile' | 'shower'
            reloadTimer: 0,
            evadeTimer: 0,
            evadeDirX: 0, evadeDirZ: 0,
            targetBlockPos: null, // 遮蔽物への移動用
            // YChaser4Way, YSpinner, 3WaySlowBomber用
            yPhase: Math.random() * Math.PI * 2,
            burstCount: 0,
            burstTimer: 0,
            // Hover logic用
            spawnY: sy,
        };

        if (type.behavior === 'diver' || type.behavior === 'diver8way') {
            enemy.diverHomeY = blockY + 8.0;
        }

        if (type.behavior === 'orbitshield' || type.behavior === 'bossstage24') {
            for (let j = 0; j < 4; j++) {
                const orbMat = new THREE.MeshStandardMaterial({
                    color: (type.behavior === 'bossstage24') ? 0xff00ff : (type.behavior === 'bossstage32') ? 0xddaa00 : 0x2288ff,
                    emissive: (type.behavior === 'bossstage24') ? 0x880088 : (type.behavior === 'bossstage32') ? 0x886600 : 0x1144aa, 
                    roughness: 0.2, metalness: 0.8
                });
                const size = (type.behavior === 'orbitshield') ? 0.3 : 0.5;
                const orbMesh = new THREE.Mesh(new THREE.SphereGeometry(size, 8, 8), orbMat);
                G.scene.add(orbMesh);
                const orbBody = G.world.add({
                    type: 'sphere', size: [size], pos: [sx, sy, sz], move: true,
                    belongsTo: 1 << 22,
                    collidesWith: 1 | PROJECTILE_LAYER | BUBBLE_LAYER,
                    density: 0.5, friction: 0.1, restitution: 0.8
                });
                orbBody.allowSleep = false;
                enemy.orbiters.push({ mesh: orbMesh, body: orbBody, angleOffset: (Math.PI / 2) * j });
            }
        } else if (type.behavior === 'bossstage16') {
            // Boss16: 4つの水平オービター、4つの垂直オービター
            for (let j = 0; j < 4; j++) {
                const orbMat = new THREE.MeshStandardMaterial({ color: 0x00ffff, emissive: 0x004488, roughness: 0.2, metalness: 0.8 });
                const orbMeshH = new THREE.Mesh(new THREE.SphereGeometry(0.4, 8, 8), orbMat);
                const orbMeshV = new THREE.Mesh(new THREE.SphereGeometry(0.4, 8, 8), orbMat);
                G.scene.add(orbMeshH); G.scene.add(orbMeshV);
                
                const addOrbBody = () => {
                    const b = G.world.add({
                        type: 'sphere', size: [0.4], pos: [sx, sy, sz], move: true,
                        belongsTo: 1 << 22, collidesWith: 1 | PROJECTILE_LAYER | BUBBLE_LAYER,
                        density: 0.5, friction: 0.1, restitution: 0.8
                    });
                    b.allowSleep = false;
                    return b;
                };
                enemy.orbitersH.push({ mesh: orbMeshH, body: addOrbBody(), angleOffset: j * (Math.PI / 2) });
                enemy.orbitersV.push({ mesh: orbMeshV, body: addOrbBody(), angleOffset: j * (Math.PI / 2) });
            }
        }

        // Bouncerの初期速度を正規化
        if (enemy.type === 'bouncer') {
            const mag = Math.sqrt(enemy.bounceVX**2 + enemy.bounceVZ**2);
            enemy.bounceVX = (enemy.bounceVX / mag) * enemy.speed;
            enemy.bounceVZ = (enemy.bounceVZ / mag) * enemy.speed;
        }

        RogueState.enemies.push(enemy);
    }
}

// ── 敵の削除 ──
function clearRogueEnemies() {
    RogueState.enemies.forEach(e => {
        if (e.mesh && G.scene) G.scene.remove(e.mesh);
        if (e.body && G.world) {
            try { G.world.removeRigidBody(e.body); } catch (_) {}
        }
        if (e.orbiters) {
            e.orbiters.forEach(orb => {
                if (orb.mesh && G.scene) G.scene.remove(orb.mesh);
                if (orb.body && G.world) try { G.world.removeRigidBody(orb.body); } catch (_) {}
            });
        }
        if (e.orbitersH) {
            e.orbitersH.forEach(orb => {
                if (orb.mesh && G.scene) G.scene.remove(orb.mesh);
                if (orb.body && G.world) try { G.world.removeRigidBody(orb.body); } catch (_) {}
            });
        }
        if (e.orbitersV) {
            e.orbitersV.forEach(orb => {
                if (orb.mesh && G.scene) G.scene.remove(orb.mesh);
                if (orb.body && G.world) try { G.world.removeRigidBody(orb.body); } catch (_) {}
            });
        }
        if (e.trapTapes) {
            e.trapTapes.forEach(t => {
                if (t.mesh && G.scene) {
                    G.scene.remove(t.mesh);
                    t.mesh.geometry.dispose();
                    t.mesh.material.dispose();
                }
            });
        }
    });
    RogueState.enemies = [];
    RogueState.enemiesAlive = 0;
    // 敵弾丸もクリア
    if (RogueState.enemyBullets) {
        RogueState.enemyBullets.forEach(b => {
            if (b.mesh && G.scene) {
                G.scene.remove(b.mesh);
                b.mesh.geometry.dispose();
                b.mesh.material.dispose();
            }
        });
        RogueState.enemyBullets = [];
    }
}

// ── 敵AI更新（毎フレーム呼ばれる） ──
function updateRogueEnemies(dt) {
    if (!RogueState.isActive) return;

    // ステージクリア演出中
    if (RogueState.isStageClearShowing) {
        RogueState.stageClearTimer -= dt;
        if (RogueState.stageClearTimer <= 0) {
            RogueState.isStageClearShowing = false;
            hideRogueStageClear();
            if (RogueState.isVictory) {
                showRogueVictory();
                return;
            }
            // 4ステージごとの報酬
            if (RogueState.pendingReward) {
                RogueState.pendingReward = false;
                if (typeof showRewardScreen === 'function') {
                    showRewardScreen();
                    // 報酬選択後に次ステージを開始するコールバック設定
                    RogueState.afterReward = () => {
                        spawnStageEnemies(RogueState.stage);
                        updateRogueHUD();
                    };
                    return;
                }
            }
            spawnStageEnemies(RogueState.stage);
            updateRogueHUD();
        }
        return;
    }

    if (!G.playerBody) return;
    const px = G.playerBody.position.x;
    const py = G.playerBody.position.y + 0.5; // 自機の少し上を狙う
    const pz = G.playerBody.position.z;

    // 敵弾丸の更新
    updateRogueEnemyBullets(dt);

    for (let i = 0; i < RogueState.enemies.length; i++) {
        const e = RogueState.enemies[i];
        if (!e.alive) continue;

        const bp = e.body.position;
        const bv = e.body.linearVelocity;

        // 位置クランプ（エリア外に出さない）
        if (bp.x < 0.5) { bp.x = 0.5; bv.x = 0; }
        if (bp.x > ROGUE_AREA - 0.5) { bp.x = ROGUE_AREA - 0.5; bv.x = 0; }
        if (bp.z < 0.5) { bp.z = 0.5; bv.z = 0; }
        if (bp.z > ROGUE_AREA - 0.5) { bp.z = ROGUE_AREA - 0.5; bv.z = 0; }

        // 回転防止
        if (e.body.quaternion) e.body.quaternion.set(0, 0, 0, 1);
        if (e.body.angularVelocity) {
            e.body.angularVelocity.x = 0;
            e.body.angularVelocity.y = 0;
            e.body.angularVelocity.z = 0;
        }

        // AIの速度設定を反映させるために強制的にスリープ解除
        if (typeof e.body.awake === 'function') e.body.awake();

        // 地形から落ちないように、Y座標をプレイヤーに合わせる（真の立体戦闘）
        const trackYTypes = ['idle', 'patrol', 'chase', 'shooter', 'horiz', 'zpatrol', 'bouncer', 'sniper', 'ychaser4way', '3wayslowbomber'];
        if (trackYTypes.includes(e.type)) {
            bv.y += (py - bp.y) * 2.0 * dt;
            bv.y *= 0.9; // Y軸の速度を減衰させて安定させる
        }

        if (e.type === 'idle') {
            // 微動（その場でふわふわ）
            e.idlePhase += dt * 2;
            bv.x = Math.sin(e.idlePhase) * 0.3;
            bv.z = Math.cos(e.idlePhase * 0.7) * 0.3;
        } else if (e.type === 'patrol') {
            // 2点間を往復
            const target = (e.patrolTarget === 'B') ? e.patrolB : e.patrolA;
            const dx = target.x - bp.x;
            const dz = target.z - bp.z;
            const dist = Math.sqrt(dx * dx + dz * dz);

            if (dist < 0.5) {
                e.patrolTarget = (e.patrolTarget === 'B') ? 'A' : 'B';
            } else {
                bv.x = (dx / dist) * e.speed;
                bv.z = (dz / dist) * e.speed;
            }
        } else if (e.type === 'chase') {
            // プレイヤーを追跡
            const dx = px - bp.x;
            const dz = pz - bp.z;
            const dist = Math.sqrt(dx * dx + dz * dz);

            if (dist > 0.5) {
                bv.x = (dx / dist) * e.speed;
                bv.z = (dz / dist) * e.speed;
            }
        } else if (e.type === 'shooter') {
            // プレイヤーをゆっくり追跡 + 弾を撃つ
            const dx = px - bp.x;
            const dz = pz - bp.z;
            const dist = Math.sqrt(dx * dx + dz * dz);

            if (dist > 4.0) {
                // 遠ければ近づく
                bv.x = (dx / dist) * e.speed;
                bv.z = (dz / dist) * e.speed;
            } else {
                // 射程内なら停止
                bv.x *= 0.8;
                bv.z *= 0.8;
            }

            // 射撃
            const now = Date.now();
            if (now >= e.canFireTime && now - e.lastFireTime >= e.fireCooldown && dist < 15) {
                e.lastFireTime = now;
                rogueEnemyFire(e, px, py, pz);
            }
        } else if (e.type === 'horiz') {
            // 横方向（X軸）に壁いっぱいまで往復
            bv.x = e.horizDir * e.speed;
            bv.z = 0;
            if (bp.x <= 1.0) { e.horizDir = 1; bp.x = 1.0; }
            if (bp.x >= ROGUE_AREA - 1.0) { e.horizDir = -1; bp.x = ROGUE_AREA - 1.0; }
        } else if (e.type === 'vert') {
            // 縦方向（Y軸）に往復
            bv.x = 0;
            bv.z = 0;
            bv.y = 0; // 重力無効化
            if (e.vertY === undefined) e.vertY = bp.y;
            e.vertY += e.vertDir * e.speed * dt;
            if (e.vertY <= 1.5) { e.vertDir = 1; e.vertY = 1.5; }
            if (e.vertY >= 8.0) { e.vertDir = -1; e.vertY = 8.0; }
            bp.y = e.vertY;
        } else if (e.type === 'shield') {
            // 盾持ち追跡: ゆっくり回転しながらプレイヤーを追う
            const dx = px - bp.x;
            const dz = pz - bp.z;
            const dist = Math.sqrt(dx * dx + dz * dz);

            // ゆっくりプレイヤーの方向へ回転（1秒で約30度）
            const targetAngle = Math.atan2(dx, dz);
            let angleDiff = targetAngle - e.facingAngle;
            // -PI ~ PI に正規化
            while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
            while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
            e.facingAngle += angleDiff * dt * 0.5; // ゆっくり回転

            // 追跡移動
            if (dist > 0.8) {
                bv.x = (dx / dist) * e.speed;
                bv.z = (dz / dist) * e.speed;
            } else {
                bv.x *= 0.5;
                bv.z *= 0.5;
            }

            // メッシュ回転を盾の向きに設定
            e.mesh.rotation.y = e.facingAngle;
        } else if (e.type === 'spinner') {
            // ゆっくり回転しながら弾をばらまく
            bv.x = 0;
            bv.z = 0;
            e.spinAngle += dt * 1.5; // ゆっくり回転

            const now = Date.now();
            if (now >= e.canFireTime && now - e.lastFireTime >= e.spinFireInterval) {
                e.lastFireTime = now;
                // 現在の回転角に弾を発射
                const speed = 6;
                const vx = Math.sin(e.spinAngle) * speed;
                const vz = Math.cos(e.spinAngle) * speed;
                const dy = py - bp.y;
                const hdist = Math.sqrt((px-bp.x)**2 + (pz-bp.z)**2) || 1;
                const vy = (dy / hdist) * speed;
                const dir = new THREE.Vector3(vx, vy, vz).normalize().multiplyScalar(speed);
                rogueEnemyFireDir(e, dir.x, dir.y, dir.z);
            }

            e.mesh.rotation.y = e.spinAngle;
        } else if (e.type === 'diver') {
            // 上空待機 → 急降下 → 帰還
            if (e.diverState === 'hovering') {
                // 上空でゆっくり漂う
                e.idlePhase += dt;
                bp.x = e.diverSpawnX + Math.sin(e.idlePhase) * 1.5;
                bp.z = e.diverSpawnZ + Math.cos(e.idlePhase * 0.7) * 1.5;
                bv.x = 0; bv.z = 0; bv.y = 0;
                bp.y = e.diverHomeY;

                e.diverTimer -= dt;
                if (e.diverTimer <= 0) {
                    e.diverState = 'diving';
                    // プレイヤーの位置に向かって急降下
                    e.diverSpawnX = bp.x;
                    e.diverSpawnZ = bp.z;
                }
            } else if (e.diverState === 'diving') {
                // 急降下
                const isStuck = (bp.y < e.diverHomeY - 1.0 && Math.abs(bv.y) < 0.5);
                bv.y = -12;
                const dx = px - bp.x;
                const dz = pz - bp.z;
                const dist = Math.sqrt(dx * dx + dz * dz) || 1;
                bv.x = (dx / dist) * 4;
                bv.z = (dz / dist) * 4;

                if (bp.y <= 1.2 || isStuck) {
                    if (bp.y <= 1.2) bp.y = 1.2;
                    bv.y = 0;
                    e.diverState = 'returning';
                    e.diverTimer = 1.25; // 地上で2.5倍待つ
                }
            } else if (e.diverState === 'returning') {
                const isStuck = (bp.y > 2.0 && Math.abs(bv.y) < 0.5);
                bv.x = 0; bv.z = 0;
                e.diverTimer -= dt;
                if (e.diverTimer <= 0) {
                    if (e.body && typeof e.body.awake === 'function') e.body.awake();
                    // 上空に戻る
                    bv.y = 8;
                    if (bp.y >= e.diverHomeY || isStuck) {
                        if (bp.y < e.diverHomeY) e.diverHomeY = bp.y;
                        bp.y = e.diverHomeY;
                        bv.y = 0;
                        e.diverState = 'hovering';
                        e.diverTimer = 2.0 + Math.random() * 3.0;
                        // 新しいホバリング基準点を現在の位置にする
                        e.diverSpawnX = bp.x;
                        e.diverSpawnZ = bp.z;
                    }
                }
            }
        } else if (e.type === 'zpatrol') {
            // 縦(Z軸)に巡回する
            e.zPatrolPhase += dt * e.speed * 0.5;
            bv.x = 0;
            // サイン波でZ軸を行き来
            bv.z = Math.cos(e.zPatrolPhase) * e.speed;
        } else if (e.type === 'bouncer') {
            // 高速で直線的に動き続ける
            bv.x = e.bounceVX;
            bv.z = e.bounceVZ;
            // 壁で反射
            if (bp.x <= 1.0) { e.bounceVX = Math.abs(e.bounceVX); bp.x = 1.0; }
            if (bp.x >= ROGUE_AREA - 1.0) { e.bounceVX = -Math.abs(e.bounceVX); bp.x = ROGUE_AREA - 1.0; }
            if (bp.z <= 1.0) { e.bounceVZ = Math.abs(e.bounceVZ); bp.z = 1.0; }
            if (bp.z >= ROGUE_AREA - 1.0) { e.bounceVZ = -Math.abs(e.bounceVZ); bp.z = ROGUE_AREA - 1.0; }
        } else if (e.type === 'dasher') {
            // 突進 (水平のみ)
            e.dasherTimer -= dt;
            bv.y += (py - bp.y) * 2.0 * dt; bv.y *= 0.9; // 高さを合わせる
            if (e.dasherState === 'waiting') {
                // 待機中：プレイヤーの方を向くが動かない
                bv.x = 0; bv.z = 0;
                const dx = px - bp.x;
                const dz = pz - bp.z;
                e.mesh.rotation.y = Math.atan2(dx, dz);
                if (e.dasherTimer <= 0) {
                    e.dasherState = 'dashing';
                    e.dasherTimer = 0.8; // 0.8秒間突進
                    const dist = Math.sqrt(dx * dx + dz * dz) || 1;
                    e.dashDirX = (dx / dist) * e.speed;
                    e.dashDirZ = (dz / dist) * e.speed;
                }
            } else if (e.dasherState === 'dashing') {
                // 高速突進（勢いよく通り過ぎる）
                bv.x = e.dashDirX;
                bv.z = e.dashDirZ;
                if (e.dasherTimer <= 0) {
                    e.dasherState = 'waiting';
                    e.dasherTimer = 1.0 + Math.random() * 1.0; // 1~2秒待機
                }
            }
        } else if (e.type === '3dcharge') {
            // 3D突進（Y軸も含めた全方位突撃）
            e.dasherTimer -= dt;
            if (e.dasherState === 'waiting') {
                bv.x *= 0.8; bv.y *= 0.8; bv.z *= 0.8;
                const dx = px - bp.x;
                const dz = pz - bp.z;
                e.mesh.rotation.y = Math.atan2(dx, dz);
                if (e.dasherTimer <= 0) {
                    e.dasherState = 'dashing';
                    e.dasherTimer = 0.8;
                    const dy = py - bp.y;
                    const dist = Math.sqrt(dx*dx + dy*dy + dz*dz) || 1;
                    e.dashDirX = (dx / dist) * e.speed;
                    e.dashDirY = (dy / dist) * e.speed;
                    e.dashDirZ = (dz / dist) * e.speed;
                }
            } else if (e.dasherState === 'dashing') {
                bv.x = e.dashDirX;
                bv.y = e.dashDirY;
                bv.z = e.dashDirZ;
                if (e.dasherTimer <= 0) {
                    e.dasherState = 'waiting';
                    e.dasherTimer = 1.0 + Math.random() * 1.0;
                }
            }
        } else if (e.type === 'ychaser4way') {
            // Y軸を追いながらゆっくり近づき、4方向に弾を撃つ
            const dx = px - bp.x;
            const dz = pz - bp.z;
            const dist = Math.sqrt(dx * dx + dz * dz) || 1;
            
            if (dist > 5.0) {
                bv.x = (dx / dist) * e.speed;
                bv.z = (dz / dist) * e.speed;
            } else {
                bv.x *= 0.8; bv.z *= 0.8;
            }
            e.mesh.rotation.y += dt; // クルクル回る

            const now = Date.now();
            if (now >= e.canFireTime && now - e.lastFireTime >= e.fireCooldown) {
                e.lastFireTime = now;
                if (typeof rogueEnemyFireDir === 'function') {
                    const bSpeed = 10;
                    for (let j = 0; j < 4; j++) {
                        const angle = (Math.PI / 2) * j;
                        rogueEnemyFireDir(e, Math.sin(angle)*bSpeed, 0, Math.cos(angle)*bSpeed);
                    }
                }
            }
        } else if (e.type === 'yspinner') {
            // 縦方向にサイン波で動きながら弾をばらまく
            bv.x = 0; bv.z = 0;
            e.yPhase += dt * 2.0;
            bv.y = Math.cos(e.yPhase) * 5.0; // Y軸を上下に移動
            e.spinAngle += dt * 3.0;
            e.mesh.rotation.y = e.spinAngle;

            const now = Date.now();
            if (now >= e.canFireTime && now - e.lastFireTime >= e.spinFireInterval) {
                e.lastFireTime = now;
                if (typeof rogueEnemyFireDir === 'function') {
                    const speed = 8;
                    const vx = Math.sin(e.spinAngle) * speed;
                    const vz = Math.cos(e.spinAngle) * speed;
                    rogueEnemyFireDir(e, vx, 0, vz);
                }
            }
        } else if (e.type === '3wayslowbomber') {
            // ゆっくり近づきつつ、3連射x3Wayの弾を撃つ
            const dx = px - bp.x;
            const dz = pz - bp.z;
            const dist = Math.sqrt(dx * dx + dz * dz) || 1;
            
            if (dist > 6.0) {
                bv.x = (dx / dist) * e.speed;
                bv.z = (dz / dist) * e.speed;
            } else {
                bv.x *= 0.8; bv.z *= 0.8;
            }
            e.mesh.rotation.y = Math.atan2(dx, dz); // 常にプレイヤーを向く

            const now = Date.now();
            if (e.burstCount > 0) {
                // バースト射撃中
                e.burstTimer -= dt;
                if (e.burstTimer <= 0) {
                    if (typeof rogueEnemyFireDir === 'function') {
                        const bSpeed = 6; // ゆっくり弾
                        const baseAngle = Math.atan2(dx, dz);
                        for (let j = -1; j <= 1; j++) {
                            const angle = baseAngle + j * 0.3; // 3-way
                            const dy = py - bp.y;
                            const hdist = Math.sqrt(dx*dx + dz*dz) || 1;
                            const vy = (dy / hdist) * bSpeed;
                            rogueEnemyFireDir(e, Math.sin(angle)*bSpeed, vy, Math.cos(angle)*bSpeed);
                        }
                    }
                    e.burstCount--;
                    e.burstTimer = 0.3; // 0.3秒間隔
                }
            } else if (now >= e.canFireTime && now - e.lastFireTime >= e.fireCooldown) {
                e.lastFireTime = now;
                e.burstCount = 3; // 3連続
                e.burstTimer = 0; // すぐに1発目
            }
        } else if (e.type === 'diver8way') {
            // Diverの強化版：着地時に8方向弾
            if (e.diverState === 'hovering') {
                e.idlePhase += dt;
                bp.x = e.diverSpawnX + Math.sin(e.idlePhase) * 1.5;
                bp.z = e.diverSpawnZ + Math.cos(e.idlePhase * 0.7) * 1.5;
                bv.x = 0; bv.z = 0; bv.y = 0;
                bp.y = e.diverHomeY;

                e.diverTimer -= dt;
                if (e.diverTimer <= 0) {
                    e.diverState = 'diving';
                    e.diverSpawnX = bp.x;
                    e.diverSpawnZ = bp.z;
                }
            } else if (e.diverState === 'diving') {
                const isStuck = (bp.y < e.diverHomeY - 1.0 && Math.abs(bv.y) < 0.5);
                bv.y = -20; // 通常のDiverより速い
                const dx = px - bp.x;
                const dz = pz - bp.z;
                const dist = Math.sqrt(dx * dx + dz * dz) || 1;
                bv.x = (dx / dist) * 6;
                bv.z = (dz / dist) * 6;

                if (bp.y <= 1.2 || isStuck) {
                    if (bp.y <= 1.2) bp.y = 1.2;
                    bv.y = 0;
                    e.diverState = 'returning';
                    e.diverTimer = 1.5;
                    // 8方向に弾を撃つ
                    if (typeof rogueEnemyFireDir === 'function') {
                        const bSpeed = 12;
                        for (let j = 0; j < 8; j++) {
                            const angle = (Math.PI / 4) * j;
                            rogueEnemyFireDir(e, Math.sin(angle)*bSpeed, 0, Math.cos(angle)*bSpeed);
                        }
                    }
                }
            } else if (e.diverState === 'returning') {
                const isStuck = (bp.y > 2.0 && Math.abs(bv.y) < 0.5);
                bv.x = 0; bv.z = 0;
                e.diverTimer -= dt;
                if (e.diverTimer <= 0) {
                    if (e.body && typeof e.body.awake === 'function') e.body.awake();
                    bv.y = 10;
                    if (bp.y >= e.diverHomeY || isStuck) {
                        if (bp.y < e.diverHomeY) e.diverHomeY = bp.y;
                        bp.y = e.diverHomeY;
                        bv.y = 0;
                        e.diverState = 'hovering';
                        e.diverTimer = 2.0 + Math.random() * 2.0;
                        e.diverSpawnX = bp.x;
                        e.diverSpawnZ = bp.z;
                    }
                }
            }
        } else if (e.type === 'santabomber') {
            // 3m浮いていて、サンタクのように縦に3発弾を飛ばす
            bp.y = 3.0; // 高度固定
            bv.y = 0;
            const dx = px - bp.x;
            const dz = pz - bp.z;
            const dist = Math.sqrt(dx * dx + dz * dz) || 1;

            if (dist > 6.0) {
                // 近づく
                bv.x = (dx / dist) * e.speed;
                bv.z = (dz / dist) * e.speed;
            } else {
                // 漂う
                bv.x *= 0.8; bv.z *= 0.8;
            }

            e.mesh.rotation.y = Math.atan2(dx, dz);

            const now = Date.now();
            if (now >= e.canFireTime && now - e.lastFireTime >= e.fireCooldown) {
                e.lastFireTime = now;
                // サンタクのような放物線弾を3発同時に飛ばす
                if (typeof rogueEnemyFireArc === 'function') {
                    // 中心、左寄り、右寄りにばらけさせる
                    rogueEnemyFireArc(e, px, pz, 0); // 中央
                    rogueEnemyFireArc(e, px, pz, -0.3); // 左
                    rogueEnemyFireArc(e, px, pz, 0.3); // 右
                }
            }
        } else if (e.type === 'vertsantabomber') {
            // 3m浮いていて、サンタクのように縦に3発弾を飛ばす (縦スプレッド)
            bp.y = 3.0;
            bv.y = 0;
            const dx = px - bp.x;
            const dz = pz - bp.z;
            const dist = Math.sqrt(dx * dx + dz * dz) || 1;

            if (dist > 6.0) {
                bv.x = (dx / dist) * e.speed;
                bv.z = (dz / dist) * e.speed;
            } else {
                bv.x *= 0.8; bv.z *= 0.8;
            }
            e.mesh.rotation.y = Math.atan2(dx, dz);

            const now = Date.now();
            if (now >= e.canFireTime && now - e.lastFireTime >= e.fireCooldown) {
                e.lastFireTime = now;
                if (typeof rogueEnemyFireArc === 'function') {
                    // 縦方向にばらけさせる (高さの初速を変える)
                    rogueEnemyFireArc(e, px, pz, 0, 3.0); // 低め
                    rogueEnemyFireArc(e, px, pz, 0, 5.0); // 普通
                    rogueEnemyFireArc(e, px, pz, 0, 7.0); // 高め
                }
            }
        } else if (e.type === 'orbitshield') {
            // 固定、周囲にシールドを周回させる
            bv.x = 0; bv.z = 0;
            e.orbitPhase += dt * 1.5;
            if (e.orbiters) {
                e.orbiters.forEach(orb => {
                    const angle = e.orbitPhase + orb.angleOffset;
                    // 半径2.5m
                    const ox = bp.x + Math.sin(angle) * 2.5;
                    const oz = bp.z + Math.cos(angle) * 2.5;
                    
                    if (orb.body) {
                        orb.body.position.set(ox, bp.y, oz);
                        // 回転速度をリセット
                        orb.body.linearVelocity.set(0, 0, 0);
                        orb.body.angularVelocity.set(0, 0, 0);
                    }
                    if (orb.mesh) {
                        orb.mesh.position.set(ox, bp.y, oz);
                    }
                });
            }
        } else if (e.type === 'sniper') {
            // スナイパーは動かない
            bv.x *= 0.8; bv.z *= 0.8;
            // プレイヤーの方を向く
            const dx = px - bp.x;
            const dz = pz - bp.z;
            e.mesh.rotation.y = Math.atan2(dx, dz);

            const now = Date.now();
            if (now >= e.canFireTime && now - e.lastFireTime >= e.fireCooldown) {
                e.lastFireTime = now;
                // レーザー（高速弾）を下に向かって撃つ
                if (typeof rogueEnemyFireDir === 'function') {
                    const laserSpeed = 25;
                    const dy3 = py - bp.y;
                    const dist3 = Math.sqrt(dx*dx + dy3*dy3 + dz*dz) || 1;
                    const vx = (dx / dist3) * laserSpeed;
                    const vy = (dy3 / dist3) * laserSpeed;
                    const vz = (dz / dist3) * laserSpeed;
                    rogueEnemyFireDir(e, vx, vy, vz);
                }
            }
        } else if (e.type === 'bossstage8') {
            // ボスのロジック
            e.bossTimer -= dt;
            const dx = px - bp.x;
            const dz = pz - bp.z;
            const dist = Math.sqrt(dx * dx + dz * dz) || 1;
            const isGrounded = Math.abs(bv.y) < 0.5; // 着地判定

            // 基本はプレイヤーの方を向く（疲労時、突進時、チャージ時以外）
            if (e.bossState !== 'fatigued' && e.bossState !== 'diving' && e.bossState !== 'charging') {
                const targetAngle = Math.atan2(dx, dz);
                e.facingAngle = targetAngle;
                // ゆっくり旋回させる（隙を作るため）
                let angleDiff = targetAngle - e.mesh.rotation.y;
                while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
                while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
                e.mesh.rotation.y += angleDiff * dt * 3.0; // 旋回速度調整
            }

            // シールドの見た目切り替え（射撃中・疲労中はシールドを下げる）
            const shield = e.mesh.getObjectByName('shield');
            if (shield) {
                if (e.bossState === 'shooting' || e.bossState === 'fatigued') {
                    shield.rotation.x = Math.PI / 2; // 下を向ける
                    shield.material.opacity = 0.2;
                } else {
                    shield.rotation.x = 0; // 正面を向ける
                    shield.material.opacity = 0.8;
                }
            }

            if (e.bossState === 'hopping') {
                // ジャンプしながら近づく
                if (e.bossTimer <= 0 && isGrounded) {
                    // ジャンプ
                    bv.y = 10;
                    bv.x = (dx / dist) * e.speed * 1.5;
                    bv.z = (dz / dist) * e.speed * 1.5;
                    e.bossState = 'shooting';
                    e.bossTimer = 1.0; // 1秒間空中で撃つ
                } else if (isGrounded) {
                    // 地面にいるときは減速
                    bv.x *= 0.9; bv.z *= 0.9;
                }
            } else if (e.bossState === 'shooting') {
                if (isGrounded && e.bossTimer <= 0) {
                    // 着地したら次の行動へ
                    e.bossState = (Math.random() < 0.5) ? 'charging' : 'hopping';
                    e.bossTimer = (e.bossState === 'hopping') ? 1.5 : 1.5;
                } else {
                    // 射撃処理 (レート4倍 = 250ms)
                    const now = Date.now();
                    if (now >= e.canFireTime && now - e.lastFireTime >= 250) {
                        e.lastFireTime = now;
                        // 距離に関係なく50%の確率でレーザー
                        if (Math.random() < 0.5) {
                            // レーザーのような速い弾
                            if (typeof rogueEnemyFireDir === 'function') {
                                const laserSpeed = 20;
                                const dx3 = px - bp.x;
                                const dy3 = py - bp.y;
                                const dz3 = pz - bp.z;
                                const dist3 = Math.sqrt(dx3*dx3 + dy3*dy3 + dz3*dz3) || 1;
                                const vx = (dx3 / dist3) * laserSpeed;
                                const vy = (dy3 / dist3) * laserSpeed;
                                const vz = (dz3 / dist3) * laserSpeed;
                                rogueEnemyFireDir(e, vx, vy, vz);
                            }
                        } else {
                            // 近距離では小さめの弾
                            if (typeof rogueEnemyFireDir === 'function') {
                                const bSpeed = 10;
                                const spread = e.mesh.rotation.y + (Math.random() - 0.5) * 0.4;
                                const vx = Math.sin(spread) * bSpeed;
                                const vz = Math.cos(spread) * bSpeed;
                                const dy3 = py - bp.y;
                                const hdist = Math.sqrt((px-bp.x)**2 + (pz-bp.z)**2) || 1;
                                const vy = (dy3 / hdist) * bSpeed;
                                const dir = new THREE.Vector3(vx, vy, vz).normalize().multiplyScalar(bSpeed);
                                rogueEnemyFireDir(e, dir.x, dir.y, dir.z);
                            }
                        }
                    }
                }
            } else if (e.bossState === 'charging') {
                // 上空へ飛び上がってタメる
                if (e.bossTimer > 0) {
                    // 目標高度12m付近に滞空
                    const targetY = 12.0;
                    bv.y += (targetY - bp.y) * 2.0 * dt;
                    bv.x *= 0.8; bv.z *= 0.8;
                    // 棒を振るアニメーション（チャージ中）
                    e.bossStickPhase += dt * 25;
                    const stick = e.mesh.getObjectByName('stick');
                    if (stick) {
                        stick.rotation.z = e.bossStickPhase;
                        // チャージ中はプレイヤーの方を向く
                        e.mesh.rotation.y = Math.atan2(dx, dz);
                    }
                } else {
                    // タメ完了、急降下へ
                    e.bossState = 'diving';
                    // ダイブの方向を計算
                    const diveDx = px - bp.x;
                    const diveDy = Math.min(py - bp.y, -1.0); // 上には飛ばないように制限
                    const diveDz = pz - bp.z;
                    const diveDist = Math.sqrt(diveDx*diveDx + diveDy*diveDy + diveDz*diveDz) || 1;
                    const diveSpeed = 30; // 猛スピード
                    e.dashDirX = (diveDx / diveDist) * diveSpeed;
                    e.dashDirY = (diveDy / diveDist) * diveSpeed;
                    e.dashDirZ = (diveDz / diveDist) * diveSpeed;
                    
                    // ダイブ中は強制的にプレイヤーの方向を向く
                    e.mesh.rotation.y = Math.atan2(diveDx, diveDz);
                }
            } else if (e.bossState === 'diving') {
                // 急降下斬り
                bv.x = e.dashDirX;
                bv.y = e.dashDirY;
                bv.z = e.dashDirZ;
                
                // 棒を激しく回転
                e.bossStickPhase += dt * 40;
                const stick = e.mesh.getObjectByName('stick');
                if (stick) {
                    stick.rotation.z = e.bossStickPhase;
                }
                
                // 地面に激突したか判定（接地、または下向き速度が突然消えたら）
                if (isGrounded && e.dashDirY < 0 && e.bossTimer < -0.1) {
                    // 着地
                    e.bossState = 'fatigued';
                    e.bossTimer = 2.5; // 2.5秒間の完全な隙
                    if (stick) stick.rotation.z = 0; // 棒リセット
                }
            } else if (e.bossState === 'fatigued') {
                // 疲労状態（動かない、盾も無効化）
                bv.x *= 0.8; bv.z *= 0.8;
                if (e.bossTimer <= 0) {
                    // 疲労回復後はホッピングに戻る
                    e.bossState = 'hopping';
                    e.bossTimer = 1.0;
                }
            }
        } else if (e.type === 'bossstage16') {
            // Boss16 (OrbitBoss): 水平・垂直のオービターを持ち、ワープしながら弾を撃つ
            e.bossTimer -= dt;
            const dx = px - bp.x;
            const dz = pz - bp.z;
            const dist = Math.sqrt(dx * dx + dz * dz) || 1;
            
            // オービターの更新
            e.orbitPhase += dt * 2.0;
            if (e.orbitersH) {
                e.orbitersH.forEach(orb => {
                    const angle = e.orbitPhase + orb.angleOffset;
                    const ox = bp.x + Math.sin(angle) * 3.5;
                    const oz = bp.z + Math.cos(angle) * 3.5;
                    if (orb.body) {
                        orb.body.position.set(ox, bp.y, oz);
                        orb.body.linearVelocity.set(0,0,0);
                    }
                    if (orb.mesh) orb.mesh.position.set(ox, bp.y, oz);
                });
            }
            if (e.orbitersV) {
                e.orbitersV.forEach(orb => {
                    const angle = e.orbitPhase * 1.5 + orb.angleOffset; // 少し速度を変える
                    const ox = bp.x + Math.sin(angle) * 3.5;
                    const oy = bp.y + Math.cos(angle) * 3.5;
                    if (orb.body) {
                        orb.body.position.set(ox, oy, bp.z);
                        orb.body.linearVelocity.set(0,0,0);
                    }
                    if (orb.mesh) orb.mesh.position.set(ox, oy, bp.z);
                });
            }

            // シャノン球の回避 (Boss16, 24, 32 共通回避ロジック)
            if (G.bubbles) {
                for (const b of G.bubbles) {
                    if (!b.body) continue;
                    const bx = b.body.position.x;
                    const by = b.body.position.y;
                    const bz = b.body.position.z;
                    const ddx = bp.x - bx;
                    const ddy = bp.y - by;
                    const ddz = bp.z - bz;
                    const ddist = Math.sqrt(ddx*ddx + ddy*ddy + ddz*ddz);
                    if (ddist > 0 && ddist < 5.0) { // 5m以内に近づいたら回避
                        bv.x += (ddx / ddist) * 40.0 * dt; // 強く弾かれるように回避
                        bv.y += (ddy / ddist) * 40.0 * dt;
                        bv.z += (ddz / ddist) * 40.0 * dt;
                    }
                }
            }

            if (e.bossState === 'hopping') {
                // 近づかれたら逃げる（ワープ）
                if (dist < 5.0 && e.bossTimer <= 0) {
                    let wx, wz;
                    do {
                        wx = Math.floor(1 + Math.random() * (ROGUE_AREA - 2));
                        wz = Math.floor(1 + Math.random() * (ROGUE_AREA - 2));
                    } while (Math.abs(wx - px) < 8 && Math.abs(wz - pz) < 8);
                    let wy = 15;
                    for (let y = 15; y >= 0; y--) {
                        if (G.mapGrid.has(`${wx},${y},${wz}`)) { wy = y; break; }
                    }
                    bp.set(wx, wy + 1.5, wz);
                    e.bossTimer = 2.0; // ワープ後の硬直と射撃時間
                    e.bossState = 'shooting';
                } else if (Math.abs(bv.y) < 0.5) {
                    bv.x *= 0.8; bv.z *= 0.8; // 基本は動かない
                }
                
                // 定期的に弾撃ち
                const now = Date.now();
                if (now >= e.canFireTime && now - e.lastFireTime >= 400) {
                    e.lastFireTime = now;
                    if (typeof rogueEnemyFireDir === 'function') {
                        const bSpeed = 15;
                        const spread = Math.atan2(dx, dz) + (Math.random() - 0.5) * 0.2;
                        const dy3 = py - bp.y;
                        const hdist = Math.sqrt(dx*dx + dz*dz) || 1;
                        const vy = (dy3 / hdist) * bSpeed;
                        rogueEnemyFireDir(e, Math.sin(spread)*bSpeed, vy, Math.cos(spread)*bSpeed);
                    }
                }
            } else if (e.bossState === 'shooting') {
                // ワープ後の硬直
                bv.x = 0; bv.z = 0;
                if (e.bossTimer <= 0) {
                    e.bossState = 'hopping';
                }
            }
        } else if (e.type === 'bossstage24') {
            // Boss24 (TrapBoss): 床にダメージゾーン（テープ）を展開
            e.bossTimer -= dt;
            const dx = px - bp.x;
            const dz = pz - bp.z;
            
            // 常にプレイヤーの上空をフワフワ浮かぶ
            const targetY = 8.0;
            bv.y += (targetY - bp.y) * 2.0 * dt;
            bv.x *= 0.9; bv.z *= 0.9;
            e.mesh.rotation.y += dt;

            // オービターの更新
            e.orbitPhase += dt * 2.0;
            if (e.orbiters) {
                e.orbiters.forEach(orb => {
                    const angle = e.orbitPhase + orb.angleOffset;
                    const ox = bp.x + Math.sin(angle) * 3.5;
                    const oz = bp.z + Math.cos(angle) * 3.5;
                    if (orb.body) {
                        orb.body.position.set(ox, bp.y, oz);
                        orb.body.linearVelocity.set(0,0,0);
                    }
                    if (orb.mesh) orb.mesh.position.set(ox, bp.y, oz);
                });
            }

            // シャノン球の回避
            if (G.bubbles) {
                for (const b of G.bubbles) {
                    if (!b.body) continue;
                    const bx = b.body.position.x;
                    const by = b.body.position.y;
                    const bz = b.body.position.z;
                    const ddx = bp.x - bx;
                    const ddy = bp.y - by;
                    const ddz = bp.z - bz;
                    const ddist = Math.sqrt(ddx*ddx + ddy*ddy + ddz*ddz);
                    if (ddist > 0 && ddist < 5.0) {
                        bv.x += (ddx / ddist) * 40.0 * dt;
                        bv.y += (ddy / ddist) * 40.0 * dt;
                        bv.z += (ddz / ddist) * 40.0 * dt;
                    }
                }
            }
            
            // トラップテープの更新
            if (e.trapTapes) {
                for (let i = e.trapTapes.length - 1; i >= 0; i--) {
                    const t = e.trapTapes[i];
                    t.timer -= dt;
                    if (t.timer <= 0) {
                        // 発動（ダメージ判定）
                        if (!G.isDead && !G.isInvincible) {
                            if (Math.abs(px - t.x) < t.w/2 && Math.abs(pz - t.z) < t.h/2 && py < 3.0) {
                                if (typeof takeDamage === 'function') takeDamage(1, 'TrapBoss');
                            }
                        }
                        if (t.mesh && G.scene) {
                            G.scene.remove(t.mesh);
                            t.mesh.geometry.dispose();
                            t.mesh.material.dispose();
                        }
                        e.trapTapes.splice(i, 1);
                    } else if (t.timer < 0.5) {
                        // 発動直前に赤く点滅
                        t.mesh.material.color.setHex(0xff0000);
                        t.mesh.material.opacity = 0.8;
                    }
                }
            }

            if (e.bossTimer <= 0) {
                // プレイヤーの足元に新しいトラップを生成
                const tw = 4, th = 4;
                const tGeo = new THREE.PlaneGeometry(tw, th);
                const tMat = new THREE.MeshBasicMaterial({ color: 0xffaa00, transparent: true, opacity: 0.4, side: THREE.DoubleSide });
                const tMesh = new THREE.Mesh(tGeo, tMat);
                tMesh.rotation.x = -Math.PI / 2;
                
                // ブロックの上ならその高さを考慮
                let floorY = 0;
                for (let y = 15; y >= 0; y--) {
                    if (G.mapGrid.has(`${Math.floor(px)},${y},${Math.floor(pz)}`)) { floorY = y; break; }
                }
                tMesh.position.set(px, floorY + 1.01, pz);
                G.scene.add(tMesh);
                
                e.trapTapes.push({ x: px, z: pz, w: tw, h: th, timer: 1.5, mesh: tMesh });
                
                // 少し逃げる動き
                const dist = Math.sqrt(dx*dx + dz*dz) || 1;
                bv.x = -(dx/dist) * 5.0;
                bv.z = -(dz/dist) * 5.0;
                
                e.bossTimer = 2.0 + Math.random() * 1.5;
            }
        } else if (e.type === 'bossstage32') {
            // Boss32 (GravityBoss): プレイヤークローンAI
            if (e.reloadTimer === undefined) e.reloadTimer = 0;
            if (e.evadeTimer === undefined) e.evadeTimer = 0;
            if (e.bossTimer === undefined) e.bossTimer = 0;
            if (e.combatMoveTimer === undefined) e.combatMoveTimer = 0;
            if (e.jumpHoldTimer === undefined) e.jumpHoldTimer = 0;

            e.reloadTimer -= dt;
            e.evadeTimer -= dt;
            e.bossTimer -= dt;
            e.combatMoveTimer -= dt;
            
            const dx = px - bp.x;
            const dz = pz - bp.z;
            const dist = Math.sqrt(dx*dx + dz*dz) || 1;
            const isGrounded = Math.abs(bv.y) < 0.5;

            // 基本の移動方向ベクトル
            let moveDirX = 0;
            let moveDirZ = 0;

            // 状態に応じた目標地点の決定
            if (e.gravState === 'combat') {
                if (e.combatMoveTimer <= 0) {
                    e.combatMoveTimer = 1.0 + Math.random() * 2.0;
                    if (Math.random() < 0.6) {
                        // 遮蔽に隠れたり、側面を取るための攪乱移動
                        let bestPos = null;
                        let bestScore = -999;
                        for (let x = 1; x < ROGUE_AREA - 1; x++) {
                            for (let z = 1; z < ROGUE_AREA - 1; z++) {
                                for (let y = 1; y < 7; y++) {
                                    if (G.mapGrid.has(`${x},${y},${z}`)) {
                                        const bdx = x - px;
                                        const bdz = z - pz;
                                        const bdist = Math.sqrt(bdx*bdx + bdz*bdz) || 1;
                                        const hideX = x + (bdx/bdist) * 2;
                                        const hideZ = z + (bdz/bdist) * 2;
                                        if (hideX > 1 && hideX < ROGUE_AREA - 1 && hideZ > 1 && hideZ < ROGUE_AREA - 1) {
                                            // プレイヤーとの距離が適度にある場所を評価
                                            const distToHide = Math.sqrt((hideX - bp.x)**2 + (hideZ - bp.z)**2);
                                            const score = Math.random() - distToHide * 0.05; 
                                            if (score > bestScore) {
                                                bestScore = score;
                                                bestPos = { x: hideX, z: hideZ };
                                            }
                                        }
                                    }
                                }
                            }
                        }
                        e.combatTargetPos = bestPos;
                    } else {
                        e.combatTargetPos = null;
                    }
                }

                if (e.combatTargetPos) {
                    const tdx = e.combatTargetPos.x - bp.x;
                    const tdz = e.combatTargetPos.z - bp.z;
                    const tDist = Math.sqrt(tdx*tdx + tdz*tdz) || 1;
                    if (tDist > 1.5) {
                        moveDirX = (tdx/tDist) * 7.5; // 移動速度を上げて攪乱
                        moveDirZ = (tdz/tDist) * 7.5;
                    } else {
                        e.combatTargetPos = null; // 到達したら再度アプローチへ
                    }
                } else {
                    // 自機に向かって移動しつつ、ジグザグ移動で攪乱
                    const angle = Math.atan2(dx, dz) + Math.sin(Date.now() / 200) * 0.8;
                    moveDirX = Math.sin(angle) * 7.0;
                    moveDirZ = Math.cos(angle) * 7.0;
                }
            } else if (e.gravState === 'reloading' && e.targetBlockPos) {
                // 遮蔽物へ向かう
                const tdx = e.targetBlockPos.x - bp.x;
                const tdz = e.targetBlockPos.z - bp.z;
                const tDist = Math.sqrt(tdx*tdx + tdz*tdz) || 1;
                if (tDist > 1.5) {
                    moveDirX = (tdx/tDist) * 6.0;
                    moveDirZ = (tdz/tDist) * 6.0;
                }
            }

            // --- 弾回避（ムーンウォーク跳躍）の判定 ---
            let evadeJump = false;
            if (e.evadeTimer <= 0 && isGrounded && e.gravState !== 'diving' && e.gravState !== 'pounding') {
                let threatFound = false;
                let tx = 0, tz = 0;
                
                if (G.bubbles) {
                    for (const b of G.bubbles) {
                        const bx = b.body ? b.body.position.x : b.mesh.position.x;
                        const bz = b.body ? b.body.position.z : b.mesh.position.z;
                        const ddx = bp.x - bx;
                        const ddz = bp.z - bz;
                        if (ddx*ddx + ddz*ddz < 25) { 
                            tx += ddx; tz += ddz;
                            threatFound = true;
                        }
                    }
                }
                if (G.projectiles) {
                    for (const p of G.projectiles) {
                        if (p.ownerBody === e.body) continue;
                        const ddx = bp.x - p.position.x;
                        const ddz = bp.z - p.position.z;
                        if (ddx*ddx + ddz*ddz < 25) {
                            tx += ddx; tz += ddz;
                            threatFound = true;
                        }
                    }
                }

                if (threatFound) {
                    const tLen = Math.sqrt(tx*tx + tz*tz) || 1;
                    // 後退だけでなく、左右移動も交えて回避率を上げる
                    const perpX = -tz / tLen;
                    const perpZ = tx / tLen;
                    const side = Math.random() < 0.5 ? 1 : -1;
                    e.evadeDirX = (tx/tLen) * 5.0 + perpX * 5.0 * side; 
                    e.evadeDirZ = (tz/tLen) * 5.0 + perpZ * 5.0 * side;
                    evadeJump = true;
                }
            }

            // --- 段差登り・ランダムジャンプの判定 ---
            if (!evadeJump && e.evadeTimer <= 0 && isGrounded && e.gravState !== 'diving' && e.gravState !== 'pounding') {
                const moveMag = Math.sqrt(moveDirX*moveDirX + moveDirZ*moveDirZ);
                if (moveMag > 0.1) {
                    const nx = moveDirX / moveMag;
                    const nz = moveDirZ / moveMag;
                    const checkX = Math.floor(bp.x + nx * 0.8);
                    const checkY = Math.floor(bp.y);
                    const checkZ = Math.floor(bp.z + nz * 0.8);
                    
                    // 目の前にブロックがあり、上が空いているなら登るためのジャンプ
                    if (G.mapGrid.has(`${checkX},${checkY},${checkZ}`) && !G.mapGrid.has(`${checkX},${checkY+1},${checkZ}`)) {
                        e.evadeDirX = moveDirX;
                        e.evadeDirZ = moveDirZ;
                        evadeJump = true;
                    } else if (e.gravState === 'combat' && Math.random() < 0.03) {
                        // 通常移動時の気まぐれ小ジャンプ (頻度やや高め)
                        e.evadeDirX = moveDirX;
                        e.evadeDirZ = moveDirZ;
                        evadeJump = true;
                    }
                }
            }

            // ジャンプ実行 (自機と同等の跳躍力 * 1.2倍)
            if (evadeJump) {
                bv.y = 2.6 * 1.2; // jumpVelocity * 1.2
                e.evadeTimer = 0.65;
                e.jumpHoldTimer = 0.25; // 0.25秒間の長押し高度調整をシミュレート
            }

            // ジャンプの長押し（高度調整）処理
            if (e.jumpHoldTimer > 0) {
                e.jumpHoldTimer -= dt;
                bv.y += 0.38 * (60 * dt); // holdBoostと同等の加速を付与
            }

            // --- 物理速度への適用（歩行と空中制御） ---
            if (e.gravState !== 'diving' && e.gravState !== 'pounding') {
                if (e.evadeTimer > 0) {
                    // ジャンプ/回避中は慣性移動
                    bv.x = e.evadeDirX;
                    bv.z = e.evadeDirZ;
                } else if (isGrounded) {
                    // 地上では目標へ歩行
                    bv.x = moveDirX;
                    bv.z = moveDirZ;
                }
            }

            // --- 状態ごとの固有アクション ---
            if (e.gravState === 'combat') {
                // 戦闘モード
                const now = Date.now();
                if (now >= e.canFireTime) {
                    if (e.bossMode === 'missile') {
                        // ミサイル (壁貫通・高速・3WAY)
                        if (now - e.lastFireTime >= 1000) { // 発射レートを上げる (1000 -> 600)
                            e.lastFireTime = now;
                            e.bossAmmo -= 1;
                            if (typeof fireProjectile === 'function') {
                                const bSpeed = 15.0;
                                const pvx = G.playerBody ? G.playerBody.linearVelocity.x : 0;
                                const pvz = G.playerBody ? G.playerBody.linearVelocity.z : 0;
                                const timeToTarget = dist / bSpeed;
                                const predX = px + pvx * timeToTarget;
                                const predY = G.playerBody.position.y;
                                const predZ = pz + pvz * timeToTarget;
                                const pdx = predX - bp.x;
                                const pdy = predY - bp.y;
                                const pdz = predZ - bp.z;
                                const pDist = Math.sqrt(pdx*pdx + pdy*pdy + pdz*pdz) || 1;
                                
                                const vx = (pdx/pDist)*bSpeed;
                                const vy = (pdy/pDist)*bSpeed;
                                const vz = (pdz/pDist)*bSpeed;
                                
                                // 中央
                                fireProjectile(bp.x, bp.y + 0.5, bp.z, vx, vy, vz, e.body, null, { passWall: true, isNeedle: true, damage: 1, radiusMult: 1.0, rangeMult: 1.0 });
                                
                                // 左右に少し拡散させてヒット率を上げる (3WAY)
                                const spreadAngle = 0.35;
                                const cosA = Math.cos(spreadAngle), sinA = Math.sin(spreadAngle);
                                fireProjectile(bp.x, bp.y + 0.5, bp.z, vx*cosA - vz*sinA, vy, vx*sinA + vz*cosA, e.body, null, { passWall: true, isNeedle: true, damage: 1, radiusMult: 1.0, rangeMult: 1.0 });
                                fireProjectile(bp.x, bp.y + 0.5, bp.z, vx*cosA - vz*-sinA, vy, vx*-sinA + vz*cosA, e.body, null, { passWall: true, isNeedle: true, damage: 1, radiusMult: 1.0, rangeMult: 1.0 });
                            }
                        }
                    } else if (e.bossMode === 'shower') {
                        // シャワー (シャボン玉ばら撒き)
                        if (now - e.lastFireTime >= 200) {
                            e.lastFireTime = now;
                            e.bossAmmo -= 1;
                            if (typeof createBubble === 'function') {
                                const bSpeed = 10.0; // シャボン玉も少し速めに
                                createBubble(bp.x, bp.y + 0.5, bp.z, (dx/dist)*bSpeed + (Math.random()-0.5)*5, 5.0, (dz/dist)*bSpeed + (Math.random()-0.5)*5, e.body, null, null, { damage: 1 });
                            }
                        }
                    }
                }

                if (e.bossAmmo <= 0) {
                    e.gravState = 'reloading';
                    e.targetBlockPos = null;
                    e.bossTimer = 3.0; // 強制リロードまでのタイムアウト
                } else if (Math.random() < 0.005 && dist < 10 && e.evadeTimer <= 0 && isGrounded) {
                    // 時折急降下攻撃のために上空へ (地上にいてジャンプしていない時のみ発動)
                    e.gravState = 'diving';
                    bv.y = 10.0; // 大ジャンプに変更
                    bv.x = (dx/dist) * 4; // 少しプレイヤーの方へ飛びながら
                    bv.z = (dz/dist) * 4;
                }
            } else if (e.gravState === 'diving') {
                // 上空へ上った後、急降下
                // 天井に当たって落ち始めた場合（bv.y <= 0.1）や、十分な高さに到達した場合に降下へ移行
                if (bp.y > 10.0 || bv.y <= 0.1) {
                    e.gravState = 'pounding';
                    // 無理やりな落下（bv.y = -30.0）を削除し、自由落下（重力任せ）で降下
                    bv.x = (dx/dist) * 12; // プレイヤーに向かって横方向へ強く移動
                    bv.z = (dz/dist) * 12;
                }
            } else if (e.gravState === 'pounding') {
                if (isGrounded && bp.y < 12.0) {
                    // 着地してシャワーばらまき (同時発射数を8から4に半減)
                    if (typeof createBubble === 'function') {
                        for(let i=0; i<4; i++) {
                            const angle = (Math.PI / 2) * i + Math.random(); // 4方向に分散
                            createBubble(bp.x, bp.y, bp.z, Math.sin(angle)*10, 8.0, Math.cos(angle)*10, e.body, null, null, { damage: 1 });
                        }
                    }
                    e.gravState = 'combat';
                }
            } else if (e.gravState === 'reloading') {
                // 遮蔽物に隠れて極力動かず残弾回復
                if (!e.targetBlockPos) {
                    // プレイヤーとの間に遮蔽物がある場所を探す
                    let bestPos = null;
                    let bestScore = -999;
                    for (let x = 1; x < ROGUE_AREA - 1; x++) {
                        for (let z = 1; z < ROGUE_AREA - 1; z++) {
                            for (let y = 1; y < 7; y++) {
                                if (G.mapGrid.has(`${x},${y},${z}`)) {
                                    // プレイヤーから見てこのブロックの裏側（少し離れた位置）
                                    const bdx = x - px;
                                    const bdz = z - pz;
                                    const bdist = Math.sqrt(bdx*bdx + bdz*bdz) || 1;
                                    const hideX = x + (bdx/bdist) * 2;
                                    const hideZ = z + (bdz/bdist) * 2;
                                    if (hideX > 1 && hideX < ROGUE_AREA - 1 && hideZ > 1 && hideZ < ROGUE_AREA - 1) {
                                        const score = Math.random();
                                        if (score > bestScore) {
                                            bestScore = score;
                                            bestPos = { x: hideX, z: hideZ };
                                        }
                                    }
                                }
                            }
                        }
                    }
                    e.targetBlockPos = bestPos || { x: 10, z: 10 };
                }

                const tdx = e.targetBlockPos.x - bp.x;
                const tdz = e.targetBlockPos.z - bp.z;
                const tDist = Math.sqrt(tdx*tdx + tdz*tdz);
                
                // 目的地に到着するか、3秒経過（スタック防止）で強制リロード開始
                if ((tDist <= 1.5 || e.bossTimer <= 0) && isGrounded && e.evadeTimer <= 0) {
                    // 極力動かず残弾回復
                    bv.x = 0; bv.z = 0;
                    if (e.reloadTimer <= 0) {
                        e.bossAmmo += 1;
                        e.reloadTimer = 0.1; // 0.1秒ごとに1発回復
                        if (e.bossAmmo >= 20) {
                            e.gravState = 'combat';
                            e.bossMode = (Math.random() < 0.5) ? 'missile' : 'shower';
                            e.canFireTime = Date.now() + 1000;
                        }
                    }
                }
            }
        }

        // メッシュ位置同期
        let meshXOffset = 0, meshYOffset = 0, meshZOffset = 0;
        if (e.pOffset) {
            meshXOffset = -e.pOffset[0];
            meshYOffset = -e.pOffset[1];
            meshZOffset = -e.pOffset[2];
        } else {
            // 自機と同じモデルを使っているため、箱の半分の高さ分（0.45m）下げて足が接地するようにする
            if (e.type === 'bossstage32') meshYOffset = -0.45;
        }
        e.mesh.position.set(bp.x + meshXOffset, bp.y + meshYOffset, bp.z + meshZOffset);

        // メッシュ回転（移動方向を向く）
        // Shield, Spinner, BossStage8, OrbitShield は独自の回転ロジックを持つためスキップ
        if (e.type !== 'shield' && e.type !== 'spinner' && e.type !== 'bossstage8' && e.type !== 'orbitshield' && (Math.abs(bv.x) > 0.05 || Math.abs(bv.z) > 0.05)) {
            e.mesh.rotation.y = Math.atan2(bv.x, bv.z);
        }

        // ── 接触ダメージ判定 ──
        if (e.contactCooldown > 0) {
            e.contactCooldown -= dt;
        } else if (!G.isDead && !G.isInvincible) {
            const cdx = bp.x - px;
            const cdz = bp.z - pz;
            const cdy = bp.y - G.playerBody.position.y;
            const contactDist = Math.sqrt(cdx * cdx + cdz * cdz + cdy * cdy);
            const reqDist = (e.type === 'bossstage8') ? 1.5 : 1.0;
            if (contactDist < reqDist) {
                let shieldHit = false;
                if (e.type === 'shield' || e.type === 'bossstage8') {
                    if (!(e.type === 'bossstage8' && (e.bossState === 'fatigued' || e.bossState === 'shooting'))) {
                        const attackAngle = Math.atan2(px - bp.x, pz - bp.z);
                        const facing = (e.type === 'bossstage8') ? e.mesh.rotation.y : e.facingAngle;
                        let angleDiff = attackAngle - facing;
                        while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
                        while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
                        if (Math.abs(angleDiff) < Math.PI / 2) {
                            shieldHit = true;
                        }
                    }
                }

                if (shieldHit) {
                    // シールドヒット時: プレイヤーをノックバックさせ、ダメージも与える
                    const pushX = (px - bp.x) / contactDist * 30;
                    const pushY = 15;
                    const pushZ = (pz - bp.z) / contactDist * 30;
                    G.playerBody.linearVelocity.x = pushX;
                    G.playerBody.linearVelocity.y = Math.max(G.playerBody.linearVelocity.y, pushY);
                    G.playerBody.linearVelocity.z = pushZ;
                    e.contactCooldown = 0.5; // 短いクールダウン
                    if (typeof takeDamage === 'function') {
                        takeDamage(1, 'Shield');
                    }
                } else {
                    // 通常ヒット
                    e.hp -= 1;
                    e.contactCooldown = 1.0; // 1秒クールダウン
                    if (e.hp <= 0) {
                        e.alive = false;
                        RogueState.enemiesAlive--;
                        if (e.mesh && G.scene) G.scene.remove(e.mesh);
                        if (e.body && G.world) {
                            try { G.world.removeRigidBody(e.body); } catch (_) {}
                        }
                        if (typeof createExplosion === 'function') {
                            createExplosion(e.mesh.position.x, e.mesh.position.y, e.mesh.position.z);
                        }
                        updateRogueHUD();
                        checkStageClear();
                    }
                    // プレイヤーにダメージ
                    if (typeof takeDamage === 'function') {
                        takeDamage(1, 'Enemy');
                    }
                }
            }
        }
    }
}

// ── 敵がダメージを受けた時（combat.js/engine.js から呼ばれる） ──
function damageRogueEnemy(enemyBody, projectile = null) {
    if (!RogueState.isActive) return false;

    for (let i = 0; i < RogueState.enemies.length; i++) {
        const e = RogueState.enemies[i];
        if (!e.alive || e.body !== enemyBody) continue;
        if (projectile && projectile.ownerBody === e.body) continue; // 自爆防止

        // 盾持ちの前面ガード判定
        if ((e.type === 'shield' || e.type === 'bossstage8') && G.playerBody) {
            // ボスが疲労または射撃中はガード不能
            if (e.type === 'bossstage8' && (e.bossState === 'fatigued' || e.bossState === 'shooting')) {
                // ガードしない（スルーしてダメージ判定へ）
            } else if (projectile && projectile.props && projectile.props.isNeedle) {
                // とげ / ミサイルは貫通する
            } else {
                const bp = e.body.position;
                let hitPos = G.playerBody.position;
                if (projectile) hitPos = projectile.position || projectile;
                const hx = hitPos.x;
                const hz = hitPos.z;
                
                // 攻撃元から敵への角度
                const attackAngle = Math.atan2(hx - bp.x, hz - bp.z);
                const facing = (e.type === 'bossstage8') ? e.mesh.rotation.y : e.facingAngle;
                let angleDiff = attackAngle - facing;
                while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
                while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
                // 盾の前面±90度以内ならブロック
                if (Math.abs(angleDiff) < Math.PI / 2) {
                    return true; // ヒットはしたがダメージなし
                }
            }
        }

        e.hp -= 1;
        if (e.hp <= 0) {
            e.alive = false;
            RogueState.enemiesAlive--;

            const deathX = e.mesh.position.x;
            const deathY = e.mesh.position.y;
            const deathZ = e.mesh.position.z;

            if (e.mesh && G.scene) G.scene.remove(e.mesh);
            if (e.body && G.world) {
                try { G.world.removeRigidBody(e.body); } catch (_) {}
            }
            if (e.orbiters) {
                e.orbiters.forEach(orb => {
                    if (orb.mesh && G.scene) G.scene.remove(orb.mesh);
                    if (orb.body && G.world) try { G.world.removeRigidBody(orb.body); } catch (_) {}
                });
            }
            if (typeof createExplosion === 'function') {
                createExplosion(deathX, deathY, deathZ);
            }

            updateRogueHUD();
            checkStageClear();
        }
        return true;
    }
    return false;
}

// ── 敵の射撃処理 ──
function rogueEnemyFire(enemy, targetX, targetY, targetZ) {
    if (!G.scene || !G.world) return;
    const bp = enemy.body.position;
    const dx = targetX - bp.x;
    const dy = targetY - bp.y;
    const dz = targetZ - bp.z;
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;

    const speed = 8;
    const vx = (dx / dist) * speed;
    const vy = (dy / dist) * speed;
    const vz = (dz / dist) * speed;

    // 弾丸メッシュ生成
    const bulletGeo = new THREE.SphereGeometry(0.12, 6, 6);
    const bulletMat = new THREE.MeshStandardMaterial({
        color: 0x00ff88,
        emissive: 0x00ff88,
        emissiveIntensity: 0.8
    });
    const bulletMesh = new THREE.Mesh(bulletGeo, bulletMat);
    bulletMesh.position.set(bp.x, bp.y, bp.z);
    G.scene.add(bulletMesh);

    const bullet = {
        mesh: bulletMesh,
        position: new THREE.Vector3(bp.x, bp.y, bp.z),
        velocity: new THREE.Vector3(vx, vy, vz),
        spawnTime: Date.now(),
        alive: true,
    };

    if (!RogueState.enemyBullets) RogueState.enemyBullets = [];
    RogueState.enemyBullets.push(bullet);
}

// ── Spinner敵の方向指定射撃 ──
function rogueEnemyFireDir(enemy, vx, vy, vz) {
    if (!G.scene) return;
    const bp = enemy.body.position;

    const bulletGeo = new THREE.SphereGeometry(0.1, 4, 4);
    const bulletMat = new THREE.MeshStandardMaterial({
        color: 0xff00ff,
        emissive: 0xff00ff,
        emissiveIntensity: 0.6
    });
    const bulletMesh = new THREE.Mesh(bulletGeo, bulletMat);
    bulletMesh.position.set(bp.x, bp.y, bp.z);
    G.scene.add(bulletMesh);

    const bullet = {
        mesh: bulletMesh,
        position: new THREE.Vector3(bp.x, bp.y, bp.z),
        velocity: new THREE.Vector3(vx, vy, vz),
        spawnTime: Date.now(),
        alive: true,
    };

    if (!RogueState.enemyBullets) RogueState.enemyBullets = [];
    RogueState.enemyBullets.push(bullet);
}

// ── SantaBomberの放物線射撃 ──
function rogueEnemyFireArc(enemy, targetX, targetZ, offsetAngle, customVy = 5.0) {
    if (!G.scene) return;
    const bp = enemy.body.position;
    const dx = targetX - bp.x;
    const dz = targetZ - bp.z;
    
    // 目標までの距離と角度
    const dist = Math.sqrt(dx * dx + dz * dz) || 1;
    let baseAngle = Math.atan2(dx, dz);
    baseAngle += offsetAngle;

    // 初速計算 (放物線)
    const speed = 8;
    const vx = Math.sin(baseAngle) * speed;
    const vz = Math.cos(baseAngle) * speed;
    const vy = customVy; // 上方向に飛ばす

    const bulletGeo = new THREE.SphereGeometry(0.2, 8, 8);
    const bulletMat = new THREE.MeshStandardMaterial({
        color: 0xff4444,
        emissive: 0xff0000,
        emissiveIntensity: 0.8
    });
    const bulletMesh = new THREE.Mesh(bulletGeo, bulletMat);
    bulletMesh.position.set(bp.x, bp.y, bp.z);
    G.scene.add(bulletMesh);

    const bullet = {
        mesh: bulletMesh,
        position: new THREE.Vector3(bp.x, bp.y, bp.z),
        velocity: new THREE.Vector3(vx, vy, vz),
        spawnTime: Date.now(),
        alive: true,
        hasGravity: true
    };

    if (!RogueState.enemyBullets) RogueState.enemyBullets = [];
    RogueState.enemyBullets.push(bullet);
}

// ── 敵弾丸の更新（updateRogueEnemiesから呼ばれる） ──
function updateRogueEnemyBullets(dt) {
    if (!RogueState.enemyBullets) return;
    const px = G.playerBody.position.x;
    const py = G.playerBody.position.y + 0.5; // 自機の少し上を参照
    const pz = G.playerBody.position.z;

    for (let i = RogueState.enemyBullets.length - 1; i >= 0; i--) {
        const b = RogueState.enemyBullets[i];
        if (!b.alive) continue;

        // 重力適用
        if (b.hasGravity) {
            b.velocity.y -= 15.0 * dt;
        }
        b.position.addScaledVector(b.velocity, dt);
        b.mesh.position.copy(b.position);

        const age = Date.now() - b.spawnTime;
        const gridX = Math.floor(b.position.x);
        const gridY = Math.floor(b.position.y);
        const gridZ = Math.floor(b.position.z);
        const hitBlock = G.mapGrid.has(`${gridX},${gridY},${gridZ}`);

        const oob = b.position.x < -1 || b.position.x > ROGUE_AREA + 1 ||
                    b.position.z < -1 || b.position.z > ROGUE_AREA + 1 ||
                    b.position.y < 0.1 || hitBlock; // 地面落ち、またはブロック衝突

        // プレイヤーとの衝突
        let hitPlayer = false;
        if (!G.isDead && !G.isInvincible) {
            const hdx = b.position.x - px;
            const hdy = b.position.y - py;
            const hdz = b.position.z - pz;
            if (hdx * hdx + hdy * hdy + hdz * hdz < 0.5 * 0.5) {
                hitPlayer = true;
                if (typeof takeDamage === 'function') {
                    takeDamage(1, 'Enemy');
                }
            }
        }

        if (hitPlayer || oob || age > 5000) {
            b.alive = false;
            if (b.mesh && G.scene) {
                G.scene.remove(b.mesh);
                b.mesh.geometry.dispose();
                b.mesh.material.dispose();
            }
            RogueState.enemyBullets.splice(i, 1);
        }
    }
}

// ── ステージクリア判定 ──
function checkStageClear() {
    if (RogueState.enemiesAlive > 0) return;

    RogueState.stage++;

    if (RogueState.stage >= RogueState.maxStages) {
        // 全クリア
        RogueState.isVictory = true;
        RogueState.isStageClearShowing = true;
        RogueState.stageClearTimer = 2.0;
        showRogueStageClear('ALL STAGES CLEAR!');
    } else {
        // 4ステージごとに報酬
        if (RogueState.stage % 4 === 0 && typeof showRewardScreen === 'function') {
            RogueState.isStageClearShowing = true;
            RogueState.stageClearTimer = 1.5;
            RogueState.pendingReward = true;
            showRogueStageClear(`STAGE ${RogueState.stage} CLEAR! — REWARD!`);
        } else {
            // 次のステージへ
            RogueState.isStageClearShowing = true;
            RogueState.stageClearTimer = 1.5;
            showRogueStageClear(`STAGE ${RogueState.stage} CLEAR!`);
        }
    }
}

// ── ローグライク敵かどうかの判定（物理ボディから） ──
function isRogueEnemy(body) {
    if (!RogueState.isActive) return false;
    for (let i = 0; i < RogueState.enemies.length; i++) {
        if (RogueState.enemies[i].alive && RogueState.enemies[i].body === body) return true;
    }
    return false;
}

// ── HUD更新 ──
function updateRogueHUD() {
    const stageEl = document.getElementById('rogue-stage');
    const enemiesEl = document.getElementById('rogue-enemies');
    if (stageEl) stageEl.textContent = `STAGE ${RogueState.stage + 1} / ${RogueState.maxStages}`;
    if (enemiesEl) enemiesEl.textContent = `ENEMIES: ${RogueState.enemiesAlive}`;
}

// ── ステージクリア演出 ──
function showRogueStageClear(text) {
    let el = document.getElementById('rogue-stage-clear');
    if (!el) {
        el = document.createElement('div');
        el.id = 'rogue-stage-clear';
        el.style.cssText = 'position:absolute; top:40%; left:50%; transform:translate(-50%,-50%); font-size:48px; font-weight:900; color:#fff; text-shadow:0 0 30px rgba(100,180,255,0.8); z-index:2000; pointer-events:none; letter-spacing:6px; text-align:center;';
        document.body.appendChild(el);
    }
    el.textContent = text;
    el.style.display = 'block';
}

function hideRogueStageClear() {
    const el = document.getElementById('rogue-stage-clear');
    if (el) el.style.display = 'none';
}

// ── 全クリア勝利演出 ──
function showRogueVictory() {
    RogueState.isActive = false;

    let el = document.getElementById('rogue-victory');
    if (!el) {
        el = document.createElement('div');
        el.id = 'rogue-victory';
        el.style.cssText = 'position:absolute; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.7); display:flex; flex-direction:column; align-items:center; justify-content:center; z-index:3000; pointer-events:auto;';
        el.innerHTML = `
            <div style="font-size:14px; color:#64b4ff; letter-spacing:8px; margin-bottom:12px; font-weight:800;">ALL 32 STAGES</div>
            <div style="font-size:64px; font-weight:900; color:#fff; text-shadow:0 0 40px rgba(100,180,255,0.6); letter-spacing:8px; margin-bottom:30px;">VICTORY!</div>
            <button id="rogue-back-btn" style="padding:12px 30px; background:#0ea5e9; border:none; color:white; border-radius:6px; cursor:pointer; font-weight:bold; letter-spacing:2px; font-size:14px;">BACK TO MENU</button>
        `;
        document.body.appendChild(el);
        document.getElementById('rogue-back-btn').addEventListener('click', () => {
            el.style.display = 'none';
            resetToHome();
        });
    }
    el.style.display = 'flex';
}

// ── リセット（resetToHome から呼ばれる） ──
function resetRoguelike() {
    clearRogueEnemies();
    RogueState.isActive = false;
    RogueState.stage = 0;
    RogueState.isStageClearShowing = false;
    RogueState.isVictory = false;
    hideRogueStageClear();

    const hud = document.getElementById('rogue-hud');
    if (hud) hud.classList.add('hidden');
    const victory = document.getElementById('rogue-victory');
    if (victory) victory.style.display = 'none';
}
