/* =====================================================================
   PLURIX PROCUREMENT - SERVIÇO DE INTEGRAÇÃO COM ORGANIZER (API)
   Consumo 100% DINÂMICO da API em tempo real (16 páginas / 15k+ registros)
   ===================================================================== */

const fs = require('fs');
const path = require('path');
const { getDatabase } = require('../database/db');

// Garantir carregamento do .env
function ensureEnv() {
  const envPath = path.join(__dirname, '..', '..', '.env');
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf8').split('\n');
    lines.forEach(line => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const idx = trimmed.indexOf('=');
        if (idx !== -1) {
          const key = trimmed.slice(0, idx).trim();
          const val = trimmed.slice(idx + 1).trim();
          process.env[key] = val;
        }
      }
    });
  }
}
ensureEnv();

class OrganizerService {
  constructor() {
    this.maxRetries = 2;
    this.timeoutMs = parseInt(process.env.ORGANIZER_TIMEOUT_MS || '45000', 10);
  }

  getApiUrl() {
    ensureEnv();
    return (process.env.ORGANIZER_API_URL || 'https://csd.organizer.com.br/organizer/modulos/solicitacao_compras/api/bi/dashboard_compras.php').trim();
  }

  getBearerToken() {
    ensureEnv();
    return (process.env.ORGANIZER_BEARER_TOKEN || '').trim();
  }

  getCookie() {
    ensureEnv();
    return (process.env.ORGANIZER_COOKIE || '').trim();
  }

  /**
   * Sincronização completa de chamados do Organizer diretamente via API REST
   */
  async syncOrganizerData({ dataInicio, dataFim, executadoPor = 'Usuário' } = {}) {
    const db = getDatabase();

    // 1. Registrar início da carga no histórico
    const insertCarga = db.prepare(`
      INSERT INTO historico_carga (
        tipo_carga, origem_arquivo, executado_por, status_carga
      ) VALUES (
        'API_ORGANIZER', 'Organizer API Live Request', ?, 'EM_PROCESSAMENTO'
      )
    `);
    const cargaInfo = insertCarga.run(executadoPor);
    const cargaId = cargaInfo.lastInsertRowid;

    console.log(`[OrganizerService] Iniciando chamada direta à API Organizer (Carga #${cargaId})...`);

    let totalRecebidos = 0;
    let totalValidos = 0;
    let totalRejeitados = 0;
    const errors = [];

    try {
      // 2. Obter primeira página da API remota
      const firstPage = await this.fetchOrganizerPage(1, { dataInicio, dataFim });

      let itemsPrimeiraPagina = [];
      let totalPages = 1;
      let totalRegistros = 0;

      if (firstPage && firstPage.dados) {
        itemsPrimeiraPagina = firstPage.dados;
        totalPages = firstPage?.paginacao?.total_pages || 1;
        totalRegistros = firstPage?.paginacao?.total || itemsPrimeiraPagina.length;
      } else if (Array.isArray(firstPage)) {
        itemsPrimeiraPagina = firstPage;
        totalRegistros = firstPage.length;
        totalPages = 1;
      }

      console.log(`[OrganizerService] API respondeu com sucesso! ${totalRegistros} registros previstos em ${totalPages} páginas.`);

      // 3. Limpar registros anteriores apenas após confirmar que a API respondeu
      db.prepare('DELETE FROM conciliacao').run();
      db.prepare('DELETE FROM solicitacao_organizer').run();

      // 4. Persistir primeira página
      const resP1 = this.persistPageRecords(itemsPrimeiraPagina, cargaId);
      totalRecebidos += resP1.recebidos;
      totalValidos += resP1.validos;
      totalRejeitados += resP1.rejeitados;

      // 5. Iterar pelas demais páginas da API (páginas 2 a totalPages)
      if (totalPages > 1) {
        for (let page = 2; page <= totalPages; page++) {
          try {
            console.log(`[OrganizerService] Buscando página ${page}/${totalPages}...`);
            const pageData = await this.fetchOrganizerPage(page, { dataInicio, dataFim });
            const pageItems = Array.isArray(pageData) ? pageData : (pageData?.dados || []);
            const res = this.persistPageRecords(pageItems, cargaId);
            totalRecebidos += res.recebidos;
            totalValidos += res.validos;
            totalRejeitados += res.rejeitados;
          } catch (pageErr) {
            console.error(`[OrganizerService] Erro na página ${page}:`, pageErr.message);
            errors.push(`Página ${page}: ${pageErr.message}`);
            totalRejeitados += 1000;
          }
        }
      }

      // 6. Atualizar histórico de carga
      const updateCarga = db.prepare(`
        UPDATE historico_carga
        SET data_fim = CURRENT_TIMESTAMP,
            total_registros_recebidos = ?,
            total_registros_validos = ?,
            total_registros_rejeitados = ?,
            status_carga = ?,
            log_erros = ?
        WHERE id = ?
      `);

      const statusFinal = errors.length === 0 ? 'SUCESSO' : (totalValidos > 0 ? 'ERRO_PARCIAL' : 'FALHA');
      updateCarga.run(totalRecebidos, totalValidos, totalRejeitados, statusFinal, errors.join('\n'), cargaId);

      console.log(`[OrganizerService] Sincronização concluída: ${totalValidos} registros válidos persistidos.`);

      return {
        sucesso: true,
        cargaId,
        totalRecebidos,
        totalValidos,
        totalRejeitados,
        statusFinal
      };

    } catch (err) {
      console.error('[OrganizerService] Falha na chamada da API Organizer:', err.message);

      const updateCarga = db.prepare(`
        UPDATE historico_carga
        SET data_fim = CURRENT_TIMESTAMP,
            status_carga = 'FALHA',
            log_erros = ?
        WHERE id = ?
      `);
      updateCarga.run(err.message, cargaId);

      throw err;
    }
  }

