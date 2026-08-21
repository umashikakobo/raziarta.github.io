import Phaser from 'phaser';
import { LdtkParser, EntityData, ParseResult } from '../Map_ldtk_and_godot_objects/LdtkParser';
import { Player } from '../Player_scripts_scenes_sprites/Player';
import { MovingPlatform } from '../Map_ldtk_and_godot_objects/MovingPlatform';
import { Enemy } from '../Enemies_all_script_data/Enemy';
import { BounceEnemy } from '../Enemies_all_script_data/BounceEnemy';
import { FloaterEnemy } from '../Enemies_all_script_data/FloaterEnemy';
import { TriShooter } from '../Enemies_all_script_data/TriShooter';
import { ShooterKiller } from '../Enemies_all_script_data/ShooterKiller';
import { LobberEnemy } from '../Enemies_all_script_data/LobberEnemy';
import { ShieldEnemy } from '../Enemies_all_script_data/ShieldEnemy';
import { SpinShieldEnemy } from '../Enemies_all_script_data/SpinShieldEnemy';
import { HopperEnemy } from '../Enemies_all_script_data/HopperEnemy';
import { ChargerEnemy } from '../Enemies_all_script_data/ChargerEnemy';
import { CrawlerEnemy } from '../Enemies_all_script_data/CrawlerEnemy';
import { BossEnemy } from '../Enemies_all_script_data/BossEnemy';
import { UIScene } from '../UI_worldmap_clear_gameover_other/UIScene';
import { PlayerBullet } from '../Player_scripts_scenes_sprites/PlayerBullet';
import { Item, ItemType } from '../UI_worldmap_clear_gameover_other/Item';
import { ItemBox } from '../UI_worldmap_clear_gameover_other/ItemBox';
import { NPC } from '../UI_worldmap_clear_gameover_other/NPC';
import { EventTrigger } from '../Map_ldtk_and_godot_objects/EventTrigger';
import { CrumbleBlock } from '../Map_ldtk_and_godot_objects/CrumbleBlock';
import { FallingSpike } from '../Map_ldtk_and_godot_objects/FallingSpike';
import { GameFlags } from './GameFlags';
import { BossRoom } from '../Map_ldtk_and_godot_objects/BossRoom';
import { EventRunner } from './EventRunner';
import { canFireEvent } from './EventRegistry';
import { PlayerEquipment } from '../Player_scripts_scenes_sprites/PlayerEquipment';
import { isEquipmentItem, getEquipmentDef } from './EquipmentRegistry';

export class MainScene extends Phaser.Scene {
    private spawnData?: any;
    private eventRunner!: EventRunner;
    public playerEquipment!: PlayerEquipment;
    private parseResult?: ParseResult;
    public player?: Player;
    private movingPlatforms: MovingPlatform[] = [];
    private enemies: Enemy[] = [];
    private itemBoxes!: Phaser.Physics.Arcade.Group;
    private itemGroup!: Phaser.Physics.Arcade.Group;
    private npcs: NPC[] = [];
    private eventTriggers!: Phaser.Physics.Arcade.Group;
    private conveyers!: Phaser.Physics.Arcade.Group;
    private crumbleBlocks!: Phaser.Physics.Arcade.Group;
    private fallingSpikes: FallingSpike[] = [];
    private bossRooms: BossRoom[] = [];
    private isAtCheckpoint: boolean = false;
    private currentCheckpoint?: any;
    private lastZMenuSpawn: { x: number; y: number } | null = null; // Zキーメニューを開いた最後のチェックポイント位置
    private deathFading: boolean = false; // 死亡フェードアウト中フラグ

    private isAtWarpdoor: boolean = false;
    private currentWarpdoor?: any;

    private interactIcon!: Phaser.GameObjects.Text;


