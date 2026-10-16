"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const WebSocket = require("ws");
const { createRelay } = require("./server");

function connect(url) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    ws.once("open", () => resolve(ws));
    ws.once("error", reject);
  });
}

function nextMessage(ws, predicate = () => true, timeoutMs = 1500) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error("timed out waiting for WebSocket message"));
    }, timeoutMs);
    const onMessage = (data, isBinary) => {
      let value = data;
      if (!isBinary) {
        try { value = JSON.parse(data.toString("utf8")); } catch {}
      }
      if (!predicate(value, isBinary)) return;
      cleanup();
      resolve({ value, isBinary });
    };
    function cleanup() {
      clearTimeout(timeout);
      ws.off("message", onMessage);
    }
    ws.on("message", onMessage);
  });
}

function sendControl(ws, value) {
  ws.send(JSON.stringify(value));
}

test("private room routes client packets to host with peer identity and host packets to clients", async (t) => {
  const relay = createRelay({ port: 0, maxPlayers: 4 });
  const address = await relay.listen();
  const url = "ws://127.0.0.1:" + address.port;
  const sockets = [];
  t.after(async () => {
    for (const ws of sockets) if (ws.readyState === WebSocket.OPEN) ws.close();
    await relay.close();
  });

  const host = await connect(url); sockets.push(host);
  const created = nextMessage(host, (v) => v && v.type === "room_created");
  sendControl(host, { type: "create" });
  const { value: room } = await created;

  const peerJoined = nextMessage(host, (v) => v && v.type === "peer_joined");
  const client = await connect(url); sockets.push(client);
  const joined = nextMessage(client, (v) => v && v.type === "room_joined");
  sendControl(client, { type: "join", roomCode: room.roomCode.toLowerCase() });
  const { value: clientRoom } = await joined;
  const { value: peerEvent } = await peerJoined;
  assert.equal(clientRoom.peerId, peerEvent.peerId);

  const packetToHost = Buffer.from([0x12, 0x00, 0xff, 0x34]);
  const receivedAtHost = nextMessage(host, (_v, binary) => binary);
  client.send(packetToHost);
  const hostMessage = await receivedAtHost;
  assert.equal(hostMessage.isBinary, true);
  const envelope = Buffer.from(hostMessage.value);
  assert.equal(envelope.readUInt32LE(0), clientRoom.peerId);
  assert.deepEqual(envelope.subarray(4), packetToHost);

  const packetToClient = Buffer.from([0x22, 0x01, 0x03]);
  const receivedAtClient = nextMessage(client, (_v, binary) => binary);
  host.send(packetToClient);
  const clientMessage = await receivedAtClient;
  assert.equal(clientMessage.isBinary, true);
  assert.deepEqual(Buffer.from(clientMessage.value), packetToClient);
});

test("rooms are isolated and invalid room codes are rejected", async (t) => {
  const relay = createRelay({ port: 0, maxPlayers: 4 });
  const address = await relay.listen();
  const url = "ws://127.0.0.1:" + address.port;
  const sockets = [];
  t.after(async () => {
    for (const ws of sockets) if (ws.readyState === WebSocket.OPEN) ws.close();
    await relay.close();
  });

  const hostA = await connect(url); sockets.push(hostA);
  const createdA = nextMessage(hostA, (v) => v && v.type === "room_created");
  sendControl(hostA, { type: "create" });
  const { value: roomA } = await createdA;

  const hostB = await connect(url); sockets.push(hostB);
  const createdB = nextMessage(hostB, (v) => v && v.type === "room_created");
  sendControl(hostB, { type: "create" });
  const { value: roomB } = await createdB;
  assert.notEqual(roomA.roomCode, roomB.roomCode);

  const invalidClient = await connect(url); sockets.push(invalidClient);
  const invalid = nextMessage(invalidClient, (v) => v && v.type === "error");
  sendControl(invalidClient, { type: "join", roomCode: "NOPE00" });
  assert.equal((await invalid).value.code, "room_not_found");

  const clientB = await connect(url); sockets.push(clientB);
  const joinedB = nextMessage(clientB, (v) => v && v.type === "room_joined");
  sendControl(clientB, { type: "join", roomCode: roomB.roomCode });
  await joinedB;

  const unexpected = nextMessage(hostA, (_v, binary) => binary, 250).then(
    () => false,
    () => true
  );
  clientB.send(Buffer.from([0x42, 0x43]));
  assert.equal(await unexpected, true);
});

test("room capacity rejects extra clients", async (t) => {
  const relay = createRelay({ port: 0, maxPlayers: 2 });
  const address = await relay.listen();
  const url = "ws://127.0.0.1:" + address.port;
  const sockets = [];
  t.after(async () => {
    for (const ws of sockets) if (ws.readyState === WebSocket.OPEN) ws.close();
    await relay.close();
  });

  const host = await connect(url); sockets.push(host);
  const created = nextMessage(host, (v) => v && v.type === "room_created");
  sendControl(host, { type: "create" });
  const { value: room } = await created;

  const first = await connect(url); sockets.push(first);
  const firstJoined = nextMessage(first, (v) => v && v.type === "room_joined");
  sendControl(first, { type: "join", roomCode: room.roomCode });
  await firstJoined;

  const extra = await connect(url); sockets.push(extra);
  const rejected = nextMessage(extra, (v) => v && v.type === "error");
  sendControl(extra, { type: "join", roomCode: room.roomCode });
  assert.equal((await rejected).value.code, "room_full");
});
