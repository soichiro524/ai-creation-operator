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
      buttonLabel: '初級(F/J)',
    },
    advanced: {
      keyCodes: ['KeyE', 'KeyF', 'KeyJ', 'KeyI'],
      laneIndexes: [0, 1, 2, 3],
      laneCount: 4,
      label: '上級',
      buttonLabel: '上級(E/F/J/I)',
    },
    hidden: {
      keyCodes: ['KeyE', 'KeyF', 'KeyJ', 'KeyI'],
      laneIndexes: [0, 1, 2, 3],
      laneCount: 4,
      label: '隠し',
      buttonLabel: '隠し(E/F/J/I)',
    },
  };
  const GAME_THEMES = {
    default: {
      title: 'アイの生成演算子',
      warningCopy: '音楽に空いた「アイ」の穴を、生成演算子で埋めてください。スピーカーやイヤホンの音量に注意してください。',
      assetPrefix: 'a_d_',
      hideTargets: false,
    },
    hidden: {
      title: 'アイの消滅演算子',
      warningCopy: '音楽に残る「アイ」を、消滅演算子で消してください。スピーカーやイヤホンの音量に注意してください。',
      assetPrefix: 'a_',
      hideTargets: true,
    },
  };
  const FALL_DURATION = 1.8;
  const HIT_WINDOW = 0.25;
  const FEEDBACK_DURATION = 180;
  const HIT_NOTE_RELEASE_DELAY = 180;
  const STAR_BURST_DURATION = 520;
  const DIFFICULTY_ORDER = ['beginner', 'advanced'];

  function getLaneFeedbackClass(resultType) {
    if (resultType === 'hit') {
      return 'is-hit';
    }

    return 'is-miss';
  }

  function getHitStarCount(combo) {
    return combo >= 5 ? 2 : 1;
  }

  function createHitStarDescriptors(combo, random) {
    const pickRandom = typeof random === 'function' ? random : Math.random;

    return Array.from({ length: getHitStarCount(combo) }, function () {
      const angle = (-140 + pickRandom() * 100) * Math.PI / 180;
      const distance = 52 + pickRandom() * 28;
      const scale = 0.9 + pickRandom() * 0.35;
      const rotation = -28 + pickRandom() * 56;

      return {
        x: Math.cos(angle) * distance,
        y: Math.sin(angle) * distance,
        scale: scale,
        rotation: rotation,
      };
    });
  }

  function getHitStarClassName(combo) {
    return combo >= 5 ? 'rhythm-game__burst-star is-rainbow' : 'rhythm-game__burst-star';
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

  function getAvailableDifficultyOrder(hiddenUnlocked) {
    return hiddenUnlocked ? ['beginner', 'advanced', 'hidden'] : DIFFICULTY_ORDER.slice();
  }

  function getPlaybackTime(options) {
    if (!options.running) {
      return options.elapsedBeforePause;
    }

    if (Number.isFinite(options.audioCurrentTime)) {
      return options.audioCurrentTime;
    }

    return options.elapsedBeforePause + (options.now - options.startedAt) / 1000;
  }

  function getLayoutReferenceLaneIndex(activeLaneIndexes) {
    return activeLaneIndexes[0];
  }

  function getNoteAppearanceClass(note, options) {
    const settings = options || {};
    if (note.wasSuccessful) {
      return 'is-hit-note';
    }

    if (note.shouldPress && !settings.hideTargets) {
      return 'is-target';
    }

    return '';
  }

  function getGameTheme(difficulty) {
    if (difficulty === 'hidden') {
      return GAME_THEMES.hidden;
    }

    return GAME_THEMES.default;
  }

  function getLaneKeyAssetPath(binding, theme) {
    const activeTheme = theme || GAME_THEMES.default;
    return './data/system/rhythm_game_assets/' + activeTheme.assetPrefix + binding.label + '.svg';
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
    const availableDifficulties = arguments[2] || DIFFICULTY_ORDER;
    const offset = direction >= 0 ? 1 : -1;
    const currentIndex = availableDifficulties.indexOf(currentDifficulty);

    if (currentIndex === -1) {
      return offset > 0 ? availableDifficulties[0] : availableDifficulties[availableDifficulties.length - 1];
    }

    return availableDifficulties[(currentIndex + offset + availableDifficulties.length) % availableDifficulties.length];
  }

  function createDifficultyButtonsMarkup(hiddenUnlocked) {
    return getAvailableDifficultyOrder(hiddenUnlocked)
      .map(function (difficulty) {
        const config = getDifficultyConfig(difficulty);
        return '<button type="button" class="rhythm-game__difficulty" data-difficulty="' +
          difficulty +
          '">' +
          config.buttonLabel +
          '</button>';
      })
      .join('');
  }

  function shouldUnlockHiddenStage(options) {
    return options.difficulty === 'advanced' && options.payload && options.payload.resultLabel === 'CLEAR';
  }

  function getResultUnlockMessage(hiddenUnlockedNow) {
    if (!hiddenUnlockedNow) {
      return '';
    }

    return '隠しステージ「アイの消滅演算子」が出現しました。';
  }

  function getDifficultyToFocus(options) {
    if (options.justUnlockedHiddenStage && options.hiddenUnlocked) {
      return 'hidden';
    }

    if (options.selectedDifficulty && getAvailableDifficultyOrder(options.hiddenUnlocked).indexOf(options.selectedDifficulty) !== -1) {
      return options.selectedDifficulty;
    }

    return getAvailableDifficultyOrder(options.hiddenUnlocked)[0];
  }

  function createResultOverlayContent(options) {
    return [
      options.payload.resultLabel,
      '難易度 ' + options.difficultyLabel,
      'SCORE ' + options.payload.score,
    ].join(' / ');
  }

  function createGameShellMarkup(options) {
    const settings = options || {};
    const theme = getGameTheme(settings.selectedDifficulty);
    const laneMarkup = KEY_BINDINGS.map(function (binding, index) {
      return [
        '<div class="rhythm-game__lane" data-lane="', index, '">',
        '  <div class="rhythm-game__lane-key">',
        '    <img class="rhythm-game__lane-key-image" src="', getLaneKeyAssetPath(binding, theme), '" alt="a hat (', binding.label, ')" />',
        '  </div>',
        '</div>',
      ].join('');
    }).join('');

    return [
      '<section class="rhythm-game" data-state="idle">',
      '  <div class="rhythm-game__overlay rhythm-game__overlay--start" data-role="start-overlay" data-state="ready">',
      '    <p class="rhythm-game__title" data-role="start-title">', theme.title, '</p>',
      '    <p class="rhythm-game__warning">音が出ます</p>',
      '    <p class="rhythm-game__warning-copy" data-role="start-copy">', theme.warningCopy, '</p>',
      '    <div class="rhythm-game__difficulty-buttons" data-role="difficulty-buttons">', createDifficultyButtonsMarkup(Boolean(settings.hiddenUnlocked)), '</div>',
      '    <p class="rhythm-game__start-hint">難易度を選び、スペースキーで開始</p>',
      '  </div>',
      '  <div class="rhythm-game__overlay rhythm-game__overlay--result" data-role="result-overlay" hidden>',
      '    <p class="rhythm-game__result-title" data-role="result-title">RESULT</p>',
      '    <p class="rhythm-game__result-copy" data-role="result-copy"></p>',
      '    <p class="rhythm-game__result-hint rhythm-game__result-hint--unlock" data-role="unlock-hint" hidden></p>',
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
    const unlockHintNode = shell.querySelector('[data-role="unlock-hint"]');
    const startTitleNode = shell.querySelector('[data-role="start-title"]');
    const startCopyNode = shell.querySelector('[data-role="start-copy"]');
    const difficultyButtonsContainer = shell.querySelector('[data-role="difficulty-buttons"]');
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
    let starTimers = [];
    let noteReleaseTimers = [];
    let noteTargetTop = 0;
    let selectedDifficulty = '';
    let hiddenUnlocked = false;
    let justUnlockedHiddenStage = false;
    let currentTheme = getGameTheme('');
    let difficultyButtons = [];
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
      starTimers.forEach(function (timerId) {
        root.clearTimeout(timerId);
      });
      starTimers = [];
      laneKeyNodes.forEach(function (laneKeyNode) {
        laneKeyNode.classList.remove('is-hit', 'is-miss');
        laneKeyNode.querySelectorAll('.rhythm-game__burst-star').forEach(function (starNode) {
          starNode.remove();
        });
      });
    }

    function spawnHitStars(laneIndex, combo) {
      const laneKeyNode = laneKeyNodes[laneIndex];

      if (!laneKeyNode) {
        return;
      }

      createHitStarDescriptors(combo, root.Math.random).forEach(function (descriptor) {
        const starNode = root.document.createElement('span');
        let timerId;

        starNode.className = getHitStarClassName(combo);
        starNode.style.setProperty('--star-x', descriptor.x.toFixed(2) + 'px');
        starNode.style.setProperty('--star-y', descriptor.y.toFixed(2) + 'px');
        starNode.style.setProperty('--star-scale', descriptor.scale.toFixed(2));
        starNode.style.setProperty('--star-rotation', descriptor.rotation.toFixed(2) + 'deg');
        laneKeyNode.appendChild(starNode);

        timerId = root.setTimeout(function () {
          starNode.remove();
          starTimers = starTimers.filter(function (activeTimerId) {
            return activeTimerId !== timerId;
          });
        }, STAR_BURST_DURATION);

        starTimers.push(timerId);
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
      const appearanceClass = getNoteAppearanceClass(note, currentTheme);
      element.dataset.noteId = String(note.id);
      element.textContent = note.char;
      if (appearanceClass) {
        element.classList.add(appearanceClass);
      }
      laneNodes[note.lane].appendChild(element);
      noteElements.set(note.id, element);
      return element;
    }

    function syncLaneKeyAssets() {
      laneNodes.forEach(function (laneNode, laneIndex) {
        const imageNode = laneNode.querySelector('.rhythm-game__lane-key-image');
        if (imageNode) {
          imageNode.src = getLaneKeyAssetPath(KEY_BINDINGS[laneIndex], currentTheme);
        }
      });
    }

    function bindDifficultyButtons() {
      difficultyButtons = Array.from(shell.querySelectorAll('.rhythm-game__difficulty'));
      difficultyButtons.forEach(function (buttonNode) {
        buttonNode.addEventListener('click', function () {
          applyDifficulty(buttonNode.dataset.difficulty);
        });
      });
    }

    function syncDifficultyButtons() {
      difficultyButtonsContainer.innerHTML = createDifficultyButtonsMarkup(hiddenUnlocked);
      bindDifficultyButtons();
    }

    function applyDifficulty(difficulty) {
      const difficultyConfig = getDifficultyConfig(difficulty);

      if (!difficultyConfig) {
        return;
      }

      selectedDifficulty = difficulty;
      currentTheme = getGameTheme(difficulty);
      activeLaneIndexes = difficultyConfig.laneIndexes.slice();
      shell.dataset.laneCount = String(difficultyConfig.laneCount);
      if (startTitleNode) {
        startTitleNode.textContent = currentTheme.title;
      }
      if (startCopyNode) {
        startCopyNode.textContent = currentTheme.warningCopy;
      }
      syncLaneKeyAssets();
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
      return getPlaybackTime({
        running: running,
        elapsedBeforePause: elapsedBeforePause,
        audioCurrentTime: audio.currentTime,
        startedAt: startedAt,
        now: root.performance.now(),
      });
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
      unlockHintNode.hidden = true;
      unlockHintNode.textContent = '';
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
      syncDifficultyButtons();
      startOverlay.hidden = false;
      startOverlay.dataset.state = stateLabel || 'ready';
      applyDifficulty(
        getDifficultyToFocus({
          selectedDifficulty: selectedDifficulty,
          hiddenUnlocked: hiddenUnlocked,
          justUnlockedHiddenStage: justUnlockedHiddenStage,
        }),
      );
      justUnlockedHiddenStage = false;
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
      unlockHintNode.textContent = getResultUnlockMessage(justUnlockedHiddenStage);
      unlockHintNode.hidden = unlockHintNode.textContent === '';
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
      justUnlockedHiddenStage = false;
      if (shouldUnlockHiddenStage({ difficulty: selectedDifficulty, payload: payload }) && !hiddenUnlocked) {
        hiddenUnlocked = true;
        justUnlockedHiddenStage = true;
      }
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
        applyDifficulty(
          getAdjacentDifficulty(
            selectedDifficulty,
            event.code === 'ArrowRight' ? 1 : -1,
            getAvailableDifficultyOrder(hiddenUnlocked),
          ),
        );
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
        spawnHitStars(lane, result.state.combo);
        const element = noteElements.get(note.id);
        note.wasSuccessful = true;
        if (element) {
          element.classList.remove('is-target');
          element.classList.add(getNoteAppearanceClass(note, currentTheme));
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

    bindDifficultyButtons();
    root.addEventListener('keydown', onKeyDown);
    shell.dataset.laneCount = '4';
    syncLaneKeyAssets();
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
    getAvailableDifficultyOrder: getAvailableDifficultyOrder,
    getDifficultyToFocus: getDifficultyToFocus,
    getAdjacentDifficulty: getAdjacentDifficulty,
    getGameTheme: getGameTheme,
    getLaneFeedbackClass: getLaneFeedbackClass,
    getHitStarCount: getHitStarCount,
    createHitStarDescriptors: createHitStarDescriptors,
    getHitStarClassName: getHitStarClassName,
    getLaneKeyAssetPath: getLaneKeyAssetPath,
    hideTyranoMessageLayers: hideTyranoMessageLayers,
    calculateNoteTargetTop: calculateNoteTargetTop,
    getDifficultyConfig: getDifficultyConfig,
    canStartFromSpace: canStartFromSpace,
    getPlaybackTime: getPlaybackTime,
    getLayoutReferenceLaneIndex: getLayoutReferenceLaneIndex,
    getNoteAppearanceClass: getNoteAppearanceClass,
    getResultUnlockMessage: getResultUnlockMessage,
    shouldUnlockHiddenStage: shouldUnlockHiddenStage,
  };
});
