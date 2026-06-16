# condizioni.py
def valida_condizioni_navetta(dati_navetta, indice_navetta, comando):
    stato = dati_navetta.get(f"Navetta_{indice_navetta+1}", {})
    tooltip = ""
    condizioni = []

    if comando == "EnableInverter_ON":
        tooltip = "Pulsante per l'abilitazione di tutti gli inverter motori"
        condizioni = [
            ("Comunicazione OK", stato.get("Stato_ComunicazioneRulliere", False) and stato.get("Stato_ComunicazioneCarrello", False)),
            ("Emergenze OK", not stato.get("Stato_Emergenza", True)),
            ("Aria OK", stato.get("Stato_Aria_OK", False)),
            ("Manuale", not stato.get("Stato_Automatico", True))
        ]
    elif comando == "EnableInverter_OFF":
        tooltip = "Pulsante per lo spegnimento di tutti gli inverter motori"
        condizioni = [
            #("Comunicazione OK", stato.get("Stato_ComunicazioneRulliere", False) and stato.get("Stato_ComunicazioneCarrello", False)),
            #("Emergenze OK", not stato.get("Stato_Emergenza", True)),
            #("Aria OK", stato.get("Stato_Aria_OK", False))
        ]
    elif comando == "CMD_Home":
        tooltip = "Pulsante per l'azzeramento di tutti gli assi"
        condizioni = [
            ("Comunicazione OK", stato.get("Stato_ComunicazioneRulliere", False) and stato.get("Stato_ComunicazioneCarrello", False)),
            ("Emergenze OK", not stato.get("Stato_Emergenza", True)),
            ("Aria OK", stato.get("Stato_Aria_OK", False)),
            ("Manuale", not stato.get("Stato_Automatico", True)),
            ("Driver abilitati", stato.get("Stato_EnableDrive", False))
        ]
    elif comando == "Enable_Auto_ON":
        tooltip = "Pulsante per la messa in automatico della macchina"
        condizioni = [
            ("Comunicazione OK", stato.get("Stato_ComunicazioneRulliere", False) and stato.get("Stato_ComunicazioneCarrello", False)),
            ("Emergenze OK", not stato.get("Stato_Emergenza", True)),
            ("Home OK", stato.get("Home_OK", True)),
            ("Inverter OK", stato.get("Stato_Inverter_OK", False)),
            #("Manuale", not stato.get("Stato_Automatico", True)),
            #("Automatico", stato.get("Stato_Automatico", False)),
            ("Driver abilitati", stato.get("Stato_EnableDrive", False)),
            ("Maintenace_Position", not stato.get("Stato_MaintenancePosition", False))
        ]
    elif comando == "Enable_Auto_OFF":
        tooltip = "Pulsante per la messa in manuale della macchina"
        condizioni = [
            #("Comunicazione OK", stato.get("Stato_ComunicazioneRulliere", False) and stato.get("Stato_ComunicazioneCarrello", False)),
            #("Emergenze OK", not stato.get("Stato_Emergenza", True)),
            #("Home OK", stato.get("Home_OK", True)),
            #("Inverter OK", stato.get("Stato_Inverter_OK", False)),
            #("Manuale", not stato.get("Stato_Automatico", True)),
            #("Automatico", stato.get("Stato_Automatico", False)),
            #("Driver abilitati", stato.get("Stato_EnableDrive", False)),
            #("Maintenace_Position", not stato.get("Stato_MaintenancePosition", False))
        ]
    elif comando == "MaintenancePosition_ON":
        tooltip = "Metti la macchina in posizione comoda per lavorare"
        condizioni = [
            ("Comunicazione OK", stato.get("Stato_ComunicazioneRulliere", False) and stato.get("Stato_ComunicazioneCarrello", False)),
            ("Emergenze OK", not stato.get("Stato_Emergenza", True)),
            ("Home OK", stato.get("Home_OK", True)),
            ("Aria OK", stato.get("Stato_Aria_OK", False)),
            ("Inverter OK", stato.get("Stato_Inverter_OK", False)),
            ("Manuale", not stato.get("Stato_Automatico", True)),
            #("Automatico", stato.get("Stato_Automatico", False)),
            ("Driver abilitati", stato.get("Stato_EnableDrive", False)),
            #("Maintenace_Position", not stato.get("Stato_MaintenancePosition", False))
            ("Non in attesa lavoro", not stato.get("Stato_Pick", True)),
            ("Non in lavorazione", not stato.get("Stato_Picked", True))
        ]
    elif comando == "MaintenancePosition_OFF":
        tooltip = "Esci dalla modalità per manutenzione"
        condizioni = [
            #("Comunicazione OK", stato.get("Stato_ComunicazioneRulliere", False) and stato.get("Stato_ComunicazioneCarrello", False)),
            #("Emergenze OK", not stato.get("Stato_Emergenza", True)),
            #("Home OK", stato.get("Home_OK", True)),
            #("Aria OK", stato.get("Stato_Aria_OK", False)),
            #("Inverter OK", stato.get("Stato_Inverter_OK", False)),
            #("Manuale", not stato.get("Stato_Automatico", True)),
            #("Automatico", stato.get("Stato_Automatico", False)),
            #("Driver abilitati", stato.get("Stato_EnableDrive", False)),
            #("Maintenace_Position", not stato.get("Stato_MaintenancePosition", False))
        ]
    elif comando == "CMD_StopAir":
        tooltip = "Ferma il soffio o il vuoto dalle ventose"
        condizioni = [
            #("Comunicazione OK", stato.get("Stato_ComunicazioneRulliere", False) and stato.get("Stato_ComunicazioneCarrello", False)),
            #("Emergenze OK", not stato.get("Stato_Emergenza", True)),
            #("Home OK", stato.get("Home_OK", True)),
            #("Aria OK", stato.get("Stato_Aria_OK", False)),
            #("Inverter OK", stato.get("Stato_Inverter_OK", False)),
            ("Manuale", not stato.get("Stato_Automatico", True))
            #("Automatico", stato.get("Stato_Automatico", False)),
            #("Driver abilitati", stato.get("Stato_EnableDrive", False)),
            #("Maintenace_Position", not stato.get("Stato_MaintenancePosition", False))
        ]
    elif comando == "CMD_Reset":
        tooltip = "Resetta tutte le operazioni ed, eventualmente, cancella l'attuale lavoro in corso"
        condizioni = [
            #("Comunicazione OK", stato.get("Stato_ComunicazioneRulliere", False) and stato.get("Stato_ComunicazioneCarrello", False)),
            #("Emergenze OK", not stato.get("Stato_Emergenza", True)),
            #("Home OK", stato.get("Home_OK", True)),
            #("Aria OK", stato.get("Stato_Aria_OK", False)),
            #("Inverter OK", stato.get("Stato_Inverter_OK", False)),
            ("Manuale", not stato.get("Stato_Automatico", True))
            #("Automatico", stato.get("Stato_Automatico", False)),
            #("Driver abilitati", stato.get("Stato_EnableDrive", False)),
            #("Maintenace_Position", not stato.get("Stato_MaintenancePosition", False))
        ]
    # calcola esito globale
    all_ok = all(ok for _, ok in condizioni)
    return condizioni, all_ok, tooltip

    return condizioni, ok_globale


