import Phaser from 'phaser';

export type ItemType = 'Coin' | 'Health' | 'Energy' | 'Ammo';

export class Item extends Phaser.Physics.Arcade.Sprite {
    public itemType: ItemType;
    public amount: number;

    constructor(scene: Phaser.Scene, x: number, y: number, type: ItemType, amount: number = 1) {
        super(scene, x, y, 'black_box'); // 仮のテクスチャ。あとでLDtkの画像などに差し替え可能
        
        scene.add.existing(this);
        scene.physics.add.existing(this);

        this.itemType = type;
        this.amount = amount;

        // アイテムごとの見た目の違い (仮)
        this.setDisplaySize(12, 12);
        switch (type) {
            case 'Coin':
                this.setTint(0xffff00); // 黄色
                break;
            case 'Health':
                this.setTint(0xff0000); // 赤
                break;
            case 'Energy':
                this.setTint(0x0000ff); // 青
                break;
            case 'Ammo':
                this.setTint(0x888888); // グレー
                break;
        }

        // 物理挙動 (箱から飛び出すような動き)
        this.setGravityY(800);
        this.setBounce(0.5);
        this.setCollideWorldBounds(true);
        
        // 少し上に跳ねさせる
        this.setVelocity(Phaser.Math.Between(-50, 50), -200);
    }
}
