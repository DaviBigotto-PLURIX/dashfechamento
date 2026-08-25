/* =====================================================================
   PLURIX PROCUREMENT - ROTAS DO DASHBOARD EXECUTIVO
   Endpoints RESTful de alta performance para os cards e gráficos
   ===================================================================== */

const express = require('express');
const router = express.Router();
const kpiService = require('../services/kpiService');
const { getDatabase } = require('../database/db');

// 1. Resumo Executivo e KPIs
router.get('/overview', async (req, res) => {
  try {
    const { mode = 'ytd', month = 'jul', year = '2026' } = req.query;
    const data = await kpiService.getOverview({ mode, month, year: parseInt(year, 10) });
    res.json(data);
  } catch (err) {
    console.error('[DashboardRoutes] Erro em /overview:', err);
    res.status(500).json({ error: err.message });
  }
});

// 2. Composição e Ranking de Saving
router.get('/saving', async (req, res) => {
  try {
    const { mode = 'ytd', month = 'jul', year = '2026' } = req.query;
    const data = await kpiService.getSavingBreakdown({ mode, month, year: parseInt(year, 10) });
    res.json(data);
  } catch (err) {
    console.error('[DashboardRoutes] Erro em /saving:', err);
    res.status(500).json({ error: err.message });
  }
});

// 3. Evolução Mensal (Curva Meta x Realizado)
router.get('/evolucao', async (req, res) => {
  try {
    const { year = '2026' } = req.query;
    const data = await kpiService.getEvolucaoMensal(parseInt(year, 10));
    res.json(data);
  } catch (err) {
    console.error('[DashboardRoutes] Erro em /evolucao:', err);
    res.status(500).json({ error: err.message });
  }
});

// 4. Negociações Estratégicas e Tabela Filtrável
router.get('/negociacoes', async (req, res) => {
  try {
    const { mode = 'ytd', month = 'jul', tipo = 'ALL', search = '' } = req.query;
    const db = getDatabase();

    let query = `
      SELECT 
        n.id,
        n.codigo_projeto,
        n.codigo_organizer,
        n.nome_projeto,
        n.investida,
        n.categoria,
        n.responsavel_compras,
        n.modalidade,
        n.tipo_resultado,
        n.valor_fechado_total,
        n.saving_baseline,
        n.custo_evitado,
        f.mes_chave as mes
      FROM negociacao_fechamento n
      JOIN fechamento_mensal f ON n.fechamento_id = f.id
      WHERE f.ano = 2026
    `;
    const params = [];

    if (mode === 'month') {
      const monthKeys = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
      const mesNum = monthKeys.indexOf(month) + 1;
      query += ' AND f.mes = ?';
      params.push(mesNum);
    } else {
      query += ' AND f.mes <= 7';
    }

    if (tipo !== 'ALL') {
      if (tipo === 'CAPEX' || tipo === 'OPEX') {
        query += ' AND n.modalidade = ?';
        params.push(tipo);
      } else {
        query += ' AND n.tipo_resultado = ?';
        params.push(tipo);
      }
    }

    if (search && search.trim() !== '') {
      query += ' AND (n.nome_projeto LIKE ? OR n.investida LIKE ? OR n.responsavel_compras LIKE ?)';
      const term = `%${search.trim()}%`;
      params.push(term, term, term);
    }

    query += ' ORDER BY ABS(n.saving_baseline) DESC';

    const rows = db.prepare(query).all(...params);

    res.json({
      total: rows.length,
      negociacoes: rows
    });
  } catch (err) {
    console.error('[DashboardRoutes] Erro em /negociacoes:', err);
    res.status(500).json({ error: err.message });
  }
});

// 5. Dados Operacionais de Requisições, SLA por Área e Emergenciais
router.get('/operacional', async (req, res) => {
  try {
    const { mode = 'ytd', month = 'jul', year = '2026' } = req.query;
    const data = await kpiService.getOperacionalStats({ mode, month, year: parseInt(year, 10) });
    res.json(data);
  } catch (err) {
    console.error('[DashboardRoutes] Erro em /operacional:', err);
    res.status(500).json({ error: err.message });
  }
});

// 6. Dados de Estoque Indireto e Aging
router.get('/estoque', async (req, res) => {
  try {
    const { month = 'jul', year = '2026' } = req.query;
    const data = await kpiService.getEstoqueStats(month, parseInt(year, 10));
    res.json(data);
  } catch (err) {
    console.error('[DashboardRoutes] Erro em /estoque:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
