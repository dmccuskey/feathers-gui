// What the table is given, and the arithmetic of which rows it draws: kept out of the component, so it is
// tested without a layout.

export interface TableColumn<T> {
    /** Its own among the columns. */
    key: string
    label: string
    /** What a cell of this column shows. */
    text: (row: T) => string
    /** The least it is, as a CSS length: what room is left over is shared out between the columns. */
    width?: string
    align?: 'start' | 'end'
}

/** The rows drawn: from `start` up to, not including, `end`. */
export interface RowWindow {
    start: number
    end: number
}

/** The rows drawn either side of those in view, so a quick scroll does not show a gap before the next frame. */
export const OVERSCAN = 6

/** The rows in view at a scroll position, and a few either side. */
export function rowWindow(scrollTop: number, height: number, rowHeight: number, count: number): RowWindow {
    const first = Math.floor(scrollTop / rowHeight)
    const last = Math.ceil((scrollTop + height) / rowHeight)

    return {
        start: Math.max(0, Math.min(count, first - OVERSCAN)),
        end: Math.max(0, Math.min(count, last + OVERSCAN)),
    }
}

/** Where to scroll for a row to be in view: the scroll position, unchanged when it already is. */
export function scrollToRow(index: number, scrollTop: number, height: number, rowHeight: number): number {
    const top = index * rowHeight
    const bottom = top + rowHeight

    if (top < scrollTop) return top
    // A row taller than the view is shown from its top.
    if (bottom > scrollTop + height) return Math.min(top, bottom - height)
    return scrollTop
}

/** The row a key moves to from `index`, or `undefined` for a key the table does not handle. */
export function rowForKey(key: string, index: number, count: number, perPage: number): number | undefined {
    if (count === 0) return undefined

    const moves: Record<string, number> = {
        ArrowDown: index + 1,
        ArrowUp: index - 1,
        PageDown: index + perPage,
        PageUp: index - perPage,
        Home: 0,
        End: count - 1,
    }
    const to = moves[key]

    if (to === undefined) return undefined
    // Nothing selected: a key down starts at the top, a key up at the bottom.
    if (index < 0) return key === 'ArrowUp' || key === 'PageUp' || key === 'End' ? count - 1 : 0
    return Math.max(0, Math.min(count - 1, to))
}
