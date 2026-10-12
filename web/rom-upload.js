/* Local-only ROM picker for the experimental Emscripten build.
 * The selected file is written into this browser tab's virtual filesystem;
 * it is never uploaded to a server. */
(function () {
  var Module = window.Module = window.Module || {};
  var previousPreRun = Module.preRun || [];
  if (!Array.isArray(previousPreRun)) previousPreRun = [previousPreRun];

  Module.preRun = previousPreRun.concat(function () {
    var dependency = "sm64web-rom-upload";
    addRunDependency(dependency);

    var panel = document.createElement("section");
    panel.id = "sm64web-rom-panel";
    panel.style.cssText = "position:fixed;z-index:99999;inset:0;background:#17202a;color:#fff;display:flex;align-items:center;justify-content:center;font:16px system-ui,sans-serif;padding:24px;box-sizing:border-box";
    panel.innerHTML = '<div style="max-width:520px;width:100%;background:#263746;border-radius:14px;padding:28px;box-sizing:border-box;box-shadow:0 12px 40px #0008"><h1 style="margin-top:0">sm64web</h1><p>Choose your own legally obtained Super Mario 64 ROM to start the game.</p><p style="font-size:14px;color:#cbd5e1">Your file is read locally in this browser tab and is not sent to a server. This experimental build currently checks for the North American US ROM.</p><label for="sm64web-rom-file" style="display:block;margin:20px 0 8px;font-weight:600">Select ROM file</label><input id="sm64web-rom-file" type="file" accept=".z64,.n64,.v64,application/octet-stream" style="max-width:100%"><p id="sm64web-rom-status" role="status" style="min-height:24px;color:#ffd166">Waiting for ROM…</p></div>';
    document.body.appendChild(panel);

    var picker = panel.querySelector("#sm64web-rom-file");
    var status = panel.querySelector("#sm64web-rom-status");
    picker.addEventListener("change", function () {
      var file = picker.files && picker.files[0];
      if (!file) return;
      status.textContent = "Reading " + file.name + "…";
      var reader = new FileReader();
      reader.onerror = function () { status.textContent = "Could not read that file. Try selecting it again."; };
      reader.onload = function () {
        try {
          var bytes = new Uint8Array(reader.result);
          FS.writeFile("/sm64-upload.z64", bytes);
          status.textContent = "ROM loaded. Starting game…";
          picker.disabled = true;
          removeRunDependency(dependency);
          panel.remove();
        } catch (error) {
          status.textContent = "Could not load the ROM: " + (error && error.message ? error.message : error);
        }
      };
      reader.readAsArrayBuffer(file);
    });
  });
})();