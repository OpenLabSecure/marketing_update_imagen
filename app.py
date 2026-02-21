#!/usr/bin/env python3
import os
import uuid
import tempfile
from datetime import datetime
from pathlib import Path
from flask import Flask, request, jsonify, render_template, send_from_directory, session, redirect, url_for, abort
from flask_cors import CORS
from werkzeug.utils import secure_filename
from b2sdk.v2 import InMemoryAccountInfo, B2Api
from dotenv import load_dotenv

# Firebase imports
try:
    import firebase_admin
    from firebase_admin import credentials, firestore
    FIREBASE_AVAILABLE = True
except ImportError:
    FIREBASE_AVAILABLE = False

# Cargar variables de entorno desde .env
load_dotenv()

app = Flask(__name__)
# Configure CORS to allow B2 headers
CORS(app, supports_credentials=True, allow_headers=[
    'Content-Type', 'Authorization', 'X-Requested-With',
    'X-Bz-File-Name', 'X-Bz-Content-Sha1', 'Content-Length'
])
app.secret_key = os.getenv('SECRET_KEY', 'fallback-secret-key')
app.config['SESSION_COOKIE_SAMESITE'] = 'Lax'
app.config['SESSION_COOKIE_HTTPONLY'] = True
app.config['SESSION_COOKIE_SECURE'] = False  # Set to True in production with HTTPS
# Increase max file size to 200MB for image uploads
app.config['MAX_CONTENT_LENGTH'] = 200 * 1024 * 1024  # 200MB

# Configuración
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# Detect if running on Vercel
IS_VERCEL = os.getenv('VERCEL') == '1' or os.getenv('VERCEL_ENV') is not None

# Use /tmp for uploads on Vercel (ephemeral storage)
if IS_VERCEL:
    UPLOAD_FOLDER = '/tmp/uploads'
else:
    UPLOAD_FOLDER = os.path.join(BASE_DIR, 'uploads')

ALLOWED_EXTENSIONS = {'webp', 'jpg', 'jpeg', 'png', 'gif'}

# Crear directorios necesarios (only if not on Vercel or for /tmp)
try:
    os.makedirs(UPLOAD_FOLDER, exist_ok=True)
except OSError as e:
    print(f"Warning: Could not create directories: {e}")
    if IS_VERCEL:
        print("Vercel environment detected - using ephemeral /tmp storage")

# Firebase es el único almacenamiento - no hay JSON local

# Configuración de Backblaze B2
B2_APPLICATION_KEY_ID = os.getenv('B2_APPLICATION_KEY_ID', '004342de23298e60000000008')
B2_APPLICATION_KEY = os.getenv('B2_APPLICATION_KEY', 'K004vxv230w3HCnvPNwX1MAu8YABxxY')
B2_BUCKET_NAME = os.getenv('B2_BUCKET_NAME', 'openlapimages')
B2_ENDPOINT = os.getenv('B2_ENDPOINT', 'https://f004.backblazeb2.com')
B2_PREFIX = os.getenv('B2_PREFIX', 'products')

# Configuración de Firebase (obligatorio)
FIREBASE_PROJECT_ID = os.getenv('FIREBASE_PROJECT_ID')
FIREBASE_PRIVATE_KEY = os.getenv('FIREBASE_PRIVATE_KEY')
FIREBASE_CLIENT_EMAIL = os.getenv('FIREBASE_CLIENT_EMAIL')
FIREBASE_STORAGE_BUCKET = os.getenv('FIREBASE_STORAGE_BUCKET')

# Inicialización de Firebase Firestore
firestore_db = None
firestore_collection = None