    private cursors?: Phaser.Types.Input.Keyboard.CursorKeys;
    private keyW!: Phaser.Input.Keyboard.Key;
    private keySpace!: Phaser.Input.Keyboard.Key;
    private keyQ!: Phaser.Input.Keyboard.Key;
    private keyZ!: Phaser.Input.Keyboard.Key;
    private wasInteractDown: boolean = false; // インタラクトキーの押し下げ判定用

    constructor() {
        super('MainScene');
    }

    init(data: any) {
        this.spawnData = data;
        this.eventRunner = new EventRunner(this);
        this.playerEquipment = new PlayerEquipment();
    }

    preload() {
        // GITHUB_PAGES_SPEC.md 方針: vite.config.ts の base:'./' と組み合わせ、
        // ページの現在地からの相対パスで解決させる。import.meta.env.BASE_URL には依存しない。
        this.load.json('stage1', './Ldtk/stage1.ldtk');

        // プレイヤーのスプライトシートをロード
        this.load.spritesheet('player', './Assets_image_resource/Tiles/kenney_pixel-platformer/Tilemap/tilemap-characters_packed.png', {
            frameWidth: 24,
            frameHeight: 24,
        });

        // 敵スプライト画像をロード
        this.load.image('enemy_idle', './Assets_image_resource/EnemySprites/Enemy_slime/enemy_idle.png');
        this.load.image('enemy_run', './Assets_image_resource/EnemySprites/Enemy_slime/enemy_run.png');
        this.load.image('enemy_hurt', './Assets_image_resource/EnemySprites/Enemy_slime/enemy_hurt.png');
        this.load.image('enemy_die', './Assets_image_resource/EnemySprites/Enemy_slime/enemy_die.png');
    }

