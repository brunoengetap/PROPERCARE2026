# Prompt Codex — ProperFlow Sessão C
## Parametrização global de turno (regime de trabalho da Proper)

---

## 0. Contexto do projeto

ProperHub — sistema de gestão de campo para manutenção de compressores (Proper
Compressores). Arquitetura:

- **Backend**: Google Apps Script (GAS), arquivo `GAS_properCare_vNN.js`, conectado a
  Google Sheets (banco) e Google Drive (fotos). Único backend.
- **PCM** (`PCM_vNN.html`): painel admin desktop.

Os arquivos de entrada estão na **raiz deste repositório**, sem subpastas. Identifique
a versão mais recente de cada um pelo nome do arquivo. **Esta sessão toca apenas GAS
e PCM** — não toque no PCF.

---

## 1. Objetivo desta sessão

Criar uma tela de parametrização de **regime de trabalho global da Proper** (não por
usuário, não por perfil — um único registro válido para toda a empresa): horário de
início/fim do turno, intervalos previstos (ex: almoço), e dias úteis da semana.

Este registro **não tem efeito automático ainda** nesta sessão — ele só precisa
existir, ser editável pelo admin e ser persistido. O cálculo de dedução de tempo fora
do turno (cronômetro de tarefas descontando esse regime) é uma sessão futura que vai
**consumir** esse dado; não implemente nada de cálculo de tempo aqui.

A tela fica dentro do menu **"Configurações"** já existente no PCM (view `config`,
função `renderConfigStats()`), como um novo card.

---

## 2. Regras gerais (obrigatórias)

- **Nunca sobrescreva os arquivos de entrada.** Grave a saída em arquivos novos
  versionados.
- **Modificações cirúrgicas.** Não reescreva blocos que já funcionam.
- **Audite antes de escrever.** Rode `grep -n` para confirmar nomes exatos antes de
  editar, caso a versão recebida divirja do descrito aqui.
- Use **"usuário"**, nunca "técnico", em texto novo de UI ou comentário.
- Siga o padrão de código já estabelecido no arquivo (funções `getXxx`/`saveXxx`,
  `ensureSheetHeaders`, `getOrCreateSheet`, `isActive_`, etc.) — não invente um padrão
  novo de acesso a planilha.

---

## 3. PARTE 1 — GAS (`GAS_properCare_vNN.js`)

### 3.1 — Nova aba `PARAMETROS_TURNO` em `HEADERS`

Localize o bloco de definições de `HEADERS` (mesmo lugar onde estão
`HEADERS.PIPELINE_TEMPLATES`, `HEADERS.CAT_TIPOS_OS`, etc. — procure por
`HEADERS.CAT_TIPOS_OS = [`). Adicione, logo após esse bloco, uma nova definição:

```js
// vNN — Sessão C: parametrização global de turno (ProperFlow)
HEADERS.PARAMETROS_TURNO = [
  'id','turno_inicio','turno_fim','intervalos_json','dias_uteis_json',
  'Ativo','Tipo_Registro','Created_At','Updated_At','Updated_By'
];
```

> `id` será sempre a string fixa `'GLOBAL'` — esta tabela nunca terá mais de uma
> linha ativa. `intervalos_json` é uma lista de objetos `{nome, inicio, fim}` (ex:
> `[{"nome":"Almoço","inicio":"12:00","fim":"13:00"}]`). `dias_uteis_json` é uma lista
> de inteiros de 1 (segunda) a 7 (domingo), ex: `[1,2,3,4,5]` para segunda a sexta.

### 3.2 — `getParametrosTurno()` — leitura com valores padrão

Adicione esta função em qualquer ponto do arquivo próximo às demais funções
`getXxx` de configuração (ex: perto de `getTiposOS` ou `getPerfis`):

```js
// ── getParametrosTurno ──────────────────────────────────────────────────────
function getParametrosTurno() {
  ensureSheetHeaders('PARAMETROS_TURNO', HEADERS.PARAMETROS_TURNO);
  var rows = getSheetData('PARAMETROS_TURNO');
  var atual = rows.find(function(r) { return String(r.id) === 'GLOBAL' && isActive_(r.Ativo); });

  if (!atual) {
    // Valores padrão — usados apenas para exibição até o admin salvar pela 1ª vez.
    return {
      status: 'ok',
      parametros: {
        id: 'GLOBAL',
        turno_inicio: '08:00',
        turno_fim: '18:00',
        intervalos_json: JSON.stringify([{ nome: 'Almoço', inicio: '12:00', fim: '13:00' }]),
        dias_uteis_json: JSON.stringify([1, 2, 3, 4, 5])
      },
      is_default: true
    };
  }
  return { status: 'ok', parametros: atual, is_default: false };
}
```

