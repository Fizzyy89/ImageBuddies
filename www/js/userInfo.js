import { translate } from './i18n.js';

let userStatsCache = null;
let userInfoBadge = null;
let mobileUserInfoBadge = null;

export function initUserInfo() {
    // Erstelle das User-Info-Badge Element für Desktop und Mobile
    createUserInfoBadge();
    createMobileUserInfoBadge();
    
    // Lade und zeige User-Statistiken
    loadAndDisplayUserStats();
    
    // Überwache Login-Status
    observeLoginStatus();
}

function createUserInfoBadge() {
    // Finde das userInfo Element (Desktop)
    const userInfo = document.getElementById('userInfo');
    if (!userInfo) return;
    
    // Erstelle das Badge Element
    userInfoBadge = document.createElement('div');
    userInfoBadge.id = 'userStatsBadge';
    userInfoBadge.className = 'hidden flex flex-col items-center bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 text-indigo-700 dark:text-indigo-300 px-3 py-2 rounded-lg border border-indigo-200/60 dark:border-indigo-700/60 mr-3 shadow-sm backdrop-blur-sm';
    
    // Füge das Badge vor dem User-Menü ein
    userInfo.insertBefore(userInfoBadge, userInfo.firstChild);
}

function createMobileUserInfoBadge() {
    // Finde das mobileUserInfo Element
    const mobileUserInfo = document.getElementById('mobileUserInfo');
    if (!mobileUserInfo) return;
    
    // Erstelle das mobile Badge Element
    mobileUserInfoBadge = document.createElement('div');
    mobileUserInfoBadge.id = 'mobileUserStatsBadge';
    mobileUserInfoBadge.className = 'hidden bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 text-indigo-700 dark:text-indigo-300 px-3 py-2 rounded-lg border border-indigo-200/60 dark:border-indigo-700/60 shadow-sm backdrop-blur-sm';
    
    // Finde die erste div mit der User-Info (mit dem Benutzernamen)
    const userNameDiv = mobileUserInfo.querySelector('.flex.items-center.gap-2');
    if (userNameDiv) {
        // Füge das Badge nach dem Benutzernamen ein
        userNameDiv.parentNode.insertBefore(mobileUserInfoBadge, userNameDiv.nextSibling);
    }
}

async function loadAndDisplayUserStats() {
    if (!userInfoBadge && !mobileUserInfoBadge) return;
    
    try {
        // Prüfe erst, ob User eingeloggt ist
        const authRes = await fetch('api/session_auth.php?action=status');
        const authData = await authRes.json();
        
        if (!authData.logged_in) {
            if (userInfoBadge) userInfoBadge.classList.add('hidden');
            if (mobileUserInfoBadge) mobileUserInfoBadge.classList.add('hidden');
            return;
        }
        
        // Lade User-Statistiken
        const response = await fetch('api/get_user_stats.php');
        const data = await response.json();
        
        if (data.error_key) {
            console.error('Error loading user stats:', data.error_key);
            
            const errorHtml = `<div class="text-xs font-medium leading-none">${translate('userInfo.badge.loadingError')}</div>`;
            const errorClass = 'from-red-50 to-red-50 dark:from-red-900/20 dark:to-red-900/20 text-red-700 dark:text-red-300 border-red-200/60 dark:border-red-700/60';
            
            if (userInfoBadge) {
                userInfoBadge.innerHTML = errorHtml;
                userInfoBadge.className = userInfoBadge.className.replace('from-indigo-50 to-purple-50', 'from-red-50 to-red-50').replace('from-indigo-900/20 to-purple-900/20', 'from-red-900/20 to-red-900/20').replace('text-indigo-700', 'text-red-700').replace('text-indigo-300', 'text-red-300').replace('border-indigo-200/60', 'border-red-200/60').replace('border-indigo-700/60', 'border-red-700/60');
                userInfoBadge.classList.remove('hidden');
            }
            
            if (mobileUserInfoBadge) {
                mobileUserInfoBadge.innerHTML = errorHtml;
                mobileUserInfoBadge.className = mobileUserInfoBadge.className.replace('from-indigo-50 to-purple-50', 'from-red-50 to-red-50').replace('from-indigo-900/20 to-purple-900/20', 'from-red-900/20 to-red-900/20').replace('text-indigo-700', 'text-red-700').replace('text-indigo-300', 'text-red-300').replace('border-indigo-200/60', 'border-red-200/60').replace('border-indigo-700/60', 'border-red-700/60');
                mobileUserInfoBadge.classList.remove('hidden');
            }
            
            return;
        }
        
        userStatsCache = data;
        updateUserInfoBadge(data);
        updateMobileUserInfoBadge(data);
        
    } catch (error) {
        console.error('Error fetching user stats:', error);
        
        const errorHtml = `<div class="text-xs font-medium leading-none">${translate('userInfo.badge.loadingError')}</div>`;
        
        if (userInfoBadge) {
            userInfoBadge.innerHTML = errorHtml;
            userInfoBadge.className = userInfoBadge.className.replace('from-indigo-50 to-purple-50', 'from-red-50 to-red-50').replace('from-indigo-900/20 to-purple-900/20', 'from-red-900/20 to-red-900/20').replace('text-indigo-700', 'text-red-700').replace('text-indigo-300', 'text-red-300').replace('border-indigo-200/60', 'border-red-200/60').replace('border-indigo-700/60', 'border-red-700/60');
            userInfoBadge.classList.remove('hidden');
        }
        
        if (mobileUserInfoBadge) {
            mobileUserInfoBadge.innerHTML = errorHtml;
            mobileUserInfoBadge.className = mobileUserInfoBadge.className.replace('from-indigo-50 to-purple-50', 'from-red-50 to-red-50').replace('from-indigo-900/20 to-purple-900/20', 'from-red-900/20 to-red-900/20').replace('text-indigo-700', 'text-red-700').replace('text-indigo-300', 'text-red-300').replace('border-indigo-200/60', 'border-red-200/60').replace('border-indigo-700/60', 'border-red-700/60');
            mobileUserInfoBadge.classList.remove('hidden');
        }
    }
}

