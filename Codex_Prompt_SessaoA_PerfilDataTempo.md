# Prompt Codex — ProperFlow Sessão A
## Campos: perfil_responsavel, data_prevista, tempo_estimado_min

---

## 0. Contexto do projeto

Você está trabalhando no **ProperHub**, um sistema de gestão de campo para
manutenção de compressores (Proper Compressores). A arquitetura é:

- **Backend**: Google Apps Script (GAS), arquivo `GAS_properCare_vNN.js`, conectado a
  Google Sheets (banco de dados) e Google Drive (fotos). Único backend do ecossistema.
- **PCM** (`PCM_vNN.html`): painel admin desktop (gestão de OS, templates de pipeline,
  usuários).
- **PCF** (`PCF_index_vNN.html`): app mobile do técnico de campo.
- **ProperHub** (`ProperHub_index_vNN.html`): portal de login/SSO — não contém lógica
  de pipeline, apenas redireciona para os apps acima.

Os arquivos de entrada estão na **raiz deste repositório**, sem subpastas. As versões
mais recentes neste repo são as únicas fontes de verdade — ignore qualquer conhecimento
anterior sobre versões mais antigas.

**Não toque no PCF nem no ProperHub nesta sessão.** Esta sessão é restrita a
**GAS** e **PCM**.

---

## 1. Objetivo desta sessão

Adicionar três campos novos ao sistema de pipeline (ProperFlow), de forma **aditiva**
(nunca removendo ou renomeando colunas existentes):

1. **`perfil_responsavel`** — campo informativo (não restritivo) na tarefa do
   **template**, indicando qual perfil de usuário normalmente executa aquela tarefa.
   Exibido como badge no card da tarefa, tanto no editor de template quanto no
   acompanhamento da OS no PCM.
2. **`data_prevista`** — campo na tarefa **instanciada** (`PIPELINE_TAREFAS`, não no
   template), editável apenas pelo admin, direto no card da OS no PCM. Útil para
   tarefas aguardando peça com data de chegada prevista.
3. **`tempo_estimado_min`** — campo na tarefa do **template** (tempo estimado de
   execução, em minutos), copiado para a tarefa instanciada na hora de gerar o
   pipeline da OS. Exibido como informação no card.

---

## 2. Regras gerais (obrigatórias)

- **Nunca sobrescreva os arquivos de entrada.** Leia os arquivos mais recentes na raiz
  do repo (maior número de versão), e grave a saída em **arquivos novos versionados**:
  - `GAS_properCare_vNN.js` → próxima versão (`vNN+1`)
  - `PCM_vNN.html` → próxima versão (`vNN+1`)
  - Identifique a versão atual pelo nome do arquivo mais recente presente no repo.
- **Modificações cirúrgicas.** Nunca reescreva blocos de código que já funcionam. Toda
  alteração deve ser a menor diff possível que entregue o requisito.
- **Audite antes de escrever.** Antes de editar qualquer função, rode um `grep -n`
  para confirmar nomes exatos de variáveis/funções/IDs de elementos HTML no arquivo
  real — não assuma que os nomes abaixo batem 100% com o arquivo se a versão recebida
  for mais nova do que a usada para escrever este prompt.
- **Comentário de versão.** Ao adicionar colunas em `HEADERS`, siga o padrão já usado
  no arquivo (comentário tipo `// vNN — Sessão A: ...` acima do bloco alterado).
- Use **"usuário"**, nunca "técnico", em qualquer texto novo de UI ou comentário.

---

## 3. PARTE 1 — GAS (`GAS_properCare_vNN.js`)

### 3.1 — Adicionar colunas em `HEADERS.PIPELINE_TAREFAS`

Localize (via grep `HEADERS.PIPELINE_TAREFAS = \[`):

```js
HEADERS.PIPELINE_TAREFAS = [
  'OS_ID','Tarefa_ID','Template_ID','Nome','Tipo','Fase','Fase_Ordem','Ordem',
  'Depende_de','Paralelo_com','Bloqueante','Alerta_dias','Descricao',
  'Status','Status_anterior','Concluido_por','Data_abertura','Data_conclusao','Observacao',
  'Ativo','Tipo_Registro','Created_At','Updated_At'
];
```

Substitua por (acrescentando 3 colunas ao final, retrocompatível):

