// GAS_properCare_v35.js
// v35 — Sprint: Fix sessão + Renomeação Técnico→Usuário
//   PARTE A: getSS_() — evita handle desatualizado após ociosidade (bug "usuários somem")
//   PARTE B: derivarPrefixoUsuario_() + migrarTecnicosParaUsuarios() (rodar 1x no editor)
//   PARTE C: CAT_TECNICOS→CAT_USUARIOS, getTecnicos→getUsuarios, saveTecnico→saveUsuario,
//            loginTecnicoHub→loginUsuarioHub, seedTecnicosDefault→seedUsuariosDefault.
//            Aliases de backward-compat mantidos; remover após Sessões 2/3.
// v33 — Sprint 4F: Fix Pipeline não instanciado
//   - saveOS CREATE: retorna id_os no topo do objeto (result.id_os) para que o
//     PCM possa instanciar o pipeline automaticamente após criar a OS
// v32 — Sprint 4F-A: multi-usuário por e-mail
//   - loginTecnicoHub Modo A: consulta por e-mail (sem pin_hash) → retorna pin_direto ou selecao
//   - loginTecnicoHub Modo B: valida PIN cruzando id_tecnico + pin_hash (não só pin_hash)
// v31 — Sprint 4F-A: base para ProperHub + GAS
// v30 — Bugfixes Sprint 4E
//   - saveOS CREATE: tipo_os aceita qualquer Tipo_ID (remove restrição TIPOS_VALIDOS legados)
//   - saveOS CREATE: descricao não é mais obrigatório (default '')
//   - saveOS UPDATE: tipo_os e numero_os adicionados ao ALLOWED (editáveis)
// v29 — Sprint 4E-A ProperFlow
//   - 5 novas abas Sheets: PIPELINE_TEMPLATES, PIPELINE_TAREFAS, PIPELINE_NOTIF, CAT_TIPOS_OS, FORMULARIOS
//   - 12 novas funções ProperFlow: getPipelineByOS, updateTarefaStatus, autoCompletarTarefa,
//     getTemplates, saveTemplate, instanciarPipeline, getNotificacoes, marcarNotifLida,
//     registrarAbertura, getTiposOS, saveTipoOS, deleteTipoOS
//   - Nova função saveFormulario (registro de formulários digitais)
//   - Modificações cirúrgicas (1 linha cada): saveRotorColeta, saveVisit, savePreventiva
// ═══════════════════════════════════════════════════════════════════════════
// PROPERCARE — Google Apps Script Backend — PCM/PCF
// ═══════════════════════════════════════════════════════════════════════════
//
// ESTRUTURA DE ABAS DA PLANILHA:
//   MODELOS           → Catálogo de modelos de equipamentos
//   MAQUINAS          → Equipamentos cadastrados dos clientes (PGP)
//   CLIENTES          → Clientes cadastrados no admin
//   VISITAS           → Registro de cada visita/preventiva realizada
//   PECAS_LOG         → Detalhamento das peças por visita
//   MACHINE_PARTS     → Último estado das peças por máquina
//   PARTS_MASTER      → Catálogo de peças por modelo
//   PART_SIMILARITIES → Referências similares por peça
//   SUBSISTEMAS_LIB      → Biblioteca de subsistemas reutilizáveis
//   SUBSISTEMA_LIB_PARTS → Peças de cada subsistema da biblioteca
//   MODELO_SUBSISTEMA_LIB → Vínculos modelo ↔ subsistema da biblioteca
//
// NOVIDADES v26 (2026-06-25):
//   - Form 08: salvarFotoForm08() — upload de fotos para Drive
//   - doPost() suporta: salvarFotoForm08
//   - Cria pasta ProperCare_Fotos/Form08/{OS}_{Cliente}/
//     com arquivos {secao}_{timestamp}_{nome}.jpg
//
// NOVIDADES v25 (2026-06-24):
//   - Nomes de abas corrigidos para bater com a planilha existente:
//     SUB_BIBLIOTECA → SUBSISTEMAS_LIB
//     SUB_LIB_PARTS  → SUBSISTEMA_LIB_PARTS
//     SUB_LIB_LINKS  → MODELO_SUBSISTEMA_LIB
//   Causa raiz: initializeDatabase criou abas vazias com nomes errados;
//   os dados reais já estavam em abas com nomes diferentes.
//
// NOVIDADES v24 (2026-06-24):
//   - 3 novas abas: SUB_BIBLIOTECA, SUB_LIB_PARTS, SUB_LIB_LINKS
//   - getCatalogFull() agora retorna subsistemasLib, subLibParts, modeloSubLinks
//   - doPost() suporta: saveSubsistemaLib, saveSubLibPart, deleteSubsistemaLib,
//     deleteSubLibPart, linkSubsistemaToModel, unlinkSubsistemaFromModel
//   - initializeDatabase() cria/valida as 3 novas abas automaticamente
//   CAUSA RAIZ CORRIGIDA: Biblioteca de Subsistemas aparecia vazia no PCM
//   porque getCatalogFull() nunca lia as abas SUB_* e doPost() descartava
//   todas as gravações de subsistemas da biblioteca com "Ação desconhecida".
//
// NOVIDADES v13 (2026-05-26):
//   - version retorna '13' para alinhamento com PCF v13
//   - PCF v13: cache de clientes (pgpEnsureClientsCache) — busca instantânea e completa
//   - PCF v13: regime de trabalho copiado automaticamente para novas máquinas
//   - PCF v13: campos histórico/confiança/fonte removidos do detail de peças
//   - PCF v13: foto do horímetro por peça (hori_p1..p9) com label descritivo no PDF
//
// NOVIDADES v1.8 (2026-05-29):
//   - sameClient(): match por clientKey(nome) OU CNPJ numérico
//   - sameMachine(): match obrigatório por marca+modelo+série/tag (evita falso positivo)
//   - ensureMachineFromVisit: reescrito em 4 passagens; NUNCA sobrescreve Machine_ID existente
//   - saveMachine: usa sameMachine; fallback serial_unique valida marca/modelo antes de aceitar
//   - updateMachineHorímetro: usa sameMachine robusto
//   - updateMachinePartValorMostrado: usa sameMachine + Logger.log de erro
//   - getVisitsNormalized: JOIN com PECAS_LOG — retorna parts por visita para sync do PCM
//
// NOVIDADES v1.7 (2026-05-22):
//   - Identidade canônica de clientes: normalizeTextKey, clientKey, compactKey, isSuspectClientTerm
//   - resolveCanonicalClientName: resolve grafia canônica via CLIENTES → MAQUINAS
//   - getClientsForField: deduplicado por clientKey, filtra termos suspeitos, retorna aliases
//   - getMachinesByClient: igualdade por clientKey (não includes)
//   - searchMachine: sistema de pontuação, série/TAG > cliente > marca/modelo
//   - ensureMachineFromVisit: fallback por série única independente de cliente
//   - saveMachine: resolução canônica + fallback por série única
//   - saveVisit/savePreventiva: resolve cliente canônico antes de calcular machineId
//
// NOVIDADES v1.6 (2026-05-14):
//   - CLIENTES: novas colunas Contato, Filial, Próx.Visita, Últ.Visita
//   - getClientsForField: retorna clientsFull com dados cadastrais
//   - getMachinesByClient: enriquece resultado com dados do cliente
//   - saveClient: aceita contato, filial, nextVisit
//   - VISITAS: novas colunas Próx.Visita, Contato, CNPJ, Filial
//   - PECAS_LOG: novas colunas Intervalo_H, H.Rodadas, H.Restantes, Status, Valor_Mostrado, Tipo_Contador
//   - saveVisit: grava nextVisit/contact/cnpj em VISITAS e dados calculados em PECAS_LOG
//   - Todas as alterações são retrocompatíveis (colunas adicionadas ao final)
//
// NOVIDADES v1.4:
//   - Campos de auditoria em todas as tabelas (Ativo, Tipo_Registro, Created_At, Deleted_At, Deleted_By)
//   - Soft delete (Ativo = NÃO) em vez de exclusão física
//   - Hard delete restrito a Tipo_Registro = TESTE
//   - Schema CLIENTES alinhado com admin (cidade, drive_url, antecedencia_alerta_dias)
//   - Correção de bug de duplicidade em saveMachine (=== em vez de ==)
//   - getSheetDataActive filtra registros inativos nos GETs principais
//   - Suporte a includeDeleted=true nos GETs de MAQUINAS, MODELOS, CLIENTES
//
// IMPORTANTE: execute manualmente `migrateExistingIds()` 1x se vier da v1.3
// ═══════════════════════════════════════════════════════════════════════════

// v35 PARTE A: abre a planilha via ID em vez de getActiveSpreadsheet() global para
// evitar handle desatualizado após ociosidade (bug "usuários somem").
// Ação manual: criar propriedade de script SPREADSHEET_ID com o ID da planilha.
function getSS_() {
  var id = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
  return id ? SpreadsheetApp.openById(id) : SpreadsheetApp.getActiveSpreadsheet();
}
const SS = getSS_();

