# ADR 002: Plain TypeScript Classes with Vue's Reactivity, and No Store Library

**Status:** Accepted

## Context

`fgui-v4` builds its five objects (the app controller, a server, a service, and the Feathers side of each) as `Vue.extend({ props, data, computed, methods })` with no template. Each is made by a `create()` function and ended by `destroy()`. The objects themselves are kept in the Vuex store, which is how a component reaches one.

Vue 3 offers its reactivity as a library (`ref`, `shallowRef`, `computed`, `watch`) that works outside components. [LiveSystem](https://github.com/dmccuskey/live-system) settled a pattern on it, and this app follows that pattern.

## Decision

- The app's objects are plain TypeScript classes. They use Vue's reactivity for the state that a component, or another object, has to react to.
- An object gets what it needs in its constructor and is complete from then on.
- What an object keeps to itself is `#private`.
- **An object with `#private` fields is never put into reactive state.** `reactive()` and `ref()` wrap an object in a proxy, and a method called through the proxy cannot reach its own `#fields`. An owner keeps its objects in a plain `Map` or a `shallowRef`.
- **An object stops what it starts.** Outside a component nothing is cleaned up for it: a `watch()` and a listener each return a function that ends them, and the object calls them all when it is destroyed.
- There is no store library: no Vuex and no Pinia. State lives in the objects. The records of a service that is loaded whole are in a small store object that belongs to its loader.
- Components reach the objects through the app, which is provided to them (`useApp()`).

## Consequences

- Constructors, inheritance, interfaces, generics and private state are available, and the objects can be made in a test with their dependencies passed in.
- The pairs of `fgui-v4` (a server and its Feathers side, a service and its Feathers side) become one class each, since the library below them does what the lower half did.
- The rule about `#private` fields and proxies has to be known by whoever writes an owner. Getting it wrong fails at run time with a `TypeError` on the first private field read.
- Cleaning up is by hand. A forgotten "stop" function is a leak that nothing reports.
