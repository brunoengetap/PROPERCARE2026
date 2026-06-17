# TAREFA — Codex — Biblioteca de Subsistemas Reutilizáveis (GAS + PCM)

**Projeto:** ProperCare / Proper PGP — sistema de manutenção de compressores (Proper Compressores / Grupo TAP)
**Repositório:** localizar no repo do GitHub indicado pelo usuário (ex.: `brunoengetap/ProperCare130526` ou equivalente)
**Arquivos a localizar e modificar dentro do repo:**
- Backend GAS: arquivo `GAS_properCare_v22.js` (versão atual) → salvar resultado como `GAS_properCare_v23.js`
- Frontend manager: arquivo `PCM_v28.html` (versão atual) → salvar resultado como `PCM_v29.html`

**Não modificar:** nenhum arquivo do frontend de campo (`Proper_Field_grupotap_*.html` / PCF).

---

## Passo 0 — Leitura obrigatória antes de qualquer edição

Antes de aplicar qualquer alteração:

1. Abra `GAS_properCare_v22.js` e localize: o objeto `HEADERS` (onde estão `MODELOS`, `PARTS_MASTER`, `PART_SIMILARITIES`, etc.), a função `getCatalogFull()`, a função `deleteSubsystemParts()`, o `doGet(e)` com seu `switch(action)`, o `doPost(e)` com seu `switch(action)`, e qualquer função `save*` existente que use `LockService` (ex.: a função que salva Ordens de Serviço) para copiar o mesmo padrão de lock.
2. Abra `PCM_v28.html` e localize: o objeto `db` e onde `db.models`/`db.machines` são inicializados, as funções `openAddSub`, `saveSub`, `deleteSub`, o bloco que renderiza `panelSubs` (aba "Subsistemas e conjuntos" da tela do modelo), a função `syncCatalogFromGS`, a função `getAllModelPartsForSync`, e a função `syncFullModelCatalogToGS`.
3. Os trechos de código fornecidos abaixo são uma referência funcional, escritos a partir do padrão geral já observado no projeto (não a partir de uma leitura linha a linha mais recente). **Ajuste nomes de funções auxiliares, geração de ID e estilo de código ao que você encontrar de fato nos arquivos reais.** Se uma função auxiliar citada abaixo (ex.: `getOrCreateSheet`, `ensureSheetHeaders`, `getSheetDataActive`) não existir com esse nome exato, use a função equivalente já existente no arquivo em vez de criar uma duplicata.

Se qualquer divergência entre este documento e o código real do repositório for grande o suficiente para mudar a abordagem, pare e descreva a divergência em vez de improvisar uma solução que quebre padrões existentes.

---

## 1. Contexto do problema

Hoje, em `PCM_v28.html`, cada subsistema (`m.subsystems[]`) existe apenas dentro de um modelo específico. No GAS, cada peça de subsistema é uma linha de `PARTS_MASTER` amarrada a um `Model_ID`, com `Part_Scope='sub'` e os campos `Sub_ID`/`Sub_Name`/`Sub_Category`/`Sub_Desc`/`Sub_Interval_H` repetidos peça a peça. **Não existe hoje um subsistema "solto", independente de modelo** — por isso a mesma unidade compressora (ex.: "Unidade Compressora E-12") cadastrada em um modelo não pode ser reaproveitada em outro sem recriar tudo manualmente.

## 2. Objetivo desta tarefa

1. Permitir cadastrar um subsistema (ex.: "Unidade Compressora E-12") **uma única vez**, com suas peças, **sem vincular a nenhum modelo** — uma biblioteca independente.
2. Permitir vincular esse subsistema, **por referência (sem cópia)**, a um ou mais modelos de compressor. Editar o subsistema na biblioteca deve refletir automaticamente em todos os modelos vinculados a ele.
3. Permitir desvincular sem apagar o subsistema da biblioteca. Permitir excluir da biblioteca apenas quando não houver nenhum vínculo ativo.

