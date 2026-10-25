# Browser integration

This fork includes a client-side pMARS WebAssembly engine, an incremental canvas
display, and a worker for assembly and headless match series. No server-side
simulation, framework, SDL, SharedArrayBuffer, or cross-origin
isolation headers are required.

## Build and preview

Activate an [Emscripten SDK](https://emscripten.org/docs/getting_started/downloads.html)
(tested with 4.0.23), then run from the repository root:

```sh
python3 docs/build.py
python3 -m http.server 8765 --bind 127.0.0.1
```

Open http://127.0.0.1:8765/docs/. Use HTTP, not file://. On Windows, set
`EMCC` to the absolute path to `emcc.bat` if the SDK is not on PATH.
Generated `docs/dist/pmars.mjs` and `pmars.wasm` are committed for static hosting.
The browser does not require Emscripten to be installed.

## GitHub Pages deployment

The self-contained `docs/` directory includes the Wasm runtime, license,
`.nojekyll`, and a corresponding-source download (`pmars-source.zip`).
The build script refreshes these artifacts; commit them whenever engine or
browser source changes. Serve over HTTP with JavaScript and WebAssembly MIME
types. No build tools or backend are needed on the host.

For GitHub Pages, select the branch containing these artifacts and **/docs** in
Settings → Pages, or deploy the `build-wasm` ZIP artifact from the release
workflow to a static host. Use the host's project URL; this repository does not
configure a custom domain or deploy automatically. The old `/web/` preview URL
redirects to `/docs/` when serving the repository root.

## Match settings

The visible summary describes the editable next match. **Edit settings** opens
the full form. Rounds, Run/Pause, Step, Reset, Debug, Fast, cycle count, and speed share the arena toolbar. Layout, cell size, and theme sit above the arena.
The form supports the native options `-r -s -b -c -V -p -k -l -8 -d -f -F -o -S -P -A -=`.
Native parsing, assembly, positioning, scoring, and output are shared with pMARS.
Filesystem options are deliberately unavailable. Fixed-series placement
(`-f`) defaults off, including in all presets. Enable it explicitly for
repeatable placement. Entering `-F` also disables it.
Permutation requires two warriors. Zero rounds and assemble-only both assemble
without running a battle.

Preset choices fill the editable form: standard pMARS, KotH '94 no-P-space,
KotH '88, SAL nano, tiny, tiny limited-process, and KotH '94 experimental.
These are historical rule references, with source links in the UI, not claims
about currently operating servers. The no-P-space preset rejects PIN, LDP,
and STP after assembly.

The native console sits below the battle controls and is collapsed by default.
Click its heading to show/hide it; per-warrior Validate and compilation failures
open it automatically. Clear output beside the console heading clears the console without toggling it; starting a new battle
or series also clears it. Validation is optional: Run assembles automatically. Validate checks just that warrior with the current match
settings (including warrior count), always prints its listing, and preserves
the active battle. Buttons show success/failure and reset when inputs change.
All warriors are validated on page load and one second after the latest source
or settings edit, one worker at a time. Editing cancels stale checks. Automatic
validation updates labels without opening the console; the ↻ Validate/Valid button revalidates
immediately and opens the output. Run battle also reports the failing warrior. The console includes assembly listings,
diagnostics, and final native results. Brief, verbose, KotH output, sorting,
and score formula settings affect this output. Its retained text is bounded
to 256 KiB; diagnostics retain 64 KiB.

## Controls

- Add/remove warriors: supports 1–36, including solo debugging. Use New warrior below the editors to create an
  editable warrior, upload one or multiple files, or drop files on the upload
  area below the editors. Each editor has a Download button. Existing and imported editors start collapsed; New warrior opens its editor.
  The arrow before its name hides or opens
  its source textarea. One Collapse all / Expand all toggle controls every editor without changing
  sources or validation status. Editor headings
  update from the source's `;name` directive while typing. An active battle's
  legend and traces retain the loaded names until Reset.
  Changes to loaded sources/settings are marked as pending until Reset.
- Run battle: assemble in a worker and animate the configured number of rounds. Use Reset to load paused before instruction one, like the native `-e` option.
  Before the first instruction (including after Reset), the button says Run
  battle and applies any edits made since loading. After execution begins it
  says Resume battle and preserves the loaded settings. The active cycle limit
  is displayed separately from the editable setting.
- Pause suspends scheduling. Step executes one warrior instruction, not a full
  cycle through all warriors. Step can also load a fresh match.
- Reset explicitly reloads current sources/settings and pauses at instruction zero.
- Stop cancels assembly/series work or releases the visual engine.
- Instructions / second: choose 1–100,000; this is a target, not a guarantee.
- Cell size defaults to 8 CSS pixels. Classic uses a 2×2 mark with 2 pixels
  of inter-cell spacing (4-pixel pitch), matching native SDL modes 0/1.
  Compact uses a 4×4 mark with 2-pixel spacing (6-pixel pitch, native mode 3).
  These are CSS pixels, scaled by the browser/device pixel ratio. Choose 12, 16, or 24 pixels for larger
  markers, or Auto for an overview using even whole-pixel cell sizes. Layout offers:
  Scroll vertically (fit columns to width, scroll inside a bounded-height panel),
  Scroll horizontally (fit rows to a bounded height, scroll sideways inside the
  panel), Fill vertically (fit columns to width and grow down the page), and
  Fill horizontally (fit rows to height and extend across the page).
  Layout is a page control above the emulator: CSS sets the container constraints,
  and the display reads its actual inner width/height to choose rows and columns.
  Horizontal layouts use at least the available width, even when the core fits.
  Cell-size and container-size changes recompute the grid without changing memory.
  Automatic sizing redraws using even whole CSS pixels rather than stretching.
  Very large arenas retain their full scroll extent but paint a movable canvas
  window to avoid oversized bitmap allocations; no horizontal fallback is used.
  Changing size preserves memory marks and battle state.
- Hover over the arena to see the address under the pointer beside the size
  selector. Leaving or scrolling clears the indicator.
- Click the arena to pause and list from that address. Right-click lists up to
  the clicked address. Listings default to ten lines, with addresses, wraparound,
  and next-PC markers. Use cdb `list start,end` for other ranges.
- Consoles: choose cdb, all warriors, or a named warrior in each panel. Add, pause,
  or remove panels independently. Execution entries show instructions before
  operand evaluation or writes.
  Histories retain 100 entries per warrior and 300 combined. Text refreshes
  at most 10 times per second while running; Pause/Step refresh immediately.
- Run and Fast use the rounds field. Fast suppresses visual updates; Run/Pause
  preserves the loaded match and P-space. The worker API remains available to
  integrations, but there is no separate series button.

### Native cdb and macros

The browser command line now runs `src/cdb.c`, with the real expression parser,
command chains (`~`), repeat loops (`!`), conditionals, core editing, process queues,
P-space inspection, tracing, and macro interpreter. Both `config/pmars.mac` and
`config/mw.mac` are embedded in the WebAssembly filesystem and preloaded.
`macro f7` and `macro alive` execute their original definitions. Native `macro , user`
accepts custom macro definitions through the command field, ending with `.`.
The bundled `tproc` macro also has a dangling multiplication operator corrected
so that it reports the total process count.

Native semantics apply: `step 10` executes at **address 10**, not ten instructions.
Debugger output accumulates in a scrolling history, following the newest output.
Commands appear in a separate, scrollable history beside the command field. Clicking
a history entry executes it again. Empty Enter records the actual command recalled
by native cdb, including its leading-space rules. Screen clears inside macros preserve
the output history; an explicit `cls` or loading/resetting a battle clears it.
Use `step~!10` or `skip 9` for ten instructions. Empty Enter recalls the last native
command chain; leading whitespace retains cdb's no-recall behavior. `help` lists
native commands; paged output, `edit`, and `fill` ask for their next input in the
same field. Native `reset` resets the command chain; toolbar Reset (or the browser
convenience command `reset battle`) reloads sources and clears the match.

The adapter uses Emscripten Asyncify to suspend interactive input and yield during
macro loops and long listings. While a native operation is active the Run button
becomes Cancel; simulation cannot reenter the same instance. Step/skip requests
advance through the existing bounded simulation slices. Native `go` chains resume
at breakpoints, warrior deaths, and round boundaries. Completed matches remain
available for native inspection.

Native files are temporary, per-match Emscripten files, not host files. The default
macro files are available by name; `write filename` writes a virtual log file.
Shell commands are explicitly unavailable. Native text-panel switching retains
separate cursor positions but shares one browser output view. Platform graphics
commands are handled by the browser controls, not by a native terminal display.
These are browser adaptations, not a claim of byte-for-byte terminal UI equivalence.

The display uses native pMARS quadrant markers in warrior colors: read marks
the top-left quarter, write marks the top-right and bottom-left quarters,
decrement marks the top half, increment marks the left half, and execution
marks the whole cell. Unaffected quarters retain their previous owner.
Full-cell marks are solid. A border separates neighboring cells, but there
are no internal gaps between a cell’s four quadrants. Every address has
a faint background: dark cells still contain memory (initially DAT 0, 0);
activity markers do not indicate whether memory is empty. Padding after the
last address is not selectable. The legend illustrates these shapes. A white outline marks each warrior's
last execution address. Modern, pMARS classic, and accessible palettes are
selectable. It redraws only
dirty cells except when initializing a round or resizing. All activity events
are consumed in order; multiple operations at the same cell within one browser
frame end with that frame's final visual state. Slow down or step to examine
individual instructions. This prototype does not animate the separate operand
operations within one instruction across multiple frames.

Process history and cumulative series-score charts retain at most 300 samples.
Per-warrior process counts sit beside the warrior names below the arena, use fixed-width
fields with tabular digits, and share the process chart’s pause
control, including the global pause. Pausing skips process-count DOM updates;
score rows also avoid rebuilding when their values are unchanged.
The process chart uses the current round’s cycle number, resets each round,
and samples at most ten times a second. Each chart and each
console can be paused independently; **Pause live views** pauses
both charts and execution logging while simulation continues. Turning execution
logs off, or pausing all of them, disables native trace capture. Series runs
skip display events and instruction traces. Completed battle totals are shown
for the current run and the current page session.

## Responsiveness

The animation loop uses requestAnimationFrame. Each advance call stops at:

1. Its instruction budget.
2. Its soft wall-clock budget (4 ms in the demo, checked every 64 instructions).
3. The event buffer's safety margin, or the 512-entry execution trace limit.
4. A round boundary or match completion.

A whole instruction always finishes before yielding. The time bound is a soft
budget, not a real-time guarantee: OS scheduling, garbage collection, WebAssembly
initialization, drawing, and core initialization can add latency. The demo caps
catch-up work after slow frames and pauses visual scheduling in hidden tabs.
It does not accumulate an unbounded backlog.

User source assembly runs exclusively in the demo's worker, has a 64 KiB input
limit per warrior, and a 15-second timeout. Stop also cancels it. Only compiled
banks, at most 1000 instructions per warrior, cross to the main thread.
Headless series use the same stepping API without collecting display events.

## JavaScript API

`pmars.mjs` is the public import entry point; `engine.mjs` wraps the exported C API.
See [INTEGRATION.md](INTEGRATION.md) for downloadable packages and version-pinned
imports in other apps. Each Engine owns one isolated Wasm
instance. Create a new Engine to reset or load another match; dropping references
allows the browser to collect it. Do not reuse an instance for a second match.

```js
import {Engine} from './pmars.mjs';

// In an assembly worker:
const compiler = await Engine.create(options, {visual: false, log: console.log});
const banks = compiler.compile([firstSource, secondSource]);
// postMessage banks back to the page (worker.mjs is a complete example).

// On the page:
const engine = await Engine.create(options);
engine.import(banks);
engine.setTrace(true); // optional pre-execution snapshots
display.apply(engine.start().events);

// In requestAnimationFrame:
const update = engine.advance(100, 4);
display.apply(update.events);
console.log(update.executed, update.round, update.completed, update.done, update.warriors);
console.log(update.trace); // {warrior, address, instruction} in execution order
console.log(engine.inspect(123));
```

The banks are internal data produced by this exact build with these same match
settings. They are not a portable save format or an interface for untrusted
binary input. Core-size-dependent assembly assertions and instruction fields
are resolved by the compiler worker.

Settings and bounds:

| Setting | Default | Allowed |
|---|---:|---:|
| coreSize | 8000 | 80–65536 |
| rounds | 1 | 0–2147483647 |
| cycles | 80000 | 1–10000000 |
| tasks | 8000 | 1–65536 |
| warriors | 2 | 1–36 |

Additional settings are defined in `settings.mjs`: maxLength (1–1000,
default 100), distance (0–65536, zero selects native default), pspace
(0–coreSize, zero selects native default), and the flags/text options described
above. These are browser resource bounds, not unrestricted native limits.
Source/bank count must match settings.warriors. The core must fit at least
max(2, warrior count) times max(maxLength, distance). ICWS '94 extensions
and P-space are enabled unless the selected rules restrict them.

`start()` returns initial loaded cells. `advance(n, milliseconds)` accepts
1–100000 instructions and a time budget greater than zero and at most 8 ms.
It may execute fewer instructions; use `executed`, not the requested count.
A round initialization can return zero executed instructions with load events.
Final core memory remains inspectable after completion.

Each update contains a copied Uint32Array with four words per event:
`[kind, address, warriorIndex, value]`. Copies survive later calls and Wasm
memory growth. No JS callback or worker message is made for each memory access.

| Kind | Meaning | value |
|---:|---|---|
| 0 | Reset display for new round | Round number (1-based) |
| 1 | Initial warrior cell loaded | 0 |
| 2 | Instruction execution | 0 |
| 3 | Read activity | 0 |
| 4 | Write activity | 0 |
| 5 | Decrement activity | 0 |
| 6 | Increment activity | 0 |
| 7 | Process count changed | New process count |
| 8 | Warrior eliminated | 0 |
| 9 | Round completed | Round number (1-based) |

Addresses and warrior indices are zero-based. Addresses on reset, process
count, and round events need not indicate a memory change. Events follow the
existing simulator display hooks, including operand evaluation before the
execution hook; they are an activity stream, not snapshots of instruction data
or P-space writes. Use inspect() at a paused boundary for actual core contents.
Results expose each warrior's name, process count, next PC (-1 if dead), wins,
ties, losses, native score, and native survivor-count outcome bins. A multiwarrior
tie means surviving with at least one other warrior. Solo summaries distinguish
survived versus terminated rounds, since native solo score bins do not distinguish
those cases. `completed` explicitly counts completed rounds for progress reporting.

`setTrace(true)` enables pre-execution instruction text snapshots independently
of display events; the API defaults to tracing off. `trace` is bounded per advance
call and retains exact order across calls. The UI truncates old history as described
above. Turn tracing off for maximum simulation throughput.

## Tests

```sh
node docs/test-engine.mjs /path/to/native/pmars-server
node docs/test-options.mjs /path/to/native/pmars-server
node docs/test-native-cdb.mjs
node docs/test-assembly.mjs
python security/test_security.py /path/to/native/pmars-server
python security/test_096.py /path/to/native/pmars-server
# With the preview server running and Playwright installed:
node docs/test-browser.mjs
node docs/test-debugger.mjs
node docs/test-controls.mjs
node docs/test-features.mjs
node docs/test-feedback.mjs
node docs/test-layout.mjs
```

The engine suite checks native deterministic score parity, exact ordered event
parity between one-instruction and large slices, full final-core parity, worker
bank import, shared P-space, core-size limits, solo and 3/4/36-warrior matches,
self-modification snapshots, and invalid inputs. Browser tests
exercise pause/resume, exact stepping, cancellation/restart, assembly errors,
a 1001-round worker series, uploads/drop/download, presets, native output,
chart/log pausing, themes, mobile layout, and a page heartbeat at maximum speed.
The options suite compares assembly and final output against native pMARS
across 12 configurations, including permutation, '88, fixed positions,
verbose output, assemble-only, and custom scoring.

Optional browser-test environment variables: `BROWSER_CHANNEL=msedge`,
`PLAYWRIGHT_MODULE=/absolute/path/to/playwright/index.mjs`, and `PMARS_URL`.
Generated screenshots and test files go into ignored `docs/test-output/`.

Native displays remain selected by their existing build flags. The new
`BROWSER` build uses `SERVER` to prevent blocking stdin/debugger interaction.
Only the scheduling boundaries and selected persistent loop locals differ in
sim.c; the instruction execution switch remains shared.

Cycle limits use native pMARS semantics: a cycle gives each living warrior an
instruction. With two survivors, a limit of 10 ends after 20 total instructions.
Changing settings after execution begins requires Reset; changing them before
the first instruction is applied by Run.

The main readout shows the current cycle: zero before execution, one while
each living warrior takes its first turn, and so on. Cycle counting follows
the scheduler and resets each round, including after warrior elimination.
Step and execution-log sequence numbers still count individual instructions.
The speed control also retains its explicit instructions/second unit.

### Compact battle controls

Run and Fast both use the configured number of rounds. Fast suppresses canvas,
charts, and instruction tracing, removes the speed throttle, and still yields
between short simulation slices. Run changes to Pause; pausing Fast restores
visual updates. Reset reloads edited sources/settings and pauses at instruction
zero. A hidden tab suspends this execution; the former separate worker-series
buttons are no longer exposed. The worker API remains available for integrations.

Debug enables stopping at native `;break` / `;trace` markers (enabled with
`;debug`) before execution. Step executes the held instruction. Diagnostics,
including peak simulation slice time, are collapsed by default.

### Clickable debugger instructions

Instruction rows show the core address and instruction, without execution numbers.
Click a row in the core listing or execution logs to pause and toggle a breakpoint
at that address. A filled dot marks a breakpoint; adding one enables debug stopping.
Run stops before execution; Step passes through the current breakpoint. Address
breakpoints persist across writes and rounds in the loaded match, and Reset clears
them. Source `;break`/`;trace` markers can also be toggled for the loaded address.

The All warriors console shows a combined, warrior-colored execution history
(latest 300 snapshots). The cdb console retains debugger output and explicit core
inspections; Run and the toolbar Step do not replace it with execution history. Fast and Pause all views suspend the
live listing along with the other execution views.

### Configurable consoles

The debugger and executed-instruction views share one console grid. Each console's
selector offers `cdb`, `All warriors`, and the loaded warriors' names. Add console
creates another panel; its pause and remove buttons affect only that panel.
Multiple consoles may show the same source. Panels wrap into a single column on
small screens. Executing a debugger command or inspecting the arena creates a cdb
panel if all cdb panels have been removed. Execution views retain warrior colors
and clickable breakpoints. Fast mode and the global pause still suppress live views.

### Source editor

Warriors use a local CodeMirror 6 bundle with a reusable adapter in
`docs/editor-source.mjs`. It includes Redcode syntax highlighting, line numbers,
undo/redo, bracket matching, and Ctrl/Cmd-F search. Tab inserts a tab at the cursor, or indents selected lines; Shift+Tab unindents. Existing delayed validation marks compiler errors and warnings in the
source gutter. Click a source diagnostic in the pMARS console to expand the warrior
and select the reported line. Line numbers come from pMARS; macro-expansion
locations are limited to what the compiler reports.

The editor runs entirely from the static site, with no CDN requests. To rebuild
it after changing the adapter or dependencies, run `npm ci`, `npm run build:editor`,
then `python3 docs/build.py` with Emscripten configured. Dependency versions are
locked; `docs/dist/editor-LICENSES.txt` ships their license notices. The checked-in
bundle allows ordinary Wasm builds and GitHub Pages deployment without npm.

Eliminated warriors have a red multiplication-sign cross (a text glyph, not a third-party icon asset) overlaid on their colored legend square. This does not shift the name or process count.

### Demo choices

With no warriors loaded, **Try a demo** offers Dwarf vs Imp, Random duel, and
Multiwarrior. Each loads its sources and starts a standard match. Random duel
chooses two distinct entries from `warriors/*.red`; Multiwarrior loads all entries.
`validate.red` is excluded. `docs/build.py` regenerates `docs/demo-warriors.mjs`
from that directory, so the demos also work on a static GitHub Pages deployment.

The Editor theme selector above the warriors offers Dark, Light, and High contrast palettes, independently of arena colors. The choice persists in local browser storage; switching it preserves source, selections, and undo history. Both the pencil beside a warrior name and the disclosure arrow toggle its editor. The ↔ control expands an open editor across the full roster width and restores it; drag its bottom-right resize handle to change its height.

Syntax colors (Ocean, Warm, Monochrome) are selected independently of the editor background. Palettes adapt to light/dark backgrounds, and both choices are remembered locally.

Completed battle results appear directly below the arena, with scores and win/tie/loss counts. Single battles name the outcome; completed series identify the highest-scoring warrior(s). Reset clears the results and pauses before instruction one; Run starts execution directly.
