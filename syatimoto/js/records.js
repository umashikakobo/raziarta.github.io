// ═══════════════════════════════════════════════════════
//  records.js — 記録の保存と閲覧
// ═══════════════════════════════════════════════════════
'use strict';



const STORAGE_KEY = 'raziarta_ascent_records';

/**
 * 記録を保存する
 * @param {number} height 到達高度(m)
 * @param {number} timeSec かかった時間(秒)
 * @param {Array} laps ラップタイムの配列
 * @param {number} density ブロックの密度
 * @param {number} mapsize マップのサイズ
 * @param {number} seed シード値
 */
function saveRecord(height, timeSec, laps = [], density = 0.5, mapsize = 50, seed = 0) {
    const records = getRecords();
    const newRecord = {
        height: height,
        time: timeSec,
        laps: laps,
        density: density,
        mapsize: mapsize,
        seed: seed,
        date: new Date().toLocaleString('ja-JP', {
            year: 'numeric', month: '2-digit', day: '2-digit',
            hour: '2-digit', minute: '2-digit'
        }),
        playerName: 'YOU',
        mode: (typeof config !== 'undefined' && config.raceType === 'TIME TRIAL') ? 'TIME TRIAL' : 'COMBAT'
    };
    records.push(newRecord);
    // 高度降順 -> タイム昇順でソート
    records.sort((a, b) => b.height - a.height || a.time - b.time);
    // 最新100件のみ保持
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records.slice(0, 100)));
}

/**
 * 記録を取得する
 */
function getRecords() {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
}

// --- 記録閲覧UIのグローバル状態 ---
window._recordHeights = [];
window._currentHeightIndex = 0;
window._recordsMenuIdx = 0; // 0:GoalHeight, 1:Clear, 2:Back

// モードの初期設定（未設定時のみ）
window._selectedRecordMode = window._selectedRecordMode || 'TIME TRIAL';
window._selectedRecordView = window._selectedRecordView || 'SELF';

window.changeRecordMode = function(dir) {
    const modes = ['TIME TRIAL', 'COMBAT'];
    const currentIndex = modes.indexOf(window._selectedRecordMode || 'TIME TRIAL');
    const newIndex = Math.max(0, Math.min(modes.length - 1, currentIndex + dir));
    
    if (newIndex !== currentIndex) {
        window._selectedRecordMode = modes[newIndex];
        console.log("[Records] Mode changed to:", window._selectedRecordMode);
        renderRecordsContent();
    }
};

window.changeRecordView = function(dir) {
    const views = ['SELF', 'ALL'];
    const currentIndex = views.indexOf(window._selectedRecordView || 'SELF');
    const newIndex = Math.max(0, Math.min(views.length - 1, currentIndex + dir));
    
    if (newIndex !== currentIndex) {
        window._selectedRecordView = views[newIndex];
        console.log("[Records] View changed to:", window._selectedRecordView);
        
        // ALLに切り替わった時に自動読み込みを試行
        if (window._selectedRecordView === 'ALL' && typeof window.autoLoadGhostData === 'function') {
            window.autoLoadGhostData();
        }
        
        renderRecordsContent();
    }
};

/**
 * 記録を表示するUIを生成/更新する
 */
function showRecordsUI() {
    let container = document.getElementById('records-panel');
    if (!container) {
        container = document.createElement('div');
        container.id = 'records-panel';
        // 全画面の白/薄灰色ベースのWipeOut風スタイル
        container.style.cssText = `
            position: absolute;
            inset: 0;
            background: #f4f4f4;
            color: #111;
            z-index: 99999;
            font-family: 'Inter', 'Segoe UI', sans-serif;
            display: none;
            padding: 0;
            pointer-events: auto;
            user-select: none;
        `;
        document.body.appendChild(container);
    }

    // 開くたびに初期化（または維持）

    const records = getRecords();

    // 高度ごとにグループ化
    const grouped = {};
    records.forEach(r => {
        if (!grouped[r.height]) grouped[r.height] = [];
        grouped[r.height].push(r);
    });

    // ゴーストデータからも高度を収集
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('ghost_records_v3_')) {
            try {
                const parts = key.split('_');
                const h = parseInt(parts[4]); // v3_seed_height...
                if (!isNaN(h) && !grouped[h]) grouped[h] = [];
            } catch(e) {}
        }
    }

    window._recordHeights = Object.keys(grouped).map(Number).sort((a, b) => a - b); // 昇順 (50m, 100m...)
    if (window._recordHeights.length === 0) {
        window._recordHeights = [50]; // レコードがない場合のデフォルト
    }

    // 現在のインデックスをクランプ
    if (window._currentHeightIndex < 0) window._currentHeightIndex = 0;
    if (window._currentHeightIndex >= window._recordHeights.length) window._currentHeightIndex = window._recordHeights.length - 1;

    renderRecordsContent();
    container.style.display = 'block';
}

