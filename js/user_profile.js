import { translate, currentLanguage } from './i18n.js';

function validatePassword(password) {
    if (password.length < 8) {
        return { valid: false, error_key: 'error.password.tooShort' };
    }
    return { valid: true };
}

export function initUserProfile() {
    const userMenuBtn = document.getElementById('userMenuBtn');
    const userDropdown = document.getElementById('userDropdown');
    const myImagesBtn = document.getElementById('myImagesBtn');
    const changePasswordBtn = document.getElementById('changePasswordBtn');
    const mobileChangePasswordBtn = document.getElementById('mobileChangePasswordBtn');
    const mobileMyImagesBtn = document.getElementById('mobileMyImagesBtn');
    const passwordModal = document.getElementById('passwordModal');
    const myImagesModal = document.getElementById('myImagesModal');
    const closeMyImagesModal = document.getElementById('closeMyImagesModal');
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

    // My Images Modal (Desktop)
    if (myImagesBtn) {
        myImagesBtn.addEventListener('click', async () => {
            userDropdown.classList.add('hidden');
            await openMyImagesModal();
        });
    }

    // Password Change Modal (Mobile)
    if (mobileChangePasswordBtn) {
        mobileChangePasswordBtn.addEventListener('click', () => {
            passwordModal.classList.remove('hidden');
            mobileMenu.classList.add('hidden');
        });
    }

    // My Images Modal (Mobile)
    if (mobileMyImagesBtn) {
        mobileMyImagesBtn.addEventListener('click', async () => {
            mobileMenu.classList.add('hidden');
            await openMyImagesModal();
        });
    }

    if (closePasswordModal) {
        closePasswordModal.addEventListener('click', () => {
            passwordModal.classList.add('hidden');
            changePasswordForm.reset();
            passwordError.classList.add('hidden');
        });
    }

    if (closeMyImagesModal && myImagesModal) {
        closeMyImagesModal.addEventListener('click', () => {
            myImagesModal.classList.add('hidden');
        });
        myImagesModal.addEventListener('click', (e) => {
            if (e.target === myImagesModal) myImagesModal.classList.add('hidden');
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

            // Validiere Passwortlänge
            const validation = validatePassword(newPassword);
            if (!validation.valid) {
                passwordError.textContent = translate(validation.error_key);
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

async function openMyImagesModal() {
    const myImagesModal = document.getElementById('myImagesModal');
    const myGenerationsList = document.getElementById('myGenerationsList');
    const myRefsGrid = document.getElementById('myRefsGrid');
    if (!myImagesModal || !myGenerationsList || !myRefsGrid) return;

    // Format timestamp identisch zur Lightbox
    const formatTimestamp = (ts) => {
        if (!ts || typeof ts !== 'string') return '';
        let parts = ts.split('T');
        if (parts.length !== 2) return ts;
        let date = parts[0];
        let time = parts[1].split('-').slice(0, 3).join(':');
        let dateObj = new Date(`${date}T${time}Z`);
        if (isNaN(dateObj.getTime())) return ts;
        const dateOptions = {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        };
        try {
            return dateObj.toLocaleString(currentLanguage, dateOptions);
        } catch (_) {
            return dateObj.toLocaleString(undefined, dateOptions);
        }
    };

    const updateMaster = () => {
        const selectAll = document.getElementById('myGenSelectAll');
        if (!selectAll) return;
        const boxes = Array.from(document.querySelectorAll('.myGenSel'));
        const anyChecked = boxes.some(x => x.checked);
        const allNow = boxes.every(x => x.checked);
        selectAll.indeterminate = anyChecked && !allNow;
        selectAll.checked = allNow;
    };

    // Load all images (like gallery), then filter for current user
    let currentUser = '';
    try {
        const userRes = await fetch('php/session_auth.php?action=status');
        const userData = await userRes.json();
        currentUser = userData.user || '';
    } catch {}

    const headers = {};
    if (localStorage.getItem('viewOnly') === 'true') headers['X-View-Only'] = 'true';
    const res = await fetch('php/list_images.php', { headers });
    if (!res.ok) return;
    const files = await res.json();
    const own = files.filter(f => f.user === currentUser);

    // Group by batchId (empty string for singletons)
    const byBatch = new Map();
    own.forEach(f => {
        const key = f.batchId || f.file; // single image: unique key by filename
        if (!byBatch.has(key)) byBatch.set(key, []);
        byBatch.get(key).push(f);
    });

    // Render generations list
    myGenerationsList.innerHTML = '';
    for (const [key, items] of byBatch.entries()) {
        const first = items[0];
        const isBatch = (first.batchId && items.length > 1);
        const row = document.createElement('div');
        row.className = 'flex items-center justify-between p-4 hover:bg-gradient-to-r hover:from-indigo-50/50 hover:to-purple-50/50 dark:hover:from-slate-800/50 dark:hover:to-slate-800/30 transition-all duration-200 group cursor-pointer';

        const left = document.createElement('div');
        left.className = 'flex items-center gap-4 min-w-0 flex-1';
        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.className = 'myGenSel w-4 h-4 text-indigo-600 border-gray-300 dark:border-slate-600 rounded focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900 transition-all cursor-pointer';
        cb.dataset.batchId = first.batchId || '';
        cb.dataset.filename = first.batchId ? '' : first.file.split('/').pop();

        const thumb = document.createElement('img');
        thumb.src = 'images/thumbs/' + first.file.split('/').pop();
        thumb.className = 'myGenThumb w-14 h-14 object-cover rounded-xl shadow-sm group-hover:shadow-md group-hover:scale-105 transition-all duration-200 border border-gray-200 dark:border-slate-700';
        
        const info = document.createElement('div');
        info.className = 'flex flex-col min-w-0 flex-1';
        const line1 = document.createElement('div');
        line1.className = 'text-sm font-medium text-gray-800 dark:text-gray-200 truncate max-w-[40vw] group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors';
        line1.textContent = (first.prompt || '').slice(0, 120) || (first.file.split('/').pop());
        const line2 = document.createElement('div');
        line2.className = 'text-xs text-gray-500 dark:text-gray-400 flex items-center gap-2 mt-1';
        // Privacy
        const privacy = document.createElement('span');
        const isPrivate = first.private === '1';
        privacy.className = `inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
            isPrivate 
                ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' 
                : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
        }`;
        privacy.innerHTML = `
            <svg class="w-3 h-3" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                ${isPrivate 
                    ? '<path stroke-linecap="round" stroke-linejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>' 
                    : '<path stroke-linecap="round" stroke-linejoin="round" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>'
                }
            </svg>
            ${first.private === '1' ? translate('privacy.private') : translate('privacy.public')}
        `;
        // Batch size
        const batchInfo = document.createElement('span');
        batchInfo.className = 'inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300';
        batchInfo.innerHTML = `
            <svg class="w-3 h-3" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/>
            </svg>
            ${isBatch ? `${items.length} ${translate('unit.images.short')}` : `1 ${translate('unit.images.short')}`}
        `;
        // Quality
        const quality = document.createElement('span');
        const qualityKeyMap = { 'low': 'settings.quality.low', 'medium': 'settings.quality.medium', 'high': 'settings.quality.high', 'gemini': 'settings.quality.gemini' };
        const qLabel = translate(qualityKeyMap[first.quality] || first.quality || '');
        const qualityColorMap = {
            [translate('settings.quality.low')]: 'bg-yellow-50 dark:bg-yellow-500/10 text-yellow-600 dark:text-yellow-400',
            [translate('settings.quality.medium')]: 'bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400',
            [translate('settings.quality.high')]: 'bg-green-50 dark:bg-green-500/10 text-green-600 dark:text-green-400',
            [translate('settings.quality.gemini')]: 'bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400'
        };
        const qualityColor = qualityColorMap[qLabel] || 'bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-gray-300';
        const iconColor = qualityColor.includes('yellow') ? 'text-yellow-500' : qualityColor.includes('blue') ? 'text-blue-500' : qualityColor.includes('green') ? 'text-green-500' : qualityColor.includes('purple') ? 'text-purple-500' : 'text-gray-500';
        quality.className = `inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${qualityColor}`;
        quality.innerHTML = `
            <svg class="w-3 h-3 ${iconColor}" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"/>
            </svg>
            ${qLabel}
        `;
        // Aspect Ratio / Size
        let aspect = first.size || '';
        if (typeof aspect === 'string' && aspect.includes('x')) {
            const [w, h] = aspect.toLowerCase().split('x');
            const gcd = (a,b)=>b?gcd(b,a%b):a; const g=gcd(parseInt(w)||0, parseInt(h)||0) || 1;
            aspect = `${(parseInt(w)||0)/g}:${(parseInt(h)||0)/g}`;
        }
        const ar = document.createElement('span');
        ar.className = 'inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300';
        ar.innerHTML = `
            <svg class="w-3 h-3" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"/>
            </svg>
            ${aspect}
        `;
        line2.appendChild(privacy);
        line2.appendChild(batchInfo);
        line2.appendChild(quality);
        line2.appendChild(ar);
        info.appendChild(line1);
        info.appendChild(line2);

        left.appendChild(cb);
        left.appendChild(thumb);
        left.appendChild(info);

        const right = document.createElement('div');
        right.className = 'flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400';
        const tsStr = formatTimestamp(first.timestamp);
        right.innerHTML = `
            <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
            <span>${tsStr}</span>
        `;

        row.appendChild(left);
        row.appendChild(right);
        myGenerationsList.appendChild(row);

        // Row click toggles selection, but not when clicking checkbox or thumbnail
        row.addEventListener('click', (e) => {
            if (e.target.closest('input') || e.target.closest('img.myGenThumb')) return;
            cb.checked = !cb.checked;
            updateMaster();
        });

        // Thumbnail click opens lightbox for this image
        thumb.title = translate('myImages.thumbnailTooltip');
        thumb.addEventListener('click', (e) => {
            e.stopPropagation();
            // Lightbox im Vordergrund anzeigen: Modal schließen, dann Event feuern
            try { myImagesModal.classList.add('hidden'); } catch (_) {}
            try {
                window.dispatchEvent(new CustomEvent('showBatchImage', { detail: { image: first } }));
            } catch (_) {}
        });
    }

    // Render reference images grid (from each batch refImages)
    myRefsGrid.innerHTML = '';
    own.forEach(f => {
        if (Array.isArray(f.refImages)) {
            f.refImages.forEach(url => {
                const wrap = document.createElement('div');
                wrap.className = 'group relative overflow-hidden rounded-2xl bg-gray-100 dark:bg-slate-800 aspect-square shadow-sm hover:shadow-xl transition-all duration-300 cursor-pointer border border-gray-200/50 dark:border-slate-700/50';
                
                const img = document.createElement('img');
                img.src = url;
                img.alt = 'Reference';
                img.className = 'w-full h-full object-cover group-hover:scale-110 transition-transform duration-300';
                
                // Overlay on hover
                const overlay = document.createElement('div');
                overlay.className = 'absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end p-3';
                overlay.innerHTML = `
                    <div class="text-white text-xs font-medium">
                        <svg class="w-4 h-4 inline" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                            <path stroke-linecap="round" stroke-linejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
                        </svg>
                    </div>
                `;
                
                wrap.appendChild(img);
                wrap.appendChild(overlay);
                myRefsGrid.appendChild(wrap);

                // Open reference image in a new tab when clicked
                wrap.addEventListener('click', () => {
                    try { window.open(url, '_blank'); } catch (_) {}
                });
            });
        }
    });

    // Wire actions
    const getSelections = () => Array.from(document.querySelectorAll('.myGenSel:checked')).map(el => ({ batchId: el.dataset.batchId, filename: el.dataset.filename }));

    const delBtn = document.getElementById('myGenDelete');
    const privBtn = document.getElementById('myGenPrivate');
    const pubBtn = document.getElementById('myGenPublic');
    const zipBtn = document.getElementById('myGenZip');
    const selectAll = document.getElementById('myGenSelectAll');

    if (selectAll) selectAll.onchange = () => {
        const boxes = Array.from(document.querySelectorAll('.myGenSel'));
        const allChecked = boxes.every(b => b.checked);
        const newState = selectAll.checked ? true : !allChecked && selectAll.indeterminate ? true : selectAll.checked;
        boxes.forEach(b => b.checked = newState);
        // Zustand der Master-Checkbox setzen
        const anyChecked = boxes.some(b => b.checked);
        const allNow = boxes.every(b => b.checked);
        selectAll.indeterminate = anyChecked && !allNow;
        selectAll.checked = allNow;
    };

    // Update Master-Checkbox beim Einzelklick
    Array.from(document.querySelectorAll('.myGenSel')).forEach(b => b.addEventListener('change', () => {
        updateMaster();
    }));

    if (delBtn) delBtn.onclick = async () => {
        const sel = getSelections();
        for (const s of sel) {
            if (s.batchId) {
                await fetch('php/delete_image.php', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ batchId: s.batchId }) });
            } else if (s.filename) {
                await fetch('php/delete_image.php', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ filename: s.filename }) });
            }
        }
        await openMyImagesModal();
    };

    if (privBtn) privBtn.onclick = async () => {
        const sel = getSelections();
        for (const s of sel) {
            if (s.batchId) {
                const files = own.filter(f => f.batchId === s.batchId);
                for (const f of files) {
                    const name = f.file.split('/').pop();
                    await fetch('php/set_private.php', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ filename: name, private: 1 }) });
                }
            } else if (s.filename) {
                await fetch('php/set_private.php', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ filename: s.filename, private: 1 }) });
            }
        }
        await openMyImagesModal();
    };

    if (pubBtn) pubBtn.onclick = async () => {
        const sel = getSelections();
        for (const s of sel) {
            if (s.batchId) {
                const files = own.filter(f => f.batchId === s.batchId);
                for (const f of files) {
                    const name = f.file.split('/').pop();
                    await fetch('php/set_private.php', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ filename: name, private: 0 }) });
                }
            } else if (s.filename) {
                await fetch('php/set_private.php', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ filename: s.filename, private: 0 }) });
            }
        }
        await openMyImagesModal();
    };

    if (zipBtn) zipBtn.onclick = async () => {
        const sel = getSelections();
        const batches = sel.filter(s => s.batchId).map(s => s.batchId);
        const singles = sel.filter(s => s.filename).map(s => s.filename);
        if (batches.length === 0 && singles.length === 0) return;

        try {
            const resp = await fetch('php/zip_download.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ batches, files: singles })
            });
            if (!resp.ok) return;
            const blob = await resp.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'my_images.zip';
            document.body.appendChild(a);
            a.click();
            a.remove();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
        } catch (e) {}
    };

    myImagesModal.classList.remove('hidden');
}