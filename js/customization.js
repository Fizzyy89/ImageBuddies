import { changeLanguage, translate } from './i18n.js';

let currentCustomization = {};

// Header Visibility Handler
function updateHeaderVisibility(hideHeader, isInitialLoad = false) {
    const heroSection = document.querySelector('section.pt-32.pb-16.px-4');
    const mainContentContainer = document.getElementById('mainContentContainer');
    
    if (heroSection && mainContentContainer) {
        if (hideHeader) {
            heroSection.style.display = 'none';
            mainContentContainer.style.paddingTop = '7rem';
            // Scroll nach oben, beim initialen Laden instant, sonst smooth
            window.scrollTo({
                top: 0,
                behavior: isInitialLoad ? 'instant' : 'smooth'
            });
        } else {
            heroSection.style.display = '';
            mainContentContainer.style.paddingTop = '';
        }
    }
}

// Notification Helper
function showNotification(messageKey, type = 'success') {
    const notification = document.createElement('div');
    notification.className = `fixed bottom-4 right-4 z-[3000] rounded-lg px-4 py-3 shadow-lg ${
        type === 'success' 
            ? 'bg-green-50 text-green-700 border border-green-200' 
            : 'bg-red-50 text-red-700 border border-red-200'
    }`;
    notification.textContent = translate(messageKey);

    document.body.appendChild(notification);

    setTimeout(() => {
        notification.remove();
    }, 3000);
}

// Features dynamisch laden
function updateFeaturesInputs(features = [], featuresContainer) {
    if (!featuresContainer) {
        return;
    }
    
    featuresContainer.innerHTML = '';
    features.forEach((feature, index) => {
        const div = document.createElement('div');
        div.innerHTML = `
            <div class="flex items-center gap-3">
                <input type="text" name="features[${index}]" value="${feature}" 
                       class="flex-1 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg px-4 py-2.5 text-gray-700 dark:text-gray-300">
                <button type="button" class="delete-feature p-2.5 text-gray-400 hover:text-gray-500 focus:outline-none">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                    </svg>
                </button>
            </div>
        `;
        featuresContainer.appendChild(div);

        // Event Listener für Delete-Button
        div.querySelector('.delete-feature').addEventListener('click', () => {
            div.remove();
        });
    });

    // "Feature hinzufügen" Button
    const addButton = document.createElement('button');
    addButton.type = 'button';
    addButton.className = 'w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-slate-700 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-800 transition';
    addButton.innerHTML = `
        <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"/>
        </svg>
        <span></span>
    `;
    addButton.querySelector('span').textContent = translate('customization.addFeature');
    addButton.addEventListener('click', () => {
        const currentFeatures = getCurrentFeatures(featuresContainer);
        updateFeaturesInputs([...currentFeatures, ''], featuresContainer);
    });
    featuresContainer.appendChild(addButton);
}

// Aktuelle Features aus den Inputs holen
function getCurrentFeatures(featuresContainer) {
    return Array.from(featuresContainer.querySelectorAll('input[type="text"]'))
        .map(input => input.value)
        .filter(value => value.trim() !== '');
}

// Language Selection Handler
function initLanguageSelect() {
    const languageSelect = document.getElementById('languageSelect');
    if (!languageSelect) return;

    // Update language select when customization is loaded
    document.addEventListener('customizationLoaded', (e) => {
        const data = e.detail;
        if (data.language) {
            languageSelect.value = data.language;
        }
    });

    // Handle language change
    languageSelect.addEventListener('change', async () => {
        const newLanguage = languageSelect.value;
        
        try {
            const response = await fetch('php/update_customization.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...currentCustomization,
                    language: newLanguage
                })
            });

            if (response.ok) {
                await changeLanguage(newLanguage);
                currentCustomization.language = newLanguage;
                showNotification('notification.languageUpdateSuccess');
            } else {
                throw new Error('Failed to update language');
            }
        } catch (error) {
            console.error('Error updating language:', error);
            showNotification('notification.languageUpdateFailed', 'error');
            // Revert select to current language
            languageSelect.value = currentCustomization.language;
        }
    });
}

