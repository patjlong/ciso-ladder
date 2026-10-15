// "Previously on" recaps and end-of-episode choice stats, the two bookends of every episode.
// Stats read the same live relay the presentation uses (CL.TALLY), so the percentages are
// "your class", counted once per playthrough session, over the relay's 12-hour window.
(function () {
  "use strict";
  const esc = t => String(t).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  const ofEp = n => CL.state.log.filter(l => l.cid && l.cid.split(".")[0] === String(n));

  CL.previously = async function (n, rooms) {
    const prev = ofEp(n - 1).filter(l => !l.silent).slice(-3);
    if (n < 2 || !prev.length) return;
    await CL.card("The CISO Ladder", "Previously", "", 1600);
    for (const [i, l] of prev.entries()) {
      await CL.shot({ bg: rooms[i % rooms.length], cut: "dissolve", xdur: .7, shake: .0008,
                      cam: { from: { zoom: 1.15 }, to: { zoom: 1.05 }, dur: 4 } });
      await CL.caption(`You: "${l.t}"`, 2300);
    }
  };

  // tally[cid][option] = number of sessions that picked it
  async function fetchTally() {
    try {
      const txt = await fetch(`${CL.TALLY}/json?poll=1&since=12h`, { cache: "no-store" }).then(r => r.text());
      const seen = new Set(), tally = {};
      for (const line of txt.split("\n")) {
        if (!line.trim()) continue;
        let m; try { m = JSON.parse(JSON.parse(line).message); } catch { continue; }
        if (!m || !m.c || typeof m.o !== "number") continue;
        const key = m.s + "|" + m.c;
        if (seen.has(key)) continue;  // one vote per playthrough per choice
        seen.add(key);
        ((tally[m.c] ||= {})[m.o] = (tally[m.c][m.o] || 0) + 1);
      }
      return tally;
    } catch { return null; }
  }

  CL.choiceStats = async function (n) {
    const mine = ofEp(n);
    if (!mine.length || CL.fast) return;
    const tally = await fetchTally();
    const el = document.getElementById("stats");
    const rows = mine.slice(0, 5).map(l => {
      const t = tally && tally[l.cid], total = t ? Object.values(t).reduce((a, b) => a + b, 0) : 0;
      const same = t && l.o != null ? (t[l.o] || 0) : 0;
      const pct = total ? Math.round(100 * same / total) : null;
      return `<div class="srow"><div class="stxt">${esc(l.silent ? "You froze." : l.t)}</div>
        <div class="sbar"><i style="width:${pct ?? 0}%"></i></div>
        <div class="spct">${pct == null ? "first to play" : `${pct}% of your class`}</div></div>`;
    }).join("");
    el.innerHTML = `<div class="sbox"><div class="k">End of Episode ${n}</div><h2>Your choices</h2>${rows}
      <button id="scont">CONTINUE</button></div>`;
    el.classList.add("on");
    await new Promise(r => (document.getElementById("scont").onclick = r));
    el.classList.remove("on");
  };
})();
