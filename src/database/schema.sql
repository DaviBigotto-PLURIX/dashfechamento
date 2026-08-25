-- =====================================================================
-- PLURIX PROCUREMENT - ESQUEMA RELACIONAL SQLITE
-- =====================================================================

-- 1. Tabela de Fechamentos Mensais (Ciclo de Vida e Congelamento)
CREATE TABLE IF NOT EXISTS fechamento_mensal (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ano INTEGER NOT NULL,
    mes INTEGER NOT NULL, -- 1 a 12
    mes_chave VARCHAR(10) NOT NULL, -- 'jan', 'fev', ... 'dez'
    status VARCHAR(30) NOT NULL DEFAULT 'RASCUNHO',
    -- 'RASCUNHO', 'SINCRONIZANDO', 'AGUARDANDO_PLANILHA', 'EM_REVISAO', 
    -- 'PRONTO_APROVACAO', 'DEVOLVIDO', 'APROVADO', 'CONGELADO', 'REABERTO'
    versao INTEGER NOT NULL DEFAULT 1,
    data_criacao DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    data_preparacao DATETIME,
    data_aprovacao DATETIME,
    data_congelamento DATETIME,
    preparado_por VARCHAR(100),
    aprovado_por VARCHAR(100),
    justificativa_reabertura TEXT,
    
    -- Totais Consolidados Congelados
    total_negociacoes INTEGER DEFAULT 0,
    total_saving_opex REAL DEFAULT 0.0,
    total_saving_capex REAL DEFAULT 0.0,
    total_custo_evitado REAL DEFAULT 0.0,
    total_impacto REAL DEFAULT 0.0,
    total_requisicoes_api INTEGER DEFAULT 0,
    sla_medio_dias REAL DEFAULT 0.0,
    inconsistencias_pendentes INTEGER DEFAULT 0,
    
    UNIQUE(ano, mes, versao)
);

-- 2. Tabela de Metas Orçamentárias por Investida e Mês
CREATE TABLE IF NOT EXISTS metas_investida (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ano INTEGER NOT NULL,
    mes INTEGER NOT NULL,
    mes_chave VARCHAR(10) NOT NULL,
    investida VARCHAR(100) NOT NULL,
    meta_opex REAL NOT NULL DEFAULT 0.0,
    UNIQUE(ano, mes, investida)
);

-- 3. Tabela de Histórico de Cargas (Auditoria de Ingestão)
CREATE TABLE IF NOT EXISTS historico_carga (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tipo_carga VARCHAR(30) NOT NULL, -- 'API_ORGANIZER', 'PLANILHA_FECHAMENTO', 'ESTOCAVEIS'
    origem_arquivo VARCHAR(255),
    hash_arquivo VARCHAR(64),
    data_inicio DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    data_fim DATETIME,
    executado_por VARCHAR(100) NOT NULL,
    total_registros_recebidos INTEGER DEFAULT 0,
    total_registros_validos INTEGER DEFAULT 0,
    total_registros_rejeitados INTEGER DEFAULT 0,
    status_carga VARCHAR(20) NOT NULL, -- 'SUCESSO', 'ERRO_PARCIAL', 'FALHA'
    log_erros TEXT
);

