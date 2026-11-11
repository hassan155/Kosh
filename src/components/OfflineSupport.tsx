import { useEffect } from 'react'

export default function OfflineSupport() {
  useEffect(() => {
    const basename = (window as Window & { __NOVA_BASENAME__?: string }).__NOVA_BASENAME__ || './'
    const manifest = document.createElement('link')
    manifest.rel = 'manifest'
    manifest.href = `${basename.replace(/\/$/, '')}/manifest.webmanifest`
    document.head.appendChild(manifest)
    document.title = 'Kosh — Private local archive'
    if ('serviceWorker' in navigator && import.meta.env.PROD) {
      void navigator.serviceWorker.register(`${basename.replace(/\/$/, '')}/service-worker.js`).catch((error) => {
        console.error('Kosh offline support could not be installed:', error)
      })
    }
    return () => manifest.remove()
  }, [])
  return null
}
