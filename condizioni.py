# condizioni.py

def valida_condizioni_navetta(dati_macchine, indice_navetta, comando):
    """
    Valida le condizioni per l'esecuzione di un comando su una Navetta (indice_navetta è 0-based).
    Esempio: indice_navetta = 0 -> Navetta_1
    """
    nome_macchina = f"Navetta_{indice_navetta + 1}"
    stato = dati_macchine.get(nome_macchina, {})
    tooltip = ""
    condizioni = []

    # Verifica se la comunicazione con la macchina è OK prima di tutto
    comunicazione_ok = stato.get("__comunicazione_ok__", False)

    if comando == "EnableInverter_ON":
        tooltip = "Pulsante per l'abilitazione di tutti gli inverter motori"
        condizioni = [
            ("Comunicazione OK", comunicazione_ok and stato.get("Stato_ComunicazioneRulliere", False) and stato.get("Stato_ComunicazioneCarrello", False)),
            ("Emergenze OK", not stato.get("Stato_Emergenza", True)),
            ("Aria OK", stato.get("Stato_Aria_OK", False)),
            ("Manuale", not stato.get("Stato_Automatico", True))
        ]
    elif comando == "EnableInverter_OFF":
        tooltip = "Pulsante per lo spegnimento di tutti gli inverter motori"
        condizioni = [
            ("Comunicazione OK", comunicazione_ok)
        ]
    elif comando == "CMD_Home":
        tooltip = "Pulsante per l'azzeramento di tutti gli assi"
        condizioni = [
            ("Comunicazione OK", comunicazione_ok and stato.get("Stato_ComunicazioneRulliere", False) and stato.get("Stato_ComunicazioneCarrello", False)),
            ("Emergenze OK", not stato.get("Stato_Emergenza", True)),
            ("Aria OK", stato.get("Stato_Aria_OK", False)),
            ("Manuale", not stato.get("Stato_Automatico", True)),
            ("Driver abilitati", stato.get("Stato_EnableDrive", False))
        ]
    elif comando == "Enable_Auto_ON":
        tooltip = "Pulsante per la messa in automatico della macchina"
        condizioni = [
            ("Comunicazione OK", comunicazione_ok and stato.get("Stato_ComunicazioneRulliere", False) and stato.get("Stato_ComunicazioneCarrello", False)),
            ("Emergenze OK", not stato.get("Stato_Emergenza", True)),
            ("Home OK", stato.get("Home_OK", False)), # Richiede home fatto
            ("Inverter OK", stato.get("Stato_Inverter_OK", False)),
            ("Driver abilitati", stato.get("Stato_EnableDrive", False)),
            ("Manutenzione disattivata", not stato.get("Stato_MaintenancePosition", False))
        ]
    elif comando == "Enable_Auto_OFF":
        tooltip = "Pulsante per la messa in manuale della macchina"
        condizioni = [
            ("Comunicazione OK", comunicazione_ok)
        ]
    elif comando == "MaintenancePosition_ON":
        tooltip = "Metti la macchina in posizione comoda per lavorare"
        condizioni = [
            ("Comunicazione OK", comunicazione_ok and stato.get("Stato_ComunicazioneRulliere", False) and stato.get("Stato_ComunicazioneCarrello", False)),
            ("Emergenze OK", not stato.get("Stato_Emergenza", True)),
            ("Home OK", stato.get("Home_OK", False)),
            ("Aria OK", stato.get("Stato_Aria_OK", False)),
            ("Inverter OK", stato.get("Stato_Inverter_OK", False)),
            ("Manuale", not stato.get("Stato_Automatico", True)),
            ("Driver abilitati", stato.get("Stato_EnableDrive", False)),
            ("Non in attesa lavoro", not stato.get("Stato_Pick", True)),
            ("Non in lavorazione", not stato.get("Stato_Picked", True))
        ]
    elif comando == "MaintenancePosition_OFF":
        tooltip = "Esci dalla modalità per manutenzione"
        condizioni = [
            ("Comunicazione OK", comunicazione_ok)
        ]
    elif comando == "CMD_StopAir":
        tooltip = "Ferma il soffio o il vuoto dalle ventose"
        condizioni = [
            ("Comunicazione OK", comunicazione_ok),
            ("Manuale", not stato.get("Stato_Automatico", True))
        ]
    elif comando == "CMD_Reset":
        tooltip = "Resetta tutte le operazioni ed, eventualmente, cancella l'attuale lavoro in corso"
        condizioni = [
            ("Comunicazione OK", comunicazione_ok),
            ("Manuale", not stato.get("Stato_Automatico", True))
        ]
    else:
        condizioni = [("Comando sconosciuto", False)]

    all_ok = all(ok for _, ok in condizioni) if condizioni else False
    return condizioni, all_ok, tooltip


