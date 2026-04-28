// === PROJECTILES.JS - Normal (straight) + Bomb (arc+AoE) ===
class PenguinBullet {
  constructor(x, y, dir, atkMul) {
    this.x=x; this.y=y; this.vx=dir*9; this.vy=0; // STRAIGHT - no gravity
    this.hw=5; this.hh=5; this.alive=true; this.damage=1*atkMul;
    this.type='normal'; this.frame=0;
  }
  update() {
    this.frame++; this.x+=this.vx;
    if(this.x<-100||this.x>Game.width+100) this.alive=false;
  }
  draw(ctx) { Renderer.drawPenguin(ctx,this.x,this.y,1.5,true); }
}

class PenguinBomb {
  constructor(x, y, dir, atkMul) {
    this.x=x; this.y=y; this.vx=dir*5; this.vy=-6;
    this.hw=6; this.hh=6; this.alive=true; this.damage=2*atkMul;
    this.type='bomb'; this.frame=0; this.exploded=false;
    this.explosionRadius=80; this.explosionTimer=0; this.explosionDuration=20;
    this.bounceCount = 4; // Bounces 4 times
  }
  update() {
    this.frame++;
    if(this.exploded) {
      this.explosionTimer++;
      if(this.explosionTimer>=this.explosionDuration) this.alive=false;
      return;
    }
    this.vy+=0.25; this.x+=this.vx; this.y+=this.vy;

    // Bounce logic
    if(this.y+this.hh>=Physics.GROUND_Y) {
      if (this.bounceCount > 0) {
        this.y = Physics.GROUND_Y - this.hh;
        this.vy = -Math.max(Math.abs(this.vy) * 0.6, 3.5); // Reverse and dampen with minimum velocity
        this.bounceCount--;
        if(typeof AudioManager!=='undefined') AudioManager.playSE('land');
      } else {
        this.explode();
      }
    }

    if(this.x<-100||this.x>Game.width+100) this.alive=false;
  }
  explode() {
    this.exploded=true; this.explosionTimer=0;
    if(typeof AudioManager!=='undefined') AudioManager.playSE('explosion');
    if(typeof ParticleSystem!=='undefined') ParticleSystem.burst(this.x,this.y,'#ff8844',12);
  }
  draw(ctx) {
    if(this.exploded) {
      const prog=this.explosionTimer/this.explosionDuration;
      const r=this.explosionRadius*Math.sin(prog*Math.PI);
      Renderer.drawExplosion(ctx,this.x,this.y,r,1-prog);
    } else {
      Renderer.drawPenguinBomb(ctx,this.x,this.y,1.5,this.frame);
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
  addPlayerBullet(x,y,dir,type,atkMul) {
    if(type==='bomb') this.playerBullets.push(new PenguinBomb(x,y,dir,atkMul));
    else this.playerBullets.push(new PenguinBullet(x,y,dir,atkMul));
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
