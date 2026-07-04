# ESTADO_ATUAL — ProperHub / ProperCare

> **Fonte canônica de verdade do sistema.** O nome deste arquivo **nunca muda**, mesmo com o churn de versões.
> No início de cada sessão, suba este arquivo para o Claude sincronizar tudo em um anexo.
> Repositório: `brunoengetap/PROPERCARE2026` (raiz).

**Última atualização:** 04/07/2026 · **Por:** auditoria do Sprint v37 (PCF/OS/preventiva) — GAS v56 · PCM v58 · PCF v37

---

## 1. Versões atuais  *(seção sobrescrita a cada sprint — sempre reflete o que está no repo)*

| Componente | Arquivo | Status |
|-----------|---------|--------|
| Backend GAS | `GAS_properCare_v56.js` | ✅ auditado (estático + `node --check`) — pronto para deploy |
| PCM (admin) | `PCM_v58.html` | ✅ auditado — pronto para publicar |
| PCF (campo) | `PCF_index_v37.html` | ✅ auditado — pronto para publicar (**alterado no Sprint v37**) |
| ProperHub (portal SSO) | `ProperHub_index_v13.html` | estável |

**Pendência de deploy:** GAS v56 ainda **não implantado**; PCM v58 **e agora também PCF v37** ainda **não publicados** no GitHub Pages (v37 mexeu no PCF — diferente do v55, que era GAS-only). Ver §6.

---

## 2. Changelog  *(seção APENDÁVEL — nunca reescrever entradas antigas; só adicionar no topo)*

### v56 (GAS) + v58 (PCM) + v37 (PCF) — 04/07/2026 — Sprint PCF/OS/Preventiva
Sprint de usabilidade da preventiva dentro da OS. **Nível de auditoria: estática + `node --check` + verificação estrutural** (grep de call-sites, roteamento doGet/doPost, balanço de `<script>`, diff linha-a-linha contra v55/v57/v36). **Harness Node A/B/C não reexecutado nesta sessão** — promover para "confirmado" após rodá-lo. Diffs cirúrgicos: GAS mexeu só em `savePreventiva`/helpers de `MACHINE_PARTS`/`_finalizarAtendimentoOS_`; PCM mudou **1 linha**; PCF ganhou ~178 linhas. Todos os fixes v55/v57 (B1–B7) preservados.
- **Item 1 — Horas automáticas na preventiva de OS.** `pfAbrirForm`/`checkHubSession` passam `tarefa_id` + `inicio_preventiva_iso` pela URL; helpers `pgpIsoToHHMMLocal`/`pgpNowHHMMLocal`; início gravado em `m0_hora_inicio`, fim em `m0_hora_fim`. Campos de hora continuam no DOM (PDF/resumo/payload intactos); apenas o *wrap* visual é escondido em preventiva vinculada a OS.
- **Item 2 — Retorno persistente para a OS.** `#pgpReturnToOSContainer` renderiza card no fluxo (não mais banner `position:fixed`); flag por OS no `localStorage`; `pgpVoltarParaOS` limpa a flag antes de navegar; boot reexibe.
- **Item 3 — Redesenho da seção de peças (Opção B).** Tabela e todos os IDs/`data-keys` preservados; só classes/elementos auxiliares. Novas `updatePartCompletionStatus`/`collapseCompletedParts`; badge por peça; botão "▴ Recolher peças completas". **Fotos não bloqueiam status/envio.**
- **Item 4 — OS não some ao concluir.** PCF `pfLoadOS` chama `getOS` com `includeClosed='true'` e filtra só `cancelada`; novos chips de status (`Ativas`/`Concluídas`/`Todas`, default `Ativas`). PCM `renderOS` idem (`{ includeClosed:'true' }`) — o dropdown de status já existente passa a filtrar Concluída/Cancelada com dados reais. GAS `_finalizarAtendimentoOS_` mantém carimbo **incondicional** de `fim_atendimento` (guard `idxAtv` preservado) e adiciona transição `aberta → em_andamento` via `normalizeOsStatus_` quando ainda há tarefa pendente.
- **Item 5 — Otimizar envio da preventiva.** PCF: `pgpPostJson('savePreventiva')`, botão desabilita + "Enviando…" + feedback de envio lento. GAS: `PECAS_LOG` gravado **em lote** (`setValues`) em vez de `appendRow` por peça; `MACHINE_PARTS` lido **uma vez** por envio no cache global `__savePreventivaMpData` e reaproveitado nos 3 helpers de referência/atualização. *Parcial:* as **mutações** de `MACHINE_PARTS` seguem por helper/linha (não consolidadas) para não arriscar upsert/ordem de colunas.
- **Item 6 — Esconder botões no modo preventiva.** Funil único `pgpAtualizarAcoesPorTipoVisita` esconde `#btnDone`, a linha de `#btnEnviarGSMain`, `#pgpGsStatusMain` (para **qualquer** preventiva) e os `_hora_wrap` (só quando `_PGP_OS_ID` presente). Chamado em 5 pontos (`pgpSetTipoVisita`, boot, pós-carga de preventiva de OS, re-render de máquinas). Preventiva avulsa continua enviando pelo `pgpPrevActionsWrap` — sem regressão.

