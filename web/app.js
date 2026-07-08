// app.js

// --- CONFIGURAZIONE E VARIABILI DI STATO LOCALE ---
let activeTab = "panel-globale";
let activeNavettaIndex = 0; // 0-based index per Navetta_1, Navetta_2, ecc.
let currentStates = {};
let config = {};
let eventSource = null;
let ultimaCodaCommesseHTML = "";
let ultimoJobsTableHTML = "";

// --- UTILITY PER COMANDI AVANZATI NAVETTA ---
function inviaScritturaAvanzata(parameter, customVal = -1) {
    const nomeMacchina = `Navetta_${activeNavettaIndex + 1}`;
    const stato = currentStates[nomeMacchina] || {};
    let targetVal = customVal;
    
    // Se non è stato passato un valore specifico (customVal = -1)
    if (customVal === -1) {
        let isActive = false;
        if (parameter === "cmd_Caso5primaParte") isActive = !!stato.Stato_Caso5_PrimaParte;
        else if (parameter === "cmd_Pannello_Preso") isActive = !!(stato.Stato_Y1_PannelloPreso || stato.Stato_Y2_PannelloPreso);
        else if (parameter === "cmd_Y_soffia") isActive = !!stato.Stato_Y_soffia;
        else if (parameter === "cmd_Memoria_Op1") isActive = !!stato.Stato_Memoria_Op1;
        else if (parameter === "cmd_Memoria_Op2" || parameter === "cmd_Memoria_Op3") isActive = !!stato.Stato_Memoria_Op3;
        else if (parameter === "cmd_Y1_Prendi") isActive = !!stato.Stato_Y1_Prendi;
        else if (parameter === "cmd_Y1_bascula") isActive = !!stato.Stato_Y1_bascula;
        else if (parameter === "cmd_Y1_avanti") isActive = !!stato.Stato_Y1_avanti;
        else if (parameter === "cmd_Y1_indietro") isActive = !!stato.Stato_Y1_indietro;
        else if (parameter === "cmd_Y1_venturi") isActive = !!stato.Stato_Y1_venturi;
        else if (parameter === "cmd_Y2_Prendi") isActive = !!stato.Stato_Y2_Prendi;
        else if (parameter === "cmd_Y2_bascula") isActive = !!stato.Stato_Y2_bascula;
        else if (parameter === "cmd_Y2_avanti") isActive = !!stato.Stato_Y2_avanti;
        else if (parameter === "cmd_Y2_indietro") isActive = !!stato.Stato_Y2_indietro;
        else if (parameter === "cmd_Y2_venturi") isActive = !!stato.Stato_Y2_venturi;
        
        // Se è attivo scriviamo -513 (16#FDFF in signed INT) per spegnere, altrimenti -1 per accendere
        targetVal = isActive ? -513 : -1;
    }
    
    inviaScrittura(nomeMacchina, parameter, targetVal);
}

