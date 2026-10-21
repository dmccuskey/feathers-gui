// The loader of a service held whole: every record, kept current by the server's events (ADR 006). A `DataManager`
// loads them into a store of the app's own, and applies each event; nothing else changes what it holds.
import { DataManager, type RecordSource, type RecordStore } from 'live-system/core'
import { computed, shallowReactive, shallowRef } from 'vue'
import type { RecordEnvelope } from './session.ts'

/** What a view uses of a loader. The paged loader is to have the same. */
export interface RecordLoader {
    readonly kind: 'whole' | 'paged'
    /** Reactive. The records to show. */
    readonly rows: readonly RecordEnvelope[]
    /** Reactive. How many records the service has. */
    readonly total: number | undefined
    record(id: string): RecordEnvelope | undefined
    /** Reads the records. Rejects when the first read fails: the loader is then stopped, and not loaded again. */
    load(): Promise<void>
    /** Brings what is held up to the server's, after events may have been missed: a lost connection, a new login. */
    sync(): void
    stop(): Promise<void>
}

// No more than the five members of a `RecordStore`, on the app's own Vue. `onChange` is told the ID of each record set
// or removed after the load: by an event, or by a sync that found it changed.
function recordStore(onChange: (id: string) => void): RecordStore<RecordEnvelope> {
    const records = shallowRef(shallowReactive({} as Record<string, RecordEnvelope>))

    return {
        get records() {
            return records.value
        },
        load(all) {
            const next: Record<string, RecordEnvelope> = {}

            for (const record of all) next[record.id] = record
            records.value = shallowReactive(next)
        },
        set(record) {
            records.value[record.id] = record
            onChange(record.id)
        },
        remove(id) {
            delete records.value[id]
            onChange(id)
        },
        get: id => records.value[id],
    }
}

// The manager outside a system: it has no context, and its `start()` and `run()` do nothing
class ServiceRecords extends DataManager<RecordEnvelope, undefined> {}

export class WholeLoader implements RecordLoader {
    readonly kind = 'whole'

    readonly #store: RecordStore<RecordEnvelope>
    readonly #manager: ServiceRecords
    readonly #resync = new Set<() => void>()
    readonly #rows = computed(() => Object.values(this.#store.records))

    /**
     * Over a record source of envelopes. The source's own word of a reconnect is not taken: the view calls `sync()`
     * once the session is ready again, logged in, as a service with a login sends no events before. `onChange` is
     * told the ID of each record that changes after the load, by an event or a sync.
     */
    constructor(source: RecordSource<RecordEnvelope>, onChange: (id: string) => void = () => {}) {
        this.#store = recordStore(onChange)

        const resync = this.#resync
        const synced: RecordSource<RecordEnvelope> = {
            find: () => source.find(),
            get: id => source.get(id),
            isNotFound: error => source.isNotFound(error),
            create: data => source.create(data),
            update: (id, data) => source.update(id, data),
            patch: (id, data) => source.patch(id, data),
            remove: id => source.remove(id),
            onCreated: listener => source.onCreated(listener),
            onUpdated: listener => source.onUpdated(listener),
            onPatched: listener => source.onPatched(listener),
            onRemoved: listener => source.onRemoved(listener),
            onReconnected(listener) {
                resync.add(listener)

                return () => resync.delete(listener)
            },
        }

        this.#manager = new ServiceRecords(undefined, synced, this.#store)
    }

    get rows(): readonly RecordEnvelope[] {
        return this.#rows.value
    }

    get total(): number {
        return this.#rows.value.length
    }

    record(id: string): RecordEnvelope | undefined {
        return this.#store.get(id)
    }

    async load(): Promise<void> {
        try {
            await this.#manager.init()
        } catch (error) {
            await this.#manager.stop()
            throw error
        }
    }

    sync(): void {
        for (const listener of [...this.#resync]) listener()
    }

    async stop(): Promise<void> {
        await this.#manager.stop()
    }
}