def valida_condizioni_carrello(dati_carrello, indice_carrello, comando):
    stato = dati_carrello.get("Carrello", {})
    tooltip = ""
    condizioni = []

    if comando == "EnableInverter_ON":
        tooltip = "Pulsante per l'abilitazione di tutti gli inverter motori"
        condizioni = [
            ("Comunicazione OK", stato.get("Stato_ComunicazioneRulliere", False) and stato.get("Stato_ComunicazioneCaricatore", False) and stato.get("Stato_ComunicazioneNavette", False)),
            ("Emergenze OK", not stato.get("Stato_Emergenza", True)),
            ("Aria OK", stato.get("Stato_Aria_OK", False)),
            ("Manuale", not stato.get("Stato_Automatico", True))
        ]
    elif comando == "EnableInverter_OFF":
        tooltip = "Pulsante per lo spegnimento di tutti gli inverter motori"
        condizioni = [
            #("Comunicazione OK", stato.get("Stato_ComunicazioneRulliere", False) and stato.get("Stato_ComunicazioneCaricatore", False) and stato.get("Stato_ComunicazioneNavette", False)),
            #("Emergenze OK", not stato.get("Stato_Emergenza", True)),
            #("Aria OK", stato.get("Stato_Aria_OK", False))
        ]
    elif comando == "CMD_Home":
        tooltip = "Pulsante per l'azzeramento di tutti gli assi"
        condizioni = [
            ("Comunicazione OK", stato.get("Stato_ComunicazioneRulliere", False) and stato.get("Stato_ComunicazioneCaricatore", False) and stato.get("Stato_ComunicazioneNavette", False)),
            ("Emergenze OK", not stato.get("Stato_Emergenza", True)),
            ("Aria OK", stato.get("Stato_Aria_OK", False)),
            ("Manuale", not stato.get("Stato_Automatico", True)),
            ("Driver abilitati", stato.get("Stato_EnableDrive", False))
        ]
    elif comando == "Enable_Auto_ON":
        tooltip = "Pulsante per la messa in automatico della macchina"
        condizioni = [
            ("Comunicazione OK", stato.get("Stato_ComunicazioneRulliere", False) and stato.get("Stato_ComunicazioneCaricatore", False) and stato.get("Stato_ComunicazioneNavette", False)),
            ("Emergenze OK", not stato.get("Stato_Emergenza", True)),
            ("Home OK", stato.get("Home_OK", True)),
            ("Inverter OK", stato.get("Stato_Inverter_OK", False)),
            #("Manuale", not stato.get("Stato_Automatico", True)),
            #("Automatico", stato.get("Stato_Automatico", False)),
            ("Driver abilitati", stato.get("Stato_EnableDrive", False)),
            ("Maintenace_Position", not stato.get("Stato_MaintenancePosition", False))
        ]
    elif comando == "Enable_Auto_OFF":
        tooltip = "Pulsante per la messa in manuale della macchina"
        condizioni = [
            #("Comunicazione OK", stato.get("Stato_ComunicazioneRulliere", False) and stato.get("Stato_ComunicazioneCaricatore", False) and stato.get("Stato_ComunicazioneNavette", False)),
            #("Emergenze OK", not stato.get("Stato_Emergenza", True)),
            #("Home OK", stato.get("Home_OK", True)),
            #("Inverter OK", stato.get("Stato_Inverter_OK", False)),
            #("Manuale", not stato.get("Stato_Automatico", True)),
            #("Automatico", stato.get("Stato_Automatico", False)),
            #("Driver abilitati", stato.get("Stato_EnableDrive", False)),
            #("Maintenace_Position", not stato.get("Stato_MaintenancePosition", False))
        ]
    elif comando == "MaintenancePosition_ON":
        tooltip = "Metti la macchina in posizione comoda per lavorare"
        condizioni = [
            ("Comunicazione OK", stato.get("Stato_ComunicazioneRulliere", False) and stato.get("Stato_ComunicazioneCaricatore", False) and stato.get("Stato_ComunicazioneNavette", False)),
            ("Emergenze OK", not stato.get("Stato_Emergenza", True)),
            ("Home OK", stato.get("Home_OK", True)),
            ("Aria OK", stato.get("Stato_Aria_OK", False)),
            ("Inverter OK", stato.get("Stato_Inverter_OK", False)),
            ("Manuale", not stato.get("Stato_Automatico", True)),
            #("Automatico", stato.get("Stato_Automatico", False)),
            ("Driver abilitati", stato.get("Stato_EnableDrive", False)),
            #("Maintenace_Position", not stato.get("Stato_MaintenancePosition", False))
            ("Non in attesa lavoro", not stato.get("Stato_Pick", True)),
            ("Non in lavorazione", not stato.get("Stato_Picked", True))
        ]
    elif comando == "MaintenancePosition_OFF":
        tooltip = "Esci dalla modalità per manutenzione"
        condizioni = [
            #("Comunicazione OK", stato.get("Stato_ComunicazioneRulliere", False) and stato.get("Stato_ComunicazioneCaricatore", False) and stato.get("Stato_ComunicazioneNavette", False)),
            #("Emergenze OK", not stato.get("Stato_Emergenza", True)),
            #("Home OK", stato.get("Home_OK", True)),
            #("Aria OK", stato.get("Stato_Aria_OK", False)),
            #("Inverter OK", stato.get("Stato_Inverter_OK", False)),
            #("Manuale", not stato.get("Stato_Automatico", True)),
            #("Automatico", stato.get("Stato_Automatico", False)),
            #("Driver abilitati", stato.get("Stato_EnableDrive", False)),
            #("Maintenace_Position", not stato.get("Stato_MaintenancePosition", False))
        ]
    elif comando == "CMD_Reset":
        tooltip = "Resetta tutte le operazioni ed, eventualmente, cancella l'attuale lavoro in corso"
        condizioni = [
            #("Comunicazione OK", stato.get("Stato_ComunicazioneRulliere", False) and stato.get("Stato_ComunicazioneCaricatore", False) and stato.get("Stato_ComunicazioneNavette", False)),
            #("Emergenze OK", not stato.get("Stato_Emergenza", True)),
            #("Home OK", stato.get("Home_OK", True)),
            #("Aria OK", stato.get("Stato_Aria_OK", False)),
            #("Inverter OK", stato.get("Stato_Inverter_OK", False)),
            ("Manuale", not stato.get("Stato_Automatico", True))
            #("Automatico", stato.get("Stato_Automatico", False)),
            #("Driver abilitati", stato.get("Stato_EnableDrive", False)),
            #("Maintenace_Position", not stato.get("Stato_MaintenancePosition", False))
        ]
    # calcola esito globale
    all_ok = all(ok for _, ok in condizioni)
    return condizioni, all_ok, tooltip

    return condizioni, ok_globale
    

