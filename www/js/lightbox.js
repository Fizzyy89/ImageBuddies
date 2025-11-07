import { translate, currentLanguage } from './i18n.js';
import { uploadedFiles, updateImagePreviews, updateGeminiUploadGrid, updateTotalCost } from './prompt.js';
// Lightbox module
// Responsible for image display, navigation, metadata, private status, deletion, download, URL copy, and prompt copy

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
    let tempDirectImage = null; // Tracks if an image is shown directly

    // Helper: reference images label with toggle functionality
    function setupRefLabel(imgObj) {
        const refCount = parseInt(imgObj.ref_image_count) || 0;
        const refLabel = document.getElementById('lightboxRefCount');
        if (refLabel) {
            if (refCount > 0) {
                refLabel.className = 'inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400 cursor-pointer hover:bg-purple-100 dark:hover:bg-purple-500/20 transition-colors';
                refLabel.title = translate('lightbox.refImagesToggleTooltip');
                refLabel.innerHTML = `
                    <svg class="w-4 h-4 text-purple-500" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/>
                    </svg>
                    <span>${refCount + translate(refCount !== 1 ? 'label.referenceImages.plural' : 'label.referenceImages.singular')}</span>
                `;
                refLabel.style.display = 'inline-flex';
                refLabel.replaceWith(refLabel.cloneNode(true));
                const newRefLabel = document.getElementById('lightboxRefCount');
                newRefLabel.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const refsRow = lightboxPrompt.parentNode.querySelector('.lightbox-refs-row');
                    if (refsRow) {
                        refsRow.classList.toggle('hidden');
                    }
                });
            } else {
                refLabel.style.display = 'none';
            }
        }
    }

    function renderBatchThumbnails(imgObj) {
        // Remove old thumbnail rows
        if (lightboxPrompt && lightboxPrompt.parentNode) {
            lightboxPrompt.parentNode.querySelectorAll('.lightbox-batch-row').forEach(el => el.remove());
            lightboxPrompt.parentNode.querySelectorAll('.lightbox-batch-separator').forEach(el => el.remove());
        }
        if (!imgObj.batchId) return;
        let batchImages = allImages.filter(img => img.batchId === imgObj.batchId);
        // Fallback: when opened from archive (not in galleryImages/allImages), use provided batchImages
        if ((!batchImages || batchImages.length <= 1) && tempDirectImage && Array.isArray(tempDirectImage.batchImages)) {
            batchImages = tempDirectImage.batchImages;
        }
        // Insert after the label container (quality/aspect ratio/reference images)
        let labelContainer = null;
        if (lightboxPrompt && lightboxPrompt.parentNode) {
            // Find the label container (contains id="lightboxAspectRatio")
            labelContainer = Array.from(lightboxPrompt.parentNode.querySelectorAll('div')).find(div => div.querySelector && div.querySelector('#lightboxAspectRatio'));
        }
        // --- Thumbnail row (only if batch has more than 1 image) ---
        let thumbBarRow = null;
        if (batchImages.length > 1) {
            thumbBarRow = document.createElement('div');
            thumbBarRow.className = 'flex items-center gap-3 mt-4 mb-6 lightbox-batch-row';
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
            batchImages.sort((a, b) => parseInt(a.imageNumber) - parseInt(b.imageNumber));
            batchImages.forEach((img, idx) => {
                const thumbWrapper = document.createElement('div');
                thumbWrapper.className = 'relative cursor-pointer';
                const thumb = document.createElement('img');
                thumb.src = img.file;
                thumb.alt = translate('lightbox.batchImageAlt.prefix') + (idx + 1);
                thumb.className = 'w-14 h-14 object-cover rounded-lg border-2 transition';
                const isCurrent = img.file === imgObj.file;
                if (isCurrent) {
                    thumb.classList.add('border-indigo-500', 'ring-2', 'ring-indigo-300');
                } else {
                    thumb.classList.add('border-gray-200', 'dark:border-slate-700', 'opacity-80', 'hover:opacity-100');
                }
                thumbWrapper.appendChild(thumb);
                if (String(img.isMainImage) === '1') {
                    const mainMarker = document.createElement('div');
                    mainMarker.className = 'absolute -top-1.5 -right-1.5 flex items-center justify-center w-7 h-7 rounded-full bg-gradient-to-br from-amber-400 via-amber-500 to-amber-600 text-white shadow-lg ring-2 ring-white/80 dark:ring-slate-900/70';
                    mainMarker.innerHTML = `
                        <svg class="w-3.5 h-3.5 drop-shadow-sm" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                            <path d="M10 2.5l2.18 4.417 4.875.71-3.528 3.436.833 4.86L10 13.917 5.64 15.923l.833-4.86-3.528-3.436 4.875-.71L10 2.5z"></path>
                        </svg>
                    `;
                    thumbWrapper.appendChild(mainMarker);
                }
                thumbWrapper.addEventListener('click', () => {
                    const galleryIdx = galleryImages.findIndex(g => g.file === img.file);
                    if (galleryIdx !== -1) {
                        openGalleryLightbox(galleryIdx);
                    } else {
                        const nextImg = (tempDirectImage && Array.isArray(tempDirectImage.batchImages))
                            ? { ...img, batchImages: tempDirectImage.batchImages, archived: tempDirectImage.archived || imgObj.archived }
                            : { ...img, archived: imgObj.archived };
                        showBatchImageDirect(nextImg);
                    }
                });
                thumbBarRow.appendChild(thumbWrapper);
            });
            if (labelContainer && labelContainer.parentNode) {
                const separator = document.createElement('div');
                separator.className = 'border-t border-gray-200 dark:border-slate-700 my-2 lightbox-batch-separator';
                labelContainer.parentNode.insertBefore(separator, labelContainer.nextSibling);
                labelContainer.parentNode.insertBefore(thumbBarRow, separator.nextSibling);
            } else if (lightboxPrompt && lightboxPrompt.parentNode) {
                lightboxPrompt.parentNode.insertBefore(thumbBarRow, lightboxPrompt.nextSibling);
            }
        }

        // --- Reference images row (if present, hidden by default) ---
        const owner = imgObj.user || '';
        const currentGalleryMain = galleryImages.find(g => g.batchId === imgObj.batchId && g.isMainImage === '1');
        const refImages = currentGalleryMain && currentGalleryMain.refImages ? currentGalleryMain.refImages : (imgObj.refImages || []);
        if (Array.isArray(refImages) && refImages.length > 0) {
            const refsRow = document.createElement('div');
            refsRow.className = 'flex items-center gap-3 mt-2 mb-2 lightbox-batch-row lightbox-refs-row hidden';
            const refsLabel = document.createElement('div');
            refsLabel.className = 'flex items-center justify-center gap-1 px-2 py-1 rounded-md text-[12px] bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400';
            refsLabel.innerHTML = `
                <svg class="w-4 h-4 text-purple-500" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/>
                </svg>
                <span>${translate('lightbox.refImagesLabel') || 'Referenzen'}</span>`;
            refsRow.appendChild(refsLabel);
            const refsWrapper = document.createElement('div');
            refsWrapper.className = 'flex items-center gap-2 overflow-x-auto';
            refImages.forEach((src, idx) => {
                const r = document.createElement('img');
                r.src = src;
                r.alt = translate('altText.referenceImage');
                r.className = 'w-14 h-14 object-cover rounded-lg border border-gray-200 dark:border-slate-700 cursor-pointer hover:opacity-80 transition-opacity';
                r.onclick = () => window.open(src, '_blank');
                refsWrapper.appendChild(r);
            });
            refsRow.appendChild(refsWrapper);
            if (thumbBarRow && thumbBarRow.parentNode) {
                thumbBarRow.parentNode.insertBefore(refsRow, thumbBarRow);
            } else if (labelContainer && labelContainer.parentNode) {
                const separator = document.createElement('div');
                separator.className = 'border-t border-gray-200 dark:border-slate-700 my-2 lightbox-batch-separator';
                labelContainer.parentNode.insertBefore(separator, labelContainer.nextSibling);
                labelContainer.parentNode.insertBefore(refsRow, separator.nextSibling);
            } else if (lightboxPrompt && lightboxPrompt.parentNode) {
                lightboxPrompt.parentNode.insertBefore(refsRow, lightboxPrompt.nextSibling);
            }
        }
        // --- "Make main image" button below the thumbnail row ---
        if (lightboxPrompt && lightboxPrompt.parentNode) {
            lightboxPrompt.parentNode.querySelectorAll('.lightbox-make-main-btn').forEach(el => el.remove());
        }
        const isMain = String(imgObj.isMainImage) === '1';
        const isNotMain = !isMain;
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
                    const resp = await fetch('api/set_batch_main_image.php', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            batchId: imgObj.batchId,
                            imageNumber: imgObj.imageNumber,
                            filename: imgObj.file ? imgObj.file.split('/').pop() : null
                        })
                    });
                    if (!resp.ok) throw new Error('Fehler beim Tauschen');
                    await loadImageGrid();
                    const newMain = galleryImages.findIndex(img => img.batchId === imgObj.batchId && img.isMainImage === '1');
                    if (newMain !== -1) {
                        openGalleryLightbox(newMain);
                    } else {
                        // Fallback for archived batches: refetch archived list for this batch
                        if (imgObj.batchId) {
                            try {
                                const archResp = await fetch('api/list_archived.php');
                                const arch = await archResp.json();
                                const updatedBatch = arch.filter(a => a.batchId === imgObj.batchId).sort((a,b)=>parseInt(a.imageNumber)-parseInt(b.imageNumber));
                                const newMainObj = updatedBatch.find(x => x.isMainImage === '1') || updatedBatch[0];
                                if (newMainObj) {
                                    showBatchImageDirect({ ...newMainObj, batchImages: updatedBatch });
                                }
                            } catch (_) {
                                // fallback: close
                        lightbox.classList.add('hidden');
                        lightbox.classList.remove('active');
                        lightboxImage.src = '#';
                        setCurrentGalleryIndex(-1);
                    }
                        } else {
                            lightbox.classList.add('hidden');
                            lightbox.classList.remove('active');
                            lightboxImage.src = '#';
                            setCurrentGalleryIndex(-1);
                        }
                    }
                    // Notify My Images to refresh
                    try { window.dispatchEvent(new CustomEvent('refreshMyImages')); } catch (_) {}
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

        // --- Remove any elements potentially added by renderBatchThumbnails ---
        if (lightboxPrompt && lightboxPrompt.parentNode) {
            lightboxPrompt.parentNode.querySelectorAll('.lightbox-batch-row, .lightbox-batch-separator, .lightbox-make-main-btn').forEach(el => el.remove());
        }

        // --- Metadata, prompt, user, date, quality, aspect ratio ---
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
        // Ensure the Gemini button is displayed correctly
        ensureGeminiEditButton(imgObj);
        // User and date
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
            // Quality and aspect ratio
            const qualityKeyMap = { 'low': 'settings.quality.low', 'medium': 'settings.quality.medium', 'high': 'settings.quality.high', 'gemini': 'settings.quality.gemini' };
            const quality = translate(qualityKeyMap[imgObj.quality] || imgObj.quality);
            // Rein auf aspect_class umstellen
            let aspectRatio = imgObj.aspect_class;
            if (typeof aspectRatio === 'string' && aspectRatio.includes('x')) {
                const [w, h] = aspectRatio.toLowerCase().split('x');
                const wf = parseFloat(w), hf = parseFloat(h);
                if (wf > 0 && hf > 0) {
                    const r = wf / hf;
                    const allowed = { '1:1': 1.0, '2:3': 2/3, '3:2': 3/2 };
                    let best = '1:1', bestDiff = Infinity;
                    for (const [k, v] of Object.entries(allowed)) {
                        const d = Math.abs(r - v);
                        if (d < bestDiff) { best = k; bestDiff = d; }
                    }
                    aspectRatio = best;
                }
            }
            const qualityColors = {
                [translate('settings.quality.low')]: 'bg-yellow-50 dark:bg-yellow-500/10 text-yellow-600 dark:text-yellow-400',
                [translate('settings.quality.medium')]: 'bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400',
                [translate('settings.quality.high')]: 'bg-green-50 dark:bg-green-500/10 text-green-600 dark:text-green-400',
                [translate('settings.quality.gemini')]: 'bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400'
            };
            document.getElementById('lightboxAspectRatio').textContent = aspectRatio;
            const qualityLabel = document.getElementById('lightboxQualityLabel');
            const qualityText = document.getElementById('lightboxQuality');
            const qualityColor = qualityColors[quality] || 'bg-gray-50 dark:bg-gray-500/10 text-gray-600 dark:text-gray-400';
            qualityLabel.className = `inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs ${qualityColor}`;
            qualityText.textContent = quality;
            qualityLabel.querySelector('svg').setAttribute('class', `w-4 h-4 ${qualityColor.includes('yellow') ? 'text-yellow-500' : qualityColor.includes('blue') ? 'text-blue-500' : qualityColor.includes('green') ? 'text-green-500' : qualityColor.includes('purple') ? 'text-purple-500' : 'text-gray-500'}`);

            // Add reference images label (with toggle functionality)
            setupRefLabel(imgObj);
        } else {
            lightboxMeta.classList.add('hidden');
        }
        // Private toggle
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
        // Show delete button for admins and owners
        if (deleteImageBtn) {
            const isOwner = imgObj.user && userName.textContent && imgObj.user === userName.textContent.trim();
            if (isAdmin || isOwner) {
                deleteImageBtn.classList.remove('hidden');
            } else {
                deleteImageBtn.classList.add('hidden');
            }
        }
        // Show batch thumbnails (if batch)
        renderBatchThumbnails(imgObj);
        // Always show navigation (prev/next)
        updateLightboxNav();
        // Update archive toggle label based on current image status
        updateArchiveToggleLabel();
    }
    function updateLightboxNav() {
        // If a direct image is shown, navigation is based on galleryImages
        if (galleryImages.length > 1) {
            lightboxPrev.classList.remove('hidden');
            lightboxNext.classList.remove('hidden');
        } else {
            lightboxPrev.classList.add('hidden');
            lightboxNext.classList.add('hidden');
        }
        let idx = currentGalleryIndex;
        if (tempDirectImage) {
            // If the image is not in the gallery, find the batch main image in galleryImages
            const batchMain = galleryImages.find(g => g.batchId === tempDirectImage.batchId && g.isMainImage === '1');
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
                // If the image is not in the gallery, find the batch main image in galleryImages
                const batchMain = galleryImages.find(g => g.batchId === tempDirectImage.batchId && g.isMainImage === '1');
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
                // If the image is not in the gallery, find the batch main image in galleryImages
                const batchMain = galleryImages.find(g => g.batchId === tempDirectImage.batchId && g.isMainImage === '1');
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
    // Open via CustomEvent
    window.addEventListener('openLightbox', (e) => {
        openGalleryLightbox(e.detail.index);
    });

    // Open a specific batch image
    window.addEventListener('showBatchImage', (e) => {
        showBatchImageDirect(e.detail.image);
        lightbox.classList.remove('hidden');
        lightbox.classList.add('active');
    });

    // Helper: returns the currently shown image object (gallery or direct batch image)
    function getCurrentLightboxImage() {
        if (tempDirectImage) return tempDirectImage;
        if (currentGalleryIndex >= 0 && galleryImages[currentGalleryIndex]) return galleryImages[currentGalleryIndex];
        return null;
    }
    // --- Lightbox Buttons ---
    if (lightboxDownloadBtn) {
        lightboxDownloadBtn.onclick = null;
        
        // Create download dropdown container (initially hidden)
        const downloadDropdown = document.createElement('div');
        downloadDropdown.id = 'downloadDropdown';
        downloadDropdown.className = 'hidden absolute top-full right-0 mt-1 bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-gray-200 dark:border-slate-700 py-2 z-50 min-w-[180px]';
        downloadDropdown.innerHTML = `
            <button id="downloadSingleBtn" class="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700 flex items-center gap-2">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3"/>
                </svg>
                <span data-translate="lightbox.download.single">Dieses Bild</span>
            </button>
            <button id="downloadBatchBtn" class="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700 flex items-center gap-2">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/>
                </svg>
                <span data-translate="lightbox.download.batch">Alle Variationen</span>
            </button>
        `;
        lightboxDownloadBtn.parentElement.style.position = 'relative';
        lightboxDownloadBtn.parentElement.appendChild(downloadDropdown);

        lightboxDownloadBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const currentImage = getCurrentLightboxImage();
            if (!currentImage) return;

        // Check if batch has multiple images
            const isBatch = currentImage.batchId && allImages.filter(img => img.batchId === currentImage.batchId).length > 1;
            
            if (isBatch) {
                // Show dropdown
                downloadDropdown.classList.remove('hidden');
            } else {
                // Direct download for single images
                downloadSingleImage(currentImage);
            }
        });

        // Handlers for dropdown options
        document.getElementById('downloadSingleBtn').addEventListener('click', (e) => {
            e.stopPropagation();
            downloadDropdown.classList.add('hidden');
            const currentImage = getCurrentLightboxImage();
            if (currentImage) downloadSingleImage(currentImage);
        });

        document.getElementById('downloadBatchBtn').addEventListener('click', async (e) => {
            e.stopPropagation();
            downloadDropdown.classList.add('hidden');
            const currentImage = getCurrentLightboxImage();
            if (!currentImage || !currentImage.batchId) return;
            
            try {
                // Download Batch als ZIP
                window.location.href = `api/zip_download.php?batchId=${encodeURIComponent(currentImage.batchId)}`;
            } catch (error) {
                console.error('Batch download failed:', error);
                alert(translate('lightbox.error.downloadBatchFailed'));
            }
        });

        // Close dropdown on outside click
        document.addEventListener('click', () => {
            downloadDropdown.classList.add('hidden');
        });

        // Helper for a single image download
        function downloadSingleImage(image) {
            const link = document.createElement('a');
            link.href = image.file;
            const filename = image.prompt ?
                image.prompt.substring(0, 30).replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, '') :
                'generated_image';
            link.download = `${filename}.png`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
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
            // Erzwinge OpenAI-Modus
            const openaiBtn = document.getElementById('modeOpenAI');
            if (openaiBtn) openaiBtn.click();
            const promptInput = document.getElementById('prompt');
            promptInput.value = imgObj.prompt;
            if (imgObj.aspect_class) {
                const val = imgObj.aspect_class;
                const aspectBtn = document.querySelector(`.aspect-btn[data-value="${val}"]`);
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
                    updateImagePreviews(uploadedFiles, imagePreviewContainer, removeAllImagesBtn, updateTotalCost);
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

    // Robust check via DB flag and dynamic insertion of the Gemini button
    async function ensureGeminiEditButton(imgObj) {
        try {
            const res = await fetch('api/get_customization.php');
            const cfg = await res.json();
            const available = !!(cfg && cfg.geminiAvailable === true);
            const actionsContainer = reusePromptBtn ? reusePromptBtn.parentElement : null;
            if (!actionsContainer) return;
            // Remove existing button to avoid duplicates
            const existing = actionsContainer.querySelector('#editWithGeminiBtn');
            if (existing) existing.remove();
            if (!available) return;
            const editBtn = document.createElement('button');
            editBtn.type = 'button';
            editBtn.id = 'editWithGeminiBtn';
            editBtn.className = 'flex items-center justify-center gap-2 w-full px-4 py-2 text-sm font-medium text-yellow-900 bg-yellow-100 hover:bg-yellow-200 dark:bg-yellow-500/20 dark:hover:bg-yellow-500/30 dark:text-yellow-300 rounded-lg transition-all duration-200';
            editBtn.innerHTML = `
                <span class="text-base">🍌</span>
                <span data-translate="lightbox.actions.editWithGemini">${translate('lightbox.actions.editWithGemini')}</span>
            `;
            actionsContainer.appendChild(editBtn);

            editBtn.addEventListener('click', async (e) => {
                e.stopPropagation();
                if (!imgObj) return;
                // Switch to Gemini mode
                const geminiBtn = document.getElementById('modeGemini');
                if (geminiBtn) geminiBtn.click();
                // Do not carry over the prompt
                const promptInput = document.getElementById('prompt');
                if (promptInput) promptInput.value = '';
                // Aktuelles Bild als Eingabebild setzen
                try {
                    const response = await fetch(imgObj.file);
                    const blob = await response.blob();
                    const file = new File([blob], 'edit.png', { type: 'image/png' });
                    uploadedFiles.length = 0;
                    uploadedFiles.push(file);
                    updateGeminiUploadGrid();
                    updateTotalCost();
                } catch (err) {
                    console.error('Failed to prepare image for Gemini:', err);
                }
                // Close lightbox
                lightbox.classList.add('hidden');
                lightbox.classList.remove('active');
                lightboxImage.src = '#';
                setCurrentGalleryIndex(-1);
                window.scrollTo({ top: 0, behavior: 'smooth' });
                if (promptInput) promptInput.focus();
            });
        } catch (e) {
            // Silently ignore errors — the button will simply not be shown
        }
    }

    // (The Gemini button is managed dynamically in ensureGeminiEditButton())
    if (deleteImageBtn) {
        // Build dropdown for delete/archive actions
        const actionsDropdown = document.createElement('div');
        actionsDropdown.id = 'deleteActionsDropdown';
        actionsDropdown.className = 'hidden absolute top-full right-0 mt-1 bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-gray-200 dark:border-slate-700 py-2 z-50 min-w-[220px]';
        actionsDropdown.innerHTML = `
            <button id=\"lbArchiveToggleBtn\" class=\"w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700 flex items-center gap-2\">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M20 13V7a2 2 0 00-2-2h-3.586a1 1 0 01-.707-.293l-1.414-1.414A1 1 0 0011.586 3H8a2 2 0 00-2 2v6"/>
                    <path stroke-linecap="round" stroke-linejoin="round" d="M8 11v10a2 2 0 002 2h4a2 2 0 002-2V11M8 7h8"/>
                </svg>
                <span id=\"lbArchiveToggleLabel\"></span>
            </button>
            <div class="my-1 border-t border-gray-200 dark:border-slate-700"></div>
            <button id="lbDeleteBtn" class="w-full text-left px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6"/>
                    <path stroke-linecap="round" stroke-linejoin="round" d="M9 7h6m2 0h-2m-6 0H7m2-2a2 2 0 012-2h2a2 2 0 012 2"/>
                </svg>
                <span data-translate="lightbox.actions.delete">Löschen</span>
            </button>
        `;
        // Positioning container
        const container = deleteImageBtn.parentElement;
        if (container) {
            container.style.position = 'relative';
            container.appendChild(actionsDropdown);
        }

        // Initialize label
        try {
            const label = actionsDropdown.querySelector('#lbArchiveToggleLabel');
            if (label) label.textContent = translate('lightbox.actions.archive');
        } catch (_) {}

        // Toggle dropdown on button click
        deleteImageBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            // Update archive/unarchive label dynamically using helper function
            updateArchiveToggleLabel();
            actionsDropdown.classList.toggle('hidden');
        });
        // Close on outside click
        document.addEventListener('click', () => actionsDropdown.classList.add('hidden'));

        // Archive/Unarchive handler
        document.getElementById('lbArchiveToggleBtn').addEventListener('click', async (e) => {
            e.stopPropagation();
            actionsDropdown.classList.add('hidden');
            const currentImage = (function(){
                if (currentGalleryIndex >= 0 && galleryImages[currentGalleryIndex]) return galleryImages[currentGalleryIndex];
                // When showing direct image (from archive tab)
                if (typeof getCurrentLightboxImage === 'function') return getCurrentLightboxImage();
                return null;
            })();
            if (!currentImage) return;
            const isArchived = currentImage.archived === '1';
            // Batch if present, else single
            const isBatch = !!currentImage.batchId && allImages.filter(img => img.batchId === currentImage.batchId).length > 1;
            try {
                const body = isBatch
                    ? { batchId: currentImage.batchId, archived: isArchived ? 0 : 1 }
                    : { filename: currentImage.file ? currentImage.file.split('/').pop() : (currentImage.filename || ''), archived: isArchived ? 0 : 1 };
                const resp = await fetch('api/set_archived.php', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(body)
                });
                if (!resp.ok) {
                    const err = await resp.json().catch(() => ({}));
                    throw new Error(err.error_key || 'archive_failed');
                }
                await loadImageGrid();
                try { window.dispatchEvent(new CustomEvent('refreshMyImages')); } catch (_) {}
                // For reliability of state and labels, reload the page after (de)archiving
                window.location.reload();
            } catch (err) {
                alert(translate('lightbox.error.archiveFailed'));
            }
        });

        // Delete handler from dropdown
        document.getElementById('lbDeleteBtn').addEventListener('click', async (e) => {
            e.stopPropagation();
            actionsDropdown.classList.add('hidden');
            const currentImage = (function(){
                if (currentGalleryIndex >= 0 && galleryImages[currentGalleryIndex]) return galleryImages[currentGalleryIndex];
                if (typeof getCurrentLightboxImage === 'function') return getCurrentLightboxImage();
                return null;
            })();
            if (!currentImage) return;
            let batchDelete = false;
            let batchSize = 1;
            if (currentImage.batchId) {
                batchSize = allImages.filter(img => img.batchId === currentImage.batchId).length;
                batchDelete = batchSize > 1;
            }
            let confirmMsg = translate('lightbox.deleteConfirm.single');
            if (batchDelete) {
                confirmMsg = translate('lightbox.deleteConfirm.batch.prefix') + batchSize + translate('lightbox.deleteConfirm.batch.suffix');
            }
            if (!confirm(confirmMsg)) return;
            try {
                const body = batchDelete
                    ? { batchId: currentImage.batchId }
                    : { filename: currentImage.file };
                const response = await fetch('api/delete_image.php', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(body)
                });
                if (!response.ok) {
                    const error = await response.json().catch(() => ({}));
                    throw new Error(error.error || translate('lightbox.error.deleteFailedGeneral'));
                }
                lightbox.classList.add('hidden');
                lightbox.classList.remove('active');
                lightboxImage.src = '#';
                setCurrentGalleryIndex(-1);
                await loadImageGrid();
                alert(batchDelete ? translate('lightbox.alert.batchDeleteSuccess') : translate('lightbox.alert.singleDeleteSuccess'));
            } catch (error) {
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
                    let batchList = allImages.filter(img => img.batchId === currentImage.batchId);
                    // Fallback: falls aus Archiv geöffnet und nicht in allImages vorhanden
                    if ((!batchList || batchList.length === 0) && tempDirectImage && Array.isArray(tempDirectImage.batchImages)) {
                        batchList = tempDirectImage.batchImages;
                    }
                    if (batchList && batchList.length > 0) {
                        filesToUpdate = batchList.map(img => img.file.split('/').pop());
                    }
                }
                for (const filename of filesToUpdate) {
                    const response = await fetch('api/set_private.php', {
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
                // After reload: reopen lightbox if applicable
                let reopenIdx = -1;
                if (currentImage.batchId) {
                    reopenIdx = galleryImages.findIndex(img => img.batchId === currentImage.batchId && img.file === currentImage.file);
                } else {
                    reopenIdx = galleryImages.findIndex(img => img.file === currentImage.file);
                }
                if (reopenIdx !== -1) {
                    openGalleryLightbox(reopenIdx);
                } else {
                    // Direkt geöffnet (z.B. Archiv): Lightbox offen halten und Inhalt aktualisieren
                    try {
                        const updated = { ...currentImage, private: (isPrivate ? '1' : '0') };
                        if (tempDirectImage && Array.isArray(tempDirectImage.batchImages)) {
                            updated.batchImages = tempDirectImage.batchImages;
                        }
                        showBatchImageDirect(updated);
                    } catch (_) {
                    lightbox.classList.add('hidden');
                    lightbox.classList.remove('active');
                    lightboxImage.src = '#';
                    setCurrentGalleryIndex(-1);
                }
                }
                // Notify My Images to refresh
                try { window.dispatchEvent(new CustomEvent('refreshMyImages')); } catch (_) {}
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
    // Helper: show an image from allImages directly in the lightbox (no navigation)
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

        // --- Add metadata (same as in openGalleryLightbox) ---
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
            const qualityKeyMap = { 'low': 'settings.quality.low', 'medium': 'settings.quality.medium', 'high': 'settings.quality.high', 'gemini': 'settings.quality.gemini' };
            const quality = translate(qualityKeyMap[imgObj.quality] || imgObj.quality);
            let aspectRatio = imgObj.aspect_class;
            if (typeof aspectRatio === 'string' && aspectRatio.includes('x')) {
                const [w, h] = aspectRatio.toLowerCase().split('x');
                const wf = parseFloat(w), hf = parseFloat(h);
                if (wf > 0 && hf > 0) {
                    const r = wf / hf;
                    const allowed = { '1:1': 1.0, '2:3': 2/3, '3:2': 3/2 };
                    let best = '1:1', bestDiff = Infinity;
                    for (const [k, v] of Object.entries(allowed)) {
                        const d = Math.abs(r - v);
                        if (d < bestDiff) { best = k; bestDiff = d; }
                    }
                    aspectRatio = best;
                }
            }
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

            // Referenzbilder Label hinzufügen (mit Toggle-Funktionalität)
            setupRefLabel(imgObj);
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
        // Update archive toggle label based on current image status
        updateArchiveToggleLabel();
    }

    // Helper: Update archive/unarchive label in dropdown based on current image
    function updateArchiveToggleLabel() {
        try {
            const labelEl = document.getElementById('lbArchiveToggleLabel');
            if (!labelEl) return;
            const currentImage = getCurrentLightboxImage();
            if (!currentImage) {
                labelEl.textContent = translate('lightbox.actions.archive');
                return;
            }
            // Check archived status: first from image object, then fallback to tempDirectImage
            const isArchived = currentImage.archived === '1' || (tempDirectImage && tempDirectImage.archived === '1');
            labelEl.textContent = isArchived ? translate('lightbox.actions.unarchive') : translate('lightbox.actions.archive');
        } catch (_) {
            // Fallback
            try {
                const labelEl = document.getElementById('lbArchiveToggleLabel');
                if (labelEl) labelEl.textContent = translate('lightbox.actions.archive');
            } catch (_) {}
        }
    }
} 