// ── IDENTIDADE CANÔNICA v1.7 ─────────────────────────────────────────────
function normalizeTextKey(v) {
  return String(v || '')
    .trim().toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function clientKey(v) {
  return normalizeTextKey(v)
    .replace(/\b(ltda|s\.?a\.?|eireli|me|epp|ss|lda|inc|llc|do brasil|do norte|do sul|e cia|cia)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function compactKey(v) {
  return normalizeTextKey(v).replace(/[^a-z0-9]/g, '');
}

function isSuspectClientTerm(v) {
  const s = String(v || '').trim();
  if (!s || s.length < 2) return true;
  if (/^[\d\s\-\/]+$/.test(s)) return true;
  if (/^[a-z]{0,2}\d/i.test(s) && s.length < 6) return true;
  if (normalizeTextKey(s).replace(/[^a-z]/g, '').length < 2) return true;
  return false;
}

// Helper: preserva valor 0 (zero é dado válido de horímetro)
function safeVal(v) {
  if (v === undefined || v === null || v === '') return '';
  return v;
}

// Preserva 0 numérico/string em leituras vindas do Sheets.
// Use para Valor_Mostrado, H_Rodadas, H_Restantes e qualquer campo onde zero seja dado válido.
function cellVal(v) {
  if (v === undefined || v === null || v === '') return '';
  return v;
}

function cellStr(v) {
  const val = cellVal(v);
  return val === '' ? '' : String(val);
}


function intOrBlank(v) {
  if (v === undefined || v === null || v === '') return '';
  const s = String(v).trim();
  if (s === '') return '';
  const n = Number(s.replace(',', '.'));
  return Number.isFinite(n) ? Math.trunc(n) : '';
}

// ── MATCHING ROBUSTO DE CLIENTES (v1.8) ──────────────────────────────────
// Dois clientes são considerados o mesmo se:
//   (a) clientKey(nome) coincidir, OU
//   (b) CNPJ numérico coincidir (quando ambos têm CNPJ)
function sameClient(nomeA, cnpjA, nomeB, cnpjB) {
  const ckA = clientKey(String(nomeA || ''));
  const ckB = clientKey(String(nomeB || ''));
  if (ckA && ckB && ckA === ckB) return true;
  const cnpjNum = v => String(v || '').replace(/\D/g, '');
  const cA = cnpjNum(cnpjA);
  const cB = cnpjNum(cnpjB);
  if (cA.length >= 11 && cB.length >= 11 && cA === cB) return true;
  return false;
}

// ── MATCHING ROBUSTO DE MÁQUINAS (v1.8) ──────────────────────────────────
// Dois registros são a mesma máquina se:
//   OBRIGATÓRIO: compactKey(série) coincidir (quando ambas têm série), OU
//                compactKey(tag)   coincidir (quando ambas têm tag)
//   MAIS:        compactKey(marca) E compactKey(modelo) coincidem (reforço)
//   NUNCA casa apenas por cliente + série sem marca/modelo confirmados
function sameMachine(rBrand, rModel, rSerial, rTag, inBrand, inModel, inSerial, inTag) {
  const ck = v => compactKey(String(v || ''));
  const hasSer = ck(rSerial) && ck(inSerial);
  const hasTag = ck(rTag)    && ck(inTag);
  if (!hasSer && !hasTag) return false; // sem identificador físico → não casa

  const serMatch = hasSer && ck(rSerial) === ck(inSerial);
  const tagMatch = hasTag && ck(rTag)    === ck(inTag);
  if (!serMatch && !tagMatch) return false;

  // Com série/tag coincidindo, exige também marca+modelo para evitar falso positivo
  const brandOk = !ck(rBrand)  || !ck(inBrand)  || ck(rBrand)  === ck(inBrand);
  const modelOk = !ck(rModel)  || !ck(inModel)  || ck(rModel)  === ck(inModel);
  return brandOk && modelOk;
}

function resolveCanonicalClientName(input) {
  const raw = String(input || '').trim();
  const key = clientKey(raw);
  if (!key) return raw;

  try {
    const clientes = getSheetDataActive('CLIENTES');
    const found = clientes.find(c => clientKey(String(c['Nome'] || '')) === key);
    if (found) {
      Logger.log('resolveCanonicalClientName: "' + raw + '" → "' + found['Nome'] + '" (via CLIENTES)');
      return String(found['Nome']).trim();
    }
  } catch(e) {}

  try {
    const maquinas = getSheetDataActive('MAQUINAS');
    const candidates = maquinas
      .filter(m => clientKey(String(m['Cliente'] || '')) === key)
      .map(m => String(m['Cliente'] || '').trim())
      .filter(Boolean);
    if (candidates.length > 0) {
      candidates.sort((a, b) => b.length - a.length);
      Logger.log('resolveCanonicalClientName: "' + raw + '" → "' + candidates[0] + '" (via MAQUINAS)');
      return candidates[0];
    }
  } catch(e) {}

  return raw;
}
// ─────────────────────────────────────────────────────────────────────────

// ── MACHINE KEY — mesmo algoritmo do campo e admin ───────────────────────
function machineKey(client, brand, model, serial) {
  function norm(v) {
    return String(v || '').trim().toLowerCase()
      .replace(/[àáâãäå]/g,'a').replace(/[èéêë]/g,'e')
      .replace(/[ìíîï]/g,'i').replace(/[òóôõö]/g,'o')
      .replace(/[ùúûü]/g,'u').replace(/[ç]/g,'c')
      .replace(/[^a-z0-9]/g,'');
  }
  const parts = [norm(client), norm(brand), norm(model)];
  const ser = norm(serial);
  if (ser) parts.push(ser);
  return 'MK-' + parts.join('-');
}

// ── PROTEÇÃO POR TOKEN ────────────────────────────────────
const API_KEY = '8d969eef6ecad3c29a3a629280e686cf0c3f5d5a86aff3ca12020c923adc6c92'; // sha256 de 123456

// v28 — OAuth
const GOOGLE_CLIENT_ID_HUB = '652411334243-4aqc4jg63obagavf6nukldc6o2u4kgn3.apps.googleusercontent.com';
const GOOGLE_DOMAIN_HUB    = 'propercompressores.com.br';

function checkKey(params_or_body) {
  const k = params_or_body.key || params_or_body.k || '';
  if (k !== API_KEY) throw new Error('Acesso não autorizado');
}

// ── Cabeçalhos das abas ──────────────────────────────────────────────────
const HEADERS = {
  MAQUINAS: [
    'ID','Cliente','Filial','Marca','Modelo','Série','Ano','TAG','Localização',
    'Hor.Total','h/Semana','Observações',
    'Ativo','Tipo_Registro','Created_At','Deleted_At','Deleted_By','Atualizado',
    // v1.9 — campos coletados pelo PCF que faltavam
    'Potência','Tipo_Equip','Obs_Op'
  ],
  MODELOS: [
    'ID','Marca','Modelo','Tipo','Potência','Pressão','Observações',
    'Ativo','Tipo_Registro','Created_At','Deleted_At','Deleted_By','Atualizado',
    // v16 — campos técnicos adicionais (ao final, retrocompatível)
    'Vazao_l_min','Tensao','Corrente_A'
  ],
  CLIENTES: [
    'ID','Nome','CNPJ','Cidade','Telefone','Email','Observações',
    'Antecedencia_Alerta_Dias','Drive_URL',
    'Ativo','Tipo_Registro','Created_At','Deleted_At','Deleted_By','Atualizado',
    // v1.5 — novas colunas ao final (retrocompatível)
    'Contato','Filial','Prox_Visita','Ult_Visita',
    // v1.10 — endereço e UF
    'Endereco','UF'
  ],
  VISITAS: [
    'ID','Machine_ID','Cliente','Filial','Marca','Modelo','Série','TAG',
    'Hor.Visita','h/Semana','Cenário','Técnico','Data Visita','Tipo','Obs.Gerais',
    'Ativo','Tipo_Registro','Created_At','Deleted_At','Deleted_By','Enviado',
    // v1.5 — novas colunas ao final
    'Prox_Visita','Contato','CNPJ',
    // v1.9 — dados de contato e campos operacionais da visita
    'Telefone','Email','Cidade','Obs_Op','Regime_JSON',
    // v20 — elo aditivo com Ordens de Serviço
    'OS_Numero'
  ],
  PECAS_LOG: [
    'ID_Visita','ID_Peça','Nome Peça','Ref.','Subsistema','Últ.Troca(h)',
    'N/A','Observação','Ref_Nova','Ref_Anterior','Tipo_Referencia','Acao',
    'Horimetro','Data_Troca',
    'Ativo','Tipo_Registro','Created_At','Deleted_At','Deleted_By',
    // v1.5 — novas colunas ao final
    'Intervalo_H','H_Rodadas','H_Restantes','Status','Valor_Mostrado','Tipo_Contador'
  ],
  MACHINE_PARTS: [
    'Machine_ID','Serial','TAG','Part_ID','Part_Name','Last_Change_H',
    'Interval_H','Ref','NA','Ref_Anterior','Created_At',
    'Ativo','Tipo_Registro','Deleted_At','Deleted_By','Atualizado',
    'Valor_Mostrado','Contador'
  ],
  PARTS_MASTER: [
    'Part_ID','Model_ID','Name','OEM_Ref','Part_Brand','Supplier_Primary',
    'Slot','Qty_Default','Interval_H','Criticality','Cost','Obs',
    'Ativo','Tipo_Registro','Created_At','Deleted_At','Deleted_By','Updated_At',
    'Part_Scope','Sub_ID','Sub_Name','Sub_Category','Sub_Desc','Sub_Interval_H'
  ],
  PART_SIMILARITIES: [
    'Sim_ID','Part_ID','Model_ID','Ref_Similar','Brand_Similar','Obs',
    'Ativo','Tipo_Registro','Created_At','Deleted_At','Deleted_By','Updated_At'
  ],
  CAT_USUARIOS: [
    'id','nome','pin_hash','ativo','perfil',
    // v22 — auditoria e contato (ao final, retrocompatível)
    'telefone','email','Created_At','Updated_At','Created_By','Updated_By','ultimo_login_at','acesso_extra'
  ],
  ORDENS_SERVICO: [
    'id_os','numero_os','id_cliente','cliente','descricao',
    'data_abertura','data_prevista','status',
    'usuarios_vinculados','maquinas_vinculadas','id_visita_resultado',
    'drive_folder_id','drive_folder_url',
    'inicio_atendimento','fim_atendimento','pdf_url','tipo_os',
    // v22 — auditoria, fechamento e preparação para área do cliente (ao final, retrocompatível)
    'Ativo','Created_At','Updated_At','Created_By','Updated_By',
    'usuario_atual','responsavel_cliente','observacao_fechamento',
    'assinatura_usuario_url','assinatura_cliente_url',
    'total_maquinas','visit_ids_resultado_json','last_sync_at',
    'motivo_cancelamento','motivo_encerramento_sem_conclusao',
    'prioridade','canal_origem'
  ],
  TECH_ATTACHMENTS: [
    'Attachment_ID','Entity_Type','Entity_ID','OS_Numero',
    'File_ID','File_URL','File_Name','Mime','Attachment_Type','Caption',
    'Created_At','Created_By','Ativo'
  ],
  // v22 — módulo de Ordens de Serviço
  OS_MAQUINAS: [
    'id_link','id_os','numero_os','machineKey','id_cliente',
    'status_atendimento','id_visita_resultado','observacao_maquina',
    'Created_At','Created_By','Updated_At','Ativo'
  ],
  LOG_OPERACIONAL: [
    'id_evento','timestamp','tipo_evento','id_os','numero_os','id_cliente','cliente',
    'id_usuario','nome_usuario','id_maquina','machineKey',
    'status_anterior','status_novo','acao_realizada',
    'responsavel_nome','origem','observacao','payload_json'
  ],
  HISTORICO_OS: [
    'id_historico','id_os','numero_os','id_cliente','cliente','tipo_os',
    'data_abertura','data_encerramento','status_final',
    'tecnicos_vinculados_json','total_maquinas','maquinas_atendidas','maquinas_pendentes',
    'visit_ids_resultado_json','pdf_url','assinatura_tecnico_url','assinatura_cliente_url',
    'observacao_fechamento','motivo_cancelamento','encerrada_por','timestamp'
  ],
  OS_DRAFTS: [
    'id_draft','id_os','numero_os','id_usuario','nome_usuario','tipo_os',
    'timestamp_atualizacao','payload_json','status_draft'
  ],
  ROTORES_MODELOS: [
    'Model_ID','Marca','Modelo','Foto_Ref_URL','Anchors_JSON',
    'Ativo','Tipo_Registro','Created_At','Updated_At','Deleted_At','Deleted_By'
  ],
  ROTORES_COLETAS: [
    'Coleta_ID','Machine_ID','Visit_ID','Model_ID',
    'Cliente','Marca','Modelo','Serie','TAG','Tecnico','Data_Coleta',
    'Foto_Rotores_URL','Anchors_JSON','Medicoes_JSON','Obs',
    'Ativo','Tipo_Registro','Created_At','Deleted_At','Deleted_By'
  ],
  // v24 — Biblioteca de Subsistemas reutilizáveis
  SUBSISTEMAS_LIB: [
    'Sub_Lib_ID','Nome','Categoria','Descricao','Interval_Base_H',
    'Codigo_Referencia','Fabricante','Obs',
    'Ativo','Tipo_Registro','Created_At','Updated_At','Deleted_At','Deleted_By'
  ],
  SUBSISTEMA_LIB_PARTS: [
    'Part_ID','Sub_Lib_ID','Name','OEM_Ref','Part_Brand','Supplier_Primary',
    'Slot','Qty_Default','Interval_H','Criticality','Cost','Obs',
    'Ativo','Tipo_Registro','Created_At','Updated_At','Deleted_At','Deleted_By'
  ],
  MODELO_SUBSISTEMA_LIB: [
    'Link_ID','Model_ID','Sub_Lib_ID','Created_By',
    'Ativo','Tipo_Registro','Created_At','Deleted_At','Deleted_By'
  ]
};

// v27
HEADERS.CAT_PERFIS = [
  'id_perfil','nome_perfil','modulos_acesso','is_admin','ativo',
  'Created_At','Updated_At','Created_By'
];

// v29 — ProperFlow
HEADERS.PIPELINE_TEMPLATES = [
  'Template_ID','Nome','Tarefas_JSON',
  'Ativo','Tipo_Registro','Created_At','Updated_At','Created_By'
];

HEADERS.PIPELINE_TAREFAS = [
  'OS_ID','Tarefa_ID','Template_ID','Nome','Tipo','Fase','Fase_Ordem','Ordem',
  'Depende_de','Paralelo_com','Bloqueante','Alerta_dias','Descricao',
  'Status','Status_anterior','Concluido_por','Data_abertura','Data_conclusao','Observacao',
  'Ativo','Tipo_Registro','Created_At','Updated_At'
];

HEADERS.PIPELINE_NOTIF = [
  'Notif_ID','OS_ID','Tarefa_ID','Tipo','Destinatario','Mensagem',
  'Lida','Tipo_Registro','Created_At'
];

HEADERS.CAT_TIPOS_OS = [
  'Tipo_ID','Nome','Template_ID_Padrao','Descricao',
  'Ativo','Tipo_Registro','Created_At','Updated_At','Created_By'
];

HEADERS.FORMULARIOS = [
  'ID','OS_ID','Tipo_Formulario','Usuario_ID','Usuario_Nome',
  'Data','Status','Campos_JSON','Fotos_JSON',
  'Ativo','Tipo_Registro','Created_At','Updated_At'
];

// ── Valores padrão de auditoria para novas linhas ────────────────────────
function auditDefaults(tipoRegistro) {
  const now = new Date().toISOString();
  return {
    ativo: 'SIM',
    tipoRegistro: tipoRegistro || 'PRODUCAO',
    createdAt: now,
    deletedAt: '',
    deletedBy: ''
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// ENTRY POINT — GET (ping e consultas)
// ═══════════════════════════════════════════════════════════════════════════
function doGet(e) {
  const params = e.parameter;
  const action = params.action || 'ping';
  let result;

  try {
    if (action !== 'ping') {
      checkKey(params);
      try {
        verificarGoogleToken_(params.google_credential || '');
      } catch(gErr) {
        return jsonResponse({ status: 'error', error: 'AUTH_GOOGLE: ' + gErr.message });
      }
    }
    switch (action) {
      case 'ping':
        result = { status: 'ok', version: '22', spreadsheet: SS.getName(), ts: new Date().toISOString() };
        break;
      case 'searchMachine':
        result = searchMachine(params.q || '');
        break;
      case 'getMachines': {
        const inclDel = params.includeDeleted === 'true';
        result = { status: 'ok', machines: inclDel ? getSheetData('MAQUINAS') : getSheetDataActive('MAQUINAS') };
        break;
      }
      case 'getMachinesWithParts':
        result = getMachinesWithParts();
        break;
      case 'getModels': {
        const inclDel = params.includeDeleted === 'true';
        result = { status: 'ok', models: inclDel ? getSheetData('MODELOS') : getSheetDataActive('MODELOS') };
        break;
      }
      case 'getVisits':
        result = { status: 'ok', visits: getVisitsNormalized() };
        break;
      case 'getOS':
        result = getOS(params);
        break;
      case 'getUsuarios':
      case 'getTecnicos': // compat — remover após sessões 2/3
        result = getUsuarios();
        break;
      case 'validarPIN':
        result = validarPIN(params);
        break;
      case 'getMaquinasByOS':
        result = getMaquinasByOS(params);
        break;
      case 'getEquipamentosByOS':
        result = getEquipamentosByOS(params);
        break;
      case 'getLogOperacional':
        result = getLogOperacional(params);
        break;
      case 'getAttachments':
        result = getAttachments(params);
        break;
      case 'getMachineParts':
        result = { status: 'ok', parts: getSheetData('MACHINE_PARTS') };
        break;
      case 'getAllMachineParts':
        result = { status: 'ok', parts: getSheetData('MACHINE_PARTS') };
        break;
      case 'getClients': {
        const inclDel = params.includeDeleted === 'true';
        result = { status: 'ok', clients: inclDel ? getSheetData('CLIENTES') : getSheetDataActive('CLIENTES') };
        break;
      }
      case 'getPartsMaster':
        result = { status: 'ok', parts: getSheetDataActive('PARTS_MASTER') };
        break;
      case 'getPartSimilarities':
        result = { status: 'ok', similarities: getSheetData('PART_SIMILARITIES') };
        break;
      case 'getCatalogFull':
        result = getCatalogFull();
        break;
      case 'getVisitsByMachine':
        result = getVisitsByMachine(params.machine_id || '');
        break;
      case 'getMachinesByClient':
        result = getMachinesByClient(params.client || '');
        break;
      case 'getClientsForField':
        result = getClientsForField();
        break;
      case 'getSystemHealth':
        result = getSystemHealth();
        break;
      case 'getDuplicates':
        result = getDuplicates();
        break;
      case 'getDeletedRecords':
        result = getDeletedRecords(params.sheetName || '');
        break;
      case 'createBackupSnapshot':
        result = createBackupSnapshot();
        break;
      case 'getPartApplications':
        result = getPartApplications(params.q || '');
        break;
      case 'getCatalogAudit':
        result = getCatalogAudit();
        break;
      case 'getRotorModels':
        result = getRotorModels();
        break;
      case 'getRotorColetas':
        result = getRotorColetas(params.machine_id || '');
        break;
      case 'getPerfis':
        result = getPerfis();
        break;
      case 'getPerfilById':
        result = getPerfilById(params);
        break;
      case 'getNotificacoes':
        result = getNotificacoes(params.usuario);
        break;
      case 'getTiposOS':
        result = getTiposOS();
        break;
      default:
        result = { status: 'error', error: 'Ação desconhecida: ' + action };
    }
  } catch (err) {
    result = { status: 'error', error: err.message };
  }

  return jsonResponse(result);
}

// ═══════════════════════════════════════════════════════════════════════════
// ENTRY POINT — POST (gravações)
// ═══════════════════════════════════════════════════════════════════════════
function doPost(e) {
  let body;
  try { body = JSON.parse(e.postData.contents); }
  catch (err) { return jsonResponse({ status: 'error', error: 'JSON inválido' }); }

  const action = body.action;
  let result;

  try {
    checkKey(body);
    // v28 — verificar JWT Google (exceto loginUsuarioHub/loginTecnicoHub, que validam internamente)
    if (action !== 'loginTecnicoHub' && action !== 'loginUsuarioHub') {
      try {
        verificarGoogleToken_(body.google_credential || '');
      } catch(gErr) {
        return jsonResponse({ status: 'error', error: 'AUTH_GOOGLE: ' + gErr.message });
      }
    }
    switch (action) {
      case 'saveVisit':
        result = saveVisit(body);
        break;
      case 'loginTecnico':
        result = loginTecnico(body);
        break;
      case 'getUsuarios':
      case 'getTecnicos': // compat — remover após sessões 2/3
        result = getUsuarios();
        break;
      case 'saveOS':
        result = saveOS(body);
        break;
      case 'salvarOS':
        result = saveOS(body);
        break;
      case 'saveUsuario':
      case 'saveTecnico': // compat — remover após sessões 2/3
        result = saveUsuario(body);
        break;
      case 'salvarFotosDrivePGP':
        result = salvarFotosDrivePGP(body);
        break;
      case 'vincularMaquinaOS':
        result = vincularMaquinaOS(body);
        break;
      case 'vincularEquipamentoOS':
        result = vincularEquipamentoOS(body);
        break;
      case 'reabrirOS':
        result = reabrirOS(body);
        break;
      case 'salvarDraftOS':
        result = salvarDraftOS(body);
        break;
      case 'getDraftOS':
        result = getDraftOS(body);
        break;
      case 'limparDraftOS':
        result = limparDraftOS(body);
        break;
      case 'savePreventiva':
        result = savePreventiva(body);
        break;
      case 'saveMachine':
        result = saveMachine({ ...body.machine, tipoRegistro: body.machine?.tipoRegistro || 'PRODUCAO' });
        break;
      case 'deleteMachine':
        result = softDelete('MAQUINAS', body.id, body.deletedBy || 'admin');
        break;
      case 'saveModel':
        result = saveModel(body.model);
        break;
      case 'deleteModel':
        result = softDelete('MODELOS', body.id, body.deletedBy || 'admin');
        break;
      case 'updateMachineParts':
        result = updateMachineParts(body);
        break;
      case 'savePartMaster':
        result = savePartMaster(body.part);
        break;
      case 'replacePartSimilarities':
        result = replacePartSimilarities(body.partId, body.modelId, body.similarities || []);
        break;
      case 'deletePartMaster':
        result = deletePartMaster(body.partId, body.modelId, body.deletedBy || 'admin');
        break;
      case 'deleteSubsystemParts':
        result = deleteSubsystemParts(body.modelId, body.subId, body.deletedBy || 'admin');
        break;
      case 'reconcileModelParts':
        result = reconcileModelParts(body.modelId, body.activePartIds || [], body.deletedBy || 'admin');
        break;
      case 'saveClient':
        result = saveClient(body.client);
        break;
      case 'deleteClient':
        result = softDelete('CLIENTES', body.id, body.deletedBy || 'admin');
        break;
      case 'mergeClients':
        result = mergeClients(body);
        break;
      case 'hardDeleteTestRecord':
        result = hardDeleteTestRecord(body.sheetName, body.id);
        break;
      case 'saveRotorModel':
        result = saveRotorModel(body);
        break;
      case 'saveRotorColeta':
        result = saveRotorColeta(body);
        break;
      case 'salvarFotoRotoresDrive':
        result = salvarFotoRotoresDrive(body);
        break;
      // v24 — Biblioteca de Subsistemas
      case 'saveSubsistemaLib':
        result = saveSubsistemaLib(body.data);
        break;
      case 'saveSubLibPart':
        result = saveSubLibPart(body.data);
        break;
      case 'deleteSubsistemaLib':
        result = deleteSubsistemaLib(body.subLibId, body.deletedBy || 'admin');
        break;
      case 'deleteSubLibPart':
        result = deleteSubLibPart(body.partId, body.deletedBy || 'admin');
        break;
      case 'linkSubsistemaToModel':
        result = linkSubsistemaToModel(body.modelId, body.subLibId, body.createdBy || 'admin');
        break;
      case 'unlinkSubsistemaFromModel':
        result = unlinkSubsistemaFromModel(body.modelId, body.subLibId, body.deletedBy || 'admin');
        break;
      case 'salvarFotoForm08':
        result = salvarFotoForm08(body);
        break;
      case 'loginUsuarioHub':
      case 'loginTecnicoHub': // compat — remover após sessões 2/3
        result = loginUsuarioHub(body);
        break;
      case 'savePerfil':
        result = savePerfil(body);
        break;
      case 'deletePerfil':
        result = deletePerfil(body);
        break;
      case 'updateAcessoExtra':
        result = updateAcessoExtra(body);
        break;
      case 'saveFormulario':
        result = saveFormulario(body);
        break;
      case 'getPipelineByOS':
        result = getPipelineByOS(body.os_id);
        break;
      case 'updateTarefaStatus':
        result = updateTarefaStatus(body.os_id, body.tarefa_id, body.status, body.usuario, body.observacao);
        break;
      case 'getTemplates':
        result = getTemplates();
        break;
      case 'saveTemplate':
        result = saveTemplate(body);
        break;
      case 'instanciarPipeline':
        result = instanciarPipeline(body.os_id, body.template_id);
        break;
      case 'marcarNotifLida':
        result = marcarNotifLida(body.notif_id);
        break;
      case 'registrarAbertura':
        result = registrarAbertura(body.os_id, body.tarefa_id, body.usuario);
        break;
      case 'saveTipoOS':
        result = saveTipoOS(body);
        break;
      case 'deleteTipoOS':
        result = deleteTipoOS(body.tipo_id);
        break;
      default:
        result = { status: 'error', error: 'Ação desconhecida: ' + action };
    }
  } catch (err) {
    result = { status: 'error', error: err.message };
  }

  return jsonResponse(result);
}

// ═══════════════════════════════════════════════════════════════════════════
// SEARCH MACHINE
// ═══════════════════════════════════════════════════════════════════════════
function searchMachine(query) {
  if (!query) return { status: 'error', error: 'Query vazia' };
  const sheet = getOrCreateSheet('MAQUINAS', HEADERS.MAQUINAS);
  const data = sheet.getDataRange().getValues();
  if (data.length < 2) return { status: 'ok', machine: null };

  const headers = data[0];
  const qCompact = compactKey(query);
  const qClient  = clientKey(query);
  const qLower   = normalizeTextKey(query);

  const idxSerie  = headers.indexOf('Série');
  const idxTag    = headers.indexOf('TAG');
  const idxClient = headers.indexOf('Cliente');
  const idxId     = headers.indexOf('ID');
  const idxAtivo  = headers.indexOf('Ativo');

  // Calcular score por candidato — série/TAG vencem sobre cliente
  let best = null;
  let bestScore = 0;

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (String(row[idxAtivo] || 'SIM').toUpperCase() === 'NÃO') continue;

    const serie  = String(row[idxSerie]  || '');
    const tag    = String(row[idxTag]    || '');
    const client = String(row[idxClient] || '');
    const id     = String(row[idxId]     || '');
    const brand  = String(row[headers.indexOf('Marca')]  || '');
    const model  = String(row[headers.indexOf('Modelo')] || '');

    let score = 0;
    if (id.trim() === query.trim())                                          score = 100;
    else if (qCompact && compactKey(serie) === qCompact)                     score = 90;
    else if (qCompact && compactKey(tag)   === qCompact)                     score = 85;
    else if (qClient  && clientKey(client) === qClient)                      score = 70;
    else if (qLower.length > 3 && normalizeTextKey(brand + ' ' + model).includes(qLower)) score = 50;
    else if (qClient.length > 3 && clientKey(client).includes(qClient))     score = 20;

    if (score > bestScore) {
      bestScore = score;
      const machine = {};
      headers.forEach((h, j) => machine[h] = row[j]);
      best = machine;
    }
  }

  if (!best) return { status: 'ok', machine: null };

  const result = rowToMachine(best);
  result.parts = getMachinePartsById(result.id, result.serial, result.tag);
  result.canonicalClient = resolveCanonicalClientName(result.client);
  result.matchScore = bestScore;
  Logger.log('searchMachine: query="' + query + '" → score=' + bestScore + ' cliente="' + result.client + '"');

  // GAS-3: enriquecer com dados do cliente (CNPJ, telefone, cidade, próxima visita…)
  try {
    const clients = getSheetDataActive('CLIENTES');
    const normCl = v => String(v || '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    const clientRow = clients.find(c => normCl(c['Nome'] || c['Razao_Social'] || '') === normCl(result.client || ''));
    if (clientRow) {
      const clientData = {
        nome:      clientRow['Nome']        || '',
        cnpj:      clientRow['CNPJ']        || '',
        contato:   clientRow['Contato']     || '',
        telefone:  clientRow['Telefone']    || '',
        email:     clientRow['Email']       || '',
        cidade:    clientRow['Cidade']      || '',
        filial:    clientRow['Filial']      || '',
        nextVisit: clientRow['Prox_Visita'] || '',
        lastVisit: clientRow['Ult_Visita']  || ''
      };
      return { status: 'ok', machine: enrichMachineWithClientData(result, clientData) };
    }
  } catch (enrichErr) {
    Logger.log('searchMachine enrichClient ERRO: ' + enrichErr.message);
  }

  return { status: 'ok', machine: result };
}

// ═══════════════════════════════════════════════════════════════════════════
// SAVE VISIT (from field checklist)
// ═══════════════════════════════════════════════════════════════════════════
function saveVisit(body) {
  ensureSheetHeaders('VISITAS', HEADERS.VISITAS);
  ensureSheetHeaders('PECAS_LOG', HEADERS.PECAS_LOG);
  ensureOSHeaders_();
  const visitId = String(body.visit_id || ('VIS-' + new Date().getTime())).trim();
  const now = new Date().toISOString();
  const visitDate = body.visitDate || new Date().toLocaleDateString('pt-BR');

  // v1.7: resolver cliente canônico antes de calcular machineId
  if (body.client && !isSuspectClientTerm(body.client)) {
    const canonical = resolveCanonicalClientName(body.client);
    if (canonical !== body.client) {
      Logger.log('saveVisit: cliente corrigido "' + body.client + '" → "' + canonical + '"');
      body.client = canonical;
    }
  }

  const machineId = body.machine_id ||
    machineKey(body.client||'', body.brand||'', body.model||'', body.serial||'');

  // Verificar idempotência: se visit_id já existe, retornar sem duplicar
  const visitSheet = getOrCreateSheet('VISITAS', HEADERS.VISITAS);
  const visitsData_check = visitSheet.getDataRange().getValues();
  const visitHeaders_check = visitsData_check[0] || HEADERS.VISITAS;
  const idxVid_check = visitHeaders_check.indexOf('ID');
  if (idxVid_check >= 0) {
    for (let i = 1; i < visitsData_check.length; i++) {
      if (String(visitsData_check[i][idxVid_check] || '').trim() === visitId) {
        return { status: 'ok', visitId, duplicate: true };
      }
    }
  }

  ensureMachineFromVisit(body, machineId, visitDate, now);

  visitSheet.appendRow([
    visitId, machineId,
    body.client   || '', body.branch   || '',
    body.brand    || '', body.model    || '',
    body.serial   || '', body.tag      || '',
    parseInt(body.hourTotal) || 0,
    parseInt(body.hpw)       || 0,
    body.scenario || '',
    body.tech     || '',
    visitDate,
    body.tipo || 'inspecao',
    body.generalObs || '',
    'SIM', 'PRODUCAO', now, '', '', now,
    // v1.5: novas colunas
    body.nextVisit || '', body.contact || '', body.cnpj || '',
    // v1.9: dados de contato e campos operacionais
    body.phone || '', body.email || '', body.city || '',
    body.obsOp || '',
    body.regimeData ? JSON.stringify(body.regimeData) : '',
    body.os_numero || body.OS_Numero || ''
  ]);

  const partsSheet = getOrCreateSheet('PECAS_LOG', HEADERS.PECAS_LOG);
  const parts = body.parts || {};
  Object.entries(parts).forEach(([partId, ps]) => {
    partsSheet.appendRow([
      visitId, partId,
      ps.name  || partId,
      ps.ref   || '',
      ps.sub   || '',
      intOrBlank(ps.lastChange),
      ps.na ? 'SIM' : 'NÃO',
      ps.obs   || '',
      '', '', '', '',
      parseInt(body.hourTotal) || 0,
      now,
      'SIM', 'PRODUCAO', now, '', '',
      // v1.5: novas colunas calculadas
      intOrBlank(ps.interval),
      ps.horasRodadas            || '',
      ps.horasRestantes          || '',
      ps.status                  || '',
      safeVal(ps.valorMostrado),
      safeVal(ps.contador)
    ]);
  });

  // MACHINE_PARTS só é mutada por preventiva, nunca por inspeção
  const tipoVisita = String(body.tipo || 'inspecao').trim().toLowerCase();
  if (tipoVisita === 'preventiva') {
    updateMachineParts({
      machine_id: machineId,
      serial: body.serial || '',
      tag: body.tag || '',
      parts: parts
    });
  }

  try { autoCompletarTarefa(body.os_id, body.tipo || 'inspecao', { status: 'completo', id_formulario: visitId }); } catch(e) {}
  return { status: 'ok', visitId, machineId };
}

// ═══════════════════════════════════════════════════════════════════════════
// UPDATE MACHINE PARTS
// ═══════════════════════════════════════════════════════════════════════════
function updateMachineParts(body) {
  ensureSheetHeaders('MACHINE_PARTS', HEADERS.MACHINE_PARTS);
  const machineId = String(body.machine_id || '').trim();
  const serial    = String(body.serial     || '').trim();
  const tag       = String(body.tag        || '').trim();
  const parts     = body.parts || {};

  if (!machineId && !serial && !tag) {
    return { status: 'error', error: 'machine_id, serial ou tag obrigatório' };
  }

  const sheet = getOrCreateSheet('MACHINE_PARTS', HEADERS.MACHINE_PARTS);
  const data  = sheet.getDataRange().getValues();
  const headers = data[0];
  const idxMid  = headers.indexOf('Machine_ID');
  const idxSer  = headers.indexOf('Serial');
  const idxTag  = headers.indexOf('TAG');
  const idxPid  = headers.indexOf('Part_ID');
  const idxRef  = headers.indexOf('Ref');
  const idxLch  = headers.indexOf('Last_Change_H');
  const idxInt  = headers.indexOf('Interval_H');
  const idxRefAnterior = headers.indexOf('Ref_Anterior');
  const idxCreatedAt   = headers.indexOf('Created_At');
  const now     = new Date().toISOString();

  // GAS-4: se machine_id ausente, validar que serial/TAG não são ambíguos
  if (!machineId && (serial || tag)) {
    const matchingMids = new Set();
    for (let i = 1; i < data.length; i++) {
      const rowSer = String(data[i][idxSer] || '').trim();
      const rowTag = String(data[i][idxTag] || '').trim();
      if ((serial && rowSer === serial) || (tag && rowTag === tag)) {
        const rowMid = String(data[i][idxMid] || '').trim();
        if (rowMid) matchingMids.add(rowMid);
      }
    }
    if (matchingMids.size > 1) {
      return { status: 'error', error: 'Ambiguidade: múltiplas máquinas com o mesmo serial/TAG' };
    }
  }

  Object.entries(parts).forEach(([partId, ps]) => {
    let rowIdx = -1;
    for (let i = 1; i < data.length; i++) {
      const rowMid = String(data[i][idxMid] || '').trim();
      const rowSer = String(data[i][idxSer] || '').trim();
      const rowTag = String(data[i][idxTag] || '').trim();
      const rowPid = String(data[i][idxPid] || '').trim();

      // GAS-4: machine_id tem prioridade; só usa serial/tag se machine_id ausente
      const machineMatch = machineId
        ? rowMid === machineId
        : (serial && rowSer === serial) || (tag && rowTag === tag);
      if (machineMatch && rowPid === partId) {
        rowIdx = i + 1;
        break;
      }
    }

    if (rowIdx > 0) {
      const existingSerial = String(sheet.getRange(rowIdx, idxSer + 1).getValue() || '');
      const existingTag    = String(sheet.getRange(rowIdx, idxTag + 1).getValue() || '');
      const idxVM  = headers.indexOf('Valor_Mostrado');
      const idxCnt = headers.indexOf('Contador');
      const existingVM  = idxVM  >= 0 ? cellStr(sheet.getRange(rowIdx, idxVM  + 1).getValue()) : '';
      const existingCnt = idxCnt >= 0 ? cellStr(sheet.getRange(rowIdx, idxCnt + 1).getValue()) : '';

      const outSerial = serial || existingSerial;
      const outTag    = tag    || existingTag;
      const outVM  = (ps.valorMostrado !== undefined && ps.valorMostrado !== null && ps.valorMostrado !== '')
        ? ps.valorMostrado : existingVM;
      const outCnt = (ps.contador !== undefined && ps.contador !== null && ps.contador !== '')
        ? ps.contador : existingCnt;

      const existingRef = String(sheet.getRange(rowIdx, idxRef + 1).getValue() || '');
      const existingLastChange = sheet.getRange(rowIdx, idxLch + 1).getValue();
      const existingInterval = sheet.getRange(rowIdx, idxInt + 1).getValue();
      const incomingRef = String(ps.ref || '');
      const refAnterior = (incomingRef && existingRef && incomingRef !== existingRef)
        ? existingRef
        : String(sheet.getRange(rowIdx, idxRefAnterior + 1).getValue() || '');
      const createdAt = String(sheet.getRange(rowIdx, idxCreatedAt + 1).getValue() || '');
      const lcVal = (ps.lastChange !== '' && ps.lastChange !== undefined && ps.lastChange !== null)
        ? intOrBlank(ps.lastChange)
        : existingLastChange;
      const intVal = (ps.interval !== '' && ps.interval !== undefined && ps.interval !== null)
        ? intOrBlank(ps.interval)
        : existingInterval;

      const rowData = [
        machineId, outSerial, outTag,
        partId,
        ps.name     || partId,
        lcVal,
        intVal,
        incomingRef,
        ps.na  ? 'SIM' : 'NÃO',
        refAnterior, createdAt,
        'SIM', 'PRODUCAO', '', '', now,
        outVM, outCnt
      ];
      sheet.getRange(rowIdx, 1, 1, HEADERS.MACHINE_PARTS.length).setValues([rowData]);
    } else {
      const rowData = [
        machineId, serial, tag,
        partId,
        ps.name     || partId,
        intOrBlank(ps.lastChange),
        intOrBlank(ps.interval),
        ps.ref || '',
        ps.na  ? 'SIM' : 'NÃO',
        '', now,
        'SIM', 'PRODUCAO', '', '', now,
        safeVal(ps.valorMostrado),
        safeVal(ps.contador)
      ];
      sheet.appendRow(rowData);
    }
  });

  return { status: 'ok', updated: Object.keys(parts).length };
}

function enrichMachineWithClientData(machine, clientData) {
  if (!machine || !clientData) return machine;
  const out = Object.assign({}, machine);
  const map = [['client','nome'],['branch','filial'],['cnpj','cnpj'],['contact','contato'],['phone','telefone'],['email','email'],['city','cidade'],['lastVisit','lastVisit'],['nextVisit','nextVisit']];
  map.forEach(([k,ck])=>{ if(!String(out[k]||'').trim() && String(clientData[ck]||'').trim()) out[k]=String(clientData[ck]).trim(); });
  out.clientData = clientData;
  return out;
}

// ═══════════════════════════════════════════════════════════════════════════
// GET MACHINES WITH PARTS
// ═══════════════════════════════════════════════════════════════════════════
function getMachinesWithParts() {
  const clients = getSheetDataActive('CLIENTES');
  const norm = v => String(v || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
  const cmap = {};
  clients.forEach(c=>{ const k=norm(c['Nome']); if(!k) return; cmap[k]={nome:String(c['Nome']||'').trim(),cnpj:String(c['CNPJ']||'').trim(),cidade:String(c['Cidade']||'').trim(),telefone:String(c['Telefone']||'').trim(),email:String(c['Email']||'').trim(),contato:String(c['Contato']||'').trim(),filial:String(c['Filial']||'').trim(),nextVisit:String(c['Prox_Visita']||'').trim(),lastVisit:String(c['Ult_Visita']||'').trim()}; });
  const machines = getSheetDataActive('MAQUINAS').map(row => {
    let m = rowToMachineFromObj(row);
    m.parts = getMachinePartsById(m.id, m.serial, m.tag);
    m = enrichMachineWithClientData(m, cmap[norm(m.client)] || null);
    return m;
  });
  return { status: 'ok', machines };
}

// ═══════════════════════════════════════════════════════════════════════════
// GET MACHINE PARTS BY ID/SERIAL/TAG
// ═══════════════════════════════════════════════════════════════════════════
function getMachinePartsById(machineId, serial, tag) {
  try {
    const sheet = SS.getSheetByName('MACHINE_PARTS');
    if (!sheet) return {};
    const data = sheet.getDataRange().getValues();
    if (data.length < 2) return {};

    const headers = data[0];
    const idxMid = headers.indexOf('Machine_ID');
    const idxSer = headers.indexOf('Serial');
    const idxTag = headers.indexOf('TAG');
    const idxPid = headers.indexOf('Part_ID');
    const idxName= headers.indexOf('Part_Name');
    const idxLch = headers.indexOf('Last_Change_H');
    const idxInt = headers.indexOf('Interval_H');
    const idxRef = headers.indexOf('Ref');
    const idxNA  = headers.indexOf('NA');
    const idxVM  = headers.indexOf('Valor_Mostrado');
    const idxCnt = headers.indexOf('Contador');

    const idxAtivo = headers.indexOf('Ativo');
    const result = {};
    for (let i = 1; i < data.length; i++) {
      const rowMid = cellStr(data[i][idxMid]).trim();
      const rowSer = cellStr(data[i][idxSer]).trim();
      const rowTag = cellStr(data[i][idxTag]).trim();
      const rowPid = cellStr(data[i][idxPid]).trim();

      if (idxAtivo >= 0 && String(data[i][idxAtivo] || '').toUpperCase() === 'NÃO') continue;

      const hasMachineId = String(machineId || '').trim();
      const match = hasMachineId
        ? rowMid === hasMachineId
        : ((serial && rowSer === String(serial).trim()) ||
           (tag    && rowTag === String(tag).trim()));
      if (match && rowPid) {
        result[rowPid] = {
          name:          String(data[i][idxName] || rowPid),
          lastChange:    intOrBlank(data[i][idxLch]),
          interval:      intOrBlank(data[i][idxInt]),
          ref:           String(data[i][idxRef] || ''),
          na:            String(data[i][idxNA] || '').toUpperCase() === 'SIM',
          valorMostrado: idxVM  >= 0 ? cellStr(data[i][idxVM])  : '',
          contador:      idxCnt >= 0 ? cellStr(data[i][idxCnt]) : ''
        };
      }
    }
    return result;
  } catch(e) {
    return {};
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// GET VISITS NORMALIZED
// ═══════════════════════════════════════════════════════════════════════════
function getVisitsNormalized() {
  ensureSheetHeaders('VISITAS', HEADERS.VISITAS);
  const sheet = getOrCreateSheet('VISITAS', HEADERS.VISITAS);
  const data  = sheet.getDataRange().getValues();
  if (data.length < 2) return [];
  const headers = data[0];

  // v1.8: JOIN com PECAS_LOG para retornar parts por visita
  const partsMap = {};
  try {
    const plSheet = SS.getSheetByName('PECAS_LOG');
    if (plSheet) {
      const plData = plSheet.getDataRange().getValues();
      const plH = plData[0];
      const piVid  = plH.indexOf('ID_Visita');
      const piPid  = plH.indexOf('ID_Peça');
      const piName = plH.indexOf('Nome Peça');
      const piRefNova = plH.indexOf('Ref_Nova');
      const piRefBase = plH.indexOf('Ref.');
      const piLch  = plH.indexOf('Últ.Troca(h)');
      const piInt  = plH.indexOf('Intervalo_H');
      const piNA   = plH.indexOf('N/A');
      const piVM   = plH.indexOf('Valor_Mostrado');
      const piCnt  = plH.indexOf('Tipo_Contador');
      const piHRod = plH.indexOf('H_Rodadas');
      const piHRes = plH.indexOf('H_Restantes');
      const piStat = plH.indexOf('Status');
      const piAcao = plH.indexOf('Acao');
      for (let r = 1; r < plData.length; r++) {
        const vid = cellStr(plData[r][piVid]).trim();
        const pid = cellStr(plData[r][piPid]).trim();
        if (!vid || !pid) continue;
        if (!partsMap[vid]) partsMap[vid] = {};
        partsMap[vid][pid] = {
          name:          piName >= 0 ? String(plData[r][piName] || pid) : pid,
          ref:           (piRefNova >= 0 ? cellStr(plData[r][piRefNova]) : '') || (piRefBase >= 0 ? cellStr(plData[r][piRefBase]) : ''),
          lastChange:    piLch  >= 0 ? intOrBlank(plData[r][piLch]) : '',
          interval:      piInt  >= 0 ? intOrBlank(plData[r][piInt]) : '',
          na:            piNA   >= 0 && String(plData[r][piNA] || '').toUpperCase() === 'SIM',
          valorMostrado: piVM   >= 0 ? cellStr(plData[r][piVM])   : '',
          contador:      piCnt  >= 0 ? cellStr(plData[r][piCnt])  : '',
          horasRodadas:  piHRod >= 0 ? cellStr(plData[r][piHRod]) : '',
          horasRestantes:piHRes >= 0 ? cellStr(plData[r][piHRes]) : '',
          status:        piStat >= 0 ? cellStr(plData[r][piStat]) : '',
          acao:          piAcao >= 0 ? cellStr(plData[r][piAcao]) : '',
        };
      }
    }
  } catch(e) { Logger.log('getVisitsNormalized: erro ao ler PECAS_LOG — ' + e.message); }

  return data.slice(1).map(row => {
    const obj = {};
    headers.forEach((h, j) => obj[h] = row[j]);
    const vid = String(obj['ID'] || '').trim();
    return {
      visitId:    obj['ID']           || '',
      machine_id: obj['Machine_ID']   || '',
      client:     obj['Cliente']      || '',
      branch:     obj['Filial']       || '',
      brand:      obj['Marca']        || '',
      model:      obj['Modelo']       || '',
      serial:     obj['Série']        || '',
      tag:        obj['TAG']          || '',
      hourTotal:  parseInt(obj['Hor.Visita']) || 0,
      hpw:        parseInt(obj['h/Semana'])   || 0,
      scenario:   obj['Cenário']      || '',
      tech:       obj['Técnico']      || '',
      visitDate:  obj['Data Visita']  || '',
      tipo:       obj['Tipo']         || 'inspecao',
      generalObs: obj['Obs.Gerais']   || '',
      // v1.5:
      nextVisit:  obj['Prox_Visita']  || '',
      contact:    obj['Contato']      || '',
      cnpj:       obj['CNPJ']         || '',
      // v1.9: dados de contato e campos operacionais
      phone:      obj['Telefone']     || '',
      email:      obj['Email']        || '',
      city:       obj['Cidade']       || '',
      obsOp:      obj['Obs_Op']       || '',
      regimeData: (()=>{ try{ const v=obj['Regime_JSON']; return v?JSON.parse(v):null; }catch(e){return null;} })(),
      // v1.8: partes da visita via JOIN com PECAS_LOG
      parts:      partsMap[vid] || null,
      'Machine_ID':  obj['Machine_ID']  || '',
      'Série':       obj['Série']       || '',
      'TAG':         obj['TAG']         || '',
      'Hor.Total':   parseInt(obj['Hor.Visita']) || 0,
      'h/Semana':    parseInt(obj['h/Semana'])   || 0,
      'Data':        obj['Data Visita'] || '',
      'Visit_Date':  obj['Data Visita'] || '',
    };
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// SAVE PREVENTIVA
// ═══════════════════════════════════════════════════════════════════════════
function savePreventiva(body) {
  ensureSheetHeaders('VISITAS', HEADERS.VISITAS);
  ensureSheetHeaders('PECAS_LOG', HEADERS.PECAS_LOG);
  ensureSheetHeaders('MACHINE_PARTS', HEADERS.MACHINE_PARTS);

  if (!body || !body.visitDate || body.hourTotal === undefined || body.hourTotal === null || !body.parts) {
    return { status: 'error', error: 'Campos obrigatórios: machine_id/tipo/visitDate/hourTotal/parts' };
  }

  const parts = body.parts || {};
  const validAcoes = { trocada: true, conferida: true, na: true };
  for (const [partId, ps] of Object.entries(parts)) {
    const acao = String((ps && ps.acao) || '').trim().toLowerCase();
    const partName = (ps && ps.name) || partId;
    if (!validAcoes[acao]) {
      return { status: 'error', error: 'Peça ' + partName + ': acao inválida' };
    }
    if (acao === 'trocada' && !String((ps && ps.ref) || '').trim()) {
      return { status: 'error', error: 'Peça ' + partName + ': ref obrigatória para acao=trocada' };
    }
  }

  const visitSheet = getOrCreateSheet('VISITAS', HEADERS.VISITAS);
  const visitsData = visitSheet.getDataRange().getValues();
  const visitHeaders = visitsData[0] || HEADERS.VISITAS;
  const idxVisitId = visitHeaders.indexOf('ID');
  const visitId = String(body.visit_id || ('VIS-' + new Date().getTime() + '-' + Math.floor(Math.random() * 100000))).trim();

  for (let i = 1; i < visitsData.length; i++) {
    if (String(visitsData[i][idxVisitId] || '').trim() === visitId) {
      return { status: 'ok', visitId, duplicate: true };
    }
  }

  let machineId = String(body.machine_id || '').trim();

  // v1.7: resolver cliente canônico antes de calcular machineId
  if (body.client && !isSuspectClientTerm(body.client)) {
    const canonical = resolveCanonicalClientName(body.client);
    if (canonical !== body.client) {
      Logger.log('savePreventiva: cliente corrigido "' + body.client + '" → "' + canonical + '"');
      body.client = canonical;
    }
  }

  if (!machineId || !machineId.startsWith('MK-')) {
    machineId = machineKey(body.client || '', body.brand || '', body.model || '', body.serial || '');
  }

  const now = new Date().toISOString();
  ensureMachineFromVisit(body, machineId, body.visitDate, now);

  visitSheet.appendRow([
    visitId, machineId,
    body.client   || '', body.branch   || '',
    body.brand    || '', body.model    || '',
    body.serial   || '', body.tag      || '',
    parseInt(body.hourTotal) || 0,
    parseInt(body.hpw)       || 0,
    body.scenario || '',
    body.tech     || '',
    body.visitDate || now,
    body.tipo || 'preventiva',
    body.generalObs || '',
    'SIM', 'PRODUCAO', now, '', '', now,
    // v1.5:
    body.nextVisit || '', body.contact || '', body.cnpj || '',
    // v1.9: dados de contato e campos operacionais
    body.phone || '', body.email || '', body.city || '',
    body.obsOp || '',
    body.regimeData ? JSON.stringify(body.regimeData) : '',
    body.os_numero || body.OS_Numero || ''
  ]);

  const partsSheet = getOrCreateSheet('PECAS_LOG', HEADERS.PECAS_LOG);
  let pecasTrocadas = 0;
  Object.entries(parts).forEach(([partId, ps]) => {
    const acao = String(ps.acao || '').trim().toLowerCase();
    const refNova = String(ps.ref || '').trim();
    const refAnterior = String(ps.refAnterior || '').trim() ||
      getCurrentRefFromMachineParts(machineId, body.serial || '', body.tag || '', partId);

    partsSheet.appendRow([
      visitId, partId,
      ps.name || partId,
      refNova || refAnterior || '',
      ps.sub || '',
      intOrBlank(ps.lastChange),
      ps.na ? 'SIM' : 'NÃO',
      ps.obs || '',
      refNova, refAnterior,
      ps.tipoReferencia || '',
      acao,
      parseInt(body.hourTotal) || 0,
      now,
      'SIM', 'PRODUCAO', now, '', '',
      // v1.5:
      intOrBlank(ps.interval),
      ps.horasRodadas           || '',
      ps.horasRestantes         || '',
      ps.status                 || '',
      safeVal(ps.valorMostrado),
      safeVal(ps.contador)
    ]);

    if (acao === 'trocada') {
      updateMachinePartFromPreventiva({
        machine_id: machineId,
        serial: body.serial || '',
        tag: body.tag || '',
        partId,
        name: ps.name || partId,
        interval: intOrBlank(ps.interval),
        refNova: refNova,
        refAnterior,
        na: ps.na ? 'SIM' : 'NÃO',
        hourTotal: parseInt(body.hourTotal) || 0,
        lastChange: intOrBlank(ps.lastChange),
        valorMostrado: (ps.valorMostrado !== undefined && ps.valorMostrado !== null) ? ps.valorMostrado : '',
        contador: ps.contador || '',
        now
      });
      pecasTrocadas++;
    } else if (acao === 'conferida' || acao === 'na') {
      // Não altera lastChange nem ref, mas persiste valorMostrado e contador
      updateMachinePartValorMostrado(machineId, body.serial || '', body.tag || '', partId, safeVal(ps.valorMostrado), safeVal(ps.contador), now);
    }
  });

  updateMachineHorímetro(machineId, body.client || '', body.serial || '', body.tag || '', parseInt(body.hourTotal) || 0, body.visitDate || now);
  try { autoCompletarTarefa(body.os_id, 'preventiva', { status: 'completo', id_formulario: visitId }); } catch(e) {}
  return { status: 'ok', visitId, machineId, pecasTrocadas, duplicate: false };
}

// ═══════════════════════════════════════════════════════════════════════════
// GET VISITS BY MACHINE
// ═══════════════════════════════════════════════════════════════════════════
function getVisitsByMachine(machineId) {
  const mId = String(machineId || '').trim();
  if (!mId) return { status: 'error', error: 'machine_id obrigatório' };
  ensureSheetHeaders('VISITAS', HEADERS.VISITAS);
  ensureSheetHeaders('PECAS_LOG', HEADERS.PECAS_LOG);

  const allVisits = getSheetData('VISITAS');
  const visits = allVisits
    .filter(v => String(v['Machine_ID'] || '').trim() === mId)
    .map(v => ({
      visitId:    v['ID'] || '',
      machine_id: v['Machine_ID'] || '',
      tipo:       v['Tipo'] || 'inspecao',
      visitDate:  v['Data Visita'] || '',
      hourTotal:  parseInt(v['Hor.Visita']) || 0,
      tech:       v['Técnico'] || '',
      scenario:   v['Cenário'] || '',
      generalObs: v['Obs.Gerais'] || '',
      client:     v['Cliente'] || '',
      brand:      v['Marca'] || '',
      model:      v['Modelo'] || '',
      // v1.5:
      nextVisit:  v['Prox_Visita'] || '',
      contact:    v['Contato'] || '',
      cnpj:       v['CNPJ'] || '',
    }));

  visits.sort((a, b) => new Date(b.visitDate) - new Date(a.visitDate));
  const allPecasLog = getSheetData('PECAS_LOG');
  const visitIds = new Set(visits.map(v => String(v.visitId || '').trim()));
  const pecasLog = {};
  allPecasLog.forEach(p => {
    const vid = String(p['ID_Visita'] || '').trim();
    if (!visitIds.has(vid)) return;
    if (!pecasLog[vid]) pecasLog[vid] = [];
    pecasLog[vid].push({
      partId:         p['ID_Peça'] || '',
      name:           p['Nome Peça'] || '',
      acao:           p['Acao'] || '',
      refNova:        p['Ref_Nova'] || p['Ref.'] || '',
      refAnterior:    p['Ref_Anterior'] || '',
      tipoReferencia: p['Tipo_Referencia'] || '',
      horimetro:      parseInt(p['Horimetro']) || 0,
      dataTroca:      p['Data_Troca'] || '',
      na:             String(p['N/A'] || '').toUpperCase() === 'SIM',
      obs:            p['Observação'] || '',
      // v1.5:
      intervalo:      parseInt(p['Intervalo_H']) || 0,
      horasRodadas:   cellVal(p['H_Rodadas']),
      horasRestantes: cellVal(p['H_Restantes']),
      status:         cellVal(p['Status']),
      valorMostrado:  cellVal(p['Valor_Mostrado']),
      tipoContador:   cellVal(p['Tipo_Contador']),
    });
  });
  return { status: 'ok', visits, pecasLog };
}

// ═══════════════════════════════════════════════════════════════════════════
// GET MACHINES BY CLIENT
// ═══════════════════════════════════════════════════════════════════════════
function getMachinesByClient(clientQuery) {
  const q = String(clientQuery || '').trim();
  if (!q) return { status: 'error', error: 'client obrigatório' };

  // v1.7: resolver canônico e usar igualdade por clientKey
  const canonical = resolveCanonicalClientName(q);
  const qKey = clientKey(canonical || q);

  const machines = getSheetDataActive('MAQUINAS')
    .filter(m => clientKey(String(m['Cliente'] || '')) === qKey)
    .map(m => {
      const eq = rowToMachineFromObj(m);
      eq.parts = getMachinePartsById(eq.id, eq.serial, eq.tag);
      return eq;
    });

  // v1.5: buscar dados do cliente para o PCF pré-preencher campos cadastrais
  const clientsData = getSheetDataActive('CLIENTES');
  const matchClient = clientsData.find(c => clientKey(String(c['Nome'] || '')) === qKey);
  let clientData = null;
  if (matchClient) {
    clientData = {
      nome:      String(matchClient['Nome']        || '').trim(),
      cnpj:      String(matchClient['CNPJ']        || '').trim(),
      cidade:    String(matchClient['Cidade']      || '').trim(),
      telefone:  String(matchClient['Telefone']    || '').trim(),
      email:     String(matchClient['Email']       || '').trim(),
      contato:   String(matchClient['Contato']     || '').trim(),
      filial:    String(matchClient['Filial']      || '').trim(),
      nextVisit: String(matchClient['Prox_Visita'] || '').trim(),
      lastVisit: String(matchClient['Ult_Visita']  || '').trim(),
    };
  }

  const enrichedMachines = machines.map(m => enrichMachineWithClientData(m, clientData));
  Logger.log('getMachinesByClient: query="' + q + '" canonical="' + canonical + '" encontradas=' + enrichedMachines.length);
  return { status: 'ok', machines: enrichedMachines, clientData, canonicalClient: canonical };
}

// ═══════════════════════════════════════════════════════════════════════════
// GET CLIENTS FOR FIELD
// ═══════════════════════════════════════════════════════════════════════════
function getClientsForField() {
  const clientsData  = getSheetDataActive('CLIENTES');
  const machinesData = getSheetDataActive('MAQUINAS');

  // v1.7: mapa clientKey → nome canônico (CLIENTES é fonte primária)
  const canonicalMap = {};
  clientsData.forEach(c => {
    const nome = String(c['Nome'] || '').trim();
    if (!nome || isSuspectClientTerm(nome)) return;
    const k = clientKey(nome);
    if (k && !canonicalMap[k]) canonicalMap[k] = nome;
  });

  // Complementar com MAQUINAS apenas para chaves ainda não vistas
  machinesData.forEach(m => {
    const nome = String(m['Cliente'] || '').trim();
    if (!nome || isSuspectClientTerm(nome)) return;
    const k = clientKey(nome);
    if (k && !canonicalMap[k]) canonicalMap[k] = nome;
  });

  const unique = Object.values(canonicalMap)
    .sort((a, b) => a.localeCompare(b, 'pt-BR', { sensitivity: 'base' }));

  // Aliases: mapa de clientKey → variantes (para debug/merge no PCM)
  const aliasMap = {};
  [...clientsData, ...machinesData].forEach(row => {
    const nome = String(row['Nome'] || row['Cliente'] || '').trim();
    if (!nome || isSuspectClientTerm(nome)) return;
    const k = clientKey(nome);
    if (!k) return;
    if (!aliasMap[k]) aliasMap[k] = new Set();
    aliasMap[k].add(nome);
  });
  const aliases = {};
  Object.entries(aliasMap).forEach(([k, s]) => {
    if (s.size > 1) aliases[k] = [...s];
  });

  // clientsFull — somente clientes da aba CLIENTES
  const clientsFull = clientsData
    .filter(c => String(c['Nome'] || '').trim() && !isSuspectClientTerm(c['Nome']))
    .map(c => ({
      nome:      String(c['Nome']        || '').trim(),
      cnpj:      String(c['CNPJ']        || '').trim(),
      cidade:    String(c['Cidade']      || '').trim(),
      telefone:  String(c['Telefone']    || '').trim(),
      email:     String(c['Email']       || '').trim(),
      contato:   String(c['Contato']     || '').trim(),
      filial:    String(c['Filial']      || '').trim(),
      nextVisit: String(c['Prox_Visita'] || '').trim(),
      lastVisit: String(c['Ult_Visita']  || '').trim(),
    }));

  return { status: 'ok', clients: unique, clientsFull, aliases };
}


// ═══════════════════════════════════════════════════════════════════════════
// AUDITORIA — getSystemHealth
// ═══════════════════════════════════════════════════════════════════════════
function getSystemHealth() {
  const tabelas = ['MAQUINAS', 'MODELOS', 'CLIENTES', 'VISITAS', 'PECAS_LOG', 'MACHINE_PARTS', 'PARTS_MASTER', 'PART_SIMILARITIES'];
  const summary = {};

  tabelas.forEach(nome => {
    const rows = getSheetData(nome);
    const ativos   = rows.filter(r => String(r['Ativo'] || 'SIM').toUpperCase() !== 'NÃO');
    const inativos = rows.filter(r => String(r['Ativo'] || 'SIM').toUpperCase() === 'NÃO');
    const teste    = rows.filter(r => String(r['Tipo_Registro'] || '').toUpperCase() === 'TESTE');
    summary[nome] = {
      total:    rows.length,
      ativos:   ativos.length,
      inativos: inativos.length,
      teste:    teste.length
    };
  });

  const machineIds = new Set(
    getSheetData('MAQUINAS')
      .filter(r => String(r['Ativo'] || 'SIM').toUpperCase() !== 'NÃO')
      .map(r => String(r['ID'] || '').trim())
      .filter(Boolean)
  );
  const orphanParts = getSheetData('MACHINE_PARTS').filter(r => {
    const mid = String(r['Machine_ID'] || '').trim();
    return mid && !machineIds.has(mid);
  });
  const orphanVisits = getSheetData('VISITAS').filter(r => {
    const mid = String(r['Machine_ID'] || '').trim();
    return mid && !machineIds.has(mid);
  });

  return {
    status: 'ok',
    ts: new Date().toISOString(),
    tabelas: summary,
    orfaos: {
      machine_parts: orphanParts.length,
      visitas: orphanVisits.length
    }
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// AUDITORIA — getDuplicates
// ═══════════════════════════════════════════════════════════════════════════
function getDuplicates() {
  const machines = getSheetData('MAQUINAS');
  const dupsByMachineId    = {};
  const dupsByClientSerial = {};
  const dupsByClientTag    = {};

  machines.forEach(m => {
    const mid = String(m['ID'] || '').trim();
    const clientSerial = (String(m['Cliente'] || '').trim() + '|' + String(m['Série'] || '').trim()).toLowerCase();
    const clientTag    = (String(m['Cliente'] || '').trim() + '|' + String(m['TAG']    || '').trim()).toLowerCase();
    if (mid) dupsByMachineId[mid] = (dupsByMachineId[mid] || 0) + 1;
    if (clientSerial && clientSerial !== '|') dupsByClientSerial[clientSerial] = (dupsByClientSerial[clientSerial] || 0) + 1;
    if (clientTag    && clientTag    !== '|') dupsByClientTag[clientTag]        = (dupsByClientTag[clientTag]    || 0) + 1;
  });

  const filterDups = obj =>
    Object.entries(obj).filter(([, c]) => c > 1).map(([key, count]) => ({ key, count }));

  const porMachineId     = filterDups(dupsByMachineId);
  const porClienteSerial = filterDups(dupsByClientSerial);
  const porClienteTag    = filterDups(dupsByClientTag);
  const clientsData = getSheetData('CLIENTES');
  const clientByKey = {};
  const clientByCnpj = {};
  clientsData.forEach(c => {
    const nome = String(c['Nome'] || '').trim();
    const cnpj = String(c['CNPJ'] || '').replace(/\D/g, '');
    const ativo = String(c['Ativo'] || 'SIM').toUpperCase();
    if (ativo === 'NÃO') return;
    const k = clientKey(nome);
    if (k) { if (!clientByKey[k]) clientByKey[k] = []; clientByKey[k].push(nome); }
    if (cnpj.length >= 11) { if (!clientByCnpj[cnpj]) clientByCnpj[cnpj] = []; clientByCnpj[cnpj].push(nome); }
  });
  const dupClientsByKey = Object.entries(clientByKey).filter(([, v]) => v.length > 1);
  const dupClientsByCnpj = Object.entries(clientByCnpj).filter(([, v]) => v.length > 1);

  return {
    status: 'ok',
    ts: new Date().toISOString(),
    duplicatas: {
      por_machine_id:    porMachineId,
      por_cliente_serie: porClienteSerial,
      por_cliente_tag:   porClienteTag,
      por_cliente_nome_canonico: dupClientsByKey,
      por_cliente_cnpj: dupClientsByCnpj
    },
    total_duplicatas: porMachineId.length + porClienteSerial.length + porClienteTag.length + dupClientsByKey.length + dupClientsByCnpj.length
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// AUDITORIA — getDeletedRecords
// ═══════════════════════════════════════════════════════════════════════════
function getDeletedRecords(sheetName) {
  const tabelasPermitidas = ['MAQUINAS', 'MODELOS', 'CLIENTES', 'VISITAS'];

  if (sheetName) {
    if (!tabelasPermitidas.includes(sheetName)) {
      return { status: 'error', error: 'Tabela inválida. Permitidas: ' + tabelasPermitidas.join(', ') };
    }
    const rows = getSheetData(sheetName).filter(r => String(r['Ativo'] || 'SIM').toUpperCase() === 'NÃO');
    return { status: 'ok', sheetName, records: rows, total: rows.length };
  }

  const result = {};
  tabelasPermitidas.forEach(nome => {
    const rows = getSheetData(nome).filter(r => String(r['Ativo'] || 'SIM').toUpperCase() === 'NÃO');
    result[nome] = { total: rows.length, records: rows };
  });
  return { status: 'ok', ts: new Date().toISOString(), deletados: result };
}

// ═══════════════════════════════════════════════════════════════════════════
// AUDITORIA — createBackupSnapshot
// ═══════════════════════════════════════════════════════════════════════════
function createBackupSnapshot() {
  const ts = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd_HH-mm');
  const tabelas = ['MAQUINAS', 'MODELOS', 'CLIENTES', 'VISITAS', 'PECAS_LOG', 'MACHINE_PARTS', 'PARTS_MASTER', 'PART_SIMILARITIES'];
  const created = [];

  tabelas.forEach(nome => {
    const source = SS.getSheetByName(nome);
    if (!source) {
      created.push({ sheet: 'BAK_' + nome + '_' + ts, status: 'aba não encontrada' });
      return;
    }
    const snapName = 'BAK_' + nome + '_' + ts;
    if (SS.getSheetByName(snapName)) {
      created.push({ sheet: snapName, status: 'já existia' });
      return;
    }
    const snap = source.copyTo(SS);
    snap.setName(snapName);
    SS.setActiveSheet(snap);
    SS.moveActiveSheet(SS.getNumSheets());
    created.push({ sheet: snapName, status: 'criado', rows: source.getLastRow() - 1 });
  });

  return {
    status: 'ok',
    ts: new Date().toISOString(),
    snapshot_prefix: 'BAK_*_' + ts,
    abas_criadas: created
  };
}
// ═══════════════════════════════════════════════════════════════════════════
// HELPERS DE MACHINE PARTS
// ═══════════════════════════════════════════════════════════════════════════
function getCurrentRefFromMachineParts(machineId, serial, tag, partId) {
  const sheet = getOrCreateSheet('MACHINE_PARTS', HEADERS.MACHINE_PARTS);
  const data = sheet.getDataRange().getValues();
  if (data.length < 2) return '';
  const headers = data[0];
  const idxMid = headers.indexOf('Machine_ID');
  const idxSer = headers.indexOf('Serial');
  const idxTag = headers.indexOf('TAG');
  const idxPid = headers.indexOf('Part_ID');
  const idxRef = headers.indexOf('Ref');

  for (let i = 1; i < data.length; i++) {
    const rowMid = String(data[i][idxMid] || '').trim();
    const rowSer = String(data[i][idxSer] || '').trim();
    const rowTag = String(data[i][idxTag] || '').trim();
    const rowPid = String(data[i][idxPid] || '').trim();
    const mid = String(machineId || '').trim();
    const match = mid
      ? rowMid === mid
      : (serial && rowSer === String(serial).trim()) || (tag && rowTag === String(tag).trim());
    if (match && rowPid === String(partId).trim()) {
      return String(data[i][idxRef] || '').trim();
    }
  }
  return '';
}

function updateMachinePartFromPreventiva(payload) {
  const machineId = String(payload.machine_id || '').trim();
  const serial = String(payload.serial || '').trim();
  const tag = String(payload.tag || '').trim();
  const partId = String(payload.partId || '').trim();
  if (!partId) return;

  const sheet = getOrCreateSheet('MACHINE_PARTS', HEADERS.MACHINE_PARTS);
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const idxMid = headers.indexOf('Machine_ID');
  const idxSer = headers.indexOf('Serial');
  const idxTag = headers.indexOf('TAG');
  const idxPid = headers.indexOf('Part_ID');
  const idxRef = headers.indexOf('Ref');
  const idxLch = headers.indexOf('Last_Change_H');
  const idxInt = headers.indexOf('Interval_H');
  const idxRefAnterior = headers.indexOf('Ref_Anterior');
  const idxCreatedAt   = headers.indexOf('Created_At');

  for (let i = 1; i < data.length; i++) {
    const rowMid = String(data[i][idxMid] || '').trim();
    const rowSer = String(data[i][idxSer] || '').trim();
    const rowTag = String(data[i][idxTag] || '').trim();
    const rowPid = String(data[i][idxPid] || '').trim();
    // GAS-4: machine_id tem prioridade; só usa serial/tag se machine_id ausente
    const match = machineId
      ? rowMid === machineId
      : (serial && rowSer === serial) || (tag && rowTag === tag);
    if (match && rowPid === partId) {
      const currentRef = String(data[i][idxRef] || '').trim();
      const refAnterior = String(payload.refAnterior || '').trim() ||
        ((currentRef && currentRef !== String(payload.refNova || '').trim()) ? currentRef : String(data[i][idxRefAnterior] || '').trim());
      const createdAt = String(data[i][idxCreatedAt] || '').trim();
      const lcVal = (payload.lastChange !== undefined && payload.lastChange !== null && payload.lastChange !== '')
        ? intOrBlank(payload.lastChange)
        : data[i][idxLch];
      const intVal = (payload.interval !== undefined && payload.interval !== null && payload.interval !== '')
        ? intOrBlank(payload.interval)
        : data[i][idxInt];
      const updated = [
        machineId || rowMid,
        serial || rowSer,
        tag || rowTag,
        partId,
        payload.name || rowPid,
        lcVal,
        intVal,
        String(payload.refNova || '').trim(),
        String(payload.na || '').toUpperCase() === 'SIM' ? 'SIM' : 'NÃO',
        refAnterior,
        createdAt || (payload.now || new Date().toISOString()),
        'SIM', 'PRODUCAO', '', '', payload.now || new Date().toISOString(),
        (payload.valorMostrado !== undefined && payload.valorMostrado !== null) ? payload.valorMostrado : '',
        payload.contador || ''
      ];
      sheet.getRange(i + 1, 1, 1, HEADERS.MACHINE_PARTS.length).setValues([updated]);
      return;
    }
  }

  sheet.appendRow([
    machineId, serial, tag,
    partId,
    payload.name || partId,
    (payload.lastChange !== undefined && payload.lastChange !== null && payload.lastChange !== '')
      ? intOrBlank(payload.lastChange)
      : intOrBlank(payload.hourTotal),
    intOrBlank(payload.interval),
    String(payload.refNova || '').trim(),
    String(payload.na || '').toUpperCase() === 'SIM' ? 'SIM' : 'NÃO',
    String(payload.refAnterior || '').trim(),
    payload.now || new Date().toISOString(),
    'SIM', 'PRODUCAO', '', '', payload.now || new Date().toISOString(),
    (payload.valorMostrado !== undefined && payload.valorMostrado !== null) ? payload.valorMostrado : '',
    payload.contador || ''
  ]);
}

// ═══════════════════════════════════════════════════════════════════════════
// UPDATE VALOR_MOSTRADO E CONTADOR (peças conferidas/na — sem alterar lastChange)
// ═══════════════════════════════════════════════════════════════════════════
function updateMachinePartValorMostrado(machineId, serial, tag, partId, valorMostrado, contador, now) {
  try {
    const sheet = getOrCreateSheet('MACHINE_PARTS', HEADERS.MACHINE_PARTS);
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const idxMid = headers.indexOf('Machine_ID');
    const idxSer = headers.indexOf('Serial');
    const idxTag = headers.indexOf('TAG');
    const idxPid = headers.indexOf('Part_ID');
    const idxVM  = headers.indexOf('Valor_Mostrado');
    const idxCnt = headers.indexOf('Contador');
    const idxAtual = headers.indexOf('Atualizado');
    if (idxVM < 0 || idxCnt < 0) {
      Logger.log('updateMachinePartValorMostrado: colunas Valor_Mostrado/Contador não encontradas');
      return;
    }
    for (let i = 1; i < data.length; i++) {
      const rowMid = String(data[i][idxMid] || '').trim();
      const rowSer = String(data[i][idxSer] || '').trim();
      const rowTag = String(data[i][idxTag] || '').trim();
      const rowPid = String(data[i][idxPid] || '').trim();
      const mid = String(machineId || '').trim();
      const match = mid
        ? rowMid === mid
        : (serial && rowSer === String(serial).trim()) || (tag && rowTag === String(tag).trim());
      if (match && rowPid === String(partId).trim()) {
        sheet.getRange(i + 1, idxVM  + 1).setValue(safeVal(valorMostrado));
        sheet.getRange(i + 1, idxCnt + 1).setValue(safeVal(contador));
        if (idxAtual >= 0) sheet.getRange(i + 1, idxAtual + 1).setValue(now || new Date().toISOString());
        return;
      }
    }
    Logger.log('updateMachinePartValorMostrado: linha não encontrada para machineId=' + machineId + ' partId=' + partId);
  } catch(e) {
    Logger.log('updateMachinePartValorMostrado ERRO: ' + e.message);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// SAVE / UPDATE MACHINE
// ═══════════════════════════════════════════════════════════════════════════
function saveMachine(m) {
  if (!m) return { status: 'error', error: 'Dados ausentes' };
  const sheet = getOrCreateSheet('MAQUINAS', HEADERS.MAQUINAS);
  const now = new Date().toISOString();
  const ad = auditDefaults(m.tipoRegistro);

  // v1.7: resolver cliente canônico antes de qualquer comparação
  if (m.client && !isSuspectClientTerm(m.client)) {
    m.client = resolveCanonicalClientName(m.client) || m.client;
  }

  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const idxId    = headers.indexOf('ID');
  const idxSerie = headers.indexOf('Série');
  const idxAtivo = headers.indexOf('Ativo');

  for (let i = 1; i < data.length; i++) {
    const idxCli = headers.indexOf('Cliente');
    const idxMar = headers.indexOf('Marca');
    const idxMod = headers.indexOf('Modelo');
    const idxTag = headers.indexOf('TAG');
    // v1.8: match por ID exato OU por marca+modelo+série (sameMachine robusto)
    const sameId = String(data[i][idxId] || '').trim() === String(m.id || '').trim() && m.id;
    const machineMatch = !sameId && sameMachine(
      String(data[i][idxMar] || ''), String(data[i][idxMod] || ''),
      String(data[i][idxSerie] || ''), String(data[i][idxTag] || ''),
      m.brand || '', m.model || '', m.serial || '', m.tag || ''
    );
    if (sameId || machineMatch) {
      const idxCreated = headers.indexOf('Created_At');
      const idxTipo    = headers.indexOf('Tipo_Registro');
      const originalCreated = String(data[i][idxCreated] || now);
      const originalTipo    = String(data[i][idxTipo]    || 'PRODUCAO');
      const originalAtivo   = String(data[i][idxAtivo]   || 'SIM');
      const existingId      = String(data[i][idxId]      || '').trim();
      sheet.getRange(i+1, 1, 1, HEADERS.MAQUINAS.length).setValues([[
        existingId || m.id || '',   // NUNCA sobrescreve ID existente com diferente
        m.client || '', m.branch || '',
        m.brand  || '', m.model  || '',
        m.serial || '', m.year   || '',
        m.tag    || '', m.location || '',
        parseInt(m.hourTotal) || 0,
        parseInt(m.hpw)       || 0,
        m.obs || '',
        originalAtivo, originalTipo, originalCreated, '', '', now,
        // v1.9:
        m.power || m.potencia || '', m.type || m.tipoEquip || '', m.obsOp || ''
      ]]);
      return { status: 'ok', action: 'updated', matchedBy: sameId ? 'id' : 'brand_model_serial' };
    }
  }

  // v1.8: fallback por série única — só aceita se marca+modelo forem compatíveis
  if (m.serial) {
    const sk = compactKey(m.serial);
    let uniqIdx = -1, uniqCount = 0;
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][idxAtivo] || 'SIM').toUpperCase() === 'NÃO') continue;
      if (compactKey(String(data[i][idxSerie] || '')) === sk) {
        uniqIdx = i; uniqCount++;
        if (uniqCount > 1) break;
      }
    }
    if (uniqCount === 1) {
      const i = uniqIdx;
      const idxMar = headers.indexOf('Marca');
      const idxMod = headers.indexOf('Modelo');
      const rowBrand = String(data[i][idxMar] || '');
      const rowModel = String(data[i][idxMod] || '');
      const brandOk  = !compactKey(rowBrand) || !compactKey(m.brand || '') || compactKey(rowBrand) === compactKey(m.brand || '');
      const modelOk  = !compactKey(rowModel) || !compactKey(m.model || '') || compactKey(rowModel) === compactKey(m.model || '');
      if (!brandOk || !modelOk) {
        Logger.log('saveMachine: serial_unique REJEITADO por marca/modelo incompatível. Row:' + rowBrand + '/' + rowModel + ' vs ' + m.brand + '/' + m.model);
        // não aplica — cai para insert
      } else {
        const idxCreated = headers.indexOf('Created_At');
        const idxTipo    = headers.indexOf('Tipo_Registro');
        const existingId     = String(data[i][idxId] || '').trim();
        const existingClient = String(data[i][headers.indexOf('Cliente')] || '').trim();
        Logger.log('saveMachine: serial_unique match — cliente existente="' + existingClient + '" recebido="' + m.client + '"');
        sheet.getRange(i+1, 1, 1, HEADERS.MAQUINAS.length).setValues([[
          existingId || m.id || '',   // preserva ID existente
          existingClient || m.client || '',
          m.branch || '', m.brand || '', m.model || '',
          m.serial || '', m.year || '', m.tag || '', m.location || '',
          parseInt(m.hourTotal) || 0, parseInt(m.hpw) || 0, m.obs || '',
          String(data[i][idxAtivo] || 'SIM'),
          String(data[i][idxTipo]  || 'PRODUCAO'),
          String(data[i][idxCreated] || now),
          '', '', now,
          // v1.9:
          m.power || m.potencia || '', m.type || m.tipoEquip || '', m.obsOp || ''
        ]]);
        return { status: 'ok', action: 'updated', matchedBy: 'serial_unique', clientCorrected: existingClient !== m.client };
      }
    }
  }

  sheet.appendRow([
    m.id || (m.serial ? machineKey(m.client||'', m.brand||'', m.model||'', m.serial||'') : '') || (m.tag ? machineKey(m.client||'', m.brand||'', m.model||'', 'TAG-'+m.tag) : '') || ('EQ-' + new Date().getTime() + '-' + Math.random().toString(36).slice(2,6)),
    m.client || '', m.branch || '',
    m.brand  || '', m.model  || '',
    m.serial || '', m.year   || '',
    m.tag    || '', m.location || '',
    parseInt(m.hourTotal) || 0,
    parseInt(m.hpw)       || 0,
    m.obs || '',
    ad.ativo, ad.tipoRegistro, ad.createdAt, ad.deletedAt, ad.deletedBy, now,
    // v1.9:
    m.power || m.potencia || '', m.type || m.tipoEquip || '', m.obsOp || ''
  ]);
  return { status: 'ok', action: 'inserted' };
}

// ═══════════════════════════════════════════════════════════════════════════
// SAVE MODEL
// ═══════════════════════════════════════════════════════════════════════════
function saveModel(m) {
  if (!m) return { status: 'error', error: 'Dados ausentes' };
  const sheet = getOrCreateSheet('MODELOS', HEADERS.MODELOS);
  const now = new Date().toISOString();
  const ad = auditDefaults(m.tipoRegistro);

  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const idxId = headers.indexOf('ID');

  for (let i = 1; i < data.length; i++) {
    if (String(data[i][idxId] || '').trim() === String(m.id || '').trim()) {
      const idxCreated = headers.indexOf('Created_At');
      const idxTipo    = headers.indexOf('Tipo_Registro');
      const idxAtivo   = headers.indexOf('Ativo');
      const existRow   = {};
      headers.forEach((h, j) => { existRow[h] = data[i][j]; });
      sheet.getRange(i+1, 1, 1, HEADERS.MODELOS.length).setValues([[
        m.id, m.brand || '', m.model || '', m.type || '',
        m.power || '', m.pressure || '', m.obs || '',
        String(data[i][idxAtivo]   || 'SIM'),
        String(data[i][idxTipo]    || 'PRODUCAO'),
        String(data[i][idxCreated] || now),
        '', '', now,
        m.flow    || m.mFlow    || m.vazao    || existRow['Vazao_l_min'] || '',
        m.voltage || m.mVoltage || m.tensao   || existRow['Tensao']      || '',
        m.ampere  || m.mAmpere  || m.corrente || existRow['Corrente_A']  || ''
      ]]);
      return { status: 'ok', action: 'updated' };
    }
  }

  sheet.appendRow([
    m.id || 'MOD-' + new Date().getTime(),
    m.brand || '', m.model || '', m.type || '',
    m.power || '', m.pressure || '', m.obs || '',
    ad.ativo, ad.tipoRegistro, ad.createdAt, ad.deletedAt, ad.deletedBy, now,
    m.flow    || m.mFlow    || m.vazao    || '',
    m.voltage || m.mVoltage || m.tensao   || '',
    m.ampere  || m.mAmpere  || m.corrente || ''
  ]);
  return { status: 'ok', action: 'inserted' };
}

// ═══════════════════════════════════════════════════════════════════════════
// SAVE PART MASTER
// ═══════════════════════════════════════════════════════════════════════════
function savePartMaster(p) {
  if (!p || !p.id) return { status: 'error', error: 'id da peça obrigatório' };

  ensureSheetHeaders('PARTS_MASTER', HEADERS.PARTS_MASTER);
  const sheet = getOrCreateSheet('PARTS_MASTER', HEADERS.PARTS_MASTER);
  const now = new Date().toISOString();
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const idxPartId  = headers.indexOf('Part_ID');
  const idxModelId = headers.indexOf('Model_ID');

  const scopeRaw = String(p.scope || p.partScope || 'direct').trim().toLowerCase();
  const partScope = scopeRaw === 'sub' ? 'sub' : 'direct';
  const row = [
    p.id, p.modelId || '', p.name || '', p.ref || '',
    p.partBrand || '', p.supplierPrimary || '',
    p.slot || '', parseInt(p.qty) || 1,
    parseInt(p.interval) || 0,
    p.criticality || 'normal',
    parseFloat(p.cost) || 0,
    p.obs || '',
    'SIM', 'PRODUCAO', now, '', '', now,
    partScope,
    partScope === 'sub' ? (p.subId || '') : '',
    partScope === 'sub' ? (p.subName || '') : '',
    partScope === 'sub' ? (p.subCategory || '') : '',
    partScope === 'sub' ? (p.subDesc || '') : '',
    partScope === 'sub' ? (parseInt(p.subInterval, 10) || 0) : ''
  ];

  const idxAtivo = headers.indexOf('Ativo');
  let activeRowIdx = -1;
  let deletedRowIdx = -1;

  for (let i = 1; i < data.length; i++) {
    const samePartId  = String(data[i][idxPartId]  || '').trim() === String(p.id       || '').trim();
    const sameModelId = String(data[i][idxModelId] || '').trim() === String(p.modelId  || '').trim();
    if (!samePartId || !sameModelId) continue;
    const isDeleted = idxAtivo >= 0 && String(data[i][idxAtivo] || '').trim().toUpperCase() === 'NÃO';
    if (isDeleted) {
      if (deletedRowIdx < 0) deletedRowIdx = i; // registra primeiro deletado
    } else {
      activeRowIdx = i; // linha ativa encontrada
      break;
    }
  }

  if (activeRowIdx >= 0) {
    // Atualiza a linha ativa existente no lugar
    sheet.getRange(activeRowIdx + 1, 1, 1, HEADERS.PARTS_MASTER.length).setValues([row]);
    return { status: 'ok', action: 'updated' };
  }

  if (deletedRowIdx >= 0) {
    // Existe linha soft-deletada para este Part_ID+Model_ID.
    // NUNCA criar nova linha — isso causaria ressurreição da peça.
    // O reconcileModelParts que roda logo após cobre a limpeza.
    return { status: 'ok', action: 'skipped_deleted' };
  }

  // Nenhuma linha encontrada — inserir nova
  sheet.appendRow(row);
  return { status: 'ok', action: 'inserted' };
}

// ═══════════════════════════════════════════════════════════════════════════
// REPLACE PART SIMILARITIES
// ═══════════════════════════════════════════════════════════════════════════
function replacePartSimilarities(partId, modelId, similarities) {
  if (!partId)  return { status: 'error', error: 'partId obrigatório' };
  if (!modelId) return { status: 'error', error: 'modelId obrigatório' };

  const sheet = getOrCreateSheet('PART_SIMILARITIES', HEADERS.PART_SIMILARITIES);
  const now = new Date().toISOString();
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const idxPid = headers.indexOf('Part_ID');
  const idxMid = headers.indexOf('Model_ID');

  const rowsToKeep = [headers];
  for (let i = 1; i < data.length; i++) {
    const samePart  = String(data[i][idxPid]).trim() === String(partId).trim();
    const sameModel = String(data[i][idxMid]).trim() === String(modelId).trim();
    if (!(samePart && sameModel)) rowsToKeep.push(data[i]);
  }

  sheet.clearContents();
  if (rowsToKeep.length > 0) {
    sheet.getRange(1, 1, rowsToKeep.length, HEADERS.PART_SIMILARITIES.length).setValues(rowsToKeep);
  }

  const newRows = (similarities || []).map((s, idx) => [
    'SIM-' + partId + '-' + modelId + '-' + idx,
    partId, modelId,
    typeof s === 'string' ? s : (s.ref   || ''),
    typeof s === 'object'  ? (s.brand || '') : '',
    typeof s === 'object'  ? (s.obs   || '') : '',
    'SIM', 'PRODUCAO', now, '', '', now
  ]);

  if (newRows.length > 0) {
    sheet.getRange(rowsToKeep.length + 1, 1, newRows.length, HEADERS.PART_SIMILARITIES.length).setValues(newRows);
  }

  return { status: 'ok', replaced: newRows.length };
}

function deletePartMaster(partId, modelId, deletedBy) {
  if (!partId) return { status: 'error', error: 'partId obrigatório' };
  if (!modelId) return { status: 'error', error: 'modelId obrigatório' };

  const now = new Date().toISOString();
  const actor = deletedBy || 'admin';
  const partsSheet = getOrCreateSheet('PARTS_MASTER', HEADERS.PARTS_MASTER);
  const partsData = partsSheet.getDataRange().getValues();
  const ph = partsData[0] || [];
  const pIdxPartId = ph.indexOf('Part_ID');
  const pIdxModelId = ph.indexOf('Model_ID');
  const pIdxAtivo = ph.indexOf('Ativo');
  const pIdxDeletedAt = ph.indexOf('Deleted_At');
  const pIdxDeletedBy = ph.indexOf('Deleted_By');
  const pIdxUpdatedAt = ph.indexOf('Updated_At');
  let partsInativadas = 0;

  for (let i = 1; i < partsData.length; i++) {
    const samePart = String(partsData[i][pIdxPartId] || '').trim() === String(partId).trim();
    const sameModel = String(partsData[i][pIdxModelId] || '').trim() === String(modelId).trim();
    if (samePart && sameModel) {
      if (pIdxAtivo >= 0) partsSheet.getRange(i + 1, pIdxAtivo + 1).setValue('NÃO');
      if (pIdxDeletedAt >= 0) partsSheet.getRange(i + 1, pIdxDeletedAt + 1).setValue(now);
      if (pIdxDeletedBy >= 0) partsSheet.getRange(i + 1, pIdxDeletedBy + 1).setValue(actor);
      if (pIdxUpdatedAt >= 0) partsSheet.getRange(i + 1, pIdxUpdatedAt + 1).setValue(now);
      partsInativadas++;
    }
  }

  const simResult = deletePartSimilaritiesByPartModel(partId, modelId, actor, now);
  return { status: 'ok', action: 'soft_deleted', partsInativadas: partsInativadas, similaridadesInativadas: simResult.count };
}

function deleteSubsystemParts(modelId, subId, deletedBy) {
  if (!modelId) return { status: 'error', error: 'modelId obrigatório' };
  if (!subId) return { status: 'error', error: 'subId obrigatório' };

  const now = new Date().toISOString();
  const actor = deletedBy || 'admin';
  const sheet = getOrCreateSheet('PARTS_MASTER', HEADERS.PARTS_MASTER);
  const data = sheet.getDataRange().getValues();
  const headers = data[0] || [];
  const idxModelId = headers.indexOf('Model_ID');
  const idxScope = headers.indexOf('Part_Scope');
  const idxSubId = headers.indexOf('Sub_ID');
  const idxPartId = headers.indexOf('Part_ID');
  const idxAtivo = headers.indexOf('Ativo');
  const idxDeletedAt = headers.indexOf('Deleted_At');
  const idxDeletedBy = headers.indexOf('Deleted_By');
  const idxUpdatedAt = headers.indexOf('Updated_At');
  const affectedParts = {};
  let partsInativadas = 0;

  for (let i = 1; i < data.length; i++) {
    const sameModel = String(data[i][idxModelId] || '').trim() === String(modelId).trim();
    const isSub = String(data[i][idxScope] || '').trim().toLowerCase() === 'sub';
    const sameSub = String(data[i][idxSubId] || '').trim() === String(subId).trim();
    if (sameModel && isSub && sameSub) {
      if (idxAtivo >= 0) sheet.getRange(i + 1, idxAtivo + 1).setValue('NÃO');
      if (idxDeletedAt >= 0) sheet.getRange(i + 1, idxDeletedAt + 1).setValue(now);
      if (idxDeletedBy >= 0) sheet.getRange(i + 1, idxDeletedBy + 1).setValue(actor);
      if (idxUpdatedAt >= 0) sheet.getRange(i + 1, idxUpdatedAt + 1).setValue(now);
      affectedParts[String(data[i][idxPartId] || '').trim()] = true;
      partsInativadas++;
    }
  }

  let similaritiesInativadas = 0;
  Object.keys(affectedParts).forEach(function(pid) {
    if (pid) similaritiesInativadas += deletePartSimilaritiesByPartModel(pid, modelId, actor, now).count;
  });

  return { status: 'ok', action: 'soft_deleted', partsInativadas: partsInativadas, similaridadesInativadas: similaritiesInativadas };
}

function reconcileModelParts(modelId, activePartIds, deletedBy) {
  if (!modelId) return { status: 'error', error: 'modelId obrigatório' };

  const now = new Date().toISOString();
  const actor = deletedBy || 'admin';
  const activeMap = {};
  (activePartIds || []).forEach(function(pid) { activeMap[String(pid).trim()] = true; });

  const sheet = getOrCreateSheet('PARTS_MASTER', HEADERS.PARTS_MASTER);
  const data = sheet.getDataRange().getValues();
  const headers = data[0] || [];
  const idxPartId = headers.indexOf('Part_ID');
  const idxModelId = headers.indexOf('Model_ID');
  const idxAtivo = headers.indexOf('Ativo');
  const idxDeletedAt = headers.indexOf('Deleted_At');
  const idxDeletedBy = headers.indexOf('Deleted_By');
  const idxUpdatedAt = headers.indexOf('Updated_At');
  let inativadas = 0;
  let simsInativadas = 0;

  for (let i = 1; i < data.length; i++) {
    const sameModel = String(data[i][idxModelId] || '').trim() === String(modelId).trim();
    if (!sameModel) continue;
    const pid = String(data[i][idxPartId] || '').trim();
    if (!pid || activeMap[pid]) continue;

    if (idxAtivo >= 0) sheet.getRange(i + 1, idxAtivo + 1).setValue('NÃO');
    if (idxDeletedAt >= 0) sheet.getRange(i + 1, idxDeletedAt + 1).setValue(now);
    if (idxDeletedBy >= 0) sheet.getRange(i + 1, idxDeletedBy + 1).setValue(actor);
    if (idxUpdatedAt >= 0) sheet.getRange(i + 1, idxUpdatedAt + 1).setValue(now);
    simsInativadas += deletePartSimilaritiesByPartModel(pid, modelId, actor, now).count;
    inativadas++;
  }

  return { status: 'ok', action: 'reconciled', partsInativadas: inativadas, similaridadesInativadas: simsInativadas };
}

function deletePartSimilaritiesByPartModel(partId, modelId, deletedBy, nowOpt) {
  const now = nowOpt || new Date().toISOString();
  const actor = deletedBy || 'admin';
  const sheet = getOrCreateSheet('PART_SIMILARITIES', HEADERS.PART_SIMILARITIES);
  const data = sheet.getDataRange().getValues();
  const headers = data[0] || [];
  const idxPid = headers.indexOf('Part_ID');
  const idxMid = headers.indexOf('Model_ID');
  const idxAtivo = headers.indexOf('Ativo');
  const idxDeletedAt = headers.indexOf('Deleted_At');
  const idxDeletedBy = headers.indexOf('Deleted_By');
  const idxUpdatedAt = headers.indexOf('Updated_At');
  let count = 0;

  for (let i = 1; i < data.length; i++) {
    const samePart = String(data[i][idxPid] || '').trim() === String(partId).trim();
    const sameModel = String(data[i][idxMid] || '').trim() === String(modelId).trim();
    if (samePart && sameModel) {
      if (idxAtivo >= 0) sheet.getRange(i + 1, idxAtivo + 1).setValue('NÃO');
      if (idxDeletedAt >= 0) sheet.getRange(i + 1, idxDeletedAt + 1).setValue(now);
      if (idxDeletedBy >= 0) sheet.getRange(i + 1, idxDeletedBy + 1).setValue(actor);
      if (idxUpdatedAt >= 0) sheet.getRange(i + 1, idxUpdatedAt + 1).setValue(now);
      count++;
    }
  }
  return { count: count };
}

// ═══════════════════════════════════════════════════════════════════════════
// GET CATALOG FULL
// ═══════════════════════════════════════════════════════════════════════════
function getCatalogFull() {
  ensureSheetHeaders('MODELOS',           HEADERS.MODELOS);
  ensureSheetHeaders('PARTS_MASTER',      HEADERS.PARTS_MASTER);
  ensureSheetHeaders('PART_SIMILARITIES', HEADERS.PART_SIMILARITIES);
  ensureSheetHeaders('SUBSISTEMAS_LIB',    HEADERS.SUBSISTEMAS_LIB);
  ensureSheetHeaders('SUBSISTEMA_LIB_PARTS',     HEADERS.SUBSISTEMA_LIB_PARTS);
  ensureSheetHeaders('MODELO_SUBSISTEMA_LIB',     HEADERS.MODELO_SUBSISTEMA_LIB);
  return {
    status:         'ok',
    models:         getSheetDataActive('MODELOS'),
    parts:          getSheetDataActive('PARTS_MASTER'),
    similarities:   getSheetDataActive('PART_SIMILARITIES'),
    // v24 — Biblioteca de Subsistemas (eram as chaves ausentes que causavam biblioteca vazia no PCM)
    subsistemasLib: getSheetDataActive('SUBSISTEMAS_LIB'),
    subLibParts:    getSheetDataActive('SUBSISTEMA_LIB_PARTS'),
    modeloSubLinks: getSheetDataActive('MODELO_SUBSISTEMA_LIB')
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// SAVE / UPDATE CLIENT
// ═══════════════════════════════════════════════════════════════════════════
function saveClient(c) {
  if (!c) return { status: 'error', error: 'Dados ausentes' };
  const sheet = getOrCreateSheet('CLIENTES', HEADERS.CLIENTES);
  const now = new Date().toISOString();
  const ad = auditDefaults(c.tipoRegistro);

  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const idxId = headers.indexOf('ID');

  // v1.5: helper para não sobrescrever campo existente com vazio
  const mergeVal = (newVal, existVal) => (newVal && String(newVal).trim()) ? String(newVal).trim() : String(existVal || '');

  const buildRow = (ativo, tipo, created, existing) => {
    const ex = existing || {};
    return [
      c.id || ex['ID'] || 'CLI-' + new Date().getTime(),
      mergeVal(c.nome,         ex['Nome']),
      mergeVal(c.cnpj,         ex['CNPJ']),
      mergeVal(c.cidade,       ex['Cidade']),
      mergeVal(c.telefone,     ex['Telefone']),
      mergeVal(c.email,        ex['Email']),
      mergeVal(c.observacoes || c.obs, ex['Observações']),
      parseInt(c.antecedencia_alerta_dias) || parseInt(ex['Antecedencia_Alerta_Dias']) || 0,
      mergeVal(c.drive_url,    ex['Drive_URL']),
      ativo, tipo, created, '', '', now,
      // v1.5: novas colunas
      mergeVal(c.contato,      ex['Contato']),
      mergeVal(c.filial,       ex['Filial']),
      mergeVal(c.nextVisit || c.prox_visita, ex['Prox_Visita']),
      mergeVal(c.lastVisit  || c.ult_visita, ex['Ult_Visita']),
      // v1.10: endereço e UF
      mergeVal(c.endereco,     ex['Endereco']),
      mergeVal(c.uf,           ex['UF']),
    ];
  };

  const idxNome = headers.indexOf('Nome');
  const idxCnpj = headers.indexOf('CNPJ');
  const normNovo = clientKey(c.nome || '');
  const onlyDigits = v => String(v || '').replace(/\D/g, '');
  const cnpjNovo = onlyDigits(c.cnpj);
  let _foundRow = -1;
  let _matchType = '';

  for (let i = 1; i < data.length; i++) {
    const rowId   = String(data[i][idxId]   || '').trim();
    const rowNome = idxNome >= 0 ? String(data[i][idxNome] || '').trim() : '';
    if (rowId && rowId === String(c.id || '').trim()) {
      _foundRow = i; _matchType = 'id'; break;
    }
    const rowCnpj = idxCnpj >= 0 ? onlyDigits(data[i][idxCnpj]) : '';
    if (!_matchType && cnpjNovo && rowCnpj && cnpjNovo === rowCnpj) {
      _foundRow = i; _matchType = 'cnpj';
    }
    if (normNovo && clientKey(rowNome) === normNovo && _foundRow < 0) {
      _foundRow = i; _matchType = 'nome';
    }
  }

  if (_foundRow >= 0) {
    const idxCreated = headers.indexOf('Created_At');
    const idxTipo    = headers.indexOf('Tipo_Registro');
    const idxAtivo   = headers.indexOf('Ativo');
    if (_matchType === 'nome') {
      c.id = String(data[_foundRow][idxId] || c.id).trim();
      Logger.log('saveClient GAS: match por nome — usando ID da planilha: ' + c.id);
    }
    // v1.5: montar objeto da linha existente para merge seguro
    const existingObj = {};
    headers.forEach((h, i) => { existingObj[h] = data[_foundRow][i]; });
    const rowData = buildRow(
      String(data[_foundRow][idxAtivo]   || 'SIM'),
      String(data[_foundRow][idxTipo]    || 'PRODUCAO'),
      String(data[_foundRow][idxCreated] || now),
      existingObj
    );
    // Garantir que o row tenha comprimento suficiente para colunas novas
    while (rowData.length < HEADERS.CLIENTES.length) rowData.push('');
    sheet.getRange(_foundRow + 1, 1, 1, HEADERS.CLIENTES.length).setValues([rowData]);
    return { status: 'ok', action: 'updated', matchedBy: _matchType };
  }

  const newRow = buildRow(ad.ativo, ad.tipoRegistro, ad.createdAt, {});
  while (newRow.length < HEADERS.CLIENTES.length) newRow.push('');
  sheet.appendRow(newRow);
  return { status: 'ok', action: 'inserted' };
}

function mergeClients(body) {
  const { sourceId, sourceName, targetId, targetName, client, deletedBy } = body || {};
  const now = new Date().toISOString();
  Logger.log('[GAS mergeClients] source: ' + sourceName + ' (' + sourceId + ') → target: ' + targetName + ' (' + targetId + ')');
  const clientSheet = getOrCreateSheet('CLIENTES', HEADERS.CLIENTES);
  const clientData = clientSheet.getDataRange().getValues();
  const cHeaders = clientData[0];
  const idxCId = cHeaders.indexOf('ID');
  const idxCNome = cHeaders.indexOf('Nome');
  const idxAtivo = cHeaders.indexOf('Ativo');
  const idxDelAt = cHeaders.indexOf('Deleted_At');
  const idxDelBy = cHeaders.indexOf('Deleted_By');
  const ck = v => clientKey(String(v || ''));
  let targetRow = -1, sourceRow = -1;
  for (let i = 1; i < clientData.length; i++) {
    const rowId = String(clientData[i][idxCId] || '').trim();
    const rowNome = String(clientData[i][idxCNome] || '').trim();
    if (rowId === String(targetId || '').trim() || ck(rowNome) === ck(targetName)) if (targetRow < 0) targetRow = i;
    if (rowId === String(sourceId || '').trim() || rowNome === sourceName) if (sourceRow < 0) sourceRow = i;
  }
  if (targetRow >= 0 && client) {
    const existingObj = {};
    cHeaders.forEach((h, i) => { existingObj[h] = clientData[targetRow][i]; });
    const mergeVal = (nv, ev) => (nv && String(nv).trim()) ? String(nv).trim() : String(ev || '');
    const updatedRow = cHeaders.map(h => {
      switch (h) {
        case 'Nome': return mergeVal(client.nome, existingObj['Nome']);
        case 'CNPJ': return mergeVal(client.cnpj, existingObj['CNPJ']);
        case 'Cidade': return mergeVal(client.cidade, existingObj['Cidade']);
        case 'Telefone': return mergeVal(client.telefone, existingObj['Telefone']);
        case 'Email': return mergeVal(client.email, existingObj['Email']);
        case 'Drive_URL': return mergeVal(client.drive_url, existingObj['Drive_URL']);
        case 'Observações': return mergeVal(client.observacoes, existingObj['Observações']);
        case 'Atualizado': return now;
        default: return existingObj[h] !== undefined ? existingObj[h] : '';
      }
    });
    clientSheet.getRange(targetRow + 1, 1, 1, cHeaders.length).setValues([updatedRow]);
  }
  let sourceDeactivated = false;
  if (sourceRow >= 0 && sourceRow !== targetRow) {
    if (idxAtivo >= 0) clientSheet.getRange(sourceRow + 1, idxAtivo + 1).setValue('NÃO');
    if (idxDelAt >= 0) clientSheet.getRange(sourceRow + 1, idxDelAt + 1).setValue(now);
    if (idxDelBy >= 0) clientSheet.getRange(sourceRow + 1, idxDelBy + 1).setValue(deletedBy || 'merge');
    sourceDeactivated = true;
  }
  const machSheet = getOrCreateSheet('MAQUINAS', HEADERS.MAQUINAS);
  const machData = machSheet.getDataRange().getValues();
  const mHeaders = machData[0];
  const idxMCli = mHeaders.indexOf('Cliente');
  const isSuspect = isSuspectClientTerm(sourceName);
  let machinesUpdated = 0;
  for (let i = 1; i < machData.length; i++) {
    const rowCli = String(machData[i][idxMCli] || '').trim();
    const matches = isSuspect ? (rowCli === sourceName) : (ck(rowCli) === ck(sourceName) || rowCli === sourceName);
    if (matches) { machSheet.getRange(i + 1, idxMCli + 1).setValue(targetName); machinesUpdated++; }
  }
  const visitSheet = getOrCreateSheet('VISITAS', HEADERS.VISITAS);
  const visitData = visitSheet.getDataRange().getValues();
  const vHeaders = visitData[0];
  const idxVCli = vHeaders.indexOf('Cliente');
  let visitsUpdated = 0;
  if (idxVCli >= 0) for (let i = 1; i < visitData.length; i++) {
    const rowCli = String(visitData[i][idxVCli] || '').trim();
    const matches = isSuspect ? (rowCli === sourceName) : (ck(rowCli) === ck(sourceName) || rowCli === sourceName);
    if (matches) { visitSheet.getRange(i + 1, idxVCli + 1).setValue(targetName); visitsUpdated++; }
  }
  Logger.log('[GAS mergeClients] machinesUpdated: ' + machinesUpdated + ', visitsUpdated: ' + visitsUpdated + ', sourceDeactivated: ' + sourceDeactivated);
  return { status: 'ok', merged: true, targetId, targetName, sourceId, sourceName, machinesUpdated, visitsUpdated, sourceDeactivated };
}

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════
function ensureMachineFromVisit(body, machineId, visitDate, now) {
  const sheet = getOrCreateSheet('MAQUINAS', HEADERS.MAQUINAS);
  const data = sheet.getDataRange().getValues();
  const headers = data[0];

  const idxId  = headers.indexOf('ID');
  const idxCli = headers.indexOf('Cliente');
  const idxFil = headers.indexOf('Filial');
  const idxMar = headers.indexOf('Marca');
  const idxMod = headers.indexOf('Modelo');
  const idxSer = headers.indexOf('Série');
  const idxAno = headers.indexOf('Ano');
  const idxTag = headers.indexOf('TAG');
  const idxLoc = headers.indexOf('Localização');
  const idxHor = headers.indexOf('Hor.Total');
  const idxHpw = headers.indexOf('h/Semana');
  const idxObs = headers.indexOf('Observações');
  const idxUpd = headers.indexOf('Atualizado');
  const idxAtivo = headers.indexOf('Ativo');
  // v1.9: novos campos de MAQUINAS
  const idxPot = headers.indexOf('Potência');
  const idxTipoEq = headers.indexOf('Tipo_Equip');
  const idxObsOp  = headers.indexOf('Obs_Op');

  const client    = body.client    || '';
  const branch    = body.branch    || '';
  const brand     = body.brand     || '';
  const model     = body.model     || '';
  const serial    = body.serial    || '';
  const year      = body.year      || '';
  const tag       = body.tag       || '';
  const location  = body.location  || '';
  const hourTotal = parseInt(body.hourTotal) || 0;
  const hpw       = parseInt(body.hpw)       || 0;
  const obs       = body.generalObs || body.obs || '';
  const potencia  = body.potencia  || '';
  const tipoEquip = body.tipoEquip || '';  // tipo de equipamento (ex: Compressor Parafuso) — separado do tipo de visita
  const obsOp     = body.obsOp     || '';

  // v1.8: resolver cliente canônico antes de qualquer comparação
  const clientCanonical = (!isSuspectClientTerm(client) ? resolveCanonicalClientName(client) : '') || client;

  // Helper: aplica campos na linha i+1 sem sobrescrever ID existente
  const applyRow = (rowIdx, preserveId) => {
    const existingId = String(data[rowIdx][idxId] || '').trim();
    // NUNCA sobrescreve um ID já existente com um diferente — protege contra corrompimento
    const finalId = preserveId ? existingId : (machineId || existingId);
    sheet.getRange(rowIdx + 1, idxId  + 1).setValue(finalId);
    if (clientCanonical) sheet.getRange(rowIdx + 1, idxCli + 1).setValue(clientCanonical);
    if (branch)   sheet.getRange(rowIdx + 1, idxFil + 1).setValue(branch);
    if (brand)    sheet.getRange(rowIdx + 1, idxMar + 1).setValue(brand);
    if (model)    sheet.getRange(rowIdx + 1, idxMod + 1).setValue(model);
    if (serial)   sheet.getRange(rowIdx + 1, idxSer + 1).setValue(serial);
    if (year)     sheet.getRange(rowIdx + 1, idxAno + 1).setValue(year);
    if (tag)      sheet.getRange(rowIdx + 1, idxTag + 1).setValue(tag);
    if (location) sheet.getRange(rowIdx + 1, idxLoc + 1).setValue(location);
    if (hourTotal > 0) sheet.getRange(rowIdx + 1, idxHor + 1).setValue(hourTotal);
    if (hpw)      sheet.getRange(rowIdx + 1, idxHpw + 1).setValue(hpw);
    if (obs)      sheet.getRange(rowIdx + 1, idxObs + 1).setValue(obs);
    // v1.9: gravar potência, tipo de equipamento e obs operacionais se disponíveis
    if (potencia  && idxPot    >= 0) sheet.getRange(rowIdx + 1, idxPot    + 1).setValue(potencia);
    if (tipoEquip && idxTipoEq >= 0) sheet.getRange(rowIdx + 1, idxTipoEq + 1).setValue(tipoEquip);
    if (obsOp     && idxObsOp  >= 0) sheet.getRange(rowIdx + 1, idxObsOp  + 1).setValue(obsOp);
    sheet.getRange(rowIdx + 1, idxUpd + 1).setValue(now);
    return finalId;
  };

  // ── Passagem 1: match por Machine_ID exato ────────────────────────────
  if (machineId) {
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][idxId] || '').trim() === machineId) {
        const usedId = applyRow(i, false);
        return { status: 'ok', action: 'updated', matchedBy: 'id', machineId: usedId };
      }
    }
  }

  // ── Passagem 2: match robusto por marca+modelo+série (v1.8) ──────────
  // Requer que série (ou tag), marca e modelo coincidam — evita falso positivo
  for (let i = 1; i < data.length; i++) {
    const rowAtivo = String(data[i][idxAtivo] || 'SIM').toUpperCase();
    if (rowAtivo === 'NÃO') continue;
    const rowBrand  = String(data[i][idxMar] || '');
    const rowModel  = String(data[i][idxMod] || '');
    const rowSerial = String(data[i][idxSer] || '');
    const rowTag    = String(data[i][idxTag] || '');
    if (sameMachine(rowBrand, rowModel, rowSerial, rowTag, brand, model, serial, tag)) {
      Logger.log('ensureMachineFromVisit: match marca+modelo+série linha=' + i);
      const usedId = applyRow(i, true); // preserva o ID existente
      return { status: 'ok', action: 'updated', matchedBy: 'brand_model_serial', machineId: usedId };
    }
  }

  // ── Passagem 3: fallback por série única + validação de marca/modelo ──
  // Só aceita se a série for única na planilha E marca/modelo forem compatíveis
  if (serial) {
    const serialCompact = compactKey(serial);
    let uniqueMatch = null;
    let matchCount = 0;
    for (let j = 1; j < data.length; j++) {
      const rowAtivo = String(data[j][idxAtivo] || 'SIM').toUpperCase();
      if (rowAtivo === 'NÃO') continue;
      if (compactKey(String(data[j][idxSer] || '')) === serialCompact) {
        uniqueMatch = j; matchCount++;
        if (matchCount > 1) break;
      }
    }
    if (matchCount === 1 && uniqueMatch !== null) {
      const j = uniqueMatch;
      const rowBrand = String(data[j][idxMar] || '');
      const rowModel = String(data[j][idxMod] || '');
      const rowCli   = String(data[j][idxCli] || '').trim();
      // v1.8: validar marca+modelo antes de aceitar o fallback
      const brandCompatible = !compactKey(rowBrand) || !compactKey(brand) || compactKey(rowBrand) === compactKey(brand);
      const modelCompatible = !compactKey(rowModel) || !compactKey(model) || compactKey(rowModel) === compactKey(model);
      if (!brandCompatible || !modelCompatible) {
        Logger.log('ensureMachineFromVisit: serial_unique REJEITADO por marca/modelo incompatível. Row:' + rowBrand + '/' + rowModel + ' vs ' + brand + '/' + model);
        // Não aplica — vai inserir nova linha abaixo
      } else {
        Logger.log('ensureMachineFromVisit: serial_unique match linha=' + j + ' cliente="' + rowCli + '" recebido="' + client + '"');
        const usedId = applyRow(j, true); // SEMPRE preserva o ID existente
        return { status: 'ok', action: 'updated', matchedBy: 'serial_unique', machineId: usedId };
      }
    }
  }

  // ── Passagem 4: inserir nova linha ────────────────────────────────────
  const finalId = machineId || machineKey(clientCanonical || client, brand, model, serial) || ('EQ-' + new Date().getTime());
  const newRow = [
    finalId,
    clientCanonical || client, branch, brand, model, serial, year, tag, location,
    hourTotal, hpw, obs,
    'SIM', 'PRODUCAO', now, '', '', now
  ];
  // v1.9: append optional columns only if headers exist
  if (idxPot >= 0 || idxTipoEq >= 0 || idxObsOp >= 0) {
    // pad array to cover new column positions
    while (newRow.length < HEADERS.MAQUINAS.length) newRow.push('');
    if (idxPot    >= 0) newRow[idxPot]    = potencia  || '';
    if (idxTipoEq >= 0) newRow[idxTipoEq] = tipoEquip || '';
    if (idxObsOp  >= 0) newRow[idxObsOp]  = obsOp     || '';
  }
  sheet.appendRow(newRow);
  return { status: 'ok', action: 'inserted', machineId: finalId };
}

function updateMachineHorímetro(machineId, client, serial, tag, hourTotal, visitDate) {
  const sheet = getOrCreateSheet('MAQUINAS', HEADERS.MAQUINAS);
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const idxId    = headers.indexOf('ID');
  const idxMar   = headers.indexOf('Marca');
  const idxMod   = headers.indexOf('Modelo');
  const idxSerie = headers.indexOf('Série');
  const idxTag   = headers.indexOf('TAG');
  const idxHor   = headers.indexOf('Hor.Total');
  const idxUpd   = headers.indexOf('Atualizado');

  for (let i = 1; i < data.length; i++) {
    const rowId    = String(data[i][idxId]    || '').trim();
    const rowBrand = String(data[i][idxMar]   || '');
    const rowModel = String(data[i][idxMod]   || '');
    const rowSer   = String(data[i][idxSerie] || '');
    const rowTag   = String(data[i][idxTag]   || '');
    // v1.8: match por ID exato OU por marca+modelo+série (robusto)
    const match = (machineId && rowId === String(machineId).trim()) ||
                  sameMachine(rowBrand, rowModel, rowSer, rowTag, '', '', serial, tag);
    if (match) {
      if (hourTotal > 0) sheet.getRange(i+1, idxHor+1).setValue(hourTotal);
      sheet.getRange(i+1, idxUpd+1).setValue(new Date().toISOString());
      return;
    }
  }
  Logger.log('updateMachineHorímetro: nenhuma linha encontrada para machineId=' + machineId + ' serial=' + serial);
}

// ═══════════════════════════════════════════════════════════════════════════
// SOFT DELETE (substitui deleteRow para MAQUINAS, MODELOS, CLIENTES)
// ═══════════════════════════════════════════════════════════════════════════
function softDelete(sheetName, id, deletedBy) {
  const sheet = getOrCreateSheet(sheetName, HEADERS[sheetName]);
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const idxId  = headers.indexOf('ID');
  const idxAlt = headers.indexOf('ID_Visita');
  const idxFinal = idxId >= 0 ? idxId : idxAlt;

  const idxAtivo      = headers.indexOf('Ativo');
  const idxDeletedAt  = headers.indexOf('Deleted_At');
  const idxDeletedBy  = headers.indexOf('Deleted_By');
  const idxAtualizado = headers.indexOf('Atualizado');
  const now = new Date().toISOString();

  for (let i = 1; i < data.length; i++) {
    if (String(data[i][idxFinal] || '').trim() === String(id).trim()) {
      if (idxAtivo      >= 0) sheet.getRange(i+1, idxAtivo+1).setValue('NÃO');
      if (idxDeletedAt  >= 0) sheet.getRange(i+1, idxDeletedAt+1).setValue(now);
      if (idxDeletedBy  >= 0) sheet.getRange(i+1, idxDeletedBy+1).setValue(deletedBy || 'admin');
      if (idxAtualizado >= 0) sheet.getRange(i+1, idxAtualizado+1).setValue(now);
      return { status: 'ok', action: 'soft_deleted' };
    }
  }
  return { status: 'ok', note: 'Não encontrado' };
}

// ═══════════════════════════════════════════════════════════════════════════
// HARD DELETE — apenas registros com Tipo_Registro = TESTE
// ═══════════════════════════════════════════════════════════════════════════
function hardDeleteTestRecord(sheetName, id) {
  if (!sheetName || !id) return { status: 'error', error: 'sheetName e id obrigatórios' };
  if (!HEADERS[sheetName]) return { status: 'error', error: 'Tabela inválida: ' + sheetName };

  const sheet = getOrCreateSheet(sheetName, HEADERS[sheetName]);
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const idxId   = headers.indexOf('ID');
  const idxTipo = headers.indexOf('Tipo_Registro');

  if (idxTipo < 0) return { status: 'error', error: 'Tabela sem coluna Tipo_Registro' };

  for (let i = 1; i < data.length; i++) {
    if (String(data[i][idxId] || '').trim() === String(id).trim()) {
      const tipo = String(data[i][idxTipo] || '').trim().toUpperCase();
      if (tipo !== 'TESTE') {
        return { status: 'error', error: 'Hard delete permitido apenas para TESTE. Este é: ' + (tipo || 'PRODUCAO') };
      }
      sheet.deleteRow(i + 1);
      return { status: 'ok', action: 'hard_deleted' };
    }
  }
  return { status: 'ok', note: 'Não encontrado' };
}


// ═══════════════════════════════════════════════════════════════════════════
// ORDENS DE SERVIÇO v20 — Sheet é a fonte de verdade; Drive guarda binários
// Setup manual: configurar Script Property ROOT_FOLDER_ID com a pasta-mãe do Drive,
// reautorizar DriveApp e publicar nova versão do Apps Script.
// ═══════════════════════════════════════════════════════════════════════════
function parseJsonArray_(value) {
  if (Array.isArray(value)) return value.map(String);
  try {
    const parsed = JSON.parse(String(value || '[]'));
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch (err) { return []; }
}

// ── v22: helpers do módulo de Ordens de Serviço ───────────────────────────

function stringifyArray_(arr) {
  return Array.isArray(arr) ? JSON.stringify(arr.map(String)) : String(arr || '[]');
}

// Aceita variações boolean/string para campos "ativo" vindos de diferentes
// caminhos de gravação (saveTecnico antigo gravava true/false; seeds gravam 'SIM').
function isActive_(v) {
  if (v === true) return true;
  if (v === false) return false;
  const s = String(v == null ? '' : v).trim().toUpperCase();
  return s === 'TRUE' || s === 'SIM' || s === '1' || s === 'ATIVO';
}

function normalizeOsStatus_(s) {
  const v = String(s || '').trim().toLowerCase();
  const map = {
    'aberta': 'aberta', 'aberto': 'aberta', 'pendente': 'aberta', '': 'aberta',
    'em andamento': 'em_andamento', 'em_andamento': 'em_andamento', 'iniciada': 'em_andamento',
    'concluida': 'concluida', 'concluída': 'concluida', 'finalizada': 'concluida',
    'finalizado': 'concluida', 'encerrada': 'concluida', 'encerrado': 'concluida',
    'cancelada': 'cancelada', 'cancelado': 'cancelada'
  };
  return map[v] || v || 'aberta';
}

function isOsClosed_(status) {
  const s = normalizeOsStatus_(status);
  return s === 'concluida' || s === 'cancelada';
}

function ensureOSHeaders_() {
  ensureSheetHeaders('ORDENS_SERVICO', HEADERS.ORDENS_SERVICO);
  ensureSheetHeaders('OS_MAQUINAS', HEADERS.OS_MAQUINAS);
  ensureSheetHeaders('LOG_OPERACIONAL', HEADERS.LOG_OPERACIONAL);
  ensureSheetHeaders('HISTORICO_OS', HEADERS.HISTORICO_OS);
  ensureSheetHeaders('OS_DRAFTS', HEADERS.OS_DRAFTS);
  ensureSheetHeaders('CAT_USUARIOS', HEADERS.CAT_USUARIOS);
  ensureSheetHeaders('CAT_PERFIS', HEADERS.CAT_PERFIS);
}

// Registra evento de auditoria. NUNCA lança erro — falha aqui não pode
// derrubar a operação principal que a chamou.
function registrarEventoOperacional_(evento) {
  try {
    const sheet = getOrCreateSheet('LOG_OPERACIONAL', HEADERS.LOG_OPERACIONAL);
    const agora = new Date().toISOString();
    const row = HEADERS.LOG_OPERACIONAL.map(function(h) {
      if (h === 'id_evento') return 'EVT-' + Date.now() + '-' + Math.floor(Math.random() * 1000);
      if (h === 'timestamp') return agora;
      const val = evento[h];
      return val === undefined || val === null ? '' : (typeof val === 'object' ? JSON.stringify(val) : val);
    });
    sheet.appendRow(row);
  } catch (e) {
    Logger.log('registrarEventoOperacional_ falhou: ' + e.message);
  }
}

// Gera id_os único sem colisão em escrita concorrente (usa contador em
// PropertiesService, mesmo padrão de generateOsNumber_).
function generateOsId_() {
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    const props = PropertiesService.getScriptProperties();
    const key = 'OS_ID_SEQ';
    const next = parseInt(props.getProperty(key) || '0', 10) + 1;
    props.setProperty(key, String(next));
    return 'OS-' + String(next).padStart(6, '0');
  } finally { lock.releaseLock(); }
}

function osRowToObject_(headers, row) {
  const obj = {};
  headers.forEach(function(h, i){ obj[h] = row[i] === undefined ? '' : row[i]; });
  return obj;
}

function generateOsNumber_() {
  const lock = LockService.getScriptLock(); lock.waitLock(15000);
  try {
    const ano = new Date().getFullYear();
    const props = PropertiesService.getScriptProperties();
    const key = 'OS_SEQ_' + ano;
    let maxSheet = 0;
    const rows = getSheetData('ORDENS_SERVICO');
    const re = new RegExp('^PGP-' + ano + '-(\\d+)$');
    (rows || []).forEach(function(r){
      const n = (r && (r['numero_os'] || r.numero_os)) || '';
      const m = re.exec(String(n)); if (m) maxSheet = Math.max(maxSheet, parseInt(m[1],10));
    });
    const next = Math.max(maxSheet, parseInt(props.getProperty(key)||'0',10)) + 1;
    props.setProperty(key, String(next));
    return 'PGP-' + ano + '-' + String(next).padStart(4,'0');
  } finally { lock.releaseLock(); }
}

function loginTecnico(body) {
  ensureOSHeaders_();
  const pinHash = String(body.pin_hash || '').trim();
  if (!pinHash) return { status: 'ok', valido: false, error: 'PIN inválido' };

  const sheet = getOrCreateSheet('CAT_USUARIOS', HEADERS.CAT_USUARIOS);
  const data = sheet.getDataRange().getValues();
  const headers = data[0] || HEADERS.CAT_USUARIOS;
  const idx = {}; headers.forEach(function(h,i){ idx[h]=i; });

  let tecRow = -1, tec = null;
  for (let r = 1; r < data.length; r++) {
    if (String(data[r][idx.pin_hash] || '').trim() === pinHash && isActive_(data[r][idx.ativo])) {
      tecRow = r + 1;
      tec = osRowToObject_(headers, data[r]);
      break;
    }
  }
  if (!tec) return { status: 'ok', valido: false, error: 'PIN inválido' };

  if (idx.ultimo_login_at >= 0 && tecRow > 0) {
    sheet.getRange(tecRow, idx.ultimo_login_at + 1).setValue(new Date().toISOString());
  }

  const osResult = getOS({ id_usuario: String(tec.id || '') });

  registrarEventoOperacional_({
    tipo_evento: 'LOGIN_USUARIO', id_usuario: tec.id, nome_usuario: tec.nome,
    acao_realizada: 'Login de usuário via PIN', responsavel_nome: tec.nome || 'usuário', origem: 'PCF'
  });

  return {
    status: 'ok', valido: true,
    tecnico: { id: tec.id || '', nome: tec.nome || '', perfil: tec.perfil || '' },
    os: osResult.os || []
  };
}

function saveOS(body) {
  ensureOSHeaders_();
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    const sheet = getOrCreateSheet('ORDENS_SERVICO', HEADERS.ORDENS_SERVICO);
    const data = sheet.getDataRange().getValues();
    const headers = data[0] || HEADERS.ORDENS_SERVICO;
    const idx = {}; headers.forEach(function(h,i){ idx[h]=i; });
    const now = new Date().toISOString();
    const responsavel = body.responsavel || body.usuario_atual || body.tecnico_atual || 'sistema';

    let id = String(body.id_os || '').trim();
    let rowNum = -1;
    if (id && idx.id_os >= 0) {
      for (let r = 1; r < data.length; r++) {
        if (String(data[r][idx.id_os] || '').trim() === id) { rowNum = r + 1; break; }
      }
      if (rowNum < 0) return { status: 'error', error: 'OS não encontrada: ' + id };
    }

    // ── Criação ──────────────────────────────────────────────────────────
    if (rowNum < 0) {
      if (!body.id_cliente) return { status: 'error', error: 'id_cliente é obrigatório.' };

      const tipoOs = String(body.tipo_os || '').trim() || 'MANUT_SIMPLES';

      // Verificação de duplicidade de numero_os (se informado explicitamente)
      const numeroPretendido = body.numero_os ? String(body.numero_os).trim() : '';
      if (numeroPretendido && idx.numero_os >= 0) {
        for (let v = 1; v < data.length; v++) {
          if (String(data[v][idx.numero_os] || '').trim().toLowerCase() === numeroPretendido.toLowerCase()) {
            return { status: 'error', error: 'OS com numero_os=' + numeroPretendido + ' já existe.', id_os_existente: String(data[v][idx.id_os] || '') };
          }
        }
      }

      const novoId = generateOsId_();
      const numero = numeroPretendido || generateOsNumber_();
      // Aceita campo novo ou antigo para compat com PCM até Sessão 3
      const tecsRaw = body.usuarios_vinculados !== undefined ? body.usuarios_vinculados : body.tecnicos_vinculados;
      const tecsArr = Array.isArray(tecsRaw) ? tecsRaw : parseJsonArray_(tecsRaw);
      const maqsArr = Array.isArray(body.maquinas_vinculadas) ? body.maquinas_vinculadas : parseJsonArray_(body.maquinas_vinculadas);

      const obj = {
        id_os: novoId, numero_os: numero, id_cliente: body.id_cliente || '', cliente: body.cliente || '',
        descricao: body.descricao || '',
        data_abertura: body.data_abertura || now, data_prevista: body.data_prevista || '',
        status: normalizeOsStatus_(body.status || 'aberta'),
        usuarios_vinculados: stringifyArray_(tecsArr),
        maquinas_vinculadas: stringifyArray_(maqsArr),
        id_visita_resultado: body.id_visita_resultado || '',
        drive_folder_id: body.drive_folder_id || '', drive_folder_url: body.drive_folder_url || '',
        inicio_atendimento: body.inicio_atendimento || '', fim_atendimento: body.fim_atendimento || '',
        pdf_url: body.pdf_url || '', tipo_os: tipoOs,
        Ativo: 'SIM', Created_At: now, Updated_At: now, Created_By: responsavel, Updated_By: responsavel,
        usuario_atual: body.usuario_atual || body.tecnico_atual || '', responsavel_cliente: '', observacao_fechamento: '',
        assinatura_usuario_url: '', assinatura_cliente_url: '',
        total_maquinas: maqsArr.length, visit_ids_resultado_json: '[]', last_sync_at: now,
        motivo_cancelamento: '', motivo_encerramento_sem_conclusao: '',
        prioridade: body.prioridade || 'normal', canal_origem: body.canal_origem || 'manager'
      };
      sheet.appendRow(headers.map(function(h){ return obj[h] !== undefined ? obj[h] : ''; }));

      // Vincula máquinas em OS_MAQUINAS, se informadas na criação
      maqsArr.forEach(function(mk){
        _upsertOsMaquina_(novoId, numero, String(mk), body.id_cliente || '', responsavel);
      });

      registrarEventoOperacional_({
        tipo_evento: 'CRIACAO_OS', id_os: novoId, numero_os: numero,
        id_cliente: body.id_cliente, cliente: body.cliente,
        status_novo: obj.status, acao_realizada: 'OS criada',
        responsavel_nome: responsavel, origem: 'PCM', observacao: body.descricao || ''
      });

      return { status: 'ok', id_os: novoId, os: obj };
    }

    // ── Edição (update parcial) ───────────────────────────────────────────
    const ALLOWED = [
      'status', 'descricao', 'data_prevista', 'usuarios_vinculados', 'maquinas_vinculadas',
      'id_visita_resultado', 'visit_ids_resultado_json', 'inicio_atendimento', 'fim_atendimento',
      'pdf_url', 'drive_folder_id', 'drive_folder_url',
      'usuario_atual', 'responsavel_cliente', 'observacao_fechamento',
      'assinatura_usuario_url', 'assinatura_cliente_url',
      'motivo_cancelamento', 'motivo_encerramento_sem_conclusao', 'prioridade',
      'cliente', 'id_cliente', 'data_abertura', 'tipo_os', 'numero_os'
    ];

    const statusAnterior = idx.status >= 0 ? String(data[rowNum - 1][idx.status] || '') : '';
    const statusNovoBruto = body.status !== undefined ? normalizeOsStatus_(body.status) : undefined;

    // Se a edição encerra a OS (concluida/cancelada) e ela ainda não estava
    // encerrada, valida campos mínimos de fechamento por tipo_os ANTES de
    // gravar qualquer coisa.
    if (statusNovoBruto && isOsClosed_(statusNovoBruto) && !isOsClosed_(statusAnterior)) {
      const tipoOsAtual = idx.tipo_os >= 0 ? String(data[rowNum - 1][idx.tipo_os] || 'Preventiva') : 'Preventiva';
      const obsFechamento = body.observacao_fechamento !== undefined
        ? String(body.observacao_fechamento || '')
        : String(idx.observacao_fechamento >= 0 ? data[rowNum - 1][idx.observacao_fechamento] || '' : '');
      const visitIds = body.visit_ids_resultado_json !== undefined
        ? parseJsonArray_(body.visit_ids_resultado_json)
        : parseJsonArray_(idx.visit_ids_resultado_json >= 0 ? data[rowNum - 1][idx.visit_ids_resultado_json] : '');

      if (statusNovoBruto === 'concluida') {
        if (tipoOsAtual === 'Preventiva') {
          if (visitIds.length === 0 && !obsFechamento.trim()) {
            return { status: 'error', error: 'FECHAMENTO_INCOMPLETO: Preventiva sem visita vinculada precisa de observação de fechamento explicando o motivo.' };
          }
        } else {
          if (!obsFechamento.trim()) {
            return { status: 'error', error: 'FECHAMENTO_INCOMPLETO: observacao_fechamento é obrigatória para concluir OS do tipo ' + tipoOsAtual + '.' };
          }
        }
      }
    }

    // Compat: aceita campo antigo tecnicos_vinculados/tecnico_atual até Sessão 3
    if (body.tecnicos_vinculados !== undefined && body.usuarios_vinculados === undefined) {
      body.usuarios_vinculados = body.tecnicos_vinculados;
    }
    if (body.tecnico_atual !== undefined && body.usuario_atual === undefined) {
      body.usuario_atual = body.tecnico_atual;
    }
    if (body.assinatura_tecnico_url !== undefined && body.assinatura_usuario_url === undefined) {
      body.assinatura_usuario_url = body.assinatura_tecnico_url;
    }
    ALLOWED.forEach(function(k){
      if (Object.prototype.hasOwnProperty.call(body, k) && idx[k] >= 0) {
        let v = body[k];
        if (k === 'usuarios_vinculados' || k === 'maquinas_vinculadas' || k === 'visit_ids_resultado_json') {
          v = stringifyArray_(Array.isArray(v) ? v : parseJsonArray_(v));
        } else if (k === 'status') {
          v = normalizeOsStatus_(v);
        }
        sheet.getRange(rowNum, idx[k] + 1).setValue(v);
      }
    });

    if (idx.maquinas_vinculadas >= 0 && Object.prototype.hasOwnProperty.call(body, 'maquinas_vinculadas')) {
      const novasMaqs = Array.isArray(body.maquinas_vinculadas) ? body.maquinas_vinculadas : parseJsonArray_(body.maquinas_vinculadas);
      if (idx.total_maquinas >= 0) sheet.getRange(rowNum, idx.total_maquinas + 1).setValue(novasMaqs.length);
    }
    if (idx.Updated_At >= 0) sheet.getRange(rowNum, idx.Updated_At + 1).setValue(now);
    if (idx.Updated_By >= 0) sheet.getRange(rowNum, idx.Updated_By + 1).setValue(responsavel);
    if (idx.last_sync_at >= 0) sheet.getRange(rowNum, idx.last_sync_at + 1).setValue(now);

    const updated = sheet.getRange(rowNum, 1, 1, headers.length).getValues()[0];
    const osAtualizada = osRowToObject_(headers, updated);

    registrarEventoOperacional_({
      tipo_evento: statusNovoBruto && isOsClosed_(statusNovoBruto) && !isOsClosed_(statusAnterior)
        ? (statusNovoBruto === 'cancelada' ? 'CANCELAMENTO_OS' : 'CONCLUSAO_OS')
        : (statusNovoBruto === 'em_andamento' && statusAnterior !== 'em_andamento' ? 'ABERTURA_OS_CAMPO' : 'EDICAO_OS'),
      id_os: id, numero_os: osAtualizada.numero_os, id_cliente: osAtualizada.id_cliente, cliente: osAtualizada.cliente,
      status_anterior: statusAnterior, status_novo: osAtualizada.status,
      acao_realizada: 'OS atualizada', responsavel_nome: responsavel,
      origem: body._origem || 'PCM', observacao: body.observacao_fechamento || ''
    });

    // Grava snapshot em HISTORICO_OS quando a OS é encerrada nesta chamada
    if (statusNovoBruto && isOsClosed_(statusNovoBruto) && !isOsClosed_(statusAnterior)) {
      _gravarHistoricoOS_(osAtualizada, responsavel);
    }

    return { status: 'ok', os: osAtualizada };
  } finally {
    lock.releaseLock();
  }
}

// Cria/atualiza vínculo em OS_MAQUINAS (idempotente por id_os + machineKey)
function _upsertOsMaquina_(idOs, numeroOs, machineKeyVal, idCliente, responsavel) {
  const sheet = getOrCreateSheet('OS_MAQUINAS', HEADERS.OS_MAQUINAS);
  const data = sheet.getDataRange().getValues();
  const headers = data[0] || HEADERS.OS_MAQUINAS;
  const idx = {}; headers.forEach(function(h,i){ idx[h]=i; });
  const now = new Date().toISOString();
  for (let r = 1; r < data.length; r++) {
    if (String(data[r][idx.id_os] || '') === String(idOs) && String(data[r][idx.machineKey] || '') === String(machineKeyVal)) {
      if (idx.Ativo >= 0) sheet.getRange(r + 1, idx.Ativo + 1).setValue('SIM');
      if (idx.Updated_At >= 0) sheet.getRange(r + 1, idx.Updated_At + 1).setValue(now);
      return;
    }
  }
  const novo = {
    id_link: 'OSM-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
    id_os: idOs, numero_os: numeroOs, machineKey: machineKeyVal, id_cliente: idCliente,
    status_atendimento: 'pendente', id_visita_resultado: '', observacao_maquina: '',
    Created_At: now, Created_By: responsavel, Updated_At: now, Ativo: 'SIM'
  };
  sheet.appendRow(headers.map(function(h){ return novo[h] !== undefined ? novo[h] : ''; }));
}

// Grava snapshot imutável em HISTORICO_OS no encerramento (concluida/cancelada).
// Não-bloqueante: erro aqui não impede o retorno de sucesso de saveOS.
function _gravarHistoricoOS_(os, responsavel) {
  try {
    const sheet = getOrCreateSheet('HISTORICO_OS', HEADERS.HISTORICO_OS);
    const dataOsm = getSheetData('OS_MAQUINAS').filter(function(r){
      return String(r.id_os || '') === String(os.id_os) && isActive_(r.Ativo);
    });
    let atendidas = 0, pendentes = 0;
    dataOsm.forEach(function(r){
      if (String(r.status_atendimento || '') === 'atendida') atendidas++; else pendentes++;
    });
    const now = new Date().toISOString();
    const row = {
      id_historico: 'HOS-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
      id_os: os.id_os, numero_os: os.numero_os, id_cliente: os.id_cliente, cliente: os.cliente, tipo_os: os.tipo_os,
      data_abertura: os.data_abertura, data_encerramento: now, status_final: os.status,
      tecnicos_vinculados_json: os.usuarios_vinculados || os.tecnicos_vinculados, total_maquinas: dataOsm.length,
      maquinas_atendidas: atendidas, maquinas_pendentes: pendentes,
      visit_ids_resultado_json: os.visit_ids_resultado_json || '[]', pdf_url: os.pdf_url || '',
      assinatura_tecnico_url: os.assinatura_usuario_url || os.assinatura_tecnico_url || '', assinatura_cliente_url: os.assinatura_cliente_url || '',
      observacao_fechamento: os.observacao_fechamento || '', motivo_cancelamento: os.motivo_cancelamento || '',
      encerrada_por: responsavel, timestamp: now
    };
    sheet.appendRow(HEADERS.HISTORICO_OS.map(function(h){ return row[h] !== undefined ? row[h] : ''; }));
  } catch (e) {
    Logger.log('_gravarHistoricoOS_ falhou: ' + e.message);
  }
}

// v35: renomeado de getTecnicos (alias abaixo para compat)
function getUsuarios() {
  ensureSheetHeaders('CAT_USUARIOS', HEADERS.CAT_USUARIOS);
  var rows = getSheetData('CAT_USUARIOS');
  if (rows.length === 0) {
    // Leitura suspeita — pode ser instância GAS desatualizada após ociosidade.
    Utilities.sleep(300);
    rows = getSheetData('CAT_USUARIOS');
  }
  const ativos = rows.filter(function(t){ return isActive_(t.ativo); }).map(function(t){
    const out = Object.assign({}, t);
    delete out.pin_hash;
    return out;
  });
  return { status: 'ok', tecnicos: ativos };
}
function getTecnicos() { return getUsuarios(); } // compat — remover após sessões 2/3

// v35: renomeado de saveTecnico (alias abaixo para compat)
function saveUsuario(body) {
  ensureSheetHeaders('CAT_USUARIOS', HEADERS.CAT_USUARIOS);
  if (!body.id && !body.nome) return { status: 'error', error: 'nome é obrigatório para novo usuário.' };

  const sheet = getOrCreateSheet('CAT_USUARIOS', HEADERS.CAT_USUARIOS);
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const idx = {}; headers.forEach(function(h,i){ idx[h]=i; });
  const now = new Date().toISOString();
  const responsavel = body.responsavel || 'admin';

  let pinHash = body.pin_hash || '';
  let pinAlterado = false;
  if (body.pin && !body.pin_hash) {
    const raw = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(body.pin));
    pinHash = raw.map(function(b){ return (b < 0 ? b + 256 : b).toString(16).padStart(2,'0'); }).join('');
    pinAlterado = true;
  }

  for (var i = 1; i < data.length; i++) {
    if (String(data[i][idx.id]) === String(body.id || '')) {
      const row = i + 1;
      if (body.nome !== undefined) sheet.getRange(row, idx.nome + 1).setValue(body.nome);
      if (pinHash) sheet.getRange(row, idx.pin_hash + 1).setValue(pinHash);
      if (body.ativo !== undefined) {
        sheet.getRange(row, idx.ativo + 1).setValue(isActive_(body.ativo) ? 'SIM' : 'NÃO');
      }
      if (body.perfil !== undefined && idx.perfil >= 0) sheet.getRange(row, idx.perfil + 1).setValue(body.perfil);
      if (body.telefone !== undefined && idx.telefone >= 0) sheet.getRange(row, idx.telefone + 1).setValue(body.telefone);
      if (body.email !== undefined && idx.email >= 0) sheet.getRange(row, idx.email + 1).setValue(body.email);
      if (idx.Updated_At >= 0) sheet.getRange(row, idx.Updated_At + 1).setValue(now);
      if (idx.Updated_By >= 0) sheet.getRange(row, idx.Updated_By + 1).setValue(responsavel);

      if (pinAlterado) {
        registrarEventoOperacional_({
          tipo_evento: 'RESET_PIN_USUARIO', id_usuario: body.id, nome_usuario: body.nome || '',
          acao_realizada: 'PIN do usuário redefinido', responsavel_nome: responsavel, origem: 'PCM'
        });
      }
      registrarEventoOperacional_({
        tipo_evento: 'EDICAO_USUARIO', id_usuario: body.id, nome_usuario: body.nome || '',
        acao_realizada: 'Usuário atualizado', responsavel_nome: responsavel, origem: 'PCM'
      });
      return { status: 'ok', action: 'updated', id: body.id };
    }
  }

  if (!body.pin && !body.pin_hash) return { status: 'error', error: 'pin é obrigatório para novo usuário.' };
  const prefixo = derivarPrefixoUsuario_(body.perfil || '');
  const newId = body.id || (prefixo + '-' + String(Date.now()).slice(-5));
  const novo = {
    id: newId, nome: body.nome || '', pin_hash: pinHash,
    ativo: body.ativo !== undefined ? (isActive_(body.ativo) ? 'SIM' : 'NÃO') : 'SIM',
    perfil: body.perfil || 'tecnico',
    telefone: body.telefone || '', email: body.email || '',
    Created_At: now, Updated_At: now, Created_By: responsavel, Updated_By: responsavel, ultimo_login_at: ''
  };
  sheet.appendRow(headers.map(function(h){ return novo[h] !== undefined ? novo[h] : ''; }));

  registrarEventoOperacional_({
    tipo_evento: 'CRIACAO_USUARIO', id_usuario: newId, nome_usuario: novo.nome,
    acao_realizada: 'Usuário criado', responsavel_nome: responsavel, origem: 'PCM'
  });

  return { status: 'ok', action: 'created', id: newId };
}
function saveTecnico(body) { return saveUsuario(body); } // compat — remover após sessões 2/3

function seedUsuariosDefault() {
  saveUsuario({ id: 'TEC-001', nome: 'Usuário Padrão', pin: '1234', ativo: true, perfil: 'tecnico' });
  Logger.log('Seed concluído: TEC-001 / PIN 1234');
}

function getOS(params) {
  ensureOSHeaders_();
  let rows = getSheetData('ORDENS_SERVICO');
  rows = rows.filter(function(o){ return isActive_(o.Ativo === undefined ? 'SIM' : o.Ativo); });

  var idTecnico = params.id_usuario || params.id_tecnico || params.id_inspetor || params.tecnico || '';
  if (idTecnico) {
    rows = rows.filter(function(o){
      const tecs = parseJsonArray_(o.usuarios_vinculados || o.tecnicos_vinculados);
      // Lista vazia = visível para todos os usuários ativos
      return tecs.length === 0 || tecs.indexOf(String(idTecnico)) >= 0;
    });
  }
  if (params.status) {
    const wanted = normalizeOsStatus_(params.status);
    rows = rows.filter(function(o){ return normalizeOsStatus_(o.status) === wanted; });
  }
  if (params.tipo_os) {
    rows = rows.filter(function(o){ return String(o.tipo_os || '').toLowerCase() === String(params.tipo_os).toLowerCase(); });
  }
  if (params.id_cliente) {
    rows = rows.filter(function(o){ return String(o.id_cliente || '') === String(params.id_cliente); });
  }
  if (params.cliente) {
    rows = rows.filter(function(o){ return String(o.cliente || '').toLowerCase().indexOf(String(params.cliente).toLowerCase()) >= 0; });
  }
  if (params.de) rows = rows.filter(function(o){ return String(o.data_abertura || '') >= String(params.de); });
  if (params.ate) rows = rows.filter(function(o){ return String(o.data_abertura || '') <= String(params.ate); });

  const includeClosed = String(params.includeClosed || '').toLowerCase() === 'true';
  if (!includeClosed) {
    rows = rows.filter(function(o){ return !isOsClosed_(o.status); });
  }

  // Recalcula total_maquinas e normaliza arrays a partir das fontes de verdade
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

  return { status: 'ok', os: rows };
}

// ── v22: PIN via GET (compat TapControl) ────────────────────────────────
function validarPIN(params) {
  if (!params.pin) return { status: 'ok', valido: false, error: 'PIN não informado' };
  const raw = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(params.pin));
  const pinHash = raw.map(function(b){ return (b < 0 ? b + 256 : b).toString(16).padStart(2,'0'); }).join('');
  return loginTecnico({ pin_hash: pinHash });
}

// ── v22: OS <-> Máquinas ─────────────────────────────────────────────────
function getMaquinasByOS(params) {
  ensureOSHeaders_();
  const idOs = String(params.id_os || '').trim();
  const numeroOs = String(params.numero_os || '').trim();
  if (!idOs && !numeroOs) return { status: 'error', error: 'id_os ou numero_os é obrigatório.' };

  const ordens = getSheetData('ORDENS_SERVICO');
  const osRow = ordens.find(function(o){
    return (idOs && String(o.id_os || '') === idOs) || (numeroOs && String(o.numero_os || '') === numeroOs);
  });
  if (!osRow) return { status: 'ok', os: null, machines: [], total: 0, missing_machine_ids: [] };

  const vinculos = getSheetData('OS_MAQUINAS').filter(function(r){
    return String(r.id_os || '') === String(osRow.id_os) && isActive_(r.Ativo);
  });

  const maquinas = getSheetDataActive('MAQUINAS');
  const maquinasPorKey = {};
  maquinas.forEach(function(m){
    const key = machineKey(m['Cliente'] || '', m['Marca'] || '', m['Modelo'] || '', m['Série'] || '');
    maquinasPorKey[key] = m;
    if (m['ID']) maquinasPorKey[String(m['ID'])] = m;
  });

  const machines = [];
  const missing = [];
  vinculos.forEach(function(v){
    const m = maquinasPorKey[String(v.machineKey)];
    if (m) {
      machines.push(Object.assign({}, m, {
        status_atendimento: v.status_atendimento || 'pendente',
        id_visita_resultado: v.id_visita_resultado || '',
        observacao_maquina: v.observacao_maquina || ''
      }));
    } else {
      missing.push(v.machineKey);
    }
  });

  const osNormalizada = Object.assign({}, osRow);
  osNormalizada.usuarios_vinculados = parseJsonArray_(osRow.usuarios_vinculados || osRow.tecnicos_vinculados);
  osNormalizada.tecnicos_vinculados = osNormalizada.usuarios_vinculados; // compat
  osNormalizada.maquinas_vinculadas = parseJsonArray_(osRow.maquinas_vinculadas);
  osNormalizada.status = normalizeOsStatus_(osRow.status);

  return { status: 'ok', os: osNormalizada, machines: machines, total: machines.length, missing_machine_ids: missing };
}
function getEquipamentosByOS(params) { return getMaquinasByOS(params); }

function vincularMaquinaOS(body) {
  ensureOSHeaders_();
  if (!body.id_os) return { status: 'error', error: 'id_os é obrigatório.' };
  if (!body.machineKey) return { status: 'error', error: 'machineKey é obrigatório.' };
  const acao = String(body.acao || 'vincular').toLowerCase();
  const responsavel = body.responsavel || 'sistema';

  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    const ordens = getSheetData('ORDENS_SERVICO');
    const osRow = ordens.find(function(o){ return String(o.id_os || '') === String(body.id_os); });
    if (!osRow) return { status: 'error', error: 'OS não encontrada: ' + body.id_os };

    const sheet = getOrCreateSheet('OS_MAQUINAS', HEADERS.OS_MAQUINAS);
    const data = sheet.getDataRange().getValues();
    const headers = data[0] || HEADERS.OS_MAQUINAS;
    const idx = {}; headers.forEach(function(h,i){ idx[h]=i; });
    const now = new Date().toISOString();

    let rowNum = -1;
    for (let r = 1; r < data.length; r++) {
      if (String(data[r][idx.id_os] || '') === String(body.id_os) && String(data[r][idx.machineKey] || '') === String(body.machineKey)) {
        rowNum = r + 1; break;
      }
    }

    if (acao === 'desvincular') {
      if (rowNum < 0) return { status: 'ok', id_os: body.id_os, machineKey: body.machineKey, modo: 'ja_desvinculado', total_maquinas: 0 };
      sheet.getRange(rowNum, idx.Ativo + 1).setValue('NÃO');
      sheet.getRange(rowNum, idx.Updated_At + 1).setValue(now);
    } else {
      if (rowNum >= 0) {
        sheet.getRange(rowNum, idx.Ativo + 1).setValue('SIM');
        sheet.getRange(rowNum, idx.Updated_At + 1).setValue(now);
      } else {
        const novo = {
          id_link: 'OSM-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
          id_os: body.id_os, numero_os: osRow.numero_os, machineKey: body.machineKey, id_cliente: osRow.id_cliente,
          status_atendimento: 'pendente', id_visita_resultado: '', observacao_maquina: '',
          Created_At: now, Created_By: responsavel, Updated_At: now, Ativo: 'SIM'
        };
        sheet.appendRow(headers.map(function(h){ return novo[h] !== undefined ? novo[h] : ''; }));
      }
    }

    const totalAtivo = getSheetData('OS_MAQUINAS').filter(function(r){
      return String(r.id_os || '') === String(body.id_os) && isActive_(r.Ativo);
    });

    // Sincroniza array de compatibilidade em ORDENS_SERVICO
    const osSheet = getOrCreateSheet('ORDENS_SERVICO', HEADERS.ORDENS_SERVICO);
    const osData = osSheet.getDataRange().getValues();
    const osHeaders = osData[0];
    const osIdx = {}; osHeaders.forEach(function(h,i){ osIdx[h]=i; });
    for (let r = 1; r < osData.length; r++) {
      if (String(osData[r][osIdx.id_os] || '') === String(body.id_os)) {
        const keys = totalAtivo.map(function(v){ return v.machineKey; });
        osSheet.getRange(r + 1, osIdx.maquinas_vinculadas + 1).setValue(stringifyArray_(keys));
        if (osIdx.total_maquinas >= 0) osSheet.getRange(r + 1, osIdx.total_maquinas + 1).setValue(keys.length);
        if (osIdx.Updated_At >= 0) osSheet.getRange(r + 1, osIdx.Updated_At + 1).setValue(now);
        break;
      }
    }

    registrarEventoOperacional_({
      tipo_evento: acao === 'desvincular' ? 'DESVINCULO_MAQUINA_OS' : 'VINCULO_MAQUINA_OS',
      id_os: body.id_os, numero_os: osRow.numero_os, id_cliente: osRow.id_cliente, cliente: osRow.cliente,
      machineKey: body.machineKey,
      acao_realizada: acao === 'desvincular' ? 'Máquina desvinculada da OS' : 'Máquina vinculada à OS',
      responsavel_nome: responsavel, origem: body.origem || 'PCM'
    });

    return { status: 'ok', id_os: body.id_os, machineKey: body.machineKey, modo: acao === 'desvincular' ? 'desvinculado' : 'vinculado', total_maquinas: totalAtivo.length };
  } finally {
    lock.releaseLock();
  }
}
function vincularEquipamentoOS(body) { return vincularMaquinaOS(body); }

// ── v22: Reabertura de OS ────────────────────────────────────────────────
function reabrirOS(body) {
  ensureOSHeaders_();
  if (!body.id_os) return { status: 'error', error: 'id_os é obrigatório.' };
  const responsavel = body.responsavel || 'sistema';

  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    const sheet = getOrCreateSheet('ORDENS_SERVICO', HEADERS.ORDENS_SERVICO);
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const idx = {}; headers.forEach(function(h,i){ idx[h]=i; });

    for (let r = 1; r < data.length; r++) {
      if (String(data[r][idx.id_os] || '') === String(body.id_os)) {
        const statusAtual = normalizeOsStatus_(data[r][idx.status]);
        if (!isOsClosed_(statusAtual)) return { status: 'error', error: 'OS não está encerrada — não há o que reabrir.' };

        const row = r + 1;
        const now = new Date().toISOString();
        sheet.getRange(row, idx.status + 1).setValue('em_andamento');
        if (idx.fim_atendimento >= 0) sheet.getRange(row, idx.fim_atendimento + 1).setValue('');
        if (idx.Updated_At >= 0) sheet.getRange(row, idx.Updated_At + 1).setValue(now);
        if (idx.Updated_By >= 0) sheet.getRange(row, idx.Updated_By + 1).setValue(responsavel);

        registrarEventoOperacional_({
          tipo_evento: 'REABERTURA_OS', id_os: body.id_os, numero_os: data[r][idx.numero_os],
          id_cliente: data[r][idx.id_cliente], cliente: data[r][idx.cliente],
          status_anterior: statusAtual, status_novo: 'em_andamento',
          acao_realizada: 'OS reaberta', responsavel_nome: responsavel,
          origem: body.origem || 'PCM', observacao: body.motivo || ''
        });

        const updated = sheet.getRange(row, 1, 1, headers.length).getValues()[0];
        return { status: 'ok', os: osRowToObject_(headers, updated) };
      }
    }
    return { status: 'error', error: 'OS não encontrada: ' + body.id_os };
  } finally {
    lock.releaseLock();
  }
}

// ── v22: Drafts de atendimento de OS ────────────────────────────────────
function salvarDraftOS(body) {
  ensureOSHeaders_();
  // Aceita id_usuario (novo) ou id_tecnico (compat PCF até Sessão 2)
  var id_usuario = body.id_usuario || body.id_tecnico;
  var nome_usuario = body.nome_usuario || body.nome_tecnico || '';
  if (!body.id_os || !id_usuario) return { status: 'error', error: 'id_os e id_usuario são obrigatórios.' };

  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    const sheet = getOrCreateSheet('OS_DRAFTS', HEADERS.OS_DRAFTS);
    const data = sheet.getDataRange().getValues();
    const headers = data[0] || HEADERS.OS_DRAFTS;
    const idx = {}; headers.forEach(function(h,i){ idx[h]=i; });
    // Compatibilidade pré/pós migração: a coluna pode ainda se chamar id_tecnico na planilha
    var idCol = idx.id_usuario >= 0 ? idx.id_usuario : idx.id_tecnico;
    const now = new Date().toISOString();

    for (let r = 1; r < data.length; r++) {
      if (String(data[r][idx.id_os] || '') === String(body.id_os) &&
          String(data[r][idCol] || '') === String(id_usuario) &&
          String(data[r][idx.status_draft] || '') === 'aberto') {
        sheet.getRange(r + 1, idx.timestamp_atualizacao + 1).setValue(now);
        sheet.getRange(r + 1, idx.payload_json + 1).setValue(body.payload_json || '');
        registrarEventoOperacional_({
          tipo_evento: 'SALVAR_DRAFT_OS', id_os: body.id_os, numero_os: body.numero_os || '',
          id_usuario: id_usuario, nome_usuario: nome_usuario,
          acao_realizada: 'Draft de OS atualizado', responsavel_nome: nome_usuario || 'usuário', origem: 'PCF'
        });
        return { status: 'ok', id_draft: String(data[r][idx.id_draft] || ''), modo: 'atualizado' };
      }
    }

    const novoId = 'DFT-' + now.replace(/[^0-9]/g, '').substring(0, 14);
    const novo = {
      id_draft: novoId, id_os: body.id_os, numero_os: body.numero_os || '',
      id_usuario: id_usuario, nome_usuario: nome_usuario, tipo_os: body.tipo_os || '',
      timestamp_atualizacao: now, payload_json: body.payload_json || '', status_draft: 'aberto'
    };
    sheet.appendRow(headers.map(function(h){ return novo[h] !== undefined ? novo[h] : ''; }));

    registrarEventoOperacional_({
      tipo_evento: 'SALVAR_DRAFT_OS', id_os: body.id_os, numero_os: body.numero_os || '',
      id_usuario: id_usuario, nome_usuario: nome_usuario,
      acao_realizada: 'Draft de OS criado', responsavel_nome: nome_usuario || 'usuário', origem: 'PCF'
    });

    return { status: 'ok', id_draft: novoId, modo: 'criado' };
  } finally {
    lock.releaseLock();
  }
}

function getDraftOS(body) {
  ensureOSHeaders_();
  var id_usuario = body.id_usuario || body.id_tecnico;
  if (!body.id_os || !id_usuario) return { status: 'error', error: 'id_os e id_usuario são obrigatórios.' };
  const sheet = getOrCreateSheet('OS_DRAFTS', HEADERS.OS_DRAFTS);
  if (sheet.getLastRow() <= 1) return { status: 'ok', draft: null };
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const idx = {}; headers.forEach(function(h,i){ idx[h]=i; });
  var idCol = idx.id_usuario >= 0 ? idx.id_usuario : idx.id_tecnico;

  for (let r = 1; r < data.length; r++) {
    if (String(data[r][idx.id_os] || '') === String(body.id_os) &&
        String(data[r][idCol] || '') === String(id_usuario) &&
        String(data[r][idx.status_draft] || '') === 'aberto') {
      return { status: 'ok', draft: osRowToObject_(headers, data[r]) };
    }
  }
  return { status: 'ok', draft: null };
}

function limparDraftOS(body) {
  ensureOSHeaders_();
  var id_usuario = body.id_usuario || body.id_tecnico;
  var nome_usuario = body.nome_usuario || body.nome_tecnico || '';
  if (!body.id_os || !id_usuario) return { status: 'error', error: 'id_os e id_usuario são obrigatórios.' };
  const sheet = getOrCreateSheet('OS_DRAFTS', HEADERS.OS_DRAFTS);
  if (sheet.getLastRow() <= 1) return { status: 'ok', status_draft: 'nao_encontrado' };
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const idx = {}; headers.forEach(function(h,i){ idx[h]=i; });
  var idCol = idx.id_usuario >= 0 ? idx.id_usuario : idx.id_tecnico;
  const novoStatus = body.motivo === 'cancelado' ? 'cancelado' : 'enviado';

  for (let r = 1; r < data.length; r++) {
    if (String(data[r][idx.id_os] || '') === String(body.id_os) &&
        String(data[r][idCol] || '') === String(id_usuario) &&
        String(data[r][idx.status_draft] || '') === 'aberto') {
      sheet.getRange(r + 1, idx.status_draft + 1).setValue(novoStatus);
      registrarEventoOperacional_({
        tipo_evento: 'LIMPAR_DRAFT_OS', id_os: body.id_os, id_usuario: id_usuario,
        acao_realizada: 'Draft de OS finalizado (' + novoStatus + ')',
        responsavel_nome: nome_usuario || 'usuário', origem: 'PCF'
      });
      return { status: 'ok', status_draft: novoStatus };
    }
  }
  return { status: 'ok', status_draft: 'nao_encontrado' };
}

// ── v22: Log operacional por OS (para tela de detalhe no PCM) ───────────
function getLogOperacional(params) {
  ensureOSHeaders_();
  let rows = getSheetData('LOG_OPERACIONAL');
  if (params.id_os) rows = rows.filter(function(r){ return String(r.id_os || '') === String(params.id_os); });
  if (params.tipo_evento) rows = rows.filter(function(r){ return String(r.tipo_evento || '') === String(params.tipo_evento); });
  // Mais recentes primeiro
  rows.sort(function(a, b){ return String(b.timestamp || '').localeCompare(String(a.timestamp || '')); });
  if (params.limit) rows = rows.slice(0, parseInt(params.limit, 10) || rows.length);
  return { status: 'ok', eventos: rows };
}

function getOrCreateDriveFolder(parent, name){
  const safe=String(name||'sem_nome').replace(/[\\/:*?"<>|]/g,'-').trim()||'sem_nome';
  const it=parent.getFoldersByName(safe); return it.hasNext()?it.next():parent.createFolder(safe);
}
function getRootFolder_(){
  const id=PropertiesService.getScriptProperties().getProperty('ROOT_FOLDER_ID');
  if(!id) throw new Error('ROOT_FOLDER_ID não configurado'); return DriveApp.getFolderById(id);
}
function updateOSDriveRefs_(idOsOuNumero, fields) {
  if (!idOsOuNumero) return;
  const sheet = getOrCreateSheet('ORDENS_SERVICO', HEADERS.ORDENS_SERVICO);
  const data = sheet.getDataRange().getValues(); if (data.length < 2) return;
  const headers = data[0];
  const idxId = headers.indexOf('id_os');
  const idxNumero = headers.indexOf('numero_os');
  if (idxId < 0 && idxNumero < 0) return;
  for (let r=1; r<data.length; r++) {
    const matchId = idxId >= 0 && String(data[r][idxId] || '') === String(idOsOuNumero);
    const matchNumero = idxNumero >= 0 && String(data[r][idxNumero] || '') === String(idOsOuNumero);
    if (matchId || matchNumero) {
      Object.keys(fields).forEach(function(k){ const c=headers.indexOf(k); if (c >= 0 && fields[k]) sheet.getRange(r+1,c+1).setValue(fields[k]); });
      break;
    }
  }
}
function salvarFotosDrivePGP(body){
  const root=getRootFolder_();
  const fCli=getOrCreateDriveFolder(root, body.clientName||'SemCliente');
  const fOS =getOrCreateDriveFolder(fCli, body.osNumero||body.id_os||'SemOS');
  const blob=Utilities.newBlob(Utilities.base64Decode(body.dataBase64), body.mime||'image/jpeg', body.fileName||'arquivo');
  const file=fOS.createFile(blob);

  // v22: por padrão, NÃO tornar o arquivo público. Assinaturas e fotos de
  // cliente são dados sensíveis (LGPD). Só compartilha por link se a
  // propriedade de script DRIVE_LINK_PUBLICO estiver explicitamente 'true'.
  const linkPublico = PropertiesService.getScriptProperties().getProperty('DRIVE_LINK_PUBLICO') === 'true';
  if (linkPublico) {
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  } else {
    file.setSharing(DriveApp.Access.PRIVATE, DriveApp.Permission.VIEW);
  }

  const sheet=getOrCreateSheet('TECH_ATTACHMENTS', HEADERS.TECH_ATTACHMENTS);
  const id='ATT-'+Date.now()+'-'+Math.floor(Math.random()*1000);
  const url='https://drive.google.com/file/d/'+file.getId()+'/view';
  const entityId = body.entityId || body.id_os || body.osNumero || '';
  sheet.appendRow([ id, body.entityType||'os', entityId, body.osNumero||'',
    file.getId(), url, file.getName(), body.mime||'', body.attachmentType||'foto',
    body.caption||'', new Date(), body.createdBy||'', 'SIM' ]);

  const refs = { drive_folder_id:fOS.getId(), drive_folder_url:fOS.getUrl() };
  const tipo = String(body.attachmentType || '');
  if (tipo.indexOf('pdf_os') === 0) refs.pdf_url = url;
  if (tipo === 'assinatura_tecnico' || tipo === 'assinatura_usuario') refs.assinatura_usuario_url = url;
  if (tipo === 'assinatura_cliente') refs.assinatura_cliente_url = url;

  const refKey = body.id_os || body.osNumero || '';
  updateOSDriveRefs_(refKey, refs);

  registrarEventoOperacional_({
    tipo_evento: 'UPLOAD_ANEXO_OS', id_os: body.id_os || '', numero_os: body.osNumero || '',
    acao_realizada: 'Anexo enviado (' + (body.attachmentType || 'foto') + ')',
    responsavel_nome: body.createdBy || 'técnico', origem: 'PCF',
    payload_json: JSON.stringify({ attachmentType: body.attachmentType || 'foto', fileName: body.fileName || '' })
  });

  return { status:'ok', attachment_id:id, file_id:file.getId(), url:url, folder_id:fOS.getId(), folder_url:fOS.getUrl() };
}
function getAttachments(params){
  let rows = getSheetData('TECH_ATTACHMENTS').filter(function(a){ return String(a.Ativo || 'SIM').trim().toUpperCase() !== 'NÃO'; });
  if (params.osNumero) rows = rows.filter(function(a){ return String(a.OS_Numero || '') === String(params.osNumero); });
  if (params.entityType) rows = rows.filter(function(a){ return String(a.Entity_Type || '') === String(params.entityType); });
  if (params.entityId) rows = rows.filter(function(a){ return String(a.Entity_ID || '') === String(params.entityId); });
  return { status:'ok', attachments:rows };
}

// ═══════════════════════════════════════════════════════════════════════════
// ROTORES — Modelos e Coletas
// ═══════════════════════════════════════════════════════════════════════════

function saveRotorModel(body) {
  ensureSheetHeaders('ROTORES_MODELOS', HEADERS.ROTORES_MODELOS);
  var marca   = String(body.marca   || '').trim();
  var modelo  = String(body.modelo  || '').trim();
  var modelId = body.model_id || (compactKey(marca) + '-' + compactKey(modelo));
  if (!modelId) return { status: 'error', error: 'marca e modelo obrigatórios' };
  var now = new Date().toISOString();
  var sheet = getOrCreateSheet('ROTORES_MODELOS', HEADERS.ROTORES_MODELOS);
  var data    = sheet.getDataRange().getValues();
  var headers = data[0];
  var idxMid  = headers.indexOf('Model_ID');
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][idxMid] || '').trim() === modelId) {
      var idxAnchors = headers.indexOf('Anchors_JSON');
      var idxFoto    = headers.indexOf('Foto_Ref_URL');
      var idxUpdated = headers.indexOf('Updated_At');
      if (idxAnchors >= 0 && body.anchors_json) sheet.getRange(i+1, idxAnchors+1).setValue(body.anchors_json);
      if (idxFoto    >= 0 && body.foto_ref_url) sheet.getRange(i+1, idxFoto+1).setValue(body.foto_ref_url);
      if (idxUpdated >= 0) sheet.getRange(i+1, idxUpdated+1).setValue(now);
      return { status: 'ok', action: 'updated', model_id: modelId };
    }
  }
  sheet.appendRow([
    modelId, marca, modelo,
    body.foto_ref_url || '', body.anchors_json || '',
    'SIM', 'PRODUCAO', now, now, '', ''
  ]);
  return { status: 'ok', action: 'inserted', model_id: modelId };
}

function getRotorModels() {
  ensureSheetHeaders('ROTORES_MODELOS', HEADERS.ROTORES_MODELOS);
  return { status: 'ok', rotorModels: getSheetDataActive('ROTORES_MODELOS') };
}

function saveRotorColeta(body) {
  ensureSheetHeaders('ROTORES_COLETAS', HEADERS.ROTORES_COLETAS);
  if (!body.machine_id || !body.coleta_id || !body.data_coleta || !body.medicoes_json) {
    return { status: 'error', error: 'Campos obrigatórios: machine_id, coleta_id, data_coleta, medicoes_json' };
  }
  var coletaId = String(body.coleta_id).trim();
  var sheet    = getOrCreateSheet('ROTORES_COLETAS', HEADERS.ROTORES_COLETAS);
  var data     = sheet.getDataRange().getValues();
  var headers  = data[0];
  var idxCid   = headers.indexOf('Coleta_ID');
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][idxCid] || '').trim() === coletaId) {
      return { status: 'ok', coleta_id: coletaId, duplicate: true };
    }
  }
  var now    = new Date().toISOString();
  var marca  = String(body.marca  || '').trim();
  var modelo = String(body.modelo || '').trim();
  var modelId = body.model_id || (marca && modelo ? compactKey(marca)+'-'+compactKey(modelo) : '');
  sheet.appendRow([
    coletaId, body.machine_id || '', body.visit_id || '', modelId,
    body.cliente || '', marca, modelo,
    body.serie || '', body.tag || '', body.tecnico || '', body.data_coleta,
    body.foto_rotores_url || '', body.anchors_json || '', body.medicoes_json, body.obs || '',
    'SIM', 'PRODUCAO', now, '', ''
  ]);
  try { autoCompletarTarefa(body.os_id, 'rotores', { status: 'completo', id_formulario: coletaId }); } catch(e) {}
  return { status: 'ok', coleta_id: coletaId };
}

