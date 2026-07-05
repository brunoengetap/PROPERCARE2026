# ESTADO_ATUAL — ProperHub / ProperCare

> **Fonte canônica de verdade do sistema.** O nome deste arquivo **nunca muda**, mesmo com o churn de versões.
> No início de cada sessão, suba este arquivo para o Claude sincronizar tudo em um anexo.
> Repositório: `brunoengetap/PROPERCARE2026` (raiz).

**Última atualização:** 05/07/2026 · **Por:** +§9 Convenção de "prompt curto" para Claude Code (adicionada). · Último sprint de código: Reorganização do sidebar do PCM — Fase 1 do backlog §5.A · **PCM v61** (GAS v57 e PCF v39 inalterados nesse sprint)

---

## 1. Versões atuais  *(seção sobrescrita a cada sprint — sempre reflete o que está no repo)*

| Componente | Arquivo | Status |
|-----------|---------|--------|
| Backend GAS | `GAS_properCare_v57.js` | ⚠️ auditado (estático + diff linha-a-linha v56→v57 + balanço manual de `{}`/`()`/`[]`) — **`node --check` real não pôde ser executado neste ambiente** (Node/npm ausentes do PATH); rodar antes do deploy. **Não tocado nesta correção** |
| PCM (admin) | `PCM_v61.html` | ✅ auditado — diff unificado v60→v61 revisado linha a linha + **`node --check` real executado nesta sessão** (ambos os blocos `<script>` de v60 e v61 passam) + parser HTML completo (Python `html.parser`, sem exceção — estrutura de comentários íntegra) + conferência de unicidade de todo `id="nav*"`/`id="view*"` (nenhum duplicado/renomeado) + CSS do sidebar conferido sem dependência posicional (`nth-child`). Reorganização do sidebar (Fase 1 do backlog §5.A) aplicada — ver §2. **Ainda não publicado** |
| PCF (campo) | `PCF_index_v39.html` | ⚠️ auditado — estático + diff v38→v39 + balanço manual de `{}`/`()`/`[]` do bloco `<script>` (contagem de chaves/colchetes idêntica à do v38, confirmando realocação pura sem alteração de lógica) — **`node --check` real não pôde ser executado nesta sessão** (Node/npm ausentes do PATH); rodar antes de publicar. **Fix P0 de TDZ de boot aplicado** |
| ProperHub (portal SSO) | `ProperHub_index_v13.html` | estável |

**Pendência de deploy:** GAS v57 ainda **não implantado**; PCF v39 ainda **não publicado**; **PCM v61 ainda não publicado** no GitHub Pages. A aba "Gestão de Documentos" (v59/v60) só é **front-end/leitura** — depende do GAS v57 estar implantado para `getAttachments` devolver as colunas novas (`Cliente/Maquina_Label/Folder_URL/Categoria`) e a própria ação existir; antes disso a aba mostra o **erro real do backend** (Fix 2A), em vez de fingir "nenhum documento". Ver §6.

**PCM v61 (sidebar):** só front-end, realocação de nav/rótulos — nenhuma dependência de GAS para funcionar (Dashboard oculto, boot em Controle de Preventivas, "Gestão de OSs" renomeado, Máquinas/Clientes no Cadastral). Publicável de forma independente do GAS v57/PCF v39.

---

## 2. Changelog  *(seção APENDÁVEL — nunca reescrever entradas antigas; só adicionar no topo)*

