/* =====================================================================
   PLURIX PROCUREMENT - SERVIÇO DE GESTÃO OPERACIONAL DE COMPRAS
   Motor de análise operacional 100% alimentado pela API do Organizer
   Foco em Decisão Rápida (< 30s), Metas Operacionais, Gaps e Rankings
   ===================================================================== */

const { getDatabase } = require('../database/db');

// Metas Operacionais Corporativas Plurix
const METAS_OPERACIONAIS = {
  SPOT_MATERIAIS_DIAS: 10.0,  // Spot Materiais: 10 dias corridos
  SPOT_SERVICOS_DIAS: 15.0,   // Spot Serviços: 15 dias corridos
  ESTRATEGICA_DIAS: 45.0      // Estratégica: 45 dias corridos
};

class OperationalService {
  constructor() {
    this.monthKeys = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
    this.monthNames = {
      jan: 'Janeiro', fev: 'Fevereiro', mar: 'Março', abr: 'Abril',
      mai: 'Maio', jun: 'Junho', jul: 'Julho', ago: 'Agosto',
      set: 'Setembro', out: 'Outubro', nov: 'Novembro', dez: 'Dezembro'
    };
  }

  /**
   * Helper para construir cláusula WHERE de competência temporal
   * FILTRO OFICIAL: Inclui Spot Materiais, Spot Serviços e Estratégica
   * Exclui apenas: EMERGENCIAL
   */
  buildPeriodFilter(mode = 'ytd', month = 'ago', year = 2026) {
    const isYtd = mode === 'ytd';
    const mesNum = this.monthKeys.indexOf(month) + 1;

    let baseWhere = " WHERE tipo_compra IN ('SPOT_MATERIAIS', 'SPOT_SERVICOS', 'ESTRATEGICA')";
    const params = [];

    if (!isYtd) {
      baseWhere += " AND ano_competencia = ? AND mes_competencia = ?";
      params.push(year, mesNum);
      return {
        clause: baseWhere,
        params,
        periodName: `${this.monthNames[month] || month}/${year}`
      };
    }

    baseWhere += " AND ano_competencia = ? AND mes_competencia <= ?";
    params.push(year, mesNum > 0 ? mesNum : 12);
    return {
      clause: baseWhere,
      params,
      periodName: `Acumulado YTD ${year}`
    };
  }

