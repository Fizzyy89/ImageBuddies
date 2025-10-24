import { translate, currentLanguage } from './i18n.js';
// Prompt- und Referenzbild-Handling-Modul
// Verantwortlich für Prompt-Optimierung, Bild-Upload, Drag&Drop, Bildvorschau, Referenzbilder und Kostenberechnung

export let uploadedFiles = [];
export let currentMode = 'openai'; // 'openai' or 'gemini'
export let geminiAvailable = false;

// Cache für die Random-Prompt-Elemente
let randomPromptElements = null;

// Funktion zum Laden der Random-Prompt-Elemente
async function loadRandomPromptElements() {
    if (randomPromptElements) {
        return randomPromptElements;
    }
    
    try {
        const response = await fetch('js/random-prompt-elements.json');
        if (!response.ok) {
            throw new Error('Failed to load random prompt elements');
        }
        randomPromptElements = await response.json();
        return randomPromptElements;
    } catch (error) {
        console.error('Error loading random prompt elements:', error);
        return null;
    }
}

// Funktion zur zufälligen Auswahl eines Elements aus einem Array
function getRandomElement(array) {
    return array[Math.floor(Math.random() * array.length)];
}

// Funktion zur Generierung eines strukturierten Random-Prompts
function generateStructuredRandomPrompt(elements) {
    const subject = getRandomElement(elements.subjects);
    const artStyle = getRandomElement(elements.artStyles);
    const atmosphere = getRandomElement(elements.atmosphere);
    const composition = getRandomElement(elements.composition);
    const colors = getRandomElement(elements.colors);
    const details = getRandomElement(elements.details);
    const template = getRandomElement(elements.templates);
    
    // Template mit den ausgewählten Elementen füllen
    return template
        .replace('{subject}', subject)
        .replace('{artStyle}', artStyle)
        .replace('{atmosphere}', atmosphere)
        .replace('{composition}', composition)
        .replace('{colors}', colors)
        .replace('{details}', details);
}

// Funktion zur Erstellung des sprachspezifischen LLM-Prompts
function createLanguageSpecificPrompt(structuredPrompt) {
    const instruction = translate('prompt.llmInstruction');
    return `${instruction} "${structuredPrompt}"`;
}

export function setOptimizeBtnState(optimizeBtn, promptInput) {
    if (!optimizeBtn) return;
    optimizeBtn.disabled = !promptInput.value.trim();
    optimizeBtn.classList.toggle('opacity-50', optimizeBtn.disabled);
    optimizeBtn.classList.toggle('cursor-not-allowed', optimizeBtn.disabled);
}

export function initSurpriseMeHandler({
    surpriseMeBtn,
    surpriseMeSpinner,
    surpriseMeIcon,
    surpriseMeError,
    promptInput
}) {
    if (!surpriseMeBtn) return;

    surpriseMeBtn.addEventListener('click', async () => {
        surpriseMeError.classList.add('hidden');
        surpriseMeSpinner.classList.remove('hidden');
        surpriseMeIcon.classList.add('hidden');
        surpriseMeBtn.disabled = true;

        try {
            // Lade die Random-Prompt-Elemente
            const elements = await loadRandomPromptElements();
            if (!elements) {
                throw new Error(translate('error.loadRandomElementsFailed'));
            }

            // Generiere einen strukturierten Random-Prompt
            const structuredPrompt = generateStructuredRandomPrompt(elements);

            // Sende den strukturierten Prompt an das LLM zur Verfeinerung
            const response = await fetch('php/openai_proxy.php?endpoint=random', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    prompt: createLanguageSpecificPrompt(structuredPrompt)
                })
            });

            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.error?.message || translate('error.optimizationFailed'));
            }

            const data = await response.json();
            const randomPrompt = data.randomPrompt;

            if (randomPrompt) {
                promptInput.value = randomPrompt;
                setOptimizeBtnState(document.getElementById('optimizePromptBtn'), promptInput);
            } else {
                // Fallback: Verwende den strukturierten Prompt direkt
                promptInput.value = structuredPrompt;
                setOptimizeBtnState(document.getElementById('optimizePromptBtn'), promptInput);
            }
        } catch (e) {
            // Bei Fehler: Versuche Fallback mit direktem strukturiertem Prompt
            try {
                const elements = await loadRandomPromptElements();
                if (elements) {
                    const structuredPrompt = generateStructuredRandomPrompt(elements);
                    promptInput.value = structuredPrompt;
                    setOptimizeBtnState(document.getElementById('optimizePromptBtn'), promptInput);
                } else {
                    throw new Error(translate('error.optimizationFailed'));
                }
            } catch (fallbackError) {
                surpriseMeError.textContent = fallbackError.message || translate('error.optimizationFailed');
                surpriseMeError.classList.remove('hidden');
            }
        } finally {
            surpriseMeSpinner.classList.add('hidden');
            surpriseMeIcon.classList.remove('hidden');
            surpriseMeBtn.disabled = false;
        }
    });
}

