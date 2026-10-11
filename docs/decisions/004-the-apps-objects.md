# ADR 004: An App, a Session and a Service View, Each Owned Directly

**Status:** Accepted

## Context

The app has two levels. One always runs and needs no connection: the servers and services a user has set up. The other exists only while a server is active: a connection that connects, logs in and can fail, and the services being viewed over it.

`fgui-v4` has this structure (an app controller, a server, a service per service), and it was sound. What made it awkward was what it was built from: an app controller that made itself when its file was imported, objects kept in the Vuex store, and dialogs asked for by an event carrying a deferred promise.

LiveSystem has managers that own objects by the records in a store. Here there are three kinds of object in a fixed tree, and nothing to manage them by.

## Decision

```text
App
  Setup, Secrets, Dialogs
  Session                 none or one, for the active server
    FeathersConnection
    Changes
    ServiceView           one per service of the active server
```

- **Ownership is direct.** The app makes and destroys the session. The session makes and destroys its service views. An owner holds its objects in a `shallowRef` or a plain `Map` ([ADR 002](002-plain-classes-with-vue-reactivity.md)).
- **The app is made by a function,** `createGuiApp()`, and provided to the components. Nothing is made by importing a file.
- **One session at a time.** Activating another server ends the session there is: its connection closes, its views are destroyed, its list of changes is emptied. Two servers at once is two browser windows ([ADR 007](007-setup-in-the-browser.md)).
- **The session follows the setup.** A service added to the active server gets a view, and one removed loses it. A change to the server's address or login replaces the session.
- **Only the app opens dialogs.** A session or a view that needs something of the user says so in its status. A flow with a dialog is an `async` method of the app that awaits the dialog's answer.
- **The session's states are a state machine's:** `closed`, `connecting`, `logging-in`, `login-needed`, `ready`, `lost`. A transition wanted while another runs is noted and made when that one ends.

## Consequences

- Each object can be made alone in a test, given a setup and a connection.
- A change to a server's address reconnects. In `fgui-v4` it did not.
- Coming back to a server reconnects and reloads, and its list of changes starts empty.
- A session per opened server, all connected, is a small step from here (a `Map` of sessions and an active ID), since nothing is global. It was left out for the interface it needs: a status per server, and connections the user does not see.
