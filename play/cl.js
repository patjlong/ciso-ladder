// The CISO Ladder engine, v2 (illustrated 2.5D).
// Backgrounds are painted stills with depth maps, rendered in WebGL so a moving camera
// produces real parallax. Characters are layered rigs: a base cut-out plus mouth and blink
// patches. Mouths follow Rhubarb cues baked from each voice line.
(function () {
  "use strict";
  const $ = (s, r = document) => r.querySelector(s);
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const A = "assets/";

  const CL = (window.CL = {
    state: { name: "Avery", preset: "p1", voice: "af_heart", pron: ["they", "them", "their"], flags: {}, log: [], stats: { skill: 30, rep: 30, trust: 30, burn: 10 } },
    // ?class=1 is the presentation QR code: twenty phones in one room, so voices start off (headphones turn
    // them on) and the pacing is tighter. Elsewhere sound starts on with the first tap (that tap is what
    // unlocks audio on iPhones); ?mute=1 for silent test runs.
    classMode: /[?&]class=1/.test(location.search),
    sound: !/[?&](mute|class)=1/.test(location.search),
    lipsync: {},
    rigs: {},
  });

  // ---------- text tokens ----------
  CL.fmt = t => t.replace(/\{name\}/g, CL.state.name).replace(/\{they\}/g, CL.state.pron[0]).replace(/\{them\}/g, CL.state.pron[1]).replace(/\{their\}/g, CL.state.pron[2]);

  // ---------- WebGL depth-parallax background ----------
  // pan (uv), zoom, parallax offset (uv), handheld shake amount
  const cam = { x: 0, y: 0, zoom: 1, px: 0, py: 0, shake: 0.0012 };
  CL.cam = cam;
  const canvas = $("#bg");
  // dissolves copy the frame by drawing it synchronously in snapshot(), so the buffer need not be preserved
  // (preserveDrawingBuffer costs a full-screen copy every frame on phones)
  const gl = canvas.getContext("webgl", { premultipliedAlpha: false, antialias: false, preserveDrawingBuffer: false });
  // Phones pay for every pixel: they render at device pixel ratio 1 with 3 parallax steps (the camera
  // moves slowly, so 3 steps converge visibly the same); laptops keep 1.5x and 5 steps (Codex perf review)
  const PHONE = Math.min(screen.width, screen.height) < 600 || /Android|iPhone|iPad/i.test(navigator.userAgent);
  const VS = "attribute vec2 p;varying vec2 v;void main(){v=vec2(p.x*.5+.5,.5-p.y*.5);gl_Position=vec4(p,0,1);}";
  const FS = `precision mediump float;varying vec2 v;uniform sampler2D img,dep;uniform vec2 off,ctr,scl;uniform float zm,dim;
  void main(){vec2 uv=(v-.5)*scl/zm+.5+ctr;vec2 o=uv;
  for(int i=0;i<${PHONE ? 3 : 5};i++){float d=texture2D(dep,o).r;o=uv-off*(d-.45);}
  vec3 c=texture2D(img,clamp(o,.001,.999)).rgb;gl_FragColor=vec4(c*dim,1.);}`;
  function sh(t, s) { const o = gl.createShader(t); gl.shaderSource(o, s); gl.compileShader(o); if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) console.error(gl.getShaderInfoLog(o)); return o; }
  const prog = gl.createProgram();
  gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(prog); gl.useProgram(prog);
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, "p"); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  const U = n => gl.getUniformLocation(prog, n);
  const u = { img: U("img"), dep: U("dep"), off: U("off"), ctr: U("ctr"), scl: U("scl"), zm: U("zm"), dim: U("dim") };
  gl.uniform1i(u.img, 0); gl.uniform1i(u.dep, 1);
  // Twenty phones share one classroom access point, so any single request can fail or stall.
  // Images get a timeout and two retries; a failure is never cached, and nothing that fails
  // may stop the story (a missing room keeps the last one, a missing actor plays as subtitles).
  function loadImage(url, tries = 3) {
    return new Promise((res, rej) => {
      const im = new Image(); im.crossOrigin = "anonymous"; im.decoding = "async";
      const t = setTimeout(() => { im.src = ""; fail(); }, 12000);
      const fail = () => { clearTimeout(t); tries > 1 ? setTimeout(() => loadImage(url, tries - 1).then(res, rej), 800) : rej(new Error("image " + url)); };
      im.onload = () => { clearTimeout(t); (im.decode ? im.decode().catch(() => {}) : Promise.resolve()).then(() => res(im)); };
      im.onerror = fail; im.src = url;
    });
  }
  const texCache = {};
  function tex(url) {
    if (texCache[url]) return texCache[url];
    const p = (texCache[url] = loadImage(url).then(im => {
      const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, im);
      [gl.TEXTURE_WRAP_S, gl.TEXTURE_WRAP_T].forEach(k => gl.texParameteri(gl.TEXTURE_2D, k, gl.CLAMP_TO_EDGE));
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      return { t, w: im.width, h: im.height };
    }));
    p.catch(() => { delete texCache[url]; });  // let a later shot try again
    return p;
  }
  // a room costs ~11 MB of GPU memory (color + depth); keep the last few, free the rest
  const roomsHeld = [];
  function holdRoom(name) {
    const i = roomsHeld.indexOf(name); if (i >= 0) roomsHeld.splice(i, 1);
    roomsHeld.push(name);
    while (roomsHeld.length > 5) {
      const old = roomsHeld.shift();
      for (const url of [`${A}bg/${old}.webp`, `${A}bg/${old}_depth.webp`]) {
        const p = texCache[url]; delete texCache[url];
        if (p) p.then(x => { if (!curBg || (curBg.img !== x && curBg.dep !== x)) gl.deleteTexture(x.t); }, () => {});
      }
    }
  }
  let curBg = null, dim = 1;
  CL.setDim = v => { dim = v; };
  // seq: the shot asking for this room; a slow load that finishes after a newer cut must not swap the room
  async function setBg(name, seq) {
    if (!name) { if (seq == null || seq === shotSeq) curBg = null; return; }
    try {
      const [img, dep] = await Promise.all([tex(`${A}bg/${name}.webp`), tex(`${A}bg/${name}_depth.webp`)]);
      if (seq != null && seq !== shotSeq) return;
      curBg = { img, dep }; holdRoom(name);
    } catch (e) { console.warn("room kept, could not load", name); }
  }
  // warm the cache for rooms a scene is about to need (the director calls this a scene ahead)
  CL.prefetchRoom = name => { if (name && CL.hasBg(name)) { tex(`${A}bg/${name}.webp`).catch(() => {}); tex(`${A}bg/${name}_depth.webp`).catch(() => {}); } };
  function resize() {
    const dpr = PHONE ? 1 : Math.min(window.devicePixelRatio || 1, 1.5);
    canvas.width = Math.round(innerWidth * dpr); canvas.height = Math.round(innerHeight * dpr);
    gl.viewport(0, 0, canvas.width, canvas.height);
  }
  addEventListener("resize", resize); resize();

  // ---------- actors ----------
  const stageEl = $("#actors");
  let actors = [];
  // JSON over a shared classroom connection: timeout, two retries, and a failure is not cached
  CL.getJSON = function getJSON(url, tries = 3, opts = {}) {
    const signal = AbortSignal.timeout ? AbortSignal.timeout(10000) : undefined;
    return fetch(url, Object.assign({ signal }, opts)).then(r => { if (!r.ok) throw new Error(r.status); return r.json(); })
      .catch(e => tries > 1 ? wait(800).then(() => getJSON(url, tries - 1, opts)) : Promise.reject(e));
  };
  async function rig(name) {
    if (!CL.rigs[name]) {
      CL.rigs[name] = CL.getJSON(`${A}rigs/${name}.json`);
      CL.rigs[name].catch(() => { delete CL.rigs[name]; });
    }
    return CL.rigs[name];
  }
  // warm the cache for the people a scene is about to show (images too, so actors do not pop in)
  CL.prefetchRig = name => {
    if (!name) return; name = name.replace("PLAYER", CL.state.preset);
    rig(name).then(meta => { new Image().src = `${A}rigs/${name}.webp`; Object.keys(meta.patches || {}).forEach(k => { new Image().src = `${A}rigs/${name}_${k}.webp`; }); }).catch(() => {});
  };
  // A puppet actor: a cutout skeleton (puppet.js) drawn on its own canvas, playing a clip.
  // Its head drawings double as mouth shapes and blinks, so lip sync works the same way.
  const PW = 700, PH = 1100;  // puppet canvas, pelvis placed at (50%, 52%)
  async function addPuppet(spec, seq) {
    let pup;
    try { pup = await Puppet.load(`${A}puppets/${spec.puppet}`); } catch (e) { return null; }
    if (seq != null && seq !== CL.shotSeq()) return null;
    const el = document.createElement("div"); el.className = "actor"; el.dataset.who = spec.who;
    const portrait = innerHeight > innerWidth;
    Object.assign(el.style, portrait
      ? { left: (spec.mx ?? 50) + "%", bottom: (spec.my ?? 0) + "%", height: (spec.mh ?? 80) + "%", transform: "translateX(-50%)" }
      : { left: spec.x + "%", bottom: (spec.y || 0) + "%", height: spec.h + "%" });
    el.style.aspectRatio = `${PW}/${PH}`;
    const talkEl = document.createElement("div"); talkEl.className = "talk"; el.appendChild(talkEl);
    const cv = document.createElement("canvas"); cv.width = PW; cv.height = PH; cv.className = "pcanvas"; talkEl.appendChild(cv);
    stageEl.appendChild(el);
    const a = { el, talk: talkEl, inner: cv, patches: {}, z: spec.z ?? 1.1, who: spec.who, mouth: null, puppet: pup, ctx: cv.getContext("2d") };
    if (spec.clip) { await pup.useClip(spec.clip); pup.play(spec.clip).then(() => { if (spec.then) pup.play(spec.then); }); }
    a.blinkT = setTimeout(function blink() {
      if (!a.mouth) { pup.variant.head = "blink"; setTimeout(() => { if (pup.variant.head === "blink") pup.variant.head = null; }, 120); }
      a.blinkT = setTimeout(blink, 2400 + Math.random() * 4000);
    }, 900 + Math.random() * 2000);
    gsap.fromTo(el, { opacity: 0 }, { opacity: 1, duration: .35 });
    actors.push(a);
    return a;
  }
  async function addActor(spec, seq) {
    if (spec.puppet) return addPuppet(spec, seq);
    const name = spec.rig.replace("PLAYER", CL.state.preset);
    let meta;
    try { meta = await rig(name); } catch (e) { return null; }  // no art this time: the line plays as subtitles
    if (seq != null && seq !== CL.shotSeq()) return null;  // this shot was already cut away from
    const el = document.createElement("div");
    el.className = "actor";
    el.dataset.who = spec.who;
    // Phones are the primary screen. In portrait every actor is centered and sized by
    // height; shots can override with mx / my / mh (percent of the screen).
    const portrait = innerHeight > innerWidth;
    Object.assign(el.style, portrait
      ? { left: (spec.mx ?? 50) + "%", bottom: (spec.my ?? 0) + "%", height: (spec.mh ?? 76) + "%", transform: "translateX(-50%)" }
      : { left: spec.x + "%", bottom: (spec.y || 0) + "%", height: spec.h + "%" });
    // mirror on the outer box: the inner layers carry GSAP's idle and speech tweens
    if (spec.flip) el.style.transform = (el.style.transform || "") + " scaleX(-1)";
    // someone on a call is framed as a call window over the player's room
    if (spec.remote) { el.classList.add("remote"); el.dataset.label = spec.remote === "video" ? "VIDEO CALL" : "ON THE PHONE"; }
    el.style.aspectRatio = `${meta.w}/${meta.h}`;
    // el (placement + parallax) > talk (speech nods) > inner (idle breathing), so tweens never fight
    const talkEl = document.createElement("div"); talkEl.className = "talk"; el.appendChild(talkEl);
    const inner = document.createElement("div"); inner.className = "inner"; talkEl.appendChild(inner);
    const base = new Image(); base.src = `${A}rigs/${name}.webp`; base.className = "base"; inner.appendChild(base);
    const patches = {};
    for (const [k, p] of Object.entries(meta.patches)) {
      const im = new Image(); im.src = `${A}rigs/${name}_${k}.webp`; im.className = "patch";
      Object.assign(im.style, { left: (p.x / meta.w * 100) + "%", top: (p.y / meta.h * 100) + "%", width: (p.w / meta.w * 100) + "%" });
      inner.appendChild(im); patches[k] = im;
    }
    stageEl.appendChild(el);
    const a = { el, inner, talk: talkEl, patches, z: spec.z ?? 1.1, who: spec.who, mouth: null };
    // idle: breathing and a slow sway, offset so actors never move in sync
    gsap.to(inner, { scaleY: 1.01, transformOrigin: "50% 100%", duration: 2.4 + Math.random(), yoyo: true, repeat: -1, ease: "sine.inOut" });
    gsap.to(inner, { rotation: Math.random() > .5 ? .5 : -.5, transformOrigin: "50% 95%", duration: 4 + Math.random() * 2, yoyo: true, repeat: -1, ease: "sine.inOut" });
    a.blinkT = setTimeout(function blink() {
      if (!a.patches.blink) return;
      a.patches.blink.style.opacity = 1;
      setTimeout(() => { a.patches.blink.style.opacity = 0; }, 120);
      // people sometimes double-blink
      const next = Math.random() < .18 ? 320 : 2200 + Math.random() * 4200;
      a.blinkT = setTimeout(blink, next);
    }, 800 + Math.random() * 2500);
    gsap.fromTo(el, { opacity: 0 }, { opacity: 1, duration: .35 });
    actors.push(a);
    return a;
  }
  function clearActors() { actors.forEach(a => { clearTimeout(a.blinkT); gsap.killTweensOf([a.inner, a.talk]); a.el.remove(); }); actors = []; }
  const SHAPE = { A: null, X: null, B: "mouth_small", C: "mouth_small", G: "mouth_small", H: "mouth_small", D: "mouth_wide", E: "mouth_round", F: "mouth_round" };
  // Mouth shapes cross-fade (CSS transition on .patch) instead of popping, and open vowels
  // drive small head nods and leans, the way a speaker's head rides the stressed syllables.
  function setMouth(a, shape) {
    const k = SHAPE[shape] || null;
    if (a.mouth === k) return;
    if (a.puppet) { a.puppet.variant.head = k; a.mouth = k; return; }
    if (a.mouth && a.patches[a.mouth]) a.patches[a.mouth].style.opacity = 0;
    if (k && a.patches[k]) a.patches[k].style.opacity = 1;
    a.mouth = k;
    const now = performance.now();
    if ((shape === "D" || shape === "C") && now - (a.nodAt || 0) > 380) {
      a.nodAt = now;
      const dir = Math.random() < .5 ? -1 : 1;
      gsap.to(a.talk, { y: -2.5 - Math.random() * 2.5, rotation: dir * (.35 + Math.random() * .5), duration: .16, ease: "power2.out",
        onComplete: () => gsap.to(a.talk, { y: 0, rotation: 0, duration: .5, ease: "sine.inOut" }) });
    }
  }
  function speaking(a, on) {
    if (!a) return;
    gsap.to(a.talk, { scale: on ? 1.006 : 1, transformOrigin: "50% 100%", duration: .6, ease: "sine.inOut" });
  }

  // ---------- render loop ----------
  // handheld drift: layered slow sines read as an operator's breathing, never a loop
  function hand(t) {
    const s = cam.shake;
    return [s * (Math.sin(t * .00071) + .6 * Math.sin(t * .00173 + 1.3) + .25 * Math.sin(t * .0049)),
            s * (Math.sin(t * .00063 + 2) + .5 * Math.sin(t * .00191) + .25 * Math.sin(t * .0057 + .7))];
  }
  // full-screen overlays (cards, stats, finale) hide the scene: skip the GPU work behind them so a
  // 20-minute session does not keep a phone's GPU at full load
  const covers = ["#card", "#stats", "#finale"].map(s => $(s)).filter(Boolean);
  const covered = () => covers.some(el => el.classList.contains("on"));
  function frame(t) {
    if (!covered()) draw(t);
    requestAnimationFrame(frame);
  }
  function draw(t) {
    const [hx, hy] = hand(t || 0);
    if (curBg) {
      const cw = canvas.width, ch = canvas.height, ca = cw / ch, ia = curBg.img.w / curBg.img.h;
      gl.uniform2f(u.scl, ca > ia ? 1 : ca / ia, ca > ia ? ia / ca : 1);
      gl.uniform2f(u.off, cam.px, cam.py); gl.uniform2f(u.ctr, cam.x + hx, cam.y + hy);
      gl.uniform1f(u.zm, cam.zoom); gl.uniform1f(u.dim, dim);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, curBg.img.t);
      gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, curBg.dep.t);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    } else { gl.clearColor(0, 0, 0, 1); gl.clear(gl.COLOR_BUFFER_BIT); }
    const W = innerWidth;
    stageEl.style.transform = `scale(${cam.zoom}) translate(${-(cam.x + hx) * 100}%, ${-(cam.y + hy) * 100}%)`;
    actors.forEach(a => {
      a.el.style.translate = `${-cam.px * a.z * W * .55}px ${-cam.py * a.z * innerHeight * .55}px`;
      if (a.puppet) { a.ctx.clearRect(0, 0, PW, PH); a.ctx.save(); a.ctx.translate(PW * .5, PH * .52); a.puppet.draw(a.ctx, 1); a.ctx.restore(); }
    });
  }
  requestAnimationFrame(frame);

  // ---------- shots ----------
  // ---------- cuts ----------
  // cut: "hard" (default, dialogue cutting), "dissolve" (time passing), "dip" (to black),
  // "whip" (fast blurred pan), "flash" (white pop for a shock beat).
  let camTl = null, walkTl = null, shotSeq = 0;
  CL.shotSeq = () => shotSeq;
  function snapshot() { // freeze the current frame (background + actors) into an overlay
    const ov = document.createElement("div"); ov.className = "snap";
    const c2 = document.createElement("canvas"); c2.width = canvas.width; c2.height = canvas.height;
    draw(performance.now());  // draw now, in this same task, so the copy works without preserveDrawingBuffer
    c2.getContext("2d").drawImage(canvas, 0, 0);
    ov.appendChild(c2);
    const ac = stageEl.cloneNode(true); ac.removeAttribute("id"); ac.className = "snap-actors"; ov.appendChild(ac);
    // cloneNode copies a canvas element but not its pixels: copy each puppet's drawing, or puppets
    // vanish for the length of the dissolve (Codex review)
    const from = stageEl.querySelectorAll("canvas"), to = ac.querySelectorAll("canvas");
    from.forEach((c, i) => { if (to[i]) to[i].getContext("2d").drawImage(c, 0, 0); });
    document.body.insertBefore(ov, $("#fx"));
    return ov;
  }
  CL.shot = async function (s) {
    const fade = $("#fade"), cut = s.cut || "hard";
    let ov = null;
    if (cut === "dip") { await gsap.to(fade, { opacity: 1, duration: .45, ease: "power1.in" }); }
    if (cut === "dissolve" || cut === "whip") ov = snapshot();
    // art that is not painted yet falls back so the scene still plays
    // a keyframe drawn with one player look only plays for that look
    // keyframes drawn per player look: kf_player_walk (look p1) and kf_player_walk_p3 (look p3, etc.)
    let bgName = s.bg;
    if (s.look && s.look !== CL.state.preset) bgName = CL.hasBg(`${s.bg}_${CL.state.preset}`) ? `${s.bg}_${CL.state.preset}` : null;
    const useBg = bgName && CL.hasBg(bgName) ? bgName : (s.bg ? (s.fallback ?? null) : null);
    const seq = ++shotSeq;
    if (CL.ambience) CL.ambience(useBg);
    await setBg(useBg, seq);
    if (walkTl) { walkTl.kill(); walkTl = null; }
    if (s.walk) // footsteps: a soft vertical bob riding under the camera move
      walkTl = gsap.to(cam, { y: `+=${s.walk}`, duration: .29, yoyo: true, repeat: -1, ease: "sine.inOut" });
    clearActors();
    await Promise.all((s.actors || []).map(a => addActor(a, seq)));
    if (seq !== shotSeq) return;  // a newer cut already started
    // who this shot is on (a single-person close-up), so the runner can skip a cut to someone already on screen
    CL.onScreen = (s.actors || []).length === 1 ? s.actors[0].who : null;
    const c = s.cam || {};
    const from = Object.assign({ x: 0, y: 0, zoom: 1, px: 0, py: 0 }, c.from), to = Object.assign({}, c.to);
    // Phones see only a narrow slice of a wide painting. `subject` is where the person
    // stands (0..1 across the image); in portrait the camera re-centers on them, clamped
    // so the slice never runs off the edge.
    if (s.subject != null && curBg && innerHeight > innerWidth) {
      const ia = curBg.img.w / curBg.img.h, va = innerWidth / innerHeight;
      const slack = z => Math.max(0, .5 - (va / ia) / 2 / z);
      const fit = (x, z) => Math.max(-slack(z), Math.min(slack(z), (s.subject - .5) + (x || 0)));
      from.x = fit(from.x, from.zoom); to.x = fit(to.x ?? 0, to.zoom ?? from.zoom);
    }
    Object.assign(cam, from);
    cam.shake = s.shake ?? 0.0012;
    if (camTl) camTl.kill();
    camTl = gsap.to(cam, Object.assign({ duration: c.dur || 10, ease: "sine.inOut" }, to));
    $("#fx").className = s.fx || "";
    // rack focus: background softens so the eye lands on the speaker
    // (phones skip it: a CSS blur on a full-screen WebGL canvas is recomputed every frame)
    if (!PHONE) gsap.to(canvas, { filter: `blur(${s.focus === "near" ? 3 : 0}px)`, duration: 1.1, ease: "power2.inOut" });
    if (cut === "dissolve") gsap.to(ov, { opacity: 0, duration: s.xdur || 1.1, ease: "sine.inOut", onComplete: () => ov.remove() });
    if (cut === "whip") {
      const dir = s.dir || 1;
      gsap.to(ov, { xPercent: -60 * dir, opacity: 0, filter: "blur(18px)", duration: .32, ease: "power3.in", onComplete: () => ov.remove() });
      gsap.fromTo([canvas, stageEl], { x: 120 * dir, filter: "blur(14px)" }, { x: 0, filter: s.focus === "near" ? "blur(3px)" : "blur(0px)", duration: .42, ease: "power3.out", clearProps: "x" });
    }
    if (cut === "flash") { const f = $("#flash"); gsap.fromTo(f, { opacity: .9 }, { opacity: 0, duration: .5, ease: "power2.out" }); }
    gsap.to(fade, { opacity: 0, duration: cut === "dip" ? .6 : .01 });
  };

  // ---------- voice + subtitles ----------
  // One shared audio element, unlocked by the first tap. iPhones only allow sound on an
  // element that has already played inside a user gesture, so we reuse it for every line.
  const vo = new Audio();
  vo.preload = "auto";
  // voice lines are Ogg Opus; Safari before iOS 18.4 cannot play them, so those phones read subtitles
  const canVoice = vo.canPlayType('audio/ogg; codecs="opus"') !== "";
  CL.canVoice = canVoice;
  // the typed name is projected on the class scoreboard: keep it to letters and spaces and off a short blocklist
  const BLOCK = /(fuck|shit|bitch|cunt|dick|cock|puss|nigg|fag|slut|whore|rape|nazi|hitler|porn|sex|penis|vagin|boob|tits|anal|cum\b|dildo|retard)/i;
  CL.cleanName = raw => {
    const n = String(raw || "").replace(/[^\p{L}\p{N} .'-]/gu, "").replace(/\s+/g, " ").trim().slice(0, 16);
    return !n || BLOCK.test(n.replace(/[^a-z]/gi, "")) ? "Avery" : n;
  };
  // a phone that locks between taps stops the story; ask the screen to stay on while playing
  let wakeLock = null;
  CL.keepAwake = async () => { try { if (navigator.wakeLock && !wakeLock) { wakeLock = await navigator.wakeLock.request("screen"); wakeLock.addEventListener("release", () => { wakeLock = null; }); } } catch (e) {} };
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible" && CL.playing) CL.keepAwake(); });
  CL.unlockAudio = () => {
    vo.src = "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=";
    vo.play().catch(() => {});
  };
  // Sound off stops the line now (the line itself carries on as a subtitle) and every sound in ambience.js
  CL.stopVoice = () => { try { vo.pause(); } catch (e) {} if (CL.duck) CL.duck(false); };
  // warm the HTTP cache for a scene's voice lines so each line starts without buffering dead air
  CL.prefetchVoice = lines => {
    if (!CL.sound || !canVoice) return;
    for (const [who, id] of lines.slice(0, 12)) {  // a scene's opening lines; the rest load as they come
      const lid = who === "PLAYER" ? `${id}__${CL.state.voice}` : id;
      if (CL.lipsync[lid]) fetch(`${A}vo/${lid}.ogg`, { priority: "low" }).catch(() => {});
    }
  };
  CL.hasBg = name => (CL.manifest.bgs || []).includes(name);
  CL.manifest = {};
  let skip = false;
  CL.skipLine = () => { skip = true; };  // end the line now (used by the creator's voice previews)
  addEventListener("pointerdown", e => { if (!e.target.closest("button,input,select")) skip = true; });
  addEventListener("keydown", e => { if (e.key === " " || e.key === "Enter") skip = true; });
  CL.say = async function (who, id, text, color) {
    const sub = $("#sub");
    const isP = who === "PLAYER";
    const label = isP ? CL.state.name : who;
    const lid = isP ? `${id}__${CL.state.voice}` : id;
    const ls = CL.lipsync[lid];
    const a = actors.find(x => x.who === who);
    sub.innerHTML = `<b style="color:${color || "#e8b33a"}">${label}</b><span>${CL.fmt(text)}</span>`;
    sub.classList.add("on");
    CL.lastLine = { label, text: CL.fmt(text), color: color || "#e8b33a" };  // pinned above the options if a choice follows
    let audio = null, clock = false;  // clock: follow the wall clock instead of the audio
    if (CL.sound && ls && canVoice) {
      audio = vo; vo.src = `${A}vo/${lid}.ogg`;
      vo.onerror = () => { clock = true; };
      vo.play().catch(() => { clock = true; });
    }
    // with sound off the line runs at subtitle reading pace (300 ms a word, about 200 words a minute)
    // instead of the voice's length; the mouth keeps time by playing its cues faster or slower
    const words = text.split(/\s+/).length;
    const dur = audio ? ls.dur * 1000 : Math.max(1400, words * 300);
    const cueScale = ls && !audio ? ls.dur * 1000 / dur : 1;
    const t0 = performance.now();
    skip = false;
    speaking(a, true);
    if (audio && CL.duck) CL.duck(true);
    // A voice file can stall on a busy network, before it starts or halfway through. If the audio clock
    // has not moved for 1.2 s, the line carries on by the wall clock from where the audio stopped.
    let lastT = -1, movedAt = t0, base = 0, baseAt = t0;
    await new Promise(res => {
      (function tick() {
        const now = performance.now(), wall = (now - t0) / 1000;
        if (audio && !clock) {
          if (audio.currentTime !== lastT) { lastT = audio.currentTime; movedAt = now; }
          else if (now - movedAt > 1200 || (audio.paused && !CL.sound)) { clock = true; base = audio.currentTime; baseAt = now; }
        }
        const t = audio && !clock ? audio.currentTime : (audio ? base + (now - baseAt) / 1000 : wall);
        if (a && ls) {
          let shape = "X";
          for (const [ct, sh] of ls.cues) { if (ct <= t * cueScale) shape = sh; else break; }
          setMouth(a, shape);
        }
        if (skip || t * 1000 >= dur) { if (audio) audio.pause(); if (a) setMouth(a, "X"); speaking(a, false); return res(); }
        requestAnimationFrame(tick);
      })();
    });
    if (audio && CL.duck) CL.duck(false);
    // a beat after the line so the reader can finish (but voiced lines barely need it)
    skip = false;
    const hold = audio ? 350 : 300;  // the reading pace above already includes reading time
    for (let t = 0; t < hold && !skip; t += 50) await wait(50);
    sub.classList.remove("on");
    await wait(150);
  };
  // a location slug ("Harborline SOC, late afternoon") rides over the establishing shot without holding the scene
  CL.captionAside = function (text, ms = 2600) {
    const c = $("#caption"); c.textContent = CL.fmt(text); c.classList.add("on");
    clearTimeout(CL.captionAside.t); CL.captionAside.t = setTimeout(() => c.classList.remove("on"), ms);
  };
  CL.caption = async function (text, ms) {
    clearTimeout(CL.captionAside.t);
    const c = $("#caption"); c.textContent = CL.fmt(text); c.classList.add("on");
    // long enough to read (captions carry the course facts): 300 ms a word, at least 2.6 s;
    // a tap can skip only after the first second, so a stray tap cannot swallow it
    ms = ms || Math.max(2600, text.split(/\s+/).length * 300);
    skip = false; for (let t = 0; t < ms && !(skip && t > 1000); t += 50) await wait(50);
    c.classList.remove("on"); await wait(300);
  };

  // ---------- choices: the world slows down while you decide ----------
  function remember(text) {
    const r = $("#remember"); r.innerHTML = `<i></i>${CL.fmt(text)}`; r.classList.add("on");
    clearTimeout(remember.h); remember.h = setTimeout(() => r.classList.remove("on"), 3400);
  }
  CL.remember = remember;
  CL.choose = function (opts, timed) {
    return new Promise(resolve => {
      const box = $("#choices"); box.innerHTML = "";
      if (camTl) gsap.to(camTl, { timeScale: .15, duration: .6 });
      gsap.to({ v: 1 }, { v: .55, duration: .6, onUpdate() { dim = this.targets()[0].v; } });
      document.body.classList.add("deciding");
      const row = document.createElement("div"); row.className = "row";
      let done = false, tl = null;
      // the question stays on screen above the options (with sound off it is the only way to know it)
      const q = $("#question"), last = CL.lastLine;
      if (q && last) { q.innerHTML = `<b style="color:${last.color}">${last.label}</b>${last.text}`; }
      // a tap that was meant to skip the last line must not land on an option that just appeared
      const openedAt = performance.now();
      let finish = (o, i) => {
        if (done) return; done = true; if (tl) tl.kill();
        document.removeEventListener("keydown", keys);
        // on a timeout nothing was tapped: show which answer the silence became
        const silentAt = i < 0 ? opts.findIndex(x => x.silent) : -1;
        [...row.children].forEach((b, j) => b.classList.add(j === i ? "picked" : j === silentAt ? "timeout" : "gone"));
        if (i < 0) gsap.fromTo("#timesup", { opacity: 0, scale: .8 }, { opacity: 1, scale: 1, duration: .25, yoyo: true, repeat: 1, repeatDelay: .7 });
        if (CL.sfx) CL.sfx(i < 0 ? "timeout" : "confirm", i < 0 ? 0.7 : 1);
        if (q) q.classList.remove("on");
        document.body.classList.remove("deciding");
        gsap.to({ v: dim }, { v: 1, duration: .5, onUpdate() { dim = this.targets()[0].v; } });
        if (camTl) gsap.to(camTl, { timeScale: 1, duration: .5 });
        setTimeout(() => { box.classList.remove("on"); resolve(o); }, i < 0 ? 1300 : 600);
      };
      opts.forEach((o, i) => {
        const b = document.createElement("button"); b.className = "opt";
        b.innerHTML = `<kbd>${i + 1}</kbd>${CL.fmt(o.t)}`;
        b.onclick = e => { e.stopPropagation(); if (performance.now() - openedAt < 600) return; finish(o, i); };
        row.appendChild(b);
      });
      box.appendChild(row);
      if (timed) {
        const stopDrone = CL.tension ? CL.tension(timed) : () => {};
        const prevFinish = finish;
        finish = (o, i) => { stopDrone(); prevFinish(o, i); };
        const bar = document.createElement("div"); bar.className = "timer"; bar.innerHTML = "<i></i>";
        box.prepend(bar);
        tl = gsap.fromTo(bar.firstChild, { scaleX: 1 }, { scaleX: 0, duration: timed, ease: "none",
          onUpdate() { bar.classList.toggle("low", this.progress() * timed > timed - 3); },  // red for the last 3 s
          onComplete: () => finish(opts.find(o => o.silent) || { silent: true }, -1) });
      }
      const keys = e => { const n = +e.key; if (n >= 1 && n <= opts.length) finish(opts[n - 1], n - 1); };
      document.addEventListener("keydown", keys);
      box.classList.add("on");
      if (q && last) requestAnimationFrame(() => { q.style.bottom = `calc(${innerHeight - box.getBoundingClientRect().top}px + 12px)`; q.classList.add("on"); });
    });
  };

  CL.card = async function (kicker, title, subtitle, hold = 3400) {
    const c = $("#card");
    c.innerHTML = `<div class="k">${kicker}</div><h1>${title}</h1>${subtitle ? `<p>${CL.fmt(subtitle)}</p>` : ""}`;
    c.classList.add("on");
    if (CL.sfx) CL.sfx("card", 0.8);
    gsap.fromTo(c.querySelector("h1"), { letterSpacing: "0.5em", opacity: 0 }, { letterSpacing: "0.06em", opacity: 1, duration: 1.6, ease: "power3.out" });
    skip = false; for (let t = 0; t < hold && !skip; t += 50) await wait(50);
    c.classList.remove("on"); await wait(700);
  };

  // ---------- scene runner ----------
  // Live class results go to a public ntfy.sh topic the presentation site reads: a random session id,
  // the name typed in the creator (for the class awards), and per choice its id, option and decision time.
  // ntfy.sh limits each IP (a whole classroom on campus WiFi can share one) to a 60-request burst, then
  // 1 per 5 s, and roughly 250 messages a day. So votes queue on the phone and go out as one message per
  // episode ({s, n, v: [[cid, option, ms], ...]}), plus one "joined" ping, about 7 messages a player.
  // A failed send keeps its votes and retries with backoff. Test runs (?mute=1 or ?notally=1) never send.
  CL.TALLY = "https://ntfy.sh/ciso-ladder-5b65593fe27f21f7";
  const session = Math.random().toString(36).slice(2, 10);
  const tallyOff = /[?&](mute|notally)=1/.test(location.search);
  let queue = [], sending = null, retryIn = 15000, retryTimer = null;
  const who = () => String(CL.state.name || "").slice(0, 16);
  const post = body => fetch(CL.TALLY, { method: "POST", body: JSON.stringify(body),
    signal: AbortSignal.timeout ? AbortSignal.timeout(6000) : undefined })
    .then(r => { if (!r.ok) throw new Error("relay " + r.status); });
  CL.tally = function (cid, idx, ms) {
    if (tallyOff || !cid) return;
    queue.push([cid, idx, Math.round(ms || 0)]);
  };
  CL.join = function () { if (!tallyOff) post({ s: session, n: who(), j: 1 }).catch(() => {}); };
  // the ending a player actually reached rides with the last batch ({..., e: "Fortune 500"}), so the map
  // counts real endings; the last choice alone no longer decides one (trust and integrity gates)
  let endingToSend = null, endingSent = null;
  CL.reportEnding = name => { if (!tallyOff && name && name !== endingSent) endingToSend = name; };
  CL.flushTally = function () {
    if (tallyOff || (!queue.length && !endingToSend)) return Promise.resolve();
    if (sending) return sending;
    const batch = queue.splice(0, 20);  // ~600 bytes, well under ntfy's 4 KB message size
    const body = { s: session, n: who(), v: batch };
    if (endingToSend) body.e = endingToSend;
    const sentEnding = endingToSend; endingToSend = null;
    sending = post(body)
      .then(() => { retryIn = 15000; if (sentEnding) endingSent = sentEnding; })
      .catch(() => {
        if (sentEnding) endingToSend = sentEnding;
        queue = batch.concat(queue);  // keep the votes; try again later, slower each time
        clearTimeout(retryTimer);
        retryTimer = setTimeout(CL.flushTally, retryIn + Math.random() * 5000);
        retryIn = Math.min(retryIn * 2, 180000);
      })
      .finally(() => { sending = null; if (queue.length && retryIn === 15000) CL.flushTally(); });
    return sending;
  };
  // a phone that leaves mid-episode (locks, switches apps, closes the tab) hands its votes off on the way out
  addEventListener("visibilitychange", () => {
    if (document.visibilityState !== "hidden" || tallyOff || !queue.length || !navigator.sendBeacon) return;
    if (navigator.sendBeacon(CL.TALLY, JSON.stringify({ s: session, n: who(), v: queue.slice(0, 20) }))) queue.splice(0, 20);
  });
  // one relay message can hold one vote (older builds) or a batch: expand to {s, n, c, o, ms}
  CL.votesOf = function (m) {
    if (!m || !m.s) return [];
    if (Array.isArray(m.v)) return m.v.map(([c, o, ms]) => ({ s: m.s, n: m.n, c, o, ms }));
    return m.c && typeof m.o === "number" ? [{ s: m.s, n: m.n, c: m.c, o: m.o, ms: m.ms }] : [];
  };
  // `when` rules from the scripts: flag names, the stats skill/rep/trust/burn, && || ! >= etc.
  // Expressions are authored by us in tools/*.py, never by players.
  CL.when = function (expr) {
    const vars = Object.assign({}, CL.state.stats);
    const names = expr.match(/[a-z_][a-z0-9_]*/g) || [];
    names.forEach(n => { if (!(n in vars)) vars[n] = !!CL.state.flags[n]; });
    return !!Function(...Object.keys(vars), `return (${expr});`)(...Object.values(vars));
  };
  CL.run = async function (beats) {
    for (const b of beats) {
      if (b.if && !b.if(CL.state)) continue;
      if (b.when && !CL.when(b.when)) continue;
      if (b.card) await CL.card(...b.card);
      // a shot that fails (art missing, network gone) keeps the last frame; the story goes on
      // a close-up of someone already on screen is skipped: the director emits one before every line, and
      // deciding here (not when the beats are built) stays right when a conditional line was skipped
      if (b.shot && !(b.shot.unlessOn && CL.onScreen === b.shot.unlessOn)) {
        try { await CL.shot(b.shot); } catch (e) { console.warn("shot failed", e); }
      }
      if (b.caption) { if (b.aside) CL.captionAside(b.caption); else await CL.caption(b.caption); }
      if (b.wait && !CL.fast) await wait(b.wait);
      if (b.say) await CL.say(b.say[0], b.say[1], b.say[2], b.say[3]);
      if (b.choice) {
        CL.lastCid = b.cid;
        const t0 = performance.now();
        const o = await CL.choose(b.choice, b.timed);
        CL.tally(b.cid, b.choice.indexOf(o), performance.now() - t0);
        const st = CL.state.stats;
        for (const k in o.fx || {}) st[k] = Math.max(0, Math.min(100, (st[k] || 0) + o.fx[k]));
        if (o.flag) CL.state.flags[o.flag] = true;
        CL.state.log.push({ cid: b.cid, t: o.log || o.t, silent: !!o.silent, o: b.choice.indexOf(o) });
        // "X will remember that." on every option wore thin (194 of 344): show the specific ones, and the
        // generic one only when the choice sets something the story reads later
        if (o.rem && (o.flag || !/will remember that\.$/.test(o.rem))) remember(o.rem);
        if (o.then) await CL.run(o.then);
      }
      if (b.do) await b.do(CL);
    }
  };

  CL.load = async function () {
    // retried like every other fetch; if they still fail the story plays as text rather than not at all
    [CL.lipsync, CL.manifest] = await Promise.all([
      CL.getJSON(`${A}vo/lipsync.json`, 3, { cache: "no-cache" }).catch(() => ({})),
      CL.getJSON(`${A}manifest.json`, 3, { cache: "no-cache" }).catch(() => ({})),
    ]);
  };

  // one big, honest toggle: in class it starts off and says why; on phones that cannot play the voices it says so
  const soundBtn = $("#sound");
  const soundLabel = () => {
    soundBtn.classList.toggle("off", !CL.sound);
    soundBtn.textContent = !canVoice ? (CL.sound ? "Sound on (subtitles only)" : "Sound off")
      : CL.sound ? "Sound: on" : (CL.classMode ? "Headphones? Tap for voices" : "Sound: off");
  };
  soundLabel();
  soundBtn.onclick = e => {
    e.stopPropagation(); CL.sound = !CL.sound;
    if (CL.sound) CL.unlockAudio();  // this tap is the gesture iPhones need before any line can play
    else { CL.stopVoice(); if (CL.ambienceOff) CL.ambienceOff(); }  // off means off: voice, drone and room tone
    soundLabel();
  };

  // ---------- fast test mode (?fast=1): plays instantly, picks with CL.policy ----------
  // For automated flow tests: no waits, no transitions, every line and card recorded in CL.trace.
  CL.trace = [];
  if (/[?&]fast=1/.test(location.search)) {
    CL.fast = true;
    CL.policy = opts => opts[0];
    CL.say = async (who, id, text) => { CL.trace.push(["say", who, id, text]); };
    CL.caption = async text => { CL.trace.push(["cap", text]); };  // recorded so tests can check which captions play
    CL.captionAside = text => { CL.trace.push(["slug", text]); };
    CL.card = async (k, title, sub, hold) => { CL.trace.push(["card", k, title, hold]); };
    const realShot = CL.shot;
    CL.shot = async s => realShot(Object.assign({}, s, { cut: "hard" }));
    CL.choose = async opts => CL.policy(opts, CL.lastCid);
  }
})();
