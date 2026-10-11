import { expect, test } from 'bun:test'
import { mount } from '@vue/test-utils'
import App from './App.vue'

test('the app renders its name', () => {
    const wrapper = mount(App)

    expect(wrapper.find('h1').text()).toBe('feathers-gui')
})
