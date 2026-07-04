# PROMPT Codex — Correção dos bugs do Teste de Usabilidade de OS (v54 → v55)

## Papel e regras invioláveis

Você é um executor de mudanças cirúrgicas em código já em produção. **Não redesenhe nada.** Aplique apenas as correções descritas abaixo, uma preocupação por bug, e nada além.

**Disciplina obrigatória (seguir à risca):**

1. **Nunca sobrescreva os arquivos de entrada.** Incremente a versão:
   - `GAS_properCare_v54.js` → **`GAS_properCare_v55.js`**
   - `PCM_v56.html` → **`PCM_v57.html`**
   - (PCF só é tocado no B6 opcional — ver seção. Se tocar: `PCF_index_v36.html` → `PCF_index_v37.html`.)
2. **Audite antes de escrever.** Os números de linha deste prompt são de referência e **podem ter avançado**. Para CADA bug, primeiro rode `grep -n` pela âncora textual indicada, confirme que o trecho existe e é único, e só então edite. Se a âncora não existir ou aparecer mais de uma vez de forma ambígua, **pare e reporte** em vez de adivinhar.
3. **Verifique a camada de roteamento.** Toda ação nova de escrita vai no `doPost`; toda ação de leitura no `doGet`. Confirme no switch real antes de assumir que uma função é alcançável.
4. **Validação obrigatória:** rode `node --check GAS_properCare_v55.js` (e, se aplicável, valide o HTML abrindo/parseando). Não entregue sem passar.
5. **Changelog no topo de cada arquivo alterado:**
   - No `.js` (GAS): bloco de comentário `//` no topo.
   - No `.html` (PCM/PCF): bloco de comentário `<!-- -->` no topo.
6. **Entregue diffs unificados** de cada arquivo antes da entrega final, além dos arquivos completos.
7. **Preserve retrocompatibilidade:** nunca remova chaves/campos legados; só adicione.

---

## Contexto mínimo do sistema

- Backend Google Apps Script (`GAS_properCare_v54.js`), Sheets como banco. `doGet` = leituras, `doPost` = escritas, ambos com `switch(action)`.
- Aba `ORDENS_SERVICO` usa a chave **`id_os`** (NÃO `ID`). A aba tem coluna **`Ativo`** (`SIM`/`NÃO`).
- `getOS` **já filtra** por `Ativo` via `isActive_(o.Ativo)` — então marcar `Ativo=NÃO` some da listagem. Não altere esse filtro.
- Aba `MAQUINAS`: `HEADERS.MAQUINAS` tem **22** colunas, sendo a última `Regime_JSON` (adicionada no v51).
- Aba `PIPELINE_TAREFAS`: `instanciarPipeline` **arquiva** linhas antigas mantendo o mesmo `Tarefa_ID`; linhas arquivadas têm `Ativo` em `ARQUIVADO` ou `NÃO`. O v53 já adicionou um guard `idxAtv` em `updateTarefaStatus`, `designarUsuarioTarefa`, `registrarAbertura` e `ajustarTempoEfetivoTarefa` — use esse padrão como referência.

---

## B1 (P0) — Criar exclusão de Ordem de Serviço

**Problema:** não existe ação `deleteOS` (nem no `doPost`, nem função, nem botão no PCM). `softDelete('ORDENS_SERVICO', id)` não funciona porque casa a linha por `ID`/`ID_Visita`, e a aba usa `id_os`.

### Backend (`GAS_properCare_v55.js`)

