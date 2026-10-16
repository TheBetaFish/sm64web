"use strict";

const crypto = require("node:crypto");
const http = require("node:http");
const { WebSocketServer, WebSocket } = require("ws");

const PORT = Number.parseInt(process.env.PORT || "8787", 10);
const MAX_PLAYERS = Math.max(2, Math.min(16, Number.parseInt(process.env.MAX_PLAYERS || "8", 10)));
const MAX_MESSAGE_BYTES = 3000;
const RELAY_PEER_HEADER_BYTES = 4;
const ROOM_CODE_LENGTH = 6;
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function makeRoomCode() {
  const bytes = crypto.randomBytes(ROOM_CODE_LENGTH);
  return Array.from(bytes, (byte) => CODE_ALPHABET[byte % CODE_ALPHABET.length]).join("");
}

function createRelay({ port = PORT, host = "127.0.0.1", maxPlayers = MAX_PLAYERS } = {}) {
  const rooms = new Map();
  let nextPeerId = 1;
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

  // Explicitly upgrade WebSocket requests on the relay root path. With
  // noServer:true, ws does not install this handler automatically.
  server.on("upgrade", (req, socket, head) => {
    if (req.url !== "/") {
      socket.write("HTTP/1.1 404 Not Found\\r\\nConnection: close\\r\\n\\r\\n");
      socket.destroy();
      return;
    }
    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit("connection", ws, req);
    });
  });

  function sendControl(ws, message) {
    if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(message));
  }

  function removePeer(ws) {
    const room = ws.room;
    if (!room) return;
    ws.room = null;
    if (room.host === ws) {
      for (const peer of room.clients.values()) {
        peer.room = null;
        sendControl(peer, { type: "room_closed", reason: "host_disconnected" });
        if (peer.readyState === WebSocket.OPEN) peer.close(1000, "host disconnected");
      }
      room.clients.clear();
      rooms.delete(room.code);
      return;
    }
    room.clients.delete(ws.peerId);
    sendControl(room.host, { type: "peer_left", peerId: ws.peerId, count: room.clients.size + 1 });
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
      const room = { code, host: ws, clients: new Map(), maxPlayers };
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
      ws.peerId = nextPeerId++;
      if (nextPeerId > 0xffffffff) nextPeerId = 1;
      room.clients.set(ws.peerId, ws);
      ws.room = room;
      sendControl(ws, { type: "room_joined", roomCode: code, role: "client", peerId: ws.peerId, maxPlayers: room.maxPlayers });
      sendControl(room.host, { type: "peer_joined", peerId: ws.peerId, count: room.clients.size + 1 });
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
    ws.peerId = 0;
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
        try { message = JSON.parse(data.toString("utf8")); }
        catch {
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
      if (ws === room.host) {
        for (const peer of room.clients.values()) {
          if (peer.readyState === WebSocket.OPEN) peer.send(data, { binary: true });
        }
      } else {
        // Host-side transport strips this four-byte little-endian relay peer ID
        // before passing the remaining bytes to CoopDX packet decompression.
        const envelope = Buffer.allocUnsafe(RELAY_PEER_HEADER_BYTES + data.length);
        envelope.writeUInt32LE(ws.peerId, 0);
        data.copy(envelope, RELAY_PEER_HEADER_BYTES);
        if (room.host.readyState === WebSocket.OPEN) room.host.send(envelope, { binary: true });
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

module.exports = { createRelay, makeRoomCode, MAX_MESSAGE_BYTES, RELAY_PEER_HEADER_BYTES };
