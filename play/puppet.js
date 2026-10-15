// Cutout puppets: a skeleton of painted parts, posed by keyframed clips.
//
// rig.json  { "space": [w, h],                     bind-pose canvas size (the A-pose image)
//             "bones": [ { "name", "img", "parent", "pivot": [px, py] (in the part image),
//                          "at": [x, y] (pivot position in the parent's image, or in space for the root),
//                          "z": draw order, "variants": { "mouth_small": "head_mouth_small.webp", ... } } ] }
// clip.json { "dur": s, "loop": bool, "tracks": { "<bone>": { "rot": [[t, deg, ease?], ...],
//             "x": [...], "y": [...], "sx": [...], "sy": [...] } } }
// Rotations are in degrees relative to the bind pose. x/y move a bone in its parent's pixels.
// Eases are GSAP ease names ("power2.inOut", "back.out(1.4)"); they shape the segment that
// ENDS on that key, the way an animator sets the curve coming into a pose.
(function () {
  "use strict";
  const easeCache = {};
  const ease = name => easeCache[name || "sine.inOut"] ||= gsap.parseEase(name || "sine.inOut");

  function sample(keys, t, def) {
    if (!keys || !keys.length) return def;
    if (t <= keys[0][0]) return keys[0][1];
    for (let i = 1; i < keys.length; i++) {
      const [t1, v1, e] = keys[i];
      if (t <= t1) {
        const [t0, v0] = keys[i - 1];
        const p = t1 > t0 ? (t - t0) / (t1 - t0) : 1;
        return v0 + (v1 - v0) * ease(e)(p);
      }
    }
    return keys[keys.length - 1][1];
  }

  const imgCache = {};
  function loadImg(src) {
    return imgCache[src] ||= new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });
  }

  class Puppet {
    static async load(base) {
      const rig = await fetch(`${base}/rig.json`).then(r => r.json());
      const p = new Puppet(base, rig);
      await Promise.all(rig.bones.map(async b => {
        b.image = await loadImg(`${base}/${b.img}`);
        b.alt = {};
        for (const [k, f] of Object.entries(b.variants || {})) b.alt[k] = await loadImg(`${base}/${f}`);
      }));
      p.order = [...rig.bones].sort((a, b) => a.z - b.z);
      return p;
    }
    constructor(base, rig) {
      this.base = base; this.rig = rig; this.bones = {}; rig.bones.forEach(b => (this.bones[b.name] = b));
      this.clips = {}; this.clip = null; this.t0 = 0; this.variant = {}; this.overlay = {};
    }
    async useClip(name) {
      if (!this.clips[name]) this.clips[name] = await fetch(`${this.base}/clips/${name}.json`).then(r => r.json());
      return this.clips[name];
    }
    async play(name, { from = 0 } = {}) {
      this.clip = await this.useClip(name);
      this.clipName = name; this.t0 = performance.now() / 1000 - from;
      return new Promise(res => { this.onEnd = res; if (this.clip.loop) res(); });
    }
    // world matrix per bone: parent * T(at + dx, dy) * R(rot) * S(sx, sy) * T(-pivot)
    pose(t) {
      const c = this.clip, tr = (c && c.tracks) || {}, W = {};
      const m = (a, b) => [a[0] * b[0] + a[2] * b[1], a[1] * b[0] + a[3] * b[1], a[0] * b[2] + a[2] * b[3], a[1] * b[2] + a[3] * b[3],
                           a[0] * b[4] + a[2] * b[5] + a[4], a[1] * b[4] + a[3] * b[5] + a[5]];
      for (const b of this.rig.bones) {
        const k = tr[b.name] || {}, o = this.overlay[b.name] || {};
        const rot = ((b.rest || 0) + sample(k.rot, t, 0) + (o.rot || 0)) * Math.PI / 180;
        const x = b.at[0] + sample(k.x, t, 0) + (o.x || 0), y = b.at[1] + sample(k.y, t, 0) + (o.y || 0);
        const sx = sample(k.sx, t, 1), sy = sample(k.sy, t, 1) * (o.sy || 1);
        const cs = Math.cos(rot), sn = Math.sin(rot);
        let L = [1, 0, 0, 1, x, y];
        L = m(L, [cs, sn, -sn, cs, 0, 0]);
        L = m(L, [sx, 0, 0, sy, 0, 0]);
        L = m(L, [1, 0, 0, 1, -b.pivot[0], -b.pivot[1]]);
        W[b.name] = b.parent ? m(W[b.parent], L) : L;
      }
      return W;
    }
    draw(ctx, scale) {
      const now = performance.now() / 1000;
      let t = this.clip ? (this.paused != null ? this.paused : now - this.t0) : 0;
      if (this.clip) {
        if (this.clip.loop) t %= this.clip.dur;
        else if (t >= this.clip.dur) { t = this.clip.dur; if (this.onEnd) { const f = this.onEnd; this.onEnd = null; f(); } }
      }
      const W = this.pose(t), base = ctx.getTransform();
      // swap tracks: { "hand_n": [[t, "phone"], [t2, null]] } switch a part's drawing mid-clip
      const sw = (this.clip && this.clip.swaps) || {};
      for (const b of this.order) {
        let v = this.variant[b.name];
        if (!v && sw[b.name]) for (const [st, sv] of sw[b.name]) { if (st <= t) v = sv; else break; }
        const M = W[b.name], img = (v && b.alt[v]) || b.image;
        ctx.setTransform(base);  // build on whatever placement the caller set
        ctx.transform(M[0] * scale, M[1] * scale, M[2] * scale, M[3] * scale, M[4] * scale, M[5] * scale);
        ctx.drawImage(img, 0, 0);
      }
      ctx.setTransform(base);
    }
  }
  window.Puppet = Puppet;
})();
