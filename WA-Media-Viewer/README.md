# DeepView - Media Viewer

Applicazione Flask + Single Page Application per indicizzare, visualizzare e gestire file multimediali da una cartella locale.

## Cosa fa il codice

`app.py` fornisce un servizio web che:

- Legge ricorsivamente tutti i file in una cartella media locale (`media_folder` di default o specificata tramite `MEDIA_ROOT`).
- Individua il tipo reale di ogni file usando `python-magic` e serve solo immagini, video e audio.
- Estrae i metadati EXIF per le immagini tramite `exifread`.
- Calcola un hash MD5 di ciascun file per supportare l'identificazione di duplicati e il confronto rapido.
- Genera miniature JPEG per le immagini via `Pillow` e le memorizza in cache in una cartella temporanea.
- Fornisce un endpoint di upload che salva file caricati in `media_folder` con nomi sanitizzati e risolve i conflitti sui nomi.
- Offre un endpoint per impostare dinamicamente la cartella radice media (`/api/set-root`) con normalizzazione dei percorsi Windows/WSL.
- Serve i file multimediali in sicurezza tramite `/media/<path>` evitando l'accesso a percorsi esterni.
- Gestisce richieste troppo grandi con un limite globale di 5 GB per richiesta.

## Funzionalità principali

- Scansione ricorsiva della cartella media
- Rilevamento MIME basato sui magic bytes
- Servizio di file statici e API JSON
- Miniature delle immagini con caching temporaneo
- Supporto upload di file multipli
- Protezione contro path traversal
- Estrazione metadati EXIF per immagini
- Configurazione della cartella media tramite variabile d'ambiente

## Endpoints disponibili

- `GET /` - Serve la SPA `static/index.html`
- `GET /api/media` - Restituisce l'elenco dei file multimediali trovati e la cartella root attiva
- `POST /api/set-root` - Imposta la cartella media di lavoro (payload JSON: `{ "root": "<percorso>" }`)
- `GET /media/<path:filename>` - Serve il file multimediale richiesto
- `POST /upload` - Carica file nella cartella `media_folder`
- `GET /thumb/<path:filename>` - Restituisce la miniatura JPEG di un file immagine

## Installazione

1. Installa le dipendenze:
   ```bash
   pip install -r requirements.txt
   ```

2. Prepara la cartella dei media:
   - Usa la cartella predefinita `media_folder/`
   - Oppure imposta `MEDIA_ROOT` prima di avviare l'app, ad esempio:
     ```bash
     export MEDIA_ROOT=/percorso/alla/cartella
     ```

3. Avvia l'applicazione:
   ```bash
   python app.py
   ```

4. Apri il browser su `http://localhost:5000`.

## Dipendenze

- Flask
- Pillow
- python-magic
- exifread

## Note

- La cartella delle miniature viene creata in una directory temporanea all'avvio e viene gestita automaticamente.
- L'endpoint `/upload` salva i file in `media_folder`, crea le cartelle necessarie e rinomina i file duplicati aggiungendo un suffisso numerico.
- Se la richiesta supera il limite di dimensione impostato, viene restituito un errore `413` con messaggio JSON.
