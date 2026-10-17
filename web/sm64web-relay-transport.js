(function (root) {
  "use strict";

  var MAX_RELAY_PACKET_BYTES = 3004;
  var MAX_QUEUED_PACKETS = 128;
  var MAX_QUEUED_EVENTS = 256;

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
      if (events.length >= MAX_QUEUED_EVENTS) events.shift();
      events.push(event);
      if (eventHandler) eventHandler(event);
    }

    function reportError(code) {
      lastError = code;
      emit("error", { code: code });
    }

    function resetRoom() {
      roomCode = "";
      role = "";
    }

    function connect(url) {
      if (!WS) throw new Error("WebSocket unavailable");
      if (socket && (socket.readyState === 0 || socket.readyState === 1)) {
        throw new Error("Connection already active");
      }

      events = [];
      packets = [];
      lastError = null;
      resetRoom();
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
          resetRoom();
          packets = [];
          finishActiveClose = null;
        }
        emit("close");
      }
      finishActiveClose = finishClose;
      // Do not leave the in-game menu stuck at "Connecting" if the hosting
      // platform never completes the WebSocket handshake (for example, when
      // a free service is unavailable or its deployment is misconfigured).
      var connectTimeout = setTimeout(function () {
        if (socket !== connection || connection.readyState !== 0) return;
        reportError("connection_timeout");
        try { connection.close(); } catch (_) { finishClose(); }
      }, 12000);

      connection.onopen = function () {
        clearTimeout(connectTimeout);
        if (socket !== connection) return;
        state = "connected";
        emit("open");
      };
      connection.onmessage = function (event) {
        if (socket !== connection) return;
        if (typeof event.data === "string") {
          var message;
          try {
            message = JSON.parse(event.data);
          } catch (_) {
            reportError("invalid_control_message");
            return;
          }
          if (!message || typeof message !== "object" || Array.isArray(message) ||
              typeof message.type !== "string") {
            reportError("invalid_control_message");
            return;
          }
          if (message.type === "room_created" || message.type === "room_joined") {
            if (typeof message.roomCode !== "string" || !message.roomCode) {
              reportError("invalid_room_control");
              return;
            }
            roomCode = message.roomCode;
            role = message.type === "room_created" ? "host" : "client";
          } else if (message.type === "left_room" || message.type === "room_closed") {
            resetRoom();
          }
          emit("control", message);
        } else {
          var bytes = null;
          if (event.data instanceof ArrayBuffer) {
            bytes = new Uint8Array(event.data.slice(0));
          } else if (ArrayBuffer.isView(event.data)) {
            bytes = new Uint8Array(event.data.buffer, event.data.byteOffset, event.data.byteLength).slice();
          }
          if (!bytes) {
            reportError("unsupported_binary_message");
            return;
          }
          if (bytes.byteLength === 0 || bytes.byteLength > MAX_RELAY_PACKET_BYTES) {
            reportError("invalid_packet_size");
            return;
          }
          if (packets.length >= MAX_QUEUED_PACKETS) {
            reportError("packet_queue_overflow");
            connection.close(1008, "packet queue overflow");
            return;
          }
          packets.push(bytes);
        }
      };
      connection.onerror = function () {
        if (socket !== connection) return;
        reportError("websocket_error");
      };
      connection.onclose = function () {
        clearTimeout(connectTimeout);
        finishClose();
      };
    }

    function sendControl(message) {
      if (!socket || socket.readyState !== 1) return false;
      if (!message || typeof message !== "object" || Array.isArray(message) ||
          typeof message.type !== "string") {
        throw new TypeError("control message must be an object with a string type");
      }
      socket.send(JSON.stringify(message));
      return true;
    }

    function sendPacket(bytes) {
      if (!socket || socket.readyState !== 1) return false;
      if (!(bytes instanceof Uint8Array)) throw new TypeError("packet must be Uint8Array");
      if (bytes.byteLength === 0 || bytes.byteLength > 3000) throw new RangeError("packet size must be 1..3000 bytes");
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
      resetRoom();
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
      setEventHandler: function (handler) { eventHandler = typeof handler === "function" ? handler : null; },
      close: close,
      getState: function () { return state; },
      getLastError: function () { return lastError; },
      getRoomCode: function () { return roomCode; },
      getRole: function () { return role; },
      isRoomReady: function () { return roomCode !== "" && (role === "host" || role === "client"); },
      getQueuedPacketCount: function () { return packets.length; },
      getQueuedEventCount: function () { return events.length; }
    };
  }

  if (typeof module !== "undefined" && module.exports) {
    module.exports = { createTransport: createTransport, MAX_RELAY_PACKET_BYTES: MAX_RELAY_PACKET_BYTES };
  } else if (root) {
    root.sm64webRelayTransport = createTransport(root.WebSocket);
  }
})(typeof window !== "undefined" ? window : this);
