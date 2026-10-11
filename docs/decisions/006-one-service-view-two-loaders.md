# ADR 006: One Service View, Two Loaders, Chosen by the Developer

**Status:** Accepted

## Context

`fgui-v4` sends one `find()` with no query and keeps the first page, so a paginated service shows its default limit and no more.

There are two honest ways to show a service. Load every record and keep it current: then the app can search every field as the user types and sort by anything. Or show a page at a time: the only way that works on a large service. A development database is small, but the app may be pointed at production, and it is used from a hosted copy by people who have not read this.

Which way a service needs is not known when the service appears. The app first has to read a page of it, to guess the ID field and to get the count. That read can fail. And the way can change while the service is on screen.

An earlier form of this decision was two view classes under one base, so that the table and the editor would not know which they had. It left no place for a service before its first read, and it rebuilt the selection and the pins on a change from one way to the other.

## Decision

- **A service has one view,** which exists as long as the service does. It owns a **loader**, one of two kinds behind one interface:

  | | `WholeLoader` | `PagedLoader` |
  |---|---|---|
  | holds | every record | the page in view |
  | reads with | `find()`, through a `DataManager` | `findPage()` |
  | sort | in the browser: a column, or last changed | on the server: a column |
  | filter | a string over every field, as it is typed | field, operator, value, in the query |

- **The view probes first:** one read of a first page through the raw service, for the ID field, the shape and the count.
- **The developer chooses,** per service: `auto`, `whole` or `paged`. The choice is offered when a service is added, with `auto` selected.
- **`auto` lets the count choose, each time the view is made:** whole under a limit, paged over it or when the count is unknown.
- **The service's default changes only on purpose.** A switch at the service changes the loader for now. Making that the default is a separate step.
- **Loading whole over the limit always asks first,** with the count, or saying that it is unknown. This holds when `whole` is the service's default too. Until the answer, the view is paged. The question is a line in the service's own view, not a popup: a session opens all its services at once.
- **Searching by a string as it is typed needs the whole loader.** Feathers has no "contains this anywhere" on the server. On the paged loader the search says so and offers the switch.
- **"Last changed" means the change events of this session,** not a field of the record. A field such as `updatedAt` is a column like any other, and on the paged loader its order is the server's.
- What does not depend on the loader stays with the view across a change of it: the selection, the pins, the shape.

## Consequences

- The table, the editor and the list of changes use the view and never know the loader.
- A service can be seen while it is being probed, and when the probe fails: the view is there to say so.
- A service that has grown, or a setup pointed at a larger database, is met paged without anyone having to remember.
- On a paged service there is no free-text search and no order by last change. The list of changes, the pins and a record fetched by its ID are how the records that matter are reached there.
- A developer who always wants a large service whole is asked each time. Whether the answer should be remembered, and for how long, is left until the app is in use.
- Reading a large service page by page to search it (a scan) was considered and left undecided: it is close to loading the service whole.
