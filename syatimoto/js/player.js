// ═══════════════════════════════════════════════════════
//  player.js — プレイヤー生成・入力・コントロール
// ═══════════════════════════════════════════════════════
'use strict';

'use strict';

function addHitboxHelper(body, size, type = 'box') {
    const geo = (type === 'sphere')
        ? new THREE.SphereGeometry(size[0], 12, 12)
        : new THREE.BoxGeometry(size[0], size[1], size[2]);

    const wire = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0x00ff00, wireframe: true, depthTest: false, transparent: true, opacity: 0.8 }));
    wire.renderOrder = 999;
    G.scene.add(wire);
    G.hitboxHelpers.push({ mesh: wire, body: body });
    return wire;
}

function createPlayer(entIndex = 0) {
    const spawnX = config.areaSize / 2 + 0.5;
    const spawnY = 0.25;
    const spawnZ = config.areaSize / 2 + 0.5;

    const belongsToLayer = 1 << (entIndex + 1);
    const dedicatedFloorLayer = 1 << (entIndex + 17);
    const collidesWithLayer = 1 | dedicatedFloorLayer | BUBBLE_LAYER | PROJECTILE_LAYER;

    G.playerBody = G.world.add({
        type: 'sphere',
        size: [0.37],
        pos: [spawnX, spawnY, spawnZ],
        move: true,
        belongsTo: belongsToLayer,
        collidesWith: collidesWithLayer,
        density: 1, friction: 0.7, restitution: 0
    });
    G.playerBody.allowSleep = false;

    addHitboxHelper(G.playerBody, [0.37], 'sphere');

    if (G.playerModel) {
        G.playerMesh = G.playerModel.clone();
    } else {
        G.playerMesh = new THREE.Mesh(
            new THREE.BoxGeometry(0.5, 0.5, 0.5),
            new THREE.MeshStandardMaterial({ color: 0x64b4ff, emissive: 0x224488, metalness: 0.68, roughness: 0.3 })
        );
    }
    G.playerMesh.castShadow = true;

    const xrayMat = new THREE.MeshBasicMaterial({
        color: 0xffaa33,
        transparent: true,
        opacity: 0.5,
        depthFunc: THREE.GreaterDepth,
        depthWrite: false,
        stencilWrite: true,
        stencilRef: 1,
        stencilFunc: THREE.NotEqualStencilFunc
    });

    let xrayMesh;
    if (G.playerModel) {
        xrayMesh = G.playerModel.clone();
        xrayMesh.scale.set(1, 1, 1);
        xrayMesh.traverse((node) => {
            if (node.isMesh) {
                node.material = xrayMat;
            }
        });
    } else {
        xrayMesh = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), xrayMat);
    }
    G.playerMesh.add(xrayMesh);

    G.playerMesh.add(xrayMesh);

    G.scene.add(G.playerMesh);

    G.entities.push({
        name: G.myPlayerName || G.myPeerId || 'GUEST',
        body: G.playerBody,
        mesh: G.playerMesh,
        isAI: false,
        entIndex: entIndex,
        groundContactFrames: 0,
        currentMembraneY: -Infinity,
        dedicatedMembraneFloor: null
    });
}

function handleJump(isSpacePressed) {
    const vel = G.playerBody.linearVelocity;

    if (isSpacePressed && !G.lastSpaceState) {
        if (G.isGrounded || G.jumpCount < G.maxJumps) {
            const force = G.isGrounded ? config.jumpVelocity : config.jumpVelocity * config.jumpMultiplier;
            vel.y = force;
            G.jumpCount++;
            G.isGrounded = false;
            G.isJumping = true;
            G.jumpTimer = 0;
            G.minJumpInterval = 0;
        }
    }

    if (isSpacePressed && G.isJumping && vel.y > 0) {
        if (G.jumpTimer < config.maxHoldTime) {
            vel.y += config.holdBoost;
            G.jumpTimer++;
        }
    } else {
        G.isJumping = false;
    }

    G.lastSpaceState = isSpacePressed;
}

function applyMouseSensitivity() {
    if (G.controls) {
        G.controls.pointerSpeed = config.mouseSensitivity || 1.0;
    }
}

