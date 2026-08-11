import Phaser from 'phaser';
import { Player } from './Player';
import { PlayerParams } from './PlayerParams';
import { DialogueBox } from './DialogueBox';

export class UIScene extends Phaser.Scene {
    private player?: Player;
    public dialogueBox!: DialogueBox;
    public isPlayerFrozen: boolean = false;

    private hpText!: Phaser.GameObjects.Text;
    private rampFill!: Phaser.GameObjects.Graphics;
    private rampText!: Phaser.GameObjects.Text;

    private enGfx!: Phaser.GameObjects.Graphics;
    private enText!: Phaser.GameObjects.Text;
    private warnText!: Phaser.GameObjects.Text;

    private crosshair!: Phaser.GameObjects.Graphics;

    constructor() {
        super({ key: 'UIScene', active: false });
    }

    create() {
        // HP / AMMO テキスト (左上)
        this.hpText = this.add.text(80, 20, "", {
            fontSize: '20px',
            fontFamily: 'monospace',
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 3,
        });

        // RAMP テキスト
        this.rampText = this.add.text(80, 45, "RAMP 0 %", {
            fontSize: '14px',
            fontFamily: 'monospace',
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 2,
        });

        // RAMP ゲージは Graphics で描画
        this.rampFill = this.add.graphics();

        // EN ゲージは Graphics で描画
        this.enGfx = this.add.graphics();

        // EN ラベル
        this.enText = this.add.text(22, 390, "EN", {
            fontSize: '28px',
            fontFamily: 'monospace',
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 3,
        });

        // WARN テキスト
        this.warnText = this.add.text(18, 420, "WARN", {
            fontSize: '20px',
            fontFamily: 'monospace',
            color: '#ff4444',
            stroke: '#000000',
            strokeThickness: 2,
        }).setVisible(false);

        // クロスヘア描画用グラフィックス
        this.crosshair = this.add.graphics();

        // ダイアログボックスの生成
        this.dialogueBox = new DialogueBox(this);
    }

    public showDialogue(name: string, lines: string[], freezePlayer: boolean = true, onComplete?: () => void) {
        this.isPlayerFrozen = freezePlayer;
        this.dialogueBox.open(name, lines, () => {
            this.isPlayerFrozen = false;
            if (onComplete) onComplete();
        });
    }

    public shouldFreezePlayer(): boolean {
        return this.isDialogueOpen() && this.isPlayerFrozen;
    }

    public isDialogueOpen(): boolean {
        return this.dialogueBox?.isOpen() ?? false;
    }

    update() {
        if (!this.player) {
            const mainScene = this.scene.get('MainScene') as any;
            if (mainScene && mainScene.player) {
                this.player = mainScene.player;
            } else {
                return;
            }
        }

        const hp = this.player.getHp();
        const en = this.player.getEn();
        const ammo = this.player.getAmmo();
        const boostRamp = this.player.getBoostRamp();
        const isCharging = this.player.getCharging();

        // 1. HP / AMMO テキスト
        this.hpText.setText(`HP: ${hp}/5   AMMO: ${ammo}`);

        // 2. RAMP バー
        this.rampText.setText(`RAMP  ${Math.round(boostRamp * 100)} %`);
        
        this.rampFill.clear();
        const bx = 80, by = 65;
        const bw = 240, bh = 12;
        // 背景
        this.rampFill.fillStyle(0x0a0a0a, 1);
        this.rampFill.fillRect(bx - 2, by - 2, bw + 4, bh + 4);
        this.rampFill.fillStyle(0x1a1008, 1);
        this.rampFill.fillRect(bx, by, bw, bh);
        // ゲージ本体 (オレンジ)
        this.rampFill.fillStyle(0xd05810, 1);
        this.rampFill.fillRect(bx, by, bw * boostRamp, bh);

        // 3. EN ゲージ (画面左・縦)
        this.enGfx.clear();
        const gW = 48;
        const gH = 270;
        const gX = 15;
        const gY = 540 / 2 - gH / 2;
        const enFrac = Phaser.Math.Clamp(en / PlayerParams.EnMax, 0, 1);

        // 背景
        this.enGfx.fillStyle(0x0a0a0a, 0.85);
        this.enGfx.fillRect(gX, gY, gW, gH);
        // 枠線
        this.enGfx.lineStyle(2, 0x333333, 1);
        this.enGfx.strokeRect(gX, gY, gW, gH);

        // ゲージ本体 (下から上に伸びる)
        const isLowEn = en < PlayerParams.EnMax * 0.25;
        let enColor: number;
        if (isCharging) {
            enColor = 0xd02828; // 赤
            this.warnText.setVisible(true);
        } else if (isLowEn) {
            enColor = 0xd07818; // オレンジ
            this.warnText.setVisible(false);
        } else {
            enColor = 0x28c058; // 緑
            this.warnText.setVisible(false);
        }

        const barInnerH = gH - 4;
        const barFillH = barInnerH * enFrac;
        this.enGfx.fillStyle(enColor, 1);
        this.enGfx.fillRect(gX + 2, gY + 2 + (barInnerH - barFillH), gW - 4, barFillH);

        // 4. クロスヘアの描画
        const aimPos = this.player.getAimPos(); // ワールド座標
        const mainCamera = this.scene.get('MainScene').cameras.main;
        
        // ワールド座標を画面座標に変換
        const screenX = aimPos.x - mainCamera.scrollX;
        const screenY = aimPos.y - mainCamera.scrollY;

        this.crosshair.clear();
        
        // 十字線
        this.crosshair.lineStyle(2, 0xffffff, 0.9);
        // 横線
        this.crosshair.lineBetween(screenX - 12, screenY, screenX - 4, screenY);
        this.crosshair.lineBetween(screenX + 4, screenY, screenX + 12, screenY);
        // 縦線
        this.crosshair.lineBetween(screenX, screenY - 12, screenX, screenY - 4);
        this.crosshair.lineBetween(screenX, screenY + 4, screenX, screenY + 12);

        // 中心点
        this.crosshair.fillStyle(0xffffff, 1);
        this.crosshair.fillRect(screenX - 1, screenY - 1, 3, 3);

        // AMMO ドット (クロスヘアの左に)
        const mainBulletColor = ammo > 0 ? 0x26d9d9 : 0x4c4c4c;
        this.crosshair.fillStyle(mainBulletColor, 1);
        this.crosshair.fillCircle(screenX - 24, screenY, 5);
    }
}
