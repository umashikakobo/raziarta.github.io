// === RENDERER.JS - Asset-based Image Renderer ===
const Renderer = {
  drawOrca(ctx, x, y, scale, facing, frame, crouching, damaged, evolved) {
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

      // Evolved: yellow glowing eyes
      if (evolved && !damaged) {
        ctx.fillStyle = '#ffdd00';
        ctx.shadowColor = '#ffaa00';
        ctx.shadowBlur = 6;
        const eyeY = crouching ? -oy + dh * 0.35 : -oy + dh * 0.32;
        const eyeX = dw * 0.12;
        ctx.fillRect(eyeX - 2, eyeY, 4, 3);
        ctx.fillRect(eyeX + 6, eyeY, 4, 3);
        ctx.shadowBlur = 0;
      }
    } else {
      // Fallback: Primitive Orca
      const baseW = 70;
      const baseH = crouching ? 40 : 70;
      const dw = baseW * scale;
      const dh = baseH * scale;
      const ox = dw / 2;
      const oy = crouching ? dh * 0.95 : dh * 0.82;

      ctx.fillStyle = damaged ? '#ff6666' : '#2a3050';
      ctx.fillRect(-ox, -oy, dw, dh);
      ctx.fillStyle = '#fff';
      ctx.fillRect(-ox + dw * 0.2, -oy + dh * 0.2, dw * 0.2, dh * 0.2); // spot
      if (evolved) {
        ctx.fillStyle = '#ffdd00';
        ctx.fillRect(-ox + dw * 0.6, -oy + dh * 0.3, 4, 3);
      }
    }
    ctx.restore();
  },


  drawPenguin(ctx, x, y, scale, straight, evolved) {
    ctx.save(); ctx.translate(x, y);
    const path = evolved ? 'assets/sprites/weapons/penguin_bullet_blue.png' : 'assets/sprites/weapons/penguin_bullet.png';
    const img = AssetLoader.img(path);
    if (img) {
      ctx.drawImage(img, -20 * scale, -15 * scale, 40 * scale, 30 * scale);
    } else {
      // Fallback
      ctx.fillStyle = evolved ? '#4488ff' : '#222';
      ctx.fillRect(-10*scale, -5*scale, 20*scale, 10*scale);
    }
    ctx.restore();
  },

  drawPenguinBomb(ctx, x, y, scale, timer, evolved) {
    ctx.save(); ctx.translate(x, y);
    const path = evolved ? 'assets/sprites/weapons/penguin_bomb_blue.png' : 'assets/sprites/weapons/penguin_bomb.png';
    const img = AssetLoader.img(path);
    if (img) {
      ctx.drawImage(img, -20 * scale, -20 * scale, 40 * scale, 40 * scale);
    } else {
      // Fallback
      ctx.fillStyle = evolved ? '#2255aa' : '#444';
      ctx.beginPath(); ctx.arc(0, 0, 8 * scale, 0, Math.PI*2); ctx.fill();
    }
    ctx.restore();
  },

  drawExplosion(ctx, x, y, timer, duration) {
    ctx.save();
    const prog = timer / duration;
    let imgIdx = 1 + Math.floor(prog * 3);
    if (imgIdx > 3) imgIdx = 3;
    
    const path = `assets/sprites/weapons/explosion/explosion_${imgIdx}.png`;
    const img = AssetLoader.img(path);
    
    ctx.translate(x, y);
    if (img) {
      ctx.globalAlpha = 1.0 - prog; // Fade out over time
      const s = 3.45 + prog * 2.3;   // Scaled up by 1.15x
      ctx.scale(s, s);
      ctx.drawImage(img, -40, -40, 80, 80);
    } else {
      // Fallback: draw a red/orange circle if image is missing
      ctx.beginPath();
      ctx.arc(0, 0, 40 * (1 + prog), 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255, 100, 0, ${0.8 * (1 - prog)})`;
      ctx.fill();
    }
    ctx.restore();
  },

  drawTireShark(ctx, x, y, scale, frame) {
    ctx.save(); ctx.translate(x, y);
    const data = typeof AssetLoader !== 'undefined' ? AssetLoader.getEnemy('tire_shark') : null;
    const fIdx = Math.floor(frame / 5) % 2;
    const img = data ? AssetLoader.img(data.sprites.frames[fIdx]) : null;
    if (img) {
      ctx.drawImage(img, -data.sprites.originX * scale, -data.sprites.originY * scale, data.sprites.width * scale, data.sprites.height * scale);
    } else {
      // Fallback
      ctx.fillStyle = '#666'; ctx.fillRect(-20*scale, -10*scale, 40*scale, 20*scale);
      ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(0,0,12*scale,0,Math.PI*2); ctx.stroke();
    }
    ctx.restore();
  },

  drawVendingMachine(ctx, x, y, scale, frame, shooting) {
    ctx.save(); ctx.translate(x, y);
    const data = typeof AssetLoader !== 'undefined' ? AssetLoader.getEnemy('vending_machine') : null;
    const img = data ? AssetLoader.img(shooting ? data.sprites.shoot : data.sprites.idle) : null;
    if (img) {
      ctx.drawImage(img, -data.sprites.originX * scale, -data.sprites.originY * scale, data.sprites.width * scale, data.sprites.height * scale);
    } else {
      ctx.fillStyle = '#888'; ctx.fillRect(-15*scale, -30*scale, 30*scale, 40*scale);
      ctx.fillStyle = shooting ? '#f00' : '#444'; ctx.fillRect(-5*scale, -20*scale, 10*scale, 10*scale);
    }
    ctx.restore();
  },

  drawACHermitCrab(ctx, x, y, scale, frame, diving) {
    ctx.save(); ctx.translate(x, y);
    const data = typeof AssetLoader !== 'undefined' ? AssetLoader.getEnemy('ac_hermit_crab') : null;
    const img = data ? AssetLoader.img(diving ? data.sprites.dive : data.sprites.hover) : null;
    if (img) {
      ctx.drawImage(img, -data.sprites.originX * scale, -data.sprites.originY * scale, data.sprites.width * scale, data.sprites.height * scale);
    } else {
      ctx.fillStyle = '#3a3a4a'; ctx.fillRect(-15*scale, -10*scale, 30*scale, 20*scale);
      ctx.fillStyle = '#cc5533'; ctx.fillRect(-10*scale, 10*scale, 20*scale, 5*scale);
    }
    ctx.restore();
  },

  drawCartShark(ctx, x, y, scale, frame) {
    ctx.save(); ctx.translate(x, y);
    const data = typeof AssetLoader !== 'undefined' ? AssetLoader.getEnemy('cart_shark') : null;
    const img = data ? AssetLoader.img(data.sprites.idle) : null;
    if (img) {
      ctx.drawImage(img, -data.sprites.originX * scale, -data.sprites.originY * scale, data.sprites.width * scale, data.sprites.height * scale);
    } else {
      ctx.fillStyle = '#666'; ctx.fillRect(-25*scale, -15*scale, 50*scale, 30*scale);
      ctx.fillStyle = '#55a'; ctx.fillRect(-20*scale, -10*scale, 40*scale, 20*scale);
    }
    ctx.restore();
  },

  drawSignalJelly(ctx, x, y, scale, frame, hpMax, hp) {
    ctx.save(); ctx.translate(x, y);
    const data = typeof AssetLoader !== 'undefined' ? AssetLoader.getEnemy('signal_jelly') : null;
    let color = 'green';
    const ratio = hp / hpMax;
    if (ratio <= 0.3) color = 'red';
    else if (ratio <= 0.6) color = 'yellow';
    const img = data ? AssetLoader.img(data.sprites[color]) : null;
    if (img) {
      ctx.drawImage(img, -data.sprites.originX * scale, -data.sprites.originY * scale, data.sprites.width * scale, data.sprites.height * scale);
    } else {
      ctx.fillStyle = 'rgba(150,180,220,0.6)'; ctx.beginPath(); ctx.arc(0,0,15*scale,0,Math.PI*2); ctx.fill();
      ctx.fillStyle = color; ctx.fillRect(-5*scale, -25*scale, 10*scale, 10*scale);
    }
    ctx.restore();
  },

  drawLeviathan(ctx, x, y, scale, frame) {
    ctx.save(); ctx.translate(x, y);
    const data = typeof AssetLoader !== 'undefined' ? AssetLoader.getEnemy('leviathan') : null;
    const frames = data ? data.sprites.idle : null;
    const fIdx = frames ? (Math.floor(frame / 15) % frames.length) : 0;
    const img = frames ? AssetLoader.img(frames[fIdx]) : null;
    if (img) {
      ctx.drawImage(img, -data.sprites.originX * scale, -data.sprites.originY * scale, data.sprites.width * scale, data.sprites.height * scale);
    } else {
      // Primitive Leviathan fallback
      ctx.fillStyle = '#08081a'; ctx.fillRect(-70*scale, -100*scale, 140*scale, 200*scale);
      ctx.fillStyle = '#ff3333'; ctx.fillRect(-30*scale, -80*scale, 15*scale, 10*scale); ctx.fillRect(15*scale, -80*scale, 15*scale, 10*scale);
    }
    ctx.restore();
  },

  drawCan(ctx, x, y, scale) {
    ctx.save(); ctx.translate(x, y);
    const img = AssetLoader.img('assets/sprites/projectiles/can_bullet.png');
    if (img) ctx.drawImage(img, -10 * scale, -8 * scale, 20 * scale, 16 * scale);
    ctx.restore();
  },

  drawSubmarineCrab(ctx, x, y, scale, frame) {
    ctx.save(); ctx.translate(x, y);
    const data = typeof AssetLoader !== 'undefined' ? AssetLoader.getEnemy('submarine_crab') : null;
    const frames = data ? data.sprites.frames : null;
    const fIdx = frames ? (Math.floor(frame / 10) % frames.length) : 0;
    const img = frames ? AssetLoader.img(frames[fIdx]) : null;
    if (img) {
      ctx.drawImage(img, -data.sprites.originX * scale, -data.sprites.originY * scale, data.sprites.width * scale, data.sprites.height * scale);
    } else {
      ctx.fillStyle = '#3a6a5a'; ctx.fillRect(-18*scale, -10*scale, 36*scale, 18*scale);
      ctx.fillStyle = '#2a4a3a'; ctx.fillRect(-18*scale, 2*scale, 36*scale, 6*scale);
    }
    ctx.restore();
  },

  drawMorayEel(ctx, x, y, scale, frame) {
    ctx.save(); ctx.translate(x, y);
    const data = typeof AssetLoader !== 'undefined' ? AssetLoader.getEnemy('moray_eel') : null;
    const frames = data ? data.sprites.frames : null;
    const fIdx = frames ? (Math.floor(frame / 8) % frames.length) : 0;
    const img = frames ? AssetLoader.img(frames[fIdx]) : null;
    if (img) {
      ctx.drawImage(img, -data.sprites.originX * scale, -data.sprites.originY * scale, data.sprites.width * scale, data.sprites.height * scale);
    } else {
      ctx.fillStyle = '#4a5a70'; ctx.fillRect(-20*scale, -10*scale, 40*scale, 20*scale);
      ctx.fillStyle = '#ccaa44'; ctx.fillRect(-10*scale, -2*scale, 4*scale, 4*scale);
    }
    ctx.restore();
  },

  drawCarrierSeal(ctx, x, y, scale, frame, state) {
    ctx.save(); ctx.translate(x, y);
    const data = typeof AssetLoader !== 'undefined' ? AssetLoader.getEnemy('carrier_seal') : null;
    const frames = data ? data.sprites.frames : null;
    const fIdx = state === 'emerge' || state === 'dive' ? 1 : 0;
    const img = (frames && frames[fIdx]) ? AssetLoader.img(frames[fIdx]) : null;
    if (img) {
      ctx.drawImage(img, -data.sprites.originX * scale, -data.sprites.originY * scale, data.sprites.width * scale, data.sprites.height * scale);
    } else {
      ctx.fillStyle = '#5a5a6a'; ctx.fillRect(-20*scale, -20*scale, 40*scale, 40*scale);
      ctx.fillStyle = '#fff'; ctx.fillRect(-8*scale, -3*scale, 2*scale, 2*scale); ctx.fillRect(6*scale, -3*scale, 2*scale, 2*scale);
    }
    ctx.restore();
  },

  drawAbyssAngler(ctx, x, y, scale, frame, flash) {
    ctx.save(); ctx.translate(x, y);
    const data = typeof AssetLoader !== 'undefined' ? AssetLoader.getEnemy('abyss_angler') : null;
    const img = data ? AssetLoader.img(flash ? data.sprites.flash : data.sprites.idle) : null;
    if (img) {
      ctx.drawImage(img, -data.sprites.originX * scale, -data.sprites.originY * scale, data.sprites.width * scale, data.sprites.height * scale);
    } else {
      ctx.fillStyle = '#1a1a2a'; ctx.beginPath(); ctx.arc(0,0,40*scale,0,Math.PI*2); ctx.fill();
      ctx.fillStyle = flash ? '#fff' : '#33aaff'; ctx.beginPath(); ctx.arc(0,-65*scale,10*scale,0,Math.PI*2); ctx.fill();
    }
    ctx.restore();
  },

  drawNullBoss(ctx, x, y, scale, frame, phase) {
    ctx.save(); ctx.translate(x, y);
    const data = typeof AssetLoader !== 'undefined' ? AssetLoader.getEnemy('null_boss') : null;
    const frames = data ? data.sprites.idle : null;
    const img = (frames && frames[phase % frames.length]) ? AssetLoader.img(frames[phase % frames.length]) : null;
    if (img) {
      ctx.drawImage(img, -data.sprites.originX * scale, -data.sprites.originY * scale, data.sprites.width * scale, data.sprites.height * scale);
    } else {
      ctx.fillStyle = '#050510'; ctx.beginPath(); ctx.arc(0,0,60*scale,0,Math.PI*2); ctx.fill();
      ctx.fillStyle = phase > 1 ? '#ff3333' : '#8833ff'; ctx.beginPath(); ctx.arc(0,0,15*scale,0,Math.PI*2); ctx.fill();
    }
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

  drawGround(ctx, width, height, groundY, camX) {
    const h = height - groundY;
    // Base ground color
    ctx.fillStyle = '#1a1e2a';
    ctx.fillRect(0, groundY, width, h);

    // Top highlight line
    ctx.fillStyle = '#3a4a6a';
    ctx.fillRect(0, groundY, width, 4);
    ctx.fillStyle = '#2a3a5a';
    ctx.fillRect(0, groundY + 4, width, 2);

    // Add some "cracks" or "details" that scroll
    ctx.fillStyle = '#141824';
    const tileSize = 128;
    const offset = -(camX % tileSize);
    for (let x = offset; x < width; x += tileSize) {
      // Vertical cracks
      ctx.fillRect(x, groundY + 10, 2, h - 20);
      // Horizontal details
      ctx.fillRect(x + 20, groundY + 30, 40, 2);
      ctx.fillRect(x + 70, groundY + 60, 30, 2);
    }
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
