import Phaser from 'phaser';

/**
 * パトロール型の基本敵クラス。
 * 左右に一定範囲を往復し、壁にぶつかると反転する。
 * プレイヤーが上から踏みつけると倒せる。
 * 横から触れるとプレイヤーがダメージを受ける（リスポーン）。
 */
export class Enemy extends Phaser.Physics.Arcade.Sprite {
    private startX: number;
    private patrolRange: number;
    private moveSpeed: number;
    private direction: number = 1; // 1=右, -1=左
    private maxHp: number;
    private currentHp: number;
    private isDead: boolean = false;

    constructor(
        scene: Phaser.Scene,
        x: number,
        y: number,
        patrolRange: number = 100,
        moveSpeed: number = 60,
        maxHp: number = 1
    ) {
        // enemy_idle テクスチャが読み込まれていればそれを使い、なければ黒い四角で代替
        const texKey = scene.textures.exists('enemy_idle') ? 'enemy_idle' : 'black_box';
        super(scene, x, y, texKey);

        scene.add.existing(this);
        scene.physics.add.existing(this);

        this.startX = x;
        this.patrolRange = patrolRange;
        this.moveSpeed = moveSpeed;
        this.maxHp = maxHp;
        this.currentHp = maxHp;

        // 物理設定
        this.setGravityY(800);
        this.setBounce(0, 0);
        this.setCollideWorldBounds(true);
        
        // 当たり判定とスプライトのサイズ調整
        this.setDisplaySize(16, 16);
        this.body?.setSize(16, 16);
        
        this.setMaxVelocity(moveSpeed, 600);
    }

    update(_time: number, _delta: number) {
        if (this.isDead) return;

        // パトロール: 一定範囲を超えたら反転
        const currentX = this.x;
        if (Math.abs(currentX - this.startX) > this.patrolRange) {
            this.direction = currentX > this.startX ? -1 : 1;
        }

        // 壁にぶつかったら反転
        if (this.body?.blocked.left) {
            this.direction = 1;
        } else if (this.body?.blocked.right) {
            this.direction = -1;
        }

        // 移動
        this.setVelocityX(this.direction * this.moveSpeed);
        this.setFlipX(this.direction < 0);

        // テクスチャ切り替え（走り画像があればそちらを使う）
        if (this.scene.textures.exists('enemy_run')) {
            this.setTexture('enemy_run');
        }
    }

    /**
     * 踏みつけなどでダメージを受けた場合
     */
    takeDamage(amount: number) {
        if (this.isDead) return;
        
        this.currentHp -= amount;
        
        // 被ダメ演出（赤く点滅）
        this.setTint(0xff0000);
        this.scene.time.delayedCall(100, () => {
            if (!this.isDead) this.clearTint();
        });

        if (this.currentHp <= 0) {
            this.die();
        }
    }

    private die() {
        this.isDead = true;
        this.setVelocity(0, 0);
        (this.body as Phaser.Physics.Arcade.Body).allowGravity = false;
        this.setAlpha(0.5);
        
        // 少し上にポンと飛ばす演出
        this.setVelocityY(-150);
        
        this.scene.time.delayedCall(500, () => {
            this.destroy();
        });
    }

    getIsDead(): boolean {
        return this.isDead;
    }
}