export function initPromptHandlers({
    promptInput,
    optimizeBtn,
    optimizeSpinner,
    optimizeIcon,
    optimizeError,
    surpriseMeBtn,
    surpriseMeSpinner,
    surpriseMeIcon,
    surpriseMeError
}) {
    setOptimizeBtnState(optimizeBtn, promptInput);
    promptInput.addEventListener('input', () => setOptimizeBtnState(optimizeBtn, promptInput));

    if (optimizeBtn) {
        optimizeBtn.addEventListener('click', async () => {
            const prompt = promptInput.value.trim();
            if (!prompt) return;

            optimizeError.classList.add('hidden');
            optimizeSpinner.classList.remove('hidden');
            optimizeIcon.classList.add('hidden');
            optimizeBtn.disabled = true;

            try {
                const response = await fetch('php/openai_proxy.php?endpoint=optimize', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ prompt })
                });

                if (!response.ok) {
                    const err = await response.json();
                    throw new Error(err.error?.message || translate('error.optimizationFailed'));
                }

                const data = await response.json();
                const optimizedPrompt = data.optimizedPrompt;

                if (optimizedPrompt) {
                    promptInput.value = optimizedPrompt;
                    setOptimizeBtnState(optimizeBtn, promptInput);
                } else {
                    throw new Error(translate('error.noOptimizationReceived'));
                }
            } catch (e) {
                optimizeError.textContent = e.message || translate('error.optimizationFailed');
                optimizeError.classList.remove('hidden');
            } finally {
                optimizeSpinner.classList.add('hidden');
                optimizeIcon.classList.remove('hidden');
                optimizeBtn.disabled = !promptInput.value.trim();
            }
        });
    }

    // Initialize surprise me handler
    initSurpriseMeHandler({
        surpriseMeBtn,
        surpriseMeSpinner,
        surpriseMeIcon,
        surpriseMeError,
        promptInput
    });
}

export function createImageUploadInput(onChange) {
    const imageUploadInput = document.createElement('input');
    imageUploadInput.type = 'file';
    imageUploadInput.accept = 'image/png, image/jpeg';
    imageUploadInput.multiple = true;
    imageUploadInput.style.display = 'none';
    imageUploadInput.addEventListener('change', onChange);
    document.body.appendChild(imageUploadInput);
    return imageUploadInput;
}

