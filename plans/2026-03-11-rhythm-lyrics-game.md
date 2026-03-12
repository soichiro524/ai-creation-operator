# Rhythm Lyrics Game Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** `docs/` ルートに、歌詞が落下する4レーン音ゲーを追加し、目立つ音量注意表示付きで遊べるようにする

**Architecture:** TyranoScript は開始導線と結果表示に絞り、ゲーム本体は DOM ベースの JavaScript モジュールで実装する。判定やスコア処理は `rhythm_game_core.js` に分離し、`node --test` で先に固定する。UI は `rhythm_game_ui.js` で描画し、`rhythm_game_data.js` の手動譜面を使って楽曲同期する。

**Tech Stack:** TyranoScript, vanilla JavaScript modules, CSS, Node.js built-in test runner

---

### Task 1: Add a testable rhythm core

**Files:**
- Create: `tests/rhythm_game_core.test.mjs`
- Create: `docs/data/system/rhythm_game_core.js`

**Step 1: Write the failing test**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createInitialState,
  buildChart,
  judgeNote,
  applyMiss,
  finalizeGame,
} from '../docs/data/system/rhythm_game_core.js';

test('buildChart combines characters, timings, and lanes', () => {
  const randomValues = [0.0, 0.24, 0.5];
  let index = 0;
  const chart = buildChart({
    lyrics: ['き', 'ら', 'り'],
    timings: [1.0, 1.5, 2.0],
    random: () => randomValues[index++],
  });

  assert.equal(chart.length, 3);
  assert.deepEqual(
    chart.map(({ char, time, lane }) => ({ char, time, lane })),
    [
      { char: 'き', time: 1.0, lane: 0 },
      { char: 'ら', time: 1.5, lane: 0 },
      { char: 'り', time: 2.0, lane: 2 },
    ],
  );
});

test('judgeNote rewards a matching key press inside the window', () => {
  const state = createInitialState({ life: 10 });
  const note = { id: 1, lane: 2, time: 5.0, hit: false };

  const result = judgeNote({
    state,
    note,
    lane: 2,
    inputTime: 5.08,
    hitWindow: 0.12,
  });

  assert.equal(result.outcome, 'hit');
  assert.equal(result.state.score, 100);
  assert.equal(result.state.combo, 1);
  assert.equal(result.state.life, 10);
});

test('judgeNote penalizes wrong-lane input', () => {
  const state = createInitialState({ life: 10 });
  const note = { id: 1, lane: 1, time: 8.0, hit: false };

  const result = judgeNote({
    state,
    note,
    lane: 3,
    inputTime: 8.02,
    hitWindow: 0.12,
  });

  assert.equal(result.outcome, 'miss');
  assert.equal(result.state.score, -50);
  assert.equal(result.state.combo, 0);
  assert.equal(result.state.life, 9);
});

test('applyMiss ends the game when life reaches zero', () => {
  const state = createInitialState({ life: 1, score: 40, combo: 3, maxCombo: 3 });
  const result = applyMiss(state);

  assert.equal(result.life, 0);
  assert.equal(result.combo, 0);
  assert.equal(result.isGameOver, true);
});

test('finalizeGame marks the run as cleared when life remains', () => {
  const state = createInitialState({ life: 4, score: 800, maxCombo: 7 });
  const result = finalizeGame(state);

  assert.equal(result.isCleared, true);
  assert.equal(result.isGameOver, false);
});
```

**Step 2: Run test to verify it fails**

Run: `node --test tests/rhythm_game_core.test.mjs`
Expected: FAIL with `Cannot find module '../docs/data/system/rhythm_game_core.js'`

**Step 3: Write minimal implementation**

```js
const HIT_SCORE = 100;
const MISS_SCORE = -50;

export function createInitialState({ life = 10, score = 0, combo = 0, maxCombo = 0 } = {}) {
  return {
    life,
    score,
    combo,
    maxCombo,
    isCleared: false,
    isGameOver: false,
  };
}

