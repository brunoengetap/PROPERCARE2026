# Sprint cirúrgico — PCF/OS/Preventiva (v37 · AUDITADO)

> **Origem:** prompt gerado pelo ChatGPT (`PROMPT_SPRINT_PCF_OS_PREVENTIVA_v37.md`),
> auditado linha a linha contra o código real (`PCF_index_v36.html`,
> `PCM_v57.html`, `GAS_properCare_v55.js`) antes de ir ao Codex.
> As correções desta versão estão marcadas com **⚠ AUDIT** onde diferem do prompt original.

## Arquivos de entrada / saída

| Entrada | Saída |
|---------|-------|
| `PCF_index_v36.html` | `PCF_index_v37.html` |
| `PCM_v57.html` | `PCM_v58.html` |
| `GAS_properCare_v55.js` | `GAS_properCare_v56.js` |

## Regras invariantes (NÃO violar — copiadas do ESTADO_ATUAL §7)

1. **Roteamento é o failure mode nº 1.** Ação de escrita nova → `doPost`; leitura → `doGet`. Verificar o switch real.
2. **`fim_atendimento` é SEMPRE carimbado na preventiva.** ⚠ AUDIT — o prompt original (seção 4) pedia para carimbar `fim_atendimento` **só** quando a OS inteira concluir. Isso **contradiz a regra travada** e o comportamento atual de `_finalizarAtendimentoOS_` (que carimba incondicionalmente na linha do `setValue(now)`). **NÃO alterar esse carimbo.** A única mudança permitida em `_finalizarAtendimentoOS_` é **adicionar** a transição `aberta → em_andamento` (ver seção 4).
3. **Linhas arquivadas:** qualquer função que casa por `OS_ID+Tarefa_ID` precisa do guard `idxAtv` (`ARQUIVADO`/`NÃO`). O código de `_finalizarAtendimentoOS_` já tem esse guard — preservá-lo.
4. **Retrocompatibilidade:** nunca remover chaves legadas nem `id`/`data-key` existentes. Só adicionar aliases.
5. **`pgpBuildPreventivaPayload` reconstrói o payload a partir de `pgpBuildPayload(idx)`** — todo campo novo do builder base já se propaga; não duplicar lógica.
6. **Versionamento:** nunca sobrescrever arquivo de entrada; changelog no topo (`//` no GAS, `<!-- -->` no HTML); `node --check GAS_properCare_v56.js` obrigatório antes de entregar; um diff unificado por arquivo; mudança de escopo único.
7. **Deploy do GAS é sempre "Nova versão" da implantação existente** (a URL `/exec` não pode mudar). Não é responsabilidade do Codex, mas nenhuma mudança pode exigir nova implantação nem coluna/aba/Property nova sem sinalizar explicitamente.
8. **Não tocar em nada fora do escopo destes 6 itens.** Os arquivos são grandes (PCM ~516 KB). Alterações mínimas e localizadas.

---

# 1. PCF — hora de início/fim automática na preventiva dentro da OS

## Problema
No modo preventiva-dentro-de-OS existem os campos manuais **Hora Início** e **Hora Fim**
(`data-key="${p}hora_inicio"` / `${p}hora_fim"`, no bloco `.row2` da seção "Dados da Preventiva",
por volta da linha 2597 de `PCF_index_v36.html`). O técnico não deveria preenchê-los.

## Comportamento desejado
- **Hora Início** = momento em que o técnico abre a preventiva a partir da tarefa do pipeline.
- **Hora Fim** = momento em que ele registra/envia a preventiva.
- No modo `?modo=preventiva&os_id=...`, o bloco `.row2` com hora início/fim **não aparece**.
- Preventiva avulsa (sem `os_id`): comportamento **inalterado** (campos manuais continuam visíveis).

## ⚠ AUDIT — abordagem correta: gravar no próprio campo, não só no payload
O prompt original mandava sobrescrever `horaInicio/horaFim` **apenas dentro do payload**.
Isso quebra a consistência: o **PDF** (linha ~4471, `g('hora_inicio')`) e o resumo leem os
**campos do DOM**, não o payload — logo o PDF sairia com hora vazia enquanto `VISITAS` teria a hora.
**Faça assim:** grave a hora capturada **no próprio input** `hora_inicio`/`hora_fim` e apenas
**esconda visualmente** o bloco. Todos os consumidores (payload, PDF, resumo) passam a ler o mesmo valor.