export function handleImagePaste(e, uploadedFiles, updateImagePreviews) {
    const items = Array.from(e.clipboardData.items);
    const imageItems = items.filter(item => item.type.startsWith('image/'));
    if (imageItems.length > 0) {
        e.preventDefault();
        const maxImages = currentMode === 'gemini' ? 3 : 8;
        if (uploadedFiles.length >= maxImages) {
            alert(currentMode === 'gemini' ? translate('gemini.maxImagesWarning') : translate('alert.maxReferenceImagesLimit'));
            return;
        }
        const files = imageItems.map(item => item.getAsFile()).filter(Boolean);
        if (files.length > 0) {
            const remainingSlots = maxImages - uploadedFiles.length;
            if (files.length > remainingSlots) {
                alert(translate('alert.maxReferenceImagesRemaining.prefix') + remainingSlots + translate(remainingSlots !== 1 ? 'alert.maxReferenceImagesRemaining.pluralSuffix' : 'alert.maxReferenceImagesRemaining.singularSuffix'));
                uploadedFiles.push(...files.slice(0, remainingSlots));
            } else {
                uploadedFiles.push(...files);
            }
            
            // Update UI based on mode
            if (currentMode === 'gemini') {
                updateGeminiUploadGrid();
                updateTotalCost();
            } else {
                updateImagePreviews();
            }
        }
    }
}

export function handleImageDrop(e, uploadedFiles, updateImagePreviews, promptInput) {
    e.preventDefault();
    e.stopPropagation();
    promptInput.classList.remove('border-indigo-500');
    const maxImages = currentMode === 'gemini' ? 3 : 8;
    if (uploadedFiles.length >= maxImages) {
        alert(currentMode === 'gemini' ? translate('gemini.maxImagesWarning') : translate('alert.maxReferenceImagesLimit'));
        return;
    }
    const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
    if (files.length > 0) {
        const remainingSlots = maxImages - uploadedFiles.length;
        if (files.length > remainingSlots) {
            alert(translate('alert.maxReferenceImagesRemaining.prefix') + remainingSlots + translate(remainingSlots !== 1 ? 'alert.maxReferenceImagesRemaining.pluralSuffix' : 'alert.maxReferenceImagesRemaining.singularSuffix'));
            uploadedFiles.push(...files.slice(0, remainingSlots));
        } else {
            uploadedFiles.push(...files);
        }
        
        // Update UI based on mode
        if (currentMode === 'gemini') {
            updateGeminiUploadGrid();
            updateTotalCost();
        } else {
            updateImagePreviews();
        }
    }
}

