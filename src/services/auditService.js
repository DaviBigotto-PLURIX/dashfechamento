/* =====================================================================
   PLURIX PROCUREMENT - AUDIT SERVICE (AUDITORIA DE DADOS)
   Validação de paridade e consistência entre API Oficial e Planilhas Manuais
   ===================================================================== */

const XLSX = require('xlsx');
const { getDatabase } = require('../database/db');

class AuditService {
  /**
   * Informações da Fonte Oficial da API (Sem escrita)
   */
  getApiInfo() {
    const db = getDatabase();
    const countRow = db.prepare('SELECT COUNT(*) as total FROM solicitacao_organizer').get();
    
    // Obter data do registro mais recente
    const latestRow = db.prepare('SELECT data_criacao, data_finalizacao FROM solicitacao_organizer ORDER BY data_criacao DESC LIMIT 1').get();

    return {
      fonte: 'API Organizer (OFICIAL)',
      status: 'Conectada',
      endpoint: process.env.ORGANIZER_API_URL ? 'https://csd.organizer.com.br/api/bi' : 'API Organizer Live',
      totalRegistrosApi: countRow?.total || 0,
      ultimaConsulta: new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }),
      dataRegistroMaisRecente: latestRow?.data_criacao || 'N/A'
    };
  }

  /**
   * Normalização de chaves de cabeçalho da planilha Organizer
   */
  normalizeKey(key) {
    if (!key) return '';
    return key
      .toString()
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]/g, '_');
  }

  /**
   * Normalização de valor de texto
   */
  normalizeString(val) {
    if (val === null || val === undefined) return '';
    return val.toString().trim().toLowerCase();
  }

  /**
   * Executa a auditoria em memória (SEM GRAVAR NO BANCO)
   */
  compareSpreadsheet(buffer, filename) {
    const db = getDatabase();

    // 1. Leitura do arquivo (XLS, XLSX, CSV)
    let workbook;
    try {
      workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
    } catch (err) {
      throw new Error(`Erro ao ler arquivo da planilha: ${err.message}`);
    }

    const firstSheetName = workbook.SheetNames[0];
    if (!firstSheetName) throw new Error('Nenhuma aba encontrada na planilha');
    const sheet = workbook.Sheets[firstSheetName];
    const rawRows = XLSX.utils.sheet_to_json(sheet, { defval: null });

    if (!rawRows || rawRows.length === 0) {
      throw new Error('A planilha enviada não contém registros.');
    }

    // 2. Normalizar linhas da planilha
    const planilhaMap = new Map();
    rawRows.forEach((row, index) => {
      const normalizedRow = {};
      Object.keys(row).forEach(k => {
        const normKey = this.normalizeKey(k);
        normalizedRow[normKey] = row[k];
      });

      // Extrair identificador único (id, numero, solicitacao, cod, etc.)
      const rawId = normalizedRow.id || 
                    normalizedRow.numero || 
                    normalizedRow.solicitacao || 
                    normalizedRow.numero_solicitacao || 
                    normalizedRow.codigo || 
                    normalizedRow.num_solicitacao || 
                    normalizedRow.numero_solic ||
                    (index + 1);

      const id = String(rawId).replace(/[^0-9]/g, '') || String(rawId).trim();
      if (id) {
        planilhaMap.set(id, normalizedRow);
      }
    });

    // 3. Buscar todos os registros oficiais da API no SQLite
    const apiRows = db.prepare(`
      SELECT 
        id,
        numero_solicitacao,
        status_nome,
        investida_nome,
        comprador,
        categoria,
        tipo_compra,
        dias_atendimento_sla,
        dentro_sla,
        data_criacao,
        data_finalizacao,
        valor_menor_cotado,
        valor_final_negociado,
        saving_operacional
      FROM solicitacao_organizer
    `).all();

    const apiMap = new Map();
    apiRows.forEach(r => {
      const idKey = String(r.id || r.numero_solicitacao).replace(/[^0-9]/g, '') || String(r.id);
      apiMap.set(idKey, r);
    });

    // 4. Executar Análises Obrigatórias
    const totalPlanilha = planilhaMap.size;
    const totalApi = apiMap.size;
    const diferencaTotal = totalPlanilha - totalApi;

    const idsAmbas = [];
    const idsApenasPlanilha = [];
    const idsApenasApi = [];

    planilhaMap.forEach((pRow, id) => {
      if (apiMap.has(id)) {
        idsAmbas.push(id);
      } else {
        idsApenasPlanilha.push(id);
      }
    });

    apiMap.forEach((aRow, id) => {
      if (!planilhaMap.has(id)) {
        idsApenasApi.push(id);
      }
    });

    // 5. Comparação Campo a Campo para IDs em Comum
    const divergenciasDetalhe = [];
    let contadoresDivergencia = {
      status: 0,
      comprador: 0,
      sla: 0,
      investida: 0,
      valores: 0
    };

    let registrosComDivergencia = new Set();

    idsAmbas.forEach(id => {
      const a = apiMap.get(id);
      const p = planilhaMap.get(id);

      let temDivergenciaNoId = false;

      // 5.1 Status
      const statusPlanilha = p.status || p.situacao || p.status_nome || p.etapa || p.fase || '';
      if (statusPlanilha && this.normalizeString(a.status_nome) !== this.normalizeString(statusPlanilha)) {
        // Tolerâncias para variações semânticas conhecidas (ex: Encerrado vs Concluído)
        const aNorm = this.normalizeString(a.status_nome);
        const pNorm = this.normalizeString(statusPlanilha);
        const isEquivalent = (aNorm.includes('encerrad') && pNorm.includes('concl')) ||
                             (aNorm.includes('cotac') && pNorm.includes('cotac')) ||
                             (aNorm.includes('aprov') && pNorm.includes('aprov')) ||
                             (aNorm.includes('pedido') && pNorm.includes('pedido'));

        if (!isEquivalent) {
          contadoresDivergencia.status++;
          temDivergenciaNoId = true;
          divergenciasDetalhe.push({
            id: a.numero_solicitacao || `#ORG-${id}`,
            categoria_divergencia: 'Status da Compra',
            campo: 'Status / Etapa',
            valorApi: a.status_nome || 'N/A',
            valorPlanilha: String(statusPlanilha),
            severidade: 'DIVERGENCIA',
            comprador: a.comprador || 'N/A',
            investida: a.investida_nome || 'N/A'
          });
        }
      }

      // 5.2 Comprador Responsável
      const compradorPlanilha = p.comprador || p.comprador_nome || p.responsavel || p.negociador || p.usuario_comprador || '';
      if (compradorPlanilha && this.normalizeString(a.comprador) !== this.normalizeString(compradorPlanilha)) {
        const aComp = this.normalizeString(a.comprador);
        const pComp = this.normalizeString(compradorPlanilha);
        if (!aComp.includes(pComp) && !pComp.includes(aComp)) {
          contadoresDivergencia.comprador++;
          temDivergenciaNoId = true;
          divergenciasDetalhe.push({
            id: a.numero_solicitacao || `#ORG-${id}`,
            categoria_divergencia: 'Comprador Responsável',
            campo: 'Comprador',
            valorApi: a.comprador || 'Não informado',
            valorPlanilha: String(compradorPlanilha),
            severidade: 'DIVERGENCIA',
            comprador: a.comprador || 'N/A',
            investida: a.investida_nome || 'N/A'
          });
        }
      }

      // 5.3 SLA / Dias de Atendimento
      const diasPlanilha = p.dias_atendimento || p.sla_dias || p.lead_time || p.dias || p.sla;
      if (diasPlanilha !== null && diasPlanilha !== undefined && a.dias_atendimento_sla !== null) {
        const numP = parseFloat(String(diasPlanilha).replace(',', '.'));
        const numA = parseFloat(a.dias_atendimento_sla);
        if (!isNaN(numP) && !isNaN(numA) && Math.abs(numP - numA) > 1.0) {
          contadoresDivergencia.sla++;
          temDivergenciaNoId = true;
          divergenciasDetalhe.push({
            id: a.numero_solicitacao || `#ORG-${id}`,
            categoria_divergencia: 'Auditoria de SLA',
            campo: 'Dias de Atendimento (SLA)',
            valorApi: `${numA} dias`,
            valorPlanilha: `${numP} dias`,
            severidade: 'ATENCAO',
            comprador: a.comprador || 'N/A',
            investida: a.investida_nome || 'N/A'
          });
        }
      }

      // 5.4 Investida / Loja
      const investidaPlanilha = p.investida || p.loja || p.filial || p.empresa || p.unidade;
      if (investidaPlanilha && a.investida_nome) {
        const aInv = this.normalizeString(a.investida_nome);
        const pInv = this.normalizeString(investidaPlanilha);
        if (!aInv.includes(pInv) && !pInv.includes(aInv)) {
          contadoresDivergencia.investida++;
          temDivergenciaNoId = true;
          divergenciasDetalhe.push({
            id: a.numero_solicitacao || `#ORG-${id}`,
            categoria_divergencia: 'Investida / Loja',
            campo: 'Rede Investida',
            valorApi: a.investida_nome,
            valorPlanilha: String(investidaPlanilha),
            severidade: 'DIVERGENCIA',
            comprador: a.comprador || 'N/A',
            investida: a.investida_nome
          });
        }
      }

      if (temDivergenciaNoId) {
        registrosComDivergencia.add(id);
      }
    });

    idsApenasPlanilha.slice(0, 200).forEach(id => {
      const p = planilhaMap.get(id);
      divergenciasDetalhe.push({
        id: `#ORG-${id}`,
        categoria_divergencia: 'Paridade por ID',
        campo: 'Presença no Sistema',
        valorApi: 'Ausente na API Oficial',
        valorPlanilha: 'Presente na Planilha',
        severidade: 'DIVERGENCIA',
        comprador: p.comprador || 'N/A',
        investida: p.investida || 'N/A'
      });
    });

    const totalAuditados = totalPlanilha;
    const totalDivergentes = registrosComDivergencia.size + idsApenasPlanilha.length;
    const totalCompatíveis = Math.max(0, totalAuditados - totalDivergentes);
    const confiabilidadePct = totalAuditados > 0 
      ? parseFloat(((totalCompatíveis / totalAuditados) * 100).toFixed(2)) 
      : 100;

    return {
      arquivo: {
        nome: filename,
        totalRegistros: totalPlanilha,
        dataUpload: new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })
      },
      fonteOficial: this.getApiInfo(),
      resumoExecutivo: {
        totalAuditados,
        totalCompatíveis,
        totalDivergentes,
        confiabilidadePct,
        statusConfiabilidade: confiabilidadePct >= 98 ? 'Excelente' : (confiabilidadePct >= 90 ? 'Boa' : 'Atenção Requerida')
      },
      analises: {
        paridadeRegistros: {
          totalPlanilha,
          totalApi,
          diferenca: diferencaTotal,
          status: diferencaTotal === 0 ? 'Paridade Exata' : (Math.abs(diferencaTotal) <= 10 ? 'Variação Marginal' : 'Divergência Notável')
        },
        paridadeId: {
          emAmbas: idsAmbas.length,
          apenasPlanilha: idsApenasPlanilha.length,
          apenasApi: idsApenasApi.length
        },
        contadoresDivergencia: {
          status: contadoresDivergencia.status,
          comprador: contadoresDivergencia.comprador,
          sla: contadoresDivergencia.sla,
          investida: contadoresDivergencia.investida,
          totalDivergenciasCampos: divergenciasDetalhe.length
        }
      },
      tabelaDivergencias: divergenciasDetalhe
    };
  }

  /**
   * Gera relatório Excel formatado com todas as divergências
   */
  generateExcelReport(auditResult) {
    const wb = XLSX.utils.book_new();

    // Aba 1: Resumo Executivo
    const resumoData = [
      ['PLURIX PROCUREMENT - RELATÓRIO DE AUDITORIA DE DADOS'],
      ['Data da Auditoria:', new Date().toLocaleString('pt-BR')],
      ['Arquivo Comparado:', auditResult.arquivo?.nome || 'Planilha Manual'],
      [''],
      ['MÉTRICA', 'VALOR'],
      ['Registros na Planilha', auditResult.analises?.paridadeRegistros?.totalPlanilha || 0],
      ['Registros na API Oficial', auditResult.analises?.paridadeRegistros?.totalApi || 0],
      ['Diferença de Registros', auditResult.analises?.paridadeRegistros?.diferenca || 0],
      ['Registros em Ambas as Fontes', auditResult.analises?.paridadeId?.emAmbas || 0],
      ['Presentes Apenas na Planilha', auditResult.analises?.paridadeId?.apenasPlanilha || 0],
      ['Presentes Apenas na API', auditResult.analises?.paridadeId?.apenasApi || 0],
      [''],
      ['Registros Auditados', auditResult.resumoExecutivo?.totalAuditados || 0],
      ['Registros 100% Compatíveis', auditResult.resumoExecutivo?.totalCompatíveis || 0],
      ['Registros Divergentes', auditResult.resumoExecutivo?.totalDivergentes || 0],
      ['ÍNDICE DE CONFIABILIDADE', `${auditResult.resumoExecutivo?.confiabilidadePct || 0}%`]
    ];

    const wsResumo = XLSX.utils.aoa_to_sheet(resumoData);
    XLSX.utils.book_append_sheet(wb, wsResumo, 'Resumo Executivo');

    // Aba 2: Tabela de Divergências
    const divergenciasData = (auditResult.tabelaDivergencias || []).map(d => ({
      'ID / Solicitação': d.id,
      'Categoria da Divergência': d.categoria_divergencia,
      'Campo Auditado': d.campo,
      'Valor na API Oficial': d.valorApi,
      'Valor na Planilha': d.valorPlanilha,
      'Severidade': d.severidade,
      'Comprador': d.comprador,
      'Investida': d.investida
    }));

    const wsDivergencias = XLSX.utils.json_to_sheet(divergenciasData);
    XLSX.utils.book_append_sheet(wb, wsDivergencias, 'Divergências Identificadas');

    return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  }
}

module.exports = new AuditService();
