(function(){
"use strict";
function setup(){
  var canvas=document.getElementById("canvas");
  if(!canvas||document.getElementById("sm64web-stage"))return;
  var header=document.createElement("header");header.id="sm64web-header";
  header.innerHTML='<div class="sm64web-brand"><span class="sm64web-mark">64</span><div>sm64web<div class="sm64web-subtitle">Experimental browser build</div></div></div><span class="sm64web-status">LOCAL ROM · SOLO PLAY</span>';
  var stage=document.createElement("main");stage.id="sm64web-stage";stage.setAttribute("aria-label","Super Mario 64 game viewport");
  var controls=document.createElement("footer");controls.id="sm64web-controls";
  controls.innerHTML='<div class="sm64web-control-group"><span class="sm64web-hint" role="status">Select Play Solo in the game menu to begin.</span></div><div class="sm64web-control-group"><button class="sm64web-control" id="sm64web-fullscreen" type="button">Fullscreen</button></div><section id="sm64web-relay" aria-label="Multiplayer"><div class="sm64web-relay-title">Experimental multiplayer relay</div><div class="sm64web-relay-fields"><label>Relay URL <input id="sm64web-relay-url" value="wss://sm64web-relay.onrender.com/" spellcheck="false" autocomplete="off"></label><label>Room code <input id="sm64web-room-code" maxlength="6" placeholder="ABC234" spellcheck="false" autocomplete="off"></label></div><div class="sm64web-relay-actions"><button class="sm64web-control" id="sm64web-create-room" type="button">Create room</button><button class="sm64web-control" id="sm64web-join-room" type="button">Join room</button><button class="sm64web-control" id="sm64web-leave-room" type="button" disabled>Leave room</button><button class="sm64web-control" id="sm64web-start-host" type="button" disabled>Start as host</button><button class="sm64web-control" id="sm64web-start-client" type="button" disabled>Start as client</button><span id="sm64web-relay-status" role="status">Multiplayer server not connected.</span></div></section>';
  canvas.parentNode.insertBefore(header,canvas);canvas.parentNode.insertBefore(stage,canvas);stage.appendChild(canvas);stage.parentNode.insertBefore(controls,stage.nextSibling);
  var hint=controls.querySelector(".sm64web-hint");
  function status(message){if(hint)hint.textContent=message;}
  // Right-click toggles camera mode; it is a click, not a hold modifier.
  // Request/exit Pointer Lock directly from the user gesture so browsers allow it.
  canvas.addEventListener("contextmenu",function(e){e.preventDefault();});
  canvas.addEventListener("mousedown",function(e){
    if(e.button!==2)return;
    e.preventDefault();
    if(document.pointerLockElement===canvas){
      if(document.exitPointerLock)document.exitPointerLock();
      status("Camera unlocked.");
      return;
    }
    if(canvas.requestPointerLock){
      try{
        var lock=canvas.requestPointerLock();
        if(lock&&typeof lock.catch==="function")lock.catch(function(){status("Camera capture was blocked by the browser.");});
      }catch(_){status("Could not capture the mouse.");}
    }
  });
  // Translate pointer-locked mouse motion into brief arrow-key presses.
  // The game already responds to arrow keys, so this avoids depending on
  // SDL relative-mouse support in the browser build.
  var cameraKeys={};
  var cameraKeyTimers={};
  function releaseCameraKey(key){
    if(!cameraKeys[key])return;
    canvas.dispatchEvent(new KeyboardEvent("keyup",{key:key,code:key,bubbles:true,cancelable:true}));
    delete cameraKeys[key];
  }
  function tapCameraKey(key){
    if(!cameraKeys[key]){
      cameraKeys[key]=true;
      canvas.dispatchEvent(new KeyboardEvent("keydown",{key:key,code:key,bubbles:true,cancelable:true}));
    }
    if(cameraKeyTimers[key])clearTimeout(cameraKeyTimers[key]);
    cameraKeyTimers[key]=setTimeout(function(){releaseCameraKey(key);delete cameraKeyTimers[key];},70);
  }
  document.addEventListener("mousemove",function(e){
    if(document.pointerLockElement!==canvas)return;
    var dx=e.movementX||0,dy=e.movementY||0;
    var threshold=1.5;
    if(dx < -threshold)tapCameraKey("ArrowLeft");
    else if(dx > threshold)tapCameraKey("ArrowRight");
    if(dy < -threshold)tapCameraKey("ArrowUp");
    else if(dy > threshold)tapCameraKey("ArrowDown");
  });
  var pendingMouseCapture=null;
  var mouseCaptureRuntimeHooked=false;
  function api(){return window.Module||{};}
  function syncNativeMouseCapture(locked){
    var m=api();
    pendingMouseCapture=locked?1:0;
    if(typeof m._sm64web_set_mouse_capture!=="function")return;
    // Emscripten export wrappers exist before the runtime is initialized, but
    // calling them at that stage aborts the entire WebAssembly application.
    if(m.calledRun!==true&&m.runtimeInitialized!==true){
      if(!mouseCaptureRuntimeHooked){
        mouseCaptureRuntimeHooked=true;
        var previous=m.onRuntimeInitialized;
        m.onRuntimeInitialized=function(){
          if(typeof previous==="function")previous.apply(this,arguments);
          var live=api();
          if(pendingMouseCapture!==null&&typeof live._sm64web_set_mouse_capture==="function"&&(live.calledRun===true||live.runtimeInitialized===true)){
            var desired=pendingMouseCapture;
            pendingMouseCapture=null;
            live._sm64web_set_mouse_capture(desired);
          }
        };
      }
      return;
    }
    var desired=pendingMouseCapture;
    pendingMouseCapture=null;
    m._sm64web_set_mouse_capture(desired);
  }
  document.addEventListener("pointerlockchange",function(){
    var locked=document.pointerLockElement===canvas;
    syncNativeMouseCapture(locked);
    if(!locked){
      Object.keys(cameraKeys).forEach(releaseCameraKey);
      Object.keys(cameraKeyTimers).forEach(function(key){clearTimeout(cameraKeyTimers[key]);delete cameraKeyTimers[key];});
    }
    status(locked?"Camera locked — mouse movement is mapped to arrow keys; right-click to release.":"Camera unlocked.");
  });
  var picker=document.createElement("input");picker.type="file";picker.accept=".txt,.json,application/json,text/plain";picker.hidden=true;picker.id="sm64web-load-file";document.body.appendChild(picker);
  function startSolo(){var m=api();if(typeof m._sm64web_start_solo!=="function"){status("Solo start is unavailable in this build.");return;}m._sm64web_start_solo();}
  function saveProgress(){
    var m=api();
    if(typeof m._sm64web_get_save_buffer!=="function"||typeof m._sm64web_get_save_buffer_size!=="function"){status("Save export is not available in this build yet.");return false;}
    try{
      var ptr=m._sm64web_get_save_buffer(),size=m._sm64web_get_save_buffer_size();
      var bytes=new Uint8Array(m.HEAPU8.buffer,ptr,size),hex="";
      for(var i=0;i<bytes.length;i++)hex+=bytes[i].toString(16).padStart(2,"0");
      var slot=typeof m._sm64web_get_current_save_slot==="function"?m._sm64web_get_current_save_slot():1;
      var blob=new Blob([JSON.stringify({format:"sm64web-save-v1",activeSlot:slot,data:hex},null,2)],{type:"text/plain"});
      var url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download="sm64web-progress.txt";a.click();setTimeout(function(){URL.revokeObjectURL(url);},1000);status("Save file exported.");return true;
    }catch(e){status("Could not save progress: "+e.message);return false;}
  }
  window.sm64webSaveProgress=saveProgress;
  window.sm64webLoadProgress=function(){picker.click();};
  picker.addEventListener("change",function(){
    var file=picker.files&&picker.files[0];if(!file)return;
    status("Reading save file…");
    var reader=new FileReader();
    reader.onerror=function(){status("Could not read that save file.");};
    reader.onload=function(){
      try{
        var obj=JSON.parse(String(reader.result));
        if(!obj||obj.format!=="sm64web-save-v1"||typeof obj.data!=="string"||obj.data.length%2||!/^[0-9a-f]*$/i.test(obj.data))throw new Error("This is not a valid sm64web save file.");
        var m=api();
        if(typeof m._sm64web_import_save_buffer!=="function"||typeof m._malloc!=="function"||typeof m._free!=="function")throw new Error("Save import is not available in this build yet.");
        var size=obj.data.length/2;
        if(typeof m._sm64web_get_save_buffer_size==="function"&&size!==m._sm64web_get_save_buffer_size())throw new Error("This save has the wrong size for this build.");
        var importedBytes=new Uint8Array(size);
        for(var i=0;i<size;i++)importedBytes[i]=parseInt(obj.data.slice(i*2,i*2+2),16);
        var slot=Number(obj.activeSlot);
        if(!Number.isInteger(slot)||slot<1||slot>4)slot=1;
        if(typeof m._sm64web_set_save_slot==="function")m._sm64web_set_save_slot(slot);
        status("Starting solo mode with save slot "+slot+"…");
        startSolo();
        // Apply only after session initialization, which can reload EEPROM-backed data.
        window.setTimeout(function(){
          try{
            var live=api();
            if(typeof live._sm64web_import_save_buffer!=="function"||typeof live._malloc!=="function"||typeof live._free!=="function")throw new Error("Save import is not available.");
            var liveSize=typeof live._sm64web_get_save_buffer_size==="function"?live._sm64web_get_save_buffer_size():importedBytes.length;
            if(liveSize!==importedBytes.length)throw new Error("Save file is incompatible with this build.");
            var livePtr=live._malloc(importedBytes.length);if(!livePtr)throw new Error("Not enough memory.");
            try{live.HEAPU8.set(importedBytes,livePtr);if(live._sm64web_import_save_buffer(livePtr,importedBytes.length)!==1)throw new Error("Save file is incompatible with this build.");}
            finally{live._free(livePtr);}
            status("Save loaded (slot "+slot+").");
          }catch(e){status("Save apply failed: "+e.message);}
        },1200);
      }catch(e){status("Load failed: "+e.message);}
      picker.value="";
    };
    reader.readAsText(file);
  });
  // Multiplayer lobby controls use the hosted relay by default. Game packet
  // synchronization remains experimental until verified in two browser sessions.
  var relayUrl=document.getElementById("sm64web-relay-url");
  var roomInput=document.getElementById("sm64web-room-code");
  var relayStatus=document.getElementById("sm64web-relay-status");
  var createRoom=document.getElementById("sm64web-create-room");
  var joinRoom=document.getElementById("sm64web-join-room");
  var leaveRoom=document.getElementById("sm64web-leave-room");
  var startHost=document.getElementById("sm64web-start-host");
  var startClient=document.getElementById("sm64web-start-client");
  function syncNetworkButtons(){var ready=!!(relayTransport&&relayTransport.isRoomReady());if(startHost)startHost.disabled=!ready||relayTransport.getRole()!=="host";if(startClient)startClient.disabled=!ready||relayTransport.getRole()!=="client";}
  var relayRoom=null,relayRole=null,relayPeerCount=1,relayPending=null;
  var relayTransport=window.sm64webRelayTransport;
  function callNative(name,value){
    var m=api();
    if(typeof m[name]!=="function"){
      console.warn("SM64Web native bridge function unavailable:",name);
      return false;
    }
    if(typeof m.allocateUTF8!=="function"||typeof m._free!=="function"){
      console.warn("SM64Web native bridge string helpers unavailable:",{
        allocateUTF8:typeof m.allocateUTF8,free:typeof m._free,name:name
      });
      return false;
    }
    var ptr=0;
    try{
      ptr=m.allocateUTF8(String(value));
      m[name](ptr);
      return true;
    }catch(e){
      console.error("SM64Web native bridge call failed:",name,e);
      return false;
    }finally{
      if(ptr)m._free(ptr);
    }
  }
  function nativeStatus(message){callNative("_sm64web_set_multiplayer_status",message);}
  function nativeRoomCode(code){callNative("_sm64web_set_room_code",code);}
  function relayMessage(message){
    if(!relayStatus)return;
    if(message.type==="room_created"){
      relayRoom=message.roomCode;relayRole="host";relayPeerCount=1;roomInput.value=relayRoom;
      relayStatus.textContent="Room "+relayRoom+" created. Share the code with a friend to join.";nativeRoomCode(relayRoom);
      leaveRoom.disabled=false;syncNetworkButtons();
    }else if(message.type==="room_joined"){
      relayRoom=message.roomCode;relayRole="client";roomInput.value=relayRoom;relayPeerCount=2;
      relayStatus.textContent="Joined room "+relayRoom+". Waiting for host.";
      leaveRoom.disabled=false;syncNetworkButtons();
    }else if(message.type==="peer_joined"){
      relayPeerCount=message.count;
      relayStatus.textContent="Room "+relayRoom+": "+relayPeerCount+" players connected.";
    }else if(message.type==="peer_left"){
      relayPeerCount=message.count;
      relayStatus.textContent="Room "+relayRoom+": "+relayPeerCount+" participants.";
    }else if(message.type==="room_closed"){
      relayRoom=null;relayRole=null;leaveRoom.disabled=true;syncNetworkButtons();
      relayStatus.textContent="Room closed by host."
    }else if(message.type==="left_room"){
      relayRoom=null;relayRole=null;leaveRoom.disabled=true;syncNetworkButtons();
      relayStatus.textContent="Left relay room."
    }else if(message.type==="error"){
      relayStatus.textContent="Relay error: "+String(message.code||"unknown_error").replace(/_/g," ");
    }
    nativeStatus(relayStatus.textContent);
  }
  if(relayTransport&&typeof relayTransport.setEventHandler==="function"){
    relayTransport.setEventHandler(function(event){
      if(event.type==="open"){
        relayStatus.textContent="Relay connected.";
        if(relayPending){var queued=relayPending;relayPending=null;if(!relayTransport.sendControl(queued))relayStatus.textContent="Relay connection closed before the request could be sent.";}
      }else if(event.type==="control"){
        relayMessage(event.detail);
      }else if(event.type==="error"){
        relayStatus.textContent="Could not reach the multiplayer server. It may be offline; try again later.";
      }else if(event.type==="close"){
        relayRoom=null;relayRole=null;leaveRoom.disabled=true;syncNetworkButtons();
        relayStatus.textContent="Multiplayer server disconnected. Try again in a moment."
      }
      nativeStatus(relayStatus.textContent);
    });
  }
  function startGameNetwork(hostRole){
    var m=api();
    if(!relayTransport||!relayTransport.isRoomReady()){relayStatus.textContent="Create or join a relay room first.";return;}
    if(typeof m._sm64web_start_network!=="function"){relayStatus.textContent="This WebAssembly build does not include the experimental game-network adapter yet.";return;}
    startHost.disabled=true;startClient.disabled=true;
    var result=0;
    try{result=m._sm64web_start_network(hostRole?1:0);}catch(e){relayStatus.textContent="Could not start game networking: "+e.message;syncNetworkButtons();return;}
    if(result===1){relayStatus.textContent=hostRole?"CoopDX host session started. Waiting for clients to join…":"CoopDX client started; sending the normal join request…";}
    else{relayStatus.textContent="Game networking could not start. Confirm the room role and rebuild the WebAssembly target.";syncNetworkButtons();}
  }
  startHost.addEventListener("click",function(){startGameNetwork(true);});
  startClient.addEventListener("click",function(){startGameNetwork(false);});
  function relayConnectAndSend(message){
    if(!relayTransport){relayStatus.textContent="Relay transport bridge is not loaded.";return;}
    var endpoint=relayUrl.value.trim();
    if(!/^wss?:\/\//i.test(endpoint)){relayStatus.textContent="Relay URL must begin with ws:// or wss://.";return;}
    if(relayTransport.getState()==="connected"){
      if(!relayTransport.sendControl(message))relayStatus.textContent="Could not send relay request.";
      return;
    }
    if(relayTransport.getState()==="connecting"){
      relayPending=message;relayStatus.textContent="Connecting to relay…";return;
    }
    try{
      relayPending=message;relayStatus.textContent="Connecting to multiplayer server…";
      relayTransport.connect(endpoint);
    }catch(e){relayPending=null;relayStatus.textContent="Could not reach the multiplayer server. It may not be online yet.";}
  }
  syncNetworkButtons();
  createRoom.addEventListener("click",function(){
    if(relayRoom){relayStatus.textContent="Leave the current room before creating another.";return;}
    relayPending=null;relayConnectAndSend({type:"create"});
  });
  joinRoom.addEventListener("click",function(){
    if(relayRoom){relayStatus.textContent="Leave the current room before joining another.";return;}
    var code=roomInput.value.trim().toUpperCase();
    if(!/^[A-HJ-NP-Z2-9]{6}$/.test(code)){relayStatus.textContent="Enter a valid six-character room code.";return;}
    relayPending=null;relayConnectAndSend({type:"join",roomCode:code});
  });
  // Called by native CoopDX DJUI buttons. HTML is only the transport bridge;
  // the visible room menu and room-code input stay inside the game UI.
  window.sm64webSetMultiplayerStatus=nativeStatus;
  window.sm64webCreateRoom=function(){
    if(relayRoom){nativeStatus("Leave the current room before creating another.");return;}
    relayPending=null;relayConnectAndSend({type:"create"});
    nativeStatus(relayStatus.textContent);
  };
  window.sm64webJoinRoom=function(code){
    if(relayRoom){nativeStatus("Leave the current room before joining another.");return;}
    code=String(code||"").trim().toUpperCase();
    if(!/^[A-HJ-NP-Z2-9]{6}$/.test(code)){nativeStatus("Enter a valid six-character room code.");return;}
    relayPending=null;relayConnectAndSend({type:"join",roomCode:code});
    nativeStatus(relayStatus.textContent);
  };
  leaveRoom.addEventListener("click",function(){
    if(relayTransport&&relayTransport.sendControl({type:"leave"}))return;
    relayRoom=null;relayRole=null;leaveRoom.disabled=true;relayStatus.textContent="Relay disconnected.";
  });
  // SDL/game keyboard handlers must not consume text typed into the HTML room-code field.
  ["keydown","keyup","keypress"].forEach(function(type){
    roomInput.addEventListener(type,function(e){e.stopPropagation();});
  });
  roomInput.addEventListener("pointerdown",function(e){e.stopPropagation();});
  roomInput.addEventListener("click",function(e){e.stopPropagation();});
  roomInput.addEventListener("input",function(){roomInput.value=roomInput.value.toUpperCase().replace(/[^A-HJ-NP-Z2-9]/g,"").slice(0,6);});
  var btn=document.getElementById("sm64web-fullscreen");
  function sync(){btn.textContent=(document.fullscreenElement===stage)?"Exit fullscreen":"Fullscreen";}
  btn.addEventListener("click",function(){if(document.fullscreenElement){if(document.exitFullscreen)document.exitFullscreen();}else if(stage.requestFullscreen){stage.requestFullscreen().catch(function(){stage.classList.add("sm64web-fullscreen-fallback");});}else stage.classList.add("sm64web-fullscreen-fallback");});
  document.addEventListener("fullscreenchange",sync);sync();
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",setup);else setup();
})();