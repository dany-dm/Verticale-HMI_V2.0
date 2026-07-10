# Documentazione Modifiche Concordate HMI v2.0.16

Questo documento descrive in dettaglio tutte le specifiche, la logica di business e le modifiche al codice concordate ed effettuate per la versione **v2.0.16** dell'HMI. In caso di perdita delle modifiche dovuta a sovrascritture di altri agenti, questa guida permette di ricostruire ogni funzionalità in modo esatto.

---

## Indice delle Funzionalità
1. [Dati Commessa Sempre Visibili (Persistent Comanda Details)](#1-dati-commessa-sempre-visibili-persistent-comanda-details)
2. [Doppio Click per Apertura Form Modifica (Double-Click Triggers)](#2-doppio-click-per-apertura-form-modifica-double-click-triggers)
3. [Costanti di Configurazione Navette (Settings Constants)](#3-costanti-di-configurazione-navette-settings-constants)
4. [Integrazione Caricatore (Loader Integration)](#4-integrazione-caricatore-loader-integration)
5. [Stati e Colori Dinamici dei Singoli Step (Machine Step Status & Colors)](#5-stati-e-colori-dinamici-dei-singoli-step-machine-step-status--colors)
6. [Stato Globale della Commessa (Overall Commessa Status)](#6-stato-globale-della-commessa-overall-commessa-status)
7. [Come Ripristinare la Versione Stabile](#7-come-ripristinare-la-versione-stabile)

---

## 1. Dati Commessa Sempre Visibili (Persistent Comanda Details)
* **File modificati**: `web/app.js`, `web/style.css`
* **Logica**: Nelle 4 schede macchina (*Carrello*, *Caricatore*, *Rulliere*, *Navette*), i riquadri contenenti i "Dati Commessa" devono mostrare sempre i dettagli dell'ultimo lavoro (o i registri correnti del PLC) anche quando il dispositivo non è attivo in lavorazione (`inLavoro === false`).
* **Dettagli Implementativi**:
  * La funzione `aggiornaDatiCommessaMacchina(macchinaPrefix, data, inLavoro)` è stata modificata per non nascondere più il frame della commessa.
  * Se `inLavoro` è `false`, viene aggiunta la classe CSS `.inactive-commessa` al frame.
  * Sopra i dati storici viene mostrato un banner/header di separazione con la scritta *"Nessun lavoro in corso"*.
* **CSS** (`web/style.css`):
  ```css
  .inactive-commessa {
      opacity: 0.5 !important;
      background: rgba(15, 23, 42, 0.4) !important;
      pointer-events: none;
  }
  ```

---

## 2. Doppio Click per Apertura Form Modifica (Double-Click Triggers)
* **File modificati**: `web/app.js`
* **Logica**: Il doppio click permette all'operatore di aprire direttamente il modale di modifica commessa pre-compilando lo slot corrente del macchinario, a patto che la sicurezza dei comandi avanzati sia attiva.
* **Condizioni**:
  * Funziona solo se `#switch-attiva-comandi-avanzati` è **attivo (ON)**.
  * Se l'interruttore è **spento (OFF)**, il doppio click sul sinottico mantiene il comportamento standard (reindirizzamento alla scheda HMI del macchinario).
* **Elementi associati**:
  * Elementi grafici SVG del Sinottico 2D (`#carr-group`, `#car-group`, `#rul-group`, e ciascuno dei 10 `#navette-group`).
  * I frame dei box `Dati Commessa` di ciascuna macchina (`#frame-carr-commessa`, `#frame-car-commessa`, `#frame-rul-commessa`, `#frame-nav-commessa`).
* **Codice JavaScript**:
  ```javascript
  // Esempio per il Carrello nel Sinottico 2D
  carrGroup.addEventListener("dblclick", (e) => {
      const sw = document.getElementById("switch-attiva-comandi-avanzati");
      if (sw && sw.checked) {
          e.stopPropagation();
          const activeIdx = Number(currentStates.Carrello?.IndexTabellaLavoro) || 1;
          openCommessaModal(activeIdx);
      } else {
          switchTab('panel-carrello');
      }
  });
  ```

---

## 3. Costanti di Configurazione Navette (Settings Constants)
* **File modificati**: `web/app.js`, `web/index.html`
* **Logica**: Nella scheda delle impostazioni (Settings), sotto l'intestazione di ciascuna navetta, devono essere visualizzate in sola lettura le costanti calcolate $Y_{101}$ a $Y_{120}$ ($Posizione Y \pm Distanza$).
* **Correzione**: Questi campi devono mostrare il loro valore numerico intero fisso (es. `101`, `102` per la navetta 1; `103`, `104` per la navetta 2, ecc.) e non la coordinata fisica ricalcolata in millimetri.

---

## 4. Integrazione Caricatore (Loader Integration)
* **File modificati**: `scratch/mock_netlinker.py`, `web/index.html`, `web/app.js`
* **Logica**: Il Caricatore deve essere pienamente integrato nella gestione delle commesse.
* **Passi**:
  1. **Registri PLC Mock** (`scratch/mock_netlinker.py`): aggiunti `TabellaXX_Working_Caricatore` e `TabellaXX_Done_Caricatore` (con XX da 01 a 06) al dizionario dei registri del simulatore.
  2. **Interfaccia Modale** (`web/index.html`): aggiunti due checkbox nel modale dettagli:
     * `<input type="checkbox" id="mod-job-work-car">` (working Caricatore)
     * `<input type="checkbox" id="mod-job-done-car">` (done caricatore)
  3. **Lettura e Scrittura** (`web/app.js`):
     * Mappati i checkbox in `openCommessaModal()`, `resetCommessaEdit()` e `saveCommessaEdit()`.
     * Inserite le chiavi `TabellaXX_Working_Caricatore` e `TabellaXX_Done_Caricatore` nel payload POST inviato a `/api/write_bulk`.
  4. **Badge di Step**:
     * Inserito lo step badge `"Caricatore"` in `tabella commesse` e `coda lavorazione`.
     * **Nota importante**: lo step badge della **Stampante** deve essere visibile **solo nella tabella commesse**, mentre viene escluso/nascosto dalla coda di lavorazione.

---

## 5. Stati e Colori Dinamici dei Singoli Step (Machine Step Status & Colors)
* **File modificati**: `web/app.js`
* **Logica**: Lo stato di ciascuna macchina all'interno di una commessa è determinato rigorosamente dalle coppie `Working` ($W$) e `Done` ($D$):
  * **Non necessaria** ($W == false$, $D == true$): Lo step badge viene disabilitato e sbiadito (opacità 30%, bordo tratteggiato, transform `scale(1)` fisso). Anche le caselle di spunta (checkbox) del modale dettagli per quella macchina vengono disabilitate e la loro opacità impostata a `0.25` (tramite la funzione `applyModalCheckboxesLogic`).
  * **In lavorazione** ($W == true$, $D == false$): Lo step badge assume colore **Blu** (`var(--accent-blue)`).
  * **Finito** ($W == true$, $D == true$): Lo step badge assume colore **Verde** (`var(--accent-green)`).
  * **In attesa** ($W == false$, $D == false$): Lo step badge assume colore **Grigio** (`var(--text-muted)`).

* **Codice JavaScript** (`getMachineStepHTML`):
  ```javascript
  function getMachineStepHTML(label, isWorking, isDone) {
      if (!isWorking && isDone) {
          return `<span class="step-dot" title="${label}: Non necessaria" style="display: inline-block; font-size: 9px; font-weight: 700; padding: 2px 5px; border-radius: 4px; background: rgba(255,255,255,0.01); color: rgba(255,255,255,0.15); border: 1px dashed rgba(255,255,255,0.08); cursor: default; min-width: 20px; text-align: center; opacity: 0.3;">${label}</span>`;
      }

      let bg = "rgba(148, 163, 184, 0.15)";
      let fg = "var(--text-muted)";
      let border = "rgba(148, 163, 184, 0.3)";
      let title = "In attesa";

      if (isWorking && isDone) {
          bg = "rgba(16, 185, 129, 0.2)";
          fg = "var(--accent-green)";
          border = "var(--accent-green)";
          title = "Finito";
      } else if (isWorking && !isDone) {
          bg = "rgba(59, 130, 246, 0.2)";
          fg = "var(--accent-blue)";
          border = "var(--accent-blue)";
          title = "In lavorazione";
      }

      return `<span class="step-dot" title="${label}: ${title}" style="display: inline-block; font-size: 9px; font-weight: 700; padding: 2px 5px; border-radius: 4px; background: ${bg}; color: ${fg}; border: 1px solid ${border}; cursor: default; min-width: 20px; text-align: center;">${label}</span>`;
  }
  ```

---

## 6. Stato Globale della Commessa (Overall Commessa Status)
* **File modificati**: `web/app.js`
* **Logica**: Lo stato complessivo della commessa dipende dagli stati delle singole macchine coinvolte:
  1. **ESEGUITA** (Grigio): tutte le macchine sono in stato *Finito* (Verde) o *Non necessaria* (Disabilitate).
  2. **IN ATTESA** (Arancione): tutte le macchine sono in stato *Non necessaria* o *In attesa* (Grigie).
  3. **IN LAVORAZIONE** (Blu): almeno una macchina si trova in stato *In lavorazione* (Blu), oppure si è in una configurazione mista (es. alcune macchine hanno finito, altre sono in attesa, ma nessuna è attualmente in lavorazione attiva).
* **Dettagli Implementativi**:
  * Il colore della card (sfondo, bordo, e barra laterale indicatrice dello slot attivo) è impostato chiamando `getJobColoring(statoLabel)` passando direttamente la label calcolata (`"ESEGUITA"`, `"IN ATTESA"`, `"IN LAVORAZIONE"`).

---

## 7. Come Ripristinare la Versione Stabile

Se la cartella di lavoro è stata corrotta o sovrascritta da modifiche inconsistenti di un altro agente, segui questi passaggi tramite terminale per ripristinare lo stato stabile e pulito:

1. **Ripristino dei file modificati localmente**:
   ```bash
   git reset --hard d8ecaea
   ```
   *Nota: Il commit `d8ecaea` contiene la versione pulita, compilata e funzionante dell'HMI v2.0.16.*

2. **Verifica dello stato**:
   ```bash
   git status
   ```
   Dovrebbero essere presenti solo file temporanei non tracciati o script di scratch del tutto inoffensivi.

3. **Verifica della sintassi**:
   ```bash
   node -c web/app.js
   python -m py_compile scratch/mock_netlinker.py
   ```