## 3. Fora de escopo — não implementar nesta tarefa

- Override de campos por modelo (ex.: o mesmo subsistema da biblioteca com intervalo de manutenção diferente em modelos diferentes).
- Similaridades (`PART_SIMILARITIES`) para peças de subsistema da biblioteca.
- Renomear o termo "subsistema" para "subconjunto" — **manter "subsistema" em toda a interface e no código nesta tarefa.**
- Qualquer alteração em preventivas, visitas, clientes, máquinas PGP, módulo de Ordens de Serviço (OS), ou no frontend de campo (PCF).

---

## 4. Restrições absolutas (não violar)

- Não modificar `machineKey()`, `clientKey()`, `modelKey()`.
- Não renomear ou reestruturar a chave de localStorage `proper_admin_v2`.
- Não alterar o schema (colunas) de `MODELOS`, `PARTS_MASTER`, `PART_SIMILARITIES`, `MACHINE_PARTS`, ou de qualquer aba `OS_*` já existente. Toda informação nova vai em **abas novas**.
- Apenas soft delete (`Ativo='SIM'/'NÃO'` com `Deleted_At`/`Deleted_By`); nunca exclusão destrutiva de linha.
- Não alterar `saveVisit`, `savePreventiva`, `updateMachineParts`, `ensureMachineFromVisit`, `saveMachine`, `saveClient`, `saveOS`, `reabrirOS`, ou qualquer função relacionada a Ordens de Serviço.
- `getCatalogFull()` pode receber **campos adicionais** no objeto de retorno (`subsistemasLib`, `subLibParts`, `modeloSubLinks`) — não remover, renomear ou alterar o comportamento dos campos já existentes (`models`, `parts`, `similarities`).
- As novas funções de gravação no GAS (`saveSubsistemaLib`, `deleteSubsistemaLib`, `saveSubLibPart`, `deleteSubLibPart`, `linkSubsistemaToModel`, `unlinkSubsistemaFromModel`) devem usar `LockService`, no mesmo padrão já usado pela função de salvar Ordens de Serviço.
- Ordem de deploy ao final: **GAS primeiro, depois PCM**.

---

## 5. Implementação — GAS

### 5.1 Novo schema (3 abas novas)

Adicionar três novas chaves dentro do objeto `HEADERS` já existente (próximo a `PARTS_MASTER`/`PART_SIMILARITIES`):

```javascript
SUBSISTEMAS_LIB: [
  'Sub_Lib_ID','Nome','Categoria','Descricao','Interval_Base_H',
  'Codigo_Referencia','Fabricante','Obs',
  'Ativo','Tipo_Registro','Created_At','Created_By','Updated_At','Deleted_At','Deleted_By'
],
SUBSISTEMA_LIB_PARTS: [
  'Part_ID','Sub_Lib_ID','Name','OEM_Ref','Part_Brand','Supplier_Primary',
  'Slot','Qty_Default','Interval_H','Criticality','Cost','Obs',
  'Ativo','Tipo_Registro','Created_At','Updated_At','Deleted_At','Deleted_By'
],
MODELO_SUBSISTEMA_LIB_LINKS: [
  'Link_ID','Model_ID','Sub_Lib_ID',
  'Ativo','Created_At','Created_By','Deleted_At','Deleted_By'
],
```

### 5.2 Leitura

Função nova, próximo a `getCatalogFull()`:

```javascript
function getSubsistemasLibFull() {
  const subs  = getSheetDataActive('SUBSISTEMAS_LIB');
  const parts = getSheetDataActive('SUBSISTEMA_LIB_PARTS');
  const links = getSheetDataActive('MODELO_SUBSISTEMA_LIB_LINKS');
  return { status: 'ok', subsistemasLib: subs, subLibParts: parts, modeloSubLinks: links };
}
```

No `doGet`, dentro do `switch(action)`, adicionar:

```javascript
case 'getSubsistemasLib':
  result = getSubsistemasLibFull();
  break;
```

Estender `getCatalogFull()` para incluir os mesmos três conjuntos no objeto de retorno, **sem remover nada do que já existe**:

```javascript
result.subsistemasLib = getSheetDataActive('SUBSISTEMAS_LIB');
result.subLibParts    = getSheetDataActive('SUBSISTEMA_LIB_PARTS');
result.modeloSubLinks = getSheetDataActive('MODELO_SUBSISTEMA_LIB_LINKS');
```

(Adaptar a sintaxe ao formato real do objeto de retorno já existente em `getCatalogFull()` — apenas adicionar, não reescrever a função.)

### 5.3 Gravação

```javascript
function saveSubsistemaLib(data) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const sheet = getOrCreateSheet('SUBSISTEMAS_LIB', HEADERS.SUBSISTEMAS_LIB);
    ensureSheetHeaders('SUBSISTEMAS_LIB', HEADERS.SUBSISTEMAS_LIB);
    const now = new Date().toISOString();
    const id = data.id || Utilities.getUuid();
    const rows = sheet.getDataRange().getValues();
    const headers = rows[0] || [];
    let rowIdx = -1;
    for (let i = 1; i < rows.length; i++) {
      if (String(rows[i][headers.indexOf('Sub_Lib_ID')]) === String(id)) { rowIdx = i; break; }
    }
    const rowData = {
      Sub_Lib_ID: id, Nome: data.nome || '', Categoria: data.categoria || '',
      Descricao: data.descricao || '', Interval_Base_H: data.intervalBaseH || 0,
      Codigo_Referencia: data.codigoReferencia || '', Fabricante: data.fabricante || '',
      Obs: data.obs || '', Ativo: 'SIM', Tipo_Registro: data.tipoRegistro || 'PRODUCAO',
      Updated_At: now
    };
    if (rowIdx === -1) {
      rowData.Created_At = now;
      rowData.Created_By = data.createdBy || 'admin';
      sheet.appendRow(headers.map(h => rowData[h] !== undefined ? rowData[h] : ''));
    } else {
      headers.forEach((h, c) => { if (rowData[h] !== undefined) sheet.getRange(rowIdx + 1, c + 1).setValue(rowData[h]); });
    }
    return { status: 'ok', id };
  } finally { lock.releaseLock(); }
}

function deleteSubsistemaLib(subLibId, deletedBy) {
  const linksSheet = getOrCreateSheet('MODELO_SUBSISTEMA_LIB_LINKS', HEADERS.MODELO_SUBSISTEMA_LIB_LINKS);
  const linkRows = linksSheet.getDataRange().getValues();
  const lh = linkRows[0] || [];
  const hasActiveLink = linkRows.slice(1).some(r =>
    String(r[lh.indexOf('Sub_Lib_ID')]) === String(subLibId) &&
    String(r[lh.indexOf('Ativo')]).toUpperCase() === 'SIM'
  );
  if (hasActiveLink) return { status: 'error', error: 'Subsistema vinculado a pelo menos um modelo. Desvincule antes de excluir.' };

  const sheet = getOrCreateSheet('SUBSISTEMAS_LIB', HEADERS.SUBSISTEMAS_LIB);
  const data = sheet.getDataRange().getValues();
  const headers = data[0] || [];
  const idxId = headers.indexOf('Sub_Lib_ID');
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][idxId]) === String(subLibId)) {
      sheet.getRange(i + 1, headers.indexOf('Ativo') + 1).setValue('NÃO');
      sheet.getRange(i + 1, headers.indexOf('Deleted_At') + 1).setValue(new Date().toISOString());
      sheet.getRange(i + 1, headers.indexOf('Deleted_By') + 1).setValue(deletedBy || 'admin');
      return { status: 'ok' };
    }
  }
  return { status: 'error', error: 'Subsistema não encontrado' };
}

function saveSubLibPart(data) {
  const sheet = getOrCreateSheet('SUBSISTEMA_LIB_PARTS', HEADERS.SUBSISTEMA_LIB_PARTS);
  ensureSheetHeaders('SUBSISTEMA_LIB_PARTS', HEADERS.SUBSISTEMA_LIB_PARTS);
  const now = new Date().toISOString();
  const id = data.id || Utilities.getUuid();
  const rows = sheet.getDataRange().getValues();
  const headers = rows[0] || [];
  let rowIdx = -1;
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][headers.indexOf('Part_ID')]) === String(id)) { rowIdx = i; break; }
  }
  const rowData = {
    Part_ID: id, Sub_Lib_ID: data.subLibId || '', Name: data.name || '', OEM_Ref: data.oemRef || '',
    Part_Brand: data.partBrand || '', Supplier_Primary: data.supplierPrimary || '', Slot: data.slot || '',
    Qty_Default: data.qtyDefault || 1, Interval_H: data.intervalH || 0, Criticality: data.criticality || 'normal',
    Cost: data.cost || 0, Obs: data.obs || '', Ativo: 'SIM', Tipo_Registro: data.tipoRegistro || 'PRODUCAO',
    Updated_At: now
  };
  if (rowIdx === -1) {
    rowData.Created_At = now;
    sheet.appendRow(headers.map(h => rowData[h] !== undefined ? rowData[h] : ''));
  } else {
    headers.forEach((h, c) => { if (rowData[h] !== undefined) sheet.getRange(rowIdx + 1, c + 1).setValue(rowData[h]); });
  }
  return { status: 'ok', id };
}

function deleteSubLibPart(partId, deletedBy) {
  const sheet = getOrCreateSheet('SUBSISTEMA_LIB_PARTS', HEADERS.SUBSISTEMA_LIB_PARTS);
  const data = sheet.getDataRange().getValues();
  const headers = data[0] || [];
  const idxId = headers.indexOf('Part_ID');
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][idxId]) === String(partId)) {
      sheet.getRange(i + 1, headers.indexOf('Ativo') + 1).setValue('NÃO');
      sheet.getRange(i + 1, headers.indexOf('Deleted_At') + 1).setValue(new Date().toISOString());
      sheet.getRange(i + 1, headers.indexOf('Deleted_By') + 1).setValue(deletedBy || 'admin');
      return { status: 'ok' };
    }
  }
  return { status: 'error', error: 'Peça não encontrada' };
}

function linkSubsistemaToModel(modelId, subLibId, createdBy) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const sheet = getOrCreateSheet('MODELO_SUBSISTEMA_LIB_LINKS', HEADERS.MODELO_SUBSISTEMA_LIB_LINKS);
    ensureSheetHeaders('MODELO_SUBSISTEMA_LIB_LINKS', HEADERS.MODELO_SUBSISTEMA_LIB_LINKS);
    const data = sheet.getDataRange().getValues();
    const headers = data[0] || [];
    const dup = data.slice(1).some(r =>
      String(r[headers.indexOf('Model_ID')]) === String(modelId) &&
      String(r[headers.indexOf('Sub_Lib_ID')]) === String(subLibId) &&
      String(r[headers.indexOf('Ativo')]).toUpperCase() === 'SIM'
    );
    if (dup) return { status: 'error', error: 'Este subsistema já está vinculado a este modelo.' };
    const id = Utilities.getUuid();
    const rowData = { Link_ID: id, Model_ID: modelId, Sub_Lib_ID: subLibId, Ativo: 'SIM', Created_At: new Date().toISOString(), Created_By: createdBy || 'admin' };
    sheet.appendRow(headers.map(h => rowData[h] !== undefined ? rowData[h] : ''));
    return { status: 'ok', id };
  } finally { lock.releaseLock(); }
}

function unlinkSubsistemaFromModel(modelId, subLibId, deletedBy) {
  const sheet = getOrCreateSheet('MODELO_SUBSISTEMA_LIB_LINKS', HEADERS.MODELO_SUBSISTEMA_LIB_LINKS);
  const data = sheet.getDataRange().getValues();
  const headers = data[0] || [];
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][headers.indexOf('Model_ID')]) === String(modelId) &&
        String(data[i][headers.indexOf('Sub_Lib_ID')]) === String(subLibId) &&
        String(data[i][headers.indexOf('Ativo')]).toUpperCase() === 'SIM') {
      sheet.getRange(i + 1, headers.indexOf('Ativo') + 1).setValue('NÃO');
      sheet.getRange(i + 1, headers.indexOf('Deleted_At') + 1).setValue(new Date().toISOString());
      sheet.getRange(i + 1, headers.indexOf('Deleted_By') + 1).setValue(deletedBy || 'admin');
      return { status: 'ok' };
    }
  }
  return { status: 'error', error: 'Vínculo não encontrado' };
}
```

