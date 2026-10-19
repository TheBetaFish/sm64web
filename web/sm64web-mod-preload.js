(function () {
  "use strict";
  // This script is loaded before sm64coopdx.js. Emscripten runs preRun after
  // mounting its virtual filesystem but before native main()/mods_init().
  var Module = window.Module = window.Module || {};
  Module.preRun = Module.preRun || [];
  Module.preRun.push(function () {
    var FS = Module.FS;
    if (!FS) {
      console.warn("[SM64 Web Mods] Emscripten FS was not exported; saved mods cannot be preloaded.");
      return;
    }
    var mods;
    try {
      mods = JSON.parse(localStorage.getItem("sm64web-user-lua-mods-v1") || "[]");
    } catch (_) {
      mods = [];
    }
    if (!Array.isArray(mods) || !mods.length) return;

    // SDL_GetPrefPath("", "sm64coopdx") resolves to this Emscripten user-data
    // directory in the browser build. This is the native mods.c write path.
    var modsPath = "/home/web_user/.local/share/sm64coopdx/mods";
    try {
      FS.mkdirTree(modsPath);
      mods.forEach(function (mod) {
        if (!mod || typeof mod.name !== "string" || typeof mod.source !== "string") return;
        if (!/^[a-zA-Z0-9 _.-]+\.lua$/.test(mod.name) || mod.name.indexOf("..") !== -1) return;
        var bytes = new TextEncoder().encode(mod.source);
        FS.writeFile(modsPath + "/" + mod.name, bytes);
      });
      console.info("[SM64 Web Mods] Preloaded " + mods.length + " saved Lua mod(s).");
    } catch (error) {
      console.error("[SM64 Web Mods] Could not preload saved mods:", error);
    }
  });
})();