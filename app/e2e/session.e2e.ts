// The session end to end: the app in a real browser against the dev server, logging in, several windows, a lost
// connection, a token that runs out, and the views following the setup.
import { afterAll, afterEach, beforeAll, expect, test } from 'bun:test'
import type { Browser, BrowserContext, Page } from 'playwright'
import {
    contextWith,
    launch,
    openApp,
    setupOf,
    startApp,
    startServer,
    storedSetup,
    USER,
    type Started,
} from './harness.ts'

let app: Started
let server: Started
let browser: Browser
const contexts: BrowserContext[] = []

beforeAll(async () => {
    ;[app, server, browser] = await Promise.all([startApp(), startServer(), launch()])
})

afterAll(async () => {
    await browser?.close()
    await Promise.all([app?.stop(), server?.stop()])
})

afterEach(async () => {
    await Promise.all(contexts.splice(0).map(context => context.close()))
})

async function newContext(...args: Parameters<typeof contextWith> extends [unknown, ...infer R] ? R : never) {
    const context = await contextWith(browser, ...args)

    contexts.push(context)

    return context
}

function status(page: Page) {
    return page.locator('.session-status-line')
}

function records(page: Page) {
    return page.locator('.service-area-records li')
}

/** Waits for the status line to say `text`. */
async function statusSays(page: Page, text: string, timeout = 10_000): Promise<void> {
    await page.locator('.session-status-line', { hasText: text }).waitFor({ timeout })
}

/** Types the password in the login dialog and sends it. */
async function logInWith(page: Page, password: string, remember = false): Promise<void> {
    const dialog = page.getByRole('dialog')

    await dialog.locator('input[type="password"]').fill(password)
    if (remember) await dialog.getByText('Remember on this computer').click()
    await dialog.getByRole('button', { name: 'Log In' }).click()
}

async function loggedIn(page: Page): Promise<void> {
    await page.getByRole('dialog').waitFor()
    await logInWith(page, USER.password)
    await statusSays(page, `Connected as ${USER.email}`)
}

test('the login dialog opens by itself, says why a password was refused, and closes once one is accepted', async () => {
    const page = await openApp(await newContext())
    const dialog = page.getByRole('dialog')

    await dialog.waitFor()
    await logInWith(page, 'wrong')
    await dialog.getByText('Invalid login').waitFor()
    expect(await dialog.locator('input[type="password"]').inputValue()).toBe('')

    await logInWith(page, USER.password)
    await dialog.waitFor({ state: 'detached' })
    await statusSays(page, `Connected as ${USER.email}`)
    await records(page).first().waitFor()
    expect(await page.locator('.service-area-path').textContent()).toBe('notes')
}, 30_000)

test('a second window logs in by itself when the first does, and a third gets the password from them', async () => {
    const context = await newContext()
    const first = await openApp(context)
    const second = await openApp(context)

    await second.getByRole('dialog').waitFor()
    await loggedIn(first)

    await statusSays(second, `Connected as ${USER.email}`)
    await second.getByRole('dialog').waitFor({ state: 'detached' })
    await records(second).first().waitFor()

    const third = await openApp(context)

    await statusSays(third, `Connected as ${USER.email}`)
    expect(await third.getByRole('dialog').count()).toBe(0)
    await records(third).first().waitFor()
}, 30_000)

test('Log Out drops the records and waits, without the dialog, until Log In', async () => {
    const page = await openApp(await newContext())

    await loggedIn(page)
    await records(page).first().waitFor()

    await page.locator('.session-status').getByRole('button', { name: 'Log Out' }).click()
    await statusSays(page, 'Not logged in.')
    await page.getByText("Log in to read this server's records.").waitFor()
    expect(await records(page).count()).toBe(0)
    await Bun.sleep(500)
    expect(await page.getByRole('dialog').count()).toBe(0)

    await page.locator('.session-status').getByRole('button', { name: 'Log In' }).click()
    await loggedIn(page)
    await records(page).first().waitFor()
}, 30_000)

test('"Remember on this computer" keeps the password in the setup, and a new window logs in with it', async () => {
    const context = await newContext()
    const page = await openApp(context)

    await page.getByRole('dialog').waitFor()
    await logInWith(page, USER.password, true)
    await statusSays(page, `Connected as ${USER.email}`)

    const login = (await setupOf(page)).servers[0]?.login as { remember: boolean; password?: string }

    expect(login).toMatchObject({ remember: true, password: USER.password })

    // Alone: no other window holds the password for it
    await page.close()

    const next = await openApp(context)

    await statusSays(next, `Connected as ${USER.email}`)
    expect(await next.getByRole('dialog').count()).toBe(0)
}, 30_000)

test('the views follow the setup written in another window', async () => {
    const context = await newContext(storedSetup(['messages', 'notes']), 'messages')
    const page = await openApp(context)
    const other = await openApp(context)

    await loggedIn(page)
    await records(page).first().waitFor()

    // Another window moves the service to another path: this one shows the records of the new path
    await other.evaluate(() => {
        const setup = JSON.parse(localStorage.getItem('feathers-gui.setup')!)

        setup.services[0].path = 'tasks'
        localStorage.setItem('feathers-gui.setup', JSON.stringify(setup))
    })
    await page.locator('.service-area-path', { hasText: 'tasks' }).waitFor()
    await page.locator('.side-bar-path', { hasText: 'tasks' }).waitFor()
    await records(page).first().waitFor()

    // And removes it
    await other.evaluate(() => {
        const setup = JSON.parse(localStorage.getItem('feathers-gui.setup')!)

        setup.services.shift()
        localStorage.setItem('feathers-gui.setup', JSON.stringify(setup))
    })
    await page.getByText('No service is chosen.').waitFor()
    expect(await page.locator('.side-bar-path').allTextContents()).toEqual(['notes'])
}, 30_000)

test('a lost connection keeps the records dimmed, and Try Now brings the session back, logged in', async () => {
    const page = await openApp(await newContext())

    await loggedIn(page)
    await records(page).first().waitFor()

    await server.stop()
    await statusSays(page, 'Connection lost.')
    await page.locator('.service-area-records.service-area-stale').waitFor()

    server = await startServer()

    const tryNow = page.locator('.session-status').getByRole('button', { name: 'Try Now' })

    // socket.io may be back on its own first
    if (await tryNow.isVisible()) await tryNow.click()
    await statusSays(page, `Connected as ${USER.email}`)
    await page.locator('.service-area-records:not(.service-area-stale)').waitFor()
    expect(await page.getByRole('dialog').count()).toBe(0)
}, 40_000)

test("a token that runs out is replaced by the session's own login, and the records are still read", async () => {
    await server.stop()
    server = await startServer({ TOKEN_LIFE: '3s' })

    const page = await openApp(await newContext())

    await loggedIn(page)
    await records(page).first().waitFor()
    await Bun.sleep(5_000)

    // `notes` needs the login: reading it again shows the session logged in again
    await page.locator('.side-bar-path', { hasText: 'messages' }).click()
    await page.locator('.service-area-path', { hasText: 'messages' }).waitFor()
    await page.locator('.side-bar-path', { hasText: 'notes' }).click()
    await page.locator('.service-area-path', { hasText: 'notes' }).waitFor()
    await records(page).first().waitFor()
    await statusSays(page, `Connected as ${USER.email}`)
    expect(await page.getByRole('dialog').count()).toBe(0)
    expect(await page.locator('.service-area-notice').count()).toBe(0)
}, 40_000)
