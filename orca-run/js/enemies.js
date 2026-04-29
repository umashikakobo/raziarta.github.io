// === ENEMIES.JS - JSON-Driven Enemies ===
class Enemy {
  constructor(x, type, scale = 1.0) {
    const data = AssetLoader.getEnemy(type);
    this.type = type;
    this.x = x;
    this.hw = data.hw * scale;
    this.hh = data.hh * scale;
    this.hp = data.hp;
    this.damage = data.damage;
    this.speed = data.speed || 0;
    this.dropRate = data.dropRate || 0.1;
    this.alive = true;
    this.frame = 0;
    this.y = Physics.GROUND_Y - this.hh - 25;
    this.hitStop = 0;
  }
}

class TireShark extends Enemy {
  constructor(x) { super(x, 'tire_shark', 1.8); }
  update() { this.frame++; this.x += this.speed; if (this.x < -50) this.alive = false; }
  draw(ctx) { Renderer.drawTireShark(ctx, this.x, this.y, 1.8, this.frame); }
  takeDamage(d) { this.hp -= d; if (this.hp <= 0) this.alive = false; }
}

class VendingMachine extends Enemy {
  constructor(x) {
    super(x, 'vending_machine', 1.5);
    const data = AssetLoader.getEnemy('vending_machine');
    this.shootInterval = data.shootInterval;
    this.shootTimer = 0;
    this.shooting = false;
    this.scrollWith = true;
  }
  update(ss, px, py) {
    this.frame++; this.x -= ss; if (this.x < -50) this.alive = false;
    this.shootTimer++; this.shooting = false;
    if (this.shootTimer >= this.shootInterval && this.x > 0 && this.x < Game.width) {
      this.shooting = true;
      const dx = px - this.x, dy = py - this.y, dist = Math.sqrt(dx * dx + dy * dy) || 1;
      ProjectileManager.addEnemyBullet(this.x, this.y + 5, (dx / dist) * 6.5, (dy / dist) * 6.5, 'can');
      this.shootTimer = 0;
      if (typeof AudioManager !== 'undefined') AudioManager.playSE('canShoot');
    }
  }
  draw(ctx) { Renderer.drawVendingMachine(ctx, this.x, this.y, 1.5, this.frame, this.shooting); }
  takeDamage(d) { this.hp -= d; if (this.hp <= 0) this.alive = false; }
}

class ACHermitCrab extends Enemy {
  constructor(x) {
    super(x, 'ac_hermit_crab', 1.5);
    this.y = 25;
    this.scrollWith = true;
    this.state = 'hover';
    this.hoverTimer = 60;
    this.diving = false;
    this.targetX = 0;
    this.targetY = 0;
  }
  update(ss, px, py) {
    this.frame++; this.x -= ss * 0.5; if (this.x < -50) this.alive = false;
    if (this.state === 'hover') {
      this.y = 25 + Math.sin(this.frame * 0.05) * 15; this.hoverTimer--;
      if (this.hoverTimer <= 0) { this.state = 'dive'; this.targetX = px; this.targetY = py; this.diving = true; }
    } else if (this.state === 'dive') {
      const dx = this.targetX - this.x, dy = this.targetY - this.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      this.x += dx / dist * 5; this.y += dy / dist * 5;
      if (dist < 20 || this.y >= Physics.GROUND_Y - this.hh) { this.state = 'recover'; this.diving = false; this.hoverTimer = 40; }
    } else if (this.state === 'recover') {
      this.hoverTimer--; this.vy = -2; this.y += this.vy;
      if (this.hoverTimer <= 0) { this.state = 'hover'; this.hoverTimer = 80; }
    }
  }
  draw(ctx) { Renderer.drawACHermitCrab(ctx, this.x, this.y, 1.5, this.frame, this.diving); }
  takeDamage(d) { this.hp -= d; if (this.hp <= 0) this.alive = false; }
}

