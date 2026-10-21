// What the interface says of a service's view: the line over its records, and the dot beside its path.
import type { ServiceView } from '../app/service-view.ts'
import type { SessionPhase } from '../app/session.ts'

/** What the line and the dot read of a view. */
export type ViewState = Pick<ServiceView, 'status' | 'records' | 'total' | 'isWhole' | 'hasUnseenChanges'>

export interface ViewDot {
    /** `none`: nothing to mark, the view not read yet or not loaded whole; `live`: whole and kept current. */
    tone: 'none' | 'live' | 'stale' | 'failed'
    /** Whether a record changed while the view was not shown. */
    unseen: boolean
    /** What the dot means, for its `title` and `aria-label`. */
    label: string
}

const count = new Intl.NumberFormat('en')

/**
 * The line over the records: how many are shown, of how many, and whether they are kept current. `undefined` while
 * there are no records to put it over. `session`: the session's phase, which says why records are stale.
 */
export function viewLine(view: ViewState, session: SessionPhase | undefined): string | undefined {
    const records = view.records

    if (!records) return undefined

    const shown = records.length

    switch (view.status.phase) {
        case 'loading':
            return 'Reading…'
        case 'stale':
            return session === 'lost'
                ? 'Connection lost: the records last read'
                : 'Not connected: the records last read'
        case 'ready':
            if (view.isWhole) return `${count.format(shown)} ${shown === 1 ? 'record' : 'records'} · live`
            if (view.total === undefined) return `First ${count.format(shown)}, there may be more · read when shown`
            if (view.total > shown)
                return `First ${count.format(shown)} of ${count.format(view.total)} · read when shown`

            return `${count.format(shown)} ${shown === 1 ? 'record' : 'records'} · read when shown`
        default:
            return undefined
    }
}

/** The dot beside the service's path in the side bar, and before the line over its records. */
export function viewDot(view: ViewState | undefined): ViewDot {
    const unseen = view?.hasUnseenChanges ?? false
    const changed = unseen ? ', changed since last shown' : ''

    if (view?.status.phase === 'failed') {
        return { tone: 'failed', unseen, label: `Failed: ${view.status.error?.message ?? 'the read failed'}` }
    }
    if (!view?.isWhole) return { tone: 'none', unseen, label: '' }
    if (view.status.phase === 'stale') return { tone: 'stale', unseen, label: `Not connected${changed}` }

    return { tone: 'live', unseen, label: `Live${changed}` }
}
