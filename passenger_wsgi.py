"""
Archivo para Phusion Passenger (común en Hostinger, PythonAnywhere, etc.).
Passenger busca una variable llamada 'application'.
"""
import os
import sys

# Añadir el directorio actual al path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# Cargar variables de entorno
from dotenv import load_dotenv
load_dotenv()

# Importar la aplicación Flask
from app import app

# Passenger requiere esta variable
application = app

# Nota: En algunos entornos, Passenger puede requerir configuración adicional.
# Si tienes problemas, consulta la documentación de Hostinger para Python.