# Prompt Codex — Consolidado: Performance e resiliência de rede
# (GAS v48→v49, PCM v49→v50, PCF v32→v33)

## Leia isto primeiro

Este prompt contém **três tarefas independentes**, uma por arquivo. Trate
cada uma como um commit isolado — não misture lógica entre elas, não
"aproveite" código de uma seção pra outra, e entregue **três changelogs
separados**, um no topo de cada arquivo de saída. O objetivo de consolidar
num prompt só é economizar rodadas, não fundir as mudanças.

Ordem de execução sugerida (mas as três são independentes entre si —
podem ser feitas em qualquer ordem ou em paralelo, se preferir):

1. GAS_properCare_v48.js → v49
2. PCM_v49.html → v50
3. PCF_index_v32.html → v33

Se qualquer um dos três já tiver sido aplicado anteriormente (por
exemplo, se já existe um `GAS_properCare_v49.js` real do sprint de
catálogo de peças), **use esse arquivo mais recente como base** para a
tarefa correspondente e ajuste o número de versão de saída (ex.: v49→v50
em vez de v48→v49) — não sobrescreva trabalho já feito.

---

## TAREFA 1 — GAS_properCare_v48.js → v49

### Contexto

`PIPELINE_TAREFAS` acumula indefinidamente porque tarefas arquivadas
(`Ativo='ARQUIVADO'`, setadas em `instanciarPipeline` ao reinstanciar um
pipeline) não são excluídas por `getSheetDataActive()` — que só filtra
`Ativo==='NÃO'`. Isso deixa toda leitura de pipeline mais lenta com o
tempo. Também há uma ineficiência O(n×m) no cálculo de `total_maquinas`
em `getOS`.

**Não alterar `getSheetDataActive` nem `getSheetData`** — são genéricas,
usadas por várias abas sem o conceito de `ARQUIVADO`. A correção é pontual
nos três pontos abaixo.

### Mudança 1.1 — `getPipelineByOS` (linha ~5313)

Localizar:
```js
  var tarefas = getSheetDataActive('PIPELINE_TAREFAS')
    .filter(function(r) { return String(r['OS_ID'] || '').trim() === String(os_id).trim(); });
```
Substituir por:
```js
  var tarefas = getSheetDataActive('PIPELINE_TAREFAS')
    .filter(function(r) {
      return String(r['OS_ID'] || '').trim() === String(os_id).trim() &&
             String(r['Ativo'] || 'SIM').trim().toUpperCase() !== 'ARQUIVADO';
    });
```

### Mudança 1.2 — `getSaturacaoUsuarios` (linha ~5330)

Localizar:
```js
  var tarefas = getSheetDataActive('PIPELINE_TAREFAS').filter(function(t) {
    var st = String(t.Status || '').trim();
    return st !== 'completo'; // conta tudo que ainda não foi concluído
  });
```
Substituir por:
```js
  var tarefas = getSheetDataActive('PIPELINE_TAREFAS').filter(function(t) {
    var st = String(t.Status || '').trim();
    var ativo = String(t.Ativo || 'SIM').trim().toUpperCase();
    return st !== 'completo' && ativo !== 'ARQUIVADO';
  });
```

### Mudança 1.3 — `getOS`: total_maquinas O(n×m) → O(n+m) (linha ~3586)

Localizar:
```js
  const osmAll = getSheetData('OS_MAQUINAS').filter(function(r){ return isActive_(r.Ativo); });
  rows = rows.map(function(o){
    const out = Object.assign({}, o);
    out.usuarios_vinculados = parseJsonArray_(o.usuarios_vinculados || o.tecnicos_vinculados);
    out.tecnicos_vinculados = out.usuarios_vinculados; // compat — remover após sessões 2/3
    out.maquinas_vinculadas = parseJsonArray_(o.maquinas_vinculadas);
    out.status = normalizeOsStatus_(o.status);
    out.total_maquinas = osmAll.filter(function(r){ return String(r.id_os || '') === String(o.id_os); }).length;
    return out;
  });
```
Substituir por:
```js
  const osmAll = getSheetData('OS_MAQUINAS').filter(function(r){ return isActive_(r.Ativo); });
  const contagemMaquinasPorOs_ = {};
  osmAll.forEach(function(r){
    const k = String(r.id_os || '');
    contagemMaquinasPorOs_[k] = (contagemMaquinasPorOs_[k] || 0) + 1;
  });
  rows = rows.map(function(o){
    const out = Object.assign({}, o);
    out.usuarios_vinculados = parseJsonArray_(o.usuarios_vinculados || o.tecnicos_vinculados);
    out.tecnicos_vinculados = out.usuarios_vinculados; // compat — remover após sessões 2/3
    out.maquinas_vinculadas = parseJsonArray_(o.maquinas_vinculadas);
    out.status = normalizeOsStatus_(o.status);
    out.total_maquinas = contagemMaquinasPorOs_[String(o.id_os)] || 0;
    return out;
  });
```

