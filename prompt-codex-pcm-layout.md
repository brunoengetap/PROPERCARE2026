# Prompt para Codex — Reformulação de Layout do PCM_v28.html

> **Direção de design escolhida:** Industrial Mono Utility
> **Arquivo alvo:** `PCM_v28.html` (HTML monolítico com CSS e JS inline)
> **Escopo:** APENAS estrutura visual (HTML + CSS). **NÃO** alterar JavaScript, backend (Google Apps Script), lógica de negócio, modais, geração de PDF, filtros, cálculos ou nomes de funções.

---

## 1. Contexto

`PCM_v28.html` é um sistema de Planejamento e Controle de Manutenção (PCM) com ~6.615 linhas, composto por:

- **Header horizontal** com 7 botões de navegação principal: `Dashboard`, `Controle de Preventivas`, `Máquinas`, `Clientes`, `Estoque`, `Catálogo`, `Configurações`.
- **Sidebar secundária** (à esquerda) usada apenas em algumas views (`Catálogo` e `Clientes`) para listar modelos/clientes com busca e botão "Novo".
- **Área de conteúdo principal** com tabelas, cards, tabs internas e modais.
- Toda navegação chama a função global `showView('<nome>')`, que troca a view ativa por `display:none/block`.

O usuário sente que os botões horizontais não passam profissionalismo e que os itens não estão agrupados por afinidade funcional.

---

## 2. Objetivo

Reformular **somente a estrutura visual** para:

1. Mover a navegação principal do header para uma **sidebar vertical fixa à esquerda**.
2. **Agrupar os 7 itens em 3 grupos funcionais**:
   - **OPERAÇÃO** — Dashboard, Controle de Preventivas, Máquinas, Clientes, Estoque
   - **CADASTROS** — Catálogo
   - **SISTEMA** — Configurações
3. Aplicar a estética **Industrial Mono Utility**: alta densidade, monocromático escuro na nav, foco em utilidade técnica, acento em teal.
4. Manter a sidebar secundária (lista de modelos/clientes) onde já existe, apenas restilizando.
5. Header enxuto: breadcrumb sutil + busca + badge + avatar. Sem botões de navegação.

---

## 3. Restrições rígidas (não negociáveis)

- ❌ **NÃO renomear** nenhuma função JS: `showView`, `renderSidebar`, `selectModel`, `loadData`, etc.
- ❌ **NÃO alterar** os parâmetros passados a `showView(...)` — cada botão novo deve chamar exatamente o mesmo `showView('<x>')` que o botão antigo equivalente.
- ❌ **NÃO mexer** em: backend GAS, modais, geração de PDF, filtros, cálculos, tabs internas das views, listeners, fetch/google.script.run.
- ❌ **NÃO remover** IDs de elementos que o JS consulta (`getElementById`). Se precisar mover um elemento, preserve o `id`.
- ❌ **NÃO** introduzir bibliotecas externas além do Google Fonts.
- ✅ Pode reescrever o CSS de layout/cores/tipografia livremente.
- ✅ Pode reescrever ~50 linhas de markup da navegação (header + nova sidebar).
- ✅ Pode adicionar ícones SVG inline monocromáticos (16x16, `stroke: currentColor`, `stroke-width: 1.5`).

---

## 4. Plano de execução obrigatório

Execute nessa ordem:

### Passo 1 — Backup
Copie `PCM_v28.html` para `PCM_v28.backup.html` antes de qualquer edição.

### Passo 2 — Mapeamento
Localize no HTML atual TODOS os botões de navegação do header. Para cada um, anote:
- Texto visível
- A chamada exata de `showView(...)` (ou outro handler)
- Quaisquer `id`, `class`, `data-*` ou listeners adicionais

Monte uma tabela como esta (preencha você mesmo lendo o arquivo):

| Botão antigo | Handler exato | Grupo novo |
|---|---|---|
| Dashboard | `showView('dashboard')` | OPERAÇÃO |
| Controle de Preventivas | `showView('preventivas')` | OPERAÇÃO |
| Máquinas | `showView('maquinas')` | OPERAÇÃO |
| Clientes | `showView('clientes')` | OPERAÇÃO |
| Estoque | `showView('estoque')` | OPERAÇÃO |
| Catálogo | `showView('catalogo')` | CADASTROS |
| Configurações | `showView('configuracoes')` | SISTEMA |

