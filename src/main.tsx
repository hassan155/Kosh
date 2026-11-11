import { StrictMode } from 'react'
import type { ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, MemoryRouter, useLocation } from 'react-router-dom'
import App from './App.tsx'
import NovaErrorBoundary from './lib/nova-error-boundary'
import './nova-theme.css'
import './index.css'
import './nova-overrides.css'

// basename: where this app is mounted. In the editor that is '/', but a
// published site is served from /api/live-assets/<id>/, and a router
// comparing its routes against the raw pathname would match none of
// them — a shared link to /about rendered an empty page. The server
// sets __NOVA_BASENAME__ when it serves the published shell.
const basename = (window as any).__NOVA_BASENAME__ || '/'

// The workspace preview is sandboxed, so history.pushState throws there
// and a BrowserRouter cannot navigate at all. MemoryRouter behaves
// identically from the app's point of view and needs no URL.
const inPreview = (window as any).__NOVA_ROUTER__ === 'memory'
const Router: any = inPreview ? MemoryRouter : BrowserRouter
const routerProps: any = inPreview
  ? { initialEntries: ['/'] }
  : { basename }

// The boundary's reset key. It has to be read INSIDE the router: a
// MemoryRouter never touches the URL, so the location it holds is the
// only thing that knows the preview moved to another page. Without this
// the boundary compared undefined with undefined and one broken route
// was a dead app until a reload.
function NovaRoutedBoundary({ children }: { children: ReactNode }) {
  const location = useLocation()
  return (
    <NovaErrorBoundary resetKey={location.pathname + location.search}>
      {children}
    </NovaErrorBoundary>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Router {...routerProps}>
      <NovaRoutedBoundary>
        <App />
      </NovaRoutedBoundary>
    </Router>
  </StrictMode>,
)
