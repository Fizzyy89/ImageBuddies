import { translate } from './i18n.js';
// Globale Variable für die aktuelle Benutzerliste
let currentUsers = {};

export function initUserManagement() {
    const userButton = document.getElementById('userButton');
    const mobileUserButton = document.getElementById('mobileUserButton');
    const userModal = document.getElementById('userModal');
    const closeUserModal = document.getElementById('closeUserModal');
    const userList = document.getElementById('userList');
    const addUserForm = document.getElementById('addUserForm');

    // Prüfe ob User Admin ist und zeige Button entsprechend
    fetch('php/session_auth.php?action=status')
        .then(res => res.json())
        .then(data => {
            if (data.role === 'admin') {
                userButton.classList.remove('hidden');
                mobileUserButton.classList.remove('hidden');
            }
        });

    // Event Listener
    [userButton, mobileUserButton].forEach(btn => {
        if (btn) {
            btn.addEventListener('click', () => {
                userModal.classList.remove('hidden');
                loadUsers();
            });
        }
    });

    if (closeUserModal) {
        closeUserModal.addEventListener('click', () => {
            userModal.classList.add('hidden');
        });
    }

    // Schließen mit Escape-Taste
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !userModal.classList.contains('hidden')) {
            userModal.classList.add('hidden');
        }
    });

    // Klick außerhalb schließt Modal
    userModal.addEventListener('click', (e) => {
        if (e.target === userModal) {
            userModal.classList.add('hidden');
        }
    });

    // Event Listener für das Formular zum Hinzufügen neuer Benutzer
    if (addUserForm) {
        addUserForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const username = addUserForm.username.value;
            const password = addUserForm.password.value;
            const role = addUserForm.role.value;

            // Clientseitige Minimalprüfung
            if (!password || password.length < 8) {
                showNotification(translate('error.password.tooShort'), 'error');
                return;
            }

            try {
                const response = await fetch('php/user_management.php?action=add', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ username, password, role })
                });
                const data = await response.json();

                if (data.success) {
                    showNotification(translate('notification.userAddedSuccess'), 'success');
                    addUserForm.reset();
                    loadUsers(); // Liste aktualisieren
                } else {
                    const msg = data.error_key ? translate(data.error_key) : (data.error || translate('error.addUserFailed'));
                    showNotification(msg, 'error');
                }
            } catch (error) {
                showNotification(translate('error.addUserFailed'), 'error');
            }
        });
    }
}

async function loadUsers() {
    try {
        const response = await fetch('php/user_management.php?action=list');
        const data = await response.json();

        if (data.success) {
            currentUsers = data.users;
            updateUserList();
        } else {
            const msg = data.error_key ? translate(data.error_key) : (data.error || translate('error.loadUsersFailed'));
            showNotification(msg, 'error');
        }
    } catch (error) {
        showNotification(translate('error.loadUsersFailed'), 'error');
    }
}

function updateUserList() {
    const userList = document.getElementById('userList');
    userList.innerHTML = '';

    Object.entries(currentUsers).forEach(([username, data]) => {
        const userRow = document.createElement('div');
        userRow.className = 'flex items-center justify-between p-4 border-b border-gray-100 dark:border-slate-700';
        
        // Benutzerinfo
        const userInfo = document.createElement('div');
        userInfo.className = 'flex items-center gap-4';
        userInfo.innerHTML = `
            <div class="p-2 bg-indigo-500/10 rounded-lg">
                <svg class="w-6 h-6 text-indigo-500" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
                </svg>
            </div>
            <div>
                <h3 class="font-medium text-gray-900 dark:text-white">${username}</h3>
                <p class="text-sm text-gray-500 dark:text-gray-400">${translate('userManagement.labelRolePrefix')}${data.role}</p>
            </div>
        `;

        // Aktionen
        const actions = document.createElement('div');
        actions.className = 'flex items-center gap-2';

        // Umbenennen
        const renameBtn = document.createElement('button');
        renameBtn.className = 'bg-green-50 dark:bg-green-500/10 hover:bg-green-100 dark:hover:bg-green-500/20 text-green-600 dark:text-green-400 px-3 py-1.5 rounded-lg text-sm font-medium transition';
        renameBtn.textContent = translate('userActions.rename');
        renameBtn.addEventListener('click', () => promptUserRename(username));

        // Rolle ändern
        const roleSelect = document.createElement('select');
        roleSelect.className = 'bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300';
        roleSelect.innerHTML = `
            <option value="user" ${data.role === 'user' ? 'selected' : ''} class="text-gray-700 dark:text-gray-300 bg-white dark:bg-slate-800">${translate('userManagementModal.addUser.role.user')}</option>
            <option value="admin" ${data.role === 'admin' ? 'selected' : ''} class="text-gray-700 dark:text-gray-300 bg-white dark:bg-slate-800">${translate('userManagementModal.addUser.role.admin')}</option>
        `;
        roleSelect.addEventListener('change', () => updateUserRole(username, roleSelect.value));

        // Passwort ändern
        const changePasswordBtn = document.createElement('button');
        changePasswordBtn.className = 'bg-indigo-50 dark:bg-indigo-500/10 hover:bg-indigo-100 dark:hover:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 px-3 py-1.5 rounded-lg text-sm font-medium transition';
        changePasswordBtn.textContent = translate('userActions.changePassword');
        changePasswordBtn.addEventListener('click', () => promptPasswordChange(username));

        // Löschen
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'bg-red-50 dark:bg-red-500/10 hover:bg-red-100 dark:hover:bg-red-500/20 text-red-600 dark:text-red-400 px-3 py-1.5 rounded-lg text-sm font-medium transition';
        deleteBtn.textContent = translate('userManagement.deleteUserButton');
        deleteBtn.addEventListener('click', () => deleteUser(username));

        actions.appendChild(renameBtn);
        actions.appendChild(roleSelect);
        actions.appendChild(changePasswordBtn);
        actions.appendChild(deleteBtn);

        userRow.appendChild(userInfo);
        userRow.appendChild(actions);
        userList.appendChild(userRow);
    });
}

