/* =====================================================================
   PLURIX PROCUREMENT - GESTÃO DE FECHAMENTO E GOVERNANÇA
   Máquina de estados de fechamento, aprovações e congelamento auditado
   ===================================================================== */

const { getDatabase } = require('../database/db');

class ClosureService {

  /**
   * Inicia ou recupera um fechamento mensal
   */
  async getOrCreateClosure(ano = 2026, mes = 8, usuario = 'Analista') {
    const db = getDatabase();
    const monthKeys = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
    const mesChave = monthKeys[mes - 1] || 'ago';

    let fechamento = db.prepare('SELECT * FROM fechamento_mensal WHERE ano = ? AND mes = ?').get(ano, mes);
    if (!fechamento) {
      const insert = db.prepare(`
        INSERT INTO fechamento_mensal (ano, mes, mes_chave, status, versao, preparado_por)
        VALUES (?, ?, ?, 'RASCUNHO', 1, ?)
      `);
      const res = insert.run(ano, mes, mesChave, usuario);
      fechamento = db.prepare('SELECT * FROM fechamento_mensal WHERE id = ?').get(res.lastInsertRowid);
    }

    return fechamento;
  }

  /**
   * Submete o fechamento para aprovação após resolução das divergências
   */
  async submitForApproval(fechamentoId, usuario = 'Gestor', justificativas = []) {
    const db = getDatabase();

    const fechamento = db.prepare('SELECT * FROM fechamento_mensal WHERE id = ?').get(fechamentoId);
    if (!fechamento) throw new Error('Fechamento não encontrado.');

    if (fechamento.status === 'CONGELADO') {
      throw new Error('Este fechamento já se encontra aprovado e congelado.');
    }

    // Gravar justificativas nas conciliações
    if (justificativas && justificativas.length > 0) {
      const updateConc = db.prepare(`
        UPDATE conciliacao
        SET justificativa_analista = ?,
            revisado_por = ?,
            data_revisao = CURRENT_TIMESTAMP,
            status_aprovacao = 'RESOLVIDO'
        WHERE id = ?
      `);

      db.exec('BEGIN TRANSACTION');
      try {
        for (const item of justificativas) {
          updateConc.run(item.justificativa, usuario, item.conciliacaoId);
        }
        db.exec('COMMIT');
      } catch (e) {
        db.exec('ROLLBACK');
        throw e;
      }
    }

    // Verificar se ainda restam inconsistências não justificadas
    const pendentes = db.prepare(`
      SELECT COUNT(*) as count FROM conciliacao 
      WHERE fechamento_id = ? AND status_aprovacao = 'PENDENTE'
    `).get(fechamentoId);

    const updateF = db.prepare(`
      UPDATE fechamento_mensal
      SET status = ?,
          preparado_por = ?,
          data_preparacao = CURRENT_TIMESTAMP,
          inconsistencias_pendentes = ?
      WHERE id = ?
    `);

    const novoStatus = pendentes.count === 0 ? 'PRONTO_APROVACAO' : 'EM_REVISAO';
    updateF.run(novoStatus, usuario, pendentes.count, fechamentoId);

    // Registrar auditoria
    this.logAudit('fechamento_mensal', fechamentoId, 'status', fechamento.status, novoStatus, 'Submissão de Fechamento', usuario);

    return {
      sucesso: true,
      fechamentoId,
      status: novoStatus,
      pendenciasRestantes: pendentes.count
    };
  }

  /**
   * Aprova ou devolve o fechamento mensal (Ação da Diretoria / Aprovador)
   */
  async decideClosure(fechamentoId, decisao = 'APROVAR', comentarios = '', usuario = 'Diretoria') {
    const db = getDatabase();

    const fechamento = db.prepare('SELECT * FROM fechamento_mensal WHERE id = ?').get(fechamentoId);
    if (!fechamento) throw new Error('Fechamento não encontrado.');

    if (decisao === 'APROVAR') {
      // Calcular totais finais para congelamento
      const totais = db.prepare(`
        SELECT 
          SUM(CASE WHEN modalidade = 'OPEX' AND tipo_resultado = 'SAVING' THEN saving_baseline ELSE 0 END) as opex,
          SUM(CASE WHEN modalidade = 'CAPEX' AND tipo_resultado = 'SAVING' THEN saving_baseline ELSE 0 END) as capex,
          SUM(custo_evitado) as custo_evitado,
          SUM(CASE WHEN tipo_resultado = 'IMPACTO' THEN saving_baseline ELSE 0 END) as impacto,
          COUNT(*) as count
        FROM negociacao_fechamento
        WHERE fechamento_id = ?
      `).get(fechamentoId);

      const updateAprov = db.prepare(`
        UPDATE fechamento_mensal
        SET status = 'CONGELADO',
            aprovado_por = ?,
            data_aprovacao = CURRENT_TIMESTAMP,
            data_congelamento = CURRENT_TIMESTAMP,
            total_negociacoes = ?,
            total_saving_opex = ?,
            total_saving_capex = ?,
            total_custo_evitado = ?,
            total_impacto = ?
        WHERE id = ?
      `);

      updateAprov.run(
        usuario,
        totais?.count || 0,
        Math.abs(totais?.opex || 0),
        Math.abs(totais?.capex || 0),
        totais?.custo_evitado || 0,
        Math.abs(totais?.impacto || 0),
        fechamentoId
      );

      this.logAudit('fechamento_mensal', fechamentoId, 'status', fechamento.status, 'CONGELADO', `Aprovado por ${usuario}: ${comentarios}`, usuario);

      return {
        sucesso: true,
        fechamentoId,
        status: 'CONGELADO',
        mensagem: 'Fechamento aprovado e congelado com sucesso.'
      };
    } else {
      // Devolver para revisão
      const updateDevolv = db.prepare(`
        UPDATE fechamento_mensal
        SET status = 'DEVOLVIDO',
            justificativa_reabertura = ?
        WHERE id = ?
      `);
      updateDevolv.run(comentarios, fechamentoId);

      this.logAudit('fechamento_mensal', fechamentoId, 'status', fechamento.status, 'DEVOLVIDO', `Devolvido: ${comentarios}`, usuario);

      return {
        sucesso: true,
        fechamentoId,
        status: 'DEVOLVIDO',
        mensagem: 'Fechamento devolvido para revisão do analista.'
      };
    }
  }

  /**
   * Registra evento imutável na trilha de auditoria
   */
  logAudit(entidade, registroId, campo, valorAnterior, valorNovo, motivo, usuario) {
    try {
      const db = getDatabase();
      const insert = db.prepare(`
        INSERT INTO auditoria_alteracoes (
          entidade, registro_id, campo_alterado, valor_anterior,
          valor_novo, motivo_alteracao, usuario
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      insert.run(entidade, registroId, campo, String(valorAnterior || ''), String(valorNovo || ''), motivo, usuario);
    } catch (e) {
      console.warn('[ClosureService] Erro ao gravar auditoria:', e.message);
    }
  }
}

module.exports = new ClosureService();
