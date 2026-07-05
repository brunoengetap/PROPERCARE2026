# PROMPT — Codex · PCM v62 → v63 (frontend-only)
### 3 tarefas: (1) Contraste + marca Proper · (2) Catálogo → Painel de Gestão · (3) Ribbon Gestão de OSs (Lista/Kanban/Calendário)

> **Escopo travado. 100% frontend — NÃO tocar no GAS.** Arquivo de entrada: `PCM_v62.html` (nunca sobrescrever). Saída: **`PCM_v63.html`** (novo arquivo) + `CHANGELOG_SPRINT_v63.md`.
>
> Este prompt foi escrito **após auditoria estática completa** do `PCM_v62.html` e do `PCM_prototipo_GestaoOS.html`. Todo o código das 3 tarefas está **pré-escrito abaixo** — seu trabalho é aplicá-lo nas âncoras indicadas, não improvisar. Onde o texto disser **"PARE"**, pare e devolva o item para o Claude Code (ver §Contingência) — **nunca chute IDs, seletores ou âncoras**.

---

## INVARIANTES (não violar — nenhuma exceção)

1. **Não renomear** nenhum `id`, `data-view`, nome de função ou `data-key` já existente (incidente `VIEW_ID_OVERRIDES`). Só **adicionar** e mover elementos inteiros verbatim.
2. **Frontend-only.** Nenhuma mudança no GAS, nenhuma chamada de escrita nova. Nenhuma ação de backend nova é criada nesta sprint.
3. **Não editar `ESTADO_ATUAL.md`.** Esse arquivo é atualizado pelo Claude, não pelo agente de código.
4. **Reusar, nunca recriar:** as funções `toast(msg,type)`, `openOSDetail(id_os)`, `openModalOS(id?)`, `gsGet(...)`, `_usuarioEstaDigitandoEm_(el)` e o cache `_osList` **já existem** — use-as. Não crie `_osCache`, não recrie um `toast`.
5. **Isolamento do CSS novo:** todo CSS novo da Tarefa 3 é **prefixado `gos-`** e/ou aninhado sob `.gos-root`. Todo `id` novo é prefixado (`osRibbonContent`, `gos*`). Confirmado por grep: `gos-`, `osRibbonContent`, `kanbanBoard`, `class="ribbon"` **não existem** no v62 (0 ocorrências) — sem risco de colisão.
6. **`node --check` obrigatório** antes de entregar (o HTML não passa direto no `node --check` — extrair o `<script>` para um `.js` temporário primeiro; ver §Validação).
7. **Changelog** no topo do `PCM_v63.html` (bloco `<!-- -->`, entrada nova acima das antigas, sem apagar as anteriores). **Evitar `--` dentro do texto do comentário** (usar "node check" sem os dois hifens) para não gerar HTML não-conforme.

---

## GATE DE AUDITORIA (rodar ANTES de editar — confirmar que as âncoras batem)

```bash
grep -n "^  --sidebar-group:\|^  --accent:\|^  --accent-hover:\|.btn-primary{background:var(--blue)}\|.btn-primary:hover{background:var(--blue-mid)}" PCM_v62.html
grep -n "POSIÇÃO PENDENTE: Catálogo\|id=\"navCatalog\"\|nav-group-label\">PAINEL DE GESTÃO\|nav-group-label\">CONFIGURAÇÕES" PCM_v62.html
grep -n "async function renderOS()\|function _renderOSTable\|id=\"viewOs\"\|function toast\|let _osList" PCM_v62.html
grep -nc "gos-\|osRibbonContent\|kanbanBoard" PCM_v62.html   # deve imprimir 0
```
Se qualquer âncora textual das Tarefas 1 e 2 não bater exatamente → **PARE** e reporte (o arquivo divergiu do auditado). As Tarefas 1 e 2 dependem de âncoras exatas.

---

# TAREFA 1 — Contraste dos títulos + paleta da marca Proper *(baixa complexidade — 5 edições de 1 linha)*

**Contexto:** o accent atual é teal (`#0d9488`); os rótulos de grupo do sidebar (`--sidebar-group:#52525b`) ficam apagados sobre o fundo quase-preto (`#09090b`). A marca Proper é **laranja `#F07725`** sobre charcoal, texto off-white (hex extraídos da logomarca oficial).

Aplique estas 5 substituições **exatas** (todas no bloco `:root`, exceto as 2 últimas em `.btn-primary`):

