/* =====================================================================
   PLURIX PROCUREMENT - CONTROLLER OPERACIONAL (ORGANIZER COCKPIT v5.0)
   Arquitetura de 4 Blocos de Decisão Rápida (< 30s) · Sidebar Retrátil
   100% Alimentado pela API do Organizer · Zero Poluição Visual
   ===================================================================== */

class PlurixApp {
  constructor() {
    this.state = {
      theme: localStorage.getItem('plurix_theme') || 'dark',
      sidebarCollapsed: localStorage.getItem('plurix_sidebar_collapsed') === 'true',
      mode: 'ytd', // 'ytd' | 'month'
      month: 'ago',
      year: 2026,
      activeTab: 'cockpit',
      buyerSearch: '',
      buyerSort: 'volume', // 'volume' | 'sla' | 'backlog' | 'foraSla' | 'conformidade'
      buyerInvestida: 'todas',
      buyerTipoCompra: 'todos',
      investidaSort: 'sla',
      categoriaSort: 'volume',
      investidasCatSubTab: 'investidas', // 'investidas' | 'categorias'
      data: {
        overview: null,
        compradores: null,
        workflow: null,
        investidas: null,
        categorias: null
      },
      monthsOrder: ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'],
      monthNames: {
        jan: 'Jan', fev: 'Fev', mar: 'Mar', abr: 'Abr',
        mai: 'Mai', jun: 'Jun', jul: 'Jul', ago: 'Ago',
        set: 'Set', out: 'Out', nov: 'Nov', dez: 'Dez'
      }
    };

    this.tabTitles = {
      cockpit: {
        title: 'Resumo Operacional de Compras',
        subtitle: 'Situação atual, workflow e prioridades de ação em tempo real'
      },
      compradores: {
        title: 'Gestão de Compradores & SLA',
        subtitle: 'Performance individual, capacidade de atendimento e gargalos por investida e modalidade'
      },
      investidasCat: {
        title: 'Visão por Investidas & Categorias',
        subtitle: 'Desempenho operacional segmentado por rede, loja e família de suprimentos'
      },
      rankingSla: {
        title: 'Ranking Oficial de SLA',
        subtitle: 'Classificação oficial de conformidade e tempo médio de atendimento da equipe'
      },
      fechamentoExec: {
        title: 'Fechamento Executivo Mensal',
        subtitle: 'Relatório consolidado de encerramento mensal com saving e conformidade'
      },
      workflow: {
        title: 'Workflow Operacional & Gargalos',
        subtitle: 'Fluxo ponta a ponta das requisições e identificação de etapas críticas'
      },
      investidas: {
        title: 'Redes Investidas (Lojas)',
        subtitle: 'Prazos de atendimento e compradores dedicados por unidade'
      },
      categorias: {
        title: 'Categorias de Compras',
        subtitle: 'Volume, SLAs e prazos médios por segmento de compra'
      },
      alertasSla: {
        title: 'Radar Preditivo de SLA & Vencimentos',
        subtitle: 'Requisições ativas próximas ao vencimento e gestão ativa de estouros'
      },
      buyerDetail: {
        title: 'Raio-X Executivo do Comprador',
        subtitle: 'Dossiê individual, carteira de lojas e fila completa de solicitações'
      }
    };

    this.init();
  }

  async init() {
    this.initTheme();
    this.initSidebar();
    this.initControls();
    this.initModals();
    await this.fetchRemoteData();
    this.updateHeader();
    this.renderAll();
  }

  // =====================================================================
  // 🍔 GESTÃO DA SIDEBAR RETRÁTIL (MENU HAMBÚRGUER)
  // =====================================================================
  initSidebar() {
    const sidebar = document.getElementById('appSidebar');
    const backdrop = document.getElementById('sidebarBackdrop');
    const btnMobile = document.getElementById('btnMobileMenu');
    const btnToggle = document.getElementById('btnToggleSidebar');

    if (sidebar && this.state.sidebarCollapsed && window.innerWidth > 768) {
      sidebar.classList.add('collapsed');
    }

    const toggleSidebar = () => {
      if (window.innerWidth <= 768) {
        // No mobile, o botão do topo da sidebar fecha o drawer
        if (sidebar) sidebar.classList.remove('mobile-open');
        if (backdrop) backdrop.classList.remove('active');
      } else {
        this.state.sidebarCollapsed = !this.state.sidebarCollapsed;
        localStorage.setItem('plurix_sidebar_collapsed', this.state.sidebarCollapsed ? 'true' : 'false');
        if (sidebar) {
          sidebar.classList.toggle('collapsed', this.state.sidebarCollapsed);
        }
      }
    };

    if (btnToggle) btnToggle.addEventListener('click', toggleSidebar);

    // Controle Mobile Drawer
    const openMobileMenu = () => {
      if (sidebar) {
        sidebar.classList.remove('collapsed');
        sidebar.classList.add('mobile-open');
      }
      if (backdrop) backdrop.classList.add('active');
    };

    const closeMobileMenu = () => {
      if (sidebar) sidebar.classList.remove('mobile-open');
      if (backdrop) backdrop.classList.remove('active');
    };

    if (btnMobile) btnMobile.addEventListener('click', openMobileMenu);
    if (backdrop) backdrop.addEventListener('click', closeMobileMenu);
  }

  // =====================================================================
  // 🌓 GESTÃO DE TEMA (LIGHT / DARK)
  // =====================================================================
  initTheme() {
    this.applyTheme(this.state.theme);

    const btnTheme = document.getElementById('themeToggleBtn');
    if (btnTheme) {
      btnTheme.addEventListener('click', () => {
        const nextTheme = this.state.theme === 'dark' ? 'light' : 'dark';
        this.applyTheme(nextTheme);
      });
    }
  }

  applyTheme(theme) {
    this.state.theme = theme;
    localStorage.setItem('plurix_theme', theme);
    document.documentElement.setAttribute('data-theme', theme);

    const icon = document.getElementById('themeIcon');
    const label = document.getElementById('themeLabel');

    if (icon) {
      icon.setAttribute('data-lucide', theme === 'dark' ? 'moon' : 'sun');
    }
    if (label) {
      label.textContent = theme === 'dark' ? 'Modo Escuro' : 'Modo Claro';
    }

    if (window.lucide) window.lucide.createIcons();
  }

  // =====================================================================
  // 📡 BUSCA DE DADOS NA API
  // =====================================================================
  async fetchRemoteData() {
    const { mode, month, year, buyerSearch, buyerSort, buyerInvestida, buyerTipoCompra, investidaSort, categoriaSort } = this.state;
    const queryParams = `mode=${mode}&month=${month}&year=${year}`;
    const buyerParams = `${queryParams}&search=${encodeURIComponent(buyerSearch)}&sort=${buyerSort}&investida=${encodeURIComponent(buyerInvestida || '')}&tipoCompra=${encodeURIComponent(buyerTipoCompra || '')}`;

    try {
      const [overRes, compRes, wfRes, invRes, catRes] = await Promise.all([
        fetch(`/api/v1/operacional/overview?${queryParams}`),
        fetch(`/api/v1/operacional/compradores?${buyerParams}`),
        fetch(`/api/v1/operacional/workflow?${queryParams}`),
        fetch(`/api/v1/operacional/investidas?${queryParams}&sort=${investidaSort}`),
        fetch(`/api/v1/operacional/categorias?${queryParams}&sort=${categoriaSort}`)
      ]);

      if (overRes.ok) this.state.data.overview = await overRes.json();
      if (compRes.ok) this.state.data.compradores = await compRes.json();
      if (wfRes.ok) this.state.data.workflow = await wfRes.json();
      if (invRes.ok) this.state.data.investidas = await invRes.json();
      if (catRes.ok) this.state.data.categorias = await catRes.json();

      const syncText = document.getElementById('syncStatusText');
      if (syncText) {
        const total = Number(this.state.data.overview?.kpis?.totalSolicitacoes || 0).toLocaleString('pt-BR');
        syncText.textContent = `Conectada (${total} Reqs)`;
      }
    } catch (e) {
      console.warn('[PlurixApp] Falha na comunicação com o servidor:', e);
    }
  }

  // =====================================================================
  // 🎛️ CONTROLES DE INTERFACE
  // =====================================================================
  initControls() {
    const btnYtd = document.getElementById('btnModeYtd');
    const btnMonth = document.getElementById('btnModeMonth');

    if (btnYtd) btnYtd.addEventListener('click', () => this.setMode('ytd'));
    if (btnMonth) btnMonth.addEventListener('click', () => this.setMode('month'));

    this.renderMonthChips();

    // Navegação Sidebar e Bottom Nav
    document.querySelectorAll('.tab-link').forEach(tab => {
      tab.addEventListener('click', () => {
        const tabId = tab.dataset.tab;
        if (tabId) this.switchTab(tabId);
      });
    });
  }

  initModals() {
    // Sincronização API
    const syncModal = document.getElementById('syncModal');
    const btnSync = document.getElementById('btnSyncOrganizer');
    const btnCloseSync = document.getElementById('btnCloseSyncModal');
    const btnCancelSync = document.getElementById('btnCancelSync');
    const btnConfirmSync = document.getElementById('btnConfirmSync');
    const statusBox = document.getElementById('syncModalStatus');

    if (btnSync && syncModal) btnSync.addEventListener('click', () => syncModal.classList.add('active'));
    if (btnCloseSync) btnCloseSync.addEventListener('click', () => syncModal.classList.remove('active'));
    if (btnCancelSync) btnCancelSync.addEventListener('click', () => syncModal.classList.remove('active'));

    if (btnConfirmSync && statusBox) {
      btnConfirmSync.addEventListener('click', async () => {
        btnConfirmSync.disabled = true;
        btnConfirmSync.textContent = 'Sincronizando...';
        statusBox.innerHTML = '<span style="color:var(--plx-accent);">[1/3] Conectando à API do Organizer...</span>\n';

        try {
          const res = await fetch('/api/v1/organizer/sync', { method: 'POST' });
          const json = await res.json();
          if (json.sucesso) {
            statusBox.innerHTML += `<span style="color:var(--emerald);">[2/3] Sucesso: ${json.totalValidos} solicitações atualizadas.</span>\n`;
            statusBox.innerHTML += '<span style="color:var(--text-primary); font-weight:bold;">[3/3] Atualizando Cockpit...</span>';
            setTimeout(async () => {
              await this.fetchRemoteData();
              this.renderAll();
              syncModal.classList.remove('active');
              btnConfirmSync.disabled = false;
              btnConfirmSync.textContent = 'Iniciar Atualização';
            }, 900);
          } else {
            statusBox.innerHTML += `<span style="color:var(--coral);">Não foi possível atualizar no momento. Por favor, tente novamente em instantes.</span>`;
            btnConfirmSync.disabled = false;
            btnConfirmSync.textContent = 'Tentar Novamente';
          }
        } catch (err) {
          statusBox.innerHTML += `<span style="color:var(--coral);">Não foi possível concluir a sincronização. Por favor, tente novamente.</span>`;
          btnConfirmSync.disabled = false;
          btnConfirmSync.textContent = 'Tentar Novamente';
        }
      });
    }

    // Modal Comprador Detail
    const buyerModal = document.getElementById('buyerDetailModal');
    const btnCloseBuyer = document.getElementById('btnCloseBuyerModal');
    if (btnCloseBuyer && buyerModal) btnCloseBuyer.addEventListener('click', () => buyerModal.classList.remove('active'));
    if (buyerModal) {
      buyerModal.addEventListener('click', (e) => {
        if (e.target === buyerModal) buyerModal.classList.remove('active');
      });
    }

    // Modal Investida Detail
    const invModal = document.getElementById('investidaDetailModal');
    const btnCloseInv = document.getElementById('btnCloseInvestidaModal');
    if (btnCloseInv && invModal) btnCloseInv.addEventListener('click', () => invModal.classList.remove('active'));
    if (invModal) {
      invModal.addEventListener('click', (e) => {
        if (e.target === invModal) invModal.classList.remove('active');
      });
    }

    // Modal Categoria Detail
    const catModal = document.getElementById('categoryDetailModal');
    const btnCloseCat = document.getElementById('btnCloseCategoryModal');
    if (btnCloseCat && catModal) btnCloseCat.addEventListener('click', () => catModal.classList.remove('active'));
    if (catModal) {
      catModal.addEventListener('click', (e) => {
        if (e.target === catModal) catModal.classList.remove('active');
      });
    }

    // Modal Linha do Tempo / Rastreabilidade da Solicitação
    const timelineModal = document.getElementById('solicitationTimelineModal');
    const btnCloseTimeline = document.getElementById('btnCloseTimelineModal');
    if (btnCloseTimeline && timelineModal) btnCloseTimeline.addEventListener('click', () => timelineModal.classList.remove('active'));
    if (timelineModal) {
      timelineModal.addEventListener('click', (e) => {
        if (e.target === timelineModal) timelineModal.classList.remove('active');
      });
    }
  }

  setMode(mode) {
    this.state.mode = mode;
    const btnYtd = document.getElementById('btnModeYtd');
    const btnMonth = document.getElementById('btnModeMonth');
    if (btnYtd) btnYtd.classList.toggle('active', mode === 'ytd');
    if (btnMonth) btnMonth.classList.toggle('active', mode === 'month');

    const chipsGroup = document.getElementById('monthSelectorChips');
    if (chipsGroup) chipsGroup.style.display = mode === 'month' ? 'flex' : 'none';

    this.updateHeader();
    this.fetchRemoteData().then(() => this.renderAll());
  }

  setMonth(m) {
    this.state.month = m;
    document.querySelectorAll('.month-chip').forEach(c => c.classList.toggle('active', c.dataset.month === m));
    this.updateHeader();
    this.fetchRemoteData().then(() => this.renderAll());
  }

  updateHeader() {
    const tabId = this.state.activeTab;
    let info = this.tabTitles[tabId];
    if (tabId === 'buyerDetail') {
      info = {
        title: `Raio-X: ${this._currentBuyerName || 'Comprador'}`,
        subtitle: 'Dossiê individual de produtividade e capacidade'
      };
    } else if (tabId === 'categoryDetail') {
      info = {
        title: `Raio-X: ${this._currentCategoryName || 'Categoria'}`,
        subtitle: 'Dossiê analítico de categoria, volumetria e SLAs'
      };
    }
    if (!info) info = { title: 'Resumo Operacional', subtitle: '' };

    const titleElem = document.getElementById('pageMainTitle');
    const subElem = document.getElementById('pageMainSubtitle');
    
    const periodDesc = this.state.mode === 'ytd' 
      ? `Acumulado YTD ${this.state.year}` 
      : `${this.state.monthNames[this.state.month]}/${this.state.year}`;

    if (titleElem) titleElem.textContent = info.title;
    if (subElem) subElem.textContent = `${info.subtitle} · (${periodDesc})`;
  }

  getCalendarDaysDiff(startDate, endDate) {
    if (!startDate || !endDate) return 0;
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (isNaN(start.getTime()) || isNaN(end.getTime()) || start >= end) return 0;
    return Math.max(0, Math.round((end - start) / (1000 * 60 * 60 * 24)));
  }

  /**
   * Avaliação Estrita do SLA de Compras em DIAS CORRIDOS:
   * 1. Etapas Anteriores à Cotação (Solicitação, Triagem, etc.): SLA do Comprador NÃO começou (0d / Fora de Compras).
   * 2. Etapa de Cotação: Tempo corrente em DIAS CORRIDOS de cotação contra a meta (10d, 15d, 45d).
   * 3. Etapas Posteriores (Validação Técnica, Aprovação OC, etc.) & Concluídas: Tempo de cotação congelado na entrega da cotação.
   * 4. Aguardando Entrega: Concluído do ponto de vista do comprador.
   */
  getTicketSlaEvaluation(ch) {
    const statusLower = (ch.status_nome || '').toLowerCase().trim();
    const meta = ch.meta_sla_dias || 10;
    
    // 1. Finalizadas / Pedido Emitido: possui número de PC gerado, status de pedido/encerramento ou data_finalizacao
    const hasOrderNumber = ch.numero_solicitacao && String(ch.numero_solicitacao).toUpperCase().startsWith('PC');
    const isFinished = hasOrderNumber || statusLower === 'encerrado' || statusLower === 'pedido enviado' || statusLower.includes('entrega') || statusLower.includes('concluid') || !!ch.data_finalizacao;
    
    // 2. Pré-Cotação (Fases 1, 2 e 3: Solicitação, Validação, Validação Técnica) - Comprador ainda não iniciou cotação
    const isPreCotacao = statusLower.includes('solicita') || statusLower.includes('valid') || statusLower.includes('triagem') || statusLower.includes('abert');
    
    // 3. Em Cotação (Fase 4: Cotação) - Comprador negociando com fornecedores
    const isEmCotacao = statusLower.includes('cota');

    let diasCotacao = 0;
    let label = 'No prazo';
    let isOver = false;
    let cor = 'var(--emerald)';
    let badgeHtml = '';

    if (isPreCotacao) {
      diasCotacao = 0;
      label = 'Pré-Cotação';
      isOver = false;
      cor = 'var(--text-muted)';
      badgeHtml = `
        <div style="font-size:12.5px; font-weight:700; color:var(--text-muted);">— <span style="font-size:10px; color:var(--text-dim);">/ ${meta}d</span></div>
        <div style="font-size:9.5px; color:var(--text-muted); font-weight:700;">Pré-Cotação</div>
      `;
    } else if (isEmCotacao) {
      diasCotacao = this.getCalendarDaysDiff(ch.data_cotacao || ch.data_criacao, new Date());
      isOver = diasCotacao > meta;
      label = isOver ? `+${Math.round(diasCotacao - meta)}d acima` : 'No prazo';
      cor = isOver ? 'var(--coral)' : 'var(--amber)';
      badgeHtml = `
        <div style="font-size:12.5px; font-weight:800; color:${cor};">${diasCotacao}d <span style="font-size:10px; color:var(--text-muted);">/ ${meta}d</span></div>
        <div style="font-size:9.5px; color:${cor}; font-weight:700;">${label}</div>
      `;
    } else {
      // Pós-Cotação (Validação Técnica, Aprovação OC) ou Concluído (Pedido Enviado, Aguardando Entrega, Encerrado)
      if (ch.dias_atendimento_sla !== null && ch.dias_atendimento_sla !== undefined && ch.dias_atendimento_sla >= 0) {
        diasCotacao = Math.round(ch.dias_atendimento_sla);
      } else {
        const startD = ch.data_cotacao || ch.data_criacao;
        const endD = ch.data_aprovacao_pedido || ch.data_finalizacao || ch.data_aprovacao;
        diasCotacao = startD && endD ? this.getCalendarDaysDiff(startD, endD) : 0;
      }
      isOver = diasCotacao > meta;
      if (isFinished) {
        label = isOver ? `Atendido (+${diasCotacao - meta}d)` : 'Atendido';
        cor = isOver ? 'var(--coral)' : 'var(--emerald)';
      } else {
        label = isOver ? `Cotação (+${diasCotacao - meta}d)` : 'Cotação OK';
        cor = isOver ? 'var(--coral)' : 'var(--emerald)';
      }
      badgeHtml = `
        <div style="font-size:12.5px; font-weight:800; color:${cor};">${diasCotacao}d <span style="font-size:10px; color:var(--text-muted);">/ ${meta}d</span></div>
        <div style="font-size:9.5px; color:${cor}; font-weight:700;">${label}</div>
      `;
    }

    return {
      isFinished,
      isPreCotacao,
      isEmCotacao,
      diasCotacao,
      meta,
      isOver,
      label,
      cor,
      badgeHtml
    };
  }

