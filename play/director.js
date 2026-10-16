// The director: plays a converted episode (game/episodes/epN.json) like a cut film.
// Each scene opens on an establishing shot of its room, then cuts shot/reverse-shot:
// whoever speaks gets a close-up over that room with the background pulled out of focus.
// Hand-made shots in a scene override this (CL.directorOverrides[sceneId]).
(function () {
  "use strict";
  // location text from the script -> painted room (first match wins)
  const ROOMS = [
    [/career fair|campus/i, "career_fair"], [/apartment|kitchen|couch/i, "apartment"],
    [/war room|comms|incident/i, "war_room"], [/legal/i, "legal_room"], [/hall/i, "hallway"],
    [/board/i, "boardroom"], [/elena|ceo/i, "ceo_office"], [/priya|cio/i, "priya_office"],
    [/dana|director|your office/i, "dana_office"], [/conference|glass/i, "conference_glass"],
    [/garage|stairwell/i, "garage"], [/lobby/i, "lobby"], [/airport/i, "airport_curb"],
    [/soc|floor|engineering|corner/i, "soc_day"],
  ];
  const NIGHT = /night|3 ?am|2 ?am|late|evening/i;
  function roomFor(scene) {
    const loc = scene.location || "";
    for (const [re, bg] of ROOMS) if (re.test(loc)) {
      if (bg === "soc_day" && NIGHT.test(loc)) return "soc_night";
      return bg;
    }
    return "soc_night";
  }
  // speaker -> close-up rig; the player uses their chosen look
  const RIGS = { PLAYER: "PLAYER_desk", Marcus: "marcus_office", Dana: "dana", Priya: "priya", Sam: "sam",
                 Jordan: "jordan", Elena: "elena", Richard: "richard", Nadia: "nadia", Theo: "theo",
                 Vendor: "vendor", "New Hire": "newhire", Recruiter: "recruiter" };
  const COLORS = { PLAYER: "#7fd1c7", Marcus: "#e8b33a", Dana: "#9fb7ff", Priya: "#ff9fb2", Sam: "#ffb35c",
                   Jordan: "#c6ff7a", Elena: "#f4e3b8", Richard: "#c9c9c9", Nadia: "#d79bff", Theo: "#7af0ff" };
  CL.speakerColor = who => COLORS[who] || "#e8b33a";
  // which way each painted rig faces; in a close-up the speaker should look toward the player
  const FACES_LEFT = new Set(["richard", "marcus_phone", "marcus_office"]);

  // rooms lit by the SOC's teal monitors; everywhere else the player gets the warm-lit look
  const TEAL_ROOMS = new Set(["soc_night", "war_room"]);
  function rigFor(who, bg) {
    const want = RIGS[who] || who.toLowerCase();
    const have = CL.manifest.rigs || [];
    if (want === "PLAYER_desk") {
      // the player dresses up as they climb: executive look from Episode 3 on, when drawn
      if ((CL.state.episode || 1) >= 3 && have.includes(`${CL.state.preset}_exec`)) return "PLAYER_exec";
      if (bg && !TEAL_ROOMS.has(bg) && have.includes(`${CL.state.preset}_warm`)) return "PLAYER_warm";
      return want;
    }
    if (have.includes(want)) return want;
    if (who === "Marcus" && have.includes("marcus_phone")) return "marcus_phone";
    return null;  // no art yet: subtitle over the room
  }
  function closeUp(who, bg) {
    const rig = rigFor(who, bg);
    const isP = who === "PLAYER";
    return { bg, focus: rig ? "near" : null, shake: .0012,
      actors: rig ? [{ rig, who, x: isP ? 4 : 44, y: 0, h: 90, z: 1.3, flip: !isP && !FACES_LEFT.has(rig) }] : [],
      cam: { from: { zoom: 1.08, x: isP ? .06 : -.06 }, to: { zoom: 1.14, x: isP ? .08 : -.08 }, dur: 9 } };
  }
  function establish(bg) {
    return { bg, cut: "dissolve", xdur: .9, shake: .0009,
      cam: { from: { zoom: 1.18, px: -.025 }, to: { zoom: 1.04, px: .025 }, dur: 8 } };
  }

  // turn a scene into engine beats, cutting only when the speaker changes
  function beatsFor(scene, ctx) {
    const bg = roomFor(scene), out = [];
    const ov = (CL.directorOverrides || {})[scene.id];
    if (ov) return ov(scene, bg);
    out.push({ shot: establish(bg), wait: 900 });
    if (scene.location) out.push({ caption: scene.location.replace(/^Harborline Financial,?\s*/i, "Harborline ") });
    let k = 0;  // choice ids "<scene>#<k>" match tools/tree.py and the presentation's tallies
    const walk = list => list.map(b => {
      if (b.say) {
        const [who, id, text] = b.say;
        const r = [];
        if (ctx.last !== who) { r.push({ shot: Object.assign(closeUp(who, bg), { cut: "hard" }), when: b.when }); if (!b.when) ctx.last = who; }
        r.push({ say: [who, id, text, CL.speakerColor(who)], when: b.when });
        return r;
      }
      if (b.caption) return [{ caption: b.caption }];
      if (b.choice) {
        // the choice plays on the player's face; each option's reply cuts as needed
        const lead = ctx.last === "PLAYER" ? [] : [{ shot: Object.assign(closeUp("PLAYER", bg), { cut: "hard" }) }];
        ctx.last = "PLAYER";
        const opts = b.choice.options.map(o => { ctx.last = "PLAYER"; return Object.assign({}, o, { then: walk(o.then).flat() }); });
        ctx.last = null;  // branches end on different speakers, so always cut after a choice
        return lead.concat([{ timed: b.choice.timed, choice: opts, when: b.when, cid: `${scene.id}#${++k}` }]);
      }
      return [];
    });
    return out.concat(walk(scene.beats).flat());
  }

  CL.playEpisode = async function (ep, n, title) {
    CL.state.episode = n;
    await CL.previously(n, CL.lastRooms || ["soc_night"]);
    await CL.card(`Episode ${n}`, title || ep.title || "", ep.subtitle || "");
    CL.lastRooms = [];
    for (const sc of ep.scenes) {
      if (sc.when && !CL.when(sc.when)) continue;   // e.g. only one of Episode 5's endings plays
      CL.lastRooms.push(sc.id === "1.3" ? "soc_night" : roomFor(sc));
      if (sc.id === "5.9") {
        CL.state.ending = sc.name.replace(/^[a-g]\s+/, "");
        CL.state.flags["end_" + sc.name[0]] = true;  // the closing narration calls back to the ending
      }
      await CL.run(beatsFor(sc, { last: null }));
    }
    // episodes with several end cards (Episode 5) show the one whose condition holds
    const endCard = ep.ends ? (ep.ends.find(c => !c.when || CL.when(c.when)) || {}).text : ep.end;
    if (endCard) await CL.card(`End of Episode ${n}`, endCard, "", 4200);
    await CL.choiceStats(n);
  };
  CL.roomFor = roomFor;
})();