export function buildChart({ lyrics, timings, random = Math.random }) {
  return lyrics.map((char, index) => ({
    id: index,
    char,
    time: timings[index],
    lane: Math.min(3, Math.floor(random() * 4)),
    hit: false,
  }));
}

export function applyMiss(state) {
  const life = Math.max(0, state.life - 1);
  return {
    ...state,
    life,
    score: state.score + MISS_SCORE,
    combo: 0,
    isGameOver: life === 0,
  };
}

export function judgeNote({ state, note, lane, inputTime, hitWindow }) {
  const delta = Math.abs(inputTime - note.time);
  if (delta <= hitWindow && lane === note.lane) {
    const combo = state.combo + 1;
    return {
      outcome: 'hit',
      state: {
        ...state,
        score: state.score + HIT_SCORE,
        combo,
        maxCombo: Math.max(state.maxCombo, combo),
      },
    };
  }

  return {
    outcome: 'miss',
    state: applyMiss(state),
  };
}

export function finalizeGame(state) {
  return {
    ...state,
    isCleared: state.life > 0,
    isGameOver: state.life === 0,
  };
}
```

**Step 4: Run test to verify it passes**

Run: `node --test tests/rhythm_game_core.test.mjs`
Expected: PASS with `# pass 5`

**Step 5: Commit**

```bash
git add tests/rhythm_game_core.test.mjs docs/data/system/rhythm_game_core.js
git commit -m "test: add rhythm game core"
```

### Task 2: Add the song data and chart metadata

**Files:**
- Create: `docs/data/system/rhythm_game_data.js`
- Modify: `tests/rhythm_game_core.test.mjs`

**Step 1: Write the failing test**

```js
import { lyricsCharacters, noteTimings, createGameChart } from '../docs/data/system/rhythm_game_data.js';

test('song data exposes matching lyrics and timing counts', () => {
  assert.equal(lyricsCharacters.length, noteTimings.length);
  assert.ok(lyricsCharacters.length > 20);
});

test('createGameChart returns only supported lanes', () => {
  const chart = createGameChart(() => 0.99);
  assert.ok(chart.every((note) => note.lane >= 0 && note.lane <= 3));
});
```

**Step 2: Run test to verify it fails**

Run: `node --test tests/rhythm_game_core.test.mjs`
Expected: FAIL with `Cannot find module '../docs/data/system/rhythm_game_data.js'`

**Step 3: Write minimal implementation**

```js
import { buildChart } from './rhythm_game_core.js';

export const lyricsCharacters = [
  'か', 'が', 'や', 'く', 'ほ', 'し',
  'の', 'し', 'た', 'で', 'き', 'み',
];

export const noteTimings = [
  1.25, 1.62, 1.95, 2.28, 2.62, 3.0,
  3.42, 3.85, 4.18, 4.5, 4.88, 5.22,
];

export function createGameChart(random = Math.random) {
  return buildChart({
    lyrics: lyricsCharacters,
    timings: noteTimings,
    random,
  });
}
```

**Step 4: Run test to verify it passes**

Run: `node --test tests/rhythm_game_core.test.mjs`
Expected: PASS with the new data tests included

**Step 5: Commit**

```bash
git add tests/rhythm_game_core.test.mjs docs/data/system/rhythm_game_data.js
git commit -m "feat: add rhythm chart data"
```

### Task 3: Build the warning screen and game UI shell

**Files:**
- Create: `docs/data/system/rhythm_game_ui.js`
- Create: `docs/data/system/rhythm_game.css`
- Modify: `docs/index.html`

**Step 1: Write the failing test**

Create a DOM-focused test entry in `tests/rhythm_game_core.test.mjs` that asserts the UI factory renders the warning overlay before playback:

```js
import { createGameShell } from '../docs/data/system/rhythm_game_ui.js';

test('createGameShell shows a prominent audio warning before start', () => {
  const root = globalThis.document.createElement('div');
  const shell = createGameShell(root);

  assert.match(shell.warning.textContent, /音が出ます/);
  assert.equal(shell.overlay.dataset.state, 'ready');
});
```

**Step 2: Run test to verify it fails**

Run: `node --test tests/rhythm_game_core.test.mjs`
Expected: FAIL because `createGameShell` does not exist yet

**Step 3: Write minimal implementation**

```js
export function createGameShell(root) {
  root.innerHTML = `
    <section class="rhythm-game" data-state="idle">
      <div class="rhythm-game__overlay" data-state="ready">
        <p class="rhythm-game__warning">音が出ます</p>
        <button type="button" class="rhythm-game__start">開始する</button>
      </div>
      <div class="rhythm-game__hud">
        <span data-role="score">0</span>
        <span data-role="life">10</span>
      </div>
      <div class="rhythm-game__lanes"></div>
      <div class="rhythm-game__judge-line"></div>
    </section>
  `;

  return {
    overlay: root.querySelector('.rhythm-game__overlay'),
    warning: root.querySelector('.rhythm-game__warning'),
    startButton: root.querySelector('.rhythm-game__start'),
  };
}
```

Update `docs/index.html` to load:

```html
<link href="./data/system/rhythm_game.css" rel="stylesheet" type="text/css"/>
<script type="module" src="./data/system/rhythm_game_ui.js"></script>
```

Add CSS that makes `.rhythm-game__overlay` cover the play area and enlarges `.rhythm-game__warning`.

**Step 4: Run test to verify it passes**

Run: `node --test tests/rhythm_game_core.test.mjs`
Expected: PASS with the new UI shell test included

**Step 5: Commit**

```bash
git add tests/rhythm_game_core.test.mjs docs/index.html docs/data/system/rhythm_game_ui.js docs/data/system/rhythm_game.css
git commit -m "feat: add rhythm game shell"
```

### Task 4: Connect playback, note motion, and keyboard judging

**Files:**
- Modify: `docs/data/system/rhythm_game_ui.js`
- Modify: `docs/data/system/rhythm_game_core.js`
- Modify: `docs/data/system/rhythm_game_data.js`
- Modify: `tests/rhythm_game_core.test.mjs`
- Create: `docs/bgm/maou_short_14_shining_star.mp3`

**Step 1: Write the failing test**

Extend `tests/rhythm_game_core.test.mjs` with a controller-level test for note selection:

```js
import { findJudgableNote } from '../docs/data/system/rhythm_game_core.js';

test('findJudgableNote returns the nearest active note in the pressed lane', () => {
  const chart = [
    { id: 1, lane: 0, time: 2.0, hit: false },
    { id: 2, lane: 1, time: 2.1, hit: false },
  ];

  const note = findJudgableNote({
    chart,
    lane: 1,
    currentTime: 2.08,
    hitWindow: 0.12,
  });

  assert.equal(note?.id, 2);
});
```

**Step 2: Run test to verify it fails**

Run: `node --test tests/rhythm_game_core.test.mjs`
Expected: FAIL because `findJudgableNote` is missing

**Step 3: Write minimal implementation**

```js
export function findJudgableNote({ chart, lane, currentTime, hitWindow }) {
  return chart.find((note) => !note.hit && note.lane === lane && Math.abs(note.time - currentTime) <= hitWindow);
}
```

Then expand `rhythm_game_ui.js` so it:

- creates 4 lane columns and per-note elements
- starts audio only after the overlay button is pressed
- uses `performance.now()` plus the song start timestamp to compute current play time
- spawns notes early enough to visually fall into the judge line
- binds `keydown` for `KeyA`, `KeyS`, `KeyD`, `KeyF`
- updates score, combo, and life in the HUD
- ends the run on life 0 or song end

Copy `maou_short_14_shining_star.mp3` into `docs/bgm/maou_short_14_shining_star.mp3` so the page can load it from the published `docs/` tree.

