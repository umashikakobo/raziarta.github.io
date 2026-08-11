import Phaser from 'phaser';

/**
 * LDtk JSON からタイルセット定義を取得するユーティリティ
 */
interface TilesetDef {
    uid: number;
    identifier: string;
    relPath: string | null;
    pxWid: number;
    pxHei: number;
    tileGridSize: number;
    spacing: number;
    padding: number;
    __cWid: number; // columns
}

export interface ParseResult {
    minX: number;
    minY: number;
    levelPxWid: number;
    levelPxHei: number;
    entities: EntityData[];
    collisionLayers: Phaser.Tilemaps.TilemapLayer[];
}

export interface EntityData {
    iid: string;
    identifier: string;
    x: number;
    y: number;
    width: number;
    height: number;
    pivot: [number, number];
    fields: Record<string, any>;
    textureKey?: string;
    frameIndex?: number;
    levelWorldX: number;
    levelWorldY: number;
    gridSize: number;
}

export class LdtkParser {

    /**
     * LDtk JSON の全タイルセット定義を取得し、Phaser にロード指示を出す (preload フェーズで呼ぶ)
     */
    static preloadTilesets(scene: Phaser.Scene, ldtkData: any, basePath: string) {
        const tilesetDefs: TilesetDef[] = ldtkData.defs?.tilesets ?? [];
        for (const ts of tilesetDefs) {
            if (!ts.relPath) continue; // 内蔵アトラスはスキップ
            // LDtk の relPath は "../../Assets_image_resource/..." のような相対パスなので、
            // public フォルダ内のパスに変換
            const resolvedPath = LdtkParser.resolveRelPath(ts.relPath, basePath);
            console.log(`[LdtkParser] Loading tileset "${ts.identifier}" (uid=${ts.uid}) from: ${resolvedPath} (grid=${ts.tileGridSize}, spacing=${ts.spacing}, padding=${ts.padding})`);
            scene.load.spritesheet(`tileset_${ts.uid}`, resolvedPath, {
                frameWidth: ts.tileGridSize,
                frameHeight: ts.tileGridSize,
                spacing: ts.spacing,
                margin: ts.padding,
            });
        }
    }

