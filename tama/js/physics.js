// 物理エンジン・ステージ構築

function buildStadium(isOriginal = false) {
            stadiumBodies.forEach(b => world.removeRigidBody(b));
            stadiumBodies = [];
            stadiumMeshes.forEach(m => {
                scene.remove(m);
                if (m.geometry) m.geometry.dispose();
                if (m.material) {
                    if (Array.isArray(m.material)) m.material.forEach(mat => mat.dispose());
                    else m.material.dispose();
                }
            });
            stadiumMeshes = [];

            // シーンは常にレトロビジュアルで統一
            const useRetroVisuals = true;

            if (useRetroVisuals) {
                scene.background = new THREE.Color('rgb(105,97,91)');
                if (shadowLight) shadowLight.castShadow = true;
            } else {
                scene.background = new THREE.Color(0xdddddd);
                if (shadowLight) shadowLight.castShadow = true;
            }

            if (isOriginal) {
                if (useRetroVisuals) {
                    if (!originalModeLight) {
                        originalModeLight = new THREE.DirectionalLight(0xffffff, 0.6);
                        originalModeLight.position.set(40, 290, 250);
                        originalModeLight.castShadow = true;
                        originalModeLight.shadow.mapSize.width = 512;
                        originalModeLight.shadow.mapSize.height = 512;
                        const scs = params.size * 0.9;
                        originalModeLight.shadow.camera.left = -scs;
                        originalModeLight.shadow.camera.right = scs;
                        originalModeLight.shadow.camera.top = scs;
                        originalModeLight.shadow.camera.bottom = -scs;
                        originalModeLight.shadow.camera.near = 50;
                        originalModeLight.shadow.camera.far = 1000;
                        originalModeLight.shadow.bias = -0.001;
                    }
                    if (!scene.children.includes(originalModeLight)) scene.add(originalModeLight);
                    originalModeLight.intensity = 0.6;
                    dirLight.intensity = 0;
                } else {
                    if (originalModeLight) originalModeLight.intensity = 0;
                    dirLight.intensity = 0.6;
                }
            } else {
                if (originalModeLight) originalModeLight.intensity = 0;
                dirLight.intensity = 0.6;
            }

            if (typeof world !== 'undefined' && world.gravity) {
                world.gravity.set(0, -params.gravity * 60, 0);
            }

            let actualSlopeAngle = isOriginal ? origParams.slopeAngle : 35;
            let TAN_A = Math.tan(actualSlopeAngle * Math.PI / 180);
            let radA = actualSlopeAngle * Math.PI / 180;
            const floorHalf = params.size / 2;
            const wallW = (params.wallH * TAN_A) + params.wallT;
            const limit = floorHalf + wallW;

            clipPlanes = [
                new THREE.Plane(new THREE.Vector3(1, 0, 0), limit), new THREE.Plane(new THREE.Vector3(-1, 0, 0), limit),
                new THREE.Plane(new THREE.Vector3(0, 0, 1), limit), new THREE.Plane(new THREE.Vector3(0, 0, -1), limit)
            ];

            const floorBody = world.add({ size: [params.size, 60, params.size], pos: [0, -30, 0], density: 1, restitution: params.restitution, friction: params.friction });
            stadiumBodies.push(floorBody);

            let floorColor = useRetroVisuals ? getCompensatedColor(165, 158, 137, new THREE.Vector3(0, 1, 0), true) : new THREE.Color(0x666666);
            const floorMesh = new THREE.Mesh(new THREE.PlaneGeometry(params.size, params.size), new THREE.MeshLambertMaterial({ color: floorColor }));
            floorMesh.rotation.x = -Math.PI / 2; floorMesh.receiveShadow = true;
            scene.add(floorMesh);
            stadiumMeshes.push(floorMesh);

            function createWallGeom(width, height, depth) {
                const shape = new THREE.Shape();
                const sw = height * TAN_A;
                shape.moveTo(0, 0);
                shape.lineTo(0, height);
                shape.lineTo(depth, height);
                shape.lineTo(depth + sw, 0);
                shape.lineTo(0, 0);
                return new THREE.ExtrudeGeometry(shape, { depth: width, bevelEnabled: false });
            }

            const sw = params.wallH * TAN_A;
            const totalW = sw + params.wallT;

            let wallColor = useRetroVisuals ? getCompensatedColor(99, 10, 10, new THREE.Vector3(1, 0, 0), true) : new THREE.Color(0x880000);
            const wallMat = new THREE.MeshLambertMaterial({ color: wallColor });
            let slopeLen = params.wallH;
            if (actualSlopeAngle > 0) slopeLen = params.wallH / Math.cos(radA);

            const slopeThick = 6;
            const shift = (slopeThick - 0.1) / 2;
            const sDy = -shift * Math.cos(radA);
            const sDOut = shift * Math.sin(radA);

            for (let i = 0; i < 4; i++) {
                const currentLen = (i < 2) ? (params.size + totalW * 2) : params.size;
                const geom = createWallGeom(currentLen, params.wallH, params.wallT); geom.center();
                const wall = new THREE.Mesh(geom, wallMat);
                const pos = (params.size / 2) + (totalW / 2);
                let rotY = 0, px = 0, pz = 0;
                if (i === 0) { pz = -(pos - sw); rotY = -Math.PI / 2; }
                else if (i === 1) { pz = pos - sw; rotY = Math.PI / 2; }
                else if (i === 2) { px = -pos; rotY = 0; }
                else if (i === 3) { px = pos; rotY = Math.PI; }
                wall.position.set(px, params.wallH / 2, pz); wall.rotation.set(0, rotY, 0); wall.receiveShadow = true; scene.add(wall);
                stadiumMeshes.push(wall);

                let sx = i === 2 ? -((params.size / 2) + (sw / 2)) - sDOut : (i === 3 ? (params.size / 2) + (sw / 2) + sDOut : 0);
                let sy = params.wallH / 2 + sDy;
                let sz = i === 0 ? -((params.size / 2) + (sw / 2)) - sDOut : (i === 1 ? (params.size / 2) + (sw / 2) + sDOut : 0);

                let slopeRot = actualSlopeAngle;
                stadiumBodies.push(world.add({
                    size: [i < 2 ? currentLen : slopeThick, slopeLen, i < 2 ? slopeThick : currentLen],
                    pos: [sx, sy, sz],
                    rot: [i === 0 ? -slopeRot : (i === 1 ? slopeRot : 0), 0, i === 2 ? slopeRot : (i === 3 ? -slopeRot : 0)],
                    density: 1, restitution: params.restitution, friction: 0
                }));

                let wx = i === 2 ? -((params.size / 2) + sw + (params.wallT / 2)) : (i === 3 ? (params.size / 2) + sw + (params.wallT / 2) : 0);
                let wy = -params.wallH / 2;
                let wz = i === 0 ? -((params.size / 2) + sw + (params.wallT / 2)) : (i === 1 ? (params.size / 2) + sw + (params.wallT / 2) : 0);

                stadiumBodies.push(world.add({
                    size: [i < 2 ? currentLen : params.wallT, params.wallH * 3, i < 2 ? params.wallT : currentLen],
                    pos: [wx, wy, wz],
                    restitution: params.restitution, friction: params.friction
                }));

                const extraDepth = params.wallH * 1.6;

                const boxGeom = new THREE.BoxGeometry(
                    i < 2 ? currentLen : params.wallT + sw,
                    extraDepth,
                    i < 2 ? params.wallT + sw : currentLen
                );

                const box = new THREE.Mesh(boxGeom, wallMat);
                box.position.set(px, -extraDepth / 2, pz);
                box.receiveShadow = true;
                scene.add(box);
                stadiumMeshes.push(box);

                stadiumBodies.push(world.add({
                    size: [i < 2 ? currentLen : params.wallT + sw, extraDepth, i < 2 ? params.wallT + sw : currentLen],
                    pos: [px, -extraDepth / 2, pz],
                    restitution: params.restitution, friction: params.friction
                }));
            }
        }


