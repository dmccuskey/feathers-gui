# ADR 008: A Password Stays in Memory

**Status:** Accepted

## Context

`fgui-v4` keeps a server's login, password included, in `localStorage` in plain text, as part of the server's setup. On the hosted copy that is the browser's storage for a public site, readable by any script that runs on that origin.

Against that: this is a tool for development, used many times a day, and a tool that asks for a password at every turn is one that people stop using. A Feathers access token cannot be renewed without the password and lasts a day by default, so keeping the token in place of the password would mean typing the password every day.

## Decision

- **A password is kept in memory only,** by the app, for as long as the window is open. Going to another server and back does not ask again.
- **"Remember" is a choice per server.** With it on, the password itself is kept with the server's setup in `localStorage`, and the dialog says that it is stored as plain text. It is off unless the user turns it on.
- **Windows share what they hold in memory:** a new window asks the open ones for a server's password, over a channel of the browser's for pages of the same origin. Nothing is written anywhere.
- **The access token a login returns is never stored.** It stays inside the connection, in memory, and each connection has its own.
- **A pasted access token is kept as a password is:** in memory, or with the server's setup when "remember" is on for it. It is the user's only way in to such a server, and nobody should have to write a token down to paste it again.
- **The logins offered** are the `local` strategy, with the names of its two fields settable per server, and a pasted access token for a server that logs in another way.
- **When a login is lost** (the token ran out, or the server refused it), the session logs in again with the password it can get, and asks for it when it has none.
- **An exported setup has no passwords.**

## Consequences

- By default nothing secret is at rest in the browser.
- A password is typed once per browser session, not once per window or per server switch.
- A user who turns "remember" on has what `fgui-v4` had, having been told.
- A password in memory is still within reach of a script on the page.