  /**
   * 1. Home / Resumo Operacional (4 Blocos de Decisão em <30s)
   */
  async getOverview({ mode = 'ytd', month = 'jul', year = 2026 } = {}) {
    const db = getDatabase();
    const { clause, params, periodName } = this.buildPeriodFilter(mode, month, year);

    // 1.1 KPIs Centrais — Usa regra determinística de Pedido de Compra Emitido
    const kpiQuery = `
      SELECT 
        COUNT(*) as total_solicitacoes,
        SUM(CASE 
          WHEN (numero_solicitacao NOT LIKE 'PC%' OR numero_solicitacao IS NULL)
           AND status_nome NOT IN ('Encerrado', 'Cancelado', 'Pedido Enviado', 'Aguardando entrega', 'Aguardando Entrega')
           AND LOWER(status_nome) NOT LIKE '%entrega%'
          THEN 1 ELSE 0 
        END) as backlog_ativo,
        SUM(CASE 
          WHEN numero_solicitacao LIKE 'PC%' 
            OR status_nome IN ('Encerrado', 'Pedido Enviado', 'Aguardando Entrega', 'Aguardando entrega') 
            OR data_finalizacao IS NOT NULL 
          THEN 1 ELSE 0 
        END) as total_concluidas,
        
        -- SLA Cotação médio (apenas registros COM dado nativo do Organizer)
        ROUND(COALESCE(AVG(CASE WHEN dias_atendimento_sla IS NOT NULL AND dias_atendimento_sla >= 0 THEN dias_atendimento_sla END), 0), 1) as sla_cotacao_medio,
        
        -- Contagem de registros com SLA avaliável
        SUM(CASE WHEN dentro_sla IS NOT NULL THEN 1 ELSE 0 END) as total_com_sla,
        SUM(CASE WHEN dentro_sla = 1 THEN 1 ELSE 0 END) as total_dentro_sla,
        
        -- Segregação por modalidade
        SUM(CASE WHEN tipo_compra = 'SPOT_MATERIAIS' THEN 1 ELSE 0 END) as total_spot_materiais,
        SUM(CASE WHEN tipo_compra = 'SPOT_SERVICOS' THEN 1 ELSE 0 END) as total_spot_servicos,
        SUM(CASE WHEN tipo_compra = 'ESTRATEGICA' THEN 1 ELSE 0 END) as total_estrategicas,
        
        -- Requisições em Aberto críticas: >15 dias na etapa de cotação
        SUM(CASE 
          WHEN (numero_solicitacao NOT LIKE 'PC%' OR numero_solicitacao IS NULL)
           AND status_nome NOT IN ('Encerrado', 'Cancelado', 'Pedido Enviado', 'Aguardando entrega', 'Aguardando Entrega')
           AND LOWER(status_nome) NOT LIKE '%entrega%'
           AND data_cotacao IS NOT NULL
           AND (JULIANDAY('now') - JULIANDAY(data_cotacao)) > 15
          THEN 1 ELSE 0 
        END) as backlog_critico_maior_15d
      FROM solicitacao_organizer
      ${clause}
    `;
    const kpiRow = db.prepare(kpiQuery).get(...params);

    // Taxa de conformidade
    const totalComSla = kpiRow?.total_com_sla || 0;
    const totalDentroSla = kpiRow?.total_dentro_sla || 0;
    const slaAtual = totalComSla > 0 ? parseFloat(((totalDentroSla / totalComSla) * 100).toFixed(1)) : 0;
    const slaGap = parseFloat((slaAtual - METAS_OPERACIONAIS.SLA_CONFORMIDADE_PCT).toFixed(1));
    const slaCotacaoAtual = kpiRow?.sla_cotacao_medio || 0;
    const slaCotacaoGap = parseFloat((slaCotacaoAtual - METAS_OPERACIONAIS.SLA_COTACAO_DIAS).toFixed(1));

    // 1.2 Funil do Workflow Operacional
    const funnelQuery = `
      SELECT 
        status_nome as etapa,
        COUNT(*) as quantidade,
        ROUND(COALESCE(AVG(CASE WHEN dias_atendimento_sla IS NOT NULL THEN dias_atendimento_sla END), 0), 1) as tempo_medio_dias
      FROM solicitacao_organizer
      ${clause}
      GROUP BY status_nome
      ORDER BY quantidade DESC
    `;
    const rawFunnel = db.prepare(funnelQuery).all(...params);

    const stagesOrder = [
      { key: 'Solicitação', label: '1. Solicitação', color: '#59B3E6' },
      { key: 'Validação', label: '2. Validação', color: '#8B5CF6' },
      { key: 'Validação Técnica', label: '3. Validação Técnica', color: '#6366F1' },
      { key: 'Cotação', label: '4. Em Cotação (Comprador)', color: '#001A8F' },
      { key: 'Aprovação', label: '5. Aprovação (Alçada)', color: '#F59E0B' },
      { key: 'Em Análise Contratual', label: '6. Análise Contratual', color: '#EC4899' },
      { key: 'Pedido Enviado', label: '7. Pedido Enviado', color: '#10B981' },
      { key: 'Encerrado', label: '8. Encerrado / Concluído', color: '#64748B' }
    ];

    const totalReqs = kpiRow?.total_solicitacoes || 1;
    const funnel = stagesOrder.map(st => {
      const match = rawFunnel.find(f => f.etapa && f.etapa.toLowerCase().includes(st.key.toLowerCase()));
      const qty = match ? match.quantidade : 0;
      const pct = ((qty / totalReqs) * 100).toFixed(1);
      return {
        etapa: st.label,
        chave: st.key,
        quantidade: qty,
        percentual: parseFloat(pct),
        tempoMedio: match ? match.tempo_medio_dias || 0 : 0,
        color: st.color
      };
    });

    // 1.3 Maior Gargalo
    const inFlightStages = funnel.filter(f => !['Pedido Enviado', 'Encerrado'].includes(f.chave));
    inFlightStages.sort((a, b) => b.quantidade - a.quantidade);
    const topBottleneck = inFlightStages[0] || { etapa: 'Cotação', quantidade: 0, percentual: 0 };

    // 1.4 Ações Prioritárias
    const buyerSobrecarga = db.prepare(`
      SELECT comprador, COUNT(*) as backlog, 
        ROUND(COALESCE(AVG(CASE WHEN dias_atendimento_sla IS NOT NULL THEN dias_atendimento_sla END), 0), 1) as sla
      FROM solicitacao_organizer
      ${clause} AND comprador IS NOT NULL AND status_nome NOT IN ('Encerrado', 'Cancelado', 'Pedido Enviado')
      GROUP BY comprador
      ORDER BY backlog DESC
      LIMIT 1
    `).get(...params);

    const investidaAtraso = db.prepare(`
      SELECT investida_nome as investida, COUNT(*) as total,
        ROUND(COALESCE(AVG(CASE WHEN dias_atendimento_sla IS NOT NULL THEN dias_atendimento_sla END), 0), 1) as sla
      FROM solicitacao_organizer
      ${clause}
      GROUP BY investida_nome
      ORDER BY sla DESC
      LIMIT 1
    `).get(...params);

    const priorityActions = [
      {
        id: 1,
        nivel: 'critico',
        icone: 'alert-triangle',
        titulo: `🔴 Maior Gargalo: ${topBottleneck.etapa}`,
        descricao: `${topBottleneck.quantidade} requisições represadas (${topBottleneck.percentual}% do total).`,
        acaoRecomendada: topBottleneck.chave === 'Cotação' ? 'Priorizar retorno de fornecedores e redistribuir cotações.' : 'Cobrar aprovações pendentes de gerentes de loja.'
      },
      {
        id: 2,
        nivel: 'alerta',
        icone: 'user-x',
        titulo: `🟡 Comprador com Maior Carga: ${buyerSobrecarga?.comprador ? buyerSobrecarga.comprador.split(' ')[0] : 'N/A'}`,
        descricao: `${buyerSobrecarga?.backlog || 0} requisições ativas (SLA atual: ${buyerSobrecarga?.sla || 0}d).`,
        acaoRecomendada: 'Rebalancear carteira de pedidos com compradores com menor volume.'
      },
      {
        id: 3,
        nivel: 'atencao',
        icone: 'building-2',
        titulo: `🟠 Investida Mais Crítica: ${investidaAtraso?.investida || 'N/A'}`,
        descricao: `SLA médio de ${investidaAtraso?.sla || 0} dias (${investidaAtraso?.total || 0} solicitações).`,
        acaoRecomendada: 'Alinhar prazos e alçadas de aprovação com a gerência regional.'
      }
    ];

    // 1.5 Top Compradores
    const allBuyers = db.prepare(`
      SELECT 
        comprador,
        COUNT(*) as total_solicitacoes,
        SUM(CASE WHEN LOWER(status_nome) LIKE '%cota%' THEN 1 ELSE 0 END) as backlog_ativo,
        ROUND(COALESCE(AVG(CASE WHEN dias_atendimento_sla IS NOT NULL AND dias_atendimento_sla >= 0 THEN dias_atendimento_sla END), 0), 1) as sla_cotacao_medio,
        SUM(CASE WHEN dentro_sla IS NOT NULL THEN 1 ELSE 0 END) as com_sla,
        SUM(CASE WHEN dentro_sla = 1 THEN 1 ELSE 0 END) as dentro_sla_count
      FROM solicitacao_organizer
      ${clause} AND comprador IS NOT NULL AND TRIM(comprador) != ''
      GROUP BY comprador
    `).all(...params);

    const buyersWithPct = allBuyers.map(b => ({
      ...b,
      taxa_conformidade_pct: b.com_sla > 0 ? parseFloat(((b.dentro_sla_count / b.com_sla) * 100).toFixed(1)) : 0
    }));

    const top5Melhores = [...buyersWithPct]
      .filter(b => b.total_solicitacoes >= 10)
      .sort((a, b) => a.sla_cotacao_medio - b.sla_cotacao_medio)
      .slice(0, 5);

    const top5MaiorBacklog = [...buyersWithPct]
      .sort((a, b) => b.backlog_ativo - a.backlog_ativo)
      .slice(0, 5);

    // 1.6 Ranking de Investidas
    const rankingInvestidas = db.prepare(`
      SELECT 
        investida_nome as investida,
        COUNT(*) as total_solicitacoes,
        SUM(CASE WHEN (numero_solicitacao NOT LIKE 'PC%' OR numero_solicitacao IS NULL) AND status_nome NOT IN ('Encerrado', 'Cancelado', 'Pedido Enviado', 'Aguardando entrega', 'Aguardando Entrega') AND LOWER(status_nome) NOT LIKE '%entrega%' THEN 1 ELSE 0 END) as backlog_ativo,
        SUM(CASE WHEN tipo_compra IN ('SPOT_MATERIAIS', 'SPOT_SERVICOS') THEN 1 ELSE 0 END) as qtd_spot,
        SUM(CASE WHEN tipo_compra = 'SPOT_MATERIAIS' THEN 1 ELSE 0 END) as qtd_spot_mat,
        SUM(CASE WHEN tipo_compra = 'SPOT_SERVICOS' THEN 1 ELSE 0 END) as qtd_spot_serv,
        SUM(CASE WHEN tipo_compra = 'ESTRATEGICA' THEN 1 ELSE 0 END) as qtd_estrategica,
        ROUND(COALESCE(AVG(CASE WHEN dias_atendimento_sla IS NOT NULL AND dias_atendimento_sla >= 0 THEN dias_atendimento_sla END), 0), 1) as sla_cotacao_medio,
        SUM(CASE WHEN dentro_sla IS NOT NULL THEN 1 ELSE 0 END) as com_sla,
        SUM(CASE WHEN dentro_sla = 1 THEN 1 ELSE 0 END) as dentro_sla_count
      FROM solicitacao_organizer
      ${clause}
      GROUP BY investida_nome
      ORDER BY total_solicitacoes DESC
    `).all(...params);

    const rankingWithPct = rankingInvestidas.map(r => ({
      ...r,
      taxa_conformidade_pct: r.com_sla > 0 ? parseFloat(((r.dentro_sla_count / r.com_sla) * 100).toFixed(1)) : 0
    }));

    // 1.7 Tipos de Compra Segregados
    const tiposRows = db.prepare(`
      SELECT 
        CASE 
          WHEN tipo_compra = 'SPOT_MATERIAIS' THEN 'Spot Materiais'
          WHEN tipo_compra = 'SPOT_SERVICOS' THEN 'Spot Serviços'
          WHEN tipo_compra = 'ESTRATEGICA' THEN 'Estratégica'
          ELSE tipo_compra
        END as tipo,
        COUNT(*) as quantidade,
        ROUND(COALESCE(AVG(CASE WHEN dias_atendimento_sla IS NOT NULL THEN dias_atendimento_sla END), 0), 1) as sla_medio
      FROM solicitacao_organizer
      ${clause}
      GROUP BY tipo
      ORDER BY quantidade DESC
    `).all(...params);

    const spotMat = kpiRow?.total_spot_materiais || 0;
    const spotServ = kpiRow?.total_spot_servicos || 0;
    const estrategica = kpiRow?.total_estrategicas || 0;

    const modalidadesQuery = db.prepare(`
      SELECT 
        tipo_compra,
        COUNT(*) as total,
        SUM(CASE WHEN numero_solicitacao LIKE 'PC%' OR status_nome IN ('Encerrado', 'Pedido Enviado', 'Aguardando Entrega', 'Aguardando entrega') OR data_finalizacao IS NOT NULL THEN 1 ELSE 0 END) as concluidas,
        SUM(CASE WHEN (numero_solicitacao NOT LIKE 'PC%' OR numero_solicitacao IS NULL) AND status_nome NOT IN ('Encerrado', 'Cancelado', 'Pedido Enviado', 'Aguardando Entrega', 'Aguardando entrega') AND LOWER(status_nome) NOT LIKE '%entrega%' THEN 1 ELSE 0 END) as backlog,
        ROUND(COALESCE(AVG(CASE WHEN dias_atendimento_sla IS NOT NULL AND dias_atendimento_sla >= 0 THEN dias_atendimento_sla END), 0), 1) as sla_medio,
        SUM(CASE WHEN dentro_sla IS NOT NULL THEN 1 ELSE 0 END) as com_sla,
        SUM(CASE WHEN dentro_sla = 1 THEN 1 ELSE 0 END) as dentro_sla_count
      FROM solicitacao_organizer
      ${clause}
      GROUP BY tipo_compra
    `).all(...params);

    const modalidadesDetalhe = {
      spotMateriais: {
        nome: 'Spot Materiais',
        metaSla: 10,
        total: 0,
        concluidas: 0,
        backlog: 0,
        slaMedio: 0,
        conformidadePct: 0
      },
      spotServicos: {
        nome: 'Spot Serviços',
        metaSla: 15,
        total: 0,
        concluidas: 0,
        backlog: 0,
        slaMedio: 0,
        conformidadePct: 0
      },
      estrategica: {
        nome: 'Estratégico',
        metaSla: 45,
        total: 0,
        concluidas: 0,
        backlog: 0,
        slaMedio: 0,
        conformidadePct: 0
      }
    };

    modalidadesQuery.forEach(m => {
      const conf = m.com_sla > 0 ? parseFloat(((m.dentro_sla_count / m.com_sla) * 100).toFixed(1)) : 0;
      if (m.tipo_compra === 'SPOT_MATERIAIS') {
        modalidadesDetalhe.spotMateriais = {
          nome: 'Spot Materiais',
          metaSla: 10,
          total: m.total,
          concluidas: m.concluidas,
          backlog: m.backlog,
          slaMedio: m.sla_medio,
          conformidadePct: conf
        };
      } else if (m.tipo_compra === 'SPOT_SERVICOS') {
        modalidadesDetalhe.spotServicos = {
          nome: 'Spot Serviços',
          metaSla: 15,
          total: m.total,
          concluidas: m.concluidas,
          backlog: m.backlog,
          slaMedio: m.sla_medio,
          conformidadePct: conf
        };
      } else if (m.tipo_compra === 'ESTRATEGICA') {
        modalidadesDetalhe.estrategica = {
          nome: 'Estratégico',
          metaSla: 45,
          total: m.total,
          concluidas: m.concluidas,
          backlog: m.backlog,
          slaMedio: m.sla_medio,
          conformidadePct: conf
        };
      }
    });

    // Radar Rápido de Alertas Ativos (Apenas solicitações que estão ativamente em Cotação com o Comprador)
    const radarQuery = db.prepare(`
      SELECT 
        tipo_compra,
        CASE 
          WHEN tipo_compra = 'ESTRATEGICA' THEN 45.0
          WHEN tipo_compra = 'SPOT_SERVICOS' THEN 15.0
          ELSE 10.0
        END as meta_sla,
        CASE 
          WHEN COALESCE(data_cotacao, data_criacao) IS NOT NULL THEN
            MAX(0, CAST(ROUND(JULIANDAY('now', 'localtime') - JULIANDAY(COALESCE(data_cotacao, data_criacao))) AS INT))
          ELSE 0
        END as aging_dias
      FROM solicitacao_organizer
      ${clause} AND LOWER(status_nome) LIKE '%cota%'
    `).all(...params);

    let radarVencidos = 0;
    let radarCritico24h = 0;
    let radarAlerta72h = 0;
    let radarNoPrazo = 0;

    radarQuery.forEach(r => {
      const rest = r.meta_sla - r.aging_dias;
      if (rest < 0) radarVencidos++;
      else if (rest <= 1) radarCritico24h++;
      else if (rest <= 3) radarAlerta72h++;
      else radarNoPrazo++;
    });

    return {
      periodo: {
        modo: mode,
        mes: month,
        ano: year,
        nome: periodName
      },
      kpis: {
        totalSolicitacoes: kpiRow?.total_solicitacoes || 0,
        backlogAtivo: kpiRow?.backlog_ativo || 0,
        totalConcluidas: kpiRow?.total_concluidas || 0,

        // SLA de Conformidade
        taxaConformidadePct: slaAtual,
        metaConformidadePct: METAS_OPERACIONAIS.SLA_CONFORMIDADE_PCT,
        gapConformidade: slaGap,
        statusConformidade: slaGap >= 0 ? 'Meta Atingida' : 'Abaixo da Meta',
        totalComSla,
        totalDentroSla,

        // SLA de Cotação
        slaCotacaoMedio: slaCotacaoAtual,
        metaSlaCotacao: METAS_OPERACIONAIS.SLA_COTACAO_DIAS,
        gapSlaCotacao: slaCotacaoGap,
        statusSlaCotacao: slaCotacaoGap <= 0 ? 'Excelente' : 'Atenção',

        // Backlog Crítico
        backlogCritico15d: kpiRow?.backlog_critico_maior_15d || 0,
        metaBacklogCritico: METAS_OPERACIONAIS.BACKLOG_CRITICO_MAX,

        // Segregação por Modalidade
        totalSpotMateriais: spotMat,
        totalSpotServicos: spotServ,
        totalSpot: spotMat + spotServ,
        totalEstrategicas: estrategica
      },
      modalidadesDetalhe,
      radarResumo: {
        totalAtivos: radarQuery.length,
        vencidos: radarVencidos,
        critico24h: radarCritico24h,
        alerta72h: radarAlerta72h,
        noPrazo: radarNoPrazo,
        totalEmRisco: radarVencidos + radarCritico24h + radarAlerta72h
      },
      prioridadesAcao: priorityActions,
      funilWorkflow: funnel,
      top5MelhoresCompradores: top5Melhores,
      top5MaiorBacklogCompradores: top5MaiorBacklog,
      rankingInvestidasHome: rankingWithPct,
      tiposCompra: tiposRows
    };
  }

