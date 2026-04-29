// === ASSET_LOADER.JS - Image & Data Loading System ===
const AssetLoader = {
  images: {},
  data: { stages: [], enemies: {}, audio: {} },
  totalAssets: 0,
  loadedAssets: 0,
  ready: false,

  async loadAll(progressCallback) {
    const imgPaths = [
      // Player
      'assets/sprites/player/orca_stand.png',
      'assets/sprites/player/orca_walk_1.png',
      'assets/sprites/player/orca_walk_2.png',
      'assets/sprites/player/orca_crouch.png',
      'assets/sprites/player/orca_damaged.png',
      // Weapons
      'assets/sprites/weapons/penguin_bullet.png',
      'assets/sprites/weapons/penguin_bomb.png',
      'assets/sprites/weapons/penguin_bullet_blue.png',
      'assets/sprites/weapons/penguin_bomb_blue.png',
      'assets/sprites/weapons/explosion/explosion_1.png',
      'assets/sprites/weapons/explosion/explosion_2.png',
      'assets/sprites/weapons/explosion/explosion_3.png',
      // Enemies
      'assets/sprites/enemies/tire_shark/tire_shark_1.png',
      'assets/sprites/enemies/tire_shark/tire_shark_2.png',
      'assets/sprites/enemies/vending_machine/vending_idle.png',
      'assets/sprites/enemies/vending_machine/vending_shoot.png',
      'assets/sprites/enemies/ac_hermit_crab/hermit_hover.png',
      'assets/sprites/enemies/ac_hermit_crab/hermit_dive.png',
      'assets/sprites/enemies/cart_shark/cart_shark_idle.png',
      'assets/sprites/enemies/signal_jelly/jelly_red.png',
      'assets/sprites/enemies/signal_jelly/jelly_yellow.png',
      'assets/sprites/enemies/signal_jelly/jelly_green.png',
      'assets/sprites/enemies/boss/leviathan_idle_1.png',
      'assets/sprites/enemies/boss/leviathan_idle_2.png',
      'assets/sprites/enemies/submarine_crab/crab_1.png',
      'assets/sprites/enemies/submarine_crab/crab_2.png',
      'assets/sprites/enemies/moray_eel/eel_1.png',
      'assets/sprites/enemies/moray_eel/eel_2.png',
      'assets/sprites/enemies/carrier_seal/seal_1.png',
      'assets/sprites/enemies/carrier_seal/seal_2.png',
      'assets/sprites/enemies/boss/angler_idle.png',
      'assets/sprites/enemies/boss/angler_flash.png',
      'assets/sprites/enemies/boss/null_1.png',
      'assets/sprites/enemies/boss/null_2.png',
      'assets/sprites/enemies/boss/null_3.png',
      'assets/sprites/enemies/boss/null_4.png',
      // Items
      'assets/sprites/items/heal_small.png',
      'assets/sprites/items/heal_medium.png',
      'assets/sprites/items/atk_up.png',
      // Projectiles
      'assets/sprites/projectiles/can_bullet.png',
      // Backgrounds
      'assets/backgrounds/stage1/sky.png',
      'assets/backgrounds/stage1/buildings_far.png',
      'assets/backgrounds/stage1/buildings_mid.png',
      'assets/backgrounds/stage1/debris_near.png',
      'assets/backgrounds/stage2/interior_sky.png',
      'assets/backgrounds/stage2/walls.png',
      'assets/backgrounds/stage2/furniture.png',
      'assets/backgrounds/stage2/vines.png',
      'assets/backgrounds/stage3/night_sky.png',
      'assets/backgrounds/stage3/crater.png',
      'assets/backgrounds/stage3/edge.png',
      'assets/backgrounds/stage3/abyss.png',
    ];

    const dataPaths = [
      'data/stages/stage1.json',
      'data/stages/stage2.json',
      'data/stages/stage3.json',
      'data/stages/stage4.json',
      'data/stages/stage5.json',
      'data/stages/stage6.json',
      'data/enemies/tire_shark.json',
      'data/enemies/vending_machine.json',
      'data/enemies/ac_hermit_crab.json',
      'data/enemies/cart_shark.json',
      'data/enemies/signal_jelly.json',
      'data/enemies/leviathan.json',
      'data/enemies/submarine_crab.json',
      'data/enemies/moray_eel.json',
      'data/enemies/carrier_seal.json',
      'data/enemies/abyss_angler.json',
      'data/enemies/null_boss.json',
    ];

    this.totalAssets = imgPaths.length + dataPaths.length;
    this.loadedAssets = 0;

    // Load images
    const imgPromises = imgPaths.map(p => this._loadImage(p, progressCallback));
    // Load JSON data
    const dataPromises = dataPaths.map(p => this._loadJSON(p, progressCallback));

    await Promise.all([...imgPromises, ...dataPromises]);

    // Organize stage data
    this.data.stages.push(
      this.data._json['data/stages/stage1.json'],
      this.data._json['data/stages/stage2.json'],
      this.data._json['data/stages/stage3.json'],
      this.data._json['data/stages/stage4.json'],
      this.data._json['data/stages/stage5.json'],
      this.data._json['data/stages/stage6.json']
    );
    // Organize enemy data
    ['tire_shark','vending_machine','ac_hermit_crab','cart_shark','signal_jelly','leviathan','submarine_crab','moray_eel','carrier_seal','abyss_angler','null_boss'].forEach(e => {
      this.data.enemies[e] = this.data._json[`data/enemies/${e}.json`];
    });

    this.ready = true;
  },

  _loadImage(path, cb) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        this.images[path] = img;
        this.loadedAssets++;
        if (cb) cb(this.loadedAssets, this.totalAssets);
        resolve();
      };
      img.onerror = () => {
        console.warn('Failed to load image:', path);
        this.loadedAssets++;
        if (cb) cb(this.loadedAssets, this.totalAssets);
        resolve();
      };
      img.src = path;
    });
  },

  _loadJSON(path, cb) {
    if (!this.data._json) this.data._json = {};
    return fetch(path)
      .then(r => r.json())
      .then(d => {
        this.data._json[path] = d;
        this.loadedAssets++;
        if (cb) cb(this.loadedAssets, this.totalAssets);
      })
      .catch(e => {
        console.warn('Failed to load JSON:', path, e);
        this.loadedAssets++;
        if (cb) cb(this.loadedAssets, this.totalAssets);
      });
  },

  // Convenience getters
  img(path) { return this.images[path]; },
  getStage(idx) { return this.data.stages[idx]; },
  getEnemy(type) { return this.data.enemies[type]; },
};
