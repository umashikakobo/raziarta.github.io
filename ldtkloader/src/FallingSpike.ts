import Phaser from 'phaser';



export class FallingSpike extends Phaser.Physics.Arcade.Sprite {
    private originalX: number;
    private originalY: number;
    private isFalling: boolean = false;
    private hasReset: boolean = true;
    
    private rangeX: number;
    private rangeY: number;

    constructor(scene: Phaser.Scene, x: number, y: number, width: number, height: number, rangeX: number = 50, rangeY: number = 400) {
        super(scene, x, y, 'black_box'); // ダミーテクスチャ。後でパース時に上書き
        scene.add.existing(this);
        scene.physics.add.existing(this);

        this.originalX = x;
        this.originalY = y;
        this.rangeX = rangeX;
        this.rangeY = rangeY;

        const body = this.body as Phaser.Physics.Arcade.Body;
        if (body) {
            body.setGravityY(0); // 初期は重力ゼロ
            body.setImmovable(false); // 落下するため
        }
        
        this.setDisplaySize(width, height);
    }

    public updateSpike(playerX: number, playerY: number) {
        if (this.isFalling || !this.hasReset) return;

        // プレイヤーがトゲの感知範囲にいるかチェック
        const xDiff = Math.abs(this.x - playerX);
        const yDiff = playerY - this.y;

        // Y差が0より大きく（トゲより下）、かつ一定距離以内なら落下開始
        if (xDiff < this.rangeX && yDiff > 0 && yDiff < this.rangeY) {
            this.triggerFall();
        }
    }

    private triggerFall() {
        this.isFalling = true;
        this.hasReset = false;

        const body = this.body as Phaser.Physics.Arcade.Body;
        if (body) {
            body.setGravityY(2000); // 強めの重力で落下させる
        }

        // 3秒後に元の位置に戻るタイマー
        this.scene.time.delayedCall(3000, () => {
            this.resetSpike();
        });
    }

    private resetSpike() {
        this.isFalling = false;
        this.hasReset = true;
        this.setPosition(this.originalX, this.originalY);

        const body = this.body as Phaser.Physics.Arcade.Body;
        if (body) {
            body.setGravityY(0);
            body.velocity.set(0, 0);
        }
    }
}
