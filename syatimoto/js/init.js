// ═══════════════════════════════════════════════════════
//  init.js — ゲーム初期化・リセット・メインループ (animate)
// ═══════════════════════════════════════════════════════
'use strict';

function resetConfigToDefaults() {
    // movement カテゴリのデフォルト値
    config.playerSpeed = 6.0;
    config.jumpVelocity = 2.6;
    config.jumpMultiplier = 0.65;
    config.holdBoost = 0.38;
    config.maxHoldTime = 9;

    // projectile カテゴリのデフォルト値
    config.projectileRecoveryRate = 1.0;
    config.damageProjectile = 1; 
    config.projectileSpeed = 20.0;
    config.maxProjectileStock = 2;
    config.projectileRadiusMult = 1.0;
    config.projectileSplit = 1;
    config.projectilePassWall = false;
    config.projectileBounces = 0;
    config.projectileRangeMult = 1.0;
    config.projectileAutoFire = false;
    config.projectileIsNeedle = false;

    // bubble カテゴリのデフォルト値
    config.bubbleRecoveryRate = 0.18;
    config.damageBubble = 2;
    config.bubbleSpeedY = 5.0;
    config.maxBubbleStock = 2;
    config.bubbleSplit = 1;

    // ゲージ残量を0から始める（リロードされる挙動にする）
    G.playerProjectileStock = 0;
    G.playerBubbleStock = 0;
    if (typeof updateAmmoHUD === 'function') updateAmmoHUD();

    // K/D
    G.myKills = 0;
    G.myDeaths = 0;
    G.peerStats.clear();
    // Invincibility
    G.isInvincible = false;
    G.invincibilityTimer = 0;
    if (typeof resetUpgradeDisplay === 'function') resetUpgradeDisplay();

    // スコープ状態をリセット
    G.isScopedIn = false;
    const overlay = document.getElementById('scope-overlay');
    if (overlay) overlay.style.display = 'none';
}

function resetToHome() {
    // ホストがホームに戻る場合、クライアントに通知
    if (G.isHost && G.isOnline) {
        broadcastEvent(20, {});
    }

    G.isStarted = false;
    G.isGoalReached = false;
    G.isDead = false;
    if (G.deathTextEl) G.deathTextEl.style.display = 'none';
    G.mapInitialized = false;
    if (typeof teardownControls === 'function') teardownControls();
    G.controls = null;
    if (G.animFrameId !== null) cancelAnimationFrame(G.animFrameId);

    const elList = document.getElementById('entity-list'); if (elList) elList.innerHTML = '';
    const elHeight = document.getElementById('height-display'); if (elHeight) elHeight.innerText = '0m';
    const elStart = document.getElementById('start-screen'); if (elStart) elStart.style.display = 'flex';
    const elUiLayer = document.getElementById('ui-layer'); if (elUiLayer) elUiLayer.style.display = 'none';
    const elHome = document.getElementById('home-button'); if (elHome) elHome.classList.add('hidden');
    const elTutUI = document.getElementById('tutorial-ui'); if (elTutUI) elTutUI.classList.add('hidden');
    const elMpUI = document.getElementById('multiplayer-ui'); if (elMpUI) elMpUI.classList.remove('hidden');
    const btnMain = document.getElementById('btn-main'); if (btnMain) btnMain.style.display = 'block';
    const btnTut = document.getElementById('btn-tutorial'); if (btnTut) btnTut.style.display = 'block';

    if (G.world) G.world.clear();
    if (G.scene) { while (G.scene.children.length > 0) G.scene.remove(G.scene.children[0]); }
    if (G.renderer) {
        G.renderer.dispose();
        if (G.renderer.domElement.parentNode) document.body.removeChild(G.renderer.domElement);
        G.renderer = null;
    }
    const guiEl = document.querySelector('.dg.ac');
    if (guiEl) guiEl.remove();

    G.entities.length = 0;
    G.mapObjects.length = 0;
    G.mapGrid.clear();
    G.pendingBlocks.length = 0;
    G.membranes.length = 0;
    G.walls.length = 0;
    G.warningTapes.length = 0;
    G.hitboxHelpers.length = 0;
    G.projectiles.forEach(p => { G.scene.remove(p.mesh); });
    G.projectiles.length = 0;
    G.bubbles.length = 0;
    G.explosions.forEach(exp => { G.scene.remove(exp.mesh); });
    G.explosions.length = 0;
    G.projectilePool.forEach(m => G.scene.remove(m)); G.projectilePool.length = 0;
    G.bubblePool.forEach(m => G.scene.remove(m)); G.bubblePool.length = 0;
    G.explosionPool.forEach(m => G.scene.remove(m)); G.explosionPool.length = 0;
    G.netObjects.forEach((mesh) => { if (G.scene) G.scene.remove(mesh); });
    G.netObjects.clear();
    // ネットワークプレイヤーのメッシュもシーンから削除してクリア（再接続時に再生成される）
    G.networkEntities.forEach(ent => {
        if (ent.mesh && G.scene) G.scene.remove(ent.mesh);
    });
    G.networkEntities.clear();
    // G.peerNames.clear(); // ロビーで再接続なしにプレイを続けるため、名前は保持する
    G._netEntIndexCounter = 11;
    G.netIdCounter = 0;
    if (G.mapInstancedMesh) { G.scene.remove(G.mapInstancedMesh); G.mapInstancedMesh = null; }
    if (G.lowPolyMapInstancedMesh) { G.scene.remove(G.lowPolyMapInstancedMesh); G.lowPolyMapInstancedMesh = null; }
    G.freeInstanceIndices = [];
    G.freeLowPolyInstanceIndices = [];
    for (let i = MAX_BLOCKS - 1; i >= 0; i--) {
        G.freeInstanceIndices.push(i);
        G.freeLowPolyInstanceIndices.push(i);
    }
    if (typeof initWorker === 'function') initWorker();
    G.nextMilestoneY = 50;
    G.upgrades = { sphere: 0, bubble: 0 };
    G.jumpCount = 0;
    G.nextChunkY = 0;
    G.highestY = 0;
    G.startTime = 0;
    G.lapTimes = [];
    resetConfigToDefaults();
    if (typeof updateAmmoHUD === 'function') updateAmmoHUD();
    if (window.startMenuOcean) window.startMenuOcean();
}

