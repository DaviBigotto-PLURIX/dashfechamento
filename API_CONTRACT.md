# Contrato de Endpoints da API (API_CONTRACT)
**Especificação OpenAPI / RESTful · Backend Plurix Procurement**

---

## 1. Endpoints do Dashboard Executivo (Consumo Público/Leitor)

### `GET /api/v1/dashboard/overview`
Retorna os números agregados oficiais do período (YTD ou Mês específico).
- **Query Params**:
  - `mode`: `'ytd'` | `'month'` (obrigatório)
  - `month`: `'jan'`, `'fev'`, ... `'dez'` (obrigatório se mode == 'month')
  - `year`: `2026` (padrão)
- **Response 200 OK**:
```json
{
  "periodo": { "modo": "ytd", "ano": 2026, "meses_fechados": ["jan", "fev", "mar", "abr", "mai", "jun", "jul"] },
  "status_fechamento": "CONGELADO",
  "versao": 1,
  "kpis": {
    "saving_total_liquido": 28247418.12,
    "saving_opex": 27105694.42,
    "saving_capex": 1141723.70,
    "custo_evitado": 8420310.50,
    "total_negociacoes": 215,
    "sla_cotacao_medio_dias": 8.4,
    "prazo_total_medio_dias": 24.4,
    "meta_periodo": 24362440.37,
    "atingimento_periodo_pct": 111.26,
    "meta_anual": 28815322.48,
    "progresso_anual_pct": 94.07,
    "gap_anual": 1709628.06
  }
}
```

---

### `GET /api/v1/dashboard/negociacoes`
Retorna as negociações consolidadas com paginação e busca.
- **Query Params**:
  - `month`: `'all'` | `'jan'` ...
  - `tipo`: `'ALL'` | `'SAVING'` | `'CUSTO EVITADO'` | `'IMPACTO'` | `'CAPEX'`
  - `search`: string de busca textual
  - `page`: número da página (default 1)
  - `limit`: itens por página (default 50)

---

## 2. Endpoints Administrativos e de Operação de Fechamento

### `POST /api/v1/organizer/sync`
Dispara a sincronização de dados com a API do Organizer em background.
- **Headers**: `Authorization: Bearer <JWT_ANALISTA>`
- **Request Body**:
```json
{
  "data_inicio": "2026-08-01",
  "data_fim": "2026-08-31",
  "force_full": false
}
```
- **Response 202 Accepted**:
```json
{
  "job_id": "sync-org-20260819-001",
  "status": "PROCESSING",
  "mensagem": "Sincronização com a API do Organizer iniciada. 16 páginas estimadas."
}
```

---

### `POST /api/v1/fechamento/upload-planilha`
Recebe a planilha `Fechamento Mensal - Procurement_2026.xlsx`.
- **Form Data**: `file: <arquivo_xlsx>`, `ano: 2026`, `mes: 8`
- **Response 200 OK**:
```json
{
  "sucesso": true,
  "carga_id": 14,
  "resumo_leitura": {
    "total_linhas_lidas": 218,
    "linhas_validas": 215,
    "linhas_rejeitadas": 3,
    "avisos": [
      { "linha": 42, "aviso": "Código Organizer não informado para negociação de Uniformes" }
    ],
    "totais_previstos": {
      "saving_opex": 3499024.79,
      "saving_capex": 191000.00
    }
  }
}
```

---

### `GET /api/v1/fechamento/conciliacao`
Lista o relatório de conciliação entre API Organizer e Planilha.
- **Query Params**: `fechamento_id=8`
- **Response 200 OK**:
```json
{
  "fechamento_id": 8,
  "estatisticas": {
    "conciliados_automaticos": 180,
    "requer_revisao": 12,
    "somente_organizer": 450,
    "somente_fechamento": 23
  },
  "pendencias": [
    {
      "id": 101,
      "codigo_organizer": "PC30683083",
      "projeto": "Contrato Facilities Amigão",
      "valor_api": 5950.00,
      "valor_planilha": 7350.00,
      "divergencia": "VALOR_DIVERGENTE",
      "status": "PENDENTE"
    }
  ]
}
```

---

### `POST /api/v1/fechamento/submeter`
Submete o fechamento mensal para a esteira de aprovação.
- **Request Body**:
```json
{
  "fechamento_id": 8,
  "justificativas_pendencias": [
    { "pendencia_id": 101, "justificativa": "Diferença referente ao valor de frete faturado direto." }
  ]
}
```

---

### `POST /api/v1/fechamento/aprovar`
Aprova e congela o fechamento do período (Ação restrita ao perfil Aprovador/Diretoria).
- **Request Body**:
```json
{
  "fechamento_id": 8,
  "decisao": "APROVAR", -- ou "DEVOLVER"
  "comentarios": "Fechamento validado com a controladoria."
}
```