def valida_condizioni_carrello(dati_macchine, indice_carrello, comando):
    """Valida le condizioni per il Carrello."""
    stato = dati_macchine.get("Carrello", {})
    tooltip = ""
    condizioni = []
    comunicazione_ok = stato.get("__comunicazione_ok__", False)

    if comando == "EnableInverter_ON":
        tooltip = "Pulsante per l'abilitazione di tutti gli inverter motori"
        condizioni = [
            ("Comunicazione OK", comunicazione_ok and stato.get("Stato_ComunicazioneRulliere", False) and stato.get("Stato_ComunicazioneCaricatore", False) and stato.get("Stato_ComunicazioneNavette", False)),
            ("Emergenze OK", not stato.get("Stato_Emergenza", True)),
            ("Aria OK", stato.get("Stato_Aria_OK", False)),
            ("Manuale", not stato.get("Stato_Automatico", True))
        ]
    elif comando == "EnableInverter_OFF":
        tooltip = "Pulsante per lo spegnimento di tutti gli inverter motori"
        condizioni = [
            ("Comunicazione OK", comunicazione_ok)
        ]
    elif comando == "CMD_Home":
        tooltip = "Pulsante per l'azzeramento di tutti gli assi"
        condizioni = [
            ("Comunicazione OK", comunicazione_ok and stato.get("Stato_ComunicazioneRulliere", False) and stato.get("Stato_ComunicazioneCaricatore", False) and stato.get("Stato_ComunicazioneNavette", False)),
            ("Emergenze OK", not stato.get("Stato_Emergenza", True)),
            ("Aria OK", stato.get("Stato_Aria_OK", False)),
            ("Manuale", not stato.get("Stato_Automatico", True)),
            ("Driver abilitati", stato.get("Stato_EnableDrive", False))
        ]
    elif comando == "Enable_Auto_ON":
        tooltip = "Pulsante per la messa in automatico della macchina"
        condizioni = [
            ("Comunicazione OK", comunicazione_ok and stato.get("Stato_ComunicazioneRulliere", False) and stato.get("Stato_ComunicazioneCaricatore", False) and stato.get("Stato_ComunicazioneNavette", False)),
            ("Emergenze OK", not stato.get("Stato_Emergenza", True)),
            ("Home OK", stato.get("Home_OK", False)),
            ("Inverter OK", stato.get("Stato_Inverter_OK", False)),
            ("Driver abilitati", stato.get("Stato_EnableDrive", False)),
            ("Manutenzione disattivata", not stato.get("Stato_MaintenancePosition", False))
        ]
    elif comando == "Enable_Auto_OFF":
        tooltip = "Pulsante per la messa in manuale della macchina"
        condizioni = [
            ("Comunicazione OK", comunicazione_ok)
        ]
    elif comando == "MaintenancePosition_ON":
        tooltip = "Metti la macchina in posizione comoda per lavorare"
        condizioni = [
            ("Comunicazione OK", comunicazione_ok and stato.get("Stato_ComunicazioneRulliere", False) and stato.get("Stato_ComunicazioneCaricatore", False) and stato.get("Stato_ComunicazioneNavette", False)),
            ("Emergenze OK", not stato.get("Stato_Emergenza", True)),
            ("Home OK", stato.get("Home_OK", False)),
            ("Aria OK", stato.get("Stato_Aria_OK", False)),
            ("Inverter OK", stato.get("Stato_Inverter_OK", False)),
            ("Manuale", not stato.get("Stato_Automatico", True)),
            ("Driver abilitati", stato.get("Stato_EnableDrive", False)),
            ("Non in attesa lavoro", not stato.get("Stato_Pick", True)),
            ("Non in lavorazione", not stato.get("Stato_Picked", True))
        ]
    elif comando == "MaintenancePosition_OFF":
        tooltip = "Esci dalla modalità per manutenzione"
        condizioni = [
            ("Comunicazione OK", comunicazione_ok)
        ]
    elif comando == "CMD_Reset":
        tooltip = "Resetta tutte le operazioni ed, eventualmente, cancella l'attuale lavoro in corso"
        condizioni = [
            ("Comunicazione OK", comunicazione_ok),
            ("Manuale", not stato.get("Stato_Automatico", True))
        ]
    else:
        condizioni = [("Comando sconosciuto", False)]

    all_ok = all(ok for _, ok in condizioni) if condizioni else False
    return condizioni, all_ok, tooltip


