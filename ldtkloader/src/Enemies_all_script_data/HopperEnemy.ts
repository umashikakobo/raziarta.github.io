import Phaser from 'phaser';
import { Enemy } from './Enemy';

/**
 * ジャンプを繰り返すバッタ型の敵 (LDtk名: HopperEnemy)
 * 
 * 動き: その場で一定間隔で放物線のジャンプをする。
 * プレイヤーは一番高い位置にあるこの敵を踏み台にして、
 * 届かない高所へ行くパズルに使える。
 * 
 * LDtkフィールド:
 *   hp: 体力 (default 1)
 *   jumpPower: ジャンプ力 (default 400)
 *   jumpInterval: ジャンプ間隔ms (default 1500)
 */
export class HopperEnemy extends Enemy {
    private jumpPower: number;
    private jumpIntervalMs: number;
    private jumpTimer: number = 0;

    constructor(
        scene: Phaser.Scene, x: number, y: number,
        hp: number = 1, jumpPower: number = 900, jumpIntervalMs: number = 1500
    ) {
        super(scene, x, y, 0, 0, hp); // 横Patrolはしない
        this.jumpPower = jumpPower;
        this.jumpIntervalMs = jumpIntervalMs;

        // 見た目: 緑系
        this.setTexture('black_box'); // 仮のテクスチャをセットしないと高さ0になり物理が狂う
        this.setDisplaySize(16, 16);
        this.body?.setSize(16, 16);
        this.setTint(0x44ee44);

        // 重力強めでストンと落ちるように
        this.setGravityY(1000);

        // immovableを解除して重力・blocked判定を有効にする
        this.setImmovable(false);

        // 基底クラス(Enemy)で最大Y速度が600に制限されているため上限を開放
        this.setMaxVelocity(300, Math.max(1000, this.jumpPower));
    }

    override update(time: number, delta: number) {
        if (this.getIsDead()) return;

        // X移動はなし
        this.setVelocityX(0);

        // 重力がない？強制ON
        if (this.body && this.body instanceof Phaser.Physics.Arcade.Body) {
            this.body.allowGravity = true;
            this.body.moves = true;
        }

        // デバッグ: 状態を確認
        const blocked = this.body?.blocked;
        if (time % 1000 < 20) { // 約1秒ごとにログ
            console.log(`[HopperEnemy] pos=(${this.x.toFixed(0)}, ${this.y.toFixed(0)}), enabled=${this.body?.enable}, customGravity=${(this.body as any)?.gravity?.y}, blocked=${JSON.stringify(blocked)}, velY=${this.body?.velocity.y.toFixed(0)}`);
        }

        // 接地している時だけタイマーを進める
        if (this.body?.blocked.down) {
            this.jumpTimer += delta;

            // ジャンプ前にプルプル震える演出 (オプショナル)
            if (this.jumpTimer > this.jumpIntervalMs - 200) {
                this.y += (Math.random() - 0.5) * 2;
            }

            if (this.jumpTimer >= this.jumpIntervalMs) {
                this.jumpTimer = 0;
                this.setVelocityY(-this.jumpPower);
                console.log(`[HopperEnemy] JUMP! power=${-this.jumpPower}`);
            }
        }
    }
}