    /**
     * LDtk JSON のレベルを描画する (create フェーズで呼ぶ)
     */
    static renderAllLevels(scene: Phaser.Scene, ldtkData: any): ParseResult | null {
        if (!ldtkData.levels || ldtkData.levels.length === 0) return null;

        const tilesetDefs: TilesetDef[] = ldtkData.defs?.tilesets ?? [];
        const tilesetMap = new Map<number, TilesetDef>();
        for (const ts of tilesetDefs) {
            tilesetMap.set(ts.uid, ts);
        }

        const entities: EntityData[] = [];
        const collisionLayers: Phaser.Tilemaps.TilemapLayer[] = [];
        let tileCount = 0;
        let minX = Infinity;
        let minY = Infinity;
        let maxX = -Infinity;
        let maxY = -Infinity;

        // まず全体の境界を計算
        for (const level of ldtkData.levels) {
            const levelWorldX = level.worldX || 0;
            const levelWorldY = level.worldY || 0;

            minX = Math.min(minX, levelWorldX);
            minY = Math.min(minY, levelWorldY);
            maxX = Math.max(maxX, levelWorldX + level.pxWid);
            maxY = Math.max(maxY, levelWorldY + level.pxHei);
        }

        const levelPxWid = isFinite(maxX) && isFinite(minX) ? maxX - minX : 0;
        const levelPxHei = isFinite(maxY) && isFinite(minY) ? maxY - minY : 0;

        // すべてのレベルをループ
        for (const level of ldtkData.levels) {
            const levelWorldX = level.worldX || 0;
            const levelWorldY = level.worldY || 0;

            // LDtkはレイヤーを上から順（手前→奥）に保存。描画は奥→手前にする必要がある
            const layers = [...level.layerInstances].reverse();

            for (const layer of layers) {
                if (layer.__type === 'Entities') {
                    // エンティティ（プレイヤー、敵、ゴールなど）
                    for (const ei of layer.entityInstances) {
                        let textureKey: string | undefined;
                        let frameIndex: number | undefined;

                        if (ei.__tile) {
                            const tUid = ei.__tile.tilesetUid;
                            const tsDef = tilesetMap.get(tUid);
                            if (tsDef) {
                                textureKey = `tileset_${tUid}`;
                                frameIndex = LdtkParser.srcToFrameIndex(ei.__tile.x, ei.__tile.y, tsDef);
                            }
                        }

                        entities.push({
                            iid: ei.iid,
                            identifier: ei.__identifier,
                            x: ei.px[0] + levelWorldX,
                            y: ei.px[1] + levelWorldY,
                            width: ei.width,
                            height: ei.height,
                            pivot: ei.__pivot,
                            fields: LdtkParser.parseFields(ei.fieldInstances),
                            textureKey,
                            frameIndex,
                            levelWorldX,
                            levelWorldY,
                            gridSize: layer.__gridSize,
                        });
                    }
                    continue;
                }

                // Tiles / IntGrid / AutoLayer
                const tilesetUid = layer.__tilesetDefUid;
                if (!tilesetUid) continue;
                const tsDef = tilesetMap.get(tilesetUid);
                if (!tsDef || !tsDef.relPath) continue;

                const gridSize = layer.__gridSize;
                const textureKey = `tileset_${tilesetUid}`;

                // gridTiles と autoLayerTiles の両方を処理
                const allTiles = [
                    ...(layer.autoLayerTiles ?? []),
                    ...(layer.gridTiles ?? []),
                ];

                if (allTiles.length === 0) continue;

                // このレイヤーが当たり判定を持つか
                const isSolid = layer.__identifier.includes('AutoLayer') || layer.__identifier.includes('IntGrid') || layer.__identifier.includes('Tiles');
                console.log(`[LdtkParser] Layer: ${layer.__identifier} (type: ${layer.__type}) - Tiles: ${allTiles.length}, isSolid: ${isSolid}`);

                // PhaserのTilemapを作成
                const map = scene.make.tilemap({
                    tileWidth: gridSize,
                    tileHeight: gridSize,
                    width: layer.__cWid,
                    height: layer.__cHei
                });

                // スプライトシートとして読み込んでいるため、tilesetImageを設定
                const tileset = map.addTilesetImage(textureKey, textureKey, tsDef.tileGridSize, tsDef.tileGridSize, tsDef.padding, tsDef.spacing);
                if (!tileset) continue;

                const tilemapLayer = map.createBlankLayer(`${level.identifier}_${layer.__identifier}`, tileset, levelWorldX, levelWorldY);
                if (!tilemapLayer) continue;

                for (const tile of allTiles) {
                    const srcX = tile.src[0];
                    const srcY = tile.src[1];
                    const col = Math.floor(tile.px[0] / gridSize);
                    const row = Math.floor(tile.px[1] / gridSize);

                    // タイルIDを計算 (spacing と padding 考慮)
                    const tileId = LdtkParser.srcToFrameIndex(srcX, srcY, tsDef);

                    const t = tilemapLayer.putTileAt(tileId, col, row);
                    if (t) {
                        // 反転 (f: 0=なし, 1=X反転, 2=Y反転, 3=XY反転)
                        if (tile.f === 1 || tile.f === 3) t.flipX = true;
                        if (tile.f === 2 || tile.f === 3) t.flipY = true;
                        // 透明度
                        if (tile.a !== undefined && tile.a < 1) t.alpha = tile.a;
                    }
                    tileCount++;
                }

                if (isSolid) {
                    tilemapLayer.setCollisionByExclusion([-1]);
                    collisionLayers.push(tilemapLayer);
                }
            }
        }

        console.log(`[LdtkParser] Rendered ${tileCount} tiles using Tilemap API, found ${entities.length} entities.`);

        return {
            minX,
            minY,
            levelPxWid,
            levelPxHei,
            entities,
            collisionLayers,
        };
    }

    /**
     * ピクセル座標 (srcX, srcY) をスプライトシートのフレームインデックスに変換
     */
    private static srcToFrameIndex(srcX: number, srcY: number, ts: TilesetDef): number {
        const step = ts.tileGridSize + ts.spacing;
        const col = Math.round((srcX - ts.padding) / step);
        const row = Math.round((srcY - ts.padding) / step);
        return row * ts.__cWid + col;
    }

    /**
     * LDtk の相対パスを public フォルダ内の絶対パスに変換
     */
    private static resolveRelPath(relPath: string, basePath: string): string {
        const parts = basePath.split('/').filter(p => p);
        const relParts = relPath.split('/');
        for (const rp of relParts) {
            if (rp === '..') {
                parts.pop();
            } else if (rp !== '.') {
                parts.push(rp);
            }
        }
        return '/' + parts.join('/');
    }

    /**
     * フィールドインスタンスをシンプルな key-value に変換
     */
    private static parseFields(fieldInstances: any[]): Record<string, any> {
        const result: Record<string, any> = {};
        if (!fieldInstances) return result;
        for (const f of fieldInstances) {
            result[f.__identifier] = f.__value;
        }
        return result;
    }
}
