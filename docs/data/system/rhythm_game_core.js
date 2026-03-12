(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
    return;
  }

  root.RhythmGameCore = factory();
})(typeof globalThis !== 'undefined' ? globalThis : window, function () {
  const HIT_SCORE = 100;
  const MISS_SCORE = -50;

  function createInitialState(options) {
    const settings = options || {};

    return {
      score: settings.score || 0,
      life: settings.life == null ? 10 : settings.life,
      combo: settings.combo || 0,
      maxCombo: settings.maxCombo || 0,
      isCleared: false,
      isGameOver: false,
    };
  }

  function buildChart(options) {
    return options.lyrics.map(function (char, index) {
      return {
        id: index,
        char: char,
        time: options.timings[index],
        lane: Math.min(3, Math.floor(options.random() * 4)),
        shouldPress: options.shouldPressDecider ? options.shouldPressDecider(char) : false,
        hit: false,
      };
    });
  }

  function applyMiss(state) {
    const life = Math.max(0, state.life - 1);

    return {
      score: state.score + MISS_SCORE,
      life: life,
      combo: 0,
      maxCombo: state.maxCombo,
      isCleared: false,
      isGameOver: life === 0,
    };
  }

  function judgeNote(options) {
    const delta = Math.abs(options.inputTime - options.note.time);

    if (delta <= options.hitWindow && options.lane === options.note.lane && options.note.shouldPress) {
      const combo = options.state.combo + 1;
      return {
        outcome: 'hit',
        state: {
          score: options.state.score + HIT_SCORE,
          life: options.state.life,
          combo: combo,
          maxCombo: Math.max(options.state.maxCombo, combo),
          isCleared: false,
          isGameOver: false,
        },
      };
    }

    return {
      outcome: 'miss',
      state: applyMiss(options.state),
    };
  }

  function findJudgableNote(options) {
    let bestNote = null;
    let bestDelta = Infinity;

    options.chart.forEach(function (note) {
      const delta = Math.abs(note.time - options.currentTime);
      if (note.hit || note.missed || note.lane !== options.lane || delta > options.hitWindow) {
        return;
      }

      if (delta < bestDelta) {
        bestDelta = delta;
        bestNote = note;
      }
    });

    return bestNote;
  }

  function finalizeGame(state) {
    return {
      score: state.score,
      life: state.life,
      combo: state.combo,
      maxCombo: state.maxCombo,
      isCleared: state.life > 0,
      isGameOver: state.life === 0,
    };
  }

  function createResultPayload(state) {
    return {
      score: state.score,
      maxCombo: state.maxCombo,
      remainingLife: state.life,
      resultLabel: state.isCleared ? 'CLEAR' : 'GAME OVER',
    };
  }

  return {
    createInitialState: createInitialState,
    buildChart: buildChart,
    judgeNote: judgeNote,
    applyMiss: applyMiss,
    finalizeGame: finalizeGame,
    findJudgableNote: findJudgableNote,
    createResultPayload: createResultPayload,
  };
});
