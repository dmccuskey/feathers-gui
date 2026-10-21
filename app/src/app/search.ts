// The live search of a view loaded whole: the words typed, each to be found somewhere in a record, case and accents
// ignored. A record is found by what its row shows: each column's value as its cell would show it with room for all
// of it, by the field's type (`searchValue()`). So a date is found in local time and not as stored, a field not shown
// is not searched, and null, missing and empty are found by those words. Field names are not searched.
import type { RecordColumn } from './columns.ts'
import { searchValue } from './field-types.ts'
import type { RecordEnvelope } from './session.ts'

/** Text as the search compares it: lower case, without accents. */
export function foldText(text: string): string {
    return text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()
}

/** The words of a search, folded. None when it is blank. */
export function searchWords(search: string): string[] {
    return foldText(search).split(/\s+/).filter(Boolean)
}

/** A record's text, folded, as the module's head says: the values of `columns`. */
export function recordText(record: RecordEnvelope, columns: readonly RecordColumn[]): string {
    // A line break between values, so a word is never found across two of them
    return foldText(columns.map(column => searchValue(record.raw[column.name], column.type)).join('\n'))
}

/**
 * The records that hold every word of `search`, in their order; all of them when it is blank. Each record's text is
 * made once, by `texts`, and kept by its envelope: a record changed is a new envelope.
 */
export function searchRecords(
    records: readonly RecordEnvelope[],
    search: string,
    texts: SearchTexts,
): readonly RecordEnvelope[] {
    const words = searchWords(search)

    if (words.length === 0) return records

    return records.filter(record => {
        const text = texts.of(record)

        return words.every(word => text.includes(word))
    })
}

/** The records' texts, made when first asked and kept by each envelope, for one set of columns. */
export class SearchTexts {
    readonly #columns: readonly RecordColumn[]
    readonly #texts = new WeakMap<RecordEnvelope, string>()

    constructor(columns: readonly RecordColumn[]) {
        this.#columns = columns
    }

    of(record: RecordEnvelope): string {
        let text = this.#texts.get(record)

        if (text === undefined) {
            text = recordText(record, this.#columns)
            this.#texts.set(record, text)
        }

        return text
    }
}