No `doPost`, dentro do `switch(action)`, adicionar:

```javascript
case 'saveSubsistemaLib':         result = saveSubsistemaLib(body.data || body.subsistema || {}); break;
case 'deleteSubsistemaLib':       result = deleteSubsistemaLib(body.subLibId, body.deletedBy); break;
case 'saveSubLibPart':            result = saveSubLibPart(body.data || body.part || {}); break;
case 'deleteSubLibPart':          result = deleteSubLibPart(body.partId, body.deletedBy); break;
case 'linkSubsistemaToModel':     result = linkSubsistemaToModel(body.modelId, body.subLibId, body.createdBy); break;
case 'unlinkSubsistemaFromModel': result = unlinkSubsistemaFromModel(body.modelId, body.subLibId, body.deletedBy); break;
```

---

## 6. Implementação — PCM

### 6.1 `db` local e sincronização

Inicializar, próximo a onde `db.models`/`db.machines` são definidos:

```javascript
db.subsistemasLib = db.subsistemasLib || [];
db.modeloSubLinks = db.modeloSubLinks || [];
```

Em `syncCatalogFromGS`, após processar `modelsRows`/`partsRows`/`simRows`, adicionar bloco equivalente para montar `db.subsistemasLib` (cada item com seu array `.parts` resolvido a partir de `result.subLibParts`) e `db.modeloSubLinks` a partir de `result.subsistemasLib` / `result.subLibParts` / `result.modeloSubLinks` (retornados por `getCatalogFull`). Seguir o mesmo padrão de soft-delete já usado (ignorar linhas com `Ativo='NÃO'`).

