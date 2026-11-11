import { useEffect, useState } from 'react'
import '../kosh.css'
import type { ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Archive, FileText, Menu, Settings2, ShieldCheck, X } from 'lucide-react'
import VaultMark from './VaultMark'
import GlobalArchiveSearch from './GlobalArchiveSearch'

interface AppShellProps {
  children: ReactNode
}

const businessName = 'Kosh offline PWA meeting warehouse and PDF power tool'

const navigation = [
  { label: 'Warehouse', to: '/', icon: Archive },
  { label: 'PDF tools', to: '/pdf-tools', icon: FileText },
  { label: 'Settings & backup', to: '/settings', icon: Settings2 },
]

export default function AppShell({ children }: AppShellProps) {
  const location = useLocation()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  useEffect(() => {
    setMobileMenuOpen(false)
  }, [location.pathname])

  useEffect(() => {
    document.title = businessName
  }, [])

  const isActive = (to: string) =>
    to === '/' ? location.pathname === '/' : location.pathname.startsWith(to)

  const renderNavigation = (mobile = false) => (
    <nav
      aria-label={mobile ? 'Mobile navigation' : 'Main navigation'}
      className={mobile ? 'kosh-nav kosh-mobile-nav' : 'kosh-nav'}
      id={mobile ? 'kosh-mobile-navigation' : undefined}
      hidden={mobile ? !mobileMenuOpen : undefined}
    >
      {navigation.map(({ label, to, icon: Icon }) => (
        <Link
          aria-current={isActive(to) ? 'page' : undefined}
          className={`kosh-nav-link${isActive(to) ? ' is-active' : ''}`}
          key={to}
          onClick={mobile ? () => setMobileMenuOpen(false) : undefined}
          to={to}
        >
          <Icon aria-hidden="true" size={17} strokeWidth={1.8} />
          <span>{label}</span>
        </Link>
      ))}
    </nav>
  )

  return (
    <div className="kosh-app">
      <div className="kosh-shell">
        <aside aria-label="Kosh sidebar" className="kosh-rail">
          <Link aria-label={`${businessName} — Warehouse`} className="kosh-brand" to="/">
            <span className="kosh-brand-mark">
              <VaultMark aria-hidden="true" height={25} width={25} />
            </span>
            <span className="kosh-brand-name">
              Kosh
              <span className="kosh-brand-caption">Private local archive</span>
            </span>
          </Link>

          {renderNavigation()}
          <div className="mt-6"><GlobalArchiveSearch /></div>

          <div className="kosh-rail-bottom">
            <div className="kosh-privacy-note">
              <div className="mb-2 flex items-center gap-2 font-medium text-foreground">
                <ShieldCheck aria-hidden="true" className="text-brand" size={16} />
                Stored on this device
              </div>
              Your meeting records, audio, and documents stay in your local archive.
            </div>
          </div>
        </aside>

        <div className="min-w-0">
          <header className="kosh-mobile-header">
            <Link aria-label={`${businessName} — Warehouse`} className="kosh-brand" to="/">
              <span className="kosh-brand-mark">
                <VaultMark aria-hidden="true" height={25} width={25} />
              </span>
              <span className="kosh-brand-name">
                Kosh
                <span className="kosh-brand-caption">Private local archive</span>
              </span>
            </Link>
            <button
              aria-controls="kosh-mobile-navigation"
              aria-expanded={mobileMenuOpen}
              aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
              className="kosh-button"
              onClick={() => setMobileMenuOpen((open) => !open)}
              type="button"
            >
              {mobileMenuOpen ? (
                <X aria-hidden="true" size={19} />
              ) : (
                <Menu aria-hidden="true" size={19} />
              )}
            </button>
            {renderNavigation(true)}
            <div className="kosh-mobile-search"><GlobalArchiveSearch /></div>
          </header>

          <main className="kosh-main">
            <div className="kosh-content">{children}</div>

            <footer className="kosh-footer">
              <div className="grid w-full gap-8 border-t border-border pt-7 sm:grid-cols-2 lg:grid-cols-3">
                <div>
                  <Link aria-label={`${businessName} — Warehouse`} className="kosh-brand" to="/">
                    <span className="kosh-brand-mark">
                      <VaultMark aria-hidden="true" height={25} width={25} />
                    </span>
                    <span className="kosh-brand-name">
                      Kosh
                      <span className="kosh-brand-caption">A quiet place for records</span>
                    </span>
                  </Link>
                  <p className="mt-4 max-w-xs text-sm leading-6 text-muted-foreground">
                    Keep conversations and working documents close at hand, in an archive that
                    lives on your device.
                  </p>
                </div>

                <div>
                  <h2 className="text-sm font-semibold tracking-tight text-foreground">Your archive</h2>
                  <div className="mt-3 grid gap-2 text-sm">
                    {navigation.map(({ label, to }) => (
                      <Link className="text-muted-foreground transition-colors hover:text-foreground" key={to} to={to}>
                        {label}
                      </Link>
                    ))}
                  </div>
                </div>

                <div>
                  <h2 className="text-sm font-semibold tracking-tight text-foreground">
                    Private by design
                  </h2>
                  <p className="mt-3 max-w-xs text-sm leading-6 text-muted-foreground">
                    Audio, notes, and PDFs are handled in your browser and saved in local device
                    storage.
                  </p>
                </div>
              </div>
              <div className="flex w-full flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
                <span>{businessName}</span>
                <span>© {new Date().getFullYear()} Kosh</span>
              </div>
            </footer>
          </main>
        </div>
      </div>
    </div>
  )
}