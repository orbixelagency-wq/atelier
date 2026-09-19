import { useEffect } from 'react'
import { useStore } from './state/store'
import { Editor } from './ui/Editor'
import { Gallery } from './ui/Gallery'

export default function App() {
  const screen = useStore((s) => s.screen)
  const light = useStore((s) => s.prefs.light)
  useEffect(() => {
    document.documentElement.dataset.theme = light ? 'light' : 'dark'
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', light ? '#f6f5f2' : '#161514')
  }, [light])
  return screen === 'editor' ? <Editor /> : <Gallery />
}