### 6.2 Tela da Biblioteca de Subsistemas

- Novo botão na área do Catálogo (próximo a "+ Novo modelo"): **"📚 Biblioteca de Subsistemas"**, abrindo uma view/modal `modalSubLibList` com grid: nome, categoria, qtd. de peças, qtd. de modelos vinculados, botões Editar / Excluir / Ver peças.
- Novo modal `modalSubLib` (criar/editar item da biblioteca): Nome, Categoria (mesmo dropdown já usado em `modalSub`), Código de referência (ex.: "E-12"), Fabricante, Intervalo base (h), Descrição técnica. Salvar chama `saveSubsistemaLib` via `syncToGS`.
- No detalhe de um item da biblioteca: lista de peças com adicionar/editar/remover, reaproveitando a UI do `modalPart` já existente, adaptada para gravar via `saveSubLibPart`/`deleteSubLibPart` em vez de `savePartMaster`.

### 6.3 Vínculo no modelo

- No painel `panelSubs` (aba "Subsistemas" da tela do modelo), adicionar botão **"🔗 Vincular subsistema da biblioteca"**, abrindo um seletor (busca simples sobre `db.subsistemasLib`). Ao confirmar, chama `linkSubsistemaToModel(modelId, subLibId)` via `syncToGS` e re-renderiza.
- O render de `panelSubs` passa a mostrar dois grupos: (a) `m.subsystems.map(renderSubsystem)` — inalterado; (b) subsistemas vinculados, resolvidos via `db.modeloSubLinks.filter(l=>l.modelId===m.id)` → `db.subsistemasLib.find(s=>s.id===link.subLibId)`, renderizados em bloco **somente leitura**, com badge "📚 Da biblioteca", peças listadas sem botões de editar/excluir peça individual, e botão **"Desvincular"** (chama `unlinkSubsistemaFromModel`).
- **Crítico:** subsistemas vinculados nunca devem ser inseridos em `m.subsystems`, nem passar por `getAllModelPartsForSync`/`syncFullModelCatalogToGS` — eles não pertencem ao modelo, só são exibidos por referência.

