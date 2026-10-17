(function (root) {
"use strict";
function createTransport(WebSocketImpl) {
  var WS = WebSocketImpl || (root && root.WebSocket);
  var socket = null, events = [], packets = [], state = "disconnected", lastError = null, eventHandler = null, roomCode = "", role = "";
  function emit(type, detail) { var event={type:type, detail:detail || null}; events.push(event); if (eventHandler) eventHandler(event); }
  function connect(url) {
    if (!WS) throw new Error("WebSocket unavailable");
    if (socket && (socket.readyState === 0 || socket.readyState === 1)) throw new Error("Connection already active");
    events = []; packets = []; lastError = null; roomCode = ""; role = ""; state = "connecting";
    socket = new WS(url); socket.binaryType = "arraybuffer";
    socket.onopen = function(){ state="connected"; emit("open"); };
    socket.onmessage = function(e) {
      if (typeof e.data === "string") {
        try { emit("control", JSON.parse(e.data)); }
        catch (_) { lastError="invalid_control_message"; emit("error", {code:lastError}); }
      } else if (e.data instanceof ArrayBuffer) packets.push(new Uint8Array(e.data));
      else if (ArrayBuffer.isView(e.data)) packets.push(new Uint8Array(e.data.buffer,e.data.byteOffset,e.data.byteLength).slice());
      else { lastError="unsupported_binary_message"; emit("error",{code:lastError}); }
    };
    socket.onerror = function(){ lastError="websocket_error"; emit("error",{code:lastError}); };
    socket.onclose = function(){ state="disconnected"; roomCode=""; role=""; emit("close"); };
  }
  function sendControl(message) { if (!socket || socket.readyState !== 1) return false; socket.send(JSON.stringify(message)); return true; }
  function sendPacket(bytes) { if (!socket || socket.readyState !== 1) return false; if (!(bytes instanceof Uint8Array)) throw new TypeError("packet must be Uint8Array"); socket.send(bytes.slice().buffer); return true; }
  function pollPacket() { return packets.length ? packets.shift() : null; }
  function pollEvent() { return events.length ? events.shift() : null; }
  function close() { if (socket) { var old=socket; socket=null; if(old.readyState===0||old.readyState===1) old.close(); } state="disconnected"; roomCode=""; role=""; packets=[]; emit("close"); }
  return {connect:connect,sendControl:sendControl,sendPacket:sendPacket,pollPacket:pollPacket,pollEvent:pollEvent,setEventHandler:function(handler){eventHandler=typeof handler==="function"?handler:null;},close:close,getState:function(){return state;},getLastError:function(){return lastError;},getRoomCode:function(){return roomCode;},getRole:function(){return role;},isRoomReady:function(){return roomCode!==""&&(role==="host"||role==="client");},getQueuedPacketCount:function(){return packets.length;},getQueuedEventCount:function(){return events.length;}};
}
if (typeof module !== "undefined" && module.exports) module.exports={createTransport:createTransport};
else if (root) root.sm64webRelayTransport=createTransport(root.WebSocket);
})(typeof window !== "undefined" ? window : this);