> ⚠️ Os nomes acima são suposições. **Use os valores reais encontrados no arquivo.**

### Passo 3 — Tokens CSS e fontes
Adicione no `<head>`:

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
```

No `<style>` (no topo, antes do CSS existente que for substituído):

```css
:root {
  --sidebar-bg: #09090b;
  --sidebar-fg: #a1a1aa;
  --sidebar-fg-active: #fafafa;
  --sidebar-hover: rgba(255,255,255,.04);
  --sidebar-active: rgba(255,255,255,.06);
  --sidebar-group: #52525b;
  --accent: #0d9488;
  --accent-hover: #0f766e;
  --bg: #f4f4f5;
  --surface: #fafafa;
  --surface-2: #ffffff;
  --border: rgba(0,0,0,.06);
  --border-strong: rgba(0,0,0,.10);
  --text: #18181b;
  --text-muted: #71717a;
  --radius: 12px;
  --radius-sm: 6px;
  --transition: 120ms ease;
  --font-sans: 'Inter', system-ui, -apple-system, sans-serif;
  --font-mono: 'JetBrains Mono', ui-monospace, monospace;
  --nav-w: 220px;
  --header-h: 56px;
}

html, body { font-family: var(--font-sans); background: var(--bg); color: var(--text); }
```

### Passo 4 — Estrutura do shell
Substitua o header antigo + abertura da área de conteúdo pela seguinte estrutura. **Preserve todos os elementos internos** (modais, views, sidebar secundária) — apenas envolva-os neste shell.

```html
<aside class="nav-sidebar" aria-label="Navegação principal">
  <div class="nav-brand">
    <span class="nav-brand-mark">PCM</span>
    <span class="nav-brand-sub">v28</span>
  </div>

  <nav class="nav-groups">
    <div class="nav-group">
      <div class="nav-group-label">OPERAÇÃO</div>
      <button class="nav-item" data-view="dashboard" onclick="showView('dashboard')">
        <svg class="nav-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="2" width="5" height="5"/><rect x="9" y="2" width="5" height="5"/><rect x="2" y="9" width="5" height="5"/><rect x="9" y="9" width="5" height="5"/></svg>
        <span>Dashboard</span>
      </button>
      <button class="nav-item" data-view="preventivas" onclick="showView('preventivas')">
        <svg class="nav-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="8" cy="8" r="6"/><path d="M8 4v4l2.5 2.5"/></svg>
        <span>Preventivas</span>
      </button>
      <button class="nav-item" data-view="maquinas" onclick="showView('maquinas')">
        <svg class="nav-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="5" width="12" height="8" rx="1"/><path d="M5 5V3h6v2M5 13v1M11 13v1"/></svg>
        <span>Máquinas</span>
      </button>
      <button class="nav-item" data-view="clientes" onclick="showView('clientes')">
        <svg class="nav-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="8" cy="6" r="3"/><path d="M2 14c0-3 2.5-5 6-5s6 2 6 5"/></svg>
        <span>Clientes</span>
      </button>
      <button class="nav-item" data-view="estoque" onclick="showView('estoque')">
        <svg class="nav-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M2 5l6-3 6 3v6l-6 3-6-3V5z"/><path d="M2 5l6 3 6-3M8 8v7"/></svg>
        <span>Estoque</span>
      </button>
    </div>

    <div class="nav-group">
      <div class="nav-group-label">CADASTROS</div>
      <button class="nav-item" data-view="catalogo" onclick="showView('catalogo')">
        <svg class="nav-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="2" width="12" height="12" rx="1"/><path d="M5 5h6M5 8h6M5 11h4"/></svg>
        <span>Catálogo</span>
      </button>
    </div>

    <div class="nav-group nav-group-bottom">
      <div class="nav-group-label">SISTEMA</div>
      <button class="nav-item" data-view="configuracoes" onclick="showView('configuracoes')">
        <svg class="nav-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="8" cy="8" r="2.5"/><path d="M8 1v2M8 13v2M1 8h2M13 8h2M3 3l1.5 1.5M11.5 11.5L13 13M3 13l1.5-1.5M11.5 4.5L13 3"/></svg>
        <span>Configurações</span>
      </button>
    </div>
  </nav>
