# pMARS AI

pMARS AI is an AI-assisted development fork of **pMARS 0.9.6-dev**, the portable
Core War assembler, simulator and programmable debugger. It runs ICWS '94
Redcode with '88 compatibility, including multi-line EQU, FOR/ROF and P-space.
The original authors and GPL license are retained in [AUTHORS](AUTHORS) and
[COPYING](COPYING). “AI” describes the development workflow; running pMARS does
not require an AI model, account or network service.

## What this fork adds

Compared with the imported upstream 0.9.6-dev source:

| Area | Additions |
| --- | --- |
| Input handling | Bounded assembler expansion and recursion, checked expression arithmetic, safer token/option parsing, allocation cleanup and PIN-sharing fixes. Native console and server builds use compiler/linker hardening. |
| Assembler compatibility | Flat token scans no longer exhaust the nesting budget. Numb and long EQU expressions have regression coverage alongside malformed-input tests. |
| Placement correctness | Correct RC5 rotations for text `-F` seeds, with round-trip and placement-distribution tests. Text-seeded placements change; numeric seeds retain their existing generator. |
| Native displays | Windows GDI and portable SDL3 displays, high-DPI rendering and mouse input, bundled SDL3 builds and display/event regressions. |
| Installation | Option files and debugger macros can be found relative to the installed executable or data directory; portable packages work outside the source directory. The Tiny LP preset and the `tproc` debugger macro are corrected. |
| Browser / WebAssembly | Emscripten build, canvas arena, Redcode editors, worker-based assembly and match series, pause/step controls, breakpoints, tracing and the native cdb command/macro interpreter. |
| Builds and testing | Native regression CI and release packaging for Windows x64, Linux x64/ARM64 and macOS Intel/Apple Silicon; a tested WebAssembly download in the same release workflow. |

The browser simulator/debugger adaptations are enabled with `BROWSER`; the native
builds retain their existing paths and do not require Node.js or Emscripten.
The browser reuses the C interpreter and debugger; the AI fork does not add
exMARS simulation optimizations.

## Downloads

Use [GitHub Releases](https://github.com/pmars-org/pmars-ai/releases) for published
versions, or the **Build release binaries** workflow's artifacts for development
builds. Each platform ZIP includes matching source, warriors and configuration:

- `pmars`: console simulator with cdb.
- `pmars-server`: headless simulator without the interactive debugger.
- `pmars-sdl3`: graphical SDL3 version.
- `pmars-gdi.exe`: Windows GDI version.

See [RELEASING.md](RELEASING.md) for platform requirements, individual downloads
and release procedures. `pmars-ai-VERSION-wasm.zip` contains the browser app and
reusable engine modules. Version tags publish it alongside the native downloads;
main pushes and pull requests produce a `build-wasm` Actions artifact.

## Build and run natively

From the repository root, with a C compiler and GNU Make:

```sh
make -C src default
make -C src server
./src/pmars -@ 94nop.opt warriors/sunset.red warriors/excalibur.red
```

For graphics, use `make -C src sdl` (CMake 3.21+ and C++ required), or
`mingw32-make -C src gdi` on Windows with MinGW-w64. Plain `make -C src` prints
help. Native builds use the bundled SDL3 source by default. See
[BUILD-DISPLAYS.md](BUILD-DISPLAYS.md) for dependencies, system SDL3, debugging,
configuration lookup and additional targets. Executables are stripped by default;
`NO_STRIPPING=1` preserves their symbols without removing cdb functionality.

## Run or rebuild the browser version

The committed `docs/dist/` artifacts can be served directly, without a compiler:

```sh
python3 -m http.server 8765 --bind 127.0.0.1
```

Open [http://127.0.0.1:8765/docs/](http://127.0.0.1:8765/docs/).
Use HTTP rather than opening `index.html` as a file.

To rebuild, activate Emscripten **4.0.23** and run:

```sh
python3 docs/build.py
```

Set `EMCC` to the compiler path if it is not on PATH (`emcc.bat` on Windows).
Only editor-source or dependency changes require Node.js and:

```sh
npm ci
npm run build:editor
python3 docs/build.py
```

The build refreshes the WASM module, cache-versioned browser assets, demo warriors
and corresponding-source archive. Deploy the complete `docs/` directory together;
rebuilding does not publish a site. No backend, SharedArrayBuffer or special
cross-origin isolation headers are required.

To embed the engine in another web app, use the public `docs/pmars.mjs` entry
point. See [the integration guide](docs/INTEGRATION.md) for self-hosting, worker
examples and version-pinned CDN imports.

See [docs/README.md](docs/README.md) for the JavaScript/worker API, match settings,
debugger behavior, static hosting and browser tests. Browser-specific constraints
include a 64 KiB source limit per warrior and virtual filesystem access; native
shell commands are unavailable in the browser.

## Tests

```sh
make -C src check check-console
make -C src check-sdl
node docs/test-engine.mjs src/pmars-server
node docs/test-options.mjs src/pmars-server
node docs/test-native-cdb.mjs
node docs/test-assembly.mjs
```

The WASM tests require Node.js and a built or committed WASM module. Additional
Playwright tests exercise the browser UI and workers; see the browser guide.
Windows GDI tests use `make -C src check-gdi`. The security suite tests malformed
inputs and compatibility; its budgets are not a complete CPU/memory sandbox.
See [security/REVIEW.md](security/REVIEW.md) for scope and limits.

## Documentation and contributing

- [Original README](README): upstream overview and historical context.
- [Redcode reference](doc/redcode.ref), [Redcode primer](doc/primer.94) and
  [cdb primer](doc/primer.cdb).
- [Contribution guidelines](CONTRIB) and [AI commit attribution](AGENTS.md).

Keep native and browser regressions passing when changing shared engine code.
The fork's release notes and Git history describe its additions; the original
[ChangeLog](ChangeLog) is preserved.