### 1.1 `pfAbrirForm(tarefaId, formUrl)` (linha ~7485) — capturar início e propagar na URL
`pfAbrirForm` faz `window.location.href = urlComOs` (reload completo). Então o timestamp
precisa viajar pela URL. Ajustar o trecho final:

```js
var inicioPreventivaISO = new Date().toISOString();
// ⚠ AUDIT: NÃO depender do retorno de registrarAbertura. Hoje ele NÃO devolve
// data_abertura e ainda tem uma chave "status" duplicada no objeto de retorno
// (o 2º status sobrescreve o 1º), então o valor do servidor é inconfiável.
// Usar sempre o ISO local.
var separador = formUrl.indexOf('?') >= 0 ? '&' : '?';
var urlComOs = formUrl + separador + 'os_id=' + encodeURIComponent(_pfOsId)
  + '&tarefa_id=' + encodeURIComponent(tarefaId)
  + '&inicio_preventiva_iso=' + encodeURIComponent(inicioPreventivaISO);
window.location.href = urlComOs;
```

### 1.2 `checkHubSession` (parse da URL, linha ~1514) — ler os novos params
Ao lado de `window._PGP_OS_ID = urlParams.get('os_id') || null;`, adicionar:

```js
window._PGP_TAREFA_ID = urlParams.get('tarefa_id') || null;
window._PGP_PREVENTIVA_INICIO_ISO = urlParams.get('inicio_preventiva_iso') || null;
```

### 1.3 Helpers (perto de `pgpSetTipoVisita`)
```js
function pgpIsoToHHMMLocal(iso){
  if(!iso) return '';
  var d = new Date(iso);
  if(isNaN(d.getTime())) return '';
  return String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0');
}
function pgpNowHHMMLocal(){
  var d = new Date();
  return String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0');
}
```

### 1.4 Gravar início nos campos ao entrar no modo preventiva-de-OS
Em `pgpIniciarPreventivaDeOS(...)` (chamada no boot quando há `os_id`), após montar as máquinas,
preencher o `hora_inicio` de **m0** (é de onde `gv()` lê) se ainda estiver vazio:

```js
if(window._PGP_OS_ID){
  var hi = pgpIsoToHHMMLocal(window._PGP_PREVENTIVA_INICIO_ISO) || pgpNowHHMMLocal();
  var elHi = document.querySelector('[data-key="m0_hora_inicio"]');
  if(elHi && !elHi.value) elHi.value = hi;
}
```

### 1.5 Gravar fim no envio
No **início** de `pgpEnviarPreventiva(...)` (antes de montar o payload), carimbar `hora_fim`:

```js
if(window._PGP_OS_ID){
  var elHf = document.querySelector('[data-key="m0_hora_fim"]');
  if(elHf) elHf.value = pgpNowHHMMLocal();
}
```
Assim `VISITAS.Hora_Fim` recebe o horário real do registro, e o payload (que já lê `gv('hora_fim')`, linha ~6825) fica coerente com o PDF.

### 1.6 Esconder o bloco visual (sem torná-lo obrigatório invisível)
⚠ AUDIT — o `.row2` de hora **não tem id**. Dar a ele uma âncora estável no template
(por volta da linha 2597), sem mexer nos `data-key` dos inputs:

```html
<div class="row2" data-key="${p}hora_wrap" style="margin-top:6px">
```
E dentro de `pgpAtualizarAcoesPorTipoVisita()` (ver seção 6), esconder todos esses wraps quando preventiva-de-OS:

```js
var esconderHora = (_pgpTipoVisita === 'preventiva' && !!window._PGP_OS_ID);
document.querySelectorAll('[data-key$="_hora_wrap"]').forEach(function(el){
  el.style.display = esconderHora ? 'none' : '';
});
```
Não marcar os inputs como `required`. Eles já estarão preenchidos automaticamente.

---

# 2. PCF — retorno persistente para a OS (fim do banner flutuante)

## Problema
`pgpMostrarVoltarParaOS()` (linha ~6624) cria um `<div>` com `position:fixed; bottom:76px`.
É um banner flutuante que some se a tela rolar/fechar e pode encobrir conteúdo.

## Comportamento desejado
Após registrar a preventiva vinculada a OS, mostrar um **card no fluxo da página**
(não `position:fixed` como único meio de retorno), que **permanece até o técnico clicar**,
sobrevive a rolagem/edição, e leva a `?modo=pipeline&os_id=<OS_ID>` (a função `pgpVoltarParaOS()`
já monta essa URL — reaproveitar).

