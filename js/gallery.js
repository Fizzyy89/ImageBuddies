import { translatePage, translate } from './i18n.js';
// Galerie-Grid-Modul
// Verantwortlich für das Laden, Filtern, Anzeigen und Layouten der Galerie

export let galleryImages = [];
export let allImages = [];
export let showOnlyUserImages = false;
export let gridSize = localStorage.getItem('gridSize') ? parseInt(localStorage.getItem('gridSize')) : 4; // Default große Größe (1-5)
export let showAdminPrivateImages = localStorage.getItem('showAdminPrivateImages') !== 'false'; // Default aktiviert

const gridLayouts = {
    1: { // Sehr kompakt
        base: 'grid-cols-4',
        sm: 'sm:grid-cols-6',
        md: 'md:grid-cols-10',
        lg: 'lg:grid-cols-12'
    },
    2: { // Kompakt
        base: 'grid-cols-3',
        sm: 'sm:grid-cols-5',
        md: 'md:grid-cols-8',
        lg: 'lg:grid-cols-10'
    },
    3: { // Medium
        base: 'grid-cols-2',
        sm: 'sm:grid-cols-4',
        md: 'md:grid-cols-6',
        lg: 'lg:grid-cols-8'
    },
    4: { // Groß
        base: 'grid-cols-2',
        sm: 'sm:grid-cols-3',
        md: 'md:grid-cols-4',
        lg: 'lg:grid-cols-6'
    },
    5: { // Sehr groß
        base: 'grid-cols-1',
        sm: 'sm:grid-cols-2',
        md: 'md:grid-cols-3',
        lg: 'lg:grid-cols-4'
    }
};

export function updateGridLayout(imageGrid, size) {
    // Entferne alle möglichen Grid-Klassen
    Object.values(gridLayouts).forEach(layout => {
        imageGrid.classList.remove(
            layout.base,
            layout.sm,
            layout.md,
            layout.lg
        );
    });

    // Füge die neuen Grid-Klassen hinzu
    const newLayout = gridLayouts[size];
    imageGrid.classList.add(
        newLayout.base,
        newLayout.sm,
        newLayout.md,
        newLayout.lg
    );
}

export function setShowOnlyUserImages(val) { showOnlyUserImages = val; }
export function getShowOnlyUserImages() { return showOnlyUserImages; }
export function setGridSize(val) { 
    gridSize = val;
    localStorage.setItem('gridSize', val.toString());
}
export function getGridSize() { return gridSize; }
export function setShowAdminPrivateImages(val) { 
    showAdminPrivateImages = val;
    localStorage.setItem('showAdminPrivateImages', val.toString());
}
export function getShowAdminPrivateImages() { return showAdminPrivateImages; }

