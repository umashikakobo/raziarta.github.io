// ===================================================================
// 装備品レジストリ (EquipmentRegistry)
// ===================================================================
//
// 【概要】
// プレイヤーの能力を変化させる装備品（アイテム）の定義ファイル。
// LDtkのItemBoxエンティティの dropItem フィールドに装備品IDを書くだけで
// その装備品がドロップするようになる。
//
// 【使い方】
// 1. ここに装備品IDとデータを追加する
// 2. LDtkのItemBoxの dropItem に 'equip_heavy_boots' 等のIDを書く
// 3. プレイヤーが拾うとインベントリに入る
// 4. チェックポイントのメニューで装備を切り替えられる
//
// 【StatModifier について】
// PlayerParams の各値に対する「加算値」を指定する。
// 例: jumpPower: 50 → JumpTargetSpeed が +50 される
//     gravity: 100  → Gravity が +100 される（重くなる）
//     bulletSpeed: -50 → BulletSpeed が -50 される（遅い弾）
// 指定しなかったパラメータは変化しない。
//
// ===================================================================

/** 装備品がPlayerParamsに与える変化量 */
export interface StatModifier {
    gravity?: number;        // 重力への加算 (正=重い, 負=軽い)
    maxFallSpeed?: number;   // 最大落下速度への加算
    moveSpeed?: number;      // 通常移動速度への加算
    jumpPower?: number;      // ジャンプ力への加算
    boostThrust?: number;    // ブースト推力への加算
    bulletSpeed?: number;    // メイン弾速への加算
    subBulletSpeed?: number; // サブ弾速への加算
    enMax?: number;          // EN最大値への加算
    enDrainRate?: number;    // EN消費率への加算
    enRegenRate?: number;    // EN回復率への加算
}

/** 装備品のスロット種別 */
export type EquipSlot = 'weapon' | 'armor' | 'accessory';

/** 装備品1つ分の定義 */
export interface EquipmentDef {
    /** 人間が読むためのコメント。ゲーム内では使用しない */
    comment: string;
    /** ゲーム内の表示名 */
    displayName: string;
    /** 装備スロット */
    slot: EquipSlot;
    /** ステータス変化量 */
    modifiers: StatModifier;
}

// ===================================================================
// ★ ここに装備品を追加していく ★
// ===================================================================

export const EquipmentRegistry: Record<string, EquipmentDef> = {

    // ---------- 武器 (weapon) ----------

    'equip_rapid_shot': {
        comment: '連射型の軽量銃。弾速が上がるがEN消費も増える',
        displayName: 'ラピッドショット',
        slot: 'weapon',
        modifiers: {
            bulletSpeed: 100,
            enDrainRate: 5,
        },
    },

    'equip_heavy_cannon': {
        comment: '重量砲。弾速は遅いが威力を上げる想定（将来のダメージ倍率用）',
        displayName: 'ヘビーキャノン',
        slot: 'weapon',
        modifiers: {
            bulletSpeed: -80,
            subBulletSpeed: 50,
        },
    },

    // ---------- 防具 (armor) ----------

    'equip_heavy_boots': {
        comment: '重いブーツ。重力が増すが移動速度も上がる',
        displayName: 'ヘビーブーツ',
        slot: 'armor',
        modifiers: {
            gravity: 150,
            moveSpeed: 20,
            jumpPower: -30,
        },
    },

    'equip_light_armor': {
        comment: '軽量アーマー。ジャンプ力が上がるが落下も速くなる',
        displayName: 'ライトアーマー',
        slot: 'armor',
        modifiers: {
            gravity: -80,
            jumpPower: 40,
            maxFallSpeed: -50,
        },
    },

    // ---------- アクセサリ (accessory) ----------

    'equip_energy_cell': {
        comment: 'EN容量を大幅に増やすバッテリーパック',
        displayName: 'エナジーセル',
        slot: 'accessory',
        modifiers: {
            enMax: 30,
            enRegenRate: 5,
        },
    },

    'equip_booster_chip': {
        comment: 'ブースト性能を強化するチップ',
        displayName: 'ブースターチップ',
        slot: 'accessory',
        modifiers: {
            boostThrust: 200,
            enDrainRate: 8,
        },
    },
};

// ===================================================================
// ユーティリティ
// ===================================================================

/** IDから装備品定義を安全に取得する */
export function getEquipmentDef(equipId: string): EquipmentDef | undefined {
    return EquipmentRegistry[equipId];
}

/** 装備品IDかどうかを判定する（'equip_' で始まるか + レジストリに存在するか） */
export function isEquipmentItem(itemId: string): boolean {
    return itemId.startsWith('equip_') && itemId in EquipmentRegistry;
}
