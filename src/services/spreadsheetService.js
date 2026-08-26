/* =====================================================================
   PLURIX PROCUREMENT - SERVIÇO DE INGESTÃO DE PLANILHAS
   Parser inteligente de Fechamento Mensal (.xlsx), Estocáveis e CSV
   ===================================================================== */

const XLSX = require('xlsx');
const { getDatabase } = require('../database/db');

class SpreadsheetService {

  /**
   * Converte número em formato financeiro brasileiro ou float
   */
  parseNum(val) {
    if (val === null || val === undefined || val === '' || val === '--') return 0;
    if (typeof val === 'number') return val;
    const s = String(val).replace('R$', '').replace(/\./g, '').replace(',', '.').trim();
    const n = parseFloat(s);
    return isNaN(n) ? 0 : n;
  }

  /**
   * Converte número de data serial do Excel (ex: 46023) ou string (dd/mm/aaaa) para data ISO (YYYY-MM-DD)
   */
  parseExcelDate(val) {
    if (!val || val === '--') return null;
    if (typeof val === 'number') {
      // Excel serial date (dias desde 1899-12-30)
      const d = new Date(Math.round((val - 25569) * 86400 * 1000));
      if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
    }
    const s = String(val).trim();
    const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (m) {
      const day = m[1].padStart(2, '0');
      const month = m[2].padStart(2, '0');
      const year = m[3];
      return `${year}-${month}-${day}`;
    }
    return null;
  }

  /**
   * Extrai o mês (1-12) a partir de uma data ou texto
   */
  extractMonth(dateVal, textVal) {
    if (typeof dateVal === 'number') {
      const d = new Date(Math.round((dateVal - 25569) * 86400 * 1000));
      if (!isNaN(d.getTime())) return d.getUTCMonth() + 1;
    }
    if (textVal) {
      const lower = String(textVal).toLowerCase();
      if (lower.includes('jan')) return 1;
      if (lower.includes('fev')) return 2;
      if (lower.includes('mar')) return 3;
      if (lower.includes('abr')) return 4;
      if (lower.includes('mai')) return 5;
      if (lower.includes('jun')) return 6;
      if (lower.includes('jul')) return 7;
      if (lower.includes('ago')) return 8;
      if (lower.includes('set')) return 9;
      if (lower.includes('out')) return 10;
      if (lower.includes('nov')) return 11;
      if (lower.includes('dez')) return 12;
    }
    return 8; // Default Agosto se não especificado
  }

