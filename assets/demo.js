/* The opening demo: two arms, the same frozen plans, one hidden change. Drawn on a canvas in the palette of Figure 1. */
(function () {
  "use strict";
  const T = window.RoboAdaToy;
  const canvas = document.getElementById("lab");
  if (!canvas || !T) return;
  const ctx = canvas.getContext("2d");
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const SANS = '"Archivo", "Helvetica Neue", Arial, sans-serif';
  const C = {
    ink: "#1e2530", muted: "#5b6472", faint: "#8b939e", rule: "#e3e7ed", panel: "#f4f5f7", panelBlue: "#f3f7fd",
    strokeBlue: "#c3d3ea", ours: "#4c72b0", frozenTrace: "#7d848d", fail: "#d6453f", ok: "#3c9a76",
    h0: "#c4c4c4", h1: "#f1d58a", h2: "#4c72b0", wood: "#ece0ca", woodLine: "#e0d0b2", woodEdge: "#cbb38a",
  };
  const ICON = {
    eyeOff: ["M2.5 12s3.4-6 9.5-6c2 0 3.7.6 5.1 1.5M21.5 12s-1.2 2.1-3.4 3.8M9.9 17.6c.7.2 1.4.3 2.1.3", "M3.5 3.5l17 17", "M9.6 9.7a3.2 3.2 0 0 0 4.6 4.5"],
    weight: ["M8.6 9.2a3.4 3.4 0 1 1 6.8 0", "M6.6 9.6h10.8l1.6 9.7a1.6 1.6 0 0 1-1.6 1.7H6.6A1.6 1.6 0 0 1 5 19.3Z"],
    gauge: ["M3.5 17.5a8.5 8.5 0 1 1 17 0", "M12 17.5 7.6 12.4"],
    hourglass: ["M6.5 3h11M6.5 21h11", "M8 3c0 5 8 5.5 8 9s-8 4-8 9M16 3c0 5-8 5.5-8 9s8 4 8 9"],
    check: ["M5 12.5l4.5 4.5L19 7.5"],
    x: ["M6.5 6.5l11 11M17.5 6.5l-11 11"],
    snow: ["M12 2.5v19M3.8 7.2l16.4 9.6M3.8 16.8l16.4-9.6", "M9.6 3.8 12 6.2l2.4-2.4M9.6 20.2 12 17.8l2.4 2.4"],
  };
  const PATHS = {};
  Object.keys(ICON).forEach((k) => (PATHS[k] = ICON[k].map((d) => new Path2D(d))));
  function icon(name, x, y, size, color, lw) {
    ctx.save(); ctx.translate(x, y); ctx.scale(size / 24, size / 24);
    ctx.strokeStyle = color; ctx.lineWidth = ((lw || 2) * 24) / size; ctx.lineCap = "round"; ctx.lineJoin = "round";
    PATHS[name].forEach((p) => ctx.stroke(p));
    ctx.restore();
  }
  const BADGE = {
    load: ["weight", "35 N load while holding"], motor: ["gauge", "motor at 45% strength"],
    lag: ["hourglass", "commands 6 steps late"], none: ["check", "no change"],
  };

  const BADGE_SHORT = { load: "35 N load", motor: "motor at 45%", lag: "6 steps late", none: "no change" };
  let change = "load", eps = null, L = null, raf = null, last = 0, acc = 0, visible = true;

  function reset() {
    eps = [T.Episode(change, false, 7), T.Episode(change, true, 7)];
    acc = 0;
    if (reduce) { eps.forEach((e) => e.run()); draw(); } else { draw(); start(); }
  }
  function start() { if (!raf && visible) { last = performance.now(); raf = requestAnimationFrame(tick); } }
  function tick(now) {
    raf = null;
    acc += Math.min(0.1, (now - last) / 1000) * 75;
    last = now;
    while (acc >= 1) { eps.forEach((e) => e.step()); acc -= 1; }
    draw();
    if (!eps.every((e) => e.done)) start();
  }

  /* ---------------------------------------------------------------- layout */
  const WX0 = 0.0, WX1 = 1.15, WZ0 = -0.02, WZ1 = 0.8, HEAD = 46;
  function resize() {
    const w = canvas.clientWidth || 640, dpr = window.devicePixelRatio || 1;
    const stacked = w < 700, gap = 20;
    const pw = stacked ? w : (w - gap) / 2;
    const u = (pw - 24) / (WX1 - WX0);
    const ph = HEAD + (WZ1 - WZ0) * u + 8;
    const footA = 40, footB = 108;
    let h, panels;
    if (stacked) {
      panels = [{ x: 0, y: 0, w: pw, h: ph, foot: footA }, { x: 0, y: ph + footA + 12, w: pw, h: ph, foot: footB }];
      h = 2 * ph + footA + footB + 12;
    } else {
      panels = [{ x: 0, y: 0, w: pw, h: ph, foot: footB }, { x: pw + gap, y: 0, w: pw, h: ph, foot: footB }];
      h = ph + footB;
    }
    canvas.style.height = Math.round(h) + "px";
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    L = { w, h, u, panels, stacked };
    if (eps) draw();
  }

  function rrect(x, y, w, h, r) { ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x, y, w, h, r) : ctx.rect(x, y, w, h); }

  /* ---------------------------------------------------------------- one panel */
  function drawPanel(p, e, ours) {
    const u = L.u;
    const sx = (x) => p.x + 12 + (x - WX0) * u;
    const sy = (z) => p.y + HEAD + (WZ1 - z) * u;
    ctx.save();
    rrect(p.x, p.y, p.w, p.h, 12);
    ctx.fillStyle = ours ? C.panelBlue : C.panel; ctx.fill();
    if (ours) { ctx.strokeStyle = C.strokeBlue; ctx.lineWidth = 1; ctx.stroke(); }
    ctx.save(); rrect(p.x, p.y, p.w, p.h, 12); ctx.clip();

    // header
    ctx.textBaseline = "middle"; ctx.font = `600 15px ${SANS}`; ctx.fillStyle = ours ? C.ours : C.ink;
    const title = ours ? "Frozen policy + RoboAda" : "Frozen policy";
    ctx.fillText(title, p.x + 16, p.y + 23);
    icon("snow", p.x + 22 + ctx.measureText(title).width, p.y + 15, 16, C.faint, 1.8);
    // hidden-change badge
    const [bi, btLong] = BADGE[change];
    const bt = p.w < 560 ? BADGE_SHORT[change] : btLong;
    ctx.font = `500 13px ${SANS}`;
    const tw = ctx.measureText(bt).width, bw = tw + (change === "none" ? 40 : 62), bx = p.x + p.w - bw - 12, by = p.y + 11;
    rrect(bx, by, bw, 25, 12.5); ctx.fillStyle = change === "none" ? "rgba(60,154,118,0.12)" : "rgba(30,37,48,0.82)"; ctx.fill();
    let ix = bx + 9;
    if (change !== "none") { icon("eyeOff", ix, by + 4.5, 16, "#fff", 1.9); ix += 21; }
    icon(bi, ix, by + 4.5, 16, change === "none" ? C.ok : "#fff", 1.9);
    ctx.fillStyle = change === "none" ? C.ok : "#fff"; ctx.fillText(bt, ix + 21, by + 13);

    // table
    const tz = 0.1;
    ctx.fillStyle = C.wood; ctx.fillRect(p.x, sy(tz), p.w, p.y + p.h - sy(tz));
    ctx.strokeStyle = C.woodLine; ctx.lineWidth = 1;
    for (let k = 1; k < 5; k++) { const yy = sy(tz) + k * 0.026 * u; ctx.beginPath(); ctx.moveTo(p.x, yy); ctx.bezierCurveTo(p.x + p.w * 0.3, yy - 2, p.x + p.w * 0.6, yy + 2, p.x + p.w, yy); ctx.stroke(); }
    ctx.strokeStyle = C.woodEdge; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(p.x, sy(tz)); ctx.lineTo(p.x + p.w, sy(tz)); ctx.stroke();

    // the plan's route
    ctx.setLineDash([5, 6]); ctx.strokeStyle = "rgba(91,100,114,0.45)"; ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.moveTo(sx(T.START[0]), sy(T.START[1]));
    T.WAYPOINTS.forEach((w) => ctx.lineTo(sx(w[0]), sy(w[1]))); ctx.stroke(); ctx.setLineDash([]);
    ctx.font = `12px ${SANS}`; ctx.fillStyle = C.faint; ctx.textBaseline = "alphabetic";
    ctx.fillText("planned route", sx(0.64), sy(0.455));

    // basket, back half
    const bx0 = 0.855, bx1 = 1.045, bz0 = 0.1, bz1 = 0.18;
    ctx.fillStyle = "#a9753d"; ctx.fillRect(sx(bx0 + 0.012), sy(bz1), (bx1 - bx0 - 0.024) * u, (bz1 - bz0) * u * 0.4);

    // object (a small boxed product: white with a blue band)
    const ow = 0.07, oh = 0.05;
    let oc;
    if (e.holding) oc = [e.pos[0], e.pos[1] - 0.035];
    else if (e.success) oc = [0.95, 0.155 + oh / 2];
    else oc = [0.55, 0.1 + oh / 2];
    const ox = sx(oc[0] - ow / 2), oy = sy(oc[1] + oh / 2), owp = ow * u, ohp = oh * u;
    rrect(ox, oy, owp, ohp, 2); ctx.fillStyle = "#ffffff"; ctx.fill(); ctx.strokeStyle = "#8f98a3"; ctx.lineWidth = 1.2; ctx.stroke();
    ctx.fillStyle = "#3d6fb6"; ctx.fillRect(ox + 1, oy + ohp * 0.18, owp - 2, ohp * 0.3);
    ctx.fillStyle = "#e6b84a"; ctx.fillRect(ox + owp * 0.62, oy + ohp * 0.62, owp * 0.26, ohp * 0.18);

    // hidden pull on the held object (shown here, invisible to the policy)
    if (change === "load" && e.holding) {
      const ax = sx(oc[0]), ay0 = sy(oc[1] - oh / 2) + 3, ay1 = ay0 + 0.075 * u;
      ctx.strokeStyle = "rgba(214,69,63,0.75)"; ctx.fillStyle = "rgba(214,69,63,0.85)"; ctx.lineWidth = 1.8; ctx.setLineDash([3, 3]);
      ctx.beginPath(); ctx.moveTo(ax, ay0); ctx.lineTo(ax, ay1 - 6); ctx.stroke(); ctx.setLineDash([]);
      ctx.beginPath(); ctx.moveTo(ax - 5, ay1 - 7); ctx.lineTo(ax + 5, ay1 - 7); ctx.lineTo(ax, ay1); ctx.closePath(); ctx.fill();
      ctx.font = `500 12px ${SANS}`; ctx.fillText("35 N", ax + 8, ay1 - 4);
    }

    // basket, front
    ctx.beginPath();
    ctx.moveTo(sx(bx0), sy(bz1)); ctx.lineTo(sx(bx1), sy(bz1)); ctx.lineTo(sx(bx1 - 0.02), sy(bz0)); ctx.lineTo(sx(bx0 + 0.02), sy(bz0)); ctx.closePath();
    ctx.fillStyle = "#c99659"; ctx.fill(); ctx.strokeStyle = "#946733"; ctx.lineWidth = 1.2; ctx.stroke();
    ctx.save(); ctx.clip();
    ctx.strokeStyle = "rgba(148,103,51,0.55)"; ctx.lineWidth = 1;
    for (let z = bz0 + 0.018; z < bz1; z += 0.018) { ctx.beginPath(); ctx.moveTo(sx(bx0), sy(z)); ctx.lineTo(sx(bx1), sy(z)); ctx.stroke(); }
    for (let x = bx0 + 0.02; x < bx1; x += 0.024) { ctx.beginPath(); ctx.moveTo(sx(x), sy(bz1)); ctx.lineTo(sx(x + 0.004), sy(bz0)); ctx.stroke(); }
    ctx.restore();
    rrect(sx(bx0 - 0.006), sy(bz1 + 0.01), (bx1 - bx0 + 0.012) * u, 0.016 * u, 3); ctx.fillStyle = "#b07d42"; ctx.fill();

    // executed path
    ctx.strokeStyle = ours ? C.ours : C.frozenTrace; ctx.lineWidth = 2.2; ctx.lineCap = "round"; ctx.lineJoin = "round";
    ctx.beginPath(); e.trace.forEach((q, i) => (i ? ctx.lineTo(sx(q[0]), sy(q[1])) : ctx.moveTo(sx(q[0]), sy(q[1])))); ctx.stroke();

    drawArm(e, sx, sy, u);

    // outcome mark
    if (e.done) {
      const ok = e.success, mx = ok ? sx(1.075) : sx(e.pos[0]) + 0.07 * u, my = ok ? sy(0.3) : sy(e.pos[1]) - 0.04 * u;
      ctx.beginPath(); ctx.arc(mx, my, 15, 0, 2 * Math.PI); ctx.fillStyle = ok ? C.ok : C.fail; ctx.fill();
      icon(ok ? "check" : "x", mx - 10, my - 10, 20, "#fff", 2.6);
    }
    ctx.restore();
    ctx.restore();
  }

  function capsule(A, B, wdt, fill, stroke) {
    const dx = B[0] - A[0], dy = B[1] - A[1], len = Math.hypot(dx, dy), ang = Math.atan2(dy, dx);
    ctx.save(); ctx.translate(A[0], A[1]); ctx.rotate(ang);
    rrect(-wdt / 2, -wdt / 2, len + wdt, wdt, wdt / 2);
    const g = ctx.createLinearGradient(0, -wdt / 2, 0, wdt / 2);
    g.addColorStop(0, "#ffffff"); g.addColorStop(0.55, fill); g.addColorStop(1, "#d7dce3");
    ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = stroke; ctx.lineWidth = 1.3; ctx.stroke();
    ctx.restore();
  }
  function joint(q, r) {
    ctx.beginPath(); ctx.arc(q[0], q[1], r, 0, 2 * Math.PI); ctx.fillStyle = "#2d343e"; ctx.fill();
    ctx.beginPath(); ctx.arc(q[0], q[1], r * 0.62, 0, 2 * Math.PI); ctx.strokeStyle = "#69737f"; ctx.lineWidth = 1.2; ctx.stroke();
    ctx.beginPath(); ctx.arc(q[0], q[1], r * 0.22, 0, 2 * Math.PI); ctx.fillStyle = "#a7b0ba"; ctx.fill();
  }
  function drawArm(e, sx, sy, u) {
    const foot = [0.12, 0.1], base = [0.12, 0.3], l1 = 0.46, l2 = 0.46;
    const wrist = [e.pos[0], e.pos[1] + 0.03];
    const dx = wrist[0] - base[0], dz = wrist[1] - base[1];
    const d = Math.min(Math.hypot(dx, dz), l1 + l2 - 1e-6);
    const a2 = Math.acos(Math.max(-1, Math.min(1, (d * d - l1 * l1 - l2 * l2) / (2 * l1 * l2))));
    const a1 = Math.atan2(dz, dx) + Math.atan2(l2 * Math.sin(a2), l1 + l2 * Math.cos(a2));
    const elbow = [base[0] + l1 * Math.cos(a1), base[1] + l1 * Math.sin(a1)];
    const S = (q) => [sx(q[0]), sy(q[1])];
    // pedestal
    const pw = 0.1 * u, px = sx(foot[0]) - pw / 2;
    rrect(px, sy(base[1]) - 4, pw, sy(foot[1]) - sy(base[1]) + 4, 5);
    const g = ctx.createLinearGradient(px, 0, px + pw, 0);
    g.addColorStop(0, "#e9ecf0"); g.addColorStop(0.5, "#fbfcfd"); g.addColorStop(1, "#cfd5dc");
    ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = "#a9b2bd"; ctx.lineWidth = 1.3; ctx.stroke();
    ctx.fillStyle = "#2d343e"; ctx.fillRect(px, sy(foot[1]) - 0.025 * u, pw, 0.012 * u);
    rrect(px - 0.025 * u, sy(foot[1]) - 0.012 * u, pw + 0.05 * u, 0.014 * u, 3); ctx.fillStyle = "#c7cdd5"; ctx.fill();
    // links
    capsule(S(base), S(elbow), 0.078 * u, "#f4f6f8", "#a9b2bd");
    capsule(S(elbow), S(wrist), 0.064 * u, "#f4f6f8", "#a9b2bd");
    joint(S(base), 0.044 * u);
    joint(S(elbow), 0.038 * u);
    // hand, pointing down
    const W = S(wrist);
    ctx.beginPath(); ctx.arc(W[0], W[1], 0.026 * u, 0, 2 * Math.PI); ctx.fillStyle = "#2d343e"; ctx.fill();
    rrect(W[0] - 0.052 * u, W[1] + 0.008 * u, 0.104 * u, 0.03 * u, 4);
    ctx.fillStyle = "#e7eaee"; ctx.fill(); ctx.strokeStyle = "#98a1ac"; ctx.lineWidth = 1.2; ctx.stroke();
    const open = e.holding ? 0.037 : 0.05;
    [-1, 1].forEach((s) => {
      rrect(W[0] + s * open * u - 0.007 * u, W[1] + 0.036 * u, 0.014 * u, 0.05 * u, 2.5);
      ctx.fillStyle = "#39414c"; ctx.fill();
    });
  }

  /* ---------------------------------------------------------------- what is below each panel */
  function drawFoot(p, e, ours) {
    const y0 = p.y + p.h + 12;
    ctx.save(); ctx.textBaseline = "top";
    ctx.font = `500 14px ${SANS}`;
    let msg = `Step ${e.t}`;
    if (e.done) msg = e.success ? `Placed in the basket at step ${e.t}` : `Out of time at step ${e.t}: the box never reaches the basket`;
    ctx.fillStyle = e.done ? (e.success ? C.ok : C.fail) : C.muted;
    ctx.fillText(msg, p.x + 4, y0);
    if (!ours) {
      if (!L.stacked) { ctx.font = `13px ${SANS}`; ctx.fillStyle = C.muted; ctx.fillText("Every planned command is sent as it is.", p.x + 4, y0 + 26); }
      ctx.restore(); return;
    }
    // posterior strip
    ctx.font = `13px ${SANS}`; ctx.fillStyle = C.muted;
    let lab = "Posterior over bodies, per chunk";
    if (e.skip > 0) lab += `. Latency found: the first ${e.skip} commands of each chunk are skipped`;
    ctx.fillText(lab, p.x + 4, y0 + 26);
    const n = 24, top = y0 + 46, bh = 30, bw = (p.w - 8) / n;
    for (let i = 0; i < n; i++) {
      const x = p.x + 4 + i * bw, pi = e.pis[i];
      if (!pi) { ctx.strokeStyle = C.rule; ctx.lineWidth = 1; ctx.strokeRect(x + 1.5, top + 0.5, bw - 3, bh - 1); continue; }
      let y = top + bh;
      [[pi[2], C.h2], [pi[1], C.h1], [pi[0], C.h0]].forEach(([v, c]) => { const hh = v * bh; ctx.fillStyle = c; ctx.fillRect(x + 1.5, y - hh, bw - 3, hh); y -= hh; });
    }
    let lx = p.x + 4;
    const ly = top + bh + 8;
    [["H0 nominal", C.h0], ["H1 affine", C.h1], ["H2 state-dependent", C.h2]].forEach(([t, c]) => {
      ctx.fillStyle = c; ctx.fillRect(lx, ly + 2, 10, 10); ctx.fillStyle = C.muted; ctx.fillText(t, lx + 15, ly);
      lx += ctx.measureText(t).width + 30;
    });
    ctx.restore();
  }

  function draw() {
    if (!L) return;
    ctx.clearRect(0, 0, L.w, L.h);
    drawPanel(L.panels[0], eps[0], false); drawFoot(L.panels[0], eps[0], false);
    drawPanel(L.panels[1], eps[1], true); drawFoot(L.panels[1], eps[1], true);
  }

  document.querySelectorAll(".seg button").forEach((b) => b.addEventListener("click", () => {
    document.querySelectorAll(".seg button").forEach((o) => o.setAttribute("aria-checked", String(o === b)));
    change = b.dataset.change;
    reset();
  }));
  document.getElementById("replay").addEventListener("click", reset);
  new IntersectionObserver((es) => { visible = es[0].isIntersecting; if (visible && eps && !eps.every((e) => e.done)) start(); }).observe(canvas);
  let rt = null;
  window.addEventListener("resize", () => { clearTimeout(rt); rt = setTimeout(resize, 80); });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => draw());
  resize();
  reset();
})();