</aside>

<div class="app-main">
  <header class="app-header">
    <div class="breadcrumb">PCM <span class="sep">/</span> <span id="breadcrumb-current">Dashboard</span></div>
    <div class="header-actions">
      <input type="search" class="header-search" placeholder="Buscar..." />
      <!-- preservar aqui badges/avatares/itens existentes, se houver -->
    </div>
  </header>

  <main class="app-content">
    <!-- AQUI ficam TODAS as views existentes, sidebar secundária inclusa, sem alteração de IDs -->
  </main>
</div>
```

> ⚠️ Se o header antigo tinha elementos auxiliares (status de conexão, usuário logado, notificações), **mova-os para `.header-actions`** preservando seus `id` e listeners.

### Passo 5 — CSS do shell

```css
body { margin: 0; }

.nav-sidebar {
  position: fixed; top: 0; left: 0; bottom: 0;
  width: var(--nav-w);
  background: var(--sidebar-bg);
  color: var(--sidebar-fg);
  display: flex; flex-direction: column;
  padding: 16px 0;
  z-index: 100;
  border-right: 1px solid rgba(255,255,255,.04);
}
.nav-brand {
  padding: 0 16px 16px;
  display: flex; align-items: baseline; gap: 6px;
  border-bottom: 1px solid rgba(255,255,255,.04);
  margin-bottom: 12px;
}
.nav-brand-mark { font-family: var(--font-mono); font-weight: 600; color: #fafafa; letter-spacing: .05em; }
.nav-brand-sub { font-family: var(--font-mono); font-size: 11px; color: var(--sidebar-group); }

.nav-groups { display: flex; flex-direction: column; gap: 8px; flex: 1; overflow-y: auto; }
.nav-group { display: flex; flex-direction: column; }
.nav-group-bottom { margin-top: auto; }
.nav-group-label {
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: .12em;
  color: var(--sidebar-group);
  padding: 8px 16px 4px;
}

.nav-item {
  all: unset;
  display: flex; align-items: center; gap: 10px;
  padding: 8px 16px;
  font-size: 13px;
  color: var(--sidebar-fg);
  cursor: pointer;
  transition: background var(--transition), color var(--transition);
  border-left: 2px solid transparent;
}
.nav-item:hover { background: var(--sidebar-hover); color: var(--sidebar-fg-active); }
.nav-item.is-active {
  background: var(--sidebar-active);
  color: var(--sidebar-fg-active);
  border-left-color: var(--accent);
}
.nav-icon { width: 16px; height: 16px; flex-shrink: 0; }

.app-main { margin-left: var(--nav-w); min-height: 100vh; display: flex; flex-direction: column; }

.app-header {
  height: var(--header-h);
  background: var(--surface);
  border-bottom: 1px solid var(--border);
  display: flex; align-items: center; justify-content: space-between;
  padding: 0 24px;
  position: sticky; top: 0; z-index: 50;
}
.breadcrumb { font-size: 13px; color: var(--text-muted); font-family: var(--font-mono); }
.breadcrumb .sep { margin: 0 6px; opacity: .5; }
.breadcrumb #breadcrumb-current { color: var(--text); }
.header-actions { display: flex; align-items: center; gap: 12px; }
.header-search {
  width: 240px; height: 32px;
  padding: 0 10px; font-size: 13px;
  background: var(--bg); border: 1px solid var(--border);
  border-radius: var(--radius-sm); outline: none;
  transition: border-color var(--transition);
}
.header-search:focus { border-color: var(--accent); }

.app-content { padding: 24px; flex: 1; }

/* Cards e painéis existentes — restilizar genericamente */
.card, .panel, .box {
  background: var(--surface);
  border-radius: var(--radius);
  box-shadow: inset 0 0 0 1px var(--border);
  padding: 16px;
}

/* Sidebar secundária (modelos/clientes) — manter funcional, restilizar */
.sidebar-secondary {
  background: var(--surface-2);
  border-right: 1px solid var(--border);
  width: 260px;
}
```

> Adapte os seletores `.card/.panel/.box/.sidebar-secondary` aos nomes reais usados no arquivo.

### Passo 6 — Sincronizar estado ativo da nav
Adicione um pequeno wrapper que marca o `.nav-item` ativo e atualiza o breadcrumb **sem alterar `showView`**:

```html
<script>
(function() {
  const _origShowView = window.showView;
  const labels = {
    dashboard: 'Dashboard',
    preventivas: 'Controle de Preventivas',
    maquinas: 'Máquinas',
    clientes: 'Clientes',
    estoque: 'Estoque',
    catalogo: 'Catálogo',
    configuracoes: 'Configurações'
  };
  window.showView = function(view) {
    const r = _origShowView ? _origShowView.apply(this, arguments) : undefined;
    document.querySelectorAll('.nav-item').forEach(b => {
      b.classList.toggle('is-active', b.dataset.view === view);
    });
    const bc = document.getElementById('breadcrumb-current');
    if (bc && labels[view]) bc.textContent = labels[view];
    return r;
  };
})();
</script>
```

> Ajuste o mapa `labels` aos nomes reais de view encontrados no Passo 2.

### Passo 7 — Validação manual obrigatória
Antes de finalizar, percorra esta checklist abrindo o arquivo no navegador:

- [ ] Clicar em cada item da nav-sidebar troca a view corretamente.
- [ ] O item clicado fica visualmente ativo (borda esquerda teal).
- [ ] O breadcrumb atualiza.
- [ ] Sidebar secundária (modelos/clientes) continua renderizando e funcional em Catálogo e Clientes.
- [ ] Modais abrem normalmente.
- [ ] Geração de PDF funciona.
- [ ] Filtros, buscas e tabs internas funcionam.
- [ ] `console` sem erros novos.
- [ ] Nenhum `id` referenciado por `getElementById` foi removido (busque por `getElementById\(` e confira cada um).

---

## 5. Critérios de aceitação

1. Navegação 100% vertical à esquerda, agrupada em OPERAÇÃO / CADASTROS / SISTEMA.
2. Estética Industrial Mono Utility aplicada (sidebar #09090b, acento teal, Inter + JetBrains Mono).
3. Header reduzido a 56px com breadcrumb + busca + ações.
4. Zero alteração funcional. Diff do JS limitado ao wrapper de `showView` do Passo 6.
5. `PCM_v28.backup.html` preservado.

---

## 6. Entregáveis

- `PCM_v28.html` atualizado.
- `PCM_v28.backup.html` (backup intocado).
- Resumo curto (máx. 10 linhas) listando: arquivos modificados, mapa antigo→novo dos botões, e qualquer ID/seletor preservado que tenha sido renomeado de classe.

---

## 7. O Codex consegue?

**Sim, com alta confiança**, desde que:

- Tenha acesso direto ao arquivo `PCM_v28.html` para ler e editar (não apenas descrição).
- Execute o **Passo 2 (Mapeamento)** lendo o arquivo real antes de gerar o HTML novo — não pode chutar os nomes de view.
- Respeite a regra de NÃO renomear funções e NÃO mexer no JS além do wrapper do Passo 6.

**Riscos a vigiar:**
- Codex pode ser tentado a "limpar" CSS antigo que ainda é referenciado por classes em modais → instrua-o a remover apenas o CSS do header/nav antigo, mantendo o restante.
- Se houver listeners adicionados via `addEventListener` nos botões antigos (não inline), o Codex precisa reanexá-los nos novos botões. Pedir para ele buscar por `addEventListener` nos botões do header antes de removê-los.
- Se `showView` não for global (ex.: dentro de IIFE), o wrapper do Passo 6 precisa ser injetado no mesmo escopo. Instrua-o a verificar.

Com este prompt seguido literalmente, o resultado deve sair em uma única rodada.
