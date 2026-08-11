const fs = require('fs');
const ldtk = JSON.parse(fs.readFileSync('public/Ldtk/stage1.ldtk', 'utf-8'));
const identifiers = new Set();

for (const level of ldtk.levels) {
    for (const layer of level.layerInstances) {
        if (layer.__type === 'Entities') {
            for (const entity of layer.entityInstances) {
                identifiers.add(entity.__identifier);
            }
        }
    }
}
fs.writeFileSync('entity_identifiers.txt', Array.from(identifiers).join('\n'));
