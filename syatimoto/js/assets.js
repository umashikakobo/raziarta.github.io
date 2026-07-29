// ═══════════════════════════════════════════════════════
//  assets.js — ローダー初期化 & アセット読み込み
// ═══════════════════════════════════════════════════════
'use strict';

function initAssets() {
    // --- Loading Manager ---
    G.loadingManager = new THREE.LoadingManager();
    G.loadingManager.onProgress = (url, loaded, total) => {
        const progress = (loaded / total) * 100;
        const bar = document.getElementById('loading-bar');
        const text = document.getElementById('loading-text');
        if (bar) bar.style.width = progress + '%';
        if (text) text.innerText = Math.round(progress);
    };
    G.loadingManager.onLoad = () => {
        const screen = document.getElementById('loading-screen');
        if (screen) {
            screen.style.opacity = '0';
            setTimeout(() => screen.style.display = 'none', 500);
        }
        // 全てのボタンを有効化
        document.querySelectorAll('#start-screen button').forEach(b => {
            b.disabled = false;
            b.style.opacity = '1';
            b.style.cursor = 'pointer';
        });
        console.log("All assets loaded.");
    };

    G.loader = new THREE.GLTFLoader(G.loadingManager);
    const dracoLoader = new THREE.DRACOLoader();
    dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.4.1/');
    G.loader.setDRACOLoader(dracoLoader);

    G.textureLoader = new THREE.TextureLoader(G.loadingManager);
    G.exrLoader = new THREE.EXRLoader(G.loadingManager);
    G.rgbeLoader = new THREE.RGBELoader(G.loadingManager);

    // ── 共有ジオメトリ・マテリアル ──
    G.sharedProjectileGeo = new THREE.SphereGeometry(0.127, 8, 8);
    G.sharedProjectileMat = new THREE.MeshStandardMaterial({
        color: 0xffffff, emissive: 0x444444, metalness: 0.8, roughness: 0.2
    });
    // 四角錐（ニードル）
    G.sharedNeedleGeo = new THREE.ConeGeometry(0.08, 0.5, 4);
    G.sharedNeedleGeo.rotateX(Math.PI / 2); // 前方を向かせる
    
    G.sharedExplosionGeo = new THREE.SphereGeometry(1, 16, 12);
    G.sharedExplosionMat = new THREE.MeshLambertMaterial({
        color: 0xffaa00, emissive: 0xff6600, transparent: true, opacity: 1, side: THREE.DoubleSide
    });
    G.sharedBubbleGeo = new THREE.SphereGeometry(2, 16, 16);

    // ── スカイマップの事前ロード ──
    G.rgbeLoader.load('texture/citrus_orchard_puresky_4k.hdr', (tex) => {
        tex.mapping = THREE.EquirectangularReflectionMapping;
        G.skyTexture = tex;
    });

    // ── 十字架モデル (Procedural) ──
    const crossGroup = new THREE.Group();
    const crossMat = new THREE.MeshStandardMaterial({ color: 0x555555, metalness: 0.2, roughness: 0.9 });
    const vGeo = new THREE.CylinderGeometry(0.12, 0.12, 1.8, 12);
    const vMesh = new THREE.Mesh(vGeo, crossMat);
    vMesh.position.y = 0.9;
    vMesh.castShadow = true; vMesh.receiveShadow = true;
    const hGeo = new THREE.CylinderGeometry(0.1, 0.1, 1.2, 12);
    hGeo.rotateZ(Math.PI / 2);
    const hMesh = new THREE.Mesh(hGeo, crossMat);
    hMesh.position.set(0, 1.3, 0);
    hMesh.castShadow = true; hMesh.receiveShadow = true;
    crossGroup.add(vMesh);
    crossGroup.add(hMesh);
    G.crossModel = crossGroup;

    // ── プレイヤーモデル ──
    G.loader.load('model/asyu.glb', (gltf) => {
        G.playerModel = gltf.scene;
        G.playerModel.scale.set(0.175, 0.175, 0.175);
        G.playerModel.traverse((node) => {
            if (node.isMesh) {
                node.castShadow = true;
                node.receiveShadow = true;
                node.material.stencilWrite = true;
                node.material.stencilRef = 1;
                node.material.stencilFunc = THREE.AlwaysStencilFunc;
                node.material.stencilZPass = THREE.ReplaceStencilOp;
            }
        });
        console.log("Model loaded successfully from asyu.glb");
        updateExistingEntitiesWithModel();
    }, undefined, (error) => {
        console.error("Model load error at asyu.glb.");
        console.error(error);
    });

    // ── 鳥モデル ──
    G.loader.load('model/Flamingo.glb', (gltf) => {
        G.birdModel = gltf.scene;
        G.birdAnimations = gltf.animations;
        
        // 2.5メートル相当のサイズに調整
        const bbox = new THREE.Box3().setFromObject(G.birdModel);
        const size = bbox.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z);
        const scale = 4.0 / maxDim;
        G.birdModel.scale.set(scale, scale, scale);

        G.birdModel.traverse((node) => {
            if (node.isMesh) {
                node.castShadow = true;
                node.receiveShadow = true;
            }
        });
        console.log("Flamingo model loaded with scale " + scale + " and animations.");
    });

    G.enemyModels = {};
    G.enemyModelInfo = {}; // バウンディングボックス情報の保存用
    const behaviors = [
        'idle', 'patrol', 'chase', 'shooter', 'horiz', 'vert', 'shield', 'spinner', 'diver', 'zpatrol',
        'bouncer', 'dasher', 'santabomber', 'vertsantabomber', 'orbitshield', 'sniper', '3dcharge', 'ychaser4way',
        'yspinner', 'diver8way', '3wayslowbomber', 'bossstage8', 'bossstage16', 'bossstage24', 'bossstage32'
    ];
    behaviors.forEach(b => {
        G.loader.load(`model/${b}.glb`, (gltf) => {
            const model = gltf.scene;
            
            // 下手にいじらず、モデルのローカル座標系はそのままにする
            // 代わりに当たり判定用にバウンディングボックスのサイズと中心座標を記録しておく
            const box = new THREE.Box3().setFromObject(model);
            const size = box.getSize(new THREE.Vector3());
            const center = box.getCenter(new THREE.Vector3()); // ワールド座標（この時点では(0,0,0)基準のローカルオフセットと同義）
            
            G.enemyModelInfo[b] = { size, center };
            G.enemyModels[b] = model;
            
            model.traverse((node) => {
                if (node.isMesh) {
                    node.castShadow = true;
                    node.receiveShadow = true;
                    if (node.material) {
                        node.material.stencilWrite = true;
                        node.material.stencilRef = 1;
                        node.material.stencilFunc = THREE.AlwaysStencilFunc;
                        node.material.stencilZPass = THREE.ReplaceStencilOp;
                    }
                }
            });
        }, undefined, (error) => {
            // console.warn(`Enemy model not found at model/${b}.glb. Falling back to procedural box.`);
        });
    });

    // ── シャボン玉モデル ──
    const bubbleBakedTex = G.textureLoader.load('texture/baketexture.png', (tex) => {
        if (G.renderer) tex.anisotropy = G.renderer.capabilities.getMaxAnisotropy();
        tex.encoding = THREE.sRGBEncoding;
    });

    G.loader.load('model/syabonndama.glb', (gltf) => {
        G.bubbleModel = gltf.scene;
        G.bubbleModel.traverse((node) => {
            if (node.isMesh) {
                node.castShadow = true;
                node.receiveShadow = true;
                node.material = new THREE.MeshStandardMaterial({
                    map: bubbleBakedTex,
                    emissiveMap: bubbleBakedTex,
                    emissive: new THREE.Color(0xffffff),
                    emissiveIntensity: 0.5,
                    metalness: 0.4,
                    roughness: 0.01,
                    transparent: true,
                    opacity: 0.45,
                    depthWrite: false,
                    side: THREE.DoubleSide
                });
            }
        });
        console.log("Bubble model with baked texture loaded!");
    }, undefined, (error) => {
        console.warn("Bubble model not found at model/syabonndama.glb. Falling back to procedural sphere.");
    });

    // ── ブロックテクスチャ ──
    G.sharedBlockGeo = new THREE.BoxGeometry(1, 1, 1);
    const blockTex = G.textureLoader.load('texture/block_mat.png');
    G.sharedBlockMat = new THREE.MeshLambertMaterial({
        map: blockTex,
        color: 0xffffff
    });

    // 軽量ブロックも影を受け取るため、MeshLambertMaterial に変更します。
    // その代わり、ライティング計算（Ambient + Directional）が行われることを前提に、
    // 最終的な色味が希望のTint（側面の青み、上面の暖かみ）になるよう「ベースの色」を逆算して設定します。
    const topBase = new THREE.Color(1.03, 0.96, 0.92);
    const sideBase = new THREE.Color(0.95, 0.98, 1.07);
    const bottomBase = new THREE.Color(0.98, 0.98, 0.98);

    const sideMat = new THREE.MeshLambertMaterial({ map: blockTex, color: sideBase });
    const topMat = new THREE.MeshLambertMaterial({ map: blockTex, color: topBase });
    const bottomMat = new THREE.MeshLambertMaterial({ map: blockTex, color: bottomBase });

    G.sharedLowPolyBlockMat = [
        sideMat, sideMat, // +X, -X
        topMat,           // +Y (上面)
        bottomMat,        // -Y (下面)
        sideMat, sideMat  // +Z, -Z
    ];

    // ── GLBモデルでの上書き試行（外部GLB拡張） ──
    // loadingManagerを使用しているため、ロード完了または失敗するまでゲームは開始されません。
    const loadGeoOverride = (path, geoKey) => {
        G.loader.load(path, (gltf) => {
            gltf.scene.traverse((node) => {
                if (node.isMesh && node.geometry) {
                    G[geoKey] = node.geometry;
                }
            });
            console.log(`Loaded ${path} for ${geoKey}`);
        }, undefined, (err) => {
            console.warn(`${path} not found. Using procedural fallback for ${geoKey}.`);
        });
    };

    loadGeoOverride('model/block.glb', 'sharedBlockGeo');
    loadGeoOverride('model/projectile.glb', 'sharedProjectileGeo');
    loadGeoOverride('model/needle.glb', 'sharedNeedleGeo');
    loadGeoOverride('model/explosion.glb', 'sharedExplosionGeo');
}

