import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import { parseSync } from '@swc/core'

// base: './' emits RELATIVE asset paths (./assets/index-x.js) rather
// than absolute ones (/assets/index-x.js). A published site is served
// from several different roots — a customer subdomain, the frozen
// /api/live-html/<id> snapshot, the preview endpoint — and an absolute
// path ignores the injected <base href>, resolving against the host
// root and 404ing everywhere except one of them. Relative paths honour
// the base tag and load correctly in all of them.

// WHERE EACH ELEMENT CAME FROM.
//
// A compiled React page has no HTML file to point at, so the visual
// editing tools had nothing to target: clicking a heading gave a CSS
// selector like `h1.text-3xl.font-bold`, which matches every heading
// on the page and exists nowhere in the source. This stamps each
// element with the file, line and column it was written at, so the
// editor can identify ONE element exactly — the same approach Lovable
// uses for its visual edits.
//
// REAL DOM ELEMENTS ONLY (div, h1, button). A component's props belong
// to that component, and adding an unexpected one can break it -- and a
// lowercase tag is not proof of a DOM element. See NOVA_DOM_TAGS below.
//
// It ships in production too, on purpose: the attribute is inert, and
// the style overrides keyed on it have to apply to the published site
// as well as the preview.
//
// ── WHY THIS IS A VITE PLUGIN AND NOT A BABEL PLUGIN (M4.2) ──────────
//
// It used to be a Babel plugin, passed as `react({ babel: { plugins } })`.
// `@vitejs/plugin-react-swc` HAS NO `babel` OPTION AT ALL — its own
// `plugins` field takes SWC *wasm* plugins ([name, config] pairs), not
// JS functions — so carrying the old form across the SWC swap would
// have type-errored at best and silently dropped every `data-nova-src`
// at worst. That attribute is not cosmetic: web/lib/cssOverrides.ts and
// web/components/PreviewPane.tsx key every visual edit on it, so losing
// it breaks visual editing with no error anywhere.
//
// So the stamp moved OUT of the transform and INTO its own `pre` plugin
// that rewrites the source before SWC ever sees it. This is what
// Lovable does too (`lovable-tagger` is a standalone Vite plugin, not a
// Babel plugin). It parses with @swc/core rather than pattern-matching
// so that `<div>` inside a string or a comment is not stamped.
//
// SPANS ARE GLOBAL, BYTE-BASED, AND DO NOT START AT BYTE 0. Three separate
// coordinate problems, and each one produced a BROKEN BUILD rather than a
// missing stamp, because a misplaced insertion lands in the middle of a tag:
//
//     <Badge className="...">beta</ data-nova-src="src/App.tsx:58:103"Badge>
//     Expected ">" but found "="
//
//   1. @swc/core numbers spans against a process-wide source map that advances
//      with every parse, so an offset is only meaningful relative to this
//      parse's own origin. That much the first version got right.
//   2. But `mod.span.start` is NOT that origin. It is the first TOKEN, so a
//      file opening with a licence header, a blank line or any comment had
//      every stamp shifted left by exactly the length of that leading trivia.
//      A leading comment is the single most ordinary thing in generated code.
//   3. And the numbers are UTF-8 BYTES, while a JavaScript string is indexed
//      in UTF-16 code units. One em dash or emoji anywhere earlier in the file
//      shifted every stamp after it. Comments in generated apps are full of
//      both.
//
// So: `novaFirstToken` measures the trivia the parser skipped, `novaByteLen`
// converts it to bytes to recover the true origin, and `novaByteToChar` maps a
// byte offset back to a string index. All three are pure functions of the
// source, and the loop below VERIFIES the result against the source it is
// about to edit -- an element whose computed position is not a `<` is skipped
// rather than guessed at. A missing stamp costs one element its visual
// editing; a wrong one costs the whole build.

// The index of the first real token. Only whitespace and comments can precede
// it, so this is a complete scanner, not a heuristic.
const novaFirstToken = (code: string): number => {
  let i = code.charCodeAt(0) === 0xfeff ? 1 : 0
  for (;;) {
    while (i < code.length && /\s/.test(code[i])) i++
    if (code.startsWith('//', i)) {
      const nl = code.indexOf('\n', i)
      if (nl < 0) return code.length
      i = nl + 1
      continue
    }
    if (code.startsWith('/*', i)) {
      const end = code.indexOf('*/', i + 2)
      if (end < 0) return code.length
      i = end + 2
      continue
    }
    return i
  }
}

