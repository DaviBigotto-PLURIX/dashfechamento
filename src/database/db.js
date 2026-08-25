/* =====================================================================
   PLURIX PROCUREMENT DATABASE ADAPTER (node:sqlite)
   Camada de persistência relacional transacional e migrations
   ===================================================================== */

const { DatabaseSync } = require('node:sqlite');
const fs = require('fs');
const path = require('path');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', '..', 'procurement_plurix.db');
const SCHEMA_PATH = path.join(__dirname, 'schema.sql');

let dbInstance = null;

function getDatabase() {
  if (!dbInstance) {
    dbInstance = new DatabaseSync(DB_PATH);
    // Habilitar WAL mode e foreign keys
    dbInstance.exec('PRAGMA journal_mode = WAL;');
    dbInstance.exec('PRAGMA foreign_keys = ON;');
    initSchema(dbInstance);
    seedInitialData(dbInstance);
  }
  return dbInstance;
}

function initSchema(db) {
  try {
    const schemaSql = fs.readFileSync(SCHEMA_PATH, 'utf8');
    db.exec(schemaSql);

    // Migrations dinâmicas seguras para colunas de datas de etapas
    const tableInfo = db.prepare("PRAGMA table_info(solicitacao_organizer)").all();
    const existingCols = tableInfo.map(c => c.name);

    if (!existingCols.includes('data_cotacao')) {
      db.exec('ALTER TABLE solicitacao_organizer ADD COLUMN data_cotacao DATETIME;');
    }
    if (!existingCols.includes('data_aprovacao_pedido')) {
      db.exec('ALTER TABLE solicitacao_organizer ADD COLUMN data_aprovacao_pedido DATETIME;');
    }
    if (!existingCols.includes('data_entrega_prevista')) {
      db.exec('ALTER TABLE solicitacao_organizer ADD COLUMN data_entrega_prevista DATETIME;');
    }
  } catch (err) {
    console.error('[DB] Erro ao aplicar schema.sql/migrations:', err.message);
  }
}

function seedInitialData(db) {
  // 1. Seed Metas Orçamentárias 2026 por Investida e Mês (Dados Oficiais Holding)
  const metaCheck = db.prepare('SELECT COUNT(*) as count FROM metas_investida WHERE ano = 2026').get();
  if (metaCheck.count === 0) {
    console.log('[DB] Inicializando tabela de metas orçamentárias 2026...');

    const metas = {
      "Holding": { 1: 0, 2: 1136.67, 3: 25122.97, 4: 20140.27, 5: 0, 6: 2479.33, 7: 0, 8: 3532.01, 9: 5473.08, 10: 0, 11: 0, 12: 0 },
      "Boa": { 1: 456236.77, 2: 55396.12, 3: 846755.46, 4: 1965371.32, 5: 533246.96, 6: 336596.30, 7: 320554.72, 8: 788000.92, 9: 86569.66, 10: 28074.20, 11: 479.91, 12: 21427.83 },
      "Avenida": { 1: 483578.43, 2: 32511.37, 3: 827636.31, 4: 1787212.37, 5: 543905.62, 6: 529289.43, 7: 427729.60, 8: 688099.99, 9: 52180.00, 10: 7359.07, 11: 446.01, 12: 13287.99 },
      "Superpão": { 1: 305492.11, 2: 6630.27, 3: 875493.09, 4: 3870089.19, 5: 549420.28, 6: 1197364.05, 7: 370965.61, 8: 591524.56, 9: 180.00, 10: 59046.46, 11: 383.41, 12: 11333.62 },
      "Amigão": { 1: 1045900.03, 2: 19834.39, 3: 1635435.92, 4: 667199.75, 5: 1674468.02, 6: 690692.46, 7: 1318829.12, 8: 1770482.02, 9: 12874.43, 10: 3671.55, 11: 1129.36, 12: 33384.06 },
      "Paraná": { 1: 115135.50, 2: 2931.75, 3: 278864.65, 4: 102646.23, 5: 186330.25, 6: 75771.42, 7: 178046.24, 8: 261703.06, 9: 6176.47, 10: 551.16, 11: 311.26, 12: 5200.03 }
    };

    const monthKeys = { 1: 'jan', 2: 'fev', 3: 'mar', 4: 'abr', 5: 'mai', 6: 'jun', 7: 'jul', 8: 'ago', 9: 'set', 10: 'out', 11: 'nov', 12: 'dez' };

    const insertMeta = db.prepare(`
      INSERT INTO metas_investida (ano, mes, mes_chave, investida, meta_opex)
      VALUES (?, ?, ?, ?, ?)
    `);

    for (const [inv, meses] of Object.entries(metas)) {
      for (const [m, valor] of Object.entries(meses)) {
        insertMeta.run(2026, parseInt(m), monthKeys[m], inv, valor);
      }
    }
  }

  // 2. Inicializar Estrutura dos 12 meses de Fechamento de 2026 se não existirem
  const fechamentoCheck = db.prepare('SELECT COUNT(*) as count FROM fechamento_mensal WHERE ano = 2026').get();
  if (fechamentoCheck.count === 0) {
    console.log('[DB] Inicializando registros de fechamento mensal 2026...');
    const monthKeys = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
    const insertFechamento = db.prepare(`
      INSERT INTO fechamento_mensal (ano, mes, mes_chave, status, versao)
      VALUES (?, ?, ?, ?, ?)
    `);

    for (let m = 1; m <= 12; m++) {
      const key = monthKeys[m - 1];
      // Jan a Jul como CONGELADO / FECHADO com base demonstrativa histórica inicial
      const isHistorical = m <= 7;
      insertFechamento.run(2026, m, key, isHistorical ? 'CONGELADO' : 'RASCUNHO', 1);
    }
  }
}

module.exports = {
  getDatabase
};