export function updateImagePreviews(uploadedFiles, imagePreviewContainer, removeAllImagesBtn, updateTotalCost) {
    imagePreviewContainer.innerHTML = '';
    if (uploadedFiles.length === 0) {
        imagePreviewContainer.classList.add('hidden');
        removeAllImagesBtn?.classList.add('hidden');
        document.getElementById('refImagesCost')?.classList.add('hidden');
        updateTotalCost();
        return;
    }
    imagePreviewContainer.classList.remove('hidden');
    if (uploadedFiles.length > 1) {
        removeAllImagesBtn?.classList.remove('hidden');
    } else {
        removeAllImagesBtn?.classList.add('hidden');
    }
    const gridCols = currentMode === 'gemini' ? 'grid-cols-2' : 'grid-cols-8';
    imagePreviewContainer.className = `mb-2 grid ${gridCols} gap-2 w-full`;
    uploadedFiles.forEach((file, idx) => {
        const wrapper = document.createElement('div');
        wrapper.className = 'relative bg-gray-100 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl flex items-center justify-center overflow-hidden aspect-square w-full';
        const img = document.createElement('img');
        if (file instanceof File) {
            img.src = URL.createObjectURL(file);
        } else {
            const thumbFile = file.split('/').pop();
            const thumbUrl = 'images/thumbs/' + thumbFile;
            img.src = thumbUrl;
        }
        img.alt = translate('altText.referenceImage');
        img.className = 'w-full h-full object-cover rounded-xl hover:scale-105 transition-transform duration-200';
        img.style.cssText = 'image-rendering: auto; display: block; background: #f3f4f6;';
        const removeBtn = document.createElement('button');
        removeBtn.type = 'button';
        removeBtn.title = translate('title.removeImage');
        removeBtn.className = 'absolute top-1 right-1 bg-red-500 hover:bg-red-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-sm shadow-lg transition-transform hover:scale-110';
        removeBtn.innerHTML = '×';
        removeBtn.onclick = () => {
            if (file instanceof File) {
                URL.revokeObjectURL(img.src);
            }
            uploadedFiles.splice(idx, 1);
            updateImagePreviews(uploadedFiles, imagePreviewContainer, removeAllImagesBtn, updateTotalCost);
            updateTotalCost();
        };
        const imageNumber = document.createElement('div');
        imageNumber.className = 'absolute top-1 left-1 bg-black/50 text-white text-xs px-1.5 py-0.5 rounded-md';
        imageNumber.textContent = (idx + 1).toString();
        wrapper.appendChild(img);
        wrapper.appendChild(removeBtn);
        wrapper.appendChild(imageNumber);
        imagePreviewContainer.appendChild(wrapper);
    });
    const maxImages = currentMode === 'gemini' ? 3 : 8;
    const remainingSlots = maxImages - uploadedFiles.length;
    for (let i = 0; i < remainingSlots; i++) {
        const placeholder = document.createElement('div');
        placeholder.className = 'relative bg-gray-50 dark:bg-slate-800/50 border border-dashed border-gray-200 dark:border-slate-700 rounded-xl flex items-center justify-center aspect-square w-full';
        placeholder.innerHTML = `
            <div class="text-gray-300 dark:text-gray-600">
                <svg class="w-6 h-6" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z"/>
                </svg>
            </div>
        `;
        imagePreviewContainer.appendChild(placeholder);
    }
    let costDisplay = document.getElementById('refImagesCost');
    if (!costDisplay) {
        costDisplay = document.createElement('div');
        costDisplay.id = 'refImagesCost';
        imagePreviewContainer.parentNode.insertBefore(costDisplay, imagePreviewContainer.nextSibling);
    }
    const totalCost = uploadedFiles.length * 3;
    costDisplay.className = 'flex items-center gap-3 text-sm mb-4 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 px-4 py-2.5 rounded-lg border border-indigo-100 dark:border-indigo-500/20';
    costDisplay.innerHTML = `
        <div class="flex items-center gap-2">
            <svg class="w-4 h-4 text-indigo-500 dark:text-indigo-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/>
            </svg>
            <span class="font-medium">${uploadedFiles.length + translate(uploadedFiles.length !== 1 ? 'label.referenceImages.plural' : 'label.referenceImages.singular')}</span>
        </div>
        <div class="h-4 w-px bg-indigo-200 dark:bg-indigo-500/30"></div>
        <div class="flex items-center gap-2">
            <svg class="w-4 h-4 text-indigo-500 dark:text-indigo-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
            <span>${translate('label.additionalCosts.prefix') + totalCost + translate('label.additionalCosts.suffix')}</span>
        </div>
    `;
    costDisplay.classList.remove('hidden');
    updateTotalCost();
}

export function initModeToggle() {
    const modeToggleContainer = document.getElementById('modeToggleContainer');
    const modeOpenAIBtn = document.getElementById('modeOpenAI');
    const modeGeminiBtn = document.getElementById('modeGemini');
    
    // Check availability flag from customization (no key disclosure, works for non-admins)
    fetch('php/get_customization.php')
        .then(res => res.json())
        .then(cfg => {
            if (cfg && cfg.geminiAvailable === true) {
                geminiAvailable = true;
                modeToggleContainer?.classList.remove('hidden');
            } else {
                geminiAvailable = false;
                modeToggleContainer?.classList.add('hidden');
                // ensure mode is openai when gemini is not available
                currentMode = 'openai';
                updateUIForMode();
            }
        })
        .catch(() => {
            geminiAvailable = false;
            modeToggleContainer?.classList.add('hidden');
            currentMode = 'openai';
            updateUIForMode();
        });
    
    // Mode toggle handlers
    if (modeOpenAIBtn && modeGeminiBtn) {
        modeOpenAIBtn.addEventListener('click', () => {
            if (currentMode === 'openai') return;
            currentMode = 'openai';
            modeOpenAIBtn.classList.add('active');
            modeGeminiBtn.classList.remove('active');
            updateUIForMode();
        });
        
        modeGeminiBtn.addEventListener('click', () => {
            if (currentMode === 'gemini') return;
            currentMode = 'gemini';
            modeGeminiBtn.classList.add('active');
            modeOpenAIBtn.classList.remove('active');
            updateUIForMode();
        });
    }
}

