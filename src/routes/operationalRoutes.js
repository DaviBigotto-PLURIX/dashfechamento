/* =====================================================================
   PLURIX PROCUREMENT - ROTAS DE GESTÃO OPERACIONAL DE COMPRAS
   Endpoints de alta performance para o Cockpit do Time e Compradores
   ===================================================================== */

const express = require('express');
const router = express.Router();
const operationalService = require('../services/operationalService');

// 1. Torre de Controle Operacional (Cockpit Geral com Metas e Ações Prioritárias)
router.get('/overview', async (req, res) => {
  try {
    const { mode = 'ytd', month = 'jul', year = '2026' } = req.query;
    const data = await operationalService.getOverview({ mode, month, year: parseInt(year, 10) });
    res.json(data);
  } catch (err) {
    console.error('[OperationalRoutes] Erro em /overview:', err);
    res.status(500).json({ error: err.message });
  }
});

// 2. Performance e Capacidade dos Compradores (com Destaques Executivos e Filtros por Investida/Tipo)
router.get('/compradores', async (req, res) => {
  try {
    const { mode = 'ytd', month = 'jul', year = '2026', search = '', sort = 'volume', investida = '', tipoCompra = '' } = req.query;
    const data = await operationalService.getBuyersPerformance({
      mode,
      month,
      year: parseInt(year, 10),
      search,
      sort,
      investida,
      tipoCompra
    });
    res.json(data);
  } catch (err) {
    console.error('[OperationalRoutes] Erro em /compradores:', err);
    res.status(500).json({ error: err.message });
  }
});

// 2.1 Raio-X Detalhado do Comprador (Performance por Investida e Tipo de Compra)
router.get('/comprador-detalhe', async (req, res) => {
  try {
    const { comprador, mode = 'ytd', month = 'jul', year = '2026', investida = '', tipoCompra = '' } = req.query;
    if (!comprador) {
      return res.status(400).json({ error: 'Parâmetro comprador é obrigatório' });
    }
    const data = await operationalService.getBuyerDetail({
      comprador,
      mode,
      month,
      year: parseInt(year, 10),
      investida,
      tipoCompra
    });
    res.json(data);
  } catch (err) {
    console.error('[OperationalRoutes] Erro em /comprador-detalhe:', err);
    res.status(500).json({ error: err.message });
  }
});

// 3. Workflow, Aging do Backlog e Gargalos Operacionais
router.get('/workflow', async (req, res) => {
  try {
    const { mode = 'ytd', month = 'jul', year = '2026' } = req.query;
    const data = await operationalService.getWorkflowAndBacklog({ mode, month, year: parseInt(year, 10) });
    res.json(data);
  } catch (err) {
    console.error('[OperationalRoutes] Erro em /workflow:', err);
    res.status(500).json({ error: err.message });
  }
});

// 4. Demanda e Benchmark por Investida
router.get('/investidas', async (req, res) => {
  try {
    const { mode = 'ytd', month = 'jul', year = '2026', sort = 'sla' } = req.query;
    const data = await operationalService.getInvestidasBreakdown({ mode, month, year: parseInt(year, 10), sort });
    res.json(data);
  } catch (err) {
    console.error('[OperationalRoutes] Erro em /investidas:', err);
    res.status(500).json({ error: err.message });
  }
});

// 4.1 Drilldown da Investida (Compradores e Categorias da Rede)
router.get('/investida-detalhe', async (req, res) => {
  try {
    const { investida, mode = 'ytd', month = 'jul', year = '2026' } = req.query;
    if (!investida) {
      return res.status(400).json({ error: 'Parâmetro investida é obrigatório' });
    }
    const data = await operationalService.getInvestidaDetail({
      investida,
      mode,
      month,
      year: parseInt(year, 10)
    });
    res.json(data);
  } catch (err) {
    console.error('[OperationalRoutes] Erro em /investida-detalhe:', err);
    res.status(500).json({ error: err.message });
  }
});

// 5. Segmentação por Categoria e Tipos de Compra
router.get('/categorias', async (req, res) => {
  try {
    const { mode = 'ytd', month = 'jul', year = '2026', sort = 'volume' } = req.query;
    const data = await operationalService.getCategoriasBreakdown({ mode, month, year: parseInt(year, 10), sort });
    res.json(data);
  } catch (err) {
    console.error('[OperationalRoutes] Erro em /categorias:', err);
    res.status(500).json({ error: err.message });
  }
});

// 5.1 Drilldown da Categoria (Lista de Chamados com Data de Criação e Finalização)
router.get('/categoria-detalhe', async (req, res) => {
  try {
    const { categoria, mode = 'ytd', month = 'jul', year = '2026' } = req.query;
    if (!categoria) {
      return res.status(400).json({ error: 'Parâmetro categoria é obrigatório' });
    }
    const data = await operationalService.getCategoriaDetail({
      categoria,
      mode,
      month,
      year: parseInt(year, 10)
    });
    res.json(data);
  } catch (err) {
    console.error('[OperationalRoutes] Erro em /categoria-detalhe:', err);
    res.status(500).json({ error: err.message });
  }
});

// 6. Ranking Oficial de SLA dos Compradores (Podium + Classificação)
router.get('/ranking-sla', async (req, res) => {
  try {
    const { mode = 'ytd', month = 'ago', year = '2026', minVol = 0, sort = 'conformidade' } = req.query;
    const data = await operationalService.getRankingSla({
      mode,
      month,
      year: parseInt(year, 10),
      minVol: parseInt(minVol, 10) || 0,
      sort
    });
    res.json(data);
  } catch (err) {
    console.error('[OperationalRoutes] Erro em /ranking-sla:', err);
    res.status(500).json({ error: err.message });
  }
});

// 7. Radar Preditivo de SLA (Próximos ao Vencimento & Já Estourados)
router.get('/alertas-sla', async (req, res) => {
  try {
    const { mode = 'ytd', month = 'ago', year = '2026', urgencia = 'todos', comprador = '', investida = '' } = req.query;
    const data = await operationalService.getAlertasSla({
      mode,
      month,
      year: parseInt(year, 10),
      urgencia,
      comprador,
      investida
    });
    res.json(data);
  } catch (err) {
    console.error('[OperationalRoutes] Erro em /alertas-sla:', err);
    res.status(500).json({ error: err.message });
  }
});

// 8. Linha do Tempo e Rastreabilidade da Solicitação
router.get('/solicitacao/:id/timeline', async (req, res) => {
  try {
    const { id } = req.params;
    const data = await operationalService.getSolicitationTimeline(id);
    res.json(data);
  } catch (err) {
    console.error('[OperationalRoutes] Erro em /solicitacao/:id/timeline:', err);
    res.status(404).json({ error: err.message });
  }
});

module.exports = router;
