/* Rollout and shift galleries, citation. */
(function () {
  "use strict";
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
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
      <p><b>${pol.replace("π0.5", "π<sub>0.5</sub>")}</b>, ${sh}</p><p class="task">${task}</p>
      <p>Frozen: out of time after ${fz} steps. With RoboAda: done in ${ra} steps.</p></figure>`).join("");
  document.getElementById("shift-grid").innerHTML = SHIFTS.map(([k, name, cm]) =>
    `<figure class="tile">${video(`assets/shifts/shift_${k}.mp4`, `assets/shifts/shift_${k}.jpg`, `${name}: the same commands on the normal and the changed robot`)}
      <p>${name}<span>up to ${cm.toFixed(0)} cm off the normal path</span></p></figure>`).join("");
  if (!reduce) {
    const io = new IntersectionObserver((es) => es.forEach((en) => {
      const v = en.target;
      if (en.isIntersecting) v.play().catch(() => {}); else v.pause();
    }), { threshold: 0.4 });
    document.querySelectorAll("#rollout-grid video, #shift-grid video").forEach((v) => io.observe(v));
  }
  document.getElementById("copy-bib").addEventListener("click", (ev) => {
    const t = document.querySelector("#bibtex code").textContent;
    navigator.clipboard.writeText(t).then(() => { ev.target.textContent = "Copied"; setTimeout(() => (ev.target.textContent = "Copy BibTeX"), 1600); });
  });
})();