function updateUIForMode() {
    const aspectRatioGroup = document.getElementById('aspectRatioGroup');
    const qualityGroup = document.getElementById('qualityGroup');
    const imageCountGroup = document.getElementById('imageCountGroup');
    const addReferenceImageBtn = document.getElementById('addReferenceImageBtn');
    const optimizePromptBtn = document.getElementById('optimizePromptBtn');
    const surpriseMeBtn = document.getElementById('surpriseMeBtn');
    const generateBtnText = document.getElementById('generateBtnText');
    const imagePreviewContainer = document.getElementById('imagePreviewContainer');
    const removeAllImagesBtn = document.getElementById('removeAllImagesBtn');
    const geminiUploadArea = document.getElementById('geminiUploadArea');
    const promptDescriptionLabel = document.getElementById('promptDescriptionLabel');
    const promptTextarea = document.getElementById('prompt');
    const firstSeparator = document.getElementById('firstSeparator');
    
    if (currentMode === 'gemini') {
        // Gemini Mode - Hide OpenAI specific controls
        aspectRatioGroup?.parentElement?.parentElement?.classList.add('hidden');
        qualityGroup?.parentElement?.parentElement?.classList.add('hidden');
        imageCountGroup?.parentElement?.classList.add('hidden');
        optimizePromptBtn?.classList.add('hidden');
        surpriseMeBtn?.classList.add('hidden');
        addReferenceImageBtn?.parentElement?.classList.add('hidden');
        imagePreviewContainer?.classList.add('hidden');
        removeAllImagesBtn?.classList.add('hidden');
        firstSeparator?.classList.add('hidden');
        
        // Show Gemini upload area
        geminiUploadArea?.classList.remove('hidden');
        
        // Change prompt labels
        if (promptDescriptionLabel) {
            promptDescriptionLabel.setAttribute('data-translate', 'gemini.prompt.description');
            promptDescriptionLabel.textContent = translate('gemini.prompt.description');
        }
        if (promptTextarea) {
            promptTextarea.setAttribute('data-translate-placeholder', 'gemini.prompt.placeholder');
            promptTextarea.placeholder = translate('gemini.prompt.placeholder');
        }
        
        // Change button text
        if (generateBtnText) {
            generateBtnText.textContent = translate('generateButton.editImage');
        }
        
        // Limit to max 3 images for Gemini
        if (uploadedFiles.length > 3) {
            uploadedFiles = uploadedFiles.slice(0, 3);
        }
        
        // Update Gemini upload grid
        updateGeminiUploadGrid();
        
    } else {
        // OpenAI Mode - Show all controls
        aspectRatioGroup?.parentElement?.parentElement?.classList.remove('hidden');
        qualityGroup?.parentElement?.parentElement?.classList.remove('hidden');
        imageCountGroup?.parentElement?.classList.remove('hidden');
        optimizePromptBtn?.classList.remove('hidden');
        surpriseMeBtn?.classList.remove('hidden');
        addReferenceImageBtn?.parentElement?.classList.remove('hidden');
        firstSeparator?.classList.remove('hidden');
        
        // Hide Gemini upload area
        geminiUploadArea?.classList.add('hidden');
        
        // Restore prompt labels
        if (promptDescriptionLabel) {
            promptDescriptionLabel.setAttribute('data-translate', 'prompt.description');
            promptDescriptionLabel.textContent = translate('prompt.description');
        }
        if (promptTextarea) {
            promptTextarea.setAttribute('data-translate-placeholder', 'prompt.placeholder');
            promptTextarea.placeholder = translate('prompt.placeholder');
        }
        
        // Restore button text
        if (generateBtnText) {
            const imageCountBtn = document.querySelector('.image-count-btn.selected');
            const imageCount = imageCountBtn ? parseInt(imageCountBtn.dataset.value) : 1;
            generateBtnText.textContent = translate(imageCount > 1 ? 'generateButton.textPlural' : 'generateButton.textSingular');
        }
        
        // Update OpenAI preview container
        updateImagePreviews(uploadedFiles, imagePreviewContainer, removeAllImagesBtn, updateTotalCost);
    }
    
    updateTotalCost();
}