1. **Confirme** que não há função `deleteOS` já definida: `grep -n "function deleteOS" GAS_properCare_v54.js` (esperado: nada).
2. **Localize a função `getOS`** (`grep -n "function getOS"`) para copiar o padrão de acesso à aba `ORDENS_SERVICO` (nome da aba, leitura de headers, índice de `id_os` e de `Ativo`). Use os MESMOS helpers já usados no arquivo (ex.: como `updateTarefaStatus`/`saveOS` obtêm sheet, headers e localizam a linha). **Não invente helpers.**
3. **Adicione a função** `deleteOS(payload)` seguindo o estilo do arquivo. Comportamento:
   - Recebe `id_os` (aceite também `payload.id_os` / `payload.ID_OS` por robustez).
   - Localiza a linha por `id_os` na aba `ORDENS_SERVICO`.
   - Se não achar: retorne o mesmo formato de erro/objeto que as outras write-functions usam (ex.: `{ ok:false, error:'OS não encontrada' }` — **use o formato de retorno real já praticado no arquivo**).
   - Se achar: seta `Ativo = 'NÃO'`, e preenche `Updated_At` (timestamp no mesmo formato usado nas demais funções) e `Updated_By` (a partir do payload/sessão, como as outras funções fazem). **Não delete a linha fisicamente** (soft-delete).
   - Retorna sucesso no formato praticado (ex.: `{ ok:true, id_os }`).
   - Envolva a escrita no mesmo padrão de `LockService`/try-finally usado pelas outras write-functions, se elas usarem.
4. **Roteie no `doPost`.** Localize o `switch` do `doPost` (`grep -n "case 'saveOS'"`) e adicione, ao lado das demais escritas:
   ```js
   case 'deleteOS':
     return _json_(deleteOS(payload)); // use o MESMO wrapper de resposta das ações vizinhas
   ```
   Ajuste `_json_`/`payload` para os nomes reais usados no `doPost` (copie exatamente o formato do `case 'saveOS'`).
5. **Não toque** no filtro de `getOS`.

### Frontend (`PCM_v57.html`)

1. **Confirme** o helper POST real: `grep -n "syncToGS\|gsPost" PCM_v56.html` (o relatório aponta `saveOSModal` usando `gsPost`/`syncToGS`). Use o mesmo helper que `saveOS` usa no PCM.
2. Na tela/lista de OS, **adicione um botão "Excluir OS"** (rótulo em UI usa **"usuário"/OS**, texto em pt-BR) visível apenas para admin (`session.is_admin`), seguindo o padrão dos outros botões de ação da lista.
3. O clique deve:
   - Pedir confirmação (`confirm('Excluir esta OS? Ela sairá das listagens.')`).
   - Chamar a ação `deleteOS` com `{ id_os, updated_by: session.tecnico.nome }` via o helper POST real.
   - Ao sucesso, recarregar a listagem de OS (chame a mesma função de refresh que o restante do PCM usa).
   - Tratar erro exibindo mensagem (padrão de toast/alert já usado no arquivo).
4. Respeite o padrão de retry/backoff já existente no wrapper HTTP (não crie um novo fetch cru).

---

## B2 (P1) — `saveMachine` quebra ao editar máquina existente (21 vs 22 colunas)

**Problema:** os dois branches de UPDATE de `saveMachine` montam um array de **21** colunas e escrevem num range de **22** (`getRange(i+1, 1, 1, HEADERS.MAQUINAS.length)`), porque `Regime_JSON` não entra no array. O Apps Script lança:
`The number of columns in the data (21) does not match the number of columns in the range (22).`

### Correção (`GAS_properCare_v55.js`)

1. Localize `saveMachine`: `grep -n "function saveMachine"`.
2. Dentro dela, encontre os **dois** branches de update. Âncoras: os dois `getRange(` que usam `HEADERS.MAQUINAS.length` para escrever a linha inteira (um no match por `id`/`brand+model+serial`, outro no `serial_unique`). `grep -n "HEADERS.MAQUINAS.length" GAS_properCare_v54.js` ajuda a localizar.
3. Em **cada** um dos dois arrays montados imediatamente antes desses `setValues`, garanta 22 colunas. **Preferência:** logo antes do `setValues`, normalize o comprimento sem perder o valor existente de `Regime_JSON`:
   ```js
   var idxRegime = HEADERS.MAQUINAS.indexOf('Regime_JSON');
   // preserva o Regime_JSON já gravado na linha, se o array novo não o traz
   if (idxRegime >= 0 && rowArr.length <= idxRegime) {
     while (rowArr.length < idxRegime) rowArr.push('');
     rowArr.push(String((existingRow && existingRow[idxRegime]) || ''));
   }
   while (rowArr.length < HEADERS.MAQUINAS.length) rowArr.push('');
   ```
   Adapte `rowArr` e `existingRow` para os nomes reais das variáveis em cada branch (o array que vai pro `setValues` e a linha lida da planilha). Se o branch **já tiver** um valor de regime calculado (ex.: `regimeData`), use-o em vez do valor da linha.
