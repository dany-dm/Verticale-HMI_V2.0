// three_viewer.js
// Visualizzatore 3D dell'impianto basato su Three.js
// Coordinato con lo schema 2D SVG e controllato da registri PLC in tempo reale

let scene, camera, renderer, controls;
let carrello3D, caricatore3D, navette3D = {};
let biesse3D, biesseWood3D;
let r13D, r1Wood3D;
let r2Pivot3D, r2Wood3D;
let isThreeInitialized = false;

// Mappature scale 3D
// Asse X (3D): rappresenta la coordinata fisica Y (0 a 28500 mm) -> X_3D = 40 - Y * 0.0028
// Asse Z (3D): rappresenta la coordinata fisica X (0 a 27000 mm) -> Z_3D = -30 + X * 0.002
// Asse Y (3D): rappresenta l'altezza (spessore, quota verticale)

// Helper per verificare se una macchina è pronta
function isMachineReady(name, state) {
    const enableDrive = state.Stato_EnableDrive !== undefined ? state.Stato_EnableDrive : true;
    let homeOk = state.Home_OK !== undefined ? state.Home_OK : true;
    if (name === "Rulliere") {
        homeOk = true;
    }
    const automatico = state.Stato_Automatico !== undefined ? state.Stato_Automatico : true;
    return (enableDrive && homeOk && automatico);
}

