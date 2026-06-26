// app.js

// --- CONFIGURAZIONE E VARIABILI DI STATO LOCALE ---
let activeTab = "panel-globale";
let activeNavettaIndex = 0; // 0-based index per Navetta_1, Navetta_2, ecc.
let currentStates = {};
let config = {};
let eventSource = null;

// --- INIZIALIZZAZIONE ---
document.addEventListener("DOMContentLoaded", () => {
    setupTabNavigation();
    initSSE();
    setupCommandButtons();
    setupHoverHelp();
    caricaConfigForm();
    
    // Clear logs button
    document.getElementById("btn-clear-logs")?.addEventListener("click", () => {
        document.getElementById("logs-console").innerHTML = "";
    });

    // Toggle 2D/3D Sinottico
    document.getElementById("btn-view-2d")?.addEventListener("click", () => switchSinotticoView("2d"));
    document.getElementById("btn-view-3d")?.addEventListener("click", () => switchSinotticoView("3d"));

    // Config form submit
    document.getElementById("form-config")?.addEventListener("submit", salvaConfigurazione);

    // Avvia polling periodico per la console log (ogni 2 secondi)
    setInterval(caricaLogConsole, 2000);
});

// --- NAVIGAZIONE A SCHEDE (TABS) ---
function setupTabNavigation() {
    const navItems = document.querySelectorAll(".sidebar .nav-item");
    navItems.forEach(item => {
        item.addEventListener("click", () => {
            const target = item.getAttribute("data-target");
            if (!target) return;
            switchTab(target);
        });
    });
}

function switchTab(targetId) {
    const item = document.querySelector(`.sidebar .nav-item[data-target="${targetId}"]`);
    if (!item) return;
    
    const navItems = document.querySelectorAll(".sidebar .nav-item");
    navItems.forEach(n => n.classList.remove("active"));
    item.classList.add("active");
    
    document.querySelectorAll(".content-panel").forEach(p => p.classList.remove("active"));
    const targetPanel = document.getElementById(targetId);
    if (targetPanel) {
        targetPanel.classList.add("active");
    }
    
    activeTab = targetId;
    
    // Se entriamo in Impostazioni, ricarichiamo la form
    if (activeTab === "panel-impostazioni") {
        aggiornaCampiConfig();
    }
    
    // Se entriamo in Console Log, aggiorniamo subito i log
    if (activeTab === "panel-logs") {
        caricaLogConsole();
    }
    
    // Riposiziona il visualizzatore 3D se attivo
    if (activeTab === "panel-globale" && document.getElementById("sinottico-3d").classList.contains("active")) {
        resizeThreeJS();
    }
}

function selectNavetta(i) {
    const buttons = document.querySelectorAll(".btn-nav-select");
    if (buttons.length >= i) {
        const btn = buttons[i - 1];
        buttons.forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        activeNavettaIndex = i - 1;
        document.getElementById("navetta-selezionata-title").innerText = `Navetta ${i}`;
        
        const isNav4 = (i === 4);
        const tplGrp = document.getElementById("navetta-4-tpl-group");
        if (tplGrp) tplGrp.style.display = isNav4 ? "flex" : "none";
        const extId = document.getElementById("navetta-4-extra-id");
        if (extId) extId.style.display = isNav4 ? "flex" : "none";
        const extLen = document.getElementById("navetta-4-extra-lunghezza");
        if (extLen) extLen.style.display = isNav4 ? "flex" : "none";
        
        aggiornaSchedaNavette();
    }
}

function switchSinotticoView(viewType) {
    if (viewType === "2d") {
        document.getElementById("btn-view-2d").classList.add("active");
        document.getElementById("btn-view-3d").classList.remove("active");
        document.getElementById("sinottico-2d").classList.add("active");
        document.getElementById("sinottico-3d").classList.remove("active");
    } else {
        document.getElementById("btn-view-2d").classList.remove("active");
        document.getElementById("btn-view-3d").classList.add("active");
        document.getElementById("sinottico-2d").classList.remove("active");
        document.getElementById("sinottico-3d").classList.add("active");
        resizeThreeJS();
    }
}

// --- CONNESSIONE SERVER-SENT EVENTS (SSE) ---
function initSSE() {
    eventSource = new EventSource("/api/events");
    
    eventSource.onmessage = (event) => {
        try {
            const data = JSON.parse(event.data);
            currentStates = data;
            
            // Aggiorna lo stato della connessione NetLinker in tempo reale
            const netlinkerConnected = currentStates.__system__ ? currentStates.__system__.netlinker_connected : false;
            const netlinkerStatusEl = document.getElementById("netlinker-status");
            if (netlinkerStatusEl) {
                if (netlinkerConnected) {
                    netlinkerStatusEl.innerText = "CONNECTED";
                    netlinkerStatusEl.className = "status-value val-online";
                } else {
                    netlinkerStatusEl.innerText = "DISCONNECTED";
                    netlinkerStatusEl.className = "status-value val-offline";
                }
            }

            const globalOverlay = document.getElementById("globale-offline-overlay");
            if (globalOverlay) {
                if (netlinkerConnected) {
                    globalOverlay.classList.remove("active");
                } else {
                    globalOverlay.classList.add("active");
                }
            }
            
            // Aggiorna lo stato del Server HMI a attivo
            const hmiStatusEl = document.getElementById("hmi-status");
            if (hmiStatusEl) {
                hmiStatusEl.innerText = "ACTIVE";
                hmiStatusEl.className = "status-value val-online";
            }
            
            // Rileva e carica configurazione iniziale dal datastore se vuota
            if (Object.keys(config).length === 0) {
                // Fetch config.json originario
                fetchConfig();
            }
            
            aggiornaInterfaccia();
        } catch (e) {
            console.error("Errore parsing SSE:", e);
        }
    };
    
    eventSource.onerror = (err) => {
        console.error("Connessione SSE fallita. TENTATIVO RICONNESSIONE...", err);
        document.getElementById("netlinker-status").innerText = "OFFLINE";
        document.getElementById("netlinker-status").className = "status-value val-offline";
        
        // Aggiorna lo stato del Server HMI a offline
        const hmiStatusEl = document.getElementById("hmi-status");
        if (hmiStatusEl) {
            hmiStatusEl.innerText = "OFFLINE";
            hmiStatusEl.className = "status-value val-offline";
        }
        
        // Imposta tutti i LED a disconnesso
        document.querySelectorAll(".connection-led-badge .led").forEach(led => {
            led.className = "led led-red";
        });
        document.querySelectorAll(".connection-led-badge span:last-child").forEach(txt => {
            txt.innerText = "Offline";
        });
        // Attiva tutti gli overlay offline
        document.querySelectorAll(".offline-overlay").forEach(overlay => {
            overlay.classList.add("active");
        });
    };
}

function fetchConfig() {
    fetch("/api/config")
        .then(res => res.json())
        .then(cfg => {
            config = cfg;
        })
        .catch(err => console.error("Errore fetchConfig:", err));
}

// --- AGGIORNAMENTO DINAMICO INTERFACCIA WEB ---
function aggiornaInterfaccia() {
    aggiornaMatriceGlobale();
    aggiornaSchedaNavette();
    aggiornaSchedaCarrello();
    aggiornaSchedaCaricatore();
    aggiornaSchedaRulliere();
    aggiornaSinottico2D();
    aggiornaSinottico3D();
}

// 1. Matrice Globale
function aggiornaMatriceGlobale() {
    const table = document.getElementById("global-status-table");
    if (!table) return;

    // Determina le macchine attive (filtrate da config o presenti in currentStates)
    const macchineAttive = ["Carrello", "Caricatore", "Rulliere"];
    
    // Aggiungi le navette abilitate
    for (let i = 1; i <= 10; i++) {
        const navName = `Navetta_${i}`;
        // Se c'è nello stato ed è attiva, o per default navette 1..4
        if (currentStates[navName] || (i <= 4)) {
            macchineAttive.unshift(navName); // Aggiungi in testa per ordine
        }
    }
    
    // Rimuove duplicati mantenendo l'ordine
    const macchineUniche = [...new Set(macchineAttive)];
    
    // Rigenera header tabella se necessario
    const theadRow = table.querySelector("thead tr");
    const currentHeaders = Array.from(theadRow.querySelectorAll("th")).map(th => th.innerText);
    
    const targetHeaders = ["Comando"];
    macchineUniche.forEach(m => {
        const statoMacchina = currentStates[m] || {};
        const comunicazione_ok = statoMacchina.__comunicazione_ok__;
        let label = m.replace("Navetta_", "Nav ");
        if (!comunicazione_ok) {
            label += " ⚠️";
        }
        targetHeaders.push(label);
    });
    
    if (JSON.stringify(currentHeaders) !== JSON.stringify(targetHeaders)) {
        theadRow.innerHTML = "<th>Comando</th>";
        macchineUniche.forEach(m => {
            const statoMacchina = currentStates[m] || {};
            const comunicazione_ok = statoMacchina.__comunicazione_ok__;
            let label = m.replace("Navetta_", "Nav ");
            if (!comunicazione_ok) {
                label += " ⚠️";
            }
            const th = document.createElement("th");
            th.innerText = label;
            theadRow.appendChild(th);
        });
        
        // Ricostruisci anche le celle del corpo
        ["EnableInverter", "Home", "Automatico"].forEach(cmd => {
            const rowId = cmd === "EnableInverter" ? "row-enable-inverter" : `row-${cmd.toLowerCase()}`;
            const row = document.getElementById(rowId);
            if (row) {
                // Rimuovi celle tranne la prima
                const cells = row.querySelectorAll("td");
                for (let j = 1; j < cells.length; j++) {
                    cells[j].remove();
                }
                
                // Aggiungi celle vuote con indicatori
                macchineUniche.forEach(m => {
                    const td = document.createElement("td");
                    td.id = `cell-${cmd}-${m}`;
                    td.className = "state-cell";
                    td.innerHTML = `<span class="badge-state" style="color:var(--text-muted); font-weight:bold; font-family:sans-serif;">X</span>`;
                    row.appendChild(td);
                });
            }
        });
    }
    
    // Aggiorna lo stato delle celle nella tabella
    ["EnableInverter", "Home", "Automatico"].forEach(cmd => {
        macchineUniche.forEach(m => {
            const cell = document.getElementById(`cell-${cmd}-${m}`);
            if (!cell) return;
            
            const statoMacchina = currentStates[m] || {};
            const comunicazione_ok = statoMacchina.__comunicazione_ok__;
            
            // Mappatura comandi -> flag di stato reali PLC
            let flag = false;
            let ok = false;
            
            if (cmd === "EnableInverter") {
                flag = statoMacchina.Stato_EnableDrive;
                ok = validaCondizioni(m, "EnableInverter_ON").allOk;
            } else if (cmd === "Home") {
                flag = statoMacchina.Home_OK;
                ok = validaCondizioni(m, "CMD_Home").allOk;
            } else if (cmd === "Automatico") {
                flag = statoMacchina.Stato_Automatico;
                ok = validaCondizioni(m, "Enable_Auto_ON").allOk;
            }
            
            if (!comunicazione_ok) {
                cell.innerHTML = `<span class="badge-state" style="color:var(--accent-orange)">⚠️</span>`;
            } else if (flag) {
                cell.innerHTML = `<span class="badge-state" style="color:var(--accent-green)">✅</span>`;
            } else if (!ok) {
                cell.innerHTML = `<span class="badge-state" style="color:var(--text-muted); font-weight:bold; font-family:sans-serif;">X</span>`;
            } else {
                cell.innerHTML = `<span class="badge-state" style="color:var(--accent-red)">⭕</span>`;
            }
        });
    });
}