### v61 (PCM) — 05/07/2026 — Reorganização do sidebar (Fase 1 do backlog §5.A)
Fase 1 apenas (sidebar); Fases 2 (Ribbon+Kanban+Calendário) e 3 (Abertura de OS) deferidas para `PCM_v62.html` — diff mantido pequeno e auditável (decisão tomada com o Fernando, nota de tamanho do prompt original). Nenhuma ação de backend nova; nenhum `id`/`view`/`render` renomeado — só rótulo visível e realocação de elementos de nav entre grupos. **Nível de auditoria: diff unificado v60→v61 revisado linha a linha + `node --check` real (executado nesta sessão — ambos os blocos `<script>` de v60 e v61 passam, diferente das sessões anteriores em que Node/npm estavam ausentes do PATH) + parser HTML completo (Python `html.parser`, sem exceção) + conferência de unicidade de todo `id="nav*"`/`id="view*"` + CSS do sidebar conferido sem dependência posicional (`nth-child`) que a reorg pudesse quebrar.**
- **Portões de decisão confirmados pelo Fernando antes de codar:** Portão 1 (data do calendário) — `data_prevista` já existe no nível da OS (`_renderOSTable`/`openModalOS`/`saveOSModal`), sem bloqueio; base do Calendário no v62. Portão 2 (semântica do Kanban) — opção **(B)**: colunas por status, badge de tipo + filtro por tipo no card. Portão 3 (Dashboard) — ocultar do nav mantendo o código (reversível); aplicado neste sprint.
- **Sidebar reorganizado em 3 grupos temáticos:** **PAINEL DE GESTÃO** (Controle de Preventivas — nova view de boot —, Gestão de OSs, Estoque, Gestão de Documentos); **CADASTRAL** (Clientes, Máquinas — achado de auditoria: já estavam em OPERAÇÃO, não em CADASTROS como o backlog supunha); **CONFIGURAÇÕES** (Usuários, Perfis, Templates, Tipos de OS, Saturação, Catálogo — posição marcada como provisória, comentário `<!-- POSIÇÃO PENDENTE -->` no ponto do nav). Grupo **SISTEMA** (Configurações de GAS/turno + Sair) mantido separado como rodapé — evita ambiguidade com o grupo temático CONFIGURAÇÕES.
- Dashboard removido do nav (botão comentado, não deletado); `viewDashboard`/`renderDashboard` intactos no código. Boot trocado de `showView('dashboard')` para `showView('preventivas')`; `viewPreventivas` deixou de ter `display:none` estático; breadcrumb e `.is-active` estáticos ajustados para não piscar antes do JS.
- Rótulo "Ordens de Serviço" → **"Gestão de OSs"** no nav e no breadcrumb (`labels.os`); `id`/`view`/`render` (`os`/`viewOs`/`renderOS`) inalterados. O `<h2>` dentro do conteúdo da view (`_renderOSTable`) segue "Ordens de Serviço" nesta versão — atualiza junto com o Ribbon no v62 para não expandir o escopo deste diff.
- **Achados de auditoria relevantes para o v62:** nomes reais de ação divergem do prompt original — é `saveClient`/`getClients`, não `saveCliente`/`getClientes`. Cache em memória da view de OS já existe como `_osList` (populado por um único `getOS({includeClosed:'true'})` em `renderOS()`) — reusar, não recriar um `_osCache` novo. `openOSDetail(osId)` hoje substitui todo o `innerHTML` de `#viewOs`; o Ribbon do v62 precisa desenhar um sub-container dentro de `renderOS()` mantendo esse contrato. Já existe um modal completo de abertura/edição de OS (`openModalOS`/`saveOSModal`) com o contrato real de `saveOS` — a view "Abertura de OS" do v62 deve portar esse modal, não recriar do zero.
- Nenhuma chamada de escrita nova; nenhuma mudança de contrato com o GAS.

