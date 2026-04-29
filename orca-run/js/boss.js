// === BOSS.JS - JSON-Driven Leviathan Boss ===
class Boss {
  constructor() {
    const data = AssetLoader.getEnemy('leviathan');
    this.x = 800; this.y = 220;
    this.hw = data.hw; this.hh = data.hh;
    this.hp = data.hp; this.maxHp = data.maxHp;
    this.alive = true; this.frame = 0;
    this.state = 'enter'; this.stateTimer = 150;
    this.mouthY = 220;
    this.mouthTargetY = 220;
    this.beamCharging = false; this.beamFiring = false; this.beamCharge = 0;
    this.beamY = 0; this.beamWidth = 0;
    this.armY = 0; this.shakeAmt = 0;
    this.phase = 0;
    this.damageFlash = 0;
  }

  update(player) {
    this.frame++;
    if (this.damageFlash > 0) this.damageFlash--;
    const hpRatio = this.hp / this.maxHp;
    if (hpRatio <= 0.5 && this.phase < 1) this.phase = 1;
    const spd = this.phase >= 1 ? 1.4 : 1;

    this.stateTimer--;
    if (this.stateTimer <= 0) this.nextState(spd);

    switch (this.state) {
      case 'enter': this.x = 800 + Math.sin(this.frame * 0.03) * 10; break;
      case 'idle':
        this.x = 780 + Math.sin(this.frame * 0.02) * 15;
        this.y = 220 + Math.sin(this.frame * 0.025) * 10;
        break;
      case 'beam_track':
        this.mouthTargetY = player.y;
        this.mouthY += (this.mouthTargetY - this.mouthY) * 0.06;
        break;
      case 'beam_lock':
        this.beamCharging = true;
        this.beamCharge = Math.min(1, (60 - this.stateTimer) / 60);
        break;
      case 'beam_fire':
        this.beamFiring = true;
        this.beamY = this.mouthY;
        this.beamWidth = Math.min(40, this.beamWidth + 4);
        const beamTop = this.beamY - this.beamWidth / 2;
        const beamBot = this.beamY + this.beamWidth / 2;
        const playerTop = player.y - player.hh;
        const playerBot = player.y + player.hh;
        if (player.x < this.x - 30 && !player.invincible && playerBot > beamTop && playerTop < beamBot) {
          player.takeDamage(20, this.x);
        }
        break;
      case 'slam_windup':
        this.armY = Math.min(this.armY + 2, 70);
        break;
      case 'slam_hit':
        this.armY = Math.max(this.armY - 10, -25);
        if (this.armY <= -20) {
          this.shakeAmt = 12;
          if (player.onGround && Math.abs(player.x - this.x) < 250) {
            player.takeDamage(25, this.x);
          }
          for (let i = 0; i < 6; i++) {
            ProjectileManager.addEnemyBullet(this.x - 50 + (Math.random() - 0.5) * 200, Physics.GROUND_Y - 25, (Math.random() - 0.5) * 3, -3 - Math.random() * 4, 'debris');
          }
        }
        break;
      case 'debris_rain':
        if (this.frame % Math.floor(10 / spd) === 0) {
          ProjectileManager.addEnemyBullet(50 + Math.random() * 650, -15, (Math.random() - 0.5) * 1, 2.5 + Math.random() * 2, 'debris');
        }
        break;
      case 'tentacle_sweep':
        if (this.frame % 20 === 0) {
          for (let i = 0; i < 4; i++) {
            ProjectileManager.addEnemyBullet(this.x - 60, 300 + i * 30, -6, 0, 'energy');
          }
        }
        break;
    }

    if (this.shakeAmt > 0) this.shakeAmt *= 0.88;
    if (this.state !== 'beam_fire') { this.beamFiring = false; this.beamWidth = 0; }
    if (this.state !== 'beam_lock') { this.beamCharging = false; this.beamCharge = 0; }

    ProjectileManager.playerBullets.forEach(b => {
      if (b.alive && Physics.aabb(b, this) && (b.type !== 'bomb' || !b.exploded)) {
        b.alive = false; this.takeDamage(b.damage);
      }
    });
    ProjectileManager.playerBullets.forEach(b => {
      if (b.type === 'bomb' && b.exploded && b.explosionTimer === 1) {
        const dx = this.x - b.x, dy = this.y - b.y;
        if (Math.sqrt(dx * dx + dy * dy) < b.explosionRadius) this.takeDamage(b.damage);
      }
    });
    if (!player.invincible && Physics.aabb(this, player)) player.takeDamage(15, this.x);
  }

