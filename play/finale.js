// Finale: where you landed, the path you took, the full CISO ladder with sourced facts,
// and the assignment's reflection questions. Shown after Episode 5.
(function () {
  "use strict";
  // One set of year bands (tools/tree.py uses the same). Typical, and they vary by person and employer.
  const LADDER = [
    { lvl: "Entry", years: "typically years 0 to 4", roles: ["SOC Analyst (Tier 1 and 2)", "GRC Analyst", "IT with security duties", "Junior Penetration Tester"],
      certs: ["CompTIA Security+", "ISC2 Certified in Cybersecurity (CC)", "CompTIA CySA+"],
      fact: "BLS median pay for information security analysts: $129,180 (May 2025). That is the median across all experience levels, not starting pay. Projected growth: 21% from 2025 to 2035." },
    { lvl: "Mid-career", years: "typically years 5 to 9", roles: ["Security Engineer", "Incident Response Lead", "Security Architect", "Security Manager", "Director of Security (the bridge rung to executive)"],
      certs: ["CISSP (requires 5 years of paid experience)", "OSCP", "CISA"],
      fact: "The jump from analyst to manager is where business communication starts to matter as much as technical skill." },
    { lvl: "Executive", years: "typically years 10 and up", roles: ["VP of Information Security", "Chief Information Security Officer"],
      certs: ["CISM", "CISSP", "Business or executive education (common, not required)"],
      fact: "IANS / Artico 2025: median CISO total compensation of $532,000 at US enterprises with over $1B in revenue, the closest public benchmark for Fortune 500 CISO pay." },
  ];
  const EP = { 1: "Night Shift", 2: "Tier Two", 3: "The Middle Rungs", 4: "The Help Desk", 5: "The Corner Office" };
  const esc = t => String(t).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

  CL.finale = function () {
    const st = CL.state, el = document.getElementById("finale");
    const byEp = {};
    st.log.forEach(l => { const n = (l.cid || "0").split(".")[0]; (byEp[n] ||= []).push(l); });
    // which of the 19 storylines this player lived (story/routes.md)
    const F = st.flags, supply = (F.waived_vendor || F.cut_corners || F.skipped_review) && !F.rubber_stamp;
    const title = { ...EP, 2: F.r_grc ? "The Auditor" : F.r_up ? "Move Fast" : EP[2],
      3: F.eng_track ? "The Builder" : F.ir_track ? "On Call" : EP[3], 4: F.rubber_stamp ? "The Leak" : supply ? "The Supply Chain" : "The Help Desk" };
    const story = [F.r_grc ? "Risk and compliance analyst" : F.r_up ? "Startup security hire" : "SOC analyst",
      F.eng_track ? "Senior engineer" : F.ir_track ? "Incident response lead" : "Security manager", title[4]];
    // Passed Over keeps the Director seat, the top of mid-career; Fortune 500, The Chair and Virtual CISO are executive seats
    const rung = { "Fortune 500": 2, "The Chair": 2, "Virtual CISO": 2, "Principal Engineer": 1, "Passed Over": 1, "Burned Out": 1, "Shown the Door": 1 }[st.ending] ?? 2;
    el.innerHTML = `
      <div class="fin">
        <div class="k">Your ending</div>
        <h1>${esc(st.ending || "The Ladder")}</h1>
        <p class="who">${esc(st.name)} &middot; skill ${st.stats.skill} &middot; reputation ${st.stats.rep} &middot; exec trust ${st.stats.trust} &middot; burnout ${st.stats.burn}</p>
        <h2>The ladder</h2>
        <div class="ladder">${LADDER.map((L, i) => `<div class="rung ${i === rung ? "here" : ""}">
          <div class="lvl">${L.lvl} <span>${L.years}</span>${i === rung ? '<b>you landed here</b>' : ""}</div>
          <div class="roles">${L.roles.map(esc).join(" &middot; ")}</div>
          <div class="certs">${L.certs.map(esc).join(" &middot; ")}</div>
          <div class="fact">${esc(L.fact)}</div></div>`).reverse().join("")}</div>
        <h2>Your path</h2>
        <p class="who">Your storyline: ${story.map(esc).join(" &rarr; ")}. One of 19 different storylines in this game.</p>
        ${Object.keys(byEp).sort().map(n => `<div class="ep"><div class="lvl">Episode ${n}: ${title[n] || ""}</div><ol>${byEp[n].map(l => `<li class="${l.silent ? "silent" : ""}">${esc(l.silent ? "You froze. The timer ran out." : l.t)}</li>`).join("")}</ol></div>`).join("")}
        <h2>Think about it</h2>
        <ol class="q"><li>Is this path desirable to you? Why or why not?</li><li>Does it change your expectations as a future graduate?</li><li>Which choice changed your story the most?</li></ol>
        <h2>Sources</h2>
        <ul class="src"><li>U.S. Bureau of Labor Statistics, Occupational Outlook Handbook: Information Security Analysts.</li>
        <li>IANS Research and Artico Search, 2025 CISO Compensation Report.</li><li>ISC2, CISSP experience requirements.</li>
        <li>Story events adapted from CIS 424 cases (CIO vs CISO, the Twitter breach). Harborline Financial and every character are fictional.</li></ul>
        <button id="again">PLAY AGAIN</button>
      </div>`;
    el.classList.add("on");
    document.getElementById("again").onclick = () => location.reload();
  };
})();
