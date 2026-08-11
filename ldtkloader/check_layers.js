const fs = require('fs');

const data = JSON.parse(fs.readFileSync('public/Ldtk/stage1.ldtk', 'utf-8'));
for (const level of data.levels) {
    console.log(`Level: ${level.identifier}`);
    for (const layer of level.layerInstances) {
        let tileCount = 0;
        if (layer.autoLayerTiles) tileCount += layer.autoLayerTiles.length;
        if (layer.gridTiles) tileCount += layer.gridTiles.length;
        console.log(`  Layer: ${layer.__identifier} (type: ${layer.__type}) - Tiles: ${tileCount}`);
    }
}
