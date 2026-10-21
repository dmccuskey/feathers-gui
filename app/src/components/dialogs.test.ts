import { expect, test } from 'bun:test'
import { flushPromises, mount } from '@vue/test-utils'
import type { RecordDialogInput, ServerDialogInput, ServiceDialogInput } from '../app/app.ts'
import { WriteError } from '../app/service-view.ts'
import type { ServiceSetup } from '../app/setup.ts'
import RecordDialog from './RecordDialog.vue'
import ServerDialog from './ServerDialog.vue'
import ServiceDialog from './ServiceDialog.vue'

const submit = (wrapper: ReturnType<typeof mount>) => wrapper.find('form').trigger('submit')

function mountServer(input: ServerDialogInput = { hasSecret: false }) {
    const wrapper = mount(ServerDialog, { props: { input } })
    /** The input under the label. */
    const field = (label: string) => {
        const found = wrapper.findAll('.ui-field').find(each => each.find('label').text() === label)

        if (!found) throw new Error(`No field "${label}"`)

        return found
    }

    return { wrapper, field }
}

test('a server needs an address that is one', async () => {
    const { wrapper, field } = mountServer()

    await submit(wrapper)

    expect(field('Address').find('.ui-field-error').text()).toBe('A server needs its address.')

    await field('Address').find('input').setValue('localhost:3030')
    expect(field('Address').find('.ui-field-error').text()).toContain('http://')
    expect(wrapper.emitted('answer')).toBeUndefined()

    await field('Address').find('input').setValue(' http://localhost:3030 ')
    await submit(wrapper)

    expect(wrapper.emitted('answer')).toEqual([
        [{ server: { name: '', url: 'http://localhost:3030', readOnly: false }, secret: null }],
    ])
})

test('a local login answers its fields, and the password apart', async () => {
    const { wrapper, field } = mountServer()

    await field('Address').find('input').setValue('http://localhost:3030')
    await field('Login').find('select').setValue('local')
    await field('Username field').find('input').setValue('username')
    await field('Username').find('input').setValue('ada')
    await field('Password').find('input').setValue('hunter2')

    expect(field('Password').find('input').attributes('type')).toBe('password')
    expect(wrapper.find('.server-dialog-note').text()).toContain('stored nowhere')

    await wrapper.find('.ui-checkbox input').setValue(true)

    expect(wrapper.find('.server-dialog-warning').text()).toContain('plain text')

    await submit(wrapper)

    expect(wrapper.emitted('answer')).toEqual([
        [
            {
                server: {
                    name: '',
                    url: 'http://localhost:3030',
                    readOnly: false,
                    login: {
                        kind: 'local',
                        path: 'authentication',
                        usernameField: 'username',
                        passwordField: 'password',
                        username: 'ada',
                        remember: true,
                    },
                },
                secret: 'hunter2',
            },
        ],
    ])
})

test('a server that is edited shows what it has, and a secret in hand is left when none is typed', async () => {
    const { wrapper, field } = mountServer({
        hasSecret: true,
        server: {
            id: 'a',
            name: 'Local',
            url: 'http://localhost:3030',
            readOnly: true,
            login: {
                kind: 'token',
                path: 'auth',
                usernameField: '',
                passwordField: '',
                username: '',
                remember: false,
            },
        },
    })

    expect(wrapper.find('.ui-dialog-title').text()).toBe('Edit the Server')
    expect(field('Authentication service').find('input').element.value).toBe('auth')
    expect(field('Access token').find('input').attributes('placeholder')).toBe('Unchanged')
    expect(wrapper.find('.server-dialog-note').text()).toContain('The token is held')

    await wrapper.find('.ui-checkbox input').setValue(true)

    expect(wrapper.find('.server-dialog-warning').text()).toContain('The token is stored in this browser as plain text')

    await submit(wrapper)

    expect(wrapper.emitted('answer')?.[0]).toMatchObject([
        {
            server: { name: 'Local', readOnly: true, login: { kind: 'token', path: 'auth', remember: true } },
            secret: null,
        },
    ])
})

function mountService(input: ServiceDialogInput = { taken: ['messages'] }) {
    return mount(ServiceDialog, { props: { input } })
}

