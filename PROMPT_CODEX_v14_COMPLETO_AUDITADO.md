# Prompt para Codex — Proper Field v14 auditado e completo

## Contexto e objetivo

Você deve gerar um único arquivo HTML self-contained chamado `Proper_Field_v14.html`, partindo da **estrutura visual da v13 DC** e incorporando **toda a lógica funcional da v12**.

Arquivos de referência no repositório ou anexos:

- `Proper Field v13.dc (1).html` ou arquivo equivalente da v13 DC: fonte principal de HTML/CSS/layout visual.
- `Proper_Field_grupotap_v12.html`: fonte principal da lógica JavaScript funcional.
- `GAS_properCare_v22.js`: contrato de backend Google Apps Script; não precisa ser alterado para esta tarefa, mas os endpoints usados pelo Field precisam continuar compatíveis.
- `PROMPT_CODEX_v14.md`: prompt anterior; use este prompt atual como substituto mais completo.

A meta é que a v14 fique com o visual moderno da v13, mas funcione como a v12. Nenhuma funcionalidade operacional da v12 pode ser perdida.

---

## Diagnóstico auditado

A v13 DC não é funcional em navegador comum porque foi exportada com dependências de framework que não existem no arquivo final:

- `<script src="./support.js"></script>` não deve permanecer.
- `<script src="./properfield-logic.js"></script>` não deve permanecer.
- `<x-dc>`, `<helmet>`, `<script type="text/x-dc" ...>`, `DCLogic`, `data-dc-script` e `data-props` não devem permanecer.
- O JavaScript funcional real está na v12, no último `<script>` inline, não em arquivos externos.

A auditoria também encontrou lacunas no prompt anterior:

1. A v12 tem o script funcional começando no `<script>` inline da linha aproximada 726, não de forma confiável na linha 729. Portanto, não use linha fixa; extraia o último `<script>` inline da v12.
2. A v12 tem os elementos `fotoPickerOverlay`, `globalCameraInput` e `globalGalleryInput`; a v13 não tem esses elementos. Eles precisam ser inseridos na v14.
3. A v13 tem `btnDoneBar` na barra fixa inferior; a v12 não conhece esse ID. Como o script DC da v13 será removido, é necessário adicionar compatibilidade para o botão visível `btnDoneBar` continuar sincronizado com `btnDone` ou, no mínimo, chamar `gerarResumo()` corretamente.
4. O prompt anterior dizia “Cenários A/B/C/D”, mas a v12 tem também o cenário **E**: contador regressivo identificado. A v14 deve preservar A, B, C, D e E.
5. O prompt anterior dizia que a senha é salva em `localStorage`, mas a v12 usa `sessionStorage` com `_AUTH_KEY`. Não altere para `localStorage`.
6. O prompt anterior citava `os_numero` no payload, mas a v12 anexada não possui esse campo. Não invente integração de OS nesta tarefa. Preserve apenas o que existe na v12, salvo se o arquivo-base do repositório já tiver esse campo implementado.
7. A v12 usa também `updateMachineParts`, `saveClient`, `saveMachine` e `getCatalogFull`, além de `saveVisit` e `savePreventiva`. Não reduza a integração GAS apenas a `saveVisit`.

---

## Regras de segurança da alteração

1. Não reescreva a lógica da v12.
2. Não refatore funções da v12.
3. Não altere nomes de funções globais.
4. Não altere chaves de `localStorage`/`sessionStorage`, exceto se houver um motivo explícito e justificado.
5. Não altere `_AUTH_HASH`.
6. Não altere `_DEFAULT_GAS_URL` sem instrução expressa.
7. Não edite `GAS_properCare_v22.js` nesta tarefa, a menos que encontre uma incompatibilidade inequívoca e documente a razão.
8. A v14 final não pode depender de arquivos locais externos. Dependências permitidas: Google Fonts e jsPDF via CDN.
9. O arquivo final deve abrir diretamente no navegador sem `support.js`, sem `properfield-logic.js` e sem framework DC.
10. A saída deve ser um único HTML em UTF-8.

---

## Procedimento obrigatório

### 1. Construir o `<head>` real da v14

Crie um `<head>` HTML normal, sem `x-dc` e sem `helmet`, contendo:

