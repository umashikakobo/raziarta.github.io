import { GameFlags } from '../Core_gamemanager/GameFlags';

// ===================================================================
// イベント台本の定義ファイル (EventRegistry)
// ===================================================================
//
// 【使い方】
// 1. ここにイベントIDと台本（コマンド配列）を追加する
// 2. LDtkのEventTriggerエンティティの EventId フィールドに同じIDを書く
// 3. プレイヤーがそのゾーンに踏み込むと、対応する台本が順番に再生される
//
// 【コマンドの種類】
//   dialogue   : テキストを表示する (name: 話者名, text: セリフ)
//   set_flag   : GameFlagsにフラグを立てる (flag: フラグ名, value: 値)
//   show_image : 画像を画面に差し込む (texture: テクスチャキー) ※将来実装
//   camera_shake : カメラを揺らす (intensity: 強さ, duration: ミリ秒) ※将来実装
//   wait       : 一定時間待つ (ms: ミリ秒) ※将来実装
//
// 【RequiredFlag について】
//   台本の先頭にオプションで requiredFlag を指定すると、
//   そのフラグが ON でないとイベントが発動しない
//
// ===================================================================

/** コマンド1つ分の型定義 */
export type EventCommand =
    | { type: 'dialogue'; name: string; text: string }
    | { type: 'set_flag'; flag: string; value: any }
    | { type: 'show_image'; texture: string }
    | { type: 'camera_shake'; intensity: number; duration: number }
    | { type: 'wait'; ms: number };

/** イベント1つ分の台本定義 */
export interface EventScript {
    /** コメント: 人間が読むためのメモ。実行には使われない */
    comment: string;
    /** このイベントを発動するために必要なフラグ (省略可) */
    requiredFlag?: string;
    /** このイベントが発火したあとに立つフラグ (省略可) */
    completionFlag?: string;
    /** コマンドの配列（上から順番に実行される） */
    commands: EventCommand[];
}

// ===================================================================
// ★ ここにゲーム内のイベントを追加していく ★
// ===================================================================

export const EventRegistry: Record<string, EventScript> = {

    // ----- サンプルイベント: 最初の出会い -----
    'ev_001_first_encounter': {
        comment: '最初のエリアで謎の声が語りかけてくるイベント',
        commands: [
            { type: 'dialogue', name: '???', text: 'ここは...どこだ？' },
            { type: 'dialogue', name: '謎の声', text: 'よく来たな、旅人よ。' },
            { type: 'set_flag', flag: 'met_mysterious_voice', value: true },
        ],
    },

    // ----- サンプルイベント: 鍵を入手 -----
    'ev_002_get_key': {
        comment: '隠し部屋で鍵を拾うイベント',
        completionFlag: 'has_dungeon_key',
        commands: [
            { type: 'dialogue', name: 'システム', text: 'ダンジョンの鍵を手に入れた！' },
            { type: 'set_flag', flag: 'has_dungeon_key', value: true },
        ],
    },

    // ----- サンプルイベント: 鍵が必要な扉 -----
    'ev_003_locked_door': {
        comment: 'ダンジョンの鍵がないと開かない扉',
        requiredFlag: 'has_dungeon_key',
        commands: [
            { type: 'dialogue', name: 'システム', text: '鍵を使って扉を開けた。' },
            { type: 'set_flag', flag: 'dungeon_door_opened', value: true },
        ],
    },

    // ----- サンプルイベント: ボス前の警告 -----
    'ev_004_boss_warning': {
        comment: 'ボス部屋手前で緊張感を出す会話',
        commands: [
            { type: 'dialogue', name: '???', text: 'この先には強大な力が待ち受けている...' },
            { type: 'dialogue', name: '???', text: '覚悟はいいか？' },
        ],
    },
};

// ===================================================================
// ユーティリティ: IDに対応する台本を安全に取得する
// ===================================================================
export function getEventScript(eventId: string): EventScript | undefined {
    return EventRegistry[eventId];
}

/**
 * requiredFlag を考慮して、イベントが現在発動可能かチェックする
 */
export function canFireEvent(eventId: string): boolean {
    const script = EventRegistry[eventId];
    if (!script) return false;
    if (script.requiredFlag && !GameFlags.get(script.requiredFlag)) return false;
    return true;
}