    create() {
        // シーン再スタート時のデータを復元
        const initData = (this.sys.settings.data as any) || {};
        if (initData.lastZMenuSpawn) {
            this.lastZMenuSpawn = initData.lastZMenuSpawn;
        }

        this.cursors = this.input.keyboard?.createCursorKeys();
        if (this.input.keyboard) {
            this.keyW = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W);
            this.keySpace = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
            this.keyQ = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.Q);
            this.keyZ = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.Z);
        }

        const ldtkData = this.cache.json.get('stage1');

        // JSONデータから必要なタイルセット画像をLoaderに追加
        LdtkParser.preloadTilesets(this, ldtkData, './Ldtk/');

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

        // インタラクト用の共通Zアイコン (チェックポイント・ワープなどで使用)
        this.interactIcon = this.add.text(0, 0, 'Z', {
            fontSize: '12px',
            fontFamily: 'monospace',
            color: '#ffff00',
            stroke: '#000000',
            strokeThickness: 2,
        }).setOrigin(0.5).setVisible(false).setDepth(20);

        // create内で追加したアセットをロード開始
        this.load.once('complete', () => {
            this.buildLevel(ldtkData);
            // 死亡リスポーン後はフェードインで黒から復帰
            if (initData.lastZMenuSpawn) {
                this.cameras.main.fadeIn(500, 0, 0, 0);
                this.deathFading = false;
            }
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

            if (this.parseResult.bgColor) {
                this.cameras.main.setBackgroundColor(this.parseResult.bgColor);
            }

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

            // マウスロックをリクエスト（クリック時）
            this.input.on('pointerdown', () => {
                if (!this.input.mouse?.locked) {
                    this.input.mouse?.requestPointerLock();
                }
            });

            this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
                if (this.player && this.input.mouse?.locked) {
                    const cam = this.cameras.main;
                    const aim = this.player.getAimPos();
                    aim.x += pointer.movementX / cam.zoom;
                    aim.y += pointer.movementY / cam.zoom;
                }
            });

            this.npcs = [];
            this.eventTriggers = this.physics.add.group();

            this.conveyers = this.physics.add.group({ allowGravity: false, immovable: true });
            this.crumbleBlocks = this.physics.add.group({ allowGravity: false, immovable: true });
            this.fallingSpikes = [];
            this.bossRooms = [];

            // 1. プレイヤーの生成を先に行う (WorldMapSceneなどから指定されたTargetSpawnIdがあればそれを使う)
            const targetId = this.spawnData?.targetSpawnId;
            let spawnObj = targetId ? entities.find(e => e.identifier === 'PlayerSpawn' && e.iid === targetId) : undefined;
            if (!spawnObj) spawnObj = entities.find(e => e.identifier === 'PlayerSpawn');
            if (!spawnObj && entities.length > 0) spawnObj = entities[0]; // フェールセーフ

            if (spawnObj) {
                const spawnX = spawnObj.x + (0.5 - spawnObj.pivot[0]) * spawnObj.width;
                const spawnY = spawnObj.y + (0.5 - spawnObj.pivot[1]) * spawnObj.height - 12;
                this.player = new Player(this, spawnX, spawnY);
                this.player.setCollisionLayers(collisionLayers);
                for (const layer of collisionLayers) {
                    this.physics.add.collider(this.player, layer);
                }
                this.cameras.main.startFollow(this.player, true, 0.1, 0.1);
            }

            // 2. 他のエンティティからギミックを生成
            for (const e of entities) {
                if (e.identifier === 'PlayerSpawn') continue; // 生成済みのためスキップ

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
                    const hp = e.fields?.hp ?? e.fields?.HP ?? e.fields?.Hp ?? 1;
                    const ts = new TriShooter(this, centerX, centerY, hp);
                    this.enemies.push(ts);
                    newSprite = ts;
                } else if (e.identifier === 'Shooter_Killer' || e.identifier === 'shooter_killer' || e.identifier === 'Shooter_killer') {
                    const hp = e.fields?.hp ?? e.fields?.HP ?? e.fields?.Hp ?? 1;
                    const sk = new ShooterKiller(this, centerX, centerY, hp);
                    this.enemies.push(sk);
                    newSprite = sk;
                } else if (e.identifier === 'Enemy' || e.identifier === 'Slime' || e.identifier === 'PatrolEnemy') {
                    const hp = e.fields?.hp ?? e.fields?.HP ?? e.fields?.Hp ?? 1;
                    const speed = e.fields?.speed ?? e.fields?.Speed ?? 60;
                    const en = new Enemy(this, centerX, centerY, 80, speed, hp);
                    this.enemies.push(en);
                    newSprite = en;
                } else if (e.identifier === 'BounceEnemy') {
                    const hp = e.fields?.hp ?? e.fields?.HP ?? e.fields?.Hp ?? 1;
                    const en = new BounceEnemy(this, centerX, centerY, 150, hp);
                    this.enemies.push(en);
                    newSprite = en;
                } else if (e.identifier === 'FloaterEnemy') {
                    const hp = e.fields?.hp ?? e.fields?.HP ?? e.fields?.Hp ?? 1;
                    const en = new FloaterEnemy(this, centerX, centerY, 20, 0.5, 30, hp);
                    this.enemies.push(en);
                    newSprite = en;
                } else if (e.identifier === 'LobberEnemy') {
                    const hp = e.fields?.hp ?? 2;
                    const speed = e.fields?.speed ?? 30;
                    const interval = e.fields?.throwInterval ?? 2000;
                    const en = new LobberEnemy(this, centerX, centerY, 60, speed, hp, interval);
                    this.enemies.push(en);
                    newSprite = en;
                } else if (e.identifier === 'ShieldEnemy') {
                    const hp = e.fields?.hp ?? 2;
                    const speed = e.fields?.speed ?? 40;
                    const en = new ShieldEnemy(this, centerX, centerY, 30, speed, hp); // 巡回範囲を30に縮小
                    this.enemies.push(en);
                    newSprite = en;
                } else if (e.identifier === 'SpinShieldEnemy') {
                    const hp = e.fields?.hp ?? 3;
                    const spinSpeed = e.fields?.spinSpeed ?? 2;
                    const en = new SpinShieldEnemy(this, centerX, centerY, hp, spinSpeed);
                    this.enemies.push(en);
                    newSprite = en;
                } else if (e.identifier === 'HopperEnemy') {
                    const hp = e.fields?.hp ?? 1;
                    const jumpPower = e.fields?.jumpPower ?? 600;
                    const jumpInterval = e.fields?.jumpInterval ?? 1500;
                    const en = new HopperEnemy(this, centerX, centerY, hp, jumpPower, jumpInterval);
                    this.enemies.push(en);
                    newSprite = en;
                } else if (e.identifier === 'ChargerEnemy') {
                    const hp = e.fields?.hp ?? 1;
                    const chargeSpeed = e.fields?.chargeSpeed ?? 130;
                    const en = new ChargerEnemy(this, centerX, centerY, hp, chargeSpeed);
                    this.enemies.push(en);
                    newSprite = en;
                } else if (e.identifier === 'CrawlerEnemy' || e.identifier === 'CrawerEnemy') { // つづり間違いにも対応
                    const hp = e.fields?.hp ?? 1;
                    const speed = e.fields?.speed ?? 50;
                    const en = new CrawlerEnemy(this, centerX, centerY, hp, speed);
                    this.enemies.push(en);
                    newSprite = en;
                } else if (e.identifier === 'BossEnemy') {
                    const hp = e.fields?.hp ?? 15;
                    const bossId = e.fields?.bossId ?? 'boss_1';
                    const en = new BossEnemy(this, centerX, centerY, hp, bossId);
                    if (this.player) {
                        en.setTarget(this.player);
                    }
                    this.enemies.push(en);
                    newSprite = en;
                } else if (e.identifier === 'BossRoom') {
                    const bossId = e.fields?.bossId ?? 'boss_1';
                    const br = new BossRoom(this, centerX, centerY, e.width, e.height, bossId);
                    this.bossRooms.push(br);
                    newSprite = br;
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

            for (const enemy of this.enemies) {
                // 地形との当たり判定
                for (const layer of collisionLayers) {
                    this.physics.add.collider(enemy, layer);
                }
                if (enemy instanceof BossEnemy) {
                    enemy.setCollisionLayers(collisionLayers);
                }
            }

            // ギミックとアイテムに等共通設定
            this.physics.add.collider(this.itemGroup, collisionLayers);
            this.physics.add.collider(this.fallingSpikes, collisionLayers);

            // 古いイベントリスナーがシーンリロード時に重複して残ることで、古い(破棄された)グループへ追加しようとしてクラッシュする現象(TypeError reading 'set')を防ぐ
            this.events.off('enemyFire');
            this.events.off('playerFire');
            this.events.off('playerSubFire');

            // 敵の弾の当たり判定を処理
            const enemyBullets = this.physics.add.group({ allowGravity: false, runChildUpdate: true });
            this.events.on('enemyFire', (bullets: any[]) => {
                bullets.forEach(b => {
                    const vx = b.body?.velocity?.x || 0;
                    const vy = b.body?.velocity?.y || 0;
                    enemyBullets.add(b);
                    b.setVelocity(vx, vy);
                    if (b.body) (b.body as Phaser.Physics.Arcade.Body).allowGravity = false;
                });
            });

            // 壁と敵の弾の当たり判定
            this.physics.add.collider(enemyBullets, collisionLayers, (bullet) => {
                bullet.destroy();
            });

            // 弾とプレイヤーの当たり判定
            if (this.player) {
                this.physics.add.overlap(this.player, enemyBullets, (playerObj, bullet) => {
                    const p = playerObj as Player;
                    const dir = (p.x - (bullet as any).x > 0) ? 1 : -1;
                    p.takeDamage(1, dir * 150, -100);
                    bullet.destroy();
                });
            }
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

            // 壁とプレイヤーの弾の当たり判定 (もしなければ追加)
            this.physics.add.collider(playerBullets, collisionLayers, (bullet) => {
                bullet.destroy();
            });

            // アイテム生成の処理 (equipIdも受け取れるように拡張)
            this.events.on('spawnItem', (x: number, y: number, itemType: ItemType, amount: number, equipId?: string) => {
                const item = new Item(this, x, y, itemType, amount, equipId);
                this.itemGroup.add(item);
            });

            // 弾とアイテム箱の当たり判定
            this.physics.add.overlap(playerBullets, this.itemBoxes, (bullet, boxObj) => {
                bullet.destroy();
                const box = boxObj as ItemBox;
                box.breakBox();
            });

            // 弾と敵の当たり判定
            this.physics.add.overlap(playerBullets, this.enemies, (obj1, obj2) => {
                const bullet = (obj1 instanceof PlayerBullet) ? obj1 : obj2 as PlayerBullet;
                const e = (obj1 instanceof PlayerBullet) ? obj2 as Enemy : obj1 as Enemy;
                if (typeof e.getIsDead === 'function' && !e.getIsDead()) {
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
                    this.physics.add.collider(this.player, mp, () => {
                        if ((this.player?.body as Phaser.Physics.Arcade.Body)?.touching.down) {
                            this.player!.touchingRigidBody = true;
                        }
                    });
                }

                // 死亡ゾーン
                this.physics.add.overlap(this.player, deathZones, () => {
                    this.player?.die();
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
                        case 'Equipment':
                            if (item.equipId) {
                                this.playerEquipment.addToInventory(item.equipId);
                                const def = getEquipmentDef(item.equipId);
                                const ui = this.scene.get('UIScene') as UIScene;
                                if (def && ui) {
                                    ui.showDialogue('装備品入手', [`${def.displayName} を手に入れた！\n// ${def.comment}`], false);
                                }
                            }
                            break;
                    }

                    item.destroy();
                });

                // アイテム箱の衝突（踏みつけ等）
                this.physics.add.collider(this.player, this.itemBoxes, (playerObj, boxObj) => {
                    const p = playerObj as Player;
                    const b = boxObj as ItemBox;
                    const pBody = p.body as Phaser.Physics.Arcade.Body;
                    if (pBody.touching.down) p.touchingRigidBody = true;
                    // 上から乗ったら壊れる (または横から体当たりなど条件を調整可能)
                    if (pBody.velocity.y > 0 && p.y < b.y - b.displayHeight * 0.3) {
                        p.setVelocityY(-200); // 軽くホップ
                        b.breakBox();
                    }
                });

                // ゴール (フラグONに変更)
                this.physics.add.overlap(this.player, goals, (playerObj, goalObj) => {
                    const goal = goalObj as Phaser.Physics.Arcade.Sprite;
                    const fields = goal.getData('fields') || {};
                    const flagName = fields.flag ?? 'stage_cleared';

                    if (!GameFlags.get(flagName)) {
                        GameFlags.set(flagName, true);
                        this.add.text(this.player!.x - 50, this.player!.y - 50, `Flag Set: ${flagName}`, { fontSize: '24px', color: '#ff0' });
                        this.player?.setTint(0x00ffaa);
                    }
                });

                // ワープ扉
                this.physics.add.overlap(this.player, warpdoors, (playerObj, doorObj) => {
                    this.isAtWarpdoor = true;
                    this.currentWarpdoor = doorObj as Phaser.Physics.Arcade.Sprite;
                });

                // ボス部屋
                for (const br of this.bossRooms) {
                    this.physics.add.overlap(this.player, br, () => {
                        br.triggerFightIfReady(this.player as Player);
                    });
                }

                // イベントトリガー
                this.physics.add.overlap(this.player, this.eventTriggers, (playerObj, triggerObj) => {
                    const trigger = triggerObj as EventTrigger;
                    trigger.isPlayerInside = true;

                    if (trigger.hasTriggered && trigger.isOneShot) return;

                    // 新規にゾーンに入った瞬間だけ発動する
                    if (!trigger.wasPlayerInside) {
                        const ui = this.scene.get('UIScene') as UIScene;
                        if (ui && (!ui.isDialogueOpen() || trigger.noComment) && !this.eventRunner.getIsRunning()) {
                            trigger.hasTriggered = true;

                            // EventRegistryに台本があればEventRunnerで実行
                            if (canFireEvent(trigger.eventId)) {
                                this.eventRunner.run(trigger.eventId);
                            } else if (trigger.noComment) {
                                // 台本なし & NoComment: イベントIDだけ飛ばす
                                console.log('EventTrigger fired (No Comment):', trigger.eventId);
                                this.events.emit('eventTriggered', trigger.eventId);
                            } else {
                                // 台本なし: LDtk側に直接書かれたlines表示にフォールバック
                                ui.showDialogue('', trigger.lines, trigger.freezePlayer);
                            }
                        }
                    }
                });

                // スプリング
                this.physics.add.collider(this.player, springs, (playerObj, springObj) => {
                    const p = playerObj as Player;
                    const s = springObj as Phaser.Physics.Arcade.Sprite;
                    if (p.body?.touching.down && s.body?.touching.up) {
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
                this.physics.add.overlap(this.player, checkpoints, (playerObj, cpObj) => {
                    const p = playerObj as Player;
                    this.isAtCheckpoint = true;
                    this.currentCheckpoint = cpObj as Phaser.GameObjects.Sprite;
                    const cp = cpObj as Phaser.Physics.Arcade.Sprite;

                    // チェックポイント接触時に全回復
                    p.heal(99);
                    p.refillAmmo();
                    p.restoreEnergy(999);

                    if (cp.tintTopLeft !== 0x00ff00) {
                        cp.setTint(0x00ff00); // 緑色にする
                        // 死亡時の再出撃ポイントを記録 (scene restart時に引き継がれる)
                        p.setSpawnPoint(cp.x, cp.y);
                        console.log("Checkpoint activated at:", cp.x, cp.y);
                    }
                });

                // ワープ扉
                this.physics.add.overlap(this.player, warpdoors, (player, doorObj) => {
                    if (this.cursors && Phaser.Input.Keyboard.JustDown(this.cursors.up)) {
                        const door = doorObj as Phaser.Physics.Arcade.Sprite;
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

                        // プレイヤーが上から踏みつけた場合（落下中または接触している、かつ敵の上方に居る）
                        const playerBody = p.body as Phaser.Physics.Arcade.Body;
                        if ((playerBody.velocity.y > 0 || playerBody.touching.down) && p.y < e.y - e.displayHeight * 0.3) {
                            // 踏みつけ成功: 敵にダメージ、プレイヤーは小ジャンプ
                            e.takeDamage(1);
                            p.setVelocityY(-250); // 踏みつけ後の小ジャンプ
                        } else {
                            // 横から触れた: プレイヤーダメージ
                            const dir = p.x - e.x > 0 ? 1 : -1;
                            p.takeDamage(1, dir * 250, -200);

                            if (e.constructor.name === 'ChargerEnemy') {
                                (e as any).isCharging = false;
                                (e as any).chargeDir = 0;
                                e.setVelocityX(0);
                            }
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

        // --- 死亡時フェード＆リスポーン ---
        if (this.player && this.player.isDead && this.lastZMenuSpawn && !this.deathFading) {
            this.deathFading = true;
            // 画面を黒くフェードアウト
            this.cameras.main.fadeOut(600, 0, 0, 0);
            this.cameras.main.once('camerafadeoutcomplete', () => {
                if (!this.player) { this.deathFading = false; return; }
                // スポーン位置を適用してリスポーン
                this.player.setSpawnPoint(this.lastZMenuSpawn!.x, this.lastZMenuSpawn!.y);
                this.player.forceRespawn();
                // 敵を全体リロードするためシーンを再スタートするが、customSpawnを渡す
                this.scene.restart({
                    ...(this.sys.settings.data || {}),
                    customSpawn: { x: this.lastZMenuSpawn!.x, y: this.lastZMenuSpawn!.y - 12 },
                    lastZMenuSpawn: this.lastZMenuSpawn
                });
            });
        }

        // ダイアログ表示中はプレイヤーの更新と操作を止める
        const ui = this.scene.get('UIScene') as UIScene;
        const isDialogueOpen = ui && ui.isDialogueOpen();

        const interactJustPressed = (this.keyZ?.isDown);
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
            } else if (!isDialogueOpen && this.isAtCheckpoint && interactTriggered && this.keyZ?.isDown) {
                // Zキーによるチェックポイントメニュー → 開いた位置を記録
                this.lastZMenuSpawn = {
                    x: this.currentCheckpoint.x,
                    y: this.currentCheckpoint.y
                };
                const inv = this.playerEquipment.getInventory();
                const equipped = this.playerEquipment.getAllEquipped();
                const equippedStr = equipped.length > 0
                    ? equipped.map(e => `[${e.slot}] ${e.def.displayName}`).join('\n')
                    : '(なし)';
                const invStr = inv.length > 0
                    ? inv.map(id => { const d = getEquipmentDef(id); return d ? `- ${d.displayName} // ${d.comment}` : `- ${id}`; }).join('\n')
                    : '(空)';
                ui.showDialogue('Menu', [
                    `[ MENU ]\n\n装備中:\n${equippedStr}\n\nインベントリ:\n${invStr}\n\n(装備切替はWIP)`
                ], true);
            } else if (!isDialogueOpen && this.isAtWarpdoor && interactTriggered && this.currentWarpdoor) {
                // ワープ処理
                const fields = this.currentWarpdoor.getData('fields') || {};
                const targetArea = fields.TargetArea ?? fields.targetArea;
                if (targetArea) {
                    console.log(`Warping to ${targetArea}...`);
                    // TO DO: 適切なシーン遷移 (例: WorldMapScene に戻る)
                    this.scene.start('WorldMapScene'); // 暫定
                } else {
                    console.log(`Warping to World Map...`);
                    this.scene.start('WorldMapScene');
                }
            }
        }

        // Zアイコンの表示制御 (チェックポイント優先、次にワープ)
        if (this.isAtCheckpoint && this.currentCheckpoint && !isDialogueOpen) {
            this.interactIcon.setPosition(this.currentCheckpoint.x, this.currentCheckpoint.y - 24).setVisible(true);
        } else if (this.isAtWarpdoor && this.currentWarpdoor && !isDialogueOpen) {
            this.interactIcon.setPosition(this.currentWarpdoor.x, this.currentWarpdoor.y - 24).setVisible(true);
        } else {
            this.interactIcon.setVisible(false);
        }

        // 1フレームごとにリセット（物理overlapで毎フレーム更新される）
        this.isAtCheckpoint = false;
        this.currentCheckpoint = undefined;
        this.isAtWarpdoor = false;
        this.currentWarpdoor = undefined;

        if (this.player && this.player.active) {
            const pointer = this.input.activePointer;
            const cam = this.cameras.main;
            const aim = this.player.getAimPos();

            // ロックされていない場合は、画面座標＋カメラスクロール（仕様書通り）
            if (!this.input.mouse?.locked) {
                aim.x = pointer.x / cam.zoom + cam.scrollX;
                aim.y = pointer.y / cam.zoom + cam.scrollY;
            }

            // カメラの見える範囲の端にクランプ
            const wv = cam.worldView;
            aim.x = Phaser.Math.Clamp(aim.x, wv.left, wv.right);
            aim.y = Phaser.Math.Clamp(aim.y, wv.top, wv.bottom);

            // UISceneのクロスヘアはUIScene.update()側でplayer.getAimPos()を直接読んで描画するため、ここでは何もしない
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

        // 敵の更新（HopperEnemyのジャンプタイマー等を動かすために必要）
        for (const enemy of this.enemies) {
            if (enemy.active) {
                enemy.update(time, delta);
            }
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

    }
}