  /**
   * 2. Gestão de Performance e Capacidade dos Compradores
   * Suporta segmentação por Investida e Tipo de Compra
   */
  async getBuyersPerformance({ mode = 'ytd', month = 'jul', year = 2026, search = '', sort = 'volume', investida = '', tipoCompra = '' } = {}) {
    const db = getDatabase();
    const { clause, params, periodName } = this.buildPeriodFilter(mode, month, year);

    let buyerWhere = `${clause} AND comprador IS NOT NULL AND TRIM(comprador) != '' AND comprador != 'Não informado'`;
    let queryParams = [...params];

    if (investida && investida.trim() !== '' && investida !== 'todas') {
      buyerWhere += ' AND investida_nome = ?';
      queryParams.push(investida.trim());
    }

    if (tipoCompra && tipoCompra.trim() !== '' && tipoCompra !== 'todos') {
      if (tipoCompra === 'SPOT') {
        buyerWhere += " AND tipo_compra IN ('SPOT_MATERIAIS', 'SPOT_SERVICOS')";
      } else {
        buyerWhere += ' AND tipo_compra = ?';
        queryParams.push(tipoCompra.trim());
      }
    }

    const query = `
      SELECT 
        comprador,
        COUNT(*) as total_solicitacoes,
        SUM(CASE WHEN numero_solicitacao LIKE 'PC%' OR status_nome IN ('Encerrado', 'Pedido Enviado', 'Aguardando entrega', 'Aguardando Entrega') OR data_finalizacao IS NOT NULL THEN 1 ELSE 0 END) as total_atendidas,
        SUM(CASE WHEN (numero_solicitacao NOT LIKE 'PC%' OR numero_solicitacao IS NULL) AND status_nome NOT IN ('Encerrado', 'Cancelado', 'Pedido Enviado', 'Aguardando entrega', 'Aguardando Entrega') AND LOWER(status_nome) NOT LIKE '%entrega%' THEN 1 ELSE 0 END) as backlog_ativo,
        SUM(CASE 
          WHEN (numero_solicitacao NOT LIKE 'PC%' OR numero_solicitacao IS NULL) AND status_nome NOT IN ('Encerrado', 'Cancelado', 'Pedido Enviado', 'Aguardando entrega', 'Aguardando Entrega') AND LOWER(status_nome) NOT LIKE '%entrega%' AND (
            CASE 
              WHEN tipo_compra = 'ESTRATEGICA' THEN 45.0
              WHEN tipo_compra = 'SPOT_SERVICOS' THEN 15.0
              ELSE 10.0
            END >= (
              CASE 
                WHEN data_cotacao IS NOT NULL AND data_cotacao != '' THEN (julianday('now', 'localtime') - julianday(data_cotacao))
                ELSE (julianday('now', 'localtime') - julianday(data_criacao))
              END
            )
          ) THEN 1 ELSE 0 
        END) as backlog_dentro_sla,
        SUM(CASE 
          WHEN (numero_solicitacao NOT LIKE 'PC%' OR numero_solicitacao IS NULL) AND status_nome NOT IN ('Encerrado', 'Cancelado', 'Pedido Enviado', 'Aguardando entrega', 'Aguardando Entrega') AND LOWER(status_nome) NOT LIKE '%entrega%' AND (
            CASE 
              WHEN tipo_compra = 'ESTRATEGICA' THEN 45.0
              WHEN tipo_compra = 'SPOT_SERVICOS' THEN 15.0
              ELSE 10.0
            END < (
              CASE 
                WHEN data_cotacao IS NOT NULL AND data_cotacao != '' THEN (julianday('now', 'localtime') - julianday(data_cotacao))
                ELSE (julianday('now', 'localtime') - julianday(data_criacao))
              END
            )
          ) THEN 1 ELSE 0 
        END) as backlog_fora_sla,
        ROUND(COALESCE(AVG(CASE WHEN dias_atendimento_sla IS NOT NULL AND dias_atendimento_sla >= 0 THEN dias_atendimento_sla END), 0), 1) as sla_cotacao_medio,
        SUM(CASE WHEN dentro_sla IS NOT NULL THEN 1 ELSE 0 END) as com_sla,
        SUM(CASE WHEN dentro_sla = 1 THEN 1 ELSE 0 END) as dentro_sla_count,
        SUM(CASE WHEN tipo_compra = 'SPOT_SERVICOS' THEN 1 ELSE 0 END) as qtd_spot_servicos,
        SUM(CASE WHEN tipo_compra = 'SPOT_MATERIAIS' THEN 1 ELSE 0 END) as qtd_spot_materiais,
        SUM(CASE WHEN tipo_compra = 'ESTRATEGICA' THEN 1 ELSE 0 END) as qtd_estrategica,
        GROUP_CONCAT(DISTINCT investida_nome) as investidas_atendidas,
        COUNT(DISTINCT investida_nome) as total_investidas_atendidas
      FROM solicitacao_organizer
      ${buyerWhere}
      GROUP BY comprador
    `;
    const rows = db.prepare(query).all(...queryParams);
    const totalGeral = rows.reduce((s, r) => s + r.total_solicitacoes, 0) || 1;

    let buyers = rows.map(b => {
      const sharePct = ((b.total_solicitacoes / totalGeral) * 100).toFixed(1);
      const taxaConf = b.com_sla > 0 ? parseFloat(((b.dentro_sla_count / b.com_sla) * 100).toFixed(1)) : 0;

      let statusCapacidade = 'Equilibrada';
      if (b.total_solicitacoes > 100 && b.sla_cotacao_medio <= 8) statusCapacidade = 'Alta Eficiência';
      else if (b.total_solicitacoes > 100 && b.sla_cotacao_medio > 12) statusCapacidade = 'Sobrecarga';
      else if (b.sla_cotacao_medio <= 6) statusCapacidade = 'Ágil';
      else if (b.sla_cotacao_medio > 11) statusCapacidade = 'Atenção SLA';

      return {
        comprador: b.comprador,
        totalSolicitacoes: b.total_solicitacoes,
        totalAtendidas: b.total_atendidas,
        backlogAtivo: b.backlog_ativo,
        backlogDentroSla: b.backlog_dentro_sla || 0,
        backlogForaSla: b.backlog_fora_sla || 0,
        shareVolumePct: parseFloat(sharePct),
        slaCotacaoMedio: b.sla_cotacao_medio || 0,
        taxaConformidadePct: taxaConf,
        mix: {
          spotMateriais: b.qtd_spot_materiais || 0,
          spotServicos: b.qtd_spot_servicos || 0,
          estrategica: b.qtd_estrategica || 0,
          spot: (b.qtd_spot_materiais || 0) + (b.qtd_spot_servicos || 0)
        },
        investidas: b.investidas_atendidas || 'Geral',
        totalInvestidas: b.total_investidas_atendidas || 1,
        statusCapacidade
      };
    });

    // Totais Consolidados da Equipe (Filtrados)
    const totalBacklog = buyers.reduce((s, b) => s + b.backlogAtivo, 0);
    const totalBacklogDentroSla = buyers.reduce((s, b) => s + b.backlogDentroSla, 0);
    const totalBacklogForaSla = buyers.reduce((s, b) => s + b.backlogForaSla, 0);
    const pctBacklogDentroSla = totalBacklog > 0 ? parseFloat(((totalBacklogDentroSla / totalBacklog) * 100).toFixed(1)) : 0;
    const pctBacklogForaSla = totalBacklog > 0 ? parseFloat(((totalBacklogForaSla / totalBacklog) * 100).toFixed(1)) : 0;

    // Listas distintas de filtros disponíveis
    const investidasDisponiveis = db.prepare(`
      SELECT DISTINCT investida_nome 
      FROM solicitacao_organizer 
      ${clause} AND investida_nome IS NOT NULL AND TRIM(investida_nome) != ''
      ORDER BY investida_nome ASC
    `).all(...params).map(r => r.investida_nome);

    const tiposDisponiveis = [
      { id: 'todos', label: 'Todos os Tipos' },
      { id: 'SPOT_MATERIAIS', label: 'Spot Materiais (10d)' },
      { id: 'SPOT_SERVICOS', label: 'Spot Serviços (15d)' },
      { id: 'ESTRATEGICA', label: 'Estratégico (45d)' }
    ];

    // Cards Executivos de Destaque
    const sortedByVolume = [...buyers].sort((a, b) => b.totalSolicitacoes - a.totalSolicitacoes);
    const sortedBySla = [...buyers].filter(b => b.totalSolicitacoes >= 10).sort((a, b) => a.slaCotacaoMedio - b.slaCotacaoMedio);
    const sortedByBacklog = [...buyers].sort((a, b) => b.backlogAtivo - a.backlogAtivo);
    const sortedBySlow = [...buyers].filter(b => b.totalSolicitacoes >= 10).sort((a, b) => b.slaCotacaoMedio - a.slaCotacaoMedio);

    const execHighlights = {
      topPerformer: sortedBySla[0] || buyers.find(b => b.slaCotacaoMedio <= 10) || buyers[0],
      maiorVolume: sortedByVolume[0] || buyers[0],
      sobrecarga: sortedByBacklog[0] || buyers[0],
      necessitaSuporte: sortedBySlow[0] || buyers[buyers.length - 1]
    };

    if (search && search.trim() !== '') {
      const s = search.toLowerCase().trim();
      buyers = buyers.filter(b => b.comprador.toLowerCase().includes(s) || b.investidas.toLowerCase().includes(s));
    }

    if (sort === 'volume') buyers.sort((a, b) => b.totalSolicitacoes - a.totalSolicitacoes);
    else if (sort === 'sla') buyers.sort((a, b) => a.slaCotacaoMedio - b.slaCotacaoMedio);
    else if (sort === 'backlog') buyers.sort((a, b) => b.backlogAtivo - a.backlogAtivo);
    else if (sort === 'foraSla') buyers.sort((a, b) => b.backlogForaSla - a.backlogForaSla || b.backlogAtivo - a.backlogAtivo);
    else if (sort === 'conformidade') buyers.sort((a, b) => b.taxaConformidadePct - a.taxaConformidadePct);

    return {
      periodo: periodName,
      totalCompradores: buyers.length,
      volumeTotalPeriodo: totalGeral,
      filtrosAtivos: {
        investida: investida || 'todas',
        tipoCompra: tipoCompra || 'todos',
        search: search || '',
        sort: sort || 'volume'
      },
      opcoesFiltros: {
        investidas: ['todas', ...investidasDisponiveis],
        tiposCompra: tiposDisponiveis
      },
      totaisEquipe: {
        totalCompradores: buyers.length,
        volumeTotal: totalGeral,
        totalBacklog,
        totalBacklogDentroSla,
        totalBacklogForaSla,
        pctBacklogDentroSla,
        pctBacklogForaSla
      },
      destaquesExecutivos: execHighlights,
      compradores: buyers
    };
  }

