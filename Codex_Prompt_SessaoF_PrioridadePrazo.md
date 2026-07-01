# Prompt Codex — ProperHub Sessão F
## Priorização de OS por prioridade e prazo (100% frontend)

---

## 0. Contexto do projeto

ProperHub — sistema de gestão de campo para manutenção de compressores (Proper
Compressores). Esta sessão toca **apenas o PCM** (`PCM_vNN.html`) — painel admin
desktop. **Nenhuma alteração no GAS é necessária nesta sessão.**

Os arquivos de entrada estão na raiz do repositório. Identifique a versão mais
recente pelo nome do arquivo.

---

## 1. Descoberta importante (motivo desta sessão ser só frontend)

Auditando o backend (`GAS_properCare_vNN.js`, função `saveOS`), os campos
`prioridade` e `data_prevista` **já existem no schema da planilha `ORDENS_SERVICO`
e já são aceitos tanto na criação quanto na edição** (ambos estão na lista
`ALLOWED` de campos editáveis de `saveOS`). Só nunca ganharam nenhuma interface no
PCM — não há campo no modal de criação/edição de OS, não há coluna na listagem, e
não há filtro ou ordenação por eles. Esta sessão preenche essa lacuna de UI, sem
precisar tocar no backend.

---

## 2. Objetivo desta sessão

1. Adicionar campos de **prioridade** e **prazo (data prevista)** ao modal de
   criação/edição de OS.
2. Exibir esses dois campos na listagem de OS (`_renderOSTable`), com:
   - Coluna de prioridade com badge colorido.
   - Coluna de prazo, com destaque visual quando a OS está **atrasada** (prazo já
     passou e o status não é `CONCLUIDA`/`CANCELADA`).
   - A lista passa a vir **ordenada por padrão** colocando as OS mais urgentes e
     mais atrasadas no topo (sem precisar de nenhum controle de ordenação novo na
     UI — só muda a ordem em que os itens já filtrados são exibidos).
   - Um filtro adicional por prioridade, ao lado do filtro de status que já existe.

---

## 3. Regras gerais

- **Modificações cirúrgicas.** Não reescreva blocos que já funcionam.
- **Audite antes de escrever.** Rode `grep -n` para confirmar nomes exatos antes de
  editar, caso o conteúdo real divirja do descrito aqui.
- Use **"usuário"**, nunca "técnico", em texto novo de UI.
- Escala de prioridade a usar, do menos ao mais urgente: `normal`, `alta`,
  `urgente`.

---

## 4. PARTE ÚNICA — PCM (`PCM_vNN.html`)

### 4.1 — Modal de OS: novos campos

Localize o modal `id="modalOS"`. Dentro dele, encontre o bloco:

```html
      <div class="form-row">
        <label class="form-label">Status</label>
        <select class="form-select" id="osStatus">
          <option value="ABERTA">Aberta</option>
          <option value="EM_ANDAMENTO">Em andamento</option>
          <option value="CONCLUIDA">Concluída</option>
          <option value="CANCELADA">Cancelada</option>
        </select>
      </div>
      <div class="form-row">
        <label class="form-label">Data de abertura</label>
        <input class="form-input" type="date" id="osDataAbertura">
      </div>
```

Adicione, logo após o bloco de "Data de abertura" (mesmo padrão visual
`class="form-row"`):

```html
      <div class="form-row">
        <label class="form-label">Prioridade</label>
        <select class="form-select" id="osPrioridade">
          <option value="normal">Normal</option>
          <option value="alta">Alta</option>
          <option value="urgente">Urgente</option>
        </select>
      </div>
      <div class="form-row">
        <label class="form-label">Prazo (data prevista) <span style="font-weight:400;color:var(--text-muted)">opcional</span></label>
        <input class="form-input" type="date" id="osDataPrevista">
      </div>
```

### 4.2 — `openModalOS`: popular os novos campos

Localize `openModalOS(id)`. No trecho que limpa os campos para uma OS nova
(procure por `document.getElementById('osDataAbertura').value = new Date()...`),
adicione:

```js
  document.getElementById('osPrioridade').value = 'normal';
  document.getElementById('osDataPrevista').value = '';
```

No trecho que popula os campos ao editar uma OS existente (procure por
`if (os.data_abertura) document.getElementById('osDataAbertura').value = ...`),
adicione logo após:

```js
    document.getElementById('osPrioridade').value = os.prioridade || 'normal';
    if (os.data_prevista) document.getElementById('osDataPrevista').value = os.data_prevista.slice(0,10);
```

### 4.3 — `saveOSModal`: ler e enviar os novos campos

Localize `saveOSModal()`. No bloco de leitura de campos (junto com `const data = ...`,
`const usuario = ...`), adicione:

```js
  const prioridade    = document.getElementById('osPrioridade').value.trim();
  const dataPrevista  = document.getElementById('osDataPrevista').value.trim();
```

