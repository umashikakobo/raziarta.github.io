import Phaser from 'phaser';

import { TitleScene } from '../UI_worldmap_clear_gameover_other/TitleScene';
import { OpeningScene } from '../UI_worldmap_clear_gameover_other/OpeningScene';
import { WorldMapScene } from '../UI_worldmap_clear_gameover_other/WorldMapScene';
import { MainScene } from './MainScene';
import { UIScene } from '../UI_worldmap_clear_gameover_other/UIScene';

const config: Phaser.Types.Core.GameConfig = {
    type: Phaser.AUTO,
    width: 800,
    height: 450,
    parent: 'game-container',
    pixelArt: true,
    scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH
    },
    physics: {
        default: 'arcade',
        arcade: {
            gravity: { y: 0, x: 0 },
            fps: 240,
            debug: true
        }
    },
    scene: [TitleScene, OpeningScene, WorldMapScene, MainScene, UIScene],
    backgroundColor: '#000000',
};

new Phaser.Game(config);
