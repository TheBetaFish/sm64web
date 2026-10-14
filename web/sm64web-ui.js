(function(){
"use strict";
function setup(){
  var canvas=document.getElementById("canvas");
  if(!canvas||document.getElementById("sm64web-stage"))return;
  var header=document.createElement("header");header.id="sm64web-header";
  header.innerHTML='<div class="sm64web-brand"><span class="sm64web-mark">64</span><div>sm64web<div class="sm64web-subtitle">Experimental browser build</div></div></div><span class="sm64web-status">LOCAL ROM · SOLO PLAY</span>';
  var stage=document.createElement("main");stage.id="sm64web-stage";stage.setAttribute("aria-label","Super Mario 64 game viewport");
  var controls=document.createElement("footer");controls.id="sm64web-controls";
  controls.innerHTML='<div class="sm64web-control-group"><span class="sm64web-hint" role="status">Select Play Solo in the game menu to begin.</span></div><div class="sm64web-control-group"><button class="sm64web-control" id="sm64web-fullscreen" type="button">Fullscreen</button></div>';
  canvas.parentNode.insertBefore(header,canvas);canvas.parentNode.insertBefore(stage,canvas);stage.appendChild(canvas);stage.parentNode.insertBefore(controls,stage.nextSibling);
  var hint=controls.querySelector(".sm64web-hint");
  function status(message){if(hint)hint.textContent=message;}
  function api(){return window.Module||{};}
  var picker=document.createElement("input");picker.type="file";picker.accept=".txt,.json,application/json,text/plain";picker.hidden=true;picker.id="sm64web-load-file";document.body.appendChild(picker);
  function startSolo(){var m=api();if(typeof m._sm64web_start_solo!=="function"){status("Solo start is unavailable in this build.");return;}m._sm64web_start_solo();}
  function saveProgress(){
    var m=api();
    if(typeof m._sm64web_get_save_buffer!=="function"||typeof m._sm64web_get_save_buffer_size!=="function"){status("Save export is not available in this build yet.");return false;}
    try{
      var ptr=m._sm64web_get_save_buffer(),size=m._sm64web_get_save_buffer_size();
      var bytes=new Uint8Array(m.HEAPU8.buffer,ptr,size),hex="";
      for(var i=0;i<bytes.length;i++)hex+=bytes[i].toString(16).padStart(2,"0");
      var blob=new Blob([JSON.stringify({format:"sm64web-save-v1",data:hex},null,2)],{type:"text/plain"});
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
        var m=api();if(typeof m._sm64web_import_save_buffer!=="function"||typeof m._malloc!=="function"||typeof m._free!=="function")throw new Error("Save import is not available in this build yet.");
        var size=obj.data.length/2,ptr=m._malloc(size);if(!ptr)throw new Error("Not enough memory.");
        try{for(var i=0;i<size;i++)m.HEAPU8[ptr+i]=parseInt(obj.data.slice(i*2,i*2+2),16);if(m._sm64web_import_save_buffer(ptr,size)!==1)throw new Error("Save file is incompatible with this build.");}
        finally{m._free(ptr);}
        // Preserve the imported bytes until solo-session initialization has finished.
        // The host startup path reloads EEPROM-backed data, overwriting an early import.
        var importedBytes=new Uint8Array(size);
        for(var j=0;j<size;j++)importedBytes[j]=parseInt(obj.data.slice(j*2,j*2+2),16);
        status("Save read. Starting solo mode…");
        startSolo();
        window.setTimeout(function(){
          try{
            var live=api();
            if(typeof live._sm64web_import_save_buffer!=="function"||typeof live._malloc!=="function"||typeof live._free!=="function")throw new Error("Save import is not available.");
            var livePtr=live._malloc(importedBytes.length);if(!livePtr)throw new Error("Not enough memory.");
            try{live.HEAPU8.set(importedBytes,livePtr);if(live._sm64web_import_save_buffer(livePtr,importedBytes.length)!==1)throw new Error("Save file is incompatible with this build.");}
            finally{live._free(livePtr);}
            status("Save loaded.");
          }catch(e){status("Save apply failed: "+e.message);}
        },1200);
      }catch(e){status("Load failed: "+e.message);}
      picker.value="";
    };
    reader.readAsText(file);
  });
  var btn=document.getElementById("sm64web-fullscreen");
  function sync(){btn.textContent=(document.fullscreenElement===stage)?"Exit fullscreen":"Fullscreen";}
  btn.addEventListener("click",function(){if(document.fullscreenElement){if(document.exitFullscreen)document.exitFullscreen();}else if(stage.requestFullscreen){stage.requestFullscreen().catch(function(){stage.classList.add("sm64web-fullscreen-fallback");});}else stage.classList.add("sm64web-fullscreen-fallback");});
  document.addEventListener("fullscreenchange",sync);sync();
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",setup);else setup();
})();