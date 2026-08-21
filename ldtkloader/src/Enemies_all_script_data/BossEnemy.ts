import Phaser from 'phaser';
import { PlayerParams } from '../Player_scripts_scenes_sprites/PlayerParams';
import { Player } from '../Player_scripts_scenes_sprites/Player';
import { Enemy } from './Enemy';

export class BossBullet extends Phaser.Physics.Arcade.Sprite {
    public lifespan: number = 3000;
    public type: 'BEAM' | 'MISSILE' | 'SPREAD' | 'MELEE' = 'SPREAD';
    public target?: Player;
    public owner?: Phaser.GameObjects.Sprite;
    private age: number = 0; // 発射からの経過時間(ms)

    constructor(scene: Phaser.Scene, x: number, y: number, type: 'BEAM' | 'MISSILE' | 'SPREAD' | 'MELEE', color: number) {
        super(scene, x, y, '__WHITE');
        scene.add.existing(this);
        scene.physics.add.existing(this);
        this.type = type;
        this.setTint(color);
        const body = this.body as Phaser.Physics.Arcade.Body;
        body.allowGravity = false;

        switch (type) {
            case 'BEAM': this.setDisplaySize(30, 8); this.lifespan = 4000; break;
            case 'MISSILE': this.setDisplaySize(12, 12); this.lifespan = 1800; break;
            case 'SPREAD': this.setDisplaySize(10, 10); this.lifespan = 3000; break;
            case 'MELEE': this.setDisplaySize(60, 60); this.setAlpha(0.5); this.lifespan = 300; break;
        }
    }

    update(_time: number, delta: number) {
        this.lifespan -= delta;
        this.age += delta;
        if (this.lifespan <= 0) {
            this.destroy();
            return;
        }

        // 0.3秒の演展期間が過ぎてからホーミング開始
        if (this.type === 'MISSILE' && this.age > 300 && this.target && !this.target.isDead) {
            // ホーミング処理
            const dx = this.target.x - this.x;
            const dy = this.target.y - this.y;
            const angle = Math.atan2(dy, dx);

            // 現在の速度ベクトルの角度
            const currentAngle = Math.atan2(this.body!.velocity.y, this.body!.velocity.x);
            // 角度差を徐々に詰める（簡易Lerp）
            let diff = Phaser.Math.Angle.Wrap(angle - currentAngle);
            const turnRate = 0.0015 * delta; // 旋回力（以前の半分に低下）

            diff = Phaser.Math.Clamp(diff, -turnRate, turnRate);

            const newAngle = currentAngle + diff;
            const speed = 153; // 180 * 0.85
            this.setVelocity(Math.cos(newAngle) * speed, Math.sin(newAngle) * speed);
        } else if (this.type === 'MELEE' && this.owner) {
            // オーナーに追従する近接判定
            this.setPosition(this.owner.x, this.owner.y);
            this.setVelocity(0, 0); // 自前で追従するので速度は不要
        }

        if (this.type === 'BEAM') {
            const vAngle = Math.atan2(this.body!.velocity.y, this.body!.velocity.x);
            this.setRotation(vAngle);
        }
    }
}

// プレイヤー同様の物理パラメータ（ボス用に微増）
const BossParams = {
    ...PlayerParams,
    MaxSpeedNormal: PlayerParams.MaxSpeedNormal * 1.08,
    MaxSpeedBoost: PlayerParams.MaxSpeedBoost * 1.08,
    NormalThrust: PlayerParams.NormalThrust * 1.08,
    BoostThrust: PlayerParams.BoostThrust * 1.08,
    EnMax: PlayerParams.EnMax,
    EnRegenRate: PlayerParams.EnRegenRate * 2,
};

type BossState = 'CHASE' | 'ATTACK_BEAM' | 'ATTACK_MISSILE' | 'ATTACK_SPREAD' | 'ATTACK_MELEE';

export class BossEnemy extends Enemy {
    // カスタム物理
    private hs: number = 0;
    private vs: number = 0;
    private collisionLayers: Phaser.Tilemaps.TilemapLayer[] = [];

