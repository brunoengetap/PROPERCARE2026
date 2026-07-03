# Prompt — Minhas OS: Filtro por Técnico, Externa/Interna e Fallback de Máquina — Sprint Preventiva↔Pipeline (parte 3, camada PCF)

## Contexto (não pular)

O arquivo `PCF_index_v31.html` é o app de campo (ProperTech). Ele já tem
uma tela "Minhas OS" (overlay `pfOverlay`, aberta por `pfAbrir()`) que
lista OS abertas via `pfLoadOS()`, e um fluxo de preventiva vinculada a OS
via `pgpIniciarPreventivaDeOS(osId)`, que já carrega automaticamente a(s)
máquina(s) vinculada(s) via `getMaquinasByOS`. Isso tudo já funciona e não
deve ser reescrito.

O backend (`GAS_properCare_v48.js`) já suporta filtrar `getOS` por
`params.id_usuario` (comparando com `usuarios_vinculados`, agora
preenchido pelo PCM — sprint anterior). Cada OS retornada por `getOS`
também já traz o campo `local_atendimento` (`'interno'` ou `'externo'`),
porque é uma coluna normal de `ORDENS_SERVICO`.

Há três problemas de UX a resolver, todos **exclusivamente no arquivo
`PCF_index_v31.html`** — não altere o GAS:

### Problema 1 — "Minhas OS" mostra a OS de todo mundo
`pfLoadOS()` chama `pfGet('getOS', {})` sem nenhum parâmetro, então traz
todas as OS abertas do sistema, não só as do técnico logado.

### Problema 2 — Sem separação Externa/Interna
A lista de `pfLoadOS()` vem misturada — não há como o técnico distinguir
rapidamente OS de campo (externa) de OS de oficina (interna).

