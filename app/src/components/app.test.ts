import { expect, test } from 'bun:test'
import { mount } from '@vue/test-utils'
import { FakeBrowser } from '../../test-support/fake-browser.ts'
import { APP_KEY, App as GuiApp } from '../app/app.ts'
import App from './App.vue'

test('the app renders its name', () => {
    const app = new GuiApp({ storage: new FakeBrowser().open() })
    const wrapper = mount(App, { global: { provide: { [APP_KEY as symbol]: app } } })

    expect(wrapper.find('h1').text()).toBe('feathers-gui')
})
