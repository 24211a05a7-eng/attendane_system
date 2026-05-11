/* ==========================================================
   PlaceNix.ai — Admin Control Center (Backend-Driven)
   ========================================================== */

document.addEventListener('DOMContentLoaded', () => {

    /* ════ DOM REFS ════ */
    const statsRow       = document.getElementById('statsRow');
    const dbGrid         = document.getElementById('dbGrid');
    const usersBody      = document.getElementById('usersBody');
    const settingsDrawer = document.getElementById('settingsDrawer');
    const toastContainer = document.getElementById('toastContainer');
    const sidebar        = document.getElementById('sidebar');
    const sbOverlay      = document.getElementById('sidebarOverlay');
    const toggleBtn      = document.getElementById('mobileToggle');

    /* ════ API HELPERS ════ */
    async function fetchAdmin(endpoint, options = {}) {
        const token = localStorage.getItem('placenix_jwt');
        if (!token) { window.location.href = 'index.html'; return; }

        const defaultHeaders = {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        };

        try {
            const response = await fetch(`/api/admin${endpoint}`, {
                ...options,
                headers: { ...defaultHeaders, ...options.headers }
            });
            if (response.status === 401 || response.status === 403) {
                window.location.href = 'index.html';
                return;
            }
            return await response.json();
        } catch (err) {
            console.error('API Error:', err);
            showToast('Connection error', 'error');
            return null;
        }
    }

    /* ════ TOAST SYSTEM ════ */
    function showToast(msg, type = 'success') {
        let container = document.getElementById('toast-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'toast-container';
            container.style.cssText = `
                position: fixed; bottom: 24px; right: 24px; z-index: 9999;
                display: flex; flex-direction: column; gap: 12px;
            `;
            document.body.appendChild(container);
        }

        const toast = document.createElement('div');
        toast.innerText = msg;
        toast.style.cssText = `
            background: #1A1735; color: #fff; padding: 12px 20px;
            border-left: 4px solid ${type === 'error' ? '#FF4E4E' : '#CAFF00'}; 
            border-radius: 12px; font-family: 'Plus Jakarta Sans', sans-serif; 
            font-size: 14px; box-shadow: 0 10px 30px rgba(0,0,0,0.5);
            animation: toast-in 0.4s cubic-bezier(0.18, 0.89, 0.32, 1.28) forwards;
        `;
        container.appendChild(toast);

        setTimeout(() => {
            toast.style.animation = 'toast-out 0.4s forwards';
            setTimeout(() => toast.remove(), 400);
        }, 3000);
    }

    /* ════ MOBILE SIDEBAR ════ */
    if (toggleBtn) {
        toggleBtn.addEventListener('click', () => {
            sidebar.classList.toggle('open');
            sbOverlay.classList.toggle('open');
        });
        sbOverlay.addEventListener('click', () => {
            sidebar.classList.remove('open');
            sbOverlay.classList.remove('open');
        });
    }

    /* ════ TAB NAVIGATION ════ */
    const tabs = ['databases', 'users', 'logs', 'settings'];
    window.switchTab = (tab) => {
        tabs.forEach(t => {
            const el = document.getElementById('tab-' + t);
            if (el) el.style.display = t === tab ? 'block' : 'none';
        });
        document.querySelectorAll('.sb-item').forEach(item => {
            item.classList.toggle('active', item.getAttribute('onclick').includes(tab));
        });

        if (tab === 'databases') { renderStats(); renderHealth(); }
        if (tab === 'users') renderUsers();
        if (tab === 'settings') loadSettings();
    };

    /* ════ RENDER STATS ════ */
    async function renderStats() {
        const result = await fetchAdmin('/stats');
        if (!result || !result.success) return;
        const s = result.stats;

        statsRow.innerHTML = `
            <div class="stat-card anim-up" style="animation-delay:.05s">
                <div class="sc-header"><span class="sc-label">Total Users</span><span class="sc-icon sc-icon--blue">👥</span></div>
                <div class="sc-body"><span class="sc-num sc-num--blue">${s.totalUsers}</span></div>
            </div>
            <div class="stat-card anim-up" style="animation-delay:.1s">
                <div class="sc-header"><span class="sc-label">Resumes Analyzed</span><span class="sc-icon sc-icon--green">📄</span></div>
                <div class="sc-body"><span class="sc-num sc-num--green">${s.totalResumes}</span></div>
            </div>
            <div class="stat-card anim-up" style="animation-delay:.15s">
                <div class="sc-header"><span class="sc-label">Interviews Done</span><span class="sc-icon sc-icon--red">🎤</span></div>
                <div class="sc-body"><span class="sc-num sc-num--red">${s.totalInterviews}</span></div>
            </div>
            <div class="stat-card anim-up" style="animation-delay:.2s">
                <div class="sc-header"><span class="sc-label">Questions DB</span><span class="sc-icon sc-icon--amber">❓</span></div>
                <div class="sc-body"><span class="sc-num sc-num--amber">${s.totalQuestions}</span></div>
            </div>
        `;
    }

    /* ════ RENDER SYSTEM HEALTH (Grid) ════ */
    async function renderHealth() {
        const result = await fetchAdmin('/health');
        if (!result || !result.success) return;
        const h = result.health;

        const healthItems = [
            { name: 'Node.js Runtime', val: h.nodeVersion, icon: '🟢', desc: 'Backend server environment' },
            { name: 'System Platform', val: h.platform, icon: '💻', desc: 'OS hosting the platform' },
            { name: 'Memory Usage', val: h.memoryUsage, icon: '🧠', desc: 'Current heap allocation' },
            { name: 'Database Status', val: h.dbStatus, icon: '💾', desc: 'SQLite3 persistence layer' },
            { name: 'Server Uptime', val: h.uptime, icon: '⏱️', desc: 'Time since last reload' }
        ];

        dbGrid.innerHTML = healthItems.map(item => `
            <div class="db-card anim-up">
                <div class="db-top">
                    <div class="db-info">
                        <span class="db-icon bg-blue">${item.icon}</span>
                        <div>
                            <h3 class="db-name">${item.name}</h3>
                            <span class="db-cat">SYSTEM</span>
                        </div>
                    </div>
                    <p class="db-desc">${item.desc}</p>
                </div>
                <div class="db-mid">
                    <span class="db-status text-green">${item.val}</span>
                </div>
            </div>
        `).join('');
    }

    /* ════ RENDER USERS ════ */
    async function renderUsers() {
        const result = await fetchAdmin('/users');
        if (!result || !result.success) return;

        usersBody.innerHTML = result.data.map(u => `
            <tr>
                <td><strong>${u.name}</strong></td>
                <td>${u.email}</td>
                <td>
                    <select class="role-select" onchange="window._changeRole(${u.id}, this.value)">
                        <option value="student" ${u.role === 'student' ? 'selected' : ''}>Student</option>
                        <option value="admin" ${u.role === 'admin' ? 'selected' : ''}>Admin</option>
                    </select>
                </td>
                <td class="t-time">${u.last_login ? new Date(u.last_login).toLocaleDateString() : 'Never'}</td>
                <td><span style="color:${u.is_active ? '#CAFF00' : '#FF4E4E'}">●</span> ${u.is_active ? 'Active' : 'Inactive'}</td>
                <td>
                    <button class="db-action-btn" onclick="window._toggleUser(${u.id})" title="Toggle Active">🔄</button>
                </td>
            </tr>
        `).join('');
    }

    /* ════ SETTINGS LOGIC ════ */
    async function loadSettings() {
        const result = await fetchAdmin('/settings');
        if (!result || !result.success) return;

        result.data.forEach(s => {
            if (s.config_key === 'platform_name') {
                const el = document.getElementById('cfg-platform-name');
                if (el) el.value = s.config_value;
            }
            if (s.config_key === 'admin_pin') {
                // We don't show the PIN for security, but we show it exists
            }
        });
    }

    window._changeRole = async (id, role) => {
        const res = await fetchAdmin(`/users/${id}`, {
            method: 'POST',
            body: JSON.stringify({ role })
        });
        if (res && res.success) showToast('Role updated');
    };

    /* ════ INITIAL RENDER ════ */
    const user = JSON.parse(localStorage.getItem('placenix_user') || '{}');
    const sbName = document.getElementById('sbUsername');
    const sbAvatar = document.getElementById('sbAvatar');
    if (sbName && user.name) sbName.textContent = user.name;
    if (sbAvatar && user.name) sbAvatar.textContent = user.name.charAt(0).toUpperCase();

    switchTab('databases');

    /* ════ LOCK ADMIN ════ */
    window._lockAdmin = () => {
        sessionStorage.removeItem('placenix_admin_session');
        location.reload();
    };
});
