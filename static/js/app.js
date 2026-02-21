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
const convertOption = document.getElementById('convertOption');
const convertToWebp = document.getElementById('convertToWebp');
const qualitySlider = document.getElementById('qualitySlider');
const webpQuality = document.getElementById('webpQuality');
const qualityValue = document.getElementById('qualityValue');
const fileSizeComparison = document.getElementById('fileSizeComparison');

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
    } else if (type === 'warning') {
        setTimeout(() => {
            messageDiv.style.display = 'none';
        }, 8000);
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
    
    convertOption.style.display = 'none';
    convertToWebp.checked = false;
    qualitySlider.style.display = 'none';
    if (fileSizeComparison) {
        fileSizeComparison.style.display = 'none';
        fileSizeComparison.textContent = '';
        fileSizeComparison.classList.remove('good', 'ok');
    }
    
    fileInput.value = '';
}

// Actualizar interfaz con archivo seleccionado
function updateFileUI(file, originalSize = null) {
    if (!file) return;
    
    currentFile = file;
    fileName.textContent = file.name;
    fileSize.textContent = formatFileSize(file.size);
    
    // Mostrar comparación de tamaños si hay un tamaño original diferente
    if (fileSizeComparison) {
        if (originalSize !== null && originalSize !== file.size && originalSize > 0) {
            const reduction = ((originalSize - file.size) / originalSize * 100).toFixed(1);
            fileSizeComparison.textContent = `(Original: ${formatFileSize(originalSize)} → ${reduction}% más pequeño)`;
            fileSizeComparison.style.display = 'inline';
            // Remover clases previas
            fileSizeComparison.classList.remove('good', 'ok');
            // Agregar clase apropiada basada en el ahorro
            if (reduction >= 10) {
                fileSizeComparison.classList.add('good');
            } else {
                fileSizeComparison.classList.add('ok');
            }
        } else {
            fileSizeComparison.style.display = 'none';
            fileSizeComparison.textContent = '';
            fileSizeComparison.classList.remove('good', 'ok');
        }
    }
    
    cancelBtn.disabled = false;
    uploadBtn.disabled = false;
    
    // Mostrar opción de conversión para imágenes que no sean WebP
    const isWebP = file.type === 'image/webp';
    const maxConvertSize = 30 * 1024 * 1024; // 30MB máximo para conversión
    
    if (!isWebP && file.size <= maxConvertSize) {
        convertOption.style.display = 'block';
        convertToWebp.checked = false;
        qualitySlider.style.display = 'none';
        if (convertToWebp) convertToWebp.disabled = false;
    } else {
        convertOption.style.display = 'none';
        if (convertToWebp) convertToWebp.checked = false;
        
        if (!isWebP && file.size > maxConvertSize) {
            // Mostrar advertencia sobre tamaño
            setTimeout(() => {
                showMessage('Nota: Conversión a WebP deshabilitada para archivos mayores a 30MB', 'info');
            }, 500);
        }
    }
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
    
    // Validar tamaño (max 200MB - backend upload)
    const maxSize = 200 * 1024 * 1024; // 200MB
    if (file.size > maxSize) {
        showMessage('El archivo es demasiado grande. El tamaño máximo es 200MB.', 'error');
        return;
    }
    
    updateFileUI(file);
}

