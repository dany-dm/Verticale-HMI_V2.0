// three_viewer.js
// Visualizzatore 3D dell'impianto basato su Three.js
// Predisposto per l'importazione futura di modelli STL/OBJ

let scene, camera, renderer;
let carrello3D, caricatore3D, navette3D = {};
let isThreeInitialized = false;

// Mappature scale 3D (corrispondono a coordinate fisiche in mm)
const scale = 0.01; // 100mm = 1 unità 3D

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

    // 4. Luci
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
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

    // 6. CREAZIONE GEOMETRIE DI BASE (SURROGATI DEI MODELLI 3D)

    // Rotaie Carrello (Rosso)
    const railGeom = new THREE.BoxGeometry(100, 0.4, 0.4);
    const railMat = new THREE.MeshStandardMaterial({ color: 0x475569 });
    const rails = new THREE.Mesh(railGeom, railMat);
    rails.position.set(0, 0.2, 0);
    scene.add(rails);

    // Carrello (Rosso/Grigio)
    const carrGeom = new THREE.BoxGeometry(6, 3, 5);
    const carrMat = new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.3 });
    carrello3D = new THREE.Mesh(carrGeom, carrMat);
    carrello3D.position.set(0, 1.7, 0);
    scene.add(carrello3D);

    // Caricatore (Arancione/Giallo)
    const loaderGroup = new THREE.Group();
    const baseGeom = new THREE.CylinderGeometry(2, 2, 1, 16);
    const baseMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b });
    const baseMesh = new THREE.Mesh(baseGeom, baseMat);
    loaderGroup.add(baseMesh);

    // Braccio Caricatore
    const armGeom = new THREE.BoxGeometry(0.5, 0.5, 10);
    const armMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8 });
    const armMesh = new THREE.Mesh(armGeom, armMat);
    armMesh.position.set(0, 0.5, 5); // Offset per ruotare intorno alla base
    loaderGroup.add(armMesh);

    caricatore3D = loaderGroup;
    caricatore3D.position.set(35, 0.5, 10); // vicino a rulliere
    scene.add(caricatore3D);

    // Navette 1..4 (Blu)
    const navGeom = new THREE.BoxGeometry(4, 2, 6);
    const navMat = new THREE.MeshStandardMaterial({ color: 0x3b82f6, roughness: 0.4 });
    const valoriYNavette = [18500, 21200, 24040, 27060]; // Posizioni statiche binari
    for (let i = 1; i <= 4; i++) {
        if (typeof config !== "undefined" && config.navette && config.navette[`Navetta_${i}`] && config.navette[`Navetta_${i}`].valori) {
            valoriYNavette[i-1] = config.navette[`Navetta_${i}`].valori[4];
        }
    }

    for (let i = 1; i <= 4; i++) {
        // Binario verticale per ciascuna navetta
        const navRailGeom = new THREE.BoxGeometry(0.2, 0.1, 80);
        const navRail = new THREE.Mesh(navRailGeom, railMat);
        const zRailPos = -40 + (valoriYNavette[i-1] * 0.003); // Mappatura spaziale
        navRail.position.set(zRailPos, 0.1, 0);
        navRail.rotation.y = Math.PI / 2;
        scene.add(navRail);

        // La navetta vera e propria
        const navMesh = new THREE.Mesh(navGeom, navMat);
        navMesh.position.set(zRailPos, 1.1, 0);
        scene.add(navMesh);
        navette3D[i] = navMesh;
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

    // --- AGGIORNAMENTO POSIZIONI IN TEMPO REALE DA DATI PLC ---
    // Carrello Y
    if (carrello3D && currentStates.Carrello) {
        const yEnc = currentStates.Carrello.Y_Encoder || 0;
        // Mappa Y_Encoder (-35 a 35 sull'asse X 3D)
        carrello3D.position.x = 40 - (yEnc * 0.0028);
    }

    // Caricatore Rotazione
    if (caricatore3D && currentStates.Caricatore) {
        const rotEnc = currentStates.Caricatore.Rotazione_Encoder || 0;
        // Converte in radianti per Three.js
        caricatore3D.rotation.y = (rotEnc * Math.PI) / 180;
    }

    // Navette 1..4 X
    for (let i = 1; i <= 4; i++) {
        const navMesh = navette3D[i];
        const navState = currentStates[`Navetta_${i}`];
        if (navMesh && navState) {
            const xEnc = navState.X_Encoder || 0;
            // Spostamento lungo il binario (asse Z 3D)
            navMesh.position.z = -30 + (xEnc * 0.002);

            // Spostamento Y dinamico (asse X 3D)
            let yNav = [18500, 21200, 24040, 27060][i-1];
            if (typeof config !== "undefined" && config.navette && config.navette[`Navetta_${i}`] && config.navette[`Navetta_${i}`].valori) {
                yNav = config.navette[`Navetta_${i}`].valori[4];
            }
            const zRailPos = -40 + (yNav * 0.003);
            navMesh.position.x = zRailPos;
        }
    }

    // Rotazione automatica della camera per un effetto dinamico (opzionale)
    // camera.position.x = 60 * Math.sin(Date.now() * 0.0001);
    // camera.position.z = 60 * Math.cos(Date.now() * 0.0001);
    // camera.lookAt(20, 0, 0);

    renderer.render(scene, camera);
}


/* =========================================================================
   NOTE PER IL MIGLIORAMENTO FUTURO: IMPORTAZIONE MODELLI 3D STL / OBJ
   =========================================================================
   Per importare modelli 3D esportati da SolidWorks/CAD (.stl o .obj), seguire questa traccia:
   
   1. Includere i relativi loader nel file index.html:
      <script src="https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/loaders/STLLoader.js"></script>
      o per gli OBJ:
      <script src="https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/loaders/OBJLoader.js"></script>

   2. Esempio di codice per caricare un STL per la Navetta:
   
      const loader = new THREE.STLLoader();
      loader.load('models/navetta.stl', function (geometry) {
          const material = new THREE.MeshStandardMaterial({ 
              color: 0x3b82f6, 
              metalness: 0.6, 
              roughness: 0.2 
          });
          const mesh = new THREE.Mesh(geometry, material);
          mesh.scale.set(0.01, 0.01, 0.01); // adatta scala
          
          // Posiziona e orienta
          mesh.rotation.x = -Math.PI / 2; // correggi asse di esportazione CAD
          
          // Rimpiazza la mesh di base con quella STL
          scene.remove(navette3D[i]);
          navette3D[i] = mesh;
          scene.add(mesh);
      });
      
   3. Per gli OBJ (che contengono materiali separati .mtl):
   
      const mtlLoader = new THREE.MTLLoader();
      mtlLoader.load('models/carrello.mtl', function (materials) {
          materials.preload();
          const objLoader = new THREE.OBJLoader();
          objLoader.setMaterials(materials);
          objLoader.load('models/carrello.obj', function (object) {
              carrello3D = object;
              scene.add(carrello3D);
          });
      });
   ========================================================================= */

function aggiornaSinottico3D() {
    if (document.getElementById("sinottico-3d")?.classList.contains("active")) {
        if (!isThreeInitialized) {
            initThreeJS();
        }
    }
}
