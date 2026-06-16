import tkinter as tk
from math import radians, sin, cos



def disegna_rulliera(canvas, cx, cy, lunghezza_mm=1000, larghezza_mm=4500, scala=0.1, num_rulli=15, angolo=0, colore="gray70"):
    diametro_rullo_mm = 50
    spalla_mm = 50
    if angolo == 45:
        offset_x = (lunghezza_mm/2 - larghezza_mm/2 - 300) * scala
        offset_y = 600 * scala
        cx = cx + offset_x
        cy = cy + offset_y
    if angolo == 90:
        offset_x = (lunghezza_mm/2 - larghezza_mm/2) * scala
        offset_y = (lunghezza_mm/2 - larghezza_mm/2 + 200) * scala
        cx = cx + offset_x
        cy = cy + offset_y

    lunghezza_px = lunghezza_mm * scala
    larghezza_px = larghezza_mm * scala
    spessore_sponda = spalla_mm * scala
    rullo_h = diametro_rullo_mm * scala

    def ruota_punto(x, y, gradi):
        rad = radians(gradi)
        cos_a = cos(rad)
        sin_a = sin(rad)
        x -= cx
        y -= cy
        xr = x * cos_a - y * sin_a + cx
        yr = x * sin_a + y * cos_a + cy
        return xr, yr

    def draw_rotated_rect(x0, y0, x1, y1, fill, outline="black", width=1):
        pts = [
            ruota_punto(x0, y0, angolo),
            ruota_punto(x1, y0, angolo),
            ruota_punto(x1, y1, angolo),
            ruota_punto(x0, y1, angolo),
        ]
        flat_pts = [coord for point in pts for coord in point]
        canvas.create_polygon(flat_pts, fill=fill, outline=outline, width=width)

    x0 = cx - larghezza_px / 2
    y0 = cy - lunghezza_px / 2
    x1 = cx + larghezza_px / 2
    y1 = cy + lunghezza_px / 2

    draw_rotated_rect(x0, y0 - spessore_sponda, x1, y0, fill="black")
    draw_rotated_rect(x0, y1, x1, y1 + spessore_sponda, fill="black")
    draw_rotated_rect(x0, y0, x1, y1, fill="", outline="black", width=2)

    spacing = lunghezza_px / (num_rulli + 1)
    for i in range(1, num_rulli + 1):
        cy_rullo = y0 + i * spacing
        draw_rotated_rect(
            x0 + larghezza_px * 0.05, cy_rullo - rullo_h / 2,
            x1 - larghezza_px * 0.05, cy_rullo + rullo_h / 2,
            fill=colore
        )

def disegna_cinghie(canvas, cx, cy, lunghezza_mm=1000, larghezza_mm=4500, scala=0.1, num_rulli=15, angolo=0, colore="red"):
    diametro_rullo_mm = 60
    spalla_mm = 50
    if angolo == 45:
        offset_x = (lunghezza_mm/2 - larghezza_mm/2 - 300) * scala
        offset_y = 600 * scala
        cx = cx + offset_x
        cy = cy + offset_y
    if angolo == 90:
        offset_x = (lunghezza_mm/2 - larghezza_mm/2) * scala
        offset_y = (lunghezza_mm/2 - larghezza_mm/2 + 200) * scala
        cx = cx + offset_x
        cy = cy + offset_y
        
    
    


    lunghezza_px = lunghezza_mm * scala
    larghezza_px = larghezza_mm * scala
    spessore_sponda = spalla_mm * scala
    rullo_h = diametro_rullo_mm * scala

    def ruota_punto(x, y, gradi):
        rad = radians(gradi)
        cos_a = cos(rad)
        sin_a = sin(rad)
        x -= cx
        y -= cy
        xr = x * cos_a - y * sin_a + cx
        yr = x * sin_a + y * cos_a + cy
        return xr, yr

    def draw_rotated_rect(x0, y0, x1, y1, fill, outline="black", width=1):
        pts = [
            ruota_punto(x0, y0, angolo),
            ruota_punto(x1, y0, angolo),
            ruota_punto(x1, y1, angolo),
            ruota_punto(x0, y1, angolo),
        ]
        flat_pts = [coord for point in pts for coord in point]
        canvas.create_polygon(flat_pts, fill=fill, outline=outline, width=width)

    x0 = cx - larghezza_px / 2
    y0 = cy - lunghezza_px / 2
    x1 = cx + larghezza_px / 2
    y1 = cy + lunghezza_px / 2

    #draw_rotated_rect(x0, y0 - spessore_sponda, x1, y0, fill="black")
    #draw_rotated_rect(x0, y1, x1, y1 + spessore_sponda, fill="black")
    #draw_rotated_rect(x0, y0, x1, y1, fill="", outline="black", width=2)

    spacing = lunghezza_px / (num_rulli + 1)
    for i in range(1, num_rulli + 1):
        cy_rullo = y0 + i * spacing
        draw_rotated_rect(
            x0 + larghezza_px * 0.05, cy_rullo - rullo_h / 2,
            x1 - larghezza_px * 0.05, cy_rullo + rullo_h / 2,
            fill="red"
        )

