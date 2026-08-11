import Phaser from 'phaser';
import { ItemType } from './Item';

export class ItemBox extends Phaser.Physics.Arcade.Sprite {
    public dropItemType: ItemType;
    public dropAmount: number;
    public isBroken: boolean = false;

    constructor(scene: Phaser.Scene, x: number, y: number, dropType: ItemType = 'Coin', dropAmount: number = 1) {
        super(scene, x, y, 'black_box');
        
        scene.add.existing(this);
        scene.physics.add.existing(this);

        this.dropItemType = dropType;
        this.dropAmount = dropAmount;

        this.setImmovable(true);
        (this.body as Phaser.Physics.Arcade.Body).allowGravity = false;
        
        // 見た目の設定 (テクスチャが指定されていなければ茶色にする等)
        this.setTint(0x8B4513);
    }

    public breakBox() {
        if (this.isBroken) return;
        this.isBroken = true;
        
        // main.tsにアイテム生成を依頼する
        this.scene.events.emit('spawnItem', this.x, this.y, this.dropItemType, this.dropAmount);
        
        // 箱を消滅させる
        this.destroy();
    }
}
