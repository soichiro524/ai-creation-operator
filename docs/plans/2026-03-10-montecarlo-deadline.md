# Monte Carlo Deadline Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a short TyranoScript-based browser minigame where the player juggles progress, credibility, and stamina to submit a funny-but-plausible Monte Carlo report before the deadline.

**Architecture:** Keep TyranoScript responsible for title, instructions, and result scenes in `first.ks`, and move the minigame logic into plain JavaScript modules loaded by `index.html`. Separate pure game-state logic from browser-only rendering so the state transitions and ending rules can be tested with Node's built-in test runner.

**Tech Stack:** TyranoScript, plain JavaScript, CSS, Node.js built-in test runner (`node --test`)

---

### Task 1: Create the Testable Game Core

**Files:**
- Create: `docs/data/system/montecarlo_game_core.js`
- Create: `tests/montecarlo-game-core.test.mjs`

**Step 1: Write the failing test**

```javascript
import test from "node:test";
import assert from "node:assert/strict";
import {
  createInitialState,
  applyActionToEvent,
  tickClock,
  resolveEnding,
} from "../docs/data/system/montecarlo_game_core.js";

test("createInitialState returns the opening stats", () => {
  assert.deepEqual(createInitialState(), {
    timeLeft: 45,
    progress: 0,
    credibility: 60,
    stamina: 70,
    ended: false,
  });
});

test("applyActionToEvent clamps stats between 0 and 100", () => {
  const state = {
    timeLeft: 10,
    progress: 98,
    credibility: 4,
    stamina: 3,
    ended: false,
  };
  const next = applyActionToEvent(state, {
    success: { progress: 10, credibility: -20, stamina: -10 },
  });
  assert.equal(next.progress, 100);
  assert.equal(next.credibility, 0);
  assert.equal(next.stamina, 0);
});

test("resolveEnding returns sleep ending when stamina is depleted", () => {
  assert.equal(
    resolveEnding({ timeLeft: 0, progress: 80, credibility: 40, stamina: 0 }),
    "sleep"
  );
});
```

**Step 2: Run test to verify it fails**

Run: `node --test tests/montecarlo-game-core.test.mjs`
Expected: FAIL with module-not-found or missing export errors

**Step 3: Write minimal implementation**

```javascript
const clamp = (value) => Math.max(0, Math.min(100, value));

export function createInitialState() {
  return {
    timeLeft: 45,
    progress: 0,
    credibility: 60,
    stamina: 70,
    ended: false,
  };
}

export function applyActionToEvent(state, effect) {
  return {
    ...state,
    progress: clamp(state.progress + effect.success.progress),
    credibility: clamp(state.credibility + effect.success.credibility),
    stamina: clamp(state.stamina + effect.success.stamina),
  };
}

export function tickClock(state) {
  return {
    ...state,
    timeLeft: Math.max(0, state.timeLeft - 1),
  };
}

export function resolveEnding(state) {
  if (state.stamina <= 0) return "sleep";
  if (state.progress >= 100 && state.credibility >= 50) return "good";
  return "funny_bad";
}
```

**Step 4: Run test to verify it passes**

Run: `node --test tests/montecarlo-game-core.test.mjs`
Expected: PASS with 3 passing tests

**Step 5: Commit**

```bash
git add tests/montecarlo-game-core.test.mjs docs/data/system/montecarlo_game_core.js
git commit -m "feat: add monte carlo game core"
```

### Task 2: Add Event Data and Result Rules

**Files:**
- Create: `docs/data/system/montecarlo_game_data.js`
- Modify: `docs/data/system/montecarlo_game_core.js`
- Create: `tests/montecarlo-game-data.test.mjs`

**Step 1: Write the failing test**

```javascript
import test from "node:test";
import assert from "node:assert/strict";
import { EVENTS, ACTIONS } from "../docs/data/system/montecarlo_game_data.js";

test("every event declares text and four action outcomes", () => {
  assert.ok(EVENTS.length >= 8);
  for (const event of EVENTS) {
    assert.equal(typeof event.text, "string");
    assert.equal(Object.keys(event.outcomes).length, 4);
  }
});

test("actions stay aligned with the UI labels", () => {
  assert.deepEqual(ACTIONS, [
    "sample",
    "seed",
    "timestep",
    "sleep",
  ]);
});
```

