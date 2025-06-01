import { translate, currentLanguage } from './i18n.js';
// Prompt- und Referenzbild-Handling-Modul
// Verantwortlich für Prompt-Optimierung, Bild-Upload, Drag&Drop, Bildvorschau, Referenzbilder und Kostenberechnung

export let uploadedFiles = [];

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
        if (uploadedFiles.length >= 8) {
            alert(translate('alert.maxReferenceImagesLimit'));
            return;
        }
        const files = imageItems.map(item => item.getAsFile()).filter(Boolean);
        if (files.length > 0) {
            const remainingSlots = 8 - uploadedFiles.length;
            if (files.length > remainingSlots) {
                alert(translate('alert.maxReferenceImagesRemaining.prefix') + remainingSlots + translate(remainingSlots !== 1 ? 'alert.maxReferenceImagesRemaining.pluralSuffix' : 'alert.maxReferenceImagesRemaining.singularSuffix'));
                uploadedFiles.push(...files.slice(0, remainingSlots));
            } else {
                uploadedFiles.push(...files);
            }
            updateImagePreviews();
        }
    }
}

export function handleImageDrop(e, uploadedFiles, updateImagePreviews, promptInput) {
    e.preventDefault();
    e.stopPropagation();
    promptInput.classList.remove('border-indigo-500');
    if (uploadedFiles.length >= 8) {
        alert(translate('alert.maxReferenceImagesLimit'));
        return;
    }
    const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
    if (files.length > 0) {
        const remainingSlots = 8 - uploadedFiles.length;
        if (files.length > remainingSlots) {
            alert(translate('alert.maxReferenceImagesRemaining.prefix') + remainingSlots + translate(remainingSlots !== 1 ? 'alert.maxReferenceImagesRemaining.pluralSuffix' : 'alert.maxReferenceImagesRemaining.singularSuffix'));
            uploadedFiles.push(...files.slice(0, remainingSlots));
        } else {
            uploadedFiles.push(...files);
        }
        updateImagePreviews();
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
    imagePreviewContainer.className = 'mb-2 grid grid-cols-8 gap-2 w-full';
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
    const remainingSlots = 8 - uploadedFiles.length;
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

export function updateTotalCost() {
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