### Problema 3 — Máquina não vinculada trava o fluxo
Em `pgpIniciarPreventivaDeOS(osId)`, se `getMaquinasByOS` retornar zero
máquinas pra aquela OS, a função hoje mostra um aviso bloqueante
("Vincule ao menos uma máquina no ProperAdmin antes de abrir a
preventiva.") e `return` — sem alternativa. O correto é cair no fluxo
manual de seleção de máquina do cliente, que **já existe e já funciona**
no formulário avulso (`pgpSelectClient` → `pgpFetchMachinesByClient` →
lista de máquinas do cliente + card "+ Esta máquina não está na lista"
para cadastro na hora).

## Antes de codar — audite

1. Rode `grep -n "function pfLoadOS" -A 40 PCF_index_v31.html` e leia a
   função inteira — preste atenção em como `_pfOsList` é montada e
   renderizada (`pf-os-card`), pra não quebrar o HTML gerado.
2. Rode `grep -n "window.PROPER_SESSION" PCF_index_v31.html` e confirme o
   caminho exato pra pegar o ID do usuário logado (já usado em
   `pfAbrirForm` e `pollPfNotificacoes` — reaproveite o mesmo padrão, não
   invente um novo).
3. Rode `grep -n "function pgpIniciarPreventivaDeOS" -A 35 PCF_index_v31.html`
   e leia a função inteira, incluindo o formato exato do objeto retornado
   por `getMaquinasByOS` (campo `r.os.cliente` — confirme que existe e com
   esse nome exato; se a auditoria mostrar outro campo, use o real).
4. Rode `grep -n "function pgpSelectClient\b" -A 20 PCF_index_v31.html` e
   `grep -n "function pgpFetchMachinesByClient" -A 10 PCF_index_v31.html`
   pra confirmar como o fluxo manual de seleção de cliente/máquina
   funciona hoje (é o que você vai reaproveitar, não recriar).
5. Rode `grep -n "local_atendimento" PCF_index_v31.html` pra confirmar que
   hoje não há nenhum uso desse campo na tela de lista (esse é o gap a
   fechar).

**Não assuma nomes de função/variável/campo a partir deste prompt —
confirme com grep antes de escrever qualquer diff.**

## O que implementar

### 1. Filtro por técnico em `pfLoadOS()`

- Passar `{ id_usuario: <id do usuário logado, mesmo padrão usado em
  pfAbrirForm/pollPfNotificacoes> }` para `pfGet('getOS', ...)`.
- Se não houver usuário logado disponível (sessão ainda carregando ou
  campo ausente), manter o comportamento atual (sem filtro) em vez de
  quebrar a tela — não bloquear a listagem por causa disso.

### 2. Separação Externa/Interna

- Adicionar um filtro simples no topo da lista (`pfScreenOS`), no padrão
  visual já usado no restante do app (chips ou abas) com três opções:
  "Todas" (default), "Externas", "Internas" — usando o campo
  `local_atendimento` de cada OS retornada.
- A filtragem pode ser 100% client-side sobre `_pfOsList` (já carregada),
  sem precisar de nova chamada ao backend a cada troca de filtro.
- Lembrar a última opção escolhida não é necessário neste sprint (pode
  sempre abrir em "Todas").

### 3. Fallback de máquina não vinculada em `pgpIniciarPreventivaDeOS`

- Trocar o bloco atual:
  ```js
  if(osMachines.length === 0){
    showNotification('⚠ Esta OS não tem máquinas vinculadas...');
    return;
  }
  ```
  por um fallback que:
  - Pula direto pra etapa 2 do fluxo manual (sem pedir pro técnico digitar
    o cliente de novo, já que ele já é conhecido pela OS) — chamando a
    função que a auditoria confirmar ser a certa para isso a partir do
    nome do cliente já disponível na resposta de `getMaquinasByOS`
    (confirmado no passo 3 da auditoria).
  - Mantém visível o card "+ Esta máquina não está na lista" que esse
    fluxo manual já tem por padrão — não precisa (e não deve) recriar essa
    parte.
  - Se por algum motivo o nome do cliente também não estiver disponível
    (ex: `getMaquinasByOS` retornou erro ou objeto `os` vazio), aí sim
    mostrar uma mensagem — mas orientando o técnico a buscar o cliente
    manualmente na etapa 1, em vez de bloquear com "fale com o admin".

## Regras do projeto (seguir sempre)

- **Nunca sobrescrever arquivos.** Gerar `PCF_index_v32.html` a partir de
  `PCF_index_v31.html`, mantendo tudo que não for alterado exatamente como
  está.
- **Mudanças cirúrgicas** — não reescrever `pfLoadOS` nem
  `pgpIniciarPreventivaDeOS` inteiras; só os trechos descritos acima.
  Não tocar em `pgpCarregarMaquinaOS`, `pgpFetchMachinesByClient`,
  `pgpSelectClient` nem `pgpMachineCardNew` — todas continuam exatamente
  como estão, só sendo reaproveitadas.
- **Terminologia**: "usuário" em qualquer texto novo de UI (nunca
  "técnico"), seguindo o padrão já estabelecido no restante do arquivo.
- **Changelog no topo do arquivo**: adicionar um bloco `// CHANGELOG v32`
  no formato dos blocos já existentes (veja `// CHANGELOG v28` como
  referência de estilo), descrevendo os três pontos: filtro por técnico
  em `pfLoadOS`, separação Externa/Interna, e o novo fallback em
  `pgpIniciarPreventivaDeOS`.
- Não usar `localStorage`/`sessionStorage` além do que já existe no
  arquivo.

## Entrega esperada

1. Arquivo `PCF_index_v32.html` completo.
2. Resumo curto (pode ser no changelog) listando:
   - funções novas criadas (se houver, ex. função de renderização do
     filtro Externa/Interna)
   - funções existentes tocadas (`pfLoadOS`, `pgpIniciarPreventivaDeOS`)
     com o motivo de cada alteração em 1 linha
   - qualquer suposição feita (ex. nome exato do campo de cliente
     retornado por `getMaquinasByOS`, caminho da sessão do usuário) que
     precise ser confirmada antes de produção

## Teste manual sugerido (descrever no resumo, não precisa executar)

1. Logar como um técnico com OS direcionadas a ele (via `usuarios_vinculados`,
   sprint PCM anterior) e OS direcionadas a outro técnico → abrir "Minhas
   OS" → confirmar que só aparecem as próprias.
2. Alternar entre "Todas / Externas / Internas" → confirmar que a lista
   filtra corretamente pelo `local_atendimento` de cada OS.
3. Abrir uma OS de preventiva sem máquina vinculada → confirmar que cai
   direto na lista de máquinas do cliente daquela OS (sem precisar digitar
   o cliente de novo) → clicar em "+ Esta máquina não está na lista" →
   cadastrar → confirmar que segue o fluxo normal de preventiva a partir
   daí.
4. Abrir uma OS de preventiva com máquina já vinculada → confirmar que o
   comportamento atual (carregamento automático) continua idêntico ao de
   antes deste sprint.
