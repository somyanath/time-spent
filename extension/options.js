const tokenInput = document.getElementById('token')
const status = document.getElementById('status')

browser.storage.local.get('token').then(({ token }) => {
  if (token) tokenInput.value = token
})

document.getElementById('save').addEventListener('click', () => {
  browser.storage.local.set({ token: tokenInput.value.trim() }).then(() => {
    status.textContent = 'Saved.'
  })
})
