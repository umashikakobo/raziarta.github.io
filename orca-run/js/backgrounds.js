// === BACKGROUNDS.JS - Parallax Image Layers ===
const Backgrounds = {
  draw(ctx, camX, phase) {
    const stageData = AssetLoader.getStage(phase);
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
      
      // Draw image twice (or more if needed) for seamless looping
      // Added +1 to width and Math.floor to x to prevent 1px seams
      for(let x = -offsetX; x < Game.width; x += scaledW) {
        ctx.drawImage(img, Math.floor(x), 0, scaledW + 1, Game.height);
      }
    });

    // Draw ground line
    ctx.fillStyle = stageData.groundLineColor;
    ctx.fillRect(0, Game.height - 50, Game.width, 4);
  }
};
