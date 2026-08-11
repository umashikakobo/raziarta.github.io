import Phaser from 'phaser';
import { Enemy } from './Enemy';

export class FloaterEnemy extends Enemy {
    private startY: number;
    private amplitude: number;
    private frequency: number;
    private horzSpeed: number;
    private floaterDirection: number = 1;

    constructor(scene: Phaser.Scene, x: number, y: number, amplitude: number = 18, frequency: number = 0.7, horzSpeed: number = 40) {
        super(scene, x, y, 0, 0, 1);
        
        this.startY = y;
        this.amplitude = amplitude;
        this.frequency = frequency;
        this.horzSpeed = horzSpeed;
        
        this.setGravityY(0);
        this.setBounce(0, 0);
    }

    override update(time: number, _delta: number) {
        if (this.getIsDead()) return;

        // 左右の壁で反転
        if (this.body?.blocked.left) {
            this.floaterDirection = 1;
        } else if (this.body?.blocked.right) {
            this.floaterDirection = -1;
        }

        // X軸移動
        this.setVelocityX(this.floaterDirection * this.horzSpeed);
        this.setFlipX(this.floaterDirection < 0);

        // Y軸サイン波移動 (Phaser time は ms)
        const t = time / 1000;
        const targetY = this.startY + Math.sin(Math.PI * 2 * this.frequency * t) * this.amplitude;
        
        this.y = targetY;

        if (this.scene.textures.exists('enemy_run')) {
            this.setTexture('enemy_run');
        }
    }
}
