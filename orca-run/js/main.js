// === MAIN.JS - Game Loop, State Machine, Full Integration ===
const ParticleSystem = {
  particles:[],
  burst(x,y,color,count){for(let i=0;i<count;i++)this.particles.push({x,y,vx:(Math.random()-0.5)*6,vy:(Math.random()-0.5)*6-2,size:2+Math.random()*4,color,alpha:1,decay:0.02+Math.random()*0.03});},
  update(){this.particles.forEach(p=>{p.x+=p.vx;p.y+=p.vy;p.vy+=0.1;p.alpha-=p.decay;});this.particles=this.particles.filter(p=>p.alpha>0);},
  draw(ctx){this.particles.forEach(p=>Renderer.drawParticle(ctx,p));},
  clear(){this.particles=[];},
};

const Game = {
  state:'LOADING', keys:{}, mouseL:false, mouseR:false,
  player:null, boss:null, score:0, totalFrames:0, paused:false, hitStopFrames:0,
  fadeAlpha:0, fadeState:'none', fadeTimer:0, storyText:'',
  abyssParticles: [],
  debugMultiplier: 1,

  async init(){
    this.canvas=document.getElementById('gameCanvas');
    this.ctx=this.canvas.getContext('2d');
    this.resize();
    this.ctx.imageSmoothingEnabled=false;

    // Start rendering the loading screen (canvas just black, DOM overlay handles UI)
    this.loop();

    // Load assets
    try {
      await AssetLoader.loadAll((loaded, total) => {
        const pct = Math.floor((loaded / total) * 100);
        document.getElementById('loading-bar').style.width = pct + '%';
        document.getElementById('loading-text').textContent = `${loaded} / ${total} Assets`;
      });
      // Loading complete
      document.getElementById('loading-screen').classList.add('hidden');
      document.getElementById('title-screen').classList.remove('hidden');
      this.state = 'TITLE';

      // Input bindings
      window.addEventListener('keydown',e=>{
        this.keys[e.key]=true;
        if(['Space',' ','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key))e.preventDefault();
        // PAUSE TOGGLE
        if(e.key === 'Escape' || e.key.toLowerCase() === 'p') {
          if (this.state === 'PLAYING' || this.state === 'MIDBOSS' || this.state === 'BOSS') {
            this.togglePause();
          }
        }
        // DEBUG SPEED TOGGLE
        if(e.key === '9') {
          this.debugMultiplier = this.debugMultiplier === 1 ? 3 : 1;
          console.log("Debug Multiplier:", this.debugMultiplier);
        }
        // DEBUG STAGE SKIP
        if(e.key === '8') {
          if(LevelManager.hasNextStage()) {
            console.log("Skipping stage...");
            LevelManager.nextStage();
            this.state = 'STAGE_INTRO';
            this.boss = null;
            EnemyManager.clear();
            ProjectileManager.clear();
            if(this.paused) this.togglePause();
            // Weapon evolution check for debug skip
            if (LevelManager.currentStage >= 3) {
              this.player.evolved = true;
            }
          } else {
            console.log("Final stage reached, cannot skip.");
          }
        }
      });
      window.addEventListener('keyup',e=>{this.keys[e.key]=false;});
      this.canvas.addEventListener('mousedown',e=>{if(e.button===0)this.mouseL=true;if(e.button===2)this.mouseR=true;});
      this.canvas.addEventListener('mouseup',e=>{if(e.button===0)this.mouseL=false;if(e.button===2)this.mouseR=false;});
      this.canvas.addEventListener('contextmenu',e=>e.preventDefault());
      window.addEventListener('resize',()=>this.resize());
      
      // Overlay clicks
      document.getElementById('title-screen').addEventListener('click',()=>{if(this.state==='TITLE')this.startGame();});
      document.getElementById('gameover-screen').addEventListener('click',()=>{if(this.state==='GAMEOVER')this.resetToTitle();});
      document.getElementById('pause-screen').addEventListener('click',()=>{if(this.paused)this.togglePause();});
      this.canvas.addEventListener('click',()=>{if(this.state==='ENDING'&&Ending.isClickable())this.resetToTitle();});
      
      // Touch
      this.canvas.addEventListener('touchstart',e=>{this.mouseL=true;e.preventDefault();});
      this.canvas.addEventListener('touchend',()=>{this.mouseL=false;});

      // Init systems that rely on loaded data
      LevelManager.init();
      this.player=new Player();

    } catch (e) {
      console.error("Failed to load assets:", e);
      document.getElementById('loading-text').textContent = "ERROR LOADING ASSETS";
    }
  },

  async startGame(){
    document.getElementById('title-screen').classList.add('hidden');
    this.state='STAGE_INTRO';this.score=0;this.totalFrames=0;this.boss=null;
    this.player.reset();EnemyManager.clear();ProjectileManager.clear();
    ItemManager.clear();Inventory.clear();ParticleSystem.clear();HUD.damagePopups=[];
    LevelManager.reset();LevelManager.startStage(0);
    try{await AudioManager.init();AudioManager.startRoadBGM();}catch(e){console.warn('Audio:',e);}
  },

  resetToTitle(){
    document.getElementById('gameover-screen').classList.add('hidden');
    document.getElementById('stage-intro').classList.add('hidden');
    document.getElementById('title-screen').classList.remove('hidden');
    if(this.paused) this.togglePause();
    Ending.active=false;this.state='TITLE';this.boss=null;AudioManager.stopAll();
  },

  togglePause() {
    this.paused = !this.paused;
    if (this.paused) {
      document.getElementById('pause-screen').classList.remove('hidden');
    } else {
      document.getElementById('pause-screen').classList.add('hidden');
      // Reset keys to prevent getting stuck
      this.keys = {};
    }
    if (typeof AudioManager !== 'undefined') {
      AudioManager.setPauseFilter(this.paused);
    }
  },

  resize(){
    this.width=window.innerWidth;
    this.height=window.innerHeight;
    if(this.canvas){
      this.canvas.width=this.width;
      this.canvas.height=this.height;
      if(this.ctx) this.ctx.imageSmoothingEnabled=false;
    }
    // Update physics constants if they exist
    if(typeof Physics!=='undefined'){
      Physics.GROUND_Y = this.height - 80;
    }
  },

  update(){
    if(this.state==='LOADING')return;
    if(this.state==='TITLE')return;
    if(this.state==='ENDING'){Ending.update();return;}
    if(this.state==='GAMEOVER')return;

    if(this.paused) return;

    if(this.hitStopFrames > 0) {
      this.hitStopFrames--;
      ParticleSystem.update(); // Keep particles moving during hit stop
      return;
    }

    // Stage intro
    if(this.state==='STAGE_INTRO'){
      const res=LevelManager.update();
      if(LevelManager.stageStarted){this.state='PLAYING';}
      return;
    }

    this.totalFrames++;
    const platforms=LevelManager.getVisiblePlatforms();
    const camX=LevelManager.camX;

    // Player update
    this.player.update(this.keys,this.mouseL,this.mouseR,platforms,camX,this.width,this.height);
    // Reset right click after use
    if(this.mouseR)this.mouseR=false;

    if(!this.player.alive){this.gameOver();return;}

    if(this.state==='PLAYING'){
      const res=LevelManager.update();
      this.score=Math.floor(LevelManager.stageDistance/10)+(LevelManager.currentStage*1500);

      // Mid-boss trigger
      if(res.triggerMidBoss){
        EnemyManager.spawnMidBoss(res.triggerMidBoss);
        this.state='MIDBOSS';
      }
      // Boss trigger
      if(res.triggerBoss){
        this.startBoss();
      }
      // Stage complete (after mid-boss cleared)
      if(LevelManager.isStageComplete()&&!EnemyManager.midBoss){
        if(LevelManager.hasNextStage()){
          LevelManager.nextStage();this.state='STAGE_INTRO';
          EnemyManager.clear();ProjectileManager.clear();
          return;
        }
      }
      // Normal enemy update
      EnemyManager.update(LevelManager.scrollSpeed,this.player,HUD.damagePopups);
    }

    if(this.state==='MIDBOSS'){
      EnemyManager.update(LevelManager.scrollSpeed*0.3,this.player,HUD.damagePopups);
      if(!EnemyManager.midBoss){
        this.state='PLAYING';
        // After mid-boss, advance to next stage with fade
        if(LevelManager.hasNextStage()){
          this._startFadeTransition();
        }
      }
    }

    if(this.state==='BOSS'){
      if(this.boss&&this.boss.alive){
        this.boss.update(this.player);
      } else if(this.boss&&!this.boss.alive){
        // Check if there are more stages (Ch2)
        if (LevelManager.hasNextStage()) {
          // Weapon evolution after Chapter 1 (Stage 3) Boss clear
          if (LevelManager.currentStage === 2 && !this.player.evolved) {
            this.player.evolved = true;
          }
          this.boss = null;
          this._startFadeTransition();
        } else {
          this.victory();
        }
      }
    }

    // Fade transition logic
    if (this.fadeState === 'out') {
      this.fadeTimer++;
      this.fadeAlpha = Math.min(1, this.fadeTimer / 48); // 0.8s at 60fps
      if (this.fadeTimer >= 48) {
        this.fadeState = 'story';
        this.fadeTimer = 0;
        // Advance stage now
        LevelManager.nextStage();
        EnemyManager.clear(); ProjectileManager.clear();
      }
    } else if (this.fadeState === 'story') {
      this.fadeTimer++;
      if (this.fadeTimer >= 240) { // 4.0s
        this.fadeState = 'in';
        this.fadeTimer = 0;
        this.state = 'STAGE_INTRO';
      }
    } else if (this.fadeState === 'in') {
      this.fadeTimer++;
      this.fadeAlpha = 1 - Math.min(1, this.fadeTimer / 72); // 1.2s
      if (this.fadeTimer >= 72) {
        this.fadeState = 'none';
        this.fadeAlpha = 0;
      }
    }

    ProjectileManager.update();
    // Enemy bullets vs player
    ProjectileManager.enemyBullets.forEach(b=>{
      if(b.alive&&!this.player.invincible&&Physics.aabb(b,this.player)){
        this.player.takeDamage(b.damage*8,b.x);b.alive=false;
      }
    });

    ItemManager.update(this.player);Inventory.update(this.player);ParticleSystem.update();
  },

  startBoss(){
    this.state='BOSS';EnemyManager.enabled=false;EnemyManager.enemies=[];
    // Chapter 2 final boss = NullBoss, Chapter 1 = Leviathan
    if (LevelManager.currentStage >= 3) {
      this.boss = new NullBoss();
    } else {
      this.boss = new Boss();
    }
    AudioManager.playSE('bossIntro');
    setTimeout(()=>AudioManager.startBossBGM(),1500);
  },

  _startFadeTransition() {
    this.fadeState = 'out';
    this.fadeTimer = 0;
    // Story text between chapters
    const stageIdx = LevelManager.currentStage;
    const storyTexts = [
      '武器が進化した。青い光が、暗闇を切り裂く。',
      '深淵が近づいている。その先に何があるのか。',
      'クレーターの底へ。引き返すことはできない。',
      '闇の中に、かすかな光が見える。',
      '最後の扉が開く。全てを終わらせるために。',
    ];
    this.storyText = storyTexts[stageIdx] || '';
  },

  victory(){this.state='ENDING';Ending.start(this.score,this.totalFrames);},
  gameOver(){
    this.state='GAMEOVER';
    document.getElementById('final-score').textContent=`SCORE: ${this.score}`;
    document.getElementById('gameover-screen').classList.remove('hidden');
    AudioManager.stopAll();
  },

  draw(){
    const ctx=this.ctx;
    ctx.fillStyle='#06060c';ctx.fillRect(0,0,this.width,this.height);

    if(this.state==='LOADING'){return;}

    // Even on title screen, draw background moving
    if(this.state==='TITLE'){
      this.totalFrames++;
      Backgrounds.draw(ctx, this.totalFrames * 0.8, 0);
      return;
    }
    if(this.state==='ENDING'){Ending.draw(ctx,this.width,this.height);return;}

    // Game world backgrounds
    const stage = LevelManager.getCurrentStage();
    let scrollSpd = LevelManager.scrollSpeed;
    if(this.state==='MIDBOSS') scrollSpd *= 0.3;
    if(this.state==='BOSS') scrollSpd *= 0.5;
    if(this.state==='STAGE_INTRO') scrollSpd = 0;
    
    // Pass stage data directly for parallax
    Backgrounds.draw(ctx, LevelManager.camX, stage);

    // Main Ground
    Renderer.drawGround(ctx, this.width, this.height, Physics.GROUND_Y, LevelManager.camX);

    // Platforms
    const camX=LevelManager.camX;
    LevelManager.getVisiblePlatforms().forEach(p=>Renderer.drawPlatform(ctx,p,camX));

    ItemManager.draw(ctx);EnemyManager.draw(ctx);
    if(this.boss&&this.boss.alive)this.boss.draw(ctx);
    ProjectileManager.draw(ctx);
    this.player.draw(ctx);
    ParticleSystem.draw(ctx);

    // HUD
    const midBoss=EnemyManager.midBoss;
    HUD.draw(ctx,this.player,this.boss,midBoss,this.score,
      LevelManager.currentSubtitle,LevelManager.subtitleTimer);

    // Boss warning
    if(this.state==='PLAYING'){
      const stage=LevelManager.getCurrentStage();
      const bDist=stage.boss?stage.boss.dist:stage.midBoss?stage.midBoss.dist:99999;
      if(LevelManager.stageDistance>bDist-400&&LevelManager.stageDistance<bDist){
        const flash=Math.sin(this.totalFrames*0.15)*0.12;
        if(flash>0){ctx.fillStyle=`rgba(255,40,15,${flash})`;ctx.fillRect(0,0,this.width,this.height);}
        if(this.totalFrames%60<40){ctx.fillStyle='#ff3322';ctx.font='13px "Press Start 2P"';ctx.textAlign='center';ctx.fillText('⚠ WARNING ⚠',this.width/2,this.height/2-55);ctx.textAlign='left';}
      }
    }

    if(this.state==='STAGE_INTRO'){
      ctx.fillStyle='rgba(4,4,12,0.7)';ctx.fillRect(0,0,this.width,this.height);
    }

    // Abyss particles for deep stages (Chapter 2)
    const currentPhase = stage?.bgPhase || 0;
    if (currentPhase >= 3) {
      // Ensure abyss particles exist
      while (this.abyssParticles.length < 25) {
        this.abyssParticles.push({
          x: Math.random() * this.width, y: Math.random() * this.height,
          vx: (Math.random()-0.5)*0.3, vy: -0.2 - Math.random()*0.5,
          size: 2 + Math.random()*4, alpha: Math.random()*0.6,
          phase: Math.random() * Math.PI * 2
        });
      }
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      this.abyssParticles.forEach(p => {
        p.x += p.vx; p.y += p.vy; p.phase += 0.02;
        p.alpha = 0.2 + Math.sin(p.phase) * 0.3;
        if (p.y < -10) { p.y = this.height + 10; p.x = Math.random() * this.width; }
        if (p.x < -10) p.x = this.width + 10;
        if (p.x > this.width + 10) p.x = -10;
        ctx.globalAlpha = Math.max(0, p.alpha);
        ctx.fillStyle = '#88bbff';
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI*2); ctx.fill();
      });
      ctx.restore();
    }

    // Stage 6 faint white glow
    if (currentPhase === 5) {
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      const glowAlpha = 0.05 + Math.sin(this.totalFrames * 0.02) * 0.03;
      ctx.fillStyle = `rgba(220, 230, 255, ${glowAlpha})`;
      ctx.fillRect(0, 0, this.width, this.height);
      
      const grad = ctx.createRadialGradient(this.width/2, -100, 100, this.width/2, -100, this.height * 1.5);
      grad.addColorStop(0, 'rgba(255,255,255,0.15)');
      grad.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, this.width, this.height);
      ctx.restore();
    }

    // Fade transition overlay
    if (this.fadeAlpha > 0) {
      ctx.save();
      ctx.fillStyle = `rgba(0,0,0,${this.fadeAlpha})`;
      ctx.fillRect(0, 0, this.width, this.height);
      // Story text during story phase
      if (this.fadeState === 'story' && this.storyText) {
        const textAlpha = this.fadeTimer < 40 ? this.fadeTimer / 40 :
                          this.fadeTimer > 200 ? (240 - this.fadeTimer) / 40 : 1;
        ctx.globalAlpha = textAlpha;
        ctx.fillStyle = '#c8d0e0';
        ctx.font = '15px "DotGothic16"';
        ctx.textAlign = 'center';
        ctx.fillText(this.storyText, this.width / 2, this.height / 2);
        ctx.textAlign = 'left';
      }
      ctx.restore();
    }
  },

  loop(){
    if (!this.paused) {
      for (let i = 0; i < this.debugMultiplier; i++) {
        this.update();
      }
    }
    this.draw();
    requestAnimationFrame(()=>this.loop());
  },
};

window.addEventListener('DOMContentLoaded',()=>{Game.init();});
