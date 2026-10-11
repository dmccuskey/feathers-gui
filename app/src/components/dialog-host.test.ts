import { expect, test } from 'bun:test'
import { mount } from '@vue/test-utils'
import { defineComponent, h, markRaw, nextTick, type PropType } from 'vue'
import { Dialogs } from '../app/dialogs.ts'
import DialogHost from './DialogHost.vue'

type Kinds = {
    confirm: { input: { question: string }; answer: boolean }
    rename: { input: { name: string }; answer: string }
}

const Confirm = defineComponent({
    props: { input: { type: Object as PropType<Kinds['confirm']['input']>, required: true } },
    emits: ['answer', 'cancel'],
    setup(props, { emit }) {
        return () =>
            h('section', { class: 'confirm' }, [
                h('p', props.input.question),
                h('button', { class: 'yes', onClick: () => emit('answer', true) }),
                h('button', { class: 'no', onClick: () => emit('answer', false) }),
                h('button', { class: 'close', onClick: () => emit('cancel') }),
            ])
    },
})

const Rename = defineComponent({
    props: { input: { type: Object as PropType<Kinds['rename']['input']>, required: true } },
    emits: ['answer', 'cancel'],
    setup(props, { emit }) {
        return () =>
            h('section', { class: 'rename' }, [
                h('p', props.input.name),
                h('button', { class: 'save', onClick: () => emit('answer', `${props.input.name}!`) }),
            ])
    },
})

// `mount()` makes its props deeply reactive, which a template does not: an object with `#private` fields has to be
// kept out of that proxy (ADR 002), and so have the components.
function mountHost(dialogs: Dialogs<Kinds>) {
    const components = markRaw({ confirm: Confirm, rename: Rename })

    return mount(DialogHost, { props: { dialogs: markRaw(dialogs), components } })
}

test('with no dialog open, nothing is rendered', () => {
    const wrapper = mountHost(new Dialogs<Kinds>())

    expect(wrapper.find('section').exists()).toBe(false)
})

test('a dialog shown is rendered by the component of its kind, with what it was opened with', async () => {
    const dialogs = new Dialogs<Kinds>()
    const wrapper = mountHost(dialogs)

    void dialogs.show('confirm', { question: 'Remove it?' })
    await nextTick()

    expect(wrapper.find('.confirm p').text()).toBe('Remove it?')
})

test('what the component answers is what show() returns, and the dialog is gone', async () => {
    const dialogs = new Dialogs<Kinds>()
    const wrapper = mountHost(dialogs)
    const answer = dialogs.show('confirm', { question: 'Remove it?' })
    await nextTick()

    await wrapper.find('.no').trigger('click')

    expect(await answer).toBe(false)
    expect(wrapper.find('.confirm').exists()).toBe(false)
})

test('a cancel by the component makes show() return undefined', async () => {
    const dialogs = new Dialogs<Kinds>()
    const wrapper = mountHost(dialogs)
    const answer = dialogs.show('confirm', { question: 'Remove it?' })
    await nextTick()

    await wrapper.find('.close').trigger('click')

    expect(await answer).toBeUndefined()
    expect(wrapper.find('.confirm').exists()).toBe(false)
})

test('a dialog opened over another is rendered after it, and closing it leaves the other', async () => {
    const dialogs = new Dialogs<Kinds>()
    const wrapper = mountHost(dialogs)
    const rename = dialogs.show('rename', { name: 'Local' })
    const confirm = dialogs.show('confirm', { question: 'Discard the change?' })
    await nextTick()

    expect(wrapper.findAll('section').map(section => section.classes()[0])).toEqual(['rename', 'confirm'])

    await wrapper.find('.yes').trigger('click')

    expect(await confirm).toBe(true)
    expect(wrapper.findAll('section').map(section => section.classes()[0])).toEqual(['rename'])

    await wrapper.find('.save').trigger('click')

    expect(await rename).toBe('Local!')
})