// 2. Scheda Navette
function aggiornaSchedaNavette() {
    const selectorBar = document.querySelector(".navetta-selector-bar");
    if (!selectorBar) return;
    
    // Genera bottoni di selezione navette se vuoto
    if (selectorBar.children.length === 0) {
        for (let i = 1; i <= 4; i++) {
            const btn = document.createElement("button");
            btn.className = `btn-nav-select ${i === 1 ? 'active' : ''}`;
            btn.innerText = `Navetta ${i}`;
            btn.addEventListener("click", () => {
                document.querySelectorAll(".btn-nav-select").forEach(b => b.classList.remove("active"));
                btn.classList.add("active");
                activeNavettaIndex = i - 1;
                document.getElementById("navetta-selezionata-title").innerText = `Navetta ${i}`;
                
                // Mostra/Nascondi opzioni specifiche per Navetta 4 (template on-demand)
                const isNav4 = (i === 4);
                const tplGrp = document.getElementById("navetta-4-tpl-group");
                if (tplGrp) tplGrp.style.display = isNav4 ? "flex" : "none";
                const extId = document.getElementById("navetta-4-extra-id");
                if (extId) extId.style.display = isNav4 ? "flex" : "none";
                const extLen = document.getElementById("navetta-4-extra-lunghezza");
                if (extLen) extLen.style.display = isNav4 ? "flex" : "none";
                
                aggiornaSchedaNavette();
            });
            selectorBar.appendChild(btn);
        }
    }
    
    const nomeMacchina = `Navetta_${activeNavettaIndex + 1}`;
    const stato = currentStates[nomeMacchina] || {};
    const comunicazione_ok = stato.__comunicazione_ok__;
    
    // Gestisci overlay offline
    const overlay = document.getElementById("navetta-offline-overlay");
    if (comunicazione_ok) {
        overlay.classList.remove("active");
        document.getElementById("navetta-led").className = "led led-green";
        document.getElementById("navetta-connection-text").innerText = "Connesso";
        // Riabilita i controlli
        const panel = document.getElementById("panel-navette");
        if (panel) {
            panel.querySelectorAll("button, input").forEach(ctrl => {
                ctrl.disabled = false;
            });
        }
    } else {
        overlay.classList.add("active");
        document.getElementById("navetta-led").className = "led led-red";
        document.getElementById("navetta-connection-text").innerText = "Offline";
        invalidaDatiNavetta();
        return;
    }
    
    // Aggiorna badge e variabili di stato
    const keys = [
        "X_Homed", "Y_Homed", "Z_Homed", "Home_OK",
        "Stato_Pick", "Stato_Picked", "IndexTabellaLavoro",
        "Stato_Emergenza", "Stato_Aria_OK", "Stato_Inverter_OK",
        "Stato_ComunicazioneRulliere", "Stato_ComunicazioneCarrello"
    ];
    
    keys.forEach(k => {
        const el = document.getElementById(`nav-val-${k}`);
        if (!el) return;
        
        const val = stato[k];
        
        if (k === "IndexTabellaLavoro") {
            if (el.tagName === "INPUT") {
                el.value = val !== undefined ? val : "";
            } else {
                el.innerText = val !== undefined ? val : "-";
            }
        } else if (k === "Stato_Emergenza") {
            el.innerText = val ? "❌ ALLARME" : "✅ OK";
            el.className = `badge ${val ? 'val-offline' : 'val-online'}`;
        } else if (typeof val === "boolean") {
            el.innerText = val ? "✅" : "❌";
            el.style.color = val ? "var(--accent-green)" : "var(--accent-red)";
        }
    });
    
    // Disabilita pulsanti in base alle condizioni
    const cmdList = ["EnableInverter_ON", "EnableInverter_OFF", "CMD_Home", "Enable_Auto_ON", "Enable_Auto_OFF", "MaintenancePosition_ON", "MaintenancePosition_OFF", "CMD_Reset", "CMD_StopAir"];
    cmdList.forEach(cmd => {
        const cond = validaCondizioni(nomeMacchina, cmd);
        const btnId = getBtnIdFromCmd("nav", cmd);
        const btn = document.getElementById(btnId);
        if (btn) {
            btn.disabled = !cond.allOk;
        }
    });

    // Aggiorna pulsanti (Sunken / Raised) e disabilita se già attivi (dopo il controllo condizioni)
    updateButtonToggle("nav", "CMD_EnableDrive", stato.Stato_EnableDrive);
    updateButtonToggle("nav", "CMD_Automatico", stato.Stato_Automatico);
    updateButtonToggle("nav", "CMD_MaintenancePosition", stato.Stato_MaintenancePosition);

    // Aggiorna i quote encoders
    const xVal = stato.X_Encoder || 0;
    const zVal = stato.Z_Encoder || 0;
    const y1Val = stato.Y1_Encoder || 0;
    const y2Val = stato.Y2_Encoder || 0;
    document.getElementById("nav-val-X_Encoder").innerText = `${xVal} mm`;
    document.getElementById("nav-val-Z_Encoder").innerText = `${zVal} mm`;
    document.getElementById("nav-val-Y1_Encoder").innerText = `${y1Val} mm`;
    document.getElementById("nav-val-Y2_Encoder").innerText = `${y2Val} mm`;
    
    // Aggiorna gli input non editabili negli azzeramenti
    const navXh = document.getElementById("nav-val-X_Encoder-h");
    const navY1h = document.getElementById("nav-val-Y1_Encoder-h");
    const navY2h = document.getElementById("nav-val-Y2_Encoder-h");
    const navZh = document.getElementById("nav-val-Z_Encoder-h");
    if (navXh) navXh.value = `${xVal} mm`;
    if (navY1h) navY1h.value = `${y1Val} mm`;
    if (navY2h) navY2h.value = `${y2Val} mm`;
    if (navZh) navZh.value = `${zVal} mm`;
    
    if (nomeMacchina === "Navetta_4") {
        const elId = document.getElementById("nav-val-ID");
        if (elId) elId.innerText = stato.ID !== undefined ? stato.ID : "-";
        const elLen = document.getElementById("nav-val-Lunghezza");
        if (elLen) elLen.innerText = stato.Lunghezza !== undefined ? `${stato.Lunghezza} mm` : "-";
        
        // Stato del template on-demand
        const tplBtn = document.getElementById("btn-nav-tpl-toggle");
        if (tplBtn) {
            const isTplActive = (stato.ID !== undefined);
            tplBtn.innerText = isTplActive ? "Disattiva Template" : "Attiva Template";
            tplBtn.className = `btn-ctrl ${isTplActive ? 'btn-on sunken' : 'btn-secondary'}`;
        }
    }

    // Calcola corsa massima da config o valori di default
    const activeNavName = `Navetta_${activeNavettaIndex + 1}`;
    const activeNavCfg = config.navette ? config.navette[activeNavName] : null;
    const corsaMaxX = (activeNavCfg && activeNavCfg.valori) ? activeNavCfg.valori[0] : 27000;
    const corsaMaxZ = (activeNavCfg && activeNavCfg.valori) ? activeNavCfg.valori[3] : 3685;
    
    // Limiti minimi: navette min X = -500, min Z = -200
    const minX = -500;
    const minZ = -200;
    
    const pctX = Math.min(Math.max(((xVal - minX) / (corsaMaxX - minX)) * 100, 0), 100);
    const pctZ = Math.min(Math.max(((zVal - minZ) / (corsaMaxZ - minZ)) * 100, 0), 100);
    
    document.getElementById("nav-bar-x").style.width = `${pctX}%`;
    document.getElementById("nav-ind-x").style.left = `${pctX}%`;
    
    document.getElementById("nav-bar-z").style.height = `${pctZ}%`;
    document.getElementById("nav-ind-z").style.bottom = `${pctZ}%`;
    
    // Aggiorna dinamicamente le etichette degli estremi degli assi
    const lblMinX = document.getElementById("nav-lbl-min-x");
    if (lblMinX) lblMinX.innerText = `${minX} mm`;
    const lblMaxX = document.getElementById("nav-lbl-max-x");
    if (lblMaxX) lblMaxX.innerText = `${corsaMaxX} mm`;
    const lblZeroX = document.getElementById("nav-lbl-zero-x");
    if (lblZeroX) {
        const zeroPct = ((-minX) / (corsaMaxX - minX)) * 100;
        lblZeroX.style.left = `${zeroPct}%`;
    }
    // Aggiorna Zona Carrello (0-4500mm)
    const zoneCarrello = document.querySelector(".track-zone-carrello");
    if (zoneCarrello) {
        const startPct = ((-minX) / (corsaMaxX - minX)) * 100;
        const widthPct = (4500 / (corsaMaxX - minX)) * 100;
        zoneCarrello.style.left = `${startPct}%`;
        zoneCarrello.style.width = `${widthPct}%`;
    }
    
    const lblMaxZ = document.getElementById("nav-lbl-max-z");
    if (lblMaxZ) lblMaxZ.innerText = `${corsaMaxZ} mm`;
    const lblMinZ = document.getElementById("nav-lbl-min-z");
    if (lblMinZ) lblMinZ.innerText = `${minZ} mm`;
    
    // Aggiorna limiti min/max dinamici per i controlli GoTo
    const gotoX = document.getElementById("nav-goto-x-val");
    if (gotoX) {
        gotoX.min = minX;
        gotoX.max = corsaMaxX;
    }
    const gotoZ = document.getElementById("nav-goto-z-val");
    if (gotoZ) {
        gotoZ.min = minZ;
        gotoZ.max = corsaMaxZ;
    }
}