def init_firebase():
    """Inicializar Firebase Firestore (obligatorio)"""
    global firestore_db, firestore_collection
    
    if not FIREBASE_AVAILABLE:
        raise RuntimeError("Firebase Admin SDK no está instalado. Ejecuta: pip install firebase-admin")
    
    # Verificar que todas las variables requeridas estén configuradas
    required_vars = {
        'FIREBASE_PROJECT_ID': FIREBASE_PROJECT_ID,
        'FIREBASE_PRIVATE_KEY': FIREBASE_PRIVATE_KEY,
        'FIREBASE_CLIENT_EMAIL': FIREBASE_CLIENT_EMAIL
    }
    
    missing_vars = [name for name, value in required_vars.items() if not value]
    if missing_vars:
        raise RuntimeError(
            f"Variables de entorno de Firebase no configuradas: {', '.join(missing_vars)}. "
            "Configúralas en el archivo .env"
        )
    
    try:
        # Reemplazar caracteres escapados en la clave privada (para variables de entorno)
        # FIREBASE_PRIVATE_KEY no es None gracias a la verificación anterior
        private_key = FIREBASE_PRIVATE_KEY.replace('\\n', '\n') if FIREBASE_PRIVATE_KEY else ''
        
        cred_dict = {
            "type": "service_account",
            "project_id": FIREBASE_PROJECT_ID,
            "private_key_id": None,
            "private_key": private_key,
            "client_email": FIREBASE_CLIENT_EMAIL,
            "client_id": None,
            "auth_uri": "https://accounts.google.com/o/oauth2/auth",
            "token_uri": "https://oauth2.googleapis.com/token",
            "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
            "client_x509_cert_url": None
        }
        
        # Inicializar Firebase solo si no está ya inicializado
        if not firebase_admin._apps:
            cred = credentials.Certificate(cred_dict)
            firebase_admin.initialize_app(cred, {
                'storageBucket': FIREBASE_STORAGE_BUCKET
            })
        
        firestore_db = firestore.client()
        firestore_collection = firestore_db.collection('uploads')
        print("Firebase Firestore inicializado correctamente")
        return True
    except Exception as e:
        raise RuntimeError(f"Error inicializando Firebase: {e}")

# Inicializar Firebase al iniciar la aplicación
try:
    init_firebase()
    print("Firebase Firestore configurado como único almacenamiento")
except Exception as e:
    print(f"ERROR CRÍTICO: {e}")
    print("La aplicación no puede funcionar sin Firebase.")
    print("Configura las variables de entorno de Firebase o instala firebase-admin")
    # La aplicación continuará, pero las funciones fallarán cuando intenten usar Firestore

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def generate_b2_filename(filename):
    """Generate unique filename for Backblaze B2"""
    ext = Path(filename).suffix.lower()
    unique_id = uuid.uuid4().hex[:12]
    return f"{B2_PREFIX}{Path(filename).stem}-{unique_id}{ext}"

def get_upload_credentials(b2_filename):
    """Get upload credentials for direct client upload"""
    bucket = init_b2()
    
    # Get upload authorization from B2 using low-level API
    try:
        upload_data = bucket.api.session.get_upload_url(bucket.id_)
        
        return {
            'upload_url': upload_data['uploadUrl'],
            'authorization_token': upload_data['authorizationToken'],
            'b2_filename': b2_filename,
            'bucket_id': bucket.id_
        }
    except Exception as e:
        print(f"Error getting upload URL: {e}")
        # Try alternative approach if above fails
        try:
            # Get account authorization
            account_auth = bucket.api.account_info.get_account_authorization()
            api_url = account_auth['apiUrl']
            auth_token = account_auth['authorizationToken']
            
            # Construct upload URL (v2) without filename (filename goes in header)
            upload_url = f"{api_url}/b2api/v2/b2_upload_file/{bucket.id_}"
            return {
                'upload_url': upload_url,
                'authorization_token': auth_token,
                'b2_filename': b2_filename,
                'bucket_id': bucket.id_
            }
        except Exception as e2:
            raise RuntimeError(f"Failed to get upload credentials: {e2}")

