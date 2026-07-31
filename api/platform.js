// ════════════════════════════════════════════════════════════════════════════
// DS Studio — DISPATCHER de ações da plataforma  ·  api/platform/[action].js
//
// UM único arquivo = UMA serverless function que atende VÁRIAS ações, decididas
// pelo segmento dinâmico [action]. Motivo: o plano Hobby do Vercel limita a 12
// functions; um arquivo por endpoint estoura. Aqui, endpoints futuros (publicar
// no GitHub, listar componentes, etc.) viram apenas novas actions — zero function
// nova. O contador para de crescer.
//
// Rotas (todas POST):
//   POST /api/platform/create-project    → cria projeto (INSERT ds_projects)
//   POST /api/platform/save-component     → grava componente (ds_components + versions)
//   POST /api/platform/log-generation     → telemetria de geração (ds_generations)
//
// Env (já existem no Vercel): SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY
//   (log-generation aceita DEFAULT_PROJECT_ID / DEFAULT_USER_ID como fallback opcional)
// A service_role NUNCA vai pro cliente; só este endpoint a usa.
// ════════════════════════════════════════════════════════════════════════════

import * as brain from './_brain.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const VISIBILITY_ALLOWED = ['public', 'password', 'private'];

function slugify(name) {
  const s = String(name || '')
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return s || 'projeto';
}
function shortSuffix() { return Math.random().toString(16).slice(2, 6); }
function bumpPatch(v) {
  const p = String(v || '1.0.0').replace(/^v/, '').split('.').map(n => parseInt(n, 10) || 0);
  while (p.length < 3) p.push(0);
  p[2] += 1;
  return p.slice(0, 3).join('.');
}

// ─── env / helpers compartilhados ────────────────────────────────────────────
function env() {
  return {
    SUPABASE_URL: process.env.SUPABASE_URL,
    SERVICE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    ANON_KEY: process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY,
    DEFAULT_PROJECT_ID: process.env.DEFAULT_PROJECT_ID || null,
    DEFAULT_USER_ID: process.env.DEFAULT_USER_ID || null,
  };
}
const sbHeaders = (key) => ({ apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' });
const readBody = (req) => (typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {}));

// Valida o Bearer token (sessão Supabase) e devolve o user id — ou null se ausente/inválido.
// Usado pra preencher created_by quando o plugin está logado (auth poll-based).
async function userIdFromToken(req) {
  const { SUPABASE_URL, ANON_KEY } = env();
  const authHeader = req.headers['authorization'] || req.headers['Authorization'] || '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!token || !SUPABASE_URL) return null;
  try {
    const who = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: { apikey: ANON_KEY, Authorization: `Bearer ${token}` } });
    if (!who.ok) return null;
    const u = await who.json().catch(() => null);
    return (u && u.id) || null;
  } catch (e) { return null; }
}

// ════════════════════════════ ação: create-project ══════════════════════════
async function createProject(req, res) {
  const { SUPABASE_URL, SERVICE_KEY, ANON_KEY } = env();
  if (!SUPABASE_URL || !SERVICE_KEY) return res.status(500).json({ error: 'supabase_env_missing' });

  // owner_id NÃO vem do client — resolvido do token da sessão
  const authHeader = req.headers['authorization'] || req.headers['Authorization'] || '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!token) return res.status(401).json({ error: 'missing_token', detail: 'Faça login antes de criar um projeto.' });

  const who = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: { apikey: ANON_KEY, Authorization: `Bearer ${token}` } });
  if (!who.ok) return res.status(401).json({ error: 'invalid_token', detail: 'Sessão expirada — entre novamente.' });
  const user = await who.json().catch(() => ({}));
  const owner_id = user && user.id;
  if (!owner_id) return res.status(401).json({ error: 'no_user_id' });

  const b = readBody(req);
  const name = (b.name == null ? '' : String(b.name)).trim();
  if (!name) return res.status(400).json({ error: 'name_required', detail: 'O projeto precisa de um nome.' });
  if (name.length > 120) return res.status(400).json({ error: 'name_too_long' });

  const row = { name, owner_id, slug: slugify(name) };
  if (b.tagline != null && String(b.tagline).trim()) row.tagline = String(b.tagline).slice(0, 200);
  if (b.accent_color != null && /^#[0-9a-fA-F]{3,8}$/.test(String(b.accent_color).trim())) row.accent_color = String(b.accent_color).trim();
  if (b.visibility != null && VISIBILITY_ALLOWED.includes(String(b.visibility))) row.visibility = String(b.visibility);

  const insert = (payload) => fetch(`${SUPABASE_URL}/rest/v1/ds_projects`, {
    method: 'POST', headers: { ...sbHeaders(SERVICE_KEY), Prefer: 'return=representation' }, body: JSON.stringify(payload),
  });

  let r = await insert(row);
  if (!r.ok) {
    const detail = await r.text().catch(() => '');
    if (r.status === 409 || /duplicate key|23505|slug/i.test(detail)) {
      r = await insert({ ...row, slug: `${row.slug}-${shortSuffix()}` });
    } else {
      return res.status(502).json({ error: 'supabase_insert_failed', status: r.status, detail: detail.slice(0, 400) });
    }
  }
  if (!r.ok) {
    const detail = await r.text().catch(() => '');
    return res.status(502).json({ error: 'supabase_insert_failed', status: r.status, detail: detail.slice(0, 400) });
  }
  const created = await r.json().catch(() => null);
  const project = Array.isArray(created) ? created[0] : created;
  if (!project || !project.id) return res.status(502).json({ error: 'no_project_returned' });
  return res.status(200).json({ ok: true, project });
}

// ════════════════════════════ ação: update-project ══════════════════════════
// Grava repo_full_name + vercel_url no projeto do usuário (chamado após publicar no GitHub).
// Escopado ao dono: o PATCH filtra por owner_id, então um usuário só altera o próprio projeto.
async function updateProject(req, res) {
  const { SUPABASE_URL, SERVICE_KEY, ANON_KEY } = env();
  if (!SUPABASE_URL || !SERVICE_KEY) return res.status(500).json({ error: 'supabase_env_missing' });

  const authHeader = req.headers['authorization'] || req.headers['Authorization'] || '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!token) return res.status(401).json({ error: 'missing_token', detail: 'Faça login antes de atualizar o projeto.' });
  const who = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: { apikey: ANON_KEY, Authorization: `Bearer ${token}` } });
  if (!who.ok) return res.status(401).json({ error: 'invalid_token', detail: 'Sessão expirada — entre novamente.' });
  const user = await who.json().catch(() => ({}));
  const owner_id = user && user.id;
  if (!owner_id) return res.status(401).json({ error: 'no_user_id' });

  const b = readBody(req);
  const project_id = (b.project_id == null ? '' : String(b.project_id)).trim();
  if (!project_id) return res.status(400).json({ error: 'project_id_required' });

  const patch = {};
  if (b.repo_full_name != null && String(b.repo_full_name).trim()) {
    const repo = String(b.repo_full_name).trim();
    if (!/^[\w.-]+\/[\w.-]+$/.test(repo)) return res.status(400).json({ error: 'repo_full_name_invalid', detail: 'Formato esperado: owner/repo.' });
    patch.repo_full_name = repo;
  }
  if (b.vercel_url != null && String(b.vercel_url).trim()) {
    let url = String(b.vercel_url).trim();
    if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
    if (!/^https?:\/\/[^\s]+$/i.test(url)) return res.status(400).json({ error: 'vercel_url_invalid' });
    patch.vercel_url = url.slice(0, 300);
  }
  if (b.name != null && String(b.name).trim()) {
    const nm = String(b.name).trim();
    if (nm.length > 120) return res.status(400).json({ error: 'name_too_long' });
    patch.name = nm;
  }
  if (b.tagline != null) patch.tagline = String(b.tagline).slice(0, 200);
  if (b.accent_color != null && /^#[0-9a-fA-F]{3,8}$/.test(String(b.accent_color).trim())) patch.accent_color = String(b.accent_color).trim();
  if (b.visibility != null && VISIBILITY_ALLOWED.includes(String(b.visibility))) patch.visibility = String(b.visibility);
  if (!Object.keys(patch).length) return res.status(400).json({ error: 'nothing_to_update', detail: 'Nada para atualizar (nome, visibilidade, repo ou vercel_url).' });

  const r = await fetch(`${SUPABASE_URL}/rest/v1/ds_projects?id=eq.${encodeURIComponent(project_id)}&owner_id=eq.${encodeURIComponent(owner_id)}`, {
    method: 'PATCH', headers: { ...sbHeaders(SERVICE_KEY), Prefer: 'return=representation' }, body: JSON.stringify(patch),
  });
  if (!r.ok) {
    const detail = await r.text().catch(() => '');
    return res.status(502).json({ error: 'supabase_update_failed', status: r.status, detail: detail.slice(0, 400) });
  }
  const updated = await r.json().catch(() => null);
  const project = Array.isArray(updated) ? updated[0] : updated;
  if (!project || !project.id) return res.status(404).json({ error: 'project_not_found', detail: 'Projeto não encontrado ou não pertence a você.' });
  return res.status(200).json({ ok: true, project });
}

// Helper: o usuário é dono do projeto? (usado por deployments e membros)
async function ownsProject(uid, project_id) {
  const { SUPABASE_URL, SERVICE_KEY } = env();
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/ds_projects?id=eq.${project_id}&owner_id=eq.${uid}&select=id&limit=1`, { headers: sbHeaders(SERVICE_KEY) });
    if (!r.ok) return false;
    const rows = await r.json().catch(() => []);
    return Array.isArray(rows) && rows.length > 0;
  } catch (_) { return false; }
}

// ════════════════════════════ A · módulos ═══════════════════════════════════
// Constrói o filtro PostgREST da linha de ds_modules pra um escopo.
function moduleScopeFilter(target_type, ids) {
  if (target_type === 'platform') return 'target_type=eq.platform&org_id=is.null&project_id=is.null&user_id=is.null';
  if (target_type === 'org') return `target_type=eq.org&org_id=eq.${ids.org_id}`;
  if (target_type === 'project') return `target_type=eq.project&project_id=eq.${ids.project_id}`;
  if (target_type === 'user') return `target_type=eq.user&user_id=eq.${ids.user_id}`;
  return null;
}
// GET (admin) — lê o jsonb `features` da linha de um escopo (default: platform).
// ─── action "quota": cota do mês do usuário logado (medidor no plugin) ───────
// GET /api/platform?action=quota  (Authorization: Bearer <JWT>)
// → { ok, used, limit, unlimited, tier }  · limit = -1 quando ilimitado (tester)
async function getQuota(req, res) {
  const { SUPABASE_URL, SERVICE_KEY } = env();
  if (!SUPABASE_URL || !SERVICE_KEY) return res.status(500).json({ error: 'supabase_env_missing' });
  const uid = await userIdFromToken(req);
  if (!uid) return res.status(401).json({ error: 'unauthorized' });

  async function feats(target_type, ids) {
    const filter = moduleScopeFilter(target_type, ids);
    if (!filter) return {};
    const r = await fetch(`${SUPABASE_URL}/rest/v1/ds_modules?${filter}&select=features&order=updated_at.desc&limit=1`, { headers: sbHeaders(SERVICE_KEY) });
    if (!r.ok) return {};
    const rows = await r.json().catch(() => []);
    return (rows && rows[0] && rows[0].features) || {};
  }
  const merged = Object.assign({}, await feats('platform', {}), await feats('user', { user_id: uid }));
  const numMax = Number(merged['max_gen/month']);
  const unlimited = Number.isFinite(numMax) && numMax < 0;
  const limit = (!Number.isFinite(numMax) || numMax === 0) ? 5 : numMax;

  // Contador AUTORITATIVO de uso do mês = ds_usage (mesma fonte que o proxy v3 incrementa).
  const ym = new Date().toISOString().slice(0, 7); // 'YYYY-MM'
  let used = 0;
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/ds_usage?user_id=eq.${encodeURIComponent(uid)}&ym=eq.${ym}&select=count`, { headers: sbHeaders(SERVICE_KEY) });
    if (r.ok) { const rows = await r.json().catch(() => []); used = (rows && rows[0] && Number(rows[0].count)) || 0; }
  } catch (_) {}

  const tier = unlimited ? (merged['tier'] || 'tester') : 'free';
  return res.status(200).json({ ok: true, used, limit: unlimited ? -1 : limit, unlimited, tier });
}

