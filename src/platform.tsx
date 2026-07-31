import React, { useState, useEffect, useLayoutEffect, useMemo, useRef, createContext, useContext } from "react"
import { createPortal } from "react-dom"

/* ════════════════════════════════════════════════════════════════════════
   DS STUDIO — Design System Platform
   Editorial-technical documentation site. Light/dark. Foundations + DESIGN.md.
   Data contracts preserved from the plugin-generated App.tsx registry.
   ════════════════════════════════════════════════════════════════════════ */

// ─── Data model (injected by the plugin via App.tsx) ────────────────────────
type Variant      = { name: string; props: Record<string, unknown> }
type TokenEntry   = { name: string; value: unknown; aliasOf?: string }
type ChangelogEntry = { version: string; date?: string; author?: string; summary?: string; changes?: string[] }
type RegistryEntry = {
  name: string; displayName: string; category: string; version: string
  variants: Variant[]; width?: number; height?: number
  tokens?: TokenEntry[]; source?: string
  publishedAt?: string; changelog?: ChangelogEntry[]
  visualRef?: { cols: number; rows: number; root?: unknown; variants?: Record<string, unknown> }
  Component: React.ComponentType<Record<string, unknown>>
}

// @ts-ignore — replaced by the plugin when it generates App.tsx
const REPO_OWNER: string = (typeof __REPO_OWNER__ !== "undefined") ? __REPO_OWNER__ : "jasonpereirax"
// @ts-ignore
const REPO_NAME:  string = (typeof __REPO_NAME__  !== "undefined") ? __REPO_NAME__  : "ds-studio"
// Instância publicada (site white-label de um projeto): renderiza SÓ o catálogo
// (Storybook do design system) a partir do registry estático — sem hub/login/Console.
// Detecção robusta: qualquer repo que NÃO seja o core `ds-studio` é uma instância.
// (Não depende do App.tsx gerado injetar __DS_INSTANCE__, que pode vir de bundle velho.)
const IS_INSTANCE: boolean = ((typeof __DS_INSTANCE__ !== "undefined") && !!(__DS_INSTANCE__ as any)) || (REPO_NAME !== "ds-studio")

type DocStatus = "idle" | "loading" | "done" | "error"
interface AllDocs { a11y: any; donts: any; useCases: any; interpretation: any }

// ─── Theme ──────────────────────────────────────────────────────────────────
type Theme = "light" | "dark"
const ThemeCtx = createContext<{ theme: Theme; toggle: () => void }>({ theme: "light", toggle: () => {} })
const useTheme = () => useContext(ThemeCtx)

const THEME_CSS = `
/* Bento design language — gray backdrop + floating light panel, white cards,
   near-black ink primary (pill), green highlight accent, soft shadows, Plus Jakarta Sans.
   Light is canonical; dark is a faithful inverse. */
:root {
  --backdrop:#E4E4E1; --canvas:#F2F2F0; --surface:#FFFFFF; --surface-2:#F7F7F5; --surface-3:#EFEFEC;
  --ink:#1A1A1C; --ink-muted:#6E6E70; --ink-subtle:#9B9B9D;
  --hairline:#ECECEA; --hairline-strong:#E2E2DF;
  --accent:#1FA463; --accent-ink:#178551; --accent-soft:#E7F7EE; --on-accent:#FFFFFF;
  --primary:#1A1A1C; --on-primary:#FFFFFF;
  --accent-glow:0 8px 22px -6px rgba(31,164,99,.40);
  --ok:#1FA463; --ok-soft:#E7F7EE; --warn:#B7791F; --warn-soft:#FFF4E5; --err:#E5484D; --err-soft:#FDECEC;
  --shadow-sm:0 1px 2px rgba(20,20,22,.04),0 2px 6px rgba(20,20,22,.04);
  --shadow-md:0 1px 3px rgba(20,20,22,.05),0 10px 30px -12px rgba(20,20,22,.12);
  --shadow-lg:0 1px 3px rgba(20,20,22,.06),0 18px 40px -14px rgba(20,20,22,.16);
  --r-card:22px; --r-inner:16px; --r-ctl:12px;
  --checker:#ECECEA;
}
/* Inverse (dark) */
[data-theme="dark"] {
  --backdrop:#101012; --canvas:#161618; --surface:#1F1F22; --surface-2:#26262A; --surface-3:#2E2E33;
  --ink:#F2F2F0; --ink-muted:#A0A0A2; --ink-subtle:#6E6E70;
  --hairline:#2A2A2E; --hairline-strong:#3A3A3F;
  --accent:#3DD68C; --accent-ink:#5FE3A3; --accent-soft:rgba(31,164,99,.18); --on-accent:#0A0A0B;
  --primary:#F2F2F0; --on-primary:#161618;
  --accent-glow:0 0 0 1px rgba(61,214,140,.3),0 12px 30px -8px rgba(31,164,99,.45);
  --ok:#3DD68C; --ok-soft:rgba(31,164,99,.16); --warn:#E0A042; --warn-soft:rgba(224,160,66,.14); --err:#F8787C; --err-soft:rgba(229,72,77,.16);
  --shadow-sm:0 1px 2px rgba(0,0,0,.5);
  --shadow-md:0 10px 30px -10px rgba(0,0,0,.6);
  --shadow-lg:0 26px 60px -18px rgba(0,0,0,.7);
  --checker:#26262A;
}
* { box-sizing:border-box; }
.dss-root { font-family:var(--font-sans); color:var(--ink); background:var(--canvas); }
.dss-root ::selection { background:var(--accent); color:#fff; }
.dss-display { font-family:var(--font-display); font-optical-sizing:auto; }
.dss-serif { font-family:var(--font-serif); font-style:italic; }
.dss-mono { font-family:var(--font-mono); }
.dss-scroll::-webkit-scrollbar { width:6px; height:6px; }
.dss-scroll::-webkit-scrollbar-thumb { background:var(--hairline-strong); border-radius:3px; }
.dss-scroll::-webkit-scrollbar-track { background:transparent; }
.dss-link { color:var(--accent-ink); text-decoration:none; }
.dss-link:hover { text-decoration:underline; }
@keyframes dss-fade { from { opacity:0; transform:translateY(6px); } to { opacity:1; transform:none; } }
@keyframes dss-spin { to { transform:rotate(360deg); } }
.dss-fade { animation:dss-fade .22s cubic-bezier(.16,1,.3,1) both; }
.dss-navitem { transition:background .12s, color .12s; }
.dss-navitem:hover { background:var(--surface-2); }
.dss-card { transition:transform .18s cubic-bezier(.2,.7,.3,1), box-shadow .18s, border-color .18s; }
.dss-card:hover { transform:translateY(-3px); box-shadow:var(--shadow-lg); }
.dss-btn { transition:background .14s, border-color .14s, color .14s, box-shadow .14s; cursor:pointer; }
.dss-del { opacity:0; transition:opacity .12s; }
.dss-delp:hover .dss-del { opacity:1; }
.dss-cta:hover { box-shadow:var(--accent-glow); }
@keyframes dss-scan { 0% { transform:translateY(-100%); opacity:0; } 12% { opacity:1; } 88% { opacity:1; } 100% { transform:translateY(2400%); opacity:0; } }
.dss-scan { position:absolute; left:0; right:0; height:2px; background:linear-gradient(90deg,transparent,var(--accent),transparent); box-shadow:0 0 12px var(--accent); animation:dss-scan 1.4s cubic-bezier(.4,0,.6,1) infinite; pointer-events:none; }
`

function FontLoader() {
  useEffect(() => {
    const id = "dss-fonts"
    if (document.getElementById(id)) return
    const pre1 = document.createElement("link"); pre1.rel = "preconnect"; pre1.href = "https://fonts.googleapis.com"
    const pre2 = document.createElement("link"); pre2.rel = "preconnect"; pre2.href = "https://fonts.gstatic.com"; pre2.crossOrigin = "anonymous"
    const link = document.createElement("link"); link.id = id; link.rel = "stylesheet"
    link.href = "https://fonts.googleapis.com/css2?family=Roboto:ital,wght@0,400;0,500;0,700;1,400&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap"
    document.head.append(pre1, pre2, link)
    document.documentElement.style.setProperty("--font-display", "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif")
    document.documentElement.style.setProperty("--font-sans", "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif")
    document.documentElement.style.setProperty("--font-serif", "'Plus Jakarta Sans', sans-serif")
    document.documentElement.style.setProperty("--font-mono", "ui-monospace, 'SF Mono', 'JetBrains Mono', Menlo, monospace")
  }, [])
  return null
}

// ─── Utilities ───────────────────────────────────────────────────────────────
function formatTokenValue(v: unknown): string {
  if (v === null || v === undefined) return "—"
  if (typeof v === "number") return v.toString()
  if (typeof v === "string") return v
  if (typeof v === "boolean") return v ? "true" : "false"
  if (typeof v === "object") {
    const o = v as Record<string, unknown>
    if ("r" in o && "g" in o && "b" in o) {
      const r = Math.round(Number(o.r) * 255), g = Math.round(Number(o.g) * 255), b = Math.round(Number(o.b) * 255)
      const a = o.a !== undefined ? Number(o.a) : 1
      if (a < 0.99) return `rgba(${r},${g},${b},${a.toFixed(2)})`
      return "#" + [r, g, b].map(n => n.toString(16).padStart(2, "0")).join("")
    }
    if (o.type === "VARIABLE_ALIAS") return "alias"
    return JSON.stringify(v).substring(0, 40)
  }
  return String(v)
}

const isColorValue = (v: unknown) => {
  const s = formatTokenValue(v)
  return s.startsWith("#") || s.startsWith("rgb")
}
const isAliasValue = (v: unknown) => !!v && typeof v === "object" && (v as any).type === "VARIABLE_ALIAS"
const tokenNum = (t: TokenEntry): number | null => {
  if (isAliasValue(t.value)) return null
  const sv = formatTokenValue(t.value)
  if (!/\d/.test(sv)) return null
  const n = Number(sv.replace(/[^0-9.]/g, ""))
  return isFinite(n) ? n : null
}
const byTokenNum = (a: TokenEntry, b: TokenEntry) => {
  const na = tokenNum(a), nb = tokenNum(b)
  if (na !== null && nb !== null) return na - nb
  if (na !== null) return -1
  if (nb !== null) return 1
  return a.name.localeCompare(b.name)
}
const isDimensionValue = (v: unknown) => typeof v === "number" || (typeof v === "string" && /^\d+(\.\d+)?(px|rem|em)?$/.test(v))

// Detect interactive components (Switch/Checkbox/Radio/Toggle generated with useState)
function isInteractive(entry: RegistryEntry): boolean {
  if ((entry as any).__interactive != null) return !!(entry as any).__interactive
  const s = entry.source || ""
  return /role=["'](switch|checkbox|radio|tab)["']/.test(s) ||
         (/useState/.test(s) && /aria-checked|aria-expanded|aria-selected/.test(s))
}

// Convert variant props for an INTERACTIVE hero: controlled `checked` → uncontrolled `defaultChecked`
function heroProps(entry: RegistryEntry, props: Record<string, unknown>): Record<string, unknown> {
  if (!isInteractive(entry)) return props
  const out: Record<string, unknown> = { ...props }
  if ("checked" in out && !("defaultChecked" in out)) { out.defaultChecked = out.checked; delete out.checked }
  return out
}

// ─── Cobertura de experiência: mede, pelo código-fonte, se os estados/experiência
// relevantes ao componente foram tratados. Eixos "na" quando não se aplicam. ────
function experienceCoverage(entry: RegistryEntry): { key: string; label: string; state: "ok" | "missing" | "na" }[] {
  const s = entry.source || ""
  const axisKeys = ((entry.variants || []) as any[]).flatMap(v => Object.keys((v && v.props) || {})).map(k => String(k).toLowerCase())
  const interactive = isInteractive(entry) || /<button|<a[\s>]|role=["'](button|link|switch|checkbox|radio|tab|menuitem)["']|onClick/.test(s)
  const hasDisabled = axisKeys.indexOf("disabled") !== -1 || /\bdisabled\b/.test(s)
  const hasLoading = axisKeys.some(k => /loading|busy/.test(k)) || /\bloading\b|aria-busy|isLoading/.test(s)
  const hasText = /<(p|span|h[1-6]|label)[\s>]/.test(s) || /\{children\}/.test(s)
  const has = (re: RegExp) => re.test(s)
  return [
    { key: "focus", label: "Foco visível", state: !interactive ? "na" : has(/:focus|focus-visible|focus:/i) ? "ok" : "missing" },
    { key: "hover", label: "Hover", state: !interactive ? "na" : has(/:hover|hover:/i) ? "ok" : "missing" },
    { key: "active", label: "Active", state: !interactive ? "na" : has(/:active|active:/i) ? "ok" : "missing" },
    { key: "disabled", label: "Disabled", state: !hasDisabled ? "na" : has(/disabled:|\[disabled\]|aria-disabled|cursor-not-allowed|pointer-events-none/i) ? "ok" : "missing" },
    { key: "loading", label: "Loading", state: !hasLoading ? "na" : has(/aria-busy|spinner|skeleton|animate-|loading/i) ? "ok" : "missing" },
    { key: "overflow", label: "Truncamento", state: !hasText ? "na" : has(/line-clamp|truncate|text-ellipsis|text-overflow|overflow-hidden|overflow:\s*hidden|break-/i) ? "ok" : "missing" },
    { key: "a11y", label: "Semântica / ARIA", state: has(/aria-|role=|<button|<label|<nav|<h[1-6]|alt=/i) ? "ok" : "missing" },
  ]
}

function ExperienceStrip({ entry }: { entry?: RegistryEntry }) {
  if (!entry) return null
  const axes = experienceCoverage(entry)
  const rel = axes.filter(a => a.state !== "na")
  const ok = rel.filter(a => a.state === "ok").length
  return (
    <div style={{ background: "var(--surface)", borderRadius: 22, boxShadow: "var(--shadow-md)", padding: "18px 22px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 12 }}>
        <div className="dss-mono" style={{ fontSize: 9.5, letterSpacing: ".13em", textTransform: "uppercase", color: "var(--ink-subtle)", fontWeight: 700 }}>Cobertura de experiência</div>
        <span className="dss-mono" style={{ fontSize: 18, fontWeight: 800, letterSpacing: "-.03em", lineHeight: 1 }}><span style={{ color: rel.length && ok === rel.length ? "var(--accent)" : "var(--warn)" }}>{ok}</span><span style={{ fontSize: 11, color: "var(--ink-subtle)" }}>/{rel.length}</span></span>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {axes.map(a => {
          const col = a.state === "ok" ? "var(--accent-ink)" : a.state === "missing" ? "var(--err)" : "var(--ink-subtle)"
          const bg = a.state === "ok" ? "var(--accent-soft)" : a.state === "missing" ? "var(--err-soft)" : "var(--surface-2)"
          const ic = a.state === "ok" ? "\u2713" : a.state === "missing" ? "\u2717" : "\u2014"
          return <span key={a.key} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 600, color: col, background: bg, padding: "5px 11px", borderRadius: 999 }}><span className="dss-mono" style={{ fontSize: 11 }}>{ic}</span>{a.label}</span>
        })}
      </div>
    </div>
  )
}

function Icon({ d, size = 16, stroke = 1.6 }: { d: string; size?: number; stroke?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round">{d.split("|").map((p, i) => <path key={i} d={p} />)}</svg>
}
const ICONS = {
  sun: "M12 3v2|M12 19v2|M5 5l1.5 1.5|M17.5 17.5L19 19|M3 12h2|M19 12h2|M5 19l1.5-1.5|M17.5 6.5L19 5|M12 8a4 4 0 100 8 4 4 0 000-8z",
  moon: "M20 14a8 8 0 11-9.5-9.5 6 6 0 009.5 9.5z",
  search: "M11 4a7 7 0 100 14 7 7 0 000-14z|M20 20l-3.5-3.5",
  layers: "M12 3l9 5-9 5-9-5 9-5z|M3 13l9 5 9-5|M3 18l9 5 9-5",
  grid: "M4 4h7v7H4z|M13 4h7v7h-7z|M4 13h7v7H4z|M13 13h7v7h-7z",
  book: "M4 5a2 2 0 012-2h13v16H6a2 2 0 00-2 2V5z|M19 19H6",
  chart: "M4 20V10|M10 20V4|M16 20v-7|M22 20H2",
  download: "M12 3v12|M7 11l5 4 5-4|M4 21h16",
  copy: "M9 9h10v10H9z|M5 15V5h10",
  chevron: "M9 6l6 6-6 6",
  bolt: "M13 2L4 14h7l-1 8 9-12h-7l1-8z",
  external: "M14 4h6v6|M20 4L9 15|M19 13v6a1 1 0 01-1 1H5a1 1 0 01-1-1V6a1 1 0 011-1h6",
  trash: "M3 6h18|M8 6V4a1 1 0 011-1h6a1 1 0 011 1v2|M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6|M10 11v5|M14 11v5",
  x: "M18 6L6 18|M6 6l12 12",
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, [string, string, string]> = {
    stable: ["Stable", "var(--ok)", "var(--ok-soft)"],
    beta: ["Beta", "var(--warn)", "var(--warn-soft)"],
    deprecated: ["Deprecated", "var(--err)", "var(--err-soft)"],
    wip: ["WIP", "var(--accent)", "var(--accent-soft)"],
  }
  const [label, color, bg] = map[status] || map.stable
  return <span style={{ fontSize: 11, fontWeight: 600, padding: "3px 9px", borderRadius: 999, background: bg, color, letterSpacing: ".02em" }}>{label}</span>
}

function CopyBtn({ text, label = "Copy" }: { text: string; label?: string }) {
  const [ok, setOk] = useState(false)
  return (
    <button className="dss-btn dss-mono" onClick={() => { navigator.clipboard.writeText(text); setOk(true); setTimeout(() => setOk(false), 1800) }}
      style={{ fontSize: 11, color: ok ? "var(--ok)" : "var(--ink-muted)", background: "transparent", border: "1px solid var(--hairline)", borderRadius: 7, padding: "5px 10px", display: "inline-flex", alignItems: "center", gap: 6 }}>
      <Icon d={ICONS.copy} size={12} />{ok ? "Copiado" : label}
    </button>
  )
}

function CodeBlock({ code, lang = "tsx" }: { code: string; lang?: string }) {
  if (!code?.trim()) return <div style={{ padding: 24, textAlign: "center", fontSize: 13, color: "var(--ink-subtle)", border: "1px solid var(--hairline)", borderRadius: 12 }}>Sem código</div>
  return (
    <div style={{ border: "1px solid var(--hairline)", borderRadius: 12, overflow: "hidden", background: "var(--surface-2)" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px", borderBottom: "1px solid var(--hairline)" }}>
        <span className="dss-mono" style={{ fontSize: 11, color: "var(--ink-subtle)", textTransform: "uppercase", letterSpacing: ".08em" }}>{lang}</span>
        <CopyBtn text={code} />
      </div>
      <pre className="dss-mono dss-scroll" style={{ margin: 0, padding: "16px 18px", fontSize: 12.5, lineHeight: 1.65, color: "var(--ink)", overflowX: "auto", whiteSpace: "pre" }}>{code}</pre>
    </div>
  )
}

function SectionLabel({ n, children }: { n?: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 18 }}>
      {n && <span className="dss-mono" style={{ fontSize: 12, color: "var(--accent)", fontWeight: 600 }}>{n}</span>}
      <span className="dss-mono" style={{ fontSize: 11, letterSpacing: ".14em", textTransform: "uppercase", color: "var(--ink-subtle)", fontWeight: 600 }}>{children}</span>
      <span style={{ flex: 1, height: 1, background: "var(--hairline)" }} />
    </div>
  )
}

// ─── Shared bento chrome (top bar, panels, pills) ────────────────────────────
const PANEL: React.CSSProperties = { background: "var(--surface)", borderRadius: 22, boxShadow: "var(--shadow-md)" }
const REPO_HREF = `https://github.com/${REPO_OWNER}/${REPO_NAME}`

function CountChip({ children }: { children: React.ReactNode }) {
  return <span className="dss-mono" style={{ fontSize: 11, color: "var(--ink-subtle)", border: "1px solid var(--hairline)", borderRadius: 999, padding: "5px 11px" }}>{children}</span>
}
function PanelHead({ title, right }: { title: string; right?: React.ReactNode }) {
  return <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18, gap: 12 }}><div style={{ fontSize: 18, fontWeight: 700, letterSpacing: "-0.02em" }}>{title}</div>{right}</div>
}
function DarkPill({ onClick, children }: { onClick?: () => void; children: React.ReactNode }) {
  return <button className="dss-btn dss-cta" onClick={onClick} style={{ display: "inline-flex", alignItems: "center", gap: 8, height: 44, padding: "0 20px", borderRadius: 999, border: "none", background: "var(--primary)", color: "var(--on-primary)", fontSize: 14, fontWeight: 600, fontFamily: "var(--font-sans)" }}>{children}</button>
}
function IconCircle({ onClick, href, title, d }: { onClick?: () => void; href?: string; title?: string; d: string }) {
  const style: React.CSSProperties = { width: 44, height: 44, borderRadius: "50%", border: "1px solid var(--hairline)", background: "var(--surface)", color: "var(--ink)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "var(--shadow-sm)", textDecoration: "none", flexShrink: 0 }
  return href
    ? <a className="dss-btn" href={href} target="_blank" rel="noreferrer" title={title} style={style}><Icon d={d} size={18} /></a>
    : <button className="dss-btn" onClick={onClick} title={title} style={style}><Icon d={d} size={18} /></button>
}
function TopBar({ title, search, actions }: { title: string; search?: { value: string; onChange: (v: string) => void; placeholder?: string }; actions?: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 24, flexWrap: "wrap" }}>
      <h1 className="dss-display" style={{ fontSize: 30, fontWeight: 800, letterSpacing: "-0.03em", margin: 0 }}>{title}</h1>
      <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 10 }}>
        {search && (
          <div style={{ display: "flex", alignItems: "center", gap: 10, background: "var(--surface)", border: "1px solid var(--hairline)", borderRadius: 999, padding: "10px 16px", width: 260, boxShadow: "var(--shadow-sm)" }}>
            <span style={{ color: "var(--ink-subtle)", display: "flex" }}><Icon d={ICONS.search} size={16} /></span>
            <input value={search.value} onChange={e => search.onChange(e.target.value)} placeholder={search.placeholder} style={{ border: "none", outline: "none", background: "none", fontFamily: "var(--font-sans)", fontSize: 13.5, color: "var(--ink)", width: "100%" }} />
          </div>
        )}
        {actions}
      </div>
    </div>
  )
}


// ─── Shared Design-System UI Components ─────────────────────────────────────

type PillVariant = "interactive" | "stable" | "beta" | "deprecated" | "neutral"
const _PILL_S: Record<PillVariant, React.CSSProperties> = {
  interactive: { background: "var(--accent-soft)", color: "var(--accent-ink)" },
  stable:      { background: "var(--surface-2)",   color: "var(--ink-muted)" },
  beta:        { background: "var(--warn-soft)",     color: "var(--warn)" },
  deprecated:  { background: "var(--err-soft)",      color: "var(--err)" },
  neutral:     { background: "var(--surface-2)",   color: "var(--ink-muted)" },
}
const _PILL_L: Record<PillVariant, string> = {
  interactive: "Interactive", stable: "Stable", beta: "Beta", deprecated: "Deprecated", neutral: "—"
}
function Pill({ variant = "stable" as PillVariant, size = "md", children }: { variant?: PillVariant; size?: "sm"|"md"; children?: React.ReactNode }) {
  const sz: React.CSSProperties = size === "sm" ? { fontSize: 10, padding: "2px 8px" } : { fontSize: 11, padding: "3px 10px" }
  return <span style={{ display: "inline-flex", alignItems: "center", borderRadius: 999, fontWeight: 700, letterSpacing: ".02em", ...sz, ..._PILL_S[variant] }}>{children ?? _PILL_L[variant]}</span>
}

function StatCard({ icon, label, value, trend, sub }: { icon?: string; label: string; value: React.ReactNode; trend?: React.ReactNode; sub?: string }) {
  return (
    <div style={{ background: "var(--surface)", borderRadius: 14, padding: "20px 22px", boxShadow: "var(--shadow-sm)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--ink-muted)", fontSize: 13, fontWeight: 600, marginBottom: 10 }}>
        {icon && <Icon d={icon} size={16} />}{label}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div className="dss-display" style={{ fontSize: 44, fontWeight: 800, letterSpacing: "-0.035em", lineHeight: 1 }}>{value}</div>
        {trend && <span style={{ display:"inline-flex", alignItems:"center", gap:4, fontSize:12, fontWeight:700, padding:"5px 10px", borderRadius:999, background:"var(--accent-soft)", color:"var(--accent-ink)" }}><Icon d="M7 17L17 7|M9 7h8v8" size={12} />{trend}</span>}
      </div>
      {sub && <div style={{ fontSize: 12, color: "var(--ink-subtle)", marginTop: 8, fontWeight: 500 }}>{sub}</div>}
    </div>
  )
}

function StatTray({ cols = 2, children }: { cols?: number; children: React.ReactNode }) {
  return (
    <div style={{ background: "var(--surface-2)", borderRadius: 18, padding: 12, display: "grid", gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 12 }}>
      {children}
    </div>
  )
}

function MiniPreview({ entry, scale = 0.5 }: { entry: RegistryEntry; scale?: number }) {
  try { const C = entry.Component; return <div style={{ transform: `scale(${scale})`, pointerEvents: "none" }}><C {...heroProps(entry, entry.variants[0]?.props || {})} /></div> }
  catch { return <span style={{ fontSize: 13, fontWeight: 800, color: "var(--ink-subtle)" }}>{entry.displayName[0]}</span> }
}

function ComponentThumbnail({ entry, onClick }: { entry: RegistryEntry; onClick: () => void }) {
  return (
    <button className="dss-btn" onClick={onClick} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, background: "none", border: "none", cursor: "pointer" }}>
      <div style={{ width: 72, height: 72, borderRadius: 18, border: "1px solid var(--hairline)", background: "var(--surface-2)", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", boxShadow: "var(--shadow-sm)" }}>
        <MiniPreview entry={entry} scale={0.5} />
      </div>
      <span style={{ fontSize: 13, fontWeight: 600 }}>{entry.displayName}</span>
    </button>
  )
}

function ComponentRow({ entry, onClick, size = "md" }: { entry: RegistryEntry; onClick: () => void; size?: "sm"|"md"|"lg" }) {
  const thumb = size === "lg" ? 46 : 40
  const sc = size === "lg" ? 0.38 : 0.32
  return (
    <button className="dss-btn dss-navitem" onClick={onClick}
      style={{ display:"flex", alignItems:"center", gap:12, width:"100%", padding: size==="lg" ? "11px 10px" : "9px 10px", borderRadius:12, border:"none", background:"none", cursor:"pointer", textAlign:"left", fontFamily:"var(--font-sans)" }}>
      <div style={{ width:thumb, height:thumb, borderRadius: size==="lg"?12:10, flexShrink:0, background:"var(--surface-2)", border:"1px solid var(--hairline)", display:"flex", alignItems:"center", justifyContent:"center", overflow:"hidden" }}>
        <MiniPreview entry={entry} scale={sc} />
      </div>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontSize:14, fontWeight:600, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{entry.displayName}</div>
        <div style={{ marginTop:4 }}><Pill variant={(entry as any).__status ?? (isInteractive(entry) ? "interactive" : "stable")} size="sm" /></div>
      </div>
      <span className="dss-mono" style={{ fontSize:12, fontWeight:700, color:"var(--ink-muted)", flexShrink:0 }}>v{entry.version}</span>
    </button>
  )
}

function ActivityRow({ entry, first, onClick }: { entry: RegistryEntry; first?: boolean; onClick?: () => void }) {
  const ago = timeAgo(entry.publishedAt)
  return (
    <button className="dss-btn dss-navitem" onClick={onClick} style={{ display:"flex", gap:12, padding:"12px 8px", width:"100%", textAlign:"left", border:"none", borderTop: first ? "none" : "1px solid var(--hairline)", background:"none", cursor: onClick ? "pointer" : "default", borderRadius: 10, fontFamily:"var(--font-sans)" }}>
      <div style={{ width:36, height:36, borderRadius:"50%", flexShrink:0, background:"linear-gradient(145deg,#6f6f72,#2b2b2e)", display:"flex", alignItems:"center", justifyContent:"center" }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M12 2 21 7v10l-9 5-9-5V7z" stroke="#fff" strokeWidth="1.4" opacity=".9" /></svg>
      </div>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontSize:13.5, display:"flex", alignItems:"baseline", gap:6 }}><b style={{ fontWeight:700, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{entry.displayName}</b> <span style={{ color:"var(--ink-subtle)", flexShrink:0 }}>publicado · v{entry.version}</span>{ago && <span className="dss-mono" style={{ marginLeft:"auto", color:"var(--ink-subtle)", fontSize:11, flexShrink:0 }}>{ago}</span>}</div>
        <div style={{ fontSize:13, color:"var(--ink-muted)", marginTop:3 }}>{entry.variants?.length||0} variante(s){isInteractive(entry)?" · interativo":""} · {entry.category}</div>
      </div>
    </button>
  )
}

function DSBadge({ style: sx }: { style?: React.CSSProperties }) {
  return (
    <div className="dss-mono" style={{ display:"inline-flex", alignItems:"center", gap:7, fontSize:10.5, color:"var(--ink-subtle)", fontWeight:600, letterSpacing:".04em", ...sx }}>
      <span aria-hidden style={{ display:"inline-grid", gridTemplateColumns:"1fr 1fr", gap:1.5, width:13, height:13 }}>
        <span style={{ background:"currentColor", borderRadius:1 }}/><span style={{ background:"currentColor", borderRadius:1 }}/>
        <span style={{ background:"currentColor", borderRadius:1 }}/><span style={{ background:"var(--accent)", borderRadius:1 }}/>
      </span>
      Generated with DS Studio
    </div>
  )
}

function GhostPillBtn({ onClick, children }: { onClick?: () => void; children: React.ReactNode }) {
  return (
    <button className="dss-btn" onClick={onClick}
      style={{ width:"100%", textAlign:"center", padding:"12px", borderRadius:999, border:"1px solid var(--hairline-strong)", background:"none", fontFamily:"var(--font-sans)", fontSize:13.5, fontWeight:600, color:"var(--ink)", cursor:"pointer" }}>
      {children}
    </button>
  )
}

// ─── Time formatting ─────────────────────────────────────────────────────────
function timeAgo(iso?: string): string {
  if (!iso) return ""
  const t = new Date(iso).getTime()
  if (isNaN(t)) return ""
  const d = Math.floor((Date.now() - t) / 1000)
  if (d < 60) return "agora"
  if (d < 3600) return "há " + Math.floor(d / 60) + " min"
  if (d < 86400) return "há " + Math.floor(d / 3600) + " h"
  if (d < 2592000) return "há " + Math.floor(d / 86400) + " d"
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })
}

// ─── Slug & deep-linking (E8) ────────────────────────────────────────────────
function slugify(name: string): string {
  return String(name).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")
}
// Prefixo /p/{uuid} = projeto Supabase ativo. A rota interna (overview/styles/c/…)
// é parseada do restante; overview = raiz do projeto.
const PROJ_RE = /^\/p\/([0-9a-fA-F-]{36})(\/.*)?$/
function stripProjectPrefix(path: string): { projectId: string | null; rest: string } {
  const m = path.match(PROJ_RE)
  return m ? { projectId: m[1], rest: m[2] || "/" } : { projectId: null, rest: path }
}
function projectIdFromPath(path: string): string | null { return stripProjectPrefix(path).projectId }
function routeToPath(r: Route, projectId?: string): string {
  if (r.kind === "projects") return "/" // hub nunca é escopado a projeto
  if (r.kind === "invite") return "/invite/" + r.token // aceite de convite, fora de projeto
  if (r.kind === "reset") return "/reset-password" // redefinição de senha (token vem no hash)
  const base =
    r.kind === "overview" ? "/overview"
    : r.kind === "components" ? "/components"
    : r.kind === "builder" ? "/builder"
    : r.kind === "foundations" ? "/styles" + (r.section ? "/" + r.section : "")
    : r.kind === "insights" ? "/insights"
    : r.kind === "admin" ? "/admin" + (r.tab ? "/" + r.tab : "")
    : r.kind === "login" ? "/login"
    : r.kind === "activity" ? "/activity"
    : r.kind === "platform" ? "/platform" + (r.section && r.section !== "overview" ? "/" + r.section : "")
    : "/c/" + slugify(r.name) + (r.tab ? "/" + r.tab : "")
  if (!projectId) return base
  return r.kind === "overview" ? "/p/" + projectId : "/p/" + projectId + base
}
function parsePath(path: string, registry: RegistryEntry[]): Route {
  const { projectId, rest } = stripProjectPrefix(path)
  const seg = rest.replace(/^\/+|\/+$/g, "").split("/")
  if (!seg[0]) return (projectId || IS_INSTANCE) ? { kind: "overview" } : { kind: "projects" }
  if (seg[0] === "overview") return { kind: "overview" }
  if (seg[0] === "components") return { kind: "components" }
  if (seg[0] === "builder") return { kind: "builder" }
  if (seg[0] === "styles" || seg[0] === "foundations") return { kind: "foundations", section: seg[1] || undefined } // "/foundations" = alias legado
  if (seg[0] === "insights") return { kind: "insights" }
  if (seg[0] === "admin") return { kind: "admin", tab: (seg[1] as any) || undefined }
  if (seg[0] === "projects") return { kind: "projects" }
  if (seg[0] === "login") return { kind: "login" }
  if (seg[0] === "invite" && seg[1]) return { kind: "invite", token: seg[1] }
  if (seg[0] === "reset-password") return { kind: "reset" }
  if (seg[0] === "activity") return { kind: "activity" }
  if (seg[0] === "platform") return { kind: "platform", section: (seg[1] as any) || undefined }
  if (seg[0] === "c" && seg[1]) {
    const hit = registry.find(c => slugify(c.name) === seg[1] || slugify(c.displayName) === seg[1])
    // projeto Supabase: o slug não está no registry da instância — resolve depois via curated
    return { kind: "component", name: hit ? hit.name : seg[1], tab: (seg[2] as TabId) || undefined }
  }
  return { kind: "overview" }
}

// ─── Component metadata (public/component-meta/{name}.json — publish telemetry) ─
type ComponentMeta = { version?: string; publishedAt?: string; changelog?: ChangelogEntry[]; visualRef?: RegistryEntry["visualRef"] }
const __META_CACHE: Record<string, ComponentMeta | null> = {}
function useComponentMeta(registry: RegistryEntry[]) {
  const [meta, setMeta] = useState<Record<string, ComponentMeta>>({})
  useEffect(() => {
    let on = true
    Promise.all(registry.map(c =>
      __META_CACHE[c.name] !== undefined
        ? Promise.resolve([c.name, __META_CACHE[c.name]] as const)
        : fetch("/component-meta/" + c.name + ".json").then(r => r.ok ? r.json() : null).catch(() => null).then(j => { __META_CACHE[c.name] = j; return [c.name, j] as const })
    )).then(pairs => {
      if (!on) return
      const m: Record<string, ComponentMeta> = {}
      for (const [n, j] of pairs) if (j) m[n] = j
      setMeta(m)
    })
    return () => { on = false }
  }, [registry])
  return meta
}
// Merge meta into entries (publishedAt + changelog), non-destructive
function withMeta(registry: RegistryEntry[], meta: Record<string, ComponentMeta>): RegistryEntry[] {
  if (!Object.keys(meta).length) return registry
  return registry.map(e => {
    const m = meta[e.name]
    if (!m) return e
    return { ...e, publishedAt: m.publishedAt || e.publishedAt, changelog: m.changelog || e.changelog, visualRef: m.visualRef || e.visualRef }
  })
}

// ─── Curation layer (public/curation.json — owner overrides, Git-versioned) ──
type CurationStatus = "stable" | "beta" | "deprecated"
type CurationEntry = { hidden?: boolean; deleted?: boolean; displayName?: string; status?: CurationStatus; category?: string; layer?: NavGroup; docsOverrides?: Partial<AllDocs>; playground?: { locked?: string[] } }
type Curation = { $schema?: string; updatedAt?: string; updatedBy?: string; order?: string[]; components?: Record<string, CurationEntry> }

function useCuration(): { curation: Curation | null; refresh: () => void } {
  const [cur, setCur] = useState<Curation | null>(null)
  const [bust, setBust] = useState(0)
  useEffect(() => {
    let on = true
    fetch("/curation.json", { cache: bust ? "reload" : "default" }).then(r => (r.ok ? r.json() : null)).then(j => { if (on && j) setCur(j) }).catch(() => {})
    return () => { on = false }
  }, [bust])
  return { curation: cur, refresh: () => setBust(x => x + 1) }
}

function __mergeDocs(docs: AllDocs | null, ov?: Partial<AllDocs>): AllDocs | null {
  if (!docs || !ov) return docs
  return { ...docs, ...ov }
}

// Curation keys match entry.name (sanitized) with displayName (Figma name) as fallback,
// so the plugin can key by either identifier safely.
// ─── Grupos funcionais de navegação (benchmark: Carbon · Atlassian · Material 3) ─
// Decisão (PRD 7.5): nenhum grande player navega por atomic design — todos agrupam
// por PROPÓSITO ("functional-purpose"). Classificação automática por heurística;
// o owner reclassifica via curadoria (campo `layer`) no Admin. Governança > hardcode.
type NavGroup = "actions" | "forms" | "navigation" | "feedback" | "display" | "overlay" | "layout" | "other"
const LAYER_ORDER: NavGroup[] = ["actions", "forms", "navigation", "feedback", "display", "overlay", "layout", "other"]
const LAYER_META: Record<NavGroup, { label: string; icon: string }> = {
  actions:    { label: "Ações", icon: "M4 4l7.2 17 2.4-7.4L21 11.2 4 4z" },
  forms:      { label: "Formulários & entrada", icon: "M3 6a2 2 0 012-2h14a2 2 0 012 2v12a2 2 0 01-2 2H5a2 2 0 01-2-2V6z|M7 9h6|M7 13h10" },
  navigation: { label: "Navegação", icon: "M12 2a10 10 0 100 20 10 10 0 000-20z|M16 8l-2.5 5.5L8 16l2.5-5.5L16 8z" },
  feedback:   { label: "Status & feedback", icon: "M12 22a10 10 0 100-20 10 10 0 000 20z|M12 8v5|M12 16.5v.5" },
  display:    { label: "Conteúdo & exibição", icon: "M3 5a2 2 0 012-2h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V5z|M3 10h18|M8 14h8" },
  overlay:    { label: "Sobreposição", icon: "M7 3h12a2 2 0 012 2v12|M3 9a2 2 0 012-2h10a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" },
  layout:     { label: "Layout & estrutura", icon: "M3 3h7v7H3z|M14 3h7v7h-7z|M3 14h7v7H3z|M14 14h7v7h-7z" },
  other:      { label: "Outros", icon: "M5 13a1 1 0 100-2 1 1 0 000 2z|M12 13a1 1 0 100-2 1 1 0 000 2z|M19 13a1 1 0 100-2 1 1 0 000 2z" },
}
function inferLayer(category: string, name: string): NavGroup {
  // A CATEGORIA decide primeiro (mantém os grupos do designer coesos);
  // o nome do componente é apenas fallback quando a categoria é inconclusiva.
  const pick = (t: string): NavGroup | null => {
    if (!t) return null
    if (/button|botão|fab|cta\b|link/.test(t)) return "actions"
    if (/input|field|switch|checkbox|radio|select|slider|form\b|textarea|toggle|picker|search/.test(t)) return "forms"
    if (/tab\b|tabs|menu|nav\b|breadcrumb|pagination|stepper|app bar|header/.test(t)) return "navigation"
    if (/badge|alert|toast|snackbar|notification|progress|spinner|skeleton|loading|counter|status|banner|flag|lozenge|tag\b|chip/.test(t)) return "feedback"
    if (/modal|dialog|drawer|tooltip|popover|sheet|blanket|overlay/.test(t)) return "overlay"
    if (/grid|divider|section|container|stack|box\b|spacer|layout/.test(t)) return "layout"
    if (/card|table|list|avatar|image|tile|carousel|accordion|media|thumbnail/.test(t)) return "display"
    return null
  }
  return pick((category || "").toLowerCase()) || pick((name || "").toLowerCase()) || "other"
}
const layerOf = (e: any): NavGroup => ((e && e.__layer) as NavGroup) || inferLayer(e?.category, e?.name)

// Seções da página Foundations — viram sub-itens do grupo "Styles" no sidebar
const FOUNDATION_SECTIONS: { slug: string; label: string }[] = [
  { slug: "cores", label: "Paleta de cor" },
  { slug: "tipografia", label: "Tipografia" },
  { slug: "espacamento", label: "Espaçamento" },
  { slug: "radius", label: "Radius" },
  { slug: "stroke", label: "Stroke" },
  { slug: "elevacao", label: "Elevação" },
]

function applyCuration(registry: RegistryEntry[], curation: Curation | null): RegistryEntry[] {
  const comps = curation?.components
  if (!comps) return registry
  const lookup = (e: RegistryEntry) => comps[e.name] || comps[e.displayName]
  let out = registry.filter(e => { const cu = lookup(e); return !(cu?.hidden || cu?.deleted) }).map(e => {
    const cu = lookup(e)
    if (!cu) return e
    const next: any = { ...e }
    if (cu.displayName) next.displayName = cu.displayName
    if (cu.category) next.category = cu.category
    if (cu.status) next.__status = cu.status
    if ((cu as any).layer) next.__layer = (cu as any).layer
    if (cu.docsOverrides) next.__docsOverrides = cu.docsOverrides
    return next as RegistryEntry
  })
  if (curation?.order?.length) {
    const pos = new Map(curation.order.map((n, i) => [n, i]))
    out = [...out].sort((a, b) => (pos.get(a.name) ?? 1e9) - (pos.get(b.name) ?? 1e9))
  }
  return out
}

// ─── useAllDocs — preserved contract: reads /component-docs/{name}.json ───────
function useAllDocs(entry: RegistryEntry) {
  const [status, setStatus] = useState<DocStatus>("idle")
  const [docs, setDocs] = useState<AllDocs | null>(null)
  const [error, setError] = useState<string | null>(null)

  const run = (bust = false) => {
    setStatus("loading"); setDocs(null); setError(null)
    fetch(`/component-docs/${entry.name}.json`, { cache: bust ? "reload" : "default" })
      .then(r => {
        if (!r.ok) throw new Error(
          `Documentação ainda não gerada para "${entry.name}".\n\n` +
          `Opção 1: Republique o componente pelo plugin DS Studio.\n` +
          `Opção 2: Rode o GitHub Action "Generate Component Docs".`)
        return r.json()
      })
      .then(g => { setDocs({ a11y: g.a11y, donts: g.donts, useCases: g.useCases, interpretation: g.interpretation }); setStatus("done") })
      .catch((e: Error) => { setError(e.message); setStatus("error") })
  }
  useEffect(() => { run() }, [entry.name]) // eslint-disable-line
  return { status, docs: __mergeDocs(docs, (entry as any).__docsOverrides), error, refresh: () => run(true) }
}

// ─── Foundations aggregation ─────────────────────────────────────────────────
type TokenGroup = { prefix: string; tokens: TokenEntry[] }
type VarsMap = Record<string, { name: string; type?: string; value: unknown; aliasOf?: string }>
// Mapa global de variáveis publicado pelo plugin (public/variables.json) — resolve aliases
// de QUALQUER componente histórico sem precisar republicá-lo.
function useVariablesMap(): VarsMap | null {
  const [m, setM] = useState<VarsMap | null>(null)
  useEffect(() => {
    let on = true
    fetch("/variables.json").then(r => (r.ok ? r.json() : null)).then(j => { if (on && j && j.variables) setM(j.variables as VarsMap) }).catch(() => {})
    return () => { on = false }
  }, [])
  return m
}
const resolveTokenWithMap = (t: TokenEntry, varsMap?: VarsMap | null): TokenEntry => {
  const v = t.value as any
  if (varsMap && v && typeof v === "object" && v.type === "VARIABLE_ALIAS" && v.id && varsMap[v.id] && varsMap[v.id].value != null && (varsMap[v.id].value as any)?.type !== "VARIABLE_ALIAS") {
    const m = varsMap[v.id]
    return { ...t, value: m.value, aliasOf: t.aliasOf || m.aliasOf || m.name }
  }
  return t
}

function aggregateTokens(registry: RegistryEntry[], varsMap?: VarsMap | null, tokenList?: TokenEntry[]) {
  const seen = new Set<string>()
  const all: TokenEntry[] = []
  const src: TokenEntry[] = (tokenList && tokenList.length)
    ? tokenList
    : registry.reduce((acc, c) => acc.concat(c.tokens || []), [] as TokenEntry[])
  for (const t0 of src) {
    const t = resolveTokenWithMap(t0, varsMap)
    const key = t.name + "::" + formatTokenValue(t.value)
    if (seen.has(key)) continue
    seen.add(key); all.push(t)
  }
  // Cores: pelo VALOR resolvido (regex por nome causava falsos positivos, ex.: Text/preset-1 = 12)
  const colors = all.filter(t => isColorValue(t.value))
  const radius = all.filter(t => /radius|corner/i.test(t.name))
  const spacing = all.filter(t => /spac|gap|padding|margin|inset/i.test(t.name) && !radius.includes(t))
  const stroke = all.filter(t => /stroke|border-?width/i.test(t.name))
  const opacity = all.filter(t => /opacity|alpha/i.test(t.name))
  radius.sort(byTokenNum); spacing.sort(byTokenNum); stroke.sort(byTokenNum)
  const used = new Set([...colors, ...radius, ...spacing, ...stroke, ...opacity])
  const other = all.filter(t => !used.has(t))
  return { all, colors, radius, spacing, stroke, opacity, other }
}

function classifyColor(name: string): string {
  const n = name.toLowerCase()
  if (/brand|accent|primary|cta|signal|highlight/.test(n)) return "Brand & Accent"
  if (/surface|background|canvas|fill|elevat|card|sheet/.test(n)) return "Surface"
  if (/text|ink|label|foreground|content|body|heading/.test(n)) return "Text"
  if (/border|hairline|divider|stroke|outline/.test(n)) return "Border"
  if (/success|error|warn|danger|info|positive|negative|alert|semantic/.test(n)) return "Semantic"
  return "Other"
}

function generateDesignMd(registry: RegistryEntry[]): string {
  const f = aggregateTokens(registry)
  const cats: Record<string, RegistryEntry[]> = {}
  registry.forEach(c => { (cats[c.category || "Components"] ||= []).push(c) })
  const name = REPO_NAME.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase())

  let md = `# Design System: ${name}\n\n`
  md += `> Independent, AI-readable analysis of the ${name} design system. Generated by DS Studio from Figma.\n`
  md += `> Drop this into your project root and tell your AI assistant to use DESIGN.md for UI work.\n\n`
  md += `## Usage\n\nFeed this file to your coding agent (Claude Code, Cursor) as the canonical reference for ${name} UI work. ${registry.length} components · ${Object.keys(cats).length} categories · ${f.all.length} tokens · github.com/${REPO_OWNER}/${REPO_NAME}\n\n`

  // 01 — Color Palette (grouped by role)
  md += `## 01 — Color Palette\n\n`
  if (f.colors.length) {
    const groups: Record<string, TokenEntry[]> = {}
    f.colors.forEach(t => { (groups[classifyColor(t.name)] ||= []).push(t) })
    for (const role of ["Brand & Accent", "Surface", "Text", "Border", "Semantic", "Other"]) {
      const items = groups[role]; if (!items?.length) continue
      md += `### ${role}\n\n`
      items.slice(0, 40).forEach(t => { md += `- **${t.name.split("/").pop()}** \`${formatTokenValue(t.value)}\` — ${t.name}\n` })
      md += `\n`
    }
  } else { md += `_No resolved color tokens — variable aliases need resolution during extraction._\n\n` }

  // 02 — Typography Scale
  md += `## 02 — Typography Scale\n\n`
  md += `| Role | Size | Weight | Line height | Tracking | Font |\n|---|---|---|---|---|---|\n`
  for (const [n2, size, weight, ls, fam] of TYPE_SCALE) {
    const famName = String(fam).includes("display") ? "display" : String(fam).includes("mono") ? "mono" : "sans"
    md += `| ${n2} | ${size}px | ${weight} | ${(1.1).toFixed(2)} | ${ls} | ${famName} |\n`
  }
  md += `\n`

  // 03 — Components
  md += `## 03 — Components\n\n`
  for (const [cat, items] of Object.entries(cats)) {
    md += `### ${cat}\n\n`
    for (const c of items) {
      md += `- **${c.displayName}** \`<${c.name} />\` — ${c.variants.length} variant${c.variants.length !== 1 ? "s" : ""}`
      if (c.width && c.height) md += ` · ${c.width}×${c.height}px`
      if (isInteractive(c)) md += ` · interactive`
      md += `\n`
      const propKeys = new Set<string>()
      c.variants.forEach(v => Object.keys(v.props || {}).forEach(k => propKeys.add(k)))
      if (propKeys.size) md += `  - props: ${Array.from(propKeys).map(k => `\`${k}\``).join(", ")}\n`
    }
    md += `\n`
  }

  // 04 — Spacing & Radius
  md += `## 04 — Spacing & Radius\n\n`
  if (f.spacing.length) { md += `### Spacing\n\n`; f.spacing.forEach(t => md += `- **${t.name.split("/").pop()}** \`${formatTokenValue(t.value)}\`\n`); md += `\n` }
  if (f.radius.length) { md += `### Radius\n\n`; f.radius.forEach(t => md += `- **${t.name.split("/").pop()}** \`${formatTokenValue(t.value)}\`\n`); md += `\n` }
  if (f.stroke.length) { md += `### Stroke Width\n\n`; f.stroke.forEach(t => md += `- **${t.name.split("/").pop()}** \`${formatTokenValue(t.value)}\`\n`); md += `\n` }

  // 05 — Elevation
  md += `## 05 — Elevation & Depth\n\n- **Level 0** — flat, no shadow\n- **Level 1** — hairline border\n- **Level 2** — soft card shadow\n- **Level 3** — floating panel / modal\n\n`

  // 06 — Responsive
  md += `## 06 — Responsive Behavior\n\n| Name | Width | Notes |\n|---|---|---|\n| Desktop | 1280px | Full layout, multi-column grids |\n| Tablet | 1024px | Grids collapse 3-up → 2-up |\n| Mobile | 768px | Single column; nav → drawer |\n\n`

  // Usage rules
  md += `## Usage rules\n\n`
  md += `- Use the exact component prop names listed in §03; do not invent new ones.\n`
  md += `- Reference tokens by name rather than hardcoding hex/px values.\n`
  md += `- Interactive components manage their own state (controlled + uncontrolled).\n`
  md += `- Match the typography scale in §02 exactly — size, weight and tracking carry the brand voice.\n`
  return md
}

// ─── Overview (landing) ──────────────────────────────────────────────────────
// ─── Catalog: minimal grouped table (volume per grouping, drill-down) ────────
function CatalogTable({ cats, expandAll, onOpen }: { cats: Record<string, RegistryEntry[]>; expandAll: boolean; onOpen: (n: string) => void }) {
  const entries = Object.entries(cats)
  const [open, setOpen] = useState<Record<string, boolean>>(() => (entries[0] ? { [entries[0][0]]: true } : {}))
  const maxVar = Math.max(1, ...entries.map(([, it]) => it.reduce((a, c) => a + (c.variants?.length || 0), 0)))
  const toggle = (c: string) => setOpen(o => ({ ...o, [c]: !o[c] }))
  const totalComp = entries.reduce((a, [, it]) => a + it.length, 0)

  return (
    <div style={{ background: "var(--surface)", borderRadius: 22, boxShadow: "var(--shadow-md)", overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px 24px", borderBottom: "1px solid var(--hairline)" }}>
        <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: "-0.02em" }}>Componentes por grupo</div>
        <span className="dss-mono" style={{ fontSize: 11, color: "var(--ink-subtle)", border: "1px solid var(--hairline)", borderRadius: 999, padding: "5px 11px" }}>{entries.length} grupos · {totalComp}</span>
      </div>
      {/* column header */}
      <div className="dss-mono" style={{ display: "flex", alignItems: "center", gap: 16, padding: "9px 24px", fontSize: 10, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--ink-subtle)", borderBottom: "1px solid var(--hairline)" }}>
        <span style={{ flex: 1 }}>Grupo</span>
        <span style={{ width: 220 }}>Volume de variantes</span>
        <span style={{ width: 64, textAlign: "right" }}>Comp.</span>
        <span style={{ width: 16 }} />
      </div>
      {entries.map(([cat, items], idx) => {
        const isOpen = expandAll || !!open[cat]
        const variants = items.reduce((a, c) => a + (c.variants?.length || 0), 0)
        const inter = items.filter(isInteractive).length
        const w = Math.max(5, Math.round((variants / maxVar) * 100))
        return (
          <div key={cat} style={{ borderBottom: idx === entries.length - 1 ? "none" : "1px solid var(--hairline)" }}>
            <button className="dss-btn dss-navitem" onClick={() => toggle(cat)} style={{ display: "flex", alignItems: "center", gap: 16, width: "100%", padding: "13px 24px", background: "none", border: "none", cursor: "pointer", textAlign: "left" }}>
              <span style={{ display: "flex", alignItems: "center", gap: 11, flex: 1, minWidth: 0 }}>
                <span style={{ display: "flex", color: "var(--ink-subtle)", transform: isOpen ? "rotate(90deg)" : "none", transition: "transform .16s" }}><Icon d={ICONS.chevron} size={14} /></span>
                <span style={{ fontSize: 15, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{cat}</span>
                {inter > 0 && <Pill variant="interactive" size="sm">{inter} int</Pill>}
              </span>
              <span style={{ width: 220, display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ flex: 1, height: 6, borderRadius: 999, background: "var(--surface-3)", overflow: "hidden" }}><span style={{ display: "block", width: `${w}%`, height: "100%", background: "linear-gradient(90deg,#43DA86,#21B26B)", borderRadius: 999 }} /></span>
                <span className="dss-mono" style={{ fontSize: 12, color: "var(--ink-muted)", width: 48, textAlign: "right" }}>{variants}</span>
              </span>
              <span className="dss-mono" style={{ width: 64, textAlign: "right", fontSize: 17, fontWeight: 700 }}>{items.length}</span>
              <span style={{ width: 16 }} />
            </button>
            {isOpen && (
              <div style={{ padding: "2px 18px 14px 46px" }}>
                {items.map(c => (
                  <button key={c.name} className="dss-btn dss-navitem" onClick={() => onOpen(c.name)} style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", padding: "9px 12px", borderRadius: 10, background: "none", border: "none", cursor: "pointer", textAlign: "left" }}>
                    <span style={{ width: 5, height: 5, borderRadius: "50%", background: isInteractive(c) ? "var(--accent)" : "var(--hairline-strong)", flexShrink: 0 }} />
                    <span style={{ flex: 1, fontSize: 13.5, fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.displayName}</span>
                    {(((c as any).__status) || isInteractive(c)) && <Pill variant={(c as any).__status ?? "interactive"} size="sm" />}
                    <span className="dss-mono" style={{ fontSize: 12, color: "var(--ink-subtle)", width: 52, textAlign: "right", flexShrink: 0 }}>{c.variants.length} var</span>
                    <span className="dss-mono" style={{ fontSize: 12, color: "var(--ink-subtle)", width: 44, textAlign: "right", flexShrink: 0 }}>v{c.version}</span>
                    <span style={{ display: "flex", color: "var(--ink-subtle)", flexShrink: 0 }}><Icon d={ICONS.chevron} size={13} /></span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

function OverviewPage({ registry, onOpen, onFoundations, onExport, q, setQ, tokenOverride, onPublish }: { registry: RegistryEntry[]; onOpen: (n: string) => void; onFoundations: () => void; onExport: () => void; q: string; setQ: (v: string) => void; tokenOverride?: number; onPublish?: () => void }) {
  const cats: Record<string, RegistryEntry[]> = {}
  registry.forEach(c => { (cats[c.category || "Components"] ||= []).push(c) })
  const tokenCount = tokenOverride != null ? tokenOverride : aggregateTokens(registry).all.length
  const interactive = registry.filter(isInteractive).length
  const totalVariants = registry.reduce((a, c) => a + (c.variants?.length || 0), 0)
  const catCount = Object.keys(cats).length
  const recents = registry.slice(0, 6)
  // Feed de Atividade (fix): ordena por data de publicação real quando disponível
  const activity = useMemo(() => {
    const withDate = registry.filter(c => c.publishedAt)
    if (withDate.length) {
      return [...withDate].sort((a, b) => new Date(b.publishedAt!).getTime() - new Date(a.publishedAt!).getTime()).slice(0, 4)
    }
    return registry.slice(0, 3) // fallback: ainda sem meta publicada
  }, [registry])
  const thumbs = registry.slice(0, 5)
  const project = REPO_NAME.replace(/-/g, " ")
  const TOKEN_IC = "M12 8a4 4 0 100 8 4 4 0 000-8z|M12 2v4|M12 18v4|M2 12h4|M18 12h4"

  const barComps = registry.slice(0, 9)
  const maxV = Math.max(1, ...barComps.map(c => c.variants?.length || 1))
  const maxIdx = barComps.reduce((mi, c, i, arr) => (c.variants?.length || 0) > (arr[mi].variants?.length || 0) ? i : mi, 0)

  const ql = q.trim().toLowerCase()
  const filteredCats: Record<string, RegistryEntry[]> = {}
  for (const [cat, items] of Object.entries(cats)) {
    const f = ql ? items.filter(c => c.displayName.toLowerCase().includes(ql) || c.name.toLowerCase().includes(ql) || cat.toLowerCase().includes(ql)) : items
    if (f.length) filteredCats[cat] = f
  }

  const Trend = ({ children }: { children: React.ReactNode }) => (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12.5, fontWeight: 700, padding: "5px 10px", borderRadius: 999, background: "var(--accent-soft)", color: "var(--accent-ink)" }}>
      <Icon d="M7 17L17 7|M9 7h8v8" size={12} />{children}
    </span>
  )
  const cardBox: React.CSSProperties = { background: "var(--surface)", borderRadius: 22, boxShadow: "var(--shadow-md)" }

  return (
    <div className="dss-fade dss-scroll" style={{ padding: "26px 30px 60px" }}>
      {/* top bar */}
      <TopBar title="Overview" actions={onPublish ? <DarkPill onClick={onPublish}><Icon d={ICONS.github || "M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"} size={15} />Publicar no GitHub</DarkPill> : undefined} />

      {/* row 1: Sistema (1fr) + Variantes por componente (360px) */}
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 360px", gap: 20 }}>
        {/* Sistema */}
        <div style={{ ...cardBox, padding: 24 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
            <div style={{ fontSize: 19, fontWeight: 700, letterSpacing: "-0.02em" }}>Sistema</div>
            <span className="dss-mono" style={{ fontSize: 11, color: "var(--ink-subtle)", border: "1px solid var(--hairline)", borderRadius: 999, padding: "6px 12px" }}>{project}</span>
          </div>
          <StatTray cols={2}>
            <StatCard icon={ICONS.grid} label="Componentes" value={registry.length} trend={`${catCount} cat.`} sub={`${interactive} interativo(s)`} />
            <StatCard icon={TOKEN_IC} label="Tokens" value={tokenCount} trend={`${totalVariants} var.`} sub="cobertura do sistema" />
          </StatTray>
          <div style={{ marginTop: 26 }}>
            <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: "-0.02em", marginBottom: 4 }}>{registry.length} componentes prontos</div>
            <div style={{ fontSize: 14, color: "var(--ink-muted)", marginBottom: 22 }}>Extraídos do Figma e documentados pelo DS Studio.</div>
            <div style={{ display: "flex", gap: 18, flexWrap: "wrap" }}>
              {thumbs.map(c => <ComponentThumbnail key={c.name} entry={c} onClick={() => onOpen(c.name)} />)}
              <button className="dss-btn" onClick={onFoundations} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, background: "none", border: "none", cursor: "pointer" }}>
                <div style={{ width: 72, height: 72, borderRadius: "50%", border: "1.5px solid var(--hairline-strong)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--ink)" }}><Icon d="M5 12h14|M13 6l6 6-6 6" size={20} /></div>
                <span style={{ fontSize: 13, fontWeight: 600, color: "var(--ink-muted)" }}>Ver tudo</span>
              </button>
            </div>
          </div>
        </div>

        {/* Variantes por componente */}
        <div style={{ ...cardBox, padding: 24, display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <div style={{ fontSize: 19, fontWeight: 700, letterSpacing: "-0.02em" }}>Variantes por componente</div>
            <span className="dss-mono" style={{ fontSize: 11, color: "var(--ink-subtle)", border: "1px solid var(--hairline)", borderRadius: 999, padding: "6px 12px" }}>{totalVariants} total</span>
          </div>
          <div style={{ position: "relative", height: 230, flex: 1, marginTop: 8 }}>
            <div className="dss-display" style={{ position: "absolute", left: 2, bottom: 4, fontSize: 60, fontWeight: 800, letterSpacing: "-0.04em", color: "var(--surface-3)", lineHeight: 1, zIndex: 0 }}>{totalVariants}</div>
            <div style={{ position: "relative", zIndex: 1, height: "100%", display: "flex", alignItems: "flex-end", gap: 8, paddingLeft: 80 }}>
              {barComps.map((c, i) => {
                const v = c.variants?.length || 1
                const h = Math.max(22, Math.round((v / maxV) * 100))
                const hi = i === maxIdx
                return (
                  <div key={c.name} onClick={() => onOpen(c.name)} title={`${c.displayName}: ${v}`} style={{ flex: 1, height: `${h}%`, borderRadius: "12px 12px 8px 8px", cursor: "pointer", position: "relative", background: hi ? "linear-gradient(180deg,#43DA86,#21B26B)" : "var(--surface-3)", boxShadow: hi ? "0 10px 24px -8px rgba(33,178,107,.55)" : "none" }}>
                    {hi && <div className="dss-display" style={{ position: "absolute", top: -32, left: "50%", transform: "translateX(-50%)", background: "var(--ink)", color: "var(--surface)", fontSize: 12, fontWeight: 700, padding: "5px 10px", borderRadius: 9, whiteSpace: "nowrap" }}>{v} variantes</div>}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>

      {/* row 2: 3 colunas iguais — Componentes por grupo · Recentes · Atividade */}
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr) minmax(0,1fr)", gap: 20, marginTop: 20 }}>
        {/* col 1 — Componentes por grupo */}
        <div>
          {Object.keys(filteredCats).length === 0
            ? <div style={{ ...cardBox, padding: "44px 0", textAlign: "center", color: "var(--ink-subtle)", fontSize: 14 }}>Nenhum componente encontrado para "{q}".</div>
            : <CatalogTable cats={filteredCats} expandAll={!!ql} onOpen={onOpen} />}
        </div>

        {/* col 2 — Componentes recentes */}
        <div style={{ ...cardBox, padding: 22 }}>
          <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: "-0.02em", marginBottom: 8 }}>Componentes recentes</div>
          <div>
            {recents.map(c => <ComponentRow key={c.name} entry={c} onClick={() => onOpen(c.name)} size="lg" />)}
          </div>
          <div style={{ marginTop: 8 }}><GhostPillBtn onClick={onFoundations}>Todos os componentes</GhostPillBtn></div>
        </div>

        {/* col 3 — Atividade */}
        <div style={{ ...cardBox, padding: 22 }}>
          <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: "-0.02em", marginBottom: 10 }}>Atividade</div>
          {activity.map((c, i) => <ActivityRow key={c.name} entry={c} first={i===0} onClick={() => onOpen(c.name)} />)}
          <DSBadge style={{ marginTop: 16 }} />
        </div>
      </div>
    </div>
  )
}

// ─── Foundations page (getdesign.md-style numbered sections) ─────────────────
// Tabela de cor com colunas explicativas (referência: spec sheets de DS — Color/Name/Hex/RGB/Var)
const COLOR_COLS = "44px minmax(0,1.1fr) 96px 130px minmax(0,1.5fr)"
const hexToRgb = (hex: string): string | null => {
  const m = /^#?([0-9a-f]{6})$/i.exec((hex || "").trim())
  if (!m) return null
  const n = parseInt(m[1], 16)
  return "(" + ((n >> 16) & 255) + "/" + ((n >> 8) & 255) + "/" + (n & 255) + ")"
}
const tokenToCssVar = (name: string) => "--" + (name || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")

function CopyCell({ text }: { text: string | null }) {
  const [c, setC] = useState(false)
  if (!text) return <span className="dss-mono" style={{ fontSize: 12, color: "var(--ink-subtle)" }}>—</span>
  return (
    <button className="dss-btn" title={"Copiar " + text}
      onClick={() => { try { navigator.clipboard.writeText(text); setC(true); setTimeout(() => setC(false), 1100) } catch {} }}
      style={{ background: "none", border: "none", padding: 0, cursor: "pointer", textAlign: "left", fontFamily: "var(--font-mono)", fontSize: 12, color: c ? "var(--accent-ink)" : "var(--ink-muted)", fontWeight: c ? 700 : 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
      {c ? "copiado ✓" : text}
    </button>
  )
}

function ColorRow({ t }: { t: TokenEntry }) {
  const val = formatTokenValue(t.value)
  const short = t.name.split("/").pop() || t.name
  return (
    <div className="dss-navitem" style={{ display: "grid", gridTemplateColumns: COLOR_COLS, gap: 14, alignItems: "center", padding: "10px 14px", borderTop: "1px solid var(--hairline)" }}>
      <span style={{ width: 34, height: 34, borderRadius: "50%", background: val, border: "1px solid var(--hairline-strong)" }} />
      <span style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={t.name}>{short}</span>
      <CopyCell text={val} />
      <CopyCell text={hexToRgb(val)} />
      <CopyCell text={tokenToCssVar(t.name)} />
    </div>
  )
}

function DimRow({ t, max }: { t: TokenEntry; max: number }) {
  const n = tokenNum(t)
  const alias = isAliasValue(t.value)
  const val = alias ? "alias" : formatTokenValue(t.value)
  const [copied, setCopied] = useState(false)
  const copy = () => { if (alias) return; try { navigator.clipboard.writeText(val); setCopied(true); setTimeout(() => setCopied(false), 1200) } catch {} }
  return (
    <button className="dss-btn" onClick={copy} title={alias ? "Alias não resolvido — republique o componente com o plugin atualizado" : "Copiar " + val}
      style={{ display: "flex", alignItems: "center", gap: 16, padding: "10px 0", width: "100%", background: "none", border: "none", borderBottom: "1px solid var(--hairline)", cursor: alias ? "default" : "pointer", fontFamily: "var(--font-sans)", textAlign: "left", opacity: alias ? .6 : 1 }}>
      <span style={{ width: 200, flexShrink: 0, display: "flex", alignItems: "baseline", gap: 6, minWidth: 0 }}>
        <span className="dss-mono" style={{ fontSize: 12.5, color: "var(--ink)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t.name.split("/").pop()}</span>
        {t.aliasOf && <span className="dss-mono" style={{ fontSize: 9.5, color: "var(--ink-subtle)", whiteSpace: "nowrap" }}>via {t.aliasOf.split("/").pop()}</span>}
      </span>
      <span className="dss-mono" style={{ fontSize: 12, color: copied ? "var(--accent-ink)" : alias ? "var(--ink-subtle)" : "var(--ink-muted)", width: 74, flexShrink: 0, fontWeight: copied ? 700 : alias ? 500 : 600, fontStyle: alias ? "italic" : "normal" }}>{copied ? "copiado ✓" : val}</span>
      <div style={{ flex: 1, height: 14 }}>
        {n !== null && <div style={{ width: `${Math.max((n / max) * 100, 3)}%`, height: "100%", background: "var(--accent)", opacity: .85, borderRadius: 4 }} />}
      </div>
    </button>
  )
}

const TYPE_SCALE = [
  ["display", 56, 600, "-0.03em", "var(--font-display)"],
  ["headline", 32, 600, "-0.02em", "var(--font-display)"],
  ["title", 22, 600, "-0.01em", "var(--font-sans)"],
  ["body-lg", 18, 400, "0", "var(--font-sans)"],
  ["body", 15, 400, "0", "var(--font-sans)"],
  ["caption", 13, 400, "0", "var(--font-sans)"],
  ["mono", 13, 500, "0", "var(--font-mono)"],
] as const

function FoundationsPage({ registry, onExport, section, onSection, varsMap, tokensOverride }: { registry: RegistryEntry[]; onExport: () => void; section?: string; onSection?: (slug: string) => void; varsMap?: VarsMap | null; tokensOverride?: TokenEntry[] }) {
  const f = useMemo(() => aggregateTokens(registry, varsMap, tokensOverride), [registry, varsMap, tokensOverride])
  useEffect(() => {
    if (!section) return
    const t = setTimeout(() => {
      const el = document.getElementById("fnd-" + section)
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" })
    }, 60)
    return () => clearTimeout(t)
  }, [section])
  const maxSpace = Math.max(...f.spacing.map(t => tokenNum(t) ?? 0), 1)
  const maxRad = Math.max(...f.radius.map(t => tokenNum(t) ?? 0), 1)
  const aliasNote = (list: TokenEntry[]) => {
    const n = list.filter(t => isAliasValue(t.value)).length
    if (!n) return null
    return <div className="dss-mono" style={{ marginTop: 10, fontSize: 10.5, color: "var(--ink-subtle)" }}>{n} token(s) ainda em alias — publique qualquer componente com o plugin atualizado: ele gera o /variables.json e resolve todo o histórico de uma vez.</div>
  }
  const colorGroups = useMemo(() => {
    const g: Record<string, TokenEntry[]> = {}
    f.colors.slice(0, 96).forEach(t => {
      const parts = t.name.split("/")
      const grp = parts.length > 1 ? parts.slice(0, -1).join(" / ") : "Geral"
      ;(g[grp] ||= []).push(t)
    })
    return g
  }, [f.colors])
  const [colorTab, setColorTab] = useState<string | null>(null)
  const colorGroupKeys = Object.keys(colorGroups)
  const activeColorGroup = (colorTab && colorGroups[colorTab]) ? colorTab : colorGroupKeys[0]
  return (
    <div className="dss-fade dss-scroll" style={{ padding: "26px 30px 60px" }}>
      <TopBar title="Styles" actions={<>
        <DarkPill onClick={onExport}><Icon d={ICONS.download} size={16} />DESIGN.md</DarkPill>
        <IconCircle href={REPO_HREF} title="Repositório" d={ICONS.external} />
      </>} />
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        {/* Visão geral — dash numérica dos Styles (tiles clicáveis → seção) */}
        <div style={{ ...PANEL, padding: 24 }}>
          <PanelHead title="Visão geral" right={<CountChip>{f.colors.length + TYPE_SCALE.length + f.spacing.length + f.radius.length + f.stroke.length + 3} tokens</CountChip>} />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12 }}>
            {[
              { slug: "cores", label: "Cores", n: f.colors.length, sub: "paleta resolvida" },
              { slug: "tipografia", label: "Tipografia", n: TYPE_SCALE.length, sub: "estilos de texto" },
              { slug: "espacamento", label: "Espaçamento", n: f.spacing.length, sub: "passos da escala" },
              { slug: "radius", label: "Radius", n: f.radius.length, sub: "raios de canto" },
              { slug: "stroke", label: "Stroke", n: f.stroke.length, sub: "espessuras" },
              { slug: "elevacao", label: "Elevação", n: 3, sub: "níveis de sombra" },
            ].filter(t => t.n > 0).map(t => (
              <button key={t.slug} className="dss-btn dss-navitem" onClick={() => onSection && onSection(t.slug)}
                style={{ background: "var(--surface-2)", border: "1px solid var(--hairline)", borderRadius: 16, padding: "16px 18px", textAlign: "left", cursor: "pointer", fontFamily: "var(--font-sans)" }}>
                <div className="dss-mono" style={{ fontSize: 10, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--ink-subtle)", marginBottom: 8 }}>{t.label}</div>
                <div className="dss-display" style={{ fontSize: 34, fontWeight: 800, letterSpacing: "-0.035em", lineHeight: 1, color: "var(--ink)" }}>{t.n}</div>
                <div style={{ fontSize: 11, color: "var(--ink-muted)", marginTop: 8, display: "flex", alignItems: "center", gap: 4 }}>{t.sub} <Icon d="M9 6l6 6-6 6" size={10} /></div>
              </button>
            ))}
          </div>
        </div>

        <div style={{ ...PANEL, padding: 24 }}>
          <span id="fnd-cores" style={{ display: "block", scrollMarginTop: 20 }} /><PanelHead title="Paleta de cor" right={<CountChip>{f.colors.length}</CountChip>} />
          {f.colors.length ? (
            <>
              {colorGroupKeys.length > 1 && (
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
                  {colorGroupKeys.map(grp => {
                    const on = grp === activeColorGroup
                    return (
                      <button key={grp} className="dss-btn" onClick={() => setColorTab(grp)}
                        style={{ display: "inline-flex", alignItems: "center", gap: 7, border: "1px solid " + (on ? "var(--primary)" : "var(--hairline)"), borderRadius: 999, padding: "7px 14px", fontSize: 12.5, fontWeight: 600, cursor: "pointer", fontFamily: "var(--font-sans)", background: on ? "var(--primary)" : "var(--surface)", color: on ? "var(--on-primary)" : "var(--ink-muted)" }}>
                        {grp}
                        <span className="dss-mono" style={{ fontSize: 10, padding: "1px 7px", borderRadius: 999, background: on ? "rgba(255,255,255,.18)" : "var(--surface-3)", color: on ? "var(--on-primary)" : "var(--ink-subtle)" }}>{colorGroups[grp].length}</span>
                      </button>
                    )
                  })}
                </div>
              )}
              <div style={{ border: "1px solid var(--hairline)", borderRadius: 16, overflow: "hidden", background: "var(--surface)" }}>
                <div style={{ display: "grid", gridTemplateColumns: COLOR_COLS, gap: 14, padding: "9px 14px", background: "var(--surface-2)" }}>
                  {["Color", "Name", "Hex", "RGB", "Var"].map(h => (
                    <span key={h} className="dss-mono" style={{ fontSize: 10, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--ink-subtle)", fontWeight: 600 }}>{h}</span>
                  ))}
                </div>
                {(colorGroups[activeColorGroup] || []).map((t, i) => <ColorRow key={t.name + i} t={t} />)}
              </div>
              {f.colors.length > 96 && (
                <div className="dss-mono" style={{ marginTop: 10, fontSize: 10.5, color: "var(--ink-subtle)" }}>+{f.colors.length - 96} tokens não exibidos no total</div>
              )}
            </>
          ) : <Empty>Nenhum token de cor resolvido. Aliases de variável precisam ser resolvidos na extração.</Empty>}
        </div>

        <div style={{ ...PANEL, padding: 24 }}>
          <span id="fnd-tipografia" style={{ display: "block", scrollMarginTop: 20 }} /><PanelHead title="Escala tipográfica" right={<CountChip>{TYPE_SCALE.length}</CountChip>} />
          <div style={{ border: "1px solid var(--hairline)", borderRadius: 16, overflow: "hidden" }}>
            {TYPE_SCALE.map(([name, size, weight, ls, fam], i) => (
              <div key={name} style={{ display: "flex", alignItems: "baseline", gap: 24, padding: "16px 20px", borderBottom: i < TYPE_SCALE.length - 1 ? "1px solid var(--hairline)" : "none", background: "var(--surface)" }}>
                <span className="dss-mono" style={{ fontSize: 11, color: "var(--ink-subtle)", width: 168, flexShrink: 0 }}>{name} · {size}px · {weight}</span>
                <span style={{ fontFamily: fam as string, fontSize: Math.min(size as number, 40), fontWeight: weight as number, letterSpacing: ls as string, color: "var(--ink)", lineHeight: 1.1 }}>Aa Bb Cc 123</span>
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
          <div style={{ ...PANEL, padding: 24 }}>
            <span id="fnd-espacamento" style={{ display: "block", scrollMarginTop: 20 }} /><PanelHead title="Espaçamento" right={<CountChip>{f.spacing.length}</CountChip>} />
            {f.spacing.length ? <>{f.spacing.map((t, i) => <DimRow key={i} t={t} max={maxSpace} />)}{aliasNote(f.spacing)}</> : <Empty>Sem tokens de espaçamento.</Empty>}
          </div>
          <div style={{ ...PANEL, padding: 24 }}>
            <span id="fnd-radius" style={{ display: "block", scrollMarginTop: 20 }} /><PanelHead title="Radius" right={<CountChip>{f.radius.length}</CountChip>} />
            {f.radius.length ? <>{f.radius.map((t, i) => <DimRow key={i} t={t} max={maxRad} />)}{aliasNote(f.radius)}</> : <Empty>Sem tokens de radius.</Empty>}
          </div>
        </div>

        {f.stroke.length > 0 && (
          <div style={{ ...PANEL, padding: 24 }}>
            <span id="fnd-stroke" style={{ display: "block", scrollMarginTop: 20 }} /><PanelHead title="Stroke" right={<CountChip>{f.stroke.length}</CountChip>} />
            {f.stroke.map((t, i) => <DimRow key={i} t={t} max={Math.max(...f.stroke.map(x => tokenNum(x) ?? 0), 1)} />)}{aliasNote(f.stroke)}
          </div>
        )}

        <div style={{ ...PANEL, padding: 24 }}>
          <span id="fnd-elevacao" style={{ display: "block", scrollMarginTop: 20 }} /><PanelHead title="Elevação" />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 20 }}>
            {["--shadow-sm", "--shadow-md", "--shadow-lg"].map((s, i) => (
              <div key={s} style={{ height: 96, borderRadius: 16, background: "var(--surface)", border: "1px solid var(--hairline)", boxShadow: `var(${s})`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <span style={{ textAlign: "center" }}>
                  <span className="dss-mono" style={{ display: "block", fontSize: 12, fontWeight: 700, color: "var(--ink)" }}>{s.replace("--", "")}</span>
                  <span className="dss-mono" style={{ display: "block", fontSize: 10, color: "var(--ink-subtle)", marginTop: 4 }}>{["chips e controles", "painéis bento", "hover de card"][i]}</span>
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div style={{ padding: "20px 22px", border: "1px dashed var(--hairline-strong)", borderRadius: 12, fontSize: 13, color: "var(--ink-subtle)", lineHeight: 1.5 }}>{children}</div>
}

// ─── DESIGN.md export modal ──────────────────────────────────────────────────
function DesignMdModal({ registry, onClose }: { registry: RegistryEntry[]; onClose: () => void }) {
  const md = useMemo(() => generateDesignMd(registry), [registry])
  const download = () => {
    const blob = new Blob([md], { type: "text/markdown" }); const url = URL.createObjectURL(blob)
    const a = document.createElement("a"); a.href = url; a.download = "DESIGN.md"; a.click(); URL.revokeObjectURL(url)
  }
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.5)", backdropFilter: "blur(6px)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div onClick={e => e.stopPropagation()} className="dss-fade" style={{ background: "var(--surface)", borderRadius: 18, width: "100%", maxWidth: 720, maxHeight: "86vh", display: "flex", flexDirection: "column", boxShadow: "var(--shadow-lg)", border: "1px solid var(--hairline)" }}>
        <div style={{ padding: "20px 24px", borderBottom: "1px solid var(--hairline)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <h2 className="dss-display" style={{ fontSize: 22, fontWeight: 600, margin: 0 }}>DESIGN.md</h2>
              <p style={{ fontSize: 13, color: "var(--ink-muted)", margin: "4px 0 0" }}>Cole no seu agente de IA (Claude Code, Cursor) como referência do design system.</p>
            </div>
            <button className="dss-btn" onClick={onClose} style={{ border: "none", background: "var(--surface-2)", borderRadius: 8, width: 32, height: 32, cursor: "pointer", color: "var(--ink-muted)", fontSize: 16 }}>✕</button>
          </div>
          <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
            <button className="dss-btn dss-cta" onClick={download} style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "9px 16px", borderRadius: 999, border: "none", background: "var(--primary)", color: "var(--on-primary)", fontSize: 13, fontWeight: 600, fontFamily: "var(--font-sans)" }}><Icon d={ICONS.download} size={14} />Baixar DESIGN.md</button>
            <CopyBtn text={md} label="Copiar tudo" />
          </div>
        </div>
        <pre className="dss-mono dss-scroll" style={{ margin: 0, padding: "18px 24px", fontSize: 12, lineHeight: 1.6, color: "var(--ink)", overflow: "auto", whiteSpace: "pre-wrap" }}>{md}</pre>
      </div>
    </div>
  )
}

// ─── Insights ────────────────────────────────────────────────────────────────
function InsightsPage({ registry }: { registry: RegistryEntry[] }) {
  const byCat: Record<string, number> = {}
  registry.forEach(c => { byCat[c.category || "Components"] = (byCat[c.category || "Components"] || 0) + 1 })
  const interactive = registry.filter(isInteractive).length
  const withDims = registry.filter(c => c.width && c.height).length
  const totalVariants = registry.reduce((s, c) => s + c.variants.length, 0)
  const stats: [string, number][] = [["Componentes", registry.length], ["Variantes", totalVariants], ["Interativos", interactive], ["Com dimensões", withDims]]
  const cats = Object.entries(byCat).sort((a, b) => b[1] - a[1])
  const maxCat = Math.max(...Object.values(byCat), 1)
  return (
    <div className="dss-fade dss-scroll" style={{ padding: "26px 30px 60px" }}>
      <TopBar title="Insights" actions={<IconCircle href={REPO_HREF} title="Repositório" d={ICONS.external} />} />
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <div style={{ ...PANEL, padding: 24 }}>
          <PanelHead title="Saúde do sistema" right={<CountChip>{registry.length} componentes</CountChip>} />
          <StatTray cols={4}>
            {stats.map(([k, v]) => <StatCard key={k} label={k} value={v} />)}
          </StatTray>
        </div>

        <div style={{ ...PANEL, padding: 24 }}>
          <PanelHead title="Por categoria" right={<CountChip>{cats.length} grupos</CountChip>} />
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {cats.map(([cat, n]) => (
              <div key={cat} style={{ display: "flex", alignItems: "center", gap: 16 }}>
                <span style={{ fontSize: 13.5, fontWeight: 500, color: "var(--ink)", width: 220, flexShrink: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{cat}</span>
                <span style={{ flex: 1, height: 8, borderRadius: 999, background: "var(--surface-3)", overflow: "hidden" }}>
                  <span style={{ display: "block", width: `${Math.max(5, (n / maxCat) * 100)}%`, height: "100%", borderRadius: 999, background: "linear-gradient(90deg,#43DA86,#21B26B)" }} />
                </span>
                <span className="dss-mono" style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)", width: 36, textAlign: "right", flexShrink: 0 }}>{n}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Component tab: Canvas (interactive playground) ──────────────────────────
// ─── HistoryTab (E9) — versionamento & changelog por componente ──────────────
function HistoryTab({ entry }: { entry: RegistryEntry }) {
  const log = entry.changelog && entry.changelog.length
    ? entry.changelog
    : [{ version: entry.version, date: entry.publishedAt, summary: "Versão atual publicada.", changes: [] as string[] }]
  const sorted = [...log].sort((a, b) => {
    const ta = a.date ? new Date(a.date).getTime() : 0
    const tb = b.date ? new Date(b.date).getTime() : 0
    if (ta !== tb) return tb - ta
    return cmpSemver(b.version, a.version)
  })
  return (
    <div style={{ padding: "26px 32px 60px", maxWidth: 760 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, letterSpacing: "-0.02em", margin: 0 }}>Histórico de versões</h2>
        <span className="dss-mono" style={{ fontSize: 11, color: "var(--ink-subtle)", border: "1px solid var(--hairline)", borderRadius: 999, padding: "5px 11px" }}>{sorted.length} versão(ões)</span>
      </div>
      <p style={{ fontSize: 14, color: "var(--ink-muted)", marginTop: 0, marginBottom: 26 }}>
        Evolução do componente, sincronizada do Figma a cada publicação pelo DS Studio.
      </p>
      {!entry.changelog?.length && (
        <div style={{ background: "var(--surface-2)", border: "1px solid var(--hairline)", borderRadius: 14, padding: "14px 16px", marginBottom: 24, fontSize: 13, color: "var(--ink-muted)" }}>
          Ainda sem changelog detalhado. As próximas publicações pelo plugin gravam <span className="dss-mono">component-meta/{entry.name}.json</span> com data, autor e o que mudou.
        </div>
      )}
      <div style={{ position: "relative", paddingLeft: 28 }}>
        <div style={{ position: "absolute", left: 9, top: 6, bottom: 6, width: 2, background: "var(--hairline)" }} />
        {sorted.map((c, i) => (
          <div key={c.version + i} style={{ position: "relative", marginBottom: 22 }}>
            <div style={{ position: "absolute", left: -23, top: 4, width: 12, height: 12, borderRadius: "50%", background: i === 0 ? "var(--accent)" : "var(--surface)", border: "2px solid " + (i === 0 ? "var(--accent)" : "var(--hairline-strong)"), boxShadow: i === 0 ? "0 0 0 4px var(--accent-soft)" : "none" }} />
            <div style={{ ...({ background: "var(--surface)", borderRadius: 16, boxShadow: "var(--shadow-sm)" }), border: "1px solid var(--hairline)", padding: "16px 18px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <span className="dss-mono" style={{ fontSize: 13, fontWeight: 700, background: i === 0 ? "var(--accent-soft)" : "var(--surface-2)", color: i === 0 ? "var(--accent-ink)" : "var(--ink)", padding: "3px 10px", borderRadius: 999 }}>v{c.version}</span>
                {i === 0 && <Pill variant="stable" size="sm">atual</Pill>}
                {c.author && <span style={{ fontSize: 12.5, color: "var(--ink-muted)" }}>{c.author}</span>}
                {c.date && <span className="dss-mono" style={{ fontSize: 11, color: "var(--ink-subtle)", marginLeft: "auto" }}>{timeAgo(c.date)}</span>}
              </div>
              {c.summary && <div style={{ fontSize: 14, color: "var(--ink)", marginTop: 10, lineHeight: 1.5 }}>{c.summary}</div>}
              {c.changes && c.changes.length > 0 && (
                <ul style={{ margin: "10px 0 0", paddingLeft: 18, fontSize: 13.5, color: "var(--ink-muted)", lineHeight: 1.7 }}>
                  {c.changes.map((ch, j) => <li key={j}>{ch}</li>)}
                </ul>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function cmpSemver(a: string, b: string): number {
  const pa = String(a).replace(/^v/, "").split(".").map(n => parseInt(n, 10) || 0)
  const pb = String(b).replace(/^v/, "").split(".").map(n => parseInt(n, 10) || 0)
  for (let i = 0; i < 3; i++) { if ((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) - (pb[i] || 0) }
  return 0
}


function CanvasTab({ entry }: { entry: RegistryEntry }) {
  const propMap = useMemo(() => {
    const m: Record<string, Set<string>> = {}
    for (const v of entry.variants) for (const [k, val] of Object.entries(v.props || {})) { (m[k] ||= new Set()); if (val != null) m[k].add(String(val)) }
    // Controles de ESTADO: State (Disabled/Selected/Loading) não vira carta na
    // galeria (é comportamental), mas o Canvas precisa alcançá-lo. Detecta pela
    // fonte quais estados o componente honra e adiciona um toggle false/true —
    // o componente aceita esses props/atributos diretamente (disabled nativo,
    // aria-selected como atributo, loading como prop). Assim as ~180 combinações
    // são todas exploráveis aqui, sem quebrar a galeria com cartas vazias.
    const src = entry.source || ""
    const addStateBool = (name: string, present: boolean) => { if (present && !m[name]) m[name] = new Set(["false", "true"]) }
    addStateBool("disabled", /\bdisabled\b/.test(src))
    addStateBool("loading", /\bloading\b/.test(src))
    addStateBool("aria-selected", /aria-selected/.test(src))
    return Object.entries(m).map(([name, vs]) => ({ name, values: Array.from(vs) }))
  }, [entry.name])
  const init = () => { const s: Record<string, string> = {}; for (const p of propMap) s[p.name] = p.values[0] || ""; return s }
  const [sel, setSel] = useState<Record<string, string>>(init)
  const [bg, setBg] = useState("checker")
  const [zoom, setZoom] = useState(1)
  const [nonce, setNonce] = useState(0)
  useEffect(() => { setSel(init()); setNonce(n => n + 1) }, [entry.name]) // eslint-disable-line

  const liveProps = useMemo(() => {
    const p: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(sel)) {
      if (v === "true") p[k] = true; else if (v === "false") p[k] = false
      else if (!isNaN(Number(v)) && v !== "") p[k] = Number(v); else p[k] = v
    }
    return heroProps(entry, p)
  }, [sel, entry.name])

  const C = entry.Component
  const bgStyle: Record<string, React.CSSProperties> = {
    surface: { background: "var(--surface)" },
    checker: { backgroundImage: "linear-gradient(45deg,var(--checker) 25%,transparent 25%),linear-gradient(-45deg,var(--checker) 25%,transparent 25%),linear-gradient(45deg,transparent 75%,var(--checker) 75%),linear-gradient(-45deg,transparent 75%,var(--checker) 75%)", backgroundSize: "16px 16px", backgroundPosition: "0 0,0 8px,8px -8px,-8px 0", background: "var(--surface)" },
    dark: { background: "#0a0a0b" },
  }
  return (
    <div className="dss-fade" style={{ padding: 28 }}>
      {isInteractive(entry) && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16, padding: "10px 14px", borderRadius: 10, background: "var(--accent-soft)", color: "var(--accent-ink)", fontSize: 13 }}>
          <Icon d={ICONS.bolt} size={15} /><strong>Interativo</strong> — clique no componente para alternar o estado, ou use os controles abaixo.
        </div>
      )}
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 14px", border: "1px solid var(--hairline)", borderBottom: "none", borderRadius: "12px 12px 0 0", background: "var(--surface-2)" }}>
        {[["surface", "Sólido"], ["checker", "Grade"], ["dark", "Escuro"]].map(([b, lbl]) => (
          <button key={b} className="dss-btn" onClick={() => setBg(b)} style={{ padding: "4px 11px", borderRadius: 7, border: bg === b ? "1.5px solid var(--accent)" : "1.5px solid transparent", background: bg === b ? "var(--accent-soft)" : "transparent", fontSize: 12, color: bg === b ? "var(--accent-ink)" : "var(--ink-muted)", fontWeight: bg === b ? 600 : 400, fontFamily: "var(--font-sans)" }}>{lbl}</button>
        ))}
        <span style={{ width: 1, height: 18, background: "var(--hairline)", margin: "0 4px" }} />
        {[0.5, 1, 1.5, 2].map(z => <button key={z} className="dss-btn dss-mono" onClick={() => setZoom(z)} style={{ fontSize: 11, padding: "4px 8px", borderRadius: 6, border: "none", background: zoom === z ? "var(--ink)" : "transparent", color: zoom === z ? "var(--canvas)" : "var(--ink-subtle)", fontWeight: 600 }}>{z}×</button>)}
        {entry.width && entry.height && <span className="dss-mono" style={{ marginLeft: "auto", fontSize: 11, color: "var(--ink-subtle)" }}>{entry.width}×{entry.height}px</span>}
      </div>
      <div style={{ ...bgStyle[bg], minHeight: 280, display: "flex", alignItems: "center", justifyContent: "center", padding: 40, border: "1px solid var(--hairline)", overflow: "auto" }}>
        <div key={nonce} style={{ transform: `scale(${zoom})`, transformOrigin: "center", flexShrink: 0 }}><C {...liveProps} /></div>
      </div>
      {propMap.length > 0 && (
        <div style={{ border: "1px solid var(--hairline)", borderTop: "none", borderRadius: "0 0 12px 12px", overflow: "hidden" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 16px", background: "var(--surface-2)" }}>
            <span className="dss-mono" style={{ fontSize: 11, fontWeight: 600, color: "var(--ink-muted)", letterSpacing: ".08em", textTransform: "uppercase" }}>Controls</span>
            <button className="dss-btn" onClick={() => { setSel(init()); setNonce(n => n + 1) }} style={{ fontSize: 11, color: "var(--ink-muted)", background: "transparent", border: "1px solid var(--hairline)", borderRadius: 6, padding: "3px 10px", fontFamily: "var(--font-sans)" }}>Reset</button>
          </div>
          {propMap.map((p, i) => (
            <div key={p.name} style={{ display: "flex", alignItems: "center", gap: 16, padding: "11px 16px", borderTop: "1px solid var(--hairline)", background: "var(--surface)" }}>
              <span className="dss-mono" style={{ fontSize: 12.5, fontWeight: 600, color: "var(--ink)", width: 160 }}>{p.name}</span>
              <select value={sel[p.name] || p.values[0]} onChange={e => { setSel(s => ({ ...s, [p.name]: e.target.value })); setNonce(n => n + 1) }}
                className="dss-mono" style={{ fontSize: 12, padding: "6px 10px", borderRadius: 7, border: "1px solid var(--hairline-strong)", background: "var(--surface)", color: "var(--ink)", cursor: "pointer" }}>
                {p.values.map(v => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Preview (variant gallery) ───────────────────────────────────────────────
// FitScale: mede o filho e escala pra caber na LARGURA disponível (preserva proporção,
// reserva a altura escalada). Usa ResizeObserver + polling curto pro post assíncrono do iframe.
function FitScale({ children, maxScale = 1 }: { children: React.ReactNode; maxScale?: number }) {
  const outerRef = useRef<HTMLDivElement>(null)
  const innerRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)
  const [dims, setDims] = useState<{ w: number; h: number } | null>(null)
  useEffect(() => {
    const outer = outerRef.current, inner = innerRef.current
    if (!outer || !inner) return
    const measure = () => {
      const avail = outer.clientWidth
      const nw = inner.offsetWidth, nh = inner.offsetHeight
      if (avail > 0 && nw > 0 && nh > 0) {
        const s = Math.min(maxScale, avail / nw)
        setScale(s); setDims({ w: Math.round(nw * s), h: Math.round(nh * s) })
      }
    }
    measure()
    let ro: any = null
    if (typeof ResizeObserver !== "undefined") { ro = new ResizeObserver(measure); ro.observe(outer); ro.observe(inner) }
    const iv = setInterval(measure, 350); const stop = setTimeout(() => clearInterval(iv), 4000)
    return () => { if (ro) ro.disconnect(); clearInterval(iv); clearTimeout(stop) }
  }, [maxScale])
  return (
    <div ref={outerRef} style={{ width: "100%", display: "flex", justifyContent: "center" }}>
      <div style={{ width: dims ? dims.w : "auto", height: dims ? dims.h : "auto", overflow: "hidden" }}>
        <div ref={innerRef} style={{ transform: "scale(" + scale + ")", transformOrigin: "top left", display: "inline-block" }}>
          {children}
        </div>
      </div>
    </div>
  )
}

function PreviewTab({ entry }: { entry: RegistryEntry }) {
  const C = entry.Component
  return (
    <div className="dss-fade dss-scroll" style={{ padding: 28 }}>
      <SectionLabel>Todas as variantes · {entry.variants.length}</SectionLabel>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(260px,1fr))", gap: 16 }}>
        {entry.variants.map((v, i) => (
          <div key={i} style={{ border: "1px solid var(--hairline)", borderRadius: 14, overflow: "hidden", background: "var(--surface)" }}>
            <div style={{ minHeight: 130, display: "flex", alignItems: "center", justifyContent: "center", padding: 24, background: "var(--surface-2)", borderBottom: "1px solid var(--hairline)" }}>
              <FitScale>
                <div style={{ pointerEvents: isInteractive(entry) ? "auto" : "none" }}>
                  {(() => { try { return <C {...heroProps(entry, v.props)} /> } catch { return <span style={{ color: "var(--ink-subtle)", fontSize: 12 }}>erro</span> } })()}
                </div>
              </FitScale>
            </div>
            <div style={{ padding: "11px 14px" }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>{v.name}</div>
              {Object.keys(v.props || {}).length > 0 && <div className="dss-mono" style={{ fontSize: 10.5, color: "var(--ink-subtle)", marginTop: 4 }}>{Object.entries(v.props).map(([k, val]) => `${k}=${val}`).join(" · ")}</div>}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Variante gerada (usada no Compare) — render limpo: componente + rótulo ────
// (Removido o painel Visual Judge/Remedir do Compare a pedido — o comparativo
// visual lado-a-lado Figma × React é mais direto. A medição de fidelidade
// continua no plugin, como gate de geração + log no console.)
function GeneratedVariant({ entry, v, C }: { entry: RegistryEntry; v: Variant; C: React.ComponentType<Record<string, unknown>> }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 7, maxWidth: "100%" }}>
      <div style={{ pointerEvents: "none", maxWidth: "100%" }}>
        {(() => { try { return <C {...heroProps(entry, v.props)} /> } catch { return <span style={{ color: "var(--ink-subtle)", fontSize: 12 }}>—</span> } })()}
      </div>
      <div className="dss-mono" style={{ fontSize: 10, color: "var(--ink-subtle)", textAlign: "center", maxWidth: 220 }}>{v.name}</div>
    </div>
  )
}

// ─── Compare (Figma vs React) — lado React renderiza TODAS as variantes, não só
// a default: os bugs de fidelidade moram nas variantes, então a comparação
// precisa cobri-las. Lado Figma = snapshot do set (todas juntas). ──────────────
function CompareTab({ entry }: { entry: RegistryEntry }) {
  const C = entry.Component
  return (
    <div className="dss-fade dss-scroll" style={{ padding: 28, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, alignItems: "start" }}>
      <div>
        <SectionLabel>Figma · Design</SectionLabel>
        <div style={{ border: "1px solid var(--hairline)", borderRadius: 14, overflow: "hidden", background: "var(--surface-2)", minHeight: 220, display: "flex", alignItems: "center", justifyContent: "center", padding: 28 }}>
          <FigmaSnapshot entry={entry} />
        </div>
      </div>
      <div>
        <SectionLabel>React · Gerado · {entry.variants.length} variante{entry.variants.length === 1 ? "" : "s"}</SectionLabel>
        <div style={{ border: "1px solid var(--hairline)", borderRadius: 14, background: "var(--surface-2)", minHeight: 220, display: "flex", flexWrap: "wrap", gap: 20, alignItems: "flex-start", justifyContent: "center", padding: 24 }}>
          {entry.variants.map((v, i) => (
            <GeneratedVariant key={i} entry={entry} v={v} C={C} />
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Code ────────────────────────────────────────────────────────────────────
function CodeTab({ entry }: { entry: RegistryEntry }) {
  const importSnippet = `import { ${entry.name} } from "@/components/${entry.name}"`
  const usage = `<${entry.name}${Object.entries(entry.variants[0]?.props || {}).map(([k, v]) => ` ${k}={${typeof v === "string" ? `"${v}"` : v}}`).join("")} />`
  return (
    <div className="dss-fade dss-scroll" style={{ padding: 28, display: "flex", flexDirection: "column", gap: 24 }}>
      <div><SectionLabel>Importação & uso</SectionLabel><CodeBlock code={importSnippet + "\n\n" + usage} /></div>
      {entry.source && <div><SectionLabel>Código fonte · {entry.name}.tsx</SectionLabel><CodeBlock code={entry.source} /></div>}
    </div>
  )
}

// ─── Specs ───────────────────────────────────────────────────────────────────
function SpecsTab({ entry }: { entry: RegistryEntry }) {
  const tokens = entry.tokens || []
  return (
    <div className="dss-fade dss-scroll" style={{ padding: 28, maxWidth: 820 }}>
      <SectionLabel>Dimensões</SectionLabel>
      <div style={{ display: "flex", gap: 32, marginBottom: 40 }}>
        {[["Largura", entry.width], ["Altura", entry.height], ["Variantes", entry.variants.length]].map(([k, v]) => (
          <div key={k as string}>
            <div className="dss-display" style={{ fontSize: 30, fontWeight: 600, color: "var(--ink)" }}>{v ? (k === "Variantes" ? v : v + "px") : "—"}</div>
            <div className="dss-mono" style={{ fontSize: 11, color: "var(--ink-subtle)", textTransform: "uppercase", letterSpacing: ".08em", marginTop: 4 }}>{k as string}</div>
          </div>
        ))}
      </div>
      {tokens.length > 0 && (<>
        <SectionLabel>Tokens · {tokens.length}</SectionLabel>
        <div style={{ border: "1px solid var(--hairline)", borderRadius: 12, overflow: "hidden" }}>
          {tokens.map((t, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 16px", borderTop: i ? "1px solid var(--hairline)" : "none", background: "var(--surface)" }}>
              <span className="dss-mono" style={{ fontSize: 12, color: "var(--accent-ink)" }}>{t.name}</span>
              <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {isColorValue(t.value) && <span style={{ width: 16, height: 16, borderRadius: 5, background: formatTokenValue(t.value), border: "1px solid var(--hairline-strong)" }} />}
                <span className="dss-mono" style={{ fontSize: 12, color: "var(--ink-muted)" }}>{formatTokenValue(t.value)}</span>
              </span>
            </div>
          ))}
        </div>
      </>)}
    </div>
  )
}

// ─── AI doc tabs ─────────────────────────────────────────────────────────────
function DocShell({ status, error, refresh, children }: { status: DocStatus; error: string | null; refresh: () => void; children: React.ReactNode }) {
  if (status === "loading") return (
    <div style={{ padding: 80, textAlign: "center" }}>
      <div style={{ position: "relative", width: 120, height: 64, margin: "0 auto 18px", borderRadius: 10, border: "1px solid var(--hairline)", background: "var(--surface-2)", overflow: "hidden" }}>
        <div className="dss-scan" style={{ top: 0 }} />
      </div>
      <div className="dss-mono" style={{ fontSize: 12, color: "var(--ink-muted)", letterSpacing: ".04em" }}>Lendo documentação…</div>
    </div>
  )
  if (status === "error") return (
    <div style={{ padding: 40 }}>
      <div style={{ border: "1px solid var(--hairline)", borderRadius: 14, padding: "28px 32px", background: "var(--warn-soft)", maxWidth: 620 }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: "var(--warn)", marginBottom: 10 }}>Documentação não disponível</div>
        <p style={{ fontSize: 13, color: "var(--ink-muted)", whiteSpace: "pre-line", lineHeight: 1.6, margin: 0 }}>{error}</p>
        <button className="dss-btn" onClick={refresh} style={{ marginTop: 16, fontSize: 13, color: "var(--accent-ink)", background: "transparent", border: "1px solid var(--hairline-strong)", borderRadius: 8, padding: "7px 14px", fontFamily: "var(--font-sans)" }}>Verificar novamente</button>
      </div>
    </div>
  )
  return <div className="dss-fade dss-scroll">{children}</div>
}

const statusColor = (s: string) => /aprovado|pass/.test(s) ? "var(--ok)" : /reprovado|fail/.test(s) ? "var(--err)" : /revisar|review/.test(s) ? "var(--warn)" : "var(--ink-subtle)"
const statusIcon = (s: string) => /aprovado|pass/.test(s) ? "✓" : /reprovado|fail/.test(s) ? "✗" : /revisar|review/.test(s) ? "!" : "—"
const statusSoft = (s: string) => /aprovado|pass/.test(s) ? "var(--ok-soft)" : /reprovado|fail/.test(s) ? "var(--err-soft)" : /revisar|review/.test(s) ? "var(--warn-soft)" : "var(--surface-3)"
const numOf = (v: any) => { const n = parseFloat(String(v ?? "").replace(/[^0-9.]/g, "")); return isNaN(n) ? 0 : n }
const wcagRef = (s: string) => { const m = String(s).match(/WCAG\s*(\d+\.[\d.]+)/i); return m ? m[1] : null }

const DocPanelStyle: React.CSSProperties = { background: "var(--surface)", borderRadius: 22, boxShadow: "var(--shadow-md)", padding: "22px 24px" }

function DocStat({ label, value, unit, sub, tone, progress }: { label: string; value: React.ReactNode; unit?: string; sub?: string; tone?: "ok" | "warn" | "err" | "ink"; progress?: { value: number; total: number } }) {
  const col = tone === "ok" ? "var(--accent)" : tone === "warn" ? "var(--warn)" : tone === "err" ? "var(--err)" : "var(--ink)"
  return (
    <div style={{ background: "var(--surface)", borderRadius: 16, boxShadow: "var(--shadow-md)", padding: "16px 18px" }}>
      <div className="dss-mono" style={{ fontSize: 10, fontWeight: 700, color: "var(--ink-subtle)", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 7 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: "-.035em", lineHeight: 1, color: col }}>{value}{unit && <span style={{ fontSize: 14, color: "var(--ink-subtle)" }}>{unit}</span>}</div>
      {progress && progress.total > 0 && <div style={{ marginTop: 11, height: 5, borderRadius: 3, background: "var(--surface-3)", overflow: "hidden" }}><div style={{ width: Math.max(4, Math.min(100, progress.value / progress.total * 100)) + "%", height: "100%", background: col, borderRadius: 3 }} /></div>}
      {sub && <div style={{ fontSize: 10.5, color: "var(--ink-muted)", marginTop: progress ? 6 : 4 }}>{sub}</div>}
    </div>
  )
}

/* Token de variante: "Position=Portrait, Featured=No" → chave·valor mono, quebra bem. */
function VariantToken({ value, tone }: { value?: string; tone?: "accent" | "neutral" }) {
  if (!value) return null
  const parts = String(value).split(",").map((s) => s.trim()).filter(Boolean)
  const acc = tone === "accent"
  const bg = acc ? "var(--accent-soft)" : "var(--surface-2)"
  const kc = acc ? "var(--accent-ink)" : "var(--ink-subtle)"
  const vc = acc ? "var(--accent-ink)" : "var(--ink)"
  return (
    <span className="dss-mono" style={{ display: "inline-flex", flexWrap: "wrap", gap: "2px 4px", background: bg, borderRadius: 8, padding: "3px 9px", fontSize: 10.5, lineHeight: 1.35, alignItems: "center", verticalAlign: "middle" }}>
      {parts.map((p, i) => {
        const eq = p.indexOf("=")
        const k = eq >= 0 ? p.slice(0, eq) : ""
        const v = eq >= 0 ? p.slice(eq + 1) : p
        return (
          <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
            {i > 0 && <span style={{ color: "var(--hairline-strong)", margin: "0 3px" }}>/</span>}
            {k && <><span style={{ color: kc, fontWeight: 500, opacity: acc ? 0.7 : 1 }}>{k}</span><span style={{ color: "var(--hairline-strong)" }}>·</span></>}
            <span style={{ color: vc, fontWeight: 700 }}>{v}</span>
          </span>
        )
      })}
    </span>
  )
}

/* Casa a string de variante do doc com uma variante real do componente. */
function parseVariantProps(str?: string): Record<string, string> {
  const kv: Record<string, string> = {}
  const first = String(str || "").split(/\s+e\s+/)[0]
  first.split(",").forEach((seg) => { const i = seg.indexOf("="); if (i > 0) kv[seg.slice(0, i).trim()] = seg.slice(i + 1).trim() })
  return kv
}
function matchVariantProps(entry: any, str?: string): Record<string, unknown> {
  const vs: any[] = entry?.variants || []
  const kv = parseVariantProps(str)
  const keys = Object.keys(kv)
  if (keys.length && vs.length) {
    const hit = vs.find((v: any) => keys.every((k) => String((v.props || {})[k] ?? "").toLowerCase() === kv[k].toLowerCase()))
    if (hit) return hit.props || {}
    return kv
  }
  return vs[0]?.props || {}
}
/* Renderiza a variante viva com FIT-TO-BOX: mede o render e escala pra caber inteiro
   no quadro (nunca corta). Aceita qualquer tamanho de componente. Null sem Component. */
function VariantThumb({ entry, variant, w = 200, h = 200, maxScale = 1 }: { entry?: any; variant?: string; w?: number; h?: number; maxScale?: number }) {
  const C = entry && entry.Component
  const ref = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(0.4)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const measure = () => {
      const cw = el.offsetWidth, ch = el.offsetHeight
      if (cw > 0 && ch > 0) {
        const s = Math.min(w / cw, h / ch, maxScale)
        if (isFinite(s) && s > 0) setScale(s)
      }
    }
    measure()
    let ro: any = null
    if (typeof ResizeObserver !== "undefined") { ro = new ResizeObserver(measure); ro.observe(el) }
    const iv = setInterval(measure, 350)          // iframe posta o tamanho de forma assíncrona
    const stop = setTimeout(() => clearInterval(iv), 4000)
    return () => { if (ro) ro.disconnect(); clearInterval(iv); clearTimeout(stop) }
  }, [w, h, maxScale, variant, C])
  if (!C) return null
  const props = matchVariantProps(entry, variant)
  return (
    <div style={{ width: w, height: h, flexShrink: 0, borderRadius: 14, background: "var(--surface-2)", border: "1px solid var(--hairline)", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div ref={ref} style={{ transform: "scale(" + scale + ")", transformOrigin: "center", pointerEvents: "none", display: "inline-block" }}>
        {(() => { try { return <C {...heroProps(entry, props)} /> } catch { return null } })()}
      </div>
    </div>
  )
}

function StatusPill({ status, label }: { status: string; label?: string }) {
  return (
    <span className="dss-mono" style={{ fontSize: 11, fontWeight: 700, color: statusColor(status), background: statusSoft(status), padding: "3px 10px", borderRadius: 999, whiteSpace: "nowrap", display: "inline-flex", alignItems: "center", gap: 5, textTransform: "capitalize" }}>
      <span style={{ fontFamily: "var(--font-mono)" }}>{statusIcon(status)}</span>{label ?? status}
    </span>
  )
}

function ContrastScale({ ratio }: { ratio: number }) {
  const pos = Math.min(97, Math.max(3, ((ratio - 1) / 20) * 100))
  const dot = ratio < 4.5 ? "var(--err)" : ratio < 7 ? "var(--warn)" : "var(--accent)"
  return (
    <div style={{ position: "relative", height: 7, borderRadius: 5, marginTop: 7, overflow: "hidden", background: "linear-gradient(90deg, var(--err-soft) 0 10%, var(--warn-soft) 10% 17.5%, var(--accent-soft) 17.5% 100%)" }}>
      <span style={{ position: "absolute", left: pos + "%", top: "50%", transform: "translate(-50%,-50%)", width: 11, height: 11, borderRadius: "50%", background: dot, border: "2px solid var(--surface)", boxShadow: "var(--shadow-sm)" }} />
    </div>
  )
}
/* ─── A11y — scorecard + críticos limpos + contraste 2col + trio + checklist agrupado ── */
function A11yTab({ docs, status, error, refresh, entry }: { docs: AllDocs | null; status: DocStatus; error: string | null; refresh: () => void; entry?: any }) {
  const a = docs?.a11y
  const checklist: any[] = a?.checklist || []
  const pass = checklist.filter((x: any) => /aprovado|pass/.test(x.status)).length
  const rev = checklist.filter((x: any) => /revisar|review/.test(x.status)).length
  const fail = checklist.filter((x: any) => /reprovado|fail/.test(x.status)).length
  const contrast: any[] = a?.colorContrast || []
  const cPass = contrast.filter((c: any) => numOf(c.ratio) >= 4.5).length
  const tt = a?.touchTarget
  const ttWord = tt ? (/aprovado|pass/.test(tt.status) ? "OK" : /reprovado|fail/.test(tt.status) ? "Falha" : "Revisar") : "—"
  const ttTone: "ok" | "warn" | "err" = tt ? (/aprovado|pass/.test(tt.status) ? "ok" : /reprovado|fail/.test(tt.status) ? "err" : "warn") : "warn"
  const kb: any[] = a?.keyboardNavigation?.interactions || []
  const groups = [
    { key: "fail", label: "Reprovado", ref: "reprovado", items: checklist.filter((x: any) => /reprovado|fail/.test(x.status)) },
    { key: "review", label: "A revisar", ref: "revisar", items: checklist.filter((x: any) => /revisar|review/.test(x.status)) },
    { key: "pass", label: "Aprovado", ref: "aprovado", items: checklist.filter((x: any) => /aprovado|pass/.test(x.status)) },
  ].filter((g) => g.items.length)
  return <DocShell status={status} error={error} refresh={refresh}>
    {a && <div style={{ padding: 28, display: "flex", flexDirection: "column", gap: 20 }}>

      <ExperienceStrip entry={entry} />

      {/* scorecard */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px,1fr))", gap: 14 }}>
        <DocStat label="WCAG" value={a.wcagLevel || "—"} tone="ok" sub={a.semanticElement ? "<" + a.semanticElement + ">" : undefined} />
        {contrast.length > 0 && <DocStat label="Contraste" value={cPass} unit={"/" + contrast.length} tone={cPass === contrast.length ? "ok" : "warn"} progress={{ value: cPass, total: contrast.length }} sub={cPass === contrast.length ? "todos passam" : (contrast.length - cPass) + " a revisar"} />}
        {checklist.length > 0 && <DocStat label="Checklist" value={pass} unit={"/" + checklist.length} tone={fail ? "err" : rev ? "warn" : "ok"} progress={{ value: pass, total: checklist.length }} sub={fail ? fail + " reprovados" : rev ? rev + " a revisar" : "completo"} />}
        {tt && <DocStat label="Toque" value={ttWord} tone={ttTone} sub="WCAG 2.5.5 / 2.5.8" />}
      </div>

      {/* críticos — painel limpo */}
      {a.criticalIssues?.length > 0 && (
        <div style={DocPanelStyle}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--err)" }} />
            <SectionLabel>{a.criticalIssues.length} issues críticos</SectionLabel>
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            {a.criticalIssues.map((x: string, i: number) => {
              const ref = wcagRef(x)
              return (
                <div key={i} style={{ display: "flex", gap: 12, padding: "11px 0", borderTop: i ? "1px solid var(--hairline)" : "none" }}>
                  <span className="dss-mono" style={{ fontSize: 10, fontWeight: 700, color: "var(--err)", background: "var(--err-soft)", padding: "3px 8px", borderRadius: 6, flexShrink: 0, height: "fit-content", minWidth: 46, textAlign: "center" }}>{ref || "!"}</span>
                  <p style={{ fontSize: 12.5, color: "var(--ink)", margin: 0, lineHeight: 1.55 }}>{x}</p>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* contraste — 2 colunas */}
      {contrast.length > 0 && (
        <div style={DocPanelStyle}>
          <SectionLabel>Contraste de cores</SectionLabel>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(360px,1fr))", gap: "0 32px" }}>
            {contrast.map((c: any, i: number) => (
              <div key={i} style={{ display: "flex", gap: 13, alignItems: "center", padding: "12px 0", borderTop: "1px solid var(--hairline)" }}>
                <div style={{ width: 66, height: 44, borderRadius: 11, background: c.background, border: "1px solid var(--hairline-strong)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <span style={{ fontSize: 17, fontWeight: 800, color: c.foreground, lineHeight: 1 }}>Aa</span>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--ink)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.pair}</div>
                  <div className="dss-mono" style={{ fontSize: 9.5, color: "var(--ink-subtle)" }}>{c.foreground} / {c.background}</div>
                  <ContrastScale ratio={numOf(c.ratio)} />
                </div>
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <div className="dss-mono" style={{ fontSize: 18, fontWeight: 800, letterSpacing: "-.02em", color: statusColor(c.status), lineHeight: 1 }}>{c.ratio}<span style={{ fontSize: 9.5, color: "var(--ink-subtle)" }}>:1</span></div>
                  <div style={{ marginTop: 5 }}><StatusPill status={c.status} label={c.wcagLevel || c.status} /></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* trio: toque | teclado | leitor — peso igual */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px,1fr))", gap: 14, alignItems: "start" }}>
        {tt && (
          <div style={DocPanelStyle}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <SectionLabel>Alvo de toque</SectionLabel>
              <StatusPill status={tt.status} label={ttWord} />
            </div>
            {tt.currentSize && <p style={{ fontSize: 12.5, color: "var(--ink-muted)", margin: 0, lineHeight: 1.55 }}>{tt.currentSize}</p>}
            {tt.minimumSize && <p style={{ fontSize: 11, color: "var(--ink-subtle)", margin: "10px 0 0", lineHeight: 1.5 }}>Mínimo: {tt.minimumSize}</p>}
          </div>
        )}
        {kb.length > 0 && (
          <div style={DocPanelStyle}>
            <SectionLabel>Navegação por teclado</SectionLabel>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {kb.map((it: any, i: number) => (
                <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                  <kbd className="dss-mono" style={{ fontSize: 10.5, background: "var(--surface)", border: "1px solid var(--hairline-strong)", borderBottomWidth: 2, borderRadius: 7, padding: "3px 9px", color: "var(--ink)", minWidth: 54, textAlign: "center", flexShrink: 0 }}>{it.key}</kbd>
                  <span style={{ fontSize: 12, color: "var(--ink-muted)", lineHeight: 1.5 }}>{it.action}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        {a.screenReader?.announcements?.length > 0 && (
          <div style={DocPanelStyle}>
            <SectionLabel>Leitor de tela</SectionLabel>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {a.screenReader.announcements.map((x: string, i: number) => (
                <div key={i} style={{ display: "flex", gap: 8 }}>
                  <span style={{ color: "var(--accent)", flexShrink: 0, fontSize: 12 }}>“</span>
                  <p style={{ fontSize: 12, color: "var(--ink-muted)", margin: 0, lineHeight: 1.5 }}>{x}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* recomendações — full width, 2 colunas */}
      {a.recommendations?.length > 0 && (
        <div style={DocPanelStyle}>
          <SectionLabel>Recomendações</SectionLabel>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(360px,1fr))", gap: "0 32px" }}>
            {a.recommendations.map((r: string, i: number) => (
              <div key={i} style={{ display: "flex", gap: 10, padding: "9px 0", borderTop: "1px solid var(--hairline)" }}>
                <span style={{ color: "var(--accent)", fontWeight: 700, flexShrink: 0 }}>→</span>
                <p style={{ fontSize: 12.5, color: "var(--ink-muted)", margin: 0, lineHeight: 1.55 }}>{r}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* checklist — agrupado por prioridade */}
      {checklist.length > 0 && (
        <div style={DocPanelStyle}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 14 }}>
            <SectionLabel>Checklist WCAG 2.2</SectionLabel>
            <span className="dss-mono" style={{ fontSize: 20, fontWeight: 800, letterSpacing: "-.03em", lineHeight: 1, whiteSpace: "nowrap" }}><span style={{ color: pass === checklist.length ? "var(--accent)" : "var(--warn)" }}>{pass}</span><span style={{ fontSize: 12, color: "var(--ink-subtle)" }}>/{checklist.length}</span></span>
          </div>
          <div style={{ display: "flex", height: 8, borderRadius: 5, overflow: "hidden", gap: 2, marginBottom: 4 }}>
            {pass > 0 && <span style={{ flex: pass, background: "var(--ok)" }} />}
            {rev > 0 && <span style={{ flex: rev, background: "var(--warn)" }} />}
            {fail > 0 && <span style={{ flex: fail, background: "var(--err)" }} />}
          </div>
          {groups.map((g) => (
            <div key={g.key} style={{ marginTop: 18 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: statusColor(g.ref) }} />
                <span style={{ fontSize: 12.5, fontWeight: 700, color: "var(--ink)" }}>{g.label}</span>
                <span className="dss-mono" style={{ fontSize: 11, color: "var(--ink-subtle)" }}>{String(g.items.length).padStart(2, "0")}</span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px,1fr))", gap: "0 32px" }}>
                {g.items.map((item: any, i: number) => {
                  const parts = String(item.criterion || "").split(/\s+(.+)/)
                  const code = /^\d/.test(parts[0]) ? parts[0] : ""
                  const title = code ? (parts[1] || "") : item.criterion
                  return (
                    <div key={i} style={{ display: "flex", gap: 11, padding: "12px 0", borderTop: "1px solid var(--hairline)" }}>
                      <span style={{ width: 7, height: 7, borderRadius: "50%", background: statusColor(item.status), flexShrink: 0, marginTop: 6 }} />
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--ink)", lineHeight: 1.4 }}>{code && <span className="dss-mono" style={{ color: "var(--ink-subtle)", fontWeight: 700, marginRight: 6 }}>{code}</span>}{title}</div>
                        {item.note && <div style={{ fontSize: 11.5, color: "var(--ink-muted)", marginTop: 4, lineHeight: 1.5 }}>{item.note}</div>}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>}
  </DocShell>
}
/* ─── Do / Don't — seções agrupadas, componente renderizado à esquerda ──────── */
function DontsTab({ docs, status, error, refresh, entry }: { docs: AllDocs | null; status: DocStatus; error: string | null; refresh: () => void; entry?: any }) {
  const d = docs?.donts
  const Section = ({ items, kind }: { items: any[]; kind: "do" | "dont" }) => {
    const isDo = kind === "do"
    const accent = isDo ? "var(--ok)" : "var(--err)"
    const soft = isDo ? "var(--ok-soft)" : "var(--err-soft)"
    const list: any[] = items || []
    return (
      <div style={DocPanelStyle}>
        <div style={{ display: "flex", alignItems: "center", gap: 11, paddingBottom: 14, borderBottom: "1px solid var(--hairline)", marginBottom: 4 }}>
          <span style={{ width: 26, height: 26, borderRadius: 8, background: soft, color: accent, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 13, flexShrink: 0 }}>{isDo ? "\u2713" : "\u2717"}</span>
          <span style={{ fontSize: 16, fontWeight: 700 }}>{isDo ? "Fa\u00e7a" : "N\u00e3o fa\u00e7a"}</span>
          <span className="dss-mono" style={{ marginLeft: "auto", fontSize: 11, fontWeight: 700, color: accent, background: soft, padding: "3px 11px", borderRadius: 999 }}>{list.length} {list.length === 1 ? "regra" : "regras"}</span>
        </div>
        {list.map((it: any, i: number) => (
          <div key={i} style={{ display: "flex", gap: 18, padding: "18px 0", borderBottom: i < list.length - 1 ? "1px solid var(--hairline)" : "none", alignItems: "center" }}>
            <VariantThumb entry={entry} variant={it.relatedVariant} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 11 }}>
                <span className="dss-mono" style={{ fontSize: 12, fontWeight: 800, color: accent, flexShrink: 0 }}>{String(i + 1).padStart(2, "0")}</span>
                <span style={{ fontSize: 15, fontWeight: 700, color: "var(--ink)", lineHeight: 1.3 }}>{it.title}</span>
              </div>
              {it.relatedVariant && <div style={{ marginTop: 9, marginLeft: 30 }}><VariantToken value={it.relatedVariant} /></div>}
              <div style={{ marginLeft: 30 }}>
                {it.description && <div style={{ fontSize: 12.5, color: "var(--ink-muted)", marginTop: 9, lineHeight: 1.55 }}>{it.description}</div>}
                {it.designRationale && <div style={{ fontSize: 11.5, color: "var(--ink-subtle)", marginTop: 9, paddingLeft: 11, borderLeft: "2px solid " + soft, lineHeight: 1.5 }}>{it.designRationale}</div>}
              </div>
            </div>
          </div>
        ))}
      </div>
    )
  }
  return <DocShell status={status} error={error} refresh={refresh}>
    {d && <div style={{ padding: 28, display: "flex", flexDirection: "column", gap: 20 }}>
      <Section items={d.dos} kind="do" />
      <Section items={d.donts} kind="dont" />
    </div>}
  </DocShell>
}
/* ─── Use Cases — hero + casos com render + matriz com render + notas ───────── */
function UseCasesTab({ docs, status, error, refresh, entry }: { docs: AllDocs | null; status: DocStatus; error: string | null; refresh: () => void; entry?: any }) {
  const u = docs?.useCases
  const notes: string[] = [ ...((u?.compositionNotes as string[]) || []), ...((u?.contentGuidelines as string[]) || []) ]
  return <DocShell status={status} error={error} refresh={refresh}>
    {u && <div style={{ padding: 28, display: "flex", flexDirection: "column", gap: 20 }}>

      {u.primaryUseCase && (
        <div style={{ ...DocPanelStyle, display: "flex", alignItems: "center", gap: 22 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="dss-mono" style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: ".1em", color: "var(--accent-ink)", fontWeight: 700, marginBottom: 7 }}>Recomendado para</div>
            <p style={{ fontSize: 16, fontWeight: 600, margin: 0, lineHeight: 1.4, color: "var(--ink)" }}>{u.primaryUseCase.scenario}</p>
            {u.primaryUseCase.rationale && <p style={{ fontSize: 12.5, color: "var(--ink-subtle)", margin: "10px 0 0", lineHeight: 1.5 }}>{u.primaryUseCase.rationale}</p>}
            {u.primaryUseCase.recommendedVariant && <div style={{ marginTop: 12 }}><VariantToken value={u.primaryUseCase.recommendedVariant} tone="accent" /></div>}
          </div>
          {entry?.Component && u.primaryUseCase.recommendedVariant && (
            <div style={{ flexShrink: 0, paddingLeft: 22, borderLeft: "1px solid var(--hairline)" }}>
              <VariantThumb entry={entry} variant={u.primaryUseCase.recommendedVariant} w={200} h={200} />
            </div>
          )}
        </div>
      )}

      {u.useCases?.length > 0 && (
        <div style={DocPanelStyle}>
          <SectionLabel>Casos de uso</SectionLabel>
          {u.useCases.map((c: any, i: number) => (
            <div key={i} style={{ display: "flex", gap: 18, padding: "18px 0", borderTop: i ? "1px solid var(--hairline)" : "none", alignItems: "center" }}>
              <VariantThumb entry={entry} variant={c.variant} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "baseline", flexWrap: "wrap" }}>
                  <span style={{ fontSize: 15, fontWeight: 700, color: "var(--ink)", lineHeight: 1.3 }}>{c.title}</span>
                  {c.variant && <VariantToken value={c.variant} />}
                </div>
                {c.scenario && <p style={{ fontSize: 12.5, color: "var(--ink-muted)", margin: "9px 0 0", lineHeight: 1.55 }}>{c.scenario}</p>}
                {c.rationale && <p style={{ fontSize: 11.5, color: "var(--ink-subtle)", margin: "7px 0 0", lineHeight: 1.5 }}>\u2014 {c.rationale}</p>}
                {c.notSuitableWhen && <p style={{ fontSize: 11.5, color: "var(--err)", margin: "8px 0 0", lineHeight: 1.5 }}>N\u00e3o indicado quando: {c.notSuitableWhen}</p>}
              </div>
            </div>
          ))}
        </div>
      )}

      {u.variantGuide?.length > 0 && (
        <div style={DocPanelStyle}>
          <SectionLabel>Guia por variante</SectionLabel>
          <div style={{ border: "1px solid var(--hairline)", borderRadius: 14, overflow: "hidden" }}>
            <div style={{ display: "grid", gridTemplateColumns: "minmax(230px,1fr) minmax(0,1fr) minmax(0,1fr)", background: "var(--surface-2)", borderBottom: "1px solid var(--hairline-strong)" }}>
              <span className="dss-mono" style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--ink-subtle)", padding: "9px 14px" }}>Variante</span>
              <span className="dss-mono" style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--ok)", padding: "9px 14px" }}>Use quando</span>
              <span className="dss-mono" style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--err)", padding: "9px 14px" }}>Evite quando</span>
            </div>
            {u.variantGuide.map((g: any, i: number) => (
              <div key={i} style={{ display: "grid", gridTemplateColumns: "minmax(230px,1fr) minmax(0,1fr) minmax(0,1fr)", borderTop: i ? "1px solid var(--hairline)" : "none" }}>
                <div style={{ padding: "14px", display: "flex", gap: 12 }}>
                  {entry?.Component && <VariantThumb entry={entry} variant={g.variant} w={92} h={78} maxScale={1} />}
                  <div style={{ minWidth: 0 }}>
                    <VariantToken value={g.variant} tone="accent" />
                    {g.purpose && <div style={{ fontSize: 11.5, color: "var(--ink-subtle)", marginTop: 8, lineHeight: 1.45 }}>{g.purpose}</div>}
                  </div>
                </div>
                <div style={{ padding: "14px", borderLeft: "1px solid var(--hairline)" }}>
                  {(g.useWhen || []).map((x: string, j: number) => <div key={j} style={{ display: "flex", gap: 7, fontSize: 12, color: "var(--ink-muted)", lineHeight: 1.5, marginBottom: 5 }}><span style={{ color: "var(--ok)", flexShrink: 0 }}>\u2022</span>{x}</div>)}
                </div>
                <div style={{ padding: "14px", borderLeft: "1px solid var(--hairline)" }}>
                  {(g.avoidWhen || []).map((x: string, j: number) => <div key={j} style={{ display: "flex", gap: 7, fontSize: 12, color: "var(--ink-muted)", lineHeight: 1.5, marginBottom: 5 }}><span style={{ color: "var(--err)", flexShrink: 0 }}>\u2022</span>{x}</div>)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {(notes.length > 0 || u.responsiveNotes) && (
        <div style={DocPanelStyle}>
          <SectionLabel>Notas de implementa\u00e7\u00e3o</SectionLabel>
          {u.responsiveNotes && (
            <div style={{ background: "var(--surface-2)", borderRadius: 14, padding: "15px 17px", marginBottom: notes.length ? 18 : 0, borderLeft: "3px solid var(--accent)" }}>
              <div className="dss-mono" style={{ fontSize: 9.5, textTransform: "uppercase", letterSpacing: ".1em", color: "var(--accent-ink)", fontWeight: 700, marginBottom: 6 }}>Responsivo</div>
              <p style={{ fontSize: 13, color: "var(--ink-muted)", margin: 0, lineHeight: 1.6 }}>{u.responsiveNotes}</p>
            </div>
          )}
          {notes.length > 0 && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px,1fr))", gap: "0 32px" }}>
              {notes.map((x: string, i: number) => (
                <div key={i} style={{ display: "flex", gap: 11, padding: "11px 0", borderTop: "1px solid var(--hairline)", alignItems: "flex-start" }}>
                  <span style={{ width: 6, height: 6, borderRadius: 2, background: "var(--accent)", flexShrink: 0, marginTop: 6 }} />
                  <p style={{ fontSize: 12.5, color: "var(--ink-muted)", margin: 0, lineHeight: 1.55 }}>{x}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>}
  </DocShell>
}


function AiDocsSection({ entry, tab }: { entry: RegistryEntry; tab: string }) {
  const fetched = useAllDocs(entry)
  const override = (entry as any).__docs as AllDocs | null | undefined
  const docs = (override || fetched.docs) as AllDocs | null
  const status: DocStatus = override ? "done" : fetched.status
  const error = override ? null : fetched.error
  const refresh = fetched.refresh
  if (tab === "a11y") return <A11yTab docs={docs} status={status} error={error} refresh={refresh} entry={entry} />
  if (tab === "do-donts") return <DontsTab docs={docs} status={status} error={error} refresh={refresh} entry={entry} />
  return <UseCasesTab docs={docs} status={status} error={error} refresh={refresh} entry={entry} />
}

// ─── Component tabs config ───────────────────────────────────────────────────
type TabId = "canvas" | "preview" | "compare" | "code" | "specs" | "a11y" | "do-donts" | "use-cases" | "history"
const TABS: { id: TabId; label: string }[] = [
  { id: "canvas", label: "Canvas" }, { id: "preview", label: "Preview" }, { id: "compare", label: "Compare" },
  { id: "code", label: "Código" }, { id: "specs", label: "Specs" }, { id: "a11y", label: "A11y" },
  { id: "do-donts", label: "Do / Don't" }, { id: "use-cases", label: "Use Cases" },
  { id: "history", label: "Histórico" },
]


// ─── Access policy (public/access.json) — visibilidade da instância ──────────
// public: qualquer pessoa com o link · password: gate por senha (hash SHA-256) ·
// private: membros (enforcement real chega com o backend — M1 Supabase)
type AccessVisibility = "public" | "password" | "private"
type AccessPolicy = { visibility?: AccessVisibility; passwordHash?: string; updatedAt?: string }

function useAccess(): { policy: AccessPolicy | null; loaded: boolean } {
  const [st, setSt] = useState<{ policy: AccessPolicy | null; loaded: boolean }>({ policy: null, loaded: false })
  useEffect(() => {
    let on = true
    fetch("/access.json").then(r => (r.ok ? r.json() : null)).then(j => { if (on) setSt({ policy: j, loaded: true }) }).catch(() => { if (on) setSt({ policy: null, loaded: true }) })
    return () => { on = false }
  }, [])
  return st
}

async function sha256Hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text))
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("")
}

function AccessGate({ policy, onUnlock }: { policy: AccessPolicy; onUnlock: () => void }) {
  const [pwd, setPwd] = useState("")
  const [err, setErr] = useState("")
  const [busy, setBusy] = useState(false)
  const canTry = !!policy.passwordHash
  const name = REPO_NAME.replace(/-/g, " ")
  const tryUnlock = async () => {
    if (!canTry || !pwd) return
    setBusy(true); setErr("")
    const h = await sha256Hex(pwd)
    if (h === policy.passwordHash) onUnlock()
    else { setErr("Senha incorreta."); setBusy(false) }
  }
  return (
    <div style={{ minHeight: "100vh", background: "var(--canvas)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--font-sans)", padding: 20 }}>
      <div style={{ background: "var(--surface)", borderRadius: 22, boxShadow: "var(--shadow-md)", padding: "40px 38px", maxWidth: 420, width: "100%", textAlign: "center" }}>
        <div style={{ width: 44, height: 44, borderRadius: 12, margin: "0 auto 18px", background: "linear-gradient(145deg,#6f6f72,#2b2b2e)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "var(--shadow-md)" }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M12 2 21 7v10l-9 5-9-5V7z" stroke="#fff" strokeWidth="1.4" opacity=".9" /></svg>
        </div>
        <div className="dss-display" style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.03em", textTransform: "capitalize" }}>{name}</div>
        <p style={{ fontSize: 13.5, color: "var(--ink-muted)", lineHeight: 1.6, margin: "10px 0 0" }}>
          {policy.visibility === "private" && !canTry
            ? "Esta instância é privada. Solicite acesso ao responsável pelo design system."
            : "Acesso restrito. Insira a senha fornecida pelo responsável."}
        </p>
        {canTry && (
          <>
            <input type="password" value={pwd} onChange={e => { setPwd(e.target.value); setErr("") }} placeholder="Senha de acesso"
              onKeyDown={e => { if (e.key === "Enter") tryUnlock() }} autoFocus
              style={{ width: "100%", boxSizing: "border-box", marginTop: 20, padding: "12px 15px", borderRadius: 12, border: "1px solid " + (err ? "var(--err)" : "var(--hairline)"), background: "var(--surface-2)", fontFamily: "var(--font-sans)", fontSize: 14, color: "var(--ink)", textAlign: "center" }} />
            <button className="dss-btn" disabled={busy} onClick={tryUnlock}
              style={{ width: "100%", marginTop: 10, background: "var(--primary)", color: "var(--on-primary)", border: "none", borderRadius: 999, padding: "12px", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "var(--font-sans)" }}>{busy ? "Verificando…" : "Entrar"}</button>
            {err && <div style={{ marginTop: 10, fontSize: 12.5, color: "var(--err)", fontWeight: 600 }}>{err}</div>}
          </>
        )}
        <div style={{ marginTop: 24, display: "flex", justifyContent: "center" }}><DSBadge /></div>
      </div>
    </div>
  )
}

function AccessPanel({ pat, repoUrl, ghHeaders }: { pat: string; repoUrl: string; ghHeaders: (t: string) => Record<string, string> }) {
  const [policy, setPolicy] = useState<AccessPolicy>({ visibility: "public" })
  const [loaded, setLoaded] = useState(false)
  const [pwd, setPwd] = useState("")
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState("")
  const [copied, setCopied] = useState(false)
  useEffect(() => {
    let on = true
    fetch("/access.json", { cache: "reload" }).then(r => (r.ok ? r.json() : null)).then(j => { if (on) { if (j) setPolicy(j); setLoaded(true) } }).catch(() => { if (on) setLoaded(true) })
    return () => { on = false }
  }, [])
  const save = async (next: AccessPolicy) => {
    setBusy(true); setMsg("")
    try {
      const url = repoUrl + "/contents/public/access.json"
      const r = await fetch(url, { headers: ghHeaders(pat) })
      let sha: string | undefined
      if (r.ok) { const j = await r.json(); sha = j.sha }
      const body: any = { message: "access: visibility update via DS Studio admin", content: btoa(unescape(encodeURIComponent(JSON.stringify({ ...next, updatedAt: new Date().toISOString() }, null, 2)))) }
      if (sha) body.sha = sha
      const w = await fetch(url, { method: "PUT", headers: { ...ghHeaders(pat), "Content-Type": "application/json" }, body: JSON.stringify(body) })
      if (!w.ok) throw new Error("HTTP " + w.status)
      setPolicy(next); setMsg("✓ Política publicada — vale para visitantes após o redeploy (~1 min).")
    } catch (e: any) { setMsg("Erro: " + (e?.message || e)) } finally { setBusy(false) }
  }
  const applyPassword = async () => {
    const p = pwd.trim()
    if (!p) { setMsg("Defina a senha antes de aplicar."); return }
    const h = await sha256Hex(p)
    setPwd("")
    await save({ visibility: "password", passwordHash: h })
  }
  const copyLink = () => { try { navigator.clipboard.writeText(window.location.origin); setCopied(true); setTimeout(() => setCopied(false), 1800) } catch {} }
  const vis: AccessVisibility = policy.visibility || "public"
  return (
    <div style={{ ...PANEL, padding: 26, maxWidth: 680 }}>
      <div style={{ fontSize: 17, fontWeight: 700, letterSpacing: "-0.02em", marginBottom: 4 }}>Acesso & Compartilhamento</div>
      <p style={{ fontSize: 13, color: "var(--ink-muted)", lineHeight: 1.6, marginTop: 0 }}>Controle quem vê esta instância. A política é versionada em <span className="dss-mono">public/access.json</span> — cada mudança é um commit auditável.</p>
      {!loaded ? <div style={{ fontSize: 12.5, color: "var(--ink-subtle)" }}>Carregando…</div> : (
        <>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
            {([["public", "Público", "Qualquer pessoa com o link"], ["password", "Senha", "Cortina para NDA / compliance"], ["private", "Privado (membros)", "Requer backend — próxima fase"]] as [AccessVisibility, string, string][]).map(([v, label, hint]) => (
              <button key={v} className="dss-btn"
                onClick={() => { if (v === "private") { setMsg("Privado por membros chega com a conexão Supabase (M1) — a opção já está reservada aqui."); return } if (v === "public") save({ visibility: "public" }); else setMsg(policy.passwordHash ? "Senha já definida — a política ativa é por senha." : "Defina a senha abaixo e clique em Aplicar.") }}
                style={{ flex: 1, minWidth: 150, textAlign: "left", padding: "12px 14px", borderRadius: 14, cursor: v === "private" ? "not-allowed" : "pointer", opacity: v === "private" ? .55 : 1, fontFamily: "var(--font-sans)", border: "1.5px solid " + (vis === v ? "var(--accent)" : "var(--hairline)"), background: vis === v ? "var(--accent-soft)" : "var(--surface)" }}>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: vis === v ? "var(--accent-ink)" : "var(--ink)" }}>{label}</div>
                <div style={{ fontSize: 11.5, color: "var(--ink-muted)", marginTop: 3 }}>{hint}</div>
              </button>
            ))}
          </div>
          <div style={{ marginTop: 16, padding: "14px 16px", borderRadius: 14, background: "var(--surface-2)", border: "1px solid var(--hairline)" }}>
            <div style={{ fontSize: 12.5, fontWeight: 700, marginBottom: 8, display: "flex", alignItems: "center", gap: 8 }}>Senha de acesso {policy.passwordHash && vis === "password" && <Pill variant="interactive" size="sm">ativa</Pill>}</div>
            <div style={{ display: "flex", gap: 8 }}>
              <input type="text" value={pwd} onChange={e => setPwd(e.target.value)} placeholder={policy.passwordHash ? "Nova senha (substitui a atual)" : "Defina a senha de visualização"}
                style={{ flex: 1, padding: "10px 13px", borderRadius: 10, border: "1px solid var(--hairline)", background: "var(--surface)", fontFamily: "var(--font-sans)", fontSize: 13, color: "var(--ink)" }} />
              <button className="dss-btn" disabled={busy} onClick={applyPassword}
                style={{ background: "var(--primary)", color: "var(--on-primary)", border: "none", borderRadius: 999, padding: "0 18px", fontSize: 12.5, fontWeight: 600, cursor: "pointer", fontFamily: "var(--font-sans)" }}>{busy ? "Aplicando…" : "Aplicar senha"}</button>
            </div>
            <div style={{ fontSize: 11.5, color: "var(--ink-subtle)", marginTop: 8, lineHeight: 1.55 }}>
              A senha nunca é gravada — apenas o hash SHA-256. Num site estático o gate roda no navegador: é uma cortina de privacidade adequada a NDA leve. Proteção forte por membros chega com o backend (M1).
            </div>
          </div>
          <div style={{ marginTop: 14, display: "flex", gap: 8, alignItems: "center" }}>
            <input readOnly value={typeof window !== "undefined" ? window.location.origin : ""}
              style={{ flex: 1, padding: "10px 13px", borderRadius: 10, border: "1px solid var(--hairline)", background: "var(--surface-2)", fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--ink-muted)" }} />
            <button className="dss-btn" onClick={copyLink}
              style={{ background: "none", border: "1px solid var(--hairline-strong)", borderRadius: 999, padding: "9px 16px", fontSize: 12.5, fontWeight: 600, color: "var(--ink)", cursor: "pointer", fontFamily: "var(--font-sans)" }}>{copied ? "✓ Copiado" : "Copiar link"}</button>
          </div>
          {msg && <div style={{ marginTop: 12, fontSize: 12.5, fontWeight: 600, color: msg.startsWith("✓") ? "var(--accent-ink)" : "var(--ink-muted)" }}>{msg}</div>}
        </>
      )}
    </div>
  )
}


function AdminProjectsPanel({ pat, repoUrl, ghHeaders }: { pat: string; repoUrl: string; ghHeaders: (t: string) => Record<string, string> }) {
  const [list, setList] = useState<StudioProject[] | null>(null)
  const [draft, setDraft] = useState({ name: "", repo: "", url: "" })
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState("")
  useEffect(() => {
    let on = true
    fetch("/projects.json", { cache: "reload" }).then(r => (r.ok ? r.json() : null)).then(j => { if (on) setList((j && j.projects) || []) }).catch(() => { if (on) setList([]) })
    return () => { on = false }
  }, [])
  const save = async (next: StudioProject[]) => {
    setBusy(true); setMsg("")
    try {
      const url = repoUrl + "/contents/public/projects.json"
      const r = await fetch(url, { headers: ghHeaders(pat) })
      let sha: string | undefined
      if (r.ok) { const j = await r.json(); sha = j.sha }
      const payload = { $schema: "ds-studio/projects@1", updatedAt: new Date().toISOString(), projects: next }
      const body: any = { message: "projects: update via DS Studio admin", content: btoa(unescape(encodeURIComponent(JSON.stringify(payload, null, 2)))) }
      if (sha) body.sha = sha
      const w = await fetch(url, { method: "PUT", headers: { ...ghHeaders(pat), "Content-Type": "application/json" }, body: JSON.stringify(body) })
      if (!w.ok) throw new Error("HTTP " + w.status)
      setList(next)
      setMsg("✓ Projetos publicados — a página Meus projetos reflete após o redeploy (~1 min).")
    } catch (e: any) { setMsg("Erro: " + (e?.message || e)) } finally { setBusy(false) }
  }
  const add = () => {
    const n = draft.name.trim()
    if (!n || !list) { setMsg("Dê um nome ao projeto."); return }
    save([...list, { name: n, repo: draft.repo.trim() || undefined, url: draft.url.trim() || undefined }])
    setDraft({ name: "", repo: "", url: "" })
  }
  const inputSt: React.CSSProperties = { padding: "9px 12px", borderRadius: 10, border: "1px solid var(--hairline)", background: "var(--surface)", fontFamily: "var(--font-sans)", fontSize: 12.5, color: "var(--ink)" }
  return (
    <div style={{ ...PANEL, padding: 26, maxWidth: 680 }}>
      <div style={{ fontSize: 17, fontWeight: 700, letterSpacing: "-0.02em", marginBottom: 4 }}>Projetos do estúdio</div>
      <p style={{ fontSize: 13, color: "var(--ink-muted)", lineHeight: 1.6, marginTop: 0 }}>
        Alimenta a página <b>Meus projetos</b>. As estatísticas de cada card vêm do <span className="dss-mono">/registry.json</span> publicado por cada instância — dados reais, sem cadastro duplicado. Versionado em <span className="dss-mono">public/projects.json</span>.
      </p>
      {list === null ? <div style={{ fontSize: 12.5, color: "var(--ink-subtle)" }}>Carregando…</div> : (
        <>
          {list.map((p, i) => (
            <div key={p.name + i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 0", borderTop: i === 0 ? "none" : "1px solid var(--hairline)" }}>
              <div className="dss-display" style={{ width: 32, height: 32, borderRadius: 9, background: "var(--surface-2)", border: "1px solid var(--hairline)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 800, color: p.accent || "var(--accent)", flexShrink: 0 }}>{p.name[0]}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 600 }}>{p.name}</div>
                <div className="dss-mono" style={{ fontSize: 10.5, color: "var(--ink-subtle)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.repo || "—"}{p.url ? " · " + p.url.replace(/^https?:\/\//, "") : ""}</div>
              </div>
              <button className="dss-btn" title="Remover" disabled={busy} onClick={() => save(list.filter((_, j) => j !== i))}
                style={{ background: "none", border: "1px solid var(--hairline)", borderRadius: 8, width: 28, height: 28, fontSize: 12, color: "var(--err)", cursor: "pointer", flexShrink: 0 }}>✕</button>
            </div>
          ))}
          <div style={{ marginTop: 14, padding: "14px 16px", borderRadius: 14, background: "var(--surface-2)", border: "1px solid var(--hairline)" }}>
            <div style={{ fontSize: 12.5, fontWeight: 700, marginBottom: 8 }}>Adicionar projeto</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <input value={draft.name} onChange={e => setDraft(d => ({ ...d, name: e.target.value }))} placeholder="Nome" style={{ ...inputSt, flex: 1, minWidth: 120 }} />
              <input value={draft.repo} onChange={e => setDraft(d => ({ ...d, repo: e.target.value }))} placeholder="owner/repo" style={{ ...inputSt, flex: 1, minWidth: 140 }} />
              <input value={draft.url} onChange={e => setDraft(d => ({ ...d, url: e.target.value }))} placeholder="https://… (deploy)" style={{ ...inputSt, flex: 1.4, minWidth: 170 }} />
              <button className="dss-btn" disabled={busy} onClick={add}
                style={{ background: "var(--primary)", color: "var(--on-primary)", border: "none", borderRadius: 999, padding: "0 18px", fontSize: 12.5, fontWeight: 600, cursor: "pointer", fontFamily: "var(--font-sans)" }}>{busy ? "…" : "Adicionar"}</button>
            </div>
          </div>
          {msg && <div style={{ marginTop: 12, fontSize: 12.5, fontWeight: 600, color: msg.startsWith("✓") ? "var(--accent-ink)" : "var(--err)" }}>{msg}</div>}
        </>
      )}
    </div>
  )
}

// ─── AdminPage (E7 Owner Mode lite) — gerenciamento da plataforma via curadoria Git ─
// Autenticação: GitHub PAT no localStorage do owner (nunca server-side — decisão do PRD §3.6).
// Autorização: permissão de push no repo. Cada "Publicar" = commit em public/curation.json.
const ADMIN_PAT_KEY = "dss-admin-pat"
type AdminUser = { login: string; canPush: boolean }

// ─── Session — identidade via Supabase OAuth (M1) + Modules ─────────────────
type Modules = Record<string, boolean | number | string>
type Session = { login: string; name?: string; avatar?: string; canPush: boolean; isAdmin?: boolean; accessToken?: string; refreshToken?: string; userId?: string; modules?: Modules }
const GH_HEADERS = (t: string) => ({ Authorization: "token " + t, Accept: "application/vnd.github+json" })
const DSS_SESSION_KEY = "dss-supabase-session"
const DEFAULT_MODULES: Modules = {
  code_gen: true, ai_docs: true, token_export: true, insights: true,
  curate: true, deploy_github: true, staging_workflow: false,
  custom_domain: false, password_gate: true, versioning: true,
  component_playground: true, activity_log: true, builder: false,
  max_components: 999, max_generations_month: 999, model_tier: "sonnet",
}

// Module gate: renders children only if the module is enabled
function ModuleGate({ module, modules, children, fallback }: { module: string; modules?: Modules; children: React.ReactNode; fallback?: React.ReactNode }) {
  const m = modules || DEFAULT_MODULES
  const val = m[module]
  if (val === false || val === 0) return <>{fallback || null}</>
  return <>{children}</>
}

// ─── roleCaps — fonte única de capabilities por usuário (gating contextual de UI) ─
// Deriva de isAdmin (Platform Admin) + papel-no-projeto (project_members via project-role).
// Quando há projeto Supabase com papel resolvido → segue o papel (owner/admin/editor/viewer).
// Sem papel resolvido (instância local, ou ainda carregando) → cai no proxy canPush, pra
// não travar o dono. IMPORTANTE: isto é a camada VISUAL. A autorização real é server-side
// (RLS + /api/* re-checa ownership/papel).
type Caps = { platform: boolean; manage: boolean; deploy: boolean; createProject: boolean; editDocs: boolean }
function roleCaps(session: Session | null, projectRole?: string | null): Caps {
  const admin = !!(session && session.isAdmin)
  const push = admin || !!(session && session.canPush)
  const role = projectRole || null
  const ownerAdmin = role === "owner" || role === "admin"
  const editor = role === "editor"
  // Com papel resolvido, as caps de projeto seguem o papel; senão, proxy canPush.
  const manage = role ? (admin || ownerAdmin) : push
  const deploy = role ? (admin || ownerAdmin) : push
  const editDocs = role ? (admin || ownerAdmin || editor) : push
  return {
    platform: admin,       // Console da plataforma + módulos
    manage,                // curadoria, acesso, membros, registro de projetos
    deploy,                // publicar no GitHub
    createProject: push,   // criar projeto (não é escopado a um projeto específico)
    editDocs,              // editar docs (Editor+)
  }
}

function useSession() {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [tick, setTick] = useState(0)

  // Restaura sessão do storage ou hash fragment (redirect do callback)
  useEffect(() => {
    let on = true
    setLoading(true)

    // 1. Tenta ler tokens do hash fragment (redirect flow)
    let tokens: { access_token?: string; refresh_token?: string } | null = null
    if (window.location.hash.includes("access_token=")) {
      const hp = new URLSearchParams(window.location.hash.substring(1))
      // Recovery (redefinição de senha): NÃO logar — deixa o token no hash pra ResetPasswordPage usar.
      if (hp.get("type") === "recovery") { setSession(null); setLoading(false); return }
      tokens = { access_token: hp.get("access_token") || undefined, refresh_token: hp.get("refresh_token") || undefined }
      window.history.replaceState({}, "", window.location.pathname + window.location.search)
    }

    // 2. Tenta ler do sessionStorage
    if (!tokens?.access_token) {
      try {
        // migração suave: sessão antiga em sessionStorage → localStorage (1x)
        try { const legacy = sessionStorage.getItem(DSS_SESSION_KEY); if (legacy && !localStorage.getItem(DSS_SESSION_KEY)) { localStorage.setItem(DSS_SESSION_KEY, legacy); sessionStorage.removeItem(DSS_SESSION_KEY) } } catch {}
        const stored = JSON.parse(localStorage.getItem(DSS_SESSION_KEY) || "null")
        if (stored?.access_token) tokens = stored
      } catch {}
    }

    // 3. Tenta ler do sessionStorage setado pelo callback page
    if (!tokens?.access_token) {
      try {
        const cb = JSON.parse(sessionStorage.getItem("ds-studio-session") || "null")
        if (cb?.access_token) { tokens = cb; sessionStorage.removeItem("ds-studio-session") }
      } catch {}
    }

    if (!tokens?.access_token) { setSession(null); setLoading(false); return }

    // Valida token via /api/auth/me
    fetch("/api/auth/me", { headers: { Authorization: "Bearer " + tokens.access_token } })
      .then(r => (r.ok ? r.json() : Promise.reject(r)))
      .then(data => {
        if (!on) return
        const u = data.user || {}
        const s: Session = {
          login: u.login || u.email || "user",
          name: u.name || u.login || u.email,
          avatar: u.avatar,
          canPush: !!data.isAdmin,
          isAdmin: !!data.isAdmin,
          accessToken: tokens!.access_token,
          refreshToken: tokens!.refresh_token,
          userId: u.id,
          modules: { ...DEFAULT_MODULES, ...(data.modules || {}) },
        }
        try { localStorage.setItem(DSS_SESSION_KEY, JSON.stringify({ access_token: tokens!.access_token, refresh_token: tokens!.refresh_token })) } catch {}
        setSession(s)
        setLoading(false)
      })
      .catch(async () => {
        // Token expirado — tenta refresh
        if (tokens?.refresh_token) {
          try {
            const rr = await fetch("/api/auth/refresh", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ refresh_token: tokens.refresh_token }),
            })
            if (rr.ok) {
              const fresh = await rr.json()
              try { localStorage.setItem(DSS_SESSION_KEY, JSON.stringify({ access_token: fresh.access_token, refresh_token: fresh.refresh_token })) } catch {}
              if (on) setTick(t => t + 1) // retry com novo token
              return
            }
          } catch {}
        }
        if (on) { setSession(null); setLoading(false) }
        try { localStorage.removeItem(DSS_SESSION_KEY) } catch {}
      })

    return () => { on = false }
  }, [tick])

  // Escuta postMessage do popup OAuth
  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (e.data?.type === "ds-studio-auth" && e.data.session) {
        const s = e.data.session
        try { localStorage.setItem(DSS_SESSION_KEY, JSON.stringify({ access_token: s.access_token, refresh_token: s.refresh_token })) } catch {}
        setTick(t => t + 1)
      }
    }
    window.addEventListener("message", handler)
    return () => window.removeEventListener("message", handler)
  }, [])

  const signOut = () => {
    try { localStorage.removeItem(DSS_SESSION_KEY) } catch {}
    try { sessionStorage.removeItem("ds-studio-session") } catch {}
    setSession(null)
  }
  return { session, loading, signOut, refresh: () => setTick(t => t + 1) }
}

// ─── useGitHubLogin — popup OAuth reutilizável (landing + login) ─────────────
function useGitHubLogin(onDone: () => void) {
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState("")
  const login = () => {
    setBusy(true); setErr("")
    const w = 500, h = 650
    const left = window.screenX + (window.outerWidth - w) / 2
    const top = window.screenY + (window.outerHeight - h) / 2
    const popup = window.open("/api/auth/start?mode=popup", "ds-studio-auth", `width=${w},height=${h},left=${left},top=${top},toolbar=no,menubar=no`)
    if (!popup) { setErr("Popup bloqueado pelo navegador. Permita popups para este site."); setBusy(false); return }
    const handler = (e: MessageEvent) => {
      if (e.data?.type === "ds-studio-auth" && e.data.session) {
        window.removeEventListener("message", handler); clearInterval(pollClosed)
        try { localStorage.setItem(DSS_SESSION_KEY, JSON.stringify({ access_token: e.data.session.access_token, refresh_token: e.data.session.refresh_token })) } catch {}
        onDone()
      }
    }
    window.addEventListener("message", handler)
    const pollClosed = setInterval(() => { if (popup.closed) { clearInterval(pollClosed); window.removeEventListener("message", handler); setBusy(false) } }, 500)
  }
  return { login, busy, err }
}

const GH_ICON = "M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"
const GhIcon = ({ size = 18 }: { size?: number }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor"><path d={GH_ICON} /></svg>

// ─── AuthPage — entrada do produto: GitHub + e-mail/senha (entrar · criar conta · esqueci senha) ─
type AuthMode = "signin" | "signup" | "forgot"
const EMAIL_RE_C = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const EYE_ON = "M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z|M12 9a3 3 0 100 6 3 3 0 000-6z"
const EYE_OFF = "M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z|M12 9a3 3 0 100 6 3 3 0 000-6z|M3 3l18 18"
function AuthField(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} style={{ width: "100%", padding: "11px 12px", borderRadius: 10, border: "1px solid var(--hairline-strong)", background: "var(--surface)", fontSize: 14, fontFamily: "var(--font-sans)", color: "var(--ink)", boxSizing: "border-box", outline: "none", ...(props.style || {}) }} />
}
function PwField({ value, set, placeholder, autoComplete, show, toggle, onEnter }: { value: string; set: (v: string) => void; placeholder: string; autoComplete: string; show: boolean; toggle: () => void; onEnter: () => void }) {
  return (
    <div style={{ position: "relative" }}>
      <AuthField type={show ? "text" : "password"} value={value} onChange={e => set(e.target.value)} onKeyDown={e => { if (e.key === "Enter") onEnter() }} placeholder={placeholder} autoComplete={autoComplete} style={{ paddingRight: 42 }} />
      <button type="button" className="dss-btn" onClick={toggle} title={show ? "Ocultar" : "Mostrar"} style={{ position: "absolute", right: 6, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "var(--ink-subtle)", padding: 6, display: "flex" }}>
        <Icon d={show ? EYE_OFF : EYE_ON} size={16} />
      </button>
    </div>
  )
}
function AuthPage({ onDone, initialMode }: { onDone: () => void; initialMode?: AuthMode }) {
  const [mode, setMode] = useState<AuthMode>(initialMode || "signin")
  const { login: ghLogin, busy: ghBusy, err: ghErr } = useGitHubLogin(onDone)
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [showPw, setShowPw] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState("")
  const [notice, setNotice] = useState("")

  useEffect(() => {
    if (window.location.hash.includes("access_token=") && !window.location.hash.includes("type=recovery")) onDone()
    try { const cb = JSON.parse(sessionStorage.getItem("ds-studio-session") || "null"); if (cb?.access_token) onDone() } catch {}
  }, [])

  const go = (m: AuthMode) => { setMode(m); setErr(""); setNotice(""); setPassword(""); setConfirm("") }
  const storeAndDone = (s: any) => { try { localStorage.setItem(DSS_SESSION_KEY, JSON.stringify({ access_token: s.access_token, refresh_token: s.refresh_token })) } catch {}; onDone() }
  const friendly = (j: any, status: number) => {
    const d = String((j && (j.detail || j.error_description || j.code || j.error)) || "").toLowerCase()
    if (status === 429 || d.includes("rate")) return "Muitas tentativas. Aguarde um instante e tente de novo."
    if (d.includes("invalid login") || d.includes("invalid_grant") || d.includes("invalid_credentials")) return "E-mail ou senha incorretos."
    if (d.includes("not confirmed") || d.includes("email_not_confirmed")) return "Confirme seu e-mail antes de entrar — veja sua caixa de entrada."
    if (d.includes("already") || d.includes("registered") || d.includes("user_already")) return "Já existe uma conta com este e-mail. Tente entrar."
    if (d.includes("weak") || d.includes("at least") || d.includes("short")) return "Senha fraca. Use ao menos 8 caracteres."
    return (j && j.detail) || "Algo deu errado. Tente novamente."
  }
  const api = async (action: string, body: any) => {
    const r = await fetch("/api/platform?action=" + action, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
    const j = await r.json().catch(() => ({}))
    return { r, j }
  }
  const doSignin = async () => {
    setErr(""); if (!EMAIL_RE_C.test(email)) { setErr("Digite um e-mail válido."); return }
    if (!password) { setErr("Digite sua senha."); return }
    setBusy(true)
    try { const { r, j } = await api("auth-login", { email: email.trim().toLowerCase(), password }); if (!r.ok || !j.ok) { setErr(friendly(j, r.status)); setBusy(false); return } storeAndDone(j.session) }
    catch { setErr("Falha de conexão. Tente de novo."); setBusy(false) }
  }
  const doSignup = async () => {
    setErr(""); setNotice("")
    if (!name.trim()) { setErr("Digite seu nome."); return }
    if (!EMAIL_RE_C.test(email)) { setErr("Digite um e-mail válido."); return }
    if (password.length < 8) { setErr("A senha precisa de ao menos 8 caracteres."); return }
    if (password !== confirm) { setErr("As senhas não coincidem."); return }
    setBusy(true)
    try {
      const { r, j } = await api("auth-signup", { name: name.trim(), email: email.trim().toLowerCase(), password, redirect_to: window.location.origin + "/login" })
      if (!r.ok || !j.ok) { setErr(friendly(j, r.status)); setBusy(false); return }
      if (j.session) { storeAndDone(j.session); return }
      setNotice("Conta criada! Enviamos um e-mail de confirmação para " + email.trim().toLowerCase() + ". Confirme para entrar.")
      setBusy(false)
    } catch { setErr("Falha de conexão. Tente de novo."); setBusy(false) }
  }
  const doForgot = async () => {
    setErr(""); setNotice("")
    if (!EMAIL_RE_C.test(email)) { setErr("Digite o e-mail da sua conta."); return }
    setBusy(true)
    try { await api("auth-recover", { email: email.trim().toLowerCase(), redirect_to: window.location.origin + "/reset-password" }); setNotice("Se existir uma conta com este e-mail, enviamos um link para redefinir a senha.") }
    catch { setErr("Falha de conexão. Tente de novo.") }
    setBusy(false)
  }
  const submit = () => (mode === "signin" ? doSignin() : mode === "signup" ? doSignup() : doForgot())
  const title = mode === "signin" ? "Entrar" : mode === "signup" ? "Criar conta" : "Redefinir senha"
  const sub = mode === "signin" ? "Entre para acessar seus projetos." : mode === "signup" ? "Crie sua conta para começar." : "Informe seu e-mail e enviaremos um link para criar uma nova senha."

  return (
    <div className="dss-fade" style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 30 }}>
      <div style={{ ...PANEL, padding: "36px 34px", maxWidth: 440, width: "100%" }}>
        <div style={{ width: 40, height: 40, borderRadius: 11, marginBottom: 16, background: "linear-gradient(145deg,#6f6f72,#2b2b2e)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "var(--shadow-md)" }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M12 2 21 7v10l-9 5-9-5V7z" stroke="#fff" strokeWidth="1.4" opacity=".9" /></svg>
        </div>
        <div className="dss-display" style={{ fontSize: 24, fontWeight: 800, letterSpacing: "-0.03em" }}>{title}</div>
        <p style={{ fontSize: 13.5, color: "var(--ink-muted)", lineHeight: 1.6, margin: "6px 0 0" }}>{sub}</p>

        {mode !== "forgot" && (<>
          <button className="dss-btn" disabled={ghBusy} onClick={ghLogin} style={{ width: "100%", marginTop: 18, background: "var(--surface)", color: "var(--ink)", border: "1px solid var(--hairline-strong)", borderRadius: 999, padding: "12px", fontSize: 14, fontWeight: 600, cursor: ghBusy ? "wait" : "pointer", fontFamily: "var(--font-sans)", display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
            <GhIcon />{ghBusy ? "Conectando…" : "Continuar com GitHub"}
          </button>
          {ghErr && <div style={{ marginTop: 8, fontSize: 12.5, color: "var(--err)", fontWeight: 600 }}>{ghErr}</div>}
          <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "16px 0" }}>
            <div style={{ flex: 1, height: 1, background: "var(--hairline-strong)" }} />
            <span className="dss-mono" style={{ fontSize: 11, color: "var(--ink-subtle)" }}>ou</span>
            <div style={{ flex: 1, height: 1, background: "var(--hairline-strong)" }} />
          </div>
        </>)}

        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: mode === "forgot" ? 18 : 0 }}>
          {mode === "signup" && <AuthField type="text" value={name} onChange={e => setName(e.target.value)} onKeyDown={e => { if (e.key === "Enter") submit() }} placeholder="Seu nome" autoComplete="name" />}
          <AuthField type="email" value={email} onChange={e => setEmail(e.target.value)} onKeyDown={e => { if (e.key === "Enter") submit() }} placeholder="email@exemplo.com" autoComplete="email" />
          {mode !== "forgot" && <PwField value={password} set={setPassword} placeholder={mode === "signup" ? "Crie uma senha (8+ caracteres)" : "Sua senha"} autoComplete={mode === "signup" ? "new-password" : "current-password"} show={showPw} toggle={() => setShowPw(s => !s)} onEnter={submit} />}
          {mode === "signup" && <PwField value={confirm} set={setConfirm} placeholder="Confirme a senha" autoComplete="new-password" show={showPw} toggle={() => setShowPw(s => !s)} onEnter={submit} />}
        </div>

        {mode === "signin" && <button type="button" onClick={() => go("forgot")} className="dss-btn" style={{ background: "none", border: "none", padding: "8px 0 0", fontSize: 12.5, fontWeight: 600, color: "var(--accent-ink)", cursor: "pointer", fontFamily: "var(--font-sans)", alignSelf: "flex-start" }}>Esqueci minha senha</button>}

        <button className="dss-btn" disabled={busy} onClick={submit} style={{ width: "100%", marginTop: 16, background: busy ? "var(--surface-3)" : "var(--primary)", color: busy ? "var(--ink-subtle)" : "var(--on-primary)", border: "none", borderRadius: 999, padding: "13px", fontSize: 14, fontWeight: 600, cursor: busy ? "not-allowed" : "pointer", fontFamily: "var(--font-sans)" }}>
          {busy ? "Enviando…" : mode === "signin" ? "Entrar" : mode === "signup" ? "Criar conta" : "Enviar link de redefinição"}
        </button>

        {err && <div style={{ marginTop: 12, fontSize: 12.5, color: "var(--err)", fontWeight: 600, background: "var(--err-soft)", padding: "9px 11px", borderRadius: 9, lineHeight: 1.5 }}>{err}</div>}
        {notice && <div style={{ marginTop: 12, fontSize: 12.5, color: "var(--accent-ink)", fontWeight: 600, background: "var(--accent-soft)", padding: "9px 11px", borderRadius: 9, lineHeight: 1.5 }}>{notice}</div>}

        <div style={{ marginTop: 18, paddingTop: 16, borderTop: "1px solid var(--hairline)", fontSize: 13, color: "var(--ink-muted)", textAlign: "center" }}>
          {mode === "signin" && <>Não tem conta? <button type="button" onClick={() => go("signup")} className="dss-btn" style={{ background: "none", border: "none", padding: 0, fontSize: 13, fontWeight: 700, color: "var(--ink)", cursor: "pointer", fontFamily: "var(--font-sans)" }}>Criar conta</button></>}
          {mode === "signup" && <>Já tem conta? <button type="button" onClick={() => go("signin")} className="dss-btn" style={{ background: "none", border: "none", padding: 0, fontSize: 13, fontWeight: 700, color: "var(--ink)", cursor: "pointer", fontFamily: "var(--font-sans)" }}>Entrar</button></>}
          {mode === "forgot" && <button type="button" onClick={() => go("signin")} className="dss-btn" style={{ background: "none", border: "none", padding: 0, fontSize: 13, fontWeight: 600, color: "var(--ink-muted)", cursor: "pointer", fontFamily: "var(--font-sans)" }}>← Voltar para entrar</button>}
        </div>
      </div>
    </div>
  )
}

// ─── ResetPasswordPage — define nova senha (chegada via link de recuperação) ──
function ResetPasswordPage({ onDone, onBackToLogin }: { onDone: () => void; onBackToLogin: () => void }) {
  const [tok, setTok] = useState<{ at?: string; rt?: string; type?: string }>({})
  const [ready, setReady] = useState(false)
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [showPw, setShowPw] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState("")
  const [done, setDone] = useState(false)
  useEffect(() => {
    const hp = new URLSearchParams(window.location.hash.replace(/^#/, ""))
    setTok({ at: hp.get("access_token") || undefined, rt: hp.get("refresh_token") || undefined, type: hp.get("type") || undefined })
    setReady(true)
  }, [])
  const valid = ready && !!tok.at
  const submit = async () => {
    setErr("")
    if (password.length < 8) { setErr("A senha precisa de ao menos 8 caracteres."); return }
    if (password !== confirm) { setErr("As senhas não coincidem."); return }
    setBusy(true)
    try {
      const r = await fetch("/api/platform?action=auth-update-password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ access_token: tok.at, password }) })
      const j = await r.json().catch(() => ({}))
      if (!r.ok || !j.ok) { setErr((j && j.detail) || "Não consegui redefinir a senha. O link pode ter expirado — peça um novo."); setBusy(false); return }
      try { localStorage.setItem(DSS_SESSION_KEY, JSON.stringify({ access_token: tok.at, refresh_token: tok.rt })) } catch {}
      try { window.history.replaceState(null, "", window.location.pathname) } catch {}
      setDone(true); setTimeout(onDone, 900)
    } catch { setErr("Falha de conexão. Tente de novo."); setBusy(false) }
  }
  return (
    <div className="dss-fade" style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 30 }}>
      <div style={{ ...PANEL, padding: "36px 34px", maxWidth: 440, width: "100%" }}>
        <div style={{ width: 40, height: 40, borderRadius: 11, marginBottom: 16, background: "linear-gradient(145deg,#6f6f72,#2b2b2e)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "var(--shadow-md)" }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M12 2 21 7v10l-9 5-9-5V7z" stroke="#fff" strokeWidth="1.4" opacity=".9" /></svg>
        </div>
        <div className="dss-display" style={{ fontSize: 24, fontWeight: 800, letterSpacing: "-0.03em" }}>Nova senha</div>
        {!ready ? (
          <p style={{ fontSize: 13.5, color: "var(--ink-subtle)", marginTop: 8 }}>Carregando…</p>
        ) : !valid ? (<>
          <p style={{ fontSize: 13.5, color: "var(--ink-muted)", lineHeight: 1.6, margin: "8px 0 0" }}>Link inválido ou expirado. Volte e peça um novo link de redefinição.</p>
          <button className="dss-btn" onClick={onBackToLogin} style={{ marginTop: 18, background: "var(--surface-2)", color: "var(--ink)", border: "1px solid var(--hairline-strong)", borderRadius: 999, padding: "11px 18px", fontSize: 13.5, fontWeight: 600, cursor: "pointer", fontFamily: "var(--font-sans)" }}>Voltar para entrar</button>
        </>) : done ? (
          <p style={{ fontSize: 13.5, color: "var(--accent-ink)", fontWeight: 600, marginTop: 12 }}>Senha redefinida! Entrando…</p>
        ) : (<>
          <p style={{ fontSize: 13.5, color: "var(--ink-muted)", lineHeight: 1.6, margin: "8px 0 0" }}>Crie uma nova senha para sua conta.</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 18 }}>
            <PwField value={password} set={setPassword} placeholder="Nova senha (8+ caracteres)" autoComplete="new-password" show={showPw} toggle={() => setShowPw(s => !s)} onEnter={submit} />
            <PwField value={confirm} set={setConfirm} placeholder="Confirme a nova senha" autoComplete="new-password" show={showPw} toggle={() => setShowPw(s => !s)} onEnter={submit} />
          </div>
          <button className="dss-btn" disabled={busy} onClick={submit} style={{ width: "100%", marginTop: 16, background: busy ? "var(--surface-3)" : "var(--primary)", color: busy ? "var(--ink-subtle)" : "var(--on-primary)", border: "none", borderRadius: 999, padding: "13px", fontSize: 14, fontWeight: 600, cursor: busy ? "not-allowed" : "pointer", fontFamily: "var(--font-sans)" }}>{busy ? "Salvando…" : "Redefinir senha"}</button>
          {err && <div style={{ marginTop: 12, fontSize: 12.5, color: "var(--err)", fontWeight: 600, background: "var(--err-soft)", padding: "9px 11px", borderRadius: 9, lineHeight: 1.5 }}>{err}</div>}
        </>)}
      </div>
    </div>
  )
}

const LP_CSS = `
@keyframes lpRevealUp{from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:none}}
@keyframes lpLiveDot{0%{box-shadow:0 0 0 0 rgba(31,164,99,.5)}70%{box-shadow:0 0 0 7px rgba(31,164,99,0)}100%{box-shadow:0 0 0 0 rgba(31,164,99,0)}}
@keyframes lpBlink{0%,48%{opacity:1}49%,100%{opacity:0}}
@keyframes lpScan{0%{top:7%}50%{top:90%}100%{top:7%}}
@keyframes lpMarquee{0%{transform:translateX(0)}100%{transform:translateX(-50%)}}
@keyframes lpPlayhead{0%{left:1%}100%{left:99%}}
@keyframes lpPulseRing{0%,100%{opacity:0;transform:scale(.7)}45%{opacity:1;transform:scale(1.25)}}
@keyframes lpRulerCursor{0%{left:0%}100%{left:100%}}
.lp-root[data-motion="off"] *{animation:none !important}
@media (prefers-reduced-motion: reduce){.lp-root *{animation:none !important}}
.lp-root a{text-decoration:none;color:inherit}
.lp-root ::selection{background:#E7F7EE;color:#178551}
.lp-na{padding:8px 12px;border-radius:12px;font-size:14px;font-weight:600;color:#6E6E70;background:none;border:none;cursor:pointer;font-family:inherit;transition:background .15s,color .15s}
.lp-na:hover{background:#F7F7F5;color:#1A1A1C}
.lp-ink{background:#1A1A1C;color:#fff;border:none;cursor:pointer;font-family:inherit;transition:background .15s}
.lp-ink:hover{background:#000}
.lp-soft{background:#fff;border:1px solid #E2E2DF;color:#1A1A1C;cursor:pointer;font-family:inherit;transition:background .15s}
.lp-soft:hover{background:#F7F7F5}
.lp-feat{background:#fff;transition:background .15s}
.lp-feat:hover{background:#F7F7F5}
.lp-fa{color:#6E6E70;cursor:pointer;background:none;border:none;font-family:inherit;padding:0;text-align:left;text-decoration:none;transition:color .15s}
.lp-fa:hover{color:#1A1A1C}
.lp-ctaw{background:#fff;color:#1A1A1C;border:none;cursor:pointer;font-family:inherit;transition:background .15s}
.lp-ctaw:hover{background:#F2F2F0}
.lp-ctao{background:transparent;border:1px solid rgba(255,255,255,.22);color:#fff;cursor:pointer;font-family:inherit;transition:background .15s}
.lp-ctao:hover{background:rgba(255,255,255,.08)}
@media (max-width:980px){
.lp-root [data-grid="hero"]{grid-template-columns:1fr!important;gap:32px!important}
.lp-root [data-grid="two"]{grid-template-columns:1fr!important;gap:28px!important}
.lp-root [data-grid="cards4"]{grid-template-columns:repeat(2,minmax(0,1fr))!important}
.lp-root [data-grid="five"]{grid-template-columns:repeat(3,minmax(0,1fr))!important;gap:22px 14px!important}
.lp-root [data-grid="stats4"]{grid-template-columns:repeat(2,minmax(0,1fr))!important}
.lp-root [data-h="hero"]{font-size:44px!important}
.lp-root [data-spec]{height:400px!important}
}
@media (max-width:640px){
.lp-root section{padding-left:18px!important;padding-right:18px!important;padding-top:60px!important}
.lp-root footer{padding-left:18px!important;padding-right:18px!important}
.lp-root [data-heropad]{padding:18px 0 44px!important}
.lp-root [data-navlinks]{display:none!important}
.lp-root [data-grid="cards4"],.lp-root [data-grid="stats4"],.lp-root [data-grid="five"],.lp-root [data-grid="inv"]{grid-template-columns:1fr!important}
.lp-root [data-h="hero"]{font-size:33px!important;line-height:1.06!important}
.lp-root [data-h="sec"]{font-size:24px!important}
.lp-root [data-h="cta"]{font-size:30px!important}
.lp-root [data-ctacard]{padding:44px 22px!important}
.lp-root [data-mscroll]{overflow-x:auto!important;-webkit-overflow-scrolling:touch}
.lp-root [data-mscroll]>div{min-width:600px!important}
}
`

// ─── LandingPage — "Instrumento de precisão" (rota / deslogada) ──────────────
function LandingPage({ onAuth }: { onAuth: (mode?: "signin" | "signup") => void }) {
  const rootRef = useRef<HTMLDivElement | null>(null)
  const MONO = "ui-monospace, 'SF Mono', Menlo, monospace"
  const beta = () => onAuth("signup")
  const signin = () => onAuth("signin")
  const toSec = (id: string) => (e: React.MouseEvent) => { e.preventDefault(); const el = rootRef.current?.querySelector("#" + id); if (el) el.scrollIntoView({ behavior: "smooth", block: "start" }) }

  const Mono = ({ size = 11, color = "#9B9B9D", weight = 400 as any, children, style }: any) => <span style={{ fontFamily: MONO, fontSize: size, color, fontWeight: weight, ...style }}>{children}</span>
  const Hex = ({ box = 30, glyph = 13 }: { box?: number; glyph?: number }) => (
    <div style={{ width: box, height: box, borderRadius: 9, background: "linear-gradient(145deg,#6f6f72,#2b2b2e)", boxShadow: "0 1px 2px rgba(20,20,22,.2),0 2px 6px rgba(20,20,22,.12)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
      <div style={{ width: glyph, height: glyph, background: "#fff", clipPath: "polygon(50% 0, 93% 25%, 93% 75%, 50% 100%, 7% 75%, 7% 25%)" }} />
    </div>
  )
  const Wordmark = () => <span style={{ fontWeight: 800, letterSpacing: "-.03em", fontSize: 18 }}>ds<span style={{ opacity: .35, marginLeft: ".22em" }}>studio</span></span>
  const SectionHead = ({ n, title, meta, id }: { n: string; title: string; meta: string; id?: string }) => (
    <div data-reveal id={id} style={{ display: "flex", alignItems: "flex-end", gap: 16, borderBottom: "1px solid #E2E2DF", paddingBottom: 16, flexWrap: "wrap" }}>
      <Mono size={13} color="#178551" weight={600}>{n}</Mono>
      <h2 data-h="sec" style={{ margin: 0, fontSize: 32, fontWeight: 800, letterSpacing: "-.03em", lineHeight: 1.05 }}>{title}</h2>
      <Mono size={12} style={{ marginLeft: "auto" }}>{meta}</Mono>
    </div>
  )

  const ticks = Array.from({ length: 49 }, (_, i) => { const major = i % 6 === 0; return { h: major ? 18 : 7, c: major ? "#C9C9C6" : "#E2E2DF" } })
  const wave = Array.from({ length: 64 }, (_, i) => ({ h: 6 + Math.round((Math.abs(Math.sin(i * 0.55)) * 0.7 + Math.abs(Math.sin(i * 0.21)) * 0.3) * 30) }))
  const registry = [
    { name: "Button", vars: "18 var", dot: "#1FA463" }, { name: "Input", vars: "14 var", dot: "#1FA463" },
    { name: "Card", vars: "9 var", dot: "#1FA463" }, { name: "Badge", vars: "12 var", dot: "#B7791F" },
    { name: "Select", vars: "11 var", dot: "#1FA463" }, { name: "Modal", vars: "7 var", dot: "#B7791F" },
    { name: "Tabs", vars: "6 var", dot: "#1FA463" }, { name: "Tooltip", vars: "5 var", dot: "#E5484D" },
    { name: "Avatar", vars: "8 var", dot: "#1FA463" }, { name: "Switch", vars: "4 var", dot: "#1FA463" },
  ]
  const Y = { size: 12, bg: "#1FA463", border: "none" }, P = { size: 9, bg: "#B7791F", border: "none" }, Nn = { size: 11, bg: "transparent", border: "1.5px solid #D8D8D5" }
  const pick = (s: string) => (s === "y" ? Y : s === "p" ? P : Nn)
  const mk = (states: string[]) => states.map((s, i) => ({ ...pick(s), cellBg: i === 4 ? "#F3FBF6" : "transparent" }))
  const matrixCols = [
    { name: "Documentação", color: "#6E6E70", weight: 600 }, { name: "Tokens", color: "#6E6E70", weight: 600 },
    { name: "Catálogo", color: "#6E6E70", weight: 600 }, { name: "Handoff", color: "#6E6E70", weight: 600 },
    { name: "DS Studio", color: "#178551", weight: 800 },
  ]
  const matrixRows = [
    { label: "Gera código React/TS", cells: mk(["n", "n", "n", "n", "y"]) },
    { label: "Documentação automática", cells: mk(["y", "n", "n", "n", "y"]) },
    { label: "Tokens & foundations", cells: mk(["p", "y", "n", "p", "y"]) },
    { label: "Versionamento", cells: mk(["y", "y", "n", "n", "y"]) },
    { label: "Permissões & governança", cells: mk(["y", "n", "n", "n", "y"]) },
    { label: "Site publicado", cells: mk(["n", "n", "p", "n", "y"]) },
  ]
  const GRID5 = "minmax(0,1.6fr) repeat(5,minmax(0,1fr))"
  const pipeline = [
    { n: 1, name: "Extrair", delay: "0s", desc: "PNG, SVG, tokens, variantes, anatomia e a11y direto do Figma." },
    { n: 2, name: "Planejar", delay: "1.2s", desc: "A IA classifica cada eixo de variante e emite um plano JSON vinculante." },
    { n: 3, name: "Construir", delay: "2.4s", desc: "Código React/TypeScript com CVA e CSS, alimentado pelo plano." },
    { n: 4, name: "Julgar", delay: "3.6s", desc: "Mede o render, corrige e re-mede — até 2 vezes." },
    { n: 5, name: "Publicar", delay: "4.8s", desc: "Commit no GitHub, deploy na Vercel e site no ar." },
  ]
  const invariants = [
    { txt: "Contrato de props (CVA = plataforma)", delay: 0 }, { txt: "Ícone shrink-0 não colapsa", delay: 40 },
    { txt: "HUG sem largura fixa", delay: 80 }, { txt: "Eixo de variante fora da base CVA", delay: 120 },
    { txt: "Token dimensional em px", delay: 160 }, { txt: "Content gating por eixo", delay: 200 },
  ]
  const bigStats = [
    { label: "Componentes", num: 22, suffix: "", display: "22", sub: "catalogados e versionados", trend: null as any, delay: 0 },
    { label: "Variantes", num: 102, suffix: "", display: "102", sub: "geradas e julgadas", trend: null as any, delay: 50 },
    { label: "Tokens", num: 93, suffix: "", display: "93", sub: "alias até 6 níveis", trend: null as any, delay: 100 },
    { label: "Cobertura", num: 94, suffix: "%", display: "94%", sub: "do design system", trend: "6%", delay: 150 },
  ]
  const miniFacts = [{ v: "6", l: "invariantes" }, { v: "3", l: "estágios agênticos" }, { v: "15", l: "módulos / feature flags" }, { v: "12", l: "tabelas + RLS" }]
  const features = [
    { code: "Ct", idx: "01", title: "Catálogo vivo", desc: "Grupos, variantes e volume com drill-down." },
    { code: "Fd", idx: "02", title: "Foundations", desc: "Cores, espaçamento, radius e stroke com aliases." },
    { code: "Vr", idx: "03", title: "Versionamento", desc: "Changelog por diff, acumulado e por componente." },
    { code: "Cu", idx: "04", title: "Curadoria", desc: "Esconda, renomeie, defina status e ordem." },
    { code: "Pm", idx: "05", title: "Permissões", desc: "Owner, Admin, Editor e Viewer em cascata." },
    { code: "Lg", idx: "06", title: "Activity log", desc: "Timeline de publicações e deleções." },
    { code: "Md", idx: "07", title: "Módulos", desc: "15 feature flags com cascata de resolução." },
    { code: "Dp", idx: "08", title: "Deploy", desc: "Commit no GitHub e auto-deploy na Vercel." },
  ]
  const govFacts = [
    { num: 4, suffix: "", display: "4", label: "níveis de permissão" },
    { num: 1, suffix: "", display: "1", label: "projeto = repo = site" },
    { num: 0, suffix: "", display: "R$0", label: "para o Viewer" },
  ]
  const roles = [
    { lvl: "L0", name: "Platform Admin", scope: "Vê tudo, gerencia a plataforma", dot: "#1A1A1C", bg: "#fff", border: "#ECECEA", free: false },
    { lvl: "L1", name: "Org Owner", scope: "Projetos, billing e membros", dot: "#6E6E70", bg: "#fff", border: "#ECECEA", free: false },
    { lvl: "L1", name: "Org Admin", scope: "Gerencia membros", dot: "#6E6E70", bg: "#fff", border: "#ECECEA", free: false },
    { lvl: "L2", name: "Project Owner / Admin", scope: "Controle e curadoria do projeto", dot: "#9B9B9D", bg: "#fff", border: "#ECECEA", free: false },
    { lvl: "L2", name: "Editor", scope: "Publica e edita documentação", dot: "#9B9B9D", bg: "#fff", border: "#ECECEA", free: false },
    { lvl: "L2", name: "Viewer", scope: "Consulta o design system", dot: "#1FA463", bg: "#E7F7EE", border: "#D4EFE0", free: true },
  ]

  useEffect(() => {
    const root = rootRef.current; if (!root) return
    const easeOut = (t: number) => 1 - Math.pow(1 - t, 3)
    const inView = (el: Element, margin = 80) => { const r = el.getBoundingClientRect(); const h = window.innerHeight || document.documentElement.clientHeight; return r.top < h - margin && r.bottom > 0 }
    const rev = Array.from(root.querySelectorAll<HTMLElement>("[data-reveal]"))
    rev.forEach(el => { el.style.opacity = "0"; el.style.transform = "translateY(18px)" })
    const showEl = (el: HTMLElement) => { if (el.dataset.shown) return; el.dataset.shown = "1"; const d = parseFloat(el.getAttribute("data-delay") || "0"); el.style.opacity = "1"; el.style.transform = "none"; el.style.animation = "lpRevealUp .6s cubic-bezier(.2,.7,.3,1) " + d + "ms both" }
    const counts = Array.from(root.querySelectorAll<HTMLElement>("[data-count]"))
    const animateCount = (el: HTMLElement) => { const to = parseFloat(el.getAttribute("data-count") || ""); const suf = el.getAttribute("data-suffix") || ""; const disp = el.textContent || ""; const prefix = (disp.match(/^\D+/) || [""])[0]; if (isNaN(to)) return; const dur = 1100, start = performance.now(); const step = (now: number) => { const p = Math.min(1, (now - start) / dur); const v = Math.round(to * easeOut(p)); el.textContent = prefix + v + suf; if (p < 1) requestAnimationFrame(step) }; requestAnimationFrame(step) }
    const runCount = (el: HTMLElement) => { if (el.dataset.counted) return; el.dataset.counted = "1"; animateCount(el) }
    const sweep = () => { rev.forEach(el => { if (inView(el)) showEl(el) }); counts.forEach(el => { if (inView(el, -10)) runCount(el) }) }
    sweep()
    let rio: IntersectionObserver | null = null, cio: IntersectionObserver | null = null
    if ("IntersectionObserver" in window) {
      rio = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { showEl(e.target as HTMLElement); rio && rio.unobserve(e.target) } }), { threshold: 0.12 })
      rev.forEach(el => { if (!el.dataset.shown) rio!.observe(el) })
      cio = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { runCount(e.target as HTMLElement); cio && cio.unobserve(e.target) } }), { threshold: 0.4 })
      counts.forEach(el => { if (!el.dataset.counted) cio!.observe(el) })
    }
    let ticking = false
    const onScroll = () => { if (ticking) return; ticking = true; requestAnimationFrame(() => { sweep(); ticking = false }) }
    window.addEventListener("scroll", onScroll, { passive: true })
    window.addEventListener("resize", onScroll, { passive: true })
    const safety = setTimeout(() => {
      rev.forEach(el => { if (!el.dataset.shown || getComputedStyle(el).opacity === "0") { el.dataset.shown = "1"; el.style.animation = "none"; el.style.opacity = "1"; el.style.transform = "none" } })
      counts.forEach(el => { if (!el.dataset.counted) runCount(el) })
    }, 1400)
    return () => { window.removeEventListener("scroll", onScroll); window.removeEventListener("resize", onScroll); if (rio) rio.disconnect(); if (cio) cio.disconnect(); clearTimeout(safety) }
  }, [])

  useEffect(() => {
    // Vindo de /pricing.html ou /privacy.html com #seção → rola até ela.
    const id = (typeof window !== "undefined" ? window.location.hash : "").replace(/^#/, "")
    if (!id) return
    const t = setTimeout(() => { const el = document.getElementById(id); if (el) el.scrollIntoView({ behavior: "smooth", block: "start" }) }, 140)
    return () => clearTimeout(t)
  }, [])

  const radials = "radial-gradient(1100px 720px at 10% -2%, rgba(31,164,99,.09), transparent 56%),radial-gradient(1000px 720px at 98% 1%, rgba(70,102,164,.26), transparent 52%),radial-gradient(900px 600px at 50% 46%, rgba(183,121,31,.09), transparent 60%),radial-gradient(1100px 760px at 62% 100%, rgba(31,164,99,.08), transparent 58%)"

  return (
    <div ref={rootRef} className="lp-root" data-motion="on" style={{ width: "100%", overflowX: "hidden", position: "relative", minHeight: "100vh", color: "#1A1A1C", fontFamily: "var(--font-sans)", backgroundColor: "#EDEFEA", backgroundRepeat: "no-repeat", backgroundImage: radials }}>
      <style>{LP_CSS}</style>

      {/* NAV */}
      <nav style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 60, backdropFilter: "saturate(140%) blur(10px)", WebkitBackdropFilter: "saturate(140%) blur(10px)", background: "rgba(242,242,240,.82)", borderBottom: "1px solid #ECECEA" }}>
        <div style={{ maxWidth: 1240, margin: "0 auto", padding: "13px 30px", display: "flex", alignItems: "center", gap: 26 }}>
          <a href="#top" onClick={toSec("top")} style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}><Hex /><Wordmark /></a>
          <Mono size={11} style={{ border: "1px solid #ECECEA", borderRadius: 999, padding: "3px 9px", display: "inline-flex", alignItems: "center", gap: 6 }}><span style={{ width: 6, height: 6, borderRadius: "50%", background: "#1FA463", animation: "lpLiveDot 2.4s infinite" }} />v1.26 · beta</Mono>
          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 2 }}>
            <div data-navlinks style={{ display: "flex", alignItems: "center", gap: 2 }}>
              <button className="lp-na" onClick={toSec("matriz")}>Por quê</button>
              <button className="lp-na" onClick={toSec("pipeline")}>Pipeline</button>
              <button className="lp-na" onClick={toSec("fidelidade")}>Fidelidade</button>
              <button className="lp-na" onClick={toSec("governanca")}>Governança</button>
            </div>
            <button className="lp-ink" onClick={beta} style={{ marginLeft: 8, height: 40, display: "flex", alignItems: "center", padding: "0 18px", borderRadius: 999, fontSize: 14, fontWeight: 600 }}>Acesso ao beta</button>
          </div>
        </div>
      </nav>

      <div id="top" style={{ height: 57 }} />

      {/* HERO */}
      <section style={{ position: "relative", backgroundImage: "radial-gradient(#E4E4E1 1.1px, transparent 1.1px)", backgroundSize: "26px 26px", backgroundPosition: "center top", borderBottom: "1px solid #ECECEA" }}>
        <div data-heropad style={{ maxWidth: 1240, margin: "0 auto", padding: "34px 30px 64px" }}>
          {/* ruler */}
          <div data-reveal style={{ position: "relative", height: 26, marginBottom: 38 }}>
            <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
              {ticks.map((t, i) => <div key={i} style={{ width: 1, height: t.h, background: t.c }} />)}
            </div>
            <div style={{ position: "absolute", bottom: 0, width: 2, height: 22, background: "#1FA463", boxShadow: "0 0 8px rgba(31,164,99,.6)", animation: "lpRulerCursor 7s cubic-bezier(.45,0,.55,1) infinite alternate" }} />
            <Mono size={10} style={{ position: "absolute", top: -3, left: 0 }}>0.00</Mono>
            <Mono size={10} style={{ position: "absolute", top: -3, right: 0 }}>100.00</Mono>
          </div>

          <div data-grid="hero" style={{ display: "grid", gridTemplateColumns: "minmax(0,1.04fr) minmax(0,0.96fr)", gap: 52, alignItems: "center" }}>
            <div data-reveal>
              <Mono size={12} color="#178551" weight={600} style={{ letterSpacing: ".04em" }}>[ § governança · do figma à produção ]</Mono>
              <h1 data-h="hero" style={{ margin: "16px 0 0", fontSize: 58, lineHeight: 1.02, fontWeight: 800, letterSpacing: "-.04em" }}>Governe seu design system como um instrumento de precisão.</h1>
              <p style={{ margin: "22px 0 0", fontSize: 16.5, lineHeight: 1.55, color: "#6E6E70", maxWidth: "31em" }}>Extrai do Figma, gera código React/TypeScript com IA, <strong style={{ color: "#1A1A1C", fontWeight: 700 }}>mede o resultado contra o original</strong> e publica um site vivo. Documentado, versionado, auditável — uma fonte de verdade, ponta a ponta.</p>
              <div style={{ margin: "30px 0 0", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                <button className="lp-ink" onClick={beta} style={{ height: 48, display: "flex", alignItems: "center", padding: "0 24px", borderRadius: 999, fontSize: 15, fontWeight: 700 }}>Pedir acesso ao beta</button>
                <button className="lp-soft" onClick={toSec("pipeline")} style={{ height: 48, display: "flex", alignItems: "center", gap: 8, padding: "0 20px", borderRadius: 999, fontSize: 15, fontWeight: 600 }}>Ver a pipeline<span style={{ color: "#9B9B9D" }}>→</span></button>
              </div>
              <Mono size={12.5} style={{ margin: "18px 0 0", display: "block" }}>// sem cartão · <span style={{ color: "#178551", fontWeight: 600 }}>viewer sempre grátis</span></Mono>
            </div>

            {/* specimen */}
            <div data-reveal data-delay={120} data-spec style={{ position: "relative", height: 460, background: "#fff", border: "1px solid #ECECEA", borderRadius: 22, boxShadow: "0 1px 3px rgba(20,20,22,.05),0 18px 44px -16px rgba(20,20,22,.16)", overflow: "hidden" }}>
              <div style={{ position: "absolute", inset: 0, backgroundImage: "linear-gradient(#F2F2F0 1px,transparent 1px),linear-gradient(90deg,#F2F2F0 1px,transparent 1px)", backgroundSize: "34px 34px", opacity: .6 }} />
              <div style={{ position: "absolute", top: 14, left: 14, width: 9, height: 9, borderTop: "1.5px solid #C9C9C6", borderLeft: "1.5px solid #C9C9C6" }} />
              <div style={{ position: "absolute", top: 14, right: 14, width: 9, height: 9, borderTop: "1.5px solid #C9C9C6", borderRight: "1.5px solid #C9C9C6" }} />
              <div style={{ position: "absolute", bottom: 14, left: 14, width: 9, height: 9, borderBottom: "1.5px solid #C9C9C6", borderLeft: "1.5px solid #C9C9C6" }} />
              <div style={{ position: "absolute", bottom: 14, right: 14, width: 9, height: 9, borderBottom: "1.5px solid #C9C9C6", borderRight: "1.5px solid #C9C9C6" }} />
              <Mono size={11} style={{ position: "absolute", top: 16, left: 30 }}>specimen — Button / primary <span style={{ color: "#1FA463", animation: "lpBlink 1.1s steps(1) infinite" }}>▌</span></Mono>
              <div style={{ position: "absolute", left: "6%", right: "6%", height: 2, background: "linear-gradient(90deg,transparent,#1FA463,transparent)", boxShadow: "0 0 14px rgba(31,164,99,.55)", animation: "lpScan 5s cubic-bezier(.45,0,.55,1) infinite" }} />
              <div style={{ position: "absolute", left: "50%", top: "52%", transform: "translate(-50%,-50%)" }}>
                <div style={{ position: "relative", display: "inline-block" }}>
                  <button className="lp-ink" onClick={beta} style={{ display: "flex", alignItems: "center", gap: 9, height: 48, padding: "0 24px", borderRadius: 999, fontSize: 15, fontWeight: 700, boxShadow: "0 8px 22px -6px rgba(31,164,99,.35)" }}><span style={{ width: 8, height: 8, borderRadius: "50%", background: "#1FA463", animation: "lpLiveDot 2.2s infinite" }} />Gerar componente</button>
                  <div style={{ position: "absolute", left: 0, right: 0, bottom: "calc(100% + 16px)", display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                    <Mono size={11} color="#6E6E70" style={{ background: "#fff", border: "1px solid #ECECEA", borderRadius: 6, padding: "2px 7px" }}>radius 999 · pad 0·24</Mono>
                    <div style={{ position: "relative", width: "100%", height: 1, background: "#9B9B9D" }}>
                      <span style={{ position: "absolute", left: 0, top: -3, width: 1, height: 7, background: "#9B9B9D" }} />
                      <span style={{ position: "absolute", right: 0, top: -3, width: 1, height: 7, background: "#9B9B9D" }} />
                    </div>
                  </div>
                  <div style={{ position: "absolute", top: 0, bottom: 0, left: "calc(100% + 16px)", display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ position: "relative", width: 1, height: "100%", background: "#9B9B9D" }}>
                      <span style={{ position: "absolute", top: 0, left: -3, width: 7, height: 1, background: "#9B9B9D" }} />
                      <span style={{ position: "absolute", bottom: 0, left: -3, width: 7, height: 1, background: "#9B9B9D" }} />
                    </div>
                    <Mono size={11} color="#6E6E70" style={{ background: "#fff", border: "1px solid #ECECEA", borderRadius: 6, padding: "2px 7px" }}>48px</Mono>
                  </div>
                </div>
              </div>
              <div style={{ position: "absolute", left: 30, bottom: 24, right: 30, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                <Mono size={11}>getComputedStyle → match</Mono>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 12, fontWeight: 700, color: "#178551", background: "#E7F7EE", borderRadius: 999, padding: "5px 12px" }}><span style={{ width: 14, height: 14, borderRadius: "50%", background: "#1FA463", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9 }}>✓</span>6/6 invariantes</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* TICKER */}
      <div style={{ borderBottom: "1px solid #ECECEA", background: "#fff", overflow: "hidden" }}>
        <div style={{ display: "flex", width: "max-content", animation: "lpMarquee 38s linear infinite" }}>
          {[0, 1].map(dup => (
            <div key={dup} style={{ display: "flex" }} aria-hidden={dup === 1}>
              {registry.map((r, i) => (
                <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: 9, padding: "13px 26px", borderRight: "1px solid #F2F2F0", fontFamily: MONO, fontSize: 12.5, color: "#6E6E70" }}>
                  <span style={{ width: 7, height: 7, borderRadius: "50%", background: r.dot }} />{r.name}<span style={{ color: "#9B9B9D" }}>·{r.vars}</span>
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* §01 MATRIX */}
      <section style={{ maxWidth: 1240, margin: "0 auto", padding: "96px 30px 0" }}>
        <SectionHead id="matriz" n="§01" title="As ferramentas atuais resolvem pedaços." meta="cobertura por categoria" />
        <p data-reveal style={{ margin: "18px 0 26px", fontSize: 15, lineHeight: 1.55, color: "#6E6E70", maxWidth: "44em" }}>Documentação, tokens, catálogo, handoff — cada categoria cobre uma etapa e deixa o resto para processos manuais. A única coluna preenchida ponta a ponta é a que governa o ciclo inteiro.</p>
        <div data-reveal data-delay={80} data-mscroll style={{ background: "#fff", border: "1px solid #ECECEA", borderRadius: 22, boxShadow: "0 1px 3px rgba(20,20,22,.05),0 14px 36px -16px rgba(20,20,22,.12)", overflow: "hidden" }}>
          <div>
          <div style={{ display: "grid", gridTemplateColumns: GRID5 }}>
            <div style={{ padding: "18px 22px", fontFamily: MONO, fontSize: 10.5, letterSpacing: ".06em", textTransform: "uppercase", color: "#9B9B9D", fontWeight: 600 }}>capacidade</div>
            {matrixCols.map((col, i) => (
              <div key={i} style={{ padding: "18px 8px", textAlign: "center", background: i === 4 ? "#F3FBF6" : "#fff" }}>
                <span style={{ fontSize: 13, fontWeight: col.weight, color: col.color, letterSpacing: "-.01em" }}>{col.name}</span>
              </div>
            ))}
          </div>
          {matrixRows.map((row, ri) => (
            <div key={ri} style={{ display: "grid", gridTemplateColumns: GRID5, borderTop: "1px solid #ECECEA" }}>
              <div style={{ padding: "16px 22px", fontSize: 14, fontWeight: 600, display: "flex", alignItems: "center" }}>{row.label}</div>
              {row.cells.map((c, ci) => (
                <div key={ci} style={{ display: "flex", alignItems: "center", justifyContent: "center", background: c.cellBg }}>
                  <span style={{ width: c.size, height: c.size, borderRadius: "50%", background: c.bg, border: c.border }} />
                </div>
              ))}
            </div>
          ))}
          </div>
        </div>
        <div data-reveal style={{ marginTop: 14, display: "flex", alignItems: "center", gap: 22, flexWrap: "wrap", fontSize: 12.5, color: "#6E6E70" }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}><span style={{ width: 12, height: 12, borderRadius: "50%", background: "#1FA463" }} />completo</span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}><span style={{ width: 9, height: 9, borderRadius: "50%", background: "#B7791F" }} />parcial</span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}><span style={{ width: 11, height: 11, borderRadius: "50%", border: "1.5px solid #D8D8D5" }} />ausente</span>
        </div>
      </section>

      {/* §02 PIPELINE */}
      <section style={{ maxWidth: 1240, margin: "0 auto", padding: "96px 30px 0" }}>
        <SectionHead id="pipeline" n="§02" title="Um motor agêntico que planeja, constrói e julga." meta="5 etapas · 0 handoff manual" />
        <div data-reveal data-delay={80} style={{ marginTop: 26, background: "#fff", border: "1px solid #ECECEA", borderRadius: 22, boxShadow: "0 1px 3px rgba(20,20,22,.05),0 14px 36px -16px rgba(20,20,22,.12)", padding: "30px 26px" }}>
          <div style={{ position: "relative", height: 54, marginBottom: 8 }}>
            <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 2 }}>
              {wave.map((w, i) => <div key={i} style={{ flex: 1, height: w.h, background: "#EAEAE7", borderRadius: 2 }} />)}
            </div>
            <div style={{ position: "absolute", top: -6, bottom: -6, width: 2, background: "#1FA463", boxShadow: "0 0 10px rgba(31,164,99,.55)", animation: "lpPlayhead 6s cubic-bezier(.45,0,.55,1) infinite alternate" }}>
              <span style={{ position: "absolute", top: -7, left: -3, width: 8, height: 8, borderRadius: "50%", background: "#1FA463" }} />
            </div>
          </div>
          <div data-grid="five" style={{ position: "relative", display: "grid", gridTemplateColumns: "repeat(5,minmax(0,1fr))", gap: 14 }}>
            {pipeline.map((p, i) => (
              <div key={i} style={{ textAlign: "left" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                  <span style={{ position: "relative", width: 32, height: 32, borderRadius: 9, background: "#F7F7F5", border: "1px solid #E2E2DF", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: MONO, fontSize: 12, fontWeight: 700, color: "#1A1A1C" }}>
                    <span style={{ position: "absolute", inset: -1, borderRadius: 9, border: "2px solid #1FA463", animation: "lpPulseRing 6s infinite", animationDelay: p.delay }} />0{p.n}
                  </span>
                  <span style={{ fontSize: 16, fontWeight: 700, letterSpacing: "-.02em" }}>{p.name}</span>
                </div>
                <div style={{ marginTop: 10, fontSize: 13, lineHeight: 1.5, color: "#6E6E70" }}>{p.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* §03 FIDELITY */}
      <section style={{ maxWidth: 1240, margin: "0 auto", padding: "96px 30px 0" }}>
        <SectionHead id="fidelidade" n="§03" title="Não chuta código. Mede o resultado." meta="julga → corrige → re-mede" />
        <div data-grid="two" style={{ marginTop: 26, display: "grid", gridTemplateColumns: "minmax(0,0.88fr) minmax(0,1.12fr)", gap: 40, alignItems: "center" }}>
          <div data-reveal>
            <p style={{ margin: 0, fontSize: 16, lineHeight: 1.6, color: "#6E6E70" }}>O agente julgador não lê o código gerado — resolve as classes em CSS real, lê o <span style={{ fontFamily: MONO, fontSize: 13, background: "#F7F7F5", border: "1px solid #ECECEA", borderRadius: 6, padding: "1px 6px" }}>getComputedStyle</span> e compara com o original do Figma. Diverge? Corrige e re-mede.</p>
            <div style={{ marginTop: 22, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <span style={{ fontFamily: MONO, fontSize: 13, fontWeight: 700, color: "#178551", background: "#E7F7EE", borderRadius: 12, padding: "11px 15px" }}>loop até 2 iterações</span>
              <span style={{ fontFamily: MONO, fontSize: 13, color: "#6E6E70", background: "#fff", border: "1px solid #ECECEA", borderRadius: 12, padding: "11px 15px" }}>guard-railed por preflight</span>
            </div>
          </div>
          <div>
            <div data-reveal style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: ".06em", textTransform: "uppercase", color: "#9B9B9D", fontWeight: 600, marginBottom: 12 }}>6 invariantes verificados antes de publicar</div>
            <div data-grid="inv" style={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: 10 }}>
              {invariants.map((iv, i) => (
                <div key={i} data-reveal data-delay={iv.delay} style={{ display: "flex", alignItems: "center", gap: 11, background: "#fff", border: "1px solid #ECECEA", borderRadius: 14, padding: 14, boxShadow: "0 1px 2px rgba(20,20,22,.04)" }}>
                  <span style={{ flexShrink: 0, width: 22, height: 22, borderRadius: 7, background: "#E7F7EE", color: "#178551", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 800 }}>✓</span>
                  <span style={{ fontSize: 13.5, fontWeight: 600, lineHeight: 1.35 }}>{iv.txt}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* §04 NUMBERS */}
      <section style={{ maxWidth: 1240, margin: "0 auto", padding: "96px 30px 0" }}>
        <SectionHead n="§04" title="Dados, não adjetivos." meta="ref: KENOS design system" />
        <div data-grid="stats4" style={{ marginTop: 30, display: "grid", gridTemplateColumns: "repeat(4,minmax(0,1fr))", border: "1px solid #ECECEA", borderRadius: 22, overflow: "hidden", background: "#fff", boxShadow: "0 1px 3px rgba(20,20,22,.05),0 14px 36px -16px rgba(20,20,22,.12)" }}>
          {bigStats.map((s, i) => (
            <div key={i} data-reveal data-delay={s.delay} style={{ padding: "30px 26px", borderRight: i < 3 ? "1px solid #ECECEA" : "none" }}>
              <div style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: ".06em", textTransform: "uppercase", color: "#9B9B9D", fontWeight: 600 }}>{s.label}</div>
              <div style={{ marginTop: 14, display: "flex", alignItems: "baseline", gap: 9 }}>
                <span style={{ fontFamily: MONO, fontSize: 54, fontWeight: 800, letterSpacing: "-.045em", lineHeight: .9 }} data-count={s.num} data-suffix={s.suffix}>{s.display}</span>
                {s.trend && <span style={{ fontSize: 12, fontWeight: 700, color: "#178551", background: "#E7F7EE", borderRadius: 999, padding: "3px 9px" }}>▲ {s.trend}</span>}
              </div>
              <div style={{ marginTop: 12, fontSize: 12.5, color: "#6E6E70", lineHeight: 1.4 }}>{s.sub}</div>
            </div>
          ))}
        </div>
        <div data-reveal style={{ marginTop: 14, display: "flex", gap: 8, flexWrap: "wrap" }}>
          {miniFacts.map((f, i) => (
            <span key={i} style={{ display: "inline-flex", alignItems: "baseline", gap: 7, background: "#fff", border: "1px solid #ECECEA", borderRadius: 999, padding: "8px 14px", fontSize: 13, color: "#6E6E70" }}>
              <span style={{ fontFamily: MONO, fontWeight: 700, color: "#1A1A1C" }}>{f.v}</span>{f.l}
            </span>
          ))}
        </div>
      </section>

      {/* §05 FEATURES */}
      <section style={{ maxWidth: 1240, margin: "0 auto", padding: "96px 30px 0" }}>
        <SectionHead id="recursos" n="§05" title="Tudo para governar o sistema." meta="8 módulos" />
        <div data-grid="cards4" style={{ marginTop: 6, borderLeft: "1px solid #ECECEA", borderTop: "1px solid #ECECEA", display: "grid", gridTemplateColumns: "repeat(4,minmax(0,1fr))" }}>
          {features.map((f, i) => (
            <div key={i} data-reveal data-delay={i * 30} className="lp-feat" style={{ padding: "24px 22px", borderRight: "1px solid #ECECEA", borderBottom: "1px solid #ECECEA", position: "relative" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ width: 34, height: 34, borderRadius: 10, background: "#F7F7F5", border: "1px solid #ECECEA", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: MONO, fontSize: 13, fontWeight: 700, color: "#6E6E70" }}>{f.code}</div>
                <Mono size={11} color="#C9C9C6">{f.idx}</Mono>
              </div>
              <div style={{ marginTop: 14, fontSize: 16, fontWeight: 700, letterSpacing: "-.01em" }}>{f.title}</div>
              <div style={{ marginTop: 7, fontSize: 13.5, lineHeight: 1.5, color: "#6E6E70" }}>{f.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* §06 GOVERNANCE */}
      <section style={{ maxWidth: 1240, margin: "0 auto", padding: "96px 30px 0" }}>
        <SectionHead id="governanca" n="§06" title="Permissões em cascata. Viewer grátis." meta="platform → org → project → user" />
        <div data-grid="two" style={{ marginTop: 26, display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", gap: 40, alignItems: "center" }}>
          <div data-reveal>
            <p style={{ margin: 0, fontSize: 16, lineHeight: 1.6, color: "#6E6E70" }}>Resolução do mais específico para o mais amplo. Um projeto = um repositório = um site, isolados por RLS. Quem consulta não paga; quem produz, sim.</p>
            <div style={{ marginTop: 22, display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: 10 }}>
              {govFacts.map((g, i) => (
                <div key={i} style={{ background: "#fff", border: "1px solid #ECECEA", borderRadius: 16, padding: 16 }}>
                  <div style={{ fontFamily: MONO, fontSize: 24, fontWeight: 800, letterSpacing: "-.03em" }} data-count={g.num} data-suffix={g.suffix}>{g.display}</div>
                  <div style={{ marginTop: 6, fontSize: 12, color: "#6E6E70", lineHeight: 1.35 }}>{g.label}</div>
                </div>
              ))}
            </div>
          </div>
          <div data-reveal data-delay={120} style={{ background: "#fff", border: "1px solid #ECECEA", borderRadius: 22, boxShadow: "0 1px 3px rgba(20,20,22,.05),0 14px 36px -16px rgba(20,20,22,.12)", padding: 14 }}>
            {roles.map((r, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: 14, borderRadius: 14, marginBottom: 4, background: r.bg, border: "1px solid " + r.border }}>
                <Mono size={11} style={{ width: 18 }}>{r.lvl}</Mono>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: r.dot, flexShrink: 0 }} />
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 700 }}>{r.name}</div>
                  <div style={{ fontSize: 12.5, color: "#6E6E70" }}>{r.scope}</div>
                </div>
                {r.free && <span style={{ fontSize: 11.5, fontWeight: 700, color: "#178551", background: "#E7F7EE", borderRadius: 999, padding: "3px 11px" }}>Grátis</span>}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section style={{ maxWidth: 1240, margin: "0 auto", padding: "96px 30px 0" }}>
        <div data-reveal data-ctacard style={{ position: "relative", background: "#1A1A1C", borderRadius: 28, padding: "60px 40px", overflow: "hidden", boxShadow: "0 1px 3px rgba(20,20,22,.06),0 28px 60px -20px rgba(20,20,22,.40)" }}>
          <div style={{ position: "absolute", inset: 0, background: "radial-gradient(560px 320px at 18% 0%, rgba(31,164,99,.22), transparent 60%),radial-gradient(620px 380px at 100% 110%, rgba(31,164,99,.12), transparent 62%)" }} />
          <div style={{ position: "absolute", inset: 0, backgroundImage: "linear-gradient(rgba(255,255,255,.04) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.04) 1px,transparent 1px)", backgroundSize: "34px 34px" }} />
          <div style={{ position: "absolute", left: 0, right: 0, top: 30, height: 2, background: "linear-gradient(90deg,transparent,rgba(61,214,140,.6),transparent)", animation: "lpRulerCursor 7s cubic-bezier(.45,0,.55,1) infinite alternate" }} />
          <div style={{ position: "relative", textAlign: "center" }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "rgba(31,164,99,.16)", color: "#3DD68C", borderRadius: 999, padding: "6px 13px", fontFamily: MONO, fontSize: 12, fontWeight: 600 }}><span style={{ width: 7, height: 7, borderRadius: "50%", background: "#3DD68C", animation: "lpLiveDot 2.4s infinite" }} />beta privado · convites abertos</div>
            <h2 data-h="cta" style={{ margin: "18px auto 0", maxWidth: "18ch", fontSize: 44, fontWeight: 800, letterSpacing: "-.035em", lineHeight: 1.04, color: "#fff" }}>Traga seu Figma. Veja o sistema ganhar vida.</h2>
            <p style={{ margin: "16px auto 0", maxWidth: "42ch", fontSize: 16, lineHeight: 1.5, color: "#C9C9CB" }}>Estamos em testes privados com um grupo pequeno. Entre na lista e ajude a moldar o produto.</p>
            <div style={{ margin: "30px 0 0", display: "flex", justifyContent: "center", gap: 12, flexWrap: "wrap" }}>
              <button className="lp-ctaw" onClick={beta} style={{ height: 48, display: "flex", alignItems: "center", padding: "0 26px", borderRadius: 999, fontSize: 15, fontWeight: 700 }}>Pedir acesso ao beta</button>
              <button className="lp-ctao" onClick={signin} style={{ height: 48, display: "flex", alignItems: "center", padding: "0 24px", borderRadius: 999, fontSize: 15, fontWeight: 600 }}>Entrar</button>
            </div>
            <Mono size={12.5} style={{ marginTop: 16, display: "block" }}>// sem cartão · <span style={{ color: "#3DD68C", fontWeight: 600 }}>viewer sempre grátis</span></Mono>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer style={{ maxWidth: 1240, margin: "0 auto", padding: "62px 30px 56px" }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 32, flexWrap: "wrap", paddingBottom: 26, borderBottom: "1px solid #ECECEA" }}>
          <div style={{ maxWidth: "24em" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}><Hex /><Wordmark /></div>
            <p style={{ margin: "14px 0 0", fontSize: 13.5, lineHeight: 1.5, color: "#6E6E70" }}>Instrumento de precisão para design systems. Do Figma à produção, governado.</p>
          </div>
          <div style={{ display: "flex", gap: 56, flexWrap: "wrap" }}>
            <div>
              <Mono size={10.5} weight={600} style={{ letterSpacing: ".06em", textTransform: "uppercase" }}>Produto</Mono>
              <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 9, fontSize: 14 }}>
                <button className="lp-fa" onClick={toSec("matriz")}>Por quê</button>
                <button className="lp-fa" onClick={toSec("pipeline")}>Pipeline</button>
                <button className="lp-fa" onClick={toSec("fidelidade")}>Fidelidade</button>
                <button className="lp-fa" onClick={toSec("governanca")}>Governança</button>
                <a className="lp-fa" href="/pricing.html">Preços</a>
              </div>
            </div>
            <div>
              <Mono size={10.5} weight={600} style={{ letterSpacing: ".06em", textTransform: "uppercase" }}>Acesso</Mono>
              <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 9, fontSize: 14 }}>
                <button className="lp-fa" onClick={beta}>Pedir acesso ao beta</button>
                <button className="lp-fa" onClick={signin}>Entrar</button>
              </div>
            </div>
          </div>
        </div>
        <div style={{ marginTop: 24, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 18, flexWrap: "wrap" }}>
            <Mono size={12}>© 2026 DS Studio · todos os direitos reservados</Mono>
            <a className="lp-fa" href="/privacy.html" style={{ fontSize: 12 }}>Privacidade</a>
            <a className="lp-fa" href="/pricing.html" style={{ fontSize: 12 }}>Preços</a>
          </div>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 12, color: "#9B9B9D" }}>
            <span style={{ width: 16, height: 16, borderRadius: 5, background: "linear-gradient(145deg,#9b9b9d,#6e6e70)", display: "inline-flex", alignItems: "center", justifyContent: "center" }}><span style={{ width: 7, height: 7, background: "#fff", clipPath: "polygon(50% 0, 93% 25%, 93% 75%, 50% 100%, 7% 75%, 7% 25%)" }} /></span>
            Generated with DS Studio
          </span>
        </div>
      </footer>
    </div>
  )
}

// ─── InvitePage — aceite de convite por e-mail (/invite/{token}) ─────────────
function InvitePage({ token, session, refreshSession, onOpenProject, onHome }: { token: string; session: Session | null; refreshSession: () => void; onOpenProject: (p: any) => void; onHome: () => void }) {
  const [info, setInfo] = useState<any>(null)
  const [phase, setPhase] = useState<"loading" | "ready" | "working" | "done" | "error">("loading")
  const [err, setErr] = useState("")
  const triggered = useRef(false)
  const { login, busy } = useGitHubLogin(() => { triggered.current = true; refreshSession() })
  const ROLE_LABEL: Record<string, string> = { owner: "Owner", admin: "Admin", editor: "Editor", viewer: "Viewer" }

  useEffect(() => {
    let on = true
    fetch("/api/platform?action=invite-info&token=" + encodeURIComponent(token))
      .then(r => (r.ok ? r.json() : Promise.reject(new Error("Convite não encontrado."))))
      .then(j => { if (!on) return; if (!j.ok) throw new Error("Convite inválido."); setInfo(j); setPhase("ready") })
      .catch(e => { if (on) { setErr(String(e?.message || e)); setPhase("error") } })
    return () => { on = false }
  }, [token])

  const accept = async () => {
    if (!session?.accessToken) return
    setPhase("working"); setErr("")
    try {
      const r = await fetch("/api/platform?action=accept-invite", { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + session.accessToken }, body: JSON.stringify({ token }) })
      const j = await r.json().catch(() => ({}))
      if (!r.ok || !j.ok) throw new Error(j.detail || j.error || "Não consegui aceitar o convite.")
      setPhase("done"); setTimeout(() => onOpenProject(j.project), 700)
    } catch (e: any) { setErr(String(e?.message || e)); setPhase("error") }
  }

  // auto-aceita logo após o login iniciado nesta página
  useEffect(() => {
    if (triggered.current && session && info && info.status === "pending" && phase === "ready") accept()
  }, [session, info, phase]) // eslint-disable-line

  const ghBtn = (label: string, onClick: () => void, disabled?: boolean) => (
    <button className="dss-btn" onClick={onClick} disabled={disabled}
      style={{ width: "100%", marginTop: 18, background: "var(--primary)", color: "var(--on-primary)", border: "none", borderRadius: 999, padding: "13px", fontSize: 14, fontWeight: 600, cursor: disabled ? "wait" : "pointer", fontFamily: "var(--font-sans)", display: "flex", alignItems: "center", justifyContent: "center", gap: 10, opacity: disabled ? .7 : 1 }}>
      {label}
    </button>
  )

  return (
    <div className="dss-fade" style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 30 }}>
      <div style={{ ...PANEL, padding: "38px 36px", maxWidth: 460, width: "100%" }}>
        <div style={{ width: 40, height: 40, borderRadius: 11, marginBottom: 16, background: "linear-gradient(145deg,#6f6f72,#2b2b2e)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "var(--shadow-md)" }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M12 2 21 7v10l-9 5-9-5V7z" stroke="#fff" strokeWidth="1.4" opacity=".9" /></svg>
        </div>

        {phase === "loading" && <div style={{ fontSize: 13.5, color: "var(--ink-subtle)" }}>Carregando convite…</div>}

        {phase === "error" && (<>
          <div className="dss-display" style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.03em" }}>Convite indisponível</div>
          <p style={{ fontSize: 13.5, color: "var(--ink-muted)", lineHeight: 1.6, margin: "8px 0 0" }}>{err || "Este convite não é válido."}</p>
          <button className="dss-btn" onClick={onHome} style={{ marginTop: 18, background: "var(--surface-2)", color: "var(--ink)", border: "1px solid var(--hairline-strong)", borderRadius: 999, padding: "11px 18px", fontSize: 13.5, fontWeight: 600, cursor: "pointer", fontFamily: "var(--font-sans)" }}>Ir para o início</button>
        </>)}

        {(phase === "ready" || phase === "working" || phase === "done") && info && (
          info.status !== "pending" ? (<>
            <div className="dss-display" style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.03em" }}>Convite já utilizado</div>
            <p style={{ fontSize: 13.5, color: "var(--ink-muted)", lineHeight: 1.6, margin: "8px 0 0" }}>Este convite já foi aceito ou revogado. Peça um novo ao dono do projeto.</p>
            <button className="dss-btn" onClick={onHome} style={{ marginTop: 18, background: "var(--surface-2)", color: "var(--ink)", border: "1px solid var(--hairline-strong)", borderRadius: 999, padding: "11px 18px", fontSize: 13.5, fontWeight: 600, cursor: "pointer", fontFamily: "var(--font-sans)" }}>Ir para o início</button>
          </>) : (<>
            <div className="dss-display" style={{ fontSize: 24, fontWeight: 800, letterSpacing: "-0.03em" }}>Você foi convidado</div>
            <p style={{ fontSize: 13.5, color: "var(--ink-muted)", lineHeight: 1.65, margin: "8px 0 0" }}>
              Para o projeto <strong style={{ color: "var(--ink)" }}>{info.project?.name || "—"}</strong> como <span className="dss-mono" style={{ fontSize: 11.5, fontWeight: 700, padding: "2px 9px", borderRadius: 999, background: "var(--accent-soft)", color: "var(--accent-ink)" }}>{ROLE_LABEL[info.role] || info.role}</span>.
            </p>
            {phase === "done" ? (
              <div style={{ marginTop: 18, fontSize: 13.5, color: "var(--accent-ink)", fontWeight: 600 }}>Pronto! Entrando no projeto…</div>
            ) : phase === "working" ? (
              <div style={{ marginTop: 18, fontSize: 13.5, color: "var(--ink-subtle)" }}>Vinculando você ao projeto…</div>
            ) : session ? (
              ghBtn("Aceitar convite", accept)
            ) : (
              ghBtn(busy ? "Conectando…" : "Entrar com GitHub para aceitar", login, busy)
            )}
            {err && <div style={{ marginTop: 10, fontSize: 12.5, color: "var(--err)", fontWeight: 600 }}>{err}</div>}
            {!session && phase === "ready" && <div style={{ marginTop: 14, fontSize: 11.5, color: "var(--ink-subtle)", lineHeight: 1.55 }}>Primeira vez? O cadastro acontece no mesmo passo, e você já entra direto no projeto.</div>}
          </>)
        )}
      </div>
    </div>
  )
}

// ─── ProjectsPage — hub "como o Figma": todos os projetos do estúdio ─────────
type StudioProject = { name: string; repo?: string; url?: string; accent?: string; tagline?: string }

// ─── NewProjectModal — cria projeto na plataforma (INSERT em ds_projects) ────
// O projeto nasce LOCAL (sem repo). O push pro GitHub é uma ação separada, depois.
function NewProjectModal({ token, onClose, onCreated }: { token?: string; onClose: () => void; onCreated: (p: any) => void }) {
  const [name, setName] = useState("")
  const [tagline, setTagline] = useState("")
  const [accent, setAccent] = useState("#1FA463")
  const [visibility, setVisibility] = useState<"public" | "private">("public")
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState("")
  const [done, setDone] = useState<any>(null)
  const [copied, setCopied] = useState(false)

  const create = async () => {
    const n = name.trim()
    if (!n) { setErr("Dê um nome ao projeto."); return }
    if (!token) { setErr("Sessão não encontrada — entre novamente."); return }
    setBusy(true); setErr("")
    try {
      const r = await fetch("/api/platform?action=create-project", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
        body: JSON.stringify({ name: n, tagline: tagline.trim() || undefined, accent_color: accent, visibility }),
      })
      const j = await r.json().catch(() => ({}))
      if (!r.ok || !j.ok) throw new Error(j.detail || j.error || ("HTTP " + r.status))
      setDone(j.project)
      onCreated(j.project)
    } catch (e: any) {
      setErr(String(e?.message || e))
    } finally { setBusy(false) }
  }

  const copyId = () => { try { navigator.clipboard.writeText(done.id); setCopied(true); setTimeout(() => setCopied(false), 1500) } catch {} }
  const inputSt: React.CSSProperties = { width: "100%", boxSizing: "border-box", padding: "11px 14px", borderRadius: 12, border: "1px solid var(--hairline)", background: "var(--surface-2)", fontFamily: "var(--font-sans)", fontSize: 14, color: "var(--ink)" }
  const lbl: React.CSSProperties = { fontSize: 12, fontWeight: 600, color: "var(--ink-muted)", marginBottom: 6, display: "block" }

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.5)", backdropFilter: "blur(6px)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div onClick={e => e.stopPropagation()} className="dss-fade" style={{ ...PANEL, width: "100%", maxWidth: 480, boxShadow: "var(--shadow-lg)", border: "1px solid var(--hairline)", overflow: "hidden", maxHeight: "90vh", overflowY: "auto" }}>
        {!done ? (
          <>
            <div style={{ padding: "22px 26px 0" }}>
              <div className="dss-display" style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.03em" }}>Novo projeto</div>
              <p style={{ fontSize: 13, color: "var(--ink-muted)", lineHeight: 1.55, margin: "6px 0 0" }}>
                O projeto nasce aqui na plataforma. Você decide depois quando publicar num repositório no GitHub — criar e publicar são passos separados.
              </p>
            </div>
            <div style={{ padding: "20px 26px", display: "flex", flexDirection: "column", gap: 16 }}>
              <div>
                <label style={lbl}>Nome do projeto</label>
                <input value={name} onChange={e => { setName(e.target.value); setErr("") }} placeholder="ex.: Acme Design System" autoFocus
                  onKeyDown={e => { if (e.key === "Enter") create() }} style={inputSt} />
              </div>
              <div>
                <label style={lbl}>Tagline <span style={{ color: "var(--ink-subtle)", fontWeight: 400 }}>(opcional)</span></label>
                <input value={tagline} onChange={e => setTagline(e.target.value)} placeholder="Uma linha sobre o projeto" style={inputSt} />
              </div>
              <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
                <div style={{ flex: "0 0 auto" }}>
                  <label style={lbl}>Acento</label>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <input type="color" value={accent} onChange={e => setAccent(e.target.value)}
                      style={{ width: 38, height: 38, padding: 0, border: "1px solid var(--hairline)", borderRadius: 10, background: "none", cursor: "pointer" }} />
                    <span className="dss-mono" style={{ fontSize: 12.5, color: "var(--ink-muted)" }}>{accent.toUpperCase()}</span>
                  </div>
                </div>
                <div style={{ flex: 1, minWidth: 180 }}>
                  <label style={lbl}>Visibilidade</label>
                  <div style={{ display: "inline-flex", gap: 2, background: "var(--surface-2)", border: "1px solid var(--hairline)", borderRadius: 999, padding: 3 }}>
                    {([["public", "Público"], ["private", "Privado"]] as ["public" | "private", string][]).map(([v, label]) => (
                      <button key={v} className="dss-btn" onClick={() => setVisibility(v)}
                        style={{ border: "none", borderRadius: 999, padding: "7px 15px", fontSize: 12.5, fontWeight: 600, cursor: "pointer", fontFamily: "var(--font-sans)", background: visibility === v ? "var(--surface)" : "transparent", color: visibility === v ? "var(--ink)" : "var(--ink-subtle)", boxShadow: visibility === v ? "var(--shadow-sm)" : "none" }}>{label}</button>
                    ))}
                  </div>
                </div>
              </div>
              {err && <div style={{ fontSize: 12.5, color: "var(--err)", fontWeight: 600 }}>{err}</div>}
            </div>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", padding: "0 26px 22px" }}>
              <button className="dss-btn" onClick={onClose} style={{ background: "none", border: "1px solid var(--hairline-strong)", borderRadius: 999, padding: "11px 18px", fontSize: 13.5, fontWeight: 600, color: "var(--ink-muted)", cursor: "pointer", fontFamily: "var(--font-sans)" }}>Cancelar</button>
              <button className="dss-btn dss-cta" disabled={busy} onClick={create}
                style={{ background: "var(--primary)", color: "var(--on-primary)", border: "none", borderRadius: 999, padding: "11px 22px", fontSize: 13.5, fontWeight: 600, cursor: "pointer", fontFamily: "var(--font-sans)" }}>{busy ? "Criando…" : "Criar projeto"}</button>
            </div>
          </>
        ) : (
          <div style={{ padding: "30px 28px" }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: "var(--accent-soft)", color: "var(--accent-ink)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
              <Icon d="M20 6L9 17l-5-5" size={22} stroke={2.2} />
            </div>
            <div className="dss-display" style={{ fontSize: 21, fontWeight: 800, letterSpacing: "-0.03em" }}>Projeto criado</div>
            <p style={{ fontSize: 13.5, color: "var(--ink-muted)", lineHeight: 1.55, margin: "6px 0 16px" }}>
              <b style={{ color: "var(--ink)" }}>{done.name}</b> existe agora no backend da plataforma. Ainda sem repositório — quando quiser, publique no GitHub a partir daqui.
            </p>
            <div style={{ background: "var(--surface-2)", border: "1px solid var(--hairline)", borderRadius: 12, padding: "12px 14px" }}>
              <div className="dss-mono" style={{ fontSize: 10, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--ink-subtle)", marginBottom: 6 }}>project_id</div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <code className="dss-mono" style={{ flex: 1, fontSize: 12.5, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{done.id}</code>
                <button className="dss-btn" onClick={copyId} style={{ background: "none", border: "1px solid var(--hairline-strong)", borderRadius: 8, padding: "5px 11px", fontSize: 11.5, fontWeight: 600, color: copied ? "var(--accent-ink)" : "var(--ink-muted)", cursor: "pointer", fontFamily: "var(--font-sans)" }}>{copied ? "copiado ✓" : "copiar"}</button>
              </div>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 20 }}>
              <button className="dss-btn" onClick={onClose} style={{ background: "var(--primary)", color: "var(--on-primary)", border: "none", borderRadius: 999, padding: "11px 22px", fontSize: 13.5, fontWeight: 600, cursor: "pointer", fontFamily: "var(--font-sans)" }}>Concluir</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── M2.1 — Publicar: commit (Git Trees, ciente de repo VAZIO) + fetch do platform.tsx
// canônico + orquestração. Roda no browser via API do GitHub (como o AdminPage); o
// usuário escolhe o repo (PAT fine-grained). ─────────────────────────────────────
async function ghCommitRepo(token: string, owner: string, repo: string, branch: string, files: RepoFile[], message: string, remove?: string[]): Promise<string> {
  const base = "https://api.github.com/repos/" + owner + "/" + repo
  const H: Record<string, string> = { Authorization: "Bearer " + token, Accept: "application/vnd.github+json", "Content-Type": "application/json" }
  const target = branch || "main"
  const repoRes = await fetch(base, { headers: H })
  if (repoRes.status === 404) throw new Error("Repositório " + owner + "/" + repo + " não encontrado (ou o PAT não tem acesso a ele).")
  if (repoRes.status === 401 || repoRes.status === 403) throw new Error("PAT sem permissão (precisa de acesso de escrita ao repo " + owner + "/" + repo + ").")
  if (!repoRes.ok) throw new Error("GitHub repo: " + repoRes.status)
  const repoInfo = await repoRes.json()
  const defaultBranch = repoInfo.default_branch || "main"
  // resolve base: branch alvo existe? senão default? senão repo vazio (commit inicial)
  let baseSha: string | null = null, baseTree: string | null = null, branchExists = false
  const refRes = await fetch(base + "/git/refs/heads/" + encodeURIComponent(target), { headers: H })
  if (refRes.ok) { baseSha = (await refRes.json()).object.sha; branchExists = true }
  else {
    const defRes = await fetch(base + "/git/refs/heads/" + encodeURIComponent(defaultBranch), { headers: H })
    if (defRes.ok) baseSha = (await defRes.json()).object.sha
  }
  if (baseSha) {
    const cRes = await fetch(base + "/git/commits/" + baseSha, { headers: H })
    if (!cRes.ok) throw new Error("GitHub git/commits: " + cRes.status)
    baseTree = (await cRes.json()).tree.sha
  }
  const treeEntries: any[] = []
  for (const f of files) {
    const enc = f.encoding === "base64" ? "base64" : "utf-8"
    const bRes = await fetch(base + "/git/blobs", { method: "POST", headers: H, body: JSON.stringify({ content: f.content, encoding: enc }) })
    if (!bRes.ok) throw new Error("GitHub git/blobs (" + f.path + "): " + bRes.status)
    treeEntries.push({ path: f.path, mode: "100644", type: "blob", sha: (await bRes.json()).sha })
  }
  const treeBody: any = { tree: treeEntries }
  if (baseTree) treeBody.base_tree = baseTree
  // Remoção de arquivos legados (ex.: src/platform.tsx de publicações antigas): num
  // repo já existente, sha:null tira o arquivo da árvore. Em repo vazio, no-op.
  if (baseTree && Array.isArray(remove)) { for (const path of remove) treeBody.tree.push({ path, mode: "100644", type: "blob", sha: null }) }
  const tRes = await fetch(base + "/git/trees", { method: "POST", headers: H, body: JSON.stringify(treeBody) })
  if (!tRes.ok) throw new Error("GitHub git/trees: " + tRes.status)
  const newTree = await tRes.json()
  const commitBody: any = { message, tree: newTree.sha }
  if (baseSha) commitBody.parents = [baseSha]
  const ncRes = await fetch(base + "/git/commits", { method: "POST", headers: H, body: JSON.stringify(commitBody) })
  if (!ncRes.ok) throw new Error("GitHub git/commits POST: " + ncRes.status)
  const newCommit = await ncRes.json()
  if (branchExists) {
    const uRes = await fetch(base + "/git/refs/heads/" + encodeURIComponent(target), { method: "PATCH", headers: H, body: JSON.stringify({ sha: newCommit.sha, force: target !== defaultBranch }) })
    if (!uRes.ok) throw new Error("GitHub PATCH ref " + target + ": " + uRes.status)
  } else {
    const crRes = await fetch(base + "/git/refs", { method: "POST", headers: H, body: JSON.stringify({ ref: "refs/heads/" + target, sha: newCommit.sha }) })
    if (!crRes.ok && crRes.status !== 422) throw new Error("GitHub create ref " + target + ": " + crRes.status)
  }
  return newCommit.sha
}
// Busca o src/platform.tsx canônico via NOSSA API (o servidor lê o repo core com o
// GITHUB_DEPLOY_PAT). Assim o PAT do cliente nunca precisa de leitura no core —
// só de escrita no repo de destino. `sessionToken` é o JWT da sessão, não o PAT.
async function fetchCanonicalPlatformTsx(sessionToken: string): Promise<string | null> {
  try {
    const r = await fetch("/api/platform?action=get-template", { headers: { Authorization: "Bearer " + sessionToken } })
    const j = await r.json().catch(() => null)
    if (r.ok && j && j.ok && typeof j.source === "string" && j.source.length > 500) return j.source
  } catch (_) { /* cai no null abaixo */ }
  return null
}
// orquestra: busca cada componente (get-component) → empacota → comita no repo escolhido.
async function publishProject(opts: { token: string; pat: string; owner: string; repo: string; branch: string; project: PkgProject; componentIds: { id: string; name?: string }[]; onProgress?: (msg: string) => void }): Promise<{ sha: string; url: string; count: number }> {
  // token = JWT da sessão (nossa API: get-component, get-template). pat = PAT do GitHub (commit no destino).
  const { token, pat, owner, repo, branch, project, componentIds, onProgress } = opts
  const pkg: PkgComponent[] = []
  for (let i = 0; i < componentIds.length; i++) {
    const ci = componentIds[i]
    onProgress && onProgress("Buscando componente " + (i + 1) + "/" + componentIds.length + (ci.name ? " · " + ci.name : "") + "…")
    const r = await fetch("/api/platform?action=get-component&component_id=" + encodeURIComponent(ci.id), { headers: { Authorization: "Bearer " + token } })
    const j = await r.json().catch(() => null)
    if (!r.ok || !j || !j.ok) throw new Error("Falha ao buscar " + (ci.name || ci.id) + ": " + ((j && (j.detail || j.error)) || ("HTTP " + r.status)))
    const d = j.component
    if (!d.tsx_code) continue
    pkg.push({ name: d.name, displayName: d.display_name, category: d.category, version: d.version, source: d.tsx_code, css: d.css_code, width: d.width, height: d.height, tokens: d.tokens || [], variants: d.variants || [], docs: d.docs || {}, anatomy: d.anatomy || null, isInteractive: !!d.is_interactive })
  }
  if (!pkg.length) throw new Error("Nenhum componente com código gerado pra publicar.")
  onProgress && onProgress("Obtendo o viewer canônico…")
  const platformTsx = await fetchCanonicalPlatformTsx(token)
  if (!platformTsx) throw new Error("Não consegui obter o src/viewer.tsx do repo core (sem ele o site não renderiza). Verifique o acesso do PAT (Contents: Read no core).")
  onProgress && onProgress("Empacotando o repositório (" + pkg.length + " componentes)…")
  const files = buildRepoFiles(project, pkg, platformTsx)
  onProgress && onProgress("Comitando " + files.length + " arquivos em " + owner + "/" + repo + "@" + branch + "…")
  const sha = await ghCommitRepo(pat, owner, repo, branch, files, "DS Studio: publica " + pkg.length + " componente(s) — " + (project.name || repo), ["src/platform.tsx"])
  return { sha, url: "https://github.com/" + owner + "/" + repo + "/tree/" + branch, count: pkg.length }
}

// ─── PublishModal — empacota o DS e publica no repo GitHub que o usuário escolher ──
function PublishModal({ project, token, components, onClose }: { project: any; token?: string; components: any[]; onClose: () => void }) {
  const [pat, setPat] = useState(() => { try { return localStorage.getItem(ADMIN_PAT_KEY) || "" } catch { return "" } })
  const [remember, setRemember] = useState(true)
  const CFG_KEY = project?.id ? "dss-publish-cfg:" + project.id : ""
  const savedCfg: any = (() => { try { return CFG_KEY ? (JSON.parse(localStorage.getItem(CFG_KEY) || "{}") || {}) : {} } catch { return {} } })()
  const [owner, setOwner] = useState(() => savedCfg.owner || "")
  const [repo, setRepo] = useState(() => savedCfg.repo || pkgSlug(project?.name || "") || "")
  const [branch, setBranch] = useState(() => savedCfg.branch || "main")
  const [vercel, setVercel] = useState(() => savedCfg.vercel || "")
  const [deployHook, setDeployHook] = useState(() => savedCfg.deployHook || "")
  const [phase, setPhase] = useState<"form" | "running" | "done" | "error">("form")
  const [msg, setMsg] = useState("")
  const [result, setResult] = useState<{ sha: string; url: string; count: number } | null>(null)
  const [error, setError] = useState("")
  const withCode = components.length

  const run = async () => {
    if (!token) { setError("Sessão ausente — entre novamente."); setPhase("error"); return }
    if (!pat.trim()) { setError("Cole um PAT do GitHub com acesso de escrita ao repo."); setPhase("error"); return }
    if (!owner.trim() || !repo.trim()) { setError("Informe o owner e o nome do repositório."); setPhase("error"); return }
    try { if (remember) localStorage.setItem(ADMIN_PAT_KEY, pat.trim()) } catch { /* ok */ }
    setPhase("running"); setError(""); setMsg("Iniciando…")
    try {
      const res = await publishProject({
        token, pat: pat.trim(), owner: owner.trim(), repo: repo.trim(), branch: branch.trim() || "main",
        project: { owner: owner.trim(), repo: repo.trim(), name: project?.name },
        componentIds: components.map((c: any) => ({ id: c.id, name: c.display_name || c.name })),
        onProgress: setMsg,
      })
      setResult(res); setPhase("done")
      // Persiste a config de publicação DESTE projeto (some com o "digitar tudo de novo").
      try { if (CFG_KEY) localStorage.setItem(CFG_KEY, JSON.stringify({ owner: owner.trim(), repo: repo.trim(), branch: branch.trim() || "main", vercel: vercel.trim(), deployHook: deployHook.trim() })) } catch { /* ok */ }
      // Vercel Deploy Hook: garante um build mesmo quando o commit via API não dispara o
      // webhook do GitHub (a causa do "deploy não atualiza"). Best-effort, no-cors.
      if (deployHook.trim()) { try { fetch(deployHook.trim(), { method: "POST", mode: "no-cors" }) } catch { /* best-effort */ } }
      const repoFull = owner.trim() + "/" + repo.trim()
      // Grava repo_full_name + vercel_url no projeto (best-effort; não bloqueia a publicação)
      if (project?.id && token) {
        const vercelUrl = vercel.trim() || ("https://" + repo.trim() + ".vercel.app")
        fetch("/api/platform?action=update-project", {
          method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
          body: JSON.stringify({ project_id: project.id, repo_full_name: repoFull, vercel_url: vercelUrl }),
        }).catch(() => { /* best-effort — falha aqui não invalida a publicação */ })
      }
      // Registra o deploy em ds_deployments (best-effort)
      if (project?.id && token) {
        fetch("/api/platform?action=log-deployment", {
          method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
          body: JSON.stringify({
            project_id: project.id,
            components: components.map((c: any) => ({ id: c.id, name: c.display_name || c.name })),
            target_repo: repoFull, target_branch: branch.trim() || "main",
            commit_sha: res?.sha || null, commit_url: res?.url || null,
          }),
        }).catch(() => { /* best-effort */ })
      }
    } catch (e: any) { setError(String((e && e.message) || e)); setPhase("error") }
  }

  const field = { width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid var(--hairline-strong)", background: "var(--surface)", fontSize: 13, fontFamily: "var(--font-sans)", color: "var(--ink)", boxSizing: "border-box" as const, outline: "none" }
  const lbl = { fontSize: 11, fontWeight: 700, letterSpacing: ".04em", textTransform: "uppercase" as const, color: "var(--ink-subtle)", marginBottom: 6, display: "block", fontFamily: "var(--font-mono)" }

  return (
    <div onClick={phase === "running" ? undefined : onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.5)", backdropFilter: "blur(6px)", zIndex: 120, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div onClick={e => e.stopPropagation()} className="dss-fade" style={{ ...PANEL, width: "100%", maxWidth: 480, boxShadow: "var(--shadow-lg)", border: "1px solid var(--hairline)", overflow: "hidden", maxHeight: "88vh", display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "22px 26px 16px", borderBottom: "1px solid var(--hairline)" }}>
          <div className="dss-display" style={{ fontSize: 20, fontWeight: 800, letterSpacing: "-0.03em" }}>Publicar no GitHub</div>
          <div className="dss-mono" style={{ fontSize: 11, color: "var(--ink-subtle)", marginTop: 4 }}>Empacota o DS e comita no repositório que você escolher</div>
        </div>

        <div style={{ padding: "20px 26px", overflowY: "auto" }}>
          {phase === "form" || phase === "error" ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div>
                <label style={lbl}>GitHub PAT (fine-grained, escrita no repo)</label>
                <input type="password" value={pat} onChange={e => setPat(e.target.value)} placeholder="github_pat_…" style={field} />
                <label style={{ display: "flex", alignItems: "center", gap: 7, marginTop: 8, fontSize: 12, color: "var(--ink-muted)", cursor: "pointer" }}>
                  <input type="checkbox" checked={remember} onChange={e => setRemember(e.target.checked)} /> Lembrar neste navegador
                </label>
              </div>
              <div style={{ display: "flex", gap: 12 }}>
                <div style={{ flex: 1 }}><label style={lbl}>Owner</label><input value={owner} onChange={e => setOwner(e.target.value)} placeholder="usuario-ou-org" style={field} /></div>
                <div style={{ flex: 1 }}><label style={lbl}>Repositório</label><input value={repo} onChange={e => setRepo(e.target.value)} placeholder="meu-design-system" style={field} /></div>
              </div>
              <div style={{ display: "flex", gap: 12, alignItems: "flex-end" }}>
                <div style={{ width: 140 }}><label style={lbl}>Branch</label><input value={branch} onChange={e => setBranch(e.target.value)} placeholder="main" style={field} /></div>
                <div style={{ flex: 1, fontSize: 12, color: "var(--ink-muted)", lineHeight: 1.5, paddingBottom: 4 }}><strong style={{ color: "var(--ink)" }}>{withCode}</strong> componente(s) serão empacotados. Componentes sem código gerado são ignorados.</div>
              </div>
              <div>
                <label style={lbl}>Vercel URL (opcional)</label>
                <input value={vercel} onChange={e => setVercel(e.target.value)} placeholder={"https://" + (repo.trim() || "meu-design-system") + ".vercel.app"} style={field} />
                <div style={{ fontSize: 11, color: "var(--ink-subtle)", marginTop: 5, lineHeight: 1.5 }}>Fica salvo no projeto junto do repositório. Se deixar em branco, assumimos <span className="dss-mono">{repo.trim() || "repo"}.vercel.app</span>.</div>
              </div>
              <div>
                <label style={lbl}>Vercel Deploy Hook (opcional)</label>
                <input value={deployHook} onChange={e => setDeployHook(e.target.value)} placeholder="https://api.vercel.com/v1/integrations/deploy/…" style={field} />
                <div style={{ fontSize: 11, color: "var(--ink-subtle)", marginTop: 5, lineHeight: 1.5 }}>Vercel → Settings → Git → Deploy Hooks (branch <span className="dss-mono">{branch.trim() || "main"}</span>). Com isso, toda publicação dispara um build — o commit via API às vezes não aciona o webhook do GitHub.</div>
              </div>
              {phase === "error" ? <div style={{ background: "var(--err-soft)", color: "var(--err)", fontSize: 12.5, fontWeight: 600, padding: "10px 12px", borderRadius: 10, lineHeight: 1.5 }}>{error}</div> : null}
              <div style={{ fontSize: 11.5, color: "var(--ink-subtle)", lineHeight: 1.55, background: "var(--surface-2)", padding: "10px 12px", borderRadius: 10 }}>O repo pode estar vazio — a plataforma cria a estrutura completa (Vite + React + Tailwind + componentes). Conecte-o ao Vercel para o deploy automático.</div>
            </div>
          ) : null}

          {phase === "running" ? (
            <div style={{ padding: "20px 4px", textAlign: "center" }}>
              <div className="dss-spin" style={{ width: 28, height: 28, border: "3px solid var(--hairline-strong)", borderTopColor: "var(--accent)", borderRadius: "50%", margin: "0 auto 16px", animation: "dss-spin 0.8s linear infinite" }} />
              <div style={{ fontSize: 13, color: "var(--ink-muted)", lineHeight: 1.5 }}>{msg}</div>
            </div>
          ) : null}

          {phase === "done" && result ? (
            <div style={{ padding: "8px 4px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                <div style={{ width: 34, height: 34, borderRadius: 9, background: "var(--accent-soft)", color: "var(--accent-ink)", display: "flex", alignItems: "center", justifyContent: "center" }}><Icon d={ICONS.check || "M5 13l4 4L19 7"} size={18} /></div>
                <div style={{ fontSize: 15, fontWeight: 700 }}>{result.count} componente(s) publicados</div>
              </div>
              <div style={{ fontSize: 12.5, color: "var(--ink-muted)", lineHeight: 1.6, marginBottom: 14 }}>Commit <span className="dss-mono" style={{ fontSize: 11.5, background: "var(--surface-2)", padding: "2px 7px", borderRadius: 6 }}>{result.sha.slice(0, 7)}</span> em <span className="dss-mono">{owner}/{repo}@{branch}</span>. Se o repo estiver conectado ao Vercel, o deploy roda automático.</div>
              <a href={result.url} target="_blank" rel="noopener noreferrer" style={{ display: "inline-block", fontSize: 13, fontWeight: 600, color: "var(--accent-ink)" }}>Abrir no GitHub →</a>
            </div>
          ) : null}
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, padding: "14px 22px", borderTop: "1px solid var(--hairline)" }}>
          {phase === "running" ? <span style={{ fontSize: 12, color: "var(--ink-subtle)", alignSelf: "center" }}>Publicando…</span> : (
            <>
              <button className="dss-btn" onClick={onClose} style={{ background: "transparent", color: "var(--ink-muted)", border: "1px solid var(--hairline-strong)", borderRadius: 999, padding: "10px 18px", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "var(--font-sans)" }}>{phase === "done" ? "Fechar" : "Cancelar"}</button>
              {phase !== "done" ? <button className="dss-btn" onClick={run} disabled={!withCode} style={{ background: withCode ? "var(--primary)" : "var(--surface-3)", color: withCode ? "var(--on-primary)" : "var(--ink-subtle)", border: "none", borderRadius: 999, padding: "10px 20px", fontSize: 13, fontWeight: 600, cursor: withCode ? "pointer" : "not-allowed", fontFamily: "var(--font-sans)" }}>{phase === "error" ? "Tentar de novo" : "Publicar"}</button> : null}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── SupaComponentsModal — lista os componentes que o plugin gravou (ds_components) ──
function SupaComponentsModal({ project, token, onClose }: { project: any; token?: string; onClose: () => void }) {
  const [comps, setComps] = useState<any[] | null>(null)
  const [err, setErr] = useState("")
  const [showPublish, setShowPublish] = useState(false)
  useEffect(() => {
    if (!token) { setErr("Sessão não encontrada — entre novamente."); setComps([]); return }
    let on = true
    fetch("/api/platform?action=list-components&project_id=" + encodeURIComponent(project.id), { headers: { Authorization: "Bearer " + token } })
      .then(r => r.json().then((j: any) => ({ ok: r.ok, j })))
      .then(({ ok, j }) => { if (!on) return; if (!ok || !j.ok) throw new Error(j.detail || j.error || "falha"); setComps(j.components || []) })
      .catch((e: any) => { if (on) { setErr(String(e?.message || e)); setComps([]) } })
    return () => { on = false }
  }, [project.id, token])

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.5)", backdropFilter: "blur(6px)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div onClick={e => e.stopPropagation()} className="dss-fade" style={{ ...PANEL, width: "100%", maxWidth: 520, boxShadow: "var(--shadow-lg)", border: "1px solid var(--hairline)", overflow: "hidden", maxHeight: "85vh", display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "22px 26px 16px", borderBottom: "1px solid var(--hairline)" }}>
          <div className="dss-display" style={{ fontSize: 20, fontWeight: 800, letterSpacing: "-0.03em" }}>{project.name}</div>
          <div className="dss-mono" style={{ fontSize: 11, color: "var(--ink-subtle)", marginTop: 4 }}>Componentes enviados pelo plugin · ds_components</div>
        </div>
        <div style={{ padding: "10px 14px", overflowY: "auto" }}>
          {comps === null ? (
            <div style={{ fontSize: 13, color: "var(--ink-subtle)", padding: "16px 12px" }}>Carregando…</div>
          ) : err ? (
            <div style={{ fontSize: 12.5, color: "var(--err)", fontWeight: 600, padding: "16px 12px" }}>{err}</div>
          ) : comps.length === 0 ? (
            <div style={{ fontSize: 13, color: "var(--ink-muted)", padding: "16px 12px", lineHeight: 1.55 }}>Nenhum componente enviado ainda. Gere e publique pelo plugin com este projeto selecionado.</div>
          ) : comps.map((c: any) => (
            <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 12px", borderRadius: 12 }}>
              <div className="dss-display" style={{ width: 34, height: 34, borderRadius: 9, background: "var(--surface-2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 800, color: "var(--ink-muted)", flexShrink: 0 }}>{(c.display_name || c.name || "?")[0]}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.display_name || c.name}{c.is_interactive ? <span className="dss-mono" style={{ fontSize: 9.5, fontWeight: 700, color: "var(--accent-ink)", background: "var(--accent-soft)", padding: "2px 7px", borderRadius: 999, marginLeft: 8 }}>interativo</span> : null}</div>
                <div className="dss-mono" style={{ fontSize: 10.5, color: "var(--ink-subtle)", marginTop: 2 }}>{c.variant_count || 0} variante(s) · atualizado {timeAgo(c.updated_at)}</div>
              </div>
              <span className="dss-mono" style={{ fontSize: 11.5, fontWeight: 700, color: "var(--ink-muted)", flexShrink: 0 }}>v{c.version || "1.0.0"}</span>
            </div>
          ))}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, padding: "14px 22px", borderTop: "1px solid var(--hairline)" }}>
          <button className="dss-btn" onClick={() => setShowPublish(true)} disabled={!comps || comps.length === 0} style={{ background: "transparent", color: comps && comps.length ? "var(--ink)" : "var(--ink-subtle)", border: "1px solid var(--hairline-strong)", borderRadius: 999, padding: "10px 18px", fontSize: 13, fontWeight: 600, cursor: comps && comps.length ? "pointer" : "not-allowed", fontFamily: "var(--font-sans)", display: "inline-flex", alignItems: "center", gap: 7 }}><Icon d={ICONS.github || "M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"} size={15} />Publicar no GitHub</button>
          <button className="dss-btn" onClick={onClose} style={{ background: "var(--primary)", color: "var(--on-primary)", border: "none", borderRadius: 999, padding: "10px 20px", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "var(--font-sans)" }}>Fechar</button>
        </div>
      </div>
      {showPublish ? <PublishModal project={project} token={token} components={comps || []} onClose={() => setShowPublish(false)} /> : null}
    </div>
  )
}

// ─── ProjectsPage — hub "como o Figma": projetos do estúdio ──────────────────
function ProjectsPage({ session, onOpenCurrent, onOpenProject }: { session: Session; onOpenCurrent: () => void; onOpenProject: (p: any) => void }) {
  const [projects, setProjects] = useState<StudioProject[] | null>(null)
  const [stats, setStats] = useState<Record<string, { components?: number; updatedAt?: string; ok: boolean }>>({})
  const [showNew, setShowNew] = useState(false)
  // Supabase: projetos reais do usuário (ds_projects) — é AQUI que o plugin grava
  const [supa, setSupa] = useState<any[] | null>(null)
  const [supaCount, setSupaCount] = useState<Record<string, { count: number; variants: number; interactive: number } | null>>({})
  const [reload, setReload] = useState(0)
  const token = session?.accessToken
  // O hub é escopado ao usuário: mostra só os projetos do Supabase (dono + membro).
  // O antigo /projects.json era uma vitrine GLOBAL — aparecia em qualquer conta (vazamento).
  useEffect(() => { setProjects([]) }, [])
  useEffect(() => {
    if (!projects) return
    projects.forEach(p => {
      if (!p.url) return
      const base = p.url.replace(/\/+$/, "")
      fetch(base + "/registry.json").then(r => (r.ok ? r.json() : Promise.reject(new Error("sem registry"))))
        .then(j => setStats(st => ({ ...st, [p.name]: { components: (j.components || []).length, updatedAt: j.generatedAt, ok: true } })))
        .catch(() => setStats(st => ({ ...st, [p.name]: { ok: false } })))
    })
  }, [projects])
  // Busca os projetos reais do usuário no Supabase (ds_projects) + contagem de componentes (ds_components)
  useEffect(() => {
    if (!token) { setSupa([]); return }
    let on = true
    fetch("/api/platform?action=list-projects", { headers: { Authorization: "Bearer " + token } })
      .then(r => (r.ok ? r.json() : Promise.reject(new Error("falha"))))
      .then(j => {
        if (!on) return
        const list = (j && j.projects) || []
        setSupa(list)
        list.forEach((p: any) => {
          fetch("/api/platform?action=list-components&project_id=" + encodeURIComponent(p.id), { headers: { Authorization: "Bearer " + token } })
            .then(r => (r.ok ? r.json() : null))
            .then(cj => { if (on) { const cs = (cj && cj.ok && cj.components) || null; setSupaCount(c => ({ ...c, [p.id]: cs ? { count: cs.length, variants: cs.reduce((a: number, x: any) => a + (x.variant_count || 0), 0), interactive: cs.filter((x: any) => x.is_interactive).length } : (cj && cj.ok ? { count: 0, variants: 0, interactive: 0 } : null) })) } })
            .catch(() => { if (on) setSupaCount(c => ({ ...c, [p.id]: null })) })
        })
      })
      .catch(() => { if (on) setSupa([]) })
    return () => { on = false }
  }, [token, reload])

  const isCurrent = (p: StudioProject) => { try { return !!p.url && new URL(p.url).origin === window.location.origin } catch { return false } }
  const openProject = (p: StudioProject) => { if (isCurrent(p)) onOpenCurrent(); else if (p.url) window.open(p.url, "_blank") }

  const empty = supa !== null && supa.length === 0

  return (
    <div className="dss-fade" style={{ padding: "26px 30px 60px" }}>
      <TopBar title="Meus projetos" actions={roleCaps(session).createProject ? <DarkPill onClick={() => setShowNew(true)}><Icon d="M12 5v14M5 12h14" size={16} />Novo projeto</DarkPill> : undefined} />

      {/* Resumo da conta — agregado de todos os projetos */}
      {token && supa && supa.length > 0 && (
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 26 }}>
          {(() => {
            const sums = supa.map((p: any) => supaCount[p.id]).filter(Boolean) as { count: number; variants: number; interactive: number }[]
            const tot = sums.reduce((a, x) => ({ count: a.count + x.count, variants: a.variants + x.variants, interactive: a.interactive + x.interactive }), { count: 0, variants: 0, interactive: 0 })
            const loadingAgg = sums.length < supa.length
            const cards: [string, React.ReactNode, string][] = [
              ["Projetos", supa.length, "na sua conta"],
              ["Componentes", loadingAgg ? tot.count + "…" : tot.count, "somados nos projetos"],
              ["Variantes", tot.variants, "somadas"],
              ["Interativos", tot.interactive, "com estado/handlers"],
            ]
            return cards.map(([label, value, sub]) => (
              <div key={label} style={{ ...PANEL, padding: "18px 20px", flex: 1, minWidth: 140 }}>
                <div className="dss-mono" style={{ fontSize: 10, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--ink-subtle)", marginBottom: 7 }}>{label}</div>
                <div className="dss-display" style={{ fontSize: 36, fontWeight: 800, letterSpacing: "-0.035em", lineHeight: 1 }}>{value}</div>
                <div style={{ fontSize: 11.5, color: "var(--ink-muted)", marginTop: 5 }}>{sub}</div>
              </div>
            ))
          })()}
        </div>
      )}

      {/* Seus projetos — fonte real (Supabase ds_projects). É AQUI que o plugin grava. */}
      {token && supa && supa.length > 0 && (
        <div style={{ marginBottom: 26 }}>
          <div className="dss-mono" style={{ fontSize: 10, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--ink-subtle)", marginBottom: 10 }}>Seus projetos</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 20 }}>
            {supa.map((p: any) => {
              const ac = p.accent_color || "var(--accent)"
              const cnt = supaCount[p.id]
              return (
                <button key={p.id} className="dss-btn dss-card-hover" onClick={() => onOpenProject(p)}
                  style={{ ...PANEL, padding: 0, overflow: "hidden", textAlign: "left", border: "none", cursor: "pointer", fontFamily: "var(--font-sans)", display: "flex", flexDirection: "column" }}>
                  <div style={{ height: 104, background: `linear-gradient(135deg, ${ac}22, ${ac}08)`, display: "flex", alignItems: "center", justifyContent: "center", borderBottom: "1px solid var(--hairline)", position: "relative" }}>
                    <div className="dss-display" style={{ width: 52, height: 52, borderRadius: 14, background: "var(--surface)", boxShadow: "var(--shadow-sm)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, fontWeight: 800, color: ac }}>{(p.name || "?")[0]}</div>
                    <span className="dss-mono" style={{ position: "absolute", top: 10, right: 10, fontSize: 9.5, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", padding: "3px 8px", borderRadius: 999, background: "var(--surface)", color: "var(--ink-subtle)", boxShadow: "var(--shadow-sm)" }}>{p.visibility || "public"}</span>
                  </div>
                  <div style={{ padding: "14px 16px 16px", flex: 1 }}>
                    <div style={{ fontSize: 15.5, fontWeight: 700, letterSpacing: "-0.01em" }}>{p.name}</div>
                    <div className="dss-mono" style={{ fontSize: 10, color: "var(--ink-subtle)", marginTop: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.slug || p.id}</div>
                    <div style={{ marginTop: 10, fontSize: 12.5, color: "var(--ink-muted)", display: "flex", alignItems: "center", gap: 6 }}>
                      {cnt === undefined ? <span style={{ color: "var(--ink-subtle)" }}>consultando…</span>
                        : cnt === null ? <span style={{ color: "var(--ink-subtle)" }}>—</span>
                        : <><b style={{ color: "var(--ink)", fontWeight: 700 }}>{cnt.count}</b>&nbsp;componente(s){cnt.variants ? <span className="dss-mono" style={{ fontSize: 10.5, color: "var(--ink-subtle)", marginLeft: 6 }}>· {cnt.variants} var</span> : null}</>}
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {supa === null ? (
        <div style={{ fontSize: 13, color: "var(--ink-subtle)" }}>Carregando…</div>
      ) : empty ? (
        <div className="dss-fade" style={{ maxWidth: 760 }}>
          <div style={{ ...PANEL, padding: "32px 32px 28px" }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "var(--accent-soft)", color: "var(--accent-ink)", borderRadius: 999, padding: "5px 12px", fontSize: 11, fontWeight: 700, fontFamily: "var(--font-mono)", letterSpacing: ".06em", textTransform: "uppercase", marginBottom: 16 }}>Primeiros passos</div>
            <div className="dss-display" style={{ fontSize: 26, fontWeight: 800, letterSpacing: "-0.03em" }}>{session?.name ? `Bem-vindo, ${String(session.name).split(" ")[0]}.` : "Bem-vindo ao DS Studio."}</div>
            <p style={{ fontSize: 14, color: "var(--ink-muted)", lineHeight: 1.6, margin: "8px 0 0", maxWidth: 560 }}>{session ? "O DS Studio transforma seus componentes do Figma em código React/TypeScript, documentação e um site publicado. Veja como começar:" : "Entre para criar e gerenciar projetos."}</p>
            {session && (
              <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 24 }}>
                {([
                  ["1", "Instale o plugin no Figma", "O plugin DS Studio extrai componentes, variantes e tokens do seu arquivo e gera o código.", null],
                  ["2", "Crie seu primeiro projeto", "Um projeto é o seu design system — um repositório, um site. Ele nasce aqui; o GitHub vem quando você publicar.", "create"],
                  ["3", "Gere e publique", "Selecione componentes no plugin, gere com IA e publique para o site do projeto e o GitHub.", null],
                ] as [string, string, string, string | null][]).map(([n, t, d, action]) => (
                  <div key={n} style={{ display: "flex", gap: 14, padding: "16px 18px", background: "var(--surface-2)", border: "1px solid var(--hairline)", borderRadius: 16 }}>
                    <div className="dss-display" style={{ flexShrink: 0, width: 30, height: 30, borderRadius: "50%", background: "var(--surface)", boxShadow: "var(--shadow-sm)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 800, color: "var(--ink)" }}>{n}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: "-0.01em" }}>{t}</div>
                      <div style={{ fontSize: 13, color: "var(--ink-muted)", lineHeight: 1.55, marginTop: 3 }}>{d}</div>
                      {action === "create" && (roleCaps(session).createProject
                        ? <button className="dss-btn" onClick={() => setShowNew(true)} style={{ marginTop: 12, display: "inline-flex", alignItems: "center", gap: 7, background: "var(--primary)", color: "var(--on-primary)", border: "none", borderRadius: 999, padding: "9px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "var(--font-sans)" }}><Icon d="M12 5v14M5 12h14" size={15} />Criar projeto</button>
                        : <div style={{ marginTop: 10, fontSize: 12.5, color: "var(--ink-subtle)" }}>Peça a um administrador para criar um projeto ou te adicionar como membro.</div>)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : null}

      {showNew && <NewProjectModal token={session?.accessToken} onClose={() => setShowNew(false)} onCreated={() => setReload(x => x + 1)} />}
    </div>
  )
}



function AdminSeg({ options, value, onChange }: { options: [string, string][]; value: string; onChange: (v: string) => void }) {
  return (
    <div style={{ display: "inline-flex", gap: 2, background: "var(--surface-2)", border: "1px solid var(--hairline)", borderRadius: 999, padding: 3 }}>
      {options.map(([v, label]) => (
        <button key={v} className="dss-btn" onClick={() => onChange(v)}
          style={{ border: "none", borderRadius: 999, padding: "5px 11px", fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "var(--font-sans)",
            background: value === v ? "var(--surface)" : "transparent", color: value === v ? "var(--ink)" : "var(--ink-subtle)",
            boxShadow: value === v ? "var(--shadow-sm)" : "none" }}>{label}</button>
      ))}
    </div>
  )
}

function AdminPage({ registry, curation, onRefresh, onOpen, tab, onTab, project, token }: { registry: RegistryEntry[]; curation: Curation | null; onRefresh: () => void; onOpen: (name: string) => void; tab?: "components" | "access" | "projects" | "repo" | "members"; onTab?: (t: "components" | "access" | "projects" | "repo" | "members") => void; project?: any; token?: string }) {
  const [pat, setPat] = useState<string>(() => { try { return localStorage.getItem(ADMIN_PAT_KEY) || "" } catch { return "" } })
  const [patInput, setPatInput] = useState("")
  const [user, setUser] = useState<AdminUser | null>(null)
  const [authMsg, setAuthMsg] = useState<string>("")
  const [pending, setPending] = useState<Record<string, Partial<CurationEntry>>>({})
  const [overlay, setOverlay] = useState<Record<string, CurationEntry>>({})  // pós-publicação, até o redeploy
  const [pub, setPub] = useState<{ busy: boolean; msg: string }>({ busy: false, msg: "" })
  const [openDocs, setOpenDocs] = useState<string | null>(null)
  const [docsDraft, setDocsDraft] = useState<any>(null)
  const [docsSha, setDocsSha] = useState<string | undefined>(undefined)
  const [docsBusy, setDocsBusy] = useState(false)
  const [docsMsg, setDocsMsg] = useState("")
  const [adminTab, setAdminTab] = useState<"components" | "access" | "projects" | "repo" | "members">(tab || "components")
  useEffect(() => { if (tab && tab !== adminTab) setAdminTab(tab) }, [tab]) // eslint-disable-line
  const ghHeaders = (token: string) => ({ Authorization: "token " + token, Accept: "application/vnd.github+json" })
  const repoUrl = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}`

  useEffect(() => {
    if (!pat) { setUser(null); return }
    let on = true
    setAuthMsg("Validando acesso…")
    fetch(repoUrl, { headers: ghHeaders(pat) })
      .then(r => r.ok ? r.json() : Promise.reject(new Error("HTTP " + r.status)))
      .then(j => { if (!on) return
        const canPush = !!(j.permissions && (j.permissions.push || j.permissions.admin))
        setUser({ login: j.permissions ? (j.owner?.login || REPO_OWNER) : REPO_OWNER, canPush })
        setAuthMsg(canPush ? "" : "Este token não tem permissão de push neste repositório.")
      })
      .catch(() => { if (on) { setUser(null); setAuthMsg("Token inválido ou sem acesso ao repositório.") } })
    return () => { on = false }
  }, [pat])

  const connect = () => {
    const t = patInput.trim()
    if (!t) return
    try { localStorage.setItem(ADMIN_PAT_KEY, t) } catch {}
    setPat(t); setPatInput("")
  }
  const disconnect = () => { try { localStorage.removeItem(ADMIN_PAT_KEY) } catch {}; setPat(""); setUser(null); setPending({}) }

  const eff = (name: string): CurationEntry => ({ ...(curation?.components?.[name] || {}), ...(overlay[name] || {}), ...(pending[name] || {}) })
  const setP = (name: string, patch: Partial<CurationEntry>) => setPending(p => ({ ...p, [name]: { ...(p[name] || {}), ...patch } }))
  const nPending = Object.keys(pending).length

  const docsUrl = (name: string) => repoUrl + "/contents/public/component-docs/" + name + ".json"
  const openDocsFor = async (name: string) => {
    if (openDocs === name) { setOpenDocs(null); setDocsDraft(null); setDocsMsg(""); return }
    setOpenDocs(name); setDocsDraft(null); setDocsMsg("")
    try {
      const r = await fetch(docsUrl(name), { headers: ghHeaders(pat) })
      if (!r.ok) throw new Error(r.status === 404 ? "este componente ainda não tem docs publicados" : "HTTP " + r.status)
      const j = await r.json()
      setDocsSha(j.sha)
      setDocsDraft(JSON.parse(decodeURIComponent(escape(atob(String(j.content || "").replace(/\n/g, ""))))))
    } catch (e: any) { setDocsMsg("Não foi possível carregar: " + (e?.message || e)) }
  }
  const mutDocs = (kind: "uc" | "dos" | "donts", fn: (arr: any[]) => any[]) => setDocsDraft((d: any) => {
    const nd = JSON.parse(JSON.stringify(d || {}))
    if (kind === "uc") { nd.useCases = nd.useCases || {}; nd.useCases.useCases = fn(nd.useCases.useCases || []) }
    else { nd.donts = nd.donts || {}; nd.donts[kind] = fn(nd.donts[kind] || []) }
    return nd
  })
  const updDocItem = (k: "uc" | "dos" | "donts", i: number, f: string, v: string) => mutDocs(k, arr => arr.map((x, j) => j === i ? { ...x, [f]: v } : x))
  const delDocItem = (k: "uc" | "dos" | "donts", i: number) => mutDocs(k, arr => arr.filter((_, j) => j !== i))
  const addDocItem = (k: "uc" | "dos" | "donts") => mutDocs(k, arr => [...arr, k === "uc" ? { title: "", scenario: "", variant: "", rationale: "" } : k === "dos" ? { title: "", description: "" } : { title: "", description: "", wrongExample: "" }])
  const saveDocs = async (name: string) => {
    if (!docsDraft) return
    setDocsBusy(true); setDocsMsg("")
    try {
      const body: any = { message: "docs: edit via DS Studio admin (" + name + ")", content: btoa(unescape(encodeURIComponent(JSON.stringify(docsDraft, null, 2)))) }
      if (docsSha) body.sha = docsSha
      const w = await fetch(docsUrl(name), { method: "PUT", headers: { ...ghHeaders(pat), "Content-Type": "application/json" }, body: JSON.stringify(body) })
      if (!w.ok) throw new Error("HTTP " + w.status)
      const wj = await w.json()
      setDocsSha(wj.content?.sha)
      setDocsMsg("✓ Docs salvos — o site reflete após o redeploy (~1 min).")
    } catch (e: any) { setDocsMsg("Erro ao salvar: " + (e?.message || e)) } finally { setDocsBusy(false) }
  }

  const publish = async () => {
    if (!nPending || !pat) return
    setPub({ busy: true, msg: "Publicando…" })
    try {
      const url = repoUrl + "/contents/public/curation.json"
      const r = await fetch(url, { headers: ghHeaders(pat) })
      let sha: string | undefined
      let cur: Curation = { components: {} }
      if (r.status !== 404) {
        if (!r.ok) throw new Error("HTTP " + r.status)
        const j = await r.json()
        sha = j.sha
        try { cur = JSON.parse(decodeURIComponent(escape(atob(String(j.content || "").replace(/\n/g, ""))))) || {} } catch { cur = {} }
      }
      if (!cur.components) cur.components = {}
      for (const [name, patch] of Object.entries(pending)) {
        const merged: any = { ...(cur.components[name] || {}), ...patch }
        if (merged.hidden === false) delete merged.hidden
        if (merged.deleted === false) delete merged.deleted
        for (const f of ["status", "displayName", "category", "layer"]) if (merged[f] === "" || merged[f] == null) delete merged[f]
        if (Object.keys(merged).length === 0) delete cur.components[name]
        else cur.components[name] = merged
      }
      cur.$schema = "ds-studio/curation@1"
      cur.updatedAt = new Date().toISOString()
      cur.updatedBy = "admin-web"
      const body: any = { message: "curation: update via DS Studio admin", content: btoa(unescape(encodeURIComponent(JSON.stringify(cur, null, 2)))) }
      if (sha) body.sha = sha
      const w = await fetch(url, { method: "PUT", headers: { ...ghHeaders(pat), "Content-Type": "application/json" }, body: JSON.stringify(body) })
      if (!w.ok) throw new Error("HTTP " + w.status)
      setOverlay(o => ({ ...o, ...Object.fromEntries(Object.entries(cur.components!).map(([k, v]) => [k, v])) }))
      setPending({})
      setPub({ busy: false, msg: "✓ Curadoria publicada — o site público reflete após o redeploy do Vercel (~1 min)." })
      onRefresh()
    } catch (e: any) {
      setPub({ busy: false, msg: "Erro ao publicar: " + (e?.message || e) })
    }
  }

  const STATUS_OPTS: [string, string][] = [["", "Auto"], ["stable", "Stable"], ["beta", "Beta"], ["deprecated", "Depr."]]
  const LAYER_OPTS: [string, string][] = [["", "Auto"], ["actions", "Ações"], ["forms", "Forms"], ["navigation", "Nav"], ["feedback", "Feedback"], ["display", "Exibição"], ["overlay", "Overlay"], ["layout", "Layout"]]
  const VIS_OPTS: [string, string][] = [["visible", "Visível"], ["hidden", "Oculto"]]

  return (
    <div className="dss-fade" style={{ padding: "26px 30px 60px" }}>
      <TopBar title="Admin" />
      {!user || !user.canPush ? (
        <div style={{ ...PANEL, padding: 28, maxWidth: 520, marginTop: 4 }}>
          <div style={{ fontSize: 19, fontWeight: 700, letterSpacing: "-0.02em", marginBottom: 6 }}>Modo owner</div>
          <p style={{ fontSize: 13.5, color: "var(--ink-muted)", lineHeight: 1.6, marginTop: 0 }}>
            Gerencie o que a plataforma exibe — visibilidade, status, nomes e grupos — direto daqui.
            Cada publicação é um <b>commit versionado</b> em <span className="dss-mono">public/curation.json</span>.
            O token fica apenas neste navegador (localStorage) e precisa de permissão de <span className="dss-mono">push</span> no repo <span className="dss-mono">{REPO_OWNER}/{REPO_NAME}</span>.
          </p>
          <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
            <input type="password" value={patInput} onChange={e => setPatInput(e.target.value)} placeholder="GitHub Personal Access Token"
              onKeyDown={e => { if (e.key === "Enter") connect() }}
              style={{ flex: 1, padding: "11px 14px", borderRadius: 12, border: "1px solid var(--hairline)", background: "var(--surface-2)", fontFamily: "var(--font-mono)", fontSize: 12.5, color: "var(--ink)" }} />
            <button className="dss-btn" onClick={connect}
              style={{ background: "var(--primary)", color: "var(--on-primary)", border: "none", borderRadius: 999, padding: "0 22px", fontSize: 13.5, fontWeight: 600, cursor: "pointer", fontFamily: "var(--font-sans)" }}>Conectar</button>
          </div>
          {authMsg && <div style={{ marginTop: 12, fontSize: 12.5, color: authMsg.startsWith("Validando") ? "var(--ink-subtle)" : "var(--err)" }}>{authMsg}</div>}
        </div>
      ) : (
        <>
          <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "2px 0 16px" }}>
            <Pill variant="interactive">owner conectado</Pill>
            <span className="dss-mono" style={{ fontSize: 11.5, color: "var(--ink-subtle)" }}>{REPO_OWNER}/{REPO_NAME}</span>
            <button className="dss-btn" onClick={disconnect} style={{ marginLeft: "auto", background: "none", border: "1px solid var(--hairline-strong)", borderRadius: 999, padding: "7px 14px", fontSize: 12, fontWeight: 600, color: "var(--ink-muted)", cursor: "pointer", fontFamily: "var(--font-sans)" }}>Desconectar</button>
          </div>
          <div style={{ display: "inline-flex", gap: 2, background: "var(--surface-2)", border: "1px solid var(--hairline)", borderRadius: 999, padding: 3, marginBottom: 16 }}>
            {([["components", "Curadoria"], ["access", "Acesso"], ["repo", "Repositório"], ["members", "Membros"]] as ["components" | "access" | "repo" | "members", string][]).map(([v, label]) => (
              <button key={v} className="dss-btn" onClick={() => { setAdminTab(v); onTab && onTab(v) }}
                style={{ border: "none", borderRadius: 999, padding: "7px 15px", fontSize: 12.5, fontWeight: 600, cursor: "pointer", fontFamily: "var(--font-sans)", background: adminTab === v ? "var(--surface)" : "transparent", color: adminTab === v ? "var(--ink)" : "var(--ink-subtle)", boxShadow: adminTab === v ? "var(--shadow-sm)" : "none" }}>{label}</button>
            ))}
          </div>
          {adminTab === "components" && <>
          {(nPending > 0 || pub.msg) && (
            <div style={{ display: "flex", alignItems: "center", gap: 10, background: "var(--accent-soft)", borderRadius: 14, padding: "11px 14px", marginBottom: 16, fontSize: 13, fontWeight: 600, color: "var(--accent-ink)" }}>
              <span style={{ flex: 1 }}>{nPending > 0 ? `${nPending} alteração(ões) pendente(s)` : pub.msg}</span>
              {nPending > 0 && <>
                <button className="dss-btn" onClick={() => setPending({})} style={{ background: "none", border: "1px solid var(--accent)", color: "var(--accent-ink)", borderRadius: 999, padding: "6px 13px", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "var(--font-sans)" }}>Descartar</button>
                <button className="dss-btn" disabled={pub.busy} onClick={publish} style={{ background: "var(--accent)", border: "none", color: "#fff", borderRadius: 999, padding: "7px 16px", fontSize: 12.5, fontWeight: 600, cursor: "pointer", fontFamily: "var(--font-sans)" }}>{pub.busy ? "Publicando…" : "Publicar curadoria"}</button>
              </>}
            </div>
          )}
          <div style={{ ...PANEL, overflow: "hidden" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 22px", borderBottom: "1px solid var(--hairline)" }}>
              <div style={{ fontSize: 17, fontWeight: 700, letterSpacing: "-0.02em" }}>Componentes ({registry.length})</div>
              <span className="dss-mono" style={{ fontSize: 11, color: "var(--ink-subtle)" }}>inclui ocultos · curadoria versionada no Git</span>
            </div>
            {registry.map(c => {
              const e = eff(c.name)
              const dirty = !!pending[c.name]
              return (
                <div key={c.name} style={{ padding: "14px 22px", borderTop: "1px solid var(--hairline)", opacity: (e.deleted || e.hidden) ? .5 : 1, background: dirty ? "var(--accent-soft)" : "transparent" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                    <div style={{ width: 40, height: 34, borderRadius: 9, background: "var(--surface-2)", border: "1px solid var(--hairline)", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", flexShrink: 0 }}>
                      <MiniPreview entry={c} scale={0.3} />
                    </div>
                    <button className="dss-btn" onClick={() => onOpen(c.name)} style={{ background: "none", border: "none", padding: 0, cursor: "pointer", fontFamily: "var(--font-sans)", fontSize: 14, fontWeight: 600, color: "var(--ink)", textAlign: "left" }}>{c.displayName}</button>
                    <span className="dss-mono" style={{ fontSize: 10.5, color: "var(--ink-subtle)" }}>{c.name} · v{c.version}</span>
                    {e.deleted && <Pill variant="deprecated" size="sm">excluído</Pill>}
                    <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                      <AdminSeg options={VIS_OPTS} value={e.hidden ? "hidden" : "visible"} onChange={v => setP(c.name, { hidden: v === "hidden" })} />
                      <AdminSeg options={STATUS_OPTS} value={e.status || ""} onChange={v => setP(c.name, { status: (v || "") as any })} />
                      <AdminSeg options={LAYER_OPTS} value={(e as any).layer || ""} onChange={v => setP(c.name, { layer: (v || "") as any })} />
                      <button className="dss-btn" onClick={() => openDocsFor(c.name)}
                        style={{ background: openDocs === c.name ? "var(--surface)" : "none", border: "1px solid var(--hairline-strong)", borderRadius: 999, padding: "6px 13px", fontSize: 11.5, fontWeight: 600, color: "var(--ink)", cursor: "pointer", fontFamily: "var(--font-sans)", boxShadow: openDocs === c.name ? "var(--shadow-sm)" : "none" }}>Docs</button>
                      <button className="dss-btn" onClick={() => setP(c.name, { deleted: !e.deleted })}
                        style={{ background: "none", border: "1px solid " + (e.deleted ? "var(--hairline-strong)" : "var(--err)"), borderRadius: 999, padding: "6px 13px", fontSize: 11.5, fontWeight: 600, color: e.deleted ? "var(--ink)" : "var(--err)", cursor: "pointer", fontFamily: "var(--font-sans)" }}>{e.deleted ? "Restaurar" : "Excluir"}</button>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 8, marginTop: 10, paddingLeft: 52, flexWrap: "wrap" }}>
                    <input value={e.displayName ?? ""} onChange={ev => setP(c.name, { displayName: ev.target.value })} placeholder={"Nome de exibição (" + c.displayName + ")"}
                      style={{ flex: 2, minWidth: 180, padding: "8px 12px", borderRadius: 10, border: "1px solid var(--hairline)", background: "var(--surface-2)", fontFamily: "var(--font-sans)", fontSize: 12.5, color: "var(--ink)" }} />
                    <input value={e.category ?? ""} onChange={ev => setP(c.name, { category: ev.target.value })} placeholder={"Grupo (" + c.category + ")"}
                      style={{ flex: 1, minWidth: 130, padding: "8px 12px", borderRadius: 10, border: "1px solid var(--hairline)", background: "var(--surface-2)", fontFamily: "var(--font-sans)", fontSize: 12.5, color: "var(--ink)" }} />
                  </div>
                  {openDocs === c.name && (
                    <div style={{ marginTop: 12, marginLeft: 52, border: "1px solid var(--hairline)", borderRadius: 14, background: "var(--surface-2)", padding: 16 }}>
                      {!docsDraft ? (
                        <div style={{ fontSize: 12.5, color: docsMsg.startsWith("Não") ? "var(--err)" : "var(--ink-subtle)" }}>{docsMsg || "Carregando docs…"}</div>
                      ) : (
                        <>
                          {([["Casos de uso (positivos)", "uc"], ["Boas práticas — Do", "dos"], ["Evitar — Don't (negativos)", "donts"]] as [string, "uc" | "dos" | "donts"][]).map(([label, kind]) => {
                            const arr: any[] = kind === "uc" ? (docsDraft.useCases?.useCases || []) : kind === "dos" ? (docsDraft.donts?.dos || []) : (docsDraft.donts?.donts || [])
                            return (
                              <div key={kind} style={{ marginBottom: 16 }}>
                                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                                  <span style={{ fontSize: 12.5, fontWeight: 700 }}>{label} <span className="dss-mono" style={{ color: "var(--ink-subtle)", fontWeight: 500 }}>({arr.length})</span></span>
                                  <button className="dss-btn" onClick={() => addDocItem(kind)}
                                    style={{ background: "none", border: "1px solid var(--hairline-strong)", borderRadius: 999, padding: "4px 11px", fontSize: 11, fontWeight: 600, color: "var(--ink)", cursor: "pointer", fontFamily: "var(--font-sans)" }}>+ Adicionar</button>
                                </div>
                                {arr.map((it: any, i: number) => (
                                  <div key={i} style={{ background: "var(--surface)", border: "1px solid var(--hairline)", borderRadius: 10, padding: 10, marginBottom: 6 }}>
                                    <div style={{ display: "flex", gap: 6, marginBottom: 6 }}>
                                      <input value={it.title || ""} onChange={ev => updDocItem(kind, i, "title", ev.target.value)} placeholder="Título"
                                        style={{ flex: 1, padding: "7px 10px", borderRadius: 8, border: "1px solid var(--hairline)", background: "var(--surface-2)", fontFamily: "var(--font-sans)", fontSize: 12, fontWeight: 600, color: "var(--ink)" }} />
                                      <button className="dss-btn" title="Remover" onClick={() => delDocItem(kind, i)}
                                        style={{ background: "none", border: "1px solid var(--hairline)", borderRadius: 8, width: 30, fontSize: 12, color: "var(--err)", cursor: "pointer" }}>✕</button>
                                    </div>
                                    <textarea value={kind === "uc" ? (it.scenario || "") : (it.description || "")} rows={2}
                                      onChange={ev => updDocItem(kind, i, kind === "uc" ? "scenario" : "description", ev.target.value)}
                                      placeholder={kind === "uc" ? "Cenário de uso" : "Descrição"}
                                      style={{ width: "100%", boxSizing: "border-box", padding: "7px 10px", borderRadius: 8, border: "1px solid var(--hairline)", background: "var(--surface-2)", fontFamily: "var(--font-sans)", fontSize: 12, color: "var(--ink)", resize: "vertical" }} />
                                  </div>
                                ))}
                              </div>
                            )
                          })}
                          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                            <button className="dss-btn" disabled={docsBusy} onClick={() => saveDocs(c.name)}
                              style={{ background: "var(--accent)", border: "none", color: "#fff", borderRadius: 999, padding: "8px 18px", fontSize: 12.5, fontWeight: 600, cursor: "pointer", fontFamily: "var(--font-sans)" }}>{docsBusy ? "Salvando…" : "Salvar docs"}</button>
                            <button className="dss-btn" onClick={() => { setOpenDocs(null); setDocsDraft(null); setDocsMsg("") }}
                              style={{ background: "none", border: "1px solid var(--hairline-strong)", borderRadius: 999, padding: "7px 15px", fontSize: 12, fontWeight: 600, color: "var(--ink-muted)", cursor: "pointer", fontFamily: "var(--font-sans)" }}>Fechar</button>
                            {docsMsg && <span style={{ fontSize: 12, fontWeight: 600, color: docsMsg.startsWith("✓") ? "var(--accent-ink)" : "var(--err)" }}>{docsMsg}</span>}
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
          </>}
          {adminTab === "access" && <AccessPanel pat={pat} repoUrl={repoUrl} ghHeaders={ghHeaders} />}
          {adminTab === "repo" && <RepoSettingsPanel project={project} token={token} />}
          {adminTab === "members" && <MembersPanel project={project} token={token} />}
          {adminTab === "projects" && <AdminProjectsPanel pat={pat} repoUrl={repoUrl} ghHeaders={ghHeaders} />}
        </>
      )}
    </div>
  )
}

// ─── Activity Log (global changelog — persisted in public/activity-log.json) ──
type ActivityLogEntry = {
  type: "publish" | "delete" | "restore" | "curation" | "docs-edit" | "access"
  component?: string
  user: string
  timestamp: string
  summary: string
}
type ActivityLog = { $schema?: string; entries: ActivityLogEntry[] }

function useActivityLog(): { log: ActivityLog | null; refresh: () => void } {
  const [data, setData] = useState<ActivityLog | null>(null)
  const [bust, setBust] = useState(0)
  useEffect(() => {
    let on = true
    fetch("/activity-log.json", { cache: bust ? "reload" : "default" })
      .then(r => (r.ok ? r.json() : null))
      .then(j => { if (on && j) setData(j) })
      .catch(() => {})
    return () => { on = false }
  }, [bust])
  return { log: data, refresh: () => setBust(x => x + 1) }
}

async function appendActivityLog(entry: ActivityLogEntry): Promise<boolean> {
  let pat = ""
  try { pat = localStorage.getItem(ADMIN_PAT_KEY) || "" } catch {}
  if (!pat) return false
  const url = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/public/activity-log.json`
  const hdrs = GH_HEADERS(pat)
  try {
    const r = await fetch(url, { headers: hdrs })
    let sha: string | undefined
    let log: ActivityLog = { $schema: "ds-studio/activity-log@1", entries: [] }
    if (r.status !== 404) {
      if (!r.ok) return false
      const j = await r.json()
      sha = j.sha
      try { log = JSON.parse(decodeURIComponent(escape(atob(String(j.content || "").replace(/\n/g, ""))))) || log } catch {}
    }
    if (!log.entries) log.entries = []
    log.entries.unshift(entry) // newest first
    if (log.entries.length > 200) log.entries = log.entries.slice(0, 200) // cap
    log.$schema = "ds-studio/activity-log@1"
    const body: any = { message: `activity: ${entry.type} ${entry.component || ""}`.trim(), content: btoa(unescape(encodeURIComponent(JSON.stringify(log, null, 2)))) }
    if (sha) body.sha = sha
    const w = await fetch(url, { method: "PUT", headers: { ...hdrs, "Content-Type": "application/json" }, body: JSON.stringify(body) })
    return w.ok
  } catch { return false }
}

const ACT_ICON: Record<string, { d: string; bg: string; color: string }> = {
  publish:   { d: "M12 2 21 7v10l-9 5-9-5V7z",                bg: "linear-gradient(145deg,#6f6f72,#2b2b2e)", color: "#fff" },
  delete:    { d: "M3 6h18|M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6|M10 11v5|M14 11v5", bg: "var(--err-soft)", color: "var(--err)" },
  restore:   { d: "M3 12a9 9 0 119 9|M3 12l4-4|M3 12l4 4",    bg: "var(--ok-soft)",  color: "var(--ok)" },
  curation:  { d: "M12 20h9|M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z", bg: "var(--warn-soft)", color: "var(--warn)" },
  "docs-edit": { d: "M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z|M14 2v6h6|M16 13H8|M16 17H8|M10 9H8", bg: "var(--accent-soft)", color: "var(--accent-ink)" },
  access:    { d: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z", bg: "var(--surface-3)", color: "var(--ink-muted)" },
}
const ACT_LABEL: Record<string, string> = { publish: "Publicação", delete: "Exclusão", restore: "Restauração", curation: "Curadoria", "docs-edit": "Docs", access: "Acesso" }

function ActivityPage({ registry, onOpen }: { registry: RegistryEntry[]; onOpen: (name: string) => void }) {
  const { log } = useActivityLog()
  const metaData = useComponentMeta(registry)
  const [filter, setFilter] = useState<string>("all")

  // Merge: activity-log entries + publication events from component-meta
  const merged = useMemo(() => {
    const items: ActivityLogEntry[] = []
    // From activity-log.json
    if (log?.entries) items.push(...log.entries)
    // From component-meta (publications)
    for (const e of registry) {
      const m = metaData[e.name]
      if (m?.publishedAt) {
        // Don't duplicate if already in activity log
        const dup = items.some(a => a.type === "publish" && a.component === e.name && a.timestamp === m.publishedAt)
        if (!dup) {
          items.push({ type: "publish", component: e.name, user: "plugin", timestamp: m.publishedAt!, summary: `${e.displayName} publicado — v${m.version || e.version}` })
        }
      }
    }
    items.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    return filter === "all" ? items : items.filter(i => i.type === filter)
  }, [log, registry, metaData, filter])

  const types = useMemo(() => {
    const all: ActivityLogEntry[] = []
    if (log?.entries) all.push(...log.entries)
    for (const e of registry) { const m = metaData[e.name]; if (m?.publishedAt) all.push({ type: "publish", component: e.name, user: "plugin", timestamp: m.publishedAt!, summary: "" }) }
    const counts: Record<string, number> = {}
    all.forEach(a => { counts[a.type] = (counts[a.type] || 0) + 1 })
    return counts
  }, [log, registry, metaData])

  return (
    <div className="dss-fade dss-scroll" style={{ padding: "26px 30px 60px" }}>
      <TopBar title="Atividade" />
      <div style={{ ...PANEL, padding: "24px 28px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>
          <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: "-0.02em" }}>Log do Design System</div>
          <span className="dss-mono" style={{ fontSize: 11, color: "var(--ink-subtle)", border: "1px solid var(--hairline)", borderRadius: 999, padding: "5px 11px" }}>{merged.length} evento(s)</span>
          <div style={{ marginLeft: "auto", display: "flex", gap: 4 }}>
            {[["all", "Todos"], ...Object.entries(ACT_LABEL).filter(([k]) => types[k])].map(([k, label]) => (
              <button key={k} className="dss-btn" onClick={() => setFilter(k)}
                style={{ padding: "6px 12px", fontSize: 11.5, fontWeight: 600, borderRadius: 999, border: "none", fontFamily: "var(--font-sans)", cursor: "pointer",
                  background: filter === k ? "var(--primary)" : "var(--surface-2)", color: filter === k ? "var(--on-primary)" : "var(--ink-muted)" }}>
                {label}{k !== "all" && types[k] ? ` ${types[k]}` : ""}
              </button>
            ))}
          </div>
        </div>
        {merged.length === 0 ? (
          <div style={{ padding: "40px 0", textAlign: "center", color: "var(--ink-subtle)", fontSize: 14 }}>Nenhuma atividade registrada ainda.</div>
        ) : (
          <div>
            {merged.map((a, i) => {
              const ic = ACT_ICON[a.type] || ACT_ICON.publish
              const ago = timeAgo(a.timestamp)
              const isComp = !!a.component && registry.some(c => c.name === a.component)
              return (
                <div key={a.timestamp + i} style={{ display: "flex", gap: 14, padding: "14px 0", borderTop: i ? "1px solid var(--hairline)" : "none", alignItems: "flex-start" }}>
                  <div style={{ width: 36, height: 36, borderRadius: "50%", flexShrink: 0, background: ic.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Icon d={ic.d} size={15} stroke={1.6} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
                      <span style={{ fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".06em", color: ic.color, padding: "2px 8px", borderRadius: 999, background: ic.bg, fontFamily: "var(--font-sans)" }}>{ACT_LABEL[a.type] || a.type}</span>
                      {isComp && (
                        <button className="dss-btn" onClick={() => onOpen(a.component!)}
                          style={{ fontSize: 13, fontWeight: 600, color: "var(--accent-ink)", background: "none", border: "none", padding: 0, textDecoration: "underline", textDecorationColor: "var(--hairline-strong)", cursor: "pointer", fontFamily: "var(--font-sans)" }}>{a.component}</button>
                      )}
                      {!isComp && a.component && <span className="dss-mono" style={{ fontSize: 12, color: "var(--ink-muted)" }}>{a.component}</span>}
                      {ago && <span className="dss-mono" style={{ fontSize: 11, color: "var(--ink-subtle)", marginLeft: "auto" }}>{ago}</span>}
                    </div>
                    <div style={{ fontSize: 13, color: "var(--ink-muted)", marginTop: 3, lineHeight: 1.5 }}>{a.summary}</div>
                    <div className="dss-mono" style={{ fontSize: 10.5, color: "var(--ink-subtle)", marginTop: 2 }}>{a.user}{a.timestamp ? " · " + new Date(a.timestamp).toLocaleString("pt-BR") : ""}</div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── SuperAdminPage — visão de administração da plataforma inteira (super admin) ──
function SuperAdminPage({ session, section = "overview" }: { session: Session; section?: "overview" | "projects" | "users" | "usage" }) {
  const [data, setData] = useState<any>(null)
  const [err, setErr] = useState("")
  const [sort, setSort] = useState<{ key: string; dir: 1 | -1 }>({ key: "cost", dir: -1 })
  const token = session?.accessToken
  const [busyU, setBusyU] = useState<string | null>(null)
  const [tierOv, setTierOv] = useState<Record<string, string>>({})
  const [uErr, setUErr] = useState("")
  // Libera/remove "tester" (uso ilimitado) via override de escopo user no ds_modules.
  const [quotaEdit, setQuotaEdit] = useState<string | null>(null)
  const [quotaVal, setQuotaVal] = useState("")
  const [busyQ, setBusyQ] = useState<string | null>(null)
  // Ajusta o limite grátis do usuário e/ou zera o uso do mês.
  async function saveQuota(u: any, opts: { limit?: number | null; reset?: boolean }) {
    if (!token || busyQ) return
    setBusyQ(u.id); setUErr("")
    try {
      const r = await fetch("/api/platform?action=set-user-quota", { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + token }, body: JSON.stringify({ user_id: u.id, ...opts }) })
      const j = await r.json().catch(() => ({}))
      if (!r.ok || !j.ok) throw new Error(j.detail || j.error || "falha")
      setQuotaEdit(null); setReload(x => x + 1)
    } catch (e: any) { setUErr("Não consegui atualizar a cota: " + String(e?.message || e)) }
    setBusyQ(null)
  }
  async function setUserTier(u: any, tier: "tester" | "free") {
    if (!token || busyU) return
    setBusyU(u.id); setUErr("")
    const features = tier === "tester" ? { "max_gen/month": -1, tier: "tester" } : { "max_gen/month": null, tier: "free" }
    try {
      const r = await fetch("/api/platform?action=set-modules", { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + token }, body: JSON.stringify({ target_type: "user", user_id: u.id, features }) })
      const j = await r.json().catch(() => ({}))
      if (!r.ok || !j.ok) throw new Error(j.detail || j.error || "falha")
      setTierOv(m => ({ ...m, [u.id]: tier }))
    } catch (e: any) { setUErr("Não consegui atualizar: " + String(e?.message || e)) }
    setBusyU(null)
  }
  const [reqs, setReqs] = useState<any[] | null>(null)
  const [reqBusy, setReqBusy] = useState<string | null>(null)
  const [reload, setReload] = useState(0)
  const [usersTab, setUsersTab] = useState<"users" | "requests">("users")
  // Modera solicitação de acesso: aprova (libera como tester) ou nega.
  async function resolveReq(u: any, decision: "approve" | "deny") {
    if (!token || reqBusy) return
    setReqBusy(u.user_id); setUErr("")
    try {
      const r = await fetch("/api/platform?action=resolve-access-request", { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + token }, body: JSON.stringify({ user_id: u.user_id, decision, tier: "tester" }) })
      const j = await r.json().catch(() => ({}))
      if (!r.ok || !j.ok) throw new Error(j.detail || j.error || "falha")
      setReqs(list => (list || []).filter(x => x.user_id !== u.user_id))
      if (decision === "approve") setReload(x => x + 1) // atualiza a tabela de usuários (mostra Tester)
    } catch (e: any) { setUErr("Não consegui resolver: " + String(e?.message || e)) }
    setReqBusy(null)
  }
  useEffect(() => {
    if (!token) { setErr("Sessão ausente — entre novamente."); return }
    let on = true
    setData(null); setErr("")
    fetch("/api/platform?action=admin-overview", { headers: { Authorization: "Bearer " + token } })
      .then(r => r.json().then((j: any) => ({ ok: r.ok, j })))
      .then(({ ok, j }) => { if (!on) return; if (!ok || !j.ok) throw new Error(j.detail || j.error || "falha"); setData(j) })
      .catch((e: any) => { if (on) setErr(String(e?.message || e)) })
    fetch("/api/platform?action=list-access-requests&status=pending", { headers: { Authorization: "Bearer " + token } })
      .then(r => r.json().then((j: any) => ({ ok: r.ok, j })))
      .then(({ ok, j }) => { if (on && ok && j.ok) setReqs(j.requests || []) })
      .catch(() => {})
    return () => { on = false }
  }, [token, reload])

  const fmtUSD = (n: number) => "$" + (Number(n) || 0).toFixed((Number(n) || 0) < 1 ? 4 : 2)
  const s = data?.stats
  const sortRows = (rows: any[]) => {
    const { key, dir } = sort
    return [...rows].sort((a, b) => {
      const av = a[key], bv = b[key]
      if (typeof av === "number" && typeof bv === "number") return (av - bv) * dir
      return String(av || "").localeCompare(String(bv || "")) * dir
    })
  }
  const th = (label: string, key?: string, align: "left" | "right" = "left") => (
    <th onClick={key ? () => setSort(p => ({ key, dir: p.key === key && p.dir === -1 ? 1 : -1 })) : undefined}
      style={{ textAlign: align, padding: "9px 12px", fontSize: 10.5, fontWeight: 700, letterSpacing: ".04em", textTransform: "uppercase", color: "var(--ink-subtle)", fontFamily: "var(--font-mono)", cursor: key ? "pointer" : "default", whiteSpace: "nowrap", userSelect: "none" }}>
      {label}{key && sort.key === key ? (sort.dir === -1 ? " ↓" : " ↑") : ""}
    </th>
  )
  const numTd = { padding: "10px 12px", textAlign: "right" as const, fontVariantNumeric: "tabular-nums" as const }
  const cards: [string, React.ReactNode, string][] = !s ? [] : (section === "usage" ? [
    ["Gerações (mês)", s.generationsMonth, s.generations + " no total"],
    ["Custo (mês)", fmtUSD(s.costMonth), "em modelos"],
    ["Custo (total)", fmtUSD(s.costTotal), s.gensCapped ? "amostra grande" : "acumulado (USD)"],
  ] : [
    ["Projetos", s.projects, "na plataforma"],
    ["Usuários", s.users, "contas"],
    ["Componentes", s.components, "no total"],
    ["Gerações (mês)", s.generationsMonth, s.generations + " no total"],
    ["Custo (mês)", fmtUSD(s.costMonth), "em modelos"],
    ["Custo (total)", fmtUSD(s.costTotal), s.gensCapped ? "amostra grande" : "acumulado (USD)"],
    ["Repositórios", s.repos, "publicados"],
  ])

  return (
    <div className="dss-fade" style={{ padding: "26px 30px 60px" }}>
      <TopBar title={section === "projects" ? "Projetos" : section === "users" ? "Usuários" : section === "usage" ? "Uso e custos" : "Plataforma"} />
      {err ? (
        <div style={{ ...PANEL, padding: 24, border: "1px solid var(--hairline)", color: "var(--err)", fontSize: 13, fontWeight: 600 }}>{err}</div>
      ) : !data ? (
        <div style={{ fontSize: 13, color: "var(--ink-subtle)", padding: "20px 4px" }}>Carregando visão da plataforma…</div>
      ) : (
        <>
          {(section === "overview" || section === "usage") && <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 14, marginBottom: 28 }}>
            {cards.map(([label, value, sub], i) => (
              <div key={i} style={{ ...PANEL, padding: "16px 18px", border: "1px solid var(--hairline)" }}>
                <div className="dss-mono" style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: ".04em", textTransform: "uppercase", color: "var(--ink-subtle)" }}>{label}</div>
                <div className="dss-display" style={{ fontSize: 28, fontWeight: 800, letterSpacing: "-0.03em", marginTop: 6, lineHeight: 1 }}>{value}</div>
                <div style={{ fontSize: 11.5, color: "var(--ink-muted)", marginTop: 5 }}>{sub}</div>
              </div>
            ))}
          </div>}

          {(section === "overview" || section === "projects") && <div style={{ ...PANEL, border: "1px solid var(--hairline)", overflow: "hidden", marginBottom: 24 }}>
            <div style={{ padding: "16px 18px 12px", borderBottom: "1px solid var(--hairline)" }}>
              <div style={{ fontSize: 16, fontWeight: 700, letterSpacing: "-0.02em" }}>Todos os projetos</div>
              <div className="dss-mono" style={{ fontSize: 11, color: "var(--ink-subtle)", marginTop: 3 }}>{data.projects.length} projeto(s) · clique no cabeçalho pra ordenar</div>
            </div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead><tr style={{ borderBottom: "1px solid var(--hairline)" }}>
                  {th("Projeto", "name")}{th("Dono", "owner")}{th("Visib.", "visibility")}{th("Repo")}
                  {th("Comp.", "components", "right")}{th("Variantes", "variants", "right")}
                  {th("Gerações", "generations", "right")}{th("Custo", "cost", "right")}{th("Atualizado", "updated_at", "right")}
                </tr></thead>
                <tbody>
                  {sortRows(data.projects).map((p: any) => (
                    <tr key={p.id} style={{ borderBottom: "1px solid var(--hairline)" }}>
                      <td style={{ padding: "10px 12px", fontWeight: 600 }}>{p.name}</td>
                      <td style={{ padding: "10px 12px", color: "var(--ink-muted)" }}>{p.owner || <span className="dss-mono" style={{ fontSize: 11 }}>{(p.owner_id || "").slice(0, 8)}</span>}</td>
                      <td style={{ padding: "10px 12px" }}><span className="dss-mono" style={{ fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 999, background: p.visibility === "public" ? "var(--accent-soft)" : "var(--surface-3)", color: p.visibility === "public" ? "var(--accent-ink)" : "var(--ink-muted)" }}>{p.visibility || "—"}</span></td>
                      <td style={{ padding: "10px 12px" }}>{p.repo_full_name ? <a href={p.vercel_url || ("https://github.com/" + p.repo_full_name)} target="_blank" rel="noopener noreferrer" className="dss-mono" style={{ fontSize: 11.5, color: "var(--accent-ink)", textDecoration: "none" }}>{p.repo_full_name}</a> : <span style={{ color: "var(--ink-subtle)" }}>—</span>}</td>
                      <td style={numTd}>{p.components}</td>
                      <td style={numTd}>{p.variants}</td>
                      <td style={numTd}>{p.generations}</td>
                      <td style={{ ...numTd, fontWeight: 600 }}>{fmtUSD(p.cost)}</td>
                      <td style={{ padding: "10px 12px", textAlign: "right", color: "var(--ink-subtle)", fontSize: 12, whiteSpace: "nowrap" }}>{p.updated_at ? timeAgo(p.updated_at) : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>}

          {section === "users" && <div style={{ display: "inline-flex", gap: 4, padding: 4, background: "var(--surface-3)", borderRadius: 999, marginBottom: 18 }}>
            {(["users", "requests"] as ("users" | "requests")[]).map((id) => {
              const on = usersTab === id
              const label = id === "users" ? "Usuários" : "Solicitações"
              const n = id === "requests" ? (reqs ? reqs.length : 0) : 0
              return <button key={id} onClick={() => setUsersTab(id)} style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "8px 16px", fontSize: 13, fontWeight: on ? 700 : 500, color: on ? "var(--ink)" : "var(--ink-muted)", background: on ? "var(--surface)" : "transparent", boxShadow: on ? "var(--shadow-sm)" : "none", border: "none", borderRadius: 999, cursor: "pointer", fontFamily: "var(--font-sans)" }}>
                {label}
                {n > 0 && <span style={{ minWidth: 18, height: 18, padding: "0 5px", borderRadius: 999, background: "var(--accent)", color: "#fff", fontSize: 10.5, fontWeight: 700, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>{n}</span>}
              </button>
            })}
          </div>}

          {((section === "overview" && reqs && reqs.length > 0) || (section === "users" && usersTab === "requests")) && <div style={{ marginBottom: 16 }}>
            <div style={{ padding: "0 2px 12px" }}>
              <div style={{ fontSize: 16, fontWeight: 700, letterSpacing: "-0.02em" }}>Solicitações de acesso</div>
              <div className="dss-mono" style={{ fontSize: 11, color: "var(--ink-subtle)", marginTop: 3 }}>{(reqs && reqs.length) || 0} pendente(s) · aprovar libera como Tester (ilimitado)</div>
            </div>
            {(!reqs || reqs.length === 0)
              ? <div style={{ ...PANEL, border: "1px solid var(--hairline)", padding: "30px 18px", textAlign: "center", color: "var(--ink-subtle)", fontSize: 13 }}>Nenhuma solicitação pendente.</div>
              : <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {reqs.map((u: any) => {
                  const busy = reqBusy === u.user_id
                  const initial = String(u.name || "?").trim().charAt(0).toUpperCase()
                  return (
                    <div key={u.user_id} style={{ ...PANEL, border: "1px solid var(--hairline)", display: "flex", alignItems: "center", gap: 14, padding: "14px 16px" }}>
                      <div style={{ width: 40, height: 40, borderRadius: "50%", background: "var(--accent-soft)", color: "var(--accent-ink)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 15, flexShrink: 0 }}>{initial}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 600 }}>{u.name}{u.email ? <span style={{ color: "var(--ink-subtle)", fontWeight: 400, fontSize: 12.5, marginLeft: 8 }}>{u.email}</span> : null}</div>
                        <div style={{ fontSize: 12.5, color: "var(--ink-muted)", marginTop: 2 }}>{u.message ? "“" + u.message + "”" : "Pediu acesso ampliado"}</div>
                      </div>
                      <button disabled={busy} onClick={() => resolveReq(u, "approve")} style={{ fontSize: 12.5, fontWeight: 700, padding: "8px 16px", borderRadius: 999, border: "none", cursor: busy ? "default" : "pointer", background: "var(--ink)", color: "#fff", whiteSpace: "nowrap" }}>{busy ? "…" : "Aprovar como Tester"}</button>
                      <button disabled={busy} onClick={() => resolveReq(u, "deny")} style={{ fontSize: 12.5, fontWeight: 600, padding: "8px 16px", borderRadius: 999, border: "1px solid var(--hairline-strong)", cursor: busy ? "default" : "pointer", background: "var(--surface)", color: "var(--ink-muted)", whiteSpace: "nowrap" }}>Negar</button>
                    </div>
                  )
                })}
              </div>}
          </div>}
          {((section === "overview") || (section === "users" && usersTab === "users")) && <div style={{ ...PANEL, border: "1px solid var(--hairline)", overflow: "hidden" }}>
            <div style={{ padding: "16px 18px 12px", borderBottom: "1px solid var(--hairline)" }}>
              <div style={{ fontSize: 16, fontWeight: 700, letterSpacing: "-0.02em" }}>Usuários</div>
              <div className="dss-mono" style={{ fontSize: 11, color: "var(--ink-subtle)", marginTop: 3 }}>{data.users.length} conta(s) · marque como <b>Tester</b> pra liberar uso ilimitado</div>
            </div>
            {uErr && <div style={{ margin: "10px 18px 0", background: "var(--err-soft)", color: "var(--err)", fontSize: 12, fontWeight: 600, padding: "8px 12px", borderRadius: 10 }}>{uErr}</div>}
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead><tr style={{ borderBottom: "1px solid var(--hairline)" }}>
                  {th("Usuário")}{th("Projetos", undefined, "right")}{th("Gerações", undefined, "right")}{th("Custo", undefined, "right")}{th("Cota", undefined, "right")}{th("Tipo", undefined, "right")}
                </tr></thead>
                <tbody>
                  {data.users.map((u: any) => (
                    <tr key={u.id} style={{ borderBottom: "1px solid var(--hairline)" }}>
                      <td style={{ padding: "10px 12px", fontWeight: 600 }}>{u.name}{u.email ? <span style={{ color: "var(--ink-subtle)", fontWeight: 400, fontSize: 12, marginLeft: 6 }}>{u.email}</span> : null}</td>
                      <td style={numTd}>{u.projects}</td>
                      <td style={numTd}>{u.generations}</td>
                      <td style={{ ...numTd, fontWeight: 600 }}>{fmtUSD(u.cost)}</td>
                      <td style={{ padding: "10px 12px", textAlign: "right" }}>
                        {(() => {
                          if (u.unlimited || u.tier === "tester") return <span style={{ color: "var(--ink-subtle)", fontSize: 14 }}>∞</span>
                          const editing = quotaEdit === u.id
                          const busy = busyQ === u.id
                          if (!editing) return (
                            <button disabled={busy} title="Clique pra ajustar o limite ou zerar o uso" onClick={() => { setQuotaEdit(u.id); setQuotaVal(String(u.limit ?? 5)) }}
                              style={{ fontFamily: "var(--font-mono)", fontSize: 12.5, fontWeight: 600, padding: "4px 10px", borderRadius: 8, border: "1px solid var(--hairline)", background: "var(--surface)", color: "var(--ink)", cursor: "pointer" }}>
                              {busy ? "…" : `${u.used ?? 0} / ${u.limit ?? 5}`}
                            </button>
                          )
                          return (
                            <div style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                              <input value={quotaVal} onChange={e => setQuotaVal(e.target.value.replace(/[^0-9-]/g, ""))} title="Limite grátis (-1 = ilimitado)"
                                style={{ width: 46, fontFamily: "var(--font-mono)", fontSize: 12.5, textAlign: "center", padding: "4px 6px", borderRadius: 8, border: "1px solid var(--hairline-strong)", background: "var(--surface)", color: "var(--ink)" }} />
                              <button disabled={busy} onClick={() => saveQuota(u, { limit: quotaVal === "" ? null : Number(quotaVal) })} title="Salvar limite"
                                style={{ fontSize: 11, fontWeight: 700, padding: "5px 10px", borderRadius: 8, border: "none", background: "var(--ink)", color: "#fff", cursor: "pointer" }}>OK</button>
                              <button disabled={busy} onClick={() => saveQuota(u, { reset: true })} title="Zerar o uso do mês"
                                style={{ fontSize: 11, fontWeight: 600, padding: "5px 10px", borderRadius: 8, border: "1px solid var(--hairline-strong)", background: "var(--surface)", color: "var(--ink-muted)", cursor: "pointer" }}>Zerar</button>
                              <button disabled={busy} onClick={() => setQuotaEdit(null)} title="Cancelar"
                                style={{ fontSize: 12, fontWeight: 600, padding: "5px 7px", borderRadius: 8, border: "none", background: "transparent", color: "var(--ink-subtle)", cursor: "pointer" }}>✕</button>
                            </div>
                          )
                        })()}
                      </td>
                      <td style={{ padding: "10px 12px", textAlign: "right" }}>
                        {(() => {
                          const cur = tierOv[u.id] ?? ((u.unlimited || u.tier === "tester") ? "tester" : "free")
                          const busy = busyU === u.id
                          const isT = cur === "tester"
                          return (
                            <button disabled={busy} title={isT ? "Ilimitado — clique pra voltar a Free (5/mês)" : "Free — clique pra liberar como Tester (ilimitado)"}
                              onClick={() => setUserTier(u, isT ? "free" : "tester")}
                              style={{ fontSize: 11, fontWeight: 700, padding: "4px 11px", borderRadius: 999, cursor: busy ? "default" : "pointer",
                                border: "1px solid " + (isT ? "transparent" : "var(--hairline-strong)"),
                                background: isT ? "var(--accent-soft)" : "var(--surface)", color: isT ? "var(--accent-ink)" : "var(--ink-muted)" }}>
                              {busy ? "…" : (isT ? "Tester ✓" : "Liberar")}
                            </button>
                          )
                        })()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>}
        </>
      )}
    </div>
  )
}

type Route = { kind: "overview" } | { kind: "components" } | { kind: "builder" } | { kind: "foundations"; section?: string } | { kind: "insights" } | { kind: "admin"; tab?: "components" | "access" | "projects" | "repo" | "members" } | { kind: "projects" } | { kind: "login"; mode?: "signin" | "signup" } | { kind: "invite"; token: string } | { kind: "reset" } | { kind: "activity" } | { kind: "platform"; section?: "overview" | "projects" | "users" | "usage" | "modules" } | { kind: "component"; name: string; tab?: TabId }

// ─── Main ────────────────────────────────────────────────────────────────────
function SupaSoonComponent() {
  return (
    <div style={{ padding: "14px 16px", borderRadius: 12, background: "var(--surface-2)", border: "1px dashed var(--hairline-strong)", fontSize: 12.5, color: "var(--ink-muted)", maxWidth: 340, textAlign: "center", lineHeight: 1.55 }}>
      Preview e código completos deste componente chegam na <b style={{ color: "var(--ink)" }}>F2</b> (endpoint get-component).
    </div>
  )
}
// Mapeia componentes do Supabase (metadados) para a forma de RegistryEntry que o app já consome.
function supaToRegistry(comps: any[]): RegistryEntry[] {
  return (comps || []).map((c: any) => ({
    name: c.name,
    displayName: c.display_name || c.name,
    category: c.category || "Components",
    version: c.version || "1.0.0",
    variants: Array.from({ length: Number(c.variant_count) || 0 }, (_, i) => ({ name: "Variante " + (i + 1), props: {} })),
    publishedAt: c.updated_at,
    Component: SupaSoonComponent,
    __supaId: c.id,
    __supa: true,
    __interactive: !!c.is_interactive,
  } as any))
}


// ─── Interpretação estruturada do plugin (designIntent, hierarquia, variantes) ─
function InterpBlock({ v }: { v: any }) {
  const li = { fontSize: 13.5, color: "var(--ink-muted)", lineHeight: 1.7 } as React.CSSProperties
  if (!v) return null
  if (typeof v === "string") return <p style={{ ...li, margin: 0 }}>{v}</p>
  const di = v.designIntent || {}
  const vh = v.visualHierarchy || {}
  const tl = v.tokenLanguage || {}
  const vs = Array.isArray(v.variantSemantics) ? v.variantSemantics : []
  const cp = Array.isArray(v.compositionPatterns) ? v.compositionPatterns : []
  const ia = Array.isArray(v.interactionAffordances) ? v.interactionAffordances : []
  const Mini = ({ children }: { children: React.ReactNode }) => <div className="dss-mono" style={{ fontSize: 10, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--ink-subtle)", margin: "2px 0 5px" }}>{children}</div>
  const ul = (arr: any[]) => <ul style={{ margin: 0, paddingLeft: 18, ...li }}>{arr.map((x, i) => <li key={i}>{typeof x === "string" ? x : JSON.stringify(x)}</li>)}</ul>
  const para = (arr: any[]) => arr.filter(Boolean).map((t, i) => <p key={i} style={{ ...li, margin: "0 0 4px" }}>{t}</p>)
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {di.primary ? <p style={{ ...li, margin: 0, color: "var(--ink)" }}>{di.primary}</p> : null}
      {Array.isArray(di.supporting) && di.supporting.length ? ul(di.supporting) : null}
      {v.componentArchetype ? <p style={{ ...li, margin: 0, fontStyle: "italic" }}>{v.componentArchetype}</p> : null}
      {(vh.primary || vh.secondary || vh.rationale) ? <div><Mini>Hierarquia visual</Mini>{para([vh.primary, vh.secondary, vh.rationale])}</div> : null}
      {(tl.colorRoles || tl.spacingRhythm || tl.typographyScale) ? <div><Mini>Tokens</Mini>{para([tl.colorRoles, tl.spacingRhythm, tl.typographyScale])}</div> : null}
      {vs.length ? <div><Mini>Semântica das variantes</Mini>{vs.map((sm: any, i: number) => <div key={i} style={{ marginBottom: 8 }}><p style={{ ...li, margin: 0 }}><b style={{ color: "var(--ink)" }}>{sm.variant}</b>{sm.communicates ? " — " + sm.communicates : ""}</p>{Array.isArray(sm.keyDesignChoices) && sm.keyDesignChoices.length ? ul(sm.keyDesignChoices) : null}</div>)}</div> : null}
      {cp.length ? <div><Mini>Composição</Mini>{ul(cp)}</div> : null}
      {ia.length ? <div><Mini>Affordances</Mini>{ul(ia)}</div> : null}
    </div>
  )
}

// ─── Docs de componente Supabase (defensivo — shape do plugin pode variar) ───
function SupaDocs({ docs }: { docs: any }) {
  if (!docs || (typeof docs === "object" && !Object.keys(docs).length)) return <div style={{ color: "var(--ink-subtle)", fontSize: 13 }}>Sem documentação gerada para este componente.</div>
  const interp = docs.interpretation
  const uc: any[] = docs.useCases?.useCases || (Array.isArray(docs.useCases) ? docs.useCases : [])
  const dos: any[] = docs.donts?.dos || (Array.isArray(docs.dos) ? docs.dos : [])
  const donts: any[] = docs.donts?.donts || (Array.isArray(docs.donts) ? docs.donts : [])
  const a11y = docs.a11y
  const li = { fontSize: 13.5, color: "var(--ink-muted)", lineHeight: 1.7 } as React.CSSProperties
  const txt = (x: any) => typeof x === "string" ? x : (x && (x.title || x.text || x.summary)) || JSON.stringify(x)
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 22, maxWidth: 760 }}>
      {interp ? <div><SectionLabel>Interpretação</SectionLabel><InterpBlock v={interp} /></div> : null}
      {uc.length > 0 ? <div><SectionLabel>Casos de uso</SectionLabel><ul style={{ margin: 0, paddingLeft: 18, ...li }}>{uc.map((c, i) => <li key={i}>{txt(c)}</li>)}</ul></div> : null}
      {dos.length > 0 ? <div><SectionLabel>Do</SectionLabel><ul style={{ margin: 0, paddingLeft: 18, ...li }}>{dos.map((c, i) => <li key={i}>{txt(c)}</li>)}</ul></div> : null}
      {donts.length > 0 ? <div><SectionLabel>Don't</SectionLabel><ul style={{ margin: 0, paddingLeft: 18, ...li }}>{donts.map((c, i) => <li key={i}>{txt(c)}</li>)}</ul></div> : null}
      {a11y ? <div><SectionLabel>Acessibilidade</SectionLabel><p style={{ ...li, margin: 0 }}>{txt(a11y)}</p></div> : null}
    </div>
  )
}

// ─── Render ao vivo (F2.1) — helpers. Compila o tsx no browser (Babel + Tailwind
// via CDN, iframe isolado) e produz um React component que renderiza UMA config,
// mapeando os props (chaves/valores do Figma) para o contrato do cva. Reusado por
// CanvasTab/PreviewTab/CompareTab via `entry.Component`. Não testável daqui — em
// erro/timeout o componente cai num "—" (nunca quebra a página). ─────────────────
function extractCompName(tsx: string, fallback: string): string {
  const t = tsx || ""
  const m = t.match(/export\s+default\s+function\s+([A-Z]\w*)/) || t.match(/export\s+default\s+([A-Z]\w*)/) || t.match(/export\s+const\s+([A-Z]\w*)/) || t.match(/export\s*\{\s*([A-Z]\w*)/) || t.match(/const\s+([A-Z]\w*)\s*=\s*(?:React\.)?forwardRef/) || t.match(/function\s+([A-Z]\w*)\s*\(/)
  return (m && m[1]) || fallback
}
function cleanTsxForEval(tsx: string): string {
  let s = tsx || ""
  s = s.replace(/^[ \t]*import[^\n]*\n?/gm, "")
  s = s.replace(/export\s+default\s+/g, "")
  s = s.replace(/export\s*\{[^}]*\}\s*;?/g, "")
  s = s.replace(/export\s+(interface|type|enum|const|function|class|let|var|abstract)\s+/g, "$1 ")
  return s
}
// monta o srcDoc do iframe: CDNs + shims (cn/cva que registra config em window.__cvas)
// + compila o tsx via Babel (isTSX) + mapProps(Figma→cva) + o `bodyJs` de render.
function supaIframeDoc(cleaned: string, css: string | undefined, compName: string, bodyJs: string, frameId: string): string {
  const SRC = JSON.stringify(cleaned)
  return [
    '<!doctype html><html><head><meta charset="utf-8">',
    '<script src="https://cdn.tailwindcss.com"></scr' + 'ipt>',
    // Roboto (fonte do DS) — sem isto, todo componente com font-[Roboto] cai em
    // fallback do sistema e as métricas de texto distorcem o layout no preview.
    '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>',
    '<link href="https://fonts.googleapis.com/css2?family=Roboto:ital,wght@0,400;0,500;0,700;1,400&display=swap" rel="stylesheet">',
    // tailwind-merge real (paridade com o cn() do build) — se o import falhar, o
    // shim de cn() abaixo cai no join simples (comportamento anterior).
    '<script type="module">try{const m=await import("https://cdn.jsdelivr.net/npm/tailwind-merge@2/+esm");window.twMerge=m.twMerge;}catch(e){}</scr' + 'ipt>',
    "<style>html,body{margin:0;font-family:Roboto,system-ui,sans-serif;background:transparent}#r{display:flex;align-items:center;justify-content:center;min-height:36px;padding:6px}.grid{display:flex;flex-wrap:wrap;gap:24px;align-items:flex-start;justify-content:center;padding:14px}.cell{display:flex;flex-direction:column;align-items:center;gap:9px}.cl{font:600 10px/1 ui-monospace,monospace;color:#9B9B9D;text-transform:uppercase;letter-spacing:.06em}.err{color:#9B9B9D;font:12px system-ui;text-align:center;white-space:pre-wrap;padding:8px}</style>",
    "<style>" + (css || "") + "</style>",
    '<script crossorigin src="https://unpkg.com/react@18/umd/react.production.min.js"></scr' + 'ipt>',
    '<script crossorigin src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></scr' + 'ipt>',
    '<script src="https://unpkg.com/@babel/standalone@7/babel.min.js"></scr' + 'ipt>',
    '</head><body><div id="r"></div>',
    '<script>window.addEventListener("load",function(){(async function(){',
    'function post(o){o.id="' + frameId + '";try{parent.postMessage(o,"*");}catch(_){}}',
    'try{',
    'var React=window.React,ReactDOM=window.ReactDOM;',
    'var useState=React.useState,useEffect=React.useEffect,useRef=React.useRef,useMemo=React.useMemo,useCallback=React.useCallback,forwardRef=React.forwardRef,Fragment=React.Fragment,memo=React.memo;',
    'var cn=function(){var s=[].slice.call(arguments).flat(Infinity).filter(Boolean).join(" ");return window.twMerge?window.twMerge(s):s;};',
    'window.__cvas=[];',
    // cva REAL (mesma lib do site publicado) importada via ESM — o preview passa a
    // resolver variantes/compoundVariants IDÊNTICO à produção, matando a classe de
    // bug do shim (ex.: condição em array). Fallback = shim array-aware (offline/erro
    // de import). Em ambos os casos registra o cfg em __cvas p/ mapProps/combos.
    'var __realCva=null;try{__realCva=(await import("https://cdn.jsdelivr.net/npm/class-variance-authority@0.7.1/+esm")).cva;}catch(e){}',
    'function cva(base,cfg){cfg=cfg||{};window.__cvas.push(cfg);if(__realCva){try{var rf=__realCva(base,cfg);try{rf.__cfg=cfg;}catch(_){}return rf;}catch(_){}}var fn=function(props){props=props||{};var out=[base];var vs=cfg.variants||{};var df=cfg.defaultVariants||{};for(var k in vs){var v=props[k];if(v===undefined||v===null)v=df[k];var o=vs[k]&&vs[k][String(v)];if(o)out.push(o);}(cfg.compoundVariants||[]).forEach(function(c){var cl=c.class||c.className;var cond=Object.assign({},c);delete cond.class;delete cond.className;if(Object.keys(cond).every(function(k){var pv=String(props[k]!=null?props[k]:df[k]);var cv=cond[k];return Array.isArray(cv)?cv.map(String).indexOf(pv)>=0:pv===String(cv);}))out.push(cl);});if(props.class)out.push(props.class);if(props.className)out.push(props.className);return out.filter(Boolean).join(" ");};fn.__cfg=cfg;return fn;}',
    'var SRC=' + SRC + ';',
    'var OUT=Babel.transform(SRC,{presets:[["typescript",{isTSX:true,allExtensions:true}],"react"],filename:"c.tsx"}).code;',
    'var run=new Function("React","ReactDOM","cn","cva","useState","useEffect","useRef","useMemo","useCallback","forwardRef","Fragment","memo","window",OUT+"\\n;return (typeof ' + compName + '!==\\"undefined\\")?' + compName + ':null;");',
    'var __C=run(React,ReactDOM,cn,cva,useState,useEffect,useRef,useMemo,useCallback,forwardRef,Fragment,memo,window);',
    'if(!__C){throw new Error("componente nao encontrado: ' + compName + '");}',
    'var cfg=(window.__cvas.filter(function(c){return c&&c.variants&&Object.keys(c.variants).length;})[0])||null;',
    'function parseVal(v){if(typeof v==="boolean")return v;if(v==="true")return true;if(v==="false")return false;if(v!==""&&!isNaN(Number(v)))return Number(v);return v;}',
    'function mapProps(P){P=P||{};var out={};if(cfg){var lc={};Object.keys(cfg.variants).forEach(function(a){lc[a.toLowerCase()]=a;});Object.keys(P).forEach(function(k){var key=lc[k.toLowerCase()]||k;var val=P[k];var sv=String(val).toLowerCase();if(cfg.variants[key]){if(sv==="no"||sv==="off"||sv==="false")val=false;else if(sv==="yes"||sv==="on"||sv==="true")val=true;else val=parseVal(val);var opts=Object.keys(cfg.variants[key]);if(opts.indexOf(String(val))<0){var hit=opts.filter(function(o){return o.toLowerCase()===String(val).toLowerCase();})[0];if(hit!=null)val=parseVal(hit);}}else{val=parseVal(val);}out[key]=val;});}else{Object.keys(P).forEach(function(k){out[k]=parseVal(P[k]);});}return out;}',
    'function combosFromCva(){var combos=[{}];if(cfg){Object.entries(cfg.variants).forEach(function(pair){var key=pair[0];var opts=Object.keys(pair[1]);var next=[];combos.forEach(function(combo){opts.forEach(function(o){var c=Object.assign({},combo);c[key]=parseVal(o);next.push(c);});});combos=next.slice(0,12);});}return combos;}',
    'function lbl(c){var ks=Object.keys(c);if(!ks.length)return "Default";return ks.map(function(k){return k+"="+String(c[k]);}).join(" \\u00b7 ");}',
    bodyJs,
    // Mede e reporta ALTURA e LARGURA reais do conteúdo. Sem a largura, o host
    // deixa o iframe em width:100% de um pai shrink-to-fit — circularidade que o
    // CSS resolve para o tamanho INTRÍNSECO de iframe da spec: 300px. Qualquer
    // componente mais largo que 300px (Product Card landscape = 361px) era
    // CORTADO no clip do iframe, medido em produção: iframe w=300 num palco de
    // 1565px. Mede o primeiro filho de #r (o componente real) + scrollWidth como
    // fallback; posta 2x (400ms e 1400ms) porque fontes web carregam depois do
    // load e mudam a largura de conteúdo fit-content.
    'function meas(){var r=document.getElementById("r");var el=r&&r.firstElementChild;var w=Math.ceil(Math.max(el?el.getBoundingClientRect().width:0,document.body.scrollWidth||0,document.documentElement.scrollWidth||0));post({__dsl:"ok",h:Math.max(document.body.scrollHeight,el?Math.ceil(el.getBoundingClientRect().height):0),w:w});}',
    'setTimeout(meas,400);setTimeout(meas,1400);setTimeout(meas,2600);',
    '}catch(e){var el=document.getElementById("r");if(el)el.innerHTML=\'<div class="err">\'+(e&&e.message||e)+\'</div>\';post({__dsl:"err",msg:String(e&&e.message||e)});}',
    '})();});</scr' + 'ipt></body></html>'
  ].join("")
}
// fábrica: cria um React component que renderiza UMA config do tsx via iframe.
// Foundation CSS efetiva (com overrides) — injetada no :root de TODO preview real,
// pra o valor salvo no builder refletir no componente no canvas/detalhe (não só no builder).
let __dsFoundationCss = ""
function __getFoundationCss() { return __dsFoundationCss }

function makeSupaLiveComponent(tsx: string, css?: string): React.ComponentType<Record<string, unknown>> {
  const cleaned = cleanTsxForEval(tsx)
  const compName = extractCompName(tsx, "Component")
  return function SupaLive(props: Record<string, unknown>) {
    const [h, setH] = useState(80)
    const [w, setW] = useState<number | null>(null)
    const [failed, setFailed] = useState(false)
    const frameId = useMemo(() => "f_" + Math.random().toString(36).slice(2), [])
    const propsJson = JSON.stringify(props || {})
    const rootCss = __getFoundationCss()
    const srcDoc = useMemo(() => supaIframeDoc(cleaned, (rootCss ? rootCss + "\n" : "") + (css || ""), compName,
      'ReactDOM.createRoot(document.getElementById("r")).render(React.createElement(__C, mapProps(' + propsJson + ')));', frameId), [propsJson, frameId, rootCss])
    useEffect(() => {
      let alive = true, got = false
      const onMsg = (e: MessageEvent) => {
        const m: any = e.data
        if (!m || m.id !== frameId || !alive) return
        if (m.__dsl === "ok") { got = true; setFailed(false); if (m.h) setH(Math.min(2400, Math.max(36, Number(m.h)))); if (m.w) setW(Math.min(1600, Math.max(40, Number(m.w)))) }
        else if (m.__dsl === "err") { got = true; setFailed(true); try { console.warn("[DS Studio] live:", m.msg) } catch {} }
      }
      window.addEventListener("message", onMsg)
      const t = setTimeout(() => { if (!got && alive) setFailed(true) }, 8000)
      return () => { alive = false; window.removeEventListener("message", onMsg); clearTimeout(t) }
    }, [frameId, srcDoc])
    if (failed) return <span style={{ color: "var(--ink-subtle)", fontSize: 12 }}>—</span>
    // width: a largura REAL medida dentro do iframe (postada pelo script). Nunca
    // "100%": num pai shrink-to-fit isso resolve pro intrínseco de 300px e corta
    // qualquer componente mais largo (bug do Product Card landscape 361px).
    return <iframe key={frameId} srcDoc={srcDoc} title="live" sandbox="allow-scripts" scrolling="no" style={{ width: w ? w : "100%", minWidth: w ? undefined : 320, height: h, border: "none", background: "transparent", display: "block" }} />
  }
}
// ─── BUILDER (Ponto 3 · sobre a foundation do 1a) ───────────────────────────
// Preview live que injeta o :root da foundation e atualiza os tokens AO VIVO via
// postMessage (sem re-render do iframe). Como os componentes usam var(--token),
// editar um token propaga na hora. Reusa supaIframeDoc (zero risco ao preview base).
function makeBuilderLive(tsx: string, css?: string): React.ComponentType<{ vars: string; props?: Record<string, unknown> }> {
  const cleaned = cleanTsxForEval(tsx)
  const compName = extractCompName(tsx, "Component")
  return function BuilderLive({ vars, props }: { vars: string; props?: Record<string, unknown> }) {
    const ref = React.useRef<HTMLIFrameElement | null>(null)
    const [h, setH] = useState(120)
    const [w, setW] = useState<number | null>(null)
    const [failed, setFailed] = useState(false)
    const frameId = useMemo(() => "bf_" + Math.random().toString(36).slice(2), [])
    const initialVars = React.useRef(vars).current
    const propsJson = useMemo(() => {
      const p = Object.assign({}, props || {}) as Record<string, unknown>
      if ("checked" in p && !("defaultChecked" in p)) { p.defaultChecked = p.checked; delete p.checked }
      return JSON.stringify(p)
    }, [props])
    const srcDoc = useMemo(() => supaIframeDoc(cleaned, ":root{" + (initialVars || "") + "}\n" + (css || ""), compName,
      'ReactDOM.createRoot(document.getElementById("r")).render(React.createElement(__C, mapProps(' + propsJson + ')));' +
      'window.addEventListener("message",function(e){if(e.data&&e.data.__dsRoot!==undefined){var el=document.getElementById("__dsroot");if(!el){el=document.createElement("style");el.id="__dsroot";document.head.appendChild(el);}el.textContent=":root{"+e.data.__dsRoot+"}";}});',
      frameId), [frameId, propsJson])
    useEffect(() => {
      const cw = ref.current && ref.current.contentWindow
      if (cw) { try { cw.postMessage({ __dsRoot: vars }, "*") } catch (e) {} }
    }, [vars])
    useEffect(() => {
      let alive = true, got = false
      const onMsg = (e: MessageEvent) => {
        const m: any = e.data
        if (!m || m.id !== frameId || !alive) return
        if (m.__dsl === "ok") { got = true; setFailed(false); if (m.h) setH(Math.min(2400, Math.max(36, Number(m.h)))); if (m.w) setW(Math.min(1600, Math.max(40, Number(m.w)))) }
        else if (m.__dsl === "err") { got = true; setFailed(true) }
      }
      window.addEventListener("message", onMsg)
      const t = setTimeout(() => { if (!got && alive) setFailed(true) }, 8000)
      return () => { alive = false; window.removeEventListener("message", onMsg); clearTimeout(t) }
    }, [frameId, srcDoc])
    if (failed) return <span style={{ color: "var(--ink-subtle)", fontSize: 12 }}>—</span>
    return <iframe ref={ref} key={frameId} srcDoc={srcDoc} title="builder-live" sandbox="allow-scripts" scrolling="no" style={{ width: w ? w : "100%", minWidth: w ? undefined : 280, height: h, border: "none", background: "transparent", display: "block" }} />
  }
}

function BuilderPage({ tokens, projectId, token, onSaved }: { tokens?: TokenEntry[]; projectId?: string; token?: string; onSaved?: () => void }) {
  const toks = (tokens || []) as any[]
  const initialVals = () => { const m: Record<string, string> = {}; toks.forEach(t => { if (t && t.css) m[t.css] = String(t.value) }); return m }
  const [vals, setVals] = useState<Record<string, string>>(initialVals)
  useEffect(() => { setVals(initialVals()) /* eslint-disable-next-line */ }, [tokens])
  // Busca o CÓDIGO dos componentes (list-components não traz tsx_code) pra montar o preview real.
  const [codes, setCodes] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [codesRefresh, setCodesRefresh] = useState(0)
  useEffect(() => {
    if (!projectId) { setCodes([]); setLoading(false); return }
    let on = true; setLoading(true)
    fetch("/api/platform?action=list-code&project_id=" + encodeURIComponent(projectId) + "&_t=" + Date.now(), { cache: "no-store", headers: token ? { Authorization: "Bearer " + token } : {} })
      .then(r => (r.ok ? r.json() : null))
      .then(j => { if (on) { setCodes(j && j.ok && Array.isArray(j.components) ? j.components : []); setLoading(false) } })
      .catch(() => { if (on) { setCodes([]); setLoading(false) } })
    return () => { on = false }
  }, [projectId, token, codesRefresh])
  const [tokenizing, setTokenizing] = useState(false)
  const [tokReport, setTokReport] = useState<string>("")
  const runTokenize = () => {
    if (!projectId || !token) { setTokReport("Sem projeto/sessão."); return }
    setTokenizing(true); setTokReport("")
    fetch("/api/platform?action=tokenize-code", { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + token }, body: JSON.stringify({ project_id: projectId }) })
      .then(async r => {
        const j = await r.json().catch(() => ({} as any))
        if (r.ok && j && j.ok) { setTokReport("✓ " + (j.changed || 0) + "/" + (j.total || 0) + " componentes tokenizados"); setCodesRefresh(x => x + 1) }
        else setTokReport("Erro: HTTP " + r.status + " · " + ((j && j.error) || ""))
        setTokenizing(false)
      })
      .catch(e => { setTokReport("Falha: " + String((e && e.message) || e)); setTokenizing(false) })
  }
  const varsStr = Object.keys(vals).map(k => k + ":" + vals[k]).join(";")
  const colors = toks.filter(t => t.type === "color")
  const dims = toks.filter(t => t.type === "dim")
  const radius = dims.filter(t => /radius|corner/i.test(t.css || ""))
  const spacing = dims.filter(t => !/radius|corner/i.test(t.css || ""))
  const setVal = (cssVar: string, v: string) => setVals(prev => ({ ...prev, [cssVar]: v }))
  const impact = (cssVar: string) => (codes || []).filter(c => (c.tsx_code || "").indexOf(cssVar) >= 0).length
  const lives = useMemo(() => (codes || []).filter(c => c.tsx_code).map(c => ({ name: c.name, displayName: c.display_name || c.name, variants: (Array.isArray(c.variants) && c.variants.length ? c.variants : [{ name: "Default", props: {} }]) as any[], Live: makeBuilderLive(c.tsx_code as string, c.css_code) })), [codes])
  const baseOf = (cssVar: string) => { const t = toks.find(x => x.css === cssVar); return t ? String((t.base != null ? t.base : t.value)) : "" }
  const isOverridden = (cssVar: string) => (vals[cssVar] !== undefined) && (vals[cssVar] !== baseOf(cssVar))
  const resetOne = (cssVar: string) => setVal(cssVar, baseOf(cssVar))
  const [saving, setSaving] = useState<"idle" | "saving" | "saved">("idle")
  const [saveErr, setSaveErr] = useState<string>("")
  const dirtyCount = toks.filter(t => t.css && isOverridden(t.css)).length
  const save = () => {
    setSaveErr("")
    if (!projectId) { setSaveErr("Sem projectId — abra pelo projeto."); return }
    if (!token) { setSaveErr("Sem token de sessão — entre novamente."); return }
    const overrides: Record<string, string> = {}
    toks.forEach(t => { if (t.css && isOverridden(t.css)) overrides[t.css] = vals[t.css] })
    setSaving("saving")
    fetch("/api/platform?action=save-tokens", { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + token }, body: JSON.stringify({ project_id: projectId, overrides }) })
      .then(async r => {
        const j = await r.json().catch(() => ({} as any))
        if (r.ok && j && j.ok) { setSaving("saved"); if (onSaved) onSaved(); setTimeout(() => setSaving("idle"), 2200) }
        else { setSaving("idle"); setSaveErr("HTTP " + r.status + " · " + ((j && j.error) || "erro") + ((j && j.detail) ? (" — " + j.detail) : "")) }
      })
      .catch(e => { setSaving("idle"); setSaveErr("Falha de rede: " + String((e && e.message) || e)) })
  }
  const resetBtn = (cssVar: string) => <button onClick={() => resetOne(cssVar)} title="Resetar este token" disabled={!isOverridden(cssVar)} style={{ width: 30, height: 30, borderRadius: 8, border: "1px solid var(--hairline)", background: isOverridden(cssVar) ? "var(--surface)" : "transparent", color: isOverridden(cssVar) ? "var(--ink-muted)" : "var(--ink-subtle)", cursor: isOverridden(cssVar) ? "pointer" : "default", flexShrink: 0, fontSize: 13, lineHeight: 1 }}>↺</button>
  const dimNum = (v: string) => { const n = parseFloat(String(v)); return isNaN(n) ? 0 : n }

  const chip = (n: number) => <span style={{ marginLeft: "auto", fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 600, color: n ? "var(--accent-ink)" : "var(--ink-subtle)", background: n ? "var(--accent-soft)" : "var(--surface-3)", padding: "2px 7px", borderRadius: 999, whiteSpace: "nowrap" }}>{n}/{lives.length} comp</span>
  const grpLabel = (txt: string, top?: boolean) => <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 600, letterSpacing: ".07em", textTransform: "uppercase", color: "var(--ink-subtle)", margin: (top ? "0" : "20px") + " 0 12px" }}>{txt}</div>
  const dimRow = (t: any) => (
    <div key={t.css} style={{ marginBottom: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 11.5, color: "var(--ink)" }}>{t.name}</span>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, color: "var(--accent-ink)", background: "var(--accent-soft)", padding: "2px 7px", borderRadius: 6 }}>{vals[t.css]}</span>
        {chip(impact(t.css))}
        {resetBtn(t.css)}
      </div>
      <input type="range" min={0} max={Math.max(64, dimNum(t.value) * 2)} value={dimNum(vals[t.css])} onChange={e => setVal(t.css, e.target.value + "px")} style={{ width: "100%", accentColor: "var(--accent)", cursor: "pointer" }} />
    </div>
  )
  const propsLabel = (p: Record<string, unknown>) => Object.entries(p || {}).map(([k, v]) => k + "=" + String(v)).join(" · ")

  return (
    <div className="dss-fade" style={{ padding: "26px 30px 60px" }}>
    <TopBar title="Builder" />
    <div style={{ display: "grid", gridTemplateColumns: "360px minmax(0,1fr)", gap: 20, alignItems: "start" }}>
      {/* FRENTE A · Foundation (editor) */}
      <div style={{ background: "var(--surface)", borderRadius: 22, boxShadow: "var(--shadow-md)", padding: 22, position: "sticky", top: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 700, letterSpacing: ".07em", textTransform: "uppercase", color: "var(--accent-ink)", background: "var(--accent-soft)", padding: "4px 10px", borderRadius: 999 }}>A · Foundation</span>
        </div>
        <p style={{ fontSize: 12, color: "var(--ink-muted)", margin: "8px 0 18px", lineHeight: 1.5 }}>Edite um token e veja propagar nos componentes reais à direita. Eles referenciam <code style={{ fontFamily: "var(--font-mono)", fontSize: 11 }}>var(--token)</code> — a edição é ao vivo.</p>

        {colors.length > 0 && <>
          {grpLabel("Cor", true)}
          {colors.map(t => (
            <div key={t.css} style={{ marginBottom: 13 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 11.5, color: "var(--ink)" }}>{t.name}</span>
                {chip(impact(t.css))}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <input type="color" value={/^#[0-9a-fA-F]{6}$/.test(vals[t.css] || "") ? vals[t.css] : "#000000"} onChange={e => setVal(t.css, e.target.value)} style={{ width: 34, height: 34, borderRadius: 9, border: "1px solid var(--hairline-strong)", background: "none", cursor: "pointer", padding: 0 }} />
                <input value={vals[t.css] || ""} onChange={e => setVal(t.css, e.target.value)} style={{ flex: 1, fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--ink)", background: "var(--surface-2)", border: "1px solid var(--hairline)", borderRadius: 9, padding: "7px 10px" }} />
                {resetBtn(t.css)}
              </div>
            </div>
          ))}
        </>}

        {spacing.length > 0 && <>{grpLabel("Espaçamento")}{spacing.map(dimRow)}</>}
        {radius.length > 0 && <>{grpLabel("Radius")}{radius.map(dimRow)}</>}

        <div style={{ display: "flex", gap: 8, marginTop: 14, position: "sticky", bottom: 0 }}>
          <button onClick={save} disabled={saving === "saving" || dirtyCount === 0} style={{ flex: 1, padding: 11, borderRadius: 10, border: "none", background: saving === "saved" ? "var(--accent)" : (dirtyCount === 0 ? "var(--surface-3)" : "var(--ink)"), color: dirtyCount === 0 && saving !== "saved" ? "var(--ink-subtle)" : "#fff", fontFamily: "var(--font-sans)", fontSize: 12.5, fontWeight: 700, cursor: dirtyCount === 0 ? "default" : "pointer" }}>{saving === "saving" ? "Salvando…" : saving === "saved" ? "✓ Salvo" : (dirtyCount ? "Salvar foundation (" + dirtyCount + ")" : "Nada para salvar")}</button>
          <button onClick={() => setVals(initialVals())} title="Descartar edições não salvas" style={{ padding: "11px 14px", borderRadius: 10, border: "1px dashed var(--hairline-strong)", background: "transparent", fontFamily: "var(--font-sans)", fontSize: 12, fontWeight: 600, color: "var(--ink-muted)", cursor: "pointer" }}>↺ Tudo</button>
        </div>
        {saveErr && <div style={{ marginTop: 8, fontSize: 11.5, color: "var(--err, #E5484D)", fontFamily: "var(--font-mono)", lineHeight: 1.5, wordBreak: "break-word" }}>{saveErr}</div>}
        {toks.length === 0 && <p style={{ fontSize: 12, color: "var(--ink-subtle)", marginTop: 12 }}>Nenhum token na foundation ainda. Gere componentes para popular.</p>}
      </div>

      {/* FRENTE B · Componentes (preview real, propagação ao vivo) */}
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6, flexWrap: "wrap" }}>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 700, letterSpacing: ".07em", textTransform: "uppercase", color: "var(--ink-muted)", background: "var(--surface)", padding: "4px 10px", borderRadius: 999, boxShadow: "var(--shadow-sm)" }}>B · Componentes</span>
          <span style={{ fontSize: 12.5, color: "var(--ink-muted)" }}>{lives.length} componentes · reagem em tempo real à foundation</span>
          <button onClick={runTokenize} disabled={tokenizing} title="Troca hex/px que são tokens da foundation por var(--token) em todos os componentes" style={{ marginLeft: "auto", padding: "7px 12px", borderRadius: 9, border: "1px solid var(--hairline-strong)", background: "var(--surface)", fontFamily: "var(--font-sans)", fontSize: 11.5, fontWeight: 600, color: "var(--ink)", cursor: tokenizing ? "default" : "pointer", boxShadow: "var(--shadow-sm)" }}>{tokenizing ? "Tokenizando…" : "⚡ Tokenizar componentes"}</button>
          {tokReport && <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: tokReport.indexOf("✓") === 0 ? "var(--accent-ink)" : "var(--err, #E5484D)" }}>{tokReport}</span>}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 18, marginTop: 12 }}>
          {lives.map(comp => {
            const shown = comp.variants.slice(0, 8)
            const extra = comp.variants.length - shown.length
            return (
              <div key={comp.name} style={{ background: "var(--surface)", borderRadius: 18, boxShadow: "var(--shadow-md)", overflow: "hidden" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "13px 18px", borderBottom: "1px solid var(--hairline)" }}>
                  <span style={{ fontSize: 14, fontWeight: 700, letterSpacing: "-.01em" }}>{comp.displayName}</span>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, fontWeight: 600, color: "var(--ink-muted)", background: "var(--surface-3)", padding: "2px 8px", borderRadius: 999 }}>{comp.variants.length} {comp.variants.length === 1 ? "variação" : "variações"}</span>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(260px,1fr))", gap: 16, padding: 18 }}>
                  {shown.map((v, i) => (
                    <div key={i} style={{ border: "1px solid var(--hairline)", borderRadius: 12, overflow: "hidden", background: "var(--surface)", display: "flex", flexDirection: "column" }}>
                      <div style={{ padding: 22, background: "var(--surface-2)", flex: 1, display: "flex", alignItems: "center", justifyContent: "center", minHeight: 132, overflow: "hidden" }}>
                        <comp.Live vars={varsStr} props={v.props} />
                      </div>
                      <div style={{ padding: "10px 13px", borderTop: "1px solid var(--hairline)" }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: "var(--ink)" }}>{v.name || "—"}</div>
                        {Object.keys(v.props || {}).length > 0 && <div style={{ fontFamily: "var(--font-mono)", fontSize: 9.5, color: "var(--ink-subtle)", marginTop: 3, lineHeight: 1.4, wordBreak: "break-word" }}>{propsLabel(v.props)}</div>}
                      </div>
                    </div>
                  ))}
                </div>
                {extra > 0 && <div style={{ padding: "9px 18px", fontSize: 11.5, color: "var(--ink-subtle)", fontFamily: "var(--font-mono)", borderTop: "1px solid var(--hairline)" }}>+{extra} {extra === 1 ? "variação" : "variações"} não exibida(s)</div>}
              </div>
            )
          })}
          {lives.length === 0 && <div style={{ textAlign: "center", padding: 50, color: "var(--ink-subtle)", fontSize: 13 }}>{loading ? "Carregando componentes…" : "Nenhum componente com código para prever."}</div>}
        </div>
      </div>
    </div>
    </div>
  )
}

// Snapshot do Figma (lado esquerdo do Compare / fallback de preview): SVG inline
// (escalado) ou imagem; cai no /figma-snapshots/{name}.png da instância.
function FigmaSnapshot({ entry }: { entry: any }) {
  const img: string | undefined = entry.__figmaImg
  if (img && img.trim().startsWith("<svg")) return <div style={{ maxWidth: "100%", width: "100%", display: "flex", justifyContent: "center" }} dangerouslySetInnerHTML={{ __html: img }} />
  const src = img || ("/figma-snapshots/" + entry.name + ".png")
  return <img src={src} alt={entry.displayName} style={{ maxWidth: "100%", height: "auto" }} onError={e => { (e.target as HTMLImageElement).style.display = "none" }} />
}

// Remove o frame do component set do Figma (stroke roxo #9747FF, tracejado) e deixa
// o SVG escalar (tira width/height do nó raiz, mantém o viewBox).
function cleanFigmaSvg(svg: string): string {
  if (!svg) return svg
  return svg
    .replace(/<rect\b[^>]*?stroke="#9747FF"[^>]*?>(?:<\/rect>)?/gi, "")
    .replace(/<path\b[^>]*?stroke="#9747FF"[^>]*?>(?:<\/path>)?/gi, "")
    .replace(/<svg\b([^>]*)>/i, (_m, attrs) => "<svg" + String(attrs).replace(/\s(width|height)="[^"]*"/gi, "") + ' style="max-width:100%;height:auto;display:block">')
}

// ─── Detalhe de componente de projeto Supabase (F2) — busca get-component, monta
// um `entry` sintético (com Component vivo via iframe) e renderiza as MESMAS abas
// da instância (Canvas/Preview/Compare/Code/Specs/History + A11y/Do-Don't/UseCases
// via entry.__docs). Mesma UI, mesmo código — idêntico à instância. ──────────────
function SupaComponentDetail({ id, token, fallback, tab, onTab }: { id?: string; token?: string; fallback: { displayName: string; version: string; category: string; interactive?: boolean }; tab: TabId; onTab: (t: TabId) => void }) {
  const [data, setData] = useState<any | null>(null)
  const [status, setStatus] = useState<"loading" | "done" | "error">("loading")
  const [err, setErr] = useState("")
  useEffect(() => {
    if (!id) { setStatus("error"); setErr("Componente sem identificador."); return }
    let on = true
    setStatus("loading"); setErr(""); setData(null)
    // com token → dono; sem token → a API serve se o componente for de um projeto público
    fetch("/api/platform?action=get-component&component_id=" + encodeURIComponent(id), { headers: token ? { Authorization: "Bearer " + token } : {} })
      .then(async r => { const j = await r.json().catch(() => null); if (!r.ok || !j || !j.ok) throw new Error((j && (j.detail || j.error)) || ("HTTP " + r.status)); return j.component })
      .then(c => { if (on) { setData(c); setStatus("done") } })
      .catch(e => { if (on) { setStatus("error"); setErr(String((e && e.message) || e)) } })
    return () => { on = false }
  }, [id, token])

  const d = data || {}
  const dn = d.display_name || fallback.displayName
  const liveComp = useMemo<React.ComponentType<Record<string, unknown>>>(
    () => d.tsx_code ? makeSupaLiveComponent(d.tsx_code, d.css_code) : (() => <span style={{ color: "var(--ink-subtle)", fontSize: 12 }}>sem código gerado</span>),
    [d.tsx_code, d.css_code])
  const figmaImg = useMemo(() => d.png_base64 ? ("data:image/png;base64," + d.png_base64) : (d.svg_source ? cleanFigmaSvg(d.svg_source) : ""), [d.png_base64, d.svg_source])
  const entry = useMemo<any>(() => ({
    name: d.name || dn,
    displayName: dn,
    category: d.category || fallback.category,
    version: d.version || fallback.version,
    variants: (Array.isArray(d.variants) && d.variants.length ? d.variants : [{ name: "Default", props: {} }]).map((v: any, i: number) => ({ name: v.name || ("Variante " + (i + 1)), props: v.props || {} })),
    width: d.width, height: d.height,
    tokens: Array.isArray(d.tokens) ? d.tokens : [],
    source: d.tsx_code || "",
    changelog: Array.isArray(d.versions) ? d.versions : [],
    publishedAt: (Array.isArray(d.versions) && d.versions[0] && d.versions[0].date) || undefined,
    Component: liveComp,
    __interactive: !!d.is_interactive,
    __figmaImg: figmaImg,
    __docs: d.docs || null,
  }), [data, liveComp, figmaImg])

  return (
    <div className="dss-fade">
      <div style={{ position: "sticky", top: 0, zIndex: 10, background: "var(--canvas)", borderBottom: "1px solid var(--hairline)", padding: "20px 32px 16px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", flex: "1 1 auto", minWidth: 0 }}>
          <h1 className="dss-display" style={{ fontSize: 28, fontWeight: 800, margin: 0, letterSpacing: "-0.03em" }}>{dn}</h1>
          <Pill variant={((d as any).status || (fallback as any).__status || "stable")} />
          <span className="dss-mono" style={{ fontSize: 11, background: "var(--surface-2)", color: "var(--ink-muted)", padding: "4px 10px", borderRadius: 999 }}>v{d.version || fallback.version}</span>
          {d.width && d.height ? <span className="dss-mono" style={{ fontSize: 11, color: "var(--ink-subtle)" }}>{d.width}×{d.height}px</span> : null}
          <span className="dss-mono" style={{ fontSize: 11, color: "var(--ink-subtle)", marginLeft: "auto" }}>{d.category || fallback.category}</span>
        </div>
          <div className="dss-scroll" style={{ display: "inline-flex", gap: 2, marginLeft: "auto", flexShrink: 0, background: "var(--surface-2)", borderRadius: 999, padding: 4, maxWidth: "100%", overflowX: "auto" }}>
          {TABS.map(t => {
            const on = tab === t.id
            return <button key={t.id} className="dss-btn" onClick={() => onTab(t.id)} style={{ padding: "8px 15px", fontSize: 13, fontWeight: on ? 600 : 500, color: on ? "var(--ink)" : "var(--ink-muted)", background: on ? "var(--surface)" : "transparent", boxShadow: on ? "var(--shadow-sm)" : "none", border: "none", borderRadius: 999, cursor: "pointer", whiteSpace: "nowrap", fontFamily: "var(--font-sans)" }}>{t.label}</button>
          })}
        </div>
        </div>
      </div>
      {status === "loading" ? <div className="dss-fade" style={{ padding: 50, textAlign: "center", color: "var(--ink-muted)", fontSize: 13.5 }}>Carregando componente…</div> : null}
      {status === "error" ? <div style={{ padding: "24px 32px" }}><div style={{ ...PANEL, padding: 24, maxWidth: 480 }}><div style={{ fontSize: 14, fontWeight: 700, marginBottom: 6 }}>Não consegui carregar o componente</div><div style={{ fontSize: 12.5, color: "var(--ink-muted)", lineHeight: 1.6 }}>{err}</div></div></div> : null}
      {status === "done" ? (
        <div>
          {tab === "canvas" && <CanvasTab entry={entry} />}
          {tab === "preview" && <PreviewTab entry={entry} />}
          {tab === "compare" && <CompareTab entry={entry} />}
          {tab === "code" && <CodeTab entry={entry} />}
          {tab === "specs" && <SpecsTab entry={entry} />}
          {tab === "history" && <HistoryTab entry={entry} />}
          {(tab === "a11y" || tab === "do-donts" || tab === "use-cases") && <AiDocsSection entry={entry} tab={tab} />}
        </div>
      ) : null}
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// DS STUDIO — Packager (M2.1). A plataforma formata e empacota o DS (componentes
// do Supabase) num repositório completo e pronto pra deploy no Vercel. O usuário
// escolhe ONDE (qual repo GitHub). Funções puras — montam o file-map; o commit
// (Git Trees API) e a UI ficam na camada acima. Geradores portados fielmente do
// plugin (buildAppTsx/buildTokensCss) pra o site publicado não divergir. ───────
type PkgComponent = { name: string; displayName?: string; category?: string; version?: string; source?: string; css?: string; width?: number; height?: number; tokens?: { name: string; value: unknown }[]; variants?: { name: string; props: Record<string, unknown> }[]; docs?: any; anatomy?: any; isInteractive?: boolean }
type PkgProject = { owner: string; repo: string; name?: string; tagline?: string }
type RepoFile = { path: string; content: string; encoding?: "utf-8" | "base64" }

function pkgSlug(n: string): string { return String(n || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") }
function pkgTokenNameToCss(name: string): string {
  return String(name || "").toLowerCase().replace(/[\s\/]+/g, "-").replace(/[^a-z0-9-]/g, "").replace(/-+/g, "-").replace(/^-+|-+$/g, "")
}
// consciente de unidade: dimensional → Npx; sem-unidade → cru; 0 → sem unidade.
// (sem isso, `--corner-radius-full: 1000` vira `border-radius:1000` — CSS inválido.)
function pkgTokenValueToCss(val: any, tokenName: string): string | null {
  if (val == null) return null
  if (typeof val === "string") { if (val.startsWith("#")) return val; return JSON.stringify(val) }
  if (typeof val === "number") {
    const n = String(val); const name = String(tokenName || "").toLowerCase()
    const unitless = /opacity|weight|z-?index|flex|scale|aspect|ratio|line-?height\/preset|count/.test(name)
    const dimensional = /radius|corner|padding|spacing|space|gap|size|width|height|dimension|stroke|border-?width|blur|spread|offset|elevation|inset|margin|top|right|bottom|left|x$|y$/.test(name)
    if (val === 0) return "0"
    if (unitless) return n
    if (dimensional) return n + "px"
    if (val > 0 && val < 1) return n
    return n + "px"
  }
  if (typeof val === "object") {
    if (val.r !== undefined && val.g !== undefined && val.b !== undefined) {
      const r = Math.round(val.r * 255), g = Math.round(val.g * 255), b = Math.round(val.b * 255), a = val.a !== undefined ? val.a : 1
      if (a < 1) return "rgba(" + r + ", " + g + ", " + b + ", " + a.toFixed(2) + ")"
      return "#" + r.toString(16).padStart(2, "0") + g.toString(16).padStart(2, "0") + b.toString(16).padStart(2, "0")
    }
  }
  return null
}
// agrega tokens de TODOS os componentes (dedup por nome) → :root. (A plataforma não
// tem acesso às Figma Variables completas como o plugin; usa os tokens salvos por
// componente. Modo único — dark/modes vêm das variáveis do arquivo, fase futura.)
function pkgBuildTokensCss(components: PkgComponent[]): string {
  const seen = new Set<string>()
  const lines = ["/* Auto-gerado pelo DS Studio — derivado dos tokens dos componentes.", " * Não edite manualmente; sobrescrito a cada publicação. */", "", ":root {"]
  for (const c of components) for (const t of (c.tokens || [])) {
    const css = "--" + pkgTokenNameToCss(t.name)
    if (!css || css === "--" || seen.has(css)) continue
    const val = pkgTokenValueToCss(t.value, t.name)
    if (val !== null) { lines.push("  " + css + ": " + val + ";"); seen.add(css) }
  }
  lines.push("}", "")
  return lines.join("\n")
}
function pkgBuildRegistry(components: PkgComponent[]): { components: Record<string, any> } {
  const reg: { components: Record<string, any> } = { components: {} }
  for (const c of components) {
    if (!c.name) continue
    const variants = (c.variants && c.variants.length ? c.variants : [{ name: "Default", props: {} }]).map(v => ({ name: v.name, props: v.props || {} }))
    reg.components[c.name] = {
      displayName: c.displayName || c.name,
      version: c.version || "1.0.0",
      category: c.category || "Components",
      variants,
      width: c.width ?? null,
      height: c.height ?? null,
      tokens: (c.tokens || []).slice(0, 30).map(t => ({ name: t.name, value: t.value })),
      source: c.source || "",
      lastPublished: new Date().toISOString(),
    }
  }
  return reg
}
// porte fiel do buildAppTsx do plugin (mesma saída → o site não diverge).
function pkgBuildAppTsx(registry: { components: Record<string, any> }, owner: string, repo: string, projectName?: string): string {
  const components = registry.components || {}
  const names = Object.keys(components).sort()
  let s = ""
  s += "// AUTO-GERADO pelo DS Studio. Não edite manualmente.\n"
  s += "// A UI de visualização deste design system fica em src/viewer.tsx\n"
  s += 'import { useState, useEffect, useMemo, useRef } from "react";\n'
  s += 'import Viewer from "./viewer";\n'
  for (const name of names) s += "import { " + name + ' } from "@/components/' + name + '";\n'
  s += "\n"
  s += "export type Variant      = { name: string; props: Record<string, unknown> };\n"
  s += "export type TokenEntry   = { name: string; value: unknown };\n"
  s += "export type RegistryEntry = {\n"
  s += "  name: string; displayName: string; category: string; version: string;\n"
  s += "  variants: Variant[]; width?: number; height?: number;\n"
  s += "  tokens?: TokenEntry[]; source?: string;\n"
  s += "  Component: React.ComponentType<Record<string, unknown>>;\n"
  s += "};\n\n"
  s += "(globalThis as any).__REPO_OWNER__ = " + JSON.stringify(owner || "jasonpereirax") + ";\n"
  s += "(globalThis as any).__REPO_NAME__  = " + JSON.stringify(repo || "ds-studio") + ";\n"
  s += "(globalThis as any).__DS_INSTANCE__ = true;\n\n"
  s += "const COMPONENT_REGISTRY: RegistryEntry[] = [\n"
  for (const name of names) {
    const c = components[name]
    const variants = c.variants && c.variants.length ? c.variants : [{ name: "Default", props: {} }]
    s += "  {\n"
    s += "    name: " + JSON.stringify(name) + ",\n"
    s += "    displayName: " + JSON.stringify(c.displayName || name) + ",\n"
    s += "    category: " + JSON.stringify(c.category || "Components") + ",\n"
    s += "    version: " + JSON.stringify(c.version || "1.0.0") + ",\n"
    s += "    Component: " + name + " as React.ComponentType<Record<string, unknown>>,\n"
    s += "    source: " + (c.source ? JSON.stringify(c.source) : "undefined") + ",\n"
    s += "    width: " + JSON.stringify(c.width || null) + ",\n"
    s += "    height: " + JSON.stringify(c.height || null) + ",\n"
    s += "    tokens: " + JSON.stringify(c.tokens || []) + ",\n"
    s += "    variants: [\n"
    for (const v of variants) s += "      { name: " + JSON.stringify(v.name) + ", props: " + JSON.stringify(v.props || {}) + " },\n"
    s += "    ],\n  },\n"
  }
  s += "];\n\n"
  s += "export default function App() {\n  return <Viewer registry={COMPONENT_REGISTRY} project={{ name: " + JSON.stringify(projectName || repo || "Design System") + ", owner: " + JSON.stringify(owner || "") + ", repo: " + JSON.stringify(repo || "") + " }} />;\n}\n"
  return s
}
function pkgBuildPublicRegistry(components: PkgComponent[], owner: string, repo: string): string {
  return JSON.stringify({
    $schema: "ds-studio/registry@1",
    project: (owner || "") + "/" + (repo || ""),
    generatedAt: new Date().toISOString(),
    components: components.map(c => ({
      name: c.name,
      displayName: c.displayName || c.name,
      category: c.category || "Components",
      version: c.version || "1.0.0",
      variants: (c.variants || []).map(v => (v && v.name) || "").filter(Boolean),
      url: "/c/" + pkgSlug(c.name),
    })),
  }, null, 2)
}
const PKG_VERCEL = JSON.stringify({
  rewrites: [{ source: "/(.*)", destination: "/index.html" }],
  headers: [
    { source: "/registry.json", headers: [{ key: "Access-Control-Allow-Origin", value: "*" }] },
    { source: "/variables.json", headers: [{ key: "Access-Control-Allow-Origin", value: "*" }] },
    { source: "/component-meta/(.*)", headers: [{ key: "Access-Control-Allow-Origin", value: "*" }] },
  ],
}, null, 2)
// ── Boilerplate (autorado — não existia no plugin) — Vite + React 18 + TS + Tailwind 3 ──
function PKG_PACKAGE_JSON(p: PkgProject): string {
  return JSON.stringify({
    name: pkgSlug(p.repo || p.name || "design-system") || "design-system",
    private: true, version: "0.0.0", type: "module",
    scripts: { dev: "vite", build: "vite build", preview: "vite preview" },
    dependencies: { react: "^18.3.1", "react-dom": "^18.3.1", "class-variance-authority": "^0.7.0", clsx: "^2.1.1", "tailwind-merge": "^2.5.2", "lucide-react": "^0.441.0" },
    devDependencies: { "@types/react": "^18.3.5", "@types/react-dom": "^18.3.0", "@vitejs/plugin-react": "^4.3.1", autoprefixer: "^10.4.20", postcss: "^8.4.45", tailwindcss: "^3.4.10", typescript: "^5.5.4", vite: "^5.4.3" },
  }, null, 2)
}
const PKG_VITE = `import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { "@": path.resolve(__dirname, "./src") } },
});
`
const PKG_TAILWIND = `/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx,js,jsx}"],
  theme: { extend: {} },
  plugins: [],
};
`
const PKG_POSTCSS = `export default { plugins: { tailwindcss: {}, autoprefixer: {} } };
`
const PKG_TSCONFIG = JSON.stringify({
  compilerOptions: {
    target: "ES2020", useDefineForClassFields: true, lib: ["ES2020", "DOM", "DOM.Iterable"],
    module: "ESNext", skipLibCheck: true, moduleResolution: "bundler", allowImportingTsExtensions: true,
    resolveJsonModule: true, isolatedModules: true, noEmit: true, jsx: "react-jsx", allowJs: true,
    strict: false, baseUrl: ".", paths: { "@/*": ["./src/*"] },
  },
  include: ["src"],
}, null, 2)
const PKG_INDEX_CSS = `@import "./tokens.css";
@tailwind base;
@tailwind components;
@tailwind utilities;

:root { font-family: "Plus Jakarta Sans", system-ui, sans-serif; }
body { margin: 0; }
`
const PKG_MAIN = `import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
`
const PKG_LIB_UTILS = `import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
`
const PKG_API_CLAUDE = `// Proxy Anthropic — a chave vem do header x-api-key (nunca do repo/env).
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-api-key, anthropic-version");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "method_not_allowed" });
  const apiKey = req.headers["x-api-key"];
  if (!apiKey) return res.status(401).json({ error: "missing_api_key" });
  try {
    const upstream = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify(req.body),
    });
    const data = await upstream.json();
    return res.status(upstream.status).json(data);
  } catch (e) {
    return res.status(502).json({ error: "proxy_failed", detail: String(e) });
  }
}
`
function PKG_INDEX_HTML(p: PkgProject): string {
  const title = (p.name || p.repo || "Design System")
  // Seta os globais ANTES do bundle de módulos (script clássico inline roda antes do
  // <script type="module">). Sem isso, o platform.tsx avalia REPO_NAME/IS_INSTANCE no
  // topo do módulo antes do App.tsx setar os globais → sempre caía no default "ds-studio".
  const boot = "window.__REPO_OWNER__=" + JSON.stringify(p.owner || "jasonpereirax") + ";window.__REPO_NAME__=" + JSON.stringify(p.repo || "ds-studio") + ";window.__DS_INSTANCE__=true;"
  return `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link href="https://fonts.googleapis.com/css2?family=Roboto:ital,wght@0,400;0,500;0,700;1,400&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
    <title>` + title + `</title>
    <script>` + boot + `</script>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
`
}
// monta o file-map COMPLETO do repositório a partir dos componentes do Supabase.
// `platformTsx` é o src/platform.tsx canônico (a camada de UI busca do repo ds-studio).
function buildRepoFiles(project: PkgProject, components: PkgComponent[], platformTsx: string): RepoFile[] {
  const owner = project.owner || "", repo = project.repo || ""
  const registry = pkgBuildRegistry(components)
  const files: RepoFile[] = [
    { path: "package.json", content: PKG_PACKAGE_JSON(project) },
    { path: "vite.config.ts", content: PKG_VITE },
    { path: "tailwind.config.js", content: PKG_TAILWIND },
    { path: "postcss.config.js", content: PKG_POSTCSS },
    { path: "tsconfig.json", content: PKG_TSCONFIG },
    { path: "index.html", content: PKG_INDEX_HTML(project) },
    { path: "src/main.tsx", content: PKG_MAIN },
    { path: "src/index.css", content: PKG_INDEX_CSS },
    { path: "src/tokens.css", content: pkgBuildTokensCss(components) },
    { path: "src/lib/utils.ts", content: PKG_LIB_UTILS },
    { path: "api/claude.js", content: PKG_API_CLAUDE },
    { path: "vercel.json", content: PKG_VERCEL },
    { path: "src/viewer.tsx", content: platformTsx || "// viewer.tsx ausente — verifique a origem do template" },
    { path: "src/App.tsx", content: pkgBuildAppTsx(registry, owner, repo, project.name) },
    { path: "src/components/_registry.json", content: JSON.stringify(registry, null, 2) },
    { path: "public/registry.json", content: pkgBuildPublicRegistry(components, owner, repo) },
  ]
  for (const c of components) {
    if (c.name && c.source) files.push({ path: "src/components/" + c.name + ".tsx", content: c.source })
  }
  for (const c of components) {
    if (!c.name) continue
    files.push({
      path: "public/component-data/" + c.name + ".json",
      content: JSON.stringify({ name: c.displayName || c.name, canonicalName: c.name, page: c.category || "Components", width: c.width, height: c.height, variants: c.variants || [], tokens: c.tokens || [], anatomy: c.anatomy || null, docs: c.docs || {} }, null, 2),
    })
  }
  return files
}

// ─── ScopeSwitcher — troca de escopo (projeto ↔ hub ↔ Console) no topo da sidebar ─
// ─── OverlayMenu — casca de dropdown com scrim de fundo ───────────────────────
// Renderiza scrim (destaque) + painel via portal no document.body, escapando de
// qualquer stacking context (header/sidebar). O painel é ancorado ao gatilho.
function OverlayMenu({ onClose, anchorRef, placement, width, children }: { onClose: () => void; anchorRef: React.RefObject<HTMLElement>; placement: "left" | "right"; width: number; children: React.ReactNode }) {
  const [pos, setPos] = useState<{ top: number; left?: number; right?: number } | null>(null)
  useLayoutEffect(() => {
    const el = anchorRef.current
    if (!el) return
    const place = () => {
      const r = el.getBoundingClientRect()
      setPos(placement === "right"
        ? { top: r.bottom + 6, right: Math.max(8, window.innerWidth - r.right) }
        : { top: r.bottom + 6, left: Math.max(8, r.left) })
    }
    place()
    window.addEventListener("resize", place)
    window.addEventListener("scroll", place, true)
    return () => { window.removeEventListener("resize", place); window.removeEventListener("scroll", place, true) }
  }, []) // eslint-disable-line
  if (!pos) return null
  return createPortal(
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(20,20,22,.38)", backdropFilter: "blur(2px)", zIndex: 1000 }} />
      <div style={{ position: "fixed", top: pos.top, left: pos.left, right: pos.right, width, background: "var(--surface)", border: "1px solid var(--hairline)", borderRadius: 16, boxShadow: "var(--shadow-lg)", zIndex: 1001, padding: 7 }}>
        {children}
      </div>
    </>,
    document.body
  )
}

function ScopeSwitcher({ mode, projectName, subtitle, collapsed, token, activeProjectId, onHub, onOpenProject }: { mode: "project" | "console"; projectName?: string; subtitle?: string; collapsed?: boolean; token?: string; activeProjectId?: string; onHub: () => void; onOpenProject?: (p: any) => void }) {
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const [projects, setProjects] = useState<any[] | null>(null)
  useEffect(() => {
    if (!open || projects !== null || !token) return
    let on = true
    fetch("/api/platform?action=list-projects", { headers: { Authorization: "Bearer " + token } })
      .then(r => (r.ok ? r.json() : Promise.reject(new Error("falha"))))
      .then(j => { if (on) setProjects((j && j.projects) || []) })
      .catch(() => { if (on) setProjects([]) })
    return () => { on = false }
  }, [open, token]) // eslint-disable-line
  const admin = mode === "console"
  const grad = admin ? "linear-gradient(145deg, #2f7d5a, #13533a)" : "linear-gradient(145deg, #6f6f72, #2b2b2e)"
  const itemStyle = (cur: boolean): React.CSSProperties => ({ display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "9px 10px", borderRadius: 10, border: "none", cursor: "pointer", fontSize: 13, fontWeight: cur ? 600 : 500, textAlign: "left", fontFamily: "var(--font-sans)", background: cur ? "var(--accent-soft)" : "transparent", color: cur ? "var(--accent-ink)" : "var(--ink)" })
  return (
    <div style={{ position: "relative", flex: collapsed ? "none" : 1, minWidth: 0 }}>
      <button ref={triggerRef} className="dss-btn" title="Trocar de escopo" onClick={() => setOpen(o => !o)}
        style={{ display: "flex", alignItems: "center", gap: 11, width: "100%", background: "transparent", border: "1px solid transparent", borderRadius: 12, cursor: "pointer", padding: collapsed ? 0 : "6px 8px", justifyContent: collapsed ? "center" : "flex-start" }}>
        <div style={{ width: 36, height: 36, borderRadius: 11, background: grad, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, boxShadow: "var(--shadow-md)" }}>
          <svg width="21" height="21" viewBox="0 0 24 24" fill="none"><path d="M12 2 21 7v10l-9 5-9-5V7z" stroke="#fff" strokeWidth="1.4" opacity="0.92" /><path d="M12 2v20M3 7l9 5 9-5" stroke="#fff" strokeWidth="1.1" opacity="0.5" /></svg>
        </div>
        {!collapsed && (
          <>
            <div style={{ textAlign: "left", flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: "var(--ink)", lineHeight: 1, letterSpacing: "-0.03em", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{admin ? "Plataforma" : (projectName || <>ds<span style={{ opacity: .35 }}> studio</span></>)}</div>
              <div className="dss-mono" style={{ fontSize: 10, color: "var(--ink-subtle)", marginTop: 3, letterSpacing: ".04em", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{admin ? "console · admin" : (subtitle || "")}</div>
            </div>
            <span style={{ color: "var(--ink-subtle)", display: "flex" }}><Icon d="M6 9l6 6 6-6" size={16} /></span>
          </>
        )}
      </button>
      {open && (
        <OverlayMenu onClose={() => setOpen(false)} anchorRef={triggerRef} placement="left" width={248}>
            {onOpenProject && (
              <>
                <div className="dss-mono" style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--ink-subtle)", padding: "8px 10px 5px" }}>Projetos</div>
                <div style={{ maxHeight: 220, overflowY: "auto" }}>
                  {projects === null
                    ? <div style={{ padding: "8px 10px", fontSize: 12.5, color: "var(--ink-subtle)" }}>Carregando…</div>
                    : projects.length === 0
                      ? <div style={{ padding: "8px 10px", fontSize: 12.5, color: "var(--ink-subtle)" }}>Nenhum projeto ainda.</div>
                      : projects.map((p: any) => {
                          const cur = !!activeProjectId && p.id === activeProjectId
                          return (
                            <button key={p.id} className="dss-btn" onClick={() => { setOpen(false); onOpenProject(p) }} style={itemStyle(cur)}>
                              <span style={{ width: 22, height: 22, borderRadius: 7, background: "linear-gradient(145deg, #6f6f72, #2b2b2e)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M12 2 21 7v10l-9 5-9-5V7z" stroke="#fff" strokeWidth="1.6" opacity="0.9" /></svg></span>
                              <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</span>
                              {cur && <span style={{ color: "var(--accent-ink)", display: "flex" }}><Icon d="M20 6L9 17l-5-5" size={14} /></span>}
                            </button>
                          )
                        })}
                </div>
                <div style={{ height: 1, background: "var(--hairline)", margin: "6px 4px" }} />
              </>
            )}
            <div className="dss-mono" style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--ink-subtle)", padding: "4px 10px 5px" }}>Ir para</div>
            <button className="dss-btn" onClick={() => { setOpen(false); onHub() }} style={itemStyle(false)}>
              <span style={{ display: "flex", color: "var(--ink-muted)" }}><Icon d={ICONS.grid} size={15} /></span>Todos os projetos
            </button>
        </OverlayMenu>
      )}
    </div>
  )
}

// ─── ComponentsCatalogPage — catálogo com filtro por categoria (substitui acordeões) ─
function ComponentsCatalogPage({ registry, onOpen }: { registry: RegistryEntry[]; onOpen: (n: string) => void }) {
  const [cat, setCat] = useState<string>("Todos")
  const cats = useMemo(() => { const s = new Set<string>(); registry.forEach(e => s.add(e.category || "Outros")); return ["Todos", ...Array.from(s)] }, [registry])
  const list = cat === "Todos" ? registry : registry.filter(e => (e.category || "Outros") === cat)
  return (
    <div className="dss-fade" style={{ padding: "26px 30px 60px" }}>
      <TopBar title="Componentes" />
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 20 }}>
        {cats.map(c => {
          const n = c === "Todos" ? registry.length : registry.filter(e => (e.category || "Outros") === c).length
          const on = cat === c
          return (
            <button key={c} className="dss-btn" onClick={() => setCat(c)}
              style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "8px 14px", borderRadius: 999, background: on ? "var(--ink)" : "var(--surface)", border: "1px solid " + (on ? "var(--ink)" : "var(--hairline)"), color: on ? "#fff" : "var(--ink-muted)", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "var(--font-sans)" }}>
              {c} <span className="dss-mono" style={{ fontSize: 10.5, opacity: .7 }}>{n}</span>
            </button>
          )
        })}
      </div>
      {list.length === 0
        ? <div className="dss-fade" style={{ padding: 60, textAlign: "center", color: "var(--ink-muted)" }}>Nenhum componente nesta categoria.</div>
        : <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 16 }}>
            {list.map(e => <div key={e.name} style={{ background: "var(--surface)", border: "1px solid var(--hairline)", borderRadius: 16, boxShadow: "var(--shadow-md)", padding: 16, display: "flex", justifyContent: "center" }}><ComponentThumbnail entry={e} onClick={() => onOpen(e.name)} /></div>)}
          </div>}
    </div>
  )
}

// ─── RepoSettingsPanel — aba Repositório (Configurações): lê via list-projects, grava via update-project ─
function RepoSettingsPanel({ project, token }: { project: any; token?: string }) {
  const isSupa = !!(project && project.supabase && project.id)
  const [loaded, setLoaded] = useState(false)
  const [repo, setRepo] = useState("")
  const [vercel, setVercel] = useState("")
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [deploys, setDeploys] = useState<any[]>([])
  useEffect(() => {
    if (!isSupa || !token) { setLoaded(true); return }
    let on = true
    fetch("/api/platform?action=list-projects", { headers: { Authorization: "Bearer " + token } })
      .then(r => (r.ok ? r.json() : Promise.reject(new Error("falha"))))
      .then(j => { if (!on) return; const p = ((j && j.projects) || []).find((x: any) => x.id === project.id); if (p) { setRepo(p.repo_full_name || ""); setVercel(p.vercel_url || "") } setLoaded(true) })
      .catch(() => { if (on) setLoaded(true) })
    return () => { on = false }
  }, [isSupa, token, project && project.id]) // eslint-disable-line

  useEffect(() => {
    if (!isSupa || !token || !project?.id) return
    let on = true
    fetch("/api/platform?action=list-deployments&project_id=" + encodeURIComponent(project.id), { headers: { Authorization: "Bearer " + token } })
      .then(r => (r.ok ? r.json() : Promise.reject(new Error("falha"))))
      .then(j => { if (on) setDeploys((j && j.deployments) || []) })
      .catch(() => { /* sem histórico ainda */ })
    return () => { on = false }
  }, [isSupa, token, project && project.id]) // eslint-disable-line

  const field = { width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid var(--hairline-strong)", background: "var(--surface)", fontSize: 13, fontFamily: "var(--font-sans)", color: "var(--ink)", boxSizing: "border-box" as const, outline: "none" }
  const lbl = { fontSize: 11, fontWeight: 700, letterSpacing: ".04em", textTransform: "uppercase" as const, color: "var(--ink-subtle)", marginBottom: 6, display: "block", fontFamily: "var(--font-mono)" }

  const save = async () => {
    if (!token || !project?.id) return
    const r = repo.trim()
    if (r && !/^[\w.-]+\/[\w.-]+$/.test(r)) { setMsg({ ok: false, text: "Formato do repositório: owner/repo." }); return }
    if (!r && !vercel.trim()) { setMsg({ ok: false, text: "Informe o repositório e/ou a URL do Vercel." }); return }
    setBusy(true); setMsg(null)
    try {
      const res = await fetch("/api/platform?action=update-project", {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
        body: JSON.stringify({ project_id: project.id, repo_full_name: r || undefined, vercel_url: vercel.trim() || undefined }),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok || !j.ok) throw new Error(j.detail || j.error || "falha ao salvar")
      if (j.project) { setRepo(j.project.repo_full_name || ""); setVercel(j.project.vercel_url || "") }
      setMsg({ ok: true, text: "Salvo." })
    } catch (e: any) { setMsg({ ok: false, text: String(e?.message || e) }) }
    setBusy(false)
  }

  return (
    <div className="dss-fade">
      <div style={{ fontSize: 17, fontWeight: 700, letterSpacing: "-0.02em", marginBottom: 4 }}>Repositório</div>
      <div style={{ fontSize: 13, color: "var(--ink-muted)", lineHeight: 1.6, marginBottom: 18, maxWidth: 560 }}>Onde o design system é publicado. Preenchido automaticamente ao publicar pelo Overview — edite aqui se precisar ajustar.</div>
      {!isSupa ? (
        <div style={{ background: "var(--surface-2)", border: "1px solid var(--hairline)", borderRadius: 14, padding: "14px 16px", fontSize: 13, color: "var(--ink-muted)" }}>O vínculo de repositório se aplica a projetos do Supabase. Selecione um projeto pelo switcher.</div>
      ) : !loaded ? (
        <div style={{ fontSize: 13, color: "var(--ink-subtle)", padding: "8px 2px" }}>Carregando…</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 520 }}>
          <div>
            <label style={lbl}>Repositório (owner/repo)</label>
            <input value={repo} onChange={e => setRepo(e.target.value)} placeholder="usuario/meu-design-system" style={field} />
          </div>
          <div>
            <label style={lbl}>Vercel URL</label>
            <input value={vercel} onChange={e => setVercel(e.target.value)} placeholder="https://meu-design-system.vercel.app" style={field} />
          </div>
          {msg && <div style={{ background: msg.ok ? "var(--accent-soft)" : "var(--err-soft)", color: msg.ok ? "var(--accent-ink)" : "var(--err)", fontSize: 12.5, fontWeight: 600, padding: "10px 12px", borderRadius: 10, lineHeight: 1.5 }}>{msg.ok ? "✓ " : ""}{msg.text}</div>}
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <button className="dss-btn" onClick={save} disabled={busy} style={{ background: busy ? "var(--surface-3)" : "var(--primary)", color: busy ? "var(--ink-subtle)" : "var(--on-primary)", border: "none", borderRadius: 999, padding: "10px 20px", fontSize: 13, fontWeight: 600, cursor: busy ? "not-allowed" : "pointer", fontFamily: "var(--font-sans)" }}>{busy ? "Salvando…" : "Salvar"}</button>
            {repo.trim() && /^[\w.-]+\/[\w.-]+$/.test(repo.trim()) ? <a href={vercel.trim() || ("https://github.com/" + repo.trim())} target="_blank" rel="noopener noreferrer" className="dss-mono" style={{ fontSize: 12, color: "var(--accent-ink)" }}>Abrir →</a> : null}
          </div>
          {deploys.length > 0 && (
            <div style={{ marginTop: 8, borderTop: "1px solid var(--hairline)", paddingTop: 18 }}>
              <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: "-0.01em", marginBottom: 10 }}>Histórico de deploys</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {deploys.map((d: any) => (
                  <div key={d.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", background: "var(--surface-2)", border: "1px solid var(--hairline)", borderRadius: 10, fontSize: 12.5 }}>
                    <span title={d.status} style={{ flexShrink: 0, width: 7, height: 7, borderRadius: "50%", background: d.status === "success" ? "var(--accent)" : (d.status === "error" || d.status === "failed") ? "var(--err)" : "var(--ink-subtle)" }} />
                    <span style={{ color: "var(--ink)", fontWeight: 600 }}>{d.component_count} {d.component_count === 1 ? "componente" : "componentes"}</span>
                    <span className="dss-mono" style={{ color: "var(--ink-subtle)", fontSize: 11 }}>{d.target_branch}</span>
                    {d.commit_url ? <a href={d.commit_url} target="_blank" rel="noopener noreferrer" className="dss-mono" style={{ fontSize: 11, color: "var(--accent-ink)" }}>{String(d.commit_sha || "").slice(0, 7)}</a> : (d.commit_sha ? <span className="dss-mono" style={{ fontSize: 11, color: "var(--ink-subtle)" }}>{String(d.commit_sha).slice(0, 7)}</span> : null)}
                    <span style={{ marginLeft: "auto", color: "var(--ink-subtle)", fontSize: 11 }}>{d.deployed_at ? new Date(d.deployed_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" }) : ""}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── MembersPanel — aba Membros (Configurações): papéis por projeto via project_members ─
function MembersPanel({ project, token }: { project: any; token?: string }) {
  const isSupa = !!(project && project.supabase && project.id)
  const [loaded, setLoaded] = useState(false)
  const [members, setMembers] = useState<any[]>([])
  const [canManage, setCanManage] = useState(false)
  const [login, setLogin] = useState("")
  const [role, setRole] = useState("editor")
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [suggest, setSuggest] = useState<any[]>([])
  const [selected, setSelected] = useState<any | null>(null)
  const [showSuggest, setShowSuggest] = useState(false)
  const [inviteMode, setInviteMode] = useState<"user" | "email">("user")
  const [email, setEmail] = useState("")
  const [inviteLink, setInviteLink] = useState("")
  const [invites, setInvites] = useState<any[]>([])

  const load = () => {
    if (!isSupa || !token || !project?.id) { setLoaded(true); return }
    fetch("/api/platform?action=list-members&project_id=" + encodeURIComponent(project.id), { headers: { Authorization: "Bearer " + token } })
      .then(r => (r.ok ? r.json() : Promise.reject(new Error("falha"))))
      .then(j => { setMembers((j && j.members) || []); setCanManage(!!(j && j.can_manage)); setLoaded(true) })
      .catch(() => { setLoaded(true); setMsg({ ok: false, text: "Não consegui carregar os membros." }) })
  }
  useEffect(() => { setLoaded(false); setMembers([]); load() }, [isSupa, token, project && project.id]) // eslint-disable-line

  // Autocomplete: busca perfis JÁ cadastrados na plataforma enquanto digita (debounce 200ms)
  useEffect(() => {
    if (!canManage || selected || !token || !project?.id) { setSuggest([]); return }
    const v = login.trim()
    if (!v) { setSuggest([]); setShowSuggest(false); return }
    let alive = true
    const t = setTimeout(() => {
      fetch("/api/platform?action=search-profiles&project_id=" + encodeURIComponent(project.id) + "&q=" + encodeURIComponent(v), { headers: { Authorization: "Bearer " + token } })
        .then(r => (r.ok ? r.json() : Promise.reject(new Error("falha"))))
        .then(j => {
          if (!alive) return
          const existing = new Set(members.map((m: any) => m.user_id))
          setSuggest(((j && j.profiles) || []).filter((p: any) => !existing.has(p.id)))
          setShowSuggest(true)
        })
        .catch(() => { if (alive) setSuggest([]) })
    }, 200)
    return () => { alive = false; clearTimeout(t) }
  }, [login, selected, canManage, token, project && project.id, members]) // eslint-disable-line

  const ROLE_LABEL: Record<string, string> = { owner: "Owner", admin: "Admin", editor: "Editor", viewer: "Viewer" }
  const post = async (action: string, body: any, okText?: string) => {
    if (!token || !project?.id) return
    setBusy(true); setMsg(null)
    try {
      const r = await fetch("/api/platform?action=" + action, {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
        body: JSON.stringify({ project_id: project.id, ...body }),
      })
      const j = await r.json().catch(() => ({}))
      if (!r.ok || !j.ok) throw new Error(j.detail || j.error || "falha")
      if (okText) setMsg({ ok: true, text: okText })
      load()
    } catch (e: any) { setMsg({ ok: false, text: String(e?.message || e) }) }
    setBusy(false)
  }
  const invite = () => {
    if (selected) { const p = selected; setLogin(""); setSelected(null); setSuggest([]); setShowSuggest(false); post("set-member", { user_id: p.id, role }, "Membro adicionado."); return }
    const l = login.trim().replace(/^@/, "")
    if (!l) { setMsg({ ok: false, text: "Busque e selecione uma pessoa cadastrada." }); return }
    setLogin(""); post("set-member", { login_github: l, role }, "Membro adicionado.")
  }

  const loadInvites = () => {
    if (!isSupa || !token || !project?.id) return
    fetch("/api/platform?action=list-invites&project_id=" + encodeURIComponent(project.id), { headers: { Authorization: "Bearer " + token } })
      .then(r => (r.ok ? r.json() : Promise.reject(new Error("falha"))))
      .then(j => setInvites((j && j.invites) || []))
      .catch(() => {})
  }
  useEffect(() => { if (canManage) loadInvites() }, [canManage, token, project && project.id]) // eslint-disable-line

  const sendEmailInvite = async () => {
    if (!token || !project?.id) return
    const em = email.trim().toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) { setMsg({ ok: false, text: "Digite um e-mail válido." }); return }
    setBusy(true); setMsg(null); setInviteLink("")
    try {
      const r = await fetch("/api/platform?action=create-invite", { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + token }, body: JSON.stringify({ project_id: project.id, email: em, role }) })
      const j = await r.json().catch(() => ({}))
      if (!r.ok || !j.ok) throw new Error(j.detail || j.error || "falha")
      if (j.added) { setMsg({ ok: true, text: "Essa pessoa já tinha conta — adicionada direto ao projeto." }); setEmail(""); load() }
      else if (j.invited && j.token) { setInviteLink(window.location.origin + "/invite/" + j.token); setEmail(""); loadInvites() }
    } catch (e: any) { setMsg({ ok: false, text: String(e?.message || e) }) }
    setBusy(false)
  }
  const revoke = async (invite_id: string) => {
    if (!token || !project?.id) return
    setBusy(true); setMsg(null)
    try {
      const r = await fetch("/api/platform?action=revoke-invite", { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + token }, body: JSON.stringify({ project_id: project.id, invite_id }) })
      const j = await r.json().catch(() => ({}))
      if (!r.ok || !j.ok) throw new Error(j.detail || j.error || "falha")
      loadInvites()
    } catch (e: any) { setMsg({ ok: false, text: String(e?.message || e) }) }
    setBusy(false)
  }

  const field = { padding: "10px 12px", borderRadius: 10, border: "1px solid var(--hairline-strong)", background: "var(--surface)", fontSize: 13, fontFamily: "var(--font-sans)", color: "var(--ink)", boxSizing: "border-box" as const, outline: "none" }

  return (
    <div className="dss-fade">
      <div style={{ fontSize: 17, fontWeight: 700, letterSpacing: "-0.02em", marginBottom: 4 }}>Membros</div>
      <div style={{ fontSize: 13, color: "var(--ink-muted)", lineHeight: 1.6, marginBottom: 18, maxWidth: 560 }}>Quem acessa este projeto e com qual papel. <span className="dss-mono">Owner/Admin</span> gerenciam tudo; <span className="dss-mono">Editor</span> publica e edita docs; <span className="dss-mono">Viewer</span> só lê.</div>
      {!isSupa ? (
        <div style={{ background: "var(--surface-2)", border: "1px solid var(--hairline)", borderRadius: 14, padding: "14px 16px", fontSize: 13, color: "var(--ink-muted)" }}>Membros se aplicam a projetos do Supabase. Selecione um projeto pelo switcher.</div>
      ) : !loaded ? (
        <div style={{ fontSize: 13, color: "var(--ink-subtle)", padding: "8px 2px" }}>Carregando…</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 620 }}>
          {canManage && (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ display: "inline-flex", gap: 2, background: "var(--surface-2)", border: "1px solid var(--hairline)", borderRadius: 999, padding: 3, alignSelf: "flex-start" }}>
                {(([["user", "Buscar cadastrado"], ["email", "Convidar por e-mail"]]) as [string, string][]).map(([v, l]) => (
                  <button key={v} className="dss-btn" onClick={() => { setInviteMode(v as any); setMsg(null); setInviteLink("") }} style={{ border: "none", borderRadius: 999, padding: "6px 13px", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "var(--font-sans)", background: inviteMode === v ? "var(--surface)" : "transparent", color: inviteMode === v ? "var(--ink)" : "var(--ink-subtle)", boxShadow: inviteMode === v ? "var(--shadow-sm)" : "none" }}>{l}</button>
                ))}
              </div>
              {inviteMode === "user" ? (
              <div style={{ display: "flex", gap: 8, alignItems: "stretch", flexWrap: "wrap" }}>
              <div style={{ position: "relative", flex: 1, minWidth: 180 }}>
                <input value={login} onChange={e => { setLogin(e.target.value); setSelected(null) }} onFocus={() => { if (login.trim() && suggest.length) setShowSuggest(true) }} onBlur={() => setTimeout(() => setShowSuggest(false), 150)} onKeyDown={e => { if (e.key === "Enter") invite() }} placeholder="buscar pessoa cadastrada…" style={{ ...field, width: "100%" }} />
                {showSuggest && suggest.length > 0 && (
                  <div style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, zIndex: 30, background: "var(--surface)", border: "1px solid var(--hairline-strong)", borderRadius: 12, boxShadow: "var(--shadow-lg)", overflow: "hidden", maxHeight: 264, overflowY: "auto" }}>
                    {suggest.map((p: any, i: number) => (
                      <button key={p.id} onMouseDown={e => { e.preventDefault(); setSelected(p); setLogin(p.login_github || ""); setSuggest([]); setShowSuggest(false) }} style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "9px 12px", background: "none", border: "none", borderTop: i ? "1px solid var(--hairline)" : "none", cursor: "pointer", textAlign: "left" }}>
                        {p.avatar_url ? <img src={p.avatar_url} alt="" style={{ width: 26, height: 26, borderRadius: "50%", flexShrink: 0 }} /> : <div style={{ width: 26, height: 26, borderRadius: "50%", background: "var(--surface-3)", flexShrink: 0 }} />}
                        <span style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
                          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name || p.login_github}</span>
                          {p.login_github && <span className="dss-mono" style={{ fontSize: 11, color: "var(--ink-subtle)" }}>@{p.login_github}</span>}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
                {showSuggest && suggest.length === 0 && login.trim() && !selected && (
                  <div style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, zIndex: 30, background: "var(--surface)", border: "1px solid var(--hairline-strong)", borderRadius: 12, boxShadow: "var(--shadow-lg)", padding: "10px 12px", fontSize: 12.5, color: "var(--ink-subtle)", lineHeight: 1.5 }}>Ninguém cadastrado com esse nome. A pessoa precisa ter entrado no DS Studio ao menos uma vez.</div>
                )}
              </div>
              <select value={role} onChange={e => setRole(e.target.value)} style={{ ...field, cursor: "pointer" }}>
                <option value="admin">Admin</option>
                <option value="editor">Editor</option>
                <option value="viewer">Viewer</option>
              </select>
              <button className="dss-btn" onClick={invite} disabled={busy} style={{ background: busy ? "var(--surface-3)" : "var(--primary)", color: busy ? "var(--ink-subtle)" : "var(--on-primary)", border: "none", borderRadius: 999, padding: "10px 20px", fontSize: 13, fontWeight: 600, cursor: busy ? "not-allowed" : "pointer", fontFamily: "var(--font-sans)", whiteSpace: "nowrap" }}>Convidar</button>
            </div>
            ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ display: "flex", gap: 8, alignItems: "stretch", flexWrap: "wrap" }}>
                <input type="email" value={email} onChange={e => { setEmail(e.target.value); setInviteLink("") }} onKeyDown={e => { if (e.key === "Enter") sendEmailInvite() }} placeholder="email@exemplo.com" style={{ ...field, flex: 1, minWidth: 200 }} />
                <select value={role} onChange={e => setRole(e.target.value)} style={{ ...field, cursor: "pointer" }}>
                  <option value="admin">Admin</option>
                  <option value="editor">Editor</option>
                  <option value="viewer">Viewer</option>
                </select>
                <button className="dss-btn" onClick={sendEmailInvite} disabled={busy} style={{ background: busy ? "var(--surface-3)" : "var(--primary)", color: busy ? "var(--ink-subtle)" : "var(--on-primary)", border: "none", borderRadius: 999, padding: "10px 20px", fontSize: 13, fontWeight: 600, cursor: busy ? "not-allowed" : "pointer", fontFamily: "var(--font-sans)", whiteSpace: "nowrap" }}>Gerar convite</button>
              </div>
              {inviteLink && (
                <div style={{ background: "var(--surface-2)", border: "1px solid var(--hairline)", borderRadius: 12, padding: "12px 14px" }}>
                  <div style={{ fontSize: 12, color: "var(--ink-muted)", marginBottom: 8, lineHeight: 1.5 }}>Envie este link para a pessoa. Ao entrar com o GitHub, ela é vinculada automaticamente a este projeto com o papel escolhido.</div>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <input readOnly value={inviteLink} onFocus={e => (e.target as HTMLInputElement).select()} style={{ ...field, flex: 1, minWidth: 0, fontFamily: "var(--font-mono)", fontSize: 12 }} />
                    <button className="dss-btn" onClick={() => { try { navigator.clipboard.writeText(inviteLink); setMsg({ ok: true, text: "Link copiado." }) } catch {} }} style={{ background: "var(--primary)", color: "var(--on-primary)", border: "none", borderRadius: 999, padding: "10px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "var(--font-sans)", whiteSpace: "nowrap" }}>Copiar</button>
                  </div>
                </div>
              )}
            </div>
            )}
            </div>
          )}
          {msg && <div style={{ background: msg.ok ? "var(--accent-soft)" : "var(--err-soft)", color: msg.ok ? "var(--accent-ink)" : "var(--err)", fontSize: 12.5, fontWeight: 600, padding: "10px 12px", borderRadius: 10, lineHeight: 1.5 }}>{msg.ok ? "✓ " : ""}{msg.text}</div>}
          <div style={{ ...PANEL, border: "1px solid var(--hairline)", overflow: "hidden" }}>
            {members.map((mb: any, i: number) => {
              const isOwner = mb.role === "owner"
              return (
                <div key={mb.user_id || i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", borderTop: i ? "1px solid var(--hairline)" : "none" }}>
                  {mb.avatar ? <img src={mb.avatar} alt="" style={{ width: 32, height: 32, borderRadius: "50%", flexShrink: 0 }} /> : <div style={{ width: 32, height: 32, borderRadius: "50%", background: "var(--surface-3)", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, color: "var(--ink-subtle)" }}>{String(mb.name || mb.login || "?").slice(0, 1).toUpperCase()}</div>}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{mb.name || mb.login || "—"}</div>
                    {mb.login && <div className="dss-mono" style={{ fontSize: 11, color: "var(--ink-subtle)" }}>@{mb.login}</div>}
                  </div>
                  {canManage && !isOwner ? (
                    <select value={mb.role} onChange={e => post("set-member", { user_id: mb.user_id, role: e.target.value })} disabled={busy} style={{ ...field, padding: "6px 8px", fontSize: 12, cursor: "pointer" }}>
                      <option value="admin">Admin</option>
                      <option value="editor">Editor</option>
                      <option value="viewer">Viewer</option>
                    </select>
                  ) : (
                    <span className="dss-mono" style={{ fontSize: 11, fontWeight: 700, padding: "4px 10px", borderRadius: 999, background: isOwner ? "var(--accent-soft)" : "var(--surface-3)", color: isOwner ? "var(--accent-ink)" : "var(--ink-subtle)" }}>{ROLE_LABEL[mb.role] || mb.role}</span>
                  )}
                  {canManage && !isOwner && <button onClick={() => post("remove-member", { user_id: mb.user_id })} disabled={busy} title="Remover" style={{ background: "none", border: "none", cursor: busy ? "not-allowed" : "pointer", color: "var(--ink-subtle)", fontSize: 18, padding: "2px 6px", lineHeight: 1 }}>×</button>}
                </div>
              )
            })}
          </div>
          {canManage && invites.length > 0 && (
            <div>
              <div className="dss-mono" style={{ fontSize: 10, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--ink-subtle)", margin: "2px 0 8px" }}>Convites pendentes</div>
              <div style={{ ...PANEL, border: "1px solid var(--hairline)", overflow: "hidden" }}>
                {invites.map((iv: any, i: number) => (
                  <div key={iv.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 16px", borderTop: i ? "1px solid var(--hairline)" : "none" }}>
                    <div style={{ flexShrink: 0, width: 30, height: 30, borderRadius: "50%", background: "var(--surface-3)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--ink-subtle)" }}><Icon d="M4 5h16v14H4z|M4 7l8 6 8-6" size={14} /></div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{iv.email}</div>
                      <div className="dss-mono" style={{ fontSize: 11, color: "var(--ink-subtle)" }}>aguardando cadastro</div>
                    </div>
                    <span className="dss-mono" style={{ fontSize: 11, fontWeight: 700, padding: "4px 10px", borderRadius: 999, background: "var(--surface-3)", color: "var(--ink-subtle)" }}>{ROLE_LABEL[iv.role] || iv.role}</span>
                    <button className="dss-btn" onClick={() => { try { navigator.clipboard.writeText(window.location.origin + "/invite/" + iv.token); setMsg({ ok: true, text: "Link copiado." }) } catch {} }} title="Copiar link do convite" style={{ background: "none", border: "1px solid var(--hairline-strong)", borderRadius: 999, padding: "5px 11px", fontSize: 12, fontWeight: 600, cursor: "pointer", color: "var(--ink-muted)", fontFamily: "var(--font-sans)", whiteSpace: "nowrap" }}>Copiar link</button>
                    <button onClick={() => revoke(iv.id)} disabled={busy} title="Revogar convite" style={{ background: "none", border: "none", cursor: busy ? "not-allowed" : "pointer", color: "var(--ink-subtle)", fontSize: 18, padding: "2px 6px", lineHeight: 1 }}>×</button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── ModulesPanel — Console › Módulos: editor dos padrões da plataforma (toggles → set-modules) ─
const MODULE_META: { key: string; label: string; group: string; kind: "flag" | "limit" }[] = [
  { key: "code_gen", label: "Geração de código", group: "Recursos", kind: "flag" },
  { key: "ai_docs", label: "Documentação por IA", group: "Recursos", kind: "flag" },
  { key: "token_export", label: "Exportar tokens", group: "Recursos", kind: "flag" },
  { key: "versioning", label: "Versionamento", group: "Recursos", kind: "flag" },
  { key: "curate", label: "Curadoria", group: "Recursos", kind: "flag" },
  { key: "component_playground", label: "Playground", group: "Recursos", kind: "flag" },
  { key: "insights", label: "Insights", group: "Páginas", kind: "flag" },
  { key: "activity_log", label: "Atividade", group: "Páginas", kind: "flag" },
  { key: "builder", label: "Builder — foundation ao vivo (beta)", group: "Páginas", kind: "flag" },
  { key: "deploy_github", label: "Deploy no GitHub", group: "Publicação", kind: "flag" },
  { key: "password_gate", label: "Proteção por senha", group: "Publicação", kind: "flag" },
  { key: "staging_workflow", label: "Fluxo de staging", group: "Publicação", kind: "flag" },
  { key: "custom_domain", label: "Domínio próprio", group: "Publicação", kind: "flag" },
  { key: "max_components", label: "Máx. componentes", group: "Limites", kind: "limit" },
  { key: "max_generations_month", label: "Máx. gerações/mês", group: "Limites", kind: "limit" },
  { key: "model_tier", label: "Tier de modelo", group: "Limites", kind: "limit" },
]
function ModulesPanel({ token }: { token?: string }) {
  const [features, setFeatures] = useState<Modules | null>(null)
  const [busyKey, setBusyKey] = useState<string | null>(null)
  const [err, setErr] = useState("")
  useEffect(() => {
    if (!token) { setFeatures({}); return }
    let on = true
    fetch("/api/platform?action=get-modules&target_type=platform", { headers: { Authorization: "Bearer " + token } })
      .then(r => (r.ok ? r.json() : Promise.reject(new Error("falha"))))
      .then(j => { if (on) setFeatures((j && j.features) || {}) })
      .catch(() => { if (on) { setFeatures({}); setErr("Não consegui carregar os módulos da plataforma.") } })
    return () => { on = false }
  }, [token])

  const eff = (key: string) => { const f: any = features || {}; return (key in f) ? f[key] : (DEFAULT_MODULES as any)[key] }
  const toggle = async (key: string) => {
    if (!token || busyKey) return
    const cur = eff(key)
    const next = (cur === false || cur === 0) ? true : false
    setBusyKey(key); setErr("")
    setFeatures(f => ({ ...(f || {}), [key]: next }))
    try {
      const r = await fetch("/api/platform?action=set-modules", {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
        body: JSON.stringify({ target_type: "platform", features: { [key]: next } }),
      })
      const j = await r.json().catch(() => ({}))
      if (!r.ok || !j.ok) throw new Error(j.detail || j.error || "falha")
      if (j.features) setFeatures(j.features)
    } catch (e: any) {
      setFeatures(f => ({ ...(f || {}), [key]: cur }))
      setErr("Não consegui salvar: " + String(e?.message || e))
    }
    setBusyKey(null)
  }

  const groups = ["Recursos", "Páginas", "Publicação", "Limites"]
  return (
    <div className="dss-fade" style={{ padding: "26px 30px 60px" }}>
      <TopBar title="Módulos" />
      <div style={{ fontSize: 13, color: "var(--ink-muted)", lineHeight: 1.6, marginBottom: 10, maxWidth: 640 }}>
        <strong style={{ color: "var(--ink)" }}>Padrões da plataforma.</strong> O que você liga/desliga aqui é o default de todos os projetos — a cascata <span className="dss-mono">Plataforma → Org → Projeto → Usuário</span> deixa cada escopo sobrepor (o mais específico vence).
      </div>
      {err && <div style={{ background: "var(--err-soft)", color: "var(--err)", fontSize: 12.5, fontWeight: 600, padding: "10px 12px", borderRadius: 10, marginBottom: 16, maxWidth: 640 }}>{err}</div>}
      {features === null ? (
        <div style={{ fontSize: 13, color: "var(--ink-subtle)", padding: "8px 2px" }}>Carregando módulos…</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          {groups.map(g => {
            const items = MODULE_META.filter(x => x.group === g)
            if (!items.length) return null
            return (
              <div key={g} style={{ ...PANEL, border: "1px solid var(--hairline)", overflow: "hidden" }}>
                <div style={{ padding: "13px 18px", borderBottom: "1px solid var(--hairline)", fontSize: 13, fontWeight: 700, letterSpacing: "-0.01em" }}>{g}</div>
                <div>
                  {items.map((it, i) => {
                    const v = eff(it.key)
                    const on = !(v === false || v === 0)
                    const busy = busyKey === it.key
                    return (
                      <div key={it.key} style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 18px", borderTop: i ? "1px solid var(--hairline)" : "none" }}>
                        <span style={{ flex: 1, minWidth: 0, fontSize: 13.5, color: "var(--ink)" }}>{it.label} <span className="dss-mono" style={{ fontSize: 11, color: "var(--ink-subtle)", marginLeft: 6 }}>{it.key}</span></span>
                        {it.kind === "limit" ? (
                          <span className="dss-mono" style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)" }}>{String(v)}</span>
                        ) : (
                          <button onClick={() => toggle(it.key)} disabled={busy} title={on ? "Desligar" : "Ligar"}
                            style={{ position: "relative", width: 40, height: 23, borderRadius: 999, border: "none", cursor: busy ? "wait" : "pointer", background: on ? "var(--accent)" : "var(--surface-3)", transition: "background .15s", opacity: busy ? 0.6 : 1, flexShrink: 0 }}>
                            <span style={{ position: "absolute", top: 2, left: on ? 19 : 2, width: 19, height: 19, borderRadius: "50%", background: "#fff", transition: "left .15s", boxShadow: "0 1px 2px rgba(0,0,0,.2)" }} />
                          </button>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
          <div style={{ fontSize: 11.5, color: "var(--ink-subtle)", lineHeight: 1.5, maxWidth: 640 }}>Limites (máx. componentes/gerações, tier de modelo) entram com o controle por org/projeto — aqui mostram o default da plataforma.</div>
        </div>
      )}
    </div>
  )
}

// ─── Menu de perfil (topo-direito) + contexto da sidebar ─────────────────────
// ProfileModal (configurações), SidebarScope (contexto estático) e UserMenu
// (dropdown do card de perfil: troca de visualização + perfil + sair).
function ProfileModal({ session, theme, onToggleTheme, isPlatformAdmin, onClose, onSignOut }: { session: Session; theme: Theme; onToggleTheme: () => void; isPlatformAdmin?: boolean; onClose: () => void; onSignOut: () => void }) {
  const rowBtn: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 8, border: "1px solid var(--hairline-strong)", background: "transparent", borderRadius: 999, padding: "8px 14px", cursor: "pointer", fontSize: 12.5, fontWeight: 600, color: "var(--ink)", fontFamily: "var(--font-sans)" }
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(20,20,22,.42)", backdropFilter: "blur(2px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div onClick={e => e.stopPropagation()} style={{ width: 440, maxWidth: "100%", background: "var(--surface)", borderRadius: 22, boxShadow: "var(--shadow-lg)", padding: 26, fontFamily: "var(--font-sans)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          {session.avatar ? <img src={session.avatar} alt="" style={{ width: 52, height: 52, borderRadius: "50%" }} /> : <div style={{ width: 52, height: 52, borderRadius: "50%", background: "var(--surface-3)" }} />}
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: "-0.02em", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{session.name || session.login}</div>
            <div className="dss-mono" style={{ fontSize: 11, color: "var(--ink-subtle)", marginTop: 2 }}>{session.login ? "@" + session.login : ""}{isPlatformAdmin ? " · PLATFORM ADMIN" : ""}</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 0", borderTop: "1px solid var(--hairline)", marginTop: 18 }}>
          <div><div style={{ fontSize: 14, fontWeight: 600 }}>Tema</div><div style={{ fontSize: 12, color: "var(--ink-muted)", marginTop: 1 }}>Aparência clara ou escura</div></div>
          <button className="dss-btn" onClick={onToggleTheme} style={rowBtn}><Icon d={theme === "light" ? ICONS.moon : ICONS.sun} size={15} />{theme === "light" ? "Escuro" : "Claro"}</button>
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 0", borderTop: "1px solid var(--hairline)" }}>
          <div><div style={{ fontSize: 14, fontWeight: 600 }}>Conta</div><div style={{ fontSize: 12, color: "var(--ink-muted)", marginTop: 1 }}>Autenticado via GitHub</div></div>
          <button className="dss-btn" onClick={() => window.open("https://github.com/settings/profile", "_blank", "noopener")} style={rowBtn}>Gerenciar no GitHub<Icon d="M7 17L17 7M9 7h8v8" size={14} /></button>
        </div>
        <div style={{ display: "flex", gap: 10, marginTop: 22 }}>
          <button className="dss-btn" onClick={onClose} style={{ flex: 1, border: "1px solid var(--hairline-strong)", background: "transparent", borderRadius: 12, padding: "11px 0", cursor: "pointer", fontSize: 13.5, fontWeight: 600, color: "var(--ink)", fontFamily: "var(--font-sans)" }}>Fechar</button>
          <button className="dss-btn" onClick={onSignOut} style={{ flex: 1, border: "none", background: "var(--err-soft)", color: "var(--err)", borderRadius: 12, padding: "11px 0", cursor: "pointer", fontSize: 13.5, fontWeight: 700, fontFamily: "var(--font-sans)" }}>Sair</button>
        </div>
      </div>
    </div>
  )
}



function UserMenu({ session, onSignOut, theme, onToggleTheme, isPlatformAdmin, canConsole, onConsole, activeConsole }: { session: Session; onSignOut: () => void; theme: Theme; onToggleTheme: () => void; isPlatformAdmin?: boolean; canConsole?: boolean; onConsole?: () => void; activeConsole?: boolean }) {
  const [open, setOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const item: React.CSSProperties = { display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "9px 10px", borderRadius: 10, border: "none", cursor: "pointer", fontSize: 13, fontWeight: 500, textAlign: "left", fontFamily: "var(--font-sans)", background: "transparent", color: "var(--ink)" }
  return (
    <div style={{ position: "relative" }}>
      <button ref={triggerRef} className="dss-btn" title="Perfil" onClick={() => setOpen(o => !o)} style={{ display: "flex", alignItems: "center", gap: 8, background: open ? "var(--surface-2)" : "var(--surface)", border: "1px solid var(--hairline-strong)", borderRadius: 999, cursor: "pointer", padding: "4px 10px 4px 5px", transition: "background .12s" }}>
        {session.avatar ? <img src={session.avatar} alt="" style={{ width: 30, height: 30, borderRadius: "50%" }} /> : <div style={{ width: 30, height: 30, borderRadius: "50%", background: "var(--surface-3)" }} />}
        <span style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)", whiteSpace: "nowrap" }}>{session.name || session.login}</span>
        <span style={{ color: "var(--ink-subtle)", display: "flex", transition: "transform .16s", transform: open ? "rotate(180deg)" : "none" }}><Icon d="M6 9l6 6 6-6" size={15} /></span>
      </button>
      {open && (
        <OverlayMenu onClose={() => setOpen(false)} anchorRef={triggerRef} placement="right" width={262}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px 10px" }}>
              {session.avatar ? <img src={session.avatar} alt="" style={{ width: 38, height: 38, borderRadius: "50%" }} /> : <div style={{ width: 38, height: 38, borderRadius: "50%", background: "var(--surface-3)" }} />}
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: "var(--ink)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{session.name || session.login}</div>
                <div className="dss-mono" style={{ fontSize: 10, color: "var(--ink-subtle)", marginTop: 2 }}>{isPlatformAdmin ? "PLATFORM ADMIN" : (session.login ? "@" + session.login : "")}</div>
              </div>
            </div>
            <div style={{ height: 1, background: "var(--hairline)", margin: "2px 4px 6px" }} />
            {canConsole && onConsole && (
              <button className="dss-btn" onClick={() => { setOpen(false); onConsole() }} style={activeConsole ? { ...item, background: "var(--accent-soft)", color: "var(--accent-ink)", fontWeight: 600 } : item}><span style={{ display: "flex", color: activeConsole ? "var(--accent-ink)" : "var(--ink-muted)" }}><Icon d="M3 21h18|M5 21V7l7-4 7 4v14|M9 21v-6h6v6" size={15} /></span>Console da plataforma<span style={{ marginLeft: "auto", fontSize: 9, fontWeight: 700, padding: "2px 7px", borderRadius: 999, background: "var(--ink)", color: "#fff", letterSpacing: ".03em" }}>admin</span></button>
            )}
            <button className="dss-btn" onClick={() => { setOpen(false); setProfileOpen(true) }} style={item}><span style={{ display: "flex", color: "var(--ink-muted)" }}><Icon d="M12 8a4 4 0 100 8 4 4 0 000-8z|M4 21v-1a5 5 0 015-5h6a5 5 0 015 5v1" size={15} /></span>Configurações do perfil</button>
            <div style={{ height: 1, background: "var(--hairline)", margin: "6px 4px" }} />
            <button className="dss-btn" onClick={() => { setOpen(false); onSignOut() }} style={{ ...item, color: "var(--err)" }}><span style={{ display: "flex", color: "var(--err)" }}><Icon d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4|M16 17l5-5-5-5|M21 12H9" size={15} /></span>Sair</button>
        </OverlayMenu>
      )}
      {profileOpen && <ProfileModal session={session} theme={theme} onToggleTheme={onToggleTheme} isPlatformAdmin={isPlatformAdmin} onClose={() => setProfileOpen(false)} onSignOut={onSignOut} />}
    </div>
  )
}

// ─── AppSidebar — casca única de sidebar (projeto e console) ──────────────────
// Mesmo shell: largura + recolher, marca (via scope), rodapé (DSBadge), fundo.
// Só o conteúdo de navegação difere entre superfícies e entra como children.
function AppSidebar({ collapsed, onToggleCollapse, scope, children }: { collapsed: boolean; onToggleCollapse: () => void; scope: React.ReactNode; children: React.ReactNode }) {
  return (
    <aside className="dss-scroll" style={{ width: collapsed ? 72 : 268, transition: "width .18s ease", flexShrink: 0, background: "var(--surface)", borderRight: "1px solid var(--hairline)", display: "flex", flexDirection: "column", height: "100vh", position: "sticky", top: 0, overflowY: "auto" }}>
      <div style={{ padding: collapsed ? "22px 8px 10px" : "22px 20px 14px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: collapsed ? "center" : "space-between", flexDirection: collapsed ? "column" : "row", gap: collapsed ? 10 : 0, marginBottom: collapsed ? 10 : 18 }}>
          {scope}
          <button className="dss-btn" title={collapsed ? "Expandir menu" : "Recolher menu"} onClick={onToggleCollapse} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--ink-subtle)", padding: 4, borderRadius: 8, display: "flex" }}>
            <Icon d="M9 3v18|M3 5a2 2 0 012-2h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V5z" size={15} />
          </button>
        </div>
      </div>
      {children}
      <div style={{ flex: 1 }} />
      {!collapsed && <div style={{ padding: "12px 16px", borderTop: "1px solid var(--hairline)" }}><DSBadge /></div>}
    </aside>
  )
}

export default function Platform({ registry }: { registry: RegistryEntry[] }) {

  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window !== "undefined" && window.matchMedia?.("(prefers-color-scheme: dark)").matches) return "dark"
    return "light"
  })
  const [route, setRoute] = useState<Route>(() =>
    typeof window !== "undefined" ? parsePath(window.location.pathname, registry) : { kind: "overview" })
  const [tab, setTab] = useState<TabId>(() => (route.kind === "component" && route.tab) ? route.tab : "canvas")
  const [query, setQuery] = useState("")
  const [showMd, setShowMd] = useState(false)
  const [showPublish, setShowPublish] = useState(false)
  const access = useAccess()
  const [unlocked, setUnlocked] = useState<boolean>(() => { try { return sessionStorage.getItem("dss-access-ok") === "1" } catch { return false } })
  const { session, loading: sessionLoading, signOut, refresh: refreshSession } = useSession()
  const [projRole, setProjRole] = useState<string | null>(null)
  const [navCollapsed, setNavCollapsed] = useState<boolean>(() => { try { return localStorage.getItem("dss-nav-collapsed") === "1" } catch { return false } })
  const [pendingReqs, setPendingReqs] = useState(0)
  useEffect(() => {
    if (!session?.accessToken || !session.isAdmin) { setPendingReqs(0); return }
    let on = true
    fetch("/api/platform?action=list-access-requests&status=pending", { headers: { Authorization: "Bearer " + session.accessToken } })
      .then(r => (r.ok ? r.json() : null)).then((j: any) => { if (on && j && j.ok) setPendingReqs((j.requests || []).length) }).catch(() => {})
    return () => { on = false }
  }, [session, route])
  const persistCollapsed = (v: boolean) => { setNavCollapsed(v); try { localStorage.setItem("dss-nav-collapsed", v ? "1" : "0") } catch {} }
  const [openLayers, setOpenLayers] = useState<Record<string, boolean>>(() => { try { return JSON.parse(localStorage.getItem("dss-nav-open") || "{}") } catch { return {} } })
  const persistLayers = (n: Record<string, boolean>) => { setOpenLayers(n); try { localStorage.setItem("dss-nav-open", JSON.stringify(n)) } catch {} }
  const { curation: curationData, refresh: refreshCuration } = useCuration()
  const metaData = useComponentMeta(registry)
  const [quickDeleted, setQuickDeleted] = useState<Set<string>>(new Set()) // optimistic overlay — instant UI removal
  // Projeto ativo: null = instância DS Studio (usa o registry-prop); senão = projeto do Supabase (registry derivado)
  const [activeProject, setActiveProject] = useState<{ id: string; name: string; supabase: boolean } | null>(() => { try { const pid = projectIdFromPath(window.location.pathname); return pid ? { id: pid, name: "", supabase: true } : null } catch { return null } })
  const caps = roleCaps(session, projRole)
  const [q, setQ] = useState("")
  const [projectReg, setProjectReg] = useState<RegistryEntry[] | null>(null)
  const [projStats, setProjStats] = useState<{ tokenCount: number } | null>(null)
  const [publicVis, setPublicVis] = useState<null | "loading" | "public" | "private">(null)
  const [projTokens, setProjTokens] = useState<TokenEntry[] | null>(null)
  const [tokensRefresh, setTokensRefresh] = useState(0)
  const [linkCopied, setLinkCopied] = useState(false)
  const curated = useMemo(() => {
    // Projeto Supabase: usa o registry derivado (sem overlay de meta/curation da instância — F1)
    if (activeProject && activeProject.supabase) {
      const base = projectReg || []
      return quickDeleted.size ? base.filter(c => !quickDeleted.has(c.name)) : base
    }
    const base = applyCuration(withMeta(registry, metaData), curationData)
    return quickDeleted.size ? base.filter(c => !quickDeleted.has(c.name)) : base
  }, [activeProject, projectReg, registry, metaData, curationData, quickDeleted])

  useEffect(() => { document.documentElement.setAttribute("data-theme", theme) }, [theme])
  // Papel do usuário no projeto ativo (alimenta o roleCaps)
  useEffect(() => {
    const pid = activeProject && activeProject.supabase ? activeProject.id : null
    const tk = session ? session.accessToken : undefined
    if (!pid || !tk) { setProjRole(null); return }
    let on = true
    fetch("/api/platform?action=project-role&project_id=" + encodeURIComponent(pid), { headers: { Authorization: "Bearer " + tk } })
      .then(r => (r.ok ? r.json() : Promise.reject(new Error("falha"))))
      .then(j => { if (on) setProjRole((j && j.role) || null) })
      .catch(() => { if (on) setProjRole(null) })
    return () => { on = false }
  }, [activeProject, session]) // eslint-disable-line
  // Carrega os componentes do projeto Supabase ativo (vira o registry escopado)
  useEffect(() => {
    if (!activeProject || !activeProject.supabase) { setProjectReg(null); return }
    const tk = session ? session.accessToken : undefined
    let on = true
    setProjectReg(null)
    // com token → dono; sem token → a API serve se o projeto for público (viewer read-only)
    fetch("/api/platform?action=list-components&project_id=" + encodeURIComponent(activeProject.id), { headers: tk ? { Authorization: "Bearer " + tk } : {} })
      .then(r => (r.ok ? r.json() : null))
      .then(j => { if (on) setProjectReg(j && j.ok ? supaToRegistry(j.components || []) : []) })
      .catch(() => { if (on) setProjectReg([]) })
    return () => { on = false }
  }, [activeProject, session])
  // Metadados do projeto Supabase ativo: nome (breadcrumb/marca, em cold load) + token_count (stats do Overview)
  useEffect(() => {
    if (!activeProject || !activeProject.supabase) { setProjStats(null); setPublicVis(null); return }
    let on = true
    setPublicVis("loading")
    fetch("/api/platform?action=project&project_id=" + encodeURIComponent(activeProject.id))
      .then(r => (r.ok ? r.json() : null))
      .then(j => {
        if (!on) return
        if (!j || !j.ok || !j.project) { setPublicVis("private"); return }
        const p = j.project
        setProjStats({ tokenCount: Number(p.token_count) || 0 })
        setPublicVis(String(p.visibility || "") === "public" ? "public" : "private")
        setActiveProject(prev => (prev && prev.id === p.id && !prev.name) ? { ...prev, name: p.name || prev.name } : prev)
      })
      .catch(() => { if (on) setPublicVis("private") })
    return () => { on = false }
  }, [activeProject?.id, activeProject?.supabase])
  // Tokens (foundations) do projeto Supabase ativo — via list-tokens (dono com token OU público sem token)
  useEffect(() => {
    if (!activeProject || !activeProject.supabase) { __dsFoundationCss = ""; setProjTokens(null); return }
    const tk = session ? session.accessToken : undefined
    let on = true
    __dsFoundationCss = "" // escopo por projeto: zera antes de carregar a foundation do projeto ativo
    setProjTokens(null)
    fetch("/api/platform?action=list-tokens&project_id=" + encodeURIComponent(activeProject.id) + "&_t=" + Date.now(), { cache: "no-store", headers: tk ? { Authorization: "Bearer " + tk } : {} })
      .then(r => (r.ok ? r.json() : null))
      .then(j => { if (on) { __dsFoundationCss = (j && j.tokensCss) || ""; setProjTokens(j && j.ok && Array.isArray(j.tokens) ? j.tokens : []) } })
      .catch(() => { if (on) setProjTokens([]) })
    return () => { on = false }
  }, [activeProject, session, tokensRefresh])
  const copyPublicLink = () => { try { navigator.clipboard.writeText(window.location.origin + "/p/" + (activeProject ? activeProject.id : "")); setLinkCopied(true); setTimeout(() => setLinkCopied(false), 1800) } catch {} }
  const openProject = (p: any) => { setActiveProject({ id: p.id, name: p.name, supabase: true }); setRoute({ kind: "overview" }) }
  const openInstance = () => { setActiveProject(null); setRoute({ kind: "overview" }) }
  const goHub = () => { setActiveProject(null); setProjectReg(null); setRoute({ kind: "projects" }) }
  const projName = activeProject ? activeProject.name : REPO_NAME.replace(/-/g, " ")
  // E8 — deep linking: keep URL in sync with route+tab, and react to back/forward
  useEffect(() => {
    const onPop = () => {
      const path = window.location.pathname
      const pid = projectIdFromPath(path)
      // back/forward cruzando o hub: sincroniza o projeto ativo com a URL
      setActiveProject(prev => pid ? (prev && prev.id === pid ? prev : { id: pid, name: "", supabase: true }) : (prev ? null : prev))
      const r = parsePath(path, registry)
      setRoute(r)
      if (r.kind === "component") setTab(r.tab || "canvas")
    }
    window.addEventListener("popstate", onPop)
    return () => window.removeEventListener("popstate", onPop)
  }, [registry])
  useEffect(() => {
    const pid = activeProject && activeProject.supabase ? activeProject.id : undefined
    const want = routeToPath(route.kind === "component" ? { ...route, tab } : route, pid)
    if (window.location.pathname !== want) window.history.pushState({}, "", want)
  }, [route, tab, activeProject])
  useEffect(() => { document.title = `${REPO_NAME.replace(/-/g, " ")} · Design System` }, [])

  // ─── Quick-delete (owner only) ─────────────────────────────────────────────
  const [delConfirm, setDelConfirm] = useState<string | null>(null) // name pending confirm
  const [delBusy, setDelBusy] = useState(false)
  const [delToast, setDelToast] = useState<{ msg: string; ok: boolean } | null>(null)
  const isOwner = !!(session && session.canPush)

  const quickDelete = async (name: string) => {
    if (delConfirm !== name) { setDelConfirm(name); return }
    let pat = ""
    try { pat = localStorage.getItem(ADMIN_PAT_KEY) || "" } catch {}
    if (!pat) { setDelToast({ msg: "Token não encontrado — entre via Admin primeiro.", ok: false }); setDelConfirm(null); return }
    setDelBusy(true); setDelToast(null)
    try {
      const url = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/public/curation.json`
      const hdrs = GH_HEADERS(pat)
      const r = await fetch(url, { headers: hdrs })
      let sha: string | undefined
      let cur: any = { components: {} }
      if (r.status !== 404) {
        if (!r.ok) throw new Error("HTTP " + r.status)
        const j = await r.json()
        sha = j.sha
        try { cur = JSON.parse(decodeURIComponent(escape(atob(String(j.content || "").replace(/\n/g, ""))))) || {} } catch { cur = {} }
      }
      if (!cur.components) cur.components = {}
      cur.components[name] = { ...(cur.components[name] || {}), deleted: true }
      cur.$schema = "ds-studio/curation@1"
      cur.updatedAt = new Date().toISOString()
      cur.updatedBy = "quick-delete"
      const body: any = { message: `curation: delete ${name} via DS Studio`, content: btoa(unescape(encodeURIComponent(JSON.stringify(cur, null, 2)))) }
      if (sha) body.sha = sha
      const w = await fetch(url, { method: "PUT", headers: { ...hdrs, "Content-Type": "application/json" }, body: JSON.stringify(body) })
      if (!w.ok) throw new Error("HTTP " + w.status)
      // Optimistic: remove from UI immediately (CDN still serves old file)
      setQuickDeleted(s => new Set([...s, name]))
      setDelToast({ msg: `"${name}" excluído — restaure pelo Admin se precisar.`, ok: true })
      // Log to activity feed
      appendActivityLog({ type: "delete", component: name, user: session?.login || "owner", timestamp: new Date().toISOString(), summary: `${name} excluído via quick-delete` }).catch(() => {})
      refreshCuration()
      // If we're viewing the deleted component, go to overview
      if (route.kind === "component" && route.name === name) setRoute({ kind: "overview" })
    } catch (e: any) {
      console.error("quick-delete failed:", e)
      setDelToast({ msg: "Falha ao excluir: " + (e?.message || e), ok: false })
    }
    finally { setDelBusy(false); setDelConfirm(null) }
  }
  // Click anywhere else cancels the confirm state
  useEffect(() => {
    if (!delConfirm) return
    const h = () => setDelConfirm(null)
    const t = setTimeout(() => document.addEventListener("click", h, { once: true }), 80)
    return () => { clearTimeout(t); document.removeEventListener("click", h) }
  }, [delConfirm])
  // Auto-dismiss toast
  useEffect(() => {
    if (!delToast) return
    const t = setTimeout(() => setDelToast(null), 4500)
    return () => clearTimeout(t)
  }, [delToast])

  const cats = useMemo(() => {
    const m: Record<string, RegistryEntry[]> = {}
    curated.forEach(c => { (m[c.category || "Components"] ||= []).push(c) })
    return m
  }, [curated])

  const filtered = useMemo(() => {
    if (!query.trim()) return cats
    const q = query.toLowerCase()
    const m: Record<string, RegistryEntry[]> = {}
    for (const [cat, items] of Object.entries(cats)) {
      const f = items.filter(c => c.displayName.toLowerCase().includes(q) || c.name.toLowerCase().includes(q) || cat.toLowerCase().includes(q))
      if (f.length) m[cat] = f
    }
    return m
  }, [cats, query])

  // Biblioteca agrupada por camada atômica → categoria → componentes
  const layerGroups = useMemo(() => {
    const g: Partial<Record<NavGroup, Record<string, RegistryEntry[]>>> = {}
    Object.entries(filtered).forEach(([cat, items]) => {
      (items as RegistryEntry[]).forEach(c => {
        const L = layerOf(c)
        ;(((g[L] ||= {}) as Record<string, RegistryEntry[]>)[cat] ||= []).push(c)
      })
    })
    return g
  }, [filtered])

  const active = route.kind === "component" ? curated.find(c => c.name === route.name || slugify(c.name) === route.name || slugify(c.displayName) === route.name) : null
  const openComp = (name: string) => { setRoute({ kind: "component", name, tab: "canvas" }); setTab("canvas") }
  const activeLayer: NavGroup | null = active ? layerOf(active) : null
  const varsMap = useVariablesMap()
  const fndCount = useMemo(() => {
    const f = aggregateTokens(curated, varsMap)
    return f.colors.length + f.spacing.length + f.radius.length + f.stroke.length
  }, [curated, varsMap])
  const stylesOpen = openLayers["styles"] !== undefined ? openLayers["styles"] : route.kind === "foundations"
  const layerIsOpen = (k: string, isFirst: boolean) => query.trim() ? true : (openLayers[k] !== undefined ? openLayers[k] : (activeLayer ? k === activeLayer : isFirst))
  const toggleLayer = (k: string, isFirst: boolean) => persistLayers({ ...openLayers, [k]: !layerIsOpen(k, isFirst) })
  const openLayerExpand = (k: string) => { persistCollapsed(false); persistLayers({ ...openLayers, [k]: true }) }

  const navBtn = (icon: string, label: string, r: Route, on: boolean, badge?: number) => (
    <button key={label} className="dss-navitem dss-btn" title={navCollapsed ? label : undefined} onClick={() => setRoute(r)}
      style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: navCollapsed ? "center" : "flex-start", gap: 10, width: "100%", padding: navCollapsed ? "11px 0" : "11px 14px", borderRadius: 14, border: "none", background: on ? "var(--surface)" : "transparent", color: on ? "var(--ink)" : "var(--ink-muted)", fontSize: 14, fontWeight: on ? 600 : 500, cursor: "pointer", fontFamily: "var(--font-sans)", textAlign: "left", boxShadow: on ? "var(--shadow-md)" : "none" }}>
      {on && <span style={{ position: "absolute", left: 0, top: 9, bottom: 9, width: 3, borderRadius: 999, background: "var(--accent)" }} />}
      <Icon d={icon} size={16} />{!navCollapsed && label}
      {badge ? <span style={{ position: "absolute", top: navCollapsed ? 7 : "50%", right: navCollapsed ? 7 : 12, transform: navCollapsed ? "none" : "translateY(-50%)", minWidth: navCollapsed ? 8 : 18, height: navCollapsed ? 8 : 18, padding: navCollapsed ? 0 : "0 5px", borderRadius: 999, background: "var(--accent)", color: "#fff", fontSize: 10.5, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", lineHeight: 1 }}>{navCollapsed ? "" : badge}</span> : null}
    </button>
  )

  // ─── Gate de acesso (visibility != public) — antes de qualquer conteúdo ───
  if (!access.loaded) {
    return (<><style>{THEME_CSS}</style><div style={{ minHeight: "100vh", background: "var(--canvas)" }} /></>)
  }
  if (sessionLoading) {
    return (<><style>{THEME_CSS}</style><FontLoader /><div style={{ minHeight: "100vh", background: "var(--canvas)" }} /></>)
  }
  if (route.kind === "invite") {
    // Aceite de convite — funciona logado (aceita direto) e deslogado (entra → vincula).
    return (
      <ThemeCtx.Provider value={{ theme, toggle: () => setTheme(t => t === "light" ? "dark" : "light") }}>
        <style>{THEME_CSS}</style>
        <FontLoader />
        <div className="dss-root" style={{ minHeight: "100vh", background: "var(--canvas)", fontFamily: "var(--font-sans)" }}>
          <InvitePage token={route.token} session={session} refreshSession={refreshSession} onOpenProject={openProject} onHome={() => setRoute({ kind: "projects" })} />
        </div>
      </ThemeCtx.Provider>
    )
  }
  if (route.kind === "reset") {
    // Redefinição de senha (link do e-mail). O token vem no hash; funciona deslogado.
    return (
      <ThemeCtx.Provider value={{ theme, toggle: () => setTheme(t => t === "light" ? "dark" : "light") }}>
        <style>{THEME_CSS}</style>
        <FontLoader />
        <div className="dss-root" style={{ minHeight: "100vh", background: "var(--canvas)", fontFamily: "var(--font-sans)" }}>
          <ResetPasswordPage onDone={() => { refreshSession(); setRoute({ kind: "projects" }) }} onBackToLogin={() => setRoute({ kind: "login" })} />
        </div>
      </ThemeCtx.Provider>
    )
  }
  const isProjURL = !!activeProject && !!activeProject.supabase
  // Acesso público read-only: /p/{id} sem sessão, projeto marcado como público.
  const publicMode = IS_INSTANCE || (!session && isProjURL && route.kind !== "login" && publicVis === "public")

  if (!session && !publicMode) {
    // Enquanto resolvemos a visibilidade de um /p/{id}, mostra um splash neutro (evita flash do login).
    const deciding = isProjURL && route.kind !== "login" && (publicVis === null || publicVis === "loading")
    // /login OU projeto privado → tela de auth. Caso contrário → landing pública.
    const showAuth = route.kind === "login" || isProjURL
    return (
      <ThemeCtx.Provider value={{ theme, toggle: () => setTheme(t => t === "light" ? "dark" : "light") }}>
        <style>{THEME_CSS}</style>
        <FontLoader />
        <div className="dss-root" style={{ minHeight: "100vh", background: "var(--canvas)", fontFamily: "var(--font-sans)" }}>
          {deciding
            ? <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--ink-muted)", fontSize: 13.5, fontFamily: "var(--font-sans)" }}>Carregando…</div>
            : showAuth
              ? <AuthPage initialMode={route.kind === "login" ? route.mode : undefined} onDone={() => { refreshSession(); setRoute({ kind: "projects" }) }} />
              : <LandingPage onAuth={(mode) => setRoute({ kind: "login", mode })} />}
        </div>
      </ThemeCtx.Provider>
    )
  }
  if (!publicMode && access.policy?.visibility && access.policy.visibility !== "public" && !unlocked) {
    return (<>
      <style>{THEME_CSS}</style>
      <FontLoader />
      <AccessGate policy={access.policy} onUnlock={() => { try { sessionStorage.setItem("dss-access-ok", "1") } catch {}; setUnlocked(true) }} />
    </>)
  }

  // ─── Hub (telas iniciais) — projetos + administração, chrome próprio (sem a sidebar do app) ───
  if (route.kind === "projects") {
    return (
      <ThemeCtx.Provider value={{ theme, toggle: () => setTheme(t => t === "light" ? "dark" : "light") }}>
        <style>{THEME_CSS}</style>
        <FontLoader />
        <div className="dss-root" style={{ minHeight: "100vh", background: "var(--canvas)", fontFamily: "var(--font-sans)" }}>
          <header style={{ position: "sticky", top: 0, zIndex: 20, background: "var(--surface)", borderBottom: "1px solid var(--hairline)", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 30px", gap: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
              <div style={{ width: 34, height: 34, borderRadius: 12, background: "linear-gradient(145deg, #6f6f72, #2b2b2e)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "var(--shadow-md)" }}>
                <svg width="19" height="19" viewBox="0 0 24 24" fill="none"><path d="M12 2 21 7v10l-9 5-9-5V7z" stroke="#fff" strokeWidth="1.4" opacity="0.92" /></svg>
              </div>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: "-0.03em" }}>ds<span style={{ opacity: .35 }}> studio</span></div>
                <div className="dss-mono" style={{ fontSize: 10, color: "var(--ink-subtle)", marginTop: 2, letterSpacing: ".04em" }}>plataforma</div>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <button className="dss-btn" title="Tema" onClick={() => setTheme(t => t === "light" ? "dark" : "light")} style={{ background: "none", border: "1px solid var(--hairline-strong)", borderRadius: 999, width: 38, height: 38, cursor: "pointer", color: "var(--ink-muted)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Icon d={theme === "light" ? ICONS.moon : ICONS.sun} size={16} />
              </button>
              {session ? <UserMenu session={session} theme={theme} onToggleTheme={() => setTheme(t => t === "light" ? "dark" : "light")} isPlatformAdmin={!!session.isAdmin} canConsole={caps.platform} onConsole={() => setRoute({ kind: "platform" })} activeConsole={route.kind === "platform"} onSignOut={() => { signOut(); goHub() }} /> : (IS_INSTANCE ? null :
                <button className="dss-btn" onClick={() => setRoute({ kind: "login" })} style={{ background: "var(--primary)", color: "var(--on-primary)", border: "none", borderRadius: 999, padding: "0 18px", height: 38, cursor: "pointer", fontSize: 13, fontWeight: 600, fontFamily: "var(--font-sans)" }}>Entrar</button>
              )}
            </div>
          </header>
          <ProjectsPage session={session} onOpenCurrent={openInstance} onOpenProject={openProject} />
        </div>
      </ThemeCtx.Provider>
    )
  }

  // ─── Console da plataforma — escopo próprio, decoupled da sidebar do projeto ───
  if (route.kind === "platform") {
    return (
      <ThemeCtx.Provider value={{ theme, toggle: () => setTheme(t => t === "light" ? "dark" : "light") }}>
        <style>{THEME_CSS}</style>
        <FontLoader />
        <div className="dss-root" style={{ display: "flex", minHeight: "100vh", background: "var(--canvas)", fontFamily: "var(--font-sans)" }}>
          <AppSidebar collapsed={navCollapsed} onToggleCollapse={() => persistCollapsed(!navCollapsed)} scope={<ScopeSwitcher mode="console" collapsed={navCollapsed} token={session?.accessToken} activeProjectId={activeProject?.id} onHub={goHub} onOpenProject={openProject} />}>
            {!navCollapsed && <div className="dss-mono" style={{ fontSize: 9.5, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--ink-subtle)", padding: "2px 26px 6px" }}>Plataforma</div>}
            <nav style={{ padding: navCollapsed ? "0 8px 8px" : "0 12px 8px", display: "flex", flexDirection: "column", gap: 2 }}>
              {navBtn("M3 21h18|M5 21V7l7-4 7 4v14|M9 21v-6h6v6", "Visão geral", { kind: "platform" }, !route.section || route.section === "overview")}
              {navBtn("M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z", "Projetos", { kind: "platform", section: "projects" }, route.section === "projects")}
              {navBtn("M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2|M9 11a4 4 0 100-8 4 4 0 000 8z|M22 21v-2a4 4 0 00-3-3.9", "Usuários", { kind: "platform", section: "users" }, route.section === "users", pendingReqs)}
              {navBtn("M3 3v18h18|M7 15l3-3 3 2 4-5", "Uso e custos", { kind: "platform", section: "usage" }, route.section === "usage")}
              {navBtn("M4 21v-7|M4 10V3|M12 21v-9|M12 8V3|M20 21v-5|M20 12V3|M1 14h6|M9 8h6|M17 16h6", "Módulos", { kind: "platform", section: "modules" }, route.section === "modules")}
            </nav>
          </AppSidebar>
          <main style={{ flex: 1, minWidth: 0, height: "100vh", display: "flex", flexDirection: "column", background: "var(--canvas)", overflow: "hidden" }}>
            <header style={{ flexShrink: 0, background: "var(--surface)", borderBottom: "1px solid var(--hairline)", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 30px", gap: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12.5 }}>
                <span style={{ color: "var(--ink)", fontWeight: 700 }}>Plataforma</span>
                {route.section && route.section !== "overview" && <><span style={{ color: "var(--ink-subtle)" }}>›</span><span style={{ color: "var(--ink-muted)" }}>{route.section === "modules" ? "Módulos" : route.section === "projects" ? "Projetos" : route.section === "users" ? "Usuários" : route.section === "usage" ? "Uso e custos" : ""}</span></>}
                <span style={{ marginLeft: 8, display: "inline-flex", alignItems: "center", fontSize: 10.5, fontWeight: 700, padding: "3px 9px", borderRadius: 999, background: "var(--ink)", color: "#fff", letterSpacing: ".02em" }}>admin</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <button className="dss-btn" title="Alternar tema" onClick={() => setTheme(t => t === "light" ? "dark" : "light")} style={{ width: 38, height: 38, borderRadius: 999, border: "1px solid var(--hairline-strong)", background: "transparent", color: "var(--ink-muted)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><Icon d={theme === "light" ? ICONS.moon : ICONS.sun} size={16} /></button>
                {session && <UserMenu session={session} theme={theme} onToggleTheme={() => setTheme(t => t === "light" ? "dark" : "light")} isPlatformAdmin={!!session.isAdmin} canConsole={caps.platform} onConsole={() => setRoute({ kind: "platform" })} activeConsole={route.kind === "platform"} onSignOut={() => { signOut(); goHub() }} />}
              </div>
            </header>
            <div className="dss-scroll" style={{ flex: 1, minWidth: 0, overflowY: "auto" }}>
              {!caps.platform
                ? <div className="dss-fade" style={{ padding: 60, textAlign: "center", color: "var(--ink-muted)" }}>Você não tem acesso ao Console da plataforma.</div>
                : route.section === "modules"
                  ? <ModulesPanel token={session?.accessToken} />
                  : (session ? <SuperAdminPage session={session} section={route.section && route.section !== "modules" ? route.section : "overview"} /> : null)}
            </div>
          </main>
        </div>
      </ThemeCtx.Provider>
    )
  }

  return (
    <ThemeCtx.Provider value={{ theme, toggle: () => setTheme(t => t === "light" ? "dark" : "light") }}>
      <style>{THEME_CSS}</style>
      <FontLoader />
      <div className="dss-root" style={{ display: "flex", minHeight: "100vh", background: "var(--canvas)", fontFamily: "var(--font-sans)" }}>
        {/* Sidebar */}
        <AppSidebar collapsed={navCollapsed} onToggleCollapse={() => persistCollapsed(!navCollapsed)} scope={<ScopeSwitcher mode="project" projectName={activeProject ? activeProject.name : undefined} subtitle={`${curated.length} componentes`} collapsed={navCollapsed} token={session?.accessToken} activeProjectId={activeProject?.id} onHub={goHub} onOpenProject={openProject} />}>

          {!navCollapsed && <div className="dss-mono" style={{ fontSize: 9.5, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--ink-subtle)", padding: "2px 26px 6px" }}>Menu</div>}
          <nav style={{ padding: navCollapsed ? "0 8px 8px" : "0 12px 8px", display: "flex", flexDirection: "column", gap: 2 }}>
            {navBtn(ICONS.grid, "Overview", { kind: "overview" }, route.kind === "overview")}
            {activeProject && activeProject.supabase && <ModuleGate module="builder" modules={session?.modules}>{navBtn(ICONS.sliders || ICONS.layers, "Builder", { kind: "builder" }, route.kind === "builder")}</ModuleGate>}
            <ModuleGate module="insights" modules={session?.modules}>{navBtn(ICONS.chart, "Insights", { kind: "insights" }, route.kind === "insights")}</ModuleGate>
            <ModuleGate module="activity_log" modules={session?.modules}>{navBtn("M12 8v4l3 3|M12 2a10 10 0 100 20 10 10 0 000-20z", "Atividade", { kind: "activity" }, route.kind === "activity")}</ModuleGate>
          </nav>

          {caps.manage && (
            <nav style={{ padding: navCollapsed ? "0 8px 8px" : "0 12px 8px", display: "flex", flexDirection: "column", gap: 2 }}>
              {navBtn("M12 8a4 4 0 100 8 4 4 0 000-8z|M12 2v3|M12 19v3|M2 12h3|M19 12h3|M4.9 4.9l2.1 2.1|M17 17l2.1 2.1|M19.1 4.9L17 7|M7 17l-2.1 2.1", "Configurações", { kind: "admin" }, route.kind === "admin")}
            </nav>
          )}

          <div style={{ padding: navCollapsed ? "8px 8px" : "8px 12px", borderTop: "1px solid var(--hairline)", marginTop: 4 }}>
            {!navCollapsed && <div className="dss-mono" style={{ fontSize: 9.5, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--ink-subtle)", padding: "4px 14px 8px" }}>Biblioteca</div>}
            <nav style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              {navBtn(ICONS.layers, "Foundations", { kind: "foundations" }, route.kind === "foundations")}
              {navBtn("M21 8l-9-5-9 5v8l9 5 9-5z|M3 8l9 5 9-5|M12 13v8", "Componentes", { kind: "components" }, route.kind === "components")}
              {/* Lista de componentes agrupada por grupo funcional (acordeões) — reconecta layerGroups/toggleLayer */}
              {!navCollapsed && (() => {
                const visibleLayers = LAYER_ORDER.filter(L => layerGroups[L] && Object.keys(layerGroups[L] as object).length > 0)
                if (visibleLayers.length === 0) return null
                return visibleLayers.map((L, i) => {
                  const comps = Object.values(layerGroups[L] as Record<string, RegistryEntry[]>).flat()
                  const open = layerIsOpen(L, i === 0)
                  return (
                    <div key={L} style={{ display: "flex", flexDirection: "column" }}>
                      <button className="dss-navitem dss-btn" onClick={() => toggleLayer(L, i === 0)}
                        style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "8px 14px", border: "none", borderRadius: 12, background: "transparent", color: "var(--ink-muted)", fontSize: 12.5, fontWeight: 600, cursor: "pointer", fontFamily: "var(--font-sans)", textAlign: "left" }}>
                        <span style={{ display: "flex", transition: "transform .16s", transform: open ? "rotate(90deg)" : "none", color: "var(--ink-subtle)" }}><Icon d="M9 6l6 6-6 6" size={13} /></span>
                        <Icon d={LAYER_META[L].icon} size={14} />
                        <span style={{ flex: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{LAYER_META[L].label}</span>
                        <span className="dss-mono" style={{ fontSize: 10, color: "var(--ink-subtle)" }}>{comps.length}</span>
                      </button>
                      {open && comps.map(c => {
                        const on = !!active && active.name === c.name
                        return (
                          <button key={c.name} className="dss-navitem dss-btn" onClick={() => openComp(c.name)} title={c.displayName}
                            style={{ position: "relative", display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "8px 14px 8px 34px", border: "none", borderRadius: 12, background: on ? "var(--surface)" : "transparent", color: on ? "var(--ink)" : "var(--ink-muted)", fontSize: 13, fontWeight: on ? 600 : 500, cursor: "pointer", fontFamily: "var(--font-sans)", textAlign: "left", boxShadow: on ? "var(--shadow-md)" : "none" }}>
                            {on && <span style={{ position: "absolute", left: 14, top: 9, bottom: 9, width: 3, borderRadius: 999, background: "var(--accent)" }} />}
                            <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.displayName}</span>
                          </button>
                        )
                      })}
                    </div>
                  )
                })
              })()}
            </nav>
          </div>

        </AppSidebar>

        {/* Main */}
        <main style={{ flex: 1, minWidth: 0, height: "100vh", display: "flex", flexDirection: "column", background: "var(--canvas)", overflow: "hidden" }}>
          <header style={{ flexShrink: 0, background: "var(--surface)", borderBottom: "1px solid var(--hairline)", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 30px", gap: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12.5, minWidth: 0 }}>
              <button className="dss-btn" onClick={goHub} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--ink-subtle)", padding: 0, fontFamily: "var(--font-sans)", fontSize: 12.5 }}>Projetos</button>
              <span style={{ color: "var(--ink-subtle)" }}>›</span>
              <button className="dss-btn" onClick={() => setRoute({ kind: "overview" })} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--ink)", fontWeight: 700, padding: 0, fontFamily: "var(--font-sans)", fontSize: 12.5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 220 }}>{projName}</button>
              {route.kind !== "overview" && (() => {
                const pageLabel = route.kind === "foundations" ? (route.section ? "Foundations · " + route.section : "Foundations")
                  : route.kind === "components" ? "Componentes"
                  : route.kind === "insights" ? "Insights"
                  : route.kind === "activity" ? "Atividade"
                  : route.kind === "admin" ? "Configurações"
                  : route.kind === "component" ? ((active && active.displayName) || (route as any).name)
                  : ""
                return pageLabel ? <><span style={{ color: "var(--ink-subtle)" }}>›</span><span style={{ color: "var(--ink-muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 220 }}>{pageLabel}</span></> : null
              })()}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
              {route.kind === "overview" && (
                <div style={{ display: "flex", alignItems: "center", gap: 9, background: "var(--surface-2)", border: "1px solid var(--hairline)", borderRadius: 999, padding: "8px 14px", width: 240, marginRight: 4 }}>
                  <span style={{ color: "var(--ink-subtle)", display: "flex" }}><Icon d={ICONS.search} size={15} /></span>
                  <input value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar componentes…" style={{ border: "none", outline: "none", background: "none", fontFamily: "var(--font-sans)", fontSize: 13, color: "var(--ink)", width: "100%" }} />
                </div>
              )}
              {activeProject && activeProject.supabase && (
                <button className="dss-btn" title={publicVis === "public" ? "Copiar link público do projeto" : "Copiar link do projeto (requer login enquanto o projeto for privado)"} onClick={copyPublicLink} style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 12.5, fontWeight: 600, color: linkCopied ? "var(--accent-ink)" : "var(--ink-muted)", background: linkCopied ? "var(--accent-soft)" : "transparent", border: "1px solid " + (linkCopied ? "var(--accent-soft)" : "var(--hairline-strong)"), borderRadius: 999, padding: "7px 13px", cursor: "pointer", fontFamily: "var(--font-sans)" }}><Icon d="M10 13a5 5 0 007.07 0l3-3a5 5 0 00-7.07-7.07l-1.72 1.71|M14 11a5 5 0 00-7.07 0l-3 3a5 5 0 007.07 7.07l1.71-1.71" size={14} />{linkCopied ? "Copiado!" : "Copiar link"}</button>
              )}
              <button className="dss-btn" title="DESIGN.md" onClick={() => setShowMd(true)} style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 12.5, fontWeight: 600, color: "var(--ink-muted)", background: "transparent", border: "1px solid var(--hairline-strong)", borderRadius: 999, padding: "7px 13px", cursor: "pointer", fontFamily: "var(--font-sans)" }}><Icon d={ICONS.download} size={14} />DESIGN.md</button>
              <button className="dss-btn" title="Alternar tema" onClick={() => setTheme(t => t === "light" ? "dark" : "light")} style={{ width: 38, height: 38, borderRadius: 999, border: "1px solid var(--hairline-strong)", background: "transparent", color: "var(--ink-muted)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><Icon d={theme === "light" ? ICONS.moon : ICONS.sun} size={16} /></button>
              {session ? <UserMenu session={session} theme={theme} onToggleTheme={() => setTheme(t => t === "light" ? "dark" : "light")} isPlatformAdmin={!!session.isAdmin} canConsole={caps.platform} onConsole={() => setRoute({ kind: "platform" })} activeConsole={route.kind === "platform"} onSignOut={() => { signOut(); goHub() }} /> : (IS_INSTANCE ? null :
                <button className="dss-btn" onClick={() => setRoute({ kind: "login" })} style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 12.5, fontWeight: 700, color: "#fff", background: "var(--ink)", border: "none", borderRadius: 999, padding: "8px 16px", cursor: "pointer", fontFamily: "var(--font-sans)" }}>Entrar</button>
              )}
            </div>
          </header>
          <div className="dss-scroll" style={{ flex: 1, minWidth: 0, overflowY: "auto" }}>
          {route.kind === "overview" && <OverviewPage registry={curated} onOpen={openComp} onFoundations={() => setRoute({ kind: "foundations" })} onExport={() => setShowMd(true)} q={q} setQ={setQ} tokenOverride={activeProject && activeProject.supabase && projStats ? projStats.tokenCount : undefined} onPublish={caps.deploy && activeProject && activeProject.supabase ? () => setShowPublish(true) : undefined} />}
          {route.kind === "components" && <ComponentsCatalogPage registry={curated} onOpen={openComp} />}
          {route.kind === "foundations" && <FoundationsPage registry={curated} varsMap={varsMap} tokensOverride={activeProject && activeProject.supabase ? (projTokens || undefined) : undefined} section={route.section} onSection={sl => setRoute({ kind: "foundations", section: sl })} onExport={() => setShowMd(true)} />}
          {route.kind === "builder" && <ModuleGate module="builder" modules={session?.modules} fallback={<div className="dss-fade" style={{ padding: 60, textAlign: "center", color: "var(--ink-muted)" }}>Módulo Builder não está ativo.</div>}><BuilderPage tokens={activeProject && activeProject.supabase ? (projTokens || undefined) : undefined} projectId={activeProject && activeProject.supabase ? activeProject.id : undefined} token={session?.accessToken} onSaved={() => setTokensRefresh(x => x + 1)} /></ModuleGate>}
          {route.kind === "insights" && <ModuleGate module="insights" modules={session?.modules} fallback={<div className="dss-fade" style={{ padding: 60, textAlign: "center", color: "var(--ink-muted)" }}>Módulo Insights não está ativo para este projeto.</div>}><InsightsPage registry={curated} /></ModuleGate>}
          {route.kind === "activity" && <ModuleGate module="activity_log" modules={session?.modules} fallback={<div className="dss-fade" style={{ padding: 60, textAlign: "center", color: "var(--ink-muted)" }}>Módulo de Atividade não está ativo para este projeto.</div>}><ActivityPage registry={curated} onOpen={openComp} /></ModuleGate>}
          {route.kind === "admin" && (caps.manage
            ? <AdminPage registry={withMeta(registry, metaData)} curation={curationData} onRefresh={refreshCuration} onOpen={openComp} tab={route.tab} onTab={(t) => setRoute({ kind: "admin", tab: t })} project={activeProject} token={session?.accessToken} />
            : <div className="dss-fade" style={{ padding: 60, textAlign: "center", color: "var(--ink-muted)" }}>Você não tem permissão para gerenciar este projeto.</div>)}
          {route.kind === "projects" && <ProjectsPage session={session} onOpenCurrent={openInstance} onOpenProject={openProject} />}
          {route.kind === "login" && <AuthPage onDone={() => { refreshSession(); setRoute({ kind: "projects" }) }} />}
          {route.kind === "component" && !active && activeProject && activeProject.supabase && projectReg === null && (
            <div className="dss-fade" style={{ padding: 60, textAlign: "center", color: "var(--ink-muted)", fontSize: 13.5 }}>Carregando projeto…</div>
          )}
          {route.kind === "component" && !active && !(activeProject && activeProject.supabase && projectReg === null) && (
            <div className="dss-fade" style={{ padding: "60px 30px", display: "flex", justifyContent: "center" }}>
              <div style={{ ...PANEL, padding: 36, maxWidth: 440, textAlign: "center" }}>
                <div style={{ fontSize: 19, fontWeight: 700, letterSpacing: "-0.02em", marginBottom: 8 }}>Componente não encontrado</div>
                <p style={{ fontSize: 13.5, color: "var(--ink-muted)", lineHeight: 1.6, marginTop: 0 }}>O endereço não corresponde a nenhum componente publicado — ele pode ter sido renomeado ou ocultado pela curadoria.</p>
                <div style={{ marginTop: 16 }}><GhostPillBtn onClick={() => setRoute({ kind: activeProject ? "overview" : "projects" })}>{activeProject ? "Voltar ao Overview" : "Voltar aos projetos"}</GhostPillBtn></div>
              </div>
            </div>
          )}
          {route.kind === "component" && active && !(active as any).__supa && (
            <div>
              <div style={{ position: "sticky", top: 0, zIndex: 10, background: "var(--canvas)", borderBottom: "1px solid var(--hairline)", padding: "20px 32px 16px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", flex: "1 1 auto", minWidth: 0 }}>
                  <h1 className="dss-display" style={{ fontSize: 28, fontWeight: 800, margin: 0, letterSpacing: "-0.03em" }}>{active.displayName}</h1>
                  <Pill variant={(active as any).__status ?? "stable"} />
                  <span className="dss-mono" style={{ fontSize: 11, background: "var(--surface-2)", color: "var(--ink-muted)", padding: "4px 10px", borderRadius: 999 }}>v{active.version}</span>
                  {active.width && active.height && <span className="dss-mono" style={{ fontSize: 11, color: "var(--ink-subtle)" }}>{active.width}×{active.height}px</span>}
                  <span className="dss-mono" style={{ fontSize: 11, color: "var(--ink-subtle)", marginLeft: "auto" }}>{active.category}</span>
                  {isOwner && (() => {
                    const confirming = delConfirm === active.name
                    return (
                      <button className="dss-btn" title={confirming ? "Clique para confirmar" : "Excluir componente"}
                        onClick={e => { e.stopPropagation(); quickDelete(active.name) }}
                        style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 14px", borderRadius: 999, border: "1px solid " + (confirming ? "var(--err)" : "var(--hairline)"), background: confirming ? "var(--err)" : "var(--surface)", color: confirming ? "#fff" : "var(--ink-subtle)", fontSize: 12, fontWeight: 600, fontFamily: "var(--font-sans)", flexShrink: 0 }}>
                        {delBusy && confirming
                          ? <span style={{ width: 12, height: 12, border: "2px solid #fff", borderTopColor: "transparent", borderRadius: "50%", animation: "dss-spin .6s linear infinite" }} />
                          : <Icon d={ICONS.trash} size={13} stroke={1.8} />}
                        {confirming ? "Confirmar exclusão" : "Excluir"}
                      </button>
                    )
                  })()}
                </div>
          <div className="dss-scroll" style={{ display: "inline-flex", gap: 2, marginLeft: "auto", flexShrink: 0, background: "var(--surface-2)", borderRadius: 999, padding: 4, maxWidth: "100%", overflowX: "auto" }}>
                  {TABS.map(t => {
                    const on = tab === t.id
                    return (
                      <button key={t.id} className="dss-btn" onClick={() => { setTab(t.id); setRoute(r => r.kind === "component" ? { ...r, tab: t.id } : r) }}
                        style={{ padding: "8px 15px", fontSize: 13, fontWeight: on ? 600 : 500, color: on ? "var(--ink)" : "var(--ink-muted)", background: on ? "var(--surface)" : "transparent", boxShadow: on ? "var(--shadow-sm)" : "none", border: "none", borderRadius: 999, cursor: "pointer", whiteSpace: "nowrap", fontFamily: "var(--font-sans)" }}>{t.label}</button>
                    )
                  })}
                </div>
        </div>
              </div>
              <div>
                {tab === "canvas" && <CanvasTab entry={active} />}
                {tab === "preview" && <PreviewTab entry={active} />}
                {tab === "compare" && <CompareTab entry={active} />}
                {tab === "code" && <CodeTab entry={active} />}
                {tab === "specs" && <SpecsTab entry={active} />}
                {tab === "history" && <HistoryTab entry={active} />}
                {(tab === "a11y" || tab === "do-donts" || tab === "use-cases") && <AiDocsSection entry={active} tab={tab} />}
              </div>
            </div>
          )}
          {route.kind === "component" && active && (active as any).__supa && (
            <SupaComponentDetail id={(active as any).__supaId} token={session ? session.accessToken : undefined} fallback={{ displayName: active.displayName, version: active.version, category: active.category, interactive: isInteractive(active) }} tab={tab} onTab={(t) => { setTab(t); setRoute(r => r.kind === "component" ? { ...r, tab: t } : r) }} />
          )}
          </div>
        </main>
      </div>
      {showMd && <DesignMdModal registry={curated} onClose={() => setShowMd(false)} />}
      {showPublish && activeProject && activeProject.supabase && (
        <PublishModal
          project={activeProject}
          token={session ? session.accessToken : undefined}
          components={(curated || []).filter((c: any) => c.__supaId).map((c: any) => ({ id: c.__supaId, name: c.name, display_name: c.displayName }))}
          onClose={() => setShowPublish(false)}
        />
      )}
      {delToast && (
        <div className="dss-fade" style={{ position: "fixed", bottom: 28, left: "50%", transform: "translateX(-50%)", zIndex: 9999, background: delToast.ok ? "var(--ink)" : "var(--err)", color: "#fff", padding: "12px 22px", borderRadius: 14, fontSize: 13, fontWeight: 500, fontFamily: "var(--font-sans)", boxShadow: "var(--shadow-lg)", display: "flex", alignItems: "center", gap: 10, maxWidth: 440 }}>
          <Icon d={delToast.ok ? "M20 6L9 17l-5-5" : "M18 6L6 18|M6 6l12 12"} size={16} stroke={2.2} />
          {delToast.msg}
          <button className="dss-btn" onClick={() => setDelToast(null)} style={{ background: "rgba(255,255,255,.15)", border: "none", borderRadius: 8, color: "#fff", padding: "4px 10px", fontSize: 11, fontWeight: 600, marginLeft: 4, flexShrink: 0 }}>OK</button>
        </div>
      )}
    </ThemeCtx.Provider>
  )
}
