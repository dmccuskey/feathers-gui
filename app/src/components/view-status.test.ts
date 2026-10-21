import { expect, test } from 'bun:test'
import type { RecordEnvelope } from '../app/session.ts'
import { viewDot, viewLine, type ViewState } from './view-status.ts'

function records(n: number): RecordEnvelope[] {
    return Array.from({ length: n }, (_, i) => ({ id: String(i), raw: { id: i } }))
}

function view(state: Partial<ViewState>): ViewState {
    return {
        status: { phase: 'ready' },
        records: null,
        total: undefined,
        isWhole: false,
        hasUnseenChanges: false,
        ...state,
    }
}

test('no line while there are no records', () => {
    expect(viewLine(view({ status: { phase: 'waiting' } }), 'connecting')).toBeUndefined()
    expect(viewLine(view({ status: { phase: 'loading' } }), 'ready')).toBeUndefined()
    expect(viewLine(view({ status: { phase: 'failed', error: { message: 'No' } } }), 'ready')).toBeUndefined()
})

test('a view loaded whole counts its records, and says it is live', () => {
    expect(viewLine(view({ records: records(25), isWhole: true }), 'ready')).toBe('25 records · live')
    expect(viewLine(view({ records: records(1), isWhole: true }), 'ready')).toBe('1 record · live')
    expect(viewLine(view({ records: [], isWhole: true }), 'ready')).toBe('0 records · live')
})

test('a first page says how many more there are, or may be, and that it is read when shown', () => {
    expect(viewLine(view({ records: records(25), total: 50000 }), 'ready')).toBe('First 25 of 50,000 · read when shown')
    expect(viewLine(view({ records: records(25) }), 'ready')).toBe('First 25, there may be more · read when shown')
    expect(viewLine(view({ records: records(3), total: 3 }), 'ready')).toBe('3 records · read when shown')
})

test('records read again, or kept while the session is not ready, say so', () => {
    expect(viewLine(view({ status: { phase: 'loading' }, records: records(2) }), 'ready')).toBe('Reading…')
    expect(viewLine(view({ status: { phase: 'stale' }, records: records(2) }), 'lost')).toBe(
        'Connection lost: the records last read',
    )
    expect(viewLine(view({ status: { phase: 'stale' }, records: records(2) }), 'connecting')).toBe(
        'Not connected: the records last read',
    )
})

test('the dot marks a view live, stale or failed, and nothing for one not loaded whole', () => {
    expect(viewDot(undefined)).toEqual({ tone: 'none', unseen: false, label: '' })
    expect(viewDot(view({ records: records(25), total: 50000 }))).toEqual({ tone: 'none', unseen: false, label: '' })
    expect(viewDot(view({ isWhole: true }))).toEqual({ tone: 'live', unseen: false, label: 'Live' })
    expect(viewDot(view({ isWhole: true, status: { phase: 'stale' } }))).toEqual({
        tone: 'stale',
        unseen: false,
        label: 'Not connected',
    })
    expect(viewDot(view({ status: { phase: 'failed', error: { message: 'No ID field' } } }))).toEqual({
        tone: 'failed',
        unseen: false,
        label: 'Failed: No ID field',
    })
})

test('the dot marks a change not seen yet', () => {
    expect(viewDot(view({ isWhole: true, hasUnseenChanges: true }))).toEqual({
        tone: 'live',
        unseen: true,
        label: 'Live, changed since last shown',
    })
})
