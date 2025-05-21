import { translate } from './i18n.js';
import { galleryImages, allImages } from './gallery.js';
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

    // Get selected image count
    const selectedCount = parseInt(document.querySelector('.image-count-btn.selected').dataset.value) || 1;
    const batchId = new Date().getTime().toString(); 

    let requestUrl;
    let requestBody;
    let requestHeaders = {};

    if (uploadedFiles.length > 0) {
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
    } else {
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
                        await fetch('php/upload.php', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                imageBase64: imageBase64,
                                prompt: prompt,
                                timestamp: timestamp,
                                size: selectedSize,
                                quality: selectedQuality,
                                ref_image_count: uploadedFiles.length,
                                batchId: batchId,
                                imageNumber: 1
                            })
                        });
                    } catch (error) {
                        console.error('Error saving image:', error);
                        if (errorMessageText) errorMessageText.textContent = translate('error.imageSaveFailed');
                        if (errorContainer) errorContainer.classList.remove('hidden');
                    }
                }
            } else {
                // Create a grid for multiple images
                let gridClass;
                if (selectedCount === 2) {
                    gridClass = 'grid-cols-2';
                } else {
                    gridClass = 'grid-cols-2';
                }
                const gridContainer = document.createElement('div');
                gridContainer.className = `generated-grid grid ${gridClass} gap-4 w-full h-full`;
                previewContainer.appendChild(gridContainer);

                for (let i = 0; i < data.data.length; i++) {
                    const imageData = data.data[i];
                    if (!imageData.b64_json) continue;

                    const imageBase64 = imageData.b64_json;
                    const imageUrl = `data:image/png;base64,${imageBase64}`;
                    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

                    // Create preview image
                    const imgWrapper = document.createElement('div');
                    imgWrapper.className = 'relative aspect-square w-full overflow-hidden rounded-xl';
                    const img = document.createElement('img');
                    img.src = imageUrl;
                    img.className = 'w-full h-full object-cover rounded-xl cursor-pointer transition-all duration-300 hover:scale-[1.02] hover:shadow-xl';
                    img.style.cssText = 'image-rendering: auto;';
                    imgWrapper.appendChild(img);
                    gridContainer.appendChild(imgWrapper);

                    // Save the image
                    try {
                        await fetch('php/upload.php', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                imageBase64: imageBase64,
                                prompt: prompt,
                                timestamp: timestamp,
                                size: selectedSize,
                                quality: selectedQuality,
                                ref_image_count: uploadedFiles.length,
                                batchId: batchId,
                                imageNumber: i + 1
                            })
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