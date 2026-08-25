/* =====================================================================
   PLURIX PROCUREMENT - ROTAS DE INTEGRAÇÃO COM O ORGANIZER
   Disparo e monitoramento de sincronização de chamados da API
   ===================================================================== */

const express = require('express');
const router = express.Router();
const organizerService = require('../services/organizerService');
const { getDatabase } = require('../database/db');

// 1. Disparar sincronização com a API do Organizer
router.post('/sync', async (req, res) => {
  try {
    const { dataInicio, dataFim, usuario = 'Analista' } = req.body;
    
    // Executa sincronização em background / async
    const result = await organizerService.syncOrganizerData({
      dataInicio,
      dataFim,
      executadoPor: usuario
    });

    res.json({
      sucesso: true,
      totalValidos: result.totalValidos,
      totalRecebidos: result.totalRecebidos,
      mensagem: result.aviso || `Sincronização concluída com sucesso! ${result.totalValidos} solicitações atualizadas diretamente da API.`,
      detalhes: result
    });
  } catch (err) {
    console.error('[OrganizerRoutes] Erro na sincronização:', err);
    res.status(500).json({ sucesso: false, erro: err.message, error: err.message });
  }
});

// 2. Obter histórico das últimas sincronizações
router.get('/status', (req, res) => {
  try {
    const db = getDatabase();
    const rows = db.prepare(`
      SELECT * FROM historico_carga 
      WHERE tipo_carga = 'API_ORGANIZER'
      ORDER BY id DESC LIMIT 10
    `).all();

    const totalSolicitacoes = db.prepare('SELECT COUNT(*) as count FROM solicitacao_organizer').get();

    res.json({
      totalSolicitacoesNaBase: totalSolicitacoes?.count || 0,
      ultimasCargas: rows
    });
  } catch (err) {
    console.error('[OrganizerRoutes] Erro em status:', err);
    res.status(500).json({ error: err.message });
  }
});

// 3. Auditoria de Paridade entre API do Organizer e CSV de Exportação Manual
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });
const parityAuditService = require('../services/parityAuditService');

router.get('/audit-csv', async (req, res) => {
  try {
    const auditReport = await parityAuditService.runParityAudit();
    res.json({
      sucesso: true,
      relatorio: auditReport
    });
  } catch (err) {
    console.error('[OrganizerRoutes] Erro na auditoria de paridade:', err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/audit-csv', upload.single('file'), async (req, res) => {
  try {
    const fileBuffer = req.file ? req.file.buffer : null;
    const fileName = req.file ? req.file.originalname : 'RelatorioGeralCompras.csv';
    const auditReport = await parityAuditService.runParityAudit(fileBuffer, fileName);
    res.json({
      sucesso: true,
      relatorio: auditReport
    });
  } catch (err) {
    console.error('[OrganizerRoutes] Erro no upload para auditoria de paridade:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
