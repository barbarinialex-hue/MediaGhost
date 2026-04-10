# DeepView - Media Viewer

Una Single Page Application per indicizzare, identificare e visualizzare file multimediali corrotti o senza estensione da backup WhatsApp.

## Caratteristiche

- **Rilevamento tramite Magic Numbers**: Identifica il vero tipo di file basato sull'intestazione binaria.
- **Virtual File Server**: Serve file con MIME corretto.
- **Recursive Scanner**: Scansione profonda delle sottocartelle.
- **Generatore di Miniature**: Anteprime caching per performance.
- **Dashboard Adattiva**: Griglia dinamica.
- **Infinite Scrolling**: Caricamento progressivo.
- **Lightbox Multi-Formato**: Supporto immagini, video, audio.
- **Filtri Intelligenti**: Per tipo e data.
- **Auto-Renamer**: Rinomina file con estensione corretta.
- **Metadata Viewer**: Estrae EXIF.
- **Smart Export**: Copia organizzata.
- **Deduplicazione**: Identifica duplicati per hash.

## Installazione

1. Installa le dipendenze:
   ```
   pip install -r requirements.txt
   ```

2. Metti i tuoi media nella cartella `media_folder/`.

3. Avvia l'app:
   ```
   python app.py
   ```

4. Apri il browser su `http://localhost:5000`.

## Sicurezza

- Local-only: Nessun dato inviato a server esterni.
- Read-only: Legge senza modificare file originali.

## Roadmap

- Fase 1: Scanner e rilevamento tipi (✓)
- Fase 2: Server Flask con API JSON (✓)
- Fase 3: Frontend con griglia e visualizzazione (✓)
- Fase 4: Funzione Rinomina (in sviluppo)