  /**
   * Executa requisição HTTP pura à API do Organizer
   */
  async fetchOrganizerPage(page = 1, { dataInicio, dataFim } = {}) {
    const token = this.getBearerToken();
    const cookie = this.getCookie();
    const apiUrl = this.getApiUrl();

    if (!apiUrl) {
      throw new Error('Serviço temporariamente indisponível. Tente novamente.');
    }

    // Monta URL apenas com ?page=X (a API recusa per_page)
    const baseClean = apiUrl.split('?')[0];
    const url = new URL(baseClean);
    url.searchParams.set('page', String(page));
    if (dataInicio) url.searchParams.set('inicio', dataInicio);
    if (dataFim) url.searchParams.set('fim', dataFim);

    const headers = {
      'Accept': 'application/json, text/plain, */*',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      'Referer': 'https://csd.organizer.com.br/',
      'Origin': 'https://csd.organizer.com.br',
      'X-Requested-With': 'XMLHttpRequest'
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    if (cookie) {
      headers['Cookie'] = cookie;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    let response;
    try {
      response = await fetch(url.toString(), {
        method: 'GET',
        headers,
        signal: controller.signal
      });
    } catch (fetchErr) {
      clearTimeout(timeout);
      throw new Error(`Falha de conexão com a API do Organizer: ${fetchErr.message}`);
    }
    clearTimeout(timeout);

    const text = await response.text();
    const trimmed = text.trim();

    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (parsed.status === 0 && parsed.message) {
          throw new Error(`Erro na API Organizer: ${parsed.message}`);
        }
        return parsed;
      } catch (jsonErr) {
        throw new Error(`Resposta da API do Organizer não é um JSON válido: ${jsonErr.message}`);
      }
    }

    if (response.status === 302 || response.status === 301 || trimmed.includes('<!DOCTYPE') || trimmed.includes('<html')) {
      throw new Error(`Sessão temporariamente indisponível. Por favor, tente novamente em instantes.`);
    }

    throw new Error(`Serviço temporariamente indisponível (HTTP ${response.status}). Tente novamente.`);
  }

