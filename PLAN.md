# Quiet Local Archive — Project Plan

## Objective
Keep meetings, notes, and PDFs on your device. — Record or add audio for local transcription, search your archive, and work with PDFs without sending your files to a server.

## Design Aesthetic
**Theme:** Quiet Local Archive
**Reasoning:** A private archive for spoken records and working documents: calm, local-first, and structured around the details people need to find again. The specified warm-neutral light and dark palettes and Inter typography remain unchanged; the archive character comes through in restrained timecode labels, vault geometry, and unhurried spacing rather than decorative imagery.

## Color Palette
- Background: #FFFFFF
- Primary: #191919
- Accent: #586C5C
- Text: #252522
- Surface: #F7F7F5

## Typography
- Heading: Inter, ui-sans-serif, system-ui, sans-serif
- Body: Inter, ui-sans-serif, system-ui, sans-serif

## Design Direction
Decided once for this build. Every file carries the SAME answers below; none of them is re-decided per file.
- **Signature element:** The archive index: small, tab-like timecode labels identify transcript passages and meeting previews, while the geometric vault mark repeats in the app header and warehouse tools. Use the index as a navigation cue, not as a decorative stripe on every card.
- **Type intent:** Inter throughout, with personality coming from hierarchy rather than a second typeface: headings use 600 weight and tight tracking, body copy uses 400 weight with generous line height, and metadata uses 500 weight with tabular numerals and modest letter spacing. Use a 12/14/16/20/28/36px scale; keep
- **Density:** Airy: a concise warehouse header and search/filter controls precede a responsive record grid; detail and PDF workspaces prioritize the active document with secondary controls revealed on hover or focu
- **Layout posture:** A responsive, left-aligned app shell with a quiet navigation rail at wide widths, a compact mobile menu, and a centered content area capped at 72rem. Warehouse records use a flexible grid; meeting detail and PDF editing use a primary work area with a narrow supporting column that stacks below the co
- **Motion budget:** Level 2 — component animation. Subtle state transitions clarify the workflow without turning a quiet local archive into a showcase: animate menu and dialog state, record-state feedback, and the warehouse grid when filters change; pointer feedback is limited to controls and record surfaces. No autoplay, scroll-linked movement, animated body copy, or concealed first-frame content. With prefers-reduced-motion, render state changes immediately and preserve all hover and focus cues.
- **Do not default into:** Avoid the tech attractor: near-black-only screens, a neon accent, glassy cards, and decorative monospace flourishes. Keep both requested themes, use the specified warm-neutral surfaces, and let archive-specific timecodes and vault geometry carry the identity.