  /**
   * 2.1 RAIO-X DETALHADO DO COMPRADOR
   * Suporta segmentação interna por Investida e Tipo de Compra
   */
  async getBuyerDetail({ comprador, mode = 'ytd', month = 'jul', year = 2026, investida = '', tipoCompra = '' } = {}) {
    const db = getDatabase();
    if (!comprador) throw new Error('Nome do comprador é obrigatório');

    const { clause, params, periodName } = this.buildPeriodFilter(mode, month, year);

    // 1. Resumo Geral (Total da carteira do comprador no período)
    const resumoGeralRaw = db.prepare(`
      SELECT 
        comprador,
        COUNT(*) as total_solicitacoes,
        SUM(CASE WHEN numero_solicitacao LIKE 'PC%' OR status_nome IN ('Encerrado', 'Pedido Enviado', 'Aguardando entrega', 'Aguardando Entrega') OR data_finalizacao IS NOT NULL THEN 1 ELSE 0 END) as total_atendidas,
        SUM(CASE WHEN (numero_solicitacao NOT LIKE 'PC%' OR numero_solicitacao IS NULL) AND status_nome NOT IN ('Encerrado', 'Cancelado', 'Pedido Enviado', 'Aguardando entrega', 'Aguardando Entrega') AND LOWER(status_nome) NOT LIKE '%entrega%' THEN 1 ELSE 0 END) as backlog_ativo,
        SUM(CASE 
          WHEN (numero_solicitacao NOT LIKE 'PC%' OR numero_solicitacao IS NULL) AND status_nome NOT IN ('Encerrado', 'Cancelado', 'Pedido Enviado', 'Aguardando entrega', 'Aguardando Entrega') AND LOWER(status_nome) NOT LIKE '%entrega%' AND (
            CASE 
              WHEN tipo_compra = 'ESTRATEGICA' THEN 45.0
              WHEN tipo_compra = 'SPOT_SERVICOS' THEN 15.0
              ELSE 10.0
            END >= (
              CASE 
                WHEN data_cotacao IS NOT NULL AND data_cotacao != '' THEN (julianday('now', 'localtime') - julianday(data_cotacao))
                ELSE (julianday('now', 'localtime') - julianday(data_criacao))
              END
            )
          ) THEN 1 ELSE 0 
        END) as backlog_dentro_sla,
        SUM(CASE 
          WHEN (numero_solicitacao NOT LIKE 'PC%' OR numero_solicitacao IS NULL) AND status_nome NOT IN ('Encerrado', 'Cancelado', 'Pedido Enviado', 'Aguardando entrega', 'Aguardando Entrega') AND LOWER(status_nome) NOT LIKE '%entrega%' AND (
            CASE 
              WHEN tipo_compra = 'ESTRATEGICA' THEN 45.0
              WHEN tipo_compra = 'SPOT_SERVICOS' THEN 15.0
              ELSE 10.0
            END < (
              CASE 
                WHEN data_cotacao IS NOT NULL AND data_cotacao != '' THEN (julianday('now', 'localtime') - julianday(data_cotacao))
                ELSE (julianday('now', 'localtime') - julianday(data_criacao))
              END
            )
          ) THEN 1 ELSE 0 
        END) as backlog_fora_sla,
        ROUND(COALESCE(AVG(CASE WHEN dias_atendimento_sla IS NOT NULL AND dias_atendimento_sla >= 0 THEN dias_atendimento_sla END), 0), 1) as sla_cotacao_medio,
        SUM(CASE WHEN dentro_sla IS NOT NULL THEN 1 ELSE 0 END) as com_sla,
        SUM(CASE WHEN dentro_sla = 1 THEN 1 ELSE 0 END) as dentro_sla_count,
        SUM(CASE WHEN tipo_compra = 'SPOT_SERVICOS' THEN 1 ELSE 0 END) as qtd_spot_servicos,
        SUM(CASE WHEN tipo_compra = 'SPOT_MATERIAIS' THEN 1 ELSE 0 END) as qtd_spot_materiais,
        SUM(CASE WHEN tipo_compra = 'ESTRATEGICA' THEN 1 ELSE 0 END) as qtd_estrategica
      FROM solicitacao_organizer
      ${clause} AND comprador = ?
    `).get(...params, comprador);

    const formatResumo = (r) => {
      if (!r) return null;
      const conf = r.com_sla > 0 ? parseFloat(((r.dentro_sla_count / r.com_sla) * 100).toFixed(1)) : 0;
      const pctDentro = r.backlog_ativo > 0 ? parseFloat((((r.backlog_dentro_sla || 0) / r.backlog_ativo) * 100).toFixed(1)) : 0;
      const pctFora = r.backlog_ativo > 0 ? parseFloat((((r.backlog_fora_sla || 0) / r.backlog_ativo) * 100).toFixed(1)) : 0;
      return {
        ...r,
        taxa_conformidade_pct: conf,
        pct_backlog_dentro_sla: pctDentro,
        pct_backlog_fora_sla: pctFora,
        mix: {
          spotMateriais: r.qtd_spot_materiais || 0,
          spotServicos: r.qtd_spot_servicos || 0,
          estrategica: r.qtd_estrategica || 0,
          spot: (r.qtd_spot_materiais || 0) + (r.qtd_spot_servicos || 0)
        }
      };
    };

    const resumoGeral = formatResumo(resumoGeralRaw);

    // 2. Cláusula Filtrada para o Dossiê
    let filterClause = `${clause} AND comprador = ?`;
    let filterParams = [...params, comprador];

    if (investida && investida.trim() !== '' && investida !== 'todas') {
      filterClause += ' AND investida_nome = ?';
      filterParams.push(investida.trim());
    }

    if (tipoCompra && tipoCompra.trim() !== '' && tipoCompra !== 'todos') {
      if (tipoCompra === 'SPOT') {
        filterClause += " AND tipo_compra IN ('SPOT_MATERIAIS', 'SPOT_SERVICOS')";
      } else {
        filterClause += ' AND tipo_compra = ?';
        filterParams.push(tipoCompra.trim());
      }
    }

    const resumoFiltradoRaw = db.prepare(`
      SELECT 
        comprador,
        COUNT(*) as total_solicitacoes,
        SUM(CASE WHEN numero_solicitacao LIKE 'PC%' OR status_nome IN ('Encerrado', 'Pedido Enviado', 'Aguardando entrega', 'Aguardando Entrega') OR data_finalizacao IS NOT NULL THEN 1 ELSE 0 END) as total_atendidas,
        SUM(CASE WHEN (numero_solicitacao NOT LIKE 'PC%' OR numero_solicitacao IS NULL) AND status_nome NOT IN ('Encerrado', 'Cancelado', 'Pedido Enviado', 'Aguardando entrega', 'Aguardando Entrega') AND LOWER(status_nome) NOT LIKE '%entrega%' THEN 1 ELSE 0 END) as backlog_ativo,
        SUM(CASE 
          WHEN (numero_solicitacao NOT LIKE 'PC%' OR numero_solicitacao IS NULL) AND status_nome NOT IN ('Encerrado', 'Cancelado', 'Pedido Enviado', 'Aguardando entrega', 'Aguardando Entrega') AND LOWER(status_nome) NOT LIKE '%entrega%' AND (
            CASE 
              WHEN tipo_compra = 'ESTRATEGICA' THEN 45.0
              WHEN tipo_compra = 'SPOT_SERVICOS' THEN 15.0
              ELSE 10.0
            END >= (
              CASE 
                WHEN data_cotacao IS NOT NULL AND data_cotacao != '' THEN (julianday('now', 'localtime') - julianday(data_cotacao))
                ELSE (julianday('now', 'localtime') - julianday(data_criacao))
              END
            )
          ) THEN 1 ELSE 0 
        END) as backlog_dentro_sla,
        SUM(CASE 
          WHEN (numero_solicitacao NOT LIKE 'PC%' OR numero_solicitacao IS NULL) AND status_nome NOT IN ('Encerrado', 'Cancelado', 'Pedido Enviado', 'Aguardando entrega', 'Aguardando Entrega') AND LOWER(status_nome) NOT LIKE '%entrega%' AND (
            CASE 
              WHEN tipo_compra = 'ESTRATEGICA' THEN 45.0
              WHEN tipo_compra = 'SPOT_SERVICOS' THEN 15.0
              ELSE 10.0
            END < (
              CASE 
                WHEN data_cotacao IS NOT NULL AND data_cotacao != '' THEN (julianday('now', 'localtime') - julianday(data_cotacao))
                ELSE (julianday('now', 'localtime') - julianday(data_criacao))
              END
            )
          ) THEN 1 ELSE 0 
        END) as backlog_fora_sla,
        ROUND(COALESCE(AVG(CASE WHEN dias_atendimento_sla IS NOT NULL AND dias_atendimento_sla >= 0 THEN dias_atendimento_sla END), 0), 1) as sla_cotacao_medio,
        SUM(CASE WHEN dentro_sla IS NOT NULL THEN 1 ELSE 0 END) as com_sla,
        SUM(CASE WHEN dentro_sla = 1 THEN 1 ELSE 0 END) as dentro_sla_count,
        SUM(CASE WHEN tipo_compra = 'SPOT_SERVICOS' THEN 1 ELSE 0 END) as qtd_spot_servicos,
        SUM(CASE WHEN tipo_compra = 'SPOT_MATERIAIS' THEN 1 ELSE 0 END) as qtd_spot_materiais,
        SUM(CASE WHEN tipo_compra = 'ESTRATEGICA' THEN 1 ELSE 0 END) as qtd_estrategica
      FROM solicitacao_organizer
      ${filterClause}
    `).get(...filterParams);

    const resumoFiltrado = formatResumo(resumoFiltradoRaw) || resumoGeral;

    // 3. Performance por Rede Atendida (com indicador de alerta)
    const investidasRaw = db.prepare(`
      SELECT 
        investida_nome as investida,
        COUNT(*) as total_solicitacoes,
        SUM(CASE WHEN (numero_solicitacao NOT LIKE 'PC%' OR numero_solicitacao IS NULL) AND status_nome NOT IN ('Encerrado', 'Cancelado', 'Pedido Enviado', 'Aguardando entrega', 'Aguardando Entrega') AND LOWER(status_nome) NOT LIKE '%entrega%' THEN 1 ELSE 0 END) as backlog_ativo,
        SUM(CASE WHEN tipo_compra IN ('SPOT_MATERIAIS', 'SPOT_SERVICOS') THEN 1 ELSE 0 END) as qtd_spot,
        SUM(CASE WHEN tipo_compra = 'SPOT_MATERIAIS' THEN 1 ELSE 0 END) as qtd_spot_mat,
        SUM(CASE WHEN tipo_compra = 'SPOT_SERVICOS' THEN 1 ELSE 0 END) as qtd_spot_serv,
        SUM(CASE WHEN tipo_compra = 'ESTRATEGICA' THEN 1 ELSE 0 END) as qtd_estrategica,
        ROUND(COALESCE(AVG(CASE WHEN dias_atendimento_sla IS NOT NULL AND dias_atendimento_sla >= 0 THEN dias_atendimento_sla END), 0), 1) as sla_cotacao_medio,
        SUM(CASE WHEN dentro_sla IS NOT NULL THEN 1 ELSE 0 END) as com_sla,
        SUM(CASE WHEN dentro_sla = 1 THEN 1 ELSE 0 END) as dentro_sla_count
      FROM solicitacao_organizer
      ${clause} AND comprador = ?
      GROUP BY investida_nome
      ORDER BY total_solicitacoes DESC
    `).all(...params, comprador);

    const mediaGeralSla = resumoGeral?.sla_cotacao_medio || 0;
    const investidas = investidasRaw.map(inv => {
      const taxaConf = inv.com_sla > 0 ? parseFloat(((inv.dentro_sla_count / inv.com_sla) * 100).toFixed(1)) : 0;
      let alerta = 'Normal';
      if (mediaGeralSla > 0) {
        if (inv.sla_cotacao_medio > mediaGeralSla * 1.3) alerta = 'Gargalo Crítico nesta Investida';
        else if (inv.sla_cotacao_medio <= mediaGeralSla * 0.7) alerta = 'Excelente Performance';
      }
      return { ...inv, taxa_conformidade_pct: taxaConf, alerta };
    });

    // 4. Performance por Modalidade de Compra
    const modalidadesRaw = db.prepare(`
      SELECT 
        CASE 
          WHEN tipo_compra = 'SPOT_MATERIAIS' THEN 'Spot Materiais'
          WHEN tipo_compra = 'SPOT_SERVICOS' THEN 'Spot Serviços'
          WHEN tipo_compra = 'ESTRATEGICA' THEN 'Estratégico'
          ELSE tipo_compra
        END as modalidade,
        tipo_compra,
        COUNT(*) as total,
        SUM(CASE WHEN numero_solicitacao LIKE 'PC%' OR status_nome IN ('Encerrado', 'Pedido Enviado', 'Aguardando entrega', 'Aguardando Entrega') OR data_finalizacao IS NOT NULL THEN 1 ELSE 0 END) as concluidas,
        SUM(CASE WHEN (numero_solicitacao NOT LIKE 'PC%' OR numero_solicitacao IS NULL) AND status_nome NOT IN ('Encerrado', 'Cancelado', 'Pedido Enviado', 'Aguardando entrega', 'Aguardando Entrega') AND LOWER(status_nome) NOT LIKE '%entrega%' THEN 1 ELSE 0 END) as backlog,
        ROUND(COALESCE(AVG(CASE WHEN dias_atendimento_sla IS NOT NULL AND dias_atendimento_sla >= 0 THEN dias_atendimento_sla END), 0), 1) as sla_medio,
        SUM(CASE WHEN dentro_sla IS NOT NULL THEN 1 ELSE 0 END) as com_sla,
        SUM(CASE WHEN dentro_sla = 1 THEN 1 ELSE 0 END) as dentro_sla_count
      FROM solicitacao_organizer
      ${clause} AND comprador = ?
      GROUP BY tipo_compra
      ORDER BY total DESC
    `).all(...params, comprador);

    const modalidades = modalidadesRaw.map(m => ({
      ...m,
      taxa_conformidade_pct: m.com_sla > 0 ? parseFloat(((m.dentro_sla_count / m.com_sla) * 100).toFixed(1)) : 0
    }));

    // 5. Lista de Requisições / Chamados com filtros aplicados
    const chamadosEmAberto = db.prepare(`
      SELECT 
        id,
        numero_solicitacao,
        status_nome,
        investida_nome,
        unidade_nome,
        departamento,
        comprador,
        categoria,
        tipo_compra,
        fornecedor_vencedor,
        valor_menor_cotado,
        valor_final_negociado,
        saving_operacional,
        saving_percentual,
        CASE 
          WHEN tipo_compra = 'ESTRATEGICA' THEN 'Estratégico'
          WHEN tipo_compra = 'SPOT_SERVICOS' THEN 'Spot Serviços'
          ELSE 'Spot Materiais'
        END as modalidade_compra,
        CASE 
          WHEN tipo_compra = 'ESTRATEGICA' THEN 45
          WHEN tipo_compra = 'SPOT_SERVICOS' THEN 15
          ELSE 10
        END as meta_sla_dias,
        dias_atendimento_sla,
        CASE 
          WHEN data_criacao IS NOT NULL THEN
            MAX(0, CAST(ROUND(JULIANDAY('now', 'localtime') - JULIANDAY(data_criacao)) AS INT))
          ELSE 0
        END as aging_dias,
        dentro_sla,
        data_criacao,
        data_aprovacao,
        data_cotacao,
        data_aprovacao_pedido,
        data_finalizacao,
        data_entrega_prevista
      FROM solicitacao_organizer
      ${filterClause}
      ORDER BY 
        CASE WHEN numero_solicitacao LIKE 'PC%' OR status_nome IN ('Encerrado', 'Pedido Enviado', 'Aguardando entrega', 'Aguardando Entrega') OR data_finalizacao IS NOT NULL THEN 1 ELSE 0 END,
        aging_dias DESC
      LIMIT 150
    `).all(...filterParams);

    // Listas distintas de filtros para este comprador
    const investidasComprador = ['todas', ...investidasRaw.map(i => i.investida)];
    const tiposComprador = [
      { id: 'todos', label: 'Todos os Tipos' },
      { id: 'SPOT_MATERIAIS', label: 'Spot Materiais (10d)' },
      { id: 'SPOT_SERVICOS', label: 'Spot Serviços (15d)' },
      { id: 'ESTRATEGICA', label: 'Estratégico (45d)' }
    ];

    return {
      comprador,
      periodo: periodName,
      filtrosAtivos: {
        investida: investida || 'todas',
        tipoCompra: tipoCompra || 'todos'
      },
      opcoesFiltros: {
        investidas: investidasComprador,
        tiposCompra: tiposComprador
      },
      resumoGeral,
      resumo: resumoFiltrado,
      porInvestida: investidas,
      porModalidade: modalidades,
      chamadosEmAberto
    };
  }

