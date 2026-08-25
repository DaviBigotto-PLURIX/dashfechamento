/* =====================================================================
   PLURIX PROCUREMENT - SERVIÇO DE AUDITORIA DE PARIDADE (API vs CSV)
   Compara Fonte 1 (API Organizer) com Fonte 2 (RelatorioGeralCompras.csv)
   Registra divergências para investigação sem assumir verdade automática.
   ===================================================================== */

const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');
const { getDatabase } = require('../database/db');

class ParityAuditService {

  /**
   * Executa a auditoria de paridade entre a base da API no SQLite e um arquivo CSV exportado
   * @param {Buffer|string} csvSource - Buffer do CSV ou caminho do arquivo
   * @param {string} nomeArquivo
   */
  async runParityAudit(csvSource, nomeArquivo = 'RelatorioGeralCompras.csv') {
    const db = getDatabase();

    // 1. Carregar registros da API persistidos no SQLite
    const apiRecords = db.prepare(`
      SELECT 
        id,
        numero_solicitacao,
        status_nome,
        investida_nome,
        comprador,
        categoria,
        tipo_compra,
        dentro_sla,
        dias_atendimento_sla,
        valor_menor_cotado,
        valor_final_negociado,
        saving_operacional,
        saving_percentual
      FROM solicitacao_organizer
    `).all();

    // Indexar API por número de solicitação normalizado
    const apiMap = new Map();
    apiRecords.forEach(rec => {
      const code = this.normalizeCode(rec.numero_solicitacao);
      if (code) {
        if (!apiMap.has(code)) apiMap.set(code, []);
        apiMap.get(code).push(rec);
      }
    });

    // 2. Fazer parse do CSV de exportação manual
    let workbook;
    if (Buffer.isBuffer(csvSource)) {
      workbook = xlsx.read(csvSource, { type: 'buffer', raw: true });
    } else if (typeof csvSource === 'string' && fs.existsSync(csvSource)) {
      workbook = xlsx.readFile(csvSource, { raw: true });
    } else {
      const defaultPath = path.join(__dirname, '..', '..', 'RelatorioGeralCompras_2026_08_18_10_35_27(Worksheet).csv');
      if (fs.existsSync(defaultPath)) {
        workbook = xlsx.readFile(defaultPath, { raw: true });
      } else {
        throw new Error('Arquivo CSV RelatorioGeralCompras não encontrado para auditoria.');
      }
    }

    const firstSheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[firstSheetName];
    const csvRows = xlsx.utils.sheet_to_json(sheet, { defval: '' });

    // 3. Estruturas para registrar comparação
    const totalApi = apiRecords.length;
    const totalCsv = csvRows.length;

    let totalIguais = 0;
    let totalDivergentes = 0;
    let somenteNaApi = 0;
    let somenteNoCsv = 0;

    const divergenciasDetalhes = [];
    const csvMatchedCodes = new Set();

    // 4. Analisar linhas do CSV contra o mapa da API
    csvRows.forEach((row, idx) => {
      const rawId = row['ID'] || row['Ordem de Compra'] || row['numero_solicitacao'] || '';
      const code = this.normalizeCode(rawId);

      if (!code) {
        somenteNoCsv++;
        divergenciasDetalhes.push({
          tipo: 'CSV_SEM_CODIGO',
          linhaCsv: idx + 2,
          codigo: null,
          detalhe: 'Registro no CSV sem ID/Ordem de Compra identificável.',
          csvData: row,
          apiData: null
        });
        return;
      }

      csvMatchedCodes.add(code);
      const apiMatches = apiMap.get(code);

      if (!apiMatches || apiMatches.length === 0) {
        somenteNoCsv++;
        if (divergenciasDetalhes.length < 200) {
          divergenciasDetalhes.push({
            tipo: 'SOMENTE_NO_CSV',
            linhaCsv: idx + 2,
            codigo: code,
            detalhe: `Solicitação ${code} presente no CSV exportado mas não encontrada no retorno da API.`,
            csvData: {
              id: code,
              status: row['Status'] || '',
              investida: row['Investida'] || '',
              analista: row['Analista'] || '',
              valorFechado: row['Valor Fechado'] || row['Valor'] || ''
            },
            apiData: null
          });
        }
      } else {
        const apiItem = apiMatches[0];
        const diffs = [];

        // Comparar status
        const csvStatus = String(row['Status'] || '').trim().toLowerCase();
        const apiStatus = String(apiItem.status_nome || '').trim().toLowerCase();
        if (csvStatus && apiStatus && !csvStatus.includes(apiStatus) && !apiStatus.includes(csvStatus)) {
          diffs.push(`Status: API="${apiItem.status_nome}" vs CSV="${row['Status']}"`);
        }

        // Comparar valor fechado / negociado
        const csvValor = this.parseCurrency(row['Valor Fechado'] || row['Valor'] || 0);
        const apiValor = apiItem.valor_final_negociado || 0;
        if (csvValor > 0 && apiValor > 0) {
          const diff = Math.abs(csvValor - apiValor);
          if (diff > 1.0 && (diff / Math.max(csvValor, apiValor)) > 0.02) {
            diffs.push(`Valor Negociado: API=R$ ${apiValor.toFixed(2)} vs CSV=R$ ${csvValor.toFixed(2)}`);
          }
        }

        // Comparar Investida
        const csvInvestida = String(row['Investida'] || '').trim().toLowerCase();
        const apiInvestida = String(apiItem.investida_nome || '').trim().toLowerCase();
        if (csvInvestida && apiInvestida && !csvInvestida.includes(apiInvestida) && !apiInvestida.includes(csvInvestida)) {
          diffs.push(`Investida: API="${apiItem.investida_nome}" vs CSV="${row['Investida']}"`);
        }

        if (diffs.length > 0) {
          totalDivergentes++;
          if (divergenciasDetalhes.length < 200) {
            divergenciasDetalhes.push({
              tipo: 'DIVERGENCIA_CAMPOS',
              linhaCsv: idx + 2,
              codigo: code,
              detalhe: diffs.join(' | '),
              csvData: {
                status: row['Status'],
                investida: row['Investida'],
                analista: row['Analista'],
                valor: csvValor
              },
              apiData: {
                status: apiItem.status_nome,
                investida: apiItem.investida_nome,
                comprador: apiItem.comprador,
                valor: apiValor
              }
            });
          }
        } else {
          totalIguais++;
        }
      }
    });

    // 5. Identificar itens presentes somente na API
    apiRecords.forEach(apiItem => {
      const code = this.normalizeCode(apiItem.numero_solicitacao);
      if (code && !csvMatchedCodes.has(code)) {
        somenteNaApi++;
        if (divergenciasDetalhes.length < 200) {
          divergenciasDetalhes.push({
            tipo: 'SOMENTE_NA_API',
            linhaCsv: null,
            codigo: code,
            detalhe: `Solicitação ${code} presente na API mas não localizada na planilha CSV exportada.`,
            csvData: null,
            apiData: {
              numero: apiItem.numero_solicitacao,
              status: apiItem.status_nome,
              investida: apiItem.investida_nome,
              comprador: apiItem.comprador,
              valor: apiItem.valor_final_negociado
            }
          });
        }
      }
    });

    // 6. Calcular índice de conformidade/paridade
    const totalComparados = totalIguais + totalDivergentes;
    const indiceParidadePct = totalComparados > 0
      ? ((totalIguais / totalComparados) * 100).toFixed(2)
      : 0;

    return {
      arquivoAuditado: nomeArquivo,
      dataAuditoria: new Date().toISOString(),
      resumo: {
        totalRegistrosApi: totalApi,
        totalRegistrosCsv: totalCsv,
        totalCoincidentesExatos: totalIguais,
        totalComDivergenciaCampos: totalDivergentes,
        somenteNoCsv: somenteNoCsv,
        somenteNaApi: somenteNaApi,
        indiceParidadePct: parseFloat(indiceParidadePct)
      },
      conclusaoAuditoria: {
        regra: 'A API do Organizer é a fonte oficial primária operacional. O CSV serve para validação e contingência.',
        recomendacao: totalDivergentes > 0 || somenteNaApi > 0 || somenteNoCsv > 0
          ? 'Divergências encontradas registradas para investigação da TI sem descarte automático.'
          : 'Paridade de 100% confirmada entre API e CSV exportado.'
      },
      amostraDivergencias: divergenciasDetalhes.slice(0, 100)
    };
  }

  normalizeCode(val) {
    if (!val) return '';
    return String(val)
      .trim()
      .toUpperCase()
      .replace(/^PC/i, '')
      .replace(/^0+/, '');
  }

  parseCurrency(val) {
    if (typeof val === 'number') return val;
    if (!val) return 0;
    const clean = String(val)
      .replace('R$', '')
      .replace(/\s/g, '')
      .replace(/\./g, '')
      .replace(',', '.');
    const num = parseFloat(clean);
    return isNaN(num) ? 0 : num;
  }
}

module.exports = new ParityAuditService();
