import Phaser from 'phaser';
import { Enemy } from './Enemy';

/**
 * 正面に盾を持つ敵 (LDtk名: ShieldEnemy)
 * 
 * 動き: 通常の巡回型と同じだが、進行方向側からの弾を無効化する。
 *       背後からの攻撃のみダメージが通る。
 * 
 * LDtkフィールド:
 *   hp: 体力 (default 2)
 *   speed: 移動速度 (default 40)
 */
export class ShieldEnemy extends Enemy {
    private shieldGfx?: Phaser.GameObjects.Rectangle;

    constructor(
        scene: Phaser.Scene, x: number, y: number,
        patrolRange: number = 80, speed: number = 40, hp: number = 2
    ) {
        super(scene, x, y, patrolRange, speed, hp);
        // 見た目: 青系
        this.setTint(0x3366cc);

        // 盾の視覚表現（小さな長方形を正面に配置）
        this.shieldGfx = scene.add.rectangle(x, y, 4, 16, 0xcccccc, 0.8);
    }

    override update(time: number, delta: number) {
        super.update(time, delta);
        if (this.getIsDead()) {
            this.shieldGfx?.destroy();
            return;
        }

        // 盾の位置を進行方向に合わせる
        if (this.shieldGfx) {
            const dir = this.flipX ? -1 : 1;
            this.shieldGfx.setPosition(this.x + dir * 10, this.y);
        }
    }

    /**
     * ダメージ判定を上書き: 弾の方向をチェックし、
     * 盾側（進行方向側）から来た弾はブロックする。
     * bulletX を渡さなかった場合は通常通りダメージ。
     */
    takeDamageFromDirection(amount: number, bulletX: number): boolean {
        if (this.getIsDead()) return false;

        const dir = this.flipX ? -1 : 1; // 進行方向
        const fromFront = (dir > 0 && bulletX > this.x) || (dir < 0 && bulletX < this.x);

        if (fromFront) {
            // 盾で弾く演出
            this.shieldGfx?.setFillStyle(0xffffff, 1);
            this.scene.time.delayedCall(80, () => {
                this.shieldGfx?.setFillStyle(0xcccccc, 0.8);
            });
            return false; // ダメージ無効
        }

        // 背後からはダメージが通る
        this.takeDamage(amount);
        return true;
    }

    destroy(fromScene?: boolean) {
        this.shieldGfx?.destroy();
        super.destroy(fromScene);
    }
}
