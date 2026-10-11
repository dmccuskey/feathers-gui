# ADR 010: Versions Are Branches, and the App Has a Version Number of Its Own

**Status:** Accepted

## Context

`master` holds the versions in folders: `fgui-v4/`, the app for Feathers 4, and `fgui-v3/`, a placeholder with a README. A version was named for the Feathers version it served.

A folder per version puts every version in every checkout, makes a tag or a release mean all of them at once, and has each change to a shared file touch versions that are meant to be frozen. And with one supported Feathers version ([ADR 001](001-a-new-app-for-feathers-5.md)), a name that carries the Feathers version no longer says anything.

## Decision

- **`master` holds the newest version,** with no folder per version: the app in `app/`, packages beside it in `packages/`, and `README.md` and `docs/` at the root.
- **An older version is a branch,** made when the new version replaces it: `feathers-4`, with the contents of `fgui-v4/` at its root. It is kept as it is.
- **Feathers 3 is a tag,** `feathers-3`, at the commit where the app last used the Feathers 3 client.
- **The app is `feathers-gui`,** with no number in its name.
- **Its version is its own, by semantic versioning.** It continues from `fgui-v4`'s `0.5.0`: `0.x` while it is built, `1.0.0` for its first release. A major number rises when the app breaks something of its own, such as the format of the saved setup, not when Feathers does.
- **What it works with is stated, not encoded:** a table in the README from app version to Feathers version, and from Feathers version to branch.
- **Releases are tags** (`v1.0.0`) on `master`.

## Consequences

- A checkout holds one version, and a tag means one thing.
- The old version stays findable and can stay online from its branch.
- Links into `fgui-v4/` on `master` break when the new app replaces it.
- Until then `master` keeps its folders: the move happens with the new app, not before.