class CartShark extends Enemy {
  constructor() {
    super(Game.width, 'cart_shark', 2.2);
    const data = AssetLoader.getEnemy('cart_shark');
    this.maxHp = data.maxHp;
    this.state = 'enter';
    this.stateTimer = 120;
    this.attackCooldown = 0;
    this.hitStop = 0;
  }
  update(player) {
    this.frame++; this.stateTimer--;
    switch (this.state) {
      case 'enter': this.x -= 2; if (this.x <= 700) { this.state = 'idle'; this.stateTimer = 60; } break;
      case 'idle': if (this.stateTimer <= 0) { this.state = Math.random() > 0.5 ? 'charge' : 'scatter'; this.stateTimer = this.state === 'charge' ? 90 : 60; } break;
      case 'charge': if (this.stateTimer > 60) { /*windup*/ } else { this.x -= 8; if (this.x < 100) { this.state = 'return'; this.stateTimer = 60; } } break;
      case 'scatter': if (this.frame % 15 === 0) { for (let i = 0; i < 3; i++) { ProjectileManager.addEnemyBullet(this.x - 20, this.y - 20 + i * 15, -4 - Math.random() * 2, (Math.random() - 0.5) * 3, 'debris'); } }
        if (this.stateTimer <= 0) { this.state = 'idle'; this.stateTimer = 80; } break;
      case 'return': this.x += 3; if (this.x >= 700) { this.state = 'idle'; this.stateTimer = 60; } break;
    }
    // Collision
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
    if (!player.invincible && Physics.aabb(this, player)) player.takeDamage(this.damage, this.x);
  }
  takeDamage(d) { this.hp -= d; if (typeof ParticleSystem !== 'undefined') ParticleSystem.burst(this.x, this.y - 20, '#ffaa44', 5); if (this.hp <= 0) this.alive = false; }
  draw(ctx) { Renderer.drawCartShark(ctx, this.x, this.y, 2.2, this.frame); }
}

class SignalJelly extends Enemy {
  constructor() {
    super(Game.width, 'signal_jelly', 2.5);
    this.hw = 14; this.hh = 14; // Head-only hitbox (precision target)
    this.hp = 16; this.maxHp = 16;
    this.y = 175 + Game.height * 0.15;
    this.state = 'enter'; this.stateTimer = 120;
    this.signalColor = 0; this.signalTimer = 0; this.hitStop = 0;
  }
  update(player) {
    this.frame++; this.stateTimer--;
    const baseY = 155 + Game.height * 0.15;
    this.y = baseY + Math.sin(this.frame * 0.02) * 120;
    switch (this.state) {
      case 'enter': this.x -= 2; if (this.x <= 650) { this.state = 'signal'; this.stateTimer = 120; this.signalColor = 0; this.signalTimer = 0; } break;
      case 'signal': this.signalTimer++;
        if (this.signalTimer >= 90) { this.signalColor = (this.signalColor + 1) % 3; this.signalTimer = 0; }
        if (this.signalColor === 0 && this.frame % 25 === 0) {
          ProjectileManager.addEnemyBullet(this.x - 30, this.y, -5, 0, 'energy');
          ProjectileManager.addEnemyBullet(this.x - 30, this.y + 20, -5, 1, 'energy');
        }
        if (this.signalColor === 1 && this.frame % 40 === 0) {
          for (let a = 0; a < 6; a++) { const ang = a * Math.PI / 3; ProjectileManager.addEnemyBullet(this.x, this.y, Math.cos(ang) * 3, Math.sin(ang) * 3, 'energy'); }
        }
        if (this.signalColor === 2 && this.frame % 15 === 0) {
          ProjectileManager.addEnemyBullet(this.x - 20 + Math.random() * 40, -10, 0, 4, 'debris');
        }
        if (this.stateTimer <= 0) { this.state = 'signal'; this.stateTimer = 300; } break;
    }
    ProjectileManager.playerBullets.forEach(b => {
      if (b.alive && Physics.aabb(b, this)) {
        if (b.type === 'bomb') { if (!b.exploded) b.explode(); this.hitStop = 8; }
        else { b.alive = false; this.takeDamage(b.damage); this.hitStop = 8; }
      }
    });
    if (!player.invincible && Physics.aabb(this, player)) player.takeDamage(this.damage, this.x);
  }
  takeDamage(d) { this.hp -= d; if (typeof ParticleSystem !== 'undefined') ParticleSystem.burst(this.x, this.y, '#aaccff', 5); if (this.hp <= 0) this.alive = false; }
  draw(ctx) { Renderer.drawSignalJelly(ctx, this.x, this.y, 2.5, this.frame, this.maxHp, this.hp); }
}

// === CHAPTER 2 ENEMIES ===
class SubmarineCrab extends Enemy {
  constructor(x) {
    super(x, 'submarine_crab', 1.0);
    this.y = Physics.GROUND_Y - this.hh - 5;
    this.shootTimer = 0; this.shootInterval = 180;
    this.scrollWith = true; this.type = 'submarineCrab';
  }
  update(ss, px, py) {
    this.frame++; this.x -= ss; if (this.x < -50) this.alive = false;
    this.shootTimer++;
    if (this.shootTimer >= this.shootInterval && this.x > 0 && this.x < Game.width) {
      const dx = px - this.x, dy = py - this.y, dist = Math.sqrt(dx*dx+dy*dy)||1;
      ProjectileManager.addEnemyBullet(this.x, this.y, (dx/dist)*3, (dy/dist)*3, 'energy');
      this.shootTimer = 0;
    }
  }
  draw(ctx) {
    Renderer.drawSubmarineCrab(ctx, this.x, this.y, 1.5, this.frame);
  }
  takeDamage(d) { this.hp -= d; if (this.hp <= 0) this.alive = false; }
}

