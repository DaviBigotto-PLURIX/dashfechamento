/* =====================================================================
   PLURIX PROCUREMENT SERVER (Node.js + Express + SQLite)
   Backend de processamento, conciliação e persistência relacional
   ===================================================================== */

const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

// Leitura simples de .env sem dependências externas
function loadEnv() {
  const envPath = path.join(__dirname, '.env');
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf8').split('\n');
    lines.forEach(line => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const idx = trimmed.indexOf('=');
        if (idx !== -1) {
          const key = trimmed.slice(0, idx).trim();
          const val = trimmed.slice(idx + 1).trim();
          if (!process.env[key]) process.env[key] = val;
        }
      }
    });
  }
}
loadEnv();

const { getDatabase } = require('./src/database/db');

// Inicializar banco de dados relacional
const db = getDatabase();

const app = express();
const PORT = process.env.PORT || 3333;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.static(__dirname));

// =====================================================================
// ROTAS MODULARES v1 (ARQUITETURA ALVO)
// =====================================================================
const dashboardRoutes = require('./src/routes/dashboardRoutes');
const closureRoutes = require('./src/routes/closureRoutes');
const organizerRoutes = require('./src/routes/organizerRoutes');
const operationalRoutes = require('./src/routes/operationalRoutes');

app.use('/api/v1/operacional', operationalRoutes);
app.use('/api/v1/dashboard', dashboardRoutes);
app.use('/api/v1/fechamento', closureRoutes);
app.use('/api/v1/organizer', organizerRoutes);

// Inicialização do servidor (Sem cargas automáticas de arquivos salvos)
app.listen(PORT, () => {
  console.log(`=====================================================================`);
  console.log(`🚀 SERVIDOR PLURIX PROCUREMENT DASHBOARD RODANDO`);
  console.log(`🔗 Interface Web: http://localhost:${PORT}`);
  console.log(`📊 API REST v1:   http://localhost:${PORT}/api/v1/dashboard/overview`);
  console.log(`📂 Modo: 100% Dinâmico (Sem cache estático / Dados via API Organizer)`);
  console.log(`=====================================================================`);
});