function aggiornaAbilitazioneComandiAvanzati() {
    const nomeMacchina = `Navetta_${activeNavettaIndex + 1}`;
    const stato = currentStates[nomeMacchina] || {};
    const isManual = !stato.Stato_Automatico;
    
    const switchEl = document.getElementById("switch-attiva-comandi-avanzati");
    const switchOn = switchEl ? switchEl.checked : false;
    
    const enabled = isManual && switchOn;
    
    // Disabilita/abilita tutti i badge interattivi (pulsanti badge-btn)
    const buttons = document.querySelectorAll(".badge-btn");
    buttons.forEach(btn => {
        btn.disabled = !enabled;
    });
}

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

    // Gestione visualizzazione dinamica pannello legno carrello
    document.getElementById("carr-wood-panel-checkbox")?.addEventListener("change", () => {
        const rotVal = (currentStates.Carrello && currentStates.Carrello.Rotazione_Encoder) || 0;
        renderCarrelloRotazione(rotVal);
    });

    // Event listener per attivazione comandi avanzati
    document.getElementById("switch-attiva-comandi-avanzati")?.addEventListener("change", aggiornaAbilitazioneComandiAvanzati);

    // Double click su Dati Commessa delle schede macchina per aprire la modifica commessa
    const bindCardDblClick = (cardId, getIdxLavoro) => {
        document.getElementById(cardId)?.addEventListener("dblclick", () => {
            const switchEl = document.getElementById("switch-attiva-comandi-avanzati");
            if (switchEl && switchEl.checked) {
                const idx = getIdxLavoro();
                openCommessaModal(idx >= 1 && idx <= 6 ? idx : 1);
            }
        });
    };
    bindCardDblClick("frame-nav-commessa", () => {
        const state = currentStates[`Navetta_${activeNavettaIndex + 1}`] || {};
        return state.IndexTabellaLavoro || 0;
    });
    bindCardDblClick("frame-carr-commessa", () => {
        const state = currentStates.Carrello || {};
        return state.IndexTabellaLavoro || 0;
    });
    bindCardDblClick("frame-car-commessa", () => {
        const state = currentStates.Caricatore || {};
        return state.IndexTabellaLavoro || 0;
    });
    bindCardDblClick("frame-rul-commessa", () => {
        const state = currentStates.Rulliere || {};
        return state.IndexTabellaLavoro || 0;
    });

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
    
    // Disattiva comandi avanzati al cambio scheda/tab
    const switchEl = document.getElementById("switch-attiva-comandi-avanzati");
    if (switchEl) switchEl.checked = false;
    
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
    aggiornaSchedaCommesse();
    aggiornaCodaCommesse();
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
                    if (cmd === "Home" && m === "Rulliere") {
                        td.innerHTML = "";
                    } else {
                        td.innerHTML = `<span class="badge-state" style="color:var(--text-muted); font-weight:bold; font-family:sans-serif;">X</span>`;
                    }
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
            
            // L'home di rulliere non esiste e deve sparire (mostrando vuoto)
            if (cmd === "Home" && m === "Rulliere") {
                cell.innerHTML = "";
                return;
            }
            
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
                
                // Disattiva comandi avanzati al cambio macchina
                const switchEl = document.getElementById("switch-attiva-comandi-avanzati");
                if (switchEl) switchEl.checked = false;
                
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
        "Stato_ComunicazioneRulliere", "Stato_ComunicazioneCarrello",
        // Stati avanzati numerici
        "X_destinazione", "X_Ricalcolata", "Z_destinazione",
        "Z_Speed", "Z_accelerazione", "Z_Decelerazione",
        // Stati avanzati booleani
        "Stato_Memoria_Op1", "Stato_Memoria_Op3",
        "Stato_Op1", "Stato_Op2", "Stato_Op3", "Stato_Op4",
        "Stato_Caso5_PrimaParte",
        "Stato_Y1_Prendi", "Stato_Y1_avanti", "Stato_Y1_indietro", "Stato_Y1_venturi", "Stato_Y1_bascula", "Stato_Y1_PannelloPreso",
        "Stato_Y2_Prendi", "Stato_Y2_avanti", "Stato_Y2_indietro", "Stato_Y2_venturi", "Stato_Y2_bascula", "Stato_Y2_PannelloPreso",
        "Stato_Y_soffia"
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
            el.innerText = val ? "❌ ALLARME" : "✅";
            el.className = `badge ${val ? 'val-offline' : 'val-online'}`;
        } else if (typeof val === "boolean") {
            const advancedBools = [
                "Stato_Memoria_Op1", "Stato_Memoria_Op3",
                "Stato_Op1", "Stato_Op2", "Stato_Op3", "Stato_Op4",
                "Stato_Caso5_PrimaParte",
                "Stato_Y1_Prendi", "Stato_Y1_avanti", "Stato_Y1_indietro", "Stato_Y1_venturi", "Stato_Y1_bascula", "Stato_Y1_PannelloPreso",
                "Stato_Y2_Prendi", "Stato_Y2_avanti", "Stato_Y2_indietro", "Stato_Y2_venturi", "Stato_Y2_bascula", "Stato_Y2_PannelloPreso",
                "Stato_Y_soffia"
            ];
            if (advancedBools.includes(k)) {
                el.innerText = val ? "ON" : "OFF";
                const isBtn = el.tagName === "BUTTON";
                el.className = `badge ${isBtn ? 'badge-btn' : ''} ${val ? 'badge-on' : 'badge-off'}`;
                el.style.color = "";
            } else {
                el.innerText = val ? "✅" : "❌";
                el.className = "badge";
                el.style.color = val ? "var(--accent-green)" : "var(--accent-red)";
            }
        } else {
            // Campi numerici avanzati
            if (val !== undefined && val !== null) {
                if (k.endsWith("_destinazione") || k.endsWith("_Ricalcolata")) {
                    el.innerText = `${val} mm`;
                } else if (k === "Z_Speed") {
                    el.innerText = `${val} mm/s`;
                } else if (k === "Z_accelerazione" || k === "Z_Decelerazione") {
                    el.innerText = `${val} mm/s²`;
                } else {
                    el.innerText = val;
                }
            } else {
                el.innerText = "-";
            }
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
    updateButtonToggle("nav", "CMD_EnableDrive", stato.Stato_EnableDrive, nomeMacchina);
    updateButtonToggle("nav", "CMD_Automatico", stato.Stato_Automatico, nomeMacchina);
    updateButtonToggle("nav", "CMD_MaintenancePosition", stato.Stato_MaintenancePosition, nomeMacchina);
    aggiornaIndicatoriComandiPrincipali("nav", stato);

    // Aggiorna i quote encoders
    const xVal = stato.X_Encoder || 0;
    const zVal = stato.Z_Encoder || 0;
    const y1Val = stato.Y1_Encoder || 0;
    const y2Val = stato.Y2_Encoder || 0;
    document.getElementById("nav-val-X_Encoder").innerText = `${xVal} mm`;
    document.getElementById("nav-val-Z_Encoder").innerText = `${zVal} mm`;
    const y1El = document.getElementById("nav-val-Y1_Encoder");
    if (y1El) y1El.innerText = `${y1Val} mm`;
    const y2El = document.getElementById("nav-val-Y2_Encoder");
    if (y2El) y2El.innerText = `${y2Val} mm`;
    
    // Aggiorna la vista Canvas Y1 e Y2
    renderNavettaYCanvas(y1Val, y2Val, stato);
    
    // Aggiorna gli input non editabili negli azzeramenti
    const navXh = document.getElementById("nav-val-X_Encoder-h");
    const navY1h = document.getElementById("nav-val-Y1_Encoder-h");
    const navY2h = document.getElementById("nav-val-Y2_Encoder-h");
    const navZh = document.getElementById("nav-val-Z_Encoder-h");
    if (navXh) navXh.value = `${xVal} mm`;
    if (navY1h) navY1h.value = `${y1Val} mm`;
    if (navY2h) navY2h.value = `${y2Val} mm`;
    if (navZh) navZh.value = `${zVal} mm`;
    
    // Aggiorna Dati Commessa
    aggiornaDatiCommessaMacchina("nav", stato, currentStates.Rulliere || {});

    if (nomeMacchina === "Navetta_4") {
        const elId = document.getElementById("nav-val-ID");
        if (elId) elId.innerText = stato.comanda_ID !== undefined ? stato.comanda_ID : "-";
        const elLen = document.getElementById("nav-val-Lunghezza");
        if (elLen) elLen.innerText = stato.comanda_Lunghezza !== undefined ? `${stato.comanda_Lunghezza} mm` : "-";
        
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
    
    // Disabilita lo switch attiva comandi avanzati se la macchina non è in manuale
    const switchEl = document.getElementById("switch-attiva-comandi-avanzati");
    if (switchEl) {
        const isManual = !stato.Stato_Automatico;
        if (!isManual) {
            switchEl.checked = false;
            switchEl.disabled = true;
        } else {
            switchEl.disabled = false;
        }
    }
    
    // Aggiorna l'abilitazione dei comandi avanzati in base a manuale + switch
    aggiornaAbilitazioneComandiAvanzati();
}

function initCustomTooltip() {
    let tooltip = document.getElementById("hmi-svg-tooltip");
    if (!tooltip) {
        tooltip = document.createElement("div");
        tooltip.id = "hmi-svg-tooltip";
        tooltip.style.position = "absolute";
        tooltip.style.backgroundColor = "rgba(15, 23, 42, 0.95)";
        tooltip.style.color = "#ffffff";
        tooltip.style.padding = "6px 10px";
        tooltip.style.borderRadius = "4px";
        tooltip.style.fontSize = "12px";
        tooltip.style.fontWeight = "500";
        tooltip.style.fontFamily = "system-ui, -apple-system, sans-serif";
        tooltip.style.pointerEvents = "none";
        tooltip.style.display = "none";
        tooltip.style.zIndex = "99999";
        tooltip.style.boxShadow = "0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -2px rgba(0,0,0,0.1)";
        tooltip.style.border = "1px solid rgba(255, 255, 255, 0.1)";
        document.body.appendChild(tooltip);
    }
    return tooltip;
}

function bindTooltip(el, text) {
    const tooltip = initCustomTooltip();
    el.setAttribute("data-tooltip", text);
    
    // Rimuove eventuali title nativi per non avere doppioni e ritardi del browser
    const oldTitle = el.querySelector("title");
    if (oldTitle) {
        oldTitle.remove();
    }
    el.removeAttribute("title");
    
    if (!el.dataset.tooltipBound) {
        el.dataset.tooltipBound = "true";
        el.addEventListener("mouseenter", () => {
            tooltip.innerText = el.getAttribute("data-tooltip");
            tooltip.style.display = "block";
        });
        el.addEventListener("mousemove", (e) => {
            tooltip.style.left = (e.pageX + 12) + "px";
            tooltip.style.top = (e.pageY + 12) + "px";
        });
        el.addEventListener("mouseleave", () => {
            tooltip.style.display = "none";
        });
    }
}

function getMachineComandaValue(statoMacchina, idPrefisso, field) {
    let lowerName = "";
    if (idPrefisso === "carr") lowerName = "carrello";
    else if (idPrefisso === "car") lowerName = "caricatore";
    else if (idPrefisso === "rul") lowerName = "rulliere";
    else lowerName = "navetta";
    
    const prefixKey = `${lowerName}_comanda_${field}`;
    if (statoMacchina[prefixKey] !== undefined) {
        return statoMacchina[prefixKey];
    }
    const directKey = `comanda_${field}`;
    if (statoMacchina[directKey] !== undefined) {
        return statoMacchina[directKey];
    }
    return undefined;
}

function aggiornaDatiCommessaMacchina(idPrefisso, statoMacchina, statoRulliere) {
    const idxLavoro = statoMacchina.IndexTabellaLavoro || 0;
    const inLavoro = idPrefisso === "nav" 
        ? (statoMacchina.Stato_Picked ? true : false)
        : (statoMacchina.Stato_Picked ? true : false) && idxLavoro >= 1 && idxLavoro <= 6;
    
    const noJobEl = document.getElementById(`${idPrefisso}-comm-no-job`);
    const detailsEl = document.getElementById(`${idPrefisso}-comm-details`);
    const frameEl = document.getElementById(`frame-${idPrefisso}-commessa`);
    
    if (noJobEl && detailsEl) {
        if (noJobEl.getAttribute("data-default-text") === null) {
            noJobEl.setAttribute("data-default-text", noJobEl.innerText);
        }
        
        if (inLavoro) {
            // Verifica se i dati della commessa sono presenti sulla macchina
            const requiredFields = ["ID", "Lunghezza", "Larghezza", "Spessore", "From_X", "From_Y", "From_Z", "To_X", "To_Y", "ToZ"];
            let dataMissing = false;
            for (const f of requiredFields) {
                if (getMachineComandaValue(statoMacchina, idPrefisso, f) === undefined) {
                    dataMissing = true;
                    break;
                }
            }
            
            if (dataMissing) {
                console.error(`[${idPrefisso.toUpperCase()}] errore dati mancanti`);
                noJobEl.innerHTML = `<span style="color: var(--accent-red); font-weight: 700;">errore dati mancanti</span>`;
                noJobEl.style.display = "flex";
                detailsEl.style.display = "none";
                if (frameEl) frameEl.classList.remove("inactive-commessa");
                return;
            }
        }
        
        noJobEl.style.display = inLavoro ? "none" : "flex";
        if (inLavoro) {
            if (frameEl) frameEl.classList.remove("inactive-commessa");
        } else {
            noJobEl.innerText = "Nessun lavoro in corso";
            if (frameEl) frameEl.classList.add("inactive-commessa");
        }
        
        detailsEl.style.display = "flex";
        
        const valID = document.getElementById(`${idPrefisso}-comm-val-ID`);
        const valDim = document.getElementById(`${idPrefisso}-comm-val-Dimensioni`);
        const valFrom = document.getElementById(`${idPrefisso}-comm-val-From`);
        const valTo = document.getElementById(`${idPrefisso}-comm-val-To`);
        
        const idVal = getMachineComandaValue(statoMacchina, idPrefisso, "ID");
        const len = getMachineComandaValue(statoMacchina, idPrefisso, "Lunghezza");
        const wid = getMachineComandaValue(statoMacchina, idPrefisso, "Larghezza");
        const thk = getMachineComandaValue(statoMacchina, idPrefisso, "Spessore");
        const fx = getMachineComandaValue(statoMacchina, idPrefisso, "From_X");
        const fy = getMachineComandaValue(statoMacchina, idPrefisso, "From_Y");
        const fz = getMachineComandaValue(statoMacchina, idPrefisso, "From_Z");
        const tx = getMachineComandaValue(statoMacchina, idPrefisso, "To_X");
        const ty = getMachineComandaValue(statoMacchina, idPrefisso, "To_Y");
        const tz = getMachineComandaValue(statoMacchina, idPrefisso, "ToZ");
        
        if (valID) valID.innerText = (idVal !== undefined && idVal > 0) ? idVal : "-";
        if (valDim) valDim.innerText = (len || wid || thk) ? `${len} x ${wid} x ${thk} mm` : "-";
        if (valFrom) valFrom.innerText = (fx !== undefined || fy !== undefined || fz !== undefined) ? `${fx} / ${fy} / ${fz} mm` : "-";
        if (valTo) valTo.innerText = (tx !== undefined || ty !== undefined || tz !== undefined) ? `${tx} / ${ty} / ${tz} mm` : "-";
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
            el.innerText = val ? "❌ ALLARME" : "✅";
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
    updateButtonToggle("carr", "CMD_EnableDrive", stato.Stato_EnableDrive, nomeMacchina);
    updateButtonToggle("carr", "CMD_Automatico", stato.Stato_Automatico, nomeMacchina);
    updateButtonToggle("carr", "CMD_MaintenancePosition", stato.Stato_MaintenancePosition, nomeMacchina);
    aggiornaIndicatoriComandiPrincipali("carr", stato);

    // Encoders
    const yVal = stato.Y_Encoder || 0;
    const rotVal = stato.Rotazione_Encoder || 0;
    document.getElementById("carr-val-Y_Encoder").innerText = `${yVal} mm`;
    document.getElementById("carr-val-Rotazione_Encoder").innerText = `${rotVal.toFixed(1)}°`;
    renderCarrelloRotazione(rotVal);
    
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
     
     // Aggiorna Dati Commessa
     aggiornaDatiCommessaMacchina("carr", stato, currentStates.Rulliere || {});
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
            el.innerText = val ? "❌ ALLARME" : "✅";
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
    updateButtonToggle("car", "CMD_EnableDrive", stato.Stato_EnableDrive, nomeMacchina);
    updateButtonToggle("car", "CMD_Automatico", stato.Stato_Automatico, nomeMacchina);
    aggiornaIndicatoriComandiPrincipali("car", stato);

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
    
    const pctZ = Math.min(Math.max((1 - (zVal - minZ) / (corsaMaxZ - minZ)) * 100, 0), 100);
    document.getElementById("car-bar-z").style.height = `${pctZ}%`;
    document.getElementById("car-ind-z").style.bottom = `${pctZ}%`;
    
    // Aggiorna le etichette degli estremi dell'asse Z (Invertiti: 0/min in alto, max in basso)
    const lblMaxZ = document.getElementById("car-lbl-max-z");
    if (lblMaxZ) lblMaxZ.innerText = `${minZ} mm`;
    const lblMinZ = document.getElementById("car-lbl-min-z");
    if (lblMinZ) lblMinZ.innerText = `${corsaMaxZ} mm`;

    // Aggiorna ago rotazione
    const needle = document.getElementById("car-needle");
    if (needle) {
        needle.setAttribute("transform", `rotate(${rotVal} 50 50)`);
    }
    
    // Aggiorna Dati Commessa
    aggiornaDatiCommessaMacchina("car", stato, currentStates.Rulliere || {});
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
            el.innerText = val ? "❌ ALLARME" : "✅";
            el.className = `badge ${val ? 'val-offline' : 'val-online'}`;
        } else if (typeof val === "boolean" || val === 1 || val === -1 || val === 0) {
            const isTrue = val === true || val === 1 || val === -1;
            el.innerText = isTrue ? "✅" : "❌";
            el.style.color = isTrue ? "var(--accent-green)" : "var(--accent-red)";
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
    updateButtonToggle("rul", "CMD_EnableDrive", stato.Stato_EnableDrive, nomeMacchina);
    updateButtonToggle("rul", "CMD_Automatico", stato.Stato_Automatico, nomeMacchina);
    aggiornaIndicatoriComandiPrincipali("rul", stato);

    // Aggiorna luci sinottico rulli
    const biesseLight = document.getElementById("light-biesse");
    const r1Light = document.getElementById("light-r1");
    const r2Light = document.getElementById("light-r2");
    
    const hasR2Panel = (stato.Stato_R2Vuota === false || stato.Stato_R2Vuota === 0);
    updateBeltLight(biesseLight, stato.Stato_PannelloSuBiesse, "Pannello Su Biesse");
    updateBeltLight(r1Light, stato.Stato_PannelloSuR1, "Pannello Su R1");
    updateBeltLight(r2Light, hasR2Panel, "Pannello Su R2");
    
    // Aggiorna Dati Commessa
    aggiornaDatiCommessaMacchina("rul", stato, stato);
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

function getOrderedJobIndices(firstValue) {
    let start = parseInt(firstValue) || 1;
    if (start < 1 || start > 6) start = 1;
    let indices = [];
    for (let i = 0; i < 6; i++) {
        let idx = ((start - 1 + i) % 6) + 1;
        indices.push(idx);
    }
    return indices;
}

function getMachineStepHTML(label, isWorking, isDone) {
    if (!isWorking && isDone) {
        // Non necessaria (working == false, done == true)
        return `<span class="step-dot" title="${label}: Non necessaria" style="display: inline-block; font-size: 9px; font-weight: 700; padding: 2px 5px; border-radius: 4px; background: rgba(255,255,255,0.01); color: rgba(255,255,255,0.15); border: 1px dashed rgba(255,255,255,0.08); cursor: default; min-width: 20px; text-align: center; opacity: 0.3;">${label}</span>`;
    }

    let bg = "rgba(148, 163, 184, 0.15)"; // In attesa (working == false, done == false) - Grigio
    let fg = "var(--text-muted)";
    let border = "rgba(148, 163, 184, 0.3)";
    let title = "In attesa";

    if (isWorking && isDone) {
        // Finito (working == true, done == true) - Verde
        bg = "rgba(16, 185, 129, 0.2)";
        fg = "var(--accent-green)";
        border = "var(--accent-green)";
        title = "Finito";
    } else if (isWorking && !isDone) {
        // In corso (working == true, done == false) - Blu
        bg = "rgba(59, 130, 246, 0.2)";
        fg = "var(--accent-blue)";
        border = "var(--accent-blue)";
        title = "In lavorazione";
    }

    return `<span class="step-dot" title="${label}: ${title}" style="display: inline-block; font-size: 9px; font-weight: 700; padding: 2px 5px; border-radius: 4px; background: ${bg}; color: ${fg}; border: 1px solid ${border}; cursor: default; min-width: 20px; text-align: center;">${label}</span>`;
}

function applyModalCheckboxesLogic(isEditable, stateSource, idPad) {
    const machines = [
        { key: "Stampante", workId: "mod-job-work-sp", doneId: "mod-job-done-sp", wKey: "WorkingStampante", dKey: "DoneStampante" },
        { key: "Rulliera1", workId: "mod-job-work-r1", doneId: "mod-job-done-r1", wKey: "WorkingR1", dKey: "DoneR1" },
        { key: "Rulliera2", workId: "mod-job-work-r2", doneId: "mod-job-done-r2", wKey: "WorkingR2", dKey: "DoneR2" },
        { key: "Navetta1", workId: "mod-job-work-n1", doneId: "mod-job-done-n1", wKey: "Working_Navette", dKey: "Done_Navette" },
        { key: "Navetta2", workId: "mod-job-work-n2", doneId: "mod-job-done-n2", wKey: "Working_Navetta_2", dKey: "Done_Navetta_2" },
        { key: "Carrello", workId: "mod-job-work-cr", doneId: "mod-job-done-cr", wKey: "Working_Carrello", dKey: "Done_Carrello" },
        { key: "Caricatore", workId: "mod-job-work-car", doneId: "mod-job-done-car", wKey: "Working_Caricatore", dKey: "Done_Caricatore" }
    ];

    machines.forEach(m => {
        const wVal = !!stateSource[`Tabella${idPad}_${m.wKey}`];
        const dVal = !!stateSource[`Tabella${idPad}_${m.dKey}`];
        const notNeeded = (!wVal && dVal);

        const workEl = document.getElementById(m.workId);
        const doneEl = document.getElementById(m.doneId);

        if (workEl && doneEl) {
            workEl.checked = wVal;
            doneEl.checked = dVal;

            const workParent = workEl.parentElement;
            const doneParent = doneEl.parentElement;

            if (notNeeded) {
                workEl.disabled = true;
                doneEl.disabled = true;
                workEl.style.pointerEvents = "none";
                doneEl.style.pointerEvents = "none";
                if (workParent) workParent.style.opacity = "0.25";
                if (doneParent) doneParent.style.opacity = "0.25";
            } else {
                if (isEditable) {
                    workEl.removeAttribute("disabled");
                    doneEl.removeAttribute("disabled");
                    workEl.style.pointerEvents = "auto";
                    doneEl.style.pointerEvents = "auto";
                } else {
                    workEl.removeAttribute("disabled");
                    doneEl.removeAttribute("disabled");
                    workEl.style.pointerEvents = "none";
                    doneEl.style.pointerEvents = "none";
                }
                if (workParent) workParent.style.opacity = "1";
                if (doneParent) doneParent.style.opacity = "1";
            }
        }
    });
}

let isEditingCommessa = false;
let selectedCommessaSlot = null;
let tempCommessaData = {};

function getJobColoring(statoLabel) {
    if (statoLabel === "ESEGUITA") {
        return {
            bg: "rgba(71, 85, 105, 0.15)", // Grigio
            border: "rgba(255, 255, 255, 0.05)",
            borderColor: "rgba(148, 163, 184, 0.3)"
        };
    } else if (statoLabel === "IN ATTESA") {
        return {
            bg: "rgba(245, 158, 11, 0.12)", // Arancione (In attesa)
            border: "1px solid rgba(245, 158, 11, 0.4)",
            borderColor: "#f59e0b"
        };
    } else {
        // IN LAVORAZIONE
        return {
            bg: "rgba(59, 130, 246, 0.12)", // Blu (In lavorazione / Lavoro attivo)
            border: "1px solid rgba(59, 130, 246, 0.4)",
            borderColor: "#3b82f6"
        };
    }
}

function calcolaMacchineCoinvolte(fromX, fromY, toX, toY) {
    let involved = [];
    const y101 = 101;
    
    const fx = parseInt(fromX) || 0;
    const fy = parseInt(fromY) || 0;
    const tx = parseInt(toX) || 0;
    const ty = parseInt(toY) || 0;
    
    // 1. Rulliera R1
    if (fy === 0 || ty === 0) {
        involved.push("Rulliera 1 (R1)");
    }
    
    // 2. Rulliera R2
    if ((fy === 0 && fx !== 1) || ty === 0) {
        involved.push("Rulliera 2 (R2)");
    }
    
    // 3. Caricatore
    if (fy === 1 || ty === 1) {
        involved.push("Caricatore");
    }
    
    // 4. Carrello
    if (fy !== ty) {
        involved.push("Carrello");
    }
    
    // 5. Navette
    const hasShuttle = fy >= y101 || ty >= y101;
    if (hasShuttle) {
        const fromShuttleNum = fy >= y101 ? Math.floor((fy - y101) / 2) + 1 : 0;
        const toShuttleNum = ty >= y101 ? Math.floor((ty - y101) / 2) + 1 : 0;
        
        const isCaso5 = (fy !== ty) && (fromShuttleNum > 0 && toShuttleNum > 0) && (fromShuttleNum === toShuttleNum);
        
        if (isCaso5) {
            // Caso 5: La stessa navetta viene coinvolta 2 volte (spalle diverse)
            involved.push(`Navetta ${fromShuttleNum} (Ciclo 1)`);
            involved.push(`Navetta ${fromShuttleNum} (Ciclo 2)`);
        } else {
            // Coinvolgimento standard
            if (fromShuttleNum >= 1 && fromShuttleNum <= 10) {
                involved.push(`Navetta ${fromShuttleNum}`);
            }
            if (toShuttleNum >= 1 && toShuttleNum <= 10 && toShuttleNum !== fromShuttleNum) {
                involved.push(`Navetta ${toShuttleNum}`);
            }
        }
    }
    
    // Stampante
    involved.push("Stampante");
    
    return involved;
}

function aggiornaSchedaCommesse() {
    const nomeMacchina = "Rulliere";
    const stato = currentStates[nomeMacchina] || {};
    const comunicazione_ok = stato.__comunicazione_ok__;

    const overlay = document.getElementById("commesse-offline-overlay");
    if (comunicazione_ok) {
        overlay?.classList.remove("active");
    } else {
        overlay?.classList.add("active");
        const tbody = document.getElementById("jobs-table-body");
        if (tbody) {
            const offlineHTML = `
                <tr>
                    <td colspan="7" style="color: var(--text-muted); padding: 30px; text-align: center;">HMI Offline - Nessuna comunicazione con il PLC.</td>
                </tr>
            `;
            if (ultimoJobsTableHTML !== offlineHTML) {
                ultimoJobsTableHTML = offlineHTML;
                tbody.innerHTML = offlineHTML;
            }
        }
        return;
    }

    const firstVal = stato.First || 1;
    const firstInfoEl = document.getElementById("commesse-first-info");
    if (firstInfoEl) firstInfoEl.innerText = `First (Indice partenza): Tabella0${firstVal}`;

    // Aggiorna i campi del popup in tempo reale se è aperto ma NON in modalità modifica
    if (selectedCommessaSlot !== null && !isEditingCommessa) {
        const modalEl = document.getElementById("commessa-modal");
        if (modalEl && modalEl.style.display === "flex") {
            const idPad = selectedCommessaSlot.toString().padStart(2, '0');
            
            document.getElementById("mod-job-id").value = stato[`Tabella${idPad}_ID`] || 0;
            document.getElementById("mod-job-len").value = stato[`Tabella${idPad}_Lunghezza`] || 0;
            document.getElementById("mod-job-wid").value = stato[`Tabella${idPad}_Larghezza`] || 0;
            document.getElementById("mod-job-thk").value = stato[`Tabella${idPad}_Spessore`] || 0;
            document.getElementById("mod-job-from-x").value = stato[`Tabella${idPad}_From_X`] || 0;
            document.getElementById("mod-job-from-y").value = stato[`Tabella${idPad}_From_Y`] || 0;
            document.getElementById("mod-job-from-z").value = stato[`Tabella${idPad}_From_Z`] || 0;
            document.getElementById("mod-job-to-x").value = stato[`Tabella${idPad}_To_X`] || 0;
            document.getElementById("mod-job-to-y").value = stato[`Tabella${idPad}_To_Y`] || 0;
            document.getElementById("mod-job-to-z").value = stato[`Tabella${idPad}_ToZ`] || 0;
            document.getElementById("mod-job-new").checked = !!stato[`Tabella${idPad}_NewDatas`];
            
            // Checkbox degli stati macchina
            applyModalCheckboxesLogic(false, stato, idPad);

            // Ricalcola le macchine coinvolte in tempo reale dalle coordinate
            const fromX = stato[`Tabella${idPad}_From_X`] || 0;
            const fromY = stato[`Tabella${idPad}_From_Y`] || 0;
            const toX = stato[`Tabella${idPad}_To_X`] || 0;
            const toY = stato[`Tabella${idPad}_To_Y`] || 0;
            let involved = calcolaMacchineCoinvolte(fromX, fromY, toX, toY);
            document.getElementById("modal-macchine-list").innerText = involved.length > 0 ? involved.join(", ") : "Nessuna (in attesa)";
        }
    }

    const orderedIndices = getOrderedJobIndices(firstVal);
    const tbody = document.getElementById("jobs-table-body");
    if (!tbody) return;

    let html = "";
    orderedIndices.forEach(idx => {
        const idPad = idx.toString().padStart(2, '0');
        const jobId = stato[`Tabella${idPad}_ID`];
        
        if (jobId === undefined) return;
        
        if (!jobId || jobId === 0) {
            html += `
                <tr style="opacity: 0.5; cursor: pointer; --row-bg: rgba(71, 85, 105, 0.05); --row-border: 1px solid rgba(255, 255, 255, 0.03); --row-border-left: 5px solid rgba(148, 163, 184, 0.2);" onclick="openCommessaModal(${idx})">
                    <td><strong>#${idx}</strong></td>
                    <td colspan="6" style="color: var(--text-muted); text-align: center; font-style: italic;">[ Slot vuoto - Clicca per caricare ]</td>
                </tr>
            `;
            return;
        }

        const len = stato[`Tabella${idPad}_Lunghezza`] || 0;
        const wid = stato[`Tabella${idPad}_Larghezza`] || 0;
        const thk = stato[`Tabella${idPad}_Spessore`] || 0;
        const fromX = stato[`Tabella${idPad}_From_X`] || 0;
        const fromY = stato[`Tabella${idPad}_From_Y`] || 0;
        const fromZ = stato[`Tabella${idPad}_From_Z`] || 0;
        const toX = stato[`Tabella${idPad}_To_X`] || 0;
        const toY = stato[`Tabella${idPad}_To_Y`] || 0;
        const toZ = stato[`Tabella${idPad}_ToZ`] || 0;
        
        const isNew = !!stato[`Tabella${idPad}_NewDatas`];
        
        // Machine bits directly read as booleans
        const workR1 = !!stato[`Tabella${idPad}_WorkingR1`];
        const doneR1 = !!stato[`Tabella${idPad}_DoneR1`];
        const workR2 = !!stato[`Tabella${idPad}_WorkingR2`];
        const doneR2 = !!stato[`Tabella${idPad}_DoneR2`];
        const workNav1 = !!stato[`Tabella${idPad}_Working_Navette`];
        const doneNav1 = !!stato[`Tabella${idPad}_Done_Navette`];
        const workNav2 = !!stato[`Tabella${idPad}_Working_Navetta_2`];
        const doneNav2 = !!stato[`Tabella${idPad}_Done_Navetta_2`];
        const workCarr = !!stato[`Tabella${idPad}_Working_Carrello`];
        const doneCarr = !!stato[`Tabella${idPad}_Done_Carrello`];
        const workCar = !!stato[`Tabella${idPad}_Working_Caricatore`];
        const doneCar = !!stato[`Tabella${idPad}_Done_Caricatore`];
        const workPrint = !!stato[`Tabella${idPad}_WorkingStampante`];
        const donePrint = !!stato[`Tabella${idPad}_DoneStampante`];

        const steps = [
            getMachineStepHTML("Rulliera1", workR1, doneR1),
            getMachineStepHTML("Rulliera2", workR2, doneR2),
            getMachineStepHTML("Navetta Ciclo 1", workNav1, doneNav1),
            getMachineStepHTML("Navetta Ciclo 2", workNav2, doneNav2),
            getMachineStepHTML("Caricatore", workCar, doneCar),
            getMachineStepHTML("Carrello", workCarr, doneCarr),
            getMachineStepHTML("Stampante", workPrint, donePrint)
        ].join(" ");

        const machineStates = [
            { w: workR1, d: doneR1 },
            { w: workR2, d: doneR2 },
            { w: workNav1, d: doneNav1 },
            { w: workNav2, d: doneNav2 },
            { w: workCarr, d: doneCarr },
            { w: workCar, d: doneCar },
            { w: workPrint, d: donePrint }
        ];

        const allFinishedOrNotNeeded = machineStates.every(m => (m.w && m.d) || (!m.w && m.d));
        const allNotNeededOrInAttesa = machineStates.every(m => (!m.w && m.d) || (!m.w && !m.d));

        let statoLabel = "ESEGUITA";
        if (isNew) {
            if (allFinishedOrNotNeeded) {
                statoLabel = "ESEGUITA";
            } else if (allNotNeededOrInAttesa) {
                statoLabel = "IN ATTESA";
            } else {
                statoLabel = "IN LAVORAZIONE";
            }
        }

        const coloring = getJobColoring(statoLabel);

        let statusCol = "";
        if (statoLabel === "ESEGUITA") {
            statusCol = `<div style="display: inline-flex; align-items: center; gap: 6px; color: var(--accent-green); font-weight: 600;"><span style="display: inline-flex; align-items: center; justify-content: center; width: 14px; height: 14px; border: 1.5px solid var(--accent-green); background: rgba(16, 185, 129, 0.1); border-radius: 3px; color: var(--accent-green); font-size: 10px; font-weight: 900;">✓</span> eseguito</div>`;
        } else if (statoLabel === "IN ATTESA") {
            statusCol = `<div style="display: inline-flex; align-items: center; gap: 6px; color: var(--accent-orange); font-weight: 600;"><span style="display: inline-flex; align-items: center; justify-content: center; width: 14px; height: 14px; border: 1.5px solid var(--accent-orange); background: rgba(245, 158, 11, 0.1); border-radius: 3px; font-size: 10px; font-weight: 900;"></span> in attesa</div>`;
        } else {
            statusCol = `<div style="display: inline-flex; align-items: center; gap: 6px; color: var(--accent-blue); font-weight: 600;"><span style="display: inline-flex; align-items: center; justify-content: center; width: 14px; height: 14px; border: 1.5px solid var(--accent-blue); background: rgba(59, 130, 246, 0.1); border-radius: 3px; font-size: 10px; font-weight: 900;"></span> in lavorazione</div>`;
        }

        // Highlight if this is the active First job
        const isFirst = (idx === firstVal);
        const borderCol = coloring.border.includes("solid") ? coloring.border.split("solid ")[1] : coloring.border;
        const rowIndicator = isFirst ? "var(--accent-cyan)" : coloring.borderColor;
        const rowStyle = `--row-bg: ${coloring.bg}; --row-border: 1px solid ${borderCol}; --row-border-left: 5px solid ${rowIndicator};`;

        html += `
            <tr style="${rowStyle}" onclick="openCommessaModal(${idx})">
                <td><strong>#${idx}</strong></td>
                <td><span style="font-weight: 700; color: #fff;">${jobId}</span></td>
                <td>${len} x ${wid} x ${thk}</td>
                <td><strong style="color: var(--accent-cyan);">${fromX}</strong>, ${fromY}, ${fromZ}</td>
                <td><strong style="color: var(--accent-orange);">${toX}</strong>, ${toY}, ${toZ}</td>
                <td>${statusCol}</td>
                <td>
                    <div style="display: flex; gap: 4px; justify-content: center;">
                        ${steps}
                    </div>
                </td>
            </tr>
        `;
    });

    if (ultimoJobsTableHTML !== html) {
        ultimoJobsTableHTML = html;
        tbody.innerHTML = html;
    }
}

function aggiornaCodaCommesse() {
    const nomeMacchina = "Rulliere";
    const stato = currentStates[nomeMacchina] || {};
    const comunicazione_ok = stato.__comunicazione_ok__;

    const listEl = document.getElementById("coda-commesse-list");
    const firstIndexEl = document.getElementById("coda-first-index");
    if (!listEl) return;

    if (!comunicazione_ok) {
        if (firstIndexEl) firstIndexEl.innerText = "First: -";
        listEl.innerHTML = `
            <div style="color: var(--text-muted); font-size: 13px; text-align: center; margin-top: 40px;">
                HMI Offline
            </div>
        `;
        return;
    }

    const firstVal = stato.First || 1;
    if (firstIndexEl) firstIndexEl.innerText = `First: Slot #${firstVal}`;

    const orderedIndices = getOrderedJobIndices(firstVal);
    let html = "";
    let activeJobsCount = 0;

    orderedIndices.forEach(idx => {
        const idPad = idx.toString().padStart(2, '0');
        const jobId = stato[`Tabella${idPad}_ID`];
        
        if (!jobId || jobId === 0) return; // Skip empty slots in queue view
        
        activeJobsCount++;
        
        const len = stato[`Tabella${idPad}_Lunghezza`] || 0;
        const wid = stato[`Tabella${idPad}_Larghezza`] || 0;
        const thk = stato[`Tabella${idPad}_Spessore`] || 0;
        const fromX = stato[`Tabella${idPad}_From_X`] || 0;
        const fromY = stato[`Tabella${idPad}_From_Y`] || 0;
        const fromZ = stato[`Tabella${idPad}_From_Z`] || 0;
        const toX = stato[`Tabella${idPad}_To_X`] || 0;
        const toY = stato[`Tabella${idPad}_To_Y`] || 0;
        const toZ = stato[`Tabella${idPad}_ToZ`] || 0;
        
        const isNew = !!stato[`Tabella${idPad}_NewDatas`];
        
        // Machine bits
        const workR1 = !!stato[`Tabella${idPad}_WorkingR1`];
        const doneR1 = !!stato[`Tabella${idPad}_DoneR1`];
        const workR2 = !!stato[`Tabella${idPad}_WorkingR2`];
        const doneR2 = !!stato[`Tabella${idPad}_DoneR2`];
        const workNav1 = !!stato[`Tabella${idPad}_Working_Navette`];
        const doneNav1 = !!stato[`Tabella${idPad}_Done_Navette`];
        const workNav2 = !!stato[`Tabella${idPad}_Working_Navetta_2`];
        const doneNav2 = !!stato[`Tabella${idPad}_Done_Navetta_2`];
        const workCarr = !!stato[`Tabella${idPad}_Working_Carrello`];
        const doneCarr = !!stato[`Tabella${idPad}_Done_Carrello`];
        const workCar = !!stato[`Tabella${idPad}_Working_Caricatore`];
        const doneCar = !!stato[`Tabella${idPad}_Done_Caricatore`];
        const workPrint = !!stato[`Tabella${idPad}_WorkingStampante`];
        const donePrint = !!stato[`Tabella${idPad}_DoneStampante`];

        // Background coloring based on execution flags
        const workingFlags = [workR1, workR2, workNav1, workNav2, workCarr, workCar, workPrint];
        const doneFlags = [doneR1, doneR2, doneNav1, doneNav2, doneCarr, doneCar, donePrint];
        const machineStates = [
            { w: workR1, d: doneR1 },
            { w: workR2, d: doneR2 },
            { w: workNav1, d: doneNav1 },
            { w: workNav2, d: doneNav2 },
            { w: workCarr, d: doneCarr },
            { w: workCar, d: doneCar },
            { w: workPrint, d: donePrint }
        ];

        const allFinishedOrNotNeeded = machineStates.every(m => (m.w && m.d) || (!m.w && m.d));
        const allNotNeededOrInAttesa = machineStates.every(m => (!m.w && m.d) || (!m.w && !m.d));

        let statoLabel = "ESEGUITA";
        let statoColor = "var(--text-muted)";
        if (isNew) {
            if (allFinishedOrNotNeeded) {
                statoLabel = "ESEGUITA";
                statoColor = "var(--text-muted)";
            } else if (allNotNeededOrInAttesa) {
                statoLabel = "IN ATTESA";
                statoColor = "var(--accent-orange)";
            } else {
                statoLabel = "IN LAVORAZIONE";
                statoColor = "var(--accent-blue)";
            }
        }

        const coloring = getJobColoring(statoLabel);

        const involvedList = calcolaMacchineCoinvolte(fromX, fromY, toX, toY);
        const stepBadges = [
            getMachineStepHTML("Rulliera1", workR1, doneR1),
            getMachineStepHTML("Rulliera2", workR2, doneR2),
            getMachineStepHTML("Navetta Ciclo 1", workNav1, doneNav1),
            getMachineStepHTML("Navetta Ciclo 2", workNav2, doneNav2),
            getMachineStepHTML("Caricatore", workCar, doneCar),
            getMachineStepHTML("Carrello", workCarr, doneCarr)
        ].join(" ");

        const isFirst = (idx === firstVal);
        const firstBorder = isFirst ? "border-left: 5px solid var(--accent-cyan) !important;" : `border-left: 5px solid ${coloring.borderColor} !important;`;
        const cardStyle = `background: ${coloring.bg}; border: ${coloring.border}; ${firstBorder} cursor: pointer; margin-bottom: 2px;`;

        html += `
            <div class="job-card-wrapper" style="margin-bottom: 4px;">
                <div class="job-card" onclick="switchTab('panel-commesse')" style="border-radius: 6px; padding: 6px 8px; display: flex; flex-direction: column; gap: 3px; ${cardStyle}">
                    <div style="display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; line-height: 1.2; width: 100%;">
                        <span style="font-size: 11px; text-align: left; color: #fff; white-space: nowrap;">
                            <strong style="font-weight: 700;">Slot: #${idx} ${isFirst ? '👉 ' : ''}</strong>ID: <span style="font-weight: 400; color: var(--text-secondary);">${jobId}</span>
                        </span>
                        <span style="font-size: 11px; color: var(--text-secondary); font-weight: 500; text-align: center; white-space: nowrap; padding: 0 5px;">
                            Dimensioni: ${len}x${wid}x${thk} mm
                        </span>
                        <span style="font-size: 9px; font-weight: 600; text-align: right; color: ${statoColor}; white-space: nowrap;">
                            ${statoLabel}
                        </span>
                    </div>
                    <div style="font-size: 10px; color: var(--text-secondary); line-height: 1.2;">
                        From: X:${fromX}, Y:${fromY}, Z:${fromZ}
                    </div>
                    <div style="font-size: 10px; color: var(--text-muted); display: flex; justify-content: space-between; align-items: center; line-height: 1.2;">
                        <span>To: X:${toX}, Y:${toY}, Z:${toZ}</span>
                        <div style="display: flex; gap: 2px;">
                            ${stepBadges}
                        </div>
                    </div>
                </div>
            </div>
        `;
    });

    let finalHtml = "";
    if (activeJobsCount === 0) {
        finalHtml = `
            <div style="color: var(--text-muted); font-size: 13px; text-align: center; margin-top: 40px;">
                Nessuna commessa attiva in coda
            </div>
        `;
    } else {
        finalHtml = html;
    }

    if (ultimaCodaCommesseHTML !== finalHtml) {
        ultimaCodaCommesseHTML = finalHtml;
        listEl.innerHTML = finalHtml;
    }
}

// --- POPUP DI MODIFICA COMMESSA ---
function setModalInputsState(isEditable, stateSource = null, idPad = null) {
    const inputs = document.querySelectorAll("#modal-edit-form input");
    inputs.forEach(input => {
        if (input.type === "checkbox") {
            if (input.id === "mod-job-new" || !stateSource || !idPad) {
                input.removeAttribute("disabled");
                input.style.pointerEvents = isEditable ? "auto" : "none";
                input.tabIndex = isEditable ? 0 : -1;
            }
        } else {
            if (isEditable) {
                input.removeAttribute("disabled");
            } else {
                input.setAttribute("disabled", "true");
            }
        }
    });

    if (stateSource && idPad) {
        applyModalCheckboxesLogic(isEditable, stateSource, idPad);
    }
}

function openCommessaModal(idx) {
    selectedCommessaSlot = idx;
    isEditingCommessa = false; // default view mode
    
    // Controlla se tutte le macchine sono in manuale
    const rullAuto = !!currentStates.Rulliere?.Stato_Automatico;
    const carrAuto = !!currentStates.Carrello?.Stato_Automatico;
    const caricAuto = !!currentStates.Caricatore?.Stato_Automatico;
    
    let anyNavAuto = false;
    for (let i = 1; i <= 4; i++) {
        if (currentStates[`Navetta_${i}`]?.Stato_Automatico) {
            anyNavAuto = true;
        }
    }
    
    const allManual = !rullAuto && !carrAuto && !caricAuto && !anyNavAuto;
    
    // Riempi dati commessa
    const idPad = idx.toString().padStart(2, '0');
    const rulState = currentStates.Rulliere || {};
    
    document.getElementById("modal-title").innerText = `Dettagli Commessa Slot #${idPad}`;
    document.getElementById("modal-warning-box").style.display = allManual ? "none" : "block";
    document.getElementById("btn-modal-edit").disabled = !allManual;
    
    // Riempi i campi
    document.getElementById("mod-job-id").value = rulState[`Tabella${idPad}_ID`] || 0;
    document.getElementById("mod-job-len").value = rulState[`Tabella${idPad}_Lunghezza`] || 0;
    document.getElementById("mod-job-wid").value = rulState[`Tabella${idPad}_Larghezza`] || 0;
    document.getElementById("mod-job-thk").value = rulState[`Tabella${idPad}_Spessore`] || 0;
    document.getElementById("mod-job-from-x").value = rulState[`Tabella${idPad}_From_X`] || 0;
    document.getElementById("mod-job-from-y").value = rulState[`Tabella${idPad}_From_Y`] || 0;
    document.getElementById("mod-job-from-z").value = rulState[`Tabella${idPad}_From_Z`] || 0;
    document.getElementById("mod-job-to-x").value = rulState[`Tabella${idPad}_To_X`] || 0;
    document.getElementById("mod-job-to-y").value = rulState[`Tabella${idPad}_To_Y`] || 0;
    document.getElementById("mod-job-to-z").value = rulState[`Tabella${idPad}_ToZ`] || 0;
    document.getElementById("mod-job-new").checked = !!rulState[`Tabella${idPad}_NewDatas`];
    
    // Checkbox degli stati macchina
    applyModalCheckboxesLogic(false, rulState, idPad);
    
    // Macchine coinvolte
    const fromX = rulState[`Tabella${idPad}_From_X`] || 0;
    const fromY = rulState[`Tabella${idPad}_From_Y`] || 0;
    const toX = rulState[`Tabella${idPad}_To_X`] || 0;
    const toY = rulState[`Tabella${idPad}_To_Y`] || 0;
    let involved = calcolaMacchineCoinvolte(fromX, fromY, toX, toY);
    document.getElementById("modal-macchine-list").innerText = involved.length > 0 ? involved.join(", ") : "Nessuna (in attesa)";
    
    // Salva per il ripristino
    tempCommessaData = {
        id: rulState[`Tabella${idPad}_ID`] || 0,
        len: rulState[`Tabella${idPad}_Lunghezza`] || 0,
        wid: rulState[`Tabella${idPad}_Larghezza`] || 0,
        thk: rulState[`Tabella${idPad}_Spessore`] || 0,
        fromX: rulState[`Tabella${idPad}_From_X`] || 0,
        fromY: rulState[`Tabella${idPad}_From_Y`] || 0,
        fromZ: rulState[`Tabella${idPad}_From_Z`] || 0,
        toX: rulState[`Tabella${idPad}_To_X`] || 0,
        toY: rulState[`Tabella${idPad}_To_Y`] || 0,
        toZ: rulState[`Tabella${idPad}_ToZ`] || 0,
        isNew: !!rulState[`Tabella${idPad}_NewDatas`],
        workSp: !!rulState[`Tabella${idPad}_WorkingStampante`],
        doneSp: !!rulState[`Tabella${idPad}_DoneStampante`],
        workR1: !!rulState[`Tabella${idPad}_WorkingR1`],
        doneR1: !!rulState[`Tabella${idPad}_DoneR1`],
        workR2: !!rulState[`Tabella${idPad}_WorkingR2`],
        doneR2: !!rulState[`Tabella${idPad}_DoneR2`],
        workN1: !!rulState[`Tabella${idPad}_Working_Navette`],
        doneN1: !!rulState[`Tabella${idPad}_Done_Navette`],
        workN2: !!rulState[`Tabella${idPad}_Working_Navetta_2`],
        doneN2: !!rulState[`Tabella${idPad}_Done_Navetta_2`],
        workCr: !!rulState[`Tabella${idPad}_Working_Carrello`],
        doneCr: !!rulState[`Tabella${idPad}_Done_Carrello`],
        workCar: !!rulState[`Tabella${idPad}_Working_Caricatore`],
        doneCar: !!rulState[`Tabella${idPad}_Done_Caricatore`]
    };
    
    // Imposta lo stato iniziale dei campi (sola lettura)
    setModalInputsState(false, rulState, idPad);
    
    // Mostra il modal
    document.getElementById("commessa-modal").style.display = "flex";
    
    // Mostra i bottoni di visualizzazione
    document.getElementById("modal-footer-view").style.display = "block";
    document.getElementById("modal-footer-edit").style.display = "none";
}

function closeCommessaModal() {
    isEditingCommessa = false;
    selectedCommessaSlot = null;
    document.getElementById("commessa-modal").style.display = "none";
    setModalInputsState(false);
}

function enableCommessaEdit() {
    isEditingCommessa = true;
    
    // Rende editabili i campi
    setModalInputsState(true);
    
    // Mostra i bottoni di modifica
    document.getElementById("modal-footer-view").style.display = "none";
    document.getElementById("modal-footer-edit").style.display = "block";
}

function resetCommessaEdit() {
    // Ripristina form coi valori caricati all'apertura
    document.getElementById("mod-job-id").value = tempCommessaData.id;
    document.getElementById("mod-job-len").value = tempCommessaData.len;
    document.getElementById("mod-job-wid").value = tempCommessaData.wid;
    document.getElementById("mod-job-thk").value = tempCommessaData.thk;
    document.getElementById("mod-job-from-x").value = tempCommessaData.fromX;
    document.getElementById("mod-job-from-y").value = tempCommessaData.fromY;
    document.getElementById("mod-job-from-z").value = tempCommessaData.fromZ;
    document.getElementById("mod-job-to-x").value = tempCommessaData.toX;
    document.getElementById("mod-job-to-y").value = tempCommessaData.toY;
    document.getElementById("mod-job-to-z").value = tempCommessaData.toZ;
    document.getElementById("mod-job-new").checked = tempCommessaData.isNew;
    
    document.getElementById("mod-job-work-sp").checked = tempCommessaData.workSp;
    document.getElementById("mod-job-done-sp").checked = tempCommessaData.doneSp;
    document.getElementById("mod-job-work-r1").checked = tempCommessaData.workR1;
    document.getElementById("mod-job-done-r1").checked = tempCommessaData.doneR1;
    document.getElementById("mod-job-work-r2").checked = tempCommessaData.workR2;
    document.getElementById("mod-job-done-r2").checked = tempCommessaData.doneR2;
    document.getElementById("mod-job-work-n1").checked = tempCommessaData.workN1;
    document.getElementById("mod-job-done-n1").checked = tempCommessaData.doneN1;
    document.getElementById("mod-job-work-n2").checked = tempCommessaData.workN2;
    document.getElementById("mod-job-done-n2").checked = tempCommessaData.doneN2;
    document.getElementById("mod-job-work-cr").checked = tempCommessaData.workCr;
    document.getElementById("mod-job-done-cr").checked = tempCommessaData.doneCr;
    document.getElementById("mod-job-work-car").checked = tempCommessaData.workCar;
    document.getElementById("mod-job-done-car").checked = tempCommessaData.doneCar;
}

function cancelCommessaEdit() {
    resetCommessaEdit();
    // Disabilita gli input per ritornare in sola lettura
    setModalInputsState(false);
    // Mostra i bottoni di visualizzazione
    document.getElementById("modal-footer-view").style.display = "flex";
    document.getElementById("modal-footer-edit").style.display = "none";
    isEditingCommessa = false;
}

function saveCommessaEdit() {
    if (selectedCommessaSlot === null) return;
    
    const id = parseInt(document.getElementById("mod-job-id").value) || 0;
    const len = parseInt(document.getElementById("mod-job-len").value) || 0;
    const wid = parseInt(document.getElementById("mod-job-wid").value) || 0;
    const thk = parseInt(document.getElementById("mod-job-thk").value) || 0;
    const fromX = parseInt(document.getElementById("mod-job-from-x").value) || 0;
    const fromY = parseInt(document.getElementById("mod-job-from-y").value) || 0;
    const fromZ = parseInt(document.getElementById("mod-job-from-z").value) || 0;
    const toX = parseInt(document.getElementById("mod-job-to-x").value) || 0;
    const toY = parseInt(document.getElementById("mod-job-to-y").value) || 0;
    const toZ = parseInt(document.getElementById("mod-job-to-z").value) || 0;
    const isNew = document.getElementById("mod-job-new").checked ? 1 : 0;
    
    const workSp = document.getElementById("mod-job-work-sp").checked ? 1 : 0;
    const doneSp = document.getElementById("mod-job-done-sp").checked ? 1 : 0;
    const workR1 = document.getElementById("mod-job-work-r1").checked ? 1 : 0;
    const doneR1 = document.getElementById("mod-job-done-r1").checked ? 1 : 0;
    const workR2 = document.getElementById("mod-job-work-r2").checked ? 1 : 0;
    const doneR2 = document.getElementById("mod-job-done-r2").checked ? 1 : 0;
    const workN1 = document.getElementById("mod-job-work-n1").checked ? 1 : 0;
    const doneN1 = document.getElementById("mod-job-done-n1").checked ? 1 : 0;
    const workN2 = document.getElementById("mod-job-work-n2").checked ? 1 : 0;
    const doneN2 = document.getElementById("mod-job-done-n2").checked ? 1 : 0;
    const workCr = document.getElementById("mod-job-work-cr").checked ? 1 : 0;
    const doneCr = document.getElementById("mod-job-done-cr").checked ? 1 : 0;
    const workCar = document.getElementById("mod-job-work-car").checked ? 1 : 0;
    const doneCar = document.getElementById("mod-job-done-car").checked ? 1 : 0;
    
    const idPad = selectedCommessaSlot.toString().padStart(2, '0');
    const writes = [
        { parameter: `Tabella${idPad}_ID`, value: id },
        { parameter: `Tabella${idPad}_Lunghezza`, value: len },
        { parameter: `Tabella${idPad}_Larghezza`, value: wid },
        { parameter: `Tabella${idPad}_Spessore`, value: thk },
        { parameter: `Tabella${idPad}_From_X`, value: fromX },
        { parameter: `Tabella${idPad}_From_Y`, value: fromY },
        { parameter: `Tabella${idPad}_From_Z`, value: fromZ },
        { parameter: `Tabella${idPad}_To_X`, value: toX },
        { parameter: `Tabella${idPad}_To_Y`, value: toY },
        { parameter: `Tabella${idPad}_ToZ`, value: toZ },
        { parameter: `Tabella${idPad}_NewDatas`, value: isNew },
        
        { parameter: `Tabella${idPad}_WorkingStampante`, value: workSp },
        { parameter: `Tabella${idPad}_DoneStampante`, value: doneSp },
        { parameter: `Tabella${idPad}_WorkingR1`, value: workR1 },
        { parameter: `Tabella${idPad}_DoneR1`, value: doneR1 },
        { parameter: `Tabella${idPad}_WorkingR2`, value: workR2 },
        { parameter: `Tabella${idPad}_DoneR2`, value: doneR2 },
        { parameter: `Tabella${idPad}_Working_Navette`, value: workN1 },
        { parameter: `Tabella${idPad}_Done_Navette`, value: doneN1 },
        { parameter: `Tabella${idPad}_Working_Navetta_2`, value: workN2 },
        { parameter: `Tabella${idPad}_Done_Navetta_2`, value: doneN2 },
        { parameter: `Tabella${idPad}_Working_Carrello`, value: workCr },
        { parameter: `Tabella${idPad}_Done_Carrello`, value: doneCr },
        { parameter: `Tabella${idPad}_Working_Caricatore`, value: workCar },
        { parameter: `Tabella${idPad}_Done_Caricatore`, value: doneCar }
    ];
    
    fetch('/api/write_bulk', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            device: 'Rulliere',
            writes: writes
        })
    })
    .then(res => res.json())
    .then(res => {
        if (res.success) {
            console.log("Scrittura commessa completata sul PLC!");
            
            // Aggiorna anche currentStates in locale immediatamente
            if (!currentStates['Rulliere']) {
                currentStates['Rulliere'] = {};
            }
            writes.forEach(w => {
                let valParsed = w.value;
                if (typeof w.value === "string") {
                    if (w.value.toLowerCase() === "true" || w.value === "1" || w.value === "-1") valParsed = true;
                    else if (w.value.toLowerCase() === "false" || w.value === "0") valParsed = false;
                    else if (!isNaN(w.value) && w.value.trim() !== "") valParsed = Number(w.value);
                }
                currentStates['Rulliere'][w.parameter] = valParsed;
            });
            aggiornaInterfaccia();
            
            // Aggiorna i dati temporanei di ripristino con i nuovi valori salvati
            tempCommessaData = {
                id, len, wid, thk, fromX, fromY, fromZ, toX, toY, toZ, isNew,
                workSp, doneSp, workR1, doneR1, workR2, doneR2, workN1, doneN1, workN2, doneN2, workCr, doneCr
            };
            
            // Disabilita gli input per ritornare in sola lettura
            setModalInputsState(false);
            
            // Mostra i bottoni di visualizzazione
            document.getElementById("modal-footer-view").style.display = "flex";
            document.getElementById("modal-footer-edit").style.display = "none";
            isEditingCommessa = false;
            
            // Forza aggiornamento delle code e tabelle commesse sullo sfondo
            aggiornaCodaCommesse();
            aggiornaTabellaCommesse();
        } else {
            console.error("Errore salvataggio commessa:", res.error);
            alert("Errore durante la scrittura sul PLC: " + res.error);
        }
    })
    .catch(err => {
        console.error("Errore salvataggio commessa:", err);
        alert("Errore durante la scrittura sul PLC.");
    });
}

