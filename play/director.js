// The director: plays a converted episode (game/episodes/epN.json) like a cut film.
// Each scene opens on an establishing shot of its room, then cuts shot/reverse-shot:
// whoever speaks gets a close-up over that room with the background pulled out of focus.
// Hand-made shots in a scene override this (CL.directorOverrides[sceneId]).
(function () {
  "use strict";
  // location text from the script -> painted room (first match wins)
  const ROOMS = [
    [/kestrel|loft/i, "startup_loft"], [/risk|compliance/i, "risk_office"], [/\blab\b/i, "eng_lab"],
    [/office couch/i, "dana_office"], [/marcus/i, "soc_day"],
    [/career fair|campus/i, "career_fair"], [/apartment|kitchen|couch/i, "apartment"],
    [/war room|comms|incident/i, "war_room"], [/legal/i, "legal_room"], [/hall/i, "hallway"],
    [/board/i, "boardroom"], [/elena|ceo/i, "ceo_office"], [/priya|cio/i, "priya_office"],
    [/dana|director|your office/i, "dana_office"], [/conference|glass/i, "conference_glass"],
    [/garage|stairwell/i, "garage"], [/lobby/i, "lobby"], [/airport/i, "airport_curb"],
    [/soc|floor|engineering|corner/i, "soc_day"],
  ];
  const NIGHT = /night|\b[1-3] ?am\b|evening/i;  // not "late": "late afternoon" is daylight
  // route rooms painted later than the rest; until a room exists, play the nearest older one
  const STANDIN = { startup_loft: "soc_day", startup_loft_night: "soc_night", risk_office: "legal_room", eng_lab: "soc_day" };
  // scenes whose location text names someone else's room although the player is at home on a call
  const ROOM_BY_ID = { "4.4": "apartment", "4.4l": "apartment" };
  function roomFor(scene) {
    if (ROOM_BY_ID[scene.id]) return ROOM_BY_ID[scene.id];
    const loc = scene.location || "";
    for (const [re, bg] of ROOMS) if (re.test(loc)) {
      let room = bg;
      if (bg === "soc_day" && NIGHT.test(loc)) room = "soc_night";
      if (bg === "startup_loft" && NIGHT.test(loc)) room = "startup_loft_night";
      return STANDIN[room] && !CL.hasBg(room) ? STANDIN[room] : room;
    }
    return "soc_night";
  }
  // speaker -> close-up rig; the player uses their chosen look
  const RIGS = { PLAYER: "PLAYER_desk", Marcus: "marcus_office", Dana: "dana", Priya: "priya", Sam: "sam",
                 Jordan: "jordan", Elena: "elena", Richard: "richard", Nadia: "nadia", Theo: "theo",
                 Vendor: "vendor", "New Hire": "newhire", Recruiter: "recruiter", Examiner: "examiner" };
  const COLORS = { PLAYER: "#7fd1c7", Marcus: "#e8b33a", Dana: "#9fb7ff", Priya: "#ff9fb2", Sam: "#ffb35c",
                   Jordan: "#c6ff7a", Elena: "#f4e3b8", Richard: "#c9c9c9", Nadia: "#d79bff", Theo: "#7af0ff",
                   Examiner: "#b8d4c4" };
  CL.speakerColor = who => COLORS[who] || "#e8b33a";
  // Every cast rig is painted facing screen left, toward the player's side of a shot/reverse-shot
  // (checked 2026-10-20 on art/preview/eyelines_now.png: the old flip list turned 11 of 14 to look out of frame).
  // A rig painted facing right would go here to be mirrored.
  const FACES_RIGHT = new Set([]);

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
  // People who are on a call appear in a call window over the room the player is in, not standing in it
  // (council review: the CEO's video call and the 2 AM pages put people in the player's kitchen).
  // Keyed by scene id; Episode 5's endings share "5.9", so they use "5.9" plus the ending letter.
  const REMOTE = {
    "2.6x": { Dana: "phone" }, "3.2": { Jordan: "phone" }, "3.2e": { Jordan: "phone" }, "3.5i": { Sam: "phone" },
    "4.1": { Sam: "video", Marcus: "phone" }, "4.1l": { Sam: "video", Marcus: "phone" }, "4.1s": { Sam: "video", Marcus: "phone" },
    "4.4": { Elena: "video" }, "4.4l": { Elena: "video" }, "4.4s": { Elena: "video" },
    "4.7": { Dana: "phone" }, "4.7l": { Dana: "phone" }, "4.7s": { Dana: "phone" },
    "5.8": { Jordan: "phone" }, "5.9b": { Elena: "phone", Sam: "phone" },
  };
  const sceneKey = sc => sc.id === "5.9" ? "5.9" + sc.name[0] : sc.id;
  function closeUp(who, bg, remote) {
    const rig = rigFor(who, bg);
    const isP = who === "PLAYER";
    if (rig && remote) return { bg, shake: .0009,
      actors: [{ rig, who, remote, x: 50, y: 16, h: 64, z: .6, mx: 50, my: 27, mh: 42 }],  // mh 42: fits a 375 px phone
      cam: { from: { zoom: 1.04, x: -.03 }, to: { zoom: 1.08, x: -.04 }, dur: 9 } };
    return { bg, focus: rig ? "near" : null, shake: .0012,
      actors: rig ? [{ rig, who, x: isP ? 4 : 44, y: 0, h: 90, z: 1.3, flip: !isP && FACES_RIGHT.has(rig) }] : [],
      cam: { from: { zoom: 1.08, x: isP ? .06 : -.06 }, to: { zoom: 1.14, x: isP ? .08 : -.08 }, dur: 9 } };
  }
  function establish(bg) {
    return { bg, cut: "dissolve", xdur: .9, shake: .0009,
      cam: { from: { zoom: 1.18, px: -.025 }, to: { zoom: 1.04, px: .025 }, dur: 8 } };
  }

  // turn a scene into engine beats, cutting only when the speaker changes
  function beatsFor(scene, ctx) {
    const bg = roomFor(scene), out = [], remote = REMOTE[sceneKey(scene)] || {};
    const ov = (CL.directorOverrides || {})[scene.id];
    if (ov) return ov(scene, bg);
    out.push({ shot: establish(bg), wait: CL.classMode ? 500 : 900 });
    if (scene.location) out.push({ caption: scene.location.replace(/^Harborline Financial,?\s*/i, "Harborline "), aside: true });
    let k = 0;  // choice ids "<scene>#<k>" match tools/tree.py and the presentation's tallies
    // Every line gets a close-up of its speaker, marked unlessOn: the runner skips it when that person is
    // already on screen. Deciding at play time keeps the right face up when a conditional line is skipped
    // (Codex review: the old build-time "last speaker" could leave the wrong person talking).
    const walk = list => list.map(b => {
      if (b.say) {
        const [who, id, text] = b.say;
        return [{ shot: Object.assign(closeUp(who, bg, remote[who]), { cut: "hard", unlessOn: who }), when: b.when },
                { say: [who, id, text, CL.speakerColor(who)], when: b.when }];
      }
      if (b.caption) return [{ caption: b.caption, when: b.when }];  // conditional captions (ending callbacks, montage) keep their rule
      if (b.choice) {
        // the choice plays on the player's face; each option's reply cuts as needed
        const lead = [{ shot: Object.assign(closeUp("PLAYER", bg), { cut: "hard", unlessOn: "PLAYER" }) }];
        const opts = b.choice.options.map(o => Object.assign({}, o, { then: walk(o.then).flat() }));
        return lead.concat([{ timed: b.choice.timed, choice: opts, when: b.when, cid: `${scene.id}#${++k}` }]);
      }
      return [];
    });
    return out.concat(walk(scene.beats).flat());
  }

  // what a scene will need, fetched while the scene before it plays (rooms ~200 KB, rigs, voice lines)
  function prefetchScene(sc) {
    if (!sc || CL.fast) return;
    CL.prefetchRoom(sc.id === "1.3" ? null : roomFor(sc));
    const who = new Set(), lines = [];
    (function walk(beats) {
      for (const b of beats || []) {
        if (b.say) { who.add(b.say[0]); lines.push([b.say[0], b.say[1]]); }
        if (b.choice) b.choice.options.forEach(o => walk(o.then));
      }
    })(sc.beats);
    who.forEach(w => CL.prefetchRig(rigFor(w, roomFor(sc))));
    CL.prefetchVoice(lines);
  }
  const playable = sc => !sc.routes && (!sc.when || CL.when(sc.when));
  const WHY = { "1.route": {
    base: "Your first week leaned toward the floor: the night shift, the fast call. Marcus noticed.",
    r_grc: "Your first week leaned toward process: the rules, the right person to ask. Dana noticed.",
    r_up: "Your first week leaned toward the exit: the pitch, the paycheck, the shortcut. Jordan noticed.",
  } };
  CL.playEpisode = async function (ep, n, title) {
    CL.state.episode = n;
    const quick = CL.classMode;  // the presentation build keeps cards and holds short
    // a route episode carries its own title ("The Auditor" instead of "Tier Two")
    const routeTitle = (ep.titles || []).find(t => CL.when(t.when));
    if (routeTitle) title = routeTitle.title;
    let titled = !!routeTitle;
    prefetchScene(ep.scenes.find(playable));
    await CL.previously(n, CL.lastRooms || ["soc_night"]);
    await CL.card(`Episode ${n}`, title || ep.title || "", ep.subtitle || "", quick ? 2400 : 3400);
    CL.lastRooms = [];
    for (let i = 0; i < ep.scenes.length; i++) {
      const sc = ep.scenes[i];
      if (sc.routes) {
        // a routing point: the first rule that holds sets its route flag (tools/routes.py writes these)
        const hit = sc.routes.find(r => CL.when(r.when));
        if (hit) CL.state.flags[hit.flag] = true;
        CL.state.route = (CL.state.route || []).concat(hit ? hit.flag : "base");
        // say why this road: the first job came from a whole week of answers, not one button (playtest note)
        const why = WHY[sc.id] && WHY[sc.id][hit ? hit.flag : "base"];
        if (why) await CL.caption(why);
        continue;
      }
      if (sc.when && !CL.when(sc.when)) continue;   // other routes' scenes, and all but one of Episode 5's endings
      if (sc.route && !titled) {
        // the route was decided mid-episode (Episode 3's promotion): name the new storyline as it begins
        const t = (ep.titles || []).find(x => CL.when(x.when));
        if (t) await CL.card(`Episode ${n}`, t.title, "", 2600);
        titled = true;
      }
      prefetchScene(ep.scenes.slice(i + 1).find(playable));  // best guess: the next scene that would play now
      CL.lastLine = null;
      CL.lastRooms.push(sc.id === "1.3" ? "soc_night" : roomFor(sc));
      if (sc.id === "5.9") {
        CL.state.ending = sc.name.replace(/^[a-g]\s+/, "");
        CL.state.flags["end_" + sc.name[0]] = true;  // the closing narration calls back to the ending
        CL.reportEnding(CL.state.ending);  // rides with the Episode 5 batch instead of costing its own message
      }
      await CL.run(beatsFor(sc, { last: null }));
    }
    // this episode's votes go to the class relay in one message, while the end card plays
    const sent = CL.flushTally();
    // episodes with several end cards (Episode 5) show the one whose condition holds
    const endCard = ep.ends ? (ep.ends.find(c => !c.when || CL.when(c.when)) || {}).text : ep.end;
    if (endCard) await CL.card(`End of Episode ${n}`, endCard, "", quick ? 3000 : 4200);
    // so "% of your class" includes this player, but a stalled network never holds them here
    await Promise.race([sent, new Promise(r => setTimeout(r, 3000))]);
    await CL.choiceStats(n);
  };
  CL.roomFor = roomFor;
})();
