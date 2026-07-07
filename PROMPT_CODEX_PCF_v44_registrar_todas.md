# Codex — PCF `PCF_index_v43.html` → `PCF_index_v44.html`
## Concern único: "Registrar Preventiva" passa a registrar TODAS as máquinas da coleta

### Contexto (causa-raiz confirmada por auditoria)
Hoje `pgpEnviarPreventiva(midx=currentMachine)` envia **uma única** `savePreventiva` — só a máquina da aba ativa. Não há loop sobre as demais. Resultado em campo: técnico coletou 4 máquinas, clicou uma vez, só 1 foi salva. O GAS não tem ação em lote (só `saveVisit`/`savePreventiva`, uma máquina por chamada, idempotentes por `visit_id`), então o loop tem de morar no PCF.

### Invariantes (NÃO violar)
- **Máquina única inalterada:** com `machines.length <= 1`, o comportamento tem de ser byte-a-byte o de hoje. O orquestrador cai no caminho legado nesse caso.
- **Nada de GAS.** `savePreventiva` já existe em produção; cada máquina gera seu próprio `visit_id` (idempotência preservada). **Não depende do deploy do GAS v58.**
- Reaproveita a infra existente: `pgpBuildPreventivaPayload(idx)`, fila `pgp_pending_sync`/`QUEUE_LIMIT 40`, `savePendingQueue`, `pgpGetPending`, `pgpUpdatePendingBadge`, `pgpMostrarVoltarParaOS`, `pgpSetTipoVisita`, `AppDialog`, `showNotification`. Nenhum identificador novo além de `pgpEnviarTodasPreventivas`.
- Não renomear IDs/data-keys/funções (invariante `VIEW_ID_OVERRIDES`).
- No comentário de changelog dentro do HTML, **não usar `--`** no texto do comentário.

---

### EDIÇÃO 1 — trocar o `onclick` do botão (linha 1462)
O botão é o **único** caller de `pgpEnviarPreventiva` (confirmado por grep).

**Localizar (linha ~1462):**
```html
  <button class="btn-preventiva" onclick="pgpEnviarPreventiva()">
```
**Substituir por:**
```html
  <button class="btn-preventiva" onclick="pgpEnviarTodasPreventivas()">
```

---

### EDIÇÃO 2 — substituir a função `pgpEnviarPreventiva` inteira (linhas 6899–7038)
Substituir do cabeçalho `async function pgpEnviarPreventiva(midx=currentMachine){` (linha 6899) até o `}` que fecha a função (linha 7038, **imediatamente antes** do comentário `// v28 — Preventiva↔Pipeline: banner fixo...`) por EXATAMENTE o bloco abaixo. Ele contém o novo orquestrador `pgpEnviarTodasPreventivas` **seguido** da versão refatorada de `pgpEnviarPreventiva` (que ganhou o 2º parâmetro opcional `opts.silent` para rodar em lote sem disparar notificações/side-effects por máquina).