async function getModules(req, res) {
  const { SUPABASE_URL, SERVICE_KEY } = env();
  if (!SUPABASE_URL || !SERVICE_KEY) return res.status(500).json({ error: 'supabase_env_missing' });
  const uid = await userIdFromToken(req);
  if (!uid) return res.status(401).json({ error: 'unauthorized' });
  if (!(await isPlatformAdmin(uid))) return res.status(403).json({ error: 'forbidden', detail: 'Só administradores da plataforma podem ver/editar módulos.' });
  const target_type = String((req.query && req.query.target_type) || 'platform');
  const ids = { org_id: req.query.org_id, project_id: req.query.project_id, user_id: req.query.user_id };
  const filter = moduleScopeFilter(target_type, ids);
  if (!filter) return res.status(400).json({ error: 'bad_target_type' });
  const r = await fetch(`${SUPABASE_URL}/rest/v1/ds_modules?${filter}&select=id,features&order=updated_at.desc&limit=1`, { headers: sbHeaders(SERVICE_KEY) });
  if (!r.ok) return res.status(502).json({ error: 'get_modules_failed', status: r.status });
  const rows = await r.json().catch(() => []);
  const row = Array.isArray(rows) && rows[0];
  return res.status(200).json({ ok: true, target_type, id: (row && row.id) || null, features: (row && row.features) || {} });
}
// POST (admin) — funde `features` na linha do escopo (read-modify-write; cria se não existe).
async function setModules(req, res) {
  const { SUPABASE_URL, SERVICE_KEY } = env();
  if (!SUPABASE_URL || !SERVICE_KEY) return res.status(500).json({ error: 'supabase_env_missing' });
  const uid = await userIdFromToken(req);
  if (!uid) return res.status(401).json({ error: 'unauthorized' });
  if (!(await isPlatformAdmin(uid))) return res.status(403).json({ error: 'forbidden', detail: 'Só administradores da plataforma podem editar módulos.' });
  const b = readBody(req);
  const target_type = String(b.target_type || 'platform');
  const ids = { org_id: b.org_id, project_id: b.project_id, user_id: b.user_id };
  const filter = moduleScopeFilter(target_type, ids);
  if (!filter) return res.status(400).json({ error: 'bad_target_type' });
  if (target_type !== 'platform') {
    const scopeId = ids[target_type + '_id'];
    if (!UUID_RE.test(String(scopeId || ''))) return res.status(400).json({ error: 'scope_id_invalid', detail: `${target_type}_id precisa ser um uuid.` });
  }
  const features = b.features;
  if (!features || typeof features !== 'object' || Array.isArray(features)) return res.status(400).json({ error: 'features_required', detail: 'Envie um objeto features { chave: valor }.' });
  // linha existente do escopo
  const getR = await fetch(`${SUPABASE_URL}/rest/v1/ds_modules?${filter}&select=id,features&order=updated_at.desc&limit=1`, { headers: sbHeaders(SERVICE_KEY) });
  const rows = await getR.json().catch(() => []);
  const existing = Array.isArray(rows) && rows[0];
  const merged = { ...((existing && existing.features) || {}), ...features };
  let r;
  if (existing) {
    r = await fetch(`${SUPABASE_URL}/rest/v1/ds_modules?id=eq.${existing.id}`, {
      method: 'PATCH', headers: { ...sbHeaders(SERVICE_KEY), Prefer: 'return=representation' },
      body: JSON.stringify({ features: merged, updated_by: uid, updated_at: new Date().toISOString() }),
    });
  } else {
    const row = { target_type, features: merged, updated_by: uid };
    if (target_type === 'org') row.org_id = ids.org_id;
    if (target_type === 'project') row.project_id = ids.project_id;
    if (target_type === 'user') row.user_id = ids.user_id;
    r = await fetch(`${SUPABASE_URL}/rest/v1/ds_modules`, {
      method: 'POST', headers: { ...sbHeaders(SERVICE_KEY), Prefer: 'return=representation' }, body: JSON.stringify(row),
    });
  }
  if (!r.ok) { const detail = await r.text().catch(() => ''); return res.status(502).json({ error: 'set_modules_failed', status: r.status, detail: detail.slice(0, 400) }); }
  return res.status(200).json({ ok: true, target_type, features: merged });
}

// ════════════════════════════ B · deployments ═══════════════════════════════
// POST (dono) — registra um deploy em ds_deployments (chamado após o commit no GitHub).
async function logDeployment(req, res) {
  const { SUPABASE_URL, SERVICE_KEY } = env();
  if (!SUPABASE_URL || !SERVICE_KEY) return res.status(500).json({ error: 'supabase_env_missing' });
  const uid = await userIdFromToken(req);
  if (!uid) return res.status(401).json({ error: 'unauthorized' });
  const b = readBody(req);
  const project_id = String(b.project_id || '').trim();
  if (!UUID_RE.test(project_id)) return res.status(400).json({ error: 'project_id_invalid' });
  if (!(await ownsProject(uid, project_id))) return res.status(403).json({ error: 'forbidden', detail: 'Projeto não é seu.' });
  const components = Array.isArray(b.components) ? b.components : [];
  const target_repo = String(b.target_repo || '').trim();
  if (!target_repo) return res.status(400).json({ error: 'target_repo_required' });
  const row = {
    project_id, components, component_count: components.length,
    target_repo, target_branch: String(b.target_branch || 'main'),
    commit_sha: b.commit_sha ? String(b.commit_sha) : null,
    commit_url: b.commit_url ? String(b.commit_url) : null,
    files_changed: Number(b.files_changed) || 0,
    status: 'success', completed_at: new Date().toISOString(), deployed_by: uid,
  };
  const insert = (payload) => fetch(`${SUPABASE_URL}/rest/v1/ds_deployments`, {
    method: 'POST', headers: { ...sbHeaders(SERVICE_KEY), Prefer: 'return=representation' }, body: JSON.stringify(payload),
  });
  let r = await insert(row);
  if (!r.ok) {
    const detail = await r.text().catch(() => '');
    // o enum deploy_status pode não ter 'success' — repete sem status (pega o default)
    if (/invalid input value for enum|deploy_status|22P02/i.test(detail)) {
      const noStatus = { ...row }; delete noStatus.status; delete noStatus.completed_at;
      r = await insert(noStatus);
    }
    if (!r.ok) { const d2 = await r.text().catch(() => ''); return res.status(502).json({ error: 'log_deploy_failed', status: r.status, detail: (d2 || detail).slice(0, 400) }); }
  }
  const dep = await r.json().catch(() => null);
  return res.status(200).json({ ok: true, deployment: Array.isArray(dep) ? dep[0] : dep });
}
// GET (dono) — histórico de deploys do projeto.
async function listDeployments(req, res) {
  const { SUPABASE_URL, SERVICE_KEY } = env();
  if (!SUPABASE_URL || !SERVICE_KEY) return res.status(500).json({ error: 'supabase_env_missing' });
  const uid = await userIdFromToken(req);
  if (!uid) return res.status(401).json({ error: 'unauthorized' });
  const project_id = String((req.query && req.query.project_id) || '').trim();
  if (!UUID_RE.test(project_id)) return res.status(400).json({ error: 'project_id_invalid' });
  if (!(await ownsProject(uid, project_id))) return res.status(403).json({ error: 'forbidden' });
  const cols = 'id,component_count,target_repo,target_branch,commit_sha,commit_url,status,files_changed,deployed_at,completed_at';
  const r = await fetch(`${SUPABASE_URL}/rest/v1/ds_deployments?project_id=eq.${project_id}&select=${cols}&order=deployed_at.desc&limit=50`, { headers: sbHeaders(SERVICE_KEY) });
  if (!r.ok) return res.status(502).json({ error: 'list_deploy_failed', status: r.status });
  const rows = await r.json().catch(() => []);
  return res.status(200).json({ ok: true, deployments: Array.isArray(rows) ? rows : [] });
}