---

## 7. Checklist de teste obrigatório

1. Criar um subsistema novo na Biblioteca (ex.: "Unidade Compressora E-12"), sem vincular a nenhum modelo.
2. Adicionar peças a esse subsistema (ex.: rolamentos com quantidade e modelo).
3. Confirmar que esse subsistema NÃO aparece em nenhuma tela de modelo.
4. Abrir um modelo existente e vincular o subsistema "Unidade Compressora E-12".
5. Confirmar que as peças da unidade aparecem na aba Subsistemas do modelo, com badge "Da biblioteca", sem opção de editar peça individual ali.
6. Editar uma peça da unidade na tela da Biblioteca e confirmar que a alteração aparece no modelo vinculado após sincronizar.
7. Vincular o mesmo subsistema a um segundo modelo e confirmar que aparece nos dois, sem duplicar dados em `PARTS_MASTER`.
8. Desvincular do segundo modelo e confirmar que ele desaparece desse modelo, mas continua no primeiro e continua existindo na Biblioteca.
9. Tentar excluir da Biblioteca um subsistema ainda vinculado a um modelo e confirmar bloqueio com mensagem clara.
10. Desvincular de todos os modelos e então excluir da Biblioteca com sucesso.
11. Confirmar que nenhuma alteração ocorreu em `PARTS_MASTER`, `PART_SIMILARITIES`, `MODELOS` para os subsistemas próprios de cada modelo (regressão).
12. Confirmar que Preventivas, Visitas, Clientes, Máquinas PGP e o módulo de OS continuam funcionando normalmente.
13. Confirmar que `getCatalogFull()` continua retornando os campos antigos (`models`, `parts`, `similarities`) sem alteração de formato.
14. Confirmar ordem de deploy: GAS antes do PCM.

---

## 8. Critério de aceite

- Apenas os dois arquivos indicados no início são alterados nesta tarefa.
- 3 abas novas criadas (`SUBSISTEMAS_LIB`, `SUBSISTEMA_LIB_PARTS`, `MODELO_SUBSISTEMA_LIB_LINKS`); nenhuma aba existente teve coluna removida ou reordenada.
- Biblioteca funciona de forma totalmente independente de modelo.
- Vínculo funciona por referência, sem cópia de dados — edição na Biblioteca reflete em todos os modelos vinculados.
- Exclusão da Biblioteca bloqueada enquanto houver vínculo ativo.
- Nenhuma função de preventiva, visita, cliente, máquina ou OS foi tocada.
- Termo "subsistema" mantido em toda a interface nova.

---

## 9. Versionamento ao final

- Salvar resultado do GAS como `GAS_properCare_v23.js`; preservar `GAS_properCare_v22.js` como versão anterior (mover para a pasta de versões anteriores do GAS, se essa convenção existir no repositório).
- Salvar resultado do PCM como `PCM_v29.html`; se o repositório mantiver um `index.html` como cópia de deploy do PCM, atualizá-lo também; preservar `PCM_v28.html` como versão anterior.
- Indicar claramente, no resumo final da tarefa, a ordem de deploy: **GAS v23 primeiro, depois PCM v29**.