  /**
   * 3. Workflow, Aging e Alertas de Gargalos
   */
  async getWorkflowAndBacklog({ mode = 'ytd', month = 'jul', year = 2026 } = {}) {
    const db = getDatabase();
    const { clause, params, periodName } = this.buildPeriodFilter(mode, month, year);
    const backlogWhere = `${clause} AND status_nome NOT IN ('Encerrado', 'Cancelado', 'Pedido Enviado', 'Aguardando Entrega', 'Aguardando entrega') AND LOWER(status_nome) NOT LIKE '%entrega%'`;

    const agingRow = db.prepare(`
      SELECT 
        SUM(CASE WHEN (JULIANDAY('now') - JULIANDAY(COALESCE(data_criacao, CURRENT_TIMESTAMP))) <= 3 THEN 1 ELSE 0 END) as faixa_0_3,
        SUM(CASE WHEN (JULIANDAY('now') - JULIANDAY(COALESCE(data_criacao, CURRENT_TIMESTAMP))) > 3 AND (JULIANDAY('now') - JULIANDAY(COALESCE(data_criacao, CURRENT_TIMESTAMP))) <= 7 THEN 1 ELSE 0 END) as faixa_4_7,
        SUM(CASE WHEN (JULIANDAY('now') - JULIANDAY(COALESCE(data_criacao, CURRENT_TIMESTAMP))) > 7 AND (JULIANDAY('now') - JULIANDAY(COALESCE(data_criacao, CURRENT_TIMESTAMP))) <= 15 THEN 1 ELSE 0 END) as faixa_8_15,
        SUM(CASE WHEN (JULIANDAY('now') - JULIANDAY(COALESCE(data_criacao, CURRENT_TIMESTAMP))) > 15 AND (JULIANDAY('now') - JULIANDAY(COALESCE(data_criacao, CURRENT_TIMESTAMP))) <= 30 THEN 1 ELSE 0 END) as faixa_16_30,
        SUM(CASE WHEN (JULIANDAY('now') - JULIANDAY(COALESCE(data_criacao, CURRENT_TIMESTAMP))) > 30 THEN 1 ELSE 0 END) as faixa_maior_30,
        COUNT(*) as total_backlog
      FROM solicitacao_organizer
      ${backlogWhere}
    `).get(...params);

    const totalBacklog = agingRow?.total_backlog || 1;

    const agingBuckets = [
      { label: '0 a 3 dias', chave: '0-3d', count: agingRow?.faixa_0_3 || 0, color: '#10B981', pct: (((agingRow?.faixa_0_3 || 0) / totalBacklog) * 100).toFixed(1) },
      { label: '4 a 7 dias', chave: '4-7d', count: agingRow?.faixa_4_7 || 0, color: '#59B3E6', pct: (((agingRow?.faixa_4_7 || 0) / totalBacklog) * 100).toFixed(1) },
      { label: '8 a 15 dias', chave: '8-15d', count: agingRow?.faixa_8_15 || 0, color: '#F59E0B', pct: (((agingRow?.faixa_8_15 || 0) / totalBacklog) * 100).toFixed(1) },
      { label: '16 a 30 dias', chave: '16-30d', count: agingRow?.faixa_16_30 || 0, color: '#EF4444', pct: (((agingRow?.faixa_16_30 || 0) / totalBacklog) * 100).toFixed(1) },
      { label: '> 30 dias (Crítico)', chave: '>30d', count: agingRow?.faixa_maior_30 || 0, color: '#991B1B', pct: (((agingRow?.faixa_maior_30 || 0) / totalBacklog) * 100).toFixed(1) }
    ];

    const sampleBacklog = db.prepare(`
      SELECT 
        id,
        numero_solicitacao,
        status_nome,
        investida_nome,
        comprador,
        categoria,
        tipo_compra,
        CASE 
          WHEN tipo_compra = 'ESTRATEGICA' THEN 'Estratégico'
          WHEN tipo_compra = 'SPOT_SERVICOS' THEN 'Spot Serviços'
          ELSE 'Spot Materiais'
        END as modalidade_compra,
        CASE 
          WHEN tipo_compra = 'ESTRATEGICA' THEN 45
          WHEN tipo_compra = 'SPOT_SERVICOS' THEN 15
          ELSE 10
        END as meta_sla_dias,
        dias_atendimento_sla,
        CASE 
          WHEN data_criacao IS NOT NULL THEN
            MAX(0, CAST(ROUND(JULIANDAY('now', 'localtime') - JULIANDAY(data_criacao)) AS INT))
          ELSE 0
        END as aging_dias,
        dentro_sla,
        data_criacao,
        data_finalizacao
      FROM solicitacao_organizer
      ${backlogWhere}
      ORDER BY aging_dias DESC
      LIMIT 40
    `).all(...params);

    return {
      periodo: periodName,
      totalBacklog: agingRow?.total_backlog || 0,
      agingBuckets,
      chamadosPendentes: sampleBacklog
    };
  }

  /**
   * 4. Demanda e Benchmark por Investida
   */
  async getInvestidasBreakdown({ mode = 'ytd', month = 'jul', year = 2026, sort = 'sla' } = {}) {
    const db = getDatabase();
    const { clause, params, periodName } = this.buildPeriodFilter(mode, month, year);

    let rows = db.prepare(`
      SELECT 
        investida_nome as investida,
        COUNT(*) as total_solicitacoes,
        SUM(CASE WHEN LOWER(status_nome) LIKE '%cota%' THEN 1 ELSE 0 END) as backlog_ativo,
        SUM(CASE WHEN tipo_compra IN ('SPOT_MATERIAIS', 'SPOT_SERVICOS') THEN 1 ELSE 0 END) as qtd_spot,
        SUM(CASE WHEN tipo_compra = 'SPOT_MATERIAIS' THEN 1 ELSE 0 END) as qtd_spot_mat,
        SUM(CASE WHEN tipo_compra = 'SPOT_SERVICOS' THEN 1 ELSE 0 END) as qtd_spot_serv,
        SUM(CASE WHEN tipo_compra = 'ESTRATEGICA' THEN 1 ELSE 0 END) as qtd_estrategica,
        ROUND(COALESCE(AVG(CASE WHEN dias_atendimento_sla IS NOT NULL AND dias_atendimento_sla >= 0 THEN dias_atendimento_sla END), 0), 1) as sla_cotacao_medio,
        SUM(CASE WHEN dentro_sla IS NOT NULL THEN 1 ELSE 0 END) as com_sla,
        SUM(CASE WHEN dentro_sla = 1 THEN 1 ELSE 0 END) as dentro_sla_count,
        COUNT(DISTINCT comprador) as compradores_envolvidos
      FROM solicitacao_organizer
      ${clause}
      GROUP BY investida_nome
      ORDER BY total_solicitacoes DESC
    `).all(...params);

    rows = rows.map(r => ({
      ...r,
      taxa_conformidade_pct: r.com_sla > 0 ? parseFloat(((r.dentro_sla_count / r.com_sla) * 100).toFixed(1)) : 0
    }));

    if (sort === 'sla') rows.sort((a, b) => b.taxa_conformidade_pct - a.taxa_conformidade_pct);
    else if (sort === 'tempo') rows.sort((a, b) => a.sla_cotacao_medio - b.sla_cotacao_medio);
    else if (sort === 'volume') rows.sort((a, b) => b.total_solicitacoes - a.total_solicitacoes);
    else if (sort === 'backlog') rows.sort((a, b) => b.backlog_ativo - a.backlog_ativo);

    return {
      periodo: periodName,
      investidas: rows
    };
  }

