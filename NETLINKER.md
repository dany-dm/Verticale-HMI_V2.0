# NetLinker TCP Socket API Protocol & Tag Registry

Questo documento descrive il protocollo di comunicazione TCP proprietario supportato da NetLinker e il registro dei tag/modbus configurato nel sistema.

## 1. Dettagli Connessione TCP
- **Host**: `0.0.0.0` (in ascolto su tutte le interfacce)
- **Porta**: `9000`
- **Delimitatore dei Comandi**: `\n (New Line)`
- **Timeout di Inattività**: `5 secondi` (la connessione viene chiusa dal server se non arrivano comandi entro questo intervallo)

## 2. Comandi del Protocollo TCP, Stdin e CLI

Ciascun comando deve essere inviato come stringa di testo codificata in `utf-8`. I delimitatori accettati sono il carattere di new-line `\n` per TCP e Stdin.

### 2.1. Separatore Multi-Comando
Se il client invia stringhe composte da più comandi separati dal punto e virgola (es. `write Navetta_04 CMD_Home 1; read_all Navetta_04`), NetLinker:
1. Divide i comandi eseguendo lo split sul carattere `;`.
2. Elabora ciascun comando sequenzialmente.
3. Unisce le singole risposte separandole con il carattere di nuova riga `\n`.

### 2.2. Regole di Formattazione dei Dati
* **Spazi nell'Uguale**: Nelle risposte a comandi di lettura (`read`, `read_all`, `read_template`), è tassativamente presente uno spazio prima e uno dopo il carattere `=`.  
  *Sintassi esatta*: `NomeMacchina.Parametro = Valore`
* **Rappresentazione dei Bit (Booleani)**: I valori binari/booleani (`True`/`False`) non vengono mai trasmessi como testo, ma vengono sempre convertiti e scritti come:
  * `1` per lo stato logico Alto (True)
  * `0` per lo stato logico Basso (False)  
  *Esempio*: `Navetta_04.Stato_Home_OK = 1`

### 2.3. Endianness e Word Order (Ordinamento dei Byte)
Per garantire la massima semplicità ed evitare configurazioni errate, NetLinker **non espone campi o parametri configurabili** per "Byte Order (Endian)" o "Word Order (Swap)". 
Il sistema applica rigidamente ed in modo uniforme la codifica standard Big Endian su tutti i dispositivi ed i registri a 32 bit:
* **Byte Order (Ordinamento Byte)**: `Big Endian` (byte più significativo per primo)
* **Word Order (Ordinamento Parola)**: `Big Endian` (parola a 16 bit più significativa per prima)

### 2.4. Elenco dei Comandi Implementati

* **`connect [NomeMacchina]`** / **`connect [NomeMacchina:TemplateID]`**
  * *Azione*: Attiva lo stato di connessione del polling per tutti i template della macchina (o per lo specifico template). Esegue una connessione di test immediata.
  * *Risposta*: `[NomeMacchina] connesso.` oppure `connessione fallita.` (o `[NomeMacchina:TemplateID] connesso.`).
* **`disconnect [NomeMacchina]`** / **`disconnect [NomeMacchina:TemplateID]`**
  * *Azione*: Disattiva lo stato di connessione del polling per la macchina o il template.
  * *Risposta*: `[NomeMacchina] disconnesso.` (o `[NomeMacchina:TemplateID] disconnesso.`).
* **`status`** / **`status [NomeMacchina]`** / **`status [NomeMacchina:TemplateID]`**
  * *Azione*: Mostra lo stato di connessione fisico ed amministrativo.
  * *Risposta senza argomento*: Elenca lo stato aggregato di tutte le macchine (una riga per ciascuna) preceduto dalle porte configurate del server:
    ```text
    web_port: 8080
    socket_port: 9000
    modbus_port: 502
    Navetta_02: connected
    Navetta_01: disconnected
    Carrello: connected
    ```
  * *Risposta con argomento*: `[NomeMacchina]: connected` (oppure `disconnected`) o il formato specifico del template `[NomeMacchina:TemplateID]: connected`.
* **`read [NomeMacchina] [Parametro]`**
  * *Azione*: Legge il valore del singolo parametro.
  * *Risposta*: `[NomeMacchina].[Parametro] = [Valore]` (con bit rappresentati come `1`/`0`).
* **`read_all [NomeMacchina]`**
  * *Azione*: Restituisce l'intero pacchetto dati memorizzato per la macchina.
  * *Risposta se online*: Stringa multiriga di variabili formate come `NomeMacchina.Parametro = Valore`.
  * *Risposta se offline/non trovata*: `[NomeMacchina]: disconnected or not found`
