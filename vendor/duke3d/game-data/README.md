# Duke Nukem 3D Shareware data

`duke3d-demo.jsdos` contains the canonical Duke Nukem 3D Shareware Version 1.3d,
repackaged as a js-dos bundle. The original archive was obtained from
[DOS Games Archive](https://www.dosgamesarchive.com/file/duke-nukem-3d/dn3d-box).

The bundle includes `DUKE3D.GRP`, `DUKE3D.EXE`, `GAME.CON`, and associated RTS/CON files.
It includes a preconfigured `DUKE3D.CFG` set up for Sound Blaster 16 and keyboard + mouse controls.

Rebuild it with `python3 tools/repack_duke3d_shareware.py <dn3d-box.zip> <output.jsdos>`.