/**
 * UIの切り替え用
 */
window.changeRecordsHeight = function (dir) {
    if (window._recordHeights.length <= 1) return;
    window._currentHeightIndex = Math.max(0, Math.min(window._recordHeights.length - 1, window._currentHeightIndex + dir));
    renderRecordsContent();
};

window.closeRecordsUI = function () {
    const el = document.getElementById('records-panel');
    if (el) el.style.display = 'none';
};

window.clearAllRecords = function () {
    if (confirm('Clear all records?')) {
        localStorage.removeItem(STORAGE_KEY);
        showRecordsUI();
    }
};

/**
 * HTMLの描画更新
 */
function renderRecordsContent() {
    const container = document.getElementById('records-panel');
    if (!container) return;

    const records = getRecords();
    
    // ゴーストデータからも記録を抽出して合算する
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('ghost_records_v3_')) {
            try {
                const ghostData = JSON.parse(localStorage.getItem(key));
                if (Array.isArray(ghostData)) {
                    ghostData.forEach(r => {
                        const isDuplicate = records.some(existing => 
                            existing.time === r.time && 
                            existing.seed === r.seed && 
                            existing.height === r.goalHeight &&
                            (existing.playerName || 'YOU') === (r.playerName || 'YOU')
                        );
                        if (!isDuplicate) {
                            records.push({
                                ...r,
                                height: r.goalHeight,
                                mode: 'TIME TRIAL',
                                isGhost: true
                            });
                        }
                    });
                }
            } catch (e) {}
        }
    }

    const grouped = {};
    records.forEach(r => {
        if (!grouped[r.height]) grouped[r.height] = [];
        grouped[r.height].push(r);
    });

    const currentHeight = window._recordHeights[window._currentHeightIndex];
    const rawRecords = grouped[currentHeight] || [];

    // モード未設定時のガード
    const currentMode = window._selectedRecordMode || 'TIME TRIAL';
    const currentView = window._selectedRecordView || 'SELF';

    // 現在のモードとビューでフィルタリング
    const filteredByMode = rawRecords.filter(r => {
        const rMode = r.mode || 'COMBAT';
        if (rMode !== currentMode) return false;
        
        // 高度フィルタリング
        if (r.height !== currentHeight) return false;

        if (currentView === 'SELF') {
            const pName = r.playerName || 'YOU';
            if (pName !== 'YOU') return false;
        }
        return true;
    });

    // タイム順にソート
    filteredByMode.sort((a, b) => (a.elapsedPrecise || a.time) - (b.elapsedPrecise || b.time));
    const aggregated = filteredByMode;

    let html = `
        <div style="display: flex; flex-direction: column; height: 100%; width: calc(100% - 160px); position: relative;">
            <!-- Header -->
            <div class="menu-header" style="position: absolute; top: 20px; left: 80px; width: calc(100% - 160px); border-bottom-color: #111;">
                <div class="screen-title">■ SCREEN TITLE</div>
                <div class="main-title" style="color: #111;">RACE RECORDS</div>
            </div>

            <div style="display: flex; gap: 40px; overflow: hidden; flex: 1; margin-top: 140px; margin-left: 80px;">
                <!-- Sidebar -->
                <div style="width: 288px; display: flex; flex-direction: column; gap: 12px;">
                    <div style="font-size: 10px; font-weight: bold; color: #555; margin-bottom: -5px;">■ RECORDS</div>
                    
                    <!-- GAME MODE (index 0) -->
                    <div id="records-item-0" style="display: flex; gap: 5px; width: 100%; transition: opacity 0.2s;">
                        <div id="records-mode-plate" style="background: #555; color: white; font-weight: bold; font-size: 14px; padding: 8px 12px; width: 175px; transition: background 0.3s ease-out; display: flex; align-items: center; justify-content: space-between; flex-shrink: 0; clip-path: polygon(0 0, calc(100% - 8px) 0, 100% 8px, 100% 100%, 0 100%);">
                            <span>GAME MODE</span>
                            <div style="display: flex; gap: 6px; align-items: center;">
                                <span style="cursor:pointer; font-size: 10px; opacity: ${window._selectedRecordMode === 'TIME TRIAL' ? 0.1 : 0.8};" onclick="changeRecordMode(-1)">◀</span>
                                <span style="cursor:pointer; font-size: 10px; opacity: ${window._selectedRecordMode === 'COMBAT' ? 0.1 : 0.8};" onclick="changeRecordMode(1)">▶</span>
                            </div>
                        </div>
                        <div id="records-mode-box" style="background: #444; color: white; font-weight: bold; font-size: 14px; padding: 8px 12px; width: 108px; transition: width 0.3s ease-out, background 0.3s; display: flex; align-items: center; flex-shrink: 0; clip-path: polygon(0 0, calc(100% - 8px) 0, 100% 8px, 100% 100%, 0 100%);">
                            <span id="records-mode-text" style="font-family: 'Courier New', monospace; font-size: 11px;">${currentMode}</span>
                        </div>
                    </div>
                    
                    <!-- VIEW (index 1) -->
                    <div id="records-item-1" style="display: flex; gap: 5px; width: 100%; transition: opacity 0.2s;">
                        <div id="records-view-plate" style="background: #555; color: white; font-weight: bold; font-size: 14px; padding: 8px 12px; width: 175px; transition: background 0.3s ease-out; display: flex; align-items: center; justify-content: space-between; flex-shrink: 0; clip-path: polygon(0 0, calc(100% - 8px) 0, 100% 8px, 100% 100%, 0 100%);">
                            <span>VIEW</span>
                            <div style="display: flex; gap: 6px; align-items: center;">
                                <span style="cursor:pointer; font-size: 10px; opacity: ${window._selectedRecordView === 'SELF' ? 0.1 : 0.8};" onclick="changeRecordView(-1)">◀</span>
                                <span style="cursor:pointer; font-size: 10px; opacity: ${window._selectedRecordView === 'ALL' ? 0.1 : 0.8};" onclick="changeRecordView(1)">▶</span>
                            </div>
                        </div>
                        <div id="records-view-box" style="background: #444; color: white; font-weight: bold; font-size: 14px; padding: 8px 12px; width: 108px; transition: width 0.3s ease-out, background 0.3s; display: flex; align-items: center; flex-shrink: 0; clip-path: polygon(0 0, calc(100% - 8px) 0, 100% 8px, 100% 100%, 0 100%);">
                            <span id="records-view-text" style="font-family: 'Courier New', monospace; font-size: 11px;">${window._selectedRecordView || 'ALL'}</span>
                        </div>
                    </div>
                    
                    <!-- GOAL HEIGHT (index 2) -->
                    <div id="records-item-2" style="display: flex; gap: 5px; width: 100%; transition: opacity 0.2s;">
                        <div id="records-label-plate" style="background: #555; color: white; font-weight: bold; font-size: 14px; padding: 8px 12px; width: 175px; transition: background 0.3s ease-out; display: flex; align-items: center; justify-content: space-between; flex-shrink: 0; clip-path: polygon(0 0, calc(100% - 8px) 0, 100% 8px, 100% 100%, 0 100%);">
                            <span>GOAL HEIGHT</span>
                            <div style="display: flex; gap: 6px; align-items: center;">
                                <span style="cursor:pointer; font-size: 10px; opacity: ${window._currentHeightIndex === 0 ? 0.1 : 0.8};" onclick="changeRecordsHeight(-1)">◀</span>
                                <span style="cursor:pointer; font-size: 10px; opacity: ${window._currentHeightIndex === window._recordHeights.length - 1 ? 0.1 : 0.8};" onclick="changeRecordsHeight(1)">▶</span>
                            </div>
                        </div>
                        <div id="records-height-box" style="background: #444; color: white; font-weight: bold; font-size: 14px; padding: 8px 12px; width: 108px; transition: width 0.3s ease-out, background 0.3s; display: flex; align-items: center; flex-shrink: 0; clip-path: polygon(0 0, calc(100% - 8px) 0, 100% 8px, 100% 100%, 0 100%);">
                            <span id="records-height-text" style="font-family: 'Courier New', monospace;">${currentHeight}m</span>
                        </div>
                    </div>

                    <div style="flex: 1;"></div> <!-- spacer -->

                    <div style="margin-bottom: 45px; display: flex; flex-direction: column; gap: 8px;">
                        <!-- EXPORT (index 3) -->
                        <button id="records-item-3" onclick="window.exportGhostData()" style="background: #111; color: white; border: none; padding: 10px 12px; font-weight: bold; cursor: pointer; text-align: left; font-size: 12px; width: 288px; transition: width 0.3s ease-out, background 0.3s; flex-shrink: 0; clip-path: polygon(0 0, calc(100% - 8px) 0, 100% 8px, 100% 100%, 0 100%);">
                            ■ EXPORT ALL GHOST DATA
                        </button>
                        <!-- CLEAR (index 4) -->
                        <button id="records-item-4" onclick="clearAllRecords()" style="background: #ddd; color: #475569; border: none; padding: 10px 12px; font-weight: bold; cursor: pointer; text-align: left; font-size: 12px; width: 288px; transition: width 0.3s ease-out, background 0.3s; flex-shrink: 0; clip-path: polygon(0 0, calc(100% - 8px) 0, 100% 8px, 100% 100%, 0 100%);">
                            ■ CLEAR ALL RECORDS
                        </button>
                        <!-- BACK (index 5) -->
                        <button id="records-item-5" onclick="closeRecordsUI()" style="background: #111; color: white; border: none; padding: 12px; font-weight: bold; cursor: pointer; font-size: 15px; letter-spacing: 1px; width: 288px; transition: width 0.3s ease-out, background 0.3s; flex-shrink: 0; clip-path: polygon(0 0, calc(100% - 8px) 0, 100% 8px, 100% 100%, 0 100%);">
                            BACK TO MENU
                        </button>
                    </div>
                </div>

                <!-- Right Table -->
                <div style="flex: 1; display: flex; flex-direction: column; overflow: hidden;">
                    <div style="text-align: right; font-size: 12px; font-weight: bold; margin-bottom: 5px; color: #333;">
                        ${filteredByMode.length} RECORDS SHOWN
                    </div>
                    <div style="flex: 1; overflow-y: auto;">
                        <table style="width: 100%; border-collapse: collapse; font-size: 14px; font-weight: bold;">
                            <tr style="background: #111; color: white; text-align: left;">
                                <th style="padding: 10px 12px; width: 60px; border-right: 1px solid #333; white-space: nowrap;">▸ POS</th>
                                <th style="padding: 10px 12px; width: 120px; border-right: 1px solid #333; white-space: nowrap;">▸ TIME</th>
                                <th style="padding: 10px 12px; width: 120px; border-right: 1px solid #333; white-space: nowrap;">▸ NAME</th>
                                <th style="padding: 10px 12px; width: 150px; border-right: 1px solid #333; white-space: nowrap;">▸ DATE</th>
                                <th style="padding: 10px 12px; width: 100px; border-right: 1px solid #333; white-space: nowrap;">▸ DENSITY</th>
                                <th style="padding: 10px 12px; width: 80px; border-right: 1px solid #333; white-space: nowrap;">▸ SEED</th>
                                <th style="padding: 10px 12px; white-space: nowrap;">▸ MAPSIZE</th>
                            </tr>
    `;

    if (aggregated.length === 0) {
        html += `<tr><td colspan="7" style="padding: 30px; text-align: center; color: #888;">NO RECORDS FOR THIS HEIGHT</td></tr>`;
    } else {
        aggregated.forEach((r, idx) => {
            const formatTime = (sec) => {
                const m = Math.floor(sec / 60);
                const s = (sec % 60).toFixed(2);
                return `${m}:${s.padStart(5, '0')}`;
            };
            const timeStr = formatTime(r.elapsedPrecise || r.time);
            const bgColor = (idx % 2 === 0) ? '#f4f4f4' : '#fff';
            
            const pName = r.playerName || 'YOU';
            const nameColor = (pName === 'YOU') ? '#0ea5e9' : '#e63946';

            // 古い記録にはdensityがない場合があるのでフォールバック
            const densStr = (r.density !== undefined) ? Number(r.density).toFixed(2) : '-';
            const sizeStr = (r.mapsize !== undefined) ? r.mapsize : (r.areaSize || '-');
            const seedStr = (r.seed !== undefined) ? r.seed : '-';

            // ラップタイム表示
            let lapsHtml = '';
            if (r.laps && r.laps.length > 0) {
                lapsHtml = `<div style="display: grid; grid-template-columns: repeat(4, 1fr); border-top: 1px solid #ddd; font-size: 11px; color: #666; font-family: monospace;">`;
                let prevTime = 0;
                r.laps.forEach((lap, lIdx) => {
                    const split = lap.time - prevTime;
                    prevTime = lap.time;
                    const cumTimeStr = formatTime(lap.time);
                    const splitStr = split.toFixed(2);
                    const borderLeft = (lIdx % 4 !== 0) ? 'border-left: 1px solid #eee;' : '';
                    const borderTop = (lIdx >= 4) ? 'border-top: 1px solid #eee;' : '';
                    lapsHtml += `<div style="padding: 8px 4px; ${borderLeft} ${borderTop} text-align: center; background: rgba(0,0,0,0.02); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                        <span style="font-size: 9px; opacity: 0.6; color: #888;">${lap.distance}m</span>
                        <span style="font-weight: bold; margin: 0 4px; color: #111;">${cumTimeStr}</span>
                        <span style="font-size: 10px; color: #e60000; font-style: italic;">(+${splitStr}s)</span>
                    </div>`;
                });
                lapsHtml += `</div>`;
            }

            html += `
                <tr style="background: ${bgColor}; color: #333;">
                    <td style="padding: 8px 12px; vertical-align: middle; font-size: 16px; border-right: 1px solid #eee;">${idx + 1}</td>
                    <td style="padding: 8px 12px; vertical-align: middle; border-right: 1px solid #eee;">
                        <div style="font-size: 16px; color: #e60000; font-family: monospace; font-weight: bold;">${timeStr}</div>
                    </td>
                    <td style="padding: 8px 12px; vertical-align: middle; font-size: 13px; color: ${nameColor}; font-weight: bold; border-right: 1px solid #eee; overflow: hidden; text-overflow: ellipsis; max-width: 120px;">${pName}</td>
                    <td style="padding: 8px 12px; vertical-align: middle; font-size: 13px; color: #666; border-right: 1px solid #eee;">${r.date || '---'}</td>
                    <td style="padding: 8px 12px; vertical-align: middle; font-size: 13px; color: #666; border-right: 1px solid #eee;">${densStr}</td>
                    <td style="padding: 8px 12px; vertical-align: middle; font-size: 13px; color: #666; border-right: 1px solid #eee;">${seedStr}</td>
                    <td style="padding: 8px 12px; vertical-align: middle; font-size: 13px; color: #666;">${sizeStr}</td>
                </tr>
            `;

            if (lapsHtml) {
                html += `
                <tr style="background: ${bgColor}; border-bottom: 13px solid #f4f4f4;">
                    <td colspan="7" style="padding: 0 12px 0 12px;">
                        ${lapsHtml}
                    </td>
                </tr>
                `;
            } else {
                html += `<tr style="border-bottom: 3px solid #f4f4f4;"></tr>`;
            }
        });
    }

    html += `
                        </table>
                    </div>
                </div>
            </div>
        </div>
    `;

    container.innerHTML = html;

    // 初回のビジュアル適用
    updateRecordsMenuVisual();
}

