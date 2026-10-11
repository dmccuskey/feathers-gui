# ADR 007: The Setup Is Kept in the Browser, and Works Across Windows

**Status:** Accepted

## Context

The servers and services a user sets up are the app's only data of its own. The app has no backend: it is a static page, used from a hosted copy or run locally.

`fgui-v4` keeps the setup in `localStorage` through a Vuex plugin, as one value written whole on every change. What is current (the server, the service, the record) is in the same value. With two windows open this goes wrong in two ways: a window writes its whole copy, so a server added in one window is lost when the other next writes anything, selecting a record included; and a reload in one window jumps to the server the other chose last.

Two windows are the way to have two servers open at once ([ADR 004](004-the-apps-objects.md)), so they have to work.

The setup could have been records behind a record source, mirrored into a store by events, as the Feathers records are. That is a source, a manager, a store and a round trip of events, for a handful of settings with one writer.

## Decision

- **A small class, `Setup`, holds the setup** in reactive state and saves it itself.
- **Servers and services are shared between windows,** in `localStorage`. A window follows the others by the browser's `storage` event. A write reads what is stored, changes the one record, and writes that: never the window's whole copy.
- **What is current is per window,** in `sessionStorage`: the current server, and the current service of each server. It survives a reload and is not shared. A new window starts on the server used last in any window.
- **The current record is not kept.**
- **A window follows a change made in another:** its active server's address edited elsewhere replaces its session, and the server removed elsewhere ends it.
- **The stored format has a version.** An older format is converted when it is read, wherever that is possible, and not thrown away. `fgui-v4`'s format is the first older one.
- **A window never writes over a format it does not know.** A tab left open across an update of the hosted copy can meet a setup that a newer window has converted. It says so and asks for a reload.
- **The setup can be exported and imported** as JSON, without passwords.

## Consequences

- Two windows on two servers, or on two services of one server, work, and a column hidden or a record pinned in one shows in the other.
- The setup lives in one browser on one machine. Moving it is by export and import.
- Every change to the format needs a conversion written and kept.
- Clearing the site's data loses the setup. The app cannot prevent that; export is the answer.