function init() {
    resetConfigToDefaults();
    if (typeof initAIModel === 'function' && !window.aiModel) initAIModel();

    G.scene = new THREE.Scene();
    G.scene.background = new THREE.Color(0x001122);
    G.scene.fog = new THREE.Fog(0x001122, 0, 75);
    G.camera = new THREE.PerspectiveCamera(75, innerWidth / innerHeight, 0.1, 5000);

    G.renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: "high-performance" });
    G.renderer.setSize(innerWidth, innerHeight);
    G.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    G.renderer.shadowMap.enabled = true;
    G.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    G.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    G.renderer.toneMappingExposure = config.brightness;
    document.body.appendChild(G.renderer.domElement);

    G.ambientLight = new THREE.AmbientLight(0xffffff, 0.80);
    G.scene.add(G.ambientLight);
    G.d1 = new THREE.DirectionalLight(0xffffff, 0.42); G.d1.position.set(2000, 3000, 2000); G.scene.add(G.d1);
    G.d2 = new THREE.DirectionalLight(0xffffff, 0.42); G.d2.position.set(-2000, 3000, 2000); G.scene.add(G.d2);
    G.d3 = new THREE.DirectionalLight(0xffffff, 0.42); G.d3.position.set(2000, 3000, -2000); G.scene.add(G.d3);
    G.d4 = new THREE.DirectionalLight(0xffffff, 0.42); G.d4.position.set(-2000, 3000, -2000); G.scene.add(G.d4);

    G.d1.castShadow = true;
    G.d1.shadow.camera.left = G.d1.shadow.camera.bottom = -50;
    G.d1.shadow.camera.right = G.d1.shadow.camera.top = 50;
    G.d1.shadow.camera.near = 0.5;
    G.d1.shadow.camera.far = 500;
    G.d1.shadow.mapSize.set(2048, 2048);
    G.d1.shadow.bias = -0.0001;
    G.d1.shadow.normalBias = 0.17;

    // 海面（高度な海面に一本化）
    if (THREE.Water) {
        const waterGeometry = new THREE.PlaneGeometry(2000, 2000);
        G.water = new THREE.Water(
            waterGeometry,
            {
                textureWidth: 512,
                textureHeight: 512,
                waterNormals: new THREE.TextureLoader().load('https://cdn.jsdelivr.net/gh/mrdoob/three.js@r128/examples/textures/waternormals.jpg', function (texture) {
                    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
                }),
                sunDirection: new THREE.Vector3(20, 30, 20).normalize(),
                sunColor: 0xffffff,
                waterColor: 0x00aaff,
                distortionScale: 3.7,
                alpha: 0.85,
                fog: G.scene.fog !== undefined
            }
        );
        G.water.rotation.x = -Math.PI / 2;
        G.water.position.set(config.areaSize / 2, -0.55, config.areaSize / 2);
        if (G.water.material.uniforms['size']) G.water.material.uniforms['size'].value = 20.0;
        G.scene.add(G.water);
    }

    if (G.skyTexture) { G.scene.background = G.skyTexture; G.scene.environment = G.skyTexture; }
    G.scene.fog.color.set(0x001122);

    G.mapInstancedMesh = new THREE.InstancedMesh(G.sharedBlockGeo, G.sharedBlockMat, MAX_BLOCKS);
    G.mapInstancedMesh.castShadow = true;
    G.mapInstancedMesh.receiveShadow = true;
    
    G.lowPolyMapInstancedMesh = new THREE.InstancedMesh(G.sharedBlockGeo, G.sharedLowPolyBlockMat, MAX_BLOCKS);
    G.lowPolyMapInstancedMesh.castShadow = false;
    G.lowPolyMapInstancedMesh.receiveShadow = true;

    G.dummy.scale.set(0, 0, 0);
    for (let i = 0; i < MAX_BLOCKS; i++) { 
        G.dummy.updateMatrix(); 
        G.mapInstancedMesh.setMatrixAt(i, G.dummy.matrix); 
        G.lowPolyMapInstancedMesh.setMatrixAt(i, G.dummy.matrix);
    }
    G.mapInstancedMesh.instanceMatrix.needsUpdate = true;
    G.lowPolyMapInstancedMesh.instanceMatrix.needsUpdate = true;
    G.scene.add(G.mapInstancedMesh);
    G.scene.add(G.lowPolyMapInstancedMesh);

    G.world = new OIMO.World({ gravity: [0, config.gravity, 0], iterations: 24, info: false });

    createPlayer();
    if (!G.isOnline || G.isHost) {
        for (let i = 0; i < config.aiCount; i++) createAI(`AI-${i + 1}`, i + 1);
    }

    if (G.currentMode === 'tutorial') {
        document.getElementById('tutorial-ui').classList.remove('hidden');
        createFloor(27, 50); initTapes(27, 50); buildTutorialMap(); createInvisibleWalls(27, 50);
        if (G.playerBody) G.playerBody.resetPosition(1.5, 5.0, 1.5);
        setTimeout(() => { 
            if (G.playerBody) G.playerBody.resetPosition(1.5, 5.0, 1.5);
            G.entities.forEach((ent, idx) => { ent.body.resetPosition(1.5 + idx * 0.5, 5.0, 1.5); }); 
        }, 100);
        document.getElementById('start-screen').style.display = 'none';
    } else {
        createFloor(config.areaSize, config.areaSize);
        initTapes(config.areaSize, config.areaSize);
        createInvisibleWalls(config.areaSize, config.areaSize);
        G.highestY = 0;
        generateChunk(0);
        if (G.isOnline && !G.isHost) document.getElementById('start-screen').style.display = 'none';
        else document.getElementById('start-screen').style.display = 'flex';
    }

    setupControls();

    // タイムトライアル初期化
    G.timeTrialPath = [];
    G.frameCount = 0;
    G._finalTimeStr = null;
    if (typeof initGhosts === 'function') initGhosts();

    G.controls.addEventListener('lock', () => { 
        document.getElementById('start-screen').style.display = 'none'; 
        document.getElementById('home-button').classList.add('hidden'); 
        document.getElementById('reward-screen').style.pointerEvents = 'none';
    });
    G.controls.addEventListener('unlock', () => { 
        document.getElementById('home-button').classList.remove('hidden'); 
        document.getElementById('reward-screen').style.pointerEvents = 'auto';
    });

    // 鳥システム
    window.birds = [];
    window.lastBirdSpawnTime = 0;
    window.createBirdMesh = function() {
        if (!G.birdModel) return null;
        const group = G.birdModel.clone();
        let mixer = null;
        if (G.birdAnimations && G.birdAnimations.length > 0) {
            mixer = new THREE.AnimationMixer(group);
            const action = mixer.clipAction(G.birdAnimations[0]);
            action.play();
            action.time = Math.random() * G.birdAnimations[0].duration;
        }
        return { group, mixer, wingL: group.getObjectByName("WingL"), wingR: group.getObjectByName("WingR") };
    };
    window.spawnBirds = function() {
        const count = 10 + Math.floor(Math.random() * 10);
        const angle = Math.random() * Math.PI * 2;
        const spawnDist = 50;
        const center = new THREE.Vector3(config.areaSize/2, 0, config.areaSize/2);
        const startX = center.x + Math.cos(angle) * spawnDist;
        const startZ = center.z + Math.sin(angle) * spawnDist;
        const pY = G.playerBody ? G.playerBody.position.y : 0;
        const startY = pY + 5 + Math.random() * 10;
        const targetAngle = angle + Math.PI + (Math.random() * 0.4 - 0.2);
        const dirX = Math.cos(targetAngle), dirZ = Math.sin(targetAngle);
        for (let i=0; i<count; i++) {
            const b = window.createBirdMesh();
            if (!b) continue;
            b.group.position.set(startX + (Math.random()-0.5)*15, startY + (Math.random()-0.5)*10, startZ + (Math.random()-0.5)*15);
            b.group.lookAt(b.group.position.x + dirX, b.group.position.y, b.group.position.z + dirZ);
            G.scene.add(b.group);
            window.birds.push({ 
                mesh: b.group, 
                mixer: b.mixer,
                wingL: b.wingL, 
                wingR: b.wingR, 
                dir: new THREE.Vector3(dirX, 0, dirZ).normalize(), 
                speed: (12 + Math.random() * 4) * 0.6, 
                wingPhase: Math.random() * Math.PI * 2, 
                distance: 0 
            });
        }
    };

    // DOM要素キャッシュ
    G.heightEl = document.getElementById('height-display');
    G.timeEl = document.getElementById('time-display');
    G.airEl = document.getElementById('air-indicator');
    G.entityListEl = document.getElementById('entity-list');

    initGUI();
    G.isGoalReached = false;
    if (G.isOnline && typeof broadcastEvent === 'function') {
        broadcastEvent(5, { id: G.myPeerId, name: G.myPlayerName });
    }
    animate();
}
