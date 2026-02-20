#!/usr/bin/env python3
import os
import uuid
import json
from datetime import datetime
from pathlib import Path
from flask import Flask, request, jsonify, render_template, send_from_directory
from flask_cors import CORS
from werkzeug.utils import secure_filename
from b2sdk.v2 import InMemoryAccountInfo, B2Api
from dotenv import load_dotenv

# Cargar variables de entorno desde .env
load_dotenv()

app = Flask(__name__)
CORS(app)

# Configuración
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, 'data')
UPLOAD_FOLDER = os.path.join(BASE_DIR, 'uploads')
ALLOWED_EXTENSIONS = {'webp', 'jpg', 'jpeg', 'png', 'gif'}

# Crear directorios necesarios
os.makedirs(DATA_DIR, exist_ok=True)
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

# Configuración desde variables de entorno (con valores por defecto para desarrollo)
OUTPUT_JSON = os.getenv('OUTPUT_JSON_PATH', os.path.join(DATA_DIR, 'uploaded_images.json'))

# Configuración de Backblaze B2
B2_APPLICATION_KEY_ID = os.getenv('B2_APPLICATION_KEY_ID', '004342de23298e60000000008')
B2_APPLICATION_KEY = os.getenv('B2_APPLICATION_KEY', 'K004vxv230w3HCnvPNwX1MAu8YABxxY')
B2_BUCKET_NAME = os.getenv('B2_BUCKET_NAME', 'openlapimages')
B2_ENDPOINT = os.getenv('B2_ENDPOINT', 'https://f004.backblazeb2.com')
B2_PREFIX = os.getenv('B2_PREFIX', 'products')



def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def init_b2():
    """Inicializar conexión a Backblaze B2"""
    info = InMemoryAccountInfo()
    b2_api = B2Api(info)
    b2_api.authorize_account("production", B2_APPLICATION_KEY_ID, B2_APPLICATION_KEY)
    bucket = b2_api.get_bucket_by_name(B2_BUCKET_NAME)
    return bucket

def upload_to_b2(local_path, filename):
    """Subir archivo a Backblaze B2 y retornar URL pública"""
    bucket = init_b2()
    ext = Path(filename).suffix.lower()
    unique_id = uuid.uuid4().hex[:12]
    b2_filename = f"{B2_PREFIX}{Path(filename).stem}-{unique_id}{ext}"
    
    bucket.upload_local_file(
        local_file=str(local_path),
        file_name=b2_filename
    )
    
    public_url = f"{B2_ENDPOINT}/file/{B2_BUCKET_NAME}/{b2_filename}"
    return {
        "filename": filename,
        "url": public_url,
        "b2_filename": b2_filename
    }

def save_upload_record(record):
    """Guardar registro de subida en JSON"""
    data = {}
    if os.path.exists(OUTPUT_JSON):
        with open(OUTPUT_JSON, 'r', encoding='utf-8') as f:
            try:
                data = json.load(f)
            except json.JSONDecodeError:
                data = {}
    
    # Usar un identificador único para la imagen
    image_id = record['b2_filename']
    if 'web_uploads' not in data:
        data['web_uploads'] = {}
    
    data['web_uploads'][image_id] = {
        "filename": record['filename'],
        "url": record['url'],
        "timestamp": datetime.now().isoformat()
    }
    
    with open(OUTPUT_JSON, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    
    return record

def get_uploaded_images():
    """Obtener lista de imágenes subidas"""
    if not os.path.exists(OUTPUT_JSON):
        return []
    
    with open(OUTPUT_JSON, 'r', encoding='utf-8') as f:
        try:
            data = json.load(f)
            uploads = data.get('web_uploads', {})
            return list(uploads.values())
        except json.JSONDecodeError:
            return []

@app.route('/')
def index():
    """Página principal"""
    return render_template('index.html')

@app.route('/upload', methods=['POST'])
def upload_file():
    """Endpoint para subir imagen"""
    if 'file' not in request.files:
        return jsonify({"error": "No file part"}), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({"error": "No selected file"}), 400
    
    if not allowed_file(file.filename):
        return jsonify({"error": "File type not allowed"}), 400
    
    # Guardar archivo temporalmente
    filename = secure_filename(file.filename)
    temp_path = os.path.join(UPLOAD_FOLDER, filename)
    file.save(temp_path)
    
    try:
        # Subir a Backblaze B2
        result = upload_to_b2(temp_path, filename)
        # Guardar registro
        save_upload_record(result)
        
        # Eliminar archivo temporal
        os.remove(temp_path)
        
        return jsonify({
            "success": True,
            "message": "File uploaded successfully",
            "url": result['url'],
            "filename": result['filename']
        })
    except Exception as e:
        # Eliminar archivo temporal en caso de error
        if os.path.exists(temp_path):
            os.remove(temp_path)
        return jsonify({"error": str(e)}), 500

@app.route('/uploads', methods=['GET'])
def list_uploads():
    """Endpoint para listar imágenes subidas"""
    images = get_uploaded_images()
    return jsonify({"images": images})

@app.route('/static/<path:filename>')
def serve_static(filename):
    """Servir archivos estáticos"""
    return send_from_directory('static', filename)

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)