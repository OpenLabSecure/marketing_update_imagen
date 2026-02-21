#!/bin/bash
# Script para iniciar la aplicación web de Blackblaze B2 Image Uploader (versión portable)

# Color codes
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================${NC}"
echo -e "${GREEN}  Blackblaze B2 Image Uploader${NC}"
echo -e "${BLUE}========================================${NC}"

# Verificar que estamos en el directorio correcto
if [ ! -f "app.py" ]; then
    echo -e "${RED}Error: No se encuentra app.py. Ejecuta este script desde el directorio webapp/${NC}"
    exit 1
fi

# Función para activar entorno virtual
activate_venv() {
    local venv_path="$1"
    if [ -f "$venv_path/bin/activate" ]; then
        echo "Activando entorno virtual: $venv_path"
        source "$venv_path/bin/activate"
        return 0
    else
        return 1
    fi
}

# Buscar y activar entorno virtual
VENV_FOUND=false

# 1. Intentar con venv en directorio actual
if activate_venv "venv"; then
    VENV_FOUND=true
# 2. Intentar con mi_entorno en directorio padre (compatibilidad)
elif activate_venv "../mi_entorno"; then
    VENV_FOUND=true
else
    echo -e "${YELLOW}No se encontró un entorno virtual.${NC}"
    read -p "¿Deseas crear un entorno virtual 'venv' en el directorio actual? (s/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Ss]$ ]]; then
        echo "Creando entorno virtual..."
        python3 -m venv venv
        if activate_venv "venv"; then
            VENV_FOUND=true
        else
            echo -e "${RED}Error al crear el entorno virtual.${NC}"
            exit 1
        fi
    else
        echo -e "${YELLOW}Continuando sin entorno virtual (usando Python del sistema).${NC}"
    fi
fi

# Verificar dependencias
echo "Verificando dependencias..."
python -c "import flask, b2sdk, flask_cors, dotenv, firebase_admin" 2>/dev/null
if [ $? -ne 0 ]; then
    echo "Instalando dependencias faltantes..."
    pip install -r requirements.txt
fi

# Crear directorios necesarios
echo "Creando directorios necesarios..."
mkdir -p uploads
mkdir -p data

# Verificar archivo .env
if [ ! -f ".env" ]; then
    echo -e "${YELLOW}Advertencia: No se encontró el archivo .env${NC}"
    if [ -f ".env.example" ]; then
        echo "Puedes copiar .env.example como .env y ajustar las configuraciones:"
        echo "  cp .env.example .env"
        echo "  # Edita .env con tus credenciales de Backblaze B2 y Firebase"
        read -p "¿Copiar .env.example a .env ahora? (s/n): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Ss]$ ]]; then
            cp .env.example .env
            echo "Archivo .env creado. Edítalo con tus credenciales."
            echo -e "${YELLOW}IMPORTANTE: Edita el archivo .env con tus credenciales de Backblaze B2 y Firebase antes de continuar.${NC}"
            exit 1
        fi
    else
        echo -e "${RED}Error: No se encontró .env.example. Asegúrate de tener las configuraciones.${NC}"
        exit 1
    fi
fi

# Configuración del puerto (opcional)
export PORT=${PORT:-5000}
export HOST=${HOST:-0.0.0.0}
export FLASK_ENV=${FLASK_ENV:-production}

# Iniciar aplicación
echo -e "\n${GREEN}Iniciando aplicación en http://localhost:${PORT} ${NC}"
echo -e "${GREEN}Modo: ${FLASK_ENV:-development}${NC}"
echo "Presiona Ctrl+C para detener la aplicación"
echo -e "${BLUE}========================================${NC}\n"

# Ejecutar aplicación Flask
python app.py