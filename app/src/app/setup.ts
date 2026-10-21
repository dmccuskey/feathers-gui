// The user's setup: the servers and services set up, and what is current in this window. It saves itself in the
// browser, and follows the other windows of the app (ADR 007).
import { shallowRef } from 'vue'

/** The key in `localStorage` of the servers and services, shared by every window. */
export const SETUP_KEY = 'feathers-gui.setup'
/** The key in `localStorage` of the server used last in any window: where a new window starts. */
export const LAST_SERVER_KEY = 'feathers-gui.last-server'
/** The key in `sessionStorage` of what is current in this window. */
export const CURRENT_KEY = 'feathers-gui.current'
/** The version of the stored format that this code reads and writes. */
export const SETUP_VERSION = 1

export interface LoginSetup {
    kind: 'local' | 'token'
    path: string
    usernameField: string
    passwordField: string
    username: string
    remember: boolean
    /** The password, or the token pasted for a login of kind `token`. Only when `remember` is on. Stored as plain text. */
    password?: string
}

export interface ServerSetup {
    id: string
    name: string
    url: string
    login?: LoginSetup
    readOnly: boolean
}

export type FieldType = 'array' | 'boolean' | 'date' | 'number' | 'object' | 'string'

export interface FieldSetup {
    name: string
    show: boolean
    type: FieldType
    /** Whether the user picked the type, and it was not guessed. */
    typePicked: boolean
}

export interface ServiceSetup {
    id: string
    serverId: string
    path: string
    /** Unset: guessed from a first page. */
    idField?: string
    load: 'auto' | 'whole' | 'paged'
    /** In column order. */
    fields: FieldSetup[]
    /** Record IDs. */
    pins: string[]
    /** How its records are sorted. Unset: by last changed. */
    sort?: ViewSort
}

/**
 * How a service's records are sorted. `last-changed`: by the change events of this session, newest first, then the
 * records not changed in ID order. `field`: by a field's values, as its type compares them.
 */
export type ViewSort = { by: 'last-changed' } | { by: 'field'; field: string; descending: boolean }

/**
 * Whether the stored setup can be used. `newer`: it was written by a newer version of the app, and this window
 * needs a reload. `unreadable`: it is not a setup at all. In both, nothing is written over it.
 */
export type SetupStatus = 'ok' | 'newer' | 'unreadable'

/** Thrown by a write when the stored setup is not one this window may write over. */
export class SetupBlockedError extends Error {
    constructor(readonly status: Exclude<SetupStatus, 'ok'>) {
        super(
            status === 'newer'
                ? 'The setup was saved by a newer version of the app. Reload the page.'
                : 'The setup stored in the browser cannot be read.',
        )
        this.name = 'SetupBlockedError'
    }
}

/** Thrown by `import()` for a file that cannot be taken in. Nothing was changed. */
export class SetupImportError extends Error {
    constructor(message: string) {
        super(message)
        this.name = 'SetupImportError'
    }
}

/** What `Setup` needs of a `Storage`. */
export type KeyValueStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

export interface SetupOptions {
    /** Shared by the windows. Default: `localStorage`. */
    local?: KeyValueStorage
    /** This window's own. Default: `sessionStorage`. */
    session?: KeyValueStorage
    /** Where the browser's `storage` events arrive. Default: `window`. */
    events?: EventTarget
}

interface StoredSetup {
    version: number
    servers: ServerSetup[]
    services: ServiceSetup[]
}

interface Current {
    serverId: string | null
    /** The current service of each server, by server ID. */
    serviceIds: Record<string, string>
}

type ReadResult = { status: 'ok'; stored: StoredSetup } | { status: Exclude<SetupStatus, 'ok'> }

export class Setup {
    readonly #local: KeyValueStorage
    readonly #session: KeyValueStorage
    readonly #events: EventTarget

    readonly #status = shallowRef<SetupStatus>('ok')
    readonly #servers = shallowRef<readonly ServerSetup[]>([])
    readonly #services = shallowRef<readonly ServiceSetup[]>([])
    readonly #current = shallowRef<Current>({ serverId: null, serviceIds: {} })

    constructor(options: SetupOptions = {}) {
        this.#local = options.local ?? window.localStorage
        this.#session = options.session ?? window.sessionStorage
        this.#events = options.events ?? window

        this.#current.value = this.#readCurrent()
        this.#load()
        this.#events.addEventListener('storage', this.#onStorage)
    }

    /** Stops following the other windows. */
    destroy(): void {
        this.#events.removeEventListener('storage', this.#onStorage)
    }

    get status(): SetupStatus {
        return this.#status.value
    }

    get servers(): readonly ServerSetup[] {
        return this.#servers.value
    }

    servicesOf(serverId: string): readonly ServiceSetup[] {
        return this.#services.value.filter(service => service.serverId === serverId)
    }

    server(id: string): ServerSetup | undefined {
        return this.#servers.value.find(server => server.id === id)
    }

