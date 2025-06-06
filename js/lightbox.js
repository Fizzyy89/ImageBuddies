import { translate, currentLanguage } from './i18n.js';
import { uploadedFiles, updateImagePreviews } from './prompt.js';
// Lightbox-Modul
// Verantwortlich für Lightbox, Bildanzeige, Navigation, Metadaten, Privat-Status, Löschen, Download, URL-Kopieren und Prompt-Kopieren

export function initLightbox({
    lightbox,
    lightboxImage,
    lightboxPrompt,
    lightboxMeta,
    galleryImages,
    allImages,
    userName,
    deleteImageBtn,
    privateCheckboxContainer,
    privateCheckbox,
    copyPromptBtn,
    reusePromptBtn,
    lightboxPrev,
    lightboxNext,
    lightboxCloseBtn,
    lightboxInner,
    lightboxDownloadBtn,
    lightboxOpenNewTabBtn,
    lightboxCopyUrlBtn,
    setCurrentGalleryIndex,
    getCurrentGalleryIndex,
    loadImageGrid,
    isAdmin
}) {
    let currentGalleryIndex = -1;
    let tempDirectImage = null; // Merkt sich, ob ein Bild direkt angezeigt wird

    function renderBatchThumbnails(imgObj) {
        // Entferne alte Thumbnail-Zeilen
        if (lightboxPrompt && lightboxPrompt.parentNode) {
            lightboxPrompt.parentNode.querySelectorAll('.lightbox-batch-row').forEach(el => el.remove());
            lightboxPrompt.parentNode.querySelectorAll('.lightbox-batch-separator').forEach(el => el.remove());
        }
        if (!imgObj.batchId) return;
        const batchImages = allImages.filter(img => img.batchId === imgObj.batchId);
        if (batchImages.length <= 1) return;
        // --- Thumbnail-Zeile ---
        const thumbBarRow = document.createElement('div');
        thumbBarRow.className = 'flex items-center gap-3 mt-4 mb-6 lightbox-batch-row';
        // Label
        const batchLabel = document.createElement('div');
        batchLabel.className = 'flex flex-col items-center justify-center gap-0.5 px-2 py-1 rounded-md text-[12px] bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 leading-tight min-w-[40px]';
        batchLabel.innerHTML = `
            <span class="flex items-center justify-center gap-1">
                <svg class="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M4 6h16M4 12h16m-7 6h7"/>
                </svg>
                <span>${translate('lightbox.batchLabel.image')}</span>
            </span>
            <span class="block text-center font-bold">${imgObj.imageNumber} ${translate('lightbox.batchLabel.of')} ${batchImages.length}</span>
        `;
        thumbBarRow.appendChild(batchLabel);
        // Thumbnails sortiert
        batchImages.sort((a, b) => parseInt(a.imageNumber) - parseInt(b.imageNumber));
        batchImages.forEach((img, idx) => {
            const thumb = document.createElement('img');
            thumb.src = img.file;
            thumb.alt = translate('lightbox.batchImageAlt.prefix') + (idx + 1);
            thumb.className = 'w-14 h-14 object-cover rounded-lg border-2 transition cursor-pointer';
            if (String(img.imageNumber) === String(imgObj.imageNumber)) {
                thumb.classList.add('border-indigo-500', 'ring-2', 'ring-indigo-300');
            } else {
                thumb.classList.add('border-gray-200', 'dark:border-slate-700', 'opacity-80', 'hover:opacity-100');
            }
            thumb.onclick = () => {
                const galleryIdx = galleryImages.findIndex(g => g.file === img.file);
                if (galleryIdx !== -1) {
                    openGalleryLightbox(galleryIdx);
                } else {
                    showBatchImageDirect(img);
                }
            };
            thumbBarRow.appendChild(thumb);
        });
        // Einfügen nach dem Label-Container (Qualität/Seitenverhältnis/Referenzbilder)
        let labelContainer = null;
        if (lightboxPrompt && lightboxPrompt.parentNode) {
            // Suche den Label-Container (enthält id="lightboxAspectRatio")
            labelContainer = Array.from(lightboxPrompt.parentNode.querySelectorAll('div')).find(div => div.querySelector && div.querySelector('#lightboxAspectRatio'));
        }
        if (labelContainer && labelContainer.parentNode) {
            // Optional: Trennlinie einfügen
            const separator = document.createElement('div');
            separator.className = 'border-t border-gray-200 dark:border-slate-700 my-2 lightbox-batch-separator';
            labelContainer.parentNode.insertBefore(separator, labelContainer.nextSibling);
            labelContainer.parentNode.insertBefore(thumbBarRow, separator.nextSibling);
        } else if (lightboxPrompt && lightboxPrompt.parentNode) {
            // Fallback: wie bisher nach dem Prompt
            lightboxPrompt.parentNode.insertBefore(thumbBarRow, lightboxPrompt.nextSibling);
        }
        // --- Neuer Hauptbild-Button UNTER der Thumbnail-Zeile ---
        // Vorherige Instanzen entfernen, um Duplikate zu verhindern
        if (lightboxPrompt && lightboxPrompt.parentNode) {
            lightboxPrompt.parentNode.querySelectorAll('.lightbox-make-main-btn').forEach(el => el.remove());
        }
        const isNotMain = String(imgObj.imageNumber) !== '1';
        const isOwner = imgObj.user && userName.textContent && imgObj.user === userName.textContent.trim();
        if (isNotMain && (isOwner || isAdmin)) {
            const makeMainBtn = document.createElement('button');
            makeMainBtn.type = 'button';
            makeMainBtn.className = 'w-full mt-3 mb-6 px-4 py-2 rounded-lg bg-indigo-100 hover:bg-indigo-200 text-indigo-700 text-xs font-medium border border-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-200 dark:border-indigo-700 shadow-sm transition block lightbox-make-main-btn';
            makeMainBtn.textContent = translate('lightbox.makeMainButton.text');
            makeMainBtn.onclick = async (e) => {
                e.preventDefault();
                makeMainBtn.disabled = true;
                makeMainBtn.textContent = translate('lightbox.makeMainButton.loadingText');
                try {
                    const resp = await fetch('php/set_batch_main_image.php', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            batchId: imgObj.batchId,
                            imageNumber: imgObj.imageNumber
                        })
                    });
                    if (!resp.ok) throw new Error('Fehler beim Tauschen');
                    await loadImageGrid();
                    const newMain = galleryImages.findIndex(img => img.batchId === imgObj.batchId && String(img.imageNumber) === '1');
                    if (newMain !== -1) {
                        openGalleryLightbox(newMain);
                    } else {
                        lightbox.classList.add('hidden');
                        lightbox.classList.remove('active');
                        lightboxImage.src = '#';
                        setCurrentGalleryIndex(-1);
                    }
                } catch (err) {
                    alert(translate('lightbox.error.swapMainImageFailed'));
                } finally {
                    makeMainBtn.disabled = false;
                    makeMainBtn.textContent = translate('lightbox.makeMainButton.text');
                }
            };
            if (thumbBarRow.parentNode) {
                thumbBarRow.parentNode.insertBefore(makeMainBtn, thumbBarRow.nextSibling);
            }
        }
    }
    function openGalleryLightbox(index) {
        tempDirectImage = null;
        if (!galleryImages.length) return;
        currentGalleryIndex = index;
        setCurrentGalleryIndex(index);
        const imgObj = galleryImages[index];
        lightboxImage.src = imgObj.file;
        lightboxImage.style.cssText = 'image-rendering: auto;';

        // --- Alle potenziell von renderBatchThumbnails hinzugefügten Elemente entfernen ---
        if (lightboxPrompt && lightboxPrompt.parentNode) {
            lightboxPrompt.parentNode.querySelectorAll('.lightbox-batch-row, .lightbox-batch-separator, .lightbox-make-main-btn').forEach(el => el.remove());
        }

        // --- Metadaten, Prompt, User, Datum, Qualität, Seitenverhältnis ---
        if (imgObj.prompt) {
            lightboxPrompt.textContent = imgObj.prompt;
            lightboxPrompt.parentElement.classList.remove('hidden');
            copyPromptBtn.classList.remove('hidden');
            reusePromptBtn.classList.remove('hidden');
        } else {
            lightboxPrompt.parentElement.classList.add('hidden');
            copyPromptBtn.classList.add('hidden');
            reusePromptBtn.classList.add('hidden');
        }
        // Benutzer und Datum
        if (imgObj.user) {
            let dateStr = '';
            if (imgObj.timestamp) {
                let parts = imgObj.timestamp.split('T');
                if (parts.length === 2) {
                    let date = parts[0];
                    let time = parts[1].split('-').slice(0, 3).join(':');
                    let dateObj = new Date(`${date}T${time}Z`); // Assuming timestamp is UTC
                    if (!isNaN(dateObj.getTime())) {
                        const dateOptions = {
                            weekday: 'long',
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                            // No timeZone option, browser will use local
                        };
                        dateStr = dateObj.toLocaleString(currentLanguage, dateOptions);
                    }
                }
            }
            let metaHeader = `
                <div class="flex items-center gap-1.5">
                    <svg class="w-4 h-4 text-indigo-500 dark:text-indigo-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
                    </svg>
                    ${imgObj.user}
                </div>
                ${dateStr ? `
                <div class="flex items-center gap-1.5">
                    <svg class="w-4 h-4 text-indigo-500 dark:text-indigo-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
                    </svg>
                    ${dateStr}
                </div>
                ` : ''}`;
            lightboxMeta.innerHTML = metaHeader;
            lightboxMeta.classList.remove('hidden');
            // Qualität und Seitenverhältnis
            const qualityKeyMap = { 'low': 'settings.quality.low', 'medium': 'settings.quality.medium', 'high': 'settings.quality.high' };
            const aspectRatioLabels = { '1024x1024': '1:1', '1024x1536': '2:3', '1536x1024': '3:2' };
            const quality = translate(qualityKeyMap[imgObj.quality] || imgObj.quality);
            const aspectRatio = aspectRatioLabels[imgObj.size] || imgObj.size;
            const qualityColors = {
                [translate('settings.quality.low')]: 'bg-yellow-50 dark:bg-yellow-500/10 text-yellow-600 dark:text-yellow-400',
                [translate('settings.quality.medium')]: 'bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400',
                [translate('settings.quality.high')]: 'bg-green-50 dark:bg-green-500/10 text-green-600 dark:text-green-400'
            };
            document.getElementById('lightboxAspectRatio').textContent = aspectRatio;
            const qualityLabel = document.getElementById('lightboxQualityLabel');
            const qualityText = document.getElementById('lightboxQuality');
            const qualityColor = qualityColors[quality] || 'bg-gray-50 dark:bg-gray-500/10 text-gray-600 dark:text-gray-400';
            qualityLabel.className = `inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs ${qualityColor}`;
            qualityText.textContent = quality;
            qualityLabel.querySelector('svg').setAttribute('class', `w-4 h-4 ${qualityColor.includes('yellow') ? 'text-yellow-500' : qualityColor.includes('blue') ? 'text-blue-500' : qualityColor.includes('green') ? 'text-green-500' : 'text-gray-500'}`);

            // Referenzbilder Label hinzufügen
            const refCount = parseInt(imgObj.ref_image_count) || 0;
            const refLabel = document.getElementById('lightboxRefCount');
            if (refLabel) {
                if (refCount > 0) {
                    refLabel.className = 'inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400';
                    refLabel.innerHTML = `
                        <svg class="w-4 h-4 text-purple-500" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/>
                        </svg>
                        <span>${refCount + translate(refCount !== 1 ? 'label.referenceImages.plural' : 'label.referenceImages.singular')}</span>
                    `;
                    refLabel.style.display = 'inline-flex';
                } else {
                    refLabel.style.display = 'none';
                }
            }
        } else {
            lightboxMeta.classList.add('hidden');
        }
        // Privat-Checkbox
        if (imgObj.user && userName.textContent && imgObj.user === userName.textContent.trim()) {
            privateCheckboxContainer.classList.remove('hidden');
            const isPrivate = imgObj.private === '1';
            privateCheckbox.setAttribute('aria-checked', isPrivate ? 'true' : 'false');
            privateCheckbox.classList.toggle('bg-indigo-600', isPrivate);
            privateCheckbox.classList.toggle('bg-gray-200', !isPrivate);
            privateCheckbox.querySelector('span').classList.toggle('translate-x-4', isPrivate);
            privateCheckbox.querySelector('span').classList.toggle('translate-x-0', !isPrivate);
            const [publicLabel, privateLabel] = privateCheckbox.parentElement.querySelectorAll('span');
            publicLabel.classList.toggle('hidden', isPrivate);
            privateLabel.classList.toggle('hidden', !isPrivate);
            const [publicIcon, privateIcon] = privateCheckbox.querySelector('span').querySelectorAll('span');
            publicIcon.classList.toggle('hidden', isPrivate);
            privateIcon.classList.toggle('hidden', !isPrivate);
            privateCheckbox.disabled = false;
        } else {
            privateCheckboxContainer.classList.add('hidden');
            privateCheckbox.setAttribute('aria-checked', 'false');
            privateCheckbox.disabled = true;
        }
        lightbox.classList.remove('hidden');
        lightbox.classList.add('active');
        updateLightboxNav();
        // Delete-Button für Admins und Eigentümer anzeigen
        if (deleteImageBtn) {
            const isOwner = imgObj.user && userName.textContent && imgObj.user === userName.textContent.trim();
            if (isAdmin || isOwner) {
                deleteImageBtn.classList.remove('hidden');
            } else {
                deleteImageBtn.classList.add('hidden');
            }
        }
        // Batch-Thumbnails anzeigen (wenn Batch)
        renderBatchThumbnails(imgObj);
        // Navigation (Prev/Next) immer anzeigen
        updateLightboxNav();
    }
    function updateLightboxNav() {
        // Wenn ein direktes Bild angezeigt wird, Navigation auf Basis galleryImages
        if (galleryImages.length > 1) {
            lightboxPrev.classList.remove('hidden');
            lightboxNext.classList.remove('hidden');
        } else {
            lightboxPrev.classList.add('hidden');
            lightboxNext.classList.add('hidden');
        }
        let idx = currentGalleryIndex;
        if (tempDirectImage) {
            // Wenn das Bild nicht in der Galerie ist, suche das Batch-Hauptbild (imageNumber === '1') in galleryImages
            const batchMain = galleryImages.find(g => g.batchId === tempDirectImage.batchId && String(g.imageNumber) === '1');
            idx = batchMain ? galleryImages.findIndex(g => g.file === batchMain.file) : -1;
        }
        lightboxPrev.disabled = idx <= 0;
        lightboxNext.disabled = idx >= galleryImages.length - 1;
        lightboxPrev.style.opacity = idx <= 0 ? 0.3 : 1;
        lightboxNext.style.opacity = idx >= galleryImages.length - 1 ? 0.3 : 1;
    }
    if (lightboxPrev) {
        lightboxPrev.addEventListener('click', e => {
            e.stopPropagation();
            let idx = currentGalleryIndex;
            if (tempDirectImage) {
                // Wenn das Bild nicht in der Galerie ist, suche das Batch-Hauptbild (imageNumber === '1') in galleryImages
                const batchMain = galleryImages.find(g => g.batchId === tempDirectImage.batchId && String(g.imageNumber) === '1');
                idx = batchMain ? galleryImages.findIndex(g => g.file === batchMain.file) : -1;
            }
            if (idx > 0) openGalleryLightbox(idx - 1);
        });
    }
    if (lightboxNext) {
        lightboxNext.addEventListener('click', e => {
            e.stopPropagation();
            let idx = currentGalleryIndex;
            if (tempDirectImage) {
                // Wenn das Bild nicht in der Galerie ist, suche das Batch-Hauptbild (imageNumber === '1') in galleryImages
                const batchMain = galleryImages.find(g => g.batchId === tempDirectImage.batchId && String(g.imageNumber) === '1');
                idx = batchMain ? galleryImages.findIndex(g => g.file === batchMain.file) : -1;
            }
            if (idx < galleryImages.length - 1) openGalleryLightbox(idx + 1);
        });
    }
    if (lightboxCloseBtn) {
        lightboxCloseBtn.addEventListener('click', () => {
            lightbox.classList.add('hidden');
            lightbox.classList.remove('active');
            lightboxImage.src = '#';
            setCurrentGalleryIndex(-1);
        });
    }
    if (lightbox) {
        lightbox.addEventListener('click', (e) => {
            if (e.target === lightbox || e.target === lightboxInner) {
                lightbox.classList.add('hidden');
                lightbox.classList.remove('active');
                lightboxImage.src = '#';
                setCurrentGalleryIndex(-1);
            }
        });
    }
    window.addEventListener('keydown', (e) => {
        if (!lightbox.classList.contains('active')) return;
        if (e.key === 'Escape') {
            lightbox.classList.add('hidden');
            lightbox.classList.remove('active');
            lightboxImage.src = '#';
            setCurrentGalleryIndex(-1);
        } else if (e.key === 'ArrowLeft' && currentGalleryIndex > 0) {
            openGalleryLightbox(currentGalleryIndex - 1);
        } else if (e.key === 'ArrowRight' && currentGalleryIndex < galleryImages.length - 1) {
            openGalleryLightbox(currentGalleryIndex + 1);
        }
    });
    // Öffnen über CustomEvent
    window.addEventListener('openLightbox', (e) => {
        openGalleryLightbox(e.detail.index);
    });

    // Öffnen eines spezifischen Batch-Bildes
    window.addEventListener('showBatchImage', (e) => {
        showBatchImageDirect(e.detail.image);
        lightbox.classList.remove('hidden');
        lightbox.classList.add('active');
    });

    // Hilfsfunktion: Liefert das aktuell angezeigte Bildobjekt (egal ob Gallery oder direktes Batch-Bild)
    function getCurrentLightboxImage() {
        if (tempDirectImage) return tempDirectImage;
        if (currentGalleryIndex >= 0 && galleryImages[currentGalleryIndex]) return galleryImages[currentGalleryIndex];
        return null;
    }
    // --- Lightbox Buttons ---
    if (lightboxDownloadBtn) {
        lightboxDownloadBtn.onclick = null;
        lightboxDownloadBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const currentImage = getCurrentLightboxImage();
            if (!currentImage) return;
            const link = document.createElement('a');
            link.href = currentImage.file;
            const filename = currentImage.prompt ?
                currentImage.prompt.substring(0, 30).replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, '') :
                'generated_image';
            link.download = `${filename}.png`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        });
    }
    if (lightboxOpenNewTabBtn) {
        lightboxOpenNewTabBtn.onclick = null;
        lightboxOpenNewTabBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const currentImage = getCurrentLightboxImage();
            if (!currentImage) return;
            window.open(currentImage.file, '_blank');
        });
    }
    if (lightboxCopyUrlBtn) {
        let copyTimeout;
        lightboxCopyUrlBtn.onclick = null;
        lightboxCopyUrlBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const currentImage = getCurrentLightboxImage();
            if (!currentImage) return;
            try {
                const tempLink = document.createElement('a');
                tempLink.href = currentImage.file;
                const absoluteUrl = tempLink.href;
                await navigator.clipboard.writeText(absoluteUrl);
                const originalColor = lightboxCopyUrlBtn.getAttribute('data-original-class') || lightboxCopyUrlBtn.className;
                lightboxCopyUrlBtn.setAttribute('data-original-class', originalColor);
                lightboxCopyUrlBtn.className = 'text-green-500 hover:text-green-600 dark:text-green-400 dark:hover:text-green-500 transition-colors p-2';
                if (copyTimeout) clearTimeout(copyTimeout);
                copyTimeout = setTimeout(() => {
                    lightboxCopyUrlBtn.className = lightboxCopyUrlBtn.getAttribute('data-original-class');
                }, 2000);
            } catch (err) {
                console.error('Failed to copy URL:', err);
                alert(translate('lightbox.error.copyUrlFailed'));
            }
        });
    }
    if (copyPromptBtn) {
        copyPromptBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const prompt = lightboxPrompt.textContent;
            if (!prompt) return;
            try {
                await navigator.clipboard.writeText(prompt);
                const originalText = copyPromptBtn.querySelector('span').textContent;
                copyPromptBtn.querySelector('span').textContent = translate('lightbox.promptButton.copied');
                copyPromptBtn.classList.add('bg-green-50', 'dark:bg-green-500/10', 'text-green-600', 'dark:text-green-400');
                setTimeout(() => {
                    copyPromptBtn.querySelector('span').textContent = originalText;
                    copyPromptBtn.classList.remove('bg-green-50', 'dark:bg-green-500/10', 'text-green-600', 'dark:text-green-400');
                }, 2000);
            } catch (err) {
                console.error('Failed to copy:', err);
            }
        });
    }
    if (reusePromptBtn) {
        reusePromptBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const currentIndex = currentGalleryIndex;
            const imgObj = currentIndex >= 0 ? galleryImages[currentIndex] : null;
            if (!imgObj?.prompt) return;
            const promptInput = document.getElementById('prompt');
            promptInput.value = imgObj.prompt;
            if (imgObj.size) {
                const aspectBtn = document.querySelector(`.aspect-btn[data-value="${imgObj.size}"]`);
                if (aspectBtn) {
                    document.querySelectorAll('.aspect-btn').forEach(btn => {
                        btn.classList.remove('selected', 'bg-indigo-50', 'dark:bg-indigo-500/10', 'border-indigo-200', 'dark:border-indigo-500/30', 'text-indigo-700', 'dark:text-indigo-300');
                        btn.classList.add('bg-white', 'dark:bg-slate-800', 'border-gray-200', 'dark:border-slate-700', 'text-gray-700', 'dark:text-gray-300');
                    });
                    aspectBtn.classList.add('selected', 'bg-indigo-50', 'dark:bg-indigo-500/10', 'border-indigo-200', 'dark:border-indigo-500/30', 'text-indigo-700', 'dark:text-indigo-300');
                    aspectBtn.classList.remove('bg-white', 'dark:bg-slate-800', 'border-gray-200', 'dark:border-slate-700', 'text-gray-700', 'dark:text-gray-300');
                }
            }
            if (imgObj.quality) {
                const qualityBtn = document.querySelector(`.quality-btn[data-value="${imgObj.quality}"]`);
                if (qualityBtn && !qualityBtn.disabled) {
                    document.querySelectorAll('.quality-btn:not([disabled])').forEach(btn => {
                        btn.classList.remove('selected', 'bg-indigo-50', 'dark:bg-indigo-500/10', 'border-indigo-200', 'dark:border-indigo-500/30', 'text-indigo-700', 'dark:text-indigo-300');
                        btn.classList.add('bg-white', 'dark:bg-slate-800', 'border-gray-200', 'dark:border-slate-700', 'text-gray-700', 'dark:text-gray-300');
                    });
                    qualityBtn.classList.add('selected', 'bg-indigo-50', 'dark:bg-indigo-500/10', 'border-indigo-200', 'dark:border-indigo-500/30', 'text-indigo-700', 'dark:text-indigo-300');
                    qualityBtn.classList.remove('bg-white', 'dark:bg-slate-800', 'border-gray-200', 'dark:border-slate-700', 'text-gray-700', 'dark:text-gray-300');
                }
            }

            // Add current image as reference image
            try {
                const response = await fetch(imgObj.file);
                const blob = await response.blob();
                const file = new File([blob], 'reference.png', { type: 'image/png' });
                if (uploadedFiles.length >= 8) {
                    alert(translate('alert.maxReferenceImagesLimit'));
                } else {
                    uploadedFiles.push(file);
                    const imagePreviewContainer = document.getElementById('imagePreviewContainer');
                    const removeAllImagesBtn = document.getElementById('removeAllImagesBtn');
                    updateImagePreviews(uploadedFiles, imagePreviewContainer, removeAllImagesBtn, () => {
                        const qualityBtn = document.querySelector('.quality-btn.selected');
                        const imageCountBtn = document.querySelector('.image-count-btn.selected');
                        const qualityCosts = {
                            'low': 3,
                            'medium': 6,
                            'high': 25
                        };
                        const qualityCost = qualityBtn ? qualityCosts[qualityBtn.dataset.value] : 6;
                        const imageCount = imageCountBtn ? parseInt(imageCountBtn.dataset.value) : 1;
                        const refImagesCost = uploadedFiles.length * 4;
                        const totalCost = (qualityCost * imageCount) + refImagesCost;
                        const costLabel = document.getElementById('costLabel');
                        if (costLabel) {
                            costLabel.textContent = translate('label.apiCosts.prefix') + totalCost + translate('label.apiCosts.suffix');
                        }
                    });
                }
            } catch (error) {
                console.error('Error adding reference image:', error);
            }

            lightbox.classList.add('hidden');
            lightbox.classList.remove('active');
            lightboxImage.src = '#';
            setCurrentGalleryIndex(-1);
            window.scrollTo({ top: 0, behavior: 'smooth' });
            promptInput.focus();
            const optimizeBtn = document.getElementById('optimizePromptBtn');
            if (optimizeBtn) optimizeBtn.disabled = !promptInput.value.trim();
        });
    }
    if (deleteImageBtn) {
        deleteImageBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const currentImage = galleryImages[currentGalleryIndex];
            if (!currentImage) return;
            let batchDelete = false;
            let batchSize = 1;
            if (currentImage.batchId) {
                // Zähle alle Bilder mit dieser batchId
                batchSize = allImages.filter(img => img.batchId === currentImage.batchId).length;
                batchDelete = true;
            }
            let confirmMsg = translate('lightbox.deleteConfirm.single');
            if (batchDelete && batchSize > 1) {
                confirmMsg = translate('lightbox.deleteConfirm.batch.prefix') + batchSize + translate('lightbox.deleteConfirm.batch.suffix');
            }
            if (!confirm(confirmMsg)) {
                return;
            }
            try {
                const body = batchDelete && batchSize > 1
                    ? { batchId: currentImage.batchId }
                    : { filename: currentImage.file };
                const response = await fetch('php/delete_image.php', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(body)
                });
                if (!response.ok) {
                    const error = await response.json();
                    throw new Error(error.error || translate('lightbox.error.deleteFailedGeneral'));
                }
                lightbox.classList.add('hidden');
                lightbox.classList.remove('active');
                lightboxImage.src = '#';
                setCurrentGalleryIndex(-1);
                await loadImageGrid();
                alert(batchDelete && batchSize > 1
                    ? translate('lightbox.alert.batchDeleteSuccess')
                    : translate('lightbox.alert.singleDeleteSuccess'));
            } catch (error) {
                console.error('Delete error:', error);
                alert(error.message || translate('lightbox.error.deleteFailedGeneral'));
            }
        });
    }
    if (privateCheckbox) {
        privateCheckbox.addEventListener('click', async (e) => {
            const currentImage = getCurrentLightboxImage();
            if (!currentImage) return;
            privateCheckbox.disabled = true;
            try {
                const isPrivate = privateCheckbox.getAttribute('aria-checked') === 'false';
                let filesToUpdate = [currentImage.file.split('/').pop()];
                // Wenn Batch: alle Bilder der Batch updaten
                if (currentImage.batchId) {
                    filesToUpdate = allImages.filter(img => img.batchId === currentImage.batchId).map(img => img.file.split('/').pop());
                }
                for (const filename of filesToUpdate) {
                    const response = await fetch('php/set_private.php', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ filename: filename, private: isPrivate ? 1 : 0 })
                    });
                    if (!response.ok) {
                        const error = await response.json();
                        throw new Error(error.error || translate('lightbox.error.setPrivateStatusFailedGeneral'));
                    }
                }
                await loadImageGrid();
                // Nach dem Reload: Lightbox ggf. wieder öffnen
                let reopenIdx = -1;
                if (currentImage.batchId) {
                    // Suche das Bild mit gleicher batchId und imageNumber
                    reopenIdx = galleryImages.findIndex(img => img.batchId === currentImage.batchId && String(img.imageNumber) === String(currentImage.imageNumber));
                } else {
                    reopenIdx = galleryImages.findIndex(img => img.file === currentImage.file);
                }
                if (reopenIdx !== -1) {
                    openGalleryLightbox(reopenIdx);
                } else {
                    lightbox.classList.add('hidden');
                    lightbox.classList.remove('active');
                    lightboxImage.src = '#';
                    setCurrentGalleryIndex(-1);
                }
            } catch (error) {
                alert(error.message || translate('lightbox.error.setPrivateStatusFailedGeneral'));
                // UI zurücksetzen
                const isPrivate = privateCheckbox.getAttribute('aria-checked') === 'true';
                privateCheckbox.setAttribute('aria-checked', isPrivate ? 'true' : 'false');
                privateCheckbox.classList.toggle('bg-indigo-600', isPrivate);
                privateCheckbox.classList.toggle('bg-gray-200', !isPrivate);
                privateCheckbox.querySelector('span').classList.toggle('translate-x-4', isPrivate);
                privateCheckbox.querySelector('span').classList.toggle('translate-x-0', !isPrivate);
                const [publicLabel, privateLabel] = privateCheckbox.parentElement.querySelectorAll('span');
                publicLabel.classList.toggle('hidden', isPrivate);
                privateLabel.classList.toggle('hidden', !isPrivate);
                const [publicIcon, privateIcon] = privateCheckbox.querySelector('span').querySelectorAll('span');
                publicIcon.classList.toggle('hidden', isPrivate);
                privateIcon.classList.toggle('hidden', !isPrivate);
            } finally {
                privateCheckbox.disabled = false;
            }
        });
    }
    // Hilfsfunktion: Zeige ein Bild aus allImages direkt in der Lightbox (ohne Navigation)
    function showBatchImageDirect(imgObj) {
        tempDirectImage = imgObj;
        lightboxImage.src = imgObj.file;
        lightboxImage.style.cssText = 'image-rendering: auto;';
        if (lightboxPrompt && lightboxPrompt.parentNode) {
            lightboxPrompt.parentNode.querySelectorAll('.lightbox-batch-row').forEach(el => el.remove());
        }
        if (imgObj.prompt) {
            lightboxPrompt.textContent = imgObj.prompt;
            lightboxPrompt.parentElement.classList.remove('hidden');
            copyPromptBtn.classList.remove('hidden');
            reusePromptBtn.classList.remove('hidden');
        } else {
            lightboxPrompt.parentElement.classList.add('hidden');
            copyPromptBtn.classList.add('hidden');
            reusePromptBtn.classList.add('hidden');
        }
        renderBatchThumbnails(imgObj);
        // Navigation (Prev/Next) immer anzeigen
        updateLightboxNav();
        // Delete-Button für Admins und Eigentümer anzeigen
        if (deleteImageBtn) {
            const isOwner = imgObj.user && userName.textContent && imgObj.user === userName.textContent.trim();
            if (isAdmin || isOwner) {
                deleteImageBtn.classList.remove('hidden');
            } else {
                deleteImageBtn.classList.add('hidden');
            }
        }
    }
} 