class MorayEel extends Enemy {
  constructor(x) {
    super(x, 'moray_eel', 1.0);
    this.baseY = 350 + Math.random() * 80;
    this.y = this.baseY; this.type = 'morayEel';
  }
  update() {
    this.frame++; this.x -= 5;
    this.y = this.baseY + Math.sin(this.frame * 0.08) * 60;
    if (this.x < -60) this.alive = false;
  }
  draw(ctx) {
    Renderer.drawMorayEel(ctx, this.x, this.y, 1.0, this.frame);
  }
  takeDamage(d) { this.hp -= d; if (this.hp <= 0) this.alive = false; }
}

class CarrierSeal extends Enemy {
  constructor(x) {
    super(x, 'carrier_seal', 1.0);
    this.y = Physics.GROUND_Y + 40;
    this.state = 'hidden'; this.stateTimer = 60 + Math.random() * 60;
    this.type = 'carrierSeal'; this.scrollWith = true;
  }
  update(ss) {
    this.frame++; this.x -= ss * 0.3; if (this.x < -50) this.alive = false;
    this.stateTimer--;
    if (this.state === 'hidden') {
      if (this.stateTimer <= 0) { this.state = 'emerge'; this.vy = -12; }
    } else if (this.state === 'emerge') {
      this.vy += 0.4; this.y += this.vy;
      if (this.y >= Physics.GROUND_Y - this.hh) { this.y = Physics.GROUND_Y - this.hh; this.state = 'surface'; this.stateTimer = 90; }
    } else if (this.state === 'surface') {
      if (this.stateTimer <= 0) { this.state = 'dive'; this.vy = 3; }
    } else if (this.state === 'dive') {
      this.y += this.vy;
      if (this.y > Physics.GROUND_Y + 60) { this.state = 'hidden'; this.stateTimer = 120; }
    }
  }
  draw(ctx) {
    if (this.state === 'hidden') return;
    Renderer.drawCarrierSeal(ctx, this.x, this.y, 1.5, this.frame, this.state);
  }
  takeDamage(d) { this.hp -= d; if (this.hp <= 0) this.alive = false; }
}

// === CHAPTER 2 MID-BOSS: Abyss Angler ===
class AbyssAngler extends Enemy {
  constructor() {
    super(Game.width, 'tire_shark', 3.0);
    this.hp = 40; this.maxHp = 40;
    this.hw = 50; this.hh = 40;
    this.y = 200; this.state = 'enter'; this.stateTimer = 120;
    this.hitStop = 0; this.flashTimer = 0; this.type = 'abyssAngler';
  }
  update(player) {
    this.frame++; this.stateTimer--;
    if (this.flashTimer > 0) this.flashTimer--;
    switch (this.state) {
      case 'enter': this.x -= 2; if (this.x <= 650) { this.state = 'idle'; this.stateTimer = 80; } break;
      case 'idle':
        this.y = 200 + Math.sin(this.frame * 0.03) * 30;
        if (this.stateTimer <= 0) {
          const r = Math.random();
          if (r < 0.33) { this.state = 'flash'; this.stateTimer = 90; this.flashTimer = 30; }
          else if (r < 0.66) { this.state = 'vacuum'; this.stateTimer = 120; }
          else { this.state = 'charge'; this.stateTimer = 60; }
        } break;
      case 'flash':
        if (this.stateTimer < 60 && this.frame % 10 === 0) {
          ProjectileManager.addEnemyBullet(this.x - 30, this.y, -7, (Math.random()-0.5)*3, 'energy');
        }
        if (this.stateTimer <= 0) { this.state = 'idle'; this.stateTimer = 60; } break;
      case 'vacuum':
        if (this.frame % 20 === 0) {
          for (let i = 0; i < 4; i++) ProjectileManager.addEnemyBullet(this.x-40, this.y-20+i*15, -5-Math.random()*2, (Math.random()-0.5)*3, 'debris');
        }
        if (this.stateTimer <= 0) { this.state = 'idle'; this.stateTimer = 80; } break;
      case 'charge':
        this.x -= 6;
        if (this.x < 100) { this.state = 'return'; this.stateTimer = 80; } break;
      case 'return': this.x += 3; if (this.x >= 650) { this.state = 'idle'; this.stateTimer = 60; } break;
    }
    ProjectileManager.playerBullets.forEach(b => {
      if (b.alive && Physics.aabb(b, this)) {
        if (b.type === 'bomb') { if (!b.exploded) b.explode(); this.hitStop = 8; }
        else { b.alive = false; this.takeDamage(b.damage); this.hitStop = 8; }
      }
    });
    if (!player.invincible && Physics.aabb(this, player)) player.takeDamage(this.damage, this.x);
  }
  takeDamage(d) { this.hp -= d; if (typeof ParticleSystem !== 'undefined') ParticleSystem.burst(this.x, this.y, '#44aaff', 6); if (this.hp <= 0) this.alive = false; }
  draw(ctx) {
    Renderer.drawAbyssAngler(ctx, this.x, this.y, 1.0, this.frame, this.flashTimer > 0);
  }
}

