# Prompt — Fechamento Automático da OS ao Registrar Preventiva — Sprint Preventiva↔Pipeline (parte 3, camada GAS)

## Contexto (não pular)

O arquivo `GAS_properCare_v47.js` é o backend único (Google Apps Script) do
ecossistema ProperHub. A função `savePreventiva` já recebe `body.os_id`
(quando a preventiva foi aberta a partir de uma tarefa do pipeline de uma
OS) e, quando esse campo vem preenchido, já faz três coisas ao final,
depois de gravar a visita:

1. `autoCompletarTarefa(body.os_id, 'preventiva', {...})` — marca a tarefa
   `auto:preventiva` daquela OS como `completo` em `PIPELINE_TAREFAS`.
2. `_marcarMaquinaAtendidaOS_(body.os_id, machineId, visitId)` — marca o
   vínculo correspondente em `OS_MAQUINAS` como `atendida`.
3. `_adicionarVisitaResultadoOS_(body.os_id, visitId)` — acrescenta o ID da
   visita em `visit_ids_resultado_json` na linha da OS.

Isso tudo já está pronto e não deve ser alterado. O que falta: **nada,
hoje, atualiza o `status` da OS nem o campo `fim_atendimento` dela**. Esses
dois campos só mudam por ação manual do admin no PCM, através de `saveOS`
(que já tem validação de fechamento em `FECHAMENTO_INCOMPLETO` — não
mexer nessa validação, ela deve continuar valendo para edições manuais).

Sua tarefa é **exclusivamente no arquivo `GAS_properCare_v47.js`**: criar
a lógica de fechamento automático descrita abaixo, chamada a partir de
`savePreventiva`, sem tocar em `saveOS` nem na validação de fechamento
manual que já existe lá.

## Regra de negócio (não pular — é o núcleo do sprint)

Toda vez que uma preventiva vinculada a uma OS (`body.os_id` presente) for
registrada com sucesso:

1. **Sempre** gravar `fim_atendimento = now` (ISO) na linha da OS
   correspondente — mesmo que ainda existam outras tarefas pendentes no
   pipeline dessa OS. Esse campo representa "quando a preventiva mais
   recente terminou", não necessariamente o encerramento da OS. Se já
   houver um valor em `fim_atendimento`, sobrescrever com o novo (última
   atividade prevalece).
2. Verificar todas as linhas de `PIPELINE_TAREFAS` cujo `OS_ID` seja igual
   a `body.os_id`. **Somente se todas** estiverem com `Status = 'completo'`
   (nenhuma pendente/em_andamento/bloqueada/incompleta/com_pendencia),
   então o `status` da OS deve mudar para `concluida`.
3. Se ainda houver ao menos uma tarefa não-completa no pipeline dessa OS,
   **não alterar o `status` da OS** (mantém o que já estava — normalmente
   `aberta` ou `em_andamento`). Apenas o `fim_atendimento` é atualizado
   nesse caso.
4. Este fechamento automático é **não-bloqueante**: qualquer erro aqui
   nunca deve reverter ou impedir a gravação da preventiva já feita acima
   — sempre dentro de try/catch isolado, seguindo exatamente o mesmo
   padrão que `_marcarMaquinaAtendidaOS_`/`_adicionarVisitaResultadoOS_`
   já usam dentro de `savePreventiva`.

## Antes de codar — audite

1. Rode `grep -n "function savePreventiva" GAS_properCare_v47.js` e leia a
   função inteira, com atenção especial ao bloco final (onde já estão as
   três chamadas descritas no Contexto) para confirmar nomes exatos de
   variáveis disponíveis ali (`body.os_id`, `visitId`, `machineId`, etc.).
2. Rode `grep -n "function _marcarMaquinaAtendidaOS_\|function _adicionarVisitaResultadoOS_" GAS_properCare_v47.js`
   e leia essas duas funções por completo — são o padrão de estilo e
   tratamento de erro que sua função nova deve seguir (leitura de sheet
   via `getOrCreateSheet`/`getDataRange`, montagem de `idx` a partir dos
   headers, `Logger.log` em vez de lançar erro quando não encontra o
   registro esperado).
3. Rode `grep -n "function saveOS" -A 5 GAS_properCare_v47.js` e localize o
   trecho de validação `FECHAMENTO_INCOMPLETO` (variáveis `statusNovoBruto`,
   `isOsClosed_`, `tipoOsAtual`, `obsFechamento`, `visitIds`). **Não altere
   esse bloco.** Ele só se aplica a edições manuais via `saveOS`; sua
   função nova escreve diretamente nas células da aba `ORDENS_SERVICO`,
   sem passar por `saveOS`, então não precisa (e não deve) replicar essa
   validação — mas precisa saber que ela existe para não duplicar lógica
   por engano.
4. Rode `grep -n "function normalizeOsStatus_\|function isOsClosed_" GAS_properCare_v47.js`
   e confirme como o valor `'concluida'` é normalizado/reconhecido, para
   gravar o status novo com o mesmo valor que o resto do sistema usa.
5. Rode `grep -n "HEADERS.ORDENS_SERVICO\|HEADERS.PIPELINE_TAREFAS" GAS_properCare_v47.js`
   uma vez para confirmar os nomes exatos das colunas `status`,
   `fim_atendimento`, `OS_ID` e `Status` (atenção: uma é minúscula em
   `ORDENS_SERVICO`, a outra é capitalizada em `PIPELINE_TAREFAS` — não
   assuma, confirme no grep).