  /**
   * Ingestão da Planilha de Fechamento Mensal de Procurement
   * @param {Buffer} buffer - Conteúdo binário do arquivo .xlsx
   * @param {String} fileName - Nome do arquivo original
   * @param {Number} ano - Ano de competência
   * @param {Number} mes - Mês de competência (1 a 12)
   * @param {String} usuario - Usuário que realizou o upload
   */
  async processFechamentoProcurement(buffer, fileName, ano = 2026, mes = 8, usuario = 'Analista') {
    const db = getDatabase();
    const wb = XLSX.read(buffer, { type: 'buffer' });

    // Localizar aba de fechamento
    const sheetName = wb.SheetNames.find(s => 
      s.toLowerCase().includes('fechamento mensal') || s.toLowerCase().includes('fechamento')
    ) || wb.SheetNames[0];

    const ws = wb.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });

    if (!rows || rows.length < 5) {
      throw new Error(`Aba "${sheetName}" não possui estrutura compatível com o Fechamento de Procurement.`);
    }

    // 1. Criar registro de carga
    const insertCarga = db.prepare(`
      INSERT INTO historico_carga (tipo_carga, origem_arquivo, data_inicio, executado_por, status_carga)
      VALUES (?, ?, CURRENT_TIMESTAMP, ?, ?)
    `);
    const cargaRes = insertCarga.run('PLANILHA_FECHAMENTO', fileName, usuario, 'PROCESSANDO');
    const cargaId = Number(cargaRes.lastInsertRowid);

    // 2. Localizar ou criar o Fechamento Mensal correspondente
    const monthKeys = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
    const mesChave = monthKeys[mes - 1] || 'ago';

    let fechamento = db.prepare('SELECT * FROM fechamento_mensal WHERE ano = ? AND mes = ?').get(ano, mes);
    if (!fechamento) {
      const insertF = db.prepare(`
        INSERT INTO fechamento_mensal (ano, mes, mes_chave, status, versao, preparado_por)
        VALUES (?, ?, ?, 'EM_REVISAO', 1, ?)
      `);
      const fRes = insertF.run(ano, mes, mesChave, usuario);
      fechamento = { id: Number(fRes.lastInsertRowid), ano, mes, mes_chave: mesChave, status: 'EM_REVISAO' };
    } else {
      // Se já existia, atualiza status para EM_REVISAO e atualiza preparado_por
      db.prepare(`UPDATE fechamento_mensal SET status = 'EM_REVISAO', preparado_por = ? WHERE id = ?`)
        .run(usuario, fechamento.id);
      // Limpar conciliações e negociações anteriores desta versão para recarregar
      db.prepare('DELETE FROM conciliacao WHERE fechamento_id = ?').run(fechamento.id);
      db.prepare('DELETE FROM negociacao_fechamento WHERE fechamento_id = ?').run(fechamento.id);
    }

    const fechamentoId = fechamento.id;

    // 3. Localizar linha de cabeçalho (esperado na linha index 4)
    let headerRowIdx = 4;
    for (let r = 0; r < Math.min(rows.length, 10); r++) {
      const lineStr = JSON.stringify(rows[r] || []).toUpperCase();
      if (lineStr.includes('PROJETO') || lineStr.includes('BASELINE') || lineStr.includes('VALOR FECHADO')) {
        headerRowIdx = r;
        break;
      }
    }

    const insertNegociacao = db.prepare(`
      INSERT INTO negociacao_fechamento (
        fechamento_id, carga_id, linha_planilha, codigo_projeto, codigo_organizer,
        nome_projeto, categoria, subcategoria, recorrencia, responsavel_compras,
        investida, solicitante, fornecedor, modalidade, bc_legal,
        mes_conclusao_texto, mes_conclusao_data, tipo_resultado,
        orcamento_2026, baseline_realizado, baseline_ajustado, valor_fechado_total,
        saving_baseline, saving_pct_baseline, custo_evitado, custo_evitado_pct,
        saving_reconhecido_ano, esta_no_cronograma, status_contrato, prazo_pagamento, observacoes
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
      )
    `);

    let totalLinhasLidas = 0;
    let totalValidos = 0;
    let totalRejeitados = 0;
    const avisos = [];

    db.exec('BEGIN TRANSACTION');
    try {
      for (let r = headerRowIdx + 1; r < rows.length; r++) {
        const row = rows[r];
        if (!row || row.every(c => c === undefined || c === null || String(c).trim() === '')) continue;

        totalLinhasLidas++;

        const codProjeto = row[2] ? String(row[2]).trim() : null;
        const nomeProjeto = row[3] ? String(row[3]).trim() : null;
        const codOrganizer = row[4] ? String(row[4]).trim() : null;

        // Se não tiver nome de projeto válido, é linha em branco com fórmulas padrão do Excel
        if (!nomeProjeto || nomeProjeto === 'null' || nomeProjeto === 'undefined' || nomeProjeto.toUpperCase().includes('NOME / DESCRIÇÃO')) {
          continue;
        }

        const categoria = row[5] ? String(row[5]).trim() : 'Geral';
        const subcategoria = row[6] ? String(row[6]).trim() : null;
        const recorrencia = row[7] ? String(row[7]).trim().toUpperCase() : 'SPOT';
        const responsavel = row[8] ? String(row[8]).trim() : 'Procurement';
        const investida = row[9] ? String(row[9]).trim() : 'Holding';
        const solicitante = row[10] ? String(row[10]).trim() : null;
        const fornecedor = row[11] ? String(row[11]).trim() : null;
        const modalidade = (row[12] ? String(row[12]).trim().toUpperCase() : 'OPEX').includes('CAPEX') ? 'CAPEX' : 'OPEX';
        const bcLegal = row[13] ? String(row[13]).trim() : null;
        const mesConclusaoData = this.parseExcelDate(row[14]);
        const tipoResultado = (row[15] ? String(row[15]).trim().toUpperCase() : 'SAVING');

        // Valores
        const orcamento = this.parseNum(row[16]);
        const baseline = this.parseNum(row[17]);
        const baselineAjustado = this.parseNum(row[18]);
        const valorFechado = this.parseNum(row[19]);
        const savingBaseline = this.parseNum(row[20]);
        const savingPctBaseline = this.parseNum(row[21]);
        const custoEvitado = this.parseNum(row[22]);
        const custoEvitadoPct = this.parseNum(row[23]);
        const cronograma = row[24] ? String(row[24]).trim() : 'Sim';
        const saving2026 = this.parseNum(row[25]);
        const statusContrato = row[26] ? String(row[26]).trim() : null;
        const prazoPagamento = row[27] ? String(row[27]).trim() : null;
        const observacoes = row[28] ? String(row[28]).trim() : null;

        if (!codOrganizer) {
          avisos.push({ linha: r + 1, projeto: nomeProjeto, aviso: 'Código Organizer ausente nesta negociação.' });
        }

        insertNegociacao.run(
          fechamentoId,
          cargaId,
          r + 1,
          codProjeto,
          codOrganizer,
          nomeProjeto || 'Negociação Sem Título',
          categoria,
          subcategoria,
          recorrencia,
          responsavel,
          investida,
          solicitante,
          fornecedor,
          modalidade,
          bcLegal,
          String(row[14] || ''),
          mesConclusaoData,
          tipoResultado,
          orcamento,
          baseline,
          baselineAjustado,
          valorFechado,
          savingBaseline,
          savingPctBaseline,
          custoEvitado,
          custoEvitadoPct,
          saving2026,
          cronograma,
          statusContrato,
          prazoPagamento,
          observacoes
        );
        totalValidos++;
      }
      db.exec('COMMIT');
    } catch (e) {
      db.exec('ROLLBACK');
      console.error('[SpreadsheetService] Erro ao gravar negociações:', e.message);
      throw e;
    }

    // 4. Atualizar registro de carga
    db.prepare(`
      UPDATE historico_carga
      SET data_fim = CURRENT_TIMESTAMP,
          total_registros_recebidos = ?,
          total_registros_validos = ?,
          total_registros_rejeitados = ?,
          status_carga = 'SUCESSO',
          log_erros = ?
      WHERE id = ?
    `).run(totalLinhasLidas, totalValidos, totalRejeitados, JSON.stringify(avisos.slice(0, 50)), cargaId);

    return {
      sucesso: true,
      fechamentoId,
      cargaId,
      totalLinhasLidas,
      totalValidos,
      avisosCount: avisos.length,
      avisos: avisos.slice(0, 10)
    };
  }

  /**
   * Ingestão de Planilha de Estoque Indireto / Cobertura
   */
  async processEstocaveis(buffer, fileName, usuario = 'Analista') {
    const db = getDatabase();
    const wb = XLSX.read(buffer, { type: 'buffer' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });

    let unidade = 'Avenida';
    let mesKey = 'jul';
    let mesNum = 7;
    let coberturaVals = [0, 0, 0, 0, 0, 0];

    for (let r = 0; r < Math.min(rows.length, 12); r++) {
      const row = rows[r] || [];
      for (let c = 0; c < row.length; c++) {
        const cell = String(row[c] || '').trim();
        if (cell.includes('Unidade') && row[c + 1]) unidade = String(row[c + 1]).trim();
        if (cell.includes('Referência') && row[c + 1]) {
          const refStr = String(row[c + 1]);
          if (refStr.includes('/05/') || refStr.includes('-05-')) { mesKey = 'mai'; mesNum = 5; }
          if (refStr.includes('/06/') || refStr.includes('-06-')) { mesKey = 'jun'; mesNum = 6; }
          if (refStr.includes('/07/') || refStr.includes('-07-')) { mesKey = 'jul'; mesNum = 7; }
          if (refStr.includes('/08/') || refStr.includes('-08-')) { mesKey = 'ago'; mesNum = 8; }
        }
      }
    }

    for (let r = 0; r < rows.length; r++) {
      const row = rows[r] || [];
      const colB = String(row[1] || '').trim();
      const valE = parseFloat(row[4]) || 0;
      if (colB === '0-30') coberturaVals[0] = Math.round(valE * 10) / 10;
      if (colB === '31-60') coberturaVals[1] = Math.round(valE * 10) / 10;
      if (colB === '61-90') coberturaVals[2] = Math.round(valE * 10) / 10;
      if (colB === '91-120') coberturaVals[3] = Math.round(valE * 10) / 10;
      if (colB === '121-180') coberturaVals[4] = Math.round(valE * 10) / 10;
      if (colB === 'MAIOR 180') coberturaVals[5] = Math.round(valE * 10) / 10;
    }

    const totalEstoque = coberturaVals.reduce((a, b) => a + b, 0);
    const colors = { 'Amigão': '#38B6FF', 'Avenida': '#F59E0B', 'Boa': '#8B5CF6', 'Paraná': '#EF4444' };

    const upsertEstoque = db.prepare(`
      INSERT INTO estoque_indireto (
        ano, mes, mes_chave, unidade, cor_grafico,
        faixa_0_30, faixa_31_60, faixa_61_90, faixa_91_120,
        faixa_121_180, faixa_maior_180, total_estoque
      ) VALUES (
        2026, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
      )
      ON CONFLICT(ano, mes, unidade) DO UPDATE SET
        faixa_0_30 = excluded.faixa_0_30,
        faixa_31_60 = excluded.faixa_31_60,
        faixa_61_90 = excluded.faixa_61_90,
        faixa_91_120 = excluded.faixa_91_120,
        faixa_121_180 = excluded.faixa_121_180,
        faixa_maior_180 = excluded.faixa_maior_180,
        total_estoque = excluded.total_estoque,
        data_registro = CURRENT_TIMESTAMP
    `);

    upsertEstoque.run(
      mesNum,
      mesKey,
      unidade,
      colors[unidade] || '#38B6FF',
      coberturaVals[0],
      coberturaVals[1],
      coberturaVals[2],
      coberturaVals[3],
      coberturaVals[4],
      coberturaVals[5],
      totalEstoque
    );

    return {
      sucesso: true,
      unidade,
      mesKey,
      mesNum,
      coberturaVals,
      totalEstoque
    };
  }

  /**
   * Ingestão de Planilha/CSV exportado do Organizer (Relatório Geral / Cotações)
   */
  async processOrganizerSpreadsheet(buffer, fileName, usuario = 'Analista') {
    const db = getDatabase();
    const wb = XLSX.read(buffer, { type: 'buffer', raw: true });
    const sheetName = wb.SheetNames[0];
    const ws = wb.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(ws, { defval: null });

    const insertCarga = db.prepare(`
      INSERT INTO historico_carga (tipo_carga, origem_arquivo, data_inicio, executado_por, status_carga)
      VALUES ('API_ORGANIZER', ?, CURRENT_TIMESTAMP, ?, 'PROCESSANDO')
    `);
    const cargaRes = insertCarga.run(fileName, usuario);
    const cargaId = Number(cargaRes.lastInsertRowid);

    db.prepare('DELETE FROM conciliacao').run();
    db.prepare('DELETE FROM solicitacao_organizer').run();

    const organizerService = require('./organizerService');
    const res = organizerService.persistPageRecords(rows, cargaId);

    db.prepare(`
      UPDATE historico_carga
      SET data_fim = CURRENT_TIMESTAMP,
          total_registros_recebidos = ?,
          total_registros_validos = ?,
          total_registros_rejeitados = ?,
          status_carga = 'SUCESSO'
      WHERE id = ?
    `).run(res.recebidos, res.validos, res.rejeitados, cargaId);

    return {
      sucesso: true,
      cargaId,
      totalRecebidos: res.recebidos,
      totalValidos: res.validos,
      totalRejeitados: res.rejeitados
    };
  }
}

module.exports = new SpreadsheetService();