// Helpers pulsanti toggle
function updateButtonToggle(prefix, param, active, nomeMacchina) {
    let suffix = param.split("_")[1].toLowerCase();
    if (suffix === "enabledrive") suffix = "drive";
    if (suffix === "automatico") suffix = "auto";
    if (suffix === "maintenanceposition") suffix = "maint";
    
    // Check if there is a checkbox switch for this parameter (like Inverter Driver)
    const sw = document.getElementById(`switch-${prefix}-${suffix}`);
    if (sw) {
        sw.checked = !!active;
        // Disable switch if the safety conditions for the next state are not met
        if (nomeMacchina) {
            const condON = validaCondizioni(nomeMacchina, "EnableInverter_ON");
            const condOFF = validaCondizioni(nomeMacchina, "EnableInverter_OFF");
            if (active) {
                sw.disabled = !condOFF.allOk;
            } else {
                sw.disabled = !condON.allOk;
            }
        }
    }
    
    const btnOn = document.getElementById(`btn-${prefix}-${suffix}-on`);
    const btnOff = document.getElementById(`btn-${prefix}-${suffix}-off`);
    
    if (btnOn && btnOff && nomeMacchina) {
        // Mappatura dei comandi per recuperare le condizioni di sicurezza reali
        let cmdOn = "";
        let cmdOff = "";
        if (suffix === "auto") {
            cmdOn = "Enable_Auto_ON";
            cmdOff = "Enable_Auto_OFF";
        } else if (suffix === "maint") {
            cmdOn = "MaintenancePosition_ON";
            cmdOff = "MaintenancePosition_OFF";
        } else if (suffix === "drive") {
            cmdOn = "EnableInverter_ON";
            cmdOff = "EnableInverter_OFF";
        }
        
        const condON = cmdOn ? validaCondizioni(nomeMacchina, cmdOn) : { allOk: true };
        const condOFF = cmdOff ? validaCondizioni(nomeMacchina, cmdOff) : { allOk: true };
        
        if (active) {
            btnOn.classList.add("sunken");
            btnOff.classList.remove("sunken");
            btnOn.disabled = true; // Se già attivo, disabilita il pulsante di attivazione
            btnOff.disabled = !condOFF.allOk; // Il pulsante di disattivazione rispetta la sicurezza
        } else {
            btnOn.classList.remove("sunken");
            btnOff.classList.add("sunken");
            btnOff.disabled = true; // Se già disattivo, disabilita il pulsante di disattivazione
            btnOn.disabled = !condON.allOk; // Il pulsante di attivazione rispetta la sicurezza
        }
    }
}

