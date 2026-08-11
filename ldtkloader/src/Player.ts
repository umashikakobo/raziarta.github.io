import Phaser from 'phaser';
import { PlayerParams } from './PlayerParams';

export class Player extends Phaser.Physics.Arcade.Sprite {
    private keyW!: Phaser.Input.Keyboard.Key;
    private keyA!: Phaser.Input.Keyboard.Key;
    private keyS!: Phaser.Input.Keyboard.Key;
    private keyD!: Phaser.Input.Keyboard.Key;
    private wasWKey: boolean = false;
    private spawnX: number;
    private spawnY: number;

    private hp: number = 5;
    private invincibilityTimer: number = 0;
    public debugMode: boolean = false;
    private inputLocked: boolean = false;

    private en: number = PlayerParams.EnMax;
    private ammo: number = 1;
    private boostRamp: number = 0;
    private charging: boolean = false;
    private aimPos: Phaser.Math.Vector2 = new Phaser.Math.Vector2(0, 0);

    // 足元センサー用：衝突判定対象のタイルマップレイヤー参照
    private collisionLayers: Phaser.Tilemaps.TilemapLayer[] = [];

    // コンベアからの押し出し速度（px/s）。座標を直接書き換えず、速度に足し込むことで
    // 通常のArcade衝突解決を経由させ、端でのめり込み・スタックを防ぐ。
    private conveyorPush: number = 0;

    // Custom Physics properties
    private hs: number = 0;
    private vs: number = 0;
    private jumpFramesCnt: number = 0;
    private boostTimer: number = 0;
    private coyoteTimer: number = 0;
    private jumpBufferTimer: number = 0;
    private wasClicking: boolean = false;
    private wasRightClicking: boolean = false;

    getHp() { return this.hp; }
    getEn() { return this.en; }
    getAmmo() { return this.ammo; }
    getBoostRamp() { return this.boostRamp; }
    getCharging() { return this.charging; }
    getAimPos() { return this.aimPos; }