**Step 4: Run test to verify it passes**

Run: `node --test tests/rhythm_game_core.test.mjs`
Expected: PASS with the new note-selection test included

**Step 5: Commit**

```bash
git add tests/rhythm_game_core.test.mjs docs/data/system/rhythm_game_core.js docs/data/system/rhythm_game_data.js docs/data/system/rhythm_game_ui.js docs/bgm/maou_short_14_shining_star.mp3
git commit -m "feat: wire rhythm gameplay"
```

### Task 5: Replace the sample scenario with the rhythm-game flow

**Files:**
- Modify: `docs/data/scenario/first.ks`
- Modify: `docs/data/system/rhythm_game_ui.js`

**Step 1: Write the failing test**

Add a state serialization test so the result screen can be driven from JS output:

```js
import { createResultPayload } from '../docs/data/system/rhythm_game_core.js';

test('createResultPayload exposes score, max combo, and clear status', () => {
  const payload = createResultPayload({
    score: 1200,
    maxCombo: 11,
    life: 3,
    isCleared: true,
  });

  assert.deepEqual(payload, {
    score: 1200,
    maxCombo: 11,
    remainingLife: 3,
    resultLabel: 'CLEAR',
  });
});
```

**Step 2: Run test to verify it fails**

Run: `node --test tests/rhythm_game_core.test.mjs`
Expected: FAIL because `createResultPayload` is missing

**Step 3: Write minimal implementation**

```js
export function createResultPayload(state) {
  return {
    score: state.score,
    maxCombo: state.maxCombo,
    remainingLife: state.life,
    resultLabel: state.isCleared ? 'CLEAR' : 'GAME OVER',
  };
}
```

Update `first.ks` to:

- rename the title for the new game
- explain the `A/S/D/F` rules
- reserve a visible area for the rhythm game root
- show retry text after the JavaScript game reports completion

Update `rhythm_game_ui.js` so it writes the result payload to the page and resets cleanly on retry.

**Step 4: Run test to verify it passes**

Run: `node --test tests/rhythm_game_core.test.mjs`
Expected: PASS with the result-payload test included

**Step 5: Commit**

```bash
git add tests/rhythm_game_core.test.mjs docs/data/scenario/first.ks docs/data/system/rhythm_game_core.js docs/data/system/rhythm_game_ui.js
git commit -m "feat: connect rhythm game scenario"
```

### Task 6: Verify browser behavior end to end

**Files:**
- Modify: `docs/data/system/rhythm_game_data.js`
- Modify: `docs/data/system/rhythm_game_ui.js`
- Modify: `docs/data/system/rhythm_game.css`

**Step 1: Write the failing test**

No new automated test in this task. Start by running the existing suite and manually checking the play loop to identify remaining gaps.

**Step 2: Run test to verify baseline**

Run: `node --test tests/rhythm_game_core.test.mjs`
Expected: PASS

**Step 3: Write minimal implementation**

Adjust only the values needed after hands-on play:

- tune note timings that feel visibly off
- tweak fall duration and judge-line position
- improve overlay prominence if the audio warning is not obvious enough
- ensure retry fully clears note DOM and audio state

**Step 4: Run test to verify it passes**

Run: `node --test tests/rhythm_game_core.test.mjs`
Expected: PASS after the tuning changes

Manual verification:

```bash
python3 -m http.server 8000 --directory docs
```

Open `http://localhost:8000` and verify:

- the warning overlay appears before audio playback
- no sound plays until `開始する` is pressed
- `A/S/D/F` input hits matching lanes only
- 10 misses causes `GAME OVER`
- surviving until the end shows `CLEAR`

**Step 5: Commit**

```bash
git add docs/data/system/rhythm_game_data.js docs/data/system/rhythm_game_ui.js docs/data/system/rhythm_game.css
git commit -m "fix: tune rhythm game flow"
```
