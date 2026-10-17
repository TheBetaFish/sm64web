"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const WebSocket = require("ws");
const { createRelay } = require("./server");
const { createTransport } = require("../../web/sm64web-relay-transport.js");

function waitForMessage(socket, predicate, timeoutMs = 2000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off("message", onMessage);
      reject(new Error("timed out waiting for WebSocket message"));
    }, timeoutMs);
    function onMessage(data, isBinary) {
      let value;
      if (isBinary) value = Buffer.from(data);
      else {
        try { value = JSON.parse(data.toString()); }
        catch { return; }
      }
      if (!predicate(value)) return;
      clearTimeout(timer);
      socket.off("message", onMessage);
      resolve(value);
    }
    socket.on("message", onMessage);
  });
}

test("real relay routes host/client binary packets with peer envelope intact", async (t) => {
  const relay = createRelay({ port: 0, host: "127.0.0.1" });
  const address = await relay.listen();
  t.after(async () => {
    for (const ws of [host, client]) {
      if (ws && ws.readyState === WebSocket.OPEN) ws.close();
    }
    await relay.close();
  });
  const url = "ws://127.0.0.1:" + address.port + "/";
  const host = new WebSocket(url);
  const client = new WebSocket(url);
  await Promise.all([
    new Promise((resolve, reject) => { host.once("open", resolve); host.once("error", reject); }),
    new Promise((resolve, reject) => { client.once("open", resolve); client.once("error", reject); })
  ]);
  const created = waitForMessage(host, m => m.type === "room_created");
  host.send(JSON.stringify({ type: "create" }));
  const room = await created;
  const joined = waitForMessage(client, m => m.type === "room_joined");
  const peerJoined = waitForMessage(host, m => m.type === "peer_joined");
  client.send(JSON.stringify({ type: "join", roomCode: room.roomCode }));
  const clientRoom = await joined;
  const peer = await peerJoined;
  assert.equal(clientRoom.peerId, peer.peerId);

  const fromClient = Buffer.from([0, 17, 0, 255, 42]);
  const hostPacket = waitForMessage(host, m => Buffer.isBuffer(m));
  client.send(fromClient);
  const envelope = await hostPacket;
  assert.equal(envelope.readUInt32LE(0), peer.peerId);
  assert.deepEqual(envelope.subarray(4), fromClient);

  const fromHost = Buffer.from([8, 0, 9, 0, 10]);
  const clientPacket = waitForMessage(client, m => Buffer.isBuffer(m));
  host.send(fromHost);
  assert.deepEqual(await clientPacket, fromHost);
});

test("transport rejects malformed room controls and oversized outbound packets", () => {
  class FakeSocket {
    constructor() { this.readyState = 0; FakeSocket.last = this; }
    open() { this.readyState = 1; this.onopen(); }
    message(data) { this.onmessage({ data }); }
    send() {}
    close() { this.readyState = 3; this.onclose(); }
  }
  const transport = createTransport(FakeSocket);
  transport.connect("ws://example.invalid/");
  FakeSocket.last.open();
  FakeSocket.last.message(JSON.stringify({ type: "room_joined", roomCode: "" }));
  assert.equal(transport.getLastError(), "invalid_room_control");
  assert.equal(transport.isRoomReady(), false);
  assert.throws(() => transport.sendPacket(new Uint8Array(3001)), RangeError);
  assert.throws(() => transport.sendControl([]), TypeError);
});

test("transport bounds incoming packet queues and clears them on close", () => {
  class FakeSocket {
    constructor() { this.readyState = 0; FakeSocket.last = this; }
    open() { this.readyState = 1; this.onopen(); }
    message(data) { this.onmessage({ data }); }
    send() {}
    close() { this.readyState = 3; this.onclose(); }
  }
  const transport = createTransport(FakeSocket);
  transport.connect("ws://example.invalid/");
  const socket = FakeSocket.last;
  socket.open();
  for (let i = 0; i < 128; i++) socket.message(Uint8Array.from([i + 1]).buffer);
  assert.equal(transport.getQueuedPacketCount(), 128);
  socket.message(Uint8Array.from([255]).buffer);
  assert.equal(transport.getLastError(), "packet_queue_overflow");
  transport.close();
  assert.equal(transport.getQueuedPacketCount(), 0);
  assert.equal(transport.getState(), "disconnected");
});
