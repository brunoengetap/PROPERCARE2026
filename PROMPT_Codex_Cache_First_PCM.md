# Prompt Codex — Cache-first + revalidação em background
# (PCM v50 → v51)

## Contexto

Cinco telas do PCM (Usuários, Perfis, Ordens de Serviço, Templates, Tipos
de OS) buscam os dados do GAS **toda vez** que a aba é aberta, mesmo que os
dados já tenham sido carregados minutos antes na mesma sessão — diferente
de Máquinas/Clientes/Preventivas, que renderizam instantâneo a partir de
`db` (cache local já carregado).

Essas 5 telas já guardam o resultado em variáveis de módulo depois do
primeiro carregamento (`_usuList`, `_perfilList`, `_osList`,
`_templatesList`, `_tiposOS`) — só que ninguém aproveita isso: cada
abertura de aba ignora o que já está em memória e busca tudo de novo,
travando a tela em "Carregando..." toda vez.

## Objetivo — padrão stale-while-revalidate

Para cada uma das 5 telas:
1. **Se já existe cache em memória** (a lista correspondente não está
   vazia): renderiza imediatamente a partir do cache — **zero espera**.
   Em seguida, dispara a busca no GAS **em segundo plano**, sem bloquear a
   tela.
2. **Se a busca em segundo plano tiver sucesso**: atualiza a variável de
   cache e re-renderiza — isso garante que o usuário **sempre acaba vendo
   a versão mais atual**, mesmo que tenha visto a versão em cache por um
   instante antes. Se o usuário estiver digitando no campo de busca da
   mesma tela nesse momento, **pula o re-render visual** (não atropela o
   que ele está digitando) mas mantém a variável de cache atualizada — a
   tela reflete o dado fresco na próxima interação.
3. **Se a busca em segundo plano falhar**: mantém os dados em cache na
   tela (não mostra erro, já que o usuário já está vendo algo válido) —
   só loga um `console.warn`.
4. **Se NÃO existe cache** (primeira abertura da sessão): comportamento
   atual — mostra "Carregando...", espera a busca, mostra erro se falhar.
   Isso não muda.

Esse padrão garante exatamente o que foi pedido: sem nenhuma mudança nos
dados, a aba abre instantânea; se algo mudou no servidor, o tempo extra da
busca em segundo plano acontece de forma invisível e a tela se atualiza
sozinha assim que a resposta chega — nunca fica mostrando uma versão
desatualizada por engano.

## Helper compartilhado — adicionar uma vez, perto de `showView`

```js
// v51 — Helper para o padrão cache-first + revalidação em segundo plano.
// Evita atropelar o usuário se ele estiver digitando num campo de busca
// dentro do container quando a atualização em background chega.
function _usuarioEstaDigitandoEm_(el) {
  const ativo = document.activeElement;
  return !!(el && ativo && ativo.tagName === 'INPUT' && el.contains(ativo));
}
```

---

## Mudança 1 — `renderUsuarios` (linha ~7390)