| # | ANTES | DEPOIS | Efeito |
|---|-------|--------|--------|
| 1 | `--sidebar-group: #52525b;` | `--sidebar-group: #9a9aa4;` | Rótulos CADASTRAL/CONFIGURAÇÕES/SISTEMA legíveis sobre preto (~5,5:1). |
| 2 | `--accent: #0d9488;` | `--accent: #f07725;` | Laranja Proper: borda ativa do nav, foco, sublinhado de abas. |
| 3 | `--accent-hover: #0f766e;` | `--accent-hover: #d9661a;` | Hover laranja escuro. |
| 4 | `.btn-primary{background:var(--blue)}` | `.btn-primary{background:var(--accent)}` | Botões primários ("Abrir OS", "Nova OS") ficam laranja. |
| 5 | `.btn-primary:hover{background:var(--blue-mid)}` | `.btn-primary:hover{background:var(--accent-hover)}` | Hover dos primários. |

**NÃO** alterar os tokens semânticos `--blue*`, `--green*`, `--red*`, `--orange*`, `--purple*` (são cores de status/badges — status "Em andamento" etc. devem permanecer como estão). Só o accent primário e a borda ativa migram para laranja.

---

# TAREFA 2 — Mover "Catálogo" para o grupo PAINEL DE GESTÃO *(baixa complexidade — mover bloco verbatim)*

O item Catálogo hoje está no grupo **CONFIGURAÇÕES**, precedido de um comentário `POSIÇÃO PENDENTE`. A decisão do Fernando: mover para **PAINEL DE GESTÃO** (ao fim do grupo, depois de "Gestão de Documentos").

**2.1 — Remover** este bloco de dentro do grupo CONFIGURAÇÕES (comentário + botão), verbatim:
```html
      <!-- POSIÇÃO PENDENTE: Catálogo (Configurações vs Cadastral) — aguardando Fernando -->
      <button class="nav-item" data-view="catalog" onclick="showView('catalog')" id="navCatalog">
        <svg class="nav-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="2" width="12" height="12" rx="1"/><path d="M5 5h6M5 8h6M5 11h4"/></svg>
        <span>Catálogo</span>
      </button>
```

**2.2 — Inserir** o botão (SEM o comentário de posição pendente; com um comentário novo de decisão) no grupo **PAINEL DE GESTÃO**, **imediatamente após** o botão "Gestão de Documentos" (`id="navDocs"`, o `<span>Gestão de Documentos</span>`) e **antes** do `</div>` que fecha esse `nav-group`:
```html
      <!-- v63 — Catálogo movido de CONFIGURAÇÕES para PAINEL DE GESTÃO (decisão do Fernando). id/data-view/onclick inalterados. -->
      <button class="nav-item" data-view="catalog" onclick="showView('catalog')" id="navCatalog">
        <svg class="nav-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="2" width="12" height="12" rx="1"/><path d="M5 5h6M5 8h6M5 11h4"/></svg>
        <span>Catálogo</span>
      </button>
```

Invariante: `id="navCatalog"`, `data-view="catalog"`, `onclick="showView('catalog')"` **preservados exatamente** — o roteamento (`showView('catalog')`, `allViews` inclui `'catalog'`, `viewCatalog`) continua idêntico; só a posição visual no DOM muda.

---

# TAREFA 3 — Ribbon "Gestão de OSs": Lista / Kanban / Calendário *(média complexidade — código pré-escrito abaixo)*

## 3.0 — Arquitetura (leia antes)

A view de OS hoje: `renderOS()` (cache-first + fetch) → chama `_renderOSTable()` que preenche **todo** o `#viewOs`. `openOSDetail()` também substitui `#viewOs` e volta chamando `renderOS()`.

A mudança: `renderOS()` passa a desenhar um **shell Ribbon** (3 abas + botão "Abrir OS") dentro de `#viewOs`, com um sub-container `#osRibbonContent`. Cada aba escreve **em `#osRibbonContent`**:
- **Lista** → `_renderOSTable()` existente (apenas mudamos o alvo dele para `#osRibbonContent`).
- **Kanban** e **Calendário** → funções **novas** (`gosRenderKanban`/`gosRenderCalendario`), lendo o `_osList` real, clique no card/evento → `openOSDetail(id_os)`.

`openOSDetail` continua substituindo `#viewOs` inteiro e voltando via `renderOS()` — que reconstrói o shell. Contrato preservado.

**Mapa de campos (fictício do protótipo → real do `_osList`):**

| Protótipo | Real (`_osList`) | Observação |
|-----------|------------------|-----------|
| `o.num` | `o.numero_os` | nº de exibição |
| `o.cliente` | `o.cliente` | igual |
| `o.tipo` | resolver: `_tiposOS.find(t=>t.Tipo_ID===o.tipo_os)?.Nome \|\| o.tipo_os` | nome do tipo |
| `o.status` (minúsculo, com `com_pendencia`) | `o.status` **MAIÚSCULO**: `ABERTA/EM_ANDAMENTO/CONCLUIDA/CANCELADA` | normalizar p/ upper; **não existe "com pendência" no nível da OS** — usar as 4 reais |
| `o.prio` (alta/media/baixa) | `o.prioridade`: **urgente/alta/normal** | escala real diferente |
| `o.data` | `o.data_prevista` → `String(...).slice(0,10)` | ISO → 'YYYY-MM-DD' |
| `o.maq` | `o.maquina \|\| o.maquina_label \|\| ''` | **opcional** — não confirmado no payload; só renderizar se existir |
| id p/ clique | `o.id_os` | clique → `openOSDetail(o.id_os)` |