    service(id: string): ServiceSetup | undefined {
        return this.#services.value.find(service => service.id === id)
    }

    // What is current: per window, not shared.

    get currentServerId(): string | null {
        return this.#current.value.serverId
    }

    set currentServerId(serverId: string | null) {
        if (serverId !== null && !this.server(serverId)) throw new Error(`No server with the ID "${serverId}"`)

        this.#setCurrent({ ...this.#current.value, serverId })

        if (serverId !== null) this.#local.setItem(LAST_SERVER_KEY, serverId)
    }

    /** Kept per server, so a switch of server comes back to where it was. */
    currentServiceId(serverId: string): string | null {
        return this.#current.value.serviceIds[serverId] ?? null
    }

    setCurrentService(serverId: string, serviceId: string | null): void {
        const serviceIds = { ...this.#current.value.serviceIds }

        if (serviceId === null) {
            delete serviceIds[serverId]
        } else {
            if (this.service(serviceId)?.serverId !== serverId) {
                throw new Error(`No service with the ID "${serviceId}" on the server "${serverId}"`)
            }

            serviceIds[serverId] = serviceId
        }

        this.#setCurrent({ ...this.#current.value, serviceIds })
    }

    // The writes. Each reads what is stored now and changes the one record in it, so that what another window
    // wrote meanwhile is kept.

    addServer(data: Omit<ServerSetup, 'id'>): ServerSetup {
        const server = cleanServer({ ...data, id: crypto.randomUUID() })

        this.#change(stored => {
            stored.servers.push(server)
        })

