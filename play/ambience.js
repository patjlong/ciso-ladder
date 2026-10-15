// Room tone, generated in the browser (no audio files): rain, machine hum, crowd murmur,
// plus a rising drone under timed choices. Follows the Sound toggle; silent in test runs.
(function () {
  "use strict";
  const ROOM = {
    soc_night: ["rain", "hum"], marcus_bedroom: ["rain"], dana_office: ["rain"], kf_marcus_sleep: ["rain"],
    kf_marcus_sit: ["rain"], kf_marcus_window: ["rain"], soc_day: ["hum"], war_room: ["hum"],
    kf_player_walk: ["hum"], kf_player_sit: ["hum"], kf_player_laptop: ["hum"],
    career_fair: ["murmur"], lobby: ["murmur"], airport_curb: ["murmur"], garage: ["hum"],
  };
  let ac = null, master = null, layers = {}, current = "";
  function ctx() {
    if (ac) return ac;
    ac = new (window.AudioContext || window.webkitAudioContext)();
    master = ac.createGain(); master.gain.value = 0.0; master.connect(ac.destination);
    return ac;
  }
  function noise(seconds = 4) {
    const b = ac.createBuffer(1, ac.sampleRate * seconds, ac.sampleRate), d = b.getChannelData(0);
    let last = 0;
    for (let i = 0; i < d.length; i++) { const w = Math.random() * 2 - 1; last = (last + 0.02 * w) / 1.02; d[i] = w * 0.6 + last * 3; }
    return b;
  }
  function make(kind) {
    const g = ac.createGain(); g.gain.value = 0; g.connect(master);
    if (kind === "hum") {
      [55, 110, 165].forEach((f, i) => { const o = ac.createOscillator(); o.frequency.value = f; const og = ac.createGain(); og.gain.value = [0.05, 0.025, 0.01][i]; o.connect(og).connect(g); o.start(); });
    } else {
      const src = ac.createBufferSource(); src.buffer = noise(); src.loop = true;
      const f = ac.createBiquadFilter();
      if (kind === "rain") { f.type = "highpass"; f.frequency.value = 900; }
      else { f.type = "bandpass"; f.frequency.value = 450; f.Q.value = 0.7; }  // murmur
      src.connect(f).connect(g); src.start();
      if (kind === "murmur") {  // slow swell so it reads as voices, not static
        const lfo = ac.createOscillator(), lg = ac.createGain(); lfo.frequency.value = 0.35; lg.gain.value = 0.25;
        lfo.connect(lg).connect(g.gain); lfo.start();
      }
    }
    return g;
  }
  const LEVEL = { rain: 0.16, hum: 0.5, murmur: 0.22 };
  CL.ambience = function (room) {
    if (!CL.sound || CL.fast) return;
    ctx(); ac.resume();
    const want = ROOM[room] || [];
    const key = want.join("+");
    if (key === current) return;
    current = key;
    master.gain.setTargetAtTime(0.5, ac.currentTime, 0.4);
    for (const k of ["rain", "hum", "murmur"]) {
      if (want.includes(k) && !layers[k]) layers[k] = make(k);
      if (layers[k]) layers[k].gain.setTargetAtTime(want.includes(k) ? LEVEL[k] : 0, ac.currentTime, 0.8);
    }
  };
  // tension drone that climbs while a choice timer drains
  CL.tension = function (seconds) {
    if (!CL.sound || CL.fast || !seconds) return () => {};
    ctx(); ac.resume();
    const o = ac.createOscillator(), o2 = ac.createOscillator(), g = ac.createGain();
    o.type = "sawtooth"; o2.type = "sine"; o.frequency.value = 73; o2.frequency.value = 110;
    const f = ac.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = 300;
    o.connect(f); o2.connect(f); f.connect(g).connect(ac.destination);
    const t = ac.currentTime;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.06, t + 1);
    o.frequency.linearRampToValueAtTime(98, t + seconds); f.frequency.linearRampToValueAtTime(900, t + seconds);
    o.start(); o2.start();
    return () => { const n = ac.currentTime; g.gain.setTargetAtTime(0, n, 0.12); o.stop(n + 0.6); o2.stop(n + 0.6); };
  };
  CL.ambienceOff = () => { if (master) master.gain.setTargetAtTime(0, ac.currentTime, 0.3); current = ""; };
})();
