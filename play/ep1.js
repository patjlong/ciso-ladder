// Episode 1 vertical slice: the 3 AM alert.
const TEAL = "#7fd1c7";
const SHOT = {
  wide: { bg: "soc_night", cam: { from: { zoom: 1.28, px: -.035, y: -.02 }, to: { zoom: 1.06, px: .035, y: 0 }, dur: 11 } },
  player: { bg: "soc_night", fx: "alert", actors: [{ rig: "PLAYER_desk", who: "PLAYER", x: 4, y: 0, h: 90, z: 1.4 }],
            cam: { from: { zoom: 1.35, x: .08, px: .02 }, to: { zoom: 1.42, x: .1, px: -.02 }, dur: 12 } },
  marcus: { bg: null, fx: "warm", actors: [{ rig: "marcus_phone", who: "Marcus", x: 40, y: 0, h: 92, z: 1.2 }],
            cam: { from: { zoom: 1.02 }, to: { zoom: 1.1, x: .03 }, dur: 12 } },
};
const EP1 = [
  { card: ["Episode 1", "Night Shift", "Year one. Tier 1 SOC Analyst. The 11 PM to 7 AM shift."] },
  { shot: SHOT.wide, wait: 1200 },
  { caption: "3:12 AM" },
  { shot: SHOT.player, wait: 500 },
  { say: ["PLAYER", "e1_p_alert", "Hold on. Finance laptop, outbound traffic to an address we have never talked to. That is not green.", TEAL] },
  { say: ["PLAYER", "e1_p_who", "Okay. Okay. Who do you call at three in the morning?", TEAL] },
  { shot: SHOT.marcus, wait: 400 },
  { say: ["Marcus", "e1_m_hello", "Hale. It's three in the morning, so this better be a real one."] },
  { say: ["Marcus", "e1_m_ask", "Talk to me. What are you seeing, and what do you want to do about it?"] },
  { shot: Object.assign({}, SHOT.player, { cut: "hard" }) },
  { timed: 10, choice: [
    { t: "Isolate the laptop now.", fx: { skill: 6, rep: 8 }, rem: "Marcus will remember that.", log: "Isolated the laptop at 3 AM", then: [
      { say: ["PLAYER", "e1_p_isolate", "I want to isolate the laptop. Right now.", TEAL] },
      { shot: SHOT.marcus }, { say: ["Marcus", "e1_m_isolate", "Good. Pull it off the network and keep the logs. That's the job."] } ] },
    { t: "Pull the logs first.", fx: { skill: 10, burn: 4 }, log: "Investigated before containing", then: [
      { say: ["PLAYER", "e1_p_logs", "Let me pull the logs first. I need to know what it's sending.", TEAL] },
      { shot: SHOT.marcus }, { say: ["Marcus", "e1_m_logs", "Fine. But every minute you spend reading, it keeps talking. Be fast."] } ] },
    { t: "\"Should I wake someone else?\"", fx: { trust: 4, rep: -2 }, rem: "Marcus will remember that.", log: "Asked to escalate further", then: [
      { say: ["PLAYER", "e1_p_wake", "Should I wake someone else up?", TEAL] },
      { shot: SHOT.marcus }, { say: ["Marcus", "e1_m_wake", "You already woke someone. Me. Now make a call."] } ] },
    { t: "[Say nothing]", silent: true, fx: { trust: -4 }, rem: "Marcus noticed you froze.", log: "Froze on the call", then: [
      { shot: SHOT.marcus }, { say: ["Marcus", "e1_m_silent", "Hello? You still there? Okay. Isolate it. We'll talk about this Monday."] } ] },
  ]},
  { say: ["Marcus", "e1_m_writeup", "And hey. Write it up before you leave. Every alert gets a story."] },
  { shot: SHOT.wide, wait: 1500 },
  { card: ["Phase 1 preview", "End of slice", "Voiced, lip-synced and in depth. The full game runs five episodes, about 15 to 20 minutes.", 99999] },
];
