/* Results and identification charts. Numbers are the paper's (Tables 1 and 3, and the identification runs). */
(function () {
  "use strict";
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const PI0 = "π<sub>0</sub>", PI05 = "π<sub>0.5</sub>";

  /* ---------------------------------------------------------------- 1. every policy, every family of shifts */
  const POL = [["Cosmos Policy", "WAM, 2B"], ["Fast-WAM", "WAM"], [PI0, "VLA, 3B"], [PI05, "VLA, 3B"], ["OpenVLA-OFT", "VLA, 7B"]];
  const FAM = [
    ["Physical (11)", "the eleven physical shifts: command gain ×0.3 and ×0.5, a gain drop, stiffness ×0.15, six steps of latency, constant and per-episode offsets, a 20 N force, a 35 N payload while grasping and two weakened joints",
      [[25.1, 73.2], [23.5, 51.9], [28.8, 55.7], [35.0, 71.2], [26.8, 62.3]]],
    ["Joint-level (5)", "five joint-level degradations re-implemented from RoboStress: doubled or drifting friction and gravity-compensation errors, injected below the unchanged controller",
      [[38.3, 75.3], [25.7, 46.8], [38.3, 61.3], [45.7, 75.7], [33.7, 66.3]]],
    ["Objects 100× heavier", "objects that look as before but are 100 times heavier",
      [[58.0, 76.5], [55.3, 64.5], [60.3, 73.8], [63.0, 72.0], [58.5, 75.0]]],
    ["Action perturbations (5)", "the five action perturbations of the RobustVLA protocol: uniform offset, bias, Gaussian noise, random flips and spikes",
      [[64.4, 74.9], [51.6, 62.5], [45.0, 65.8], [62.8, 75.9], [46.6, 66.8]]],
    ["+ LIBERO-Plus", "four physical shifts added to the perception and language changes of LIBERO-Plus",
      [[21.4, 62.6], [16.1, 34.4], [16.3, 38.9], [32.4, 64.3], [19.4, 59.9]]],
    ["+ LIBERO-PRO", "four physical shifts added to the perception and language changes of LIBERO-PRO",
      [[17.7, 46.9], [13.1, 23.3], [17.7, 39.1], [23.9, 46.6], [15.5, 44.3]]],
    ["+ LIBERO-MAX", "four physical shifts added to the mid-execution world changes of LIBERO-MAX",
      [[12.4, 42.4], [8.5, 18.4], [12.3, 27.7], [21.8, 49.1], [12.6, 40.2]]],
  ];
  const famTabs = document.getElementById("fam-tabs"), famChart = document.getElementById("fam-chart"), famCap = document.getElementById("fam-cap");
  if (famTabs && famChart) {
    famChart.innerHTML = `<div class="legend"><span><i style="background:var(--frozen)"></i>frozen policy</span><span><i style="background:var(--ours)"></i>+ RoboAda</span></div>` +
      POL.concat([["Mean of the five", ""]]).map(([n, s], i) =>
        `<div class="brow${i === 5 ? " mean" : ""}"><span class="nm">${n}${s ? `<small>${s}</small>` : ""}</span>
          <div class="trackbox"><div class="track"><i class="bar fz"></i><b class="val fz"></b></div><div class="track"><i class="bar ra"></i><b class="val ra"></b></div></div>
          <span class="delta"></span></div>`).join("") +
      `<div class="axis"><span></span><div><span>0</span><span>25</span><span>50</span><span>75</span><span>100%</span></div><span></span></div>`;
    const rows = [...famChart.querySelectorAll(".brow")];
    const tabs = FAM.map(([name], j) => {
      const b = document.createElement("button");
      b.setAttribute("role", "tab"); b.setAttribute("aria-selected", "false");
      b.innerHTML = `${name}<span class="timer"></span>`;
      b.addEventListener("click", () => { stopAuto(); show(j); });
      famTabs.appendChild(b);
      return b;
    });
    let cur = -1, seen = false;
    function show(j) {
      cur = j;
      tabs.forEach((b, i) => b.setAttribute("aria-selected", String(i === j)));
      const vals = FAM[j][2].slice();
      const mean = [0, 1].map((m) => vals.reduce((s, v) => s + v[m], 0) / vals.length);
      vals.push(mean);
      rows.forEach((row, i) => {
        const [f, r] = seen ? vals[i] : [0, 0];
        const bars = row.querySelectorAll(".bar"), lab = row.querySelectorAll(".val");
        bars[0].style.width = f + "%"; bars[1].style.width = r + "%";
        lab[0].style.left = f + "%"; lab[1].style.left = r + "%";
        lab[0].textContent = seen ? vals[i][0].toFixed(1) : ""; lab[1].textContent = seen ? vals[i][1].toFixed(1) : "";
        row.querySelector(".delta").textContent = seen ? `+${(vals[i][1] - vals[i][0]).toFixed(1)}` : "";
      });
      famCap.textContent = `Success (%) on LIBERO under ${FAM[j][1]}. Same episodes with and without RoboAda.`;
    }
    // advance through the families on its own while in view, until a tab is clicked
    const DUR = 4.2;
    let auto = !reduce, timer = null;
    function arm() {
      tabs.forEach((b) => b.querySelector(".timer").classList.remove("run"));
      if (!auto) return;
      const tm = tabs[cur].querySelector(".timer");
      tm.style.setProperty("--dur", DUR + "s"); void tm.offsetWidth; tm.classList.add("run");
      clearTimeout(timer); timer = setTimeout(() => { show((cur + 1) % FAM.length); arm(); }, DUR * 1000);
    }
    function stopAuto() { auto = false; clearTimeout(timer); tabs.forEach((b) => b.querySelector(".timer").classList.remove("run")); }
    show(0);
    new IntersectionObserver((es) => {
      const vis = es[0].isIntersecting;
      if (vis && !seen) { seen = true; requestAnimationFrame(() => show(cur)); }
      if (vis && auto) arm(); else clearTimeout(timer);
    }, { threshold: 0.35 }).observe(famChart);
  }

  /* ---------------------------------------------------------------- 2. against test-time adaptation, re-ranked per group */
  const TTA = [["Frozen policy", 42.1, 26.3, 33.0, 95.0], ["TTT layer", 21.3, 36.9, 30.2, 47.5], ["AdaJEPA", 46.3, 35.0, 39.8, 93.8],
    ["Sandwich-Residuals", 39.6, 44.7, 42.5, 87.5], ["RMA-style", 57.1, 35.6, 44.8, 90.0], ["JEPA-TTT", 35.0, 53.4, 45.5, 86.3],
    ["ALRA", 56.7, 39.4, 46.8, 95.0], ["GrBAL", 38.8, 62.5, 52.3, 81.3], ["RoboAda", 73.8, 66.6, 69.6, 95.0]];
  const GROUPS = [["All physical shifts", 3], ["Actuation", 1], ["Contact and load", 2], ["No shift", 4]];
  const ttaTabs = document.getElementById("tta-tabs"), ttaChart = document.getElementById("tta-chart");
  if (ttaTabs && ttaChart) {
    const RH = 36;
    ttaChart.style.height = TTA.length * RH + 26 + "px";
    ttaChart.innerHTML = TTA.map(([n]) => `<div class="rrow${n === "RoboAda" ? " ours" : n === "Frozen policy" ? " frozen" : ""}"><span class="nm">${n}</span>
      <div class="trackbox"><div class="track"><i class="bar"></i><b class="val"></b></div></div><span></span></div>`).join("") +
      `<div class="axis" style="position:absolute;left:0;right:0;top:${TTA.length * RH + 6}px"><span></span><div><span>0</span><span>25</span><span>50</span><span>75</span><span>100%</span></div><span></span></div>`;
    const rows = [...ttaChart.querySelectorAll(".rrow")];
    let seen = false, cur = 0;
    const tabs = GROUPS.map(([name], j) => {
      const b = document.createElement("button");
      b.setAttribute("role", "tab"); b.setAttribute("aria-selected", String(j === 0)); b.textContent = name;
      b.addEventListener("click", () => show(j));
      ttaTabs.appendChild(b);
      return b;
    });
    function show(j) {
      cur = j;
      tabs.forEach((b, i) => b.setAttribute("aria-selected", String(i === j)));
      const col = GROUPS[j][1];
      const order = TTA.map((r, i) => [r[col], r[0] === "RoboAda" ? 1 : 0, i]).sort((a, b) => b[0] - a[0] || b[1] - a[1]).map((x) => x[2]);
      order.forEach((i, rank) => {
        const row = rows[i], v = TTA[i][col];
        row.style.transform = `translateY(${rank * RH}px)`;
        row.querySelector(".bar").style.width = (seen ? v : 0) + "%";
        const lab = row.querySelector(".val");
        lab.style.left = (seen ? v : 0) + "%"; lab.textContent = seen ? v.toFixed(1) : "";
      });
    }
    show(0);
    new IntersectionObserver((es) => { if (es[0].isIntersecting && !seen) { seen = true; requestAnimationFrame(() => show(cur)); } }, { threshold: 0.35 }).observe(ttaChart);
  }

  /* ---------------------------------------------------------------- 3. identification, drawn chunk by chunk */
  const ident = document.getElementById("ident");
  if (ident) {
    fetch("assets/ident_bands.json").then((r) => r.json()).then((D) => {
      const NS = "http://www.w3.org/2000/svg";
      const PANELS = [
        { key: "gain", title: "Fitted command gain", y0: 0.2, y1: 1.1, ticks: [0.3, 0.5, 0.7, 1.0], fmt: (v) => v.toFixed(1),
          series: [["gain0.3", "gain ×0.3", "#1f3a68", 0.3], ["gain0.5", "gain ×0.5", "#4c72b0", 0.5], ["gain0.7", "gain ×0.7", "#9db5da", 0.7],
            ["kp0.15", "stiffness ×0.15", "#d9a21b", null], ["nominal", "no shift", "#818789", 1.0]],
          note: "dashed: the true gain" },
        { key: "offz", title: "Fitted vertical offset", y0: -0.125, y1: 0.02, ticks: [-0.1, -0.05, 0], fmt: (v) => (v === 0 ? "0" : v.toFixed(2)),
          series: [["payload35", "35 N payload", "#f08e29", null], ["mass100", "objects 100× heavier", "#a0522d", null],
            ["kp0.15", "stiffness ×0.15", "#d9a21b", null], ["nominal", "no shift", "#818789", null]],
          note: "zero: no offset" },
      ];
      const W = 480, Hh = 290, ml = 58, mr = 14, mt = 12, mb = 40, K = 14;
      const sx = (c) => ml + ((c - 1) / (K - 1)) * (W - ml - mr);
      const built = PANELS.map((P) => {
        const box = document.createElement("div");
        box.innerHTML = `<h3>${P.title}</h3>`;
        const svg = document.createElementNS(NS, "svg");
        svg.setAttribute("viewBox", `0 0 ${W} ${Hh}`); svg.setAttribute("role", "img");
        svg.setAttribute("aria-label", `${P.title} per chunk for several hidden changes`);
        const sy = (v) => mt + (1 - (v - P.y0) / (P.y1 - P.y0)) * (Hh - mt - mb);
        let s = "";
        P.ticks.forEach((v) => { s += `<line x1="${ml}" x2="${W - mr}" y1="${sy(v)}" y2="${sy(v)}" stroke="#eef1f4"/><text x="${ml - 8}" y="${sy(v) + 4}" text-anchor="end" font-size="15" fill="#8b939e">${P.fmt(v)}</text>`; });
        [1, 4, 8, 12].forEach((c) => { s += `<text x="${sx(c)}" y="${Hh - mb + 20}" text-anchor="middle" font-size="15" fill="#8b939e">${c}</text>`; });
        s += `<text x="${(ml + W - mr) / 2}" y="${Hh - 4}" text-anchor="middle" font-size="15" fill="#5b6472">chunk</text>`;
        s += `<line x1="${ml}" x2="${ml}" y1="${mt}" y2="${Hh - mb}" stroke="#b9c0c9"/><line x1="${ml}" x2="${W - mr}" y1="${Hh - mb}" y2="${Hh - mb}" stroke="#b9c0c9"/>`;
        if (P.key === "offz") s += `<line x1="${ml}" x2="${W - mr}" y1="${sy(0)}" y2="${sy(0)}" stroke="#c9cfd6"/>`;
        P.series.forEach(([, , col, truth]) => { if (truth !== null) s += `<line x1="${ml}" x2="${W - mr}" y1="${sy(truth)}" y2="${sy(truth)}" stroke="${col}" stroke-width="1.2" stroke-dasharray="5 4" opacity="0.8"/>`; });
        s += `<line class="cursor" x1="0" x2="0" y1="${mt}" y2="${Hh - mb}" stroke="#1e2530" stroke-width="1" opacity="0.25"/>`;
        P.series.slice().reverse().forEach(([k, , col]) => { s += `<path class="band" data-k="${k}" fill="${col}" opacity="0.14"/><path class="line" data-k="${k}" fill="none" stroke="${col}" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round"/><circle class="head" data-k="${k}" r="4" fill="${col}"/>`; });
        svg.innerHTML = s;
        box.appendChild(svg);
        const leg = document.createElement("div");
        leg.className = "leg";
        leg.innerHTML = P.series.map(([, n, col]) => `<span><i style="background:${col}"></i>${n}</span>`).join("") + `<span>${P.note}</span>`;
        box.appendChild(leg);
        ident.appendChild(box);
        return { P, svg, sy };
      });
      function draw(c) { // c: chunks shown, fractional
        built.forEach(({ P, svg, sy }) => {
          svg.querySelector(".cursor").setAttribute("x1", sx(Math.max(1, Math.min(K, c))));
          svg.querySelector(".cursor").setAttribute("x2", sx(Math.max(1, Math.min(K, c))));
          svg.querySelector(".cursor").setAttribute("opacity", c >= K ? 0 : 0.25);
          P.series.forEach(([k]) => {
            const pts = D[P.key][k], n = pts.length;
            const upto = Math.min(c, pts[n - 1][0]);
            const vis = [];
            for (let i = 0; i < n; i++) {
              if (pts[i][0] <= upto) vis.push(pts[i]);
              else if (i > 0 && pts[i - 1][0] < upto) { const q = upto - pts[i - 1][0]; vis.push(pts[i - 1].map((v, m) => v + (pts[i][m] - v) * q)); break; }
            }
            const line = svg.querySelector(`.line[data-k="${k}"]`), band = svg.querySelector(`.band[data-k="${k}"]`), head = svg.querySelector(`.head[data-k="${k}"]`);
            if (!vis.length) { line.setAttribute("d", ""); band.setAttribute("d", ""); head.setAttribute("opacity", 0); return; }
            line.setAttribute("d", "M" + vis.map((p) => `${sx(p[0]).toFixed(1)} ${sy(p[1]).toFixed(1)}`).join(" L"));
            band.setAttribute("d", "M" + vis.map((p) => `${sx(p[0]).toFixed(1)} ${sy(p[3]).toFixed(1)}`).join(" L") + " L" + vis.slice().reverse().map((p) => `${sx(p[0]).toFixed(1)} ${sy(p[2]).toFixed(1)}`).join(" L") + "Z");
            const last = vis[vis.length - 1];
            head.setAttribute("cx", sx(last[0])); head.setAttribute("cy", sy(last[1])); head.setAttribute("opacity", 1);
          });
        });
      }
      let raf = null, t0 = 0, played = false;
      const SPEED = 2.2; // chunks per second
      function play() {
        cancelAnimationFrame(raf); t0 = performance.now();
        const step = (now) => { const c = 1 + ((now - t0) / 1000) * SPEED; draw(c); if (c < K + 0.5) raf = requestAnimationFrame(step); };
        raf = requestAnimationFrame(step);
      }
      if (reduce) draw(K + 1); else draw(1);
      new IntersectionObserver((es) => { if (es[0].isIntersecting && !played && !reduce) { played = true; play(); } }, { threshold: 0.4 }).observe(ident);
      document.getElementById("ident-replay").addEventListener("click", () => (reduce ? draw(K + 1) : play()));
    });
  }
})();
