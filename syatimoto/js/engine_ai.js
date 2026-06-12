// ═══════════════════════════════════════════════════════
//  engine_ai.js — AI行動ループ + 弾丸更新
//  登頂に完全特化したヒューリスティック + NN学習
// ═══════════════════════════════════════════════════════
'use strict';



// ── ブロック探索ヘルパー ──
// 指定座標の近隣で「着地可能な面」を探す（上が空いているブロック）
function findLandableBlocks(pos, searchH, searchUp, searchDown) {
    const px = Math.floor(pos.x), py = Math.floor(pos.y), pz = Math.floor(pos.z);
    const results = [];
    const minY = Math.max(0, py - searchDown);
    const maxY = py + searchUp;

    for (let gx = px - searchH; gx <= px + searchH; gx++) {
        for (let gz = pz - searchH; gz <= pz + searchH; gz++) {
            for (let gy = minY; gy <= maxY; gy++) {
                const b = G.mapGrid.get(`${gx},${gy},${gz}`);
                if (!b) continue;
                // 上2マスが空いていること（着地可能）
                if (G.mapGrid.has(`${gx},${gy + 1},${gz}`) || G.mapGrid.has(`${gx},${gy + 2},${gz}`)) continue;
                results.push(b);
            }
        }
    }
    return results;
}

// ── 毎フレーム再利用する一時オブジェクト（GC圧力削減） ──
const _aiTmpQ = new THREE.Quaternion();
const _aiTmpAxisY = new THREE.Vector3(0, 1, 0);

