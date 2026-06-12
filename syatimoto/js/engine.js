// ═══════════════════════════════════════════════════════
//  engine.js — メインゲームループ (animate)
//  元の変数名はそのまま維持（G.経由ではなくグローバル参照）
//  ※ index.html から読み込む順番で依存関係を解決
// ═══════════════════════════════════════════════════════
'use strict';

// ── 毎フレーム再利用する一時オブジェクト（GC圧力削減） ──
const _tmpQ = new THREE.Quaternion();
const _tmpAxisY = new THREE.Vector3(0, 1, 0);
const _tmpFwd = new THREE.Vector3();
const _tmpRight = new THREE.Vector3();
const _tmpOffset = new THREE.Vector3();
const _tmpDp = new THREE.Vector3();
let _rewardScreenEl = null;

let _syncCounter = 0;
let _posSyncCounter = 0;

function animate() {
    if (!G.isStarted) return;
    G.animFrameId = requestAnimationFrame(animate);

    const now = performance.now();
    if (G.lastAnimTime === 0) G.lastAnimTime = now;
    let frameTime = (now - G.lastAnimTime) / 1000;
    
    // 負荷スパイク時の「死の渦」回避（最低4FPSまでは追従）
    if (frameTime > 0.25) frameTime = 0.25; 
    G.lastAnimTime = now;

    // 時間を蓄積
    G.logicAccumulator += frameTime;
    
    // 蓄積した時間が 1/60秒（固定ステップ）を超えるたびに、ロジックを更新
    const FIXED_STEP = 1 / 60;
    while (G.logicAccumulator >= FIXED_STEP) {
        updateFixedLogic(FIXED_STEP);
        G.logicAccumulator -= FIXED_STEP;
    }
    
    // --- 【可変フレーム描画】 (FPSが高いほど滑らかに表示される) ---
    renderVisuals(frameTime);
}