```html
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
<title>ProperCare Field · v14</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;600;700;800&family=Barlow:wght@400;500;600&display=swap" rel="stylesheet">
<script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"></script>
```

Depois disso, copie integralmente o bloco `<style>` da v13 DC.

Não copie:

```html
<script src="./support.js"></script>
<script src="./properfield-logic.js"></script>
```

### 2. Construir o `<body>` real da v14

Use o conteúdo visual do corpo da v13 DC, mas remova os wrappers do framework:

Remover completamente:

```html
<x-dc>
</x-dc>
<helmet>
</helmet>
<script type="text/x-dc" data-dc-script ...>...</script>
```

Mantenha o HTML visual da v13, incluindo:

- login overlay;
- header moderno;
- `catalogLookupPanel`;
- `machineTabs`;
- `restoreBanner`;
- banner PGP;
- cadastro rápido;
- configuração;
- tipo de visita;
- `machineContent`;
- ações ocultas legadas com `btnDone`;
- barra fixa inferior com `btnDoneBar`;
- modal de resumo;
- modal de sessões;
- back guard.

### 3. Corrigir o header da v13

Na `.header-actions` da v13, após o botão de catálogo `btnCatalogLookup` e antes do botão de coletas salvas, inserir os botões que a v13 perdeu:

```html
<button class="btn-sessions-header" onclick="salvarColeta()" title="Salvar coleta">💾</button>
<button class="btn-sessions-header" onclick="novaColeta()" title="Iniciar nova coleta">➕</button>
```

A barra fixa inferior da v13 também deve ser preservada.

### 4. Inserir elementos ausentes de foto

A v13 não tem os elementos globais que o JavaScript da v12 usa para câmera/galeria. Insira antes do script funcional final:

```html
<!-- FOTO PICKER MODAL -->
<div class="foto-picker-overlay" id="fotoPickerOverlay" onclick="fotoPickerClickOutside(event)">
  <div class="foto-picker-box">
    <div class="foto-picker-title">Adicionar foto</div>
    <div class="foto-picker-btns">
      <button class="foto-picker-btn camera" onclick="fotoPickerEscolher('camera')">
        <span class="foto-picker-icon">📷</span>
        Câmera
      </button>
      <button class="foto-picker-btn gallery" onclick="fotoPickerEscolher('galeria')">
        <span class="foto-picker-icon">🖼️</span>
        Galeria
      </button>
    </div>
    <button class="foto-picker-cancel" onclick="fotoPickerFechar()">Cancelar</button>
  </div>
</div>

<input type="file" accept="image/*" capture="environment" id="globalCameraInput" style="display:none">
<input type="file" accept="image/*" id="globalGalleryInput" style="display:none">
```

O CSS dessas classes já existe na v13; não duplique CSS sem necessidade.

### 5. Injetar o JavaScript funcional da v12

Extraia da v12 o último `<script>` inline completo, que contém a lógica funcional, começando em:

```js
// ── ARMAZENAMENTO DE FOTOS (base64 para PDF) ──────────
```

Inclua esse script no final do `<body>` da v14, depois dos elementos HTML necessários.

Não use número de linha fixo. A forma segura é:

- ignorar o `<script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/...">`;
- localizar o último `<script>` sem `src` na v12;
- copiar todo o conteúdo dele até o respectivo `</script>`.

O script copiado deve preservar, entre outros:

- `photoStore`;
- `PARTS`;
- `PHOTOS`;
- `PART_PHOTO_MAP`;
- `HORI_PHOTO_LABELS`;
- `SCENARIOS`, incluindo cenário `E`;
- `machines`;
- `currentMachine`;
- `STORAGE_KEY`;
- `DRAFT_KEY`;
- `_AUTH_KEY`;
- `_AUTH_HASH`;
- `_DEFAULT_GAS_URL`;
- `_pgpGsUrl`;
- `PENDING_KEY`;
- `CATALOG_CACHE_KEY`;
- `LOGO_B64`;
- `LOGO_MIME`;
- todas as funções globais da v12.

Alteração permitida e recomendada: trocar somente a constante visual não funcional `APP_VERSION = 'v9'` para `APP_VERSION = 'v14'`, caso ela permaneça sem uso funcional. Não altere chaves de storage.