## 3.1 — CSS a inserir (imediatamente antes de `</style>`)

Bloco autocontido, escopado sob `.gos-root`. Usa tokens de produção (`--accent`, `--text`, `--text-muted`, `--border`, `--surface-2`, `--radius`, `--font-mono`) + vars locais de status. `.btn-ghost` do protótipo **não existe** em produção → o botão "Hoje" usa `.btn.btn-secondary` (existente).

```css
/* ═══ v63 · Gestão de OSs · Ribbon (Kanban + Calendário) — CSS escopado ═══ */
.gos-root{ --st-aberta:#c07800; --st-andamento:#2f6fed; --st-concluida:#1f9d57; --st-cancelada:#b91c1c; --gos-faint:#9aa0a6; }
.gos-topbar{margin-bottom:14px}
.gos-page-title{font-size:18px;font-weight:700;color:var(--text)}
.gos-page-sub{font-size:12.5px;color:var(--text2);margin-top:2px}
.gos-ribbon{display:flex;align-items:center;gap:2px;border-bottom:1px solid var(--border);margin-bottom:16px}
.gos-ribbon-tab{display:flex;align-items:center;gap:7px;padding:9px 15px;font-size:13px;font-weight:600;color:var(--text-muted);cursor:pointer;border-bottom:2px solid transparent;user-select:none}
.gos-ribbon-tab:hover{color:var(--text)}
.gos-ribbon-tab.active{color:var(--accent);border-bottom-color:var(--accent)}
.gos-ribbon-tab svg{width:16px;height:16px}
.gos-ribbon-actions{margin-left:auto}
/* badges/tags */
.gos-osnum{font-family:var(--font-mono);font-size:12.5px;font-weight:600}
.gos-prio{font-size:10.5px;font-weight:600;padding:2px 8px;border-radius:10px;white-space:nowrap}
.gos-tp,.gos-badge{display:inline-flex;align-items:center;gap:5px;font-size:11.5px;font-weight:500;color:var(--text)}
.gos-sw{width:9px;height:9px;border-radius:2px;display:inline-block;flex-shrink:0}
/* kanban */
.gos-kanban-bar{display:flex;align-items:center;gap:8px;margin-bottom:14px;flex-wrap:wrap}
.gos-seg-label{font-size:12px;color:var(--text-muted)}
.gos-seg{display:inline-flex;border:1px solid var(--border-strong);border-radius:var(--radius-sm);overflow:hidden}
.gos-seg button{all:unset;padding:5px 13px;font-size:12.5px;cursor:pointer;color:var(--text-muted)}
.gos-seg button.active{background:var(--accent);color:#fff;font-weight:600}
.gos-chips{display:flex;gap:6px;flex-wrap:wrap}
.gos-chip{display:inline-flex;align-items:center;gap:6px;padding:4px 10px;font-size:11.5px;border:1px solid var(--border-strong);border-radius:20px;cursor:pointer;color:var(--text-muted);background:var(--surface-2)}
.gos-chip.on{border-color:var(--accent);color:var(--text);font-weight:600}
.gos-kanban{display:flex;gap:12px;overflow-x:auto;padding-bottom:8px;align-items:flex-start}
.gos-kcol{flex:0 0 262px;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius)}
.gos-kcol-h{display:flex;align-items:center;gap:8px;padding:10px 12px;font-size:13px;font-weight:700;color:var(--text)}
.gos-hbar{width:8px;height:8px;border-radius:50%}
.gos-count{margin-left:auto;font-size:11px;font-weight:600;color:var(--text-muted);background:var(--surface-2);border:1px solid var(--border);border-radius:10px;padding:0 7px}
.gos-klist{padding:0 8px 10px;display:flex;flex-direction:column;gap:8px;min-height:24px}
.gos-kempty{color:var(--gos-faint);font-size:12.5px;padding:4px 4px 10px}
.gos-kcard{background:var(--surface-2);border:1px solid var(--border);border-radius:var(--radius-sm);padding:10px 11px;cursor:pointer;box-shadow:var(--shadow);transition:border-color 120ms}
.gos-kcard:hover{border-color:var(--accent)}
.gos-kcard-top{display:flex;align-items:center;gap:8px;margin-bottom:6px}
.gos-kcard-cli{font-size:13.5px;font-weight:600;color:var(--text)}
.gos-kcard-maq{font-size:11.5px;color:var(--text-muted);margin-top:2px}
.gos-kcard-foot{margin-top:8px}
.gos-kcard-date{font-size:11.5px;color:var(--text-muted)}
.gos-kcard-date.nodate{color:var(--gos-faint);font-style:italic}
/* calendário */
.gos-cal-head{display:flex;align-items:center;gap:10px;margin-bottom:12px;flex-wrap:wrap}
.gos-cal-nav{display:flex;gap:4px}
.gos-cal-month{font-size:16px;font-weight:700;color:var(--text);min-width:150px}
.gos-cal-legend{display:flex;gap:12px;margin-left:auto;flex-wrap:wrap}
.gos-lg{display:inline-flex;align-items:center;gap:5px;font-size:11.5px;color:var(--text-muted)}
.gos-cal-grid{border:1px solid var(--border);border-radius:var(--radius);overflow:hidden}
.gos-cal-dow{display:grid;grid-template-columns:repeat(7,1fr);background:var(--bg)}
.gos-cal-dow>div{padding:7px 10px;font-size:11px;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:.04em}
.gos-cal-weeks{display:grid;grid-template-columns:repeat(7,1fr)}
.gos-cal-cell{min-height:96px;border-top:1px solid var(--border);border-left:1px solid var(--border);padding:6px;background:var(--surface-2)}
.gos-cal-cell:nth-child(7n+1){border-left:none}
.gos-cal-cell.out{background:var(--bg)}
.gos-cal-daynum{font-size:12px;font-weight:600;color:var(--text-muted)}
.gos-cal-cell.out .gos-cal-daynum{color:var(--gos-faint)}
.gos-cal-cell.today .gos-cal-daynum{background:var(--accent);color:#fff;border-radius:50%;padding:1px 6px}
.gos-cal-ev{display:flex;align-items:center;gap:5px;margin-top:4px;padding:2px 6px;border-radius:5px;font-size:11px;font-weight:600;cursor:pointer;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}
.gos-edot{width:6px;height:6px;border-radius:50%;flex-shrink:0}
.gos-cal-nodate{margin-top:14px}
.gos-cal-nodate h4{font-size:12.5px;color:var(--text-muted);margin-bottom:8px;font-weight:600}
.gos-cal-nodate-list{display:flex;gap:8px;flex-wrap:wrap}
.gos-cal-pill{display:inline-flex;align-items:center;gap:6px;padding:5px 11px;font-size:11.5px;border:1px solid var(--border-strong);border-radius:20px;cursor:pointer;color:var(--text);background:var(--surface-2)}
.gos-cal-pill:hover{border-color:var(--accent)}
```