function getRotorColetas(machine_id) {
  if (!machine_id) return { status: 'error', error: 'machine_id obrigatório' };
  ensureSheetHeaders('ROTORES_COLETAS', HEADERS.ROTORES_COLETAS);
  var all = getSheetDataActive('ROTORES_COLETAS')
    .filter(function(r){ return String(r['Machine_ID'] || '').trim() === String(machine_id).trim(); });
  all.sort(function(a,b){ return String(b['Created_At']||'').localeCompare(String(a['Created_At']||'')); });
  return { status: 'ok', coletas: all };
}

function salvarFotoRotoresDrive(body) {
  var root  = getRootFolder_();
  var fCli  = getOrCreateDriveFolder(root, body.clientName || 'SemCliente');
  var fRot  = getOrCreateDriveFolder(fCli, 'Rotores');
  var blob  = Utilities.newBlob(
    Utilities.base64Decode(body.dataBase64),
    body.mime || 'image/jpeg',
    body.fileName || 'rotor.jpg'
  );
  var file = fRot.createFile(blob);
  var linkPublico = PropertiesService.getScriptProperties().getProperty('DRIVE_LINK_PUBLICO') === 'true';
  if (linkPublico) {
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  } else {
    file.setSharing(DriveApp.Access.PRIVATE, DriveApp.Permission.VIEW);
  }
  var url = 'https://drive.google.com/file/d/' + file.getId() + '/view';
  var id  = 'ATT-' + Date.now() + '-' + Math.floor(Math.random() * 1000);
  var sheet = getOrCreateSheet('TECH_ATTACHMENTS', HEADERS.TECH_ATTACHMENTS);
  var entityId = body.entityId || body.coleta_id || '';
  sheet.appendRow([
    id, 'rotor_coleta', entityId, '',
    file.getId(), url, file.getName(), body.mime || 'image/jpeg', 'foto_rotor', body.caption || '',
    new Date(), body.createdBy || '', 'SIM'
  ]);
  return { status: 'ok', url: url, file_id: file.getId() };
}