No objeto `payload` enviado ao GAS, adicione as duas chaves:

```js
  const payload = {
    action: 'saveOS',
    numero_os: numero,
    cliente,
    id_cliente: clienteId,
    tipo_os: tipo,
    descricao,
    status,
    data_abertura: data,
    usuario_atual: usuario,
    prioridade,
    data_prevista: dataPrevista,
  };
```

### 4.4 — `_renderOSTable`: colunas, badge, filtro e ordenação

Localize `_renderOSTable(search, statusFilter)`. Adicione um segundo parâmetro
`priorityFilter` (com valor padrão `''`), e aplique o filtro adicional junto aos já
existentes:

```js
function _renderOSTable(search = '', statusFilter = '', priorityFilter = '') {
```

Localize o bloco de filtragem:

```js
  let items = _osList;
  if (search)       items = items.filter(o =>
    (o.numero_os||'').toLowerCase().includes(search.toLowerCase()) ||
    (o.cliente  ||'').toLowerCase().includes(search.toLowerCase()));
  if (statusFilter) items = items.filter(o =>
    (o.status||'').toUpperCase() === statusFilter);
```

Substitua por (adiciona o filtro de prioridade e a ordenação padrão por
urgência/atraso):

```js
  let items = _osList;
  if (search)       items = items.filter(o =>
    (o.numero_os||'').toLowerCase().includes(search.toLowerCase()) ||
    (o.cliente  ||'').toLowerCase().includes(search.toLowerCase()));
  if (statusFilter) items = items.filter(o =>
    (o.status||'').toUpperCase() === statusFilter);
  if (priorityFilter) items = items.filter(o =>
    (o.prioridade||'normal').toLowerCase() === priorityFilter);

  const RANK_PRIORIDADE = { urgente: 3, alta: 2, normal: 1 };
  const hoje = new Date(); hoje.setHours(0,0,0,0);
  const isAtrasada = o => {
    if (!o.data_prevista) return false;
    const st = String(o.status||'').toUpperCase();
    if (st === 'CONCLUIDA' || st === 'CANCELADA') return false;
    const prazo = new Date(o.data_prevista);
    prazo.setHours(0,0,0,0);
    return prazo.getTime() < hoje.getTime();
  };
  items = [...items].sort((a, b) => {
    const atrasoA = isAtrasada(a) ? 1 : 0, atrasoB = isAtrasada(b) ? 1 : 0;
    if (atrasoA !== atrasoB) return atrasoB - atrasoA; // atrasadas primeiro
    const rankA = RANK_PRIORIDADE[(a.prioridade||'normal').toLowerCase()] || 1;
    const rankB = RANK_PRIORIDADE[(b.prioridade||'normal').toLowerCase()] || 1;
    if (rankA !== rankB) return rankB - rankA; // mais urgente primeiro
    return 0; // mantém ordem original entre iguais
  });
```

Localize o `<select>` de filtro de status:

```html
      <select style="height:32px;padding:0 8px;font-size:12px;border:1px solid var(--border2);
        border-radius:var(--radius-sm);background:white;font-family:var(--font-sans)"
        onchange="_osFilterStatus=this.value;_renderOSTable(_osSearch,this.value)">
        <option value="">Todos os status</option>
        <option value="ABERTA" ${statusFilter==='ABERTA'?'selected':''}>Aberta</option>
        <option value="EM_ANDAMENTO" ${statusFilter==='EM_ANDAMENTO'?'selected':''}>Em andamento</option>
        <option value="CONCLUIDA" ${statusFilter==='CONCLUIDA'?'selected':''}>Concluída</option>
        <option value="CANCELADA" ${statusFilter==='CANCELADA'?'selected':''}>Cancelada</option>
      </select>
```

Ajuste o `onchange` para repassar o filtro de prioridade também, e adicione um
segundo `<select>` logo após:

```html
      <select style="height:32px;padding:0 8px;font-size:12px;border:1px solid var(--border2);
        border-radius:var(--radius-sm);background:white;font-family:var(--font-sans)"
        onchange="_osFilterStatus=this.value;_renderOSTable(_osSearch,this.value,_osFilterPrioridade)">
        <option value="">Todos os status</option>
        <option value="ABERTA" ${statusFilter==='ABERTA'?'selected':''}>Aberta</option>
        <option value="EM_ANDAMENTO" ${statusFilter==='EM_ANDAMENTO'?'selected':''}>Em andamento</option>
        <option value="CONCLUIDA" ${statusFilter==='CONCLUIDA'?'selected':''}>Concluída</option>
        <option value="CANCELADA" ${statusFilter==='CANCELADA'?'selected':''}>Cancelada</option>
      </select>
      <select style="height:32px;padding:0 8px;font-size:12px;border:1px solid var(--border2);
        border-radius:var(--radius-sm);background:white;font-family:var(--font-sans)"
        onchange="_osFilterPrioridade=this.value;_renderOSTable(_osSearch,_osFilterStatus,this.value)">
        <option value="">Todas as prioridades</option>
        <option value="normal" ${priorityFilter==='normal'?'selected':''}>Normal</option>
        <option value="alta" ${priorityFilter==='alta'?'selected':''}>Alta</option>
        <option value="urgente" ${priorityFilter==='urgente'?'selected':''}>Urgente</option>
      </select>
```

