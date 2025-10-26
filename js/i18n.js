// Language translations storage
let translations = {};
let currentLanguage = 'en'; // Default language

// Load translations for a specific language
async function loadTranslations(lang) {
    try {
        const response = await fetch(`locales/${lang}.json`);
        if (!response.ok) throw new Error(`Failed to load ${lang} translations`);
        translations = await response.json();
        currentLanguage = lang;
        return true;
    } catch (error) {
        console.error('Error loading translations:', error);
        return false;
    }
}

// Initialize i18n system
async function initI18n() {
    try {
        // Load customization settings to get language
        const customResponse = await fetch('./php/get_customization.php');
        if (!customResponse.ok) throw new Error('Failed to load customization');
        const customization = await customResponse.json();
        
        // Use language from customization or fallback to 'en'
        const lang = customization.language || 'en';
        await loadTranslations(lang);
        
        // Translate all elements with data-translate attribute
        translatePage();
        
        // Return the current language for other uses
        return lang;
    } catch (error) {
        console.error('Error initializing i18n:', error);
        // Fallback to English on error
        await loadTranslations('en');
        translatePage();
        return 'en';
    }
}

// Translate a single key
function translate(key) {
    return translations[key] || key;
}

// Translate all elements on the page
function translatePage() {
    // Handle data-translate attributes
    document.querySelectorAll('[data-translate]').forEach(element => {
        const key = element.getAttribute('data-translate');
        if (translations[key]) {
            element.textContent = translations[key];
        }
    });

    // Handle data-translate-placeholder attributes
    document.querySelectorAll('[data-translate-placeholder]').forEach(element => {
        const key = element.getAttribute('data-translate-placeholder');
        if (translations[key]) {
            element.placeholder = translations[key];
        }
    });

    // Handle data-translate-title attributes
    document.querySelectorAll('[data-translate-title]').forEach(element => {
        const key = element.getAttribute('data-translate-title');
        if (translations[key]) {
            element.title = translations[key];
        }
    });

    // Handle data-translate-aria-label attributes
    document.querySelectorAll('[data-translate-aria-label]').forEach(element => {
        const key = element.getAttribute('data-translate-aria-label');
        if (translations[key]) {
            element.setAttribute('aria-label', translations[key]);
        }
    });

    // Handle data-translate-label attributes (for optgroup labels)
    document.querySelectorAll('[data-translate-label]').forEach(element => {
        const key = element.getAttribute('data-translate-label');
        if (translations[key]) {
            element.label = translations[key];
        }
    });
}

// Change language
async function changeLanguage(lang) {
    if (await loadTranslations(lang)) {
        translatePage();
        return true;
    }
    return false;
}

// Export functions for use in other modules
export {
    initI18n,
    translate,
    translatePage,
    changeLanguage,
    currentLanguage
}; 