// Convertir imagen a WebP usando canvas
function convertImageToWebP(file, quality = 85) {
    return new Promise((resolve, reject) => {
        if (!file || !file.type.startsWith('image/')) {
            reject(new Error('Archivo no es una imagen válida'));
            return;
        }
        
        // Si ya es WebP, devolver el mismo archivo
        if (file.type === 'image/webp') {
            resolve(file);
            return;
        }
        
        showMessage(`Convirtiendo ${file.name} a WebP (${quality}%)...`, 'info');
        
        const img = new Image();
        const reader = new FileReader();
        
        reader.onload = (e) => {
            img.src = e.target.result;
        };
        
        img.onload = () => {
            try {
                // Crear canvas con dimensiones de la imagen
                const canvas = document.createElement('canvas');
                canvas.width = img.width;
                canvas.height = img.height;
                
                const ctx = canvas.getContext('2d');
                
                // Dibujar imagen en canvas
                ctx.drawImage(img, 0, 0);
                
                // Convertir a WebP blob
                canvas.toBlob((blob) => {
                    if (!blob) {
                        reject(new Error('Error al convertir a WebP'));
                        return;
                    }
                    
                    // Crear nuevo archivo con extensión .webp
                    const newFileName = file.name.replace(/\.[^/.]+$/, '') + '.webp';
                    const webpFile = new File([blob], newFileName, {
                        type: 'image/webp',
                        lastModified: Date.now()
                    });
                    
                    const originalSize = file.size;
                    const convertedSize = blob.size;
                    const reduction = originalSize > 0 ? ((originalSize - convertedSize) / originalSize * 100).toFixed(1) : 0;
                    
                    console.log(`Convertido: ${file.name} (${formatFileSize(originalSize)}) -> ${newFileName} (${formatFileSize(convertedSize)}) - ${reduction}% reducción`);
                    showMessage(`✅ Conversión completada: ${formatFileSize(originalSize)} → ${formatFileSize(convertedSize)} (${reduction}% más pequeño)`, 'success');
                    
                    resolve(webpFile);
                }, 'image/webp', quality / 100);
                
            } catch (error) {
                reject(new Error(`Error en conversión: ${error.message}`));
            }
        };
        
        img.onerror = () => {
            reject(new Error('Error al cargar la imagen para conversión'));
        };
        
        reader.onerror = () => {
            reject(new Error('Error al leer el archivo'));
        };
        
        reader.readAsDataURL(file);
    });
}

// Función principal de subida - decide qué método usar
async function uploadFile() {
    if (!currentFile || uploadInProgress) return;
    
    let fileToUpload = currentFile;
    const shouldConvert = convertToWebp && convertToWebp.checked && currentFile.type !== 'image/webp';
    const originalSize = currentFile.size;
    
    if (shouldConvert) {
        try {
            const quality = webpQuality ? parseInt(webpQuality.value) : 85;
            showMessage('Convirtiendo imagen a WebP...', 'info');
            uploadBtn.disabled = true;
            cancelBtn.disabled = true;
            
            fileToUpload = await convertImageToWebP(currentFile, quality);
            
            // Actualizar UI con el archivo convertido y mostrar comparación
            updateFileUI(fileToUpload, originalSize);
            
            uploadBtn.disabled = false;
            cancelBtn.disabled = false;
            
        } catch (error) {
            showMessage(`Error en conversión: ${error.message}. Subiendo archivo original.`, 'warning');
            // Continuar con archivo original
            fileToUpload = currentFile;
            // Actualizar UI sin comparación
            updateFileUI(fileToUpload);
        }
    }
    
    // Guardar archivo a subir temporalmente
    const originalCurrentFile = currentFile;
    currentFile = fileToUpload;
    
    const isVercel = window.IS_VERCEL === 'true' || window.IS_VERCEL === true;
    const maxBackendSize = 4.2 * 1024 * 1024; // 4.2MB conservative Vercel limit
    const fileSize = fileToUpload.size;
    
    // Determine upload method
    let uploadMethod;
    let warningMessage = '';
    
    if (fileSize <= maxBackendSize) {
        // File is small enough for backend upload even on Vercel
        uploadMethod = 'backend';
    } else {
        // File is too large for backend upload on Vercel
        if (isVercel) {
            // On Vercel, try direct B2 upload for large files
            uploadMethod = 'direct-b2';
            warningMessage = 'Archivo grande en Vercel: usando upload directo a Backblaze B2 (puede fallar por restricciones CORS).';
            
            // Suggest WebP conversion if not already WebP
            if (currentFile.type !== 'image/webp') {
                warningMessage += ' Considera convertir a WebP para reducir el tamaño.';
            }
        } else {
            // Not on Vercel, backend can handle up to 200MB locally
            uploadMethod = 'backend';
        }
    }
    
    console.log('Upload method decision:', {
        isVercel: window.IS_VERCEL,
        originalFileSize: originalCurrentFile.size,
        convertedFileSize: fileSize,
        maxBackendSize: maxBackendSize,
        uploadMethod: uploadMethod,
        warning: warningMessage
    });
    
    try {
        if (warningMessage) {
            showMessage(warningMessage, 'warning');
        }
        
        if (uploadMethod === 'backend') {
            console.log('Using backend upload');
            await uploadViaBackend();
        } else if (uploadMethod === 'direct-b2') {
            console.log('Using direct B2 upload');
            await uploadDirectToB2();
        }
    } finally {
        // Restaurar archivo original en currentFile para UI
        currentFile = originalCurrentFile;
    }
}

