// The order a view shows its records in, by its sort (`ViewSort`): by a field, as the field's type compares its
// values, or by last changed, newest first. Records that are equal stay in ID order, as do those never changed.
import { compareValues, type FieldTypeDefinition } from './field-types.ts'
import type { RecordEnvelope } from './session.ts'
import type { ViewSort } from './setup.ts'

export interface SortContext {
    /** The ID field, whose values give the ID order; else the IDs as strings. */
    idField: string | undefined
    /** The type of a field, as its column has it. */
    typeOf: (field: string) => FieldTypeDefinition
    /** When each record changed last, in this session: a larger number is later. */
    changes: ReadonlyMap<string, number>
}

/** `records` in the order `sort` says, as a new array. */
export function sortRecords(
    records: readonly RecordEnvelope[],
    sort: ViewSort,
    context: SortContext,
): RecordEnvelope[] {
    const byId = (a: RecordEnvelope, b: RecordEnvelope) => compareIds(a, b, context.idField)

    if (sort.by === 'last-changed') {
        const { changes } = context
        const when = (record: RecordEnvelope) => changes.get(record.id) ?? -1

        return [...records].sort((a, b) => when(b) - when(a) || byId(a, b))
    }

    const type = context.typeOf(sort.field)

    return [...records].sort(
        (a, b) => compareValues(a.raw[sort.field], b.raw[sort.field], type, sort.descending) || byId(a, b),
    )
}

// Two records by their IDs: numbers by value, strings as they are, which keeps a MongoDB ID's order by time
function compareIds(a: RecordEnvelope, b: RecordEnvelope, idField: string | undefined): number {
    const idA = idField === undefined ? undefined : a.raw[idField]
    const idB = idField === undefined ? undefined : b.raw[idField]

    if (typeof idA === 'number' && typeof idB === 'number') return idA - idB
    if (typeof idA === 'number') return -1
    if (typeof idB === 'number') return 1

    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
}