// Update Gemini upload grid with 3 slots (first one larger)
export function updateGeminiUploadGrid() {
    const grid = document.getElementById('geminiUploadGrid');
    if (!grid) return;
    
    grid.innerHTML = '';
    
    // Create side container for slots 2 and 3
    const sideContainer = document.createElement('div');
    sideContainer.className = 'flex flex-col gap-3';
    
    for (let i = 0; i < 3; i++) {
        const slot = document.createElement('div');
        
        // First slot is larger (flex-1 with fixed height), others are smaller and in side container
        if (i === 0) {
            slot.className = 'relative bg-white dark:bg-slate-800 border-2 border-dashed border-gray-300 dark:border-slate-600 rounded-xl flex-1 h-64 flex items-center justify-center overflow-hidden cursor-pointer hover:border-yellow-500 dark:hover:border-yellow-400 transition-colors';
        } else {
            slot.className = 'relative bg-white dark:bg-slate-800 border-2 border-dashed border-gray-300 dark:border-slate-600 rounded-xl aspect-square w-32 flex items-center justify-center overflow-hidden cursor-pointer hover:border-yellow-500 dark:hover:border-yellow-400 transition-colors';
        }
        
        // Add opacity for unfilled optional slots (2 and 3)
        if (i > 0 && !uploadedFiles[i]) {
            slot.classList.add('opacity-60');
        }
        
        if (uploadedFiles[i]) {
            // Show uploaded image
            const img = document.createElement('img');
            if (uploadedFiles[i] instanceof File) {
                img.src = URL.createObjectURL(uploadedFiles[i]);
            } else {
                const thumbFile = uploadedFiles[i].split('/').pop();
                img.src = 'images/thumbs/' + thumbFile;
            }
            img.alt = translate('altText.referenceImage');
            img.className = i === 0 ? 'max-w-full max-h-full object-contain' : 'w-full h-full object-cover';
            
            const removeBtn = document.createElement('button');
            removeBtn.type = 'button';
            removeBtn.className = 'absolute top-2 right-2 bg-red-500 hover:bg-red-600 text-white rounded-full w-8 h-8 flex items-center justify-center shadow-lg transition-transform hover:scale-110 z-10';
            removeBtn.innerHTML = '×';
            removeBtn.onclick = (e) => {
                e.stopPropagation();
                if (uploadedFiles[i] instanceof File) {
                    URL.revokeObjectURL(img.src);
                }
                uploadedFiles.splice(i, 1);
                updateGeminiUploadGrid();
                updateTotalCost();
            };
            
            slot.appendChild(img);
            slot.appendChild(removeBtn);
        } else {
            // Show upload placeholder
            const iconSize = i === 0 ? 'w-16 h-16' : 'w-8 h-8';
            const textSize = i === 0 ? 'text-sm' : 'text-xs';
            const label = i === 0 ? translate('gemini.uploadArea.dragDrop') : '+';
            
            slot.innerHTML = `
                <div class="flex flex-col items-center justify-center gap-2 p-4 text-center">
                    ${i === 0 ? `
                        <svg class="${iconSize} text-yellow-500 dark:text-yellow-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"/>
                        </svg>
                        <span class="${textSize} text-gray-500 dark:text-gray-400" data-translate="gemini.uploadArea.dragDrop">${label}</span>
                    ` : `
                        <svg class="${iconSize} text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"/>
                        </svg>
                        <span class="${textSize} text-gray-400 dark:text-gray-500">${translate('label.optional')}</span>
                    `}
                </div>
            `;
            
            slot.onclick = () => {
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = 'image/png, image/jpeg';
                input.onchange = (e) => {
                    const file = e.target.files[0];
                    if (file && file.type.startsWith('image/')) {
                        if (uploadedFiles.length < 3) {
                            uploadedFiles.push(file);
                            updateGeminiUploadGrid();
                            updateTotalCost();
                        }
                    }
                };
                input.click();
            };
            
            // Add drag and drop support
            slot.ondragover = (e) => {
                e.preventDefault();
                slot.classList.add('border-yellow-500', 'dark:border-yellow-400', 'bg-yellow-50', 'dark:bg-yellow-900/10');
                if (i > 0) slot.classList.remove('opacity-60');
            };
            
            slot.ondragleave = (e) => {
                e.preventDefault();
                slot.classList.remove('border-yellow-500', 'dark:border-yellow-400', 'bg-yellow-50', 'dark:bg-yellow-900/10');
                if (i > 0 && !uploadedFiles[i]) slot.classList.add('opacity-60');
            };
            
            slot.ondrop = (e) => {
                e.preventDefault();
                slot.classList.remove('border-yellow-500', 'dark:border-yellow-400', 'bg-yellow-50', 'dark:bg-yellow-900/10');
                if (i > 0 && !uploadedFiles[i]) slot.classList.add('opacity-60');
                
                const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
                if (files.length > 0 && uploadedFiles.length < 3) {
                    uploadedFiles.push(files[0]);
                    updateGeminiUploadGrid();
                    updateTotalCost();
                }
            };
        }
        
        // First slot goes directly into grid, others into side container
        if (i === 0) {
            grid.appendChild(slot);
        } else {
            sideContainer.appendChild(slot);
        }
    }
    
    // Add side container to grid
    grid.appendChild(sideContainer);
}

