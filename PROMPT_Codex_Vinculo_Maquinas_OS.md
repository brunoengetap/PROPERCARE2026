# Prompt — Vínculo de Máquinas na OS (PCM) — Sprint Preventiva↔Pipeline (parte 2)

## Contexto (não pular)

O arquivo `PCM_v47.html` é o painel admin (ProperAdmin) do ecossistema ProperHub.
O backend (`GAS_properCare_v47.js`, função `saveOS`) **já aceita e processa**
o campo `maquinas_vinculadas` tanto na criação quanto na edição de uma OS —
ele grava os vínculos na aba `OS_MAQUINAS` via `_upsertOsMaquina_`. Isso já
está pronto e não deve ser alterado.

O problema: **nenhuma tela do PCM hoje envia esse campo**. Sem ele, o fluxo
de Preventiva↔Pipeline (PCF) não funciona, porque `pgpIniciarPreventivaDeOS`
no PCF depende de `getMaquinasByOS` retornar ao menos 1 máquina.

Sua tarefa é **exclusivamente de frontend, no arquivo `PCM_v47.html`**: criar
a interface para selecionar/gerenciar as máquinas vinculadas a uma OS. Não
altere o GAS — os endpoints necessários já existem (`saveOS` com
`maquinas_vinculadas`, `getMaquinasByOS`).

## Antes de codar — audite

1. Rode `grep -n "db.machines\|buildMachinesByClientKey\|clientKey(" PCM_v47.html`
   para confirmar a estrutura atual de `db.machines` (array global já
   carregado no client-side) e a função `clientKey()` usada para casar
   máquina↔cliente por nome canônico.
2. Rode `grep -n "modalOS\|openModalOS\|saveOSModal\|osTipoOS\|osClienteId" PCM_v47.html`
   para localizar o modal de criação/edição de OS e sua função de salvar.
3. Rode `grep -n "getMaquinasByOS\|maquinas_vinculadas" PCM_v47.html`
   e confirme que hoje não há nenhuma ocorrência (esse é o gap a fechar).
4. Rode `grep -n "_osDetailField\|function _renderOSDetail\|function _abrirDetalheOS" PCM_v47.html`
   para localizar a tela de detalhe de uma OS existente (onde hoje mostra
   Tipo, Status etc via `_osDetailField`), que é onde a seção de máquinas
   vinculadas em OS já existentes deve entrar.

**Não assuma nomes de função/variável a partir deste prompt — confirme com
grep antes de escrever qualquer diff.** Se algum identificador citado aqui
não bater com o que você encontrar, use o que estiver realmente no arquivo.

## O que implementar

### 1. Seletor de máquinas no modal de criação de OS (`#modalOS`)

- Adicionar um novo `form-row` no modal, logo abaixo do campo "Cliente",
  com um multi-select (ou lista de checkboxes, o que for mais simples de
  integrar no padrão visual existente) das máquinas do cliente selecionado.
- A lista de máquinas candidatas vem de `db.machines`, filtradas pelo
  cliente atual usando o mesmo padrão de `clientKey()` já usado em
  `buildMachinesByClientKey()` (comparar `clientKey(machine.client)` com
  `clientKey(cliente selecionado)`).
- Cada opção deve exibir algo como `${marca} ${modelo} — ${serial || tag || 'sem série'}`
  (adapte aos campos reais de `db.machines`, confirmados no passo de
  auditoria).
- **Atualização dinâmica**: quando o campo Cliente mudar (já existe
  `_osClienteInputHandler`), a lista de máquinas deve recarregar para
  refletir o novo cliente. Se o cliente ainda não tiver `id_cliente`
  resolvido, mostrar lista vazia com uma mensagem tipo "Selecione um
  cliente cadastrado para ver as máquinas".
- Se o cliente não tiver nenhuma máquina cadastrada, mostrar mensagem
  "Nenhuma máquina cadastrada para este cliente" (não bloquear o salvamento
  da OS — vincular máquina continua opcional para tipos de OS que não
  dependem disso).

### 2. Envio do vínculo ao salvar

- Em `saveOSModal()`, coletar os IDs das máquinas marcadas e incluir no
  payload como `maquinas_vinculadas: [...]` (array de IDs/machineKey —
  confirme no GAS qual valor `_upsertOsMaquina_` espera como
  `machineKeyVal`; deve ser o mesmo `id` usado em `db.machines`).