## 3.2 — Estado + helpers + renderers novos (inserir dentro do `<script>` principal, logo APÓS a função `_renderOSTable`)

Colar este bloco inteiro (é autocontido; só lê `_osList`, `_tiposOS`, e chama `openOSDetail`/`openModalOS`/`toast` — todos existentes):

```javascript
/* ═══ v63 · Gestão de OSs · Ribbon (Lista / Kanban / Calendário) ═══ */
let _osRibbonTab = 'lista';            // 'lista' | 'kanban' | 'calendario'
let _gosKanbanGroupBy = 'status';      // 'status' | 'tipo'
let _gosKanbanTipoFilter = new Set();
let _gosCalRef = new Date();

const _GOS_STATUS = {
  ABERTA:       { label:'Aberta',       color:'var(--st-aberta)' },
  EM_ANDAMENTO: { label:'Em andamento', color:'var(--st-andamento)' },
  CONCLUIDA:    { label:'Concluída',    color:'var(--st-concluida)' },
  CANCELADA:    { label:'Cancelada',    color:'var(--st-cancelada)' },
};
const _GOS_TIPO_PALETTE = ['#0d9488','#7c5cff','#0ea5e9','#d97706','#db2777','#2563eb','#16a34a','#b45309'];
const _GOS_MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

function _gosStatusKey(o){ return String(o.status||'').toUpperCase(); }
function _gosTipoNome(o){ return (_tiposOS.find(t=>t.Tipo_ID===o.tipo_os)?.Nome) || o.tipo_os || '—'; }
function _gosTipoColorMap(){
  const m = {};
  [...new Set(_osList.map(_gosTipoNome))].forEach((n,i)=> m[n] = _GOS_TIPO_PALETTE[i % _GOS_TIPO_PALETTE.length]);
  return m;
}
function _gosData(o){ return o.data_prevista ? String(o.data_prevista).slice(0,10) : null; }
function _gosFmt(d){ if(!d) return null; const [y,m,dd]=d.split('-'); return `${dd}/${m}/${y}`; }
function _gosOid(o){ return String(o.id_os||'').replace(/'/g,"\\'"); }
function _gosPrioTag(o){
  const P = { urgente:{l:'Urgente',bg:'#fee2e2',c:'#991b1b'}, alta:{l:'Alta',bg:'#ffedd5',c:'#9a3412'}, normal:{l:'Normal',bg:'#f1f5f9',c:'#475569'} };
  const p = P[(o.prioridade||'normal').toLowerCase()] || P.normal;
  return `<span class="gos-prio" style="background:${p.bg};color:${p.c}">${p.l}</span>`;
}
function gosEmConstrucao(feature){ toast('🚧 ' + (feature||'Recurso') + ' — em construção, chega em breve.', 'warn'); }

// ── Shell + dispatch de aba ──
function _renderOSRibbonShell(){
  const el = document.getElementById('viewOs');
  if (!el) return;
  el.innerHTML = `
    <div class="gos-root">
      <div class="gos-topbar">
        <div class="gos-page-title">Gestão de OSs</div>
        <div class="gos-page-sub">Kanban e calendário de agendamento das ordens de serviço</div>
      </div>
      <div class="gos-ribbon">
        <div class="gos-ribbon-tab ${_osRibbonTab==='lista'?'active':''}" onclick="gosSetTab('lista')">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/></svg>Lista</div>
        <div class="gos-ribbon-tab ${_osRibbonTab==='kanban'?'active':''}" onclick="gosSetTab('kanban')">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="5" height="16" rx="1"/><rect x="10" y="4" width="5" height="11" rx="1"/><rect x="17" y="4" width="4" height="14" rx="1"/></svg>Kanban</div>
        <div class="gos-ribbon-tab ${_osRibbonTab==='calendario'?'active':''}" onclick="gosSetTab('calendario')">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 9h18M8 3v4M16 3v4"/></svg>Calendário</div>
        <div class="gos-ribbon-actions">
          <button class="btn btn-primary" onclick="openModalOS()">+ Abrir OS</button>
        </div>
      </div>
      <div id="osRibbonContent"></div>
    </div>`;
}
function _gosRenderActiveTab(){
  if (_osRibbonTab === 'kanban')     return gosRenderKanban();
  if (_osRibbonTab === 'calendario') return gosRenderCalendario();
  _renderOSTable(_osSearch, _osFilterStatus, _osFilterPrioridade);   // Lista (existente)
}
function gosSetTab(tab){
  _osRibbonTab = tab;
  _renderOSRibbonShell();
  _gosRenderActiveTab();
}

// ── Kanban ──
function gosRenderKanban(){
  const cont = document.getElementById('osRibbonContent');
  if (!cont) return;
  const tipoColor = _gosTipoColorMap();
  const tiposPresentes = [...new Set(_osList.map(_gosTipoNome))];

  const chips = tiposPresentes.map(t=>{
    const on = _gosKanbanTipoFilter.has(t); const tt = t.replace(/'/g,"\\'");
    return `<span class="gos-chip ${on?'on':''}" onclick="gosToggleTipoFilter('${tt}')"><span class="gos-sw" style="background:${tipoColor[t]}"></span>${t}</span>`;
  }).join('');

  const bar = `<div class="gos-kanban-bar">
      <span class="gos-seg-label">Agrupar por</span>
      <div class="gos-seg">
        <button class="${_gosKanbanGroupBy==='status'?'active':''}" onclick="gosSetKanbanGroup('status')">Status</button>
        <button class="${_gosKanbanGroupBy==='tipo'?'active':''}" onclick="gosSetKanbanGroup('tipo')">Tipo</button>
      </div>
      <div class="gos-chips" style="margin-left:8px">${chips}</div>
    </div>`;

  const data = _gosKanbanTipoFilter.size
    ? _osList.filter(o=>_gosKanbanTipoFilter.has(_gosTipoNome(o)))
    : _osList.slice();

  let cols;
  if (_gosKanbanGroupBy==='status'){
    cols = Object.keys(_GOS_STATUS).map(k=>({ label:_GOS_STATUS[k].label, color:_GOS_STATUS[k].color, items:data.filter(o=>_gosStatusKey(o)===k) }));
  } else {
    cols = tiposPresentes.map(t=>({ label:t, color:tipoColor[t], items:data.filter(o=>_gosTipoNome(o)===t) }));
  }

  const board = `<div class="gos-kanban">` + cols.map(c=>`
      <div class="gos-kcol" ondragover="event.preventDefault()" ondrop="gosKanbanDrop(event)">
        <div class="gos-kcol-h"><span class="gos-hbar" style="background:${c.color}"></span>${c.label}<span class="gos-count">${c.items.length}</span></div>
        <div class="gos-klist">${ c.items.map(_gosKcard).join('') || '<div class="gos-kempty">—</div>' }</div>
      </div>`).join('') + `</div>`;

  cont.innerHTML = bar + board;
}
function _gosKcard(o){
  const tipoColor = _gosTipoColorMap();
  const tnome = _gosTipoNome(o); const d = _gosData(o); const sk = _gosStatusKey(o);
  const right = _gosKanbanGroupBy==='status'
    ? `<span class="gos-tp"><span class="gos-sw" style="background:${tipoColor[tnome]}"></span>${tnome}</span>`
    : `<span class="gos-badge" style="color:${(_GOS_STATUS[sk]||{}).color||'var(--text-muted)'}">${(_GOS_STATUS[sk]||{}).label||o.status||'—'}</span>`;
  const maq = o.maquina || o.maquina_label || '';
  return `<div class="gos-kcard" draggable="true" ondragstart="gosKanbanDragStart(event)" onclick="openOSDetail('${_gosOid(o)}')">
    <div class="gos-kcard-top"><span class="gos-osnum">${o.numero_os||'—'}</span>${_gosPrioTag(o)}<span style="margin-left:auto">${right}</span></div>
    <div class="gos-kcard-cli">${o.cliente||'—'}</div>
    ${maq?`<div class="gos-kcard-maq">🏭 ${maq}</div>`:''}
    <div class="gos-kcard-foot"><span class="gos-kcard-date ${d?'':'nodate'}">📅 ${d?_gosFmt(d):'Sem data'}</span></div>
  </div>`;
}
function gosSetKanbanGroup(g){ _gosKanbanGroupBy = g; gosRenderKanban(); }
function gosToggleTipoFilter(t){ _gosKanbanTipoFilter.has(t)?_gosKanbanTipoFilter.delete(t):_gosKanbanTipoFilter.add(t); gosRenderKanban(); }
function gosKanbanDragStart(e){ try{ e.dataTransfer.setData('text/plain','os'); }catch(_){} }
function gosKanbanDrop(e){ e.preventDefault(); gosEmConstrucao('Mudança de status arrastando o card'); }

// ── Calendário ──
function gosRenderCalendario(){
  const cont = document.getElementById('osRibbonContent');
  if (!cont) return;
  const y = _gosCalRef.getFullYear(), m = _gosCalRef.getMonth();
  const hoje = new Date();
  const todayStr = `${hoje.getFullYear()}-${String(hoje.getMonth()+1).padStart(2,'0')}-${String(hoje.getDate()).padStart(2,'0')}`;

  const legend = Object.keys(_GOS_STATUS).map(k=>`<span class="gos-lg"><span class="gos-sw" style="background:${_GOS_STATUS[k].color};border-radius:50%"></span>${_GOS_STATUS[k].label}</span>`).join('');

  const first=new Date(y,m,1), start=first.getDay(), dim=new Date(y,m+1,0).getDate(), dimPrev=new Date(y,m,0).getDate();
  const cells=[];
  for(let i=start-1;i>=0;i--) cells.push({d:dimPrev-i,out:true});
  for(let d=1;d<=dim;d++) cells.push({d,out:false});
  while(cells.length%7) cells.push({d:'',out:true});

  const byDay={};
  _osList.forEach(o=>{ const dd=_gosData(o); if(!dd) return; const p=dd.split('-').map(Number); if(p[0]===y && p[1]-1===m) (byDay[p[2]]=byDay[p[2]]||[]).push(o); });

  const weeks = cells.map(c=>{
    if(c.out) return `<div class="gos-cal-cell out"><span class="gos-cal-daynum">${c.d}</span></div>`;
    const dstr=`${y}-${String(m+1).padStart(2,'0')}-${String(c.d).padStart(2,'0')}`;
    const evs=(byDay[c.d]||[]).map(o=>{
      const col=(_GOS_STATUS[_gosStatusKey(o)]||{}).color||'var(--text-muted)';
      return `<div class="gos-cal-ev" style="background:${col}18;color:${col}" onclick="openOSDetail('${_gosOid(o)}')"><span class="gos-edot" style="background:${col}"></span>${(o.cliente||'—').split(' ')[0]} · ${String(o.numero_os||'').slice(-3)}</div>`;
    }).join('');
    return `<div class="gos-cal-cell ${dstr===todayStr?'today':''}"><span class="gos-cal-daynum">${c.d}</span>${evs}</div>`;
  }).join('');

  const semData=_osList.filter(o=>!_gosData(o));
  const nodate = semData.length ? `<div class="gos-cal-nodate"><h4>Sem data prevista · ${semData.length}</h4><div class="gos-cal-nodate-list">`+
    semData.map(o=>{ const col=(_GOS_STATUS[_gosStatusKey(o)]||{}).color||'var(--text-muted)'; return `<span class="gos-cal-pill" onclick="openOSDetail('${_gosOid(o)}')"><span class="gos-edot" style="background:${col}"></span>${o.numero_os||'—'} · ${o.cliente||'—'}</span>`; }).join('')+`</div></div>` : '';

  cont.innerHTML = `
    <div class="gos-cal-head">
      <div class="gos-cal-nav">
        <button class="btn btn-secondary btn-sm" onclick="gosCalMove(-1)">‹</button>
        <button class="btn btn-secondary btn-sm" onclick="gosCalMove(1)">›</button>
      </div>
      <div class="gos-cal-month">${_GOS_MESES[m]} ${y}</div>
      <button class="btn btn-secondary btn-sm" onclick="gosCalToday()">Hoje</button>
      <div class="gos-cal-legend">${legend}</div>
    </div>
    <div class="gos-cal-grid">
      <div class="gos-cal-dow"><div>Dom</div><div>Seg</div><div>Ter</div><div>Qua</div><div>Qui</div><div>Sex</div><div>Sáb</div></div>
      <div class="gos-cal-weeks">${weeks}</div>
    </div>
    ${nodate}`;
}
function gosCalMove(d){ _gosCalRef = new Date(_gosCalRef.getFullYear(), _gosCalRef.getMonth()+d, 1); gosRenderCalendario(); }
function gosCalToday(){ _gosCalRef = new Date(); gosRenderCalendario(); }
```