    // アクション
    private en: number = BossParams.EnMax;
    private wallKickLockTimer: number = 0;
    private jumpBufferTimer: number = 0;
    private lastWallKickSide: 0 | 1 | -1 = 0;

    // AI
    private aiState: BossState = 'CHASE';
    private stateTimer: number = 0;
    private targetPlayer?: Player;
    private playerBullets?: Phaser.Physics.Arcade.Group;
    private circleDir: number = 1;        // 回り込み方向 (+1 or -1)
    private circleSwitchTimer: number = 0; // 切り替えタイマー
    private dodgeCooldown: number = 0;     // 回避クールタイム

    // Virtual Inputs
    private virtualDir: number = 0;
    private virtualWEdge: boolean = false;
    private virtualWHeld: boolean = false;

    // 攻撃関連のグラフィック
    private attackGraphics: Phaser.GameObjects.Graphics;

    public bossId: string;
    public isAwake: boolean = false; // ボス部屋に入るまでは動かない

    constructor(scene: Phaser.Scene, x: number, y: number, maxHp: number = 11, bossId: string = 'boss_1') {
        super(scene, x, y, 0, 0, maxHp); // Patrol range and speed ignored in Boss
        this.bossId = bossId;

        this.setTint(0xff88ff); // ボスらしく目立つ色

        this.setGravityY(0); // カスタム重力を使用
        this.setMaxVelocity(3000, 3000);
        this.setBounce(0, 0);

        this.attackGraphics = scene.add.graphics();
        this.attackGraphics.setDepth(100);
    }

    public setTarget(player: Player) {
        this.targetPlayer = player;
    }

    public setCollisionLayers(layers: Phaser.Tilemaps.TilemapLayer[]) {
        this.collisionLayers = layers;
    }

    public setPlayerBullets(group: Phaser.Physics.Arcade.Group) {
        this.playerBullets = group;
    }

    // 最も近いプレイヤー弾を探して距離と近づいているかを返す
    private nearestBulletDist(): { dist: number; comingToward: boolean } {
        if (!this.playerBullets) return { dist: Infinity, comingToward: false };
        let minDist = Infinity;
        let comingToward = false;
        this.playerBullets.getChildren().forEach((child) => {
            const b = child as Phaser.Physics.Arcade.Sprite;
            if (!b.active || !b.body) return;
            const bx = b.x - this.x;
            const by = b.y - this.y;
            const d = Math.sqrt(bx * bx + by * by);
            if (d < minDist) {
                minDist = d;
                const vx = (b.body as Phaser.Physics.Arcade.Body).velocity.x;
                const vy = (b.body as Phaser.Physics.Arcade.Body).velocity.y;
                // 内積 > 0 → 弾がボス方向に追っている
                comingToward = (vx * (-bx) + vy * (-by)) > 0;
            }
        });
        return { dist: minDist, comingToward };
    }

    private checkGroundSensor(): boolean {
        const body = this.body as Phaser.Physics.Arcade.Body;
        if (!body) return false;
        const arcadeGrounded = body.blocked.down || body.touching.down;
        if (this.collisionLayers.length === 0) return arcadeGrounded;

        const footY = body.bottom + 2;
        const inset = 3;
        const footXs = [body.left + inset, body.right - inset];

        for (const layer of this.collisionLayers) {
            for (const fx of footXs) {
                const tile = layer.getTileAtWorldXY(fx, footY, true);
                if (tile && tile.index !== -1 && tile.collides) return true;
            }
        }
        return arcadeGrounded;
    }

