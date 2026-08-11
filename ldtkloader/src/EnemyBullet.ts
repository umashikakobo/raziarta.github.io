import Phaser from 'phaser';

export class EnemyBullet extends Phaser.Physics.Arcade.Sprite {
    private lifespan: number = 3000; // 3秒で消滅

    constructor(scene: Phaser.Scene, x: number, y: number, velocityX: number, velocityY: number) {
        super(scene, x, y, 'black_box'); // 仮のテクスチャ
        
        scene.add.existing(this);
        scene.physics.add.existing(this);

        this.setDisplaySize(8, 8); // 小さな弾
        this.setTint(0xff8800);
        
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
