/* "How it works": RoboAda's loop, animated chunk by chunk on a robot whose command gain silently dropped to 0.5.
   The numbers follow the method: prequential weights per chunk, the fitted gain of H1 after each chunk (medians from the
   paper's identification runs under gain 0.5), and the cautious command x = sum pi a (p - b) / sum pi (a^2 + var). */
(function () {
  "use strict";
  const svg = document.getElementById("anim-svg");
  if (!svg) return;
  const NS = "http://www.w3.org/2000/svg";
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const C = {
    ink: "#1e2530", muted: "#5b6472", faint: "#8b939e", rule: "#d5dbe3", gray: "#f2f3f5", grayStroke: "#c9cdd2",
    ours: "#4c72b0", panelBlue: "#f3f7fd", strokeBlue: "#7091c0", fillBlue: "#e6eefa", cream: "#fef1cc",
    creamStroke: "#d6b95c", label: "#b07e10", h0: "#c4c4c4", h1: "#f1d58a", h2: "#4c72b0", plan: "#9aa1a9",
  };

  /* ---------------------------------------------------------------- the story, in numbers */
  const NCH = 4, TRUE_GAIN = 0.5, HOLD = 3.0;
  const PHASES = [["plan", "Plan", 1.2], ["act", "Act", 1.3], ["exec", "Execute", 1.8], ["label", "Label", 1.8], ["weigh", "Weigh", 2.0]];
  const TC = PHASES.reduce((s, p) => s + p[2], 0), TOTAL = NCH * TC + HOLD;
  const PI = [[1 / 3, 1 / 3, 1 / 3], [0.3, 0.38, 0.32], [0.14, 0.36, 0.5], [0.07, 0.28, 0.65], [0.06, 0.26, 0.68]];
  const GAIN = [1.0, 0.71, 0.6, 0.53, 0.5];
  const FACTOR = PI.map((w, k) => {
    if (k === 0) return 1;
    const a = GAIN[k], v = 0.01, w0 = w[0];
    return (w0 + (1 - w0) * a) / (w0 + (1 - w0) * (a * a + v));
  });
  const REACH = FACTOR.map((f) => Math.min(1, TRUE_GAIN * f));
  const H = 8;
  const hash = (n) => { const s = Math.sin(n * 12.9898) * 43758.5453; return 2 * (s - Math.floor(s)) - 1; };
  const PLAN = Array.from({ length: NCH }, (_, k) => Array.from({ length: H }, (_, i) => 0.22 + 0.3 * Math.sin(Math.PI * (i + 0.6) / (H + 0.4)) + 0.05 * hash(k * 31 + i)));
  const CMD = PLAN.map((p, k) => p.map((v) => v * FACTOR[k]));
  const NU = CMD.map((x, k) => x.map((v, i) => TRUE_GAIN * v + 0.03 * hash(k * 17 + i + 3)));

  /* ---------------------------------------------------------------- helpers */
  const ease = (q) => (q <= 0 ? 0 : q >= 1 ? 1 : 1 - Math.pow(1 - q, 3));
  const clamp = (q) => Math.max(0, Math.min(1, q));
  const lerp = (a, b, q) => a + (b - a) * q;
  function el(tag, attrs, parent) {
    const e = document.createElementNS(NS, tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }
  function text(parent, x, y, str, attrs) {
    const t = el("text", Object.assign({ x, y }, attrs || {}), parent);
    t.textContent = str;
    return t;
  }
  const ICONS = {
    snow: "M12 2.5v19M3.8 7.2l16.4 9.6M3.8 16.8l16.4-9.6M9.6 3.8 12 6.2l2.4-2.4M9.6 20.2 12 17.8l2.4 2.4",
    eyeOff: "M2.5 12s3.4-6 9.5-6c2 0 3.7.6 5.1 1.5M21.5 12s-1.2 2.1-3.4 3.8M9.9 17.6c.7.2 1.4.3 2.1.3M3.5 3.5l17 17M9.6 9.7a3.2 3.2 0 0 0 4.6 4.5",
    gauge: "M3.5 17.5a8.5 8.5 0 1 1 17 0M12 17.5 7.6 12.4",
  };
  function icon(parent, name, x, y, size, color) {
    return el("path", { d: ICONS[name], transform: `translate(${x} ${y}) scale(${size / 24})`, fill: "none", stroke: color,
      "stroke-width": (1.8 * 24) / size, "stroke-linecap": "round", "stroke-linejoin": "round" }, parent);
  }
  function stepBadge(parent, x, y, n, fill, color) {
    el("circle", { cx: x, cy: y, r: 11, fill }, parent);
    text(parent, x, y + 4.5, String(n), { "text-anchor": "middle", "font-size": 13, "font-weight": 700, fill: color });
  }

  /* ---------------------------------------------------------------- layouts */
  const LAND = {
    W: 1040, H: 652, fs: 1,
    policy: { x: 0, y: 24, w: 220, h: 300 }, act: { x: 296, y: 24, w: 350, h: 300 }, robot: { x: 722, y: 24, w: 318, h: 300 },
    info: { x: 0, y: 380, w: 220, h: 262 }, post: { x: 296, y: 380, w: 350, h: 262 }, labels: { x: 722, y: 380, w: 318, h: 262 },
  };
  const PORT = (function () {
    const w = 560, g = 64, b = {}; let y = 10;
    [["policy", 250], ["act", 270], ["robot", 300], ["labels", 272], ["post", 262]].forEach(([k, h]) => { b[k] = { x: 0, y, w, h }; y += h + g; });
    return Object.assign({ W: w + 46, H: y - g + 10, fs: 1.22 }, b);
  })();

  let R = null, layout = null;

  function build(Lo) {
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    svg.setAttribute("viewBox", `0 0 ${Lo.W} ${Lo.H}`);
    const fs = Lo.fs, port = Lo === PORT;
    const r = { groups: {}, arrows: {} };
    const defs = el("defs", {}, svg);
    const mk = el("marker", { id: "ah", viewBox: "0 0 10 10", refX: 8.5, refY: 5, markerWidth: 7, markerHeight: 7, orient: "auto-start-reverse" }, defs);
    el("path", { d: "M0 0 10 5 0 10Z", fill: C.ink }, mk);
    const cp = el("clipPath", { id: "frameclip" }, defs);

    // ---------------- arrows (drawn first, under the blocks)
    const A = el("g", {}, svg);
    function arrow(key, pts, label, lx, ly, anchor) {
      const d = "M" + pts.map((p) => p.join(" ")).join(" L");
      const g = el("g", {}, A);
      const path = el("path", { d, fill: "none", stroke: C.ink, "stroke-width": 1.6, "marker-end": "url(#ah)" }, g);
      const t = text(g, lx, ly, label, { "font-size": 13.5 * fs, fill: C.muted, "text-anchor": anchor || "middle" });
      const dot = el("circle", { r: 5.5, fill: C.ours, opacity: 0 }, g);
      r.arrows[key] = { g, path, dot, t, len: 0 };
    }
    const P = Lo.policy, Ac = Lo.act, Ro = Lo.robot, La = Lo.labels, Po = Lo.post;
    if (!port) {
      const ym = P.y + P.h / 2;
      arrow("pa", [[P.x + P.w + 4, ym], [Ac.x - 4, ym]], "plan p", (P.x + P.w + Ac.x) / 2, ym - 10);
      arrow("ar", [[Ac.x + Ac.w + 4, ym], [Ro.x - 4, ym]], "commands", (Ac.x + Ac.w + Ro.x) / 2, ym - 10);
      const xm = Ro.x + Ro.w / 2;
      arrow("rl", [[xm, Ro.y + Ro.h + 4], [xm, La.y - 4]], "proprioception", xm + 10, (Ro.y + Ro.h + La.y) / 2 + 5, "start");
      const yl = La.y + La.h / 2;
      arrow("lp", [[La.x - 4, yl], [Po.x + Po.w + 4, yl]], "labels", (La.x + Po.x + Po.w) / 2, yl - 10);
      const xp = Po.x + Po.w / 2;
      arrow("pc", [[xp, Po.y - 4], [xp, Ac.y + Ac.h + 4]], "posterior π", xp + 10, (Po.y + Ac.y + Ac.h) / 2 + 5, "start");
    } else {
      const xm = P.w / 2;
      arrow("pa", [[xm, P.y + P.h + 4], [xm, Ac.y - 4]], "plan p", xm + 12, (P.y + P.h + Ac.y) / 2 + 6, "start");
      arrow("ar", [[xm, Ac.y + Ac.h + 4], [xm, Ro.y - 4]], "commands", xm + 12, (Ac.y + Ac.h + Ro.y) / 2 + 6, "start");
      arrow("rl", [[xm, Ro.y + Ro.h + 4], [xm, La.y - 4]], "proprioception", xm + 12, (Ro.y + Ro.h + La.y) / 2 + 6, "start");
      arrow("lp", [[xm, La.y + La.h + 4], [xm, Po.y - 4]], "labels", xm + 12, (La.y + La.h + Po.y) / 2 + 6, "start");
      const xr = Po.w + 26;
      arrow("pc", [[Po.w + 4, Po.y + Po.h / 2], [xr, Po.y + Po.h / 2], [xr, Ac.y + Ac.h / 2], [Ac.w + 4, Ac.y + Ac.h / 2]], "", 0, 0);
    }

    function panel(key, b, fill, stroke) {
      const g = el("g", { transform: `translate(${b.x} ${b.y})` }, svg);
      el("rect", { x: 0, y: 0, width: b.w, height: b.h, rx: 12, fill, stroke, "stroke-width": 1.2 }, g);
      r.groups[key] = g;
      g.style.transition = "opacity 0.35s ease";
      return g;
    }

    // ---------------- policy
    {
      const b = P, g = panel("policy", b, C.gray, C.grayStroke);
      const tt = text(g, 16, 32, "Frozen WAM / VLA", { "font-size": 16 * fs, "font-weight": 650, fill: C.ink });
      icon(g, "snow", 16 + tt.getComputedTextLength() + 8, 32 - 15 * fs, 18 * fs, C.faint);
      const im = 92;
      el("rect", { x: 16, y: 48, width: im, height: im, rx: 6 }, cp);
      cp.setAttribute("clipPathUnits", "userSpaceOnUse");
      el("image", { href: "assets/img/frame.jpg", x: 16, y: 48, width: im, height: im, "clip-path": "url(#frameclip)", preserveAspectRatio: "xMidYMid slice" }, g);
      text(g, 16 + im + 12, 66, "camera image", { "font-size": 12.5 * fs, fill: C.faint });
      text(g, 16 + im + 12, 88, "“put the bowl", { "font-size": 14 * fs, fill: C.ink, "font-family": "Newsreader, Georgia, serif", "font-style": "italic" });
      text(g, 16 + im + 12, 108, "on the stove”", { "font-size": 14 * fs, fill: C.ink, "font-family": "Newsreader, Georgia, serif", "font-style": "italic" });
      text(g, 16, 168, "plan p for the next chunk", { "font-size": 13 * fs, fill: C.muted });
      const bx = 16, bw = b.w - 32, base = b.h - 18, sc = (base - 182) / 0.62, slot = bw / H;
      el("line", { x1: bx, x2: bx + bw, y1: base + 0.5, y2: base + 0.5, stroke: C.grayStroke }, g);
      r.planBars = Array.from({ length: H }, (_, i) => el("rect", { x: bx + i * slot + slot * 0.18, width: slot * 0.64, y: base, height: 0, fill: C.plan, rx: 1.5 }, g));
      r.planGeom = { base, sc };
    }

    // ---------------- act
    {
      const b = Ac, g = panel("act", b, C.panelBlue, C.strokeBlue);
      el("path", { d: `M0 12 a12 12 0 0 1 12 -12 H${b.w - 12} a12 12 0 0 1 12 12 V40 H0Z`, fill: C.ours }, g);
      stepBadge(g, 22, 20, 3, "#fff", C.ours);
      text(g, 42, 26, "Act under the posterior", { "font-size": 16 * fs, "font-weight": 650, fill: "#fff" });
      const f = text(g, 16, 70, "", { "font-size": 15 * fs, fill: C.ink, "font-family": "Newsreader, Georgia, serif" });
      f.innerHTML = '<tspan font-style="italic">x</tspan> = arg min<tspan font-size="0.72em" dy="4" font-style="italic">x</tspan><tspan dy="-4">  E</tspan><tspan font-size="0.72em" dy="4">π</tspan><tspan dy="-4"> [ (</tspan><tspan font-style="italic">ν</tspan>(<tspan font-style="italic">x</tspan>) − <tspan font-style="italic">p</tspan>)² ]';
      r.factor = text(g, b.w - 16, 70, "", { "font-size": 15 * fs, "text-anchor": "end", fill: C.ours, "font-weight": 650 });
      const bx = 16, bw = b.w - 32, base = b.h - 44, sc = (base - 92) / 1.15, slot = bw / H;
      el("line", { x1: bx, x2: bx + bw, y1: base + 0.5, y2: base + 0.5, stroke: C.rule }, g);
      r.cmdBars = [], r.cmdPlan = [];
      for (let i = 0; i < H; i++) {
        r.cmdBars.push(el("rect", { x: bx + i * slot + slot * 0.2, width: slot * 0.6, y: base, height: 0, fill: C.ours, rx: 1.5 }, g));
        r.cmdPlan.push(el("rect", { x: bx + i * slot + slot * 0.2, width: slot * 0.6, y: base, height: 0, fill: "none", stroke: C.ink, "stroke-width": 1.2, "stroke-dasharray": "3 2.5", rx: 1.5 }, g));
      }
      r.cmdGeom = { base, sc };
      const ly = b.h - 16;
      el("rect", { x: 16, y: ly - 10, width: 14, height: 11, fill: "none", stroke: C.ink, "stroke-dasharray": "3 2.5" }, g);
      text(g, 36, ly, "plan p", { "font-size": 13 * fs, fill: C.muted });
      el("rect", { x: 100 * fs, y: ly - 10, width: 14, height: 11, fill: C.ours }, g);
      text(g, 100 * fs + 20, ly, "command x sent to the robot", { "font-size": 13 * fs, fill: C.muted });
    }

    // ---------------- robot
    {
      const b = Ro, g = panel("robot", b, "#ffffff", C.grayStroke);
      text(g, 16, 32, "Robot", { "font-size": 16 * fs, "font-weight": 650, fill: C.ink });
      const bg = el("g", {}, g);
      const pill = el("rect", { y: 14, height: 26 * fs, rx: 13 * fs, fill: "rgba(30,37,48,0.84)" }, bg);
      const btx = text(bg, 0, 14 + 18 * fs, "hidden: half the command gain", { "font-size": 13 * fs, fill: "#fff" });
      const bw = btx.getComputedTextLength() + 26 * fs + 22;
      pill.setAttribute("x", b.w - bw - 12); pill.setAttribute("width", bw);
      btx.setAttribute("x", b.w - bw - 12 + 12 + 22 * fs);
      icon(bg, "eyeOff", b.w - bw - 12 + 9, 14 + 4 * fs, 18 * fs, "#fff");
      const yt = b.h - 64;
      el("rect", { x: 1, y: yt, width: b.w - 2, height: 18, fill: "#ece0ca" }, g);
      el("line", { x1: 1, x2: b.w - 1, y1: yt, y2: yt, stroke: "#cbb38a", "stroke-width": 1.4 }, g);
      // two links of length L; the hand moves below the shoulder from about half to almost full reach
      const DY = 32, Lfull = Math.min(140, (Math.hypot(b.w - 112, DY)) / 1.94);
      const span = Math.sqrt((1.94 * Lfull) ** 2 - DY * DY), x0 = Math.max(56, (b.w - span) / 2 - 12);
      const B = [x0, yt - 72], S = [x0 + Math.sqrt((1.04 * Lfull) ** 2 - DY * DY), yt - 72 + DY], E = [x0 + span, yt - 72 + DY];
      r.arm = { B, S, E, L1: Lfull, L2: Lfull };
      el("rect", { x: B[0] - 16, y: B[1] - 4, width: 32, height: yt - B[1] + 4, rx: 5, fill: "#f4f6f8", stroke: "#a9b2bd" }, g);
      el("path", { d: `M${S[0]} ${S[1] + 26} H${E[0]}`, stroke: C.faint, "stroke-dasharray": "4 5", "stroke-width": 1.3 }, g);
      const ghost = el("g", { transform: `translate(${E[0]} ${E[1]})`, opacity: 0.55 }, g);
      el("rect", { x: -17, y: 4, width: 34, height: 9, rx: 3, fill: "none", stroke: C.ink, "stroke-dasharray": "3 2.5" }, ghost);
      el("path", { d: "M-11 13v14M11 13v14", stroke: C.ink, "stroke-dasharray": "3 2.5", "stroke-width": 1.3 }, ghost);
      text(g, E[0], yt + 14, "planned end", { "font-size": 12 * fs, fill: C.muted, "text-anchor": "middle" });
      r.link1 = el("line", { stroke: "#a9b2bd", "stroke-width": 21, "stroke-linecap": "round" }, g);
      r.link1in = el("line", { stroke: "#f6f8fa", "stroke-width": 18.5, "stroke-linecap": "round" }, g);
      r.link2 = el("line", { stroke: "#a9b2bd", "stroke-width": 17, "stroke-linecap": "round" }, g);
      r.link2in = el("line", { stroke: "#f6f8fa", "stroke-width": 14.5, "stroke-linecap": "round" }, g);
      r.j0 = el("circle", { r: 10, fill: "#2d343e", cx: B[0], cy: B[1] }, g);
      r.j1 = el("circle", { r: 8.5, fill: "#2d343e" }, g);
      r.hand = el("g", {}, g);
      el("circle", { r: 6.5, fill: "#2d343e", cx: 0, cy: 0 }, r.hand);
      el("rect", { x: -17, y: 4, width: 34, height: 9, rx: 3, fill: "#e7eaee", stroke: "#98a1ac" }, r.hand);
      el("rect", { x: -13.5, y: 13, width: 5, height: 14, rx: 1.5, fill: "#39414c" }, r.hand);
      el("rect", { x: 8.5, y: 13, width: 5, height: 14, rx: 1.5, fill: "#39414c" }, r.hand);
      const my = b.h - 22;
      r.reachText = text(g, 16, my - 10, "", { "font-size": 13.5 * fs, fill: C.muted });
      el("rect", { x: 16, y: my - 2, width: b.w - 32, height: 10, rx: 5, fill: "none", stroke: C.faint, "stroke-dasharray": "3 3" }, g);
      r.reachBar = el("rect", { x: 16, y: my - 2, width: 0, height: 10, rx: 5, fill: C.ink }, g);
      r.reachW = b.w - 32;
    }

    // ---------------- hindsight labels
    {
      const b = La, g = panel("labels", b, C.cream, C.creamStroke);
      stepBadge(g, 26, 26, 1, C.ink, "#fff");
      const t = text(g, 46, 32, "", { "font-size": 16 * fs, "font-weight": 650, fill: C.ink });
      t.innerHTML = 'Hindsight labels (<tspan font-style="italic" font-family="Newsreader, Georgia, serif">x</tspan>, <tspan font-style="italic" font-family="Newsreader, Georgia, serif">ν</tspan>)';
      text(g, 16, 56, "inverse dynamics of the unchanged robot,", { "font-size": 12.5 * fs, fill: C.muted });
      text(g, 16, 56 + 16 * fs, "read from the proprioception", { "font-size": 12.5 * fs, fill: C.muted });
      const x0 = 46, y0 = b.h - 34, sw = b.w - 46 - 70, sh = y0 - 96 * (port ? 1.1 : 1);
      const X = (v) => x0 + (v / 1.15) * sw, Y = (v) => y0 - (v / 1.15) * sh;
      r.sc = { X, Y };
      el("line", { x1: x0, y1: y0, x2: x0 + sw, y2: y0, stroke: C.ink, "stroke-width": 1 }, g);
      el("line", { x1: x0, y1: y0, x2: x0, y2: y0 - sh, stroke: C.ink, "stroke-width": 1 }, g);
      text(g, x0 + sw + 6, y0 + 4, "x", { "font-size": 15 * fs, "font-style": "italic", "font-family": "Newsreader, Georgia, serif", fill: C.ink });
      text(g, x0 - 16, y0 - sh + 6, "ν", { "font-size": 15 * fs, "font-style": "italic", "font-family": "Newsreader, Georgia, serif", fill: C.ink });
      text(g, x0 + sw / 2, y0 + 22, "command sent", { "font-size": 12.5 * fs, fill: C.muted, "text-anchor": "middle" });
      el("line", { x1: X(0), y1: Y(0), x2: X(1.12), y2: Y(1.12), stroke: C.faint, "stroke-dasharray": "5 4", "stroke-width": 1.3 }, g);
      text(g, X(1.12) + 4, Y(1.12) + 4, "nominal", { "font-size": 12.5 * fs, fill: C.faint });
      r.fit = el("line", { stroke: C.ours, "stroke-width": 2.2, opacity: 0 }, g);
      r.fitText = text(g, 0, 0, "", { "font-size": 13 * fs, fill: C.ours, "font-weight": 650 });
      r.dots = [];
      for (let k = 0; k < NCH; k++) for (let i = 0; i < H; i++)
        r.dots.push(el("circle", { cx: X(CMD[k][i]), cy: Y(NU[k][i]), r: 4, fill: C.label, opacity: 0 }, g));
    }

    // ---------------- posterior
    {
      const b = Po, g = panel("post", b, C.fillBlue, C.strokeBlue);
      stepBadge(g, 26, 26, 2, C.ink, "#fff");
      text(g, 46, 32, "Posterior over bodies", { "font-size": 16 * fs, "font-weight": 650, fill: C.ink });
      const rows = [["H₀ nominal", "ν = x", C.h0], ["H₁ affine", "ν = a x + b", C.h1], ["H₂ state-dependent", "ν = a x + b·[1, ψ(s)]", C.h2]];
      const nx = 16, bx = port ? 250 : 200, bw = b.w - bx - 60;
      r.wBars = [], r.wText = [];
      rows.forEach(([n, eq, col], j) => {
        const y = 66 + j * 44 * (port ? 1.12 : 1);
        text(g, nx, y + 2, n, { "font-size": 14 * fs, fill: C.ink, "font-weight": 600 });
        text(g, nx, y + 19 * fs, eq, { "font-size": 13.5 * fs, fill: C.muted, "font-family": "Newsreader, Georgia, serif", "font-style": "italic" });
        el("rect", { x: bx, y: y - 9, width: bw, height: 16, rx: 3, fill: "rgba(255,255,255,0.7)" }, g);
        r.wBars.push(el("rect", { x: bx, y: y - 9, width: 0, height: 16, rx: 3, fill: col, stroke: j === 0 ? "#a9a9a9" : j === 1 ? "#d6b95c" : "none", "stroke-width": 0.8 }, g));
        r.wText.push(text(g, bx + bw + 8, y + 4, "", { "font-size": 14 * fs, fill: C.ink, "font-variant-numeric": "tabular-nums" }));
      });
      r.wGeom = { bw };
      const sy0 = b.h - 18, sx0 = 16;
      text(g, sx0, sy0 - 12, "per chunk", { "font-size": 12.5 * fs, fill: C.muted });
      r.hist = [];
      for (let k = 0; k <= NCH; k++) {
        const x = sx0 + 74 * fs + k * 26, cols = [];
        el("rect", { x, y: sy0 - 34, width: 18, height: 34, fill: "none", stroke: "rgba(112,145,192,0.45)" }, g);
        [C.h2, C.h1, C.h0].forEach((c) => cols.push(el("rect", { x, y: sy0, width: 18, height: 0, fill: c }, g)));
        r.hist.push(cols);
      }
      r.histGeom = { sy0, h: 34 };
      r.gainText = text(g, b.w - 16, sy0 - 6, "", { "font-size": 14 * fs, fill: C.ours, "text-anchor": "end", "font-weight": 650 });
    }

    // ---------------- chunk counter and the reach of every chunk (wide layout only)
    if (Lo.info) {
      const b = Lo.info, g = el("g", { transform: `translate(${b.x} ${b.y})` }, svg);
      r.chunkText = text(g, 4, 50, "", { "font-size": 46, "font-family": "Newsreader, Georgia, serif", fill: C.ink });
      text(g, 4, 80, "Reached share of the planned", { "font-size": 13.5, fill: C.muted });
      text(g, 4, 98, "motion, per chunk", { "font-size": 13.5, fill: C.muted });
      const base = b.h - 30, hh = 100;
      r.reachCols = [];
      for (let k = 0; k < NCH; k++) {
        const x = 8 + k * 54;
        el("rect", { x, y: base - hh, width: 34, height: hh, fill: "none", stroke: C.rule }, g);
        const c = el("rect", { x, y: base, width: 34, height: 0, fill: k === 0 ? "#8c929a" : C.ours }, g);
        const t = text(g, x + 17, base - hh - 8, "", { "font-size": 13, fill: C.ink, "text-anchor": "middle", "font-variant-numeric": "tabular-nums" });
        text(g, x + 17, base + 20, String(k + 1), { "font-size": 13, fill: C.muted, "text-anchor": "middle" });
        r.reachCols.push({ c, t, base, hh });
      }
    }
    Object.values(r.arrows).forEach((a) => (a.len = a.path.getTotalLength()));
    return r;
  }

  /* ---------------------------------------------------------------- render a moment */
  function where(t) {
    t = Math.max(0, Math.min(TOTAL - 1e-6, t));
    if (t >= NCH * TC) return { k: NCH - 1, ph: "end", q: 1 };
    const k = Math.floor(t / TC);
    let s = t - k * TC;
    for (const [id, , d] of PHASES) { if (s < d) return { k, ph: id, q: s / d }; s -= d; }
    return { k, ph: "weigh", q: 1 };
  }
  const ORDER = PHASES.map((p) => p[0]).concat(["end"]);
  const after = (cur, ph) => ORDER.indexOf(cur) > ORDER.indexOf(ph);

  function ik(B, L1, L2, Pt) {
    const dx = Pt[0] - B[0], dy = Pt[1] - B[1];
    const d = Math.min(Math.hypot(dx, dy), L1 + L2 - 1e-3);
    const a2 = Math.acos(Math.max(-1, Math.min(1, (d * d - L1 * L1 - L2 * L2) / (2 * L1 * L2))));
    const a1 = Math.atan2(dy, dx) - Math.atan2(L2 * Math.sin(a2), L1 + L2 * Math.cos(a2));
    return [B[0] + L1 * Math.cos(a1), B[1] + L1 * Math.sin(a1)];
  }

  const CAP = {
    plan: () => "The frozen policy plans the next chunk from the camera image and the instruction. It is never updated.",
    act: (k) => k === 0 ? "The first chunk goes out as planned: nothing has been observed yet."
      : `Each planned step is sent as the command that best realizes it under the posterior. The robot moves less than commanded, so the commands grow to ${FACTOR[k].toFixed(2)} times the plan.`,
    exec: (k) => `The robot carries out the chunk. Half of every command is lost without any visible sign, and it reaches ${Math.round(REACH[k] * 100)}% of the planned motion.`,
    label: () => "An inverse-dynamics model of the unchanged robot reads the proprioception and returns, for every step, the command that would have produced the motion that happened. The labels fall below the diagonal.",
    weigh: (k) => `Each body hypothesis is scored by how well it predicted the new labels before seeing them, then refitted in closed form. Weight leaves the nominal body, and the fitted gain moves to ${GAIN[k + 1].toFixed(2)}.`,
    end: () => "After four chunks the fitted gain matches the true value of 0.5 and the robot carries out most of each plan. Had nothing changed, the nominal body would have kept the weight and every plan would go through as it is.",
  };
  let lastCap = "";

  function render(t) {
    if (!R) return;
    const { k, ph, q } = where(t);
    const done = (p) => after(ph, p) ? 1 : ph === p ? q : 0;

    // focus
    const focus = { plan: ["policy"], act: ["act"], exec: ["robot"], label: ["robot", "labels"], weigh: ["labels", "post"], end: ["act", "robot", "labels", "post", "policy"] }[ph];
    Object.entries(R.groups).forEach(([key, g]) => (g.style.opacity = focus.includes(key) ? 1 : 0.42));
    const act = { plan: "pa", act: "ar", exec: "ar", label: "rl", weigh: q < 0.6 ? "lp" : "pc" }[ph];
    const local = ph === "weigh" ? (q < 0.6 ? q / 0.6 : (q - 0.6) / 0.4) : q;
    Object.entries(R.arrows).forEach(([key, a]) => {
      const on = key === act;
      a.path.setAttribute("stroke", on ? C.ours : C.ink);
      a.path.setAttribute("stroke-width", on ? 2.4 : 1.4);
      a.g.style.opacity = on ? 1 : ph === "end" ? 0.8 : 0.45;
      if (on && ph !== "exec") {
        const pt = a.path.getPointAtLength(a.len * ease(local));
        a.dot.setAttribute("cx", pt.x); a.dot.setAttribute("cy", pt.y); a.dot.setAttribute("opacity", local < 0.98 ? 1 : 0);
      } else a.dot.setAttribute("opacity", 0);
    });

    // policy: the plan grows in during "plan"
    const pq = ease(done("plan") * 1.1);
    R.planBars.forEach((b, i) => {
      const hh = PLAN[k][i] * R.planGeom.sc * clamp(pq * 1.6 - i * 0.08);
      b.setAttribute("y", R.planGeom.base - hh); b.setAttribute("height", hh);
    });

    // act: plan outlines, then commands
    const aq = ease(done("act"));
    R.cmdBars.forEach((b, i) => {
      const ph0 = PLAN[k][i] * R.cmdGeom.sc, x = lerp(PLAN[k][i], CMD[k][i], aq) * R.cmdGeom.sc;
      const show = after(ph, "plan") ? 1 : 0;
      R.cmdPlan[i].setAttribute("y", R.cmdGeom.base - ph0); R.cmdPlan[i].setAttribute("height", ph0 * show);
      b.setAttribute("y", R.cmdGeom.base - x * clamp(aq * 3)); b.setAttribute("height", x * clamp(aq * 3) * show);
    });
    R.factor.textContent = after(ph, "plan") ? `x = ${lerp(1, FACTOR[k], aq).toFixed(2)} p` : "";

    // robot: the hand moves towards the planned end and stops short
    const eq = ease(done("exec"));
    const r0 = R.arm, reach = REACH[k];
    const Hp = [lerp(r0.S[0], lerp(r0.S[0], r0.E[0], reach), eq), r0.S[1]];
    const El = ik(r0.B, r0.L1, r0.L2, Hp);
    [[R.link1, R.link1in, r0.B, El], [R.link2, R.link2in, El, Hp]].forEach(([o, i, a, b]) => [o, i].forEach((l) => {
      l.setAttribute("x1", a[0]); l.setAttribute("y1", a[1]); l.setAttribute("x2", b[0]); l.setAttribute("y2", b[1]);
    }));
    R.j1.setAttribute("cx", El[0]); R.j1.setAttribute("cy", El[1]);
    R.hand.setAttribute("transform", `translate(${Hp[0]} ${Hp[1]})`);
    R.reachBar.setAttribute("width", R.reachW * reach * eq);
    R.reachText.textContent = eq > 0 ? `reached ${Math.round(reach * eq * 100)}% of the planned motion` : "reached / planned motion";

    // labels: dots of this chunk appear one by one, older chunks fade
    const lq = done("label");
    R.dots.forEach((d, n) => {
      const kk = Math.floor(n / H), i = n % H;
      let o = 0;
      if (kk < k) o = 0.85 * Math.pow(0.55, k - kk);
      else if (kk === k) o = clamp(lq * (H + 2) - i);
      d.setAttribute("opacity", o.toFixed(3));
    });
    const wq = ease(clamp((done("weigh") - 0.15) / 0.6));
    if (k === 0 && wq === 0) { R.fit.setAttribute("opacity", 0); R.fitText.textContent = ""; }
    else {
      const a = lerp(GAIN[k], GAIN[k + 1], wq);
      R.fit.setAttribute("x1", R.sc.X(0)); R.fit.setAttribute("y1", R.sc.Y(0));
      R.fit.setAttribute("x2", R.sc.X(1.12)); R.fit.setAttribute("y2", R.sc.Y(1.12 * a));
      R.fit.setAttribute("opacity", 1);
      R.fitText.setAttribute("x", R.sc.X(1.12) + 4); R.fitText.setAttribute("y", R.sc.Y(1.12 * a) + 4);
      R.fitText.textContent = `fit ${a.toFixed(2)}`;
    }

    // posterior weights
    const w = PI[k].map((v, j) => lerp(v, PI[k + 1][j], wq));
    R.wBars.forEach((b, j) => b.setAttribute("width", R.wGeom.bw * w[j]));
    R.wText.forEach((t2, j) => (t2.textContent = w[j].toFixed(2)));
    R.hist.forEach((cols, j) => {
      let vis = 0;
      if (j === 0) vis = 1;
      else if (j <= k) vis = 1;
      else if (j === k + 1) vis = wq;
      const pi = PI[j];
      let y = R.histGeom.sy0;
      [pi[2], pi[1], pi[0]].forEach((v, m) => {
        const hh = v * R.histGeom.h * vis;
        cols[m].setAttribute("y", y - hh); cols[m].setAttribute("height", hh); y -= hh;
      });
    });
    R.gainText.textContent = `fitted gain ${lerp(GAIN[k], GAIN[k + 1], wq).toFixed(2)}`;

    if (R.chunkText) {
      R.chunkText.textContent = `Chunk ${k + 1}`;
      R.reachCols.forEach((rc, j) => {
        const v = j < k ? REACH[j] : j === k ? REACH[j] * eq : 0;
        rc.c.setAttribute("y", rc.base - rc.hh * v); rc.c.setAttribute("height", rc.hh * v);
        rc.t.textContent = v > 0 ? `${Math.round(v * 100)}%` : "";
      });
    }

    // caption and phase list
    const cap = ph === "end" ? CAP.end() : `<span class="k">Chunk ${k + 1} of ${NCH}.</span> ${CAP[ph](k)}`;
    if (cap !== lastCap) { document.getElementById("anim-cap").innerHTML = cap; lastCap = cap; }
    phaseItems.forEach((li, j) => li.classList.toggle("on", ph !== "end" && PHASES[j][0] === ph));
  }

  /* ---------------------------------------------------------------- player */
  const phaseList = document.getElementById("anim-phases");
  const phaseItems = PHASES.map(([, name]) => { const li = document.createElement("li"); li.textContent = name; phaseList.appendChild(li); return li; });
  const range = document.getElementById("anim-range"), playBtn = document.getElementById("anim-play");
  let t = reduce ? TC * 1 + 6.5 : 0, playing = !reduce, visible = false, raf = null, last = 0;

  function setPlayIcon() {
    playBtn.innerHTML = `<svg class="ic"><use href="#i-${playing ? "pause" : "play"}"/></svg>`;
    playBtn.setAttribute("aria-label", playing ? "Pause" : "Play");
  }
  function frame(now) {
    raf = null;
    if (!playing || !visible) return;
    t += Math.min(0.1, (now - last) / 1000); last = now;
    if (t >= TOTAL) t = 0;
    range.value = Math.round((t / TOTAL) * 1000);
    render(t);
    raf = requestAnimationFrame(frame);
  }
  function go() { if (!raf && playing && visible) { last = performance.now(); raf = requestAnimationFrame(frame); } }
  playBtn.addEventListener("click", () => { playing = !playing; setPlayIcon(); go(); });
  document.getElementById("anim-replay").addEventListener("click", () => { t = 0; playing = true; setPlayIcon(); render(t); go(); });
  range.addEventListener("input", () => { t = (range.value / 1000) * TOTAL; playing = false; setPlayIcon(); render(t); });
  new IntersectionObserver((es) => { visible = es[0].isIntersecting; go(); }, { threshold: 0.25 }).observe(svg);

  function pickLayout() {
    const want = (svg.parentElement.clientWidth || 1000) < 720 ? PORT : LAND;
    if (want !== layout) { layout = want; R = build(layout); render(t); }
  }
  window.addEventListener("resize", pickLayout);
  pickLayout();
  setPlayIcon();
  range.value = Math.round((t / TOTAL) * 1000);
  render(t);
  window.RoboAdaMethod = { render: (x) => render(x), TOTAL, pause: () => { playing = false; setPlayIcon(); } };
})();