**Step 2: Run test to verify it fails**

Run: `node --test tests/montecarlo-game-data.test.mjs`
Expected: FAIL with module-not-found or assertion failures

**Step 3: Write minimal implementation**

```javascript
export const ACTIONS = ["sample", "seed", "timestep", "sleep"];

export const EVENTS = [
  {
    id: "job_crashed",
    text: "ジョブが落ちた。研究室の空気も重い。",
    outcomes: {
      sample: { progress: 8, credibility: 2, stamina: -4 },
      seed: { progress: 2, credibility: -3, stamina: -2 },
      timestep: { progress: 5, credibility: -5, stamina: -1 },
      sleep: { progress: -5, credibility: -2, stamina: 8 },
    },
  },
];
```

Expand the array to 8 to 10 events and update `resolveEnding` if final thresholds need adjustment after tuning.

**Step 4: Run test to verify it passes**

Run: `node --test tests/montecarlo-game-core.test.mjs tests/montecarlo-game-data.test.mjs`
Expected: PASS with both suites green

**Step 5: Commit**

```bash
git add tests/montecarlo-game-data.test.mjs docs/data/system/montecarlo_game_data.js docs/data/system/montecarlo_game_core.js
git commit -m "feat: add monte carlo event data"
```

### Task 3: Build the Browser UI Bridge

**Files:**
- Create: `docs/data/system/montecarlo_game_ui.js`
- Create: `docs/data/system/montecarlo_game.css`
- Modify: `docs/index.html`
- Create: `tests/montecarlo-game-ui.test.mjs`

**Step 1: Write the failing test**

```javascript
import test from "node:test";
import assert from "node:assert/strict";
import { renderStatusMarkup, renderActionButtons } from "../docs/data/system/montecarlo_game_ui.js";

test("renderStatusMarkup includes all three tracked stats", () => {
  const html = renderStatusMarkup({
    timeLeft: 12,
    progress: 30,
    credibility: 55,
    stamina: 44,
  });
  assert.match(html, /進捗/);
  assert.match(html, /信頼度/);
  assert.match(html, /精神力/);
});

test("renderActionButtons returns four action buttons", () => {
  const html = renderActionButtons();
  assert.equal((html.match(/data-action=/g) || []).length, 4);
});
```

**Step 2: Run test to verify it fails**

Run: `node --test tests/montecarlo-game-ui.test.mjs`
Expected: FAIL with module-not-found or missing export errors

**Step 3: Write minimal implementation**

```javascript
import { ACTIONS, EVENTS } from "./montecarlo_game_data.js";
import {
  createInitialState,
  applyActionToEvent,
  tickClock,
  resolveEnding,
} from "./montecarlo_game_core.js";

export function renderStatusMarkup(state) {
  return `
    <div class="mc-status">残り時間 ${state.timeLeft}</div>
    <div class="mc-meter">進捗 ${state.progress}</div>
    <div class="mc-meter">信頼度 ${state.credibility}</div>
    <div class="mc-meter">精神力 ${state.stamina}</div>
  `;
}

export function renderActionButtons() {
  return ACTIONS.map((action) => `<button data-action="${action}">${action}</button>`).join("");
}

window.MonteCarloDeadlineGame = {
  mount(root, hooks) {
    // Create state, render the current event, start interval timer,
    // and call hooks.onFinish(resolveEnding(state), state) on game end.
  },
};
```

Also add matching CSS and load both files in `docs/index.html` with `<script type="module">` and `<link rel="stylesheet">`.

**Step 4: Run test to verify it passes**

Run: `node --test tests/montecarlo-game-core.test.mjs tests/montecarlo-game-data.test.mjs tests/montecarlo-game-ui.test.mjs`
Expected: PASS with all suites green

**Step 5: Commit**

```bash
git add tests/montecarlo-game-ui.test.mjs docs/data/system/montecarlo_game_ui.js docs/data/system/montecarlo_game.css docs/index.html
git commit -m "feat: add monte carlo browser ui"
```

### Task 4: Integrate the Minigame into TyranoScript

**Files:**
- Modify: `docs/data/scenario/first.ks`
- Modify: `docs/data/system/montecarlo_game_ui.js`

