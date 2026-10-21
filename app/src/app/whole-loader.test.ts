import { expect, test } from 'bun:test'
import { MemoryRecordSource } from 'live-system/core'
import { watch } from 'vue'
import type { RecordEnvelope } from './session.ts'
import { WholeLoader } from './whole-loader.ts'

function envelope(id: string, name = id): RecordEnvelope {
    return { id, raw: { _id: id, name } }
}

function idsOf(loader: WholeLoader): string[] {
    return loader.rows.map(row => row.id)
}

async function settled(): Promise<void> {
    for (let i = 0; i < 10; i++) await Promise.resolve()
}

test('load() reads every record, and the loader holds them as the source has them', async () => {
    const loader = new WholeLoader(new MemoryRecordSource([envelope('a'), envelope('b', 'B')]))

    expect(loader.rows).toEqual([])

    await loader.load()

    expect(idsOf(loader)).toEqual(['a', 'b'])
    expect(loader.total).toBe(2)
    expect(loader.record('b')).toEqual(envelope('b', 'B'))
    expect(loader.record('c')).toBeUndefined()
})

test('each event of the source changes what is held, and the rows follow', async () => {
    const source = new MemoryRecordSource([envelope('a'), envelope('b')])
    const loader = new WholeLoader(source)
    const seen: string[][] = []

    await loader.load()
    watch(
        () => loader.rows,
        rows => seen.push(rows.map(row => row.id)),
        { flush: 'sync' },
    )

    await source.create(envelope('c'))
    await source.patch('a', { raw: { _id: 'a', name: 'A' } })
    await source.remove('b')

    expect(seen).toEqual([
        ['a', 'b', 'c'],
        ['a', 'b', 'c'],
        ['a', 'c'],
    ])
    expect(loader.record('a')?.raw.name).toBe('A')
    expect(loader.total).toBe(2)
})

test('sync() brings what is held up to the source, after events were missed', async () => {
    const source = new MemoryRecordSource([envelope('a'), envelope('b')])
    const loader = new WholeLoader(source)

    await loader.load()
    source.disconnect()
    await source.create(envelope('c'))
    await source.update('a', envelope('a', 'A'))
    await source.remove('b')
    expect(idsOf(loader)).toEqual(['a', 'b'])

    source.reconnect()
    loader.sync()
    await settled()

    expect(idsOf(loader)).toEqual(['a', 'c'])
    expect(loader.record('a')?.raw.name).toBe('A')
})

test('onChange is told of each record changed after the load, by an event or a sync, and not of the load', async () => {
    const source = new MemoryRecordSource([envelope('a'), envelope('b')])
    let changes = 0
    const loader = new WholeLoader(source, () => changes++)

    await loader.load()
    expect(changes).toBe(0)

    await source.create(envelope('c'))
    await source.patch('a', { raw: { _id: 'a', name: 'A' } })
    await source.remove('b')
    expect(changes).toBe(3)

    source.disconnect()
    await source.remove('c')
    source.reconnect()
    loader.sync()
    await settled()
    expect(changes).toBe(4)

    // A sync that finds nothing changed tells nothing
    loader.sync()
    await settled()
    expect(changes).toBe(4)
})

test("the source's own reconnect does not sync: the view says when", async () => {
    const source = new MemoryRecordSource([envelope('a')])
    const loader = new WholeLoader(source)

    await loader.load()
    source.disconnect()
    await source.create(envelope('b'))
    source.reconnect()
    await settled()

    expect(idsOf(loader)).toEqual(['a'])
})

test('a first read that fails rejects load(), and the loader takes no events after', async () => {
    const source = new MemoryRecordSource([envelope('a')])

    source.find = async () => {
        throw new Error('The server is down')
    }

    const loader = new WholeLoader(source)

    await expect(loader.load()).rejects.toThrow('The server is down')
    await source.create(envelope('b'))

    expect(loader.rows).toEqual([])
})

test('stop() keeps what is held and takes no events after, and ends a load that never returns', async () => {
    const source = new MemoryRecordSource([envelope('a')])
    const loader = new WholeLoader(source)

    await loader.load()
    await loader.stop()
    await source.create(envelope('b'))
    expect(idsOf(loader)).toEqual(['a'])

    source.find = () => new Promise(() => {})

    const hanging = new WholeLoader(source)
    const loading = hanging.load()

    await hanging.stop()
    await loading
    expect(hanging.rows).toEqual([])
})