// ═══════════════════════════════════════════════════════════════════════════
// GET SHEET DATA
// ═══════════════════════════════════════════════════════════════════════════
function getSheetData(sheetName) {
  const sheet = getOrCreateSheet(sheetName, HEADERS[sheetName]);
  const data = sheet.getDataRange().getValues();
  if (data.length < 2) return [];
  const headers = data[0];
  return data.slice(1).map(row => {
    const obj = {};
    headers.forEach((h, j) => obj[h] = row[j]);
    return obj;
  });
}

// Retorna apenas linhas onde Ativo != 'NÃO'
function getSheetDataActive(sheetName) {
  const all = getSheetData(sheetName);
  return all.filter(row => String(row['Ativo'] || 'SIM').trim().toUpperCase() !== 'NÃO');
}

function rowToMachine(row) {
  return {
    id:        row['ID']           || '',
    client:    row['Cliente']      || '',
    branch:    row['Filial']       || '',
    brand:     row['Marca']        || '',
    model:     row['Modelo']       || '',
    serial:    String(row['Série'] || ''),
    year:      row['Ano']          || '',
    tag:       row['TAG']          || '',
    location:  row['Localização']  || '',
    hourTotal: parseInt(row['Hor.Total']) || 0,
    hpw:       parseInt(row['h/Semana'])  || 0,
    obs:       row['Observações']  || '',
    // v1.9:
    power:     row['Potência']     || '',
    type:      row['Tipo_Equip']   || '',
    obsOp:     row['Obs_Op']       || ''
  };
}

