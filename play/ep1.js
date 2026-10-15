// Episode 1, cold open: the 3 AM alert.
// Shots cut like a film: establishing wide, then motion keyframes (kf_*) with camera moves,
// then rigged close-ups for dialogue. Missing art falls back to the SOC room.
const TEAL = "#7fd1c7";
const SHOT = {
  walk:   { bg: "kf_player_walk", look: "p1", fallback: "soc_night", walk: .0035, cut: "dip",
            cam: { from: { zoom: 1.02, px: -.01 }, to: { zoom: 1.22, px: .01 }, dur: 6 } },
  sit:    { bg: "kf_player_sit", look: "p1", subject: .46, fallback: "soc_night", cut: "dissolve", xdur: .8,
            cam: { from: { zoom: 1.12, y: -.03 }, to: { zoom: 1.04, y: 0 }, dur: 5 } },
  wide:   { bg: "soc_night", cut: "dissolve", xdur: 1.6, shake: .0008,
            cam: { from: { zoom: 1.28, px: -.035, y: -.02 }, to: { zoom: 1.06, px: .035, y: 0 }, dur: 11 } },
  laptop: { bg: "kf_player_laptop", look: "p1", subject: .45, fallback: "soc_night", cut: "flash", fx: "alert", shake: .0045,
            cam: { from: { zoom: 1.0 }, to: { zoom: 1.18, x: .02 }, dur: 5 } },
  player: { bg: "soc_night", fx: "alert", focus: "near", shake: .002,
            actors: [{ rig: "PLAYER_desk", who: "PLAYER", x: 4, y: 0, h: 90, z: 1.4 }],
            cam: { from: { zoom: 1.35, x: .08, px: .02 }, to: { zoom: 1.42, x: .1, px: -.02 }, dur: 12 } },
  buzz:   { bg: "kf_marcus_sleep", subject: .27, fallback: "marcus_bedroom", cut: "hard", shake: .004,
            cam: { from: { zoom: 1.1, x: .03 }, to: { zoom: 1.2, x: .05 }, dur: 4 } },
  sitUp:  { bg: "kf_marcus_sit", subject: .25, fallback: "marcus_bedroom", cut: "hard", shake: .0016,
            cam: { from: { zoom: 1.16, y: .02 }, to: { zoom: 1.05, y: -.01 }, dur: 5 } },
  marcus: { bg: "marcus_bedroom", fallback: "marcus_bedroom", focus: "near",
            actors: [{ rig: "marcus_phone", who: "Marcus", x: 40, y: 0, h: 92, z: 1.2 }],
            cam: { from: { zoom: 1.02 }, to: { zoom: 1.1, x: .03 }, dur: 12 } },
  window: { bg: "kf_marcus_window", subject: .33, fallback: "marcus_bedroom", cut: "whip", shake: .0018,
            cam: { from: { zoom: 1.04, px: -.02 }, to: { zoom: 1.12, px: .02 }, dur: 5 } },
};
const hard = s => Object.assign({}, s, { cut: "hard" });
const EP1 = [
  { card: ["Episode 1", "Night Shift", "Year one. Tier 1 SOC Analyst. The 11 PM to 7 AM shift."] },
  { shot: SHOT.walk },
  { caption: "11:52 PM" },
  { shot: SHOT.sit, wait: 2200 },
  { shot: SHOT.wide, wait: 1400 },
  { caption: "3:12 AM" },
  { shot: SHOT.laptop, wait: 1800 },
  { shot: hard(SHOT.player), wait: 300 },
  { say: ["PLAYER", "e1_p_alert", "Wait. The finance laptop is talking to an IP we've never seen. That's not normal.", TEAL] },
  { say: ["PLAYER", "e1_p_who", "Okay. Okay. Who do you call at three in the morning?", TEAL] },
  { shot: SHOT.buzz, wait: 2200 },
  { shot: SHOT.sitUp, wait: 1500 },
  { shot: SHOT.marcus, wait: 300 },
  { say: ["Marcus", "e1_m_hello", "Mm. Hale. It's three in the morning, so this better be a real one."] },
  { shot: SHOT.window, wait: 1300 },
  { shot: SHOT.marcus },
  { say: ["Marcus", "e1_m_ask", "Talk to me. What are you seeing, and what do you want to do about it?"] },
  { shot: hard(SHOT.player) },
  { timed: 10, choice: [
    { t: "Isolate the laptop now.", fx: { skill: 6, rep: 8 }, rem: "Marcus will remember that.", log: "Isolated the laptop at 3 AM", then: [
      { say: ["PLAYER", "e1_p_isolate", "I want to isolate the laptop. Right now.", TEAL] },
      { shot: hard(SHOT.marcus) }, { say: ["Marcus", "e1_m_isolate", "Good. Pull it off the network and keep the logs. That's the job."] } ] },
    { t: "Pull the logs first.", fx: { skill: 10, burn: 4 }, log: "Investigated before containing", then: [
      { say: ["PLAYER", "e1_p_logs", "Let me pull the logs first. I need to know what it's sending.", TEAL] },
      { shot: hard(SHOT.marcus) }, { say: ["Marcus", "e1_m_logs", "Fine. But every minute you spend reading, it keeps talking. Be fast."] } ] },
    { t: "\"Should I wake someone else?\"", fx: { trust: 4, rep: -2 }, rem: "Marcus will remember that.", log: "Asked to escalate further", then: [
      { say: ["PLAYER", "e1_p_wake", "Should I wake someone else up?", TEAL] },
      { shot: hard(SHOT.marcus) }, { say: ["Marcus", "e1_m_wake", "You already woke someone. Me. Now make a call."] } ] },
    { t: "[Say nothing]", silent: true, fx: { trust: -4 }, rem: "Marcus noticed you froze.", log: "Froze on the call", then: [
      { shot: hard(SHOT.marcus) }, { say: ["Marcus", "e1_m_silent", "Hello? You still there? Okay. Isolate it. We'll talk about this Monday."] } ] },
  ]},
  { say: ["Marcus", "e1_m_writeup", "And hey. Write it up before you leave. Every alert gets a story."] },
  { shot: Object.assign({}, SHOT.wide, { cut: "dissolve", xdur: 2 }), wait: 2500 },
  { card: ["Preview", "End of slice", "Full character animation is next. The full game runs five episodes, about 15 to 20 minutes.", 99999] },
];