### 6. Adicionar shim de compatibilidade da v14

Após o script da v12, adicione um pequeno script extra de compatibilidade para a estrutura visual da v13. Esse script não deve substituir nem reescrever a lógica da v12; deve apenas conectar elementos novos da v13.

Adicionar:

```html
<script>
(function properFieldV14Compat(){
  function syncDoneBar(){
    var btnDone = document.getElementById('btnDone');
    var btnDoneBar = document.getElementById('btnDoneBar');
    if (!btnDone || !btnDoneBar) return;
    btnDoneBar.disabled = !!btnDone.disabled;
  }

  function patchUpdateProgress(){
    if (typeof window.updateProgress !== 'function') return;
    if (window.updateProgress.__v14Patched) return;
    var original = window.updateProgress;
    window.updateProgress = function(){
      var result = original.apply(this, arguments);
      syncDoneBar();
      return result;
    };
    window.updateProgress.__v14Patched = true;
  }

  function patchCheckDone(){
    if (typeof window.checkDone !== 'function') return;
    if (window.checkDone.__v14Patched) return;
    var original = window.checkDone;
    window.checkDone = function(){
      var result = original.apply(this, arguments);
      syncDoneBar();
      return result;
    };
    window.checkDone.__v14Patched = true;
  }

  patchUpdateProgress();
  patchCheckDone();
  syncDoneBar();

  var btnDone = document.getElementById('btnDone');
  if (btnDone && window.MutationObserver) {
    new MutationObserver(syncDoneBar).observe(btnDone, { attributes: true, attributeFilter: ['disabled'] });
  }
})();
</script>
```

Se, depois de análise, `btnDone` nunca for desabilitado na lógica v12, esse shim ainda é seguro e não muda comportamento funcional.

### 7. Atualizar textos visuais de versão

Atualize apenas textos visuais evidentes para v14:

- `<title>ProperCare Field · v14</title>`;
- subtítulo visível do login/header, se existir;
- comentário de versão, se houver.

Não altere payloads, endpoints, storage keys ou lógica de autenticação por causa da versão.

---

## Contrato com o GAS v22

A v14 deve continuar chamando as ações já usadas pela v12 e suportadas pelo `GAS_properCare_v22.js`.

Ações GET/POST que precisam continuar compatíveis:

- `ping`;
- `getClientsForField`;
- `getMachinesByClient`;
- `searchMachine`;
- `getCatalogFull`;
- `getVisitsByMachine`, se usado no fluxo de histórico;
- `saveVisit`;
- `updateMachineParts`;
- `savePreventiva`;
- `saveMachine`;
- `saveClient`.

Não remova chamadas a `updateMachineParts` e `saveClient` após `saveVisit`, pois elas fazem parte da sincronização operacional da v12.

Não invente `loginTecnico`, `validarPIN` ou fluxo de OS nesta v14 se esses fluxos não existirem na v12 HTML usada como fonte. Esta tarefa é restaurar a funcionalidade da v12 no visual da v13, não criar nova arquitetura.

---

## Funcionalidades obrigatórias a preservar

### Login

- `loginEntrar()` deve validar a senha por SHA-256 contra `_AUTH_HASH`.
- `_AUTH_HASH` deve continuar igual.
- A sessão deve continuar usando `sessionStorage` com `_AUTH_KEY`, como na v12.
- Senha esperada: `123456`.

### Header e progresso

- `progressPill`, `progressBar` e `machineCounter` devem atualizar normalmente.
- `gsPill`, `gsDotPgp` e `gsTextPgp` devem refletir status do GAS.
- `pgpPendingBadge` deve mostrar fila offline pendente.
- Botões do header: catálogo, salvar coleta, nova coleta e coletas salvas.
- Barra fixa inferior da v13 deve continuar funcional: resumo, salvar, PDF e limpar.

### Múltiplas máquinas

- `addMachine()`;
- `switchMachine(idx)`;
- `renderTabs()`;
- botão `+ Máquina`;
- cópia de dados de cliente/regime quando aplicável;
- nova coleta via `novaColeta()`.

### Banco PGP