// UTF-8 length of code.slice(0, end).
const novaByteLen = (code: string, end: number): number => {
  let bytes = 0
  for (let i = 0; i < end;) {
    const cp = code.codePointAt(i) as number
    bytes += cp < 0x80 ? 1 : cp < 0x800 ? 2 : cp < 0x10000 ? 3 : 4
    i += cp > 0xffff ? 2 : 1
  }
  return bytes
}

// A byte offset in this file -> the string index that starts there, or -1 when
// the byte falls INSIDE a character and no string index exists for it.
const novaByteToChar = (code: string) => {
  let ascii = true
  for (let i = 0; i < code.length; i++) if (code.charCodeAt(i) > 127) { ascii = false; break }
  // An ASCII file is 1:1, which is every file that never hit this bug.
  if (ascii) return (b: number) => (b >= 0 && b <= code.length ? b : -1)
  const map = new Map<number, number>()
  let bytes = 0
  for (let i = 0; i < code.length;) {
    map.set(bytes, i)
    const cp = code.codePointAt(i) as number
    bytes += cp < 0x80 ? 1 : cp < 0x800 ? 2 : cp < 0x10000 ? 3 : 4
    i += cp > 0xffff ? 2 : 1
  }
  map.set(bytes, code.length)
  return (b: number) => (map.has(b) ? (map.get(b) as number) : -1)
}

// ── LOWERCASE IS NOT THE SAME QUESTION AS 'IS THIS A DOM ELEMENT?' ──
//
// JSX calls every lowercase tag an INTRINSIC, and React DOM happens to
// map those onto HTML and SVG. A renderer with its own reconciler does
// not: React Three Fiber turns `<mesh>`, `<meshStandardMaterial>`,
// `<ambientLight>` and `<torusKnotGeometry>` into three.js objects, and
// it reads a DASHED prop as a PIERCED PROPERTY PATH -- `rotation-x`
// means `obj.rotation.x`. So a stamp on an R3F element becomes
//
//     data-nova-src  ->  obj.data.nova.src
//     TypeError: Cannot read properties of undefined (reading 'nova')
//
// which the error boundary catches into a DEAD PAGE -- measured in the
// real opaque-origin preview frame, on the first 3D component a build
// would ever write. The lowercase test cannot see this, because the
// difference is the RENDERER, not the spelling.
//
// So the tag has to be on a list of elements the DOM actually has, and
// the list is frozen and explicit rather than derived: it is the same
// set web/lib/cssOverrides.ts can build a selector for, it protects the
// next lowercase-intrinsic library as well as this one, and a name
// nobody thought about is left ALONE rather than stamped on a guess --
// which is this plugin's standing rule (a missing stamp costs one
// element its visual editing; a wrong one costs the whole page).
//
// `line` IS DELIBERATELY ABSENT. SVG has `<line>` and R3F has `<line>`
// (THREE.Line), the tagger cannot tell which renderer a file is for --
// an R3F scene usually lives in its own file with no `<Canvas>` in it --
// and the two outcomes are not symmetric: one SVG line loses visual
// editing, an R3F line loses the page. Resolved toward not crashing.
const NOVA_DOM_TAGS: ReadonlySet<string> = new Set([
  // HTML
  'a','abbr','address','area','article','aside','audio','b','base','bdi','bdo',
  'blockquote','body','br','button','canvas','caption','cite','code','col',
  'colgroup','data','datalist','dd','del','details','dfn','dialog','div','dl',
  'dt','em','embed','fieldset','figcaption','figure','footer','form','h1','h2',
  'h3','h4','h5','h6','head','header','hgroup','hr','html','i','iframe','img',
  'input','ins','kbd','label','legend','li','link','main','map','mark','menu',
  'meta','meter','nav','noscript','object','ol','optgroup','option','output','p',
  'param','picture','pre','progress','q','rp','rt','ruby','s','samp','script',
  'search','section','select','slot','small','source','span','strong','style',
  'sub','summary','sup','table','tbody','td','template','textarea','tfoot','th',
  'thead','time','title','tr','track','u','ul','var','video','wbr',
  // SVG (camelCase names are DOM elements too -- linearGradient, clipPath)
  'svg','animate','animateMotion','animateTransform','circle','clipPath','defs',
  'desc','ellipse','feBlend','feColorMatrix','feComponentTransfer','feComposite',
  'feConvolveMatrix','feDiffuseLighting','feDisplacementMap','feDistantLight',
  'feDropShadow','feFlood','feFuncA','feFuncB','feFuncG','feFuncR',
  'feGaussianBlur','feImage','feMerge','feMergeNode','feMorphology','feOffset',
  'fePointLight','feSpecularLighting','feSpotLight','feTile','feTurbulence',
  'filter','foreignObject','g','image','linearGradient','marker','mask',
  'metadata','mpath','path','pattern','polygon','polyline','radialGradient',
  'rect','set','stop','switch','symbol','text','textPath','tspan','use','view',
])

