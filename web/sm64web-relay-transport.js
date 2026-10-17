(function (root) {
  "use strict";

  function createTransport(WebSocketImpl) {
    var WS = WebSocketImpl || (root && root.WebSocket);
    var socket = null;
    var events = [];
    var packets = [];
    var state = "disconnected";
    var lastError = null;
    var eventHandler = null;
    var roomCode = "";
    var role = "";
    var finishActiveClose = null;

    function emit(type, detail) {
      var event = { type: type, detail: detail || null };
      events.push(event);
      if (eventHandler) eventHandler(event);
    }

    function connect(url) {
      if (!WS) throw new Error("WebSocket unavailable");
      if (socket && (socket.readyState === 0 || socket.readyState === 1)) {
        throw new Error("Connection already active");
      }

      events = [];
      packets = [];
      lastError = null;
      roomCode = "";
      role = "";
      state = "connecting";

      var connection = new WS(url);
      var closeEmitted = false;
      socket = connection;
      connection.binaryType = "arraybuffer";

      function finishClose() {
        if (closeEmitted) return;
        closeEmitted = true;
        if (socket === connection) {
          socket = null;
          state = "disconnected";
          roomCode = "";
          role = "";
        }
        emit("close");
      }
      finishActiveClose = finishClose;

      connection.onopen = function () {
        if (socket !== connection) return;
        state = "connected";
        emit("open");
      };
      connection.onmessage = function (event) {
        if (socket !== connection) return;
        if (typeof event.data === "string") {
          try {
            var message = JSON.parse(event.data);
            if (message.type === "room_created") {
              roomCode = message.roomCode || "";
              role = "host";
            } else if (message.type === "room_joined") {
              roomCode = message.roomCode || "";
              role = "client";
            } else if (message.type === "left_room" || message.type === "room_closed") {
              roomCode = "";
              role = "";
            }
            emit("control", message);
          } catch (_) {
            lastError = "invalid_control_message";
            emit("error", { code: lastError });
          }
        } else if (event.data instanceof ArrayBuffer) {
          packets.push(new Uint8Array(event.data.slice(0)));
        } else if (ArrayBuffer.isView(event.data)) {
          packets.push(new Uint8Array(
            event.data.buffer,
            event.data.byteOffset,
            event.data.byteLength
          ).slice());
        } else {
          lastError = "unsupported_binary_message";
          emit("error", { code: lastError });
        }
      };
      connection.onerror = function () {
        if (socket !== connection) return;
        lastError = "websocket_error";
        emit("error", { code: lastError });
      };
      connection.onclose = finishClose;
    }

    function sendControl(message) {
      if (!socket || socket.readyState !== 1) return false;
      socket.send(JSON.stringify(message));
      return true;
    }

    function sendPacket(bytes) {
      if (!socket || socket.readyState !== 1) return false;
      if (!(bytes instanceof Uint8Array)) throw new TypeError("packet must be Uint8Array");
      socket.send(bytes.slice().buffer);
      return true;
    }

    function pollPacket() {
      return packets.length ? packets.shift() : null;
    }

    function pollEvent() {
      return events.length ? events.shift() : null;
    }

    function close() {
      var old = socket;
      var finish = finishActiveClose;
      socket = null;
      state = "disconnected";
      roomCode = "";
      role = "";
      packets = [];
      if (old && (old.readyState === 0 || old.readyState === 1)) old.close();
      if (finish) finish();
      else emit("close");
      finishActiveClose = null;
    }

    return {
      connect: connect,
      sendControl: sendControl,
      sendPacket: sendPacket,
      pollPacket: pollPacket,
      pollEvent: pollEvent,
      setEventHandler: function (handler) {
        eventHandler = typeof handler === "function" ? handler : null;
      },
      close: close,
      getState: function () { return state; },
      getLastError: function () { return lastError; },
      getRoomCode: function () { return roomCode; },
      getRole: function () { return role; },
      isRoomReady: function () {
        return roomCode !== "" && (role === "host" || role === "client");
      },
      getQueuedPacketCount: function () { return packets.length; },
      getQueuedEventCount: function () { return events.length; }
    };
  }

  if (typeof module !== "undefined" && module.exports) {
    module.exports = { createTransport: createTransport };
  } else if (root) {
    root.sm64webRelayTransport = createTransport(root.WebSocket);
  }
})(typeof window !== "undefined" ? window : this);
