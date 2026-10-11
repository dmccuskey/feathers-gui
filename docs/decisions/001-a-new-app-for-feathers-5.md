# ADR 001: A New App, for Feathers 5 Only, on Vue 3

**Status:** Accepted

## Context

`feathers-gui` was last changed in June 2023. The app, `fgui-v4`, is built on Vue 2, objects made with `Vue.extend`, Vuex, Element UI and the Feathers 4 client. Vue 2 is past its end of life, and Feathers 5 has been out since March 2023.

The older Feathers versions were supported because the author's own projects still ran on them. That is no longer a reason to keep them.

Nearly every file of `fgui-v4` rests on something that is being replaced, so an update in place would touch all of it and keep its shape, which was set by what `Vue.extend` could do.

## Decision

- The new version is a new app, on Vue 3 and TypeScript, built with Bun and Vite.
- It supports Feathers 5 only. Feathers 3 and 4 are dropped.
- `fgui-v4` is the reference for what the app does. Its code is not carried forward.
- `fgui-v4` stays available, as it is and unchanged: see [ADR 010](010-versions-as-branches.md).

## Consequences

- The design can start from what the app is for, not from the old code. ADRs [002](002-plain-classes-with-vue-reactivity.md) to [009](009-our-own-widgets.md) are what that led to.
- A developer on Feathers 4 uses the old version, which gets no fixes.
- Everything is rewritten, the parts that worked included. The list of what `fgui-v4` does has to be kept beside the work so that nothing is lost without a decision.