> Se `.btn-sm` não existir em produção, remova o `btn-sm` desses 3 botões (deixe só `btn btn-secondary`). Confirme com `grep -n "\.btn-sm" PCM_v62.html`.

## 3.3 — EDIÇÃO CIRÚRGICA A (obrigatória): substituir o corpo de `renderOS()`

Localize `async function renderOS() {` (âncora textual). **Substitua a função inteira** (do `async function renderOS() {` até o `}` que a fecha, imediatamente antes de `function _renderOSTable`) por:

```javascript
async function renderOS() {
  const el = document.getElementById('viewOs');
  if (!el) return;
  const temCache = _osList.length > 0;

  _renderOSRibbonShell();   // desenha ribbon + #osRibbonContent (aba ativa preservada)

  if (temCache) {
    _gosRenderActiveTab();
  } else {
    const cont = document.getElementById('osRibbonContent');
    if (cont) cont.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;padding:40px">
      <span style="color:var(--text-muted);font-size:13px">Carregando OS…</span></div>`;
  }

  let result = null;
  try {
    const [resOS, resTipos] = await Promise.all([
      gsGet('getOS', { includeClosed: 'true' }),
      _tiposOS.length ? Promise.resolve({ tipos: _tiposOS }) : gsGet('getTiposOS').catch(() => ({ tipos: [] }))
    ]);
    result = resOS;
    if (!_tiposOS.length) _tiposOS = (resTipos?.tipos || []);
  } catch(e) {
    const cont = document.getElementById('osRibbonContent');
    if (!temCache && cont) {
      cont.innerHTML = `<div class="empty"><div class="empty-icon">⚠️</div>
        <div class="empty-title">Erro ao carregar</div>
        <div class="empty-sub">${e.message}</div></div>`;
    } else {
      console.warn('[renderOS] atualização em segundo plano falhou, mantendo cache:', e.message);
    }
    return;
  }
  _osList = result?.os || result?.data || [];
  const cont = document.getElementById('osRibbonContent');
  if (cont && !_usuarioEstaDigitandoEm_(cont)) {
    _gosRenderActiveTab();
  }
}
```

**Se você não conseguir isolar exatamente onde `renderOS()` começa e termina** (ex.: o corpo divergiu do auditado) → **PARE** e devolva esta edição para o Claude Code. Não improvise a substituição.

## 3.4 — EDIÇÃO CIRÚRGICA B (obrigatória): alvo do `_renderOSTable`

Dentro de `function _renderOSTable(...)`, a **primeira** linha do corpo é:
```javascript
  const el = document.getElementById('viewOs');
