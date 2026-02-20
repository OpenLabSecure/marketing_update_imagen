// Estado de la aplicación
let currentFile = null;
let uploadInProgress = false;
let uploadXHR = null;

// Elementos DOM
const fileInput = document.getElementById('fileInput');
const uploadArea = document.getElementById('uploadArea');
const fileName = document.getElementById('fileName');
const fileSize = document.getElementById('fileSize');
const cancelBtn = document.getElementById('cancelBtn');
const uploadBtn = document.getElementById('uploadBtn');
const progressContainer = document.getElementById('progressContainer');
const progressBar = document.getElementById('progressBar');
const progressText = document.getElementById('progressText');
const messageDiv = document.getElementById('message');
const refreshBtn = document.getElementById('refreshBtn');
const searchInput = document.getElementById('searchInput');
const imagesList = document.getElementById('imagesList');
const loadingIndicator = document.getElementById('loadingIndicator');
const imageItemTemplate = document.getElementById('imageItemTemplate');

// Formatear tamaño de archivo
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Formatear fecha relativa
function timeAgo(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now - date) / 1000);
    
    let interval = Math.floor(seconds / 31536000);
    if (interval >= 1) return `hace ${interval} año${interval > 1 ? 's' : ''}`;
    
    interval = Math.floor(seconds / 2592000);
    if (interval >= 1) return `hace ${interval} mes${interval > 1 ? 'es' : ''}`;
    
    interval = Math.floor(seconds / 86400);
    if (interval >= 1) return `hace ${interval} día${interval > 1 ? 's' : ''}`;
    
    interval = Math.floor(seconds / 3600);
    if (interval >= 1) return `hace ${interval} hora${interval > 1 ? 's' : ''}`;
    
    interval = Math.floor(seconds / 60);
    if (interval >= 1) return `hace ${interval} minuto${interval > 1 ? 's' : ''}`;
    
    return 'hace unos segundos';
}

// Mostrar mensaje
function showMessage(text, type = 'success') {
    messageDiv.textContent = text;
    messageDiv.className = `message ${type}`;
    messageDiv.style.display = 'block';
    
    if (type === 'success') {
        setTimeout(() => {
            messageDiv.style.display = 'none';
        }, 5000);
    }
}

// Resetear interfaz de subida
function resetUploadUI() {
    currentFile = null;
    uploadInProgress = false;
    uploadXHR = null;
    
    fileName.textContent = 'Ningún archivo seleccionado';
    fileSize.textContent = '';
    
    cancelBtn.disabled = true;
    uploadBtn.disabled = true;
    
    progressContainer.style.display = 'none';
    progressBar.style.width = '0%';
    progressText.textContent = '0%';
    
    fileInput.value = '';
}

// Actualizar interfaz con archivo seleccionado
function updateFileUI(file) {
    if (!file) return;
    
    currentFile = file;
    fileName.textContent = file.name;
    fileSize.textContent = formatFileSize(file.size);
    
    cancelBtn.disabled = false;
    uploadBtn.disabled = false;
}

// Manejar selección de archivo
function handleFileSelect(file) {
    if (!file) return;
    
    // Validar tipo de archivo
    const allowedTypes = ['image/webp', 'image/jpeg', 'image/png', 'image/gif'];
    if (!allowedTypes.includes(file.type)) {
        showMessage('Tipo de archivo no permitido. Solo se aceptan imágenes (webp, jpg, png, gif).', 'error');
        return;
    }
    
    // Validar tamaño (max 10MB)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
        showMessage('El archivo es demasiado grande. El tamaño máximo es 10MB.', 'error');
        return;
    }
    
    updateFileUI(file);
}

// Subir archivo
function uploadFile() {
    if (!currentFile || uploadInProgress) return;
    
    const formData = new FormData();
    formData.append('file', currentFile);
    
    uploadInProgress = true;
    uploadBtn.disabled = true;
    cancelBtn.textContent = 'Cancelar Subida';
    progressContainer.style.display = 'block';
    
    // Crear XMLHttpRequest para monitorear progreso
    uploadXHR = new XMLHttpRequest();
    
    uploadXHR.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
            const percentComplete = Math.round((e.loaded / e.total) * 100);
            progressBar.style.width = percentComplete + '%';
            progressText.textContent = percentComplete + '%';
        }
    });
    
    uploadXHR.addEventListener('load', () => {
        if (uploadXHR.status === 200) {
            try {
                const response = JSON.parse(uploadXHR.responseText);
                if (response.success) {
                    showMessage(`¡Imagen subida exitosamente! URL: ${response.url}`, 'success');
                    resetUploadUI();
                    loadImages(); // Recargar lista
                } else {
                    showMessage(response.error || 'Error al subir la imagen', 'error');
                }
            } catch (e) {
                showMessage('Error al procesar la respuesta del servidor', 'error');
            }
        } else {
            try {
                const error = JSON.parse(uploadXHR.responseText);
                showMessage(error.error || `Error ${uploadXHR.status}: ${uploadXHR.statusText}`, 'error');
            } catch (e) {
                showMessage(`Error ${uploadXHR.status}: ${uploadXHR.statusText}`, 'error');
            }
        }
        
        uploadInProgress = false;
        cancelBtn.textContent = 'Cancelar';
        cancelBtn.disabled = true;
        progressContainer.style.display = 'none';
    });
    
    uploadXHR.addEventListener('error', () => {
        showMessage('Error de conexión con el servidor', 'error');
        uploadInProgress = false;
        cancelBtn.textContent = 'Cancelar';
        cancelBtn.disabled = true;
        progressContainer.style.display = 'none';
    });
    
    uploadXHR.open('POST', '/upload');
    uploadXHR.send(formData);
}