// ════════════════════════════ C · membros / papéis ══════════════════════════
const PROJECT_ROLES = ['owner', 'admin', 'editor', 'viewer'];
// Papel EFETIVO do chamador num projeto: 'owner' se dono do ds_projects, senão a
// linha em project_members, senão null. (Consumido pelo roleCaps no front.)
async function projectRole(req, res) {
  const { SUPABASE_URL, SERVICE_KEY } = env();
  if (!SUPABASE_URL || !SERVICE_KEY) return res.status(500).json({ error: 'supabase_env_missing' });
  const uid = await userIdFromToken(req);
  if (!uid) return res.status(401).json({ error: 'unauthorized' });
  const project_id = String((req.query && req.query.project_id) || '').trim();
  if (!UUID_RE.test(project_id)) return res.status(400).json({ error: 'project_id_invalid' });
  const pr = await fetch(`${SUPABASE_URL}/rest/v1/ds_projects?id=eq.${project_id}&select=owner_id&limit=1`, { headers: sbHeaders(SERVICE_KEY) });
  const prows = await pr.json().catch(() => []);
  const proj = Array.isArray(prows) && prows[0];
  if (!proj) return res.status(200).json({ ok: true, role: null });
  if (proj.owner_id === uid) return res.status(200).json({ ok: true, role: 'owner' });
  const mr = await fetch(`${SUPABASE_URL}/rest/v1/project_members?project_id=eq.${project_id}&user_id=eq.${uid}&select=role&limit=1`, { headers: sbHeaders(SERVICE_KEY) });
  const mrows = await mr.json().catch(() => []);
  const role = (Array.isArray(mrows) && mrows[0] && mrows[0].role) || null;
  return res.status(200).json({ ok: true, role });
}
// GET (dono/membro) — lista membros do projeto (inclui o dono como 'owner' implícito).
async function listMembers(req, res) {
  const { SUPABASE_URL, SERVICE_KEY } = env();
  if (!SUPABASE_URL || !SERVICE_KEY) return res.status(500).json({ error: 'supabase_env_missing' });
  const uid = await userIdFromToken(req);
  if (!uid) return res.status(401).json({ error: 'unauthorized' });
  const project_id = String((req.query && req.query.project_id) || '').trim();
  if (!UUID_RE.test(project_id)) return res.status(400).json({ error: 'project_id_invalid' });
  const pr = await fetch(`${SUPABASE_URL}/rest/v1/ds_projects?id=eq.${project_id}&select=owner_id&limit=1`, { headers: sbHeaders(SERVICE_KEY) });
  const prows = await pr.json().catch(() => []);
  const proj = Array.isArray(prows) && prows[0];
  if (!proj) return res.status(404).json({ error: 'project_not_found' });
  const isOwner = proj.owner_id === uid;
  const mr = await fetch(`${SUPABASE_URL}/rest/v1/project_members?project_id=eq.${project_id}&select=id,user_id,role,joined_at&order=joined_at.asc`, { headers: sbHeaders(SERVICE_KEY) });
  const members = (await mr.json().catch(() => [])) || [];
  const amMember = isOwner || members.some((m) => m.user_id === uid);
  if (!amMember && !(await isPlatformAdmin(uid))) return res.status(403).json({ error: 'forbidden', detail: 'Você não é membro deste projeto.' });
  // perfis (nome/login/avatar) num fetch
  const ids = Array.from(new Set([proj.owner_id, ...members.map((m) => m.user_id)].filter(Boolean)));
  let profById = {};
  if (ids.length) {
    const pf = await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=in.(${ids.join(',')})&select=id,login_github,name,avatar_url`, { headers: sbHeaders(SERVICE_KEY) });
    const profs = (await pf.json().catch(() => [])) || [];
    for (const p of profs) profById[p.id] = p;
  }
  const shape = (user_id, role, joined_at, id) => ({ id: id || null, user_id, role, joined_at: joined_at || null,
    login: (profById[user_id] && profById[user_id].login_github) || null,
    name: (profById[user_id] && profById[user_id].name) || null,
    avatar: (profById[user_id] && profById[user_id].avatar_url) || null });
  const out = [];
  out.push(shape(proj.owner_id, 'owner', null, 'owner')); // dono implícito
  for (const m of members) { if (m.user_id !== proj.owner_id) out.push(shape(m.user_id, m.role, m.joined_at, m.id)); }
  return res.status(200).json({ ok: true, members: out, owner_id: proj.owner_id, can_manage: isOwner });
}
// POST (dono) — convida por login_github OU muda papel por user_id (upsert).
async function setMember(req, res) {
  const { SUPABASE_URL, SERVICE_KEY } = env();
  if (!SUPABASE_URL || !SERVICE_KEY) return res.status(500).json({ error: 'supabase_env_missing' });
  const uid = await userIdFromToken(req);
  if (!uid) return res.status(401).json({ error: 'unauthorized' });
  const b = readBody(req);
  const project_id = String(b.project_id || '').trim();
  if (!UUID_RE.test(project_id)) return res.status(400).json({ error: 'project_id_invalid' });
  if (!(await ownsProject(uid, project_id)) && !(await isPlatformAdmin(uid))) return res.status(403).json({ error: 'forbidden', detail: 'Só o dono do projeto gerencia membros.' });
  const role = String(b.role || '').trim();
  if (!PROJECT_ROLES.includes(role)) return res.status(400).json({ error: 'role_invalid', detail: 'Papel: owner, admin, editor ou viewer.' });
  let target = String(b.user_id || '').trim();
  if (!target && b.login_github) {
    const login = String(b.login_github).trim().replace(/^@/, '');
    const pr = await fetch(`${SUPABASE_URL}/rest/v1/profiles?login_github=eq.${encodeURIComponent(login)}&select=id&limit=1`, { headers: sbHeaders(SERVICE_KEY) });
    const prows = await pr.json().catch(() => []);
    target = (Array.isArray(prows) && prows[0] && prows[0].id) || '';
    if (!target) return res.status(404).json({ error: 'user_not_found', detail: 'Esse usuário do GitHub precisa ter entrado no DS Studio ao menos uma vez.' });
  }
  if (!UUID_RE.test(target)) return res.status(400).json({ error: 'user_id_required' });
  // upsert
  const ex = await fetch(`${SUPABASE_URL}/rest/v1/project_members?project_id=eq.${project_id}&user_id=eq.${target}&select=id&limit=1`, { headers: sbHeaders(SERVICE_KEY) });
  const exrows = await ex.json().catch(() => []);
  const existing = Array.isArray(exrows) && exrows[0];
  let r;
  if (existing) {
    r = await fetch(`${SUPABASE_URL}/rest/v1/project_members?id=eq.${existing.id}`, { method: 'PATCH', headers: { ...sbHeaders(SERVICE_KEY), Prefer: 'return=representation' }, body: JSON.stringify({ role }) });
  } else {
    r = await fetch(`${SUPABASE_URL}/rest/v1/project_members`, { method: 'POST', headers: { ...sbHeaders(SERVICE_KEY), Prefer: 'return=representation' }, body: JSON.stringify({ project_id, user_id: target, role, invited_by: uid }) });
  }
  if (!r.ok) { const detail = await r.text().catch(() => ''); return res.status(502).json({ error: 'set_member_failed', status: r.status, detail: detail.slice(0, 400) }); }
  return res.status(200).json({ ok: true, user_id: target, role });
}
// POST (dono) — remove um membro.
async function removeMember(req, res) {
  const { SUPABASE_URL, SERVICE_KEY } = env();
  if (!SUPABASE_URL || !SERVICE_KEY) return res.status(500).json({ error: 'supabase_env_missing' });
  const uid = await userIdFromToken(req);
  if (!uid) return res.status(401).json({ error: 'unauthorized' });
  const b = readBody(req);
  const project_id = String(b.project_id || '').trim();
  const user_id = String(b.user_id || '').trim();
  if (!UUID_RE.test(project_id) || !UUID_RE.test(user_id)) return res.status(400).json({ error: 'ids_invalid' });
  if (!(await ownsProject(uid, project_id)) && !(await isPlatformAdmin(uid))) return res.status(403).json({ error: 'forbidden' });
  const r = await fetch(`${SUPABASE_URL}/rest/v1/project_members?project_id=eq.${project_id}&user_id=eq.${user_id}`, { method: 'DELETE', headers: sbHeaders(SERVICE_KEY) });
  if (!r.ok && r.status !== 204) { const detail = await r.text().catch(() => ''); return res.status(502).json({ error: 'remove_member_failed', status: r.status, detail: detail.slice(0, 400) }); }
  return res.status(200).json({ ok: true });
}
// GET (dono/admin do projeto) — busca perfis JÁ cadastrados na plataforma (tabela profiles),
// p/ o autocomplete de convite. NUNCA consulta o GitHub. Gated por ownership pra não expor
// o diretório de usuários a qualquer sessão.
async function searchProfiles(req, res) {
  const { SUPABASE_URL, SERVICE_KEY } = env();
  if (!SUPABASE_URL || !SERVICE_KEY) return res.status(500).json({ error: 'supabase_env_missing' });
  const uid = await userIdFromToken(req);
  if (!uid) return res.status(401).json({ error: 'unauthorized' });
  const project_id = String((req.query && req.query.project_id) || '').trim();
  if (!UUID_RE.test(project_id)) return res.status(400).json({ error: 'project_id_invalid' });
  if (!(await ownsProject(uid, project_id)) && !(await isPlatformAdmin(uid))) return res.status(403).json({ error: 'forbidden' });
  // sanitiza: remove caracteres com significado em filtros PostgREST (vírgula, parênteses, wildcards)
  const q = String((req.query && req.query.q) || '').replace(/[(),*%\\]/g, '').trim();
  if (q.length < 1) return res.status(200).json({ ok: true, profiles: [] });
  const pattern = `*${q}*`;
  const orVal = `(login_github.ilike.${pattern},name.ilike.${pattern})`;
  const url = `${SUPABASE_URL}/rest/v1/profiles?or=${encodeURIComponent(orVal)}&select=id,login_github,name,avatar_url&order=login_github.asc&limit=8`;
  const r = await fetch(url, { headers: sbHeaders(SERVICE_KEY) });
  if (!r.ok) return res.status(502).json({ error: 'search_failed', status: r.status });
  const rows = await r.json().catch(() => []);
  return res.status(200).json({ ok: true, profiles: Array.isArray(rows) ? rows : [] });
}

// ════════════════════════════ convites por e-mail ═══════════════════════════
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
function makeInviteToken() {
  try { return require('crypto').randomBytes(24).toString('hex'); }
  catch (_) { return Date.now().toString(36) + Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2); }
}
// upsert de membro (usado pelo convite quando o e-mail já é cadastrado e no accept)
async function upsertMember(project_id, user_id, role, invited_by) {
  const { SUPABASE_URL, SERVICE_KEY } = env();
  const ex = await fetch(`${SUPABASE_URL}/rest/v1/project_members?project_id=eq.${project_id}&user_id=eq.${user_id}&select=id&limit=1`, { headers: sbHeaders(SERVICE_KEY) });
  const exrows = await ex.json().catch(() => []);
  const existing = Array.isArray(exrows) && exrows[0];
  if (existing) return fetch(`${SUPABASE_URL}/rest/v1/project_members?id=eq.${existing.id}`, { method: 'PATCH', headers: { ...sbHeaders(SERVICE_KEY), Prefer: 'return=representation' }, body: JSON.stringify({ role }) });
  return fetch(`${SUPABASE_URL}/rest/v1/project_members`, { method: 'POST', headers: { ...sbHeaders(SERVICE_KEY), Prefer: 'return=representation' }, body: JSON.stringify({ project_id, user_id, role, invited_by }) });
}
// POST (dono) — convida por e-mail: se já cadastrado vira membro; senão cria convite pendente.
async function createInvite(req, res) {
  const { SUPABASE_URL, SERVICE_KEY } = env();
  if (!SUPABASE_URL || !SERVICE_KEY) return res.status(500).json({ error: 'supabase_env_missing' });
  const uid = await userIdFromToken(req);
  if (!uid) return res.status(401).json({ error: 'unauthorized' });
  const b = readBody(req);
  const project_id = String(b.project_id || '').trim();
  if (!UUID_RE.test(project_id)) return res.status(400).json({ error: 'project_id_invalid' });
  if (!(await ownsProject(uid, project_id)) && !(await isPlatformAdmin(uid))) return res.status(403).json({ error: 'forbidden', detail: 'Só o dono do projeto convida membros.' });
  const email = String(b.email || '').trim().toLowerCase();
  if (!EMAIL_RE.test(email)) return res.status(400).json({ error: 'email_invalid' });
  const role = String(b.role || 'editor');
  if (!PROJECT_ROLES.includes(role)) return res.status(400).json({ error: 'role_invalid' });
  // já tem conta? adiciona direto como membro
  const pf = await fetch(`${SUPABASE_URL}/rest/v1/profiles?email=eq.${encodeURIComponent(email)}&select=id&limit=1`, { headers: sbHeaders(SERVICE_KEY) });
  const pfrows = await pf.json().catch(() => []);
  const prof = Array.isArray(pfrows) && pfrows[0];
  if (prof) {
    const r = await upsertMember(project_id, prof.id, role, uid);
    if (!r.ok) { const d = await r.text().catch(() => ''); return res.status(502).json({ error: 'add_member_failed', detail: d.slice(0, 300) }); }
    return res.status(200).json({ ok: true, added: true, user_id: prof.id });
  }
  // convite pendente: reaproveita o existente (pending) ou cria novo
  const exq = await fetch(`${SUPABASE_URL}/rest/v1/project_invites?project_id=eq.${project_id}&email=eq.${encodeURIComponent(email)}&status=eq.pending&select=id,token&limit=1`, { headers: sbHeaders(SERVICE_KEY) });
  const exrows = await exq.json().catch(() => []);
  const existing = Array.isArray(exrows) && exrows[0];
  if (existing) {
    await fetch(`${SUPABASE_URL}/rest/v1/project_invites?id=eq.${existing.id}`, { method: 'PATCH', headers: sbHeaders(SERVICE_KEY), body: JSON.stringify({ role }) }).catch(() => {});
    return res.status(200).json({ ok: true, invited: true, token: existing.token });
  }
  const token = makeInviteToken();
  const r = await fetch(`${SUPABASE_URL}/rest/v1/project_invites`, { method: 'POST', headers: { ...sbHeaders(SERVICE_KEY), Prefer: 'return=representation' }, body: JSON.stringify({ project_id, email, role, token, invited_by: uid }) });
  if (!r.ok) { const d = await r.text().catch(() => ''); return res.status(502).json({ error: 'invite_failed', status: r.status, detail: d.slice(0, 300) }); }
  return res.status(200).json({ ok: true, invited: true, token });
}
// GET (dono) — convites pendentes do projeto.
async function listInvites(req, res) {
  const { SUPABASE_URL, SERVICE_KEY } = env();
  if (!SUPABASE_URL || !SERVICE_KEY) return res.status(500).json({ error: 'supabase_env_missing' });
  const uid = await userIdFromToken(req);
  if (!uid) return res.status(401).json({ error: 'unauthorized' });
  const project_id = String((req.query && req.query.project_id) || '').trim();
  if (!UUID_RE.test(project_id)) return res.status(400).json({ error: 'project_id_invalid' });
  if (!(await ownsProject(uid, project_id)) && !(await isPlatformAdmin(uid))) return res.status(403).json({ error: 'forbidden' });
  const r = await fetch(`${SUPABASE_URL}/rest/v1/project_invites?project_id=eq.${project_id}&status=eq.pending&select=id,email,role,token,created_at&order=created_at.desc`, { headers: sbHeaders(SERVICE_KEY) });
  if (!r.ok) return res.status(502).json({ error: 'list_invites_failed', status: r.status });
  const rows = await r.json().catch(() => []);
  return res.status(200).json({ ok: true, invites: Array.isArray(rows) ? rows : [] });
}
// POST (dono) — revoga um convite pendente.
async function revokeInvite(req, res) {
  const { SUPABASE_URL, SERVICE_KEY } = env();
  if (!SUPABASE_URL || !SERVICE_KEY) return res.status(500).json({ error: 'supabase_env_missing' });
  const uid = await userIdFromToken(req);
  if (!uid) return res.status(401).json({ error: 'unauthorized' });
  const b = readBody(req);
  const project_id = String(b.project_id || '').trim();
  const invite_id = String(b.invite_id || '').trim();
  if (!UUID_RE.test(project_id) || !UUID_RE.test(invite_id)) return res.status(400).json({ error: 'ids_invalid' });
  if (!(await ownsProject(uid, project_id)) && !(await isPlatformAdmin(uid))) return res.status(403).json({ error: 'forbidden' });
  const r = await fetch(`${SUPABASE_URL}/rest/v1/project_invites?id=eq.${invite_id}&project_id=eq.${project_id}`, { method: 'PATCH', headers: sbHeaders(SERVICE_KEY), body: JSON.stringify({ status: 'revoked' }) });
  if (!r.ok && r.status !== 204) { const d = await r.text().catch(() => ''); return res.status(502).json({ error: 'revoke_failed', detail: d.slice(0, 300) }); }
  return res.status(200).json({ ok: true });
}
// GET (SEM auth — o token é a credencial) — dados do convite p/ a tela de aceite.
async function inviteInfo(req, res) {
  const { SUPABASE_URL, SERVICE_KEY } = env();
  if (!SUPABASE_URL || !SERVICE_KEY) return res.status(500).json({ error: 'supabase_env_missing' });
  const token = String((req.query && req.query.token) || '').trim();
  if (!token || token.length < 8) return res.status(400).json({ error: 'token_invalid' });
  const r = await fetch(`${SUPABASE_URL}/rest/v1/project_invites?token=eq.${encodeURIComponent(token)}&select=role,status,email,project_id&limit=1`, { headers: sbHeaders(SERVICE_KEY) });
  const rows = await r.json().catch(() => []);
  const inv = Array.isArray(rows) && rows[0];
  if (!inv) return res.status(404).json({ ok: false, error: 'not_found' });
  let project = null;
  const pr = await fetch(`${SUPABASE_URL}/rest/v1/ds_projects?id=eq.${inv.project_id}&select=name,slug&limit=1`, { headers: sbHeaders(SERVICE_KEY) });
  const prows = await pr.json().catch(() => []);
  if (Array.isArray(prows) && prows[0]) project = prows[0];
  return res.status(200).json({ ok: true, status: inv.status, role: inv.role, email: inv.email, project });
}
// POST (autenticado) — aceita o convite: cria o vínculo em project_members e marca aceito.
async function acceptInvite(req, res) {
  const { SUPABASE_URL, SERVICE_KEY } = env();
  if (!SUPABASE_URL || !SERVICE_KEY) return res.status(500).json({ error: 'supabase_env_missing' });
  const uid = await userIdFromToken(req);
  if (!uid) return res.status(401).json({ error: 'unauthorized', detail: 'Entre para aceitar o convite.' });
  const b = readBody(req);
  const token = String(b.token || '').trim();
  if (!token || token.length < 8) return res.status(400).json({ error: 'token_invalid' });
  const q = await fetch(`${SUPABASE_URL}/rest/v1/project_invites?token=eq.${encodeURIComponent(token)}&select=id,project_id,role,status&limit=1`, { headers: sbHeaders(SERVICE_KEY) });
  const rows = await q.json().catch(() => []);
  const inv = Array.isArray(rows) && rows[0];
  if (!inv) return res.status(404).json({ error: 'not_found', detail: 'Convite não encontrado.' });
  if (inv.status !== 'pending') return res.status(410).json({ error: 'not_pending', detail: 'Este convite já foi usado ou revogado.' });
  const r = await upsertMember(inv.project_id, uid, inv.role, null);
  if (!r.ok) { const d = await r.text().catch(() => ''); return res.status(502).json({ error: 'join_failed', detail: d.slice(0, 300) }); }
  await fetch(`${SUPABASE_URL}/rest/v1/project_invites?id=eq.${inv.id}`, { method: 'PATCH', headers: sbHeaders(SERVICE_KEY), body: JSON.stringify({ status: 'accepted', accepted_by: uid, accepted_at: new Date().toISOString() }) }).catch(() => {});
  let project = { id: inv.project_id };
  const pr = await fetch(`${SUPABASE_URL}/rest/v1/ds_projects?id=eq.${inv.project_id}&select=id,name,slug&limit=1`, { headers: sbHeaders(SERVICE_KEY) });
  const prows = await pr.json().catch(() => []);
  if (Array.isArray(prows) && prows[0]) project = prows[0];
  return res.status(200).json({ ok: true, project, role: inv.role });
}

// ════════════════════════════ auth e-mail/senha (proxy GoTrue) ══════════════
// O Supabase Auth (GoTrue) faz signup/login/confirmação/reset nativamente e envia
// os e-mails de confirmação e redefinição. Estas ações são proxy server-side
// (usam ANON_KEY do env). Não exigem sessão — SÃO a autenticação.
function gotrueMsg(j) { return (j && (j.msg || j.error_description || j.message || j.error || j.error_code)) || 'Erro de autenticação.'; }
async function gotrue(path, init) {
  const { SUPABASE_URL, ANON_KEY } = env();
  const headers = { 'Content-Type': 'application/json', apikey: ANON_KEY, ...((init && init.headers) || {}) };
  return fetch(`${SUPABASE_URL}/auth/v1${path}`, { ...(init || {}), headers });
}
async function authSignup(req, res) {
  const { SUPABASE_URL } = env();
  if (!SUPABASE_URL) return res.status(500).json({ error: 'supabase_env_missing' });
  const b = readBody(req);
  const email = String(b.email || '').trim().toLowerCase();
  const password = String(b.password || '');
  const name = String(b.name || '').trim();
  const redirect_to = String(b.redirect_to || '').trim();
  if (!EMAIL_RE.test(email)) return res.status(400).json({ error: 'email_invalid', detail: 'E-mail inválido.' });
  if (password.length < 8) return res.status(400).json({ error: 'weak_password', detail: 'A senha precisa de ao menos 8 caracteres.' });
  const path = '/signup' + (redirect_to ? '?redirect_to=' + encodeURIComponent(redirect_to) : '');
  const r = await gotrue(path, { method: 'POST', body: JSON.stringify({ email, password, data: name ? { name, full_name: name } : {} }) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) return res.status(r.status).json({ error: 'signup_failed', detail: gotrueMsg(j), code: j.code || j.error_code || j.error });
  if (j.access_token) return res.status(200).json({ ok: true, session: { access_token: j.access_token, refresh_token: j.refresh_token } });
  return res.status(200).json({ ok: true, needsConfirmation: true, email });
}
async function authLogin(req, res) {
  const { SUPABASE_URL } = env();
  if (!SUPABASE_URL) return res.status(500).json({ error: 'supabase_env_missing' });
  const b = readBody(req);
  const email = String(b.email || '').trim().toLowerCase();
  const password = String(b.password || '');
  if (!EMAIL_RE.test(email) || !password) return res.status(400).json({ error: 'bad_request', detail: 'Informe e-mail e senha.' });
  const r = await gotrue('/token?grant_type=password', { method: 'POST', body: JSON.stringify({ email, password }) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) return res.status(r.status).json({ error: 'login_failed', detail: gotrueMsg(j), code: j.error || j.error_code });
  return res.status(200).json({ ok: true, session: { access_token: j.access_token, refresh_token: j.refresh_token } });
}
async function authRecover(req, res) {
  const { SUPABASE_URL } = env();
  if (!SUPABASE_URL) return res.status(500).json({ error: 'supabase_env_missing' });
  const b = readBody(req);
  const email = String(b.email || '').trim().toLowerCase();
  const redirect_to = String(b.redirect_to || '').trim();
  if (EMAIL_RE.test(email)) {
    const path = '/recover' + (redirect_to ? '?redirect_to=' + encodeURIComponent(redirect_to) : '');
    await gotrue(path, { method: 'POST', body: JSON.stringify({ email }) }).catch(() => {});
  }
  return res.status(200).json({ ok: true }); // sempre ok (anti-enumeração de e-mail)
}
async function authUpdatePassword(req, res) {
  const { SUPABASE_URL } = env();
  if (!SUPABASE_URL) return res.status(500).json({ error: 'supabase_env_missing' });
  const b = readBody(req);
  const access_token = String(b.access_token || '');
  const password = String(b.password || '');
  if (!access_token) return res.status(401).json({ error: 'no_token', detail: 'Link inválido ou expirado.' });
  if (password.length < 8) return res.status(400).json({ error: 'weak_password', detail: 'A senha precisa de ao menos 8 caracteres.' });
  const r = await gotrue('/user', { method: 'PUT', headers: { Authorization: 'Bearer ' + access_token }, body: JSON.stringify({ password }) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) return res.status(r.status).json({ error: 'update_failed', detail: gotrueMsg(j) });
  return res.status(200).json({ ok: true });
}

// ════════════════════════════ ação: save-component ══════════════════════════
async function saveComponent(req, res) {
  const { SUPABASE_URL, SERVICE_KEY } = env();
  if (!SUPABASE_URL || !SERVICE_KEY) return res.status(500).json({ error: 'supabase_env_missing' });
  const SB = `${SUPABASE_URL}/rest/v1`;
  const H = sbHeaders(SERVICE_KEY);

  const str = (v, max) => (v == null ? null : String(v).slice(0, max || 200000));
  const toInt = (v) => (Number.isFinite(+v) ? Math.max(0, Math.round(+v)) : 0);
  const num = (v) => (Number.isFinite(+v) ? +(+v).toFixed(6) : 0);
  const jsn = (v, fb) => (v === undefined ? fb : v);

  const b = readBody(req);
  const project_id = String(b.project_id || '').trim();
  const name = String(b.name || '').trim();
  if (!UUID_RE.test(project_id)) return res.status(400).json({ error: 'project_id_invalid', detail: 'Cole o project_id do projeto (visível ao criar o projeto na plataforma).' });
  if (!name) return res.status(400).json({ error: 'name_required' });

  const pr = await fetch(`${SB}/ds_projects?id=eq.${project_id}&select=id,owner_id`, { headers: H });
  if (!pr.ok) return res.status(502).json({ error: 'project_lookup_failed', status: pr.status });
  const prj = await pr.json().catch(() => []);
  if (!Array.isArray(prj) || !prj.length) return res.status(404).json({ error: 'project_not_found', detail: 'Nenhum projeto com esse id.' });

  const uid = await userIdFromToken(req);   // preenche created_by/updated_by quando logado
  let version = '1.0.0';
  const compFields = {
    display_name: str(b.display_name, 200),
    category: str(b.category, 120),
    description: str(b.description, 2000),
    tsx_code: str(b.tsx_code, 600000),
    css_code: str(b.css_code, 400000),
    html_preview: str(b.html_preview, 400000),
    figma_node_id: str(b.figma_node_id, 200),
    figma_file_key: str(b.figma_file_key, 200),
    png_base64: str(b.png_base64, 4000000),
    svg_source: str(b.svg_source, 1000000),
    variants: jsn(b.variants, []),
    tokens: jsn(b.tokens, []),
    anatomy: jsn(b.anatomy, {}),
    docs: jsn(b.docs, {}),
    is_interactive: !!b.is_interactive,
    width: b.width != null ? toInt(b.width) : null,
    height: b.height != null ? toInt(b.height) : null,
    variant_count: b.variant_count != null ? toInt(b.variant_count) : (Array.isArray(b.variants) ? b.variants.length : 0),
    tags: Array.isArray(b.tags) ? b.tags.map(t => String(t).slice(0, 60)).slice(0, 30) : undefined,
    updated_at: new Date().toISOString(),
    updated_by: uid || undefined,
  };
  Object.keys(compFields).forEach(k => compFields[k] === undefined && delete compFields[k]);

  const found = await fetch(`${SB}/ds_components?project_id=eq.${project_id}&name=eq.${encodeURIComponent(name)}&select=id,version`, { headers: H });
  if (!found.ok) return res.status(502).json({ error: 'component_lookup_failed', status: found.status });
  const existing = await found.json().catch(() => []);

  let component_id;
  if (Array.isArray(existing) && existing.length) {
    component_id = existing[0].id;
    version = bumpPatch(existing[0].version);
    compFields.version = version;
    const upd = await fetch(`${SB}/ds_components?id=eq.${component_id}`, {
      method: 'PATCH', headers: { ...H, Prefer: 'return=minimal' }, body: JSON.stringify(compFields),
    });
    if (!upd.ok) { const d = await upd.text().catch(() => ''); return res.status(502).json({ error: 'component_update_failed', status: upd.status, detail: d.slice(0, 400) }); }
  } else {
    version = '1.0.0';
    compFields.version = version;
    const ins = await fetch(`${SB}/ds_components`, {
      method: 'POST', headers: { ...H, Prefer: 'return=representation' }, body: JSON.stringify({ project_id, name, created_by: uid || undefined, ...compFields }),
    });
    if (!ins.ok) { const d = await ins.text().catch(() => ''); return res.status(502).json({ error: 'component_insert_failed', status: ins.status, detail: d.slice(0, 400) }); }
    const row = await ins.json().catch(() => null);
    const createdC = Array.isArray(row) ? row[0] : row;
    component_id = createdC && createdC.id;
  }
  if (!component_id) return res.status(502).json({ error: 'no_component_id' });

  const versionRow = {
    component_id, version,
    created_by: uid || undefined,
    tsx_code: str(b.tsx_code, 600000),
    css_code: str(b.css_code, 400000),
    changelog: str(b.changelog, 8000),
    diff_summary: str(b.diff_summary, 8000),
    model_used: str(b.model_used, 80),
    tokens_in: toInt(b.tokens_in),
    tokens_out: toInt(b.tokens_out),
    cost_usd: num(b.cost_usd),
    duration_ms: toInt(b.duration_ms),
    variants: jsn(b.variants, []),
    tokens: jsn(b.tokens, []),
    docs: jsn(b.docs, {}),
  };
  const ver = await fetch(`${SB}/ds_component_versions`, {
    method: 'POST', headers: { ...H, Prefer: 'return=minimal' }, body: JSON.stringify(versionRow),
  });
  const version_logged = ver.ok;
  const version_detail = ver.ok ? null : (await ver.text().catch(() => '')).slice(0, 300);

  fetch(`${SB}/ds_projects?id=eq.${project_id}`, {
    method: 'PATCH', headers: { ...H, Prefer: 'return=minimal' },
    body: JSON.stringify({ last_sync_at: new Date().toISOString(), updated_at: new Date().toISOString() }),
  }).catch(() => {});

  return res.status(200).json({ ok: true, component_id, version, version_logged, version_detail });
}

// ════════════════════════════ ação: log-generation ══════════════════════════
async function logGeneration(req, res) {
  const { SUPABASE_URL, SERVICE_KEY, DEFAULT_PROJECT_ID, DEFAULT_USER_ID } = env();
  if (!SUPABASE_URL || !SERVICE_KEY) return res.status(500).json({ error: 'supabase_env_missing' });

  const b = readBody(req);
  if (!b.component_name) return res.status(400).json({ error: 'component_name_required' });

  const project_id = b.project_id || DEFAULT_PROJECT_ID;
  const user_id = b.user_id || (await userIdFromToken(req)) || DEFAULT_USER_ID;
  if (!project_id || !user_id) {
    return res.status(400).json({ error: 'missing_required_ids', detail: 'project_id e user_id são obrigatórios (envie no payload ou defina DEFAULT_* no Vercel).' });
  }

  const toInt = (v) => (Number.isFinite(+v) ? Math.max(0, Math.round(+v)) : 0);
  const row = {
    project_id, user_id,
    component_name: String(b.component_name).slice(0, 200),
    model_used: b.model_used ? String(b.model_used).slice(0, 80) : null,
    tokens_in: toInt(b.tokens_in),
    tokens_out: toInt(b.tokens_out),
    cost_usd: Number.isFinite(+b.cost_usd) ? +(+b.cost_usd).toFixed(6) : 0,
    duration_ms: toInt(b.duration_ms),
    status: b.status ? String(b.status).slice(0, 40) : 'success',
    error_message: b.error_message ? String(b.error_message).slice(0, 500) : null,
    metadata: b.metadata ?? null,
  };
  const r = await fetch(`${SUPABASE_URL}/rest/v1/ds_generations`, {
    method: 'POST', headers: { ...sbHeaders(SERVICE_KEY), Prefer: 'return=minimal' }, body: JSON.stringify(row),
  });
  if (!r.ok) { const d = await r.text().catch(() => ''); return res.status(502).json({ error: 'supabase_insert_failed', status: r.status, detail: d.slice(0, 400) }); }
  return res.status(200).json({ ok: true });
}

// ════════════════════════════ ação: project (leitura) ═══════════════════════
// Resolve um projeto pelo id — usado pelo plugin pra mostrar o nome do projeto
// conectado (em vez de um uuid cru) e validar o id colado. É GET (read-only).
async function getProject(req, res) {
  const { SUPABASE_URL, SERVICE_KEY } = env();
  if (!SUPABASE_URL || !SERVICE_KEY) return res.status(500).json({ error: 'supabase_env_missing' });
  const id = String((req.query && req.query.project_id) || '').trim();
  if (!UUID_RE.test(id)) return res.status(400).json({ error: 'project_id_invalid' });
  const cols = 'id,name,slug,visibility,component_count,variant_count,token_count,repo_full_name,vercel_url';
  const r = await fetch(`${SUPABASE_URL}/rest/v1/ds_projects?id=eq.${id}&select=${cols}`, { headers: sbHeaders(SERVICE_KEY) });
  if (!r.ok) return res.status(502).json({ error: 'lookup_failed', status: r.status });
  const rows = await r.json().catch(() => []);
  if (!Array.isArray(rows) || !rows.length) return res.status(404).json({ error: 'project_not_found' });
  return res.status(200).json({ ok: true, project: rows[0] });
}

// ════════════════════════════ auth do plugin (poll-based) ════════════════════
// O iframe do plugin (origin null) NÃO recebe o redirect do OAuth. Padrão Figma:
//  1) plugin abre o navegador em /plugin-auth.html?code=XYZ (figma.openExternal)
//  2) página loga via Supabase GitHub e POSTa o token aqui (auth-store) sob o code
//  3) plugin faz polling (auth-poll) até o token chegar → guarda + mostra o perfil
// O code é alto-entropia, single-use (claimed) e expira em 10 min. auth-store valida
// o token contra o Supabase antes de gravar; só sessão real é aceita.
const PLUGIN_AUTH_TTL_MS = 10 * 60 * 1000;

// GET — a página de login precisa do url+anon (anon é público) pra iniciar o supabase-js
async function authConfig(req, res) {
  const { SUPABASE_URL, ANON_KEY } = env();
  if (!SUPABASE_URL || !ANON_KEY) return res.status(500).json({ error: 'supabase_env_missing' });
  return res.status(200).json({ ok: true, supabaseUrl: SUPABASE_URL, anonKey: ANON_KEY });
}

// POST — a página entrega o token; validamos e guardamos sob o code + perfil
async function authStore(req, res) {
  const { SUPABASE_URL, SERVICE_KEY, ANON_KEY } = env();
  if (!SUPABASE_URL || !SERVICE_KEY) return res.status(500).json({ error: 'supabase_env_missing' });
  const b = readBody(req);
  const code = String(b.code || '').trim();
  const access_token = String(b.access_token || '').trim();
  const refresh_token = String(b.refresh_token || '').trim();
  if (code.length < 16) return res.status(400).json({ error: 'code_invalid' });
  if (!access_token) return res.status(400).json({ error: 'token_missing' });
  try {
    const cutoff = new Date(Date.now() - PLUGIN_AUTH_TTL_MS).toISOString();
    await fetch(`${SUPABASE_URL}/rest/v1/plugin_auth?created_at=lt.${cutoff}`, { method: 'DELETE', headers: { ...sbHeaders(SERVICE_KEY), Prefer: 'return=minimal' } });
  } catch (_) {} // purga oportunista (sem depender de cron)

  const who = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: { apikey: ANON_KEY, Authorization: `Bearer ${access_token}` } });
  if (!who.ok) return res.status(401).json({ error: 'token_invalid' });
  const u = await who.json().catch(() => null);
  if (!u || !u.id) return res.status(401).json({ error: 'token_invalid' });
  const m = u.user_metadata || {};
  const profile = {
    id: u.id,
    email: u.email || null,
    name: m.full_name || m.name || m.user_name || (u.email ? u.email.split('@')[0] : 'Usuário'),
    avatar_url: m.avatar_url || null,
    user_name: m.user_name || m.preferred_username || null,
  };
  try { profile.platform_admin = await isPlatformAdmin(u.id); } catch (_) { profile.platform_admin = false; }
  profile.role = profile.platform_admin ? 'Platform Admin' : 'Membro';

  const r = await fetch(`${SUPABASE_URL}/rest/v1/plugin_auth?on_conflict=code`, {
    method: 'POST',
    headers: { ...sbHeaders(SERVICE_KEY), Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify({ code, access_token, refresh_token, profile, claimed: false, created_at: new Date().toISOString() }),
  });
  if (!r.ok) {
    const d = await r.text().catch(() => '');
    let hint = '';
    if (r.status === 404 || /does not exist|could not find|relation/i.test(d)) hint = 'A tabela plugin_auth não existe — rode o SQL de criação no Supabase.';
    else if (r.status === 401 || r.status === 403 || /row-level security|permission|policy/i.test(d)) hint = 'Bloqueio de RLS/permissão ao gravar em plugin_auth (a service_role deveria ignorar RLS — confira a env SUPABASE_SERVICE_ROLE_KEY).';
    return res.status(502).json({ error: 'store_failed', status: r.status, hint, detail: d.slice(0, 300) });
  }
  return res.status(200).json({ ok: true, profile });
}

// GET — o plugin pergunta pelo code; quando pronto, devolve token+perfil e marca claimed
async function authPoll(req, res) {
  const { SUPABASE_URL, SERVICE_KEY } = env();
  if (!SUPABASE_URL || !SERVICE_KEY) return res.status(500).json({ error: 'supabase_env_missing' });
  const code = String((req.query && req.query.code) || '').trim();
  if (code.length < 16) return res.status(400).json({ error: 'code_invalid' });
  const sel = 'access_token,refresh_token,profile,claimed,created_at';
  const r = await fetch(`${SUPABASE_URL}/rest/v1/plugin_auth?code=eq.${encodeURIComponent(code)}&select=${sel}`, { headers: sbHeaders(SERVICE_KEY) });
  if (!r.ok) return res.status(502).json({ error: 'poll_failed', status: r.status });
  const rows = await r.json().catch(() => []);
  if (!Array.isArray(rows) || !rows.length) return res.status(200).json({ ready: false });
  const row = rows[0];
  if (row.created_at && (Date.now() - new Date(row.created_at).getTime() > PLUGIN_AUTH_TTL_MS)) return res.status(200).json({ ready: false, expired: true });
  if (row.claimed) return res.status(200).json({ ready: false, claimed: true });
  if (!row.access_token) return res.status(200).json({ ready: false });
  // delete-on-claim: entrega os tokens 1x e apaga a linha (não deixa segredo em repouso)
  await fetch(`${SUPABASE_URL}/rest/v1/plugin_auth?code=eq.${encodeURIComponent(code)}`, {
    method: 'DELETE', headers: { ...sbHeaders(SERVICE_KEY), Prefer: 'return=minimal' },
  }).catch(() => {});
  return res.status(200).json({ ready: true, access_token: row.access_token, refresh_token: row.refresh_token, profile: row.profile });
}

// GET — lista os projetos da conta logada (owner_id = user do token). Usado pelo
// seletor de projetos do plugin (substitui colar o id na mão).
async function listProjects(req, res) {
  const { SUPABASE_URL, SERVICE_KEY } = env();
  if (!SUPABASE_URL || !SERVICE_KEY) return res.status(500).json({ error: 'supabase_env_missing' });
  const uid = await userIdFromToken(req);
  if (!uid) return res.status(401).json({ error: 'unauthorized', detail: 'Sessão ausente ou expirada — entre novamente.' });
  const cols = 'id,name,slug,visibility,component_count,variant_count,updated_at,repo_full_name,vercel_url';
  // projetos do dono
  const ow = await fetch(`${SUPABASE_URL}/rest/v1/ds_projects?owner_id=eq.${uid}&select=${cols}&order=updated_at.desc`, { headers: sbHeaders(SERVICE_KEY) });
  if (!ow.ok) return res.status(502).json({ error: 'list_failed', status: ow.status });
  const owned = await ow.json().catch(() => []);
  const byId = new Map((Array.isArray(owned) ? owned : []).map(p => [p.id, p]));
  // + projetos onde é MEMBRO (project_members), excluindo os que já é dono
  try {
    const mm = await fetch(`${SUPABASE_URL}/rest/v1/project_members?user_id=eq.${uid}&select=project_id`, { headers: sbHeaders(SERVICE_KEY) });
    if (mm.ok) {
      const mem = await mm.json().catch(() => []);
      const ids = [...new Set((Array.isArray(mem) ? mem : []).map(m => m.project_id))].filter(id => id && !byId.has(id));
      if (ids.length) {
        const inList = ids.map(id => `"${id}"`).join(',');
        const mp = await fetch(`${SUPABASE_URL}/rest/v1/ds_projects?id=in.(${inList})&select=${cols}`, { headers: sbHeaders(SERVICE_KEY) });
        if (mp.ok) { const mprows = await mp.json().catch(() => []); (Array.isArray(mprows) ? mprows : []).forEach(p => { if (!byId.has(p.id)) byId.set(p.id, p); }); }
      }
    }
  } catch (_) {}
  const all = [...byId.values()].sort((a, b) => String(b.updated_at || '').localeCompare(String(a.updated_at || '')));
  // contagem REAL a partir de ds_components — as colunas denormalizadas em ds_projects não são mantidas
  try {
    const ids = all.map(p => p.id).filter(Boolean);
    if (ids.length) {
      const inList = ids.map(id => `"${id}"`).join(',');
      const cr = await fetch(`${SUPABASE_URL}/rest/v1/ds_components?project_id=in.(${inList})&select=project_id,variant_count`, { headers: sbHeaders(SERVICE_KEY) });
      if (cr.ok) {
        const comps = await cr.json().catch(() => []);
        const cnt = {}, vsum = {};
        (Array.isArray(comps) ? comps : []).forEach(c => {
          const pid = c.project_id;
          cnt[pid] = (cnt[pid] || 0) + 1;
          vsum[pid] = (vsum[pid] || 0) + (Number(c.variant_count) || 0);
        });
        all.forEach(p => { p.component_count = cnt[p.id] || 0; p.variant_count = vsum[p.id] || 0; });
      }
    }
  } catch (_) { /* se a contagem falhar, mantém as colunas existentes */ }
  return res.status(200).json({ ok: true, projects: all });
}

// ════════════════════════════ ação: list-components ═════════════════════════
// GET, token — componentes que o plugin gravou num projeto (ds_components do dono).
// NUNCA seleciona tsx/css/png (pesados): só metadados pra a plataforma listar.
// ─── leitura de projeto: dono (com token) OU público (sem token) ────────────
// Centraliza o gate de leitura. Busca o projeto (owner_id + visibility) e libera
// se: (a) há sessão e é o dono, ou (b) visibility === 'public' (acesso anônimo).
// Em caso de negação, ENVIA a resposta de erro e retorna null (o chamador só dá return).
async function resolveProjectRead(req, res, project_id) {
  const { SUPABASE_URL, SERVICE_KEY } = env();
  const pr = await fetch(`${SUPABASE_URL}/rest/v1/ds_projects?id=eq.${project_id}&select=id,owner_id,visibility`, { headers: sbHeaders(SERVICE_KEY) });
  if (!pr.ok) { res.status(502).json({ error: 'project_lookup_failed', status: pr.status }); return null; }
  const prj = await pr.json().catch(() => []);
  if (!Array.isArray(prj) || !prj.length) { res.status(404).json({ error: 'project_not_found' }); return null; }
  const project = prj[0];
  const isPublic = String(project.visibility || '') === 'public';
  const uid = await userIdFromToken(req);
  const isOwner = !!uid && String(project.owner_id) === String(uid);
  if (isOwner || isPublic) return { project, uid, isOwner, isPublic };
  if (uid) { res.status(403).json({ error: 'forbidden', detail: 'Sem acesso a este projeto.' }); return null; }
  res.status(401).json({ error: 'unauthorized', detail: 'Projeto privado — entre para acessar.' });
  return null;
}

async function listComponents(req, res) {
  const { SUPABASE_URL, SERVICE_KEY } = env();
  if (!SUPABASE_URL || !SERVICE_KEY) return res.status(500).json({ error: 'supabase_env_missing' });
  const project_id = String((req.query && req.query.project_id) || '').trim();
  if (!UUID_RE.test(project_id)) return res.status(400).json({ error: 'project_id_invalid' });
  // leitura: dono (com token) OU projeto público (anônimo)
  const acc = await resolveProjectRead(req, res, project_id);
  if (!acc) return; // resposta de erro já enviada
  const cols = 'id,name,display_name,category,version,variant_count,is_interactive,updated_at';
  const r = await fetch(`${SUPABASE_URL}/rest/v1/ds_components?project_id=eq.${project_id}&select=${cols}&order=updated_at.desc`, { headers: sbHeaders(SERVICE_KEY) });
  if (!r.ok) return res.status(502).json({ error: 'list_failed', status: r.status });
  const rows = await r.json().catch(() => []);
  return res.status(200).json({ ok: true, components: Array.isArray(rows) ? rows : [] });
}

// ════════════════════════════ ação: list-tokens ═════════════════════════════
// GET, token — todos os tokens (foundations) dos componentes de um projeto do dono.
// Seleciona só name+tokens; o cliente agrega por categoria. Valida ownership.
// ═══════════════════════ Deploy · template canônico (server-side) ══════════════
// O site publicado por projeto usa o src/platform.tsx canônico do repo CORE como
// template. Ele é servido AQUI pelo servidor (com o GITHUB_DEPLOY_PAT), pra que o
// PAT do cliente precise de escrita SÓ no repo de destino — nunca leitura no core.
const CORE_TEMPLATE_REPO = process.env.CORE_TEMPLATE_REPO || 'jasonpereirax/ds-studio';
async function ghGetFileRaw(token, repoFull, path) {
  const url = 'https://api.github.com/repos/' + repoFull + '/contents/' + path;
  const H = { Accept: 'application/vnd.github.raw', 'User-Agent': 'ds-studio' };
  if (token) H.Authorization = 'Bearer ' + token;
  const r = await fetch(url, { headers: H });
  if (!r.ok) return { ok: false, status: r.status };
  const txt = await r.text().catch(() => '');
  return { ok: true, status: 200, text: txt };
}
// GET/POST /api/platform?action=get-template  (Authorization: Bearer <JWT de sessão>)
// Devolve o src/platform.tsx canônico do core. Exige sessão válida (não é anônimo).
async function getTemplateAction(req, res) {
  const uid = await userIdFromToken(req);
  if (!uid) return res.status(401).json({ error: 'missing_token', detail: 'Faça login antes de publicar.' });
  const PAT = process.env.GITHUB_DEPLOY_PAT;
  if (!PAT) return res.status(500).json({ error: 'no_deploy_token', detail: 'Configure a env var GITHUB_DEPLOY_PAT no Vercel (Contents: Read no repo core).' });
  for (const path of ['src/viewer.tsx', 'viewer.tsx']) {
    try {
      const f = await ghGetFileRaw(PAT, CORE_TEMPLATE_REPO, path);
      if (f.ok && f.text && f.text.length > 500) {
        return res.status(200).json({ ok: true, path, repo: CORE_TEMPLATE_REPO, source: f.text });
      }
    } catch (_) { /* tenta o próximo caminho */ }
  }
  return res.status(502).json({ error: 'template_unavailable', detail: 'Não achei o src/viewer.tsx no repo core (' + CORE_TEMPLATE_REPO + '). Verifique o GITHUB_DEPLOY_PAT (Contents: Read).' });
}

// Ponto 1a · D-persist: lê/grava a foundation canônica persistida (nomes travados).
async function readProjectTokens(SUPABASE_URL, SERVICE_KEY, project_id) {
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/ds_project_tokens?project_id=eq.${project_id}&select=tokens,overrides`, { headers: sbHeaders(SERVICE_KEY) });
    if (!r.ok) return { tokens: [], overrides: {} };
    const rows = await r.json().catch(() => []);
    const row = (Array.isArray(rows) && rows[0]) || {};
    return { tokens: Array.isArray(row.tokens) ? row.tokens : [], overrides: (row.overrides && typeof row.overrides === 'object') ? row.overrides : {} };
  } catch (e) { return { tokens: [], overrides: {} }; }
}
// Builder Fase 2: grava os overrides (só o dono).
async function saveTokensAction(req, res) {
  const { SUPABASE_URL, SERVICE_KEY } = env();
  if (!SUPABASE_URL || !SERVICE_KEY) return res.status(500).json({ error: 'supabase_env_missing' });
  let b = {}; try { b = (typeof req.body === 'object' && req.body) ? req.body : JSON.parse(req.body || '{}'); } catch (_) {}
  const project_id = String(b.project_id || '').trim();
  if (!UUID_RE.test(project_id)) return res.status(400).json({ error: 'project_id_invalid' });
  const acc = await resolveProjectRead(req, res, project_id);
  if (!acc) return;
  if (!acc.isOwner) return res.status(403).json({ error: 'forbidden', detail: 'Só o dono edita a foundation.' });
  const overrides = (b.overrides && typeof b.overrides === 'object') ? b.overrides : {};
  try {
    const up = await fetch(`${SUPABASE_URL}/rest/v1/ds_project_tokens?on_conflict=project_id`, {
      method: 'POST',
      headers: { ...sbHeaders(SERVICE_KEY), Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify({ project_id, overrides, updated_at: new Date().toISOString() })
    });
    if (!up.ok) {
      const txt = await up.text().catch(() => '');
      return res.status(502).json({ error: 'db_save_failed', status: up.status, detail: txt.slice(0, 300) });
    }
    return res.status(200).json({ ok: true, saved: Object.keys(overrides).length });
  } catch (e) { return res.status(500).json({ error: 'save_failed', detail: String(e && e.message || e).slice(0, 200) }); }
}
async function saveProjectTokens(SUPABASE_URL, SERVICE_KEY, project_id, tokens) {
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/ds_project_tokens?on_conflict=project_id`, {
      method: 'POST',
      headers: { ...sbHeaders(SERVICE_KEY), Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify({ project_id, tokens, updated_at: new Date().toISOString() })
    });
  } catch (e) { /* best-effort */ }
}

// Ponto 3 · Builder: código dos componentes (tsx+css) pro preview live. Leve, read-only.
async function listCode(req, res) {
  const { SUPABASE_URL, SERVICE_KEY } = env();
  if (!SUPABASE_URL || !SERVICE_KEY) return res.status(500).json({ error: 'supabase_env_missing' });
  const project_id = String((req.query && req.query.project_id) || '').trim();
  if (!UUID_RE.test(project_id)) return res.status(400).json({ error: 'project_id_invalid' });
  const acc = await resolveProjectRead(req, res, project_id);
  if (!acc) return;
  const r = await fetch(`${SUPABASE_URL}/rest/v1/ds_components?project_id=eq.${project_id}&select=name,display_name,tsx_code,css_code,variants,is_interactive&order=updated_at.desc`, { headers: sbHeaders(SERVICE_KEY) });
  if (!r.ok) return res.status(502).json({ error: 'list_failed', status: r.status });
  const rows = await r.json().catch(() => []);
  return res.status(200).json({ ok: true, components: Array.isArray(rows) ? rows : [] });
}

// FIX AGENT retroativo: tokeniza o código dos componentes do projeto (troca hex/px
// que são tokens da foundation por var()). Só o dono. Grava de volta em ds_components.
async function tokenizeCodeAction(req, res) {
  const { SUPABASE_URL, SERVICE_KEY } = env();
  if (!SUPABASE_URL || !SERVICE_KEY) return res.status(500).json({ error: 'supabase_env_missing' });
  let b = {}; try { b = (typeof req.body === 'object' && req.body) ? req.body : JSON.parse(req.body || '{}'); } catch (_) {}
  const project_id = String(b.project_id || '').trim();
  if (!UUID_RE.test(project_id)) return res.status(400).json({ error: 'project_id_invalid' });
  const acc = await resolveProjectRead(req, res, project_id);
  if (!acc) return;
  if (!acc.isOwner) return res.status(403).json({ error: 'forbidden', detail: 'Só o dono tokeniza os componentes.' });
  const r = await fetch(`${SUPABASE_URL}/rest/v1/ds_components?project_id=eq.${project_id}&select=id,name,tokens,tsx_code,css_code`, { headers: sbHeaders(SERVICE_KEY) });
  if (!r.ok) return res.status(502).json({ error: 'list_failed', status: r.status });
  const rows = await r.json().catch(() => []);
  // canonical com nomes travados (mesma derivação do list-tokens)
  const components = (Array.isArray(rows) ? rows : []).map(x => ({ name: x.name, tokens: Array.isArray(x.tokens) ? x.tokens : [] }));
  let canonical = {}; try { canonical = brain.deriveCanonicalTokens(components); } catch (e) {}
  const canonArr = Object.keys(canonical).map(n => ({ name: n, css: canonical[n].css, value: canonical[n].value, type: canonical[n].type }));
  try {
    const byValue = {}; Object.keys(canonical).forEach(n => { if (canonical[n].type === 'color') byValue[String(canonical[n].value).toLowerCase()] = n; });
    const codes = (Array.isArray(rows) ? rows : []).map(x => x.tsx_code).filter(Boolean);
    const promoted = brain.promoteRawColors(codes, byValue);
    (promoted || []).forEach(p => canonArr.push({ name: p.name, css: p.css, value: p.value, type: p.type }));
  } catch (e) {}
  let recTokens = canonArr;
  try { const pdata = await readProjectTokens(SUPABASE_URL, SERVICE_KEY, project_id); recTokens = brain.reconcileTokenNames(canonArr, pdata.tokens, 12).tokens; } catch (e) {}
  const canonMap = {}; recTokens.forEach(t => { if (t && t.name) canonMap[t.name] = { css: t.css, value: t.value, type: t.type }; });
  // tokeniza cada componente e grava de volta o que mudou
  const report = [];
  for (const row of (Array.isArray(rows) ? rows : [])) {
    let tsxR = { code: row.tsx_code || '', count: 0 }, cssR = { code: row.css_code || '', count: 0 };
    try { tsxR = brain.tokenizeCode(row.tsx_code || '', canonMap); } catch (e) {}
    try { cssR = brain.tokenizeCode(row.css_code || '', canonMap); } catch (e) {}
    if (tsxR.count > 0 || cssR.count > 0) {
      await fetch(`${SUPABASE_URL}/rest/v1/ds_components?id=eq.${row.id}`, {
        method: 'PATCH',
        headers: { ...sbHeaders(SERVICE_KEY), Prefer: 'return=minimal' },
        body: JSON.stringify({ tsx_code: tsxR.code, css_code: cssR.code })
      });
    }
    report.push({ name: row.name, tsx: tsxR.count, css: cssR.count });
  }
  return res.status(200).json({ ok: true, report, changed: report.filter(x => x.tsx || x.css).length, total: report.length });
}

async function listTokens(req, res) {
  const { SUPABASE_URL, SERVICE_KEY } = env();
  if (!SUPABASE_URL || !SERVICE_KEY) return res.status(500).json({ error: 'supabase_env_missing' });
  const project_id = String((req.query && req.query.project_id) || '').trim();
  if (!UUID_RE.test(project_id)) return res.status(400).json({ error: 'project_id_invalid' });
  const acc = await resolveProjectRead(req, res, project_id);
  if (!acc) return;
  const r = await fetch(`${SUPABASE_URL}/rest/v1/ds_components?project_id=eq.${project_id}&select=name,tokens,tsx_code`, { headers: sbHeaders(SERVICE_KEY) });
  if (!r.ok) return res.status(502).json({ error: 'list_failed', status: r.status });
  const rows = await r.json().catch(() => []);
  // Ponto 1a: em vez da união crua (com duplicatas), deriva o conjunto CANÔNICO
  // no servidor (unifica por nome de variável, classifica tipo, emite CSS temável).
  const components = (Array.isArray(rows) ? rows : []).map(row => ({ name: row && row.name, tokens: (row && Array.isArray(row.tokens)) ? row.tokens : [] }));
  let canonical = {};
  try { canonical = brain.deriveCanonicalTokens(components); } catch (e) { canonical = {}; }
  const tokens = Object.keys(canonical).map(name => ({
    name: name,
    css: canonical[name].css,
    value: canonical[name].value,
    type: canonical[name].type,
    source: 'variable'
  }));
  // Ponto 1a · Caminho B: promove cores CRUAS do código (não amarradas a Variables)
  // a tokens canônicos de cor — senão a paleta de cor fica vazia na maioria dos designs.
  try {
    const byValue = {};
    Object.keys(canonical).forEach(n => { if (canonical[n] && canonical[n].type === 'color') byValue[String(canonical[n].value).toLowerCase()] = n; });
    const codes = (Array.isArray(rows) ? rows : []).map(row => row && row.tsx_code).filter(Boolean);
    const promoted = brain.promoteRawColors(codes, byValue);
    (promoted || []).forEach(p => {
      tokens.push({ name: p.name, css: p.css, value: p.value, type: p.type, count: p.count, merged: p.merged, source: 'promoted' });
    });
  } catch (e) { /* best-effort: sem promoção, segue só com Variables */ }
  // Ponto 1a · D-persist: trava nomes contra a foundation persistida (nomes estáveis
  // pro builder e pra geração referenciar). Só o DONO grava; leitura pública reconcilia
  // em memória sem escrever.
  let finalTokens = tokens;
  try {
    const pdata = await readProjectTokens(SUPABASE_URL, SERVICE_KEY, project_id);
    const rec = brain.reconcileTokenNames(tokens, pdata.tokens, 12);
    if (acc.isOwner && rec.changed) {
      await saveProjectTokens(SUPABASE_URL, SERVICE_KEY, project_id, rec.tokens);
    }
    // aplica overrides: valor efetivo = override ?? derivado; guarda base p/ reset
    const ov = pdata.overrides || {};
    finalTokens = rec.tokens.map(t => {
      const hasOv = Object.prototype.hasOwnProperty.call(ov, t.css);
      return Object.assign({}, t, { base: t.value, value: hasOv ? ov[t.css] : t.value, overridden: !!hasOv });
    });
  } catch (e) { finalTokens = tokens; }
  // dedup defensivo por css (evita token repetido na lista, ex.: border-radius-x 2x)
  { const _seen = {}; finalTokens = finalTokens.filter(t => { if (!t || !t.css) return true; if (_seen[t.css]) return false; _seen[t.css] = 1; return true; }); }
  // reconstrói canonical (nomes travados) pro CSS temável
  const canonFinal = {};
  finalTokens.forEach(t => { canonFinal[t.name] = { css: t.css, value: t.value, raw: t.value, type: t.type }; });
  let tokensCss = '';
  try {
    const base = {}; Object.keys(canonFinal).forEach(n => { base[n] = canonFinal[n].value; });
    tokensCss = brain.buildThemeCss(canonFinal, base, ':root');
  } catch (e) { tokensCss = ''; }
  return res.status(200).json({ ok: true, tokens: finalTokens, tokensCss, canonical: canonFinal });
}

// ════════════════════════════ ação: get-component ═══════════════════════════
// GET, token — UM componente completo (código, preview, docs, variantes). Valida
// que o projeto dono do componente pertence ao usuário logado. Aqui SIM trazemos
// os campos pesados (tsx/css/html_preview) — é a tela de detalhe.
async function getComponent(req, res) {
  const { SUPABASE_URL, SERVICE_KEY } = env();
  if (!SUPABASE_URL || !SERVICE_KEY) return res.status(500).json({ error: 'supabase_env_missing' });
  const component_id = String((req.query && req.query.component_id) || '').trim();
  if (!UUID_RE.test(component_id)) return res.status(400).json({ error: 'component_id_invalid' });
  const cols = 'id,project_id,name,display_name,category,description,version,variant_count,is_interactive,width,height,tsx_code,css_code,html_preview,svg_source,png_base64,variants,tokens,anatomy,docs,updated_at';
  const cr = await fetch(`${SUPABASE_URL}/rest/v1/ds_components?id=eq.${component_id}&select=${cols}`, { headers: sbHeaders(SERVICE_KEY) });
  if (!cr.ok) return res.status(502).json({ error: 'component_lookup_failed', status: cr.status });
  const rows = await cr.json().catch(() => []);
  if (!Array.isArray(rows) || !rows.length) return res.status(404).json({ error: 'component_not_found' });
  const comp = rows[0];
  // leitura: dono (com token) OU componente de projeto público (anônimo)
  const acc = await resolveProjectRead(req, res, comp.project_id);
  if (!acc) return;
  const prj = [{ owner_id: acc.project.owner_id }];
  // versões (para a aba Histórico) — tolerante a falha
  let versions = [];
  try {
    const vr = await fetch(`${SUPABASE_URL}/rest/v1/ds_component_versions?component_id=eq.${component_id}&select=version,changelog,diff_summary,created_at,created_by&order=created_at.desc`, { headers: sbHeaders(SERVICE_KEY) });
    if (vr.ok) versions = await vr.json().catch(() => []);
  } catch (_) { /* segue sem histórico */ }
  // nome do autor (dono do projeto) — select=* evita 400 por coluna desconhecida
  let authorName = null;
  try {
    const ar = await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${prj[0].owner_id}&select=*`, { headers: sbHeaders(SERVICE_KEY) });
    if (ar.ok) { const ap = await ar.json().catch(() => []); const p = Array.isArray(ap) && ap[0]; if (p) authorName = p.github_username || p.username || p.handle || p.login || p.full_name || p.name || null; }
  } catch (_) { /* autor opcional */ }
  comp.versions = (Array.isArray(versions) ? versions : []).map((v) => ({
    version: v.version,
    date: v.created_at,
    author: authorName || undefined,
    summary: v.changelog || ('Componente publicado (v' + v.version + ').'),
    changes: v.diff_summary ? [v.diff_summary] : [],
  }));
  return res.status(200).json({ ok: true, component: comp });
}