-- 4. Tabela de Solicitações Operacionais (API do Organizer)
CREATE TABLE IF NOT EXISTS solicitacao_organizer (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    carga_id INTEGER REFERENCES historico_carga(id),
    numero_solicitacao VARCHAR(50),
    organizer_id_interno INTEGER,
    data_criacao DATETIME,
    data_aprovacao DATETIME,
    data_cotacao DATETIME,
    data_aprovacao_pedido DATETIME,
    data_finalizacao DATETIME,
    data_entrega_prevista DATETIME,
    status_nome VARCHAR(80),
    investida_id INTEGER,
    investida_nome VARCHAR(100) NOT NULL,
    unidade_nome VARCHAR(150),
    departamento VARCHAR(100),
    comprador VARCHAR(120),
    categoria VARCHAR(100),
    tipo_compra VARCHAR(50), -- 'SPOT', 'EMERGENCIAL', 'ESTRATEGICA'
    dentro_sla INTEGER, -- 1 ou 0
    dias_atendimento_sla REAL,
    valor_menor_cotado REAL,
    valor_final_negociado REAL,
    saving_operacional REAL,
    saving_percentual REAL,
    fornecedor_vencedor VARCHAR(200),
    ano_competencia INTEGER,
    mes_competencia INTEGER,
    data_sincronizacao DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_solic_num ON solicitacao_organizer(numero_solicitacao);
CREATE INDEX IF NOT EXISTS idx_solic_competencia ON solicitacao_organizer(ano_competencia, mes_competencia);
CREATE INDEX IF NOT EXISTS idx_solic_investida ON solicitacao_organizer(investida_nome);

-- 5. Tabela de Negociações Gerenciais (Planilha Procurement)
CREATE TABLE IF NOT EXISTS negociacao_fechamento (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    fechamento_id INTEGER NOT NULL REFERENCES fechamento_mensal(id),
    carga_id INTEGER REFERENCES historico_carga(id),
    linha_planilha INTEGER NOT NULL,
    codigo_projeto VARCHAR(50),
    codigo_organizer VARCHAR(100),
    nome_projeto VARCHAR(250) NOT NULL,
    categoria VARCHAR(100),
    subcategoria VARCHAR(100),
    recorrencia VARCHAR(50),
    responsavel_compras VARCHAR(120) NOT NULL,
    investida VARCHAR(100) NOT NULL,
    solicitante VARCHAR(150),
    fornecedor VARCHAR(200),
    modalidade VARCHAR(10) NOT NULL, -- 'CAPEX' ou 'OPEX'
    bc_legal VARCHAR(50),
    mes_conclusao_texto VARCHAR(30),
    mes_conclusao_data DATE,
    tipo_resultado VARCHAR(30) NOT NULL, -- 'SAVING', 'CUSTO EVITADO', 'IMPACTO'
    
    -- Valores Financeiros
    orcamento_2026 REAL DEFAULT 0.0,
    baseline_realizado REAL DEFAULT 0.0,
    baseline_ajustado REAL DEFAULT 0.0,
    valor_fechado_total REAL DEFAULT 0.0,
    saving_baseline REAL DEFAULT 0.0,
    saving_pct_baseline REAL DEFAULT 0.0,
    custo_evitado REAL DEFAULT 0.0,
    custo_evitado_pct REAL DEFAULT 0.0,
    saving_reconhecido_ano REAL DEFAULT 0.0,
    
    esta_no_cronograma VARCHAR(10),
    status_contrato VARCHAR(80),
    prazo_pagamento VARCHAR(80),
    observacoes TEXT,
    data_importacao DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_neg_fechamento ON negociacao_fechamento(fechamento_id);
CREATE INDEX IF NOT EXISTS idx_neg_cod_org ON negociacao_fechamento(codigo_organizer);

-- 6. Tabela de Conciliação e Divergências
CREATE TABLE IF NOT EXISTS conciliacao (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    fechamento_id INTEGER NOT NULL REFERENCES fechamento_mensal(id),
    negociacao_id INTEGER REFERENCES negociacao_fechamento(id),
    solicitacao_id INTEGER REFERENCES solicitacao_organizer(id),
    codigo_organizer VARCHAR(100),
    tipo_conciliacao VARCHAR(40) NOT NULL,
    -- 'CONCILIADO_AUTOMATICO', 'CONCILIADO_MANUAL', 'SOMENTE_ORGANIZER', 
    -- 'SOMENTE_FECHAMENTO', 'CONFLITO_VALOR', 'CONFLITO_INVESTIDA', 'CODIGO_AUSENTE'
    divergencia_detectada TEXT,
    justificativa_analista TEXT,
    revisado_por VARCHAR(100),
    data_revisao DATETIME,
    status_aprovacao VARCHAR(30) DEFAULT 'PENDENTE' -- 'PENDENTE', 'RESOLVIDO', 'ACEITO'
);

-- 7. Tabela de Estoque Indireto e Aging
CREATE TABLE IF NOT EXISTS estoque_indireto (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    fechamento_id INTEGER REFERENCES fechamento_mensal(id),
    carga_id INTEGER REFERENCES historico_carga(id),
    ano INTEGER NOT NULL,
    mes INTEGER NOT NULL,
    mes_chave VARCHAR(10) NOT NULL,
    unidade VARCHAR(100) NOT NULL,
    cor_grafico VARCHAR(20),
    faixa_0_30 REAL DEFAULT 0.0,
    faixa_31_60 REAL DEFAULT 0.0,
    faixa_61_90 REAL DEFAULT 0.0,
    faixa_91_120 REAL DEFAULT 0.0,
    faixa_121_180 REAL DEFAULT 0.0,
    faixa_maior_180 REAL DEFAULT 0.0,
    total_estoque REAL DEFAULT 0.0,
    data_registro DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(ano, mes, unidade)
);

-- 8. Tabela de Auditoria Imutável de Alterações
CREATE TABLE IF NOT EXISTS auditoria_alteracoes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    entidade VARCHAR(50) NOT NULL,
    registro_id INTEGER NOT NULL,
    campo_alterado VARCHAR(80) NOT NULL,
    valor_anterior TEXT,
    valor_novo TEXT,
    motivo_alteracao TEXT,
    usuario VARCHAR(100) NOT NULL,
    ip_origem VARCHAR(45),
    data_evento DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    fechamento_id INTEGER REFERENCES fechamento_mensal(id)
);
