(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(root);
    return;
  }

  root.RhythmGameUI = factory(root);
})(typeof globalThis !== 'undefined' ? globalThis : window, function (root) {
  const KEY_BINDINGS = [
    { code: 'KeyE', label: 'E' },
    { code: 'KeyF', label: 'F' },
    { code: 'KeyJ', label: 'J' },
    { code: 'KeyI', label: 'I' },
  ];
  const DIFFICULTY_CONFIGS = {
    beginner: {
      keyCodes: ['KeyF', 'KeyJ'],
      laneIndexes: [1, 2],
      laneCount: 2,
      label: '初級',
    },
    advanced: {
      keyCodes: ['KeyE', 'KeyF', 'KeyJ', 'KeyI'],
      laneIndexes: [0, 1, 2, 3],
      laneCount: 4,
      label: '上級',
    },
  };
  const FALL_DURATION = 1.8;
  const HIT_WINDOW = 0.18;
  const FEEDBACK_DURATION = 180;
  const HIT_NOTE_RELEASE_DELAY = 180;
  const DIFFICULTY_ORDER = ['beginner', 'advanced'];

  function getLaneFeedbackClass(resultType) {
    if (resultType === 'hit') {
      return 'is-hit';
    }

    return 'is-miss';
  }

  function calculateNoteTargetTop(metrics) {
    const laneKeyCenterY = metrics.laneHeight - metrics.laneKeyBottom - metrics.laneKeyHeight / 2;
    return laneKeyCenterY - metrics.noteHeight / 2;
  }

  function getDifficultyConfig(difficulty) {
    return DIFFICULTY_CONFIGS[difficulty];
  }

  function canStartFromSpace(options) {
    return Boolean(options.selectedDifficulty) && options.running === false;
  }

  function getLayoutReferenceLaneIndex(activeLaneIndexes) {
    return activeLaneIndexes[0];
  }

  function getNoteAppearanceClass(note) {
    if (note.wasSuccessful) {
      return 'is-hit-note';
    }

    if (note.shouldPress) {
      return 'is-target';
    }

    return '';
  }

  function getLaneKeyAssetPath(binding) {
    return './data/system/rhythm_game_assets/a_' + binding.label + '.svg';
  }

  function hideTyranoMessageLayers(targetRoot) {
    const tyranoLayer =
      targetRoot &&
      ((targetRoot.TYRANO &&
        targetRoot.TYRANO.kag &&
        targetRoot.TYRANO.kag.layer) ||
        (targetRoot.tyrano &&
          targetRoot.tyrano.kag &&
          targetRoot.tyrano.kag.layer));

    if (
      tyranoLayer &&
      typeof tyranoLayer.hideMessageLayers === 'function'
    ) {
      tyranoLayer.hideMessageLayers();
    }

    if (
      targetRoot &&
      targetRoot.document &&
      typeof targetRoot.document.querySelectorAll === 'function'
    ) {
      targetRoot.document
        .querySelectorAll(
          '#tyrano_base .message_outer, ' +
            '#tyrano_base .message_inner, ' +
            '#tyrano_base [class*="message"][class*="_fore"], ' +
            '#tyrano_base [class*="message"][class*="_back"]',
        )
        .forEach(function (node) {
          node.hidden = true;
          if (node.style) {
            node.style.display = 'none';
            node.style.visibility = 'hidden';
          }
        });
    }
  }

  function getDifficultyLabel(difficulty) {
    const difficultyConfig = getDifficultyConfig(difficulty);
    return difficultyConfig ? difficultyConfig.label : '';
  }

  function getAdjacentDifficulty(currentDifficulty, direction) {
    const offset = direction >= 0 ? 1 : -1;
    const currentIndex = DIFFICULTY_ORDER.indexOf(currentDifficulty);

    if (currentIndex === -1) {
      return offset > 0 ? DIFFICULTY_ORDER[0] : DIFFICULTY_ORDER[DIFFICULTY_ORDER.length - 1];
    }

    return DIFFICULTY_ORDER[(currentIndex + offset + DIFFICULTY_ORDER.length) % DIFFICULTY_ORDER.length];
  }

  function createResultOverlayContent(options) {
    return [
      options.payload.resultLabel,
      '難易度 ' + options.difficultyLabel,
      'SCORE ' + options.payload.score,
    ].join(' / ');
  }

  function createGameShellMarkup() {
    const laneMarkup = KEY_BINDINGS.map(function (binding, index) {
      return [
        '<div class="rhythm-game__lane" data-lane="', index, '">',
        '  <div class="rhythm-game__lane-key">',
        '    <img class="rhythm-game__lane-key-image" src="', getLaneKeyAssetPath(binding), '" alt="a hat (', binding.label, ')" />',
        '  </div>',
        '</div>',
      ].join('');
    }).join('');

    return [
      '<section class="rhythm-game" data-state="idle">',
      '  <div class="rhythm-game__overlay rhythm-game__overlay--start" data-role="start-overlay" data-state="ready">',
      '    <p class="rhythm-game__title">アイの生成演算子</p>',
      '    <p class="rhythm-game__warning">音が出ます</p>',
      '    <p class="rhythm-game__warning-copy">音楽に空いた「アイ」の穴を、生成演算子で埋めてください。スピーカーやイヤホンの音量に注意してください。</p>',
      '    <div class="rhythm-game__difficulty-buttons">',
      '      <button type="button" class="rhythm-game__difficulty" data-difficulty="beginner">初級(F/J)</button>',
      '      <button type="button" class="rhythm-game__difficulty" data-difficulty="advanced">上級(E/F/J/I)</button>',
      '    </div>',
      '    <p class="rhythm-game__start-hint">難易度を選び、スペースキーで開始</p>',
      '  </div>',
      '  <div class="rhythm-game__overlay rhythm-game__overlay--result" data-role="result-overlay" hidden>',
      '    <p class="rhythm-game__result-title" data-role="result-title">RESULT</p>',
      '    <p class="rhythm-game__result-copy" data-role="result-copy"></p>',
      '    <p class="rhythm-game__result-hint">Returnキーで開始画面へ</p>',
      '  </div>',
      '  <div class="rhythm-game__overlay rhythm-game__overlay--pause" data-role="pause-overlay" hidden>',
      '    <p class="rhythm-game__result-title">PAUSED</p>',
      '    <p class="rhythm-game__result-copy">演算を停止しています。</p>',
      '    <p class="rhythm-game__result-hint">スペースキーでもう一度再開</p>',
      '    <p class="rhythm-game__result-hint">Escキーで開始画面へ</p>',
      '  </div>',
      '  <div class="rhythm-game__hud">',
      '    <span class="rhythm-game__metric" data-role="score">SCORE 0</span>',
      '    <span class="rhythm-game__metric" data-role="combo">COMBO 0</span>',
      '    <span class="rhythm-game__metric" data-role="life">LIFE 10</span>',
      '  </div>',
      '  <div class="rhythm-game__song-title">スペースキーを押したら停止できる</div>',
      '  <div class="rhythm-game__lanes">', laneMarkup, '</div>',
      '</section>',
    ].join('');
  }

  function mountGameShell(rootElement) {
    rootElement.innerHTML = createGameShellMarkup();
    return rootElement.querySelector('.rhythm-game');
  }

  function createGameController(rootElement, options) {
    const settings = options || {};
    const core = settings.core || root.RhythmGameCore;
    const data = settings.data || root.RhythmGameData;
    const audioSrc = settings.audioSrc || './bgm/maou_short_14_shining_star_short.mp3';
    const shell = mountGameShell(rootElement);
    hideTyranoMessageLayers(root);
    const startOverlay = shell.querySelector('[data-role="start-overlay"]');
    const resultOverlay = shell.querySelector('[data-role="result-overlay"]');
    const pauseOverlay = shell.querySelector('[data-role="pause-overlay"]');
    const resultTitleNode = shell.querySelector('[data-role="result-title"]');
    const resultCopyNode = shell.querySelector('[data-role="result-copy"]');
    const difficultyButtons = Array.from(shell.querySelectorAll('.rhythm-game__difficulty'));
    const startHintNode = shell.querySelector('.rhythm-game__start-hint');
    const scoreNode = shell.querySelector('[data-role="score"]');
    const comboNode = shell.querySelector('[data-role="combo"]');
    const lifeNode = shell.querySelector('[data-role="life"]');
    const laneNodes = Array.from(shell.querySelectorAll('.rhythm-game__lane'));
    const laneKeyNodes = laneNodes.map(function (laneNode) {
      return laneNode.querySelector('.rhythm-game__lane-key');
    });
    const audio = new Audio(audioSrc);
    let chart = [];
    let noteElements = new Map();
    let state = core.createInitialState({ life: 10 });
    let rafId = 0;
    let startedAt = 0;
    let elapsedBeforePause = 0;
    let running = false;
    let gamePhase = 'ready';
    let feedbackTimers = [];
    let noteReleaseTimers = [];
    let noteTargetTop = 0;
    let selectedDifficulty = '';
    let activeLaneIndexes = [0, 1, 2, 3];

    function renderHud() {
      scoreNode.textContent = 'SCORE ' + state.score;
      comboNode.textContent = 'COMBO ' + state.combo;
      lifeNode.textContent = 'LIFE ' + state.life;
    }

    function clearNotes() {
      noteElements.forEach(function (element) {
        element.remove();
      });
      noteElements = new Map();
    }

    function clearNoteReleaseTimers() {
      noteReleaseTimers.forEach(function (timerId) {
        root.clearTimeout(timerId);
      });
      noteReleaseTimers = [];
    }

    function clearFeedbackTimers() {
      feedbackTimers.forEach(function (timerId) {
        root.clearTimeout(timerId);
      });
      feedbackTimers = [];
      laneKeyNodes.forEach(function (laneKeyNode) {
        laneKeyNode.classList.remove('is-hit', 'is-miss');
      });
    }

    function flashLaneFeedback(laneIndex, resultType) {
      const laneKeyNode = laneKeyNodes[laneIndex];
      const className = getLaneFeedbackClass(resultType);
      let timerId;

      if (!laneKeyNode) {
        return;
      }

      laneKeyNode.classList.remove('is-hit', 'is-miss');
      void laneKeyNode.offsetWidth;
      laneKeyNode.classList.add(className);

      timerId = root.setTimeout(function () {
        laneKeyNode.classList.remove(className);
        feedbackTimers = feedbackTimers.filter(function (activeTimerId) {
          return activeTimerId !== timerId;
        });
      }, FEEDBACK_DURATION);

      feedbackTimers.push(timerId);
    }

    function buildNoteElement(note) {
      const element = root.document.createElement('div');
      element.className = 'rhythm-game__note';
      const appearanceClass = getNoteAppearanceClass(note);
      element.dataset.noteId = String(note.id);
      element.textContent = note.char;
      if (appearanceClass) {
        element.classList.add(appearanceClass);
      }
      laneNodes[note.lane].appendChild(element);
      noteElements.set(note.id, element);
      return element;
    }

    function applyDifficulty(difficulty) {
      const difficultyConfig = getDifficultyConfig(difficulty);

      if (!difficultyConfig) {
        return;
      }

      selectedDifficulty = difficulty;
      activeLaneIndexes = difficultyConfig.laneIndexes.slice();
      shell.dataset.laneCount = String(difficultyConfig.laneCount);
      difficultyButtons.forEach(function (buttonNode) {
        buttonNode.dataset.selected = buttonNode.dataset.difficulty === difficulty ? 'true' : 'false';
      });
      laneNodes.forEach(function (laneNode, laneIndex) {
        laneNode.hidden = activeLaneIndexes.indexOf(laneIndex) === -1;
      });
      startHintNode.textContent = difficultyConfig.label + ' / スペースキーで開始';
    }

    function updateLayoutMetrics() {
      const layoutReferenceLaneIndex = getLayoutReferenceLaneIndex(activeLaneIndexes);
      const laneRect = laneNodes[layoutReferenceLaneIndex].getBoundingClientRect();
      const laneKeyRect = laneKeyNodes[layoutReferenceLaneIndex].getBoundingClientRect();
      const noteHeight = 72;
      const laneKeyBottom = laneRect.bottom - laneKeyRect.bottom;

      noteTargetTop = calculateNoteTargetTop({
        laneHeight: laneRect.height,
        laneKeyBottom: laneKeyBottom,
        laneKeyHeight: laneKeyRect.height,
        noteHeight: noteHeight,
      });
    }

    function getCurrentTime() {
      if (!running) {
        return elapsedBeforePause;
      }

      return elapsedBeforePause + (root.performance.now() - startedAt) / 1000;
    }

    function updateResult(message) {
      resultOverlay.hidden = false;
      resultTitleNode.textContent = 'RESULT';
      resultCopyNode.textContent = message;
    }

    function hideResultOverlay() {
      resultOverlay.hidden = true;
      resultTitleNode.textContent = 'RESULT';
      resultCopyNode.textContent = '';
    }

    function hidePauseOverlay() {
      pauseOverlay.hidden = true;
    }

    function showPauseOverlay() {
      startOverlay.hidden = true;
      hideResultOverlay();
      pauseOverlay.hidden = false;
    }

    function showStartOverlay(stateLabel) {
      startOverlay.hidden = false;
      startOverlay.dataset.state = stateLabel || 'ready';
      hideResultOverlay();
      hidePauseOverlay();
    }

    function showResultOverlay(options) {
      startOverlay.hidden = true;
      hidePauseOverlay();
      resultOverlay.hidden = false;
      resultTitleNode.textContent = options.payload.resultLabel;
      resultCopyNode.textContent = createResultOverlayContent({
        difficultyLabel: getDifficultyLabel(options.difficulty),
        payload: options.payload,
      });
    }

    function finishGame(didClear) {
      if (!running) {
        return;
      }

      running = false;
      gamePhase = 'result';
      root.cancelAnimationFrame(rafId);
      audio.pause();
      state = core.finalizeGame({
        score: state.score,
        life: didClear ? state.life : 0,
        combo: state.combo,
        maxCombo: state.maxCombo,
      });
      const payload = core.createResultPayload(state);
      shell.dataset.state = didClear ? 'cleared' : 'game-over';
      showResultOverlay({
        difficulty: selectedDifficulty,
        payload: payload,
      });
      if (typeof settings.onComplete === 'function') {
        settings.onComplete(payload, state);
      }
    }

    function applyState(nextState) {
      state = nextState;
      renderHud();
      if (state.isGameOver || state.life <= 0) {
        finishGame(false);
      }
    }

    function handleMissedNotes(currentTime) {
      chart.forEach(function (note) {
        if (note.hit || note.missed || currentTime <= note.time + HIT_WINDOW) {
          return;
        }

        note.missed = true;
        const element = noteElements.get(note.id);
        if (element) {
          element.remove();
          noteElements.delete(note.id);
        }

        if (note.shouldPress) {
          flashLaneFeedback(note.lane, 'miss');
          applyState(core.applyMiss(state));
        }
      });
    }

    function renderNotes(currentTime) {
      chart.forEach(function (note) {
        if (note.hit || note.missed) {
          return;
        }

        if (currentTime < note.time - FALL_DURATION) {
          return;
        }

        const progress = (currentTime - (note.time - FALL_DURATION)) / FALL_DURATION;
        const clamped = Math.max(0, Math.min(1.3, progress));
        const element = noteElements.get(note.id) || buildNoteElement(note);
        element.style.top = Math.round(clamped * noteTargetTop) + 'px';
      });
    }

    function frame() {
      const currentTime = getCurrentTime();
      renderNotes(currentTime);
      handleMissedNotes(currentTime);

      if (!running) {
        return;
      }

      if (audio.ended || currentTime >= chart[chart.length - 1].time + FALL_DURATION + HIT_WINDOW) {
        finishGame(state.life > 0);
        return;
      }

      rafId = root.requestAnimationFrame(frame);
    }

    function laneFromCode(code) {
      return KEY_BINDINGS.findIndex(function (binding, laneIndex) {
        return binding.code === code && activeLaneIndexes.indexOf(laneIndex) !== -1;
      });
    }

    function pauseGame() {
      if (!running) {
        return;
      }

      elapsedBeforePause = getCurrentTime();
      running = false;
      gamePhase = 'paused';
      shell.dataset.state = 'paused';
      root.cancelAnimationFrame(rafId);
      audio.pause();
      showPauseOverlay();
    }

    function resumeGame() {
      if (gamePhase !== 'paused') {
        return;
      }

      hidePauseOverlay();
      shell.dataset.state = 'playing';
      gamePhase = 'playing';
      running = true;
      startedAt = root.performance.now();
      audio.play().catch(function () {
        running = false;
        gamePhase = 'paused';
        showPauseOverlay();
      });
      rafId = root.requestAnimationFrame(frame);
    }

    function onKeyDown(event) {
      if (!resultOverlay.hidden && event.code === 'Enter') {
        event.preventDefault();
        shell.dataset.state = 'idle';
        gamePhase = 'ready';
        showStartOverlay('ready');
        return;
      }

      if (!pauseOverlay.hidden && event.code === 'Escape') {
        event.preventDefault();
        running = false;
        gamePhase = 'ready';
        elapsedBeforePause = 0;
        shell.dataset.state = 'idle';
        audio.pause();
        audio.currentTime = 0;
        clearNotes();
        clearFeedbackTimers();
        clearNoteReleaseTimers();
        state = core.createInitialState({ life: 10 });
        renderHud();
        showStartOverlay('ready');
        return;
      }

      if (!pauseOverlay.hidden && event.code === 'Space') {
        event.preventDefault();
        resumeGame();
        return;
      }

      if (!startOverlay.hidden && (event.code === 'ArrowLeft' || event.code === 'ArrowRight')) {
        event.preventDefault();
        applyDifficulty(getAdjacentDifficulty(selectedDifficulty, event.code === 'ArrowRight' ? 1 : -1));
        return;
      }

      if (gamePhase === 'ready' && event.code === 'Space') {
        if (canStartFromSpace({ selectedDifficulty: selectedDifficulty, running: running })) {
          event.preventDefault();
          startGame();
        }
        return;
      }

      if (gamePhase === 'playing' && event.code === 'Space') {
        event.preventDefault();
        pauseGame();
        return;
      }

      if (!running) {
        return;
      }

      const lane = laneFromCode(event.code);
      if (lane === -1) {
        return;
      }

      event.preventDefault();
      const currentTime = getCurrentTime();
      const note = core.findJudgableNote({
        chart: chart,
        lane: lane,
        currentTime: currentTime,
        hitWindow: HIT_WINDOW,
      });

      if (!note) {
        flashLaneFeedback(lane, 'miss');
        applyState(core.applyMiss(state));
        return;
      }

      const result = core.judgeNote({
        state: state,
        note: note,
        lane: lane,
        inputTime: currentTime,
        hitWindow: HIT_WINDOW,
      });
      note.hit = true;
      flashLaneFeedback(lane, result.outcome);
      if (result.outcome === 'hit') {
        const element = noteElements.get(note.id);
        note.wasSuccessful = true;
        if (element) {
          element.classList.remove('is-target');
          element.classList.add(getNoteAppearanceClass(note));
          noteReleaseTimers.push(
            root.setTimeout(function () {
              element.remove();
              noteElements.delete(note.id);
            }, HIT_NOTE_RELEASE_DELAY),
          );
        }
      } else {
        const element = noteElements.get(note.id);
        if (element) {
          element.remove();
          noteElements.delete(note.id);
        }
      }
      applyState(result.state);
    }

    function startGame() {
      if (!selectedDifficulty) {
        return;
      }

      chart = data.createGameChart({
        allowedLanes: activeLaneIndexes,
      });
      clearNotes();
      clearFeedbackTimers();
      clearNoteReleaseTimers();
      state = core.createInitialState({ life: 10 });
      elapsedBeforePause = 0;
      updateLayoutMetrics();
      renderHud();
      hideResultOverlay();
      hidePauseOverlay();
      startOverlay.hidden = true;
      shell.dataset.state = 'playing';
      gamePhase = 'playing';
      running = true;
      startedAt = root.performance.now();
      audio.currentTime = 0;
      audio.play().catch(function () {
        running = false;
        gamePhase = 'ready';
        showStartOverlay('blocked');
        startHintNode.textContent = '再生できませんでした。ブラウザの設定を確認してください。';
      });
      rafId = root.requestAnimationFrame(frame);
    }

    difficultyButtons.forEach(function (buttonNode) {
      buttonNode.addEventListener('click', function () {
        applyDifficulty(buttonNode.dataset.difficulty);
      });
    });
    root.addEventListener('keydown', onKeyDown);
    shell.dataset.laneCount = '4';
    renderHud();

    return {
      shell: shell,
      start: startGame,
      destroy: function () {
        running = false;
        root.cancelAnimationFrame(rafId);
        audio.pause();
        clearFeedbackTimers();
        clearNoteReleaseTimers();
        root.removeEventListener('keydown', onKeyDown);
        clearNotes();
        rootElement.innerHTML = '';
      },
    };
  }

  function autoMount() {
    if (!root.document || !root.document.body) {
      return;
    }

    const host = root.document.querySelector('[data-rhythm-game-root]');
    if (!host) {
      return;
    }

    if (host.dataset.rhythmMounted === 'true') {
      return;
    }

    host.dataset.rhythmMounted = 'true';
    createGameController(host);
  }

  if (root.document) {
    if (root.document.readyState === 'loading') {
      root.document.addEventListener('DOMContentLoaded', autoMount);
    } else {
      autoMount();
    }
  }

    return {
      createGameShellMarkup: createGameShellMarkup,
    mountGameShell: mountGameShell,
    createGameController: createGameController,
    autoMount: autoMount,
    createResultOverlayContent: createResultOverlayContent,
    getAdjacentDifficulty: getAdjacentDifficulty,
    getLaneFeedbackClass: getLaneFeedbackClass,
    hideTyranoMessageLayers: hideTyranoMessageLayers,
    calculateNoteTargetTop: calculateNoteTargetTop,
    getDifficultyConfig: getDifficultyConfig,
    canStartFromSpace: canStartFromSpace,
    getLayoutReferenceLaneIndex: getLayoutReferenceLaneIndex,
    getNoteAppearanceClass: getNoteAppearanceClass,
  };
});