> Declare a variável global `_osFilterPrioridade` (inicializada como `''`) próxima
> de onde `_osFilterStatus`/`_osSearch` já são declaradas — confirme via grep o
> ponto exato.

Localize o cabeçalho da tabela:

```html
        <thead><tr>
          <th>Nº OS</th><th>Cliente</th><th>Tipo</th>
          <th>Abertura</th><th>Status</th><th style="text-align:right">Ações</th>
        </tr></thead>
```

Substitua por (2 colunas novas, entre "Tipo" e "Status"):

```html
        <thead><tr>
          <th>Nº OS</th><th>Cliente</th><th>Tipo</th>
          <th>Prioridade</th><th>Prazo</th>
          <th>Abertura</th><th>Status</th><th style="text-align:right">Ações</th>
        </tr></thead>
```

Localize o corpo de cada linha (dentro do `.map(o => {...})`), logo antes da célula
de Status. Adicione a lógica de badge de prioridade e célula de prazo:

```js
            const st = STATUS_LABELS[String(o.status||'').toUpperCase()] ||
              { label: o.status||'—', cls:'status-na' };
            const data = o.data_abertura
              ? new Date(o.data_abertura).toLocaleDateString('pt-BR') : '—';
            const oid = (o.id_os||'').replace(/'/g,"\\'");
```

Adicione, logo após essas linhas (ainda dentro do mesmo `.map`):

```js
            const PRIORIDADE_BADGE = {
              urgente: { label: 'Urgente', bg: '#fee2e2', color: '#991b1b' },
              alta:    { label: 'Alta',    bg: '#ffedd5', color: '#9a3412' },
              normal:  { label: 'Normal',  bg: '#f1f5f9', color: '#475569' },
            };
            const prio = PRIORIDADE_BADGE[(o.prioridade||'normal').toLowerCase()] || PRIORIDADE_BADGE.normal;
            const atrasada = isAtrasada(o);
            const prazoStr = o.data_prevista ? new Date(o.data_prevista).toLocaleDateString('pt-BR') : '—';
```

E adicione as duas células no template da linha (`<td>...`), entre a célula de
"Tipo" e a célula de "Status":

```html
              <td><span style="font-size:11px;font-weight:600;padding:2px 8px;border-radius:10px;background:${prio.bg};color:${prio.color}">${prio.label}</span></td>
              <td style="font-size:11px;${atrasada ? 'color:#dc2626;font-weight:700' : ''}">${prazoStr}${atrasada ? ' ⚠' : ''}</td>
```

> Confirme via grep a estrutura exata do `.map(o => { ... return `<tr>...` })`
> antes de inserir — a ordem das colunas no `<thead>` precisa bater exatamente com
> a ordem das células `<td>` no corpo.

---

## 5. Checklist de verificação

- [ ] Modal de OS tem os campos `osPrioridade` (select) e `osDataPrevista` (date).
- [ ] `openModalOS` limpa/popula os dois campos corretamente (nova OS = `normal` +
      vazio; edição = valores da OS).
- [ ] `saveOSModal` envia `prioridade` e `data_prevista` no payload.
- [ ] `_renderOSTable` aceita o terceiro parâmetro `priorityFilter` sem quebrar as
      chamadas existentes que só passavam 2 argumentos (parâmetro tem valor
      padrão).
- [ ] Filtro de prioridade funciona e não quebra o filtro de status/busca já
      existentes (todos combináveis).
- [ ] Tabela mostra as OS ordenadas com atrasadas primeiro, depois por prioridade
      decrescente — sem exigir nenhum clique extra do usuário.
- [ ] OS atrasada (prazo passado, status não concluído/cancelado) aparece com
      destaque visual (texto vermelho + ⚠) na coluna de prazo.
- [ ] Cabeçalho da tabela (`<thead>`) e células de cada linha (`<td>`) estão na
      mesma ordem — sem colunas desalinhadas.
- [ ] Nenhuma alteração no GAS.
- [ ] Nenhum arquivo de entrada sobrescrito — saída em arquivo novo versionado.
- [ ] Nenhuma ocorrência nova de "técnico" em texto de UI.

---

## 6. Entrega esperada

- `PCM_v{NN+1}.html`
- Resumo das funções/linhas alteradas, para auditoria antes de subir pra produção.
