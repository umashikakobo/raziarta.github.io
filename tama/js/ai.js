// AI行動ロジック

function updateAI(entity, candidates, posCache) {
            if (!entity.body.isAlive) return;
            const ePos = posCache.get(entity.body); if (!ePos || ePos.y < -100) return;
            const lvNum = entity.aiLv; entity.frameCount++;
            if (lvNum < 8) entity.stress = (entity.stress || 0) * 0.995; else entity.stress = 0;
            if (typeof entity.isTeamPress === 'undefined') entity.isTeamPress = false;
            const stressImpact = entity.stress * (1.0 - (lvNum * 0.1));
            const interval = Math.max(1, entity.updateInterval);

            if (entity.frameCount % interval === 0) {
                let centroidX = 0, centroidZ = 0; let enemyCount = 0; const enemies = [];
                for (const c of candidates) {
                    if (!c || c === entity.body || !c.isAlive) continue;
                    if (c.team !== entity.body.team || c.team === "none" || entity.body.team === "none") {
                        const p = posCache.get(c); if (!p || p.y < -100) continue;
                        centroidX += p.x; centroidZ += p.z; enemyCount++; enemies.push(c);
                    }
                }
                if (enemyCount > 0) { centroidX /= enemyCount; centroidZ /= enemyCount; }

                let targetX = 0, targetZ = 0; const accMap = [-0.15, -0.10, -0.10, -0.05, -0.05, -0.05, -0.05, 0.00, 0.15, 0.30]; const accuracy = accMap[Math.max(0, Math.min(9, lvNum - 1))];
                let teammatesNearCount = 0; let teamPressPos = null; const myTeam = entity.body.team;
                for (const c of candidates) {
                    if (c !== entity.body && c.isAlive && c.team === myTeam && myTeam !== "none") {
                        const _cp = posCache.get(c); if (!_cp) continue;
                        const dist = Math.sqrt((_cp.x - ePos.x) ** 2 + (_cp.z - ePos.z) ** 2);
                        if (dist < 150) { teammatesNearCount++; teamPressPos = posCache.get(c); }
                    }
                }
                entity.isTeamPress = (teammatesNearCount > 0);
                let margin = 0.90 - (lvNum * 0.01); if (entity.isTeamPress) margin += 0.15;
                const limit = params.size / 2; const isNearEdge = Math.abs(ePos.x) > limit * margin || Math.abs(ePos.z) > limit * margin;
                const myVel = entity.body.linearVelocity; const mySpeed = Math.sqrt(myVel.x ** 2 + myVel.z ** 2);

                let dodgeAction = false;
                if (lvNum >= 6 && mySpeed > -1) {
                    for (let c of candidates) {
                        if (!c || c === entity.body || !c.isAlive || (c.team === myTeam && myTeam !== "none")) continue;
                        const cPos = posCache.get(c); if (!cPos || cPos.y < -100) continue; const cVel = c.linearVelocity;
                        const dx = cPos.x - ePos.x, dz = cPos.z - ePos.z;
                        const dist = Math.sqrt(dx * dx + dz * dz) || 1;
                        if (dist < 250) {
                            const relVx = cVel.x - myVel.x;
                            const relVz = cVel.z - myVel.z;
                            const relSpdSq = relVx * relVx + relVz * relVz;

                            if (relSpdSq > 100) { 
                                const tCPA = -(dx * relVx + dz * relVz) / relSpdSq;

                                if (tCPA > 0 && tCPA < 45) { 
                                    const cpaX = dx + relVx * tCPA;
                                    const cpaZ = dz + relVz * tCPA;
                                    const cpaDistSq = cpaX * cpaX + cpaZ * cpaZ;

                                    if (cpaDistSq < (params.ballRadius * 2.5) ** 2) {
                                        const speed = Math.sqrt(relSpdSq);
                                        const perpX1 = -relVz / speed, perpZ1 = relVx / speed;
                                        const perpX2 = relVz / speed, perpZ2 = -relVx / speed;

                                        const dist1 = (ePos.x + perpX1 * 100) ** 2 + (ePos.z + perpZ1 * 100) ** 2;
                                        const dist2 = (ePos.x + perpX2 * 100) ** 2 + (ePos.z + perpZ2 * 100) ** 2;

                                        let dodgeVx, dodgeVz;
                                        if (dist1 < dist2) { dodgeVx = perpX1 * params.maxSpeed; dodgeVz = perpZ1 * params.maxSpeed; }
                                        else { dodgeVx = perpX2 * params.maxSpeed; dodgeVz = perpZ2 * params.maxSpeed; }

                                        targetX = dodgeVx - myVel.x;
                                        targetZ = dodgeVz - myVel.z;

                                        if (lvNum >= 8 && ePos.y < 15 && dist < params.ballRadius * 4) {
                                            entity.body.applyImpulse(ePos, { x: 0, y: 150, z: 0 });
                                        }

                                        dodgeAction = true; break;
                                    }
                                }
                            }
                        }
                    }
                }

                let counterAction = false;
                if (!dodgeAction && lvNum >= 5 && isNearEdge) {
                    for (let c of candidates) {
                        if (!c || c === entity.body || !c.isAlive || (c.team === myTeam && myTeam !== "none")) continue;
                        const _cpos1 = posCache.get(c); if (!_cpos1) continue;
                        const dx = _cpos1.x - ePos.x, dz = _cpos1.z - ePos.z, dist = Math.sqrt(dx * dx + dz * dz);
                        const counterDist = entity.isTeamPress ? 40 : 60;
                        if (dist < counterDist && (-(dx * (c.linearVelocity.x - myVel.x) + dz * (c.linearVelocity.z - myVel.z)) / dist) > (params.maxSpeed - 20)) {
                            targetX = -myVel.x; targetZ = -myVel.z; counterAction = true;
                            if (lvNum >= 8 && ePos.y < 15) entity.body.applyImpulse(ePos, { x: 0, y: 150, z: 0 }); break;
                        }
                    }
                }

                if (!dodgeAction && !counterAction) {
                    if (isNearEdge && !entity.isTeamPress && (lvNum >= 8 || Math.random() > stressImpact * 0.5)) {
                        targetX = -ePos.x; targetZ = -ePos.z; if (lvNum >= 8 && ePos.y < 15) entity.body.applyImpulse(ePos, { x: 0, y: 260, z: 0 });
                    } else {
                        let target = null, maxP = -Infinity;
                        candidates.forEach(c => {
                            if (!c || c === entity.body || !c.isAlive || (c.team === myTeam && myTeam !== "none")) return;
                            const cPos = posCache.get(c); if (!cPos || cPos.y < -100) return; const dist = Math.sqrt((cPos.x - ePos.x) ** 2 + (cPos.z - ePos.z) ** 2);
                            let score = 1000 / (dist + 1);
                            let isFighting = false;
                            for (let other of enemies) { if (other !== c) { const op = other.getPosition(); const d2 = (cPos.x - op.x) ** 2 + (cPos.z - op.z) ** 2; if (d2 < 10000) { isFighting = true; break; } } }
                            if (isFighting) score *= 1.8;
                            const cVel = c.linearVelocity; const speed = Math.sqrt(cVel.x ** 2 + cVel.z ** 2);
                            if (speed > 50) { const toMeX = ePos.x - cPos.x; const toMeZ = ePos.z - cPos.z; const dMe = Math.sqrt(toMeX ** 2 + toMeZ ** 2); const dot = (cVel.x / speed) * (toMeX / dMe) + (cVel.z / speed) * (toMeZ / dMe); if (dot > 0.8) score *= 2.5; }
                            if (entity.isTeamPress && teamPressPos) { const _cp2 = posCache.get(c); if (!_cp2) return; const distFromPack = Math.sqrt((_cp2.x - teamPressPos.x) ** 2 + (_cp2.z - teamPressPos.z) ** 2); score += 500 / (distFromPack + 1); }
                            if (score > maxP) { maxP = score; target = c; }
                        });

                        if (target) {
                            const tPos = target.getPosition(); const tVel = target.linearVelocity;

                            target.oldVelocity = target.oldVelocity || { x: tVel.x, y: tVel.y, z: tVel.z };
                            const tAccelX = tVel.x - target.oldVelocity.x;
                            const tAccelZ = tVel.z - target.oldVelocity.z;
                            target.oldVelocity = { x: tVel.x, y: tVel.y, z: tVel.z };

                            let futureX = tPos.x;
                            let futureZ = tPos.z;
                            let tti = 0;
                            const dist = Math.sqrt((tPos.x - ePos.x) ** 2 + (tPos.z - ePos.z) ** 2) || 1; 

                            for (let iter = 0; iter < 3; iter++) {
                                const dx = futureX - ePos.x;
                                const dz = futureZ - ePos.z;
                                const dIter = Math.sqrt(dx * dx + dz * dz) || 1;

                                const relVx = tVel.x - myVel.x;
                                const relVz = tVel.z - myVel.z;
                                const closureRate = -(dx * relVx + dz * relVz) / dIter;

                                const vClose = Math.max(closureRate, params.maxSpeed * 0.5, 20);
                                tti = dIter / vClose;

                                futureX = tPos.x + (tVel.x * tti) + (0.5 * tAccelX * tti * tti);
                                futureZ = tPos.z + (tVel.z * tti) + (0.5 * tAccelZ * tti * tti);

                                if (accuracy > 0 && lvNum >= 9) {
                                    futureX += tVel.x * tti * (accuracy * 0.5);
                                    futureZ += tVel.z * tti * (accuracy * 0.5);
                                }
                            }

                            if (tti > 60 && lvNum >= 7) {
                                futureX = (tPos.x + 0) / 2; 
                                futureZ = (tPos.z + 0) / 2;
                            }

                            if (accuracy < 0) {
                                const finalDist = Math.sqrt((futureX - ePos.x) ** 2 + (futureZ - ePos.z) ** 2);
                                const noise = finalDist * Math.abs(accuracy);
                                futureX += (Math.random() - 0.5) * noise;
                                futureZ += (Math.random() - 0.5) * noise;
                            }

                            const toFutureX = futureX - ePos.x;
                            const toFutureZ = futureZ - ePos.z;
                            const distToFuture = Math.sqrt(toFutureX * toFutureX + toFutureZ * toFutureZ) || 1;

                            const desiredVx = (toFutureX / distToFuture) * params.maxSpeed;
                            const desiredVz = (toFutureZ / distToFuture) * params.maxSpeed;

                            targetX = desiredVx - myVel.x;
                            targetZ = desiredVz - myVel.z;

                            if (enemyCount >= 2) { const cDist = Math.sqrt((ePos.x - centroidX) ** 2 + (ePos.z - centroidZ) ** 2); if (cDist < 150) { const pushX = ePos.x - centroidX; const pushZ = ePos.z - centroidZ; targetX += pushX * 2.0; targetZ += pushZ * 2.0; } }
                            const tarVel = target.linearVelocity; const tSpeed = Math.sqrt(tarVel.x ** 2 + tarVel.z ** 2);
                            if (tSpeed > 80) { const toMeX = ePos.x - target.getPosition().x; const toMeZ = ePos.z - target.getPosition().z; const dMe = Math.sqrt(toMeX ** 2 + toMeZ ** 2); const dot = (tarVel.x / tSpeed) * (toMeX / dMe) + (tarVel.z / tSpeed) * (toMeZ / dMe); if (dot > 0.9) { targetX += -toMeZ * 1.5; targetZ += toMeX * 1.5; } }
                            if (lvNum >= 9 && tPos.y > 15) { const g = 372; const vy = tVel.y; const D = vy * vy + 2 * g * tPos.y; if (D >= 0) { const tLand = (vy + Math.sqrt(D)) / g; const landX = tPos.x + tVel.x * tLand; const landZ = tPos.z + tVel.z * tLand; targetX = landX - ePos.x; targetZ = landZ - ePos.z; } }
                            if (lvNum >= 9 && dist < (params.ballRadius * 2.2)) { const centerDistMe = Math.sqrt(ePos.x ** 2 + ePos.z ** 2); const centerDistTar = Math.sqrt(tPos.x ** 2 + tPos.z ** 2); if (centerDistTar > centerDistMe) { targetX = tPos.x - ePos.x; targetZ = tPos.z - ePos.z; } } if (lvNum >= 7 && dist > 70 && dist < 150 && tSpeed > 40) {
                                const toMeX = ePos.x - tPos.x; const toMeZ = ePos.z - tPos.z; const dMe = Math.sqrt(toMeX ** 2 + toMeZ ** 2);
                                const dot = (tarVel.x / tSpeed) * (toMeX / dMe) + (tarVel.z / tSpeed) * (toMeZ / dMe);
                                if (dot > 0.8) {
                                    const turnSide = (entity.frameCount % 60 < 30) ? 1 : -1;
                                    const currentTx = targetX, currentTz = targetZ;
                                    targetX = -currentTz * turnSide * 2.5;
                                    targetZ = currentTx * turnSide * 2.5;
                                }
                            }

                            if (lvNum >= 8) {
                                const tDistFromCenter = Math.sqrt(tPos.x ** 2 + tPos.z ** 2);
                                const fieldLimit = params.size / 2;
                                if (tDistFromCenter > fieldLimit * 0.75) {
                                    const outX = tPos.x / tDistFromCenter;
                                    const outZ = tPos.z / tDistFromCenter;

                                    const idealX = tPos.x - outX * 60;
                                    const idealZ = tPos.z - outZ * 60;

                                    const distToIdeal = Math.sqrt((idealX - ePos.x) ** 2 + (idealZ - ePos.z) ** 2);

                                    if (distToIdeal > 35) {
                                        targetX = idealX - ePos.x;
                                        targetZ = idealZ - ePos.z;
                                    } else {
                                        targetX = outX * 100;
                                        targetZ = outZ * 100;
                                    }
                                }
                            }
                        }
                    }
                }

                let isBraking = false;
                if (lvNum >= 4) {
                    const distFromCenterStr = Math.sqrt(ePos.x ** 2 + ePos.z ** 2);
                    if (distFromCenterStr > params.size * 0.35) {
                        const velOutwardDot = (myVel.x * ePos.x + myVel.z * ePos.z) / Math.max(1, distFromCenterStr);
                        if (velOutwardDot > params.maxSpeed * (isEscalationMode ? 0.3 : 0.6)) {
                            targetX = -myVel.x * (isEscalationMode ? 2.5 : 2.0) - ePos.x * 0.5;
                            targetZ = -myVel.z * (isEscalationMode ? 2.5 : 2.0) - ePos.z * 0.5;
                            isBraking = true;
                        }
                    }
                }

                if (!isBraking && ePos.y > 35) {
                    const g = params.gravity || 372;
                    const vy = myVel.y;
                    const h = ePos.y;

                    const D = vy * vy + 2 * g * h;
                    const tLand = (D >= 0) ? (vy + Math.sqrt(D)) / g : 0.5; 

                    const projectLx = ePos.x + myVel.x * tLand;
                    const projectLz = ePos.z + myVel.z * tLand;

                    const limitR = (params.size / 2) * 0.75; 
                    const quadrants = [
                        { x: limitR / 2, z: limitR / 2, count: 0 },   
                        { x: -limitR / 2, z: limitR / 2, count: 0 },  
                        { x: -limitR / 2, z: -limitR / 2, count: 0 }, 
                        { x: limitR / 2, z: -limitR / 2, count: 0 }   
                    ];

                    candidates.forEach(c => {
                        if (c && c !== entity.body && c.isAlive) {
                            const cp = posCache.get(c); if (!cp || cp.y >= 20) return;
                            if (cp.x >= 0 && cp.z >= 0) quadrants[0].count++;
                            else if (cp.x < 0 && cp.z >= 0) quadrants[1].count++;
                            else if (cp.x < 0 && cp.z < 0) quadrants[2].count++;
                            else quadrants[3].count++;
                        }
                    });

                    let bestQ = quadrants[0];
                    for (let q of quadrants) { if (q.count < bestQ.count) bestQ = q; }

                    const errX = bestQ.x - projectLx;
                    const errZ = bestQ.z - projectLz;
                    const errDistSq = errX * errX + errZ * errZ;

                    const distProjSq = projectLx * projectLx + projectLz * projectLz;
                    const isOutside = distProjSq > (params.size / 2) ** 2;

                    if (!isOutside && errDistSq < 10000) {
                        targetX = -myVel.x;
                        targetZ = -myVel.z;
                    } else {
                        targetX = errX;
                        targetZ = errZ;
                    }

                    const forceMult = (isEscalationMode || isOutside) ? 2.5 : 1.5;
                    targetX *= forceMult; targetZ *= forceMult;
                }

                if (!isBraking && ePos.y <= 35) {
                    const criticalDistSq = ((params.size / 2) * 0.88) ** 2;
                    if ((ePos.x ** 2 + ePos.z ** 2) > criticalDistSq) { targetX = -ePos.x; targetZ = -ePos.z; }
                }

                const len = Math.sqrt(targetX * targetX + targetZ * targetZ);
                if (len > 0.01) {
                    entity.lastTX = targetX / len;
                    entity.lastTZ = targetZ / len;
                } else {
                    entity.lastTX = 0;
                    entity.lastTZ = 0;
                }
            }

            if (isKnockbackMode && entity.body.stress > 20) {
                const limit = params.size / 2; const distFromCenter = Math.sqrt(ePos.x ** 2 + ePos.z ** 2);
                if (distFromCenter > limit * 0.7) {
                    const toCenterX = -ePos.x / distFromCenter; const toCenterZ = -ePos.z / distFromCenter; entity.lastTX = toCenterX; entity.lastTZ = toCenterZ;
                    if (ePos.y < 20 && Math.random() < 0.1) { entity.body.applyImpulse(ePos, { x: 0, y: 260, z: 0 }); }
                }
            }

            const airMult = (ePos.y < 10.5 || (ePos.y >= 10.5 && (Math.abs(ePos.x) > params.size / 2 || Math.abs(ePos.z) > params.size / 2))) ? 1.0 : 0.8;
            let currentAccelParam = params.accel; if (entity.isTeamPress) currentAccelParam *= 1.3;
            const delay = (lvNum >= 9) ? 1.0 : params.jerk * (0.5 + (lvNum * 0.18));
            entity.accel.x += (entity.lastTX * currentAccelParam * airMult - entity.accel.x) * delay; entity.accel.z += (entity.lastTZ * currentAccelParam * airMult - entity.accel.z) * delay;
            entity.body.linearVelocity.x += entity.accel.x; entity.body.linearVelocity.z += entity.accel.z;

        }

