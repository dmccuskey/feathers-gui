// The session end to end: the app in a real browser against the dev server, logging in, several windows, a lost
// connection, a token that runs out, and the views following the setup.
import { afterAll, afterEach, beforeAll, expect, test } from 'bun:test'
import type { Browser, BrowserContext, Page } from 'playwright'
import {
    contextWith,
    launch,
    openApp,
    SERVER_URL,
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
    return page.locator('.service-area-records .ui-table-shown [role="row"]')
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

test('"Remember on this computer" keeps the password: a new window logs in with it, and Log In after Log Out', async () => {
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

    // Log Out keeps it, and lasts through a reload of the window; Log In then uses it, without the dialog
    const logOut = next.locator('.session-status').getByRole('button', { name: 'Log Out' })

    expect(await logOut.getAttribute('title')).toContain('remembered on this computer is kept')
    await logOut.click()
    await statusSays(next, 'Not logged in.')
    expect((await setupOf(next)).servers[0]?.login).toMatchObject({ remember: true, password: USER.password })

    await next.reload()
    await statusSays(next, 'Not logged in.')
    await Bun.sleep(500)
    expect(await next.getByRole('dialog').count()).toBe(0)

    await next.locator('.session-status').getByRole('button', { name: 'Log In' }).click()
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

test('a service loaded whole shows every record, and a change made by another client as it comes', async () => {
    const page = await openApp(await newContext(storedSetup(['messages', 'notes']), 'messages'))

    await loggedIn(page)
    // The table draws only the rows in view: it counts its header among its rows
    await page.locator('.service-area-records [role="grid"][aria-rowcount="26"]').waitFor()

    const answer = await fetch(`${SERVER_URL}/messages/1`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: 'Changed elsewhere' }),
    })

    expect(answer.ok).toBe(true)
    await records(page).filter({ hasText: 'Changed elsewhere' }).waitFor()
}, 30_000)

test("a token that runs out is replaced by the session's own login, and the records are still read", async () => {
    await server.stop()
    server = await startServer({ TOKEN_LIFE: '3s' })

    const page = await openApp(await newContext())

    await loggedIn(page)
    await records(page).first().waitFor()
    await Bun.sleep(5_000)

    // `notes` needs the login: its records, synced once the session is ready again, show it logged in again
    await page.locator('.side-bar-path', { hasText: 'messages' }).click()
    await page.locator('.service-area-path', { hasText: 'messages' }).waitFor()
    await page.locator('.side-bar-path', { hasText: 'notes' }).click()
    await page.locator('.service-area-path', { hasText: 'notes' }).waitFor()
    await records(page).first().waitFor()
    await statusSays(page, `Connected as ${USER.email}`)
    expect(await page.getByRole('dialog').count()).toBe(0)
    expect(await page.locator('.service-area-notice').count()).toBe(0)
}, 40_000)

test('a record is selected by a click and by the keyboard, and stays selected when the service is chosen again', async () => {
    const page = await openApp(await newContext(storedSetup(['messages', 'notes']), 'messages'))
    const selected = page.locator('.service-area-records [role="row"][aria-selected="true"]')

    await loggedIn(page)
    await records(page).nth(2).click()
    await selected.filter({ hasText: 'Message number 3' }).waitFor()

    await page.keyboard.press('ArrowDown')
    await selected.filter({ hasText: 'Message number 4' }).waitFor()

    await page.locator('.side-bar-path', { hasText: 'notes' }).click()
    await page.locator('.service-area-path', { hasText: 'notes' }).waitFor()
    await page.locator('.side-bar-path', { hasText: 'messages' }).click()
    await selected.filter({ hasText: 'Message number 4' }).waitFor()
}, 30_000)

test('a click on a header sorts by its column, and Last changed puts a record changed elsewhere on top', async () => {
    const page = await openApp(await newContext(storedSetup(['messages', 'notes']), 'messages'))
    const header = page.locator('.service-area-records [role="columnheader"]', { hasText: 'id' }).first()

    await loggedIn(page)
    await records(page).first().filter({ hasText: 'Message number 1' }).waitFor()

    await header.getByRole('button').click()
    await header.getByRole('button').click()
    await page.locator('[role="columnheader"][aria-sort="descending"]').waitFor()
    await records(page).first().filter({ hasText: 'Message number 25' }).waitFor()

    await page.getByRole('button', { name: 'Last changed' }).click()
    await records(page).first().filter({ hasText: 'Message number 1' }).waitFor()

    const answer = await fetch(`${SERVER_URL}/messages/7`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: 'Changed just now' }),
    })

    expect(answer.ok).toBe(true)
    await records(page).first().filter({ hasText: 'Changed just now' }).waitFor()
}, 30_000)

test('a search shows the records that have its words, says how many, and Escape clears it', async () => {
    const page = await openApp(await newContext(storedSetup(['messages', 'notes']), 'messages'))
    const search = page.getByRole('searchbox', { name: 'Search the records' })
    const line = page.locator('.service-area-line')

    await loggedIn(page)
    await records(page).first().waitFor()

    const answer = await fetch(`${SERVER_URL}/messages/11`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: 'A zebra crossing' }),
    })

    expect(answer.ok).toBe(true)
    await search.fill('ZEBRA cross')
    await line.filter({ hasText: '1 of 25 records · live' }).waitFor()
    expect(await records(page).count()).toBe(1)
    await records(page).first().filter({ hasText: 'A zebra crossing' }).waitFor()

    await search.fill('zebra giraffe')
    await page.getByText('No records have “zebra giraffe”.').waitFor()

    await search.press('Escape')
    await line.filter({ hasText: '25 records · live' }).waitFor()
    expect(await search.inputValue()).toBe('')
}, 30_000)

test('a new record is made from its template once the server takes it, and removed after asking', async () => {
    const page = await openApp(await newContext(storedSetup(['tasks']), 'tasks'))
    const line = page.locator('.service-area-line')
    const dialog = page.getByRole('dialog', { name: 'New Record' })
    const json = dialog.getByRole('textbox', { name: 'Record, as JSON' })

    await loggedIn(page)
    await line.filter({ hasText: '3 records · live' }).waitFor()

    // The template has every field but the ID, and the schema of `tasks` takes none of the dates
    await page.getByRole('button', { name: 'New', exact: true }).click()
    expect(JSON.parse(await json.inputValue())).toMatchObject({ title: '', done: false, priority: 0 })
    await dialog.getByRole('button', { name: 'Create' }).click()
    await dialog.getByRole('alert').waitFor()
    expect(await dialog.getByRole('alert').locator('li').count()).toBeGreaterThan(0)

    await json.fill('{ "title": "  Buy milk ", "done": false, "priority": 2 }')
    await json.press('ControlOrMeta+Enter')
    await dialog.waitFor({ state: 'detached' })
    await line.filter({ hasText: '4 records · live' }).waitFor()
    await page.locator('.service-area-records [aria-selected="true"]', { hasText: 'Buy milk' }).waitFor()

    await page.getByRole('grid').press('Delete')
    const ask = page.getByRole('dialog', { name: 'Remove the record?' })

    await ask.getByRole('button', { name: 'Remove' }).click()
    await line.filter({ hasText: '3 records · live' }).waitFor()
    expect(await records(page).filter({ hasText: 'Buy milk' }).count()).toBe(0)
}, 30_000)