4. **Não** altere o INSERT (`appendRow`) — ele funciona.
5. Após editar, faça um raciocínio de sanidade: os dois arrays agora têm `HEADERS.MAQUINAS.length` posições.

---

## B3 (P1) — Bug de linha arquivada em `autoCompletarTarefa` e `_finalizarAtendimentoOS_`

**Problema:** após troca de pipeline, a preventiva conclui a tarefa **ARQUIVADA** (que vem antes na aba) e dá `break`; a ativa fica `pendente` e a OS nunca fecha. Duas funções ficaram fora do guard do v53.

### Correção (`GAS_properCare_v55.js`)

1. **Referência do padrão v53:** `grep -n "idxAtv" GAS_properCare_v54.js` e leia como as funções já corrigidas pulam linhas arquivadas (guard típico:
   ```js
   var idxAtv = headers.indexOf('Ativo');
   // dentro do loop de linhas:
   if (idxAtv >= 0 && ['ARQUIVADO','NÃO'].indexOf(String(row[idxAtv] || 'SIM').toUpperCase()) >= 0) continue;
   ```
   ). Replique **exatamente** esse estilo (mesmos nomes de variável quando possível).
2. **`autoCompletarTarefa`** — `grep -n "function autoCompletarTarefa"`. No laço que percorre as linhas de `PIPELINE_TAREFAS` procurando a tarefa a completar, adicione o guard `idxAtv` **antes** de casar `OS_ID + Tarefa_ID` e antes de qualquer `break`. Assim ele ignora a linha arquivada e alcança a ativa.
3. **`_finalizarAtendimentoOS_`** — `grep -n "function _finalizarAtendimentoOS_"`. Encontre o laço que decide `todasCompletas` (varre as tarefas do pipeline verificando se todas estão `completo`). Adicione o mesmo guard `idxAtv` para que linhas arquivadas **não sejam contadas** — senão, mesmo com a ativa completa, a arquivada (não-completa) impediria o fechamento; e vice-versa.
4. Verifique que os índices `idxAtv` são obtidos a partir do `headers` correto de `PIPELINE_TAREFAS` em cada função.
5. Sanidade lógica esperada após o fix: com uma tarefa ativa `T01` completa e uma arquivada `T01` incompleta, `_finalizarAtendimentoOS_` deve fechar a OS (`concluida`).

---

## B4 (P2) — `Regime_JSON` não grava no INSERT de `ensureMachineFromVisit`

**Problema:** no `ensureMachineFromVisit`, o caminho de UPDATE grava `Regime_JSON`, mas o caminho de **INSERT** (a "Passagem 4" que monta a nova linha com `Potência`/`Tipo_Equip`/`Obs_Op`) esquece `Regime_JSON`. Máquina criada pela 1ª vez a partir de uma preventiva perde o regime.

### Correção (`GAS_properCare_v55.js`)

1. `grep -n "function ensureMachineFromVisit"`. Localize o bloco de INSERT (onde a nova linha `newRow` recebe `Potência`/`Tipo_Equip`/`Obs_Op` e é preenchida/padronizada antes do `appendRow`). O UPDATE vizinho (`applyRow`) mostra como o `Regime_JSON`/`regimeData` é obtido — reutilize a MESMA fonte de dado.
2. No bloco de padding/preenchimento do INSERT, adicione:
   ```js
   var idxRegime = HEADERS.MAQUINAS.indexOf('Regime_JSON');
   if (idxRegime >= 0) newRow[idxRegime] = regimeData || '';
   ```
   Ajuste `newRow` e `regimeData` para os nomes reais (a variável que carrega o regime vindo do payload da visita — a mesma que o UPDATE usa).
3. Garanta que isso ocorre **antes** do `appendRow`/`setValues` do insert e que `newRow` continua com `HEADERS.MAQUINAS.length` posições.

---

## B5 (P2) — Máquina "nascida no campo" não entra em `OS_MAQUINAS` **(CONFIRMADO — APLICAR)**

**Problema:** `_marcarMaquinaAtendidaOS_` só **atualiza** vínculo existente; se a máquina não foi pré-vinculada à OS na abertura, nenhum vínculo é criado e `getMaquinasByOS` retorna `total=0`.