def valida_condizioni_caricatore(dati_macchine, indice_caricatore, comando):
    """Valida le condizioni per il Caricatore."""
    stato = dati_macchine.get("Caricatore", {})
    tooltip = ""
    condizioni = []
    comunicazione_ok = stato.get("__comunicazione_ok__", False)

    if comando == "EnableInverter_ON":
        tooltip = "Pulsante per l'abilitazione di tutti gli inverter motori"
        condizioni = [
            ("Comunicazione OK", comunicazione_ok and stato.get("Stato_ComunicazioneRulliere", False)),
            ("Emergenze OK", not stato.get("Stato_Emergenza", True)),
            ("Aria OK", stato.get("Stato_Aria_OK", False)),
            ("Manuale", not stato.get("Stato_Automatico", True))
        ]
    elif comando == "EnableInverter_OFF":
        tooltip = "Pulsante per lo spegnimento di tutti gli inverter motori"
        condizioni = [
            ("Comunicazione OK", comunicazione_ok)
        ]
    elif comando == "CMD_Home":
        tooltip = "Pulsante per l'azzeramento di tutti gli assi"
        condizioni = [
            ("Comunicazione OK", comunicazione_ok and stato.get("Stato_ComunicazioneRulliere", False)),
            ("Emergenze OK", not stato.get("Stato_Emergenza", True)),
            ("Aria OK", stato.get("Stato_Aria_OK", False)),
            ("Manuale", not stato.get("Stato_Automatico", True)),
            ("Driver abilitati", stato.get("Stato_EnableDrive", False))
        ]
    elif comando == "Enable_Auto_ON":
        tooltip = "Pulsante per la messa in automatico della macchina"
        condizioni = [
            ("Comunicazione OK", comunicazione_ok and stato.get("Stato_ComunicazioneRulliere", False)),
            ("Emergenze OK", not stato.get("Stato_Emergenza", True)),
            ("Home OK", stato.get("Home_OK", False)),
            ("Driver abilitati", stato.get("Stato_EnableDrive", False)),
            ("Manutenzione disattivata", not stato.get("Stato_MaintenancePosition", False))
        ]
    elif comando == "Enable_Auto_OFF":
        tooltip = "Pulsante per la messa in manuale della macchina"
        condizioni = [
            ("Comunicazione OK", comunicazione_ok)
        ]
    elif comando == "MaintenancePosition_ON":
        tooltip = "Metti la macchina in posizione comoda per lavorare"
        condizioni = [
            ("Comunicazione OK", comunicazione_ok and stato.get("Stato_ComunicazioneRulliere", False)),
            ("Emergenze OK", not stato.get("Stato_Emergenza", True)),
            ("Home OK", stato.get("Home_OK", False)),
            ("Aria OK", stato.get("Stato_Aria_OK", False)),
            ("Manuale", not stato.get("Stato_Automatico", True)),
            ("Driver abilitati", stato.get("Stato_EnableDrive", False)),
            ("Non in attesa lavoro", not stato.get("Stato_Pick", True)),
            ("Non in lavorazione", not stato.get("Stato_Picked", True))
        ]
    elif comando == "MaintenancePosition_OFF":
        tooltip = "Esci dalla modalità per manutenzione"
        condizioni = [
            ("Comunicazione OK", comunicazione_ok)
        ]
    elif comando == "CMD_Reset":
        tooltip = "Resetta tutte le operazioni ed, eventualmente, cancella l'attuale lavoro in corso"
        condizioni = [
            ("Comunicazione OK", comunicazione_ok),
            ("Manuale", not stato.get("Stato_Automatico", True))
        ]
    else:
        condizioni = [("Comando sconosciuto", False)]

    all_ok = all(ok for _, ok in condizioni) if condizioni else False
    return condizioni, all_ok, tooltip


