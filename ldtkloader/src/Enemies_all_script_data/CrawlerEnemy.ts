import Phaser from 'phaser';
import { Enemy } from './Enemy';

type CrawlState = 'floor' | 'rightWall' | 'ceiling' | 'leftWall';

/**
 * 地形に沿って這い回る敵 (LDtk名: CrawlerEnemy)
 * 
 * 動き: 重力の影響を受けず、隣接するブロックの側面に張り付いて反時計回りに進む。
 *       (シンプルな処理として、四角い足場を想定)
 * 
 * LDtkフィールド:
 *   hp: 体力 (default 1)
 *   speed: 這い回る速度 (default 50)
 */
export class CrawlerEnemy extends Enemy {
    private crawlSpeed: number;
    private crawlState: CrawlState = 'floor';
    private isCornering: boolean = false; // 角を曲がっている最中の誤判定を防ぐフラグ

    constructor(
        scene: Phaser.Scene, x: number, y: number,
        hp: number = 1, speed: number = 50
    ) {
        super(scene, x, y, 0, 0, hp);
        this.crawlSpeed = speed;

        this.setGravityY(0);
        (this.body as Phaser.Physics.Arcade.Body).allowGravity = false;
        this.setTint(0xff66cc);
        this.body?.setSize(14, 14);
    }

    override update(time: number, delta: number) {
        if (this.getIsDead()) return;

        const blocked = this.body?.blocked;
        if (!blocked) return;

        switch (this.crawlState) {
            case 'floor':
                this.setVelocity(this.crawlSpeed, 20); // 常に下に押し付ける
                this.setAngle(0);
                if (blocked.down) this.isCornering = false; // 接地したらフラグ解除

                if (blocked.right) {
                    this.crawlState = 'rightWall';
                    this.isCornering = true;
                } else if (!blocked.down && !this.isCornering) {
                    this.crawlState = 'leftWall'; // 引力が働く方向を右回りに追跡
                    this.isCornering = true;
                }
                break;
            case 'rightWall':
                this.setVelocity(20, -this.crawlSpeed); // 常に右に押し付ける
                this.setAngle(-90);
                if (blocked.right) this.isCornering = false;

                if (blocked.up) {
                    this.crawlState = 'ceiling';
                    this.isCornering = true;
                } else if (!blocked.right && !this.isCornering) {
                    this.crawlState = 'floor';
                    this.isCornering = true;
                }
                break;
            case 'ceiling':
                this.setVelocity(-this.crawlSpeed, -20); // 常に上に押し付ける
                this.setAngle(180);
                if (blocked.up) this.isCornering = false;

                if (blocked.left) {
                    this.crawlState = 'leftWall';
                    this.isCornering = true;
                } else if (!blocked.up && !this.isCornering) {
                    this.crawlState = 'rightWall';
                    this.isCornering = true;
                }
                break;
            case 'leftWall':
                this.setVelocity(-20, this.crawlSpeed); // 常に左に押し付ける
                this.setAngle(90);
                if (blocked.left) this.isCornering = false;

                if (blocked.down) {
                    this.crawlState = 'floor';
                    this.isCornering = true;
                } else if (!blocked.left && !this.isCornering) {
                    this.crawlState = 'ceiling';
                    this.isCornering = true;
                }
                break;
        }
    }
}
