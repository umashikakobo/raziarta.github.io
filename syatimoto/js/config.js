// ═══════════════════════════════════════════════════════
//  config.js — グローバル設定 & 共有ステート
// ═══════════════════════════════════════════════════════
'use strict';

// ── ゲーム設定 ──
const config = {
    playerSpeed: 6.0,
    jumpVelocity: 2.6,
    jumpMultiplier: 0.65,
    gravity: -9.8,
    density: 0.12,
    fogRange: 150,
    areaSize: 9,
    holdBoost: 0.38,
    maxHoldTime: 9,
    showHitboxes: false,
    goalHeight: 300,
    maxLives: 3,
    damageProjectile: 1,
    damageBubble: 2,
    aiDamageFactor: 1.0,
    aiCount: 0,
    birdSpawnInterval: 30000,
    // Projectile Stats
    maxProjectileStock: 2,
    projectileSpeed: 20.0,
    projectileRecoveryRate: 1.0,
    // Bubble Stats
    maxBubbleStock: 2,
    bubbleSpeedY: 5.0,
    bubbleRecoveryRate: 0.108,
    projectileAutoFire: false,
    brightness: 0.46,
    mouseSensitivity: 1.0,
    deathFallMode: '50', // 'none', '25', '50'
    raceType: 'COMBAT' // 'COMBAT', 'TIME TRIAL'
};

// ── 定数 ──
const PROJECTILE_LAYER = 1 << 20;
const BUBBLE_LAYER = 1 << 21;
const MAX_BLOCKS = 15000;
const CHUNK = 50;
const ROOM_PREFIX = "raziarta-ascent-room-";

const ASCENT_NAMES = [
    "くろねこ", "しろくま", "ふくろう", "きんぎょ", "まんぼう", "かるがも", "うみがめ", "きつねび", "たぬきや", "うぐいす",
    "ひまわり", "たんぽぽ", "あさがお", "どんぐり", "あじさい", "すずらん", "はなびら", "いなずま", "そよかぜ", "あおぞら",
    "ほしぞら", "ゆうやけ", "あさやけ", "みずたま", "みかづき", "まぼろし", "あまおと", "わたあめ", "だいふく", "まっちゃ",
    "たいやき", "おにぎり", "からあげ", "たこやき", "かまぼこ", "えだまめ", "せんべい", "かすてら", "はちみつ", "おりがみ",
    "えんぴつ", "ほうせき", "びーだま", "はぐるま", "けんだま", "すごろく", "おもちゃ", "ふうせん", "ふでばこ", "やじるし"
];

// ── グローバル共有ステート (G) ──
// すべてのモジュールがこのオブジェクトを介して状態を共有する
const G = {
    // Three.js コアオブジェクト
    scene: null,
    camera: null,
    renderer: null,
    controls: null,
    world: null,

    // ライト（デバッグGUIから参照）
    ambientLight: null,
    d1: null, d2: null, d3: null, d4: null,

    // プレイヤー
    playerBody: null,
    playerMesh: null,
    playerModel: null,
    birdModel: null,
    bubbleModel: null,

    // アセット（事前ロード）
    skyTexture: null,

    // マップ
    mapInstancedMesh: null,
    lowPolyMapInstancedMesh: null,
    mapObjects: [],
    mapGrid: new Map(),
    pendingBlocks: [],
    membranes: [],
    walls: [],
    warningTapes: [],
    instancedBlockMap: new Map(),
    freeInstanceIndices: [],
    freeLowPolyInstanceIndices: [],
    dummy: new THREE.Object3D(),

    // 戦闘
    projectiles: [],
    projectilePool: [],
    bubbles: [],
    bubblePool: [],
    explosions: [],
    explosionPool: [],

    // ネットワーク
    netObjects: new Map(),
    netIdCounter: 1,
    networkEntities: new Map(),
    peer: null,
    connections: [],
    hostConn: null,
    isOnline: false,
    isHost: false,
    myPlayerName: "Guest",
    myPeerId: null,
    randomSeed: Math.random(),
    peerNames: new Map(),
    peerStats: new Map(), // Map<peerId, {kills, deaths}>
    myKills: 0,
    myDeaths: 0,

    // エンティティ
    entities: [],
    hitboxHelpers: [],

    // 入力
    keys: { w: false, a: false, s: false, d: false, space: false, shift: false, rightClick: false },
    camDist: 3.3,

    // ゲームステート
    isStarted: false,
    isGoalReached: false,
    isDead: false,
    isInvincible: false,
    invincibilityTimer: 0,
    deathTimer: 0,
    deathTextEl: null,
    playerLives: 3,
    playerProjectileStock: 0.0,
    playerBubbleStock: 0.0,
    lastFireTimeProjectile: 0,
    lastFireTimeBubble: 0,
    lastAnimTime: 0,
    mapInitialized: false,
    currentMode: 'main',
    animFrameId: null,
    highestY: 0,
    nextMilestoneY: 50,
    upgrades: { sphere: 0, bubble: 0 },
    jumpCount: 0,
    nextChunkY: 0,
    startTime: 0,
    isGrounded: false,
    minJumpInterval: 0,
    isJumping: false,
    jumpTimer: 0,
    lastSpaceState: false,
    maxJumps: 2,

    // ローダー
    loadingManager: null,
    loader: null,
    textureLoader: null,
    exrLoader: null,

    // 共有ジオメトリ・マテリアル
    sharedProjectileGeo: null,
    sharedProjectileMat: null,
    sharedExplosionGeo: null,
    sharedExplosionMat: null,
    sharedBubbleGeo: null,
    sharedBlockGeo: null,
    sharedBlockMat: null,
    sharedLowPolyBlockMat: null,

    // Worker
    worker: null,

    // DOM要素キャッシュ
    heightEl: null,
    timeEl: null,
    airEl: null,
    entityListEl: null,
    logicAccumulator: 0,
    lastAnimTime: 0,

    // Time Trial / Ghost
    frameCount: 0,
    timeTrialPath: [],
    ghostRecords: [], // Array of { time, path, seed, config }
    ghosts: []        // Array of ghost entities
};

// freeInstanceIndices の初期化
for (let i = MAX_BLOCKS - 1; i >= 0; i--) {
    G.freeInstanceIndices.push(i);
    G.freeLowPolyInstanceIndices.push(i);
}