  nextState(spd) {
    this.beamFiring = false; this.beamCharging = false; this.beamWidth = 0; this.beamCharge = 0;
    const attacks = this.phase >= 1
      ? ['beam_track', 'slam_windup', 'debris_rain', 'tentacle_sweep', 'beam_track', 'slam_windup']
      : ['idle', 'beam_track', 'idle', 'slam_windup', 'idle', 'debris_rain'];
    const next = attacks[Math.floor(Math.random() * attacks.length)];
    this.state = next;
    switch (next) {
      case 'idle': this.stateTimer = Math.floor(50 / spd); break;
      case 'beam_track': this.stateTimer = Math.floor(90 / spd); this._queueBeam = true; break;
      case 'beam_lock': this.stateTimer = 60; break;
      case 'beam_fire': this.stateTimer = Math.floor(45 / spd); break;
      case 'slam_windup': this.stateTimer = Math.floor(80 / spd); this.armY = 0; this._queueSlam = true; break;
      case 'slam_hit': this.stateTimer = Math.floor(35 / spd); break;
      case 'debris_rain': this.stateTimer = Math.floor(100 / spd); break;
      case 'tentacle_sweep': this.stateTimer = Math.floor(80 / spd); break;
    }
    if (this._queueBeam && next === 'beam_track') {
      this._queueBeam = false;
      setTimeout(() => {
        if (this.alive) {
          this.state = 'beam_lock'; this.stateTimer = 60;
          setTimeout(() => { if (this.alive) { this.state = 'beam_fire'; this.stateTimer = Math.floor(45 / spd); } }, 1000);
        }
      }, Math.floor(90 / spd) * 16.7);
    }
    if (this._queueSlam && next === 'slam_windup') {
      this._queueSlam = false;
      setTimeout(() => { if (this.alive) { this.state = 'slam_hit'; this.stateTimer = Math.floor(35 / spd); } }, Math.floor(80 / spd) * 16.7);
    }
  }

  takeDamage(d) {
    this.hp -= d; this.damageFlash = 8;
    if (typeof ParticleSystem !== 'undefined') ParticleSystem.burst(this.x - 40, this.y - 30, '#ffaa44', 6);
    if (this.hp <= 0) this.alive = false;
  }

  draw(ctx) {
    ctx.save();
    const sx = this.shakeAmt > 0.5 ? (Math.random() - 0.5) * this.shakeAmt : 0;
    Renderer.drawLeviathan(ctx, this.x + sx, this.y, 1, this.frame);
    
    // Arm logic overlay over the pre-rendered body
    ctx.translate(this.x + sx, this.y);
    const s = 3;
    ctx.fillStyle = this.damageFlash > 0 ? '#cc5533' : '#5a4a3a';
    ctx.fillRect(-40 * s / 3, (-35 - this.armY) * s / 3, 7 * s / 3, (35 + this.armY) * s / 3);
    ctx.fillRect(-45 * s / 3, (-37 - this.armY) * s / 3, 16 * s / 3, 4 * s / 3);

    // Mouth charge indicator
    if (this.beamCharging) {
      const mOff = (this.mouthY - this.y) / s * 3;
      ctx.fillStyle = `rgba(255,80,20,${this.beamCharge * 0.8})`;
      ctx.fillRect(-46 * s / 3, (mOff - 3) * s / 3, 10 * s / 3, 6 * s / 3);
    }
    ctx.restore();

    // Beam rendering
    if (this.beamFiring && this.beamWidth > 0) {
      ctx.fillStyle = 'rgba(255,60,15,0.5)';
      ctx.fillRect(0, this.beamY - this.beamWidth / 2, this.x - 45, this.beamWidth);
      ctx.fillStyle = 'rgba(255,180,80,0.7)';
      ctx.fillRect(0, this.beamY - this.beamWidth / 4, this.x - 45, this.beamWidth / 2);
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, this.beamY - 2, this.x - 45, 4);
    }
  }
}