### Achado bônus — só documentar, não corrigir

`autoCompletarTarefa` (linha ~5510) lê `PIPELINE_TAREFAS` sem filtrar por
`Ativo` — pode em teoria casar com tarefa arquivada de uma reinstanciação
anterior. Anotar no changelog como pendência para prompt futuro dedicado
(função sensível, não mexer agora).

### Changelog (topo do arquivo)

```
// GAS_properCare_v49.js
// v49 — Performance: parar de reprocessar tarefas de pipeline arquivadas
//   - getPipelineByOS e getSaturacaoUsuarios: excluem Ativo='ARQUIVADO' de
//     PIPELINE_TAREFAS (getSheetDataActive só excluía 'NÃO' — não alterada,
//     é genérica). getOS: total_maquinas calculado em passada única O(n+m)
//     em vez de filter aninhado O(n×m).
//   - Pendência anotada (não corrigida): autoCompletarTarefa não filtra
//     Ativo — requer prompt dedicado.
```

---

## TAREFA 2 — PCM_v49.html → v50

### Contexto

`gsGet`/`syncToGS`/`gsPost` (helpers de rede compartilhados por
praticamente toda tela do PCM, inclusive `instanciarPipeline` disparado ao
salvar OS) não têm retry. Uma falha transitória do GAS (comum sob
concorrência) vira erro definitivo na hora — já causou uma OS criada sem
pipeline em produção porque `instanciarPipeline` falhou silenciosamente.

### Mudança 2.1 — Retry/backoff em gsGet e syncToGS (linha ~2219)

Localizar:
```js
async function syncToGS(action,payload){
  if(!gsUrl||!gsConnected) return null;
  const r = await fetch(gsUrl,{method:'POST',body:gcBody({action,key:_AUTH_HASH,...payload})});
  if(!r.ok) throw new Error('HTTP ' + r.status);
  const txt = await r.text();
  if(txt.trim().startsWith('<')) throw new Error('GAS retornou HTML — verifique publicação do Web App');
  let json;
  try { json = JSON.parse(txt); } catch(e) { throw new Error('Resposta inválida do GAS: ' + txt.slice(0,80)); }
  if(!json || json.status !== 'ok') throw new Error(json?.error || 'Erro GS');
  return json;
}

async function gsGet(action, params = {}){
  const qs = new URLSearchParams({ action, key:_AUTH_HASH, ...params });
  const r = await fetch(gsUrl + '?' + qs.toString() + gcParam(), { method:'GET' });
  const txt = await r.text();
  if(txt.trim().startsWith('<'))
    throw new Error('GAS retornou HTML — verifique a publicação do Web App');
  return JSON.parse(txt);
}
```

Substituir por:
```js
// v50 — Resiliência de rede: retry com backoff para falhas transitórias de
// infraestrutura do GAS. NÃO retenta erros de negócio (status:'error' com
// HTTP 200) — só falhas de rede/infra.
async function _gsRequestComRetry_(url, options, maxRetries) {
  if (maxRetries === undefined) maxRetries = 2;
  var lastErr;
  for (var tentativa = 0; tentativa <= maxRetries; tentativa++) {
    try {
      const r = await fetch(url, options);
      const txt = await r.text();
      if (txt.trim().startsWith('<')) {
        throw new Error('GAS retornou HTML — verifique a publicação do Web App');
      }
      if (!r.ok) {
        throw new Error('HTTP ' + r.status);
      }
      try {
        return JSON.parse(txt);
      } catch (e) {
        throw new Error('Resposta inválida do GAS: ' + txt.slice(0, 80));
      }
    } catch (e) {
      lastErr = e;
      var infraTransitoria = /^HTTP \d+$/.test(e.message) ||
        /Failed to fetch|NetworkError|Load failed/i.test(e.message);
      if (!infraTransitoria || tentativa === maxRetries) throw e;
      console.warn('[gsRequest] tentativa ' + (tentativa + 1) + ' falhou (' +
        e.message + ') — retry em ' + (600 * (tentativa + 1)) + 'ms');
      await new Promise(function(res) { setTimeout(res, 600 * (tentativa + 1)); });
    }
  }
  throw lastErr;
}

async function syncToGS(action,payload){
  if(!gsUrl||!gsConnected) return null;
  const json = await _gsRequestComRetry_(gsUrl, {
    method:'POST',
    body: gcBody({action,key:_AUTH_HASH,...payload})
  });
  if(!json || json.status !== 'ok') throw new Error(json?.error || 'Erro GS');
  return json;
}

async function gsGet(action, params = {}){
  const qs = new URLSearchParams({ action, key:_AUTH_HASH, ...params });
  return await _gsRequestComRetry_(gsUrl + '?' + qs.toString() + gcParam(), { method:'GET' });
}
```

