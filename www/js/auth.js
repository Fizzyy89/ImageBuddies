// Authentication and User Handling Module
// Responsible for Login, Logout, User Status, Login Overlay and User UI

// Notification Helper
function showNotification(message, type = 'success') {
    const notification = document.createElement('div');
    notification.className = `fixed bottom-4 right-4 z-[3000] px-6 py-3 rounded-lg shadow-lg ${
        type === 'success' 
            ? 'bg-green-500 text-white' 
            : 'bg-red-500 text-white'
    } transition-all duration-300 transform translate-y-full opacity-0`;
    notification.textContent = message;
    document.body.appendChild(notification);

    // Show animation
    setTimeout(() => {
        notification.style.transform = 'translateY(0)';
        notification.style.opacity = '1';
    }, 100);

    // Hide after 3 seconds
    setTimeout(() => {
        notification.style.transform = 'translateY(full)';
        notification.style.opacity = '0';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

export function showLogin() {
    loginOverlay.classList.remove('hidden');
}

export function hideLogin() {
    loginOverlay.classList.add('hidden');
}

export function setUserUI(loggedIn, user, viewOnly = false) {
    const elements = {
        userInfo: document.getElementById('userInfo'),
        viewOnlyInfo: document.getElementById('viewOnlyInfo'),
        userName: document.getElementById('userName'),
        blockOverlay: document.getElementById('blockOverlay'),
        mobileUserInfo: document.getElementById('mobileUserInfo'),
        mobileUserName: document.getElementById('mobileUserName'),
        mobileViewOnlyInfo: document.getElementById('mobileViewOnlyInfo'),
        generationContainer: document.getElementById('generationContainer'),
        previewContainer: document.getElementById('previewContainer'),
        gallerySection: document.getElementById('gallerySection')
    };

    if (loggedIn) {
        elements.userInfo.classList.remove('hidden');
        elements.viewOnlyInfo.classList.add('hidden');
        elements.mobileViewOnlyInfo?.classList.add('hidden');
        elements.userName.textContent = user || '';
        elements.blockOverlay.classList.add('hidden');
        elements.generationContainer?.classList.remove('hidden');
        elements.previewContainer?.classList.remove('hidden');
        
        if (elements.gallerySection) {
            elements.gallerySection.classList.remove('mt-8');
            elements.gallerySection.classList.add('mt-24');
        }
        if (elements.mobileUserInfo) elements.mobileUserInfo.classList.remove('hidden');
        if (elements.mobileUserName) elements.mobileUserName.textContent = user || '';
    } else if (viewOnly) {
        elements.userInfo.classList.add('hidden');
        elements.viewOnlyInfo.classList.remove('hidden');
        elements.mobileViewOnlyInfo?.classList.remove('hidden');
        elements.userName.textContent = '';
        elements.blockOverlay.classList.add('hidden');
        elements.generationContainer?.classList.add('hidden');
        elements.previewContainer?.classList.add('hidden');
        
        if (elements.gallerySection) {
            elements.gallerySection.classList.remove('mt-24');
            elements.gallerySection.classList.add('mt-8');
        }
        if (elements.mobileUserInfo) elements.mobileUserInfo.classList.add('hidden');
        if (elements.mobileUserName) elements.mobileUserName.textContent = '';
    } else {
        elements.userInfo.classList.add('hidden');
        elements.viewOnlyInfo.classList.add('hidden');
        elements.mobileViewOnlyInfo?.classList.add('hidden');
        elements.userName.textContent = '';
        elements.blockOverlay.classList.remove('hidden');
        elements.generationContainer?.classList.remove('hidden');
        elements.previewContainer?.classList.remove('hidden');
        
        if (elements.gallerySection) {
            elements.gallerySection.classList.remove('mt-8');
            elements.gallerySection.classList.add('mt-24');
        }
        if (elements.mobileUserInfo) elements.mobileUserInfo.classList.add('hidden');
        if (elements.mobileUserName) elements.mobileUserName.textContent = '';
    }
}

export async function checkLogin() {
    const res = await fetch('api/session_auth.php?action=status');
    const data = await res.json();
    const viewOnly = localStorage.getItem('viewOnly') === 'true';
    
    setUserUI(data.logged_in, data.user, viewOnly);
    if (!data.logged_in && !viewOnly) {
        showLogin();
    } else {
        hideLogin();
    }
}

export function initAuth() {
    const elements = {
        loginForm: document.getElementById('loginForm'),
        loginError: document.getElementById('loginError'),
        viewOnlyBtn: document.getElementById('viewOnlyBtn'),
        logoutBtn: document.getElementById('logoutBtn'),
        loginBtn: document.getElementById('loginBtn'),
        mobileLogoutBtn: document.getElementById('mobileLogoutBtn')
    };

    elements.loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        elements.loginError.classList.add('hidden');
        
        const credentials = {
            user: document.getElementById('loginUser').value.trim(),
            pass: document.getElementById('loginPass').value
        };

    const res = await fetch('api/session_auth.php?action=login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(credentials)
        });
        
        const data = await res.json();
        if (data.success) {
            localStorage.removeItem('viewOnly');
            hideLogin();
            location.reload();
        } else {
            elements.loginError.textContent = data.error || 'Login failed.';
            elements.loginError.classList.remove('hidden');
        }
    });

    if (elements.viewOnlyBtn) {
        elements.viewOnlyBtn.addEventListener('click', () => {
            localStorage.setItem('viewOnly', 'true');
            hideLogin();
            setUserUI(false, '', true);
            location.reload();
        });
    }

    if (elements.loginBtn) {
        elements.loginBtn.addEventListener('click', () => {
            localStorage.removeItem('viewOnly');
            showLogin();
        });
    }

    if (elements.logoutBtn) {
        elements.logoutBtn.addEventListener('click', handleLogout);
    }

    if (elements.mobileLogoutBtn) {
        elements.mobileLogoutBtn.addEventListener('click', async () => {
            await handleLogout();
            if (typeof closeMobileMenu === 'function') closeMobileMenu();
        });
    }
}