  switchTab(tabId) {
    if (tabId === 'investidas') {
      tabId = 'investidasCategorias';
      this.state.investidasCatSubTab = 'investidas';
    } else if (tabId === 'categorias') {
      tabId = 'investidasCategorias';
      this.state.investidasCatSubTab = 'categorias';
    }

    this.state.activeTab = tabId;
    
    // Atualiza links da sidebar e bottom nav
    document.querySelectorAll('.sidebar-nav .tab-link').forEach(t => t.classList.toggle('active', t.dataset.tab === tabId));
    document.querySelectorAll('.mobile-bottom-nav .tab-link').forEach(t => t.classList.toggle('active', t.dataset.tab === tabId));
    document.querySelectorAll('.section-pane').forEach(p => p.classList.toggle('active', p.id === tabId || p.id === `${tabId}Pane`));

    // Fecha drawer no mobile ao navegar
    const sidebar = document.getElementById('appSidebar');
    const backdrop = document.getElementById('sidebarBackdrop');
    if (sidebar) sidebar.classList.remove('mobile-open');
    if (backdrop) backdrop.classList.remove('active');

    this.updateHeader();
    this.renderCurrentTab();
  }

  renderMonthChips() {
    const container = document.getElementById('monthSelectorChips');
    if (!container) return;
    container.innerHTML = '';

    this.state.monthsOrder.forEach(m => {
      const btn = document.createElement('button');
      btn.className = `month-chip ${this.state.month === m ? 'active' : ''}`;
      btn.dataset.month = m;
      btn.textContent = this.state.monthNames[m];
      btn.addEventListener('click', () => {
        if (this.state.mode !== 'month') this.setMode('month');
        this.setMonth(m);
      });
      container.appendChild(btn);
    });

    container.style.display = this.state.mode === 'month' ? 'flex' : 'none';
  }

  renderAll() {
    this.renderCurrentTab();
  }

  renderCurrentTab() {
    switch (this.state.activeTab) {
      case 'cockpit':
        this.renderCockpit();
        break;
      case 'compradores':
        this.renderCompradores();
        break;
      case 'workflow':
        this.renderWorkflow();
        break;
      case 'investidasCategorias':
      case 'investidas':
      case 'categorias':
        this.renderInvestidasCategorias();
        break;
      case 'alertasSla':
        this.renderAlertasSla();
        break;
      case 'buyerDetail':
        if (this._currentBuyerName) this.openBuyerDetail(this._currentBuyerName);
        break;
      case 'categoryDetail':
        if (this._currentCategoryName) this.openCategoryDetail(this._currentCategoryName);
        break;
    }
    if (window.lucide) window.lucide.createIcons();
  }

