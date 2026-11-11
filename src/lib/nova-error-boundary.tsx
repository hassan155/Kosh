// Added by Nova. Engine-owned: do not edit, copy or rewrite this file.
//
// React unmounts the whole tree on an uncaught render error, so without a
// boundary one broken component blanks the entire site. This keeps the
// failure visible and local, and deliberately still reports the error so
// Nova's checks can see it.
import { Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'

// Where the app currently is, as one string. Used only to tell one
// navigation from the next -- never parsed.
const novaLocationKey = (): string => {
  try {
    return window.location.pathname + window.location.search + window.location.hash
  } catch {
    return ''
  }
}

// Navigation, for a boundary that may be mounted OUTSIDE any router.
// The two history methods every router calls are wrapped once, and the
// original is called first and its return value passed straight back, so
// history behaves exactly as it did -- including throwing where a
// sandboxed preview makes pushState throw.
const NOVA_NAV_EVENT = 'nova:navigation'

function novaWatchNavigation(onNavigate: () => void): () => void {
  if (typeof window === 'undefined') return () => {}
  const w = window as any
  if (!w.__novaNavWatched) {
    w.__novaNavWatched = true
    const h = window.history as any
    for (const name of ['pushState', 'replaceState']) {
      const original = h[name]
      if (typeof original !== 'function') continue
      h[name] = function (this: History, ...args: any[]) {
        const result = original.apply(this, args)
        try { window.dispatchEvent(new Event(NOVA_NAV_EVENT)) } catch {}
        return result
      }
    }
  }
  window.addEventListener(NOVA_NAV_EVENT, onNavigate)
  window.addEventListener('popstate', onNavigate)
  window.addEventListener('hashchange', onNavigate)
  return () => {
    window.removeEventListener(NOVA_NAV_EVENT, onNavigate)
    window.removeEventListener('popstate', onNavigate)
    window.removeEventListener('hashchange', onNavigate)
  }
}

type Props = { children: ReactNode; resetKey?: string }
type State = { error: Error | null }

export default class NovaErrorBoundary extends Component<Props, State> {
  state: State = { error: null }
  private erroredAt = ''
  private unwatch: (() => void) | null = null

  componentDidMount() {
    this.unwatch = novaWatchNavigation(this.handleNavigation)
  }

  componentWillUnmount() {
    if (this.unwatch) this.unwatch()
    this.unwatch = null
  }

  // Only ever clears an error, and only once the app is somewhere else.
  handleNavigation = () => {
    if (this.state.error && novaLocationKey() !== this.erroredAt) {
      this.setState({ error: null })
    }
  }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidUpdate(prev: Props) {
    // A different route is a different render. Clearing here is what stops
    // one broken page from being a permanently dead app.
    if (this.state.error && prev.resetKey !== this.props.resetKey) {
      this.setState({ error: null })
    }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    this.erroredAt = novaLocationKey()
    // REPORTED, NOT SWALLOWED. Nova's browser check reads console errors
    // and this list; a build whose app threw has to keep failing.
    const w = window as any
    w.__novaRuntimeErrors = w.__novaRuntimeErrors || []
    w.__novaRuntimeErrors.push({
      message: String((error && error.message) || error),
      stack: String((error && error.stack) || ''),
      componentStack: String((info && info.componentStack) || ''),
      at: Date.now(),
    })
    console.error('Uncaught render error:', error)
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div
        role="alert"
        data-nova-runtime-error="1"
        style={{
          padding: '2rem',
          margin: '1rem',
          border: '1px solid rgba(127,29,29,0.35)',
          borderRadius: '0.5rem',
          background: 'rgba(254,242,242,0.9)',
          color: '#7f1d1d',
          font: '14px/1.5 ui-sans-serif, system-ui, sans-serif',
        }}
      >
        <strong>This section could not be displayed.</strong>
        <div style={{ marginTop: '0.5rem' }}>{String(this.state.error.message)}</div>
        {/* A RESET NOBODY CAN REACH IS NOT A RESET. The boundary wraps the
            whole app, so when it catches, the nav that would take the user
            somewhere else is gone with it. This is the way back. */}
        <button
          type="button"
          data-nova-runtime-error-back="1"
          onClick={() => { try { window.history.back() } catch {} }}
          style={{
            marginTop: '1rem',
            padding: '0.4rem 0.9rem',
            border: '1px solid rgba(127,29,29,0.35)',
            borderRadius: '0.375rem',
            background: 'transparent',
            color: 'inherit',
            font: 'inherit',
            cursor: 'pointer',
          }}
        >
          Go back
        </button>
      </div>
    )
  }
}