## Implementação
### 2.1 Container fixo no DOM
Logo **acima** do bloco `#pgpPrevActionsWrap` (o CTA "Registrar Preventiva", linha ~1211), adicionar:
```html
<div id="pgpReturnToOSContainer" style="display:none"></div>
```

### 2.2 Nova função (substitui o corpo de `pgpMostrarVoltarParaOS`)
Reescrever `pgpMostrarVoltarParaOS()` para renderizar dentro do container, com persistência via `localStorage`:
```js
function pgpMostrarVoltarParaOS(){
  if(!window._PGP_OS_ID) return;
  var wrap = document.getElementById('pgpReturnToOSContainer');
  if(!wrap) return;
  wrap.innerHTML =
    '<div class="pgp-return-os-card">' +
      '<div class="pgp-return-os-txt">' +
        '<strong>✅ Preventiva registrada</strong>' +
        '<small>Você pode revisar/editar. Ao terminar, volte para a OS.</small>' +
      '</div>' +
      '<button type="button" onclick="pgpVoltarParaOS()">🔧 Voltar para OS</button>' +
    '</div>';
  wrap.style.display = 'block';
  try { localStorage.setItem('proper_pcf_return_os_' + window._PGP_OS_ID, '1'); } catch(e){}
}
```
⚠ AUDIT — **remover o `document.body.appendChild` e o `position:fixed`** do código antigo.
Manter o `if(!window._PGP_OS_ID) return;` inicial.

### 2.3 Reexibir no boot (se o técnico voltou a editar)
No boot do PCF (após montar a UI da preventiva):
```js
if(window._PGP_OS_ID &&
   (function(){ try { return localStorage.getItem('proper_pcf_return_os_'+window._PGP_OS_ID)==='1'; } catch(e){ return false; } })()){
  pgpMostrarVoltarParaOS();
}
```

### 2.4 Limpar a flag ao voltar
No início de `pgpVoltarParaOS()`:
```js
try { localStorage.removeItem('proper_pcf_return_os_' + window._PGP_OS_ID); } catch(e){}
```

### 2.5 CSS
```css
.pgp-return-os-card{
  display:flex; align-items:center; justify-content:space-between; gap:12px;
  margin:10px 12px; padding:14px; border-radius:12px;
  background:var(--gray); border-left:5px solid var(--green);
  box-shadow:0 2px 8px rgba(0,0,0,.15);
}
.pgp-return-os-txt strong{ display:block; font-size:14px; color:var(--text); }
.pgp-return-os-txt small{ display:block; font-size:11px; color:var(--text-light); margin-top:2px; }
.pgp-return-os-card button{
  flex-shrink:0; background:var(--green); color:#fff; border:none; border-radius:10px;
  padding:12px 16px; font-weight:800; font-size:14px; min-height:var(--touch-min); cursor:pointer;
}
```
⚠ AUDIT — o comportamento atual de `pgpEnviarPreventiva` (linha ~6593: `if(window._PGP_OS_ID){ pgpMostrarVoltarParaOS(); } else { pgpSetTipoVisita('inspecao'); }`) **fica igual**; só muda o corpo da função chamada. Não regressar essa ramificação.

---

# 3. PCF — redesenho da seção de peças  (⚠ AUDIT: **usar SOMENTE a Opção B**)

## ⚠ AUDIT — Opção A (trocar tabela por cards `<div>`) está PROIBIDA neste sprint
O prompt original oferecia "Opção A — refatorar para cards, eliminando a `<table>`".
**Não fazer.** A seção é montada por `buildPartsTable` (linha ~2022) e uma quantidade grande de
lógica depende dos `id`/`data-key` exatos das linhas e células:
`${pk}_tr`, `${pk}_quick_row`, `${pk}_detail_row`, `${pk}_valor_mostrado`, `${pk}_int`,
`${pk}_contador`, `${pk}_ref`, `${pk}_na`, `${pk}_detail_btn`, `${pk}_acao`,
`${pk}_acao_conferida/_trocada/_na`, `${pk}_hori_btn`, `${pk}_foto_btn`.
Esses IDs são lidos por `calcPartRow`, `togglePartDetail`, `togglePtNA`, `pgpSetAcao`,
`pgpRestoreLoadedParts`, `pgpBuildPreventivaPayload`, `gerarPDF`, `renderPGPFields`.
Reescrever para `<div>` quebraria tudo isso silenciosamente.

**Regra dura:** **não criar, renomear nem remover nenhum `id` ou `data-key` existente.**
Trabalhar por cima da tabela atual (Opção B): CSS + pequenos ajustes de JS.

