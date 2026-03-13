/**
 * HABI-LIN × Gemini AI Chat
 * ─────────────────────────
 * Drop-in floating chatbox for dashboard.html.
 * Specialised in 4-shaft handloom weaving patterns.
 *
 * HOW TO USE:
 * 1. Get your free API key → https://aistudio.google.com/app/apikey
 * 2. Paste it into the GEMINI_API_KEY constant below.
 * 3. Add this line near the bottom of dashboard.html (before </body>):
 *       <script src="gemini-chat.js"></script>
 * 4. Done — the chat bubble appears on every page that includes it.
 */

const GEMINI_API_KEY = "PASTE_YOUR_KEY_HERE"; // ← replace this

// ─── System prompt: weaving specialist ───────────────────────────────────────
const SYSTEM_PROMPT = `You are HABI, a master handloom weaving assistant built into HABI-LIN, 
a Filipino weaving studio app. You specialise exclusively in handloom weaving — 
specifically 4-shaft (4-heddle) looms with 4 pedals.

Your primary job is to help weavers design treadling sequences and understand patterns.
When asked for a pattern, ALWAYS present it as a numbered treadling sequence like:
  Row 1: Pedal(s) 1-2
  Row 2: Pedal(s) 2-3
  ...

Common 4-shaft patterns you know well:
- Plain weave:    1, 2, 1, 2 (alternating shafts 1&2)
- Twill (2/2):    12, 23, 34, 14 (advancing twill)
- Rosepath:       12, 1, 12, 2, 12, 3, 12, 4
- Herringbone:    12, 23, 34, 14, 34, 23 (reverse twill)
- Basket weave:   12, 12, 34, 34
- Monk's belt:    12, 34, 1, 34, 2, 34, 3, 34, 4, 34
- Overshot:       12, 23, 34, 14 with tabby (1 or 2) between each
- Log cabin:      13, 24, 13, 24
- Crackle:        12, 2, 23, 3, 34, 4, 14, 1

Notation: "12" means pedals 1 AND 2 pressed simultaneously. 
"1" means only pedal 1. Always clarify which heddles (shafts) each pedal lifts 
based on standard tie-up unless the user specifies their own.

Be concise but warm. Use weaving terminology naturally. If asked about 
something unrelated to weaving, gently redirect: "I'm specialised in handloom 
weaving — want help with a pattern or technique instead?"

Format patterns in a clean, easy-to-read table or numbered list. 
Always mention how many shafts/pedals the pattern requires.`;

// ─── State ────────────────────────────────────────────────────────────────────
const chatHistory = []; // { role: "user"|"model", parts: [{text}] }
let isOpen = false;
let isTyping = false;

