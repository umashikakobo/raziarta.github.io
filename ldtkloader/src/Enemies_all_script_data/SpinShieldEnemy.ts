import Phaser from 'phaser';
import { Enemy } from './Enemy';

/**
 * 回転しながら盾を持つ敵 (LDtk名: SpinShieldEnemy)
 * 
 * 動き: その場で回転する盾が周囲を覆っている。
 *       盾が回転しているため、弾が通る「隙間」が周期的に生まれる。
 *       盾の角度がプレイヤー側を向いていないタイミングでのみ
 *       ダメージが通る。あまり動かずその場に留まる。
 * 
 * LDtkフィールド:
 *   hp: 体力 (default 3)
 *   spinSpeed: 回転速度 rad/sec (default 2)
 */
export class SpinShieldEnemy extends Enemy {
    private shieldAngle: number = 0;
    private spinSpeed: number;
    private shieldGfx?: Phaser.GameObjects.Rectangle;

    /** 盾が弾をブロックする角度範囲（±この値） */
    private shieldArc: number = Math.PI * 0.4; // ±72度 = 144度分カバー

    constructor(
        scene: Phaser.Scene, x: number, y: number,
        hp: number = 3, spinSpeed: number = 2
    ) {
        super(scene, x, y, 0, 0, hp); // 巡回なし・移動なし
        this.spinSpeed = spinSpeed;

        this.setGravityY(800);
        this.setTint(0xcc3366);

        // 盾の視覚表現
        this.shieldGfx = scene.add.rectangle(x, y, 6, 20, 0xdddddd, 0.9);
    }

    override update(time: number, delta: number) {
        if (this.getIsDead()) {
            this.shieldGfx?.destroy();
            return;
        }

        // 動かない（重力は効く）
        this.setVelocityX(0);

        // 盾を回転
        this.shieldAngle += this.spinSpeed * (delta / 1000);
        if (this.shieldAngle > Math.PI * 2) this.shieldAngle -= Math.PI * 2;

        // 盾の位置と角度を更新
        if (this.shieldGfx) {
            const radius = 14;
            this.shieldGfx.setPosition(
                this.x + Math.cos(this.shieldAngle) * radius,
                this.y + Math.sin(this.shieldAngle) * radius
            );
            this.shieldGfx.setRotation(this.shieldAngle);
        }
    }

    /**
     * 弾の座標から角度を計算し、盾のカバー範囲内ならブロック
     */
    takeDamageFromDirection(amount: number, bulletX: number, bulletY: number): boolean {
        if (this.getIsDead()) return false;

        // 弾の方向の角度
        const bulletAngle = Math.atan2(bulletY - this.y, bulletX - this.x);

        // 盾の角度との差
        let diff = bulletAngle - this.shieldAngle;
        // -PI ~ PI に正規化
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;

        if (Math.abs(diff) < this.shieldArc) {
            // 盾が弾を覆っている → ブロック
            this.shieldGfx?.setFillStyle(0xffffff, 1);
            this.scene.time.delayedCall(80, () => {
                this.shieldGfx?.setFillStyle(0xdddddd, 0.9);
            });
            return false;
        }

        // 盾の隙間 → ダメージ
        this.takeDamage(amount);
        return true;
    }

    destroy(fromScene?: boolean) {
        this.shieldGfx?.destroy();
        super.destroy(fromScene);
    }
}
