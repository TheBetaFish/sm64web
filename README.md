# sm64web

<p align="center">
  <img src="https://github.com/TheBetaFish/sm64web/raw/ci/emscripten-web-build/textures/segment2/custom_coopdx_logo.rgba32.png" alt="sm64coopdx Logo" width="400">
</p>

<p align="center">
  <strong>An experimental, vibe-coded fork of sm64coopdx exploring Super Mario 64 in the web browser.</strong>
</p>

<p align="center">
  <a href="https://thebetafish.github.io/sm64web/">Website</a> ·
  <a href="https://github.com/TheBetaFish/sm64web/issues">Report a Bug</a> ·
  <a href="https://github.com/coop-deluxe/sm64coopdx/wiki">Wiki</a>
</p>

---

## About

**sm64web** is an experimental project that aims to bring [sm64coopdx](https://github.com/coop-deluxe/sm64coopdx) to the web, allowing Super Mario 64 to run directly in a browser using WebAssembly and Emscripten.

This repository is a **vibe-coded fork** focused on experimenting with browser compatibility, adapting the existing codebase for web-based execution, and figuring out what it takes to bring a native PC game to the browser.

Rather than starting from scratch, sm64web builds on the work of the Coop Deluxe Team and the developers who came before them. The goal is to preserve as much of the original project's functionality as possible while working through the technical challenges of running it on the web.

**This project is experimental and actively being worked on.** Browser compatibility, game startup, graphics, audio, filesystem access, and other features may not work correctly yet. A successful build does not necessarily mean the game is playable.

## Project Goals

- **Run in the browser:** Compile sm64coopdx to WebAssembly using Emscripten.
- **No traditional desktop installation:** Work toward launching the game directly from a website.
- **Preserve the original project:** Reuse the existing engine, features, and code wherever practical.
- **Fix browser compatibility issues:** Adapt platform-specific functionality for browser environments.
- **Keep experimenting:** Test ideas, troubleshoot build failures, and improve the web port over time.

These are goals, not guarantees that every feature currently works.

## Play Online

Visit the experimental website:

**https://thebetafish.github.io/sm64web/**

The website is intended to host the browser version of the project. It may currently be incomplete, fail to start, or encounter runtime errors while development continues.

A compatible Super Mario 64 ROM may be required. No copyrighted game ROM is intentionally provided by this repository; users are responsible for obtaining and using game files lawfully.

## How It Works

sm64web adapts the existing C/C++ codebase for browser execution using web technologies.

| Technology | Purpose |
|---|---|
| C and C++ | Original game and engine code |
| Emscripten | Compiles native code to WebAssembly |
| WebAssembly | Executes compiled game code in the browser |
| SDL2 | Provides platform and input functionality |
| WebGL / OpenGL ES | Provides browser-compatible graphics |
| GitHub Actions | Automates builds and deployment |
| GitHub Pages | Hosts the experimental website |

The browser port requires changes beyond simply compiling the original game. Native filesystem behavior, graphics initialization, audio, the main game loop, and other platform-specific systems may need additional adaptation.

## Project Status

**Experimental — work in progress.**

The current priority is getting the game to initialize and run reliably in a browser. Build success alone is not enough: runtime behavior must also be tested.

Potential issues include:

- Startup crashes and missing filesystem paths.
- ROM discovery and asset loading.
- Shader compilation and WebGL compatibility.
- Audio initialization requiring user interaction.
- Browser memory limitations and performance.
- Features that depend on native operating-system functionality.

Contributions, bug reports, and testing are welcome.

## Development

The project uses GitHub Actions to build the experimental WebAssembly version and deploy the website.

To explore the source code or help with development:

1. Browse the [repository](https://github.com/TheBetaFish/sm64web).
2. Check the [Actions tab](https://github.com/TheBetaFish/sm64web/actions) for build and deployment results.
3. Review the existing source code and workflow files before making changes.
4. Report reproducible bugs through [GitHub Issues](https://github.com/TheBetaFish/sm64web/issues).

Browser-porting work is ongoing, so build instructions and dependencies may change as the project develops.

## Documentation and Resources

- **[sm64coopdx upstream repository](https://github.com/coop-deluxe/sm64coopdx)** — the original project this fork builds upon.
- **[Lua documentation](https://github.com/TheBetaFish/sm64web/blob/ci/emscripten-web-build/docs/lua/lua.md)** — documentation for the game's Lua modding API.
- **[C documentation](https://github.com/TheBetaFish/sm64web/blob/ci/emscripten-web-build/docs/c/c.md)** — C API documentation.
- **[sm64coopdx Wiki](https://github.com/coop-deluxe/sm64coopdx/wiki)** — additional information and community resources.
- **[Official Discord](https://discord.gg/TJVKHS4)** — community discussion for the upstream project.

## Credits and Acknowledgments

This project would not exist without the work of the original developers.

- **[Coop Deluxe Team](https://github.com/coop-deluxe)** — developers and maintainers of sm64coopdx.
- **[djoslin0](https://github.com/djoslin0)** — creator of sm64ex-coop, the predecessor that sm64coopdx continues.
- **[sm64coopdx contributors](https://github.com/coop-deluxe/sm64coopdx/graphs/contributors)** — contributors whose work makes this project possible.
- **Emscripten and WebAssembly communities** — tools and technologies enabling native code to run in browsers.

sm64web is an independent experimental fork. It is not an official browser release of sm64coopdx and should not be confused with the upstream project's official builds.

## Contributing

Found a bug, have an idea, or want to help make the browser port work?

- Open an [issue](https://github.com/TheBetaFish/sm64web/issues).
- Review existing [build workflows](https://github.com/TheBetaFish/sm64web/actions).
- Submit a pull request with a clear description of the change and how it was tested.

Because this is an experimental, vibe-coded project, some code and implementation decisions may be rough or temporary. Testing, constructive feedback, and improvements are appreciated.

## License and Legal

Please refer to the repository's license and the upstream [sm64coopdx repository](https://github.com/coop-deluxe/sm64coopdx) for applicable licensing information.

Super Mario 64 and its associated intellectual property belong to their respective rights holders. This project is an independent technical experiment and is not affiliated with or endorsed by Nintendo.

---

<p align="center">
  <em>Reimagining a classic for the browser, one experimental build at a time.</em>
</p>