## Estrutura atual (para referência)
Por peça, 3 `<tr>`:
1. `#${pk}_tr` — nome, valor/interv, botão N/A `#${pk}_na`, botão detalhe `#${pk}_detail_btn` (▸).
2. `.pt-quick-row #${pk}_quick_row` — Referência + botões de foto (sempre visível).
3. `.pt-detail-row #${pk}_detail_row` (display:none) — começa com o hidden `#${pk}_acao` e o bloco
   `.pgp-acao-wrap` (Ação desta peça: Conferida/Trocada/N/A), depois última troca/obs.

## 3.1 Separação visual entre peças (cores/bordas)
As três linhas de uma peça têm a mesma cor das da peça seguinte → confusão. Adicionar CSS que
agrupe visualmente as 3 linhas de cada peça como um "card":
```css
/* faixa/gap entre peças: usa o main-row como topo do bloco */
.pt-table tbody tr#{ /* aplicar via classe, ver abaixo */ }
```
Como CSS puro não agrupa `<tr>` alternados por peça facilmente, fazer o mais simples e robusto:
no `buildPartsTable`, **adicionar uma classe de grupo** às 3 `<tr>` de cada peça, ex.
`class="pt-group"` no main-row e `pt-group-cont` nas quick/detail (sem tocar nos ids), e estilizar:
```css
.pt-table tbody tr.pt-group > td{ border-top:3px solid var(--blue); }
.pt-table tbody tr.pt-group > td:first-child{ box-shadow:inset 4px 0 0 var(--blue); }
.pt-table tbody tr.pt-group-cont > td{ background:#fbfcfe; }
.pt-table tbody tr.pt-detail-row.pt-group-cont > td{ background:var(--blue-light); }
```
Alternativa aceitável se `border-top` na `<tr>` não renderizar bem no navegador do celular:
usar `border-bottom:3px solid var(--blue)` na **última** linha da peça (a detail-row) para fechar o bloco.
Escolher a que ficar visualmente mais clara no mobile.

## 3.2 Deslocamento para a direita / seta ▸ cortada
Causa: a soma de `min-width` das células (`.pt-inp input{min-width:60px}`, selects, etc.) ultrapassa a viewport
no cenário D (5 colunas). Correções:
```css
.parts-table-wrap{ max-width:100%; box-sizing:border-box; overflow-x:hidden; }
.pt-table{ table-layout:fixed; width:100%; }
.pt-inp input[type=number], .pt-inp input[type=text]{ min-width:0; }   /* remove o 60px que estoura */
.td-na, .td-detail{ width:44px; }                                       /* colunas de ação estreitas e fixas */
.pt-table .btn-pt-na{ padding:6px 6px; font-size:11px; }
.pt-table .btn-pt-detail{ padding:6px 8px; }
```
Validar visualmente em ~380 px que a coluna ▸ aparece inteira e a tabela não desloca.

## 3.3 Botão "Foto horímetro desta peça" estourando
```css
.btn-foto-peca{
  white-space:normal; overflow-wrap:anywhere; line-height:1.15; text-align:center;
  min-height:52px; padding:10px 8px;
}
```
E encurtar o rótulo no HTML (`data-orig-label` e o texto do botão) de
`📷 Foto horímetro desta peça` → **`📷 Foto horímetro`**. Manter `data-done-label` como está.
⚠ Fazer a mesma troca no `data-orig-label` **e** no texto interno, senão o `resetLabel` volta ao texto longo.

## 3.4 Ação da peça deve aparecer visível imediatamente ao clicar em ▸
A `.pgp-acao-wrap` já é o **primeiro** elemento da `.pt-detail-row`. O problema é a detail-row
abrir **fora da área visível**. Em `togglePartDetail`, ao abrir, rolar a peça para a viewport:
```js
if(open){
  calcPartRow(pk, intDefault);
  var trMain = document.getElementById(pk+'_tr');
  if(trMain && trMain.scrollIntoView) trMain.scrollIntoView({block:'nearest', behavior:'smooth'});
}
```
Não alterar a ordem interna da detail-row (ação já vem primeiro).