def valida_condizioni_caricatore(dati_caricatore, indice_caricatore, comando):
    stato = dati_caricatore.get("Caricatore", {})
    tooltip = ""
    condizioni = []

    if comando == "EnableInverter_ON":
        tooltip = "Pulsante per l'abilitazione di tutti gli inverter motori"
        condizioni = [
            ("Comunicazione OK", stato.get("Stato_ComunicazioneRulliere", False)),
            ("Emergenze OK", not stato.get("Stato_Emergenza", True)),
            ("Aria OK", stato.get("Stato_Aria_OK", False)),
            ("Manuale", not stato.get("Stato_Automatico", True))
        ]
    elif comando == "EnableInverter_OFF":
        tooltip = "Pulsante per lo spegnimento di tutti gli inverter motori"
        condizioni = [
            #("Comunicazione OK", stato.get("Stato_ComunicazioneRulliere", False)),
            #("Emergenze OK", not stato.get("Stato_Emergenza", True)),
            #("Aria OK", stato.get("Stato_Aria_OK", False))
        ]
    elif comando == "CMD_Home":
        tooltip = "Pulsante per l'azzeramento di tutti gli assi"
        condizioni = [
            ("Comunicazione OK", stato.get("Stato_ComunicazioneRulliere", False)),
            ("Emergenze OK", not stato.get("Stato_Emergenza", True)),
            #("Inverter OK", stato.get("Stato_Inverter_OK", False)),
            ("Aria OK", stato.get("Stato_Aria_OK", False)),
            ("Manuale", not stato.get("Stato_Automatico", True)),
            ("Driver abilitati", stato.get("Stato_EnableDrive", False))
        ]
    elif comando == "Enable_Auto_ON":
        tooltip = "Pulsante per la messa in automatico della macchina"
        condizioni = [
            ("Comunicazione OK", stato.get("Stato_ComunicazioneRulliere", False)),
            ("Emergenze OK", not stato.get("Stato_Emergenza", True)),
            ("Home OK", stato.get("Home_OK", True)),
            #("Inverter OK", stato.get("Stato_Inverter_OK", False)),
            #("Manuale", not stato.get("Stato_Automatico", True)),
            #("Automatico", stato.get("Stato_Automatico", False)),
            ("Driver abilitati", stato.get("Stato_EnableDrive", False)),
            ("Maintenace_Position", not stato.get("Stato_MaintenancePosition", False))
        ]
    elif comando == "Enable_Auto_OFF":
        tooltip = "Pulsante per la messa in manuale della macchina"
        condizioni = [
            #("Comunicazione OK", stato.get("Stato_ComunicazioneRulliere", False)),
            #("Emergenze OK", not stato.get("Stato_Emergenza", True)),
            #("Home OK", stato.get("Home_OK", True)),
            #("Inverter OK", stato.get("Stato_Inverter_OK", False)),
            #("Manuale", not stato.get("Stato_Automatico", True)),
            #("Automatico", stato.get("Stato_Automatico", False)),
            #("Driver abilitati", stato.get("Stato_EnableDrive", False)),
            #("Maintenace_Position", not stato.get("Stato_MaintenancePosition", False))
        ]
    elif comando == "MaintenancePosition_ON":
        tooltip = "Metti la macchina in posizione comoda per lavorare"
        condizioni = [
            ("Comunicazione OK", stato.get("Stato_ComunicazioneRulliere", False)),
            ("Emergenze OK", not stato.get("Stato_Emergenza", True)),
            ("Home OK", stato.get("Home_OK", True)),
            ("Aria OK", stato.get("Stato_Aria_OK", False)),
            #("Inverter OK", stato.get("Stato_Inverter_OK", False)),
            ("Manuale", not stato.get("Stato_Automatico", True)),
            #("Automatico", stato.get("Stato_Automatico", False)),
            ("Driver abilitati", stato.get("Stato_EnableDrive", False)),
            #("Maintenace_Position", not stato.get("Stato_MaintenancePosition", False))
            ("Non in attesa lavoro", not stato.get("Stato_Pick", True)),
            ("Non in lavorazione", not stato.get("Stato_Picked", True))
        ]
    elif comando == "MaintenancePosition_OFF":
        tooltip = "Esci dalla modalità per manutenzione"
        condizioni = [
            #("Comunicazione OK", stato.get("Stato_ComunicazioneRulliere", False)),
            #("Emergenze OK", not stato.get("Stato_Emergenza", True)),
            #("Home OK", stato.get("Home_OK", True)),
            #("Aria OK", stato.get("Stato_Aria_OK", False)),
            #("Inverter OK", stato.get("Stato_Inverter_OK", False)),
            #("Manuale", not stato.get("Stato_Automatico", True)),
            #("Automatico", stato.get("Stato_Automatico", False)),
            #("Driver abilitati", stato.get("Stato_EnableDrive", False)),
            #("Maintenace_Position", not stato.get("Stato_MaintenancePosition", False))
        ]
    elif comando == "CMD_Reset":
        tooltip = "Resetta tutte le operazioni ed, eventualmente, cancella l'attuale lavoro in corso"
        condizioni = [
            #("Comunicazione OK", stato.get("Stato_ComunicazioneRulliere", False)),
            #("Emergenze OK", not stato.get("Stato_Emergenza", True)),
            #("Home OK", stato.get("Home_OK", True)),
            #("Aria OK", stato.get("Stato_Aria_OK", False)),
            #("Inverter OK", stato.get("Stato_Inverter_OK", False)),
            ("Manuale", not stato.get("Stato_Automatico", True))
            #("Automatico", stato.get("Stato_Automatico", False)),
            #("Driver abilitati", stato.get("Stato_EnableDrive", False)),
            #("Maintenace_Position", not stato.get("Stato_MaintenancePosition", False))
        ]
    # calcola esito globale
    all_ok = all(ok for _, ok in condizioni)
    return condizioni, all_ok, tooltip

    return condizioni, ok_globale