- autocomplete de clientes via `pgpClientSearch()` e `pgpEnsureClientsCache()`;
- seleção de máquinas por cliente via `getMachinesByClient`;
- fallback por série/TAG via `searchMachine`;
- cadastro rápido via `pgpRegisterNew()` e `saveMachine`;
- card verde de máquina carregada;
- limpeza da máquina carregada;
- recentes de cliente.

### Tipo de visita

- toggle inspeção/preventiva via `pgpSetTipoVisita()`;
- preventiva deve mostrar ações por peça;
- `pgpEnviarPreventiva()` deve continuar exigindo ação em todas as peças aplicáveis e referência nas peças trocadas.

### Checklist, regime e campos

- seções colapsáveis;
- checkbox/expansão de itens;
- campos com `data-key` funcionando;
- turnos com início/fim;
- dias padrão e personalizados;
- cálculo de horas por semana/ano;
- destaque visual de campos vindos de visitas anteriores, se implementado na v12.

### Cenários de peças

Preservar todos os cenários da v12:

- A — só horímetro total analógico;
- B — total + plano adesivado;
- C — display por peça sem saber sentido;
- D — contador progressivo identificado;
- E — contador regressivo identificado.

Preservar:

- `selectScenario()`;
- `buildPartsTable()`;
- `togglePartDetail()`;
- `togglePtNA()`;
- `calcPartRow()`;
- `pgpSetAcao()`;
- cálculo de `valorMostrado`, `contador`, `lastChange`, `horasRodadas`, `horasRestantes` e `status`;
- preservação do valor `0` como dado válido.

### Fotos

- `abrirFotoPicker()`;
- `fotoPickerEscolher()`;
- `fotoPickerFechar()`;
- `fotoPickerClickOutside()`;
- `globalCameraInput` e `globalGalleryInput`;
- `handlePhotoCapture()`;
- `capturePhotoLinked()`;
- `storePhotoBase64()`;
- compressão de imagem em canvas para JPEG;
- fotos no PDF.

### Consulta de catálogo

- `pgpToggleCatalogPanel()`;
- `pgpRenderCatalogLookup()`;
- cache `proper_catalog_cache_v1`;
- chamada `getCatalogFull`;
- busca por referência, nome da peça e modelo conforme lógica v12.

### Resumo, envio e offline

- `gerarResumo()`;
- modal com abas WhatsApp, Campos PGP e Enviar ao Sheets;
- `copiarTexto()`;
- `abrirWhatsApp()`;
- `pgpEnviarGS()`;
- `pgpBuildPayload()`;
- `pgpBuildVisitRequest()`;
- `pgpBuildPartsUpdateRequest()`;
- `pgpPostJson()`;
- fila offline `pgp_pending_sync`;
- `pgpFlushPending()`;
- limite de fila offline;
- reenvio de `saveVisit`, `updateMachineParts`, `saveMachine`, `saveClient` e `savePreventiva` conforme lógica v12.

### Sessões e rascunho

- `salvarColeta()`;
- `saveCurrentSession()`;
- autosave;
- `abrirSessoes()`;
- `renderSessoesList()`;
- `restaurarSessao()`;
- `deletarSessao()`;
- `salvarSessaoManual()`;
- `restoreDraft()`;
- `discardDraft()`;
- `checkRestoreDraft()`.

### PDF

- `gerarPDF()`;
- `LOGO_B64` e `LOGO_MIME`;
- `limparTextoPDF()`;
- fotos armazenadas em `photoStore`;
- dados de cliente, máquina, checklist, peças e observações.

### Proteção de saída

- `setupBackGuard()`;
- `temDadosPreenchidos()`;
- `guardarFicar()`;
- `guardarSair()`;
- `beforeunload` e `popstate` conforme v12.

---

## Itens proibidos no HTML final

O arquivo `Proper_Field_v14.html` não pode conter nenhuma destas strings:

```txt
support.js
properfield-logic.js
<x-dc
</x-dc>
<helmet
</helmet>
text/x-dc
DCLogic
data-dc-script
data-props
```

Também não deve conter referências a arquivos locais `.js` ou `.css` próprios.

---

## Validação obrigatória antes de finalizar

Faça uma verificação estática e uma verificação manual/funcional.

### Verificação estática