export function initCustomization() {
    const customButton = document.getElementById('customButton');
    const mobileCustomButton = document.getElementById('mobileCustomButton');
    const customModal = document.getElementById('customModal');
    const closeCustomModal = document.getElementById('closeCustomModal');
    const customizationForm = document.getElementById('customizationForm');
    const resetCustomForm = document.getElementById('resetCustomForm');
    const featuresContainer = document.getElementById('featuresContainer');
    const apiKeyField = document.getElementById('apiKeyField');
    const openaiKeyInput = document.getElementById('openaiKey');
    const toggleApiKey = document.getElementById('toggleApiKey');
    const geminiKeyInput = document.getElementById('geminiKey');
    const toggleGeminiKey = document.getElementById('toggleGeminiKey');
    let isAdmin = false;
    let loadedApiKey = '';
    let loadedGeminiKey = '';

    // Prüfe ob User Admin ist und zeige Button entsprechend
    fetch('php/session_auth.php?action=status')
        .then(res => res.json())
        .then(data => {
            if (data.role === 'admin') {
                customButton?.classList.remove('hidden');
                mobileCustomButton?.classList.remove('hidden');
                isAdmin = true;
                apiKeyField?.classList.remove('hidden');
            } else {
                apiKeyField?.classList.add('hidden');
            }
        });

    // API Key Toggle (Show/Hide) - OpenAI
    if (toggleApiKey && openaiKeyInput) {
        toggleApiKey.addEventListener('click', () => {
            if (openaiKeyInput.type === 'password') {
                openaiKeyInput.type = 'text';
                toggleApiKey.querySelector('svg').innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"/>';
            } else {
                openaiKeyInput.type = 'password';
                toggleApiKey.querySelector('svg').innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path stroke-linecap="round" stroke-linejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>';
            }
        });
    }

    // API Key Toggle (Show/Hide) - Gemini
    if (toggleGeminiKey && geminiKeyInput) {
        toggleGeminiKey.addEventListener('click', () => {
            if (geminiKeyInput.type === 'password') {
                geminiKeyInput.type = 'text';
                toggleGeminiKey.querySelector('svg').innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"/>';
            } else {
                geminiKeyInput.type = 'password';
                toggleGeminiKey.querySelector('svg').innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path stroke-linecap="round" stroke-linejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>';
            }
        });
    }

    // Event Listener
    [customButton, mobileCustomButton].forEach(btn => {
        if (btn) {
            btn.addEventListener('click', () => {
                customModal.classList.remove('hidden');
                loadCustomization(featuresContainer);
                if (isAdmin) {
                    // Load OpenAI API Key
                    if (openaiKeyInput) {
                        fetch('php/api_keys.php?provider=openai')
                            .then(res => res.json())
                            .then(data => {
                                openaiKeyInput.value = data.key ? data.key : '';
                                loadedApiKey = data.key ? data.key : '';
                            })
                            .catch(() => {
                                openaiKeyInput.value = '';
                                loadedApiKey = '';
                            });
                    }
                    // Load Gemini API Key
                    if (geminiKeyInput) {
                        fetch('php/api_keys.php?provider=gemini')
                            .then(res => res.json())
                            .then(data => {
                                geminiKeyInput.value = data.key ? data.key : '';
                                loadedGeminiKey = data.key ? data.key : '';
                            })
                            .catch(() => {
                                geminiKeyInput.value = '';
                                loadedGeminiKey = '';
                            });
                    }
                }
            });
        }
    });

    if (closeCustomModal) {
        closeCustomModal.addEventListener('click', () => {
            customModal.classList.add('hidden');
        });
    }

    // Schließen mit Escape-Taste
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !customModal.classList.contains('hidden')) {
            customModal.classList.add('hidden');
        }
    });

    // Klick außerhalb schließt Modal
    customModal.addEventListener('click', (e) => {
        if (e.target === customModal) {
            customModal.classList.add('hidden');
        }
    });

    // Form Reset Handler
    if (resetCustomForm) {
        resetCustomForm.addEventListener('click', () => {
            loadCustomization(featuresContainer);
            if (isAdmin) {
                if (openaiKeyInput) {
                    openaiKeyInput.value = loadedApiKey;
                }
                if (geminiKeyInput) {
                    geminiKeyInput.value = loadedGeminiKey;
                }
            }
        });
    }

    // Form Submit Handler
    if (customizationForm) {
        customizationForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(customizationForm);
            const data = {
                siteName: formData.get('siteName'),
                poweredBy: formData.get('poweredBy'),
                mainHeadline: formData.get('mainHeadline'),
                mainSubline: formData.get('mainSubline'),
                features: getCurrentFeatures(featuresContainer),
                footerSiteName: formData.get('footerSiteName'),
                footerCompany: formData.get('footerCompany'),
                loginContact: formData.get('loginContact'),
                viewOnlyAllowed: formData.get('viewOnlyAllowed') === 'on',
                hideHeader: formData.get('hideHeader') === 'on',
                language: currentCustomization.language // Preserve current language
            };
            let apiKeyChanged = false;
            let newApiKey = '';
            let geminiKeyChanged = false;
            let newGeminiKey = '';
            
            if (isAdmin) {
                if (openaiKeyInput) {
                    newApiKey = openaiKeyInput.value.trim();
                    apiKeyChanged = newApiKey !== loadedApiKey;
                }
                if (geminiKeyInput) {
                    newGeminiKey = geminiKeyInput.value.trim();
                    geminiKeyChanged = newGeminiKey !== loadedGeminiKey;
                }
            }
            
            try {
                const response = await fetch('php/update_customization.php', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(data)
                });
                const result = await response.json();
                if (result.success) {
                    // Update OpenAI API Key
                    if (isAdmin && apiKeyChanged) {
                        await fetch('php/api_keys.php', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ provider: 'openai', key: newApiKey })
                        })
                        .then(res => res.json())
                        .then(res => {
                            if (res.success) {
                                loadedApiKey = newApiKey;
                                showNotification('notification.apiKeySaveSuccess', 'success');
                            } else {
                                showNotification(res.error || 'notification.apiKeySaveFailed', 'error');
                            }
                        })
                        .catch(() => showNotification('notification.apiKeySaveFailed', 'error'));
                    }
                    // Update Gemini API Key
                    if (isAdmin && geminiKeyChanged) {
                        await fetch('php/api_keys.php', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ provider: 'gemini', key: newGeminiKey })
                        })
                        .then(res => res.json())
                        .then(res => {
                            if (res.success) {
                                loadedGeminiKey = newGeminiKey;
                                showNotification('notification.geminiKeySaveSuccess', 'success');
                            } else {
                                showNotification(res.error || 'notification.geminiKeySaveFailed', 'error');
                            }
                        })
                        .catch(() => showNotification('notification.geminiKeySaveFailed', 'error'));
                    }
                    // Aktualisiere die Seite ohne Neuladen
                    updatePageContent(data);
                    customModal.classList.add('hidden');
                    showNotification('notification.changesSavedSuccess', 'success');
                } else {
                    showNotification(result.error || 'notification.saveFailed', 'error');
                }
            } catch (error) {
                showNotification('notification.saveFailed', 'error');
            }
        });
    }

    // Initial load of customization
    loadCustomization(featuresContainer);
   
    // Apply initial header visibility
    fetch('./php/get_customization.php')
        .then(response => response.json())
        .then(data => {
            updateHeaderVisibility(data.hideHeader || false, true);
        })
        .catch(error => {
            console.error('Error loading initial header visibility:', error);
        });

    // Initialize language selection
    initLanguageSelect();
}