```js
HEADERS.PIPELINE_TAREFAS = [
  'OS_ID','Tarefa_ID','Template_ID','Nome','Tipo','Fase','Fase_Ordem','Ordem',
  'Depende_de','Paralelo_com','Bloqueante','Alerta_dias','Descricao',
  'Status','Status_anterior','Concluido_por','Data_abertura','Data_conclusao','Observacao',
  'Ativo','Tipo_Registro','Created_At','Updated_At',
  // Sessão A — perfil designado, data prevista e tempo estimado (ao final, retrocompatível)
  'Perfil_Responsavel','Data_Prevista','Tempo_Estimado_Min'
];
```

### 3.2 — `instanciarPipeline`: copiar os novos campos do template para a tarefa instanciada

Localize a função `instanciarPipeline`. Dentro do loop `for (var k = 0; k < tarefas.length; k++)`,
encontre o `tarSheet.appendRow([...])` que hoje termina assim:

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
      'SIM', 'PRODUCAO', now, now
    ]);
```

Adicione os 3 valores novos ao final do array, na mesma ordem das colunas adicionadas
em 3.1 (`Perfil_Responsavel`, `Data_Prevista`, `Tempo_Estimado_Min`):

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
      t.tempo_estimado_min ? parseInt(t.tempo_estimado_min) : ''
    ]);
```

> `Data_Prevista` começa sempre vazio na instanciação — só é preenchido depois pelo
> admin, direto na OS (ver 3.3).

### 3.3 — `updateTarefaStatus`: aceitar `data_prevista` opcional

Localize:

```js
function updateTarefaStatus(os_id, tarefa_id, novoStatus, usuario, observacao) {
  if (!os_id || !tarefa_id || !novoStatus) {
    return { status: 'error', error: 'os_id, tarefa_id e status são obrigatórios' };
  }
  ensureSheetHeaders('PIPELINE_TAREFAS', HEADERS.PIPELINE_TAREFAS);
  var sheet   = getOrCreateSheet('PIPELINE_TAREFAS', HEADERS.PIPELINE_TAREFAS);
  var data    = sheet.getDataRange().getValues();
  var headers = data[0];
  var idxOS   = headers.indexOf('OS_ID');
  var idxTar  = headers.indexOf('Tarefa_ID');
  var idxStat = headers.indexOf('Status');
  var idxPrev = headers.indexOf('Status_anterior');
  var idxConc = headers.indexOf('Concluido_por');
  var idxDatC = headers.indexOf('Data_conclusao');
  var idxUpd  = headers.indexOf('Updated_At');
  var idxObs  = headers.indexOf('Observacao');
  var now     = new Date().toISOString();
  var found   = false;
  var statusAnterior = '';
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][idxOS] || '').trim()  === String(os_id).trim() &&
        String(data[i][idxTar] || '').trim() === String(tarefa_id).trim()) {
      statusAnterior = data[i][idxStat];
      if (idxPrev >= 0) sheet.getRange(i + 1, idxPrev + 1).setValue(statusAnterior);
      sheet.getRange(i + 1, idxStat + 1).setValue(novoStatus);
      if (idxConc >= 0) sheet.getRange(i + 1, idxConc + 1).setValue(usuario || '');
      if (idxObs >= 0 && observacao) sheet.getRange(i + 1, idxObs + 1).setValue(observacao);
      if (novoStatus === 'completo' && idxDatC >= 0) sheet.getRange(i + 1, idxDatC + 1).setValue(now);
      if (idxUpd >= 0) sheet.getRange(i + 1, idxUpd + 1).setValue(now);
      found = true;
      break;
    }
  }
  if (!found) return { status: 'error', error: 'Tarefa não encontrada: ' + tarefa_id + ' na OS ' + os_id };
  if (novoStatus === 'completo') {
    _verificarDesbloqueios_(os_id, tarefa_id, usuario);
  }
  return { status: 'ok', os_id: os_id, tarefa_id: tarefa_id, status: novoStatus, status_anterior: statusAnterior };
}
```

Substitua por (novo parâmetro `data_prevista`, opcional, no final da assinatura —
não quebra nenhuma chamada existente que não o envie):