const EnemyManager = {
  enemies: [], midBoss: null, enabled: true,
  init() { this.enemies = []; this.midBoss = null; this.enabled = true; },
  spawn(type) {
    if (type === 'tireShark') this.enemies.push(new TireShark(Game.width + 20));
    else if (type === 'vendingMachine') this.enemies.push(new VendingMachine(Game.width + 20));
    else if (type === 'acHermitCrab') this.enemies.push(new ACHermitCrab(Game.width + 20));
    else if (type === 'submarineCrab') this.enemies.push(new SubmarineCrab(Game.width + 20));
    else if (type === 'morayEel') this.enemies.push(new MorayEel(Game.width + 20));
    else if (type === 'carrierSeal') this.enemies.push(new CarrierSeal(Game.width + 20));
  },
  spawnMidBoss(type) {
    if (type === 'cartShark') this.midBoss = new CartShark();
    else if (type === 'signalJelly') this.midBoss = new SignalJelly();
    else if (type === 'abyssAngler') this.midBoss = new AbyssAngler();
    this.enabled = false;
  },
  update(ss, player, damagePopups) {
    this.enemies.forEach(e => {
      if (e.hitStop > 0) {
        e.hitStop--;
      } else {
        if (e.scrollWith) e.update(ss, player.x, player.y); else e.update();
      }
      if (e.alive && !player.invincible && Physics.aabb(e, player)) player.takeDamage(e.damage, e.x);
    });
    ProjectileManager.playerBullets.forEach(b => {
      this.enemies.forEach(e => {
        if (b.alive && e.alive && Physics.aabb(b, e)) {
          if (b.type === 'bomb') {
            if (!b.exploded) b.explode();
            e.hitStop = 8;
          } else {
            e.takeDamage(b.damage); b.alive = false;
            e.hitStop = 3;
          }
          if (damagePopups) damagePopups.push({ x: e.x, y: e.y, dmg: b.damage, timer: 40, maxTimer: 40 });
          if (!e.alive) {
            ItemManager.tryDrop(e.x, e.y, e.dropRate); // using external dropRate
            if (typeof AudioManager !== 'undefined') AudioManager.playSE('enemyDie');
            if (typeof ParticleSystem !== 'undefined') ParticleSystem.burst(e.x, e.y, '#ff8844', 8);
          } else {
            if (typeof ParticleSystem !== 'undefined') ParticleSystem.burst(e.x, e.y, '#fff', 4);
          }
        }
      });
    });
    ProjectileManager.checkBombAoE(this.enemies);
    this.enemies = this.enemies.filter(e => e.alive);
    if (this.midBoss) {
      if (this.midBoss.alive) {
        if (this.midBoss.hitStop > 0) {
          this.midBoss.hitStop--;
        } else {
          this.midBoss.update(player);
        }
        ProjectileManager.playerBullets.forEach(b => {
          if (b.type === 'bomb' && b.exploded && b.explosionTimer === 1) {
            const dx = this.midBoss.x - b.x, dy = this.midBoss.y - b.y;
            if (Math.sqrt(dx * dx + dy * dy) < b.explosionRadius) {
              this.midBoss.takeDamage(b.damage);
              this.midBoss.hitStop = 8;
              if (damagePopups) damagePopups.push({ x: this.midBoss.x, y: this.midBoss.y, dmg: b.damage, timer: 40, maxTimer: 40 });
            }
          }
        });
      } else {
        this.midBoss = null; this.enabled = true;
        ItemManager.items.push(new DroppedItem(700, Physics.GROUND_Y - 30, 'healM'));
      }
    }
  },
  draw(ctx) { this.enemies.forEach(e => e.draw(ctx)); if (this.midBoss && this.midBoss.alive) this.midBoss.draw(ctx); },
  clear() { this.enemies = []; this.midBoss = null; this.enabled = true; },
};