### 3.3 — `saveParametrosTurno(body)` — upsert de registro único

Adicione logo abaixo de `getParametrosTurno`:

```js
// ── saveParametrosTurno ─────────────────────────────────────────────────────
function saveParametrosTurno(body) {
  ensureSheetHeaders('PARAMETROS_TURNO', HEADERS.PARAMETROS_TURNO);
  if (!body.turno_inicio || !body.turno_fim) {
    return { status: 'error', error: 'turno_inicio e turno_fim são obrigatórios' };
  }
  var sheet   = getOrCreateSheet('PARAMETROS_TURNO', HEADERS.PARAMETROS_TURNO);
  var data    = sheet.getDataRange().getValues();
  var headers = data[0] || HEADERS.PARAMETROS_TURNO;
  var idx = {}; headers.forEach(function(h, i) { idx[h] = i; });
  var now = new Date().toISOString();
  var responsavel = body.usuario || 'admin';
  var intervalosJson = typeof body.intervalos === 'string'
    ? body.intervalos : JSON.stringify(body.intervalos || []);
  var diasUteisJson = typeof body.dias_uteis === 'string'
    ? body.dias_uteis : JSON.stringify(body.dias_uteis || []);

  for (var i = 1; i < data.length; i++) {
    if (String(data[i][idx.id]) === 'GLOBAL') {
      var row = i + 1;
      sheet.getRange(row, idx.turno_inicio + 1).setValue(body.turno_inicio);
      sheet.getRange(row, idx.turno_fim + 1).setValue(body.turno_fim);
      sheet.getRange(row, idx.intervalos_json + 1).setValue(intervalosJson);
      sheet.getRange(row, idx.dias_uteis_json + 1).setValue(diasUteisJson);
      sheet.getRange(row, idx.Ativo + 1).setValue('SIM');
      sheet.getRange(row, idx.Updated_At + 1).setValue(now);
      sheet.getRange(row, idx.Updated_By + 1).setValue(responsavel);
      return { status: 'ok', action: 'updated' };
    }
  }

  // Primeira gravação — cria a linha única
  var novo = {
    id: 'GLOBAL',
    turno_inicio: body.turno_inicio,
    turno_fim: body.turno_fim,
    intervalos_json: intervalosJson,
    dias_uteis_json: diasUteisJson,
    Ativo: 'SIM',
    Tipo_Registro: 'PRODUCAO',
    Created_At: now,
    Updated_At: now,
    Updated_By: responsavel
  };
  sheet.appendRow(headers.map(function(h) { return novo[h] !== undefined ? novo[h] : ''; }));
  return { status: 'ok', action: 'created' };
}
```

### 3.4 — Roteamento em `doGet`/`doPost`

Em `doGet`, localize:

```js
      case 'getNotificacoes':
        result = getNotificacoes(params.usuario);
        break;
```

Adicione logo após (mesmo bloco, antes do `default:`):

```js
      case 'getParametrosTurno':
        result = getParametrosTurno();
        break;
```

Em `doPost`, localize:

```js
      case 'saveTipoOS':
        result = saveTipoOS(body);
        break;
```

Adicione logo após:

```js
      case 'saveParametrosTurno':
        result = saveParametrosTurno(body);
        break;
```

---

## 4. PARTE 2 — PCM (`PCM_vNN.html`)

### 4.1 — Novo card dentro de `renderConfigStats()`

Localize a função `renderConfigStats()`. Dentro do template literal que monta
`el.innerHTML`, logo **após** o painel `<div class="gs-panel">...</div>` (Google
Sheets) e **antes** do `<!-- ── PAINEL DE AUDITORIA ── -->`, insira o novo card:

```html
    <!-- ── REGIME DE TRABALHO (PROPERFLOW) ── -->
    <div class="card" id="cardRegimeTrabalho" style="margin-top:16px">
      <div style="font-size:14px;font-weight:700;margin-bottom:4px">⏰ Regime de trabalho — Proper</div>
      <div style="font-size:12px;color:var(--text2);margin-bottom:14px">
        Parâmetro único, válido para toda a empresa. Usado pelo ProperFlow para calcular
        tempo efetivo de execução das tarefas do pipeline.
      </div>
      <div style="display:flex;gap:16px;margin-bottom:14px">
        <div style="flex:1">
          <label class="form-label">Início do turno</label>
          <input type="time" id="turnoInicioInput" class="form-input">
        </div>
        <div style="flex:1">
          <label class="form-label">Fim do turno</label>
          <input type="time" id="turnoFimInput" class="form-input">
        </div>
      </div>
      <div style="margin-bottom:14px">
        <label class="form-label">Dias úteis</label>
        <div id="diasUteisCheckboxes" style="display:flex;gap:10px;flex-wrap:wrap;margin-top:4px">
          <!-- checkboxes gerados dinamicamente -->
        </div>
      </div>
      <div style="margin-bottom:10px">
        <label class="form-label">Intervalos previstos (ex: almoço)</label>
        <div id="turnoIntervalosList" style="margin-top:6px"></div>
        <button class="btn btn-secondary btn-sm" style="margin-top:8px" onclick="_addIntervaloTurno()">+ Adicionar intervalo</button>
      </div>
      <button class="btn btn-primary" onclick="saveParametrosTurno()">Salvar regime de trabalho</button>
      <span id="turnoSaveStatus" style="font-size:11px;color:var(--text2);margin-left:10px"></span>
    </div>
```

### 4.2 — Estado em memória e funções de carregamento/renderização

Adicione, em qualquer ponto do arquivo próximo às demais variáveis globais de estado
de tela (ex: perto de `_perfilList`, `_editorTemplate`):

```js
let _turnoIntervalos = [];
const DIAS_SEMANA = [
  { v: 1, l: 'Seg' }, { v: 2, l: 'Ter' }, { v: 3, l: 'Qua' }, { v: 4, l: 'Qui' },
  { v: 5, l: 'Sex' }, { v: 6, l: 'Sáb' }, { v: 7, l: 'Dom' }
];
```

Adicione a função de carregamento (ela é chamada de dentro de `renderConfigStats()`,
que é síncrona — não use `await` na chamada, só dispare a função assíncrona):

```js
async function loadParametrosTurno() {
  try {
    const r = await gsGet('getParametrosTurno');
    const p = r?.parametros || {};
    document.getElementById('turnoInicioInput').value = p.turno_inicio || '08:00';
    document.getElementById('turnoFimInput').value = p.turno_fim || '18:00';
    _turnoIntervalos = JSON.parse(p.intervalos_json || '[]');
    const diasAtivos = JSON.parse(p.dias_uteis_json || '[1,2,3,4,5]');
    _renderDiasUteisCheckboxes(diasAtivos);
    _renderTurnoIntervalos();
  } catch(e) {
    console.warn('Falha ao carregar parâmetros de turno:', e);
  }
}

function _renderDiasUteisCheckboxes(ativos) {
  const el = document.getElementById('diasUteisCheckboxes');
  if (!el) return;
  el.innerHTML = DIAS_SEMANA.map(d => `
    <label style="display:flex;align-items:center;gap:4px;font-size:12px;cursor:pointer">
      <input type="checkbox" class="dia-util-cb" value="${d.v}" ${ativos.includes(d.v) ? 'checked' : ''}>
      ${d.l}
    </label>`).join('');
}

function _renderTurnoIntervalos() {
  const el = document.getElementById('turnoIntervalosList');
  if (!el) return;
  if (!_turnoIntervalos.length) {
    el.innerHTML = '<span style="font-size:12px;color:var(--text-muted)">Nenhum intervalo cadastrado.</span>';
    return;
  }
  el.innerHTML = _turnoIntervalos.map((iv, idx) => `
    <div style="display:flex;gap:8px;align-items:center;margin-bottom:6px">
      <input type="text" class="form-input" style="flex:1" placeholder="Nome (ex: Almoço)"
        value="${escHtml(iv.nome || '')}" onchange="_turnoIntervalos[${idx}].nome=this.value">
      <input type="time" class="form-input" style="width:110px"
        value="${iv.inicio || ''}" onchange="_turnoIntervalos[${idx}].inicio=this.value">
      <span style="font-size:12px;color:var(--text-muted)">até</span>
      <input type="time" class="form-input" style="width:110px"
        value="${iv.fim || ''}" onchange="_turnoIntervalos[${idx}].fim=this.value">
      <button class="btn btn-secondary btn-sm" onclick="_removerIntervaloTurno(${idx})">✕</button>
    </div>`).join('');
}

function _addIntervaloTurno() {
  _turnoIntervalos.push({ nome: '', inicio: '', fim: '' });
  _renderTurnoIntervalos();
}

function _removerIntervaloTurno(idx) {
  _turnoIntervalos.splice(idx, 1);
  _renderTurnoIntervalos();
}

async function saveParametrosTurno() {
  const turnoInicio = document.getElementById('turnoInicioInput').value;
  const turnoFim = document.getElementById('turnoFimInput').value;
  if (!turnoInicio || !turnoFim) {
    toast('Preencha início e fim do turno.', 'error');
    return;
  }
  const diasUteis = Array.from(document.querySelectorAll('.dia-util-cb:checked')).map(cb => parseInt(cb.value));
  const statusEl = document.getElementById('turnoSaveStatus');
  statusEl.textContent = 'Salvando...';
  try {
    await syncToGS('saveParametrosTurno', {
      turno_inicio: turnoInicio,
      turno_fim: turnoFim,
      intervalos: _turnoIntervalos,
      dias_uteis: diasUteis,
      usuario: window.PROPER_SESSION?.tecnico?.nome || ''
    });
    statusEl.textContent = '';
    toast('Regime de trabalho salvo!', 'success');
  } catch(e) {
    statusEl.textContent = '';
    toast('Erro ao salvar: ' + e.message, 'error');
  }
}
```