function rowToMachineFromObj(row) {
  return rowToMachine(row);
}

function ensureSheetHeaders(sheetName, expectedHeaders) {
  const sheet = getOrCreateSheet(sheetName, expectedHeaders);
  if (sheet.getLastColumn() === 0) {
    sheet.getRange(1, 1, 1, expectedHeaders.length).setValues([expectedHeaders]);
    sheet.getRange(1, 1, 1, expectedHeaders.length)
      .setFontWeight('bold')
      .setBackground('#1a3a6b')
      .setFontColor('#ffffff');
    sheet.setFrozenRows(1);
    return;
  }

  const current = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  expectedHeaders.forEach(col => {
    if (!current.includes(col)) {
      const newColIdx = sheet.getLastColumn() + 1;
      sheet.getRange(1, newColIdx)
        .setValue(col)
        .setFontWeight('bold')
        .setBackground('#1a3a6b')
        .setFontColor('#ffffff');
    }
  });
}

function getOrCreateSheet(name, headers) {
  let sheet = SS.getSheetByName(name);
  if (!sheet) {
    sheet = SS.insertSheet(name);
    sheet.appendRow(headers);
    sheet.getRange(1, 1, 1, headers.length)
      .setFontWeight('bold')
      .setBackground('#1a3a6b')
      .setFontColor('#ffffff');
    sheet.setFrozenRows(1);
    sheet.setColumnWidths(1, headers.length, 150);
  }
  return sheet;
}

