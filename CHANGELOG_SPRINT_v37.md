# CHANGELOG Sprint v37 — PCF/OS/Preventiva

## Versões geradas
- PCF: `PCF_index_v37.html` a partir de `PCF_index_v36.html`.
- PCM: `PCM_v58.html` a partir de `PCM_v57.html`.
- GAS: `GAS_properCare_v56.js` a partir de `GAS_properCare_v55.js`.

## Item 1 — Horas automáticas na preventiva dentro da OS
- `pfAbrirForm` passou a anexar `tarefa_id` e `inicio_preventiva_iso` à URL da preventiva.
- `checkHubSession` passou a ler `tarefa_id` e `inicio_preventiva_iso`.
- Adicionados `pgpIsoToHHMMLocal` e `pgpNowHHMMLocal`.
- `pgpIniciarPreventivaDeOS` grava a hora de início em `m0_hora_inicio` após carregar as máquinas da OS.
- `pgpEnviarPreventiva` grava a hora de fim em `m0_hora_fim` antes de montar o payload.
- O bloco de hora (`data-key="${p}hora_wrap"`) é escondido por `pgpAtualizarAcoesPorTipoVisita` somente em preventiva vinculada a OS.
- Desvios: nenhum intencional; campos continuam no DOM para PDF/resumo/payload.

## Item 2 — Retorno persistente para a OS
- Adicionado `#pgpReturnToOSContainer` acima do CTA de preventiva.
- `pgpMostrarVoltarParaOS` foi reescrita para renderizar card no fluxo e persistir flag por OS no `localStorage`.
- `pgpVoltarParaOS` limpa a flag antes de navegar para `?modo=pipeline&os_id=...`.
- Boot reexibe o card quando a flag persistida existe.
- Desvios: nenhum intencional; removido o banner `position:fixed` antigo.

## Item 3 — Redesenho da seção de peças (Opção B)
- Mantida a tabela e todos os IDs/data-keys existentes; adicionadas somente classes e elementos auxiliares.
- `buildPartsTable` agora adiciona classes de grupo visual, badge por peça, rótulo curto de foto do horímetro e botão `▴ Recolher peças completas`.
- CSS ajusta largura da tabela, colunas N/A/detalhe, botão de foto, agrupamento visual e badges.
- `togglePartDetail` rola a peça para a viewport ao abrir.
- `togglePtNA` recolhe `quick_row` e `detail_row`, atualiza hidden de ação e badge.
- Adicionadas `updatePartCompletionStatus` e `collapseCompletedParts`; status é atualizado em ação, cálculo, referência, restauração e re-render da tabela.
- Desvios: nenhum intencional; fotos não bloqueiam status/envio.

## Item 4 — OS não pode sumir ao concluir
- PCF `pfLoadOS` chama `getOS` com `includeClosed='true'` e só remove `cancelada` da lista.
- PCF ganhou segundo filtro de status (`Ativas`, `Concluídas`, `Todas`) com default `Ativas`.
- PCM `renderOS` chama `getOS` com `{ includeClosed: 'true' }`.
- GAS `_finalizarAtendimentoOS_` preserva o carimbo incondicional de `fim_atendimento` e adiciona transição `aberta -> em_andamento` quando ainda há tarefas pendentes.
- Desvios: nenhum intencional; `getOS` manteve a lógica de filtro por `includeClosed`.

## Item 5 — Otimizar envio da preventiva
- PCF `pgpEnviarPreventiva` usa `pgpPostJson('savePreventiva', payload)`, desabilita o botão e mostra feedback progressivo de envio lento.
- GAS `savePreventiva` acumula linhas de `PECAS_LOG` e grava em lote com `setValues`, preservando ordem/contagem das colunas do append anterior.
- GAS `savePreventiva` lê `MACHINE_PARTS` uma vez por envio e reaproveita cache nas funções existentes de referência/atualização.
- Parcial/pendente: as mutações de `MACHINE_PARTS` ainda reutilizam os helpers existentes e podem fazer escritas por linha/append conforme o caso; não foi feita reescrita completa para uma única escrita consolidada, para reduzir risco de schema.

## Item 6 — Esconder botões no modo preventiva
- Adicionada `pgpAtualizarAcoesPorTipoVisita` como funil único para esconder `#btnDone`, a linha de `#btnEnviarGSMain`, `#pgpGsStatusMain` e os wraps de hora em preventiva vinculada à OS.
- A função é chamada no final de `pgpSetTipoVisita`, após boot inicial, após carregar preventiva de OS e após re-render/criação de máquinas.
- Desvios: nenhum intencional.

## Itens parciais ou pendentes
- Item 5.2 ficou parcial apenas na escrita consolidada de `MACHINE_PARTS`: leitura única e `PECAS_LOG` em lote foram implementados, mas a escrita de `MACHINE_PARTS` permanece por helper/linha para evitar risco de corromper upsert/ordem de colunas.
