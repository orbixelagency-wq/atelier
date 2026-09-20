import { Download, Share } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Dialog } from './common'

interface PromptEvent extends Event { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> }

const isStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true

/** Offers to install Atelier as an app: the native prompt where it exists, instructions where it doesn't. */
export function InstallApp() {
  const [prompt, setPrompt] = useState<PromptEvent | null>(null)
  const [installed, setInstalled] = useState(isStandalone())
  const [help, setHelp] = useState(false)
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && /mac/i.test(navigator.userAgent))

  useEffect(() => {
    const onPrompt = (e: Event) => { e.preventDefault(); setPrompt(e as PromptEvent) }
    const onInstalled = () => { setInstalled(true); setPrompt(null) }
    window.addEventListener('beforeinstallprompt', onPrompt)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  if (installed) return null

  const install = async () => {
    if (prompt) {
      await prompt.prompt()
      const { outcome } = await prompt.userChoice
      if (outcome === 'accepted') setInstalled(true)
      setPrompt(null)
    } else setHelp(true)
  }

  return (
    <>
      <button className="tb-btn" onClick={install} title="Instalar Atelier como aplicación">
        <Download size={18} />
        <span className="lbl">Instalar</span>
      </button>
      {help && (
        <Dialog onClose={() => setHelp(false)}>
          <h2>Instalar Atelier</h2>
          {ios ? (
            <p style={{ margin: 0, color: 'var(--ink-2)', lineHeight: 1.6 }}>
              En el iPad o el iPhone, con esta página abierta en Safari: toca <Share size={15} style={{ verticalAlign: '-2px' }} /> <b>Compartir</b> y elige
              <b> Añadir a pantalla de inicio</b>. Atelier se abrirá a pantalla completa, con su icono y sin la barra del navegador.
            </p>
          ) : (
            <p style={{ margin: 0, color: 'var(--ink-2)', lineHeight: 1.6 }}>
              En Chrome o Edge, pulsa el icono de instalar de la barra de direcciones (a la derecha del enlace) o abre el menú <b>···</b> y elige
              <b> Instalar Atelier</b>. En Firefox y Safari de escritorio no existe esa opción: usa la web normalmente o crea un acceso directo.
            </p>
          )}
          <p style={{ margin: 0, color: 'var(--ink-3)', fontSize: 13 }}>
            Una vez instalada funciona sin conexión y tus obras se guardan en ese dispositivo.
          </p>
          <div className="row" style={{ justifyContent: 'flex-end' }}>
            <button className="btn primary" onClick={() => setHelp(false)}>Entendido</button>
          </div>
        </Dialog>
      )}
    </>
  )
}
