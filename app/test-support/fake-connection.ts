// A connection for a test: it connects at once, or fails with `error`, and its services answer a `find` with what is given.
import { Session, type SessionConnection, type SessionParts } from '../src/app/session.ts'
import type { ServerSetup } from '../src/app/setup.ts'

export interface FakeConnectionOptions {
    /** What each service answers a `find` with, by its path. A path that is not here is refused. */
    services?: Record<string, unknown>
    /** What `connect()` rejects with. */
    error?: Error
}

export function fakeConnection(options: FakeConnectionOptions = {}): SessionConnection {
    const refused = async (): Promise<never> => {
        throw new Error('The fake service takes no writes')
    }

    return {
        connect: async () => {
            if (options.error) throw options.error
        },
        disconnect: async () => {},
        service: path => ({
            find: async () => {
                if (!options.services || !(path in options.services)) throw new Error(`Service not found: ${path}`)

                return options.services[path]
            },
            get: refused,
            create: refused,
            update: refused,
            patch: refused,
            remove: refused,
            on: () => {},
            off: () => {},
        }),
    }
}

/** For `makeSession`: a session that connects to nothing, with the services given. */
export function fakeSessions(
    options: FakeConnectionOptions = {},
): (server: ServerSetup, parts: SessionParts) => Session {
    return (server, parts) => new Session(server, { ...parts, makeConnection: () => fakeConnection(options) })
}