1. Confirmar que o HTML final tem apenas um `<!DOCTYPE html>`, um `<html>`, um `<head>` e um `<body>`.
2. Confirmar que não existem strings proibidas listadas acima.
3. Confirmar que existem estes IDs no HTML final:

```txt
loginOverlay
loginInput
loginError
progressPill
progressBar
machineCounter
gsPill
gsDotPgp
gsTextPgp
pgpPendingBadge
btnCatalogLookup
catalogLookupPanel
catalogLookupInput
catalogLookupResults
machineTabs
restoreBanner
restoreBannerInfo
pgpStep1
pgpClientInput
pgpClientAcList
pgpClientSearching
pgpStep2
pgpStep2Client
pgpMachineList
pgpStepFallback
pgpSearchInput
pgpAcList
pgpLastClientsWrap
pgpFound
pgpNotFound
pgpLoadedCard
pgpLoadedInfo
pgpNewMachine
nm_client
nm_brand
nm_model
nm_serial
nm_tag
nm_location
nm_year
nm_hpw
pgpClientSimilarAlert
cfgOverlay
cfgUrlInput
cfgTestResult
pgpTipoVisitaWrap
btnTipoInspecao
btnTipoPreventiva
pgpTipoHint
machineContent
btnDone
btnDoneBar
pgpPrevActionsWrap
modalOverlay
modalTitle
paneWhats
panePGP
paneEnviar
summaryBox
copiedHint
pgpFieldsContent
pgpSendStatus
btnEnviarGS
pgpGsStatus
pgpGsStatusText
modalFooterWhats
modalFooterPGP
sessionsOverlay
sessionsBody
backGuard
fotoPickerOverlay
globalCameraInput
globalGalleryInput
```

4. Confirmar que existem estas funções no JS final:

```txt
loginEntrar
addMachine
switchMachine
renderTabs
pgpClientSearch
pgpEnsureClientsCache
pgpSelectClientMachine
pgpDoSerialSearch
pgpRegisterNew
pgpSetTipoVisita
pgpEnviarPreventiva
selectScenario
buildPartsTable
calcPartRow
togglePtNA
abrirFotoPicker
fotoPickerEscolher
handlePhotoCapture
storePhotoBase64
pgpToggleCatalogPanel
pgpRenderCatalogLookup
gerarResumo
switchTab
copiarTexto
abrirWhatsApp
pgpEnviarGS
pgpFlushPending
salvarColeta
novaColeta
abrirSessoes
restaurarSessao
gerarPDF
setupBackGuard
abrirConfig
salvarConfig
```

5. Confirmar que `SCENARIOS` contém `id:'E'` ou equivalente.
6. Confirmar que `_AUTH_HASH` está presente.
7. Confirmar que `_DEFAULT_GAS_URL` está presente.
8. Confirmar que não há erro de sintaxe JS aparente.

### Verificação funcional mínima no navegador

1. Abrir `Proper_Field_v14.html`.
2. Console deve abrir sem `ReferenceError` inicial.
3. Login com `123456` deve ocultar a tela de login.
4. O botão 🔍 abre/fecha o painel de catálogo.
5. O botão 💾 salva coleta.
6. O botão ➕ inicia nova coleta.
7. O botão 📂 abre coletas salvas.
8. O botão `+ Máquina` cria nova aba.
9. Campos expandem e marcam check corretamente.
10. Tipo preventiva mostra ações por peça.
11. Cenários A, B, C, D e E renderizam a tabela de peças.
12. Botão de foto abre o modal câmera/galeria.
13. Resumo abre modal.
14. PDF é gerado.
15. Se o GAS estiver configurado e acessível, `ping` deve deixar o indicador verde.

---

## Saída esperada

Gerar e entregar:

```txt
Proper_Field_v14.html
```

Opcionalmente, se o fluxo do repositório exigir, criar também:

```txt
CHANGELOG_v14.md
```

No changelog, registrar de forma objetiva:

- v14 criada a partir do visual v13 DC;
- remoção de dependências DC externas;
- incorporação integral da lógica v12;
- adição dos elementos de foto ausentes;
- adição dos botões de salvar/nova coleta no header;
- shim de compatibilidade para `btnDoneBar`;
- preservação dos cenários A-E;
- nenhuma alteração intencional no GAS.
