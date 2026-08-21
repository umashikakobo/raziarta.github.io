import Phaser from 'phaser';
import { Enemy } from './Enemy';
import { Player } from '../Player_scripts_scenes_sprites/Player';

/**
 * 突進敵 (LDtk名: ChargerEnemy)
 * 
 * 動き: 普段は動かず待機している。
 *       プレイヤーが自分と同じ高さ(Y)の一直線上に立つと、猛スピードで突進してくる。
 *       壁にぶつかるまで止まらない。
 * 
 * LDtkフィールド:
 *   hp: 体力 (default 2)
 *   chargeSpeed: 突進速度 (default 130)
 */
export class ChargerEnemy extends Enemy {
    private chargeSpeed: number;
    private isCharging: boolean = false;
    private chargeDir: number = 0; // -1: 左, 1: 右

    constructor(
        scene: Phaser.Scene, x: number, y: number,
        hp: number = 2, chargeSpeed: number = 130 // default 130に変更
    ) {
        super(scene, x, y, 0, 0, hp); // 普段はパトロールしない
        this.chargeSpeed = chargeSpeed;

        this.setGravityY(800);

        // 見た目: 赤茶色系
        this.setTint(0xaa3333);
    }

    override update(time: number, delta: number) {
        if (this.getIsDead()) return;

        if (!this.isCharging) {
            this.setVelocityX(0);
            this.checkSight();
        } else {
            // 突進中
            this.setVelocityX(this.chargeDir * this.chargeSpeed);
            this.setFlipX(this.chargeDir < 0);

            // 壁に激突したか、プレイヤーから離れすぎたら止まる
            let stopCharge = false;

            if ((this.chargeDir === -1 && this.body?.blocked.left) ||
                (this.chargeDir === 1 && this.body?.blocked.right)) {
                stopCharge = true;
                // ガシャンという反動
                this.setVelocityY(-150);
                this.scene.cameras.main.shake(100, 0.005);
            }

            const player = (this.scene as any).player;
            if (player && Math.abs(this.x - player.x) > 400) {
                stopCharge = true; // 離れすぎたら諦めて止まる（そして再び近寄ってきたら追うようになる）
            }

            if (stopCharge) {
                this.isCharging = false;
                this.chargeDir = 0;
            }
        }
    }

    private checkSight() {
        const player = (this.scene as any).player as Player | undefined;
        if (!player || player.getHp() <= 0) return;

        // 同じ高さにいるか？ (Y座標の差が小さい)
        if (Math.abs(player.y - this.y) < 32) {
            const dist = Math.abs(player.x - this.x);
            // ある程度の距離以内かつ、間に壁がない(簡易的)と想定して突進開始
            if (dist < 250) {
                this.isCharging = true;
                this.chargeDir = player.x > this.x ? 1 : -1;

                // 突進前のチャージ演出
                this.setTint(0xff0000);
                this.scene.time.delayedCall(300, () => {
                    if (!this.getIsDead()) this.setTint(0xaa3333);
                });
            }
        }
    }
}