function updateFixedLogic(dt) {
    G.bubbles.forEach(b => { b._hitFlag = false; b._hitBody = null; });
    G.bubbles.forEach(b => {
        if (b.body) {
            b.body.linearVelocity.y = b.speedY || 5.0;
            b.body.linearVelocity.x *= 0.987;
            b.body.linearVelocity.z *= 0.987;
        } else {
            b.mesh.position.y += (b.speedY || 5.0) * dt;
        }
    });

    if (G.world) {
        G.world.step();
    }

    // シャボン玉衝突判定
    if (G.isHost || !G.isOnline) {
        G.bubbles.forEach(b => {
            if (b._hitFlag) return;
            let link = b.body.contactLink;
            while (link) {
                if (link.contact && link.contact.touching) {
                    const other = (link.contact.body1 === b.body) ? link.contact.body2 : link.contact.body1;
                    if (!(other.belongsTo & 1) && other !== b.ownerBody) {
                        let isInvincible = false;
                        if (other === G.playerBody && G.isInvincible) isInvincible = true;
                        for (const [peerId, netEnt] of G.networkEntities) {
                            if (netEnt.body === other && netEnt.isInvincible) { isInvincible = true; break; }
                        }
                        if (isInvincible) { link = link.next; continue; }

                        b._hitFlag = true;
                        b._hitBody = other;

                        // 1. AI判定
                        G.entities.forEach(ent => {
                            if (ent.isAI && ent.body === other) {
                                const bDamage = b.props ? b.props.damage : config.damageBubble;
                                ent.lives = (ent.lives === undefined ? config.maxLives : ent.lives) - bDamage;
                                if (ent.lives <= 0) {
                                    ent.isDead = true; ent.deathTimer = 3.0;
                                    const ch = ent.body.position.y;
                                    ent.body.resetPosition(config.areaSize/2, Math.max(0, Math.floor((ch-1)/100)*100) + 2.0, config.areaSize/2);
                                    ent.body.linearVelocity.set(0,0,0); ent.lives = config.maxLives;
                                }
                            }
                        });

                        // 2. 自機判定
                        if (other === G.playerBody) {
                            takeDamage(b.props ? b.props.damage : config.damageBubble, b.ownerId || resolveName(b.ownerBody));
                        }
                        break;
                    }
                }
                link = link.next;
            }
        });
    }

    // 死亡処理（タイマー更新と物理停止）
    if (G.isDead) {
        G.deathTimer -= dt;
        if (!G._deathDebugFrame) G._deathDebugFrame = 0;
        G._deathDebugFrame++;
        if (G._deathDebugFrame % 30 === 0) {
            console.log(`[DEATH] timer=${G.deathTimer.toFixed(3)}, isDead=${G.isDead}`);
        }
        if (G.deathTimer <= 0) {
            respawnPlayer();
        } else if (G.deathTextEl) {
            G.deathTextEl.innerText = 'YOU DIED\n' + G.deathTimer.toFixed(1) + 's';
        }
        if (G.playerBody) {
            G.playerBody.linearVelocity.set(0, 0, 0);
            if (G.playerBody.angularVelocity) { G.playerBody.angularVelocity.x=0; G.playerBody.angularVelocity.y=0; G.playerBody.angularVelocity.z=0; }
        }
    }

    if (!G.playerBody) return;

    const pos = G.playerBody.position;
    const vel = G.playerBody.linearVelocity;
    if (G.playerBody.quaternion) G.playerBody.quaternion.set(0,0,0,1);
    if (G.playerBody.angularVelocity) { G.playerBody.angularVelocity.x=0; G.playerBody.angularVelocity.y=0; G.playerBody.angularVelocity.z=0; }

    let contactFloor = false;
    let link = G.playerBody.contactLink;
    while (link != null) {
        if (link.contact && link.contact.touching) {
            let otherBody = link.body;
            if (!G.walls.some(w => w.body === otherBody) && pos.y - otherBody.position.y > 0.43) contactFloor = true;
        }
        link = link.next;
    }

    const wasGrounded = G.isGrounded;
    G.isGrounded = (contactFloor && Math.abs(vel.y) < 0.1);
    if (G.isGrounded && !wasGrounded) G.minJumpInterval = 0;
    if (!_rewardScreenEl) _rewardScreenEl = document.getElementById('reward-screen');
    const isRewarding = _rewardScreenEl ? !_rewardScreenEl.classList.contains('hidden') : false;

    if (!isRewarding && !G.isDead) handleJump(G.keys.space);
    if (G.isGrounded) { G.jumpCount = 0; G.isJumping = false; }

    _tmpFwd.set(0,0,-1).applyQuaternion(G.camera.quaternion); _tmpFwd.y=0; _tmpFwd.normalize();
    _tmpRight.crossVectors(_tmpFwd, _tmpAxisY).normalize();
    let mx=0, mz=0;
    if (!G.isDead && !isRewarding) {
        if (G.keys.w) { mx+=_tmpFwd.x; mz+=_tmpFwd.z; }
        if (G.keys.s) { mx-=_tmpFwd.x; mz-=_tmpFwd.z; }
        if (G.keys.d) { mx+=_tmpRight.x; mz+=_tmpRight.z; }
        if (G.keys.a) { mx-=_tmpRight.x; mz-=_tmpRight.z; }
    }
    const mag = Math.sqrt(mx*mx+mz*mz);
    if (mag>0) { vel.x+=((mx/mag)*config.playerSpeed-vel.x)*0.14; vel.z+=((mz/mag)*config.playerSpeed-vel.z)*0.14; }
    else { vel.x*=0.8; vel.z*=0.8; }

    let highestY = -Infinity, lowestY = Infinity;

    // エンティティ更新（接地判定・膜判定）
    G.entities.forEach(ent => {
        const body=ent.body, epos=body.position, evel=body.linearVelocity;
        if (epos.y>highestY) highestY=epos.y;
        if (epos.y<lowestY) lowestY=epos.y;
        if (body.quaternion) body.quaternion.set(0,0,0,1);
        if (body.angularVelocity) { body.angularVelocity.x=0; body.angularVelocity.y=0; body.angularVelocity.z=0; }

        let isEntGrounded=false;
        const pyBot=epos.y-0.37, bY=Math.floor(pyBot-0.1), bTop=bY+1.0;
        if (Math.abs(pyBot-bTop)<0.12) { const gx=Math.floor(epos.x), gz=Math.floor(epos.z); if (G.mapGrid.has(`${gx},${bY},${gz}`)) isEntGrounded=true; }
        if (!isEntGrounded) {
            G.membranes.forEach(m => {
                if (Math.abs(pyBot-m.y)<0.12) { const mw=m.w||config.areaSize; if (Math.abs(epos.x-m.mesh.position.x)<=mw/2 && Math.abs(epos.z-m.mesh.position.z)<=mw/2) isEntGrounded=true; }
            });
        }
        if (isEntGrounded) ent.groundContactFrames++; else ent.groundContactFrames=0;
        // プレイヤー(index 0)は即時、AIは3フレーム待機
        const requiredFrames = ent.isAI ? 3 : 1;
        isEntGrounded = (ent.groundContactFrames>=requiredFrames);

        if (ent.maxMembraneY===undefined) ent.maxMembraneY=-Infinity;
        const entBot=epos.y-0.37;
        const isEntDead=ent.isAI?ent.isDead:G.isDead;

        G.membranes.forEach(m => {
            // Hysteresis thresholds for membrane floor activation/deactivation
            const activateThreshold = m.y - 0.8; // Activate when entity bottom is above this (and moving slowly downwards)
            const deactivateThreshold = m.y - 1.5; // Deactivate when entity bottom falls below this (or moves rapidly upwards)

            // Check if the dedicated floor for this membrane is currently active for this entity
            const isFloorActive = (ent.currentMembraneY === m.y && ent.dedicatedMembraneFloor !== null);

            if (!isEntDead) { // Only consider if entity is not dead
                if (!isFloorActive && entBot >= activateThreshold && evel.y <= 0.1) {
                    // Activate the floor: Player is above the activation threshold and moving slowly downwards/still
                    if (ent.dedicatedMembraneFloor) G.world.removeRigidBody(ent.dedicatedMembraneFloor);
                    ent.dedicatedMembraneFloor = null; // Ensure old one is fully cleared
                    ent.currentMembraneY = -Infinity; // Ensure old one is fully cleared

                    const mw=m.w||config.areaSize, mPos=m.mesh.position;
                    ent.dedicatedMembraneFloor=G.world.add({type:'box',size:[mw,5.0,mw],pos:[mPos.x,m.y-2.5,mPos.z],move:false,belongsTo:1<<(ent.entIndex+17),collidesWith:1<<(ent.entIndex+1),restitution:0,friction:0.5});
                    ent.currentMembraneY=m.y;
                } else if (isFloorActive && (entBot < deactivateThreshold || evel.y > 0.1)) {
                    // Deactivate the floor: Player has fallen below deactivation threshold OR is moving rapidly upwards
                    if (ent.dedicatedMembraneFloor) { G.world.removeRigidBody(ent.dedicatedMembraneFloor); ent.dedicatedMembraneFloor=null; }
                    ent.currentMembraneY=-Infinity;
                }
            } else { // If entity is dead, ensure any active membrane floor is removed
                if (isFloorActive) {
                    if (ent.dedicatedMembraneFloor) { G.world.removeRigidBody(ent.dedicatedMembraneFloor); ent.dedicatedMembraneFloor=null; }
                    ent.currentMembraneY=-Infinity;
                }
            }
        });
        // 物理的な接触判定(contactFloor)とグリッド判定(isEntGrounded)を統合
        if (ent.isAI) ent.isGrounded = isEntGrounded;
        else {
            const wg = G.isGrounded;
            // 物理接触(contactFloor) または グリッド上の足場(isEntGrounded) があれば接地とみなす
            G.isGrounded = isEntGrounded || (contactFloor && Math.abs(evel.y) < 0.5);
            if (G.isGrounded && !wg) G.minJumpInterval = 0;
        }
    });

    // AI行動ループ
    animateAI(dt);

    // チャンク生成
    while (G.nextChunkY < highestY + 150) {
        if (G.currentMode==='tutorial') break;
        if (G.nextChunkY>=config.goalHeight) break;
        G.nextChunkY+=CHUNK;
        if (G.nextChunkY<=config.goalHeight) generateChunk(G.nextChunkY);
    }
    for (let i=G.pendingBlocks.length-1;i>=0;i--) { if (G.pendingBlocks[i].y<highestY+100) { const b=G.pendingBlocks.splice(i,1)[0]; createBlock(b.x,b.y,b.z); } }

    // ブロックLOD・消去処理
    const pY = pos.y;
    for (let i = G.mapObjects.length - 1; i >= 0; i--) {
        const obj = G.mapObjects[i];
        
        // 安全対策
        if (obj.state === undefined) obj.state = 'normal';
        if (obj.lowPolyInstIdx === undefined) obj.lowPolyInstIdx = null;

        const dy = obj.gy - pY;

        let isNearActiveEntity = false;
        if (dy >= -15 && dy <= 15) {
            isNearActiveEntity = true;
        } else {
            // 各AIの周囲（上下10m）も当たり判定を有効にする
            for (const ent of G.entities) {
                if (ent.isAI && Math.abs(obj.gy - ent.body.position.y) <= 10) {
                    isNearActiveEntity = true;
                    break;
                }
            }
        }

        if (isNearActiveEntity) {
            // 通常版
            if (obj.state !== 'normal') {
                obj.state = 'normal';
                if (obj.lowPolyInstIdx !== null) {
                    G.dummy.scale.set(0, 0, 0); G.dummy.updateMatrix();
                    if (G.lowPolyMapInstancedMesh) {
                        G.lowPolyMapInstancedMesh.setMatrixAt(obj.lowPolyInstIdx, G.dummy.matrix);
                        G.lowPolyMapInstancedMesh.instanceMatrix.needsUpdate = true;
                    }
                    G.freeLowPolyInstanceIndices.push(obj.lowPolyInstIdx);
                    obj.lowPolyInstIdx = null;
                }
                if (obj.instIdx === null && G.freeInstanceIndices.length > 0) {
                    obj.instIdx = G.freeInstanceIndices.pop();
                    G.dummy.position.set(obj.gx + 0.5, obj.gy + 0.5, obj.gz + 0.5);
                    G.dummy.scale.set(1, 1, 1); G.dummy.updateMatrix();
                    if (G.mapInstancedMesh) {
                        G.mapInstancedMesh.setMatrixAt(obj.instIdx, G.dummy.matrix);
                        G.mapInstancedMesh.instanceMatrix.needsUpdate = true;
                    }
                    // mapGrid の情報を更新（AIが参照するため）
                    const gridEntry = G.mapGrid.get(`${obj.gx},${obj.gy},${obj.gz}`);
                    if (gridEntry) gridEntry.instIdx = obj.instIdx;
                }
                if (!obj.body) {
                    obj.body = G.world.add({ type: 'box', size: [1, 1, 1], pos: [obj.gx + 0.5, obj.gy + 0.5, obj.gz + 0.5], move: false, friction: 0.5, restitution: 0 });
                }
            }
        } else if (dy >= -50) {
            // 軽い版 (下方向 30〜50m または 上方向 20m以上)
            // ※ 上空のブロックを完全に消去してしまうと上に登れなくなるため、20mより上はすべて軽量版として残す
            if (obj.state !== 'lowpoly') {
                obj.state = 'lowpoly';
                if (obj.instIdx !== null) {
                    G.dummy.scale.set(0, 0, 0); G.dummy.updateMatrix();
                    if (G.mapInstancedMesh) {
                        G.mapInstancedMesh.setMatrixAt(obj.instIdx, G.dummy.matrix);
                        G.mapInstancedMesh.instanceMatrix.needsUpdate = true;
                    }
                    G.freeInstanceIndices.push(obj.instIdx);
                    obj.instIdx = null;
                }
                if (obj.lowPolyInstIdx === null && G.freeLowPolyInstanceIndices.length > 0) {
                    obj.lowPolyInstIdx = G.freeLowPolyInstanceIndices.pop();
                    G.dummy.position.set(obj.gx + 0.5, obj.gy + 0.5, obj.gz + 0.5);
                    G.dummy.scale.set(1, 1, 1); G.dummy.updateMatrix();
                    if (G.lowPolyMapInstancedMesh) {
                        G.lowPolyMapInstancedMesh.setMatrixAt(obj.lowPolyInstIdx, G.dummy.matrix);
                        G.lowPolyMapInstancedMesh.instanceMatrix.needsUpdate = true;
                    }
                }
                if (obj.body) {
                    const hIdx = G.hitboxHelpers.findIndex(h => h.body === obj.body);
                    if (hIdx !== -1) { G.scene.remove(G.hitboxHelpers[hIdx].mesh); G.hitboxHelpers.splice(hIdx, 1); }
                    G.world.removeRigidBody(obj.body);
                    obj.body = null;
                }
            }
        } else {
            // 完全消去 (下方向に50m以上離れている)
            G.mapGrid.delete(`${obj.gx},${obj.gy},${obj.gz}`);
            if (obj.instIdx !== null) {
                G.dummy.scale.set(0, 0, 0); G.dummy.updateMatrix();
                if (G.mapInstancedMesh) {
                    G.mapInstancedMesh.setMatrixAt(obj.instIdx, G.dummy.matrix);
                    G.mapInstancedMesh.instanceMatrix.needsUpdate = true;
                }
                G.freeInstanceIndices.push(obj.instIdx);
            }
            if (obj.lowPolyInstIdx !== null) {
                G.dummy.scale.set(0, 0, 0); G.dummy.updateMatrix();
                if (G.lowPolyMapInstancedMesh) {
                    G.lowPolyMapInstancedMesh.setMatrixAt(obj.lowPolyInstIdx, G.dummy.matrix);
                    G.lowPolyMapInstancedMesh.instanceMatrix.needsUpdate = true;
                }
                G.freeLowPolyInstanceIndices.push(obj.lowPolyInstIdx);
            }
            if (obj.body) {
                const hIdx = G.hitboxHelpers.findIndex(h => h.body === obj.body);
                if (hIdx !== -1) { G.scene.remove(G.hitboxHelpers[hIdx].mesh); G.hitboxHelpers.splice(hIdx, 1); }
                G.world.removeRigidBody(obj.body);
            }
            G.mapObjects.splice(i, 1);
        }
    }

    // 弾丸自動発射
    if (G.isStarted && !G.isDead && config.projectileAutoFire && G.controls && G.controls.isLocked && !isRewarding) {
        if (G.keys.shift || G.keys.rightClick) {
            const now = Date.now();
            const projCooldown = 500 / (config.projectileRecoveryRate || 1);
            if (now - G.lastFireTimeProjectile >= projCooldown && G.playerProjectileStock >= 1.0) {
                G.lastFireTimeProjectile = now;
                G.playerProjectileStock -= 1.0;
                updateAmmoHUD();
                requestFire(0);
            }
        }
    }
    
    // 弾丸更新
    animateProjectiles(dt);


    updateSoapBubbles(dt);

    // ホスト権威同期（20fps = 3フレームに1回、弾丸+シャボン両方）
    if (G.isHost&&G.isStarted) {
        _syncCounter++;
        if (_syncCounter%3===0) {
            const sl=[];
            G.projectiles.forEach(p=>{
                if(p.netId != null) {
                    sl.push(p.netId, Math.round(p.position.x*100)/100, Math.round(p.position.y*100)/100, Math.round(p.position.z*100)/100);
                }
            });
            G.bubbles.forEach(b=>{
                if(b.netId != null && b.body) {
                    sl.push(b.netId, Math.round(b.body.position.x*100)/100, Math.round(b.body.position.y*100)/100, Math.round(b.body.position.z*100)/100);
                }
            });
            broadcastEvent(12,{list:sl});
        }
    }

    // プレイヤー座標同期（30fps = 2フレームに1回、受信側はlerp補間で十分スムーズ）
    if (G.isOnline) {
        _posSyncCounter++;
        if (_posSyncCounter % 2 === 0) {
            broadcastEvent(1,{id:G.myPeerId,x:pos.x,y:pos.y,z:pos.z,jumps:G.jumpCount});
        }
    }

    // 無敵更新
    if (typeof updateInvincibility === 'function') updateInvincibility(dt);

    // ストック回復
    const pMov=(Math.abs(vel.x)>0.1||Math.abs(vel.z)>0.1);
    const pRecRate = pMov ? (config.projectileRecoveryRate / 8) : config.projectileRecoveryRate;
    G.playerProjectileStock=Math.min(config.maxProjectileStock||2,G.playerProjectileStock+pRecRate*(1/3)*dt);
    G.playerBubbleStock=Math.min(config.maxBubbleStock||2,G.playerBubbleStock+config.bubbleRecoveryRate*dt);
    updateAmmoHUD();
    G.entities.forEach(ent=>{
        if(ent.isAI&&!ent.isDead){const av=ent.body.linearVelocity,am=(Math.abs(av.x)>0.1||Math.abs(av.z)>0.1);const eRecRate=am?(config.projectileRecoveryRate/8):config.projectileRecoveryRate;ent.projectileStock=Math.min(config.maxProjectileStock||2,(ent.projectileStock||0)+eRecRate*(1/3)*dt);ent.bubbleStock=Math.min(config.maxBubbleStock||2,(ent.bubbleStock||0)+config.bubbleRecoveryRate*dt);}
    });

    const now = Date.now();
    // 鳥システム
    if (G.isStarted&&window.birds) {
        if (now-window.lastBirdSpawnTime>config.birdSpawnInterval) { window.lastBirdSpawnTime=now; if(window.spawnBirds)window.spawnBirds(); }
        for (let i=window.birds.length-1;i>=0;i--) {
            const b=window.birds[i]; b.mesh.position.addScaledVector(b.dir,b.speed*dt); b.distance+=b.speed*dt;
            if (b.mixer) b.mixer.update(dt);
            b.wingPhase+=15*dt;
            if (b.wingL) b.wingL.rotation.y=Math.sin(b.wingPhase)*0.5;
            if (b.wingR) b.wingR.rotation.y=-Math.sin(b.wingPhase)*0.5;
            if(b.distance>250){G.scene.remove(b.mesh);window.birds.splice(i,1);}
        }
    }
    
    // 落下リセット
    if (pos.y<-10) {
        let sx,sz,sy;
        if (G.currentMode==='tutorial') { sx=1.5;sz=1.5;sy=5.0; } else { sx=config.areaSize/2+0.5;sz=config.areaSize/2+0.5;sy=0.25; }
        G.playerBody.resetPosition(sx,sy,sz); vel.x=vel.y=vel.z=0;
    }

    // タイムトライアル記録
    if (typeof recordPlayerPath === 'function') recordPlayerPath();
}