**Intenção de negócio (confirmada):** a preventiva pode ocorrer em 3 situações, e todas devem terminar com a máquina visível na OS:
1. **Vínculo completo** — máquina pré-cadastrada no PCM ou em visita anterior (PCF inspeção), com todos os dados. Vínculo `OS_MAQUINAS` já existe → hoje só atualiza. ✅ já funciona.
2. **Vínculo sem dados completos** — máquina vinculada no PCM mas faltando dados; a preventiva completa os dados. Vínculo já existe → atualiza. ✅ já funciona.
3. **Cadastro nascendo no campo** — máquina cadastrada agora pelo PCF inspeção, **sem** vínculo prévio. É o caso que quebra: sem vínculo, `getMaquinasByOS` retorna 0 e a máquina não aparece na OS. **É o alvo do B5.**

### Correção (`GAS_properCare_v55.js`)

1. `grep -n "function _marcarMaquinaAtendidaOS_"` e `grep -n "_upsertOsMaquina_\|OS_MAQUINAS" GAS_properCare_v54.js` — confirme o helper real de criação/upsert de vínculo e sua assinatura, e como `saveOS` cria a linha em `OS_MAQUINAS` na abertura (colunas, status inicial). **Reutilize exatamente esse schema.**
2. Garanta que o `maquina_id` usado é o que **acabou de ser resolvido/criado** por `ensureMachineFromVisit` nesta mesma execução (não um id stale). Se `_marcarMaquinaAtendidaOS_` não recebe esse id explicitamente, passe-o a partir do ponto onde `ensureMachineFromVisit` retorna.
3. Em `_marcarMaquinaAtendidaOS_`, no ponto onde hoje a busca pelo vínculo falha (loga *"nenhum vínculo OS_MAQUINAS encontrado"*): **antes de sair**, crie o vínculo (via `_upsertOsMaquina_` ou o mesmo caminho que `saveOS` usa) com `os_id` + `maquina_id` e o status inicial padrão, e **em seguida** marque como `atendida` — reaproveitando o fluxo de atualização que já existe logo abaixo. O objetivo: casos 1/2 continuam idênticos; caso 3 passa a criar-e-marcar.
4. **Idempotência:** se por concorrência o vínculo já existir, não duplique — o upsert deve atualizar em vez de inserir segunda linha. Confirme que o helper reutilizado já garante isso (é o mesmo princípio dos upserts do sistema).
5. Se o helper de upsert **não** existir com semântica de criar-ou-atualizar, **não** invente um genérico novo: replique o insert de `OS_MAQUINAS` do `saveOS` num helper privado pequeno `_upsertOsMaquina_(os_id, maquina_id, status)` no estilo do arquivo, com guard de "já existe? atualiza : insere".

---

## B6 (P3) — `VISITAS.OS_Numero` fica vazio em preventiva vinda de OS

**Problema:** o payload do PCF manda `os_id` mas não `os_numero`; `savePreventiva` grava `body.os_numero || body.OS_Numero || ''` → coluna em branco.

### Correção preferida — GAS-only (`GAS_properCare_v55.js`)

1. `grep -n "function savePreventiva"`. Encontre onde `OS_Numero` é resolvido (`body.os_numero || body.OS_Numero || ''`).
2. Quando vier `os_id` mas não `os_numero`, **resolva** `numero_os` a partir do `os_id` lendo a aba `ORDENS_SERVICO` (use o mesmo padrão de leitura de `getOS` para localizar a linha por `id_os` e ler a coluna `numero_os`). Fallback: mantém `''` se não achar. Não quebre se `os_id` estiver ausente.
   ```js
   var osNumero = body.os_numero || body.OS_Numero || '';
   if (!osNumero && (body.os_id || body.OS_ID)) {
     osNumero = _resolveNumeroOsById_(body.os_id || body.OS_ID) || '';
   }
   ```
   Se não houver helper equivalente, faça a leitura inline (sem criar dependências novas pesadas) ou um helper privado `_resolveNumeroOsById_` pequeno, no estilo do arquivo.