**Não assuma nomes de função/variável/coluna a partir deste prompt —
confirme com grep antes de escrever qualquer diff.**

## O que implementar

### 1. Nova função `_finalizarAtendimentoOS_(os_id, usuario)`

- Localiza a linha da OS em `ORDENS_SERVICO` pelo `os_id`. Se não
  encontrar, `Logger.log` e retorna silenciosamente (não-bloqueante).
- Grava `fim_atendimento = now` nessa linha, sempre.
- Busca todas as linhas de `PIPELINE_TAREFAS` com aquele `OS_ID`. Se a
  lista vier vazia (OS sem pipeline instanciado), **não** muda o status —
  só grava o `fim_atendimento` e sai (não há como avaliar "todas
  completas" sem tarefas).
- Se a lista não vier vazia e **todas** as tarefas tiverem
  `Status === 'completo'`, grava `status = 'concluida'` na linha da OS
  (usar o mesmo valor normalizado que `normalizeOsStatus_('concluida')`
  produziria, para manter consistência).
- Se qualquer tarefa não estiver completa, não mexe no `status`.
- Tudo dentro de um único `try/catch` no nível da função (a própria função
  já deve ser resiliente por dentro, sem lançar exceção pra quem chamou).

### 2. Chamada a partir de `savePreventiva`

- Adicionar a chamada `_finalizarAtendimentoOS_(body.os_id, responsavel)`
  (ou o nome de variável de usuário/responsável que a auditoria confirmar
  que já existe em `savePreventiva` — não invente um novo) dentro do
  mesmo bloco `if (body.os_id) { ... }` que já existe, ao lado das duas
  chamadas atuais, também em try/catch próprio.
- Ordem sugerida (mas confirme se faz diferença pela auditoria): chamar
  `_finalizarAtendimentoOS_` **depois** de `autoCompletarTarefa` já ter
  rodado (que está fora desse bloco `if`, antes dele) — isso garante que,
  ao checar se "todas as tarefas estão completas", a tarefa de preventiva
  que acabou de ser concluída já esteja refletida na planilha.

## Regras do projeto (seguir sempre)

- **Nunca sobrescrever arquivos.** Gerar `GAS_properCare_v48.js` a partir
  de `GAS_properCare_v47.js`, mantendo tudo que não for alterado
  exatamente como está.
- **Mudanças cirúrgicas** — não reescrever `savePreventiva` inteira; só
  acrescentar a nova chamada dentro do bloco `if (body.os_id)` já
  existente. Não tocar em `saveOS`, na validação `FECHAMENTO_INCOMPLETO`,
  nem em `autoCompletarTarefa`, `_marcarMaquinaAtendidaOS_` ou
  `_adicionarVisitaResultadoOS_` — todas continuam exatamente como estão.
- **Toda função nova que grava dados** deve seguir o padrão de
  não-bloqueio já usado no restante do arquivo (try/catch isolado,
  `Logger.log` para casos não encontrados, nunca lançar erro que reverta
  a preventiva).
- **Changelog no topo do arquivo**: adicionar um bloco `// GAS_properCare_v48.js`
  seguindo exatamente o formato dos blocos já existentes (veja `// v47 —`
  como referência de estilo), descrevendo:
  - a nova função `_finalizarAtendimentoOS_` e a regra de negócio (sempre
    grava `fim_atendimento`; só fecha a OS quando todas as tarefas do
    pipeline estiverem completas)
  - onde ela é chamada (`savePreventiva`, bloco `if (body.os_id)`)
  - que a validação de fechamento manual em `saveOS`
    (`FECHAMENTO_INCOMPLETO`) não foi alterada e continua valendo para
    edições manuais no PCM
- Não usar `localStorage`/`sessionStorage` (não é relevante em GAS, mas
  mantendo o padrão do projeto).

## Entrega esperada

1. Arquivo `GAS_properCare_v48.js` completo.
2. Um resumo curto (pode ser no próprio changelog) listando:
   - a função nova criada, com a assinatura exata
   - a função existente que foi tocada (`savePreventiva`) e o motivo em
     1 linha
   - qualquer suposição feita (ex. nome da variável de usuário/responsável
     usada na chamada) que precise ser confirmada antes de produção

## Teste manual sugerido (descrever no resumo, não precisa executar)

1. OS com pipeline de uma única tarefa (`auto:preventiva`): registrar a
   preventiva vinculada a essa OS → confirmar que `fim_atendimento` foi
   preenchido **e** `status` virou `concluida`.
2. OS com pipeline de duas tarefas (`auto:preventiva` + outra manual ainda
   pendente): registrar a preventiva → confirmar que `fim_atendimento` foi
   preenchido, mas `status` **não** mudou.
3. Depois, concluir manualmente a segunda tarefa (via `updateTarefaStatus`,
   já existente) → confirmar que isso **não** aciona `_finalizarAtendimentoOS_`
   de novo (ela só é chamada a partir de `savePreventiva`) — ou seja, nesse
   cenário o fechamento final da OS continua sendo manual pelo admin no
   PCM, o que é o comportamento esperado deste sprint (só a preventiva
   dispara o fechamento automático, não qualquer tarefa).
