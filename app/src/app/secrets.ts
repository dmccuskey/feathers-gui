// The secrets typed in this window, by server: the password of a server's login, or the access token pasted for
// it. They are held in memory only, so that going to another server and back does not ask again, and they end
// with the window (ADR 008). One that the user chose to have remembered is in the server's setup, not here.

export class Secrets {
    readonly #secrets = new Map<string, string>()

    /** The password or the access token in hand for the server, whichever its login takes. */
    get(serverId: string): string | undefined {
        return this.#secrets.get(serverId)
    }

    has(serverId: string): boolean {
        return this.#secrets.has(serverId)
    }

    /** Holds the secret in place of the one there was. An empty one is none: it is the same as `forget()`. */
    set(serverId: string, secret: string): void {
        if (secret === '') this.#secrets.delete(serverId)
        else this.#secrets.set(serverId, secret)
    }

    /** For a secret the server refused, a login that changed, or a server that was removed. */
    forget(serverId: string): void {
        this.#secrets.delete(serverId)
    }

    /** Forgets them all. */
    destroy(): void {
        this.#secrets.clear()
    }
}