**Notas de auditoria (não-bloqueantes) → ver §3:** (a) reset do cache global `__savePreventivaMpData` não está em `finally`; (b) fraseado do Item 6 no changelog do sprint é mais estreito que o código (os 3 botões escondem em toda preventiva, não só na vinculada a OS — comportamento correto, doc impreciso); (c) escrita consolidada de `MACHINE_PARTS` (Item 5.2) permanece parcial.

### v55 (GAS) + v57 (PCM) — 04/07/2026
Correções do Teste de Usabilidade de OS (relatório v54). Todos confirmados por execução no harness Node (A 30/30 · B 9/9 · C verdes) + auditoria estática.
- **B1 (P0)** `deleteOS`: soft-delete (`Ativo=NÃO`) por `id_os`, roteado no `doPost`; botão "Excluir OS" (admin) no PCM chamando `syncToGS('deleteOS')` + `renderOS()`.
- **B2 (P1)** `saveMachine`: os dois branches de UPDATE agora montam 22 colunas (incluíam 21, faltava `Regime_JSON`) — editar máquina existente deixou de lançar exceção de dimensão.
- **B3 (P1)** `autoCompletarTarefa` + `_finalizarAtendimentoOS_`: guard `idxAtv` para pular linhas `ARQUIVADO`/`NÃO` (mesma classe do fix v53, que deixou essas duas de fora). OS volta a fechar após troca de pipeline.
- **B4 (P2)** `ensureMachineFromVisit`: `Regime_JSON` gravado também no caminho de INSERT (antes só no UPDATE).
- **B5 (P2)** `_marcarMaquinaAtendidaOS_`: cria vínculo `OS_MAQUINAS` (via `_upsertOsMaquina_`, idempotente) quando a máquina nasce no campo sem vínculo prévio, depois marca `atendida`. Cobre o caso 3 (cadastro pelo PCF inspeção).
- **B6 (P3)** `savePreventiva`: resolve `OS_Numero` a partir do `os_id` (via `_resolveNumeroOsById_`). GAS-only; PCF **não** foi alterado (fix vale para todo PCF já em campo).
- **B7 (P3)** `saveOS`: validação de fechamento compara o Tipo_ID `'PREVENTIVA'` normalizado, não o label `'Preventiva'`.

### v54 (GAS) — anterior
- `getMaquinasByOS` passou a usar `getSheetData('MAQUINAS')` (com precedência de linha ativa) em vez de `getSheetDataActive`, resolvendo "Máquina não encontrada" para máquina vinculada e depois soft-deletada; flag `inativa` para badge opcional (badge no PCM deferido).

