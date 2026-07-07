# Codex — PCF `PCF_index_v44.html` → `PCF_index_v45.html`
## Concern único: o card verde "máquina carregada" tem de seguir a aba ativa e ser resetado em nova coleta

### Contexto (causa-raiz confirmada por auditoria)
O card verde `#pgpLoadedCard` (com "✕ Limpar") é um **único elemento global**. Seu conteúdo é escrito apenas dentro de `pgpLoadMachine` (o último `pgpLoadMachine` chamado vence). Dois defeitos:
1. **`switchMachine(idx)` não re-renderiza o card** → ao trocar de aba, o card continua mostrando a última máquina carregada, não a da aba ativa (foi assim que um "Chiaperini Copa 20HP — Fundição São Cristóvão" ficou aparecendo embaixo da aba SRP3010 da SORRAG).
2. **`novaColeta()` não reseta** `_pgpLoadedMachine` / `_pgpLoadedMachinesByIndex` nem esconde o card → a máquina de uma OS anterior persiste ao iniciar uma coleta nova.

O estado por índice já existe (`_pgpLoadedMachinesByIndex[idx]`, escrito por `pgpSetLoadedMachineForIndex` dentro de `pgpLoadMachine` na L6137). A correção extrai a renderização do card para um helper e o chama nos pontos certos.

### Invariantes (NÃO violar)
- Não renomear IDs/data-keys/funções (`VIEW_ID_OVERRIDES`). O helper novo é `pgpRenderLoadedCard`.
- Reaproveita `renderMachineHistory`/`fetchMachineHistory` já existentes.
- Changelog dentro do HTML: **não usar `--`** no texto do comentário.

---

### EDIÇÃO 1 — criar o helper `pgpRenderLoadedCard`
Inserir esta função **logo após** `pgpGetLoadedMachineForIndex` (que termina na L5328, antes do bloco `// ── FILA DE PENDÊNCIAS`):

```javascript
// v45 — card da máquina carregada como função reutilizável: reflete
// _pgpLoadedMachinesByIndex[idx] e é chamada tanto na carga quanto na troca de aba.
function pgpRenderLoadedCard(midx=currentMachine){
  const idx = pgpGetMachineIndex(midx);
  const eq = _pgpLoadedMachinesByIndex[idx] || null;
  const card = document.getElementById('pgpLoadedCard');
  const info = document.getElementById('pgpLoadedInfo');
  const histEl = document.getElementById('machineHistoryPanel');
  if(!card) return;
  if(!eq){
    card.classList.remove('show');
    if(histEl) histEl.style.display = 'none';
    return;
  }
  if(info){
    info.innerHTML =
      `${eq.brand||''} ${eq.model||''} — ${eq.client||''}<small>Série: ${eq.serial||'—'} · TAG: ${eq.tag||'—'} · ${(eq.hourTotal||0).toLocaleString('pt-BR')}h</small>`;
  }
  card.classList.add('show');
  renderMachineHistory(null, true);
  fetchMachineHistory(eq.id || eq.machine_id || '').then(hist => renderMachineHistory(hist, false));
}
```

---

### EDIÇÃO 2 — usar o helper dentro de `pgpLoadMachine` (bloco do card, ~L6231–6244)
**Localizar exatamente:**
```javascript
  const card=document.getElementById('pgpLoadedCard');
  document.getElementById('pgpLoadedInfo').innerHTML=
    `${eq.brand} ${eq.model} — ${eq.client}<small>Série: ${eq.serial||'—'} · TAG: ${eq.tag||'—'} · ${(eq.hourTotal||0).toLocaleString('pt-BR')}h</small>`;
  card.classList.add('show');
  document.querySelectorAll('[data-section]').forEach(s=>refreshSection(s));
  updateProgress(); updateAllTabNames();
  // v8.4.4 — destacar campos faltantes e campos variáveis após carga
  setTimeout(()=>{
    pgpHighlightMissingClientFields(idx);
    pgpMarkDynamicFieldsForUpdate(idx);
  }, 100);

  renderMachineHistory(null, true);
  fetchMachineHistory(eq.id || eq.machine_id || '').then(hist => renderMachineHistory(hist, false));
```
**Substituir por:**
```javascript
  pgpRenderLoadedCard(idx);
  document.querySelectorAll('[data-section]').forEach(s=>refreshSection(s));
  updateProgress(); updateAllTabNames();
  // v8.4.4 — destacar campos faltantes e campos variáveis após carga
  setTimeout(()=>{
    pgpHighlightMissingClientFields(idx);
    pgpMarkDynamicFieldsForUpdate(idx);
  }, 100);
```
(A renderização do histórico agora mora dentro de `pgpRenderLoadedCard`, por isso as 2 últimas linhas saem daqui.)

---

### EDIÇÃO 3 — `switchMachine(idx)` passa a re-renderizar o card (~L3007–3017)
**Localizar:**
```javascript
  document.getElementById('machineCounter').textContent = 'Máquina '+(idx+1)+' de '+machines.length;
  updateProgress();
  checkDone();
}
```
**Substituir por:**
```javascript
  document.getElementById('machineCounter').textContent = 'Máquina '+(idx+1)+' de '+machines.length;
  pgpRenderLoadedCard(idx);
  updateProgress();
  checkDone();
}
```
(Atenção: esse trecho `updateProgress();\n  checkDone();\n}` também aparece dentro de `switchMachine` apenas — confirme que a substituição atinge só `switchMachine`. Se o `str_replace` acusar múltiplas ocorrências, use como âncora o bloco de 3 linhas iniciando em `document.getElementById('machineCounter').textContent`, que é único de `switchMachine`.)

---

### EDIÇÃO 4 — resetar estado de máquina carregada em `novaColeta()` (~L3701–3703)
**Localizar:**
```javascript
  document.querySelectorAll('.machine-panel').forEach(p => p.remove());
  machines = [{}];
  currentMachine = 0;
  Object.keys(photoStore).forEach(k => delete photoStore[k]); // v23: limpar fotos da coleta anterior
```
**Substituir por:**
```javascript
  document.querySelectorAll('.machine-panel').forEach(p => p.remove());
  machines = [{}];
  currentMachine = 0;
  // v45 — limpar máquina(s) carregada(s) da coleta/OS anterior, senão o card verde
  // continua exibindo uma máquina de outro cliente na nova coleta.
  _pgpLoadedMachine = null;
  _pgpLoadedMachinesByIndex = {};
  pgpRenderLoadedCard(0);
  Object.keys(photoStore).forEach(k => delete photoStore[k]); // v23: limpar fotos da coleta anterior
```

---

### Verificação (rodar antes de entregar)
1. `grep -n "pgpRenderLoadedCard" PCF_index_v45.html` → 4 ocorrências (definição + pgpLoadMachine + switchMachine + novaColeta).
2. `grep -c "getElementById('pgpLoadedInfo').innerHTML" PCF_index_v45.html` → deve cair para 1 (só dentro do helper).
3. Extrair os 2 blocos `<script>` e rodar `node --check` em cada — devem passar.
4. Sanidade: a única escrita de `_pgpLoadedMachinesByIndex` continua sendo `pgpSetLoadedMachineForIndex`; o helper apenas lê.

### Entregáveis
- `PCF_index_v45.html` + `CHANGELOG_SPRINT_v45.md`.
### Deploy
- Publicar no GitHub Pages (repo ProperTech). **Sem alteração de GAS.**
