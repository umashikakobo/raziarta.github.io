// === PHYSICS.JS - Physics with Platform Support ===
const Physics = {
  GRAVITY: 0.5,
  GROUND_Y: 460,
  TERMINAL_VEL: 14,
  LEFT_WALL: 30,

  aabb(a, b) {
    return a.x-a.hw < b.x+b.hw && a.x+a.hw > b.x-b.hw &&
           a.y-a.hh < b.y+b.hh && a.y+a.hh > b.y-b.hh;
  },

  applyGravity(e) {
    e.vy += this.GRAVITY;
    if (e.vy > this.TERMINAL_VEL) e.vy = this.TERMINAL_VEL;
  },

  groundCheck(e) {
    if (e.y + e.hh >= this.GROUND_Y) {
      e.y = this.GROUND_Y - e.hh;
      e.vy = 0;
      return true;
    }
    return false;
  },

  // Check platforms (array of {x,y,w,h} in world coords)
  platformCheck(e, platforms, camX) {
    for (const p of platforms) {
      const px = p.x - camX;
      if (e.vy >= 0 &&
          e.x + e.hw > px && e.x - e.hw < px + p.w &&
          e.y + e.hh >= p.y && e.y + e.hh <= p.y + 12) {
        e.y = p.y - e.hh;
        e.vy = 0;
        return true;
      }
    }
    return false;
  },

  clampToScreen(e, screenW) {
    if (e.x - e.hw < this.LEFT_WALL) e.x = this.LEFT_WALL + e.hw;
    if (e.x + e.hw > screenW - 10) e.x = screenW - 10 - e.hw;
    if (e.y - e.hh < 0) { e.y = e.hh; e.vy = 0; }
  },

  pitCheck(e, screenH) { return e.y > (screenH || 540) + 40; },
};
