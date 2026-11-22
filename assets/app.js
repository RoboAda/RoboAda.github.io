(function () {
  "use strict";
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ------------------------------------------------------------ the opening demo */
  const T = window.RoboAdaToy;
  const canvas = document.getElementById("lab");
  const ctx = canvas.getContext("2d");
  const C = { chalk: "#e8eff7", dim: "rgba(232,239,247,0.55)", faint: "rgba(232,239,247,0.22)", amber: "#e7a54a",
              h0: "rgba(232,239,247,0.28)", h1: "#8fb0de", h2: "#e8eff7" };
  const SANS = '"Archivo", "Helvetica Neue", Arial, sans-serif';
  let change = "load", eps = null, layout = null, raf = null, last = 0, acc = 0, visible = true;

  function reset() {
    eps = [T.Episode(change, false, 7), T.Episode(change, true, 7)];
    acc = 0;
    if (reduce) { eps.forEach((e) => e.run()); draw(); } else start();
  }
  function start() { if (!raf && visible) { last = performance.now(); raf = requestAnimationFrame(tick); } }
  function tick(now) {
    raf = null;
    acc += Math.min(0.1, (now - last) / 1000) * 80; // 80 control steps per second
    last = now;
    while (acc >= 1) { eps.forEach((e) => e.step()); acc -= 1; }
    draw();
    if (!eps.every((e) => e.done)) start();
  }

  function resize() {
    const w = canvas.clientWidth || 600, dpr = window.devicePixelRatio || 1;
    const stacked = w < 620;
    const pw = stacked ? w : (w - 24) / 2, sh = Math.round(pw * 0.62);
    const strip = 78;
    const h = stacked ? 2 * (sh + 44) + strip + 10 : sh + 44 + strip;
    canvas.style.height = h + "px";
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    layout = stacked
      ? { w, h, panels: [{ x: 0, y: 0, w: pw, h: sh }, { x: 0, y: sh + 44, w: pw, h: sh }], strip: { x: 0, y: 2 * (sh + 44) + 4, w: pw, h: strip - 10 } }
      : { w, h, panels: [{ x: 0, y: 0, w: pw, h: sh }, { x: pw + 24, y: 0, w: pw, h: sh }], strip: { x: pw + 24, y: sh + 44, w: pw, h: strip - 10 } };
    if (eps) draw();
  }

  function drawPanel(p, e, label, color) {
    const X0 = 0.0, X1 = 1.15, Z0 = 0.02, Z1 = 0.84;
    const sx = (x) => p.x + 14 + ((x - X0) / (X1 - X0)) * (p.w - 28);
    const sy = (z) => p.y + 30 + (1 - (z - Z0) / (Z1 - Z0)) * (p.h - 40);
    const u = (p.w - 28) / (X1 - X0);
    ctx.save();
    ctx.lineCap = "round"; ctx.lineJoin = "round";
    ctx.fillStyle = C.chalk; ctx.font = `600 14px ${SANS}`; ctx.textBaseline = "top";
    ctx.fillText(label, p.x + 14, p.y + 6);
    // table and basket
    ctx.strokeStyle = C.dim; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(sx(0.03), sy(0.1)); ctx.lineTo(sx(1.12), sy(0.1)); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(sx(0.87), sy(0.22)); ctx.lineTo(sx(0.87), sy(0.1)); ctx.lineTo(sx(1.03), sy(0.1)); ctx.lineTo(sx(1.03), sy(0.22)); ctx.stroke();
    // the plan's route
    ctx.setLineDash([4, 5]); ctx.strokeStyle = C.faint; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(sx(T.START[0]), sy(T.START[1]));
    T.WAYPOINTS.forEach((w) => ctx.lineTo(sx(w[0]), sy(w[1]))); ctx.stroke(); ctx.setLineDash([]);
    // trace
    ctx.strokeStyle = color; ctx.lineWidth = 2;
    ctx.beginPath(); e.trace.forEach((q, i) => (i ? ctx.lineTo(sx(q[0]), sy(q[1])) : ctx.moveTo(sx(q[0]), sy(q[1])))); ctx.stroke();
    // object
    const box = 0.05 * u;
    let ob = [0.55, 0.1];
    if (e.holding) ob = [e.pos[0], e.pos[1] - 0.075];
    else if (e.success) ob = [e.pos[0], 0.1];
    ctx.fillStyle = "rgba(232,239,247,0.16)"; ctx.strokeStyle = C.chalk; ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.rect(sx(ob[0]) - box / 2, sy(ob[1]) - box, box, box); ctx.fill(); ctx.stroke();
    // arm on a pedestal: two links, elbow up, drawn as a blueprint outline
    const foot = [0.12, 0.1], base = [0.12, 0.3], l1 = 0.46, l2 = 0.46;
    const wrist = [e.pos[0], e.pos[1] + 0.03];
    const dx = wrist[0] - base[0], dz = wrist[1] - base[1];
    const d = Math.min(Math.hypot(dx, dz), l1 + l2 - 1e-6);
    const a2 = Math.acos(Math.max(-1, Math.min(1, (d * d - l1 * l1 - l2 * l2) / (2 * l1 * l2))));
    const a1 = Math.atan2(dz, dx) + Math.atan2(l2 * Math.sin(a2), l1 + l2 * Math.cos(a2));
    const elbow = [base[0] + l1 * Math.cos(a1), base[1] + l1 * Math.sin(a1)];
    const link = (A, B, wdt) => {
      ctx.strokeStyle = "rgba(232,239,247,0.16)"; ctx.lineWidth = wdt;
      ctx.beginPath(); ctx.moveTo(sx(A[0]), sy(A[1])); ctx.lineTo(sx(B[0]), sy(B[1])); ctx.stroke();
      ctx.strokeStyle = C.chalk; ctx.lineWidth = 1.3;
      const ang = Math.atan2(sy(B[1]) - sy(A[1]), sx(B[0]) - sx(A[0])), ox = Math.sin(ang) * wdt / 2, oy = -Math.cos(ang) * wdt / 2;
      ctx.beginPath();
      ctx.moveTo(sx(A[0]) + ox, sy(A[1]) + oy); ctx.lineTo(sx(B[0]) + ox, sy(B[1]) + oy);
      ctx.moveTo(sx(A[0]) - ox, sy(A[1]) - oy); ctx.lineTo(sx(B[0]) - ox, sy(B[1]) - oy);
      ctx.stroke();
    };
    link(foot, base, 0.05 * u);
    link(base, elbow, 0.04 * u);
    link(elbow, wrist, 0.032 * u);
    ctx.fillStyle = "#163c69"; ctx.strokeStyle = C.chalk; ctx.lineWidth = 1.4;
    [base, elbow, wrist].forEach((q) => { ctx.beginPath(); ctx.arc(sx(q[0]), sy(q[1]), 0.02 * u, 0, 2 * Math.PI); ctx.fill(); ctx.stroke(); });
    ctx.beginPath(); ctx.moveTo(sx(foot[0] - 0.07), sy(0.1)); ctx.lineTo(sx(foot[0] + 0.07), sy(0.1)); ctx.lineWidth = 3; ctx.stroke();
    const g = e.holding ? 0.028 : 0.04;
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(sx(wrist[0] - g), sy(wrist[1] - 0.012)); ctx.lineTo(sx(wrist[0] - g), sy(wrist[1] - 0.05));
    ctx.moveTo(sx(wrist[0] + g), sy(wrist[1] - 0.012)); ctx.lineTo(sx(wrist[0] + g), sy(wrist[1] - 0.05));
    ctx.moveTo(sx(wrist[0] - g), sy(wrist[1] - 0.012)); ctx.lineTo(sx(wrist[0] + g), sy(wrist[1] - 0.012)); ctx.stroke();
    // status
    ctx.font = `14px ${SANS}`; ctx.textBaseline = "top";
    let msg = `step ${e.t}`;
    if (e.done) msg = e.success ? `Placed at step ${e.t}` : `Out of time at step ${e.t}`;
    ctx.fillStyle = e.done && !e.success ? C.amber : C.dim;
    ctx.fillText(msg, p.x + 14, p.y + p.h + 12);
    ctx.restore();
  }

  function drawStrip(s, e) {
    ctx.save();
    ctx.font = `13px ${SANS}`; ctx.textBaseline = "top"; ctx.fillStyle = C.dim;
    ctx.fillText("Posterior over bodies, per chunk", s.x + 14, s.y);
    const legend = [["H0 nominal", C.h0], ["H1 affine", C.h1], ["H2 state-dependent", C.h2]];
    let lx = s.x + 14;
    const ly = s.y + s.h - 14;
    legend.forEach(([t, c]) => { ctx.fillStyle = c; ctx.fillRect(lx, ly + 2, 10, 10); ctx.fillStyle = C.dim; ctx.fillText(t, lx + 15, ly); lx += ctx.measureText(t).width + 32; });
    const n = 24, bw = (s.w - 28) / n, top = s.y + 20, bh = s.h - 40;
    for (let i = 0; i < n; i++) {
      const x = s.x + 14 + i * bw;
      const pi = e.pis[i];
      if (!pi) { ctx.strokeStyle = C.faint; ctx.strokeRect(x + 1.5, top + 0.5, bw - 3, bh); continue; }
      let y = top + bh;
      [[pi[2], C.h2], [pi[1], C.h1], [pi[0], C.h0]].forEach(([v, c]) => { const hh = v * bh; ctx.fillStyle = c; ctx.fillRect(x + 1.5, y - hh, bw - 3, hh); y -= hh; });
    }
    ctx.restore();
  }

  function draw() {
    if (!layout) return;
    ctx.clearRect(0, 0, layout.w, layout.h);
    drawPanel(layout.panels[0], eps[0], "Frozen policy", C.amber);
    drawPanel(layout.panels[1], eps[1], "Frozen policy + RoboAda", C.chalk);
    drawStrip(layout.strip, eps[1]);
    if (layout.panels[0].x === layout.strip.x) return;
    ctx.save(); ctx.font = `13px ${SANS}`; ctx.fillStyle = C.dim; ctx.textBaseline = "top";
    ctx.fillText("Plans executed as they are.", 14, layout.strip.y);
    ctx.restore();
  }

  document.querySelectorAll(".seg button").forEach((b) => b.addEventListener("click", () => {
    document.querySelectorAll(".seg button").forEach((o) => o.setAttribute("aria-checked", String(o === b)));
    change = b.dataset.change;
    reset();
  }));
  document.getElementById("replay").addEventListener("click", reset);
  new IntersectionObserver((es) => { visible = es[0].isIntersecting; if (visible && eps && !eps.every((e) => e.done)) start(); }).observe(canvas);
  window.addEventListener("resize", resize);
  resize();
  reset();

  /* ------------------------------------------------------------ results chart */
  const RES = [["Cosmos Policy", 25.1, 73.2], ["Fast-WAM", 23.5, 51.9], ["π<tspan baseline-shift=\"sub\" font-size=\"11\">0</tspan>", 28.8, 55.7], ["π<tspan baseline-shift=\"sub\" font-size=\"11\">0.5</tspan>", 35.0, 71.2], ["OpenVLA-OFT", 26.8, 62.3]];
  (function chart() {
    const W = 560, rowH = 52, top = 44, left = 118, right = 50, H = top + RES.length * rowH + 8;
    const sc = (v) => ((W - left - right) * v) / 100;
    let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Success rate under eleven physical shifts per policy">`;
    s += `<rect x="${left}" y="8" width="12" height="12" style="fill:var(--frozen)"/><text x="${left + 18}" y="18" style="fill:var(--muted)" font-size="14">frozen</text>`;
    s += `<rect x="${left + 90}" y="8" width="12" height="12" style="fill:var(--ours)"/><text x="${left + 108}" y="18" style="fill:var(--muted)" font-size="14">+ RoboAda</text>`;
    RES.forEach(([n, f, r], i) => {
      const y = top + i * rowH;
      s += `<text x="${left - 12}" y="${y + 23}" text-anchor="end" font-size="15" style="fill:var(--ink)">${n}</text>`;
      s += `<rect x="${left}" y="${y + 4}" width="${sc(f)}" height="15" style="fill:var(--frozen)"/>`;
      s += `<text x="${left + sc(f) + 6}" y="${y + 16}" font-size="13" style="fill:var(--muted)">${f.toFixed(1)}</text>`;
      s += `<rect x="${left}" y="${y + 22}" width="${sc(r)}" height="15" style="fill:var(--ours)"/>`;
      s += `<text x="${left + sc(r) + 6}" y="${y + 34}" font-size="13" font-weight="650" style="fill:var(--ours)">${r.toFixed(1)}</text>`;
    });
    s += `<line x1="${left}" x2="${left}" y1="${top}" y2="${H - 8}" style="stroke:var(--rule)" stroke-width="1"/></svg>`;
    s += `<figcaption>Success rate (%) on LIBERO, mean over the eleven physical shifts.</figcaption>`;
    document.getElementById("chart").innerHTML = s;
  })();

  /* ------------------------------------------------------------ media */
  const ROLL = [
    ["cos10_libero_spatial_t3_i12_payload35", "Cosmos Policy", "35 N payload while grasping", "pick up the black bowl on the cookie box and place it on the plate", 220, 102],
    ["cos10_libero_goal_t1_i19_gain03", "Cosmos Policy", "command gain ×0.3", "put the bowl on the stove", 300, 127],
    ["p05x_libero_spatial_t5_i4_force20", "π0.5", "20 N downward force", "pick up the black bowl on the ramekin and place it on the plate", 220, 85],
    ["fwx_libero_spatial_t0_i8_weak2_08", "Fast-WAM", "joint 2 at 80% of its torque", "pick up the black bowl between the plate and the ramekin and place it on the plate", 400, 195],
    ["cos10_libero_goal_t8_i14_lat6", "Cosmos Policy", "commands six steps late", "put the bowl on the plate", 300, 73],
    ["p05x_libero_goal_t7_i6_rvla_u01", "π0.5", "per-episode action offset 0.1", "turn on the stove", 300, 59],
    ["cos10_libero_spatial_t0_i19_weak4_07", "Cosmos Policy", "joint 4 at 70% of its torque", "pick up the black bowl between the plate and the ramekin and place it on the plate", 220, 78],
    ["cos10_libero_goal_t7_i18_rvla_c01", "Cosmos Policy", "constant action offset 0.1", "turn on the stove", 300, 68],
    ["p05x_libero_spatial_t0_i4_lat6", "π0.5", "commands six steps late", "pick up the black bowl between the plate and the ramekin and place it on the plate", 220, 90],
    ["plusx_libero_spatial_t263_i0_kp015", "Cosmos Policy", "stiffness ×0.15, with a LIBERO-Plus camera change", "pick up the black bowl between the plate and the ramekin and place it on the plate", 220, 105],
    ["plusx_libero_spatial_t2310_i0_payload35", "Cosmos Policy", "35 N payload, with a LIBERO-Plus lighting change", "pick up the black bowl on the cookie box and place it on the plate", 220, 74],
    ["plusx_libero_goal_t2444_i0_lat6", "Cosmos Policy", "commands six steps late, with a LIBERO-Plus lighting change", "put the bowl on the plate", 300, 87],
  ];
  const SHIFTS = [
    ["gain03", "Command gain ×0.3", 31.0], ["kp015", "Stiffness ×0.15", 26.9], ["weak4_07", "Joint 4 at 70% torque", 18.9],
    ["rvla_c01", "Constant action offset", 15.3], ["rs_gravity", "Gravity compensation error", 13.4], ["rs_aged_friction", "Aged joint friction", 13.2],
    ["force20", "20 N downward force", 12.9], ["payload35", "35 N payload while grasping", 12.9], ["lat6", "Commands six steps late", 9.2],
  ];
  const video = (src, poster, label) =>
    `<video muted loop playsinline preload="none" ${reduce ? "controls" : ""} poster="${poster}" aria-label="${label}"><source src="${src}" type="video/mp4"></video>`;
  document.getElementById("rollout-grid").innerHTML = ROLL.map(([f, pol, sh, task, fz, ra]) =>
    `<figure class="clip">${video(`assets/rollouts/${f}.mp4`, `assets/rollouts/${f}.jpg`, `${pol}, ${sh}: frozen on the left, with RoboAda on the right`)}
      <p><b>${pol}</b>, ${sh}</p><p class="task">${task}</p>
      <p>Frozen: out of time after ${fz} steps. With RoboAda: done in ${ra} steps.</p></figure>`).join("");
  document.getElementById("shift-grid").innerHTML = SHIFTS.map(([k, name, cm]) =>
    `<figure class="tile">${video(`assets/shifts/shift_${k}.mp4`, `assets/shifts/shift_${k}.jpg`, `${name}: the same commands on the normal and the changed robot`)}
      <p>${name}<span>up to ${cm.toFixed(0)} cm off the normal path</span></p></figure>`).join("");

  if (!reduce) {
    const io = new IntersectionObserver((es) => es.forEach((en) => {
      const v = en.target;
      if (en.isIntersecting) { v.play().catch(() => {}); } else { v.pause(); }
    }), { threshold: 0.4 });
    document.querySelectorAll("main video").forEach((v) => io.observe(v));
  }

  /* ------------------------------------------------------------ citation */
  document.getElementById("copy-bib").addEventListener("click", (ev) => {
    const t = document.querySelector("#bibtex code").textContent;
    navigator.clipboard.writeText(t).then(() => { ev.target.textContent = "Copied"; setTimeout(() => (ev.target.textContent = "Copy BibTeX"), 1600); });
  });
})();