// ─── Inject styles ────────────────────────────────────────────────────────────
function injectStyles() {
  if (document.getElementById("gemini-chat-styles")) return;
  const style = document.createElement("style");
  style.id = "gemini-chat-styles";
  style.textContent = `
    /* ── FAB BUTTON ── */
    #gc-fab {
      position: fixed;
      bottom: 28px;
      right: 28px;
      z-index: 10000;
      width: 56px;
      height: 56px;
      border-radius: 50%;
      background: linear-gradient(135deg, #2b0303 0%, #4a0606 100%);
      border: none;
      cursor: pointer;
      box-shadow: 0 4px 20px rgba(43,3,3,0.45), 0 0 0 0 rgba(43,3,3,0.3);
      display: flex;
      align-items: center;
      justify-content: center;
      transition: transform 0.2s ease, box-shadow 0.2s ease;
      animation: gc-pulse 3s ease-in-out infinite;
    }
    #gc-fab:hover {
      transform: translateY(-3px) scale(1.05);
      box-shadow: 0 8px 28px rgba(43,3,3,0.55);
      animation: none;
    }
    #gc-fab svg { transition: transform 0.3s ease; }
    #gc-fab.open svg { transform: rotate(45deg); }

    @keyframes gc-pulse {
      0%, 100% { box-shadow: 0 4px 20px rgba(43,3,3,0.45), 0 0 0 0 rgba(43,3,3,0.3); }
      50%       { box-shadow: 0 4px 20px rgba(43,3,3,0.45), 0 0 0 8px rgba(43,3,3,0); }
    }

    /* ── CHAT WINDOW ── */
    #gc-window {
      position: fixed;
      bottom: 96px;
      right: 28px;
      z-index: 9999;
      width: 370px;
      max-width: calc(100vw - 40px);
      height: 520px;
      max-height: calc(100vh - 120px);
      background: #0f0f12;
      border-radius: 20px;
      border: 1px solid #2a2a35;
      box-shadow: 0 24px 60px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.04);
      display: flex;
      flex-direction: column;
      overflow: hidden;
      transform: scale(0.92) translateY(16px);
      opacity: 0;
      pointer-events: none;
      transition: transform 0.28s cubic-bezier(0.34,1.56,0.64,1),
                  opacity 0.22s ease;
    }
    #gc-window.open {
      transform: scale(1) translateY(0);
      opacity: 1;
      pointer-events: all;
    }

    /* ── HEADER ── */
    #gc-header {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 16px 18px;
      background: linear-gradient(135deg, #1a0202 0%, #2b0303 100%);
      border-bottom: 1px solid rgba(255,255,255,0.06);
      flex-shrink: 0;
    }
    #gc-avatar {
      width: 36px;
      height: 36px;
      border-radius: 50%;
      background: linear-gradient(135deg, #4a0606, #2b0303);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1.1rem;
      flex-shrink: 0;
      border: 1.5px solid rgba(255,255,255,0.12);
    }
    #gc-header-text { flex: 1; }
    #gc-header-title {
      color: #fff;
      font-weight: 700;
      font-size: 0.9rem;
      font-family: 'Plus Jakarta Sans', sans-serif;
      letter-spacing: -0.2px;
    }
    #gc-header-sub {
      color: rgba(255,255,255,0.45);
      font-size: 0.7rem;
      font-family: 'Plus Jakarta Sans', sans-serif;
      display: flex;
      align-items: center;
      gap: 5px;
      margin-top: 1px;
    }
    .gc-online-dot {
      width: 6px;
      height: 6px;
      background: #4ecb5e;
      border-radius: 50%;
      animation: gc-blink 2s ease-in-out infinite;
    }
    @keyframes gc-blink {
      0%, 100% { opacity: 1; } 50% { opacity: 0.3; }
    }
    #gc-clear-btn {
      background: none;
      border: 1px solid rgba(255,255,255,0.1);
      color: rgba(255,255,255,0.4);
      border-radius: 8px;
      padding: 5px 10px;
      font-size: 0.65rem;
      font-family: 'Plus Jakarta Sans', sans-serif;
      cursor: pointer;
      transition: all 0.2s;
      white-space: nowrap;
    }
    #gc-clear-btn:hover {
      border-color: rgba(255,255,255,0.25);
      color: rgba(255,255,255,0.7);
    }

    /* ── MESSAGES ── */
    #gc-messages {
      flex: 1;
      overflow-y: auto;
      padding: 16px 14px;
      display: flex;
      flex-direction: column;
      gap: 12px;
      scrollbar-width: thin;
      scrollbar-color: #2a2a35 transparent;
    }
    #gc-messages::-webkit-scrollbar { width: 3px; }
    #gc-messages::-webkit-scrollbar-thumb { background: #2a2a35; border-radius: 4px; }

    .gc-msg {
      display: flex;
      flex-direction: column;
      max-width: 88%;
      animation: gc-pop 0.2s ease;
    }
    @keyframes gc-pop {
      from { opacity: 0; transform: translateY(6px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    .gc-msg.user { align-self: flex-end; align-items: flex-end; }
    .gc-msg.model { align-self: flex-start; align-items: flex-start; }

    .gc-bubble {
      padding: 10px 14px;
      border-radius: 16px;
      font-size: 0.82rem;
      line-height: 1.55;
      font-family: 'Plus Jakarta Sans', sans-serif;
      white-space: pre-wrap;
      word-break: break-word;
    }
    .gc-msg.user .gc-bubble {
      background: linear-gradient(135deg, #2b0303, #4a0606);
      color: #fff;
      border-bottom-right-radius: 4px;
    }
    .gc-msg.model .gc-bubble {
      background: #1a1a22;
      color: #e8e8f0;
      border: 1px solid #2a2a35;
      border-bottom-left-radius: 4px;
    }
    /* Code blocks inside model messages */
    .gc-bubble code {
      background: rgba(255,255,255,0.07);
      border-radius: 4px;
      padding: 1px 5px;
      font-size: 0.78rem;
      font-family: 'Courier New', monospace;
      color: #c8f0cb;
    }
    .gc-bubble strong { color: #e8c97a; font-weight: 700; }

    /* ── TYPING INDICATOR ── */
    #gc-typing {
      display: none;
      align-self: flex-start;
      background: #1a1a22;
      border: 1px solid #2a2a35;
      border-radius: 16px;
      border-bottom-left-radius: 4px;
      padding: 10px 16px;
      gap: 5px;
      align-items: center;
    }
    #gc-typing.show { display: flex; }
    .gc-typing-dot {
      width: 6px;
      height: 6px;
      background: #666;
      border-radius: 50%;
      animation: gc-typing-bounce 1.2s ease-in-out infinite;
    }
    .gc-typing-dot:nth-child(2) { animation-delay: 0.2s; }
    .gc-typing-dot:nth-child(3) { animation-delay: 0.4s; }
    @keyframes gc-typing-bounce {
      0%, 60%, 100% { transform: translateY(0); background: #444; }
      30%            { transform: translateY(-5px); background: #888; }
    }

    /* ── QUICK PROMPTS ── */
    #gc-quick-prompts {
      padding: 0 14px 10px;
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      flex-shrink: 0;
    }
    .gc-quick {
      background: rgba(43,3,3,0.25);
      border: 1px solid rgba(43,3,3,0.5);
      color: #e8997a;
      border-radius: 20px;
      padding: 5px 11px;
      font-size: 0.7rem;
      font-family: 'Plus Jakarta Sans', sans-serif;
      cursor: pointer;
      transition: all 0.18s;
      white-space: nowrap;
    }
    .gc-quick:hover {
      background: rgba(43,3,3,0.5);
      border-color: rgba(200,100,80,0.6);
      color: #ffb89a;
    }

    /* ── INPUT ROW ── */
    #gc-input-row {
      display: flex;
      align-items: flex-end;
      gap: 8px;
      padding: 12px 14px;
      border-top: 1px solid rgba(255,255,255,0.06);
      background: #0c0c0f;
      flex-shrink: 0;
    }
    #gc-input {
      flex: 1;
      background: #1a1a22;
      border: 1px solid #2a2a35;
      border-radius: 12px;
      color: #e8e8f0;
      font-size: 0.82rem;
      font-family: 'Plus Jakarta Sans', sans-serif;
      padding: 9px 13px;
      resize: none;
      outline: none;
      max-height: 90px;
      min-height: 36px;
      line-height: 1.4;
      transition: border-color 0.2s;
      overflow-y: auto;
    }
    #gc-input:focus { border-color: rgba(43,3,3,0.7); }
    #gc-input::placeholder { color: #444; }
    #gc-send {
      width: 36px;
      height: 36px;
      background: linear-gradient(135deg, #2b0303, #4a0606);
      border: none;
      border-radius: 10px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      transition: opacity 0.2s, transform 0.1s;
    }
    #gc-send:hover { opacity: 0.85; }
    #gc-send:active { transform: scale(0.93); }
    #gc-send:disabled { opacity: 0.35; cursor: not-allowed; }

    /* ── KEY MISSING BANNER ── */
    #gc-no-key {
      display: none;
      margin: 10px 14px;
      background: rgba(220,60,60,0.1);
      border: 1px solid rgba(220,60,60,0.3);
      border-radius: 10px;
      padding: 10px 13px;
      font-size: 0.75rem;
      color: #e06060;
      font-family: 'Plus Jakarta Sans', sans-serif;
      line-height: 1.5;
      flex-shrink: 0;
    }
    #gc-no-key a { color: #ff8f8f; }

    /* ── MOBILE ── */
    @media (max-width: 480px) {
      #gc-window {
        right: 12px;
        bottom: 84px;
        width: calc(100vw - 24px);
        height: calc(100vh - 120px);
        border-radius: 16px;
      }
      #gc-fab { right: 16px; bottom: 20px; }
    }
  `;
  document.head.appendChild(style);
}