const novaOrigin = () => ({
  name: 'nova-origin',
  enforce: 'pre' as const,
  transform(code: string, id: string) {
    const file = id.split('?')[0]
    if (!/\.[jt]sx$/.test(file) || file.includes('/node_modules/')) return null
    const rel = file.split('/src/').pop()
    if (!rel) return null
    let mod: any
    try {
      mod = parseSync(code, { syntax: 'typescript', tsx: true })
    } catch {
      return null // let SWC report the syntax error; never fail the build here
    }
    // The origin of THIS parse, in the same byte space the spans use.
    const base = mod.span.start - novaByteLen(code, novaFirstToken(code))
    const toChar = novaByteToChar(code)
    const opens: any[] = []
    const walk = (n: any) => {
      if (!n || typeof n !== 'object') return
      if (Array.isArray(n)) { n.forEach(walk); return }
      if (n.type === 'JSXOpeningElement') opens.push(n)
      for (const k in n) if (k !== 'span') walk(n[k])
    }
    walk(mod)
    if (!opens.length) return null
    // Lines and columns are counted in CHARACTERS, which is what an editor
    // shows and what the ASCII files already recorded.
    const lineStarts = [0]
    for (let i = 0; i < code.length; i++) if (code[i] === '\n') lineStarts.push(i + 1)
    const pos = (off: number): [number, number] => {
      let lo = 0, hi = lineStarts.length - 1
      while (lo < hi) { const m = (lo + hi + 1) >> 1; if (lineStarts[m] <= off) lo = m; else hi = m - 1 }
      return [lo + 1, off - lineStarts[lo]]
    }
    const edits: [number, string][] = []
    for (const el of opens) {
      if (el.name?.type !== 'Identifier') continue
      if (!/^[a-z]/.test(el.name.value)) continue
      // The cheap test first, then the real one. See NOVA_DOM_TAGS.
      if (!NOVA_DOM_TAGS.has(el.name.value)) continue
      if (el.attributes?.some(
        (a: any) => a.type === 'JSXAttribute' && a.name?.value === 'data-nova-src'
      )) continue
      const start = toChar(el.span.start - base)
      const nameStart = toChar(el.name.span.start - base)
      const nameEnd = toChar(el.name.span.end - base)
      // NEVER GUESS. Any disagreement between the computed position and the
      // source means this element does not get stamped; the build still ships.
      if (start < 0 || nameStart < 0 || nameEnd < 0) continue
      if (code[start] !== '<') continue
      if (code.slice(nameStart, nameEnd) !== el.name.value) continue
      const [line, col] = pos(start)
      edits.push([nameEnd, ` data-nova-src="src/${rel}:${line}:${col}"`])
    }
    if (!edits.length) return null
    edits.sort((a, b) => b[0] - a[0]) // back-to-front: earlier offsets stay valid
    let out = code
    for (const [at, text] of edits) out = out.slice(0, at) + text + out.slice(at)
    return { code: out, map: null }
  },
})

export default defineConfig({
  base: './',
  plugins: [novaOrigin(), react()],
  server: { host: '0.0.0.0', port: 5173 },
})