* **`read_template [NomeMacchina] [TemplateID]`**
  * *Azione*: Restituisce i soli parametri appartenenti al template specificato per quella macchina.
  * *Risposta se online*: Stringa multiriga di variabili.
  * *Risposta se offline/non trovata*: `[NomeMacchina:TemplateID]: disconnected or not found`
* **`write [NomeMacchina] [Parametro] [Valore]`**
  * *Azione*: Scrive il valore sul registro Modbus TCP del PLC. Accetta in modo flessibile per i bit/booleani sia `"1"`/`"true"` (True) sia `"0"`/`"false"` (False) (case-insensitive).
  * *Risposta*: `[NomeMacchina].[Parametro] scritto: [Valore]`
* **`reset`** / **`restart`**
  * *Azione*: Ricarica `config.json` e riavvia a caldo tutti i moduli di NetLinker (logger syslog, polling Modbus e server TCP).
  * *Risposta*: `reset completato.`
* **`poll [NomeMacchina] [TemplateID]`**
  * *Azione*: Forza una lettura immediata (on-demand) per lo specifico template della macchina, aggiornando il datastore.
  * *Risposta*: `Poll completato con successo per [NomeMacchina]:[TemplateID].` o messaggio di errore.
* **`shutdown`** / **`exit`**
  * *Azione*: Avvia la procedura di arresto controllato di tutti i servizi del server NetLinker e termina l'esecuzione.
  * *Risposta*: `shutdown avviato.`

---

## 3. Parametri di Avvio, Stdin Pipe e File di Stato

### 3.1. Parametri di Avvio (CLI)
L'applicazione supporta i seguenti parametri da riga di comando per personalizzare l'avvio o interrogare il servizio:
* `--port-modbus [PORT]`: Sovrascrive la porta del server Modbus TCP mostrata nel file di stato (default: 502).
* `--port-socket [PORT]`: Sovrascrive la porta del server TCP Socket (default: 9000).
* `--port-web [PORT]`: Sovrascrive la porta del server Web HMI/API (default: 8080).
* `--no-gui`: Avvia il server in modalità headless (senza aprire la finestra grafica di monitoraggio).
* `--query-status`: Esegue l'applicazione in modalità **messaggero CLI**. Questa opzione non avvia il server locale, ma tenta di connettersi via TCP socket al server NetLinker in esecuzione, invia il comando `status`, stampa la risposta su standard output ed esce immediatamente.

#### Esempi di utilizzo CLI:
1. **Avvio personalizzato del server**:
   ```bash
   # Avvia NetLinker configurando porte specifiche per modbus, socket e web HMI, senza interfaccia grafica
   python main.py --port-modbus 5020 --port-socket 9000 --port-web 8080 --no-gui
   ```
2. **Interrogazione rapida dello stato (Messaggero CLI)**:
   ```bash
   # Interroga lo stato del server locale in ascolto sulla porta socket 9000
   python main.py --query-status --port-socket 9000
   ```
   *Output atteso*:
   ```text
   web_port: 8080
   socket_port: 9000
   modbus_port: 5020
   Navetta_01: connected
   Navetta_02: disconnected
   Carrello: connected
   ```

### 3.2. Comunicazione Continua via Standard Pipes (Stdin / Stdout)
Quando NetLinker è avviato come server principale, rimane in ascolto costante su `sys.stdin` (standard input pipe) per ricevere ed elaborare comandi dinamici.
* **Funzionamento**: Ciascun comando inserito su stdin deve essere terminato con il carattere di new-line `\n`.
* **Parser condiviso**: Viene utilizzato lo stesso identico parser di comandi del server TCP Socket (supportando anche i comandi multipli separati da `;`).
* **Risposta**: Le risposte vengono scritte immediatamente su `sys.stdout` (standard output) e terminate con il delimitatore configurato.

