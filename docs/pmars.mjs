// SPDX-License-Identifier: GPL-2.0-or-later
// Public ES-module entry point. Keep this module and its relative dependencies together.
export {Engine, settings, defaults} from './engine.mjs?v=22ede45f08e7cbab';
export const workerURL = new URL('./worker.mjs?v=22ede45f08e7cbab', import.meta.url);
