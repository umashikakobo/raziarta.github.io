import Phaser from 'phaser';

/**
 * プレイヤーが踏み込むと自動的に発動するイベントゾーン。
 * LDtkで設定したテキストを表示する等の処理に使う。
 */
export class EventTrigger extends Phaser.Physics.Arcade.Sprite {
    public eventId: string;
    public lines: string[];
    public isOneShot: boolean;
    public hasTriggered: boolean = false;
    
    public isPlayerInside: boolean = false;
    public wasPlayerInside: boolean = false;
    public freezePlayer: boolean;
    public noComment: boolean;

    constructor(
        scene: Phaser.Scene,
        x: number,
        y: number,
        width: number,
        height: number,
        eventId: string,
        lines: string[],
        oneShot: boolean = true,
        freezePlayer: boolean = true,
        noComment: boolean = false
    ) {
        // 見えない矩形として作成
        super(scene, x + width / 2, y + height / 2, 'black_box');
        
        scene.add.existing(this);
        scene.physics.add.existing(this);

        this.eventId = eventId;
        this.lines = lines;
        this.isOneShot = oneShot;
        this.freezePlayer = freezePlayer;
        this.noComment = noComment;

        // 不可視化、物理判定のみ残す
        this.setVisible(false);
        this.setDisplaySize(width, height);
        this.body?.setSize(width, height);
        
        this.setImmovable(true);
        (this.body as Phaser.Physics.Arcade.Body).allowGravity = false;
    }
}