### 4.3 — Disparar o carregamento ao abrir a aba Configurações

Localize, dentro de `showView(v)`:

```js
  } else if(v==='config'){
    renderConfigStats();
    if(gsUrl) document.getElementById('gsUrlInput').value=gsUrl;
```

Adicione a chamada de carregamento logo após (sem `await`, pois `showView` é
síncrona — `loadParametrosTurno` cuida de popular os campos assim que a resposta
chegar):

```js
  } else if(v==='config'){
    renderConfigStats();
    if(gsUrl) document.getElementById('gsUrlInput').value=gsUrl;
    loadParametrosTurno();
```

---

## 5. Checklist de verificação (rodar antes de finalizar)

- [ ] `HEADERS.PARAMETROS_TURNO` definido, com comentário de versão.
- [ ] `getParametrosTurno` retorna valores padrão sensatos quando a aba está vazia
      (`is_default: true`), e o registro real quando já foi salvo ao menos uma vez.
- [ ] `saveParametrosTurno` nunca cria uma segunda linha — sempre faz upsert na linha
      `id === 'GLOBAL'`.
- [ ] Roteamento: `getParametrosTurno` em `doGet`, `saveParametrosTurno` em `doPost`.
- [ ] No PCM, o card aparece dentro da view "Configurações" já existente, sem quebrar
      o painel do Google Sheets nem o painel de Saúde do sistema ao redor.
- [ ] Ao abrir a aba Configurações, os campos de turno/intervalos/dias úteis vêm
      preenchidos automaticamente (carregamento via `loadParametrosTurno`).
- [ ] É possível adicionar e remover intervalos dinamicamente sem recarregar a
      página, e os valores digitados não se perdem ao adicionar/remover outro
      intervalo.
- [ ] Salvar funciona tanto na primeira vez (criação) quanto em edições seguintes
      (atualização) — teste mental: salvar duas vezes seguidas não pode gerar duas
      linhas em `PARAMETROS_TURNO`.
- [ ] Nenhuma alteração foi feita em PCF.
- [ ] Nenhum arquivo de entrada foi sobrescrito — saída em arquivos novos
      versionados.
- [ ] Nenhuma ocorrência nova de "técnico" foi introduzida em texto de UI.

---

## 6. Entrega esperada

- `GAS_properCare_v{NN+1}.js`
- `PCM_v{NN+1}.html`
- Resumo curto, ao final, listando exatamente quais funções/linhas foram alteradas em
  cada arquivo, para auditoria antes de subir pra produção.
