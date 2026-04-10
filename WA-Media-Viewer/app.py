from flask import Flask, send_from_directory, jsonify, request
from werkzeug.utils import secure_filename
import os
import magic
from PIL import Image
import hashlib
import tempfile
import exifread

app = Flask(__name__, static_folder='static', static_url_path='')

# Cartella per miniature
THUMB_DIR = tempfile.mkdtemp()


def get_metadata(filepath):
    try:
        with open(filepath, 'rb') as f:
            tags = exifread.process_file(f)
            return {tag: str(value) for tag, value in tags.items()}
    except:
        return {}


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
                    media.append({
                        'path': filepath,
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
    media = scan_media_folder('media_folder')
    return jsonify(media)


@app.route('/media/<path:filename>')
def media(filename):
    return send_from_directory('media_folder', filename)


@app.route('/upload', methods=['POST'])
def upload_files():
    os.makedirs('media_folder', exist_ok=True)
    uploaded = []
    for file in request.files.getlist('files'):
        if file:
            filename = secure_filename(file.filename)
            if not filename:
                continue
            save_path = os.path.join('media_folder', filename)
            base, ext = os.path.splitext(filename)
            counter = 1
            while os.path.exists(save_path):
                filename = f"{base}_{counter}{ext}"
                save_path = os.path.join('media_folder', filename)
                counter += 1
            file.save(save_path)
            uploaded.append(filename)
    return jsonify({'success': True, 'uploaded': uploaded})


@app.route('/thumb/<path:filename>')
def thumb(filename):
    thumb_path = os.path.join(THUMB_DIR, filename + '.jpg')
    if not os.path.exists(thumb_path):
        original_path = os.path.join('media_folder', filename)
        if os.path.exists(original_path):
            try:
                img = Image.open(original_path)
                img.thumbnail((240, 240))
                img.save(thumb_path)
            except:
                pass
    return send_from_directory(THUMB_DIR, filename + '.jpg')


if __name__ == '__main__':
    app.run(debug=True)
