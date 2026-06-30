# Prompt Codex — ProperFlow Sessão B
## Generalizar tarefas "auto" para aceitar qualquer checklist externo (sem hardcode)

---

## 0. Contexto do projeto

Você está trabalhando no **ProperHub**, sistema de gestão de campo para manutenção de
compressores (Proper Compressores). Arquitetura:

- **Backend**: Google Apps Script (GAS), arquivo `GAS_properCare_vNN.js`, conectado a
  Google Sheets (banco) e Google Drive (fotos). Único backend do ecossistema.
- **PCM** (`PCM_vNN.html`): painel admin desktop — onde o admin cadastra templates de
  pipeline e acompanha OS.
- **PCF** (`PCF_index_vNN.html`): app mobile do técnico de campo — onde o pipeline
  roda de fato para quem está em campo.

Os arquivos de entrada estão na **raiz deste repositório**, sem subpastas. Identifique
a versão mais recente de cada um pelo nome do arquivo. **Esta sessão toca os três
arquivos** (GAS, PCM e PCF).

---

## 1. Objetivo desta sessão

Hoje, uma tarefa do pipeline do tipo "automático" (vinculada a um formulário externo)
só funciona para 4 tipos fixos, hardcoded em três lugares diferentes do código:
`form08`, `form09`, `form10`, `rotores` (mais `inspecao`/`preventiva`, que não têm
formulário próprio vinculado no PCF hoje). Isso significa que **toda vez que um
checklist novo for criado** (um app standalone, no mesmo padrão do Form08, hospedado
em `grupotap.github.io`), seria necessário editar código em 3 arquivos só para
vinculá-lo a uma tarefa de pipeline.

O objetivo é eliminar esse hardcode, **sem quebrar nada que já está em produção**:
depois desta sessão, cadastrar um checklist novo deve ser possível só preenchendo
campos no editor de template do PCM — nome do tipo + URL do checklist — sem precisar
de nenhuma sessão de código nova.

---

## 2. Regras gerais (obrigatórias)

- **Nunca sobrescreva os arquivos de entrada.** Grave a saída em arquivos novos
  versionados (próxima versão de cada um).
- **Modificações cirúrgicas.** Não reescreva blocos que já funcionam.
- **Audite antes de escrever.** Rode `grep -n` para confirmar nomes exatos de
  variáveis/funções/IDs antes de editar, caso a versão recebida tenha diferenças em
  relação ao que está descrito aqui.
- **Compatibilidade retroativa é crítica nesta sessão.** Existem Ordens de Serviço
  **já em produção, com pipelines já instanciados**, usando os tipos antigos
  (`auto:form08`, `auto:rotores`, etc.) sem o campo novo `Form_URL` preenchido (essas
  linhas já existem na planilha `PIPELINE_TAREFAS` e não serão re-instanciadas). O
  comportamento para esses casos **tem que continuar idêntico ao atual** — toda
  mudança no PCF precisa ter fallback para o comportamento antigo quando o campo novo
  estiver vazio.
- Use **"usuário"**, nunca "técnico", em texto novo de UI ou comentário.

---

## 3. PARTE 1 — GAS (`GAS_properCare_vNN.js`)

### 3.1 — Adicionar coluna `Form_URL` em `HEADERS.PIPELINE_TAREFAS`

Localize (via grep `HEADERS.PIPELINE_TAREFAS = \[`) o bloco que hoje termina assim
(já inclui os 3 campos da Sessão A — `Perfil_Responsavel`, `Data_Prevista`,
`Tempo_Estimado_Min`):

```js
HEADERS.PIPELINE_TAREFAS = [
  'OS_ID','Tarefa_ID','Template_ID','Nome','Tipo','Fase','Fase_Ordem','Ordem',
  'Depende_de','Paralelo_com','Bloqueante','Alerta_dias','Descricao',
  'Status','Status_anterior','Concluido_por','Data_abertura','Data_conclusao','Observacao',
  'Ativo','Tipo_Registro','Created_At','Updated_At',
  // v36 — Sessão A: perfil designado, data prevista e tempo estimado (ao final, retrocompatível)
  'Perfil_Responsavel','Data_Prevista','Tempo_Estimado_Min'
];
```