// ── メインAIループ ──
function animateAI(dt) {
    G.entities.forEach(ent => {
        if (!ent.isAI) return;
        const body = ent.body, pos = body.position, vel = body.linearVelocity;

        // 死亡中は何もしない
        if (ent.isDead) {
            ent.deathTimer -= dt;
            if (ent.deathTimer <= 0) ent.isDead = false;
            ent.mesh.position.set(pos.x, pos.y - 0.37, pos.z);
            body.linearVelocity.set(0, 0, 0);
            return;
        }

        // ── メッシュ同期 ──
        ent.mesh.position.set(pos.x, pos.y - 0.37, pos.z);
        if (Math.abs(vel.x) > 0.1 || Math.abs(vel.z) > 0.1) {
            const ta = Math.atan2(vel.x, vel.z);
            ent.mesh.quaternion.slerp(
                _aiTmpQ.setFromAxisAngle(_aiTmpAxisY, ta), 0.15
            );
        }

        // ── スタック検出 ──
        if (!ent.lastPos) ent.lastPos = { x: pos.x, y: pos.y, z: pos.z };
        const dxm = pos.x - ent.lastPos.x, dym = pos.y - ent.lastPos.y, dzm = pos.z - ent.lastPos.z;
        const distMoved = Math.sqrt(dxm * dxm + dym * dym + dzm * dzm);
        if (distMoved < 0.3) ent.stuckTimer++;
        else { ent.stuckTimer = 0; ent.lastPos.x = pos.x; ent.lastPos.y = pos.y; ent.lastPos.z = pos.z; }

        // ── 接地判定の救済 ──
        // engine.js は mapGrid しか見ないため、初期フロア（y=0付近）では手動で接地とする
        if (pos.y < 0.45) ent.isGrounded = true;

        if (ent.jumpIgnoreTimer && ent.jumpIgnoreTimer > 0) {
            ent.isGrounded = false;
            ent.jumpIgnoreTimer--;
        }

        // 接地状態の変化を記録
        if (ent.lastGrounded === undefined) ent.lastGrounded = true;
        const justLanded = (ent.isGrounded && !ent.lastGrounded);
        ent.lastGrounded = ent.isGrounded;

        // ── 頭上チェック（ジャンプ可否） ──
        let hasOverhead = false;
        const checkY = Math.floor(pos.y); 
        const cx = Math.floor(pos.x);
        const cz = Math.floor(pos.z);
        if (G.mapGrid.has(`${cx},${checkY + 2},${cz}`) || G.mapGrid.has(`${cx},${checkY + 3},${cz}`)) {
            hasOverhead = true;
        }
        ent.debugHasOverhead = hasOverhead;

        // ── 接地・ジャンプ状態管理 ──
        // engine.js が ent.isGrounded を設定済み。ここでは上書きしない。
        if (ent.isGrounded) { 
            ent.jumpCount = 0; 
            ent.isJumping = false; 
        }
        else if (ent.isJumping && ent.jumpTimer < config.maxHoldTime && vel.y > 0) {
            // 天井判定に関わらず、物理的にぶつかるまではブーストを継続（プレイヤーと同じ挙動）
            vel.y += config.holdBoost;
            ent.jumpTimer++;
        } else {
            ent.isJumping = false;
        }

        // ═══════════════════════════════════════════════
        //  ヒューリスティック登頂アルゴリズム
        // ═══════════════════════════════════════════════
            // ── ターゲット選択 ──
            // ジャンプ中（空中）はターゲットを固定して挙動を安定させる
            // ただし、長時間スタックしている場合は強制的に再評価
            const isAirborne = !ent.isGrounded || ent.isJumping;
            const needNewTarget = !ent.targetPos
                || (ent.targetPos.y <= pos.y - 0.2)   // 既に到達済み or 下にある
                || (ent.stuckTimer > 40)                // スタック
                || (!isAirborne && Math.random() < 0.02); // 地上にいる時だけ低確率で再評価

            if (needNewTarget) {
                // スタックしてターゲットを再評価する場合、現在のターゲットをブラックリストに入れる（無限ループ防止）
                if (ent.stuckTimer > 40 && ent.targetPos) {
                    const bk = `${ent.targetPos.x},${ent.targetPos.y},${ent.targetPos.z}`;
                    ent.jumpBlacklist.set(bk, Date.now());
                }

                // ブラックリストの期限切れをクリーン
                if (ent.jumpBlacklist.size > 0) {
                    const now = Date.now();
                    ent.jumpBlacklist.forEach((ts, key) => { if (now - ts > 8000) ent.jumpBlacklist.delete(key); });
                }

                // プレイヤー追従モード（教師あり学習用）
                const followPlayer = document.getElementById('ai-follow-player') && document.getElementById('ai-follow-player').checked;
                
                if (followPlayer && G.playerBody) {
                    ent.targetPos = G.playerBody.position.clone();
                    ent.stuckTimer = 0;
                } else {
                    // 通常のブロック探索
                    const nextMembrane = G.membranes.find(m => m.y > pos.y);
                    const goalX = nextMembrane ? nextMembrane.mesh.position.x : config.areaSize / 2;
                    const goalZ = nextMembrane ? nextMembrane.mesh.position.z : config.areaSize / 2;

                    // ── 段階的ターゲット探索 ──
                    // 1段上を最優先 → 2段上 → 同じ高さでゴール方向（中間移動）
                    const scoreCandidates = (list) => {
                        let bTarget = null, bScore = -Infinity;
                        for (const b of list) {
                            const topY = b.position.y + 0.5;
                            const dy = topY - pos.y;
                            const ddx = b.position.x - pos.x, ddz = b.position.z - pos.z;
                            const distHSq = ddx * ddx + ddz * ddz;
                            if (distHSq < 0.1 && Math.abs(dy) < 0.3) continue;
                            const bk = `${b.position.x},${topY},${b.position.z}`;
                            if (ent.jumpBlacklist.has(bk)) continue;

                            // ── ターゲット上のクリアランス（天井）チェック ──
                            let hasTargetCeiling = false;
                            const tx = Math.floor(b.position.x);
                            const tz = Math.floor(b.position.z);
                            const tNy = Math.floor(topY);
                            // ターゲットブロックの1〜2マス上に障害物がないか
                            for (let h = 1; h <= 2; h++) {
                                if (G.mapGrid.has(`${tx},${tNy + h},${tz}`)) {
                                    hasTargetCeiling = true;
                                    break;
                                }
                            }
                            if (hasTargetCeiling) continue; // 天井が低いブロックは無視

                            const dtgSq = Math.pow(b.position.x - goalX, 2) + Math.pow(b.position.z - goalZ, 2);
                            let score = 0;

                            if (dy > 0.3 && dy <= 1.3) {
                                score = 3000 - distHSq * 20 - dtgSq * 0.1;
                            } else if (dy > 1.3 && dy <= 2.3) {
                                score = 1500 - distHSq * 30 - dtgSq * 0.1;
                            } else if (dy > 2.3 && dy <= 3.5) {
                                score = 500 - distHSq * 40 - dtgSq * 0.1;
                            } else if (dy >= -0.3 && dy <= 0.3) {
                                score = 200 - distHSq * 3 - dtgSq * 0.5;
                            } else if (dy >= -1.5 && dy < -0.3) {
                                score = -100 - distHSq * 5;
                            } else continue;

                            // ── 密集回避（他のAIが近くにいるターゲットは避ける） ──
                            let crowdingPenalty = 0;
                            G.entities.forEach(otherEnt => {
                                if (otherEnt.isAI && otherEnt !== ent) {
                                    const ox = otherEnt.mesh.position.x - b.position.x;
                                    const oy = otherEnt.mesh.position.y - topY;
                                    const oz = otherEnt.mesh.position.z - b.position.z;
                                    const odistSq = ox*ox + oy*oy + oz*oz;
                                    if (odistSq < 1.0) crowdingPenalty += 300; // ペナルティを適度に下げる
                                }
                            });
                            score -= crowdingPenalty;

                            if (score > bScore) {
                                bScore = score;
                                bTarget = new THREE.Vector3(b.position.x, topY, b.position.z);
                            }
                        }
                        return bTarget;
                    };

                    let bestTarget = scoreCandidates(findLandableBlocks(pos, 8, 6, 2));
                    if (!bestTarget) {
                        bestTarget = scoreCandidates(findLandableBlocks(pos, 15, 12, 5));
                    }

                    if (bestTarget) {
                        ent.targetPos = bestTarget;
                        ent.stuckTimer = 0;
                    } else if (ent.stuckTimer > 60) {
                        // 長時間スタック：ランダム方向にジャンプして脱出
                        ent.targetPos = new THREE.Vector3(
                            pos.x + (Math.random() - 0.5) * 6,
                            pos.y + 2,
                            pos.z + (Math.random() - 0.5) * 6
                        );
                        ent.stuckTimer = 0;
                        ent.jumpBlacklist.clear();
                    } else {
                        // ターゲットが見つからない場合はその場に留まる（落下防止）
                        ent.targetPos = null;
                    }
                }
            }

            // ── ターゲットへの移動 ──
            if (ent.targetPos) {
                // 同じターゲットに長時間（約3秒＝180フレーム）到達できなければ諦める（無限ジャンプ防止）
                if (!ent.targetTimer) ent.targetTimer = 0;
                ent.targetTimer++;
                if (ent.targetTimer > 180) {
                    const bk = `${ent.targetPos.x},${ent.targetPos.y},${ent.targetPos.z}`;
                    ent.jumpBlacklist.set(bk, Date.now());
                    ent.targetPos = null;
                    ent.targetTimer = 0;
                    mx = 0; mz = 0;
                }
            } else {
                ent.targetTimer = 0;
            }

            if (ent.targetPos) {
                const ddx = ent.targetPos.x - pos.x;
                const ddz = ent.targetPos.z - pos.z;
                const distH = Math.sqrt(ddx * ddx + ddz * ddz);
                const targetIsUp = ent.targetPos.y > pos.y + 0.15;
                const dyToTarget = ent.targetPos.y - pos.y;

                // 移動方向の決定
                let moveDirX = 0, moveDirZ = 0;
                if (distH > 0.1) {
                    moveDirX = ddx / distH;
                    moveDirZ = ddz / distH;
                }

                // ── 足元の安全チェック ──
                let wallAhead = false, gapAhead = false, edgeAhead = false;
                if (ent.isGrounded && distH > 0.2) {
                    const ny = Math.floor(pos.y);
                    
                    // 進行方向のブロックチェック
                    const nx = Math.floor(pos.x + moveDirX * 1.2);
                    const nz = Math.floor(pos.z + moveDirZ * 1.2);
                    
                    // 壁チェック
                    for (let h = 0; h <= 2; h++) {
                        if (h === 0 && pos.y >= 0.45) continue;
                        if (G.mapGrid.has(`${nx},${ny + h},${nz}`)) { wallAhead = true; break; }
                    }
                    
                    // 穴チェック（進行方向に床があるか）
                    let hasFloor = pos.y < 0.45;
                    if (!hasFloor) {
                        for (let d = 0; d <= 3; d++) {
                            if (G.mapGrid.has(`${nx},${ny - d},${nz}`)) { hasFloor = true; break; }
                        }
                    }
                    if (!hasFloor) gapAhead = true;

                    // 足元エッジ検出（少し早め：自分の0.7m先の足元にブロックがあるか）
                    const ex = Math.floor(pos.x + moveDirX * 0.7);
                    const ez = Math.floor(pos.z + moveDirZ * 0.7);
                    let hasEdgeFloor = pos.y < 0.45;
                    if (!hasEdgeFloor) {
                        for (let d = 0; d <= 2; d++) {
                            if (G.mapGrid.has(`${ex},${ny - d},${ez}`)) { hasEdgeFloor = true; break; }
                        }
                    }
                    if (!hasEdgeFloor) edgeAhead = true;
                }

                ent.debugWallAhead = wallAhead;
                ent.debugGapAhead = gapAhead;

                // ── 移動方向の決定 ──
                if (wallAhead || gapAhead || edgeAhead) {
                    // 壁・穴・端を検出したら歩行停止（壁押し・落下防止）
                    mx = 0;
                    mz = 0;
                } else {
                    mx = moveDirX;
                    mz = moveDirZ;
                }

                // ── ジャンプ判定（天井がある場合はジャンプしない） ──
                const canJump = !hasOverhead || !targetIsUp;

                const shouldJump = canJump && (
                    (targetIsUp && ent.isGrounded && (edgeAhead || gapAhead))
                    || (targetIsUp && ent.isGrounded && distH <= 1.5)
                    // 2段ジャンプ：頂点付近でまだターゲットに届いていない場合（高度または距離）に発動
                    || (!ent.isGrounded && ent.jumpCount === 1 && vel.y < 0.2 && ent.targetPos && (ent.targetPos.y > pos.y - 0.5 || distH > 0.5))
                    || (wallAhead && ent.isGrounded)
                    || ((gapAhead || edgeAhead) && !targetIsUp && ent.isGrounded)
                    || (ent.stuckTimer > 12 && ent.isGrounded)
                );

                if (shouldJump) {
                    isJumpTriggered = true;
                }

                // 天井があってジャンプできない場合は後退せず、即座にターゲットをブラックリストに入れて諦める
                if (hasOverhead && targetIsUp && ent.isGrounded) {
                    const bk = `${ent.targetPos.x},${ent.targetPos.y},${ent.targetPos.z}`;
                    ent.jumpBlacklist.set(bk, Date.now());
                    ent.targetPos = null;
                    mx = 0; mz = 0;
                }

                if (wallAhead && !targetIsUp && !ent.isJumping) {
                    const bk = `${ent.targetPos.x},${ent.targetPos.y},${ent.targetPos.z}`;
                    ent.jumpBlacklist.set(bk, Date.now());
                    ent.targetPos = null;
                    ent.targetTimer = 0;
                    mx = 0; mz = 0;
                }
            }


        // ═══════════════════════════════════════════════
        //  ジャンプ実行（精密な物理計算に基づく）
        // ═══════════════════════════════════════════════
        if (isJumpTriggered && !ent.lastJumpTriggered) {
            if (ent.isGrounded || ent.jumpCount < 2) {
                const force = ent.isGrounded
                    ? config.jumpVelocity
                    : config.jumpVelocity * config.jumpMultiplier;
                vel.y = force;

                if (ent.targetPos) {
                    const tdx = ent.targetPos.x - pos.x;
                    const tdz = ent.targetPos.z - pos.z;
                    const tDistH = Math.sqrt(tdx * tdx + tdz * tdz);
                    if (tDistH > 0.1) {
                        const dy = ent.targetPos.y - pos.y;
                        const g = Math.abs(config.gravity);
                        const v0y = force + (ent.isGrounded ? config.holdBoost * config.maxHoldTime * 0.5 : 0);
                        
                        // 物理公式: y = v0y*t - 0.5*g*t^2  => 0.5*g*t^2 - v0y*t + dy = 0
                        const determinant = v0y * v0y - 2 * g * dy;
                        let airTime = 0;
                        if (determinant > 0) {
                            airTime = (v0y + Math.sqrt(determinant)) / g;
                        } else {
                            airTime = v0y / g; 
                        }

                        // ── 壁こすり防止（完全な真上ジャンプ） ──
                        // 近距離のターゲットには、初速で前に飛ばず完全に真上に跳ぶ！
                        let speedScale = 1.0;
                        if (ent.targetPos.y > pos.y && tDistH < 1.5) {
                            speedScale = 0.0; // 真上！
                        }

                        const hSpeed = Math.min(config.playerSpeed * 1.8, tDistH / Math.max(0.05, airTime)) * speedScale;
                        vel.x = (tdx / tDistH) * hSpeed;
                        vel.z = (tdz / tDistH) * hSpeed;
                    }
                }

                ent.jumpCount++;
                ent.isGrounded = false;
                ent.isJumping = true;
                ent.jumpTimer = 0;
                ent.jumpIgnoreTimer = 6;
            }
        }



        ent.lastJumpTriggered = isJumpTriggered;

        // ── 接地した瞬間の超強力ブレーキとクールダウン（滑落防止） ──
        if (justLanded) {
            vel.x *= 0.1; // 着地した瞬間に物理的な慣性をほぼ完全に殺す
            vel.z *= 0.1;
            
            // ブロックの端にギリギリ着地した場合、クールダウン（硬直）させると球体ゆえに転がり落ちてしまう。
            // そのため、中心（0.3m以内）に着地できた場合のみ硬直させ、端の場合は即座に歩いて中心に向かわせる。
            let shouldCooldown = true;
            if (ent.targetPos) {
                const ddx = ent.targetPos.x - pos.x;
                const ddz = ent.targetPos.z - pos.z;
                if (Math.sqrt(ddx*ddx + ddz*ddz) > 0.3) {
                    shouldCooldown = false;
                }
            }
            if (shouldCooldown) {
                ent.landCooldown = 20; 
            }
        }

        // クールダウン中は歩かない
        if (ent.isGrounded && ent.landCooldown > 0) {
            mx = 0; mz = 0;
            ent.landCooldown--;
        }

        const amag = Math.sqrt(mx * mx + mz * mz);
        if (amag > 0) {
            let sp = config.playerSpeed;
            let blend = ent.isGrounded ? 0.2 : 0.35;

            if (!ent.isGrounded && ent.targetPos) {
                const dyAir = pos.y - ent.targetPos.y;
                const ddxAir = ent.targetPos.x - pos.x;
                const ddzAir = ent.targetPos.z - pos.z;
                const distHAir = Math.sqrt(ddxAir*ddxAir + ddzAir*ddzAir);

                // ── L字ジャンプ（スムーズな乗り越えカーブ）の制御 ──
                // ターゲットから離れているほど、下の方から前進を始めても壁に擦らない
                const startForwardHeight = -0.1 - Math.max(0, distHAir - 0.5) * 0.8;
                
                if (distHAir < 1.5 && dyAir < startForwardHeight) {
                    // まだ前進するには低すぎる（擦る危険がある）ため前進禁止
                    sp = 0; 
                    blend = 0.5; 
                } else if (distHAir >= 1.5 && vel.y > 0 && dyAir < -1.5) {
                    // 遠距離の放物線ジャンプ用
                    sp = 0; blend = 0.5;
                } else {
                    // 足が箱の上面を超えた、あるいは十分に近づいたら、箱の中心へ強力に前進（吸い込み）
                    sp = config.playerSpeed * 1.5;
                    blend = 0.4;
                }
                
                // ── 到着判定（箱のより真ん中に近づくまで吸い込みを継続） ──
                if (distHAir < 0.15 && dyAir > -0.2) {
                    sp = 0; blend = 0.9;
                    vel.x *= 0.6; vel.z *= 0.6; // より強力なブレーキ
                }
            }

            vel.x += ((mx / amag) * sp - vel.x) * blend;
            vel.z += ((mz / amag) * sp - vel.z) * blend;
        } else {
            // 入力なし時のブレーキ
            const brakeFactor = ent.isGrounded ? 0.7 : 0.9;
            vel.x *= brakeFactor;
            vel.z *= brakeFactor;
        }
        ent.lastMx = mx;
        ent.lastMz = mz;



        // 攻撃ロジック省略
        const fireNow = Date.now();
        const aiCFP = (fireNow - (ent.lastFireTimeProjectile || 0) >= 2000 && (ent.projectileStock || 0) >= 1.0);
        if (ent.stuckTimer < 30) {
            let closest = null, minDS = Infinity;
            const chk = (ep, eb) => {
                if (eb === ent.body) return;
                const dx = ep.x - pos.x, dy = ep.y - pos.y, dz = ep.z - pos.z;
                const ds = dx * dx + dy * dy + dz * dz;
                if (ds < 200 && ds < minDS) { minDS = ds; closest = { pos: ep, distSq: ds }; }
            };
            chk(G.playerBody.position, G.playerBody);
            G.networkEntities.forEach(ne => { if (ne.body) chk(ne.mesh.position, ne.body); });
            if (closest && aiCFP && Math.random() < 0.015) {
                ent.lastFireTimeProjectile = fireNow;
                ent.projectileStock -= 1.0;
                const tp = closest.pos;
                const tdx = tp.x - pos.x, tdy = tp.y - pos.y, tdz = tp.z - pos.z;
                const td = Math.sqrt(minDS);
                if (typeof fireProjectile === 'function') fireProjectile(pos.x, pos.y, pos.z, (tdx / td) * config.projectileSpeed, (tdy / td) * config.projectileSpeed, (tdz / td) * config.projectileSpeed, ent.body);
            }
        }
    });


}

