# Use pMARS AI in another web app

`pmars.mjs` is the public ES-module entry point. It exports `Engine`, `settings`,
`defaults`, and `workerURL`. The API supports assembly, bounded simulation slices,
core inspection, debugger commands, and headless series. See [the API reference](README.md#javascript-api).
Each Engine owns a separate WASM instance; create a new one for each match.

## Download and self-host

Tagged releases include `pmars-ai-VERSION-wasm.zip` with the complete browser app,
engine modules, WASM, license notices and corresponding source. Extract it and
copy its `docs/` directory to, for example, `/vendor/pmars/VERSION/` on your host.
Keep the directory structure and all relative imports together. Serve `.mjs` as
JavaScript and `.wasm` as `application/wasm` over HTTP(S).

For a minimal integration, the engine needs `pmars.mjs`, `engine.mjs`,
`settings.mjs`, `worker.mjs`, `dist/pmars.mjs`, and `dist/pmars.wasm`.
Keep `COPYING` and the corresponding `pmars-source.zip` available with your
distribution. The editor/UI is optional; it is not imported by the public entry
point. If you use the editor, retain `dist/editor-LICENSES.txt` too.

```js
import {workerURL} from '/vendor/pmars/VERSION/pmars.mjs';

const worker = new Worker(workerURL, {type: 'module'});
worker.onmessage = ({data}) => {
  if (data.type === 'progress') console.log(data.update.completed);
  if (data.type === 'done') console.log(data.update.warriors);
  if (data.type === 'error') console.error(data.message);
};
worker.postMessage({
  type: 'series',
  settings: {warriors: 2, rounds: 100, cycles: 80000},
  sources: [firstRedcodeSource, secondRedcodeSource]
});
// Cancel a job with worker.terminate(). Each worker closes after its job.
```

Workers also support `compile` and `check` requests, plus `pause`/`resume` during
a series. Assembly/results use the same module version and match settings;
compiled banks are not a portable file format. Keep user-source assembly off the
UI thread. Use `Engine` in your own worker if you need custom scheduling.

## Version-pinned CDN imports

After a release tag containing the built `docs/` assets is pushed to the public
repository, [jsDelivr's GitHub CDN](https://github.com/jsdelivr/jsdelivr#github)
can serve that tag or commit directly. It serves committed files, not files
inside a release ZIP. Replace `TAG_OR_COMMIT` with a real full commit SHA or
release tag; the following is a URL pattern, not an already published version:

```text
https://cdn.jsdelivr.net/gh/pmars-org/pmars-ai@TAG_OR_COMMIT/docs/pmars.mjs
```

Use that URL in an ES-module import or `await import(url)`. Its relative imports
and the WASM fetch remain on the same pinned CDN version. Avoid `@main`, `@latest`
and version ranges in production, and keep every module from one version.

A cross-origin Worker constructor cannot directly use the CDN's `workerURL`.
Instead, host a tiny module worker on **your own origin**, for example
`/pmars-worker.mjs`, containing:

```js
import 'https://cdn.jsdelivr.net/gh/pmars-org/pmars-ai@TAG_OR_COMMIT/docs/worker.mjs';
```

Then create `new Worker('/pmars-worker.mjs', {type: 'module'})` and use the same
message API above. The CDN must permit cross-origin module and WASM requests;
your site's CSP must allow the chosen script/fetch host and WebAssembly
compilation. Self-hosting the versioned directory avoids the CDN dependency.
GitHub release-asset URLs are downloads, not JavaScript import endpoints.

## Releases and compatibility

Main pushes and pull requests produce a `build-wasm` Actions artifact. A valid
version tag adds the verified WASM ZIP to the same GitHub Release and
`SHA256SUMS` as the native packages. Manual workflow runs only create artifacts.
Nothing is published merely by running the local build.

The browser module is GPL-2.0-or-later, like the C engine; CDN delivery does not
change its license. The ZIP contains `COPYING` and corresponding source.
