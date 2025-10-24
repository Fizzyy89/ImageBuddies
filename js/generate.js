import { translate } from './i18n.js';
import { galleryImages, allImages } from './gallery.js';
import { refreshUserStats } from './userInfo.js';
import { currentMode } from './prompt.js';
// Bildgenerierungs- und Vorschau-Modul
// Verantwortlich für das Generieren, Anzeigen und Herunterladen von Bildern

export async function generateImage({
    prompt,
    uploadedFiles,
    selectedSize,
    selectedQuality,
    API_URL_GENERATIONS,
    API_URL_EDITS,
    generateIcon,
    generateSpinner,
    generateBtnText,
    generateBtn,
    generatedImage,
    placeholderText,
    downloadBtn,
    errorContainer,
    errorMessageText,
    previewPulse,
    promptInput,
    userName,
    loadImageGrid,
    galleryImages,
    allImages
}) {
    if (!prompt) {
        alert(translate('alert.promptRequired'));
        return;
    }
    
    // Für Gemini: Mindestens 1 Bild erforderlich
    if (currentMode === 'gemini' && uploadedFiles.length === 0) {
        alert(translate('gemini.imageRequired'));
        return;
    }

    // Update button state
    if (generateIcon) generateIcon.classList.add('hidden');
    if (generateSpinner) generateSpinner.classList.remove('hidden');
    if (generateBtnText) generateBtnText.textContent = translate('generateButton.generating');
    if (generateBtn) generateBtn.disabled = true;
    if (generatedImage) generatedImage.classList.add('hidden');
    if (placeholderText) placeholderText.classList.remove('hidden');
    if (downloadBtn) downloadBtn.classList.add('hidden');
    if (errorContainer) errorContainer.classList.add('hidden');
    if (errorMessageText) errorMessageText.textContent = '';
    if (previewPulse) previewPulse.classList.remove('hidden');
    if (placeholderText) placeholderText.classList.add('hidden');

    // Get selected image count (nur für OpenAI relevant)
    const selectedCount = currentMode === 'gemini' ? 1 : (parseInt(document.querySelector('.image-count-btn.selected')?.dataset.value) || 1);
    const batchId = new Date().getTime().toString(); 

    let requestUrl;
    let requestBody;
    let requestHeaders = {};

    // Gemini Mode
    if (currentMode === 'gemini') {
        requestUrl = 'php/gemini_proxy.php?endpoint=edit';
        const formData = new FormData();
        uploadedFiles.forEach(file => {
            formData.append('image[]', file);
        });
        formData.append('prompt', prompt);
        requestBody = formData;
    }
    // OpenAI Mode with reference images
    else if (uploadedFiles.length > 0) {
        requestUrl = API_URL_EDITS;
        const formData = new FormData();
        uploadedFiles.forEach(file => {
            formData.append('image[]', file);
        });
        formData.append('prompt', prompt);
        formData.append('model', 'gpt-image-1');
        formData.append('size', selectedSize);
        formData.append('quality', selectedQuality);
        formData.append('n', selectedCount);
        requestBody = formData;
    }
    // OpenAI Mode without reference images
    else {
        requestUrl = API_URL_GENERATIONS;
        requestHeaders['Content-Type'] = 'application/json';
        requestBody = JSON.stringify({
            model: 'gpt-image-1',
            prompt: prompt,
            n: selectedCount,
            size: selectedSize,
            quality: selectedQuality,
            moderation: 'low'
        });
    }

    try {
        // Base64-Referenzbilder für serverseitige Speicherung vorbereiten (werden nur beim Speichern des ersten Bildes gesendet)
        let refImagesBase64 = [];
        if (uploadedFiles.length > 0) {
            const fileToDataUrl = (file) => new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result);
                reader.onerror = reject;
                reader.readAsDataURL(file);
            });
            try {
                refImagesBase64 = await Promise.all(uploadedFiles.map(fileToDataUrl));
            } catch (e) {
                refImagesBase64 = [];
            }
        }
        // Streaming nur für OpenAI Generations ohne Referenzbilder
        const canStream = currentMode === 'openai' && uploadedFiles.length === 0 && selectedCount === 1;
        if (canStream) {
            const streamUrl = 'php/openai_proxy.php?endpoint=generations_stream';
            const streamingBody = JSON.stringify({
                ...JSON.parse(requestBody),
                partial_images: 2
            });

            const response = await fetch(streamUrl, {
                method: 'POST',
                headers: requestHeaders,
                body: streamingBody
            });

            if (!response.ok || !response.body) {
                const text = await response.text();
                throw new Error(text || 'Streaming request failed');
            }

            const previewContainer = document.getElementById('generatedImage').parentElement;
            const oldGrid = previewContainer.querySelector('.generated-grid');
            if (oldGrid) oldGrid.remove();
            const generatedImageEl = document.getElementById('generatedImage');
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';
            let lastImageBase64 = null;

            // Helfer: wendet ein Base64-Bild in der Vorschau an
            const showPreview = (b64) => {
                if (!b64) return;
                lastImageBase64 = b64;
                const url = `data:image/png;base64,${b64}`;
                generatedImageEl.src = url;
                generatedImageEl.classList.remove('hidden');
                generatedImageEl.onclick = () => {
                    const event = new CustomEvent('openLightbox', { detail: { index: 0 } });
                    window.dispatchEvent(event);
                };
                if (placeholderText) placeholderText.classList.add('hidden');
            };

            // SSE Parser: verarbeitet vollständige Events aus dem Puffer
            const processBuffer = () => {
                const events = buffer.split('\n\n');
                // Letztes Fragment aufheben, falls unvollständig
                buffer = events.pop();
                for (const evt of events) {
                    // Sammle Felder
                    const lines = evt.split('\n');
                    let type = '';
                    let dataPayload = '';
                    for (const line of lines) {
                        if (line.startsWith('event:')) type = line.slice(6).trim();
                        if (line.startsWith('data:')) dataPayload += line.slice(5).trim();
                    }

                    if (!dataPayload) continue;
                    if (dataPayload === '[DONE]') continue;
                    let json;
                    try { json = JSON.parse(dataPayload); } catch { continue; }

                    // Versuche mögliche Felder für Teil-/Finalbilder
                    // Images API: b64_json bei partial/final
                    // Responses API (falls später verwendet): partial_image_b64
                    const possibleBase64 = json.b64_json || json.partial_image_b64 || json.image_b64;
                    if (type.includes('partial') || type.includes('image_generation') || possibleBase64) {
                        showPreview(possibleBase64);
                    }

                    // Fehlerereignis
                    if (type.includes('error') || json.error) {
                        throw new Error(json.error?.message || 'Streaming error');
                    }
                }
            };

            // Stream lesen
            while (true) {
                const { value, done } = await reader.read();
                if (done) break;
                buffer += decoder.decode(value, { stream: true });
                processBuffer();
            }

            // Nach Stream-Ende: letztes Bild als final behandeln und speichern
            // Reset button state
            if (generateIcon) generateIcon.classList.remove('hidden');
            if (generateSpinner) generateSpinner.classList.add('hidden');
            if (generateBtnText) generateBtnText.textContent = translate('generateButton.text');
            if (generateBtn) generateBtn.disabled = false;

            if (!lastImageBase64) {
                if (errorMessageText) errorMessageText.textContent = translate('error.noB64Json');
                if (errorContainer) errorContainer.classList.remove('hidden');
                if (previewPulse) previewPulse.classList.add('hidden');
                return;
            }

            try {
                const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
                const payload = {
                    imageBase64: lastImageBase64,
                    prompt: prompt,
                    timestamp: timestamp,
                    size: selectedSize,
                    quality: selectedQuality,
                    ref_image_count: uploadedFiles.length,
                    batchId: batchId,
                    imageNumber: 1,
                    mode: currentMode
                };
                if (refImagesBase64.length > 0) {
                    payload.refImages = refImagesBase64;
                }
                await fetch('php/upload.php', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
            } catch (error) {
                console.error('Error saving image:', error);
                if (errorMessageText) errorMessageText.textContent = translate('error.imageSaveFailed');
                if (errorContainer) errorContainer.classList.remove('hidden');
            }

            // Galerie aktualisieren + Download-Button aktivieren
            await loadImageGrid();
            const latestGalleryImages = [...galleryImages];
            if (latestGalleryImages.length > 0) {
                const latestImage = latestGalleryImages[0];
                downloadBtn.onclick = () => downloadImage(latestImage.file, prompt || 'generated_image');
                if (downloadBtn) downloadBtn.classList.remove('hidden');
            }
            if (previewPulse) previewPulse.classList.add('hidden');
            refreshUserStats();
            return;
        }

        // Multi-Stream: mehrere Einzel-Streams parallel für N>1 (ohne Referenzbilder)
        const canMultiStream = uploadedFiles.length === 0 && selectedCount > 1;
        if (canMultiStream) {
            const streamUrl = 'php/openai_proxy.php?endpoint=generations_stream';
            const baseBody = JSON.parse(requestBody);
            const streamingBody = JSON.stringify({
                ...baseBody,
                partial_images: 2
            });

            const previewContainer = document.getElementById('generatedImage').parentElement;
            const oldGrid = previewContainer.querySelector('.generated-grid');
            if (oldGrid) oldGrid.remove();
            const generatedImageEl = document.getElementById('generatedImage');
            generatedImageEl.classList.add('hidden');

            // Grid vorbereiten (nutzt verfügbaren Platz optimal, ohne Container zu vergrößern)
            let gridClass;
            if (selectedCount === 2) {
                gridClass = 'grid-cols-2';
            } else {
                gridClass = 'grid-cols-2';
            }
            const rowsClass = selectedCount <= 2 ? 'grid-rows-1' : 'grid-rows-2';
            const gridContainer = document.createElement('div');
            gridContainer.className = `generated-grid grid ${gridClass} ${rowsClass} gap-4 w-full h-[480px] max-h-[520px] overflow-hidden`;
            previewContainer.appendChild(gridContainer);

            const gridImageEls = [];
            for (let i = 0; i < selectedCount; i++) {
                const imgWrapper = document.createElement('div');
                imgWrapper.className = 'relative w-full h-full overflow-hidden rounded-xl';
                const img = document.createElement('img');
                img.className = 'w-full h-full object-cover rounded-xl cursor-pointer transition-all duration-300 hover:scale-[1.02] hover:shadow-xl hidden';
                img.style.cssText = 'image-rendering: auto;';
                imgWrapper.appendChild(img);
                gridContainer.appendChild(imgWrapper);
                gridImageEls.push(img);
            }

            const lastImageBase64ByIdx = new Array(selectedCount).fill(null);
            const streamErrors = [];

            const startStreamForIndex = async (index) => {
                try {
                    const response = await fetch(streamUrl, {
                        method: 'POST',
                        headers: requestHeaders,
                        body: streamingBody
                    });
                    if (!response.ok || !response.body) {
                        const text = await response.text();
                        throw new Error(text || 'Streaming request failed');
                    }

                    const reader = response.body.getReader();
                    const decoder = new TextDecoder();
                    let buffer = '';

                    const showPreview = (b64) => {
                        if (!b64) return;
                        lastImageBase64ByIdx[index] = b64;
                        const url = `data:image/png;base64,${b64}`;
                        const imgEl = gridImageEls[index];
                        imgEl.src = url;
                        imgEl.classList.remove('hidden');
                        if (placeholderText) placeholderText.classList.add('hidden');
                    };

                    const processBuffer = () => {
                        const events = buffer.split('\n\n');
                        buffer = events.pop();
                        for (const evt of events) {
                            const lines = evt.split('\n');
                            let type = '';
                            let dataPayload = '';
                            for (const line of lines) {
                                if (line.startsWith('event:')) type = line.slice(6).trim();
                                if (line.startsWith('data:')) dataPayload += line.slice(5).trim();
                            }
                            if (!dataPayload) continue;
                            if (dataPayload === '[DONE]') continue;
                            let json;
                            try { json = JSON.parse(dataPayload); } catch { continue; }
                            const possibleBase64 = json.b64_json || json.partial_image_b64 || json.image_b64;
                            if (type.includes('partial') || type.includes('image_generation') || possibleBase64) {
                                showPreview(possibleBase64);
                            }
                            if (type.includes('error') || json.error) {
                                throw new Error(json.error?.message || 'Streaming error');
                            }
                        }
                    };

                    while (true) {
                        const { value, done } = await reader.read();
                        if (done) break;
                        buffer += decoder.decode(value, { stream: true });
                        processBuffer();
                    }

                    if (!lastImageBase64ByIdx[index]) {
                        throw new Error(translate('error.noB64Json'));
                    }

                    try {
                        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
                        const payload = {
                            imageBase64: lastImageBase64ByIdx[index],
                            prompt: prompt,
                            timestamp: timestamp,
                            size: selectedSize,
                            quality: selectedQuality,
                            ref_image_count: uploadedFiles.length,
                            batchId: batchId,
                            imageNumber: index + 1,
                            mode: currentMode
                        };
                        if (index === 0 && refImagesBase64.length > 0) {
                            payload.refImages = refImagesBase64;
                        }
                        await fetch('php/upload.php', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(payload)
                        });
                    } catch (saveErr) {
                        streamErrors.push(saveErr);
                    }
                } catch (err) {
                    streamErrors.push(err);
                }
            };

            await Promise.allSettled(Array.from({ length: selectedCount }, (_, i) => startStreamForIndex(i)));

            // Reset button state
            if (generateIcon) generateIcon.classList.remove('hidden');
            if (generateSpinner) generateSpinner.classList.add('hidden');
            if (generateBtnText) generateBtnText.textContent = translate('generateButton.text');
            if (generateBtn) generateBtn.disabled = false;

            const anyImage = lastImageBase64ByIdx.some(Boolean);
            if (!anyImage) {
                if (errorMessageText) errorMessageText.textContent = translate('error.noB64Json');
                if (errorContainer) errorContainer.classList.remove('hidden');
                if (previewPulse) previewPulse.classList.add('hidden');
                return;
            }

            // Galerie aktualisieren und Klickhandler setzen
            await loadImageGrid();
            const latestGalleryImages = [...galleryImages];
            const latestAllImages = [...allImages];
            if (latestGalleryImages.length > 0) {
                const latestImages = latestGalleryImages.slice(0, selectedCount);
                const previewImages = gridContainer.querySelectorAll('img');
                previewImages.forEach((img, idx) => {
                    if (latestImages[0]) {
                        img.onclick = () => {
                            const batchIdRef = latestImages[0].batchId;
                            const imageNumber = idx + 1;
                            const batchImage = latestAllImages.find(obj => obj.batchId === batchIdRef && parseInt(obj.imageNumber) === imageNumber);
                            if (batchImage) {
                                const event = new CustomEvent('showBatchImage', { detail: { image: batchImage } });
                                window.dispatchEvent(event);
                            }
                        };
                    }
                });
                downloadBtn.onclick = () => downloadBatch(latestImages[0].batchId, prompt || 'generated_image');
                if (downloadBtn) downloadBtn.classList.remove('hidden');
            }
            if (previewPulse) previewPulse.classList.add('hidden');
            refreshUserStats();
            return;
        }

        // Fallback: bisheriges, nicht-streaming Verhalten
        const response = await fetch(requestUrl, {
            method: 'POST',
            headers: requestHeaders,
            body: requestBody
        });

        // Reset button state
        if (generateIcon) generateIcon.classList.remove('hidden');
        if (generateSpinner) generateSpinner.classList.add('hidden');
        if (generateBtnText) generateBtnText.textContent = translate('generateButton.text');
        if (generateBtn) generateBtn.disabled = false;

        if (!response.ok) {
            const errorData = await response.json();
            console.error('API Error:', errorData);
            if (errorMessageText) errorMessageText.textContent = errorData.error?.message || translate('error.unknown');
            if (errorContainer) errorContainer.classList.remove('hidden');
            if (previewPulse) previewPulse.classList.add('hidden');
            return;
        }

        const data = await response.json();
        if (data.data && data.data.length > 0) {
            const previewContainer = document.getElementById('generatedImage').parentElement;
            const oldGrid = previewContainer.querySelector('.generated-grid');
            if (oldGrid) oldGrid.remove();
            const generatedImageEl = document.getElementById('generatedImage');
            generatedImageEl.classList.add('hidden');

            if (selectedCount === 1) {
                const imageData = data.data[0];
                if (imageData && imageData.b64_json) {
                    const imageBase64 = imageData.b64_json;
                    const imageUrl = `data:image/png;base64,${imageBase64}`;
                    generatedImageEl.src = imageUrl;
                    generatedImageEl.classList.remove('hidden');
                    generatedImageEl.onclick = () => {
                        const event = new CustomEvent('openLightbox', { detail: { index: 0 } });
                        window.dispatchEvent(event);
                    };
                    // Save the image
                    try {
                        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
                        const payload = {
                            imageBase64: imageBase64,
                            prompt: prompt,
                            timestamp: timestamp,
                            size: selectedSize,
                            quality: selectedQuality,
                            ref_image_count: uploadedFiles.length,
                            batchId: batchId,
                            imageNumber: 1,
                            mode: currentMode
                        };
                        if (refImagesBase64.length > 0) {
                            payload.refImages = refImagesBase64;
                        }
                        await fetch('php/upload.php', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(payload)
                        });
                    } catch (error) {
                        console.error('Error saving image:', error);
                        if (errorMessageText) errorMessageText.textContent = translate('error.imageSaveFailed');
                        if (errorContainer) errorContainer.classList.remove('hidden');
                    }
                }
            } else {
                // Create a grid for multiple images (nutzt verfügbaren Platz optimal)
                let gridClass;
                if (selectedCount === 2) {
                    gridClass = 'grid-cols-2';
                } else {
                    gridClass = 'grid-cols-2';
                }
                const rowsClass = selectedCount <= 2 ? 'grid-rows-1' : 'grid-rows-2';
                const gridContainer = document.createElement('div');
                gridContainer.className = `generated-grid grid ${gridClass} ${rowsClass} gap-4 w-full h-[480px] max-h-[520px] overflow-hidden`;
                previewContainer.appendChild(gridContainer);

                for (let i = 0; i < data.data.length; i++) {
                    const imageData = data.data[i];
                    if (!imageData.b64_json) continue;

                    const imageBase64 = imageData.b64_json;
                    const imageUrl = `data:image/png;base64,${imageBase64}`;
                    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

                    // Create preview image
                    const imgWrapper = document.createElement('div');
                    imgWrapper.className = 'relative w-full h-full overflow-hidden rounded-xl';
                    const img = document.createElement('img');
                    img.src = imageUrl;
                    img.className = 'w-full h-full object-cover rounded-xl cursor-pointer transition-all duration-300 hover:scale-[1.02] hover:shadow-xl';
                    img.style.cssText = 'image-rendering: auto;';
                    imgWrapper.appendChild(img);
                    gridContainer.appendChild(imgWrapper);

                    // Save the image
                    try {
                        const payload = {
                            imageBase64: imageBase64,
                            prompt: prompt,
                            timestamp: timestamp,
                            size: selectedSize,
                            quality: selectedQuality,
                            ref_image_count: uploadedFiles.length,
                            batchId: batchId,
                            imageNumber: i + 1,
                            mode: currentMode
                        };
                        if (i === 0 && refImagesBase64.length > 0) {
                            payload.refImages = refImagesBase64;
                        }
                        await fetch('php/upload.php', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(payload)
                        });
                    } catch (error) {
                        console.error('Error saving image:', error);
                        if (errorMessageText) errorMessageText.textContent = translate('error.imageSaveFailed');
                        if (errorContainer) errorContainer.classList.remove('hidden');
                    }
                }
            }

            // Reload gallery and setup click handlers
            await loadImageGrid();
            const latestGalleryImages = [...galleryImages];
            const latestAllImages = [...allImages];
            if (latestGalleryImages.length > 0) {
                const latestImages = latestGalleryImages.slice(0, selectedCount);
                if (selectedCount === 1) {
                    downloadBtn.onclick = () => downloadImage(latestImages[0].file, prompt || 'generated_image');
                } else {
                    const previewContainer = document.getElementById('generatedImage').parentElement;
                    const previewImages = previewContainer.querySelectorAll('.generated-grid img');
                    previewImages.forEach((img, idx) => {
                        if (latestImages[idx]) {
                            img.onclick = () => {
                                const batchId = latestImages[0].batchId;
                                const imageNumber = idx + 1;
                                const batchImage = latestAllImages.find(img => 
                                    img.batchId === batchId && 
                                    parseInt(img.imageNumber) === imageNumber
                                );
                                if (batchImage) {
                                    const event = new CustomEvent('showBatchImage', { detail: { image: batchImage } });
                                    window.dispatchEvent(event);
                                }
                            };
                        }
                    });
                    downloadBtn.onclick = () => downloadBatch(latestImages[0].batchId, prompt || 'generated_image');
                }
                if (placeholderText) placeholderText.classList.add('hidden');
                if (downloadBtn) downloadBtn.classList.remove('hidden');
                if (previewPulse) previewPulse.classList.add('hidden');
                
                // Refresh user statistics after successful generation
                refreshUserStats();
            }
        } else {
            if (errorMessageText) errorMessageText.textContent = translate('error.noB64Json');
            if (errorContainer) errorContainer.classList.remove('hidden');
            if (previewPulse) previewPulse.classList.add('hidden');
        }
    } catch (error) {
        if (generateIcon) generateIcon.classList.remove('hidden');
        if (generateSpinner) generateSpinner.classList.add('hidden');
        if (generateBtnText) generateBtnText.textContent = translate('generateButton.text');
        if (generateBtn) generateBtn.disabled = false;
        console.error('Request Error:', error);
        if (errorMessageText) errorMessageText.textContent = error.message || translate('error.generic');
        if (errorContainer) errorContainer.classList.remove('hidden');
        if (previewPulse) previewPulse.classList.add('hidden');
    }
}

export function downloadImage(imageUrl, prompt) {
    const link = document.createElement('a');
    link.href = imageUrl;
    const filename = prompt.substring(0, 30).replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, '') || 'generated_image';
    link.download = `${filename}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

export function downloadBatch(batchId, prompt) {
    const downloadUrl = `php/download_batch.php?batchId=${batchId}`;
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.click();
} 