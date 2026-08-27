/* =====================================================================
   PLURIX PROCUREMENT - MOTOR DE CONCILIAÇÃO E CRUZAMENTO
   Classificação determinística, auditoria de divergências e resoluções
   ===================================================================== */

const { getDatabase } = require('../database/db');

class ReconciliationService {

  /**
   * Executa o processo de conciliação para um fechamento específico
   * @param {Number} fechamentoId 
   */
  async runReconciliation(fechamentoId) {
    const db = getDatabase();

    const fechamento = db.prepare('SELECT * FROM fechamento_mensal WHERE id = ?').get(fechamentoId);
    if (!fechamento) {
      throw new Error(`Fechamento #${fechamentoId} não encontrado.`);
    }

    // 1. Limpar conciliações anteriores não manuais deste fechamento
    db.prepare('DELETE FROM conciliacao WHERE fechamento_id = ?').run(fechamentoId);

    // 2. Buscar todas as negociações da planilha neste fechamento
    const negociacoes = db.prepare(`
      SELECT * FROM negociacao_fechamento WHERE fechamento_id = ?
    `).all(fechamentoId);

    // 3. Buscar todas as solicitações da API para a mesma competência
    const solicitacoes = db.prepare(`
      SELECT * FROM solicitacao_organizer WHERE ano_competencia = ? AND mes_competencia = ?
    `).all(fechamento.ano, fechamento.mes);

    // Indexar solicitações por numero_solicitacao
    const solicByCode = new Map();
    solicitacoes.forEach(s => {
      if (s.numero_solicitacao) {
        const clean = String(s.numero_solicitacao).trim().toUpperCase();
        if (!solicByCode.has(clean)) solicByCode.set(clean, []);
        solicByCode.get(clean).push(s);
      }
    });

    const insertConciliacao = db.prepare(`
      INSERT INTO conciliacao (
        fechamento_id, negociacao_id, solicitacao_id, codigo_organizer,
        tipo_conciliacao, divergencia_detectada, status_aprovacao
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    const matchedSolicIds = new Set();
    let stats = {
      conciliadosAutomaticos: 0,
      conciliadosRegra: 0,
      requerRevisao: 0,
      somenteFechamento: 0,
      somenteOrganizer: 0,
      codigoAusente: 0
    };

    db.exec('BEGIN TRANSACTION');
    try {
      // 4. Cruzar Negociações da Planilha com Solicitações da API
      for (const neg of negociacoes) {
        const rawCode = neg.codigo_organizer ? String(neg.codigo_organizer).trim() : null;

        if (!rawCode) {
          // Caso 1: Código Organizer ausente na planilha
          insertConciliacao.run(
            fechamentoId,
            neg.id,
            null,
            null,
            'CODIGO_AUSENTE',
            'Negociação lançada sem Código Organizer associado na planilha.',
            'PENDENTE'
          );
          stats.codigoAusente++;
          stats.requerRevisao++;
          continue;
        }

        // Caso 2: Buscar correspondência na API
        const codeUpper = rawCode.toUpperCase();
        const matches = solicByCode.get(codeUpper);

        if (!matches || matches.length === 0) {
          // Caso 2.1: Código informado não encontrado na API
          insertConciliacao.run(
            fechamentoId,
            neg.id,
            null,
            rawCode,
            'SOMENTE_FECHAMENTO',
            `Código "${rawCode}" não localizado na base operacional de requisições do Organizer.`,
            'PENDENTE'
          );
          stats.somenteFechamento++;
          stats.requerRevisao++;
        } else if (matches.length === 1) {
          // Caso 2.2: Correspondência unívoca (1 para 1)
          const solic = matches[0];
          matchedSolicIds.add(solic.id);

          const divergencias = [];

          // Checar divergência de valor fechado (> 2% de diferença)
          if (solic.valor_final_negociado && neg.valor_fechado_total) {
            const diff = Math.abs(solic.valor_final_negociado - neg.valor_fechado_total);
            const pctDiff = (diff / neg.valor_fechado_total) * 100;
            if (pctDiff > 2.0 && diff > 100) {
              divergencias.push(`Valor Divergente: API=R$ ${solic.valor_final_negociado.toFixed(2)} vs Planilha=R$ ${neg.valor_fechado_total.toFixed(2)} (${pctDiff.toFixed(1)}%)`);
            }
          }

          // Checar divergência de Investida
          if (solic.investida_nome && neg.investida) {
            const sInv = solic.investida_nome.toLowerCase();
            const nInv = neg.investida.toLowerCase();
            if (!sInv.includes(nInv) && !nInv.includes(sInv)) {
              divergencias.push(`Investida Divergente: API="${solic.investida_nome}" vs Planilha="${neg.investida}"`);
            }
          }

          if (divergencias.length > 0) {
            insertConciliacao.run(
              fechamentoId,
              neg.id,
              solic.id,
              rawCode,
              'CONFLITO_VALOR',
              divergencias.join(' | '),
              'PENDENTE'
            );
            stats.requerRevisao++;
          } else {
            insertConciliacao.run(
              fechamentoId,
              neg.id,
              solic.id,
              rawCode,
              'CONCILIADO_AUTOMATICO',
              'Valores, Investida e Código 100% coincidentes.',
              'RESOLVIDO'
            );
            stats.conciliadosAutomaticos++;
          }
        } else {
          // Caso 2.3: Correspondência 1 para N (múltiplas linhas na API)
          matches.forEach(m => matchedSolicIds.add(m.id));
          insertConciliacao.run(
            fechamentoId,
            neg.id,
            matches[0].id,
            rawCode,
            'CONCILIADO_REGRA',
            `Múltiplas solicitações (${matches.length}) vinculadas a este código.`,
            'PENDENTE'
          );
          stats.conciliadosRegra++;
        }
      }

      // 5. Mapear Solicitações da API sem negociação associada (Somente Organizer)
      for (const solic of solicitacoes) {
        if (!matchedSolicIds.has(solic.id)) {
          // Se for compra estratégica ou de alto valor (> R$ 10.000) e não foi conciliada, registra aviso
          if (solic.tipo_compra === 'ESTRATEGICA' || (solic.valor_final_negociado && solic.valor_final_negociado > 10000)) {
            insertConciliacao.run(
              fechamentoId,
              null,
              solic.id,
              solic.numero_solicitacao,
              'SOMENTE_ORGANIZER',
              `Solicitação de ${solic.tipo_compra} (${solic.categoria || 'Geral'}) no valor de R$ ${(solic.valor_final_negociado || 0).toFixed(2)} não lançada no fechamento.`,
              'PENDENTE'
            );
            stats.somenteOrganizer++;
          }
        }
      }

      // 6. Atualizar contadores no Fechamento Mensal
      db.prepare(`
        UPDATE fechamento_mensal
        SET inconsistencias_pendentes = ?,
            total_negociacoes = ?
        WHERE id = ?
      `).run(stats.requerRevisao, negociacoes.length, fechamentoId);

      db.exec('COMMIT');
    } catch (e) {
      db.exec('ROLLBACK');
      console.error('[ReconciliationService] Erro na conciliação:', e.message);
      throw e;
    }

    return {
      sucesso: true,
      fechamentoId,
      estatisticas: stats,
      totalNegociacoes: negociacoes.length,
      totalSolicitacoes: solicitacoes.length
    };
  }

  /**
   * Obtém o sumário e a lista de divergências de um fechamento
   */
  getReconciliationSummary(fechamentoId) {
    const db = getDatabase();

    const pendencias = db.prepare(`
      SELECT 
        c.id,
        c.tipo_conciliacao,
        c.divergencia_detectada,
        c.justificativa_analista,
        c.status_aprovacao,
        c.codigo_organizer,
        n.nome_projeto,
        n.investida as investida_planilha,
        n.valor_fechado_total as valor_planilha,
        n.saving_baseline as saving_planilha,
        n.responsavel_compras,
        s.numero_solicitacao,
        s.investida_nome as investida_api,
        s.valor_final_negociado as valor_api,
        s.comprador as comprador_api
      FROM conciliacao c
      LEFT JOIN negociacao_fechamento n ON c.negociacao_id = n.id
      LEFT JOIN solicitacao_organizer s ON c.solicitacao_id = s.id
      WHERE c.fechamento_id = ?
      ORDER BY 
        CASE WHEN c.status_aprovacao = 'PENDENTE' THEN 1 ELSE 2 END,
        c.id ASC
    `).all(fechamentoId);

    const totalPendentes = pendencias.filter(p => p.status_aprovacao === 'PENDENTE').length;
    const totalResolvidos = pendencias.filter(p => p.status_aprovacao !== 'PENDENTE').length;

    return {
      fechamentoId,
      totalPendentes,
      totalResolvidos,
      pendencias
    };
  }

  /**
   * Justifica / resolve uma divergência
   */
  resolveDivergence(conciliacaoId, justificativa, usuario = 'Analista') {
    const db = getDatabase();
    const update = db.prepare(`
      UPDATE conciliacao
      SET justificativa_analista = ?,
          revisado_por = ?,
          data_revisao = CURRENT_TIMESTAMP,
          status_aprovacao = 'RESOLVIDO'
      WHERE id = ?
    `);
    update.run(justificativa, usuario, conciliacaoId);

    return { sucesso: true, conciliacaoId };
  }
}

module.exports = new ReconciliationService();