```
Troque **apenas essa linha** por:
```javascript
  const el = document.getElementById('osRibbonContent') || document.getElementById('viewOs');
```
(Fallback para `#viewOs` garante que a Lista ainda funcione se algum caller antigo chamar `_renderOSTable` fora do shell.) **Não altere mais nada** dentro de `_renderOSTable` — os filtros, ordenação, badges e ações permanecem idênticos.

## 3.5 — EDIÇÃO CIRÚRGICA C (recomendada, não-bloqueante): remover cabeçalho duplicado do `_renderOSTable`

Como o shell Ribbon já mostra o título "Gestão de OSs" e o botão "Abrir OS", o cabeçalho interno do `_renderOSTable` fica duplicado. **Remova** este bloco do template de `_renderOSTable` (fica logo após `el.innerHTML = \``):
```html
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">
      <div>
        <h2 style="font-size:18px;font-weight:700;color:var(--text)">Ordens de Serviço</h2>
        <p style="font-size:12px;color:var(--text-muted);margin-top:2px">${_osList.length} OS cadastrada(s)</p>
      </div>
      <button class="btn btn-primary" onclick="openModalOS()">+ Nova OS</button>
    </div>
```
Deixe o restante (a barra de busca/filtros + a tabela) intacto. **Se houver qualquer dúvida sobre os limites exatos do bloco, PULE esta edição** (o resultado será só um título/botão duplicado na aba Lista — cosmético, não quebra nada).