// 3. Scheda Carrello
function aggiornaSchedaCarrello() {
    const nomeMacchina = "Carrello";
    const stato = currentStates[nomeMacchina] || {};
    const comunicazione_ok = stato.__comunicazione_ok__;
    
    const overlay = document.getElementById("carrello-offline-overlay");
    if (comunicazione_ok) {
        overlay.classList.remove("active");
        document.getElementById("carrello-led").className = "led led-green";
        document.getElementById("carrello-connection-text").innerText = "Connesso";
        // Riabilita i controlli
        const panel = document.getElementById("panel-carrello");
        if (panel) {
            panel.querySelectorAll("button, input").forEach(ctrl => {
                ctrl.disabled = false;
            });
        }
    } else {
        overlay.classList.add("active");
        document.getElementById("carrello-led").className = "led led-red";
        document.getElementById("carrello-connection-text").innerText = "Offline";
        invalidaDatiCarrello();
        return;
    }
    
    const keys = [
        "Y_Homed", "Rotazione_Homed", "Home_OK",
        "Stato_Pick", "Stato_Picked", "IndexTabellaLavoro",
        "Stato_Emergenza", "Stato_Aria_OK", "Stato_Inverter_OK",
        "Stato_ComunicazioneRulliere", "Stato_ComunicazioneCaricatore", "Stato_ComunicazioneNavette"
    ];
    
    keys.forEach(k => {
        const el = document.getElementById(`carr-val-${k}`);
        if (!el) return;
        
        const val = stato[k];
        
        if (k === "IndexTabellaLavoro") {
            if (el.tagName === "INPUT") {
                el.value = val !== undefined ? val : "";
            } else {
                el.innerText = val !== undefined ? val : "-";
            }
        } else if (k === "Stato_Emergenza") {
            el.innerText = val ? "❌ ALLARME" : "✅ OK";
            el.className = `badge ${val ? 'val-offline' : 'val-online'}`;
        } else if (typeof val === "boolean") {
            el.innerText = val ? "✅" : "❌";
            el.style.color = val ? "var(--accent-green)" : "var(--accent-red)";
        }
    });

    // Condizioni pulsanti
    const cmdList = ["EnableInverter_ON", "EnableInverter_OFF", "CMD_Home", "Enable_Auto_ON", "Enable_Auto_OFF", "MaintenancePosition_ON", "MaintenancePosition_OFF", "CMD_Reset"];
    cmdList.forEach(cmd => {
        const cond = validaCondizioni(nomeMacchina, cmd);
        const btnId = getBtnIdFromCmd("carr", cmd);
        const btn = document.getElementById(btnId);
        if (btn) {
            btn.disabled = !cond.allOk;
        }
    });

    // Aggiorna pulsanti (Sunken / Raised) e disabilita se già attivi (dopo il controllo condizioni)
    updateButtonToggle("carr", "CMD_EnableDrive", stato.Stato_EnableDrive);
    updateButtonToggle("carr", "CMD_Automatico", stato.Stato_Automatico);
    updateButtonToggle("carr", "CMD_MaintenancePosition", stato.Stato_MaintenancePosition);

    // Encoders
    const yVal = stato.Y_Encoder || 0;
    const rotVal = stato.Rotazione_Encoder || 0;
    document.getElementById("carr-val-Y_Encoder").innerText = `${yVal} mm`;
    document.getElementById("carr-val-Rotazione_Encoder").innerText = `${rotVal.toFixed(1)}°`;
    
    // Aggiorna gli input non editabili negli azzeramenti
    const carrYh = document.getElementById("carr-val-Y_Encoder-h");
    const carrRoth = document.getElementById("carr-val-Rotazione_Encoder-h");
    if (carrYh) carrYh.value = `${yVal} mm`;
    if (carrRoth) carrRoth.value = `${rotVal.toFixed(1)}°`;

    // Visualizzazione Y da config
    const corsaMaxY = (config.carrello && config.carrello.corsa_max_y) || 28500;
    const minY = -200;
    
    const pctY = Math.min(Math.max(((yVal - minY) / (corsaMaxY - minY)) * 100, 0), 100);
    document.getElementById("carr-bar-y").style.height = `${pctY}%`;
    document.getElementById("carr-ind-y").style.bottom = `${pctY}%`;
    
    // Aggiorna le etichette degli estremi dell'asse Y
    const lblMaxY = document.getElementById("carr-lbl-max-y");
    if (lblMaxY) lblMaxY.innerText = `${corsaMaxY} mm`;
    const lblMinY = document.getElementById("carr-lbl-min-y");
    if (lblMinY) lblMinY.innerText = `${minY} mm`;
    
    // Aggiorna limiti min/max dinamici per i controlli GoTo
    const gotoY = document.getElementById("carr-goto-y-val");
    if (gotoY) {
        gotoY.min = minY;
        gotoY.max = corsaMaxY;
    }
    const gotoRot = document.getElementById("carr-goto-rot-val");
    if (gotoRot) {
        gotoRot.min = -80;
        gotoRot.max = 80;
    }

    // Aggiorna rotazione ago dial
    const needle = document.getElementById("carr-needle");
    if (needle) {
        needle.setAttribute("transform", `rotate(${rotVal} 50 50)`);
    }

    // Disegna indicatori navette sulla barra Y del carrello usando lo stesso offset e scala
    const markersContainer = document.getElementById("carr-nav-markers");
    if (markersContainer) {
        markersContainer.innerHTML = "";
        for (let i = 1; i <= 4; i++) {
            const navCfg = currentStates[`Navetta_${i}`] || {};
            // Usiamo la quota Y statica preimpostata o dinamica da config
            let yNav = [18500, 21200, 24040, 27060][i-1];
            if (config && config.navette && config.navette[`Navetta_${i}`] && config.navette[`Navetta_${i}`].valori) {
                yNav = config.navette[`Navetta_${i}`].valori[4];
            }
            const pctNav = Math.min(Math.max(((yNav - minY) / (corsaMaxY - minY)) * 100, 0), 100);
            
            const marker = document.createElement("div");
            marker.className = "nav-y-marker";
            marker.style.bottom = `${pctNav}%`;
            marker.innerText = `N${i}`;
            markersContainer.appendChild(marker);
        }
    }
}

// 4. Scheda Caricatore
function aggiornaSchedaCaricatore() {
    const nomeMacchina = "Caricatore";
    const stato = currentStates[nomeMacchina] || {};
    const comunicazione_ok = stato.__comunicazione_ok__;
    
    const overlay = document.getElementById("caricatore-offline-overlay");
    if (comunicazione_ok) {
        overlay.classList.remove("active");
        document.getElementById("caricatore-led").className = "led led-green";
        document.getElementById("caricatore-connection-text").innerText = "Connesso";
        // Riabilita i controlli
        const panel = document.getElementById("panel-caricatore");
        if (panel) {
            panel.querySelectorAll("button, input").forEach(ctrl => {
                ctrl.disabled = false;
            });
        }
    } else {
        overlay.classList.add("active");
        document.getElementById("caricatore-led").className = "led led-red";
        document.getElementById("caricatore-connection-text").innerText = "Offline";
        invalidaDatiCaricatore();
        return;
    }
    
    const keys = [
        "Z_Homed", "Rotazione_Homed", "Telaio_Homed", "Home_OK",
        "Stato_Pick", "Stato_Picked", "IndexTabellaLavoro",
        "Stato_Emergenza", "Stato_Aria_OK", "Stato_Inverter_OK",
        "Stato_ComunicazioneRulliere", "Stato_ComunicazioneCarrello"
    ];
    
    keys.forEach(k => {
        const el = document.getElementById(`car-val-${k}`);
        if (!el) return;
        
        const val = stato[k];
        
        if (k === "IndexTabellaLavoro") {
            if (el.tagName === "INPUT") {
                el.value = val !== undefined ? val : "";
            } else {
                el.innerText = val !== undefined ? val : "-";
            }
        } else if (k === "Stato_Emergenza") {
            el.innerText = val ? "❌ ALLARME" : "✅ OK";
            el.className = `badge ${val ? 'val-offline' : 'val-online'}`;
        } else if (typeof val === "boolean") {
            el.innerText = val ? "✅" : "❌";
            el.style.color = val ? "var(--accent-green)" : "var(--accent-red)";
        }
    });

    // Condizioni pulsanti
    const cmdList = ["EnableInverter_ON", "EnableInverter_OFF", "CMD_Home", "Enable_Auto_ON", "Enable_Auto_OFF", "CMD_Reset", "CMD_StopAir"];
    cmdList.forEach(cmd => {
        const cond = validaCondizioni(nomeMacchina, cmd);
        const btnId = getBtnIdFromCmd("car", cmd);
        const btn = document.getElementById(btnId);
        if (btn) {
            btn.disabled = !cond.allOk;
        }
    });

    // Aggiorna pulsanti (Sunken / Raised) e disabilita se già attivi (dopo il controllo condizioni)
    updateButtonToggle("car", "CMD_EnableDrive", stato.Stato_EnableDrive);
    updateButtonToggle("car", "CMD_Automatico", stato.Stato_Automatico);

    // Encoders
    const zVal = stato.Z_Encoder || 0;
    const rotVal = stato.Rotazione_Encoder || 0;
    const telVal = stato.telaio_Encoder || 0;
    document.getElementById("car-val-Z_Encoder").innerText = `${zVal} mm`;
    document.getElementById("car-val-Rotazione_Encoder").innerText = `${rotVal.toFixed(1)}°`;
    document.getElementById("car-val-telaio_Encoder").innerText = `${telVal} mm`;
    
    // Aggiorna gli input non editabili negli azzeramenti
    const carZh = document.getElementById("car-val-Z_Encoder-h");
    const carRoth = document.getElementById("car-val-Rotazione_Encoder-h");
    const carTelh = document.getElementById("car-val-telaio_Encoder-h");
    if (carZh) carZh.value = `${zVal} mm`;
    if (carRoth) carRoth.value = `${rotVal.toFixed(1)}°`;
    if (carTelh) carTelh.value = `${telVal} mm`;

    // Visualizzazione Z da config (default 1500)
    const corsaMaxZ = (config.caricatore && config.caricatore.corsa_max_z) || 1500;
    const minZ = -200;
    
    const pctZ = Math.min(Math.max(((zVal - minZ) / (corsaMaxZ - minZ)) * 100, 0), 100);
    document.getElementById("car-bar-z").style.height = `${pctZ}%`;
    document.getElementById("car-ind-z").style.bottom = `${pctZ}%`;
    
    // Aggiorna le etichette degli estremi dell'asse Z
    const lblMaxZ = document.getElementById("car-lbl-max-z");
    if (lblMaxZ) lblMaxZ.innerText = `${corsaMaxZ} mm`;
    const lblMinZ = document.getElementById("car-lbl-min-z");
    if (lblMinZ) lblMinZ.innerText = `${minZ} mm`;

    // Aggiorna ago rotazione
    const needle = document.getElementById("car-needle");
    if (needle) {
        needle.setAttribute("transform", `rotate(${rotVal} 50 50)`);
    }
}

// 5. Scheda Rulliere
function aggiornaSchedaRulliere() {
    const nomeMacchina = "Rulliere";
    const stato = currentStates[nomeMacchina] || {};
    const comunicazione_ok = stato.__comunicazione_ok__;
    
    const overlay = document.getElementById("rulliere-offline-overlay");
    if (comunicazione_ok) {
        overlay.classList.remove("active");
        document.getElementById("rulliere-led").className = "led led-green";
        document.getElementById("rulliere-connection-text").innerText = "Connesso";
        // Riabilita i controlli
        const panel = document.getElementById("panel-rulliere");
        if (panel) {
            panel.querySelectorAll("button, input").forEach(ctrl => {
                ctrl.disabled = false;
            });
        }
    } else {
        overlay.classList.add("active");
        document.getElementById("rulliere-led").className = "led led-red";
        document.getElementById("rulliere-connection-text").innerText = "Offline";
        invalidaDatiRulliere();
        return;
    }
    
    const keys = [
        "Stato_PannelloSuBiesse", "Stato_PannelloSuR1", "Stato_PannelloSuR2",
        "Stato_Pick", "Stato_Picked", "IndexTabellaLavoro",
        "Stato_Emergenza", "Stato_Aria_OK", "Stato_Inverter_OK",
        "Stato_ComunicazioneCarrello"
    ];
    
    keys.forEach(k => {
        const el = document.getElementById(`rul-val-${k}`);
        if (!el) return;
        
        const val = stato[k];
        
        if (k === "IndexTabellaLavoro") {
            if (el.tagName === "INPUT") {
                el.value = val !== undefined ? val : "";
            } else {
                el.innerText = val !== undefined ? val : "-";
            }
        } else if (k === "Stato_Emergenza") {
            el.innerText = val ? "❌ ALLARME" : "✅ OK";
            el.className = `badge ${val ? 'val-offline' : 'val-online'}`;
        } else if (typeof val === "boolean") {
            el.innerText = val ? "✅" : "❌";
            el.style.color = val ? "var(--accent-green)" : "var(--accent-red)";
        }
    });

    // Condizioni pulsanti
    const cmdList = ["EnableInverter_ON", "EnableInverter_OFF", "Enable_Auto_ON", "Enable_Auto_OFF", "CMD_Reset"];
    cmdList.forEach(cmd => {
        const cond = validaCondizioni(nomeMacchina, cmd);
        const btnId = getBtnIdFromCmd("rul", cmd);
        const btn = document.getElementById(btnId);
        if (btn) {
            btn.disabled = !cond.allOk;
        }
    });

    // Aggiorna pulsanti (Sunken / Raised) e disabilita se già attivi (dopo il controllo condizioni)
    updateButtonToggle("rul", "CMD_EnableDrive", stato.Stato_EnableDrive);
    updateButtonToggle("rul", "CMD_Automatico", stato.Stato_Automatico);

    // Aggiorna luci sinottico rulli
    const biesseLight = document.getElementById("light-biesse");
    const r1Light = document.getElementById("light-r1");
    const r2Light = document.getElementById("light-r2");
    
    updateBeltLight(biesseLight, stato.Stato_PannelloSuBiesse, "Pannello Su Biesse");
    updateBeltLight(r1Light, stato.Stato_PannelloSuR1, "Pannello Su R1");
    updateBeltLight(r2Light, stato.Stato_PannelloSuR2, "Pannello Su R2");
}

function updateBeltLight(el, active, text) {
    if (!el) return;
    if (active) {
        el.innerText = "PRESENTE";
        el.className = "belt-status-light active-move";
    } else {
        el.innerText = "LIBERO";
        el.className = "belt-status-light";
    }
}