// Subir archivo a través del backend (evita problemas CORS con B2)
async function uploadViaBackend() {
    if (!currentFile || uploadInProgress) return;
    
    uploadInProgress = true;
    uploadBtn.disabled = true;
    cancelBtn.textContent = 'Cancelar Subida';
    progressContainer.style.display = 'block';
    progressBar.style.width = '0%';
    progressText.textContent = '0%';
    
    try {
        showMessage('Preparando subida...', 'info');
        
        // Usar FormData para enviar el archivo
        const formData = new FormData();
        formData.append('file', currentFile);
        
        showMessage('Subiendo a través del servidor...', 'info');
        
        // Upload through backend using XMLHttpRequest to track progress
        return new Promise((resolve, reject) => {
            uploadXHR = new XMLHttpRequest();
            
            uploadXHR.upload.addEventListener('progress', (e) => {
                if (e.lengthComputable) {
                    const percentComplete = Math.round((e.loaded / e.total) * 100);
                    progressBar.style.width = percentComplete + '%';
                    progressText.textContent = percentComplete + '%';
                    
                    // Update message at certain milestones
                    if (percentComplete === 50) {
                        showMessage('Subida a la mitad...', 'info');
                    } else if (percentComplete === 90) {
                        showMessage('Subida casi completa...', 'info');
                    }
                }
            });
            
            uploadXHR.addEventListener('load', async () => {
                try {
                    if (uploadXHR.status === 200) {
                        const response = JSON.parse(uploadXHR.responseText);
                        if (response.success) {
                            showMessage(`¡Imagen subida exitosamente! URL: ${response.url}`, 'success');
                            resetUploadUI();
                            loadImages(); // Recargar lista
                            resolve(response);
                        } else {
                            throw new Error(response.error || 'Error al subir el archivo');
                        }
                    } else {
                        let errorMsg = `Error ${uploadXHR.status} al subir el archivo`;
                        try {
                            const errorResponse = JSON.parse(uploadXHR.responseText);
                            errorMsg = errorResponse.error || errorMsg;
                        } catch (e) {
                            // Not JSON
                        }
                        throw new Error(errorMsg);
                    }
                } catch (error) {
                    showMessage(error.message, 'error');
                    reject(error);
                } finally {
                    uploadInProgress = false;
                    cancelBtn.textContent = 'Cancelar';
                    cancelBtn.disabled = true;
                    progressContainer.style.display = 'none';
                    uploadXHR = null;
                }
            });
            
            uploadXHR.addEventListener('error', (e) => {
                console.error('XHR error event:', e);
                console.error('XHR status:', uploadXHR.status);
                console.error('XHR statusText:', uploadXHR.statusText);
                console.error('XHR responseText:', uploadXHR.responseText);
                showMessage('Error de conexión con el servidor', 'error');
                uploadInProgress = false;
                cancelBtn.textContent = 'Cancelar';
                cancelBtn.disabled = true;
                progressContainer.style.display = 'none';
                uploadXHR = null;
                reject(new Error('Network error uploading to server'));
            });
            
            uploadXHR.addEventListener('abort', () => {
                showMessage('Subida cancelada', 'error');
                uploadInProgress = false;
                cancelBtn.textContent = 'Cancelar';
                cancelBtn.disabled = true;
                progressContainer.style.display = 'none';
                uploadXHR = null;
                reject(new Error('Upload cancelled'));
            });
            
            // Open POST request to our backend upload endpoint
            uploadXHR.open('POST', '/upload');
            
            // No need to set Content-Type header for FormData, browser sets it automatically
            // with proper boundary for multipart/form-data
            
            // Log request details
            console.log('Sending to backend:', {
                url: '/upload',
                filename: currentFile.name,
                size: currentFile.size,
                type: currentFile.type
            });
            
            // Send the FormData (which includes the file)
            uploadXHR.send(formData);
        });
        
    } catch (error) {
        showMessage(error.message, 'error');
        uploadInProgress = false;
        cancelBtn.textContent = 'Cancelar';
        cancelBtn.disabled = true;
        progressContainer.style.display = 'none';
        uploadXHR = null;
    }
}

