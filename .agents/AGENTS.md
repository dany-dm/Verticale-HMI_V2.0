# Verticale-HMI V2.0 - Business Logic & System Reference

> [!IMPORTANT]
> **AI Instruction**: Any AI agent working on this repository MUST keep this file updated if HMI-PLC variables, communication protocols, or business logic are modified.

---

## 1. Network & Protocol Reference (NetLinker)

The HMI communicates with the NetLinker TCP interface. Below are the protocols and syntax rules for manually interacting with the simulator or testing via Telnet.

* **Server Port**: `127.0.0.1:9000` (Socket TCP)
* **Command Format**: Semicolon-separated (`;`) commands. Individual commands are space-separated:
  `[command] [machine] [parameter] [value]`

### Command Reference:
* **Read state**: `read_all [machine]` (e.g., `read_all Navetta_1`)
* **Write state**: `write [machine] [parameter] [value]`
  * Multiple writes: `write Rulliere Tabella02_ID 1002; write Rulliere Tabella02_NewDatas 1`
  * Booleans: Accepts `1`/`0`, `true`/`false`, or signed decimal values.

---

## 2. Advanced Shuttle Commands (Comandi Avanzati)

Manual one-shot commands are written to the PLC using signed 16-bit integers:
* **Activate command**: Write `-1` (`16#FFFF`)
* **Deactivate command**: Write `-513` (`16#FDFF` represented as signed decimal) or `32767` (`16#7FFF`)
* **Manual Mode Constraint**: The advanced command switch (`#switch-attiva-comandi-avanzati`) and status buttons must only be interactive when:
  * The selected shuttle is in Manual Mode (`!Stato_Automatico`).
  * The switch is toggled ON by the operator.
* **Auto-Reset Behavior**: When the user switches between shuttles or navigates to another HMI tab, the advanced commands switch must automatically toggle to **OFF**.

---

## 3. Job Scheduling (Tabella Commesse) Logic

Jobs (Commesse) contain coordinates (`FromX`, `FromY`, `ToX`, `ToY`). The system determines which machinery is involved in a job based on these coordinates.

### Machine Involvement Rules:
Let **`constant y101`** be the coordinate threshold configuration for the first shuttle (found in HMI Settings, typically representing the numerical value `101`).

1. **Navetta (Shuttle) Involvement**:
   * Involved if `FromY >= y101` and/or `ToY >= y101` (where comparison is done numerically, e.g., value `>= 101`).
2. **Caso 5 (Double Shuttle Cycle)**:
   * Triggers if `FromY != ToY` AND both `FromY >= y101` and `ToY >= y101`.
3. **Carrello (Carriage) Involvement**:
   * Involved if `FromY != ToY`.
4. **Caricatore (Loader) Involvement**:
   * Involved if `FromY == 1` and/or `ToY == 1`.
5. **Rulliera R1 (Roller Conveyor 1) Involvement**:
   * Involved if `FromY == 0` and/or `ToY == 0`.
6. **Rulliera R2 (Roller Conveyor 2) Involvement**:
   * Involved if `(FromY == 0 AND FromX != 1)` and/or `ToY == 0`.

### Specific Job Scenarios (Casi di Commesse):
* **Caso 3 (Prelievo da altra navetta/macchina)**:
  * Si verifica quando la navetta attiva deve prelevare un pannello che non si trova sulle sue spalle (ossia `FromY` non coincide con le spalle `y(2N-1)` o `y(2N)` della navetta `N`). Ad esempio, per la Navetta 1 (spalle `{101, 102}`), è Caso 3 se `FromY !== 101 && FromY !== 102`.
* **Caso 4 (Deposito su altra navetta/macchina)**:
  * Si verifica quando la navetta attiva deve depositare un pannello in una destinazione che non si trova sulle sue spalle (ossia `ToY` non coincide con le spalle `y(2N-1)` o `y(2N)` della navetta `N`). Ad esempio, per la Navetta 1 (spalle `{101, 102}`), è Caso 4 se `ToY !== 101 && ToY !== 102`.
* **Caso 5 (Ciclo doppio stessa navetta)**:
  * Si verifica quando la stessa navetta deve eseguire sia il prelievo che il deposito sulle proprie spalle (ossia `FromY !== ToY` ma entrambi appartengono alle spalle della stessa navetta `N`). Ad esempio, per la Navetta 1, se `FromY` e `ToY` appartengono a `{101, 102}` ma sono diversi.

---

## 4. Identifying Involved Shuttles

Shuttles are mapped to specific numerical coordinate constants representing their physical destination positions:
* **Shuttle 1**: Mapped to constants `y101` (value `101`) and `y102` (value `102`).
* **Shuttle 2**: Mapped to constants `y103` (value `103`) and `y104` (value `104`).
* **Shuttle N**: Mapped to constants `y(2N-1)` (value `2N-1 + 100`) and `y(2N)` (value `2N + 100`) up to Shuttle 10.

Since the coordinates `FromY` and `ToY` are numerical values, HMI checks compare coordinate values directly against these numerical thresholds.

### When Caso 5 is FALSE:
* A single shuttle is involved.
* **Shuttle 1**: Involved if `FromY` or `ToY` belongs to `{101, 102}`.
* **Shuttle 2**: Involved if `FromY` or `ToY` belongs to `{103, 104}`.
* ...up to Shuttle 10 (value threshold `{119, 120}`).

