// The columns of the records table, until the shape of a record replaces them: the ID field first, then the fields
// the setup shows, in its order, then every other top-level field of the records held, in the order first seen. A
// field the setup hides is left out. A field not in the setup has the type of its first value that is not null.
import { FIELD_TYPES, fieldType, type FieldTypeDefinition } from './field-types.ts'
import type { RecordEnvelope } from './session.ts'
import type { FieldSetup } from './setup.ts'

export interface RecordColumn {
    name: string
    type: FieldTypeDefinition
}

// The order a value's type is guessed in: a number before a date, which may be milliseconds, and a date before a
// string, which may be an ISO date.
const GUESSED = ['number', 'boolean', 'date', 'array', 'object', 'string'].map(name =>
    FIELD_TYPES.find(type => type.name === name),
) as FieldTypeDefinition[]

/** The type a value looks like: the string type for a value of none. */
export function guessType(value: unknown): FieldTypeDefinition {
    if (value === null || value === undefined) return fieldType('string')

    return GUESSED.find(type => type.show(value) !== undefined) ?? fieldType('string')
}

/** The type of one field of `records`, as its column has it: the setup's, or else guessed. */
export function fieldTypeOf(
    records: readonly RecordEnvelope[],
    name: string,
    fields: readonly FieldSetup[] = [],
): FieldTypeDefinition {
    const field = fields.find(each => each.name === name)

    if (field) return fieldType(field.type)

    const first = records.find(record => record.raw[name] !== null && record.raw[name] !== undefined)

    return guessType(first?.raw[name])
}

/** The columns of `records`, as the module's head says. */
export function columnsOf(
    records: readonly RecordEnvelope[],
    idField: string | undefined,
    fields: readonly FieldSetup[] = [],
): RecordColumn[] {
    const set = new Map(fields.map(field => [field.name, field]))
    // A field's first value that is not null, once found
    const firsts = new Map<string, unknown>()
    const seen = new Set<string>()

    for (const record of records) {
        for (const [name, value] of Object.entries(record.raw)) {
            seen.add(name)
            if (value !== null && value !== undefined && !firsts.has(name)) firsts.set(name, value)
        }
    }

    const column = (name: string): RecordColumn => {
        const field = set.get(name)

        return { name, type: field ? fieldType(field.type) : guessType(firsts.get(name)) }
    }
    const names = [
        ...(idField === undefined ? [] : [idField]),
        ...fields.filter(field => field.show).map(field => field.name),
        ...[...seen].filter(name => !set.has(name)),
    ]

    return [...new Set(names)].map(column)
}