export async function loadImageGrid({
    imageGrid,
    isAdmin,
    userName,
    updateGridLayout,
    setGalleryImages
}) {
    try {
        let currentUser = '';
        let admin = false;
        try {
            const userRes = await fetch('php/session_auth.php?action=status');
            const userData = await userRes.json();
            currentUser = userData.user || '';
            admin = userData.role === 'admin';
        } catch (e) {
            currentUser = '';
            admin = false;
        }

        // Füge den View-Only-Header hinzu, wenn im View-Only-Modus
        const headers = {};
        if (localStorage.getItem('viewOnly') === 'true') {
            headers['X-View-Only'] = 'true';
        }

        const res = await fetch('php/list_images.php', { headers });
        if (!res.ok) return;
        const files = await res.json();
        imageGrid.innerHTML = '';
        updateGridLayout(imageGrid, gridSize);
        let filteredFiles = files;
        filteredFiles = files.filter(file => {
            if (file.private === '1') {
                // Eigene private Bilder werden immer angezeigt
                if (file.user === currentUser) {
                    return true;
                }
                // Private Bilder anderer Nutzer nur anzeigen wenn Admin UND showAdminPrivateImages aktiviert ist
                return admin && showAdminPrivateImages;
            }
            return true;
        });
        if (showOnlyUserImages) {
            filteredFiles = filteredFiles.filter(file => file.user === currentUser);
        }
        document.getElementById('imageCount').textContent = filteredFiles.length;
        if (filteredFiles.length === 0) {
            const messageKey = showOnlyUserImages ? 'gallery.noUserImages' : 'gallery.noImages';
            imageGrid.innerHTML = `<div class="col-span-full text-gray-400 text-center" data-translate="${messageKey}">${showOnlyUserImages ? 'You haven\'t generated any images yet.' : 'No images generated yet.'}</div>`;
            translatePage();
            setGalleryImages([]);
            return;
        }
        filteredFiles.sort((a, b) => {
            const dateA = a.timestamp ? new Date(a.timestamp.replace(/-/g, ':').replace('T', ' ')) : new Date(0);
            const dateB = b.timestamp ? new Date(b.timestamp.replace(/-/g, ':').replace('T', ' ')) : new Date(0);
            return dateB - dateA;
        });
        allImages.length = 0;
        allImages.push(...filteredFiles);
        const displayedFiles = filteredFiles.filter(fileObj => {
            if (fileObj.batchId && fileObj.batchId !== '' && fileObj.imageNumber !== '1') {
                return false;
            }
            return true;
        });
        setGalleryImages(displayedFiles);
        displayedFiles.forEach((fileObj, idx) => {
            const { file, user, timestamp, private: isPrivate } = fileObj;
            const card = document.createElement('div');
            const isOtherUserPrivate = isPrivate === '1' && user !== currentUser && admin;
            let cardClasses = 'image-card relative bg-white dark:bg-slate-900 rounded-2xl overflow-hidden cursor-pointer transition-all duration-200 hover:scale-[1.02] hover:-translate-y-1 hover:shadow-xl';
            if (isOtherUserPrivate) {
                cardClasses += ' ring-4 ring-indigo-500/80 dark:ring-indigo-400/80 hover:ring-indigo-500 dark:hover:ring-indigo-400';
            }
            card.className = cardClasses;
            const imgContainer = document.createElement('div');
            imgContainer.className = 'aspect-square w-full relative overflow-hidden bg-gray-50 dark:bg-slate-800 rounded-2xl';
            const thumbFile = file.split('/').pop();
            const thumbUrl = 'images/thumbs/' + thumbFile;
            const img = document.createElement('img');
            img.src = thumbUrl;
            img.alt = 'Generiertes Bild';
            img.className = 'w-full h-full object-cover rounded-2xl';
            img.style.cssText = 'image-rendering: auto; display: block; background: #f3f4f6;';

            // Add batch indicator if this is part of a batch
            if (fileObj.batchId && fileObj.imageNumber === '1') {
                const batchSize = filteredFiles.filter(f => f.batchId === fileObj.batchId).length;
                if (batchSize > 1) {
                    const batchIndicator = document.createElement('div');
                    batchIndicator.className = 'absolute bottom-2 right-2 bg-black/60 backdrop-blur-sm text-white text-xs px-2 py-1 rounded-lg flex items-center gap-1.5';
                    batchIndicator.innerHTML = `
                        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M4 6h16M4 12h16m-7 6h7"/>
                        </svg>
                        +${batchSize - 1}
                    `;
                    imgContainer.appendChild(batchIndicator);
                }
            }

            // Add user indicator
            if (user) {
                if (user === currentUser && isPrivate === '1') {
                    const label = document.createElement('div');
                    label.className = 'absolute top-2 right-2 z-10 flex items-center gap-1 bg-gray-900/80 text-white text-xs px-2 py-1 rounded-full';
                    label.innerHTML = `
                        <svg class="w-4 h-4 mr-0.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-5 0-9.27-3.11-10.5-7.5a10.05 10.05 0 012.908-4.568m2.32-1.872A9.956 9.956 0 0112 5c5 0 9.27 3.11 10.5 7.5a9.956 9.956 0 01-4.293 5.568M3 3l18 18" />
                        </svg>
                        ${translate('label.private')}
                    `;
                    card.appendChild(label);
                } else if (admin && isPrivate === '1' && user !== currentUser) {
                    const label = document.createElement('div');
                    label.className = 'absolute top-2 right-2 z-10 flex items-center gap-1 bg-indigo-500/90 text-white text-xs px-2 py-1 rounded-full shadow-lg';
                    label.innerHTML = `
                        <svg class="w-4 h-4 mr-0.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
                        </svg>
                        ${user}
                    `;
                    card.appendChild(label);
                }
            }
            card.addEventListener('click', () => {
                const event = new CustomEvent('openLightbox', { detail: { index: idx } });
                window.dispatchEvent(event);
            });
            imgContainer.appendChild(img);
            card.appendChild(imgContainer);
            imageGrid.appendChild(card);
        });
        document.getElementById('imageCount').textContent = imageGrid.children.length;
    } catch (e) {
        imageGrid.innerHTML = '<div class="col-span-full text-red-400 text-center" data-translate="gallery.loadError">Error loading images.</div>';
        translatePage();
        setGalleryImages([]);
    }
} 