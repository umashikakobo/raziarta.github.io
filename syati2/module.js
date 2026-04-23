import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';

// --- 設定 ---
const config = {
    speed: 6.0,
    jump: 7.5,
    density: 0.4
};

let scene, camera, renderer, controls, world, playerBody;
let mapObjects = [];
const keys = { w: false, a: false, s: false, d: false };
let jumpCount = 0;
let isGrounded = false;
let isStarted = false;

const startScreen = document.getElementById('start-screen');
const heightDisplay = document.getElementById('height-display');

// ==========================================
// 起動トリガー（ここが不具合の核心）
// ==========================================
startScreen.addEventListener('click', () => {
    if (!isStarted) {
        // 1. UIを即座に消す
        startScreen.style.display = 'none';
        
        // 2. 初期化実行
        initGame();
        
        // 3. マウスロック要求
        controls.lock();
        isStarted = true;
        console.log("Game Started");
    } else {
        controls.lock();
    }
});

function initGame() {
    // Scene & Camera
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87CEEB);
    scene.fog = new THREE.Fog(0x87CEEB, 20, 250);

    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    document.body.appendChild(renderer.domElement);

    // Physics
    world = new OIMO.World({ gravity: [0, -20, 0], iterations: 8 });

    // Lights
    const ambient = new THREE.AmbientLight(0xffffff, 0.7);
    scene.add(ambient);
    const sun = new THREE.DirectionalLight(0xffffff, 1.0);
    sun.position.set(10, 500, 10);
    sun.castShadow = true;
    scene.add(sun);

    // Player Physics
    playerBody = world.add({ 
        type: 'capsule', size: [0.15, 0.25], pos: [9, 2, 9], 
        move: true, density: 1, friction: 0 
    });

    // Controls
    controls = new PointerLockControls(camera, document.body);

    // Events
    window.addEventListener('keydown', (e) => {
        if (e.code === 'KeyW') keys.w = true;
        if (e.code === 'KeyA') keys.a = true;
        if (e.code === 'KeyS') keys.s = true;
        if (e.code === 'KeyD') keys.d = true;
        if (e.code === 'Space') handleJump();
    });
    window.addEventListener('keyup', (e) => {
        if (e.code === 'KeyW') keys.w = false;
        if (e.code === 'KeyA') keys.a = false;
        if (e.code === 'KeyS') keys.s = false;
        if (e.code === 'KeyD') keys.d = false;
    });

    // Initial Map
    createFloor();
    requestGeneration(0, 150);

    animate();
}

function handleJump() {
    if (isGrounded) {
        playerBody.applyImpulse({x:0, y:0, z:0}, {x:0, y:config.jump, z:0});
        jumpCount = 1;
        isGrounded = false;
    } else if (jumpCount === 1) {
        const v = playerBody.getLinearVelocity();
        playerBody.setLinearVelocity(v.x, 0, v.z);
        playerBody.applyImpulse({x:0, y:0, z:0}, {x:0, y:config.jump * 0.7, z:0});
        jumpCount = 2;
    }
}

function animate() {
    requestAnimationFrame(animate);
    
    if (controls.isLocked) {
        world.step();
        
        const pos = playerBody.getPosition();
        const vel = playerBody.getLinearVelocity();

        // Ground check
        if (Math.abs(vel.y) < 0.01) {
            isGrounded = true;
            jumpCount = 0;
        }

        // Movement
        const fwd = new THREE.Vector3(0,0,-1).applyQuaternion(camera.quaternion);
        fwd.y = 0; fwd.normalize();
        const side = new THREE.Vector3().crossVectors(fwd, new THREE.Vector3(0,1,0)).normalize();

        let mx = 0, mz = 0;
        if (keys.w) { mx += fwd.x; mz += fwd.z; }
        if (keys.s) { mx -= fwd.x; mz -= fwd.z; }
        if (keys.d) { mx += side.x; mz += side.z; }
        if (keys.a) { mx -= side.x; mz -= side.z; }

        playerBody.setLinearVelocity(mx * config.speed, vel.y, mz * config.speed);
        playerBody.setQuaternion({x:0, y:0, z:0, w:1});

        camera.position.set(pos.x, pos.y + 0.3, pos.z);
        heightDisplay.innerText = `${Math.floor(pos.y)}m`;

        // Cleanup
        for (let i = mapObjects.length - 1; i >= 0; i--) {
            if (mapObjects[i].mesh.position.y < pos.y - 200) {
                scene.remove(mapObjects[i].mesh);
                world.remove(mapObjects[i].body);
                mapObjects.splice(i, 1);
            }
        }
    }
    renderer.render(scene, camera);
}

// --- Helpers ---
function createBlock(x, y, z) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1,1,1), new THREE.MeshLambertMaterial({color: 0xcccccc}));
    mesh.position.set(x, y, z);
    scene.add(mesh);
    const body = world.add({ type:'box', size:[1,1,1], pos:[x,y,z], move:false });
    mapObjects.push({ mesh, body });
}

function createFloor() {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(18,1,18), new THREE.MeshLambertMaterial({color:0x444444}));
    mesh.position.set(9, -0.5, 9);
    scene.add(mesh);
    world.add({ type:'box', size:[18,1,18], pos:[9,-0.5,9], move:false });
}

function requestGeneration(base, len) {
    // 簡易生成ロジック（Workerの代わりにメインスレッドで実行して確実に動かす）
    for (let i = 0; i < 100; i++) {
        createBlock(
            Math.floor(Math.random() * 18),
            base + Math.floor(Math.random() * len),
            Math.floor(Math.random() * 18)
        );
    }
}