function initThreeJS() {
    const container = document.getElementById("three-container");
    if (!container || isThreeInitialized) return;

    // 1. Scena & Sfondo
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0c101a); // Grigio scuro coordinato con UI

    // 2. Camera
    camera = new THREE.PerspectiveCamera(50, container.clientWidth / container.clientHeight, 0.1, 1000);
    camera.position.set(20, 35, 60);
    camera.lookAt(20, 0, 0);

    // 3. Renderer
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.shadowMap.enabled = true;
    container.appendChild(renderer.domElement);

    // 3.5. Controls (OrbitControls per interattività)
    if (typeof THREE.OrbitControls !== "undefined") {
        controls = new THREE.OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.dampingFactor = 0.05;
        controls.maxPolarAngle = Math.PI / 2 - 0.05; // Impedisci di andare sotto terra
        controls.minDistance = 10;
        controls.maxDistance = 150;
    }

    // 4. Luci
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(50, 100, 50);
    dirLight.castShadow = true;
    scene.add(dirLight);

    // Luci d'accento colorate (Cyberpunk / Industrial style)
    const pointLight1 = new THREE.PointLight(0x06b6d4, 1, 100);
    pointLight1.position.set(0, 10, 0);
    scene.add(pointLight1);

    // 5. Pavimento Grid
    const gridHelper = new THREE.GridHelper(200, 50, 0x334155, 0x1e293b);
    gridHelper.position.y = -0.01;
    scene.add(gridHelper);

    // MATERIALI COMUNI
    const railMat = new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.6, roughness: 0.2 });
    const conveyorMat = new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.5, roughness: 0.3 });
    const rollerMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.8, roughness: 0.2 });
    const woodMat = new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.6 });
    const cuttingMachineMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.6, roughness: 0.4 });
    const highlightMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b });
    const armMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.5, roughness: 0.3 });
    const frameMat = new THREE.MeshStandardMaterial({ color: 0x3b82f6, metalness: 0.5, roughness: 0.3 });

    // 6. GEOMETRIE E STRUTTURE

    // --- CARRELLO TRASLATORE DETTAGLIATO 1:1 (Importato da carrello_3d_builder.js) ---
    if (typeof window.buildCarriage3DModel === 'function') {
        const carriageModel = window.buildCarriage3DModel(THREE);
        
        // Contenitore Carrello per la scena del Sinottico
        const carrelloContainer = new THREE.Group();
        
        // Scala da mm fisici a unita' sinottico (1000mm = 1 unita' 3D)
        carriageModel.carriageGroup.scale.set(0.001, 0.001, 0.001);
        carriageModel.railsGroup.scale.set(0.001, 0.001, 0.001);

        // Orientamento ed allineamento al layout dell'impianto:
        // Asse trasversale sinottico = Z, Mezzeria X=2000mm allineata a Z=0
        carriageModel.carriageGroup.rotation.y = Math.PI / 2;
        carriageModel.carriageGroup.position.set(0, 0.04, -2.0); // Offset -2.0 per centrare X=2000mm a Z=0

        carriageModel.railsGroup.rotation.y = Math.PI / 2;
        carriageModel.railsGroup.position.set(0, 0, -2.0);

        carrelloContainer.add(carriageModel.carriageGroup);
        scene.add(carriageModel.railsGroup);

        carrello3D = carrelloContainer;
        carrello3D.userData = {
            baseMesh: carriageModel.carriageGroup,
            carriageGroup: carriageModel.carriageGroup,
            rotatingGroup: carriageModel.rotatingUpperGroup,
            woodPanel: carriageModel.woodPanel,
            update: carriageModel.update
        };
        scene.add(carrello3D);
    }


    // --- BIESSE CARICO (Loading Unit) ---
    biesse3D = new THREE.Group();
    // Telaio
    const biesseFrameGeom = new THREE.BoxGeometry(2.5, 0.4, 6);
    const biesseFrame = new THREE.Mesh(biesseFrameGeom, conveyorMat);
    biesseFrame.position.y = 0.2;
    biesse3D.add(biesseFrame);

    // Rulli
    const rollerGeom = new THREE.CylinderGeometry(0.15, 0.15, 5.8, 12);
    for (let z = -2.7; z <= 2.7; z += 0.9) {
        const roller = new THREE.Mesh(rollerGeom, rollerMat);
        roller.position.set(0, 0.45, z);
        roller.rotation.x = Math.PI / 2;
        biesse3D.add(roller);
    }
    biesse3D.position.set(44.3, 0, -36.8);
    scene.add(biesse3D);

    // Pannello di legno Biesse
    const biesseWoodGeom = new THREE.BoxGeometry(2.24, 0.15, 1.0);
    biesseWood3D = new THREE.Mesh(biesseWoodGeom, woodMat);
    biesseWood3D.position.set(44.3, 0.55, -36.8);
    biesseWood3D.visible = false;
    scene.add(biesseWood3D);


    // --- RULLIERA 1 (R1) ---
    r13D = new THREE.Group();
    // Telaio
    const r1FrameGeom = new THREE.BoxGeometry(5.3, 0.4, 14.8);
    const r1Frame = new THREE.Mesh(r1FrameGeom, conveyorMat);
    r1Frame.position.y = 0.2;
    r13D.add(r1Frame);

    // Rulli
    const r1RollerGeom = new THREE.CylinderGeometry(0.15, 0.15, 5.1, 12);
    for (let z = -7.0; z <= 7.0; z += 1.0) {
        const roller = new THREE.Mesh(r1RollerGeom, rollerMat);
        roller.position.set(0, 0.45, z);
        roller.rotation.x = Math.PI / 2;
        r13D.add(roller);
    }
    r13D.position.set(44.3, 0, -26.4);
    scene.add(r13D);

    // Pannello di legno R1
    const r1WoodGeom = new THREE.BoxGeometry(2.24, 0.15, 8.4);
    r1Wood3D = new THREE.Mesh(r1WoodGeom, woodMat);
    r1Wood3D.position.set(44.3, 0.55, -26.4);
    r1Wood3D.visible = false;
    scene.add(r1Wood3D);


    // --- RULLIERA 2 (R2 - Rotante) ---
    r2Pivot3D = new THREE.Group();
    r2Pivot3D.position.set(44.3, 0, -5.48); // Pivot allineato a fine corsa Z
    scene.add(r2Pivot3D);

    const r2Conveyor = new THREE.Group();
    // Telaio
    const r2FrameGeom = new THREE.BoxGeometry(5.3, 0.4, 12.76);
    const r2Frame = new THREE.Mesh(r2FrameGeom, conveyorMat);
    r2Frame.position.set(0, 0.2, -6.38); // Centrato sul pivot
    r2Conveyor.add(r2Frame);

    // Rulli
    const r2RollerGeom = new THREE.CylinderGeometry(0.15, 0.15, 5.1, 12);
    for (let z = -12.26; z <= -0.5; z += 1.0) {
        const roller = new THREE.Mesh(r2RollerGeom, rollerMat);
        roller.position.set(0, 0.45, z);
        roller.rotation.x = Math.PI / 2;
        r2Conveyor.add(roller);
    }
    r2Pivot3D.add(r2Conveyor);
    r2Pivot3D.userData = { frameMesh: r2Frame };

    // Pannello di legno R2 (ruota insieme alla rulliera)
    const r2WoodGeom = new THREE.BoxGeometry(2.24, 0.15, 8.4);
    r2Wood3D = new THREE.Mesh(r2WoodGeom, woodMat);
    r2Wood3D.position.set(0, 0.55, -6.38);
    r2Wood3D.visible = false;
    r2Pivot3D.add(r2Wood3D);


    // --- MACCHINA TRONCATRICE ---
    const cuttingGroup = new THREE.Group();
    const cutBaseGeom = new THREE.BoxGeometry(3, 2, 5.3);
    const cutBase = new THREE.Mesh(cutBaseGeom, cuttingMachineMat);
    cutBase.position.y = 1.0;
    cuttingGroup.add(cutBase);

    const cutTopGeom = new THREE.BoxGeometry(1.5, 0.8, 4.5);
    const cutTop = new THREE.Mesh(cutTopGeom, highlightMat);
    cutTop.position.set(0, 2.4, 0);
    cuttingGroup.add(cutTop);

    cuttingGroup.position.set(60.7, 0, -5.48);
    scene.add(cuttingGroup);


    // --- CARICATORE A VENTOSE ---
    const loaderGroup = new THREE.Group();
    
    // Base
    const baseGeom = new THREE.CylinderGeometry(2, 2, 0.8, 16);
    const baseMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, metalness: 0.4, roughness: 0.4 });
    const baseMesh = new THREE.Mesh(baseGeom, baseMat);
    baseMesh.position.y = 0.4;
    loaderGroup.add(baseMesh);

    // Braccio mobile
    const armGroup = new THREE.Group();
    armGroup.position.y = 0.8;

    const armGeom = new THREE.BoxGeometry(0.5, 0.5, 10);
    const armMesh = new THREE.Mesh(armGeom, armMat);
    armMesh.position.set(0, 0.25, 5);
    armGroup.add(armMesh);

    // Telaio Ventose
    const frameGeom = new THREE.BoxGeometry(2.2, 0.1, 0.8);
    const frameMesh = new THREE.Mesh(frameGeom, frameMat);
    frameMesh.position.set(0, 0.55, 10);
    armGroup.add(frameMesh);

    // 8 Ventose
    const cupGeom = new THREE.CylinderGeometry(0.12, 0.12, 0.2, 8);
    const cupMat = new THREE.MeshStandardMaterial({ color: 0x06b6d4 }); // Ciano brillante
    const cupOffsets = [
        [-0.8, 0.4, 9.7],
        [-0.3, 0.4, 9.7],
        [0.3, 0.4, 9.7],
        [0.8, 0.4, 9.7],
        [-0.8, 0.4, 10.3],
        [-0.3, 0.4, 10.3],
        [0.3, 0.4, 10.3],
        [0.8, 0.4, 10.3]
    ];
    cupOffsets.forEach(offset => {
        const cup = new THREE.Mesh(cupGeom, cupMat);
        cup.position.set(offset[0], offset[1], offset[2]);
        armGroup.add(cup);
    });

    loaderGroup.add(armGroup);
    caricatore3D = loaderGroup;
    caricatore3D.userData = { baseMesh: baseMesh, armGroup: armGroup, frameMesh: frameMesh };
    caricatore3D.position.set(41.0, 0, -20.5);
    scene.add(caricatore3D);


    // --- NAVETTE E SCAFFALATURE BUFFER ---
    const valoriYNavette = [18500, 21200, 24040, 27060];
    for (let i = 1; i <= 4; i++) {
        if (typeof config !== "undefined" && config.navette && config.navette[`Navetta_${i}`] && config.navette[`Navetta_${i}`].valori) {
            valoriYNavette[i-1] = config.navette[`Navetta_${i}`].valori[4];
        }
    }

    const shelfMat = new THREE.MeshStandardMaterial({ 
        color: 0x1e293b, 
        transparent: true, 
        opacity: 0.35, 
        roughness: 0.6,
        metalness: 0.1
    });
    const shelfGeom = new THREE.BoxGeometry(2.0, 8.0, 44.5);

    for (let i = 1; i <= 4; i++) {
        const zRailPos = 40 - (valoriYNavette[i-1] * 0.0028);

        // Binario verticale per ciascuna navetta
        const navRailGeom = new THREE.BoxGeometry(0.2, 0.1, 80);
        const navRail = new THREE.Mesh(navRailGeom, railMat);
        navRail.position.set(zRailPos, 0.05, 0);
        navRail.rotation.y = Math.PI / 2;
        scene.add(navRail);

        // Scaffale Sinistro
        const shelfL = new THREE.Mesh(shelfGeom, shelfMat);
        shelfL.position.set(zRailPos - 1.8, 4.0, 1.75);
        scene.add(shelfL);

        // Scaffale Destro
        const shelfR = new THREE.Mesh(shelfGeom, shelfMat);
        shelfR.position.set(zRailPos + 1.8, 4.0, 1.75);
        scene.add(shelfR);

        // Contorni wireframe ad effetto tecnologico
        if (typeof THREE.EdgesGeometry !== 'undefined' && typeof THREE.LineSegments !== 'undefined') {
            try {
                const wireframeGeom = new THREE.EdgesGeometry(shelfGeom);
                const wireframeMat = new THREE.LineBasicMaterial({ color: 0x475569, linewidth: 1 });
                
                const wireL = new THREE.LineSegments(wireframeGeom, wireframeMat);
                wireL.position.copy(shelfL.position);
                scene.add(wireL);
                
                const wireR = new THREE.LineSegments(wireframeGeom, wireframeMat);
                wireR.position.copy(shelfR.position);
                scene.add(wireR);
            } catch (e) {
                console.warn("Wireframe edges skipped:", e);
            }
        }

        // La navetta (struttura composta)
        const navGroup = new THREE.Group();
        // Telaio navetta
        const navGeom = new THREE.BoxGeometry(4, 0.6, 6);
        const navMat = new THREE.MeshStandardMaterial({ color: 0x3b82f6, roughness: 0.4 });
        const chassisMesh = new THREE.Mesh(navGeom, navMat);
        chassisMesh.position.y = 0.3;
        navGroup.add(chassisMesh);

        // Dettaglio bracci/ventose
        const navArmGeom = new THREE.CylinderGeometry(0.2, 0.2, 1.0, 12);
        const navArmMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b });
        const nArm1 = new THREE.Mesh(navArmGeom, navArmMat);
        nArm1.position.set(-1.0, 0.8, -1.5);
        navGroup.add(nArm1);
        const nArm2 = new THREE.Mesh(navArmGeom, navArmMat);
        nArm2.position.set(1.0, 0.8, -1.5);
        navGroup.add(nArm2);

        // Ruotine
        const navWheelGeom = new THREE.CylinderGeometry(0.3, 0.3, 0.2, 12);
        const navWheelMat = new THREE.MeshStandardMaterial({ color: 0x0f172a });
        const navWheelPositions = [
            [-1.9, 0.15, -2.5],
            [1.9, 0.15, -2.5],
            [-1.9, 0.15, 2.5],
            [1.9, 0.15, 2.5]
        ];
        navWheelPositions.forEach(pos => {
            const wheel = new THREE.Mesh(navWheelGeom, navWheelMat);
            wheel.position.set(pos[0], pos[1], pos[2]);
            wheel.rotation.x = Math.PI / 2;
            navGroup.add(wheel);
        });

        navGroup.position.set(zRailPos, 0, 0); // Posizionata lungo binario in animateThree
        scene.add(navGroup);
        navette3D[i] = navGroup;
        navette3D[i].userData = { chassisMesh: chassisMesh };
    }

    isThreeInitialized = true;
    animateThree();
    
    // Gestione ridimensionamento
    window.addEventListener("resize", resizeThreeJS);
}

