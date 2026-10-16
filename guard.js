/*
 * Chirpy guardrails: shared by the browser (assistant.js) and the
 * Netlify function (netlify/functions/chat.mjs). The server copy is the
 * one that actually protects the API key; the browser copy just gives
 * instant feedback and saves calls.
 */
(function (g) {
  const MAX_LEN = 300;

  const INJECTION = [
    /ignore\b[^.\n]{0,40}\b(instructions?|rules|prompts?|guidelines|above|previous)/i,
    /(disregard|forget|override|bypass)\b[^.\n]{0,40}\b(instructions?|rules|prompts?|guardrails?|restrictions?)/i,
    /(reveal|show|print|repeat|leak|dump|output|tell me)\b[^.\n]{0,40}\b(system|hidden|initial|original|secret)\s*(prompt|instructions?|message|rules)/i,
    /\bsystem\s*prompt\b/i,
    /\b(jailbreak|DAN mode|developer mode|god mode|sudo mode)\b/i,
    /\byou are (now|no longer)\b/i,
    /\bfrom now on,? (you|act|respond|answer)\b/i,
    /\b(pretend (to be|you are|you're)|role-?play as)\b/i,
    /\bnew (persona|instructions?|rules)\b/i,
    /<\s*\/?\s*(script|iframe|img|svg|object|embed|style)\b/i,
    /\b(api[_ -]?key|hf_[a-z0-9]{8,}|access token|bearer)\b/i,
  ];

  const ABUSE = [
    /\b(fuck\w*|shit\w*|bitch\w*|bastard|asshole|dickhead|cunt|retard\w*|slut|whore)\b/i,
    /\b(kill (yourself|urself)|kys|i will (kill|hurt))\b/i,
  ];

  const SENSITIVE = [
    /\b(aadhaa?r|pan (card|number)|passport|bank|account number|ifsc|credit card|otp|password|pin code)\b/i,
    /\b(home|residential|house|current) address\b/i,
    /\bwhere (does|do) (sam|he|she|they) live\b/i,
    /\b(salary|ctc|stipend|pay ?scale|how much (does|do) (sam|he|she|they) (earn|make))\b/i,
    /\b(religion|caste|girlfriend|boyfriend|married|relationship status|dating|family members?|parents)\b/i,
  ];

  // Commands asking the bot to do work: blocked even if they mention a skill ("write a python function").
  const TASKS = [
    /^(please\s+)?((can|could|would|will) you\s+)?(please\s+)?(write|generate|create|make|build|debug|fix|refactor|solve|code|draft|compose)\b[^.\n]{0,50}\b(code|program|script|function|class|app|website|essay|poem|story|song|lyrics|email|letter|cover letter|article|blog|homework|sql|query)\b/i,
    /^(please\s+)?((can|could|would|will) you\s+)?(help me|teach me|show me how to)\b[^.\n]{0,30}\b(code|program|debug|learn|build|write)\b/i,
  ];

  const OFF_TOPIC = [
    /\b(homework|assignment|exam answers?|recipe|horoscope|astrology|lottery)\b/i,
    /\b(politic\w*|election|president|prime minister|government|war|religion)\b/i,
    /\b(cricket|football|ipl|nba|movie|netflix|celebrity|bitcoin|crypto\w*|forex)\b/i,
    /\b(capital of|population of|distance (from|between)|meaning of life)\b/i,
    /\b(solve|calculate|compute|what is)\b[^a-z]{0,6}\d+(\.\d+)?\s*[-+*/x^%]\s*\d+/i,
  ];

  const GREETING = /^\s*(hi+|hey+|hello+|yo|hola|namaste|vanakkam|good (morning|afternoon|evening)|thanks?( you)?|thank u|ok(ay)?|cool|nice|great|bye|who are you|what (can|do) you do|help)\b/i;

  const RELEVANT = new RegExp(
    "\\b(" + [
      // short words need a trailing \b so "he" doesn't match "help" or "heat"
      "sam\\b", "naveen", "he\\b", "his\\b", "him\\b", "they\\b", "their\\b", "ai\\b", "cv\\b", "rag\\b", "sql\\b", "mcp\\b", "llms?\\b", "gpt",
      "chirpy", "this (site|website|portfolio)",
      "resume", "experience", "project", "skill", "work", "job", "role", "intern", "career", "hire", "hiring", "recruit",
      "available", "open to", "notice", "relocat", "contact", "email", "mail", "phone", "linkedin", "github", "leetcode",
      "education", "college", "degree", "b\\.?tech", "cgpa", "gpa", "karpagam", "certif", "paper", "conference", "publication", "achievement",
      "trinity", "invypro", "better lives", "parking", "city ops", "smart city", "chatbot", "agent", "multi-agent", "genai", "gen ai",
      "langchain", "langgraph", "crewai", "litellm", "langfuse", "langflow", "deepeval", "guardrail", "rbac", "whisper", "ministral",
      "azure", "openai", "fine-?tun", "mongodb", "neo4j", "postgres", "redis", "fastapi", "nestjs", "django", "python", "javascript",
      "docker", "jenkins", "gitlab", "sonarqube", "n8n", "tensorflow", "keras", "scikit", "pandas", "numpy", "vision", "ocr", "mobilenet", "voice",
      "stock", "diabetes", "translator", "assistant", "strength", "team", "leadership", "soft skill", "tech stack", "stack", "tools?",
    ].join("|") + ")",
    "i"
  );

  const MESSAGES = {
    empty: "Type a question about Sam and I'll chirp back 🐦",
    too_long: "That's a long one! Please keep questions under " + MAX_LEN + " characters.",
    injection: "Nice try 😄 I can't change my instructions or reveal how I'm set up. Ask me about Sam's work, projects or skills instead!",
    abuse: "Let's keep it friendly 🙂 I'm happy to help with questions about Sam's work.",
    sensitive: "That's personal information I don't share. For anything like that, please reach Sam directly at samnaveen840@gmail.com.",
    off_topic: "I'm Chirpy, Sam's portfolio assistant 🐦 I only answer questions about Sam's work, projects, skills and how to get in touch. Try: \"What is Sam building at Trinity Mobility?\"",
    rate: "Whoa, that's a lot of questions! Take a breather and try again in a minute, or email Sam at samnaveen840@gmail.com.",
    error: "My wings got tangled 🪶 Please try again in a moment, or email Sam at samnaveen840@gmail.com.",
  };

  // Hosts Chirpy may link to. Anything else is shown as plain text (client) or removed (server).
  const ALLOWED_LINK_HOSTS = ["linkedin.com", "in.linkedin.com", "www.linkedin.com", "github.com", "leetcode.com", "drive.google.com", "samnaveen0075.netlify.app"];

  function normalize(text) {
    return String(text == null ? "" : text).replace(/[\u0000-\u001f\u007f\u200b-\u200f\u2028\u2029\ufeff]/g, " ").replace(/\s+/g, " ").trim();
  }

  function check(raw) {
    const text = normalize(raw);
    if (!text) return { ok: false, code: "empty" };
    if (text.length > MAX_LEN) return { ok: false, code: "too_long" };
    if (INJECTION.some((r) => r.test(text))) return { ok: false, code: "injection" };
    if (ABUSE.some((r) => r.test(text))) return { ok: false, code: "abuse" };
    if (SENSITIVE.some((r) => r.test(text))) return { ok: false, code: "sensitive" };
    if (TASKS.some((r) => r.test(text))) return { ok: false, code: "off_topic" };
    if (GREETING.test(text) || RELEVANT.test(text)) return { ok: true, text };
    if (OFF_TOPIC.some((r) => r.test(text))) return { ok: false, code: "off_topic" };
    // Not clearly relevant: let the model decide (it answers OFF_TOPIC when needed).
    return { ok: true, text, unsure: true };
  }

  function isAllowedUrl(url) {
    try {
      const u = new URL(url);
      if (u.protocol === "mailto:") return u.pathname.toLowerCase() === "samnaveen840@gmail.com";
      if (u.protocol !== "https:") return false;
      return ALLOWED_LINK_HOSTS.some((h) => u.hostname === h || u.hostname.endsWith("." + h));
    } catch (e) { return false; }
  }

  g.ChirpyGuard = { check, normalize, isAllowedUrl, MESSAGES, MAX_LEN };
})(typeof globalThis !== "undefined" ? globalThis : window);
