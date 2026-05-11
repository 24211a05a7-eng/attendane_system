/* ==========================================================
   PlaceNix.ai — Dashboard Interactions
   ========================================================== */

document.addEventListener('DOMContentLoaded', () => {

    /* ══════════════════════════════════
       DATA SYNC (Backend API)
       ══════════════════════════════════ */
    async function initDashboard() {
        const token = localStorage.getItem('placenix_jwt');
        if (!token) {
            window.location.href = 'index.html';
            return;
        }

        try {
            const response = await fetch('/api/dashboard/summary', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const result = await response.json();
            if (!result.success) throw new Error('Failed to load dashboard data');
            
            const data = result.data;
            updateUI(data);
        } catch (err) {
            console.error(err);
            showToast("Error syncing dashboard data.");
        }
    }

    function updateUI(data) {
        // 1. User Header
        const user = JSON.parse(localStorage.getItem('placenix_user') || '{}');
        const greeting = document.querySelector('.greeting-title');
        if (greeting && user.name) greeting.innerHTML = `Welcome back, <span class="lime">${user.name.split(' ')[0]}</span> 👋`;
        
        const sbName = document.querySelector('.sb-username');
        const sbAvatar = document.querySelector('.sb-avatar');
        if (sbName && user.name) sbName.textContent = user.name;
        if (sbAvatar && user.name) sbAvatar.textContent = user.name.charAt(0).toUpperCase();

        // 2. Stat Big Numbers
        const solvedNum = document.querySelector('.stat-card:nth-child(2) .sc-big-num');
        const streakNum = document.querySelector('.stat-card:nth-child(3) .sc-big-num');
        const readinessNum = document.querySelector('.stat-card:nth-child(4) .sc-big-num');

        if (solvedNum) countUp(solvedNum, data.questions.solvedTotal || 0);
        if (streakNum) countUp(streakNum, 7, ' days'); // Mock streak for now
        
        // Calculate readiness: Weighted avg of questions, resume, and interviews
        const readiness = Math.round(
            (Math.min((data.questions.solvedTotal / 50) * 100, 100) * 0.4) + 
            (data.resume.overall_score * 0.3) + 
            ((data.interview.avgScore || 0) * 10 * 0.3)
        );
        if (readinessNum) countUp(readinessNum, readiness, '%');

        // 3. Resume Ring
        const ringNum = document.querySelector('.sc-ring-num');
        const resumeRing = document.getElementById('resumeRing');
        if (ringNum) countUp(ringNum, data.resume.overall_score || 0, '/100');
        if (resumeRing) {
            const circumference = 2 * Math.PI * 34; // r=34
            const offset = circumference - ((data.resume.overall_score || 0) / 100) * circumference;
            setTimeout(() => { resumeRing.style.strokeDashoffset = offset; }, 500);
        }

        // 4. Activity List
        const activityList = document.getElementById('activityList');
        if (activityList && data.activities.length > 0) {
            activityList.innerHTML = data.activities.map(act => {
                let dotColor = 'blue';
                let text = '';
                if (act.type === 'question') { dotColor = 'blue'; text = `Solved ${act.label}`; }
                else if (act.type === 'resume') { dotColor = 'lime'; text = `Analyzed Resume: ${act.label}`; }
                else if (act.type === 'interview') { dotColor = 'pink'; text = `Practised ${act.label} Round`; }

                return `
                    <li class="activity-item anim-up">
                        <span class="act-dot act-dot--${dotColor}"></span>
                        <div class="act-body">
                            <span class="act-text">${text}</span>
                            <span class="act-time">${formatTimeAgo(new Date(act.time))}</span>
                        </div>
                    </li>
                `;
            }).join('');
        }

        // 5. Radar Chart
        const radarSvg = document.getElementById('radarChart');
        if (radarSvg) {
            radarSvg.innerHTML = ''; // Clear mock rings
            const radarScores = [
                Math.min((data.questions.solvedDsa / 10) * 100, 100), // DSA
                Math.min((data.questions.solvedTech / 10) * 100, 100), // Tech
                (data.interview.avgScore || 0) * 10, // Communication
                data.resume.overall_score, // Resume
                Math.min((data.questions.solvedAptitude / 10) * 100, 100), // Aptitude
                65 // Domain Knowledge (Mock)
            ];
            drawRadar(radarSvg, radarScores);
        }
    }

    /* ══════════════════════════════════
       TOAST & HELPERS
       ══════════════════════════════════ */
    function showToast(msg) {
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
            border-left: 4px solid #CAFF00; border-radius: 12px;
            font-family: 'Plus Jakarta Sans', sans-serif; font-size: 14px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.5);
            animation: toast-in 0.4s cubic-bezier(0.18, 0.89, 0.32, 1.28) forwards;
        `;
        container.appendChild(toast);

        setTimeout(() => {
            toast.style.animation = 'toast-out 0.4s forwards';
            setTimeout(() => toast.remove(), 400);
        }, 3000);
    }

    // Add CSS animations if not present
    if (!document.getElementById('toast-styles')) {
        const style = document.createElement('style');
        style.id = 'toast-styles';
        style.innerHTML = `
            @keyframes toast-in { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
            @keyframes toast-out { to { opacity: 0; transform: translateX(20px); } }
        `;
        document.head.appendChild(style);
    }

    /* ══════════════════════════════════
       MOBILE SIDEBAR
       ══════════════════════════════════ */
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebarOverlay');
    const toggle = document.getElementById('mobileToggle');

    if (toggle) {
        toggle.addEventListener('click', () => {
            sidebar.classList.toggle('open');
            overlay.classList.toggle('open');
            const spans = toggle.querySelectorAll('span');
            const isOpen = sidebar.classList.contains('open');
            spans[0].style.transform = isOpen ? 'rotate(45deg) translate(5px,5px)' : '';
            spans[1].style.opacity = isOpen ? '0' : '1';
            spans[2].style.transform = isOpen ? 'rotate(-45deg) translate(5px,-5px)' : '';
        });
        overlay.addEventListener('click', () => {
            sidebar.classList.remove('open');
            overlay.classList.remove('open');
        });
    }

    /* ══════════════════════════════════
       COUNT-UP ANIMATIONS
       ══════════════════════════════════ */
    function countUp(el, target, suffix = '', duration = 1200) {
        const start = performance.now();
        const update = (now) => {
            const elapsed = now - start;
            const progress = Math.min(elapsed / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
            const current = Math.round(eased * target);
            el.textContent = current + suffix;
            if (progress < 1) requestAnimationFrame(update);
        };
        requestAnimationFrame(update);
    }

    /* ══════════════════════════════════
       SVG RADAR CHART (Dynamic)
       ══════════════════════════════════ */
    function drawRadar(svg, scores = [75, 60, 85, 78, 70, 55]) {
        const cx = 150, cy = 150, maxR = 110;
        const labels = ['DSA', 'Technical', 'Communication', 'Resume', 'Aptitude', 'Domain'];
        const n = labels.length;
        const angleStep = (2 * Math.PI) / n;

        /* Draw grid rings */
        for (let level = 1; level <= 5; level++) {
            const r = (maxR / 5) * level;
            const pts = [];
            for (let i = 0; i < n; i++) {
                const angle = angleStep * i - Math.PI / 2;
                pts.push(`${cx + r * Math.cos(angle)},${cy + r * Math.sin(angle)}`);
            }
            const poly = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
            poly.setAttribute('points', pts.join(' '));
            poly.setAttribute('fill', 'none');
            poly.setAttribute('stroke', 'rgba(202,255,0,0.05)');
            poly.setAttribute('stroke-width', '1');
            svg.appendChild(poly);
        }

        /* Draw axis lines */
        for (let i = 0; i < n; i++) {
            const angle = angleStep * i - Math.PI / 2;
            const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            line.setAttribute('x1', cx);
            line.setAttribute('y1', cy);
            line.setAttribute('x2', cx + maxR * Math.cos(angle));
            line.setAttribute('y2', cy + maxR * Math.sin(angle));
            line.setAttribute('stroke', 'rgba(255,255,255,0.05)');
            line.setAttribute('stroke-width', '1');
            svg.appendChild(line);
        }

        /* Data polygon */
        const dataPts = [];
        for (let i = 0; i < n; i++) {
            const angle = angleStep * i - Math.PI / 2;
            const r = (scores[i] / 100) * maxR;
            dataPts.push(`${cx + r * Math.cos(angle)},${cy + r * Math.sin(angle)}`);
        }
        const dataPoly = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
        dataPoly.setAttribute('points', dataPts.join(' '));
        dataPoly.setAttribute('fill', 'rgba(202,255,0,0.15)');
        dataPoly.setAttribute('stroke', '#CAFF00');
        dataPoly.setAttribute('stroke-width', '2');
        dataPoly.setAttribute('stroke-linejoin', 'round');
        dataPoly.style.opacity = '0';
        dataPoly.style.transition = 'opacity .8s ease-out';
        svg.appendChild(dataPoly);

        /* Score dots / Labels */
        for (let i = 0; i < n; i++) {
            const angle = angleStep * i - Math.PI / 2;
            const r = (scores[i] / 100) * maxR;
            
            // Dot
            const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            circle.setAttribute('cx', cx + r * Math.cos(angle));
            circle.setAttribute('cy', cy + r * Math.sin(angle));
            circle.setAttribute('r', '3');
            circle.setAttribute('fill', '#CAFF00');
            circle.style.opacity = '0';
            circle.style.transition = `opacity .5s ease-out ${.3 + i * .1}s`;
            svg.appendChild(circle);
            setTimeout(() => { circle.style.opacity = '1'; }, 600);

            // Label
            const lx = cx + (maxR + 25) * Math.cos(angle);
            const ly = cy + (maxR + 25) * Math.sin(angle);
            const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            text.setAttribute('x', lx);
            text.setAttribute('y', ly);
            text.setAttribute('text-anchor', 'middle');
            text.setAttribute('dominant-baseline', 'middle');
            text.setAttribute('fill', 'rgba(255,255,255,0.5)');
            text.setAttribute('font-size', '10');
            text.setAttribute('font-weight', '600');
            text.textContent = labels[i];
            svg.appendChild(text);
        }

        setTimeout(() => { dataPoly.style.opacity = '1'; }, 500);
    }

    /* ══════════════════════════════════
       LOGOUT
       ══════════════════════════════════ */
    window.logout = () => {
        showToast("Logging you out safely...");
        setTimeout(() => {
            localStorage.clear();
            window.location.href = 'index.html';
        }, 1200);
    };

    // Initialize
    initDashboard();

});