// Helpers pulsanti toggle
function updateButtonToggle(prefix, param, active) {
    let suffix = param.split("_")[1].toLowerCase();
    if (suffix === "enabledrive") suffix = "drive";
    if (suffix === "automatico") suffix = "auto";
    if (suffix === "maintenanceposition") suffix = "maint";
    
    const btnOn = document.getElementById(`btn-${prefix}-${suffix}-on`);
    const btnOff = document.getElementById(`btn-${prefix}-${suffix}-off`);
    
    if (btnOn && btnOff) {
        if (active) {
            btnOn.classList.add("sunken");
            btnOff.classList.remove("sunken");
            btnOn.disabled = true; // Se già attivo, non ri-abilitare
        } else {
            btnOn.classList.remove("sunken");
            btnOff.classList.add("sunken");
            btnOff.disabled = true; // Se già spento, non ri-disabilitare
        }
    }
}

function getBtnIdFromCmd(prefix, cmd) {
    if (cmd === "EnableInverter_ON") return `btn-${prefix}-drive-on`;
    if (cmd === "EnableInverter_OFF") return `btn-${prefix}-drive-off`;
    if (cmd === "CMD_Home") return `btn-${prefix}-home`;
    if (cmd === "Enable_Auto_ON") return `btn-${prefix}-auto-on`;
    if (cmd === "Enable_Auto_OFF") return `btn-${prefix}-auto-off`;
    if (cmd === "MaintenancePosition_ON") return `btn-${prefix}-maint-on`;
    if (cmd === "MaintenancePosition_OFF") return `btn-${prefix}-maint-off`;
    if (cmd === "CMD_Reset") return `btn-${prefix}-reset`;
    if (cmd === "CMD_StopAir") return `btn-${prefix}-stopair`;
    return null;
}

// --- FUNZIONI DI INVALIDAZIONE DATI OFFLINE ---
function invalidaDatiNavetta() {
    const keys = [
        "X_Homed", "Y_Homed", "Z_Homed", "Home_OK",
        "Stato_Pick", "Stato_Picked", "IndexTabellaLavoro",
        "Stato_Emergenza", "Stato_Aria_OK", "Stato_Inverter_OK",
        "Stato_ComunicazioneRulliere", "Stato_ComunicazioneCarrello"
    ];
    keys.forEach(k => {
        const el = document.getElementById(`nav-val-${k}`);
        if (!el) return;
        if (k === "Stato_Emergenza") {
            el.innerText = "⭕ SCONNESSO";
            el.className = "badge";
            el.style.color = "var(--text-muted)";
        } else if (k === "IndexTabellaLavoro") {
            if (el.tagName === "INPUT") {
                el.value = "";
            } else {
                el.innerText = "-";
            }
        } else {
            el.innerText = "⭕";
            el.style.color = "var(--text-muted)";
        }
    });

    document.getElementById("nav-val-X_Encoder").innerText = "-";
    document.getElementById("nav-val-Z_Encoder").innerText = "-";
    document.getElementById("nav-val-Y1_Encoder").innerText = "-";
    document.getElementById("nav-val-Y2_Encoder").innerText = "-";

    const navXh = document.getElementById("nav-val-X_Encoder-h");
    const navY1h = document.getElementById("nav-val-Y1_Encoder-h");
    const navY2h = document.getElementById("nav-val-Y2_Encoder-h");
    const navZh = document.getElementById("nav-val-Z_Encoder-h");
    if (navXh) navXh.value = "-";
    if (navY1h) navY1h.value = "-";
    if (navY2h) navY2h.value = "-";
    if (navZh) navZh.value = "-";

    const elId = document.getElementById("nav-val-ID");
    if (elId) elId.innerText = "-";
    const elLen = document.getElementById("nav-val-Lunghezza");
    if (elLen) elLen.innerText = "-";

    const panel = document.getElementById("panel-navette");
    if (panel) {
        panel.querySelectorAll("button, input:not([readonly])").forEach(ctrl => {
            if (!ctrl.classList.contains("btn-nav-select")) {
                ctrl.disabled = true;
            }
        });
    }
}

function invalidaDatiCarrello() {
    const keys = [
        "Y_Homed", "Rotazione_Homed", "Home_OK",
        "Stato_Pick", "Stato_Picked", "IndexTabellaLavoro",
        "Stato_Emergenza", "Stato_Aria_OK", "Stato_Inverter_OK",
        "Stato_ComunicazioneRulliere", "Stato_ComunicazioneCaricatore", "Stato_ComunicazioneNavette"
    ];
    keys.forEach(k => {
        const el = document.getElementById(`carr-val-${k}`);
        if (!el) return;
        if (k === "Stato_Emergenza") {
            el.innerText = "⭕ SCONNESSO";
            el.className = "badge";
            el.style.color = "var(--text-muted)";
        } else if (k === "IndexTabellaLavoro") {
            if (el.tagName === "INPUT") {
                el.value = "";
            } else {
                el.innerText = "-";
            }
        } else {
            el.innerText = "⭕";
            el.style.color = "var(--text-muted)";
        }
    });

    document.getElementById("carr-val-Y_Encoder").innerText = "-";
    document.getElementById("carr-val-Rotazione_Encoder").innerText = "-";

    const carrYh = document.getElementById("carr-val-Y_Encoder-h");
    const carrRoth = document.getElementById("carr-val-Rotazione_Encoder-h");
    if (carrYh) carrYh.value = "-";
    if (carrRoth) carrRoth.value = "-";

    const panel = document.getElementById("panel-carrello");
    if (panel) {
        panel.querySelectorAll("button, input:not([readonly])").forEach(ctrl => {
            ctrl.disabled = true;
        });
    }
}

function invalidaDatiCaricatore() {
    const keys = [
        "Z_Homed", "Rotazione_Homed", "Telaio_Homed", "Home_OK",
        "Stato_Pick", "Stato_Picked", "IndexTabellaLavoro",
        "Stato_Emergenza", "Stato_Aria_OK", "Stato_Inverter_OK",
        "Stato_ComunicazioneRulliere", "Stato_ComunicazioneCarrello"
    ];
    keys.forEach(k => {
        const el = document.getElementById(`car-val-${k}`);
        if (!el) return;
        if (k === "Stato_Emergenza") {
            el.innerText = "⭕ SCONNESSO";
            el.className = "badge";
            el.style.color = "var(--text-muted)";
        } else if (k === "IndexTabellaLavoro") {
            if (el.tagName === "INPUT") {
                el.value = "";
            } else {
                el.innerText = "-";
            }
        } else {
            el.innerText = "⭕";
            el.style.color = "var(--text-muted)";
        }
    });

    document.getElementById("car-val-Z_Encoder").innerText = "-";
    document.getElementById("car-val-Rotazione_Encoder").innerText = "-";
    document.getElementById("car-val-telaio_Encoder").innerText = "-";

    const carZh = document.getElementById("car-val-Z_Encoder-h");
    const carRoth = document.getElementById("car-val-Rotazione_Encoder-h");
    const carTelh = document.getElementById("car-val-telaio_Encoder-h");
    if (carZh) carZh.value = "-";
    if (carRoth) carRoth.value = "-";
    if (carTelh) carTelh.value = "-";

    const panel = document.getElementById("panel-caricatore");
    if (panel) {
        panel.querySelectorAll("button, input:not([readonly])").forEach(ctrl => {
            ctrl.disabled = true;
        });
    }
}

function invalidaDatiRulliere() {
    const keys = [
        "Stato_PannelloSuBiesse", "Stato_PannelloSuR1", "Stato_PannelloSuR2",
        "Stato_Pick", "Stato_Picked", "IndexTabellaLavoro",
        "Stato_Emergenza", "Stato_Aria_OK", "Stato_Inverter_OK",
        "Stato_ComunicazioneCarrello"
    ];
    keys.forEach(k => {
        const el = document.getElementById(`rul-val-${k}`);
        if (!el) return;
        if (k === "Stato_Emergenza") {
            el.innerText = "⭕ SCONNESSO";
            el.className = "badge";
            el.style.color = "var(--text-muted)";
        } else if (k === "IndexTabellaLavoro") {
            if (el.tagName === "INPUT") {
                el.value = "";
            } else {
                el.innerText = "-";
            }
        } else {
            el.innerText = "⭕";
            el.style.color = "var(--text-muted)";
        }
    });

    const panel = document.getElementById("panel-rulliere");
    if (panel) {
        panel.querySelectorAll("button, input:not([readonly])").forEach(ctrl => {
            ctrl.disabled = true;
        });
    }
}