---

## VALIDAÇÃO (obrigatória antes de entregar)

```bash
# 1) node check do <script> principal (extrair antes — node check não roda em HTML)
#    localize o <script> principal (o grande, com renderOS/_renderOSTable) e extraia com sed:
sed -n '{LINHA_INICIAL_SCRIPT},{LINHA_FINAL_SCRIPT}p' PCM_v63.html > /tmp/pcm_v63.js
node --check /tmp/pcm_v63.js   # deve passar sem erro

# 2) invariantes de id/roteamento
grep -n "id=\"navCatalog\"" PCM_v63.html            # deve haver exatamente 1, agora no grupo PAINEL DE GESTÃO
grep -c "id=\"navCatalog\"" PCM_v63.html            # == 1
grep -n "POSIÇÃO PENDENTE" PCM_v63.html             # == 0 (comentário removido)
grep -n "osRibbonContent" PCM_v63.html              # shell + _renderOSTable + renderOS
grep -n "function gosRenderKanban\|function gosRenderCalendario\|function _renderOSRibbonShell" PCM_v63.html  # 3 novas

# 3) accent/marca
grep -n -- "--accent: #f07725\|--sidebar-group: #9a9aa4\|.btn-primary{background:var(--accent)}" PCM_v63.html
```

**Regressões a garantir (conferir manualmente no diff):**
- `showView('catalog')`, `allViews` e `viewCatalog` **inalterados** (só o `<button navCatalog>` mudou de grupo).
- `_renderOSTable` só teve a 1ª linha trocada (+ opcionalmente o cabeçalho removido); filtros/ordenação/ações preservados.
- `openOSDetail`/`openModalOS`/`saveOSModal`/`deleteOSFromList` **não tocados**.
- Nenhum token `--blue*`/`--green*`/`--red*` alterado.