  // =====================================================================
  // 🎨 HELPERS VISUAIS
  // =====================================================================
  getInitials(name) {
    if (!name) return 'PL';
    const parts = name.trim().split(' ').filter(p => p.length > 2);
    if (parts.length === 0) return name.slice(0, 2).toUpperCase();
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  getSlaBadge(days) {
    const d = parseFloat(days) || 0;
    if (d <= 6) return `<span class="sla-badge fast">${d} dias</span>`;
    if (d <= 10) return `<span class="sla-badge regular">${d} dias</span>`;
    if (d <= 15) return `<span class="sla-badge warning">${d} dias</span>`;
    return `<span class="sla-badge slow">${d} dias</span>`;
  }

  // =====================================================================
  // 1. RENDER: HOME / RESUMO (4 BLOCOS DE DECISÃO EM < 30 SEGUNDOS)
  // =====================================================================
  renderCockpit() {
    const container = document.getElementById('cockpitContent') || document.getElementById('overviewContent');
    if (!container) return;

    const ov = this.state.data.overview;
    if (!ov) {
      container.innerHTML = '<div style="padding:40px; text-align:center; color:var(--text-muted);">Carregando Resumo...</div>';
      return;
    }

    const k = ov.kpis || {};
    const mod = ov.modalidadesDetalhe || {};
    const radar = ov.radarResumo || {};
    const topBacklog = ov.top5MaiorBacklogCompradores || [];
    const rankingInvestidas = ov.rankingInvestidasHome || [];

    container.innerHTML = `
      <!-- =====================================================================
           NÍVEL 1: OS 4 GRANDES NÚMEROS (HERO KPIS EM DESTAQUE)
           ===================================================================== -->
      <div class="hero-kpis-grid">
        
        <!-- CARD 1: VOLUME TOTAL -->
        <div class="hero-kpi-card kpi-primary">
          <div class="hero-kpi-header">
            <span class="hero-kpi-label">Volume de Requisições</span>
            <div class="hero-kpi-icon-wrap">
              <i data-lucide="inbox" style="width:14px; height:14px;"></i>
            </div>
          </div>
          <div class="hero-kpi-val">${Number(k.totalSolicitacoes || 0).toLocaleString('pt-BR')}</div>
          <div class="hero-kpi-sub">
            <span>Mat: <strong>${Number(k.totalSpotMateriais || 0).toLocaleString('pt-BR')}</strong></span>
            <span>·</span>
            <span>Serv: <strong>${Number(k.totalSpotServicos || 0).toLocaleString('pt-BR')}</strong></span>
            <span>·</span>
            <span>Estrat: <strong>${Number(k.totalEstrategicas || 0).toLocaleString('pt-BR')}</strong></span>
          </div>
        </div>

        <!-- CARD 2: REQUISIÇÕES EM ABERTO (INTERATIVO) -->
        <div class="hero-kpi-card kpi-amber btn-jump-to-tab" data-tab="workflow" style="cursor:pointer;" title="Clique para ver o Workflow detalhado">
          <div class="hero-kpi-header">
            <span class="hero-kpi-label" style="color:var(--amber);">Requisições em Aberto</span>
            <div class="hero-kpi-icon-wrap" style="background:var(--amber-bg); color:var(--amber);">
              <i data-lucide="clock" style="width:14px; height:14px;"></i>
            </div>
          </div>
          <div class="hero-kpi-val" style="color:var(--amber);">${Number(k.backlogAtivo || 0).toLocaleString('pt-BR')}</div>
          <div class="hero-kpi-sub" style="color:var(--amber);">
            <i data-lucide="check-circle-2" style="width:12px; height:12px;"></i>
            <strong>${Number(k.totalConcluidas || 0).toLocaleString('pt-BR')}</strong> concluídas / entregues
          </div>
        </div>

        <!-- CARD 3: SLA MÉDIO COTAÇÃO (INTERATIVO) -->
        <div class="hero-kpi-card kpi-primary btn-jump-to-tab" data-tab="compradores" style="cursor:pointer;" title="Clique para ver o desempenho dos compradores">
          <div class="hero-kpi-header">
            <span class="hero-kpi-label">SLA Médio de Cotação</span>
            <div class="hero-kpi-icon-wrap">
              <i data-lucide="timer" style="width:14px; height:14px;"></i>
            </div>
          </div>
          <div class="hero-kpi-val" style="color:var(--plx-accent);">${k.slaCotacaoMedio || 0}<span style="font-size:14px; font-weight:700; color:var(--text-muted); margin-left:2px;">dias</span></div>
          <div class="hero-kpi-sub">
            <span style="color:var(--text-secondary); font-size:11px;">Média real em dias corridos</span>
          </div>
        </div>

        <!-- CARD 4: CONFORMIDADE DE SLA (INTERATIVO) -->
        <div class="hero-kpi-card kpi-emerald btn-jump-to-tab" data-tab="alertasSla" style="cursor:pointer;" title="Clique para ver o Radar de Alertas">
          <div class="hero-kpi-header">
            <span class="hero-kpi-label">Taxa de Conformidade</span>
            <div class="hero-kpi-icon-wrap" style="background:var(--emerald-bg); color:var(--emerald);">
              <i data-lucide="shield-check" style="width:14px; height:14px;"></i>
            </div>
          </div>
          <div class="hero-kpi-val" style="color:var(--emerald);">${Math.round(k.taxaConformidadePct || 0)}<span style="font-size:16px;">%</span></div>
          <div class="hero-kpi-sub">
            <span style="color:var(--text-secondary); font-size:11px;"><strong>${Number(k.totalDentroSla || 0).toLocaleString('pt-BR')}</strong> de <strong>${Number(k.totalComSla || 0).toLocaleString('pt-BR')}</strong> no prazo</span>
          </div>
        </div>

      </div>

      <!-- =====================================================================
           NÍVEL 2: MODALIDADES DE COMPRA & RADAR DE RISCO (2 COLUNAS)
           ===================================================================== -->
      <div class="exec-grid-2" style="margin-bottom:16px;">
        
        <!-- COLUNA 1: MODALIDADES DE COMPRA -->
        <div class="card" style="padding:16px 18px;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
            <div>
              <div class="card-title" style="font-size:13.5px;">📦 Desempenho por Modalidade de Compra</div>
              <div class="card-subtitle">Volume, prazos médios e conformidade por modalidade de aquisição</div>
            </div>
            <span class="tag-pill" style="font-size:10px; padding:2px 8px;">Metas Oficiais</span>
          </div>

          <div style="display:flex; flex-direction:column; gap:8px;">
            <!-- Spot Materiais -->
            <div style="background:var(--surface-subtle); border:1px solid var(--border-subtle); border-radius:6px; padding:10px 14px; border-left:3px solid var(--plx-primary);">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
                <div style="display:flex; align-items:center; gap:8px;">
                  <strong style="font-size:12.5px; color:var(--text-primary);">Spot Materiais</strong>
                  <span class="tag-pill" style="font-size:9.5px; padding:1px 5px;">Meta: 10d</span>
                </div>
                <span class="sla-badge ${mod.spotMateriais?.conformidadePct >= 85 ? 'fast' : 'warning'}" style="font-size:10.5px;">
                  ${Math.round(mod.spotMateriais?.conformidadePct || 0)}% no prazo
                </span>
              </div>
              <div style="display:flex; justify-content:space-between; align-items:center; font-size:11px; color:var(--text-secondary);">
                <span>Volume: <strong>${Number(mod.spotMateriais?.total || 0).toLocaleString('pt-BR')}</strong> · Aberto: <strong>${Number(mod.spotMateriais?.backlog || 0).toLocaleString('pt-BR')}</strong></span>
                <span>SLA Médio: <strong style="color:var(--plx-accent);">${mod.spotMateriais?.slaMedio || 0} dias</strong></span>
              </div>
            </div>

            <!-- Spot Serviços -->
            <div style="background:var(--surface-subtle); border:1px solid var(--border-subtle); border-radius:6px; padding:10px 14px; border-left:3px solid var(--plx-accent);">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
                <div style="display:flex; align-items:center; gap:8px;">
                  <strong style="font-size:12.5px; color:var(--text-primary);">Spot Serviços</strong>
                  <span class="tag-pill" style="font-size:9.5px; padding:1px 5px;">Meta: 15d</span>
                </div>
                <span class="sla-badge ${mod.spotServicos?.conformidadePct >= 85 ? 'fast' : 'warning'}" style="font-size:10.5px;">
                  ${Math.round(mod.spotServicos?.conformidadePct || 0)}% no prazo
                </span>
              </div>
              <div style="display:flex; justify-content:space-between; align-items:center; font-size:11px; color:var(--text-secondary);">
                <span>Volume: <strong>${Number(mod.spotServicos?.total || 0).toLocaleString('pt-BR')}</strong> · Aberto: <strong>${Number(mod.spotServicos?.backlog || 0).toLocaleString('pt-BR')}</strong></span>
                <span>SLA Médio: <strong style="color:var(--plx-accent);">${mod.spotServicos?.slaMedio || 0} dias</strong></span>
              </div>
            </div>

            <!-- Estratégico -->
            <div style="background:var(--surface-subtle); border:1px solid var(--border-subtle); border-radius:6px; padding:10px 14px; border-left:3px solid var(--amber);">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
                <div style="display:flex; align-items:center; gap:8px;">
                  <strong style="font-size:12.5px; color:var(--text-primary);">Estratégico</strong>
                  <span class="tag-pill" style="font-size:9.5px; padding:1px 5px;">Meta: 45d</span>
                </div>
                <span class="sla-badge ${mod.estrategica?.conformidadePct >= 85 ? 'fast' : 'warning'}" style="font-size:10.5px;">
                  ${Math.round(mod.estrategica?.conformidadePct || 0)}% no prazo
                </span>
              </div>
              <div style="display:flex; justify-content:space-between; align-items:center; font-size:11px; color:var(--text-secondary);">
                <span>Volume: <strong>${Number(mod.estrategica?.total || 0).toLocaleString('pt-BR')}</strong> · Aberto: <strong>${Number(mod.estrategica?.backlog || 0).toLocaleString('pt-BR')}</strong></span>
                <span>SLA Médio: <strong style="color:var(--plx-accent);">${mod.estrategica?.slaMedio || 0} dias</strong></span>
              </div>
            </div>
          </div>
        </div>

        <!-- COLUNA 2: RADAR DE RISCO & SLA (CLEAN & INTERATIVO) -->
        <div class="card" style="padding:16px 18px; display:flex; flex-direction:column; justify-content:space-between;">
          <div>
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
              <div>
                <div class="card-title" style="font-size:13.5px;">⚡ Radar de Risco &amp; Vencimentos</div>
                <div class="card-subtitle">Requisições ativas classificadas por urgência de atendimento</div>
              </div>
              <button class="btn btn-subtle btn-sm btn-nav-to-alerts" style="font-size:11px; font-weight:700; padding:4px 8px;">
                <span>Ver Radar</span>
                <i data-lucide="arrow-right" style="width:12px; height:12px;"></i>
              </button>
            </div>

            <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-bottom:12px;">
              <div class="radar-ranking-item btn-jump-to-alert" data-urgency="vencido" style="cursor:pointer; padding:10px 12px; border-left:3px solid var(--coral);" title="Ver requisições vencidas">
                <div>
                  <div style="font-size:18px; font-weight:900; color:var(--coral); line-height:1.1;">
                    ${Number(radar.vencidos || 0).toLocaleString('pt-BR')}
                  </div>
                  <div style="font-size:10.5px; font-weight:700; color:var(--text-muted); margin-top:2px;">
                    Já Estourados
                  </div>
                </div>
                <span class="pulse-badge vencido" style="font-size:9.5px; padding:1px 5px;">Crítico</span>
              </div>

              <div class="radar-ranking-item btn-jump-to-alert" data-urgency="critico_24h" style="cursor:pointer; padding:10px 12px; border-left:3px solid #F97316;" title="Ver requisições que vencem em < 24h">
                <div>
                  <div style="font-size:18px; font-weight:900; color:#F97316; line-height:1.1;">
                    ${Number(radar.critico24h || 0).toLocaleString('pt-BR')}
                  </div>
                  <div style="font-size:10.5px; font-weight:700; color:var(--text-muted); margin-top:2px;">
                    Vence em &lt; 24h
                  </div>
                </div>
                <span class="pulse-badge critico_24h" style="font-size:9.5px; padding:1px 5px;">Atenção</span>
              </div>

              <div class="radar-ranking-item btn-jump-to-alert" data-urgency="alerta_72h" style="cursor:pointer; padding:10px 12px; border-left:3px solid var(--amber);" title="Ver requisições que vencem em 24h-72h">
                <div>
                  <div style="font-size:18px; font-weight:900; color:var(--amber); line-height:1.1;">
                    ${Number(radar.alerta72h || 0).toLocaleString('pt-BR')}
                  </div>
                  <div style="font-size:10.5px; font-weight:700; color:var(--text-muted); margin-top:2px;">
                    Vence 24h-72h
                  </div>
                </div>
                <span class="pulse-badge alerta_72h" style="font-size:9.5px; padding:1px 5px;">Alerta</span>
              </div>

              <div class="radar-ranking-item btn-jump-to-alert" data-urgency="no_prazo" style="cursor:pointer; padding:10px 12px; border-left:3px solid var(--emerald);" title="Ver requisições no prazo">
                <div>
                  <div style="font-size:18px; font-weight:900; color:var(--emerald); line-height:1.1;">
                    ${Number(radar.noPrazo || 0).toLocaleString('pt-BR')}
                  </div>
                  <div style="font-size:10.5px; font-weight:700; color:var(--text-muted); margin-top:2px;">
                    No Prazo Seguro
                  </div>
                </div>
                <span class="pulse-badge no_prazo" style="font-size:9.5px; padding:1px 5px;">OK</span>
              </div>
            </div>
          </div>

          <div style="background:var(--surface-subtle); border-radius:6px; padding:8px 12px; font-size:11px; color:var(--text-secondary); display:flex; justify-content:space-between; align-items:center;">
            <span>Total de solicitações ativas em cotação:</span>
            <strong style="color:var(--text-primary); font-size:12px;">${Number(radar.totalAtivos || 0).toLocaleString('pt-BR')} solicitações</strong>
          </div>
        </div>

      </div>

      <!-- =====================================================================
           NÍVEL 3: REDES INVESTIDAS & BALANÇO DA EQUIPE (2 COLUNAS)
           ===================================================================== -->
      <div class="exec-grid-2">
        
        <!-- COLUNA 1: REDES INVESTIDAS -->
        <div class="card" style="padding:16px 18px;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
            <div>
              <div class="card-title" style="font-size:13.5px;">🏢 Panorama por Rede Investida</div>
              <div class="card-subtitle">Demanda, fila e tempo médio de atendimento por unidade</div>
            </div>
            <span style="font-size:11px; color:var(--text-muted);">${rankingInvestidas.length} Redes</span>
          </div>

          <div style="display:flex; flex-direction:column; gap:6px;">
            ${rankingInvestidas.map(inv => `
              <div class="radar-ranking-item btn-open-investida" data-investida="${inv.investida}" style="cursor:pointer;" title="Clique para ver o raio-x da rede ${inv.investida}">
                <div style="display:flex; justify-content:space-between; width:100%; align-items:center;">
                  <div style="display:flex; align-items:center; gap:8px;">
                    <i data-lucide="store" style="width:13px; height:13px; color:var(--plx-accent);"></i>
                    <strong style="color:var(--text-primary); font-size:12px;">${inv.investida}</strong>
                    <span style="font-size:10.5px; color:var(--text-muted);">(${inv.total_solicitacoes} reqs · ${inv.backlog_ativo} aberto)</span>
                  </div>
                  <div style="display:flex; align-items:center; gap:8px;">
                    <span style="font-size:11px; color:var(--text-secondary);">SLA: <strong>${inv.sla_cotacao_medio || 0}d</strong></span>
                    <span class="sla-badge ${inv.taxa_conformidade_pct >= 85 ? 'fast' : (inv.taxa_conformidade_pct >= 70 ? 'warning' : 'slow')}" style="font-size:10px; padding:2px 6px;">
                      ${Math.round(inv.taxa_conformidade_pct || 0)}%
                    </span>
                  </div>
                </div>
              </div>
            `).join('')}
          </div>
        </div>

        <!-- COLUNA 2: GESTÃO DE CARGA DA EQUIPE (COMPRADORES) -->
        <div class="card" style="padding:16px 18px;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
            <div>
              <div class="card-title" style="font-size:13.5px;">👥 Gestão de Carga da Equipe de Compras</div>
              <div class="card-subtitle">Compradores com maior fila ativa no período para balanceamento</div>
            </div>
            <span style="font-size:11px; color:var(--text-muted);">Top 5 Fila</span>
          </div>

          <div style="display:flex; flex-direction:column; gap:6px;">
            ${topBacklog.slice(0, 5).map((b, idx) => `
              <div class="radar-ranking-item btn-open-buyer" data-comprador="${b.comprador}" style="cursor:pointer;" title="Clique para abrir o Raio-X de ${b.comprador}">
                <div style="display:flex; align-items:center; gap:8px;">
                  <span style="font-size:11px; font-weight:800; color:var(--text-muted); width:14px;">#${idx + 1}</span>
                  <div class="buyer-avatar" style="width:24px; height:24px; font-size:9.5px; border-radius:6px; background:var(--plx-primary);">${this.getInitials(b.comprador)}</div>
                  <div>
                    <div style="font-size:12px; font-weight:700; color:var(--text-primary);">${b.comprador}</div>
                    <div style="font-size:10px; color:var(--text-muted);">${b.total_solicitacoes} total · SLA: ${b.sla_cotacao_medio}d</div>
                  </div>
                </div>
                <div style="display:flex; align-items:center; gap:8px;">
                  <div style="text-align:right;">
                    <strong style="color:var(--amber); font-size:12.5px;">${Number(b.backlog_ativo).toLocaleString('pt-BR')}</strong>
                    <span style="font-size:9.5px; color:var(--text-muted); margin-left:2px;">aberto</span>
                  </div>
                  <i data-lucide="chevron-right" style="width:14px; height:14px; color:var(--text-muted); opacity:0.6;"></i>
                </div>
              </div>
            `).join('')}
          </div>
        </div>

      </div>
    `;

    // Eventos
    container.querySelectorAll('.btn-open-buyer').forEach(btn => {
      btn.addEventListener('click', () => {
        const comp = btn.dataset.comprador;
        if (comp) this.openBuyerDetail(comp);
      });
    });

    container.querySelectorAll('.btn-open-investida').forEach(btn => {
      btn.addEventListener('click', () => {
        const inv = btn.dataset.investida;
        if (inv) this.openInvestidaDetailModal(inv);
      });
    });

    container.querySelectorAll('.btn-jump-to-tab').forEach(el => {
      el.addEventListener('click', () => {
        const tab = el.dataset.tab;
        if (tab) this.switchTab(tab);
      });
    });

    container.querySelectorAll('.btn-jump-to-alert').forEach(el => {
      el.addEventListener('click', () => {
        const urgency = el.dataset.urgency;
        this.state.alertasUrgencia = urgency;
        this.switchTab('alertasSla');
      });
    });

    const btnNavAlerts = container.querySelector('.btn-nav-to-alerts');
    if (btnNavAlerts) {
      btnNavAlerts.addEventListener('click', () => {
        this.switchTab('alertasSla');
      });
    }

    if (window.lucide) window.lucide.createIcons();
  }

  // =====================================================================
  // 2. RENDER: COMPRADORES (CARDS DESTAQUES + TABELA LIMPA)
  // =====================================================================
  renderCompradores() {
    const container = document.getElementById('compradoresContent');
    if (!container) return;

    const data = this.state.data.compradores;
    if (!data) {
      container.innerHTML = '<div style="padding:40px; text-align:center; color:var(--text-muted);">Carregando compradores...</div>';
      return;
    }

    const buyers = data.compradores || [];
    const totais = data.totaisEquipe || {
      totalCompradores: buyers.length,
      volumeTotal: buyers.reduce((s, b) => s + (b.totalSolicitacoes || 0), 0),
      totalBacklog: buyers.reduce((s, b) => s + (b.backlogAtivo || 0), 0),
      totalBacklogDentroSla: buyers.reduce((s, b) => s + (b.backlogDentroSla || 0), 0),
      totalBacklogForaSla: buyers.reduce((s, b) => s + (b.backlogForaSla || 0), 0),
      pctBacklogDentroSla: 0
    };
    if (totais.totalBacklog > 0 && !totais.pctBacklogDentroSla) {
      totais.pctBacklogDentroSla = parseFloat(((totais.totalBacklogDentroSla / totais.totalBacklog) * 100).toFixed(1));
    }

    const hasActiveFilter = (this.state.buyerInvestida && this.state.buyerInvestida !== 'todas') || (this.state.buyerTipoCompra && this.state.buyerTipoCompra !== 'todos');

    container.innerHTML = `
      <!-- 1. CARDS DE INDICADORES DA EQUIPE (RECALCULAM COM A SEGMENTAÇÃO) -->
      <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(220px, 1fr)); gap:12px; margin-bottom:20px;">
        <div class="card" style="padding:14px 16px; border-top:3px solid var(--plx-primary);">
          <div style="display:flex; justify-content:space-between; align-items:flex-start;">
            <div>
              <div style="font-size:11px; font-weight:800; color:var(--text-muted); text-transform:uppercase;">👥 Equipe de Compras</div>
              <div style="font-size:22px; font-weight:900; color:var(--text-primary); margin-top:2px;">
                ${buyers.length} <span style="font-size:11.5px; font-weight:500; color:var(--text-muted);">compradores</span>
              </div>
            </div>
            <span class="sla-badge fast">${hasActiveFilter ? 'Filtrado' : 'Ativos'}</span>
          </div>
          <div style="font-size:11px; color:var(--text-secondary); margin-top:6px;">
            Volume Total: <strong>${Number(totais.volumeTotal || 0).toLocaleString('pt-BR')}</strong> reqs
          </div>
        </div>

        <div class="card" style="padding:14px 16px; border-top:3px solid var(--amber);">
          <div style="display:flex; justify-content:space-between; align-items:flex-start;">
            <div>
              <div style="font-size:11px; font-weight:800; color:var(--amber); text-transform:uppercase;">⏳ Em Aberto Total</div>
              <div style="font-size:22px; font-weight:900; color:var(--amber); margin-top:2px;">
                ${Number(totais.totalBacklog || 0).toLocaleString('pt-BR')} <span style="font-size:11.5px; font-weight:500; color:var(--text-muted);">reqs</span>
              </div>
            </div>
            <span class="sla-badge warning">Em Cotação</span>
          </div>
          <div style="font-size:11px; color:var(--text-muted); margin-top:6px;">
            Fila ativa em negociação com fornecedores
          </div>
        </div>

        <div class="card" style="padding:14px 16px; border-top:3px solid var(--emerald); background:rgba(16, 185, 129, 0.03);">
          <div style="display:flex; justify-content:space-between; align-items:flex-start;">
            <div>
              <div style="font-size:11px; font-weight:800; color:var(--emerald); text-transform:uppercase;">🟢 Em Aberto Dentro do SLA</div>
              <div style="font-size:22px; font-weight:900; color:var(--emerald); margin-top:2px;">
                ${Number(totais.totalBacklogDentroSla || 0).toLocaleString('pt-BR')} <span style="font-size:11.5px; font-weight:500; color:var(--text-muted);">reqs</span>
              </div>
            </div>
            <span class="sla-badge fast">${totais.pctBacklogDentroSla || 0}% no Prazo</span>
          </div>
          <div style="font-size:11px; color:var(--text-secondary); margin-top:6px;">
            Requisições ativas dentro da meta oficial de SLA
          </div>
        </div>

        <div class="card" style="padding:14px 16px; border-top:3px solid ${totais.totalBacklogForaSla > 0 ? 'var(--coral)' : 'var(--emerald)'}; background:${totais.totalBacklogForaSla > 0 ? 'rgba(239, 68, 68, 0.03)' : 'transparent'};">
          <div style="display:flex; justify-content:space-between; align-items:flex-start;">
            <div>
              <div style="font-size:11px; font-weight:800; color:${totais.totalBacklogForaSla > 0 ? 'var(--coral)' : 'var(--emerald)'}; text-transform:uppercase;">🔴 Em Aberto Fora do SLA</div>
              <div style="font-size:22px; font-weight:900; color:${totais.totalBacklogForaSla > 0 ? 'var(--coral)' : 'var(--emerald)'}; margin-top:2px;">
                ${Number(totais.totalBacklogForaSla || 0).toLocaleString('pt-BR')} <span style="font-size:11.5px; font-weight:500; color:var(--text-muted);">reqs</span>
              </div>
            </div>
            <span class="pulse-badge ${totais.totalBacklogForaSla > 0 ? 'vencido' : 'no_prazo'}">${totais.pctBacklogForaSla || 0}% Estouradas</span>
          </div>
          <div style="font-size:11px; color:var(--text-secondary); margin-top:6px;">
            Requisições ativas que já ultrapassaram a meta de SLA
          </div>
        </div>
      </div>

      <!-- 2. TABELA DE COMPRADORES COM SEGMENTAÇÃO POR INVESTIDA & TIPO DE COMPRA -->
      <div class="table-panel">
        <div class="table-toolbar" style="flex-direction:column; align-items:stretch; gap:12px;">
          <!-- Linha 1: Filtros de Segmentação Rápida -->
          <div style="display:flex; align-items:center; justify-content:space-between; gap:10px; flex-wrap:wrap;">
            <div style="display:flex; align-items:center; gap:10px; flex-wrap:wrap;">
              <div style="display:flex; align-items:center; gap:6px;">
                <span style="font-size:12px; font-weight:800; color:var(--text-primary);">🏢 Loja / Investida:</span>
                <select id="buyerInvestidaFilter" class="select-filter-clean">
                  <option value="todas" ${this.state.buyerInvestida === 'todas' ? 'selected' : ''}>🏢 Todas as Investidas</option>
                  ${(data.opcoesFiltros?.investidas || []).filter(i => i !== 'todas').map(inv => `
                    <option value="${inv}" ${this.state.buyerInvestida === inv ? 'selected' : ''}>${inv}</option>
                  `).join('')}
                </select>
              </div>

              <div style="display:flex; align-items:center; gap:6px;">
                <span style="font-size:12px; font-weight:800; color:var(--text-primary);">📦 Tipo de Compra:</span>
                <select id="buyerTipoFilter" class="select-filter-clean">
                  ${(data.opcoesFiltros?.tiposCompra || []).map(t => `
                    <option value="${t.id}" ${this.state.buyerTipoCompra === t.id ? 'selected' : ''}>${t.label}</option>
                  `).join('')}
                </select>
              </div>

              ${hasActiveFilter ? `
                <button id="btnResetBuyerTeamFilters" class="btn btn-secondary btn-sm" style="font-size:11px; padding:4px 8px;">
                  <i data-lucide="rotate-ccw" style="width:12px; height:12px;"></i>
                  <span>Limpar Filtros</span>
                </button>
              ` : ''}
            </div>

            <div style="font-size:12px; color:var(--text-muted);">
              <strong>${buyers.length}</strong> compradores na visualização
            </div>
          </div>

          <!-- Linha 2: Busca e Ordenação -->
          <div style="display:flex; align-items:center; justify-content:space-between; gap:10px; flex-wrap:wrap; border-top:1px solid var(--border-subtle); padding-top:10px;">
            <div class="search-input-clean" style="max-width:320px;">
              <i data-lucide="search" style="width:13px; height:13px; color:var(--text-muted);"></i>
              <input type="text" id="buyerSearchInput" placeholder="Buscar comprador ou loja..." value="${this.state.buyerSearch || ''}">
            </div>

            <div style="display:flex; gap:4px; flex-wrap:wrap;">
              <button class="btn-filter-tag ${this.state.buyerSort === 'volume' ? 'active' : ''}" data-sort="volume">Mais Volume</button>
              <button class="btn-filter-tag ${this.state.buyerSort === 'sla' ? 'active' : ''}" data-sort="sla">Menor SLA</button>
              <button class="btn-filter-tag ${this.state.buyerSort === 'backlog' ? 'active' : ''}" data-sort="backlog">Mais em Aberto</button>
              <button class="btn-filter-tag ${this.state.buyerSort === 'foraSla' ? 'active' : ''}" data-sort="foraSla" style="color:var(--coral);">Mais Fora do SLA</button>
              <button class="btn-filter-tag ${this.state.buyerSort === 'conformidade' ? 'active' : ''}" data-sort="conformidade">% no Prazo</button>
            </div>
          </div>
        </div>

        <div style="max-height: 520px; overflow-y: auto;">
          <table class="data-table">
            <thead>
              <tr>
                <th style="width:26%;">Comprador</th>
                <th style="width:22%;">Lojas Atendidas</th>
                <th style="text-align:center; width:11%;">Volume</th>
                <th style="text-align:center; width:15%;">Em Aberto (SLA)</th>
                <th style="text-align:center; width:12%;">SLA Cotação</th>
                <th style="text-align:center; width:14%;">Ações</th>
              </tr>
            </thead>
            <tbody>
              ${buyers.length === 0 ? `
                <tr>
                  <td colspan="6" style="text-align:center; padding:35px; color:var(--text-muted);">
                    Nenhum comprador com atividades para a combinação de Investida / Tipo de Compra selecionada.
                  </td>
                </tr>
              ` : buyers.map(b => {
                const invPills = (b.investidas || 'Geral').split(',').map(inv => `<span class="tag-pill">${inv.trim()}</span>`).join(' ');
                return `
                  <tr>
                    <td>
                      <div style="display:flex; align-items:center; gap:8px;">
                        <div class="buyer-avatar">${this.getInitials(b.comprador)}</div>
                        <div>
                          <div style="font-weight:800; color:var(--text-primary);">${b.comprador}</div>
                          <div style="font-size:10.5px; color:var(--text-muted);">${b.mix.spotMateriais} Mat · ${b.mix.spotServicos} Serv · ${b.mix.estrategica} Estrat</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div style="display:flex; flex-wrap:wrap; gap:3px;">
                        ${invPills}
                      </div>
                    </td>
                    <td class="center">
                      <strong style="color:var(--text-primary); font-size:13px;">${Number(b.totalSolicitacoes).toLocaleString('pt-BR')}</strong>
                    </td>
                    <td class="center">
                      <strong style="color:${b.backlogAtivo > 50 ? 'var(--amber)' : 'var(--text-primary)'}; font-size:13px;">${Number(b.backlogAtivo).toLocaleString('pt-BR')}</strong>
                      <div style="display:flex; align-items:center; justify-content:center; gap:4px; margin-top:2px;">
                        <span class="sla-badge fast" style="font-size:9.5px; padding:1px 5px;" title="${b.backlogDentroSla || 0} requisições no prazo de SLA">
                          🟢 ${b.backlogDentroSla || 0} no SLA
                        </span>
                        ${(b.backlogForaSla || 0) > 0 ? `
                          <span class="pulse-badge vencido" style="font-size:9.5px; padding:1px 5px;" title="${b.backlogForaSla} requisições estouradas">
                            🔴 ${b.backlogForaSla} fora
                          </span>
                        ` : ''}
                      </div>
                    </td>
                    <td class="center">
                      ${this.getSlaBadge(b.slaCotacaoMedio)}
                    </td>
                    <td class="center">
                      <button class="btn btn-primary btn-sm btn-open-buyer" data-comprador="${b.comprador}">
                        <i data-lucide="eye" style="width:11px; height:11px;"></i>
                        <span>Ver Raio-X</span>
                      </button>
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;

    // Eventos
    container.querySelectorAll('.btn-open-buyer').forEach(btn => {
      btn.addEventListener('click', () => {
        const comp = btn.dataset.comprador;
        if (comp) this.openBuyerDetailModal(comp);
      });
    });

    const selInv = document.getElementById('buyerInvestidaFilter');
    if (selInv) {
      selInv.addEventListener('change', (e) => {
        this.state.buyerInvestida = e.target.value;
        this.fetchRemoteData().then(() => this.renderCompradores());
      });
    }

    const selTipo = document.getElementById('buyerTipoFilter');
    if (selTipo) {
      selTipo.addEventListener('change', (e) => {
        this.state.buyerTipoCompra = e.target.value;
        this.fetchRemoteData().then(() => this.renderCompradores());
      });
    }

    const btnReset = document.getElementById('btnResetBuyerTeamFilters');
    if (btnReset) {
      btnReset.addEventListener('click', () => {
        this.state.buyerInvestida = 'todas';
        this.state.buyerTipoCompra = 'todos';
        this.fetchRemoteData().then(() => this.renderCompradores());
      });
    }

    const searchInput = document.getElementById('buyerSearchInput');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.state.buyerSearch = e.target.value;
        this.fetchRemoteData().then(() => this.renderCompradores());
        const inp = document.getElementById('buyerSearchInput');
        if (inp) {
          inp.focus();
          inp.setSelectionRange(inp.value.length, inp.value.length);
        }
      });
    }

    container.querySelectorAll('.btn-filter-tag').forEach(btn => {
      btn.addEventListener('click', () => {
        this.state.buyerSort = btn.dataset.sort;
        this.fetchRemoteData().then(() => this.renderCompradores());
      });
    });
  }

  formatDate(dateStr) {
    if (!dateStr || dateStr === '--' || dateStr === '0000-00-00 00:00:00') return '-';
    const clean = String(dateStr).trim();
    const parts = clean.substring(0, 10).split('-');
    if (parts.length === 3) {
      const timePart = clean.length > 10 ? clean.substring(11, 16) : '';
      return `${parts[2]}/${parts[1]}/${parts[0]}${timePart ? ` ${timePart}` : ''}`;
    }
    return dateStr;
  }

  // =====================================================================
  // ⏱️ RASTREABILIDADE & LINHA DO TEMPO DA SOLICITAÇÃO (TIMELINE STEPPER)
  // =====================================================================
  async openSolicitationTimeline(solicitationIdOrObject) {
    const modal = document.getElementById('solicitationTimelineModal');
    const body = document.getElementById('solicitationTimelineBody');
    const title = document.getElementById('modalTimelineTitle');
    const badge = document.getElementById('modalTimelineBadge');
    const subtitle = document.getElementById('modalTimelineSubtitle');
    if (!modal || !body) return;

    modal.classList.add('active');
    body.innerHTML = `
      <div style="text-align:center; padding:40px; color:var(--text-muted);">
        <div class="spinner" style="margin:0 auto 12px; width:28px; height:28px; border:3px solid var(--border-subtle); border-top-color:var(--plx-accent); border-radius:50%; animation:spin 0.8s linear infinite;"></div>
        <div style="font-weight:700; font-size:13px;">Carregando Rastreabilidade e Linha do Tempo...</div>
      </div>
    `;

    try {
      let data = null;
      let solic = null;

      const id = typeof solicitationIdOrObject === 'object' ? (solicitationIdOrObject.id || solicitationIdOrObject.numero_solicitacao) : solicitationIdOrObject;
      
      try {
        const res = await fetch(`/api/v1/operacional/solicitacao/${encodeURIComponent(id)}/timeline`);
        if (res.ok) {
          data = await res.json();
          solic = data.solicitacao;
        }
      } catch (err) {
        console.warn('Endpoint de timeline detalhada não disponível, usando dados locais.');
      }

      if (!solic && typeof solicitationIdOrObject === 'object') {
        solic = solicitationIdOrObject;
      }

      if (!solic) {
        throw new Error('Não foi possível recuperar os dados desta solicitação.');
      }

    const hasOrderNumber = solic.numero_solicitacao && String(solic.numero_solicitacao).toUpperCase().startsWith('PC');
    const isFinished = !!(hasOrderNumber || solic.data_finalizacao || ['Pedido Enviado', 'Encerrado', 'Aguardando entrega', 'Aguardando Entrega'].includes(solic.status_nome));
      const isOver = (solic.aging_dias || solic.dias_atendimento_sla || 0) > (solic.meta_sla_dias || 10);

      if (title) title.textContent = `Solicitação ${solic.numero_solicitacao || `#ORG-${solic.id}`}`;
      if (subtitle) subtitle.textContent = `${solic.investida_nome || 'Rede'} · ${solic.departamento || 'Geral'} · ${solic.comprador || 'Comprador'}`;
      if (badge) {
        badge.className = `sla-badge ${isFinished ? (isOver ? 'slow' : 'fast') : (isOver ? 'slow' : 'warning')}`;
        badge.textContent = isFinished ? 'Concluída' : (isOver ? `Estourou SLA (+${Math.round((solic.aging_dias || 0) - (solic.meta_sla_dias || 10))}d)` : solic.status_nome);
      }

      const diff1_2 = (solic.data_criacao && solic.data_aprovacao) ? this.getCalendarDaysDiff(solic.data_criacao, solic.data_aprovacao) : null;
      const diff2_3 = (solic.data_aprovacao && solic.data_cotacao) ? this.getCalendarDaysDiff(solic.data_aprovacao, solic.data_cotacao) : null;
      const diff3_4 = (solic.data_cotacao && solic.data_aprovacao_pedido) ? this.getCalendarDaysDiff(solic.data_cotacao, solic.data_aprovacao_pedido) : null;
      const diff4_5 = (solic.data_aprovacao_pedido && solic.data_finalizacao) ? this.getCalendarDaysDiff(solic.data_aprovacao_pedido, solic.data_finalizacao) : null;

      body.innerHTML = `
        <!-- DADOS MESTRES DA REQUISIÇÃO -->
        <div class="timeline-meta-grid">
          <div class="timeline-meta-card">
            <div class="timeline-meta-label">Comprador Responsável</div>
            <div class="timeline-meta-val">${solic.comprador || 'Não informado'}</div>
          </div>
          <div class="timeline-meta-card">
            <div class="timeline-meta-label">Modalidade &amp; Meta SLA</div>
            <div class="timeline-meta-val" style="color:var(--plx-accent);">${solic.modalidade_compra || 'Spot'} (${solic.meta_sla_dias || 10} dias)</div>
          </div>
          <div class="timeline-meta-card">
            <div class="timeline-meta-label">Aging Total (Dias Corridos)</div>
            <div class="timeline-meta-val" style="color:${isOver ? 'var(--coral)' : 'var(--emerald)'};">${solic.aging_dias || 0} dias</div>
          </div>
          <div class="timeline-meta-card">
            <div class="timeline-meta-label">Valor Final Negociado</div>
            <div class="timeline-meta-val" style="color:var(--emerald);">${solic.valor_final_negociado ? `R$ ${Number(solic.valor_final_negociado).toLocaleString('pt-BR', {minimumFractionDigits: 2})}` : 'Sob Cotação'}</div>
          </div>
        </div>

        <!-- FLUXO VISUAL TIMELINE STEPPER -->
        <div style="font-size:13px; font-weight:800; color:var(--text-primary); margin-bottom:14px; text-transform:uppercase; letter-spacing:0.5px;">
          ⏱️ Esteira de Execução &amp; Lead Time por Etapa
        </div>

        <div class="timeline-stepper">
          <!-- ETAPA 1: CRIADA -->
          <div class="timeline-step">
            <div class="timeline-step-left">
              <div class="timeline-step-marker concluido">
                <i data-lucide="check" style="width:15px; height:15px;"></i>
              </div>
              <div class="timeline-step-line ${solic.data_aprovacao ? 'concluido' : 'pendente'}"></div>
            </div>
            <div class="timeline-step-content">
              <div class="timeline-step-header">
                <div class="timeline-step-title">1. Solicitação Criada no Sistema</div>
                <div class="timeline-step-date">${this.formatDate(solic.data_criacao)}</div>
              </div>
              <div class="timeline-step-desc">Abertura da requisição pela loja/unidade solicitante (${solic.investida_nome || 'Loja'}).</div>
              <div class="timeline-step-badge-wrap">
                <span class="timeline-step-duration" style="background:rgba(16,185,129,0.15); color:var(--emerald);">Início do Ciclo</span>
              </div>
            </div>
          </div>

          <!-- ETAPA 2: APROVAÇÃO INTERNA / TRIAGEM -->
          <div class="timeline-step">
            <div class="timeline-step-left">
              <div class="timeline-step-marker ${solic.data_aprovacao ? 'concluido' : (['Solicitação', 'Validação'].includes(solic.status_nome) ? 'em_andamento' : (isFinished ? 'concluido' : 'pendente'))}">
                <i data-lucide="${solic.data_aprovacao || isFinished ? 'check' : (['Solicitação', 'Validação'].includes(solic.status_nome) ? 'clock' : 'circle-dashed')}" style="width:15px; height:15px;"></i>
              </div>
              <div class="timeline-step-line ${solic.data_cotacao ? 'concluido' : 'pendente'}"></div>
            </div>
            <div class="timeline-step-content">
              <div class="timeline-step-header">
                <div class="timeline-step-title">2. Validação &amp; Liberação para Cotação</div>
                <div class="timeline-step-date">${this.formatDate(solic.data_aprovacao || solic.data_criacao)}</div>
              </div>
              <div class="timeline-step-desc">Aprovação técnica e gerencial prévia antes do envio para a mesa de compras.</div>
              <div class="timeline-step-badge-wrap">
                ${diff1_2 !== null ? `<span class="timeline-step-duration" style="background:rgba(0,168,232,0.15); color:var(--plx-accent);">+${diff1_2}d aprovação</span>` : (isFinished ? '<span class="timeline-step-duration" style="background:rgba(16,185,129,0.15); color:var(--emerald);">Liberado</span>' : '<span class="timeline-step-duration" style="background:rgba(100,116,139,0.15); color:var(--text-muted);">Pendente</span>')}
              </div>
            </div>
          </div>

          <!-- ETAPA 3: COTAÇÃO / NEGOCIAÇÃO -->
          <div class="timeline-step">
            <div class="timeline-step-left">
              <div class="timeline-step-marker ${solic.data_cotacao ? 'concluido' : (['Cotacao', 'Em Cotação', 'Validação Técnica'].includes(solic.status_nome) ? 'em_andamento' : (isFinished ? 'concluido' : 'pendente'))}">
                <i data-lucide="${solic.data_cotacao || isFinished ? 'check' : (['Cotacao', 'Em Cotação', 'Validação Técnica'].includes(solic.status_nome) ? 'search' : 'circle-dashed')}" style="width:15px; height:15px;"></i>
              </div>
              <div class="timeline-step-line ${solic.data_aprovacao_pedido ? 'concluido' : 'pendente'}"></div>
            </div>
            <div class="timeline-step-content">
              <div class="timeline-step-header">
                <div class="timeline-step-title">3. Mesa de Compras (Cotação &amp; Negociação)</div>
                <div class="timeline-step-date">${this.formatDate(solic.data_cotacao || (isFinished ? solic.data_aprovacao : null))}</div>
              </div>
              <div class="timeline-step-desc">Cotação com fornecedores pelo comprador <strong>${solic.comprador || 'Comprador'}</strong>. Fornecedor: <em>${solic.fornecedor_vencedor || 'Em negociação'}</em>.</div>
              <div class="timeline-step-badge-wrap">
                ${diff2_3 !== null ? `<span class="timeline-step-duration" style="background:rgba(0,168,232,0.15); color:var(--plx-accent);">+${diff2_3}d em negociação</span>` : (solic.dias_atendimento_sla > 0 ? `<span class="timeline-step-duration" style="background:rgba(0,168,232,0.15); color:var(--plx-accent);">${solic.dias_atendimento_sla}d SLA Cotação</span>` : (isFinished ? '<span class="timeline-step-duration" style="background:rgba(16,185,129,0.15); color:var(--emerald);">Concluído</span>' : '<span class="timeline-step-duration" style="background:rgba(100,116,139,0.15); color:var(--text-muted);">Pendente</span>'))}
              </div>
            </div>
          </div>

          <!-- ETAPA 4: APROVAÇÃO DO PEDIDO (ALÇADA) -->
          <div class="timeline-step">
            <div class="timeline-step-left">
              <div class="timeline-step-marker ${solic.data_aprovacao_pedido ? 'concluido' : (['Aprovação', 'Em Aprovação'].includes(solic.status_nome) ? 'em_andamento' : (isFinished ? 'concluido' : 'pendente'))}">
                <i data-lucide="${solic.data_aprovacao_pedido || isFinished ? 'check' : (['Aprovação', 'Em Aprovação'].includes(solic.status_nome) ? 'hourglass' : 'circle-dashed')}" style="width:15px; height:15px;"></i>
              </div>
              <div class="timeline-step-line ${solic.data_finalizacao ? 'concluido' : 'pendente'}"></div>
            </div>
            <div class="timeline-step-content">
              <div class="timeline-step-header">
                <div class="timeline-step-title">4. Aprovação de Alçada &amp; Emissão da OC</div>
                <div class="timeline-step-date">${this.formatDate(solic.data_aprovacao_pedido || (isFinished ? solic.data_aprovacao : null))}</div>
              </div>
              <div class="timeline-step-desc">Validação de valor por diretoria/alçada e formalização do Pedido de Compra no ERP.</div>
              <div class="timeline-step-badge-wrap">
                ${diff3_4 !== null ? `<span class="timeline-step-duration" style="background:rgba(0,168,232,0.15); color:var(--plx-accent);">+${diff3_4}d aprovação OC</span>` : (isFinished ? '<span class="timeline-step-duration" style="background:rgba(16,185,129,0.15); color:var(--emerald);">Concluído</span>' : '<span class="timeline-step-duration" style="background:rgba(100,116,139,0.15); color:var(--text-muted);">Pendente</span>')}
              </div>
            </div>
          </div>

          <!-- ETAPA 5: PEDIDO ENVIADO / CONCLUÍDO -->
          <div class="timeline-step">
            <div class="timeline-step-left">
              <div class="timeline-step-marker ${isFinished ? 'concluido' : 'pendente'}">
                <i data-lucide="${isFinished ? 'check-check' : 'circle-dashed'}" style="width:15px; height:15px;"></i>
              </div>
            </div>
            <div class="timeline-step-content">
              <div class="timeline-step-header">
                <div class="timeline-step-title">5. Pedido Emitido / Processo Encerrado</div>
                <div class="timeline-step-date">${this.formatDate(solic.data_finalizacao || (isFinished ? (solic.data_aprovacao_pedido || solic.data_cotacao || solic.data_criacao) : null))}</div>
              </div>
              <div class="timeline-step-desc">Ordem de compra emitida e despachada ao fornecedor vencedor.</div>
              <div class="timeline-step-badge-wrap">
                ${isFinished ? `<span class="timeline-step-duration" style="background:rgba(16,185,129,0.15); color:var(--emerald);">${isOver ? 'Concluído com Atraso' : 'Finalizado no Prazo'}</span>` : '<span class="timeline-step-duration" style="background:rgba(245,158,11,0.15); color:var(--amber);">Em Aberto / Fila Ativa</span>'}
              </div>
            </div>
          </div>
        </div>
      `;

      if (window.lucide) window.lucide.createIcons();
    } catch (e) {
      body.innerHTML = `
        <div style="padding:30px; text-align:center; color:var(--coral);">
          <i data-lucide="alert-circle" style="width:32px; height:32px; margin-bottom:8px;"></i>
          <div style="font-weight:700;">Erro ao carregar linha do tempo</div>
          <div style="font-size:12px; color:var(--text-muted); margin-top:4px;">${e.message}</div>
        </div>
      `;
      if (window.lucide) window.lucide.createIcons();
    }
  }

  // =====================================================================
  // 🔍 RAIO-X EXECUTIVO DO COMPRADOR (FULL-PAGE DOSSIER VIEW)
  // =====================================================================
  async openBuyerDetailModal(compradorName) {
    this.openBuyerDetail(compradorName);
  }

  async openBuyerDetail(compradorName) {
    this._currentBuyerName = compradorName;
    this._buyerInvestidaFilter = this._buyerInvestidaFilter || 'todas';
    this._buyerTipoFilter = this._buyerTipoFilter || 'todos';

    const pane = document.getElementById('buyerDetailPane');
    const container = document.getElementById('buyerDetailContent');
    if (!pane || !container) return;

    // Salvar aba anterior para voltar perfeitamente
    this.state.returnTab = this.state.activeTab === 'buyerDetail' ? (this.state.returnTab || 'compradores') : this.state.activeTab;
    this.state.activeTab = 'buyerDetail';
    this.updateHeader();

    // Ativar aba de tela cheia
    document.querySelectorAll('.section-pane').forEach(p => p.classList.remove('active'));
    pane.classList.add('active');

    container.innerHTML = `
      <div style="padding:40px; text-align:center; color:var(--text-muted);">
        <i data-lucide="loader" style="width:24px; height:24px; animation:spin 1s linear infinite;"></i>
        <div style="margin-top:10px; font-weight:700;">Carregando Raio-X de ${compradorName}...</div>
      </div>
    `;
    if (window.lucide) window.lucide.createIcons();

    // Rolar suavemente para o topo
    window.scrollTo({ top: 0, behavior: 'smooth' });

    const loadDossierData = async () => {
      try {
        const { mode, month, year } = this.state;
        const res = await fetch(`/api/v1/operacional/comprador-detalhe?comprador=${encodeURIComponent(compradorName)}&mode=${mode}&month=${month}&year=${year}&investida=${encodeURIComponent(this._buyerInvestidaFilter)}&tipoCompra=${encodeURIComponent(this._buyerTipoFilter)}`);
        if (!res.ok) throw new Error('Falha ao carregar dossiê do comprador');
        const data = await res.json();

        const rGeral = data.resumoGeral || data.resumo || {};
        const r = data.resumo || {};
        const investidas = data.porInvestida || [];
        const modalidades = data.porModalidade || [];
        const chamados = data.chamadosEmAberto || [];

        // Estado dos chamados para filtro e busca interna
        this._buyerChamados = chamados;
        this._buyerFilterStatus = this._buyerFilterStatus || 'todos';
        this._buyerSearchQuery = this._buyerSearchQuery || '';

        const hasDossierFilter = (this._buyerInvestidaFilter !== 'todas' || this._buyerTipoFilter !== 'todos');

        const renderDossier = () => {
          let filtrados = this._buyerChamados;
          if (this._buyerFilterStatus !== 'todos') {
            if (this._buyerFilterStatus === 'concluidos') {
              filtrados = filtrados.filter(c => this.getTicketSlaEvaluation(c).isFinished);
            } else if (this._buyerFilterStatus === 'cotacao') {
              filtrados = filtrados.filter(c => this.getTicketSlaEvaluation(c).isEmCotacao);
            } else if (this._buyerFilterStatus === 'aprovacao') {
              filtrados = filtrados.filter(c => {
                const st = (c.status_nome || '').toLowerCase();
                return st.includes('aprov') || st.includes('valid');
              });
            } else if (this._buyerFilterStatus === 'atrasados') {
              filtrados = filtrados.filter(c => this.getTicketSlaEvaluation(c).isOver);
            }
          }

          if (this._buyerSearchQuery && this._buyerSearchQuery.trim() !== '') {
            const q = this._buyerSearchQuery.toLowerCase().trim();
            filtrados = filtrados.filter(c => 
              (c.numero_solicitacao && String(c.numero_solicitacao).toLowerCase().includes(q)) ||
              (c.id && String(c.id).includes(q)) ||
              (c.categoria && c.categoria.toLowerCase().includes(q)) ||
              (c.investida_nome && c.investida_nome.toLowerCase().includes(q)) ||
              (c.status_nome && c.status_nome.toLowerCase().includes(q))
            );
          }

          container.innerHTML = `
            <!-- 1. CABEÇALHO LIMPO COM FILTROS INTEGRADOS -->
            <div class="dossier-top-bar">
              <div class="dossier-top-left">
                <button class="dossier-back-btn" id="btnBackFromBuyerDetail">
                  <i data-lucide="arrow-left" style="width:14px; height:14px;"></i>
                  <span>Voltar</span>
                </button>
                <div class="dossier-avatar-clean">${this.getInitials(compradorName)}</div>
                <div>
                  <div class="dossier-name-title">${compradorName}</div>
                  <div class="dossier-meta-subtitle">
                    ${data.periodo} · <strong>${Number(rGeral.total_solicitacoes || 0).toLocaleString('pt-BR')} requisições totais</strong> · SLA médio geral: <strong>${rGeral.sla_cotacao_medio || 0}d</strong>
                  </div>
                </div>
              </div>

              <div class="dossier-inline-filters">
                <div class="dossier-select-wrapper">
                  <label for="dossierInvestidaSelect">Loja:</label>
                  <select id="dossierInvestidaSelect">
                    <option value="todas" ${this._buyerInvestidaFilter === 'todas' ? 'selected' : ''}>Todas as Lojas (${investidas.length})</option>
                    ${(data.opcoesFiltros?.investidas || []).filter(i => i !== 'todas').map(inv => `
                      <option value="${inv}" ${this._buyerInvestidaFilter === inv ? 'selected' : ''}>${inv}</option>
                    `).join('')}
                  </select>
                </div>

                <div class="dossier-select-wrapper">
                  <label for="dossierTipoSelect">Tipo:</label>
                  <select id="dossierTipoSelect">
                    ${(data.opcoesFiltros?.tiposCompra || []).map(t => `
                      <option value="${t.id}" ${this._buyerTipoFilter === t.id ? 'selected' : ''}>${t.label}</option>
                    `).join('')}
                  </select>
                </div>

                ${hasDossierFilter ? `
                  <button id="btnResetDossierFilters" class="btn btn-secondary btn-sm" style="font-size:11px; padding:4px 8px; color:var(--coral); font-weight:700;">
                    <i data-lucide="x" style="width:12px; height:12px;"></i>
                    <span>Limpar</span>
                  </button>
                ` : ''}
              </div>
            </div>

            <!-- 2. STAT STRIP: 4 KPIS ESSENCIAIS E AREJADOS -->
            <div class="dossier-stat-strip">
              <!-- KPI 1: Volume Selecionado -->
              <div class="dossier-stat-card">
                <div class="dossier-stat-label">Volume Selecionado</div>
                <div class="dossier-stat-val">${Number(r.total_solicitacoes || 0).toLocaleString('pt-BR')}</div>
                <div class="dossier-stat-desc">
                  Spot: <strong>${Number((r.mix?.spotMateriais || 0) + (r.mix?.spotServicos || 0)).toLocaleString('pt-BR')}</strong> · Estrat: <strong>${Number(r.mix?.estrategica || 0).toLocaleString('pt-BR')}</strong>
                </div>
              </div>

              <!-- KPI 2: Em Aberto -->
              <div class="dossier-stat-card">
                <div class="dossier-stat-label">Em Aberto (Fila)</div>
                <div class="dossier-stat-val" style="color:var(--amber);">${Number(r.backlog_ativo || 0).toLocaleString('pt-BR')}</div>
                <div class="dossier-stat-desc">
                  <span style="color:var(--emerald); font-weight:700;">🟢 ${Number(r.backlog_dentro_sla || 0).toLocaleString('pt-BR')} no SLA</span> · <span style="color:var(--coral); font-weight:700;">🔴 ${Number(r.backlog_fora_sla || 0).toLocaleString('pt-BR')} fora</span>
                </div>
              </div>

              <!-- KPI 3: SLA Médio -->
              <div class="dossier-stat-card">
                <div class="dossier-stat-label">SLA Médio de Cotação</div>
                <div class="dossier-stat-val" style="color:var(--plx-accent);">${r.sla_cotacao_medio || 0}<span style="font-size:14px; font-weight:700; color:var(--text-muted); margin-left:3px;">dias</span></div>
                <div class="dossier-stat-desc">
                  Materiais: <strong>${r.mix?.spotMateriais || 0}</strong> · Serviços: <strong>${r.mix?.spotServicos || 0}</strong>
                </div>
              </div>

              <!-- KPI 4: Taxa de Conformidade -->
              <div class="dossier-stat-card">
                <div class="dossier-stat-label">Taxa de Conformidade</div>
                <div class="dossier-stat-val" style="color:var(--emerald);">${Math.round(r.taxa_conformidade_pct || 100)}%</div>
                <div class="dossier-stat-desc">
                  <strong>${Number(r.dentro_sla_count || 0).toLocaleString('pt-BR')}</strong> de <strong>${Number(r.com_sla || 0).toLocaleString('pt-BR')}</strong> no prazo oficial
                </div>
              </div>
            </div>

            <!-- 3. PAINÉIS DE SEGMENTAÇÃO CLEAN (50% / 50%) -->
            <div class="dossier-split-2">
              <!-- 3.1 Modalidades de Compra -->
              <div class="dossier-panel-clean">
                <div class="dossier-panel-header">
                  <span class="dossier-panel-title">📦 Modalidades de Compra</span>
                  <span style="font-size:11px; color:var(--text-muted);">Clique para filtrar</span>
                </div>
                <div>
                  ${modalidades.map(m => {
                    const isSelected = this._buyerTipoFilter === m.tipo_compra;
                    const metaDias = m.tipo_compra === 'SPOT_MATERIAIS' ? 10 : (m.tipo_compra === 'SPOT_SERVICOS' ? 15 : 45);
                    const pctConform = Math.round(m.taxa_conformidade_pct || 0);
                    const isGood = pctConform >= 75;
                    return `
                      <div class="dossier-row-item dossier-modalidade-card ${isSelected ? 'active' : ''}" data-tipo="${m.tipo_compra}">
                        <div style="display:flex; align-items:center; gap:8px;">
                          <span style="font-size:12.5px; font-weight:700; color:var(--text-primary);">${m.modalidade}</span>
                          <span style="font-size:10.5px; color:var(--text-muted); background:var(--surface-subtle); padding:1px 5px; border-radius:4px;">Meta: ${metaDias}d</span>
                        </div>
                        <div style="display:flex; align-items:center; gap:12px;">
                          <span style="font-size:11px; color:var(--text-muted);">${Number(m.total).toLocaleString('pt-BR')} reqs (${m.backlog} abertas)</span>
                          <span style="font-size:12px; font-weight:800; color:${isGood ? 'var(--emerald)' : (pctConform >= 50 ? 'var(--amber)' : 'var(--coral)')};">${pctConform}% SLA</span>
                          <span style="font-size:12px; font-weight:800; color:var(--plx-accent); min-width:32px; text-align:right;">${m.sla_medio}d</span>
                        </div>
                      </div>
                    `;
                  }).join('')}
                </div>
              </div>

              <!-- 3.2 Redes Atendidas -->
              <div class="dossier-panel-clean">
                <div class="dossier-panel-header">
                  <span class="dossier-panel-title">🏢 Redes Atendidas (${investidas.length})</span>
                  <span style="font-size:11px; color:var(--text-muted);">Clique para filtrar</span>
                </div>
                <div>
                  ${investidas.map(inv => {
                    const isSelected = this._buyerInvestidaFilter === inv.investida;
                    const isSlow = inv.alerta === 'Gargalo Crítico nesta Investida' || inv.sla_cotacao_medio > 15;
                    const pctSla = Math.round(inv.taxa_conformidade_pct || 0);
                    return `
                      <div class="dossier-row-item btn-filter-store ${isSelected ? 'active' : ''}" data-investida="${inv.investida}">
                        <div style="display:flex; align-items:center; gap:8px;">
                          <span style="font-size:12.5px; font-weight:700; color:var(--text-primary);">${inv.investida}</span>
                          <span style="font-size:11px; color:var(--text-muted);">${Number(inv.total_solicitacoes).toLocaleString('pt-BR')} reqs (${inv.backlog_ativo} abertas)</span>
                        </div>
                        <div style="display:flex; align-items:center; gap:12px;">
                          <span style="font-size:11.5px; font-weight:800; color:${pctSla >= 75 ? 'var(--emerald)' : 'var(--coral)'};">${pctSla}% SLA</span>
                          <span style="font-size:11px; font-weight:800; padding:1px 6px; border-radius:4px; background:${isSlow ? 'rgba(239,68,68,0.1)' : 'rgba(16,185,129,0.1)'}; color:${isSlow ? 'var(--coral)' : 'var(--emerald)'};">
                            ${inv.sla_cotacao_medio}d
                          </span>
                        </div>
                      </div>
                    `;
                  }).join('')}
                </div>
              </div>
            </div>

            <!-- 5. FILA E HISTÓRICO COMPLETO DE SOLICITAÇÕES (TABELA AMPLA COM BUSCA E FILTROS) -->
            <div class="dossier-table-panel">
              <div class="dossier-table-toolbar">
                <div style="display:flex; align-items:center; gap:10px; flex-wrap:wrap;">
                  <div class="search-input-clean">
                    <i data-lucide="search" style="width:13px; height:13px; color:var(--text-muted);"></i>
                    <input type="text" id="buyerDossierSearch" placeholder="Buscar por número, loja ou categoria..." value="${this._buyerSearchQuery}">
                  </div>

                  <div style="display:flex; gap:4px; flex-wrap:wrap;">
                    <button class="btn-filter-tag ${this._buyerFilterStatus === 'todos' ? 'active' : ''}" data-filter="todos">Todas (${chamados.length})</button>
                    <button class="btn-filter-tag ${this._buyerFilterStatus === 'cotacao' ? 'active' : ''}" data-filter="cotacao">Em Cotação</button>
                    <button class="btn-filter-tag ${this._buyerFilterStatus === 'aprovacao' ? 'active' : ''}" data-filter="aprovacao">Em Aprovação</button>
                    <button class="btn-filter-tag ${this._buyerFilterStatus === 'atrasados' ? 'active' : ''}" data-filter="atrasados" style="color:var(--coral);">⚠️ Estourou SLA</button>
                    <button class="btn-filter-tag ${this._buyerFilterStatus === 'concluidos' ? 'active' : ''}" data-filter="concluidos">Concluídas</button>
                  </div>
                </div>

                <span style="font-size:11.5px; color:var(--text-muted);">
                  Exibindo <strong>${filtrados.length}</strong> de ${chamados.length} solicitações
                </span>
              </div>

              <div style="overflow-x: auto;">
                <table class="data-table" style="min-width: 1100px;">
                  <thead>
                    <tr>
                      <th style="min-width:130px;">Solicitação</th>
                      <th style="min-width:110px;">Data Cotação</th>
                      <th style="min-width:110px;">Pedido Enviado</th>
                      <th style="min-width:110px;">Etapa Atual</th>
                      <th style="min-width:110px;">Finalização</th>
                      <th style="min-width:130px;">Rede / Loja</th>
                      <th style="min-width:180px;">Categoria &amp; Modalidade</th>
                      <th style="min-width:110px; text-align:center;">Dias / Meta</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${filtrados.length === 0 ? `
                      <tr>
                        <td colspan="8" style="text-align:center; padding:30px; color:var(--text-muted);">
                          Nenhuma solicitação encontrada com os filtros selecionados.
                        </td>
                      </tr>
                    ` : filtrados.map(ch => {
                      const ev = this.getTicketSlaEvaluation(ch);
                      const dtCell = (val, color) => val
                        ? `<span style="font-size:11px; color:${color || 'var(--text-secondary)'}; font-weight:600;">${this.formatDate(val)}</span>`
                        : `<span style="font-size:11px; color:var(--text-dim); opacity:0.45;">—</span>`;

                      // Data de Cotação: exibe se já iniciou cotação
                      const displayDtCotacao = ch.data_cotacao || (ev.isEmCotacao || ev.isPosCotacao ? ch.data_criacao : null);
                      // Data de Pedido Enviado: exibe se já concluiu cotação/pedido
                      const displayDtPedido = ch.data_aprovacao_pedido || (ev.isFinished ? ch.data_aprovacao : null);

                      return `
                        <tr class="clickable-solicitation-row" data-id="${ch.id}" style="cursor:pointer;">
                          <td>
                            <strong style="color:var(--plx-accent); font-size:12px;">${ch.numero_solicitacao || `#ORG-${ch.id}`}</strong>
                          </td>
                          <td>${dtCell(displayDtCotacao, 'var(--text-secondary)')}</td>
                          <td>${dtCell(displayDtPedido, 'var(--sky)')}</td>
                          <td>
                            <span class="sla-badge ${ev.isFinished ? 'fast' : (ev.isEmCotacao ? 'warning' : 'regular')}">
                              ${ch.status_nome}
                            </span>
                          </td>
                          <td>
                            ${ch.data_finalizacao
                              ? `<span style="font-size:11px; color:var(--emerald); font-weight:700;">${this.formatDate(ch.data_finalizacao)}</span>`
                              : (ev.isFinished ? `<span style="font-size:10.5px; color:var(--emerald); font-weight:700;">Concluído</span>` : (ev.isPreCotacao ? `<span style="font-size:10.5px; color:var(--text-muted); font-weight:600; background:var(--surface-subtle); padding:2px 6px; border-radius:4px;">Pré-Cotação</span>` : `<span style="font-size:10.5px; color:var(--amber); font-weight:700; background:rgba(245,158,11,0.12); padding:2px 6px; border-radius:4px;">Em aberto</span>`))}
                          </td>
                          <td>
                            <strong style="color:var(--text-primary); font-size:12px;">${ch.investida_nome}</strong>
                          </td>
                          <td>
                            <div style="font-weight:700; color:var(--text-primary); font-size:12px;">${ch.categoria}</div>
                            <div style="font-size:10px; color:var(--text-muted); margin-top:1px;">
                              ${ch.modalidade_compra || 'Spot'} · <span style="color:var(--text-secondary);">Meta: ${ev.meta}d</span>
                            </div>
                          </td>
                          <td class="center">
                            ${ev.badgeHtml}
                          </td>
                        </tr>
                      `;
                    }).join('')}
                  </tbody>
                </table>
              </div>
            </div>
          `;

          // Eventos do Dossiê
          const backBtn = document.getElementById('btnBackFromBuyerDetail');
          if (backBtn) {
            backBtn.addEventListener('click', () => {
              const targetTab = this.state.returnTab || 'compradores';
              this.switchTab(targetTab);
            });
          }

          const selInvDossier = document.getElementById('dossierInvestidaSelect');
          if (selInvDossier) {
            selInvDossier.addEventListener('change', (e) => {
              this._buyerInvestidaFilter = e.target.value;
              loadDossierData();
            });
          }

          const selTipoDossier = document.getElementById('dossierTipoSelect');
          if (selTipoDossier) {
            selTipoDossier.addEventListener('change', (e) => {
              this._buyerTipoFilter = e.target.value;
              loadDossierData();
            });
          }

          const btnResetDossier = document.getElementById('btnResetDossierFilters');
          if (btnResetDossier) {
            btnResetDossier.addEventListener('click', () => {
              this._buyerInvestidaFilter = 'todas';
              this._buyerTipoFilter = 'todos';
              loadDossierData();
            });
          }

          // Clique nos cards de modalidade
          container.querySelectorAll('.dossier-modalidade-card').forEach(card => {
            card.addEventListener('click', () => {
              const tipo = card.dataset.tipo;
              this._buyerTipoFilter = this._buyerTipoFilter === tipo ? 'todos' : tipo;
              loadDossierData();
            });
          });

          // Clique nos cards de lojas
          container.querySelectorAll('.btn-filter-store').forEach(card => {
            card.addEventListener('click', () => {
              const inv = card.dataset.investida;
              this._buyerInvestidaFilter = this._buyerInvestidaFilter === inv ? 'todas' : inv;
              loadDossierData();
            });
          });

          const searchInp = document.getElementById('buyerDossierSearch');
          if (searchInp) {
            searchInp.addEventListener('input', (e) => {
              this._buyerSearchQuery = e.target.value;
              renderDossier();
              const inp = document.getElementById('buyerDossierSearch');
              if (inp) {
                inp.focus();
                inp.setSelectionRange(inp.value.length, inp.value.length);
              }
            });
          }

          container.querySelectorAll('.dossier-table-toolbar .btn-filter-tag').forEach(btn => {
            btn.addEventListener('click', () => {
              this._buyerFilterStatus = btn.dataset.filter;
              renderDossier();
            });
          });

          container.querySelectorAll('.clickable-solicitation-row').forEach(row => {
            row.addEventListener('click', () => {
              const id = row.dataset.id;
              const ch = chamados.find(c => String(c.id) === String(id));
              if (ch) this.openSolicitationTimeline(ch);
            });
          });

          if (window.lucide) window.lucide.createIcons();
        };

        renderDossier();
      } catch (err) {
        container.innerHTML = `
          <div style="padding:40px; text-align:center; color:var(--coral);">
            <i data-lucide="alert-triangle" style="width:32px; height:32px; margin-bottom:10px;"></i>
            <div style="font-weight:800; font-size:15px;">Não foi possível carregar o Raio-X do Comprador</div>
            <div style="font-size:12px; color:var(--text-muted); margin:6px 0 16px;">${err.message}</div>
            <button class="btn btn-secondary btn-sm" id="btnRetryBuyer">Tentar Novamente</button>
          </div>
        `;
        const retryBtn = document.getElementById('btnRetryBuyer');
        if (retryBtn) retryBtn.addEventListener('click', () => this.openBuyerDetail(compradorName));
        if (window.lucide) window.lucide.createIcons();
      }
    };

    loadDossierData();
  }

  // =====================================================================
  // 3. RENDER: WORKFLOW & GARGALOS
  // =====================================================================
  renderWorkflow() {
    const container = document.getElementById('workflowContent');
    if (!container) return;

    const data = this.state.data.workflow;
    if (!data) return;

    const buckets = data.agingBuckets || [];
    const pendentes = data.chamadosPendentes || [];

    container.innerHTML = `
      <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(160px, 1fr)); gap:10px; margin-bottom:20px;">
        ${buckets.map(b => `
          <div style="background:var(--surface-card); border:1px solid var(--border-subtle); border-radius:8px; padding:12px; text-align:center;">
            <div style="font-size:11px; color:var(--text-muted); font-weight:700;">${b.label}</div>
            <div style="font-size:22px; font-weight:900; color:${b.color}; margin:4px 0 2px;">${Number(b.count).toLocaleString('pt-BR')}</div>
            <div style="font-size:10.5px; color:var(--text-muted);">${b.pct}% da fila</div>
          </div>
        `).join('')}
      </div>

      <div class="table-panel">
        <div class="table-toolbar">
          <div style="font-size:13.5px; font-weight:800; color:var(--text-primary);">Fila Prioritária de Requisições (Mais Antigas)</div>
          <span class="sla-badge warning">Atenção Gerencial</span>
        </div>

        <div style="max-height: 480px; overflow-y: auto;">
          <table class="data-table">
            <thead>
              <tr>
                <th>Solicitação</th>
                <th>Criação</th>
                <th>Finalização</th>
                <th>Investida</th>
                <th>Comprador</th>
                <th>Etapa</th>
                <th>Categoria</th>
                <th style="text-align:center;">Dias na Etapa</th>
              </tr>
            </thead>
            <tbody>
              ${pendentes.map(p => `
                <tr>
                  <td><strong style="color:var(--plx-accent); font-size:11.5px;">${p.numero_solicitacao || `#ORG-${p.id}`}</strong></td>
                  <td><span style="font-size:11px; color:var(--text-secondary); font-weight:600;">${this.formatDate(p.data_criacao)}</span></td>
                  <td>
                    ${p.data_finalizacao ? `<span style="font-size:11px; color:var(--emerald); font-weight:700;">${this.formatDate(p.data_finalizacao)}</span>` : '<span style="font-size:10.5px; color:var(--amber);">Em aberto</span>'}
                  </td>
                  <td><strong>${p.investida_nome}</strong></td>
                  <td>${p.comprador || '<span style="color:var(--text-dim);">Não atribuído</span>'}</td>
                  <td><span class="sla-badge regular">${p.status_nome}</span></td>
                  <td>
                    <div>${p.categoria || 'Geral'}</div>
                    <div style="font-size:9.5px; color:var(--text-muted);">${p.modalidade_compra || 'Spot'} (Meta: ${p.meta_sla_dias || 10}d)</div>
                  </td>
                  <td class="center">
                    <strong style="color:${(p.aging_dias || p.dias_na_etapa || 0) > (p.meta_sla_dias || 10) ? 'var(--coral)' : ((p.aging_dias || p.dias_na_etapa || 0) > (p.meta_sla_dias || 10) * 0.7 ? 'var(--amber)' : 'var(--emerald)')}; font-size:13px;">
                      ${Math.round(p.aging_dias || p.dias_na_etapa || 0)} dias
                    </strong>
                    <div style="font-size:9.5px; color:var(--text-muted);">Meta: ${p.meta_sla_dias || 10}d</div>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  // =====================================================================
  // 4. RENDER: INVESTIDAS & CATEGORIAS (UNIFICADA)
  // =====================================================================
  renderInvestidasCategorias() {
    const container = document.getElementById('investidasCategoriasContent');
    if (!container) return;

    const subTab = this.state.investidasCatSubTab || 'investidas';

    container.innerHTML = `
      <!-- CONTROLE DE SUB-ABAS / VISÃO UNIFICADA -->
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:18px; flex-wrap:wrap; gap:12px;">
        <div class="segmented-toggle" style="background:var(--surface-card); padding:4px; border:1px solid var(--border-subtle); border-radius:8px;">
          <button class="toggle-btn btn-subtab-invcat ${subTab === 'investidas' ? 'active' : ''}" data-subtab="investidas" style="font-size:12px; padding:6px 16px; display:flex; align-items:center; gap:6px;">
            <i data-lucide="building-2" style="width:14px; height:14px;"></i>
            <span>Redes Investidas (Lojas)</span>
          </button>
          <button class="toggle-btn btn-subtab-invcat ${subTab === 'categorias' ? 'active' : ''}" data-subtab="categorias" style="font-size:12px; padding:6px 16px; display:flex; align-items:center; gap:6px;">
            <i data-lucide="package" style="width:14px; height:14px;"></i>
            <span>Categorias de Compras</span>
          </button>
        </div>

        <div style="font-size:12px; color:var(--text-muted);">
          ${subTab === 'investidas' 
            ? 'Acompanhamento consolidado por bandeira/loja' 
            : 'Performance vs metas oficiais por segmento de compra'}
        </div>
      </div>

      <div id="invCatSubContent"></div>
    `;

    const subContent = document.getElementById('invCatSubContent');
    if (subTab === 'investidas') {
      this.renderInvestidasSub(subContent);
    } else {
      this.renderCategoriasSub(subContent);
    }

    container.querySelectorAll('.btn-subtab-invcat').forEach(btn => {
      btn.addEventListener('click', () => {
        this.state.investidasCatSubTab = btn.dataset.subtab;
        this.renderInvestidasCategorias();
      });
    });

    if (window.lucide) window.lucide.createIcons();
  }

  renderInvestidas() {
    this.state.investidasCatSubTab = 'investidas';
    this.renderInvestidasCategorias();
  }

  renderInvestidasSub(container) {
    if (!container) return;
    const data = this.state.data.investidas;
    if (!data) return;

    const investidas = data.investidas || [];

    container.innerHTML = `
      <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(280px, 1fr)); gap:12px; margin-bottom:20px;">
        ${investidas.map(inv => `
          <div class="card btn-open-investida" data-investida="${inv.investida}" style="cursor:pointer;">
            <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:8px;">
              <div>
                <div style="font-size:11px; font-weight:800; color:var(--plx-accent); text-transform:uppercase;">${inv.investida}</div>
                <div style="font-size:18px; font-weight:900; color:var(--text-primary); margin-top:2px;">
                  ${Number(inv.total_solicitacoes).toLocaleString('pt-BR')} <span style="font-size:11px; font-weight:500; color:var(--text-muted);">reqs</span>
                </div>
              </div>
              <span class="sla-badge ${inv.taxa_conformidade_pct >= 85 ? 'fast' : 'warning'}">${inv.taxa_conformidade_pct}% SLA</span>
            </div>

            <div style="display:flex; justify-content:space-between; font-size:11.5px; color:var(--text-secondary); margin-bottom:4px;">
              <span>SLA Cotação: <strong style="color:var(--plx-accent);">${inv.sla_cotacao_medio}d</strong></span>
              <span>Em Aberto: <strong style="color:var(--amber);">${inv.backlog_ativo}</strong></span>
            </div>

            <div style="font-size:10.5px; color:var(--text-muted); margin-bottom:8px;">
              Mat: <strong>${inv.qtd_spot_mat || 0}</strong> · Serv: <strong>${inv.qtd_spot_serv || 0}</strong> · Estrat: <strong>${inv.qtd_estrategica || 0}</strong>
            </div>

            <div style="background:var(--surface-subtle); height:6px; border-radius:3px; overflow:hidden;">
              <div style="width:${inv.taxa_conformidade_pct}%; background:${inv.taxa_conformidade_pct >= 85 ? 'var(--emerald)' : 'var(--amber)'}; height:100%;"></div>
            </div>
          </div>
        `).join('')}
      </div>

      <div class="table-panel">
        <div class="table-toolbar">
          <div style="font-size:13.5px; font-weight:800; color:var(--text-primary);">Conformidade das Redes Investidas</div>
          <span style="font-size:11px; color:var(--text-muted);">Clique em uma loja para ver o detalhamento</span>
        </div>

        <div style="max-height: 480px; overflow-y: auto;">
          <table class="data-table">
            <thead>
              <tr>
                <th>Rede Investida</th>
                <th style="text-align:center;">Volume Total</th>
                <th style="text-align:center;">Em Aberto</th>
                <th style="text-align:center;">SLA Cotação</th>
                <th style="text-align:center;">% no Prazo</th>
                <th style="text-align:center;">Ações</th>
              </tr>
            </thead>
            <tbody>
              ${investidas.map(inv => `
                <tr>
                  <td>
                    <strong style="color:var(--text-primary); font-size:13px;">${inv.investida}</strong>
                    <div style="font-size:10px; color:var(--text-muted);">Mat: ${inv.qtd_spot_mat || 0} · Serv: ${inv.qtd_spot_serv || 0} · Estrat: ${inv.qtd_estrategica || 0}</div>
                  </td>
                  <td class="center">${Number(inv.total_solicitacoes).toLocaleString('pt-BR')}</td>
                  <td class="center"><strong style="color:var(--amber);">${Number(inv.backlog_ativo).toLocaleString('pt-BR')}</strong></td>
                  <td class="center"><strong style="color:var(--plx-accent); font-size:13px;">${inv.sla_cotacao_medio}d</strong></td>
                  <td class="center">
                    <span class="sla-badge ${inv.taxa_conformidade_pct >= 85 ? 'fast' : (inv.taxa_conformidade_pct >= 70 ? 'warning' : 'slow')}">
                      ${Math.round(inv.taxa_conformidade_pct || 0)}%
                    </span>
                  </td>
                  <td class="center">
                    <button class="btn btn-primary btn-sm btn-open-investida" data-investida="${inv.investida}">
                      <i data-lucide="eye" style="width:11px; height:11px;"></i>
                      <span>Ver Raio-X</span>
                    </button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;

    container.querySelectorAll('.btn-open-investida').forEach(btn => {
      btn.addEventListener('click', () => {
        const inv = btn.dataset.investida;
        if (inv) this.openInvestidaDetailModal(inv);
      });
    });
  }

  // =====================================================================
  // 🏢 MODAL: DRILLDOWN DA INVESTIDA (RAIO-X + BACKLOG DE REQUISIÇÕES)
  // =====================================================================
  async openInvestidaDetailModal(investidaName) {
    const modal = document.getElementById('investidaDetailModal');
    const nameElem = document.getElementById('modalInvestidaName');
    const metaElem = document.getElementById('modalInvestidaMeta');
    const bodyElem = document.getElementById('investidaModalBody');

    if (!modal || !bodyElem) return;

    nameElem.textContent = investidaName;
    metaElem.textContent = 'Carregando dados e backlog da rede...';
    bodyElem.innerHTML = '<div style="padding:40px; text-align:center; color:var(--text-muted);"><i data-lucide="loader" style="width:24px; height:24px; animation:spin 1s linear infinite;"></i><div style="margin-top:8px;">Consultando requisições da unidade...</div></div>';
    modal.classList.add('active');
    if (window.lucide) window.lucide.createIcons();

    try {
      const { mode, month, year } = this.state;
      const res = await fetch(`/api/v1/operacional/investida-detalhe?investida=${encodeURIComponent(investidaName)}&mode=${mode}&month=${month}&year=${year}`);
      const data = await res.json();

      const r = data.resumo || {};
      const compradores = data.compradores || [];
      const chamados = data.chamados || [];

      metaElem.textContent = `${data.periodo} · ${r.total_solicitacoes || 0} solicitações totais · ${chamados.length} requisições em cotação`;

      bodyElem.innerHTML = `
        <!-- 1. CARDS DE RESUMO DA REDE -->
        <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(170px, 1fr)); gap:10px; margin-bottom:18px;">
          <div style="background:var(--surface-subtle); padding:10px 14px; border-radius:8px; border:1px solid var(--border-subtle);">
            <div style="font-size:10.5px; color:var(--text-muted); font-weight:700; text-transform:uppercase;">Volume Total</div>
            <div style="font-size:20px; font-weight:900; color:var(--text-primary); margin-top:2px;">${Number(r.total_solicitacoes || 0).toLocaleString('pt-BR')}</div>
          </div>
          <div style="background:var(--surface-subtle); padding:10px 14px; border-radius:8px; border:1px solid var(--border-subtle);">
            <div style="font-size:10.5px; color:var(--text-muted); font-weight:700; text-transform:uppercase;">Em Cotação</div>
            <div style="font-size:20px; font-weight:900; color:var(--amber); margin-top:2px;">${Number(r.backlog_ativo || 0).toLocaleString('pt-BR')}</div>
          </div>
          <div style="background:var(--surface-subtle); padding:10px 14px; border-radius:8px; border:1px solid var(--border-subtle);">
            <div style="font-size:10.5px; color:var(--text-muted); font-weight:700; text-transform:uppercase;">SLA Cotação</div>
            <div style="font-size:20px; font-weight:900; color:var(--plx-accent); margin-top:2px;">${r.sla_cotacao_medio || 0}d</div>
          </div>
          <div style="background:var(--surface-subtle); padding:10px 14px; border-radius:8px; border:1px solid var(--border-subtle);">
            <div style="font-size:10.5px; color:var(--text-muted); font-weight:700; text-transform:uppercase;">Conformidade</div>
            <div style="font-size:20px; font-weight:900; color:${(r.taxa_conformidade_pct || 0) >= 85 ? 'var(--emerald)' : 'var(--coral)'}; margin-top:2px;">${r.taxa_conformidade_pct || 0}%</div>
          </div>
        </div>

        <!-- 2. TABELA DE BACKLOG DE REQUISIÇÕES EM COTAÇÃO DA INVESTIDA -->
        <div class="table-panel" style="margin-bottom:18px;">
          <div class="table-toolbar" style="padding:10px 14px;">
            <div>
              <div style="font-size:13px; font-weight:800; color:var(--text-primary);">⚡ Backlog de Requisições em Cotação (${chamados.length})</div>
              <div style="font-size:10.5px; color:var(--text-muted);">Clique em uma linha para abrir a Linha do Tempo e rastreabilidade</div>
            </div>
          </div>

          <div style="max-height: 280px; overflow-y: auto;">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Solicitação</th>
                  <th>Início Cotação</th>
                  <th>Categoria</th>
                  <th>Comprador</th>
                  <th>Modalidade</th>
                  <th style="text-align:center;">Aging / Meta</th>
                  <th>Urgência SLA</th>
                </tr>
              </thead>
              <tbody>
                ${chamados.length === 0 ? `
                  <tr>
                    <td colspan="7" style="text-align:center; padding:24px; color:var(--text-muted);">
                      Nenhuma requisição em aberto para esta investida.
                    </td>
                  </tr>
                ` : chamados.map(c => {
                  const isVencido = c.dias_restantes < 0;
                  return `
                    <tr class="clickable-inv-solic-row" data-solic-id="${c.id}" style="cursor:pointer;" title="Clique para abrir rastreabilidade">
                      <td><strong style="color:var(--plx-accent); font-size:11.5px;">${c.numero_solicitacao || `#ORG-${c.id}`}</strong></td>
                      <td><span style="font-size:10.5px; color:var(--text-secondary); font-weight:600;">${this.formatDate(c.data_cotacao || c.data_criacao)}</span></td>
                      <td><span style="font-size:11px; font-weight:600; color:var(--text-primary);">${c.categoria}</span></td>
                      <td><span style="font-size:11px; font-weight:600; color:var(--text-primary);">${c.comprador || '<span style="color:var(--text-dim);">Não Atribuído</span>'}</span></td>
                      <td><span class="tag-pill" style="font-size:9.5px; padding:1px 5px;">${c.modalidade_compra}</span></td>
                      <td class="center">
                        <strong style="font-size:12px; color:${isVencido ? 'var(--coral)' : 'var(--emerald)'};">${Math.round(c.aging_dias)}d</strong>
                        <span style="font-size:9.5px; color:var(--text-muted);">/ ${c.meta_sla_dias}d</span>
                      </td>
                      <td><span class="pulse-badge ${c.nivel_urgencia}" style="font-size:10px;">${c.label_urgencia}</span></td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        </div>

        <!-- 3. COMPRADORES ATUANDO NA UNIDADE -->
        <div class="table-panel">
          <div class="table-toolbar" style="padding:10px 14px;">
            <div style="font-size:13px; font-weight:800; color:var(--text-primary);">👤 Compradores Atuando nesta Unidade (${compradores.length})</div>
          </div>

          <div style="max-height: 220px; overflow-y: auto;">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Comprador</th>
                  <th style="text-align:center;">Volume Total</th>
                  <th style="text-align:center;">Em Aberto</th>
                  <th style="text-align:center;">SLA Cotação</th>
                  <th style="text-align:center;">% no Prazo</th>
                </tr>
              </thead>
              <tbody>
                ${compradores.map(c => `
                  <tr>
                    <td>
                      <strong style="font-size:12px;">${c.comprador}</strong>
                      <div style="font-size:10px; color:var(--text-muted);">Mat: ${c.qtd_spot_mat || 0} · Serv: ${c.qtd_spot_serv || 0} · Estrat: ${c.qtd_estrategica || 0}</div>
                    </td>
                    <td class="center">${Number(c.total_solicitacoes).toLocaleString('pt-BR')}</td>
                    <td class="center"><strong style="color:var(--amber);">${c.backlog_ativo}</strong></td>
                    <td class="center">${this.getSlaBadge(c.sla_cotacao_medio)}</td>
                    <td class="center">
                      <span class="sla-badge ${(c.taxa_conformidade_pct || 0) >= 85 ? 'fast' : 'warning'}">
                        ${Math.round(c.taxa_conformidade_pct || 0)}%
                      </span>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      `;

      if (window.lucide) window.lucide.createIcons();

      // Listener para abrir timeline da solicitação a partir do backlog da investida
      bodyElem.querySelectorAll('.clickable-inv-solic-row').forEach(row => {
        row.addEventListener('click', () => {
          const solicId = row.dataset.solicId;
          const found = chamados.find(c => String(c.id) === String(solicId));
          this.openSolicitationTimeline(found || solicId);
        });
      });

    } catch (err) {
      bodyElem.innerHTML = `<div style="padding:20px; text-align:center; color:var(--coral);">Erro ao carregar dados: ${err.message}</div>`;
    }
  }

  // =====================================================================
  // 📦 RAIO-X EXECUTIVO DA CATEGORIA (FULL-PAGE DOSSIER VIEW)
  // =====================================================================
  async openCategoryDetailModal(categoriaName) {
    this.openCategoryDetail(categoriaName);
  }

  async openCategoryDetail(categoriaName) {
    this._currentCategoryName = categoriaName;
    const pane = document.getElementById('categoryDetailPane');
    const container = document.getElementById('categoryDetailContent');
    if (!pane || !container) return;

    // Salvar aba anterior para voltar perfeitamente
    this.state.returnTab = this.state.activeTab === 'categoryDetail' ? (this.state.returnTab || 'categorias') : this.state.activeTab;
    this.state.activeTab = 'categoryDetail';
    this.updateHeader();

    // Ativar aba de tela cheia
    document.querySelectorAll('.section-pane').forEach(p => p.classList.remove('active'));
    pane.classList.add('active');

    container.innerHTML = `
      <div style="padding:40px; text-align:center; color:var(--text-muted);">
        <i data-lucide="loader" style="width:24px; height:24px; animation:spin 1s linear infinite;"></i>
        <div style="margin-top:10px; font-weight:700;">Carregando Raio-X de ${categoriaName}...</div>
      </div>
    `;
    if (window.lucide) window.lucide.createIcons();

    window.scrollTo({ top: 0, behavior: 'smooth' });

    try {
      const { mode, month, year } = this.state;
      const res = await fetch(`/api/v1/operacional/categoria-detalhe?categoria=${encodeURIComponent(categoriaName)}&mode=${mode}&month=${month}&year=${year}`);
      if (!res.ok) throw new Error('Falha ao carregar dossiê da categoria');
      const data = await res.json();

      const r = data.resumo || {};
      const investidas = data.porInvestida || [];
      const compradores = data.porComprador || [];
      const chamados = data.chamados || [];

      // Estado dos chamados para filtro e busca interna
      this._categoryChamados = chamados;
      this._categoryFilterStatus = 'todos';
      this._categorySearchQuery = '';

      const renderDossier = () => {
        let filtrados = this._categoryChamados;
        if (this._categoryFilterStatus !== 'todos') {
          if (this._categoryFilterStatus === 'concluidos') {
            filtrados = filtrados.filter(c => c.status_nome === 'Encerrado' || c.status_nome === 'Pedido Enviado');
          } else if (this._categoryFilterStatus === 'cotacao') {
            filtrados = filtrados.filter(c => c.status_nome === 'Cotacao');
          } else if (this._categoryFilterStatus === 'aprovacao') {
            filtrados = filtrados.filter(c => c.status_nome === 'Aprovacao');
          } else if (this._categoryFilterStatus === 'atrasados') {
            filtrados = filtrados.filter(c => (c.aging_dias || c.dias_na_etapa || 0) > (c.meta_sla_dias || 10));
          }
        }

        if (this._categorySearchQuery && this._categorySearchQuery.trim() !== '') {
          const q = this._categorySearchQuery.toLowerCase().trim();
          filtrados = filtrados.filter(c => 
            (c.numero_solicitacao && String(c.numero_solicitacao).toLowerCase().includes(q)) ||
            (c.id && String(c.id).includes(q)) ||
            (c.comprador && c.comprador.toLowerCase().includes(q)) ||
            (c.investida_nome && c.investida_nome.toLowerCase().includes(q)) ||
            (c.status_nome && c.status_nome.toLowerCase().includes(q))
          );
        }

        container.innerHTML = `
          <!-- 1. CABEÇALHO EXECUTIVO DA CATEGORIA COM BOTÃO DE VOLTAR -->
          <div class="dossier-header-bar">
            <div style="display:flex; align-items:center; gap:16px; flex-wrap:wrap;">
              <button class="dossier-back-btn" id="btnBackFromCategoryDetail">
                <i data-lucide="arrow-left" style="width:14px; height:14px;"></i>
                <span>Voltar para Categorias</span>
              </button>

              <div class="dossier-user-info">
                <div class="dossier-user-avatar" style="background:var(--emerald);"><i data-lucide="package" style="width:20px; height:20px;"></i></div>
                <div>
                  <div class="dossier-user-name">${categoriaName}</div>
                  <div class="dossier-user-meta">
                    ${data.periodo} · <strong>${Number(r.total_solicitacoes || 0).toLocaleString('pt-BR')} requisições totais</strong> · SLA Médio: <strong>${r.sla_cotacao_medio || 0} dias</strong>
                  </div>
                </div>
              </div>
            </div>

            <div style="display:flex; align-items:center; gap:8px;">
              <span class="tag-pill" style="padding:4px 8px; font-size:11px; font-weight:800;">
                📦 Modalidade: ${r.modalidade || 'Spot'} (Meta: ${r.meta_sla_dias || 10}d)
              </span>
              <span class="tag-pill" style="padding:4px 8px; font-size:11px; font-weight:800; background:var(--surface-subtle);">
                Mix: ${(r.mix?.spotMateriais || 0)} Mat · ${(r.mix?.spotServicos || 0)} Serv · ${(r.mix?.estrategica || 0)} Estrat
              </span>
            </div>
          </div>

          <!-- 2. OS 4 GRANDES NÚMEROS DA CATEGORIA (HERO KPIS EM TELA CHEIA) -->
          <div class="dossier-kpis-grid">
            <div class="dossier-kpi-card primary">
              <div class="dossier-kpi-title">Volume Total</div>
              <div class="dossier-kpi-number">${Number(r.total_solicitacoes || 0).toLocaleString('pt-BR')}</div>
              <div class="dossier-kpi-sub">
                Spot: <strong>${Number((r.mix?.spotMateriais || 0) + (r.mix?.spotServicos || 0)).toLocaleString('pt-BR')}</strong> · Estratégico: <strong>${Number(r.mix?.estrategica || 0).toLocaleString('pt-BR')}</strong>
              </div>
            </div>

            <div class="dossier-kpi-card amber">
              <div class="dossier-kpi-title" style="color:var(--amber);">Em Aberto</div>
              <div class="dossier-kpi-number" style="color:var(--amber);">${Number(r.backlog_ativo || 0).toLocaleString('pt-BR')}</div>
              <div class="dossier-kpi-sub" style="color:var(--amber);">
                <i data-lucide="clock" style="width:11px; height:11px; display:inline-block; vertical-align:middle;"></i>
                <strong>${Number(r.total_atendidas || 0).toLocaleString('pt-BR')}</strong> concluídas / entregues
              </div>
            </div>

            <div class="dossier-kpi-card accent">
              <div class="dossier-kpi-title">SLA Médio de Cotação</div>
              <div class="dossier-kpi-number" style="color:var(--plx-accent);">${r.sla_cotacao_medio || 0}<span style="font-size:14px; color:var(--text-muted); margin-left:2px;">dias</span></div>
              <div class="dossier-kpi-sub">
                Meta Oficial: <strong>${r.meta_sla_dias || 10} dias</strong>
              </div>
            </div>

            <div class="dossier-kpi-card emerald">
              <div class="dossier-kpi-title">Taxa de Conformidade</div>
              <div class="dossier-kpi-number" style="color:var(--emerald);">${Math.round(r.taxa_conformidade_pct || 100)}%</div>
              <div class="dossier-kpi-sub">
                <span style="color:var(--text-secondary); font-size:11px;"><strong>${Number(r.dentro_sla_count || 0).toLocaleString('pt-BR')}</strong> de <strong>${Number(r.com_sla || 0).toLocaleString('pt-BR')}</strong> no prazo</span>
              </div>
            </div>
          </div>

          <!-- 3. PERFORMANCE POR REDE ATENDIDA NESSA CATEGORIA -->
          <div class="card" style="margin-bottom:20px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px;">
              <div>
                <div class="card-title">🏢 Distribuição por Rede Investida</div>
                <div class="card-subtitle">Volumetria e tempo de atendimento desta categoria em cada rede</div>
              </div>
              <span style="font-size:11.5px; color:var(--text-muted);">${investidas.length} redes atendidas</span>
            </div>

            <div class="dossier-stores-grid">
              ${investidas.map(inv => {
                const isSlow = inv.sla_cotacao_medio > (r.meta_sla_dias || 10);
                return `
                  <div class="dossier-store-card" style="border-top:3px solid ${isSlow ? 'var(--coral)' : 'var(--emerald)'};">
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                      <div class="dossier-store-name">${inv.investida}</div>
                      <span class="sla-badge ${isSlow ? 'slow' : 'fast'}" style="font-size:10px;">
                        ${isSlow ? 'Atenção' : 'Ágil'}
                      </span>
                    </div>
                    <div style="font-size:11.5px; color:var(--text-muted); margin:4px 0 8px;">
                      Vol: <strong>${Number(inv.total_solicitacoes).toLocaleString('pt-BR')}</strong> · Aberto: <strong>${Number(inv.backlog_ativo).toLocaleString('pt-BR')}</strong>
                    </div>
                    <div style="display:flex; justify-content:space-between; align-items:center; font-size:11px; padding-top:6px; border-top:1px dashed var(--border-subtle);">
                      <span style="color:var(--text-secondary);">SLA Cotação:</span>
                      <strong style="color:${isSlow ? 'var(--coral)' : 'var(--emerald)'};">${inv.sla_cotacao_medio || 0} dias</strong>
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          </div>

          <!-- 4. COMPRADORES ATUANDO NA CATEGORIA -->
          <div class="card" style="margin-bottom:20px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px;">
              <div>
                <div class="card-title">👤 Compradores Responsáveis</div>
                <div class="card-subtitle">Especialistas e analistas alocados nesta categoria</div>
              </div>
              <span style="font-size:11.5px; color:var(--text-muted);">${compradores.length} compradores</span>
            </div>

            <div class="dossier-stores-grid">
              ${compradores.map(comp => {
                const isSlow = comp.sla_cotacao_medio > (r.meta_sla_dias || 10);
                return `
                  <div class="dossier-store-card" style="border-top:3px solid ${isSlow ? 'var(--coral)' : 'var(--emerald)'};">
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                      <div class="dossier-store-name" style="font-size:12px;">${comp.comprador}</div>
                      <span class="sla-badge ${isSlow ? 'slow' : 'fast'}" style="font-size:10px;">
                        ${comp.taxa_conformidade_pct}%
                      </span>
                    </div>
                    <div style="font-size:11.5px; color:var(--text-muted); margin:4px 0 8px;">
                      Vol: <strong>${Number(comp.total_solicitacoes).toLocaleString('pt-BR')}</strong> · Aberto: <strong>${Number(comp.backlog_ativo).toLocaleString('pt-BR')}</strong>
                    </div>
                    <div style="display:flex; justify-content:space-between; align-items:center; font-size:11px; padding-top:6px; border-top:1px dashed var(--border-subtle);">
                      <span style="color:var(--text-secondary);">SLA Cotação:</span>
                      <strong style="color:${isSlow ? 'var(--coral)' : 'var(--emerald)'};">${comp.sla_cotacao_medio || 0} dias</strong>
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          </div>

          <!-- 5. TABELA COMPLETA DE SOLICITAÇÕES DA CATEGORIA -->
          <div class="card">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px; flex-wrap:wrap; gap:12px;">
              <div>
                <div class="card-title">📋 Solicitações da Categoria (${filtrados.length})</div>
                <div class="card-subtitle">Rastreamento de solicitações com datas de criação, finalização e lead time</div>
              </div>

              <!-- Filtros de Status Rápidos e Busca -->
              <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
                <div class="filter-tag-group">
                  <button class="btn-filter-tag ${this._categoryFilterStatus === 'todos' ? 'active' : ''}" data-catstatus="todos">Todos (${chamados.length})</button>
                  <button class="btn-filter-tag ${this._categoryFilterStatus === 'cotacao' ? 'active' : ''}" data-catstatus="cotacao">Em Cotação</button>
                  <button class="btn-filter-tag ${this._categoryFilterStatus === 'aprovacao' ? 'active' : ''}" data-catstatus="aprovacao">Em Aprovação</button>
                  <button class="btn-filter-tag ${this._categoryFilterStatus === 'concluidos' ? 'active' : ''}" data-catstatus="concluidos">Concluídos</button>
                  <button class="btn-filter-tag ${this._categoryFilterStatus === 'atrasados' ? 'active' : ''}" data-catstatus="atrasados" style="color:var(--coral);">⚠️ Atrasados</button>
                </div>

                <div class="search-box-wrap" style="width:200px;">
                  <i data-lucide="search" style="width:14px; height:14px;"></i>
                  <input type="text" id="categorySearchInput" placeholder="Buscar na tabela..." value="${this._categorySearchQuery || ''}" style="padding:6px 8px 6px 28px; font-size:12px;">
                </div>
              </div>
            </div>

            <div style="overflow-x: auto;">
              <table class="data-table" style="min-width: 1150px;">
                <thead>
                  <tr>
                    <th style="min-width:130px;">Solicitação</th>
                    <th style="min-width:110px;">Data Cotação</th>
                    <th style="min-width:110px;">Pedido Enviado</th>
                    <th style="min-width:110px;">Etapa Atual</th>
                    <th style="min-width:110px;">Finalização</th>
                    <th style="min-width:120px;">Investida</th>
                    <th style="min-width:120px;">Comprador</th>
                    <th style="min-width:100px;">Modalidade</th>
                    <th style="min-width:110px; text-align:center;">SLA Cotação</th>
                  </tr>
                </thead>
                <tbody>
                  ${filtrados.length === 0 ? `
                    <tr>
                      <td colspan="9" style="text-align:center; padding:30px; color:var(--text-muted);">
                        Nenhuma solicitação encontrada com os filtros aplicados.
                      </td>
                    </tr>
                  ` : filtrados.map(ch => {
                    const ev = this.getTicketSlaEvaluation(ch);
                    const dtCell = (val, color) => val
                      ? `<span style="font-size:11px; color:${color || 'var(--text-secondary)'}; font-weight:600;">${this.formatDate(val)}</span>`
                      : `<span style="font-size:11px; color:var(--text-dim); opacity:0.45;">—</span>`;

                    const displayDtCotacao = ch.data_cotacao || (ev.isEmCotacao || ev.isPosCotacao ? ch.data_criacao : null);
                    const displayDtPedido = ch.data_aprovacao_pedido || (ev.isFinished ? ch.data_aprovacao : null);

                    return `
                      <tr>
                        <td>
                          <div style="font-weight:800; color:var(--plx-accent); font-size:12.5px;">
                            ${ch.numero_solicitacao || `#ORG-${ch.id}`}
                          </div>
                        </td>
                        <td>${dtCell(displayDtCotacao, 'var(--text-secondary)')}</td>
                        <td>${dtCell(displayDtPedido, 'var(--sky)')}</td>
                        <td>
                          <span class="sla-badge ${ev.isFinished ? 'fast' : (ev.isEmCotacao ? 'warning' : 'regular')}">
                            ${ch.status_nome}
                          </span>
                        </td>
                        <td>
                          ${ch.data_finalizacao ? `
                            <span style="font-size:11px; color:var(--emerald); font-weight:700;">
                              ${this.formatDate(ch.data_finalizacao)}
                            </span>
                          ` : (ev.isFinished ? `
                            <span style="font-size:11px; color:var(--emerald); font-weight:700;">
                              Concluído
                            </span>
                          ` : (ev.isPreCotacao ? `
                            <span style="font-size:10.5px; color:var(--text-muted); font-weight:600; background:var(--surface-subtle); padding:2px 6px; border-radius:4px;">
                              Pré-Cotação
                            </span>
                          ` : `
                            <span style="font-size:11px; color:var(--amber); font-weight:700; background:rgba(245,158,11,0.12); padding:2px 6px; border-radius:4px;">
                              Em aberto
                            </span>
                          `))}
                        </td>
                        <td>
                          <div style="font-size:12px; font-weight:700; color:var(--text-primary);">${ch.investida_nome}</div>
                        </td>
                        <td>
                          <div style="font-size:12px; color:var(--text-primary);">${ch.comprador || '<span style="color:var(--text-dim);">Não atribuído</span>'}</div>
                        </td>
                        <td>
                          <span class="tag-pill" style="font-size:10px; padding:2px 6px;">
                            ${ch.modalidade_compra || 'Spot'}
                          </span>
                        </td>
                        <td class="center">
                          ${ev.badgeHtml}
                        </td>
                      </tr>
                    `;
                  }).join('')}
                </tbody>
              </table>
            </div>
          </div>
        `;

        if (window.lucide) window.lucide.createIcons();

        // Listeners de Voltar
        const btnBack = document.getElementById('btnBackFromCategoryDetail');
        if (btnBack) {
          btnBack.addEventListener('click', () => {
            const targetTab = this.state.returnTab || 'categorias';
            this.switchTab(targetTab);
            window.scrollTo({ top: 0, behavior: 'smooth' });
          });
        }

        // Listeners de Filtro de Status
        container.querySelectorAll('.btn-filter-tag[data-catstatus]').forEach(btn => {
          btn.addEventListener('click', () => {
            this._categoryFilterStatus = btn.dataset.catstatus;
            renderDossier();
          });
        });

        // Clique para abrir Linha do Tempo / Rastreabilidade
        container.querySelectorAll('.clickable-solic-row').forEach(row => {
          row.addEventListener('click', () => {
            const solicId = row.dataset.solicId;
            const found = chamados.find(c => String(c.id) === String(solicId));
            this.openSolicitationTimeline(found || solicId);
          });
        });

        // Listener de Busca Instantânea
        const searchInput = document.getElementById('categorySearchInput');
        if (searchInput) {
          searchInput.focus();
          searchInput.setSelectionRange(searchInput.value.length, searchInput.value.length);
          searchInput.addEventListener('input', (e) => {
            this._categorySearchQuery = e.target.value;
            renderDossier();
          });
        }
      };

      renderDossier();

    } catch (err) {
      container.innerHTML = `
        <div class="card" style="text-align:center; padding:40px;">
          <div style="color:var(--coral); font-weight:700; margin-bottom:12px;">Falha ao carregar Raio-X da categoria</div>
          <p style="color:var(--text-muted); font-size:12px;">${err.message}</p>
          <button class="btn btn-primary" id="btnRetryCatDossier" style="margin-top:16px;">Tentar Novamente</button>
        </div>
      `;
      const btnRetry = document.getElementById('btnRetryCatDossier');
      if (btnRetry) btnRetry.addEventListener('click', () => this.openCategoryDetail(categoriaName));
      if (window.lucide) window.lucide.createIcons();
    }
  }

  // =====================================================================
  // 5. RENDER: CATEGORIAS COM SLAS OFICIAIS DA PLURIX
  // =====================================================================
  renderCategorias() {
    this.state.investidasCatSubTab = 'categorias';
    this.renderInvestidasCategorias();
  }

  renderCategoriasSub(container) {
    if (!container) return;
    const data = this.state.data.categorias;
    if (!data) return;

    const categorias = data.categorias || [];

    container.innerHTML = `
      <!-- CARDS DE METAS OFICIAIS PLURIX -->
      <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(240px, 1fr)); gap:12px; margin-bottom:20px;">
        
        <div class="card" style="border-top:3px solid var(--plx-accent);">
          <div style="display:flex; justify-content:space-between; align-items:flex-start;">
            <div>
              <div style="font-size:11px; font-weight:800; color:var(--plx-accent); text-transform:uppercase;">📦 Spot Materiais</div>
              <div style="font-size:20px; font-weight:900; color:var(--text-primary); margin-top:2px;">10 dias <span style="font-size:11px; font-weight:500; color:var(--text-muted);">corridos</span></div>
            </div>
            <span class="sla-badge fast">Meta Oficial</span>
          </div>
          <div style="font-size:11px; color:var(--text-muted); margin-top:8px;">
            Contratações pontuais e negociações abaixo de R$ 50 mil (recorrência &lt; 3 meses).
          </div>
        </div>

        <div class="card" style="border-top:3px solid var(--emerald);">
          <div style="display:flex; justify-content:space-between; align-items:flex-start;">
            <div>
              <div style="font-size:11px; font-weight:800; color:var(--emerald); text-transform:uppercase;">🔧 Spot Serviços</div>
              <div style="font-size:20px; font-weight:900; color:var(--text-primary); margin-top:2px;">15 dias <span style="font-size:11px; font-weight:500; color:var(--text-muted);">corridos</span></div>
            </div>
            <span class="sla-badge fast">Meta Oficial</span>
          </div>
          <div style="font-size:11px; color:var(--text-muted); margin-top:8px;">
            Serviços operacionais, manutenção predial, facilities, obras e adequações.
          </div>
        </div>

        <div class="card" style="border-top:3px solid var(--amber);">
          <div style="display:flex; justify-content:space-between; align-items:flex-start;">
            <div>
              <div style="font-size:11px; font-weight:800; color:var(--amber); text-transform:uppercase;">🎯 Estratégico</div>
              <div style="font-size:20px; font-weight:900; color:var(--text-primary); margin-top:2px;">45 dias <span style="font-size:11px; font-weight:500; color:var(--text-muted);">corridos</span></div>
            </div>
            <span class="sla-badge warning">Complexidade</span>
          </div>
          <div style="font-size:11px; color:var(--text-muted); margin-top:8px;">
            Contratações acima de R$ 50 mil e/ou com recorrência acima de 3 meses.
          </div>
        </div>

      </div>

      <!-- TABELA DETALHADA DE CATEGORIAS -->
      <div class="table-panel">
        <div class="table-toolbar">
          <div style="font-size:13.5px; font-weight:800; color:var(--text-primary);">Performance das Categorias vs Metas Oficiais</div>
          <div style="display:flex; gap:4px;">
            <button class="btn-filter-tag ${this.state.categoriaSort === 'volume' ? 'active' : ''}" data-catsort="volume">Mais Volume</button>
            <button class="btn-filter-tag ${this.state.categoriaSort === 'sla' ? 'active' : ''}" data-catsort="sla">Pior SLA (Lentas)</button>
            <button class="btn-filter-tag ${this.state.categoriaSort === 'backlog' ? 'active' : ''}" data-catsort="backlog">Mais em Aberto</button>
          </div>
        </div>

        <div style="max-height: 520px; overflow-y: auto;">
          <table class="data-table">
            <thead>
              <tr>
                <th style="width:26%;">Categoria</th>
                <th style="width:16%;">Modalidade</th>
                <th style="text-align:center; width:10%;">Volume</th>
                <th style="text-align:center; width:10%;">Em Aberto</th>
                <th style="text-align:center; width:12%;">SLA Cotação</th>
                <th style="text-align:center; width:14%;">Meta Oficial</th>
                <th style="text-align:center; width:12%;">Ações</th>
              </tr>
            </thead>
            <tbody>
              ${categorias.map(c => `
                <tr>
                  <td><strong style="color:var(--text-primary); font-size:12.5px;">${c.categoria}</strong></td>
                  <td>
                    <span style="font-size:11px; font-weight:700; color:${c.modalidade === 'Estratégico' ? 'var(--amber)' : (c.modalidade === 'Spot Serviços' ? 'var(--emerald)' : 'var(--plx-accent)')};">
                      ${c.modalidade}
                    </span>
                  </td>
                  <td class="center"><strong style="color:var(--text-primary); font-size:13px;">${Number(c.total_solicitacoes).toLocaleString('pt-BR')}</strong></td>
                  <td class="center"><strong style="color:${c.backlog_ativo > 50 ? 'var(--amber)' : 'var(--text-primary)'}; font-size:13px;">${Number(c.backlog_ativo).toLocaleString('pt-BR')}</strong></td>
                  <td class="center">
                    <strong style="color:${c.dentro_meta ? 'var(--emerald)' : 'var(--coral)'}; font-size:13px;">${c.sla_cotacao_medio}d</strong>
                  </td>
                  <td class="center">
                    <span class="sla-badge ${c.dentro_meta ? 'fast' : 'slow'}">
                      Meta: ${c.meta_sla}d (${c.dentro_meta ? 'Dentro' : `+${c.gap_meta}d`})
                    </span>
                  </td>
                  <td class="center">
                    <button class="btn btn-primary btn-sm btn-open-category" data-categoria="${c.categoria}">
                      <i data-lucide="eye" style="width:11px; height:11px;"></i>
                      <span>Requisições</span>
                    </button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;

    container.querySelectorAll('.btn-open-category').forEach(btn => {
      btn.addEventListener('click', () => {
        const cat = btn.dataset.categoria;
        if (cat) this.openCategoryDetailModal(cat);
      });
    });

    container.querySelectorAll('.btn-filter-tag').forEach(btn => {
      btn.addEventListener('click', () => {
        this.state.categoriaSort = btn.dataset.catsort;
        this.fetchRemoteData().then(() => this.renderInvestidasCategorias());
      });
    });
  }

  // =====================================================================
  // ⚡ ABA 9: RADAR PREDITIVO DE SLA & VENCIMENTOS
  // =====================================================================
  async renderAlertasSla() {
    const container = document.getElementById('alertasSlaContent');
    if (!container) return;

    this.state.alertasUrgencia = this.state.alertasUrgencia || 'todos';
    this.state.alertasSearch = this.state.alertasSearch || '';

    container.innerHTML = `
      <div style="padding:40px; text-align:center; color:var(--text-muted);">
        <i data-lucide="loader" style="width:24px; height:24px; animation:spin 1s linear infinite;"></i>
        <div style="margin-top:10px; font-weight:700;">Calculando Radar Preditivo de SLA...</div>
      </div>
    `;
    if (window.lucide) window.lucide.createIcons();

    try {
      const { mode, month, year } = this.state;
      const res = await fetch(`/api/v1/operacional/alertas-sla?mode=${mode}&month=${month}&year=${year}&urgencia=${this.state.alertasUrgencia}`);
      if (!res.ok) throw new Error('Falha ao carregar radar de alertas');
      const data = await res.json();

      const t = data.totais || {};
      const topBuyers = data.topCompradoresRisco || [];
      const topStores = data.topInvestidasRisco || [];
      let chamados = data.chamados || [];

      // Filtro de busca local
      if (this.state.alertasSearch && this.state.alertasSearch.trim() !== '') {
        const q = this.state.alertasSearch.toLowerCase().trim();
        chamados = chamados.filter(c => 
          (c.numero_solicitacao && String(c.numero_solicitacao).toLowerCase().includes(q)) ||
          (c.comprador && c.comprador.toLowerCase().includes(q)) ||
          (c.investida_nome && c.investida_nome.toLowerCase().includes(q)) ||
          (c.categoria && c.categoria.toLowerCase().includes(q))
        );
      }

      container.innerHTML = `
        <!-- 1. OS 4 CARDS DO RADAR DE URGÊNCIA (INTERATIVOS) -->
        <div class="radar-counters-grid">
          <div class="radar-counter-card danger ${this.state.alertasUrgencia === 'vencido' ? 'active' : ''}" data-urgency="vencido">
            <div class="radar-counter-icon"><i data-lucide="alert-triangle"></i></div>
            <div>
              <div class="radar-counter-val" style="color:var(--coral);">${Number(t.vencidos || 0).toLocaleString('pt-BR')}</div>
              <div class="radar-counter-label">Já Estourados (Vencidos)</div>
            </div>
          </div>

          <div class="radar-counter-card warning-high ${this.state.alertasUrgencia === 'critico_24h' ? 'active' : ''}" data-urgency="critico_24h">
            <div class="radar-counter-icon"><i data-lucide="flame"></i></div>
            <div>
              <div class="radar-counter-val" style="color:#F97316;">${Number(t.critico24h || 0).toLocaleString('pt-BR')}</div>
              <div class="radar-counter-label">Crítico (Vence em < 24h)</div>
            </div>
          </div>

          <div class="radar-counter-card warning-mid ${this.state.alertasUrgencia === 'alerta_72h' ? 'active' : ''}" data-urgency="alerta_72h">
            <div class="radar-counter-icon"><i data-lucide="clock"></i></div>
            <div>
              <div class="radar-counter-val" style="color:var(--amber);">${Number(t.alerta72h || 0).toLocaleString('pt-BR')}</div>
              <div class="radar-counter-label">Atenção (Vence em 24h-72h)</div>
            </div>
          </div>

          <div class="radar-counter-card success ${this.state.alertasUrgencia === 'no_prazo' ? 'active' : ''}" data-urgency="no_prazo">
            <div class="radar-counter-icon"><i data-lucide="check-circle-2"></i></div>
            <div>
              <div class="radar-counter-val" style="color:var(--emerald);">${Number(t.noPrazo || 0).toLocaleString('pt-BR')}</div>
              <div class="radar-counter-label">No Prazo Confortável</div>
            </div>
          </div>
        </div>

        <!-- 2. MINI-GRIDS DE CONCENTRAÇÃO DE RISCO -->
        <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(340px, 1fr)); gap:16px; margin-bottom:20px;">
          <!-- Top Compradores com Itens em Risco -->
          <div class="card" style="padding:16px 18px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
              <div>
                <div class="card-title" style="font-size:13.5px;">👤 Risco por Comprador</div>
                <div class="card-subtitle">Negociadores com demandas vencidas ou em risco iminente</div>
              </div>
              <span style="font-size:11px; color:var(--text-muted);">${topBuyers.length} compradores</span>
            </div>
            <div style="display:flex; flex-direction:column; gap:6px;">
              ${topBuyers.length === 0 ? '<div style="color:var(--text-muted); font-size:12px; padding:12px 0;">Nenhum comprador com solicitações em risco.</div>' : topBuyers.map(b => `
                <div class="radar-ranking-item btn-risk-buyer" data-buyer="${b.comprador}" style="cursor:pointer;" title="Clique para filtrar por ${b.comprador}">
                  <div style="display:flex; align-items:center; gap:10px;">
                    <div class="buyer-avatar" style="width:26px; height:26px; font-size:10px; border-radius:6px;">${this.getInitials(b.comprador)}</div>
                    <span style="font-size:12px; font-weight:700; color:var(--text-primary);">${b.comprador}</span>
                  </div>
                  <div style="display:flex; align-items:center; gap:6px;">
                    ${b.vencidos > 0 ? `<span class="pulse-badge vencido" style="font-size:10.5px;">${b.vencidos} vencidos</span>` : ''}
                    ${b.criticos > 0 ? `<span class="pulse-badge critico_24h" style="font-size:10.5px;">${b.criticos} críticos</span>` : ''}
                  </div>
                </div>
              `).join('')}
            </div>
          </div>

          <!-- Top Investidas com Itens em Risco -->
          <div class="card" style="padding:16px 18px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
              <div>
                <div class="card-title" style="font-size:13.5px;">🏢 Risco por Rede Investida</div>
                <div class="card-subtitle">Volume de solicitações em cotação aguardando atendimento</div>
              </div>
              <span style="font-size:11px; color:var(--text-muted);">${topStores.length} redes</span>
            </div>
            <div style="display:flex; flex-direction:column; gap:8px;">
              ${topStores.length === 0 ? '<div style="color:var(--text-muted); font-size:12px; padding:12px 0;">Nenhuma rede com gargalo crítico.</div>' : topStores.map(s => {
                const maxRisco = Math.max(...topStores.map(x => x.totalRisco || 1), 1);
                const pctBar = Math.round(((s.totalRisco || 0) / maxRisco) * 100);
                return `
                  <div class="radar-ranking-item btn-risk-store" data-store="${s.investida}" style="cursor:pointer;" title="Clique para abrir o backlog de requisições críticas de ${s.investida}">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
                      <div style="display:flex; align-items:center; gap:8px;">
                        <div class="buyer-avatar" style="width:24px; height:24px; font-size:10px; border-radius:5px; background:var(--plx-accent); color:#fff; display:flex; align-items:center; justify-content:center;">
                          <i data-lucide="store" style="width:12px; height:12px;"></i>
                        </div>
                        <strong style="font-size:12px; color:var(--text-primary);">${s.investida}</strong>
                      </div>
                      <span class="pulse-badge vencido" style="font-size:10px; padding:1px 6px;">${s.totalRisco} requisições</span>
                    </div>
                    <div style="background:rgba(255,255,255,0.06); height:4px; border-radius:2px; overflow:hidden;">
                      <div style="width:${pctBar}%; background:var(--coral); height:100%;"></div>
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          </div>
        </div>

        <!-- 3. TABELA DETALHADA COM CONTAGEM REGRESSIVA DE SLA -->
        <div class="table-panel">
          <div class="table-toolbar">
            <div>
              <div style="font-size:13.5px; font-weight:800; color:var(--text-primary);">Radar de Requisições em Cotação (${chamados.length})</div>
              <div style="font-size:11px; color:var(--text-muted);">Solicitações ativas ordenadas pela urgência de atendimento</div>
            </div>

            <!-- Filtros Rápidos de Urgência e Busca -->
            <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
              <div style="display:flex; gap:3px;">
                <button class="btn-filter-tag ${this.state.alertasUrgencia === 'todos' ? 'active' : ''}" data-urgfilter="todos">Todos (${t.totalAtivos || 0})</button>
                <button class="btn-filter-tag ${this.state.alertasUrgencia === 'vencido' ? 'active' : ''}" data-urgfilter="vencido" style="color:var(--coral);">Vencidos (${t.vencidos || 0})</button>
                <button class="btn-filter-tag ${this.state.alertasUrgencia === 'critico_24h' ? 'active' : ''}" data-urgfilter="critico_24h" style="color:#F97316;">< 24h (${t.critico24h || 0})</button>
                <button class="btn-filter-tag ${this.state.alertasUrgencia === 'alerta_72h' ? 'active' : ''}" data-urgfilter="alerta_72h" style="color:var(--amber);">24h-72h (${t.alerta72h || 0})</button>
              </div>

              <div class="search-input-clean" style="width:210px;">
                <i data-lucide="search" style="width:13px; height:13px; color:var(--text-muted);"></i>
                <input type="text" id="alertasSearchInput" placeholder="Buscar no radar..." value="${this.state.alertasSearch || ''}">
              </div>
            </div>
          </div>

          <div style="max-height: 520px; overflow-y: auto;">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Solicitação</th>
                  <th>Início Cotação</th>
                  <th>Rede & Categoria</th>
                  <th>Comprador</th>
                  <th>Modalidade</th>
                  <th style="text-align:center;">Aging / Meta</th>
                  <th>Urgência SLA</th>
                </tr>
              </thead>
              <tbody>
                ${chamados.length === 0 ? `
                  <tr>
                    <td colspan="7" style="text-align:center; padding:32px; color:var(--text-muted);">
                      Nenhuma requisição encontrada para o filtro selecionado.
                    </td>
                  </tr>
                ` : chamados.map(c => {
                  const isVencido = c.dias_restantes < 0;
                  return `
                    <tr class="clickable-solic-row" data-solic-id="${c.id}" style="cursor:pointer;" title="Clique para abrir a Linha do Tempo da solicitação">
                      <td>
                        <strong style="color:var(--plx-accent); font-size:12px;">${c.numero_solicitacao || `#ORG-${c.id}`}</strong>
                      </td>
                      <td>
                        <span style="font-size:11px; color:var(--text-secondary); font-weight:600;">${this.formatDate(c.data_cotacao || c.data_criacao)}</span>
                      </td>
                      <td>
                        <div style="font-weight:700; color:var(--text-primary); font-size:12px;">${c.investida_nome}</div>
                        <div style="font-size:10px; color:var(--text-muted);">${c.categoria}</div>
                      </td>
                      <td>
                        <div style="font-size:12px; color:var(--text-primary); font-weight:600;">${c.comprador || '<span style="color:var(--text-dim);">Não Atribuído</span>'}</div>
                      </td>
                      <td>
                        <span class="tag-pill" style="font-size:10px; padding:2px 6px;">${c.modalidade_compra}</span>
                      </td>
                      <td class="center">
                        <strong style="font-size:12.5px; color:${isVencido ? 'var(--coral)' : 'var(--emerald)'};">${Math.round(c.aging_dias)}d</strong>
                        <span style="font-size:10px; color:var(--text-muted);">/ ${c.meta_sla_dias}d</span>
                      </td>
                      <td>
                        <span class="pulse-badge ${c.nivel_urgencia}">
                          ${c.label_urgencia}
                        </span>
                      </td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        </div>
      `;

      if (window.lucide) window.lucide.createIcons();

      // Clique para abrir Linha do Tempo / Rastreabilidade
      container.querySelectorAll('.clickable-solic-row').forEach(row => {
        row.addEventListener('click', () => {
          const solicId = row.dataset.solicId;
          const found = chamados.find(c => String(c.id) === String(solicId));
          this.openSolicitationTimeline(found || solicId);
        });
      });

      // Listeners dos Cards de Urgência no Topo
      container.querySelectorAll('.radar-counter-card[data-urgency]').forEach(card => {
        card.addEventListener('click', () => {
          const urg = card.dataset.urgency;
          this.state.alertasUrgencia = this.state.alertasUrgencia === urg ? 'todos' : urg;
          this.renderAlertasSla();
        });
      });

      // Listeners dos Filtros de Tag
      container.querySelectorAll('.btn-filter-tag[data-urgfilter]').forEach(btn => {
        btn.addEventListener('click', () => {
          this.state.alertasUrgencia = btn.dataset.urgfilter;
          this.renderAlertasSla();
        });
      });

      // Listeners dos Compradores em Risco
      container.querySelectorAll('.btn-risk-buyer').forEach(btn => {
        btn.addEventListener('click', () => {
          const bName = btn.dataset.buyer;
          if (bName && bName !== 'Não Atribuído') this.openBuyerDetail(bName);
        });
      });

      // Listeners das Redes Investidas em Risco (Abre Backlog Crítico da Rede)
      container.querySelectorAll('.btn-risk-store').forEach(btn => {
        btn.addEventListener('click', () => {
          const storeName = btn.dataset.store;
          if (storeName) this.openInvestidaDetailModal(storeName);
        });
      });

      // Listener de busca instantânea
      const searchInput = document.getElementById('alertasSearchInput');
      if (searchInput) {
        searchInput.focus();
        searchInput.setSelectionRange(searchInput.value.length, searchInput.value.length);
        searchInput.addEventListener('input', (e) => {
          this.state.alertasSearch = e.target.value;
          this.renderAlertasSla();
        });
      }

    } catch (err) {
      container.innerHTML = `
        <div class="card" style="text-align:center; padding:40px; color:var(--coral);">
          <div style="font-weight:700; margin-bottom:8px;">Falha ao carregar Radar de Alertas</div>
          <div style="font-size:12px; color:var(--text-muted);">${err.message}</div>
        </div>
      `;
    }
  }
}

// Inicialização Global
window.plurixApp = new PlurixApp();