// ─── Build DOM ────────────────────────────────────────────────────────────────
function buildDOM() {
  // FAB
  const fab = document.createElement("button");
  fab.id = "gc-fab";
  fab.title = "Chat with HABI – Weaving AI";
  fab.setAttribute("aria-label", "Open weaving assistant");
  fab.innerHTML = `
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
         stroke="white" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
    </svg>`;

  // Window
  const win = document.createElement("div");
  win.id = "gc-window";
  win.setAttribute("role", "dialog");
  win.setAttribute("aria-label", "HABI weaving assistant");
  win.innerHTML = `
    <div id="gc-header">
      <div id="gc-avatar">🧵</div>
      <div id="gc-header-text">
        <div id="gc-header-title">HABI · Weaving Assistant</div>
        <div id="gc-header-sub">
          <span class="gc-online-dot"></span>
          Powered by Gemini · 4-shaft specialist
        </div>
      </div>
      <button id="gc-clear-btn" title="Clear chat">Clear</button>
    </div>

    <div id="gc-no-key">
      ⚠️ API key missing. Open <code>gemini-chat.js</code> and paste your key into
      <code>GEMINI_API_KEY</code>. Get one free at
      <a href="https://aistudio.google.com/app/apikey" target="_blank">aistudio.google.com</a>.
    </div>

    <div id="gc-messages">
      <!-- Seeded greeting -->
    </div>

    <div id="gc-typing">
      <div class="gc-typing-dot"></div>
      <div class="gc-typing-dot"></div>
      <div class="gc-typing-dot"></div>
    </div>

    <div id="gc-quick-prompts">
      <button class="gc-quick" data-q="Show me a 4-shaft twill treadling sequence">Twill pattern</button>
      <button class="gc-quick" data-q="What pedal combinations make a plain weave?">Plain weave</button>
      <button class="gc-quick" data-q="Give me a rosepath pattern for 4 pedals">Rosepath</button>
      <button class="gc-quick" data-q="What's the difference between twill and basket weave?">Twill vs Basket</button>
      <button class="gc-quick" data-q="Show me a herringbone treadling sequence">Herringbone</button>
    </div>

    <div id="gc-input-row">
      <textarea id="gc-input" placeholder="Ask about patterns, pedals, treadling…" rows="1"></textarea>
      <button id="gc-send" title="Send">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
             stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <line x1="22" y1="2" x2="11" y2="13"/>
          <polygon points="22 2 15 22 11 13 2 9 22 2"/>
        </svg>
      </button>
    </div>`;

  document.body.appendChild(fab);
  document.body.appendChild(win);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function scrollToBottom() {
  const msgs = document.getElementById("gc-messages");
  if (msgs) msgs.scrollTop = msgs.scrollHeight;
}

function renderText(raw) {
  // Very lightweight markdown → HTML
  return raw
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/^#{1,3}\s(.+)$/gm, "<strong>$1</strong>")
    .trim();
}

function addMessage(role, text) {
  const msgs = document.getElementById("gc-messages");
  const wrap = document.createElement("div");
  wrap.className = `gc-msg ${role}`;
  const bubble = document.createElement("div");
  bubble.className = "gc-bubble";
  bubble.innerHTML = renderText(text);
  wrap.appendChild(bubble);
  msgs.appendChild(wrap);
  scrollToBottom();
  return bubble;
}

function setTyping(show) {
  isTyping = show;
  const el = document.getElementById("gc-typing");
  if (el) el.classList.toggle("show", show);
  const send = document.getElementById("gc-send");
  if (send) send.disabled = show;
  scrollToBottom();
}

// ─── API call ─────────────────────────────────────────────────────────────────
async function sendToGemini(userText) {
  if (!userText.trim() || isTyping) return;

  // Check key
  if (!GEMINI_API_KEY || GEMINI_API_KEY === "PASTE_YOUR_KEY_HERE") {
    document.getElementById("gc-no-key").style.display = "block";
    return;
  }

  addMessage("user", userText);
  chatHistory.push({ role: "user", parts: [{ text: userText }] });

  // Clear quick prompts after first real message
  const qp = document.getElementById("gc-quick-prompts");
  if (qp && chatHistory.length === 1) qp.style.display = "none";

  setTyping(true);

  try {
    const endpoint =
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;

    const body = {
      system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents: chatHistory,
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 800,
        topP: 0.9
      }
    };

    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });

    const data = await res.json();

    if (!res.ok) {
      const errMsg = data?.error?.message || "API error. Check your key or quota.";
      throw new Error(errMsg);
    }

    const reply = data?.candidates?.[0]?.content?.parts?.[0]?.text
      || "Sorry, I didn't get a response. Please try again.";

    chatHistory.push({ role: "model", parts: [{ text: reply }] });
    setTyping(false);
    addMessage("model", reply);

  } catch (err) {
    setTyping(false);
    addMessage("model", `⚠️ ${err.message}`);
    console.error("Gemini error:", err);
  }
}

