# Instalación y Migración de la Aplicación Web

Esta aplicación web para subir imágenes a Blackblaze B2 es ahora portable y puede ejecutarse desde cualquier directorio.

## 📦 Instalación Rápida

1. **Copiar la aplicación** a tu directorio deseado:
   ```bash
   cp -r /ruta/original/webapp /nuevo/directorio/
   cd /nuevo/directorio/webapp
   ```

2. **Ejecutar el script de inicio** (configurará todo automáticamente):
   ```bash
   ./run.sh
   ```

   El script:
   - Buscará o creará un entorno virtual
   - Instalará dependencias si faltan
   - Creará directorios necesarios
   - Guiará en la configuración de credenciales

## 🔧 Configuración Manual

Si prefieres configurar manualmente:

1. **Crear entorno virtual** (opcional pero recomendado):
   ```bash
   python3 -m venv venv
   source venv/bin/activate  # En Windows: venv\Scripts\activate
   ```

2. **Instalar dependencias**:
   ```bash
   pip install -r requirements.txt
   ```

3. **Configurar credenciales**:
   ```bash
   cp .env.example .env
   # Editar .env con tus credenciales de Backblaze B2
   ```

4. **Crear directorios**:
   ```bash
   mkdir -p uploads data
   ```

5. **Ejecutar la aplicación**:
   ```bash
   python app.py
   # o usar el script
   ./run.sh
   ```

## 🚀 Despliegue en Hostinger (u otro hosting)

### Requisitos del hosting:
- Soporte para Python 3.8+
- Acceso a entorno virtual o pip
- Capacidad para ejecutar aplicaciones WSGI (Flask)

### Pasos generales:

1. **Subir archivos** a tu hosting (vía FTP o panel de control):
   - Sube TODA la carpeta `webapp` a tu directorio público (ej: `public_html`)

2. **Configurar credenciales**:
   - Crear archivo `.env` en el servidor con tus credenciales B2
   - O configurar variables de entorno en el panel de control

3. **Configurar Passenger** (si usas Hostinger con Python):
   - Asegúrate de que `passenger_wsgi.py` esté en la raíz
   - Configurar `.htaccess` con las rutas correctas
   - Contactar soporte si hay problemas

4. **Instalar dependencias**:
   - En el panel de control de Hostinger, usar "Python App Manager"
   - O usar SSH: `pip install -r requirements.txt`

5. **Verificar permisos**:
   ```bash
   chmod 755 uploads data
   chmod 644 *.py *.txt
   ```

### Archivos importantes para hosting:
- `app.py` - Aplicación principal
- `requirements.txt` - Dependencias
- `passenger_wsgi.py` - Punto de entrada para Passenger
- `wsgi.py` - Punto de entrada WSGI estándar
- `.env.example` - Plantilla de configuración

## 📁 Migración de Datos Existente

Si ya tienes un archivo `uploaded_images.json` con registros previos:

1. **Copiar el archivo JSON**:
   ```bash
   cp /ruta/original/uploaded_images.json data/
   ```

2. **Asegurar compatibilidad**: La aplicación buscará automáticamente las imágenes en la clave `web_uploads`.

3. **Si usas el archivo compartido** con el proyecto principal:
   - Configura `OUTPUT_JSON_PATH` en `.env` apuntando al archivo original
   - Ejemplo: `OUTPUT_JSON_PATH=/home/usuario/proyecto/uploaded_images.json`

## 🔒 Consideraciones de Seguridad

1. **NUNCA subas `.env` a control de versiones** (está en `.gitignore`)
2. **Usa diferentes credenciales** para desarrollo y producción
3. **Configura límites de subida** en producción (modifica `app.py`)
4. **Habilita HTTPS** en producción

## 🐛 Solución de Problemas

### "No module named 'flask'"
```bash
pip install -r requirements.txt
```

### "Error de autenticación con Backblaze B2"
- Verifica las credenciales en `.env`
- Asegúrate de que el bucket exista

### "Permiso denegado" al ejecutar run.sh
```bash
chmod +x run.sh
```

### La aplicación no se inicia en hosting
- Verifica los logs de error de Passenger
- Contacta al soporte técnico de tu hosting
- Prueba ejecutar localmente primero

## 📞 Soporte

Para problemas específicos de la aplicación, consulta la documentación de:
- Flask: https://flask.palletsprojects.com/
- Backblaze B2 SDK: https://github.com/Backblaze/b2-sdk-python
- Hostinger Python: https://www.hostinger.es/hosting-web/python