### v39 (PCF) + v60 (PCM) — 04/07/2026 — Correção de bugs: OS não carrega (PCF) + Gestão de Documentos (PCM)
Fix TDZ de boot (bloco START movido para o fim) — pipeline voltou a carregar OS. Docs — surfacing de erro do backend em `getAttachments`, realce ativo dos chips de agrupamento (fecha v59-a), remoção do nome interno `TECH_ATTACHMENTS`, transição nos chips. **Nível de auditoria: estática + diff unificado v38→v39/v59→v60 + balanço manual de `{}`/`()`/`[]` dos blocos `<script>` alterados — `node --check` real não pôde ser executado nesta sessão** (Node/npm ausentes do PATH deste ambiente, mesma limitação já registrada nos sprints anteriores); rodar antes de publicar. **GAS não mudou** (v57 segue como estava).
- **PCF-1 (P0, `PCF_index_v39.html`):** o bloco imperativo `// ── START` (linha ~4228) rodava em tempo de parse, mas os `let` de estado do módulo que ele lê (`_pgpTipoVisita` ~L5100, `_pgpGsUrl` ~L5096 etc.) só eram declarados ~865 linhas depois. A chamada `pgpAtualizarAcoesPorTipoVisita()` lia `_pgpTipoVisita` em TDZ → `ReferenceError` não capturado → abortava todo o resto da execução top-level, deixando `_pgpGsUrl` eternamente não inicializado (erro visível no Pipeline: "Erro ao carregar OS: Cannot access '_pgpGsUrl' before initialization"). Fix: bloco de boot (`addMachineData/createPanel/renderTabs/updateProgress/setupBackGuard/checkRestoreDraft/pgpAtualizarAcoesPorTipoVisita/pgpMostrarVoltarParaOS`) movido para o fim do `<script>`, após todas as declarações de estado. Nenhuma outra mudança de lógica.
- **PCM-1 (`PCM_v60.html`, Fix 2A):** `renderDocs` lia `r.attachments` sem checar `r.status` (diferente de `syncToGS`, que já lança em `status!=='ok'`). Resposta de erro do GAS (ex.: `getAttachments` ainda não implantado) era lida como lista vazia → "Nenhum documento encontrado" silencioso. Fix: `if(!r || r.status !== 'ok') throw new Error(...)` antes de ler `attachments`, roteando para o `catch` existente (mensagem do backend + "Tentar novamente").
- **PCM-2 / v59-a (`PCM_v60.html`, Fix 2B):** chips de agrupamento (Por OS/Cliente/Máquina) ganham classe `docs-group-chip` + `data-group`; `renderDocsList()` agora resincroniza `.active` desses chips a cada render (antes só um `renderDocs()` completo atualizava o realce). Fix 2C (polimento): `.docs-chip` ganha `transition` para feedback visual do clique.
- **PCM-3 (`PCM_v60.html`, Fix 2D):** subtítulo do herói não expõe mais o nome interno da planilha `TECH_ATTACHMENTS`.
- Nenhuma chamada de escrita nova; nenhuma mudança de contrato com o GAS.

### v59 (PCM) — 04/07/2026 — Aba "Gestão de Documentos" (front-end)
Consome o índice `TECH_ATTACHMENTS` (fundado no GAS v57) e o expõe numa aba nova do PCM: lista/filtra/agrupa fotos, PDFs e assinaturas, com botões que abrem **arquivo** e **pasta** direto no Drive (download/exclusão/rename ficam a cargo do Drive nativo). **Só front-end/leitura — nenhuma alteração de GAS ou PCF; nenhuma chamada de escrita.** **Nível de auditoria: estática + `node --check` real (rodou nesta sessão — os 2 blocos `<script>` passaram) + diff v58→v59 + verificação de existência de todas as classes/vars CSS e helpers referenciados.**
- Integração pelo mecanismo de views existente (não reinventado): nav item `navDocs` no grupo **OPERAÇÃO** (após "Estoque"); container `viewDocs`; `'docs'` incluído em `allViews`; branch `else if(v==='docs') renderDocs()` no `showView`. Sufixo `Docs` casa com `viewDocs`/`navDocs` — sem entrada em `VIEW_ID_OVERRIDES`. Confirmado que a aba some/aparece e recebe `.active` corretamente.
- `renderDocs(force)`: desenha o cabeçalho na hora + placeholder "Carregando…", faz **um** `gsGet('getAttachments', {})` (GET), guarda em `_docsCache` e chama `renderDocsList()`. Re-render por busca/chip/toggle usa só `renderDocsList()` (sem novo fetch); "Atualizar" re-fetcha (`renderDocs(true)`). Erro de rede mostra mensagem discreta + "Tentar novamente".
- `renderDocsList()`: filtro por categoria + busca genérica (case-insensitive em Cliente/OS/Máquina/arquivo/caption); agrupa por OS (default)/Cliente/Máquina; grupos ordenados por atividade mais recente; cada grupo é um `<details open>` com QTD, "Abrir pasta" (1º `Folder_URL` do grupo), miniatura da 1ª foto (`Mime` image/\*) e tabela (Categoria/Máquina/Arquivo/Data pt-BR/Por/Ações). `window.open(..., 'noopener')`.
- **Defensivo:** helper `_docVal` → `—` para campos `undefined` (linhas antigas); botões "Ver"/"Abrir pasta"/thumb só renderizam quando a URL existe. CSS novo prefixado `docs-` na mesma paleta (vars existentes conferidas uma a uma).
- **Achados de auditoria (não-bloqueantes) → §3:** (a) o realce `.active` dos chips de agrupamento não acompanha o clique (cosmético); (b) a miniatura usa `File_URL` cru — se o backend devolver link de *view* do Drive (não conteúdo direto), a `<img>` pode não carregar (sem `onerror`).

