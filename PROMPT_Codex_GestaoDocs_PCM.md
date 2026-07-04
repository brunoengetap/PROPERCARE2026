# PROMPT — Codex — Aba "Gestão de Documentos" no PCM (display)

> **Ordem de aplicação:** roda **DEPOIS** do prompt do Claude Code (que cria as colunas novas e a persistência de PDF). A aba **funciona mesmo antes** — linhas antigas só aparecem sem pasta/máquina (tratar `undefined` como `—`).
> **Arquivo de entrada:** `PCM_v58.html` (raiz do repo `brunoengetap/PROPERCARE2026`).
> **Saída:** `PCM_v59.html`. **Nunca sobrescrever o arquivo de entrada.**
> **Escopo:** **só front-end no PCM.** NÃO tocar em GAS, NÃO tocar no PCF. NÃO criar função de escrita.

---

## 0. Objetivo

Adicionar uma aba **"Gestão de Documentos"** no PCM que lista, filtra e agrupa todos os anexos
(fotos de preventiva, fotos de Form 08, fotos de rotor, PDFs de relatório/formulário, assinaturas) já
indexados na aba `TECH_ATTACHMENTS`, com botões que abrem a **pasta** e o **arquivo** direto no Google Drive
(o Drive nativo cuida de baixar/excluir/renomear — não replicar isso no PCM).

Referência visual: a aba "Fotos / Drive" do ColectTap (colunas TAG/OS/QTD FOTOS/PASTA DRIVE/PRIMEIRA FOTO,
com botões "Abrir" e "Ver"). Aqui é uma versão mais rica: agrupável por OS, Cliente ou Máquina.

---

## 1. Invariantes (não violar)

1. **Só display.** Leitura via `gsGet` (GET). Nenhuma chamada `syncToGS`/escrita.
2. **Versionamento:** incrementar filename (`PCM_v59.html`); changelog no topo em **comentário HTML** (`<!-- -->`), nunca `//`.
3. **Padrões existentes do PCM:** seguir exatamente o modelo de view/nav já usado (ver §3). Não inventar sistema de rotas novo.
4. **Defensivo:** todo campo lido do backend pode vir `undefined` (linhas antigas). Renderizar como `—`.

---

## 2. Contrato do backend (já existe — NÃO alterar)

- Chamar: `gsGet('getAttachments', {})` (helper na linha **2381** do PCM; GET; sem params = todas as linhas ativas).
- Resposta: `{ status:'ok', attachments:[ ... ] }`.
- Cada item (nomes de coluna **exatos**, case-sensitive):
  ```
  Attachment_ID, Entity_Type, Entity_ID, OS_Numero,
  File_ID, File_URL, File_Name, Mime, Attachment_Type, Caption,
  Created_At, Created_By, Ativo,
  Cliente, Maquina_ID, Maquina_Label, Folder_ID, Folder_URL, Categoria
  ```
- `File_URL` → link direto do arquivo no Drive (botão "Ver").
- `Folder_URL` → link da pasta no Drive (botão "Abrir pasta").
- `Categoria` (domínio fechado): `foto_preventiva | foto_form08 | foto_rotor | pdf_preventiva | pdf_relatorio | pdf_formulario | assinatura | outro`.

---

## 3. Pontos de integração no PCM (linhas reais do v58)

O sistema de views funciona assim (não mudar o mecanismo, só estender):

1. **Nav item** — botão `<button class="nav-item" data-view="X" onclick="showView('X')" id="nav{Suffix}">` dentro de um `.nav-group`. Grupo **OPERAÇÃO** vai da linha **691 à 720**.
2. **Container de view** — `<div id="view{Suffix}" style="display:none"></div>` na área de conteúdo. Exemplos: `viewEstoque` (860), `viewOs` (864), `viewPerfis` (868).
3. **`showView(v)`** (linha **2990**):
   - array `allViews` (linha **2992**) — **incluir `'docs'`**.
   - o sufixo do id é `v.charAt(0).toUpperCase()+v.slice(1)` → para `'docs'` vira **`Docs`** → procura `viewDocs`/`navDocs`. **Não** precisa de entrada em `VIEW_ID_OVERRIDES` (linha 2997).
   - o dispatch `if/else` (linhas **3010–3043**) — **adicionar** `} else if(v==='docs'){ renderDocs(); }`.
4. **Helpers de estilo** já disponíveis: `statusBadge` (2389) e as classes `badge-*`, `.nav-item`, `.nav-icon`. Reusar a linguagem visual existente (mesma paleta/tipografia — não introduzir CSS destoante).

---

## 4. O que criar

### 4.1 Nav item (dentro do grupo OPERAÇÃO, após "Estoque" na linha 719)
```html
<button class="nav-item" data-view="docs" onclick="showView('docs')" id="navDocs">
  <svg class="nav-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
    <path d="M3 2h6l4 4v8a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1z"/>
    <path d="M9 2v4h4"/>
  </svg>
  <span>Gestão de Documentos</span>
</button>
```

### 4.2 Container de view (junto dos outros `view*`, ex.: após `viewOs` linha 864)
```html
<div id="viewDocs" style="display:none"></div>
```

### 4.3 Estado + `renderDocs()`
Uma variável de módulo para cache e estado de UI:
```js
let _docsCache = [];            // último getAttachments
let _docsGroupBy = 'os';        // 'os' | 'cliente' | 'maquina'
let _docsCat = 'todas';         // categoria selecionada
let _docsQuery = '';            // busca genérica
```

