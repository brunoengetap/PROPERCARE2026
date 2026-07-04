# ESTADO_ATUAL — ProperHub / ProperCare

> **Fonte canônica de verdade do sistema.** O nome deste arquivo **nunca muda**, mesmo com o churn de versões.
> No início de cada sessão, suba este arquivo para o Claude sincronizar tudo em um anexo.
> Repositório: `brunoengetap/PROPERCARE2026` (raiz).

**Última atualização:** 04/07/2026 · **Por:** auditoria pós-Codex v55/v57 + backlog recuperado e verificado

---

## 1. Versões atuais  *(seção sobrescrita a cada sprint — sempre reflete o que está no repo)*

| Componente | Arquivo | Status |
|-----------|---------|--------|
| Backend GAS | `GAS_properCare_v55.js` | ✅ auditado — pronto para deploy |
| PCM (admin) | `PCM_v57.html` | ✅ auditado — pronto para publicar |
| PCF (campo) | `PCF_index_v36.html` | estável (não alterado no v55) |
| ProperHub (portal SSO) | `ProperHub_index_v13.html` | estável |

**Pendência de deploy:** GAS v55 ainda **não implantado**; PCM v57 ainda **não publicado** no GitHub Pages. Ver §6.

---

## 2. Changelog  *(seção APENDÁVEL — nunca reescrever entradas antigas; só adicionar no topo)*

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

## 5. Backlog pendente  *(status verificado contra v55/v57/v36 em 04/07/2026)*

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

## 6. Como aplicar o v55/v57 (checklist de deploy)

1. Colar o conteúdo de `GAS_properCare_v55.js` no editor do Apps Script (substitui o código atual). Salvar.
2. **Deploy → Gerenciar implantações → editar a implantação existente → Nova versão → Implantar.** (Mantém a URL `/exec`.) **Não** há função a rodar manualmente / migração — nenhuma coluna/aba/Property nova.
3. Publicar `PCM_v57.html` no GitHub Pages (repo ProperAdmin/PCM).
4. Teste rápido: abrir uma OS → botão **Excluir OS** → confirmar que some da lista.

---

## 7. Regras invariantes de arquitetura  *(referência estável)*

- **Roteamento é o failure mode nº 1:** toda ação nova de escrita vai no `doPost`, leitura no `doGet`. Verificar o switch real sempre.
- **Linhas arquivadas:** `instanciarPipeline` arquiva reaproveitando `Tarefa_ID`; qualquer função que casa por `OS_ID+Tarefa_ID` precisa do guard `idxAtv` (`ARQUIVADO`/`NÃO`).
- **Soft-delete vs. active-only:** `getSheetDataActive()` exclui `Ativo=NÃO`; para entidade que pode ser soft-deletada após referência, usar `getSheetData()` com precedência de linha ativa.
- **Retrocompatibilidade:** nunca remover chaves legadas (`type/power` ↔ `tipo/potencia`); só adicionar aliases.
- **Preventiva isola payload:** `pgpBuildPreventivaPayload` reconstrói do zero — todo campo novo do builder base precisa ser replicado nele.
- **Fechamento ProperFlow:** carimbar `fim_atendimento` sempre na preventiva; mudar status para `concluida` só quando todas as tarefas do pipeline estiverem completas.
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
