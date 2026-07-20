// carrello_3d_builder.js
// Shared 1:1 3D Carriage Model Builder for Verticale-HMI V2.0
// Serves as the single source of truth for both carrello_3d.html and three_viewer.js

(function(global) {
    // Dimensioni fisiche reali in mm
    const GEO = {
        frame: { length: 4000, width: 1000, height: 110 },
        wheel: { radius: 75, width: 35, xOffset: -17.5 },
        column: { height: 900, width: 250, depth: 45 }
    };

    const columnXPositions = [400, 1500, 2500, 3600];
    const wheelYPositions = [-333.33, 333.33];

    function createWoodTexture(THREE) {
        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 128;
        const ctx = canvas.getContext('2d');
        const grad = ctx.createLinearGradient(0, 0, 512, 0);
        grad.addColorStop(0, '#d97706');
        grad.addColorStop(0.3, '#b45309');
        grad.addColorStop(0.7, '#d97706');
        grad.addColorStop(1, '#92400e');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 512, 128);
        ctx.strokeStyle = 'rgba(110, 45, 8, 0.3)';
        ctx.lineWidth = 2;
        for (let i = 0; i < 40; i++) {
            ctx.beginPath();
            const y = Math.random() * 128;
            ctx.moveTo(0, y);
            ctx.bezierCurveTo(150, y + (Math.random() - 0.5) * 20, 350, y + (Math.random() - 0.5) * 20, 512, y);
            ctx.stroke();
        }
        const texture = new THREE.CanvasTexture(canvas);
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        texture.repeat.set(4, 1);
        return texture;
    }

    function createBeltRubberTexture(THREE) {
        const canvas = document.createElement('canvas');
        canvas.width = 256;
        canvas.height = 32;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#dc2626';
        ctx.fillRect(0, 0, 256, 32);
        ctx.fillStyle = 'rgba(110, 10, 10, 0.7)';
        for (let x = 0; x < 256; x += 8) {
            ctx.fillRect(x, 0, 2, 32);
        }
        ctx.fillStyle = 'rgba(255, 140, 140, 0.45)';
        for (let x = 0; x < 256; x += 8) {
            ctx.fillRect(x + 2, 0, 1, 32);
        }
        const texture = new THREE.CanvasTexture(canvas);
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        texture.repeat.set(8, 1);
        return texture;
    }

    function buildCarriage3DModel(THREE, options = {}) {
        const serialMap = new Map();
        function setPartMetadata(mesh, sn, name, category, info) {
            mesh.userData = {
                serialNumber: sn,
                name: name,
                category: category,
                info: info
            };
            serialMap.set(sn, mesh);
        }

        const carriageGroup = new THREE.Group();
        const railsGroup = new THREE.Group();
        const wheelsGroup = [];

        // --- 1. ROTAIE DI SCORRIMENTO (30400 mm da Y=+1150 a Y=-29250 mm) ---
        const railMat = new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.7, roughness: 0.2 });
        const rail1 = new THREE.Mesh(new THREE.BoxGeometry(30400, 40, 40), railMat);
        rail1.position.set(-14050, -20, -333.33);
        setPartMetadata(rail1, "SN-1010", "Binario di Scorrimento Guida 1 (-Y)", "Guide di Scorrimento", "Binario da Y=+1150mm a Y=-29250mm");
        railsGroup.add(rail1);

        const rail2 = new THREE.Mesh(new THREE.BoxGeometry(30400, 40, 40), railMat);
        rail2.position.set(-14050, -20, 333.33);
        setPartMetadata(rail2, "SN-1011", "Binario di Scorrimento Guida 2 (+Y)", "Guide di Scorrimento", "Binario da Y=+1150mm a Y=-29250mm");
        railsGroup.add(rail2);

        // Piatto di riscontro 1751 (SN-1020)
        const plate1751 = new THREE.Mesh(
            new THREE.BoxGeometry(2675, 12, 25),
            new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.9, roughness: 0.2 })
        );
        plate1751.position.set(62.5, -34, 525);
        setPartMetadata(plate1751, "SN-1020", "Piatto Riscontro Fotocellula 1751", "Guide di Scorrimento", "Piatto 25x6x2675mm su binario 1 per riscontro ottico sensore 1751");
        railsGroup.add(plate1751);

        // --- 2. MATERIALI CARRELLO ---
        const alumMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.9, roughness: 0.18 });
        const darkJointMat = new THREE.MeshStandardMaterial({ color: 0x64748b, metalness: 0.8, roughness: 0.3 });
        const steelMat = new THREE.MeshStandardMaterial({ color: 0xf1f5f9, metalness: 0.98, roughness: 0.08 });
        const baseColorMat = new THREE.MeshStandardMaterial({ color: 0x10b981, metalness: 0.5, roughness: 0.3 });
        const redBeamOpticMat = new THREE.MeshStandardMaterial({ color: 0xff0000, emissive: 0xff0000, emissiveIntensity: 2.5, toneMapped: false });

        // Telaio Base
        const sideBeamGeo = new THREE.BoxGeometry(GEO.frame.length, GEO.frame.height, 80);
        const leftSideBeam = new THREE.Mesh(sideBeamGeo, alumMat);
        leftSideBeam.position.set(GEO.frame.length / 2, GEO.frame.height / 2, -460);
        setPartMetadata(leftSideBeam, "SN-1001", "Longherone Base Sinistro (-Y)", "Telaio Base", "Profilo alluminio 4000x110x80mm");
        carriageGroup.add(leftSideBeam);

        const rightSideBeam = new THREE.Mesh(sideBeamGeo, alumMat);
        rightSideBeam.position.set(GEO.frame.length / 2, GEO.frame.height / 2, 460);
        setPartMetadata(rightSideBeam, "SN-1002", "Longherone Base Destro (+Y)", "Telaio Base", "Profilo alluminio 4000x110x80mm");
        carriageGroup.add(rightSideBeam);

        // Traverse base
        const endBeamGeo = new THREE.BoxGeometry(60, GEO.frame.height, 840);
        const frontEndBeam = new THREE.Mesh(endBeamGeo, alumMat);
        frontEndBeam.position.set(30, GEO.frame.height / 2, 0);
        setPartMetadata(frontEndBeam, "SN-1003", "Traversa Base Anteriore (X=30)", "Telaio Base", "Profilo testata X=30mm");
        carriageGroup.add(frontEndBeam);

        const rearEndBeam = new THREE.Mesh(endBeamGeo, alumMat);
        rearEndBeam.position.set(GEO.frame.length - 30, GEO.frame.height / 2, 0);
        setPartMetadata(rearEndBeam, "SN-1004", "Traversa Base Posteriore (X=3970)", "Telaio Base", "Profilo testata X=3970mm");
        carriageGroup.add(rearEndBeam);

        columnXPositions.forEach((xPos, idx) => {
            const midBeam = new THREE.Mesh(new THREE.BoxGeometry(80, GEO.frame.height, 840), alumMat);
            midBeam.position.set(xPos, GEO.frame.height / 2, 0);
            setPartMetadata(midBeam, `SN-${1005 + idx}`, `Traversa Base Intermedia Colonna ${idx + 1}`, "Telaio Base", `Sotto colonna X=${xPos}mm`);
            carriageGroup.add(midBeam);
        });

        // Quadro Elettrico Parallelepipedo Base (SN-1801)
        const boxMesh = new THREE.Mesh(
            new THREE.BoxGeometry(920, 200, 600),
            new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.85, roughness: 0.25 })
        );
        boxMesh.position.set(3000, 32, -120);
        setPartMetadata(boxMesh, "SN-1801", "Quadro Elettrico Parallelepipedo Base", "Quadro Elettrico", "Parallelepipedo 3D tra traversa 1007 e 1008");
        carriageGroup.add(boxMesh);

        // Ruote flangiate (8x)
        const wheelTreadMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.6, metalness: 0.2 });
        const wheelRimMat = new THREE.MeshStandardMaterial({ color: 0xf1f5f9, metalness: 0.98, roughness: 0.08 });

        function createWheelMesh(snCode, labelName) {
            const wheelAssembly = new THREE.Group();
            const tread = new THREE.Mesh(new THREE.CylinderGeometry(GEO.wheel.radius, GEO.wheel.radius, GEO.wheel.width, 24), wheelTreadMat);
            tread.rotation.z = Math.PI / 2;
            setPartMetadata(tread, snCode, labelName, "Ruota Flangiata", "Diametro 150mm su binario");
            wheelAssembly.add(tread);

            const rim = new THREE.Mesh(new THREE.CylinderGeometry(GEO.wheel.radius * 0.7, GEO.wheel.radius * 0.7, GEO.wheel.width + 4, 16), wheelRimMat);
            rim.rotation.z = Math.PI / 2;
            wheelAssembly.add(rim);

            const hub = new THREE.Mesh(new THREE.CylinderGeometry(15, 15, GEO.wheel.width + 8, 12), darkJointMat);
            hub.rotation.z = Math.PI / 2;
            wheelAssembly.add(hub);
            return wheelAssembly;
        }

        const sideXPositions = [-GEO.wheel.xOffset, GEO.frame.length + GEO.wheel.xOffset];
        let wheelSnCounter = 1101;
        sideXPositions.forEach((xPos, sideIdx) => {
            wheelYPositions.forEach((yPos, yIdx) => {
                const sn = `SN-${wheelSnCounter++}`;
                const sideLabel = sideIdx === 0 ? "Anteriore (X=-17.5)" : "Posteriore (X=4017.5)";
                const wheel = createWheelMesh(sn, `Ruota Flangiata ${sideLabel} Pos ${yIdx + 1}`);
                wheel.position.set(xPos, GEO.frame.height / 2, yPos);
                carriageGroup.add(wheel);
                wheelsGroup.push(wheel);
            });
        });

        // 3. COLONNE ED ALBERI DI TRASMISSIONE
        const columnGroup = new THREE.Group();
        columnXPositions.forEach((xPos, idx) => {
            const colMesh = new THREE.Mesh(new THREE.BoxGeometry(GEO.column.width, GEO.column.height, GEO.column.depth), baseColorMat);
            colMesh.position.set(xPos, GEO.frame.height + GEO.column.height / 2, 0);
            setPartMetadata(colMesh, `SN-${1201 + idx}`, `Colonna di Supporto ${idx + 1}`, "Struttura Verticale", `Supporto altezza 900mm X=${xPos}mm`);
            columnGroup.add(colMesh);
        });
        carriageGroup.add(columnGroup);

        // Alberi di trasmissione (SN-1210, 1212)
        const shaftGeo = new THREE.CylinderGeometry(15, 15, 3055, 16);
        const shaft1 = new THREE.Mesh(shaftGeo, steelMat);
        shaft1.rotation.x = Math.PI / 2;
        shaft1.position.set(1995, 570, -5);
        setPartMetadata(shaft1, "SN-1210", "Albero di Trasmissione 1 (-Y)", "Trasmissione Meccanica", "Albero Ø30mm L=3055mm allungato +10mm in -X");
        carriageGroup.add(shaft1);

        const shaft2 = new THREE.Mesh(shaftGeo, steelMat);
        shaft2.rotation.x = Math.PI / 2;
        shaft2.position.set(1995, 1070, -5);
        setPartMetadata(shaft2, "SN-1212", "Albero di Trasmissione 2 (+Y)", "Trasmissione Meccanica", "Albero Ø30mm L=3055mm allungato +10mm in -X");
        carriageGroup.add(shaft2);

        // Motore (SN-1211)
        const motorMesh = new THREE.Mesh(new THREE.BoxGeometry(160, 240, 160), darkJointMat);
        motorMesh.position.set(2000, 570, 0);
        setPartMetadata(motorMesh, "SN-1211", "Motore Elettrico Riduttore Trasmissione", "Motore", "Motore principale albero 1210");
        carriageGroup.add(motorMesh);

        // --- 4. GRUPPO ROTANTE TAVOLA & DISCHI ---
        const rotatingUpperGroup = new THREE.Group();
        rotatingUpperGroup.position.set(0, GEO.frame.height + GEO.column.height, 0);

        // 4 Dischi estrusi (SN-1301..1304)
        columnXPositions.forEach((xPos, idx) => {
            const diskMesh = new THREE.Mesh(new THREE.CylinderGeometry(300, 300, 45, 32), alumMat);
            diskMesh.rotation.z = Math.PI / 2;
            diskMesh.position.set(xPos, 0, 0);
            setPartMetadata(diskMesh, `SN-${1301 + idx}`, `Disco Estruso Rotante Colonna ${idx + 1}`, "Gruppo Rotante", `Disco Ø600mm spessore 45mm con cutout a Z+45mm`);
            rotatingUpperGroup.add(diskMesh);
        });

        // Longheroni tavola superiore (SN-1310, 1311)
        const upLeftBeam = new THREE.Mesh(new THREE.BoxGeometry(4000, 45, 45), alumMat);
        upLeftBeam.position.set(2000, 100, -377.5);
        setPartMetadata(upLeftBeam, "SN-1310", "Longherone Tavola Superiore Sinistro (-Y)", "Tavola Superiore", "Profilo tavola 4000x45x45mm");
        rotatingUpperGroup.add(upLeftBeam);

        const upRightBeam = new THREE.Mesh(new THREE.BoxGeometry(4000, 45, 45), alumMat);
        upRightBeam.position.set(2000, 100, 377.5);
        setPartMetadata(upRightBeam, "SN-1311", "Longherone Tavola Superiore Destro (+Y)", "Tavola Superiore", "Profilo tavola 4000x45x45mm");
        rotatingUpperGroup.add(upRightBeam);

        // Cinghie Rosso Vivo scanalate (4x)
        const beltTex = createBeltRubberTexture(THREE);
        const beltMat = new THREE.MeshStandardMaterial({ map: beltTex, color: 0xdc2626, roughness: 0.25, metalness: 0.05 });

        columnXPositions.forEach((xPos, idx) => {
            const beltMesh = new THREE.Mesh(new THREE.BoxGeometry(26, 80, 1100), beltMat);
            beltMesh.position.set(xPos, 170, 0);
            setPartMetadata(beltMesh, `SN-${1422 + idx * 2}`, `Cinghia Gomma Rosso Vivo Pos ${idx + 1}`, "Cinghie di Trasporto", "Cinghia rossa scanalata con texture vulcanizzata");
            rotatingUpperGroup.add(beltMesh);
        });

        // Pannello di Legno (SN-1601, trasparente 40%)
        const woodTex = createWoodTexture(THREE);
        const woodMat = new THREE.MeshStandardMaterial({
            map: woodTex,
            color: 0xd97706,
            roughness: 0.45,
            transparent: true,
            opacity: 0.60
        });
        const woodPanel = new THREE.Mesh(new THREE.BoxGeometry(800, 50, 4200), woodMat);
        woodPanel.position.set(2000, 240, 0);
        setPartMetadata(woodPanel, "SN-1601", "Pannello di Legno Movimentato", "Carico Legno", "Pannello 4200x800x50mm trasparenza 40%");
        rotatingUpperGroup.add(woodPanel);

        carriageGroup.add(rotatingUpperGroup);

        return {
            carriageGroup,
            railsGroup,
            rotatingUpperGroup,
            woodPanel,
            wheelsGroup,
            serialMap,
            update(yVal, rotVal) {
                if (typeof yVal === 'number' && !isNaN(yVal)) {
                    carriageGroup.position.x = yVal;
                }
                if (typeof rotVal === 'number' && !isNaN(rotVal)) {
                    rotatingUpperGroup.rotation.x = (rotVal * Math.PI) / 180;
                }
            }
        };
    }

    global.buildCarriage3DModel = buildCarriage3DModel;
})(typeof window !== 'undefined' ? window : this);
