# Architecture

How the new version of `feathers-gui` is put together: a record editor for Feathers 5 servers, on Vue 3.

**This page describes a design, not code.** The new version is not written yet. The app in the repository today is `fgui-v4/`, for Feathers 4, and it is the reference for what the app does. This page changes as the new version is built; where the code and this page differ, one of them is wrong, and it is worth an issue.

## Overview

`feathers-gui` is a tool for a developer who is building on a Feathers server. It shows the records of the server's services, follows them as they change, and lets the developer change them and watch how the server and its other clients react.

Three things shape the design:

- **The server is chosen while the app runs.** There may be none, one, or another one a moment later. Nothing about a server or its services is known in advance: not the services, not the fields of a record, not which field is the ID, not how many records there are.
- **The app writes.** It is a second writer beside the server's own clients, so what it shows has to be what the server has, not what the app thinks it sent.
- **It may be pointed at a large database.** A development database is small. A production one may not be, and the app must not read all of it because nobody said not to.

The app is plain TypeScript classes that use Vue's reactivity as a library, with Vue components on top that render from their state ([ADR 002](decisions/002-plain-classes-with-vue-reactivity.md)). It reaches Feathers through [feathers-connect](https://github.com/dmccuskey/live-system), and takes a few more parts from LiveSystem where they fit ([ADR 003](decisions/003-livesystem-parts.md)).

## The Objects

```text
App                      always runs; needs no connection
  Setup                  the servers and services set up, and what is current
  Secrets                the passwords held in memory, by server
  Dialogs                opens a dialog and returns its answer
  Session                one, for the active server; none when there is none
    FeathersConnection   feathers-connect's connection
    Changes              the list of changes, across the server's services
    ServiceView          one per service of the active server
      a loader           WholeLoader or PagedLoader, one at a time
```

Ownership is direct: an owner makes an object, holds it, and destroys it ([ADR 004](decisions/004-the-apps-objects.md)). Each object is given what it needs in its constructor and none reaches for another's instance, so each can be made in a test.

| object | what it is | what it owns |
|---|---|---|
| `App` | a plain class, made once by `createGuiApp()` and provided to the components | the setup, the secrets, the dialogs, the session |
| `Setup` | a plain class with reactive state | the servers and services the user has set up, saved in the browser |
| `Secrets` | a plain class | the passwords typed in this window |
| `Session` | a live object with a state machine | the connection to the active server, its service views, its list of changes |
| `ServiceView` | a live object | one service: its loader, its selection, its pins, the shape of its records |
| `Changes` | a plain class with reactive state | the change events of the session, newest first |
| `Dialogs` | a plain class | the dialogs that are open |

### The App

`createGuiApp()` builds the app and returns it. `main.ts` provides it, and a component gets it with `useApp()`. Startup is that, and activating the server that was current last time if there is one. There are no startup phases: nothing needs a connection to begin.