def valida_condizioni_rulliere(dati_rulliere, indice_rulliere, comando):
    stato = dati_rulliere.get("Rulliere", {})
    tooltip = ""
    condizioni = []

    if comando == "EnableInverter_ON":
        tooltip = "Pulsante per l'abilitazione di tutti gli inverter motori"
        condizioni = [
            ("Comunicazione OK", stato.get("Stato_ComunicazioneCarrello", False)),
            ("Emergenze OK", not stato.get("Stato_Emergenza", True)),
            ("Aria OK", stato.get("Stato_Aria_OK", False)),
            ("Manuale", not stato.get("Stato_Automatico", True))
        ]
    elif comando == "EnableInverter_OFF":
        tooltip = "Pulsante per lo spegnimento di tutti gli inverter motori"
        condizioni = [
            #("Comunicazione OK", stato.get("Stato_ComunicazioneCarrello", False)),
            #("Emergenze OK", not stato.get("Stato_Emergenza", True)),
            #("Aria OK", stato.get("Stato_Aria_OK", False))
        ]
    elif comando == "CMD_Home":
        tooltip = "Pulsante per l'azzeramento di tutti gli assi"
        condizioni = [
            ("Comunicazione OK", stato.get("Stato_ComunicazioneCarrello", False)),
            ("Emergenze OK", not stato.get("Stato_Emergenza", True)),
            ("Aria OK", stato.get("Stato_Aria_OK", False)),
            ("Manuale", not stato.get("Stato_Automatico", True))
            #("Driver abilitati", stato.get("Stato_EnableDrive", False))
        ]
    elif comando == "Enable_Auto_ON":
        tooltip = "Pulsante per la messa in automatico della macchina"
        condizioni = [
            ("Comunicazione OK", stato.get("Stato_ComunicazioneCarrello", False)),
            ("Emergenze OK", not stato.get("Stato_Emergenza", True)),
            ("Aria OK", stato.get("Stato_Aria_OK", False)),
            #("Home OK", stato.get("Home_OK", True)),
            #("Inverter OK", stato.get("Stato_Inverter_OK", False)),
            #("Manuale", not stato.get("Stato_Automatico", True)),
            #("Automatico", stato.get("Stato_Automatico", False)),
            ("Driver abilitati", stato.get("Stato_EnableDrive", False))            
        ]
    elif comando == "Enable_Auto_OFF":
        tooltip = "Pulsante per la messa in manuale della macchina"
        condizioni = [
            #("Comunicazione OK", stato.get("Stato_ComunicazioneCarrello", False)),
            #("Emergenze OK", not stato.get("Stato_Emergenza", True)),
            #("Home OK", stato.get("Home_OK", True)),
            #("Inverter OK", stato.get("Stato_Inverter_OK", False)),
            #("Manuale", not stato.get("Stato_Automatico", True)),
            #("Automatico", stato.get("Stato_Automatico", False)),
            #("Driver abilitati", stato.get("Stato_EnableDrive", False)),
            
        ]
    elif comando == "CMD_Reset":
        tooltip = "Resetta tutte le operazioni ed, eventualmente, cancella l'attuale lavoro in corso"
        condizioni = [
            #("Comunicazione OK", stato.get("Stato_ComunicazioneCarrello", False)),
            #("Emergenze OK", not stato.get("Stato_Emergenza", True)),
            #("Home OK", stato.get("Home_OK", True)),
            #("Aria OK", stato.get("Stato_Aria_OK", False)),
            #("Inverter OK", stato.get("Stato_Inverter_OK", False)),
            ("Manuale", not stato.get("Stato_Automatico", True))
            #("Automatico", stato.get("Stato_Automatico", False)),
            #("Driver abilitati", stato.get("Stato_EnableDrive", False)),
            #("Maintenace_Position", not stato.get("Stato_MaintenancePosition", False))
        ]
    # calcola esito globale
    all_ok = all(ok for _, ok in condizioni)
    return condizioni, all_ok, tooltip

    return condizioni, ok_globale