### Regras

- Não alterar assinaturas de `gsGet`/`syncToGS` — usadas centenas de vezes.
- Não adicionar checagem de `status` dentro de `gsGet` (comportamento de
  sucesso deve ficar idêntico — várias telas dependem disso).
- Não tocar em nenhuma outra função do arquivo.

### Changelog (topo do arquivo)

```
// PCM_v50.html
// v50 — Resiliência de rede: retry/backoff em gsGet e syncToGS
//   - Nova função interna _gsRequestComRetry_: até 2 retries (600ms/1200ms)
//     para falhas de infraestrutura do GAS. Cobre indiretamente toda
//     chamada que passa por gsGet/syncToGS/gsPost, inclusive
//     instanciarPipeline (criação de OS e "Trocar pipeline") e a
//     sincronização silenciosa de boot (syncFromGS).
//   - gsGet/syncToGS: assinatura e comportamento de sucesso inalterados.
```

---

## TAREFA 3 — PCF_index_v32.html → v33

### Contexto

Mesmo problema do PCM, só que em campo (conectividade pior). Além disso,
`pfAbrir()` dispara duas chamadas simultâneas ao GAS na abertura do
Pipeline.

### Mudança 3.1 — Retry/backoff em pfGet e pgpPostJson

Localizar (linha ~6993):
```js
async function pfGet(action, params) {
  if (!_pgpGsUrl) throw new Error('URL do servidor não configurada. Acesse Configurações no ProperTech.');
  params = params || {};
  const qs = new URLSearchParams(Object.assign({ action, key: _AUTH_HASH }, params));
  const r = await fetch(_pgpGsUrl + '?' + qs.toString() + gcParam(), { method: 'GET' });
  const txt = await r.text();
  if (txt.trim().startsWith('<')) throw new Error('GAS retornou HTML — verifique publicação');
  const d = JSON.parse(txt);
  if (!d || d.status !== 'ok') throw new Error(d?.error || 'Erro GAS');
  return d;
}
```

E localizar (linha ~5213):
```js
async function pgpPostJson(action, body){
  // Sem Content-Type: evita preflight CORS (Apps Script não responde OPTIONS)
  const r = await fetch(_pgpGsUrl,{
    method:'POST',
    body:gcBody({action, key:_AUTH_HASH, ...body})
  });
  if(!r.ok) throw new Error(`HTTP ${r.status}`);
  const txt = await r.text();
  if(txt.trim().startsWith('<')) throw new Error('Apps Script retornou HTML — verifique a publicação (Qualquer pessoa, sem login)');
  let d = null;
  try{ d = JSON.parse(txt); }catch(e){ throw new Error('Resposta inválida do Apps Script'); }
  if(!d || d.status!=='ok') throw new Error((d && d.error) || `Falha em ${action}`);
  return d;
}
```

Adicionar, próximo a `pfGet`:
```js
// v33 — Resiliência de rede em campo: retry com backoff (1000ms/2500ms,
// mais longo que o PCM porque a rede de campo demora mais pra se
// recuperar). NÃO retenta erro de negócio nem HTML de config incorreta.
async function _pgpFetchComRetry_(url, options, maxRetries) {
  if (maxRetries === undefined) maxRetries = 2;
  var lastErr;
  for (var tentativa = 0; tentativa <= maxRetries; tentativa++) {
    try {
      const r = await fetch(url, options);
      const txt = await r.text();
      if (txt.trim().startsWith('<')) {
        throw new Error('GAS retornou HTML — verifique a publicação do Web App');
      }
      if (!r.ok) {
        throw new Error('HTTP ' + r.status);
      }
      try {
        return JSON.parse(txt);
      } catch (e) {
        throw new Error('Resposta inválida do GAS: ' + txt.slice(0, 80));
      }
    } catch (e) {
      lastErr = e;
      var infraTransitoria = /^HTTP \d+$/.test(e.message) ||
        /Failed to fetch|NetworkError|Load failed/i.test(e.message);
      if (!infraTransitoria || tentativa === maxRetries) throw e;
      console.warn('[pgpFetch] tentativa ' + (tentativa + 1) + ' falhou (' +
        e.message + ') — retry em ' + (1000 * (tentativa + 1)) + 'ms');
      await new Promise(function(res) { setTimeout(res, 1000 * (tentativa + 1)); });
    }
  }
  throw lastErr;
}
```

