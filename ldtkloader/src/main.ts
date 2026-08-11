import Phaser from 'phaser';
import { LdtkParser, EntityData } from './LdtkParser';
import { Player } from './Player';
import { MovingPlatform } from './MovingPlatform';
import { Enemy } from './Enemy';
import { BounceEnemy } from './BounceEnemy';
import { FloaterEnemy } from './FloaterEnemy';
import { TriShooter } from './TriShooter';
import { ShooterKiller } from './ShooterKiller';
import { UIScene } from './UIScene';
import { PlayerBullet } from './PlayerBullet';
import { Item, ItemType } from './Item';
import { ItemBox } from './ItemBox';
import { NPC } from './NPC';
import { EventTrigger } from './EventTrigger';
import { CrumbleBlock } from './CrumbleBlock';
import { FallingSpike } from './FallingSpike';

class MainScene extends Phaser.Scene {
    private parseResult?: { levelPxWid: number; levelPxHei: number; entities: EntityData[], collisionLayers: Phaser.Tilemaps.TilemapLayer[] };
    public player?: Player;
    private movingPlatforms: MovingPlatform[] = [];
    private enemies: Enemy[] = [];
    private enemyGroup!: Phaser.Physics.Arcade.Group;
    private itemBoxes!: Phaser.Physics.Arcade.Group;
    private itemGroup!: Phaser.Physics.Arcade.Group;
    private npcs: NPC[] = [];
    private eventTriggers!: Phaser.Physics.Arcade.Group;
    private conveyers!: Phaser.Physics.Arcade.Group;
    private crumbleBlocks!: Phaser.Physics.Arcade.Group;
    private fallingSpikes: FallingSpike[] = [];

    // マウスロック用カーソル座標
    private aimScreenX: number = 0;
    private aimScreenY: number = 0;

    private cursors?: Phaser.Types.Input.Keyboard.CursorKeys;
    private keyW!: Phaser.Input.Keyboard.Key;
    private keySpace!: Phaser.Input.Keyboard.Key;
    private wasInteractDown: boolean = false; // インタラクトキーの押し下げ判定用

    constructor() {
        super('MainScene');
    }

    preload() {
        // LDtk JSON をロード
        this.load.json('stage1', '/Ldtk/stage1.ldtk');
        
        // プレイヤーのスプライトシートをロード
        this.load.spritesheet('player', '/Assets_image_resource/Tiles/kenney_pixel-platformer/Tilemap/tilemap-characters_packed.png', {
            frameWidth: 24,
            frameHeight: 24,
        });

        // 敵スプライト画像をロード
        this.load.image('enemy_idle', '/Assets_image_resource/EnemySprites/Enemy_slime/enemy_idle.png');
        this.load.image('enemy_run', '/Assets_image_resource/EnemySprites/Enemy_slime/enemy_run.png');
        this.load.image('enemy_hurt', '/Assets_image_resource/EnemySprites/Enemy_slime/enemy_hurt.png');
        this.load.image('enemy_die', '/Assets_image_resource/EnemySprites/Enemy_slime/enemy_die.png');
    }

    create() {
        this.cursors = this.input.keyboard?.createCursorKeys();
        if (this.input.keyboard) {
            this.keyW = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W);
            this.keySpace = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
        }
        
        const ldtkData = this.cache.json.get('stage1');
        
        // JSONデータから必要なタイルセット画像をLoaderに追加
        LdtkParser.preloadTilesets(this, ldtkData, '/Ldtk/');

        // すり抜け対策: TILE_BIASを大きく設定
        this.physics.world.TILE_BIAS = 64;

        // 黒い四角形テクスチャを作成
        if (!this.textures.exists('black_box')) {
            const g = this.add.graphics();
            g.fillStyle(0x000000);
            g.fillRect(0, 0, 16, 16);
            g.generateTexture('black_box', 16, 16);
            g.destroy();
        }