// ════════════════════════════ helpers: super admin ═════════════════════════
// Verifica se o uid é platform admin. Tenta user_id (padrão), cai pra id/uid se a
// coluna não existir — assim não tranca o admin fora por divergência de nome.
async function isPlatformAdmin(uid) {
  const { SUPABASE_URL, SERVICE_KEY } = env();
  if (!uid || !SUPABASE_URL || !SERVICE_KEY) return false;
  for (const col of ['user_id', 'id', 'uid', 'profile_id']) {
    try {
      const r = await fetch(`${SUPABASE_URL}/rest/v1/platform_admins?${col}=eq.${uid}&select=${col}&limit=1`, { headers: sbHeaders(SERVICE_KEY) });
      if (r.ok) { const rows = await r.json().catch(() => []); if (Array.isArray(rows) && rows.length > 0) return true; if (Array.isArray(rows)) return false; }
      // 400 (coluna inexistente) → tenta a próxima
    } catch (_) { /* tenta a próxima coluna */ }
  }
  return false;
}
// Conta linhas via Content-Range (Prefer: count=exact) — universal, sem depender de
// agregados do PostgREST. Devolve null se a tabela não existir / falhar.
async function countRows(table, filter) {
  const { SUPABASE_URL, SERVICE_KEY } = env();
  try {
    const url = `${SUPABASE_URL}/rest/v1/${table}?select=*${filter ? '&' + filter : ''}`;
    const r = await fetch(url, { headers: { ...sbHeaders(SERVICE_KEY), Prefer: 'count=exact', Range: '0-0' } });
    if (!r.ok && r.status !== 206) return null;
    const cr = r.headers.get('content-range') || '';
    const total = cr.split('/')[1];
    return total && total !== '*' ? Number(total) : null;
  } catch (_) { return null; }
}

