// Finale: where you landed, the path you took, the full CISO ladder with sourced facts,
// and the assignment's reflection questions. Shown after Episode 5.
(function () {
  "use strict";
  // One set of year bands (tools/tree.py and the map use the same). They are this game's pacing, not an industry rule.
  const LADDER = [
    { lvl: "Entry", years: "years 0 to 4 in this game", roles: ["SOC Analyst (Tier 1 and 2)", "GRC Analyst", "IT with security duties", "Junior Penetration Tester"],
      certs: ["CompTIA Security+", "ISC2 Certified in Cybersecurity (CC)", "CompTIA CySA+"],
      fact: "BLS: information security analysts earned a $129,180 median in May 2025. That covers every experience level, so it is not starting pay. The lowest 10 percent earned under $75,090. BLS projects 21% growth from 2025 to 2035." },
    { lvl: "Mid-career", years: "years 5 to 8 in this game", roles: ["Security Engineer", "Security Architect", "Incident Response Lead", "Security Manager"],
      certs: ["CISSP (5 years of full-time work in 2 of its 8 domains)", "CISM", "CISA", "OSCP"],
      fact: "BLS: computer and information systems managers, the group that includes IT security managers, earned a $175,140 median in May 2025 and usually need 5 years or more of related work. IANS and Artico (2024 survey data): security architects averaged $206,000 and engineers $191,000 in annual cash pay." },
    { lvl: "Executive", years: "year 9 and up in this game", roles: ["Director of Security", "Chief Information Security Officer"],
      certs: ["CISSP", "CISM", "EC-Council CCISO"],
      fact: "IANS and Artico (May 2025 report, 2024 survey data): U.S. CISOs at companies with over $1B in revenue averaged $700,000 in total compensation, counting base, bonus and equity. The median was $532,000." },
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
    // the roads not taken, as a reason to play again (playtester note)
    const JOBS = { soc: "The night shift: a loud SOC queue and a vendor selling magic.", grc: "The Auditor: a federal examiner and a finding someone wants softened.", up: "Move Fast: a startup with no MFA, a leaked key at 1 AM, and a sale back to the bank." };
    const TRACKS = { mgr: "Manager: the CIO wants AI everywhere by Friday.", eng: "Engineer: a poisoned open-source library before a release.", ir: "Incident lead: a fake CEO wire at 4:55 PM and a ransomware crew's chat." };
    const BREACHES = { help: "The Help Desk: a phone call and a stolen login.", leak: "The Leak: an AI assistant repeating customer data.", supply: "The Supply Chain: attackers walk in through something you trusted." };
    const job = F.r_grc ? "grc" : F.r_up ? "up" : "soc", track = F.eng_track ? "eng" : F.ir_track ? "ir" : "mgr";
    const breach = F.rubber_stamp ? "leak" : supply ? "supply" : "help";
    const others = [...Object.entries(JOBS).filter(([k]) => k !== job).map(([, v]) => "First job. " + v),
      ...Object.entries(TRACKS).filter(([k]) => k !== track).map(([, v]) => "Promotion. " + v),
      ...Object.entries(BREACHES).filter(([k]) => k !== breach).map(([, v]) => "Breach. " + v)];
    // Passed Over keeps the Director seat, the first executive rung; Fortune 500, The Chair and Virtual CISO are executive seats
    const rung = { "Fortune 500": 2, "The Chair": 2, "Virtual CISO": 2, "Principal Engineer": 1, "Passed Over": 2, "Burned Out": 1, "Shown the Door": 1 }[st.ending] ?? 2;
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
        <ul class="src"><li>U.S. Bureau of Labor Statistics, Occupational Outlook Handbook: Information Security Analysts; Computer and Information Systems Managers.</li>
        <li>IANS Research and Artico Search: 2025 Compensation and Budget for CISOs in Large Enterprises (May 2025); 2025 Cybersecurity Staff Compensation Benchmark (February 2025).</li><li>ISC2, CISSP experience requirements.</li><li>Year bands are this game's pacing. No source gives a typical number of years to reach CISO.</li>
        <li>Story events adapted from CIS 424 cases (CIO vs CISO, the Twitter breach). Harborline Financial and every character are fictional.</li></ul>
        <h2>Try another road</h2>
        <ul class="src">${others.map(o => `<li>${esc(o)}</li>`).join("")}</ul>
        <h2>Credits</h2>
        <ul class="src"><li>Made by Purple Protocol for CIS 424 Computer Security Management at James Madison University, Fall 2026.</li>
        <li>Built with AI tools, and we say so plainly: the base episodes were drafted with Grok and the route storylines with Claude; the art was generated with OpenAI image generation through Codex; voices are Kokoro text to speech (Apache 2.0); the code and animation were built with Claude. The team chose the topic, directed and reviewed every part.</li>
        <li>Lip sync: Rhubarb Lip Sync (MIT). Animation: GSAP. Depth maps: Depth Anything V2 Small (Apache 2.0).</li>
        <li>Office hum: "air conditioner hum" and "air conditioner hum 2" by Gravity Sound (gravitysound.studio), via Wikimedia Commons, licensed CC BY 4.0, changed: mixed, looped, filtered, level adjusted.</li>
        <li>Rain, crowd and room tone: public domain recordings by cori, thore and rcrossley (PDSounds, via Wikimedia Commons). Street and garage tone: IgnasD and LEGIT Audio (CC0, OpenGameArt). Interface sounds: Kenney (CC0).</li></ul>
        <button id="again">PLAY AGAIN</button>
      </div>`;
    el.classList.add("on");
    document.getElementById("again").onclick = () => location.reload();
  };
})();