Acrescente mais uma coluna ao final:

```js
HEADERS.PIPELINE_TAREFAS = [
  'OS_ID','Tarefa_ID','Template_ID','Nome','Tipo','Fase','Fase_Ordem','Ordem',
  'Depende_de','Paralelo_com','Bloqueante','Alerta_dias','Descricao',
  'Status','Status_anterior','Concluido_por','Data_abertura','Data_conclusao','Observacao',
  'Ativo','Tipo_Registro','Created_At','Updated_At',
  // v36 — Sessão A: perfil designado, data prevista e tempo estimado (ao final, retrocompatível)
  'Perfil_Responsavel','Data_Prevista','Tempo_Estimado_Min',
  // vNN — Sessão B: URL do checklist/formulário externo vinculado à tarefa (ao final, retrocompatível)
  'Form_URL'
];
```

### 3.2 — `instanciarPipeline`: copiar `form_url` do template

Localize o `tarSheet.appendRow([...])` dentro de `instanciarPipeline` (já com os 3
campos da Sessão A ao final). Adicione mais um valor, na mesma ordem da coluna
adicionada em 3.1:

```js
    tarSheet.appendRow([
      String(os_id).trim(),
      String(t.id || ('T' + String(k+1).padStart(2,'0'))),
      String(template_id).trim(),
      String(t.nome || ''),
      String(t.tipo || 'manual'),
      String(t.fase || ''),
      parseInt(t.fase_ordem) || (k + 1),
      parseInt(t.ordem)      || (k + 1),
      JSON.stringify(t.depende_de   || []),
      JSON.stringify(t.paralelo_com || []),
      t.bloqueante ? 'SIM' : 'NÃO',
      t.alerta_dias || '',
      String(t.descricao || ''),
      statusInicial,
      '', '', '', '', '',
      'SIM', 'PRODUCAO', now, now,
      String(t.perfil_responsavel || ''),
      '',
      t.tempo_estimado_min ? parseInt(t.tempo_estimado_min) : '',
      String(t.form_url || '')
    ]);
```

### 3.3 — `autoCompletarTarefa`: remover o mapa fixo de tipos

Localize:

```js
function autoCompletarTarefa(os_id, trigger_type, status_payload) {
  if (!os_id || !trigger_type) return;
  // Mapeia trigger para o tipo de tarefa AutoVinculada
  var tipoTarefaMap = {
    'form08':     'auto:form08',
    'form09':     'auto:form09',
    'form10':     'auto:form10',
    'rotores':    'auto:rotores',
    'inspecao':   'auto:inspecao',
    'preventiva': 'auto:preventiva'
  };
  var tipoTarefa = tipoTarefaMap[String(trigger_type).toLowerCase()] || null;
  if (!tipoTarefa) return; // trigger não vinculado a tarefa automática — ignorar silenciosamente
```

Substitua por (a transformação `'auto:' + nome` já era exatamente o que o mapa fazia
para os 6 tipos existentes — isso é 100% equivalente para os casos atuais, e passa a
valer também para qualquer tipo novo, sem precisar editar este arquivo de novo):

```js
function autoCompletarTarefa(os_id, trigger_type, status_payload) {
  if (!os_id || !trigger_type) return;
  // Qualquer trigger_type vira automaticamente o tipo de tarefa 'auto:<trigger_type>'.
  // Não há mais lista fixa — checklists novos funcionam sem alteração neste arquivo.
  var tipoTarefa = 'auto:' + String(trigger_type).trim().toLowerCase();
```

> Não altere o restante da função — o loop que busca a tarefa por `os_id` + `Tipo`
> continua igual.

### 3.4 — Conferir `saveFormulario` (não deve precisar de alteração)