function setupControls() {
    G.controls = new THREE.PointerLockControls(G.camera, document.body);
    // 初期化後に保存済み感度を即時反映
    applyMouseSensitivity();

    window.addEventListener('keyup', (e) => {
        if (e.code === 'KeyW') G.keys.w = false;
        if (e.code === 'KeyA') G.keys.a = false;
        if (e.code === 'KeyS') G.keys.s = false;
        if (e.code === 'KeyD') G.keys.d = false;
        if (e.code === 'Space') G.keys.space = false;
        if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') G.keys.shift = false;
    });

    const _sensEuler = new THREE.Euler(0, 0, 0, 'YXZ');
    document.addEventListener('mousemove', (e) => {
        if (G.controls && G.controls.isLocked) {
            const sens = config.mouseSensitivity !== undefined ? config.mouseSensitivity : 1.0;
            const extraMultiplier = sens - 1.0;
            
            // デバッグ用のコンソールログ出力（0.1秒に1回程度の頻度に制限して出力）
            if (!G._lastSensLog || Date.now() - G._lastSensLog > 1000) {
                console.log(`[Mouse] sens=${sens}, extraMultiplier=${extraMultiplier}`);
                G._lastSensLog = Date.now();
            }

            if (Math.abs(extraMultiplier) > 0.001) {
                const movementX = e.movementX || e.mozMovementX || e.webkitMovementX || 0;
                const movementY = e.movementY || e.mozMovementY || e.webkitMovementY || 0;
                _sensEuler.setFromQuaternion(G.camera.quaternion);
                _sensEuler.y -= movementX * 0.002 * extraMultiplier;
                _sensEuler.x -= movementY * 0.002 * extraMultiplier;
                const PI_2 = Math.PI / 2;
                _sensEuler.x = Math.max(PI_2 - G.controls.maxPolarAngle, Math.min(PI_2 - G.controls.minPolarAngle, _sensEuler.x));
                G.camera.quaternion.setFromEuler(_sensEuler);
            }
        }
    });
    window.addEventListener('mousedown', (e) => {
        if (e.button === 0 && G.controls.isLocked) G.keys.space = true;
        if (e.button === 2 && G.controls.isLocked) {
            if (config.raceType === 'TIME TRIAL') {
                return;
            }
            G.keys.rightClick = true;
            if (!document.getElementById('reward-screen').classList.contains('hidden')) return;

            if (config.projectileRequiresScope) {
                if (!G.isScopedIn) {
                    // 第1段階：スコープイン（空中でも可能にする）
                    G.isScopedIn = true;
                    const overlay = document.getElementById('scope-overlay');
                    if (overlay) overlay.style.display = 'block';
                    return;
                } else {
                    // 第2段階：スコープ済み → 発射試行
                    // 接地していない場合は発射せずにスコープ解除（キャンセル）
                    // 垂直速度がほぼゼロなら接地とみなす(保険)
                    const isPhysicallyGrounded = G.isGrounded || Math.abs(G.playerBody.linearVelocity.y) < 0.2;

                    if (!isPhysicallyGrounded) {
                        G.isScopedIn = false;
                        const overlay = document.getElementById('scope-overlay');
                        if (overlay) overlay.style.display = 'none';
                        return;
                    }

                    const now = Date.now();
                    const projCooldown = 500 / (config.projectileRecoveryRate || 1);
                    const timeDiff = now - G.lastFireTimeProjectile;

                    if (timeDiff >= projCooldown && G.playerProjectileStock >= 1.0) {
                        G.lastFireTimeProjectile = now;
                        G.playerProjectileStock -= 1.0;
                        updateAmmoHUD();
                        requestFire(0);
                    }
                    // 発射後スコープ解除
                    G.isScopedIn = false;
                    const overlay = document.getElementById('scope-overlay');
                    if (overlay) overlay.style.display = 'none';
                }
            } else {
                // 通常武器：スコープなしで即発射
                const now = Date.now();
                const projCooldown = 500 / (config.projectileRecoveryRate || 1);
                if (now - G.lastFireTimeProjectile >= projCooldown && G.playerProjectileStock >= 1.0) {
                    requestFire(0);
                    G.lastFireTimeProjectile = now;
                    G.playerProjectileStock -= 1.0;
                    updateAmmoHUD();
                }
            }
        }
    });
    window.addEventListener('mouseup', (e) => {
        if (e.button === 0) G.keys.space = false;
        if (e.button === 2) G.keys.rightClick = false;
    });
    window.addEventListener('contextmenu', (e) => {
        if (G.controls.isLocked) e.preventDefault();
    });

    window.addEventListener('keydown', (e) => {
        if (!G.isStarted) return;
        if (e.code === 'KeyW') G.keys.w = true;
        if (e.code === 'KeyA') G.keys.a = true;
        if (e.code === 'KeyS') G.keys.s = true;
        if (e.code === 'KeyD') G.keys.d = true;
        if (e.code === 'Space') { e.preventDefault(); G.keys.space = true; }
        
        if (G.controls.isLocked) {
            if (e.key === 'b' || e.key === 'B' || e.key === 'q' || e.key === 'Q') {
                if (!document.getElementById('reward-screen').classList.contains('hidden')) return;
                if (config.raceType === 'TIME TRIAL') {
                    return;
                }
                const now = Date.now();
                const bubbleCooldown = 500 / (config.bubbleRecoveryRate || 1);
                if (now - G.lastFireTimeBubble >= bubbleCooldown && G.playerBubbleStock >= 1.0) {
                    G.lastFireTimeBubble = now;
                    G.playerBubbleStock -= 1.0;
                    updateAmmoHUD();
                    requestFire(1);
                }
            }
        }
    });

    window.addEventListener('wheel', (e) => {
        if (G.controls.isLocked) {
            // スコープモード用に追加で 0.0 までスクロール可能にする
            G.camDist = Math.max(0.0, Math.min(5.0, G.camDist + e.deltaY * 0.005));
        }
    }, { passive: true });

    window.addEventListener('resize', () => {
        G.camera.aspect = window.innerWidth / window.innerHeight;
        G.camera.updateProjectionMatrix();
        if (G.renderer) G.renderer.setSize(window.innerWidth, window.innerHeight);
    });
}
