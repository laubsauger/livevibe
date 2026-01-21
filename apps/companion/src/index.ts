import http from "node:http";
import path from "node:path";
import dotenv from "dotenv";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load env from root
dotenv.config({ path: path.resolve(__dirname, "../../../.env.development") });
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

import { WebSocketServer, WebSocket } from "ws";
import { TransportState, LinkToClientMessage, ClientToLinkMessage } from "@livevibe/protocol";

import { MockLLMProvider, GeminiProvider } from "@livevibe/llm";

const host = process.env.HOST ?? "127.0.0.1";
const port = Number(process.env.PORT ?? 8787);

// Initialize Gemini
const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.warn("GEMINI_API_KEY not found in environment, falling back to Mock LLM");
}
const llmProvider = apiKey
  ? new GeminiProvider(apiKey, 'gemini-3-flash-preview')
  : new MockLLMProvider();

// --- Transport State ---
let state: TransportState = {
  playing: false,
  step: 0,
  tempo: 120,
  time: 0,
};

let clients: Set<WebSocket> = new Set();

// --- Runtime Loop ---
const TICK_INTERVAL = 50; // ms
setInterval(() => {
  if (state.playing) {
    const secondsPerTick = TICK_INTERVAL / 1000;
    state.time += secondsPerTick;
    // Simple step calculation for testing (ticks per beat etc would go here)
    const beatsPerSecond = state.tempo / 60;
    const stepsPerSecond = beatsPerSecond * 4; // 16th notes
    state.step = Math.floor(state.time * stepsPerSecond);
  }

  broadcast({ type: "transport:state", payload: state });
}, TICK_INTERVAL);

function broadcast(msg: LinkToClientMessage) {
  const data = JSON.stringify(msg);
  for (const client of clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(data);
    }
  }
}

// --- Server Setup ---
const playerHtml = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Livevibe Player</title>
    <style>
      body { margin: 0; font-family: "Helvetica Neue", Helvetica, Arial, sans-serif; background: #111; color: #f5f5f5; }
      main { padding: 24px; }
      .badge { display: inline-block; padding: 4px 10px; border-radius: 999px; background: #2f2f2f; font-size: 12px; letter-spacing: 0.02em; }
    </style>
  </head>
  <body>
    <main>
      <div class="badge">Companion player</div>
      <h1>Livevibe Player</h1>
      <pre id="status">Waiting for connection...</pre>
      <script>
        const ws = new WebSocket("ws://" + location.host);
        ws.onmessage = (e) => {
          const msg = JSON.parse(e.data);
          if (msg.type === "transport:state") {
            document.getElementById("status").innerText = JSON.stringify(msg.payload, null, 2);
          }
        };
      </script>
    </main>
  </body>
</html>`;

const server = http.createServer((req, res) => {
  if (req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok" }));
    return;
  }
  if (req.url === "/" || req.url === "/player") {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(playerHtml);
    return;
  }
  res.writeHead(404).end("Not found");
});

const wss = new WebSocketServer({ server });

wss.on("connection", (socket) => {
  clients.add(socket);
  // Send immediate state
  socket.send(JSON.stringify({ type: "transport:state", payload: state }));

  socket.on("message", (data) => {
    try {
      const msg = JSON.parse(data.toString()) as ClientToLinkMessage;
      handleMessage(msg);
    } catch (e) {
      console.error("Failed to parse message", e);
    }
  });

  socket.on("close", () => {
    clients.delete(socket);
  });
});

function handleMessage(msg: ClientToLinkMessage) {
  switch (msg.type) {
    case "transport:play":
      state.playing = true;
      console.log("[Transport] Playing");
      break;
    case "transport:stop":
      state.playing = false;
      state.step = 0;
      state.time = 0;
      console.log("[Transport] Stopped");
      break;
    case "transport:tempo":
      state.tempo = msg.payload;
      console.log("[Transport] Tempo:", state.tempo);
      break;
    case "assistant:query":
      console.log("[Assistant] Query:", msg.text, "Context:", msg.context);

      const messages = [{ role: 'user', content: msg.text } as const];
      let fullResponse = '';

      llmProvider.chat(messages, (delta: string) => {
        fullResponse += delta;
        broadcast({ type: 'assistant:response', text: delta, done: false });
      }, { ...msg.context, model: msg.model }).then(async (result) => {
        // Self-correction: validate code blocks and retry if errors
        const codeBlockRegex = /```(?:javascript|js)?\s*\n([\s\S]*?)```/g;
        const codeBlocks: string[] = [];
        let match;
        while ((match = codeBlockRegex.exec(fullResponse)) !== null) {
          codeBlocks.push(match[1]);
        }

        if (codeBlocks.length > 0) {
          // Simple validation (expanded version could use PatternValidator)
          const errors: string[] = [];
          for (const code of codeBlocks) {
            // Check for hallucinated functions
            const invalidFns = ['.stutter(', '.supersaw(', '.wobble(', '.spread('];
            for (const fn of invalidFns) {
              if (code.includes(fn)) {
                errors.push(`Invalid function "${fn.replace('(', '')}" does not exist in Strudel`);
              }
            }
            // Check for Haskell syntax
            if (/\bd[1-9]\s*\$/.test(code)) {
              errors.push('Invalid Haskell syntax "d1 $" - use note() or s() directly');
            }
            // Check balanced parens
            const opens = (code.match(/\(/g) || []).length;
            const closes = (code.match(/\)/g) || []).length;
            if (opens !== closes) {
              errors.push('Unbalanced parentheses');
            }
          }

          // If errors found, do one self-correction attempt
          if (errors.length > 0) {
            console.log('[Assistant] Self-correction triggered:', errors);
            broadcast({ type: 'assistant:response', text: '\n\n---\n*Detected issues, refining...*\n\n', done: false });

            const correctionMessages = [
              { role: 'user' as const, content: msg.text },
              { role: 'assistant' as const, content: fullResponse },
              { role: 'user' as const, content: `The code you provided has the following issues:\n${errors.join('\n')}\n\nPlease provide a corrected version using only valid Strudel JavaScript syntax.` }
            ];

            await llmProvider.chat(correctionMessages, (delta: string) => {
              broadcast({ type: 'assistant:response', text: delta, done: false });
            }, { ...msg.context, model: msg.model });
          }
        }

        broadcast({
          type: 'assistant:response',
          text: '',
          done: true,
          metadata: {
            provider: 'Google',
            model: msg.model || 'gemini-3-flash-preview',
            usage: result?.usage || {
              inputTokens: 0,
              outputTokens: 0,
              totalTokens: 0,
              costEstimate: 0
            }
          }
        });
      });
      break;
  }
}

server.listen(port, host, () => {
  console.log(`[companion] listening on http://${host}:${port}`);
});