// ── ユーティリティ: プレイヤーモデルの複製と色変更 ──
function clonePlayerModel(color) {
    if (!G.playerModel) return null;
    let newMesh = G.playerModel.clone();
    if (color !== undefined && color !== null) {
        newMesh.traverse(n => {
            if (n.isMesh) {
                n.material = n.material.clone();
                n.material.color.set(color);
            }
        });
    }
    return newMesh;
}

// ── ユーティリティ: Xray メッシュの追加 ──
function addXrayMeshToModel(model, color, baseMesh = G.playerModel) {
    if (!baseMesh) return;
    const xrayMat = new THREE.MeshBasicMaterial({
        color: color, transparent: true, opacity: 0.5,
        depthFunc: THREE.GreaterDepth, depthWrite: false,
        stencilWrite: true, stencilRef: 1, stencilFunc: THREE.NotEqualStencilFunc
    });
    const xrayMesh = baseMesh.clone();
    xrayMesh.name = "XRAY";
    xrayMesh.renderOrder = 999;
    // スケールは baseMesh のまま維持する
    xrayMesh.scale.copy(baseMesh.scale);
    xrayMesh.traverse(n => {
        if (n.isMesh) {
            n.material = xrayMat;
            n.renderOrder = 999;
        }
    });
    model.add(xrayMesh);
}

// モデルロード完了後に、仮の箱をモデルに差し替える関数
function updateExistingEntitiesWithModel() {
    if (!G.playerModel) return;
    G.entities.forEach(ent => {
        if (ent.mesh.geometry && ent.mesh.geometry.type === 'BoxGeometry') {
            const oldMesh = ent.mesh;
            const pos = oldMesh.position.clone();

            const modelColor = ent.isAI ? 0x90ee90 : null;
            let newMesh = clonePlayerModel(modelColor);
            newMesh.position.copy(pos);

            addXrayMeshToModel(newMesh, 0xffaa33);

            const childrenToMove = [];
            oldMesh.children.forEach(c => {
                if (c.type !== 'Mesh' || c.material.depthFunc !== THREE.GreaterDepth) {
                    childrenToMove.push(c);
                }
            });
            childrenToMove.forEach(c => newMesh.add(c));

            G.scene.remove(oldMesh);
            G.scene.add(newMesh);
            ent.mesh = newMesh;
        }
    });
}
