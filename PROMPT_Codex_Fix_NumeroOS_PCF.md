# PROMPT — Codex — Corrigir rótulo de OS exibido no PCF (id_os vs numero_os)

## Contexto
Arquivo alvo: `PCF_index_v34.html` → produzir `PCF_index_v35.html` (versionamento
incremental, não sobrescrever o v34).

Mudança **cirúrgica**, só de exibição/rótulo. **Nenhuma chamada ao GAS pode mudar
de valor.** Todo lugar que hoje usa `_pfOsId` para `os_id` em `getPipelineByOS`,
`registrarAbertura`, `salvarFotosDrivePGP`, `updateTarefaStatus`, montagem de URL de
formulário (`urlComOs`) etc. **continua usando exatamente o mesmo valor de
`id_os`** — isso não é tocado.

## Bug confirmado (auditoria já feita, não reabrir investigação)
O sistema tem dois identificadores de OS por design:
- `id_os` — gerado por `generateOsId_()` no GAS, formato `OS-000006` (sequencial
  interno).
- `numero_os` — o número "de negócio", digitado pelo usuário ou gerado por
  `generateOsNumber_()`, formato tipo `2026007`.

O PCM sempre exibe `numero_os` pro usuário. O PCF, em vários pontos, prioriza
`id_os` na hora de **rotular** a OS na tela — mesmo com `numero_os` disponível no
mesmo objeto. Resultado: a mesma OS aparece com "número" diferente dependendo de
qual tela o usuário está olhando, o que gera a impressão de que são OS diferentes
ou de que algo não sincronizou.

Pontos confirmados via grep (`PCF_index_v34.html`):

1. **Linha 7164** — `pfRenderOS()`:
   `var num = o.id_os || o.numero_os || '—';`
   Esse `num` é usado **duas vezes**: como texto do rótulo (linha 7172, `'OS #' + num`)
   E como argumento passado pro `onclick="pfSelecionarOS(...)"` — ou seja, hoje o
   valor exibido e o valor funcional são a mesma variável. Isso precisa ser
   **desacoplado**: continuar passando `o.id_os` como identificador funcional pro
   `pfSelecionarOS`, mas exibir `o.numero_os || o.id_os` como rótulo.

2. **Linha 7184** — dentro de `pfSelecionarOS(osId, osNome)`:
   `document.getElementById('pfOsLabel').textContent = 'OS #' + osId + ...`
   Aqui `osId` já chega como `id_os` (puro, funcional — correto manter assim pro
   resto da função). O rótulo precisa mostrar o `numero_os` correspondente, não o
   `osId` bruto.

3. **Linha 7548-7553** — dentro de `pfOnNotifClick(notifId, osId)`:
   Mesmo padrão do item 2: já existe um lookup em `_pfOsList` (linha 7549-7551) pra
   pegar `osObj.cliente`. Só precisa também capturar `osObj.numero_os` e usar no
   rótulo da linha 7553, em vez do `osId` bruto.

4. **Linha 6236** — dentro de `pgpIniciarPreventivaDeOS(osId)` (mensagem de sucesso
   "✓ N máquina(s) carregada(s) da OS #..."):
   A resposta de `getMaquinasByOS` (variável `r`, já disponível nesse escopo,
   ~linha 6207) traz `r.os.numero_os`. Usar `r.os && r.os.numero_os || osId` em vez
   de `osId` puro. Prioridade mais baixa que os itens 1-3 (é uma mensagem de toast
   temporária, não um rótulo persistente), mas incluir pra manter consistência.

## O que fazer
Em cada um dos 4 pontos acima, trocar a fonte do texto exibido pro usuário de
`id_os`-primeiro para `numero_os`-primeiro, **sem alterar nenhum valor usado em
chamadas ao GAS** (`os_id` em `pfGet`/`pgpPostJson`, `_pfOsId`, o argumento
funcional passado adiante em `pfSelecionarOS`/`pgpIniciarPreventivaDeOS`).

Sugestão de implementação para o item 1 (linha 7164-7172), mantendo o resto da
função intacta:
```js
var numeroDisplay = o.numero_os || o.id_os || '—';
var idOperacional = o.id_os || o.numero_os || '—';
...
onclick="pfSelecionarOS('...idOperacional escapado...', '...cli+tipo...')"
...
'<div class="pf-os-numero">OS #' + numeroDisplay + '</div>'
```
(o `onclick` deve continuar usando `idOperacional`, não `numeroDisplay`, pra não
quebrar o restante do fluxo que depende de `id_os`).

Para os itens 2 e 3, como as funções `pfSelecionarOS`/`pfOnNotifClick` só recebem
`osId` (o `id_os`), fazer um lookup em `_pfOsList` por `o.id_os === osId` pra
recuperar `numero_os` e usar isso no texto do rótulo — reaproveitando exatamente o
padrão de lookup que `pfOnNotifClick` já faz na linha 7549-7551 (só adicionar
`numero_os` ao que já é extraído ali; para `pfSelecionarOS`, replicar esse mesmo
padrão de `.find()`).

## Restrições (non-negotiable, ver convenções do projeto)
- **Mudança cirúrgica**, só nos 4 pontos listados. Não tocar em nenhuma outra
  função do arquivo, não tocar no fluxo de dados/chamadas ao GAS.
- `_pfOsId` e qualquer variável usada como `os_id` em chamadas ao backend
  **continuam recebendo `id_os`, nunca `numero_os`**. Esse é o identificador que o
  GAS usa pra tudo (`getPipelineByOS`, `getMaquinasByOS`, etc.) — trocar isso
  quebraria a integração, não é o objetivo deste prompt.
- Se `numero_os` estiver vazio/ausente em algum registro, cair pro `id_os` como
  fallback (nunca mostrar "—" se houver qualquer identificador disponível).
- `node --check` no arquivo final antes de entregar (extrair o(s) bloco(s)
  `<script>` sem `src` pra validar sintaxe, já que é HTML).
- Changelog no topo do arquivo, formato do projeto, descrevendo exatamente este
  ajuste.
- Produzir diff com números de linha (antes/depois) junto da entrega.

## Fora de escopo (não fazer neste prompt)
- Não mexer no GAS nem no PCM — o PCM já está correto (sempre mostra `numero_os`).
- Não mexer no Bug 4 (loading states) — prompt separado.
- Não alterar `generateOsId_`/`generateOsNumber_` nem a lógica de geração desses
  identificadores.

## Critério de aceite
1. Abrir uma OS no PCM, anotar o `numero_os` mostrado (ex.: `2026007`).
2. Abrir o PCF, ir na lista de OS do Pipeline → o card deve mostrar
   `OS #2026007`, não `OS #OS-000007`.
3. Clicar na OS → tela de pipeline deve mostrar o mesmo `OS #2026007` no topo.
4. Confirmar que o pipeline carrega normalmente (chamadas de `getPipelineByOS`
   continuam funcionando — ou seja, internamente ainda está usando `id_os`).
5. Clicar numa notificação vinculada a essa OS → mesmo rótulo `OS #2026007`.
