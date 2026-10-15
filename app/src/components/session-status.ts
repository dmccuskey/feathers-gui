// What the interface says of the session: a tone for its dot, a line, a reason under it, and the button it
// offers. "Try Now", while trying again, comes later.
import type { SessionStatus } from '../app/session.ts'
import type { LoginSetup } from '../app/setup.ts'

export interface StatusText {
    /** `off`: not connected; `busy`: on its way, or waiting for the user; `ok`: ready. */
    tone: 'off' | 'busy' | 'ok'
    /** The main line's first words, in bold. */
    strong?: string
    /** The rest of the main line. */
    line: string
    /** Small, under the line: the reason of the last failure. */
    detail?: string
    action?: 'log-in' | 'log-out'
}

/** `status`: the session's, or none when there is no session. `login`: the server's, as set up. */
export function statusText(status: Readonly<SessionStatus> | undefined, login: LoginSetup | undefined): StatusText {
    const reason = status?.error?.message
    const detail = reason === undefined ? {} : { detail: reason }

    switch (status?.phase) {
        case undefined:
        case 'closed':
            return { tone: 'off', line: 'Not connected', ...detail }
        case 'connecting':
            return status.attempts === 0
                ? { tone: 'busy', line: 'Connecting…' }
                : { tone: 'busy', strong: 'Can’t reach the server.', line: 'Trying again soon…', ...detail }
        case 'lost':
            return status.attempts === 0
                ? { tone: 'busy', strong: 'Connection lost.', line: 'Reconnecting…' }
                : { tone: 'busy', strong: 'Connection lost.', line: 'Trying again soon…', ...detail }
        case 'logging-in':
            return { tone: 'busy', line: 'Logging in…' }
        case 'login-needed':
            return { tone: 'busy', strong: 'Not logged in.', line: '', ...detail, action: 'log-in' }
        case 'ready': {
            if (!login) return { tone: 'ok', line: 'Connected' }

            const who = login.kind === 'local' ? login.username : userName(status.user)

            return { tone: 'ok', line: who ? `Connected as ${who}` : 'Connected', action: 'log-out' }
        }
    }
}

/** What a user record is known by: its `email`, else its `name`, else its ID. */
function userName(user: Record<string, unknown> | undefined): string | undefined {
    const name = user?.email ?? user?.name ?? user?.id ?? user?._id

    return name === undefined || name === null ? undefined : String(name)
}
