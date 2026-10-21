import { expect, test } from 'bun:test'
import { mount } from '@vue/test-utils'
import { defineComponent, h, ref } from 'vue'
import UiButton from './UiButton.vue'
import UiCheckbox from './UiCheckbox.vue'
import UiDialog from './UiDialog.vue'
import UiField from './UiField.vue'
import UiInput from './UiInput.vue'
import UiSelect from './UiSelect.vue'
import UiTable from './UiTable.vue'

test('a button is a native button that does not submit, unless it is told to', () => {
    const plain = mount(UiButton, { slots: { default: 'Cancel' } })
    const submit = mount(UiButton, { props: { type: 'submit', variant: 'primary' }, attrs: { disabled: true } })

    expect(plain.element.tagName).toBe('BUTTON')
    expect(plain.text()).toBe('Cancel')
    expect(plain.attributes('type')).toBe('button')
    expect(submit.attributes('type')).toBe('submit')
    expect(submit.classes()).toContain('ui-button-primary')
    expect(submit.attributes('disabled')).toBeDefined()
})

test('an input shows its value and gives back what is typed', async () => {
    const wrapper = mount(UiInput, { props: { modelValue: 'Local' }, attrs: { placeholder: 'A name' } })

    expect((wrapper.element as HTMLInputElement).value).toBe('Local')
    expect(wrapper.attributes('placeholder')).toBe('A name')

    await wrapper.setValue('Remote')

    expect(wrapper.emitted('update:modelValue')).toEqual([['Remote']])
})

test('a select shows its options and gives back the value of the one picked, as it was given', async () => {
    const options = [
        { value: 10, label: 'Ten' },
        { value: 25, label: 'Twenty-five' },
    ]
    const wrapper = mount(UiSelect, { props: { modelValue: 10, options } })

    expect(wrapper.findAll('option').map(option => option.text())).toEqual(['Ten', 'Twenty-five'])
    expect((wrapper.element as HTMLSelectElement).selectedIndex).toBe(0)

    await wrapper.setValue(25)

    expect(wrapper.emitted('update:modelValue')).toEqual([[25]])
})

test('a checkbox is checked by a click on its label too', async () => {
    const wrapper = mount(UiCheckbox, { props: { modelValue: false }, slots: { default: 'Read only' } })
    const input = wrapper.find('input')

    expect(wrapper.element.tagName).toBe('LABEL')
    expect(wrapper.text()).toBe('Read only')
    expect(input.element.checked).toBe(false)

    await input.setValue(true)

    expect(wrapper.emitted('update:modelValue')).toEqual([[true]])
})

test('a field ties its label, its hint and its error to the control in it', async () => {
    const error = ref<string>()
    const wrapper = mount(
        defineComponent(
            () => () =>
                h(UiField, { label: 'Address', hint: 'Where it listens', error: error.value }, () => h(UiInput)),
        ),
    )
    const input = wrapper.find('input')
    const note = () => wrapper.find('.ui-field-note')

    expect(input.attributes('id')).toBeTruthy()
    expect(wrapper.find('label').attributes('for')).toBe(input.attributes('id'))
    expect(note().text()).toBe('Where it listens')
    expect(input.attributes('aria-describedby')).toBe(note().attributes('id'))
    expect(input.attributes('aria-invalid')).toBeUndefined()

    error.value = 'Not an address'
    await wrapper.vm.$nextTick()

    expect(note().text()).toBe('Not an address')
    expect(note().classes()).toContain('ui-field-error')
    expect(input.attributes('aria-invalid')).toBe('true')
})

test('a field with no hint and no error describes nothing', () => {
    const wrapper = mount(UiField, { props: { label: 'Name' }, slots: { default: () => h(UiSelect, { options: [] }) } })

    expect(wrapper.find('.ui-field-note').exists()).toBe(false)
    expect(wrapper.find('select').attributes('aria-describedby')).toBeUndefined()
    expect(wrapper.find('label').attributes('for')).toBe(wrapper.find('select').attributes('id'))
})

function mountDialog() {
    return mount(UiDialog, {
        props: { title: 'Add a server' },
        slots: { default: () => h(UiInput), buttons: () => h(UiButton, { type: 'submit' }, () => 'Add') },
        attachTo: document.body,
    })
}

test('a dialog is open as a modal while it is rendered, and named by its title', () => {
    const wrapper = mountDialog()
    const dialog = wrapper.element as HTMLDialogElement

    expect(dialog.open).toBe(true)
    expect(wrapper.find(`#${dialog.getAttribute('aria-labelledby')}`).text()).toBe('Add a server')

    wrapper.unmount()

    expect(dialog.open).toBe(false)
    expect(wrapper.emitted('cancel')).toBeUndefined()
})

test('Escape asks to cancel, and the dialog stays open until its owner takes it away', async () => {
    const wrapper = mountDialog()
    const event = new window.Event('cancel', { cancelable: true })

    wrapper.element.dispatchEvent(event)

    expect(event.defaultPrevented).toBe(true)
    expect(wrapper.emitted('cancel')).toHaveLength(1)
    expect((wrapper.element as HTMLDialogElement).open).toBe(true)

    wrapper.unmount()
})

test('a dialog the browser closed itself asks to cancel', () => {
    const wrapper = mountDialog()

    ;(wrapper.element as HTMLDialogElement).close()

    expect(wrapper.emitted('cancel')).toHaveLength(1)

    wrapper.unmount()
})

test('the submit button of a dialog submits it, and nothing leaves the page', async () => {
    const wrapper = mountDialog()

    await wrapper.find('form').trigger('submit')

    expect(wrapper.emitted('submit')).toHaveLength(1)
    expect((wrapper.element as HTMLDialogElement).open).toBe(true)

    wrapper.unmount()
})

test('a sortable table’s headers ask for a sort by their column; another table’s are plain', async () => {
    const columns = [{ key: 'n', label: 'N', text: (row: unknown) => String((row as { n: number }).n) }]
    const props = { columns, rows: [{ n: 1 }], rowKey: (row: unknown) => (row as { n: number }).n }
    const sortable = mount(UiTable, { props: { ...props, sortable: true, sortKey: 'n', sortDescending: true } })

    await sortable.find('[role="columnheader"] button').trigger('click')
    expect(sortable.emitted('sort')).toEqual([['n']])
    expect(sortable.find('[role="columnheader"]').attributes('aria-sort')).toBe('descending')
    expect(sortable.find('[role="columnheader"]').text()).toBe('N▼')

    expect(mount(UiTable, { props }).find('[role="columnheader"] button').exists()).toBe(false)
})
