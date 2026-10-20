// The probe: a service's first read, before its ID field is known. It finds out whether the service counts and pages
// its records, and gives a first page to guess the ID field and the shape from (ADR 006).

/** A record as the server sent it. */
export type RawRecord = Record<string, unknown>

/** What the probe reads through: `findPage()` of a record source that keeps each record raw, and the service's own `find()`. */
export interface ProbeService {
    /** One page, asked for with `$limit` and `$skip: 0`. `total` is `undefined` when the service did not answer with a page. */
    findPage(limit: number): Promise<{ records: RawRecord[]; total: number | undefined }>
    /** The service's `find()` with no query: its own first page, or every record of a service without pages. */
    find(): Promise<RawRecord[]>
}

export interface ProbeResult {
    /** A first page of at most the size asked for, or every record when `isWhole`. */
    records: RawRecord[]
    /** How many records there are in all. `undefined` when the service does not say. */
    total: number | undefined
    /** `records` are every record of the service. */
    isWhole: boolean
    /** The service applies `$limit`, so it can be read by pages. `undefined` when an empty service cannot tell. */
    knowsLimit: boolean | undefined
}

/** How many records the probe reads at most, when the service applies the limit. */
export const PROBE_SIZE = 25

/**
 * The probe's three steps, as settled with LiveSystem on 2026-10-11. Not every Feathers server knows `$limit`: a
 * hand-written service may ignore it, or take it for a field and answer with nothing.
 *
 * 1. `$limit: 0`: a number as the total means the service pages and counts; a first page is then read. Records
 *    back mean it ignores the limit, and every record is in hand.
 * 2. Otherwise one page of `size`: at most `size` records back means it applies the limit without counting; more
 *    means it ignores it, and every record is in hand.
 * 3. Nothing at step 2 is either an empty service or one that took `$limit` for a field: `find()` with no query
 *    tells them apart.
 */
export async function probe(service: ProbeService, size = PROBE_SIZE): Promise<ProbeResult> {
    const count = await service.findPage(0)

    if (count.total !== undefined) {
        if (count.total === 0) return { records: [], total: 0, isWhole: true, knowsLimit: true }

        const first = await service.findPage(size)

        return {
            records: first.records,
            total: first.total ?? count.total,
            isWhole: first.records.length >= (first.total ?? count.total),
            knowsLimit: true,
        }
    }
    if (count.records.length > 0) return wholeOf(count.records)

    const page = await service.findPage(size)

    if (page.records.length > size) return wholeOf(page.records)
    if (page.records.length > 0) {
        return { records: page.records, total: undefined, isWhole: page.records.length < size, knowsLimit: true }
    }

    const all = await service.find()

    if (all.length === 0) return { records: [], total: 0, isWhole: true, knowsLimit: undefined }

    return wholeOf(all)
}

// Every record, from a service that does not apply `$limit`
function wholeOf(records: RawRecord[]): ProbeResult {
    return { records, total: records.length, isWhole: true, knowsLimit: false }
}

/**
 * The records' ID field: `id`, Feathers' default, or else `_id`, as MongoDB has it. The field must be on every record,
 * a string or a number, and different on each (compared as strings, as the app keys a record on its ID as a string).
 * With no records nothing contradicts the default, so it is `id`. `undefined` when neither field qualifies: the user
 * names the field in the service's setup.
 */
export function guessIdField(records: readonly RawRecord[]): string | undefined {
    if (records.length === 0) return 'id'

    return ['id', '_id'].find(name => isIdField(records, name))
}

function isIdField(records: readonly RawRecord[], name: string): boolean {
    const seen = new Set<string>()

    for (const record of records) {
        const value = record[name]

        if (typeof value !== 'string' && typeof value !== 'number') return false

        const key = String(value)

        if (key === '' || seen.has(key)) return false
        seen.add(key)
    }

    return true
}