```javascript
async function pgpEnviarTodasPreventivas(){
  if(!Array.isArray(machines) || machines.length <= 1){
    return pgpEnviarPreventiva(currentMachine);
  }
  const total = machines.length;
  const ok = await AppDialog.confirm(
    'Registrar as ' + total + ' máquinas desta coleta agora?',
    { title:'Registrar preventivas', okLabel:'Registrar todas' }
  );
  if(!ok) return;

  const btn = document.querySelector('.btn-preventiva');
  let _slow = null;
  if(btn){ btn.disabled = true; btn.textContent = 'Registrando ' + total + ' máquinas…'; }
  _slow = setTimeout(function(){ if(btn) btn.textContent = 'Ainda enviando. Não feche a tela.'; }, 8000);

  let enviadas = 0, filas = 0, dups = 0;
  const puladas = [];
  try{
    for(let i = 0; i < machines.length; i++){
      const res = await pgpEnviarPreventiva(i, { silent:true });
      if(!res || res.status === 'skipped'){
        puladas.push('Máq. ' + (i+1) + (res && res.reason ? ' — ' + res.reason : ''));
      } else if(res.status === 'queued'){ filas++; }
      else if(res.status === 'duplicate'){ dups++; }
      else if(res.status === 'ok'){ enviadas++; }
      else { puladas.push('Máq. ' + (i+1) + (res.error ? ' — ' + res.error : ' — falha')); }
    }
  } finally {
    if(_slow) clearTimeout(_slow);
    if(btn){ btn.disabled = false; btn.textContent = '🔧 Registrar Preventiva'; }
  }

  // Side-effects UMA vez, ao final. Para OS: sempre mostra o caminho de volta.
  // Fora de OS: só volta para 'inspecao' se TODAS foram registradas (senão
  // mantém a view de preventiva para o técnico completar as pendentes).
  if(window._PGP_OS_ID){ pgpMostrarVoltarParaOS(); }
  else if(puladas.length === 0){ pgpSetTipoVisita('inspecao'); }

  let msg = '✅ ' + enviadas + ' preventiva(s) registrada(s)';
  if(filas) msg += ' · ' + filas + ' na fila';
  if(dups)  msg += ' · ' + dups + ' já existia(m)';
  if(puladas.length) msg += ' · ' + puladas.length + ' não enviada(s)';
  showNotification(msg);

  if(puladas.length){
    AppDialog.alert(
      'Estas máquinas NÃO foram registradas (dados incompletos ou falha):\n\n' + puladas.join('\n') +
      '\n\nComplete os campos pendentes e registre novamente.',
      { variant:'warn', title:'Pendências' }
    );
  }
}

async function pgpEnviarPreventiva(midx=currentMachine, opts){
  opts = opts || {};
  const silent = !!opts.silent;
  const idx=pgpGetMachineIndex(midx);
  const p=`m${idx}_`;
  const gv=key=>{
    const el=document.querySelector(`[data-key="${p}${key}"]`);
    return el?el.value.trim():'';
  };
  if(window._PGP_OS_ID){
    var elHf = document.querySelector('[data-key="m'+idx+'_hora_fim"]');
    if(elHf) elHf.value = pgpNowHHMMLocal();
  }
  const hourTotal=parseInt(gv('horimetro'))||0;
  if(!hourTotal){
    if(silent) return { status:'skipped', reason:'horímetro não informado' };
    showNotification('⚠ Informe o horímetro antes de registrar');
    return;
  }

  let todasComAcao=true;
  let algumaTrocadaSemRef=false;

  PARTS.forEach(pt=>{
    const pk=p+pt.k;
    const naBtn=document.getElementById(pk+'_na');
    const isNA=naBtn?.classList.contains('active')||false;
    if(isNA) return;

    const acaoEl=document.getElementById(pk+'_acao');
    const acao=acaoEl?acaoEl.value:'';
    if(!acao){todasComAcao=false;return;}

    if(acao==='trocada'){
      const refEl=document.getElementById(pk+'_ref');
      if(!refEl||!refEl.value.trim()) algumaTrocadaSemRef=true;
    }
  });

  if(!todasComAcao){
    if(silent) return { status:'skipped', reason:'peça(s) sem ação selecionada' };
    showNotification('⚠ Selecione uma ação para todas as peças');
    return;
  }
  if(algumaTrocadaSemRef){
    if(silent) return { status:'skipped', reason:'peça Trocada sem referência' };
    showNotification('⚠ Informe a referência das peças marcadas como Trocada');
    return;
  }

  let payload, nTrocadas;
  const btn = silent ? null : document.querySelector('.btn-preventiva');
  try{
    payload=pgpBuildPreventivaPayload(idx);
    nTrocadas=Object.values(payload.parts).filter(p=>p.acao==='trocada').length;
    pgpUpdateAdminLocal(payload);
  }catch(e){
    if(silent) return { status:'skipped', reason:'falha ao montar os dados' };
    showNotification('🚫 Falha ao montar os dados da preventiva. Nada foi enviado — tente novamente.');
    return;
  }

  const PAYLOAD_SIZE_LIMIT = 900000;
  const payloadSize = JSON.stringify(payload).length;
  if (payloadSize > PAYLOAD_SIZE_LIMIT) {
    const listSize=pgpGetPending();
    if(listSize.length >= QUEUE_LIMIT){
      if(silent) return { status:'error', error:'fila cheia (payload grande)' };
      showNotification('🚫 Muitas fotos/observações e fila cheia. Envie em partes ou libere espaço na fila.');
      return;
    }
    listSize.push({action:'savePreventiva',body:payload,signature:payload.visit_id,ts:Date.now()});
    const qResultSize = savePendingQueue(listSize);
    pgpUpdatePendingBadge();
    if(silent) return { status:'queued' };
    showNotification('⚠ Muitas fotos/observações — dados salvos na fila (' + qResultSize.count + '/' + QUEUE_LIMIT + '). Envie em partes ou reduza fotos.');
    return;
  }

  let _slow = null;
  if(btn){btn.disabled=true;btn.textContent='Enviando preventiva…';}
  if(!silent) _slow = setTimeout(function(){ if(btn) btn.textContent = 'Ainda enviando. Não feche a tela.'; }, 8000);

  if(!_pgpGsConnected){
    const list=pgpGetPending();
    if(list.length >= QUEUE_LIMIT){
      if(_slow) clearTimeout(_slow);
      if(btn){btn.disabled=false;btn.textContent='🔧 Registrar Preventiva';}
      if(silent) return { status:'error', error:'fila offline cheia' };
      showNotification('🚫 Fila offline cheia (' + list.length + '/' + QUEUE_LIMIT + ' itens). Conecte-se primeiro.');
      return;
    }
    list.push({action:'savePreventiva',body:payload,signature:payload.visit_id,ts:Date.now()});
    const qResult = savePendingQueue(list);
    pgpUpdatePendingBadge();
    if(_slow) clearTimeout(_slow);
    if(btn){btn.disabled=false;btn.textContent='🔧 Registrar Preventiva';}
    if(silent) return qResult.blocked ? { status:'error', error:'fila cheia' } : { status:'queued' };
    if(qResult.blocked){
      showNotification('🚫 Não foi possível salvar — fila cheia. Conecte-se primeiro.');
    } else {
      showNotification('📋 Preventiva salva na fila (' + qResult.count + '/' + QUEUE_LIMIT + ') — enviada ao conectar');
    }
    return;
  }

  try{
    const d = await pgpPostJson('savePreventiva', payload);
    if(d.duplicate){
      if(silent) return { status:'duplicate' };
      showNotification('ℹ Esta preventiva já foi registrada');
    } else if(d.status==='ok'){
      if(silent) return { status:'ok' };
      showNotification('✅ Preventiva registrada — '+nTrocadas+' peça(s) atualizada(s)');
      if(window._PGP_OS_ID){ pgpMostrarVoltarParaOS(); }
      else { pgpSetTipoVisita('inspecao'); }
    } else {
      throw new Error(d.error||'Erro desconhecido');
    }
  }catch(e){
    const list=pgpGetPending();
    if(list.length >= QUEUE_LIMIT){
      if(silent) return { status:'error', error:'falha no envio e fila cheia' };
      showNotification('🚫 Falha no envio e fila cheia. Conecte-se para liberar espaço.');
    } else {
      list.push({action:'savePreventiva',body:payload,signature:payload.visit_id,ts:Date.now()});
      const qResult = savePendingQueue(list);
      pgpUpdatePendingBadge();
      if(silent) return qResult.blocked ? { status:'error', error:'fila cheia' } : { status:'queued' };
      if(qResult.blocked){
        showNotification('🚫 Falha no envio e fila cheia. Conecte-se para liberar espaço.');
      } else {
        showNotification('⏳ Falha — preventiva salva na fila (' + qResult.count + '/' + QUEUE_LIMIT + ')');
      }
    }
  }finally{
    if(_slow) clearTimeout(_slow);
    if(btn){btn.disabled=false;btn.textContent='🔧 Registrar Preventiva';}
  }
}
```