// ─── Wire up UI ───────────────────────────────────────────────────────────────
function wireEvents() {
  const fab = document.getElementById("gc-fab");
  const win = document.getElementById("gc-window");
  const input = document.getElementById("gc-input");
  const send = document.getElementById("gc-send");
  const clearBtn = document.getElementById("gc-clear-btn");

  // Toggle open/close
  fab.addEventListener("click", () => {
    isOpen = !isOpen;
    fab.classList.toggle("open", isOpen);
    win.classList.toggle("open", isOpen);
    if (isOpen) setTimeout(() => input.focus(), 300);
  });

  // Send on button click
  send.addEventListener("click", () => {
    const val = input.value.trim();
    if (!val) return;
    input.value = "";
    input.style.height = "36px";
    sendToGemini(val);
  });

  // Send on Enter (Shift+Enter = newline)
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send.click();
    }
  });

  // Auto-resize textarea
  input.addEventListener("input", () => {
    input.style.height = "36px";
    input.style.height = Math.min(input.scrollHeight, 90) + "px";
  });

  // Quick prompts
  document.querySelectorAll(".gc-quick").forEach(btn => {
    btn.addEventListener("click", () => {
      sendToGemini(btn.dataset.q);
    });
  });

  // Clear chat
  clearBtn.addEventListener("click", () => {
    chatHistory.length = 0;
    const msgs = document.getElementById("gc-messages");
    msgs.innerHTML = "";
    const qp = document.getElementById("gc-quick-prompts");
    if (qp) qp.style.display = "flex";
    seedGreeting();
  });

  // Close on outside click
  document.addEventListener("click", (e) => {
    if (isOpen && !win.contains(e.target) && !fab.contains(e.target)) {
      isOpen = false;
      fab.classList.remove("open");
      win.classList.remove("open");
    }
  });

  // Show no-key banner immediately if key not set
  if (!GEMINI_API_KEY || GEMINI_API_KEY === "PASTE_YOUR_KEY_HERE") {
    document.getElementById("gc-no-key").style.display = "block";
  }
}

// ─── Seed greeting ────────────────────────────────────────────────────────────
function seedGreeting() {
  addMessage("model",
    "👋 Hi! I'm **HABI**, your 4-shaft weaving assistant.\n\n" +
    "Ask me anything about treadling sequences, pedal combinations, or pattern drafts — " +
    "like _\"show me a twill pattern\"_ or _\"what pedals make a basket weave?\"_"
  );
}

// ─── Init ─────────────────────────────────────────────────────────────────────
function init() {
  injectStyles();
  buildDOM();
  wireEvents();
  seedGreeting();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}