// ════════════════════════════ ação: admin-overview ═════════════════════════
// GET, token de PLATFORM ADMIN — visão da plataforma inteira. Re-verifica admin
// server-side (NÃO confia no client) e agrega as tabelas base com a service key.
async function adminOverview(req, res) {
  const { SUPABASE_URL, SERVICE_KEY } = env();
  if (!SUPABASE_URL || !SERVICE_KEY) return res.status(500).json({ error: 'supabase_env_missing' });
  const uid = await userIdFromToken(req);
  if (!uid) return res.status(401).json({ error: 'unauthorized', detail: 'Sessão ausente ou expirada — entre novamente.' });
  if (!(await isPlatformAdmin(uid))) return res.status(403).json({ error: 'forbidden', detail: 'Acesso restrito a administradores da plataforma.' });

  const H = sbHeaders(SERVICE_KEY);
  // projetos (todos os donos)
  let projects = [];
  try { const r = await fetch(`${SUPABASE_URL}/rest/v1/ds_projects?select=id,name,slug,visibility,owner_id,component_count,variant_count,updated_at,repo_full_name,vercel_url&order=updated_at.desc`, { headers: H }); if (r.ok) projects = await r.json().catch(() => []); } catch (_) {}
  if (!Array.isArray(projects)) projects = [];
  // perfis (usuários) — select=* tolera colunas desconhecidas
  let profiles = [];
  try { const r = await fetch(`${SUPABASE_URL}/rest/v1/profiles?select=*`, { headers: H }); if (r.ok) profiles = await r.json().catch(() => []); } catch (_) {}
  if (!Array.isArray(profiles)) profiles = [];
  // gerações — um fetch serve pra total, mês, por-projeto e por-usuário (cap defensivo)
  let gens = [];
  try { const r = await fetch(`${SUPABASE_URL}/rest/v1/ds_generations?select=cost_usd,project_id,user_id,status,created_at&order=created_at.desc&limit=10000`, { headers: H }); if (r.ok) gens = await r.json().catch(() => []); } catch (_) {}
  if (!Array.isArray(gens)) gens = [];
  const gensCapped = gens.length >= 10000;
  // contagens exatas (independem do cap)
  const componentsCount = await countRows('ds_components');
  const generationsCount = await countRows('ds_generations');
  const reposCount = projects.filter((p) => p && p.repo_full_name).length; // projetos com repositório vinculado

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  const num = (x) => (typeof x === 'number' ? x : parseFloat(x) || 0);
  let costTotal = 0, costMonth = 0, gensMonth = 0;
  const byProject = {}, byUser = {};
  for (const g of gens) {
    const c = num(g.cost_usd); costTotal += c;
    const t = g.created_at ? new Date(g.created_at).getTime() : 0;
    if (t >= monthStart) { costMonth += c; gensMonth++; }
    if (g.project_id) { (byProject[g.project_id] = byProject[g.project_id] || { gens: 0, cost: 0 }); byProject[g.project_id].gens++; byProject[g.project_id].cost += c; }
    if (g.user_id) { (byUser[g.user_id] = byUser[g.user_id] || { gens: 0, cost: 0 }); byUser[g.user_id].gens++; byUser[g.user_id].cost += c; }
  }
  const profById = {}; for (const p of profiles) profById[String(p.id)] = p;
  const nameOf = (id) => { const p = profById[String(id)]; return (p && (p.github_username || p.username || p.handle || p.login || p.full_name || p.name || p.email)) || null; };
  const projCountByUser = {}; for (const p of projects) { if (p.owner_id) projCountByUser[p.owner_id] = (projCountByUser[p.owner_id] || 0) + 1; }

  const projectsOut = projects.map((p) => ({
    id: p.id, name: p.name, slug: p.slug, visibility: p.visibility,
    owner_id: p.owner_id, owner: nameOf(p.owner_id),
    components: Number(p.component_count) || 0, variants: Number(p.variant_count) || 0,
    generations: (byProject[p.id] && byProject[p.id].gens) || 0,
    cost: (byProject[p.id] && byProject[p.id].cost) || 0,
    repo_full_name: p.repo_full_name || null, vercel_url: p.vercel_url || null,
    updated_at: p.updated_at,
  }));
  // tier + cota por usuário (override no ds_modules) + uso do mês (ds_usage)
  let userMods = [];
  try { const rM = await fetch(`${SUPABASE_URL}/rest/v1/ds_modules?target_type=eq.user&select=user_id,features`, { headers: H }); if (rM.ok) userMods = await rM.json().catch(() => []); } catch (_) {}
  const tierByUser = {}, limitByUser = {};
  for (const m of (userMods || [])) { const f = m.features || {}; const mg = f['max_gen/month']; tierByUser[String(m.user_id)] = { tier: f.tier || null, unlimited: (mg != null && Number(mg) < 0) }; if (mg !== undefined) limitByUser[String(m.user_id)] = Number(mg); }
  let platLimit = 5;
  try { const rP = await fetch(`${SUPABASE_URL}/rest/v1/ds_modules?target_type=eq.platform&org_id=is.null&project_id=is.null&user_id=is.null&select=features&limit=1`, { headers: H }); if (rP.ok) { const rows = await rP.json().catch(() => []); const mg = rows && rows[0] && rows[0].features && rows[0].features['max_gen/month']; if (mg !== undefined && mg !== null) platLimit = Number(mg); } } catch (_) {}
  if (!(platLimit > 0)) platLimit = 5; // 0/inválido no default da plataforma → 5
  const ymNow = new Date().toISOString().slice(0, 7);
  const usedByUser = {};
  try { const rU = await fetch(`${SUPABASE_URL}/rest/v1/ds_usage?ym=eq.${ymNow}&select=user_id,count`, { headers: H }); if (rU.ok) { const rows = await rU.json().catch(() => []); for (const r of rows) usedByUser[String(r.user_id)] = Number(r.count) || 0; } } catch (_) {}
  const usersOut = profiles.map((u) => {
    const lim = (Number.isFinite(limitByUser[u.id]) && limitByUser[u.id] > 0) ? limitByUser[u.id] : platLimit;
    return {
      id: u.id, name: nameOf(u.id) || u.id, email: u.email || null,
      projects: projCountByUser[u.id] || 0,
      generations: (byUser[u.id] && byUser[u.id].gens) || 0,
      cost: (byUser[u.id] && byUser[u.id].cost) || 0,
      created_at: u.created_at || null,
      tier: (tierByUser[u.id] && tierByUser[u.id].tier) || null,
      unlimited: !!(tierByUser[u.id] && tierByUser[u.id].unlimited),
      used: usedByUser[u.id] || 0,
      limit: lim,
    };
  }).sort((a, b) => (b.projects - a.projects) || (b.generations - a.generations));

  return res.status(200).json({
    ok: true,
    stats: {
      projects: projects.length,
      users: profiles.length,
      components: componentsCount != null ? componentsCount : projects.reduce((a, p) => a + (Number(p.component_count) || 0), 0),
      generations: generationsCount != null ? generationsCount : gens.length,
      generationsMonth: gensMonth,
      costTotal, costMonth,
      repos: reposCount != null ? reposCount : 0,
      gensCapped,
    },
    projects: projectsOut,
    users: usersOut,
  });
}

