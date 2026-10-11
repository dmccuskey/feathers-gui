// The session with the active server. A stub: it has only what the app needs to make one and to end it, until
// the session is built with its connection and its states (ADR 004).
import type { Secrets } from './secrets.ts'
import type { ServerSetup, Setup } from './setup.ts'

export interface SessionParts {
    setup: Setup
    secrets: Secrets
}

export class Session {
    readonly serverId: string

    constructor(server: ServerSetup, _parts: SessionParts) {
        this.serverId = server.id
    }

    async open(): Promise<void> {}

    destroy(): void {}
}
