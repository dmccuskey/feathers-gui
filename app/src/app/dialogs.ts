// The dialogs that are open. `show()` opens one and returns its answer; one host component at the app's root
// renders what is open and settles it (ADR 004). Nothing here knows a component: a dialog is named by its kind,
// and the host has the component of each kind.
import { shallowRef } from 'vue'

/** The kinds of dialog there are: for each, what it is opened with and what it answers. */
export type DialogKinds = Record<string, { input: unknown; answer: unknown }>

/** A dialog that is open, as the host renders it. */
export interface OpenDialog {
    /** Its own for as long as the app runs: the key it is rendered by. */
    readonly id: number
    readonly kind: string
    readonly input: unknown
    /** Closes the dialog with its answer. */
    answer(value: unknown): void
    /** Closes the dialog with no answer. */
    cancel(): void
}

export class Dialogs<TKinds extends DialogKinds> {
    readonly #open = shallowRef<readonly OpenDialog[]>([])
    #lastId = 0

    /** In the order they were opened: the last is on top. */
    get open(): readonly OpenDialog[] {
        return this.#open.value
    }

    /** Opens a dialog over those that are open. Resolves with its answer, or `undefined` when it was cancelled. */
    show<TKind extends keyof TKinds & string>(
        kind: TKind,
        input: TKinds[TKind]['input'],
    ): Promise<TKinds[TKind]['answer'] | undefined> {
        return new Promise(resolve => {
            // Settles once: a second answer, or a cancel after the answer, does nothing.
            const close = (value: TKinds[TKind]['answer'] | undefined): void => {
                if (!this.#open.value.includes(dialog)) return

                this.#open.value = this.#open.value.filter(other => other !== dialog)
                resolve(value)
            }

            const dialog: OpenDialog = {
                id: ++this.#lastId,
                kind,
                input,
                answer: value => close(value),
                cancel: () => close(undefined),
            }

            this.#open.value = [...this.#open.value, dialog]
        })
    }

    /** Cancels every dialog that is open, the top one first. */
    cancelAll(): void {
        for (const dialog of [...this.#open.value].reverse()) dialog.cancel()
    }

    destroy(): void {
        this.cancelAll()
    }
}