// --- LOGICA VALIDAZIONE CONDIZIONI IN JAVASCRIPT (ZERO-LATENCY HOVER HELP) ---
function validaCondizioni(macchina, comando) {
    const stato = currentStates[macchina] || {};
    const commOk = stato.__comunicazione_ok__;
    
    let conditions = [];
    let tooltip = "";
    
    if (macchina.startsWith("Navetta")) {
        const rulliereOk = stato.Stato_ComunicazioneRulliere;
        const carrelloOk = stato.Stato_ComunicazioneCarrello;
        const emergenza = stato.Stato_Emergenza;
        const ariaOk = stato.Stato_Aria_OK;
        const auto = stato.Stato_Automatico;
        const drive = stato.Stato_EnableDrive;
        const homeOk = stato.Home_OK;
        const maint = stato.Stato_MaintenancePosition;
        const pick = stato.Stato_Pick;
        const picked = stato.Stato_Picked;
        const invOk = stato.Stato_Inverter_OK;
        
        switch (comando) {
            case "EnableInverter_ON":
                tooltip = "Pulsante per l'abilitazione di tutti gli inverter motori.";
                conditions = [
                    ["Comunicazione OK", commOk && rulliereOk && carrelloOk],
                    ["Emergenze OK", !emergenza],
                    ["Aria OK", ariaOk],
                    ["Manuale", !auto]
                ];
                break;
            case "EnableInverter_OFF":
                tooltip = "Disabilita tutti gli inverter motori.";
                conditions = [["Comunicazione OK", commOk]];
                break;
            case "CMD_Home":
                tooltip = "Avvia l'azzeramento degli assi X, Y, Z.";
                conditions = [
                    ["Comunicazione OK", commOk && rulliereOk && carrelloOk],
                    ["Emergenze OK", !emergenza],
                    ["Aria OK", ariaOk],
                    ["Manuale", !auto],
                    ["Driver abilitati", drive]
                ];
                break;
            case "Enable_Auto_ON":
                tooltip = "Mette la navetta in modalità ciclo automatico.";
                conditions = [
                    ["Comunicazione OK", commOk && rulliereOk && carrelloOk],
                    ["Emergenze OK", !emergenza],
                    ["Home OK", homeOk],
                    ["Inverter OK", invOk],
                    ["Driver abilitati", drive],
                    ["Manutenzione disattivata", !maint]
                ];
                break;
            case "Enable_Auto_OFF":
                tooltip = "Mette la navetta in modalità manuale.";
                conditions = [["Comunicazione OK", commOk]];
                break;
            case "MaintenancePosition_ON":
                tooltip = "Sposta la navetta in posizione comoda per manutenzione.";
                conditions = [
                    ["Comunicazione OK", commOk && rulliereOk && carrelloOk],
                    ["Emergenze OK", !emergenza],
                    ["Home OK", homeOk],
                    ["Aria OK", ariaOk],
                    ["Inverter OK", invOk],
                    ["Manuale", !auto],
                    ["Driver abilitati", drive],
                    ["Non in attesa lavoro", !pick],
                    ["Non in lavorazione", !picked]
                ];
                break;
            case "MaintenancePosition_OFF":
                tooltip = "Esce dalla posizione di manutenzione.";
                conditions = [["Comunicazione OK", commOk]];
                break;
            case "CMD_Reset":
                tooltip = "Resetta gli allarmi e cancella l'attuale sequenza di lavoro.";
                conditions = [
                    ["Comunicazione OK", commOk],
                    ["Manuale", !auto]
                ];
                break;
            case "CMD_StopAir":
                tooltip = "Interrompe il soffio o il vuoto dalle ventose.";
                conditions = [
                    ["Comunicazione OK", commOk],
                    ["Manuale", !auto]
                ];
                break;
        }
    } else if (macchina === "Carrello") {
        const rulliereOk = stato.Stato_ComunicazioneRulliere;
        const caricatoreOk = stato.Stato_ComunicazioneCaricatore;
        const navetteOk = stato.Stato_ComunicazioneNavette;
        const emergenza = stato.Stato_Emergenza;
        const ariaOk = stato.Stato_Aria_OK;
        const auto = stato.Stato_Automatico;
        const drive = stato.Stato_EnableDrive;
        const homeOk = stato.Home_OK;
        const maint = stato.Stato_MaintenancePosition;
        const pick = stato.Stato_Pick;
        const picked = stato.Stato_Picked;
        const invOk = stato.Stato_Inverter_OK;

        switch (comando) {
            case "EnableInverter_ON":
                tooltip = "Abilita tutti gli inverter motori del carrello.";
                conditions = [
                    ["Comunicazione OK", commOk && rulliereOk && caricatoreOk && navetteOk],
                    ["Emergenze OK", !emergenza],
                    ["Aria OK", ariaOk],
                    ["Manuale", !auto]
                ];
                break;
            case "EnableInverter_OFF":
                tooltip = "Disabilita tutti gli inverter motori del carrello.";
                conditions = [["Comunicazione OK", commOk]];
                break;
            case "CMD_Home":
                tooltip = "Esegue l'home dell'asse traslazione e rotazione.";
                conditions = [
                    ["Comunicazione OK", commOk && rulliereOk && caricatoreOk && navetteOk],
                    ["Emergenze OK", !emergenza],
                    ["Aria OK", ariaOk],
                    ["Manuale", !auto],
                    ["Driver abilitati", drive]
                ];
                break;
            case "Enable_Auto_ON":
                tooltip = "Mette il carrello in modalità automatica.";
                conditions = [
                    ["Comunicazione OK", commOk && rulliereOk && caricatoreOk && navetteOk],
                    ["Emergenze OK", !emergenza],
                    ["Home OK", homeOk],
                    ["Inverter OK", invOk],
                    ["Driver abilitati", drive],
                    ["Manutenzione disattivata", !maint]
                ];
                break;
            case "Enable_Auto_OFF":
                tooltip = "Mette il carrello in modalità manuale.";
                conditions = [["Comunicazione OK", commOk]];
                break;
            case "MaintenancePosition_ON":
                tooltip = "Sposta il carrello in posizione di manutenzione.";
                conditions = [
                    ["Comunicazione OK", commOk && rulliereOk && caricatoreOk && navetteOk],
                    ["Emergenze OK", !emergenza],
                    ["Home OK", homeOk],
                    ["Aria OK", ariaOk],
                    ["Inverter OK", invOk],
                    ["Manuale", !auto],
                    ["Driver abilitati", drive],
                    ["Non in attesa lavoro", !pick],
                    ["Non in lavorazione", !picked]
                ];
                break;
            case "MaintenancePosition_OFF":
                tooltip = "Esce dalla posizione di manutenzione.";
                conditions = [["Comunicazione OK", commOk]];
                break;
            case "CMD_Reset":
                tooltip = "Resetta allarmi e sequenza di lavoro corrente.";
                conditions = [
                    ["Comunicazione OK", commOk],
                    ["Manuale", !auto]
                ];
                break;
        }
    } else if (macchina === "Caricatore") {
        const rulliereOk = stato.Stato_ComunicazioneRulliere;
        const emergenza = stato.Stato_Emergenza;
        const ariaOk = stato.Stato_Aria_OK;
        const auto = stato.Stato_Automatico;
        const drive = stato.Stato_EnableDrive;
        const homeOk = stato.Home_OK;
        const maint = stato.Stato_MaintenancePosition;
        const pick = stato.Stato_Pick;
        const picked = stato.Stato_Picked;

        switch (comando) {
            case "EnableInverter_ON":
                tooltip = "Abilita tutti gli inverter motori del caricatore.";
                conditions = [
                    ["Comunicazione OK", commOk && rulliereOk],
                    ["Emergenze OK", !emergenza],
                    ["Aria OK", ariaOk],
                    ["Manuale", !auto]
                ];
                break;
            case "EnableInverter_OFF":
                tooltip = "Disabilita tutti gli inverter motori del caricatore.";
                conditions = [["Comunicazione OK", commOk]];
                break;
            case "CMD_Home":
                tooltip = "Avvia l'azzeramento dell'altezza Z, rotazione e telaio.";
                conditions = [
                    ["Comunicazione OK", commOk && rulliereOk],
                    ["Emergenze OK", !emergenza],
                    ["Aria OK", ariaOk],
                    ["Manuale", !auto],
                    ["Driver abilitati", drive]
                ];
                break;
            case "Enable_Auto_ON":
                tooltip = "Mette il caricatore in modalità ciclo automatico.";
                conditions = [
                    ["Comunicazione OK", commOk && rulliereOk],
                    ["Emergenze OK", !emergenza],
                    ["Home OK", homeOk],
                    ["Driver abilitati", drive],
                    ["Manutenzione disattivata", !maint]
                ];
                break;
            case "Enable_Auto_OFF":
                tooltip = "Mette il caricatore in modalità manuale.";
                conditions = [["Comunicazione OK", commOk]];
                break;
            case "CMD_Reset":
                tooltip = "Resetta allarmi e sequenza di lavoro.";
                conditions = [
                    ["Comunicazione OK", commOk],
                    ["Manuale", !auto]
                ];
                break;
            case "CMD_StopAir":
                tooltip = "Spegne il compressore o il vuoto del telaio ventose.";
                conditions = [
                    ["Comunicazione OK", commOk],
                    ["Manuale", !auto]
                ];
                break;
        }
    } else if (macchina === "Rulliere") {
        const carrelloOk = stato.Stato_ComunicazioneCarrello;
        const emergenza = stato.Stato_Emergenza;
        const ariaOk = stato.Stato_Aria_OK;
        const auto = stato.Stato_Automatico;
        const drive = stato.Stato_EnableDrive;

        switch (comando) {
            case "EnableInverter_ON":
                tooltip = "Abilita tutti gli inverter motori delle rulliere.";
                conditions = [
                    ["Comunicazione OK", commOk && carrelloOk],
                    ["Emergenze OK", !emergenza],
                    ["Aria OK", ariaOk],
                    ["Manuale", !auto]
                ];
                break;
            case "EnableInverter_OFF":
                tooltip = "Disabilita tutti gli inverter motori delle rulliere.";
                conditions = [["Comunicazione OK", commOk]];
                break;
            case "CMD_Home":
                tooltip = "Avvia l'azzeramento delle rulliere.";
                conditions = [
                    ["Comunicazione OK", commOk && carrelloOk],
                    ["Emergenze OK", !emergenza],
                    ["Aria OK", ariaOk],
                    ["Manuale", !auto]
                ];
                break;
            case "Enable_Auto_ON":
                tooltip = "Mette le rulliere in modalità automatica.";
                conditions = [
                    ["Comunicazione OK", commOk && carrelloOk],
                    ["Emergenze OK", !emergenza],
                    ["Aria OK", ariaOk],
                    ["Driver abilitati", drive]
                ];
                break;
            case "Enable_Auto_OFF":
                tooltip = "Mette le rulliere in modalità manuale.";
                conditions = [["Comunicazione OK", commOk]];
                break;
            case "CMD_Reset":
                tooltip = "Resetta allarmi e cinghie.";
                conditions = [
                    ["Comunicazione OK", commOk],
                    ["Manuale", !auto]
                ];
                break;
        }
    }

    const allOk = conditions.length > 0 ? conditions.every(c => c[1]) : false;
    return {
        tooltip,
        conditions,
        allOk
    };
}

function setupHoverHelp() {
    const tooltip = document.getElementById("custom-tooltip");
    
    // Intercetta hover sui pulsanti per mostrare le condizioni del comando nel tooltip fluttuante
    document.addEventListener("mouseover", (e) => {
        const target = e.target.closest(".btn-ctrl, .btn-table-cmd");
        if (!target) return;
        
        let device = target.getAttribute("data-device");
        let param = target.getAttribute("data-param");
        let val = target.getAttribute("data-val");
        
        // Se è nella tabella globale
        if (target.classList.contains("btn-table-cmd")) {
            const cmd = target.getAttribute("data-cmd"); // EnableInverter, Home, Automatico
            let title = "";
            let desc = "";
            if (cmd === "EnableInverter") {
                title = "Comando Globale Inverter";
                desc = "Abilita o disabilita i driver degli inverter per tutte le navette contemporaneamente.";
            } else if (cmd === "Home") {
                title = "Comando Globale Home";
                desc = "Avvia il ciclo di azzeramento (Home) per tutte le navette contemporaneamente.";
            } else if (cmd === "Automatico") {
                title = "Comando Globale Automatico";
                desc = "Attiva o disattiva la modalità automatica per tutte le navette contemporaneamente.";
            }
            
            if (title && tooltip) {
                let html = `<div class="help-content-active">`;
                html += `<p class="help-tooltip">${title}</p>`;
                html += `<p style="font-size:11px; margin:0; color:var(--text-secondary); line-height:1.4;">${desc}</p>`;
                html += `</div>`;
                tooltip.innerHTML = html;
                tooltip.style.display = "block";
            }
            return;
        }

        if (!device) return;
        
        // Risolvi il dispositivo reale (se Navetta, prendi l'indice corrente)
        let realDevice = device;
        if (device === "Navetta") {
            realDevice = `Navetta_${activeNavettaIndex + 1}`;
        }
        
        // Mappa param+val in comando
        let comando = "";
        if (param === "CMD_EnableDrive") {
            comando = val === "-1" ? "EnableInverter_ON" : "EnableInverter_OFF";
        } else if (param === "CMD_Home") {
            comando = "CMD_Home";
        } else if (param === "CMD_Automatico") {
            comando = val === "-1" ? "Enable_Auto_ON" : "Enable_Auto_OFF";
        } else if (param === "CMD_MaintenancePosition") {
            comando = val === "-1" ? "MaintenancePosition_ON" : "MaintenancePosition_OFF";
        } else if (param === "CMD_Reset") {
            comando = "CMD_Reset";
        } else if (param === "CMD_StopAir") {
            comando = "CMD_StopAir";
        }
        
        if (!comando) return;
        
        const condObj = validaCondizioni(realDevice, comando);
        
        if (tooltip) {
            let html = `<div class="help-content-active">`;
            html += `<p class="help-tooltip">${condObj.tooltip}</p>`;
            
            condObj.conditions.forEach(c => {
                const icon = c[1] ? "✅" : "❌";
                const color = c[1] ? "var(--accent-green)" : "var(--accent-red)";
                html += `
                    <div class="help-condition-item">
                        <span>${icon}</span>
                        <span style="color:${color}">${c[0]}</span>
                    </div>
                `;
            });
            html += `</div>`;
            tooltip.innerHTML = html;
            tooltip.style.display = "block";
        }
    });

    document.addEventListener("mouseout", (e) => {
        const target = e.target.closest(".btn-ctrl, .btn-table-cmd");
        if (!target) return;
        
        if (tooltip) {
            tooltip.style.display = "none";
        }
    });

    document.addEventListener("mousemove", (e) => {
        if (tooltip && tooltip.style.display === "block") {
            const tooltipWidth = tooltip.offsetWidth || 240;
            const tooltipHeight = tooltip.offsetHeight || 120;
            
            let x = e.clientX + 15;
            let y = e.clientY + 15;
            
            // Boundary checks
            if (x + tooltipWidth > window.innerWidth) {
                x = e.clientX - tooltipWidth - 15;
            }
            if (y + tooltipHeight > window.innerHeight) {
                y = e.clientY - tooltipHeight - 15;
            }
            
            tooltip.style.left = `${x}px`;
            tooltip.style.top = `${y}px`;
        }
    });
}