Confirme via grep `function saveFormulario` que a chamada existente já repassa o tipo
recebido no payload, sem hardcode:

```js
    autoCompletarTarefa(body.os_id, body.tipo_formulario, { ... });
```

Se for exatamente isso, **não altere nada aqui** — qualquer checklist novo que chame
`saveFormulario` com um `tipo_formulario` próprio (ex: `'checklist_compressor_x'`) já
vai funcionar automaticamente com a mudança feita em 3.3. Se o conteúdo real divergir
disso, pare e relate antes de prosseguir — não force uma alteração não descrita aqui.

---

## 4. PARTE 2 — PCM (`PCM_vNN.html`)

### 4.1 — Editor de template: trocar select fixo por tipo livre + URL

Localize o select de tipo dentro do modal de tarefa (`id="tarefaTipo"`):

```html
        <select id="tarefaTipo" class="form-select">
          <option value="manual">Manual 🖐</option>
          <option value="auto:form08">Auto — Form 08 (Diagnóstico)</option>
          <option value="auto:form09">Auto — Form 09 (Peritagem mecânica)</option>
          <option value="auto:form10">Auto — Form 10 (Peritagem elétrica)</option>
          <option value="auto:rotores">Auto — Ficha de Rotores</option>
        </select>
```

Substitua por um select reduzido a duas opções (Manual / Auto) + dois campos
condicionais que só aparecem quando "Auto" é selecionado — nome curto do tipo (sem o
prefixo `auto:`, que é adicionado automaticamente) e a URL do checklist:

```html
        <select id="tarefaTipo" class="form-select" onchange="_toggleTarefaAutoFields()">
          <option value="manual">Manual 🖐</option>
          <option value="auto">Auto — Checklist/formulário externo</option>
        </select>
        <div id="tarefaAutoFields" style="display:none;margin-top:10px">
          <div style="display:flex;gap:16px">
            <div style="flex:1">
              <label class="form-label">Identificador do tipo (sem espaços)</label>
              <input type="text" id="tarefaTipoAutoNome" class="form-input"
                placeholder="Ex: form08, rotores, checklist_compressor_x">
            </div>
            <div style="flex:1">
              <label class="form-label">URL do checklist</label>
              <input type="url" id="tarefaFormUrl" class="form-input"
                placeholder="https://grupotap.github.io/...">
            </div>
          </div>
        </div>
```

> Localize o ponto exato de inserção via grep `id="tarefaTipo"` — pode haver pequenas
> diferenças de indentação/classe no arquivo real; mantenha o padrão visual dos
> demais campos do modal (mesmo `class="form-label"`/`class="form-input"` usados em
> `tarefaNome`, `tarefaAlertaDias`, etc.).

Adicione a função `_toggleTarefaAutoFields`, em qualquer lugar do mesmo bloco de
funções do editor de template:

```js
function _toggleTarefaAutoFields() {
  const tipo = document.getElementById('tarefaTipo').value;
  document.getElementById('tarefaAutoFields').style.display = tipo === 'auto' ? '' : 'none';
}
```

### 4.2 — `_novaTarefa`, `_editarTarefa`, `saveTarefaModal`

Estas três funções já foram alteradas na Sessão A (são `async`, já populam
`tarefaPerfilResponsavel`/`tarefaTempoEstimadoMin`). Localize-as via grep
(`async function _novaTarefa`, `async function _editarTarefa`,
`function saveTarefaModal`) e ajuste apenas a parte relativa ao tipo:

**Em `_novaTarefa`**, ao limpar os campos, adicione:
```js
  document.getElementById('tarefaTipoAutoNome').value = '';
  document.getElementById('tarefaFormUrl').value = '';
  _toggleTarefaAutoFields();
```

**Em `_editarTarefa`**, ao popular os campos a partir de `t`, o `tarefaTipo` precisa
refletir o novo modelo de 2 opções. A tarefa armazenada continua com `t.tipo` no
formato `'manual'` ou `'auto:algumacoisa'` (compatível com o que já existe nos
templates salvos) — então ao editar, derive:

```js
  const tipoBase = String(t.tipo || 'manual').startsWith('auto:') ? 'auto' : 'manual';
  document.getElementById('tarefaTipo').value = tipoBase;
  document.getElementById('tarefaTipoAutoNome').value = tipoBase === 'auto'
    ? String(t.tipo).slice('auto:'.length) : '';
  document.getElementById('tarefaFormUrl').value = t.form_url || '';
  _toggleTarefaAutoFields();
```

(remova/substitua a linha antiga `document.getElementById('tarefaTipo').value = t.tipo || 'manual';`
por este bloco — ela não funciona mais com o select de 2 opções.)

**Em `saveTarefaModal`**, localize:

```js
  const tipo = document.getElementById('tarefaTipo').value;
```

Substitua por:

```js
  const tipoSel = document.getElementById('tarefaTipo').value;
  const tipoAutoNome = document.getElementById('tarefaTipoAutoNome').value.trim().toLowerCase().replace(/\s+/g, '_');
  if (tipoSel === 'auto' && !tipoAutoNome) {
    toast('Informe o identificador do tipo para tarefas automáticas.', 'error');
    return;
  }
  const tipo = tipoSel === 'auto' ? ('auto:' + tipoAutoNome) : 'manual';
  const formUrl = tipoSel === 'auto' ? document.getElementById('tarefaFormUrl').value.trim() : '';
```

E grave `form_url` junto com `tipo`, nos dois caminhos (edição e criação) — localize:

```js
  if (_editorTarefaIdx !== null) {
    const t = fase.tarefas[_editorTarefaIdx];
    t.nome = nome; t.tipo = tipo; t.bloqueante = bloqueante;
    t.alerta_dias = alertaDias ? parseInt(alertaDias) : null;
    t.descricao = descricao; t.depende_de = deps;
    t.perfil_responsavel = perfilResponsavel || '';
    t.tempo_estimado_min = tempoEstimadoMin ? parseInt(tempoEstimadoMin) : null;
  } else {
    ...
    fase.tarefas.push({
      id: newId, nome, tipo, fase: fase.nome,
      fase_ordem: _editorFaseAtual + 1,
      ordem: fase.tarefas.length + 1,
      depende_de: deps, paralelo_com: [],
      bloqueante, alerta_dias: alertaDias ? parseInt(alertaDias) : null, descricao,
      perfil_responsavel: perfilResponsavel || '',
      tempo_estimado_min: tempoEstimadoMin ? parseInt(tempoEstimadoMin) : null
    });
  }
```

Adicione `t.form_url = formUrl;` no primeiro caminho e `form_url: formUrl` no
segundo (mesmo padrão dos campos da Sessão A).

> **Compatibilidade**: templates já salvos com `'auto:form08'`, `'auto:form09'`,
> `'auto:form10'`, `'auto:rotores'` continuam funcionando sem qualquer migração —
> `_editarTarefa` já deriva `tipoAutoNome` corretamente a partir do `t.tipo` existente
> (`'form08'`, `'form09'`, etc.), e o admin só precisa preencher a URL se quiser que o
> PCF passe a usar o campo novo em vez do fallback (ver 5.1).

---

## 5. PARTE 3 — PCF (`PCF_index_vNN.html`)

### 5.1 — `pfGetFormUrl`: usar `Form_URL` da tarefa, com fallback pro switch antigo

Localize:

```js
function pfGetFormUrl(tipo) {
  switch(tipo) {
    case 'auto:form08':     return 'https://grupotap.github.io/ProperForms/form08_v1_3.html';
    case 'auto:rotores':    return 'https://grupotap.github.io/ProperRotores/index.html';
    case 'auto:inspecao':   return 'https://grupotap.github.io/ProperTech/index.html';
    case 'auto:preventiva': return 'https://grupotap.github.io/ProperTech/index.html?modo=preventiva';
    case 'auto:form09':     return null;
    case 'auto:form10':     return null;
    default:                return null;
  }
}
```

