// === PLAYER.JS - Orca with Crouch, Dual Weapons, Reload ===
class Player {
  constructor() {
    this.x = 200; this.y = 300;
    this.vx = 0; this.vy = 0;
    this.hw = 14; this.hh = 18;
    this.standHH = 18; this.crouchHH = 8;
    this.speed = 4.5;
    this.jumpForce = -9.5; this.doubleJumpForce = -8;
    this.hp = 100; this.maxHp = 100;
    this.alive = true;
    this.onGround = false;
    this.canDoubleJump = true;
    this.facing = 1;
    this.frame = 0;
    this.crouching = false;
    // Normal shot (left click)
    this.shotCooldown = 0; this.shotCooldownMax = 12;
    // Bomb (right click)
    this.bombCooldown = 0; this.bombCooldownMax = 120; // 2 seconds
    // Damage
    this.invincible = false; this.invTimer = 0; this.invDuration = 90;
    this.knockback = false; this.kbTimer = 0;
    this.damaged = false; this.dmgFlash = 0;
    // Attack buff
    this.atkMultiplier = 1;
  }

  update(keys, mouseL, mouseR, platforms, camX) {
    this.frame++;
    if (this.invincible) { this.invTimer--; if (this.invTimer<=0) { this.invincible=false; this.damaged=false; } }
    if (this.knockback) { this.kbTimer--; if (this.kbTimer<=0) this.knockback=false; }
    if (this.shotCooldown > 0) this.shotCooldown--;
    if (this.bombCooldown > 0) this.bombCooldown--;

    // Crouch (Hold S or Down)
    const wantCrouch = keys['s'] || keys['S'] || keys['ArrowDown'];
    if (wantCrouch && !this.knockback) {
      this.crouching = true;
      this.hh = this.crouchHH;
      // Sliding effect if on ground
      if (this.onGround) this.vx *= 0.95;
    } else {
      this.crouching = false;
      this.hh = this.standHH;
    }

    // Movement (disabled during crouch or knockback)
    if (!this.knockback && !this.crouching) {
      this.vx = 0;
      if (keys['ArrowLeft']||keys['a']) { this.vx = -this.speed; this.facing = -1; }
      if (keys['ArrowRight']||keys['d']) { this.vx = this.speed; this.facing = 1; }
    } else if (this.crouching) {
      this.vx = 0;
    }

    // Jump (disabled during crouch)
    if ((keys['Space']||keys[' ']) && !this.crouching) {
      if (this.onGround) {
        this.vy = this.jumpForce; this.onGround = false; this.canDoubleJump = true;
        if(typeof AudioManager!=='undefined') AudioManager.playSE('jump');
      } else if (this.canDoubleJump) {
        this.vy = this.doubleJumpForce; this.canDoubleJump = false;
        if(typeof AudioManager!=='undefined') AudioManager.playSE('jump');
      }
      keys['Space']=false; keys[' ']=false;
    }

    // Shoot normal (left click or Z) - disabled during crouch
    if (!this.crouching && (mouseL || keys['z'] || keys['Z']) && this.shotCooldown <= 0) {
      this.shootNormal();
      this.shotCooldown = this.shotCooldownMax;
    }

    // Shoot bomb (right click or X) - disabled during crouch
    if (!this.crouching && (mouseR || keys['x'] || keys['X']) && this.bombCooldown <= 0) {
      this.shootBomb();
      this.bombCooldown = this.bombCooldownMax;
      mouseR = false;
    }

    // Physics
    Physics.applyGravity(this);
    this.x += this.vx; this.y += this.vy;
    const wasOnGround = this.onGround;
    this.onGround = Physics.groundCheck(this);
    if (!this.onGround) this.onGround = Physics.platformCheck(this, platforms, camX);
    if (this.onGround && !wasOnGround) {
      if(typeof AudioManager!=='undefined') AudioManager.playSE('land');
    }
    Physics.clampToScreen(this, 960);
    if (Physics.pitCheck(this)) { this.hp=0; this.alive=false; }
    if (this.hp<=0) this.alive=false;
    if (this.dmgFlash>0) this.dmgFlash--;

    // Item keys
    for(let i=0;i<3;i++){
      if(keys[String(i+1)]){
        if(typeof Inventory!=='undefined') Inventory.use(i, this);
        keys[String(i+1)]=false;
      }
    }
  }

  shootNormal() {
    const bx=this.x+this.facing*40, by=this.y-2;
    ProjectileManager.addPlayerBullet(bx, by, this.facing, 'normal', this.atkMultiplier);
    if(typeof AudioManager!=='undefined') AudioManager.playSE('shoot');
  }

  shootBomb() {
    const bx=this.x+this.facing*40, by=this.y-5;
    ProjectileManager.addPlayerBullet(bx, by, this.facing, 'bomb', this.atkMultiplier);
    if(typeof AudioManager!=='undefined') AudioManager.playSE('bombShoot');
  }

  takeDamage(amount, fromX) {
    if (this.invincible||!this.alive) return;
    this.hp -= amount;
    this.invincible = true; this.invTimer = this.invDuration;
    this.damaged = true; this.dmgFlash = 10;
    const dir = fromX < this.x ? 1 : -1;
    this.vx = dir*4; this.vy = -5;
    this.knockback = true; this.kbTimer = 15;
    if(typeof AudioManager!=='undefined') AudioManager.playSE('damage');
    if(typeof HUD!=='undefined' && HUD.damagePopups) {
      HUD.damagePopups.push({x: this.x - 20, y: this.y - 30, dmg: amount, timer: 40, maxTimer: 40, color: '#ff3333'});
    }
    if(this.hp<=0) this.alive=false;
  }

  draw(ctx) {
    if(this.invincible && this.frame%6<3) return;
    Renderer.drawOrca(ctx, this.x, this.y, 1.6, this.facing, this.frame, this.crouching, this.dmgFlash>0);
  }

  reset() {
    this.x=200;this.y=300;this.vx=0;this.vy=0;
    this.hp=this.maxHp;this.alive=true;this.onGround=false;
    this.invincible=false;this.knockback=false;this.crouching=false;
    this.shotCooldown=0;this.bombCooldown=0;this.frame=0;this.facing=1;
    this.canDoubleJump=true;this.atkMultiplier=1;this.hh=this.standHH;
  }
}
