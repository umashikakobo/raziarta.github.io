// === RENDERER.JS - Asset-based Image Renderer ===
const Renderer = {
  drawOrca(ctx, x, y, scale, facing, frame, crouching, damaged) {
    ctx.save();
    ctx.translate(x, y);
    if (facing < 0) ctx.scale(-1, 1);

    let img;
    if (damaged) {
      img = AssetLoader.img('assets/sprites/player/orca_damaged.png');
    } else if (crouching) {
      img = AssetLoader.img('assets/sprites/player/orca_crouch.png');
    } else {
      // 0-9: stand, 10-19: walk1, 20-29: walk2
      const walkFrame = Math.floor(frame / 10) % 4;
      if (walkFrame === 1) img = AssetLoader.img('assets/sprites/player/orca_walk_1.png');
      else if (walkFrame === 3) img = AssetLoader.img('assets/sprites/player/orca_walk_2.png');
      else img = AssetLoader.img('assets/sprites/player/orca_stand.png');
    }

    if (img) {
      // Use fixed drawing dimensions so high-res sprites are scaled correctly
      const baseW = 70;
      const baseH = crouching ? 40 : 70; // Crouch height updated to 40
      const dw = baseW * scale;
      const dh = baseH * scale;
      
      // Center horizontally, and set vertical origin to the feet
      const ox = dw / 2;
      const oy = crouching ? dh * 0.95 : dh * 0.82; // Adjusted oy for crouch alignment
      
      ctx.drawImage(img, -ox, -oy, dw, dh);
    }
    ctx.restore();
  },

  drawPenguin(ctx, x, y, scale, straight) {
    ctx.save(); ctx.translate(x, y);
    const img = AssetLoader.img('assets/sprites/weapons/penguin_bullet.png');
    if (img) ctx.drawImage(img, -20 * scale, -15 * scale, 40 * scale, 30 * scale);
    ctx.restore();
  },

  drawPenguinBomb(ctx, x, y, scale, timer) {
    ctx.save(); ctx.translate(x, y);
    const img = AssetLoader.img('assets/sprites/weapons/penguin_bomb.png');
    if (img) ctx.drawImage(img, -20 * scale, -20 * scale, 40 * scale, 40 * scale);
    ctx.restore();
  },

  drawExplosion(ctx, x, y, radius, alpha) {
    ctx.save();
    ctx.globalAlpha = alpha;
    let imgIdx = 1;
    if (radius > 35) imgIdx = 3;
    else if (radius > 25) imgIdx = 2;
    const img = AssetLoader.img(`assets/sprites/weapons/explosion/explosion_${imgIdx}.png`);
    if (img) {
      // Base radius of explosion was 15, 25, 35 in baker. Image is 80x80. Origin 40,40
      const s = radius / (15 + imgIdx*10) * 1.5; // scaling factor relative to baked
      ctx.translate(x, y);
      ctx.scale(s, s);
      ctx.drawImage(img, -40, -40, 80, 80);
    }
    ctx.restore();
  },

  drawTireShark(ctx, x, y, scale, frame) {
    ctx.save(); ctx.translate(x, y);
    const data = AssetLoader.getEnemy('tire_shark');
    const fIdx = Math.floor(frame / 5) % 2;
    const img = AssetLoader.img(data.sprites.frames[fIdx]);
    if (img) ctx.drawImage(img, -data.sprites.originX * scale, -data.sprites.originY * scale, data.sprites.width * scale, data.sprites.height * scale);
    ctx.restore();
  },

  drawVendingMachine(ctx, x, y, scale, frame, shooting) {
    ctx.save(); ctx.translate(x, y);
    const data = AssetLoader.getEnemy('vending_machine');
    const img = AssetLoader.img(shooting ? data.sprites.shoot : data.sprites.idle);
    if (img) ctx.drawImage(img, -data.sprites.originX * scale, -data.sprites.originY * scale, data.sprites.width * scale, data.sprites.height * scale);
    ctx.restore();
  },

  drawACHermitCrab(ctx, x, y, scale, frame, diving) {
    ctx.save(); ctx.translate(x, y);
    const data = AssetLoader.getEnemy('ac_hermit_crab');
    const img = AssetLoader.img(diving ? data.sprites.dive : data.sprites.hover);
    if (img) ctx.drawImage(img, -data.sprites.originX * scale, -data.sprites.originY * scale, data.sprites.width * scale, data.sprites.height * scale);
    ctx.restore();
  },

  drawCartShark(ctx, x, y, scale, frame) {
    ctx.save(); ctx.translate(x, y);
    const data = AssetLoader.getEnemy('cart_shark');
    const img = AssetLoader.img(data.sprites.idle); // using idle for now
    if (img) ctx.drawImage(img, -data.sprites.originX * scale, -data.sprites.originY * scale, data.sprites.width * scale, data.sprites.height * scale);
    ctx.restore();
  },

  drawSignalJelly(ctx, x, y, scale, frame, hpMax, hp) {
    ctx.save(); ctx.translate(x, y);
    const data = AssetLoader.getEnemy('signal_jelly');
    let color = 'green';
    const ratio = hp / hpMax;
    if (ratio <= 0.3) color = 'red';
    else if (ratio <= 0.6) color = 'yellow';
    const img = AssetLoader.img(data.sprites[color]);
    if (img) ctx.drawImage(img, -data.sprites.originX * scale, -data.sprites.originY * scale, data.sprites.width * scale, data.sprites.height * scale);
    ctx.restore();
  },

  drawLeviathan(ctx, x, y, scale, frame) {
    ctx.save(); ctx.translate(x, y);
    const data = AssetLoader.getEnemy('leviathan');
    const img = AssetLoader.img(data.sprites.idle);
    if (img) ctx.drawImage(img, -data.sprites.originX * scale, -data.sprites.originY * scale, data.sprites.width * scale, data.sprites.height * scale);
    ctx.restore();
  },

  drawCan(ctx, x, y, scale) {
    ctx.save(); ctx.translate(x, y);
    const img = AssetLoader.img('assets/sprites/projectiles/can_bullet.png');
    if (img) ctx.drawImage(img, -10 * scale, -8 * scale, 20 * scale, 16 * scale);
    ctx.restore();
  },

  drawItem(ctx, x, y, scale, type, frame) {
    ctx.save(); ctx.translate(x, y + Math.sin(frame*0.1)*3*scale);
    let img;
    if (type === 'atkUp') img = AssetLoader.img('assets/sprites/items/atk_up.png');
    else if (type === 'healS') img = AssetLoader.img('assets/sprites/items/heal_small.png');
    else if (type === 'healM') img = AssetLoader.img('assets/sprites/items/heal_medium.png');

    if (img) ctx.drawImage(img, -15 * scale, -15 * scale, 30 * scale, 30 * scale);
    ctx.restore();
  },

  drawParticle(ctx, p) {
    ctx.globalAlpha = p.alpha;
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    ctx.globalAlpha = 1;
  },

  drawDamagePopup(ctx, x, y, dmg, alpha, offsetY, color = '#ffcc33') {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = color;
    ctx.font = 'bold 14px "Press Start 2P"';
    ctx.textAlign = 'center';
    ctx.fillText(String(dmg), x + 20, y - 20 + offsetY);
    ctx.restore();
  },

  drawPlatform(ctx, plat, camX) {
    const px = plat.x - camX, py = plat.y;
    if (px + plat.w < 0 || px > Game.width) return;
    ctx.fillStyle = '#3a3a4a';
    ctx.fillRect(px, py, plat.w, plat.h);
    ctx.fillStyle = '#4a4a5a';
    ctx.fillRect(px, py, plat.w, 3);
    ctx.fillStyle = '#2a2a3a';
    ctx.fillRect(px, py + plat.h - 2, plat.w, 2);
  },

  drawTitleLogo(logoCtx) {
    logoCtx.clearRect(0, 0, 400, 120);
    logoCtx.fillStyle = '#c0d0f0';
    logoCtx.font = 'bold 52px "DotGothic16"';
    logoCtx.textAlign = 'center';
    logoCtx.fillText('シャチラン', 200, 55);
    logoCtx.fillText('シャチラン', 202, 55);
    logoCtx.fillStyle = '#2a3050';
    logoCtx.fillRect(40, 75, 320, 2);
    logoCtx.fillStyle = '#1a1e30';
    logoCtx.fillRect(175, 80, 25, 12);
    logoCtx.fillStyle = '#d0d4e0';
    logoCtx.fillRect(180, 85, 15, 5);
    logoCtx.fillStyle = '#1a1e30';
    logoCtx.fillRect(190, 75, 8, 7);
    logoCtx.fillRect(162, 82, 8, 4);
    logoCtx.fillRect(162, 88, 6, 4);
    logoCtx.fillStyle = '#5a6a8a';
    logoCtx.font = '10px "Press Start 2P"';
    logoCtx.fillText('A.D. ????  — 人類滅亡後の世界', 200, 112);
  },
};
