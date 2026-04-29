// === BOSS.JS - JSON-Driven Leviathan Boss ===
class Boss {
  constructor() {
    const data = typeof AssetLoader !== 'undefined' ? AssetLoader.getEnemy('leviathan') : {hw:70,hh:100,hp:80,maxHp:80};
    this.x = 800; this.y = -100; // Start offscreen above
    this.hw = data.hw; this.hh = data.hh;
    this.hp = data.hp; this.maxHp = data.maxHp;
    this.alive = true; this.frame = 0;
    this.state = 'enter'; this.stateTimer = 150;
    this.mouthY = 220 - 60;
    this.mouthTargetY = 220;
    this.beamCharging = false; this.beamFiring = false; this.beamCharge = 0;
    this.beamY = 0; this.beamWidth = 0;
    this.armY = 0; this.shakeAmt = 0;
    this.phase = 0;
    this.damageFlash = 0;
    this.hitStop = 0;
  }

  update(player) {
    // Perform collision checks BEFORE hitStop return so bullets don't pass through
    ProjectileManager.playerBullets.forEach(b => {
      if (b.alive && Physics.aabb(b, this)) {
        if (b.type === 'bomb') {
          if (!b.exploded) b.explode();
          this.hitStop = 8;
        } else {
          b.alive = false; this.takeDamage(b.damage);
          this.hitStop = 8;
        }
      }
    });
    ProjectileManager.playerBullets.forEach(b => {
      if (b.type === 'bomb' && b.exploded && b.explosionTimer === 1) {
        const dx = this.x - b.x, dy = this.y - b.y;
        if (Math.sqrt(dx * dx + dy * dy) < b.explosionRadius) {
          this.takeDamage(b.damage);
          this.hitStop = 8;
        }
      }
    });
    if (!player.invincible && Physics.aabb(this, player)) player.takeDamage(15, this.x);

    if (this.hitStop > 0) {
      this.hitStop--;
      return;
    }
    this.frame++;
    if (this.damageFlash > 0) this.damageFlash--;
    const hpRatio = this.hp / this.maxHp;
    if (hpRatio <= 0.5 && this.phase < 1) this.phase = 1;
    const spd = this.phase >= 1 ? 1.4 : 1;

    this.stateTimer--;
    if (this.stateTimer <= 0) this.nextState(spd);

    switch (this.state) {
      case 'enter': 
        this.x = 800 + Math.sin(this.frame * 0.03) * 10; 
        this.y += (220 - this.y) * 0.03; // Slowly come down
        break;
      case 'idle':
        this.x = 780 + Math.sin(this.frame * 0.02) * 15;
        this.y = 220 + Math.sin(this.frame * 0.025) * 10;
        break;
      case 'beam_track':
        this.mouthTargetY = player.y + 60; // Mouth is at y - 60
        this.y += (this.mouthTargetY - this.y) * 0.04; // Move entire boss vertically
        this.mouthY = this.y - 60;
        break;
      case 'beam_lock':
        this.beamCharging = true;
        this.beamCharge = Math.min(1, (60 - this.stateTimer) / 60);
        this.mouthY = this.y - 60;
        break;
      case 'beam_fire':
        this.beamFiring = true;
        this.mouthY = this.y - 60;
        this.beamY = this.mouthY;
        this.beamWidth = Math.min(40, this.beamWidth + 4);
        const beamTop = this.beamY - this.beamWidth / 2;
        const beamBot = this.beamY + this.beamWidth / 2;
        const playerTop = player.y - player.hh;
        const playerBot = player.y + player.hh;
        if (!player.invincible && playerBot > beamTop && playerTop < beamBot) {
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
          // Reduced slam range significantly
          if (player.onGround && player.x > this.x - 180 && player.x < this.x + 20) {
            player.takeDamage(25, this.x);
          }
          for (let i = 0; i < 6; i++) {
            ProjectileManager.addEnemyBullet(this.x - 50 + (Math.random() - 0.5) * 150, Physics.GROUND_Y - 25, (Math.random() - 0.5) * 3, -3 - Math.random() * 4, 'debris');
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
            ProjectileManager.addEnemyBullet(this.x + 60, 300 + i * 30, 6, 0, 'energy');
          }
        }
        break;
    }

    if (this.shakeAmt > 0) this.shakeAmt *= 0.88;
    if (this.state !== 'beam_fire') { this.beamFiring = false; this.beamWidth = 0; }
    if (this.state !== 'beam_lock') { this.beamCharging = false; this.beamCharge = 0; }
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
    
    let tilt = 0, yOff = 0;
    if (this.state === 'slam_windup') {
      tilt = -(this.armY / 70) * 0.15; yOff = -(this.armY / 70) * 20;
    } else if (this.state === 'slam_hit') {
      tilt = 0.2; yOff = 15;
    } else if (this.state === 'beam_lock') {
      tilt = Math.sin(this.frame * 0.5) * 0.05 * this.beamCharge;
    } else if (this.state === 'beam_fire') {
      tilt = -0.1 + Math.sin(this.frame * 0.8) * 0.03;
    }

    ctx.translate(this.x + sx, this.y + yOff);
    ctx.rotate(tilt);
    
    // Bioluminescent glow aura
    ctx.fillStyle = `rgba(0,120,200,${0.08 + Math.sin(this.frame * 0.04) * 0.04})`;
    ctx.beginPath(); ctx.arc(0, 0, 120, 0, Math.PI*2); ctx.fill();
    
    // Draw the main body sprite
    Renderer.drawLeviathan(ctx, 0, 0, 1, this.frame);
    
    // Damage flash overlay
    if (this.damageFlash > 0) {
      ctx.globalAlpha = 0.4;
      ctx.fillStyle = '#ff4444';
      ctx.fillRect(-60, -80, 120, 160);
      ctx.globalAlpha = 1;
    }
    
    // Tentacle arm (slam attack)
    if (this.state === 'slam_windup' || this.state === 'slam_hit') {
      ctx.save();
      ctx.fillStyle = this.damageFlash > 0 ? '#cc5533' : '#2a3a4e';
      ctx.translate(-40, -40);
      const armRot = this.state === 'slam_windup' ? -(this.armY / 70) * 1.2 : 1.5;
      ctx.rotate(armRot);
      ctx.beginPath();
      ctx.moveTo(-12, 0); ctx.quadraticCurveTo(-25, -50, -8, -100);
      ctx.quadraticCurveTo(8, -50, 12, 0);
      ctx.fill();
      // Suckers
      ctx.fillStyle = '#4a5a6e';
      ctx.beginPath(); ctx.arc(-18, -35, 4, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(-14, -60, 3, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(-10, -85, 3, 0, Math.PI*2); ctx.fill();
      ctx.restore();
    }

    // Glowing mouth energy (beam charge/fire)
    if (this.beamCharging || this.beamFiring) {
      const mOff = (this.mouthY - this.y);
      const intensity = this.beamFiring ? 1 : this.beamCharge;
      ctx.fillStyle = `rgba(255,60,20,${intensity * 0.85})`;
      const glowSize = this.beamFiring ? 25 + Math.sin(this.frame) * 5 : 15 + Math.sin(this.frame * 0.5) * 5;
      ctx.beginPath(); ctx.arc(-50, mOff, glowSize, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(-50, mOff, glowSize * 0.4, 0, Math.PI*2); ctx.fill();
    }
    
    ctx.restore();

    // Beam rendering (outside transform)
    if (this.beamFiring && this.beamWidth > 0) {
      ctx.fillStyle = 'rgba(255,40,10,0.4)';
      ctx.fillRect(0, this.beamY - this.beamWidth / 2, Game.width || 960, this.beamWidth);
      ctx.fillStyle = 'rgba(255,150,60,0.6)';
      ctx.fillRect(0, this.beamY - this.beamWidth / 4, Game.width || 960, this.beamWidth / 2);
      ctx.fillStyle = 'rgba(255,255,200,0.8)';
      ctx.fillRect(0, this.beamY - 2, Game.width || 960, 4);
    }
  }
}

// === CHAPTER 2 FINAL BOSS: Null, The Void's Embrace ===
class NullBoss {
  constructor() {
    this.x = 700; this.y = 350;
    this.hw = 60; this.hh = 60;
    this.hp = 120; this.maxHp = 120;
    this.alive = true; this.frame = 0;
    this.state = 'enter'; this.stateTimer = 180;
    this.phase = 0; this.damageFlash = 0; this.hitStop = 0;
    this.voidRadius = 40; this.tendrils = [];
    this.deletedPlatforms = []; this.weaponLocked = false;
    // Generate tendril data
    for (let i = 0; i < 8; i++) {
      this.tendrils.push({
        angle: (i / 8) * Math.PI * 2, length: 30 + Math.random()*20,
        speed: 0.01 + Math.random()*0.02, offset: Math.random() * Math.PI * 2
      });
    }
  }

  update(player) {
    // Collision checks BEFORE hitStop to prevent bullets passing through
    ProjectileManager.playerBullets.forEach(b => {
      if (b.alive && Physics.aabb(b, this)) {
        if (b.type === 'bomb') { if (!b.exploded) b.explode(); this.hitStop = 8; }
        else { b.alive = false; this.takeDamage(b.damage); this.hitStop = 8; }
      }
    });
    ProjectileManager.playerBullets.forEach(b => {
      if (b.type === 'bomb' && b.exploded && b.explosionTimer === 1) {
        const ddx = this.x - b.x, ddy = this.y - b.y;
        if (Math.sqrt(ddx*ddx + ddy*ddy) < b.explosionRadius) {
          this.takeDamage(b.damage); this.hitStop = 8;
        }
      }
    });
    if (!player.invincible && Physics.aabb(this, player)) player.takeDamage(20, this.x);

    if (this.hitStop > 0) { this.hitStop--; return; }
    this.frame++;
    if (this.damageFlash > 0) this.damageFlash--;
    const hpRatio = this.hp / this.maxHp;
    if (hpRatio <= 0.6 && this.phase < 1) { this.phase = 1; this.voidRadius = 55; }
    if (hpRatio <= 0.3 && this.phase < 2) {
      this.phase = 2; this.voidRadius = 70;
      // Lock player's evolved weapon
      if (player.evolved) { this.weaponLocked = true; player.evolved = false; }
    }
    this.stateTimer--;
    if (this.stateTimer <= 0) this._nextState();

    switch (this.state) {
      case 'enter':
        this.x = 800 + Math.sin(this.frame * 0.02) * 15;
        this.y = 350 + Math.sin(this.frame * 0.03) * 10;
        break;
      case 'idle':
        this.x = 680 + Math.sin(this.frame * 0.025) * 20;
        this.y = 350 + Math.sin(this.frame * 0.03) * 15;
        break;
      case 'barrage':
        if (this.frame % 8 === 0) {
          const angle = (this.frame * 0.15) % (Math.PI * 2);
          ProjectileManager.addEnemyBullet(this.x, this.y, Math.cos(angle)*4, Math.sin(angle)*4, 'energy');
          ProjectileManager.addEnemyBullet(this.x, this.y, Math.cos(angle+Math.PI)*4, Math.sin(angle+Math.PI)*4, 'energy');
        }
        break;
      case 'delete':
        // Delete a random visible platform
        if (this.stateTimer === 30) {
          const plats = LevelManager.platforms;
          if (plats.length > 2) {
            const idx = Math.floor(Math.random() * plats.length);
            this.deletedPlatforms.push(plats[idx]);
            plats.splice(idx, 1);
          }
        }
        if (this.frame % 12 === 0) {
          ProjectileManager.addEnemyBullet(50+Math.random()*600, -10, 0, 3+Math.random()*2, 'debris');
        }
        break;
      case 'vortex':
        // Pull player toward boss
        const dx = this.x - player.x;
        if (Math.abs(dx) > 30) player.x += dx * 0.015;
        if (this.frame % 15 === 0) {
          for (let i = 0; i < 3; i++) {
            ProjectileManager.addEnemyBullet(this.x-40, this.y-30+i*30, -5, (Math.random()-0.5)*3, 'energy');
          }
        }
        break;
    }
  }

  _nextState() {
    const attacks = this.phase >= 2
      ? ['barrage','vortex','delete','barrage','vortex']
      : this.phase >= 1
      ? ['idle','barrage','delete','vortex','idle']
      : ['idle','barrage','idle','barrage'];
    const next = attacks[Math.floor(Math.random() * attacks.length)];
    this.state = next;
    switch (next) {
      case 'idle': this.stateTimer = 60; break;
      case 'barrage': this.stateTimer = 120; break;
      case 'delete': this.stateTimer = 80; break;
      case 'vortex': this.stateTimer = 100; break;
    }
  }

  takeDamage(d) {
    this.hp -= d; this.damageFlash = 8;
    if (typeof ParticleSystem !== 'undefined') ParticleSystem.burst(this.x, this.y, '#8844cc', 8);
    if (this.hp <= 0) {
      this.alive = false;
      // Restore weapon if locked
      if (this.weaponLocked && typeof Game !== 'undefined' && Game.player) {
        Game.player.evolved = true;
      }
    }
  }

  draw(ctx) {
    ctx.save();
    const sx = this.damageFlash > 0 ? (Math.random()-0.5)*6 : 0;
    ctx.translate(this.x + sx, this.y);

    // Darkness overlay (vision restriction)
    const darkRadius = 200 - this.phase * 30;
    const grd = ctx.createRadialGradient(0, 0, darkRadius, 0, 0, Game.width);
    grd.addColorStop(0, 'rgba(0,0,0,0)');
    grd.addColorStop(0.5, 'rgba(0,0,0,0.3)');
    grd.addColorStop(1, 'rgba(0,0,0,0.6)');

    // Tendrils
    ctx.strokeStyle = this.damageFlash > 0 ? '#cc44ff' : '#221133';
    ctx.lineWidth = 3;
    this.tendrils.forEach(t => {
      const a = t.angle + Math.sin(this.frame * t.speed + t.offset) * 0.5;
      const len = t.length + Math.sin(this.frame * 0.05 + t.offset) * 15 + this.phase * 10;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(
        Math.cos(a) * len * 0.5 + Math.sin(this.frame*0.03)*8,
        Math.sin(a) * len * 0.5,
        Math.cos(a) * len, Math.sin(a) * len
      );
      ctx.stroke();
    });

    // Core body image
    Renderer.drawNullBoss(ctx, 0, 0, 1.0, this.frame, this.phase);


    // Phase 2+: emerging shapes from void
    if (this.phase >= 1) {
      const vr = 40 + this.phase * 10;
      ctx.fillStyle = `rgba(80,40,120,${0.4+Math.sin(this.frame*0.06)*0.2})`;
      for (let i = 0; i < 4 + this.phase * 2; i++) {
        const a = (i / (4 + this.phase*2)) * Math.PI * 2 + this.frame * 0.01;
        const d = vr * 0.7 + Math.sin(this.frame*0.04+i)*8;
        ctx.fillRect(Math.cos(a)*d - 4, Math.sin(a)*d - 6, 8, 12);
      }
    }

    ctx.restore();
  }
}
