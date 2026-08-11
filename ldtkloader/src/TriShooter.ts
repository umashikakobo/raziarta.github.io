import Phaser from 'phaser';
import { Enemy } from './Enemy';
import { EnemyBullet } from './EnemyBullet';

export class TriShooter extends Enemy {
    private fireTimer: number = 0;
    private fireInterval: number = 2000; // 2秒ごとに発射
    private bullets: EnemyBullet[] = [];

    constructor(scene: Phaser.Scene, x: number, y: number) {
        super(scene, x, y, 0, 0, 3); // hp=3, moveSpeed=0
        
        this.setGravityY(0); 
        this.setBounce(0, 0);
        this.setTint(0xffaa00); // オレンジ色にしておく
        this.setDisplaySize(24, 24); // 当たり判定に収まるサイズ
    }

    override update(time: number, delta: number) {
        if (this.getIsDead()) return;

        if (this.scene.textures.exists('enemy_idle')) {
            this.setTexture('enemy_idle');
        }

        // 弾の発射ロジック
        this.fireTimer += delta;
        if (this.fireTimer >= this.fireInterval) {
            this.fireTimer = 0;
            this.fire();
        }

        // 弾の更新
        this.bullets = this.bullets.filter(b => b.active);
        this.bullets.forEach(b => b.update(time, delta));
    }

    private fire() {
        const speed = 150;
        const angles = [-30, 0, 30]; // 3方向に撃つ
        const newBullets: EnemyBullet[] = [];
        
        // プレイヤーの方向を計算
        const mainScene = this.scene as any;
        const player = mainScene.player;
        let baseAngle = -90; // デフォルトは真上

        if (player) {
            const dx = player.x - this.x;
            const dy = player.y - this.y;
            baseAngle = Phaser.Math.RadToDeg(Math.atan2(dy, dx));
        }
        
        angles.forEach(deg => {
            const rad = Phaser.Math.DegToRad(baseAngle + deg);
            const vx = Math.cos(rad) * speed;
            const vy = Math.sin(rad) * speed;
            const bullet = new EnemyBullet(this.scene, this.x, this.y, vx, vy);
            this.bullets.push(bullet);
            newBullets.push(bullet);
        });
        
        this.scene.events.emit('enemyFire', newBullets);
    }
}
