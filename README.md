# Aplicación Web para Subir Imágenes a Blackblaze B2

Aplicación web simple para subir imágenes a Blackblaze B2 y obtener sus URLs públicas. Incluye interfaz de arrastrar y soltar, lista de imágenes subidas y búsqueda.

## Características

- **Subida de imágenes**: Arrastra y suelta o selecciona archivos (webp, jpg, png, gif)
- **Interfaz moderna**: Diseño responsivo con indicadores de progreso
- **Lista de imágenes**: Muestra todas las imágenes subidas con sus URLs
- **Copiar URL**: Botón para copiar la URL al portapapeles
- **Búsqueda**: Filtra imágenes por nombre o URL
- **Actualización en tiempo real**: La lista se actualiza automáticamente después de cada subida

## Requisitos

- Python 3.8+
- Entorno virtual con las dependencias instaladas
- Credenciales de Backblaze B2 (ya configuradas en el proyecto)

## Instalación

1. **Activar el entorno virtual** (si existe):
   ```bash
   source ../mi_entorno/bin/activate
   ```

2. **Instalar dependencias** (si no están instaladas):
   ```bash
   pip install -r requirements.txt
   ```

   Las dependencias incluyen:
   - Flask
   - b2sdk
   - flask-cors
   - python-dotenv

## Configuración

La aplicación usa las credenciales de Backblaze B2 del proyecto principal. Están configuradas en `app.py`:

- `B2_APPLICATION_KEY_ID`: ID de aplicación
- `B2_APPLICATION_KEY`: Clave de aplicación
- `B2_BUCKET_NAME`: Nombre del bucket (`openlapimages`)
- `B2_ENDPOINT`: Endpoint de B2
- `B2_PREFIX`: Prefijo para nombres de archivos (`products`)

**Nota**: En producción, se recomienda usar variables de entorno.

## Uso

### Iniciar la aplicación

Ejecuta el servidor Flask:

```bash
python app.py
```

O usa el script de inicio:

```bash
./run.sh
```

La aplicación estará disponible en `http://localhost:5000`

### Interfaz web

1. **Subir imágenes**:
   - Arrastra y suelta una imagen en el área designada
   - O haz clic para seleccionar un archivo
   - Haz clic en "Subir" para enviar a Blackblaze B2

2. **Lista de imágenes**:
   - Todas las imágenes subidas aparecen en la sección derecha
   - Cada imagen muestra su nombre, URL y fecha de subida
   - Haz clic en "Copiar URL" para copiar la URL al portapapeles
   - Haz clic en "Ver Imagen" para abrir la imagen en una nueva pestaña

3. **Búsqueda**:
   - Usa el campo de búsqueda para filtrar imágenes por nombre o URL

## Estructura del proyecto

```
webapp/
├── app.py                 # Aplicación Flask principal
├── requirements.txt       # Dependencias de Python
├── run.sh                # Script de inicio
├── create_test_image.py  # Generador de imagen de prueba
├── static/               # Archivos estáticos
│   ├── css/
│   │   └── style.css     # Estilos CSS
│   └── js/
│       └── app.js        # JavaScript de la interfaz
├── templates/            # Plantillas HTML
│   └── index.html        # Página principal
└── uploads/              # Carpeta temporal para subidas (se crea automáticamente)
```

## API Endpoints

- `GET /` - Página principal (HTML)
- `POST /upload` - Subir una imagen
- `GET /uploads` - Obtener lista de imágenes subidas
- `GET /static/<path:filename>` - Servir archivos estáticos

## Almacenamiento

Las URLs de las imágenes subidas se guardan en `../uploaded_images.json` en la clave `web_uploads`. Este archivo se comparte con el proyecto principal.

## Solución de problemas

### Error "No module named 'flask_cors'"
Instala la dependencia faltante:
```bash
pip install flask-cors
```

### Error de conexión a Backblaze B2
Verifica que las credenciales en `app.py` sean correctas y que el bucket exista.

### La imagen no se sube
Verifica que el archivo sea una imagen válida y no exceda el límite de tamaño (10MB).

### La aplicación no se inicia
Asegúrate de que el puerto 5000 no esté en uso. Puedes cambiar el puerto en `app.py` (última línea).

## Notas de seguridad

- **Credenciales**: Las credenciales de Backblaze B2 están hardcodeadas en `app.py`. En producción, utiliza variables de entorno.
- **CORS**: La aplicación tiene CORS habilitado para desarrollo. En producción, restringe los orígenes permitidos.
- **Subida de archivos**: Se validan los tipos de archivo y el tamaño máximo.

## Licencia

Parte del proyecto principal.