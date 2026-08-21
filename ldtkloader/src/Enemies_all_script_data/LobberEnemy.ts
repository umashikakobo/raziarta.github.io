import Phaser from 'phaser';
import { Enemy } from './Enemy';
import { EnemyBullet } from './EnemyBullet';

/**
 * 重力落下弾を投げながらゆっくり移動する敵 (LDtk名: LobberEnemy)
 * 
 * 動き: 左右にゆっくり巡回しながら、一定間隔で
 *       重力の影響を受ける弾（放物線）を上方に投げる。
 * 
 * LDtkフィールド:
 *   hp: 体力 (default 2)
 *   speed: 移動速度 (default 30)
 *   throwInterval: 投げ間隔ms (default 2000)
 */
export class LobberEnemy extends Enemy {
    private throwTimer: number = 0;
    private throwIntervalMs: number;

    constructor(
        scene: Phaser.Scene, x: number, y: number,
        patrolRange: number = 60, speed: number = 30,
        hp: number = 2, throwIntervalMs: number = 2000
    ) {
        super(scene, x, y, patrolRange, speed, hp);
        this.throwIntervalMs = throwIntervalMs;

        // 見た目: 茶色系
        this.setTint(0x885522);
    }

    override update(time: number, delta: number) {
        super.update(time, delta);
        if (this.getIsDead()) return;

        this.throwTimer += delta;
        if (this.throwTimer >= this.throwIntervalMs) {
            this.throwTimer = 0;
            this.throwBomb();
        }
    }

    private throwBomb() {
        // 重力付きの弾を斜め上に投げる
        const bomb = new EnemyBullet(this.scene, this.x, this.y - 8, 0, 0);
        bomb.setDisplaySize(10, 10);
        bomb.setTint(0xff6600);

        // 重力を有効にして放物線軌道にする
        const body = bomb.body as Phaser.Physics.Arcade.Body;
        body.allowGravity = true;
        bomb.setGravityY(400);

        // 斜め上に投げる (自分の向きに合わせる)
        const dir = this.flipX ? -1 : 1;
        bomb.setVelocity(dir * 80, -200);

        // シーンの enemyFire イベントで弾をグループに登録
        this.scene.events.emit('enemyFire', [bomb]);
    }
}
