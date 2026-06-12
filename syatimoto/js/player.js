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


const _sensEuler = new THREE.Euler(0, 0, 0, 'YXZ');

function _onMouseMove(e) {
    if (!G.controls || !G.controls.isLocked) return;
    const sens = config.mouseSensitivity !== undefined ? config.mouseSensitivity : 1.0;
    const extraMultiplier = sens - 1.0;
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

function _onKeyUp(e) {
    if (e.code === 'KeyW') G.keys.w = false;
    if (e.code === 'KeyA') G.keys.a = false;
    if (e.code === 'KeyS') G.keys.s = false;
    if (e.code === 'KeyD') G.keys.d = false;
    if (e.code === 'Space') G.keys.space = false;
    if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') G.keys.shift = false;
}

function _onMouseDown(e) {
    if (e.button === 0 && G.controls.isLocked) G.keys.space = true;
    if (e.button === 2 && G.controls.isLocked) {
        console.log(`[FIRE] rightclick. raceType=${config.raceType}, currentMode=${G.currentMode}`);
        if (G.isDead || (config.raceType === 'TIME TRIAL' && G.currentMode !== 'tutorial')) {
            console.log('[FIRE] Blocked by TIME TRIAL guard.');
            return;
        }
        G.keys.rightClick = true;
        if (!document.getElementById('reward-screen').classList.contains('hidden')) return;
        if (config.projectileRequiresScope) {
            if (!G.isScopedIn) {
                G.isScopedIn = true;
                const overlay = document.getElementById('scope-overlay');
                if (overlay) overlay.style.display = 'block';
                return;
            } else {
                const isPhysicallyGrounded = G.isGrounded || Math.abs(G.playerBody.linearVelocity.y) < 0.2;
                if (!isPhysicallyGrounded) {
                    G.isScopedIn = false;
                    const overlay = document.getElementById('scope-overlay');
                    if (overlay) overlay.style.display = 'none';
                    return;
                }
                const now = Date.now();
                const projCooldown = 500 / (config.projectileRecoveryRate || 1);
                console.log(`[PROJ] cooldown=${projCooldown.toFixed(0)}ms, elapsed=${(now - G.lastFireTimeProjectile).toFixed(0)}ms, stock=${G.playerProjectileStock.toFixed(2)}`);
                if (now - G.lastFireTimeProjectile >= projCooldown && G.playerProjectileStock >= 1.0) {
                    G.lastFireTimeProjectile = now;
                    G.playerProjectileStock -= 1.0;
                    updateAmmoHUD();
                    requestFire(0);
                }
                G.isScopedIn = false;
                const overlay = document.getElementById('scope-overlay');
                if (overlay) overlay.style.display = 'none';
            }
        } else {
            const now = Date.now();
            const projCooldown = 500 / (config.projectileRecoveryRate || 1);
            console.log(`[PROJ] cooldown=${projCooldown.toFixed(0)}ms, elapsed=${(now - G.lastFireTimeProjectile).toFixed(0)}ms, stock=${G.playerProjectileStock.toFixed(2)}`);
            if (now - G.lastFireTimeProjectile >= projCooldown && G.playerProjectileStock >= 1.0) {
                requestFire(0);
                G.lastFireTimeProjectile = now;
                G.playerProjectileStock -= 1.0;
                updateAmmoHUD();
            }
        }
    }
}

function _onMouseUp(e) {
    if (e.button === 0) G.keys.space = false;
    if (e.button === 2) G.keys.rightClick = false;
}

function _onContextMenu(e) {
    if (G.controls.isLocked) e.preventDefault();
}

function _onKeyDown(e) {
    if (!G.isStarted) return;
    if (e.code === 'KeyW') G.keys.w = true;
    if (e.code === 'KeyA') G.keys.a = true;
    if (e.code === 'KeyS') G.keys.s = true;
    if (e.code === 'KeyD') G.keys.d = true;
    if (e.code === 'Space') { e.preventDefault(); G.keys.space = true; }
    if (G.controls.isLocked) {
        if (e.key === 'b' || e.key === 'B' || e.key === 'q' || e.key === 'Q') {
            console.log(`[FIRE] bubble key. raceType=${config.raceType}, currentMode=${G.currentMode}`);
            if (G.isDead || (config.raceType === 'TIME TRIAL' && G.currentMode !== 'tutorial')) {
                console.log('[FIRE] Bubble blocked by TIME TRIAL guard.');
                return;
            }
            if (!document.getElementById('reward-screen').classList.contains('hidden')) return;
            const now = Date.now();
            console.log(`[BUBBLE] cooldown=180ms, elapsed=${(now - G.lastFireTimeBubble).toFixed(0)}ms, stock=${G.playerBubbleStock.toFixed(2)}`);
            if (now - G.lastFireTimeBubble >= 180 && G.playerBubbleStock >= 1.0) {
                G.lastFireTimeBubble = now;
                G.playerBubbleStock -= 1.0;
                updateAmmoHUD();
                requestFire(1);
            }
        }
    }
}

function _onWheel(e) {
    if (G.controls.isLocked)
        G.camDist = Math.max(0.0, Math.min(5.0, G.camDist + e.deltaY * 0.005));
}

function _onResize() {
    G.camera.aspect = window.innerWidth / window.innerHeight;
    G.camera.updateProjectionMatrix();
    if (G.renderer) G.renderer.setSize(window.innerWidth, window.innerHeight);
}

function teardownControls() {
    if (G.controls) G.controls.dispose();
    document.removeEventListener('mousemove',  _onMouseMove);
    window.removeEventListener('keyup',        _onKeyUp);
    window.removeEventListener('mousedown',    _onMouseDown);
    window.removeEventListener('mouseup',      _onMouseUp);
    window.removeEventListener('contextmenu',  _onContextMenu);
    window.removeEventListener('keydown',      _onKeyDown);
    window.removeEventListener('wheel',        _onWheel);
    window.removeEventListener('resize',       _onResize);
}

function setupControls() {
    teardownControls();
    G.controls = new THREE.PointerLockControls(G.camera, document.body);
    applyMouseSensitivity();

    document.addEventListener('mousemove',  _onMouseMove);
    window.addEventListener('keyup',        _onKeyUp);
    window.addEventListener('mousedown',    _onMouseDown);
    window.addEventListener('mouseup',      _onMouseUp);
    window.addEventListener('contextmenu',  _onContextMenu);
    window.addEventListener('keydown',      _onKeyDown);
    window.addEventListener('wheel',        _onWheel, { passive: true });
    window.addEventListener('resize',       _onResize);
}