        // 物理演算のデバッグ表示（当たり判定の枠など）はデフォルトでオフにする
        this.physics.world.drawDebug = false;
        if (this.physics.world.debugGraphic) {
            this.physics.world.debugGraphic.clear();
        }

        // create内で追加したアセットをロード開始
        this.load.once('complete', () => {
            this.buildLevel(ldtkData);
        });
        this.load.start();
    }

    private buildLevel(ldtkData: any) {
        // 全てのレベルを描画
        this.parseResult = LdtkParser.renderAllLevels(this, ldtkData) ?? undefined;

        if (this.parseResult) {
            const { minX, minY, levelPxWid, levelPxHei, entities, collisionLayers } = this.parseResult;

            // 存在するエンティティの種類をコンソールに出力
            const uniqueIdentifiers = Array.from(new Set(entities.map(e => e.identifier))).join(', ');
            console.log("Entities found:", uniqueIdentifiers);

            // カメラと物理エンジンの境界を設定
            this.cameras.main.setBounds(minX, minY, levelPxWid, levelPxHei);
            this.physics.world.setBounds(minX, minY, levelPxWid, levelPxHei);

            // ギミックグループの作成
            const deathZones = this.physics.add.group({ allowGravity: false, immovable: true });
            const springs = this.physics.add.group({ allowGravity: false, immovable: true });
            const goals = this.physics.add.group({ allowGravity: false, immovable: true });
            const warpdoors = this.physics.add.group({ allowGravity: false, immovable: true });
            const spikes = this.physics.add.group({ allowGravity: false, immovable: true });
            const checkpoints = this.physics.add.group({ allowGravity: false, immovable: true });
            this.movingPlatforms = [];

            this.itemBoxes = this.physics.add.group({ allowGravity: false, immovable: true });
            this.itemGroup = this.physics.add.group({ runChildUpdate: true });
            
            this.enemies = [];
            this.enemyGroup = this.physics.add.group({ runChildUpdate: true });
            
            // 仮想カーソルの初期位置（画面中央）
            this.aimScreenX = this.scale.width / 2;
            this.aimScreenY = this.scale.height / 2;

            // マウスロックイベントの登録
            this.input.on('pointerdown', () => {
                if (!this.input.mouse?.locked) {
                    this.input.mouse?.requestPointerLock();
                }
            });

            this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
                if (this.input.mouse?.locked) {
                    this.aimScreenX += pointer.movementX;
                    this.aimScreenY += pointer.movementY;
                    
                    // 画面外に出ないようにクランプ
                    this.aimScreenX = Phaser.Math.Clamp(this.aimScreenX, 0, this.scale.width);
                    this.aimScreenY = Phaser.Math.Clamp(this.aimScreenY, 0, this.scale.height);
                }
            });

            this.npcs = [];
            this.eventTriggers = this.physics.add.group();
            
            this.conveyers = this.physics.add.group({ allowGravity: false, immovable: true });
            this.crumbleBlocks = this.physics.add.group({ allowGravity: false, immovable: true });
            this.fallingSpikes = [];

            // エンティティからギミックを生成
            for (const e of entities) {
                if (e.identifier === 'PlayerSpawn') {
                    const spawnX = e.x + (0.5 - e.pivot[0]) * e.width;
                    const spawnY = e.y + (0.5 - e.pivot[1]) * e.height;
                    this.player = new Player(this, spawnX, spawnY);

                    // 足元センサー用にコリジョンレイヤーを渡す（ジッターに強い接地判定のため）
                    this.player.setCollisionLayers(collisionLayers);

                    // すべてのコリジョンレイヤーとプレイヤーの当たり判定を設定
                    for (const layer of collisionLayers) {
                        this.physics.add.collider(this.player, layer);
                    }
                    // カメラの追従
                    this.cameras.main.startFollow(this.player, true, 0.1, 0.1);
                    continue;
                }

                const centerX = e.x + (0.5 - e.pivot[0]) * e.width;
                const centerY = e.y + (0.5 - e.pivot[1]) * e.height;
                let group: Phaser.Physics.Arcade.Group | null = null;
                let newSprite: Phaser.GameObjects.Sprite | null = null;

                if (e.identifier === 'DeathZone' || e.identifier === 'Magma' || e.identifier === 'DummyDeathZone') {
                    group = deathZones;
                } else if (e.identifier === 'Spring') {
                    group = springs;
                } else if (e.identifier === 'Spike') {
                    group = spikes;
                } else if (e.identifier === 'Checkpoint') {
                    group = checkpoints;
                } else if (e.identifier === 'Goal') {
                    group = goals;
                } else if (e.identifier === 'Warpdoor' || e.identifier === 'WarpPoint') {
                    // ワープ扉
                    const door = warpdoors.create(centerX, centerY, 'black_box') as Phaser.Physics.Arcade.Sprite;
                    door.setDisplaySize(e.width, e.height);
                    door.setVisible(true); // 視認できるようにする
                    door.setData('entityIid', e.iid);
                    door.setData('fields', e.fields);
                    newSprite = door;
                }
                else if (e.identifier.toLowerCase().includes('moving') || e.identifier === 'Waypoints') {
                    // 動く床（名前に Moving/moving が含まれるもの、または Waypoints エンティティ）
                    let waypoints: Phaser.Math.Vector2[] = [];
                    
                    // LDtk上のフィールド名を全て試す（Point, waypoints, Waypoints 等）
                    const wpField = e.fields?.Point ?? e.fields?.point ?? e.fields?.waypoints ?? e.fields?.Waypoints;
                    if (wpField && Array.isArray(wpField)) {
                        // cx/cy はレベル内のグリッド座標なので、gridSize を掛けて levelWorldX/Y を足す
                        waypoints = wpField.map((pt: any) => new Phaser.Math.Vector2(
                            pt.cx * e.gridSize + e.levelWorldX,
                            pt.cy * e.gridSize + e.levelWorldY
                        ));
                    } else {
                        waypoints.push(new Phaser.Math.Vector2(centerX + 100, centerY));
                    }

                    const platform = new MovingPlatform(this, centerX, centerY, e.width, e.height, waypoints);
                    platform.setTexture('black_box');
                    platform.setVisible(true);
                    this.movingPlatforms.push(platform);
                    newSprite = platform;
                } else if (e.identifier.toLowerCase() === 'itembox') {
                    const dropField = e.fields?.dropItem ?? e.fields?.DropItem;
                    const amountField = e.fields?.amount ?? e.fields?.Amount;
                    const dropType = (dropField as ItemType) ?? 'Coin';
                    const amount = amountField ?? 1;
                    const ib = new ItemBox(this, centerX, centerY, dropType, amount);
                    this.itemBoxes.add(ib);
                    newSprite = ib;
                } else if (e.identifier.toLowerCase() === 'npc') {
                    const name = e.fields?.Name ?? 'NPC';
                    
                    let linesField = e.fields?.Lines ?? e.fields?.lines;
                    let lines = ['...'];
                    if (Array.isArray(linesField) && linesField.length > 0) {
                        lines = linesField;
                    } else if (typeof linesField === 'string') {
                        lines = [linesField];
                    }
                    
                    const repeatable = e.fields?.Repeatable ?? true;
                    const npc = new NPC(this, centerX, centerY, name, lines, repeatable);
                    this.npcs.push(npc);
                    newSprite = npc;
                } else if (e.identifier.toLowerCase() === 'eventtrigger') {
                    const eventId = e.fields?.EventId ?? 'event';
                    
                    let linesField = e.fields?.Lines ?? e.fields?.lines;
                    let lines = ['...'];
                    if (Array.isArray(linesField) && linesField.length > 0) {
                        lines = linesField;
                    } else if (typeof linesField === 'string') {
                        lines = [linesField];
                    }
                    
                    const oneShot = e.fields?.OneShot ?? true;
                    const freezePlayer = e.fields?.FreezePlayer ?? true;
                    const noComment = e.fields?.NoComment ?? false;
                    const trigger = new EventTrigger(this, e.x, e.y, e.width, e.height, eventId, lines, oneShot, freezePlayer, noComment);
                    this.eventTriggers.add(trigger);
                    newSprite = trigger;
                } else if (e.identifier === 'Conveyer' || e.identifier === 'Conveyor') {
                    const speed = e.fields?.speed ?? e.fields?.Speed ?? 100;
                    const conv = this.conveyers.create(centerX, centerY, 'black_box') as Phaser.Physics.Arcade.Sprite;
                    conv.setDisplaySize(e.width, e.height);
                    conv.setData('speed', speed);
                    newSprite = conv;
                } else if (e.identifier === 'CrumbleBlock') {
                    const delay = e.fields?.delay ?? e.fields?.Delay ?? 1.0;
                    const cb = new CrumbleBlock(this, centerX, centerY, e.width, e.height, delay);
                    this.crumbleBlocks.add(cb);
                    newSprite = cb;
                } else if (e.identifier === 'FallingSpike') {
                    const rangeX = e.fields?.rangeX ?? e.fields?.RangeX ?? 50;
                    const rangeY = e.fields?.rangeY ?? e.fields?.RangeY ?? 400;
                    const fs = new FallingSpike(this, centerX, centerY, e.width, e.height, rangeX, rangeY);
                    this.fallingSpikes.push(fs);
                    newSprite = fs;
                } else if (e.identifier === 'TriShooter') {
                    const ts = new TriShooter(this, centerX, centerY);
                    this.enemies.push(ts);
                    newSprite = ts;
                } else if (e.identifier === 'Shooter_Killer' || e.identifier === 'shooter_killer' || e.identifier === 'Shooter_killer') {
                    const sk = new ShooterKiller(this, centerX, centerY);
                    this.enemies.push(sk);
                    newSprite = sk;
                } else if (e.identifier === 'Enemy' || e.identifier === 'Slime' || e.identifier === 'PatrolEnemy') {
                    const en = new Enemy(this, centerX, centerY, 80, 50, 1);
                    this.enemies.push(en);
                    newSprite = en;
                } else if (e.identifier === 'BounceEnemy') {
                    const en = new BounceEnemy(this, centerX, centerY, 150);
                    this.enemies.push(en);
                    newSprite = en;
                } else if (e.identifier === 'FloaterEnemy') {
                    const en = new FloaterEnemy(this, centerX, centerY, 20, 0.5, 30);
                    this.enemies.push(en);
                    newSprite = en;
                }

                if (group) {
                    const zone = group.create(centerX, centerY, 'black_box') as Phaser.Physics.Arcade.Sprite;
                    zone.setDisplaySize(e.width, e.height);
                    // DeathZone, DummyDeathZone は非表示にする（Magmaは見た目を出すため除外）
                    if (e.identifier === 'DeathZone' || e.identifier === 'DummyDeathZone') {
                        zone.setVisible(false);
                    } else {
                        zone.setVisible(true); 
                    }
                    newSprite = zone;
                }
                
                // LDtkから画像(タイル)が設定されている場合は適用する
                // ただし非表示エンティティ(DeathZone等)にはテクスチャを適用しない
                const isInvisibleZone = e.identifier === 'DeathZone' || e.identifier === 'DummyDeathZone';
                if (newSprite && e.textureKey && e.frameIndex !== undefined && !isInvisibleZone) {
                    newSprite.setTexture(e.textureKey, e.frameIndex);
                    newSprite.setTint(0xffffff); // プレースホルダー用の色を解除
                }
            }

            // 敵グループに追加（弾との当たり判定用）
                this.enemyGroup = this.physics.add.group();
                for (const enemy of this.enemies) {
                    this.enemyGroup.add(enemy);
                }

                for (const enemy of this.enemies) {
                    // 地形との当たり判定
                    for (const layer of collisionLayers) {
                        this.physics.add.collider(enemy, layer);
                    }
                }

                // 敵的と当たり判定の共通設定
                this.physics.add.collider(this.enemyGroup, collisionLayers);
                this.physics.add.collider(this.itemGroup, collisionLayers);
                this.physics.add.collider(this.fallingSpikes, collisionLayers);

                // 敵の弾の当たり判定を処理
                const enemyBullets = this.physics.add.group({ allowGravity: false, runChildUpdate: true });
                this.events.on('enemyFire', (bullets: any[]) => {
                    bullets.forEach(b => {
                        // velocityを保存→group追加→velocity復元（groupがリセットするため）
                        const vx = b.body?.velocity?.x || 0;
                        const vy = b.body?.velocity?.y || 0;
                        enemyBullets.add(b);
                        b.setVelocity(vx, vy);
                        (b.body as Phaser.Physics.Arcade.Body).allowGravity = false;
                    });
                });

                // 弾とプレイヤーの当たり判定
                this.physics.add.overlap(this.player, enemyBullets, (player, bullet) => {
                    const p = player as Player;
                    const dir = (p.x - (bullet as any).x > 0) ? 1 : -1;
                    p.takeDamage(1, dir * 150, -100);
                    bullet.destroy();
                });

                // プレイヤーの弾の処理
                const playerBullets = this.physics.add.group({ allowGravity: false, runChildUpdate: true });
                this.events.on('playerFire', (x: number, y: number, vx: number, vy: number) => {
                    const bullet = new PlayerBullet(this, x, y, vx, vy, false);
                    // velocityを保存→group追加→velocity復元
                    playerBullets.add(bullet);
                    bullet.setVelocity(vx, vy);
                    (bullet.body as Phaser.Physics.Arcade.Body).allowGravity = false;
                });

                // サブウェポンの処理
                this.events.on('playerSubFire', (x: number, y: number, vx: number, vy: number) => {
                    const bullet = new PlayerBullet(this, x, y, vx, vy, true);
                    playerBullets.add(bullet);
                    bullet.setVelocity(vx, vy);
                    (bullet.body as Phaser.Physics.Arcade.Body).allowGravity = false;
                });

                // アイテム生成の処理
                this.events.on('spawnItem', (x: number, y: number, itemType: ItemType, amount: number) => {
                    const item = new Item(this, x, y, itemType, amount);
                    this.itemGroup.add(item);
                });

                // 弾とアイテム箱の当たり判定
                this.physics.add.overlap(playerBullets, this.itemBoxes, (bullet, boxObj) => {
                    bullet.destroy();
                    const box = boxObj as ItemBox;
                    box.breakBox();
                });

                // 弾と敵の当たり判定
                this.physics.add.overlap(playerBullets, this.enemyGroup, (bullet, enemyObj) => {
                    const e = enemyObj as Enemy;
                    if (!e.getIsDead()) {
                        e.takeDamage(1);
                        bullet.destroy();
                        this.player?.refillAmmo(); // 敵に当たったら弾回復
                    }
                });

                // 弾と地形の当たり判定
                for (const layer of collisionLayers) {
                    this.physics.add.collider(playerBullets, layer, (bullet) => {
                        bullet.destroy();
                        this.player?.refillAmmo();
                    });
                    
                    // アイテムと地形の当たり判定
                    this.physics.add.collider(this.itemGroup, layer);
                }

            // --- プレイヤーとギミックの相互作用を設定 ---
            if (this.player) {
                // 移動床との当たり判定（上に乗れるようにCollider）
                for (const mp of this.movingPlatforms) {
                    this.physics.add.collider(this.player, mp);
                }

                // 死亡ゾーン
                this.physics.add.overlap(this.player, deathZones, () => {
                    this.player?.respawn();
                });

                // アイテム取得
                this.physics.add.overlap(this.player, this.itemGroup, (playerObj, itemObj) => {
                    const p = playerObj as Player;
                    const item = itemObj as Item;
                    
                    switch (item.itemType) {
                        case 'Health': p.heal(item.amount); break;
                        case 'Energy': p.restoreEnergy(item.amount); break;
                        case 'Ammo': p.addAmmo(item.amount); break;
                        case 'Coin': console.log(`Got ${item.amount} coins!`); break;
                    }
                    
                    item.destroy();
                });

                // アイテム箱の衝突（踏みつけ等）
                this.physics.add.collider(this.player, this.itemBoxes, (playerObj, boxObj) => {
                    const p = playerObj as Player;
                    const b = boxObj as ItemBox;
                    const pBody = p.body as Phaser.Physics.Arcade.Body;
                    // 上から乗ったら壊れる (または横から体当たりなど条件を調整可能)
                    if (pBody.velocity.y > 0 && p.y < b.y - b.displayHeight * 0.3) {
                        p.setVelocityY(-200); // 軽くホップ
                        b.breakBox();
                    }
                });

                // ゴール
                this.physics.add.overlap(this.player, goals, () => {
                    this.add.text(this.player!.x - 50, this.player!.y - 50, 'STAGE CLEAR!', { fontSize: '24px', color: '#ff0' });
                    this.physics.pause();
                    this.player?.setTint(0x00ff00);
                });

                // イベントトリガー
                this.physics.add.overlap(this.player, this.eventTriggers, (playerObj, triggerObj) => {
                    const trigger = triggerObj as EventTrigger;
                    trigger.isPlayerInside = true;

                    if (trigger.hasTriggered && trigger.isOneShot) return;
                    
                    // 新規にゾーンに入った瞬間だけ発動する
                    if (!trigger.wasPlayerInside) {
                        const ui = this.scene.get('UIScene') as UIScene;
                        if (ui && (!ui.isDialogueOpen() || trigger.noComment)) {
                            trigger.hasTriggered = true;
                            if (trigger.noComment) {
                                console.log("EventTrigger fired (No Comment):", trigger.eventId);
                                this.events.emit('eventTriggered', trigger.eventId);
                            } else {
                                ui.showDialogue('', trigger.lines, trigger.freezePlayer);
                            }
                        }
                    }
                });

                // スプリング
                this.physics.add.collider(this.player, springs, (playerObj, springObj) => {
                    const p = playerObj as Player;
                    if (p.body?.touching.down && springObj.body?.touching.up) {
                        p.setVelocityY(-600); // 大きく跳ねる
                    }
                });

                // 流れる床 (Conveyer)
                // 座標を直接動かすと端の壁タイル等にめり込み、翌フレームの強制分離で
                // 上方向がblocked扱いになりジャンプ不能・スタックする原因になるため、
                // 速度に加算する方式に変更。判定も touching フラグではなく直接の位置比較にする。
                this.physics.add.collider(this.player, this.conveyers, (playerObj, conveyorObj) => {
                    const p = playerObj as Player;
                    const c = conveyorObj as Phaser.Physics.Arcade.Sprite;
                    const pBody = p.body as Phaser.Physics.Arcade.Body;
                    const cBody = c.body as Phaser.Physics.Arcade.Body;
                    if (!pBody || !cBody) return;

                    const verticalMargin = 4; // 足元と天面の許容誤差(px)
                    const isOnTop = Math.abs(pBody.bottom - cBody.top) <= verticalMargin;

                    if (isOnTop) {
                        const speed = c.getData('speed') || 100;
                        p.setConveyorPush(speed);
                    }
                });

                // 消える床 (CrumbleBlock)
                this.physics.add.collider(this.player, this.crumbleBlocks);

                // トゲ (Spike / FallingSpike)
                this.physics.add.overlap(this.player, spikes, (player, spikeObj) => {
                    const p = player as Player;
                    const spike = spikeObj as Phaser.Physics.Arcade.Sprite;
                    const dir = (p.x - spike.x > 0) ? 1 : -1;
                    p.takeDamage(1, dir * 150, -200); // ノックバック
                });
                this.physics.add.overlap(this.player, this.fallingSpikes, (player, spikeObj) => {
                    const p = player as Player;
                    const spike = spikeObj as Phaser.Physics.Arcade.Sprite;
                    const dir = (p.x - spike.x > 0) ? 1 : -1;
                    p.takeDamage(1, dir * 150, -200); // ノックバック
                });

                // Checkpoints
                this.physics.add.overlap(this.player, checkpoints, (player, cpObj) => {
                    const cp = cpObj as Phaser.Physics.Arcade.Sprite;
                    if (cp.tintTopLeft !== 0x00ff00) {
                        cp.setTint(0x00ff00); // 緑色にする
                        this.player?.setSpawnPoint(cp.x, cp.y);
                        console.log("Checkpoint activated at:", cp.x, cp.y);
                    }
                });

                // ワープ扉
                this.physics.add.overlap(this.player, warpdoors, (player, door) => {
                    if (this.cursors && Phaser.Input.Keyboard.JustDown(this.cursors.up)) {
                        const fields = door.getData('fields');
                        console.log("Warpdoor touched. Fields:", JSON.stringify(fields));
                        if (fields) {
                            const targetRef = fields.Target || fields.target || fields.TargetNodePath || fields.TargetDoor;
                            if (targetRef && targetRef.entityIid) {
                                const targetEntity = entities.find(t => t.iid === targetRef.entityIid);
                                if (targetEntity) {
                                    const targetX = targetEntity.x + (0.5 - targetEntity.pivot[0]) * targetEntity.width;
                                    const targetY = targetEntity.y + (0.5 - targetEntity.pivot[1]) * targetEntity.height;
                                    this.player?.setPosition(targetX, targetY);
                                } else {
                                    console.warn("Warp target entity not found:", targetRef.entityIid);
                                }
                            } else {
                                console.warn("No valid target entityIid in fields:", fields);
                            }
                        }
                    }
                });

                // --- 敵との相互作用 ---
                for (const enemy of this.enemies) {
                    this.physics.add.collider(this.player, enemy, (player, enemyObj) => {
                        const p = player as Player;
                        const e = enemyObj as Enemy;
                        if (e.getIsDead()) return;

                        // 踏みつけ等に関わらず敵に触れたら弾回復
                        p.refillAmmo();

                        // プレイヤーが上から踏みつけた場合（プレイヤーが落下中かつ敵の上方に居る）
                        const playerBody = p.body as Phaser.Physics.Arcade.Body;
                        if (playerBody.velocity.y > 0 && p.y < e.y - e.displayHeight * 0.3) {
                            // 踏みつけ成功: 敵にダメージ、プレイヤーは小ジャンプ
                            e.takeDamage(1);
                            p.setVelocityY(-250); // 踏みつけ後の小ジャンプ
                        } else {
                            // 横から触れた: プレイヤーダメージ
                            const dir = p.x - e.x > 0 ? 1 : -1;
                            p.takeDamage(1, dir * 250, -200);
                        }
                    });
                }
            }
        } else {
            this.add.text(20, 20, 'Failed to parse LDtk data.', { color: '#f00', fontSize: '24px' });
        }

        // UIシーンをオーバーレイとして起動
        this.scene.launch('UIScene');
    }

    private getEntityColor(identifier: string): number {
        switch (identifier) {
            case 'Goal': return 0xffff00;
            case 'Enemy': return 0xff0000;
            case 'DeathZone': return 0xff0044;
            case 'Magma': return 0xff4400;
            case 'Warpdoor': return 0x00aaff;
            case 'Spring': return 0x0099db;
            default: return 0xffffff;
        }
    }

    update(time: number, delta: number) {
        if (!this.eventTriggers || !this.player) return;

        // イベントトリガーの進入状態を更新
        for (const t of this.eventTriggers.getChildren()) {
            const trigger = t as EventTrigger;
            trigger.wasPlayerInside = trigger.isPlayerInside;
            trigger.isPlayerInside = false; // 次の物理ステップでoverlapしていればtrueになる
        }

        // ダイアログ表示中はプレイヤーの更新と操作を止める
        const ui = this.scene.get('UIScene') as UIScene;
        const isDialogueOpen = ui && ui.isDialogueOpen();

        const interactJustPressed = (this.keyW?.isDown || this.keySpace?.isDown);
        const interactTriggered = interactJustPressed && !this.wasInteractDown;
        this.wasInteractDown = interactJustPressed;

        // ダイアログ送り
        const shouldFreeze = ui && ui.shouldFreezePlayer();
        
        if (shouldFreeze) {
            this.player?.setInputLocked(true);
            if (interactTriggered) {
                ui.dialogueBox.advance();
            }
            // return しない（物理演算・描画更新を止めないため）
        } else {
            this.player?.setInputLocked(false);
            if (isDialogueOpen && interactTriggered) {
                ui.dialogueBox.advance();
            }
        }

        if (this.player) {
            // ロック中なら仮想カーソル、そうでなければ通常のマウス座標を使う
            if (this.input.mouse.locked) {
                this.player.getAimPos().set(this.aimScreenX + this.cameras.main.scrollX, this.aimScreenY + this.cameras.main.scrollY);
            } else {
                const pointer = this.input.activePointer;
                this.player.getAimPos().set(pointer.worldX, pointer.worldY);
                // ロック解除中も仮想カーソルの位置を同期
                this.aimScreenX = pointer.x;
                this.aimScreenY = pointer.y;
            }
            this.player.update(time, delta);
            
            // NPCとのインタラクト判定
            if (!isDialogueOpen) {
                for (const npc of this.npcs) {
                    if (npc.checkProximity(this.player.x, this.player.y)) {
                        if (interactTriggered && npc.canTalk()) {
                            npc.markTalked();
                            ui.showDialogue(npc.npcName, npc.lines, true);
                            break; // 一度に話せるのは1人
                        }
                    }
                }
            }
        }

        // 動く床の更新
        for (const mp of this.movingPlatforms) {
            mp.update(time, delta);
        }

        // 消える床の更新
        for (const cb of this.crumbleBlocks.getChildren()) {
            (cb as CrumbleBlock).updateBlock(delta, this.player);
        }

        // 落ちてくるトゲの更新
        if (this.player) {
            for (const spike of this.fallingSpikes) {
                spike.updateSpike(this.player.x, this.player.y);
            }
        }

        for (const enemy of this.enemies) {
            if (enemy.active) {
                enemy.update(time, delta);
            }
        }
    }
}

const config: Phaser.Types.Core.GameConfig = {
    type: Phaser.AUTO,
    width: 960,
    height: 540,
    parent: 'game-container',
    pixelArt: true,
    scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH
    },
    physics: {
        default: 'arcade',
        arcade: {
            gravity: { y: 0, x: 0 }, // 重力は各オブジェクト（Player等）で設定する
            fps: 240, // すり抜け（トンネリング）防止のため物理演算のFPSを高く設定
            debug: true // デバッグ表示を有効にして当たり判定を確認しやすくする
        }
    },
    scene: [MainScene, UIScene],
    backgroundColor: '#7EB0FF', // LDtk の defaultLevelBgColor
};

new Phaser.Game(config);