test('a service needs a path that is not set up yet', async () => {
    const wrapper = mountService()

    await submit(wrapper)
    expect(wrapper.find('.ui-field-error').text()).toBe('A service needs its path.')

    await wrapper.find('.ui-input').setValue('/messages/')
    expect(wrapper.find('.ui-field-error').text()).toBe('This service is already set up.')
    expect(wrapper.emitted('answer')).toBeUndefined()
})

test('a service answers its path without the slashes around it, and how it is loaded', async () => {
    const wrapper = mountService()

    expect(wrapper.findAll('input[type="radio"]').map(radio => (radio.element as HTMLInputElement).checked)).toEqual([
        true,
        false,
        false,
    ])

    await wrapper.find('.ui-input').setValue(' /api/users/ ')
    await wrapper.find('input[value="paged"]').setValue(true)
    await submit(wrapper)

    expect(wrapper.emitted('answer')).toEqual([[{ path: 'api/users', load: 'paged', idField: undefined }]])
})

test('a service answers the ID field typed, and none when it is left blank', async () => {
    const service: ServiceSetup = {
        id: 's1',
        serverId: 'v1',
        path: 'things',
        idField: 'uuid',
        load: 'auto',
        fields: [],
        pins: [],
    }
    const wrapper = mountService({ service, taken: [] })
    const idField = wrapper.find('.service-dialog-id-field')

    expect((idField.element as HTMLInputElement).value).toBe('uuid')

    await idField.setValue(' key ')
    await submit(wrapper)
    await idField.setValue('  ')
    await submit(wrapper)

    expect(wrapper.emitted('answer')).toEqual([
        [{ path: 'things', load: 'auto', idField: 'key' }],
        [{ path: 'things', load: 'auto', idField: undefined }],
    ])
})

test("the ID field's placeholder says what the session guessed, or that nothing will do", () => {
    const placeholder = (guessedIdField?: string | null) =>
        mountService({ taken: [], ...(guessedIdField === undefined ? {} : { guessedIdField }) })
            .find('.service-dialog-id-field')
            .attributes('placeholder')

    expect([placeholder(), placeholder('_id'), placeholder(null)]).toEqual([
        'Guessed',
        "Guessed as '_id'",
        'Neither id nor _id: name it',
    ])
})

function mountRecord(create: RecordDialogInput['create']) {
    return mount(RecordDialog, { props: { input: { path: 'tasks', record: { title: '', done: false }, create } } })
}

test('a new record starts from its template, and text that is no JSON object is said and not sent', async () => {
    const created: unknown[] = []
    const wrapper = mountRecord(async raw => void created.push(raw))
    const create = () => wrapper.findAll('button').find(button => button.text() === 'Create')!

    expect(JSON.parse((wrapper.find('textarea').element as HTMLTextAreaElement).value)).toEqual({
        title: '',
        done: false,
    })

    await wrapper.find('textarea').setValue('[1, 2]')
    expect(wrapper.find('.ui-field-error').text()).toBe('A record is a JSON object, in braces.')
    expect(create().attributes('disabled')).toBeDefined()
    await submit(wrapper)
    expect(created).toEqual([])

    await wrapper.find('textarea').setValue('{ "title": "Shop" }')
    expect(wrapper.find('.ui-field-error').exists()).toBe(false)
    await submit(wrapper)
    await flushPromises()

    expect(created).toEqual([{ title: 'Shop' }])
    expect(wrapper.emitted('answer')).toEqual([[null]])
})

test('a record the server refuses keeps the dialog open, with the reasons field by field', async () => {
    const wrapper = mountRecord(async () => {
        throw new WriteError(
            'validation failed',
            'server',
            Object.assign(new Error('validation failed'), {
                data: [{ instancePath: '/title', message: 'must NOT have fewer than 1 characters' }],
            }),
        )
    })

    await submit(wrapper)
    await flushPromises()

    expect(wrapper.find('[role="alert"]').text()).toContain('validation failed')
    expect(wrapper.findAll('[role="alert"] li').map(item => item.text())).toEqual([
        'title must NOT have fewer than 1 characters',
    ])
    expect(wrapper.emitted('answer')).toBeUndefined()
    expect(JSON.parse((wrapper.find('textarea').element as HTMLTextAreaElement).value)).toEqual({
        title: '',
        done: false,
    })
})