        return server
    }

    updateServer(id: string, changes: Partial<Omit<ServerSetup, 'id'>>): void {
        this.#change(stored => {
            const index = stored.servers.findIndex(server => server.id === id)
            const server = stored.servers[index]

            if (!server) throw new Error(`No server with the ID "${id}"`)

            stored.servers[index] = cleanServer({ ...server, ...changes, id })
        })
    }

    /** Removes the server and its services. */
    removeServer(id: string): void {
        this.#change(stored => {
            stored.servers = stored.servers.filter(server => server.id !== id)
            stored.services = stored.services.filter(service => service.serverId !== id)
        })
    }

    addService(data: Omit<ServiceSetup, 'id'>): ServiceSetup {
        const service: ServiceSetup = { ...data, id: crypto.randomUUID() }

        this.#change(stored => {
            if (!stored.servers.some(server => server.id === service.serverId)) {
                throw new Error(`No server with the ID "${service.serverId}"`)
            }

            stored.services.push(service)
        })

        return service
    }

    updateService(id: string, changes: Partial<Omit<ServiceSetup, 'id' | 'serverId'>>): void {
        this.#change(stored => {
            const index = stored.services.findIndex(service => service.id === id)
            const service = stored.services[index]

            if (!service) throw new Error(`No service with the ID "${id}"`)

            stored.services[index] = { ...service, ...changes, id, serverId: service.serverId }
        })
    }

    removeService(id: string): void {
        this.#change(stored => {
            stored.services = stored.services.filter(service => service.id !== id)
        })
    }

    /** The servers and services as JSON, without passwords. */
    export(): string {
        const servers = this.#servers.value.map(server => {
            if (!server.login) return server

            const { password: _password, ...login } = server.login

            return { ...server, login }
        })

        return JSON.stringify({ version: SETUP_VERSION, servers, services: this.#services.value }, null, 4)
    }

    /**
     * Takes in an exported setup. `merge`: a record with an ID that is set up here is replaced, the others are
     * added, and nothing is removed. `replace`: what is set up here goes, and the imported setup takes its place.
     * Either way, a server that stays keeps the password remembered for it.
     */
    import(json: string, how: 'merge' | 'replace'): void {
        const result = parseSetup(json)

        if (result.status !== 'ok' || !hasRecords(result.stored)) {
            throw new SetupImportError(
                result.status === 'newer'
                    ? 'The file was exported by a newer version of the app.'
                    : 'The file is not an exported setup.',
            )
        }

        const imported = result.stored

        this.#change(stored => {
            const passwords = new Map(stored.servers.map(server => [server.id, server.login?.password]))
            const servers = imported.servers.map(server => {
                const password = server.login?.password ?? passwords.get(server.id)

                return cleanServer(server.login && password !== undefined ? withPassword(server, password) : server)
            })

            stored.servers = how === 'merge' ? mergeById(stored.servers, servers) : servers
            stored.services = (
                how === 'merge' ? mergeById(stored.services, imported.services) : imported.services
            ).filter(service => stored.servers.some(server => server.id === service.serverId))
        })
    }

    /** Reads what is stored, makes the change in it, and stores and shows the result. */
    #change(change: (stored: StoredSetup) => void): void {
        const result = this.#read()

        if (result.status !== 'ok') {
            this.#status.value = result.status
            throw new SetupBlockedError(result.status)
        }

        change(result.stored)
        this.#local.setItem(SETUP_KEY, JSON.stringify(result.stored))
        this.#show(result.stored)
    }

    #onStorage = (event: Event): void => {
        const key = (event as StorageEvent).key

        // A key of null: the storage was cleared.
        if (key === null || key === SETUP_KEY) this.#load()
    }

    /** Takes over what is stored. What is not usable is left alone, and this window keeps what it shows. */
    #load(): void {
        const result = this.#read()

        if (result.status === 'ok') this.#show(result.stored)
        else this.#status.value = result.status
    }

    #read(): ReadResult {
        const text = this.#local.getItem(SETUP_KEY)

        if (text === null) return { status: 'ok', stored: { version: SETUP_VERSION, servers: [], services: [] } }

        return parseSetup(text)
    }

    /** A record that did not change stays the object it was, so what watches it is not told of a change. */
    #show(stored: StoredSetup): void {
        this.#status.value = 'ok'
        this.#servers.value = keepUnchanged(this.#servers.value, stored.servers)
        this.#services.value = keepUnchanged(this.#services.value, stored.services)
        this.#setCurrent(this.#current.value)
    }

    #readCurrent(): Current {
        try {
            const value: unknown = JSON.parse(this.#session.getItem(CURRENT_KEY) ?? 'null')

            if (isCurrent(value)) return value
        } catch {
            // Not ours, or damaged: begin as a new window does.
        }

        return { serverId: this.#local.getItem(LAST_SERVER_KEY), serviceIds: {} }
    }

    /** Sets what is current, less what is no longer set up, and saves it when it changed. */
    #setCurrent(wanted: Current): void {
        const serverId = wanted.serverId !== null && this.server(wanted.serverId) ? wanted.serverId : null
        const serviceIds: Record<string, string> = {}

        for (const [ofServer, serviceId] of Object.entries(wanted.serviceIds)) {
            if (this.service(serviceId)?.serverId === ofServer) serviceIds[ofServer] = serviceId
        }

        const current: Current = { serverId, serviceIds }
        const text = JSON.stringify(current)

        if (text !== JSON.stringify(this.#current.value)) this.#current.value = current
        if (text !== this.#session.getItem(CURRENT_KEY)) this.#session.setItem(CURRENT_KEY, text)
    }
}

/** Reads a setup as it is stored or exported. */
function parseSetup(text: string): ReadResult {
    let value: unknown

    try {
        value = JSON.parse(text)
    } catch {
        return { status: 'unreadable' }
    }

    if (!isStoredSetup(value)) return { status: 'unreadable' }
    if (value.version > SETUP_VERSION) return { status: 'newer' }

    // An older version is converted here, once there is one.
    return { status: 'ok', stored: value }
}

/** A password is kept only where the user chose to have it remembered (ADR 008). */
function cleanServer(server: ServerSetup): ServerSetup {
    if (!server.login || server.login.remember || server.login.password === undefined) return server

    const { password: _password, ...login } = server.login

    return { ...server, login }
}

function withPassword(server: ServerSetup, password: string): ServerSetup {
    return server.login ? { ...server, login: { ...server.login, password } } : server
}

/** The records there are, each replaced by the incoming one of its ID, and then the incoming ones that are new. */
function mergeById<T extends { id: string }>(records: readonly T[], incoming: readonly T[]): T[] {
    const byId = new Map(incoming.map(record => [record.id, record]))
    const known = new Set(records.map(record => record.id))

    return [
        ...records.map(record => byId.get(record.id) ?? record),
        ...incoming.filter(record => !known.has(record.id)),
    ]
}

/** Whether every record has what the rest of the app looks a record up by. A file may come from anywhere. */
function hasRecords(setup: StoredSetup): boolean {
    const strings = (record: unknown, names: string[]): boolean =>
        isObject(record) && names.every(name => typeof record[name] === 'string')

    return (
        setup.servers.every(server => strings(server, ['id', 'name', 'url'])) &&
        setup.services.every(service => strings(service, ['id', 'serverId', 'path']))
    )
}

function keepUnchanged<T extends { id: string }>(shown: readonly T[], stored: readonly T[]): readonly T[] {
    const byId = new Map(shown.map(record => [record.id, record]))
    const next = stored.map(record => {
        const old = byId.get(record.id)

        return old && JSON.stringify(old) === JSON.stringify(record) ? old : record
    })

    return next.length === shown.length && next.every((record, index) => record === shown[index]) ? shown : next
}

function isObject(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isStoredSetup(value: unknown): value is StoredSetup {
    return (
        isObject(value) &&
        typeof value.version === 'number' &&
        // A newer format may have other members: only its version is read.
        (value.version > SETUP_VERSION || (Array.isArray(value.servers) && Array.isArray(value.services)))
    )
}

function isCurrent(value: unknown): value is Current {
    return (
        isObject(value) &&
        (value.serverId === null || typeof value.serverId === 'string') &&
        isObject(value.serviceIds) &&
        Object.values(value.serviceIds).every(serviceId => typeof serviceId === 'string')
    )
}
