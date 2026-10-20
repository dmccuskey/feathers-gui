// How a record source turns a server's record into the app's envelope and back (ADR 005): the record is kept as the
// server has it, beside its ID as a string.
import type { RecordConversion } from '@dmccuskey/feathers-connect'
import type { RecordEnvelope } from './session.ts'

/** The conversion for a service whose ID field is `idField`. A record without it is refused. */
export function envelopeConversion(idField: string): RecordConversion<RecordEnvelope> {
    return {
        read(raw) {
            const id = raw[idField]

            if (typeof id !== 'string' && typeof id !== 'number') {
                throw new Error(`A record has no ID field \`${idField}\``)
            }

            return { id: String(id), raw }
        },
        write: data => ({ ...data.raw }),
    }
}

/** The conversion for a read before the ID field is known, as the probe's: `id` is left empty, and only `raw` is used. */
export const rawConversion: RecordConversion<RecordEnvelope> = {
    read: raw => ({ id: '', raw }),
    write: data => ({ ...data.raw }),
}
