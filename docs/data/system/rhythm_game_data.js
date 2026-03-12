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
シャ|2.94
イ|3.10
ニン|3.29
グ|3.67
スター|3.85
つ|4.24
づ|4.60
れ|4.96
ば|5.14
ゆ|5.75
め|5.93
に|6.11
ね|6.29
む|6.63
る|6.81
ま|7.20
ぼ|7.58
ろ|7.92
し|8.11
が|8.30
て|8.91
の|9.09
ひ|9.30
ら|9.63
に|9.84
ふ|10.17
り|10.55
そ|10.91
そ|11.09
ぐ|11.42
あ|12.06
ら|12.25
た|12.44
な|12.75
せ|13.13
か|13.49
い|13.88
へ|14.09
I'll|14.80
believe|15.19
of|15.60
my|15.79
sen|16.17
sa|16.50
tion|17.06
は|17.64
て|17.83
し|18.02
ない|18.21
み|18.59
ち|18.78
の|19.12
む|19.48
こ|19.91
う|20.12
で|20.33
ま|20.54
ぶ|21.03
た|21.22
の|21.41
う|21.77
ら|21.98
に|22.32
う|22.65
つ|23.04
る|23.23
ひ|23.57
と|24.16
し|24.34
ず|24.52
く|24.86
の|25.20
ひ|25.61
か|25.97
り|26.16
ト|26.47
キ|27.13
メ|27.31
キ|27.65
を|28.03
か|28.37
ん|28.75
じ|29.54
て|29.95
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