```js
function updateTarefaStatus(os_id, tarefa_id, novoStatus, usuario, observacao, data_prevista) {
  if (!os_id || !tarefa_id || !novoStatus) {
    return { status: 'error', error: 'os_id, tarefa_id e status são obrigatórios' };
  }
  ensureSheetHeaders('PIPELINE_TAREFAS', HEADERS.PIPELINE_TAREFAS);
  var sheet   = getOrCreateSheet('PIPELINE_TAREFAS', HEADERS.PIPELINE_TAREFAS);
  var data    = sheet.getDataRange().getValues();
  var headers = data[0];
  var idxOS   = headers.indexOf('OS_ID');
  var idxTar  = headers.indexOf('Tarefa_ID');
  var idxStat = headers.indexOf('Status');
  var idxPrev = headers.indexOf('Status_anterior');
  var idxConc = headers.indexOf('Concluido_por');
  var idxDatC = headers.indexOf('Data_conclusao');
  var idxUpd  = headers.indexOf('Updated_At');
  var idxObs  = headers.indexOf('Observacao');
  var idxDP   = headers.indexOf('Data_Prevista');
  var now     = new Date().toISOString();
  var found   = false;
  var statusAnterior = '';
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][idxOS] || '').trim()  === String(os_id).trim() &&
        String(data[i][idxTar] || '').trim() === String(tarefa_id).trim()) {
      statusAnterior = data[i][idxStat];
      if (idxPrev >= 0) sheet.getRange(i + 1, idxPrev + 1).setValue(statusAnterior);
      sheet.getRange(i + 1, idxStat + 1).setValue(novoStatus);
      if (idxConc >= 0) sheet.getRange(i + 1, idxConc + 1).setValue(usuario || '');
      if (idxObs >= 0 && observacao) sheet.getRange(i + 1, idxObs + 1).setValue(observacao);
      if (idxDP  >= 0 && data_prevista !== undefined && data_prevista !== null) {
        sheet.getRange(i + 1, idxDP + 1).setValue(data_prevista);
      }
      if (novoStatus === 'completo' && idxDatC >= 0) sheet.getRange(i + 1, idxDatC + 1).setValue(now);
      if (idxUpd >= 0) sheet.getRange(i + 1, idxUpd + 1).setValue(now);
      found = true;
      break;
    }
  }
  if (!found) return { status: 'error', error: 'Tarefa não encontrada: ' + tarefa_id + ' na OS ' + os_id };
  if (novoStatus === 'completo') {
    _verificarDesbloqueios_(os_id, tarefa_id, usuario);
  }
  return { status: 'ok', os_id: os_id, tarefa_id: tarefa_id, status: novoStatus, status_anterior: statusAnterior };
}
```

### 3.4 — `doPost`: repassar `data_prevista` no roteamento

Localize, dentro de `doPost`:

```js
      case 'updateTarefaStatus':
        result = updateTarefaStatus(body.os_id, body.tarefa_id, body.status, body.usuario, body.observacao);
        break;
```

Substitua por:

```js
      case 'updateTarefaStatus':
        result = updateTarefaStatus(body.os_id, body.tarefa_id, body.status, body.usuario, body.observacao, body.data_prevista);
        break;
```

---

## 4. PARTE 2 — PCM (`PCM_vNN.html`)

### 4.1 — Editor de template: modal de tarefa

Localize as funções `_novaTarefa`, `_editarTarefa` e `saveTarefaModal` (grep
`function _novaTarefa`, `function _editarTarefa`, `function saveTarefaModal`).

Localize também o HTML do modal `modalTarefaEditor` (grep `id="modalTarefaEditor"`).
Dentro dele, encontre o campo `tarefaAlertaDias` (input de alerta em dias) — use-o
como referência de estilo/posição para inserir dois campos novos **logo após** ele,
seguindo o mesmo padrão visual de label + input já usado nos demais campos do modal:

1. **Select `tarefaPerfilResponsavel`**
   - Label: "Perfil responsável (informativo)"
   - Opção vazia inicial: "— Nenhum —"
   - Demais opções populadas a partir da lista de perfis carregada via `gsGet('getPerfis')`
     (mesmo padrão já usado em `renderUsuarios()`/`renderPerfis()` — variável global
     `_perfilList`, campos `id_perfil` / `nome_perfil`).
   - **Importante**: se `_perfilList` ainda não tiver sido carregada quando o modal
     de tarefa abrir (usuário foi direto pra aba de templates sem passar por
     Usuários/Perfis), faça um `await gsGet('getPerfis')` lazy antes de popular o
     select, e armazene em `_perfilList` para reuso.

