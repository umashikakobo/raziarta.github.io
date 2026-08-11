import Phaser from 'phaser';

export class PlayerBullet extends Phaser.Physics.Arcade.Sprite {
    private lifespan: number = 3000;

    constructor(scene: Phaser.Scene, x: number, y: number, velocityX: number, velocityY: number, isSubWeapon: boolean = false) {
        super(scene, x, y, 'black_box'); // 仮画像
        
        scene.add.existing(this);
        scene.physics.add.existing(this);

        if (isSubWeapon) {
            this.setDisplaySize(12, 12);
            this.setTint(0xff00ff); // サブ武器はマゼンタ色
        } else {
            this.setDisplaySize(8, 8);
            this.setTint(0x00ffff); // プレイヤーの通常弾はシアン
        }
        
        const body = this.body as Phaser.Physics.Arcade.Body;
        body.allowGravity = false;
        
        this.setVelocity(velocityX, velocityY);
    }

    update(_time: number, delta: number) {
        this.lifespan -= delta;
        if (this.lifespan <= 0) {
            this.destroy();
        }
    }
}
