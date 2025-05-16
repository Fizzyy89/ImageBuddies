import { initAuth, checkLogin, setUserUI, showLogin, hideLogin } from './auth.js';
import { initTheme, toggleTheme, syncMobileThemeToggle } from './theme.js';
import { initPromptHandlers, createImageUploadInput, handleImagePaste, handleImageDrop, updateImagePreviews, updateTotalCost, uploadedFiles } from './prompt.js';
import { generateImage, downloadImage } from './generate.js';
import { galleryImages, allImages, showOnlyUserImages, isCompactGrid, updateGridSizeUI, updateGridLayout, loadImageGrid, setShowOnlyUserImages, getShowOnlyUserImages, setIsCompactGrid, getIsCompactGrid } from './gallery.js';
import { initLightbox } from './lightbox.js';
import { initStatistics } from './statistics.js';
import { initUserManagement } from './user_management.js';
import { initUserProfile } from './user_profile.js';
import { initCustomization } from './customization.js';
import { checkSetupRequired, showSetup } from './auth.js';
import { initI18n, translate } from './i18n.js';

document.addEventListener('DOMContentLoaded', async () => {
    // Check if setup is required first
    const setupRequired = await checkSetupRequired();
    if (setupRequired) {
        showSetup();
        return; // End here as setup is required
    }

    // Initialize i18n after confirming setup is complete
    await initI18n();

    // DOM Elements
    const generateBtn = document.getElementById('generateBtn');
    const generateIcon = document.getElementById('generateIcon');
    const generateSpinner = document.getElementById('spinner');
    const generateBtnText = document.getElementById('generateBtnText');
    const promptInput = document.getElementById('prompt');
    const aspectRatioSelect = document.getElementById('aspectRatio');
    const qualitySelect = document.getElementById('quality');
    const generatedImage = document.getElementById('generatedImage');
    const placeholderText = document.getElementById('placeholderText');
    const errorContainer = document.getElementById('error');
    const errorMessageText = document.getElementById('errorMessage');
    const downloadBtn = document.getElementById('downloadBtn');
    const lightbox = document.getElementById('lightbox');
    const lightboxImage = document.getElementById('lightboxImage');
    const addReferenceImageBtn = document.getElementById('addReferenceImageBtn');
    const imagePreviewContainer = document.getElementById('imagePreviewContainer');
    const removeAllImagesBtn = document.getElementById('removeAllImagesBtn');
    const imageGrid = document.getElementById('imageGrid');
    const optimizeBtn = document.getElementById('optimizePromptBtn');
    const optimizeSpinner = document.getElementById('optimizeSpinner');
    const optimizeIcon = document.getElementById('optimizeIcon');
    const optimizeError = document.getElementById('optimizeError');
    const loginOverlay = document.getElementById('loginOverlay');
    const loginForm = document.getElementById('loginForm');
    const loginError = document.getElementById('loginError');
    const userInfo = document.getElementById('userInfo');
    const userName = document.getElementById('userName');
    const logoutBtn = document.getElementById('logoutBtn');
    const blockOverlay = document.getElementById('blockOverlay');
    const lightboxPrompt = document.getElementById('lightboxPrompt');
    const lightboxMeta = document.getElementById('lightboxMeta');
    const themeToggle = document.getElementById('themeToggle');
    const copyPromptBtn = document.getElementById('copyPromptBtn');
    const reusePromptBtn = document.getElementById('reusePromptBtn');
    const lightboxPrev = document.getElementById('lightboxPrev');
    const lightboxNext = document.getElementById('lightboxNext');
    const lightboxCloseBtn = document.getElementById('lightboxCloseBtn');
    const lightboxInner = document.getElementById('lightboxInner');
    const showAllBtn = document.getElementById('showAllBtn');
    const showMineBtn = document.getElementById('showMineBtn');
    const gridNormalBtn = document.getElementById('gridNormalBtn');
    const gridCompactBtn = document.getElementById('gridCompactBtn');
    const lightboxDownloadBtn = document.getElementById('lightboxDownloadBtn');
    const lightboxOpenNewTabBtn = document.getElementById('lightboxOpenNewTabBtn');
    const lightboxCopyUrlBtn = document.getElementById('lightboxCopyUrlBtn');
    // Privat-Checkbox
    const privateCheckboxContainer = document.getElementById('privateCheckboxContainer');
    const privateCheckbox = document.getElementById('privateCheckbox');
    // --- Mobile Menu Elements ---
    const mobileMenuButton = document.getElementById('mobileMenuButton');
    const mobileMenu = document.getElementById('mobileMenu');
    const mobileMenuClose = document.getElementById('mobileMenuClose');
    const mobileThemeToggle = document.getElementById('mobileThemeToggle');
    const mobileUserInfo = document.getElementById('mobileUserInfo');
    const mobileUserName = document.getElementById('mobileUserName');
    const mobileLogoutBtn = document.getElementById('mobileLogoutBtn');

    // State
    let currentGalleryIndex = -1;
    let isAdmin = false;

    // API Configuration
    const API_URL_GENERATIONS = 'php/openai_proxy.php?endpoint=generations';
    const API_URL_EDITS = 'php/openai_proxy.php?endpoint=edits';

    // === THEME HANDLING ===
    initTheme(themeToggle);
    if (themeToggle) {
        themeToggle.addEventListener('click', () => toggleTheme(themeToggle));
    }
    if (mobileThemeToggle) {
        mobileThemeToggle.addEventListener('click', () => {
            toggleTheme(themeToggle);
            syncMobileThemeToggle(mobileThemeToggle);
        });
    }
    syncMobileThemeToggle(mobileThemeToggle);

    // Image Count Button Handler
    const imageCountButtons = document.querySelectorAll('.image-count-btn');
    imageCountButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            imageCountButtons.forEach(b => {
                b.classList.remove('selected', 'bg-indigo-50', 'dark:bg-indigo-500/10', 'text-indigo-700', 'dark:text-indigo-300', 'border-indigo-200', 'dark:border-indigo-500/30');
                b.classList.add('bg-white', 'dark:bg-slate-800', 'text-gray-700', 'dark:text-gray-300', 'border-gray-200', 'dark:border-slate-700');
            });
            btn.classList.remove('bg-white', 'dark:bg-slate-800', 'text-gray-700', 'dark:text-gray-300', 'border-gray-200', 'dark:border-slate-700');
            btn.classList.add('selected', 'bg-indigo-50', 'dark:bg-indigo-500/10', 'text-indigo-700', 'dark:text-indigo-300', 'border-indigo-200', 'dark:border-indigo-500/30');
            updateTotalCost(uploadedFiles);
        });
    });

    // === AUTH HANDLING ===
    initAuth();
    checkLogin();

    // Check for admin status and enable high quality if admin
    async function checkAdminStatus() {
        try {
            const response = await fetch('php/session_auth.php?action=status');
            const data = await response.json();
            isAdmin = data.role === 'admin';
        } catch (error) {
            console.error('Failed to check admin status:', error);
        }
    }

    // Call admin check on load
    (async () => {
        await checkAdminStatus();
        // Lightbox initialisieren erst nach Admin-Check
        initLightbox({
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
            loadImageGrid: () => loadImageGrid({ imageGrid, isAdmin, userName, updateGridLayout, setGalleryImages }),
            isAdmin
        });
    })();

    // Prompt-Optimierung initialisieren
    initPromptHandlers({
        promptInput,
        optimizeBtn,
        optimizeSpinner,
        optimizeIcon,
        optimizeError
    });

    // Bild-Upload Input erstellen
    const imageUploadInput = createImageUploadInput((e) => {
        const files = Array.from(e.target.files).filter(f => f.type.startsWith('image/'));
        if (files.length > 0) {
            const remainingSlots = 8 - uploadedFiles.length;
            if (files.length > remainingSlots) {
                alert(translate('alert.maxReferenceImagesRemaining.prefix') + remainingSlots + translate(remainingSlots !== 1 ? 'alert.maxReferenceImagesRemaining.pluralSuffix' : 'alert.maxReferenceImagesRemaining.singularSuffix'));
                uploadedFiles.push(...files.slice(0, remainingSlots));
                } else {
                uploadedFiles.push(...files);
            }
            updateImagePreviews(uploadedFiles, imagePreviewContainer, removeAllImagesBtn, () => updateTotalCost(uploadedFiles));
        }
        imageUploadInput.value = '';
    });

    // Add Reference Image Button
    if (addReferenceImageBtn) {
        addReferenceImageBtn.addEventListener('click', () => {
            if (uploadedFiles.length >= 8) {
                alert(translate('alert.maxReferenceImagesLimit'));
                return;
            }
            imageUploadInput.click();
        });
    }

    // Paste-Handler für Bilder im Prompt-Textarea
    if (promptInput) {
        promptInput.addEventListener('paste', (e) => handleImagePaste(e, uploadedFiles, () => updateImagePreviews(uploadedFiles, imagePreviewContainer, removeAllImagesBtn, () => updateTotalCost(uploadedFiles))));
    }

    // Drag & Drop Handler
    if (promptInput) {
        promptInput.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.stopPropagation();
            promptInput.classList.add('border-indigo-500');
        });
        promptInput.addEventListener('dragleave', (e) => {
            e.preventDefault();
            e.stopPropagation();
            promptInput.classList.remove('border-indigo-500');
        });
        promptInput.addEventListener('drop', (e) => handleImageDrop(e, uploadedFiles, () => updateImagePreviews(uploadedFiles, imagePreviewContainer, removeAllImagesBtn, () => updateTotalCost(uploadedFiles)), promptInput));
    }

    // Bildvorschau initialisieren
    updateImagePreviews(uploadedFiles, imagePreviewContainer, removeAllImagesBtn, () => updateTotalCost(uploadedFiles));

    // Remove All Images Button
    if (removeAllImagesBtn) {
        removeAllImagesBtn.addEventListener('click', () => {
            const images = imagePreviewContainer.querySelectorAll('img');
            images.forEach(img => {
                if (img.src.startsWith('blob:')) {
                    URL.revokeObjectURL(img.src);
                }
            });
            uploadedFiles.length = 0;
            updateImagePreviews(uploadedFiles, imagePreviewContainer, removeAllImagesBtn, () => updateTotalCost(uploadedFiles));
        });
    }

    // Generate Button Handler
    generateBtn.addEventListener('click', async () => {
        const prompt = promptInput.value.trim();
        const selectedSize = document.querySelector('.aspect-btn.selected').dataset.value;
        const selectedQuality = document.querySelector('.quality-btn.selected').dataset.value;
        await generateImage({
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
            previewPulse: document.getElementById('previewPulse'),
            promptInput,
            userName,
            loadImageGrid: () => loadImageGrid({ imageGrid, isAdmin, userName, updateGridLayout, setGalleryImages }),
            galleryImages,
            allImages
        });
    });

    // Download Button Handler (für generiertes Bild)
    downloadBtn.onclick = () => {
        if (!generatedImage.src || generatedImage.classList.contains('hidden')) return;
        downloadImage(generatedImage.src, promptInput.value.trim() || 'generated_image');
    };

    // --- LOGIN HANDLING ---
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        loginError.classList.add('hidden');
        const user = document.getElementById('loginUser').value.trim();
        const pass = document.getElementById('loginPass').value;
        const res = await fetch('php/session_auth.php?action=login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user, pass })
        });
        const data = await res.json();
        if (data.success) {
            hideLogin();
            location.reload();
        } else {
            loginError.textContent = data.error || translate('error.loginFailed');
            loginError.classList.remove('hidden');
        }
    });

    // Blockiere alle API-Calls, solange nicht eingeloggt
    async function requireLoginOrBlock(fn) {
        const res = await fetch('php/session_auth.php?action=status');
        const data = await res.json();
        if (!data.logged_in) {
            showLogin();
            return;
        }
        fn();
    }

    // Initial Login-Check
    checkLogin();

    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            await fetch('php/session_auth.php?action=logout');
            setUserUI(false, '');
            showLogin();
        });
    }

    // Toggle-Buttons für die Galerie
    if (showAllBtn && showMineBtn) {
        showAllBtn.addEventListener('click', () => {
            if (!getShowOnlyUserImages()) return;
            setShowOnlyUserImages(false);
            // Aktive/inaktive Klassen setzen
            showAllBtn.classList.add('bg-indigo-50', 'dark:bg-indigo-500/10', 'text-indigo-600', 'dark:text-indigo-400');
            showAllBtn.classList.remove('text-gray-600', 'dark:text-gray-400', 'hover:bg-gray-50', 'dark:hover:bg-slate-700');
            showMineBtn.classList.remove('bg-indigo-50', 'dark:bg-indigo-500/10', 'text-indigo-600', 'dark:text-indigo-400');
            showMineBtn.classList.add('text-gray-600', 'dark:text-gray-400', 'hover:bg-gray-50', 'dark:hover:bg-slate-700');
            updateGridSizeUI(gridNormalBtn, gridCompactBtn, getIsCompactGrid());
            loadImageGrid({ imageGrid, isAdmin, userName, updateGridLayout, setGalleryImages });
        });
        showMineBtn.addEventListener('click', () => {
            if (getShowOnlyUserImages()) return;
            setShowOnlyUserImages(true);
            // Aktive/inaktive Klassen setzen
            showMineBtn.classList.add('bg-indigo-50', 'dark:bg-indigo-500/10', 'text-indigo-600', 'dark:text-indigo-400');
            showMineBtn.classList.remove('text-gray-600', 'dark:text-gray-400', 'hover:bg-gray-50', 'dark:hover:bg-slate-700');
            showAllBtn.classList.remove('bg-indigo-50', 'dark:bg-indigo-500/10', 'text-indigo-600', 'dark:text-indigo-400');
            showAllBtn.classList.add('text-gray-600', 'dark:text-gray-400', 'hover:bg-gray-50', 'dark:hover:bg-slate-700');
            updateGridSizeUI(gridNormalBtn, gridCompactBtn, getIsCompactGrid());
            loadImageGrid({ imageGrid, isAdmin, userName, updateGridLayout, setGalleryImages });
        });
    }

    // Toggle-Buttons für Grid-Größe
    if (gridNormalBtn && gridCompactBtn) {
        gridNormalBtn.addEventListener('click', () => {
            if (!getIsCompactGrid()) return;
            setIsCompactGrid(false);
            updateGridSizeUI(gridNormalBtn, gridCompactBtn, getIsCompactGrid());
            updateGridLayout(imageGrid, getIsCompactGrid());
        });
        gridCompactBtn.addEventListener('click', () => {
            if (getIsCompactGrid()) return;
            setIsCompactGrid(true);
            updateGridSizeUI(gridNormalBtn, gridCompactBtn, getIsCompactGrid());
            updateGridLayout(imageGrid, getIsCompactGrid());
        });
    }

    // Galerie-Grid-Logik und Lightbox-Logik entfernen und durch Modul-Initialisierung ersetzen
    function setCurrentGalleryIndex(idx) { currentGalleryIndex = idx; }
    function getCurrentGalleryIndex() { return currentGalleryIndex; }

    // Galerie-Grid initialisieren
    function setGalleryImages(arr) {
        galleryImages.length = 0;
        galleryImages.push(...arr);
    }
    // Initiales Grid laden
    loadImageGrid({
        imageGrid,
        isAdmin,
        userName,
        updateGridLayout,
        setGalleryImages
    });

    // --- Mobile Menu Logic ---
    function openMobileMenu() {
        mobileMenu.classList.remove('hidden');
        setTimeout(() => {
            mobileMenu.querySelector('.animate-slide-in').focus();
        }, 10);
        document.body.style.overflow = 'hidden';
    }
    function closeMobileMenu() {
        mobileMenu.classList.add('hidden');
        document.body.style.overflow = '';
    }

    // Mobile Login Button Handler
    const mobileLoginBtn = document.getElementById('mobileLoginBtn');
    if (mobileLoginBtn) {
        mobileLoginBtn.addEventListener('click', () => {
            localStorage.removeItem('viewOnly');
            showLogin();
            closeMobileMenu();
        });
    }

    // Update mobile menu UI for view-only mode
    function updateMobileMenuUI(viewOnly) {
        const mobileUserInfo = document.getElementById('mobileUserInfo');
        const mobileViewOnlyInfo = document.getElementById('mobileViewOnlyInfo');
        
        if (viewOnly) {
            mobileUserInfo.classList.add('hidden');
            mobileViewOnlyInfo.classList.remove('hidden');
        } else {
            mobileViewOnlyInfo.classList.add('hidden');
        }
    }

    // Check view-only status when initializing
    const viewOnly = localStorage.getItem('viewOnly') === 'true';
    updateMobileMenuUI(viewOnly);

    if (mobileMenuButton) {
        mobileMenuButton.addEventListener('click', openMobileMenu);
    }
    if (mobileMenuClose) {
        mobileMenuClose.addEventListener('click', closeMobileMenu);
    }
    if (mobileMenu) {
        mobileMenu.addEventListener('click', (e) => {
            if (e.target === mobileMenu) closeMobileMenu();
        });
    }
    window.addEventListener('keydown', (e) => {
        if (!mobileMenu.classList.contains('hidden') && e.key === 'Escape') {
            closeMobileMenu();
        }
    });

    // === Seitenverhältnis-Buttons (aspect-btn) ===
    document.querySelectorAll('.aspect-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.aspect-btn').forEach(b => {
                b.classList.remove('selected', 'bg-indigo-50', 'dark:bg-indigo-500/10', 'border-indigo-200', 'dark:border-indigo-500/30', 'text-indigo-700', 'dark:text-indigo-300');
                b.classList.add('bg-white', 'dark:bg-slate-800', 'border-gray-200', 'dark:border-slate-700', 'text-gray-700', 'dark:text-gray-300');
            });
            btn.classList.add('selected', 'bg-indigo-50', 'dark:bg-indigo-500/10', 'border-indigo-200', 'dark:border-indigo-500/30', 'text-indigo-700', 'dark:text-indigo-300');
            btn.classList.remove('bg-white', 'dark:bg-slate-800', 'border-gray-200', 'dark:border-slate-700', 'text-gray-700', 'dark:text-gray-300');
        });
    });
    // === Qualitäts-Buttons (quality-btn) ===
    document.querySelectorAll('.quality-btn:not([disabled])').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.quality-btn:not([disabled])').forEach(b => {
                b.classList.remove('selected', 'bg-indigo-50', 'dark:bg-indigo-500/10', 'border-indigo-200', 'dark:border-indigo-500/30', 'text-indigo-700', 'dark:text-indigo-300');
                b.classList.add('bg-white', 'dark:bg-slate-800', 'border-gray-200', 'dark:border-slate-700', 'text-gray-700', 'dark:text-gray-300');
            });
            btn.classList.add('selected', 'bg-indigo-50', 'dark:bg-indigo-500/10', 'border-indigo-200', 'dark:border-indigo-500/30', 'text-indigo-700', 'dark:text-indigo-300');
            btn.classList.remove('bg-white', 'dark:bg-slate-800', 'border-gray-200', 'dark:border-slate-700', 'text-gray-700', 'dark:text-gray-300');
            // Kostenanzeige aktualisieren
            updateTotalCost(uploadedFiles);
        });
    });

    // Customization-Text-Loader
    fetch('./database/customization.json')
      .then(res => res.json())
      .then(data => {
        // Einfache Platzhalter
        [
          'siteName',
          'poweredBy',
          'mainHeadline',
          'mainSubline',
          'footerSiteName',
          'footerCompany'
        ].forEach(key => {
          document.querySelectorAll(`[data-custom="${key}"]`).forEach(el => {
            el.innerHTML = data[key] || '';
          });
        });
        
        // Features im Header anzeigen
        const featuresDisplay = document.getElementById('featuresDisplay');
        if (featuresDisplay && Array.isArray(data.features)) {
            featuresDisplay.innerHTML = data.features.map(feature => `
                <div class="inline-flex items-center gap-2 bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm px-4 py-2 rounded-full border border-indigo-100/50 dark:border-indigo-400/20">
                    <svg class="w-5 h-5 text-indigo-500 dark:text-indigo-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/>
                    </svg>
                    <span class="text-gray-700 dark:text-gray-300 font-medium">${feature}</span>
                </div>
            `).join('');
        }

        // Setze loginContact
        document.querySelectorAll('[data-custom="loginContact"]').forEach(el => {
          el.innerHTML = data.loginContact || '';
        });
        // View-Only-Feature steuern
        if (!data.viewOnlyAllowed) {
          const viewOnlyBtn = document.getElementById('viewOnlyBtn');
          const viewOnlyInfo = document.getElementById('viewOnlyInfo');
          const mobileViewOnlyInfo = document.getElementById('mobileViewOnlyInfo');
          if (viewOnlyBtn) viewOnlyBtn.style.display = 'none';
          if (viewOnlyInfo) viewOnlyInfo.style.display = 'none';
          if (mobileViewOnlyInfo) mobileViewOnlyInfo.style.display = 'none';
          // Falls jemand per localStorage noch im View-Only-Modus ist, zurücksetzen
          localStorage.removeItem('viewOnly');
        }
      });

    if (mobileLogoutBtn) {
        mobileLogoutBtn.addEventListener('click', async () => {
            await fetch('php/session_auth.php?action=logout');
            setUserUI(false, '');
            showLogin();
            if (typeof closeMobileMenu === 'function') closeMobileMenu();
        });
    }

    // Initialisiere Statistiken
    initStatistics();
    
    // Initialisiere Benutzerverwaltung
    initUserManagement();

    // Initialisiere Benutzerprofil
    initUserProfile();

    // Initialisiere Anpassungen
    initCustomization();

    // Update setup form handling
    if (document.getElementById('setupForm')) {
        document.getElementById('setupForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const setupError = document.getElementById('setupError');
            setupError.classList.add('hidden');

            const formData = {
                username: document.getElementById('setupUsername').value.trim(),
                password: document.getElementById('setupPassword').value,
                passwordConfirm: document.getElementById('setupPasswordConfirm').value,
                apiKey: document.getElementById('setupApiKey').value.trim(),
                viewOnlyAllowed: document.getElementById('setupViewOnlyAllowed').checked,
                language: document.getElementById('setupLanguage').value
            };

            try {
                const response = await fetch('php/setup.php', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(formData)
                });

                const data = await response.json();
                if (data.success) {
                    location.reload();
                } else {
                    setupError.textContent = data.error || translate('error.setupFailed');
                    setupError.classList.remove('hidden');
                }
            } catch (error) {
                setupError.textContent = translate('error.setupNetworkError');
                setupError.classList.remove('hidden');
            }
        });
    }
}); 