2. **Input numérico `tarefaTempoEstimadoMin`**
   - Label: "Tempo estimado (min)"
   - `type="number"`, `min="0"`, `step="5"`, placeholder "Ex: 180"

Em `_novaTarefa(fi)`, ao limpar os campos do modal, adicione:
```js
  document.getElementById('tarefaPerfilResponsavel').value = '';
  document.getElementById('tarefaTempoEstimadoMin').value = '';
```

Em `_editarTarefa(fi, ti)`, ao popular os campos a partir de `t`, adicione:
```js
  document.getElementById('tarefaPerfilResponsavel').value = t.perfil_responsavel || '';
  document.getElementById('tarefaTempoEstimadoMin').value = t.tempo_estimado_min || '';
```

Em `saveTarefaModal()`, leia os dois campos novos:
```js
  const perfilResponsavel = document.getElementById('tarefaPerfilResponsavel').value;
  const tempoEstimadoMin  = document.getElementById('tarefaTempoEstimadoMin').value;
```

E grave em ambos os caminhos (edição e criação de tarefa nova) — localize:
```js
  if (_editorTarefaIdx !== null) {
    const t = fase.tarefas[_editorTarefaIdx];
    t.nome = nome; t.tipo = tipo; t.bloqueante = bloqueante;
    t.alerta_dias = alertaDias ? parseInt(alertaDias) : null;
    t.descricao = descricao; t.depende_de = deps;
  } else {
    ...
    fase.tarefas.push({
      id: newId, nome, tipo, fase: fase.nome,
      fase_ordem: _editorFaseAtual + 1,
      ordem: fase.tarefas.length + 1,
      depende_de: deps, paralelo_com: [],
      bloqueante, alerta_dias: alertaDias ? parseInt(alertaDias) : null, descricao
    });
  }
```

Substitua por:
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

> Não é necessário alterar `saveTemplateEditor()` — ele já serializa o objeto de
> tarefa inteiro (`{ ...t, ... }`) em `tarefas_json`, então os campos novos são
> persistidos automaticamente.

### 4.2 — Editor de template: exibir badges na lista de tarefas

Localize a função que renderiza a lista de tarefas dentro de cada fase no editor
(grep `_renderFases` — função chamada após salvar/remover tarefa). Adicione, no
card de cada tarefa exibido, um badge pequeno mostrando o perfil responsável
(se preenchido) e o tempo estimado (se preenchido), no mesmo estilo visual dos
badges já usados em outras partes do editor (ex: badge "Manual"/bloqueante).
Não é necessário texto extenso — algo como `👤 Mecânico · ⏱ 180min`.

### 4.3 — Acompanhamento de OS: card de pipeline (`_loadPipelineTab`)

Localize a função `_loadPipelineTab(osId)`. Dentro do `forEach` que monta o HTML de
cada tarefa, encontre este trecho:

```js
      const isAuto = String(t.Tipo||'').startsWith('auto:');
      const tipoBadge = isAuto
        ? '<span style="font-size:10px;color:var(--text-muted);background:var(--bg);padding:1px 6px;border-radius:10px;border:1px solid var(--border)">Auto ⚙</span>'
        : '<span style="font-size:10px;color:var(--accent);background:var(--bg);padding:1px 6px;border-radius:10px;border:1px solid var(--border)">Manual 👤</span>';
```

Logo abaixo, adicione a montagem de uma linha de metadados extra (perfil responsável,
tempo estimado, e data prevista com botão de definir para admin):

```js
      const perfilLine = t.Perfil_Responsavel
        ? `<div style="font-size:11px;color:var(--text-muted);margin-top:4px">👤 Responsável sugerido: ${t.Perfil_Responsavel}</div>`
        : '';
      const tempoLine = t.Tempo_Estimado_Min
        ? `<div style="font-size:11px;color:var(--text-muted);margin-top:2px">⏱ Estimado: ${t.Tempo_Estimado_Min} min</div>`
        : '';
      const dataPrevistaStr = t.Data_Prevista ? new Date(t.Data_Prevista).toLocaleDateString('pt-BR') : '';
      const dataPrevistaLine = window.PROPER_SESSION?.is_admin === true
        ? `<div style="font-size:11px;color:var(--text-muted);margin-top:2px;display:flex;align-items:center;gap:6px">
             ${dataPrevistaStr ? '📅 Previsto: ' + dataPrevistaStr : ''}
             <button class="btn btn-secondary btn-sm" style="padding:1px 6px;font-size:10px"
               onclick="_definirDataPrevista('${osId.replace(/'/g,"\\'")}','${t.Tarefa_ID.replace(/'/g,"\\'")}','${t.Data_Prevista||''}')">📅 Definir data</button>
           </div>`
        : (dataPrevistaStr ? `<div style="font-size:11px;color:var(--text-muted);margin-top:2px">📅 Previsto: ${dataPrevistaStr}</div>` : '');
```

