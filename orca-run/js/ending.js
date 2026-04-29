// === ENDING.JS - Emotional Victory Sequence ===
const Ending = {
  active:false, phase:0, timer:0, alpha:0, textAlpha:0, orcaX:-60,
  score:0, clearTime:0, stars:[],
  start(score,time){
    this.active=true;this.phase=0;this.timer=0;this.alpha=0;this.textAlpha=0;this.orcaX=-60;
    this.score=score;this.clearTime=time;
    this.stars=[];for(let i=0;i<70;i++)this.stars.push({x:Math.random()*Game.width,y:Math.random()*(Game.height*0.6),size:1+Math.random()*2,tw:Math.random()*6.28,sp:0.02+Math.random()*0.03});
    AudioManager.stopAll();
  },
  update(){
    if(!this.active)return;this.timer++;
    switch(this.phase){
      case 0:this.alpha=Math.min(1,this.timer/120);if(this.timer>150){this.phase=1;this.timer=0;}break;
      case 1:this.alpha=1-Math.min(1,this.timer/100);if(this.timer>130){this.phase=2;this.timer=0;}break;
      case 2:this.orcaX=-60+this.timer*1.1;if(this.timer>450){this.phase=3;this.timer=0;}break;
      case 3:this.textAlpha=Math.min(1,this.timer/80);if(this.timer>320){this.phase=4;this.timer=0;}break;
      case 4:this.textAlpha=Math.min(1,this.timer/50);break;
    }
  },
  draw(ctx,w,h){
    if(!this.active)return;
    if(this.phase===0){ctx.fillStyle=`rgba(255,255,255,${this.alpha})`;ctx.fillRect(0,0,w,h);return;}
    const g=ctx.createLinearGradient(0,0,0,h);
    g.addColorStop(0,'#121020');g.addColorStop(0.3,'#3a1838');g.addColorStop(0.5,'#cc4a28');g.addColorStop(0.7,'#ff7a3a');g.addColorStop(1,'#ffbb55');
    ctx.fillStyle=g;ctx.fillRect(0,0,w,h);
    this.stars.forEach(s=>{ctx.globalAlpha=Math.max(0,0.3+Math.sin(this.timer*s.sp+s.tw)*0.45);ctx.fillStyle='#fff';ctx.fillRect(s.x,s.y,s.size,s.size);});
    ctx.globalAlpha=1;
    // City silhouette
    ctx.fillStyle='#0a0818';
    const cityBaseX = (w - 960) / 2;
    [0,55,140,195,300,370,440,530,610,690,770,850].forEach((bx,i)=>{const bh=75+((i*41+11)%130);ctx.fillRect(cityBaseX+bx,h-95-bh,48+(i%3)*22,bh+95);});
    ctx.fillRect(0,h-95,w,95);ctx.fillStyle='#1a1428';ctx.fillRect(0,h-95,w,3);
    if(this.phase===1){ctx.fillStyle=`rgba(255,255,255,${this.alpha})`;ctx.fillRect(0,0,w,h);}
    if(this.phase>=2){
      const lp=Math.sin(this.timer*0.14);
      ctx.fillStyle='#06060e';const ox=this.orcaX,oy=h-125;
      ctx.fillRect(ox-12,oy-8,24,14);ctx.fillRect(ox+8,oy-6,8,10);ctx.fillRect(ox-16,oy-2,6,6);ctx.fillRect(ox-16,oy+4,5,4);
      ctx.fillRect(ox-1,oy-13,5,6);
      ctx.fillRect(ox+18,oy-5,14,7);
      ctx.fillRect(ox-5+lp*4,oy+6,4,11);ctx.fillRect(ox+3-lp*4,oy+6,4,11);
    }
    if(this.phase>=3){
      ctx.globalAlpha=this.textAlpha;ctx.fillStyle='#e0d0c0';ctx.font='14px "DotGothic16"';ctx.textAlign='center';
      ctx.fillText('この世界は、もう誰のものでもない。',w/2,h/2-85);
      ctx.font='11px "DotGothic16"';ctx.fillStyle='#aa9080';
      ctx.fillText('だから、好きなように歩いていく。',w/2,h/2-60);
      ctx.globalAlpha=1;
    }
    if(this.phase>=4){
      ctx.globalAlpha=this.textAlpha;ctx.fillStyle='rgba(0,0,0,0.35)';ctx.fillRect(w/2-190,h/2-25,380,130);
      ctx.fillStyle='#ffcc80';ctx.font='18px "Press Start 2P"';ctx.textAlign='center';ctx.fillText('CLEAR!',w/2,h/2+8);
      ctx.fillStyle='#ddd';ctx.font='10px "Press Start 2P"';
      ctx.fillText(`SCORE: ${this.score}`,w/2,h/2+38);
      ctx.fillText(`TIME: ${this.fmt(this.clearTime)}`,w/2,h/2+58);
      if(this.timer>100){ctx.font='7px "Press Start 2P"';ctx.fillStyle='#777';ctx.fillText('CLICK TO RETURN',w/2,h/2+90);}
      ctx.textAlign='left';ctx.globalAlpha=1;
    }
  },
  fmt(f){const s=Math.floor(f/60),m=Math.floor(s/60);return `${m}:${String(s%60).padStart(2,'0')}`;},
  isClickable(){return this.phase===4&&this.timer>100;},
};