function createWallGeom(width, height, depth) {
                const shape = new THREE.Shape();
                const sw = height * TAN_A;
                shape.moveTo(0, 0);
                shape.lineTo(0, height);
                shape.lineTo(depth, height);
                shape.lineTo(depth + sw, 0);
                shape.lineTo(0, 0);
                return new THREE.ExtrudeGeometry(shape, { depth: width, bevelEnabled: false });
            }


function createShockwave(x, y, z, nx, ny, nz, impactSpeed = 100) {
            const speedFact = Math.min(1.0, impactSpeed / 400);
            const decayRate = 0.0166 / speedFact;
            const ringMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8 });
            const ring = new THREE.Mesh(sharedTorusGeom, ringMat);
            ring.position.set(x, y, z);
            ring.lookAt(new THREE.Vector3(x + nx, y + ny, z + nz));
            ring.scale.set(1.0, 1.0, 1.0);
            scene.add(ring);
            effects.push({ type: 'ring', mesh: ring, life: 1.0, speed: 1.2, decayRate: decayRate });

            for (let i = 0; i < 25; i++) {
                const sMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 1.0 });
                const spark = new THREE.Mesh(sharedSparkGeom, sMat);
                spark.position.set(x, y, z);

                const speed = 2.5 + Math.random() * 9.5;
                const vx = (nx + (Math.random() - 0.3) * 2.5) * speed;
                const vy = (ny + (Math.random() - 0.3) * 2.5) * speed;
                const vz = (nz + (Math.random() - 0.3) * 2.5) * speed;

                scene.add(spark);
                effects.push({ type: 'spark', mesh: spark, velocity: new THREE.Vector3(vx, vy, vz), life: 1.0, decayRate: decayRate });
            }
        }


