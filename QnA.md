# Project Brief

## Original Request

Create Kosh, a hybrid Manifest V3 Chrome extension and installable offline Progressive Web App, that runs entirely locally on the user’s device with zero backend servers or external API calls. The experience should feel calm, minimalist and Notion‑style, serving as a live Google Meet transcriber, a searchable meeting warehouse, and a full‑featured client‑side PDF power‑tool.

**Target audience and feel:**  
- Users who need private, offline meeting transcription, note‑taking and PDF manipulation.  
- Interface should be airy, with generous padding, clean Inter typography, warm‑neutral light mode (#FFFFFF canvas, #F7F7F5 secondary panels, #EFEFED borders) and dark mode (#191919 canvas, #202020 panels, #2F2F2F borders), using muted pastel tag pills.  

**Core components:**  
- **Chrome Extension mode:**  
  - Side panel (sidepanel.html) that appears beside active tabs and detects Google Meet pages (`*://*.google.com/*`).  
  - “Listen to This Meeting” button that launches silent audio capture via `chrome.tabCapture` (tab audio) combined with `navigator.mediaDevices.getUserMedia` (mic) using the Web Audio API.  
  - Content script (`content.ts`) with a lightweight DOM observer that extracts the spoken participant’s display name tile and streams it to the side panel in real time, defaulting to “Me” or “Guest” when identification fails.  
  - Live view showing an audio waveform, speaker‑tagged transcript, quick scratchpad, and an “Open Kosh Warehouse ↗” button.  

- **PWA mode:**  
  - Installable standalone app (index.html, `manifest.webmanifest`, Service Worker) with offline caching of all assets, WASM binaries and UI routes.  
  - Warehouse interface includes a “Record / Drop Audio” option; users may record meetings directly or drag‑and‑drop .mp3, .wav, .m4a files for transcription.  

**AI transcription:**  
- Run Whisper model (`Xenova/whisper-tiny.en` or `whisper-base.en`) locally inside a Web Worker using WebGPU/WASM.  
- Show a progress bar the first time the model is downloaded; subsequent transcriptions work fully offline.  

**Local data layer:**  
- Shared IndexedDB database (`Dexie.js` as KoshDB) storing meetings, PDFs, tags, settings and audio files.  
- Full‑text fuzzy search (hero search bar) across meeting titles, transcripts, notes and PDF text, indexed in a background worker.  
- Filter pills (All, Meetings, PDFs, Tags, Date Range) and sort selector (Newest, Oldest, Longest, Alphabetical).  

**Warehouse UI:**  
- Card grid with calm cards: editable headline, two‑line preview snippet, metadata (date, duration/page count), pastel tag pills.  
- Clicking a card opens a distraction‑free page mimicking Notion: editable headline, customizable tags, “Summary & Action Items” block, embedded audio player, timestamped speaker‑attributed transcript.  

**PDF power‑tool:**  
- Client‑side PDF handling with `pdf-lib` and `pdfjs-dist`.  
- Features: merge, split, reorder/rotate/delete pages, redact areas, draw/type signatures.  
- One‑click “Save to Warehouse” creates a searchable PDF card.  

**Settings & portability:**  
- Modal showing local storage usage.  
- One‑click export/import of backup files (`.json` or `.zip`) for moving data between extension and PWA instances.  

**Design details:**  
- Minimalist layout with max‑width 6xl, soft borders, hidden secondary controls that appear on hover.  
- Clean geometric vault/archive SVG icon used for toolbar button, side‑panel header, PWA icons and dashboard logo.  

**Project structure and build:**  
- Vite + React + TypeScript mono‑repo with shared core components.  
- Separate entry points for Chrome extension (manifest.json MV3, sidepanel.html, offscreen.html, content script) and PWA (index.html, Service Worker).  
- Multi‑entry Vite config handling both builds and copying the appropriate manifest files.  

**Deliverables:**  
- Full folder hierarchy description, `package.json` dependencies, `vite.config.ts` setup, `manifest.json` (MV3) and `manifest.webmanifest` (PWA).  
- Production‑ready TypeScript code for all UI components, audio capture, Web Worker transcription, IndexedDB wrapper, PDF utilities, and service worker caching, with no placeholder comments.

Also settled in the conversation:
Build the offline PWA and web warehouse version of Kosh: Notion-style meeting warehouse, local audio recording and drag-and-drop transcription, IndexedDB local data layer, full-text fuzzy search, and client-side PDF power-tool suite.

## Discovery Q&A

**Q1: Before Kosh captures meeting audio, what consent flow should it use?**

A: No in-app consent step

## What You Are Getting

- Site type: Offline, installable PWA and web warehouse for Kosh; the Chrome extension is out of scope.
- Pages: Meeting warehouse, Meeting detail, PDF tools, Settings and backup
- Features: Record or drop audio for local transcription, Search and organize meetings, notes, tags, and PDFs, Edit and manage PDFs locally, Store data on the device and export or import backups, No accounts, payments, or admin area
- Look: Calm, minimalist Notion-style interface with warm-neutral light and dark modes, generous spacing, and muted pastel tags.
- Experience: Visitors can record or add audio, transcribe it locally, search and open meeting records, and use PDF tools. Their data stays on the device.

## What Nova Understood

Read from the request rather than asked -- correct anything that is wrong:

- What it is for: Kosh offline PWA meeting warehouse and PDF power tool
- Who it is for: Users who need private, offline meeting notes, transcription, and client-side PDF manipulation
- Look and feel: Calm, minimalist Notion-style warm-neutral light and dark modes

## Nova Will Decide

- The framework, hosting and database: Nova chooses and runs these
