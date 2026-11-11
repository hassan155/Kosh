// Engine-owned (Nova): the site's palette, read at runtime by kit components.
//
// The kit's colour-swap step (scripts/registry_sources/kit_theme.py) replaced
// each hard-coded colour a component draws with -- a colour prop's default, a
// canvas fillStyle, a shader's colour -- by a call here naming its ROLE, with
// the original colour as the fallback. src/nova-theme.css (vite_theme.py)
// writes each role as `--nova-<role>: #rrggbb` on :root. A project without that
// sheet gets the fallback, so the component looks exactly as it was ported.

type Rgb = [number, number, number]

const HEX = /^#([0-9a-f]{6})$/i

function read(role: string): string {
  if (typeof document === "undefined") return ""
  try {
    return getComputedStyle(document.documentElement).getPropertyValue(`--nova-${role}`).trim()
  } catch {
    return ""
  }
}

function parse(colour: string): { rgb: Rgb; alpha: number } | null {
  const c = colour.trim()
  let m = /^#([0-9a-f]{3,8})$/i.exec(c)
  if (m) {
    let h = m[1]
    if (h.length === 3 || h.length === 4) h = h.split("").map((x) => x + x).join("")
    const rgb: Rgb = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as Rgb
    return { rgb, alpha: h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1 }
  }
  m = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:[\s,/]+([\d.]+%?))?\s*\)$/i.exec(c)
  if (m) {
    const a = m[4] === undefined ? 1 : m[4].endsWith("%") ? parseFloat(m[4]) / 100 : parseFloat(m[4])
    return { rgb: [+m[1], +m[2], +m[3]], alpha: a }
  }
  return null
}

/** The site's colour for `role`, keeping the alpha of `fallback`. `fallback` when the site has no theme. */
export function novaColor(role: string, fallback: string): string {
  const v = read(role)
  if (!HEX.test(v)) return fallback
  const alpha = parse(fallback)?.alpha ?? 1
  if (alpha >= 1) return v
  const rgb = parse(v)!.rgb
  return `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${alpha})`
}

/** The site's colour for `role` as [r, g, b] in 0-1, for a shader uniform. */
export function novaRgb(role: string, fallback: number[]): Rgb {
  const v = read(role)
  if (!HEX.test(v)) return [fallback[0], fallback[1], fallback[2]]
  const rgb = parse(v)!.rgb
  return [rgb[0] / 255, rgb[1] / 255, rgb[2] / 255]
}