// Cancelar subida
function cancelUpload() {
    if (uploadInProgress && uploadXHR) {
        uploadXHR.abort();
        showMessage('Subida cancelada', 'error');
        uploadInProgress = false;
    }
    
    resetUploadUI();
}

// Cargar imágenes desde el servidor
async function loadImages() {
    try {
        loadingIndicator.style.display = 'block';
        imagesList.innerHTML = '';
        imagesList.appendChild(loadingIndicator);
        
        const response = await fetch('/uploads');
        if (!response.ok) throw new Error(`Error ${response.status}`);
        
        const data = await response.json();
        displayImages(data.images || []);
    } catch (error) {
        console.error('Error cargando imágenes:', error);
        imagesList.innerHTML = `
            <div class="message error">
                Error al cargar las imágenes: ${error.message}
            </div>
        `;
    } finally {
        loadingIndicator.style.display = 'none';
    }
}

// Mostrar imágenes en la lista
function displayImages(images) {
    if (images.length === 0) {
        imagesList.innerHTML = `
            <div class="message">
                No hay imágenes subidas todavía. ¡Sube la primera!
            </div>
        `;
        return;
    }
    
    imagesList.innerHTML = '';
    
    // Ordenar por timestamp (más reciente primero)
    images.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    images.forEach(image => {
        const clone = imageItemTemplate.content.cloneNode(true);
        const item = clone.querySelector('.image-item');
        const img = clone.querySelector('.preview-img');
        const filename = clone.querySelector('.image-filename');
        const urlInput = clone.querySelector('.url-input');
        const timeText = clone.querySelector('.time-text');
        const viewLink = clone.querySelector('.btn-view');
        const copyBtn = clone.querySelector('.btn-copy');
        
        // Configurar elementos
        img.src = image.url;
        img.alt = image.filename;
        filename.textContent = image.filename;
        urlInput.value = image.url;
        timeText.textContent = timeAgo(image.timestamp);
        viewLink.href = image.url;
        
        // Copiar URL al portapapeles
        copyBtn.addEventListener('click', () => {
            urlInput.select();
            document.execCommand('copy');
            
            // Feedback visual
            const originalHTML = copyBtn.innerHTML;
            copyBtn.innerHTML = '<i class="fas fa-check"></i>';
            copyBtn.style.background = '#2ecc71';
            
            setTimeout(() => {
                copyBtn.innerHTML = originalHTML;
                copyBtn.style.background = '';
            }, 2000);
        });
        
        // Buscar por texto
        item.dataset.search = `${image.filename.toLowerCase()} ${image.url.toLowerCase()}`;
        
        imagesList.appendChild(clone);
    });
}

// Filtrar imágenes por búsqueda
function filterImages(searchTerm) {
    const items = imagesList.querySelectorAll('.image-item');
    const term = searchTerm.toLowerCase().trim();
    
    items.forEach(item => {
        if (term === '' || item.dataset.search.includes(term)) {
            item.style.display = 'flex';
        } else {
            item.style.display = 'none';
        }
    });
}

// Event Listeners
document.addEventListener('DOMContentLoaded', () => {
    // Cargar imágenes al inicio
    loadImages();
    
    // Click en área de subida para abrir selector de archivos
    uploadArea.addEventListener('click', (e) => {
        if (e.target !== fileInput && e.target !== uploadBtn && e.target !== cancelBtn) {
            fileInput.click();
        }
    });
    
    // Cambio en selector de archivos
    fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        handleFileSelect(file);
    });
    
    // Drag and drop
    uploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadArea.classList.add('drag-over');
    });
    
    uploadArea.addEventListener('dragleave', () => {
        uploadArea.classList.remove('drag-over');
    });
    
    uploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadArea.classList.remove('drag-over');
        
        const file = e.dataTransfer.files[0];
        handleFileSelect(file);
    });
    
    // Botón de subir
    uploadBtn.addEventListener('click', uploadFile);
    
    // Botón de cancelar
    cancelBtn.addEventListener('click', cancelUpload);
    
    // Botón de actualizar lista
    refreshBtn.addEventListener('click', loadImages);
    
    // Buscador
    searchInput.addEventListener('input', (e) => {
        filterImages(e.target.value);
    });
    
    // Permitir subir con Enter cuando el input de archivo está seleccionado
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && currentFile && !uploadInProgress) {
            uploadFile();
        }
        if (e.key === 'Escape' && (currentFile || uploadInProgress)) {
            cancelUpload();
        }
    });
});

// Precarga de imágenes para vista previa (opcional)
function previewImage(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
        // Podríamos mostrar una vista previa en miniatura
        console.log('Vista previa cargada');
    };
    reader.readAsDataURL(file);
}