import { expect, test } from 'bun:test'
import { mount } from '@vue/test-utils'
import { reactive } from 'vue'
import type { ServiceView } from '../app/service-view.ts'
import ServiceDot from './ServiceDot.vue'

// What the dot reads of a view: a view loaded whole and ready, with `changes` changes so far
const fakeView = (changes: number) =>
    reactive({ status: { phase: 'ready' }, isWhole: true, hasUnseenChanges: false, changeCount: changes })

test('the dot pulses at a change of its view, and not when it is handed another view with more changes', async () => {
    const notes = fakeView(0)
    const messages = fakeView(1)
    const wrapper = mount(ServiceDot, { props: { view: notes as unknown as ServiceView } })
    const pulses = () => wrapper.find('.service-dot').classes().includes('service-dot-pulse')

    await wrapper.setProps({ view: messages as unknown as ServiceView })
    expect(pulses()).toBe(false)

    messages.changeCount++
    await wrapper.vm.$nextTick()
    expect(pulses()).toBe(true)
})
