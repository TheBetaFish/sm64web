"use strict";

const crypto = require("node:crypto");
const http = require("node:http");
const { WebSocketServer, WebSocket } = require("ws");

const PORT = Number.parseInt(process.env.PORT || "8787", 10);
const MAX_PLAYERS = Math.max(2, Math.min(16, Number.parseInt(process.env.MAX_PLAYERS || "8", 10)));
const MAX_MESSAGE_BYTES = 3000;
const ROOM_CODE_LENGTH = 6;
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function makeRoomCode() {
  const bytes = crypto.randomBytes(ROOM_CODE_LENGTH);
  return Array.from(bytes, (byte) => CODE_ALPHABET[byte % CODE_ALPHABET.length]).join("");
}

function createRelay({ port = PORT, host = "127.0.0.1", maxPlayers = MAX_PLAYERS } = {}) {
  const rooms = new Map();
  const server = http.createServer((req, res) => {
    if (req.url === "/health") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ ok: true, rooms: rooms.size }));
      return;
    }
    res.writeHead(404, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: "not_found" }));
  });
  const wss = new WebSocketServer({ noServer: true, maxPayload: MAX_MESSAGE_BYTES });

  function sendControl(ws, message) {
    if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(message));
  }

  function removePeer(ws) {
    const room = ws.room;
    if (!room) return;
    ws.room = null;
    if (room.host === ws) {
      for (const peer of room.clients) {
        peer.room = null;
        sendControl(peer, { type: "room_closed", reason: "host_disconnected" });
        if (peer.readyState === WebSocket.OPEN) peer.close(1000, "host disconnected");
      }
      room.clients.clear();
      rooms.delete(room.code);
      return;
    }
    room.clients.delete(ws);
    sendControl(room.host, { type: "peer_left", count: room.clients.size + 1 });
  }

  function allocateCode() {
    for (let attempt = 0; attempt < 100; attempt++) {
      const code = makeRoomCode();
      if (!rooms.has(code)) return code;
    }
    throw new Error("could not allocate unique room code");
  }

  function handleControl(ws, message) {
    if (!message || typeof message !== "object" || Array.isArray(message)) {
      sendControl(ws, { type: "error", code: "invalid_control" });
      return;
    }

    if (message.type === "create") {
      if (ws.room) {
        sendControl(ws, { type: "error", code: "already_in_room" });
        return;
      }
      const code = allocateCode();
      const room = { code, host: ws, clients: new Set(), maxPlayers };
      rooms.set(code, room);
      ws.room = room;
      sendControl(ws, { type: "room_created", roomCode: code, maxPlayers: room.maxPlayers });
      return;
    }

    if (message.type === "join") {
      if (ws.room) {
        sendControl(ws, { type: "error", code: "already_in_room" });
        return;
      }
      const code = typeof message.roomCode === "string" ? message.roomCode.trim().toUpperCase() : "";
      const room = rooms.get(code);
      if (!room) {
        sendControl(ws, { type: "error", code: "room_not_found" });
        return;
      }
      if (room.clients.size + 1 >= room.maxPlayers) {
        sendControl(ws, { type: "error", code: "room_full" });
        return;
      }
      room.clients.add(ws);
      ws.room = room;
      sendControl(ws, { type: "room_joined", roomCode: code, role: "client", maxPlayers: room.maxPlayers });
      sendControl(room.host, { type: "peer_joined", count: room.clients.size + 1 });
      return;
    }

    if (message.type === "leave") {
      removePeer(ws);
      sendControl(ws, { type: "left_room" });
      return;
    }

    sendControl(ws, { type: "error", code: "unknown_control" });
  }

  wss.on("connection", (ws) => {
    ws.room = null;
    ws.isAlive = true;
    ws.on("pong", () => { ws.isAlive = true; });
    ws.on("message", (data, isBinary) => {
      if (!isBinary) {
        if (data.length > 1024) {
          sendControl(ws, { type: "error", code: "control_too_large" });
          ws.close(1009, "control message too large");
          return;
        }
        let message;
        try {
          message = JSON.parse(data.toString("utf8"));
        } catch {
          sendControl(ws, { type: "error", code: "invalid_json" });
          return;
        }
        handleControl(ws, message);
        return;
      }

      if (data.length === 0 || data.length > MAX_MESSAGE_BYTES) {
        sendControl(ws, { type: "error", code: "invalid_packet_size" });
        return;
      }
      const room = ws.room;
      if (!room) {
        sendControl(ws, { type: "error", code: "not_in_room" });
        return;
      }

      // This relay is intentionally role-aware but game-protocol-agnostic:
      // clients send packets to the host; the host sends packets to all clients.
      const recipients = ws === room.host ? room.clients : [room.host];
      for (const peer of recipients) {
        if (peer.readyState === WebSocket.OPEN) peer.send(data, { binary: true });
      }
    });
    ws.on("close", () => removePeer(ws));
    ws.on("error", () => removePeer(ws));
  });

  const heartbeat = setInterval(() => {
    for (const ws of wss.clients) {
      if (ws.isAlive === false) {
        ws.terminate();
        continue;
      }
      ws.isAlive = false;
      ws.ping();
    }
  }, 30000);
  heartbeat.unref();

  return {
    rooms,
    server,
    wss,
    async listen() {
      await new Promise((resolve, reject) => {
        server.once("error", reject);
        server.listen(port, host, resolve);
      });
      return server.address();
    },
    async close() {
      clearInterval(heartbeat);
      for (const ws of wss.clients) ws.terminate();
      await new Promise((resolve) => wss.close(() => resolve()));
      if (server.listening) await new Promise((resolve) => server.close(() => resolve()));
    },
  };
}

if (require.main === module) {
  const relay = createRelay();
  relay.listen().then((address) => {
    console.log("sm64web relay listening on ws://" + address.address + ":" + address.port);
    console.log("health check: http://" + address.address + ":" + address.port + "/health");
    console.log("development only: bind to 127.0.0.1 by default");
  }).catch((error) => {
    console.error("relay startup failed:", error);
    process.exitCode = 1;
  });
}

module.exports = { createRelay, makeRoomCode, MAX_MESSAGE_BYTES };