// ═══════════════════════════════════════════════════════════════════════════
// BIBLIOTECA DE SUBSISTEMAS — v24
// ═══════════════════════════════════════════════════════════════════════════

function saveSubsistemaLib(data) {
  if (!data || !data.id || !data.name) {
    return { status: 'error', error: 'Campos obrigatórios: id, name' };
  }
  ensureSheetHeaders('SUBSISTEMAS_LIB', HEADERS.SUBSISTEMAS_LIB);
  const sheet = getOrCreateSheet('SUBSISTEMAS_LIB', HEADERS.SUBSISTEMAS_LIB);
  const now   = new Date().toISOString();
  const rows  = sheet.getDataRange().getValues();
  const h     = rows[0];
  const idxId = h.indexOf('Sub_Lib_ID');

  const buildRow = (createdAt) => [
    data.id,
    data.name                 || '',
    data.category || data.categoria || '',
    data.desc                 || '',
    parseInt(data.interval)   || 0,
    data.codigoReferencia     || '',
    data.fabricante           || '',
    data.obs                  || '',
    'SIM', 'PRODUCAO', createdAt || now, now, '', ''
  ];

  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][idxId] || '').trim() === String(data.id).trim()) {
      const existCreatedAt = rows[i][h.indexOf('Created_At')] || now;
      sheet.getRange(i + 1, 1, 1, HEADERS.SUBSISTEMAS_LIB.length).setValues([buildRow(existCreatedAt)]);
      return { status: 'ok', action: 'updated', id: data.id };
    }
  }
  sheet.appendRow(buildRow(now));
  return { status: 'ok', action: 'created', id: data.id };
}

function saveSubLibPart(data) {
  if (!data || !data.id || !data.subLibId) {
    return { status: 'error', error: 'Campos obrigatórios: id, subLibId' };
  }
  ensureSheetHeaders('SUBSISTEMA_LIB_PARTS', HEADERS.SUBSISTEMA_LIB_PARTS);
  const sheet = getOrCreateSheet('SUBSISTEMA_LIB_PARTS', HEADERS.SUBSISTEMA_LIB_PARTS);
  const now   = new Date().toISOString();
  const rows  = sheet.getDataRange().getValues();
  const h     = rows[0];
  const idxId = h.indexOf('Part_ID');

  const buildRow = (createdAt) => [
    data.id,
    data.subLibId,
    data.name             || '',
    data.ref              || '',
    data.partBrand        || '',
    data.supplierPrimary  || '',
    data.slot             || '',
    parseInt(data.qty)    || 1,
    parseInt(data.interval) || 0,
    data.criticality      || 'normal',
    parseFloat(data.cost) || 0,
    data.obs              || '',
    'SIM', 'PRODUCAO', createdAt || now, now, '', ''
  ];

  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][idxId] || '').trim() === String(data.id).trim()) {
      const existCreatedAt = rows[i][h.indexOf('Created_At')] || now;
      sheet.getRange(i + 1, 1, 1, HEADERS.SUBSISTEMA_LIB_PARTS.length).setValues([buildRow(existCreatedAt)]);
      return { status: 'ok', action: 'updated', id: data.id };
    }
  }
  sheet.appendRow(buildRow(now));
  return { status: 'ok', action: 'created', id: data.id };
}

function deleteSubsistemaLib(subLibId, deletedBy) {
  if (!subLibId) return { status: 'error', error: 'subLibId obrigatório' };
  ensureSheetHeaders('SUBSISTEMAS_LIB', HEADERS.SUBSISTEMAS_LIB);
  const sheet    = getOrCreateSheet('SUBSISTEMAS_LIB', HEADERS.SUBSISTEMAS_LIB);
  const now      = new Date().toISOString();
  const rows     = sheet.getDataRange().getValues();
  const h        = rows[0];
  const idxId    = h.indexOf('Sub_Lib_ID');
  const idxAtivo = h.indexOf('Ativo');
  const idxDelAt = h.indexOf('Deleted_At');
  const idxDelBy = h.indexOf('Deleted_By');
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][idxId] || '').trim() === String(subLibId).trim()) {
      if (idxAtivo >= 0) sheet.getRange(i+1, idxAtivo+1).setValue('NÃO');
      if (idxDelAt >= 0) sheet.getRange(i+1, idxDelAt+1).setValue(now);
      if (idxDelBy >= 0) sheet.getRange(i+1, idxDelBy+1).setValue(deletedBy || 'admin');
      return { status: 'ok', deleted: subLibId };
    }
  }
  return { status: 'error', error: 'Subsistema não encontrado: ' + subLibId };
}

function deleteSubLibPart(partId, deletedBy) {
  if (!partId) return { status: 'error', error: 'partId obrigatório' };
  ensureSheetHeaders('SUBSISTEMA_LIB_PARTS', HEADERS.SUBSISTEMA_LIB_PARTS);
  const sheet    = getOrCreateSheet('SUBSISTEMA_LIB_PARTS', HEADERS.SUBSISTEMA_LIB_PARTS);
  const now      = new Date().toISOString();
  const rows     = sheet.getDataRange().getValues();
  const h        = rows[0];
  const idxId    = h.indexOf('Part_ID');
  const idxAtivo = h.indexOf('Ativo');
  const idxDelAt = h.indexOf('Deleted_At');
  const idxDelBy = h.indexOf('Deleted_By');
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][idxId] || '').trim() === String(partId).trim()) {
      if (idxAtivo >= 0) sheet.getRange(i+1, idxAtivo+1).setValue('NÃO');
      if (idxDelAt >= 0) sheet.getRange(i+1, idxDelAt+1).setValue(now);
      if (idxDelBy >= 0) sheet.getRange(i+1, idxDelBy+1).setValue(deletedBy || 'admin');
      return { status: 'ok', deleted: partId };
    }
  }
  return { status: 'error', error: 'Peça não encontrada: ' + partId };
}

function linkSubsistemaToModel(modelId, subLibId, createdBy) {
  if (!modelId || !subLibId) return { status: 'error', error: 'modelId e subLibId obrigatórios' };
  ensureSheetHeaders('MODELO_SUBSISTEMA_LIB', HEADERS.MODELO_SUBSISTEMA_LIB);
  const sheet    = getOrCreateSheet('MODELO_SUBSISTEMA_LIB', HEADERS.MODELO_SUBSISTEMA_LIB);
  const now      = new Date().toISOString();
  const rows     = sheet.getDataRange().getValues();
  const h        = rows[0];
  const idxMid   = h.indexOf('Model_ID');
  const idxSubId = h.indexOf('Sub_Lib_ID');
  const idxAtivo = h.indexOf('Ativo');
  for (let i = 1; i < rows.length; i++) {
    const sameMid = String(rows[i][idxMid]   || '').trim() === String(modelId).trim();
    const sameSub = String(rows[i][idxSubId] || '').trim() === String(subLibId).trim();
    if (sameMid && sameSub) {
      const ativo = String(rows[i][idxAtivo] || 'SIM').toUpperCase() !== 'NÃO';
      if (ativo) return { status: 'ok', action: 'already_linked' };
      sheet.getRange(i+1, idxAtivo+1).setValue('SIM');
      return { status: 'ok', action: 'reactivated' };
    }
  }
  const linkId = 'LNK-' + Date.now();
  sheet.appendRow([linkId, modelId, subLibId, createdBy || 'admin', 'SIM', 'PRODUCAO', now, '', '']);
  return { status: 'ok', action: 'linked', linkId };
}

function unlinkSubsistemaFromModel(modelId, subLibId, deletedBy) {
  if (!modelId || !subLibId) return { status: 'error', error: 'modelId e subLibId obrigatórios' };
  ensureSheetHeaders('MODELO_SUBSISTEMA_LIB', HEADERS.MODELO_SUBSISTEMA_LIB);
  const sheet    = getOrCreateSheet('MODELO_SUBSISTEMA_LIB', HEADERS.MODELO_SUBSISTEMA_LIB);
  const now      = new Date().toISOString();
  const rows     = sheet.getDataRange().getValues();
  const h        = rows[0];
  const idxMid   = h.indexOf('Model_ID');
  const idxSubId = h.indexOf('Sub_Lib_ID');
  const idxAtivo = h.indexOf('Ativo');
  const idxDelAt = h.indexOf('Deleted_At');
  const idxDelBy = h.indexOf('Deleted_By');
  let found = false;
  for (let i = 1; i < rows.length; i++) {
    const sameMid = String(rows[i][idxMid]   || '').trim() === String(modelId).trim();
    const sameSub = String(rows[i][idxSubId] || '').trim() === String(subLibId).trim();
    if (sameMid && sameSub) {
      if (idxAtivo >= 0) sheet.getRange(i+1, idxAtivo+1).setValue('NÃO');
      if (idxDelAt >= 0) sheet.getRange(i+1, idxDelAt+1).setValue(now);
      if (idxDelBy >= 0) sheet.getRange(i+1, idxDelBy+1).setValue(deletedBy || 'admin');
      found = true;
    }
  }
  return found
    ? { status: 'ok', unlinked: true }
    : { status: 'error', error: 'Vínculo não encontrado' };
}

// ═══════════════════════════════════════════════════════════════════════════
// MIGRAÇÃO — Atualizar IDs existentes para machine_key (rodar uma vez)
// Execute manualmente no Apps Script Editor: migrateExistingIds()
// ═══════════════════════════════════════════════════════════════════════════
function migrateExistingIds() {
  const sheet = getOrCreateSheet('MAQUINAS', HEADERS.MAQUINAS);
  const data  = sheet.getDataRange().getValues();
  if (data.length < 2) return 'Sem dados';
  const headers   = data[0];
  const idxId     = headers.indexOf('ID');
  const idxClient = headers.indexOf('Cliente');
  const idxBrand  = headers.indexOf('Marca');
  const idxModel  = headers.indexOf('Modelo');
  const idxSerial = headers.indexOf('Série');
  let updated = 0;
  for (let i = 1; i < data.length; i++) {
    const currentId = String(data[i][idxId] || '').trim();
    if (currentId.startsWith('MK-')) continue;
    const mk = machineKey(
      data[i][idxClient] || '',
      data[i][idxBrand]  || '',
      data[i][idxModel]  || '',
      data[i][idxSerial] || ''
    );
    sheet.getRange(i + 1, idxId + 1).setValue(mk);
    updated++;
  }
  const vSheet = SS.getSheetByName('VISITAS');
  if (vSheet) {
    const vData = vSheet.getDataRange().getValues();
    const vH    = vData[0];
    const viMid = vH.indexOf('Machine_ID');
    const viCli = vH.indexOf('Cliente');
    const viMar = vH.indexOf('Marca');
    const viMod = vH.indexOf('Modelo');
    const viSer = vH.indexOf('Série');
    if (viMid >= 0) {
      for (let i = 1; i < vData.length; i++) {
        const mid = String(vData[i][viMid] || '').trim();
        if (mid) continue;
        const mk = machineKey(
          vData[i][viCli] || '',
          vData[i][viMar] || '',
          vData[i][viMod] || '',
          vData[i][viSer] || ''
        );
        vSheet.getRange(i + 1, viMid + 1).setValue(mk);
      }
    }
  }
  return 'Migração concluída: ' + updated + ' máquina(s) atualizada(s)';
}

function jsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
// ═══════════════════════════════════════════════════════════════════════════
// initializeDatabase() — Proper Care GAS v6
// ───────────────────────────────────────────────────────────────────────────
// QUANDO EXECUTAR:
//   Execute manualmente no Apps Script Editor após cada nova implantação
//   da GAS. Também pode ser chamado repetidamente — é idempotente.
//
// O QUE FAZ:
//   1. Cria todas as abas que faltam com seus cabeçalhos corretos
//   2. Adiciona colunas novas em abas existentes (sem apagar dados)
//   3. Detecta PARTS_MASTER com cabeçalho corrompido e aborta com erro claro
//   4. Valida integridade básica (orphans, duplicatas de modelo)
//   5. Gera relatório completo no Logger do Apps Script
//
// SEGURO: nunca apaga dados, nunca move linhas, nunca altera registros.
// ═══════════════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════════════
// GAS-6 — GET PART APPLICATIONS
// ═══════════════════════════════════════════════════════════════════════════
function getPartApplications(query) {
  if (!query) return { status: 'error', error: 'Parâmetro q obrigatório' };

  const norm = ref => String(ref || '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  const normQuery = norm(query);
  if (!normQuery) return { status: 'error', error: 'Query inválida' };

  ensureSheetHeaders('PARTS_MASTER',      HEADERS.PARTS_MASTER);
  ensureSheetHeaders('PART_SIMILARITIES', HEADERS.PART_SIMILARITIES);
  ensureSheetHeaders('MACHINE_PARTS',     HEADERS.MACHINE_PARTS);
  ensureSheetHeaders('MODELOS',           HEADERS.MODELOS);
  ensureSheetHeaders('MAQUINAS',          HEADERS.MAQUINAS);

  const parts        = getSheetDataActive('PARTS_MASTER');
  const sims         = getSheetData('PART_SIMILARITIES').filter(r =>
    String(r['Ativo'] || 'SIM').toUpperCase() !== 'NÃO'
  );
  const machineParts = getSheetData('MACHINE_PARTS');
  const models       = getSheetDataActive('MODELOS');
  const machines     = getSheetDataActive('MAQUINAS');

  // Índice de similares por Part_ID+Model_ID
  const simMap = {};
  sims.forEach(s => {
    const key = (s['Model_ID'] || '') + '::' + (s['Part_ID'] || '');
    if (!simMap[key]) simMap[key] = [];
    simMap[key].push({
      ref:   s['Ref_Similar']   || '',
      brand: s['Brand_Similar'] || '',
      notes: s['Obs']           || ''
    });
  });

  const modelById   = {};
  models.forEach(m => { modelById[String(m['ID'] || '')] = m; });
  const machineById = {};
  machines.forEach(m => { machineById[String(m['ID'] || '')] = m; });

  const catalogMatches = [];
  const equivalentRefs = new Set();
  const matchedModelIds = new Set();

  parts.forEach(p => {
    const oemNorm  = norm(p['OEM_Ref'] || '');
    const nameNorm = norm(p['Name']    || '');
    const slotNorm = norm(p['Slot']    || '');
    const simsForPart = simMap[(p['Model_ID'] || '') + '::' + (p['Part_ID'] || '')] || [];
    const simRefs = simsForPart.map(s => norm(s.ref)).filter(Boolean);

    const hit = oemNorm === normQuery
      || nameNorm.includes(normQuery)
      || slotNorm === normQuery
      || simRefs.includes(normQuery);

    if (hit) {
      const model = modelById[String(p['Model_ID'] || '')] || {};
      matchedModelIds.add(String(p['Model_ID'] || ''));
      equivalentRefs.add(p['OEM_Ref'] || '');
      simsForPart.forEach(s => equivalentRefs.add(s.ref));

      catalogMatches.push({
        modelId:         p['Model_ID']        || '',
        brand:           model['Marca']        || '',
        model:           model['Modelo']       || '',
        power:           model['Potência']     || '',
        partId:          p['Part_ID']          || '',
        partName:        p['Name']             || '',
        oemRef:          p['OEM_Ref']          || '',
        matchedRef:      query,
        matchType:       oemNorm === normQuery ? 'oem' : simRefs.includes(normQuery) ? 'similar' : 'name_slot',
        slot:            p['Slot']             || '',
        partBrand:       p['Part_Brand']       || '',
        supplierPrimary: p['Supplier_Primary'] || '',
        subName:         p['Sub_Name']         || '',
        intervalH:       p['Interval_H']       || '',
        similarities:    simsForPart
      });
    }
  });

  // Máquinas via MACHINE_PARTS
  const machineMatches = [];
  machineParts.forEach(mp => {
    const mpRefNorm  = norm(mp['Ref'] || '');
    const mpPrevNorm = norm(mp['Ref_Anterior'] || '');
    if (mpRefNorm === normQuery || mpPrevNorm === normQuery) {
      const machine = machineById[String(mp['Machine_ID'] || '')] || {};
      if (!machine['ID']) return;
      machineMatches.push({
        machineId:  mp['Machine_ID'] || '',
        client:     machine['Cliente'] || '',
        brand:      machine['Marca']   || '',
        model:      machine['Modelo']  || '',
        serial:     machine['Série']   || '',
        tag:        machine['TAG']     || '',
        hourTotal:  machine['Hor.Total'] || 0,
        partId:     mp['Part_ID']      || '',
        partName:   mp['Part_Name']    || '',
        ref:        mp['Ref']          || '',
        matchedRef: query,
        source:     'machine_parts'
      });
    }
  });

  // Máquinas via modelo do catálogo (não cobertas por MACHINE_PARTS)
  const mpMachineIds = new Set(machineMatches.map(m => m.machineId));
  machines.forEach(machine => {
    const mkBrand = norm(machine['Marca']  || '');
    const mkModel = norm(machine['Modelo'] || '');
    const match = catalogMatches.find(c =>
      norm(c.brand) === mkBrand && norm(c.model) === mkModel
    );
    if (match && !mpMachineIds.has(String(machine['ID'] || ''))) {
      machineMatches.push({
        machineId:  String(machine['ID'] || ''),
        client:     machine['Cliente']   || '',
        brand:      machine['Marca']     || '',
        model:      machine['Modelo']    || '',
        serial:     machine['Série']     || '',
        tag:        machine['TAG']       || '',
        hourTotal:  machine['Hor.Total'] || 0,
        partId:     match.partId,
        partName:   match.partName,
        ref:        match.oemRef,
        matchedRef: query,
        source:     'catalog_model'
      });
    }
  });

  return {
    status:        'ok',
    query,
    normalizedRef: normQuery,
    catalogMatches,
    machineMatches,
    equivalentRefs: [...equivalentRefs].filter(Boolean),
    warnings: (catalogMatches.length === 0 && machineMatches.length === 0)
      ? ['Nenhuma correspondência encontrada para "' + query + '"'] : []
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// GAS-7 — GET CATALOG AUDIT
// ═══════════════════════════════════════════════════════════════════════════
function getCatalogAudit() {
  ensureSheetHeaders('PARTS_MASTER',      HEADERS.PARTS_MASTER);
  ensureSheetHeaders('PART_SIMILARITIES', HEADERS.PART_SIMILARITIES);
  ensureSheetHeaders('MACHINE_PARTS',     HEADERS.MACHINE_PARTS);
  ensureSheetHeaders('MODELOS',           HEADERS.MODELOS);

  const parts        = getSheetDataActive('PARTS_MASTER');
  const sims         = getSheetData('PART_SIMILARITIES');
  const models       = getSheetDataActive('MODELOS');
  const machineParts = getSheetData('MACHINE_PARTS');
  const norm = ref => String(ref || '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();

  const modelIds = new Set(models.map(m => String(m['ID'] || '').trim()).filter(Boolean));
  const activePartKeys = new Set(parts.map(p => (p['Model_ID'] || '') + '::' + (p['Part_ID'] || '')));

  // Refs duplicadas dentro do mesmo modelo (erro real)
  const refsByModel = {};
  parts.forEach(p => {
    const n = norm(p['OEM_Ref'] || '');
    if (!n) return;
    const key = (p['Model_ID'] || '') + '::' + n;
    refsByModel[key] = (refsByModel[key] || 0) + 1;
  });
  const duplicateRefsInsideSameModel = Object.values(refsByModel).filter(c => c > 1).length;

  // Refs compartilhadas entre modelos (informativo)
  const refsByNorm = {};
  parts.forEach(p => {
    const n = norm(p['OEM_Ref'] || '');
    if (!n) return;
    if (!refsByNorm[n]) refsByNorm[n] = new Set();
    refsByNorm[n].add(p['Model_ID'] || '');
  });
  const sharedRefsAcrossModels = Object.values(refsByNorm).filter(s => s.size > 1).length;

  // Part_IDs duplicados no mesmo modelo (erro real)
  const partIdByModel = {};
  parts.forEach(p => {
    const key = (p['Model_ID'] || '') + '::' + (p['Part_ID'] || '');
    partIdByModel[key] = (partIdByModel[key] || 0) + 1;
  });
  const duplicatePartIdSameModel = Object.values(partIdByModel).filter(c => c > 1).length;

  // Índice de refs do catálogo para verificar peças de máquinas
  const catalogOemRefs = new Set(parts.map(p => norm(p['OEM_Ref'] || '')).filter(Boolean));
  const simRefs        = new Set(sims.map(s => norm(s['Ref_Similar'] || '')).filter(Boolean));
  const allCatalogRefs = new Set([...catalogOemRefs, ...simRefs]);

  const issues = {
    partsWithoutRef:              parts.filter(p => !p['OEM_Ref']).length,
    partsWithoutModel:            parts.filter(p => p['Model_ID'] && !modelIds.has(String(p['Model_ID']))).length,
    orphanSimilarities:           sims.filter(s => !activePartKeys.has((s['Model_ID'] || '') + '::' + (s['Part_ID'] || ''))).length,
    duplicateRefsInsideSameModel,
    duplicatePartIdSameModel,
    modelsWithoutParts:           models.filter(m => !parts.find(p => String(p['Model_ID'] || '') === String(m['ID'] || ''))).length,
    machinePartsNotInCatalog:     machineParts.filter(mp => {
      const r = norm(mp['Ref'] || '');
      return r && !allCatalogRefs.has(r);
    }).length,
    sharedRefsAcrossModels
  };

  const severity = {
    partsWithoutRef:              issues.partsWithoutRef > 0 ? 'warning' : 'ok',
    partsWithoutModel:            issues.partsWithoutModel > 0 ? 'error' : 'ok',
    orphanSimilarities:           issues.orphanSimilarities > 0 ? 'warning' : 'ok',
    duplicateRefsInsideSameModel: issues.duplicateRefsInsideSameModel > 0 ? 'error' : 'ok',
    duplicatePartIdSameModel:     issues.duplicatePartIdSameModel > 0 ? 'error' : 'ok',
    modelsWithoutParts:           issues.modelsWithoutParts > 0 ? 'warning' : 'ok',
    machinePartsNotInCatalog:     issues.machinePartsNotInCatalog > 0 ? 'warning' : 'ok',
    sharedRefsAcrossModels:       'info'
  };

  return { status: 'ok', ts: new Date().toISOString(), issues, severity };
}

// ═══════════════════════════════════════════════════════════════════════════
// INICIALIZAÇÃO DO BANCO DE DADOS
// ═══════════════════════════════════════════════════════════════════════════
function initializeDatabase() {
  const log = [];
  const warnings = [];
  const errors = [];
  const now = new Date().toISOString();

  log.push('╔══════════════════════════════════════════════╗');
  log.push('║  Proper Care — initializeDatabase()          ║');
  log.push('║  ' + now + '  ║');
  log.push('╚══════════════════════════════════════════════╝');

  // ── 1. Garantir existência e cabeçalhos de todas as abas ──────────────
  const SHEET_DEFS = [
    { name: 'MAQUINAS',         headers: HEADERS.MAQUINAS         },
    { name: 'MODELOS',          headers: HEADERS.MODELOS           },
    { name: 'CLIENTES',         headers: HEADERS.CLIENTES          },
    { name: 'VISITAS',          headers: HEADERS.VISITAS           },
    { name: 'PECAS_LOG',        headers: HEADERS.PECAS_LOG         },
    { name: 'MACHINE_PARTS',    headers: HEADERS.MACHINE_PARTS     },
    { name: 'PARTS_MASTER',     headers: HEADERS.PARTS_MASTER      },
    { name: 'PART_SIMILARITIES',headers: HEADERS.PART_SIMILARITIES },
    // v24 — Biblioteca de Subsistemas
    { name: 'SUBSISTEMAS_LIB',   headers: HEADERS.SUBSISTEMAS_LIB    },
    { name: 'SUBSISTEMA_LIB_PARTS',    headers: HEADERS.SUBSISTEMA_LIB_PARTS     },
    { name: 'MODELO_SUBSISTEMA_LIB',    headers: HEADERS.MODELO_SUBSISTEMA_LIB     },
  ];

  SHEET_DEFS.forEach(def => {
    const result = _ensureSheetComplete(def.name, def.headers);
    log.push(result.message);
    if (result.warning) warnings.push(result.warning);
    if (result.error)   errors.push(result.error);
  });

  // ── 2. Validação crítica: PARTS_MASTER com cabeçalho corrompido ───────
  const pmCheck = _checkPartsMasterHeader();
  if (pmCheck.corrupted) {
    const msg = '🔴 PARTS_MASTER: cabeçalho CORROMPIDO — linha 1 contém dado, não cabeçalho. ' +
                'Corrija manualmente antes de continuar. Dado encontrado na L1: ' + pmCheck.firstCellValue;
    errors.push(msg);
    log.push(msg);
  } else {
    log.push('✅ PARTS_MASTER: cabeçalho na linha 1 validado.');
  }

  // ── 3. Relatório de orphans ────────────────────────────────────────────
  const orphanResult = _checkOrphans();
  log.push('');
  log.push('── Verificação de orphans ──');
  log.push('  MACHINE_PARTS órfãos: ' + orphanResult.machinePartsOrphans);
  log.push('  VISITAS órfãs:        ' + orphanResult.visitasOrphans);
  if (orphanResult.machinePartsOrphans > 0 || orphanResult.visitasOrphans > 0) {
    warnings.push('Existem registros órfãos. Execute getDuplicates() e getSystemHealth() para detalhes.');
  }

  // ── 4. Relatório de duplicatas em MODELOS ─────────────────────────────
  const dupModelos = _checkModeloDuplicates();
  log.push('');
  log.push('── Verificação de modelos duplicados ──');
  if (dupModelos.length > 0) {
    dupModelos.forEach(d => {
      const msg = '  ⚠️  Modelo duplicado (ATIVO): Marca=' + d.brand + ' Modelo=' + d.model +
                  ' | IDs: ' + d.ids.join(', ');
      log.push(msg);
      warnings.push(msg);
    });
  } else {
    log.push('  Nenhum modelo duplicado ativo encontrado.');
  }

  // ── 5. Resumo final ───────────────────────────────────────────────────
  log.push('');
  log.push('── Resumo ──');
  log.push('  Erros críticos: '   + errors.length);
  log.push('  Avisos:         '   + warnings.length);
  log.push(errors.length === 0 ? '✅ Banco de dados pronto para uso.' : '🔴 Corrija os erros antes de usar.');

  const fullLog = log.join('\n');
  Logger.log(fullLog);

  return {
    status:   errors.length === 0 ? 'ok' : 'error',
    errors,
    warnings,
    log:      fullLog,
    ts:       now
  };
}

// ── Garante que a aba existe e tem todas as colunas do schema ─────────────
function _ensureSheetComplete(sheetName, expectedHeaders) {
  let sheet = SS.getSheetByName(sheetName);
  const result = { message: '', warning: null, error: null };

  // Aba não existe: criar com cabeçalho completo
  if (!sheet) {
    sheet = SS.insertSheet(sheetName);
    sheet.appendRow(expectedHeaders);
    sheet.getRange(1, 1, 1, expectedHeaders.length)
      .setFontWeight('bold')
      .setBackground('#1a3a6b')
      .setFontColor('#ffffff');
    sheet.setFrozenRows(1);
    sheet.setColumnWidths(1, expectedHeaders.length, 150);
    result.message = '✅ ' + sheetName + ': aba criada com ' + expectedHeaders.length + ' colunas.';
    return result;
  }

  // Aba existe: verificar e adicionar colunas faltantes
  const lastCol = sheet.getLastColumn();
  if (lastCol === 0) {
    // Aba totalmente vazia
    sheet.appendRow(expectedHeaders);
    sheet.getRange(1, 1, 1, expectedHeaders.length)
      .setFontWeight('bold')
      .setBackground('#1a3a6b')
      .setFontColor('#ffffff');
    sheet.setFrozenRows(1);
    result.message = '✅ ' + sheetName + ': cabeçalho inicial inserido (' + expectedHeaders.length + ' colunas).';
    return result;
  }

  const currentHeaders = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  const missing = expectedHeaders.filter(h => !currentHeaders.includes(h));

  if (missing.length === 0) {
    result.message = '✅ ' + sheetName + ': cabeçalho completo (' + currentHeaders.length + ' colunas).';
  } else {
    missing.forEach(col => {
      const newColIdx = sheet.getLastColumn() + 1;
      const cell = sheet.getRange(1, newColIdx);
      cell.setValue(col)
          .setFontWeight('bold')
          .setBackground('#1a3a6b')
          .setFontColor('#ffffff');
    });
    result.message = '🔧 ' + sheetName + ': ' + missing.length + ' coluna(s) adicionada(s): [' + missing.join(', ') + ']';
  }

  return result;
}

// ── Detecta PARTS_MASTER com cabeçalho corrompido ────────────────────────
function _checkPartsMasterHeader() {
  const sheet = SS.getSheetByName('PARTS_MASTER');
  if (!sheet || sheet.getLastRow() === 0) {
    return { corrupted: false };
  }
  const firstCell = sheet.getRange(1, 1).getValue();
  const firstCellStr = String(firstCell || '').trim();

  // Se a célula A1 começa com 'dp-', 'imp', 'EQ-' ou 'MK-' é dado, não cabeçalho
  const looksLikeData = /^(dp-|imp|EQ-|MK-|VIS-|CLI-|MOD-|SIM-)/.test(firstCellStr)
    || (firstCellStr.length > 0 && firstCellStr !== 'Part_ID');

  return {
    corrupted:      looksLikeData,
    firstCellValue: firstCellStr
  };
}

// ── Contagem rápida de orphans ────────────────────────────────────────────
function _checkOrphans() {
  try {
    const maqSheet = SS.getSheetByName('MAQUINAS');
    if (!maqSheet) return { machinePartsOrphans: 0, visitasOrphans: 0 };

    const maqData    = maqSheet.getDataRange().getValues();
    const maqHeaders = maqData[0];
    const idxId      = maqHeaders.indexOf('ID');
    const idxAtivo   = maqHeaders.indexOf('Ativo');

    const activeMachineIds = new Set();
    for (let i = 1; i < maqData.length; i++) {
      const ativo = String(maqData[i][idxAtivo] || 'SIM').toUpperCase();
      if (ativo !== 'NÃO') {
        const id = String(maqData[i][idxId] || '').trim();
        if (id) activeMachineIds.add(id);
      }
    }

    let mpOrphans = 0;
    const mpSheet = SS.getSheetByName('MACHINE_PARTS');
    if (mpSheet && mpSheet.getLastRow() > 1) {
      const mpData    = mpSheet.getDataRange().getValues();
      const mpHeaders = mpData[0];
      const mpIdxMid  = mpHeaders.indexOf('Machine_ID');
      for (let i = 1; i < mpData.length; i++) {
        const mid = String(mpData[i][mpIdxMid] || '').trim();
        if (mid && !activeMachineIds.has(mid)) mpOrphans++;
      }
    }

    let visitOrphans = 0;
    const vSheet = SS.getSheetByName('VISITAS');
    if (vSheet && vSheet.getLastRow() > 1) {
      const vData    = vSheet.getDataRange().getValues();
      const vHeaders = vData[0];
      const vIdxMid  = vHeaders.indexOf('Machine_ID');
      for (let i = 1; i < vData.length; i++) {
        const mid = String(vData[i][vIdxMid] || '').trim();
        if (mid && !activeMachineIds.has(mid)) visitOrphans++;
      }
    }

    return { machinePartsOrphans: mpOrphans, visitasOrphans: visitOrphans };
  } catch (e) {
    return { machinePartsOrphans: -1, visitasOrphans: -1, error: e.message };
  }
}

// ── Detecta modelos com mesma Marca+Modelo ambos ativos ──────────────────
function _checkModeloDuplicates() {
  try {
    const sheet = SS.getSheetByName('MODELOS');
    if (!sheet) return [];
    const data    = sheet.getDataRange().getValues();
    const headers = data[0];
    const idxId    = headers.indexOf('ID');
    const idxBrand = headers.indexOf('Marca');
    const idxModel = headers.indexOf('Modelo');
    const idxAtivo = headers.indexOf('Ativo');

    const seen = {};
    for (let i = 1; i < data.length; i++) {
      const ativo = String(data[i][idxAtivo] || 'SIM').toUpperCase();
      if (ativo === 'NÃO') continue;
      const key = String(data[i][idxBrand] || '').trim().toLowerCase()
                + '|' + String(data[i][idxModel] || '').trim().toLowerCase();
      if (!seen[key]) seen[key] = { brand: data[i][idxBrand], model: data[i][idxModel], ids: [] };
      seen[key].ids.push(String(data[i][idxId] || '').trim());
    }

    return Object.values(seen).filter(v => v.ids.length > 1);
  } catch (e) {
    return [];
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// FORM 08 — Diagnóstico Sem Desmontagem — Upload de Fotos  (v26)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Salva uma foto do Form 08 no Drive.
 * Payload: { os, cliente, secao, nomeArquivo, base64, mimeType }
 * Retorna: { ok: true, url: 'https://drive.google.com/file/d/.../view' }
 *
 * Estrutura criada no Drive:
 *   [ROOT] / ProperCare_Fotos / Form08 / {OS}_{Cliente} /
 *     {secao}_{timestamp}_{nome}.jpg
 */
function salvarFotoForm08(body) {
  var root    = getRootFolder_();
  var fFotos  = getOrCreateDriveFolder(root,  'ProperCare_Fotos');
  var fForm08 = getOrCreateDriveFolder(fFotos, 'Form08');

  var osStr  = sanitizeFolder_(String(body.os      || 'SemOS').trim());
  var cliStr = sanitizeFolder_(String(body.cliente  || 'SemCliente').trim());
  var fCase  = getOrCreateDriveFolder(fForm08, osStr + '_' + cliStr);

  var secao    = sanitizeFolder_(String(body.secao      || 'geral').trim());
  var ts       = String(Date.now());
  var baseName = sanitizeFolder_(String(body.nomeArquivo || 'foto').replace(/\.[^.]+$/, ''));
  var fileName = secao + '_' + ts + '_' + baseName + '.jpg';

  var mime = body.mimeType || 'image/jpeg';
  var blob = Utilities.newBlob(Utilities.base64Decode(body.base64), mime, fileName);
  var file = fCase.createFile(blob);

  var linkPublico = PropertiesService.getScriptProperties()
                      .getProperty('DRIVE_LINK_PUBLICO') === 'true';
  if (linkPublico) {
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  }

  var url = 'https://drive.google.com/file/d/' + file.getId() + '/view';
  return { ok: true, url: url };
}

/**
 * Remove caracteres inválidos em nomes de pasta/arquivo no Drive.
 * Mantém letras, números, hífen e underscore. Trunca a 80 chars.
 */
function sanitizeFolder_(str) {
  return String(str || '')
    .replace(/[\/\\:*?"<>|]/g, '_')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/, '')
    .substring(0, 80) || 'sem_nome';
}

// ── v27: PERFIS E HUB ──────────────────────────────────────────────────────

function getPerfis() {
  ensureSheetHeaders('CAT_PERFIS', HEADERS.CAT_PERFIS);
  var rows = getSheetData('CAT_PERFIS');
  var ativos = rows.filter(function(p){ return isActive_(p.ativo); });
  return { status: 'ok', perfis: ativos };
}

function getPerfilById(params) {
  ensureSheetHeaders('CAT_PERFIS', HEADERS.CAT_PERFIS);
  var id = String(params.id_perfil || '').trim();
  if (!id) return { status: 'error', error: 'id_perfil obrigatório' };
  var rows = getSheetData('CAT_PERFIS');
  var perfil = rows.find(function(p){ return String(p.id_perfil) === id; });
  if (!perfil) return { status: 'error', error: 'Perfil não encontrado' };
  return { status: 'ok', perfil: perfil };
}

function savePerfil(body) {
  ensureSheetHeaders('CAT_PERFIS', HEADERS.CAT_PERFIS);
  if (!body.nome_perfil) return { status: 'error', error: 'nome_perfil é obrigatório' };
  var sheet = getOrCreateSheet('CAT_PERFIS', HEADERS.CAT_PERFIS);
  var data = sheet.getDataRange().getValues();
  var headers = data[0] || HEADERS.CAT_PERFIS;
  var idx = {}; headers.forEach(function(h,i){ idx[h]=i; });
  var now = new Date().toISOString();
  var responsavel = body.responsavel || 'admin';
  var modulosJson = typeof body.modulos_acesso === 'string'
    ? body.modulos_acesso
    : JSON.stringify(body.modulos_acesso || []);

  // Edição
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][idx.id_perfil]) === String(body.id_perfil || '')) {
      var row = i + 1;
      if (body.nome_perfil !== undefined) sheet.getRange(row, idx.nome_perfil + 1).setValue(body.nome_perfil);
      if (body.modulos_acesso !== undefined) sheet.getRange(row, idx.modulos_acesso + 1).setValue(modulosJson);
      if (body.is_admin !== undefined) sheet.getRange(row, idx.is_admin + 1).setValue(isActive_(body.is_admin) ? 'SIM' : 'NÃO');
      if (body.ativo !== undefined) sheet.getRange(row, idx.ativo + 1).setValue(isActive_(body.ativo) ? 'SIM' : 'NÃO');
      sheet.getRange(row, idx.Updated_At + 1).setValue(now);
      sheet.getRange(row, idx.Created_By + 1).setValue(responsavel);
      return { status: 'ok', action: 'updated', id_perfil: body.id_perfil };
    }
  }

  // Criação
  var newId = body.id_perfil || ('PERF-' + String(Date.now()).slice(-5));
  var novo = {
    id_perfil: newId,
    nome_perfil: body.nome_perfil,
    modulos_acesso: modulosJson,
    is_admin: isActive_(body.is_admin) ? 'SIM' : 'NÃO',
    ativo: 'SIM',
    Created_At: now,
    Updated_At: now,
    Created_By: responsavel
  };
  sheet.appendRow(headers.map(function(h){ return novo[h] !== undefined ? novo[h] : ''; }));
  return { status: 'ok', action: 'created', id_perfil: newId };
}

function deletePerfil(body) {
  ensureSheetHeaders('CAT_PERFIS', HEADERS.CAT_PERFIS);
  if (!body.id_perfil) return { status: 'error', error: 'id_perfil obrigatório' };
  var sheet = getOrCreateSheet('CAT_PERFIS', HEADERS.CAT_PERFIS);
  var data = sheet.getDataRange().getValues();
  var headers = data[0] || HEADERS.CAT_PERFIS;
  var idx = {}; headers.forEach(function(h,i){ idx[h]=i; });
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][idx.id_perfil]) === String(body.id_perfil)) {
      sheet.getRange(i + 1, idx.ativo + 1).setValue('NÃO');
      sheet.getRange(i + 1, idx.Updated_At + 1).setValue(new Date().toISOString());
      return { status: 'ok', action: 'deleted', id_perfil: body.id_perfil };
    }
  }
  return { status: 'error', error: 'Perfil não encontrado' };
}

function updateAcessoExtra(body) {
  // Atualiza campo acesso_extra de um usuário específico (id_usuario ou id_tecnico compat)
  var idUsuario = body.id_usuario || body.id_tecnico;
  if (!idUsuario) return { status: 'error', error: 'id_usuario obrigatório' };
  ensureSheetHeaders('CAT_USUARIOS', HEADERS.CAT_USUARIOS);
  var sheet = getOrCreateSheet('CAT_USUARIOS', HEADERS.CAT_USUARIOS);
  var data = sheet.getDataRange().getValues();
  var headers = data[0] || HEADERS.CAT_USUARIOS;
  var idx = {}; headers.forEach(function(h,i){ idx[h]=i; });
  var acessoJson = typeof body.acesso_extra === 'string'
    ? body.acesso_extra
    : JSON.stringify(body.acesso_extra || []);
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][idx.id]) === String(idUsuario)) {
      if (idx.acesso_extra >= 0) {
        sheet.getRange(i + 1, idx.acesso_extra + 1).setValue(acessoJson);
        sheet.getRange(i + 1, idx.Updated_At + 1).setValue(new Date().toISOString());
      }
      return { status: 'ok', id_usuario: idUsuario };
    }
  }
  return { status: 'error', error: 'Usuário não encontrado' };
}

// v35: renomeado de loginTecnicoHub (alias abaixo para compat)
function loginUsuarioHub(body) {
  // v32 — suporta Modo A (consulta por e-mail) e Modo B (login com PIN + id_usuario)
  // Retorna modulos_efetivos = union(perfil.modulos_acesso, usuario.acesso_extra)
  ensureOSHeaders_();

  // Valida JWT Google
  var googlePayload;
  try {
    googlePayload = verificarGoogleToken_(body.google_credential || '');
  } catch(gErr) {
    return { status: 'ok', valido: false, error: 'Google auth inválido: ' + gErr.message };
  }

  var usuSheet = getOrCreateSheet('CAT_USUARIOS', HEADERS.CAT_USUARIOS);
  var usuData  = usuSheet.getDataRange().getValues();
  if (usuData.length === 0) {
    // Leitura suspeita — pode ser instância GAS desatualizada após ociosidade.
    Utilities.sleep(300);
    usuData = usuSheet.getDataRange().getValues();
  }
  var usuHeaders = usuData[0] || HEADERS.CAT_USUARIOS;
  var usuIdx = {};
  usuHeaders.forEach(function(h, i) { usuIdx[h] = i; });

  // ── MODO A: sem pin_hash — consulta por e-mail ────────────────────────────
  if (!body.pin_hash) {
    var email = (googlePayload.email || '').toLowerCase().trim();
    var matches = [];
    for (var r = 1; r < usuData.length; r++) {
      var rowEmail = String(usuData[r][usuIdx.email] || '').toLowerCase().trim();
      if (rowEmail === email && isActive_(usuData[r][usuIdx.ativo])) {
        matches.push({
          id:   String(usuData[r][usuIdx.id]   || ''),
          nome: String(usuData[r][usuIdx.nome] || '')
        });
      }
    }
    if (matches.length === 0) {
      // Retry se veio vazio: pode ser leitura obsoleta
      Utilities.sleep(300);
      usuData = usuSheet.getDataRange().getValues();
      matches = [];
      for (var rr = 1; rr < usuData.length; rr++) {
        var rowEmail2 = String(usuData[rr][usuIdx.email] || '').toLowerCase().trim();
        if (rowEmail2 === email && isActive_(usuData[rr][usuIdx.ativo])) {
          matches.push({
            id:   String(usuData[rr][usuIdx.id]   || ''),
            nome: String(usuData[rr][usuIdx.nome] || '')
          });
        }
      }
    }
    if (matches.length === 0) {
      return { status: 'ok', valido: false, error: 'Nenhum usuário ativo para este e-mail.' };
    }
    if (matches.length === 1) {
      return { status: 'ok', modo: 'pin_direto', tecnico_id: matches[0].id, tecnico_nome: matches[0].nome };
    }
    return { status: 'ok', modo: 'selecao', usuarios: matches };
  }

  // ── MODO B: com pin_hash — valida PIN contra id_usuario específico ────────
  var pinHash  = String(body.pin_hash  || '').trim();
  var idUsuario = String(body.id_usuario || body.id_tecnico || '').trim();

  var usuRow = -1, tec = null;
  for (var r = 1; r < usuData.length; r++) {
    var rowId  = String(usuData[r][usuIdx.id]       || '').trim();
    var rowPin = String(usuData[r][usuIdx.pin_hash]  || '').trim();
    if (rowId === idUsuario && rowPin === pinHash && isActive_(usuData[r][usuIdx.ativo])) {
      usuRow = r + 1;
      tec = osRowToObject_(usuHeaders, usuData[r]);
      break;
    }
  }
  if (!tec) return { status: 'ok', valido: false, error: 'PIN inválido ou usuário inativo.' };

  // Atualiza ultimo_login_at
  if (usuIdx.ultimo_login_at >= 0 && usuRow > 0) {
    usuSheet.getRange(usuRow, usuIdx.ultimo_login_at + 1).setValue(new Date().toISOString());
  }

  // Busca perfil
  var perfilModulos = [];
  var isAdmin = false;
  var nomePerfil = tec.perfil || '';
  var idPerfil = tec.perfil || '';

  ensureSheetHeaders('CAT_PERFIS', HEADERS.CAT_PERFIS);
  var perfSheet = getOrCreateSheet('CAT_PERFIS', HEADERS.CAT_PERFIS);
  var perfData = perfSheet.getDataRange().getValues();
  if (perfData.length > 1) {
    var perfHeaders = perfData[0];
    var perfIdx = {}; perfHeaders.forEach(function(h,i){ perfIdx[h]=i; });
    for (var p = 1; p < perfData.length; p++) {
      var pId   = String(perfData[p][perfIdx.id_perfil]   || '');
      var pNome = String(perfData[p][perfIdx.nome_perfil] || '');
      // Match por id_perfil ou por nome_perfil (compatibilidade)
      if (pId === String(tec.perfil || '') || pNome === String(tec.perfil || '')) {
        idPerfil   = pId;
        nomePerfil = pNome;
        isAdmin = isActive_(perfData[p][perfIdx.is_admin]);
        try {
          var raw = String(perfData[p][perfIdx.modulos_acesso] || '[]');
          perfilModulos = JSON.parse(raw);
        } catch(e) { perfilModulos = []; }
        break;
      }
    }
  }

  // Se is_admin, todos os módulos
  var modulosEfetivos = isAdmin
    ? ['pcf_inspecao','pcf_preventiva','pcf_pipeline','form08','form09','form10','rotores','pcm_leitura','pcm_completo','forms_avulso']
    : perfilModulos.slice();

  // Mescla acesso_extra do usuário
  if (!isAdmin) {
    var extra = [];
    try {
      var rawExtra = String(tec.acesso_extra || '[]');
      extra = JSON.parse(rawExtra);
    } catch(e) { extra = []; }
    extra.forEach(function(m){
      if (modulosEfetivos.indexOf(m) < 0) modulosEfetivos.push(m);
    });
  }

  registrarEventoOperacional_({
    tipo_evento: 'LOGIN_HUB', id_usuario: tec.id, nome_usuario: tec.nome,
    acao_realizada: 'Login via ProperHub', responsavel_nome: tec.nome || 'usuário', origem: 'HUB'
  });

  return {
    status: 'ok',
    valido: true,
    tecnico: {
      id:          tec.id           || '',
      nome:        tec.nome         || '',
      id_perfil:   idPerfil,
      nome_perfil: nomePerfil
    },
    modulos:      modulosEfetivos,
    is_admin:     isAdmin,
    google_email: googlePayload.email || ''
  };
}
function loginTecnicoHub(body) { return loginUsuarioHub(body); } // compat — remover após sessões 2/3

// ── v28: GOOGLE OAUTH ────────────────────────────────────────────────────────

/**
 * Valida um JWT emitido pelo Google Identity Services.
 * Verifica: formato, audiência (Client ID), expiração e domínio hosted (hd).
 * Não faz chamada de rede — decodifica o payload base64 localmente.
 * Lança Error com mensagem descritiva se inválido.
 * Retorna o payload decodificado se válido.
 */
function verificarGoogleToken_(credential) {
  if (!credential || typeof credential !== 'string') {
    throw new Error('google_credential ausente');
  }
  var parts = credential.split('.');
  if (parts.length !== 3) {
    throw new Error('JWT mal formado');
  }
  var payloadJson;
  try {
    payloadJson = Utilities.newBlob(
      Utilities.base64DecodeWebSafe(parts[1])
    ).getDataAsString();
  } catch(e) {
    throw new Error('Falha ao decodificar JWT: ' + e.message);
  }
  var payload;
  try {
    payload = JSON.parse(payloadJson);
  } catch(e) {
    throw new Error('Payload JWT inválido');
  }
  if (payload.aud !== GOOGLE_CLIENT_ID_HUB) {
    throw new Error('JWT: audiência inválida');
  }
  var agora = Math.floor(Date.now() / 1000);
  if (!payload.exp || payload.exp < agora) {
    throw new Error('JWT expirado');
  }
  if (payload.hd !== GOOGLE_DOMAIN_HUB) {
    throw new Error('JWT: domínio não autorizado (' + (payload.hd || 'sem hd') + ')');
  }
  return payload;
}

// ═══════════════════════════════════════════════════════════════════════════
// v29 — PROPERFLOW: PIPELINE DE ORDENS DE SERVIÇO
// ═══════════════════════════════════════════════════════════════════════════

// ── saveFormulario ────────────────────────────────────────────────────────
function saveFormulario(body) {
  ensureSheetHeaders('FORMULARIOS', HEADERS.FORMULARIOS);
  if (!body.os_id || !body.tipo_formulario) {
    return { status: 'error', error: 'Campos obrigatórios: os_id, tipo_formulario' };
  }
  var sheet  = getOrCreateSheet('FORMULARIOS', HEADERS.FORMULARIOS);
  var now    = new Date().toISOString();
  var formId = 'FORM-' + body.tipo_formulario.toUpperCase() + '-' + now.replace(/[^0-9]/g,'').slice(0,14);
  var statusForm = body.status || 'completo';
  sheet.appendRow([
    formId,
    String(body.os_id || '').trim(),
    String(body.tipo_formulario || '').trim(),
    String(body.tecnico_id || '').trim(),
    String(body.tecnico_nome || '').trim(),
    body.data || now.slice(0, 10),
    statusForm,
    body.campos_json ? JSON.stringify(body.campos_json) : (body.campos ? JSON.stringify(body.campos) : '{}'),
    body.fotos_json  ? JSON.stringify(body.fotos_json)  : (body.fotos  ? JSON.stringify(body.fotos)  : '[]'),
    'SIM', 'PRODUCAO', now, now
  ]);
  try {
    autoCompletarTarefa(body.os_id, body.tipo_formulario, {
      status: statusForm,
      id_formulario: formId,
      tecnico: body.tecnico_nome || body.tecnico_id || ''
    });
  } catch(e) {}
  return { status: 'ok', form_id: formId };
}

// ── getPipelineByOS ───────────────────────────────────────────────────────
function getPipelineByOS(os_id) {
  if (!os_id) return { status: 'error', error: 'os_id obrigatório' };
  ensureSheetHeaders('PIPELINE_TAREFAS', HEADERS.PIPELINE_TAREFAS);
  var tarefas = getSheetDataActive('PIPELINE_TAREFAS')
    .filter(function(r) { return String(r['OS_ID'] || '').trim() === String(os_id).trim(); });
  tarefas.sort(function(a, b) {
    var fo = (parseInt(a['Fase_Ordem']) || 0) - (parseInt(b['Fase_Ordem']) || 0);
    if (fo !== 0) return fo;
    return (parseInt(a['Ordem']) || 0) - (parseInt(b['Ordem']) || 0);
  });
  return { status: 'ok', os_id: os_id, tarefas: tarefas };
}