### v53 (GAS) — anterior
- Guard `idxAtv` em `updateTarefaStatus`, `designarUsuarioTarefa`, `registrarAbertura`, `ajustarTempoEfetivoTarefa` (linhas arquivadas com `Tarefa_ID` reutilizado).

### v51/v36 — anterior
- Fluxo de preventiva: `pgpBuildPreventivaPayload` deixou de sobrescrever `tipo`; aliases `type/power` ↔ `tipo/potencia`; coluna `Regime_JSON` em `MAQUINAS`; upsert real em `MACHINE_PARTS`; `os_id` no payload para auto-fechar tarefa da OS.

---

## 3. Bugs conhecidos / pendências abertas

| ID | Descrição | Prioridade | Status |
|----|-----------|-----------|--------|
| v37-a | Reset de `__savePreventivaMpData = null` (fim de `savePreventiva`) **não está em `finally`**. Se `savePreventiva` lançar entre o set (leitura do MACHINE_PARTS) e o reset, o cache global fica não-nulo pelo resto da execução. Blast radius contido (1 ação por request, isolate novo por request no GAS), então **não é bug funcional** — só hardening: mover reset para `finally`. | Micro | Aberto (hardening) |
| v37-b | `MACHINE_PARTS` — escrita consolidada (Item 5.2) **parcial**: leitura única + `PECAS_LOG` em lote feitos, mas mutações de `MACHINE_PARTS` seguem por helper/linha. Seguro pelo invariante "1 máquina + `partId` único por envio" (nenhuma linha é relida após ser escrita no mesmo envio — ver §7). Consolidar só se houver ganho medido. | Baixa | Aberto (opcional) |
| v37-c | Fraseado do Item 6 (changelog do sprint) diz "em preventiva vinculada à OS", mas o código esconde `#btnDone`/`#btnEnviarGSMain`/`#pgpGsStatusMain` em **toda** preventiva; só os `_hora_wrap` são gated por `_PGP_OS_ID`. Comportamento é correto (botões de inspeção não pertencem ao modo preventiva); é só imprecisão de doc. | Doc | Fechado (esclarecido) |
| — | `id_cliente` fica vazio na linha `OS_MAQUINAS` criada pelo B5 (máquina de campo). Não quebra nada; máquina carrega o cliente. Preencher se algo ler `id_cliente` do vínculo. | Micro | Aberto (opcional) |
| — | Badge de máquina inativa no PCM (flag `inativa` já existe no backend desde v54) | Baixa | Deferido |
| — | `softDelete('ORDENS_SERVICO')` legado ainda é no-op ("Não encontrado") — não usado, substituído por `deleteOS`. Remover ou consertar se um dia for chamado. | Baixa | Aberto (não-urgente) |

Nenhum bug **bloqueante** aberto no fluxo de OS/preventiva.

---

## 4. Decisões travadas  *(NÃO alterar sem instrução explícita do Fernando)*

- **Multi-usuário por email no ProperHub** (tela de seleção + `loginTecnicoHub`): **implementado e confirmado**. Não reabrir.
- **B5 (vínculo de máquina de campo):** decisão de **implementar** confirmada — o técnico pode cadastrar máquina nova em campo (caso 3), e ela deve aparecer na OS. Feito no v55.
- **B6 (OS_Numero):** correção é **GAS-only**. PCF permanece intocado. Não versionar o PCF só por isso.
- **`getNotificacoes`** (item de auditoria de roteamento): **verificado OK** — chamado por GET nos dois frontends e presente no `doGet`. Não mexer.
- **Deploy do GAS:** sempre **"Nova versão" da implantação existente**, nunca implantação nova (a URL `/exec` muda e quebra PCM/PCF).

---

## 5. Backlog pendente  *(status verificado contra v55/v57/v36; segue válido em v56/v58/v37 — o Sprint v37 foi cirúrgico e não tocou nenhum item deste backlog)*

**Já implementado — fora do pendente:** delete/inativação de OS (v55/B1), multiusuário, `data_prevista` nas tarefas, `getNotificacoes` (roteamento OK), priorização de OS (existe como `prioridade`), delete de tipos de OS (`deleteTipoOS`).

