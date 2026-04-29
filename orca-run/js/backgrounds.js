// === BACKGROUNDS.JS - Parallax Image Layers ===
const Backgrounds = {
  draw(ctx, camX, stageOrPhase) {
    // Accept either stage data object or phase index
    const stageData = typeof stageOrPhase === 'object' ? stageOrPhase : AssetLoader.getStage(stageOrPhase);
    if (!stageData) return;

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

    // Draw ground line
    ctx.fillStyle = stageData.groundLineColor;
    ctx.fillRect(0, Game.height - 50, Game.width, 4);

    // Chapter 2 darkness tint (bgPhase >= 3)
    const phase = stageData.bgPhase || 0;
    if (phase >= 3) {
      const darkness = 0.15 + (phase - 3) * 0.1;
      ctx.fillStyle = `rgba(0, 0, 8, ${darkness})`;
      ctx.fillRect(0, 0, Game.width, Game.height);
    }
  }
};