  /**
   * 4.1 Drilldown da Investida
   */
  async getInvestidaDetail({ investida, mode = 'ytd', month = 'jul', year = 2026 } = {}) {
    const db = getDatabase();
    if (!investida) throw new Error('Nome da investida é obrigatório');

    const { clause, params, periodName } = this.buildPeriodFilter(mode, month, year);

    const resumo = db.prepare(`
      SELECT 
        investida_nome as investida,
        COUNT(*) as total_solicitacoes,
        SUM(CASE WHEN (numero_solicitacao NOT LIKE 'PC%' OR numero_solicitacao IS NULL) AND status_nome NOT IN ('Encerrado', 'Cancelado', 'Pedido Enviado', 'Aguardando entrega', 'Aguardando Entrega') AND LOWER(status_nome) NOT LIKE '%entrega%' THEN 1 ELSE 0 END) as backlog_ativo,
        SUM(CASE WHEN tipo_compra IN ('SPOT_MATERIAIS', 'SPOT_SERVICOS') THEN 1 ELSE 0 END) as qtd_spot,
        SUM(CASE WHEN tipo_compra = 'ESTRATEGICA' THEN 1 ELSE 0 END) as qtd_estrategica,
        ROUND(COALESCE(AVG(CASE WHEN dias_atendimento_sla IS NOT NULL AND dias_atendimento_sla >= 0 THEN dias_atendimento_sla END), 0), 1) as sla_cotacao_medio,
        SUM(CASE WHEN dentro_sla IS NOT NULL THEN 1 ELSE 0 END) as com_sla,
        SUM(CASE WHEN dentro_sla = 1 THEN 1 ELSE 0 END) as dentro_sla_count
      FROM solicitacao_organizer
      ${clause} AND investida_nome = ?
    `).get(...params, investida);

    if (resumo) {
      resumo.taxa_conformidade_pct = resumo.com_sla > 0 ? parseFloat(((resumo.dentro_sla_count / resumo.com_sla) * 100).toFixed(1)) : 0;
    }

    const compradores = db.prepare(`
      SELECT 
        comprador,
        COUNT(*) as total_solicitacoes,
        SUM(CASE WHEN (numero_solicitacao NOT LIKE 'PC%' OR numero_solicitacao IS NULL) AND status_nome NOT IN ('Encerrado', 'Cancelado', 'Pedido Enviado', 'Aguardando entrega', 'Aguardando Entrega') AND LOWER(status_nome) NOT LIKE '%entrega%' THEN 1 ELSE 0 END) as backlog_ativo,
        SUM(CASE WHEN tipo_compra IN ('SPOT_MATERIAIS', 'SPOT_SERVICOS') THEN 1 ELSE 0 END) as qtd_spot,
        SUM(CASE WHEN tipo_compra = 'SPOT_MATERIAIS' THEN 1 ELSE 0 END) as qtd_spot_mat,
        SUM(CASE WHEN tipo_compra = 'SPOT_SERVICOS' THEN 1 ELSE 0 END) as qtd_spot_serv,
        SUM(CASE WHEN tipo_compra = 'ESTRATEGICA' THEN 1 ELSE 0 END) as qtd_estrategica,
        ROUND(COALESCE(AVG(CASE WHEN dias_atendimento_sla IS NOT NULL AND dias_atendimento_sla >= 0 THEN dias_atendimento_sla END), 0), 1) as sla_cotacao_medio,
        SUM(CASE WHEN dentro_sla IS NOT NULL THEN 1 ELSE 0 END) as com_sla,
        SUM(CASE WHEN dentro_sla = 1 THEN 1 ELSE 0 END) as dentro_sla_count
      FROM solicitacao_organizer
      ${clause} AND investida_nome = ? AND comprador IS NOT NULL
      GROUP BY comprador
      ORDER BY total_solicitacoes DESC
    `).all(...params, investida);

    const compradoresWithPct = compradores.map(c => ({
      ...c,
      taxa_conformidade_pct: c.com_sla > 0 ? parseFloat(((c.dentro_sla_count / c.com_sla) * 100).toFixed(1)) : 0
    }));

    // Backlog de requisições ativas/críticas em cotação da investida
    const chamadosRaw = db.prepare(`
      SELECT 
        id,
        numero_solicitacao,
        data_criacao,
        data_cotacao,
        data_finalizacao,
        status_nome,
        comprador,
        categoria,
        tipo_compra,
        dias_atendimento_sla,
        dentro_sla,
        CASE 
          WHEN data_cotacao IS NOT NULL AND data_cotacao != '' THEN (julianday('now', 'localtime') - julianday(data_cotacao))
          ELSE (julianday('now', 'localtime') - julianday(data_criacao))
        END as aging_dias
      FROM solicitacao_organizer
      ${clause} AND investida_nome = ? AND LOWER(status_nome) LIKE '%cota%'
      ORDER BY aging_dias DESC
      LIMIT 100
    `).all(...params, investida);

    const chamados = chamadosRaw.map(row => {
      let metaSla = METAS_OPERACIONAIS.SPOT_MATERIAIS_DIAS;
      let modalidade = 'Spot Materiais';
      if (row.tipo_compra === 'ESTRATEGICA') {
        metaSla = METAS_OPERACIONAIS.ESTRATEGICA_DIAS;
        modalidade = 'Estratégico';
      } else if (row.tipo_compra === 'SPOT_SERVICOS') {
        metaSla = METAS_OPERACIONAIS.SPOT_SERVICOS_DIAS;
        modalidade = 'Spot Serviços';
      }

      const aging = Math.max(0, row.aging_dias || 0);
      const diasRestantes = metaSla - aging;

      let nivelUrgencia = 'no_prazo';
      let labelUrgencia = 'No Prazo';
      if (diasRestantes < 0) {
        nivelUrgencia = 'vencido';
        labelUrgencia = `Estourado (+${Math.abs(Math.round(diasRestantes))}d)`;
      } else if (diasRestantes <= 1) {
        nivelUrgencia = 'critico_24h';
        labelUrgencia = 'Crítico (< 24h)';
      } else if (diasRestantes <= 3) {
        nivelUrgencia = 'alerta_72h';
        labelUrgencia = 'Alerta (24h-72h)';
      }

      return {
        ...row,
        meta_sla_dias: metaSla,
        modalidade_compra: modalidade,
        dias_restantes: diasRestantes,
        nivel_urgencia: nivelUrgencia,
        label_urgencia: labelUrgencia
      };
    });

    return {
      investida,
      periodo: periodName,
      resumo,
      compradores: compradoresWithPct,
      chamados
    };
  }

  /**
   * 5. Segmentação por Categoria
   */
  async getCategoriasBreakdown({ mode = 'ytd', month = 'jul', year = 2026, sort = 'volume' } = {}) {
    const db = getDatabase();
    const { clause, params, periodName } = this.buildPeriodFilter(mode, month, year);
    const catWhere = `${clause} AND categoria IS NOT NULL AND TRIM(categoria) != ''`;

    let rows = db.prepare(`
      SELECT 
        categoria,
        COUNT(*) as total_solicitacoes,
        SUM(CASE WHEN LOWER(status_nome) LIKE '%cota%' THEN 1 ELSE 0 END) as backlog_ativo,
        ROUND(COALESCE(AVG(CASE WHEN dias_atendimento_sla IS NOT NULL AND dias_atendimento_sla >= 0 THEN dias_atendimento_sla END), 0), 1) as sla_cotacao_medio,
        SUM(CASE WHEN dentro_sla IS NOT NULL THEN 1 ELSE 0 END) as com_sla,
        SUM(CASE WHEN dentro_sla = 1 THEN 1 ELSE 0 END) as dentro_sla_count,
        SUM(CASE WHEN tipo_compra = 'SPOT_MATERIAIS' THEN 1 ELSE 0 END) as qtd_spot_materiais,
        SUM(CASE WHEN tipo_compra = 'SPOT_SERVICOS' THEN 1 ELSE 0 END) as qtd_spot_servicos,
        SUM(CASE WHEN tipo_compra = 'ESTRATEGICA' THEN 1 ELSE 0 END) as qtd_estrategica
      FROM solicitacao_organizer
      ${catWhere}
      GROUP BY categoria
    `).all(...params);

    const mapped = rows.map(r => {
      const taxaConf = r.com_sla > 0 ? parseFloat(((r.dentro_sla_count / r.com_sla) * 100).toFixed(1)) : 0;
      let modalidade = 'Spot Materiais';
      let metaSla = METAS_OPERACIONAIS.SPOT_MATERIAIS_DIAS;

      if ((r.qtd_estrategica || 0) > (r.qtd_spot_materiais || 0) && (r.qtd_estrategica || 0) > (r.qtd_spot_servicos || 0)) {
        modalidade = 'Estratégico';
        metaSla = METAS_OPERACIONAIS.ESTRATEGICA_DIAS;
      } else if ((r.qtd_spot_servicos || 0) > (r.qtd_spot_materiais || 0)) {
        modalidade = 'Spot Serviços';
        metaSla = METAS_OPERACIONAIS.SPOT_SERVICOS_DIAS;
      }

      const dentroMeta = (r.sla_cotacao_medio || 0) <= metaSla;
      const gapMeta = parseFloat(((r.sla_cotacao_medio || 0) - metaSla).toFixed(1));

      return {
        ...r,
        taxa_conformidade_pct: taxaConf,
        modalidade,
        meta_sla: metaSla,
        dentro_meta: dentroMeta,
        gap_meta: gapMeta,
        qtd_spot: (r.qtd_spot_materiais || 0) + (r.qtd_spot_servicos || 0)
      };
    });

    const sortedBySlow = [...mapped].sort((a, b) => b.sla_cotacao_medio - a.sla_cotacao_medio);
    const sortedByFast = [...mapped].filter(c => c.total_solicitacoes >= 10).sort((a, b) => a.sla_cotacao_medio - b.sla_cotacao_medio);
    const sortedByVol = [...mapped].sort((a, b) => b.total_solicitacoes - a.total_solicitacoes);
    const sortedByBacklog = [...mapped].sort((a, b) => b.backlog_ativo - a.backlog_ativo);

    const destaquesCategorias = {
      maisLenta: sortedBySlow[0] || mapped[0],
      maisAgil: sortedByFast[0] || mapped[0],
      maiorVolume: sortedByVol[0] || mapped[0],
      maiorBacklog: sortedByBacklog[0] || mapped[0]
    };

    if (sort === 'volume') mapped.sort((a, b) => b.total_solicitacoes - a.total_solicitacoes);
    else if (sort === 'sla') mapped.sort((a, b) => b.sla_cotacao_medio - a.sla_cotacao_medio);
    else if (sort === 'leadtime') mapped.sort((a, b) => b.sla_cotacao_medio - a.sla_cotacao_medio);
    else if (sort === 'backlog') mapped.sort((a, b) => b.backlog_ativo - a.backlog_ativo);

    return {
      periodo: periodName,
      metasOficiais: {
        spotMateriais: { dias: 10, label: 'Spot Materiais', desc: 'Contratações pontuais abaixo de R$ 50k' },
        spotServicos: { dias: 15, label: 'Spot Serviços', desc: 'Manutenção, Facilities, Obras e Operações' },
        estrategico: { dias: 45, label: 'Estratégico', desc: 'Contratações estruturadas e de maior complexidade' }
      },
      destaques: destaquesCategorias,
      categorias: mapped
    };
  }