// ─── Peça C: cadastro/solicitação de acesso + moderação (modelo Soft) ────────
// Todo usuário logado já é Free; a solicitação é pra virar tester/role maior.
async function upsertUserModules(SUPABASE_URL, SERVICE_KEY, uid, feats) {
  const filter = `target_type=eq.user&user_id=eq.${uid}`;
  const getR = await fetch(`${SUPABASE_URL}/rest/v1/ds_modules?${filter}&select=id,features&order=updated_at.desc&limit=1`, { headers: sbHeaders(SERVICE_KEY) });
  const rows = getR.ok ? await getR.json().catch(() => []) : [];
  const existing = rows && rows[0];
  const merged = { ...((existing && existing.features) || {}), ...feats };
  if (existing) {
    await fetch(`${SUPABASE_URL}/rest/v1/ds_modules?id=eq.${existing.id}`, { method: 'PATCH', headers: { ...sbHeaders(SERVICE_KEY), Prefer: 'return=minimal' }, body: JSON.stringify({ features: merged, updated_at: new Date().toISOString() }) });
  } else {
    await fetch(`${SUPABASE_URL}/rest/v1/ds_modules`, { method: 'POST', headers: { ...sbHeaders(SERVICE_KEY), Prefer: 'return=minimal' }, body: JSON.stringify({ target_type: 'user', user_id: uid, features: merged }) });
  }
  return merged;
}