// Lade aktuelle Customization
async function loadCustomization(featuresContainer) {
    try {
        const response = await fetch('./php/get_customization.php');
        const data = await response.json();
        currentCustomization = data;

        // Dispatch event for language select
        document.dispatchEvent(new CustomEvent('customizationLoaded', { detail: data }));

        // Formular mit aktuellen Werten füllen
        const form = document.getElementById('customizationForm');
        if (form) {
            form.elements['siteName'].value = data.siteName || '';
            form.elements['poweredBy'].value = data.poweredBy || '';
            form.elements['mainHeadline'].value = data.mainHeadline || '';
            form.elements['mainSubline'].value = data.mainSubline || '';
            form.elements['footerSiteName'].value = data.footerSiteName || '';
            form.elements['footerCompany'].value = data.footerCompany || '';
            form.elements['loginContact'].value = data.loginContact || '';
            form.elements['viewOnlyAllowed'].checked = data.viewOnlyAllowed || false;
            form.elements['hideHeader'].checked = data.hideHeader || false;

            // Features aktualisieren
            updateFeaturesInputs(data.features || [], featuresContainer);
        } else {
            console.error('Customization form not found!');
        }
    } catch (error) {
        console.error('Error loading customization:', error);
        showNotification('notification.loadSettingsFailed', 'error');
    }
}