### PCF — **NÃO alterar** (decisão tomada)
O fix é **exclusivamente GAS-only**. Não toque no PCF: a resolução de `OS_Numero` a partir do `os_id` no `savePreventiva` já cobre inclusive as instalações do PCF já em produção, sem re-deploy. Não versione `PCF_index`.

---

## B7 (P3) — Validação de fechamento compara label em vez de Tipo_ID

**Problema:** em `saveOS`, `if (tipoOsAtual === 'Preventiva')` compara com o **label**, mas o campo armazenado é o **Tipo_ID** (`PREVENTIVA`, `MANUT_SIMPLES`…). Nunca casa; toda conclusão manual no PCM cai no ramo que exige `observacao_fechamento`.

### Correção (`GAS_properCare_v55.js`)

1. `grep -n "'Preventiva'" GAS_properCare_v54.js` dentro de `saveOS`.
2. Substitua a comparação por uma que case o Tipo_ID real, case-insensitive:
   ```js
   var _tipoNorm = String(tipoOsAtual || '').trim().toUpperCase();
   if (_tipoNorm === 'PREVENTIVA') { /* ramo preventiva */ }
   ```
   Ajuste `tipoOsAtual` ao nome real da variável. **Não** altere o fechamento automático de campo (que não passa por essa validação).

---

## Changelog a inserir no topo

### `GAS_properCare_v55.js` (comentário `//`)
```
// ============================================================
// GAS_properCare v55 — 04/07/2026
// Correções do Teste de Usabilidade de OS (relatório v54):
//   B1 (P0) deleteOS: nova ação de soft-delete (Ativo=NÃO) por id_os + roteamento doPost
//   B2 (P1) saveMachine: arrays de update agora com 22 colunas (Regime_JSON)
//   B3 (P1) autoCompletarTarefa + _finalizarAtendimentoOS_: guard idxAtv p/ pular linhas arquivadas
//   B4 (P2) ensureMachineFromVisit: Regime_JSON gravado também no INSERT
//   B5 (P2) _marcarMaquinaAtendidaOS_: cria vínculo OS_MAQUINAS quando ausente (máquina nascida no campo)
//   B6 (P3) savePreventiva: resolve OS_Numero a partir de os_id
//   B7 (P3) saveOS: validação de fechamento compara Tipo_ID 'PREVENTIVA' (não o label)
// ============================================================
```

### `PCM_v57.html` (comentário `<!-- -->`)
```
<!--
  PCM v57 — 04/07/2026
  B1 (P0): botão "Excluir OS" (admin) na listagem de OS -> ação deleteOS (soft-delete).
-->
```

---

## Ordem de execução sugerida

1. B7, B2, B4, B6 (edições locais de baixo risco).
2. B3 (guard em duas funções, com raciocínio de sanidade).
3. B5 (upsert de vínculo em `OS_MAQUINAS` — reusar schema do `saveOS`).
4. B1 (função nova + roteamento + botão PCM).

## Checklist final antes de entregar

- [ ] `node --check GAS_properCare_v55.js` passou.
- [ ] `deleteOS` está no `doPost` (não no `doGet`) e usa o mesmo wrapper de resposta das ações vizinhas.
- [ ] Os dois arrays de update de `saveMachine` têm `HEADERS.MAQUINAS.length` (22) colunas.
- [ ] `autoCompletarTarefa` e `_finalizarAtendimentoOS_` ignoram linhas `ARQUIVADO`/`NÃO`.
- [ ] INSERT de `ensureMachineFromVisit` grava `Regime_JSON`.
- [ ] B5: máquina nascida no campo (caso 3) cria vínculo em `OS_MAQUINAS` e aparece em `getMaquinasByOS`; casos 1/2 inalterados; upsert idempotente (sem linha duplicada).
- [ ] `savePreventiva` resolve `OS_Numero` por `os_id` (GAS-only; PCF intocado).
- [ ] `saveOS` compara `'PREVENTIVA'` (Tipo_ID).
- [ ] Botão "Excluir OS" no PCM chama `deleteOS` via o helper POST real, com confirmação e refresh.
- [ ] Changelogs inseridos no topo dos arquivos alterados.
- [ ] Diffs unificados de cada arquivo anexados.
- [ ] Nenhum arquivo de entrada foi sobrescrito; versões incrementadas.
