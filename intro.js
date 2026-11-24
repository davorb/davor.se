// davor.se intro, after the opening of The Matrix (1999): code rain, title,
// the call log, the trace grid, the macro shot of the tube, the flight through
// the digit, the light. 2D scenes are drawn on a canvas and pushed through a
// WebGL2 pass that makes them look photographed; the flight is real 3D.
// No dependencies. Exposes window.MatrixIntro.
(() => {
  'use strict';

  const TITLE = 'DAVOR';
  const CALL = 'Call trans opt: received. 2-19-98 13:24:18 REC:Log>';
  const TRACE = 'Trace program: running';
  const NUMBER = '+46 70 305 11 58';
  const DIVE_AT = 8;                                   // index in NUMBER the camera flies through
  const LOCK_ORDER = [1, 4, 2, 14, 5, 11, 15, 7, 12, 9, 8]; // DIVE_AT locks last

  const F_TYPE = '"Courier Prime","Courier New",Courier,monospace';
  const F_NUM = 'Lekton,"Letter Gothic Std","Andale Mono","Courier New",monospace';
  const F_GLYPH = '"Hiragino Kaku Gothic ProN","Hiragino Sans","Yu Gothic","Meiryo","MS Gothic","Noto Sans CJK JP","Noto Sans JP",monospace';
  const RAIN_CHARS = Array.from('ｦｱｳｴｵｶｷｹｺｻｼｽｾｿﾀﾂﾃﾅﾆﾇﾈﾊﾋﾎﾏﾐﾑﾒﾓﾔﾕﾗﾘﾜ0123456789Z:."=*+-<>|');
  const GREEN = 'rgb(46,214,98)', PALE = 'rgb(196,255,214)', TEXT = 'rgb(150,255,172)';
  const TYPE_SQUEEZE = .86;                            // the film's terminal face is narrower than Courier

  // Seconds from the first raindrop, matched to the film.
  const T = {
    rainStop: 5.8, titleIn: 6.2, titleOut: 8.5, titleEnd: 9.6,
    cursor: 10, ring1: 11.0, ring2: 13.6, call: 17, trace: 20,
    grid: 22, macro: 46, tunnel: 48, dark: 54.6, light: 55.5, end: 57.5
  };

  const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
  const lerp = (a, b, k) => a + (b - a) * k;
  const smooth = x => { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); };
  const rnd = (a, b) => a + Math.random() * (b - a);
  const hash = (a, b) => {
    let h = (Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263)) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  };
  const el = (w, h) => { const c = document.createElement('canvas'); if (w) { c.width = w; c.height = h; } return c; };

  // -------------------------------------------------------------- shaders
  const VS_POST = `#version 300 es
in vec2 aPos; out vec2 vUv;
void main(){ vUv = aPos * .5 + .5; gl_Position = vec4(aPos, 0., 1.); }`;

  // The "camera": soft focus, halation, tube dots, moire, grain, the light.
  const FS_POST = `#version 300 es
precision highp float;
uniform sampler2D uA, uB;
uniform vec2 uRes;
uniform float uMix, uTime, uSoft, uBloom, uGrain, uDots, uDotPx, uMoire, uGain, uLight, uWhite;
in vec2 vUv; out vec4 o;
float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
vec3 src(vec2 uv, float lod){ return mix(textureLod(uA, uv, lod).rgb, textureLod(uB, uv, lod).rgb, uMix); }
void main(){
  float asp = uRes.x / uRes.y;
  float fr = floor(uTime * 24.);
  vec2 uv = vUv + (vec2(h(vec2(fr, 1.)), h(vec2(fr, 2.))) - .5) * .0012;
  vec2 ca = (uv - .5) * .0035;
  vec3 c = vec3(src(uv + ca, uSoft).r, src(uv, uSoft).g, src(uv - ca, uSoft).b);
  vec2 j = (vec2(h(gl_FragCoord.xy + fr), h(gl_FragCoord.yx - fr)) - .5) / uRes;
  vec3 halo = src(uv + j * 6., 2.5) * .45 + src(uv + j * 14., 4.) * .4 + src(uv + j * 40., 6.) * .35;
  if (uDots > 0.) {
    vec2 g = (gl_FragCoord.xy - uRes * .5) / uDotPx;
    g.x += step(1., mod(g.y, 2.)) * .5;
    float d = smoothstep(.5, .12, length(fract(g) - .5));
    c = mix(c, c * d * 1.7 + vec3(.012, .035, .02) * d * h(floor(g) + fr), uDots);
  }
  if (uMoire > 0.) {
    float lum = dot(src(uv, 3.5), vec3(.2, .7, .1));
    float ph = uv.x * asp * 26. + lum * 13. + sin(uv.y * 5. + uTime) * .6;
    float m = .5 + .5 * cos(ph * 6.2832);
    vec3 tint = .5 + .5 * cos(6.2832 * (ph * .25 + vec3(0., .33, .67)));
    c = mix(c, c * 1.8 * m * m + c.g * tint * .28 * (1. - m), uMoire);
  }
  c = c * uGain + halo * uBloom;
  if (uLight > 0.) {
    vec2 p = (uv - .5) * vec2(asp * 1.18, 1.);
    float d = length(p);
    float disc = smoothstep(uLight, uLight * .82, d);
    float glow = exp(-d / (uLight * 1.6 + .002));
    float streak = exp(-abs(p.y) / (uLight * .12 + .0015)) * exp(-abs(p.x) / (uLight * 5. + .01));
    c += vec3(.93, .97, 1.) * disc + vec3(.55, .68, 1.) * glow * .7 + vec3(.8, .88, 1.) * streak * .6;
  }
  c *= 1. - .55 * dot(uv - .5, uv - .5);
  c += vec3(.004, .011, .006) + (h(gl_FragCoord.xy * .7 + fr * 7.) - .5) * uGrain * vec3(.8, 1., .85);
  c *= .97 + .03 * h(vec2(fr, 9.));
  o = vec4(mix(c, vec3(.97, .98, 1.), uWhite), 1.);
}`;

  const VS_3D = `#version 300 es
uniform mat4 uM; in vec2 aPos; out vec2 vUv;
void main(){ vUv = aPos * .5 + .5; gl_Position = uM * vec4(aPos, 0., 1.); }`;

  // Mode 0: a slice of the digit, drawn as wavering scan lines.
  // Mode 1: a wall of code, drawn as lit dots.
  const FS_3D = `#version 300 es
precision highp float;
uniform sampler2D uTex; uniform float uAlpha, uSeed, uTime, uRep, uH; uniform int uMode;
in vec2 vUv; out vec4 o;
void main(){
  float a;
  if (uMode == 0) {
    a = texture(uTex, vUv).r;
    float y = gl_FragCoord.y / uH * (38. + 22. * fract(uSeed * .618)) + 2.4 * sin(vUv.x * 7. + uSeed * 3.1 + uTime * 1.3) + .9 * sin(vUv.x * 23. - uSeed * 1.9) + uSeed * .37;
    a *= smoothstep(.3, .8, abs(fract(y) - .5) * 2.) * 1.3;
    a *= .15 + .85 * smoothstep(.12, .3, abs(fract(vUv.x * 9. + uSeed * .61) - .5));
  } else {
    vec2 uv = vec2(vUv.x * uRep, vUv.y);
    a = texture(uTex, uv).r;
    vec2 g = fract(uv * vec2(256., 96.)) - .5;
    a *= smoothstep(.5, .15, length(g)) * 1.6;
  }
  float i = a * uAlpha;
  o = vec4(mix(vec3(.04, .8, .22), vec3(.7, 1., .78), clamp(i * i * 1.6, 0., 1.)) * i, 1.);
}`;

  const persp = (fovy, asp, n, f) => {
    const t = 1 / Math.tan(fovy / 2);
    return [t / asp, 0, 0, 0, 0, t, 0, 0, 0, 0, (f + n) / (n - f), -1, 0, 0, 2 * f * n / (n - f), 0];
  };
  const mul = (a, b) => {
    const o = new Float32Array(16);
    for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++)
      o[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
    return o;
  };

  // ---------------------------------------------------------------- stage
  const stages = new WeakMap();
  function makeStage(canvas) {
    if (stages.has(canvas)) return stages.get(canvas);
    const scene = el(), sctx = scene.getContext('2d');
    const st = { sctx, W: 0, H: 0, k: 1, gl: null };
    let gl = null, ctx = null, post, p3d, texA, texB, fbo;
    try { gl = canvas.getContext('webgl2', { antialias: false, alpha: false, powerPreference: 'high-performance' }); } catch (e) { gl = null; }

    if (gl) {
      try {
        const sh = (type, src) => {
          const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
          if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
          return s;
        };
        const prog = (vs, fs) => {
          const p = gl.createProgram();
          gl.attachShader(p, sh(gl.VERTEX_SHADER, vs)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fs));
          gl.bindAttribLocation(p, 0, 'aPos'); gl.linkProgram(p);
          if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
          const u = {};
          for (let i = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS) - 1; i >= 0; i--) {
            const name = gl.getActiveUniform(p, i).name; u[name] = gl.getUniformLocation(p, name);
          }
          return { p, u };
        };
        post = prog(VS_POST, FS_POST); p3d = prog(VS_3D, FS_3D);
        gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
        gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
        gl.disable(gl.DEPTH_TEST);
        const tex = repeat => {
          const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, repeat ? gl.REPEAT : gl.CLAMP_TO_EDGE);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
          return t;
        };
        texA = tex(); texB = tex(); fbo = gl.createFramebuffer();
        st.texture = (source, repeat) => {
          const t = tex(repeat);
          gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source); gl.generateMipmap(gl.TEXTURE_2D);
          return t;
        };
        st.gl = gl;
      } catch (e) { if (window.console) console.warn('intro: WebGL unavailable,', e); gl = st.gl = null; }
    }
    if (!gl) ctx = canvas.getContext('2d');

    st.fit = () => {
      const cw = canvas.clientWidth || window.innerWidth, ch = canvas.clientHeight || window.innerHeight;
      const k = Math.min(window.devicePixelRatio || 1, 2, 1600 / Math.max(cw, ch));
      const W = Math.max(2, Math.round(cw * k)), H = Math.max(2, Math.round(ch * k));
      if (W === st.W && H === st.H) return false;
      st.W = canvas.width = scene.width = W; st.H = canvas.height = scene.height = H; st.k = k;
      if (gl) {
        gl.bindTexture(gl.TEXTURE_2D, texB);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, W, H, 0, gl.RGBA, gl.UNSIGNED_BYTE, null); gl.generateMipmap(gl.TEXTURE_2D);
        gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texB, 0);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      }
      return true;
    };
    st.begin = () => {
      sctx.setTransform(1, 0, 0, 1, 0, 0); sctx.globalAlpha = 1;
      sctx.fillStyle = '#000'; sctx.fillRect(0, 0, st.W, st.H);
      return sctx;
    };
    // Draw the 3D pass into the second source. `quads` yields {m, tex, alpha, seed, mode, rep}.
    st.render3d = (quads, time) => {
      if (!gl) return;
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo); gl.viewport(0, 0, st.W, st.H);
      gl.clearColor(0, 0, 0, 1); gl.clear(gl.COLOR_BUFFER_BIT);
      gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE);
      gl.useProgram(p3d.p); gl.activeTexture(gl.TEXTURE0); gl.uniform1i(p3d.u.uTex, 0); gl.uniform1f(p3d.u.uTime, time); gl.uniform1f(p3d.u.uH, st.H);
      for (const q of quads) {
        gl.bindTexture(gl.TEXTURE_2D, q.tex);
        gl.uniformMatrix4fv(p3d.u.uM, false, q.m);
        gl.uniform1f(p3d.u.uAlpha, q.alpha); gl.uniform1f(p3d.u.uSeed, q.seed || 0);
        gl.uniform1i(p3d.u.uMode, q.mode || 0); gl.uniform1f(p3d.u.uRep, q.rep || 1);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      }
      gl.disable(gl.BLEND); gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.bindTexture(gl.TEXTURE_2D, texB); gl.generateMipmap(gl.TEXTURE_2D);
    };
    st.present = fx => {
      const u = Object.assign({ uMix: 0, uTime: 0, uSoft: .7, uBloom: .8, uGrain: .075, uDots: 0, uDotPx: 4, uMoire: 0, uGain: 1, uLight: 0, uWhite: 0 }, fx);
      if (!gl) {
        ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1;
        if (u.uMix >= 1) { ctx.fillStyle = '#000'; ctx.fillRect(0, 0, st.W, st.H); } else ctx.drawImage(scene, 0, 0);
        const w = Math.max(u.uWhite, smooth(u.uLight));
        if (w > 0) { ctx.globalAlpha = w; ctx.fillStyle = '#f7faff'; ctx.fillRect(0, 0, st.W, st.H); ctx.globalAlpha = 1; }
        return;
      }
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, texA);
      if (u.uMix < 1) { gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, scene); gl.generateMipmap(gl.TEXTURE_2D); }
      gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, texB);
      gl.viewport(0, 0, st.W, st.H); gl.useProgram(post.p);
      gl.uniform1i(post.u.uA, 0); gl.uniform1i(post.u.uB, 1); gl.uniform2f(post.u.uRes, st.W, st.H);
      for (const k in u) if (post.u[k]) gl.uniform1f(post.u[k], u[k]);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      gl.activeTexture(gl.TEXTURE0);
    };
    stages.set(canvas, st);
    return st;
  }

  // ----------------------------------------------------------------- rain
  // Glyphs sit still in their cells; light runs down the columns.
  function makeRain(W, H) {
    const cw = Math.round(Math.max(W, H * 1.5) / 46), ch = Math.round(cw * 1.14), n = RAIN_CHARS.length;
    const cols = Math.ceil(W / cw) + 1, rows = Math.ceil(H / ch) + 1;
    const atlas = el(n * cw, 2 * ch), a = atlas.getContext('2d');
    a.font = `bold ${Math.round(ch * .9)}px ${F_GLYPH}`; a.textAlign = 'center'; a.textBaseline = 'middle';
    for (let i = 0; i < n; i++) for (let row = 0; row < 2; row++) {
      a.save(); a.translate(i * cw + cw / 2, row * ch + ch / 2); a.scale(-1.25, 1);
      a.fillStyle = row ? PALE : GREEN; a.fillText(RAIN_CHARS[i], 0, 0); a.restore();
    }
    const glyph = new Uint8Array(cols * rows);
    for (let i = 0; i < glyph.length; i++) glyph[i] = Math.random() * n;
    const drops = Array.from({ length: cols }, () => []);
    const speed = Array.from({ length: cols }, () => rnd(7, 20));
    const delay = Array.from({ length: cols }, () => Math.pow(Math.random(), 1.6) * 2.2);
    let age = 0;
    return {
      update(dt, density, drain) {
        age += dt;
        for (let c = 0; c < cols; c++) {
          const list = drops[c];
          for (let i = list.length - 1; i >= 0; i--) {
            const d = list[i];
            d.y += speed[c] * dt;
            if (drain) d.len -= 46 * dt;
            if (d.len <= 0 || d.y - d.len > rows) list.splice(i, 1);
          }
          const top = list[list.length - 1];
          if (!drain && age > delay[c] && (!top || top.y - top.len > 2) && Math.random() < density * dt)
            list.push({ y: -rnd(0, 3), len: Math.round(rnd(rows * .35, rows * 1.5)) });
        }
        for (let m = Math.floor(cols * rows * dt * 2 + Math.random()); m > 0; m--)
          glyph[(Math.random() * glyph.length) | 0] = Math.random() * n;
      },
      draw(c, alpha, zoom, time) {
        if (alpha <= 0) return;
        c.save(); c.translate(W / 2, H / 2); c.scale(zoom, zoom); c.translate(-W / 2, -H / 2);
        const tick = Math.floor(time * 5);
        for (let col = 0; col < cols; col++) for (const d of drops[col]) {
          const head = Math.floor(d.y), x = col * cw;
          for (let r = Math.max(0, Math.ceil(d.y - d.len)); r <= Math.min(rows - 1, head); r++) {
            const i = col * rows + r, lead = r === head, hot = lead || hash(i, tick) < .018;
            if (lead && Math.random() < .5) glyph[i] = Math.random() * n;
            const k = 1 - (d.y - r) / Math.max(d.len, 1);
            c.globalAlpha = alpha * (hot ? .95 : (.3 + .7 * k) * (.6 + .4 * hash(i, 7)));
            c.drawImage(atlas, glyph[i] * cw, hot ? ch : 0, cw, ch, x, r * ch, cw, ch);
          }
        }
        c.restore();
      }
    };
  }

  // ---------------------------------------------------------------- sound
  // Everything is synthesized. Created only from a user gesture.
  function makeAudio() {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    const ac = new AC(), out = ac.createGain();
    out.gain.value = .9; out.connect(ac.destination);
    const nb = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate), nd = nb.getChannelData(0);
    for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
    const node = (make, set, to) => { const x = make.call(ac); set && set(x); x.connect(to || out); return x; };
    const gain = (v, to) => node(ac.createGain, g => { g.gain.value = v; }, to);
    const filter = (type, f, to) => node(ac.createBiquadFilter, x => { x.type = type; x.frequency.value = f; }, to);
    const osc = (type, f, to) => node(ac.createOscillator, o => { o.type = type; o.frequency.value = f; }, to);
    const noise = to => node(ac.createBufferSource, s => { s.buffer = nb; s.loop = true; }, to);
    const hit = (g, t, peak, dur) => {
      g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + .005);
      g.gain.exponentialRampToValueAtTime(.0001, t + dur);
    };

    const droneG = gain(0), droneF = filter('lowpass', 150, droneG);
    [55, 55.7, 82.6].forEach(f => osc('sawtooth', f, droneF).start());
    const hissG = gain(0); noise(filter('bandpass', 5200, hissG)).start();
    const whineG = gain(0), whine = osc('sawtooth', 70, filter('lowpass', 3200, whineG)); whine.start();
    const rushG = gain(0); noise(filter('lowpass', 900, rushG)).start();

    const blip = (f, vol, dur) => {
      const t = ac.currentTime, g = gain(0), o = osc('square', f, g);
      hit(g, t, vol, dur); o.start(t); o.stop(t + dur + .02);
    };
    return {
      frame(s) {
        const t = ac.currentTime;
        droneG.gain.setTargetAtTime(.16 * s.drone, t, .4);
        hissG.gain.setTargetAtTime(s.rain * .035, t, .25);
        whineG.gain.setTargetAtTime(s.dive * .05, t, .1);
        rushG.gain.setTargetAtTime(s.dive * s.dive * .25, t, .1);
        whine.frequency.setTargetAtTime(70 * Math.pow(30, s.dive), t, .08);
      },
      click() {
        const t = ac.currentTime, g = gain(0), s = noise(filter('highpass', 2200, g));
        hit(g, t, .1, .03); s.start(t, Math.random()); s.stop(t + .05);
      },
      blip,
      ring(dur) {
        const t = ac.currentTime, g = gain(0), am = gain(.5, g);
        const lfo = osc('square', 22, gain(.5, am.gain));
        const os = [osc('sine', 1480, am), osc('sine', 1975, am), osc('triangle', 2640, am)];
        g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(.045, t + .02);
        g.gain.setValueAtTime(.045, t + dur - .25); g.gain.exponentialRampToValueAtTime(.0001, t + dur + .5);
        [lfo, ...os].forEach(o => { o.start(t); o.stop(t + dur + .6); });
      },
      lock() {
        blip(1320, .05, .1);
        const t = ac.currentTime, g = gain(0), o = osc('sine', 120, g);
        o.frequency.exponentialRampToValueAtTime(50, t + .25); hit(g, t, .3, .3); o.start(t); o.stop(t + .35);
      },
      boom() {
        const t = ac.currentTime, g = gain(0), o = osc('sine', 80, g);
        o.frequency.exponentialRampToValueAtTime(26, t + 1.6); hit(g, t, .6, 2.2); o.start(t); o.stop(t + 2.4);
      },
      mute(m) { out.gain.setTargetAtTime(m ? 0 : .9, ac.currentTime, .03); },
      resume() { if (ac.state === 'suspended') ac.resume(); },
      close(fade) {
        out.gain.setTargetAtTime(0, ac.currentTime, fade / 4);
        setTimeout(() => ac.close().catch(() => {}), fade * 1000 + 200);
      }
    };
  }

  function wrap(text, max) {
    const out = []; let line = '';
    for (const w of text.split(' ')) {
      if (line && line.length + 1 + w.length > max) { out.push(line + ' '); line = w; }
      else line = line ? line + ' ' + w : w;
    }
    out.push(line);
    return out;
  }

  // ----------------------------------------------------------------- film
  function play(canvas, opts = {}) {
    const st = makeStage(canvas);
    let t = 0, last = 0, raf = 0, stopped = false, dirty = false, resolve;
    let audio = null, muted = true, chatter = 0, typedSeen = 0;
    let rain, title, term, grid, tun;
    const done = new Promise(r => { resolve = r; });

    const letters = Array.from(TITLE, () => ({ a: T.titleIn + rnd(0, .55), c: T.titleOut + rnd(0, .9) }));
    const lockAt = Array.from(NUMBER, ch => /\d/.test(ch) ? Infinity : -1);
    LOCK_ORDER.forEach((k, i, all) => {
      lockAt[k] = i === all.length - 1 ? T.macro - .7
        : lerp(T.grid + .5, T.macro - 3.5, i / (all.length - 2)) + (hash(i, 7) - .5) * 1.2;
    });
    const cues = [
      [T.ring1, a => a.ring(1.1)], [T.ring2, a => a.ring(1.1)], [T.light + 1.3, a => a.boom()],
      ...lockAt.filter(x => x > 0 && isFinite(x)).map(at => [at, a => a.lock()])
    ].map(([at, fn]) => ({ at, fn, fired: false }));

    function layout() {
      const { W, H } = st, asp = W / H, c = st.sctx;
      dirty = false;
      title = { pitch: .048 * Math.max(W, H * 1.1) };

      // Terminal: one char is 1.735% of the frame width in the film; never unreadably small.
      const want = Math.max(W * .01735, 8.6 * st.k), em = want / (.6 * TYPE_SQUEEZE);
      c.font = `700 ${em}px ${F_TYPE}`;
      const pitch = c.measureText('0').width * TYPE_SQUEEZE, x0 = W * .06;
      const max = Math.max(8, Math.floor((W * .97 - x0) / pitch) - 1);
      term = { em, pitch, x0, y0: H * (asp > 1 ? .145 : .11), lh: em * 1.5, call: wrap(CALL, max), trace: wrap(TRACE, max) };

      // Trace grid, in units of one column.
      const C0 = clamp(Math.round(75 * asp / 1.78), 28, 75);
      const vwEnd = 1.5 * clamp(2.4 * Math.min(1, asp / 1.3), 1.3, 2.4);
      const atlases = [16, 40, 96].map(px => {
        const aw = Math.ceil(px * .72), ah = Math.ceil(px * 1.3), cv = el(aw * 10, ah * 2), a = cv.getContext('2d');
        a.font = `700 ${px}px ${F_NUM}`; a.textAlign = 'center'; a.textBaseline = 'middle';
        for (let d = 0; d < 10; d++) for (let row = 0; row < 2; row++) {
          a.save(); a.translate(d * aw + aw / 2, row * ah + ah / 2); a.scale(1, 1.2);
          a.fillStyle = row ? PALE : GREEN; a.fillText(d, 0, 0); a.restore();
        }
        return { px, aw, ah, cv };
      });
      grid = {
        C0, vwEnd, atlases, rows: Math.ceil((C0 / asp - 2.2) / 1.45) + 1,
        tx: 1 + 1.5 * DIVE_AT, ty: 1,
        die: col => T.grid + lerp(3, 25.5, hash(col, 3))
      };

      if (st.gl) {
        // The digit, as a mask, and a strip of code for the walls.
        const g = el(256, 384), a = g.getContext('2d');
        a.fillStyle = '#000'; a.fillRect(0, 0, 256, 384);
        a.font = `700 300px ${F_NUM}`; a.textAlign = 'center'; a.textBaseline = 'middle';
        a.translate(128, 192); a.scale(1, 1.2);
        a.shadowColor = '#fff'; a.shadowBlur = 14; a.fillStyle = '#fff';
        a.fillText(NUMBER[DIVE_AT], 0, 8); a.fillText(NUMBER[DIVE_AT], 0, 8);
        const w = el(1024, 384), b = w.getContext('2d');
        b.fillStyle = '#000'; b.fillRect(0, 0, 1024, 384);
        b.font = `bold 30px ${F_GLYPH}`; b.textAlign = 'center'; b.textBaseline = 'middle';
        for (let x = 0; x < 34; x++) for (let y = 0; y < 12; y++) {
          if (hash(x, y) < .25) continue;
          b.fillStyle = `rgba(255,255,255,${.35 + .65 * hash(y, x)})`;
          b.fillText(RAIN_CHARS[Math.floor(hash(x * 3, y * 5) * RAIN_CHARS.length)], x * 30 + 17, y * 32 + 16);
        }
        // Start the flight where the 2D zoom leaves off: same digit, same size on screen.
        const frac = clamp(1.51 / (vwEnd / asp), .12, .95), fov = 50 * Math.PI / 180;
        tun = { glyph: st.texture(g), wall: st.texture(w, true), fov, d0: 1 / (frac * Math.tan(fov / 2)) };
      }
    }

    const density = x => lerp(.6, 2.4, smooth(x / 2.5));

    // A resize (rotation, a phone's address bar) rebuilds the rain; replay it up
    // to now so the picture carries on instead of starting over.
    function seedRain() {
      rain = makeRain(st.W, st.H);
      for (let x = 0; x < Math.min(t, T.titleEnd); x += 1 / 30) rain.update(1 / 30, density(x), x >= T.rainStop);
    }

    function drawTitle(c) {
      const { W, H } = st;
      const fade = 1 - smooth((t - T.titleIn - .3) / .5);
      rain.draw(c, fade, 1 + .55 * smooth(t / T.titleIn), t);
      if (t < T.titleIn) return;
      const s = 1 + 1.15 * Math.pow(clamp((t - T.titleIn) / (T.titleEnd - T.titleIn), 0, 1), 1.6);
      const pitch = title.pitch * s, n = TITLE.length, x0 = W / 2 - (n - 1) * pitch / 2;
      c.save();
      c.textAlign = 'center'; c.textBaseline = 'middle';
      c.font = `400 ${pitch * .8}px ${F_TYPE}`;
      c.shadowColor = 'rgb(60,255,130)'; c.shadowBlur = pitch * .3;
      for (let i = 0; i < n; i++) {
        const L = letters[i];
        if (TITLE[i] === ' ' || t < L.a || t >= L.c) continue;
        const born = clamp((t - L.a) / .25, 0, 1), dying = clamp((L.c - t) / .12, 0, 1);
        c.globalAlpha = dying * (hash(i + 40, Math.floor(t * 24)) < .06 ? .55 : 1);
        c.fillStyle = born < 1 ? '#fff' : 'rgb(206,255,224)';
        c.fillText(TITLE[i], x0 + i * pitch, H * .5);
      }
      c.restore();
    }

    function typed() {
      return {
        call: clamp(Math.floor((t - T.call) * 85), 0, CALL.length),
        trace: clamp(Math.floor((t - T.trace) * 50), 0, TRACE.length)
      };
    }

    function drawTerm(c) {
      if (t < T.cursor) return;
      const { em, pitch, x0, y0, lh } = term, n = typed(), tracing = t >= T.trace;
      const lines = tracing ? term.trace : term.call;
      let count = tracing ? n.trace : n.call, row = 0, cx = 0;
      const typing = tracing ? count < TRACE.length : (t > T.call && count < CALL.length);
      c.save();
      c.font = `700 ${em}px ${F_TYPE}`; c.textAlign = 'left'; c.textBaseline = 'middle';
      c.fillStyle = TEXT; c.shadowColor = 'rgb(40,255,110)'; c.shadowBlur = em * .4;
      for (let i = 0; i < lines.length; i++) {
        const s = lines[i].slice(0, count);
        if (s) { c.save(); c.translate(x0, y0 + i * lh); c.scale(TYPE_SQUEEZE, 1); c.fillText(s, 0, 0); c.restore(); }
        row = i; cx = s.length; count -= lines[i].length;
        if (count < 0) break;
      }
      if (typing || (t - T.cursor) % 1.75 < 1) {
        c.fillStyle = 'rgb(176,255,200)';
        c.fillRect(x0 + cx * pitch + pitch * .15, y0 + row * lh - em * .68, pitch * 1.55, em * 1.3);
      }
      c.restore();
    }

    // The camera pushes in on the whole grid, holding the top-left corner, then
    // pans along the number and settles on the digit it is going to fly through.
    function gridView() {
      const g = grid, asp = st.W / st.H;
      const vw = g.C0 * Math.pow(g.vwEnd / g.C0, clamp((t - T.grid) / (T.tunnel + .4 - T.grid), 0, 1)), vh = vw / asp;
      const u = (t - T.grid) / (T.macro - 1 - T.grid);
      return {
        vw, vh,
        x: Math.max(0, lerp(0, g.tx - vw / 2, smooth(u * 1.15))),
        y: lerp(0, g.ty - vh / 2, smooth((u - .7) / .3))
      };
    }

    function drawGrid(c, v) {
      const { W } = st, g = grid, s = W / v.vw;
      const cA = Math.max(0, Math.floor(v.x)), cB = Math.min(g.C0 + 1, Math.floor(v.x + v.vw));
      const rA = Math.max(0, Math.floor((v.y - 2.2) / 1.45)), rB = Math.min(g.rows, Math.floor((v.y + v.vh - 2.2) / 1.45));
      const at = s > 90 ? null : g.atlases.find(a => a.px >= s * .9) || g.atlases[g.atlases.length - 1];
      c.setTransform(s, 0, 0, s, -v.x * s, -v.y * s);
      if (!at) { c.font = `700 100px ${F_NUM}`; c.textAlign = 'center'; c.textBaseline = 'middle'; }
      const put = (d, x, y, alpha, pale) => {
        c.globalAlpha = alpha;
        if (at) c.drawImage(at.cv, d * at.aw, pale ? at.ah : 0, at.aw, at.ah, x - .36, y - .65, .72, 1.3);
        else { c.setTransform(s / 100, 0, 0, s * 1.2 / 100, (x - v.x) * s, (y - v.y) * s); c.fillStyle = pale ? PALE : GREEN; c.fillText(d, 0, 0); }
      };
      for (let col = cA; col <= cB; col++) {
        const m = col % 10;
        if (m === 4 || m === 6 || m === 9) continue;
        const a = clamp(1 - (t - g.die(col)) / .25, 0, 1);
        if (a < .01) continue;
        for (let row = rA; row <= rB; row++) {
          const h = hash(col, row), ph = t * (4 + 9 * h) + h * 10, idx = Math.floor(ph), fr = ph - idx;
          const x = col + .5, y = 2.2 + (row + .5) * 1.45, b = a * (.4 + .6 * hash(row, col + 77));
          put(Math.floor(hash(col * 31 + row, idx) * 10), x, y, b, hash(col + 5, row + idx) < .05);
          if (fr < .3) put(Math.floor(hash(col * 31 + row, idx - 1) * 10), x, y, b * (.5 - fr * 1.6), false);
        }
      }
      // The number being traced runs along the top, one digit at a time.
      c.setTransform(1, 0, 0, 1, 0, 0);
      c.font = `700 ${1.8 * s}px ${F_NUM}`; c.textAlign = 'center'; c.textBaseline = 'middle';
      for (let k = 0; k < NUMBER.length; k++) {
        if (NUMBER[k] === ' ' || t < lockAt[k]) continue;
        const x = (1 + 1.5 * k - v.x) * s, y = (1 - v.y) * s;
        if (x < -2 * s || x > W + 2 * s) continue;
        const p = clamp((t - lockAt[k]) / .4, 0, 1);
        c.globalAlpha = 1; c.fillStyle = p < 1 ? PALE : 'rgb(44,218,96)';
        c.setTransform(1, 0, 0, 1.2, x, y); c.fillText(NUMBER[k], 0, 0);
      }
      c.setTransform(1, 0, 0, 1, 0, 0); c.globalAlpha = 1;
    }

    // The digit as a stack of scan-line slices; the camera flies through its hollow.
    function tunnel() {
      const u = clamp((t - T.tunnel) / (T.dark - T.tunnel), 0, 1), asp = st.W / st.H;
      const cz = tun.d0 - (tun.d0 + 14.6) * (.08 * u + .92 * Math.pow(u, 2.3));
      const P = persp(tun.fov, asp, .02, 80), quads = [];
      const wallFade = 1 - smooth((t - T.tunnel - 1.2) / 2.5);
      if (wallFade > 0) for (const side of [-1, 1]) quads.push({
        tex: tun.wall, mode: 1, rep: 3, alpha: 1.1 * wallFade,
        m: mul(P, [0, 0, side * 5, 0, 0, 1.5, 0, 0, 1, 0, 0, 0, side * 2.3, 0, -3.2 - cz, 1])
      });
      for (let i = 29; i >= 0; i--) {
        const z = -i * .45, d = cz - z;
        if (d < .03) continue;
        const sx = 1 + .32 * Math.sin(i * 2.1) * Math.min(1, i / 3);
        quads.push({
          tex: tun.glyph, mode: 0, seed: i, alpha: 1.05 * smooth((d - .25) / 1.1) * Math.exp(-(d - Math.max(0, cz)) * .8) * (i ? 1 : 1.3),
          m: mul(P, [sx, 0, 0, 0, 0, 1.5, 0, 0, 0, 0, 1, 0, 0, 0, z - cz, 1])
        });
      }
      st.render3d(quads, t);
    }

    function sound(dt) {
      if (!audio || muted) return;
      audio.frame({
        drone: t < T.dark ? 1 : 1 - smooth((t - T.dark) / .6),
        rain: t < T.titleEnd ? 1 - smooth((t - T.rainStop) / 1.5) : 0,
        dive: t < T.dark ? clamp((t - T.macro + 3) / (T.dark - T.macro + 3), 0, 1) : 0
      });
      for (const q of cues) if (!q.fired && t >= q.at) { q.fired = true; if (t - q.at < .3) q.fn(audio); }
      const n = typed(), count = n.call + n.trace;
      if (count > typedSeen) audio.click();
      typedSeen = count;
      if (t > T.grid && t < T.macro) {
        chatter += dt * 24;
        for (; chatter > 1; chatter--) audio.blip(rnd(900, 4200), .008, .02);
      }
    }

    function frame(now) {
      if (stopped) return;
      const dt = Math.min(.1, last ? (now - last) / 1000 : 0); last = now;
      if (st.fit()) { seedRain(); layout(); } else if (dirty) layout();
      t += dt;
      const c = st.begin(), fx = { uTime: t };
      if (t < T.titleEnd) {
        rain.update(dt, density(t), t >= T.rainStop);
        drawTitle(c);
        fx.uSoft = .9; fx.uBloom = .95;
      } else if (t < T.grid) {
        drawTerm(c);
        fx.uSoft = .8; fx.uBloom = 1.05;
      } else if (t < T.dark) {
        const v = gridView(), px = st.W / (v.vw * 42), mix = st.gl ? smooth((t - T.tunnel) / .4) : 0;
        if (mix < 1) drawGrid(c, v);
        if (t >= T.tunnel && tun) tunnel();
        const macro = smooth((t - T.macro + 4) / 4);
        fx.uMix = st.gl ? mix : 0;
        fx.uSoft = lerp(.8, 1.8, macro) * (1 - mix) + .4 * mix;
        fx.uBloom = lerp(.8, 1.05, smooth((t - T.macro) / 2)) * (1 - .25 * mix);
        fx.uDots = .9 * macro * smooth((px - 2) / 2.5) * (1 - .75 * mix) * (1 - smooth((t - T.tunnel - .4) / 1.2));
        fx.uDotPx = Math.max(px, 2);
        fx.uMoire = smooth((t - T.macro - .7) / 1.1) * (1 - mix);
        fx.uGain = 1 + .12 * smooth((t - T.macro) / 2) * (1 - mix);
        if (!st.gl && t >= T.tunnel) fx.uMix = smooth((t - T.tunnel) / 1.5) >= 1 ? 1 : 0;
      } else {
        fx.uSoft = 0; fx.uBloom = 0;
        if (t >= T.light) fx.uLight = .0035 * Math.exp(3.6 * (t - T.light));
        fx.uWhite = smooth((t - T.end + .5) / .45);
      }
      st.present(fx);
      sound(dt);
      if (t >= T.end) return end(true);
      raf = requestAnimationFrame(frame);
    }

    function end(natural) {
      if (stopped) return;
      stopped = true; cancelAnimationFrame(raf);
      if (audio) audio.close(natural ? 2.6 : .25);
      resolve(natural);
    }

    if (opts.startAt > 0) t = opts.startAt;
    st.fit(); seedRain(); layout();
    if (document.fonts && document.fonts.load)
      Promise.all([`400 20px ${F_TYPE}`, `700 20px ${F_TYPE}`, `700 20px ${F_NUM}`].map(f => document.fonts.load(f))).then(() => { dirty = true; }, () => {});
    raf = requestAnimationFrame(frame);

    return {
      done,
      stop: () => end(false),
      // Call from a click/tap handler. Returns whether sound is actually on.
      setSound(on) {
        if (stopped) return false;
        if (on && !audio) { try { audio = makeAudio(); } catch (e) { audio = null; } }
        if (!audio) return false;
        muted = !on; audio.resume(); audio.mute(muted);
        return on;
      }
    };
  }

  // Just the falling characters, for a fixed time.
  function rainOnly(canvas, ms) {
    const st = makeStage(canvas);
    let rain, start = 0, last = 0, raf = 0, stopped = false, resolve;
    const done = new Promise(r => { resolve = r; });
    const build = () => { rain = makeRain(st.W, st.H); for (let x = 0; x < 4; x += 1 / 30) rain.update(1 / 30, 2.4, false); };
    const end = () => { if (stopped) return; stopped = true; cancelAnimationFrame(raf); resolve(); };
    const frame = now => {
      if (stopped) return;
      if (!start) start = last = now;
      if (st.fit()) build();
      const dt = Math.min(.1, (now - last) / 1000), left = ms - (now - start); last = now;
      rain.update(dt, 2.4, false);
      rain.draw(st.begin(), clamp(left / 250, 0, 1), 1.2, now / 1000);
      st.present({ uTime: now / 1000, uSoft: .9, uBloom: .95 });
      if (left <= 0) return end();
      raf = requestAnimationFrame(frame);
    };
    st.fit(); build();
    raf = requestAnimationFrame(frame);
    return { done, stop: end };
  }

  window.MatrixIntro = { play, rain: rainOnly, duration: T.end };
})();