def disegna_carrello(canvas, cx, cy, lunghezza_mm=1000, larghezza_mm=4500, scala=0.1, num_rulli=15, angolo=0, colore="red"):
    diametro_rullo_mm = 60
    spalla_mm = 50
    if angolo == 45:
        offset_x = (lunghezza_mm/2 - larghezza_mm/2 - 300) * scala
        offset_y = 600 * scala
        cx = cx + offset_x
        cy = cy + offset_y
    if angolo == 90:
        offset_x = (lunghezza_mm/2 - larghezza_mm/2) * scala
        offset_y = (lunghezza_mm/2 - larghezza_mm/2 + 200) * scala
        cx = cx + offset_x
        cy = cy + offset_y


    lunghezza_px = lunghezza_mm * scala
    larghezza_px = larghezza_mm * scala
    spessore_sponda = spalla_mm * scala
    rullo_h = diametro_rullo_mm * scala

    def ruota_punto(x, y, gradi):
        rad = radians(gradi)
        cos_a = cos(rad)
        sin_a = sin(rad)
        x -= cx
        y -= cy
        xr = x * cos_a - y * sin_a + cx
        yr = x * sin_a + y * cos_a + cy
        return xr, yr

    def draw_rotated_rect(x0, y0, x1, y1, fill, outline="black", width=1):
        pts = [
            ruota_punto(x0, y0, angolo),
            ruota_punto(x1, y0, angolo),
            ruota_punto(x1, y1, angolo),
            ruota_punto(x0, y1, angolo),
        ]
        flat_pts = [coord for point in pts for coord in point]
        canvas.create_polygon(flat_pts, fill=fill, outline=outline, width=width)

    x0 = cx - larghezza_px / 2
    y0 = cy - lunghezza_px / 2
    x1 = cx + larghezza_px / 2
    y1 = cy + lunghezza_px / 2

    draw_rotated_rect(x0, y0 - spessore_sponda, x1, y0, fill="black")
    draw_rotated_rect(x0, y1, x1, y1 + spessore_sponda, fill="black")
    draw_rotated_rect(x0, y0, x1, y1, fill="", outline="black", width=2)

    spacing = lunghezza_px / (num_rulli + 1)
    for i in range(1, num_rulli + 1):
        cy_rullo = y0 + i * spacing
        draw_rotated_rect(
            x0 + larghezza_px * 0.05, cy_rullo - rullo_h / 2,
            x1 - larghezza_px * 0.05, cy_rullo + rullo_h / 2,
            fill="red",
            outline="red"
        )

def disegna_caricatore(canvas, cx, cy, scala, angolo_braccio=180):
    """
    Disegna un caricatore:
    - cerchio giallo centrale (500mm diametro)
    - braccio che ruota come una lancetta dell'orologio
    - rettangolo in fondo al braccio, inclinato di 45° rispetto al braccio
    """
    offset_angolo = 315
    # Diametri e lunghezza braccio in mm
    diametro_cerchio_mm = 500
    lunghezza_braccio_mm = 3000
    rett_lunghezza_mm = 4500
    rett_larghezza_mm = 500

    # Conversione in pixel
    raggio_px = (diametro_cerchio_mm / 2) * scala
    braccio_px = lunghezza_braccio_mm * scala
    rett_lunghezza_px = rett_lunghezza_mm * scala
    rett_larghezza_px = rett_larghezza_mm * scala

    # Disegna cerchio centrale
    canvas.create_oval(
        cx - raggio_px, cy - raggio_px,
        cx + raggio_px, cy + raggio_px,
        fill="yellow", outline="black", width=2
    )

    # Calcola fine braccio ruotato
    from math import radians, sin, cos
    angolo_rad = radians(offset_angolo - angolo_braccio)
    x_end = cx + braccio_px * sin(angolo_rad)
    y_end = cy - braccio_px * cos(angolo_rad)

    # Disegna braccio
    canvas.create_line(cx, cy, x_end, y_end, fill="grey70", width=4)

    # Calcola angolo totale rettangolo (braccio + 45°)
    angolo_rett = angolo_rad + radians(135)

    # Calcola i 4 vertici del rettangolo
    dx = rett_lunghezza_px / 2
    dy = rett_larghezza_px / 2

    # I 4 angoli relativi al centro rettangolo
    corner_offsets = [(-dx, -dy), (dx, -dy), (dx, dy), (-dx, dy)]

    pts = []
    for offset_x, offset_y in corner_offsets:
        # ruota offset di angolo_rett
        x_rot = offset_x * cos(angolo_rett) - offset_y * sin(angolo_rett)
        y_rot = offset_x * sin(angolo_rett) + offset_y * cos(angolo_rett)
        pts.append((x_end + x_rot, y_end + y_rot))

    flat_pts = [coord for point in pts for coord in point]

    # Disegna rettangolo ruotato
    canvas.create_polygon(flat_pts, fill="orange", outline="black", width=2)
