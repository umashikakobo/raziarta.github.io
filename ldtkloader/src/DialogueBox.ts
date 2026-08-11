import Phaser from 'phaser';

/**
 * 画面下部に表示される会話ウィンドウ。
 * UIScene 上に描画し、セリフを1行ずつ送る。
 */
export class DialogueBox {
    private scene: Phaser.Scene;

    // 描画オブジェクト
    private bg!: Phaser.GameObjects.Graphics;
    private nameText!: Phaser.GameObjects.Text;
    private lineText!: Phaser.GameObjects.Text;
    private promptText!: Phaser.GameObjects.Text;

    // 状態
    private lines: string[] = [];
    private currentIndex: number = 0;
    private speakerName: string = '';
    private visible: boolean = false;
    private onComplete?: () => void;

    constructor(scene: Phaser.Scene) {
        this.scene = scene;

        const w = scene.cameras.main.width;
        const h = scene.cameras.main.height;
        const boxH = 120;
        const boxY = h - boxH - 10;
        const boxX = 10;
        const boxW = w - 20;

        // 半透明の背景
        this.bg = scene.add.graphics();
        this.bg.fillStyle(0x000000, 0.8);
        this.bg.fillRoundedRect(boxX, boxY, boxW, boxH, 8);
        this.bg.lineStyle(2, 0x888888, 1);
        this.bg.strokeRoundedRect(boxX, boxY, boxW, boxH, 8);
        this.bg.setDepth(1000);
        this.bg.setVisible(false);

        // 話者名
        this.nameText = scene.add.text(boxX + 16, boxY + 8, '', {
            fontSize: '16px',
            fontFamily: 'monospace',
            color: '#ffd700',
            stroke: '#000000',
            strokeThickness: 2,
        }).setDepth(1001).setVisible(false);

        // セリフ本文
        this.lineText = scene.add.text(boxX + 16, boxY + 32, '', {
            fontSize: '16px',
            fontFamily: 'monospace',
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 1,
            wordWrap: { width: boxW - 32 },
        }).setDepth(1001).setVisible(false);

        // 送りプロンプト
        this.promptText = scene.add.text(boxX + boxW - 40, boxY + boxH - 24, '▼', {
            fontSize: '16px',
            fontFamily: 'monospace',
            color: '#aaaaaa',
        }).setDepth(1001).setVisible(false);
    }

    /**
     * 会話を開始する
     */
    open(name: string, lines: string[], onComplete?: () => void) {
        if (this.visible) return; // 既に表示中なら無視

        this.speakerName = name;
        this.lines = lines;
        this.currentIndex = 0;
        this.onComplete = onComplete;

        this.bg.setVisible(true);
        this.nameText.setVisible(true);
        this.lineText.setVisible(true);
        this.promptText.setVisible(true);
        this.visible = true;

        this.nameText.setText(name);
        this.lineText.setText(lines[0] ?? '');
        this.updatePrompt();
    }

    /**
     * 次のセリフへ進む。最後ならウィンドウを閉じる。
     * @returns true ならまだ会話中、false なら終了した
     */
    advance(): boolean {
        if (!this.visible) return false;

        this.currentIndex++;
        if (this.currentIndex >= this.lines.length) {
            this.close();
            return false;
        }

        this.lineText.setText(this.lines[this.currentIndex]);
        this.updatePrompt();
        return true;
    }

    /**
     * ウィンドウを閉じる
     */
    close() {
        this.bg.setVisible(false);
        this.nameText.setVisible(false);
        this.lineText.setVisible(false);
        this.promptText.setVisible(false);
        this.visible = false;

        if (this.onComplete) {
            this.onComplete();
            this.onComplete = undefined;
        }
    }

    isOpen(): boolean {
        return this.visible;
    }

    private updatePrompt() {
        if (this.currentIndex >= this.lines.length - 1) {
            this.promptText.setText('×'); // 最後のセリフ
        } else {
            this.promptText.setText('▼');
        }
    }
}