  /**
   * 5.1 Drilldown da Categoria
   */
  async getCategoriaDetail({ categoria, mode = 'ytd', month = 'ago', year = 2026 } = {}) {
    const db = getDatabase();
    if (!categoria) throw new Error('Categoria é obrigatória');

    const { clause, params, periodName } = this.buildPeriodFilter(mode, month, year);

    const resumo = db.prepare(`
      SELECT 
        categoria,
        COUNT(*) as total_solicitacoes,
        SUM(CASE WHEN LOWER(status_nome) NOT LIKE '%cota%' AND LOWER(status_nome) NOT LIKE '%solicita%' AND LOWER(status_nome) NOT LIKE '%triagem%' AND status_nome != 'Cancelado' THEN 1 ELSE 0 END) as total_atendidas,
        SUM(CASE WHEN LOWER(status_nome) LIKE '%cota%' THEN 1 ELSE 0 END) as backlog_ativo,
        ROUND(COALESCE(AVG(CASE WHEN dias_atendimento_sla IS NOT NULL AND dias_atendimento_sla >= 0 THEN dias_atendimento_sla END), 0), 1) as sla_cotacao_medio,
        SUM(CASE WHEN dentro_sla IS NOT NULL THEN 1 ELSE 0 END) as com_sla,
        SUM(CASE WHEN dentro_sla = 1 THEN 1 ELSE 0 END) as dentro_sla_count
      FROM solicitacao_organizer
      ${clause} AND categoria = ?
    `).get(...params, categoria);

    if (resumo) {
      resumo.taxa_conformidade_pct = resumo.com_sla > 0 ? parseFloat(((resumo.dentro_sla_count / resumo.com_sla) * 100).toFixed(1)) : 0;

      const mixRow = db.prepare(`
        SELECT 
          SUM(CASE WHEN tipo_compra = 'SPOT_MATERIAIS' THEN 1 ELSE 0 END) as spot_mat,
          SUM(CASE WHEN tipo_compra = 'SPOT_SERVICOS' THEN 1 ELSE 0 END) as spot_serv,
          SUM(CASE WHEN tipo_compra = 'ESTRATEGICA' THEN 1 ELSE 0 END) as estrategica
        FROM solicitacao_organizer
        ${clause} AND categoria = ?
      `).get(...params, categoria);

      resumo.mix = {
        spotMateriais: mixRow?.spot_mat || 0,
        spotServicos: mixRow?.spot_serv || 0,
        estrategica: mixRow?.estrategica || 0,
        spot: (mixRow?.spot_mat || 0) + (mixRow?.spot_serv || 0)
      };

      if ((resumo.mix.estrategica) > (resumo.mix.spotMateriais) && (resumo.mix.estrategica) > (resumo.mix.spotServicos)) {
        resumo.modalidade = 'Estratégico';
        resumo.meta_sla_dias = 45;
      } else if (resumo.mix.spotServicos > resumo.mix.spotMateriais) {
        resumo.modalidade = 'Spot Serviços';
        resumo.meta_sla_dias = 15;
      } else {
        resumo.modalidade = 'Spot Materiais';
        resumo.meta_sla_dias = 10;
      }
    }

    const investidasRaw = db.prepare(`
      SELECT 
        investida_nome as investida,
        COUNT(*) as total_solicitacoes,
        SUM(CASE WHEN LOWER(status_nome) LIKE '%cota%' THEN 1 ELSE 0 END) as backlog_ativo,
        ROUND(COALESCE(AVG(CASE WHEN dias_atendimento_sla IS NOT NULL AND dias_atendimento_sla >= 0 THEN dias_atendimento_sla END), 0), 1) as sla_cotacao_medio,
        SUM(CASE WHEN dentro_sla IS NOT NULL THEN 1 ELSE 0 END) as com_sla,
        SUM(CASE WHEN dentro_sla = 1 THEN 1 ELSE 0 END) as dentro_sla_count
      FROM solicitacao_organizer
      ${clause} AND categoria = ?
      GROUP BY investida_nome
      ORDER BY total_solicitacoes DESC
    `).all(...params, categoria);

    const porInvestida = investidasRaw.map(inv => ({
      ...inv,
      taxa_conformidade_pct: inv.com_sla > 0 ? parseFloat(((inv.dentro_sla_count / inv.com_sla) * 100).toFixed(1)) : 0
    }));

    const compradoresRaw = db.prepare(`
      SELECT 
        comprador,
        COUNT(*) as total_solicitacoes,
        SUM(CASE WHEN LOWER(status_nome) LIKE '%cota%' THEN 1 ELSE 0 END) as backlog_ativo,
        ROUND(COALESCE(AVG(CASE WHEN dias_atendimento_sla IS NOT NULL AND dias_atendimento_sla >= 0 THEN dias_atendimento_sla END), 0), 1) as sla_cotacao_medio,
        SUM(CASE WHEN dentro_sla IS NOT NULL THEN 1 ELSE 0 END) as com_sla,
        SUM(CASE WHEN dentro_sla = 1 THEN 1 ELSE 0 END) as dentro_sla_count
      FROM solicitacao_organizer
      ${clause} AND categoria = ? AND comprador IS NOT NULL AND TRIM(comprador) != ''
      GROUP BY comprador
      ORDER BY total_solicitacoes DESC
    `).all(...params, categoria);

    const porComprador = compradoresRaw.map(comp => ({
      ...comp,
      taxa_conformidade_pct: comp.com_sla > 0 ? parseFloat(((comp.dentro_sla_count / comp.com_sla) * 100).toFixed(1)) : 0
    }));

    const chamados = db.prepare(`
      SELECT 
        id,
        numero_solicitacao,
        status_nome,
        investida_nome,
        unidade_nome,
        departamento,
        comprador,
        categoria,
        tipo_compra,
        fornecedor_vencedor,
        valor_menor_cotado,
        valor_final_negociado,
        saving_operacional,
        saving_percentual,
        CASE 
          WHEN tipo_compra = 'ESTRATEGICA' THEN 'Estratégico'
          WHEN tipo_compra = 'SPOT_SERVICOS' THEN 'Spot Serviços'
          ELSE 'Spot Materiais'
        END as modalidade_compra,
        CASE 
          WHEN tipo_compra = 'ESTRATEGICA' THEN 45
          WHEN tipo_compra = 'SPOT_SERVICOS' THEN 15
          ELSE 10
        END as meta_sla_dias,
        dias_atendimento_sla,
        CASE 
          WHEN data_criacao IS NOT NULL THEN
            MAX(0, CAST(ROUND(JULIANDAY('now', 'localtime') - JULIANDAY(data_criacao)) AS INT))
          ELSE 0
        END as aging_dias,
        dentro_sla,
        data_criacao,
        data_aprovacao,
        data_cotacao,
        data_aprovacao_pedido,
        data_finalizacao,
        data_entrega_prevista
      FROM solicitacao_organizer
      ${clause} AND categoria = ?
      ORDER BY aging_dias DESC
    `).all(...params, categoria);

    return {
      categoria,
      periodo: periodName,
      resumo,
      porInvestida,
      porComprador,
      chamados
    };
  }

  /**
   * 6. RANKING OFICIAL DE SLA DOS COMPRADORES
   * Podium Top 3 + Tabela Completa de Classificação com Medalhas
   */
  async getRankingSla({ mode = 'ytd', month = 'ago', year = 2026, minVol = 0, sort = 'conformidade' } = {}) {
    const db = getDatabase();
    const { clause, params, periodName } = this.buildPeriodFilter(mode, month, year);

    const buyerWhere = `${clause} AND comprador IS NOT NULL AND TRIM(comprador) != '' AND comprador != 'Não informado'`;

    const rows = db.prepare(`
      SELECT 
        comprador,
        COUNT(*) as total_solicitacoes,
        SUM(CASE WHEN numero_solicitacao LIKE 'PC%' OR status_nome IN ('Pedido Enviado', 'Encerrado', 'Aguardando entrega', 'Aguardando Entrega') OR data_finalizacao IS NOT NULL THEN 1 ELSE 0 END) as total_atendidas,
        SUM(CASE WHEN (numero_solicitacao NOT LIKE 'PC%' OR numero_solicitacao IS NULL) AND status_nome NOT IN ('Encerrado', 'Cancelado', 'Pedido Enviado', 'Aguardando entrega', 'Aguardando Entrega') AND LOWER(status_nome) NOT LIKE '%entrega%' THEN 1 ELSE 0 END) as backlog_ativo,
        ROUND(COALESCE(AVG(CASE WHEN dias_atendimento_sla IS NOT NULL AND dias_atendimento_sla >= 0 THEN dias_atendimento_sla END), 0), 1) as sla_cotacao_medio,
        SUM(CASE WHEN dentro_sla IS NOT NULL THEN 1 ELSE 0 END) as com_sla,
        SUM(CASE WHEN dentro_sla = 1 THEN 1 ELSE 0 END) as dentro_sla_count,
        SUM(CASE WHEN tipo_compra = 'SPOT_MATERIAIS' THEN 1 ELSE 0 END) as qtd_spot_materiais,
        SUM(CASE WHEN tipo_compra = 'SPOT_SERVICOS' THEN 1 ELSE 0 END) as qtd_spot_servicos,
        SUM(CASE WHEN tipo_compra = 'ESTRATEGICA' THEN 1 ELSE 0 END) as qtd_estrategica,
        GROUP_CONCAT(DISTINCT investida_nome) as investidas_atendidas
      FROM solicitacao_organizer
      ${buyerWhere}
      GROUP BY comprador
      HAVING total_solicitacoes >= ?
    `).all(...params, minVol);

    const totalGeral = rows.reduce((s, r) => s + r.total_solicitacoes, 0) || 1;

    let ranking = rows.map(b => {
      const taxaConf = b.com_sla > 0 ? parseFloat(((b.dentro_sla_count / b.com_sla) * 100).toFixed(1)) : 0;

      let badgeNivel = 'normal';
      let statusLabel = 'Na Média';
      if (taxaConf >= 85 && b.sla_cotacao_medio <= 8) {
        badgeNivel = 'ouro';
        statusLabel = '🌟 Alta Eficiência';
      } else if (taxaConf >= 80) {
        badgeNivel = 'prata';
        statusLabel = '✨ Bom Desempenho';
      } else if (taxaConf < 60 || b.sla_cotacao_medio > 20) {
        badgeNivel = 'critico';
        statusLabel = '⚠️ Atenção SLA';
      }

      return {
        comprador: b.comprador,
        total_solicitacoes: b.total_solicitacoes,
        total_atendidas: b.total_atendidas,
        backlog_ativo: b.backlog_ativo,
        sla_cotacao_medio: b.sla_cotacao_medio || 0,
        taxa_conformidade_pct: taxaConf,
        dentro_sla_count: b.dentro_sla_count,
        com_sla: b.com_sla,
        mix: {
          spotMateriais: b.qtd_spot_materiais || 0,
          spotServicos: b.qtd_spot_servicos || 0,
          estrategica: b.qtd_estrategica || 0
        },
        investidas: b.investidas_atendidas || 'Geral',
        badgeNivel,
        statusLabel
      };
    });

    // Ordenação canônica do ranking
    if (sort === 'conformidade') {
      ranking.sort((a, b) => b.taxa_conformidade_pct - a.taxa_conformidade_pct || a.sla_cotacao_medio - b.sla_cotacao_medio);
    } else if (sort === 'sla') {
      ranking.sort((a, b) => a.sla_cotacao_medio - b.sla_cotacao_medio || b.taxa_conformidade_pct - a.taxa_conformidade_pct);
    } else if (sort === 'volume') {
      ranking.sort((a, b) => b.total_solicitacoes - a.total_solicitacoes);
    } else if (sort === 'backlog') {
      ranking.sort((a, b) => b.backlog_ativo - a.backlog_ativo);
    }

    // Atribuir posições
    ranking = ranking.map((item, idx) => ({
      posicao: idx + 1,
      ...item
    }));

    const podium = {
      primeiro: ranking[0] || null,
      segundo: ranking[1] || null,
      terceiro: ranking[2] || null
    };

    return {
      periodo: periodName,
      totalCompradores: ranking.length,
      podium,
      ranking
    };
  }

