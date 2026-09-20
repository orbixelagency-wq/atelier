import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './styles.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// Ask the browser to keep the artworks: without this, iPadOS and Safari may evict them after a few unused days.
if (navigator.storage?.persist) {
  navigator.storage.persisted().then((ok) => { if (!ok) navigator.storage.persist().catch(() => {}) }).catch(() => {})
}

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => navigator.serviceWorker.register(import.meta.env.BASE_URL + 'sw.js').catch(() => {}))
}

if (import.meta.env.DEV) {
  // Dev-only handle for automated tests.
  Promise.all([import('./state/store'), import('./state/docOps'), import('./state/editor'), import('./state/session'), import('./engine/io'), import('./ui/actions'), import('./state/history')])
    .then(([store, docOps, ed, session, io, actions, history]) => { (window as any).__atelier = { store, docOps, editor: ed.editor, session, io, actions, history } })
}