def init_b2():
    """Inicializar conexión a Backblaze B2"""
    info = InMemoryAccountInfo()
    b2_api = B2Api(info)
    b2_api.authorize_account("production", B2_APPLICATION_KEY_ID, B2_APPLICATION_KEY)
    bucket = b2_api.get_bucket_by_name(B2_BUCKET_NAME)
    return bucket



def upload_to_b2(file_data, filename):
    """Subir archivo a Backblaze B2 y retornar URL pública.
    file_data puede ser: ruta de archivo (str/Path) o objeto de archivo (BytesIO, FileStorage).
    """
    bucket = init_b2()
    ext = Path(filename).suffix.lower()
    unique_id = uuid.uuid4().hex[:12]
    b2_filename = f"{B2_PREFIX}{Path(filename).stem}-{unique_id}{ext}"
    
    # Determine if file_data is a path (str/Path) or a file object
    if isinstance(file_data, (str, Path)):
        # It's a file path
        local_path = str(file_data)
        bucket.upload_local_file(
            local_file=local_path,
            file_name=b2_filename
        )
    else:
        # It's a file object - save to temporary file
        # Ensure upload directory exists
        os.makedirs(UPLOAD_FOLDER, exist_ok=True)
        
        import tempfile
        with tempfile.NamedTemporaryFile(delete=False, suffix=ext, dir=UPLOAD_FOLDER) as tmp_file:
            # Save file object to temporary file
            if hasattr(file_data, 'save'):
                # Werkzeug FileStorage object
                file_data.save(tmp_file.name)
            else:
                # Other file-like object (BytesIO, etc.)
                tmp_file.write(file_data.read())
            tmp_path = tmp_file.name
        
        try:
            bucket.upload_local_file(
                local_file=tmp_path,
                file_name=b2_filename
            )
        finally:
            # Clean up temporary file
            try:
                os.unlink(tmp_path)
            except:
                pass
    
    public_url = f"{B2_ENDPOINT}/file/{B2_BUCKET_NAME}/{b2_filename}"
    return {
        "filename": filename,
        "url": public_url,
        "b2_filename": b2_filename
    }

def save_upload_record(record):
    """Guardar registro de subida en Firestore (único almacenamiento)"""
    if not firestore_collection:
        raise RuntimeError("Firestore no está inicializado. Verifica la configuración de Firebase.")
    
    timestamp = datetime.now().isoformat()
    image_data = {
        "filename": record['filename'],
        "url": record['url'],
        "timestamp": timestamp,
        "b2_filename": record['b2_filename']
    }
    
    try:
        # Usar el b2_filename como ID del documento
        doc_ref = firestore_collection.document(record['b2_filename'])
        doc_ref.set(image_data)
        print(f"Registro guardado en Firestore: {record['b2_filename']}")
        return record
    except Exception as e:
        print(f"Error guardando en Firestore: {e}")
        raise RuntimeError(f"No se pudo guardar el registro en Firestore: {e}")

def get_uploaded_images():
    """Obtener lista de imágenes subidas desde Firestore (único almacenamiento)"""
    if not firestore_collection:
        raise RuntimeError("Firestore no está inicializado. Verifica la configuración de Firebase.")
    
    try:
        docs = firestore_collection.stream()
        images = []
        for doc in docs:
            data = doc.to_dict()
            # Asegurar compatibilidad con formato anterior
            image_data = {
                "filename": data.get("filename", ""),
                "url": data.get("url", ""),
                "timestamp": data.get("timestamp", ""),
                "b2_filename": data.get("b2_filename", doc.id)
            }
            # Remover b2_filename si existe para mantener compatibilidad
            if "b2_filename" in image_data:
                del image_data["b2_filename"]
            images.append(image_data)
        
        # Ordenar por timestamp descendente (más recientes primero)
        images.sort(key=lambda x: x.get('timestamp', ''), reverse=True)
        print(f"Obtenidas {len(images)} imágenes desde Firestore")
        return images
    except Exception as e:
        print(f"Error obteniendo imágenes de Firestore: {e}")
        raise RuntimeError(f"No se pudieron obtener las imágenes desde Firestore: {e}")

