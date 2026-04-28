// === ITEMS.JS - Drops & Inventory (10% drop rate maintained) ===
class DroppedItem {
  constructor(x,y,type){this.x=x;this.y=y;this.type=type;this.hw=10;this.hh=10;this.alive=true;this.frame=0;this.vy=-3;this.grounded=false;this.lifeTimer=0;}
  update(){this.frame++;this.lifeTimer++;if(!this.grounded){this.vy+=0.2;this.y+=this.vy;if(this.y+this.hh>=Physics.GROUND_Y){this.y=Physics.GROUND_Y-this.hh;this.grounded=true;this.vy=0;}}if(this.lifeTimer>600)this.alive=false;if(this.x<-20)this.alive=false;}
  draw(ctx){if(this.lifeTimer>480&&this.frame%10<5)return;Renderer.drawItem(ctx,this.x,this.y,2,this.type,this.frame);}
}
const Inventory = {
  slots:[null,null,null], maxSlots:3,
  atkUpTimer:0, atkUpActive:false,
  add(type){for(let i=0;i<this.maxSlots;i++){if(!this.slots[i]){this.slots[i]=type;return true;}}return false;},
  use(idx,player){
    const item=this.slots[idx];if(!item)return false;
    switch(item){
      case 'healS':player.hp=Math.min(player.maxHp,player.hp+15);break;
      case 'healM':player.hp=Math.min(player.maxHp,player.hp+30);break;
      case 'atkUp':this.atkUpActive=true;this.atkUpTimer=1200;player.atkMultiplier=2;break;
    }
    this.slots[idx]=null;
    if(typeof AudioManager!=='undefined')AudioManager.playSE('itemGet');
    return true;
  },
  update(player){if(this.atkUpActive){this.atkUpTimer--;if(this.atkUpTimer<=0){this.atkUpActive=false;player.atkMultiplier=1;}}},
  clear(){this.slots=[null,null,null];this.atkUpActive=false;this.atkUpTimer=0;},
};
const ItemManager = {
  items:[], DROP_RATE:0.10,
  tryDrop(x,y,eType){
    if(Math.random()>this.DROP_RATE)return;
    let type;
    switch(eType){case 'tireShark':type='healS';break;case 'vendingMachine':type='healM';break;case 'acHermitCrab':type='atkUp';break;default:type='healS';}
    this.items.push(new DroppedItem(x,y,type));
  },
  update(player){
    this.items.forEach(i=>{i.update();
      if(i.alive&&Physics.aabb(i,player)){if(Inventory.add(i.type)){i.alive=false;if(typeof AudioManager!=='undefined')AudioManager.playSE('itemGet');}}
    });
    this.items=this.items.filter(i=>i.alive);
  },
  draw(ctx){this.items.forEach(i=>i.draw(ctx));},
  clear(){this.items=[];},
};
