import http from "node:http";
import { WebSocketServer } from "ws";

const host = process.env.HOST ?? "127.0.0.1";
const port = Number(process.env.PORT ?? 8787);

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
      <p>WebSocket ready. Waiting for IDE connection...</p>
    </main>
  </body>
</html>`;

const server = http.createServer((req, res) => {
  if (!req.url) {
    res.writeHead(400);
    res.end("Bad request");
    return;
  }

  if (req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok" }));
    return;
  }

  if (req.url === "/player") {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(playerHtml);
    return;
  }

  res.writeHead(404, { "Content-Type": "text/plain" });
  res.end("Not found");
});

const wss = new WebSocketServer({ server });

wss.on("connection", (socket) => {
  socket.send(JSON.stringify({ type: "hello", payload: { version: "0.0.0" } }));

  socket.on("message", (data) => {
    socket.send(JSON.stringify({ type: "echo", payload: data.toString() }));
  });
});

server.listen(port, host, () => {
  console.log(`[companion] listening on http://${host}:${port}`);
});