// POST ?action=request-access  (Bearer JWT) — body { message?, requested? }
async function requestAccess(req, res) {
  const { SUPABASE_URL, SERVICE_KEY } = env();
  if (!SUPABASE_URL || !SERVICE_KEY) return res.status(500).json({ error: 'supabase_env_missing' });
  const uid = await userIdFromToken(req);
  if (!uid) return res.status(401).json({ error: 'unauthorized' });
  let b = {}; try { b = (typeof req.body === 'object' && req.body) ? req.body : JSON.parse(req.body || '{}'); } catch (_) {}
  const message = String(b.message || '').slice(0, 1000);
  const requested = String(b.requested || 'tester').slice(0, 40);
  const row = { user_id: uid, message, requested_role: requested, status: 'pending', created_at: new Date().toISOString(), resolved_by: null, resolved_at: null };
  const r = await fetch(`${SUPABASE_URL}/rest/v1/ds_access_requests?on_conflict=user_id`, {
    method: 'POST', headers: { ...sbHeaders(SERVICE_KEY), Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify(row),
  });
  if (!r.ok) { const t = await r.text().catch(() => ''); return res.status(500).json({ error: 'request_failed', detail: (t || '').slice(0, 200) }); }
  return res.status(200).json({ ok: true });
}

// GET ?action=list-access-requests&status=pending  (admin)
async function listAccessRequests(req, res) {
  const { SUPABASE_URL, SERVICE_KEY } = env();
  const uid = await userIdFromToken(req);
  if (!uid || !(await isPlatformAdmin(uid))) return res.status(403).json({ error: 'forbidden' });
  const status = String((req.query && req.query.status) || 'pending');
  const filter = status === 'all' ? '' : `status=eq.${encodeURIComponent(status)}&`;
  let reqs = [];
  try { const r = await fetch(`${SUPABASE_URL}/rest/v1/ds_access_requests?${filter}select=*&order=created_at.desc&limit=500`, { headers: sbHeaders(SERVICE_KEY) }); if (r.ok) reqs = await r.json().catch(() => []); } catch (_) {}
  let profiles = [];
  try { const r = await fetch(`${SUPABASE_URL}/rest/v1/profiles?select=*`, { headers: sbHeaders(SERVICE_KEY) }); if (r.ok) profiles = await r.json().catch(() => []); } catch (_) {}
  const pById = {}; for (const p of (profiles || [])) pById[String(p.id)] = p;
  const nameOf = (id) => { const p = pById[String(id)]; return (p && (p.github_username || p.username || p.full_name || p.name || p.email)) || id; };
  const out = (reqs || []).map((x) => ({ user_id: x.user_id, name: nameOf(x.user_id), email: (pById[String(x.user_id)] || {}).email || null, requested_role: x.requested_role, message: x.message, status: x.status, created_at: x.created_at }));
  return res.status(200).json({ ok: true, requests: out });
}

// POST ?action=resolve-access-request  (admin) — body { user_id, decision:'approve'|'deny', tier?:'tester'|'free' }
async function resolveAccessRequest(req, res) {
  const { SUPABASE_URL, SERVICE_KEY } = env();
  const uid = await userIdFromToken(req);
  if (!uid || !(await isPlatformAdmin(uid))) return res.status(403).json({ error: 'forbidden' });
  let b = {}; try { b = (typeof req.body === 'object' && req.body) ? req.body : JSON.parse(req.body || '{}'); } catch (_) {}
  const target = String(b.user_id || '');
  if (!UUID_RE.test(target)) return res.status(400).json({ error: 'user_id_invalid' });
  const decision = b.decision === 'deny' ? 'denied' : 'approved';
  const tier = String(b.tier || 'tester');
  if (decision === 'approved') {
    const feats = tier === 'tester' ? { 'max_gen/month': -1, tier: 'tester' } : { 'max_gen/month': null, tier: tier };
    try { await upsertUserModules(SUPABASE_URL, SERVICE_KEY, target, feats); } catch (_) {}
  }
  await fetch(`${SUPABASE_URL}/rest/v1/ds_access_requests?user_id=eq.${target}`, {
    method: 'PATCH', headers: { ...sbHeaders(SERVICE_KEY), Prefer: 'return=minimal' },
    body: JSON.stringify({ status: decision, resolved_by: uid, resolved_at: new Date().toISOString() }),
  });
  return res.status(200).json({ ok: true, status: decision });
}

// POST ?action=set-user-quota (admin) — body { user_id, limit?, reset? }
//   limit: número (novo teto) | -1 (ilimitado) | null (volta ao default da plataforma)
//   reset: true → zera o uso do mês (ds_usage) do usuário
async function setUserQuota(req, res) {
  const { SUPABASE_URL, SERVICE_KEY } = env();
  const uid = await userIdFromToken(req);
  if (!uid || !(await isPlatformAdmin(uid))) return res.status(403).json({ error: 'forbidden' });
  let b = {}; try { b = (typeof req.body === 'object' && req.body) ? req.body : JSON.parse(req.body || '{}'); } catch (_) {}
  const target = String(b.user_id || '');
  if (!UUID_RE.test(target)) return res.status(400).json({ error: 'user_id_invalid' });
  if (b.reset) {
    const ym = new Date().toISOString().slice(0, 7);
    try { await fetch(`${SUPABASE_URL}/rest/v1/ds_usage?user_id=eq.${target}&ym=eq.${ym}`, { method: 'DELETE', headers: { ...sbHeaders(SERVICE_KEY), Prefer: 'return=minimal' } }); } catch (_) {}
  }
  if ('limit' in b) {
    const lim = (b.limit === null) ? null : Number(b.limit);
    try { await upsertUserModules(SUPABASE_URL, SERVICE_KEY, target, { 'max_gen/month': lim }); } catch (_) {}
  }
  return res.status(200).json({ ok: true });
}

// POST ?action=auth-refresh — body { refresh_token } → { ok, access_token, refresh_token }
// Renova o JWT do Supabase quando ele expira no meio de uma geração longa.
async function authRefresh(req, res) {
  const { SUPABASE_URL } = env();
  const ANON = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SUPABASE_URL || !ANON) return res.status(500).json({ error: 'supabase_env_missing' });
  let b = {}; try { b = (typeof req.body === 'object' && req.body) ? req.body : JSON.parse(req.body || '{}'); } catch (_) {}
  const rt = String(b.refresh_token || '');
  if (!rt) return res.status(400).json({ error: 'no_refresh' });
  try {
    const r = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
      method: 'POST', headers: { apikey: ANON, 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: rt }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j.access_token) return res.status(401).json({ error: 'refresh_failed' });
    return res.status(200).json({ ok: true, access_token: j.access_token, refresh_token: j.refresh_token || rt });
  } catch (e) { return res.status(502).json({ error: 'refresh_error' }); }
}