function animateProjectiles(dt) {
    for (let i = G.projectiles.length - 1; i >= 0; i--) {
        const p = G.projectiles[i], age = Date.now() - p.spawnTime;
        let exploded = p._hitFlag || false;
        if (!exploded && (G.isHost || !G.isOnline)) {
            const pPassWall = p.props ? p.props.passWall : config.projectilePassWall;
            const pMaxBounces = p.props ? p.props.bounces : config.projectileBounces;
            const pRadiusMult = p.props ? p.props.radiusMult : (config.projectileRadiusMult || 1.0);
            
            // 負荷軽減のためステップ幅を広げ、判定を少し緩く（半径を大きく）する
            const stepDist = p.velocity.length() * dt, steps = Math.max(1, Math.ceil(stepDist / 0.4));
            const dir = p.velocity.clone().normalize(), cPos = p.position.clone();
            for (let s = 1; s <= steps; s++) {
                cPos.addScaledVector(dir, stepDist / steps);
                const gx = Math.floor(cPos.x), gy = Math.floor(cPos.y), gz = Math.floor(cPos.z);
                if (G.mapGrid && G.mapGrid.has(`${gx},${gy},${gz}`)) { 
                    if (pPassWall) {
                        // pass through
                    } else if (pMaxBounces > 0 && (p.bounces || 0) < pMaxBounces) {
                        const bCX = gx + 0.5, bCY = gy + 0.5, bCZ = gz + 0.5;
                        const dx = Math.abs(cPos.x - bCX), dy = Math.abs(cPos.y - bCY), dz = Math.abs(cPos.z - bCZ);
                        if (dx > dy && dx > dz) p.velocity.x *= -1;
                        else if (dy > dx && dy > dz) p.velocity.y *= -1;
                        else p.velocity.z *= -1;
                        p.bounces = (p.bounces || 0) + 1;
                        dir.copy(p.velocity).normalize();
                    } else {
                        p._hitFlag = true; exploded = true; break; 
                    }
                }
                const cr = 0.6 * pRadiusMult, rSq = cr * cr; let hitEB = null;
                const gDS = (b, pt) => { const dx = b.position.x - pt.x, dy = b.position.y - pt.y, dz = b.position.z - pt.z; return dx * dx + dy * dy + dz * dz; };
                
                // 無敵チェックを追加
                if (p.ownerBody && G.playerBody !== p.ownerBody && !G.isInvincible && gDS(G.playerBody, cPos) < rSq) hitEB = G.playerBody;
                if (!hitEB) {
                    G.networkEntities.forEach(e => {
                        if (e.body && e.body !== p.ownerBody && !e.isInvincible && gDS(e.body, cPos) < rSq) hitEB = e.body;
                    });
                }
                if (!hitEB) G.entities.forEach(e => { if (e.body && e.body !== p.ownerBody && gDS(e.body, cPos) < rSq) hitEB = e.body; });
                
                if (!hitEB) { 
                    const bhr = (2.5 + 0.15) ** 2; 
                    G.bubbles.forEach(b => { 
                        if (b.body && gDS(b.body, cPos) < bhr) { 
                            // シャボン玉自体が無敵プレイヤーに当たっている場合は無視
                            let bTargetInvincible = false;
                            if (b._hitBody === G.playerBody && G.isInvincible) bTargetInvincible = true;
                            if (!bTargetInvincible) {
                                for (const [pid, netEnt] of G.networkEntities) {
                                    if (b._hitBody === netEnt.body && netEnt.isInvincible) { bTargetInvincible = true; break; }
                                }
                            }
                            if (!bTargetInvincible) {
                                b._hitFlag = true; p._hitFlag = true; exploded = true; 
                            }
                        } 
                    }); 
                }
                if (hitEB) { p._hitFlag = true; p._hitBody = hitEB; exploded = true; break; }
            }
            // 膜との衝突判定（弾は通過不可、シャボン玉は通過可）
            if (!exploded) {
                const newPos = p.position.clone().addScaledVector(p.velocity, dt);
                for (const m of G.membranes) {
                    const halfW = m.w / 2;
                    const cx = m.mesh ? m.mesh.position.x : config.areaSize / 2;
                    const cz = m.mesh ? m.mesh.position.z : config.areaSize / 2;
                    if (newPos.x >= cx - halfW && newPos.x <= cx + halfW &&
                        newPos.z >= cz - halfW && newPos.z <= cz + halfW) {
                        // 弾が膜のY面を跨いだか判定 (ステップまたぎを考慮)
                        if ((p.position.y <= m.y && newPos.y >= m.y) ||
                            (p.position.y >= m.y && newPos.y <= m.y)) {
                            p._hitFlag = true; exploded = true; break;
                        }
                    }
                }
            }
            if (!exploded) p.position.addScaledVector(p.velocity, dt); else p.position.copy(cPos);
        } else if (!exploded && !G.isHost && G.isOnline) {
            // クライアント: 速度予測 + 視覚的な衝突判定（ダメージは適用しない）
            const pPassWall = p.props ? p.props.passWall : false;
            const pRadiusMult = p.props ? p.props.radiusMult : 1.0;
            const stepDist = p.velocity.length() * dt;
            const dir = p.velocity.clone().normalize();
            const cPos = p.position.clone();
            cPos.addScaledVector(dir, stepDist);

            // ブロック衝突（視覚用）
            if (!pPassWall) {
                const gx = Math.floor(cPos.x), gy = Math.floor(cPos.y), gz = Math.floor(cPos.z);
                if (G.mapGrid && G.mapGrid.has(`${gx},${gy},${gz}`)) {
                    p._hitFlag = true; exploded = true;
                }
            }

            // ネットワークエンティティ衝突（視覚用: メッシュ位置で判定）
            if (!exploded) {
                const cr = 0.6 * pRadiusMult, rSq = cr * cr;
                G.networkEntities.forEach(e => {
                    if (!e.mesh || exploded) return;
                    // メッシュ位置はbody位置から-0.37オフセットされているため補正
                    const ex = e.mesh.position.x, ey = e.mesh.position.y + 0.37, ez = e.mesh.position.z;
                    const dx = ex - cPos.x, dy = ey - cPos.y, dz = ez - cPos.z;
                    if (dx*dx + dy*dy + dz*dz < rSq) {
                        p._hitFlag = true; exploded = true;
                    }
                });
            }

            // 膜との衝突判定 (クライアント視覚用)
            if (!exploded) {
                for (const m of G.membranes) {
                    const halfW = m.w / 2;
                    const cx = m.mesh ? m.mesh.position.x : config.areaSize / 2;
                    const cz = m.mesh ? m.mesh.position.z : config.areaSize / 2;
                    if (cPos.x >= cx - halfW && cPos.x <= cx + halfW &&
                        cPos.z >= cz - halfW && cPos.z <= cz + halfW) {
                        // 弾が膜のY面を跨いだか判定
                        if ((p.position.y <= m.y && cPos.y >= m.y) ||
                            (p.position.y >= m.y && cPos.y <= m.y)) {
                            p._hitFlag = true; exploded = true; break;
                        }
                    }
                }
            }

            if (!exploded) p.position.copy(cPos);
            else p.position.copy(cPos);
        }

        const pRangeMult = p.props ? p.props.rangeMult : (config.projectileRangeMult || 1.0);
        const pSpeed = p.props ? p.props.speed : (config.projectileSpeed || 14.0);
        const pDamage = p.props ? p.props.damage : config.damageProjectile;

        const baseRange = 20.0;
        const maxLifeTime = (baseRange / pSpeed) * 1000 * pRangeMult;
        if (exploded || age > maxLifeTime || p.position.y < -20) {
            if (exploded && p._hitBody && (G.isHost || !G.isOnline)) {
                const dx = p._hitBody.position.x - p.position.x, dy = p._hitBody.position.y - p.position.y, dz = p._hitBody.position.z - p.position.z, d = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;
                const kbx = (dx / d) * 15, kby = -12, kbz = (dz / d) * 15;

                // 1. ホスト自身へのヒット処理
                if (p._hitBody === G.playerBody) {
                    if (G.isInvincible) {
                        p._hitFlag = false; // ヒットをキャンセル
                    } else {
                        G.lastDamageSourceId = p.ownerId || resolvePeerId(p.ownerBody);
                        takeDamage(pDamage);
                        G.playerBody.linearVelocity.x += kbx;
                        G.playerBody.linearVelocity.y += kby;
                        G.playerBody.linearVelocity.z += kbz;
                    }
                }

                // 2. ネットワークプレイヤーへのヒット処理
                if (G.isHost && G.isOnline) {
                    for (const [peerId, netEnt] of G.networkEntities) {
                        if (netEnt.body === p._hitBody) {
                            if (netEnt.isInvincible) break;
                            // [UPDATED] Hit Logic & Attribution
                            G.lastDamageSourceId = p.ownerId || resolvePeerId(p.ownerBody);
                            sendToClient(peerId, 21, { targetPeerId: peerId, damage: pDamage, kbx, kby, kbz, attackerId: G.lastDamageSourceId });
                            break;
                        }
                    }
                }

                G.entities.forEach(ent => {
                    if (ent.isAI && ent.body === p._hitBody) {
                        ent.lives = (ent.lives === undefined ? config.maxLives : ent.lives) - pDamage;
                        if (ent.lives <= 0) {
                            ent.isDead = true; ent.deathTimer = 3.0;
                            const ch = ent.body.position.y;
                            ent.body.resetPosition(config.areaSize / 2, Math.max(0, Math.floor((ch - 1) / 100) * 100) + 2.0, config.areaSize / 2);
                            ent.body.linearVelocity.set(0, 0, 0); ent.lives = config.maxLives;
                        }
                    }
                });
            }
            if (exploded && typeof createExplosion === 'function') createExplosion(p.position.x, p.position.y, p.position.z);
            if (G.isHost && p.netId != null) broadcastEvent(13, { netId: p.netId, type: 0, x: p.position.x, y: p.position.y, z: p.position.z });
            p.mesh.visible = false; G.projectilePool.push(p.mesh); if (p.netId != null) G.netObjects.delete(p.netId);
            G.projectiles.splice(i, 1);
        } else p.mesh.position.copy(p.position);
    }
}
