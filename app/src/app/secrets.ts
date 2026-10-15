// The secrets typed in this window, by server: the password of a server's login, or the access token pasted for
// it. They are held in memory only, so that going to another server and back does not ask again, and they end
// with the window (ADR 008). One that the user chose to have remembered is in the server's setup, not here.
//
// The windows of the app share them over a `BroadcastChannel`: a window without a server's secret asks the others,
// a new secret replaces the one each window holds, and one the server refused is forgotten wherever it is held.
// Forgetting it for another reason (logging out, a server removed) is each window's own.

export interface SecretsOptions {
    /** The channel the windows share their secrets on. `null`: this window keeps its own. Default: `feathers-gui:secrets`. */
    channel?: string | null
    /** How long to wait for another window to answer, in milliseconds. Default: 250. */
    askWait?: number
}

type Message =
    | { kind: 'ask'; askId: string; serverId: string }
    | { kind: 'answer'; askId: string; serverId: string; secret: string }
    | { kind: 'set'; serverId: string; secret: string }
    | { kind: 'refused'; serverId: string; secret: string }

interface Asking {
    serverId: string
    done: (secret: string | undefined) => void
}

export const SECRETS_CHANNEL = 'feathers-gui:secrets'
const ASK_WAIT = 250

export class Secrets {
    readonly #secrets = new Map<string, string>()
    #channel: BroadcastChannel | null
    readonly #askWait: number
    // What this window is asking the others, by the ask's ID, and the answer awaited, by server
    readonly #asking = new Map<string, Asking>()
    readonly #answers = new Map<string, Promise<string | undefined>>()
    readonly #setListeners = new Set<(serverId: string) => void>()

    constructor(options: SecretsOptions = {}) {
        const name = options.channel === undefined ? SECRETS_CHANNEL : options.channel

        this.#askWait = options.askWait ?? ASK_WAIT
        this.#channel = name === null ? null : new BroadcastChannel(name)
        this.#channel?.addEventListener('message', event => this.#hear(event.data as Message))
    }

    /**
     * The password or the access token for the server, whichever its login takes: the one this window holds, else
     * the one another window answers with, which this window then holds. `undefined` when no window has one.
     */
    get(serverId: string): Promise<string | undefined> {
        const held = this.#secrets.get(serverId)

        if (held !== undefined || !this.#channel) return Promise.resolve(held)

        return this.#answers.get(serverId) ?? this.#ask(serverId)
    }

    /** The secret this window holds for the server, without asking the others. */
    held(serverId: string): string | undefined {
        return this.#secrets.get(serverId)
    }

    has(serverId: string): boolean {
        return this.#secrets.has(serverId)
    }

    /**
     * Holds the secret in place of the one there was, in every window. An empty one is none: it is the same as
     * `forget()`, and only this window's.
     */
    set(serverId: string, secret: string): void {
        if (secret === '') {
            this.forget(serverId)

            return
        }
        this.#secrets.set(serverId, secret)
        this.#send({ kind: 'set', serverId, secret })
        this.#told(serverId)
    }

    /** Calls the listener with the server's ID each time a secret is set, in this window or another. */
    onSet(listener: (serverId: string) => void): () => void {
        this.#setListeners.add(listener)

        return () => void this.#setListeners.delete(listener)
    }

    /** Forgets the secret in this window only: for logging out, a login that changed, or a server that was removed. */
    forget(serverId: string): void {
        this.#secrets.delete(serverId)
    }

    /** The server refused this secret: every window that holds it forgets it, and keeps another it holds. */
    refused(serverId: string, secret: string): void {
        this.#forgetIfHeld(serverId, secret)
        this.#send({ kind: 'refused', serverId, secret })
    }

    /** Forgets them all, and stops sharing. An answer awaited is none. */
    destroy(): void {
        this.#secrets.clear()
        this.#setListeners.clear()
        for (const asking of [...this.#asking.values()]) asking.done(undefined)
        this.#channel?.close()
        this.#channel = null
    }

    #ask(serverId: string): Promise<string | undefined> {
        const askId = crypto.randomUUID()
        const answer = new Promise<string | undefined>(resolve => {
            const timer = setTimeout(() => done(undefined), this.#askWait)
            const done = (secret: string | undefined): void => {
                clearTimeout(timer)
                this.#asking.delete(askId)
                this.#answers.delete(serverId)
                if (secret !== undefined && !this.#secrets.has(serverId)) this.#secrets.set(serverId, secret)
                // One set in this window meanwhile is the newer
                resolve(this.#secrets.get(serverId))
            }

            this.#asking.set(askId, { serverId, done })
        })

        this.#answers.set(serverId, answer)
        this.#send({ kind: 'ask', askId, serverId })

        return answer
    }

    #hear(message: Message): void {
        switch (message.kind) {
            case 'ask': {
                const secret = this.#secrets.get(message.serverId)

                if (secret !== undefined) {
                    this.#send({ kind: 'answer', askId: message.askId, serverId: message.serverId, secret })
                }
                break
            }
            case 'answer':
                this.#asking.get(message.askId)?.done(message.secret)
                break
            case 'set':
                this.#secrets.set(message.serverId, message.secret)
                this.#told(message.serverId)
                break
            case 'refused':
                this.#forgetIfHeld(message.serverId, message.secret)
                break
        }
    }

    #told(serverId: string): void {
        for (const listener of [...this.#setListeners]) listener(serverId)
    }

    #forgetIfHeld(serverId: string, secret: string): void {
        if (this.#secrets.get(serverId) === secret) this.#secrets.delete(serverId)
    }

    #send(message: Message): void {
        this.#channel?.postMessage(message)
    }
}
