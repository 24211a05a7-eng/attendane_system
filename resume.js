document.addEventListener('DOMContentLoaded', () => {
    /* ── AUTH GUARD ── */
    if (!localStorage.getItem('placenix_jwt')) {
        window.location.href = 'index.html?login=true';
        return;
    }

    /* ── DOM refs ── */
    const navbar = document.getElementById('navbar');
    const dropZone = document.getElementById('dropZone');
    const fileInput = document.getElementById('fileInput');
    const fileInfo = document.getElementById('fileInfo');
    const fileName = document.getElementById('fileName');
    const fileRemove = document.getElementById('fileRemove');
    const analyzeBtn = document.getElementById('analyzeBtn');
    const resetBtn = document.getElementById('resetBtn');
    const uploadCard = document.getElementById('uploadCard');

    const resultsSec = document.getElementById('results-section');
    const suggestSec = document.getElementById('suggestions-section');
    const tipsSec = document.getElementById('tips-section');
    const uploadSec = document.getElementById('upload-section');

    const ringFill = document.getElementById('ringFill');
    const ringScore = document.getElementById('ringScore');

    let selectedFile = null;

    /* ── Navbar scroll ── */
    const onScroll = () => navbar.classList.toggle('scrolled', window.scrollY > 50);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();

    /* ── Mobile menu ── */
    const toggle = document.getElementById('mobileToggle');
    const links = document.getElementById('navLinks');
    if (toggle) {
        toggle.addEventListener('click', () => {
            links.classList.toggle('open');
            const spans = toggle.querySelectorAll('span');
            const isOpen = links.classList.contains('open');
            spans[0].style.transform = isOpen ? 'rotate(45deg) translate(5px,5px)' : '';
            spans[1].style.opacity = isOpen ? '0' : '1';
            spans[2].style.transform = isOpen ? 'rotate(-45deg) translate(5px,-5px)' : '';
        });
    }

    /* ── File handling helpers ── */
    function setFile(file) {
        if (!file) return;
        const allowed = ['application/pdf',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
        if (!allowed.includes(file.type) && !/\.(pdf|doc|docx)$/i.test(file.name)) {
            return;
        }
        selectedFile = file;
        fileName.textContent = file.name;
        fileInfo.style.display = 'flex';
        dropZone.style.display = 'none';
        analyzeBtn.disabled = false;
    }

    function clearFile() {
        selectedFile = null;
        fileInput.value = '';
        fileInfo.style.display = 'none';
        dropZone.style.display = 'flex';
        analyzeBtn.disabled = true;
    }

    /* ── Click to upload ── */
    dropZone.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', () => {
        if (fileInput.files.length) setFile(fileInput.files[0]);
    });
    fileRemove.addEventListener('click', clearFile);

    /* ── Drag & drop ── */
    dropZone.addEventListener('dragover', e => {
        e.preventDefault();
        dropZone.classList.add('dragover');
    });
    dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
    dropZone.addEventListener('drop', e => {
        e.preventDefault();
        dropZone.classList.remove('dragover');
        if (e.dataTransfer.files.length) setFile(e.dataTransfer.files[0]);
    });

    /* ── Analyze (Real AI Integration) ── */
    analyzeBtn.addEventListener('click', () => {
        if (!selectedFile) return;
        runAnalysis();
    });

    async function extractTextFromPDF(file) {
        return new Promise((resolve, reject) => {
            // Check if it's a PDF
            if(file.type !== 'application/pdf') {
                return resolve("User uploaded a Word Document or unknown format. Assume standard Software Engineer baseline for analysis purposes.");
            }
            const reader = new FileReader();
            reader.onload = async function() {
                try {
                    const typedarray = new Uint8Array(this.result);
                    // pdfjsLib is loaded globally from CDN
                    const pdf = await pdfjsLib.getDocument(typedarray).promise;
                    let fullText = "";
                    for (let i = 1; i <= pdf.numPages; i++) {
                        const page = await pdf.getPage(i);
                        const content = await page.getTextContent();
                        const strings = content.items.map(item => item.str);
                        fullText += strings.join(" ") + " ";
                    }
                    resolve(fullText);
                } catch (e) {
                    reject(e);
                }
            };
            reader.readAsArrayBuffer(file);
        });
    }

    async function analyzeResumeText(text, fileName) {
        const response = await fetch('/api/resume/analyze', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('placenix_jwt')}`
            },
            body: JSON.stringify({ text, filename: fileName })
        });

        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.error || 'Analysis failed');
        }

        return await response.json();
    }

    function populateResults(data) {
        // Map score rings
        const cards = document.querySelectorAll('.score-card');
        const keys = ['structure', 'skills', 'ats', 'keywords'];
        cards.forEach((card, i) => {
            const scoreValue = data.scores[keys[i]] || 50;
            card.dataset.score = scoreValue;
            // Also update any pre-existing text content to avoid "sticky" values
            const valEl = card.querySelector('.sc-value');
            if (valEl) valEl.textContent = '0%'; // Reset to 0 before animateScoreCards starts
        });

        // Map GAP Analysis
        const missingContainer = document.querySelector('.sug-col:nth-child(1) .sug-pills');
        const strengthsContainer = document.querySelector('.sug-col:nth-child(2) .sug-pills');
        
        missingContainer.innerHTML = (data.missing || []).slice(0,5).map(m => `<span class="pill pill--red">${m}</span>`).join('');
        strengthsContainer.innerHTML = (data.strengths || []).slice(0,5).map(s => `<span class="pill pill--green">${s}</span>`).join('');

        // Map Tips
        const tipsGrid = document.querySelector('.tips-grid');
        tipsGrid.innerHTML = (data.tips || []).slice(0,3).map((t, i) => `
            <div class="tip-card fade-target" style="animation-delay:.${i}s">
                <span class="tip-badge">${i+1}</span>
                <h3 class="tip-title">${t.title}</h3>
                <p class="tip-desc">${t.desc}</p>
            </div>
        `).join('');
    }

    async function runAnalysis() {
        /* Show loading state */
        analyzeBtn.innerHTML = '<span class="spinner"></span> &nbsp; EXTRACTING & ANALYZING...';
        analyzeBtn.classList.add('loading');
        analyzeBtn.disabled = true;

        try {
            const text = await extractTextFromPDF(selectedFile);
            
            analyzeBtn.innerHTML = '<span class="spinner"></span> &nbsp; RUNNING AI MODELS...';
            
            const analysis = await analyzeResumeText(text, selectedFile.name);
            populateResults(analysis);

            // PERSISTENCE: Save latest score
            localStorage.setItem('placenix_resume_score', analysis.overall_score || 0);
            localStorage.setItem('placenix_last_analysis', new Date().toISOString());

            /* Hide upload section */
            uploadSec.style.display = 'none';

            /* Show result sections */
            showSection(resultsSec, () => {
                animateRing(analysis.overall_score || 0);
                animateScoreCards();
                showSection(suggestSec, () => {
                    showSection(tipsSec);
                }, 600);
            }, 100);

            /* Scroll to top */
            window.scrollTo({ top: 0, behavior: 'smooth' });
        } catch(err) {
            console.error(err);
            alert(`Analysis failed: ${err.message}. Please try again.`);
            
            /* Crucial: ensure results stay hidden on failure */
            [resultsSec, suggestSec, tipsSec].forEach(sec => {
                sec.classList.add('hidden');
                sec.classList.remove('show');
            });
            resetBtn.click();
        }
    }

    /* ── Show a section & trigger fade-ins ── */
    function showSection(section, callback, delay = 300) {
        setTimeout(() => {
            section.classList.remove('hidden');
            section.classList.add('show');

            /* Stagger fade-in for children */
            const targets = section.querySelectorAll('.fade-target');
            targets.forEach((el, i) => {
                setTimeout(() => el.classList.add('visible'), 120 * i);
            });

            if (callback) setTimeout(callback, targets.length * 120 + 200);
        }, delay);
    }

    /* ── Animate circular ring ── */
    function animateRing(score) {
        const circumference = 2 * Math.PI * 80; // r=80
        const offset = circumference - (score / 100) * circumference;

        /* Color the ring based on score */
        if (score >= 80) {
            ringFill.style.stroke = 'var(--green)';
        } else if (score >= 60) {
            ringFill.style.stroke = 'var(--lime)';
        } else {
            ringFill.style.stroke = 'var(--red)';
        }

        setTimeout(() => {
            ringFill.style.strokeDashoffset = offset;
        }, 200);

        /* Count up the number */
        let current = 0;
        const step = Math.ceil(score / 40);
        const counter = setInterval(() => {
            current += step;
            if (current >= score) {
                current = score;
                clearInterval(counter);
            }
            ringScore.textContent = current;
        }, 35);
    }

    /* ── Animate score cards ── */
    function animateScoreCards() {
        const cards = document.querySelectorAll('.score-card');
        cards.forEach((card, i) => {
            const score = parseInt(card.dataset.score);
            const fill = card.querySelector('.sc-bar-fill');
            const value = card.querySelector('.sc-value');

            /* Color based on score */
            let color;
            if (score >= 80) color = 'var(--green)';
            else if (score >= 60) color = 'var(--amber)';
            else color = 'var(--red)';

            setTimeout(() => {
                fill.style.width = score + '%';
                fill.style.background = color;
                value.style.color = color;
                value.textContent = score + '%'; // FIX: Update the text label
            }, 400 + i * 200);
        });
    }

    /* ── Reset ── */
    if (resetBtn) {
        resetBtn.addEventListener('click', () => {
            /* Hide result sections */
            [resultsSec, suggestSec, tipsSec].forEach(sec => {
                sec.classList.add('hidden');
                sec.classList.remove('show');
                sec.querySelectorAll('.fade-target').forEach(el => el.classList.remove('visible'));
            });

            /* Reset ring */
            ringFill.style.strokeDashoffset = 502.65;
            ringScore.textContent = '0';

            /* Reset score bars */
            document.querySelectorAll('.sc-bar-fill').forEach(f => { f.style.width = '0'; });

            /* Show upload section */
            uploadSec.style.display = 'flex';
            clearFile();

            /* Restore analyze button */
            analyzeBtn.innerHTML = 'ANALYZE RESUME <span class="btn-arrow">→</span>';
            analyzeBtn.classList.remove('loading');

            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
    }
    /* ── Demo mode: auto-show results via ?demo=true ── */
    if (new URLSearchParams(window.location.search).has('demo')) {
        uploadSec.style.display = 'none';
        showSection(resultsSec, () => {
            animateRing(78);
            animateScoreCards();
            showSection(suggestSec, () => {
                showSection(tipsSec);
            }, 600);
        }, 300);
    }

    async function fetchHistory() {
        if (!localStorage.getItem('placenix_jwt')) return;
        try {
            const response = await fetch('/api/resume/history', {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('placenix_jwt')}` }
            });
            if (response.ok) {
                const history = await response.json();
                renderHistory(history);
            }
        } catch (e) {
            console.error('History Fetch Error:', e);
        }
    }

    function renderHistory(history) {
        const historyCard = document.getElementById('historyCard');
        const historyList = document.getElementById('historyList');
        if (!historyList || !historyCard) return;

        if (history.length === 0) {
            historyCard.classList.add('hidden');
            return;
        }

        historyCard.classList.remove('hidden');
        historyList.innerHTML = history.map(item => `
            <div class="history-item" style="display:flex; justify-content:space-between; align-items:center; background:rgba(18,18,18,0.4); padding:16px; border-radius:12px; border:1px solid rgba(255,255,255,0.05); transition:all 0.3s ease;">
                <div style="display:flex; align-items:center; gap:16px;">
                    <div style="font-size:1.5rem; background:rgba(202,255,0,0.1); width:48px; height:48px; display:flex; rotate:12deg; align-items:center; justify-content:center; border-radius:10px;">📄</div>
                    <div>
                        <div style="font-weight:700; color:white; font-size:1rem; letter-spacing:0.5px;">${item.filename || 'Resume.pdf'}</div>
                        <div style="font-size:0.8rem; color:var(--qb-text-dim); margin-top:4px;">${new Date(item.created_at).toLocaleDateString(undefined, {month:'short', day:'numeric', year:'numeric'})}</div>
                    </div>
                </div>
                <div style="text-align:right;">
                    <div style="color:var(--lime); font-family:'Space Grotesk'; font-weight:800; font-size:1.4rem;">${item.overall_score}%</div>
                    <div style="font-size:0.7rem; color:var(--qb-text-dim); font-weight:600; text-transform:uppercase; letter-spacing:1px; margin-top:2px;">AI SCORE</div>
                </div>
            </div>
        `).join('');
    }

    fetchHistory();
});
