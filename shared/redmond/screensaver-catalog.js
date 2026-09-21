// Period metadata for the remade screen savers.  This is deliberately data,
// not a menu: each desktop still owns its historically appropriate surface.
(() => {
  "use strict";

  const entries = [
    ["afterdark-night", "After Dark: Night", ["mac8"]],
    ["aquarium", "Aquarium", ["win98"]],
    ["backrooms-ii", "Backrooms II", ["xp"]],
    ["backspace", "BackSpace", ["next"]],
    ["beziers", "Beziers", ["win31"]],
    ["boing", "Boing", ["amiga"]],
    ["cga-stars", "CGA Stars", ["dos"]],
    ["cyclone", "Cyclone", ["kde"]],
    ["euphoria", "Euphoria", ["kde"]],
    ["fieldlines", "Field Lines", ["kde", "aqua"]],
    ["flocks", "Flocks", ["kde"]],
    ["flux", "Flux", ["kde", "aqua"]],
    ["flying-toasters", "Flying Toasters", ["win31"]],
    ["flying-windows", "Flying Windows", ["win31"]],
    ["glmatrix", "GL Matrix", ["kde"]],
    ["helios", "Helios", ["kde"]],
    ["hyperspace", "Hyperspace", ["kde"]],
    ["lattice", "Lattice", ["kde"]],
    ["lorenz", "Lorenz", ["kde"]],
    ["mac-stars", "Mac Stars", ["mac1984"]],
    ["marquee", "Marquee", ["win31"]],
    ["maze", "3D Maze", ["win98", "win7"]],
    ["maze-backrooms", "Backrooms", ["win98"]],
    ["mystify", "Mystify", ["win31"]],
    ["pipes", "3D Pipes", ["win98", "xp"]],
    ["pixelcity", "Pixel City", ["kde"]],
    ["raster-stars", "Raster Stars", ["c64"]],
    ["skyrocket", "Skyrocket", ["kde"]],
    ["solarwinds", "Solar Winds", ["kde", "aqua"]],
    ["starfield", "Starfield", ["win31"]],
  ];

  const catalog = Object.freeze(Object.fromEntries(entries.map(([id, label, eras]) => [
    id,
    Object.freeze({ id, label, eras: Object.freeze(eras.slice()) }),
  ])));

  window.OqScreenSaverCatalog = Object.freeze({
    all() { return Object.values(catalog); },
    get(id) { return catalog[id] || null; },
    forTheme(theme) { return Object.values(catalog).filter((entry) => entry.eras.includes(theme)); },
  });
})();