#### Esempi di comunicazione tramite Pipe (Stdin/Stdout):
Un software di controllo madre può avviare NetLinker come sottoprocesso (es. in C#, Node.js, C++ o Python) e comunicare bidirezionalmente:

1. **Scrittura di un comando singolo**:
   * *Inviato su Stdin*: `read Navetta_02 Stato_Home_OK\n`
   * *Ricevuto su Stdout*: `Navetta_02.Stato_Home_OK = 1\n`
2. **Scrittura di comandi multipli concatenati**:
   * *Inviato su Stdin*: `write Navetta_02 CMD_Home 1; read Navetta_02 CMD_Home\n`
   * *Ricevuto su Stdout*: `Navetta_02.CMD_Home scritto: 1\nNavetta_02.CMD_Home = 1\n`
3. **Comando di Reset/Restart a caldo**:
   * *Inviato su Stdin*: `reset\n`
   * *Ricevuto su Stdout*: `reset completato.\n`
4. **Comando di Arresto Ordinato**:
   * *Inviato su Stdin*: `shutdown\n`
   * *Ricevuto su Stdout*: `shutdown avviato.\n` (il server interrompe tutti i cicli e termina con successo)urato.

### 3.3. File di Stato Condiviso (`netlinker_status.json`)
Ogni 2 secondi il programma scrive nella stessa directory dell'eseguibile il file `netlinker_status.json` con la struttura seguente:
```json
{
  "pid": 1234,
  "status": "running",
  "last_update": "2026-06-16 09:52:00",
  "configured_ports": {
    "modbus_tcp_server": 502,
    "socket_control_port": 9000,
    "compatibility_socket_port": 9001,
    "api_port": 8080
  },
  "connected_devices": ["Navetta_02", "Carrello"]
}
```
All'arresto dell'applicazione, il campo `"status"` viene aggiornato in `"stopped"`.

---

## 4. Registro dei Server, Template e Tag Modbus Configurati
I tag di NetLinker sono strutturati in modo gerarchico nel formato `[NomeMacchina].[TagPath]`. Di seguito l'elenco dei registri fisici Modbus TCP mappati per ciascun server.

### 3.1. Server: **Navetta_02** (`192.168.3.95:503`, Unit ID: 1)

#### Template Associato: **navetta**
- **Modalità**: `Ciclico`
- **Intervallo Polling**: `0.3s`
- **Timeout Connessione**: `2s`
- **Max Fallimenti Consecutivi**: `3`

| Tag Globale | Indirizzo Modbus | Tipo Registro | Tipo Dati | Scrivibile | Descrizione |
| --- | --- | --- | --- | --- | --- |
| `Navetta_02.Stato_Inverter_OK` | `0.0` | `holding` | `bit` | `No` | Stato Inverter OK |
| `Navetta_02.Stato_ComunicazioneRulliere` | `0.1` | `holding` | `bit` | `No` | Stato Comunicazione Rulliere |
| `Navetta_02.Stato_ComunicazioneCarrello` | `0.2` | `holding` | `bit` | `No` | Stato Comunicazione Carrello |
| `Navetta_02.Stato_X_Homed` | `0.8` | `holding` | `bit` | `No` | X Homed |
| `Navetta_02.Stato_Y_Homed` | `0.9` | `holding` | `bit` | `No` | Y Homed |
| `Navetta_02.Stato_Z_Homed` | `0.10` | `holding` | `bit` | `No` | Z Homed |
| `Navetta_02.Stato_Home_OK` | `0.11` | `holding` | `bit` | `No` | Home OK |
| `Navetta_02.Stato_Pick` | `0.12` | `holding` | `bit` | `No` | Stato Pick |
| `Navetta_02.Stato_Picked` | `0.13` | `holding` | `bit` | `No` | Stato Picked |
| `Navetta_02.Stato_Emergenza` | `0.14` | `holding` | `bit` | `No` | Stato Emergenza |
| `Navetta_02.Stato_Aria_OK` | `0.15` | `holding` | `bit` | `No` | Stato Aria OK |
| `Navetta_02.Encoder_X` | `1` | `holding` | `float32` | `No` | Encoder X |
| `Navetta_02.Encoder_Y1` | `3` | `holding` | `float32` | `No` | Encoder Y1 |
| `Navetta_02.Encoder_Y2` | `5` | `holding` | `float32` | `No` | Encoder Y2 |
| `Navetta_02.Encoder_Z` | `7` | `holding` | `float32` | `No` | Encoder Z |
| `Navetta_02.TabellaLavoro_Index` | `9` | `holding` | `int16` | `No` | Index Tabella Lavoro |
| `Navetta_02.CMD_Home` | `10` | `holding` | `int16` | `Sì` | CMD Home |
| `Navetta_02.CMD_EnableDrive` | `11` | `holding` | `int16` | `Sì` | CMD Enable Drive |
| `Navetta_02.Stato_EnableDrive` | `11.8` | `holding` | `bit` | `No` | Stato Enable Drive |
| `Navetta_02.CMD_Automatico` | `12` | `holding` | `int16` | `Sì` | CMD Automatico |
| `Navetta_02.Stato_Automatico` | `12.8` | `holding` | `bit` | `No` | Stato Automatico |
| `Navetta_02.CMD_Reset` | `13` | `holding` | `int16` | `Sì` | CMD Reset |
| `Navetta_02.Target_X` | `14` | `holding` | `float32` | `Sì` | GoTo X |
| `Navetta_02.CMD_GoToX` | `16` | `holding` | `int16` | `Sì` | CMD GoTo X |
| `Navetta_02.Stato_GoToX` | `16.9` | `holding` | `bit` | `No` | Stato GoTo X |
| `Navetta_02.Target_Z` | `17` | `holding` | `float32` | `Sì` | GoTo Z |
| `Navetta_02.CMD_GoToZ` | `19` | `holding` | `int16` | `Sì` | CMD GoTo Z |
| `Navetta_02.Stato_GoToZ` | `19.9` | `holding` | `bit` | `No` | Stato GoTo Z |
| `Navetta_02.CMD_MaintenancePosition` | `20` | `holding` | `int16` | `Sì` | CMD Maintenance Position |
| `Navetta_02.Stato_MaintenancePosition` | `20.8` | `holding` | `bit` | `No` | Stato Maintenance Position |
| `Navetta_02.CMD_StopAir` | `21` | `holding` | `int16` | `Sì` | CMD Stop Air |

### 3.1. Server: **Navetta_01** (`192.168.3.97:503`, Unit ID: 1)

#### Template Associato: **navetta**
- **Modalità**: `Ciclico`
- **Intervallo Polling**: `0.3s`
- **Timeout Connessione**: `2s`
- **Max Fallimenti Consecutivi**: `3`

| Tag Globale | Indirizzo Modbus | Tipo Registro | Tipo Dati | Scrivibile | Descrizione |
| --- | --- | --- | --- | --- | --- |
| `Navetta_01.Stato_Inverter_OK` | `0.0` | `holding` | `bit` | `No` | Stato Inverter OK |
| `Navetta_01.Stato_ComunicazioneRulliere` | `0.1` | `holding` | `bit` | `No` | Stato Comunicazione Rulliere |
| `Navetta_01.Stato_ComunicazioneCarrello` | `0.2` | `holding` | `bit` | `No` | Stato Comunicazione Carrello |
| `Navetta_01.Stato_X_Homed` | `0.8` | `holding` | `bit` | `No` | X Homed |
| `Navetta_01.Stato_Y_Homed` | `0.9` | `holding` | `bit` | `No` | Y Homed |
| `Navetta_01.Stato_Z_Homed` | `0.10` | `holding` | `bit` | `No` | Z Homed |
| `Navetta_01.Stato_Home_OK` | `0.11` | `holding` | `bit` | `No` | Home OK |
| `Navetta_01.Stato_Pick` | `0.12` | `holding` | `bit` | `No` | Stato Pick |
| `Navetta_01.Stato_Picked` | `0.13` | `holding` | `bit` | `No` | Stato Picked |
| `Navetta_01.Stato_Emergenza` | `0.14` | `holding` | `bit` | `No` | Stato Emergenza |
| `Navetta_01.Stato_Aria_OK` | `0.15` | `holding` | `bit` | `No` | Stato Aria OK |
| `Navetta_01.Encoder_X` | `1` | `holding` | `float32` | `No` | Encoder X |
| `Navetta_01.Encoder_Y1` | `3` | `holding` | `float32` | `No` | Encoder Y1 |
| `Navetta_01.Encoder_Y2` | `5` | `holding` | `float32` | `No` | Encoder Y2 |
| `Navetta_01.Encoder_Z` | `7` | `holding` | `float32` | `No` | Encoder Z |
| `Navetta_01.TabellaLavoro_Index` | `9` | `holding` | `int16` | `No` | Index Tabella Lavoro |
| `Navetta_01.CMD_Home` | `10` | `holding` | `int16` | `Sì` | CMD Home |
| `Navetta_01.CMD_EnableDrive` | `11` | `holding` | `int16` | `Sì` | CMD Enable Drive |
| `Navetta_01.Stato_EnableDrive` | `11.8` | `holding` | `bit` | `No` | Stato Enable Drive |
| `Navetta_01.CMD_Automatico` | `12` | `holding` | `int16` | `Sì` | CMD Automatico |
| `Navetta_01.Stato_Automatico` | `12.8` | `holding` | `bit` | `No` | Stato Automatico |
| `Navetta_01.CMD_Reset` | `13` | `holding` | `int16` | `Sì` | CMD Reset |
| `Navetta_01.Target_X` | `14` | `holding` | `float32` | `Sì` | GoTo X |
| `Navetta_01.CMD_GoToX` | `16` | `holding` | `int16` | `Sì` | CMD GoTo X |
| `Navetta_01.Stato_GoToX` | `16.9` | `holding` | `bit` | `No` | Stato GoTo X |
| `Navetta_01.Target_Z` | `17` | `holding` | `float32` | `Sì` | GoTo Z |
| `Navetta_01.CMD_GoToZ` | `19` | `holding` | `int16` | `Sì` | CMD GoTo Z |
| `Navetta_01.Stato_GoToZ` | `19.9` | `holding` | `bit` | `No` | Stato GoTo Z |
| `Navetta_01.CMD_MaintenancePosition` | `20` | `holding` | `int16` | `Sì` | CMD Maintenance Position |
| `Navetta_01.Stato_MaintenancePosition` | `20.8` | `holding` | `bit` | `No` | Stato Maintenance Position |
| `Navetta_01.CMD_StopAir` | `21` | `holding` | `int16` | `Sì` | CMD Stop Air |

### 3.1. Server: **Rulliere** (`192.168.7.8:506`, Unit ID: 1)

#### Template Associato: **rulliere**
- **Modalità**: `Ciclico`
- **Intervallo Polling**: `1s`
- **Timeout Connessione**: `2s`
- **Max Fallimenti Consecutivi**: `3`

| Tag Globale | Indirizzo Modbus | Tipo Registro | Tipo Dati | Scrivibile | Descrizione |
| --- | --- | --- | --- | --- | --- |
| `Rulliere.Stato_PannelloSuBiesse` | `3.8` | `holding` | `bit` | `No` | Stato Pannello Su Biesse |
| `Rulliere.Stato_PannelloSuR1` | `3.9` | `holding` | `bit` | `No` | Stato Pannello Su R1 |
| `Rulliere.Stato_PannelloSuR2` | `3.10` | `holding` | `bit` | `No` | Stato Pannello Su R2 |
| `Rulliere.Stato_Pick` | `14.8` | `holding` | `bit` | `No` | Stato Pick |
| `Rulliere.Stato_Picked` | `14.9` | `holding` | `bit` | `No` | Stato Picked |
| `Rulliere.Stato_Emergenza` | `14.10` | `holding` | `bit` | `No` | Stato Emergenza |
| `Rulliere.Stato_Aria_OK` | `14.11` | `holding` | `bit` | `No` | Stato Aria OK |
| `Rulliere.Stato_ComunicazioneCarrello` | `14.12` | `holding` | `bit` | `No` | Stato Comunicazione Carrello |
| `Rulliere.IndexTabellaLavoro` | `15` | `holding` | `int16` | `No` | Index Tabella Lavoro |
| `Rulliere.CMD_EnableDrive` | `16` | `holding` | `int16` | `Sì` | CMD Enable Drive |
| `Rulliere.Stato_EnableDrive` | `16.8` | `holding` | `bit` | `No` | Stato Enable Drive |
| `Rulliere.CMD_Automatico` | `17` | `holding` | `int16` | `Sì` | CMD Automatico |
| `Rulliere.Stato_Automatico` | `17.8` | `holding` | `bit` | `No` | Stato Automatico |
| `Rulliere.CMD_Reset` | `18` | `holding` | `int16` | `Sì` | CMD Reset |

### 3.1. Server: **Carrello** (`192.168.7.37:503`, Unit ID: 1)

#### Template Associato: **carrello**
- **Modalità**: `Ciclico`
- **Intervallo Polling**: `1s`
- **Timeout Connessione**: `2s`
- **Max Fallimenti Consecutivi**: `3`

| Tag Globale | Indirizzo Modbus | Tipo Registro | Tipo Dati | Scrivibile | Descrizione |
| --- | --- | --- | --- | --- | --- |
| `Carrello.Stato_ComunicazioneRulliere` | `0.0` | `holding` | `bit` | `No` | Stato Comunicazione Rulliere |
| `Carrello.Stato_ComunicazioneCaricatore` | `0.1` | `holding` | `bit` | `No` | Stato Comunicazione Caricatore |
| `Carrello.Stato_ComunicazioneNavette` | `0.2` | `holding` | `bit` | `No` | Stato Comunicazione Navette |
| `Carrello.Y_Homed` | `0.8` | `holding` | `bit` | `No` | Y Homed |
| `Carrello.Rotazione_Homed` | `0.9` | `holding` | `bit` | `No` | Rotazione Homed |
| `Carrello.Home_OK` | `0.10` | `holding` | `bit` | `No` | Home OK |
| `Carrello.Stato_Pick` | `0.11` | `holding` | `bit` | `No` | Stato Pick |
| `Carrello.Stato_Picked` | `0.12` | `holding` | `bit` | `No` | Stato Picked |
| `Carrello.Stato_Emergenza` | `0.13` | `holding` | `bit` | `No` | Stato Emergenza |
| `Carrello.Stato_Aria_OK` | `0.14` | `holding` | `bit` | `No` | Stato Aria OK |
| `Carrello.Stato_Inverter_OK` | `0.15` | `holding` | `bit` | `No` | Stato Inverter OK |
| `Carrello.Y_Encoder` | `1` | `holding` | `float32` | `No` | Y Encoder |
| `Carrello.Rotazione_Encoder` | `3` | `holding` | `float32` | `No` | Rotazione Encoder |
| `Carrello.IndexTabellaLavoro` | `5` | `holding` | `int16` | `No` | Index Tabella Lavoro |
| `Carrello.CMD_Home` | `6` | `holding` | `int16` | `Sì` | CMD Home |
| `Carrello.CMD_EnableDrive` | `7` | `holding` | `int16` | `Sì` | CMD Enable Drive |
| `Carrello.Stato_EnableDrive` | `7.8` | `holding` | `bit` | `No` | Stato Enable Drive |
| `Carrello.CMD_Automatico` | `8` | `holding` | `int16` | `Sì` | CMD Automatico |
| `Carrello.Stato_Automatico` | `8.8` | `holding` | `bit` | `No` | Stato Automatico |
| `Carrello.CMD_Reset` | `9` | `holding` | `int16` | `Sì` | CMD Reset |
| `Carrello.GoToY` | `10` | `holding` | `float32` | `Sì` | GoTo Y |
| `Carrello.CMD_GoToY` | `12` | `holding` | `int16` | `Sì` | CMD GoTo Y |
| `Carrello.Stato_GoToY` | `12.9` | `holding` | `bit` | `No` | Stato GoTo Y |
| `Carrello.GoToRotazione` | `13` | `holding` | `float32` | `Sì` | GoTo Rotazione |
| `Carrello.CMD_GoToRotazione` | `15` | `holding` | `int16` | `Sì` | CMD GoTo Rotazione |
| `Carrello.Stato_GoToRotazione` | `15.9` | `holding` | `bit` | `No` | Stato GoTo Rotazione |
| `Carrello.CMD_MaintenancePosition` | `16` | `holding` | `int16` | `Sì` | CMD Maintenance Position |
| `Carrello.Stato_MaintenancePosition` | `16.8` | `holding` | `bit` | `No` | Stato Maintenance Position |

### 3.1. Server: **Caricatore** (`192.168.7.11:503`, Unit ID: 1)

#### Template Associato: **caricatore**
- **Modalità**: `Ciclico`
- **Intervallo Polling**: `1s`
- **Timeout Connessione**: `2s`
- **Max Fallimenti Consecutivi**: `3`

| Tag Globale | Indirizzo Modbus | Tipo Registro | Tipo Dati | Scrivibile | Descrizione |
| --- | --- | --- | --- | --- | --- |
| `Caricatore.Stato_ComunicazioneRulliere` | `0.0` | `holding` | `bit` | `No` | Stato Comunicazione Rulliere |
| `Caricatore.Stato_ComunicazioneCarrello` | `0.1` | `holding` | `bit` | `No` | Stato Comunicazione Carrello |
| `Caricatore.Z_Homed` | `0.8` | `holding` | `bit` | `No` | Z Homed |
| `Caricatore.Rotazione_Homed` | `0.9` | `holding` | `bit` | `No` | Rotazione Homed |
| `Caricatore.Telaio_Homed` | `0.10` | `holding` | `bit` | `No` | Telaio Homed |
| `Caricatore.Home_OK` | `0.11` | `holding` | `bit` | `No` | Home OK |
| `Caricatore.Stato_Pick` | `0.12` | `holding` | `bit` | `No` | Stato Pick |
| `Caricatore.Stato_Picked` | `0.13` | `holding` | `bit` | `No` | Stato Picked |
| `Caricatore.Stato_Emergenza` | `0.14` | `holding` | `bit` | `No` | Stato Emergenza |
| `Caricatore.Stato_Aria_OK` | `0.15` | `holding` | `bit` | `No` | Stato Aria OK |
| `Caricatore.Z_Encoder` | `1` | `holding` | `float32` | `No` | Z Encoder |
| `Caricatore.Rotazione_Encoder` | `3` | `holding` | `float32` | `No` | Rotazione Encoder |
| `Caricatore.telaio_Encoder` | `5` | `holding` | `float32` | `No` | Telaio Encoder |
| `Caricatore.IndexTabellaLavoro` | `7` | `holding` | `int16` | `No` | Index Tabella Lavoro |
| `Caricatore.CMD_Home` | `8` | `holding` | `int16` | `Sì` | CMD Home |
| `Caricatore.CMD_EnableDrive` | `9` | `holding` | `int16` | `Sì` | CMD Enable Drive |
| `Caricatore.Stato_EnableDrive` | `9.9` | `holding` | `bit` | `No` | Stato Enable Drive |
| `Caricatore.CMD_Automatico` | `10` | `holding` | `int16` | `Sì` | CMD Automatico |
| `Caricatore.Stato_Automatico` | `10.8` | `holding` | `bit` | `No` | Stato Automatico |
| `Caricatore.CMD_Reset` | `11` | `holding` | `int16` | `Sì` | CMD Reset |
| `Caricatore.CMD_StopAir` | `12` | `holding` | `int16` | `Sì` | CMD Stop Air |

### 3.1. Server: **Navetta_03** (`192.168.3.93:502`, Unit ID: 1)

#### Template Associato: **navetta**
- **Modalità**: `Ciclico`
- **Intervallo Polling**: `1s`
- **Timeout Connessione**: `2s`
- **Max Fallimenti Consecutivi**: `3`

| Tag Globale | Indirizzo Modbus | Tipo Registro | Tipo Dati | Scrivibile | Descrizione |
| --- | --- | --- | --- | --- | --- |
| `Navetta_03.Stato_Inverter_OK` | `0.0` | `holding` | `bit` | `No` | Stato Inverter OK |
| `Navetta_03.Stato_ComunicazioneRulliere` | `0.1` | `holding` | `bit` | `No` | Stato Comunicazione Rulliere |
| `Navetta_03.Stato_ComunicazioneCarrello` | `0.2` | `holding` | `bit` | `No` | Stato Comunicazione Carrello |
| `Navetta_03.Stato_X_Homed` | `0.8` | `holding` | `bit` | `No` | X Homed |
| `Navetta_03.Stato_Y_Homed` | `0.9` | `holding` | `bit` | `No` | Y Homed |
| `Navetta_03.Stato_Z_Homed` | `0.10` | `holding` | `bit` | `No` | Z Homed |
| `Navetta_03.Stato_Home_OK` | `0.11` | `holding` | `bit` | `No` | Home OK |
| `Navetta_03.Stato_Pick` | `0.12` | `holding` | `bit` | `No` | Stato Pick |
| `Navetta_03.Stato_Picked` | `0.13` | `holding` | `bit` | `No` | Stato Picked |
| `Navetta_03.Stato_Emergenza` | `0.14` | `holding` | `bit` | `No` | Stato Emergenza |
| `Navetta_03.Stato_Aria_OK` | `0.15` | `holding` | `bit` | `No` | Stato Aria OK |
| `Navetta_03.Encoder_X` | `1` | `holding` | `float32` | `No` | Encoder X |
| `Navetta_03.Encoder_Y1` | `3` | `holding` | `float32` | `No` | Encoder Y1 |
| `Navetta_03.Encoder_Y2` | `5` | `holding` | `float32` | `No` | Encoder Y2 |
| `Navetta_03.Encoder_Z` | `7` | `holding` | `float32` | `No` | Encoder Z |
| `Navetta_03.TabellaLavoro_Index` | `9` | `holding` | `int16` | `No` | Index Tabella Lavoro |
| `Navetta_03.CMD_Home` | `10` | `holding` | `int16` | `Sì` | CMD Home |
| `Navetta_03.CMD_EnableDrive` | `11` | `holding` | `int16` | `Sì` | CMD Enable Drive |
| `Navetta_03.Stato_EnableDrive` | `11.8` | `holding` | `bit` | `No` | Stato Enable Drive |
| `Navetta_03.CMD_Automatico` | `12` | `holding` | `int16` | `Sì` | CMD Automatico |
| `Navetta_03.Stato_Automatico` | `12.8` | `holding` | `bit` | `No` | Stato Automatico |
| `Navetta_03.CMD_Reset` | `13` | `holding` | `int16` | `Sì` | CMD Reset |
| `Navetta_03.Target_X` | `14` | `holding` | `float32` | `Sì` | GoTo X |
| `Navetta_03.CMD_GoToX` | `16` | `holding` | `int16` | `Sì` | CMD GoTo X |
| `Navetta_03.Stato_GoToX` | `16.9` | `holding` | `bit` | `No` | Stato GoTo X |
| `Navetta_03.Target_Z` | `17` | `holding` | `float32` | `Sì` | GoTo Z |
| `Navetta_03.CMD_GoToZ` | `19` | `holding` | `int16` | `Sì` | CMD GoTo Z |
| `Navetta_03.Stato_GoToZ` | `19.9` | `holding` | `bit` | `No` | Stato GoTo Z |
| `Navetta_03.CMD_MaintenancePosition` | `20` | `holding` | `int16` | `Sì` | CMD Maintenance Position |
| `Navetta_03.Stato_MaintenancePosition` | `20.8` | `holding` | `bit` | `No` | Stato Maintenance Position |
| `Navetta_03.CMD_StopAir` | `21` | `holding` | `int16` | `Sì` | CMD Stop Air |

### 3.1. Server: **Navetta_04** (`192.168.3.91:503`, Unit ID: 1)

#### Template Associato: **navetta**
- **Modalità**: `Ciclico`
- **Intervallo Polling**: `0.3s`
- **Timeout Connessione**: `2s`
- **Max Fallimenti Consecutivi**: `3`

| Tag Globale | Indirizzo Modbus | Tipo Registro | Tipo Dati | Scrivibile | Descrizione |
| --- | --- | --- | --- | --- | --- |
| `Navetta_04.Stato_Inverter_OK` | `0.0` | `holding` | `bit` | `No` | Stato Inverter OK |
| `Navetta_04.Stato_ComunicazioneRulliere` | `0.1` | `holding` | `bit` | `No` | Stato Comunicazione Rulliere |
| `Navetta_04.Stato_ComunicazioneCarrello` | `0.2` | `holding` | `bit` | `No` | Stato Comunicazione Carrello |
| `Navetta_04.Stato_X_Homed` | `0.8` | `holding` | `bit` | `No` | X Homed |
| `Navetta_04.Stato_Y_Homed` | `0.9` | `holding` | `bit` | `No` | Y Homed |
| `Navetta_04.Stato_Z_Homed` | `0.10` | `holding` | `bit` | `No` | Z Homed |
| `Navetta_04.Stato_Home_OK` | `0.11` | `holding` | `bit` | `No` | Home OK |
| `Navetta_04.Stato_Pick` | `0.12` | `holding` | `bit` | `No` | Stato Pick |
| `Navetta_04.Stato_Picked` | `0.13` | `holding` | `bit` | `No` | Stato Picked |
| `Navetta_04.Stato_Emergenza` | `0.14` | `holding` | `bit` | `No` | Stato Emergenza |
| `Navetta_04.Stato_Aria_OK` | `0.15` | `holding` | `bit` | `No` | Stato Aria OK |
| `Navetta_04.Encoder_X` | `1` | `holding` | `float32` | `No` | Encoder X |
| `Navetta_04.Encoder_Y1` | `3` | `holding` | `float32` | `No` | Encoder Y1 |
| `Navetta_04.Encoder_Y2` | `5` | `holding` | `float32` | `No` | Encoder Y2 |
| `Navetta_04.Encoder_Z` | `7` | `holding` | `float32` | `No` | Encoder Z |
| `Navetta_04.TabellaLavoro_Index` | `9` | `holding` | `int16` | `No` | Index Tabella Lavoro |
| `Navetta_04.CMD_Home` | `10` | `holding` | `int16` | `Sì` | CMD Home |
| `Navetta_04.CMD_EnableDrive` | `11` | `holding` | `int16` | `Sì` | CMD Enable Drive |
| `Navetta_04.Stato_EnableDrive` | `11.8` | `holding` | `bit` | `No` | Stato Enable Drive |
| `Navetta_04.CMD_Automatico` | `12` | `holding` | `int16` | `Sì` | CMD Automatico |
| `Navetta_04.Stato_Automatico` | `12.8` | `holding` | `bit` | `No` | Stato Automatico |
| `Navetta_04.CMD_Reset` | `13` | `holding` | `int16` | `Sì` | CMD Reset |
| `Navetta_04.Target_X` | `14` | `holding` | `float32` | `Sì` | GoTo X |
| `Navetta_04.CMD_GoToX` | `16` | `holding` | `int16` | `Sì` | CMD GoTo X |
| `Navetta_04.Stato_GoToX` | `16.9` | `holding` | `bit` | `No` | Stato GoTo X |
| `Navetta_04.Target_Z` | `17` | `holding` | `float32` | `Sì` | GoTo Z |
| `Navetta_04.CMD_GoToZ` | `19` | `holding` | `int16` | `Sì` | CMD GoTo Z |
| `Navetta_04.Stato_GoToZ` | `19.9` | `holding` | `bit` | `No` | Stato GoTo Z |
| `Navetta_04.CMD_MaintenancePosition` | `20` | `holding` | `int16` | `Sì` | CMD Maintenance Position |
| `Navetta_04.Stato_MaintenancePosition` | `20.8` | `holding` | `bit` | `No` | Stato Maintenance Position |
| `Navetta_04.CMD_StopAir` | `21` | `holding` | `int16` | `Sì` | CMD Stop Air |

#### Template Associato: **tpl_1781456080355**
- **Modalità**: `Non-Ciclico (Su Richiesta / On-demand)`
- **Intervallo Polling**: `N/A (on-demand)`
- **Timeout Connessione**: `2s`
- **Max Fallimenti Consecutivi**: `3`

| Tag Globale | Indirizzo Modbus | Tipo Registro | Tipo Dati | Scrivibile | Descrizione |
| --- | --- | --- | --- | --- | --- |
| `Navetta_04.ID` | `88` | `holding` | `int32` | `Sì` | ID |
| `Navetta_04.Lunghezza` | `89` | `holding` | `int16` | `Sì` | Lunghezza |