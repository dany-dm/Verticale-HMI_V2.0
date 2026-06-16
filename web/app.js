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
});

// --- NAVIGAZIONE A SCHEDE (TABS) ---
function setupTabNavigation() {
    const navItems = document.querySelectorAll(".sidebar .nav-item");
    navItems.forEach(item => {
        item.addEventListener("click", () => {
            const target = item.getAttribute("data-target");
            if (!target) return;
            
            navItems.forEach(n => n.classList.remove("active"));
            item.classList.add("active");
            
            document.querySelectorAll(".content-panel").forEach(p => p.classList.remove("active"));
            document.getElementById(target).classList.add("active");
            
            activeTab = target;
            
            // Se entriamo in Impostazioni, ricarichiamo la form
            if (activeTab === "panel-impostazioni") {
                aggiornaCampiConfig();
            }
            
            // Riposiziona il visualizzatore 3D se attivo
            if (activeTab === "panel-globale" && document.getElementById("sinottico-3d").classList.contains("active")) {
                resizeThreeJS();
            }
        });
    });
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
    // Carica la configurazione corrente salvata sul server
    fetch("/api/logs") // placeholder o carichiamo da state
        .then(() => {
            // Poiché non abbiamo un endpoint statico diretto config.json, impostiamo la form con valori reali
            // che arriveranno tramite fetch
        });
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
    caricaLogConsole();
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
    
    const targetHeaders = ["Comando", ...macchineUniche.map(m => m.replace("Navetta_", "Nav "))];
    
    if (JSON.stringify(currentHeaders) !== JSON.stringify(targetHeaders)) {
        theadRow.innerHTML = "<th>Comando</th>";
        macchineUniche.forEach(m => {
            const label = m.replace("Navetta_", "Nav ");
            const th = document.createElement("th");
            th.innerText = label;
            theadRow.appendChild(th);
        });
        
        // Ricostruisci anche le celle del corpo
        ["EnableInverter", "Home", "Automatico"].forEach(cmd => {
            const row = document.getElementById(`row-${cmd.toLowerCase()}`);
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
                    td.innerHTML = `<span class="badge-state">❎</span>`;
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
            
            if (flag) {
                cell.innerHTML = `<span class="badge-state" style="color:var(--accent-green)">✅</span>`;
            } else if (!comunicazione_ok) {
                cell.innerHTML = `<span class="badge-state" style="color:var(--text-muted)">❎</span>`;
            } else if (!ok) {
                cell.innerHTML = `<span class="badge-state" style="color:var(--text-muted)">❎</span>`;
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
                document.getElementById("navetta-4-tpl-group").style.display = isNav4 ? "flex" : "none";
                document.getElementById("navetta-4-extra-id").style.display = isNav4 ? "flex" : "none";
                document.getElementById("navetta-4-extra-lunghezza").style.display = isNav4 ? "flex" : "none";
                
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
    } else {
        overlay.classList.add("active");
        document.getElementById("navetta-led").className = "led led-red";
        document.getElementById("navetta-connection-text").innerText = "Offline";
        return; // Salta aggiornamenti se offline
    }
    
    // Aggiorna badge e variabili di stato
    const keys = [
        "X_Homed", "Y_Homed", "Z_Homed", "Home_OK",
        "Stato_Pick", "Stato_Picked", "TabellaLavoro_Index",
        "Stato_Emergenza", "Stato_Aria_OK", "Stato_Inverter_OK",
        "Stato_ComunicazioneRulliere", "Stato_ComunicazioneCarrello"
    ];
    
    keys.forEach(k => {
        const el = document.getElementById(`nav-val-${k}`);
        if (!el) return;
        
        const val = stato[k];
        
        if (k === "TabellaLavoro_Index") {
            el.innerText = val !== undefined ? val : "-";
        } else if (k === "Stato_Emergenza") {
            el.innerText = val ? "❌ ALLARME" : "✅ OK";
            el.className = `badge ${val ? 'val-offline' : 'val-online'}`;
        } else if (typeof val === "boolean") {
            el.innerText = val ? "✅" : "❌";
            el.style.color = val ? "var(--accent-green)" : "var(--accent-red)";
        }
    });

    // Aggiorna pulsanti (Sunken / Raised)
    updateButtonToggle("nav", "CMD_EnableDrive", stato.Stato_EnableDrive);
    updateButtonToggle("nav", "CMD_Automatico", stato.Stato_Automatico);
    updateButtonToggle("nav", "CMD_MaintenancePosition", stato.Stato_MaintenancePosition);
    
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

    // Aggiorna i quote encoders
    const xVal = stato.Encoder_X || 0;
    const zVal = stato.Encoder_Z || 0;
    document.getElementById("nav-val-X_Encoder").innerText = `${xVal} mm`;
    document.getElementById("nav-val-Z_Encoder").innerText = `${zVal} mm`;
    document.getElementById("nav-val-Y1_Encoder").innerText = `${stato.Encoder_Y1 || 0} mm`;
    document.getElementById("nav-val-Y2_Encoder").innerText = `${stato.Encoder_Y2 || 0} mm`;
    
    if (nomeMacchina === "Navetta_4") {
        document.getElementById("nav-val-ID").innerText = stato.ID !== undefined ? stato.ID : "-";
        document.getElementById("nav-val-Lunghezza").innerText = stato.Lunghezza !== undefined ? `${stato.Lunghezza} mm` : "-";
        
        // Stato del template on-demand
        const tplBtn = document.getElementById("btn-nav-tpl-toggle");
        // Possiamo controllare se abbiamo ricevuto dati on-demand per capire se è attivo
        const isTplActive = (stato.ID !== undefined);
        tplBtn.innerText = isTplActive ? "Disattiva Template" : "Attiva Template";
        tplBtn.className = `btn-ctrl ${isTplActive ? 'btn-on sunken' : 'btn-secondary'}`;
    }

    // Calcola corsa massima asse X da config (default 27000)
    const corsaMaxX = 27000;
    const corsaMaxZ = 3685;
    
    // Percentuali barre
    const pctX = Math.min(Math.max((xVal / corsaMaxX) * 100, 0), 100);
    const pctZ = Math.min(Math.max((zVal / corsaMaxZ) * 100, 0), 100);
    
    document.getElementById("nav-bar-x").style.width = `${pctX}%`;
    document.getElementById("nav-ind-x").style.left = `${pctX}%`;
    
    document.getElementById("nav-bar-z").style.height = `${pctZ}%`;
    document.getElementById("nav-ind-z").style.bottom = `${pctZ}%`;
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
    } else {
        overlay.classList.add("active");
        document.getElementById("carrello-led").className = "led led-red";
        document.getElementById("carrello-connection-text").innerText = "Offline";
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
            el.innerText = val !== undefined ? val : "-";
        } else if (k === "Stato_Emergenza") {
            el.innerText = val ? "❌ ALLARME" : "✅ OK";
            el.className = `badge ${val ? 'val-offline' : 'val-online'}`;
        } else if (typeof val === "boolean") {
            el.innerText = val ? "✅" : "❌";
            el.style.color = val ? "var(--accent-green)" : "var(--accent-red)";
        }
    });

    updateButtonToggle("carr", "CMD_EnableDrive", stato.Stato_EnableDrive);
    updateButtonToggle("carr", "CMD_Automatico", stato.Stato_Automatico);
    updateButtonToggle("carr", "CMD_MaintenancePosition", stato.Stato_MaintenancePosition);

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

    // Encoders
    const yVal = stato.Y_Encoder || 0;
    const rotVal = stato.Rotazione_Encoder || 0;
    document.getElementById("carr-val-Y_Encoder").innerText = `${yVal} mm`;
    document.getElementById("carr-val-Rotazione_Encoder").innerText = `${rotVal.toFixed(1)}°`;

    // Visualizzazione Y
    const corsaMaxY = 28500;
    const pctY = Math.min(Math.max((yVal / corsaMaxY) * 100, 0), 100);
    document.getElementById("carr-bar-y").style.height = `${pctY}%`;
    document.getElementById("carr-ind-y").style.bottom = `${pctY}%`;

    // Aggiorna rotazione ago dial
    const needle = document.getElementById("carr-needle");
    if (needle) {
        needle.setAttribute("transform", `rotate(${rotVal} 50 50)`);
    }

    // Disegna indicatori navette sulla barra Y del carrello
    const markersContainer = document.getElementById("carr-nav-markers");
    if (markersContainer) {
        markersContainer.innerHTML = "";
        for (let i = 1; i <= 4; i++) {
            const navCfg = currentStates[`Navetta_${i}`] || {};
            // Usiamo la quota Y statica preimpostata
            const valoriNavetta = [18500, 21200, 24040, 27060]; // Quote da config
            const yNav = valoriNavetta[i-1];
            const pctNav = (yNav / corsaMaxY) * 100;
            
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
    } else {
        overlay.classList.add("active");
        document.getElementById("caricatore-led").className = "led led-red";
        document.getElementById("caricatore-connection-text").innerText = "Offline";
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
            el.innerText = val !== undefined ? val : "-";
        } else if (k === "Stato_Emergenza") {
            el.innerText = val ? "❌ ALLARME" : "✅ OK";
            el.className = `badge ${val ? 'val-offline' : 'val-online'}`;
        } else if (typeof val === "boolean") {
            el.innerText = val ? "✅" : "❌";
            el.style.color = val ? "var(--accent-green)" : "var(--accent-red)";
        }
    });

    updateButtonToggle("car", "CMD_EnableDrive", stato.Stato_EnableDrive);
    updateButtonToggle("car", "CMD_Automatico", stato.Stato_Automatico);

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

    // Encoders
    const zVal = stato.Z_Encoder || 0;
    const rotVal = stato.Rotazione_Encoder || 0;
    document.getElementById("car-val-Z_Encoder").innerText = `${zVal} mm`;
    document.getElementById("car-val-Rotazione_Encoder").innerText = `${rotVal.toFixed(1)}°`;
    document.getElementById("car-val-telaio_Encoder").innerText = `${stato.telaio_Encoder || 0} mm`;

    // Visualizzazione Z (corsa_max_z default 1500)
    const corsaMaxZ = 1500;
    // La quota di solito decresce scendendo verso il basso, simuliamo l'altezza
    const pctZ = Math.min(Math.max((zVal / corsaMaxZ) * 100, 0), 100);
    document.getElementById("car-bar-z").style.height = `${pctZ}%`;
    document.getElementById("car-ind-z").style.bottom = `${pctZ}%`;

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
    } else {
        overlay.classList.add("active");
        document.getElementById("rulliere-led").className = "led led-red";
        document.getElementById("rulliere-connection-text").innerText = "Offline";
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
            el.innerText = val !== undefined ? val : "-";
        } else if (k === "Stato_Emergenza") {
            el.innerText = val ? "❌ ALLARME" : "✅ OK";
            el.className = `badge ${val ? 'val-offline' : 'val-online'}`;
        } else if (typeof val === "boolean") {
            el.innerText = val ? "✅" : "❌";
            el.style.color = val ? "var(--accent-green)" : "var(--accent-red)";
        }
    });

    updateButtonToggle("rul", "CMD_EnableDrive", stato.Stato_EnableDrive);
    updateButtonToggle("rul", "CMD_Automatico", stato.Stato_Automatico);

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
    const btnOn = document.getElementById(`btn-${prefix}-${param.split("_")[1].toLowerCase()}-on`);
    const btnOff = document.getElementById(`btn-${prefix}-${param.split("_")[1].toLowerCase()}-off`);
    
    if (btnOn && btnOff) {
        if (active) {
            btnOn.classList.add("sunken");
            btnOff.classList.remove("sunken");
        } else {
            btnOn.classList.remove("sunken");
            btnOff.classList.add("sunken");
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
                    ["Inverter OK", drive],
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
                    ["Inverter OK", drive],
                    ["Manuale", !auto],
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
    // Intercetta hover sui pulsanti per mostrare le condizioni del comando
    document.addEventListener("mouseover", (e) => {
        const target = e.target.closest(".btn-ctrl, .btn-table-cmd");
        if (!target) return;
        
        let device = target.getAttribute("data-device");
        let param = target.getAttribute("data-param");
        let val = target.getAttribute("data-val");
        
        // Se è nella tabella globale
        if (target.classList.contains("btn-table-cmd")) {
            const cmd = target.getAttribute("data-cmd"); // EnableInverter, Home, Automatico
            // Nel tab globale mostriamo una spiegazione generica del comando di colonna
            const helpPanel = document.getElementById("navetta-help-content"); // o dove preferiamo
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
        
        // Individua il pannello di help corretto in base alla scheda attiva
        let helpDivId = "";
        if (activeTab === "panel-navette") helpDivId = "navetta-help-content";
        else if (activeTab === "panel-carrello") helpDivId = "carrello-help-content";
        else if (activeTab === "panel-caricatore") helpDivId = "caricatore-help-content";
        else if (activeTab === "panel-rulliere") helpDivId = "rulliere-help-content";
        
        const helpDiv = document.getElementById(helpDivId);
        if (helpDiv) {
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
            helpDiv.innerHTML = html;
        }
    });

    document.addEventListener("mouseout", (e) => {
        const target = e.target.closest(".btn-ctrl");
        if (!target) return;
        
        let helpDivId = "";
        if (activeTab === "panel-navette") helpDivId = "navetta-help-content";
        else if (activeTab === "panel-carrello") helpDivId = "carrello-help-content";
        else if (activeTab === "panel-caricatore") helpDivId = "caricatore-help-content";
        else if (activeTab === "panel-rulliere") helpDivId = "rulliere-help-content";
        
        const helpDiv = document.getElementById(helpDivId);
        if (helpDiv) {
            helpDiv.innerHTML = `<div class="help-empty-state">Passa il mouse sopra un pulsante per visualizzare i requisiti di sicurezza.</div>`;
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
            console.error("Errore di rete invio comando:", err);
        });
}

// --- RENDERING SINOTTICO 2D SVG ---
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
    const caricatoreZ = (currentStates.Caricatore || {}).Z_Encoder || 0;
    
    // Rigenera lo schema SVG statico se non ancora presente
    if (svg.children.length === 0) {
        let staticHTML = `
            <!-- Sfondo scuro griglia -->
            <defs>
                <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                    <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(255,255,255,0.02)" stroke-width="1"/>
                </pattern>
                <linearGradient id="railGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stop-color="#334155" />
                    <stop offset="50%" stop-color="#475569" />
                    <stop offset="100%" stop-color="#1e293b" />
                </linearGradient>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)" />
            
            <!-- Rotaia Carrello (Orizzontale) -->
            <rect x="50" y="80" width="1300" height="10" rx="3" fill="url(#railGrad)" stroke="rgba(255,255,255,0.1)" />
            
            <!-- Rulliere e cinghie statiche -->
            <!-- Rulliera 1 Biesse -->
            <g id="sin-rulliera-1" transform="translate(1100, 150)">
                <rect x="0" y="0" width="220" height="70" fill="#334155" rx="4" stroke="#475569" stroke-width="2" />
                <!-- Rulli -->
                <line x1="20" y1="5" x2="20" y2="65" stroke="#94a3b8" stroke-width="3" />
                <line x1="50" y1="5" x2="50" y2="65" stroke="#94a3b8" stroke-width="3" />
                <line x1="80" y1="5" x2="80" y2="65" stroke="#94a3b8" stroke-width="3" />
                <line x1="110" y1="5" x2="110" y2="65" stroke="#94a3b8" stroke-width="3" />
                <line x1="140" y1="5" x2="140" y2="65" stroke="#94a3b8" stroke-width="3" />
                <line x1="170" y1="5" x2="170" y2="65" stroke="#94a3b8" stroke-width="3" />
                <line x1="200" y1="5" x2="200" y2="65" stroke="#94a3b8" stroke-width="3" />
                <text x="110" y="40" font-size="11" font-weight="700" fill="#94a3b8" text-anchor="middle">RULLIERA 1 (R1)</text>
            </g>

            <!-- Cinghie C1 -->
            <g id="sin-cinghie-1" transform="translate(1100, 240)">
                <rect x="0" y="0" width="200" height="60" fill="#1e293b" rx="4" stroke="#ef4444" stroke-width="2" />
                <!-- Cinghie rosse -->
                <rect x="20" y="5" width="160" height="8" fill="#ef4444" />
                <rect x="20" y="26" width="160" height="8" fill="#ef4444" />
                <rect x="20" y="47" width="160" height="8" fill="#ef4444" />
                <text x="100" y="35" font-size="11" font-weight="700" fill="#ef4444" text-anchor="middle">CINGHIE C1</text>
            </g>

            <!-- Rulliera 2 -->
            <g id="sin-rulliera-2" transform="translate(1100, 320)">
                <rect x="0" y="0" width="220" height="70" fill="#334155" rx="4" stroke="#475569" stroke-width="2" />
                <text x="110" y="40" font-size="11" font-weight="700" fill="#94a3b8" text-anchor="middle">RULLIERA 2 (R2)</text>
            </g>

            <!-- Rotaie Verticali Navette -->
            <!-- Disegniamo binari per Navette 1..4 in base alla loro Y predefinita -->
            <!-- Nav 1 (Y=18500), Nav 2 (Y=21200), Nav 3 (Y=24040), Nav 4 (Y=27060) -->
            <!-- Mappiamo Y su asse X dell'SVG -->
        `;
        
        svg.innerHTML = staticHTML;
    }

    // Calcolo scala di visualizzazione
    // Il carrello si muove lungo l'asse X dell'SVG (da X=100 a X=1000)
    // Mappa corsaMaxY (28500) a larghezza SVG (900 pixel, da X=100 a X=1000)
    const startX = 100;
    const endX = 1000;
    const scaleX = (endX - startX) / corsaMaxY;

    // Rotaie Navette dinamiche
    const valoriNavetta = [18500, 21200, 24040, 27060];
    
    // Disegna binari navette se non ancora presenti
    for (let i = 1; i <= 4; i++) {
        const xBinario = startX + (valoriNavetta[i-1] * scaleX);
        let bin = document.getElementById(`bin-nav-${i}`);
        if (!bin) {
            // Rotaia verticale
            const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
            line.setAttribute("id", `bin-nav-${i}`);
            line.setAttribute("x1", xBinario);
            line.setAttribute("y1", "90");
            line.setAttribute("x2", xBinario);
            line.setAttribute("y2", "680");
            line.setAttribute("stroke", "rgba(255,255,255,0.06)");
            line.setAttribute("stroke-width", "4");
            line.setAttribute("stroke-dasharray", "4,4");
            svg.appendChild(line);
            
            // Etichetta del binario
            const txt = document.createElementNS("http://www.w3.org/2000/svg", "text");
            txt.setAttribute("x", xBinario);
            txt.setAttribute("y", "705");
            txt.setAttribute("fill", "#64748b");
            txt.setAttribute("font-size", "10");
            txt.setAttribute("text-anchor", "middle");
            txt.setAttribute("font-weight", "bold");
            txt.textContent = `BIN ${i}`;
            svg.appendChild(txt);
        }
    }

    // 1. CARRELLO TRASLATORE (Si muove in orizzontale)
    // Nota: Nel PLC l'encoder Y decresce o cresce. Mappiamo Y_Encoder all'asse X
    const posXCarrello = endX - (carrelloY * scaleX);
    
    let carrGroup = document.getElementById("sin-carrello");
    if (!carrGroup) {
        carrGroup = document.createElementNS("http://www.w3.org/2000/svg", "g");
        carrGroup.setAttribute("id", "sin-carrello");
        carrGroup.innerHTML = `
            <rect x="-40" y="-15" width="80" height="30" fill="url(#railGrad)" stroke="#ef4444" stroke-width="2" rx="4" />
            <circle cx="0" cy="0" r="5" fill="#ef4444" />
            <text x="0" y="-22" font-size="10" font-weight="800" fill="#ef4444" text-anchor="middle">CARRELLO</text>
        `;
        svg.appendChild(carrGroup);
    }
    carrGroup.setAttribute("transform", `translate(${posXCarrello}, 85)`);

    // 2. NAVETTE (Si muovono in verticale sui rispettivi binari)
    // Corsa max X è 27000. Mappiamo Z/X_Encoder sull'asse Y dell'SVG (da Y=100 a Y=650)
    const startY = 110;
    const endY = 650;
    const scaleY = (endY - startY) / corsaMaxX;

    for (let i = 1; i <= 4; i++) {
        const navName = `Navetta_${i}`;
        const navState = currentStates[navName] || {};
        const xEnc = navState.Encoder_X || 0;
        const online = navState.__comunicazione_ok__;
        
        const xBin = startX + (valoriNavetta[i-1] * scaleX);
        const yNav = startY + (xEnc * scaleY);
        
        let navGroup = document.getElementById(`sin-nav-${i}`);
        if (!navGroup) {
            navGroup = document.createElementNS("http://www.w3.org/2000/svg", "g");
            navGroup.setAttribute("id", `sin-nav-${i}`);
            navGroup.innerHTML = `
                <rect x="-18" y="-25" width="36" height="50" fill="#1e293b" stroke="#3b82f6" stroke-width="2" rx="4" />
                <rect x="-12" y="-18" width="24" height="8" fill="#e2e8f0" rx="1" />
                <text x="0" y="5" font-size="9" font-weight="800" fill="#3b82f6" text-anchor="middle">N${i}</text>
            `;
            svg.appendChild(navGroup);
        }
        navGroup.setAttribute("transform", `translate(${xBin}, ${yNav})`);
        
        // Colora in base allo stato online/offline
        const rect = navGroup.querySelector("rect");
        if (rect) {
            rect.setAttribute("stroke", online ? "var(--accent-blue)" : "#475569");
            rect.setAttribute("fill", online ? "#1e293b" : "#0f172a");
        }
    }

    // 3. CARICATORE A VENTOSE (Centro di rotazione fisso su Biesse o rulliere)
    // Disegnamo il braccio del caricatore
    let carGroup = document.getElementById("sin-caricatore");
    if (!carGroup) {
        carGroup = document.createElementNS("http://www.w3.org/2000/svg", "g");
        carGroup.setAttribute("id", "sin-caricatore");
        // Centro di rotazione posizionato vicino a Rulliera 1 (es: X=1210, Y=185)
        carGroup.innerHTML = `
            <!-- Base caricatore -->
            <circle cx="0" cy="0" r="15" fill="#f59e0b" stroke="#000" stroke-width="1.5" />
            <!-- Braccio rotante -->
            <g id="sin-caricatore-braccio">
                <line x1="0" y1="0" x2="60" y2="0" stroke="#94a3b8" stroke-width="4" />
                <!-- Telaio ventose -->
                <rect x="50" y="-12" width="20" height="24" fill="#f59e0b" stroke="#d97706" rx="2" />
                <circle cx="55" cy="-6" r="3" fill="blue" />
                <circle cx="65" cy="-6" r="3" fill="blue" />
                <circle cx="55" cy="6" r="3" fill="blue" />
                <circle cx="65" cy="6" r="3" fill="blue" />
            </g>
            <text x="0" y="-22" font-size="10" font-weight="800" fill="#f59e0b" text-anchor="middle">CARICATORE</text>
        `;
        svg.appendChild(carGroup);
    }
    carGroup.setAttribute("transform", "translate(1210, 185)");
    
    // Ruota il braccio in base all'encoder
    const arm = document.getElementById("sin-caricatore-braccio");
    if (arm) {
        arm.setAttribute("transform", `rotate(${caricatoreRot})`);
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
            consoleDiv.innerHTML = html;
            
            // Auto-scroll al fondo
            consoleDiv.scrollTop = consoleDiv.scrollHeight;
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
                    <input type="number" id="cfg-nav-x-${i}" step="100">
                </div>
                <div class="field">
                    <span>Corsa Max Y1 (mm):</span>
                    <input type="number" id="cfg-nav-y1-${i}" step="100">
                </div>
                <div class="field">
                    <span>Corsa Max Y2 (mm):</span>
                    <input type="number" id="cfg-nav-y2-${i}" step="100">
                </div>
                <div class="field">
                    <span>Corsa Max Z (mm):</span>
                    <input type="number" id="cfg-nav-z-${i}" step="100">
                </div>
                <div class="field">
                    <span>Posizione Y (mm):</span>
                    <input type="number" id="cfg-nav-posy-${i}" step="100">
                </div>
            </div>
        `;
        listContainer.appendChild(item);
    }
}

function aggiornaCampiConfig() {
    // Leggi i dati correnti direttamente dalle chiavi globali (arrivate via SSE/state)
    fetch("/api/state")
        .then(res => res.json())
        .then(states => {
            // Ricaviamo i parametri generali memorizzati nella Navetta_1 come metadati fittizi o impostazioni locali
            // In una HMI reale, le impostazioni sono servite da un endpoint dedicato
            // Per ora popoliamo con dati ricavati da stati / defaults
            document.getElementById("polling_ip").value = "192.168.3.66";
            document.getElementById("polling_port").value = "9000";
            document.getElementById("refresh").value = "0.3";
            document.getElementById("syslog_ip").value = "127.0.0.1";
            document.getElementById("syslog_port").value = "514";
            document.getElementById("carrello_max_y").value = "28500";
            document.getElementById("caricatore_max_z").value = "1500";
            
            // Popola campi navette 1..10
            for (let i = 1; i <= 10; i++) {
                const navName = `Navetta_${i}`;
                const active = (i <= 4); // Di default 1-4 attive
                document.getElementById(`cfg-nav-active-${i}`).checked = active;
                
                const valoriNavetta = [
                    [27000, 1200, 1200, 3685, 18500],
                    [27000, 1200, 1200, 3685, 21200],
                    [27000, 1200, 1200, 3685, 24040],
                    [27000, 1200, 1200, 3685, 27060],
                ];
                
                const vals = valoriNavetta[i-1] || [27000, 1200, 1200, 3685, 0];
                document.getElementById(`cfg-nav-x-${i}`).value = vals[0];
                document.getElementById(`cfg-nav-y1-${i}`).value = vals[1];
                document.getElementById(`cfg-nav-y2-${i}`).value = vals[2];
                document.getElementById(`cfg-nav-z-${i}`).value = vals[3];
                document.getElementById(`cfg-nav-posy-${i}`).value = vals[4];
            }
        });
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