### A. Reorganização do sidebar do PCM  *(100% pendente — nada existe no v57)*
- Três grupos: **Painel de Gestão** (Preventivas, OSs, Máquinas) · **Cadastral** (OS, Clientes, Máquinas) · **Configurações**.
- **Gestão de OSs** com Kanban (por tipo de OS) + Calendário de agendamento, em **abas formato Ribbon**.
- **Gant de saturação** → mover para Configurações (já existe no PCM; é informação gerencial, não compartilhada com funcionários).
- **Cadastro de usuários** → Configurações.
- **`viewAberturaOS`**: abertura de OS no Cadastral com autocomplete de cliente + botão **+** (cliente novo na hora).
- **Validação do pipeline** (preventivas de campo + oficina — desenvolvido, não validado).
- 🔴 **Decisões pendentes do Fernando:**
  - Gestão de Máquinas é redundante com Gestão de Preventivas? (máquinas no PCM hoje serve para controlar manutenções)
  - Máquinas fica como item separado no Cadastral ou **dentro de Clientes**?

### B. ProperFlow (pipeline)
- **`perfil_responsavel`** — *parcial:* campo/badge existe (GAS+PCM), mas falta a camada de **designação por OS** (`OS_DESIGNACOES`, hoje inexistente) + restrição de quem pode concluir a tarefa em `updateTarefaStatus` (com bypass admin e default permissivo quando em branco). Decidir se completa. Escopo dividido em 4 sessões: A (GAS/schema), B (editor de template + UI de designações no PCM), C (operações do card de pipeline no PCM), D (card readonly no PCF).
- **Aba de Log operacional no PCM** — backend pronto (`getLogOperacional`), falta a UI que consome (hoje é stub).

### C. Gestão de OSs / documentos
- **PDF de OS no PCM** — inexistente (`buildOsPdfLayout`/`getForm08ByOS` = 0). Via `window.print()` com layout oculto, mesmo padrão da Ficha de Rotores (jsPDF é só para preventiva no PCF).
- **Delete/inativação de templates na UI** — *metade:* tipos de OS já dá; falta `deleteTemplate` (limpeza de templates de teste só direto no Sheets hoje).

### D. PCF (campo)
- **Catálogo de peças custom `CAT_PECAS_CUSTOM`** — escopo **marca+modelo** (decidido). Inexistente em GAS e PCF; prompt do GAS escrito mas não aplicado. Aba nova (`id`, `nome`, `intervalo_padrao`, escopo, `Created_At/By`, `Ativo`); botão "+ Peça" no painel da máquina; da 2ª visita em diante aparece como sugestão.
- **Ajuste do logo no PDF** — parcial.
- **PDFs individuais por máquina + botão para consolidar** (BL-09).
- **Limpeza de legado:** aliases `getTecnicos`/`loginTecnico`/`saveTecnico`, `APP_VERSION` desatualizado, inconsistência de chave em `getUsuarios`.

### E. Google Drive
- **Organização estruturada por OS/Cliente/Máquina** (fotos + PDFs) + migração do `ProperCare_Fotos`. Hoje só o pipeline de fotos do Form08 existe. Estrutura de pastas, convenção de nomes e migração ainda a definir.

### F. Forms  *(bloqueados até Form 08 estabilizar)*
- **Form 09** — Peritagem Mecânica (mesma arquitetura do Form 08; pasta `Form09/` no Drive, `salvarFotoForm09`).
- **Form 10** — Peritagem Elétrica.

> **Nota de consolidação:** o "calendário visual do PCM" é o mesmo calendário de agendamento do item A (desenho fechado: grade mensal vanilla, posicionada por `data_prevista`, cor por tipo/status, clique abre o detalhe da OS, sem lib externa). Registrado uma vez só, dentro de A.

---

## 6. Como aplicar o v56/v58/v37 (checklist de deploy)

> ⚠️ **Este sprint mexeu no PCF** — diferente do v55 (GAS-only). São **três** publicações, não duas.