def login_required(f):
    """Decorator to protect routes requiring authentication"""
    def decorated_function(*args, **kwargs):
        if not session.get('authenticated'):
            return redirect(url_for('login', next=request.url))
        return f(*args, **kwargs)
    decorated_function.__name__ = f.__name__
    return decorated_function

@app.route('/login', methods=['GET', 'POST'])
def login():
    """Login page"""
    if session.get('authenticated'):
        return redirect(url_for('index'))
    
    if request.method == 'POST':
        password = request.form.get('password')
        if password == os.getenv('APP_PASSWORD'):
            session['authenticated'] = True
            next_page = request.args.get('next')
            return redirect(next_page or url_for('index'))
        else:
            return render_template('login.html', error='Contraseña incorrecta')
    
    return render_template('login.html')

@app.route('/logout')
def logout():
    """Logout user"""
    session.pop('authenticated', None)
    return redirect(url_for('login'))

@app.route('/')
@login_required
def index():
    """Página principal"""
    return render_template('index.html', is_vercel=IS_VERCEL)

@app.route('/upload', methods=['POST'])
@login_required
def upload_file():
    """Endpoint para subir imagen (legacy - not recommended on Vercel)"""
    # On Vercel, we can only handle files up to ~4.5MB due to serverless limit
    vercel_max_size = 4.2 * 1024 * 1024  # 4.2MB conservative limit
    
    if IS_VERCEL:
        # Check content length if available
        content_length = request.content_length
        if content_length and content_length > vercel_max_size:
            return jsonify({
                "error": f"File too large for Vercel (max {round(vercel_max_size/1024/1024, 1)}MB)",
                "message": "Please use the direct upload to Backblaze B2 feature for larger files"
            }), 400
    
    if 'file' not in request.files:
        return jsonify({"error": "No file part"}), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({"error": "No selected file"}), 400
    
    if not allowed_file(file.filename):
        return jsonify({"error": "File type not allowed"}), 400
    
    filename = secure_filename(str(file.filename))
    
    try:
        # Subir a Backblaze B2 (pass file object directly)
        result = upload_to_b2(file, filename)
        # Guardar registro
        save_upload_record(result)
        
        return jsonify({
            "success": True,
            "message": "File uploaded successfully",
            "url": result['url'],
            "filename": result['filename']
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/uploads', methods=['GET'])
@login_required
def list_uploads():
    """Endpoint para listar imágenes subidas"""
    images = get_uploaded_images()
    return jsonify({"images": images})

def get_public_url(b2_filename):
    """Get public URL for a B2 filename"""
    return f"{B2_ENDPOINT}/file/{B2_BUCKET_NAME}/{b2_filename}"

@app.route('/api/upload/auth', methods=['POST'])
@login_required
def get_upload_auth():
    """Get upload credentials for direct client upload to B2"""
    data = request.get_json()
    if not data:
        return jsonify({"error": "JSON data required"}), 400
    
    filename = data.get('filename')
    if not filename:
        return jsonify({"error": "Filename required"}), 400
    
    # Validate file type
    if not allowed_file(filename):
        return jsonify({"error": "File type not allowed"}), 400
    
    # Generate unique B2 filename
    b2_filename = generate_b2_filename(filename)
    
    try:
        # Get upload credentials from B2
        credentials = get_upload_credentials(b2_filename)
        
        return jsonify({
            "success": True,
            "upload_url": credentials['upload_url'],
            "authorization_token": credentials['authorization_token'],
            "b2_filename": b2_filename,
            "bucket_id": credentials['bucket_id'],
            # Include headers that client needs to send
            "headers": {
                "Authorization": credentials['authorization_token'],
                "X-Bz-File-Name": b2_filename,
                "X-Bz-Content-Sha1": "do_not_verify",  # Skip SHA1 verification for simplicity
                # Content-Type will be set by frontend based on file type
            }
        })
    except Exception as e:
        print(f"[ERROR] get_upload_auth failed: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({"error": f"Failed to get upload credentials: {str(e)}"}), 500

@app.route('/api/upload/complete', methods=['POST'])
@login_required
def complete_upload():
    """Register completed upload in Firestore"""
    data = request.get_json()
    if not data:
        return jsonify({"error": "JSON data required"}), 400
    
    b2_filename = data.get('b2_filename')
    original_filename = data.get('original_filename')
    
    if not b2_filename or not original_filename:
        return jsonify({"error": "b2_filename and original_filename required"}), 400
    
    # Get public URL
    public_url = get_public_url(b2_filename)
    
    # Create record
    record = {
        'filename': original_filename,
        'url': public_url,
        'b2_filename': b2_filename
    }
    
    try:
        save_upload_record(record)
        return jsonify({
            "success": True,
            "message": "Upload registered successfully",
            "url": public_url,
            "filename": original_filename
        })
    except Exception as e:
        return jsonify({"error": f"Failed to save upload record: {str(e)}"}), 500

# Test endpoint to debug B2 upload (disabled in production)
# @app.route('/api/upload/test', methods=['POST'])
# @login_required
# def test_b2_upload():
#     """Test B2 upload with a small file"""
#     try:
#         from io import BytesIO
#         
#         # Create a small test file
#         test_content = b'Test file content for B2 upload'
#         test_filename = 'test-file.txt'
#         b2_filename = generate_b2_filename(test_filename)
#         
#         print(f"[TEST] Testing B2 upload with filename: {b2_filename}")
#         
#         # Get upload credentials
#         credentials = get_upload_credentials(b2_filename)
#         print(f"[TEST] Got credentials: upload_url={credentials['upload_url']}, auth_token={credentials['authorization_token'][:30]}...")
#         
#         # Try to upload using requests
#         import requests
#         headers = {
#             'Authorization': credentials['authorization_token'],
#             'X-Bz-File-Name': b2_filename,
#             'X-Bz-Content-Sha1': 'do_not_verify',
#             'Content-Type': 'text/plain',
#             'Content-Length': str(len(test_content))
#         }
#         
#         print(f"[TEST] Uploading to: {credentials['upload_url']}")
#         # Try POST (B2 v3 might require POST)
#         response = requests.post(
#             credentials['upload_url'],
#             data=test_content,
#             headers=headers
#         )
#         
#         print(f"[TEST] Response status: {response.status_code}")
#         print(f"[TEST] Response headers: {dict(response.headers)}")
#         print(f"[TEST] Response content: {response.text[:200]}")
#         
#         if response.status_code == 200:
#             # Register upload
#             public_url = get_public_url(b2_filename)
#             record = {
#                 'filename': test_filename,
#                 'url': public_url,
#                 'b2_filename': b2_filename
#             }
#             save_upload_record(record)
#             
#             return jsonify({
#                 'success': True,
#                 'message': 'Test upload successful',
#                 'url': public_url,
#                 'response': response.text[:200]
#             })
#         else:
#             return jsonify({
#                 'success': False,
#                 'error': f'Upload failed with status {response.status_code}',
#                 'response': response.text[:500]
#             }), 400
#             
#     except Exception as e:
#         print(f"[TEST] Error: {e}")
#         import traceback
#         traceback.print_exc()
#         return jsonify({
#             'success': False,
#             'error': str(e)
#         }), 500

# Static files are served directly by Vercel in production
# Also available via Flask for compatibility
@app.route('/static/<path:filename>')
def serve_static(filename):
    """Servir archivos estáticos"""
    static_dir = os.path.join(BASE_DIR, 'static')
    return send_from_directory(static_dir, filename)

if __name__ == '__main__':
    debug = os.getenv('FLASK_ENV') == 'development'
    host = os.getenv('HOST', '0.0.0.0')
    port = int(os.getenv('PORT', 5000))
    app.run(debug=debug, host=host, port=port, use_reloader=debug)