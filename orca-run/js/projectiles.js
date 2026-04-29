// === PROJECTILES.JS - Normal (straight) + Bomb (arc+AoE) + Evolution ===
class PenguinBullet {
  constructor(x, y, dir, atkMul, evolved) {
    this.x=x; this.y=y; this.vx=dir*9; this.vy=0;
    this.hw=5; this.hh=5; this.alive=true; this.damage=1*atkMul;
    this.type='normal'; this.frame=0;
    this.evolved = evolved || false;
  }
  update() {
    this.frame++; this.x+=this.vx;
    if(this.x<-100||this.x>Game.width+100) this.alive=false;
  }
  draw(ctx) {
    Renderer.drawPenguin(ctx, this.x, this.y, 1.5, true, this.evolved);
  }
}

class PenguinBomb {
  constructor(x, y, dir, atkMul, evolved) {
    this.x=x; this.y=y; this.vx=dir*6.5; this.vy=-6;
    this.hw=6; this.hh=6; this.alive=true; this.damage=2*atkMul;
    this.type='bomb'; this.frame=0; this.exploded=false;
    this.evolved = evolved || false;
    this.explosionRadius = evolved ? 104 : 80; // 1.3x when evolved
    this.explosionTimer=0; this.explosionDuration=20;
    this.bounceCount = evolved ? 2 : 4; // 2 bounces when evolved, 4 normally
    this.homing = false;
    this.homingTarget = null;
  }
  update() {
    this.frame++;
    if(this.exploded) {
      this.explosionTimer++;
      if(this.explosionTimer>=this.explosionDuration) this.alive=false;
      return;
    }

    // Homing phase (evolved only, after 2 bounces)
    if (this.homing && this.homingTarget) {
      const dx = this.homingTarget.x - this.x;
      const dy = this.homingTarget.y - this.y;
      const dist = Math.sqrt(dx*dx + dy*dy);
      if (dist < 15) {
        this.explode();
        return;
      }
      const speed = 7;
      this.vx += (dx / dist) * 0.8;
      this.vy += (dy / dist) * 0.8;
      const curSpeed = Math.sqrt(this.vx*this.vx + this.vy*this.vy);
      if (curSpeed > speed) {
        this.vx = (this.vx / curSpeed) * speed;
        this.vy = (this.vy / curSpeed) * speed;
      }
      this.x += this.vx;
      this.y += this.vy;
      // Timeout: explode after 120 frames of homing
      if (this.frame > 180) this.explode();
      return;
    }

    this.vy+=0.25; this.x+=this.vx; this.y+=this.vy;

    // Bounce logic
    if(this.y+this.hh>=Physics.GROUND_Y) {
      this.y = Physics.GROUND_Y - this.hh;
      if (this.bounceCount > 1) {
        this.vy = -Math.max(Math.abs(this.vy) * 0.6, 3.5);
        this.bounceCount--;
        if(typeof AudioManager!=='undefined') AudioManager.playSE('land');
      } else {
        // Evolved: start homing after final bounce
        if (this.evolved && !this.homing) {
          this.homing = true;
          this.homingTarget = this._findNearestEnemy();
          if (!this.homingTarget) this.explode(); // No target, just explode
        } else {
          this.explode();
        }
      }
    }

    if(this.x<-100||this.x>Game.width+100) this.alive=false;
  }

  _findNearestEnemy() {
    let nearest = null;
    let minDist = Infinity;
    // Check normal enemies
    if (typeof EnemyManager !== 'undefined') {
      EnemyManager.enemies.forEach(e => {
        if (!e.alive) return;
        const d = Math.sqrt((e.x-this.x)**2 + (e.y-this.y)**2);
        if (d < minDist) { minDist = d; nearest = e; }
      });
      // Check mid-boss
      if (EnemyManager.midBoss && EnemyManager.midBoss.alive) {
        const mb = EnemyManager.midBoss;
        const d = Math.sqrt((mb.x-this.x)**2 + (mb.y-this.y)**2);
        if (d < minDist) { minDist = d; nearest = mb; }
      }
    }
    // Check boss
    if (typeof Game !== 'undefined' && Game.boss && Game.boss.alive) {
      const b = Game.boss;
      const d = Math.sqrt((b.x-this.x)**2 + (b.y-this.y)**2);
      if (d < minDist) { minDist = d; nearest = b; }
    }
    return nearest;
  }