function handleClientVisualCollisions() {
            if (!isClientMode) return;

            const entities = [];
            if (ballBody.isAlive && sphere.visible) {
                entities.push({ id: myPeerId, pos: sphere.position, vel: selfSync.vel });
            }
            for (let id in remoteEntities) {
                const re = remoteEntities[id];
                if (re.body && re.body.isAlive && re.mesh.visible) {
                    entities.push({ id: id, pos: re.mesh.position, vel: re.velocity });
                }
            }

            const margin = 1.02;
            const radiusSum = params.ballRadius * 2.0 * margin;
            const radiusSumSq = radiusSum * radiusSum;

            for (let i = 0; i < entities.length; i++) {
                for (let j = i + 1; j < entities.length; j++) {
                    const e1 = entities[i];
                    const e2 = entities[j];

                    const dx = e1.pos.x - e2.pos.x;
                    const dy = e1.pos.y - e2.pos.y;
                    const dz = e1.pos.z - e2.pos.z;
                    const distSq = dx * dx + dy * dy + dz * dz;

                    const pairKey = e1.id < e2.id ? e1.id + '_' + e2.id : e2.id + '_' + e1.id;

                    if (distSq < radiusSumSq) {
                        if (!clientActiveCollisions.has(pairKey)) {
                            clientActiveCollisions.add(pairKey);

                            const dist = Math.sqrt(distSq);
                            const nx = dx / (dist || 1);
                            const ny = dy / (dist || 1);
                            const nz = dz / (dist || 1);

                            const speed1 = Math.sqrt(e1.vel.x ** 2 + e1.vel.y ** 2 + e1.vel.z ** 2);
                            const speed2 = Math.sqrt(e2.vel.x ** 2 + e2.vel.y ** 2 + e2.vel.z ** 2);

                            if (speed1 > 12 || speed2 > 12) {
                                const midX = (e1.pos.x + e2.pos.x) / 2;
                                const midY = (e1.pos.y + e2.pos.y) / 2;
                                const midZ = (e1.pos.z + e2.pos.z) / 2;

                                createShockwave(midX, midY, midZ, nx, ny, nz, Math.max(speed1, speed2));
                            }
                        }
                    } else {
                        clientActiveCollisions.delete(pairKey);
                    }
                }
            }
        }


function handleGlobalCollisions() {
            if (isClientMode) return;
            
            _gcBodies.length = 0;
            _gcIds.length = 0;
            if (ballBody.isAlive) { _gcBodies.push(ballBody); _gcIds.push(myPeerId); }
            for (let i = 0; i < aiEntities.length; i++) {
                const e = aiEntities[i];
                if (e.body.isAlive) { _gcBodies.push(e.body); _gcIds.push(e.id); }
            }
            for (let id in remoteEntities) {
                const re = remoteEntities[id];
                if (re.isInputDriven && re.body && re.body.isAlive) { _gcBodies.push(re.body); _gcIds.push(id); }
            }
            for (let i = 0; i < _gcBodies.length; i++) {
                for (let j = i + 1; j < _gcBodies.length; j++) {
                    processCollision(_gcBodies[i], _gcBodies[j], _gcIds[i], _gcIds[j]);
                }
            }
        }


