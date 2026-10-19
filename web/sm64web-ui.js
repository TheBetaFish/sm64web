(function(){
"use strict";
function setup(){
  // Browsers may keep SDL2's Web Audio context suspended until a real user gesture.
  // Resume it on the first interaction, including the Play Solo menu click.
  var audioUnlockDone=false;
  function unlockBrowserAudio(){
    if(audioUnlockDone)return;
    var candidates=[];
    if(window.SDL2)candidates.push(window.SDL2);
    if(window.Module&&window.Module.SDL2)candidates.push(window.Module.SDL2);
    if(window.Module&&window.Module.SDL)candidates.push(window.Module.SDL);
    var resumed=false;
    candidates.forEach(function(sdl){
      var context=sdl&&sdl.audioContext;
      if(context&&context.state==="suspended"&&typeof context.resume==="function"){
        try{
          var promise=context.resume();
          resumed=true;
          if(promise&&typeof promise.then==="function")promise.then(function(){
            if(context.state==="running")audioUnlockDone=true;
          }).catch(function(){});
        }catch(_){}
      }else if(context&&context.state==="running"){
        audioUnlockDone=true;
      }
    });
    if(audioUnlockDone){
      document.removeEventListener("pointerdown",unlockBrowserAudio,true);
      document.removeEventListener("keydown",unlockBrowserAudio,true);
    }
  }
  document.addEventListener("pointerdown",unlockBrowserAudio,true);
  document.addEventListener("keydown",unlockBrowserAudio,true);
  var canvas=document.getElementById("canvas");
  if(!canvas||document.getElementById("sm64web-stage"))return;
  var header=document.createElement("header");header.id="sm64web-header";
  header.innerHTML='<div class="sm64web-brand"><span class="sm64web-mark">64</span><div>sm64web<div class="sm64web-subtitle">Experimental browser build</div></div></div><span class="sm64web-status">LOCAL ROM · SOLO PLAY</span>';
  var stage=document.createElement("main");stage.id="sm64web-stage";stage.setAttribute("aria-label","Super Mario 64 game viewport");
  var controls=document.createElement("footer");controls.id="sm64web-controls";
  controls.innerHTML='<div class="sm64web-control-group"><span class="sm64web-hint" role="status">Press F to toggle fullscreen.</span></div><section id="sm64web-relay" aria-label="Multiplayer"><div class="sm64web-relay-title">Experimental multiplayer relay</div><div class="sm64web-relay-fields"><label>Relay URL <input id="sm64web-relay-url" value="wss://sm64web-relay.onrender.com/" spellcheck="false" autocomplete="off"></label><label>Room code <input id="sm64web-room-code" maxlength="6" placeholder="ABC234" spellcheck="false" autocomplete="off"></label></div><div class="sm64web-relay-actions"><button class="sm64web-control" id="sm64web-create-room" type="button">Create room</button><button class="sm64web-control" id="sm64web-join-room" type="button">Join room</button><button class="sm64web-control" id="sm64web-leave-room" type="button" disabled>Leave room</button><button class="sm64web-control" id="sm64web-start-host" type="button" disabled>Start as host</button><button class="sm64web-control" id="sm64web-start-client" type="button" disabled>Start as client</button><span id="sm64web-relay-status" role="status">Multiplayer server not connected.</span></div></section>';
  canvas.parentNode.insertBefore(header,canvas);canvas.parentNode.insertBefore(stage,canvas);stage.appendChild(canvas);stage.parentNode.insertBefore(controls,stage.nextSibling);
  // Lightweight FPS graph overlay. It observes browser frame pacing without
  // replacing Emscripten's Module object or interfering with the game's canvas.
  var fpsGraph=document.createElement("div");
  fpsGraph.id="sm64web-fps-graph";
  fpsGraph.setAttribute("aria-label","Browser frame rate");
  fpsGraph.innerHTML='<canvas id="sm64web-fps-canvas" width="180" height="50"></canvas><span id="sm64web-fps-label">-- FPS</span>';
  stage.appendChild(fpsGraph);
  var fpsCanvas=fpsGraph.querySelector("canvas");
  var fpsContext=fpsCanvas.getContext("2d");
  var fpsSamples=[],fpsLast=performance.now(),fpsFrames=0,fpsHideTimer=null;
  function drawFps(now){
    var delta=(now-fpsLast)/1000;
    fpsLast=now;
    if(delta>0&&delta<1)fpsSamples.push(1/delta);
    if(fpsSamples.length>90)fpsSamples.shift();
    fpsFrames++;
    if(fpsFrames%3===0&&fpsContext){
      fpsContext.clearRect(0,0,180,50);
      var maxFps=Math.max(60,...fpsSamples);
      for(var i=0;i<fpsSamples.length;i++){
        var value=fpsSamples[i],height=Math.min(50,value/maxFps*42);
        fpsContext.fillStyle=value>=50?"#48f078":value>=30?"#ffd34e":"#ff5555";
        fpsContext.fillRect(i*2,50-height,1.6,height);
      }
      var average=fpsSamples.length?fpsSamples.reduce(function(sum,value){return sum+value;},0)/fpsSamples.length:0;
      var label=document.getElementById("sm64web-fps-label");
      if(label)label.textContent=Math.round(average)+" FPS";
    }
    window.requestAnimationFrame(drawFps);
  }
  window.requestAnimationFrame(drawFps);
  function revealFps(){
    fpsGraph.classList.remove("sm64web-fps-hidden");
    if(fpsHideTimer)window.clearTimeout(fpsHideTimer);
    fpsHideTimer=window.setTimeout(function(){fpsGraph.classList.add("sm64web-fps-hidden");},5000);
  }
  document.addEventListener("keydown",revealFps,true);
  document.addEventListener("pointermove",function(){fpsGraph.classList.remove("sm64web-fps-hidden");if(fpsHideTimer)window.clearTimeout(fpsHideTimer);fpsHideTimer=window.setTimeout(function(){fpsGraph.classList.add("sm64web-fps-hidden");},5000);},{passive:true});
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
  var SAVE_API_URL="https://pjpnndbdbcoqvafklplb.supabase.co";
  var SAVE_API_KEY="sb_publishable_Fp4sP_IQhNjmHFD2wNJ7Pw_CqE-jhZd";
  var LOCAL_SAVE_KEY="sm64web-local-save-v1";
  var picker=document.createElement("input");
  picker.type="file";picker.accept=".txt,.json,application/json,text/plain";picker.hidden=true;picker.id="sm64web-load-file";document.body.appendChild(picker);
  var saveDialog=null,saveMessage=null,saveCodeInput=null,saveCodeDisplay=null;
  function api(){return window.Module||{};}
  function startSolo(){var m=api();if(typeof m._sm64web_start_solo!=="function"){status("Solo start is unavailable in this build.");return false;}m._sm64web_start_solo();return true;}
  function snapshotSave(){
    var m=api();
    if(typeof m._sm64web_get_save_buffer!=="function"||typeof m._sm64web_get_save_buffer_size!=="function"||!m.HEAPU8)throw new Error("Save support is missing from this WebAssembly build.");
    var ptr=m._sm64web_get_save_buffer(),size=m._sm64web_get_save_buffer_size();
    if(!ptr||size!==512)throw new Error("Unexpected save-buffer size; expected 512 bytes.");
    var bytes=new Uint8Array(m.HEAPU8.buffer,ptr,size).slice(),hex="";
    for(var i=0;i<bytes.length;i++)hex+=bytes[i].toString(16).padStart(2,"0");
    var slot=typeof m._sm64web_get_current_save_slot==="function"?m._sm64web_get_current_save_slot():1;
    if(!Number.isInteger(slot)||slot<1||slot>4)slot=1;
    return {format:"sm64web-save-v1",activeSlot:slot,data:hex};
  }
  function storeLocal(obj){
    try{localStorage.setItem(LOCAL_SAVE_KEY,JSON.stringify(obj));return true;}
    catch(e){console.warn("Could not persist local save:",e);return false;}
  }
  function persistCurrentSave(){
    try{
      var obj=snapshotSave();
      if(!storeLocal(obj))throw new Error("Browser storage is unavailable.");
      status("Game saved in this browser.");
      return obj;
    }catch(e){status("Could not save progress: "+e.message);return null;}
  }
  function validateSave(obj){
    if(!obj||obj.format!=="sm64web-save-v1"||typeof obj.data!=="string"||obj.data.length!==1024||!/^[0-9a-f]{1024}$/i.test(obj.data))throw new Error("This is not a valid SM64 Web save.");
    var slot=Number(obj.activeSlot);
    if(!Number.isInteger(slot)||slot<1||slot>4)slot=1;
    return {format:"sm64web-save-v1",activeSlot:slot,data:obj.data.toLowerCase()};
  }
  function importSaveNow(obj){
    var imported=validateSave(obj),m=api();
    if(typeof m._sm64web_import_save_buffer!=="function"||typeof m._malloc!=="function"||typeof m._free!=="function"||!m.HEAPU8)throw new Error("Save import is not available in this build.");
    var bytes=new Uint8Array(512);
    for(var i=0;i<bytes.length;i++)bytes[i]=parseInt(imported.data.slice(i*2,i*2+2),16);
    if(typeof m._sm64web_set_save_slot==="function")m._sm64web_set_save_slot(imported.activeSlot);
    var ptr=m._malloc(bytes.length);
    if(!ptr)throw new Error("Not enough memory to load the save.");
    try{
      m.HEAPU8.set(bytes,ptr);
      if(m._sm64web_import_save_buffer(ptr,bytes.length)!==1)throw new Error("The game rejected this save.");
    }finally{m._free(ptr);}
    storeLocal(imported);
    return imported;
  }
  function bufferFingerprint(){
    try{
      var s=snapshotSave();return s.data;
    }catch(_){return null;}
  }
  function startAndApplySave(obj){
    var imported=validateSave(obj);
    if(!startSolo())return;
    status("Starting solo mode and preparing the save…");
    // Solo host initialization can reload EEPROM after the menu closes.
    // Wait for the save buffer to settle after startup instead of racing a single
    // fixed delay, then apply the imported buffer once.
    var began=Date.now(),lastFingerprint=null,stableSamples=0;
    function waitForReady(){
      var fingerprint=bufferFingerprint();
      if(fingerprint&&fingerprint===lastFingerprint)stableSamples++;else stableSamples=0;
      lastFingerprint=fingerprint;
      if(Date.now()-began>=1200&&stableSamples>=3){
        try{
          var applied=importSaveNow(imported);
          status("Save loaded successfully (slot "+applied.activeSlot+").");
        }catch(e){status("Save load failed: "+e.message);}
        return;
      }
      if(Date.now()-began>10000){
        try{importSaveNow(imported);status("Save loaded (slot "+imported.activeSlot+").");}
        catch(e){status("Save load failed: "+e.message);}
        return;
      }
      window.setTimeout(waitForReady,200);
    }
    window.setTimeout(waitForReady,200);
  }
  async function saveRpc(functionName,args){
    var response=await fetch(SAVE_API_URL+"/rest/v1/rpc/"+functionName,{
      method:"POST",
      headers:{"apikey":SAVE_API_KEY,"Content-Type":"application/json"},
      body:JSON.stringify(args)
    });
    if(!response.ok){
      var detail=await response.text();
      throw new Error("Online save service returned "+response.status+(detail?": "+detail.slice(0,180):"")+". Apply the SM64 Web save-code SQL migration in Supabase if this is a new setup.");
    }
    return response.json();
  }
  function setSaveMessage(message){if(saveMessage)saveMessage.textContent=message;status(message);}
  function downloadSave(){
    try{
      var obj=persistCurrentSave();if(!obj)return;
      var blob=new Blob([JSON.stringify(obj,null,2)],{type:"application/json"});
      var url=URL.createObjectURL(blob),a=document.createElement("a");
      a.href=url;a.download="sm64web-progress.json";a.click();
      window.setTimeout(function(){URL.revokeObjectURL(url);},1000);
      setSaveMessage("Backup file downloaded. A copy is also saved in this browser.");
    }catch(e){setSaveMessage("Could not export save: "+e.message);}
  }
  async function createShareCode(){
    try{
      var obj=persistCurrentSave();if(!obj)throw new Error("Could not read the current game save.");
      setSaveMessage("Uploading save and creating a code…");
      var result=await saveRpc("sm64web_save_create",{p_data:obj.data,p_active_slot:obj.activeSlot});
      var code=typeof result==="string"?result:(result&&result.code);
      if(!/^[0-9]{10}$/.test(String(code||"")))throw new Error("The save service returned an invalid code.");
      if(saveCodeDisplay){saveCodeDisplay.textContent=code;saveCodeDisplay.style.display="block";}
      if(saveCodeInput)saveCodeInput.value=code;
      setSaveMessage("Online save created. Share this 10-digit code: "+code);
    }catch(e){setSaveMessage("Could not create online save: "+e.message);}
  }
  async function loadShareCode(){
    var code=saveCodeInput?saveCodeInput.value.trim():"";
    if(!/^[0-9]{10}$/.test(code)){setSaveMessage("Enter all 10 digits of the save code.");return;}
    setSaveMessage("Looking up save code…");
    try{
      var result=await saveRpc("sm64web_save_load",{p_code:code});
      if(!result)throw new Error("No save was found for that code.");
      var obj=validateSave(result);
      setSaveMessage("Save found. Starting the game…");
      if(saveDialog)saveDialog.style.display="none";
      startAndApplySave(obj);
    }catch(e){setSaveMessage("Could not load save: "+e.message);}
  }
  function loadLocalSave(){
    try{
      var raw=localStorage.getItem(LOCAL_SAVE_KEY);
      if(!raw)throw new Error("There is no local save in this browser yet.");
      var obj=validateSave(JSON.parse(raw));
      if(saveDialog)saveDialog.style.display="none";
      startAndApplySave(obj);
    }catch(e){setSaveMessage("Could not load local save: "+e.message);}
  }
  function loadSaveFile(){
    picker.value="";
    picker.click();
  }
  function showSaveDialog(){
    if(!saveDialog){
      saveDialog=document.createElement("section");
      saveDialog.id="sm64web-save-dialog";
      saveDialog.setAttribute("role","dialog");
      saveDialog.setAttribute("aria-modal","true");
      saveDialog.setAttribute("aria-label","SM64 Web save manager");
      saveDialog.style.cssText="position:fixed;inset:0;z-index:100000;display:none;align-items:center;justify-content:center;padding:18px;background:rgba(0,0,0,.82);font:16px Arial,sans-serif;color:#fff";
      var card=document.createElement("div");
      card.style.cssText="width:min(100%,520px);max-height:90vh;overflow:auto;box-sizing:border-box;padding:24px;border:3px solid #fff;background:#174bb5;box-shadow:0 0 0 4px #17377d";
      var heading=document.createElement("h2");heading.textContent="SM64 Web Saves";heading.style.cssText="margin:0 0 10px;color:#fff36a";
      var intro=document.createElement("p");intro.textContent="Save in this browser, download a backup, or create a 10-digit code to move your progress to another device.";intro.style.cssText="line-height:1.45";
      saveMessage=document.createElement("p");saveMessage.setAttribute("role","status");saveMessage.style.cssText="min-height:40px;line-height:1.4;color:#fff36a;overflow-wrap:anywhere";
      saveCodeDisplay=document.createElement("div");saveCodeDisplay.style.cssText="display:none;margin:12px 0;padding:12px;border:2px solid #fff36a;background:#102d70;font:bold 28px monospace;letter-spacing:.12em;text-align:center;overflow-wrap:anywhere";
      saveCodeInput=document.createElement("input");saveCodeInput.type="text";saveCodeInput.inputMode="numeric";saveCodeInput.autocomplete="off";saveCodeInput.maxLength=10;saveCodeInput.placeholder="Enter 10-digit save code";saveCodeInput.setAttribute("aria-label","10-digit save code");saveCodeInput.style.cssText="display:block;width:100%;box-sizing:border-box;margin:8px 0;padding:12px;border:2px solid #fff;background:#071a42;color:#fff;font:22px monospace;letter-spacing:.12em";
      saveCodeInput.addEventListener("input",function(){saveCodeInput.value=saveCodeInput.value.replace(/\D/g,"").slice(0,10);});
      ["keydown","keyup","keypress","pointerdown","click"].forEach(function(type){saveCodeInput.addEventListener(type,function(e){e.stopPropagation();});});
      var buttons=document.createElement("div");buttons.style.cssText="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin-top:12px";
      function addButton(label,callback){var b=document.createElement("button");b.type="button";b.textContent=label;b.style.cssText="min-height:42px;padding:10px 8px;border:2px solid #fff;background:#245fc9;color:#fff36a;font:bold 13px Arial,sans-serif;cursor:pointer";b.addEventListener("click",callback);buttons.appendChild(b);return b;}
      addButton("Save online / create code",createShareCode);
      addButton("Load code",loadShareCode);
      addButton("Load this browser's save",loadLocalSave);
      addButton("Download backup file",downloadSave);
      addButton("Import backup file",loadSaveFile);
      addButton("Close",function(){saveDialog.style.display="none";});
      card.appendChild(heading);card.appendChild(intro);card.appendChild(saveMessage);card.appendChild(saveCodeDisplay);card.appendChild(saveCodeInput);card.appendChild(buttons);saveDialog.appendChild(card);document.body.appendChild(saveDialog);
      saveDialog.style.display="none";
      saveDialog.addEventListener("click",function(e){if(e.target===saveDialog)saveDialog.style.display="none";});
      document.addEventListener("keydown",function(e){if(e.key==="Escape"&&saveDialog&&saveDialog.style.display!=="none"){saveDialog.style.display="none";e.stopPropagation();}},true);
    }
    saveDialog.style.display="flex";
    var saved=persistCurrentSave();
    if(saved)setSaveMessage("Current progress saved in this browser. Create a code to share it online.");
    else setSaveMessage("Save manager opened. Start a solo game before saving progress.");
  }
  window.sm64webSaveProgress=showSaveDialog;
  window.sm64webLoadProgress=showSaveDialog;
  picker.addEventListener("change",function(){
    var file=picker.files&&picker.files[0];if(!file)return;
    setSaveMessage("Reading save file…");
    var reader=new FileReader();
    reader.onerror=function(){setSaveMessage("Could not read that save file.");};
    reader.onload=function(){
      try{
        var obj=validateSave(JSON.parse(String(reader.result)));
        if(saveDialog)saveDialog.style.display="none";
        startAndApplySave(obj);
      }catch(e){setSaveMessage("Load failed: "+e.message);}
      picker.value="";
    };
    reader.readAsText(file);
  });
  // Keep local progress resilient across refreshes. This only snapshots when
  // the user saves or opens the save manager, avoiding overwriting a good save
  // with the untouched main-menu buffer.
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
  function toggleFullscreen(){
    if(document.fullscreenElement){
      if(document.exitFullscreen)document.exitFullscreen().catch(function(){});
      return;
    }
    stage.classList.remove("sm64web-fullscreen-fallback");
    if(stage.requestFullscreen){
      try{
        var request=stage.requestFullscreen();
        if(request&&typeof request.catch==="function")request.catch(function(){
          stage.classList.add("sm64web-fullscreen-fallback");
        });
      }catch(_){stage.classList.add("sm64web-fullscreen-fallback");}
    }else{
      stage.classList.add("sm64web-fullscreen-fallback");
    }
  }
  document.addEventListener("keydown",function(e){
    if(e.repeat||e.key.toLowerCase()!=="f"||e.altKey||e.ctrlKey||e.metaKey)return;
    var target=e.target;
    if(target&&(target.isContentEditable||/^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)))return;
    e.preventDefault();
    toggleFullscreen();
  });
  document.addEventListener("fullscreenchange",function(){
    if(document.fullscreenElement!==stage)stage.classList.remove("sm64web-fullscreen-fallback");
  });
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",setup);else setup();
})();