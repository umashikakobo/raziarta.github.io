import Phaser from 'phaser';

export class MovingPlatform extends Phaser.Physics.Arcade.Sprite {
    private waypoints: Phaser.Math.Vector2[];
    private currentWaypointIndex: number = 0;
    private speed: number = 50;
    private movingForward: boolean = true; // ピンポン移動用

    constructor(scene: Phaser.Scene, x: number, y: number, width: number, height: number, waypoints: Phaser.Math.Vector2[]) {
        // 仮のテクスチャを生成
        if (!scene.textures.exists('moving_platform_tex')) {
            const g = scene.add.graphics();
            g.fillStyle(0x888888);
            g.fillRect(0, 0, 16, 16);
            g.generateTexture('moving_platform_tex', 16, 16);
            g.destroy();
        }

        super(scene, x, y, 'moving_platform_tex');
        scene.add.existing(this);
        scene.physics.add.existing(this);

        this.setDisplaySize(width, height);
        this.body?.setSize(16, 16);

        // 動く床の設定
        this.setImmovable(true);
        (this.body as Phaser.Physics.Arcade.Body).allowGravity = false;

        // 初期位置もウェイポイントに含める
        this.waypoints = [new Phaser.Math.Vector2(x, y), ...waypoints];
        this.currentWaypointIndex = 1; // 最初の目的地

        this.setTargetVelocity();
    }

    private setTargetVelocity() {
        if (this.waypoints.length < 2) return;

        const dest = this.waypoints[this.currentWaypointIndex];
        const dist = Phaser.Math.Distance.Between(this.x, this.y, dest.x, dest.y);
        
        // すでに目的地に近い場合は次の目的地へ
        if (dist < 2) {
            this.advanceWaypoint();
            return;
        }

        // ターゲットに向かって速度を設定
        const dx = dest.x - this.x;
        const dy = dest.y - this.y;
        const angle = Math.atan2(dy, dx);
        
        this.setVelocity(Math.cos(angle) * this.speed, Math.sin(angle) * this.speed);
    }

    private advanceWaypoint() {
        if (this.movingForward) {
            this.currentWaypointIndex++;
            if (this.currentWaypointIndex >= this.waypoints.length) {
                this.currentWaypointIndex = this.waypoints.length - 2;
                this.movingForward = false;
            }
        } else {
            this.currentWaypointIndex--;
            if (this.currentWaypointIndex < 0) {
                this.currentWaypointIndex = 1;
                this.movingForward = true;
            }
        }
        this.setTargetVelocity();
    }

    update(_time: number, _delta: number) {
        if (this.waypoints.length < 2) return;

        const dest = this.waypoints[this.currentWaypointIndex];
        const dist = Phaser.Math.Distance.Between(this.x, this.y, dest.x, dest.y);
        
        // 目的地に近づいたら次のウェイポイントへ
        if (dist < 2 || dist > 1000) { // 1000はフェイルセーフ
            this.advanceWaypoint();
        }
    }
}
