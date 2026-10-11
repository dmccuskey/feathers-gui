# ADR 003: LiveSystem's Parts Are Used Where They Fit, and Only There

**Status:** Accepted

## Context

[LiveSystem](https://github.com/dmccuskey/live-system) is a framework for systems of long-lived objects, with a data service as the source of truth and web apps that display it. Its Feathers client library, `feathers-connect`, does what the lower half of `fgui-v4` does (about 960 of its lines), and does it more carefully: `fgui-v4` keeps only the first page of a paginated service, and after a reconnect leaves a record on screen that was removed meanwhile.

But `feathers-gui` is not a LiveSystem application:

| | a LiveSystem web app | `feathers-gui` |
|---|---|---|
| the data service | one, known when the page loads | none, one, or another a moment later |
| the kinds of record | known and typed | unknown: any service, any fields |
| who writes | never the web app | the app: that is what it is for |
| how much is loaded | everything | what the user looks at; a service may be large |
| its own data | none | the user's setup, in the browser |

## Decision

Used as they are:

| part | for |
|---|---|
| `feathers-connect` | the connection, logging in, a service's record source |
| `LiveObject` | being made and destroyed. A session's steps to connect are its state machine's, not `init()`, `start()`, `run()` |
| `DataManager` | a service loaded whole: loading with no change missed, applying events, syncing after a reconnect. Owned by a loader, with a store object of the app's own |
| `micro-fsm` | the session's states |
| `MemoryRecordSource` | tests without a Feathers server |

Borrowed as an idea, and written for this app: one function that builds the app's objects and provides them to the components; one reactive status that the page renders from; the rule that the service is the truth ([ADR 005](005-the-server-is-the-truth.md)).

Not used: `LiveSystem` itself, its lifecycle runner, its managers of live objects, its event bus, its clock, its web startup and its command client.

Where a part lacks something that any user of it would need, the need goes to LiveSystem. Where a part would have to bend to suit this app alone, the app goes its own way.

## Consequences

- The hardest code in the app (keeping records in step with a server over a connection that drops) is shared and tested elsewhere.
- The app depends on packages that are not published yet. Until they are, they are linked from a local checkout, and the work that uses them stays on a branch.
- The app is a second user of those packages, which tests their APIs. It also waits for them: logging in, a page of records, and a record handed on as the server has it were asked of `feathers-connect` for this app.
- Each part taken is a judgment. The table above is the record of it, and a part is added to it only by the same question: does this app have the problem the part solves.
