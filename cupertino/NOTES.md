# cupertino/ — family entry point

This directory is the canonical public entry point for the Cupertino family.
The canonical shell now lives here. `/aqua/` remains a compatibility entry
point for old bookmarks and redirects while preserving query and hash values.

`shared/cupertino/era-registry.js` is the shared contract for Classic and OS X
milestones. The Aqua adapter filters to OS X eras; the Classic adapters use the
native-looking Classic Time Machine presentation.

Keep historical interaction models in `mac1984/` and `mac8/`; this directory is
the family shell and OS X skin home.
