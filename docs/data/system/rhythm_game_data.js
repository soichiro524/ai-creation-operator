(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('./rhythm_game_core.js'));
    return;
  }

  root.RhythmGameData = factory(root.RhythmGameCore);
})(typeof globalThis !== 'undefined' ? globalThis : window, function (core) {
  const I_VOWEL_KANA = new Set([
    'い', 'き', 'し', 'ち', 'に', 'ひ', 'み', 'り', 'ぎ', 'じ', 'ぢ', 'び', 'ぴ', 'ゐ', 'ぃ',
    'イ', 'キ', 'シ', 'チ', 'ニ', 'ヒ', 'ミ', 'リ', 'ギ', 'ジ', 'ヂ', 'ビ', 'ピ', 'ヰ', 'ィ',
  ]);
  const AI_CONTAINING_TOKENS = new Set(['ニン', "I'll", 'believe', 'tion']);

  const chartSource = `
シャ|2.59
イ|2.62
ニン|2.91
グ|3.32
スター|3.50
つ|3.89
づ|4.25
れ|4.61
ば|4.79
ゆ|5.40
め|5.58
に|5.66
ね|5.94
む|6.28
る|6.46
ま|6.85
ぼ|7.23
ろ|7.57
し|7.76
が|7.95
て|8.56
の|8.74
ひ|9.00
ら|9.28
に|9.59
ふ|9.82
り|10.30
そ|10.56
そ|10.74
ぐ|11.07
あ|11.71
ら|11.90
た|12.09
な|12.40
せ|12.78
か|13.14
い|13.57
へ|13.74
I'll|14.52
believe|14.9
of|15.25
my|15.44
sen|15.82
sa|16.15
tion|16.78
は|17.29
て|17.48
し|17.67
ない|17.86
み|18.34
ち|18.53
の|18.77
む|19.13
こ|19.56
う|19.77
で|19.98
ま|20.19
ぶ|20.68
た|20.87
の|21.06
う|21.42
ら|21.63
に|22.40
う|22.60
つ|22.69
る|22.88
ひ|23.80
と|24.00
し|24.30
ず|24.60
く|25.00
の|25.20
ひ|25.91
か|26.06
り|26.40
ト|26.92
キ|27.20
メ|27.50
キ|27.80
を|28.10
か|28.30
ん|29.00
じ|29.70
て|29.90
`
    .trim()
    .split('\n')
    .map(function (line) {
      const parts = line.split('|');
      return {
        char: parts[0],
        time: Number(parts[1]),
      };
    });

  const lyricsCharacters = chartSource.map(function (entry) {
    return entry.char;
  });

  const noteTimings = chartSource.map(function (entry) {
    return entry.time;
  });

  function normalizeChartOptions(optionsOrRandom) {
    if (typeof optionsOrRandom === 'function' || optionsOrRandom == null) {
      return {
        random: optionsOrRandom || Math.random,
        allowedLanes: [0, 1, 2, 3],
      };
    }

    return {
      random: optionsOrRandom.random || Math.random,
      allowedLanes: optionsOrRandom.allowedLanes || [0, 1, 2, 3],
    };
  }

  function shouldPressLyricToken(token) {
    if (AI_CONTAINING_TOKENS.has(token)) {
      return true;
    }

    return token.length === 1 && I_VOWEL_KANA.has(token);
  }

  function createGameChart(optionsOrRandom) {
    const options = normalizeChartOptions(optionsOrRandom);

    return chartSource.map(function (entry, index) {
      return {
        id: index,
        char: entry.char,
        time: entry.time,
        lane: options.allowedLanes[Math.floor(options.random() * options.allowedLanes.length)],
        shouldPress: shouldPressLyricToken(entry.char),
        hit: false,
      };
    });
  }

  return {
    chartSource: chartSource,
    lyricsCharacters: lyricsCharacters,
    noteTimings: noteTimings,
    shouldPressLyricToken: shouldPressLyricToken,
    createGameChart: createGameChart,
  };
});
