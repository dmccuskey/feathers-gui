// The attributes of an input that holds nothing personal: a path, an address, the name of a field. The browser
// offers nothing for it and does not check its spelling, and the password managers that go by an attribute
// (1Password, LastPass, Bitwarden) leave it alone: `autocomplete="off"` does not stop them.
export const PLAIN_INPUT = {
    autocomplete: 'off',
    spellcheck: false,
    'data-1p-ignore': '',
    'data-lpignore': 'true',
    'data-bwignore': '',
} as const
