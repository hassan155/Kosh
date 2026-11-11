import { Link } from 'react-router-dom'
import {
  ArrowDownToLine,
  ArrowUpRight,
  FileSearch,
  FileText,
  LockKeyhole,
  Move,
  RotateCw,
  ShieldCheck,
} from 'lucide-react'
import PdfWorkspace from '../components/PdfWorkspace'
import VaultMark from '../components/VaultMark'
import { InView } from '../registry/kit/motionprimitives-in-view/in-view'

const workflow = [
  {
    number: '01',
    title: 'Choose a document',
    description:
      'Select a PDF or drop it into the workspace. Kosh checks its page structure and looks for text it can index.',
    icon: FileText,
  },
  {
    number: '02',
    title: 'Review the record',
    description:
      'Give it a useful warehouse title, check the extracted text, and arrange the pages in the order you want to keep.',
    icon: Move,
  },
  {
    number: '03',
    title: 'Save it locally',
    description:
      'Save the document record to this browser’s archive so its title and searchable text are ready to find again.',
    icon: ArrowDownToLine,
  },
]

export default function PdfToolsPage() {
  return (
    <section className="relative overflow-clip" aria-labelledby="pdf-tools-title">
      <div className="pointer-events-none absolute right-0 top-0 -z-0 hidden h-72 w-72 rounded-full bg-accent/40 blur-3xl md:block" />

      <div className="relative z-10 space-y-12">
        <InView>
          <div className="border-b border-border pb-9">
            <div className="flex flex-wrap items-start justify-between gap-6">
              <div className="max-w-3xl">
                <span className="kosh-eyebrow">
                  <VaultMark aria-hidden="true" className="h-4 w-4" />
                  PDF tools · Device-local workspace
                </span>
                <h1
                  className="mt-4 max-w-3xl text-4xl font-semibold leading-tight tracking-[-0.05em] text-foreground sm:text-5xl"
                  id="pdf-tools-title"
                >
                  Bring working documents into your archive.
                </h1>
                <p className="mt-4 max-w-2xl text-base leading-7 text-muted-foreground">
                  Inspect a PDF, review its extractable text, arrange its pages, and save a
                  searchable record in your browser. Your selected document stays on this device.
                </p>
                <div className="mt-6 flex flex-wrap gap-3">
                  <a className="kosh-button kosh-button-primary" href="#pdf-workspace">
                    Open PDF workspace
                    <ArrowDownToLine aria-hidden="true" size={16} />
                  </a>
                  <Link className="kosh-button" to="/">
                    Return to warehouse
                    <ArrowUpRight aria-hidden="true" size={16} />
                  </Link>
                </div>
              </div>

              <div
                aria-hidden="true"
                className="grid h-20 w-20 shrink-0 place-items-center rounded-2xl border border-border bg-surface text-brand sm:h-24 sm:w-24"
              >
                <VaultMark className="h-12 w-12 sm:h-14 sm:w-14" />
              </div>
            </div>
          </div>
        </InView>

        <div className="scroll-mt-6" id="pdf-workspace">
          <PdfWorkspace />
        </div>

        <section aria-labelledby="pdf-process-title">
          <div className="mb-5 max-w-2xl">
            <span className="kosh-eyebrow">A considered document workflow</span>
            <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-foreground">
              From a file to a record you can find.
            </h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Keep the original document close while you capture the details that make it useful
              later.
            </p>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            {workflow.map(({ number, title, description, icon: Icon }) => (
              <article
                className="rounded-xl border border-border bg-background p-5 shadow-sm transition-[border-color,box-shadow,transform] duration-150 hover:-translate-y-0.5 hover:border-brand/30 hover:shadow-md"
                key={number}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="kosh-timecode">STEP {number}</span>
                  <Icon aria-hidden="true" className="text-brand" size={18} />
                </div>
                <h3 className="mt-5 text-base font-semibold tracking-tight text-foreground">
                  {title}
                </h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
              </article>
            ))}
          </div>
        </section>

        <section
          aria-labelledby="pdf-capabilities-title"
          className="grid gap-5 rounded-2xl border border-border bg-surface p-5 sm:p-7 lg:grid-cols-[minmax(0,1fr)_minmax(260px,0.7fr)] lg:items-start"
        >
          <div>
            <span className="kosh-eyebrow">
              <FileSearch aria-hidden="true" size={14} />
              Know what is preserved
            </span>
            <h2
              className="mt-2 text-xl font-semibold tracking-[-0.035em] text-foreground"
              id="pdf-capabilities-title"
            >
              A clear boundary between notes and edits.
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
              This workspace reads the selected PDF, saves its original file with a warehouse
              record, and stores page order and rotation notes. Those notes do not change the PDF
              itself.
            </p>
          </div>

          <div className="space-y-4 rounded-xl border border-border bg-background p-5">
            <div className="flex items-start gap-3">
              <ShieldCheck aria-hidden="true" className="mt-0.5 shrink-0 text-brand" size={18} />
              <div>
                <h3 className="text-sm font-semibold text-foreground">Processed in this browser</h3>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  The selected file is not uploaded to a service.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3 border-t border-border pt-4">
              <LockKeyhole aria-hidden="true" className="mt-0.5 shrink-0 text-brand" size={18} />
              <div>
                <h3 className="text-sm font-semibold text-foreground">Original bytes are preserved</h3>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  Merge, split, permanent rotation, redaction, and signature writing are not
                  applied by this workspace.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3 border-t border-border pt-4">
              <RotateCw aria-hidden="true" className="mt-0.5 shrink-0 text-brand" size={18} />
              <div>
                <h3 className="text-sm font-semibold text-foreground">Page notes stay with the record</h3>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  The saved record can keep its page arrangement and rotation notes alongside
                  searchable text.
                </p>
              </div>
            </div>
          </div>
        </section>
      </div>
    </section>
  )
}