export const PlayerParams = {
    // ── 閾値・猶予フレーム ──
    JumpBufferTime: 0.05,
    CoyoteTime: 0.15,

    // ── 重力 / 落下 ──
    Gravity: 500,
    MaxFallSpeed: 450,

    // ── 通常移動 ──
    NormalThrust: 350,
    MaxSpeedNormal: 95,
    FrictionDec: 40, 
    DragRate: 0,
    CounterMult: 2.0,

    // ── ジャンプ ──
    JumpTargetSpeed: 195,
    JumpLerp: 0.17,
    JumpFrames: 12,

    // ── ブースト ──
    BoostAccelTime: 1.0,
    BoostThrust: 1000,
    MaxSpeedBoost: 145,
    MaxSpeedGroundBoost: 154,

    // ── 空中リフト ──
    LiftThrust: 370,
    LiftRecoveryMax: 2.5,
    RecoveryScale: 0.05,

    // ── エネルギー ──
    EnMax: 100,
    EnDrainRate: 25,
    EnRegenRate: 20,
    EnGroundRegenMult: 2,

    // ── 攻撃 ──
    BulletSpeed: 300,
    SubBulletSpeed: 200,

    // ── 胴体（doutai）回転 ──
    DoutaiRotLerp: 10,
} as const;