    private checkWallSensor(direction: 1 | -1): boolean {
        const body = this.body as Phaser.Physics.Arcade.Body;
        if (!body) return false;

        const arcadeTouching = direction > 0 ? (body.blocked.right || body.touching.right) : (body.blocked.left || body.touching.left);
        if (this.collisionLayers.length === 0) return arcadeTouching;

        const wallX = direction > 0 ? body.right + 2 : body.left - 2;
        const inset = 3;
        const wallYs = [body.top + inset, body.bottom - inset];

        for (const layer of this.collisionLayers) {
            for (const wy of wallYs) {
                const tile = layer.getTileAtWorldXY(wallX, wy, true);
                if (tile && tile.index !== -1 && tile.collides) return true;
            }
        }
        return arcadeTouching;
    }

    private runAI(dt: number) {
        if (!this.targetPlayer || this.targetPlayer.isDead || !this.isAwake) {
            this.virtualDir = 0;
            this.virtualWEdge = false;
            this.virtualWHeld = false;
            return;
        }

        const dx = this.targetPlayer.x - this.x;
        const dy = this.targetPlayer.y - this.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        this.virtualWEdge = false;
        this.stateTimer -= dt;
        this.circleSwitchTimer -= dt;
        this.dodgeCooldown = Math.max(0, this.dodgeCooldown - dt);

        // ── 1. 弾への反応（ジャンプ回避）──
        const DODGE_RADIUS = 100;
        const { dist: bulletDist, comingToward } = this.nearestBulletDist();
        if (bulletDist < DODGE_RADIUS && comingToward && this.dodgeCooldown <= 0) {
            this.virtualWEdge = true;   // ジャンプ発動
            this.dodgeCooldown = 0.6;   // 0.6秒クール
        }

        if (this.aiState === 'CHASE') {
            const PREFERRED_DIST = 144;
            const FAR_THRESHOLD = PREFERRED_DIST + 60;  // 204px以上なら接近
            const CLOSE_THRESHOLD = PREFERRED_DIST - 50; // 94px以下なら後退

            if (dist < CLOSE_THRESHOLD) {
                // --- 近すぎ: プレイヤーと逆方向へ下がる ---
                this.virtualDir = -Math.sign(dx);
                this.virtualWHeld = false;
            } else if (dist > FAR_THRESHOLD) {
                // --- 遠すぎ: プレイヤー方向へ接近 ---
                this.virtualDir = Math.sign(dx);
                this.virtualWHeld = dy < -40; // 大きく高さが違う時のみブースト
            } else {
                // --- 適正距離: 横に回り込む ---
                if (this.circleSwitchTimer <= 0) {
                    this.circleDir = -this.circleDir;
                    this.circleSwitchTimer = 0.8 + Math.random() * 0.6;
                }
                this.virtualDir = this.circleDir;
                this.virtualWHeld = dy < -20; // プレイヤーより下ならブースト
            }

            // 壁当たり → 壁蹴り
            const touchingWall = (this.virtualDir > 0 && this.checkWallSensor(1)) || (this.virtualDir < 0 && this.checkWallSensor(-1));
            // 地上かつ時々ランダムでジャンプ
            const randomJump = Math.random() < 0.015 && this.checkGroundSensor();
            if (touchingWall || randomJump) {
                this.virtualWEdge = true;
            }

            // 攻撃タイミング
            if (this.stateTimer <= 0) {
                const attacks: BossState[] = ['ATTACK_MELEE', 'ATTACK_BEAM', 'ATTACK_MISSILE', 'ATTACK_SPREAD'];
                if (dist > 300) attacks.shift();
                Phaser.Utils.Array.Shuffle(attacks);
                const atk1 = attacks[0];
                const atk2 = attacks[1];

                this.aiState = atk1;
                this.executeAttack(dt, dx, dy, dist, atk1);

                this.scene.time.delayedCall(300, () => {
                    if (this.getIsDead() || !this.targetPlayer) return;
                    const dx2 = this.targetPlayer.x - this.x;
                    const dy2 = this.targetPlayer.y - this.y;
                    this.executeAttack(dt, dx2, dy2, Math.sqrt(dx2 * dx2 + dy2 * dy2), atk2);
                });

                this.stateTimer = 1.8 + Math.random();
                this.virtualDir = 0;
            }
        } else {
            // 攻撃ステート中: 少し横に動いて待橫
            this.virtualDir = this.circleDir;
            if (this.stateTimer <= 0) {
                this.aiState = 'CHASE';
                this.stateTimer = 1.0;
            }
        }
    }