- Isso deve funcionar tanto na criação (`action: 'saveOS'` sem `id_os`)
  quanto na edição (`payload.id_os = id`), já que o backend aceita o campo
  nos dois casos.

### 3. Edição de vínculos em OS já existente

- Ao abrir `openModalOS(id)` para editar uma OS existente, pré-carregar
  as máquinas já vinculadas via `getMaquinasByOS({ id_os: id })` e marcar
  as opções correspondentes no seletor.
- Alternativa mais simples caso o modal fique poluído: adicionar a seção
  "Máquinas vinculadas" na tela de **detalhe** da OS (não no modal),
  com um pequeno botão "+ Vincular máquina" que abre um mini-seletor e
  chama `syncToGS('saveOS', { id_os, maquinas_vinculadas: [...] })`
  reaproveitando a lista atual + a nova. Escolha a abordagem que exigir
  menos refatoração do modal atual — ambas são aceitáveis, mas a tela de
  detalhe é preferível por ser menos invasiva.

### 4. (Se a auditoria confirmar que existe uma aba/seção "Pipeline" na tela
de detalhe da OS) Botão "Abrir no PCF"

- Adicionar um botão na aba de pipeline da tela de detalhe da OS que abre
  em nova aba a URL do PCF com `?modo=pipeline&os_id=<id_da_os>`.
- A URL base do PCF deve ser uma constante clara no topo do arquivo (ex.
  `const PCF_BASE_URL = 'https://grupotap.github.io/PCF/'` — confirme a URL
  real hospedada; se não houver essa constante em nenhum lugar do arquivo,
  pergunte antes de inventar a URL, ou deixe como
  `TODO_CONFIRMAR_URL_PCF` visível no código e sinalize isso no changelog).
- Este item é opcional/nice-to-have — não bloqueie a entrega principal
  (itens 1-3) por causa dele.

## Regras do projeto (seguir sempre)

- **Nunca sobrescrever arquivos.** Gerar `PCM_v48.html` a partir de
  `PCM_v47.html`, mantendo tudo que não for alterado exatamente como está.
- **Mudanças cirúrgicas** — não reescrever funções inteiras que não
  precisam mudar. `saveOSModal()` deve ganhar só o necessário para montar e
  enviar `maquinas_vinculadas`.
- **Terminologia**: usar "usuário" em qualquer texto novo de UI/comentário
  (nunca "técnico"), seguindo o padrão já estabelecido no restante do
  arquivo.
- **Changelog no topo do arquivo**: adicionar um bloco `// v48 — ...`
  seguindo exatamente o formato dos blocos de changelog já existentes no
  início do arquivo (veja os blocos `// v47 —`, `// v46 —` etc. como
  referência de estilo), descrevendo:
  - o que foi adicionado (seletor de máquinas no modal/detalhe de OS)
  - qual payload novo é enviado ao `saveOS`
  - que o backend (GAS) não foi alterado, pois já suportava o campo
- **Não mexer no GAS.** Este prompt é só para `PCM_v47.html` → `PCM_v48.html`.
- Não usar `localStorage`/`sessionStorage` além do que já existe no arquivo
  (não é relevante aqui, mas mantendo o padrão do projeto).

## Entrega esperada

1. Arquivo `PCM_v48.html` completo.
2. Um resumo curto (pode ser no próprio changelog) listando:
   - as funções novas criadas
   - as funções existentes que foram tocadas (com o motivo de cada
     alteração em 1 linha)
   - qualquer suposição feita (ex. nome do campo de ID em `db.machines`,
     URL do PCF) que precise ser confirmada por mim antes de ir para
     produção.

## Teste manual sugerido (descrever no resumo, não precisa executar)

1. Abrir OS existente de um cliente com máquinas cadastradas → editar →
   vincular 1-2 máquinas → salvar → reabrir a OS → confirmar que os
   vínculos persistiram (via `getMaquinasByOS` refletido na UI).
2. Criar OS nova já vinculando máquina na criação → confirmar que
   `OS_MAQUINAS` recebe o vínculo (pode ser confirmado depois por mim,
   olhando a planilha).
