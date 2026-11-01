// Room tone and sound effects: real recordings (assets/sfx, sources and licenses in assets/sfx/CREDITS.md),
// looped on measured seams and mixed under the dialogue. Follows the Sound toggle; silent in test runs.
//
// 2026-11-01: this replaced synthesized "rain" and "murmur" made from filtered white noise. The rain sat only
// about 3 LU under the voices and read as constant hiss, and the murmur's swell LFO was wired to the layer
// gain itself, so it never went silent after the career fair (council/2026-11-01/audio-forensics.md).
(function () {
  "use strict";
  const A = "assets/sfx/";
  // loops: file, seam (from sfx.json: play loopStart..loopEnd, never the padded file ends), and a gain that puts
  // the bed at about -40 to -42 LUFS, 22 LU or more under the -18 LUFS dialogue
  const LOOPS = {
    rain:   { file: "amb_rain_window.ogg",  start: 0.25, end: 34.25, gain: 0.30 },
    hvac:   { file: "amb_room_hvac.ogg",    start: 0.25, end: 28.25, gain: 0.42 },
    murmur: { file: "amb_crowd_murmur.ogg", start: 0.25, end: 30.25, gain: 0.30 },
    city:   { file: "amb_city_night.ogg",   start: 0.25, end: 40.25, gain: 0.34 },
    garage: { file: "amb_garage.ogg",       start: 0.25, end: 22.23, gain: 0.40 },
  };
  const ROOM = {
    soc_night: ["rain", "hvac"], marcus_bedroom: ["rain"], dana_office: ["rain"],
    kf_marcus_sleep: ["rain"], kf_marcus_sit: ["rain"], kf_marcus_window: ["rain"],
    soc_day: ["hvac"], war_room: ["hvac"], risk_office: ["hvac"], eng_lab: ["hvac"], priya_office: ["hvac"],
    conference_glass: ["hvac"], boardroom: ["hvac"], hallway: ["hvac"], startup_loft: ["hvac"],
    startup_loft_night: ["city"], apartment: ["city"],
    kf_player_walk: ["hvac"], kf_player_sit: ["hvac"], kf_player_laptop: ["hvac"],
    career_fair: ["murmur"], lobby: ["murmur"], airport_curb: ["murmur", "city"], garage: ["garage"],
  };
  const SFX = { confirm: "sfx_choice_confirm.ogg", tick: "sfx_timer_tick.ogg", timeout: "sfx_timeout_sting.ogg",
                card: "sfx_card_transition.ogg", buzz: "sfx_phone_buzz.ogg" };
  let ac = null, bed = null, duck = null, fxBus = null, current = "";
  const layers = {}, buffers = {}, stoppers = new Set();
  function ctx() {
    if (ac) return ac;
    ac = new (window.AudioContext || window.webkitAudioContext)();
    duck = ac.createGain(); duck.connect(ac.destination);              // dips while someone speaks
    bed = ac.createGain(); bed.gain.value = 0; bed.connect(duck);       // all room tone
    fxBus = ac.createGain(); fxBus.gain.value = 0.9; fxBus.connect(ac.destination);
    return ac;
  }
  function wake() {
    ctx(); if (ac.state !== "running") ac.resume().catch(() => {});
    // iPhones treat Web Audio as "ambient", which the silent switch mutes; voices (an <audio> element) still
    // play, so the room tone would vanish under them. Ask for playback once the player has chosen sound.
    try { if (navigator.audioSession && navigator.audioSession.type !== "playback") navigator.audioSession.type = "playback"; } catch (e) {}
  }
  function load(file) {
    if (!buffers[file]) {
      buffers[file] = fetch(A + file).then(r => { if (!r.ok) throw new Error(r.status); return r.arrayBuffer(); })
        .then(b => new Promise((res, rej) => ac.decodeAudioData(b, res, rej)));
      buffers[file].catch(() => { delete buffers[file]; });  // a failed fetch may be retried by a later room
    }
    return buffers[file];
  }
  function startLayer(k) {
    const L = LOOPS[k], g = ac.createGain(); g.gain.value = 0; g.connect(bed);
    const layer = layers[k] = { g, src: null, want: 0 };
    load(L.file).then(buf => {
      if (layers[k] !== layer) return;
      const s = ac.createBufferSource(); s.buffer = buf; s.loop = true;
      s.loopStart = L.start; s.loopEnd = Math.min(L.end, buf.duration);
      s.connect(g); s.start(0, L.start); layer.src = s;
      g.gain.setTargetAtTime(layer.want, ac.currentTime, 0.8);
    }).catch(() => {});
    return layer;
  }
  function setLayer(k, on) {
    const level = on ? LOOPS[k].gain : 0;
    let layer = layers[k];
    if (!layer && !on) return;
    if (!layer) layer = startLayer(k);
    layer.want = level;
    layer.g.gain.cancelScheduledValues(ac.currentTime);
    layer.g.gain.setTargetAtTime(level, ac.currentTime, on ? 0.8 : 0.5);
    clearTimeout(layer.off);
    if (!on) layer.off = setTimeout(() => {  // fully faded: stop it, so nothing keeps running under later rooms
      if (layers[k] !== layer || layer.want) return;
      try { layer.src && layer.src.stop(); } catch (e) {}
      layer.g.disconnect(); delete layers[k];
    }, 3500);
  }
  CL.ambience = function (room) {
    if (!CL.sound || CL.fast) return;
    wake();
    const want = ROOM[room] || [];
    const key = want.join("+");
    if (key === current) return;
    current = key;
    bed.gain.setTargetAtTime(1, ac.currentTime, 0.4);
    for (const k of Object.keys(LOOPS)) setLayer(k, want.includes(k));
  };
  // while a voiced line plays the room tone drops about 6 dB, then comes back
  CL.duck = function (on) {
    if (!ac || !duck) return;
    duck.gain.setTargetAtTime(on ? 0.5 : 1, ac.currentTime, on ? 0.08 : 0.4);
  };
  CL.sfx = function (name, vol = 1) {
    if (!CL.sound || CL.fast || !SFX[name]) return;
    wake();
    load(SFX[name]).then(buf => {
      const s = ac.createBufferSource(), g = ac.createGain(); g.gain.value = vol;
      s.buffer = buf; s.connect(g).connect(fxBus); s.start();
    }).catch(() => {});
  };
  // a low drone that climbs while a choice timer drains (softer than before: triangle, not sawtooth)
  CL.tension = function (seconds) {
    if (!CL.sound || CL.fast || !seconds) return () => {};
    wake();
    const o = ac.createOscillator(), o2 = ac.createOscillator(), g = ac.createGain(), f = ac.createBiquadFilter();
    o.type = "triangle"; o2.type = "sine"; o.frequency.value = 73; o2.frequency.value = 110;
    f.type = "lowpass"; f.frequency.value = 280;
    o.connect(f); o2.connect(f); f.connect(g).connect(fxBus);
    const t = ac.currentTime;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.045, t + 1);
    o.frequency.linearRampToValueAtTime(96, t + seconds); f.frequency.linearRampToValueAtTime(700, t + seconds);
    o.start(); o2.start();
    let ticks = 0;  // a soft tick for each of the last 3 seconds
    const tickT = setInterval(() => { if (++ticks >= seconds - 3 && ticks < seconds) CL.sfx("tick", 0.8); }, 1000);
    const stop = () => {
      if (!stoppers.has(stop)) return; stoppers.delete(stop); clearInterval(tickT);
      const n = ac.currentTime; g.gain.cancelScheduledValues(n); g.gain.setTargetAtTime(0, n, 0.1);
      try { o.stop(n + 0.6); o2.stop(n + 0.6); } catch (e) {}
    };
    stoppers.add(stop);
    return stop;
  };
  // Sound off: every layer, the drone and any effect stop now (the voice is stopped by cl.js)
  CL.ambienceOff = () => {
    stoppers.forEach(s => s());
    if (!ac) return;
    bed.gain.setTargetAtTime(0, ac.currentTime, 0.15);
    for (const k of Object.keys(layers)) setLayer(k, false);
    current = "";
  };
})();
