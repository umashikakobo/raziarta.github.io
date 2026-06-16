// カメラシステム

function toggleCameraMode() {
            const modes = ['DEFAULT', '1ST', '3RD'];
            const nextMode = modes[(modes.indexOf(cameraMode) + 1) % modes.length];
            setCameraMode(nextMode);
        }


function setCameraMode(mode, instant) {
            cameraMode = mode;
            const btn = document.getElementById('btn-camera');
            if (btn) btn.innerText = `CAMERA: ${cameraMode}`;
            updateCameraPos(instant);

            const camContainer = document.getElementById('cam-joystick-container');
            if (camContainer) {
                if ((cameraMode === '1ST' || cameraMode === '3RD') && isMobile) {
                    camContainer.style.display = 'flex';
                } else {
                    camContainer.style.display = 'none';
                    if (typeof camJoy !== 'undefined') {
                        camJoy.active = false;
                        camJoy.x = 0;
                        camJoy.y = 0;
                        const camInner = document.getElementById('cam-joystick-inner');
                        if (camInner) camInner.style.transform = `translate(0px, 0px)`;
                    }
                }
            }
        }


function updateCameraPos(instant) {
            if (!ballBody || !sphere) return;

            if (!updateCameraPos.currentLookAt) updateCameraPos.currentLookAt = new THREE.Vector3(0, 0, 30);
            const isPortrait = window.innerHeight > window.innerWidth;

            let targetEntity = null;
            if (!ballBody.isAlive || ballBody.lives <= 0) {
                const getSpectatorList = () => {
                    const list = [];
                    aiEntities.forEach(e => { if (e.body && e.body.isAlive) list.push({ id: e.id, body: e.body, mesh: e.mesh }); });
                    for (let id in remoteEntities) { const re = remoteEntities[id]; if (re.body && re.body.isAlive) list.push({ id: id, body: re.body, mesh: re.mesh }); }
                    if (list.length === 0) {
                        if (ballBody.isMatchParticipant) list.push({ id: myPeerId, body: ballBody, mesh: sphere });
                        aiEntities.forEach(e => { if (e.body) list.push({ id: e.id, body: e.body, mesh: e.mesh }); });
                        for (let id in remoteEntities) { const re = remoteEntities[id]; if (re.body) list.push({ id: id, body: re.body, mesh: re.mesh }); }
                    }
                    return list.sort((a, b) => a.id.localeCompare(b.id));
                };

                const spectatorList = getSpectatorList();
                if (spectatorList.length > 0) {
                    if (!spectatorTargetId || (spectatorTargetId === myPeerId && !ballBody.isAlive)) {
                        spectatorTargetId = spectatorList[0].id;
                    }
                    targetEntity = spectatorList.find(e => e.id === spectatorTargetId);
                    if (!targetEntity || !targetEntity.body.isAlive) {
                        const aliveOne = spectatorList.find(e => e.body.isAlive);
                        if (aliveOne) {
                            spectatorTargetId = aliveOne.id;
                            targetEntity = aliveOne;
                        } else {
                            spectatorTargetId = spectatorList[0].id;
                            targetEntity = spectatorList[0];
                        }
                    }
                }
            }

            const bPos = (targetEntity) ? (isClientMode ? targetEntity.mesh.position : targetEntity.body.getPosition()) : (isClientMode ? sphere.position : ballBody.getPosition());
            const isOutOfArena = bPos.y < -100 || Math.abs(bPos.x) > 5000 || Math.abs(bPos.z) > 5000;

            if (cameraMode === 'DEFAULT' && (!ballBody.isAlive || isOutOfArena)) {
                sphere.visible = ballBody.isAlive && !targetEntity;
                if (playerSpriteObj._spriteRes && !ballBody.isAlive) playerSpriteObj._spriteRes.sprite.visible = false;

                const snapY = isMobile ? (isPortrait ? (document.fullscreenElement ? 1250 : 1150) : 630) : 550;
                const snapZ = isMobile ? (isPortrait ? (document.fullscreenElement ? 1250 : 1150) : 630) : 550;

                const targetFov = isOriginalActive ? origParams.camFov : 25;
                if (camera.near !== 1 || camera.fov !== targetFov) {
                    camera.near = 1; camera.far = 5000;
                    camera.fov = targetFov;
                    camera.updateProjectionMatrix();
                }
                if (instant) {
                    camera.position.set(0, snapY, snapZ);
                    updateCameraPos.currentLookAt.set(0, 0, 30);
                } else {
                    camera.position.lerp(new THREE.Vector3(0, snapY, snapZ), 0.05);
                    updateCameraPos.currentLookAt.lerp(new THREE.Vector3(0, 0, 30), 0.05);
                }
                camera.lookAt(updateCameraPos.currentLookAt);
                return;
            }

            if (cameraMode !== 'DEFAULT' && targetEntity && !targetEntity.body.isAlive) {
                sphere.visible = (targetEntity.id === myPeerId);
                if (playerSpriteObj._spriteRes && targetEntity.id === myPeerId) playerSpriteObj._spriteRes.sprite.visible = false;

                const camTargetY = 350; const camTargetZ = 250;
                const targetFov = isOriginalActive ? origParams.camFov : 25;
                if (camera.near !== 1 || camera.fov !== targetFov) {
                    camera.near = 1; camera.far = 5000; camera.fov = targetFov; camera.updateProjectionMatrix();
                }
                if (instant) {
                    camera.position.set(0, camTargetY, camTargetZ);
                    updateCameraPos.currentLookAt.set(0, 0, 0);
                } else {
                    camera.position.lerp(new THREE.Vector3(0, camTargetY, camTargetZ), 0.05);
                    updateCameraPos.currentLookAt.lerp(new THREE.Vector3(0, 0, 0), 0.05);
                }
                camera.lookAt(updateCameraPos.currentLookAt);
                return;
            }
            const bp = (targetEntity) ? (isClientMode ? targetEntity.mesh.position : targetEntity.body.getPosition()) : (isClientMode ? sphere.position : ballBody.getPosition());
            const targetSphere = (targetEntity) ? targetEntity.mesh : sphere;

            if (cameraMode === 'DEFAULT') {
                if (!targetEntity) sphere.visible = true;
                if (playerSpriteObj._spriteRes) playerSpriteObj._spriteRes.sprite.visible = ballBody.isAlive && !targetEntity;
                document.getElementById('player-hud').style.display = 'none';
                camera.up.set(0, 1, 0);

                let targetY = 550; let targetZ = 550;

                if (isOriginalActive) {
                    targetY = 350; targetZ = 250;
                    if (camera.fov !== origParams.camFov || camera.near !== 1) {
                        camera.near = 1; camera.far = 5000; camera.fov = origParams.camFov; camera.updateProjectionMatrix();
                    }
                } else {
                    if (camera.fov !== 25 || camera.near !== 1) {
                        camera.near = 1; camera.far = 5000; camera.fov = 25; camera.updateProjectionMatrix();
                    }
                    if (isMobile) {
                        if (isPortrait) { targetY = document.fullscreenElement ? 1250 : 1150; targetZ = document.fullscreenElement ? 1250 : 1150; }
                        else { targetY = 630; targetZ = 630; }
                    }
                }

                let clampedSpeed = params.maxSpeed;
                if (clampedSpeed < 240) clampedSpeed = 240;
                if (clampedSpeed > 420) clampedSpeed = 420;
                let totalRatio = (clampedSpeed / 480.0) + 0.5;

                if (isCameraAutoZoom) {
                    let currentPos = null;
                    if (isClientMode && typeof sphere !== 'undefined' && sphere.position) {
                        currentPos = { x: sphere.position.x, y: sphere.position.y, z: sphere.position.z };
                    } else if (typeof ballBody !== 'undefined' && ballBody.getPosition) {
                        currentPos = { x: ballBody.getPosition().x, y: ballBody.getPosition().y, z: ballBody.getPosition().z };
                    }
                    if (currentPos && currentPos.y > -50) {
                        const halfFovTan = Math.tan((camera.fov / 2) * Math.PI / 180);
                        const aspect = window.innerWidth / window.innerHeight;
                        const currentCamDist = Math.sqrt((targetY * totalRatio) ** 2 + ((targetZ - 30) * totalRatio) ** 2);
                        let visibleRadius = currentCamDist * halfFovTan;
                        if (aspect < 1.0) visibleRadius *= aspect;

                        // 感知範囲をさらに外側へ移動
                        // 自機の中心が画面の端に重なる瞬間（margin = 0）までズームを待機する
                        const margin = 0;
                        let limit = Math.max(10, visibleRadius - margin);
                        const distFromCenter = Math.sqrt(currentPos.x * currentPos.x + currentPos.z * currentPos.z);
                        if (distFromCenter > limit) { totalRatio *= (distFromCenter / limit); }

                        if (isOriginalActive) {
                            const fieldRadius = (params.size / 2) + params.wallT;
                            if (visibleRadius < fieldRadius * 1.05) {
                                const minRatioRequired = (fieldRadius * 1.05) / (currentCamDist * halfFovTan * (aspect < 1.0 ? aspect : 1.0));
                                if (totalRatio < minRatioRequired) totalRatio = minRatioRequired;
                            }
                        }
                    }
                }

                camera.far = 2100 * Math.max(1, totalRatio) + 3000;
                camera.updateProjectionMatrix();

                camera.position.set(0, targetY * totalRatio, targetZ * totalRatio);
                camera.lookAt(0, 0, 30);
                updateCameraPos.currentLookAt.set(0, 0, 30);
            }
            else {
                if (camera.near !== 1) { camera.near = 1; camera.updateProjectionMatrix(); }

                if (cameraMode === '1ST') {
                    if (!targetEntity) sphere.visible = false; if (playerSpriteObj._spriteRes) playerSpriteObj._spriteRes.sprite.visible = false; document.getElementById('player-hud').style.display = 'block';
                    document.getElementById('status-3rd').style.display = 'none';
                }
                else if (cameraMode === '3RD') {
                    if (!targetEntity) sphere.visible = true; if (playerSpriteObj._spriteRes) playerSpriteObj._spriteRes.sprite.visible = false; document.getElementById('player-hud').style.display = 'block';
                    document.getElementById('status-3rd').style.display = 'block';
                }

                if (camera.fov !== 90) { camera.fov = 80; camera.updateProjectionMatrix(); }
                if (camera.near !== 1) { camera.near = 1; camera.far = 5000; camera.updateProjectionMatrix(); }

                const cosP = Math.cos(camPitch), sinP = Math.sin(camPitch);
                const cosY = Math.cos(camYaw), sinY = Math.sin(camYaw);

                const dirX = sinY * cosP, dirY = -sinP, dirZ = cosY * cosP;

                let targetCamPos = new THREE.Vector3();
                let targetLookAt = new THREE.Vector3();

                if (cameraMode === '1ST') {
                    targetCamPos.set(bp.x, bp.y + params.ballRadius + 10, bp.z);
                    targetLookAt.set(targetCamPos.x - dirX * 20, targetCamPos.y - dirY * 20, targetCamPos.z - dirZ * 20);
                }
                else if (cameraMode === '3RD') {
                    const dist = 55;
                    const height = 25;

                    let offsetX = sinY * cosP * dist;
                    let offsetZ = cosY * cosP * dist;
                    let offsetY = -sinP * dist;

                    const limit = (params.size / 2) - 5;
                    let scale = 1.0;

                    if (bp.x + offsetX > limit) scale = Math.min(scale, (limit - bp.x) / offsetX);
                    if (bp.x + offsetX < -limit) scale = Math.min(scale, (-limit - bp.x) / offsetX);
                    if (bp.z + offsetZ > limit) scale = Math.min(scale, (limit - bp.z) / offsetZ);
                    if (bp.z + offsetZ < -limit) scale = Math.min(scale, (-limit - bp.z) / offsetZ);

                    scale = Math.max(0.1, scale);

                    let cx = bp.x + offsetX * scale;
                    let cy = bp.y + height + offsetY * scale;
                    let cz = bp.z + offsetZ * scale;

                    cy = Math.max(5, cy);

                    targetCamPos.set(cx, cy, cz);
                    targetLookAt.set(bp.x - dirX * 20, bp.y - dirY * 20 + 5, bp.z - dirZ * 20);
                }

                if (instant) {
                    camera.position.copy(targetCamPos);
                } else {
                    camera.position.lerp(targetCamPos, 0.1);
                }

                camera.lookAt(camera.position.x - dirX, camera.position.y - dirY, camera.position.z - dirZ);
            }
        }



function selectNextSpectatorTarget(direction) {
                const list = [];
                if (ballBody.isMatchParticipant) list.push(myPeerId);
                aiEntities.forEach(e => { list.push(e.id); });
                for (let id in remoteEntities) { if (remoteEntities[id].body) list.push(id); }
                list.sort((a, b) => a.localeCompare(b));
                if (list.length === 0) return;

                let idx = list.indexOf(spectatorTargetId);
                if (idx === -1) idx = 0;
                else idx = (idx + direction + list.length) % list.length;
                spectatorTargetId = list[idx];
            }
