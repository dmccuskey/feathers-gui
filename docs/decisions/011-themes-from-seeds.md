# ADR 011: A Theme Is a Few Seeds, and the Widgets Name Roles

**Status:** Accepted

## Context

The app has a light and a dark look, and is to have more: several of each for the user to choose from, a palette manager, and a theme taken from a palette of three or four colors as sites of color combinations give them. The widgets are the app's own ([ADR 009](009-our-own-widgets.md)), so nothing sets their colors for them.

A widget that names a color has to be changed for every theme. A theme that lists every color a widget uses is long to write, easy to get wrong, and cannot be made from a palette of four.

## Decision

- A widget names a role, never a color. There are twelve: three surfaces (`page`, `panel`, `sunken`), two texts (`text`, `muted`), `border`, the accent (`accent`, `onAccent`, `accentSoft`), and `danger`, `warning` and `success`. Each is a CSS variable (`--ui-accent`).
- A theme is three seeds (background, text, accent), whether it is light or dark, and three things that are not colors: its font, the radius of its corners, and how strongly what is accented glows.
- The other roles are derived from the seeds. `danger`, `warning` and `success` are one set for light and one for dark. A theme may give any role itself, in place of the derived one.
- The roles are derived in TypeScript (`src/widgets/themes.ts`) and put on the document's root as CSS variables, before the app is drawn.
- A test checks every theme: what is read (the texts, the accent, the three states) has a contrast of 4.5 on every surface.
- The theme follows the system's setting until the user picks one. The choice is kept in `localStorage` under its own key, apart from the setup ([ADR 007](007-setup-in-the-browser.md)).
- The first themes are Sand (light: sand, umber and terracotta) and Ether (dark: blue-black with a pale blue that glows).

## Options Rejected

- **Deriving the roles in CSS, with `color-mix()`.** No script would be needed to color the page. But a test cannot read what the browser computes, so a theme that cannot be read would be found by eye. The app needs its script to show anything, so nothing is lost.
- **A second accent as a fourth seed.** No widget had a use for it. It is added when one does.
- **The theme in the setup.** It would change the setup's stored format and travel with an exported setup, for a choice that is about the person's screen and not about their servers.

## Consequences

- A new theme is one object of a few lines, and a palette from elsewhere is nearly one already.
- A palette manager edits that object, and the test's check can be run on what it makes.
- A theme with too little contrast fails a test and is not found by a user.
- A new role is a change to every theme's derivation, which keeps the count small.
- The colors are mixed in sRGB, which is good enough between a background and its text. A derived role that looks wrong is given by the theme itself.