    public wakeUp() {
        if (!this.isAwake) {
            this.isAwake = true;
            this.aiState = 'CHASE';
            console.log(`Boss ${this.bossId} has awakened!`);
        }
    }

    private executeAttack(_dt: number, dx: number, dy: number, dist: number, attackType: BossState) {
        this.attackGraphics.clear();
        const angle = Math.atan2(dy, dx);

        let bullets: BossBullet[] = [];

        switch (attackType) {
            case 'ATTACK_BEAM':
                // 高速レーザー
                const beam = new BossBullet(this.scene, this.x, this.y, 'BEAM', 0xff0000);
                const beamSpeed = 360;
                beam.setVelocity(Math.cos(angle) * beamSpeed, Math.sin(angle) * beamSpeed);
                bullets.push(beam);
                break;
            case 'ATTACK_MELEE':
                // 近接ヒットボックス
                const melee = new BossBullet(this.scene, this.x, this.y, 'MELEE', 0xffff00);
                melee.owner = this;
                bullets.push(melee);
                // ボス自身が突進する（ホーミングではなく単なる直進）
                const dashSpeed = 400;
                this.hs = Math.cos(angle) * dashSpeed;
                this.vs = Math.sin(angle) * dashSpeed * 0.5;
                break;
            case 'ATTACK_MISSILE':
                // ホーミングミサイル（2発）
                for (let i = -1; i <= 1; i += 2) {
                    const m = new BossBullet(this.scene, this.x, this.y - 20, 'MISSILE', 0x00ff00);
                    m.target = this.targetPlayer;
                    const mAngle = angle + (i * Math.PI / 4); // 斜め上に射出
                    const mSpeed = 130;
                    m.setVelocity(Math.cos(mAngle) * mSpeed, Math.sin(mAngle) * mSpeed);
                    bullets.push(m);
                }
                break;
            case 'ATTACK_SPREAD':
                // 2連射（時間差）
                for (let i = 0; i < 2; i++) {
                    this.scene.time.delayedCall(i * 200, () => {
                        if (this.getIsDead()) return;
                        const s = new BossBullet(this.scene, this.x, this.y, 'SPREAD', 0x0088ff);
                        // 発射する瞬間に再度角度を計算
                        const currentAng = this.targetPlayer ? Math.atan2(this.targetPlayer.y - this.y, this.targetPlayer.x - this.x) : angle;
                        const sSpeed = 175;
                        s.setVelocity(Math.cos(currentAng) * sSpeed, Math.sin(currentAng) * sSpeed);
                        this.scene.events.emit('enemyFire', [s]);
                    });
                }
                break;
        }

        if (bullets.length > 0) {
            this.scene.events.emit('enemyFire', bullets);
        }
    }

