/* Shared Cupertino era metadata. Presentation stays with each family adapter;
   this registry owns chronology, naming, and persistence compatibility. */
(() => {
  "use strict";

  const eras = Object.freeze([
    { id: "system1", family: "classic", year: "1984", name: "System 1", blurb: "1-bit desk · compact Mac", adapter: "mac1984" },
    { id: "mac8", family: "classic", year: "1998", name: "Mac OS 8.1", blurb: "Platinum · striped chrome", adapter: "mac8" },
    { id: "aqua", family: "osx", year: "2001", name: "Aqua", blurb: "Cheetah–Puma jelly & shelf Dock", adapter: "osx" },
    { id: "tiger", family: "osx", year: "2005", name: "Tiger", blurb: "Unified toolbar · metal-ish chrome", adapter: "osx" },
    { id: "leopard", family: "osx", year: "2007", name: "Leopard", blurb: "Dark menubar · reflective Dock", adapter: "osx" },
    { id: "lion", family: "osx", year: "2011", name: "Lion", blurb: "Peak skeuomorphism · linen & leather", adapter: "osx" },
    { id: "yosemite", family: "osx", year: "2014", name: "Yosemite", blurb: "Translucent flat · vibrancy blur", adapter: "osx" },
    { id: "bigsur", family: "osx", year: "2020", name: "Big Sur", blurb: "Rounder chrome · dense translucency", adapter: "osx" },
    { id: "glass", family: "osx", year: "2026", name: "Glassholism", blurb: "Maximal liquid glass · frost & bloom", adapter: "osx" },
  ]);

  const byId = new Map(eras.map((era) => [era.id, era]));
  const ids = (family) => eras.filter((era) => !family || era.family === family).map((era) => era.id);
  const isKnown = (id, family) => {
    const era = byId.get(id);
    return Boolean(era && (!family || era.family === family));
  };

  window.OqCupertino = Object.freeze({
    eras,
    ids,
    isKnown,
    storageKey: "retr-oq:cupertino-era",
    legacyStorageKeys: Object.freeze(["retr-oq:aqua-osx-era"]),
    migrateStoredEra(family) {
      try {
        const key = "retr-oq:cupertino-era";
        const current = localStorage.getItem(key);
        if (isKnown(current, family)) return current;
        for (const legacyKey of this.legacyStorageKeys) {
          const legacy = localStorage.getItem(legacyKey);
          if (isKnown(legacy, family)) {
            localStorage.setItem(key, legacy);
            return legacy;
          }
        }
      } catch {
        /* Storage is optional in private or restricted browsing contexts. */
      }
      return null;
    },
  });
})();
