/**
 * VOCABMASTER - CLEAN, BRIGHT, PROFESSIONAL VOCABULARY LEARNING APPLICATION
 * Inspired by eBay, Quizlet, Duolingo & Cambridge English
 * Zero Emojis, Pure SVG Vector Icons, Accessible & Responsive
 */

(function () {
  'use strict';

  // Application State
  const state = {
    topics: window.VOCABULARY_DATA || [],
    categories: window.VOCAB_CATEGORIES || [],
    currentTopic: null,
    currentMode: 'flashcards', // 'flashcards' | 'quiz' | 'listening' | 'dictation' | 'match' | 'list'
    currentCategory: 'Tất cả',
    searchQuery: '',
    
    // User progress (persisted in localStorage)
    learnedWords: new Set(),
    starredWords: new Set(),
    streak: 1,
    lastActiveDate: null,
    quizScore: 0,
    quizStreak: 0,
    
    // Hero preview card state
    previewIndex: 0,
    previewWord: null,
    previewIsFlipped: false,

    // Flashcard mode state
    cardIndex: 0,
    cardList: [],
    isFlipped: false,
    autoSpeak: true,

    // Quiz mode state
    quizQuestions: [],
    quizIndex: 0,
    quizTotal: 10,
    quizCorrect: 0,

    // Dictation state
    dictationIndex: 0,
    dictationList: [],

    // Match game state
    matchCards: [],
    selectedMatchCard: null,
    matchedCount: 0,
    matchMoves: 0,
    matchTimer: 0,
    matchInterval: null,

    // Audio settings
    voiceRate: 1.0,
    selectedVoice: null,
    voices: []
  };

  // Helper: Get SVG from icons.js
  const icon = (name, className = '') => {
    if (typeof window.getSvgIcon === 'function') {
      return window.getSvgIcon(name, className);
    }
    return '';
  };

  // Web Speech API
  function initSpeech() {
    if ('speechSynthesis' in window) {
      const loadVoices = () => {
        const allVoices = window.speechSynthesis.getVoices();
        state.voices = allVoices.filter(v => v.lang.startsWith('en'));
        if (state.voices.length === 0) state.voices = allVoices;
        state.selectedVoice = state.voices.find(v => v.lang === 'en-US' || v.name.includes('Natural') || v.name.includes('Google')) || state.voices[0];
        populateVoiceSelect();
      };
      loadVoices();
      if (window.speechSynthesis.onvoiceschanged !== undefined) {
        window.speechSynthesis.onvoiceschanged = loadVoices;
      }
    }
  }

  function speakText(text) {
    if (!('speechSynthesis' in window) || !text) return;
    window.speechSynthesis.cancel();
    const clean = text.replace(/[\(\)\/\.\,]/g, ' ').trim();
    const utterance = new SpeechSynthesisUtterance(clean);
    if (state.selectedVoice) utterance.voice = state.selectedVoice;
    utterance.rate = state.voiceRate;
    utterance.pitch = 1.0;
    window.speechSynthesis.speak(utterance);
  }

  function populateVoiceSelect() {
    const select = document.getElementById('voiceSelect');
    if (!select) return;
    select.innerHTML = '';
    state.voices.forEach((v, idx) => {
      const opt = document.createElement('option');
      opt.value = idx;
      opt.textContent = `${v.name} (${v.lang})`;
      if (v === state.selectedVoice) opt.selected = true;
      select.appendChild(opt);
    });
  }

  // Sound Effects using Web Audio API
  let audioCtx = null;
  function getAudioContext() {
    if (!audioCtx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) audioCtx = new AudioContext();
    }
    if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
    return audioCtx;
  }

  function playChime(success = true) {
    try {
      const ctx = getAudioContext();
      if (!ctx) return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      if (success) {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(587.33, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15);
        gain.gain.setValueAtTime(0.12, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.3);
      } else {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(240, ctx.currentTime);
        osc.frequency.linearRampToValueAtTime(170, ctx.currentTime + 0.18);
        gain.gain.setValueAtTime(0.12, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.22);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.22);
      }
    } catch (e) {
      console.warn('Audio effect error:', e);
    }
  }

  // Persistence
  function loadStoredData() {
    try {
      const savedLearned = localStorage.getItem('vm_learned_words');
      if (savedLearned) state.learnedWords = new Set(JSON.parse(savedLearned));

      const savedStarred = localStorage.getItem('vm_starred_words');
      if (savedStarred) state.starredWords = new Set(JSON.parse(savedStarred));

      const savedRate = localStorage.getItem('vm_voice_rate');
      if (savedRate) state.voiceRate = parseFloat(savedRate);

      const savedTheme = localStorage.getItem('vm_theme') || 'light';
      document.documentElement.setAttribute('data-theme', savedTheme);

      // Streak tracking
      const today = new Date().toISOString().split('T')[0];
      const lastDate = localStorage.getItem('vm_last_date');
      let streak = parseInt(localStorage.getItem('vm_streak') || '1', 10);
      if (lastDate) {
        const last = new Date(lastDate);
        const diffDays = Math.floor((new Date(today) - last) / (1000 * 60 * 60 * 24));
        if (diffDays === 1) {
          // consecutive
        } else if (diffDays > 1) {
          streak = 1;
        }
      }
      localStorage.setItem('vm_last_date', today);
      localStorage.setItem('vm_streak', streak.toString());
      state.streak = streak;
    } catch (e) {
      console.warn('Storage load error:', e);
    }
  }

  function saveStoredData() {
    try {
      localStorage.setItem('vm_learned_words', JSON.stringify(Array.from(state.learnedWords)));
      localStorage.setItem('vm_starred_words', JSON.stringify(Array.from(state.starredWords)));
      localStorage.setItem('vm_voice_rate', state.voiceRate.toString());
    } catch (e) {
      console.warn('Storage save error:', e);
    }
  }

  // Helpers
  function getAllWords() {
    const list = [];
    state.topics.forEach(t => t.words.forEach(w => list.push(w)));
    return list;
  }

  function getStarredWordsList() {
    const list = [];
    state.topics.forEach(t => {
      t.words.forEach(w => {
        if (state.starredWords.has(w.id)) list.push(w);
      });
    });
    return list;
  }

  function shuffle(array) {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  // Inject Static Vector SVG Icons
  function injectStaticIcons() {
    const setHtml = (id, iconName) => {
      const el = document.getElementById(id);
      if (el) el.innerHTML = icon(iconName);
    };

    setHtml('brandLogoContainer', 'logo-book');
    setHtml('iconTargetStat', 'target');
    setHtml('iconStarStat', 'star');
    setHtml('iconFlameStat', 'flame');
    setHtml('iconVoiceSettings', 'volume');
    setHtml('iconSyncBtn', 'save');
    setHtml('iconThemeToggle', document.documentElement.getAttribute('data-theme') === 'dark' ? 'sun' : 'moon');

    setHtml('iconGraduationTag', 'graduation');
    setHtml('iconHeroArrow', 'arrow-right');
    setHtml('iconHeroStar', 'star');
    setHtml('iconSearchInput', 'search');
    setHtml('iconClearSearch', 'x');

    setHtml('iconPreviewSparkle', 'sparkles');
    setHtml('iconPreviewHint', 'info');
    setHtml('iconPreviewSpeaker', 'volume');
    setHtml('iconPreviewNextArrow', 'arrow-right');

    setHtml('iconBackBtn', 'arrow-left');
    setHtml('iconTabFlashcards', 'book');
    setHtml('iconTabQuiz', 'check');
    setHtml('iconTabListening', 'volume');
    setHtml('iconTabDictation', 'graduation');
    setHtml('iconTabMatch', 'target');
    setHtml('iconTabList', 'book');

    setHtml('iconCardSpeakerFront', 'volume');
    setHtml('iconCardSpeakerBack', 'volume');
    setHtml('iconCardHintFront', 'info');
    setHtml('iconCardHintBack', 'info');
    setHtml('iconPrevCardSvg', 'arrow-left');
    setHtml('iconNextCardSvg', 'arrow-right');
    setHtml('iconHardAlert', 'alert');
    setHtml('iconEasyCheck', 'check');

    setHtml('iconQuizFlame', 'flame');
    setHtml('iconListeningBadge', 'headphones');
    setHtml('iconDictationAudioSvg', 'volume');
    setHtml('iconCheckDictationArrow', 'arrow-right');
    setHtml('iconMatchTimer', 'clock');
    setHtml('iconMatchMoves', 'target');

    setHtml('iconModalStarHeader', 'star');
    setHtml('iconCloseStarred', 'x');
    setHtml('iconModalSyncHeader', 'save');
    setHtml('iconCloseBackup', 'x');
    setHtml('iconBackupNotice', 'info');
  }

  // Update Global Stats
  function updateGlobalStats() {
    const totalWordsCount = 1046;
    const learnedCount = state.learnedWords.size;
    const learnedPercent = Math.round((learnedCount / totalWordsCount) * 100);

    const elHeaderLearned = document.getElementById('headerLearnedVal');
    if (elHeaderLearned) elHeaderLearned.textContent = learnedCount;

    const elHeaderStarred = document.getElementById('headerStarredVal');
    if (elHeaderStarred) elHeaderStarred.textContent = state.starredWords.size;

    const elHeaderStreak = document.getElementById('headerStreakVal');
    if (elHeaderStreak) elHeaderStreak.textContent = state.streak;

    const elHeroStarred = document.getElementById('heroStarredCount');
    if (elHeroStarred) elHeroStarred.textContent = state.starredWords.size;

    const elHeroMastery = document.getElementById('heroMasteryPercent');
    if (elHeroMastery) elHeroMastery.textContent = `${learnedPercent}% (${learnedCount} / ${totalWordsCount} từ)`;

    const elHeroBar = document.getElementById('heroProgressBar');
    if (elHeroBar) elHeroBar.style.width = `${learnedPercent}%`;
  }

  // ==========================================================================
  // HERO INTERACTIVE PREVIEW WIDGET
  // ==========================================================================
  function initHeroPreview() {
    const all = getAllWords();
    if (all.length === 0) return;
    state.previewWord = all[0];
    state.previewIsFlipped = false;
    renderHeroPreview();
  }

  function renderHeroPreview() {
    if (!state.previewWord) return;
    const word = state.previewWord;

    document.getElementById('previewWordText').textContent = word.word;
    document.getElementById('previewPhoneticText').textContent = word.phonetic;
    document.getElementById('previewMeaningText').textContent = word.meaning;
    document.getElementById('previewTopicNameBadge').textContent = word.topicName || 'Từ Vựng';

    const meaningEl = document.getElementById('previewMeaningText');
    const labelEl = document.getElementById('previewHintLabel');
    if (state.previewIsFlipped) {
      meaningEl.style.display = 'block';
      if (labelEl) labelEl.textContent = 'Bấm để lật lại mặt trước';
    } else {
      meaningEl.style.display = 'none';
      if (labelEl) labelEl.textContent = 'Bấm vào thẻ để lật xem nghĩa tiếng Việt';
    }
  }

  // ==========================================================================
  // DASHBOARD & TOPICS VIEW
  // ==========================================================================
  function renderCategories() {
    const container = document.getElementById('categoryScroll');
    if (!container) return;
    container.innerHTML = '';

    state.categories.forEach(cat => {
      let count = 0;
      if (cat === 'Tất cả') {
        count = state.topics.length;
      } else {
        count = state.topics.filter(t => t.category === cat).length;
      }

      const btn = document.createElement('button');
      btn.className = `category-tab-btn ${cat === state.currentCategory ? 'active' : ''}`;
      btn.textContent = `${cat} (${count})`;
      btn.addEventListener('click', () => {
        state.currentCategory = cat;
        renderCategories();
        renderTopics();
      });
      container.appendChild(btn);
    });
  }

  function renderTopics() {
    const grid = document.getElementById('topicsGrid');
    if (!grid) return;
    grid.innerHTML = '';

    const query = state.searchQuery.toLowerCase().trim();

    let filtered = state.topics.filter(t => {
      if (state.currentCategory !== 'Tất cả' && t.category !== state.currentCategory) {
        return false;
      }
      if (query) {
        const matchTitle = t.title.toLowerCase().includes(query);
        const matchWords = t.words.some(w => 
          w.word.toLowerCase().includes(query) || 
          w.meaning.toLowerCase().includes(query) ||
          w.phonetic.toLowerCase().includes(query)
        );
        return matchTitle || matchWords;
      }
      return true;
    });

    if (filtered.length === 0) {
      grid.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 4rem 1rem; background: var(--bg-surface); border: 1px solid var(--border-card); border-radius: var(--radius-lg);">
          <div style="margin-bottom: 0.85rem; color: var(--text-muted);">${icon('search', 'empty-search-svg')}</div>
          <h3 style="font-size: 1.25rem; font-weight: 800; color: var(--text-primary);">Không tìm thấy chủ đề hoặc từ vựng phù hợp</h3>
          <p style="margin-top: 0.4rem; color: var(--text-muted); font-size: 0.9rem;">Hãy thử tìm bằng từ khóa khác hoặc chuyển danh mục về "Tất cả".</p>
        </div>
      `;
      return;
    }

    filtered.forEach(t => {
      const learnedInTopic = t.words.filter(w => state.learnedWords.has(w.id)).length;
      const percent = Math.round((learnedInTopic / t.words.length) * 100);
      const svgIcon = icon(t.iconName || 'book');

      const card = document.createElement('div');
      card.className = 'topic-card';
      card.innerHTML = `
        <div class="topic-card-header">
          <div class="topic-icon-pod">${svgIcon}</div>
          <span class="topic-index-badge">#${t.id.toString().padStart(2, '0')}</span>
        </div>
        <div class="topic-body-content">
          <span class="topic-cat-name">${t.category}</span>
          <h3 class="topic-title-text">${t.title}</h3>
        </div>
        <div class="topic-footer-info">
          <div class="topic-meta-row">
            <span>${t.words.length} từ vựng</span>
            <span>${learnedInTopic}/${t.words.length} (${percent}%)</span>
          </div>
          <div class="progress-track-subtle">
            <div class="progress-fill-subtle" style="width: ${percent}%;"></div>
          </div>
        </div>
      `;
      card.addEventListener('click', () => {
        openTopicWorkspace(t);
      });
      grid.appendChild(card);
    });
  }

  // ==========================================================================
  // STUDY WORKSPACE
  // ==========================================================================
  function openTopicWorkspace(topic, mode = 'flashcards') {
    state.currentTopic = topic;
    state.currentMode = mode;

    document.getElementById('dashboardView').style.display = 'none';
    const workspace = document.getElementById('studyWorkspace');
    workspace.style.display = 'flex';
    window.scrollTo({ top: 0, behavior: 'smooth' });

    // Header info
    document.getElementById('studyTopicIconPod').innerHTML = icon(topic.iconName || 'book');
    document.getElementById('studyTopicTitle').textContent = topic.title;
    document.getElementById('studyTopicCategory').textContent = `${topic.category} • ${topic.words.length} từ vựng`;

    updateModeTabs();
    switchStudyMode(state.currentMode);
  }

  function closeWorkspace() {
    document.getElementById('studyWorkspace').style.display = 'none';
    document.getElementById('dashboardView').style.display = 'flex';
    state.currentTopic = null;
    if (state.matchInterval) clearInterval(state.matchInterval);
    updateGlobalStats();
    renderTopics();
  }

  function updateModeTabs() {
    document.querySelectorAll('.mode-tab-btn').forEach(btn => {
      if (btn.dataset.mode === state.currentMode) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });
  }

  function switchStudyMode(mode) {
    state.currentMode = mode;
    updateModeTabs();

    document.querySelectorAll('.mode-container').forEach(c => c.style.display = 'none');
    if (!state.currentTopic) return;

    if (mode === 'flashcards') {
      document.getElementById('flashcardModeContainer').style.display = 'flex';
      initFlashcards();
    } else if (mode === 'quiz') {
      document.getElementById('quizModeContainer').style.display = 'flex';
      initQuiz();
    } else if (mode === 'listening') {
      document.getElementById('listeningModeContainer').style.display = 'flex';
      initListening();
    } else if (mode === 'dictation') {
      document.getElementById('dictationModeContainer').style.display = 'flex';
      initDictation();
    } else if (mode === 'match') {
      document.getElementById('matchModeContainer').style.display = 'flex';
      initMatchGame();
    } else if (mode === 'list') {
      document.getElementById('listModeContainer').style.display = 'flex';
      renderWordExplorer();
    }
  }

  // ==========================================================================
  // MODE 1: FLASHCARDS
  // ==========================================================================
  function initFlashcards() {
    state.cardList = [...state.currentTopic.words];
    state.cardIndex = 0;
    state.isFlipped = false;
    renderFlashcard();
  }

  function renderFlashcard() {
    const cardContainer = document.getElementById('flashcardElement');
    if (!cardContainer || state.cardList.length === 0) return;

    const word = state.cardList[state.cardIndex];
    state.isFlipped = false;
    cardContainer.classList.remove('is-flipped');

    // Progress text
    document.getElementById('cardProgressText').textContent = `${state.cardIndex + 1} / ${state.cardList.length}`;
    const pct = Math.round(((state.cardIndex + 1) / state.cardList.length) * 100);
    document.getElementById('cardProgressFill').style.width = `${pct}%`;

    // Front
    document.getElementById('cardWordFront').textContent = word.word;
    document.getElementById('cardPhoneticFront').textContent = word.phonetic;
    document.getElementById('cardTopicBadgeFront').textContent = state.currentTopic.title;

    // Back
    document.getElementById('cardWordBack').textContent = word.word;
    document.getElementById('cardMeaningBack').textContent = word.meaning;
    document.getElementById('cardPhoneticBack').textContent = word.phonetic;

    // Star status
    const starBtnFront = document.getElementById('cardStarBtnFront');
    const starBtnBack = document.getElementById('cardStarBtnBack');
    const isStarred = state.starredWords.has(word.id);
    const starSvg = icon(isStarred ? 'star-filled' : 'star');

    [starBtnFront, starBtnBack].forEach(btn => {
      if (btn) {
        btn.innerHTML = starSvg;
        btn.classList.toggle('starred', isStarred);
      }
    });

    if (state.autoSpeak) {
      speakText(word.word);
    }
  }

  function toggleFlipCard() {
    const cardContainer = document.getElementById('flashcardElement');
    if (!cardContainer) return;
    state.isFlipped = !state.isFlipped;
    cardContainer.classList.toggle('is-flipped', state.isFlipped);
  }

  function nextCard(markLearned = false) {
    if (state.cardList.length === 0) return;
    const word = state.cardList[state.cardIndex];
    if (markLearned) {
      state.learnedWords.add(word.id);
      saveStoredData();
      updateGlobalStats();
      playChime(true);
    }
    if (state.cardIndex < state.cardList.length - 1) {
      state.cardIndex++;
      renderFlashcard();
    } else {
      triggerConfetti();
      alert(`Chúc mừng bạn đã hoàn thành các thẻ học của chủ đề "${state.currentTopic.title}"!`);
    }
  }

  function prevCard() {
    if (state.cardIndex > 0) {
      state.cardIndex--;
      renderFlashcard();
    }
  }

  function toggleStarCurrentCard() {
    if (state.cardList.length === 0) return;
    const word = state.cardList[state.cardIndex];
    if (state.starredWords.has(word.id)) {
      state.starredWords.delete(word.id);
    } else {
      state.starredWords.add(word.id);
    }
    saveStoredData();
    updateGlobalStats();
    renderFlashcard();
  }

  // ==========================================================================
  // MODE 2: QUIZ
  // ==========================================================================
  function initQuiz() {
    state.quizIndex = 0;
    state.quizScore = 0;
    state.quizStreak = 0;
    state.quizTotal = Math.min(10, state.currentTopic.words.length);

    const shuffled = shuffle(state.currentTopic.words);
    state.quizQuestions = shuffled.slice(0, state.quizTotal).map(w => {
      const others = state.currentTopic.words.filter(item => item.id !== w.id);
      const wrong = shuffle(others).slice(0, 3);
      const options = shuffle([w, ...wrong]);
      return { target: w, options: options };
    });

    renderQuizQuestion();
  }

  function renderQuizQuestion() {
    const qBox = document.getElementById('quizPromptBox');
    const optionsGrid = document.getElementById('quizOptionsGrid');
    if (!qBox || !optionsGrid) return;

    if (state.quizIndex >= state.quizQuestions.length) {
      renderQuizResults();
      return;
    }

    const q = state.quizQuestions[state.quizIndex];
    document.getElementById('quizProgressText').textContent = `Câu ${state.quizIndex + 1} / ${state.quizQuestions.length}`;
    document.getElementById('quizScoreVal').textContent = `Điểm: ${state.quizScore * 10}`;
    document.getElementById('quizStreakVal').textContent = `Chuỗi: ${state.quizStreak}`;

    document.getElementById('quizPromptWord').textContent = q.target.word;
    document.getElementById('quizPromptPhonetic').textContent = q.target.phonetic;

    optionsGrid.innerHTML = '';
    const letters = ['A', 'B', 'C', 'D'];

    q.options.forEach((opt, idx) => {
      const btn = document.createElement('button');
      btn.className = 'quiz-choice-btn';
      btn.innerHTML = `<span class="quiz-choice-letter">${letters[idx]}</span> <span>${opt.meaning}</span>`;
      btn.addEventListener('click', () => handleQuizAnswer(opt, q.target, btn));
      optionsGrid.appendChild(btn);
    });

    speakText(q.target.word);
  }

  function handleQuizAnswer(selected, target, btn) {
    const buttons = document.querySelectorAll('.quiz-choice-btn');
    buttons.forEach(b => b.disabled = true);

    if (selected.id === target.id) {
      btn.classList.add('correct');
      state.quizScore++;
      state.quizStreak++;
      state.learnedWords.add(target.id);
      saveStoredData();
      playChime(true);
    } else {
      btn.classList.add('wrong');
      state.quizStreak = 0;
      state.starredWords.add(target.id);
      saveStoredData();
      playChime(false);
      buttons.forEach(b => {
        if (b.textContent.includes(target.meaning)) b.classList.add('correct');
      });
    }
    updateGlobalStats();

    setTimeout(() => {
      state.quizIndex++;
      renderQuizQuestion();
    }, 1100);
  }

  function renderQuizResults() {
    const qBox = document.getElementById('quizPromptBox');
    const optionsGrid = document.getElementById('quizOptionsGrid');
    const percent = Math.round((state.quizScore / state.quizQuestions.length) * 100);
    if (percent >= 70) triggerConfetti();

    qBox.innerHTML = `
      <div style="font-size: 2rem; margin-bottom: 0.5rem; color: var(--brand-primary);">${icon('award', 'results-icon-svg')}</div>
      <h2 style="font-size: 1.6rem; font-weight: 800; color: var(--text-primary);">Kết Quả Bài Kiểm Tra</h2>
      <p style="font-size: 1rem; color: var(--text-secondary); margin-top: 0.4rem;">
        Bạn đã trả lời đúng <strong>${state.quizScore} / ${state.quizQuestions.length}</strong> câu (${percent}%)
      </p>
    `;

    optionsGrid.innerHTML = `
      <button class="btn-brand-primary" id="btnRestartQuiz" style="grid-column: 1 / -1; justify-content: center; padding: 0.85rem;">
        Làm lại bài trắc nghiệm
      </button>
    `;

    document.getElementById('btnRestartQuiz').addEventListener('click', initQuiz);
  }

  // ==========================================================================
  // MODE 3: LISTENING
  // ==========================================================================
  function initListening() {
    state.quizIndex = 0;
    state.quizScore = 0;
    state.quizTotal = Math.min(10, state.currentTopic.words.length);
    const shuffled = shuffle(state.currentTopic.words);
    state.quizQuestions = shuffled.slice(0, state.quizTotal).map(w => {
      const others = state.currentTopic.words.filter(item => item.id !== w.id);
      const wrong = shuffle(others).slice(0, 3);
      const options = shuffle([w, ...wrong]);
      return { target: w, options: options };
    });
    renderListeningQuestion();
  }

  function renderListeningQuestion() {
    const audioWrap = document.getElementById('listeningAudioPrompt');
    const optionsGrid = document.getElementById('listeningOptionsGrid');
    if (!audioWrap || !optionsGrid) return;

    if (state.quizIndex >= state.quizQuestions.length) {
      audioWrap.innerHTML = `
        <div style="margin-bottom: 0.5rem; color: var(--brand-primary);">${icon('volume')}</div>
        <h3 style="font-size: 1.35rem; font-weight: 800;">Hoàn thành bài luyện nghe!</h3>
        <p style="color: var(--text-secondary); margin-top: 0.25rem;">Bạn đạt ${state.quizScore}/${state.quizQuestions.length} câu đúng.</p>
      `;
      optionsGrid.innerHTML = `
        <button class="btn-brand-primary" id="btnRestartListening" style="grid-column: 1 / -1; justify-content: center; padding: 0.85rem;">
          Nghe lại từ đầu
        </button>
      `;
      document.getElementById('btnRestartListening').addEventListener('click', initListening);
      return;
    }

    const q = state.quizQuestions[state.quizIndex];
    document.getElementById('listeningProgressText').textContent = `Câu ${state.quizIndex + 1} / ${state.quizQuestions.length}`;

    audioWrap.innerHTML = `
      <button class="btn-brand-primary" id="btnPlayListeningAudio" style="padding: 0.85rem 1.6rem; border-radius: var(--radius-pill); font-size: 1rem;">
        ${icon('volume')} <span>Bấm để nghe phát âm</span>
      </button>
    `;
    document.getElementById('btnPlayListeningAudio').addEventListener('click', () => speakText(q.target.word));

    optionsGrid.innerHTML = '';
    const letters = ['A', 'B', 'C', 'D'];

    q.options.forEach((opt, idx) => {
      const btn = document.createElement('button');
      btn.className = 'quiz-choice-btn';
      btn.innerHTML = `<span class="quiz-choice-letter">${letters[idx]}</span> <div><strong>${opt.word}</strong> <span style="display:block; font-size: 0.8rem; color: var(--text-muted);">${opt.meaning}</span></div>`;
      btn.addEventListener('click', () => {
        const buttons = optionsGrid.querySelectorAll('.quiz-choice-btn');
        buttons.forEach(b => b.disabled = true);
        if (opt.id === q.target.id) {
          btn.classList.add('correct');
          state.quizScore++;
          playChime(true);
        } else {
          btn.classList.add('wrong');
          playChime(false);
          buttons.forEach(b => {
            if (b.textContent.includes(q.target.word)) b.classList.add('correct');
          });
        }
        setTimeout(() => {
          state.quizIndex++;
          renderListeningQuestion();
        }, 1100);
      });
      optionsGrid.appendChild(btn);
    });

    speakText(q.target.word);
  }

  // ==========================================================================
  // MODE 4: DICTATION
  // ==========================================================================
  function initDictation() {
    state.dictationList = shuffle(state.currentTopic.words);
    state.dictationIndex = 0;
    renderDictationCard();
  }

  function renderDictationCard() {
    if (state.dictationIndex >= state.dictationList.length) {
      triggerConfetti();
      document.getElementById('dictationMeaningPrompt').innerHTML = `Chúc mừng bạn đã gõ chính xác toàn bộ danh sách!`;
      document.getElementById('dictationInputWrap').innerHTML = `
        <button class="btn-brand-primary" id="btnRestartDictation" style="padding: 0.85rem 1.5rem;">Luyện tập lại</button>
      `;
      document.getElementById('btnRestartDictation').addEventListener('click', initDictation);
      return;
    }

    const word = state.dictationList[state.dictationIndex];
    document.getElementById('dictationProgressText').textContent = `${state.dictationIndex + 1} / ${state.dictationList.length}`;
    document.getElementById('dictationMeaningPrompt').textContent = word.meaning;
    document.getElementById('dictationPhoneticPrompt').textContent = word.phonetic;

    const hintStr = word.word.split(' ').map(part => part[0] + '_'.repeat(part.length - 1)).join('   ');
    document.getElementById('dictationHintLetters').textContent = hintStr;

    const input = document.getElementById('dictationInput');
    input.value = '';
    input.focus();
    document.getElementById('dictationFeedback').textContent = '';

    speakText(word.word);
  }

  function checkDictation() {
    const input = document.getElementById('dictationInput');
    const userVal = input.value.trim().toLowerCase();
    const word = state.dictationList[state.dictationIndex];
    const targetVal = word.word.trim().toLowerCase();

    const fb = document.getElementById('dictationFeedback');

    if (userVal === targetVal) {
      fb.innerHTML = `<span style="color: var(--accent-emerald); font-weight: 700;">Chính xác!</span>`;
      state.learnedWords.add(word.id);
      saveStoredData();
      updateGlobalStats();
      playChime(true);

      setTimeout(() => {
        state.dictationIndex++;
        renderDictationCard();
      }, 900);
    } else {
      fb.innerHTML = `<span style="color: var(--accent-rose); font-weight: 700;">Chưa đúng. Đáp án: <strong>${word.word}</strong></span>`;
      playChime(false);
      speakText(word.word);
    }
  }

  // ==========================================================================
  // MODE 5: MATCH GAME
  // ==========================================================================
  function initMatchGame() {
    if (state.matchInterval) clearInterval(state.matchInterval);
    state.matchMoves = 0;
    state.matchedCount = 0;
    state.matchTimer = 0;
    state.selectedMatchCard = null;

    document.getElementById('matchTimer').textContent = '00:00';
    document.getElementById('matchMoves').textContent = '0';

    const chosen = shuffle(state.currentTopic.words).slice(0, 8);
    const cards = [];
    chosen.forEach(w => {
      cards.push({ id: w.id, text: w.word, type: 'en', pairId: w.id });
      cards.push({ id: w.id, text: w.meaning, type: 'vi', pairId: w.id });
    });

    state.matchCards = shuffle(cards);
    renderMatchGrid();

    state.matchInterval = setInterval(() => {
      state.matchTimer++;
      const m = Math.floor(state.matchTimer / 60).toString().padStart(2, '0');
      const s = (state.matchTimer % 60).toString().padStart(2, '0');
      document.getElementById('matchTimer').textContent = `${m}:${s}`;
    }, 1000);
  }

  function renderMatchGrid() {
    const grid = document.getElementById('matchGrid');
    if (!grid) return;
    grid.innerHTML = '';

    state.matchCards.forEach((c, idx) => {
      const cardEl = document.createElement('div');
      cardEl.className = `match-tile-card ${c.isMatched ? 'matched' : ''}`;
      cardEl.textContent = c.text;
      cardEl.dataset.index = idx;

      cardEl.addEventListener('click', () => handleMatchClick(c, cardEl));
      grid.appendChild(cardEl);
    });
  }

  function handleMatchClick(card, cardEl) {
    if (card.isMatched || cardEl.classList.contains('selected')) return;

    if (!state.selectedMatchCard) {
      state.selectedMatchCard = { card, el: cardEl };
      cardEl.classList.add('selected');
      if (card.type === 'en') speakText(card.text);
    } else {
      state.matchMoves++;
      document.getElementById('matchMoves').textContent = state.matchMoves;

      const first = state.selectedMatchCard;
      cardEl.classList.add('selected');

      if (first.card.pairId === card.pairId && first.card.type !== card.type) {
        first.card.isMatched = true;
        card.isMatched = true;
        first.el.classList.remove('selected');
        first.el.classList.add('matched');
        cardEl.classList.remove('selected');
        cardEl.classList.add('matched');
        state.matchedCount++;
        playChime(true);
        state.selectedMatchCard = null;

        if (state.matchedCount === 8) {
          clearInterval(state.matchInterval);
          triggerConfetti();
          setTimeout(() => {
            alert(`Chúc mừng! Bạn hoàn thành trò chơi nối từ trong ${state.matchTimer} giây với ${state.matchMoves} lượt chọn!`);
          }, 300);
        }
      } else {
        playChime(false);
        setTimeout(() => {
          first.el.classList.remove('selected');
          cardEl.classList.remove('selected');
          state.selectedMatchCard = null;
        }, 500);
      }
    }
  }

  // ==========================================================================
  // MODE 6: WORD EXPLORER (TABLE)
  // ==========================================================================
  function renderWordExplorer() {
    const container = document.getElementById('wordListTableBody');
    if (!container) return;
    container.innerHTML = '';

    state.currentTopic.words.forEach((w, idx) => {
      const isLearned = state.learnedWords.has(w.id);
      const isStarred = state.starredWords.has(w.id);
      const starSvg = icon(isStarred ? 'star-filled' : 'star');

      const row = document.createElement('div');
      row.className = 'word-table-row';
      row.innerHTML = `
        <div style="font-family: var(--font-mono); font-size: 0.85rem; color: var(--text-muted);">${(idx + 1).toString().padStart(2, '0')}</div>
        <div style="font-weight: 700; color: var(--text-primary); display: flex; align-items: center; gap: 0.5rem;">
          <span>${w.word}</span>
          <button class="icon-btn-clean btn-table-speak" style="width: 28px; height: 28px;" title="Nghe phát âm">${icon('volume')}</button>
        </div>
        <div class="col-phonetic" style="font-family: var(--font-mono); font-size: 0.9rem; color: var(--brand-primary);">${w.phonetic}</div>
        <div style="font-size: 0.95rem; color: var(--text-secondary);">${w.meaning}</div>
        <div style="display: flex; justify-content: flex-end; gap: 0.5rem; align-items: center;">
          <button class="card-star-btn btn-table-star ${isStarred ? 'starred' : ''}" title="Đánh dấu từ khó">${starSvg}</button>
          <input type="checkbox" class="learned-checkbox" style="width: 18px; height: 18px; accent-color: var(--brand-primary); cursor: pointer;" ${isLearned ? 'checked' : ''} title="Đánh dấu đã thuộc" />
        </div>
      `;

      row.querySelector('.btn-table-speak').addEventListener('click', () => speakText(w.word));
      row.querySelector('.btn-table-star').addEventListener('click', (e) => {
        if (state.starredWords.has(w.id)) {
          state.starredWords.delete(w.id);
        } else {
          state.starredWords.add(w.id);
        }
        saveStoredData();
        updateGlobalStats();
        renderWordExplorer();
      });

      row.querySelector('.learned-checkbox').addEventListener('change', (e) => {
        if (e.target.checked) {
          state.learnedWords.add(w.id);
        } else {
          state.learnedWords.delete(w.id);
        }
        saveStoredData();
        updateGlobalStats();
      });

      container.appendChild(row);
    });
  }

  // ==========================================================================
  // STARRED / NOTEBOOK MODAL
  // ==========================================================================
  function openStarredModal() {
    const modal = document.getElementById('starredModal');
    const body = document.getElementById('starredModalBody');
    if (!modal || !body) return;

    const list = getStarredWordsList();
    if (list.length === 0) {
      body.innerHTML = `
        <div style="text-align: center; padding: 3rem 1rem; color: var(--text-muted);">
          <div style="margin-bottom: 0.65rem; color: var(--accent-amber);">${icon('star', 'empty-star-svg')}</div>
          <h3 style="font-size: 1.2rem; font-weight: 800; color: var(--text-primary);">Sổ tay từ khó hiện đang trống</h3>
          <p style="margin-top: 0.4rem; font-size: 0.9rem;">Khi học từ vựng, bạn có thể bấm vào biểu tượng ngôi sao để lưu các từ cần ôn luyện vào đây.</p>
        </div>
      `;
    } else {
      body.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
          <p style="font-weight: 700; color: var(--text-primary);">Tổng số từ đã lưu: ${list.length}</p>
          <button class="btn-brand-primary" id="btnStudyStarred" style="padding: 0.5rem 1rem; font-size: 0.85rem;">
            Học thẻ từ khó ngay
          </button>
        </div>
        <div class="word-table-wrapper">
          <div class="word-table-row header">
            <div>#</div>
            <div>Từ vựng</div>
            <div class="col-phonetic">Phát âm</div>
            <div>Nghĩa tiếng Việt</div>
            <div style="text-align: right;">Bỏ lưu</div>
          </div>
          <div id="starredTableBody"></div>
        </div>
      `;

      const starredTbody = document.getElementById('starredTableBody');
      list.forEach((w, idx) => {
        const row = document.createElement('div');
        row.className = 'word-table-row';
        row.innerHTML = `
          <div style="font-family: var(--font-mono); font-size: 0.85rem; color: var(--text-muted);">${(idx + 1).toString().padStart(2, '0')}</div>
          <div style="font-weight: 700; color: var(--text-primary); display: flex; align-items: center; gap: 0.4rem;">
            <span>${w.word}</span>
            <button class="icon-btn-clean btn-starred-speak" style="width: 26px; height: 26px;" title="Nghe phát âm">${icon('volume')}</button>
          </div>
          <div class="col-phonetic" style="font-family: var(--font-mono); font-size: 0.88rem; color: var(--brand-primary);">${w.phonetic}</div>
          <div style="font-size: 0.9rem; color: var(--text-secondary);"><strong>[${w.topicName}]</strong> ${w.meaning}</div>
          <div style="text-align: right;">
            <button class="icon-btn-clean btn-remove-star" style="width: 28px; height: 28px; color: var(--accent-rose);" title="Bỏ lưu">${icon('x')}</button>
          </div>
        `;
        row.querySelector('.btn-starred-speak').addEventListener('click', () => speakText(w.word));
        row.querySelector('.btn-remove-star').addEventListener('click', () => {
          state.starredWords.delete(w.id);
          saveStoredData();
          updateGlobalStats();
          openStarredModal();
        });
        starredTbody.appendChild(row);
      });

      document.getElementById('btnStudyStarred').addEventListener('click', () => {
        closeStarredModal();
        const customTopic = {
          id: 999,
          title: 'Sổ Tay Từ Khó',
          category: 'Cá nhân hóa',
          iconName: 'star',
          words: list
        };
        openTopicWorkspace(customTopic, 'flashcards');
      });
    }

    modal.style.display = 'flex';
  }

  function closeStarredModal() {
    const modal = document.getElementById('starredModal');
    if (modal) modal.style.display = 'none';
  }

  // ==========================================================================
  // BACKUP & SYNC
  // ==========================================================================
  function openBackupModal() {
    const modal = document.getElementById('backupModal');
    if (modal) modal.style.display = 'flex';
  }

  function closeBackupModal() {
    const modal = document.getElementById('backupModal');
    if (modal) modal.style.display = 'none';
  }

  function exportBackupData() {
    return {
      version: 1,
      exportDate: new Date().toISOString(),
      learnedWords: Array.from(state.learnedWords),
      starredWords: Array.from(state.starredWords),
      streak: state.streak
    };
  }

  function downloadBackupJson() {
    const data = exportBackupData();
    const jsonStr = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `vocab_backup_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function copyBackupCode() {
    const data = exportBackupData();
    const str = btoa(unescape(encodeURIComponent(JSON.stringify(data))));
    navigator.clipboard.writeText(str).then(() => {
      alert('Đã sao chép mã sao lưu vào bộ nhớ tạm! Bạn hãy gửi mã này sang thiết bị mới để dán vào nhé.');
    }).catch(() => {
      const input = document.getElementById('backupCodeInput');
      if (input) input.value = str;
      alert('Hãy sao chép đoạn mã trong ô bên dưới nhé!');
    });
  }

  function applyRestoreData(dataObj) {
    if (!dataObj || !dataObj.learnedWords) {
      alert('Định dạng dữ liệu không hợp lệ!');
      return false;
    }
    dataObj.learnedWords.forEach(id => state.learnedWords.add(id));
    if (dataObj.starredWords) {
      dataObj.starredWords.forEach(id => state.starredWords.add(id));
    }
    if (dataObj.streak && dataObj.streak > state.streak) {
      state.streak = dataObj.streak;
    }
    saveStoredData();
    updateGlobalStats();
    renderTopics();
    triggerConfetti();
    alert(`Đồng bộ thành công! Hiện bạn đã có ${state.learnedWords.size} từ đã thuộc và ${state.starredWords.size} từ trong sổ tay!`);
    closeBackupModal();
    return true;
  }

  function restoreFromCode() {
    const input = document.getElementById('backupCodeInput');
    const val = (input ? input.value : '').trim();
    if (!val) {
      alert('Vui lòng dán mã sao lưu hoặc chọn file .json!');
      return;
    }
    try {
      let parsed = null;
      if (val.startsWith('{')) {
        parsed = JSON.parse(val);
      } else {
        const decoded = decodeURIComponent(escape(atob(val)));
        parsed = JSON.parse(decoded);
      }
      applyRestoreData(parsed);
    } catch (e) {
      alert('Mã sao lưu không đúng định dạng!');
    }
  }

  function resetAllProgress() {
    if (confirm('Bạn có chắc chắn muốn xóa toàn bộ tiến trình học trên máy này để bắt đầu lại từ đầu không?')) {
      state.learnedWords.clear();
      state.starredWords.clear();
      state.streak = 1;
      saveStoredData();
      updateGlobalStats();
      renderTopics();
      alert('Đã đặt lại tiến độ học tập về 0!');
      closeBackupModal();
    }
  }

  // ==========================================================================
  // CONFETTI
  // ==========================================================================
  function triggerConfetti() {
    const canvas = document.getElementById('confettiCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const pieces = [];
    const colors = ['#0064d2', '#10b981', '#f59e0b', '#7c3aed', '#ec4899', '#06b6d4'];
    for (let i = 0; i < 100; i++) {
      pieces.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height - canvas.height,
        w: Math.random() * 8 + 5,
        h: Math.random() * 8 + 5,
        color: colors[Math.floor(Math.random() * colors.length)],
        vx: (Math.random() - 0.5) * 3,
        vy: Math.random() * 4 + 3,
        rot: Math.random() * 360,
        rotSpeed: (Math.random() - 0.5) * 6
      });
    }

    let anim;
    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      let alive = false;
      pieces.forEach(p => {
        p.x += p.vx;
        p.y += p.vy;
        p.rot += p.rotSpeed;
        if (p.y < canvas.height) alive = true;

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate((p.rot * Math.PI) / 180);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      });

      if (alive) {
        anim = requestAnimationFrame(render);
      } else {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        cancelAnimationFrame(anim);
      }
    };
    render();
  }

  // ==========================================================================
  // SETUP EVENT LISTENERS
  // ==========================================================================
  function setupEventListeners() {
    // Theme toggle
    const themeBtn = document.getElementById('themeToggleBtn');
    if (themeBtn) {
      themeBtn.addEventListener('click', () => {
        const current = document.documentElement.getAttribute('data-theme') || 'light';
        const next = current === 'light' ? 'dark' : 'light';
        document.documentElement.setAttribute('data-theme', next);
        localStorage.setItem('vm_theme', next);
        const iconThemeEl = document.getElementById('iconThemeToggle');
        if (iconThemeEl) iconThemeEl.innerHTML = icon(next === 'dark' ? 'sun' : 'moon');
      });
    }

    // Voice popover
    const voiceBtn = document.getElementById('voiceSettingsBtn');
    const settingsMenu = document.getElementById('settingsMenu');
    if (voiceBtn && settingsMenu) {
      voiceBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        settingsMenu.classList.toggle('show');
      });
      document.addEventListener('click', (e) => {
        if (!settingsMenu.contains(e.target) && e.target !== voiceBtn) {
          settingsMenu.classList.remove('show');
        }
      });
    }

    const voiceSelect = document.getElementById('voiceSelect');
    if (voiceSelect) {
      voiceSelect.addEventListener('change', (e) => {
        state.selectedVoice = state.voices[e.target.value];
      });
    }

    const rateRange = document.getElementById('rateRange');
    const rateVal = document.getElementById('rateVal');
    if (rateRange) {
      rateRange.addEventListener('input', (e) => {
        state.voiceRate = parseFloat(e.target.value);
        if (rateVal) rateVal.textContent = `${state.voiceRate.toFixed(1)}x`;
        saveStoredData();
      });
    }

    // Search input
    const searchInput = document.getElementById('vocabSearchInput');
    const clearSearchBtn = document.getElementById('clearSearchBtn');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        state.searchQuery = e.target.value;
        if (clearSearchBtn) clearSearchBtn.style.display = state.searchQuery ? 'inline-flex' : 'none';
        renderTopics();
      });
    }
    if (clearSearchBtn) {
      clearSearchBtn.addEventListener('click', () => {
        searchInput.value = '';
        state.searchQuery = '';
        clearSearchBtn.style.display = 'none';
        renderTopics();
      });
    }

    // Brand logo click
    const brand = document.getElementById('brandSection');
    if (brand) {
      brand.addEventListener('click', () => {
        if (state.currentTopic) closeWorkspace();
      });
    }

    // Back to topics
    const backBtn = document.getElementById('btnBackToTopics');
    if (backBtn) backBtn.addEventListener('click', closeWorkspace);

    // Study mode tabs
    document.querySelectorAll('.mode-tab-btn').forEach(btn => {
      btn.addEventListener('click', () => switchStudyMode(btn.dataset.mode));
    });

    // Hero preview card interactions
    const previewCardBody = document.getElementById('previewCardBody');
    if (previewCardBody) {
      previewCardBody.addEventListener('click', () => {
        state.previewIsFlipped = !state.previewIsFlipped;
        renderHeroPreview();
      });
    }

    const btnPreviewSpeak = document.getElementById('btnPreviewSpeak');
    if (btnPreviewSpeak) {
      btnPreviewSpeak.addEventListener('click', () => {
        if (state.previewWord) speakText(state.previewWord.word);
      });
    }

    const btnPreviewNext = document.getElementById('btnPreviewNext');
    if (btnPreviewNext) {
      btnPreviewNext.addEventListener('click', () => {
        const all = getAllWords();
        state.previewWord = all[Math.floor(Math.random() * all.length)];
        state.previewIsFlipped = false;
        renderHeroPreview();
      });
    }

    // Flashcard interaction
    const cardContainer = document.getElementById('flashcardElement');
    if (cardContainer) {
      cardContainer.addEventListener('click', (e) => {
        if (e.target.closest('.card-star-btn') || e.target.closest('.audio-speaker-button')) return;
        toggleFlipCard();
      });
    }

    const starBtnFront = document.getElementById('cardStarBtnFront');
    const starBtnBack = document.getElementById('cardStarBtnBack');
    if (starBtnFront) starBtnFront.addEventListener('click', toggleStarCurrentCard);
    if (starBtnBack) starBtnBack.addEventListener('click', toggleStarCurrentCard);

    const btnSpeakFront = document.getElementById('btnCardSpeakFront');
    const btnSpeakBack = document.getElementById('btnCardSpeakBack');
    if (btnSpeakFront) btnSpeakFront.addEventListener('click', () => {
      const w = state.cardList[state.cardIndex];
      if (w) speakText(w.word);
    });
    if (btnSpeakBack) btnSpeakBack.addEventListener('click', () => {
      const w = state.cardList[state.cardIndex];
      if (w) speakText(w.word);
    });

    const btnPrevCard = document.getElementById('btnPrevCard');
    const btnNextCard = document.getElementById('btnNextCard');
    if (btnPrevCard) btnPrevCard.addEventListener('click', prevCard);
    if (btnNextCard) btnNextCard.addEventListener('click', () => nextCard(false));

    const btnCardHard = document.getElementById('btnCardHard');
    const btnCardEasy = document.getElementById('btnCardEasy');
    if (btnCardHard) btnCardHard.addEventListener('click', () => {
      toggleStarCurrentCard();
      nextCard(false);
    });
    if (btnCardEasy) btnCardEasy.addEventListener('click', () => nextCard(true));

    // Global Keyboard Shortcuts
    window.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        const searchInput = document.getElementById('vocabSearchInput');
        if (searchInput) {
          searchInput.focus();
          searchInput.select();
        }
        return;
      }

      if (state.currentTopic && state.currentMode === 'flashcards') {
        if (e.code === 'Space') {
          e.preventDefault();
          toggleFlipCard();
        } else if (e.code === 'ArrowRight') {
          nextCard(false);
        } else if (e.code === 'ArrowLeft') {
          prevCard();
        }
      }
    });

    // Dictation interactions
    const btnCheckDictation = document.getElementById('btnCheckDictation');
    const dictationInput = document.getElementById('dictationInput');
    if (btnCheckDictation) btnCheckDictation.addEventListener('click', checkDictation);
    if (dictationInput) {
      dictationInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') checkDictation();
      });
    }

    const btnDictationAudio = document.getElementById('btnDictationAudio');
    if (btnDictationAudio) {
      btnDictationAudio.addEventListener('click', () => {
        const w = state.dictationList[state.dictationIndex];
        if (w) speakText(w.word);
      });
    }

    // Match game restart
    const btnRestartMatch = document.getElementById('btnRestartMatch');
    if (btnRestartMatch) btnRestartMatch.addEventListener('click', initMatchGame);

    // Hero buttons
    const btnHeroStart = document.getElementById('btnHeroStart');
    if (btnHeroStart) {
      btnHeroStart.addEventListener('click', () => {
        if (state.topics.length > 0) openTopicWorkspace(state.topics[0], 'flashcards');
      });
    }

    const btnHeroStarred = document.getElementById('btnHeroStarred');
    if (btnHeroStarred) btnHeroStarred.addEventListener('click', openStarredModal);

    const statStarredChip = document.getElementById('statStarredChip');
    if (statStarredChip) statStarredChip.addEventListener('click', openStarredModal);

    const btnCloseStarredModal = document.getElementById('btnCloseStarredModal');
    if (btnCloseStarredModal) btnCloseStarredModal.addEventListener('click', closeStarredModal);

    // Backup modal events
    const syncModalBtn = document.getElementById('syncModalBtn');
    if (syncModalBtn) syncModalBtn.addEventListener('click', openBackupModal);

    const btnCloseBackupModal = document.getElementById('btnCloseBackupModal');
    if (btnCloseBackupModal) btnCloseBackupModal.addEventListener('click', closeBackupModal);

    const btnExportJson = document.getElementById('btnExportJson');
    if (btnExportJson) btnExportJson.addEventListener('click', downloadBackupJson);

    const btnCopyBackupCode = document.getElementById('btnCopyBackupCode');
    if (btnCopyBackupCode) btnCopyBackupCode.addEventListener('click', copyBackupCode);

    const btnApplyBackupCode = document.getElementById('btnApplyBackupCode');
    if (btnApplyBackupCode) btnApplyBackupCode.addEventListener('click', restoreFromCode);

    const btnResetProgress = document.getElementById('btnResetProgress');
    if (btnResetProgress) btnResetProgress.addEventListener('click', resetAllProgress);

    const importFileInput = document.getElementById('importFileInput');
    if (importFileInput) {
      importFileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
          try {
            const dataObj = JSON.parse(event.target.result);
            applyRestoreData(dataObj);
          } catch (err) {
            alert('File JSON không hợp lệ!');
          }
        };
        reader.readAsText(file);
      });
    }
  }

  // Startup Initialization
  document.addEventListener('DOMContentLoaded', () => {
    loadStoredData();
    injectStaticIcons();
    initSpeech();
    initHeroPreview();
    updateGlobalStats();
    renderCategories();
    renderTopics();
    setupEventListeners();
  });

})();
