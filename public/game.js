/* The Very Hungry Caterpillar — a small browser game.
   Plain JS, no build step. Steer the caterpillar (snake-style) through the
   week of eating from Eric Carle's picture book, then watch him become a
   butterfly. */
(() => {
  'use strict';

  // ---------------------------------------------------------------------------
  // Content: the week from the book
  // ---------------------------------------------------------------------------
  const FOODS = {
    apple:      { emoji: '🍎', name: 'apple' },
    pear:       { emoji: '🍐', name: 'pear' },
    plum:       { draw: 'plum', name: 'plum' },
    strawberry: { emoji: '🍓', name: 'strawberry' },
    orange:     { emoji: '🍊', name: 'orange' },
    cake:       { emoji: '🍰', name: 'piece of chocolate cake' },
    icecream:   { emoji: '🍦', name: 'ice-cream cone' },
    pickle:     { emoji: '🥒', name: 'pickle' },
    cheese:     { emoji: '🧀', name: 'slice of Swiss cheese' },
    salami:     { draw: 'salami', name: 'slice of salami' },
    lollipop:   { emoji: '🍭', name: 'lollipop' },
    pie:        { emoji: '🥧', name: 'piece of cherry pie' },
    sausage:    { emoji: '🌭', name: 'sausage' },
    cupcake:    { emoji: '🧁', name: 'cupcake' },
    watermelon: { emoji: '🍉', name: 'slice of watermelon' },
    leaf:       { emoji: '🍃', name: 'nice green leaf' },
  };
  const FRUIT = ['apple', 'pear', 'plum', 'strawberry', 'orange'];
  const TREATS = ['cake', 'icecream', 'pickle', 'cheese', 'salami', 'lollipop', 'pie', 'sausage', 'cupcake', 'watermelon'];

  const DAYS = [
    { name: 'Monday',    items: ['apple'],           decoys: 2, grow: 1,
      story: 'On Monday the caterpillar ate through one apple.', after: 'But he was still hungry!' },
    { name: 'Tuesday',   items: ['pear', 'pear'],    decoys: 2, grow: 1,
      story: 'On Tuesday he ate through two pears.', after: 'But he was still hungry!' },
    { name: 'Wednesday', items: ['plum', 'plum', 'plum'], decoys: 2, grow: 1,
      story: 'On Wednesday he ate through three plums.', after: 'But he was still hungry!' },
    { name: 'Thursday',  items: ['strawberry', 'strawberry', 'strawberry', 'strawberry'], decoys: 3, grow: 1,
      story: 'On Thursday he ate through four strawberries.', after: 'But he was still hungry!' },
    { name: 'Friday',    items: ['orange', 'orange', 'orange', 'orange', 'orange'], decoys: 3, grow: 1,
      story: 'On Friday he ate through five oranges.', after: 'But he was STILL hungry!' },
    { name: 'Saturday',  items: TREATS.slice(), decoys: 0, grow: 2, onBoard: 3, queasy: true,
      story: 'On Saturday he ate through chocolate cake, an ice-cream cone, a pickle, Swiss cheese, salami, a lollipop, cherry pie, a sausage, a cupcake and a slice of watermelon…',
      after: 'That night he had a stomachache!' },
    { name: 'Sunday',    items: ['leaf'],            decoys: 3, grow: 1, decoyPool: TREATS,
      story: 'The next day was Sunday again. The caterpillar ate through one nice green leaf…', after: 'and after that he felt much better.' },
  ];

  // ---------------------------------------------------------------------------
  // DOM
  // ---------------------------------------------------------------------------
  const $ = (id) => document.getElementById(id);
  const canvas = $('game');
  const ctx = canvas.getContext('2d');
  const stage = $('stage');
  const overlay = $('overlay');
  const card = $('card');
  const dayBadge = $('dayBadge');
  const goalEl = $('goal');
  const heartsEl = $('hearts');
  const scoreEl = $('score');
  const toastEl = $('toast');

  // ---------------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------------
  const COLS = 16, ROWS = 16;
  const MAX_HEARTS = 3;
  const DIRS = { up: { x: 0, y: -1 }, down: { x: 0, y: 1 }, left: { x: -1, y: 0 }, right: { x: 1, y: 0 } };

  const state = {
    screen: 'title',         // title | story | play | paused | ending | gameover
    dayIdx: 0,
    snake: [],
    dir: DIRS.right,
    queue: [],
    items: [],               // {x, y, key, target}
    remaining: [],           // food keys still to be placed this day
    eatenToday: 0,
    growPending: 0,
    hearts: MAX_HEARTS,
    score: 0,
    difficulty: 'normal',
    tickMs: 200,
    acc: 0,
    lastT: 0,
    flashUntil: 0,
    popups: [],              // floating text {x, y, text, t}
    ending: null,
    cell: 24,
    best: Number(localStorage.getItem('vhc-best') || 0),
    muted: localStorage.getItem('vhc-muted') === '1',
  };

  // ---------------------------------------------------------------------------
  // Sound (tiny WebAudio blips)
  // ---------------------------------------------------------------------------
  let audio = null;
  function beep(freq, dur = 0.08, type = 'square', vol = 0.05) {
    if (state.muted) return;
    try {
      audio = audio || new (window.AudioContext || window.webkitAudioContext)();
      if (audio.state === 'suspended') audio.resume();
      const o = audio.createOscillator();
      const g = audio.createGain();
      o.type = type;
      o.frequency.value = freq;
      g.gain.setValueAtTime(vol, audio.currentTime);
      g.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + dur);
      o.connect(g).connect(audio.destination);
      o.start();
      o.stop(audio.currentTime + dur);
    } catch (_) { /* no audio, no problem */ }
  }
  const sfx = {
    chomp: () => { beep(520, 0.07, 'square'); setTimeout(() => beep(720, 0.08, 'square'), 60); },
    bad:   () => { beep(180, 0.2, 'sawtooth', 0.06); },
    day:   () => { [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => beep(f, 0.12, 'triangle', 0.06), i * 90)); },
    win:   () => { [523, 659, 784, 1046, 1318].forEach((f, i) => setTimeout(() => beep(f, 0.2, 'triangle', 0.07), i * 140)); },
  };

  // ---------------------------------------------------------------------------
  // Layout
  // ---------------------------------------------------------------------------
  function resize() {
    const header = document.querySelector('header.top');
    const controls = document.querySelector('.controls');
    const footer = document.querySelector('footer.credit');
    const chrome = header.offsetHeight + controls.offsetHeight + footer.offsetHeight + 60;
    const size = Math.max(220, Math.min(window.innerWidth - 24, window.innerHeight - chrome, 560));
    stage.style.width = size + 'px';
    stage.style.height = size + 'px';
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    canvas.width = Math.round(size * dpr);
    canvas.height = Math.round(size * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    state.cell = size / COLS;
  }
  window.addEventListener('resize', resize);

  // ---------------------------------------------------------------------------
  // Game setup
  // ---------------------------------------------------------------------------
  function speedForDay(idx) {
    const base = state.difficulty === 'easy' ? 260 : state.difficulty === 'fast' ? 160 : 210;
    return Math.max(90, base - idx * 12);
  }

  function newGame() {
    state.dayIdx = 0;
    state.hearts = MAX_HEARTS;
    state.score = 0;
    state.snake = [];
    state.growPending = 0;
    updateHud();
    showStory();
  }

  function startDay() {
    const day = DAYS[state.dayIdx];
    state.tickMs = speedForDay(state.dayIdx);
    state.remaining = day.items.slice();
    state.eatenToday = 0;
    state.items = [];
    state.popups = [];
    state.queue = [];
    placeSnake(Math.max(3, state.snake.length));
    spawnTargets();
    spawnDecoys(day.decoys);
    stage.classList.toggle('queasy', !!day.queasy);
    stage.style.setProperty('--wobble', '0.4');
    state.screen = 'play';
    state.acc = 0;
    state.lastT = performance.now();
    hideOverlay();
    updateHud();
  }

  function placeSnake(len) {
    // Lay the caterpillar out serpentine-style starting from the middle row,
    // head pointing right, folding onto the rows above if he's long.
    const y0 = Math.floor(ROWS / 2);
    const headX = Math.floor(COLS / 2) + 1;
    state.snake = [];
    for (let i = 0; i < len; i++) {
      const row = Math.floor(i / COLS);
      const k = i % COLS;
      const x = row % 2 === 0
        ? ((headX - k) % COLS + COLS) % COLS
        : ((headX - (COLS - 1) + k) % COLS + COLS) % COLS;
      state.snake.push({ x, y: ((y0 - row) % ROWS + ROWS) % ROWS });
    }
    state.dir = DIRS.right;
    state.queue = [];
  }

  function occupied(x, y) {
    if (state.snake.some((s) => s.x === x && s.y === y)) return true;
    if (state.items.some((it) => it.x === x && it.y === y)) return true;
    return false;
  }

  function freeCell() {
    const head = state.snake[0];
    for (let tries = 0; tries < 500; tries++) {
      const x = Math.floor(Math.random() * COLS);
      const y = Math.floor(Math.random() * ROWS);
      if (occupied(x, y)) continue;
      // Don't spawn right in front of the head (too easy / too surprising).
      if (head && Math.abs(x - head.x) + Math.abs(y - head.y) < 3) continue;
      return { x, y };
    }
    return null;
  }

  function spawnTargets() {
    const day = DAYS[state.dayIdx];
    const limit = day.onBoard || Infinity;
    while (state.remaining.length && state.items.filter((i) => i.target).length < limit) {
      const key = state.remaining.shift();
      const c = freeCell();
      if (!c) { state.remaining.unshift(key); break; }
      state.items.push({ ...c, key, target: true, born: performance.now() });
    }
  }

  function spawnDecoys(n) {
    const day = DAYS[state.dayIdx];
    const targets = new Set(day.items);
    const pool = (day.decoyPool || FRUIT.concat(TREATS)).filter((k) => !targets.has(k));
    for (let i = 0; i < n; i++) {
      const key = pool[Math.floor(Math.random() * pool.length)];
      const c = freeCell();
      if (!c) break;
      state.items.push({ ...c, key, target: false, born: performance.now() });
    }
  }

  // ---------------------------------------------------------------------------
  // Game loop
  // ---------------------------------------------------------------------------
  function frame(t) {
    requestAnimationFrame(frame);
    const dt = Math.min(100, t - (state.lastT || t));
    state.lastT = t;

    if (state.screen === 'play') {
      state.acc += dt;
      while (state.acc >= state.tickMs) {
        state.acc -= state.tickMs;
        step();
        if (state.screen !== 'play') break;
      }
    }
    draw(t);
  }

  function step() {
    // Consume the next queued direction that isn't a reversal.
    while (state.queue.length) {
      const d = state.queue.shift();
      if (d.x !== -state.dir.x || d.y !== -state.dir.y) { state.dir = d; break; }
    }
    const head = state.snake[0];
    const nx = (head.x + state.dir.x + COLS) % COLS;
    const ny = (head.y + state.dir.y + ROWS) % ROWS;

    // Self collision (the tail cell is fine if we're about to vacate it).
    const tailIdx = state.growPending > 0 ? state.snake.length : state.snake.length - 1;
    for (let i = 0; i < tailIdx; i++) {
      if (state.snake[i].x === nx && state.snake[i].y === ny) {
        loseHeart('Ouch! He bumped into himself.');
        return;
      }
    }

    state.snake.unshift({ x: nx, y: ny });
    if (state.growPending > 0) state.growPending--;
    else state.snake.pop();

    const idx = state.items.findIndex((it) => it.x === nx && it.y === ny);
    if (idx >= 0) eat(idx);
  }

  function eat(idx) {
    const item = state.items[idx];
    const day = DAYS[state.dayIdx];
    const food = FOODS[item.key];
    if (item.target) {
      state.items.splice(idx, 1);
      state.eatenToday++;
      state.growPending += day.grow;
      const pts = (day.queasy ? 15 : 10) * (state.dayIdx + 1);
      state.score += pts;
      popup(item.x, item.y, `+${pts}`);
      sfx.chomp();
      if (day.queasy) {
        const w = 0.4 + state.eatenToday * 0.35;
        stage.style.setProperty('--wobble', w.toFixed(2));
        stage.style.setProperty('--wobble-speed', Math.max(0.7, 2.2 - state.eatenToday * 0.14).toFixed(2) + 's');
      }
      spawnTargets();
      updateHud();
      if (!state.remaining.length && !state.items.some((i) => i.target)) {
        state.score += 50 * (state.dayIdx + 1);
        dayComplete();
      }
    } else {
      // Wrong food for today.
      state.items.splice(idx, 1);
      const msg = state.dayIdx === DAYS.length - 1
        ? `Not more ${food.name}! His tummy hurts.`
        : `Not a ${food.name} today!`;
      loseHeart(msg);
      // Replace the decoy so the board stays busy.
      if (state.screen === 'play') spawnDecoys(1);
    }
  }

  function popup(x, y, text) {
    state.popups.push({ x, y, text, t: performance.now() });
  }

  function loseHeart(reason) {
    state.hearts--;
    sfx.bad();
    stage.classList.remove('hurt');
    void stage.offsetWidth; // restart animation
    stage.classList.add('hurt');
    state.flashUntil = performance.now() + 500;
    updateHud();
    if (state.hearts <= 0) {
      gameOver(reason);
      return;
    }
    const head = state.snake[0];
    popup(head.x, head.y, '💔');
    showToast(reason);
    // Put him back in the middle, keep his length and today's progress.
    const len = state.snake.length;
    state.items = state.items.filter((it) => it.target);
    placeSnake(len);
    // Anything now under the re-laid caterpillar goes back into the queue.
    const under = (it) => state.snake.some((s) => s.x === it.x && s.y === it.y);
    state.items.filter(under).forEach((it) => state.remaining.unshift(it.key));
    state.items = state.items.filter((it) => !under(it));
    spawnTargets();
    spawnDecoys(DAYS[state.dayIdx].decoys);
    state.acc = -600; // brief grace period
  }

  function dayComplete() {
    stage.classList.remove('queasy');
    sfx.day();
    updateHud();
    const finished = DAYS[state.dayIdx];
    if (state.dayIdx === DAYS.length - 1) {
      startEnding();
      return;
    }
    state.dayIdx++;
    state.screen = 'story';
    showStory(finished.after);
  }

  function gameOver(reason) {
    state.screen = 'gameover';
    stage.classList.remove('queasy');
    saveBest();
    showOverlay(`
      <div class="big">😴</div>
      <h2>The caterpillar needs a nap</h2>
      <p>${escapeHtml(reason)}</p>
      <p>He got as far as <strong>${DAYS[state.dayIdx].name}</strong> with <strong>${state.score}</strong> points.</p>
      <p class="hint">Best so far: ${state.best}</p>
      <div class="row">
        <button class="btn" id="retryBtn">Try again</button>
        <button class="btn secondary" id="titleBtn">Title</button>
      </div>
    `);
    $('retryBtn').onclick = newGame;
    $('titleBtn').onclick = showTitle;
  }

  function saveBest() {
    if (state.score > state.best) {
      state.best = state.score;
      localStorage.setItem('vhc-best', String(state.best));
    }
  }

  // ---------------------------------------------------------------------------
  // Screens
  // ---------------------------------------------------------------------------
  function showOverlay(html, clear = false) {
    card.innerHTML = html;
    overlay.classList.toggle('clear', clear);
        overlay.hidden = false;
  }
  function hideOverlay() { overlay.hidden = true; }

  function showTitle() {
    state.screen = 'title';
    stage.classList.remove('queasy');
    dayBadge.textContent = 'Sunday';
    goalEl.textContent = 'A tiny egg lies on a leaf…';
    state.snake = [];
    state.items = [];
    showOverlay(`
      <div class="big">🥚🌙</div>
      <h1>The Very Hungry Caterpillar</h1>
      <p>One Sunday morning the warm sun came up and — <em>pop!</em> — out of a tiny egg came a tiny and very hungry caterpillar.</p>
      <p class="more">Steer him through a week of eating. Eat only <strong>today's food</strong> and don't bump into yourself!</p>
      <div class="row">
        <label class="sr-only" for="difficulty">Speed</label>
        <select class="btn secondary" id="difficulty">
          <option value="easy">🐌 Gentle</option>
          <option value="normal">🐛 Normal</option>
          <option value="fast">🦋 Speedy</option>
        </select>
        <button class="btn" id="startBtn">Start eating!</button>
      </div>
      <div class="row"><button class="btn small secondary" id="shareBtn2">📱 Share QR code</button></div>
      <p class="hint">Best score: ${state.best}</p>
    `);
    const sel = $('difficulty');
    sel.value = state.difficulty;
    sel.onchange = () => { state.difficulty = sel.value; };
    $('startBtn').onclick = () => { beep(600, 0.05); newGame(); };
    $('shareBtn2').onclick = openShare;
  }

  function showStory(afterPrev) {
    state.screen = 'story';
    const day = DAYS[state.dayIdx];
    dayBadge.textContent = day.name;
    goalEl.textContent = goalText();
    const foods = day.items.map((k) => FOODS[k].emoji || (k === 'plum' ? '🟣' : '🔴')).join(' ');
    showOverlay(`
      ${afterPrev ? `<p><em>${escapeHtml(afterPrev)}</em></p>` : ''}
      <h2>${day.name}</h2>
      <p>${escapeHtml(day.story)}</p>
      <div class="foods">${foods}</div>
      <p class="hint">${day.queasy
        ? 'Eat everything you can find. He may start to feel a little wobbly…'
        : state.dayIdx === DAYS.length - 1
          ? 'Find the one green leaf. Leave the junk food alone this time!'
          : `Eat ${day.items.length === 1 ? 'the' : 'all ' + day.items.length} ${foodPlural(day.items[0], day.items.length)}. Other food will give him a tummy ache.`}</p>
      <div class="row"><button class="btn" id="goBtn">Start ${day.name}</button></div>
    `);
    $('goBtn').onclick = startDay;
    $('goBtn').focus();
  }

  function foodPlural(key, n) {
    const name = FOODS[key].name;
    if (n === 1) return name;
    if (name.endsWith('y')) return name.slice(0, -1) + 'ies';
    return name + 's';
  }

  function goalText() {
    const day = DAYS[state.dayIdx];
    const total = day.items.length;
    if (day.queasy) return `Eat all ${total} treats · ${state.eatenToday}/${total}`;
    const icon = FOODS[day.items[0]].emoji || '🟣';
    return `Eat ${total} ${icon} · ${state.eatenToday}/${total}`;
  }

  function updateHud() {
    scoreEl.textContent = String(state.score);
    heartsEl.textContent = '❤'.repeat(state.hearts) + '♡'.repeat(MAX_HEARTS - state.hearts);
    if (state.screen === 'play' || state.screen === 'story' || state.screen === 'paused') {
      dayBadge.textContent = DAYS[state.dayIdx].name;
      goalEl.textContent = goalText();
    }
  }

  function togglePause() {
    if (state.screen === 'play') {
      state.screen = 'paused';
      showOverlay(`
        <div class="big">⏸</div>
        <h2>Paused</h2>
        <p>The caterpillar is having a little rest.</p>
        <div class="row">
          <button class="btn" id="resumeBtn">Keep eating</button>
          <button class="btn secondary" id="quitBtn">Quit to title</button>
        </div>
      `);
      $('resumeBtn').onclick = togglePause;
      $('quitBtn').onclick = () => { saveBest(); showTitle(); };
    } else if (state.screen === 'paused') {
      state.screen = 'play';
      state.acc = -400;
      hideOverlay();
    }
  }

  // ---------------------------------------------------------------------------
  // Ending: cocoon → butterfly
  // ---------------------------------------------------------------------------
  function startEnding() {
    state.screen = 'ending';
    saveBest();
    dayBadge.textContent = 'Two weeks later…';
    goalEl.textContent = 'He built a small house, called a cocoon…';
    state.ending = { t0: performance.now(), phase: 0, shown: false };
    state.items = [];
    hideOverlay();
    sfx.win();
  }

  function drawEnding(t) {
    const e = state.ending;
    const s = (t - e.t0) / 1000;
    const W = COLS * state.cell, H = ROWS * state.cell;
    const cx = W / 2, cy = H / 2;

    // Night sky fading in.
    const night = clamp(s / 1.5, 0, 1) * clamp((7 - s) / 1.5, 0, 1);
    if (night > 0) {
      ctx.fillStyle = `rgba(30, 32, 80, ${0.75 * night})`;
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = `rgba(255, 245, 200, ${night})`;
      ctx.beginPath(); ctx.arc(W * 0.82, H * 0.18, state.cell * 1.1, 0, Math.PI * 2); ctx.fill();
      for (let i = 0; i < 20; i++) {
        const sx = (i * 97) % W, sy = (i * 61) % (H * 0.6);
        const tw = 0.5 + 0.5 * Math.sin(t / 300 + i);
        ctx.fillStyle = `rgba(255,255,255,${night * tw})`;
        ctx.fillRect(sx, sy, 2, 2);
      }
    }

    // The caterpillar curls up and the cocoon wraps around him (0–3s).
    const wrap = clamp(s / 3, 0, 1);
    if (wrap < 1) {
      drawCaterpillarCurled(cx, cy, 1 - wrap);
    }
    if (s > 0.6 && s < 7.2) {
      const grow = clamp((s - 0.6) / 2.4, 0, 1);
      const crack = clamp((s - 6.2) / 1.0, 0, 1);
      const rx = state.cell * 2.4 * grow, ry = state.cell * 3.2 * grow;
      ctx.save();
      ctx.translate(cx, cy + state.cell * 0.5);
      ctx.globalAlpha = 1 - crack;
      ctx.fillStyle = '#8a5a2b';
      ctx.beginPath(); ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#5a3a18'; ctx.lineWidth = 2;
      for (let i = -2; i <= 2; i++) {
        ctx.beginPath(); ctx.ellipse(0, i * ry * 0.3, rx * (1 - Math.abs(i) * 0.08), ry * 0.18, 0, 0, Math.PI * 2); ctx.stroke();
      }
      // the little twig he hangs from
      ctx.strokeStyle = '#4b3b2a'; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(0, -ry); ctx.lineTo(0, -ry - state.cell * 1.2); ctx.lineTo(state.cell * 2, -ry - state.cell * 1.6); ctx.stroke();
      ctx.restore();
    }
    if (s > 3.2 && s < 6.4) {
      ctx.fillStyle = `rgba(255,255,255,${clamp((s - 3.2) / 0.5, 0, 1) * clamp((6.4 - s) / 0.5, 0, 1)})`;
      ctx.font = `700 ${state.cell * 0.9}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText('He stayed inside for more than two weeks…', cx, H * 0.86);
    }

    // Butterfly! (from 6.4s)
    if (s > 6.4) {
      const appear = clamp((s - 6.4) / 1.2, 0, 1);
      const flap = Math.sin(t / 160) * 0.5 + 0.5;
      const bob = Math.sin(t / 500) * state.cell * 0.4;
      drawButterfly(cx, H * 0.3 + bob, state.cell * 4.6 * (0.4 + 0.6 * appear), flap, appear);
      if (!e.shown && s > 7.6) {
        e.shown = true;
        dayBadge.textContent = '🦋';
        goalEl.textContent = 'He was a beautiful butterfly!';
        showOverlay(`
          <h2>…he was a beautiful butterfly! 🦋</h2>
          <p>He nibbled a hole in the cocoon and pushed his way out. Final score: <strong>${state.score}</strong>${state.score >= state.best ? ' — a new best!' : ` · Best: ${state.best}`}</p>
          <div class="row">
            <button class="btn" id="againBtn">Play again</button>
            <button class="btn secondary" id="endShareBtn">📱 Share QR</button>
          </div>
        `, true);
        $('againBtn').onclick = newGame;
        $('endShareBtn').onclick = openShare;
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Drawing
  // ---------------------------------------------------------------------------
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

  function drawBackground() {
    const W = COLS * state.cell, H = ROWS * state.cell;
    ctx.fillStyle = '#fdf6dc';
    ctx.fillRect(0, 0, W, H);
    // Soft collage-paper dots, Eric Carle style.
    ctx.fillStyle = 'rgba(120, 180, 70, 0.10)';
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        if ((x + y) % 2 === 0) ctx.fillRect(x * state.cell, y * state.cell, state.cell, state.cell);
      }
    }
    // Sun in the corner
    const g = ctx.createRadialGradient(W * 0.08, H * 0.08, 2, W * 0.08, H * 0.08, state.cell * 2.2);
    g.addColorStop(0, 'rgba(255, 220, 90, .55)');
    g.addColorStop(1, 'rgba(255, 220, 90, 0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }

  function cellCenter(x, y) {
    return [x * state.cell + state.cell / 2, y * state.cell + state.cell / 2];
  }

  function drawFood(key, px, py, size, t, born) {
    const food = FOODS[key];
    const age = born ? (t - born) / 1000 : 1;
    const pop = Math.min(1, age * 3);
    const bob = Math.sin(t / 350 + px) * size * 0.04;
    ctx.save();
    ctx.translate(px, py + bob);
    ctx.scale(pop, pop);
    if (food.emoji) {
      ctx.fillStyle = '#000';
      ctx.font = `${size * 0.82}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(food.emoji, 0, size * 0.04);
    } else if (food.draw === 'plum') {
      ctx.fillStyle = '#6a2c91';
      ctx.beginPath(); ctx.ellipse(0, size * 0.06, size * 0.34, size * 0.36, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.35)';
      ctx.beginPath(); ctx.ellipse(-size * 0.1, -size * 0.08, size * 0.1, size * 0.14, -0.5, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#5a3a18'; ctx.lineWidth = Math.max(1.5, size * 0.06);
      ctx.beginPath(); ctx.moveTo(0, -size * 0.28); ctx.lineTo(size * 0.06, -size * 0.45); ctx.stroke();
      ctx.fillStyle = '#5aa02c';
      ctx.beginPath(); ctx.ellipse(size * 0.16, -size * 0.4, size * 0.13, size * 0.06, -0.6, 0, Math.PI * 2); ctx.fill();
    } else if (food.draw === 'salami') {
      ctx.fillStyle = '#b8402f';
      ctx.beginPath(); ctx.arc(0, 0, size * 0.36, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#7a2a1c'; ctx.lineWidth = Math.max(1.5, size * 0.05); ctx.stroke();
      ctx.fillStyle = '#f6d7c0';
      [[-0.14, -0.1], [0.12, -0.14], [0.16, 0.12], [-0.08, 0.15], [0.02, 0.0], [-0.2, 0.06]].forEach(([dx, dy]) => {
        ctx.beginPath(); ctx.arc(dx * size, dy * size, size * 0.045, 0, Math.PI * 2); ctx.fill();
      });
    }
    ctx.restore();
  }

  function drawCaterpillar(t) {
    const n = state.snake.length;
    if (!n) return;
    const r = state.cell * 0.46;
    const hurt = t < state.flashUntil && Math.floor(t / 80) % 2 === 0;

    // Feet first, so they sit under the body.
    ctx.fillStyle = '#5a3a18';
    for (let i = 1; i < n; i++) {
      const [px, py] = cellCenter(state.snake[i].x, state.snake[i].y);
      const prev = state.snake[i - 1];
      const horiz = prev.y === state.snake[i].y;
      const wiggle = Math.sin(t / 120 + i) * r * 0.12;
      if (horiz) {
        ctx.fillRect(px - r * 0.5 + wiggle, py + r * 0.55, r * 0.3, r * 0.55);
        ctx.fillRect(px + r * 0.2 - wiggle, py + r * 0.55, r * 0.3, r * 0.55);
      } else {
        ctx.fillRect(px + r * 0.55, py - r * 0.5 + wiggle, r * 0.55, r * 0.3);
        ctx.fillRect(px + r * 0.55, py + r * 0.2 - wiggle, r * 0.55, r * 0.3);
      }
    }
    // Body segments, tail to head.
    for (let i = n - 1; i >= 1; i--) {
      const [px, py] = cellCenter(state.snake[i].x, state.snake[i].y);
      const rr = r * (0.82 + 0.18 * Math.min(1, (n - i) / 3));
      ctx.fillStyle = hurt ? '#cfd8c8' : (i % 2 ? '#5aa02c' : '#7cc243');
      ctx.beginPath(); ctx.arc(px, py, rr, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.22)';
      ctx.beginPath(); ctx.arc(px - rr * 0.3, py - rr * 0.35, rr * 0.3, 0, Math.PI * 2); ctx.fill();
    }
    // Head.
    const head = state.snake[0];
    const [hx, hy] = cellCenter(head.x, head.y);
    const d = state.dir;
    const hr = r * 1.05;
    ctx.fillStyle = hurt ? '#e8b4ad' : '#e2402f';
    ctx.beginPath(); ctx.arc(hx, hy, hr, 0, Math.PI * 2); ctx.fill();
    // antennae (purple, with little balls)
    ctx.strokeStyle = '#7c4dff'; ctx.lineWidth = Math.max(1.5, r * 0.14); ctx.lineCap = 'round';
    const ax = hx + d.x * hr * 0.4, ay = hy + d.y * hr * 0.4;
    const px = -d.y, py = d.x; // perpendicular
    [[1], [-1]].forEach(([s]) => {
      const bx = ax + px * s * hr * 0.55 + d.x * hr * 0.9;
      const by = ay + py * s * hr * 0.55 + d.y * hr * 0.9;
      ctx.beginPath(); ctx.moveTo(hx + px * s * hr * 0.35, hy + py * s * hr * 0.35); ctx.lineTo(bx, by); ctx.stroke();
      ctx.fillStyle = '#7c4dff'; ctx.beginPath(); ctx.arc(bx, by, r * 0.16, 0, Math.PI * 2); ctx.fill();
    });
    // eyes
    [[1], [-1]].forEach(([s]) => {
      const ex = hx + px * s * hr * 0.42 + d.x * hr * 0.2;
      const ey = hy + py * s * hr * 0.42 + d.y * hr * 0.2;
      ctx.fillStyle = '#d7e65a';
      ctx.beginPath(); ctx.ellipse(ex, ey, r * 0.26, r * 0.3, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#2d7d1e';
      ctx.beginPath(); ctx.arc(ex + d.x * r * 0.08, ey + d.y * r * 0.08, r * 0.12, 0, Math.PI * 2); ctx.fill();
    });
    // nose / mouth
    ctx.fillStyle = '#a52a1c';
    ctx.beginPath(); ctx.arc(hx + d.x * hr * 0.62, hy + d.y * hr * 0.62, r * 0.14, 0, Math.PI * 2); ctx.fill();
  }

  function drawCaterpillarCurled(cx, cy, alpha) {
    // A spiral of body segments, used while the cocoon wraps around him.
    const r = state.cell * 0.44;
    ctx.save();
    ctx.globalAlpha = alpha;
    const segs = Math.min(40, Math.max(12, state.snake.length));
    for (let i = segs - 1; i >= 0; i--) {
      const a = i * 0.55, rad = state.cell * 0.4 + i * state.cell * 0.075;
      const px = cx + Math.cos(a) * rad, py = cy + state.cell * 0.5 + Math.sin(a) * rad * 0.8;
      ctx.fillStyle = i === 0 ? '#e2402f' : (i % 2 ? '#5aa02c' : '#7cc243');
      ctx.beginPath(); ctx.arc(px, py, r * 0.9, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }

  function drawButterfly(cx, cy, size, flap, alpha) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(cx, cy);
    const sx = 0.35 + 0.65 * flap; // wings fold toward the body
    const wing = (side) => {
      ctx.save();
      ctx.scale(side * sx, 1);
      // upper wing
      let g = ctx.createRadialGradient(size * 0.45, -size * 0.25, size * 0.05, size * 0.45, -size * 0.25, size * 0.6);
      g.addColorStop(0, '#ffd23f'); g.addColorStop(0.45, '#ff6b35'); g.addColorStop(0.8, '#c1272d'); g.addColorStop(1, '#6a2c91');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.ellipse(size * 0.48, -size * 0.28, size * 0.5, size * 0.36, -0.5, 0, Math.PI * 2); ctx.fill();
      // lower wing
      g = ctx.createRadialGradient(size * 0.35, size * 0.3, size * 0.05, size * 0.35, size * 0.3, size * 0.45);
      g.addColorStop(0, '#9be564'); g.addColorStop(0.5, '#2a9d8f'); g.addColorStop(1, '#264653');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.ellipse(size * 0.36, size * 0.3, size * 0.36, size * 0.3, 0.6, 0, Math.PI * 2); ctx.fill();
      // spots
      ctx.fillStyle = 'rgba(255,255,255,.75)';
      [[0.6, -0.4, 0.07], [0.78, -0.2, 0.05], [0.45, 0.4, 0.06], [0.25, -0.1, 0.045]].forEach(([x, y, r]) => {
        ctx.beginPath(); ctx.arc(size * x, size * y, size * r, 0, Math.PI * 2); ctx.fill();
      });
      ctx.fillStyle = 'rgba(40,20,60,.6)';
      [[0.6, -0.4, 0.035], [0.45, 0.4, 0.03]].forEach(([x, y, r]) => {
        ctx.beginPath(); ctx.arc(size * x, size * y, size * r, 0, Math.PI * 2); ctx.fill();
      });
      ctx.restore();
    };
    wing(1); wing(-1);
    // body
    ctx.fillStyle = '#2b2b2b';
    ctx.beginPath(); ctx.ellipse(0, size * 0.05, size * 0.08, size * 0.55, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(0, -size * 0.55, size * 0.12, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#2b2b2b'; ctx.lineWidth = Math.max(1.5, size * 0.02); ctx.lineCap = 'round';
    [[-1], [1]].forEach(([s]) => {
      ctx.beginPath(); ctx.moveTo(0, -size * 0.62); ctx.quadraticCurveTo(s * size * 0.15, -size * 0.85, s * size * 0.28, -size * 0.9); ctx.stroke();
      ctx.beginPath(); ctx.arc(s * size * 0.28, -size * 0.9, size * 0.03, 0, Math.PI * 2); ctx.fill();
    });
    ctx.restore();
  }

  function drawPopups(t) {
    state.popups = state.popups.filter((p) => t - p.t < 900);
    for (const p of state.popups) {
      const k = (t - p.t) / 900;
      const [px, py] = cellCenter(p.x, p.y);
      ctx.globalAlpha = 1 - k;
      ctx.fillStyle = '#2b2b2b';
      ctx.font = `800 ${state.cell * 0.7}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(p.text, px, py - k * state.cell * 1.2);
      ctx.globalAlpha = 1;
    }
  }

  function draw(t) {
    drawBackground();
    if (state.screen === 'ending') { drawEnding(t); return; }
    if (state.screen === 'title') {
      // A little egg on a leaf while we wait on the title card.
      const [px, py] = cellCenter(COLS / 2 - 0.5, ROWS / 2 - 0.5);
      ctx.fillStyle = '#000';
      ctx.font = `${state.cell * 3}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('🍃', px, py + state.cell * 0.4);
      ctx.font = `${state.cell * 1.1}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`;
      ctx.fillText('🥚', px + state.cell * 0.2, py - state.cell * 0.3 + Math.sin(t / 600) * 2);
      return;
    }
    for (const it of state.items) {
      const [px, py] = cellCenter(it.x, it.y);
      if (it.target) {
        ctx.fillStyle = 'rgba(255, 230, 109, .45)';
        ctx.beginPath(); ctx.arc(px, py, state.cell * 0.5, 0, Math.PI * 2); ctx.fill();
      }
      drawFood(it.key, px, py, state.cell, t, it.born);
    }
    drawCaterpillar(t);
    drawPopups(t);
  }

  // ---------------------------------------------------------------------------
  // Input
  // ---------------------------------------------------------------------------
  function pushDir(name) {
    const d = DIRS[name];
    if (!d) return;
    if (state.screen !== 'play') return;
    const last = state.queue.length ? state.queue[state.queue.length - 1] : state.dir;
    if (d === last) return;
    if (d.x === -last.x && d.y === -last.y) return; // ignore reversals
    if (state.queue.length < 3) state.queue.push(d);
  }

  const KEYS = {
    ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
    w: 'up', s: 'down', a: 'left', d: 'right', W: 'up', S: 'down', A: 'left', D: 'right',
  };
  window.addEventListener('keydown', (e) => {
    if (e.target && /^(INPUT|SELECT|TEXTAREA)$/.test(e.target.tagName)) return;
    if (KEYS[e.key]) {
      e.preventDefault();
      if (state.screen === 'story') { startDay(); }
      pushDir(KEYS[e.key]);
    } else if (e.key === ' ' || e.key === 'p' || e.key === 'P' || e.key === 'Escape') {
      if (!$('qrModal').hidden) { closeShare(); return; }
      if (state.screen === 'play' || state.screen === 'paused') { e.preventDefault(); togglePause(); }
    } else if (e.key === 'Enter') {
      const btn = card.querySelector('button.btn');
      if (btn && !overlay.hidden) btn.click();
    }
  });

  // On-screen d-pad
  document.querySelectorAll('.dpad button[data-dir]').forEach((b) => {
    const go = (e) => { e.preventDefault(); if (state.screen === 'story') startDay(); pushDir(b.dataset.dir); };
    b.addEventListener('pointerdown', go);
  });

  // Swipe on the board
  let touchStart = null;
  stage.addEventListener('touchstart', (e) => {
    if (e.touches.length !== 1) return;
    touchStart = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  }, { passive: true });
  stage.addEventListener('touchmove', (e) => {
    if (!touchStart || e.touches.length !== 1) return;
    const dx = e.touches[0].clientX - touchStart.x;
    const dy = e.touches[0].clientY - touchStart.y;
    if (Math.abs(dx) < 22 && Math.abs(dy) < 22) return;
    if (Math.abs(dx) > Math.abs(dy)) pushDir(dx > 0 ? 'right' : 'left');
    else pushDir(dy > 0 ? 'down' : 'up');
    touchStart = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    if (e.cancelable) e.preventDefault();
  }, { passive: false });
  stage.addEventListener('touchend', () => { touchStart = null; });

  stage.addEventListener('animationend', (e) => { if (e.animationName === 'hurt') stage.classList.remove('hurt'); });

  $('pauseBtn').onclick = togglePause;
  $('soundBtn').onclick = () => {
    state.muted = !state.muted;
    localStorage.setItem('vhc-muted', state.muted ? '1' : '0');
    $('soundBtn').textContent = state.muted ? '🔇' : '🔊';
    if (!state.muted) beep(660, 0.06);
  };
  $('soundBtn').textContent = state.muted ? '🔇' : '🔊';
  $('shareBtn').onclick = openShare;

  // Pause automatically when the tab is hidden.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && state.screen === 'play') togglePause();
  });

  // ---------------------------------------------------------------------------
  // Share: QR code of this page's URL
  // ---------------------------------------------------------------------------
  function shareUrl() {
    return location.origin + location.pathname;
  }

  function renderQr(url) {
    const qrCanvas = $('qrCanvas');
    const q = qrcode(0, 'M');
    q.addData(url);
    q.make();
    const count = q.getModuleCount();
    const margin = 4;
    const scale = 8;
    const px = (count + margin * 2) * scale;
    qrCanvas.width = px; qrCanvas.height = px;
    const c = qrCanvas.getContext('2d');
    c.fillStyle = '#ffffff';
    c.fillRect(0, 0, px, px);
    c.fillStyle = '#1b1b1b';
    for (let r = 0; r < count; r++) {
      for (let col = 0; col < count; col++) {
        if (q.isDark(r, col)) c.fillRect((col + margin) * scale, (r + margin) * scale, scale, scale);
      }
    }
  }

  function openShare() {
    const url = shareUrl();
    const wasPlaying = state.screen === 'play';
    if (wasPlaying) togglePause();
    try { renderQr(url); } catch (err) { console.error(err); }
    $('shareUrl').textContent = url;
    $('nativeShareBtn').hidden = !navigator.share;
    $('qrModal').hidden = false;
  }
  function closeShare() { $('qrModal').hidden = true; }

  $('closeQrBtn').onclick = closeShare;
  $('qrModal').addEventListener('click', (e) => { if (e.target === $('qrModal')) closeShare(); });
  $('copyBtn').onclick = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl());
      showToast('Link copied!');
    } catch (_) {
      showToast('Long-press the link to copy it.');
    }
  };
  $('downloadQrBtn').onclick = () => {
    const a = document.createElement('a');
    a.href = $('qrCanvas').toDataURL('image/png');
    a.download = 'hungry-caterpillar-qr.png';
    document.body.appendChild(a);
    a.click();
    a.remove();
  };
  $('nativeShareBtn').onclick = async () => {
    try {
      await navigator.share({ title: 'The Very Hungry Caterpillar Game', text: 'Come play the hungry caterpillar game!', url: shareUrl() });
    } catch (_) { /* user cancelled */ }
  };

  let toastTimer = 0;
  function showToast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('show'), 1800);
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  }

  // ---------------------------------------------------------------------------
  // Boot
  // ---------------------------------------------------------------------------
  resize();
  showTitle();
  requestAnimationFrame(frame);
  if (/[?#]share/.test(location.search + location.hash)) openShare();
  if (/[?&]debug/.test(location.search)) window.__vhc = { state, DAYS, FOODS, COLS, ROWS, startDay, startEnding };
})();
