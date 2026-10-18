// What the end-to-end tests run against: the app served by Vite, a Feathers dev server, and a Chromium of
// Playwright's own (no extensions, so no password manager over the fields). Each is started by the tests and
// stopped after them.
import { spawn, type Subprocess } from 'bun'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { chromium, type Browser, type BrowserContext, type Page } from 'playwright'

const APP_DIR = resolve(import.meta.dir, '..')

/** The folder of the dev server: one with `bun run start`, that takes `PORT`, `AUTH` and `TOKEN_LIFE`. */
export const DEV_SERVER_DIR = resolve(process.env.DEV_SERVER_DIR ?? resolve(APP_DIR, '../../dev-server'))

/** The seeded user of the dev server. */
export const USER = { email: 'test@example.com', password: 'test-password' }

/** Ports of their own, away from the app's 9093 and 9094 and the dev server's 3041. */
export const APP_PORT = Number(process.env.E2E_APP_PORT ?? 9095)
export const SERVER_PORT = Number(process.env.E2E_SERVER_PORT ?? 3042)

export const APP_URL = `http://localhost:${APP_PORT}`
export const SERVER_URL = `http://localhost:${SERVER_PORT}`

/** A process started by the tests, and how to stop it. */
export interface Started {
    stop(): Promise<void>
}

/** Waits until `url` answers at all, or fails after `timeout` milliseconds. */
async function answered(url: string, timeout = 20_000): Promise<void> {
    const end = Date.now() + timeout

    while (Date.now() < end) {
        try {
            await fetch(url)

            return
        } catch {
            await Bun.sleep(100)
        }
    }

    throw new Error(`Nothing answered at ${url}`)
}

async function started(process: Subprocess, url: string): Promise<Started> {
    await answered(url)

    return {
        async stop() {
            process.kill()
            await process.exited
        },
    }
}

/** Serves the app with Vite. */
export function startApp(): Promise<Started> {
    return started(
        spawn(['bun', '--bun', 'vite', '--port', String(APP_PORT), '--strictPort'], {
            cwd: APP_DIR,
            stdout: 'ignore',
            stderr: 'inherit',
        }),
        APP_URL,
    )
}

/** Starts the dev server, seeded afresh. `env`: such as `{ TOKEN_LIFE: '5s' }`. */
export function startServer(env: Record<string, string> = {}): Promise<Started> {
    if (!existsSync(resolve(DEV_SERVER_DIR, 'package.json'))) {
        throw new Error(`No dev server at ${DEV_SERVER_DIR}: set DEV_SERVER_DIR`)
    }

    return started(
        spawn(['bun', 'run', 'start'], {
            cwd: DEV_SERVER_DIR,
            env: { ...process.env, PORT: String(SERVER_PORT), ...env },
            stdout: 'ignore',
            stderr: 'inherit',
        }),
        SERVER_URL,
    )
}

export function launch(): Promise<Browser> {
    return chromium.launch({ headless: process.env.E2E_HEADED === undefined })
}

/** A service as the setup stores it. */
interface StoredService {
    id: string
    serverId: string
    path: string
    load: 'auto'
    fields: []
    pins: []
}

/** The setup the tests start with: the dev server, logging in as the seeded user, and some of its services. */
export function storedSetup(paths: string[] = ['messages', 'notes']) {
    return {
        version: 1,
        servers: [
            {
                id: 'dev',
                name: 'dev',
                url: SERVER_URL,
                readOnly: false,
                login: {
                    kind: 'local',
                    path: 'authentication',
                    usernameField: 'email',
                    passwordField: 'password',
                    username: USER.email,
                    remember: false,
                },
            },
        ],
        services: paths.map((path): StoredService => ({
            id: path,
            serverId: 'dev',
            path,
            load: 'auto',
            fields: [],
            pins: [],
        })),
    }
}

/**
 * A browser context whose pages start with `setup`, on the server `dev`, with `service` current. The setup is put
 * in place once, as a user's would be; each new page (a window) starts on `service`.
 */
export async function contextWith(browser: Browser, setup = storedSetup(), service = 'notes'): Promise<BrowserContext> {
    const context = await browser.newContext()

    // Well within a test's own time: a test that runs out of it has the browser killed with it, failing those after
    context.setDefaultTimeout(10_000)
    await context.addInitScript(
        ({ setup, service }) => {
            if (localStorage.getItem('feathers-gui.setup') === null) {
                localStorage.setItem('feathers-gui.setup', JSON.stringify(setup))
                localStorage.setItem('feathers-gui.last-server', 'dev')
            }
            if (sessionStorage.getItem('feathers-gui.current') === null) {
                sessionStorage.setItem(
                    'feathers-gui.current',
                    JSON.stringify({ serverId: 'dev', serviceIds: { dev: service } }),
                )
            }
        },
        { setup, service },
    )

    return context
}

/** Opens the app in a new page of `context`. */
export async function openApp(context: BrowserContext): Promise<Page> {
    const page = await context.newPage()

    await page.goto(APP_URL)

    return page
}

/** The setup as the page has it stored. */
export async function setupOf(page: Page): Promise<ReturnType<typeof storedSetup>> {
    return page.evaluate(() => JSON.parse(localStorage.getItem('feathers-gui.setup') ?? 'null'))
}
