import { expect, test } from 'bun:test'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { FakeBrowser, FakeStorage } from '../../test-support/fake-browser.ts'
import { APP_KEY, App as GuiApp } from '../app/app.ts'
import type { ServerSetup, ServiceSetup } from '../app/setup.ts'
import { THEMING_KEY, Theming } from '../widgets/index.ts'
import App from './App.vue'

function mountApp() {
    const app = new GuiApp({ storage: new FakeBrowser().open() })
    const theming = new Theming({
        root: document.createElement('div'),
        dark: Object.assign(new EventTarget(), { matches: false }),
        storage: new FakeStorage(),
    })
    const wrapper = mount(App, {
        global: { provide: { [APP_KEY as symbol]: app, [THEMING_KEY as symbol]: theming } },
    })

    return { app, theming, wrapper }
}

function addServer(app: GuiApp, name: string): ServerSetup {
    return app.setup.addServer({ name, url: `http://${name}.test`, readOnly: false })
}

function addService(app: GuiApp, server: ServerSetup, path: string): ServiceSetup {
    return app.setup.addService({ serverId: server.id, path, load: 'auto', fields: [], pins: [] })
}

test('the app renders its name', () => {
    expect(mountApp().wrapper.find('h1').text()).toBe('feathers-gui')
})

test('with nothing set up, the area says so and the side bar has no services', () => {
    const { wrapper } = mountApp()

    expect(wrapper.find('.service-area-empty').text()).toContain('No servers are set up.')
    expect(wrapper.find('.side-bar select').attributes('disabled')).toBeDefined()
    expect(wrapper.find('.side-bar-services').exists()).toBe(false)
})

test('the select lists the servers by name and address, and choosing one activates it', async () => {
    const { app, wrapper } = mountApp()
    const local = addServer(app, 'local')

    app.setup.addServer({ name: '', url: 'http://other.test', readOnly: false })
    await nextTick()

    const select = wrapper.find('.side-bar select')

    expect(select.findAll('option').map(option => option.text())).toEqual([
        'Choose a server',
        'local (http://local.test)',
        'http://other.test',
    ])
    expect(wrapper.find('.service-area-empty').text()).toContain('No server is chosen.')

    await select.setValue(local.id)

    expect(app.session?.serverId).toBe(local.id)
    expect(app.setup.currentServerId).toBe(local.id)
    expect(select.findAll('option')).toHaveLength(2)
    expect(wrapper.find('.service-area-empty').text()).toContain('No services are set up')
})

test('the services of the current server are listed by path, and choosing one shows it', async () => {
    const { app, wrapper } = mountApp()
    const local = addServer(app, 'local')
    const other = addServer(app, 'other')

    addService(app, local, 'things')
    addService(app, local, 'messages')
    addService(app, other, 'notes')
    app.activateServer(local.id)
    await nextTick()

    const paths = wrapper.findAll('.side-bar-path')

    expect(paths.map(path => path.text())).toEqual(['messages', 'things'])
    expect(wrapper.find('.service-area-empty').text()).toContain('No service is chosen.')

    await paths[1]?.trigger('click')

    expect(app.setup.currentServiceId(local.id)).toBe(app.setup.servicesOf(local.id)[0]?.id ?? null)
    expect(wrapper.find('.side-bar-current .side-bar-path').text()).toBe('things')
    expect(wrapper.find('.service-area-path').text()).toBe('things')
})

test('a setup that cannot be used is said', async () => {
    const browser = new FakeBrowser()
    const app = new GuiApp({ storage: browser.open() })

    browser.local.setItem('feathers-gui.setup', 'not a setup')

    expect(() => addServer(app, 'local')).toThrow()

    const wrapper = mount(App, {
        global: {
            provide: { [APP_KEY as symbol]: app, [THEMING_KEY as symbol]: mountApp().theming },
        },
    })

    expect(wrapper.find('.service-area-notice').text()).toContain('cannot be read')
})

test('"Info" opens the dialog that says what the app is', async () => {
    const { app, wrapper } = mountApp()
    const info = wrapper.findAll('.app-header button').find(button => button.text() === 'Info')

    await info?.trigger('click')

    expect(app.dialogs.open.map(dialog => dialog.kind)).toEqual(['info'])
    expect(wrapper.find('dialog').text()).toContain('Feathersjs server')
})
