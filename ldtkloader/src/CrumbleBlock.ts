import Phaser from 'phaser';

export class CrumbleBlock extends Phaser.Physics.Arcade.Sprite {
    private crumbleDelayMs: number;
    private accumulatedTime: number = 0;
    private isCrumbling: boolean = false;
    private originalX: number;
    private originalY: number;
    private lastTouchedTime: number = 0;

    constructor(scene: Phaser.Scene, x: number, y: number, width: number, height: number, delaySec: number) {
        super(scene, x, y, 'black_box'); // 一旦ダミーテクスチャ。後でパース時に上書きされる
        scene.add.existing(this);
        scene.physics.add.existing(this);

        this.crumbleDelayMs = delaySec * 1000;
        this.originalX = x;
        this.originalY = y;

        const body = this.body as Phaser.Physics.Arcade.Body;
        if (body) {
            body.setAllowGravity(false);
            body.setImmovable(true);
        }
        
        this.setDisplaySize(width, height);
    }

    // プレイヤーが「乗っている」かどうかをArcadeのtouching.upに頼らず直接判定する。
    // 足元(playerBody.bottom)とブロック天面(blockBody.top)の距離、およびX方向の重なりだけを見るため、
    // 1フレームだけtouchingが抜ける物理ジッターの影響を受けない。
    private checkPlayerOnTop(playerBody: Phaser.Physics.Arcade.Body, blockBody: Phaser.Physics.Arcade.Body): boolean {
        const verticalMargin = 4;   // 足元と天面の許容誤差(px)
        const horizontalInset = 2;  // 端ギリギリの誤検出を避けるための内側マージン(px)

        const horizontalOverlap =
            playerBody.right > blockBody.left + horizontalInset &&
            playerBody.left < blockBody.right - horizontalInset;

        const verticallyClose = Math.abs(playerBody.bottom - blockBody.top) <= verticalMargin;

        return horizontalOverlap && verticallyClose;
    }

    public updateBlock(delta: number, player: Phaser.Physics.Arcade.Sprite) {
        if (this.isCrumbling) return;

        const body = this.body as Phaser.Physics.Arcade.Body;
        const playerBody = player.body as Phaser.Physics.Arcade.Body;
        if (!body || !playerBody) return;

        // プレイヤーが乗っている瞬間を記録（センサー判定に置き換え）
        if (this.checkPlayerOnTop(playerBody, body)) {
            this.lastTouchedTime = this.scene.time.now;
        }

        // 最後に乗ってから一定時間(100ms)以内なら、乗っているとみなしてタイマーを進める（ジッター対策）
        if (this.scene.time.now - this.lastTouchedTime < 100) {
            this.accumulatedTime += delta;
        } else {
            // 完全に離れたらリセット
            this.accumulatedTime = 0;
            this.clearTint();
            this.setAlpha(1.0);
        }

        if (this.accumulatedTime > 0) {
            // 揺れる演出 (色の点滅)
            if (Math.floor(this.scene.time.now / 100) % 2 === 0) {
                this.setTint(0xffaaaa);
            } else {
                this.clearTint();
            }
        }

        if (this.accumulatedTime >= this.crumbleDelayMs) {
            this.crumble();
        }
    }

    private crumble() {
        this.isCrumbling = true;
        this.setVisible(false);
        this.clearTint();

        const body = this.body as Phaser.Physics.Arcade.Body;
        if (body) {
            body.enable = false; // 完全に物理判定をオフにする
        }

        // 3秒後に復活
        this.scene.time.delayedCall(3000, () => {
            this.respawn();
        });
    }

    private respawn() {
        this.isCrumbling = false;
        this.accumulatedTime = 0;
        this.setVisible(true);
        this.setAlpha(1.0);
        this.setPosition(this.originalX, this.originalY);
        
        const body = this.body as Phaser.Physics.Arcade.Body;
        if (body) {
            body.enable = true;
            body.velocity.set(0, 0);
        }
    }
}
