// ai_core.js - TensorFlow.js AI Integration

// グローバルスコープでアクセスできるようにvarを使用
var aiModel = null;
var aiReplayBuffer = [];
const AI_MAX_BUFFER_SIZE = 500000;
const AI_STATE_SIZE = 20; // 拡張された入力層
const AI_ACTION_SIZE = 5; // [mx, mz, jump, shoot_bullet, shoot_bubble]

// 初期化
async function initAIModel() {
    if (aiModel) return; // 既にロード・初期化済みの場合はスキップ

    aiModel = tf.sequential();
    // 入力層の明示化と強化（層のユニット数を増やし、層を深くする）
    aiModel.add(tf.layers.inputLayer({ inputShape: [AI_STATE_SIZE] }));
    aiModel.add(tf.layers.dense({ units: 128, activation: 'relu' }));
    aiModel.add(tf.layers.dense({ units: 128, activation: 'relu' }));
    aiModel.add(tf.layers.dense({ units: 64, activation: 'relu' }));
    aiModel.add(tf.layers.dense({ units: AI_ACTION_SIZE, activation: 'tanh' })); // -1.0 to 1.0 range
    
    // コンパイル
    aiModel.compile({ optimizer: tf.train.adam(0.001), loss: 'meanSquaredError' });
    console.log("[AI Core] TensorFlow.js Neural Network initialized with 20 inputs.");
}

// スクリプト読み込み時に即座に初期化
initAIModel();

// 状態の取得
function getAIObservation(ent, playerBody) {
    const pos = ent.body.position;
    const vel = ent.body.linearVelocity;
    
    let tx = pos.x, ty = pos.y + 10, tz = pos.z;
    if (ent.targetPos) {
        tx = ent.targetPos.x; ty = ent.targetPos.y; tz = ent.targetPos.z;
    }

    const px = playerBody ? playerBody.position.x : pos.x;
    const py = playerBody ? playerBody.position.y : pos.y;
    const pz = playerBody ? playerBody.position.z : pos.z;

    const lastMx = ent.lastMx || 0;
    const lastMz = ent.lastMz || 0;
    const jumpTimer = ent.jumpTimer || 0;

    let angle = 0;
    if (ent.mesh && ent.mesh.rotation) {
        angle = ent.mesh.rotation.y;
    }
    const dirX = Math.sin(angle);
    const dirZ = Math.cos(angle);

    return [
        pos.x / 50, pos.y / 100, pos.z / 50, // 自身の座標
        vel.x / 10, vel.y / 10, vel.z / 10, // 自身の速度
        (tx - pos.x) / 10, (ty - pos.y) / 10, (tz - pos.z) / 10, // ターゲットへの相対座標
        (px - pos.x) / 50, (py - pos.y) / 50, (pz - pos.z) / 50, // プレイヤーへの相対座標
        lastMx / 5, lastMz / 5, // wasd (前回の移動入力)
        jumpTimer / 10, // jump(押し時間)
        dirX, dirZ, // 向き
        tx / 50, ty / 100, tz / 50 // ジャンプする土台の絶対座標
    ];
}

// 行動の予測
function predictAIAction(state) {
    if (!aiModel) return [0, 0, 0, 0, 0];
    
    return tf.tidy(() => {
        const stateTensor = tf.tensor2d([state]);
        const prediction = aiModel.predict(stateTensor);
        return Array.from(prediction.dataSync());
    });
}

// 学習データの収集
function collectAIExperience(state, action, reward, nextState) {
    if (aiReplayBuffer.length >= AI_MAX_BUFFER_SIZE) {
        aiReplayBuffer.shift();
    }
    aiReplayBuffer.push({ state, action, reward, nextState });
}

// 学習の実行（集めた経験からバッチ学習）
async function trainAIModel() {
    try {
        if (!aiModel) {
            alert("AIモデルが初期化されていません。");
            return;
        }
        if (aiReplayBuffer.length < 32) {
            alert("学習データが足りません。現在のデータ数: " + aiReplayBuffer.length + " (最低32必要)。もう少しAIに行動させてください。");
            return;
        }
        
        document.getElementById('ai-train-status').innerText = "学習中...";
        console.log(`[AI Core] Training on ${aiReplayBuffer.length} samples...`);

        // 簡易的な方策勾配/Q学習の模倣
        const states = aiReplayBuffer.map(e => e.state);
        const targets = aiReplayBuffer.map(e => {
            return e.action.map(a => a * (1 + e.reward * 0.1)); 
        });

        const statesTensor = tf.tensor2d(states);
        const targetsTensor = tf.tensor2d(targets);

        await aiModel.fit(statesTensor, targetsTensor, {
            epochs: 5,
            batchSize: 32,
            shuffle: true,
            callbacks: {
                onEpochEnd: (epoch, logs) => console.log(`Epoch ${epoch}: loss = ${logs.loss.toFixed(4)}`)
            }
        });

        statesTensor.dispose();
        targetsTensor.dispose();
        
        document.getElementById('ai-train-status').innerText = "学習完了 (Loss: " + aiModel.history?.history?.loss?.[0]?.toFixed(4) + ")";
        console.log("[AI Core] Training complete.");
        alert("学習が完了しました！");
    } catch (e) {
        console.error("Training Error:", e);
        alert("学習中にエラーが発生しました: " + e.message);
        document.getElementById('ai-train-status').innerText = "学習エラー";
    }
}

// モデルの保存（ブラウザ内）
async function saveAIModelLocally() {
    if (!aiModel) {
        alert("保存するAIモデルがありません。");
        return;
    }
    try {
        await aiModel.save('localstorage://rival-sphere-model');
        alert("モデルをブラウザ(LocalStorage)に保存しました。");
    } catch(e) {
        alert("保存に失敗しました: " + e.message);
    }
}

// モデルの読み込み（ブラウザ内）
async function loadAIModelLocally() {
    try {
        const loadedModel = await tf.loadLayersModel('localstorage://rival-sphere-model');
        aiModel = loadedModel;
        aiModel.compile({ optimizer: tf.train.adam(0.001), loss: 'meanSquaredError' });
        alert("ブラウザからモデルを読み込みました。");
        console.log("[AI Core] Model loaded from LocalStorage.");
        document.getElementById('ai-train-status').innerText = "モデルロード済";
    } catch (e) {
        alert("保存されたモデルが見つからないか、読み込みに失敗しました。");
        console.error(e);
    }
}

// モデルのエクスポート（ファイルとしてダウンロード）
async function downloadAIModel() {
    if (!aiModel) {
        alert("ダウンロードするAIモデルがありません。");
        return;
    }
    try {
        await aiModel.save('downloads://rival-sphere-model');
        alert("モデルファイル(JSON/BIN)をダウンロードしました。\nmodel/ai/ フォルダに配置して読み込ませることができます。");
    } catch(e) {
        alert("ダウンロードに失敗しました: " + e.message);
    }
}
