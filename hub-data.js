// Data for the retr-oq hub tiles (index.html). One entry per theme.
// `href` must be a bare theme directory ("name/"), never "name/index.html" --
// GitHub Pages serves the directory's index.html, and the explicit filename
// is dead weight that CI checks for (see .github/workflows/html-lint.yml).
// `icon` is the inner markup of a 32x32 viewBox <svg>, hand-pixelled per
// machine -- keep the palette/geometry comments, they're the only record of
// what each rect is meant to represent.
//
// `category` is a best-fit tag, not an exhaustive taxonomy: "console",
// "handheld", "workstation" (NeXT, KDE) for the unambiguous cases, split by
// lineage for the rest -- "redmond" (win31/win98/xp/win7), "cupertino"
// (mac1984/mac8/aqua), and "home-computer" for independent 8/16-bit machines
// that are neither (dos, c64, amiga -- keyboard/BASIC machines, not
// cartridge consoles, however tempting that grouping is once the vendor
// buckets exist). Re-tag freely if a future filter/UI wants a different
// split.
// `hasGames` mirrors shared/games.js's matrix: true only where the theme
// carries a real minigame (kind: "game", e.g. MORPH! or KAL-Q), not a demo
// or an easter egg -- keep the two in sync when shared/games.js changes.
// `tags` carries secondary filter memberships, so a home computer can also
// appear in the Console ring without losing its historical label.
window.OqHubMachines = [
  {
    href: "dos/",
    name: "DOS",
    year: "1981",
    category: "home-computer",
    hasGames: false,
    meta: "COMMAND.COM",
    iconNote: "IBM PC monitor, EGA black, A: prompt",
    icon: `
      <rect width="32" height="32" fill="#7a7a7a"/>
      <rect x="3" y="3" width="26" height="20" fill="#cfcfcf"/>
      <rect x="5" y="5" width="22" height="16" fill="#0a0a0a"/>
      <rect x="6" y="7" width="2" height="2" fill="#c0c0c0"/>
      <rect x="9" y="7" width="2" height="2" fill="#c0c0c0"/>
      <rect x="12" y="7" width="2" height="2" fill="#c0c0c0"/>
      <rect x="6" y="11" width="2" height="2" fill="#c0c0c0"/>
      <rect x="9" y="11" width="8" height="2" fill="#c0c0c0" class="blink"/>
      <rect x="12" y="24" width="8" height="3" fill="#9a9a9a"/>
      <rect x="8" y="27" width="16" height="2" fill="#5a5a5a"/>
    `,
  },
  {
    href: "c64/",
    name: "Commodore 64",
    year: "1982",
    category: "home-computer",
    tags: ["console"],
    hasGames: true,
    meta: "READY.",
    iconNote: "Breadbin chassis, light-blue-on-blue READY.",
    icon: `
      <rect width="32" height="32" fill="#6c5eb5"/>
      <rect x="2" y="2" width="28" height="20" fill="#433eb7"/>
      <rect x="4" y="5" width="2" height="2" fill="#a5a7ff"/>
      <rect x="7" y="5" width="2" height="2" fill="#a5a7ff"/>
      <rect x="10" y="5" width="2" height="2" fill="#a5a7ff"/>
      <rect x="13" y="5" width="2" height="2" fill="#a5a7ff"/>
      <rect x="16" y="5" width="2" height="2" fill="#a5a7ff"/>
      <rect x="18" y="5" width="1" height="2" fill="#a5a7ff"/>
      <rect x="4" y="9" width="2" height="2" fill="#a5a7ff" class="blink"/>
      <rect x="2" y="22" width="28" height="8" fill="#6d4c2f"/>
      <rect x="4" y="24" width="24" height="4" fill="#c4b49a"/>
      <rect x="5" y="25" width="2" height="2" fill="#2a2118"/>
      <rect x="8" y="25" width="2" height="2" fill="#2a2118"/>
      <rect x="11" y="25" width="2" height="2" fill="#2a2118"/>
    `,
  },
  {
    href: "mac1984/",
    name: "Mac",
    year: "1984",
    category: "cupertino",
    hasGames: false,
    meta: "System 1",
    iconNote: "Compact Mac, 1-bit happy Mac, floppy chin",
    icon: `
      <rect width="32" height="32" fill="#c8b492"/>
      <rect x="6" y="2" width="20" height="27" fill="#e6d3b0"/>
      <rect x="6" y="2" width="20" height="1" fill="#f4e6cc"/>
      <rect x="6" y="28" width="20" height="1" fill="#a89068"/>
      <rect x="8" y="4" width="16" height="14" fill="#2b2722"/>
      <rect x="9" y="5" width="14" height="12" fill="#111111"/>
      <rect x="12" y="8" width="8" height="7" fill="#e8e8e8"/>
      <rect x="13" y="10" width="2" height="2" fill="#111111"/>
      <rect x="17" y="10" width="2" height="2" fill="#111111"/>
      <rect x="14" y="13" width="4" height="1" fill="#111111"/>
      <rect x="11" y="20" width="10" height="2" fill="#3a342c"/>
      <rect x="12" y="24" width="2" height="2" fill="#51a3e1"/>
      <rect x="14" y="24" width="2" height="2" fill="#7ac142"/>
      <rect x="16" y="24" width="2" height="2" fill="#f5d031"/>
      <rect x="18" y="24" width="2" height="2" fill="#f0892f"/>
      <rect x="20" y="24" width="1" height="2" fill="#e23d3d"/>
    `,
  },
  {
    href: "nes/",
    name: "NES",
    year: "1985",
    category: "console",
    hasGames: false,
    meta: "cartridge",
    iconNote: "Gray toaster, cartridge, red power LED",
    icon: `
      <rect width="32" height="32" fill="#3a3a42"/>
      <rect x="10" y="4" width="12" height="8" fill="#6a2c2c"/>
      <rect x="11" y="5" width="10" height="5" fill="#c45c5c"/>
      <rect x="12" y="6" width="8" height="2" fill="#f0d090"/>
      <rect x="3" y="12" width="26" height="14" fill="#d0d0d0"/>
      <rect x="3" y="12" width="26" height="2" fill="#ececec"/>
      <rect x="5" y="15" width="22" height="3" fill="#2a2a2a"/>
      <rect x="5" y="22" width="3" height="2" fill="#e03030" class="pulse"/>
      <rect x="20" y="21" width="6" height="3" fill="#b8b8b8"/>
    `,
  },
  {
    href: "compy/",
    name: "Beige 386",
    year: "1987",
    category: "home-computer",
    tags: ["console"],
    hasGames: false,
    meta: "cartoon CRT",
    iconNote: "Round beige CRT, blue text, contrast wheels on the bottom",
    icon: `
      <rect width="32" height="32" fill="#3a2e22"/>
      <rect x="3" y="2" width="26" height="21" rx="6" fill="#e2d2a8"/>
      <rect x="6" y="5" width="20" height="13" fill="#0c1420"/>
      <rect x="8" y="7" width="10" height="2" fill="#7ec8f8"/>
      <rect x="8" y="11" width="2" height="2" fill="#d4e4f8" class="blink"/>
      <rect x="10" y="20" width="8" height="2" fill="#5a4830"/>
      <rect x="8" y="23" width="4" height="4" rx="2" fill="#7a7268"/>
      <rect x="20" y="23" width="4" height="4" rx="2" fill="#7a7268"/>
      <rect x="5" y="27" width="22" height="4" rx="1" fill="#e2d2a8"/>
    `,
  },
  {
    href: "amiga/",
    name: "Amiga",
    year: "1988",
    category: "home-computer",
    tags: ["console"],
    hasGames: false,
    meta: "Workbench 1.3",
    iconNote: "Workbench 1.3: blue screen, orange window, boing, copper",
    icon: `
      <rect width="32" height="32" fill="#0055AA"/>
      <rect x="2" y="2" width="20" height="16" fill="#FF8800"/>
      <rect x="2" y="2" width="20" height="1" fill="#FFFFFF"/>
      <rect x="2" y="2" width="1" height="16" fill="#FFFFFF"/>
      <rect x="21" y="3" width="1" height="15" fill="#000000"/>
      <rect x="3" y="17" width="19" height="1" fill="#000000"/>
      <rect x="3" y="3" width="2" height="2" fill="#000000"/>
      <rect x="18" y="3" width="2" height="2" fill="#000000"/>
      <rect x="4" y="6" width="16" height="10" fill="#FFFFFF"/>
      <rect x="5" y="8" width="10" height="1" fill="#000000"/>
      <rect x="5" y="11" width="7" height="1" fill="#000000"/>
      <rect x="21" y="14" width="9" height="9" fill="#EE1111"/>
      <rect x="23" y="14" width="2" height="9" fill="#FFFFFF"/>
      <rect x="27" y="14" width="2" height="9" fill="#FFFFFF"/>
      <rect x="21" y="16" width="9" height="2" fill="#FFFFFF"/>
      <rect x="23" y="16" width="2" height="2" fill="#EE1111"/>
      <rect x="27" y="16" width="2" height="2" fill="#EE1111"/>
      <rect x="21" y="20" width="9" height="2" fill="#FFFFFF"/>
      <rect x="23" y="20" width="2" height="2" fill="#EE1111"/>
      <rect x="27" y="20" width="2" height="2" fill="#EE1111"/>
      <rect y="27" width="32" height="1" fill="#EE0000"/>
      <rect y="28" width="32" height="1" fill="#EE8800"/>
      <rect y="29" width="32" height="1" fill="#EEEE00"/>
      <rect y="30" width="32" height="1" fill="#00AAEE"/>
      <rect y="31" width="32" height="1" fill="#0055AA"/>
    `,
  },
  {
    href: "gb/",
    name: "Game Boy",
    year: "1989",
    category: "handheld",
    hasGames: true,
    meta: "DMG-01",
    iconNote: "DMG brick, olive LCD, burgundy A/B",
    icon: `
      <rect width="32" height="32" fill="#8a8a8a"/>
      <rect x="6" y="1" width="20" height="30" fill="#cfcfcf"/>
      <rect x="8" y="3" width="16" height="14" fill="#6a6a6a"/>
      <rect x="9" y="4" width="14" height="12" fill="#8bac0f"/>
      <rect x="12" y="7" width="8" height="6" fill="#0f380f"/>
      <rect x="9" y="20" width="6" height="6" fill="#5a5a5a"/>
      <rect x="11" y="21" width="2" height="4" fill="#2e2e2e"/>
      <rect x="10" y="22" width="4" height="2" fill="#2e2e2e"/>
      <rect x="20" y="21" width="3" height="3" fill="#7a3048"/>
      <rect x="18" y="24" width="3" height="3" fill="#7a3048"/>
    `,
  },
  {
    href: "snes/",
    name: "Super Nintendo",
    year: "1991",
    category: "console",
    hasGames: true,
    meta: "PAL 16-bit",
    iconNote: "PAL Super Nintendo: rounded gray deck, rainbow pad",
    icon: `
      <rect width="32" height="32" fill="#1c1e22"/>
      <rect x="9" y="3" width="14" height="7" fill="#6a6e72"/>
      <rect x="10" y="4" width="12" height="4" fill="#d0d4d8"/>
      <rect x="3" y="10" width="26" height="12" fill="#c4c8cc"/>
      <rect x="3" y="10" width="26" height="2" fill="#e0e4e8"/>
      <rect x="5" y="14" width="22" height="3" fill="#2a2c30"/>
      <rect x="6" y="19" width="3" height="2" fill="#d03030" class="pulse"/>
      <rect x="18" y="18" width="8" height="3" fill="#9aa0a6"/>
      <rect x="4" y="24" width="24" height="6" fill="#b0b4b8"/>
      <rect x="20" y="25" width="2" height="2" fill="#38a040"/>
      <rect x="22" y="25" width="2" height="2" fill="#3060d8"/>
      <rect x="21" y="27" width="2" height="2" fill="#e8c030"/>
      <rect x="23" y="27" width="2" height="2" fill="#d03030"/>
    `,
  },
  {
    href: "win31/",
    name: "Windows 3.1",
    year: "1992",
    category: "redmond",
    hasGames: false,
    meta: "Program Manager",
    iconNote: "Teal desktop, 3.1 window: sysmenu on the left, no close X",
    icon: `
      <rect width="32" height="32" fill="#008080"/>
      <rect x="3" y="5" width="26" height="20" fill="#c0c0c0"/>
      <rect x="3" y="5" width="25" height="1" fill="#ffffff"/>
      <rect x="3" y="5" width="1" height="19" fill="#ffffff"/>
      <rect x="28" y="6" width="1" height="19" fill="#000000"/>
      <rect x="4" y="24" width="25" height="1" fill="#000000"/>
      <rect x="5" y="7" width="22" height="4" fill="#000080"/>
      <rect x="6" y="8" width="3" height="2" fill="#c0c0c0"/>
      <rect x="7" y="9" width="1" height="1" fill="#000000"/>
      <rect x="22" y="8" width="2" height="2" fill="#c0c0c0"/>
      <rect x="25" y="8" width="2" height="2" fill="#c0c0c0"/>
      <rect x="6" y="12" width="20" height="10" fill="#c0c0c0"/>
      <rect x="7" y="13" width="8" height="8" fill="#ffff00"/>
      <rect x="8" y="14" width="6" height="2" fill="#000080"/>
      <rect x="17" y="13" width="8" height="8" fill="#00ffff"/>
      <rect x="18" y="14" width="6" height="2" fill="#000080"/>
    `,
  },
  {
    href: "os2/",
    name: "OS/2 Warp",
    year: "1994",
    category: "home-computer",
    hasGames: false,
    meta: "Workplace Shell",
    iconNote: "Blue Warp desktop, System folder, compatibility session",
    icon: `<rect width="32" height="32" fill="#4f7899"/><rect x="3" y="4" width="20" height="18" fill="#d7d7d7"/><rect x="3" y="4" width="20" height="3" fill="#0055aa"/><rect x="5" y="9" width="6" height="5" fill="#0055aa"/><rect x="13" y="9" width="6" height="5" fill="#d7d7d7" stroke="#0055aa"/><rect y="27" width="32" height="5" fill="#d7d7d7"/><rect x="2" y="28" width="6" height="3" fill="#0055aa"/>`,
  },
  {
    href: "next/",
    name: "NeXT",
    year: "1995",
    category: "workstation",
    hasGames: false,
    meta: "Workspace 3.3",
    iconNote: "Workspace 3.3: gray desktop, black title, right dock",
    icon: `
      <rect width="32" height="32" fill="#AAAAAA"/>
      <rect x="2" y="4" width="22" height="20" fill="#AAAAAA"/>
      <rect x="2" y="4" width="22" height="20" fill="none" stroke="#000000" stroke-width="2"/>
      <rect x="2" y="4" width="22" height="5" fill="#000000"/>
      <rect x="3" y="5" width="3" height="3" fill="#AAAAAA"/>
      <rect x="20" y="5" width="3" height="3" fill="#AAAAAA"/>
      <rect x="4" y="10" width="18" height="12" fill="#FFFFFF"/>
      <rect x="6" y="12" width="10" height="1" fill="#000000"/>
      <rect x="6" y="15" width="8" height="1" fill="#000000"/>
      <rect x="6" y="18" width="6" height="1" fill="#000000"/>
      <rect x="25" y="0" width="7" height="32" fill="#555555"/>
      <rect x="26" y="2" width="5" height="5" fill="#222222"/>
      <rect x="26" y="9" width="5" height="5" fill="#2a4a20"/>
      <rect x="26" y="16" width="5" height="5" fill="#4a4030"/>
      <rect x="26" y="25" width="5" height="5" fill="#333333"/>
    `,
  },
  {
    href: "mac8/",
    name: "Mac OS 8.1",
    year: "1998",
    category: "cupertino",
    hasGames: false,
    meta: "Platinum",
    iconNote: "Platinum window, striped title bar, color finder",
    icon: `
      <rect width="32" height="32" fill="#8a8a8a"/>
      <rect x="3" y="5" width="26" height="22" fill="#dddddd"/>
      <rect x="3" y="5" width="26" height="1" fill="#ffffff"/>
      <rect x="3" y="6" width="26" height="5" fill="#cccccc"/>
      <rect x="4" y="7" width="24" height="1" fill="#ffffff"/>
      <rect x="4" y="9" width="24" height="1" fill="#ffffff"/>
      <rect x="5" y="7" width="3" height="3" fill="#888888"/>
      <rect x="5" y="12" width="22" height="13" fill="#ffffff"/>
      <rect x="11" y="15" width="10" height="8" fill="#4aa0e8"/>
      <rect x="13" y="17" width="2" height="2" fill="#1a1a1a"/>
      <rect x="17" y="17" width="2" height="2" fill="#1a1a1a"/>
      <rect x="14" y="20" width="4" height="1" fill="#1a1a1a"/>
      <rect x="12" y="16" width="2" height="2" fill="#e24b4b"/>
      <rect x="18" y="16" width="2" height="2" fill="#f0c030"/>
    `,
  },
  {
    href: "win95/",
    name: "Windows 95",
    year: "1995",
    category: "redmond",
    hasGames: false,
    meta: "Start / Mikisoq",
    iconNote: "Teal desktop, Windows 95 shell, optional sled-dog house",
    icon: `
      <rect width="32" height="32" fill="#008080"/>
      <rect x="4" y="6" width="24" height="18" fill="#c0c0c0"/>
      <rect x="5" y="7" width="22" height="3" fill="#000080"/>
      <rect x="6" y="11" width="20" height="11" fill="#fff"/>
      <circle cx="16" cy="16" r="4" fill="#c98c57" stroke="#43281e"/>
      <circle cx="14.5" cy="15.5" r=".6" fill="#201510"/><circle cx="17.5" cy="15.5" r=".6" fill="#201510"/>
      <rect x="5" y="24" width="22" height="4" fill="#c0c0c0"/>
    `,
  },
  {
    href: "win98/",
    name: "Windows 98",
    year: "1998",
    category: "redmond",
    hasGames: false,
    meta: "Start / taskbar",
    iconNote: "Teal desktop, 3D gray window, navy title bar",
    icon: `
      <rect width="32" height="32" fill="#008080"/>
      <rect x="4" y="6" width="24" height="18" fill="#c0c0c0"/>
      <rect x="4" y="6" width="23" height="1" fill="#ffffff"/>
      <rect x="4" y="6" width="1" height="17" fill="#ffffff"/>
      <rect x="27" y="7" width="1" height="17" fill="#808080"/>
      <rect x="5" y="23" width="23" height="1" fill="#808080"/>
      <rect x="5" y="7" width="22" height="3" fill="#000080"/>
      <rect x="23" y="8" width="3" height="2" fill="#c0c0c0"/>
      <rect x="6" y="11" width="20" height="11" fill="#ffffff"/>
      <rect x="8" y="13" width="10" height="1" fill="#000000"/>
      <rect x="8" y="16" width="14" height="1" fill="#000000"/>
      <rect x="8" y="19" width="8" height="1" fill="#000000"/>
    `,
  },
  {
    href: "beos/",
    name: "BeOS",
    year: "2000",
    category: "workstation",
    hasGames: false,
    meta: "Tracker / Deskbar",
    iconNote: "BeOS Blue, yellow title tab, Deskbar on the right",
    icon: `
      <rect width="32" height="32" fill="#336698"/>
      <rect x="2" y="7" width="18" height="16" fill="#d8d8d8"/>
      <rect x="2" y="7" width="12" height="4" fill="#ffc000"/>
      <rect x="3" y="8" width="2" height="2" fill="#cc3030"/>
      <rect x="13" y="8" width="2" height="2" fill="#f4f4f4"/>
      <rect x="4" y="13" width="14" height="8" fill="#ffffff"/>
      <rect x="21" y="0" width="11" height="32" fill="#d8d8d8"/>
      <rect x="21" y="0" width="11" height="6" fill="#ffc000"/>
      <rect x="23" y="2" width="3" height="3" fill="#cc3030"/>
      <rect x="23" y="9" width="7" height="2" fill="#336698"/>
      <rect x="23" y="13" width="7" height="2" fill="#8c8c8c"/>
      <rect x="23" y="17" width="7" height="2" fill="#8c8c8c"/>
    `,
  },
  {
    href: "aqua/",
    name: "OS X Aqua",
    year: "2001",
    category: "cupertino",
    hasGames: false,
    meta: "Aqua / Dock",
    iconNote: "Pinstripe desktop, traffic-light window, glass Dock",
    icon: `
      <rect width="32" height="32" fill="#e2e6ec"/>
      <rect x="0" y="0" width="1" height="32" fill="#eceff3"/>
      <rect x="2" y="0" width="1" height="32" fill="#eceff3"/>
      <rect x="4" y="0" width="1" height="32" fill="#eceff3"/>
      <rect x="6" y="0" width="1" height="32" fill="#eceff3"/>
      <rect x="8" y="0" width="1" height="32" fill="#eceff3"/>
      <rect x="10" y="0" width="1" height="32" fill="#eceff3"/>
      <rect x="12" y="0" width="1" height="32" fill="#eceff3"/>
      <rect x="14" y="0" width="1" height="32" fill="#eceff3"/>
      <rect x="16" y="0" width="1" height="32" fill="#eceff3"/>
      <rect x="18" y="0" width="1" height="32" fill="#eceff3"/>
      <rect x="20" y="0" width="1" height="32" fill="#eceff3"/>
      <rect x="22" y="0" width="1" height="32" fill="#eceff3"/>
      <rect x="24" y="0" width="1" height="32" fill="#eceff3"/>
      <rect x="26" y="0" width="1" height="32" fill="#eceff3"/>
      <rect x="28" y="0" width="1" height="32" fill="#eceff3"/>
      <rect x="30" y="0" width="1" height="32" fill="#eceff3"/>
      <rect y="0" width="32" height="3" fill="#ffffff"/>
      <rect x="3" y="6" width="26" height="16" rx="2" fill="#f0f0f0" stroke="#444"/>
      <rect x="3" y="6" width="26" height="4" fill="#8ba4d1"/>
      <circle cx="6.5" cy="8" r="1.2" fill="#e2462e"/>
      <circle cx="10" cy="8" r="1.2" fill="#f5c033"/>
      <circle cx="13.5" cy="8" r="1.2" fill="#62c23a"/>
      <rect x="6" y="12" width="20" height="8" fill="#ffffff"/>
      <rect x="8" y="26" width="16" height="4" rx="1" fill="#c8d4e8" stroke="#668"/>
      <circle cx="11" cy="28" r="1.2" fill="#3f82c8"/>
      <circle cx="16" cy="28" r="1.2" fill="#e87830"/>
      <circle cx="21" cy="28" r="1.2" fill="#cfd6de"/>
    `,
  },
  {
    href: "xp/",
    name: "Windows XP",
    year: "2001",
    category: "redmond",
    hasGames: false,
    meta: "Luna Blue",
    iconNote: "Bliss hill, Luna blue chrome",
    icon: `
      <rect width="32" height="16" fill="#5eb1e5"/>
      <rect y="16" width="32" height="16" fill="#3d9e2a"/>
      <rect x="0" y="14" width="18" height="8" fill="#6bb33a"/>
      <rect x="20" y="6" width="6" height="4" fill="#ffffff"/>
      <rect x="3" y="10" width="26" height="16" fill="#ece9d8"/>
      <rect x="3" y="10" width="26" height="4" fill="#0054e3"/>
      <rect x="4" y="11" width="12" height="2" fill="#ffffff"/>
      <rect x="24" y="11" width="4" height="2" fill="#e96c32"/>
      <rect x="5" y="16" width="22" height="8" fill="#ffffff"/>
      <rect x="7" y="18" width="8" height="1" fill="#000000"/>
      <rect x="7" y="21" width="12" height="1" fill="#000000"/>
    `,
  },
  {
    href: "kde/",
    name: "KDE",
    year: "2006",
    category: "workstation",
    hasGames: false,
    meta: "Compiz Fusion",
    iconNote: "Plastik window, blue 2006 desktop, Kicker",
    icon: `
      <rect width="32" height="32" fill="#0a4a7a"/>
      <rect y="22" width="32" height="10" fill="#1a6aaa"/>
      <rect x="4" y="5" width="24" height="18" fill="#ececec"/>
      <rect x="4" y="5" width="24" height="4" fill="#3a7eab"/>
      <rect x="5" y="6" width="10" height="2" fill="#ffffff"/>
      <rect x="23" y="6" width="2" height="2" fill="#d0d0d6"/>
      <rect x="25" y="6" width="2" height="2" fill="#d04530"/>
      <rect x="6" y="11" width="20" height="9" fill="#ffffff"/>
      <rect x="8" y="13" width="8" height="1" fill="#1a1a1a"/>
      <rect x="8" y="16" width="12" height="1" fill="#1a1a1a"/>
      <rect y="28" width="32" height="4" fill="#c8c8d2"/>
      <rect x="1" y="29" width="5" height="2" fill="#3a7eab"/>
      <rect x="8" y="29" width="4" height="2" fill="#e8e8ee"/>
    `,
  },
  {
    href: "win7/",
    name: "Windows 7",
    year: "2009",
    category: "redmond",
    hasGames: false,
    meta: "Aero glass",
    iconNote: "Harmony swirl, glass title, four-color orb",
    icon: `
      <rect width="32" height="32" fill="#071833"/>
      <rect x="4" y="18" width="10" height="6" fill="#1a4e8a"/>
      <rect x="16" y="12" width="12" height="10" fill="#0d2f66"/>
      <rect x="10" y="8" width="8" height="8" fill="#2a6cb0"/>
      <rect x="2" y="7" width="28" height="18" fill="#dce6f4"/>
      <rect x="2" y="7" width="28" height="4" fill="#9ec3ee"/>
      <rect x="3" y="8" width="10" height="2" fill="#2b2b2b"/>
      <rect x="24" y="8" width="2" height="2" fill="#c05050"/>
      <rect x="26" y="8" width="2" height="2" fill="#50a050"/>
      <rect x="4" y="13" width="24" height="10" fill="#ffffff"/>
      <rect x="13" y="22" width="6" height="6" fill="#222222"/>
      <rect x="14" y="23" width="2" height="2" fill="#f35325"/>
      <rect x="16" y="23" width="2" height="2" fill="#81bc06"/>
      <rect x="14" y="25" width="2" height="2" fill="#05a6f0"/>
      <rect x="16" y="25" width="2" height="2" fill="#ffba08"/>
    `,
  },
];
