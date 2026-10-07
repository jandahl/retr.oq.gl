# cupertino/ — family entry point

This directory is the canonical public entry point for the Cupertino family.
The first migration slice keeps the existing `aqua/` shell intact and
redirects here to it, preserving current Aqua behavior and test coverage while
the Classic Mac adapters and shared Time Machine contract are extracted.

Do not add Classic window-manager logic here yet. System 1 and Mac OS 8 keep
their historical interaction models until their adapters are ready.
