import Phaser from 'phaser';
import { Enemy } from './Enemy';

export class BounceEnemy extends Enemy {
    private verticalSpeed: number;

    constructor(scene: Phaser.Scene, x: number, y: number, verticalSpeed: number = 150, hp: number = 1) {
        super(scene, x, y, 0, 0, hp); // hp configuration
        this.verticalSpeed = verticalSpeed;

        this.setGravityY(0); // 重力の影響を受けない
        this.setBounce(1, 1); // 完全にバウンドする

        // 最初の移動方向
        this.setVelocityY(-this.verticalSpeed);
    }

    override update(_time: number, _delta: number) {
        if (this.getIsDead()) return;

        if (this.body) {
            const currentVy = this.body.velocity.y;
            // 壁や床での反発が弱まった場合や止まった場合に速度を復元
            if (Math.abs(currentVy) < this.verticalSpeed * 0.9) {
                const dir = this.body.blocked.down ? -1 : 1;
                this.setVelocityY(dir * this.verticalSpeed);
            }
        }

        if (this.scene.textures.exists('enemy_run')) {
            this.setTexture('enemy_run');
        }
    }
}