Localizar:
```js
async function renderUsuarios() {
  const el = document.getElementById('viewUsuarios');
  el.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;padding:40px">
    <span style="color:var(--text-muted);font-size:13px">Carregando usuários…</span></div>`;

  let tecResult = null, perfResult = null;
  try {
    [tecResult, perfResult] = await Promise.all([
      gsGet('getUsuarios'),
      gsGet('getPerfis')
    ]);
  } catch(e) {
    el.innerHTML = `<div class="empty"><div class="empty-icon">⚠️</div>
      <div class="empty-title">Erro ao carregar</div>
      <div class="empty-sub">${e.message}</div></div>`;
    return;
  }

  _usuList   = (tecResult?.tecnicos || tecResult?.usuarios || tecResult?.data || []);
  _perfilList = (perfResult?.perfis   || perfResult?.data || []);

  _renderUsuariosTable(_usuSearch);
}
```

Substituir por:
```js
async function renderUsuarios() {
  const el = document.getElementById('viewUsuarios');
  const temCache = _usuList.length > 0;

  if (temCache) {
    _renderUsuariosTable(_usuSearch);
  } else {
    el.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;padding:40px">
      <span style="color:var(--text-muted);font-size:13px">Carregando usuários…</span></div>`;
  }

  let tecResult = null, perfResult = null;
  try {
    [tecResult, perfResult] = await Promise.all([
      gsGet('getUsuarios'),
      gsGet('getPerfis')
    ]);
  } catch(e) {
    if (!temCache) {
      el.innerHTML = `<div class="empty"><div class="empty-icon">⚠️</div>
        <div class="empty-title">Erro ao carregar</div>
        <div class="empty-sub">${e.message}</div></div>`;
    } else {
      console.warn('[renderUsuarios] atualização em segundo plano falhou, mantendo cache:', e.message);
    }
    return;
  }

  _usuList   = (tecResult?.tecnicos || tecResult?.usuarios || tecResult?.data || []);
  _perfilList = (perfResult?.perfis   || perfResult?.data || []);

  if (!_usuarioEstaDigitandoEm_(el)) {
    _renderUsuariosTable(_usuSearch);
  }
}
```

---

## Mudança 2 — `renderPerfis` (linha ~7595)

Localizar:
```js
async function renderPerfis() {
  const el = document.getElementById('viewPerfis');
  el.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;padding:40px">
    <span style="color:var(--text-muted);font-size:13px">Carregando perfis…</span></div>`;

  let result = null;
  try {
    result = await gsGet('getPerfis');
  } catch(e) {
    el.innerHTML = `<div class="empty"><div class="empty-icon">⚠️</div>
      <div class="empty-title">Erro ao carregar</div>
      <div class="empty-sub">${e.message}</div></div>`;
    return;
  }
  _perfilList = result?.perfis || result?.data || [];
  _renderPerfisTable(_perfSearch);
}
```

Substituir por:
```js
async function renderPerfis() {
  const el = document.getElementById('viewPerfis');
  const temCache = _perfilList.length > 0;

  if (temCache) {
    _renderPerfisTable(_perfSearch);
  } else {
    el.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;padding:40px">
      <span style="color:var(--text-muted);font-size:13px">Carregando perfis…</span></div>`;
  }

  let result = null;
  try {
    result = await gsGet('getPerfis');
  } catch(e) {
    if (!temCache) {
      el.innerHTML = `<div class="empty"><div class="empty-icon">⚠️</div>
        <div class="empty-title">Erro ao carregar</div>
        <div class="empty-sub">${e.message}</div></div>`;
    } else {
      console.warn('[renderPerfis] atualização em segundo plano falhou, mantendo cache:', e.message);
    }
    return;
  }
  _perfilList = result?.perfis || result?.data || [];
  if (!_usuarioEstaDigitandoEm_(el)) {
    _renderPerfisTable(_perfSearch);
  }
}
```

---

## Mudança 3 — `renderOS` (linha ~7742)

Localizar:
```js
async function renderOS() {
  const el = document.getElementById('viewOs');
  if (!el) return;
  el.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;padding:40px">
    <span style="color:var(--text-muted);font-size:13px">Carregando OS…</span></div>`;

  let result = null;
  try {
    const [resOS, resTipos] = await Promise.all([
      gsGet('getOS'),
      _tiposOS.length ? Promise.resolve({ tipos: _tiposOS }) : gsGet('getTiposOS').catch(() => ({ tipos: [] }))
    ]);
    result = resOS;
    if (!_tiposOS.length) _tiposOS = (resTipos?.tipos || []);
  } catch(e) {
    el.innerHTML = `<div class="empty"><div class="empty-icon">⚠️</div>
      <div class="empty-title">Erro ao carregar</div>
      <div class="empty-sub">${e.message}</div></div>`;
    return;
  }
  _osList = result?.os || result?.data || [];
  _renderOSTable(_osSearch, _osFilterStatus, _osFilterPrioridade);
}
```

Substituir por (a lógica de cache do `_tiposOS` dentro daqui **não muda**,
só a de `_osList`):
```js
async function renderOS() {
  const el = document.getElementById('viewOs');
  if (!el) return;
  const temCache = _osList.length > 0;

  if (temCache) {
    _renderOSTable(_osSearch, _osFilterStatus, _osFilterPrioridade);
  } else {
    el.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;padding:40px">
      <span style="color:var(--text-muted);font-size:13px">Carregando OS…</span></div>`;
  }

  let result = null;
  try {
    const [resOS, resTipos] = await Promise.all([
      gsGet('getOS'),
      _tiposOS.length ? Promise.resolve({ tipos: _tiposOS }) : gsGet('getTiposOS').catch(() => ({ tipos: [] }))
    ]);
    result = resOS;
    if (!_tiposOS.length) _tiposOS = (resTipos?.tipos || []);
  } catch(e) {
    if (!temCache) {
      el.innerHTML = `<div class="empty"><div class="empty-icon">⚠️</div>
        <div class="empty-title">Erro ao carregar</div>
        <div class="empty-sub">${e.message}</div></div>`;
    } else {
      console.warn('[renderOS] atualização em segundo plano falhou, mantendo cache:', e.message);
    }
    return;
  }
  _osList = result?.os || result?.data || [];
  if (!_usuarioEstaDigitandoEm_(el)) {
    _renderOSTable(_osSearch, _osFilterStatus, _osFilterPrioridade);
  }
}
```

---

## Mudança 4 — `renderTemplateList` (linha ~9021): extrair render + cache-first

Esta função mistura busca e renderização no mesmo bloco — precisa separar
em uma função de UI (`_renderTemplateListUI`) reutilizável antes de aplicar
o padrão cache-first.

Localizar a função inteira:
```js
async function renderTemplateList() {
  const el = document.getElementById('viewTemplates');
  if (!el) return;
  if (typeof gsConnected !== 'undefined' && !gsConnected) {
    el.innerHTML = '<div style="padding:32px;text-align:center;color:var(--text-muted)">Sem conexão com o servidor. Conecte-se em Configurações.</div>';
    return;
  }
  el.innerHTML = '<div style="padding:32px;text-align:center;color:var(--text-muted)">Carregando…</div>';
  try {
    const r = await syncToGS('getTemplates', {});
    console.log('[getTemplates] raw response:', JSON.stringify(r));
    _templatesList = (r && r.templates) || [];
    if (!_templatesList.length) {
      el.innerHTML = `
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px">
          <h2 style="font-size:18px;font-weight:700;color:var(--text)">Templates de Pipeline</h2>
          <button class="btn btn-primary" onclick="openTemplateEditor(null)">+ Novo template</button>
        </div>
        <div style="padding:48px;text-align:center;color:var(--text-muted)">
          <div style="font-size:32px;margin-bottom:12px">📋</div>
          <div style="font-size:14px;font-weight:600;margin-bottom:6px">Nenhum template cadastrado</div>
          <div style="font-size:12px;margin-bottom:16px">Crie um template de pipeline para começar.</div>
          <button class="btn btn-primary" onclick="openTemplateEditor(null)">+ Criar primeiro template</button>
        </div>`;
      return;
    }
    el.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px">
        <h2 style="font-size:18px;font-weight:700;color:var(--text)">Templates de Pipeline</h2>
        <button class="btn btn-primary" onclick="openTemplateEditor(null)">+ Novo template</button>
      </div>
      <div id="tplListContainer"></div>`;
    const container = document.getElementById('tplListContainer');
    container.innerHTML = _templatesList.map(t => {
      const tarefas = JSON.parse(t.Tarefas_JSON || '[]');
      const fases = [...new Set(tarefas.map(x => x.fase).filter(Boolean))];
      const ativo = String(t.Ativo || 'SIM').toUpperCase() !== 'NÃO';
      return `
        <div class="tpl-list-card" style="${ativo ? '' : 'opacity:0.5'}">
          <div class="tpl-list-card-info">
            <div class="tpl-list-card-name">${t.Nome || '(sem nome)'}</div>
            <div class="tpl-list-card-meta">${tarefas.length} tarefa${tarefas.length !== 1 ? 's' : ''} · ${fases.length} fase${fases.length !== 1 ? 's' : ''} · ${ativo ? 'Ativo' : 'Inativo'}</div>
          </div>
          <div style="display:flex;gap:8px;flex-shrink:0">
            <button class="btn btn-secondary btn-sm" onclick="duplicarTemplate('${t.Template_ID}')">Duplicar</button>
            <button class="btn btn-primary btn-sm" onclick="openTemplateEditor('${t.Template_ID}')">Editar</button>
          </div>
        </div>`;
    }).join('');
  } catch(e) {
    if (e.message && e.message.includes('AUTH_GOOGLE')) { hubLogout(); return; }
    el.innerHTML = `
      <div style="padding:48px;text-align:center;color:var(--text-muted)">
        <div style="margin-bottom:12px;color:#f87171">Erro ao carregar templates.</div>
        <button class="btn btn-secondary" onclick="renderTemplateList()">Tentar novamente</button>
      </div>`;
  }
}
```

Substituir por (a lista de tarefas por template, ícones e botões
permanecem idênticos — só reorganizados em duas funções):
```js
function _renderTemplateListUI() {
  const el = document.getElementById('viewTemplates');
  if (!el) return;
  if (!_templatesList.length) {
    el.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px">
        <h2 style="font-size:18px;font-weight:700;color:var(--text)">Templates de Pipeline</h2>
        <button class="btn btn-primary" onclick="openTemplateEditor(null)">+ Novo template</button>
      </div>
      <div style="padding:48px;text-align:center;color:var(--text-muted)">
        <div style="font-size:32px;margin-bottom:12px">📋</div>
        <div style="font-size:14px;font-weight:600;margin-bottom:6px">Nenhum template cadastrado</div>
        <div style="font-size:12px;margin-bottom:16px">Crie um template de pipeline para começar.</div>
        <button class="btn btn-primary" onclick="openTemplateEditor(null)">+ Criar primeiro template</button>
      </div>`;
    return;
  }
  el.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px">
      <h2 style="font-size:18px;font-weight:700;color:var(--text)">Templates de Pipeline</h2>
      <button class="btn btn-primary" onclick="openTemplateEditor(null)">+ Novo template</button>
    </div>
    <div id="tplListContainer"></div>`;
  const container = document.getElementById('tplListContainer');
  container.innerHTML = _templatesList.map(t => {
    const tarefas = JSON.parse(t.Tarefas_JSON || '[]');
    const fases = [...new Set(tarefas.map(x => x.fase).filter(Boolean))];
    const ativo = String(t.Ativo || 'SIM').toUpperCase() !== 'NÃO';
    return `
      <div class="tpl-list-card" style="${ativo ? '' : 'opacity:0.5'}">
        <div class="tpl-list-card-info">
          <div class="tpl-list-card-name">${t.Nome || '(sem nome)'}</div>
          <div class="tpl-list-card-meta">${tarefas.length} tarefa${tarefas.length !== 1 ? 's' : ''} · ${fases.length} fase${fases.length !== 1 ? 's' : ''} · ${ativo ? 'Ativo' : 'Inativo'}</div>
        </div>
        <div style="display:flex;gap:8px;flex-shrink:0">
          <button class="btn btn-secondary btn-sm" onclick="duplicarTemplate('${t.Template_ID}')">Duplicar</button>
          <button class="btn btn-primary btn-sm" onclick="openTemplateEditor('${t.Template_ID}')">Editar</button>
        </div>
      </div>`;
  }).join('');
}

async function renderTemplateList() {
  const el = document.getElementById('viewTemplates');
  if (!el) return;
  if (typeof gsConnected !== 'undefined' && !gsConnected) {
    el.innerHTML = '<div style="padding:32px;text-align:center;color:var(--text-muted)">Sem conexão com o servidor. Conecte-se em Configurações.</div>';
    return;
  }
  const temCache = _templatesList.length > 0;
  if (temCache) {
    _renderTemplateListUI();
  } else {
    el.innerHTML = '<div style="padding:32px;text-align:center;color:var(--text-muted)">Carregando…</div>';
  }
  try {
    const r = await syncToGS('getTemplates', {});
    _templatesList = (r && r.templates) || [];
    _renderTemplateListUI();
  } catch(e) {
    if (e.message && e.message.includes('AUTH_GOOGLE')) { hubLogout(); return; }
    if (!temCache) {
      el.innerHTML = `
        <div style="padding:48px;text-align:center;color:var(--text-muted)">
          <div style="margin-bottom:12px;color:#f87171">Erro ao carregar templates.</div>
          <button class="btn btn-secondary" onclick="renderTemplateList()">Tentar novamente</button>
        </div>`;
    } else {
      console.warn('[renderTemplateList] atualização em segundo plano falhou, mantendo cache:', e.message);
    }
  }
}
```

Nota: essa tela não tem campo de busca com input próprio (é lista direta),
por isso não usa `_usuarioEstaDigitandoEm_` aqui — não é necessário.

---

## Mudança 5 — `renderTiposOSList` (linha ~9349): mesmo padrão de extração

Localizar a função inteira (idêntica ao que está hoje no arquivo, do
`async function renderTiposOSList() {` até o fechamento da função, logo
antes de `async function openTipoOSModal`).

Substituir por:
```js
function _renderTiposOSListUI() {
  const el = document.getElementById('viewTiposOS');
  if (!el) return;
  if (!_tiposOS.length) {
    el.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px">
        <h2 style="font-size:18px;font-weight:700;color:var(--text)">Tipos de OS</h2>
        <button class="btn btn-primary" onclick="openTipoOSModal(null)">+ Novo tipo</button>
      </div>
      <div style="padding:48px;text-align:center;color:var(--text-muted)">
        <div style="font-size:32px;margin-bottom:12px">🗂</div>
        <div style="font-size:14px;font-weight:600;margin-bottom:6px">Nenhum tipo de OS cadastrado</div>
        <div style="font-size:12px;margin-bottom:16px">Crie um tipo de OS para categorizar as ordens de serviço.</div>
        <button class="btn btn-primary" onclick="openTipoOSModal(null)">+ Criar primeiro tipo</button>
      </div>`;
    return;
  }
  el.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px">
      <h2 style="font-size:18px;font-weight:700;color:var(--text)">Tipos de OS</h2>
      <button class="btn btn-primary" onclick="openTipoOSModal(null)">+ Novo tipo</button>
    </div>
    <div id="tiposOSContainer"></div>`;
  const container = document.getElementById('tiposOSContainer');
  container.innerHTML = _tiposOS.map(tipo => {
    const ativo = String(tipo.Ativo || 'SIM').toUpperCase() !== 'NÃO';
    const tplEncontrado = _templatesList.find(t => t.Template_ID === tipo.Template_ID_Padrao);
    const tplNome = tplEncontrado ? tplEncontrado.Nome : (tipo.Template_ID_Padrao ? `${tipo.Template_ID_Padrao} (template não encontrado)` : '—');
    return `
      <div class="tipo-os-card ${ativo ? '' : 'inativo'}">
        <div class="tipo-os-card-header">
          <div>
            <div class="tipo-os-id">${tipo.Tipo_ID || ''}</div>
            <div class="tipo-os-nome">${tipo.Nome || ''}</div>
          </div>
          <span class="${ativo ? 'tipo-os-badge-ativo' : 'tipo-os-badge-inativo'}">${ativo ? 'Ativo' : 'Inativo'}</span>
        </div>
        <div class="tipo-os-template">Template padrão: ${tplNome}</div>
        ${tipo.Descricao ? `<div class="tipo-os-desc">${tipo.Descricao}</div>` : ''}
        <div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap">
          <button class="btn btn-secondary btn-sm" onclick="openTipoOSModal('${tipo.Tipo_ID}')">Editar</button>
          <button class="btn btn-secondary btn-sm" onclick="toggleTipoOS('${tipo.Tipo_ID}',${ativo})">${ativo ? 'Inativar' : 'Reativar'}</button>
          ${!ativo ? `<button class="btn btn-secondary btn-sm" style="color:#f87171" onclick="deleteTipoOSAction('${tipo.Tipo_ID}','${(tipo.Nome||'').replace(/'/g,"\\'")}')">Excluir</button>` : ''}
        </div>
      </div>`;
  }).join('');
}

async function renderTiposOSList() {
  const el = document.getElementById('viewTiposOS');
  if (!el) return;
  if (typeof gsConnected !== 'undefined' && !gsConnected) {
    el.innerHTML = '<div style="padding:32px;text-align:center;color:var(--text-muted)">Sem conexão com o servidor. Conecte-se em Configurações.</div>';
    return;
  }
  const temCache = _tiposOS.length > 0;
  if (temCache) {
    _renderTiposOSListUI();
  } else {
    el.innerHTML = '<div style="padding:32px;text-align:center;color:var(--text-muted)">Carregando…</div>';
  }
  try {
    const [rt, rtpl] = await Promise.all([
      gsGet('getTiposOS'),
      _templatesList.length ? Promise.resolve({ templates: _templatesList }) : syncToGS('getTemplates', {}),
    ]);
    _tiposOS = rt.tipos || [];
    if (!_templatesList.length) _templatesList = rtpl.templates || [];
    _renderTiposOSListUI();
  } catch(e) {
    if (e.message && e.message.includes('AUTH_GOOGLE')) { hubLogout(); return; }
    if (!temCache) {
      el.innerHTML = `
        <div style="padding:48px;text-align:center;color:var(--text-muted)">
          <div style="margin-bottom:12px;color:#f87171">Erro ao carregar tipos de OS.</div>
          <button class="btn btn-secondary" onclick="renderTiposOSList()">Tentar novamente</button>
        </div>`;
    } else {
      console.warn('[renderTiposOSList] atualização em segundo plano falhou, mantendo cache:', e.message);
    }
  }
}
```

---

## Regras importantes

- Placar o helper `_usuarioEstaDigitandoEm_` **uma única vez** no arquivo
  (perto de `showView`, por exemplo) — não duplicar.
- **Não alterar** `_renderUsuariosTable`, `_renderPerfisTable`,
  `_renderOSTable` — só as funções que as chamam.
- **Não alterar** o comportamento de escrita (salvar usuário, salvar
  perfil, salvar OS, salvar template, salvar tipo de OS) — este prompt é
  só sobre leitura/renderização.
- **Não tocar** em GAS nem PCF neste prompt.
- Manter o `console.log('[getTemplates] raw response...')` como está (não
  é escopo desta mudança) — só não duplicar se por acaso a extração
  esbarrar nele.
- Cada uma das 5 funções deve continuar utilizável isoladamente (podem
  continuar sendo chamadas de outros lugares do código, como
  `_abrirTrocarPipeline` chama `syncToGS('getTemplates', {})`
  diretamente, sem passar por `renderTemplateList` — isso não muda).

## Changelog (topo do arquivo, dentro do comentário `<!-- -->` já existente)

```
// PCM_v51.html
// v51 — Cache-first + revalidação em background nas 5 telas administrativas
//   - Usuários, Perfis, Ordens de Serviço, Templates e Tipos de OS: se já
//     há dados em memória de uma visita anterior na mesma sessão, a tela
//     renderiza instantânea a partir do cache e busca a versão atual do
//     GAS em segundo plano, sem travar a UI. Sem cache (primeira abertura
//     da sessão), comportamento inalterado (mostra "Carregando...").
//   - Nova função _usuarioEstaDigitandoEm_: evita que a atualização em
//     background substitua a tela enquanto o usuário está digitando numa
//     busca — a variável de cache é atualizada de qualquer forma, a tela
//     só não pisca no meio da digitação.
//   - Templates e Tipos de OS: lógica de renderização extraída para
//     _renderTemplateListUI/_renderTiposOSListUI, reutilizável entre o
//     caminho de cache e o caminho pós-busca. Nenhuma mudança visual ou
//     de comportamento de escrita.
```

## Checklist de teste

1. `node --check` no script extraído.
2. Abrir cada uma das 5 telas pela primeira vez na sessão — confirmar que
   ainda mostra "Carregando..." e funciona igual a antes.
3. Sair da tela e voltar — confirmar que agora abre instantânea.
4. Editar algo no GAS diretamente na planilha (ex.: mudar o nome de um
   usuário), voltar pra aba já com cache — confirmar que a tela mostra o
   dado antigo por um instante e depois atualiza sozinha para o novo, sem
   precisar de F5.
5. Digitar no campo de busca de Usuários bem no momento em que a
   atualização em background chega (difícil de cronometrar, mas vale
   tentar) — confirmar que não perde o texto digitado.
6. Confirmar que salvar um novo usuário/perfil/OS/template/tipo continua
   funcionando normalmente (esta mudança não deveria afetar escrita, mas
   vale confirmar).
