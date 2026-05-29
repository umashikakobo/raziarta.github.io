// ═══════════════════════════════════════════════════════
//  ai.js — AI生成・AI行動ループ
// ═══════════════════════════════════════════════════════
'use strict';

function createAI(name, entIndex = 1) {
    const spawnX = config.areaSize / 2 + 0.5;
    const spawnY = 0.25;
    const spawnZ = config.areaSize / 2 + 0.5;

    const belongsToLayer = 1 << (entIndex + 1);
    const dedicatedFloorLayer = 1 << (entIndex + 17);
    const collidesWithLayer = 1 | dedicatedFloorLayer | BUBBLE_LAYER | PROJECTILE_LAYER;

    const body = G.world.add({
        type: 'sphere',
        size: [0.37],
        pos: [spawnX, spawnY, spawnZ],
        move: true,
        belongsTo: belongsToLayer,
        collidesWith: collidesWithLayer,
        density: 1, friction: 0, restitution: 0
    });
    body.allowSleep = false;

    addHitboxHelper(body, [0.37], 'sphere');

    let mesh;
    if (G.playerModel) {
        mesh = clonePlayerModel(0x90ee90);
        mesh.traverse(n => {
            if (n.isMesh) {
                n.material.emissive.set(0x225522);
            }
        });
    } else {
        mesh = new THREE.Mesh(
            new THREE.BoxGeometry(0.5, 0.5, 0.5),
            new THREE.MeshStandardMaterial({ color: 0x90ee90, emissive: 0x225522, metalness: 0.68, roughness: 0.3 })
        );
    }
    mesh.castShadow = true;

    if (G.playerModel) {
        addXrayMeshToModel(mesh, 0xffaa33);
    } else {
        const xrayMat = new THREE.MeshBasicMaterial({
            color: 0xffaa33, transparent: true, opacity: 0.5,
            depthFunc: THREE.GreaterDepth, depthWrite: false,
            stencilWrite: true, stencilRef: 1, stencilFunc: THREE.NotEqualStencilFunc
        });
        const xrayMesh = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), xrayMat);
        mesh.add(xrayMesh);
    }

    const sprite = createNameSprite(name);
    mesh.add(sprite);

    G.scene.add(mesh);

    const state = {
        name: name,
        body: body,
        mesh: mesh,
        sprite: sprite,
        isAI: true,
        entIndex: entIndex,
        isGrounded: false,
        groundContactFrames: 0,
        currentMembraneY: -Infinity,
        dedicatedMembraneFloor: null,
        jumpTimer: 0,
        isJumping: false,
        jumpCount: 0,
        targetPos: null,
        jumpBlacklist: new Map(),
        stuckTimer: 0,
        neutralTimer: 0,
        forceRetreat: false,
        lastFireTimeProjectile: 0,
        lastFireTimeBubble: 0,
        isDead: false,
        deathTimer: 0,
        projectileStock: 0.0,
        bubbleStock: 0.0,
        lastPos: null
    };

    G.entities.push(state);
    return state;
}