Substitua por (a função passa a receber também a tarefa inteira, não só o tipo, para
poder ler `Form_URL`; o fallback abaixo é **idêntico ao comportamento atual** para
qualquer tarefa instanciada antes desta sessão, que não tem `Form_URL` preenchido):

```js
function pfGetFormUrl(tipo, tarefa) {
  // Prioridade 1: URL vinda da própria tarefa instanciada (checklists novos,
  // cadastrados no editor de template a partir da Sessão B).
  if (tarefa && tarefa.Form_URL) return tarefa.Form_URL;

  // Prioridade 2 (fallback de compatibilidade): tarefas instanciadas antes desta
  // sessão, sem Form_URL preenchido — mantém o comportamento exato de antes.
  switch(tipo) {
    case 'auto:form08':     return 'https://grupotap.github.io/ProperForms/form08_v1_3.html';
    case 'auto:rotores':    return 'https://grupotap.github.io/ProperRotores/index.html';
    case 'auto:inspecao':   return 'https://grupotap.github.io/ProperTech/index.html';
    case 'auto:preventiva': return 'https://grupotap.github.io/ProperTech/index.html?modo=preventiva';
    case 'auto:form09':     return null;
    case 'auto:form10':     return null;
    default:                return null;
  }
}
```

### 5.2 — `pfBuildCard`: repassar a tarefa inteira para `pfGetFormUrl`

Localize, dentro de `pfBuildCard(t)`:

```js
      var formUrl = pfGetFormUrl(tipo);
```

Substitua por:

```js
      var formUrl = pfGetFormUrl(tipo, t);
```

> Confirme via grep `pfGetFormUrl(` que não há outras chamadas a esta função em outro
> ponto do arquivo; se houver, repasse `t` (ou a tarefa equivalente disponível
> naquele escopo) da mesma forma.

---

## 6. Checklist de verificação (rodar antes de finalizar)

- [ ] `grep -n "Form_URL" GAS_properCare_vNN.js` aparece em: `HEADERS.PIPELINE_TAREFAS`,
      `instanciarPipeline`.
- [ ] `autoCompletarTarefa` não tem mais nenhum mapa/lista fixa de tipos — só a
      concatenação `'auto:' + trigger_type`.
- [ ] `saveFormulario` não foi alterado (a menos que o conteúdo real divirja do
      descrito na seção 3.4 — nesse caso, relatar antes de mudar).
- [ ] No PCM, o select de tipo tem só 2 opções (Manual/Auto), com campos condicionais
      de nome+URL aparecendo/sumindo corretamente ao trocar a seleção.
- [ ] Editar uma tarefa já existente com tipo `auto:form08` (ou qualquer um dos 4
      tipos antigos) preenche corretamente o campo de identificador (`form08`) sem
      o prefixo `auto:`, e não quebra ao salvar de novo.
- [ ] `saveTarefaModal` valida que o identificador foi preenchido quando "Auto" está
      selecionado, antes de salvar.
- [ ] No PCF, `pfGetFormUrl` usa `Form_URL` da tarefa quando presente, e cai no
      switch antigo quando ausente — teste mental: uma tarefa com
      `Tipo: 'auto:form08'` e `Form_URL: ''` (caso de toda OS já em produção) precisa
      continuar abrindo exatamente a mesma URL de hoje.
- [ ] Nenhuma OS/pipeline já instanciado em produção teria comportamento alterado
      por esta mudança.
- [ ] Nenhum arquivo de entrada foi sobrescrito — saída em arquivos novos
      versionados.
- [ ] Nenhuma ocorrência nova de "técnico" foi introduzida em texto de UI.

---

## 7. Entrega esperada

- `GAS_properCare_v{NN+1}.js`
- `PCM_v{NN+1}.html`
- `PCF_index_v{NN+1}.html`
- Resumo curto, ao final, listando exatamente quais funções/linhas foram alteradas em
  cada arquivo, para auditoria antes de subir pra produção.
