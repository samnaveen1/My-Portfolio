/* ========== UI interactions ========== */
const root = document.documentElement;
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
const finePointer = matchMedia("(hover: hover) and (pointer: fine)").matches;

$("#year").textContent = new Date().getFullYear();

/* ---------- dark / light theme (circular reveal from the button) ---------- */
(function theme() {
  const btn = $("#theme-btn"), meta = $('meta[name="theme-color"]');
  function apply(t, save) {
    root.dataset.theme = t;
    btn.setAttribute("aria-label", t === "dark" ? "Switch to light mode" : "Switch to dark mode");
    meta?.setAttribute("content", t === "dark" ? "#05080f" : "#f5f8fc");
    if (save) { try { localStorage.setItem("theme", t); } catch (e) {} }
    document.dispatchEvent(new CustomEvent("themechange", { detail: t }));
  }
  apply(root.dataset.theme || "dark", false);
  btn.addEventListener("click", (e) => {
    const next = root.dataset.theme === "dark" ? "light" : "dark";
    if (!document.startViewTransition || reduceMotion) return apply(next, true);
    const r = btn.getBoundingClientRect();
    const x = e.clientX || r.left + r.width / 2, y = e.clientY || r.top + r.height / 2;
    const end = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
    document.startViewTransition(() => apply(next, true)).ready.then(() => {
      root.animate(
        { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${end}px at ${x}px ${y}px)`] },
        { duration: 700, easing: "cubic-bezier(.2,.7,.2,1)", pseudoElement: "::view-transition-new(root)" }
      );
    });
  });
  // follow the OS setting until the visitor picks one
  matchMedia("(prefers-color-scheme: light)").addEventListener("change", (e) => {
    let saved = null;
    try { saved = localStorage.getItem("theme"); } catch (err) {}
    if (!saved) apply(e.matches ? "light" : "dark", false);
  });
})();

/* ---------- toast + copy email ---------- */
const toastEl = $("#toast");
let toastTimer;
window.showToast = (msg) => {
  toastEl.textContent = msg;
  toastEl.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove("show"), 2200);
};
$("#copy-email").addEventListener("click", async (e) => {
  const email = e.currentTarget.dataset.email;
  try { await navigator.clipboard.writeText(email); showToast("📋 Copied " + email); }
  catch { showToast(email); }
});

/* ---------- mobile menu ---------- */
const menuBtn = $("#menu-btn"), navLinks = $("#nav-links");
menuBtn.addEventListener("click", () => menuBtn.setAttribute("aria-expanded", navLinks.classList.toggle("open")));
navLinks.addEventListener("click", (e) => {
  if (e.target.closest("a")) { navLinks.classList.remove("open"); menuBtn.setAttribute("aria-expanded", "false"); }
});

/* ---------- scroll: nav, progress, active link ---------- */
const nav = $("#nav"), progress = $("#progress");
const sections = $$("main section[id]"), links = $$(".nav__links a");
let ticking = false;
function onScroll() {
  const y = scrollY, max = root.scrollHeight - innerHeight;
  progress.style.width = (max > 0 ? (y / max) * 100 : 0) + "%";
  nav.classList.toggle("solid", y > 60);
  let current = null;
  sections.forEach((s) => { if (y >= s.offsetTop - innerHeight * 0.4) current = s.id; });
  links.forEach((a) => a.classList.toggle("active", a.getAttribute("href") === "#" + current));
  ticking = false;
}
addEventListener("scroll", () => { if (!ticking) { ticking = true; requestAnimationFrame(onScroll); } }, { passive: true });
onScroll();

/* ---------- counters ---------- */
function countUp(el) {
  if (el.dataset.done) return;
  el.dataset.done = "1";
  const target = parseFloat(el.dataset.count), suffix = el.dataset.suffix || "";
  if (reduceMotion) { el.textContent = target + suffix; return; }
  const start = performance.now(), dur = 1700;
  (function step(now) {
    const p = Math.min((now - start) / dur, 1);
    el.textContent = Math.round(target * (1 - Math.pow(1 - p, 4))) + suffix;
    if (p < 1) requestAnimationFrame(step);
  })(start);
}

/* ---------- LeetCode donut ---------- */
function drawDonut() {
  const segs = $$(".donut__seg"), C = 2 * Math.PI * 52, gap = 5;
  const total = segs.reduce((s, el) => s + +el.dataset.val, 0);
  let offset = 0;
  segs.forEach((el) => {
    const len = Math.max((+el.dataset.val / total) * C - gap, 1);
    el.style.strokeDasharray = `${len} ${C}`;
    el.style.strokeDashoffset = -offset;
    offset += len + gap;
  });
}

/* ---------- reveal on scroll ---------- */
const io = new IntersectionObserver((entries) => {
  let batch = 0;
  entries.forEach((en) => {
    if (!en.isIntersecting) return;
    const delay = Math.min(batch++, 5) * 0.09;
    en.target.style.setProperty("--delay", delay + "s");
    en.target.classList.add("in");
    $$("[data-count]", en.target).forEach(countUp);
    if (en.target.classList.contains("lc")) setTimeout(drawDonut, 300);
    setTimeout(() => en.target.style.removeProperty("--delay"), 1000 + delay * 1000);
    io.unobserve(en.target);
  });
}, { threshold: 0.12, rootMargin: "0px 0px -40px 0px" });
$$(".reveal").forEach((el) => io.observe(el));

/* ---------- skeleton → image ---------- */
$$(".skeleton img").forEach((img) => {
  const done = () => img.parentElement.classList.add("loaded");
  if (img.complete && img.naturalWidth) done();
  else { img.addEventListener("load", done); img.addEventListener("error", done); }
});

/* ---------- hero: scrambling word ---------- */
(function scramble() {
  const el = $("#scramble");
  const words = ["RELIABLE", "AGENTIC", "SAFE", "SCALABLE", "USEFUL"];
  const glyphs = "ABCDEFGHIJKLMNOPQRSTUVWXYZ01#%&";
  if (reduceMotion) return;
  let i = 0;
  function to(word) {
    const from = el.textContent, len = Math.max(from.length, word.length);
    const plan = Array.from({ length: len }, (_, k) => ({ to: word[k] || "", at: 6 + Math.floor(Math.random() * 18) + k * 2 }));
    let frame = 0;
    (function tick() {
      let out = "", done = 0;
      for (const p of plan) {
        if (frame >= p.at) { out += p.to; done++; }
        else out += `<span class="scr">${glyphs[Math.floor(Math.random() * glyphs.length)]}</span>`;
      }
      el.innerHTML = out;
      frame++;
      if (done < plan.length) requestAnimationFrame(tick);
    })();
  }
  setInterval(() => { i = (i + 1) % words.length; to(words[i]); }, 2600);
})();

/* ---------- hero: 3D node sphere ---------- */
(function sphere() {
  const canvas = $("#sphere");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const small = innerWidth < 700;
  const N = small ? 150 : 260;
  const golden = Math.PI * (3 - Math.sqrt(5));
  const PALETTE = {
    dark: [[255, 186, 92], [255, 214, 150], [150, 205, 255], [120, 230, 210]],
    light: [[217, 119, 6], [234, 88, 12], [37, 99, 235], [13, 148, 136]],
  };
  const pts = Array.from({ length: N }, (_, i) => {
    const y = 1 - (2 * (i + 0.5)) / N, r = Math.sqrt(1 - y * y), th = i * golden;
    const pick = Math.random();
    return {
      x: Math.cos(th) * r, y, z: Math.sin(th) * r,
      c: pick < 0.45 ? 0 : pick < 0.62 ? 1 : pick < 0.9 ? 2 : 3,
      s: 0.5 + Math.random() * (Math.random() < 0.08 ? 2.4 : 1.1),
      tw: Math.random() * Math.PI * 2,
    };
  });
  // connect each point to its 3 nearest neighbours
  const edges = new Set();
  pts.forEach((a, i) => {
    pts.map((b, j) => [j, (a.x - b.x) ** 2 + (a.y - b.y) ** 2 + (a.z - b.z) ** 2])
      .filter(([j]) => j !== i).sort((p, q) => p[1] - q[1]).slice(0, 3)
      .forEach(([j]) => edges.add(i < j ? i + "-" + j : j + "-" + i));
  });
  const edgeList = [...edges].map((e) => e.split("-").map(Number));

  // pre-rendered glow sprites (one per colour), rebuilt when the theme changes
  function makeSprites(theme) {
    const light = theme === "light";
    return PALETTE[theme].map(([r, g, b]) => {
      const s = document.createElement("canvas"); s.width = s.height = 64;
      const g2 = s.getContext("2d"), grad = g2.createRadialGradient(32, 32, 0, 32, 32, 32);
      grad.addColorStop(0, light ? `rgba(${r},${g},${b},1)` : "rgba(255,255,255,1)");
      grad.addColorStop(light ? 0.22 : 0.18, `rgba(${r},${g},${b},.95)`);
      grad.addColorStop(0.45, `rgba(${r},${g},${b},${light ? 0.18 : 0.25})`);
      grad.addColorStop(1, `rgba(${r},${g},${b},0)`);
      g2.fillStyle = grad; g2.fillRect(0, 0, 64, 64);
      return s;
    });
  }
  let theme = root.dataset.theme === "light" ? "light" : "dark";
  let sprites = makeSprites(theme);
  document.addEventListener("themechange", (e) => { theme = e.detail === "light" ? "light" : "dark"; sprites = makeSprites(theme); });

  let W, H, dpr, cx, cy, R;
  function resize() {
    dpr = Math.min(devicePixelRatio || 1, 2);
    const r = canvas.getBoundingClientRect();
    W = canvas.width = r.width * dpr; H = canvas.height = r.height * dpr;
    cx = W * 0.5; cy = H * 0.44; R = Math.min(W, H) * 0.42;
  }
  resize();
  addEventListener("resize", resize);

  let ay = 0, ax = -0.25, vy = 0.0022, vx = 0, tiltX = -0.25, tiltY = 0;
  let dragging = false, lx = 0, ly = 0;
  addEventListener("pointermove", (e) => {
    if (dragging) {
      vy = (e.clientX - lx) * 0.004; vx = (e.clientY - ly) * 0.004;
      ay += vy; ax += vx; lx = e.clientX; ly = e.clientY;
      return;
    }
    tiltY = (e.clientX / innerWidth - 0.5) * 0.5;
    tiltX = -0.25 + (e.clientY / innerHeight - 0.5) * 0.4;
  }, { passive: true });
  canvas.addEventListener("pointerdown", (e) => { dragging = true; lx = e.clientX; ly = e.clientY; canvas.style.cursor = "grabbing"; });
  addEventListener("pointerup", () => { dragging = false; canvas.style.cursor = ""; });

  let visible = true;
  new IntersectionObserver(([en]) => (visible = en.isIntersecting)).observe(canvas);

  const proj = new Array(N);
  function frame(t) {
    requestAnimationFrame(frame);
    if (!visible || document.hidden) return;
    if (!dragging) {
      vy += (0.0022 - vy) * 0.03; vx *= 0.95;
      ay += vy + tiltY * 0.004;
      ax += vx + (tiltX - ax) * 0.02;
    }
    const sa = Math.sin(ay), ca = Math.cos(ay), sx = Math.sin(ax), cxs = Math.cos(ax);
    for (let i = 0; i < N; i++) {
      const p = pts[i];
      const x1 = p.x * ca + p.z * sa, z1 = -p.x * sa + p.z * ca;
      const y2 = p.y * cxs - z1 * sx, z2 = p.y * sx + z1 * cxs;
      const k = 1 + z2 * 0.28;
      proj[i] = { x: cx + x1 * R * k, y: cy + y2 * R * k, z: z2, d: 0.18 + 0.82 * ((z2 + 1) / 2) };
    }
    ctx.clearRect(0, 0, W, H);
    ctx.lineWidth = dpr * 0.7;
    const light = theme === "light";
    ctx.strokeStyle = light ? "rgb(30,70,120)" : "rgb(140,180,235)";
    for (const [a, b] of edgeList) {
      const A = proj[a], B = proj[b];
      ctx.globalAlpha = Math.min(A.d, B.d) * (light ? 0.26 : 0.32);
      ctx.beginPath(); ctx.moveTo(A.x, A.y); ctx.lineTo(B.x, B.y); ctx.stroke();
    }
    for (let i = 0; i < N; i++) {
      const p = pts[i], P = proj[i];
      const tw = reduceMotion ? 1 : 0.75 + 0.25 * Math.sin(t * 0.002 + p.tw);
      const size = (8 + p.s * 16) * dpr * (0.55 + P.d * 0.6) * tw;
      ctx.globalAlpha = P.d;
      ctx.drawImage(sprites[p.c], P.x - size / 2, P.y - size / 2, size, size);
    }
    ctx.globalAlpha = 1;
  }
  requestAnimationFrame(frame);
})();

/* ---------- stack network ---------- */
(function network() {
  const NODES = [
    { n: "LangGraph", s: "agent graphs", x: 13, y: 12, use: "agent workflows in the GenAI City Ops chatbot (Trinity Mobility)" },
    { n: "CrewAI", s: "multi-agent", x: 36, y: 6, use: "multi-agent orchestration for city operations (Trinity Mobility)" },
    { n: "LiteLLM", s: "model gateway", x: 64, y: 5, use: "the gateway every LLM call goes through (Trinity Mobility)" },
    { n: "Langfuse", s: "observability", x: 87, y: 14, use: "tracing and monitoring LLM calls (Trinity Mobility)" },
    { n: "Guardrails", s: "AI safety", x: 7, y: 42, use: "real-time prompt-injection and toxicity policies, at both companies" },
    { n: "Azure OpenAI", s: "fine-tuned", x: 93, y: 40, use: "a fine-tuned GPT-4o-mini that writes MongoDB queries (INVYPRO)" },
    { n: "MongoDB", s: "120+ collections", x: 10, y: 72, use: "the data behind the 95%-accurate RAG chatbot (INVYPRO)" },
    { n: "Neo4j", s: "graph data", x: 28, y: 92, use: "graph data management on the smart-city platform (Trinity Mobility)" },
    { n: "FastAPI", s: "backend", x: 50, y: 95, use: "the backend of the enterprise RAG chatbot (INVYPRO)" },
    { n: "Whisper", s: "voice", x: 71, y: 91, use: "voice input for the citizen parking assistant (Trinity Mobility)" },
    { n: "DeepEval", s: "LLM evals", x: 90, y: 70, use: "automated evaluation of LLM answers (Trinity Mobility)" },
  ];
  const wrap = $("#network"), nodesEl = $("#network-nodes"), svg = $("#network-lines"), hint = $("#network-hint"), center = $(".network__center");
  const defaultHint = hint.textContent;
  const NS = "http://www.w3.org/2000/svg";

  NODES.forEach((d, i) => {
    const b = document.createElement("button");
    b.className = "node";
    b.style.setProperty("--x", d.x + "%"); b.style.setProperty("--y", d.y + "%"); b.style.setProperty("--d", (-i * 0.7) + "s");
    b.dataset.openChat = `Where has Sam used ${d.n}?`;
    b.dataset.i = i;
    b.append(d.n);
    const sm = document.createElement("small"); sm.textContent = d.s; b.append(sm);
    nodesEl.append(b);
  });
  const nodeEls = $$(".node", nodesEl);

  function draw() {
    svg.replaceChildren();
    if (innerWidth <= 860) return;
    const W = wrap.clientWidth, H = wrap.clientHeight;
    svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
    const c = { x: W / 2, y: H / 2 };
    const rx = center.offsetWidth / 2 + 40, ry = center.offsetHeight / 2 + 26;
    NODES.forEach((d, i) => {
      const nx = (d.x / 100) * W, ny = (d.y / 100) * H;
      const ang = Math.atan2(ny - c.y, nx - c.x);
      const ax = c.x + Math.cos(ang) * rx, ay = c.y + Math.sin(ang) * ry;
      const horiz = Math.abs(nx - ax) > Math.abs(ny - ay);
      const pd = horiz
        ? `M${nx},${ny} C${(nx + ax) / 2},${ny} ${(nx + ax) / 2},${ay} ${ax},${ay}`
        : `M${nx},${ny} C${nx},${(ny + ay) / 2} ${ax},${(ny + ay) / 2} ${ax},${ay}`;
      const path = document.createElementNS(NS, "path");
      path.setAttribute("d", pd); path.id = "np" + i;
      const end = document.createElementNS(NS, "circle");
      end.setAttribute("cx", ax); end.setAttribute("cy", ay); end.setAttribute("r", 3.5); end.setAttribute("class", "end");
      svg.append(path, end);
      if (!reduceMotion) {
        const dot = document.createElementNS(NS, "circle");
        dot.setAttribute("r", 2.6); dot.setAttribute("class", "pulse-dot");
        const am = document.createElementNS(NS, "animateMotion");
        am.setAttribute("dur", (3 + Math.random() * 3).toFixed(1) + "s");
        am.setAttribute("begin", (Math.random() * 3).toFixed(1) + "s");
        am.setAttribute("repeatCount", "indefinite");
        const mp = document.createElementNS(NS, "mpath");
        mp.setAttribute("href", "#np" + i);
        am.append(mp); dot.append(am); svg.append(dot);
      }
    });
  }
  let rt;
  addEventListener("resize", () => { clearTimeout(rt); rt = setTimeout(draw, 150); });
  document.fonts?.ready.then(draw);
  draw();

  function focus(i) {
    nodeEls.forEach((n) => n.classList.toggle("hot", +n.dataset.i === i));
    $$("path", svg).forEach((p) => p.classList.toggle("hot", p.id === "np" + i));
    if (i == null) { hint.textContent = defaultHint; hint.classList.remove("hot"); return; }
    hint.textContent = `${NODES[i].n}: ${NODES[i].use}. Click to ask Chirpy.`;
    hint.classList.add("hot");
  }
  nodesEl.addEventListener("pointerover", (e) => { const n = e.target.closest(".node"); if (n) focus(+n.dataset.i); });
  nodesEl.addEventListener("pointerout", (e) => { if (!e.relatedTarget?.closest?.(".node")) focus(null); });
  nodesEl.addEventListener("focusin", (e) => { const n = e.target.closest(".node"); if (n) focus(+n.dataset.i); });
  nodesEl.addEventListener("focusout", () => focus(null));
})();

/* ---------- experience tabs ---------- */
$$(".tabs").forEach((tabs) => {
  const card = tabs.closest(".xp");
  tabs.addEventListener("click", (e) => {
    const tab = e.target.closest(".tab");
    if (!tab) return;
    $$(".tab", tabs).forEach((t) => { t.classList.toggle("active", t === tab); t.setAttribute("aria-selected", t === tab); });
    $$(".tab-panel", card).forEach((p) => p.classList.toggle("active", p.id === tab.dataset.tab));
  });
});

/* ---------- chat demo card: typing questions ---------- */
(function demo() {
  const typed = $("#demo-typed"), input = $("#demo-input");
  const qs = ["What is Sam building at Trinity Mobility?", "How did Sam hit 95% accuracy?", "Which agent frameworks does Sam use?", "Is Sam open to new roles?"];
  let q = 0, c = 0, del = false;
  input.addEventListener("click", () => window.Chirpy?.open(qs[q]));
  if (reduceMotion) { typed.textContent = qs[0]; return; }
  (function tick() {
    typed.textContent = qs[q].slice(0, c);
    if (!del && c === qs[q].length) { del = true; return setTimeout(tick, 2200); }
    if (del && c === 0) { del = false; q = (q + 1) % qs.length; }
    c += del ? -1 : 1;
    setTimeout(tick, del ? 18 : 48 + Math.random() * 50);
  })();
})();

/* ---------- live Bengaluru clock ---------- */
(function clock() {
  const t = $("#local-time"), m = $("#local-mood");
  if (!t) return;
  const time = new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", hour: "numeric", minute: "2-digit", hour12: true });
  const hour = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Kolkata", hour: "numeric", hourCycle: "h23" });
  function tick() {
    const now = new Date(), h = +hour.format(now);
    t.textContent = time.format(now);
    m.textContent = h >= 23 || h < 6 ? "probably asleep, but Chirpy's awake 🐦"
      : h < 10 ? "starting the day ☀️"
      : "probably shipping something 🛠️";
  }
  tick();
  setInterval(tick, 30000);
})();

/* ---------- project filters ---------- */
const filterBar = $(".filters"), projects = $$("#projects-grid .project");
filterBar.addEventListener("click", (e) => {
  const btn = e.target.closest(".filter");
  if (!btn) return;
  $$(".filter", filterBar).forEach((b) => b.classList.toggle("active", b === btn));
  const f = btn.dataset.filter;
  projects.forEach((p) => {
    const show = f === "all" || p.dataset.cat.split(" ").includes(f);
    p.classList.toggle("is-hidden", !show);
    p.classList.remove("pop");
    if (show) { p.classList.add("in"); void p.offsetWidth; p.classList.add("pop"); }
  });
});

/* ---------- pointer niceties ---------- */
if (finePointer && !reduceMotion) {
  document.addEventListener("pointermove", (e) => {
    const card = e.target.closest(".card");
    if (!card) return;
    const r = card.getBoundingClientRect();
    card.style.setProperty("--mx", e.clientX - r.left + "px");
    card.style.setProperty("--my", e.clientY - r.top + "px");
  }, { passive: true });

  $$(".magnetic").forEach((btn) => {
    btn.addEventListener("pointermove", (e) => {
      const r = btn.getBoundingClientRect();
      btn.style.transform = `translate(${(e.clientX - r.left - r.width / 2) * 0.18}px, ${(e.clientY - r.top - r.height / 2) * 0.28}px)`;
    });
    btn.addEventListener("pointerleave", () => { btn.style.transform = ""; });
  });
}