The app runs the flows that need a dialog (add a server, edit a service's fields, confirm a removal) as `async` methods: open the dialog, await its answer, write the setup. The objects below it never open a dialog. A session that needs a password says so in its status, and the app asks.

The app watches the setup of the active server. When what the connection depends on changes (the address, the login), the session is replaced. When the active server is removed, the session ends.

### The Setup

The servers and services a user sets up are a handful of settings with one writer, kept in the browser ([ADR 007](decisions/007-setup-in-the-browser.md)):

- **The servers and services are shared between windows,** in `localStorage`. A window follows the others by the browser's `storage` event, and writes only the record it changed.
- **What is current is per window,** in `sessionStorage`: the current server, and the current service of each server.
- **The format has a version.** An older format is converted when it is read. A window that meets a newer format than it knows does not write over it.

A server's setup holds its name, its address, how to log in, and whether it is read-only. A service's setup holds its path, its ID field, how it is loaded, its fields (shown or not, type, order), its sort and its pins.

### The Session

One live object for the active server. Switching to another server ends the session: the connection closes, the views are destroyed, the list of changes is emptied. Two servers at once is two browser windows.

Its states are a state machine's:

| state | means |
|---|---|
| `closed` | made and not opened, or ended |
| `connecting` | trying, and trying again: a development server is often not up yet. The status has the count of failed attempts and the last reason |
| `logging-in` | connected, sending the login |
| `login-needed` | no password in hand, or the server refused it: waiting for the user |
| `ready` | connected, and logged in where the server has a login |
| `lost` | the socket is gone and is being reconnected. The views keep what they show, marked as stale |

A component renders from the session's reactive `status`: the state, the last error, the attempts, and the user the server returned.

When something happens during a transition (the socket drops while logging in), the session does not start a second transition. It notes what is now wanted and acts on the note when the running transition ends.

The session watches the services set up for its server: one added gets a view, one removed loses it.

Logging in is by the `local` strategy, with the names of its fields settable per server, or by a pasted access token. A password stays in memory unless the user chooses to have it remembered ([ADR 008](decisions/008-passwords-in-memory.md)).

### The Service View

One live object per service, there as long as the service is. It holds everything the table, the editor and the list of changes use, and owns a **loader** for the records ([ADR 006](decisions/006-one-service-view-two-loaders.md)).

The view's first act is a probe: one read of a first page through the raw service. From it come a guess at the ID field, a first idea of the records' shape, and the number of records where the server says it. Then it makes the record source and a loader.

| | `WholeLoader` | `PagedLoader` |
|---|---|---|
| holds | every record of the service | the page in view |
| reads with | `find()`, through a `DataManager` that also applies the events and syncs after a reconnect | `findPage()` |
| sort | in the browser: by a column, or by last changed | on the server, by a column |
| filter | a string, matched over every field as it is typed | field, operator, value, sent in the query |
| a change event | applied to the records | applied where the record is on the page |

The developer chooses the loader per service: `auto`, `whole` or `paged`, with `auto` as the default. `auto` lets the count choose each time: whole under a limit, paged over it or when the count is unknown. Loading a service whole when it is over the limit always asks first, with the count.

The view also holds what does not depend on the loader, and survives a change of it: the selection, the pinned records (kept current by their own reads and the events), and the shape. Its writes (`create`, `patch`, `update`, `remove`) call the server and change nothing the view holds: see [the flow of a change](#the-flow-of-a-change).

### The List of Changes

Every change event of every service of the session goes into one list, newest first, bounded in length: the time, the service, the kind of change, the record, and where the view held the record before, the earlier version and the properties that differ. It needs no loading, so it is the same on a service of any size, and it answers the question a developer has most often: what did my code just do.

## A Record

The app does not know the fields of a record, and has to show a record exactly as the server has it. So a record in the app is an envelope:

```ts
interface RecordEnvelope {
    id: string // String(raw[idField]): the key for lookups
    raw: Record<string, unknown> // the server's record, untouched
}
```

The table, the editor and the list of changes read `raw`. Only keys and lookups use `id`. The envelope is made and undone at one place, the record source's conversion ([ADR 005](decisions/005-the-server-is-the-truth.md)).

## The Flow of a Change

```text
the editor            the service view           the Feathers server
    │  patch(id, part)      │                          │
    ├──────────────────────►│  service.patch()         │
    │                       ├─────────────────────────►│
    │                       │        the answer        │
    │   resolves, or the    │◄─────────────────────────┤
    │◄──────────────────────┤                          │
    │   error is shown      │     'patched' event      │
    │                       │◄─────────────────────────┤
    │                       │  the loader applies it   │
    │                       │  Changes records it      │
    │   the table and the   │                          │
    │◄──────────────────────┤                          │
    │   editor re-render    │                          │
```

Nothing the app holds changes when a write is sent, or when its answer comes back. It changes when the server's event arrives, which is also how a change made by anyone else arrives. The app never shows a record the server does not have.

A change to one field is sent as a `patch` of that field's top-level property, not as an `update` of the whole record: an `update` would put back whatever the server changed since the record was opened.

## What Protects a Database

- **A limit on every read.** No `find` is sent without one.
- **The count first,** where the server gives it, and the paged loader when it is large or unknown.
- **A question before a large service is loaded whole,** every time, whatever the service's default.
- **A table that draws only the rows in view,** on either loader.
- **Read-only per server:** the writes are refused in the app, before any call.
- **A confirmation before a remove.**

## What Comes from LiveSystem

`feathers-gui` is not a LiveSystem application: a LiveSystem web app displays one system it knows, and this app is a tool for looking into any. It takes the parts that do the same job ([ADR 003](decisions/003-livesystem-parts.md)):

| part | for |
|---|---|
| `feathers-connect` | the connection, logging in, the record source of a service |
| `LiveObject` | the making and the end of a session and a service view |
| `DataManager` | keeping a service that is loaded whole in step with the server |
| `micro-fsm` | the session's states |
| `MemoryRecordSource` | tests without a server |

## The Interface

The widgets are the app's own: a button, an input, a select, a checkbox, a field, a dialog, a table and a tree ([ADR 009](decisions/009-our-own-widgets.md)). They are in `src/widgets/`, and every one of them is shown, in every state, on a page of the app at `#/widgets`.

A widget names a role (`--ui-accent`), never a color, and a theme says what each of the twelve roles is. A theme is three seeds, from which its other roles are derived, and a test checks that what it makes can be read ([ADR 011](decisions/011-themes-from-seeds.md)). There is a light theme and a dark one; the app follows the system's setting until the user picks. Two have real behavior: the table, which draws only the rows in view, and the tree, which shows a record and edits a value in place.

The page is mounted at once and renders from state. It never waits for a connection.

## Decisions

| ADR | decision |
|---|---|
| [001](decisions/001-a-new-app-for-feathers-5.md) | A new app, for Feathers 5 only, on Vue 3 |
| [002](decisions/002-plain-classes-with-vue-reactivity.md) | Plain TypeScript classes with Vue's reactivity, and no store library |
| [003](decisions/003-livesystem-parts.md) | LiveSystem's parts are used where they fit, and only there |
| [004](decisions/004-the-apps-objects.md) | An app, a session and a service view, each owned directly; one session at a time |
| [005](decisions/005-the-server-is-the-truth.md) | The server is the truth, and a record is an envelope |
| [006](decisions/006-one-service-view-two-loaders.md) | One service view, two loaders, chosen by the developer |
| [007](decisions/007-setup-in-the-browser.md) | The setup is kept in the browser, and works across windows |
| [008](decisions/008-passwords-in-memory.md) | A password stays in memory |
| [009](decisions/009-our-own-widgets.md) | The widgets are the app's own |
| [010](decisions/010-versions-as-branches.md) | Versions are branches, and the app has a version number of its own |
| [011](decisions/011-themes-from-seeds.md) | A theme is a few seeds, and the widgets name roles |