// Aggiorna gli indicatori a destra (✅ verde / ❌ rosso) dei 3 comandi principali
function aggiornaIndicatoriComandiPrincipali(prefix, stato) {
    // 1. Inverter driver
    const indDrive = document.getElementById(`check-${prefix}-drive`);
    if (indDrive) {
        const active = !!stato.Stato_EnableDrive;
        indDrive.innerHTML = active ? '<span style="color:var(--accent-green)">✅</span>' : '<span style="color:var(--accent-red)">❌</span>';
    }
    
    // 2. Asse Home
    const indHome = document.getElementById(`check-${prefix}-home`);
    if (indHome) {
        const active = !!stato.Home_OK;
        indHome.innerHTML = active ? '<span style="color:var(--accent-green)">✅</span>' : '<span style="color:var(--accent-red)">❌</span>';
    }
    
    // 3. Modalità Operativa
    const indAuto = document.getElementById(`check-${prefix}-auto`);
    if (indAuto) {
        const active = !!stato.Stato_Automatico;
        indAuto.innerHTML = active ? '<span style="color:var(--accent-green)">✅</span>' : '<span style="color:var(--accent-red)">❌</span>';
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
        "Stato_ComunicazioneRulliere", "Stato_ComunicazioneCarrello",
        // Stati avanzati numerici
        "X_destinazione", "X_Ricalcolata", "Z_destinazione",
        "Z_Speed", "Z_accelerazione", "Z_Decelerazione",
        // Stati avanzati booleani
        "Stato_Memoria_Op1", "Stato_Memoria_Op3",
        "Stato_Op1", "Stato_Op2", "Stato_Op3", "Stato_Op4",
        "Stato_Caso5_PrimaParte",
        "Stato_Y1_Prendi", "Stato_Y1_avanti", "Stato_Y1_indietro", "Stato_Y1_venturi", "Stato_Y1_bascula", "Stato_Y1_PannelloPreso",
        "Stato_Y2_Prendi", "Stato_Y2_avanti", "Stato_Y2_indietro", "Stato_Y2_venturi", "Stato_Y2_bascula", "Stato_Y2_PannelloPreso",
        "Stato_Y_soffia"
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
        } else if (k.endsWith("_destinazione") || k.endsWith("_Ricalcolata") || k.startsWith("Z_Speed") || k.startsWith("Z_accelerazione") || k.startsWith("Z_Decelerazione")) {
            el.innerText = "-";
        } else {
            const advancedBools = [
                "Stato_Memoria_Op1", "Stato_Memoria_Op3",
                "Stato_Op1", "Stato_Op2", "Stato_Op3", "Stato_Op4",
                "Stato_Caso5_PrimaParte",
                "Stato_Y1_Prendi", "Stato_Y1_avanti", "Stato_Y1_indietro", "Stato_Y1_venturi", "Stato_Y1_bascula", "Stato_Y1_PannelloPreso",
                "Stato_Y2_Prendi", "Stato_Y2_avanti", "Stato_Y2_indietro", "Stato_Y2_venturi", "Stato_Y2_bascula", "Stato_Y2_PannelloPreso",
                "Stato_Y_soffia"
            ];
            if (advancedBools.includes(k)) {
                el.innerText = "OFF";
                const isBtn = el.tagName === "BUTTON";
                el.className = `badge ${isBtn ? 'badge-btn' : ''} badge-off`;
                el.style.color = "";
            } else {
                el.innerText = "⭕";
                el.className = "badge";
                el.style.color = "var(--text-muted)";
            }
        }
    });

    document.getElementById("nav-val-X_Encoder").innerText = "-";
    document.getElementById("nav-val-Z_Encoder").innerText = "-";
    const y1El = document.getElementById("nav-val-Y1_Encoder");
    if (y1El) y1El.innerText = "-";
    const y2El = document.getElementById("nav-val-Y2_Encoder");
    if (y2El) y2El.innerText = "-";

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
    
    // Disattiva e disabilita lo switch comandi avanzati se offline
    const switchEl = document.getElementById("switch-attiva-comandi-avanzati");
    if (switchEl) {
        switchEl.checked = false;
        switchEl.disabled = true;
    }
    
    // Disabilita anche comandi avanzati
    aggiornaAbilitazioneComandiAvanzati();
    // Invalida Dati Commessa
    const noJobEl = document.getElementById("nav-comm-no-job");
    const detailsEl = document.getElementById("nav-comm-details");
    if (noJobEl) noJobEl.style.display = "flex";
    if (detailsEl) detailsEl.style.display = "none";

    renderNavettaYCanvas(0, 0, {});
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
    renderCarrelloRotazione(0);

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

    // Gestione change sui checkbox switch di comando (Inverter Driver)
    document.addEventListener("change", (e) => {
        const sw = e.target.closest(".cyber-switch-input");
        if (!sw || sw.disabled) return;
        
        let device = sw.getAttribute("data-device");
        const parameter = sw.getAttribute("data-param");
        const value = sw.checked ? "-1" : "0";
        
        if (!device || !parameter) return;
        
        // Risolvi Navetta corrente
        if (device === "Navetta") {
            device = `Navetta_${activeNavettaIndex + 1}`;
        }
        
        // Chiedi conferma
        const actionWord = sw.checked ? "ABILITARE" : "DISABILITARE";
        if (!confirm(`Sei sicuro di voler ${actionWord} l'Inverter Driver per ${device}?`)) {
            // Ripristina lo stato precedente se annullato
            sw.checked = !sw.checked;
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
                // Se il comando è Home, escludi il Carrello per motivi di sicurezza collisione
                if (cmd === "Home" && m === "Carrello") {
                    return;
                }
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
            // Aggiorna lo stato locale immediatamente
            if (!currentStates[device]) {
                currentStates[device] = {};
            }
            currentStates[device][targetParam] = Number(targetVal);
            aggiornaInterfaccia();

            fetch(`/api/write?device=${device}&parameter=${cmdParam}&value=-1`)
                .then(res => res.json())
                .then(data2 => {
                    if (!data2.success) {
                        alert(`Impossibile attivare il comando ${cmdParam}: ${data2.error}`);
                    } else {
                        console.log(`Comando GoTo attivato con successo su ${device}`);
                        // Aggiorna lo stato locale del comando immediatamente
                        currentStates[device][cmdParam] = true;
                        aggiornaInterfaccia();
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
            } else {
                // Aggiorna lo stato locale immediatamente per reattività istantanea
                if (!currentStates[device]) {
                    currentStates[device] = {};
                }
                let valParsed = value;
                if (typeof value === "string") {
                    if (value.toLowerCase() === "true" || value === "1" || value === "-1") valParsed = true;
                    else if (value.toLowerCase() === "false" || value === "0") valParsed = false;
                    else if (!isNaN(value) && value.trim() !== "") valParsed = Number(value);
                }
                currentStates[device][parameter] = valParsed;
                aggiornaInterfaccia();
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
    
    // Calcolo scala di visualizzazione
    // Mappa corsaMaxY (28500) a larghezza SVG (1050 pixel, da X=50 a X=1100)
    const scaleX = 1050 / corsaMaxY;

    // Mappa corsaMaxX (27000) + 1500mm offset a altezza SVG (da Y=40 a Y=620)
    const startY = 40;
    const endY = 620;
    const scaleY = (endY - startY) / (corsaMaxX + 1500);

    // Dimensioni griglia (1000x1000mm) in pixel
    const gridW = 1000 * scaleX;
    const gridH = 1000 * scaleY;

    // Rigenera lo schema SVG statico se non ancora presente
    if (svg.children.length === 0) {
        let staticHTML = `
            <!-- Sfondo scuro griglia -->
            <defs>
                <pattern id="grid" width="${gridW}" height="${gridH}" patternUnits="userSpaceOnUse">
                    <path d="M ${gridW} 0 L 0 0 0 ${gridH}" fill="none" stroke="rgba(255,255,255,0.02)" stroke-width="1"/>
                </pattern>
                <linearGradient id="railGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stop-color="#475569" />
                    <stop offset="50%" stop-color="#64748b" />
                    <stop offset="100%" stop-color="#1e293b" />
                </linearGradient>
                <linearGradient id="woodGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stop-color="#b45309" stop-opacity="0.85" />
                    <stop offset="50%" stop-color="#d97706" stop-opacity="0.85" />
                    <stop offset="100%" stop-color="#92400e" stop-opacity="0.85" />
                </linearGradient>
                <style>
                    @keyframes flow {
                        to {
                            stroke-dashoffset: -20;
                        }
                    }
                    .flow-path {
                        stroke-dasharray: 6, 4;
                        animation: flow 1s linear infinite;
                    }
                </style>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)" />
            
            <!-- Rotaie Carrello (Orizzontale, distanti 4500mm/110px, tratteggiate) -->
            <line x1="40" y1="40" x2="1110" y2="40" stroke="rgba(255,255,255,0.15)" stroke-width="4" stroke-dasharray="4,4" />
            <line x1="40" y1="150" x2="1110" y2="150" stroke="rgba(255,255,255,0.15)" stroke-width="4" stroke-dasharray="4,4" />
        `;
        // NOTA: Scritte statiche rimosse per pulizia grafica
        
        svg.innerHTML = staticHTML;
    }

    // Rotaie Navette e scaffali dinamici
    const valoriNavetta = [18500, 21200, 24040, 27060];
    for (let i = 1; i <= 4; i++) {
        if (config && config.navette && config.navette[`Navetta_${i}`] && config.navette[`Navetta_${i}`].valori) {
            valoriNavetta[i-1] = config.navette[`Navetta_${i}`].valori[4];
        }
    }

    // Helper per verificare se una macchina è pronta (EnableDrive, Home_OK e Automatico attivi). Rulliere ignora Home_OK.
    function isMachineReady(name, state) {
        const enableDrive = state.Stato_EnableDrive !== undefined ? state.Stato_EnableDrive : true;
        let homeOk = state.Home_OK !== undefined ? state.Home_OK : true;
        if (name === "Rulliere") {
            homeOk = true;
        }
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
            shelfLeft.setAttribute("y", 167); // Spostato in basso di 20px (1000mm)
            shelfLeft.setAttribute("height", 563);
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
            shelfRight.setAttribute("y", 167); // Spostato in basso di 20px (1000mm)
            shelfRight.setAttribute("height", 563);
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
        for (let y = 167 + 30; y < 730; y += 30) {
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
                <rect x="-12" y="50.5" width="24" height="24" fill="#0f172a" rx="4" opacity="0.85" />
                <text x="0" y="69.5" font-size="18" text-anchor="middle">⚠️</text>
            </g>
        `;
        carrGroup.addEventListener("dblclick", () => {
            const switchEl = document.getElementById("switch-attiva-comandi-avanzati");
            if (switchEl && switchEl.checked) {
                const state = currentStates.Carrello || {};
                const idx = state.IndexTabellaLavoro || 0;
                openCommessaModal(idx >= 1 && idx <= 6 ? idx : 1);
            } else {
                switchTab("panel-carrello");
            }
        });
        svg.appendChild(carrGroup);
    }
    carrGroup.setAttribute("transform", `translate(${posXCarrello}, 0)`);
    
    // Toggle colore/warning carrello in base a prontezza (EnableDrive + Home_OK + Automatico)
    const carrState = currentStates.Carrello || {};
    const carrOnline = carrState.__comunicazione_ok__;
    const carrReady = carrOnline && isMachineReady("Carrello", carrState);
    
    let carrColor = "#ef4444";
    let carrFill = "rgba(239, 68, 68, 0.2)";
    if (carrReady) {
        if (carrState.Stato_Picked) {
            carrColor = "#3b82f6"; // Blu (in lavoro/attivo)
            carrFill = "rgba(59, 130, 246, 0.2)";
        } else {
            carrColor = "#10b981"; // Verde (pronto ma in attesa)
            carrFill = "rgba(16, 185, 129, 0.2)";
        }
    }
    
    const carrRect = document.getElementById("carr-rect");
    if (carrRect) {
        carrRect.setAttribute("stroke", carrColor);
        carrRect.setAttribute("fill", carrFill);
    }
    const carrCenterDot = document.getElementById("carr-center-dot");
    if (carrCenterDot) {
        carrCenterDot.setAttribute("fill", carrColor);
    }
    const carrLabelText = document.getElementById("carr-text-label");
    if (carrLabelText) {
        carrLabelText.setAttribute("fill", carrColor);
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
        // Applicazione offset verticale di 1500mm per spostare lo 0 delle navette più in alto
        const yNav = startY + ((xEnc + 1500) * scaleY);
        
        let navGroup = document.getElementById(`sin-nav-${i}`);
        if (!navGroup) {
            navGroup = document.createElementNS("http://www.w3.org/2000/svg", "g");
            navGroup.setAttribute("id", `sin-nav-${i}`);
            navGroup.setAttribute("style", "cursor: pointer;");
            navGroup.innerHTML = `
                <!-- Navetta (larghezza 400mm -> 15px, altezza 3000mm -> 70px) -->
                <rect id="nav-rect-${i}" x="-7.5" y="0" width="15" height="70" fill="rgba(16, 185, 129, 0.2)" stroke="#10b981" stroke-width="2" rx="2" />
                <text x="0" y="-8" font-size="10" font-weight="900" fill="#10b981" text-anchor="middle" id="nav-text-label-${i}">N${i}</text>
                <!-- Warning Overlay -->
                <g id="nav-warning-${i}" style="display: none;">
                    <rect x="-12" y="23" width="24" height="24" fill="#0f172a" rx="4" opacity="0.85" />
                    <text x="0" y="42" font-size="18" text-anchor="middle">⚠️</text>
                </g>
            `;
            navGroup.addEventListener("dblclick", () => {
                const switchEl = document.getElementById("switch-attiva-comandi-avanzati");
                if (switchEl && switchEl.checked) {
                    const state = currentStates[`Navetta_${i}`] || {};
                    const idx = state.IndexTabellaLavoro || 0;
                    openCommessaModal(idx >= 1 && idx <= 6 ? idx : 1);
                } else {
                    switchTab("panel-navette");
                    selectNavetta(i);
                }
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
        const navLabel = document.getElementById(`nav-text-label-${i}`);
        
        let strokeColor = "#10b981"; // Verde default (pronto ma in attesa)
        let fillColor = "rgba(16, 185, 129, 0.2)";
        
        if (!navReady) {
            strokeColor = "#ef4444"; // Rosso allarme / offline
            fillColor = "rgba(239, 68, 68, 0.2)";
        } else if (navState.Stato_Picked) {
            strokeColor = "#3b82f6"; // Blu (in lavoro/attivo)
            fillColor = "rgba(59, 130, 246, 0.2)";
        }
        
        if (navRect) {
            navRect.setAttribute("stroke", strokeColor);
            navRect.setAttribute("fill", fillColor);
        }
        if (navLabel) {
            navLabel.setAttribute("fill", strokeColor);
        }

        // Disegna Pannello di Partenza e Arrivo per la navetta
        const yRight = 100 + 2 * i - 1;
        const yLeft = 100 + 2 * i;
        
        let drawPartenza = false;
        let drawArrivo = false;
        let xPartenza = 0;
        let xArrivo = 0;
        let yCenterPartenza = 0;
        let yCenterArrivo = 0;
        let panelYPartenza = 0;
        let panelYArrivo = 0;
        let tempJob = null;
        let job1 = null;
        let job2 = null;
        let isCaso5 = false;
        let caso5PrimaParte = false;
        
        const panelW = 50 * scaleX;
        const panelH = 4200 * scaleY;

        // Pannelli di bordo navetta (sinistra e destra) che si muovono con la navetta
        let pBoardLeft = document.getElementById(`nav-board-left-${i}`);
        let pBoardRight = document.getElementById(`nav-board-right-${i}`);
        
        if (!pBoardLeft) {
            pBoardLeft = document.createElementNS("http://www.w3.org/2000/svg", "rect");
            pBoardLeft.setAttribute("id", `nav-board-left-${i}`);
            pBoardLeft.setAttribute("fill", "url(#woodGrad)");
            pBoardLeft.setAttribute("stroke", "#78350f");
            pBoardLeft.setAttribute("stroke-width", "1");
            pBoardLeft.setAttribute("rx", "1");
            navGroup.appendChild(pBoardLeft);
        }
        pBoardLeft.setAttribute("x", -15 - panelW / 2);
        pBoardLeft.setAttribute("y", -panelH / 2 + 1500 * scaleY);
        pBoardLeft.setAttribute("width", panelW);
        pBoardLeft.setAttribute("height", panelH);
        pBoardLeft.style.display = (online && !!navState.Stato_Y2_PannelloPreso) ? "block" : "none";

        if (!pBoardRight) {
            pBoardRight = document.createElementNS("http://www.w3.org/2000/svg", "rect");
            pBoardRight.setAttribute("id", `nav-board-right-${i}`);
            pBoardRight.setAttribute("fill", "url(#woodGrad)");
            pBoardRight.setAttribute("stroke", "#78350f");
            pBoardRight.setAttribute("stroke-width", "1");
            pBoardRight.setAttribute("rx", "1");
            navGroup.appendChild(pBoardRight);
        }
        pBoardRight.setAttribute("x", 15 - panelW / 2);
        pBoardRight.setAttribute("y", -panelH / 2 + 1500 * scaleY);
        pBoardRight.setAttribute("width", panelW);
        pBoardRight.setAttribute("height", panelH);
        pBoardRight.style.display = (online && !!navState.Stato_Y1_PannelloPreso) ? "block" : "none";
        
        const idVal = getMachineComandaValue(navState, "navetta", "ID");
        if (idVal !== undefined && idVal > 0) {
            // Copiamo i dati in una tabella o registro temporaneo
            tempJob = {
                ID: idVal,
                FromX: Number(getMachineComandaValue(navState, "navetta", "From_X")) || 0,
                FromY: Number(getMachineComandaValue(navState, "navetta", "From_Y")) || 0,
                FromZ: Number(getMachineComandaValue(navState, "navetta", "From_Z")) || 0,
                ToX: Number(getMachineComandaValue(navState, "navetta", "To_X")) || 0,
                ToY: Number(getMachineComandaValue(navState, "navetta", "To_Y")) || 0,
                ToZ: Number(getMachineComandaValue(navState, "navetta", "ToZ")) || 0,
            };
            
            // il caso5 viene definito true se (FromY != ToY e FromY == ( Y101 o Y102) e ToY == ( Y101 o Y102))
            isCaso5 = (tempJob.FromY !== tempJob.ToY) && 
                      (tempJob.FromY === yRight || tempJob.FromY === yLeft) && 
                      (tempJob.ToY === yRight || tempJob.ToY === yLeft);
            caso5PrimaParte = !!navState.Stato_Caso5_PrimaParte;

            if (isCaso5) {
                // Sdoppiamo la commessa in due:
                // La prima andiamo a sostituire ToX = 1080 ; ToY = FromY
                job1 = {
                    ID: tempJob.ID,
                    FromX: tempJob.FromX,
                    FromY: tempJob.FromY,
                    FromZ: tempJob.FromZ,
                    ToX: 1080,
                    ToY: tempJob.FromY,
                    ToZ: 90
                };
                
                // la seconda invece dobbiamo fare FromX = 1080; FromY = ToY
                if (caso5PrimaParte) {
                    job2 = {
                        ID: tempJob.ID,
                        FromX: 1080,
                        FromY: tempJob.ToY,
                        FromZ: 90,
                        ToX: tempJob.ToX,
                        ToY: tempJob.ToY,
                        ToZ: tempJob.ToZ
                    };
                }
            } else {
                // Caso standard (non caso 5)
                job1 = { ...tempJob };
                
                const isCaso3 = (job1.FromY !== yRight && job1.FromY !== yLeft);
                const isCaso4 = (job1.ToY !== yRight && job1.ToY !== yLeft);
                
                // caso3 quando prelevo da un'altra navetta/caricatore/rulliera
                if (isCaso3) {
                    job1.FromX = 1080;
                    job1.FromY = job1.ToY;
                    job1.FromZ = 90;
                }
                // caso4 quando deposito su un'altra navetta/caricatore/rulliera
                else if (isCaso4) {
                    job1.ToX = 1080;
                    job1.ToY = job1.FromY;
                    job1.ToZ = 90;
                }
            }
        }

        // Clean up legacy element IDs if they exist
        let legacyPartenza = document.getElementById(`nav-${i}-dot-partenza`);
        if (legacyPartenza) legacyPartenza.remove();
        let legacyArrivo = document.getElementById(`nav-${i}-dot-arrivo`);
        if (legacyArrivo) legacyArrivo.remove();
        let legacyFlow = document.getElementById(`nav-${i}-flow-path`);
        if (legacyFlow) legacyFlow.remove();
        let legacyArrows = document.getElementById(`nav-${i}-flow-arrows`);
        if (legacyArrows) legacyArrows.remove();
        let legacyOldArrivo = document.getElementById(`nav-${i}-panel-arrivo`);
        if (legacyOldArrivo) legacyOldArrivo.remove();
        let legacyOldPartenza = document.getElementById(`nav-${i}-panel-partenza`);
        if (legacyOldPartenza) legacyOldPartenza.remove();

        for (let step = 1; step <= 2; step++) {
            const job = (step === 1) ? job1 : job2;
            
            let pPartenza = document.getElementById(`nav-${i}-dot-partenza-${step}`);
            let pArrivo = document.getElementById(`nav-${i}-dot-arrivo-${step}`);
            let pFlow = document.getElementById(`nav-${i}-flow-path-${step}`);
            let pArrows = document.getElementById(`nav-${i}-flow-arrows-${step}`);

            if (!job) {
                if (pPartenza) pPartenza.style.display = "none";
                if (pArrivo) pArrivo.style.display = "none";
                if (pFlow) pFlow.style.display = "none";
                if (pArrows) pArrows.style.display = "none";
                continue;
            }

            let drawPartenza = false;
            let drawArrivo = false;
            let xPartenza = 0;
            let xArrivo = 0;
            
            const yCenterPartenza = startY + ((job.FromX + 1500) * scaleY);
            const yCenterArrivo = startY + ((job.ToX + 1500) * scaleY);

            // Pannello di Partenza
            if (job.FromY === yRight) {
                drawPartenza = true;
                xPartenza = xPosBin + 1000 * scaleX - panelW / 2;
            } else if (job.FromY === yLeft) {
                drawPartenza = true;
                xPartenza = xPosBin - 1000 * scaleX - panelW / 2;
            }
            
            // Pannello di Arrivo
            if (job.ToY === yRight) {
                drawArrivo = true;
                xArrivo = xPosBin + 1000 * scaleX - panelW / 2;
            } else if (job.ToY === yLeft) {
                drawArrivo = true;
                xArrivo = xPosBin - 1000 * scaleX - panelW / 2;
            }

            // Disegna/aggiorna pallino di partenza
            if (drawPartenza) {
                if (!pPartenza) {
                    pPartenza = document.createElementNS("http://www.w3.org/2000/svg", "circle");
                    pPartenza.setAttribute("id", `nav-${i}-dot-partenza-${step}`);
                    pPartenza.setAttribute("fill", "url(#woodGrad)");
                    pPartenza.setAttribute("stroke", "#78350f"); // Bordo color legno scuro
                    pPartenza.setAttribute("stroke-width", "1.5");
                    svg.appendChild(pPartenza);
                }
                const cx = xPartenza + panelW / 2;
                pPartenza.setAttribute("cx", cx);
                pPartenza.setAttribute("cy", yCenterPartenza);
                pPartenza.setAttribute("r", "6");
                pPartenza.style.display = "block";
                bindTooltip(pPartenza, `ID: ${job.ID} - From: ${job.FromX} / ${job.FromY} / ${job.FromZ}`);
            } else {
                if (pPartenza) pPartenza.style.display = "none";
            }

            // Disegna/aggiorna pallino di arrivo
            if (drawArrivo) {
                if (!pArrivo) {
                    pArrivo = document.createElementNS("http://www.w3.org/2000/svg", "circle");
                    pArrivo.setAttribute("id", `nav-${i}-dot-arrivo-${step}`);
                    pArrivo.setAttribute("fill", "url(#woodGrad)");
                    pArrivo.setAttribute("stroke", "#78350f"); // Bordo color legno scuro
                    pArrivo.setAttribute("stroke-width", "1.5");
                    svg.appendChild(pArrivo);
                }
                const cx = xArrivo + panelW / 2;
                pArrivo.setAttribute("cx", cx);
                pArrivo.setAttribute("cy", yCenterArrivo);
                pArrivo.setAttribute("r", "6");
                pArrivo.style.display = "block";
                bindTooltip(pArrivo, `ID: ${job.ID} - To: ${job.ToX} / ${job.ToY} / ${job.ToZ}`);
            } else {
                if (pArrivo) pArrivo.style.display = "none";
            }

            // Calcolo percorso
            let drawFlow = false;
            let pathD = "";
            
            if (drawPartenza) {
                drawFlow = true;
                const xStart = xPartenza + panelW / 2;
                const yStart = yCenterPartenza;
                const yEnd = yCenterArrivo;
                const isEven = (job.FromY % 2 === 0);
                const xMid = xStart + (isEven ? 500 : -500) * scaleX;
                pathD = `M ${xStart.toFixed(1)} ${yStart.toFixed(1)} L ${xMid.toFixed(1)} ${yStart.toFixed(1)} L ${xMid.toFixed(1)} ${yEnd.toFixed(1)} L ${xStart.toFixed(1)} ${yEnd.toFixed(1)}`;
            } else if (drawArrivo) {
                drawFlow = true;
                const xStart = xArrivo + panelW / 2;
                const yStart = yCenterPartenza;
                const yEnd = yCenterArrivo;
                const isEven = (job.ToY % 2 === 0);
                const xMid = xStart + (isEven ? 500 : -500) * scaleX;
                pathD = `M ${xStart.toFixed(1)} ${yStart.toFixed(1)} L ${xMid.toFixed(1)} ${yStart.toFixed(1)} L ${xMid.toFixed(1)} ${yEnd.toFixed(1)} L ${xStart.toFixed(1)} ${yEnd.toFixed(1)}`;
            }

            // Colori percorso e frecce
            let flowColor = "#d97706";
            let strokeColor = "rgba(217, 119, 6, 0.4)";
            if (isCaso5 && step === 1 && caso5PrimaParte) {
                flowColor = "#10b981"; // Verde per la prima linea completata
                strokeColor = "rgba(16, 185, 129, 0.4)";
            }

            if (drawFlow) {
                if (!pFlow) {
                    pFlow = document.createElementNS("http://www.w3.org/2000/svg", "path");
                    pFlow.setAttribute("id", `nav-${i}-flow-path-${step}`);
                    pFlow.setAttribute("class", "flow-path");
                    pFlow.setAttribute("fill", "none");
                    pFlow.setAttribute("stroke-width", "2");
                    svg.appendChild(pFlow);
                }
                pFlow.setAttribute("stroke", strokeColor);
                pFlow.setAttribute("d", pathD);
                pFlow.style.display = "block";

                if (!pArrows) {
                    pArrows = document.createElementNS("http://www.w3.org/2000/svg", "g");
                    pArrows.setAttribute("id", `nav-${i}-flow-arrows-${step}`);
                    pArrows.innerHTML = `
                        <polygon points="-6,-4 2,0 -6,4" fill="${flowColor}">
                            <animateMotion dur="3s" repeatCount="indefinite" rotate="auto">
                                <mpath href="#nav-${i}-flow-path-${step}"/>
                            </animateMotion>
                        </polygon>
                        <polygon points="-6,-4 2,0 -6,4" fill="${flowColor}">
                            <animateMotion dur="3s" begin="1.5s" repeatCount="indefinite" rotate="auto">
                                <mpath href="#nav-${i}-flow-path-${step}"/>
                            </animateMotion>
                        </polygon>
                    `;
                    svg.appendChild(pArrows);
                } else {
                    const polygons = pArrows.querySelectorAll("polygon");
                    polygons.forEach(poly => poly.setAttribute("fill", flowColor));
                    const mpaths = pArrows.querySelectorAll("mpath");
                    mpaths.forEach(mp => mp.setAttribute("href", `#nav-${i}-flow-path-${step}`));
                    pArrows.style.display = "block";
                }
            } else {
                if (pFlow) pFlow.style.display = "none";
                if (pArrows) pArrows.style.display = "none";
            }
        }
    }

    // 3. RULLIERE E CINGHIE
    let rullGroup = document.getElementById("sin-rulliere-col");
    const rullShiftX = 200 * scaleX; // Shifted 800mm more to the left (1000 - 800 = 200)
    
    if (!rullGroup) {
        rullGroup = document.createElementNS("http://www.w3.org/2000/svg", "g");
        rullGroup.setAttribute("id", "sin-rulliere-col");
        rullGroup.setAttribute("style", "cursor: pointer;");
        
        let r1Rollers = "";
        for (let y = 42; y < 177; y += 15) {
            r1Rollers += `<line x1="${1125 + rullShiftX}" y1="${y}" x2="${1185 + rullShiftX}" y2="${y}" stroke="#94a3b8" stroke-width="2.5" />`;
        }
        
        let r2Rollers = "";
        for (let y = 200; y < 315; y += 15) {
            r2Rollers += `<line x1="${1125 + rullShiftX}" y1="${y}" x2="${1185 + rullShiftX}" y2="${y}" stroke="#94a3b8" stroke-width="2.5" />`;
        }
        
        const panelW = (800 * scaleX).toFixed(1);
        const panelH = (4200 * scaleY).toFixed(1);
        const panelX = (1120 + rullShiftX + 100 * scaleX).toFixed(1);
        const panel1Y = (107 - (4200 * scaleY) / 2).toFixed(1);
        const panel2Y = (255 - (4200 * scaleY) / 2).toFixed(1);
        const panelBiesseX = (1155 + rullShiftX - (800 * scaleX) / 2).toFixed(1);
        
        rullGroup.innerHTML = `
            <!-- Biesse Carico (Molto compatto verticalmente, adiacente al bordo del canvas Y=0) -->
            <rect id="rul-biesse-rect" x="${1120 + rullShiftX}" y="0" width="70" height="10" fill="rgba(59, 130, 246, 0.2)" rx="2" stroke="#3b82f6" stroke-width="2" />
            <!-- Pannello di legno Biesse (altezza 10px, larghezza 800mm = panelW) allineato al centro -->
            <rect id="rul-wood-panel-biesse" x="${panelBiesseX}" y="0" width="${panelW}" height="10" fill="url(#woodGrad)" rx="1" stroke="#78350f" stroke-width="1.5" />
 
            <!-- Rulliera 1 (R1) sposta ulteriormente di 400mm più in alto (Y=32, height=150) -->
            <rect id="rul-r1-rect" x="${1120 + rullShiftX}" y="32" width="70" height="150" fill="rgba(59, 130, 246, 0.2)" rx="4" stroke="#3b82f6" stroke-width="2" />
            ${r1Rollers}
            <text x="${1155 + rullShiftX}" y="107" font-size="10" font-weight="700" fill="#3b82f6" text-anchor="middle" transform="rotate(-90 ${1155 + rullShiftX} 107)" id="rul-r1-label">RULLIERA 1 (R1)</text>
            
            <!-- Pannello di legno R1 (4200x800mm) sovrapposto, allineato al centro di R1 a 100mm dal bordo sx verso dx -->
            <rect id="rul-wood-panel-r1" x="${panelX}" y="${panel1Y}" width="${panelW}" height="${panelH}" fill="url(#woodGrad)" rx="3" stroke="#78350f" stroke-width="1.5" />
 
            <!-- Rulliera 2 (R2) - Rotata 45 gradi con centro il centro del lato inferiore, adiacente a R1 spostata in basso di 400mm (starts at Y=190, pivot at Y=320) -->
            <g id="rul-r2-group" transform="rotate(45 ${1155 + rullShiftX} 320)">
                <rect id="rul-r2-rect" x="${1120 + rullShiftX}" y="190" width="70" height="130" fill="rgba(59, 130, 246, 0.2)" rx="4" stroke="#3b82f6" stroke-width="2" />
                ${r2Rollers}
                <text x="${1155 + rullShiftX}" y="255" font-size="10" font-weight="700" fill="#3b82f6" text-anchor="middle" transform="rotate(-90 ${1155 + rullShiftX} 255)" id="rul-r2-label">RULLIERA 2 (R2)</text>
                <!-- Pannello di legno R2 (4200x800mm) sovrapposto, allineato al centro di R2 a 100mm dal bordo sx verso dx, ruota con R2 -->
                <rect id="rul-wood-panel-r2" x="${panelX}" y="${panel2Y}" width="${panelW}" height="${panelH}" fill="url(#woodGrad)" rx="3" stroke="#78350f" stroke-width="1.5" />
            </g>
            
            <!-- Macchina troncatrice a destra di R2 quando ruotata a 90 gradi (alta come la larghezza di R2=70, lunga 1500mm = 30px) -->
            <rect id="rul-r2-out-rect" x="${1285 + rullShiftX + 1400 * scaleX}" y="285" width="30" height="70" fill="rgba(59, 130, 246, 0.2)" rx="3" stroke="#3b82f6" stroke-width="2" />
            
            <!-- Warning Overlay -->
            <g id="rul-warning" style="display: none;">
                <rect x="${1143 + rullShiftX}" y="333" width="24" height="24" fill="#0f172a" rx="4" opacity="0.85" />
                <text x="${1155 + rullShiftX}" y="352" font-size="18" text-anchor="middle">⚠️</text>
            </g>
        `;
        rullGroup.addEventListener("dblclick", () => {
            const switchEl = document.getElementById("switch-attiva-comandi-avanzati");
            if (switchEl && switchEl.checked) {
                const state = currentStates.Rulliere || {};
                const idx = state.IndexTabellaLavoro || 0;
                openCommessaModal(idx >= 1 && idx <= 6 ? idx : 1);
            } else {
                switchTab("panel-rulliere");
            }
        });
        svg.appendChild(rullGroup);
    }
    
    // Toggle colore/warning rulliere in base a prontezza (EnableDrive + Automatico)
    const rulState = currentStates.Rulliere || {};
    const rullOnline = rulState.__comunicazione_ok__;
    const rulReady = rullOnline && isMachineReady("Rulliere", rulState);
    
    const r1Rect = document.getElementById("rul-r1-rect");
    const r2Rect = document.getElementById("rul-r2-rect");
    const biesseRect = document.getElementById("rul-biesse-rect");
    const rulWarning = document.getElementById("rul-warning");
    
    const r1Label = document.getElementById("rul-r1-label");
    const r2Label = document.getElementById("rul-r2-label");
    
    let colorVal = "#ef4444";
    let fillVal = "rgba(239, 68, 68, 0.2)";
    if (rulReady) {
        if (rulState.Stato_Picked) {
            colorVal = "#3b82f6"; // Blu (in lavoro/attivo)
            fillVal = "rgba(59, 130, 246, 0.2)";
        } else {
            colorVal = "#10b981"; // Verde (pronto ma in attesa)
            fillVal = "rgba(16, 185, 129, 0.2)";
        }
    }
    
    if (r1Rect) { r1Rect.setAttribute("stroke", colorVal); r1Rect.setAttribute("fill", fillVal); }
    if (r2Rect) { r2Rect.setAttribute("stroke", colorVal); r2Rect.setAttribute("fill", fillVal); }
    if (biesseRect) { biesseRect.setAttribute("stroke", colorVal); biesseRect.setAttribute("fill", fillVal); }
    const r2OutRect = document.getElementById("rul-r2-out-rect");
    if (r2OutRect) { r2OutRect.setAttribute("stroke", colorVal); r2OutRect.setAttribute("fill", fillVal); }
    
    if (r1Label) r1Label.setAttribute("fill", colorVal);
    if (r2Label) r2Label.setAttribute("fill", colorVal);
    
    if (rulWarning) {
        rulWarning.style.display = rulReady ? "none" : "block";
    }

    // Sincronizzazione rotazione R2 basata sui registri PLC
    const r2Group = document.getElementById("rul-r2-group");
    if (r2Group) {
        let angle = 45; // default / transizione
        if (rulState.Stato_R2InPos90) {
            angle = 90;
        } else if (rulState.Stato_R2InPos0) {
            angle = 0;
        }
        r2Group.setAttribute("transform", `rotate(${angle} ${1155 + rullShiftX} 320)`);
    }

    // Toggle visibilità pannelli in legno basati sui registri PLC (con controllo connessione)
    const hasPanelBiesse = rullOnline && !!rulState.Stato_PannelloSuBiesse;
    const hasPanelR1 = rullOnline && !!rulState.Stato_PannelloSuR1;
    // R2 usa il registro negato Stato_R2Vuota
    const hasPanelR2 = rullOnline && (rulState.Stato_R2Vuota === false || rulState.Stato_R2Vuota === 0);

    const pBiesse = document.getElementById("rul-wood-panel-biesse");
    const pR1 = document.getElementById("rul-wood-panel-r1");
    const pR2 = document.getElementById("rul-wood-panel-r2");

    if (pBiesse) pBiesse.style.display = hasPanelBiesse ? "block" : "none";
    if (pR1) pR1.style.display = hasPanelR1 ? "block" : "none";
    if (pR2) pR2.style.display = hasPanelR2 ? "block" : "none";

    // 4. CARICATORE A VENTOSE
    const armLen = (120 - 1700 * scaleY).toFixed(1);
    let carGroup = document.getElementById("sin-caricatore");
    if (!carGroup) {
        carGroup = document.createElementNS("http://www.w3.org/2000/svg", "g");
        carGroup.setAttribute("id", "sin-caricatore");
        carGroup.setAttribute("style", "cursor: pointer;");
        carGroup.innerHTML = `
            <!-- Base caricatore -->
            <circle cx="0" cy="0" r="15" fill="rgba(59, 130, 246, 0.2)" stroke="#3b82f6" stroke-width="1.5" id="sin-caricatore-base" />
            <!-- Braccio rotante (accorciato di 700mm in scala) -->
            <g id="sin-caricatore-braccio">
                <line x1="0" y1="0" x2="${armLen}" y2="0" stroke="#3b82f6" stroke-width="4" id="sin-caricatore-arm-line" />
                <!-- Gruppo del telaio ventose rotato di -135 gradi rispetto al braccio -->
                <g id="sin-caricatore-telaio" transform="rotate(-135 ${armLen} 0)">
                    <!-- Telaio ventose (lungo 80px) centrato su X=${armLen} -->
                    <rect x="${armLen - 40}" y="-12" width="80" height="24" fill="rgba(59, 130, 246, 0.2)" stroke="#3b82f6" rx="2" id="sin-caricatore-frame" />
                    <!-- I 8 punti/ventose distanziati lungo la larghezza del telaio centrati su ${armLen} -->
                    <circle cx="${armLen - 30}" cy="-6" r="3" fill="#3b82f6" />
                    <circle cx="${armLen - 10}" cy="-6" r="3" fill="#3b82f6" />
                    <circle cx="${armLen + 10}" cy="-6" r="3" fill="#3b82f6" />
                    <circle cx="${armLen + 30}" cy="-6" r="3" fill="#3b82f6" />
                    <circle cx="${armLen - 30}" cy="6" r="3" fill="#3b82f6" />
                    <circle cx="${armLen - 10}" cy="6" r="3" fill="#3b82f6" />
                    <circle cx="${armLen + 10}" cy="6" r="3" fill="#3b82f6" />
                    <circle cx="${armLen + 30}" cy="6" r="3" fill="#3b82f6" />
                </g>
            </g>
            <text x="0" y="-22" font-size="10" font-weight="800" fill="#3b82f6" text-anchor="middle" id="sin-caricatore-label">CARICATORE</text>
            <!-- Warning Overlay -->
            <g id="sin-caricatore-warning" style="display: none;">
                <rect x="-12" y="-12" width="24" height="24" fill="#0f172a" rx="4" opacity="0.85" />
                <text x="0" y="7" font-size="18" text-anchor="middle">⚠️</text>
            </g>
        `;
        carGroup.addEventListener("dblclick", () => {
            const switchEl = document.getElementById("switch-attiva-comandi-avanzati");
            if (switchEl && switchEl.checked) {
                const state = currentStates.Caricatore || {};
                const idx = state.IndexTabellaLavoro || 0;
                openCommessaModal(idx >= 1 && idx <= 6 ? idx : 1);
            } else {
                switchTab("panel-caricatore");
            }
        });
        svg.appendChild(carGroup);
    }
    // Spostato 300mm a sx (1000-700, ora 200mm in più a sx quindi +300*scaleX invece di +500) e 1340mm in alto rispetto al riferimento
    carGroup.setAttribute("transform", `translate(${1092.6 + 300 * scaleX}, ${215 - (840 + 500 + 1000) * scaleY})`);
    
    // Ruota il braccio in base all'encoder (base angle 225 - caricatoreRot)
    const arm = document.getElementById("sin-caricatore-braccio");
    if (arm) {
        arm.setAttribute("transform", `rotate(${225 - caricatoreRot})`);
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
    
    let carColorVal = "#ef4444";
    let carFillVal = "rgba(239, 68, 68, 0.2)";
    if (carReady) {
        if (carState.Stato_Picked) {
            carColorVal = "#3b82f6"; // Blu (in lavoro/attivo)
            carFillVal = "rgba(59, 130, 246, 0.2)";
        } else {
            carColorVal = "#10b981"; // Verde (pronto ma in attesa)
            carFillVal = "rgba(16, 185, 129, 0.2)";
        }
    }
    
    if (carBase) { carBase.setAttribute("stroke", carColorVal); carBase.setAttribute("fill", carFillVal); }
    if (carArmLine) { carArmLine.setAttribute("stroke", carColorVal); }
    if (carFrame) { carFrame.setAttribute("stroke", carColorVal); carFrame.setAttribute("fill", carFillVal); }
    if (carLabel) { carLabel.setAttribute("fill", carColorVal); }
    
    if (caricatoreWarning) {
        caricatoreWarning.style.display = carReady ? "none" : "block";
    }

    // --- DISEGNO PERCORSO ROTAZIONE CARICATORE ---
    const carIdVal = Number(getMachineComandaValue(carState, "car", "ID")) || 0;
    let capFlow = document.getElementById("car-flow-path");
    let capArrows = document.getElementById("car-flow-arrows");
    
    if (carIdVal > 0) {
        const fromY = Number(getMachineComandaValue(carState, "car", "From_Y")) || 0;
        const toY = Number(getMachineComandaValue(carState, "car", "To_Y")) || 0;
        
        const isAntioraria = (toY === 1 && fromY !== 1);
        const isOraria = (fromY === 1 && toY !== 1);
        
        if (isAntioraria || isOraria) {
            const R = Number(armLen) || 85;
            let pathD = "";
            if (isAntioraria) {
                // Da Destra (R, 0) a Sinistra (-R, 0) in senso antiorario (sweep-flag = 1)
                pathD = `M ${R.toFixed(1)} 0 A ${R.toFixed(1)} ${R.toFixed(1)} 0 0 1 -${R.toFixed(1)} 0`;
            } else {
                // Da Sinistra (-R, 0) a Destra (R, 0) in senso orario (sweep-flag = 0)
                pathD = `M -${R.toFixed(1)} 0 A ${R.toFixed(1)} ${R.toFixed(1)} 0 0 0 ${R.toFixed(1)} 0`;
            }
            
            if (!capFlow) {
                capFlow = document.createElementNS("http://www.w3.org/2000/svg", "path");
                capFlow.setAttribute("id", "car-flow-path");
                capFlow.setAttribute("fill", "none");
                capFlow.setAttribute("stroke-width", "2");
                capFlow.setAttribute("stroke-dasharray", "4 4"); // Tratteggiato
                carGroup.appendChild(capFlow);
            }
            capFlow.setAttribute("stroke", "rgba(59, 130, 246, 0.5)"); // Blu traslucido
            capFlow.setAttribute("d", pathD);
            capFlow.style.display = "block";
            
            if (!capArrows) {
                capArrows = document.createElementNS("http://www.w3.org/2000/svg", "g");
                capArrows.setAttribute("id", "car-flow-arrows");
                capArrows.innerHTML = `
                    <polygon points="-6,-4 2,0 -6,4" fill="#3b82f6">
                        <animateMotion dur="3s" repeatCount="indefinite" rotate="auto">
                            <mpath href="#car-flow-path"/>
                        </animateMotion>
                    </polygon>
                    <polygon points="-6,-4 2,0 -6,4" fill="#3b82f6">
                        <animateMotion dur="3s" begin="1.5s" repeatCount="indefinite" rotate="auto">
                            <mpath href="#car-flow-path"/>
                        </animateMotion>
                    </polygon>
                `;
                carGroup.appendChild(capArrows);
            } else {
                const polygons = capArrows.querySelectorAll("polygon");
                polygons.forEach(poly => poly.setAttribute("fill", "#3b82f6"));
                const mpaths = capArrows.querySelectorAll("mpath");
                mpaths.forEach(mp => mp.setAttribute("href", "#car-flow-path"));
                capArrows.style.display = "block";
            }
        } else {
            if (capFlow) capFlow.style.display = "none";
            if (capArrows) capArrows.style.display = "none";
        }
    } else {
        if (capFlow) capFlow.style.display = "none";
        if (capArrows) capArrows.style.display = "none";
    }

    // --- DISEGNO COMANDI / PERCORSI CARRELLO ---
    function getCarrelloXPixel(Y) {
        let Y_in_mm = 0;
        if (Y === 0) {
            Y_in_mm = -1500; // rulliere
        } else if (Y === 1) {
            // caricatore
            Y_in_mm = (config && config.caricatore && config.caricatore.posizione_y) !== undefined ? config.caricatore.posizione_y : 2000;
        } else if (Y >= 101 && Y <= 120) {
            const i = Math.floor((Y - 101) / 2) + 1; // 1-based shuttle index
            let yNav = [18500, 21200, 24040, 27060][i-1] || 0;
            let dist = 1500;
            if (i >= 1 && i <= 10) {
                if (config && config.navette && config.navette[`Navetta_${i}`] && config.navette[`Navetta_${i}`].valori) {
                    yNav = config.navette[`Navetta_${i}`].valori[4];
                    dist = config.navette[`Navetta_${i}`].valori[5] !== undefined ? config.navette[`Navetta_${i}`].valori[5] : 1500;
                }
            }
            const isRight = (Y % 2 === 1);
            Y_in_mm = isRight ? (yNav - dist) : (yNav + dist);
        }
        return 1100 - (Y_in_mm * scaleX);
    }

    const carrIdVal = Number(getMachineComandaValue(carrState, "carr", "ID")) || 0;
    let cpPartenza = document.getElementById("carr-dot-partenza");
    let cpArrivo = document.getElementById("carr-dot-arrivo");
    let cpFlow = document.getElementById("carr-flow-path");
    let cpArrows = document.getElementById("carr-flow-arrows");
    
    if (carrIdVal > 0) {
        const fromY = Number(getMachineComandaValue(carrState, "carr", "From_Y")) || 0;
        const toY = Number(getMachineComandaValue(carrState, "carr", "To_Y")) || 0;
        const fromX = Number(getMachineComandaValue(carrState, "carr", "From_X")) || 0;
        const fromZ = Number(getMachineComandaValue(carrState, "carr", "From_Z")) || 0;
        const toX = Number(getMachineComandaValue(carrState, "carr", "To_X")) || 0;
        const toZ = Number(getMachineComandaValue(carrState, "carr", "ToZ")) || 0;
        
        const xPixelPartenza = getCarrelloXPixel(fromY);
        const xPixelArrivo = getCarrelloXPixel(toY);
        
        // Calcola quota Y in pixel con shift di 1000mm verso l'alto (sottraendo pixel)
        const yCarriage = startY + ((1080 + 1500) * scaleY);
        const yDraw = yCarriage - (1000 * scaleY);
        
        // Disegna pallino partenza
        if (!cpPartenza) {
            cpPartenza = document.createElementNS("http://www.w3.org/2000/svg", "circle");
            cpPartenza.setAttribute("id", "carr-dot-partenza");
            cpPartenza.setAttribute("fill", "url(#woodGrad)");
            cpPartenza.setAttribute("stroke", "#78350f");
            cpPartenza.setAttribute("stroke-width", "1.5");
            cpPartenza.setAttribute("r", "6");
            svg.appendChild(cpPartenza);
        }
        cpPartenza.setAttribute("cx", xPixelPartenza);
        cpPartenza.setAttribute("cy", yDraw);
        cpPartenza.style.display = "block";
        bindTooltip(cpPartenza, `ID: ${carrIdVal} - From: ${fromX} / ${fromY} / ${fromZ}`);
        
        // Disegna pallino arrivo
        if (!cpArrivo) {
            cpArrivo = document.createElementNS("http://www.w3.org/2000/svg", "circle");
            cpArrivo.setAttribute("id", "carr-dot-arrivo");
            cpArrivo.setAttribute("fill", "url(#woodGrad)");
            cpArrivo.setAttribute("stroke", "#78350f");
            cpArrivo.setAttribute("stroke-width", "1.5");
            cpArrivo.setAttribute("r", "6");
            svg.appendChild(cpArrivo);
        }
        cpArrivo.setAttribute("cx", xPixelArrivo);
        cpArrivo.setAttribute("cy", yDraw);
        cpArrivo.style.display = "block";
        bindTooltip(cpArrivo, `ID: ${carrIdVal} - To: ${toX} / ${toY} / ${toZ}`);
        
        // Disegna percorso orizzontale lungo la linea di scorrimento del carrello
        const pathD = `M ${xPixelPartenza.toFixed(1)} ${yDraw.toFixed(1)} L ${xPixelArrivo.toFixed(1)} ${yDraw.toFixed(1)}`;
        
        if (!cpFlow) {
            cpFlow = document.createElementNS("http://www.w3.org/2000/svg", "path");
            cpFlow.setAttribute("id", "carr-flow-path");
            cpFlow.setAttribute("class", "flow-path");
            cpFlow.setAttribute("fill", "none");
            cpFlow.setAttribute("stroke-width", "2");
            svg.appendChild(cpFlow);
        }
        cpFlow.setAttribute("stroke", "rgba(59, 130, 246, 0.4)"); // Blu traslucido per il carrello
        cpFlow.setAttribute("d", pathD);
        cpFlow.style.display = "block";
        
        if (!cpArrows) {
            cpArrows = document.createElementNS("http://www.w3.org/2000/svg", "g");
            cpArrows.setAttribute("id", "carr-flow-arrows");
            cpArrows.innerHTML = `
                <polygon points="-6,-4 2,0 -6,4" fill="#3b82f6">
                    <animateMotion dur="3s" repeatCount="indefinite" rotate="auto">
                        <mpath href="#carr-flow-path"/>
                    </animateMotion>
                </polygon>
                <polygon points="-6,-4 2,0 -6,4" fill="#3b82f6">
                    <animateMotion dur="3s" begin="1.5s" repeatCount="indefinite" rotate="auto">
                        <mpath href="#carr-flow-path"/>
                    </animateMotion>
                </polygon>
            `;
            svg.appendChild(cpArrows);
        } else {
            const polygons = cpArrows.querySelectorAll("polygon");
            polygons.forEach(poly => poly.setAttribute("fill", "#3b82f6"));
            const mpaths = cpArrows.querySelectorAll("mpath");
            mpaths.forEach(mp => mp.setAttribute("href", "#carr-flow-path"));
            cpArrows.style.display = "block";
        }
    } else {
        if (cpPartenza) cpPartenza.style.display = "none";
        if (cpArrivo) cpArrivo.style.display = "none";
        if (cpFlow) cpFlow.style.display = "none";
        if (cpArrows) cpArrows.style.display = "none";
    }
}

// Rimossa animazione simulata R2 in favore del controllo dinamico via PLC (Stato_R2InPos90 / Stato_R2InPos0)

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
            <div class="navetta-config-header" style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border-color); padding-bottom: 8px; margin-bottom: 8px;">
                <div style="display: flex; flex-direction: column;">
                    <span style="font-weight: 700;">Navetta ${i}</span>
                    <span style="font-size: 10px; color: var(--text-muted); font-weight: normal; margin-top: 2px;">Constant: Y${100 + 2*i - 1} / Y${100 + 2*i}</span>
                </div>
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
                <div class="field">
                    <span>Distanza da carrello (mm):</span>
                    <input type="number" id="cfg-nav-distcarr-${i}" step="any">
                </div>
                <div class="field">
                    <span>Y${100 + 2*i - 1} (Valore Costante):</span>
                    <input type="text" id="cfg-nav-const-val-a-${i}" readonly style="background: rgba(255,255,255,0.03); color: var(--accent-cyan); border-color: rgba(255,255,255,0.1); cursor: default; font-weight: 600;">
                </div>
                <div class="field">
                    <span>Y${100 + 2*i} (Valore Costante):</span>
                    <input type="text" id="cfg-nav-const-val-b-${i}" readonly style="background: rgba(255,255,255,0.03); color: var(--accent-cyan); border-color: rgba(255,255,255,0.1); cursor: default; font-weight: 600;">
                </div>
            </div>
        `;
        listContainer.appendChild(item);

        // Popola i valori costanti predefiniti
        const updateConsts = () => {
            document.getElementById(`cfg-nav-const-val-a-${i}`).value = (100 + 2*i - 1).toString();
            document.getElementById(`cfg-nav-const-val-b-${i}`).value = (100 + 2*i).toString();
        };
        updateConsts();
        const posyInput = item.querySelector(`#cfg-nav-posy-${i}`);
        const distInput = item.querySelector(`#cfg-nav-distcarr-${i}`);
        posyInput.addEventListener("input", updateConsts);
        distInput.addEventListener("input", updateConsts);
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
            document.getElementById("caricatore_pos_y").value = (cfg.caricatore && cfg.caricatore.posizione_y) || 2000;
            
            // Popola campi navette 1..10
            for (let i = 1; i <= 10; i++) {
                const navName = `Navetta_${i}`;
                const navCfg = (cfg.navette && cfg.navette[navName]) || { attivo: false, valori: [27000, 1200, 1200, 3685, 0, 1500] };
                
                document.getElementById(`cfg-nav-active-${i}`).checked = !!navCfg.attivo;
                const vals = navCfg.valori || [27000, 1200, 1200, 3685, 0, 1500];
                document.getElementById(`cfg-nav-x-${i}`).value = vals[0];
                document.getElementById(`cfg-nav-y1-${i}`).value = vals[1];
                document.getElementById(`cfg-nav-y2-${i}`).value = vals[2];
                document.getElementById(`cfg-nav-z-${i}`).value = vals[3];
                document.getElementById(`cfg-nav-posy-${i}`).value = vals[4];
                document.getElementById(`cfg-nav-distcarr-${i}`).value = vals[5] !== undefined ? vals[5] : 1500;

                // Calcola inizialmente i valori delle costanti
                const distVal = vals[5] !== undefined ? vals[5] : 1500;
                document.getElementById(`cfg-nav-const-val-a-${i}`).value = (100 + 2*i - 1).toString();
                document.getElementById(`cfg-nav-const-val-b-${i}`).value = (100 + 2*i).toString();
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
            corsa_max_z: parseFloat(document.getElementById("caricatore_max_z").value),
            posizione_y: parseFloat(document.getElementById("caricatore_pos_y").value)
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
                parseFloat(document.getElementById(`cfg-nav-posy-${i}`).value),
                parseFloat(document.getElementById(`cfg-nav-distcarr-${i}`).value)
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

// ============================================================
//  NAVETTA Y1 / Y2 2D CANVAS DRAWING (INTEGRATA)
// ============================================================
const NAV_Y_GEO = {
    column: { width: 45, profileHeight: 90 },
    body:   { width: 150, height: 500 },
    arm:    { length: 1200, height: 350, thickness: 45 },
    frame:  { width: 45, height: 400 },
    cup:    { count: 4, stemLen: 28, cupW: 16, cupH: 22 },
};
const NAV_Y_SCALE = 0.38;
const NAV_Y_HINGE_X_MM = NAV_Y_GEO.body.width / 2; // 75mm dal centro

function renderNavettaYCanvas(y1Val, y2Val, stato) {
    const canvas = document.getElementById("navetta-y-canvas");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const W = canvas.width;
    const H = canvas.height;
    
    const ORIGIN_X = W / 2;
    const ORIGIN_Y = 190; // Abbassato per allineare testa colonna in alto col bordo (spazio ottimale per box HUD)
    
    function toS(mm) { return mm * NAV_Y_SCALE; }
    function toX(mm) { return ORIGIN_X + mm * NAV_Y_SCALE; }
    
    // Helper per rettangolo arrotondato
    function roundRect(x, y, w, h, r) {
        ctx.beginPath();
        ctx.moveTo(x+r, y); ctx.lineTo(x+w-r, y); ctx.quadraticCurveTo(x+w,y, x+w,y+r);
        ctx.lineTo(x+w, y+h-r); ctx.quadraticCurveTo(x+w,y+h, x+w-r,y+h);
        ctx.lineTo(x+r, y+h); ctx.quadraticCurveTo(x,y+h, x,y+h-r);
        ctx.lineTo(x, y+r); ctx.quadraticCurveTo(x,y, x+r,y);
        ctx.closePath();
    }
    
    // Helper per disegnare i box di quota simili a quelli HTML (scritte più grandi)
    function drawEncoderHUD(x, y, w, h, label, valStr, activeColor) {
        // Sfondo box
        ctx.fillStyle = 'rgba(10, 15, 25, 0.85)';
        roundRect(x, y, w, h, 8);
        ctx.fill();
        
        // Bordo box
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
        ctx.lineWidth = 1;
        ctx.stroke();
        
        // Testo label (Sinistra) - ingrandito a 12px
        ctx.font = '600 12px "Outfit", sans-serif';
        ctx.fillStyle = '#94a3b8';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(label, x + 14, y + h/2);
        
        // Testo valore (Destra) - ingrandito a 16px
        ctx.font = '800 16px "Outfit", sans-serif';
        ctx.fillStyle = activeColor;
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        ctx.fillText(valStr, x + w - 14, y + h/2);
    }
    
    // 1. Pulisci sfondo
    ctx.clearRect(0, 0, W, H);
    
    // 2. Disegna griglia
    const sp = 40;
    ctx.strokeStyle = 'rgba(148,163,184,0.02)';
    ctx.lineWidth = 0.5;
    for (let x=0; x<W; x+=sp) { ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,H); ctx.stroke(); }
    for (let y=0; y<H; y+=sp) { ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(W,y); ctx.stroke(); }
    ctx.strokeStyle = 'rgba(148,163,184,0.04)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(ORIGIN_X,0); ctx.lineTo(ORIGIN_X,H); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0,ORIGIN_Y); ctx.lineTo(W,ORIGIN_Y); ctx.stroke();
    
    // 3. Disegna Corpo Centrale (dietro)
    function drawBody() {
        const bw = toS(NAV_Y_GEO.body.width);
        const bh = toS(NAV_Y_GEO.body.height);
        const bx = ORIGIN_X - bw/2;
        const by = ORIGIN_Y - bh/2;
        
        ctx.fillStyle = 'rgba(0,0,0,0.25)';
        roundRect(bx+3, by+3, bw, bh, 5); ctx.fill();
        
        const grad = ctx.createLinearGradient(bx, 0, bx+bw, 0);
        grad.addColorStop(0, '#1e293b'); grad.addColorStop(0.5, '#293548'); grad.addColorStop(1, '#1e293b');
        ctx.fillStyle = grad;
        roundRect(bx, by, bw, bh, 5); ctx.fill();
        
        ctx.strokeStyle = 'rgba(148,163,184,0.12)';
        ctx.lineWidth = 1;
        roundRect(bx, by, bw, bh, 5); ctx.stroke();
        
        ctx.fillStyle = 'rgba(100,116,139,0.08)';
        const plateH = toS(60);
        for (let i = 0; i < 5; i++) {
            const py = by + 20 + i * (bh - 40) / 4 - plateH/2;
            roundRect(bx+6, py, bw-12, plateH, 3); ctx.fill();
        }
        ctx.fillStyle = 'rgba(71,85,105,0.2)';
        const boltOff = [[15,30],[bw-15,30],[15,bh-30],[bw-15,bh-30]];
        boltOff.forEach(([ox,oy]) => { ctx.beginPath(); ctx.arc(bx+ox, by+oy, 3, 0, Math.PI*2); ctx.fill(); });
    }
    drawBody();
    
    // 4. Disegna bracci, telai, ventose e pannelli
    
    function drawArm(yVal, isLeft) {
        let ymm = yVal;
        if (ymm < 1) ymm = 1;
        
        const L = NAV_Y_GEO.arm.length;
        const T = NAV_Y_GEO.arm.thickness;
        const theta = Math.asin(Math.min(ymm / L, 1));
        const edgeVisible = T * Math.cos(theta);
        const totalProjW = edgeVisible + ymm;
        
        const hingeX = toX(NAV_Y_HINGE_X_MM);
        const armH = toS(NAV_Y_GEO.arm.height);
        const armTop = ORIGIN_Y - armH / 2;
        const armBot = ORIGIN_Y + armH / 2;
        
        const edgePx = toS(edgeVisible);
        if (edgePx > 1) {
            const edgeGrad = ctx.createLinearGradient(hingeX, 0, hingeX + edgePx, 0);
            edgeGrad.addColorStop(0, '#1e3a8a'); edgeGrad.addColorStop(1, '#1e40af');
            ctx.fillStyle = edgeGrad;
            roundRect(hingeX, armTop, edgePx, armH, 2); ctx.fill();
        }
        
        const facePx = toS(ymm);
        if (facePx > 1) {
            const faceGrad = ctx.createLinearGradient(0, armTop, 0, armBot);
            faceGrad.addColorStop(0, '#60a5fa');
            faceGrad.addColorStop(0.12, '#3b82f6');
            faceGrad.addColorStop(0.88, '#2563eb');
            faceGrad.addColorStop(1, '#1d4ed8');
            ctx.fillStyle = faceGrad;
            roundRect(hingeX + edgePx, armTop, facePx, armH, 2); ctx.fill();
            
            ctx.strokeStyle = 'rgba(30,58,138,0.3)';
            ctx.lineWidth = 0.8;
            const ribSpacing = toS(80);
            for (let rx = hingeX + edgePx + ribSpacing; rx < hingeX + edgePx + facePx - 5; rx += ribSpacing) {
                ctx.beginPath(); ctx.moveTo(rx, armTop + 6); ctx.lineTo(rx, armBot - 6); ctx.stroke();
            }
        }
        
        ctx.strokeStyle = 'rgba(96,165,250,0.4)';
        ctx.lineWidth = 1.5;
        const totalPx = toS(totalProjW);
        roundRect(hingeX, armTop, totalPx, armH, 2); ctx.stroke();
        
        if (edgePx > 2 && facePx > 2) {
            ctx.strokeStyle = 'rgba(30,58,138,0.5)';
            ctx.lineWidth = 1;
            ctx.beginPath(); ctx.moveTo(hingeX + edgePx, armTop + 2); ctx.lineTo(hingeX + edgePx, armBot - 2); ctx.stroke();
        }
        
        if (facePx > 80) {
            ctx.save();
            ctx.font = '10px "Outfit", sans-serif';
            ctx.fillStyle = 'rgba(191,219,254,0.25)';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            
            const tx = hingeX + edgePx + facePx / 2;
            const ty = ORIGIN_Y;
            if (isLeft) {
                ctx.translate(tx, ty);
                ctx.scale(-1, 1);
                ctx.fillText('BRACCIO', 0, 0);
            } else {
                ctx.fillText('BRACCIO', tx, ty);
            }
            ctx.restore();
        }
    }
    
    function drawHinge() {
        const hingeX = toX(NAV_Y_HINGE_X_MM);
        const armH = toS(NAV_Y_GEO.arm.height);
        [ORIGIN_Y - armH/2 + 15, ORIGIN_Y + armH/2 - 15].forEach(hy => {
            ctx.beginPath(); ctx.arc(hingeX, hy, 7, 0, Math.PI*2);
            ctx.fillStyle = '#334155'; ctx.fill();
            ctx.strokeStyle = 'rgba(148,163,184,0.4)'; ctx.lineWidth = 1.5; ctx.stroke();
            ctx.beginPath(); ctx.arc(hingeX, hy, 2.5, 0, Math.PI*2);
            ctx.fillStyle = '#64748b'; ctx.fill();
        });
    }
    
    function drawFrame(yVal, isLeft) {
        const L = NAV_Y_GEO.arm.length;
        const T = NAV_Y_GEO.arm.thickness;
        const theta = Math.asin(Math.min(yVal / L, 1));
        const edgeVisible = T * Math.cos(theta);
        const totalProjW = edgeVisible + yVal;
        
        const hingeX = toX(NAV_Y_HINGE_X_MM);
        const fx = hingeX + toS(totalProjW);
        const fw = toS(NAV_Y_GEO.frame.width);
        const fh = toS(NAV_Y_GEO.frame.height);
        const fy = ORIGIN_Y - fh / 2;
        
        ctx.fillStyle = 'rgba(0,0,0,0.2)';
        roundRect(fx+2, fy+2, fw, fh, 3); ctx.fill();
        
        const grad = ctx.createLinearGradient(fx, 0, fx+fw, 0);
        grad.addColorStop(0, '#334155'); grad.addColorStop(0.5, '#475569'); grad.addColorStop(1, '#334155');
        ctx.fillStyle = grad;
        roundRect(fx, fy, fw, fh, 3); ctx.fill();
        
        ctx.strokeStyle = 'rgba(148,163,184,0.25)';
        ctx.lineWidth = 1;
        roundRect(fx, fy, fw, fh, 3); ctx.stroke();
        
        ctx.strokeStyle = 'rgba(100,116,139,0.15)';
        ctx.lineWidth = 0.8;
        const divs = 5;
        for (let i = 1; i < divs; i++) {
            const dy = fy + (fh / divs) * i;
            ctx.beginPath(); ctx.moveTo(fx+3, dy); ctx.lineTo(fx+fw-3, dy); ctx.stroke();
        }
        
        const jointY2 = ORIGIN_Y + toS(NAV_Y_GEO.arm.height)/2;
        ctx.beginPath(); ctx.arc(fx, jointY2, 5, 0, Math.PI*2);
        ctx.fillStyle = '#1e293b'; ctx.fill();
        ctx.strokeStyle = 'rgba(148,163,184,0.3)'; ctx.lineWidth = 1; ctx.stroke();
        
        if (fw > 15) {
            ctx.save();
            const textX = fx + fw/2;
            const textY = ORIGIN_Y;
            ctx.translate(textX, textY);
            if (isLeft) ctx.scale(-1, 1);
            ctx.rotate(-Math.PI/2);
            ctx.font = '8px "Outfit", sans-serif';
            ctx.fillStyle = 'rgba(148,163,184,0.25)';
            ctx.textAlign = 'center';
            ctx.fillText('TELAIO', 0, 3);
            ctx.restore();
        }
    }
    
    function drawCups(yVal) {
        const L = NAV_Y_GEO.arm.length;
        const T = NAV_Y_GEO.arm.thickness;
        const theta = Math.asin(Math.min(yVal / L, 1));
        const edgeVisible = T * Math.cos(theta);
        const totalProjW = edgeVisible + yVal;
        
        const hingeX = toX(NAV_Y_HINGE_X_MM);
        const frameRightX = hingeX + toS(totalProjW) + toS(NAV_Y_GEO.frame.width);
        const fh = NAV_Y_GEO.frame.height;
        const n = NAV_Y_GEO.cup.count;
        const spacing = fh / (n + 1);
        
        for (let i = 1; i <= n; i++) {
            const cupCenterY = ORIGIN_Y - toS(fh/2) + toS(spacing * i);
            const stemEnd = frameRightX + toS(NAV_Y_GEO.cup.stemLen);
            const cw = toS(NAV_Y_GEO.cup.cupW);
            const ch = toS(NAV_Y_GEO.cup.cupH);
            
            const glowGrad = ctx.createRadialGradient(stemEnd + cw/2, cupCenterY, 2, stemEnd + cw/2, cupCenterY, ch);
            glowGrad.addColorStop(0, 'rgba(0,242,254,0.12)');
            glowGrad.addColorStop(1, 'transparent');
            ctx.beginPath(); ctx.arc(stemEnd + cw/2, cupCenterY, ch, 0, Math.PI*2);
            ctx.fillStyle = glowGrad; ctx.fill();
            
            ctx.strokeStyle = '#64748b';
            ctx.lineWidth = 3;
            ctx.beginPath(); ctx.moveTo(frameRightX, cupCenterY); ctx.lineTo(stemEnd, cupCenterY); ctx.stroke();
            
            ctx.beginPath();
            ctx.moveTo(stemEnd, cupCenterY - ch * 0.3);
            ctx.lineTo(stemEnd + cw, cupCenterY - ch * 0.5);
            ctx.lineTo(stemEnd + cw, cupCenterY + ch * 0.5);
            ctx.lineTo(stemEnd, cupCenterY + ch * 0.3);
            ctx.closePath();
            ctx.fillStyle = '#2d3748';
            ctx.fill();
            ctx.strokeStyle = '#4a5568';
            ctx.lineWidth = 1;
            ctx.stroke();
            
            ctx.beginPath();
            ctx.moveTo(stemEnd + cw, cupCenterY - ch * 0.5);
            ctx.lineTo(stemEnd + cw + 3, cupCenterY - ch * 0.55);
            ctx.lineTo(stemEnd + cw + 3, cupCenterY + ch * 0.55);
            ctx.lineTo(stemEnd + cw, cupCenterY + ch * 0.5);
            ctx.closePath();
            ctx.fillStyle = '#4a5568';
            ctx.fill();
            
            ctx.strokeStyle = 'rgba(100,116,139,0.3)';
            ctx.lineWidth = 0.6;
            for (let s = 0; s < 0.9; s += 0.2) {
                const sx = stemEnd + cw * s;
                const hf = 0.3 + (0.5 - 0.3) * s;
                ctx.beginPath(); ctx.moveTo(sx, cupCenterY - ch * hf); ctx.lineTo(sx, cupCenterY + ch * hf); ctx.stroke();
            }
            
            ctx.beginPath(); ctx.arc(stemEnd + cw * 0.4, cupCenterY, 1.5, 0, Math.PI*2);
            ctx.fillStyle = 'rgba(0,242,254,0.5)'; ctx.fill();
        }
    }
    
    function drawWoodPanel(yVal, isLeft) {
        const hasPanel = isLeft 
            ? (stato && stato.Stato_Y2_PannelloPreso)
            : (stato && stato.Stato_Y1_PannelloPreso);
        if (!hasPanel) return;
        
        const L = NAV_Y_GEO.arm.length;
        const T = NAV_Y_GEO.arm.thickness;
        const theta = Math.asin(Math.min(yVal / L, 1));
        const edgeVisible = T * Math.cos(theta);
        const totalProjW = edgeVisible + yVal;
        
        const hingeX = toX(NAV_Y_HINGE_X_MM);
        const frameRightX = hingeX + toS(totalProjW) + toS(NAV_Y_GEO.frame.width);
        const stemEnd = frameRightX + toS(NAV_Y_GEO.cup.stemLen);
        const cw = toS(NAV_Y_GEO.cup.cupW);
        const cupRightX = stemEnd + cw + 3;
        
        const pw = toS(20);
        const ph = toS(400);
        const px = cupRightX;
        const py = ORIGIN_Y - ph / 2;
        
        ctx.fillStyle = 'rgba(0,0,0,0.15)';
        roundRect(px + 2, py + 2, pw, ph, 2); ctx.fill();
        
        const woodGrad = ctx.createLinearGradient(px, py, px + pw, py);
        woodGrad.addColorStop(0, '#e5c07b');
        woodGrad.addColorStop(0.3, '#ebd09f');
        woodGrad.addColorStop(0.7, '#e5c07b');
        woodGrad.addColorStop(1, '#cca359');
        ctx.fillStyle = woodGrad;
        roundRect(px, py, pw, ph, 2); ctx.fill();
        
        ctx.strokeStyle = 'rgba(139, 90, 43, 0.15)';
        ctx.lineWidth = 1;
        [0.25, 0.5, 0.75].forEach(f => {
            ctx.beginPath();
            ctx.moveTo(px + pw * f, py + 2);
            for (let currY = py + 6; currY < py + ph - 2; currY += 12) {
                const wobble = Math.sin(currY * 0.04) * 0.9;
                ctx.lineTo(px + pw * f + wobble, currY);
            }
            ctx.lineTo(px + pw * f, py + ph - 2);
            ctx.stroke();
        });
        
        ctx.strokeStyle = '#cda160';
        ctx.lineWidth = 1;
        roundRect(px, py, pw, ph, 2); ctx.stroke();
    }
    
    // RENDER LATO DESTRO (Y1)
    {
        ctx.save();
        drawArm(y1Val, false);
        
        // Pivot point per rotazione telaio Y1 (cerniera inferiore)
        const L = NAV_Y_GEO.arm.length;
        const T = NAV_Y_GEO.arm.thickness;
        const theta = Math.asin(Math.min(y1Val / L, 1));
        const edgeVisible = T * Math.cos(theta);
        const totalProjW = edgeVisible + y1Val;
        const hingeX = toX(NAV_Y_HINGE_X_MM);
                const px = hingeX + toS(totalProjW);
        const py = ORIGIN_Y + toS(NAV_Y_GEO.arm.height)/2;
        const isBascula = (stato && (stato.Stato_Y1_bascula || stato.Stato_Bascula1)) ? true : false;
        
        ctx.save();
        if (isBascula) {
            ctx.translate(px, py);
            ctx.rotate(10 * Math.PI / 180); // Inclinazione di 10 gradi in senso orario
            ctx.translate(-px, -py);
        }
        drawFrame(y1Val, false);
        drawCups(y1Val);
        drawWoodPanel(y1Val, false);
        ctx.restore();
        
        ctx.restore();
        drawHinge();
    }
    
    // RENDER LATO SINISTRO (Y2)
    {
        ctx.save();
        ctx.translate(ORIGIN_X, 0);
        ctx.scale(-1, 1);
        ctx.translate(-ORIGIN_X, 0);
        
        drawArm(y2Val, true);
        
        // Pivot point per rotazione telaio Y2 (cerniera inferiore, in coordinate locali specchiate)
        const L = NAV_Y_GEO.arm.length;
        const T = NAV_Y_GEO.arm.thickness;
        const theta = Math.asin(Math.min(y2Val / L, 1));
        const edgeVisible = T * Math.cos(theta);
        const totalProjW = edgeVisible + y2Val;
        const hingeX = toX(NAV_Y_HINGE_X_MM);
        const px = hingeX + toS(totalProjW);
        const py = ORIGIN_Y + toS(NAV_Y_GEO.arm.height)/2;
        const isBascula = (stato && (stato.Stato_Y2_bascula || stato.Stato_Bascula2)) ? true : false;
        
        ctx.save();
        if (isBascula) {
            ctx.translate(px, py);
            ctx.rotate(10 * Math.PI / 180); // Inclinazione locale di 10 gradi in senso orario (in coord. globali diventa antiorario)
            ctx.translate(-px, -py);
        }
        drawFrame(y2Val, true);
        drawCups(y2Val);
        drawWoodPanel(y2Val, true);
        ctx.restore();
        
        ctx.restore();
        
        ctx.save();
        ctx.translate(ORIGIN_X, 0);
        ctx.scale(-1, 1);
        ctx.translate(-ORIGIN_X, 0);
        drawHinge();
        ctx.restore();
    }
    
    // 5. Disegna Colonna Centrale (sopra a tutto)
    function drawColumn() {
        const cw = toS(NAV_Y_GEO.column.width);
        const cx = ORIGIN_X - cw/2;
        const bh = toS(NAV_Y_GEO.body.height);
        const by = ORIGIN_Y - bh/2;
        
        // Alta 900mm (sporge 200mm in alto, 200mm in basso rispetto al corpo)
        const cy = by - toS(200);
        const ch = toS(200) + bh + toS(200);
        
        ctx.fillStyle = 'rgba(0,0,0,0.35)';
        ctx.fillRect(cx+3, cy, cw, ch);
        
        const grad = ctx.createLinearGradient(cx, 0, cx+cw, 0);
        grad.addColorStop(0, '#475569'); grad.addColorStop(0.15, '#8494a7'); grad.addColorStop(0.3, '#94a3b8');
        grad.addColorStop(0.5, '#a0aec0'); grad.addColorStop(0.7, '#94a3b8'); grad.addColorStop(0.85, '#8494a7');
        grad.addColorStop(1, '#475569');
        ctx.fillStyle = grad;
        ctx.fillRect(cx, cy, cw, ch);
        
        const slotW = toS(10);
        const slotX = cx + cw/2 - slotW/2;
        ctx.fillStyle = 'rgba(0,0,0,0.2)';
        ctx.fillRect(slotX, cy, slotW, ch);
        ctx.fillStyle = 'rgba(0,0,0,0.1)';
        ctx.fillRect(slotX + 2, cy, slotW - 4, ch);
        
        ctx.strokeStyle = 'rgba(255,255,255,0.08)';
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(cx+1, cy); ctx.lineTo(cx+1, cy+ch); ctx.stroke();
        ctx.strokeStyle = 'rgba(0,0,0,0.15)';
        ctx.beginPath(); ctx.moveTo(cx+cw-1, cy); ctx.lineTo(cx+cw-1, cy+ch); ctx.stroke();
        
        ctx.strokeStyle = 'rgba(0,0,0,0.12)';
        ctx.lineWidth = 0.8;
        [0.2, 0.8].forEach(f => {
            const lx = cx + cw * f;
            ctx.beginPath(); ctx.moveTo(lx, cy); ctx.lineTo(lx, cy+ch); ctx.stroke();
        });
    }
    drawColumn();
    
    // 6. HUD TESTUALE QUOTE ENCODER IN ALTO STILE BOX HMI (Scritte più grandi)
    drawEncoderHUD(15, 12, 260, 44, 'Encoder Asse Y2 (SX)', `${y2Val.toFixed(1)} mm`, '#60a5fa');
    drawEncoderHUD(W - 275, 12, 260, 44, 'Encoder Asse Y1 (DX)', `${y1Val.toFixed(1)} mm`, '#34d399');
}

// ============================================================
//  CARRELLO — Vista Laterale 2D (Asse Rotazione)
// ============================================================
function renderCarrelloRotazione(rotVal) {
    const canvas = document.getElementById("carrello-rot-canvas");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const W = canvas.width;
    const H = canvas.height;

    const SCALE = 0.23; // px/mm per far entrare la quota rotazione in 480x400
    const ORIGIN_X = W / 2; // 240px
    const GROUND_Y = H - 15; // 385px

    function toS(mm) { return mm * SCALE; }
    function toX(mm) { return ORIGIN_X + mm * SCALE; }
    function toY(mm) { return GROUND_Y - mm * SCALE; }

    const GEO = {
        rail:       { length: 1500, height: 40 },
        wheel:      { diameter: 150, radius: 75, count: 4 },
        baseBeam:   { length: 1100, height: 90 },
        column:     { width: 250, height: 700 },
        cradle:     { diameter: 400, radius: 200 },
        bench:      { length: 1200, height: 45 },
        pulley:     { diameter: 80, radius: 40 },
        belt:       { thickness: 3 },
        endProfile: { size: 45 },
        stop:       { width: 10, height: 75, extension: 30 }
    };

    const RAIL_TOP_Y = GEO.rail.height;
    const WHEEL_CENTER_Y = RAIL_TOP_Y + GEO.wheel.radius;
    const BASE_BOT_Y = WHEEL_CENTER_Y;
    const BASE_TOP_Y = BASE_BOT_Y + GEO.baseBeam.height;
    const COLUMN_BOT_Y = BASE_TOP_Y;
    const COLUMN_TOP_Y = COLUMN_BOT_Y + GEO.column.height;
    const ROT_CENTER_Y = COLUMN_TOP_Y - 50;

    function roundRect(x, y, w, h, r) {
        ctx.beginPath();
        ctx.moveTo(x+r, y); ctx.lineTo(x+w-r, y); ctx.quadraticCurveTo(x+w,y, x+w,y+r);
        ctx.lineTo(x+w, y+h-r); ctx.quadraticCurveTo(x+w,y+h, x+w-r,y+h);
        ctx.lineTo(x+r, y+h); ctx.quadraticCurveTo(x,y+h, x,y+h-r);
        ctx.lineTo(x, y+r); ctx.quadraticCurveTo(x,y, x+r,y);
        ctx.closePath();
    }

    // Helper per disegnare i box di quota simili a quelli della Navetta
    function drawEncoderHUD(x, y, w, h, label, valStr, activeColor) {
        ctx.fillStyle = 'rgba(10, 15, 25, 0.85)';
        roundRect(x, y, w, h, 8);
        ctx.fill();
        
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
        ctx.lineWidth = 1;
        ctx.stroke();
        
        ctx.font = '600 12px "Outfit", sans-serif';
        ctx.fillStyle = '#94a3b8';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(label, x + 14, y + h/2);
        
        ctx.font = '800 16px "Outfit", sans-serif';
        ctx.fillStyle = activeColor;
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        ctx.fillText(valStr, x + w - 14, y + h/2);
    }

    ctx.clearRect(0, 0, W, H);

    // 1. Griglia di sfondo
    const sp = 30;
    ctx.strokeStyle = 'rgba(148,163,184,0.02)';
    ctx.lineWidth = 0.5;
    for (let x=0; x<W; x+=sp) { ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,H); ctx.stroke(); }
    for (let y=0; y<H; y+=sp) { ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(W,y); ctx.stroke(); }

    // 3. Binario fisso
    const rx = toX(-GEO.rail.length / 2);
    const ry = toY(GEO.rail.height);
    const rw = toS(GEO.rail.length);
    const rh = toS(GEO.rail.height);
    const railGrad = ctx.createLinearGradient(0, ry, 0, ry + rh);
    railGrad.addColorStop(0, '#334155');
    railGrad.addColorStop(0.3, '#475569');
    railGrad.addColorStop(1, '#0f172a');
    ctx.fillStyle = railGrad;
    ctx.fillRect(rx, ry, rw, rh);
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(rx, ry); ctx.lineTo(rx + rw, ry); ctx.stroke();

    // 4. Ruote del carrello fisso
    const wSpacing = GEO.baseBeam.length / 3;
    const wheelXPositions = [
        -GEO.baseBeam.length / 2,
        -GEO.baseBeam.length / 2 + wSpacing,
        -GEO.baseBeam.length / 2 + wSpacing * 2,
        GEO.baseBeam.length / 2
    ];
    wheelXPositions.forEach(wx => {
        const wcx = toX(wx);
        const wcy = toY(WHEEL_CENTER_Y);
        const wr = toS(GEO.wheel.radius);
        ctx.fillStyle = '#1e293b';
        ctx.beginPath(); ctx.arc(wcx, wcy, wr, 0, Math.PI*2); ctx.fill();
        ctx.strokeStyle = '#475569';
        ctx.lineWidth = 1;
        ctx.stroke();

        const innerR = wr * 0.7;
        const rimGrad = ctx.createRadialGradient(wcx - 1, wcy - 1, 1, wcx, wcy, innerR);
        rimGrad.addColorStop(0, '#cbd5e1'); rimGrad.addColorStop(1, '#475569');
        ctx.fillStyle = rimGrad;
        ctx.beginPath(); ctx.arc(wcx, wcy, innerR, 0, Math.PI*2); ctx.fill();

        ctx.fillStyle = '#0f172a';
        ctx.beginPath(); ctx.arc(wcx, wcy, wr * 0.2, 0, Math.PI*2); ctx.fill();
    });

    // 5. Traverso di base
    const bx = toX(-GEO.baseBeam.length / 2);
    const by = toY(BASE_TOP_Y);
    const bw = toS(GEO.baseBeam.length);
    const bh = toS(GEO.baseBeam.height);
    const baseGrad = ctx.createLinearGradient(0, by, 0, by + bh);
    baseGrad.addColorStop(0, '#64748b'); baseGrad.addColorStop(0.5, '#cbd5e1'); baseGrad.addColorStop(1, '#475569');
    ctx.fillStyle = baseGrad;
    roundRect(bx, by, bw, bh, 3);
    ctx.fill();
    ctx.strokeStyle = 'rgba(15,23,42,0.15)';
    ctx.lineWidth = 1;
    [0.25, 0.5, 0.75].forEach(f => {
        const sy = by + bh * f;
        ctx.beginPath(); ctx.moveTo(bx + 2, sy); ctx.lineTo(bx + bw - 2, sy); ctx.stroke();
    });

    // 6. Colonna centrale fissa
    const colx = toX(-GEO.column.width / 2);
    const coly = toY(COLUMN_TOP_Y);
    const colw = toS(GEO.column.width);
    const colh = toS(GEO.column.height);
    const colGrad = ctx.createLinearGradient(colx, 0, colx + colw, 0);
    colGrad.addColorStop(0, '#475569'); colGrad.addColorStop(0.5, '#cbd5e1'); colGrad.addColorStop(1, '#475569');
    ctx.fillStyle = colGrad;
    ctx.fillRect(colx, coly, colw, colh);
    ctx.fillStyle = 'rgba(15,23,42,0.18)';
    [0.25, 0.5, 0.75].forEach(f => {
        const sx = colx + colw * f - toS(4);
        ctx.fillRect(sx, coly, toS(8), colh);
    });

    // 7. Gruppo rotante (Culla, barra, banco, pulegge, cinghia, profili e battute)
    const angleRad = rotVal * Math.PI / 180;
    const rotCenterX = toX(0);
    const rotCenterY = toY(ROT_CENTER_Y);

    ctx.save();
    ctx.translate(rotCenterX, rotCenterY);
    ctx.rotate(angleRad);

    // Culla (Semicerchio)
    const cradleR = toS(GEO.cradle.radius);
    const cradleGrad = ctx.createRadialGradient(-10, 10, 10, 0, 0, cradleR);
    cradleGrad.addColorStop(0, '#cbd5e1'); cradleGrad.addColorStop(1, '#334155');
    ctx.fillStyle = cradleGrad;
    ctx.beginPath();
    ctx.arc(0, 0, cradleR, -Math.PI / 6, -5 * Math.PI / 6, false);
    ctx.lineTo(toS(-173.2), toS(-100));
    ctx.lineTo(toS(173.2), toS(-100));
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.1)';
    ctx.stroke();

    // Barra asse rotativo
    const barW = toS(36);
    const barH = toS(185);
    const barGrad = ctx.createLinearGradient(-barW/2, 0, barW/2, 0);
    barGrad.addColorStop(0, '#94a3b8'); barGrad.addColorStop(0.5, '#cbd5e1'); barGrad.addColorStop(1, '#475569');
    ctx.fillStyle = barGrad;
    ctx.fillRect(-barW/2, 0, barW, barH);
    ctx.fillStyle = '#1e293b';
    ctx.beginPath(); ctx.arc(0, toS(45), 2.5, 0, Math.PI*2); ctx.arc(0, toS(135), 2.5, 0, Math.PI*2); ctx.fill();

    // Albero centrale
    ctx.fillStyle = '#1e293b';
    ctx.beginPath(); ctx.arc(0, 0, toS(18), 0, Math.PI*2); ctx.fill();
    const pivotGrad = ctx.createRadialGradient(-1, -1, 1, 0, 0, toS(18));
    pivotGrad.addColorStop(0, '#cbd5e1'); pivotGrad.addColorStop(1, '#0f172a');
    ctx.fillStyle = pivotGrad;
    ctx.beginPath(); ctx.arc(0, 0, toS(16), 0, Math.PI*2); ctx.fill();

    // Banco
    const benchX = toS(-GEO.bench.length / 2);
    const benchY = toS(-145);
    const benchW = toS(GEO.bench.length);
    const benchH = toS(GEO.bench.height);
    const benchGrad = ctx.createLinearGradient(0, benchY, 0, benchY + benchH);
    benchGrad.addColorStop(0, '#94a3b8'); benchGrad.addColorStop(0.5, '#cbd5e1'); benchGrad.addColorStop(1, '#475569');
    ctx.fillStyle = benchGrad;
    ctx.fillRect(benchX, benchY, benchW, benchH);
    ctx.fillStyle = 'rgba(15,23,42,0.15)';
    ctx.fillRect(benchX + 3, benchY + benchH * 0.4, benchW - 6, benchH * 0.2);

    // Pulleys (Pulegge)
    const pR = toS(GEO.pulley.radius);
    [-600, 600].forEach(px => {
        const pcxLocal = toS(px);
        const pcyLocal = toS(-122.5);
        ctx.fillStyle = '#334155';
        ctx.beginPath(); ctx.arc(pcxLocal, pcyLocal, pR, 0, Math.PI*2); ctx.fill();
        ctx.strokeStyle = '#cbd5e1';
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.strokeStyle = 'rgba(255,255,255,0.15)';
        for (let a = 0; a < Math.PI * 2; a += Math.PI / 2) {
            ctx.beginPath(); ctx.moveTo(pcxLocal, pcyLocal); ctx.lineTo(pcxLocal + pR * Math.cos(a), pcyLocal + pR * Math.sin(a)); ctx.stroke();
        }
        ctx.fillStyle = '#0f172a';
        ctx.beginPath(); ctx.arc(pcxLocal, pcyLocal, pR * 0.3, 0, Math.PI*2); ctx.fill();
    });

    // Cinghia (Belt)
    function drawLocalBelt(rLocal) {
        const lx = toS(-600);
        const rx = toS(600);
        const ly = toS(-122.5);
        const r = toS(rLocal);
        ctx.beginPath();
        ctx.arc(lx, ly, r, -Math.PI/2, Math.PI/2, true);
        ctx.lineTo(rx, ly + r);
        ctx.arc(rx, ly, r, Math.PI/2, -Math.PI/2, true);
        ctx.closePath();
    }
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3;
    drawLocalBelt(40);
    ctx.stroke();
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 1.2;
    drawLocalBelt(42.5);
    ctx.stroke();

    // Pannello Legno Sopra Cinghia (Se il checkbox è attivo) - Spessore 40mm, posizionato sopra la cinghia rossa
    const woodPanelCheckbox = document.getElementById("carr-wood-panel-checkbox");
    if (!woodPanelCheckbox || woodPanelCheckbox.checked) {
        const pW = toS(800);
        const pH = toS(40);
        const pX = toS(-400);
        const pY = toS(-206.0); // appoggiato sulla sommità della cinghia rossa (-166.0 mm)

        const woodGrad = ctx.createLinearGradient(pX, pY, pX + pW, pY);
        woodGrad.addColorStop(0, '#e5c07b');
        woodGrad.addColorStop(0.5, '#ebd09f');
        woodGrad.addColorStop(1, '#cca359');
        ctx.fillStyle = woodGrad;
        roundRect(pX, pY, pW, pH, 3);
        ctx.fill();

        ctx.strokeStyle = 'rgba(139, 90, 43, 0.12)';
        ctx.lineWidth = 0.8;
        [0.2, 0.4, 0.6, 0.8].forEach(fy => {
            const gy = pY + pH * fy;
            ctx.beginPath();
            ctx.moveTo(pX + 3, gy);
            for (let cxLocal = pX + 10; cxLocal < pX + pW - 3; cxLocal += 20) {
                ctx.lineTo(cxLocal, gy + Math.sin(cxLocal * 0.03) * 1.0);
            }
            ctx.lineTo(pX + pW - 3, gy);
            ctx.stroke();
        });

        ctx.strokeStyle = '#cda160';
        ctx.lineWidth = 0.8;
        roundRect(pX, pY, pW, pH, 3);
        ctx.stroke();
    }

    // Profili di estremità
    const sSize = toS(GEO.endProfile.size);
    const sTop = toS(-162.5);
    // Destra
    const sRightOuter = toS(642.5);
    const sRightLeft = sRightOuter - sSize;
    const profileGradR = ctx.createLinearGradient(sRightLeft, sTop, sRightLeft + sSize, sTop + sSize);
    profileGradR.addColorStop(0, '#cbd5e1'); profileGradR.addColorStop(1, '#475569');
    ctx.fillStyle = profileGradR;
    ctx.fillRect(sRightLeft, sTop, sSize, sSize);
    ctx.strokeStyle = 'rgba(15,23,42,0.15)';
    ctx.lineWidth = 0.8;
    ctx.strokeRect(sRightLeft, sTop, sSize, sSize);
    // Sinistra
    const sLeftOuter = toS(-642.5);
    const sLeftRight = sLeftOuter + sSize;
    const profileGradL = ctx.createLinearGradient(sLeftOuter, sTop, sLeftOuter + sSize, sTop + sSize);
    profileGradL.addColorStop(0, '#cbd5e1'); profileGradL.addColorStop(1, '#475569');
    ctx.fillStyle = profileGradL;
    ctx.fillRect(sLeftOuter, sTop, sSize, sSize);
    ctx.strokeRect(sLeftOuter, sTop, sSize, sSize);

    // Battute d'allineamento
    const stopW = toS(GEO.stop.width);
    const stopH = toS(GEO.stop.height);
    const stopTop = toS(-192.5);
    // Destra
    const stopRightX = sRightOuter;
    const stopGradR = ctx.createLinearGradient(stopRightX, stopTop, stopRightX + stopW, stopTop + stopH);
    stopGradR.addColorStop(0, '#1e293b'); stopGradR.addColorStop(1, '#3b4b60');
    ctx.fillStyle = stopGradR;
    ctx.fillRect(stopRightX, stopTop, stopW, stopH);
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 0.8;
    ctx.strokeRect(stopRightX, stopTop, stopW, stopH);
    // Sinistra
    const stopLeftX = sLeftOuter - stopW;
    const stopGradL = ctx.createLinearGradient(stopLeftX, stopTop, stopLeftX + stopW, stopTop + stopH);
    stopGradL.addColorStop(0, '#1e293b'); stopGradL.addColorStop(1, '#3b4b60');
    ctx.fillStyle = stopGradL;
    ctx.fillRect(stopLeftX, stopTop, stopW, stopH);
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 0.8;
    ctx.strokeRect(stopLeftX, stopTop, stopW, stopH);

    ctx.restore();

    // 8. Mezzeria verticale tratteggiata
    ctx.save();
    ctx.strokeStyle = 'rgba(249, 115, 22, 0.12)';
    ctx.setLineDash([3, 3]);
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(rotCenterX, rotCenterY - toS(250));
    ctx.lineTo(rotCenterX, rotCenterY + toS(210));
    ctx.stroke();
    ctx.restore();

    // 9. Visualizzazione Quota Encoder HMI (copiata dallo stile delle Navette)
    drawEncoderHUD(15, 12, W - 30, 44, 'Encoder Asse Rotazione', `${rotVal.toFixed(1)}°`, '#34d399');
}