    constructor(scene: Phaser.Scene, x: number, y: number) {
        super(scene, x, y, 'player', 0);
        
        this.spawnX = x;
        this.spawnY = y;
        
        scene.add.existing(this);
        scene.physics.add.existing(this);

        // WASD キーを登録
        this.keyW = scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.W);
        this.keyA = scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.A);
        this.keyS = scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.S);
        this.keyD = scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.D);

        // 物理エンジンの設定 (手動計算するためデフォルトの機能はオフ)
        this.setGravityY(0); 
        this.setMaxVelocity(3000, 3000);
        this.setCollideWorldBounds(true);
        this.setDragX(0); 
        this.setBounce(0, 0); 

        // プレイヤーの当たり判定サイズを少し小さく調整 (Kenneyキャラ向け)
        this.body?.setSize(14, 20);
        this.body?.setOffset(5, 4); // 24x24の中心よりに当たり判定を寄せる

        // アニメーションの定義 (すでに定義されていなければ作成)
        if (!scene.anims.exists('player_idle')) {
            scene.anims.create({
                key: 'player_idle',
                frames: scene.anims.generateFrameNumbers('player', { start: 0, end: 0 }),
                frameRate: 10,
                repeat: -1
            });
            scene.anims.create({
                key: 'player_run',
                frames: scene.anims.generateFrameNumbers('player', { start: 0, end: 1 }),
                frameRate: 10,
                repeat: -1
            });
            scene.anims.create({
                key: 'player_jump',
                frames: scene.anims.generateFrameNumbers('player', { start: 1, end: 1 }),
                frameRate: 10,
                repeat: -1
            });
        }

        this.anims.play('player_idle');

        // デバッグモードのトグル (キーボードの ^ キー)
        scene.input.keyboard?.on('keydown', (event: KeyboardEvent) => {
            if (event.key === '^') {
                this.debugMode = !this.debugMode;
                console.log("Debug Mode:", this.debugMode);
                const body = this.body as Phaser.Physics.Arcade.Body;
                if (body) {
                    body.allowGravity = !this.debugMode;
                }
                this.setAlpha(this.debugMode ? 0.5 : 1.0);
                this.setTint(this.debugMode ? 0xffff00 : 0xffffff);

                // 物理演算の当たり判定・ベクトルの枠をトグル
                const world = this.scene.physics.world;
                world.drawDebug = this.debugMode;
                if (!this.debugMode && world.debugGraphic) {
                    world.debugGraphic.clear();
                }
            }
        });
    }

    // 足元センサー判定に使うコリジョンレイヤーを外部（main.ts）から設定する
    public setCollisionLayers(layers: Phaser.Tilemaps.TilemapLayer[]) {
        this.collisionLayers = layers;
    }

    // コンベアの上に乗っているフレームに、main.ts側のコライダーコールバックから呼ばれる。
    // 座標を直接動かさず、次フレームの速度計算に反映させる。
    public setConveyorPush(speed: number) {
        this.conveyorPush = speed;
    }

    // 足元センサー：当たり判定の底辺、左右2点のワールド座標に対して直接タイルを問い合わせる。
    // Arcade Physics の body.touching / body.blocked に依存しないため、
    // 1フレームだけ判定が抜ける「物理ジッター」の影響を受けない。
    // ただし地形タイル以外（コンベア・動く床・消える床・アイテム箱など、Arcadeの
    // 物理グループとして実装されているオブジェクト）はタイルクエリでは検知できないため、
    // Arcadeの標準フラグ（blocked.down / touching.down）もOR条件で見る。
    // こちらはタイル境目特有のジッターが起きにくいオブジェクト同士の判定なので問題ない。
    private checkGroundSensor(): boolean {
        const body = this.body as Phaser.Physics.Arcade.Body;
        if (!body) return false;

        const arcadeGrounded = body.blocked.down || body.touching.down;

        if (this.collisionLayers.length === 0) {
            // レイヤー未設定時は従来方式にフォールバック（保険）
            return arcadeGrounded;
        }

        const footY = body.bottom + 2; // 底辺の少し下を狙う
        const inset = 3;               // 端ギリギリだと隣タイルの隙間を拾うのでやや内側に
        const footXs = [body.left + inset, body.right - inset];

        for (const layer of this.collisionLayers) {
            for (const fx of footXs) {
                const tile = layer.getTileAtWorldXY(fx, footY, true);
                if (tile && tile.index !== -1 && tile.collides) {
                    return true;
                }
            }
        }

        return arcadeGrounded;
    }

    public setInputLocked(locked: boolean) {
        this.inputLocked = locked;
        if (locked) {
            this.setVelocityX(0);
            this.keyA.reset();
            this.keyD.reset();
            this.keyW.reset();
            this.keyS.reset();
        }
    }

    update(_time: number, _delta: number) {
        if (this.debugMode) {
            // フリーフライトモード
            this.setVelocity(0, 0);
            this.setAcceleration(0, 0);
            const debugSpeed = 600;
            if (this.keyA.isDown) { this.setVelocityX(-debugSpeed); this.setFlipX(false); }
            if (this.keyD.isDown) { this.setVelocityX(debugSpeed); this.setFlipX(true); }
            if (this.keyW.isDown) this.setVelocityY(-debugSpeed);
            if (this.keyS.isDown) this.setVelocityY(debugSpeed);
            this.anims.play('player_jump', true);
            return;
        }

        const DT = _delta / 1000;
        
        // 無敵時間の更新
        if (this.invincibilityTimer > 0) {
            this.invincibilityTimer -= DT;
            this.setAlpha(this.invincibilityTimer % 0.2 < 0.1 ? 0.5 : 1.0); // 点滅
        } else {
            this.setAlpha(1.0);
        }

        // Phaserの物理ステップ適用結果を同期
        this.hs = this.body?.velocity.x || 0;
        this.vs = this.body?.velocity.y || 0;
        
        const isGrounded = this.checkGroundSensor();

        // 入力 (WASD)
        const dir = this.inputLocked ? 0 : (this.keyD.isDown ? 1 : 0) - (this.keyA.isDown ? 1 : 0);
        const wD = this.inputLocked ? false : this.keyW.isDown;
        const boostHeld = wD;
        const wEdge = wD && !this.wasWKey;
        const boostPressedThisFrame = wEdge;
        const horizontalInputActive = (dir !== 0);

        if (horizontalInputActive) {
            this.setFlipX(dir > 0);
        }

        const wantsGroundBoost = isGrounded && horizontalInputActive && boostHeld && this.en > 0 && !this.charging;
        const isJumpTap = boostPressedThisFrame && !wantsGroundBoost && !horizontalInputActive;

        if (isJumpTap) this.jumpBufferTimer = PlayerParams.JumpBufferTime;
        else this.jumpBufferTimer = Math.max(0, this.jumpBufferTimer - DT);

        if (isGrounded) this.coyoteTimer = PlayerParams.CoyoteTime;
        else this.coyoteTimer = Math.max(0, this.coyoteTimer - DT);

        const jumpRequested = !wantsGroundBoost && this.jumpBufferTimer > 0 && (isGrounded || this.coyoteTimer > 0);
        const jumpEdge = jumpRequested;

        const canBoost = wantsGroundBoost || (!isGrounded && boostHeld && this.en > 0 && !this.charging && !jumpRequested);

        // Boost Ramp Calculation
        this.boostTimer = canBoost ? Math.min(this.boostTimer + DT, PlayerParams.BoostAccelTime) : 0;
        const rampT = canBoost ? this.boostTimer / PlayerParams.BoostAccelTime : 0;
        this.boostRamp = canBoost ? (0.02 + 0.98 * rampT * rampT * rampT) : 0;

        // HS Calculation
        const groundBoostMult = (canBoost && isGrounded) ? 1.1 : 1.0;
        if (dir !== 0) {
            const against = (dir * this.hs < 0);
            const mult = against ? PlayerParams.CounterMult : 1.0;
            const thrust = canBoost ? Math.max(PlayerParams.NormalThrust, PlayerParams.BoostThrust * this.boostRamp * groundBoostMult) : PlayerParams.NormalThrust;
            this.hs += dir * thrust * mult * DT;
        }

        const cap = canBoost ? PlayerParams.MaxSpeedBoost * groundBoostMult : PlayerParams.MaxSpeedNormal;
        this.hs = Phaser.Math.Clamp(this.hs, -cap, cap);

        this.hs *= Math.max(0, 1 - PlayerParams.DragRate * DT);
        if (isGrounded && dir === 0 && !canBoost) {
            const fd = PlayerParams.FrictionDec * DT;
            if (Math.abs(this.hs) <= fd) this.hs = 0;
            else this.hs -= Math.sign(this.hs) * fd;
        }

        // VS Calculation
        if (canBoost && !isGrounded) {
            const rec = Phaser.Math.Clamp(1.0 + Math.max(0, this.vs) * PlayerParams.RecoveryScale, 1.0, PlayerParams.LiftRecoveryMax);
            this.vs -= PlayerParams.LiftThrust * rec * DT;
        }

        if (!isGrounded) {
            this.vs = Math.min(this.vs + PlayerParams.Gravity * DT, PlayerParams.MaxFallSpeed);
        }

        // Jump processing
        if (jumpEdge) {
            this.jumpFramesCnt = PlayerParams.JumpFrames;
            this.vs = 0;
            this.coyoteTimer = 0;
            this.jumpBufferTimer = 0;
        }

        if (this.jumpFramesCnt > 0) {
            this.vs = Phaser.Math.Linear(this.vs, -PlayerParams.JumpTargetSpeed, PlayerParams.JumpLerp);
            this.jumpFramesCnt--;
        }

        // Energy processing
        if (canBoost) {
            this.en -= PlayerParams.EnDrainRate * DT;
            if (this.en <= 0) {
                this.en = 0;
                this.charging = true;
            }
        } else {
            const rm = isGrounded ? PlayerParams.EnGroundRegenMult : 1.0;
            this.en = Math.min(this.en + PlayerParams.EnRegenRate * rm * DT, PlayerParams.EnMax);
            if (this.charging && this.en >= PlayerParams.EnMax) this.charging = false;
        }

        // コンベアの押し出しは hs（自機の意思による速度）とは別枠で、最終的な速度にだけ加算する。
        // hs 自体に混ぜないことで、摩擦やドラッグ・ブースト計算がコンベア分の速度に影響されないようにする。
        this.setVelocity(this.hs + this.conveyorPush, this.vs);

        // 押し出しは「今のフレームでコライダーが検知していれば再セットされる」前提の値なので、
        // 使い終わったら毎フレーム0に戻す（乗っていなければ自然に効果が消える）。
        this.conveyorPush = 0;

        // 射撃処理
        if (!this.inputLocked) {
            const isClicking = this.scene.input.activePointer.leftButtonDown();
            const isRightClicking = this.scene.input.activePointer.rightButtonDown();

            if (isClicking && !this.wasClicking && this.ammo > 0) {
                this.ammo--;
                this.fireBullet(false);
            }
            // サブウェポンはENを消費する仕様にする（仮にENが20以上必要とする）
            const subCost = 20;
            if (isRightClicking && !this.wasRightClicking && this.en >= subCost) {
                this.en -= subCost;
                this.fireBullet(true);
            }

            this.wasClicking = isClicking;
            this.wasRightClicking = isRightClicking;
        }

        // Animation
        if (!isGrounded) {
            this.anims.play('player_jump', true);
        } else if (dir !== 0) {
            this.anims.play('player_run', true);
        } else {
            this.anims.play('player_idle', true);
        }

        this.wasWKey = wD;
    }

    takeDamage(amount: number, knockbackX: number = 0, knockbackY: number = 0) {
        if (this.invincibilityTimer > 0 || this.debugMode) return;

        this.hp -= amount;
        this.invincibilityTimer = 1.0; // 1秒無敵

        if (knockbackX !== 0 || knockbackY !== 0) {
            this.vs += knockbackY;
            this.hs += knockbackX;
        }

        if (this.hp <= 0) {
            this.respawn();
        }
    }

    private fireBullet(isSubWeapon: boolean) {
        const dx = this.aimPos.x - this.x;
        const dy = this.aimPos.y - this.y;
        const angle = Math.atan2(dy, dx);
        
        const speed = isSubWeapon ? PlayerParams.SubBulletSpeed : PlayerParams.BulletSpeed;
        const vx = Math.cos(angle) * speed;
        const vy = Math.sin(angle) * speed;
        
        // main.tsに弾生成を依頼する
        if (isSubWeapon) {
            this.scene.events.emit('playerSubFire', this.x, this.y, vx, vy);
        } else {
            this.scene.events.emit('playerFire', this.x, this.y, vx, vy);
        }
    }

    refillAmmo() {
        this.ammo = 3;
    }

    addAmmo(amount: number) {
        this.ammo = Math.min(this.ammo + amount, 3);
    }

    heal(amount: number) {
        this.hp = Math.min(this.hp + amount, 5);
    }

    restoreEnergy(amount: number) {
        this.en = Math.min(this.en + amount, PlayerParams.EnMax);
    }

    applyKnockback(forceX: number, forceY: number) {
        this.setVelocity(forceX, forceY);
    }

    setSpawnPoint(x: number, y: number) {
        this.spawnX = x;
        this.spawnY = y;
    }

    respawn() {
        this.hp = 5;
        this.en = PlayerParams.EnMax;
        this.ammo = 1;
        this.charging = false;
        this.boostRamp = 0;
        this.boostTimer = 0;
        this.hs = 0;
        this.vs = 0;
        this.jumpFramesCnt = 0;
        this.coyoteTimer = 0;
        this.jumpBufferTimer = 0;
        this.invincibilityTimer = 0;
        this.setAlpha(1.0);
        this.setPosition(this.spawnX, this.spawnY);
        this.setVelocity(0, 0);
        this.setAcceleration(0, 0);
    }
}
