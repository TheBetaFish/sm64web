(function(){
"use strict";
function setup(){
  var canvas=document.getElementById("canvas");
  if(!canvas||document.getElementById("sm64web-stage"))return;
  var header=document.createElement("header");header.id="sm64web-header";
  header.innerHTML='<div class="sm64web-brand"><span class="sm64web-mark">64</span><div>sm64web<div class="sm64web-subtitle">Experimental browser build</div></div></div><span class="sm64web-status">LOCAL ROM · SOLO PLAY</span>';
  var stage=document.createElement("main");stage.id="sm64web-stage";stage.setAttribute("aria-label","Super Mario 64 game viewport");
  var controls=document.createElement("footer");controls.id="sm64web-controls";
  controls.innerHTML='<div class="sm64web-control-group"><span class="sm64web-hint">Progress files stay on your device.</span><button class="sm64web-control" id="sm64web-save" type="button">Save progress</button><button class="sm64web-control" id="sm64web-load" type="button">Load progress</button><input id="sm64web-load-file" type="file" accept=".txt,.json,application/json,text/plain" hidden></div><div class="sm64web-control-group"><button class="sm64web-control" id="sm64web-fullscreen" type="button">Fullscreen</button></div>';
  canvas.parentNode.insertBefore(header,canvas);canvas.parentNode.insertBefore(stage,canvas);stage.appendChild(canvas);stage.parentNode.insertBefore(controls,stage.nextSibling);
  var save=document.getElementById("sm64web-save"),load=document.getElementById("sm64web-load"),picker=document.getElementById("sm64web-load-file");
  function status(message){var hint=controls.querySelector(".sm64web-hint");if(hint)hint.textContent=message;}
  function api(){return window.Module||{};}
  save.addEventListener("click",function(){
    var m=api();
    if(typeof m._sm64web_get_save_buffer!=="function"||typeof m._sm64web_get_save_buffer_size!=="function"){status("Save export is not available in this build yet.");return;}
    try{
      var ptr=m._sm64web_get_save_buffer(),size=m._sm64web_get_save_buffer_size();
      var bytes=new Uint8Array(m.HEAPU8.buffer,ptr,size),hex="";
      for(var i=0;i<bytes.length;i++)hex+=bytes[i].toString(16).padStart(2,"0");
      var blob=new Blob([JSON.stringify({format:"sm64web-save-v1",data:hex},null,2)],{type:"text/plain"});
      var url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download="sm64web-progress.txt";a.click();setTimeout(function(){URL.revokeObjectURL(url);},1000);status("Progress exported.");
    }catch(e){status("Could not export progress: "+e.message);}
  });
  load.addEventListener("click",function(){picker.click();});
  picker.addEventListener("change",function(){
    var file=picker.files&&picker.files[0];if(!file)return;
    var reader=new FileReader();
    reader.onerror=function(){status("Could not read that save file.");};
    reader.onload=function(){
      try{
        var obj=JSON.parse(String(reader.result));
        if(!obj||obj.format!=="sm64web-save-v1"||typeof obj.data!=="string"||obj.data.length%2)throw new Error("Not an sm64web progress file");
        var m=api();if(typeof m._sm64web_import_save_buffer!=="function"||typeof m._malloc!=="function"||typeof m._free!=="function")throw new Error("Save import is not available in this build yet");
        var size=obj.data.length/2,ptr=m._malloc(size);if(!ptr)throw new Error("Not enough memory");
        try{for(var i=0;i<size;i++){var b=parseInt(obj.data.slice(i*2,i*2+2),16);if(!Number.isFinite(b))throw new Error("Invalid save data");m.HEAPU8[ptr+i]=b;}if(m._sm64web_import_save_buffer(ptr,size)!==1)throw new Error("Save file size does not match this game build");}
        finally{m._free(ptr);}
        status("Progress loaded. Return to the save-file menu to check it."); 
      }catch(e){status("Load failed: "+e.message);}
      picker.value="";
    };
    reader.readAsText(file);
  });
  var btn=document.getElementById("sm64web-fullscreen");
  function sync(){btn.textContent=(document.fullscreenElement===stage)?"Exit fullscreen":"Fullscreen";}
  btn.addEventListener("click",function(){if(document.fullscreenElement){if(document.exitFullscreen)document.exitFullscreen();}else if(stage.requestFullscreen){stage.requestFullscreen().catch(function(){stage.classList.add("sm64web-fullscreen-fallback");});}else stage.classList.add("sm64web-fullscreen-fallback");});
  document.addEventListener("fullscreenchange",sync);window.addEventListener("resize",function(){window.dispatchEvent(new Event("resize"));});sync();
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",setup);else setup();
})();