## 3.5 N/A recolhe a peça inteira + badge
Hoje `togglePtNA` (linha ~2298) só esconde a `_detail_row`. Estender para recolher também a
`_quick_row`, escurecer sutilmente e atualizar o badge:
```js
function togglePtNA(pk, e){
  e.stopPropagation();
  var btn = document.getElementById(pk+'_na');
  var tr  = document.getElementById(pk+'_tr');
  var det = document.getElementById(pk+'_detail_row');
  var quick = document.getElementById(pk+'_quick_row');
  var active = btn.classList.toggle('active');
  btn.textContent = active ? '✕ N/A' : 'N/A';
  if(tr) tr.classList.toggle('pt-na', active);
  if(det) det.style.display = 'none';
  if(quick) quick.style.display = active ? 'none' : '';   // ⚠ AUDIT: recolhe também a quick-row
  var hidden = document.getElementById(pk+'_acao');
  if(hidden) hidden.value = active ? 'na' : (hidden.value === 'na' ? '' : hidden.value);
  updatePartCompletionStatus(pk);
}
```
`.pt-na{opacity:.45}` já existe (linha ~316) — reaproveitar, sem deixar ilegível.

## 3.6 Badge de status por peça (Pendente / Semi / Completa / N/A)
Adicionar um `<span class="pt-status-badge" id="${pk}_status_badge">` na célula do nome
(`<td class="pt-name">`) em `buildPartsTable`, **sem remover** o conteúdo atual dessa célula.
Função de cálculo (chamada nos gatilhos abaixo):
```js
function updatePartCompletionStatus(pk){
  var badge = document.getElementById(pk+'_status_badge');
  if(!badge) return;
  var acao = (document.getElementById(pk+'_acao')||{}).value || '';
  var ref  = (document.getElementById(pk+'_ref')||{}).value || '';
  var naBtn = document.getElementById(pk+'_na');
  var isNa = naBtn && naBtn.classList.contains('active');
  var vm = (document.getElementById(pk+'_valor_mostrado')||{}).value || '';
  var label='Pendente', cls='pt-badge-pend';
  if(isNa){ label='N/A'; cls='pt-badge-na'; }
  else if(!acao && !ref && !vm){ label='Pendente'; cls='pt-badge-pend'; }
  else if(acao==='trocada' && ref){ label='Completa'; cls='pt-badge-ok'; }
  else if(acao==='conferida'){ label='Completa'; cls='pt-badge-ok'; }
  else { label='Semi completa'; cls='pt-badge-semi'; }
  badge.textContent = label;
  badge.className = 'pt-status-badge ' + cls;
}
```
```css
.pt-status-badge{ display:inline-block; margin-top:3px; font-size:9px; font-weight:700;
  padding:2px 6px; border-radius:6px; letter-spacing:.3px; }
.pt-badge-pend{ background:#eef0f4; color:#6b7280; }
.pt-badge-semi{ background:#fff3d6; color:#a16207; }
.pt-badge-ok{   background:#dcfce7; color:#15803d; }
.pt-badge-na{   background:#ede9fe; color:#6d28d9; }
```
Chamar `updatePartCompletionStatus(pk)` em: `togglePtNA`, `pgpSetAcao`, `calcPartRow`,
no `oninput` da referência (`#${pk}_ref`), ao final de `pgpRestoreLoadedParts`, e após montar a tabela.
⚠ Critério: **fotos NÃO bloqueiam** status nem envio (não transformar foto em obrigatório).

## 3.7 Botão "recolher preenchidas / expandir pendentes"
No topo da `.parts-table-wrap`, adicionar um botão que recolhe peças Completa/N/A e mantém
Pendente/Semi abertas — **sem apagar dados nem alterar payload**:
```js
function collapseCompletedParts(midx){
  var p = 'm'+midx+'_';
  document.querySelectorAll('[id$="_status_badge"]').forEach(function(b){
    if(b.id.indexOf(p)!==0) return;
    var pk = b.id.replace('_status_badge','');
    var st = b.textContent;
    var det = document.getElementById(pk+'_detail_row');
    if((st==='Completa'||st==='N/A') && det) det.style.display='none';
  });
}
```
Rótulo do botão: `▴ Recolher peças completas`. Não é obrigatório o "Expandir pendentes"; se incluir, que só reabra as Pendentes/Semi.

---

# 4. PCF + PCM + GAS — OS não pode sumir ao concluir

## Diagnóstico (⚠ AUDIT: confirmado nos 3 pontos)
1. **GAS `getOS` (linha 3846):** `if(!includeClosed){ rows = rows.filter(o => !isOsClosed_(o.status)); }` — exclui concluídas por padrão. ✔ confirmado.
2. **PCF `pfLoadOS` (linha 7172):** filtra fora `cancelada` **e** `concluida`. ✔ confirmado.
3. **PCM `renderOS` (linha 7918):** chama `gsGet('getOS')` **sem** `includeClosed`. ✔ confirmado.
   (A tabela do PCM já tem labels/filtro para `CONCLUIDA`/`CANCELADA` — só falta o dado chegar.)