// --- COMANDI DI SCRITTURA (CLICK CONTROLS) ---
function setupCommandButtons() {
    // Gestione click sui pulsanti di comando
    document.addEventListener("click", (e) => {
        const btn = e.target.closest(".btn-ctrl");
        if (!btn || btn.disabled) return;
        
        let device = btn.getAttribute("data-device");
        const parameter = btn.getAttribute("data-param");
        const value = btn.getAttribute("data-val");
        
        if (!device || !parameter || !value) return;
        
        // Risolvi Navetta corrente
        if (device === "Navetta") {
            device = `Navetta_${activeNavettaIndex + 1}`;
        }
        
        // Chiedi conferma per reset o operazioni distruttive
        if (parameter === "CMD_Reset" && !confirm("Sei sicuro di voler resettare gli allarmi di " + device + "?")) {
            return;
        }
        if (parameter === "CMD_Home" && !confirm("Avviare la procedura di Home (azzeramento assi) per " + device + "?")) {
            return;
        }

        // Effettua la chiamata API
        inviaScrittura(device, parameter, value);
    });

    // Bottone Stop Inverter Globale
    document.getElementById("btn-stop-inverter")?.addEventListener("click", () => {
        if (confirm("⚠️ ATTENZIONE ⚠️\nSei sicuro di voler DISABILITARE tutti gli inverter di tutte le macchine attive?")) {
            // Disabilita inverter su tutte le macchine note
            const macchine = ["Navetta_1", "Navetta_2", "Navetta_3", "Navetta_4", "Carrello", "Caricatore", "Rulliere"];
            macchine.forEach(m => {
                inviaScrittura(m, "CMD_EnableDrive", "0");
            });
        }
    });

    // Pulsante speciale attivazione template Navetta 4
    document.getElementById("btn-nav-tpl-toggle")?.addEventListener("click", () => {
        const statoNav4 = currentStates["Navetta_4"] || {};
        // Se abbiamo già ID significa che il template tpl_1781456080355 è attivo
        const isTplActive = (statoNav4.ID !== undefined);
        const action = isTplActive ? "disconnect" : "connect";
        
        // Invia comando connect/disconnect via socket (passando tramite API HTTP write generica)
        // Ma per NetLinker la sintassi di attivazione è proprio connect Navetta_4:tpl_1781456080355
        // Il nostro server HTTP gestisce comandi di scrittura ma possiamo fare una chiamata HTTP diretta
        // verso il server. Creiamo una fetch per connect
        fetch(`/api/write?device=Navetta_4&parameter=__template__&value=${action}`)
            .then(res => res.json())
            .then(data => {
                console.log("Template toggle result:", data);
            });
    });
    
    // Gestione bottoni colonne nella tabella globale
    document.addEventListener("click", (e) => {
        const btn = e.target.closest(".btn-table-cmd");
        if (!btn) return;
        
        const cmd = btn.getAttribute("data-cmd"); // EnableInverter, Home, Automatico
        if (!cmd) return;
        
        let promptText = "";
        let param = "";
        let val = "-1";
        
        if (cmd === "EnableInverter") {
            promptText = "Sei sicuro di voler ABILITARE gli inverter su TUTTE le macchine attive?";
            param = "CMD_EnableDrive";
        } else if (cmd === "Home") {
            promptText = "Avviare la procedura di HOME globale su tutti i dispositivi?";
            param = "CMD_Home";
        } else if (cmd === "Automatico") {
            promptText = "Impostare TUTTE le macchine in modalità AUTOMATICA?";
            param = "CMD_Automatico";
        }
        
        if (confirm(promptText)) {
            const macchine = ["Navetta_1", "Navetta_2", "Navetta_3", "Navetta_4", "Carrello", "Caricatore", "Rulliere"];
            macchine.forEach(m => {
                // Invia solo a macchine connesse e che soddisfano le condizioni
                const condCmd = cmd === "EnableInverter" ? "EnableInverter_ON" : cmd === "Home" ? "CMD_Home" : "Enable_Auto_ON";
                const cond = validaCondizioni(m, condCmd);
                if (cond.allOk) {
                    inviaScrittura(m, param, val);
                }
            });
        }
    });

    // Controlli GoTo per Navette
    document.getElementById("btn-nav-goto-x")?.addEventListener("click", () => {
        const devName = `Navetta_${activeNavettaIndex + 1}`;
        const val = document.getElementById("nav-goto-x-val").value;
        eseguiGoTo(devName, "GoToX", val, "CMD_GoToX");
    });
    
    document.getElementById("btn-nav-goto-z")?.addEventListener("click", () => {
        const devName = `Navetta_${activeNavettaIndex + 1}`;
        const val = document.getElementById("nav-goto-z-val").value;
        eseguiGoTo(devName, "GoToZ", val, "CMD_GoToZ");
    });

    // Controlli GoTo per Carrello
    document.getElementById("btn-carr-goto-y")?.addEventListener("click", () => {
        const val = document.getElementById("carr-goto-y-val").value;
        eseguiGoTo("Carrello", "GoToY", val, "CMD_GoToY");
    });
    
    document.getElementById("btn-carr-goto-rot")?.addEventListener("click", () => {
        const val = document.getElementById("carr-goto-rot-val").value;
        eseguiGoTo("Carrello", "GoToRotazione", val, "CMD_GoToRotazione");
    });
}

function eseguiGoTo(device, targetParam, targetVal, cmdParam) {
    if (targetVal === "" || isNaN(targetVal)) {
        alert("Inserire una coordinata valida!");
        return;
    }
    
    fetch(`/api/write?device=${device}&parameter=${targetParam}&value=${targetVal}`)
        .then(res => res.json())
        .then(data1 => {
            if (!data1.success) {
                alert(`Impossibile impostare ${targetParam}: ${data1.error}`);
                return;
            }
            fetch(`/api/write?device=${device}&parameter=${cmdParam}&value=-1`)
                .then(res => res.json())
                .then(data2 => {
                    if (!data2.success) {
                        alert(`Impossibile attivare il comando ${cmdParam}: ${data2.error}`);
                    } else {
                        console.log(`Comando GoTo attivato con successo su ${device}`);
                    }
                });
        })
        .catch(err => {
            console.error("Errore durante l'esecuzione del GoTo:", err);
            alert("Errore di rete durante il comando GoTo");
        });
}

function inviaScrittura(device, parameter, value) {
    // Se stiamo attivando connect/disconnect
    if (parameter === "__template__") {
        const cmd = value === "connect" ? "connect" : "disconnect";
        // Inviamo un comando finto che il backend http_server intercetterà o inviamo tramite comando raw
        // Per semplicità, il nostro http_server intercetterà parameter = __template__ per chiamare connect/disconnect
        fetch(`/api/write?device=${device}&parameter=__template__&value=${value}`)
            .then(res => res.json())
            .then(res => {
                console.log("Template comando inviato:", res);
            });
        return;
    }

    fetch(`/api/write?device=${device}&parameter=${parameter}&value=${value}`)
        .then(res => res.json())
        .then(res => {
            if (!res.success) {
                alert(`Errore invio comando a ${device}: ${res.error}`);
            }
        })
        .catch(err => {
            console.error(`Errore di rete invio comando a ${device}:`, err);
        });
}

