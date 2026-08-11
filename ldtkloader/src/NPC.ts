import Phaser from 'phaser';

/**
 * マップ上のNPC。プレイヤーが近づくとインタラクトアイコンを表示し、
 * キーを押すと会話を開始する。
 */
export class NPC extends Phaser.Physics.Arcade.Sprite {
    public npcName: string;
    public lines: string[];
    public repeatable: boolean;
    public hasTalked: boolean = false;

    private interactIcon?: Phaser.GameObjects.Text;
    private interactRange: number = 40; // ピクセル

    constructor(
        scene: Phaser.Scene,
        x: number,
        y: number,
        name: string,
        lines: string[],
        repeatable: boolean = true,
    ) {
        super(scene, x, y, 'black_box');

        scene.add.existing(this);
        scene.physics.add.existing(this);

        this.npcName = name;
        this.lines = lines;
        this.repeatable = repeatable;

        // NPCは動かない
        this.setImmovable(true);
        (this.body as Phaser.Physics.Arcade.Body).allowGravity = false;

        // 仮の見た目（LDtkタイル画像が上書きされなかった場合）
        this.setDisplaySize(16, 16);
        this.setTint(0x44cc44);

        // インタラクトアイコン（▼マーク）
        this.interactIcon = scene.add.text(x, y - 18, '▼', {
            fontSize: '12px',
            fontFamily: 'monospace',
            color: '#ffff00',
            stroke: '#000000',
            strokeThickness: 2,
        }).setOrigin(0.5).setVisible(false);
    }

    /**
     * プレイヤーとの距離を計算し、範囲内ならアイコンを表示する。
     * @returns true ならインタラクト可能な範囲内
     */
    checkProximity(playerX: number, playerY: number): boolean {
        const dist = Phaser.Math.Distance.Between(this.x, this.y, playerX, playerY);
        const inRange = dist < this.interactRange;

        if (this.interactIcon) {
            this.interactIcon.setPosition(this.x, this.y - 18);
            // 会話済みで繰り返し不可なら非表示
            if (this.hasTalked && !this.repeatable) {
                this.interactIcon.setVisible(false);
            } else {
                this.interactIcon.setVisible(inRange);
            }
        }

        return inRange;
    }

    /**
     * 会話可能かどうか
     */
    canTalk(): boolean {
        if (this.hasTalked && !this.repeatable) return false;
        return true;
    }

    /**
     * 会話した後に呼ぶ
     */
    markTalked() {
        this.hasTalked = true;
    }

    destroy(fromScene?: boolean) {
        this.interactIcon?.destroy();
        super.destroy(fromScene);
    }
}