/**
 * レコード画面のサイドバー選択ビジュアルのみを更新 (アニメーション用)
 */
function updateRecordsMenuVisual() {
    const items = [
        document.getElementById('records-item-0'),
        document.getElementById('records-item-1'),
        document.getElementById('records-item-2'),
        document.getElementById('records-item-3'),
        document.getElementById('records-item-4'),
        document.getElementById('records-item-5'),
        document.getElementById('records-item-6')
    ];

    items.forEach((el, idx) => {
        if (!el) return;
        const isActive = (idx === window._recordsMenuIdx);

        if (idx === 0) { // GAME MODE
            const plate = document.getElementById('records-mode-plate');
            const box = document.getElementById('records-mode-box');
            if (plate) {
                plate.style.background = isActive ? '#0ea5e9' : '#555';
                plate.style.width = '175px';
            }
            if (box) {
                box.style.background = isActive ? '#0284c7' : '#444';
                box.style.width = isActive ? '125px' : '108px';
            }
        } else if (idx === 1) { // VIEW
            const plate = document.getElementById('records-view-plate');
            const box = document.getElementById('records-view-box');
            if (plate) {
                plate.style.background = isActive ? '#0ea5e9' : '#555';
                plate.style.width = '175px';
            }
            if (box) {
                box.style.background = isActive ? '#0284c7' : '#444';
                box.style.width = isActive ? '125px' : '108px';
            }
        } else if (idx === 2) { // GOAL HEIGHT
            const plate = document.getElementById('records-label-plate');
            const box = document.getElementById('records-height-box');
            if (plate) {
                plate.style.background = isActive ? '#0ea5e9' : '#555';
                plate.style.width = '175px';
            }
            if (box) {
                box.style.background = isActive ? '#0284c7' : '#444';
                box.style.width = isActive ? '125px' : '108px';
            }
        } else if (idx === 3) { // EXPORT
            el.style.background = isActive ? '#0ea5e9' : '#111';
            el.style.color = '#fff';
            el.style.width = isActive ? '320px' : '288px';
        } else if (idx === 4) { // CLEAR
            el.style.background = isActive ? '#0ea5e9' : '#ddd';
            el.style.color = isActive ? '#fff' : '#475569';
            el.style.width = isActive ? '320px' : '288px';
        } else if (idx === 5) { // BACK
            el.style.background = isActive ? '#0ea5e9' : '#111';
            el.style.width = isActive ? '320px' : '288px';
        }

        el.style.zIndex = isActive ? '10' : '1';
    });
}

