"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { createTransport } = require("../../web/sm64web-relay-transport.js");

class MockWebSocket {
  static instances = [];
  constructor(url) {
    this.url = url;
    this.readyState = 0;
    this.sent = [];
    this.binaryType = "";
    MockWebSocket.instances.push(this);
  }
  open() {
    this.readyState = 1;
    this.onopen?.();
  }
  message(data) {
    this.onmessage?.({ data });
  }
  send(data) {
    assert.equal(this.readyState, 1);
    this.sent.push(data);
  }
  close() {
    this.readyState = 3;
    this.onclose?.();
  }
  error() {
    this.onerror?.();
  }
}

test.beforeEach(() => { MockWebSocket.instances = []; });

test("connects and tracks room-created control state", () => {
  const transport = createTransport(MockWebSocket);
  transport.connect("ws://localhost:8787/");
  const socket = MockWebSocket.instances[0];
  assert.equal(socket.binaryType, "arraybuffer");
  assert.equal(transport.getState(), "connecting");
  socket.open();
  assert.equal(transport.getState(), "connected");
  socket.message(JSON.stringify({ type: "room_created", roomCode: "ABC234" }));
  assert.equal(transport.getRoomCode(), "ABC234");
  assert.equal(transport.getRole(), "host");
  assert.equal(transport.isRoomReady(), true);
  assert.deepEqual(transport.pollEvent(), { type: "open", detail: null });
  assert.deepEqual(transport.pollEvent(), {
    type: "control",
    detail: { type: "room_created", roomCode: "ABC234" }
  });
});

test("tracks a joined client room and clears it after leaving", () => {
  const transport = createTransport(MockWebSocket);
  transport.connect("ws://localhost:8787/");
  const socket = MockWebSocket.instances[0];
  socket.open();
  socket.message(JSON.stringify({ type: "room_joined", roomCode: "QWERTY" }));
  assert.equal(transport.getRoomCode(), "QWERTY");
  assert.equal(transport.getRole(), "client");
  socket.message(JSON.stringify({ type: "left_room" }));
  assert.equal(transport.getRoomCode(), "");
  assert.equal(transport.getRole(), "");
  assert.equal(transport.isRoomReady(), false);
});

test("preserves binary packet bytes and FIFO ordering", () => {
  const transport = createTransport(MockWebSocket);
  transport.connect("ws://localhost:8787/");
  const socket = MockWebSocket.instances[0];
  socket.open();
  const first = Uint8Array.from([0, 1, 0, 255]).buffer;
  const secondBacking = Uint8Array.from([9, 8, 7, 6, 5]);
  socket.message(first);
  socket.message(secondBacking.subarray(1, 4));
  assert.deepEqual(Array.from(transport.pollPacket()), [0, 1, 0, 255]);
  assert.deepEqual(Array.from(transport.pollPacket()), [8, 7, 6]);
  assert.equal(transport.pollPacket(), null);
});

test("sends JSON controls and copies binary packets before sending", () => {
  const transport = createTransport(MockWebSocket);
  transport.connect("ws://localhost:8787/");
  const socket = MockWebSocket.instances[0];
  assert.equal(transport.sendControl({ type: "create" }), false);
  socket.open();
  assert.equal(transport.sendControl({ type: "join", roomCode: "ABC234" }), true);
  assert.deepEqual(JSON.parse(socket.sent[0]), { type: "join", roomCode: "ABC234" });
  const payload = Uint8Array.from([4, 0, 5]);
  assert.equal(transport.sendPacket(payload), true);
  payload[0] = 99;
  assert.deepEqual(Array.from(new Uint8Array(socket.sent[1])), [4, 0, 5]);
  assert.throws(() => transport.sendPacket([1, 2]), TypeError);
});

test("reports malformed controls and unsupported binary message types", () => {
  const transport = createTransport(MockWebSocket);
  transport.connect("ws://localhost:8787/");
  const socket = MockWebSocket.instances[0];
  socket.open();
  socket.message("{not json");
  assert.equal(transport.getLastError(), "invalid_control_message");
  assert.deepEqual(transport.pollEvent(), { type: "open", detail: null });
  assert.deepEqual(transport.pollEvent(), { type: "error", detail: { code: "invalid_control_message" } });
  socket.message({ not: "binary" });
  assert.equal(transport.getLastError(), "unsupported_binary_message");
});

test("closing emits exactly one close event and clears queued packets", () => {
  const transport = createTransport(MockWebSocket);
  transport.connect("ws://localhost:8787/");
  const socket = MockWebSocket.instances[0];
  socket.open();
  socket.message(Uint8Array.from([1, 2, 3]).buffer);
  transport.close();
  assert.equal(transport.getState(), "disconnected");
  assert.equal(transport.getRoomCode(), "");
  assert.equal(transport.pollPacket(), null);
  const closeEvents = [];
  let event;
  while ((event = transport.pollEvent()) !== null) {
    if (event.type === "close") closeEvents.push(event);
  }
  assert.equal(closeEvents.length, 1);
});
