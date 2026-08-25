# Dicionário de Dados Corporativo (DATA_DICTIONARY)
**Padronização Terminológica e de Campos · Plurix Procurement**

---

## 1. Glossário de Conceitos de Negócio

- **Saving de Baseline**: Economia contratada em relação ao gasto real histórico dos últimos 12 meses, ajustado por índices de mercado ou proposta concorrente.
- **Saving Operacional (API)**: Desconto monetário obtido durante a negociação direta com fornecedores na etapa de cotação do Organizer (`Menor Valor Cotado - Valor Final Negociado`).
- **Saving Reconhecido (Saving 2026)**: Valor financeiro de economia validado pela Controladoria e creditado para a meta anual de Procurement do ano corrente.
- **Custo Evitado (*Cost Avoidance*)**: Ações que evitaram um desembolso maior previsto em reajustes de tabela, mas que não representam redução contábil líquida em relação ao gasto anterior.
- **Impacto Financeiro**: Receitas ou desmobilizações extraordinárias (ex: venda de máquinas/sucata, ressarcimento de sinistro de seguro).
- **CAPEX (*Capital Expenditure*)**: Investimentos em bens de capital, infraestrutura e expansão/reforma de lojas.
- **OPEX (*Operational Expenditure*)**: Despesas operacionais recorrentes do dia a dia das unidades e da holding.
- **Investidas Plurix**: Redes do grupo supermercadista — Grupo Amigão, Avenida Supermercados, Boa Supermercados, Paraná Supermercados, Superpão e Plurix Holding.

---

## 2. Dicionário de Campos por Entidade

### 2.1 Entidade: Negociação Gerencial (`negociacao_fechamento`)

| Campo | Tipo de Dado | Obrigatório | Descrição / Regra de Validação | Exemplo |
| :--- | :--- | :--- | :--- | :--- |
| `codigo_projeto` | String(50) | Sim | Código de controle gerencial de Procurement. | `"1"`, `"PRJ-2026-042"` |
| `codigo_organizer` | String(100) | Não | Número da solicitação ou pedido no Organizer associado. | `"PC30683083"`, `"30309"` |
| `nome_projeto` | String(250) | Sim | Descrição do escopo negociado. | `"Energia Auto produção"` |
| `categoria` | String(100) | Sim | Categoria macro de compras. | `"Utilities"`, `"TI"`, `"Facilities"` |
| `subcategoria` | String(100) | Não | Detalhamento da categoria. | `"Energia Elétrica"`, `"Software ERP"` |
| `recorrencia` | Enum | Sim | `MENSAL`, `SPOT`, `CONTRATO_ANUAL`. | `"MENSAL"` |
| `responsavel_compras`| String(120) | Sim | Nome do comprador ou negociador líder. | `"Adriana Cardoso"` |
| `investida` | Enum | Sim | `Amigão`, `Avenida`, `Boa`, `Paraná`, `Superpão`, `Holding`. | `"Avenida"` |
| `solicitante` | String(150) | Não | Área ou gestor que requisitou a compra. | `"Diretoria de Operações"` |
| `fornecedor` | String(200) | Não | Razão social ou nome fantasia do fornecedor. | `"Totvs S.A."` |
| `modalidade` | Enum | Sim | `CAPEX` ou `OPEX`. | `"OPEX"` |
| `bc_legal` | String(50) | Não | Base de cálculo jurídica/tributária se houver. | `"PIS/COFINS"` |
| `mes_conclusao_data` | Date | Sim | Mês e ano de competência do fechamento financeiro. | `2026-04-01` |
| `tipo_resultado` | Enum | Sim | `SAVING`, `CUSTO EVITADO`, `IMPACTO`. | `"SAVING"` |
| `orcamento_2026` | Decimal(15,2) | Não | Valor orçado para a contratação no ano. | `1500000.00` |
| `baseline_realizado` | Decimal(15,2) | Não | Gasto real dos 12 meses anteriores. | `1850000.00` |
| `baseline_ajustado` | Decimal(15,2) | Não | Baseline corrigido por cotação de mercado/IPCA. | `1920000.00` |
| `valor_fechado_total`| Decimal(15,2) | Sim | Valor total contratado para o período de 12 meses. | `1425174.83` |
| `saving_baseline` | Decimal(15,2) | Sim | `baseline_ajustado - valor_fechado_total`. | `494825.17` |
| `saving_pct_baseline`| Decimal(6,2) | Não | Percentual de economia frente ao baseline. | `25.77` |
| `custo_evitado` | Decimal(15,2) | Não | Valor de custo prevenido. | `0.00` |
| `status_contrato` | String(80) | Não | Situação jurídica do contrato. | `"Assinado"`, `"Em Minuta"` |
| `prazo_pagamento` | String(80) | Não | Condição comercial negociada. | `"30 DDL"`, `"45 DDF"` |

---

### 2.2 Entidade: Solicitação Operacional API (`solicitacao_organizer`)

| Campo | Tipo de Dado | Obrigatório | Descrição / Regra de Validação | Exemplo |
| :--- | :--- | :--- | :--- | :--- |
| `numero_solicitacao` | String(50) | Não | Código oficial da requisição / OC no portal. | `"PC30683083"` |
| `status_nome` | String(80) | Sim | Fase do fluxo (`Solicitacao`, `Cotacao`, `Aprovacao`, `Pedido Enviado`, `Encerrado`). | `"Pedido Enviado"` |
| `comprador` | String(120) | Não | Nome do comprador atribuído no Organizer. | `"Antonio Carlos Soleon"` |
| `investida_nome` | String(100) | Sim | Nome da empresa compradora. | `"Grupo Amigão"` |
| `tipo_compra` | Enum | Sim | `SPOT`, `EMERGENCIAL`, `ESTRATEGICA`. | `"EMERGENCIAL"` |
| `dentro_sla` | Integer | Não | `1` se atendeu ao SLA pactuado, `0` se estourou. | `1` |
| `dias_atendimento_sla`| Decimal(6,2) | Não | Quantidade de dias úteis até a conclusão da etapa. | `8.40` |
| `valor_menor_cotado` | Decimal(15,2) | Não | Menor lance inicial obtido dos fornecedores cotados. | `7350.00` |
| `valor_final_negociado`| Decimal(15,2)| Não | Valor acordado final após negociação do comprador. | `5950.00` |
| `saving_operacional` | Decimal(15,2) | Não | `valor_menor_cotado - valor_final_negociado`. | `1400.00` |
| `saving_percentual` | Decimal(6,2) | Não | Percentual de saving obtido na cotação. | `19.05` |