function aggiornaSinottico2D() {
    if (activeTab !== "panel-globale" || !document.getElementById("sinottico-2d").classList.contains("active")) {
        return; // Aggiorna solo se visibile
    }
    
    const svg = document.getElementById("svg-layout");
    if (!svg) return;
    
    // Parametri e quote
    const corsaMaxY = 28500;
    const corsaMaxX = 27000;
    
    const carrelloY = (currentStates.Carrello || {}).Y_Encoder || 0;
    const caricatoreRot = (currentStates.Caricatore || {}).Rotazione_Encoder || 0;
    
    // Rigenera lo schema SVG statico se non ancora presente
    if (svg.children.length === 0) {
        let staticHTML = `
            <!-- Sfondo scuro griglia -->
            <defs>
                <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                    <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(255,255,255,0.02)" stroke-width="1"/>
                </pattern>
                <linearGradient id="railGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stop-color="#475569" />
                    <stop offset="50%" stop-color="#64748b" />
                    <stop offset="100%" stop-color="#1e293b" />
                </linearGradient>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)" />
            
            <!-- Rotaie Carrello (Orizzontale, distanti 4500mm/110px, tratteggiate) -->
            <line x1="40" y1="40" x2="1110" y2="40" stroke="rgba(255,255,255,0.15)" stroke-width="4" stroke-dasharray="4,4" />
            <line x1="40" y1="150" x2="1110" y2="150" stroke="rgba(255,255,255,0.15)" stroke-width="4" stroke-dasharray="4,4" />
        `;
        // NOTA: Scritte statiche rimosse per pulizia grafica
        
        svg.innerHTML = staticHTML;
    }

    // Calcolo scala di visualizzazione
    // Mappa corsaMaxY (28500) a larghezza SVG (1050 pixel, da X=50 a X=1100)
    const scaleX = 1050 / corsaMaxY;

    // Rotaie Navette e scaffali dinamici
    const valoriNavetta = [18500, 21200, 24040, 27060];
    for (let i = 1; i <= 4; i++) {
        if (config && config.navette && config.navette[`Navetta_${i}`] && config.navette[`Navetta_${i}`].valori) {
            valoriNavetta[i-1] = config.navette[`Navetta_${i}`].valori[4];
        }
    }
    
    // Mappa corsaMaxX (27000) + 3000mm offset a altezza SVG (da Y=40 a Y=620)
    const startY = 40;
    const endY = 620;
    const scaleY = (endY - startY) / (corsaMaxX + 3000);

    // Helper per verificare se una macchina è pronta (EnableDrive, Home_OK e Automatico attivi)
    function isMachineReady(name, state) {
        const enableDrive = state.Stato_EnableDrive !== undefined ? state.Stato_EnableDrive : true;
        const homeOk = state.Home_OK !== undefined ? state.Home_OK : true;
        const automatico = state.Stato_Automatico !== undefined ? state.Stato_Automatico : true;
        return (enableDrive && homeOk && automatico);
    }
    
    // Calcolo coordinate binari per le scaffalature
    const xBin = [];
    for (let i = 1; i <= 4; i++) {
        xBin.push(1100 - (valoriNavetta[i-1] * scaleX));
    }

    // Calcolo larghezze scaffali per evitare il drift e mantenere un gap costante di 3px tra scaffali adiacenti
    const wLeft = [];
    const wRight = [];
    const gap12 = xBin[0] - xBin[1];
    const gap23 = xBin[1] - xBin[2];
    const gap34 = xBin[2] - xBin[3];

    // Spazio disponibile totale in ciascun gap = Distanza - 18px (7.5px clearance su ogni lato di ciascuna rotaia + 3px gap nel mezzo)
    const w12 = (gap12 - 18) / 2;
    const w23 = (gap23 - 18) / 2;
    const w34 = (gap34 - 18) / 2;

    wLeft[0] = w12;   // Navetta 1 Left Shelf
    wRight[0] = w12;  // Navetta 1 Right Shelf (esterno, specchiato)

    wLeft[1] = w23;   // Navetta 2 Left Shelf
    wRight[1] = w12;  // Navetta 2 Right Shelf

    wLeft[2] = w34;   // Navetta 3 Left Shelf
    wRight[2] = w23;  // Navetta 3 Right Shelf

    wLeft[3] = w34;   // Navetta 4 Left Shelf (esterno, specchiato)
    wRight[3] = w34;  // Navetta 4 Right Shelf

    // Disegna binari navette, scaffali e divisori
    for (let i = 1; i <= 4; i++) {
        const xPosBin = xBin[i-1];
        
        // Rotaia verticale
        let bin = document.getElementById(`bin-nav-${i}`);
        if (!bin) {
            bin = document.createElementNS("http://www.w3.org/2000/svg", "line");
            bin.setAttribute("id", `bin-nav-${i}`);
            bin.setAttribute("y1", "40");
            bin.setAttribute("y2", "730");
            bin.setAttribute("stroke", "rgba(255,255,255,0.15)");
            bin.setAttribute("stroke-width", "4");
            bin.setAttribute("stroke-dasharray", "4,4");
            svg.appendChild(bin);
        }
        bin.setAttribute("x1", xPosBin);
        bin.setAttribute("x2", xPosBin);

        // Scaffale Sinistro
        let shelfLeft = document.getElementById(`shelf-left-${i}`);
        if (!shelfLeft) {
            shelfLeft = document.createElementNS("http://www.w3.org/2000/svg", "rect");
            shelfLeft.setAttribute("id", `shelf-left-${i}`);
            shelfLeft.setAttribute("y", 147);
            shelfLeft.setAttribute("height", 583);
            shelfLeft.setAttribute("fill", "rgba(30, 41, 59, 0.6)");
            shelfLeft.setAttribute("stroke", "rgba(255, 255, 255, 0.15)");
            shelfLeft.setAttribute("stroke-width", "1");
            svg.appendChild(shelfLeft);
        }
        shelfLeft.setAttribute("x", xPosBin - 7.5 - wLeft[i-1]);
        shelfLeft.setAttribute("width", wLeft[i-1]);

        // Scaffale Destro
        let shelfRight = document.getElementById(`shelf-right-${i}`);
        if (!shelfRight) {
            shelfRight = document.createElementNS("http://www.w3.org/2000/svg", "rect");
            shelfRight.setAttribute("id", `shelf-right-${i}`);
            shelfRight.setAttribute("y", 147);
            shelfRight.setAttribute("height", 583);
            shelfRight.setAttribute("fill", "rgba(30, 41, 59, 0.6)");
            shelfRight.setAttribute("stroke", "rgba(255, 255, 255, 0.15)");
            shelfRight.setAttribute("stroke-width", "1");
            svg.appendChild(shelfRight);
        }
        shelfRight.setAttribute("x", xPosBin + 7.5);
        shelfRight.setAttribute("width", wRight[i-1]);

        // Divisori Scaffali
        let shelfDividers = document.getElementById(`shelf-dividers-${i}`);
        if (shelfDividers) {
            shelfDividers.remove();
        }
        shelfDividers = document.createElementNS("http://www.w3.org/2000/svg", "g");
        shelfDividers.setAttribute("id", `shelf-dividers-${i}`);
        let linesHtml = "";
        for (let y = 147 + 30; y < 730; y += 30) {
            linesHtml += `
                <line x1="${xPosBin - 7.5 - wLeft[i-1]}" y1="${y}" x2="${xPosBin - 7.5}" y2="${y}" stroke="rgba(255,255,255,0.15)" stroke-width="1" />
                <line x1="${xPosBin + 7.5}" y1="${y}" x2="${xPosBin + 7.5 + wRight[i-1]}" y2="${y}" stroke="rgba(255,255,255,0.15)" stroke-width="1" />
            `;
        }
        shelfDividers.innerHTML = linesHtml;
        svg.appendChild(shelfDividers);
    }

    // 1. CARRELLO TRASLATORE (Si muove in orizzontale)
    const posXCarrello = 1100 - (carrelloY * scaleX);
    
    let carrGroup = document.getElementById("sin-carrello");
    if (!carrGroup) {
        carrGroup = document.createElementNS("http://www.w3.org/2000/svg", "g");
        carrGroup.setAttribute("id", "sin-carrello");
        carrGroup.setAttribute("style", "cursor: pointer;");
        carrGroup.innerHTML = `
            <!-- Carrello (larghezza 1100mm -> 40px, altezza 4500mm -> 110px) -->
            <rect id="carr-rect" x="-20" y="40" width="40" height="110" fill="rgba(59, 130, 246, 0.2)" stroke="#3b82f6" stroke-width="2.5" rx="3" />
            <!-- Ruote e dettagli -->
            <circle cx="-16" cy="45" r="4" fill="#64748b" />
            <circle cx="16" cy="45" r="4" fill="#64748b" />
            <circle cx="-16" cy="145" r="4" fill="#64748b" />
            <circle cx="16" cy="145" r="4" fill="#64748b" />
            <circle cx="0" cy="95" r="5" fill="#3b82f6" id="carr-center-dot" />
            <text x="0" y="32" font-size="10" font-weight="900" fill="#3b82f6" text-anchor="middle" id="carr-text-label">CARRELLO</text>
            <!-- Warning Overlay -->
            <g id="carr-warning" style="display: none;">
                <rect x="-12" y="81" width="24" height="24" fill="#0f172a" rx="4" opacity="0.85" />
                <text x="0" y="100" font-size="18" text-anchor="middle">⚠️</text>
            </g>
        `;
        carrGroup.addEventListener("dblclick", () => {
            switchTab("panel-carrello");
        });
        svg.appendChild(carrGroup);
    }
    carrGroup.setAttribute("transform", `translate(${posXCarrello}, 0)`);
    
    // Toggle colore/warning carrello in base a prontezza (EnableDrive + Home_OK + Automatico)
    const carrState = currentStates.Carrello || {};
    const carrOnline = carrState.__comunicazione_ok__;
    const carrReady = carrOnline && isMachineReady("Carrello", carrState);
    
    const carrRect = document.getElementById("carr-rect");
    if (carrRect) {
        carrRect.setAttribute("stroke", carrReady ? "#3b82f6" : "#ef4444");
        carrRect.setAttribute("fill", carrReady ? "rgba(59, 130, 246, 0.2)" : "rgba(239, 68, 68, 0.2)");
    }
    const carrCenterDot = document.getElementById("carr-center-dot");
    if (carrCenterDot) {
        carrCenterDot.setAttribute("fill", carrReady ? "#3b82f6" : "#ef4444");
    }
    const carrLabelText = document.getElementById("carr-text-label");
    if (carrLabelText) {
        carrLabelText.setAttribute("fill", carrReady ? "#3b82f6" : "#ef4444");
    }
    const carrWarning = document.getElementById("carr-warning");
    if (carrWarning) {
        carrWarning.style.display = carrReady ? "none" : "block";
    }

    // 2. NAVETTE (Si muovono in verticale sui rispettivi binari)
    for (let i = 1; i <= 4; i++) {
        const navName = `Navetta_${i}`;
        const navState = currentStates[navName] || {};
        const xEnc = navState.X_Encoder || 0;
        const online = navState.__comunicazione_ok__;
        
        const xPosBin = xBin[i-1];
        // Applicazione offset verticale di 3000mm per evitare clipping a quote negative
        const yNav = startY + ((xEnc + 3000) * scaleY);
        
        let navGroup = document.getElementById(`sin-nav-${i}`);
        if (!navGroup) {
            navGroup = document.createElementNS("http://www.w3.org/2000/svg", "g");
            navGroup.setAttribute("id", `sin-nav-${i}`);
            navGroup.setAttribute("style", "cursor: pointer;");
            navGroup.innerHTML = `
                <!-- Navetta (larghezza 400mm -> 15px, altezza 4500mm -> 110px) -->
                <rect id="nav-rect-${i}" x="-7.5" y="0" width="15" height="110" fill="rgba(59, 130, 246, 0.2)" stroke="#3b82f6" stroke-width="2" rx="2" />
                <rect x="-5" y="5" width="10" height="20" fill="#e2e8f0" rx="1" opacity="0.8" />
                <text x="0" y="-8" font-size="10" font-weight="900" fill="#3b82f6" text-anchor="middle" id="nav-text-label-${i}">N${i}</text>
                <!-- Warning Overlay -->
                <g id="nav-warning-${i}" style="display: none;">
                    <rect x="-12" y="43" width="24" height="24" fill="#0f172a" rx="4" opacity="0.85" />
                    <text x="0" y="62" font-size="18" text-anchor="middle">⚠️</text>
                </g>
            `;
            navGroup.addEventListener("dblclick", () => {
                switchTab("panel-navette");
                selectNavetta(i);
            });
            svg.appendChild(navGroup);
        }
        navGroup.setAttribute("transform", `translate(${xPosBin}, ${yNav})`);
        
        const navReady = online && isMachineReady(navName, navState);
        const navWarning = document.getElementById(`nav-warning-${i}`);
        if (navWarning) {
            navWarning.style.display = navReady ? "none" : "block";
        }
        const navRect = document.getElementById(`nav-rect-${i}`);
        if (navRect) {
            navRect.setAttribute("stroke", navReady ? "#3b82f6" : "#ef4444");
            navRect.setAttribute("fill", navReady ? "rgba(59, 130, 246, 0.2)" : "rgba(239, 68, 68, 0.2)");
        }
        const navLabel = document.getElementById(`nav-text-label-${i}`);
        if (navLabel) {
            navLabel.setAttribute("fill", navReady ? "#3b82f6" : "#ef4444");
        }
    }

    // 3. RULLIERE E CINGHIE
    let rullGroup = document.getElementById("sin-rulliere-col");
    if (!rullGroup) {
        rullGroup = document.createElementNS("http://www.w3.org/2000/svg", "g");
        rullGroup.setAttribute("id", "sin-rulliere-col");
        rullGroup.setAttribute("style", "cursor: pointer;");
        
        let r1Rollers = "";
        for (let y = 160; y < 275; y += 15) {
            r1Rollers += `<line x1="1125" y1="${y}" x2="1185" y2="${y}" stroke="#94a3b8" stroke-width="2.5" />`;
        }
        
        let r2Rollers = "";
        for (let y = 440; y < 555; y += 15) {
            r2Rollers += `<line x1="1125" y1="${y}" x2="1185" y2="${y}" stroke="#94a3b8" stroke-width="2.5" />`;
        }
        
        rullGroup.innerHTML = `
            <!-- Rulliera 1 (R1) -->
            <rect id="rul-r1-rect" x="1120" y="150" width="70" height="130" fill="rgba(59, 130, 246, 0.2)" rx="4" stroke="#3b82f6" stroke-width="2" />
            ${r1Rollers}
            <text x="1155" y="215" font-size="10" font-weight="700" fill="#3b82f6" text-anchor="middle" transform="rotate(-90 1155 215)" id="rul-r1-label">RULLIERA 1 (R1)</text>
            
            <!-- Cinghie C1 -->
            <rect id="rul-c1-rect" x="1125" y="295" width="60" height="120" fill="rgba(59, 130, 246, 0.2)" rx="4" stroke="#3b82f6" stroke-width="2" />
            <rect x="1135" y="300" width="8" height="110" fill="#3b82f6" id="rul-belt-line-1" />
            <rect x="1151" y="300" width="8" height="110" fill="#3b82f6" id="rul-belt-line-2" />
            <rect x="1167" y="300" width="8" height="110" fill="#3b82f6" id="rul-belt-line-3" />
            <text x="1155" y="355" font-size="10" font-weight="700" fill="#3b82f6" text-anchor="middle" transform="rotate(-90 1155 355)" id="rul-c1-label">CINGHIE C1</text>
            
            <!-- Rulliera 2 (R2) -->
            <rect id="rul-r2-rect" x="1120" y="430" width="70" height="130" fill="rgba(59, 130, 246, 0.2)" rx="4" stroke="#3b82f6" stroke-width="2" />
            ${r2Rollers}
            <text x="1155" y="495" font-size="10" font-weight="700" fill="#3b82f6" text-anchor="middle" transform="rotate(-90 1155 495)" id="rul-r2-label">RULLIERA 2 (R2)</text>
            
            <!-- Warning Overlay -->
            <g id="rul-warning" style="display: none;">
                <rect x="1143" y="333" width="24" height="24" fill="#0f172a" rx="4" opacity="0.85" />
                <text x="1155" y="352" font-size="18" text-anchor="middle">⚠️</text>
            </g>
        `;
        rullGroup.addEventListener("dblclick", () => {
            switchTab("panel-rulliere");
        });
        svg.appendChild(rullGroup);
    }
    
    // Toggle colore/warning rulliere in base a prontezza (EnableDrive + Automatico)
    const rulState = currentStates.Rulliere || {};
    const rullOnline = rulState.__comunicazione_ok__;
    const rulReady = rullOnline && isMachineReady("Rulliere", rulState);
    
    const r1Rect = document.getElementById("rul-r1-rect");
    const c1Rect = document.getElementById("rul-c1-rect");
    const r2Rect = document.getElementById("rul-r2-rect");
    const rulWarning = document.getElementById("rul-warning");
    
    const b1 = document.getElementById("rul-belt-line-1");
    const b2 = document.getElementById("rul-belt-line-2");
    const b3 = document.getElementById("rul-belt-line-3");
    
    const r1Label = document.getElementById("rul-r1-label");
    const c1Label = document.getElementById("rul-c1-label");
    const r2Label = document.getElementById("rul-r2-label");
    
    const colorVal = rulReady ? "#3b82f6" : "#ef4444";
    const fillVal = rulReady ? "rgba(59, 130, 246, 0.2)" : "rgba(239, 68, 68, 0.2)";
    
    if (r1Rect) { r1Rect.setAttribute("stroke", colorVal); r1Rect.setAttribute("fill", fillVal); }
    if (c1Rect) { c1Rect.setAttribute("stroke", colorVal); c1Rect.setAttribute("fill", fillVal); }
    if (r2Rect) { r2Rect.setAttribute("stroke", colorVal); r2Rect.setAttribute("fill", fillVal); }
    
    if (b1) b1.setAttribute("fill", colorVal);
    if (b2) b2.setAttribute("fill", colorVal);
    if (b3) b3.setAttribute("fill", colorVal);
    
    if (r1Label) r1Label.setAttribute("fill", colorVal);
    if (c1Label) c1Label.setAttribute("fill", colorVal);
    if (r2Label) r2Label.setAttribute("fill", colorVal);
    
    if (rulWarning) {
        rulWarning.style.display = rulReady ? "none" : "block";
    }

    // 4. CARICATORE A VENTOSE
    let carGroup = document.getElementById("sin-caricatore");
    if (!carGroup) {
        carGroup = document.createElementNS("http://www.w3.org/2000/svg", "g");
        carGroup.setAttribute("id", "sin-caricatore");
        carGroup.setAttribute("style", "cursor: pointer;");
        carGroup.innerHTML = `
            <!-- Base caricatore -->
            <circle cx="0" cy="0" r="15" fill="rgba(59, 130, 246, 0.2)" stroke="#3b82f6" stroke-width="1.5" id="sin-caricatore-base" />
            <!-- Braccio rotante -->
            <g id="sin-caricatore-braccio">
                <line x1="0" y1="0" x2="60" y2="0" stroke="#3b82f6" stroke-width="4" id="sin-caricatore-arm-line" />
                <!-- Telaio ventose -->
                <rect x="50" y="-12" width="20" height="24" fill="rgba(59, 130, 246, 0.2)" stroke="#3b82f6" rx="2" id="sin-caricatore-frame" />
                <circle cx="55" cy="-6" r="3" fill="blue" />
                <circle cx="65" cy="-6" r="3" fill="blue" />
                <circle cx="55" cy="6" r="3" fill="blue" />
                <circle cx="65" cy="6" r="3" fill="blue" />
            </g>
            <text x="0" y="-22" font-size="10" font-weight="800" fill="#3b82f6" text-anchor="middle" id="sin-caricatore-label">CARICATORE</text>
            <!-- Warning Overlay -->
            <g id="sin-caricatore-warning" style="display: none;">
                <rect x="-12" y="-12" width="24" height="24" fill="#0f172a" rx="4" opacity="0.85" />
                <text x="0" y="7" font-size="18" text-anchor="middle">⚠️</text>
            </g>
        `;
        carGroup.addEventListener("dblclick", () => {
            switchTab("panel-caricatore");
        });
        svg.appendChild(carGroup);
    }
    // Posizionato vicino a R1 (X=1155, Y=215)
    carGroup.setAttribute("transform", "translate(1210, 215)");
    
    // Ruota il braccio in base all'encoder
    const arm = document.getElementById("sin-caricatore-braccio");
    if (arm) {
        arm.setAttribute("transform", `rotate(${caricatoreRot})`);
    }

    // Toggle colore/warning caricatore in base a prontezza (EnableDrive + Home_OK + Automatico)
    const carState = currentStates.Caricatore || {};
    const caricatoreOnline = carState.__comunicazione_ok__;
    const carReady = caricatoreOnline && isMachineReady("Caricatore", carState);
    
    const carBase = document.getElementById("sin-caricatore-base");
    const carArmLine = document.getElementById("sin-caricatore-arm-line");
    const carFrame = document.getElementById("sin-caricatore-frame");
    const carLabel = document.getElementById("sin-caricatore-label");
    const caricatoreWarning = document.getElementById("sin-caricatore-warning");
    
    const carColorVal = carReady ? "#3b82f6" : "#ef4444";
    const carFillVal = carReady ? "rgba(59, 130, 246, 0.2)" : "rgba(239, 68, 68, 0.2)";
    
    if (carBase) { carBase.setAttribute("stroke", carColorVal); carBase.setAttribute("fill", carFillVal); }
    if (carArmLine) { carArmLine.setAttribute("stroke", carColorVal); }
    if (carFrame) { carFrame.setAttribute("stroke", carColorVal); carFrame.setAttribute("fill", carFillVal); }
    if (carLabel) { carLabel.setAttribute("fill", carColorVal); }
    
    if (caricatoreWarning) {
        caricatoreWarning.style.display = carReady ? "none" : "block";
    }
}