---

## ENTREGÁVEIS

1. **`PCM_v63.html`** — v62 intacto como entrada; v63 é arquivo novo, com bloco de changelog `<!-- v63 ... -->` no topo (acima do v62, sem `--` no texto).
2. **`CHANGELOG_SPRINT_v63.md`** — resumo das 3 tarefas + resultado do `node --check` + os greps de verificação.
3. **NÃO** entregar `ESTADO_ATUAL.md` (atualizado pelo Claude). **NÃO** reentregar `PCM_v62.html`.

**Deploy:** publicar `PCM_v63.html` no GitHub Pages. **Sem redeploy de GAS** (frontend-only).

---

## §CONTINGÊNCIA — o que devolver ao Claude Code (só se acionado)

O Codex deve conseguir **tudo** acima (código pré-escrito). As **únicas** partes que podem exigir julgamento são as **Edições Cirúrgicas A e B** (§3.3/§3.4) — elas tocam funções existentes. **Regra:** se as âncoras textuais de `renderOS()` ou da 1ª linha de `_renderOSTable` **não baterem exatamente**, NÃO improvise: pare e passe **apenas essas edições** para o Claude Code com esta nota:

> **Claude Code — 2 edições cirúrgicas no PCM (frontend-only, não tocar GAS/ESTADO_ATUAL):**
> (A) Substituir o corpo de `async function renderOS()` pela versão do §3.3 deste prompt (shell Ribbon + dispatch de aba, preservando cache-first + fetch). (B) Na 1ª linha de `_renderOSTable`, trocar o alvo de `#viewOs` para `document.getElementById('osRibbonContent') || document.getElementById('viewOs')`. Todo o resto (CSS §3.1, bloco JS §3.2, Tarefas 1 e 2) já foi aplicado pelo Codex — apenas integrar essas 2 edições, rodar `node --check` no `<script>` extraído e conferir os greps da §Validação.

Todo o resto — CSS escopado, os renderers novos, os helpers, o "em construção", as Tarefas 1 e 2 — é mecânico e **permanece no Codex**.
