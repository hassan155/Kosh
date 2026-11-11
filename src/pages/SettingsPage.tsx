import { useEffect, useState } from 'react'
import {
  Check,
  Laptop,
  Moon,
  Settings2,
  ShieldCheck,
  Sun,
} from 'lucide-react'
import BackupPanel from '../components/BackupPanel'
import { koshDB } from '../lib/kosh-db'
import type { KoshSettings, ThemePreference } from '../lib/types'

const themeOptions: {
  value: ThemePreference
  label: string
  description: string
  icon: typeof Sun
}[] = [
  {
    value: 'light',
    label: 'Light',
    description: 'A bright, paper-like archive.',
    icon: Sun,
  },
  {
    value: 'dark',
    label: 'Dark',
    description: 'A softer view for dim surroundings.',
    icon: Moon,
  },
  {
    value: 'system',
    label: 'System',
    description: 'Follow this device’s appearance setting.',
    icon: Laptop,
  },
]

function createId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `kosh-settings-${Date.now()}`
}

function applyTheme(theme: ThemePreference): void {
  const prefersDark =
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-color-scheme: dark)').matches

  document.documentElement.classList.toggle(
    'dark',
    theme === 'dark' || (theme === 'system' && prefersDark),
  )
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<KoshSettings | null>(null)
  const [theme, setTheme] = useState<ThemePreference>('system')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const loadSettings = async () => {
    setLoading(true)
    setError('')
    try {
      const rows = await koshDB.getAll('settings')
      const current = Array.isArray(rows) ? rows[0] ?? null : null
      setSettings(current)
      setTheme(current?.theme ?? 'system')
    } catch (readError) {
      setError(
        readError instanceof Error
          ? readError.message
          : 'Appearance settings could not be read from this device.',
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadSettings()
  }, [])

  useEffect(() => {
    applyTheme(theme)

    if (theme !== 'system' || typeof window.matchMedia !== 'function') return

    const preference = window.matchMedia('(prefers-color-scheme: dark)')
    const updateTheme = () => applyTheme('system')
    preference.addEventListener('change', updateTheme)
    return () => preference.removeEventListener('change', updateTheme)
  }, [theme])

  const saveTheme = async (nextTheme: ThemePreference) => {
    if (saving || loading) return
    setSaving(true)
    setError('')
    setMessage('')

    const now = new Date().toISOString()
    const nextSettings: KoshSettings = {
      id: settings?.id ?? createId(),
      theme: nextTheme,
      preferences: settings?.preferences ?? {
        includeAudioInBackup: true,
        defaultSort: 'newest',
      },
      createdAt: settings?.createdAt ?? now,
      updatedAt: now,
    }

    try {
      await koshDB.put('settings', nextSettings)
      setSettings(nextSettings)
      setTheme(nextTheme)
      setMessage('Appearance preference saved on this device.')
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : 'The appearance preference could not be saved.',
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <section
      aria-labelledby="settings-page-title"
      className="relative space-y-8 overflow-clip"
    >
      <header className="border-b border-border pb-7">
        <span className="kosh-eyebrow">
          <Settings2 aria-hidden="true" size={14} />
          Settings &amp; backup
        </span>
        <h1
          className="mt-3 text-3xl font-semibold leading-tight tracking-[-0.05em] text-foreground sm:text-4xl"
          id="settings-page-title"
        >
          Keep your archive the way you need it.
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
          Choose how Kosh looks, review storage measured by your browser, and
          move your records with a backup file you control.
        </p>
      </header>

      <section aria-labelledby="appearance-heading" className="kosh-panel">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <span className="kosh-eyebrow">
              <Sun aria-hidden="true" size={14} />
              Reading preference
            </span>
            <h2 className="kosh-section-title mt-2" id="appearance-heading">
              Appearance
            </h2>
            <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
              Your choice is saved in this browser. System mode follows the
              device’s light or dark appearance setting.
            </p>
          </div>
          <span className="kosh-timecode">
            {loading ? 'LOADING' : saving ? 'SAVING' : 'ON THIS DEVICE'}
          </span>
        </div>

        <div
          aria-label="Choose appearance"
          className="mt-5 grid gap-3 sm:grid-cols-3"
          role="group"
        >
          {themeOptions.map(({ value, label, description, icon: Icon }) => {
            const selected = theme === value
            return (
              <button
                aria-pressed={selected}
                className={`min-w-0 rounded-xl border p-4 text-left transition-[border-color,background-color,box-shadow,transform] duration-150 hover:-translate-y-0.5 hover:shadow-sm disabled:cursor-wait disabled:opacity-60 ${
                  selected
                    ? 'border-brand bg-accent/40 shadow-sm'
                    : 'border-border bg-background hover:border-brand/40'
                }`}
                disabled={loading || saving}
                key={value}
                onClick={() => void saveTheme(value)}
                type="button"
              >
                <span className="flex items-center justify-between gap-3">
                  <span className="flex min-w-0 items-center gap-2.5">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-border bg-surface text-brand">
                      <Icon aria-hidden="true" size={17} />
                    </span>
                    <span className="text-sm font-semibold text-foreground">
                      {label}
                    </span>
                  </span>
                  {selected && (
                    <Check
                      aria-label="Selected"
                      className="shrink-0 text-brand"
                      size={17}
                    />
                  )}
                </span>
                <span className="mt-3 block text-xs leading-5 text-muted-foreground">
                  {description}
                </span>
              </button>
            )
          })}
        </div>

        {error && (
          <div aria-live="polite" className="kosh-alert mt-4">
            {error}
            <button
              className="ml-3 underline underline-offset-2"
              onClick={() => void loadSettings()}
              type="button"
            >
              Retry
            </button>
          </div>
        )}
        {message && (
          <p aria-live="polite" className="mt-4 text-sm leading-6 text-brand">
            {message}
          </p>
        )}
      </section>

      <section aria-labelledby="backup-section-heading" className="space-y-4">
        <div>
          <span className="kosh-eyebrow">
            <ShieldCheck aria-hidden="true" size={14} />
            Portability &amp; storage
          </span>
          <h2 className="kosh-section-title mt-2" id="backup-section-heading">
            Your archive, on your terms
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Inspect browser storage, export a JSON backup, or import a validated
            Kosh archive file. Import replaces the archive currently on this
            device.
          </p>
        </div>
        <BackupPanel />
      </section>

      <section
        aria-labelledby="local-storage-note"
        className="kosh-panel kosh-panel-muted"
      >
        <div className="flex flex-wrap items-start gap-4">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-border bg-background text-brand">
            <ShieldCheck aria-hidden="true" size={19} />
          </div>
          <div className="min-w-0 flex-1">
            <h2
              className="text-base font-semibold tracking-tight text-foreground"
              id="local-storage-note"
            >
              A file you control is your portable copy
            </h2>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">
              Meetings, notes, tags, audio, and PDFs are kept in this browser’s
              local archive. Export creates a backup file on your device; keep
              it somewhere you trust if you need a copy outside this browser.
            </p>
          </div>
        </div>
      </section>
    </section>
  )
}