// --- CONSOLE LOG UPDATER ---
function caricaLogConsole() {
    if (activeTab !== "panel-logs") return;
    
    fetch("/api/logs")
        .then(res => res.json())
        .then(logs => {
            const consoleDiv = document.getElementById("logs-console");
            if (!consoleDiv) return;
            
            // Genera righe di log
            let html = "";
            logs.forEach(log => {
                html += `
                    <div class="log-line ${log.level}">
                        <span class="time">[${log.timestamp}]</span>
                        <span class="src">${log.source}</span>
                        <span class="msg">${log.message}</span>
                    </div>
                `;
            });
            
            // Ottimizzazione: aggiorna solo se il contenuto è cambiato per preservare selezione e scroll
            if (consoleDiv.innerHTML !== html) {
                // Rileva se l'utente è a fine pagina (margine di 50px)
                const isScrolledToBottom = consoleDiv.scrollHeight - consoleDiv.clientHeight - consoleDiv.scrollTop < 50;
                
                consoleDiv.innerHTML = html;
                
                // Auto-scroll al fondo solo se l'utente era già a fine pagina
                if (isScrolledToBottom) {
                    consoleDiv.scrollTop = consoleDiv.scrollHeight;
                }
            }
        });
}

// --- GESTIONE IMPOSTAZIONI ---
function caricaConfigForm() {
    // Carica dinamicamente gli input delle navette nella form
    const listContainer = document.getElementById("navette-config-list");
    if (!listContainer) return;
    
    listContainer.innerHTML = "";
    for (let i = 1; i <= 10; i++) {
        const item = document.createElement("div");
        item.className = "navetta-config-item";
        item.innerHTML = `
            <div class="navetta-config-header">
                <span>Navetta ${i}</span>
                <label class="switch-container">
                    <input type="checkbox" id="cfg-nav-active-${i}"> Attivo
                </label>
            </div>
            <div class="navetta-config-fields">
                <div class="field">
                    <span>Corsa Max X (mm):</span>
                    <input type="number" id="cfg-nav-x-${i}" step="any">
                </div>
                <div class="field">
                    <span>Corsa Max Y1 (mm):</span>
                    <input type="number" id="cfg-nav-y1-${i}" step="any">
                </div>
                <div class="field">
                    <span>Corsa Max Y2 (mm):</span>
                    <input type="number" id="cfg-nav-y2-${i}" step="any">
                </div>
                <div class="field">
                    <span>Corsa Max Z (mm):</span>
                    <input type="number" id="cfg-nav-z-${i}" step="any">
                </div>
                <div class="field">
                    <span>Posizione Y (mm):</span>
                    <input type="number" id="cfg-nav-posy-${i}" step="any">
                </div>
            </div>
        `;
        listContainer.appendChild(item);
    }
}

function aggiornaCampiConfig() {
    fetch("/api/config")
        .then(res => res.json())
        .then(cfg => {
            document.getElementById("polling_ip").value = cfg.polling_ip || "localhost";
            document.getElementById("polling_port").value = cfg.polling_port || 9000;
            document.getElementById("refresh").value = cfg.refresh || 0.3;
            document.getElementById("syslog_ip").value = cfg.syslog_ip || "127.0.0.1";
            document.getElementById("syslog_port").value = cfg.syslog_port || 514;
            document.getElementById("carrello_max_y").value = (cfg.carrello && cfg.carrello.corsa_max_y) || 28500;
            document.getElementById("caricatore_max_z").value = (cfg.caricatore && cfg.caricatore.corsa_max_z) || 1500;
            
            // Popola campi navette 1..10
            for (let i = 1; i <= 10; i++) {
                const navName = `Navetta_${i}`;
                const navCfg = (cfg.navette && cfg.navette[navName]) || { attivo: false, valori: [27000, 1200, 1200, 3685, 0] };
                
                document.getElementById(`cfg-nav-active-${i}`).checked = !!navCfg.attivo;
                const vals = navCfg.valori || [27000, 1200, 1200, 3685, 0];
                document.getElementById(`cfg-nav-x-${i}`).value = vals[0];
                document.getElementById(`cfg-nav-y1-${i}`).value = vals[1];
                document.getElementById(`cfg-nav-y2-${i}`).value = vals[2];
                document.getElementById(`cfg-nav-z-${i}`).value = vals[3];
                document.getElementById(`cfg-nav-posy-${i}`).value = vals[4];
            }
        })
        .catch(err => console.error("Errore caricamento configurazione:", err));
}

function salvaConfigurazione(e) {
    e.preventDefault();
    
    // Raccoglie i dati della form
    const configData = {
        polling_ip: document.getElementById("polling_ip").value,
        polling_port: parseInt(document.getElementById("polling_port").value),
        refresh: parseFloat(document.getElementById("refresh").value),
        syslog_ip: document.getElementById("syslog_ip").value,
        syslog_port: parseInt(document.getElementById("syslog_port").value),
        carrello: {
            corsa_max_y: parseFloat(document.getElementById("carrello_max_y").value)
        },
        caricatore: {
            corsa_max_z: parseFloat(document.getElementById("caricatore_max_z").value)
        },
        navette: {}
    };

    for (let i = 1; i <= 10; i++) {
        configData.navette[`Navetta_${i}`] = {
            attivo: document.getElementById(`cfg-nav-active-${i}`).checked,
            valori: [
                parseFloat(document.getElementById(`cfg-nav-x-${i}`).value),
                parseFloat(document.getElementById(`cfg-nav-y1-${i}`).value),
                parseFloat(document.getElementById(`cfg-nav-y2-${i}`).value),
                parseFloat(document.getElementById(`cfg-nav-z-${i}`).value),
                parseFloat(document.getElementById(`cfg-nav-posy-${i}`).value)
            ]
        };
    }

    // Invia al server HTTP (usiamo API write con parametro config speciale)
    // che invierà un comando reset / salva config
    fetch("/api/write?device=HMI&parameter=__config__&value=" + encodeURIComponent(JSON.stringify(configData)))
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                alert("Configurazione salvata con successo! Riavvio moduli HMI...");
            } else {
                alert("Salvataggio fallito: " + data.error);
            }
        });
}