/**
 * レコード画面用のキーボード操作ハンドラ
 */
window.handleRecordsKey = function (e) {
    const TOTAL_ITEMS = 6;
    if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
        window._recordsMenuIdx = (window._recordsMenuIdx - 1 + TOTAL_ITEMS) % TOTAL_ITEMS;
        updateRecordsMenuVisual();
    } else if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') {
        window._recordsMenuIdx = (window._recordsMenuIdx + 1) % TOTAL_ITEMS;
        updateRecordsMenuVisual();
    } else if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
        if (window._recordsMenuIdx === 0) {
            changeRecordMode(-1);
        } else if (window._recordsMenuIdx === 1) {
            changeRecordView(-1);
        } else if (window._recordsMenuIdx === 2) {
            changeRecordsHeight(-1);
            const heightText = document.getElementById('records-height-text');
            if (heightText) heightText.innerText = window._recordHeights[window._currentHeightIndex] + 'm';
        }
    } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
        if (window._recordsMenuIdx === 0) {
            changeRecordMode(1);
        } else if (window._recordsMenuIdx === 1) {
            changeRecordView(1);
        } else if (window._recordsMenuIdx === 2) {
            changeRecordsHeight(1);
            const heightText = document.getElementById('records-height-text');
            if (heightText) heightText.innerText = window._recordHeights[window._currentHeightIndex] + 'm';
        }
    } else if (e.key === 'Enter' || e.key === ' ') {
        if (window._recordsMenuIdx === 3) {
            window.exportGhostData();
        } else if (window._recordsMenuIdx === 4) {
            clearAllRecords();
        } else if (window._recordsMenuIdx === 5) {
            closeRecordsUI();
        }
    } else if (e.key === 'Escape') {
        closeRecordsUI();
    }
};
