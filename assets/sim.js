/* A toy version of RoboAda for the page's opening demo (2 action axes: horizontal, vertical).
   Same structure as the method: hindsight labels, three body hypotheses per axis (nominal, affine, state-dependent),
   prequential evidence with forgetting and tempering, commands that minimize the expected tracking error, and a
   latency test on the first chunk. Illustration only: the results on the page come from the paper. */
(function (root) {
  "use strict";
  const ALPHA = 0.7, BETA = 0.0042, H = 16, TOL = 0.015, BUDGET = 360, SPEED = 0.55;
  const GAIN = BETA / (1 - ALPHA); // steady-state motion per step of a unit command
  const WAYPOINTS = [[0.55, 0.32], [0.55, 0.16, "grasp"], [0.55, 0.42], [0.95, 0.42], [0.95, 0.24, "release"]];
  const START = [0.35, 0.55];
  const CHANGES = {
    none: {},
    load: { load: -0.35 },      // pulls the hand down while it holds the object
    motor: { gain: 0.45 },      // commands are executed at 45%
    lag: { latency: 6 },        // every command arrives six steps late
  };

  function rng(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
  function gauss(r) { const u = Math.max(r(), 1e-9), v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }

  // ---------------------------------------------------------------- small linear algebra (n <= 3)
  function inv(A) {
    const n = A.length, M = A.map((r, i) => r.concat(Array.from({ length: n }, (_, j) => (i === j ? 1 : 0))));
    for (let c = 0; c < n; c++) {
      let p = c; for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
      [M[c], M[p]] = [M[p], M[c]];
      const d = M[c][c]; for (let j = 0; j < 2 * n; j++) M[c][j] /= d;
      for (let r = 0; r < n; r++) if (r !== c) { const f = M[r][c]; for (let j = 0; j < 2 * n; j++) M[r][j] -= f * M[c][j]; }
    }
    return M.map((r) => r.slice(n));
  }
  const dot = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0);
  const mv = (M, v) => M.map((r) => dot(r, v));

  // ---------------------------------------------------------------- one Bayesian linear body model per axis
  function Body(k) { // k = 2: [x, 1] (affine); k = 3: [x, 1, holding] (state-dependent)
    const prec = k === 2 ? [4, 100] : [4, 100, 100], mu0 = k === 2 ? [1, 0] : [1, 0, 0];
    const s2 = 0.03 * 0.03, lam = Math.pow(0.6, 1 / H);
    const m = { k, G: mu0.map(() => mu0.map(() => 0)), xi: mu0.map(() => 0), mu: mu0.slice(), S: null };
    m.refit = () => {
      const A = m.G.map((r, i) => r.map((v, j) => v / s2 + (i === j ? prec[i] : 0)));
      m.S = inv(A);
      m.mu = mv(m.S, m.xi.map((v, i) => v / s2 + prec[i] * mu0[i]));
    };
    m.phi = (x, h) => (k === 2 ? [x, 1] : [x, 1, h]);
    m.predict = (x, h) => { const f = m.phi(x, h); return [dot(f, m.mu), s2 + dot(f, mv(m.S, f))]; };
    m.learn = (x, h, nu) => {
      const f = m.phi(x, h);
      for (let i = 0; i < k; i++) { for (let j = 0; j < k; j++) m.G[i][j] = lam * m.G[i][j] + f[i] * f[j]; m.xi[i] = lam * m.xi[i] + f[i] * nu; }
    };
    m.terms = (h) => { // gain a, offset b, variance of a, covariance of a and b
      const b = m.mu[1] + (k === 3 ? h * m.mu[2] : 0), c = m.S[0][1] + (k === 3 ? h * m.S[0][2] : 0);
      return [m.mu[0], b, m.S[0][0], c];
    };
    m.refit();
    return m;
  }

  // ---------------------------------------------------------------- one episode, advanced step by step
  function Episode(change, adapt, seed) {
    const ch = Object.assign({ gain: 1, load: 0, latency: 0 }, CHANGES[change]);
    const r = rng(seed || 7);
    const e = {
      pos: START.slice(), y: [0, 0], t: 0, wp: 0, holding: false, done: false, success: false, trace: [START.slice()],
      queue: Array.from({ length: ch.latency }, () => [0, 0]), chunk: [], plan: null, history: [], skip: 0,
      bodies: adapt ? [0, 1].map(() => [Body(2), Body(3)]) : null, L: [[0, 0, 0], [0, 0, 0]], pis: [], lagDone: !adapt,
      aHist: [], yHist: [], pending: [],
    };
    const pi = (j) => { const z = e.L[j].map((v) => v + Math.log(1 / 3)), mx = Math.max(...z), w = z.map((v) => Math.exp(v - mx)); const s = w[0] + w[1] + w[2]; return w.map((v) => v / s); };

    function plan() { // the frozen policy: reach the current waypoint by the end of the chunk on the nominal arm
      const w = WAYPOINTS[e.wp];
      const cmd = [0, 1].map((j) => Math.max(-SPEED, Math.min(SPEED, (w[j] - e.pos[j]) / (GAIN * H))));
      return Array.from({ length: H }, () => cmd.slice());
    }
    function correct(p) {
      if (!adapt || !e.history.length || e.skip > 0) return p; // first chunk as planned; latency: skip only
      return p.map((row) => row.map((pj, j) => {
        const w = pi(j), h = e.holding ? 1 : 0;
        let num = w[0] * pj, den = w[0];
        e.bodies[j].forEach((m, k) => { const [a, b, v, c] = m.terms(h); num += w[k + 1] * (a * (pj - b) - c); den += w[k + 1] * (a * a + v); });
        return Math.max(-1, Math.min(1, num / Math.max(den, 0.09)));
      }));
    }
    function lagTest() { // regress the motion on the commands at lags 0..10 (first 16 steps)
      const N = 16, M = 10, rss = [];
      for (let lag = 0; lag <= M; lag++) {
        let tot = 0;
        for (let j = 0; j < 2; j++) {
          const X = [], Y = [];
          for (let t = 1; t < N; t++) { const a = t - lag >= 0 ? e.aHist[t - lag][j] : 0; X.push([a, 1]); Y.push(e.yHist[t][j] - ALPHA * e.yHist[t - 1][j]); }
          const G = [[0, 0], [0, 0]], g = [0, 0];
          X.forEach((x, i) => { G[0][0] += x[0] * x[0] + 1e-9; G[0][1] += x[0]; G[1][0] += x[0]; G[1][1] += 1; g[0] += x[0] * Y[i]; g[1] += Y[i]; });
          const th = mv(inv(G), g); tot += X.reduce((s, x, i) => s + (Y[i] - dot(x, th)) ** 2, 0) / X.length;
        }
        rss.push(tot);
      }
      const L = rss.indexOf(Math.min(...rss));
      if (L >= 2 && rss[L] / Math.max(rss[0], 1e-12) < 0.45) e.skip = L;
      e.lagDone = true;
    }
    function endChunk() { // hindsight labels of the chunk that just ended -> evidence, then refit
      if (!adapt || !e.pending.length) return;
      const ll = [[0, 0, 0], [0, 0, 0]], s2 = 0.03 * 0.03;
      e.pending.forEach(({ x, h, nu }) => {
        for (let j = 0; j < 2; j++) {
          ll[j][0] += -0.5 * ((nu[j] - x[j]) ** 2 / s2 + Math.log(2 * Math.PI * s2));
          e.bodies[j].forEach((m, k) => { const [mu, v] = m.predict(x[j], h); ll[j][k + 1] += -0.5 * ((nu[j] - mu) ** 2 / v + Math.log(2 * Math.PI * v)); });
        }
      });
      const f = Math.pow(0.6, e.pending.length / H);
      for (let j = 0; j < 2; j++) for (let k = 0; k < 3; k++) e.L[j][k] = f * e.L[j][k] + 0.25 * ll[j][k];
      e.pending.forEach(({ x, h, nu }) => { for (let j = 0; j < 2; j++) e.bodies[j].forEach((m) => m.learn(x[j], h, nu[j])); });
      for (let j = 0; j < 2; j++) e.bodies[j].forEach((m) => m.refit());
      const p0 = pi(0), p1 = pi(1); e.pis.push(p0.map((v, k) => (v + p1[k]) / 2));
      e.pending = [];
      if (!e.lagDone && e.aHist.length >= 16) lagTest();
    }
    function newChunk() {
      endChunk();
      const w = WAYPOINTS[e.wp];
      if (Math.hypot(w[0] - e.pos[0], w[1] - e.pos[1]) < TOL) { // waypoint reached
        if (w[2] === "grasp") e.holding = true;
        if (w[2] === "release") { e.holding = false; e.done = e.success = true; return; }
        e.wp += 1;
      }
      const p = plan(), c = correct(p);
      e.plan = p; e.chunk = c.slice(adapt ? e.skip : 0);
      e.history.push(1);
    }
    e.step = () => {
      if (e.done) return;
      if (e.t >= BUDGET) { e.done = true; return; }
      if (!e.chunk.length) { newChunk(); if (e.done) return; }
      const a = e.chunk.shift();
      let u = a.map((v) => v * ch.gain);
      if (ch.latency) { e.queue.push(u); u = e.queue.shift(); }
      if (e.holding) u[1] += ch.load;
      u = u.map((v) => v + 0.02 * gauss(r));
      e.y = e.y.map((v, j) => ALPHA * v + u[j]);
      e.pos = e.pos.map((v, j) => v + BETA * e.y[j]);
      e.aHist.push(a.slice()); e.yHist.push(e.y.slice());
      e.pending.push({ x: a.slice(), h: e.holding ? 1 : 0, nu: u.slice() }); // exact hindsight label on the toy arm
      e.trace.push(e.pos.slice());
      e.t += 1;
    };
    e.run = () => { while (!e.done) e.step(); return e; };
    return e;
  }

  root.RoboAdaToy = { Episode, CHANGES, WAYPOINTS, START, BUDGET };
  if (typeof module !== "undefined") module.exports = root.RoboAdaToy;
})(typeof window !== "undefined" ? window : globalThis);