// Aktualisiere Seiteninhalte ohne Neuladen
function updatePageContent(data) {
    // Aktualisiere alle Elemente mit data-custom Attribut
    document.querySelectorAll('[data-custom]').forEach(el => {
        const key = el.getAttribute('data-custom');
        if (key === 'mainHeadline' || key === 'loginContact') {
            el.innerHTML = data[key] || '';
        } else {
            el.textContent = data[key] || '';
        }
    });

    // Features dynamisch aktualisieren
    const featuresDisplay = document.getElementById('featuresDisplay');
    if (featuresDisplay && Array.isArray(data.features)) {
        featuresDisplay.innerHTML = '';
        
        // Feature Icons
        const icons = {
            default: `<path stroke-linecap="round" stroke-linejoin="round" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"/>`,
            image: `<path stroke-linecap="round" stroke-linejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/>`,
            speed: `<path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>`,
            security: `<path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/>`
        };

        // Feature Icon Mapping basierend auf Schlüsselwörtern
        function getIconForFeature(feature) {
            const lowerFeature = feature.toLowerCase();
            if (lowerFeature.includes('bild')) return icons.image;
            if (lowerFeature.includes('schnell') || lowerFeature.includes('speed')) return icons.speed;
            if (lowerFeature.includes('sicher') || lowerFeature.includes('security')) return icons.security;
            return icons.default;
        }

        data.features.forEach((feature) => {
            const featureElement = document.createElement('div');
            featureElement.className = 'flex items-center gap-2 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm px-4 py-2 rounded-xl border border-gray-100 dark:border-slate-700';
            featureElement.innerHTML = `
                <svg class="w-5 h-5 text-indigo-500 dark:text-indigo-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                    ${getIconForFeature(feature)}
                </svg>
                <span class="text-gray-600 dark:text-gray-300">${feature}</span>
            `;
            featuresDisplay.appendChild(featureElement);
        });
    }

    // View-Only Feature aktualisieren
    if (!data.viewOnlyAllowed) {
        const viewOnlyBtn = document.getElementById('viewOnlyBtn');
        const viewOnlyInfo = document.getElementById('viewOnlyInfo');
        const mobileViewOnlyInfo = document.getElementById('mobileViewOnlyInfo');
        if (viewOnlyBtn) viewOnlyBtn.style.display = 'none';
        if (viewOnlyInfo) viewOnlyInfo.style.display = 'none';
        if (mobileViewOnlyInfo) mobileViewOnlyInfo.style.display = 'none';
        localStorage.removeItem('viewOnly');
    } else {
        const viewOnlyBtn = document.getElementById('viewOnlyBtn');
        const viewOnlyInfo = document.getElementById('viewOnlyInfo');
        const mobileViewOnlyInfo = document.getElementById('mobileViewOnlyInfo');
        if (viewOnlyBtn) viewOnlyBtn.style.display = '';
        if (viewOnlyInfo) viewOnlyInfo.style.display = '';
        if (mobileViewOnlyInfo) mobileViewOnlyInfo.style.display = '';
    }

    // Header-Bereich verstecken/anzeigen
    updateHeaderVisibility(data.hideHeader || false, false);
} 