function processCollision(b1, b2, id1, id2) {
            if (b1.team && b2.team && b1.team === b2.team && b1.team !== "none") return;
            const p1 = b1.getPosition(), p2 = b2.getPosition(); const dx = p1.x - p2.x, dy = p1.y - p2.y, dz = p1.z - p2.z; const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
            if (dist < params.ballRadius * 2.0) {
                b1.lastTouchedBy = b2; b2.lastTouchedBy = b1;
                const nx = dx / dist, ny = dy / dist, nz = dz / dist; const v1 = b1.linearVelocity, v2 = b2.linearVelocity; const rvX = v1.x - v2.x, rvY = v1.y - v2.y, rvZ = v1.z - v2.z;
                const vNormal = rvX * nx + rvY * ny + rvZ * nz; const impactSpeed = Math.abs(vNormal);

                if (vNormal < 0) {
                    if (isKnockbackMode || isSurvivalMode) {
                        if (isKnockbackMode) {
                            if (typeof b1.stress === 'undefined') b1.stress = 0;
                            if (typeof b2.stress === 'undefined') b2.stress = 0;
                            const s1 = Math.sqrt(v1.x ** 2 + v1.y ** 2 + v1.z ** 2);
                            const s2 = Math.sqrt(v2.x ** 2 + v2.y ** 2 + v2.z ** 2);
                            let ratio1, ratio2;
                            if (knockbackExponent === 99) {
                                if (s1 > s2) {
                                    ratio1 = 0; ratio2 = 1;
                                } else if (s2 > s1) {
                                    ratio1 = 1; ratio2 = 0;
                                } else {
                                    ratio1 = 0.5; ratio2 = 0.5; 
                                }
                            } else {
                                const p1 = Math.pow(s1, knockbackExponent);
                                const p2 = Math.pow(s2, knockbackExponent);
                                const total_pow = p1 + p2 + 0.0001;
                                ratio1 = p2 / total_pow;
                                ratio2 = p1 / total_pow;
                            }

                            const baseStress = impactSpeed * 0.0125 * knockbackRate * 2.0;
                            b1.stress += baseStress * ratio1;
                            b2.stress += baseStress * ratio2;
                            b1.totalStressGiven = (b1.totalStressGiven || 0) + (baseStress * ratio2);
                            b2.totalStressGiven = (b2.totalStressGiven || 0) + (baseStress * ratio1);
                        }

                        if (b1 === ballBody || b2 === ballBody) { playerSpriteObj.lastLives = null; playerSpriteObj.lastStress = null; }
                        if (id1 && remoteEntities[id1]) { remoteEntities[id1].lastLives = null; remoteEntities[id1].lastStress = null; }
                        if (id2 && remoteEntities[id2]) { remoteEntities[id2].lastLives = null; remoteEntities[id2].lastStress = null; }
                        const ai1 = aiEntities.find(e => e.body === b1); if (ai1) { ai1.lastLives = null; ai1.lastStress = null; }
                        const ai2 = aiEntities.find(e => e.body === b2); if (ai2) { ai2.lastLives = null; ai2.lastStress = null; }

                        if (id1) broadcastEvent({ eventType: 'stat_change', id: id1, stress: b1.stress || 0, lives: b1.lives || 0, given: b1.totalStressGiven || 0, kills: b1.kills || 0 });
                        if (id2) broadcastEvent({ eventType: 'stat_change', id: id2, stress: b2.stress || 0, lives: b2.lives || 0, given: b2.totalStressGiven || 0, kills: b2.kills || 0 });
                        updateLeaderboard();
                    }

                    let m1 = 1.0, m2 = 1.0;
                    if (isKnockbackMode) { m1 = 1.0 + (b1.stress / 50.0); m2 = 1.0 + (b2.stress / 50.0); }
                    const baseImpulse = -(1 + params.restitution) * vNormal * 4200;
                    b1.applyImpulse(p1, { x: nx * baseImpulse * m1, y: ny * baseImpulse * m1, z: nz * baseImpulse * m1 });
                    b2.applyImpulse(p2, { x: -nx * baseImpulse * m2, y: -ny * baseImpulse * m2, z: -nz * baseImpulse * m2 });

                    aiEntities.forEach(e => {
                        if (e.body === b1 || e.body === b2) {
                            if (e.aiLv < 8) e.stress = Math.min(1.0, (e.stress || 0) + (Math.abs(vNormal) * 0.05));
                            e.lastLives = null; e.lastStress = null;
                        }
                    });

                    if (Math.abs(vNormal) > 12) {
                        const midX = (p1.x + p2.x) / 2, midY = (p1.y + p2.y) / 2, midZ = (p1.z + p2.z) / 2;
                        createShockwave(midX, midY, midZ, nx, ny, nz, Math.abs(vNormal));
                        // ホストなら全員に通知
                        if (!isClientMode) {
                            broadcastEvent({ eventType: 'shockwave', x: midX, y: midY, z: midZ, nx: nx, ny: ny, nz: nz, speed: Math.abs(vNormal) });
                        }
                    }
                }
            }
        }