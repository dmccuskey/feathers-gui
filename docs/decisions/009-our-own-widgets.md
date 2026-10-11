# ADR 009: The Widgets Are the App's Own

**Status:** Accepted

## Context

`fgui-v4` uses Element UI, a full component library, for an interface that needs very little: buttons, inputs, selects, checkboxes, dialogs and a table. The library set the look, weighs far more than what is used of it, and is one more thing that would have to move from Vue 2 to Vue 3.

Two parts of the new interface have real behavior, and a general library would not supply either as needed: a table that draws only the rows in view, so that ten thousand records do not become ten thousand rows in the page; and a tree that shows a record of any shape, nested values included, and edits a value where it stands.

## Decision

- The app has seven widgets of its own: a button, an input, a select, a checkbox, a dialog, a table and a tree.
- They are a folder in the app (`src/widgets/`), not a package. They move out only if a second project wants them.
- The first five are thin: native elements, styled, with the keyboard and focus behavior a native element already has.
- The table and the tree are written for this app's two jobs.

## Consequences

- A small bundle, a look of its own, and no component library to keep up with.
- The table and the tree are real work, and the place where most of the interface's bugs will be.
- What a library gives without being asked (accessibility, edge cases in a dialog's focus) has to be done on purpose.
- A widget that turns out to be needed is written, which keeps the count honest.
