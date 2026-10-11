// What a field tells the control in it, so the two are tied without the page naming an ID.
import type { InjectionKey } from 'vue'

export interface FieldContext {
    /** The ID the control takes: the field's label is for it. */
    readonly id: string
    /** The IDs of the field's hint and error, for `aria-describedby`. */
    readonly describedBy: string | undefined
    /** Whether the field shows an error. */
    readonly invalid: boolean
}

export const FIELD_KEY: InjectionKey<FieldContext> = Symbol('widgets.field')