function resizeThreeJS() {
    const container = document.getElementById("three-container");
    if (!container || !renderer || !camera) return;
    
    camera.aspect = container.clientWidth / container.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(container.clientWidth, container.clientHeight);
}

function animateThree() {
    if (!isThreeInitialized) return;
    requestAnimationFrame(animateThree);

    if (controls) controls.update();

    // --- AGGIORNAMENTO STATI & POSIZIONI IN TEMPO REALE DA DATI PLC ---

    // 1. CARRELLO
    if (carrello3D && currentStates.Carrello) {
        const yEnc = currentStates.Carrello.Y_Encoder || 0;
        const rotEnc = currentStates.Carrello.Rotazione_Encoder || 0;

        // Allineamento corretto dell'asse X (corsa Y fisica -> X 3D sinottico)
        carrello3D.position.x = 40 - (yEnc * 0.0028);

        // Aggiornamento rotazione tavola
        if (carrello3D.userData && carrello3D.userData.rotatingGroup) {
            carrello3D.userData.rotatingGroup.rotation.z = (rotEnc * Math.PI) / 180;
        }

        const state = currentStates.Carrello;
        const online = state.__comunicazione_ok__;
        const ready = online && isMachineReady("Carrello", state);
        let hexColor = 0xef4444; // Rosso offline/error
        if (ready) {
            hexColor = state.Stato_Picked ? 0x3b82f6 : 0x10b981; // Blu / Verde
        }
        if (carrello3D.userData && carrello3D.userData.baseMesh && carrello3D.userData.baseMesh.material) {
            carrello3D.userData.baseMesh.material.color.setHex(hexColor);
        }
    }

    // 2. CARICATORE
    if (caricatore3D && currentStates.Caricatore) {
        const rotEnc = currentStates.Caricatore.Rotazione_Encoder || 0;
        // Rotazione orientata al braccio per fedeltà
        if (caricatore3D.userData && caricatore3D.userData.armGroup) {
            caricatore3D.userData.armGroup.rotation.y = ((225 - rotEnc) * Math.PI) / 180;
        }

        const state = currentStates.Caricatore;
        const online = state.__comunicazione_ok__;
        const ready = online && isMachineReady("Caricatore", state);
        let hexColor = 0xef4444;
        if (ready) {
            hexColor = state.Stato_Picked ? 0x3b82f6 : 0x10b981;
        }
        if (caricatore3D.userData && caricatore3D.userData.baseMesh && caricatore3D.userData.baseMesh.material) {
            caricatore3D.userData.baseMesh.material.color.setHex(hexColor);
        }
        if (caricatore3D.userData && caricatore3D.userData.frameMesh && caricatore3D.userData.frameMesh.material) {
            caricatore3D.userData.frameMesh.material.color.setHex(hexColor);
        }
    }

    // 3. RULLIERE (Biesse, R1, R2, Macchina Troncatrice)
    if (currentStates.Rulliere) {
        const state = currentStates.Rulliere;
        const online = state.__comunicazione_ok__;
        const ready = online && isMachineReady("Rulliere", state);
        let hexColor = 0xef4444;
        if (ready) {
            hexColor = state.Stato_Picked ? 0x3b82f6 : 0x10b981;
        }

        // Colori telai
        if (r2Pivot3D && r2Pivot3D.userData && r2Pivot3D.userData.frameMesh && r2Pivot3D.userData.frameMesh.material) {
            r2Pivot3D.userData.frameMesh.material.color.setHex(hexColor);
        }
        if (r13D && r13D.children && r13D.children[0] && r13D.children[0].material) {
            r13D.children[0].material.color.setHex(hexColor);
        }
        if (biesse3D && biesse3D.children && biesse3D.children[0] && biesse3D.children[0].material) {
            biesse3D.children[0].material.color.setHex(hexColor);
        }

        // Sincronizzazione rotazione R2
        let r2Angle = 45;
        if (state.Stato_R2InPos90) {
            r2Angle = 90;
        } else if (state.Stato_R2InPos0) {
            r2Angle = 0;
        }
        if (r2Pivot3D) {
            r2Pivot3D.rotation.y = (r2Angle * Math.PI) / 180;
        }

        // Sincronizzazione visibilità dei pannelli in legno
        const hasPanelBiesse = online && !!state.Stato_PannelloSuBiesse;
        const hasPanelR1 = online && !!state.Stato_PannelloSuR1;
        const hasPanelR2 = online && (state.Stato_R2Vuota === false || state.Stato_R2Vuota === 0);

        if (biesseWood3D) biesseWood3D.visible = hasPanelBiesse;
        if (r1Wood3D) r1Wood3D.visible = hasPanelR1;
        if (r2Wood3D) r2Wood3D.visible = hasPanelR2;
    }

    // 4. NAVETTE 1..4
    for (let i = 1; i <= 4; i++) {
        const navMesh = navette3D[i];
        const navState = currentStates[`Navetta_${i}`];
        if (navMesh && navState) {
            const xEnc = navState.X_Encoder || 0;
            // Spostamento lungo binario Z
            navMesh.position.z = -30 + (xEnc * 0.002);

            // Spostamento dinamico binari X
            let yNav = [18500, 21200, 24040, 27060][i-1];
            if (typeof config !== "undefined" && config.navette && config.navette[`Navetta_${i}`] && config.navette[`Navetta_${i}`].valori) {
                yNav = config.navette[`Navetta_${i}`].valori[4];
            }
            const zRailPos = 40 - (yNav * 0.0028);
            navMesh.position.x = zRailPos;

            // Aggiorna colore
            const online = navState.__comunicazione_ok__;
            const navReady = online && isMachineReady(`Navetta_${i}`, navState);
            let hexColor = 0xef4444;
            if (navReady) {
                hexColor = navState.Stato_Picked ? 0x3b82f6 : 0x10b981;
            }
            if (navMesh.userData && navMesh.userData.chassisMesh) {
                navMesh.userData.chassisMesh.material.color.setHex(hexColor);
            }
        }
    }

    renderer.render(scene, camera);
}

function aggiornaSinottico3D() {
    if (document.getElementById("sinottico-3d")?.classList.contains("active")) {
        if (!isThreeInitialized) {
            initThreeJS();
        }
    }
}
