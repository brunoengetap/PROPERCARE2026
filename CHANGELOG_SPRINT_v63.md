# CHANGELOG SPRINT v63 — PCM frontend

Data: 05/07/2026

## Escopo
- Arquivo de entrada preservado: `PCM_v62.html`.
- Arquivo gerado: `PCM_v63.html`.
- Sprint 100% frontend; sem alterações no GAS e sem edição de `ESTADO_ATUAL.md`.

## Mudanças aplicadas
1. **Contraste e marca Proper**
   - `--sidebar-group` ajustado para melhorar legibilidade dos rótulos do sidebar.
   - `--accent` e `--accent-hover` migrados para a paleta laranja Proper.
   - Botões primários passam a usar `--accent` e `--accent-hover`.

2. **Catálogo no Painel de Gestão**
   - Item Catálogo movido de Configurações para Painel de Gestão, após Gestão de Documentos.
   - `id="navCatalog"`, `data-view="catalog"` e `onclick="showView('catalog')"` preservados.

3. **Gestão de OSs com Ribbon**
   - Adicionado shell Ribbon com abas Lista, Kanban e Calendário.
   - Lista reutiliza `_renderOSTable` dentro de `#osRibbonContent`.
   - Kanban e Calendário leem `_osList` e reutilizam `openOSDetail`, `openModalOS` e `toast`.
   - Nenhuma ação nova de escrita/backend foi criada.

## Validação executada
- `node --check /tmp/pcm_v63_main.js` passou para o script principal extraído.
- `node --check /tmp/pcm_v63_extra.js` passou para o script extra extraído.
- `grep -c "id=\"navCatalog\"" PCM_v63.html` retornou `1`.
- `grep -n "POSIÇÃO PENDENTE" PCM_v63.html` não retornou ocorrências.
- Greps de `osRibbonContent`, renderers `gos*` e tokens da marca Proper conferidos.