1. Colar o conteúdo de `GAS_properCare_v56.js` no editor do Apps Script (substitui o código atual). Salvar.
2. **Deploy → Gerenciar implantações → editar a implantação existente → Nova versão → Implantar.** (Mantém a URL `/exec`.) **Não** há função a rodar manualmente / migração — **nenhuma coluna/aba/Property nova** (verificado no diff v55→v56: só lógica em `savePreventiva`/helpers/`_finalizarAtendimentoOS_`).
3. Publicar `PCM_v58.html` no GitHub Pages (repo ProperAdmin/PCM).
4. Publicar `PCF_index_v37.html` no GitHub Pages (repo ProperTech/PCF). **Não esquecer** — sem isto, Itens 1–3/5/6 não chegam ao campo.
5. Teste rápido OS: abrir uma OS → iniciar preventiva a partir dela → confirmar que **horas** entram sozinhas, que o card **"Voltar para a OS"** persiste, e que a OS **não some** ao concluir (chip `Concluídas`/`Todas`).
6. Teste rápido admin: botão **Excluir OS** (B1) ainda some da lista; dropdown de status na listagem de OS filtra Concluída/Cancelada.

---

## 7. Regras invariantes de arquitetura  *(referência estável)*

- **Roteamento é o failure mode nº 1:** toda ação nova de escrita vai no `doPost`, leitura no `doGet`. Verificar o switch real sempre.
- **Linhas arquivadas:** `instanciarPipeline` arquiva reaproveitando `Tarefa_ID`; qualquer função que casa por `OS_ID+Tarefa_ID` precisa do guard `idxAtv` (`ARQUIVADO`/`NÃO`).
- **Soft-delete vs. active-only:** `getSheetDataActive()` exclui `Ativo=NÃO`; para entidade que pode ser soft-deletada após referência, usar `getSheetData()` com precedência de linha ativa.
- **Retrocompatibilidade:** nunca remover chaves legadas (`type/power` ↔ `tipo/potencia`); só adicionar aliases.
- **Preventiva isola payload:** `pgpBuildPreventivaPayload` reconstrói do zero — todo campo novo do builder base precisa ser replicado nele.
- **Fechamento ProperFlow:** carimbar `fim_atendimento` sempre na preventiva; mudar status para `concluida` só quando todas as tarefas do pipeline estiverem completas.
- **Cache read-once de `MACHINE_PARTS` (`__savePreventivaMpData`, v56):** a leitura única + escritas write-through por linha só é segura porque **um `savePreventiva` = uma máquina + `partId` único por peça** — nenhuma linha é relida depois de escrita no mesmo envio, então o cache nunca fica stale para uma leitura subsequente. Se algum dia `savePreventiva` processar múltiplas máquinas ou `partId` repetido no mesmo envio, este invariante quebra e o cache precisa ser invalidado/reescrito por mutação. Sempre resetar o cache (idealmente em `finally`).
- **Versionamento:** nunca sobrescrever arquivo de entrada; `node --check` obrigatório; changelog no topo (`//` no GAS, `<!-- -->` no HTML); diffs unificados antes de entregar.
- **UI:** texto usa "usuário", não "técnico"; campos internos de sessão (`.tecnico.nome`) preservados.

---

## 8. Protocolo de atualização deste arquivo  *(para Codex / Claude Code)*

Ao final de qualquer trabalho de codagem, o agente deve atualizar este arquivo:
- **§1 Versões atuais:** sobrescrever com as novas versões.
- **§2 Changelog:** acrescentar UMA entrada no topo (data, versão, resumo). Nunca reescrever entradas antigas.
- **§3 Bugs conhecidos:** marcar itens tocados como **"aplicado (pendente auditoria)"** — só o Claude, após rodar o harness, promove para **"confirmado"**.
- **§4 Decisões travadas:** **não alterar** sem instrução explícita.
- Não inventar conteúdo para outras seções; preservar o que já existe.