`async function renderDocs()`:
1. Desenhar o cabeçalho da view **imediatamente** (título, busca, chips, toggle de agrupamento) e um placeholder "Carregando…" na área de lista — não bloquear a UI.
2. `const r = await gsGet('getAttachments', {});` → `_docsCache = (r && r.attachments) ? r.attachments : [];`
3. Chamar `renderDocsList()` (função que aplica filtro/busca/agrupamento sobre `_docsCache` e pinta a tabela). Toda re-renderização por busca/chip/toggle chama só `renderDocsList()` (sem novo fetch), a menos que o usuário clique em "Atualizar".
4. Tratar erro de rede com uma mensagem discreta + botão "Tentar novamente" (reusar o padrão de toast/erro já existente no PCM se houver; senão, um texto simples).

### 4.4 Controles (topo da view)
- **Busca genérica** (`<input>` com `oninput`): filtra case-insensitive em `Cliente`, `OS_Numero`, `Maquina_Label`, `Maquina_ID`, `File_Name`, `Caption`. É o requisito do Fernando de "buscar sem conhecer o número da OS".
- **Chips de categoria**: `Todas` + uma por valor de `Categoria` presente no cache. Selecionar filtra.
- **Toggle de agrupamento**: `Por OS` (default) · `Por Cliente` · `Por Máquina`.
- **Botão "Atualizar"**: refaz o `gsGet` (re-fetch).
- Um contador: "N arquivos · M grupos".

### 4.5 `renderDocsList()` — lógica de exibição
1. Partir de `_docsCache`, aplicar filtro de categoria (`_docsCat`) e busca (`_docsQuery`).
2. Agrupar conforme `_docsGroupBy`:
   - `os` → chave = `OS_Numero || '_SEM_OS'`; rótulo do grupo mostra `OS {numero}` + `Cliente` quando houver.
   - `cliente` → chave = `Cliente || '—'`.
   - `maquina` → chave = `Maquina_Label || Maquina_ID || '—'`.
3. Para cada grupo, um bloco recolhível (`<details>`/`<summary>` ou o padrão de acordeão já usado no PCM) com cabeçalho: rótulo do grupo · **QTD** de arquivos · botão **"Abrir pasta"** (usa o `Folder_URL` do 1º item do grupo que tiver um) · miniatura da **1ª foto** do grupo (1º item cujo `Mime` começa com `image/`) — clicável, abre `File_URL`.
4. Dentro do grupo, uma **tabela** com colunas:
   `Categoria` (badge) · `Máquina` (`Maquina_Label`) · `Arquivo` (`File_Name`) · `Data` (`Created_At` formatada pt-BR) · `Por` (`Created_By`) · **Ações**.
   - Ação **"Ver"** → `window.open(File_URL, '_blank', 'noopener')` (desabilitar/ocultar se sem `File_URL`).
   - Ação **"Abrir pasta"** → `window.open(Folder_URL, '_blank', 'noopener')` (idem).
5. Ordenar grupos por atividade mais recente (maior `Created_At` do grupo primeiro); dentro do grupo, itens por `Created_At` desc.
6. Badge de categoria: mapear cada `Categoria` para um rótulo curto legível (ex.: `pdf_preventiva`→"PDF Preventiva", `foto_form08`→"Foto Form 08") e uma cor suave. Reusar as classes `badge-*` existentes quando fizer sentido; se criar classes novas, prefixar `docs-` e manter na mesma paleta.

### 4.6 Vazio / carregando
- Cache vazio após filtro → estado vazio amigável ("Nenhum documento encontrado para este filtro.").
- Enquanto o `gsGet` não voltou → placeholder de carregando (não travar).

---

## 5. Não fazer (fora de escopo deste sprint)

- Nenhum botão de **baixar/excluir/renomear** no PCM (o Drive nativo faz, via "Abrir pasta"/"Ver").
- Nenhum **upload** de documento pelo PCM (uploads vêm do campo/PCF e da geração de PDF — já tratados no prompt do Claude Code).
- Não mexer em GAS nem no PCF.
- Não introduzir biblioteca externa nova (vanilla JS, como o resto do PCM).

---

## 6. Critérios de aceite

1. A aba "Gestão de Documentos" aparece no sidebar (grupo OPERAÇÃO) e alterna corretamente via `showView('docs')` (some/aparece junto com as outras; `navDocs` recebe `.active`).
2. Lista os itens de `getAttachments({})`, agrupados por OS por padrão, com QTD, "Abrir pasta", 1ª foto e tabela de itens.
3. Busca genérica encontra por cliente, número de OS, máquina e nome de arquivo. Chips de categoria filtram. Toggle troca o agrupamento **sem** novo fetch.
4. "Ver" abre o arquivo no Drive; "Abrir pasta" abre a pasta no Drive (nova aba, `noopener`).
5. Linhas antigas (sem `Cliente`/`Folder_URL`/`Maquina_Label`) não quebram — aparecem com `—` e sem botão de pasta quando faltar `Folder_URL`.
6. Nenhuma chamada de escrita; nenhum erro de console; `<script>` balanceados.

---

## 7. Entregáveis

- `PCM_v59.html` com changelog no topo (comentário HTML) descrevendo: nova view `docs`, `renderDocs`/`renderDocsList`, inclusão de `'docs'` em `allViews` + branch no `showView`, nav item e container.
- Diff unificado v58→v59.
- Atualizar `ESTADO_ATUAL.md` (§8 do próprio arquivo): §1 versões (PCM v59) e **uma** entrada nova no topo do §2 changelog. Marcar o item §5-E como "aplicado (pendente auditoria)". Não alterar §4.