Substituir o corpo de `pfGet` por:
```js
async function pfGet(action, params) {
  if (!_pgpGsUrl) throw new Error('URL do servidor não configurada. Acesse Configurações no ProperTech.');
  params = params || {};
  const qs = new URLSearchParams(Object.assign({ action, key: _AUTH_HASH }, params));
  const d = await _pgpFetchComRetry_(_pgpGsUrl + '?' + qs.toString() + gcParam(), { method: 'GET' });
  if (!d || d.status !== 'ok') throw new Error(d?.error || 'Erro GAS');
  return d;
}
```

Substituir o corpo de `pgpPostJson` por:
```js
async function pgpPostJson(action, body){
  const d = await _pgpFetchComRetry_(_pgpGsUrl, {
    method:'POST',
    body:gcBody({action, key:_AUTH_HASH, ...body})
  });
  if(!d || d.status!=='ok') throw new Error((d && d.error) || `Falha em ${action}`);
  return d;
}
```

### Mudança 3.2 — Não disparar pfLoadOS e pollPfNotificacoes em paralelo

Localizar (linha ~7017):
```js
function pfAbrir() {
  var ov = document.getElementById('pfOverlay');
  ov.style.display = 'flex';
  document.getElementById('pfScreenOS').style.display = 'block';
  document.getElementById('pfScreenPipeline').style.display = 'none';
  _pfOsFilter = 'todas';
  pfLoadOS();
  if (!_pfNotifInterval) {
    _pfNotifInterval = setInterval(pollPfNotificacoes, 60000);
    pollPfNotificacoes();
  }
}
```
Substituir por (async — os dois call sites existentes não dependem do
retorno, seguro tornar assíncrona):
```js
async function pfAbrir() {
  var ov = document.getElementById('pfOverlay');
  ov.style.display = 'flex';
  document.getElementById('pfScreenOS').style.display = 'block';
  document.getElementById('pfScreenPipeline').style.display = 'none';
  _pfOsFilter = 'todas';
  await pfLoadOS();
  if (!_pfNotifInterval) {
    _pfNotifInterval = setInterval(pollPfNotificacoes, 60000);
    pollPfNotificacoes();
  }
}
```

### Regras

- Não alterar assinaturas de `pfGet`/`pgpPostJson`.
- Não mexer em PCM nem GAS nesta tarefa.

### Changelog (topo do arquivo)

```
// PCF_index_v33.html
// v33 — Resiliência de rede em campo + evitar chamadas concorrentes na
//        abertura do Pipeline
//   - Nova função interna _pgpFetchComRetry_: até 2 retries
//     (1000ms/2500ms) para falhas de infraestrutura. Mesmo padrão do
//     PCM v50, backoff mais longo pra conectividade de campo.
//   - pfAbrir: aguarda pfLoadOS() antes de iniciar polling de
//     notificações, em vez de disparar as duas em paralelo.
```

---

## Checklist de teste (validar as três tarefas antes de considerar concluído)

1. `node --check` em cada um dos três arquivos/blocos `<script>` extraídos.
2. **GAS:** abrir uma OS com pipeline reinstanciado mais de uma vez —
   confirmar que só tarefas ativas aparecem. Conferir `total_maquinas`
   contra a tela de detalhe da OS.
3. **PCM:** abrir Usuários/Perfis/Templates/Tipos de OS várias vezes
   seguidas — sem regressão no caminho feliz. Criar uma OS nova e
   confirmar que o pipeline é instanciado automaticamente (sem precisar de
   "Trocar pipeline" manual).
4. **PCF:** simular "Slow 3G" no DevTools mobile e abrir o Pipeline —
   confirmar `console.warn` de retry em vez de erro imediato.
5. Reproduzir o cenário que gerou o incidente original (criar OS,
   verificar que o pipeline aparece de primeira tanto no PCM quanto no
   PCF, sem precisar de correção manual).