**Causa raiz do relato do Fernando (OS-000009 sumiu):** a OS era do tipo PREVENTIVA (tarefa única `auto:preventiva`); ao registrar a preventiva, a tarefa auto-completa, `_finalizarAtendimentoOS_` marca `concluida`, e os 3 filtros acima escondem a OS. Nada foi deletado.

## 4.1 GAS — `getOS`: manter a lógica de `includeClosed` (não mexer)
Só os frontends passam a pedir OS encerradas. **Não remover** o filtro.

## 4.2 GAS — `_finalizarAtendimentoOS_` (linha 3622): **só ADICIONAR `em_andamento`**
⚠ AUDIT — **preservar** o `osSheet.getRange(rowOs, idxFim + 1).setValue(now);` incondicional (regra travada nº 2). Depois do bloco que decide `todasCompletas`, ajustar apenas o desfecho de status:
```js
if (!encontrouTarefa) return;
if (todasCompletas && idxStatus >= 0) {
  osSheet.getRange(rowOs, idxStatus + 1).setValue('concluida');
} else if (idxStatus >= 0) {
  // ⚠ AUDIT: nova transição — OS que recebeu preventiva mas ainda tem tarefas
  // pendentes passa de 'aberta' para 'em_andamento'. Não regride status já avançado.
  var atual = normalizeOsStatus_(osData[rowOs - 1][idxStatus]);
  if (atual === 'ABERTA' || atual === 'aberta') {
    osSheet.getRange(rowOs, idxStatus + 1).setValue('em_andamento');
  }
}
```
⚠ Conferir o valor exato que `normalizeOsStatus_` retorna (maiúsculas/minúsculas) e comparar com o formato certo — não assumir. `normalizeOsStatus_` está na linha 3044; ler antes de escrever a comparação.

## 4.3 PCF — `pfLoadOS` (linha 7159): pedir encerradas e parar de esconder `concluida`
```js
var params = usuarioId ? { id_usuario: usuarioId } : {};
params.includeClosed = 'true';                          // ⚠ AUDIT: sem isso o GAS já filtra antes
var r = await pfGet('getOS', params);
_pfOsList = (r.os || []).filter(function(o){
  var st = String(o.status || '').toLowerCase();
  return st !== 'cancelada';                            // mostra aberta/em_andamento/concluida
});
```
As classes CSS (`.pf-os-status.concluida`, `.em_andamento`) e os rótulos já existem em `pfRenderOS` — nada mais a fazer no render.

### Filtro de status no PCF (evitar poluição, mas manter a OS localizável)
Os chips atuais são por **local** (Todas/Externas/Internas), controlados por `_pfOsFilter` e `pfSetOSFilter`.
Adicionar um **segundo grupo** de chips por **status** (`_pfOsStatusFilter`), independente do de local:
`Ativas` (aberta+em_andamento) · `Concluídas` · `Todas`. **Default = `Ativas`** (assim a lista do dia
fica limpa), com `Concluídas`/`Todas` disponíveis para reencontrar a OS. Não misturar com o filtro de local.

## 4.4 PCM — `renderOS` (linha 7918): 1 linha
```js
gsGet('getOS', { includeClosed: 'true' }),
```
Nada mais no PCM. O `_renderOSTable` já trata `CONCLUIDA`/`CANCELADA` e tem filtro de status. **Não** tocar em outra parte do arquivo.

---

# 5. PCF/GAS — otimizar o tempo de envio da preventiva

## ⚠ AUDIT — o gargalo real NÃO é o `appendRow`
O prompt original focou em batelar `appendRow` do `PECAS_LOG`. Isso ajuda, mas medindo o código:
`savePreventiva` chama, **por peça**, três funções que fazem `getDataRange().getValues()` do
`MACHINE_PARTS` inteiro: `getCurrentRefFromMachineParts` (1992), `updateMachinePartFromPreventiva` (2019)
e `updateMachinePartValorMostrado` (2101). Para ~25 peças isso são **~50–75 leituras completas** da aba,
mais N `appendRow`. Esse é o custo dominante.

Fazer as duas otimizações, em ordem de risco:

## 5.1 (Baixo risco) PCF — usar `pgpPostJson` + guarda de clique-duplo + feedback
Hoje `pgpEnviarPreventiva` usa `fetch` cru (`gcBody({action:'savePreventiva',...})`, linha ~6578) e faz o próprio parse.
⚠ AUDIT — **é seguro trocar** por `pgpPostJson('savePreventiva', payload)`, porque:
- `pgpPostJson` só lança quando `d.status !== 'ok'`; e o caso de duplicata retorna `{status:'ok', duplicate:true}` (confirmado em `savePreventiva`, GAS), então `d.duplicate` continua acessível.
- Genuínos erros caem no `catch` existente → fila offline (comportamento desejado).
Preservar **exatamente** a ramificação de resultado atual (`d.duplicate` → "já registrada"; `d.status==='ok'` → sucesso + `pgpMostrarVoltarParaOS()`/`pgpSetTipoVisita`), só trocando a origem de `d`.

Feedback + no-double-click:
```js
if(btn){ btn.disabled = true; btn.textContent = 'Enviando preventiva…'; }
var _slow = setTimeout(function(){ if(btn) btn.textContent = 'Ainda enviando. Não feche a tela.'; }, 8000);
// ... no finally:
clearTimeout(_slow);
if(btn){ btn.disabled = false; btn.textContent = '🔧 Registrar Preventiva'; }
```
(O `finally` já restaura o botão — apenas somar o `disabled` no início e o `clearTimeout`.)

## 5.2 (Médio risco — fazer com cuidado) GAS — `savePreventiva`: uma leitura + uma escrita
Refatorar o laço de peças para:
1. **Ler `MACHINE_PARTS` uma vez** antes do loop (`getDataRange().getValues()`), montar índice em memória por chave (a mesma chave que `getCurrentRefFromMachineParts`/`updateMachinePart*` usam — **ler essas funções e reproduzir a chave idêntica**, não inventar).
2. No loop, resolver `refAnterior` e aplicar as mutações **no array em memória** (não gravar célula a célula).
3. **Acumular as linhas do `PECAS_LOG` em um array** e gravar com **um** `setValues`:
```js
var pecasRows = [];
Object.entries(parts).forEach(function([partId, ps]){ pecasRows.push([ /* mesma ordem de colunas do appendRow atual */ ]); });
if(pecasRows.length){
  var start = partsSheet.getLastRow() + 1;
  partsSheet.getRange(start, 1, pecasRows.length, pecasRows[0].length).setValues(pecasRows);
}
```
4. Gravar as mutações do `MACHINE_PARTS` de volta com **um** `setValues` (ou writes por linha alterada, se o upsert criar linhas novas — nesse caso, `appendRow` só das novas + `setValues` das existentes).
5. **Manter idempotência por `visit_id`** (o guard de duplicata no topo de `savePreventiva` fica intacto).
6. Preservar a ordem e o número **exato** de colunas do `appendRow` atual (ver o array atual na linha ~1608). Não trocar nenhuma coluna de posição.

⚠ Se o risco de 5.2 parecer alto para uma única passada, **entregar 5.1 primeiro** (garante ganho perceptível e zero risco de schema) e deixar 5.2 claramente isolado no mesmo commit, com `node --check` e conferência de contagem de colunas. Não misturar 5.2 com mudanças de UI.

## 5.3 Não bloquear no não-crítico (já é assim — preservar)
`autoCompletarTarefa`, `_marcarMaquinaAtendidaOS_`, `_adicionarVisitaResultadoOS_`,
`_finalizarAtendimentoOS_` já rodam em `try/catch` não-bloqueante após o `return` de sucesso da
gravação principal. **Manter.** Opcional: acumular um `warnings[]` no retorno se alguma integração
falhar, sem derrubar o sucesso. Não incluir base64 de foto no `savePreventiva` (backup de foto é fire-and-forget separado — não tocar).

---

# 6. PCF — esconder botões que não fazem sentido no modo preventiva

## Alvos confirmados (⚠ AUDIT: ids reais verificados)
- `#btnDone` — "Gerar Resumo 📲" (linha 1190), divide a linha `.actions` com "↺ Limpar".
- `#btnEnviarGSMain` — "📤 Enviar ao Sheets" (linha 1206), sozinho numa `.actions`.
- `#pgpGsStatusMain` — status de conexão (linha 1208).
Manter: Limpar, Salvar Coleta, Gerar PDF, Consolidar PDFs, e o CTA `#pgpPrevActionsWrap`.

