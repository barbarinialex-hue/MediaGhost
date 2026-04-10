from flask import Flask, send_from_directory, jsonify, request
from werkzeug.utils import secure_filename
import os
import re
import magic
from pathlib import Path
from PIL import Image
import hashlib
import tempfile
import exifread

app = Flask(__name__, static_folder='static', static_url_path='')
app.config['MAX_CONTENT_LENGTH'] = 5 * 1024 * 1024 * 1024  # 5 GB massimo per richiesta

media_root = os.environ.get('MEDIA_ROOT', 'media_folder')

# Cartella per miniature
THUMB_DIR = tempfile.mkdtemp()


def get_metadata(filepath):
    try:
        with open(filepath, 'rb') as f:
            tags = exifread.process_file(f)
            return {tag: str(value) for tag, value in tags.items()}
    except:
        return {}


def normalize_root_path(root):
    root = root.strip()
    if re.match(r'^[A-Za-z]:\\|^[A-Za-z]:/', root):
        drive = root[0].lower()
        path = root[2:].replace('\\', '/').replace('\\', '/')
        wsl_candidate = f'/mnt/{drive}{path}'
        if os.path.isdir(wsl_candidate):
            return os.path.abspath(wsl_candidate)

    candidate = root.replace('\\', '/')
    if os.path.isdir(candidate):
        return os.path.abspath(candidate)

    return None


def scan_media_folder(folder):
    os.makedirs(folder, exist_ok=True)
    media = []
    for root, dirs, files in os.walk(folder):
        for file in sorted(files):
            filepath = os.path.join(root, file)
            try:
                mime = magic.from_file(filepath, mime=True)
                if mime.startswith(('image/', 'video/', 'audio/')):
                    with open(filepath, 'rb') as f:
                        file_hash = hashlib.md5(f.read()).hexdigest()
                    metadata = get_metadata(filepath) if mime.startswith('image/') else {}
                    relative_path = os.path.relpath(filepath, folder).replace(os.sep, '/')
                    folder_path = os.path.dirname(relative_path).replace(os.sep, '/')
                    if folder_path == '.':
                        folder_path = ''
                    media.append({
                        'relative_path': relative_path,
                        'folder': folder_path,
                        'mime': mime,
                        'size': os.path.getsize(filepath),
                        'mtime': os.path.getmtime(filepath),
                        'hash': file_hash,
                        'filename': file,
                        'metadata': metadata
                    })
            except Exception as e:
                print(f"Errore su {filepath}: {e}")
    return sorted(media, key=lambda item: item['mtime'], reverse=True)


@app.route('/')
def index():
    return send_from_directory('static', 'index.html')


@app.route('/api/media')
def get_media():
    media = scan_media_folder(media_root)
    return jsonify({'media': media, 'root': os.path.abspath(media_root)})


@app.route('/api/set-root', methods=['POST'])
def set_media_root():
    global media_root
    data = request.get_json(silent=True) or {}
    root = data.get('root', '').strip()
    if not root:
        return jsonify({'success': False, 'error': 'Specifica un percorso di cartella valido.'}), 400

    normalized = normalize_root_path(root)
    if not normalized:
        return jsonify({'success': False, 'error': 'La cartella specificata non esiste o non è accessibile dall’ambiente server.'}), 400

    media_root = normalized
    return jsonify({'success': True, 'root': media_root})


@app.route('/media/<path:filename>')
def media(filename):
    safe_root = os.path.abspath(media_root)
    requested = os.path.abspath(os.path.join(safe_root, filename))
    if not requested.startswith(safe_root + os.sep) and requested != safe_root:
        return jsonify({'success': False, 'error': 'Accesso non consentito.'}), 403
    return send_from_directory(media_root, filename)


@app.route('/upload', methods=['POST'])
def upload_files():
    os.makedirs('media_folder', exist_ok=True)
    uploaded = []
    try:
        for file in request.files.getlist('files'):
            if file:
                original_name = file.filename or ''
                if not original_name:
                    continue
                path_parts = [secure_filename(part) for part in Path(original_name).parts if part]
                if not path_parts:
                    continue
                save_path = os.path.join('media_folder', *path_parts)
                os.makedirs(os.path.dirname(save_path), exist_ok=True)
                base, ext = os.path.splitext(path_parts[-1])
                counter = 1
                while os.path.exists(save_path):
                    path_parts[-1] = f"{base}_{counter}{ext}"
                    save_path = os.path.join('media_folder', *path_parts)
                    counter += 1
                file.save(save_path)
                uploaded.append('/'.join(path_parts))
        return jsonify({'success': True, 'uploaded': uploaded})
    except Exception as e:
        print(f"Upload failed: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/thumb/<path:filename>')
def thumb(filename):
    thumb_path = os.path.join(THUMB_DIR, filename + '.jpg')
    os.makedirs(os.path.dirname(thumb_path), exist_ok=True)
    if not os.path.exists(thumb_path):
        original_path = os.path.join(media_root, filename)
        if os.path.exists(original_path):
            try:
                img = Image.open(original_path)
                img.thumbnail((240, 240))
                img.save(thumb_path)
            except:
                pass
    return send_from_directory(THUMB_DIR, filename + '.jpg')


@app.errorhandler(413)
@app.errorhandler(413)
def request_entity_too_large(error):
    return jsonify({
        'success': False,
        'error': 'Richiesta troppo grande: riduci la dimensione totale dei file oppure carica meno file alla volta.'
    }), 413


if __name__ == '__main__':
    app.run(debug=True)