### v57 (GAS) + v38 (PCF) — 04/07/2026 — Sprint Gestão de Documentos (fotos/PDFs)
Centraliza fotos/formulários/PDFs no Drive sob taxonomia única **Cliente › OS › Máquina**, com índice completo em `TECH_ATTACHMENTS` (fundação para a aba "Gestão de Documentos" do PCM, a ser feita pelo Codex em seguida). **Nível de auditoria: estática + diff linha-a-linha v56→v57/v37→v38 + balanço manual de `{}`/`()`/`[]` e de `<script>`/`</script>`** — `node --check` real **não pôde ser executado nesta sessão** (Node/npm ausentes do PATH do ambiente); rodar antes do deploy real. PCM **não foi tocado** neste sprint.
- HEADERS.TECH_ATTACHMENTS (~L562): +6 colunas no final — `Cliente, Maquina_ID, Maquina_Label, Folder_ID, Folder_URL, Categoria` — retrocompatível (linhas antigas ficam com essas colunas vazias).
- Novo helper `_persistirAnexoDrive_(opts)`: fonte única de gravação Drive + índice. Pasta `ROOT/{Cliente}/{OS_Numero||_SEM_OS}/{Máquina||_GERAL}`; resolve `OS_Numero` a partir de `os_id` via `_resolveNumeroOsById_` (reaproveitado, não reinventado); sharing por `DRIVE_LINK_PUBLICO` (padroniza o Form 08, que antes não setava `PRIVATE` explícito); grava a linha do índice **por índice de header** (não mais `appendRow` posicional) — elimina a fragilidade de colunas novas desalinharem gravações antigas.
- `salvarFotosDrivePGP` / `salvarFotoRotoresDrive` / `salvarFotoForm08` refatoradas para usar o helper. Form08 **passa a logar** em `TECH_ATTACHMENTS` (antes não logava nada). Retornos e assinaturas **preservados** (mesmos shapes já consumidos pelos frontends — conferido por grep dos consumidores).
- **Achado de auditoria pré-escrita:** o prompt do sprint instruía o PCF a mandar `os_id` no payload de `salvarFotosDrivePGP`, mas o nome real já usado por essa função no GAS era `id_os` (diferente do resto do sistema, que usa `os_id` em `savePreventiva`/`getPipelineByOS`/etc.). Corrigido de forma aditiva: a função agora aceita **ambos** (`body.id_os || body.os_id`), sem quebrar nada (nenhum caller real enviava `id_os` até hoje).
- Nova ação `salvarPdfDrive` (roteada no **`doPost`**, escrita) — sobe PDF de relatório/formulário via o mesmo helper, mime `application/pdf`, categoria default `pdf_relatorio`.
- PCF `uploadPhotoToDrive` (L1682): troca `osNumero:''` (sempre vazio) por `os_id: window._PGP_OS_ID` + `maquina_id`/`maquina_label` (novas `pgpDriveMaquinaId`/`pgpDriveMaquinaLabel`, reaproveitadas também pelo PDF). Fila/compressão existentes intocadas.
- PCF `gerarPDF`/`gerarPDFConsolidado`: após o `doc.save()` local, capturam `doc.output('datauristring')` e sobem o PDF via novo par `queuePdfDriveUpload`/`uploadPdfToDrive` (espelha `queuePhotoDriveUpload`/`uploadPhotoToDrive`), fila própria `_pendingPdfUploads` reenviada em `pgpFlushPending`. O PDF local continua sendo gerado e salvo mesmo se o upload falhar ou estiver offline.
- Roteamento conferido (failure mode nº1): `salvarPdfDrive` está no `doPost`; `getAttachments` permanece no `doGet`; as 3 funções de foto permanecem no `doPost` (cases já existentes).

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
| v59-a | Aba Docs: os chips **Por OS / Por Cliente / Por Máquina** eram renderizados uma vez em `renderDocs` (toolbar) e o clique chamava só `renderDocsList()`, que não reconstruía a toolbar — o agrupamento trocava corretamente, mas o realce `.active` ficava no chip anterior. Fix aplicado no v60 (Fix 2B): `renderDocsList()` agora faz `toggle('active')` nos 3 chips (`.docs-group-chip`) a cada render. | Cosmético | **Corrigido (v60)** |
| v59-b | Aba Docs: a miniatura do grupo usa `<img src="{File_URL}">` cru, sem `onerror`. Se `getAttachments` devolver `File_URL` como link de **view** do Drive (`/file/d/.../view`) em vez de conteúdo direto, a `<img>` quebra silenciosamente (ícone quebrado). Depende do formato do backend (fora do escopo do v59/v60). Conferir visualmente pós-deploy; hardening barato = `onerror` que esconde a thumb. | Baixa | Aberto (verificar pós-deploy) |
| v60-a | `gsGet` (GET) retorna o JSON cru **sem checar `status`**, diferente de `syncToGS` (que já lança em `status!=='ok'`). O v60 corrigiu isso localmente em `renderDocs` (Fix 2A), mas outros call-sites de leitura que usam `gsGet` diretamente ainda podem ler resposta de erro como dado válido. Considerar unificar a checagem de `status` dentro do próprio `gsGet` num sprint futuro (não feito agora para não alterar comportamento de outros call-sites sem auditoria individual). | Baixa | Aberto (hardening, opcional) |
| v61-a | O comentário HTML de changelog no topo do `PCM_v61.html` contém a sequência `--` dentro do texto (referência a "`node --check`"). Não quebra nada — HTML5 só fecha o comentário em `-->`, confirmado via parser real (`html.parser`) e visualmente — mas é tecnicamente não-conforme (um validador HTML acusaria). Hardening cosmético: evitar `--` dentro de texto de comentário em versões futuras. | Micro | Aberto (cosmético, não-bloqueante) |
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