async function updateUserRole(username, newRole) {
    try {
        const response = await fetch('php/user_management.php?action=update', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username, role: newRole })
        });
        const data = await response.json();

        if (data.success) {
            showNotification(translate('notification.roleUpdateSuccess'), 'success');
            loadUsers(); // Liste aktualisieren
        } else {
            const msg = data.error_key ? translate(data.error_key) : (data.error || translate('error.roleUpdateFailed'));
            showNotification(msg, 'error');
        }
    } catch (error) {
        showNotification(translate('error.roleUpdateFailed'), 'error');
    }
}

async function promptPasswordChange(username) {
    const newPassword = prompt(translate('prompt.newPasswordForUser.prefix') + username + translate('prompt.newPasswordForUser.suffix'));
    if (newPassword === null) return; // Abgebrochen

    try {
        const response = await fetch('php/user_management.php?action=update', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username, password: newPassword })
        });
        const data = await response.json();

        if (data.success) {
            showNotification(translate('notification.passwordChangeSuccess'), 'success');
        } else {
            const msg = data.error_key ? translate(data.error_key) : (data.error || translate('error.passwordChangeFailed'));
            showNotification(msg, 'error');
        }
    } catch (error) {
        showNotification(translate('error.passwordChangeFailed'), 'error');
    }
}

async function deleteUser(username) {
    if (!confirm(translate('confirm.deleteUser.prefix') + username + translate('confirm.deleteUser.suffix'))) return;

    try {
        const response = await fetch('php/user_management.php?action=delete', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username })
        });
        const data = await response.json();

        if (data.success) {
            showNotification(translate('notification.userDeleteSuccess'), 'success');
            loadUsers(); // Liste aktualisieren
        } else {
            const msg = data.error_key ? translate(data.error_key) : (data.error || translate('error.userDeleteFailed'));
            showNotification(msg, 'error');
        }
    } catch (error) {
        showNotification(translate('error.userDeleteFailed'), 'error');
    }
}

async function promptUserRename(username) {
    const newUsername = prompt(translate('prompt.newUsernameForUser.prefix') + username + translate('prompt.newUsernameForUser.suffix'));
    if (newUsername === null || newUsername.trim() === '') return; // Abgebrochen oder leer

    try {
        const response = await fetch('php/user_management.php?action=rename', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ oldUsername: username, newUsername: newUsername.trim() })
        });
        const data = await response.json();

        if (data.success) {
            showNotification(translate('notification.userRenameSuccess'), 'success');
            loadUsers(); // Liste aktualisieren
        } else {
            const msg = data.error_key ? translate(data.error_key) : (data.error || translate('error.userRenameFailed'));
            showNotification(msg, 'error');
        }
    } catch (error) {
        showNotification(translate('error.userRenameFailed'), 'error');
    }
}

function showNotification(message, type = 'info') {
    // Hier können Sie Ihre bevorzugte Benachrichtigungsmethode implementieren
    alert(message);
} 