export function updateTotalCost() {
    // In Gemini mode, calculate based on input/output images
    if (currentMode === 'gemini') {
        const inputImageCost = uploadedFiles.length * 15; // 15 cents per input image
        const outputImageCost = 3; // 3 cents for output image
        const totalCost = inputImageCost + outputImageCost;
        
        const costLabel = document.getElementById('costLabel');
        if (costLabel) {
            costLabel.textContent = translate('label.apiCosts.prefix') + totalCost + translate('label.apiCosts.suffix');
        }
        return totalCost;
    }
    
    const qualityBtn = document.querySelector('.quality-btn.selected');
    const imageCountBtn = document.querySelector('.image-count-btn.selected');
    const qualityCosts = {
        'low': 3,
        'medium': 6,
        'high': 25
    };
    const qualityCost = qualityBtn ? qualityCosts[qualityBtn.dataset.value] : 6; // Default: medium
    const imageCount = imageCountBtn ? parseInt(imageCountBtn.dataset.value) : 1;
    const refImagesCost = uploadedFiles.length * 3;
    const totalCost = (qualityCost * imageCount) + refImagesCost;
    
    // Update cost label
    const costLabel = document.getElementById('costLabel');
    if (costLabel) {
        costLabel.textContent = translate('label.apiCosts.prefix') + totalCost + translate('label.apiCosts.suffix');
    }

    // Update generate button text
    const generateBtnText = document.getElementById('generateBtnText');
    if (generateBtnText) {
        generateBtnText.textContent = translate(imageCount > 1 ? 'generateButton.textPlural' : 'generateButton.textSingular');
    }

    return totalCost;
} 