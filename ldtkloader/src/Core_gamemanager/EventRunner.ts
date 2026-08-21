import Phaser from 'phaser';
import { EventCommand, EventScript, canFireEvent, getEventScript } from './EventRegistry';
import { GameFlags } from './GameFlags';

// ===================================================================
// イベント実行エンジン (EventRunner)
// ===================================================================
// EventRegistryに登録された台本（コマンド配列）を
// 上から順番に1つずつ実行していくシンプルなランナー。
//
// dialogue コマンドの場合は UIScene のダイアログを表示し、
// ダイアログが閉じられるまで次のコマンドに進まない。
// ===================================================================

export class EventRunner {
    private scene: Phaser.Scene;
    private commands: EventCommand[] = [];
    private index: number = 0;
    private isRunning: boolean = false;
    private onComplete?: () => void;

    constructor(scene: Phaser.Scene) {
        this.scene = scene;
    }

    /**
     * 指定されたイベントIDの台本を実行開始する。
     * @returns true なら台本が見つかり実行を開始した、false なら実行不可
     */
    public run(eventId: string, onComplete?: () => void): boolean {
        if (this.isRunning) return false;

        // requiredFlag チェック
        if (!canFireEvent(eventId)) {
            console.log(`[EventRunner] Event "${eventId}" cannot fire (flag requirement not met).`);
            return false;
        }

        const script = getEventScript(eventId);
        if (!script) {
            console.warn(`[EventRunner] Event "${eventId}" not found in EventRegistry.`);
            return false;
        }

        console.log(`[EventRunner] Starting: "${eventId}" // ${script.comment}`);

        this.commands = [...script.commands];
        this.index = 0;
        this.isRunning = true;
        this.onComplete = () => {
            // completionFlag があれば自動でフラグを立てる
            if (script.completionFlag) {
                GameFlags.set(script.completionFlag, true);
            }
            onComplete?.();
        };

        this.executeNext();
        return true;
    }

    /** 現在実行中かどうか */
    public getIsRunning(): boolean {
        return this.isRunning;
    }

    /** 次のコマンドを実行する */
    private executeNext(): void {
        if (this.index >= this.commands.length) {
            // 全コマンド完了
            this.isRunning = false;
            this.onComplete?.();
            return;
        }

        const cmd = this.commands[this.index];
        this.index++;

        switch (cmd.type) {
            case 'dialogue':
                this.handleDialogue(cmd.name, cmd.text);
                break;
            case 'set_flag':
                GameFlags.set(cmd.flag, cmd.value);
                this.executeNext(); // 即座に次へ
                break;
            case 'show_image':
                // 将来実装: テクスチャを画面中央に表示 → Zキーで閉じたら次へ
                console.log(`[EventRunner] show_image "${cmd.texture}" (WIP)`);
                this.executeNext();
                break;
            case 'camera_shake':
                this.scene.cameras.main.shake(cmd.duration, cmd.intensity / 1000);
                this.executeNext();
                break;
            case 'wait':
                this.scene.time.delayedCall(cmd.ms, () => this.executeNext());
                break;
            default:
                console.warn('[EventRunner] Unknown command type:', (cmd as any).type);
                this.executeNext();
        }
    }

    /** ダイアログ表示 → ダイアログが閉じたら次のコマンドへ進む */
    private handleDialogue(name: string, text: string): void {
        const ui = this.scene.scene.get('UIScene') as any;
        if (ui && ui.showDialogue) {
            ui.showDialogue(name, [text], true, () => {
                // ダイアログが完全に閉じた後に次のコマンドへ
                this.executeNext();
            });
        } else {
            console.warn('[EventRunner] UIScene not available, skipping dialogue.');
            this.executeNext();
        }
    }
}
