/* =====================================================================
   PLURIX PROCUREMENT - AUDIT ROUTES (ROTAS DE AUDITORIA DE DADOS)
   Isolamento completo: sem interferência nos dados operacionais
   ===================================================================== */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const auditService = require('../services/auditService');

// Multer configurado em memória para não gravar arquivos em disco nem no banco
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB
});

// 1. Status da Fonte Oficial
router.get('/status', (req, res) => {
  try {
    const info = auditService.getApiInfo();
    res.json(info);
  } catch (err) {
    console.error('[AuditRoutes] Erro em /status:', err);
    res.status(500).json({ error: err.message });
  }
});

// 2. Comparar Planilha com a API Oficial (Em Memória / Read-Only)
router.post('/comparar', upload.single('planilha'), (req, res) => {
  try {
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({ error: 'Nenhum arquivo enviado para comparação.' });
    }

    const filename = req.file.originalname || 'planilha_organizer.xlsx';
    const result = auditService.compareSpreadsheet(req.file.buffer, filename);
    res.json(result);
  } catch (err) {
    console.error('[AuditRoutes] Erro em /comparar:', err);
    res.status(500).json({ error: err.message });
  }
});

// 3. Exportar Relatório Excel de Divergências
router.post('/exportar', (req, res) => {
  try {
    const auditData = req.body;
    if (!auditData || !auditData.resumoExecutivo) {
      return res.status(400).json({ error: 'Dados de auditoria inválidos para exportação.' });
    }

    const excelBuffer = auditService.generateExcelReport(auditData);
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="Relatorio_Auditoria_Plurix.xlsx"');
    res.send(excelBuffer);
  } catch (err) {
    console.error('[AuditRoutes] Erro em /exportar:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