---

### O que a refatoração faz (resumo de revisão)
- `pgpEnviarTodasPreventivas()`: se `machines.length<=1`, delega ao caminho legado. Senão, confirma com o técnico, faz `for i in 0..n-1` chamando `pgpEnviarPreventiva(i,{silent:true})`, agrega resultados (enviadas/fila/duplicadas/puladas) e mostra **um** aviso único + um `AppDialog.alert` listando as máquinas não registradas (dados incompletos). Side-effects (`pgpMostrarVoltarParaOS` / reset de tipo) rodam **uma vez** ao final.
- `pgpEnviarPreventiva(midx, opts)`: com `opts.silent`, cada retorno vira `{status:'ok'|'queued'|'duplicate'|'skipped'|'error', reason?/error?}` **sem** tocar botão/notificação/tipo. Sem `silent`, comportamento idêntico ao atual. Bônus: `hora_fim` agora é gravado em `m${idx}_hora_fim` (antes só `m0`), corrigindo hora_fim vazio nas máquinas 2..n em sessões de OS.

### Verificação (rodar antes de entregar)
1. `sed -n '6899,7038p'` some da versão antiga; `grep -n "pgpEnviarTodasPreventivas"` retorna a nova função + o `onclick`.
2. Extrair os 2 blocos `<script>` e rodar `node --check` em cada — devem passar.
3. `grep -c "onclick=\"pgpEnviarPreventiva()\""` = 0; `grep -c "onclick=\"pgpEnviarTodasPreventivas()\""` = 1.
4. Confirmar que `pgpEnviarPreventiva` continua sendo chamado só pelo orquestrador (grep).

### Entregáveis
- `PCF_index_v44.html` + `CHANGELOG_SPRINT_v44.md`.
### Deploy
- Publicar `PCF_index_v44.html` no GitHub Pages (repo ProperTech). **Sem alteração de GAS.**
