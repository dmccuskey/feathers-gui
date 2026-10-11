import { expect, test } from 'bun:test'
import { watch } from 'vue'
import { Dialogs } from './dialogs.ts'

type Kinds = {
    confirm: { input: { question: string }; answer: boolean }
    rename: { input: { name: string }; answer: string }
}

test('a dialog shown is open, with its kind and what it was opened with', () => {
    const dialogs = new Dialogs<Kinds>()

    void dialogs.show('confirm', { question: 'Remove it?' })

    expect(dialogs.open).toHaveLength(1)
    expect(dialogs.open[0]).toMatchObject({ kind: 'confirm', input: { question: 'Remove it?' } })
})

test('an answer closes the dialog and is what show() returns', async () => {
    const dialogs = new Dialogs<Kinds>()
    const answer = dialogs.show('rename', { name: 'Local' })

    dialogs.open[0]?.answer('Staging')

    expect(await answer).toBe('Staging')
    expect(dialogs.open).toEqual([])
})

test('a cancel closes the dialog, and show() returns undefined', async () => {
    const dialogs = new Dialogs<Kinds>()
    const answer = dialogs.show('confirm', { question: 'Remove it?' })

    dialogs.open[0]?.cancel()

    expect(await answer).toBeUndefined()
    expect(dialogs.open).toEqual([])
})

test('an answer of false is an answer, not a cancel', async () => {
    const dialogs = new Dialogs<Kinds>()
    const answer = dialogs.show('confirm', { question: 'Remove it?' })

    dialogs.open[0]?.answer(false)

    expect(await answer).toBe(false)
})

test('a dialog opens over the one that is open, and each gets its own answer', async () => {
    const dialogs = new Dialogs<Kinds>()
    const rename = dialogs.show('rename', { name: 'Local' })
    const confirm = dialogs.show('confirm', { question: 'Discard the change?' })

    expect(dialogs.open.map(dialog => dialog.kind)).toEqual(['rename', 'confirm'])
    expect(dialogs.open[0]?.id).not.toBe(dialogs.open[1]?.id)

    dialogs.open[1]?.answer(true)

    expect(await confirm).toBe(true)
    expect(dialogs.open.map(dialog => dialog.kind)).toEqual(['rename'])

    dialogs.open[0]?.answer('Staging')

    expect(await rename).toBe('Staging')
})

test('a dialog settles once', async () => {
    const dialogs = new Dialogs<Kinds>()
    const first = dialogs.show('rename', { name: 'Local' })
    const closed = dialogs.open[0]

    closed?.answer('Staging')
    const second = dialogs.show('rename', { name: 'Other' })
    closed?.cancel()
    closed?.answer('Again')

    expect(await first).toBe('Staging')
    expect(dialogs.open).toHaveLength(1)

    dialogs.open[0]?.cancel()

    expect(await second).toBeUndefined()
})

test('what reads the open dialogs is told when one opens and when one closes', async () => {
    const dialogs = new Dialogs<Kinds>()
    const counts: number[] = []
    watch(
        () => dialogs.open,
        open => counts.push(open.length),
        { flush: 'sync' },
    )

    void dialogs.show('confirm', { question: 'Remove it?' })
    dialogs.open[0]?.cancel()

    expect(counts).toEqual([1, 0])
})

test('cancelAll() cancels every dialog that is open', async () => {
    const dialogs = new Dialogs<Kinds>()
    const rename = dialogs.show('rename', { name: 'Local' })
    const confirm = dialogs.show('confirm', { question: 'Discard the change?' })

    dialogs.cancelAll()

    expect(await rename).toBeUndefined()
    expect(await confirm).toBeUndefined()
    expect(dialogs.open).toEqual([])
})