**Step 1: Write the failing test**

```javascript
import test from "node:test";
import assert from "node:assert/strict";
import { resolveEnding } from "../docs/data/system/montecarlo_game_core.js";

test("ending thresholds keep good and funny bad distinct", () => {
  assert.equal(resolveEnding({ timeLeft: 0, progress: 100, credibility: 70, stamina: 20 }), "good");
  assert.equal(resolveEnding({ timeLeft: 0, progress: 100, credibility: 20, stamina: 20 }), "funny_bad");
});
```

**Step 2: Run test to verify it fails**

Run: `node --test tests/montecarlo-game-core.test.mjs`
Expected: FAIL because the current thresholds are too coarse or the end rules need refinement

**Step 3: Write minimal implementation**

```ks
*start

[title name="締切前モンテカルロ"]
[hidemenubutton]
[cm]

締切まであと45秒。[l][r]
Monte Carlo の結果を提出しないとまずい。[l][r]

[link target=*play] → 計算を始める [endlink][r]
[s]

*play
[cm]
[html top=80 left=120 name="mc_game"]
<div id="mc_game_root"></div>
[endhtml]
[iscript]
window.MonteCarloDeadlineGame.mount(document.getElementById("mc_game_root"), {
  onFinish: function(ending, state) {
    TYRANO.kag.variable.sf.mcEnding = ending;
    TYRANO.kag.variable.sf.mcScore = state.progress;
    TYRANO.kag.ftag.startTag("jump", { target: "*result" });
  }
});
[endscript]
[s]

*result
[if exp="sf.mcEnding === 'good'"]
ちゃんと収束して提出できた。[p]
[elsif exp="sf.mcEnding === 'funny_bad'"]
見た目だけ綺麗なグラフで押し切った。[p]
[else]
気づいたら朝だった。[p]
[endif]
```

Refine the JS bridge so it unmounts cleanly before jumping to the result label.

**Step 4: Run test to verify it passes**

Run: `node --test tests/montecarlo-game-core.test.mjs tests/montecarlo-game-data.test.mjs tests/montecarlo-game-ui.test.mjs`
Expected: PASS, then manually open the game in the browser and confirm one full playthrough reaches each ending

**Step 5: Commit**

```bash
git add docs/data/scenario/first.ks docs/data/system/montecarlo_game_ui.js docs/data/system/montecarlo_game_core.js
git commit -m "feat: integrate monte carlo minigame"
```

### Task 5: Tune the Joke Content and Do Final Verification

**Files:**
- Modify: `docs/data/system/montecarlo_game_data.js`
- Modify: `docs/data/scenario/first.ks`
- Modify: `README.md`

**Step 1: Write the failing test**

```javascript
import test from "node:test";
import assert from "node:assert/strict";
import { EVENTS } from "../docs/data/system/montecarlo_game_data.js";

test("event ids stay unique after content tuning", () => {
  const ids = EVENTS.map((event) => event.id);
  assert.equal(new Set(ids).size, ids.length);
});
```

**Step 2: Run test to verify it fails**

Run: `node --test tests/montecarlo-game-data.test.mjs`
Expected: FAIL if duplicate IDs or incomplete event content slipped in during tuning

**Step 3: Write minimal implementation**

```javascript
// Finalize 8 to 10 event entries with calculation-physics in-jokes,
// adjust their stat deltas for fair pacing, and keep ids unique.
```

Update `first.ks` intro and ending copy so the joke setup matches the final event tone. Add a short `README.md` note explaining that the sample has been converted into a calculation-physics minigame and how to test it locally.

**Step 4: Run test to verify it passes**

Run: `node --test tests/montecarlo-game-core.test.mjs tests/montecarlo-game-data.test.mjs tests/montecarlo-game-ui.test.mjs`
Expected: PASS, followed by manual verification of:
- one `good` ending
- one `funny_bad` ending
- one `sleep` ending
- no duplicate timers or frozen UI after retry

**Step 5: Commit**

```bash
git add docs/data/system/montecarlo_game_data.js docs/data/scenario/first.ks README.md tests/montecarlo-game-core.test.mjs tests/montecarlo-game-data.test.mjs tests/montecarlo-game-ui.test.mjs
git commit -m "docs: polish monte carlo minigame content"
```
