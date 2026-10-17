"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { createTransport } = require("../../web/sm64web-relay-transport.js");

function FakeSocket(url) {
  this.url = url;
  this.readyState = 0;
  this.sent = [];
  FakeSocket.last = this;
}
FakeSocket.prototype.open = function () { this.readyState = 1; this.onopen(); };
FakeSocket.prototype.message = function (data) { this.onmessage({ data: data }); };
FakeSocket.prototype.send = function (data) { this.sent.push(data); };
FakeSocket.prototype.close = function () { this.readyState = 3; if (this.onclose) this.onclose(); };

test("relay transport queues control and binary events", function () {
  const t = createTransport(FakeSocket);
  t.connect("ws://localhost:8787/");
  const s = FakeSocket.last;
  s.open();
  assert.equal(t.getState(), "connected");
  assert.equal(t.pollEvent().type, "open");
  assert.equal(t.sendControl({ type: "create" }), true);
  assert.deepEqual(JSON.parse(s.sent[0]), { type: "create" });
  s.message(JSON.stringify({ type: "room_created", roomCode: "ABC234" }));
  assert.equal(t.pollEvent().detail.roomCode, "ABC234");
  s.message(new Uint8Array([4, 5]).buffer);
  assert.deepEqual(Array.from(t.pollPacket()), [4, 5]);
  assert.equal(t.pollPacket(), null);
  s.close();
  assert.equal(t.getState(), "disconnected");
});
