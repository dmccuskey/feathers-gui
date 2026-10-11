# ADR 005: The Server Is the Truth, and a Record Is an Envelope

**Status:** Accepted

## Context

`feathers-gui` exists so that a developer can see the records a server creates, change them, and watch how the server and its other clients react. So what the app shows must be what the server has. A record shown as the app sent it, when a hook on the server changed it on the way in, would be a lie in exactly the place the tool is for.

Two things get in the way:

- **A write and its effect are two messages.** A Feathers server answers a write, and also sends a change event to every client that may hear it, the writer included.
- **A client library reshapes a record.** `feathers-connect` hands on a record with its ID under the name `id`, as a string, whatever the server calls it. A record whose ID field is `_id` arrives without `_id`. An editor has to show `_id`, with the value and the type the server has.

## Decision

- **What the app holds changes only by the server's events.** A write calls the server and changes nothing held: not when it is sent, and not when its answer comes back. There are no optimistic updates. `fgui-v4` already worked this way.
- **A record in the app is an envelope:**

  ```ts
  interface RecordEnvelope {
      id: string // String(raw[idField])
      raw: Record<string, unknown> // the server's record, untouched
  }
  ```

  The table, the editor and the list of changes read `raw`. Only keys and lookups use `id`.
- **The envelope is made and undone in one place:** the `convert` option of the record source, whose `read` wraps what comes in (reads, the answers of writes, the four events) and whose `write` unwraps what goes out.
- **A change to one field is a `patch`** of that field's top-level property. An `update` replaces the record, and would put back what the server changed since the record was opened. `update` is offered as "replace the record", for when a property is to be removed.
- **Change events are never dropped,** whatever page or filter is shown. A Feathers server sends every change of a service to its clients, and each event carries the record. They all go into the list of changes, which is bounded by its length.

## Consequences

- A change made by the app and a change made by anyone else arrive the same way and are shown the same way.
- A hook that alters or refuses a write is visible: the record on screen is the server's, and a refusal is the write's error.
- After a write there is a moment before the event arrives in which the screen still shows the old value. The editor has to show that a write is under way.
- The app hears only what the server's channels publish to its connection. A server that publishes nothing to it shows no changes until a reload.
- A number ID stays a number where it is shown, and is a string only as a key.
