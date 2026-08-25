# Catálogo e Dicionário de Indicadores (KPI_CATALOG)
**Regras de Negócio e Fórmulas Determinísticas · Plurix Procurement**

---

## 1. Princípio Fundamental de Segregação Financeira

> [!IMPORTANT]
> **Regra de Ouro da Controladoria Plurix:**
> `Saving Operacional da API` **NÃO É IGUAL** ao `Saving Reconhecido no Fechamento (Saving 2026)`.
> São conceitos distintos, com fontes e fórmulas separadas. Não devem ser somados ou mesclados sem regras de negócio formalmente aprovadas.

---

## 2. Matriz Completa de Indicadores

| Código | Indicador | Definição de Negócio | Fórmula Determinística | Fonte Primária | Filtros & Condições de Aplicação |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **KPI-01** | **Saving Baseline OPEX** | Economia recorrente obtida em relação aos custos históricos ajustados de 12 meses. | $\sum (\text{Baseline Ajustado} - \text{Valor Fechado})$ | Planilha Fechamento (`Col 20`) | `CAPEX/OPEX == 'OPEX'` E `Tipo == 'SAVING'` |
| **KPI-02** | **Saving Baseline CAPEX** | Economia em projetos de investimento pontuais (ex: retrofit de lojas). | $\sum (\text{Baseline Ajustado} - \text{Valor Fechado})$ | Planilha Fechamento (`Col 20`) | `CAPEX/OPEX == 'CAPEX'` E `Tipo == 'SAVING'` |
| **KPI-03** | **Saving Total Líquido** | Soma consolidada dos ganhos reais de negociação em despesas e investimentos. | $\text{Saving OPEX} + \text{Saving CAPEX}$ | Planilha Fechamento Conciliada | Período de competência fechado/aprovado |
| **KPI-04** | **Custo Evitado (*Cost Avoidance*)** | Prevenção de reajustes de tabela, multas ou aumentos de mercado acima do índice. | $\sum (\text{Proposta Inicial Fornecedor} - \text{Valor Negociado})$ | Planilha Fechamento (`Col 22`) | `Tipo == 'CUSTO EVITADO'` (Não compõe meta de saving de P&L) |
| **KPI-05** | **Impacto Financeiro** | Ganhos não recorrentes decorrentes de desmobilização, venda de ativos ou ressarcimentos. | $\sum (\text{Valor Ressarcido / Recuperado})$ | Planilha Fechamento | `Tipo == 'IMPACTO'` |
| **KPI-06** | **Atingimento da Meta Mensal** | Percentual de realização do saving OPEX frente à meta orçada do mês. | $(\frac{\text{Saving OPEX Mês}}{\text{Meta Orçada Mês}}) \times 100$ | Planilha Fechamento vs Tabela de Metas | Mês de competência selecionado |
| **KPI-07** | **Atingimento da Meta YTD** | Percentual acumulado do saving realizado frente à meta orçada até o mês atual. | $(\frac{\sum_{m=1}^{N} \text{Saving OPEX}_m}{\sum_{m=1}^{N} \text{Meta}_m}) \times 100$ | Planilha Fechamento vs Tabela de Metas | Acumulado dos meses fechados do ano |
| **KPI-08** | **Gap para Meta Anual** | Volume financeiro faltante para atingir o orçamento total do ano (R$ 28,82 MM). | $\text{Meta Anual} - \sum \text{Saving OPEX Realizado}$ | Tabela de Metas | Visão YTD consolidada |
| **KPI-09** | **Saving Operacional da API** | Economia obtida na etapa de rodadas de cotação dentro do portal Organizer. | $\sum (\text{Menor Valor Cotado} - \text{Valor Final Negociado})$ | API Organizer (`retornoapi.json`) | Status $\in$ {'Pedido Enviado', 'Encerrado'} |
| **KPI-10** | **SLA Médio de Cotação** | Tempo médio gasto pelos compradores na fase de envio e resposta de cotações. | $\frac{\sum \text{dias\_atendimento\_sla}}{\text{Total de Requisições com Cotação}}$ | API Organizer / CSV | Requisições não emergenciais com cotação finalizada |
| **KPI-11** | **Prazo Total Médio de Atendimento**| Tempo total decorrido entre a criação da solicitação e a emissão do pedido de compra. | $\frac{\sum (\text{Data Pedido} - \text{Data Criacao})}{\text{Total de Pedidos Gerados}}$ | API Organizer / CSV | Status com pedido gerado |
| **KPI-12** | **Taxa de Emergenciais** | Percentual de compras realizadas fora do fluxo regular planejado. | $(\frac{\text{Qtd Requisições Emergenciais}}{\text{Total de Requisições}}) \times 100$ | API Organizer / CSV | `Tipo de Compra == 'EMERGENCIAL'` |
| **KPI-13** | **Cobertura de Estoque Indireto**| Volume financeiro de materiais de consumo estocados distribuído por faixas de aging. | $\sum \text{Valor em Estoque por Bucket de Dias}$ | Planilha de Estocáveis / ERP | Faixas: 0-30d, 31-60d, 61-90d, 91-120d, 121-180d, >180d |

---

## 3. Matriz de Auditoria das Abas do Dashboard

| Aba do Dashboard | Indicadores Exibidos | Fonte de Dados Oficial | Status de Validação | Tratamento para Produção |
| :--- | :--- | :--- | :--- | :--- |
| **1. Resumo Executivo** | Saving Total, OPEX, CAPEX, Negociações, SLA Médio, Atingimento Metas | Planilha Fechamento + Metas Orçadas | **HOMOLOGADO** | Consome dados consolidados do backend. |
| **2. Saving CAPEX x OPEX** | Donut Modalidade, Ranking Investidas, Termômetro de Metas por Investida | Planilha Fechamento + Metas por Rede | **HOMOLOGADO** | Cálculos determinísticos a partir dos lançamentos validados. |
| **3. Evolução Mensal** | Curva Meta x Realizado, Tabela Mês a Mês | Planilha Fechamento + Tabela de Metas | **HOMOLOGADO** | Exibe apenas meses com status fechado/aprovado. |
| **4. Principais Negociações** | Top 3 por Investida, Tabela Dinâmica com Busca e Filtros | Planilha Fechamento | **HOMOLOGADO** | Tabela dinâmica paginada com filtro por tipo de ganho. |
| **5. Requisições & SLA** | Total Requisições, SLA Cotação, Prazo Médio, Conformidade | API Organizer (Consolidada) | **INTEGRAÇÃO API** | Consome dados operacionais da sincronização da API. |
| **6. SLA por Área** | Tempo Médio por Investida e Departamento | API Organizer (Agrupamento) | **AUDITADO (Requer Cálculo Dinâmico)** | Substituir mock fixo por agrupamento real `AVG(dias) GROUP BY investida, departamento`. |
| **7. Emergenciais** | Total Gasto Emergencial, Ticket Médio, Concentração por Loja | API Organizer (`tipo == 'EMERGENCIAL'`) | **AUDITADO (Requer Cálculo Dinâmico)** | Substituir mock fixo por cálculo real sobre requisições com flag emergencial. |
| **8. Estoque Indireto** | Mapeamento por Unidade, Distribuição por Aging de Cobertura | Planilhas de Fechamento de Estocáveis | **FONTE DEDICADA** | Exibir apenas se a carga da planilha de estocáveis do mês tiver sido importada; caso contrário, exibir empty state claro. |
