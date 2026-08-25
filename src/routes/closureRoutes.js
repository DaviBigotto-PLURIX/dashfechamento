/* =====================================================================
   PLURIX PROCUREMENT - ROTAS DE FECHAMENTO E GOVERNANÇA
   Gestão de uploads, conciliações, submissão e aprovações
   ===================================================================== */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 30 * 1024 * 1024 } });

const spreadsheetService = require('../services/spreadsheetService');
const reconciliationService = require('../services/reconciliationService');
const closureService = require('../services/closureService');
const { getDatabase } = require('../database/db');

// 1. Consolidação da Central de Dados & Observabilidade de Compras
router.get('/central-dados', (req, res) => {
  try {
    const db = getDatabase();

    const orgCount = db.prepare('SELECT COUNT(*) as count FROM solicitacao_organizer').get()?.count || 0;
    const planCount = db.prepare('SELECT COUNT(*) as count FROM negociacao_fechamento').get()?.count || 0;
    const lastCarga = db.prepare('SELECT * FROM historico_carga ORDER BY id DESC LIMIT 1').get();

    const concRows = db.prepare(`
      SELECT 
        c.id,
        c.tipo_conciliacao,
        c.divergencia_detectada,
        c.codigo_organizer,
        n.nome_projeto,
        n.investida as investida_planilha,
        n.valor_fechado_total as valor_planilha,
        s.valor_final_negociado as valor_api,
        s.investida_nome as investida_api,
        s.numero_solicitacao
      FROM conciliacao c
      LEFT JOIN negociacao_fechamento n ON c.negociacao_id = n.id
      LEFT JOIN solicitacao_organizer s ON c.solicitacao_id = s.id
      ORDER BY c.id ASC
    `).all();

    const totalDiv = concRows.filter(c => c.tipo_conciliacao !== 'CONCILIADO_AUTOMATICO').length;
    const concAuto = concRows.filter(c => c.tipo_conciliacao === 'CONCILIADO_AUTOMATICO').length;
    const concPct = concRows.length > 0 ? Math.round(((concRows.length - totalDiv) / concRows.length) * 100) : 100;

    res.json({
      ultimaSincronizacao: lastCarga?.data_inicio ? new Date(lastCarga.data_inicio).toLocaleString('pt-BR') : 'Hoje',
      totalApi: orgCount,
      totalPlanilha: planCount,
      totalDivergencias: totalDiv,
      percentualConciliado: concPct,
      qualidadeCarga: totalDiv === 0 ? 'Excelente (100%)' : (concPct >= 80 ? 'Alta' : 'Atenção Requerida'),
      divergencias: concRows
    });
  } catch (err) {
    console.error('[ClosureRoutes] Erro em /central-dados:', err);
    res.status(500).json({ error: err.message });
  }
});

// 2. Upload da Planilha de Fechamento de Procurement
router.post('/upload-planilha', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Nenhum arquivo enviado.' });
    }

    const { ano = '2026', mes = '8', usuario = 'Analista' } = req.body;
    const result = await spreadsheetService.processFechamentoProcurement(
      req.file.buffer,
      req.file.originalname,
      parseInt(ano, 10),
      parseInt(mes, 10),
      usuario
    );

    // Executa conciliação automática imediatamente após a carga
    const concResult = await reconciliationService.runReconciliation(result.fechamentoId);

    res.json({
      sucesso: true,
      mensagem: `Planilha de Fechamento processada com sucesso! ${result.totalValidos} negociações carregadas.`,
      carga: result,
      conciliacao: concResult
    });
  } catch (err) {
    console.error('[ClosureRoutes] Erro ao processar planilha:', err);
    res.status(500).json({ error: err.message });
  }
});

// 2. Upload da Planilha de Estocáveis / Cobertura
router.post('/upload-estocaveis', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Nenhum arquivo enviado.' });

    const result = await spreadsheetService.processEstocaveis(
      req.file.buffer,
      req.file.originalname,
      req.body.usuario || 'Analista'
    );

    res.json({
      sucesso: true,
      mensagem: `Planilha de Estocáveis (${result.unidade} · Mês ${result.mesKey}) carregada com sucesso!`,
      data: result
    });
  } catch (err) {
    console.error('[ClosureRoutes] Erro em estocáveis:', err);
    res.status(500).json({ error: err.message });
  }
});

// 3. Executar/Recalcular Conciliação
router.post('/conciliar', async (req, res) => {
  try {
    const { fechamentoId } = req.body;
    if (!fechamentoId) return res.status(400).json({ error: 'fechamentoId é obrigatório.' });

    const result = await reconciliationService.runReconciliation(parseInt(fechamentoId, 10));
    res.json(result);
  } catch (err) {
    console.error('[ClosureRoutes] Erro na conciliação:', err);
    res.status(500).json({ error: err.message });
  }
});

// 4. Obter Sumário de Conciliação e Pendências
router.get('/conciliacao/:fechamentoId', (req, res) => {
  try {
    const { fechamentoId } = req.params;
    const summary = reconciliationService.getReconciliationSummary(parseInt(fechamentoId, 10));
    res.json(summary);
  } catch (err) {
    console.error('[ClosureRoutes] Erro ao obter conciliação:', err);
    res.status(500).json({ error: err.message });
  }
});

// 5. Justificar Divergência
router.post('/justificar-divergencia', (req, res) => {
  try {
    const { conciliacaoId, justificativa, usuario = 'Analista' } = req.body;
    if (!conciliacaoId || !justificativa) {
      return res.status(400).json({ error: 'conciliacaoId e justificativa são obrigatórios.' });
    }

    const result = reconciliationService.resolveDivergence(parseInt(conciliacaoId, 10), justificativa, usuario);
    res.json(result);
  } catch (err) {
    console.error('[ClosureRoutes] Erro ao justificar:', err);
    res.status(500).json({ error: err.message });
  }
});

// 6. Submeter Fechamento para Aprovação
router.post('/submeter', async (req, res) => {
  try {
    const { fechamentoId, usuario = 'Gestor', justificativas = [] } = req.body;
    if (!fechamentoId) return res.status(400).json({ error: 'fechamentoId é obrigatório.' });

    const result = await closureService.submitForApproval(parseInt(fechamentoId, 10), usuario, justificativas);
    res.json(result);
  } catch (err) {
    console.error('[ClosureRoutes] Erro ao submeter:', err);
    res.status(500).json({ error: err.message });
  }
});

// 7. Aprovar ou Devolver Fechamento (Diretoria)
router.post('/decidir', async (req, res) => {
  try {
    const { fechamentoId, decisao = 'APROVAR', comentarios = '', usuario = 'Diretoria' } = req.body;
    if (!fechamentoId) return res.status(400).json({ error: 'fechamentoId é obrigatório.' });

    const result = await closureService.decideClosure(parseInt(fechamentoId, 10), decisao, comentarios, usuario);
    res.json(result);
  } catch (err) {
    console.error('[ClosureRoutes] Erro ao decidir fechamento:', err);
    res.status(500).json({ error: err.message });
  }
});

// 8. Obter Status de Todos os Fechamentos do Ano
router.get('/status/:ano', (req, res) => {
  try {
    const { ano = '2026' } = req.params;
    const db = getDatabase();
    const rows = db.prepare('SELECT * FROM fechamento_mensal WHERE ano = ? ORDER BY mes ASC').all(parseInt(ano, 10));
    res.json({ ano: parseInt(ano, 10), fechamentos: rows });
  } catch (err) {
    console.error('[ClosureRoutes] Erro ao obter status:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
