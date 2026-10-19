(function () {
  "use strict";
  var STORAGE_KEY = "sm64web-user-lua-mods-v1";
  var MAX_PERSIST_BYTES = 3 * 1024 * 1024;
  var panel, statusNode, fileInput, restoring = false;
  function getModule(){ return window.Module || {}; }
  function getSavedMods(){
    try { var v=JSON.parse(localStorage.getItem(STORAGE_KEY)||"[]"); return Array.isArray(v)?v.filter(function(m){return m&&typeof m.name==="string"&&typeof m.source==="string"&&m.name.endsWith(".lua");}):[]; }
    catch(_){ return []; }
  }
  function setStatus(message,isError){
    if(!statusNode)return; statusNode.textContent=message; statusNode.style.color=isError?"#ffb5b5":"#d9f7d9";
  }
  function installSource(name,source){
    var M=getModule();
    if(typeof M._sm64web_install_lua_mod!=="function"||typeof M.allocateUTF8!=="function"||typeof M._malloc!=="function"||typeof M._free!=="function"||!M.HEAPU8)
      return {ok:false,message:"The WebAssembly mod installer is not ready. Wait for the game to finish loading."};
    var np=0,dp=0;
    try{
      var bytes=new TextEncoder().encode(source); np=M.allocateUTF8(name); dp=M._malloc(bytes.length);
      if(!np||!dp)throw new Error("Not enough WebAssembly memory to install this mod.");
      M.HEAPU8.set(bytes,dp);
      if(M._sm64web_install_lua_mod(np,dp,bytes.length)!==1)return {ok:false,message:"The game rejected this Lua file. Check its filename and try again."};
      return {ok:true,message:"Installed "+name+". Open the in-game Mods menu and enable it."};
    }catch(e){return {ok:false,message:"Install failed: "+e.message};}
    finally{if(np)M._free(np);if(dp)M._free(dp);}
  }
  function saveMod(name,source){
    var mods=getSavedMods().filter(function(m){return m.name!==name;}); mods.push({name:name,source:source});
    if(new TextEncoder().encode(JSON.stringify(mods)).length>MAX_PERSIST_BYTES)return false;
    try{localStorage.setItem(STORAGE_KEY,JSON.stringify(mods));return true;}catch(_){return false;}
  }
  function restoreSavedMods(){
    setStatus("Saved Lua mods are restored before game startup. Reload the page after adding a mod.");
  }
  function renderSavedMods(){
    var list=document.getElementById("sm64web-mods-list"); if(!list)return;
    var mods=getSavedMods(); list.textContent=mods.length?mods.map(function(m){return "• "+m.name;}).join("\n"):"No saved Lua mods yet."; list.style.whiteSpace="pre-line";
  }
  function makePanel(){
    var style=document.createElement("style");
    style.textContent=`
      #sm64web-mods-button{position:fixed;right:14px;top:14px;z-index:99990;border:2px solid #fff;background:#174bb5;color:#fff36a;padding:9px 13px;font:bold 13px Arial,sans-serif;box-shadow:0 0 0 2px #17377d;cursor:pointer}
      #sm64web-mods-button:hover{background:#2866d1}
      #sm64web-mods-panel{position:fixed;inset:0;z-index:99999;display:flex;align-items:center;justify-content:center;padding:16px;background:rgba(0,0,0,.76);font-family:Arial,sans-serif}
      #sm64web-mods-panel[hidden]{display:none}
      #sm64web-mods-dialog{width:min(100%,560px);max-height:90vh;overflow:auto;background:#174bb5;color:#fff;border:4px solid #fff;box-shadow:0 0 0 4px #17377d;padding:20px}
      #sm64web-mods-dialog h2{margin:0 0 12px;color:#fff36a;font-size:20px}
      #sm64web-mods-dialog p{font-size:13px;line-height:1.5}
      #sm64web-mods-dialog .mod-actions{display:flex;flex-wrap:wrap;gap:8px;margin:14px 0}
      #sm64web-mods-dialog button,#sm64web-mods-dialog label{border:2px solid #fff;background:#245fc9;color:#fff36a;padding:9px 12px;font-weight:bold;font-size:12px;cursor:pointer}
      #sm64web-mods-dialog input[type=file]{display:none}
      #sm64web-mods-status{font:12px/1.5 monospace;background:#102d70;border:1px solid #d5e6ff;padding:10px;overflow-wrap:anywhere}
      #sm64web-mods-list{font:12px/1.7 monospace;color:#d5e6ff;overflow-wrap:anywhere}
      #sm64web-mods-close{float:right}
    `;
    document.head.appendChild(style);
    var button=document.createElement("button");button.id="sm64web-mods-button";button.type="button";button.textContent="Lua Mods";
    button.addEventListener("click",function(){panel.hidden=false;});document.body.appendChild(button);
    panel=document.createElement("section");panel.id="sm64web-mods-panel";panel.hidden=true;
    panel.innerHTML=`
      <div id="sm64web-mods-dialog" role="dialog" aria-modal="true" aria-labelledby="sm64web-mods-title">
        <button id="sm64web-mods-close" type="button">Close</button>
        <h2 id="sm64web-mods-title">SM64 Web — Lua Mods</h2>
        <p>Select a standalone <code>.lua</code> mod file. The game installs it into its writable mods directory. Only use mods you trust: Lua mods can execute game-side code.</p>
        <div class="mod-actions"><label for="sm64web-mods-file">Choose Lua file</label><input id="sm64web-mods-file" type="file" accept=".lua,text/plain"><button id="sm64web-mods-refresh" type="button">Retry saved mods</button></div>
        <div id="sm64web-mods-status" role="status">Waiting for a Lua mod file.</div>
        <h3>Saved in this browser</h3><div id="sm64web-mods-list"></div>
        <p>After installing, open the game's in-game Mods menu and enable the mod. Saved mods are local to this browser and site.</p>
      </div>`;
    document.body.appendChild(panel);statusNode=panel.querySelector("#sm64web-mods-status");fileInput=panel.querySelector("#sm64web-mods-file");
    panel.querySelector("#sm64web-mods-close").addEventListener("click",function(){panel.hidden=true;});
    panel.addEventListener("click",function(e){if(e.target===panel)panel.hidden=true;});
    panel.querySelector("#sm64web-mods-refresh").addEventListener("click",restoreSavedMods);
    fileInput.addEventListener("change",async function(){
      var file=fileInput.files&&fileInput.files[0];fileInput.value="";if(!file)return;
      if(!/^[a-zA-Z0-9 _.-]+\.lua$/i.test(file.name)||file.name.indexOf("..")!==-1){setStatus("Use a simple .lua filename with letters, numbers, spaces, dots, underscores or hyphens.",true);return;}
      if(file.size>35*1024*1024){setStatus("This Lua file exceeds the 35 MB limit.",true);return;}
      setStatus("Reading "+file.name+"…");
      try{
        var source=await file.text(),result=installSource(file.name,source);
        if(!result.ok){setStatus(result.message,true);return;}
        var saved=saveMod(file.name,source);
        setStatus((saved ? "Saved " + file.name + ". Reload the page to load it; it will be injected before the game starts." : result.message + " Installed for this session, but it was too large for browser persistence."));
        renderSavedMods();
      }catch(e){setStatus("Could not read the file: "+e.message,true);}
    });
    renderSavedMods();
  }
  function start(){
    makePanel();
    restoreSavedMods();
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",start,{once:true});else start();
})();