### When Caso 5 is TRUE (Two Shuttles required):
* We calculate the **First Operation Shuttle** (pickup phase) using `FromY`.
* We calculate the **Second Operation Shuttle** (placement phase) using `ToY`.

#### First Operation Shuttle (Pickup):
* **Shuttle 1**: If `FromY` is `101` or `102`.
* **Shuttle 2**: If `FromY` is `103` or `104`.
* ...up to Shuttle 10.

#### Second Operation Shuttle (Placement):
* **Shuttle 1**: If `ToY` is `101` or `102`.
* **Shuttle 2**: If `ToY` is `103` or `104`.
* ...up to Shuttle 10.

---

## 5. Sinottico 2D Rendering & Tooltips

### Flow Animations:
* **Animated Flow Arrows**: On all active flow paths (Shuttles, Carriage, and Loader), the flow direction is indicated by **6 animated arrows** moving sequentially along the path, spaced at `0.5s` intervals (`dur="3s"` with `begin` offsets of `0s`, `0.5s`, `1s`, `1.5s`, `2s`, `2.5s`) for smooth, premium visual cues.

### Coordinate Mapping & Overrides:
* **Shuttles (Navette)**: 
  * If a shuttle is involved in a job and is actively working on it (`Stato_Picked` is true), it draws its departure and arrival dots.
  * **Shoulder Board Panels**: The panel on the left shoulder is displayed when `Stato_Y2_PannelloPreso` is active, and the panel on the right shoulder is displayed when `Stato_Y1_PannelloPreso` is active.
  * **Caso 3**: If the job is a pickup from another shuttle (i.e. `FromY` does not belong to the shuttle's shoulders), `FromX` is overridden to `1080` (exchange level).
  * **Caso 4**: If the job is a drop-off to another shuttle (i.e. `ToY` does not belong to the shuttle's shoulders), `ToX` is overridden to `1080` (exchange level).
  * **Caso 5**: If a shuttle does a double transfer on its own shoulders, it is split into two visual job steps. Step 1 draws a green path (pickup to exchange at `ToX=1080` and `ToY=FromY` on shoulder) if `caso5PrimaParte` is active, and orange otherwise. Step 2 draws the rest.
* **Carriage (Carrello)**:
  * The carriage comanda is retrieved using the `carrState` keys fallback (since the PLC returns `comanda_*` instead of `carrello_comanda_*` in the live API).
  * If the carriage is actively working on a job (`Stato_Picked` is true), the carriage's dots and flow line are drawn at a single horizontal line positioned vertically at `yCarriage - 1000` mm (about `72.1px` on the screen) to avoid overlapping.
  * **Wood Panel**: A wood textured panel (`#carr-wood-panel`) measuring `29.5px` by `85.5px` (representing `800mm` by `4200mm`) is always drawn centered on the carriage (`(0, 95)` in local coordinates, overlaying the carriage body). Its width is dynamically adjusted based on `Carrello.Rotazione_Encoder` to simulate perspective/tilt: if the rotation is negative, the width reduces and the left edge stays fixed at `-14.8px`. If the rotation is positive, the width reduces and the right edge stays fixed at `14.8px`.
  * The horizontal X pixels of all coordinates are calculated using physical Y coordinates in mm:
    * **Rollers (`Y = 0`)**: `-1500` mm.
    * **Loader (`Y = 1`)**: `config.caricatore.posizione_y` (default `2000` mm).
    * **Shuttles (`Y >= 101`)**: `yNav - dist` (right shoulder, odd Y) or `yNav + dist` (left shoulder, even Y).
    * Formula: `xPixel = 1100 - (Y_in_mm * scaleX)`.
* **Loader (Caricatore)**:
  * When the loader is actively working on a job (`Stato_Picked` is true), it draws a dashed arc path (`#car-flow-path`) centered at the base column with a radius equal to the arm length (`armLen`).
  * **Clockwise Rotation**: If `FromY == 1 && ToY != 1` (placement phase), the path goes from `7:30` (bottom-left, `135°`) to `10:30` (top-left, `225°`) with `sweep-flag = 1`.
  * **Counter-Clockwise Rotation**: If `ToY == 1 && FromY != 1` (pickup phase), the path goes from `10:30` (top-left, `225°`) to `7:30` (bottom-left, `135°`) with `sweep-flag = 0`.
  * Animated blue flow arrows and departure/arrival dots with custom tooltips are drawn at the endpoints of the arc.
  * **Wood Panel**: A wood textured panel (`#sin-caricatore-wood-panel`) measuring `154.7px` by `16.3px` (representing `4200mm` by `800mm`) is always drawn centered and directly under the frame (`y = -8.2` in local rotated coordinates, so it lies behind the frame and the suction cups) with `opacity = 0.6`, shifted `500mm` to the left.

### Custom Tooltips:
* The SVG layout implements a custom, instant-appearance HTML tooltip (`#hmi-svg-tooltip`) instead of the default browser `<title>` tags to eliminate the 1-second delay.
* The tooltips display the active comanda ID and coordinates depending on the type of dot:
  * **Partenza (From)**: `ID: [comanda_ID] - From: [From_X] / [From_Y] / [From_Z]`
  * **Arrivo (To)**: `ID: [comanda_ID] - To: [To_X] / [To_Y] / [To_Z]`