async function handleLogout() {
    await fetch('api/session_auth.php?action=logout');
    localStorage.removeItem('viewOnly');
    setUserUI(false, '');
    showLogin();
}

export async function requireLoginOrBlock(fn) {
    const res = await fetch('api/session_auth.php?action=status');
    const data = await res.json();
    const viewOnly = localStorage.getItem('viewOnly') === 'true';
    
    if (!data.logged_in && !viewOnly) {
        showLogin();
        return;
    }
    fn();
}

export async function checkSetupRequired() {
    try {
        const response = await fetch('api/setup.php');
        const data = await response.json();
        return data.setupRequired;
    } catch (error) {
        console.error('Error checking setup status:', error);
        return false;
    }
}

export function showSetup() {
    const setupOverlay = document.getElementById('setupOverlay');
    const setupForm = document.getElementById('setupForm');

    setupOverlay.classList.remove('hidden');
    setupForm.removeEventListener('submit', setupSubmitHandler);
    setupForm.addEventListener('submit', setupSubmitHandler);
}

async function setupSubmitHandler(e) {
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
        const response = await fetch('api/setup.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(formData)
        });

        const data = await response.json();
        if (data.success) {
            document.getElementById('setupOverlay').classList.add('hidden');
            showNotification('Setup successfully completed');
            
            const loginResponse = await fetch('api/session_auth.php?action=login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    user: formData.username,
                    pass: formData.password
                })
            });
            
            const loginData = await loginResponse.json();
            if (loginData.success) {
                location.reload();
            }
        } else {
            setupError.textContent = data.error || 'Setup error';
            setupError.classList.remove('hidden');
        }
    } catch (error) {
        console.error('Setup error:', error);
        setupError.textContent = 'Setup error';
        setupError.classList.remove('hidden');
    }
} 