  /**
   * Grava registros em lote na tabela temporária/ativa do SQLite
   * Segrega: SPOT_MATERIAIS vs SPOT_SERVICOS
   * Classifica: EMERGENCIAL vs ESTRATEGICA
   */
  persistPageRecords(dados = [], cargaId) {
    const db = getDatabase();
    let recebidos = dados.length;
    let validos = 0;
    let rejeitados = 0;

    const insertStmt = db.prepare(`
      INSERT INTO solicitacao_organizer (
        carga_id, numero_solicitacao, organizer_id_interno, data_criacao,
        data_aprovacao, data_cotacao, data_aprovacao_pedido, data_finalizacao, data_entrega_prevista,
        status_nome, investida_id, investida_nome, unidade_nome, departamento, comprador, categoria,
        tipo_compra, dentro_sla, dias_atendimento_sla, valor_menor_cotado,
        valor_final_negociado, saving_operacional, saving_percentual, fornecedor_vencedor,
        ano_competencia, mes_competencia
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
      )
    `);

    const servCats = [
      'Serviços Operacionais', 'Serviços Facilities', 'Serviços Financeiros',
      'Manutenção', 'Obras e Reformas', 'Obras', 'Adequação Bombeiros',
      'Adequação de Alvará', 'Adequação de Vigilância Sanitária',
      'Tecnologia', 'Limpeza e Higiene', 'Segurança Patrimonial', 'Logística'
    ];

    function cleanDate(val) {
      if (!val || val === '--' || val === '0000-00-00 00:00:00' || val === 'null' || val === 'undefined') return null;
      const str = String(val).trim();
      if (!str || str === '--') return null;
      // Converter formato brasileiro DD/MM/YYYY HH:MM:SS para ISO YYYY-MM-DD HH:MM:SS
      const m = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}:\d{1,2}(?::\d{1,2})?))?/);
      if (m) {
        const day = m[1].padStart(2, '0');
        const month = m[2].padStart(2, '0');
        const year = m[3];
        const time = m[4] || '00:00:00';
        return `${year}-${month}-${day} ${time}`;
      }
      return str;
    }

    db.exec('BEGIN TRANSACTION');
    try {
      for (const item of dados) {
        const idInterno = item.id || item.ID || item.id_solicitacao || null;
        const numSolic = item.numero_solicitacao || item.ordem_compra || item['Ordem de Compra'] || item['Solicitação'] || (idInterno ? String(idInterno) : null);
        const rawStatus = (item.status_nome || item.status || item['Status'] || 'Solicitação').trim();
        const rawComprador = item.comprador || item.analista || item['Comprador'] || item['Analista'] || null;
        const rawInvestida = (item.investida_nome || item.investida || item['Investida'] || 'Não Informada').trim();
        const rawUnidade = item.unidade_nome || item.unidade || item['Unidade'] || null;
        const rawDepto = item.departamento || item['Departamento'] || null;
        const rawCategoria = (item.categoria || item['Categoria'] || 'Geral').trim();
        const rawTipo = (item.tipo_compra || item.tipo || item['Tipo de Compra'] || 'SPOT').toUpperCase().trim();
        
        // Datas de todas as etapas (mantém null se não existir/não preenchido)
        const dtCriacao = cleanDate(item.data_criacao || item.criado || item.data_abertura || item.dt_criacao || item.criacao || item['Data Criação'] || item['Criado em']);
        const dtAprovacao = cleanDate(item.data_aprovacao || item.aprovado || item.data_aprovacao_solicitacao || item.dt_aprovacao || item['Data Aprovação'] || item['Aprovado']);
        const dtCotacao = cleanDate(
          item['Início Cotação'] || item['Inicio Cotação'] || item['Inicio Cotacao'] || item['inicio_cotacao'] ||
          item.data_cotacao || item.cotado_em || item.data_inicio_cotacao || item.data_envio_cotacao || item.dt_cotacao || item.inicio_cotacao || item.cotacao || item['Data Cotação']
        );
        const dtAprovacaoPedido = cleanDate(item.data_aprovacao_pedido || item.aprovacao_pedido || item.data_aprovacao_oc || item.dt_aprovacao_pedido || item.data_pedido || item.pedido_gerado || item['Gerar/Envio Pedido'] || item['Aprovação OC']);
        const dtFinalizacao = cleanDate(item.data_finalizacao || item.encerrado || item.data_conclusao || item.data_pedido_enviado || item.dt_finalizacao || item.data_fechamento || item['Data Conclusão'] || item['Finalizado']);
        const dtEntregaPrevista = cleanDate(item.data_entrega_prevista || item.previsao_entrega || item.data_previsao || item.dt_entrega || item['Previsão Entrega']);

        const rawFornecedor = item.fornecedor_vencedor || item.fornecedor || item['Fornecedor'] || null;
        const rawSla = item.dias_atendimento_sla ?? item.sla_cotacao_dias ?? item['SLA Cotação (dias)'] ?? item['SLA Cotação'] ?? item['SLA Cotacao (dias)'] ?? item['SLA Cotacao'] ?? null;
        const vCotado = item.valor_menor_cotado ?? item['Valor Menor Cotado'] ?? item['Valor Orçamento'] ?? null;
        const vFechado = item.valor_final_negociado ?? item['Valor Fechado'] ?? item['Valor'] ?? null;
        const sValor = item.saving_valor ?? item['Saving Operacional'] ?? 0;
        const sPct = item.saving_percentual ?? item['% Saving'] ?? 0;

        // Competência temporal
        let anoComp = 2026;
        let mesComp = 8;
        const dateStr = dtCriacao || dtAprovacao;
        if (dateStr) {
          const d = new Date(dateStr);
          if (!isNaN(d.getTime())) {
            anoComp = d.getFullYear();
            mesComp = d.getMonth() + 1;
          }
        }

        // Comprador (Title Case)
        let compradorLimpo = null;
        if (rawComprador && typeof rawComprador === 'string' && rawComprador.trim() !== '' && rawComprador !== 'Não informado' && rawComprador !== '--') {
          compradorLimpo = rawComprador.trim()
            .split(' ')
            .filter(w => w.length > 0)
            .map(w => ['da', 'de', 'do', 'dos', 'das', 'e'].includes(w.toLowerCase()) ? w.toLowerCase() : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
            .join(' ');
        }

        // Investida
        let investidaLimpa = rawInvestida;
        if (investidaLimpa === 'Grupo Amigão') investidaLimpa = 'Amigão';
        if (investidaLimpa === 'Superpão') investidaLimpa = 'Amigão';

        // Normalização do Tipo de Compra
        let tipoNorm;
        if (rawTipo.includes('EMERG')) {
          tipoNorm = 'EMERGENCIAL';
        } else if (rawTipo.includes('ESTRAT')) {
          tipoNorm = 'ESTRATEGICA';
        } else if (rawTipo.includes('SERVI')) {
          tipoNorm = 'SPOT_SERVICOS';
        } else if (servCats.includes(rawCategoria)) {
          tipoNorm = 'SPOT_SERVICOS';
        } else {
          tipoNorm = 'SPOT_MATERIAIS';
        }

        // Meta SLA por tipo (Metas Oficiais Plurix)
        let metaSla = 10.0;
        if (tipoNorm === 'SPOT_SERVICOS') metaSla = 15.0;
        else if (tipoNorm === 'ESTRATEGICA') metaSla = 45.0;

        // SLA do Comprador = Estritamente o prazo decorrido na etapa de Cotação
        let diasSla = null;
        if (rawSla !== null && rawSla !== undefined && rawSla !== '--') {
          const parsed = typeof rawSla === 'number' ? rawSla : parseFloat(String(rawSla).replace(',', '.'));
          if (!isNaN(parsed) && parsed >= 0) {
            diasSla = parsed;
          }
        }

        // Se temos data_cotacao, calcular tempo estrito de cotação
        if (dtCotacao) {
          const dCot = new Date(dtCotacao);
          if (!isNaN(dCot.getTime())) {
            const dFimCot = (dtAprovacaoPedido || dtFinalizacao) ? new Date(dtAprovacaoPedido || dtFinalizacao) : null;
            if (dFimCot && !isNaN(dFimCot.getTime())) {
              const diffDays = Math.max(0, (dFimCot - dCot) / (1000 * 60 * 60 * 24));
              diasSla = Math.round(diffDays * 10) / 10;
            } else if (rawStatus.toLowerCase().includes('cota')) {
              const diffDays = Math.max(0, (new Date() - dCot) / (1000 * 60 * 60 * 24));
              diasSla = Math.round(diffDays * 10) / 10;
            }
          }
        }

        // Dentro do SLA (compara tempo de cotação contra a meta da modalidade)
        let dentroSla = null;
        if (diasSla !== null) {
          dentroSla = diasSla <= metaSla ? 1 : 0;
        } else if (item.dentro_sla !== null && item.dentro_sla !== undefined) {
          dentroSla = item.dentro_sla === 1 ? 1 : 0;
        }

        insertStmt.run(
          cargaId,
          numSolic,
          idInterno ? parseInt(idInterno, 10) : null,
          dtCriacao,
          dtAprovacao,
          dtCotacao,
          dtAprovacaoPedido,
          dtFinalizacao,
          dtEntregaPrevista,
          rawStatus,
          item.investida_id || null,
          investidaLimpa,
          rawUnidade,
          rawDepto,
          compradorLimpo,
          rawCategoria,
          tipoNorm,
          dentroSla,
          diasSla !== null ? Math.round(diasSla * 10) / 10 : null,
          vCotado !== null ? parseFloat(vCotado) : null,
          vFechado !== null ? parseFloat(vFechado) : null,
          sValor !== null ? parseFloat(sValor) : 0,
          sPct !== null ? parseFloat(sPct) : 0,
          rawFornecedor,
          anoComp,
          mesComp
        );
        validos++;
      }
      db.exec('COMMIT');
    } catch (e) {
      db.exec('ROLLBACK');
      console.error('[OrganizerService] Erro ao gravar lote de registros:', e.message);
      rejeitados = dados.length;
      validos = 0;
    }

    return { recebidos, validos, rejeitados };
  }
}

module.exports = new OrganizerService();
