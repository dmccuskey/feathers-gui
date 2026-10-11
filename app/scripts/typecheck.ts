// Runs `vue-tsc` under Bun: `bun run typecheck`.
//
// `vue-tsc` is `tsc` with its source patched as it is read, so that it knows `.vue` files. It patches by replacing
// `fs.readFileSync`, which Node's `require` goes through and Bun's does not: under Bun the plain `tsc` runs, and
// no `.vue` file is found. So this does what `vue-tsc` does (its `index.js`), and evaluates the patched source itself.
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname } from 'node:path'

const vueTscRequire = createRequire(createRequire(import.meta.url).resolve('vue-tsc'))
const runTsc = vueTscRequire('@volar/typescript/lib/quickstart/runTsc')
const core = vueTscRequire('@vue/language-core')
const proxyApiPath = vueTscRequire.resolve('@volar/typescript/lib/node/proxyCreateProgram')
// `tsc.js` itself only requires this one
const tscPath = vueTscRequire.resolve('typescript/lib/_tsc.js')

// The patched `tsc` asks for its language plugins here, once it has read the tsconfig
runTsc.getLanguagePlugins = (ts: any, options: any) => {
    const vueOptions = core.createParsedCommandLine(ts, ts.sys, options.options.configFilePath).vueOptions

    return { languagePlugins: [core.createVueLanguagePlugin(ts, options.options, vueOptions, (id: string) => id)] }
}

const source = runTsc.transformTscContent(readFileSync(tscPath, 'utf8'), proxyApiPath, ['.vue'], [])
const module = { exports: {} }

// As `require` would run it: `tsc` finds its `lib.*.d.ts` files beside its own file
new Function('require', 'module', 'exports', '__filename', '__dirname', source)(
    createRequire(tscPath),
    module,
    module.exports,
    tscPath,
    dirname(tscPath),
)