E inclua essas três variáveis no template do card, logo após `${concByLine}`:

```js
        ${concByLine}
        ${perfilLine}
        ${tempoLine}
        ${dataPrevistaLine}
        ${btnCompletar}
```

Por fim, adicione a função `_definirDataPrevista`, em qualquer lugar do mesmo bloco
de funções de pipeline (próximo a `_expandConfirmTarefa`):

```js
async function _definirDataPrevista(osId, tarefaId, dataAtual) {
  const novaData = prompt('Data prevista (AAAA-MM-DD):', dataAtual ? dataAtual.slice(0,10) : '');
  if (novaData === null) return; // cancelado
  // Busca o status atual da tarefa para reenviar sem alterá-lo (campo obrigatório no backend)
  const card = document.getElementById('pcard-' + tarefaId);
  const tarefaAtual = (await syncToGS('getPipelineByOS', { os_id: osId })).tarefas
    .find(t => t.Tarefa_ID === tarefaId);
  if (!tarefaAtual) { toast('Tarefa não encontrada.', 'error'); return; }
  try {
    await syncToGS('updateTarefaStatus', {
      os_id: osId,
      tarefa_id: tarefaId,
      status: tarefaAtual.Status,
      usuario: window.PROPER_SESSION?.tecnico?.nome || '',
      data_prevista: novaData ? new Date(novaData).toISOString() : ''
    });
    toast('Data prevista atualizada.', 'success');
    _loadPipelineTab(osId);
  } catch(e) {
    toast('Erro ao definir data: ' + e.message, 'error');
  }
}
```

> Confirme via grep o nome exato da função de chamada POST usada no restante do
> arquivo (`syncToGS`) e o caminho correto da sessão (`window.PROPER_SESSION.tecnico.nome`,
> conforme padrão documentado do projeto) antes de finalizar — adapte se o arquivo
> recebido usar nomes diferentes.

---

## 5. Checklist de verificação (rodar antes de finalizar)

- [ ] `grep -n "Perfil_Responsavel\|Data_Prevista\|Tempo_Estimado_Min" GAS_properCare_vNN.js`
      retorna ocorrências em: `HEADERS.PIPELINE_TAREFAS`, `instanciarPipeline`,
      `updateTarefaStatus`.
- [ ] `doPost` repassa `body.data_prevista` para `updateTarefaStatus`.
- [ ] Nenhuma chamada existente a `updateTarefaStatus(...)` foi quebrada (parâmetro
      novo é opcional e vai por último).
- [ ] No PCM, o modal de tarefa do editor de template tem os 2 campos novos e eles
      são lidos/gravados em `saveTarefaModal()`.
- [ ] O select de perfil é populado mesmo se o admin abrir o editor de template sem
      antes visitar a aba de Usuários/Perfis.
- [ ] O card de acompanhamento de OS (`_loadPipelineTab`) exibe perfil, tempo
      estimado e data prevista quando preenchidos, sem quebrar o layout quando
      vazios (campos opcionais, não devem aparecer em branco/"undefined").
- [ ] Botão "📅 Definir data" só aparece para `is_admin === true`.
- [ ] Nenhum arquivo de entrada foi sobrescrito — saída está em arquivos novos
      versionados (`vNN+1`).
- [ ] PCF e ProperHub não foram tocados.
- [ ] Nenhuma ocorrência nova de "técnico" foi introduzida em texto de UI — usar
      "usuário".

---

## 6. Entrega esperada

- `GAS_properCare_v{NN+1}.js` (nome real conforme versão atual encontrada no repo)
- `PCM_v{NN+1}.html` (idem)
- Resumo curto, ao final, listando exatamente quais funções/linhas foram alteradas
  em cada arquivo, para eu auditar rapidamente antes de subir pra produção.