def valida_condizioni_rulliere(dati_macchine, indice_rulliere, comando):
    """Valida le condizioni per le Rulliere."""
    stato = dati_macchine.get("Rulliere", {})
    tooltip = ""
    condizioni = []
    comunicazione_ok = stato.get("__comunicazione_ok__", False)

    if comando == "EnableInverter_ON":
        tooltip = "Pulsante per l'abilitazione di tutti gli inverter motori"
        condizioni = [
            ("Comunicazione OK", comunicazione_ok and stato.get("Stato_ComunicazioneCarrello", False)),
            ("Emergenze OK", not stato.get("Stato_Emergenza", True)),
            ("Aria OK", stato.get("Stato_Aria_OK", False)),
            ("Manuale", not stato.get("Stato_Automatico", True))
        ]
    elif comando == "EnableInverter_OFF":
        tooltip = "Pulsante per lo spegnimento di tutti gli inverter motori"
        condizioni = [
            ("Comunicazione OK", comunicazione_ok)
        ]
    elif comando == "CMD_Home":
        tooltip = "Pulsante per l'azzeramento di tutti gli assi"
        condizioni = [
            ("Comunicazione OK", comunicazione_ok and stato.get("Stato_ComunicazioneCarrello", False)),
            ("Emergenze OK", not stato.get("Stato_Emergenza", True)),
            ("Aria OK", stato.get("Stato_Aria_OK", False)),
            ("Manuale", not stato.get("Stato_Automatico", True))
        ]
    elif comando == "Enable_Auto_ON":
        tooltip = "Pulsante per la messa in automatico della macchina"
        condizioni = [
            ("Comunicazione OK", comunicazione_ok and stato.get("Stato_ComunicazioneCarrello", False)),
            ("Emergenze OK", not stato.get("Stato_Emergenza", True)),
            ("Aria OK", stato.get("Stato_Aria_OK", False)),
            ("Driver abilitati", stato.get("Stato_EnableDrive", False))
        ]
    elif comando == "Enable_Auto_OFF":
        tooltip = "Pulsante per la messa in manuale della macchina"
        condizioni = [
            ("Comunicazione OK", comunicazione_ok)
        ]
    elif comando == "CMD_Reset":
        tooltip = "Resetta tutte le operazioni ed, eventualmente, cancella l'attuale lavoro in corso"
        condizioni = [
            ("Comunicazione OK", comunicazione_ok),
            ("Manuale", not stato.get("Stato_Automatico", True))
        ]
    else:
        condizioni = [("Comando sconosciuto", False)]

    all_ok = all(ok for _, ok in condizioni) if condizioni else False
    return condizioni, all_ok, tooltip