  /**
   * 7. RADAR PREDITIVO DE SLA (PRÓXIMOS AO VENCIMENTO & ESTOURADOS)
   * Acompanha chamados ativos em tempo real com contagem regressiva
   */
  async getAlertasSla({ mode = 'ytd', month = 'ago', year = 2026, urgencia = 'todos', comprador = '', investida = '' } = {}) {
    const db = getDatabase();
    const { clause, params, periodName } = this.buildPeriodFilter(mode, month, year);

    // Filtra apenas chamados que estão ATIVAMENTE em Cotação com Compras
    let activeWhere = `${clause} AND LOWER(status_nome) LIKE '%cota%' AND status_nome NOT IN ('Encerrado', 'Cancelado', 'Pedido Enviado', 'Aguardando Entrega')`;
    const extraParams = [];

    if (comprador && comprador.trim() !== '') {
      activeWhere += ' AND comprador = ?';
      extraParams.push(comprador);
    }
    if (investida && investida.trim() !== '') {
      activeWhere += ' AND investida_nome = ?';
      extraParams.push(investida);
    }

    const query = `
      SELECT 
        id,
        numero_solicitacao,
        status_nome,
        investida_nome,
        comprador,
        categoria,
        tipo_compra,
        data_criacao,
        data_cotacao,
        CASE 
          WHEN tipo_compra = 'ESTRATEGICA' THEN 45.0
          WHEN tipo_compra = 'SPOT_SERVICOS' THEN 15.0
          ELSE 10.0
        END as meta_sla_dias,
        CASE 
          WHEN COALESCE(data_cotacao, data_criacao) IS NOT NULL THEN
            MAX(0, CAST(ROUND(JULIANDAY('now', 'localtime') - JULIANDAY(COALESCE(data_cotacao, data_criacao))) AS INT))
          ELSE 0
        END as aging_dias
      FROM solicitacao_organizer
      ${activeWhere}
      ORDER BY aging_dias DESC
    `;

    const rawRows = db.prepare(query).all(...params, ...extraParams);

    let totalVencidos = 0;
    let totalCritico24h = 0;
    let totalAlerta72h = 0;
    let totalNoPrazo = 0;

    const chamados = rawRows.map(row => {
      const meta = row.meta_sla_dias || 10;
      const aging = row.aging_dias || 0;
      const diasRestantes = parseFloat((meta - aging).toFixed(1));

      let nivelUrgencia;
      let labelUrgencia;
      let corUrgencia;

      if (diasRestantes < 0) {
        nivelUrgencia = 'vencido';
        labelUrgencia = `🔴 Vencido há ${Math.abs(Math.round(diasRestantes))}d`;
        corUrgencia = 'var(--coral)';
        totalVencidos++;
      } else if (diasRestantes <= 1) {
        nivelUrgencia = 'critico_24h';
        labelUrgencia = `🟠 Vence em < 24h (${Math.round(diasRestantes * 24)}h)`;
        corUrgencia = '#F97316';
        totalCritico24h++;
      } else if (diasRestantes <= 3) {
        nivelUrgencia = 'alerta_72h';
        labelUrgencia = `🟡 Vence em ${Math.round(diasRestantes)} dias`;
        corUrgencia = 'var(--amber)';
        totalAlerta72h++;
      } else {
        nivelUrgencia = 'no_prazo';
        labelUrgencia = `🟢 No prazo (${Math.round(diasRestantes)}d restantes)`;
        corUrgencia = 'var(--emerald)';
        totalNoPrazo++;
      }

      let modalidadeFormatada = 'Spot Materiais';
      if (row.tipo_compra === 'SPOT_SERVICOS') modalidadeFormatada = 'Spot Serviços';
      else if (row.tipo_compra === 'ESTRATEGICA') modalidadeFormatada = 'Estratégico';

      return {
        ...row,
        modalidade_compra: modalidadeFormatada,
        dias_restantes: diasRestantes,
        nivel_urgencia: nivelUrgencia,
        label_urgencia: labelUrgencia,
        cor_urgencia: corUrgencia
      };
    });

    let chamadosFiltrados = chamados;
    if (urgencia && urgencia !== 'todos') {
      chamadosFiltrados = chamados.filter(c => c.nivel_urgencia === urgencia);
    }

    // Top Compradores com mais itens em risco (vencidos + críticos)
    const buyerRiskMap = {};
    chamados.filter(c => ['vencido', 'critico_24h', 'alerta_72h'].includes(c.nivel_urgencia)).forEach(c => {
      const name = c.comprador || 'Não Atribuído';
      if (!buyerRiskMap[name]) buyerRiskMap[name] = { comprador: name, totalRisco: 0, vencidos: 0, criticos: 0 };
      buyerRiskMap[name].totalRisco++;
      if (c.nivel_urgencia === 'vencido') buyerRiskMap[name].vencidos++;
      else buyerRiskMap[name].criticos++;
    });

    const topCompradoresRisco = Object.values(buyerRiskMap)
      .sort((a, b) => b.totalRisco - a.totalRisco)
      .slice(0, 5);

    // Top Investidas com mais itens em risco
    const invRiskMap = {};
    chamados.filter(c => ['vencido', 'critico_24h'].includes(c.nivel_urgencia)).forEach(c => {
      const inv = c.investida_nome || 'Geral';
      if (!invRiskMap[inv]) invRiskMap[inv] = { investida: inv, totalRisco: 0, vencidos: 0 };
      invRiskMap[inv].totalRisco++;
      if (c.nivel_urgencia === 'vencido') invRiskMap[inv].vencidos++;
    });

    const topInvestidasRisco = Object.values(invRiskMap)
      .sort((a, b) => b.totalRisco - a.totalRisco)
      .slice(0, 5);

    return {
      periodo: periodName,
      totais: {
        totalAtivos: chamados.length,
        vencidos: totalVencidos,
        critico24h: totalCritico24h,
        alerta72h: totalAlerta72h,
        noPrazo: totalNoPrazo,
        totalEmRisco: totalVencidos + totalCritico24h + totalAlerta72h
      },
      topCompradoresRisco,
      topInvestidasRisco,
      chamados: chamadosFiltrados
    };
  }

  /**
   * 8. LINHA DO TEMPO & AUDITORIA DETALHADA DA SOLICITAÇÃO (TIMELINE STEPPER)
   */
  async getSolicitationTimeline(idOrNumero) {
    const db = getDatabase();
    if (!idOrNumero) throw new Error('ID ou Número da solicitação é obrigatório');

    const solic = db.prepare(`
      SELECT 
        id,
        numero_solicitacao,
        status_nome,
        investida_nome,
        unidade_nome,
        departamento,
        comprador,
        categoria,
        tipo_compra,
        fornecedor_vencedor,
        valor_menor_cotado,
        valor_final_negociado,
        saving_operacional,
        saving_percentual,
        CASE 
          WHEN tipo_compra = 'ESTRATEGICA' THEN 'Estratégico'
          WHEN tipo_compra = 'SPOT_SERVICOS' THEN 'Spot Serviços'
          ELSE 'Spot Materiais'
        END as modalidade_compra,
        CASE 
          WHEN tipo_compra = 'ESTRATEGICA' THEN 45.0
          WHEN tipo_compra = 'SPOT_SERVICOS' THEN 15.0
          ELSE 10.0
        END as meta_sla_dias,
        dias_atendimento_sla,
        CASE 
          WHEN data_criacao IS NOT NULL THEN
            MAX(0, CAST(ROUND(JULIANDAY('now', 'localtime') - JULIANDAY(data_criacao)) AS INT))
          ELSE 0
        END as aging_dias,
        dentro_sla,
        data_criacao,
        data_aprovacao,
        data_cotacao,
        data_aprovacao_pedido,
        data_finalizacao,
        data_entrega_prevista
      FROM solicitacao_organizer
      WHERE id = ? OR numero_solicitacao = ?
      LIMIT 1
    `).get(idOrNumero, idOrNumero);

    if (!solic) {
      throw new Error('Solicitação não encontrada');
    }

    // Montar as 5 etapas estruturais com cálculo de intervalo entre elas
    const stages = [
      {
        id: 1,
        key: 'criacao',
        label: '1. Abertura da Solicitação',
        responsavel: solic.unidade_nome ? `Unidade ${solic.unidade_nome}` : 'Solicitante / Loja',
        data: solic.data_criacao || null,
        status: solic.data_criacao ? 'concluido' : 'pendente'
      },
      {
        id: 2,
        key: 'aprovacao_solicitacao',
        label: '2. Triagem & Aprovação da Requisição',
        responsavel: 'Gestor da Área / Planejamento',
        data: solic.data_aprovacao || null,
        status: solic.data_aprovacao ? 'concluido' : (solic.status_nome === 'Solicitação' ? 'em_andamento' : (solic.data_criacao ? 'pendente' : 'pendente'))
      },
      {
        id: 3,
        key: 'cotacao',
        label: '3. Envio e Negociação de Cotação',
        responsavel: solic.comprador || 'Comprador Responsável',
        data: solic.data_cotacao || null,
        status: solic.data_cotacao ? 'concluido' : (['Cotacao', 'Em Cotação', 'Validação Técnica'].includes(solic.status_nome) ? 'em_andamento' : 'pendente')
      },
      {
        id: 4,
        key: 'aprovacao_pedido',
        label: '4. Aprovação da Ordem de Compra',
        responsavel: 'Alçada Financeira / Diretoria',
        data: solic.data_aprovacao_pedido || null,
        status: solic.data_aprovacao_pedido ? 'concluido' : (['Aprovação', 'Em Aprovação'].includes(solic.status_nome) ? 'em_andamento' : 'pendente')
      },
      {
        id: 5,
        key: 'pedido_enviado',
        label: '5. Pedido Enviado / Conclusão',
        responsavel: solic.fornecedor_vencedor || 'Fornecedor Vencedor',
        data: solic.data_finalizacao || null,
        status: solic.data_finalizacao || ['Pedido Enviado', 'Encerrado'].includes(solic.status_nome) ? 'concluido' : 'pendente'
      }
    ];

    return {
      solicitacao: solic,
      stages
    };
  }
}

module.exports = new OperationalService();