### A. Reorganização do sidebar do PCM  *(Fase 1 aplicada no v61 — pendente só publicação; Fases 2/3 pendentes para v62)*
- **Fase 1 (sidebar) — aplicada no PCM v61, pendente apenas publicação no GitHub Pages.** Três grupos confirmados e implementados: **Painel de Gestão** (Controle de Preventivas — nova view de boot —, Gestão de OSs, Estoque, Gestão de Documentos) · **Cadastral** (Clientes, Máquinas — Abertura de OS entra aqui no v62) · **Configurações** (Usuários, Perfis, Templates, Tipos de OS, Saturação, Catálogo — posição provisória). Grupo **Sistema** (Configurações de GAS/turno + Sair) mantido separado como rodapé. Dashboard oculto do nav (código intacto, reversível); boot passa a abrir em Controle de Preventivas.
- **Fase 2 (pendente, v62):** **Gestão de OSs** com abas formato **Ribbon** (Lista/Kanban/Calendário), reusando o cache `_osList` já existente (sem refetch por troca de aba). Kanban — decisão confirmada: colunas por **status** (não por tipo de OS, como o backlog original supunha), badge de tipo + filtro por tipo no card. Calendário de agendamento por `data_prevista` (campo confirmado existente no nível da OS — sem bloqueio de GAS).
- **Fase 3 (pendente, v62):** **`viewAberturaOS`** no Cadastral — portar o modal já existente `openModalOS`/`saveOSModal` (contrato real de `saveOS`), com autocomplete de cliente (ação real `getClients`) + botão **+** (cliente novo via `saveClient` — nomes reais confirmados em auditoria; divergem de `getCliente(s)`/`saveCliente` do prompt original).
- **Gant de saturação:** já movido para Configurações no v61.
- **Validação do pipeline** (preventivas de campo + oficina — desenvolvido, não validado) — segue pendente, fora do escopo do sidebar.
- 🟢 **Decisões antes pendentes, agora resolvidas (confirmadas pelo Fernando no sprint v61):**
  - Gestão de Máquinas redundante com Preventivas? → **sim**; Máquinas fica só no Cadastral, com CRUD completo, sem tela operacional própria.
  - Kanban por tipo de OS vs. por status? → **por status**, com badge de tipo + filtro no card.
