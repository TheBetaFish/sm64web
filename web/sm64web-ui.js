(function(){
"use strict";
function setup(){
  var canvas=document.getElementById("canvas");
  if(!canvas||document.getElementById("sm64web-stage"))return;
  var header=document.createElement("header");header.id="sm64web-header";
  header.innerHTML='<div class="sm64web-brand"><span class="sm64web-mark">64</span><div>sm64web<div class="sm64web-subtitle">Experimental browser build</div></div></div><span class="sm64web-status">LOCAL ROM · SOLO PLAY</span>';
  var stage=document.createElement("main");stage.id="sm64web-stage";stage.setAttribute("aria-label","Super Mario 64 game viewport");
  var controls=document.createElement("footer");controls.id="sm64web-controls";
  controls.innerHTML='<div class="sm64web-control-group"><span>Keyboard controls depend on the active game screen.</span></div><div class="sm64web-control-group"><button class="sm64web-control" id="sm64web-fullscreen" type="button">⛶ Fullscreen</button></div>';
  canvas.parentNode.insertBefore(header,canvas);
  canvas.parentNode.insertBefore(stage,canvas);stage.appendChild(canvas);
  stage.parentNode.insertBefore(controls,stage.nextSibling);
  var btn=document.getElementById("sm64web-fullscreen");
  function sync(){btn.textContent=(document.fullscreenElement===stage)?"Exit fullscreen":"⛶ Fullscreen";}
  btn.addEventListener("click",function(){
    if(document.fullscreenElement){if(document.exitFullscreen)document.exitFullscreen();}
    else if(stage.requestFullscreen){stage.requestFullscreen().catch(function(){stage.classList.add("sm64web-fullscreen-fallback");});}
    else {stage.classList.add("sm64web-fullscreen-fallback");}
  });
  document.addEventListener("fullscreenchange",sync);
  window.addEventListener("resize",function(){window.dispatchEvent(new Event("resize"));});
  sync();
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",setup);else setup();
})();