// Subir directamente a Backblaze B2 (usado en Vercel)
async function uploadDirectToB2() {
    if (!currentFile || uploadInProgress) return;
    
    uploadInProgress = true;
    uploadBtn.disabled = true;
    cancelBtn.textContent = 'Cancelar Subida';
    progressContainer.style.display = 'block';
    progressBar.style.width = '0%';
    progressText.textContent = '0%';
    
    try {
        showMessage('Obteniendo credenciales de Backblaze B2...', 'info');
        
        // 1. Get upload credentials from backend
        const authResponse = await fetch('/api/upload/auth', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            credentials: 'same-origin',
            body: JSON.stringify({
                filename: currentFile.name
            })
        });
        
        if (!authResponse.ok) {
            const errorData = await authResponse.json();
            throw new Error(errorData.error || `Error ${authResponse.status} obteniendo credenciales`);
        }
        
        const authData = await authResponse.json();
        if (!authData.success) {
            throw new Error(authData.error || 'Error en credenciales de Backblaze B2');
        }
        
        showMessage('Subiendo directamente a Backblaze B2...', 'info');
        
        // 2. Upload directly to B2 using the provided URL
        // Headers for B2 upload (use headers from backend, except Content-Type which browser sets)
        const b2Headers = authData.headers || {};
        // Ensure we have the b2_filename in headers (backend should include it)
        if (!b2Headers['X-Bz-File-Name'] && authData.b2_filename) {
            b2Headers['X-Bz-File-Name'] = authData.b2_filename;
        }
        
        // Use XMLHttpRequest to track progress
        return new Promise((resolve, reject) => {
            uploadXHR = new XMLHttpRequest();
            
            uploadXHR.upload.addEventListener('progress', (e) => {
                if (e.lengthComputable) {
                    const percentComplete = Math.round((e.loaded / e.total) * 100);
                    progressBar.style.width = percentComplete + '%';
                    progressText.textContent = percentComplete + '%';
                    
                    // Update message at certain milestones
                    if (percentComplete === 50) {
                        showMessage('Subida a la mitad...', 'info');
                    } else if (percentComplete === 90) {
                        showMessage('Subida casi completa...', 'info');
                    }
                }
            });
            
            uploadXHR.addEventListener('load', async () => {
                try {
                    if (uploadXHR.status === 200) {
                        // B2 returns XML or JSON response
                        showMessage('Subida a B2 completada, registrando en Firebase...', 'info');
                        
                        // 3. Register upload in Firebase via backend
                        const completeResponse = await fetch('/api/upload/complete', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                            },
                            credentials: 'same-origin',
                            body: JSON.stringify({
                                b2_filename: authData.b2_filename,
                                original_filename: currentFile.name
                            })
                        });
                        
                        if (!completeResponse.ok) {
                            const errorData = await completeResponse.json();
                            throw new Error(errorData.error || `Error ${completeResponse.status} registrando subida`);
                        }
                        
                        const completeData = await completeResponse.json();
                        
                        showMessage(`¡Imagen subida exitosamente! URL: ${completeData.url}`, 'success');
                        resetUploadUI();
                        loadImages(); // Recargar lista
                        resolve(completeData);
                    } else {
                        let errorMsg = `Error ${uploadXHR.status} subiendo a Backblaze B2`;
                        try {
                            // Try to parse error response (B2 returns XML)
                            const parser = new DOMParser();
                            const xmlDoc = parser.parseFromString(uploadXHR.responseText, "text/xml");
                            const code = xmlDoc.getElementsByTagName('code')[0];
                            const message = xmlDoc.getElementsByTagName('message')[0];
                            if (code && message) {
                                errorMsg = `B2 Error ${code.textContent}: ${message.textContent}`;
                            }
                        } catch (e) {
                            // Not XML, try JSON
                            try {
                                const errorResponse = JSON.parse(uploadXHR.responseText);
                                errorMsg = errorResponse.error || errorResponse.message || errorMsg;
                            } catch (e2) {
                                // Plain text
                                if (uploadXHR.responseText) {
                                    errorMsg += `: ${uploadXHR.responseText.substring(0, 100)}`;
                                }
                            }
                        }
                        throw new Error(errorMsg);
                    }
                } catch (error) {
                    showMessage(error.message, 'error');
                    reject(error);
                } finally {
                    uploadInProgress = false;
                    cancelBtn.textContent = 'Cancelar';
                    cancelBtn.disabled = true;
                    progressContainer.style.display = 'none';
                    uploadXHR = null;
                }
            });
            
            uploadXHR.addEventListener('error', (e) => {
                console.error('XHR error event:', e);
                console.error('XHR status:', uploadXHR.status);
                console.error('XHR statusText:', uploadXHR.statusText);
                console.error('XHR responseText:', uploadXHR.responseText);
                showMessage('Error de conexión con Backblaze B2', 'error');
                uploadInProgress = false;
                cancelBtn.textContent = 'Cancelar';
                cancelBtn.disabled = true;
                progressContainer.style.display = 'none';
                uploadXHR = null;
                reject(new Error('Network error uploading to Backblaze B2'));
            });
            
            uploadXHR.addEventListener('abort', () => {
                showMessage('Subida cancelada', 'error');
                uploadInProgress = false;
                cancelBtn.textContent = 'Cancelar';
                cancelBtn.disabled = true;
                progressContainer.style.display = 'none';
                uploadXHR = null;
                reject(new Error('Upload cancelled'));
            });
            
            // Open POST request to B2 upload URL
            uploadXHR.open('POST', authData.upload_url);
            
            // Set B2 headers
            Object.keys(b2Headers).forEach(key => {
                uploadXHR.setRequestHeader(key, b2Headers[key]);
            });
            
            // Log request details
            console.log('Sending to B2:', {
                url: authData.upload_url,
                filename: authData.b2_filename,
                size: currentFile.size,
                type: currentFile.type
            });
            
            // Send the file directly
            uploadXHR.send(currentFile);
        });
        
    } catch (error) {
        showMessage(error.message, 'error');
        uploadInProgress = false;
        cancelBtn.textContent = 'Cancelar';
        cancelBtn.disabled = true;
        progressContainer.style.display = 'none';
        uploadXHR = null;
    }
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
        
        const response = await fetch('/uploads', {
            credentials: 'same-origin'
        });
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
        // Elementos que NO deben abrir el selector
        const excludedElements = [
            fileInput, uploadBtn, cancelBtn,
            webpQuality, qualityValue, convertToWebp,
            fileSizeComparison
        ];
        
        // Verificar si el target es uno de los excluidos
        if (excludedElements.includes(e.target)) return;
        
        // Verificar si el target está dentro de un contenedor excluido
        const excludedContainers = [
            '.convert-option',
            '.quality-slider',
            '.file-info',
            '.buttons',
            '.progress-container',
            '#message'
        ];
        
        for (const selector of excludedContainers) {
            if (e.target.closest(selector)) return;
        }
        
        // Solo se abre el selector si se hizo clic en el área vacía
        fileInput.click();
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
    
    // Conversión a WebP
    if (convertToWebp) {
        convertToWebp.addEventListener('change', (e) => {
            e.stopPropagation();
            if (e.target.checked) {
                qualitySlider.style.display = 'block';
            } else {
                qualitySlider.style.display = 'none';
            }
        });
    }
    
    if (webpQuality && qualityValue) {
        webpQuality.addEventListener('input', (e) => {
            e.stopPropagation();
            qualityValue.textContent = e.target.value;
        });
    }
    
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