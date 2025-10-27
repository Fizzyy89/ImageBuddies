// Theme-Handling-Modul
// Verantwortlich für Dark/Light-Mode, Theme-Toggle und Synchronisierung

export function initTheme(themeToggle) {
    // Check for saved theme preference, default to light
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.classList.add(savedTheme);
    if (savedTheme === 'dark') {
        document.documentElement.classList.add('dark');
        if (themeToggle) themeToggle.setAttribute('aria-checked', 'true');
    } else {
        if (themeToggle) themeToggle.setAttribute('aria-checked', 'false');
    }
}

export function toggleTheme(themeToggle) {
    document.documentElement.classList.add('transitioning');
    const isDark = document.documentElement.classList.contains('dark');
    if (isDark) {
        document.documentElement.classList.remove('dark');
        localStorage.setItem('theme', 'light');
        if (themeToggle) themeToggle.setAttribute('aria-checked', 'false');
    } else {
        document.documentElement.classList.add('dark');
        localStorage.setItem('theme', 'dark');
        if (themeToggle) themeToggle.setAttribute('aria-checked', 'true');
    }
    setTimeout(() => {
        document.documentElement.classList.remove('transitioning');
    }, 500);
}

export function syncMobileThemeToggle(mobileThemeToggle) {
    const isDark = document.documentElement.classList.contains('dark');
    if (mobileThemeToggle) mobileThemeToggle.setAttribute('aria-checked', isDark ? 'true' : 'false');
} 