function updateUserInfoBadge(stats) {
    if (!userInfoBadge) return;
    
    const imageCount = stats.totalImages || 0;
    const totalCosts = stats.totalCosts || 0;
    
    // Formatiere Kosten in Euro (von Cent)
    const costInEuro = (totalCosts / 100).toFixed(2);
    
    // Erstelle den Text abhängig von der Anzahl der Bilder
    let imageText;
    if (imageCount === 1) {
        imageText = translate('userInfo.badge.imagesSingular');
    } else {
        imageText = translate('userInfo.badge.imagesPlural').replace('{count}', imageCount);
    }
    
    // Erstelle das zweizeilige Layout
    userInfoBadge.innerHTML = `
        <div class="text-xs font-medium leading-none">${imageText}</div>
        ${totalCosts > 0 ? `<div class="text-xs text-indigo-600 dark:text-indigo-400 leading-none mt-1">${translate('userInfo.badge.withCost').replace('{cost}', costInEuro).replace(', ', '')}</div>` : ''}
    `;
    
    userInfoBadge.classList.remove('hidden');
}

function updateMobileUserInfoBadge(stats) {
    if (!mobileUserInfoBadge) return;
    
    const imageCount = stats.totalImages || 0;
    const totalCosts = stats.totalCosts || 0;
    
    // Formatiere Kosten in Euro (von Cent)
    const costInEuro = (totalCosts / 100).toFixed(2);
    
    // Erstelle den Text abhängig von der Anzahl der Bilder
    let imageText;
    if (imageCount === 1) {
        imageText = translate('userInfo.badge.imagesSingular');
    } else {
        imageText = translate('userInfo.badge.imagesPlural').replace('{count}', imageCount);
    }
    
    // Erstelle das zweizeilige Layout für mobile
    mobileUserInfoBadge.innerHTML = `
        <div class="text-xs font-medium leading-none text-center">${imageText}</div>
        ${totalCosts > 0 ? `<div class="text-xs text-indigo-600 dark:text-indigo-400 leading-none mt-1 text-center">${translate('userInfo.badge.withCost').replace('{cost}', costInEuro).replace(', ', '')}</div>` : ''}
    `;
    
    mobileUserInfoBadge.classList.remove('hidden');
}

function observeLoginStatus() {
    // Überwache Änderungen am userInfo Element
    const userInfo = document.getElementById('userInfo');
    const mobileUserInfo = document.getElementById('mobileUserInfo');
    
    if (userInfo) {
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
                    // Wenn userInfo versteckt wird, verstecke auch das Badge
                    if (userInfo.classList.contains('hidden')) {
                        if (userInfoBadge) {
                            userInfoBadge.classList.add('hidden');
                        }
                    } else {
                        // Wenn userInfo angezeigt wird, lade die Statistiken neu
                        loadAndDisplayUserStats();
                    }
                }
            });
        });
        
        observer.observe(userInfo, {
            attributes: true,
            attributeFilter: ['class']
        });
    }
    
    // Überwache auch das mobile User-Info Element
    if (mobileUserInfo) {
        const mobileObserver = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
                    // Wenn mobileUserInfo versteckt wird, verstecke auch das Badge
                    if (mobileUserInfo.classList.contains('hidden')) {
                        if (mobileUserInfoBadge) {
                            mobileUserInfoBadge.classList.add('hidden');
                        }
                    } else {
                        // Wenn mobileUserInfo angezeigt wird, lade die Statistiken neu
                        loadAndDisplayUserStats();
                    }
                }
            });
        });
        
        mobileObserver.observe(mobileUserInfo, {
            attributes: true,
            attributeFilter: ['class']
        });
    }
}

// Funktion zum Aktualisieren der Statistiken (z.B. nach einer neuen Bildgenerierung)
export function refreshUserStats() {
    loadAndDisplayUserStats();
}

// Funktion zum Verstecken der Badges
export function hideUserInfoBadge() {
    if (userInfoBadge) {
        userInfoBadge.classList.add('hidden');
    }
    if (mobileUserInfoBadge) {
        mobileUserInfoBadge.classList.add('hidden');
    }
} 