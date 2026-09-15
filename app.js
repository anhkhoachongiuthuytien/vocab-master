/**
 * VOCABMASTER - MODERN VOCABULARY LEARNING APPLICATION
 * Full Interactive Application Logic & State Management
 */

(function () {
  'use strict';

  // State
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

  // Audio Context for sound effects
  let audioCtx = null;
  function getAudioContext() {
    if (!audioCtx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) audioCtx = new AudioContext();
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
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
        osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
        osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15); // A5
        gain.gain.setValueAtTime(0.15, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.35);
      } else {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(250, ctx.currentTime);
        osc.frequency.linearRampToValueAtTime(180, ctx.currentTime + 0.2);
        gain.gain.setValueAtTime(0.15, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.25);
      }
    } catch (e) {
      console.warn('Audio effect error:', e);
    }
  }

  // Web Speech API
  function initSpeech() {
    if ('speechSynthesis' in window) {
      const loadVoices = () => {
        const allVoices = window.speechSynthesis.getVoices();
        state.voices = allVoices.filter(v => v.lang.startsWith('en'));
        if (state.voices.length === 0) state.voices = allVoices;
        
        // Prefer US English or high quality voices
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

  // Persistence
  function loadStoredData() {
    try {
      const savedLearned = localStorage.getItem('vm_learned_words');
      if (savedLearned) state.learnedWords = new Set(JSON.parse(savedLearned));

      const savedStarred = localStorage.getItem('vm_starred_words');
      if (savedStarred) state.starredWords = new Set(JSON.parse(savedStarred));

      const savedRate = localStorage.getItem('vm_voice_rate');
      if (savedRate) state.voiceRate = parseFloat(savedRate);

      const savedTheme = localStorage.getItem('vm_theme') || 'dark';
      document.documentElement.setAttribute('data-theme', savedTheme);

      // Streak tracking
      const today = new Date().toISOString().split('T')[0];
      const lastDate = localStorage.getItem('vm_last_date');
      let streak = parseInt(localStorage.getItem('vm_streak') || '1', 10);
      if (lastDate) {
        const last = new Date(lastDate);
        const diffDays = Math.floor((new Date(today) - last) / (1000 * 60 * 60 * 24));
        if (diffDays === 1) {
          // consecutive day
        } else if (diffDays > 1) {
          streak = 1; // streak reset
        }
      }
      localStorage.setItem('vm_last_date', today);
      localStorage.setItem('vm_streak', streak.toString());
      state.streak = streak;
    } catch (e) {
      console.warn('Error loading storage:', e);
    }
  }

  function saveStoredData() {
    try {
      localStorage.setItem('vm_learned_words', JSON.stringify(Array.from(state.learnedWords)));
      localStorage.setItem('vm_starred_words', JSON.stringify(Array.from(state.starredWords)));
      localStorage.setItem('vm_voice_rate', state.voiceRate.toString());
    } catch (e) {
      console.warn('Error saving storage:', e);
    }
  }

  // Global Helpers
  function getAllWords() {
    const list = [];
    state.topics.forEach(t => {
      t.words.forEach(w => list.push(w));
    });
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

  // Update Stats UI
  function updateGlobalStats() {
    const totalWordsCount = 1046;
    const learnedCount = state.learnedWords.size;
    const learnedPercent = Math.round((learnedCount / totalWordsCount) * 100);

    const elLearned = document.getElementById('statLearnedPill');
    if (elLearned) elLearned.innerHTML = `<span class="icon">🎯</span> Đã thuộc: <strong>${learnedCount}</strong> <small>/${totalWordsCount} (${learnedPercent}%)</small>`;

    const elStarred = document.getElementById('statStarredPill');
    if (elStarred) elStarred.innerHTML = `<span class="icon">⭐</span> Sổ tay: <strong>${state.starredWords.size}</strong>`;

    const elStreak = document.getElementById('statStreakPill');
    if (elStreak) elStreak.innerHTML = `<span class="icon">🔥</span> Chuỗi: <strong>${state.streak}</strong> ngày`;

    const elHeroLearned = document.getElementById('heroLearnedCount');
    if (elHeroLearned) elHeroLearned.textContent = learnedCount;

    const elHeroProgress = document.getElementById('heroMasteryPercent');
    if (elHeroProgress) elHeroProgress.textContent = `${learnedPercent}%`;

    const elHeroStarred = document.getElementById('heroStarredCount');
    if (elHeroStarred) elHeroStarred.textContent = state.starredWords.size;
  }

  // ==========================================================================
  // DASHBOARD & TOPICS VIEW
  // ==========================================================================
  function renderCategories() {
    const container = document.getElementById('categoryScroll');
    if (!container) return;
    container.innerHTML = '';

    state.categories.forEach(cat => {
      const pill = document.createElement('button');
      pill.className = `cat-pill ${cat === state.currentCategory ? 'active' : ''}`;
      pill.textContent = cat;
      pill.addEventListener('click', () => {
        state.currentCategory = cat;
        renderCategories();
        renderTopics();
      });
      container.appendChild(pill);
    });
  }

  function renderTopics() {
    const grid = document.getElementById('topicsGrid');
    if (!grid) return;
    grid.innerHTML = '';

    const query = state.searchQuery.toLowerCase().trim();

    // Filter topics
    let filteredTopics = state.topics.filter(t => {
      // Category check
      if (state.currentCategory !== 'Tất cả' && t.category !== state.currentCategory) {
        return false;
      }
      // Search query check
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

    if (filteredTopics.length === 0) {
      grid.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 3rem 1rem; color: var(--text-muted);">
          <div style="font-size: 3rem; margin-bottom: 1rem;">🔍</div>
          <h3>Không tìm thấy chủ đề hoặc từ vựng phù hợp</h3>
          <p style="margin-top: 0.5rem;">Hãy thử tìm với từ khóa khác hoặc chuyển danh mục về "Tất cả".</p>
        </div>
      `;
      return;
    }

    filteredTopics.forEach(t => {
      const learnedInTopic = t.words.filter(w => state.learnedWords.has(w.id)).length;
      const percent = Math.round((learnedInTopic / t.words.length) * 100);

      const card = document.createElement('div');
      card.className = 'topic-card';
      card.innerHTML = `
        <div class="topic-card-top">
          <div class="topic-icon-wrap">${t.icon}</div>
          <span class="topic-id-badge">#${t.id.toString().padStart(2, '0')}</span>
        </div>
        <div class="topic-card-content">
          <span class="topic-card-category">${t.category}</span>
          <h3 class="topic-card-title">${t.title}</h3>
        </div>
        <div class="topic-card-footer">
          <div class="topic-progress-info">
            <span>${t.words.length} từ vựng</span>
            <span>${learnedInTopic}/${t.words.length} (${percent}%)</span>
          </div>
          <div class="progress-track">
            <div class="progress-fill" style="width: ${percent}%;"></div>
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

    // Update study header
    document.getElementById('studyTopicIcon').textContent = topic.icon || '📖';
    document.getElementById('studyTopicTitle').textContent = topic.title;
    document.getElementById('studyTopicCategory').textContent = `${topic.category} • ${topic.words.length} từ vựng`;

    // Highlight mode tab
    updateModeTabs();

    // Prepare mode contents
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
    document.querySelectorAll('.study-tab-btn').forEach(btn => {
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

    // Hide all mode containers
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
    const cardEl = document.getElementById('flashcardElement');
    if (!cardEl || state.cardList.length === 0) return;

    const word = state.cardList[state.cardIndex];
    state.isFlipped = false;
    cardEl.classList.remove('is-flipped');

    // Update index progress
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
    [starBtnFront, starBtnBack].forEach(btn => {
      if (btn) {
        btn.textContent = isStarred ? '⭐' : '☆';
        btn.classList.toggle('starred', isStarred);
      }
    });

    // Speak audio
    if (state.autoSpeak) {
      speakText(word.word);
    }
  }

  function toggleFlipCard() {
    const cardEl = document.getElementById('flashcardElement');
    if (!cardEl) return;
    state.isFlipped = !state.isFlipped;
    cardEl.classList.toggle('is-flipped', state.isFlipped);
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
      // Completed deck!
      triggerConfetti();
      alert(`🎉 Chúc mừng bạn đã hoàn thành thẻ học của chủ đề "${state.currentTopic.title}"!`);
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
    
    // Generate questions
    const shuffled = shuffle(state.currentTopic.words);
    state.quizQuestions = shuffled.slice(0, state.quizTotal).map(w => {
      // Pick 3 random wrong options from same topic or all words
      const others = state.currentTopic.words.filter(item => item.id !== w.id);
      const wrong = shuffle(others).slice(0, 3);
      const options = shuffle([w, ...wrong]);
      return {
        target: w,
        options: options
      };
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
    document.getElementById('quizStreakVal').textContent = `🔥 Chuỗi: ${state.quizStreak}`;

    document.getElementById('quizPromptWord').textContent = q.target.word;
    document.getElementById('quizPromptPhonetic').textContent = q.target.phonetic;

    optionsGrid.innerHTML = '';
    const letters = ['A', 'B', 'C', 'D'];

    q.options.forEach((opt, idx) => {
      const btn = document.createElement('button');
      btn.className = 'quiz-opt-btn';
      btn.innerHTML = `<span class="quiz-opt-letter">${letters[idx]}</span> <span>${opt.meaning}</span>`;
      btn.addEventListener('click', () => handleQuizAnswer(opt, q.target, btn));
      optionsGrid.appendChild(btn);
    });

    speakText(q.target.word);
  }

  function handleQuizAnswer(selected, target, btn) {
    const buttons = document.querySelectorAll('.quiz-opt-btn');
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
      state.starredWords.add(target.id); // Add to hard words!
      saveStoredData();
      playChime(false);
      // Highlight correct answer
      buttons.forEach(b => {
        if (b.textContent.includes(target.meaning)) {
          b.classList.add('correct');
        }
      });
    }
    updateGlobalStats();

    setTimeout(() => {
      state.quizIndex++;
      renderQuizQuestion();
    }, 1200);
  }

  function renderQuizResults() {
    const qBox = document.getElementById('quizPromptBox');
    const optionsGrid = document.getElementById('quizOptionsGrid');
    const percent = Math.round((state.quizScore / state.quizQuestions.length) * 100);
    
    if (percent >= 70) triggerConfetti();

    qBox.innerHTML = `
      <div style="font-size: 3.5rem; margin-bottom: 0.5rem;">${percent >= 80 ? '🏆' : (percent >= 50 ? '👏' : '💪')}</div>
      <h2 style="font-size: 1.8rem; font-weight: 800;">Kết Quả Bài Kiểm Tra</h2>
      <p style="font-size: 1.1rem; color: var(--text-secondary); margin-top: 0.4rem;">
        Bạn đã trả lời đúng <strong>${state.quizScore} / ${state.quizQuestions.length}</strong> câu (${percent}%)
      </p>
    `;

    optionsGrid.innerHTML = `
      <button class="quick-action-btn btn-primary-action" id="btnRestartQuiz" style="grid-column: 1 / -1; justify-content: center; padding: 1rem;">
        🔄 Làm lại bài trắc nghiệm
      </button>
    `;

    document.getElementById('btnRestartQuiz').addEventListener('click', initQuiz);
  }

  // ==========================================================================
  // MODE 3: LISTENING CHALLENGE
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
      // Results
      audioWrap.innerHTML = `
        <div style="font-size: 3rem;">🎧</div>
        <h3>Hoàn thành bài luyện nghe!</h3>
        <p style="color: var(--text-secondary);">Bạn đạt ${state.quizScore}/${state.quizQuestions.length} câu đúng.</p>
      `;
      optionsGrid.innerHTML = `
        <button class="quick-action-btn btn-primary-action" id="btnRestartListening" style="grid-column: 1 / -1; justify-content: center;">
          🎧 Nghe lại từ đầu
        </button>
      `;
      document.getElementById('btnRestartListening').addEventListener('click', initListening);
      return;
    }

    const q = state.quizQuestions[state.quizIndex];
    document.getElementById('listeningProgressText').textContent = `Câu ${state.quizIndex + 1} / ${state.quizQuestions.length}`;

    audioWrap.innerHTML = `
      <button class="audio-btn-large" id="btnPlayListeningAudio" style="width: 72px; height: 72px; font-size: 1.8rem;">
        🔊
      </button>
      <p style="font-size: 0.9rem; color: var(--text-muted); margin-top: 0.5rem;">Bấm để nghe lại phát âm</p>
    `;
    document.getElementById('btnPlayListeningAudio').addEventListener('click', () => speakText(q.target.word));

    optionsGrid.innerHTML = '';
    const letters = ['A', 'B', 'C', 'D'];

    q.options.forEach((opt, idx) => {
      const btn = document.createElement('button');
      btn.className = 'quiz-opt-btn';
      btn.innerHTML = `<span class="quiz-opt-letter">${letters[idx]}</span> <div><strong>${opt.word}</strong> <span style="display:block; font-size: 0.8rem; color: var(--text-muted);">${opt.meaning}</span></div>`;
      btn.addEventListener('click', () => {
        const buttons = optionsGrid.querySelectorAll('.quiz-opt-btn');
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
        }, 1200);
      });
      optionsGrid.appendChild(btn);
    });

    speakText(q.target.word);
  }

  // ==========================================================================
  // MODE 4: DICTATION & SPELLING
  // ==========================================================================
  function initDictation() {
    state.dictationList = shuffle(state.currentTopic.words);
    state.dictationIndex = 0;
    renderDictationCard();
  }

  function renderDictationCard() {
    if (state.dictationIndex >= state.dictationList.length) {
      triggerConfetti();
      document.getElementById('dictationMeaningPrompt').innerHTML = `🎉 Tuyệt vời! Bạn đã gõ chính xác toàn bộ danh sách!`;
      document.getElementById('dictationInputWrap').innerHTML = `
        <button class="quick-action-btn btn-primary-action" id="btnRestartDictation">Luyện tập lại</button>
      `;
      document.getElementById('btnRestartDictation').addEventListener('click', initDictation);
      return;
    }

    const word = state.dictationList[state.dictationIndex];
    document.getElementById('dictationProgressText').textContent = `${state.dictationIndex + 1} / ${state.dictationList.length}`;
    document.getElementById('dictationMeaningPrompt').textContent = word.meaning;
    document.getElementById('dictationPhoneticPrompt').textContent = word.phonetic;

    // Hint: first letter and length
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
      fb.innerHTML = `<span style="color: var(--success); font-weight: 700;">✓ Chính xác!</span>`;
      state.learnedWords.add(word.id);
      saveStoredData();
      updateGlobalStats();
      playChime(true);

      setTimeout(() => {
        state.dictationIndex++;
        renderDictationCard();
      }, 1000);
    } else {
      fb.innerHTML = `<span style="color: var(--danger); font-weight: 700;">✗ Chưa đúng, hãy thử lại! Đáp án: <strong>${word.word}</strong></span>`;
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

    // Pick 8 random words
    const chosen = shuffle(state.currentTopic.words).slice(0, 8);
    const cards = [];
    chosen.forEach(w => {
      cards.push({ id: w.id, text: w.word, type: 'en', pairId: w.id });
      cards.push({ id: w.id, text: w.meaning, type: 'vi', pairId: w.id });
    });

    state.matchCards = shuffle(cards);
    renderMatchGrid();

    // Start timer
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
      cardEl.className = `match-card ${c.isMatched ? 'matched' : ''}`;
      cardEl.textContent = c.text;
      cardEl.dataset.index = idx;

      cardEl.addEventListener('click', () => handleMatchClick(c, cardEl));
      grid.appendChild(cardEl);
    });
  }

  function handleMatchClick(card, cardEl) {
    if (card.isMatched || cardEl.classList.contains('selected')) return;

    if (!state.selectedMatchCard) {
      // First card chosen
      state.selectedMatchCard = { card, el: cardEl };
      cardEl.classList.add('selected');
      if (card.type === 'en') speakText(card.text);
    } else {
      // Second card chosen
      state.matchMoves++;
      document.getElementById('matchMoves').textContent = state.matchMoves;

      const first = state.selectedMatchCard;
      cardEl.classList.add('selected');

      // Check if match
      if (first.card.pairId === card.pairId && first.card.type !== card.type) {
        // Matched!
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
            alert(`🏆 Chúc mừng! Bạn hoàn thành trò chơi nối từ trong ${state.matchTimer} giây với ${state.matchMoves} lượt chọn!`);
          }, 300);
        }
      } else {
        // Not a match
        playChime(false);
        setTimeout(() => {
          first.el.classList.remove('selected');
          cardEl.classList.remove('selected');
          state.selectedMatchCard = null;
        }, 600);
      }
    }
  }

  // ==========================================================================
  // MODE 6: WORD EXPLORER (LIST)
  // ==========================================================================
  function renderWordExplorer() {
    const container = document.getElementById('wordListTableBody');
    if (!container) return;
    container.innerHTML = '';

    state.currentTopic.words.forEach((w, idx) => {
      const isLearned = state.learnedWords.has(w.id);
      const isStarred = state.starredWords.has(w.id);

      const row = document.createElement('div');
      row.className = 'word-list-row';
      row.innerHTML = `
        <div style="font-family: var(--font-mono); font-size: 0.85rem; color: var(--text-muted);">${(idx + 1).toString().padStart(2, '0')}</div>
        <div class="word-col-word">
          <span>${w.word}</span>
          <button class="mini-audio-btn" data-word="${w.word}">🔊</button>
        </div>
        <div class="word-col-phonetic">${w.phonetic}</div>
        <div class="word-col-meaning">${w.meaning}</div>
        <div class="word-col-actions">
          <button class="mini-star-btn ${isStarred ? 'starred' : ''}" data-id="${w.id}">${isStarred ? '⭐' : '☆'}</button>
          <input type="checkbox" class="learned-checkbox" data-id="${w.id}" ${isLearned ? 'checked' : ''} title="Đánh dấu đã thuộc" />
        </div>
      `;

      // Audio click
      row.querySelector('.mini-audio-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        speakText(w.word);
      });

      // Star click
      row.querySelector('.mini-star-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        if (state.starredWords.has(w.id)) {
          state.starredWords.delete(w.id);
          e.currentTarget.classList.remove('starred');
          e.currentTarget.textContent = '☆';
        } else {
          state.starredWords.add(w.id);
          e.currentTarget.classList.add('starred');
          e.currentTarget.textContent = '⭐';
        }
        saveStoredData();
        updateGlobalStats();
      });

      // Checkbox click
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
          <div style="font-size: 3rem; margin-bottom: 0.5rem;">⭐</div>
          <h3>Sổ tay từ khó hiện đang trống</h3>
          <p style="margin-top: 0.5rem;">Khi học từ vựng, bạn có thể bấm vào biểu tượng ngôi sao để lưu các từ cần ôn luyện vào đây!</p>
        </div>
      `;
    } else {
      body.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
          <p style="font-weight: 700; color: var(--text-primary);">Tổng số từ đã lưu: ${list.length}</p>
          <button class="btn-primary-action quick-action-btn" id="btnStudyStarred" style="padding: 0.5rem 1rem; font-size: 0.85rem;">
            🃏 Học thẻ từ khó ngay
          </button>
        </div>
        <div class="word-list-table-card">
          <div class="word-list-row word-list-header">
            <div>#</div>
            <div>Từ vựng</div>
            <div class="word-col-phonetic">Phát âm</div>
            <div>Nghĩa tiếng Việt</div>
            <div>Thao tác</div>
          </div>
          <div id="starredTableBody"></div>
        </div>
      `;

      const starredTbody = document.getElementById('starredTableBody');
      list.forEach((w, idx) => {
        const row = document.createElement('div');
        row.className = 'word-list-row';
        row.innerHTML = `
          <div style="font-family: var(--font-mono); font-size: 0.85rem; color: var(--text-muted);">${(idx + 1).toString().padStart(2, '0')}</div>
          <div class="word-col-word">
            <span>${w.word}</span>
            <button class="mini-audio-btn" data-word="${w.word}">🔊</button>
          </div>
          <div class="word-col-phonetic">${w.phonetic}</div>
          <div class="word-col-meaning"><strong>[${w.topicName}]</strong> ${w.meaning}</div>
          <div class="word-col-actions">
            <button class="mini-star-btn starred" data-id="${w.id}" title="Bỏ lưu khỏi sổ tay">❌</button>
          </div>
        `;
        row.querySelector('.mini-audio-btn').addEventListener('click', () => speakText(w.word));
        row.querySelector('.mini-star-btn').addEventListener('click', () => {
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
          icon: '⭐',
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
  // BACKUP & SYNC (CROSS-DEVICE PROGRESS)
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
      alert('📋 Đã sao chép mã sao lưu vào bộ nhớ tạm! Bạn hãy gửi mã này sang thiết bị mới để dán vào nhé.');
    }).catch(() => {
      const input = document.getElementById('backupCodeInput');
      if (input) input.value = str;
      alert('Hãy sao chép đoạn mã trong ô bên dưới nhé!');
    });
  }

  function applyRestoreData(dataObj) {
    if (!dataObj || !dataObj.learnedWords) {
      alert('❌ Định dạng dữ liệu không hợp lệ!');
      return false;
    }
    // Merge or replace
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
    alert(`🎉 Đồng bộ thành công! Hiện bạn đã có ${state.learnedWords.size} từ đã thuộc và ${state.starredWords.size} từ trong sổ tay!`);
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
      alert('❌ Mã sao lưu không đúng định dạng!');
    }
  }

  function resetAllProgress() {
    if (confirm('⚠️ Bạn có chắc chắn muốn xóa toàn bộ tiến trình học trên máy này để bắt đầu lại từ đầu không?')) {
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
  // CONFETTI CELEBRATION
  // ==========================================================================
  function triggerConfetti() {
    const canvas = document.getElementById('confettiCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const pieces = [];
    const colors = ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#06b6d4'];
    for (let i = 0; i < 120; i++) {
      pieces.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height - canvas.height,
        w: Math.random() * 8 + 6,
        h: Math.random() * 8 + 6,
        color: colors[Math.floor(Math.random() * colors.length)],
        vx: (Math.random() - 0.5) * 4,
        vy: Math.random() * 5 + 3,
        rot: Math.random() * 360,
        rotSpeed: (Math.random() - 0.5) * 8
      });
    }

    let animationFrame;
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
        animationFrame = requestAnimationFrame(render);
      } else {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        cancelAnimationFrame(animationFrame);
      }
    };
    render();
  }

  // ==========================================================================
  // EVENT LISTENERS & INITIALIZATION
  // ==========================================================================
  function setupEventListeners() {
    // Theme toggle
    const themeBtn = document.getElementById('themeToggleBtn');
    if (themeBtn) {
      themeBtn.addEventListener('click', () => {
        const current = document.documentElement.getAttribute('data-theme') || 'dark';
        const next = current === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', next);
        localStorage.setItem('vm_theme', next);
        themeBtn.textContent = next === 'dark' ? '🌙' : '☀️';
      });
    }

    // Voice Settings Popover
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
        if (clearSearchBtn) {
          clearSearchBtn.style.display = state.searchQuery ? 'block' : 'none';
        }
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

    // Header Home Logo
    const brand = document.getElementById('brandSection');
    if (brand) {
      brand.addEventListener('click', () => {
        if (state.currentTopic) closeWorkspace();
      });
    }

    // Back button in workspace
    const backBtn = document.getElementById('btnBackToTopics');
    if (backBtn) {
      backBtn.addEventListener('click', closeWorkspace);
    }

    // Study Mode Tabs
    document.querySelectorAll('.study-tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        switchStudyMode(btn.dataset.mode);
      });
    });

    // Flashcard interactions
    const cardEl = document.getElementById('flashcardElement');
    if (cardEl) {
      cardEl.addEventListener('click', (e) => {
        // don't flip if star button or audio button clicked
        if (e.target.closest('.card-star-btn') || e.target.closest('.audio-btn-large')) return;
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

    // Keyboard shortcuts
    window.addEventListener('keydown', (e) => {
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

    // Match restart
    const btnRestartMatch = document.getElementById('btnRestartMatch');
    if (btnRestartMatch) btnRestartMatch.addEventListener('click', initMatchGame);

    // Hero quick actions
    const btnHeroStart = document.getElementById('btnHeroStart');
    if (btnHeroStart) {
      btnHeroStart.addEventListener('click', () => {
        // Open first topic
        if (state.topics.length > 0) openTopicWorkspace(state.topics[0], 'flashcards');
      });
    }

    const btnHeroStarred = document.getElementById('btnHeroStarred');
    if (btnHeroStarred) btnHeroStarred.addEventListener('click', openStarredModal);

    const statStarredPill = document.getElementById('statStarredPill');
    if (statStarredPill) statStarredPill.addEventListener('click', openStarredModal);

    const btnCloseStarredModal = document.getElementById('btnCloseStarredModal');
    if (btnCloseStarredModal) btnCloseStarredModal.addEventListener('click', closeStarredModal);

    // Backup & Sync Modal Events
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
            alert('❌ File JSON không hợp lệ!');
          }
        };
        reader.readAsText(file);
      });
    }
  }

  // Startup
  document.addEventListener('DOMContentLoaded', () => {
    loadStoredData();
    initSpeech();
    updateGlobalStats();
    renderCategories();
    renderTopics();
    setupEventListeners();
  });

})();
