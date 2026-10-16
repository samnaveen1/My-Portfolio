/* ========== Chirpy (AI chat) + Byte (sidekick) ========== */
(function () {
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const G = window.ChirpyGuard;
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const wait = (ms) => new Promise((r) => setTimeout(r, reduceMotion ? Math.min(ms, 2500) : ms));

  const chirpy = $("#chirpy"), cbtn = $("#chirpy-btn"), csvg = $("#chirpy-svg"), badge = $("#chirpy-badge");
  const cspeech = $("#chirpy-speech"), ctext = $("#chirpy-text");
  const byte = $("#byte"), bspeech = $("#byte-speech"), btext = $("#byte-text");
  const chat = $("#chat"), log = $("#chat-log"), form = $("#chat-form"), input = $("#chat-input"), chipsEl = $("#chat-chips");
  const sendBtn = $(".chat__send");

  const API_URL = "/api/chat";
  // AI budget per visitor: at most API_MAX model calls per 10 minutes. Past that, Chirpy keeps
  // answering from its built-in notes instead of refusing (the server has its own hard limits too).
  const API_WINDOW_MS = 10 * 60 * 1000;
  const API_MAX = 15;
  const COOLDOWN_MS = 900;
  try { sessionStorage.removeItem("chirpy-count"); } catch (e) {} // old hard cap that blocked testers
  const EMAIL = "samnaveen840@gmail.com";
  const history = [];
  let offline = location.protocol === "file:";
  let busy = false, lastSend = 0, greeted = false;
  const askQueue = []; let skipTyping = false; // questions asked while Chirpy is still answering wait their turn

  /* ================= knowledge base (offline fallback) ================= */
  const KB = [
    { re: /^(hi+|hey+|hello+|yo|hola|namaste|vanakkam|good (morning|afternoon|evening))\b/i,
      a: "Hey there! 👋 I'm Chirpy, Sam's AI sidekick. Ask me about Sam's current work, projects, skills or how to get in touch." },
    { re: /who are you|what (can|do) you do|^help\b/i,
      a: "I'm Chirpy 🐦, a little AI bird who knows Sam's portfolio inside out. I can tell you about:\n- Sam's work at **Trinity Mobility** and **INVYPRO**\n- Projects, skills and certifications\n- LeetCode stats\n- How to contact or hire Sam" },
    { re: /^(thanks?|thank (you|u)|cool|great|nice|awesome|ok(ay)?)\b/i, a: "Happy to help! 🐦 Anything else you'd like to know about Sam?" },
    { re: /parking/i,
      a: "At Trinity Mobility, Sam built a **smart-city parking chatbot for citizens** with n8n, Python, LangChain and agent-based tool calling. It handles location detection, parking search, vehicle selection, date/time parsing and slot booking, by text or by voice (Whisper), with Ministral as the LLM." },
    { re: /city ops|rbac|multi.?agent|crew ?ai|lang ?graph|orchestrat|agent frameworks?/i,
      a: "Sam is building a **GenAI City Ops chatbot** at Trinity Mobility. It uses role-based access control so each role only reaches permitted data, multi-agent orchestration with **CrewAI and LangGraph**, and a **LiteLLM** gateway for model routing." },
    { re: /guardrail|safety|injection|toxic|langfuse|deepeval|langflow|observab|evaluat/i,
      a: "Safety is a big part of Sam's work: **real-time guardrail policies** for prompt-injection and toxic-content detection, plus LLM observability and evaluation with Langfuse, LangFlow and DeepEval. (I'm protected by guardrails too 🛡️)" },
    { re: /\b(trinity|current(ly)?|now|present|smart.?city|working on|building)\b/i,
      a: "Sam is an **Associate AI Engineer at Trinity Mobility** (Bengaluru, since Jun 2026) on a smart-city project:\n- Citizen parking chatbot (text + voice)\n- GenAI City Ops chatbot with RBAC\n- Multi-agent orchestration with CrewAI + LangGraph via LiteLLM\n- Real-time guardrails, Langfuse/DeepEval observability, voice & vision" },
    { re: /invypro|better lives|supply|sales|first (company|job)|95|accuracy|intern(ship)?\b/i,
      a: "At **Better Lives (INVYPRO)** (Aug 2025 – Jun 2026), Sam built a full-stack **RAG chatbot** that lets employees query supply-chain and sales data in plain English: NestJS + FastAPI, JWT auth, RBAC and Redis caching over **120+ MongoDB collections**. LangChain + fine-tuned Azure OpenAI GPT-4o-mini + Guardrails AI generate MongoDB queries at **95% accuracy**." },
    { re: /experience|career|background|worked|companies|jobs?\b|summar/i,
      a: "Sam's experience:\n- **Associate AI Engineer, Trinity Mobility** (Jun 2026 – now): smart-city parking bot, GenAI City Ops chatbot, multi-agent systems, guardrails\n- **AI/ML Intern, Better Lives (INVYPRO)** (Aug 2025 – Jun 2026): supply-chain RAG chatbot over 120+ MongoDB collections, 95% accuracy" },
    { re: /navigation|blind|visually|accessib|mobilenet|ocr|tesseract/i,
      a: "The **Navigation Voice Assistant** (Jan 2026) is an on-device multi-modal AI app that describes on-screen content aloud for visually impaired users, using MobileNetV3 for objects and Tesseract for text. Related paper: \"CNN-NLP-Transformer Based Social Media Accessibility for Blind Users\" (NCAIMLC 2026)." },
    { re: /projects?|built|portfolio|showcase/i,
      a: "Highlights:\n- 🅿️ Smart-city parking assistant (agentic, voice)\n- 🏙️ GenAI City Ops chatbot (multi-agent, RBAC)\n- 📦 Supply-chain RAG chatbot (95% accuracy)\n- 🦯 Navigation voice assistant for visually impaired users\n- Plus ML/web projects on https://github.com/samnaveen1" },
    { re: /paper|conference|publication|ncaimlc|research/i,
      a: "Sam presented the paper **\"CNN-NLP-Transformer Based Social Media Accessibility for Blind Users\"** at NCAIMLC, a national conference at Bannari Amman Institute of Technology, on 24 Jan 2026." },
    { re: /certif|course|nptel|qlik/i,
      a: "Sam's certifications:\n- MongoDB: RAG with MongoDB (Aug 2025)\n- MongoDB: Vector Search Fundamentals (Aug 2025)\n- Neo4j: Intro to Graph Data Science (Aug 2025)\n- Qlik Sense Business Analyst (Aug 2025)\n- NPTEL: Data Analytics with Python, IIT Roorkee (2024)" },
    { re: /leet ?code|dsa|problem|streak|competitive|contest/i,
      a: "On LeetCode Sam has solved **412 problems** (264 easy, 132 medium, 16 hard), made 802 submissions in 2025, was active 304 days, and hit a **112-day streak** 🔥 Profile: https://leetcode.com/u/samnaveen0075/" },
    { re: /educat|college|degree|b\.?tech|cgpa|gpa|karpagam|study|graduat/i,
      a: "Sam holds a **B.Tech in Artificial Intelligence & Data Science** from Karpagam College of Engineering (2026), with a **CGPA of 8.10**." },
    { re: /\b(skills?|stack|tech\w*|tools?|languages?|good at|expertise)\b/i,
      a: "Sam's core stack:\n- **GenAI:** LangChain, LangGraph, CrewAI, RAG, MCP, Azure OpenAI, fine-tuning, LiteLLM\n- **Safety/obs:** Guardrails, RBAC, Langfuse, DeepEval\n- **Backend/data:** Python, FastAPI, NestJS, MongoDB, Neo4j, PostgreSQL, Redis\n- **ML/vision:** Whisper, MobileNetV3, OCR, TensorFlow, scikit-learn\n- **DevOps:** Docker, Jenkins, GitLab, SonarQube, Azure DevOps" },
    { re: /resume|cv\b|download/i, a: "You can download Sam's resume here: resume.pdf 📄" },
    { re: /\b(hire|hiring|available|availability|open to|opportunit\w*|roles?|recruit\w*|job offer|notice|relocat\w*)\b/i,
      a: "Sam is **open to AI / ML engineering roles** 🚀 Best way to reach out: " + EMAIL + " or LinkedIn https://in.linkedin.com/in/samnaveen27. For details like notice period, please ask Sam directly." },
    { re: /contact|email|mail|phone|call|reach|linkedin|github|connect/i,
      a: "Reach Sam at:\n- ✉️ " + EMAIL + "\n- 📞 +91 63791 42178\n- 💼 https://in.linkedin.com/in/samnaveen27\n- 💻 https://github.com/samnaveen1" },
    { re: /\b(where|location|located|based|bengaluru|bangalore|coimbatore)\b/i, a: "Sam is based in **Bengaluru (Bangalore), India** 📍, working at Trinity Mobility." },
  ];
  const SKILL_WHERE = {
    crewai: "Multi-agent orchestration for the GenAI City Ops chatbot at Trinity Mobility.",
    langgraph: "Agent workflows for the GenAI City Ops chatbot at Trinity Mobility.",
    litellm: "The model gateway at Trinity Mobility, routing every LLM call.",
    langfuse: "LLM observability and tracing at Trinity Mobility.",
    deepeval: "LLM evaluation at Trinity Mobility.",
    guardrails: "Real-time guardrail policies at Trinity Mobility, and Guardrails AI in the INVYPRO RAG chatbot.",
    "azure openai": "A fine-tuned GPT-4o-mini that generates MongoDB queries in the INVYPRO RAG chatbot.",
    mongodb: "120+ collections queried in natural language at INVYPRO; also two MongoDB certifications.",
    neo4j: "Data management at Trinity Mobility; plus the Neo4j Graph Data Science certification.",
    fastapi: "The backend of the INVYPRO RAG chatbot.",
    whisper: "Voice input for the Trinity Mobility parking assistant.",
    n8n: "Workflow automation behind the Trinity Mobility parking assistant.",
  };
  function kbAnswer(q) {
    const m = q.match(/where has sam used (.+?)\??$/i);
    if (m) {
      const name = m[1].trim(), hit = SKILL_WHERE[name.toLowerCase()];
      return hit ? `**${name}**: ${hit}` : `**${name}** is part of Sam's toolkit. For a deeper dive, email ${EMAIL}.`;
    }
    const hit = KB.find((k) => k.re.test(q));
    return hit ? hit.a : "Hmm, I'm not sure about that one 🤔 I can tell you about Sam's experience, projects, skills, LeetCode, certifications or contact details. For anything else, email " + EMAIL + ".";
  }

  /* ================= safe rendering ================= */
  const esc = (s) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  function render(text) {
    let html = esc(text);
    html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
    html = html.replace(/(https:\/\/[^\s<]+[^\s<.,;:!?)])/g, (url) =>
      G.isAllowedUrl(url.replace(/&amp;/g, "&")) ? `<a href="${url}" target="_blank" rel="noopener noreferrer">${url.replace(/^https:\/\/(www\.)?/, "")}</a>` : url);
    html = html.replace(/\b(samnaveen840@gmail\.com)\b/g, '<a href="mailto:$1">$1</a>');
    html = html.replace(/\bresume\.pdf\b/g, '<a href="resume.pdf" target="_blank" rel="noopener">resume.pdf</a>');
    return html;
  }

  /* ================= mascot: state, moods, actions ================= */
  const setState = (s) => (chirpy.dataset.state = s);
  const mood = (m) => (csvg.dataset.mood = m);
  function act(cls, ms = 700) {
    if (reduceMotion) return;
    csvg.classList.remove(cls); void csvg.getBoundingClientRect(); csvg.classList.add(cls);
    setTimeout(() => csvg.classList.remove(cls), ms);
  }
  function talk(text) {
    if (reduceMotion) return;
    csvg.classList.add("talking");
    setTimeout(() => csvg.classList.remove("talking"), Math.min(1800, 300 + text.length * 35));
  }
  function hideSpeech() { cspeech.classList.remove("show"); bspeech.classList.remove("show"); }

  // eyes follow the cursor
  const pupils = $(".c-pupils", csvg);
  if (!reduceMotion) {
    addEventListener("pointermove", (e) => {
      const r = csvg.getBoundingClientRect();
      const dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height * 0.5);
      const d = Math.hypot(dx, dy) || 1, k = Math.min(d / 140, 1) * 4.5;
      pupils.style.transform = `translate(${(dx / d) * k}px, ${(dy / d) * k}px)`;
    }, { passive: true });
    (function blinkLoop() {
      if (!["proud", "sleepy"].includes(csvg.dataset.mood)) act("blink", 200);
      setTimeout(blinkLoop, 2400 + Math.random() * 3600);
    })();
  }

  /* ================= banter scenes ================= */
  let muted = false;
  try { muted = sessionStorage.getItem("chirpy-muted") === "1"; } catch (e) {}
  let playing = false, sceneAsk = null;
  const queue = [];

  async function chirpySay(text, m = "happy", ms = 4200) {
    if (chirpy.dataset.state !== "peek") {
      // fly up out of the corner, flapping
      csvg.classList.add("flying"); setState("peek"); await wait(650); csvg.classList.remove("flying");
    }
    mood(m);
    if (m === "angry") act("shake", 520); else act("hop", 700);
    ctext.textContent = text;
    cspeech.classList.add("show");
    talk(text);
    await wait(ms);
  }
  async function byteSay(text, ms = 3600) {
    if (byte.dataset.state !== "peek") { byte.dataset.state = "peek"; await wait(500); }
    btext.textContent = text;
    bspeech.classList.add("show");
    await wait(ms);
  }

  async function play(scene) {
    if (muted || !chat.hidden) return;
    if (playing || roaming) { if (queue.length < 2) queue.push(scene); return; }
    playing = true; sceneAsk = scene.ask || null;
    wake();
    badge.classList.remove("gone");
    for (const line of scene.lines) {
      if (muted || !chat.hidden) break;
      if (line.byte) { cspeech.classList.remove("show"); await byteSay(line.byte, line.ms); bspeech.classList.remove("show"); }
      else { await chirpySay(line.text, line.mood, line.ms); }
    }
    hideSpeech();
    byte.dataset.state = "hidden";
    if (chat.hidden) { setState("docked"); mood("happy"); }
    playing = false;
    if (queue.length && !muted) setTimeout(() => play(queue.shift()), 1600);
  }

  const SCENES = {
    intro: { lines: [{ text: "Hi! I'm Chirpy 🐦 Sam's AI sidekick. Tap me if you have any questions!", mood: "happy", ms: 5200 }] },
    stack: { lines: [{ text: "Ooh, hover the glowing nodes. Each one has a story!", mood: "curious", ms: 4200 }] },
    experience: { ask: "How did Sam reach 95% accuracy on the RAG chatbot?",
      lines: [{ text: "Sam's chatbot hit 95% accuracy. Want to know how? Tap me!", mood: "happy", ms: 4600 }] },
    projects: { ask: "Tell me about Sam's smart-city parking assistant",
      lines: [{ byte: "The parking bot is my favourite. Ask the bird about it.", ms: 3600 }, { text: "Hey! Explaining things is MY job.", mood: "angry", ms: 3200 }] },
    wins: { ask: "Tell me about Sam's LeetCode stats",
      lines: [{ text: "A 112-day LeetCode streak! I'm so proud of Sam!", mood: "proud", ms: 3800 }, { byte: "Chirpy's getting emotional again…", ms: 3400 }] },
    contact: { ask: "How do I contact Sam?",
      lines: [{ text: "Hiring? I can pass your message to Sam in one tap 📬", mood: "happy", ms: 4800 }] },
  };

  setTimeout(() => (muted ? setState("docked") : play(SCENES.intro)), 2200);
  const seen = new Set();
  const sceneIO = new IntersectionObserver((entries) => {
    entries.forEach((en) => {
      const id = en.target.id;
      if (!en.isIntersecting || seen.has(id)) return;
      seen.add(id);
      setTimeout(() => play(SCENES[id]), 700);
    });
  }, { threshold: 0.35 });
  ["stack", "experience", "projects", "wins", "contact"].forEach((id) => { const s = document.getElementById(id); if (s) sceneIO.observe(s); });

  cspeech.addEventListener("click", (e) => {
    if (e.target.closest("#speech-close")) {
      e.stopPropagation();
      muted = true;
      try { sessionStorage.setItem("chirpy-muted", "1"); } catch (err) {}
      hideSpeech(); byte.dataset.state = "hidden"; setState("docked");
      window.showToast?.("Chirpy will stay quiet. Tap the bird anytime 🐦");
      return;
    }
    openChat(sceneAsk);
  });

  /* ================= roaming: fly to a card, land, walk around, fly home ================= */
  let roaming = false, roamAbort = false, homing = false, fastHome = false;
  let curAnim = null, roamPromise = null, homePos = { x: 0, y: 0 }, pos = { x: 0, y: 0 };
  const tr = (x, y, r = 0) => `translate(${x - homePos.x}px, ${y - homePos.y}px) rotate(${r}deg)`;
  const birdSize = () => ({ w: cbtn.offsetWidth, h: cbtn.offsetHeight });

  function puff(cls, text, x, y, ms = 1500) {
    const el = document.createElement("span");
    el.className = cls; el.textContent = text || "";
    el.style.left = x + "px"; el.style.top = y + "px";
    document.body.append(el);
    setTimeout(() => el.remove(), ms);
  }
  const emote = (t) => { const { w } = birdSize(); puff("emote", t, pos.x + w * 0.5, pos.y - 14); };

  // a visible card / heading the bird can stand on
  function pickPerch() {
    const { w, h } = birdSize();
    const spots = $$(".card, .section__head h2, .network__center h2, .polaroid, .about__text h2, .contact h2, .cert")
      .map((el) => el.getBoundingClientRect())
      .filter((r) => r.width > w + 40 && r.top > h + 80 && r.top < innerHeight - 140 && r.left >= 0 && r.right <= innerWidth);
    if (!spots.length) return null;
    const r = spots[Math.floor(Math.random() * spots.length)];
    return { x: r.left + 8 + Math.random() * Math.max(r.width - w - 16, 1), y: r.top - h * 0.93 + 2, rect: r };
  }

  function run(frames, opts) {
    const prev = curAnim;
    curAnim = cbtn.animate(frames, { ...opts, fill: "forwards" });
    prev?.cancel();
    return curAnim.finished.then(() => !roamAbort, () => false);
  }

  // flight scales with the screen: shorter, flatter arcs on phones; longer glides on big monitors
  function flyTo(x, y, { dur, arc } = {}) {
    const x0 = pos.x, y0 = pos.y, dist = Math.hypot(x - x0, y - y0);
    const diag = Math.hypot(innerWidth, innerHeight);
    arc = arc ?? Math.max(40, Math.min(140, innerHeight * 0.14));
    dur = dur ?? Math.max(600, Math.min(2200, 650 + (dist / diag) * 1700));
    if (Math.abs(x - x0) > 4) csvg.classList.toggle("left", x < x0);
    const cx = (x0 + x) / 2, cy = Math.max(Math.min(y0, y) - arc, 64); // never fly up under the nav
    const frames = [];
    for (let i = 0; i <= 28; i++) { // sample a curved flight path
      const t = i / 28, mt = 1 - t;
      const px = mt * mt * x0 + 2 * mt * t * cx + t * t * x;
      const py = mt * mt * y0 + 2 * mt * t * cy + t * t * y;
      const dx = 2 * mt * (cx - x0) + 2 * t * (x - cx), dy = 2 * mt * (cy - y0) + 2 * t * (y - cy);
      frames.push({ transform: tr(px, py, (dx / (Math.hypot(dx, dy) + 1)) * 16 * Math.sin(Math.PI * t)) });
    }
    csvg.classList.add("flying");
    return run(frames, { duration: dur, easing: "ease-in-out" }).then((ok) => {
      csvg.classList.remove("flying");
      if (ok) pos = { x, y };
      return ok;
    });
  }

  function walkTo(x) {
    const x0 = pos.x;
    csvg.classList.toggle("left", x < x0);
    csvg.classList.add("walking");
    return run([{ transform: tr(x0, pos.y) }, { transform: tr(x, pos.y) }], { duration: 250 + Math.abs(x - x0) * 12, easing: "linear" }).then((ok) => {
      csvg.classList.remove("walking");
      if (ok) pos = { x, y: pos.y };
      return ok;
    });
  }

  // a pause that ends early if the bird gets interrupted
  async function rwait(ms) {
    const end = Date.now() + ms;
    while (Date.now() < end && !roamAbort) await new Promise((r) => setTimeout(r, 100));
    return !roamAbort;
  }

  async function idleAt(kind) {
    if (kind === "peck") { csvg.classList.add("peck"); emote("♪"); await rwait(1500); csvg.classList.remove("peck"); }
    else if (kind === "look") {
      mood("curious");
      if (await rwait(600)) { csvg.classList.toggle("left"); await rwait(700); csvg.classList.toggle("left"); }
      if (!roamAbort) { emote("👀"); await rwait(800); }
      mood("happy");
    } else { mood("proud"); emote("❤"); await rwait(1400); mood("happy"); }
    return !roamAbort;
  }

  async function flyHome() {
    homing = true; roamAbort = false;
    await flyTo(homePos.x, homePos.y, fastHome ? { dur: 500, arc: 30 } : { arc: Math.min(90, innerHeight * 0.1) });
    csvg.classList.remove("left", "walking", "flying", "peck");
    curAnim?.cancel(); curAnim = null;
    cbtn.style.left = cbtn.style.top = cbtn.style.transform = "";
    setState("peek"); mood("happy");
    homing = false; roaming = false; fastHome = false;
    setTimeout(() => { if (chat.hidden && !roaming && !playing) setState("docked"); }, 1400);
    if (queue.length && !muted) setTimeout(() => play(queue.shift()), 1600);
  }

  async function roam() {
    if (roaming || playing || muted || !chat.hidden || reduceMotion || document.hidden || chirpy.classList.contains("sleeping")) return false;
    if (!pickPerch()) return false;
    roaming = true; roamAbort = false;
    hideSpeech();
    if (chirpy.dataset.state !== "peek") { csvg.classList.add("flying"); setState("peek"); await wait(700); csvg.classList.remove("flying"); }
    const target = pickPerch(); // re-measure: the page may have scrolled meanwhile
    if (!target || !chat.hidden || roamAbort) {
      roaming = false; roamAbort = false; fastHome = false;
      if (chat.hidden) setState("docked");
      if (queue.length && !muted) setTimeout(() => play(queue.shift()), 800);
      return false;
    }
    const r = cbtn.getBoundingClientRect();
    homePos = { x: r.left, y: r.top }; pos = { ...homePos };
    cbtn.style.left = r.left + "px"; cbtn.style.top = r.top + "px";
    setState("roam");
    emote("!");
    let ok = await flyTo(target.x, target.y);
    if (ok) {
      const { w, h } = birdSize();
      puff("dust", "", pos.x + w / 2 - 35, pos.y + h * 0.93 - 7, 700);
      act("hop", 700);
      ok = await rwait(600);
      const minX = target.rect.left + 6, maxX = Math.max(target.rect.right - w - 6, minX);
      const stops = 1 + Math.floor(Math.random() * 2);
      for (let i = 0; i < stops && ok && !roamAbort; i++) {
        const stride = target.rect.width * (0.12 + Math.random() * 0.25); // walk further on wide cards
        const nx = Math.max(minX, Math.min(maxX, pos.x + (Math.random() < 0.5 ? -1 : 1) * stride));
        ok = await walkTo(nx);
        if (ok) ok = await idleAt(["peck", "look", "love"][Math.floor(Math.random() * 3)]);
      }
    }
    await flyHome();
    return true;
  }

  // scrolling, resizing or clicking the bird sends it home
  function interrupt(fast = false) {
    if (!roaming || homing || roamAbort || chirpy.dataset.state !== "roam") return;
    roamAbort = true; fastHome = fast;
    const m = new DOMMatrixReadOnly(getComputedStyle(cbtn).transform);
    pos = { x: homePos.x + m.m41, y: homePos.y + m.m42 };
    cbtn.style.transform = m.toString();
    curAnim?.cancel(); curAnim = null;
    if (!fast) emote("!");
  }
  addEventListener("scroll", () => interrupt(false), { passive: true });
  addEventListener("resize", () => interrupt(true));

  // How often Chirpy flies around. For every 30 seconds instead, use 30 * 1000.
  const ROAM_EVERY_MS = 30 * 60 * 1000; // every 30 minutes
  const FIRST_ROAM_MS = 15000;          // one early flight so visitors actually get to see it
  function startRoam() { if (!roaming) roamPromise = roam(); return roamPromise; }
  let nextRoam;
  function scheduleRoam(ms, retries = 4) {
    clearTimeout(nextRoam);
    nextRoam = setTimeout(async () => {
      const flew = await startRoam();
      // busy (talking, chat open, tab hidden…)? try again shortly instead of waiting the full interval
      if (!flew && retries > 0) scheduleRoam(10000, retries - 1);
      else scheduleRoam(ROAM_EVERY_MS);
    }, ms);
  }
  scheduleRoam(FIRST_ROAM_MS);

  // Chirpy notices when the theme changes
  document.addEventListener("themechange", (e) => {
    if (muted || !chat.hidden || roaming) return;
    const dark = e.detail === "dark";
    play({ lines: [{ text: dark ? "Ooh, dark mode. Very mysterious 🌙" : "Lights on! ☀️ Much better for my feathers.", mood: dark ? "curious" : "happy", ms: 2800 }] });
  });

  /* ================= sleep when idle ================= */
  let idleTimer;
  function wake() {
    if (chirpy.classList.contains("sleeping")) {
      chirpy.classList.remove("sleeping"); mood("happy"); act("hop");
    }
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => {
      if (!chat.hidden || playing || roaming) return;
      chirpy.classList.add("sleeping"); mood("sleepy");
    }, 35000);
  }
  ["pointermove", "scroll", "keydown", "touchstart"].forEach((ev) => addEventListener(ev, wake, { passive: true }));

  /* ================= chat UI ================= */
  const asked = new Set();
  const LOG_KEY = "chirpy-log";
  function savedLog() { try { return JSON.parse(sessionStorage.getItem(LOG_KEY) || "[]"); } catch (e) { return []; } }
  function saveLog(entry) {
    try { sessionStorage.setItem(LOG_KEY, JSON.stringify([...savedLog(), entry].slice(-40))); } catch (e) {}
  }

  // returns a promise that resolves once the message is fully shown
  function addMsg(text, who, opts = {}) {
    const el = document.createElement("div");
    el.className = `msg msg--${who}` + (opts.warn ? " msg--warn" : "");
    const finish = () => {
      if (who === "user") el.textContent = text; else el.innerHTML = render(text);
      if (opts.meta) { const m = document.createElement("span"); m.className = "msg__meta"; m.textContent = opts.meta; el.append(m); }
      log.scrollTop = log.scrollHeight;
      return el;
    };
    log.append(el);
    if (!opts.restore) saveLog({ text, who, warn: !!opts.warn, meta: opts.meta || "" });
    if (who === "user" || !opts.type || reduceMotion) return Promise.resolve(finish());
    // typewriter: reveal the plain text, then swap in the formatted version (bold, links)
    return new Promise((resolve) => {
      const plain = text.replace(/\*\*/g, "");
      const dur = Math.min(1100, 14 * plain.length), t0 = performance.now(); // time-based, never stalls
      (function tick() {
        const p = skipTyping ? 1 : Math.min(1, (performance.now() - t0) / dur);
        el.textContent = plain.slice(0, Math.ceil(plain.length * p));
        log.scrollTop = log.scrollHeight;
        if (p < 1) setTimeout(tick, 16); else resolve(finish());
      })();
    });
  }

  // follow-up suggestions that fit what was just asked
  const FOLLOW = [
    [/parking/i, ["How does the City Ops bot work?", "Where has Sam used Whisper?", "Top projects"]],
    [/city ops|rbac|multi|crew|graph|agent/i, ["Tell me about the parking bot", "How does Sam handle guardrails?", "Where has Sam used LiteLLM?"]],
    [/guardrail|safety|eval|langfuse/i, ["How does the City Ops bot work?", "Tech stack", "Is Sam open to new roles?"]],
    [/95|accuracy|invypro|rag|supply|intern/i, ["What is Sam working on now?", "Top projects", "Where has Sam used MongoDB?"]],
    [/trinity|\bnow\b|current|working/i, ["Tell me about the parking bot", "How does the City Ops bot work?", "Tech stack"]],
    [/project|built/i, ["Tell me about the parking bot", "Navigation voice assistant", "GitHub profile"]],
    [/skill|stack|tech|tool|used/i, ["Where has Sam used CrewAI?", "Where has Sam used LangGraph?", "Certifications"]],
    [/leet|streak|dsa/i, ["Certifications", "Education", "Top projects"]],
    [/cert|educat|college|paper/i, ["LeetCode stats", "Tech stack", "Resume"]],
    [/contact|email|hire|open|role|resume|based/i, ["Resume", "Where is Sam based?", "What is Sam working on now?"]],
  ];
  const MORE_CHIPS = ["Where has Sam used LangGraph?", "Where has Sam used MongoDB?", "Tell me about Sam's paper", "Where has Sam used LiteLLM?", "Education"];
  function followUps(q) {
    const hit = FOLLOW.find(([re]) => re.test(q));
    const fresh = [...new Set([...(hit ? hit[1] : []), ...DEFAULT_CHIPS, ...MORE_CHIPS])].filter((c) => !asked.has(c.toLowerCase()));
    return fresh.length ? fresh.slice(0, 5) : DEFAULT_CHIPS; // asked everything? offer the basics again
  }

  function resetChat() {
    log.replaceChildren(); history.length = 0; asked.clear();
    try { sessionStorage.removeItem(LOG_KEY); } catch (e) {}
    addMsg("Fresh start! 🐦 What would you like to know about Sam?", "bot", { type: true });
    setChips();
    input.focus();
  }
  function typingDots() {
    const el = document.createElement("div");
    el.className = "msg msg--bot typing";
    el.innerHTML = "<i></i><i></i><i></i>";
    log.append(el);
    log.scrollTop = log.scrollHeight;
    return el;
  }
  const DEFAULT_CHIPS = ["What is Sam working on now?", "Top projects", "Tech stack", "LeetCode stats", "How do I contact Sam?", "Resume"];
  function setChips(list = DEFAULT_CHIPS) {
    chipsEl.replaceChildren(...list.map((q) => {
      const b = document.createElement("button");
      b.type = "button"; b.className = "qchip"; b.textContent = q;
      b.addEventListener("click", () => ask(q));
      return b;
    }));
  }

  async function openChat(question) {
    if (roaming) { // fly home first, then open
      if (chirpy.dataset.state === "roam") interrupt(true); else roamAbort = true;
      await roamPromise;
    }
    hideSpeech(); byte.dataset.state = "hidden";
    badge.classList.add("gone");
    chirpy.classList.remove("sleeping");
    if (chat.hidden) {
      chat.hidden = false;
      cbtn.setAttribute("aria-expanded", "true");
      setState("open"); mood("happy"); act("hop");
      if (!greeted) {
        greeted = true;
        const saved = savedLog(); // continue the conversation after a page reload
        if (saved.length) saved.forEach((m) => { addMsg(m.text, m.who, { warn: m.warn, meta: m.meta, restore: true }); if (m.who === "user") asked.add(m.text.toLowerCase()); });
        else addMsg("Hi! I'm **Chirpy** 🐦, Sam's AI assistant. Ask me anything about Sam's work, projects or skills. I only answer questions about Sam, so off-topic or unsafe prompts get politely blocked.", "bot", { type: true });
        setChips(saved.length ? followUps(saved.filter((m) => m.who === "user").pop()?.text || "") : DEFAULT_CHIPS);
      }
    }
    if (question) ask(question); else setTimeout(() => input.focus(), 60);
  }
  function closeChat() {
    if (chat.hidden) return;
    chat.classList.add("closing");
    cbtn.setAttribute("aria-expanded", "false");
    setTimeout(() => { chat.hidden = true; chat.classList.remove("closing"); setState("docked"); }, 220);
  }
  window.Chirpy = { open: openChat, close: closeChat, roam: startRoam };

  cbtn.addEventListener("click", () => (chat.hidden ? openChat() : closeChat()));
  $("#chat-close").addEventListener("click", closeChat);
  $("#chat-reset").addEventListener("click", resetChat);
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeChat(); });
  document.addEventListener("click", (e) => {
    const trigger = e.target.closest("[data-open-chat]");
    if (trigger) { e.preventDefault(); openChat(trigger.dataset.openChat); }
  });
  form.addEventListener("submit", (e) => { e.preventDefault(); const v = input.value; input.value = ""; ask(v); });

  let pokes = 0, pokeTimer;
  cbtn.addEventListener("pointerdown", () => {
    pokes++; clearTimeout(pokeTimer); pokeTimer = setTimeout(() => (pokes = 0), 1200);
    if (pokes === 4) { mood("angry"); act("shake", 520); window.showToast?.("Hey! That tickles 😤"); setTimeout(() => mood("happy"), 1800); }
  });

  /* ================= ask flow ================= */
  function apiCalls() {
    try { return JSON.parse(sessionStorage.getItem("chirpy-api") || "[]").filter((t) => Date.now() - t < API_WINDOW_MS); }
    catch (e) { return []; }
  }
  function spendApi() {
    const calls = apiCalls(); calls.push(Date.now());
    try { sessionStorage.setItem("chirpy-api", JSON.stringify(calls)); } catch (e) {}
  }
  function react(warn) {
    if (warn) { mood("angry"); act("shake", 520); setTimeout(() => mood("happy"), 2600); }
    else { mood("happy"); act("wave", 1500); }
  }

  async function ask(raw) {
    // never drop a question: if Chirpy is mid-answer, finish that instantly and answer this one next
    if (busy) { if (askQueue.length < 4) askQueue.push(raw); skipTyping = true; return; }
    const now = Date.now();
    if (now - lastSend < COOLDOWN_MS) { if (askQueue.length < 4) askQueue.push(raw); setTimeout(flushPending, COOLDOWN_MS - (now - lastSend) + 20); return; }
    const result = G.check(raw);
    input.value = "";
    if (result.code === "empty") { input.focus(); return; }

    addMsg(G.normalize(raw).slice(0, G.MAX_LEN + 20), "user");
    lastSend = now;

    if (!result.ok) {
      addMsg(G.MESSAGES[result.code], "bot", { warn: true, meta: "🛡️ blocked by guardrails" });
      react(true);
      return;
    }
    asked.add(result.text.toLowerCase());
    busy = true;
    mood("curious");
    const dots = typingDots();
    let reply, meta, warn = false;
    const useApi = !offline && apiCalls().length < API_MAX;

    if (useApi) {
      spendApi();
      try {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 25000);
        const res = await fetch(API_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: [...history, { role: "user", content: result.text }].slice(-8) }),
          signal: ctrl.signal,
        });
        clearTimeout(timer);
        const data = await res.json().catch(() => ({}));
        if (res.ok && data.reply) {
          reply = data.reply;
          if (data.blocked) { warn = true; meta = "🛡️ blocked by guardrails"; }
        } else if (res.status === 429) {
          // server says slow down: answer from the built-in notes below instead of refusing
        } else {
          throw new Error("api " + res.status);
        }
      } catch (err) {
        offline = true; // use the built-in knowledge base for the rest of the visit
      }
    }

    if (!reply) {
      await wait(300 + Math.random() * 300);
      reply = result.unsure ? G.MESSAGES.off_topic : kbAnswer(result.text);
      if (result.unsure) { warn = true; meta = "🛡️ blocked by guardrails"; }
    }

    dots.remove();
    await addMsg(reply, "bot", { warn, meta, type: true });
    react(warn);
    setChips(followUps(result.text));
    if (!warn) {
      history.push({ role: "user", content: result.text }, { role: "assistant", content: reply });
      if (history.length > 8) history.splice(0, history.length - 8);
    }
    busy = false; sendBtn.disabled = false;
    skipTyping = askQueue.length > 1; // several waiting: show the next ones without the slow typing
    if (askQueue.length) setTimeout(flushPending, 60);
    else input.focus({ preventScroll: true });
  }
  function flushPending() {
    if (!askQueue.length || busy) return;
    if (Date.now() - lastSend < COOLDOWN_MS) { setTimeout(flushPending, COOLDOWN_MS - (Date.now() - lastSend) + 20); return; }
    ask(askQueue.shift());
  }
})();
