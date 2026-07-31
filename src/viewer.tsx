// ═══════════════════════════════════════════════════════════════════════════
// DS Studio — Viewer (site publicado do design system do cliente)
// APP AUTÔNOMO. Não contém nada da plataforma DS Studio (hub/deploy/auth/geração).
// Só renderiza os componentes que existem NESTE repositório, a partir do registry
// estático gerado no src/App.tsx. Estilo: Storybook + linguagem visual bento.
// ═══════════════════════════════════════════════════════════════════════════
import React, { useState, useEffect, useMemo, createContext } from "react"

type Variant = { name: string; props: Record<string, unknown> }
type TokenEntry = { name: string; value: unknown; aliasOf?: string }
type RegistryEntry = {
  name: string; displayName: string; category: string; version: string
  variants: Variant[]; width?: number; height?: number
  tokens?: TokenEntry[]; source?: string; publishedAt?: string
  Component: React.ComponentType<Record<string, unknown>>
}
type Project = { name?: string; owner?: string; repo?: string }
type Theme = "light" | "dark"
const ThemeCtx = createContext<{ theme: Theme; toggle: () => void }>({ theme: "light", toggle: () => {} })

const THEME_CSS = `
:root {
  --backdrop:#E4E4E1; --canvas:#F2F2F0; --surface:#FFFFFF; --surface-2:#F7F7F5; --surface-3:#EFEFEC;
  --ink:#1A1A1C; --ink-muted:#6E6E70; --ink-subtle:#9B9B9D;
  --hairline:#ECECEA; --hairline-strong:#E2E2DF;
  --accent:#1FA463; --accent-ink:#178551; --accent-soft:#E7F7EE; --on-accent:#FFFFFF;
  --primary:#1A1A1C; --on-primary:#FFFFFF;
  --ok:#1FA463; --ok-soft:#E7F7EE; --warn:#B7791F; --warn-soft:#FFF4E5; --err:#E5484D; --err-soft:#FDECEC;
  --shadow-sm:0 1px 2px rgba(20,20,22,.04),0 2px 6px rgba(20,20,22,.04);
  --shadow-md:0 1px 3px rgba(20,20,22,.05),0 10px 30px -12px rgba(20,20,22,.12);
  --shadow-lg:0 1px 3px rgba(20,20,22,.06),0 18px 40px -14px rgba(20,20,22,.16);
  --font-display:'Plus Jakarta Sans',-apple-system,BlinkMacSystemFont,sans-serif;
  --font-sans:'Plus Jakarta Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
  --font-mono:ui-monospace,'SF Mono','JetBrains Mono',Menlo,monospace;
}
[data-theme="dark"] {
  --backdrop:#101012; --canvas:#161618; --surface:#1F1F22; --surface-2:#26262A; --surface-3:#2E2E33;
  --ink:#F2F2F0; --ink-muted:#A0A0A2; --ink-subtle:#6E6E70;
  --hairline:#2A2A2E; --hairline-strong:#3A3A3F;
  --accent:#3DD68C; --accent-ink:#5FE3A3; --accent-soft:rgba(31,164,99,.18); --on-accent:#0A0A0B;
  --primary:#F2F2F0; --on-primary:#161618;
  --ok:#3DD68C; --ok-soft:rgba(31,164,99,.16); --warn:#E0A042; --warn-soft:rgba(224,160,66,.14); --err:#F8787C; --err-soft:rgba(229,72,77,.16);
  --shadow-sm:0 1px 2px rgba(0,0,0,.5);
  --shadow-md:0 10px 30px -10px rgba(0,0,0,.6);
  --shadow-lg:0 26px 60px -18px rgba(0,0,0,.7);
}
* { box-sizing:border-box; }
.dss-root { font-family:var(--font-sans); color:var(--ink); background:var(--canvas); }
.dss-root ::selection { background:var(--accent); color:#fff; }
.dss-display { font-family:var(--font-display); }
.dss-mono { font-family:var(--font-mono); }
.dss-scroll::-webkit-scrollbar { width:6px; height:6px; }
.dss-scroll::-webkit-scrollbar-thumb { background:var(--hairline-strong); border-radius:3px; }
.dss-scroll::-webkit-scrollbar-track { background:transparent; }
@keyframes dss-fade { from { opacity:0; transform:translateY(6px); } to { opacity:1; transform:none; } }
.dss-fade { animation:dss-fade .22s cubic-bezier(.16,1,.3,1) both; }
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
  }, [])
  return null
}

function Icon({ d, size = 16, stroke = 1.6 }: { d: string; size?: number; stroke?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round">{d.split("|").map((p, i) => <path key={i} d={p} />)}</svg>
}
const IC = {
  search: "M11 19a8 8 0 100-16 8 8 0 000 16z|M21 21l-4.3-4.3",
  moon: "M21 12.8A9 9 0 1111.2 3 7 7 0 0021 12.8z",
  sun: "M12 17a5 5 0 100-10 5 5 0 000 10z|M12 1v2|M12 21v2|M4.2 4.2l1.4 1.4|M18.4 18.4l1.4 1.4|M1 12h2|M21 12h2|M4.2 19.8l1.4-1.4|M18.4 5.6l1.4-1.4",
  layers: "M12 2 2 7l10 5 10-5-10-5z|M2 17l10 5 10-5|M2 12l10 5 10-5",
  book: "M4 19.5A2.5 2.5 0 016.5 17H20|M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z",
  play: "M5 3l14 9-14 9V3z",
  grid: "M3 3h8v8H3z|M13 3h8v8h-8z|M3 13h8v8H3z|M13 13h8v8h-8z",
  chevron: "M9 18l6-6-6-6",
}

function isInteractive(entry: RegistryEntry): boolean {
  const s = entry.source || ""
  return /role=["'](switch|checkbox|radio|tab)["']/.test(s) || (/useState/.test(s) && /aria-checked|aria-expanded|aria-selected/.test(s))
}
function heroProps(entry: RegistryEntry, props: Record<string, unknown>): Record<string, unknown> {
  if (!isInteractive(entry)) return props
  const out: Record<string, unknown> = { ...props }
  if ("checked" in out && !("defaultChecked" in out)) { out.defaultChecked = out.checked; delete out.checked }
  return out
}

class DSVariantBoundary extends React.Component<{ children: React.ReactNode }, { err: boolean }> {
  constructor(p: { children: React.ReactNode }) { super(p); this.state = { err: false } }
  static getDerivedStateFromError() { return { err: true } }
  componentDidCatch() {}
  render() { return this.state.err ? <span style={{ fontSize: 11, color: "var(--ink-subtle)", fontFamily: "var(--font-mono)" }}>erro ao renderizar</span> : (this.props.children as any) }
}

function propsLabel(props: Record<string, unknown>): string {
  const ks = Object.keys(props || {})
  if (!ks.length) return "Default"
  return ks.map(k => k + "=" + String((props as any)[k])).join(" · ")
}
function propAxes(entry: RegistryEntry): { name: string; values: string[] }[] {
  const m: Record<string, Set<string>> = {}
  for (const v of (entry.variants || [])) for (const [k, val] of Object.entries(v.props || {})) { (m[k] ||= new Set()); if (val != null) m[k].add(String(val)) }
  return Object.entries(m).map(([name, vs]) => ({ name, values: Array.from(vs) }))
}
function isColor(v: unknown): boolean { return typeof v === "string" && /^(#|rgb|hsl)/i.test(v.trim()) }

function PreviewCell({ entry, v }: { entry: RegistryEntry; v: Variant }) {
  const C = entry.Component
  return (
    <div style={{ border: "1px solid var(--hairline)", borderRadius: 12, overflow: "hidden", background: "var(--surface)", display: "flex", flexDirection: "column" }}>
      <div style={{ padding: 22, background: "var(--surface-2)", flex: 1, display: "flex", alignItems: "center", justifyContent: "center", minHeight: 132, overflow: "hidden" }}>
        <DSVariantBoundary><C {...heroProps(entry, v.props || {})} /></DSVariantBoundary>
      </div>
      <div style={{ padding: "10px 13px", borderTop: "1px solid var(--hairline)" }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: "var(--ink)" }}>{v.name || "—"}</div>
        {Object.keys(v.props || {}).length > 0 && <div className="dss-mono" style={{ fontSize: 9.5, color: "var(--ink-subtle)", marginTop: 3, lineHeight: 1.4, wordBreak: "break-word" }}>{propsLabel(v.props)}</div>}
      </div>
    </div>
  )
}
function CodeBlock({ code }: { code: string }) {
  const [copied, setCopied] = useState(false)
  const copy = () => { try { navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 1400) } catch {} }
  return (
    <div style={{ position: "relative" }}>
      <button onClick={copy} style={{ position: "absolute", top: 8, right: 8, fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 600, color: copied ? "var(--accent-ink)" : "var(--ink-muted)", background: copied ? "var(--accent-soft)" : "var(--surface)", border: "1px solid var(--hairline-strong)", borderRadius: 8, padding: "4px 10px", cursor: "pointer" }}>{copied ? "copiado" : "copiar"}</button>
      <pre className="dss-mono" style={{ margin: 0, background: "var(--surface-2)", border: "1px solid var(--hairline)", borderRadius: 12, padding: "14px 16px", fontSize: 12.5, color: "var(--ink)", overflowX: "auto", lineHeight: 1.55, whiteSpace: "pre" }}>{code}</pre>
    </div>
  )
}
const PANEL: React.CSSProperties = { background: "var(--surface)", borderRadius: 18, boxShadow: "var(--shadow-md)" }
const H2: React.CSSProperties = { fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 700, letterSpacing: ".07em", textTransform: "uppercase", color: "var(--ink-subtle)" }

// ─── Telas ──────────────────────────────────────────────────────────────────
function ComponentDetail({ entry }: { entry: RegistryEntry }) {
  const axes = useMemo(() => propAxes(entry), [entry.name])
  const [showCode, setShowCode] = useState(false)
  const variants = entry.variants && entry.variants.length ? entry.variants : [{ name: "Default", props: {} }]
  return (
    <div className="dss-fade" style={{ padding: "26px 30px 60px", maxWidth: 1080 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 18 }}>
        <h1 className="dss-display" style={{ fontSize: 30, fontWeight: 800, margin: 0, letterSpacing: "-0.03em" }}>{entry.displayName}</h1>
        <span className="dss-mono" style={{ fontSize: 11, background: "var(--surface-2)", color: "var(--ink-muted)", padding: "4px 10px", borderRadius: 999 }}>v{entry.version}</span>
        <span className="dss-mono" style={{ fontSize: 11, color: "var(--ink-subtle)" }}>{variants.length} variações</span>
        <span className="dss-mono" style={{ fontSize: 11, color: "var(--ink-subtle)", marginLeft: "auto" }}>{entry.category}</span>
      </div>
      <div style={{ ...PANEL, padding: 22, marginBottom: 20 }}>
        <div style={{ ...H2, marginBottom: 12 }}>Uso</div>
        <div style={{ display: "grid", gap: 14, gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}>
          <CodeBlock code={`import { ${entry.name} } from "@/components/${entry.name}"`} />
          <CodeBlock code={`<${entry.name} />`} />
        </div>
      </div>
      <div style={{ ...PANEL, overflow: "hidden", marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "14px 20px", borderBottom: "1px solid var(--hairline)" }}>
          <span style={{ fontSize: 14, fontWeight: 700 }}>Variantes</span>
          <span className="dss-mono" style={{ fontSize: 10.5, fontWeight: 600, color: "var(--ink-muted)", background: "var(--surface-3)", padding: "2px 8px", borderRadius: 999 }}>{variants.length}</span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(240px,1fr))", gap: 16, padding: 18 }}>
          {variants.map((v, i) => <PreviewCell key={i} entry={entry} v={v as Variant} />)}
        </div>
      </div>
      {axes.length > 0 && (
        <div style={{ ...PANEL, padding: 22, marginBottom: 20 }}>
          <div style={{ ...H2, marginBottom: 14 }}>Props</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {axes.map(a => (
              <div key={a.name} style={{ display: "flex", gap: 12, alignItems: "baseline", flexWrap: "wrap" }}>
                <span className="dss-mono" style={{ fontSize: 12.5, fontWeight: 600, color: "var(--ink)", minWidth: 120 }}>{a.name}</span>
                <span style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {a.values.map(val => <span key={val} className="dss-mono" style={{ fontSize: 11, color: "var(--ink-muted)", background: "var(--surface-2)", border: "1px solid var(--hairline)", borderRadius: 7, padding: "3px 9px" }}>{val}</span>)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
      {entry.source && (
        <div style={{ ...PANEL, padding: 22 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: showCode ? 14 : 0 }}>
            <div style={H2}>Código-fonte</div>
            <button onClick={() => setShowCode(s => !s)} style={{ fontFamily: "var(--font-sans)", fontSize: 12, fontWeight: 600, color: "var(--ink-muted)", background: "transparent", border: "1px solid var(--hairline-strong)", borderRadius: 999, padding: "6px 14px", cursor: "pointer" }}>{showCode ? "Ocultar" : "Mostrar"}</button>
          </div>
          {showCode && <CodeBlock code={entry.source} />}
        </div>
      )}
    </div>
  )
}

function FoundationScreen({ registry }: { registry: RegistryEntry[] }) {
  const tokens = useMemo(() => {
    const seen: Record<string, TokenEntry> = {}
    for (const c of registry) for (const t of (c.tokens || [])) { if (t && t.name && !(t.name in seen)) seen[t.name] = t }
    const all = Object.values(seen)
    return { colors: all.filter(t => isColor(t.value)), others: all.filter(t => !isColor(t.value)) }
  }, [registry])
  const total = tokens.colors.length + tokens.others.length
  return (
    <div className="dss-fade" style={{ padding: "26px 30px 60px", maxWidth: 1080 }}>
      <h1 className="dss-display" style={{ fontSize: 30, fontWeight: 800, margin: "0 0 6px", letterSpacing: "-0.03em" }}>Foundation</h1>
      <p style={{ fontSize: 14, color: "var(--ink-muted)", margin: "0 0 24px" }}>{total} tokens usados pelos componentes deste design system.</p>
      {tokens.colors.length > 0 && (
        <div style={{ ...PANEL, padding: 22, marginBottom: 20 }}>
          <div style={{ ...H2, marginBottom: 16 }}>Cores</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(180px,1fr))", gap: 14 }}>
            {tokens.colors.map(t => (
              <div key={t.name} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ width: 34, height: 34, borderRadius: 9, background: String(t.value), border: "1px solid var(--hairline-strong)", flexShrink: 0 }} />
                <span style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
                  <span className="dss-mono" style={{ fontSize: 12, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.name}</span>
                  <span className="dss-mono" style={{ fontSize: 10.5, color: "var(--ink-subtle)" }}>{String(t.value)}</span>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
      {tokens.others.length > 0 && (
        <div style={{ ...PANEL, padding: 22 }}>
          <div style={{ ...H2, marginBottom: 14 }}>Dimensões & outros</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {tokens.others.map(t => (
              <div key={t.name} style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "7px 0", borderBottom: "1px solid var(--hairline)" }}>
                <span className="dss-mono" style={{ fontSize: 12.5, color: "var(--ink)" }}>{t.name}</span>
                <span className="dss-mono" style={{ fontSize: 12, color: "var(--ink-muted)" }}>{String(t.value)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      {total === 0 && <div style={{ ...PANEL, padding: 40, textAlign: "center", color: "var(--ink-subtle)", fontSize: 13 }}>Nenhum token de foundation registrado ainda.</div>}
    </div>
  )
}

function IntroScreen({ project, registry, onComponents }: { project: Project; registry: RegistryEntry[]; onComponents: () => void }) {
  const totalVariants = registry.reduce((a, c) => a + ((c.variants || []).length || 0), 0)
  const name = project.name || project.repo || "Design System"
  return (
    <div className="dss-fade" style={{ padding: "26px 30px 60px", maxWidth: 900 }}>
      <h1 className="dss-display" style={{ fontSize: 36, fontWeight: 800, margin: "4px 0 8px", letterSpacing: "-0.035em" }}>{name}</h1>
      <p style={{ fontSize: 16, color: "var(--ink-muted)", margin: "0 0 24px", lineHeight: 1.6 }}>Design system — a biblioteca de componentes React/TypeScript deste repositório. Aqui você vê o que está publicado, em qual versão, e como usar cada componente.</p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 12, marginBottom: 24 }}>
        {[["Componentes", registry.length], ["Variantes", totalVariants], ["Categorias", new Set(registry.map(c => c.category || "Components")).size]].map(([l, v]) => (
          <div key={l as string} style={{ ...PANEL, padding: "18px 20px" }}>
            <div className="dss-display" style={{ fontSize: 34, fontWeight: 800, letterSpacing: "-0.035em", lineHeight: 1 }}>{v as number}</div>
            <div className="dss-mono" style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--ink-subtle)", marginTop: 6 }}>{l as string}</div>
          </div>
        ))}
      </div>
      <div style={{ ...PANEL, padding: 22 }}>
        <div style={{ ...H2, marginBottom: 12 }}>O que é este site</div>
        <p style={{ fontSize: 13.5, color: "var(--ink-muted)", lineHeight: 1.65, margin: 0 }}>Uma visão viva dos componentes deste repositório: cada componente é renderizado com todas as suas variantes, props e código-fonte. Use o menu <b style={{ color: "var(--ink)" }}>Componentes</b> para navegar, <b style={{ color: "var(--ink)" }}>Foundation</b> para os tokens, e <b style={{ color: "var(--ink)" }}>Uso</b> para conectar os componentes no seu projeto.</p>
        <div style={{ marginTop: 16 }}>
          <button onClick={onComponents} style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "var(--primary)", color: "var(--on-primary)", border: "none", borderRadius: 999, padding: "10px 18px", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "var(--font-sans)" }}>Ver componentes <Icon d={IC.chevron} size={14} /></button>
        </div>
      </div>
    </div>
  )
}

function UsageScreen({ project, registry }: { project: Project; registry: RegistryEntry[] }) {
  const first = registry[0]?.name || "Button"
  return (
    <div className="dss-fade" style={{ padding: "26px 30px 60px", maxWidth: 860 }}>
      <h1 className="dss-display" style={{ fontSize: 30, fontWeight: 800, margin: "0 0 6px", letterSpacing: "-0.03em" }}>Uso — para desenvolvedores</h1>
      <p style={{ fontSize: 14, color: "var(--ink-muted)", margin: "0 0 24px", lineHeight: 1.6 }}>Como conectar e usar os componentes deste design system no seu projeto.</p>
      {[
        { n: "1", t: "Obtenha os componentes", d: <>Os componentes vivem em <span className="dss-mono">src/components/</span> deste repositório. Copie a pasta do componente para o seu projeto, ou instale este repositório como dependência Git.</>, code: `npm install github:${(project.owner || "owner")}/${(project.repo || "design-system")}` },
        { n: "2", t: "Garanta os tokens", d: <>Os componentes referenciam CSS variables (tokens da Foundation). Importe o <span className="dss-mono">src/tokens.css</span> uma vez no seu app (ex.: no entrypoint).</>, code: `import "@/tokens.css"` },
        { n: "3", t: "Importe e use", d: <>Importe o componente pelo nome e use no JSX. Veja as props disponíveis na página de cada componente.</>, code: `import { ${first} } from "@/components/${first}"\n\nexport default function App() {\n  return <${first} />\n}` },
      ].map(step => (
        <div key={step.n} style={{ ...PANEL, padding: 22, marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
            <span className="dss-mono" style={{ width: 26, height: 26, borderRadius: 8, background: "var(--surface-2)", border: "1px solid var(--hairline)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: "var(--ink)" }}>{step.n}</span>
            <span style={{ fontSize: 15, fontWeight: 700 }}>{step.t}</span>
          </div>
          <p style={{ fontSize: 13, color: "var(--ink-muted)", lineHeight: 1.6, margin: "0 0 12px" }}>{step.d}</p>
          <CodeBlock code={step.code} />
        </div>
      ))}
      <div style={{ ...PANEL, padding: 22 }}>
        <div style={{ ...H2, marginBottom: 10 }}>Convenções</div>
        <p style={{ fontSize: 13, color: "var(--ink-muted)", lineHeight: 1.65, margin: 0 }}>Componentes usam <span className="dss-mono">class-variance-authority</span> para variantes e <span className="dss-mono">tailwind-merge</span> via <span className="dss-mono">cn()</span>. As props de variante casam com os valores mostrados na aba <b style={{ color: "var(--ink)" }}>Props</b> de cada componente.</p>
      </div>
    </div>
  )
}

type View = "intro" | "usage" | "foundation" | "component"

export default function Viewer({ registry, project = {} }: { registry: RegistryEntry[]; project?: Project }) {
  const [theme, setTheme] = useState<Theme>(() => { try { return (localStorage.getItem("dss-viewer-theme") as Theme) || "light" } catch { return "light" } })
  useEffect(() => { try { localStorage.setItem("dss-viewer-theme", theme) } catch {} }, [theme])
  const [view, setView] = useState<View>("intro")
  const [sel, setSel] = useState<string | null>(null)
  const [q, setQ] = useState("")
  const [compsOpen, setCompsOpen] = useState(true)

  const name = project.name || (project.repo || "Design System").replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase())
  // TODOS os componentes em ordem alfabética (um dropdown só)
  const allComps = useMemo(() => [...registry].sort((a, b) => a.displayName.localeCompare(b.displayName)), [registry])
  const filtered = useMemo(() => { const ql = q.trim().toLowerCase(); return ql ? allComps.filter(c => c.displayName.toLowerCase().includes(ql) || c.name.toLowerCase().includes(ql)) : allComps }, [allComps, q])
  const active = sel ? registry.find(c => c.name === sel) || null : null
  const openComp = (n: string) => { setSel(n); setView("component") }

  const navItem = (icon: string, label: string, on: boolean, onClick: () => void) => (
    <button onClick={onClick} style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", textAlign: "left", background: on ? "var(--surface)" : "transparent", boxShadow: on ? "var(--shadow-sm)" : "none", border: "none", borderRadius: 10, padding: "9px 14px", cursor: "pointer", fontFamily: "var(--font-sans)", fontSize: 13.5, fontWeight: on ? 600 : 500, color: on ? "var(--ink)" : "var(--ink-muted)" }}>
      <Icon d={icon} size={16} />{label}
    </button>
  )

  return (
    <ThemeCtx.Provider value={{ theme, toggle: () => setTheme(t => t === "light" ? "dark" : "light") }}>
      <div data-theme={theme === "dark" ? "dark" : undefined}>
        <style>{THEME_CSS}</style>
        <FontLoader />
        <div className="dss-root" style={{ display: "flex", minHeight: "100vh", background: "var(--canvas)", fontFamily: "var(--font-sans)", color: "var(--ink)" }}>
          <aside style={{ width: 280, flexShrink: 0, background: "var(--canvas)", borderRight: "1px solid var(--hairline)", position: "sticky", top: 0, height: "100vh", display: "flex", flexDirection: "column" }}>
            <button onClick={() => setView("intro")} style={{ display: "flex", alignItems: "center", gap: 10, background: "none", border: "none", cursor: "pointer", padding: "20px 22px 14px", textAlign: "left" }}>
              <span style={{ width: 30, height: 30, borderRadius: 9, background: "linear-gradient(145deg,#6f6f72,#2b2b2e)", display: "inline-flex", alignItems: "center", justifyContent: "center", boxShadow: "var(--shadow-sm)" }}>
                <span style={{ width: 13, height: 13, background: "#fff", clipPath: "polygon(50% 0, 93% 25%, 93% 75%, 50% 100%, 7% 75%, 7% 25%)" }} />
              </span>
              <span style={{ display: "flex", flexDirection: "column", lineHeight: 1.1 }}>
                <span style={{ fontSize: 14, fontWeight: 800, letterSpacing: "-0.02em", color: "var(--ink)" }}>{name}</span>
                <span className="dss-mono" style={{ fontSize: 9.5, color: "var(--ink-subtle)", letterSpacing: ".04em" }}>DESIGN SYSTEM</span>
              </span>
            </button>

            <div style={{ padding: "0 16px 10px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, background: "var(--surface)", border: "1px solid var(--hairline)", borderRadius: 999, padding: "8px 14px", boxShadow: "var(--shadow-sm)" }}>
                <Icon d={IC.search} size={14} stroke={1.8} />
                <input value={q} onChange={e => { setQ(e.target.value); if (e.target.value) setCompsOpen(true) }} placeholder="Buscar…" style={{ flex: 1, minWidth: 0, border: "none", outline: "none", background: "transparent", fontSize: 13, fontFamily: "var(--font-sans)", color: "var(--ink)" }} />
              </div>
            </div>

            <div className="dss-scroll" style={{ flex: 1, overflowY: "auto", padding: "0 12px 16px", display: "flex", flexDirection: "column", gap: 2 }}>
              {navItem(IC.book, "Introdução", view === "intro", () => setView("intro"))}
              {navItem(IC.play, "Uso", view === "usage", () => setView("usage"))}
              {navItem(IC.layers, "Foundation", view === "foundation", () => setView("foundation"))}

              {/* Componentes — dropdown único, alfabético */}
              <button onClick={() => setCompsOpen(o => !o)} style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", textAlign: "left", background: "transparent", border: "none", borderRadius: 10, padding: "9px 14px", cursor: "pointer", fontFamily: "var(--font-sans)", fontSize: 13.5, fontWeight: 600, color: "var(--ink)", marginTop: 4 }}>
                <Icon d={IC.grid} size={16} />Componentes
                <span className="dss-mono" style={{ fontSize: 10, color: "var(--ink-subtle)", marginLeft: "auto" }}>{filtered.length}</span>
                <span style={{ display: "inline-flex", transform: compsOpen ? "rotate(90deg)" : "none", transition: "transform .16s", color: "var(--ink-subtle)" }}><Icon d={IC.chevron} size={13} /></span>
              </button>
              {compsOpen && (
                <div style={{ display: "flex", flexDirection: "column", gap: 1, paddingLeft: 8 }}>
                  {filtered.length === 0 && <div style={{ padding: "6px 16px", fontSize: 12, color: "var(--ink-subtle)" }}>Nada encontrado.</div>}
                  {filtered.map(c => {
                    const on = view === "component" && sel === c.name
                    return (
                      <button key={c.name} onClick={() => openComp(c.name)} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", textAlign: "left", background: on ? "var(--surface)" : "transparent", boxShadow: on ? "var(--shadow-sm)" : "none", border: "none", borderRadius: 9, padding: "7px 14px", cursor: "pointer", fontFamily: "var(--font-sans)", fontSize: 13, fontWeight: on ? 600 : 500, color: on ? "var(--ink)" : "var(--ink-muted)" }}>
                        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.displayName}</span>
                        <span className="dss-mono" style={{ fontSize: 10, color: "var(--ink-subtle)", flexShrink: 0, marginLeft: 8 }}>{(c.variants || []).length}</span>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>

            <div style={{ padding: "12px 18px", borderTop: "1px solid var(--hairline)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 7, fontFamily: "var(--font-mono)", fontSize: 9.5, color: "var(--ink-subtle)", letterSpacing: ".03em" }}>
                <span style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1.5, width: 12, height: 12 }}>
                  <span style={{ background: "var(--ink-subtle)", borderRadius: 1 }} /><span style={{ background: "var(--accent)", borderRadius: 1 }} /><span style={{ background: "var(--ink-subtle)", borderRadius: 1 }} /><span style={{ background: "var(--ink-subtle)", borderRadius: 1 }} />
                </span>
                Generated with DS Studio
              </span>
              <button title="Alternar tema" onClick={() => setTheme(t => t === "light" ? "dark" : "light")} style={{ width: 30, height: 30, borderRadius: 999, border: "1px solid var(--hairline-strong)", background: "transparent", color: "var(--ink-muted)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><Icon d={theme === "light" ? IC.moon : IC.sun} size={14} /></button>
            </div>
          </aside>

          <main style={{ flex: 1, minWidth: 0, overflowY: "auto", height: "100vh" }}>
            {view === "intro" && <IntroScreen project={project} registry={registry} onComponents={() => { setCompsOpen(true); const f = allComps[0]; if (f) openComp(f.name) }} />}
            {view === "usage" && <UsageScreen project={project} registry={registry} />}
            {view === "foundation" && <FoundationScreen registry={registry} />}
            {view === "component" && (active ? <ComponentDetail entry={active} /> : <div style={{ padding: 40, color: "var(--ink-subtle)" }}>Selecione um componente.</div>)}
          </main>
        </div>
      </div>
    </ThemeCtx.Provider>
  )
}
