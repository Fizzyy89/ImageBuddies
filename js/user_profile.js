import { translate } from './i18n.js';

export function initUserProfile() {
    const userMenuBtn = document.getElementById('userMenuBtn');
    const userDropdown = document.getElementById('userDropdown');
    const changePasswordBtn = document.getElementById('changePasswordBtn');
    const mobileChangePasswordBtn = document.getElementById('mobileChangePasswordBtn');
    const passwordModal = document.getElementById('passwordModal');
    const closePasswordModal = document.getElementById('closePasswordModal');
    const changePasswordForm = document.getElementById('changePasswordForm');
    const passwordError = document.getElementById('passwordError');
    const mobileMenu = document.getElementById('mobileMenu');

    // Toggle Dropdown Menu
    if (userMenuBtn) {
        userMenuBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            userDropdown.classList.toggle('hidden');
        });

        // Schließe Dropdown bei Klick außerhalb
        document.addEventListener('click', (e) => {
            if (!userDropdown.contains(e.target) && !userMenuBtn.contains(e.target)) {
                userDropdown.classList.add('hidden');
            }
        });
    }

    // Password Change Modal (Desktop)
    if (changePasswordBtn) {
        changePasswordBtn.addEventListener('click', () => {
            passwordModal.classList.remove('hidden');
            userDropdown.classList.add('hidden');
        });
    }

    // Password Change Modal (Mobile)
    if (mobileChangePasswordBtn) {
        mobileChangePasswordBtn.addEventListener('click', () => {
            passwordModal.classList.remove('hidden');
            mobileMenu.classList.add('hidden');
        });
    }

    if (closePasswordModal) {
        closePasswordModal.addEventListener('click', () => {
            passwordModal.classList.add('hidden');
            changePasswordForm.reset();
            passwordError.classList.add('hidden');
        });
    }

    // Schließen mit Escape-Taste
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !passwordModal.classList.contains('hidden')) {
            passwordModal.classList.add('hidden');
            changePasswordForm.reset();
            passwordError.classList.add('hidden');
        }
    });

    // Klick außerhalb schließt Modal
    passwordModal.addEventListener('click', (e) => {
        if (e.target === passwordModal) {
            passwordModal.classList.add('hidden');
            changePasswordForm.reset();
            passwordError.classList.add('hidden');
        }
    });

    // Password Change Form Handler
    if (changePasswordForm) {
        changePasswordForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            passwordError.classList.add('hidden');

            const currentPassword = document.getElementById('currentPassword').value;
            const newPassword = document.getElementById('newPassword').value;
            const confirmPassword = document.getElementById('confirmPassword').value;

            // Validierung
            if (newPassword !== confirmPassword) {
                passwordError.textContent = translate('error.passwordsDoNotMatch');
                passwordError.classList.remove('hidden');
                return;
            }

            try {
                const response = await fetch('php/change_password.php', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        currentPassword,
                        newPassword
                    })
                });

                const data = await response.json();

                if (data.success) {
                    alert(translate('alert.passwordChangeSuccess'));
                    passwordModal.classList.add('hidden');
                    changePasswordForm.reset();
                } else {
                    passwordError.textContent = data.error_key ? translate(data.error_key) : (data.error || translate('error.passwordChangeFailed'));
                    passwordError.classList.remove('hidden');
                }
            } catch (error) {
                passwordError.textContent = translate('error.generic');
                passwordError.classList.remove('hidden');
            }
        });
    }
} 