function renderVisuals(dt) {
    const pos = G.playerBody.position;
    const vel = G.playerBody.linearVelocity;
    
    G.playerMesh.position.set(pos.x, pos.y - 0.37, pos.z);
    if (Math.abs(vel.x) > 0.1 || Math.abs(vel.z) > 0.1) {
        const ta = Math.atan2(vel.x, vel.z);
        G.playerMesh.quaternion.slerp(_tmpQ.setFromAxisAngle(_tmpAxisY, ta), 0.15);
    }

    let targetFov = 75;
    let yOffset = 0.97;
    let zOffset = G.camDist;
    let hidePlayer = false;

    let isAnyScoped = G.isScopedIn || G.camDist <= 1.0;
    if (isAnyScoped) {
        // スコープモードへの遷移 (G.isScopedIn の時は強制的に最大ズーム)
        const t = G.isScopedIn ? 1.0 : (1.0 - G.camDist); // 0.0(通常) -> 1.0(完全ズーム)
        targetFov = 75 - 45 * t; // FOV 75 -> 30 に拡大
        yOffset = 0.97 - (0.97 - 0.05) * t; // 高さを口元へ (0.05)
        zOffset = G.isScopedIn ? -0.1 : (G.camDist * (1 - t) - 0.1 * t); // カメラをモデルの前方へ (-0.1)
        if (t > 0.8) hidePlayer = true;
    }

    // 自機（プレイヤー）の表示制御
    const myEnt = G.entities[0];
    if (myEnt && myEnt.mesh) {
        if (G.isDead) {
            myEnt.mesh.visible = false;
        } else {
            myEnt.mesh.visible = !hidePlayer;
        }
    }
    
    // FOVの滑らかな補間
    G.camera.fov += (targetFov - G.camera.fov) * 0.2;
    G.camera.updateProjectionMatrix();

    _tmpOffset.set(0, yOffset, zOffset).applyQuaternion(G.camera.quaternion);
    G.camera.position.set(pos.x+_tmpOffset.x, pos.y+_tmpOffset.y, pos.z+_tmpOffset.z);

    // 実際の光から3Dモデルの影を落とすため、平行光源(D1)をプレイヤーに追従させる（光の向き・強さは不変）
    if (G.d1) {
        G.d1.position.set(pos.x + 100, pos.y + 150, pos.z + 100);
        G.d1.target.position.set(pos.x, pos.y, pos.z);
        G.d1.target.updateMatrixWorld();
    }

    G.warningTapes.forEach(t => { t.mesh.position.y=pos.y; t.mat.uniforms.playerPos.value.copy(pos); });

    G.hitboxHelpers.forEach(h => {
        h.mesh.visible = config.showHitboxes;
        if (config.showHitboxes) {
            h.mesh.position.set(h.body.position.x, h.body.position.y, h.body.position.z);
            if (h.body.quaternion) h.mesh.quaternion.set(h.body.quaternion.x, h.body.quaternion.y, h.body.quaternion.z, h.body.quaternion.w);
        }
    });
    
    // UI更新（K/D表示付き）
    let listHtml = G.entities.map(e=>{
        const h = Math.max(0,Math.floor(e.body.position.y));
        const nameColor = e.isAI ? '#90ee90' : '#64b4ff';
        const displayName = e.isAI ? e.name : (G.myPlayerName || G.myPeerId || 'GUEST');
        let res = `<span style="color:${nameColor}">${displayName}</span>: ${h}m`;
        // 自分のK/D
        if (!e.isAI) {
            const stats = (G.peerStats && G.myPeerId) ? G.peerStats.get(G.myPeerId) : null;
            const k = stats ? stats.kills : G.myKills;
            const d = stats ? stats.deaths : G.myDeaths;
            res += `<div style="color:#94a3b8;font-size:12px;margin-top:-2px;margin-left:10px;">K:${k} D:${d}</div>`;
        }
        return res;
    }).join('<br>');
    G.networkEntities.forEach(ent => {
        const name=ent.name||(ent.id.startsWith('AI_')?'RIVAL AI':'GUEST');
        const h = Math.max(0,Math.floor(ent.mesh.position.y + 0.37));
        const stats = G.peerStats.get(ent.id);
        const kd = stats ? `<br><span style="color:#94a3b8;font-size:10px">K:${stats.kills} D:${stats.deaths}</span>` : '';
        const nameColor = ent.id.startsWith('AI_') ? '#90ee90' : '#ffaa33';
        listHtml += `<br><span style="color:${nameColor}">${name}</span>: ${h}m${kd}`;

        // 通信相手の死亡状態に応じた表示の切り替え
        if (ent.mesh) {
            ent.mesh.visible = !ent.isDead;
            if (ent._deathCrossMesh) {
                ent._deathCrossMesh.visible = !!ent.isDead;
            }
        }
    });

    const elapsedPrecise = (Date.now() - G.startTime) / 1000;

    // ゴーストの高度表示
    if (G.ghosts && G.ghosts.length > 0) {
        G.ghosts.forEach(ghost => {
            const h = Math.max(0, Math.floor(ghost.mesh.position.y + 0.37));
            const isFinished = (elapsedPrecise >= ghost.time);
            const valStr = isFinished ? `<span style="color:#64b4ff;">${ghost.time.toFixed(2)}s</span>` : `${h}m`;
            listHtml += `<br><span style="color:#ffd700">${ghost.rank}位 (GHOST)</span>: ${valStr}`;
        });
    }
    if (G.entityListEl) G.entityListEl.innerHTML = listHtml;

    // フォグ
    if (G.camera.position.y<-0.51) { G.scene.fog.color.set(0x001122); G.scene.fog.near=0; G.scene.fog.far=40; }
    else { G.scene.fog.color.set(0x001122); G.scene.fog.near=0; G.scene.fog.far=75; }

    // HUD
    if (G.heightEl) G.heightEl.textContent = Math.max(0,Math.floor(pos.y))+'m';
    

    // ゴースト更新 (ゴール後も継続)
    if (typeof updateGhosts === 'function') updateGhosts(elapsedPrecise);

    if (!G.isGoalReached) {
        const elapsed = Math.floor(elapsedPrecise);
        if (G.timeEl) G.timeEl.textContent = `${Math.floor(elapsed/60).toString().padStart(2,'0')}:${(elapsed%60).toString().padStart(2,'0')}`;
    } else {
        // ゴール後はタイムを小数点2桁で止める
        if (!G._finalTimeStr) {
            const finalElapsed = (G.lapTimes && G.lapTimes.length > 0) ? G.lapTimes[G.lapTimes.length-1].time : elapsedPrecise;
            const mins = Math.floor(finalElapsed / 60);
            const secs = (finalElapsed % 60).toFixed(2);
            G._finalTimeStr = `${mins.toString().padStart(2,'0')}:${secs.toString().padStart(2,'0')}`;
        }
        if (G.timeEl) G.timeEl.textContent = G._finalTimeStr;
    }
    if (G.airEl) G.airEl.classList.toggle('hidden', G.isGrounded || G.jumpCount>=G.maxJumps);

    // マイルストーン達成判定 (50mごと)
    if (G.isStarted && !G.isGoalReached && G.currentMode === 'main' && pos.y >= G.nextMilestoneY) {
        if (!G.lapTimes) G.lapTimes = []; // 未定義エラーを防止
        G.lapTimes.push({ distance: G.nextMilestoneY, time: elapsedPrecise });
        
        // タイムトライアル以外なら報酬画面を表示
        if (config.raceType !== 'TIME TRIAL') {
            showRewardScreen();
        }
        
        G.nextMilestoneY += 50;
    }

    // ゴール到達判定
    if (G.isStarted && !G.isGoalReached && G.currentMode === 'main' && pos.y >= config.goalHeight) {
        G.isGoalReached = true;
        if (!G.lapTimes) G.lapTimes = [];
        // ゴール距離がマイルストーンと重ならない場合のみ追加
        if (G.lapTimes.length === 0 || G.lapTimes[G.lapTimes.length - 1].distance !== config.goalHeight) {
            G.lapTimes.push({ distance: config.goalHeight, time: elapsedPrecise });
        }
        saveRecord(config.goalHeight, elapsedPrecise, G.lapTimes, config.density, config.areaSize, G.randomSeed);
        if (typeof saveTimeTrialRecord === 'function') saveTimeTrialRecord(elapsedPrecise);
    }

    // ネットワークプレイヤー補間
    G.networkEntities.forEach(ent => {
        if (ent.targetNetPos) {
            _tmpDp.copy(ent.targetNetPos); _tmpDp.y-=0.37;
            const dx=_tmpDp.x-ent.mesh.position.x, dz=_tmpDp.z-ent.mesh.position.z;
            if (Math.abs(dx)>0.01||Math.abs(dz)>0.01) ent.mesh.quaternion.slerp(_tmpQ.setFromAxisAngle(_tmpAxisY,Math.atan2(dx,dz)),0.15);
            ent.mesh.position.lerp(_tmpDp,0.2);
        }
    });

    if (G.water) {
        G.water.material.uniforms['time'].value += dt;
    }
    G.renderer.render(G.scene, G.camera);
}