// ── updateTarefaStatus ────────────────────────────────────────────────────
function updateTarefaStatus(os_id, tarefa_id, novoStatus, usuario, observacao) {
  if (!os_id || !tarefa_id || !novoStatus) {
    return { status: 'error', error: 'os_id, tarefa_id e status são obrigatórios' };
  }
  ensureSheetHeaders('PIPELINE_TAREFAS', HEADERS.PIPELINE_TAREFAS);
  var sheet   = getOrCreateSheet('PIPELINE_TAREFAS', HEADERS.PIPELINE_TAREFAS);
  var data    = sheet.getDataRange().getValues();
  var headers = data[0];
  var idxOS   = headers.indexOf('OS_ID');
  var idxTar  = headers.indexOf('Tarefa_ID');
  var idxStat = headers.indexOf('Status');
  var idxPrev = headers.indexOf('Status_anterior');
  var idxConc = headers.indexOf('Concluido_por');
  var idxDatC = headers.indexOf('Data_conclusao');
  var idxUpd  = headers.indexOf('Updated_At');
  var idxObs  = headers.indexOf('Observacao');
  var now     = new Date().toISOString();
  var found   = false;
  var statusAnterior = '';
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][idxOS] || '').trim()  === String(os_id).trim() &&
        String(data[i][idxTar] || '').trim() === String(tarefa_id).trim()) {
      statusAnterior = data[i][idxStat];
      if (idxPrev >= 0) sheet.getRange(i + 1, idxPrev + 1).setValue(statusAnterior);
      sheet.getRange(i + 1, idxStat + 1).setValue(novoStatus);
      if (idxConc >= 0) sheet.getRange(i + 1, idxConc + 1).setValue(usuario || '');
      if (idxObs >= 0 && observacao) sheet.getRange(i + 1, idxObs + 1).setValue(observacao);
      if (novoStatus === 'completo' && idxDatC >= 0) sheet.getRange(i + 1, idxDatC + 1).setValue(now);
      if (idxUpd >= 0) sheet.getRange(i + 1, idxUpd + 1).setValue(now);
      found = true;
      break;
    }
  }
  if (!found) return { status: 'error', error: 'Tarefa não encontrada: ' + tarefa_id + ' na OS ' + os_id };
  if (novoStatus === 'completo') {
    _verificarDesbloqueios_(os_id, tarefa_id, usuario);
  }
  return { status: 'ok', os_id: os_id, tarefa_id: tarefa_id, status: novoStatus, status_anterior: statusAnterior };
}

// ── autoCompletarTarefa ───────────────────────────────────────────────────
// Chamada internamente pelo saveFormulario, saveRotorColeta, saveVisit, savePreventiva.
// Identifica a tarefa vinculada ao trigger na OS e atualiza o status.
function autoCompletarTarefa(os_id, trigger_type, status_payload) {
  if (!os_id || !trigger_type) return;
  // Mapeia trigger para o tipo de tarefa AutoVinculada
  var tipoTarefaMap = {
    'form08':     'auto:form08',
    'form09':     'auto:form09',
    'form10':     'auto:form10',
    'rotores':    'auto:rotores',
    'inspecao':   'auto:inspecao',
    'preventiva': 'auto:preventiva'
  };
  var tipoTarefa = tipoTarefaMap[String(trigger_type).toLowerCase()] || null;
  if (!tipoTarefa) return; // trigger não vinculado a tarefa automática — ignorar silenciosamente

  ensureSheetHeaders('PIPELINE_TAREFAS', HEADERS.PIPELINE_TAREFAS);
  var sheet   = getOrCreateSheet('PIPELINE_TAREFAS', HEADERS.PIPELINE_TAREFAS);
  var data    = sheet.getDataRange().getValues();
  var headers = data[0];
  var idxOS   = headers.indexOf('OS_ID');
  var idxTar  = headers.indexOf('Tarefa_ID');
  var idxTipo = headers.indexOf('Tipo');
  var idxStat = headers.indexOf('Status');
  var idxPrev = headers.indexOf('Status_anterior');
  var idxConc = headers.indexOf('Concluido_por');
  var idxDatC = headers.indexOf('Data_conclusao');
  var idxDatA = headers.indexOf('Data_abertura');
  var idxUpd  = headers.indexOf('Updated_At');
  var now     = new Date().toISOString();
  var novoStatus = status_payload.status || 'completo';

  for (var i = 1; i < data.length; i++) {
    if (String(data[i][idxOS]   || '').trim() !== String(os_id).trim())      continue;
    if (String(data[i][idxTipo] || '').trim() !== tipoTarefa)                continue;
    var statusAtual = String(data[i][idxStat] || '').trim();
    // Não regredir: em_andamento → pendente nunca acontece
    if (statusAtual === 'completo') continue;

    if (idxPrev >= 0) sheet.getRange(i + 1, idxPrev + 1).setValue(statusAtual);
    sheet.getRange(i + 1, idxStat + 1).setValue(novoStatus);
    if (novoStatus === 'em_andamento' && idxDatA >= 0 && !data[i][idxDatA]) {
      sheet.getRange(i + 1, idxDatA + 1).setValue(now);
    }
    if (idxConc >= 0) sheet.getRange(i + 1, idxConc + 1).setValue(status_payload.tecnico || '');
    if (novoStatus === 'completo' && idxDatC >= 0) sheet.getRange(i + 1, idxDatC + 1).setValue(now);
    if (idxUpd >= 0) sheet.getRange(i + 1, idxUpd + 1).setValue(now);

    var tarefaId = String(data[i][idxTar] || '');
    if (novoStatus === 'completo') {
      _verificarDesbloqueios_(os_id, tarefaId, status_payload.tecnico || 'sistema');
    }
    break; // primeira tarefa vinculada encontrada — suficiente
  }
}

// ── getTemplates ──────────────────────────────────────────────────────────
function getTemplates() {
  ensureSheetHeaders('PIPELINE_TEMPLATES', HEADERS.PIPELINE_TEMPLATES);
  var templates = getSheetDataActive('PIPELINE_TEMPLATES')
    .filter(function(t) { return String(t['Ativo'] || 'SIM').toUpperCase() !== 'NÃO'; });
  return { status: 'ok', templates: templates };
}

// ── saveTemplate ──────────────────────────────────────────────────────────
function saveTemplate(body) {
  ensureSheetHeaders('PIPELINE_TEMPLATES', HEADERS.PIPELINE_TEMPLATES);
  if (!body.nome) return { status: 'error', error: 'nome do template é obrigatório' };
  var sheet   = getOrCreateSheet('PIPELINE_TEMPLATES', HEADERS.PIPELINE_TEMPLATES);
  var data    = sheet.getDataRange().getValues();
  var headers = data[0];
  var now     = new Date().toISOString();
  var tarefasJson = body.tarefas_json
    ? (typeof body.tarefas_json === 'string' ? body.tarefas_json : JSON.stringify(body.tarefas_json))
    : '[]';

  if (body.template_id) {
    // Atualizar template existente
    var idxID   = headers.indexOf('Template_ID');
    var idxNome = headers.indexOf('Nome');
    var idxTar  = headers.indexOf('Tarefas_JSON');
    var idxUpd  = headers.indexOf('Updated_At');
    for (var i = 1; i < data.length; i++) {
      if (String(data[i][idxID] || '').trim() === String(body.template_id).trim()) {
        sheet.getRange(i + 1, idxNome + 1).setValue(body.nome);
        sheet.getRange(i + 1, idxTar  + 1).setValue(tarefasJson);
        if (idxUpd >= 0) sheet.getRange(i + 1, idxUpd + 1).setValue(now);
        return { status: 'ok', template_id: body.template_id, action: 'updated' };
      }
    }
  }
  // Inserir novo template
  var templateId = body.template_id || ('TPL-' + now.replace(/[^0-9]/g,'').slice(0,14));
  sheet.appendRow([
    templateId, body.nome, tarefasJson,
    'SIM', 'PRODUCAO', now, now, body.usuario || ''
  ]);
  return { status: 'ok', template_id: templateId, action: 'inserted' };
}

// ── instanciarPipeline ────────────────────────────────────────────────────
// Cria as linhas em PIPELINE_TAREFAS a partir de um template.
// Se já existe pipeline para a OS, arquiva o anterior (Ativo = 'ARQUIVADO').
function instanciarPipeline(os_id, template_id) {
  if (!os_id || !template_id) {
    return { status: 'error', error: 'os_id e template_id são obrigatórios' };
  }
  ensureSheetHeaders('PIPELINE_TEMPLATES', HEADERS.PIPELINE_TEMPLATES);
  ensureSheetHeaders('PIPELINE_TAREFAS',   HEADERS.PIPELINE_TAREFAS);

  // Buscar template
  var tplSheet  = getOrCreateSheet('PIPELINE_TEMPLATES', HEADERS.PIPELINE_TEMPLATES);
  var tplData   = tplSheet.getDataRange().getValues();
  var tplHeaders = tplData[0];
  var idxTplID  = tplHeaders.indexOf('Template_ID');
  var idxTplTar = tplHeaders.indexOf('Tarefas_JSON');
  var tarefasRaw = null;
  for (var t = 1; t < tplData.length; t++) {
    if (String(tplData[t][idxTplID] || '').trim() === String(template_id).trim()) {
      tarefasRaw = tplData[t][idxTplTar];
      break;
    }
  }
  if (!tarefasRaw) return { status: 'error', error: 'Template não encontrado: ' + template_id };

  var tarefas;
  try { tarefas = JSON.parse(tarefasRaw); } catch(e) { return { status: 'error', error: 'Tarefas_JSON inválido no template' }; }

  // Arquivar pipeline anterior desta OS, se existir
  var tarSheet  = getOrCreateSheet('PIPELINE_TAREFAS', HEADERS.PIPELINE_TAREFAS);
  var tarData   = tarSheet.getDataRange().getValues();
  var tarHdrs   = tarData[0];
  var idxTOS    = tarHdrs.indexOf('OS_ID');
  var idxTAtv   = tarHdrs.indexOf('Ativo');
  for (var i = 1; i < tarData.length; i++) {
    if (String(tarData[i][idxTOS] || '').trim() === String(os_id).trim() &&
        String(tarData[i][idxTAtv] || 'SIM').toUpperCase() !== 'ARQUIVADO') {
      tarSheet.getRange(i + 1, idxTAtv + 1).setValue('ARQUIVADO');
    }
  }

  // Instanciar novas tarefas
  var now = new Date().toISOString();
  for (var k = 0; k < tarefas.length; k++) {
    var t = tarefas[k];
    var statusInicial = 'pendente';
    // Tarefas com dependências começam bloqueadas
    if (t.depende_de && t.depende_de.length > 0) statusInicial = 'bloqueado';
    tarSheet.appendRow([
      String(os_id).trim(),
      String(t.id || ('T' + String(k+1).padStart(2,'0'))),
      String(template_id).trim(),
      String(t.nome || ''),
      String(t.tipo || 'manual'),
      String(t.fase || ''),
      parseInt(t.fase_ordem) || (k + 1),
      parseInt(t.ordem)      || (k + 1),
      JSON.stringify(t.depende_de   || []),
      JSON.stringify(t.paralelo_com || []),
      t.bloqueante ? 'SIM' : 'NÃO',
      t.alerta_dias || '',
      String(t.descricao || ''),
      statusInicial,
      '', '', '', '', '',
      'SIM', 'PRODUCAO', now, now
    ]);
  }
  return { status: 'ok', os_id: os_id, template_id: template_id, tarefas_criadas: tarefas.length };
}

// ── getNotificacoes ───────────────────────────────────────────────────────
function getNotificacoes(usuario) {
  if (!usuario) return { status: 'error', error: 'usuario obrigatório' };
  ensureSheetHeaders('PIPELINE_NOTIF', HEADERS.PIPELINE_NOTIF);
  var notifs = getSheetDataActive('PIPELINE_NOTIF').filter(function(n) {
    var destinatario = String(n['Destinatario'] || '').trim();
    var lida         = String(n['Lida'] || 'NÃO').toUpperCase();
    return (destinatario === String(usuario).trim() || destinatario === 'TODOS') && lida !== 'SIM';
  });
  notifs.sort(function(a, b) {
    return String(b['Created_At'] || '').localeCompare(String(a['Created_At'] || ''));
  });
  return { status: 'ok', notificacoes: notifs };
}

// ── marcarNotifLida ───────────────────────────────────────────────────────
function marcarNotifLida(notif_id) {
  if (!notif_id) return { status: 'error', error: 'notif_id obrigatório' };
  ensureSheetHeaders('PIPELINE_NOTIF', HEADERS.PIPELINE_NOTIF);
  var sheet   = getOrCreateSheet('PIPELINE_NOTIF', HEADERS.PIPELINE_NOTIF);
  var data    = sheet.getDataRange().getValues();
  var headers = data[0];
  var idxID   = headers.indexOf('Notif_ID');
  var idxLida = headers.indexOf('Lida');
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][idxID] || '').trim() === String(notif_id).trim()) {
      sheet.getRange(i + 1, idxLida + 1).setValue('SIM');
      return { status: 'ok', notif_id: notif_id };
    }
  }
  return { status: 'error', error: 'Notificação não encontrada: ' + notif_id };
}

// ── registrarAbertura ─────────────────────────────────────────────────────
// Chamada pelos formulários quando o técnico os abre pela primeira vez em uma OS.
// Garante rastro mesmo que o app feche sem ação — status fica em_andamento, não regride.
function registrarAbertura(os_id, tarefa_id, usuario) {
  if (!os_id || !tarefa_id) return { status: 'error', error: 'os_id e tarefa_id obrigatórios' };
  ensureSheetHeaders('PIPELINE_TAREFAS', HEADERS.PIPELINE_TAREFAS);
  var sheet   = getOrCreateSheet('PIPELINE_TAREFAS', HEADERS.PIPELINE_TAREFAS);
  var data    = sheet.getDataRange().getValues();
  var headers = data[0];
  var idxOS   = headers.indexOf('OS_ID');
  var idxTar  = headers.indexOf('Tarefa_ID');
  var idxStat = headers.indexOf('Status');
  var idxPrev = headers.indexOf('Status_anterior');
  var idxDatA = headers.indexOf('Data_abertura');
  var idxUpd  = headers.indexOf('Updated_At');
  var now     = new Date().toISOString();

  for (var i = 1; i < data.length; i++) {
    if (String(data[i][idxOS]  || '').trim() !== String(os_id).trim())      continue;
    if (String(data[i][idxTar] || '').trim() !== String(tarefa_id).trim())  continue;
    var statusAtual = String(data[i][idxStat] || 'pendente').trim();
    // Só avança — nunca regride de incompleto/com_pendencia/completo para em_andamento
    if (['incompleto','com_pendencia','completo'].indexOf(statusAtual) >= 0) {
      return { status: 'ok', os_id: os_id, tarefa_id: tarefa_id, status: statusAtual, changed: false };
    }
    if (idxPrev >= 0) sheet.getRange(i + 1, idxPrev + 1).setValue(statusAtual);
    sheet.getRange(i + 1, idxStat + 1).setValue('em_andamento');
    if (idxDatA >= 0 && !data[i][idxDatA]) sheet.getRange(i + 1, idxDatA + 1).setValue(now);
    if (idxUpd  >= 0) sheet.getRange(i + 1, idxUpd  + 1).setValue(now);
    return { status: 'ok', os_id: os_id, tarefa_id: tarefa_id, status: 'em_andamento', changed: true };
  }
  return { status: 'error', error: 'Tarefa não encontrada: ' + tarefa_id + ' na OS ' + os_id };
}

// ── getTiposOS ────────────────────────────────────────────────────────────
function getTiposOS() {
  ensureSheetHeaders('CAT_TIPOS_OS', HEADERS.CAT_TIPOS_OS);
  // Popular com dados iniciais se a aba estiver vazia
  var sheet = getOrCreateSheet('CAT_TIPOS_OS', HEADERS.CAT_TIPOS_OS);
  var data  = sheet.getDataRange().getValues();
  if (data.length <= 1) {
    var now = new Date().toISOString();
    var defaults = [
      ['DIAGNOSTICO',  'Diagnóstico',             'TPL_002', 'Form 08 como etapa principal. Sem desmontagem.',          'SIM', 'PRODUCAO', now, now, 'sistema'],
      ['MANUT_SIMPLES','Manutenção simples',       'TPL_001', 'Sem desmontagem. Troca de peças e lubrificação.',         'SIM', 'PRODUCAO', now, now, 'sistema'],
      ['REFORMA_GERAL','Reforma geral',            'TPL_004', 'Revisão completa com desmontagem e peritagem.',           'SIM', 'PRODUCAO', now, now, 'sistema'],
      ['DESMONT_MONT', 'Desmontagem e montagem',  'TPL_003', 'Com peritagem completa e ficha de rotores.',              'SIM', 'PRODUCAO', now, now, 'sistema']
    ];
    for (var d = 0; d < defaults.length; d++) sheet.appendRow(defaults[d]);
    data = sheet.getDataRange().getValues();
  }
  var tipos = getSheetDataActive('CAT_TIPOS_OS')
    .filter(function(t) { return String(t['Ativo'] || 'SIM').toUpperCase() !== 'NÃO'; });
  return { status: 'ok', tipos: tipos };
}

// ── saveTipoOS ────────────────────────────────────────────────────────────
function saveTipoOS(body) {
  ensureSheetHeaders('CAT_TIPOS_OS', HEADERS.CAT_TIPOS_OS);
  if (!body.tipo_id) return { status: 'error', error: 'tipo_id é obrigatório' };
  var sheet   = getOrCreateSheet('CAT_TIPOS_OS', HEADERS.CAT_TIPOS_OS);
  var data    = sheet.getDataRange().getValues();
  var headers = data[0];
  var now     = new Date().toISOString();
  var idxID   = headers.indexOf('Tipo_ID');
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][idxID] || '').trim() === String(body.tipo_id).trim()) {
      // Atualizar
      var idxNome = headers.indexOf('Nome');
      var idxTpl  = headers.indexOf('Template_ID_Padrao');
      var idxDesc = headers.indexOf('Descricao');
      var idxAtv  = headers.indexOf('Ativo');
      var idxUpd  = headers.indexOf('Updated_At');
      if (idxNome >= 0 && body.nome !== undefined) sheet.getRange(i + 1, idxNome + 1).setValue(body.nome);
      if (idxTpl  >= 0 && body.template_id_padrao) sheet.getRange(i + 1, idxTpl  + 1).setValue(body.template_id_padrao);
      if (idxDesc >= 0 && body.descricao !== undefined) sheet.getRange(i + 1, idxDesc + 1).setValue(body.descricao);
      if (idxAtv  >= 0 && body.ativo     !== undefined) sheet.getRange(i + 1, idxAtv  + 1).setValue(body.ativo ? 'SIM' : 'NÃO');
      if (idxUpd  >= 0) sheet.getRange(i + 1, idxUpd  + 1).setValue(now);
      return { status: 'ok', tipo_id: body.tipo_id, action: 'updated' };
    }
  }
  // Inserir — nome obrigatório apenas aqui
  if (!body.nome) return { status: 'error', error: 'nome é obrigatório para criar novo tipo' };
  sheet.appendRow([
    String(body.tipo_id).trim(),
    String(body.nome).trim(),
    String(body.template_id_padrao || '').trim(),
    String(body.descricao || '').trim(),
    body.ativo === false ? 'NÃO' : 'SIM',
    'PRODUCAO', now, now,
    String(body.usuario || '').trim()
  ]);
  return { status: 'ok', tipo_id: body.tipo_id, action: 'inserted' };
}

// ── deleteTipoOS ──────────────────────────────────────────────────────────
// Remove tipo somente se não houver OS abertas com aquele tipo.
function deleteTipoOS(tipo_id) {
  if (!tipo_id) return { status: 'error', error: 'tipo_id obrigatório' };
  // Verificar se há OS abertas com este tipo
  try {
    var osSheet  = getOrCreateSheet('ORDENS_SERVICO', HEADERS.ORDENS_SERVICO);
    var osData   = osSheet.getDataRange().getValues();
    var osHdrs   = osData[0];
    var idxOSTipo = osHdrs.indexOf('tipo_os');
    var idxStatus = osHdrs.indexOf('status');
    for (var o = 1; o < osData.length; o++) {
      if (String(osData[o][idxOSTipo] || '').trim() === String(tipo_id).trim() &&
          String(osData[o][idxStatus] || '').toUpperCase() === 'ABERTA') {
        return { status: 'error', error: 'Existem OS abertas com este tipo. Inative em vez de excluir.' };
      }
    }
  } catch(e) {}

  ensureSheetHeaders('CAT_TIPOS_OS', HEADERS.CAT_TIPOS_OS);
  var sheet   = getOrCreateSheet('CAT_TIPOS_OS', HEADERS.CAT_TIPOS_OS);
  var data    = sheet.getDataRange().getValues();
  var headers = data[0];
  var idxID   = headers.indexOf('Tipo_ID');
  var idxAtv  = headers.indexOf('Ativo');
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][idxID] || '').trim() === String(tipo_id).trim()) {
      // Soft delete — marca como inativo em vez de excluir fisicamente
      if (idxAtv >= 0) sheet.getRange(i + 1, idxAtv + 1).setValue('NÃO');
      return { status: 'ok', tipo_id: tipo_id, action: 'inativado' };
    }
  }
  return { status: 'error', error: 'Tipo não encontrado: ' + tipo_id };
}

// ── _verificarDesbloqueios_ ───────────────────────────────────────────────
// Função interna: verifica se a conclusão de uma tarefa desbloqueia dependentes.
// Gera notificações para tarefas que ficam prontas para iniciar.
function _verificarDesbloqueios_(os_id, tarefa_id_concluida, usuario) {
  try {
    ensureSheetHeaders('PIPELINE_TAREFAS', HEADERS.PIPELINE_TAREFAS);
    var sheet   = getOrCreateSheet('PIPELINE_TAREFAS', HEADERS.PIPELINE_TAREFAS);
    var data    = sheet.getDataRange().getValues();
    var headers = data[0];
    var idxOS   = headers.indexOf('OS_ID');
    var idxTar  = headers.indexOf('Tarefa_ID');
    var idxDep  = headers.indexOf('Depende_de');
    var idxStat = headers.indexOf('Status');
    var idxUpd  = headers.indexOf('Updated_At');
    var idxPrev = headers.indexOf('Status_anterior');
    var now     = new Date().toISOString();

    // Coletar status de todas as tarefas desta OS
    var statusMap = {};
    for (var i = 1; i < data.length; i++) {
      if (String(data[i][idxOS] || '').trim() !== String(os_id).trim()) continue;
      statusMap[String(data[i][idxTar] || '')] = String(data[i][idxStat] || '');
    }

    // Verificar quais tarefas bloqueadas têm todas as dependências completas agora
    var desbloqueadas = [];
    for (var j = 1; j < data.length; j++) {
      if (String(data[j][idxOS] || '').trim() !== String(os_id).trim()) continue;
      if (String(data[j][idxStat] || '').trim() !== 'bloqueado') continue;
      var depRaw = String(data[j][idxDep] || '[]');
      var deps;
      try { deps = JSON.parse(depRaw); } catch(e) { deps = []; }
      if (!deps || deps.length === 0) continue;
      var todasCompletas = deps.every(function(depId) {
        return statusMap[depId] === 'completo';
      });
      if (todasCompletas) {
        if (idxPrev >= 0) sheet.getRange(j + 1, idxPrev + 1).setValue('bloqueado');
        sheet.getRange(j + 1, idxStat + 1).setValue('pendente');
        if (idxUpd >= 0) sheet.getRange(j + 1, idxUpd + 1).setValue(now);
        desbloqueadas.push(String(data[j][idxTar] || ''));
      }
    }

    // Gerar notificações para tarefas desbloqueadas
    if (desbloqueadas.length > 0) {
      _gerarNotificacao_(os_id, tarefa_id_concluida, 'desbloqueio',
        'TODOS',
        'OS ' + os_id + ' — ' + desbloqueadas.length + ' tarefa(s) desbloqueada(s) após conclusão de ' + tarefa_id_concluida + ': ' + desbloqueadas.join(', ')
      );
    }
  } catch(e) {
    // Silencioso — não deve interromper o fluxo principal
  }
}

// ── _gerarNotificacao_ ────────────────────────────────────────────────────
function _gerarNotificacao_(os_id, tarefa_id, tipo, destinatario, mensagem) {
  try {
    ensureSheetHeaders('PIPELINE_NOTIF', HEADERS.PIPELINE_NOTIF);
    var sheet  = getOrCreateSheet('PIPELINE_NOTIF', HEADERS.PIPELINE_NOTIF);
    var now    = new Date().toISOString();
    var nId    = 'NOTIF-' + now.replace(/[^0-9]/g,'').slice(0,14) + '-' + Math.floor(Math.random()*1000);
    sheet.appendRow([nId, os_id, tarefa_id, tipo, destinatario, mensagem, 'NÃO', 'PRODUCAO', now]);
  } catch(e) {}
}
// ═══════════════════════════════════════════════════════════════════════════
// FIM v29 — PROPERFLOW
// ═══════════════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════════════
// v35 PARTE B — MIGRAÇÃO DE DADOS (rodar 1x manualmente no editor GAS)
// ═══════════════════════════════════════════════════════════════════════════

// Deriva prefixo de ID de 3 letras a partir do nome_perfil cadastrado em CAT_PERFIS.
// Ex: "Técnico Oficina" → "TEC", "Vendedor" → "VEN", "Estoquista" → "EST".
// Fallback: "USR" quando perfil não encontrado ou nome_perfil vazio.
function derivarPrefixoUsuario_(idPerfil) {
  try {
    var perfSheet = getOrCreateSheet('CAT_PERFIS', HEADERS.CAT_PERFIS);
    var data = perfSheet.getDataRange().getValues();
    var headers = data[0] || HEADERS.CAT_PERFIS;
    var idx = {}; headers.forEach(function(h,i){ idx[h]=i; });
    for (var i = 1; i < data.length; i++) {
      if (String(data[i][idx.id_perfil]) === String(idPerfil)) {
        var nome = String(data[i][idx.nome_perfil] || '').trim();
        var primeiraPalavra = nome.split(/\s+/)[0] || '';
        var normalizado = primeiraPalavra
          .normalize('NFD').replace(/[̀-ͯ]/g, '')
          .toUpperCase().replace(/[^A-Z]/g, '');
        if (normalizado.length >= 3) return normalizado.slice(0, 3);
      }
    }
  } catch (e) { /* cai no fallback abaixo */ }
  return 'USR';
}

// Migração de dados: renomeia aba, colunas e IDs de TEC-* para prefixo por perfil.
// PRÉ-REQUISITO: fazer backup da planilha (Arquivo → Fazer uma cópia) antes de rodar.
// ORDEM CORRETA: (1) publicar código v35 → (2) rodar esta função UMA VEZ pelo editor.
function migrarTecnicosParaUsuarios() {
  var log = [];

  // 1) Renomeia a aba CAT_TECNICOS → CAT_USUARIOS (se ainda não foi feito)
  var abaAntiga = SS.getSheetByName('CAT_TECNICOS');
  var abaNova   = SS.getSheetByName('CAT_USUARIOS');
  if (abaAntiga && !abaNova) {
    abaAntiga.setName('CAT_USUARIOS');
    log.push('Aba CAT_TECNICOS renomeada para CAT_USUARIOS.');
  } else if (!abaAntiga && abaNova) {
    log.push('Aba já estava renomeada — pulando passo 1.');
  } else if (!abaAntiga && !abaNova) {
    return { status: 'error', error: 'Nenhuma aba CAT_TECNICOS ou CAT_USUARIOS encontrada.' };
  }

  // 1.5) Renomeia cabeçalhos de coluna nas abas que referenciam o ID como FK.
  //      Roda ANTES do passo 3 (substituirEmColuna_) — se rodar depois,
  //      headers.indexOf('id_usuario') retorna -1 e a propagação falha em silêncio.
  function renomearColuna_(sheetName, headerAntigo, headerNovo) {
    var sheet = SS.getSheetByName(sheetName);
    if (!sheet) { log.push('Aba ' + sheetName + ' não encontrada — pulando rename de coluna.'); return; }
    var lastCol = sheet.getLastColumn();
    if (lastCol === 0) return;
    var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
    var idx = headers.indexOf(headerAntigo);
    if (idx >= 0) {
      sheet.getRange(1, idx + 1).setValue(headerNovo);
      log.push(sheetName + '.' + headerAntigo + ' → ' + headerNovo);
    } else if (headers.indexOf(headerNovo) < 0) {
      log.push('AVISO: ' + sheetName + ' não tem nem "' + headerAntigo + '" nem "' + headerNovo + '" — confira manualmente.');
    }
  }
  renomearColuna_('LOG_OPERACIONAL', 'id_tecnico', 'id_usuario');
  renomearColuna_('LOG_OPERACIONAL', 'nome_tecnico', 'nome_usuario');
  renomearColuna_('ORDENS_SERVICO', 'tecnicos_vinculados', 'usuarios_vinculados');
  renomearColuna_('ORDENS_SERVICO', 'tecnico_atual', 'usuario_atual');
  renomearColuna_('ORDENS_SERVICO', 'assinatura_tecnico_url', 'assinatura_usuario_url');
  renomearColuna_('FORMULARIOS', 'Tecnico_ID', 'Usuario_ID');
  renomearColuna_('FORMULARIOS', 'Tecnico_Nome', 'Usuario_Nome');
  renomearColuna_('OS_DRAFTS', 'id_tecnico', 'id_usuario');
  renomearColuna_('OS_DRAFTS', 'nome_tecnico', 'nome_usuario');

  ensureSheetHeaders('CAT_USUARIOS', HEADERS.CAT_USUARIOS);
  var usuSheet = getOrCreateSheet('CAT_USUARIOS', HEADERS.CAT_USUARIOS);
  var usuData  = usuSheet.getDataRange().getValues();
  var usuHeaders = usuData[0];
  var idxId = usuHeaders.indexOf('id');
  var idxPerfil = usuHeaders.indexOf('perfil');

  // 2) Monta mapa oldId → newId (só remapeia quem ainda está no padrão "TEC-")
  var mapaIds = {};
  for (var i = 1; i < usuData.length; i++) {
    var idAtual = String(usuData[i][idxId] || '');
    if (!idAtual) continue;
    var jaTemPrefixoNovo = /^[A-Z]{3}-/.test(idAtual) && idAtual.split('-')[0] !== 'TEC';
    if (jaTemPrefixoNovo) continue; // já migrado — idempotente
    var perfil = usuData[i][idxPerfil];
    var prefixo = derivarPrefixoUsuario_(perfil);
    var sufixo = idAtual.indexOf('-') >= 0 ? idAtual.split('-').slice(1).join('-') : idAtual;
    var novoId = prefixo + '-' + sufixo;
    if (novoId !== idAtual) {
      mapaIds[idAtual] = novoId;
      usuSheet.getRange(i + 1, idxId + 1).setValue(novoId);
    }
  }
  log.push('IDs remapeados: ' + JSON.stringify(mapaIds));

  if (Object.keys(mapaIds).length === 0) {
    log.push('Nenhum ID precisava de remapeamento — migração já estava em dia.');
    Logger.log(log.join('\n'));
    return { status: 'ok', mapaIds: mapaIds, log: log };
  }

  // 3) Propaga o remapeamento para todas as abas que referenciam o ID como FK
  function substituirEmColuna_(sheetName, headersArr, colName, isJsonArray) {
    var sheet = getOrCreateSheet(sheetName, headersArr);
    var data = sheet.getDataRange().getValues();
    if (data.length < 2) return 0;
    var headers = data[0];
    var idx = headers.indexOf(colName);
    if (idx < 0) return 0;
    var alterados = 0;
    for (var r = 1; r < data.length; r++) {
      var valor = data[r][idx];
      if (valor === '' || valor === null || valor === undefined) continue;
      if (isJsonArray) {
        var arr;
        try { arr = JSON.parse(valor); } catch(e) { continue; }
        if (!Array.isArray(arr)) continue;
        var trocou = false;
        var novoArr = arr.map(function(v) {
          var vs = String(v);
          if (mapaIds[vs]) { trocou = true; return mapaIds[vs]; }
          return v;
        });
        if (trocou) {
          sheet.getRange(r + 1, idx + 1).setValue(JSON.stringify(novoArr));
          alterados++;
        }
      } else {
        var vs = String(valor);
        if (mapaIds[vs]) {
          sheet.getRange(r + 1, idx + 1).setValue(mapaIds[vs]);
          alterados++;
        }
      }
    }
    return alterados;
  }

  var resumo = {};
  resumo.LOG_OPERACIONAL_id   = substituirEmColuna_('LOG_OPERACIONAL', HEADERS.LOG_OPERACIONAL, 'id_usuario', false);
  resumo.ORDENS_SERVICO_vinc  = substituirEmColuna_('ORDENS_SERVICO', HEADERS.ORDENS_SERVICO, 'usuarios_vinculados', true);
  resumo.ORDENS_SERVICO_atual = substituirEmColuna_('ORDENS_SERVICO', HEADERS.ORDENS_SERVICO, 'usuario_atual', false);
  resumo.FORMULARIOS_id       = substituirEmColuna_('FORMULARIOS', HEADERS.FORMULARIOS, 'Usuario_ID', false);
  resumo.PIPELINE_NOTIF_dest  = substituirEmColuna_('PIPELINE_NOTIF', HEADERS.PIPELINE_NOTIF, 'Destinatario', false);
  resumo.PIPELINE_TAREFAS_cp  = substituirEmColuna_('PIPELINE_TAREFAS', HEADERS.PIPELINE_TAREFAS, 'Concluido_por', false);
  resumo.OS_DRAFTS_id         = substituirEmColuna_('OS_DRAFTS', HEADERS.OS_DRAFTS, 'id_usuario', false);

  log.push('Linhas alteradas por aba: ' + JSON.stringify(resumo));
  Logger.log(log.join('\n'));
  return { status: 'ok', mapaIds: mapaIds, resumo: resumo, log: log };
}
// ═══════════════════════════════════════════════════════════════════════════
// FIM v35 PARTE B
// ═══════════════════════════════════════════════════════════════════════════