// POST ?action=preflight — body { code, componentData } → { ok, report }
// Roda os 18 invariantes de fidelidade NO SERVIDOR (cérebro protegido). Sem IA,
// sem custo → não exige cota; só computa estático sobre o código gerado.
async function preflightAction(req, res) {
  let b = {}; try { b = (typeof req.body === 'object' && req.body) ? req.body : JSON.parse(req.body || '{}'); } catch (_) {}
  const code = String(b.code || '');
  const componentData = b.componentData;
  if (!code || !componentData || typeof componentData !== 'object') return res.status(400).json({ error: 'missing_code_or_component' });
  try {
    const report = brain.preflightInvariants(code, componentData);
    return res.status(200).json({ ok: true, report });
  } catch (e) {
    return res.status(500).json({ error: 'preflight_failed', detail: String(e && e.message || e).slice(0, 300) });
  }
}

// ─── Ponto 1a: serviço de derivação de tokens canônicos + emissão temada ──────
// Computação pura (usa o _brain verificado). Sem auth/custo, igual ao preflight.
// Entrada: { components:[{name,tokens}], themes?:[{id,selector,parentDelta,childDelta,componentOverride}] }
// Saída:   { canonical, tokensCss (:root base), themeCss:{id: css} }
async function deriveTokensAction(req, res) {
  let b = {}; try { b = (typeof req.body === 'object' && req.body) ? req.body : JSON.parse(req.body || '{}'); } catch (_) {}
  const components = Array.isArray(b.components) ? b.components : null;
  if (!components) return res.status(400).json({ error: 'missing_components' });
  try {
    const canonical = brain.deriveCanonicalTokens(components);
    const base = {}; Object.keys(canonical).forEach(function (n) { base[n] = canonical[n].value; });
    const tokensCss = brain.buildThemeCss(canonical, base, ':root');
    const themeCss = {};
    (Array.isArray(b.themes) ? b.themes : []).forEach(function (th) {
      if (!th || !th.id) return;
      const resolved = brain.resolveTheme(base, th.parentDelta || {}, th.childDelta || {}, th.componentOverride || {});
      themeCss[th.id] = brain.buildThemeCss(canonical, resolved, th.selector || ('[data-theme="' + th.id + '"]'));
    });
    return res.status(200).json({ ok: true, canonical, tokensCss, themeCss });
  } catch (e) {
    return res.status(500).json({ error: 'derive_failed', detail: String(e && e.message || e).slice(0, 300) });
  }
}

// ─── roteador ─────────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();

  const action = String((req.query && (req.query.action || req.query.fn)) || '').trim();

  try {
    if (action === 'project') return await getProject(req, res);            // leitura (GET)
    if (action === 'list-projects') return await listProjects(req, res);    // leitura (GET, token)
    if (action === 'list-components') return await listComponents(req, res); // leitura (GET, token)
    if (action === 'list-tokens') return await listTokens(req, res);         // leitura (GET, token) — foundations
    if (action === 'get-component') return await getComponent(req, res);     // leitura (GET, token)
    if (action === 'admin-overview') return await adminOverview(req, res);   // leitura (GET, token de platform admin)
    if (action === 'request-access') return await requestAccess(req, res);            // usuário pede acesso ampliado
    if (action === 'list-access-requests') return await listAccessRequests(req, res);  // fila de moderação (admin)
    if (action === 'resolve-access-request') return await resolveAccessRequest(req, res); // aprovar/negar + tier (admin)
    if (action === 'set-user-quota') return await setUserQuota(req, res);            // ajustar limite / zerar uso (admin)
    if (action === 'auth-poll') return await authPoll(req, res);            // leitura (GET)
    if (action === 'auth-refresh') return await authRefresh(req, res);      // renova JWT (POST)
    if (action === 'auth-config') return await authConfig(req, res);        // leitura (GET)
    if (action === 'get-modules') return await getModules(req, res);        // leitura (GET, admin)
    if (action === 'quota') return await getQuota(req, res);                  // medidor de cota (plugin)
    if (action === 'preflight') return await preflightAction(req, res);       // 18 invariantes no servidor (Parte 2)
    if (action === 'derive-tokens') return await deriveTokensAction(req, res); // Ponto 1a: canônico + temas
    if (action === 'list-code') return await listCode(req, res);         // Ponto 3: código dos componentes (builder)
    if (action === 'save-tokens') return await saveTokensAction(req, res);  // Builder Fase 2: salva overrides
    if (action === 'get-template') return await getTemplateAction(req, res);  // Deploy: serve o platform.tsx canônico via server PAT
    if (action === 'tokenize-code') return await tokenizeCodeAction(req, res); // FIX AGENT retroativo
    if (action === 'list-deployments') return await listDeployments(req, res); // leitura (GET, dono)
    if (action === 'project-role') return await projectRole(req, res);      // leitura (GET, token)
    if (action === 'list-members') return await listMembers(req, res);      // leitura (GET, membro)
    if (action === 'search-profiles') return await searchProfiles(req, res); // leitura (GET, dono)
    if (action === 'invite-info') return await inviteInfo(req, res);         // leitura (GET, público via token)
    if (action === 'list-invites') return await listInvites(req, res);       // leitura (GET, dono)
    if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' }); // mutações exigem POST
    if (action === 'create-project') return await createProject(req, res);
    if (action === 'update-project') return await updateProject(req, res);
    if (action === 'set-modules') return await setModules(req, res);
    if (action === 'log-deployment') return await logDeployment(req, res);
    if (action === 'set-member') return await setMember(req, res);
    if (action === 'remove-member') return await removeMember(req, res);
    if (action === 'create-invite') return await createInvite(req, res);
    if (action === 'revoke-invite') return await revokeInvite(req, res);
    if (action === 'accept-invite') return await acceptInvite(req, res);
    if (action === 'auth-signup') return await authSignup(req, res);
    if (action === 'auth-login') return await authLogin(req, res);
    if (action === 'auth-recover') return await authRecover(req, res);
    if (action === 'auth-update-password') return await authUpdatePassword(req, res);
    if (action === 'save-component') return await saveComponent(req, res);
    if (action === 'log-generation') return await logGeneration(req, res);
    if (action === 'auth-store') return await authStore(req, res);
    return res.status(404).json({ error: 'unknown_action', action });
  } catch (e) {
    return res.status(500).json({ error: 'exception', detail: String((e && e.message) || e).slice(0, 300) });
  }
}