    update(time: number, delta: number) {
        if (this.getIsDead()) {
            this.attackGraphics.clear();
            return;
        }

        const DT = delta / 1000;

        // 1. AI行動決定
        this.runAI(DT);

        // 2. EN回復
        this.en = Math.min(this.en + BossParams.EnRegenRate * DT, BossParams.EnMax);

        // 3. 物理判定
        const isGrounded = this.checkGroundSensor();
        const touchingWallLeft = this.checkWallSensor(-1);
        const touchingWallRight = this.checkWallSensor(1);
        const isTouchingWall = touchingWallLeft || touchingWallRight;
        const currentWallSide = touchingWallLeft ? -1 : (touchingWallRight ? 1 : 0);

        if (isGrounded) {
            this.lastWallKickSide = 0;
        }

        if (this.virtualWEdge) {
            this.jumpBufferTimer = PlayerParams.JumpBufferTime;
        } else {
            this.jumpBufferTimer = Math.max(0, this.jumpBufferTimer - DT);
        }

        if (this.wallKickLockTimer > 0) {
            this.wallKickLockTimer = Math.max(0, this.wallKickLockTimer - DT);
            this.virtualDir = 0;
        }

        const sameWallBlocked = (currentWallSide !== 0 && currentWallSide === this.lastWallKickSide);
        const canWallKick = !isGrounded && isTouchingWall && !sameWallBlocked && this.jumpBufferTimer > 0 && this.en >= 5;

        // 壁蹴り (AIは基本的に押し込み・離脱を使い分けないので、標準壁蹴りベースにする)
        if (canWallKick) {
            this.en -= 5;
            const kickDir = touchingWallLeft ? 1 : -1;

            // 垂直に登るか弾き飛ぶか (バーチャルD/Aと接触側の関係からAIが自動で決める)
            const pushingIntoWall = (touchingWallLeft && this.virtualDir < 0) || (touchingWallRight && this.virtualDir > 0);

            if (pushingIntoWall) {
                this.hs = 0;
                this.vs = -BossParams.JumpTargetSpeed * 1.25;
                this.lastWallKickSide = 0;
            } else {
                this.hs = kickDir * BossParams.MaxSpeedBoost * 1.4;
                this.vs = -BossParams.JumpTargetSpeed * 0.9;
                this.lastWallKickSide = -kickDir as 0 | 1 | -1;
            }

            this.jumpBufferTimer = 0;
            this.wallKickLockTimer = 0.25;
        } else if (this.virtualWEdge && isGrounded) { // 通常ジャンプ
            this.vs = -BossParams.JumpTargetSpeed;
        }

        // 4. 水平速度計算 (Boost含む)
        const canBoost = !isGrounded && this.virtualWHeld && this.en > 0;
        const groundBoostMult = (canBoost && isGrounded) ? 1.1 : 1.0;

        if (this.virtualDir !== 0) {
            const against = (this.virtualDir * this.hs < 0);
            const mult = against ? BossParams.CounterMult : 1.0;
            const thrust = (canBoost ? BossParams.BoostThrust * groundBoostMult : BossParams.NormalThrust);
            this.hs += this.virtualDir * thrust * mult * DT;
            this.setFlipX(this.virtualDir < 0); // 敵は逆向き前提？一旦Playerに合わせる
        }

        let currentCap = canBoost ? BossParams.MaxSpeedBoost * groundBoostMult : BossParams.MaxSpeedNormal;
        if (this.wallKickLockTimer > 0) {
            currentCap = BossParams.MaxSpeedBoost * 1.5;
        }
        this.hs = Phaser.Math.Clamp(this.hs, -currentCap, currentCap);

        this.hs *= Math.max(0, 1 - BossParams.DragRate * DT);
        if (isGrounded && this.virtualDir === 0 && !canBoost) {
            const fd = BossParams.FrictionDec * DT;
            if (Math.abs(this.hs) <= fd) this.hs = 0;
            else this.hs -= Math.sign(this.hs) * fd;
        }

        // 5. 垂直速度計算
        if (canBoost && !isGrounded) {
            const rec = Phaser.Math.Clamp(1.0 + Math.max(0, this.vs) * BossParams.RecoveryScale, 1.0, BossParams.LiftRecoveryMax);
            this.vs -= BossParams.LiftThrust * rec * DT;
            this.en -= BossParams.EnDrainRate * DT; // ブースト中はエネルギーを消費
        }

        if (!isGrounded) {
            this.vs = Math.min(this.vs + BossParams.Gravity * DT, BossParams.MaxFallSpeed);
        } else if (this.vs > 0) {
            this.vs = 0;
        }

        // 6. 座標へ反映
        this.setVelocity(this.hs, this.vs);

        // 攻撃グラフィックのアルファを自然に薄める
        if (this.aiState === 'CHASE') {
            this.attackGraphics.alpha = Math.max(0, this.attackGraphics.alpha - 2 * DT);
        } else {
            this.attackGraphics.alpha = 1;
        }
    }
}
