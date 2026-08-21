import Phaser from 'phaser';
import { Enemy } from './Enemy';
import { EnemyBullet } from './EnemyBullet';

export class ShooterKiller extends Enemy {
    private fireTimer: number = 0;
    private fireInterval: number = 2000; // 2秒ごとに発射
    private bullets: EnemyBullet[] = [];

    constructor(scene: Phaser.Scene, x: number, y: number, hp: number = 1) {
        super(scene, x, y, 0, 0, hp); // hp, moveSpeed=0

        this.setGravityY(0);
        this.setBounce(0, 0);
        this.setTint(0x00ffaa); // シアン/緑系の色
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
        const newBullets: EnemyBullet[] = [];

        // プレイヤーの方向を見て横方向に撃つ
        const mainScene = this.scene as any;
        const player = mainScene.player;
        let direction = -1; // デフォルト左

        if (player) {
            direction = player.x > this.x ? 1 : -1;
        }

        const vx = direction * speed;
        const vy = 0; // 横方向のみ
        const bullet = new EnemyBullet(this.scene, this.x, this.y, vx, vy);

        this.bullets.push(bullet);
        newBullets.push(bullet);

        this.scene.events.emit('enemyFire', newBullets);
    }
}