## Função única (⚠ AUDIT: chamar de UM ponto — o funil `pgpSetTipoVisita`)
```js
function pgpAtualizarAcoesPorTipoVisita(){
  var isPrev = (_pgpTipoVisita === 'preventiva');

  var btnResumo = document.getElementById('btnDone');
  if(btnResumo) btnResumo.style.display = isPrev ? 'none' : '';   // esconde só o botão, "Limpar" fica

  var btnSheets = document.getElementById('btnEnviarGSMain');
  if(btnSheets){
    var row = btnSheets.closest('.actions');
    if(row) row.style.display = isPrev ? 'none' : '';
    else btnSheets.style.display = isPrev ? 'none' : '';
  }
  var statusMain = document.getElementById('pgpGsStatusMain');
  if(statusMain) statusMain.style.display = isPrev ? 'none' : '';

  // seção 1.6: esconder os wraps de hora início/fim quando preventiva-de-OS
  var esconderHora = (isPrev && !!window._PGP_OS_ID);
  document.querySelectorAll('[data-key$="_hora_wrap"]').forEach(function(el){
    el.style.display = esconderHora ? 'none' : '';
  });
}
```
Chamar no **final de `pgpSetTipoVisita`** (linha ~6321 — é o único ponto que muda `_pgpTipoVisita`)
e **uma vez no boot** após a UI montar. ⚠ Como as peças/hora são renderizadas dinamicamente,
chamar `pgpAtualizarAcoesPorTipoVisita()` **também depois** de qualquer re-render de máquina
(ex. ao adicionar máquina), senão os wraps de hora de máquinas novas não serão escondidos.

Se existir uma aba "Enviar ao Sheets" dentro do modal de resumo, ela não precisa ser tocada
(o modal só abre por `#btnDone`, que estará escondido no modo preventiva).

---

# 7. Critérios de aceite

**Horário**
- Abrir OS no PCF → tarefa de preventiva → campos manuais de Hora Início/Fim **não aparecem**.
- Após registrar: `VISITAS.Hora_Inicio` = hora de abertura pelo pipeline; `Hora_Fim` = hora do envio.
- **PDF e resumo** mostram as mesmas horas (não vazias) — validar (regressão do item 1.5).
- Preventiva **avulsa** (sem `os_id`): campos manuais continuam visíveis e funcionais.

**Voltar para OS**
- Card no fluxo (não flutuante) aparece após registrar; **não some sozinho**; sobrevive a rolagem/edição.
- Clique leva a `?modo=pipeline&os_id=...`; a flag em `localStorage` é limpa ao voltar.

**Peças**
- Nenhuma seta ▸ cortada em ~380 px; seção centralizada (sem deslocar para a direita).
- "📷 Foto horímetro" não estoura o botão.
- Clicar ▸ rola a peça para a viewport e a "Ação desta peça" fica visível de imediato.
- N/A recolhe **quick-row e detail-row** e mostra badge `N/A`.
- Badge Pendente/Semi/Completa/N/A por peça; foto **não** é obrigatória.
- "Recolher peças completas" funciona **sem apagar dados nem mudar payload**.
- **Nenhum `id`/`data-key` renomeado**; `calcPartRow`, restore e payload continuam funcionando.

**OS visível**
- Ao registrar preventiva, a OS **não some** do PCF nem do PCM.
- Status vira `Em andamento` (tarefas pendentes) ou `Concluída` (todas completas).
- PCF: filtro de status (default `Ativas`) permite reencontrar concluídas.
- PCM: concluídas/canceladas aparecem via `includeClosed:'true'` e filtro de status existente.
- `fim_atendimento` continua sendo carimbado na preventiva (regra travada — **não** regrediu).

**Performance**
- Envio usa `pgpPostJson`; sem clique-duplo; feedback textual durante o envio.
- `PECAS_LOG` gravado em lote (um `setValues`); `MACHINE_PARTS` lido **uma vez** por envio.
- Contagem/ordem das colunas de `PECAS_LOG` **idêntica** à v55; idempotência por `visit_id` preservada.
- Falha em integração de pipeline não faz a preventiva salva parecer perdida.

**Não-regressão**
- Login por PIN, inspeção avulsa, preventiva avulsa, fila offline, PDF, fotos/miniaturas: intactos.
- Persistência de tipo de equipamento, regime e horímetros por peça (v36/v55): intacta.
- `node --check GAS_properCare_v56.js` passa. Changelog no topo dos 3 arquivos. Um diff por arquivo.

---

# 8. Atualização do ESTADO_ATUAL.md (obrigatória ao final)
- §1: versões → PCF v37, PCM v58, GAS v56.
- §2: **uma** entrada nova no topo (data, versões, resumo dos 6 itens). Não reescrever entradas antigas.
- §3: se algo virar pendência (ex. badge de status de peça, ou 5.2 se ficar parcial), registrar.
- §4/§7: **não alterar** as decisões/regras travadas.
