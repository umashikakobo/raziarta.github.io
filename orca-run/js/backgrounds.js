// === BACKGROUNDS.JS - Parallax Image Layers ===
const Backgrounds = {
  draw(ctx, camX, stageOrPhase) {
    // Accept either stage data object or phase index
    const stageData = typeof stageOrPhase === 'object' ? stageOrPhase : AssetLoader.getStage(stageOrPhase);
    if (!stageData) return;
    const phase = stageData.bgPhase || 0;

    // Draw solid color at the bottom
    ctx.fillStyle = stageData.groundColor;
    ctx.fillRect(0, Game.height - 50, Game.width, 50);

    // Draw parallax layers
    stageData.backgrounds.forEach(layer => {
      const img = AssetLoader.img(layer.src);
      if (!img) return;
      
      const scale = Game.height / img.height;
      const scaledW = img.width * scale;
      let offsetX = (camX * layer.speed) % scaledW;
      
      for(let x = -offsetX; x < Game.width; x += scaledW) {
        ctx.drawImage(img, Math.floor(x), 0, scaledW + 1, Game.height);
      }
    });

    // Darken background progressively for Stage 4, 5, 6
    if (phase >= 3) {
      let darkAlpha = 0;
      if (phase === 4) darkAlpha = 0.5; // Stage 5
      else if (phase >= 5) darkAlpha = 0.8; // Stage 6
      if (darkAlpha > 0) {
        ctx.fillStyle = `rgba(0, 0, 5, ${darkAlpha})`;
        ctx.fillRect(0, 0, Game.width, Game.height);
      }
    }

    // Draw ground line
    const groundY = (typeof Physics !== 'undefined') ? Physics.GROUND_Y : Game.height - 80;

    // Phase 4/5: Cave Walls (岸壁)
    if (phase >= 4) {
      ctx.save();
      const wallColor = phase === 5 ? '#111520' : '#1a202c';
      ctx.fillStyle = wallColor;
      
      // Top wall (stalactites/jagged)
      ctx.beginPath();
      ctx.moveTo(0, 0);
      for (let x = 0; x <= Game.width; x += 30) {
        // More jagged and visible
        const h = 60 + Math.sin((x + camX * 0.4) * 0.05) * 30 + Math.cos((x + camX * 0.4) * 0.1) * 20;
        ctx.lineTo(x, h);
      }
      ctx.lineTo(Game.width, 0);
      ctx.fill();

      // Bottom wall (stalagmites/jagged) - rises up from the ground
      ctx.beginPath();
      ctx.moveTo(0, Game.height);
      for (let x = 0; x <= Game.width; x += 40) {
        const h = Game.height - (50 + Math.sin((x + camX * 0.5) * 0.04) * 40 + Math.sin((x + camX * 0.5) * 0.12) * 15);
        ctx.lineTo(x, h);
      }
      ctx.lineTo(Game.width, Game.height);
      ctx.fill();
      ctx.restore();
    }

  }
};