## Kit Components
Already installed and compiled. In the named section, import each from the path shown (relative to the importing file) and render it as its usage line shows, with this site's copy and images in its props and children, and colour it as its Colours line says. Do NOT rewrite, copy or re-implement these files, and never list them in the build order. Keep real headings and text in the DOM.
- `aurora.aceternity-aurora-background` -> section **Meeting warehouse** in `src/pages/WarehousePage.tsx`: `import { AuroraBackground } from` `src/registry/kit/aceternity-aurora-background/components/ui/aurora-background.tsx`
  - Use: `<AuroraBackground>Your content here</AuroraBackground>`
  - Colours: Its colours already follow this site's palette: pass no hex or rgb colour props; to tint one, pass a theme class (`bg-primary`, `text-foreground`...) in className.
  - Props: showRadialGradient?: boolean = true
  - It paints its own background (the site's muted) over the section: write the text inside it in colours that read on muted, or pass className="bg-transparent" to keep the section's colour.
  - Why: Soft, airy light suits the calm warehouse without adding a technical grid.
- `text.magicui-kinetic-text` -> section **Meeting warehouse** in `src/pages/WarehousePage.tsx`: `import { KineticText } from` `src/registry/kit/magicui-kinetic-text/registry/magicui/kinetic-text.tsx`
  - Use: `<KineticText text="Nostalgia" className="text-[6rem] tracking-[-5%] [font-optical-sizing:auto]" />`
  - Colours: Its colours already follow this site's palette: pass no hex or rgb colour props; to tint one, pass a theme class (`bg-primary`, `text-foreground`...) in className.
  - Props: text?
  - Why: Subtle editorial interaction preserves a restrained, readable archive headline.
- `uncategorized.motionprimitives-in-view` -> section **PDF tools** in `src/pages/PdfToolsPage.tsx`: `import { InView } from` `src/registry/kit/motionprimitives-in-view/in-view.tsx`
  - Use: `<InView>{/* your content */}</InView>`
  - Colours: Its colours already follow this site's palette: pass no hex or rgb colour props; to tint one, pass a theme class (`bg-primary`, `text-foreground`...) in className.
  - Props: variants?: { = defaultVariants; hidden: Variant; visible: Variant; transition?: Transition; viewOptions?: UseInViewOptions; as?: React.ElementType = 'div'; once?: boolean
  - Why: Restrained editorial entrance motion suits PDF tools and the low motion level.

## File Structure
**Pages:**
- src/pages/WarehousePage.tsx
- src/pages/MeetingPage.tsx
- src/pages/PdfToolsPage.tsx
- src/pages/SettingsPage.tsx

**Shared Components:**
- src/components/AppShell.tsx
- src/components/VaultMark.tsx
- src/components/AudioIntake.tsx
- src/components/MeetingRecord.tsx
- src/components/PdfWorkspace.tsx
- src/components/BackupPanel.tsx

**Build Order:**
1. src/lib/types.ts
2. src/lib/kosh-db.ts
3. src/lib/search-index.ts
4. src/lib/transcription.ts
5. src/lib/pdf-utils.ts
6. src/lib/backup.ts
7. src/workers/search.worker.ts
8. src/workers/transcription.worker.ts
9. src/service-worker.ts
10. src/kosh.css
11. src/components/VaultMark.tsx
12. src/components/AppShell.tsx
13. src/components/AudioIntake.tsx
14. src/components/MeetingRecord.tsx
15. src/components/PdfWorkspace.tsx
16. src/components/BackupPanel.tsx
17. src/pages/WarehousePage.tsx
18. src/pages/MeetingPage.tsx
19. src/pages/PdfToolsPage.tsx
20. src/pages/SettingsPage.tsx
21. src/App.tsx

## Routes
Every `<Link to>` and internal `<a href>` in this build must match one of these paths, and every path below must be declared as a `<Route>`.
- `/` → src/pages/WarehousePage.tsx
- `/meetings/:id` → src/pages/MeetingPage.tsx
- `/pdf-tools` → src/pages/PdfToolsPage.tsx
- `/settings` → src/pages/SettingsPage.tsx

## Navigation
- Warehouse → `/`
- PDF tools → `/pdf-tools`
- Settings & backup → `/settings`

## Data Model
Collections in the EXISTING `db`. Never build a data layer; `src/lib/nova.ts` already provides one.
- `meetings` (mine) — id, editable headline, date, duration, preview snippet, summary, action items, notes, tags, timestamped speaker-attributed transcript, audio reference · written by Local user
- `PDFs` (mine) — id, title, searchable PDF text, page count, date, tags, PDF file reference, page order, rotation, redaction and signature edits · written by Local user
- `tags` (mine) — id, label, muted pastel color · written by Local user
- `settings` (mine) — theme, local storage usage preferences · written by Local user
- `audio files` (mine) — id, meeting reference, audio data, MIME type, duration · written by Local user

## Screen States
Every screen below must render these three distinctly. A failed request never fails silently.
- `src/pages/WarehousePage.tsx` — loading: Show the warehouse heading and search controls with a restrained record-row skeleton while IndexedDB and the local search index load. · empty: Show an empty archive state with working Record audio and Add audio actions, plus concise guidance that records remain on this device. · error: Show an inline message that the local archive could not be read, with a retry action; do not silently replace local records with sample data.
- `src/pages/MeetingPage.tsx` — loading: Show the selected meeting's document layout skeleton while its record, transcript, and audio reference load from local storage. · empty: If the record no longer exists, show a clear unavailable state and a real link back to the warehouse. · error: Explain that the meeting could not be opened from local storage and provide retry and warehouse navigation actions.
- `src/pages/PdfToolsPage.tsx` — loading: Show the selected document's page workspace loading state while local PDF data is read and rendered. · empty: Show a focused drop-or-select-PDF workspace with a clear note that files are processed on this device. · error: Identify whether the PDF could not be read or an edit could not be applied; preserve the source document and offer retry or reselect.
- `src/pages/SettingsPage.tsx` — loading: Show storage and backup status loading indicators while local records and file sizes are inspected. · empty: Explain that no local records are available to include in a backup; keep export available only when it can produce a valid backup. · error: Show an actionable local storage or backup error and allow retry without clearing existing data.

## Section Breakdown
- Meeting warehouse -> `src/pages/WarehousePage.tsx`
- Meeting detail -> `src/pages/MeetingPage.tsx`
- PDF tools -> `src/pages/PdfToolsPage.tsx`
- Settings & backup -> `src/pages/SettingsPage.tsx`

## Functional Requirements
- A user can record audio or drop an .mp3, .wav, or .m4a file, see transcription progress, and access the resulting speaker-attributed meeting record.
- Meeting and PDF records persist in the device-local IndexedDB archive and remain available when the PWA is reopened offline.
- A user can search meeting titles, transcripts, notes, and extracted PDF text, then filter by All, Meetings, PDFs, Tags, or Date Range and sort by Newest, Oldest, Longest, or Alphabetical.
- A user can open a meeting, edit its headline, tags, summary, and notes, and play its associated audio from the detail screen.
- A user can merge, split, reorder, rotate, delete, redact, and sign PDF pages locally, then save a searchable PDF record to the warehouse.
- A user can inspect local storage usage and export or import a JSON or ZIP backup without creating an account or sending local records to a backend.
- The app presents the specified light and dark palettes, works at mobile and desktop widths, and honors reduced-motion preferences.

## Animation Mandate
- **Meeting warehouse:** The page title, app header, footer, and copyright line use the exact name “Kosh offline PWA meeting warehouse and PDF power tool.” Lead with the archive search field, then All / Meetings / PDFs / Tags / Date Range filters and Newest / Oldest / Longest / Alphabetical sorting. Record or drop supported audio (.mp3, .wav, .m4a) into a visible drop zone; show transcription progress, first-use model download progress, and a clear local processing state. Meeting and PDF records use two-line previews, real date and duration/page metadata, and editable headlines and pastel tags. Keep the warehouse card grid calm and responsive. The toolbar and warehouse identity use the same clean geometric vault/archive mark as inline SVG; do not create extension surfaces. KIT: `aurora.aceternity-aurora-background` is this section's hero background. It replaces any hero background this note describes; build everything else in the note around it. KIT: `text.magicui-kinetic-text` is this section's hero headline effect. It replaces any hero headline effect this note describes; build everything else in the note around it.
- **Meeting detail:** Open a distraction-free Notion-style record with an editable headline, customizable tags, a Summary & Action Items block, an embedded local audio player, scratch notes, and timestamped speaker-attributed transcript segments. Timecode index labels are the repeated archive signature. Persist edits in the local database and reflect each save immediately; provide an explicit parent link to the warehouse.
- **PDF tools:** Provide local file selection and drop, then usable controls for merge, split, reorder, rotate, delete pages, redact selected areas, and draw or type signatures. Use pdf-lib for edits and pdfjs-dist for page rendering and text extraction. Keep controls named and keyboard accessible; confirm destructive page removal. Save to Warehouse creates a searchable PDF record locally and reports success or a recoverable error. KIT: `uncategorized.motionprimitives-in-view` is this section's section. It replaces any section this note describes; build everything else in the note around it.
- **Settings & backup:** Offer a theme control, a storage-usage dialog based on measured local data, and working JSON or ZIP export/import for moving a backup between PWA instances. Validate an imported backup before writing it; report progress, success, invalid-file errors, and storage failures. The footer and copyright line display the exact business name: “Kosh offline PWA meeting warehouse and PDF power tool.”
- **App shell and navigation:** Use a compact responsive navigation for Warehouse, PDF tools, and Settings & backup; active route state is visible and the mobile menu closes after navigation. Set the document title and branded header to “Kosh offline PWA meeting warehouse and PDF power tool.” The PWA operates without accounts, admin screens, payment features, Chrome extension pages, backend services, or external API calls.

## Call To Action
Record or drop audio

## Domain Tag: productivity