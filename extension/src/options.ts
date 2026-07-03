import browser from 'webextension-polyfill'

const tokenInput = document.getElementById('token') as HTMLInputElement
const status = document.getElementById('status') as HTMLParagraphElement

void browser.storage.local.get('token').then(({ token }) => {
  if (typeof token === 'string') tokenInput.value = token
})

document.getElementById('save')?.addEventListener('click', () => {
  void browser.storage.local.set({ token: tokenInput.value.trim() }).then(() => {
    status.textContent = 'Saved.'
  })
})
