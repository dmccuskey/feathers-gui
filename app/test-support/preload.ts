// Preloaded by `bun test` (see the root `bunfig.toml`): compiles `.vue` files and provides a DOM for the component tests.
import { plugin } from 'bun'
import { compileScript, parse } from '@vue/compiler-sfc'
import { Window } from 'happy-dom'

// Only what Vue and its test utilities need of a browser. `fetch` and the rest of Bun's globals stay as they are,
// because the same process runs the server tests.
const DOM_GLOBALS = [
    'window',
    'document',
    'navigator',
    'Node',
    'Element',
    'HTMLElement',
    'SVGElement',
    'Event',
    'CustomEvent',
    'MouseEvent',
    'KeyboardEvent',
    'InputEvent',
    'FocusEvent',
    'ShadowRoot',
] as const

const window = new Window()

for (const name of DOM_GLOBALS) {
    if (!(name in globalThis)) {
        Object.defineProperty(globalThis, name, { value: window[name], configurable: true, writable: true })
    }
}

plugin({
    name: 'vue',
    setup(build) {
        // The script and the template, compiled into one module. Styles are left out: nothing tests them.
        build.onLoad({ filter: /\.vue$/ }, async ({ path }) => {
            const { descriptor, errors } = parse(await Bun.file(path).text(), { filename: path })

            if (errors.length > 0) throw errors[0]

            const script = compileScript(descriptor, { id: path, inlineTemplate: true })

            return { contents: script.content, loader: 'ts' }
        })
    },
})
