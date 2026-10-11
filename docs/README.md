# feathers-gui Documentation

`feathers-gui` is being rebuilt as a new app for Feathers 5. These pages describe the new version, which is not written yet. To use the app as it is today, see the [main README](../README.md).

## Internals

- [Architecture](architecture.md): the objects of the new version, how a record and a change flow through them, and what protects a database
- [Architecture Decisions](decisions/): the decision records (ADRs), listed in [the architecture page](architecture.md#decisions)

## Project Structure

```text
feathers-gui/
├── fgui-v4/                  # the current app, for Feathers 4
├── fgui-v3/                  # a placeholder
├── docs/
│   ├── README.md             # this page
│   ├── architecture.md
│   └── decisions/            # ADRs
└── README.md
```

The structure changes when the new app arrives: see [ADR 010](decisions/010-versions-as-branches.md).