  explode() {
    this.exploded=true; this.explosionTimer=0; this.homing=false;
    if(typeof AudioManager!=='undefined') AudioManager.playSE('explosion');
  }
  draw(ctx) {
    if(this.exploded) {
      Renderer.drawExplosion(ctx, this.x, this.y, this.explosionTimer, this.explosionDuration);
    } else {
      Renderer.drawPenguinBomb(ctx, this.x, this.y, 1.5, this.frame, this.evolved);
      if (this.homing) {
        // Trail particles
        ctx.save(); ctx.translate(this.x, this.y);
        ctx.globalAlpha = 0.5;
        ctx.fillStyle = '#2266cc';
        ctx.beginPath(); ctx.arc(-this.vx*2, -this.vy*2, 5, 0, Math.PI*2); ctx.fill();
        ctx.globalAlpha = 0.25;
        ctx.beginPath(); ctx.arc(-this.vx*4, -this.vy*4, 3, 0, Math.PI*2); ctx.fill();
        ctx.restore();
      }
    }
  }
}

class CanBullet {
  constructor(x,y,vx,vy){this.x=x;this.y=y;this.vx=vx;this.vy=vy||0;this.hw=5;this.hh=4;this.alive=true;this.damage=1;}
  update(){this.x+=this.vx;this.y+=this.vy;if(this.x<-100||this.x>Game.width+100||this.y<-100||this.y>Game.height+100)this.alive=false;}
  draw(ctx){Renderer.drawCan(ctx,this.x,this.y,1.5);}
}

class BossBullet {
  constructor(x,y,vx,vy,type){this.x=x;this.y=y;this.vx=vx;this.vy=vy;this.hw=type==='debris'?6:4;this.hh=this.hw;this.alive=true;this.type=type;this.damage=2;this.timer=0;}
  update(){this.timer++;this.x+=this.vx;this.y+=this.vy;if(this.type==='debris')this.vy+=0.15;if(this.x<-100||this.x>Game.width+100||this.y>Game.height+100||this.timer>300)this.alive=false;}
  draw(ctx){
    ctx.save();ctx.translate(this.x,this.y);
    ctx.fillStyle=this.type==='debris'?'#7a5a4a':'#ff6633';
    ctx.fillRect(-this.hw,-this.hh,this.hw*2,this.hh*2);
    ctx.fillStyle=this.type==='debris'?'#5a3a2a':'#ffaa33';
    ctx.fillRect(-2,-2,4,4);
    ctx.restore();
  }
}

const ProjectileManager = {
  playerBullets: [], enemyBullets: [],
  addPlayerBullet(x,y,dir,type,atkMul,evolved) {
    if(type==='bomb') this.playerBullets.push(new PenguinBomb(x,y,dir,atkMul,evolved));
    else this.playerBullets.push(new PenguinBullet(x,y,dir,atkMul,evolved));
  },
  addEnemyBullet(x,y,vx,vy,type) {
    if(type==='can') this.enemyBullets.push(new CanBullet(x,y,vx,vy));
    else this.enemyBullets.push(new BossBullet(x,y,vx,vy,type||'energy'));
  },
  update() {
    this.playerBullets.forEach(b=>b.update());
    this.enemyBullets.forEach(b=>b.update());
    this.playerBullets=this.playerBullets.filter(b=>b.alive);
    this.enemyBullets=this.enemyBullets.filter(b=>b.alive);
  },
  draw(ctx) { this.playerBullets.forEach(b=>b.draw(ctx)); this.enemyBullets.forEach(b=>b.draw(ctx)); },
  // AoE check for bombs
  checkBombAoE(enemies) {
    this.playerBullets.forEach(b => {
      if(b.type==='bomb' && b.exploded && b.explosionTimer===1) {
        enemies.forEach(e => {
          if(!e.alive) return;
          const dx=e.x-b.x, dy=e.y-b.y;
          if(Math.sqrt(dx*dx+dy*dy) < b.explosionRadius) {
            e.takeDamage(b.damage);
            if(typeof ParticleSystem!=='undefined') ParticleSystem.burst(e.x,e.y,'#ffaa44',5);
          }
        });
      }
    });
  },
  clear() { this.playerBullets=[]; this.enemyBullets=[]; },
};
