# PROMPT CODEX — PCF v46 — Reformulação da Seção de Peças

## Objetivo

Gerar uma nova versão `PCF_index_v46.html` a partir de `PCF_index_v45.html`, reformulando **somente a seção de peças da preventiva do PCF**.

Esta alteração deve melhorar a usabilidade no celular, deixando sempre visíveis os campos realmente necessários para o técnico completar cada peça, e recolhendo apenas informações complementares.

---

## Arquivo de trabalho

Trabalhe apenas no arquivo:

```text
PCF_index_v45.html
```

Entregue como:

```text
PCF_index_v46.html
```

Não alterar:

```text
GAS_properCare_*.js
PCM_*.html
ProperHub_index_*.html
ESTADO_ATUAL.md
```

O `ESTADO_ATUAL.md` pode ser atualizado posteriormente em outro commit, se necessário. Para esta tarefa, a alteração funcional é apenas no PCF.

---

## Escopo obrigatório

Alteração cirúrgica apenas na seção de peças da preventiva do PCF.

Não alterar:

- GAS.
- Endpoints.
- Contratos de payload.
- Nomes de `data-key` persistidos.
- IDs já usados por funções existentes.
- Lógica de OS.
- Pipeline.
- Sheets.
- Drive.
- PDF.
- Autosave fora do necessário para a seção de peças.
- Estrutura de `photoStore`.
- Limite de fotos.
- Upload de fotos.

---

## Contexto do problema

Na seção de peças, a experiência atual está ruim porque informações essenciais ficam escondidas dentro da expansão da peça.

Hoje, ao expandir uma peça, aparecem juntos:

- Referência / código.
- Fotos.
- Ação da peça.
- Observação.
- Cálculo de horas rodadas, horas restantes e percentual.

Isso não é o ideal.

O técnico precisa ver e preencher rapidamente:

- Horímetro / valor mostrado.
- Intervalo.
- N/A.
- Referência.
- Fotos.
- Ação da peça.

Apenas **observação** e **informações calculadas de horas/percentual** podem ficar recolhidas.

Além disso, o botão **“Recolher peças completas”** não está funcionando como esperado. Ele deve esconder de fato os blocos completos, mas sem apagar dados e sem atrapalhar a edição posterior.

---

## Objetivo de layout

Cada peça deve ter dois níveis visuais.

---

# NÍVEL 1 — SEMPRE VISÍVEL

No estado normal de cada peça, devem ficar visíveis:

## 1. Linha principal da peça

Manter a linha principal da tabela com:

- Nome da peça.
- Valor mostrado / horímetro.
- Intervalo.
- Botão N/A.
- Seta para direita/baixo.

## 2. Linha de Referência / Código

A referência/código da peça deve ficar visível sem precisar clicar na seta.

## 3. Foto do horímetro

A linha/área de foto do horímetro deve ficar visível sem precisar clicar na seta.

## 4. Foto da peça

A linha/área de foto da peça deve ficar visível sem precisar clicar na seta.

## 5. Ação desta peça

A linha **“Ação desta peça”** deve ficar visível sem precisar clicar na seta, com os botões:

- Conferida.
- Trocada.
- N/A.

---

# NÍVEL 2 — RECOLHIDO POR PADRÃO

Só deve aparecer quando o usuário clicar na seta da peça:

## 1. Campo Observação

Campo de observação da peça.

Exemplo de placeholder atual:

```text
Ex: etiqueta ilegível, horímetro zerado pelo cliente...
```

## 2. Linha de cálculo

Linha com informações como:

- Horas rodadas.
- Horas restantes.
- Percentual do intervalo.

Exemplo atual:

```text
Rodadas: 150 h | Restam: 850 h | 15% do intervalo (1000 h)
```

---

## Regra principal da seta

A seta deve controlar somente:

- Observação.
- Cálculo de horas/percentual.

A seta **não deve esconder**:

- Referência.
- Foto horímetro.
- Foto da peça.
- Ação desta peça.

Exceção: quando o botão **“Recolher peças completas”** estiver ativo, peças completas podem ficar recolhidas, conforme regra específica abaixo.

---

## Áreas/funções que provavelmente precisam ser ajustadas

Audite e ajuste, se necessário:

- `buildPartsTable`
- `togglePartDetail`
- `updatePartCompletionStatus`
- `collapseCompletedParts`
- Funções auxiliares que renderizam/atualizam miniaturas de fotos.
- Funções chamadas ao adicionar/remover fotos.
- Funções chamadas ao alterar valor mostrado, intervalo, N/A ou ação.

Não renomear funções públicas existentes.

---

## Preservações obrigatórias de IDs e contratos

Manter os IDs atuais dos campos de ação:

```js
`${pk}_acao`
`${pk}_acao_conferida`
`${pk}_acao_trocada`
`${pk}_acao_na`
```

Manter os IDs e `data-key` atuais relacionados a:

- Valor mostrado.
- Intervalo.
- Contador.
- N/A.
- Referência.
- Troca.
- Ação.

Preservar a compatibilidade com os cenários:

- A
- B
- C
- D
- E

Não quebrar dados já salvos em rascunho, autosave ou preventiva anterior.

---

## Reformulação estrutural desejada

Dentro da renderização da tabela de peças:

## Linha principal

A linha principal da peça continua sendo a linha atual da tabela.

Ela deve mostrar:

- Nome da peça.
- Horímetro / valor mostrado, quando aplicável.
- Intervalo, quando aplicável.
- N/A.
- Seta.

## `pt-quick-row`

A `pt-quick-row` deve passar a ser o bloco sempre visível da peça.

Dentro da `pt-quick-row` / `pt-quick-box`, colocar:

1. Referência / Código.
2. Foto horímetro.
3. Foto da peça.
4. Ação desta peça.

Caso hoje a ação esteja dentro da `pt-detail-row`, mover a ação para a `pt-quick-row`, mantendo IDs, handlers e função `pgpSetAcao`.

## `pt-detail-row`

A `pt-detail-row` deve ficar reservada apenas para:

1. Observação.
2. Cálculo de horas rodadas / horas restantes / percentual.

---

## Comportamento da peça fechada

Quando a peça estiver fechada:

- Linha principal visível.
- Referência visível.
- Foto horímetro visível.
- Foto da peça visível.
- Ação visível.
- Observação oculta.
- Cálculo oculto.
- Seta apontando para a direita.

---

## Comportamento da peça aberta

Quando a peça estiver aberta:

- Linha principal continua visível.
- Referência continua visível.
- Foto horímetro continua visível.
- Foto da peça continua visível.
- Ação continua visível.
- Observação aparece.
- Cálculo aparece.
- Seta aponta para baixo.

---

## Comportamento do botão N/A principal da peça

Ao marcar a peça como N/A na linha principal:

- Pode ocultar ou desabilitar os campos complementares da peça.
- Deve marcar visualmente como N/A.
- Deve preservar o comportamento existente de persistência.

Ao desmarcar N/A:

- A peça volta ao estado normal.
- Referência, fotos e ação voltam a ficar visíveis.
- Observação e cálculo continuam obedecendo à seta.

---

# Novo critério de peça completa

Uma peça **não N/A** só pode ser considerada **Completa** quando todos os critérios abaixo forem satisfeitos.

---

## 1. Foto do horímetro

Deve existir pelo menos 1 foto na chave:

```js
`hori_${pt.k}`
```

---

## 2. Foto da peça

Deve existir pelo menos 1 foto na chave definida por:

```js
PART_PHOTO_MAP[pt.k]
```

---

## 3. Horas / valor mostrado preenchido

Quando o cenário da peça exigir campo de valor mostrado / horímetro, o campo deve estar preenchido.

Observação:

- Valor zero só deve ser aceito se a lógica atual já aceitar zero e se fizer sentido no cenário.
- Não criar regra nova que quebre cenários legítimos com valor zero.

---

## 4. Intervalo preenchido

Quando houver campo de intervalo:

- Aceitar intervalo digitado pelo técnico.
- Aceitar valor padrão aplicado automaticamente, quando existir padrão válido.
- Não considerar completo se o campo estiver vazio e sem padrão válido.

---

## 5. Ação preenchida

O campo:

```js
`${pk}_acao`
```

deve conter uma das opções:

```text
conferida
trocada
na
```

---

## Importante sobre referência/código

A referência/código deve continuar visível e útil, mas **não deve ser suficiente para marcar uma peça como completa**.

Não considerar uma peça completa apenas porque a referência está preenchida.

---

# Status visual da peça

Atualizar status visual da peça conforme as regras:

## Completa

Quando todos os critérios de completude forem satisfeitos, mostrar badge:

```text
Completa
```

## Semi completa

Quando ainda faltar algum item, manter ou exibir badge:

```text
Semi completa
```

ou status equivalente já usado no PCF.

## N/A

Quando o botão principal N/A da peça estiver ativo, mostrar status N/A.

---

## Eventos que devem atualizar o status imediatamente

O status visual da peça deve atualizar quando o usuário:

- Digitar ou alterar valor mostrado.
- Alterar intervalo.
- Marcar N/A.
- Desmarcar N/A.
- Selecionar ação.
- Trocar ação.
- Adicionar foto do horímetro.
- Remover foto do horímetro.
- Adicionar foto da peça.
- Remover foto da peça.

Se hoje a atualização de status não é chamada após alteração de fotos, corrigir isso sem mexer na estrutura de `photoStore`.

---

# Botão “Recolher peças completas”

Corrigir o funcionamento do botão.

## Comportamento esperado ao clicar em “Recolher peças completas”

Para peças completas:

- Esconder a `pt-quick-row`.
- Esconder a `pt-detail-row`.
- Deixar visível apenas a linha principal da peça.
- Manter badge/status **Completa** visível.
- Não apagar dados.
- Não apagar fotos.
- Não apagar ação.
- Não apagar referência.
- Não apagar observação.
- Não apagar valores de horímetro/intervalo.

Para peças incompletas:

- Manter a `pt-quick-row` visível.
- Manter referência, fotos e ação visíveis.
- Não esconder campos que o técnico ainda precisa preencher.

Para peças N/A:

- Pode tratar como recolhida ou N/A, desde que:
  - fique visualmente claro;
  - não atrapalhe o preenchimento das demais peças;
  - não apague dados.

---

## Comportamento ao clicar na seta de uma peça completa recolhida

Se uma peça completa foi recolhida pelo botão:

- Ao clicar na seta daquela peça:
  - Reabrir a `pt-quick-row`.
  - Abrir também a `pt-detail-row`.
  - Permitir edição normal daquela peça.
- Não religar automaticamente todas as peças completas.
- A abertura deve ser por peça.

---

## Estado/texto do botão

O botão pode alternar texto/estado, por exemplo:

```text
Recolher peças completas
Mostrar peças completas
```

Isso é opcional, mas se for implementado deve ser claro e funcional.

---

# Responsividade e CSS

Manter uso confortável em celular.

Não causar sobreposição entre:

- Nome da peça.
- Valor mostrado.
- Intervalo.
- N/A.
- Seta.

Não aumentar demais a largura da tabela.

Se necessário, ajustar CSS apenas dentro da seção de peças, usando seletores como:

```css
.pt-table
.pt-quick-row
.pt-quick-box
.pt-detail-row
.pt-detail-box
.pt-photo-cols
.pt-photo-col
.btn-pt-detail
.btn-pt-na
```

Também pode criar classes específicas para:

- Linha de ação da peça.
- Estado recolhido por completude.
- Quick row oculta por completude.

Não aplicar CSS genérico que afete outras seções do app.

---

# Cuidados importantes

Não recriar a seção inteira com outro modelo de dados.

Não trocar nomes de funções públicas.

Não quebrar:

- Autosave.
- Restore draft.
- Edição de preventiva.
- Coleta com múltiplas máquinas.
- Cenários sem horímetro.
- Cenários sem intervalo.
- Peças com intervalo padrão.
- Upload de fotos.
- Miniaturas.
- Persistência de fotos.
- Geração de PDF.
- Envio ao Sheets.
- Salvamento da preventiva.

---

# Changelog obrigatório

Adicionar changelog curto no topo do arquivo `PCF_index_v46.html`:

```html
<!-- v46: Reformulação da seção de peças — referência/fotos/ação sempre visíveis; observação/cálculo recolhidos; botão Recolher peças completas corrigido com critério real de completude. -->
```

Não remover changelogs anteriores.

---

# Validação obrigatória

Depois de alterar, faça validações básicas.

## 1. HTML

Validar que o HTML não ficou quebrado.

## 2. JavaScript

Extrair os blocos `<script>` e rodar `node --check`, se possível.

## 3. IDs

Verificar que não foram criados IDs duplicados indevidos.

## 4. `buildPartsTable`

Verificar que `buildPartsTable` não gera HTML quebrado.

## 5. `pgpSetAcao`

Verificar que `pgpSetAcao` ainda encontra os mesmos IDs:

```js
`${pk}_acao`
`${pk}_acao_conferida`
`${pk}_acao_trocada`
`${pk}_acao_na`
```

## 6. Fotos

Verificar que fotos continuam usando as mesmas chaves:

```js
`hori_${pt.k}`
PART_PHOTO_MAP[pt.k]
```

## 7. Botão Recolher

Verificar pelo código que o botão **Recolher peças completas** realmente altera a visibilidade de peças completas.

## 8. Layout esperado

Verificar manualmente pelo código que:

- Referência fica sempre visível.
- Foto horímetro fica sempre visível.
- Foto da peça fica sempre visível.
- Ação fica sempre visível.
- Observação fica recolhida.
- Cálculo fica recolhido.
- A seta abre apenas observação + cálculo, salvo quando estiver reabrindo peça completa recolhida.

---

# Como validar no celular

Após publicar/testar:

1. Abrir uma preventiva no PCF.
2. Ir até a seção de peças.
3. Selecionar cenário com contador progressivo identificado.
4. Confirmar que cada peça mostra:
   - linha principal;
   - referência;
   - foto horímetro;
   - foto da peça;
   - ação desta peça.
5. Confirmar que observação e cálculo aparecem somente ao clicar na seta.
6. Preencher uma peça com:
   - valor mostrado;
   - intervalo;
   - 1 foto de horímetro;
   - 1 foto da peça;
   - ação.
7. Confirmar que a peça vira **Completa**.
8. Clicar em **Recolher peças completas**.
9. Confirmar que a peça completa fica só na linha principal.
10. Clicar na seta da peça recolhida.
11. Confirmar que ela reabre para edição.
12. Remover uma foto e confirmar que volta para **Semi completa**.
13. Marcar N/A e confirmar que o estado visual fica coerente.

---

# Entregável final esperado

Entregar:

```text
PCF_index_v46.html
```

E informar:

1. Quais funções foram alteradas.
2. O que mudou no layout.
3. Como a completude da peça passou a ser calculada.
4. Como validar no celular.
5. Resultado das validações feitas.
