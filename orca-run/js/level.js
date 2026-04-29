// === LEVEL.JS - JSON-based Level System ===
const LevelManager = {
  stages: [],
  currentStage: 0,
  stageDistance: 0,
  camX: 0,
  scrollSpeed: 2.5,
  platforms: [],
  subtitles: [],
  currentSubtitle: null,
  subtitleTimer: 0,
  stageIntroTimer: 0,
  stageStarted: false,

  init() {
    this.stages = AssetLoader.data.stages;
  },

  startStage(idx) {
    this.currentStage = idx;
    this.stageDistance = 0;
    this.camX = 0;
    const stage = this.stages[idx];
    this.scrollSpeed = stage.scrollSpeed;
    this.platforms = stage.platforms;
    this.stageIntroTimer = 180; // 3 second intro
    this.stageStarted = false;
    this.waveIndex = 0;
    this.subtitleIndex = 0;
    this.currentSubtitle = null;
    this.subtitleTimer = 0;
    // Show stage intro
    const introEl = document.getElementById('stage-intro');
    document.getElementById('stage-number').textContent = stage.number;
    document.getElementById('stage-name').textContent = stage.name;
    introEl.classList.remove('hidden');
  },

  update() {
    if (this.stageIntroTimer > 0) {
      this.stageIntroTimer--;
      if (this.stageIntroTimer <= 0) {
        document.getElementById('stage-intro').classList.add('hidden');
        this.stageStarted = true;
      }
      return { scrolling: false, phase: this.getCurrentStage().bgPhase };
    }

    const stage = this.getCurrentStage();
    this.stageDistance += this.scrollSpeed;
    this.camX += this.scrollSpeed;

    // Subtitle triggers
    if (this.subtitleIndex < stage.subtitles.length) {
      const sub = stage.subtitles[this.subtitleIndex];
      if (this.stageDistance >= sub.dist) {
        this.currentSubtitle = sub.text;
        this.subtitleTimer = 240; // 4 seconds
        this.subtitleIndex++;
      }
    }
    if (this.subtitleTimer > 0) {
      this.subtitleTimer--;
      if (this.subtitleTimer <= 0) this.currentSubtitle = null;
    }

    // Wave spawns
    if (this.waveIndex < stage.waves.length) {
      const wave = stage.waves[this.waveIndex];
      if (this.stageDistance >= wave.dist) {
        wave.enemies.forEach((type, i) => {
          setTimeout(() => EnemyManager.spawn(type), i * 200);
        });
        this.waveIndex++;
      }
    }

    // Mid-boss trigger
    if (stage.midBoss && this.stageDistance >= stage.midBoss.dist && !this._midBossSpawned) {
      this._midBossSpawned = true;
      return { scrolling: true, phase: stage.bgPhase, triggerMidBoss: stage.midBoss.type };
    }

    // Final boss trigger
    if (stage.boss && this.stageDistance >= stage.boss.dist && !this._bossSpawned) {
      this._bossSpawned = true;
      return { scrolling: true, phase: stage.bgPhase, triggerBoss: true };
    }

    return { scrolling: true, phase: stage.bgPhase };
  },

  getCurrentStage() { return this.stages[this.currentStage]; },
  getVisiblePlatforms() { return this.platforms; },
  isStageComplete() {
    const stage = this.getCurrentStage();
    return this.stageDistance >= stage.length;
  },
  hasNextStage() { return this.currentStage < this.stages.length - 1; },
  nextStage() { this.startStage(this.currentStage + 1); this._midBossSpawned=false; this._bossSpawned=false; },
  reset() { this._midBossSpawned=false; this._bossSpawned=false; this.currentStage=0; },
};
