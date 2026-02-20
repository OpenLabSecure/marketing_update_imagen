"""
Archivo WSGI para despliegue en producción.
Usado por servidores como gunicorn, uWSGI, etc.
"""
import os
import sys

# Añadir el directorio actual al path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# Cargar variables de entorno desde .env si existe
from dotenv import load_dotenv
load_dotenv()

# Importar la aplicación Flask
from app import app

# La variable application es requerida por algunos servidores WSGI
application = app

if __name__ == "__main__":
    # Esto permite ejecutar: python wsgi.py
    port = int(os.getenv("PORT", 5000))
    host = os.getenv("HOST", "0.0.0.0")
    app.run(host=host, port=port)