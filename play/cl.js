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
    // sound starts on with the first tap (that tap is what unlocks audio on iPhones); ?mute=1 for silent test runs
    sound: !/[?&]mute=1/.test(location.search),
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
  // preserveDrawingBuffer lets a dissolve copy the last frame before the next shot draws
  const gl = canvas.getContext("webgl", { premultipliedAlpha: false, antialias: false, preserveDrawingBuffer: true });
  const VS = "attribute vec2 p;varying vec2 v;void main(){v=vec2(p.x*.5+.5,.5-p.y*.5);gl_Position=vec4(p,0,1);}";
  const FS = `precision mediump float;varying vec2 v;uniform sampler2D img,dep;uniform vec2 off,ctr,scl;uniform float zm,dim;
  void main(){vec2 uv=(v-.5)*scl/zm+.5+ctr;vec2 o=uv;
  for(int i=0;i<5;i++){float d=texture2D(dep,o).r;o=uv-off*(d-.45);}
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
  const texCache = {};
  function tex(url) {
    if (texCache[url]) return texCache[url];
    return (texCache[url] = new Promise((res, rej) => {
      const im = new Image(); im.crossOrigin = "anonymous";
      im.onload = () => {
        const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, im);
        [gl.TEXTURE_WRAP_S, gl.TEXTURE_WRAP_T].forEach(k => gl.texParameteri(gl.TEXTURE_2D, k, gl.CLAMP_TO_EDGE));
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        res({ t, w: im.width, h: im.height });
      };
      im.onerror = rej; im.src = url;
    }));
  }
  let curBg = null, dim = 1;
  CL.setDim = v => { dim = v; };
  async function setBg(name) {
    if (!name) { curBg = null; return; }
    const [img, dep] = await Promise.all([tex(`${A}bg/${name}.webp`), tex(`${A}bg/${name}_depth.webp`)]);
    curBg = { img, dep };
  }
  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    canvas.width = Math.round(innerWidth * dpr); canvas.height = Math.round(innerHeight * dpr);
    gl.viewport(0, 0, canvas.width, canvas.height);
  }
  addEventListener("resize", resize); resize();

  // ---------- actors ----------
  const stageEl = $("#actors");
  let actors = [];
  async function rig(name) {
    if (!CL.rigs[name]) CL.rigs[name] = fetch(`${A}rigs/${name}.json`).then(r => r.json());
    return CL.rigs[name];
  }
  async function addActor(spec) {
    const name = spec.rig.replace("PLAYER", CL.state.preset);
    const meta = await rig(name);
    const el = document.createElement("div");
    el.className = "actor";
    el.dataset.who = spec.who;
    // Phones are the primary screen. In portrait every actor is centered and sized by
    // height; shots can override with mx / my / mh (percent of the screen).
    const portrait = innerHeight > innerWidth;
    Object.assign(el.style, portrait
      ? { left: (spec.mx ?? 50) + "%", bottom: (spec.my ?? 0) + "%", height: (spec.mh ?? 76) + "%", transform: "translateX(-50%)" }
      : { left: spec.x + "%", bottom: (spec.y || 0) + "%", height: spec.h + "%" });
    el.style.aspectRatio = `${meta.w}/${meta.h}`;
    // el (placement + parallax) > talk (speech nods) > inner (idle breathing), so tweens never fight
    const talkEl = document.createElement("div"); talkEl.className = "talk"; el.appendChild(talkEl);
    const inner = document.createElement("div"); inner.className = "inner"; talkEl.appendChild(inner);
    if (spec.flip) inner.style.transform = "scaleX(-1)";
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
  function frame(t) {
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
    actors.forEach(a => { a.el.style.translate = `${-cam.px * a.z * W * .55}px ${-cam.py * a.z * innerHeight * .55}px`; });
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  // ---------- shots ----------
  // ---------- cuts ----------
  // cut: "hard" (default, dialogue cutting), "dissolve" (time passing), "dip" (to black),
  // "whip" (fast blurred pan), "flash" (white pop for a shock beat).
  let camTl = null, walkTl = null;
  function snapshot() { // freeze the current frame (background + actors) into an overlay
    const ov = document.createElement("div"); ov.className = "snap";
    const c2 = document.createElement("canvas"); c2.width = canvas.width; c2.height = canvas.height;
    c2.getContext("2d").drawImage(canvas, 0, 0);
    ov.appendChild(c2);
    const ac = stageEl.cloneNode(true); ac.removeAttribute("id"); ac.className = "snap-actors"; ov.appendChild(ac);
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
    const wrongLook = s.look && s.look !== CL.state.preset;
    await setBg(s.bg && (wrongLook || !CL.hasBg(s.bg)) ? (s.fallback ?? null) : s.bg);
    if (walkTl) { walkTl.kill(); walkTl = null; }
    if (s.walk) // footsteps: a soft vertical bob riding under the camera move
      walkTl = gsap.to(cam, { y: `+=${s.walk}`, duration: .29, yoyo: true, repeat: -1, ease: "sine.inOut" });
    clearActors();
    await Promise.all((s.actors || []).map(addActor));
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
    gsap.to(canvas, { filter: `blur(${s.focus === "near" ? 3 : 0}px)`, duration: 1.1, ease: "power2.inOut" });
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
  CL.unlockAudio = () => {
    vo.src = "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=";
    vo.play().catch(() => {});
  };
  CL.hasBg = name => (CL.manifest.bgs || []).includes(name);
  CL.manifest = {};
  let skip = false;
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
    let audio = null;
    if (CL.sound && ls) { audio = vo; vo.src = `${A}vo/${lid}.ogg`; vo.play().catch(() => {}); }
    const dur = ls ? ls.dur * 1000 : Math.max(1600, text.split(/\s+/).length * 330);
    const t0 = performance.now();
    skip = false;
    speaking(a, true);
    await new Promise(res => {
      (function tick() {
        const t = audio && !audio.paused ? audio.currentTime : (performance.now() - t0) / 1000;
        if (a && ls) {
          let shape = "X";
          for (const [ct, sh] of ls.cues) { if (ct <= t) shape = sh; else break; }
          setMouth(a, shape);
        }
        if (skip || t * 1000 >= dur) { if (audio) audio.pause(); if (a) setMouth(a, "X"); speaking(a, false); return res(); }
        requestAnimationFrame(tick);
      })();
    });
    // a beat after the line so the reader can finish (but voiced lines barely need it)
    skip = false;
    const hold = CL.sound ? 350 : Math.max(500, text.split(/\s+/).length * 120);
    for (let t = 0; t < hold && !skip; t += 50) await wait(50);
    sub.classList.remove("on");
    await wait(150);
  };
  CL.caption = async function (text, ms = 2600) {
    const c = $("#caption"); c.textContent = CL.fmt(text); c.classList.add("on");
    skip = false; for (let t = 0; t < ms && !skip; t += 50) await wait(50);
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
      const finish = (o, i) => {
        if (done) return; done = true; if (tl) tl.kill();
        document.removeEventListener("keydown", keys);
        [...row.children].forEach((b, j) => b.classList.add(j === i ? "picked" : "gone"));
        document.body.classList.remove("deciding");
        gsap.to({ v: dim }, { v: 1, duration: .5, onUpdate() { dim = this.targets()[0].v; } });
        if (camTl) gsap.to(camTl, { timeScale: 1, duration: .5 });
        setTimeout(() => { box.classList.remove("on"); resolve(o); }, 600);
      };
      opts.forEach((o, i) => {
        const b = document.createElement("button"); b.className = "opt";
        b.innerHTML = `<kbd>${i + 1}</kbd>${CL.fmt(o.t)}`;
        b.onclick = e => { e.stopPropagation(); finish(o, i); };
        row.appendChild(b);
      });
      box.appendChild(row);
      if (timed) {
        const bar = document.createElement("div"); bar.className = "timer"; bar.innerHTML = "<i></i>";
        box.prepend(bar);
        tl = gsap.fromTo(bar.firstChild, { scaleX: 1 }, { scaleX: 0, duration: timed, ease: "none",
          onComplete: () => finish(opts.find(o => o.silent) || { silent: true }, -1) });
      }
      const keys = e => { const n = +e.key; if (n >= 1 && n <= opts.length) finish(opts[n - 1], n - 1); };
      document.addEventListener("keydown", keys);
      box.classList.add("on");
    });
  };

  CL.card = async function (kicker, title, subtitle, hold = 3400) {
    const c = $("#card");
    c.innerHTML = `<div class="k">${kicker}</div><h1>${title}</h1>${subtitle ? `<p>${CL.fmt(subtitle)}</p>` : ""}`;
    c.classList.add("on");
    gsap.fromTo(c.querySelector("h1"), { letterSpacing: "0.5em", opacity: 0 }, { letterSpacing: "0.06em", opacity: 1, duration: 1.6, ease: "power3.out" });
    skip = false; for (let t = 0; t < hold && !skip; t += 50) await wait(50);
    c.classList.remove("on"); await wait(700);
  };

  // ---------- scene runner ----------
  CL.run = async function (beats) {
    for (const b of beats) {
      if (b.if && !b.if(CL.state)) continue;
      if (b.card) await CL.card(...b.card);
      if (b.shot) await CL.shot(b.shot);
      if (b.caption) await CL.caption(b.caption);
      if (b.wait) await wait(b.wait);
      if (b.say) await CL.say(b.say[0], b.say[1], b.say[2], b.say[3]);
      if (b.choice) {
        const o = await CL.choose(b.choice, b.timed);
        const st = CL.state.stats;
        for (const k in o.fx || {}) st[k] = Math.max(0, Math.min(100, st[k] + o.fx[k]));
        if (o.flag) CL.state.flags[o.flag] = true;
        if (o.log) CL.state.log.push(o.log);
        if (o.rem) remember(o.rem);
        if (o.then) await CL.run(o.then);
      }
      if (b.do) await b.do(CL);
    }
  };

  CL.load = async function () {
    [CL.lipsync, CL.manifest] = await Promise.all([
      fetch(`${A}vo/lipsync.json`).then(r => r.json()).catch(() => ({})),
      fetch(`${A}manifest.json`).then(r => r.json()).catch(() => ({})),
    ]);
  };

  $("#sound").textContent = CL.sound ? "Sound: on" : "Sound: off";
  $("#sound").onclick = e => { e.stopPropagation(); CL.sound = !CL.sound; e.currentTarget.textContent = CL.sound ? "Sound: on" : "Sound: off"; };
})();
