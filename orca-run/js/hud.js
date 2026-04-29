// === HUD.JS - HP, Inventory, Reload UI, Damage Popups, Subtitles ===
const HUD = {
  damagePopups: [],

  draw(ctx, player, boss, midBoss, score, subtitle, subtitleTimer) {
    // HP Bar
    this._hpBar(ctx, 32, 28, 320, 25, player.hp, player.maxHp, '#33cc55', 'HP');
    // ATK buff
    if (Inventory.atkUpActive) {
      ctx.fillStyle = '#ff6633'; ctx.font = '14px "Press Start 2P"';
      ctx.fillText(`ATK x2  ${Math.ceil(Inventory.atkUpTimer / 60)}s`, 32, 80);
    }
    // Inventory
    this._inventory(ctx, 32, 90);
    // Score
    ctx.fillStyle = '#ccc'; ctx.font = '10px "Press Start 2P"'; ctx.textAlign = 'right';
    ctx.fillText(`SCORE: ${score}`, Game.width - 20, 28);
    ctx.textAlign = 'left';

    // === Reload UI (bottom-right) ===
    const rlX = Game.width - 176, rlY = Game.height - 80;
    // Normal shot cooldown
    const shotRatio = 1 - player.shotCooldown / player.shotCooldownMax;
    ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(rlX, rlY, 144, 19);
    ctx.fillStyle = shotRatio >= 1 ? '#44cc66' : '#446688';
    ctx.fillRect(rlX, rlY, 144 * shotRatio, 19);
    ctx.fillStyle = '#aaa'; ctx.font = '9px "Press Start 2P"';
    ctx.fillText('SHOT', rlX + 3, rlY + 14);
    // Bomb cooldown
    const bombRatio = 1 - player.bombCooldown / player.bombCooldownMax;
    ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(rlX, rlY + 25, 144, 19);
    ctx.fillStyle = bombRatio >= 1 ? '#ff8833' : '#664422';
    ctx.fillRect(rlX, rlY + 25, 144 * bombRatio, 19);
    ctx.fillStyle = '#aaa'; ctx.font = '9px "Press Start 2P"';
    ctx.fillText('BOMB', rlX + 3, rlY + 39);

    // Boss HP
    if (boss && boss.alive) {
      this._hpBar(ctx, Game.width / 2 - 368, 19, 736, 22, boss.hp, boss.maxHp, '#ee3333', 'LEVIATHAN');
    }
    // Mid-boss HP
    if (midBoss && midBoss.alive) {
      const name = midBoss.type === 'cartShark' ? 'CART SHARK' : 'SIGNAL JELLY';
      this._hpBar(ctx, Game.width / 2 - 288, 19, 576, 22, midBoss.hp, midBoss.maxHp, '#dd6633', name);
    }

    // === Damage Popups ===
    this.damagePopups.forEach(p => {
      p.timer--;
      const prog = 1 - p.timer / p.maxTimer;
      Renderer.drawDamagePopup(ctx, p.x, p.y, p.dmg, 1 - prog, -prog * 25, p.color || '#ffcc33');
    });
    this.damagePopups = this.damagePopups.filter(p => p.timer > 0);

    // === Subtitle (film-style, bottom center) ===
    if (subtitle && subtitleTimer > 0) {
      const alpha = subtitleTimer > 200 ? Math.min(1, (240 - subtitleTimer) / 40)
                  : subtitleTimer < 40 ? subtitleTimer / 40 : 1;
      ctx.save();
      ctx.globalAlpha = alpha;
      // Semi-transparent bar
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.fillRect(0, Game.height - 70, Game.width, 40);
      // Text
      ctx.fillStyle = '#d8d0c8';
      ctx.font = '13px "DotGothic16"';
      ctx.textAlign = 'center';
      ctx.fillText(subtitle, Game.width / 2, Game.height - 44);
      ctx.textAlign = 'left';
      ctx.restore();
    }
  },

  _hpBar(ctx, x, y, w, h, cur, max, color, label) {
    const r = Math.max(0, cur / max);
    ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(x - 3, y - 3, w + 6, h + 6);
    ctx.fillStyle = '#222'; ctx.fillRect(x, y, w, h);
    ctx.fillStyle = color; ctx.fillRect(x, y, w * r, h);
    ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.fillRect(x, y, w * r, h / 3);
    ctx.fillStyle = '#eee'; ctx.font = '11px "Press Start 2P"';
    ctx.fillText(label, x + 4, y + h - 4);
    ctx.textAlign = 'right';
    ctx.fillText(`${Math.max(0, Math.ceil(cur))}/${max}`, x + w - 4, y + h - 4);
    ctx.textAlign = 'left';
  },

  _inventory(ctx, x, y) {
    for (let i = 0; i < 3; i++) {
      const sx = x + i * 60;
      ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fillRect(sx, y, 51, 51);
      ctx.strokeStyle = '#445'; ctx.lineWidth = 1.6; ctx.strokeRect(sx, y, 51, 51);
      ctx.fillStyle = '#666'; ctx.font = '9px "Press Start 2P"'; ctx.fillText(String(i + 1), sx + 3, y + 14);
      if (Inventory.slots[i]) Renderer.drawItem(ctx, sx + 25, y + 30, 2.0, Inventory.slots[i], 0);
    }
  },
};
