document.addEventListener('DOMContentLoaded', () => {
    /* ── AUTH GUARD ── */
    if (!localStorage.getItem('placenix_jwt')) {
        window.location.href = 'index.html?login=true';
        return;
    }

    /* ══════════════════════════════════
       QUESTION BANKS
       ══════════════════════════════════ */
    const QUESTIONS = {
        hr: [
            "Tell me about a time you solved a complex technical problem under pressure.",
            "Describe a situation where you had to work with a difficult team member.",
            "What is your greatest strength, and how has it helped you professionally?",
            "Where do you see yourself in five years?",
            "Tell me about a failure you experienced and what you learned from it.",
            "Why do you want to work at this company?",
            "How do you prioritise tasks when everything feels urgent?",
            "Describe a project you're most proud of and your role in it."
        ],
        technical: [
            "Explain the difference between a process and a thread.",
            "What is normalisation in databases? Explain up to 3NF.",
            "Describe the SOLID principles of object-oriented design.",
            "What happens when you type a URL into a browser?",
            "Explain the difference between TCP and UDP.",
            "What is virtual memory and how does paging work?",
            "Describe the MVC architecture pattern with an example.",
            "What are indexes in databases and when would you avoid them?"
        ],
        dsa: [
            "How would you find the middle element of a linked list in one pass?",
            "Explain your approach to detect a cycle in a directed graph.",
            "Describe how you would implement an LRU Cache.",
            "Walk me through solving the 'Two Sum' problem optimally.",
            "How would you find the longest common subsequence of two strings?",
            "Explain the difference between BFS and DFS with use cases.",
            "How would you merge K sorted arrays efficiently?",
            "Describe your approach to the 'Trapping Rain Water' problem."
        ],
        system: [
            "How would you design a URL shortening service like bit.ly?",
            "Design a real-time chat system that supports group conversations.",
            "How would you architect a notification service at scale?",
            "Design a rate limiter for a public API.",
            "How would you build a news feed system like Twitter's timeline?",
            "Design a file storage service like Google Drive.",
            "How would you design a video streaming platform?",
            "Architect a ride-sharing backend like Uber."
        ]
    };

    /* ── Mock feedback generator ── */
    function generateFeedback(answerLen) {
        const base = Math.min(answerLen / 15, 6);
        const clarity = Math.min(10, Math.round(base + Math.random() * 3.5));
        const depth = Math.min(10, Math.round(base + Math.random() * 3));
        const confidence = Math.min(10, Math.round(base + Math.random() * 3.2));
        return { clarity, depth, confidence };
    }

    function scoreColor(val) {
        if (val >= 8) return 'var(--green)';
        if (val >= 5) return 'var(--amber)';
        return 'var(--red)';
    }

    /* ══════════════════════════════════
       DOM REFS
       ══════════════════════════════════ */
    const progressDots = document.getElementById('progressDots');
    const qCurrent = document.getElementById('qCurrent');
    const qTotal = document.getElementById('qTotal');
    const questionText = document.getElementById('questionText');
    const questionBubble = document.getElementById('questionBubble');
    const typingIndicator = document.getElementById('typingIndicator');
    const timerValue = document.getElementById('timerValue');
    const timerEl = document.getElementById('timer');
    const answerInput = document.getElementById('answerInput');
    const charCount = document.getElementById('charCount');
    const submitBtn = document.getElementById('submitBtn');
    const skipBtn = document.getElementById('skipBtn');
    const feedbackPanel = document.getElementById('feedbackPanel');
    const nextBtn = document.getElementById('nextBtn');
    const roundPills = document.querySelectorAll('.round-pill');

    let currentRound = 'hr';
    let currentQ = 0;
    let totalQ = 8;
    let timerSec = 300; // 5 min
    let timerInterval = null;

    /* ══════════════════════════════════
       INIT
       ══════════════════════════════════ */
    /* ══════════════════════════════════
       VOICE ENGINE (STT & TTS)
       ══════════════════════════════════ */
    const voiceToggle = document.getElementById('voiceToggle');
    const micBtn = document.getElementById('micBtn');
    let recognition = null;
    let isListening = false;

    if ('webkitSpeechRecognition' in window) {
        recognition = new webkitSpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'en-US';

        recognition.onresult = (event) => {
            let interimTranscript = '';
            let finalTranscript = '';
            for (let i = event.resultIndex; i < event.results.length; ++i) {
                if (event.results[i].isFinal) {
                    finalTranscript += event.results[i][0].transcript;
                } else {
                    interimTranscript += event.results[i][0].transcript;
                }
            }
            if (finalTranscript) {
                answerInput.value += (answerInput.value ? ' ' : '') + finalTranscript;
                charCount.textContent = answerInput.value.length;
            }
        };

        recognition.onend = () => {
            if (isListening) recognition.start();
        };
    }

    function toggleMic(force) {
        if (!recognition) return;
        isListening = typeof force === 'boolean' ? force : !isListening;
        
        if (isListening) {
            try { recognition.start(); } catch(e) {}
            micBtn.style.background = 'rgba(202,255,0,0.3)';
            micBtn.style.boxShadow = '0 0 15px rgba(202,255,0,0.2)';
        } else {
            recognition.stop();
            micBtn.style.background = 'rgba(202,255,0,0.1)';
            micBtn.style.boxShadow = 'none';
        }
    }

    if (micBtn) micBtn.addEventListener('click', () => toggleMic());

    function speak(text) {
        // Stop any current speech
        window.speechSynthesis.cancel();
        
        if (!voiceToggle || !voiceToggle.checked) return;

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 1.0;
        utterance.pitch = 1.0;
        
        // Auto-interrupt: stop mic if AI starts speaking
        toggleMic(false);

        utterance.onend = () => {
            // Auto-start mic after AI finishes
            if (voiceToggle.checked) toggleMic(true);
        };

        window.speechSynthesis.speak(utterance);
    }

    /* ── Load question ── */
    function loadQuestion() {
        const question = QUESTIONS[currentRound][currentQ];
        qCurrent.textContent = currentQ + 1;
        questionBubble.style.animation = 'none';
        void questionBubble.offsetHeight;
        questionBubble.style.animation = 'bubble-in .5s cubic-bezier(.22,1,.36,1)';
        questionText.textContent = question;
        answerInput.value = '';
        charCount.textContent = '0';
        feedbackPanel.classList.add('hidden');
        submitBtn.classList.remove('loading');
        submitBtn.disabled = false;
        skipBtn.disabled = false;

        // Speak question if voice mode is on
        speak(question);
    }

    /* ── Submit (Real AI Backend) ── */
    submitBtn.addEventListener('click', async () => {
        const answer = answerInput.value.trim();
        if (!answer) return;

        submitBtn.classList.add('loading');
        submitBtn.disabled = true;
        skipBtn.disabled = true;
        toggleMic(false);

        typingIndicator.style.display = 'flex';

        try {
            const response = await fetch('/api/interview/feedback', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('placenix_jwt')}`
                },
                body: JSON.stringify({
                    question: questionText.textContent,
                    answer: answer,
                    roundType: currentRound
                })
            });

            if (!response.ok) throw new Error('AI Analysis failed');
            const feedback = await response.json();
            
            typingIndicator.style.display = 'none';
            showFeedback(feedback);

            // Speak feedback if voice mode is on
            speak(feedback.feedback + " " + feedback.advice);

        } catch (err) {
            console.error(err);
            typingIndicator.style.display = 'none';
            alert('Could not get AI feedback. Please try again.');
            submitBtn.disabled = false;
        }
    });

    function showFeedback(fb) {
        feedbackPanel.classList.remove('hidden');
        feedbackPanel.style.animation = 'fade-up .5s cubic-bezier(.22,1,.36,1)';

        setMetric('metricClarity', fb.clarity);
        setMetric('metricDepth', fb.depth);
        setMetric('metricConfidence', fb.confidence);

        // Update the feedback panel title or add summary text
        const title = feedbackPanel.querySelector('.feedback-title');
        title.innerHTML = `AI Evaluation: <span style="color:var(--lime)">${fb.feedback}</span>`;
    }

    function setMetric(id, val) {
        const el = document.getElementById(id);
        const scoreEl = el.querySelector('.metric-score');
        scoreEl.textContent = `${val}/10`;
        scoreEl.style.color = scoreColor(val);
    }

    /* ── Advance Session (Save at end) ── */
    async function advanceQuestion() {
        currentQ++;
        if (currentQ >= totalQ) {
            // End of round - save session
            await saveSession();
            currentQ = 0; 
            alert('Interview round completed! Your progress has been saved.');
        }
        updateDots();
        loadQuestion();
        resetTimer();
        startTimer();
    }

    async function saveSession() {
        if (!localStorage.getItem('placenix_jwt')) return;
        // Simple aggregate for now
        const summary = {
            round_type: currentRound,
            overall_score: 75, // Simplified
            transcript: [], // Could be implemented with detailed logging
            feedback: { items: "Completed " + currentRound + " round." }
        };
        try {
            await fetch('/api/interview/save', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('placenix_jwt')}`
                },
                body: JSON.stringify(summary)
            });
        } catch (e) { console.error('Save error:', e); }
    }

    /* ── Skip / Next ── */
    skipBtn.addEventListener('click', () => advanceQuestion());
    nextBtn.addEventListener('click', () => advanceQuestion());

    /* ── Timer ── */
    function resetTimer() {
        clearInterval(timerInterval);
        timerSec = 300;
        timerEl.classList.remove('warning', 'danger');
        updateTimerDisplay();
    }

    function startTimer() {
        timerInterval = setInterval(() => {
            if (timerSec > 0) {
                timerSec--;
                if (timerSec <= 30) timerEl.classList.add('danger');
                else if (timerSec <= 60) timerEl.classList.add('warning');
                updateTimerDisplay();
            } else {
                clearInterval(timerInterval);
            }
        }, 1000);
    }

    function updateTimerDisplay() {
        const m = String(Math.floor(timerSec / 60)).padStart(2, '0');
        const s = String(timerSec % 60).padStart(2, '0');
        timerValue.textContent = `${m}:${s}`;
    }

    /* ── Char count ── */
    answerInput.addEventListener('input', () => {
        charCount.textContent = answerInput.value.length;
    });

    /* ── Round switch ── */
    roundPills.forEach(pill => {
        pill.addEventListener('click', () => {
            roundPills.forEach(p => p.classList.remove('active'));
            pill.classList.add('active');
            currentRound = pill.dataset.round;
            init();
        });
    });

    init();
});
