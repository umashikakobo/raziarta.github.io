// === BACKGROUNDS.JS - Parallax Image Layers ===
const Backgrounds = {
  draw(ctx, camX, phase) {
    const stageData = AssetLoader.getStage(phase);
    if (!stageData) return;

    // Draw solid color at the bottom
    ctx.fillStyle = stageData.groundColor;
    ctx.fillRect(0, 540 - 50, 960, 50);

    // Draw parallax layers
    stageData.backgrounds.forEach(layer => {
      const img = AssetLoader.img(layer.src);
      if (!img) return;
      
      // Calculate offset based on scroll speed
      let offsetX = (camX * layer.speed) % img.width;
      
      // Draw image twice for seamless looping
      ctx.drawImage(img, -offsetX, 0);
      ctx.drawImage(img, -offsetX + img.width, 0);
    });

    // Draw ground line
    ctx.fillStyle = stageData.groundLineColor;
    ctx.fillRect(0, 540 - 50, 960, 4);
  }
};
