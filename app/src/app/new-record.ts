// A new record, until the record editor: JSON text, started from a template of the table's columns, and the server's
// reasons when it refuses one.
import type { RecordColumn } from './columns.ts'

/** A new record to start from: each column but the ID field, the server's to give, with its type's first value. */
export function recordTemplate(columns: readonly RecordColumn[], idField: string | undefined): Record<string, unknown> {
    return Object.fromEntries(
        columns.filter(column => column.name !== idField).map(column => [column.name, column.type.initial()]),
    )
}

/** The record in `text`, or what is wrong with it: it is to be a JSON object. */
export function readRecord(
    text: string,
): { record: Record<string, unknown>; error?: undefined } | { record?: undefined; error: string } {
    let value: unknown

    try {
        value = JSON.parse(text)
    } catch (error) {
        return { error: `Not JSON: ${error instanceof Error ? error.message : String(error)}` }
    }

    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
        return { error: 'A record is a JSON object, in braces.' }
    }

    return { record: value as Record<string, unknown> }
}

/** At most this many of the server's reasons are shown. */
export const REASONS_SHOWN = 10

/**
 * What the server says is wrong, field by field, a line each: a schema's list (`instancePath`, `message` and the
 * property it is about, as Feathers 5 sends), or an object of messages by field (as Feathers 4 and Mongoose do). None for anything else.
 */
export function reasonsOf(errors: unknown): string[] {
    let lines: string[] = []

    if (Array.isArray(errors)) {
        lines = errors.map(item => {
            if (typeof item !== 'object' || item === null) return String(item)

            const { instancePath, path, message, params } = item as Record<string, unknown>
            const where = typeof instancePath === 'string' ? instancePath.slice(1).replaceAll('/', '.') : path
            // A schema's "must NOT have additional properties" names the one only here
            const extra = (params as { additionalProperty?: unknown } | undefined)?.additionalProperty
            const line = [where, message ?? JSON.stringify(item)].filter(part => part !== undefined && part !== '')

            return `${line.join(' ')}${extra === undefined ? '' : `: ${String(extra)}`}`
        })
    } else if (typeof errors === 'object' && errors !== null) {
        lines = Object.entries(errors).map(([field, reason]) => {
            const message = (reason as { message?: unknown } | null)?.message ?? reason

            return `${field}: ${typeof message === 'string' ? message : JSON.stringify(message)}`
        })
    }

    return lines.length > REASONS_SHOWN ? [...lines.slice(0, REASONS_SHOWN - 1), '…'] : lines
}
