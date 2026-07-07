# Sprint v45 — Card de máquina carregada por aba ativa

## Resumo
- Criado `PCF_index_v45.html` a partir do `PCF_index_v44.html`.
- Extraída a renderização do card verde de máquina carregada para o helper `pgpRenderLoadedCard`.
- A troca de aba agora re-renderiza o card com a máquina carregada do índice ativo.
- A ação de nova coleta limpa `_pgpLoadedMachine`, `_pgpLoadedMachinesByIndex` e esconde o card para evitar vazamento visual de dados da OS anterior.

## Validações
- `pgpRenderLoadedCard` aparece nos quatro pontos esperados: definição, carga de máquina, troca de aba e nova coleta.
- A escrita direta de `pgpLoadedInfo.innerHTML` foi centralizada no helper.
- Os blocos de script do HTML passam em `node --check`.
- `_pgpLoadedMachinesByIndex` continua sendo escrito somente por `pgpSetLoadedMachineForIndex`; o novo helper apenas lê o estado por índice.

## Deploy
- Sem alteração de GAS.
- Publicação em GitHub Pages não executada neste ambiente porque não há remoto Git configurado.