- 🔴 **Decisão ainda pendente:**
  - Posição final do **Catálogo** (Configurações vs. Cadastral) — marcado como provisório no nav do v61 (`<!-- POSIÇÃO PENDENTE -->`).

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
- **Organização estruturada por OS/Cliente/Máquina** (fotos + PDFs) — **aplicado (pendente auditoria)** no Sprint v57(GAS)/v38(PCF): taxonomia `Cliente › OS › Máquina` via `_persistirAnexoDrive_`, índice `TECH_ATTACHMENTS` com 6 colunas novas, Form08 e PDFs de preventiva/consolidado passam a persistir e logar. **Pendente:** rodar `node --check` real (não executável neste ambiente), harness de execução ponta-a-ponta no GAS/Drive real, e migração do legado `ProperCare_Fotos` (Form08 antigo) — não coberta neste sprint.
- **Consumo no PCM (aba "Gestão de Documentos")** — **aplicado (pendente auditoria)** no PCM v59: front-end/leitura que expõe `TECH_ATTACHMENTS` (busca, chips de categoria, agrupamento por OS/Cliente/Máquina, abrir arquivo/pasta no Drive). Auditoria estática + `node --check` OK; **pendente:** teste visual pós-deploy do GAS v57 (miniatura/`File_URL`, botões de pasta) e os 2 achados cosméticos v59-a/v59-b (§3). Não inclui baixar/excluir/renomear/upload pelo PCM (por design — Drive nativo).

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

---

## 9. Convenção de "prompt curto" para Claude Code  *(gatilho reutilizável — adicionada 05/07/2026)*

> **Gatilho:** quando o Fernando disser **"gera o prompt curto"** (ou "prompt curto", "versão curta pro Claude Code"), o Claude produz um prompt de correção **condensado** a partir da auditoria já feita, seguindo o esqueleto abaixo. O objetivo é entregar algo colável em ~1 página, sem a prosa longa de justificativa — **mas sem largar nenhum invariante**. A auditoria (grep/sed/leitura de função) continua obrigatória **antes** de escrever o prompt; o que encurta é a **saída**, não o rigor.

**O que o prompt curto SEMPRE mantém (não cortar):**
1. **Cabeçalho de escopo (1 linha):** frontend-only ou não; quais arquivos; bump de versão; "não sobrescrever entrada".
2. **Bloco de invariantes condensado (1 bloco):** não renomear IDs/`data-key` (incidente `VIEW_ID_OVERRIDES`); roteamento `doGet`(leitura)/`doPost`(escrita); **não tocar `ESTADO_ATUAL.md`**; **não tocar GAS se o fix é frontend**; `node --check` obrigatório (extrair `<script>` do HTML antes); changelog no topo de cada arquivo.
3. **Por fix:** causa-raiz em 1 frase + **arquivo e âncora exata** (nº de linha/função) + **diff antes/depois** ou instrução exata de edição. Âncoras nunca são omitidas.
4. **Verificação:** os `grep` de conferência + `node --check`.
5. **Entregáveis + deploy (1 linha cada):** arquivos de saída + `CHANGELOG_SPRINT`; se há ou não redeploy de GAS.

**O que o prompt curto CORTA:** a prosa de "por que isto é seguro", tabelas de especificidade CSS, reconstrução do raciocínio de auditoria, exemplos redundantes. Isso tudo fica no meu resumo de auditoria (no chat), não no prompt entregue ao agente.

**Esqueleto (colar e preencher):**
```
# PROMPT CURTO — Claude Code · <n> fix(es) <frontend|GAS|misto> (<Arq v_atual→v_nova>, ...)
Escopo travado. <frontend-only? não tocar GAS> · NÃO tocar ESTADO_ATUAL.md · não sobrescrever entradas
(gerar <arquivos de saída>) · não renomear IDs/data-keys (VIEW_ID_OVERRIDES) · node --check obrigatório
(extrair <script> do HTML) · changelog no topo de cada arquivo.

## FIX i — <título>
Arquivo: <arquivo>, <função/âncora ~linha>. Causa: <1 frase>.
Ação: <diff ANTES/DEPOIS ou instrução exata com âncora>.
Verif: <grep(s)> · node --check OK · <regressão a garantir>.

## Entregáveis
<arquivos de saída> + CHANGELOG_SPRINT_<nome>.md. Deploy: <publicar HTML no GitHub Pages | redeploy GAS: sim/não>.
```

> **Regra de ouro:** se cortar algo tornar o prompt ambíguo para o agente (âncora, ID, invariante), **não corte** — o "curto" é sobre densidade, não sobre omitir o que evita erro. O prompt longo continua sendo a opção default quando o fix é estrutural, cross-layer ou envolve GAS; o curto é para correções cirúrgicas de frontend com causa-raiz já isolada.
