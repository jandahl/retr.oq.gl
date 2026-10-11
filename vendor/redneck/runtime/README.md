# js-dos runtime assets

This directory contains the js-dos 8.5.3 browser runtime and its DOSBox
emulator assets. They are distributed under GPL-2.0. The rest of the site
remains under the repository's MIT license; see the license terms that apply
to these separate runtime components in `COPYING.GPL-2.0`.

The bundled files were fetched from the published js-dos 8.5.3 package and the
js-dos v8 emulator runtime. Corresponding source is available at these pinned
upstream revisions:

- js-dos frontend, version 8.5.3: <https://github.com/caiiiycuk/js-dos/tree/506dfd2a99f56bc4e393a716125ae94e58eb3fba>
- emulator loader and DOSBox WebAssembly backend: <https://github.com/caiiiycuk/emulators/tree/6bbf0925d221a7304ea8e0dda1e89b8dc01569b2>
- DOSBox source used by the backend: <https://github.com/js-dos/dosbox/tree/528578d5a6f76afd4d5ef4e722b5670826f1183a>

The runtime is separate from the Redneck game data. The game archive is not
included in these runtime assets.
