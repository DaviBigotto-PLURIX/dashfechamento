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
      buyerSort: 'volume', // 'volume' | 'sla' | 'backlog' | 'conformidade'
      investidaSort: 'sla',
      categoriaSort: 'volume',
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
        title: 'Gestão da Equipe de Compras',
        subtitle: 'Produtividade, capacidade e SLA individual por negociador'
      },
      workflow: {
        title: 'Workflow & Gestão de Backlog',
        subtitle: 'Funil de solicitações, tempo de retenção e desobstrução de gargalos'
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
        subtitle: 'Chamados ativos próximos ao vencimento e gestão ativa de estouros'
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
    if (sidebar && this.state.sidebarCollapsed) {
      sidebar.classList.add('collapsed');
    }

    const toggleSidebar = () => {
      this.state.sidebarCollapsed = !this.state.sidebarCollapsed;
      localStorage.setItem('plurix_sidebar_collapsed', this.state.sidebarCollapsed ? 'true' : 'false');
      if (sidebar) {
        sidebar.classList.toggle('collapsed', this.state.sidebarCollapsed);
      }
    };

    const btnToggle = document.getElementById('btnToggleSidebar');
    if (btnToggle) btnToggle.addEventListener('click', toggleSidebar);
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
    const { mode, month, year, buyerSearch, buyerSort, investidaSort, categoriaSort } = this.state;
    const queryParams = `mode=${mode}&month=${month}&year=${year}`;

    try {
      const [overRes, compRes, wfRes, invRes, catRes] = await Promise.all([
        fetch(`/api/v1/operacional/overview?${queryParams}`),
        fetch(`/api/v1/operacional/compradores?${queryParams}&search=${encodeURIComponent(buyerSearch)}&sort=${buyerSort}`),
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

    // Navegação Sidebar
    document.querySelectorAll('.sidebar-nav .tab-link').forEach(tab => {
      tab.addEventListener('click', () => {
        const tabId = tab.dataset.tab;
        this.switchTab(tabId);
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
            statusBox.innerHTML += `<span style="color:var(--coral);">Erro: ${json.erro || 'Falha ao sincronizar'}</span>`;
            btnConfirmSync.disabled = false;
            btnConfirmSync.textContent = 'Tentar Novamente';
          }
        } catch (err) {
          statusBox.innerHTML += `<span style="color:var(--coral);">Erro de conexão: ${err.message}</span>`;
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

  switchTab(tabId) {
    this.state.activeTab = tabId;
    
    // Atualiza links da sidebar
    document.querySelectorAll('.sidebar-nav .tab-link').forEach(t => t.classList.toggle('active', t.dataset.tab === tabId));
    document.querySelectorAll('.section-pane').forEach(p => p.classList.toggle('active', p.id === tabId));

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
      case 'investidas':
        this.renderInvestidas();
        break;
      case 'categorias':
        this.renderCategorias();
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
        <div class="hero-kpi-card kpi-accent">
          <div class="hero-kpi-header">
            <span class="hero-kpi-label">Volume de Requisições</span>
            <div class="hero-kpi-icon-wrap">
              <i data-lucide="inbox" style="width:14px; height:14px;"></i>
            </div>
          </div>
          <div class="hero-kpi-val">${Number(k.totalSolicitacoes || 0).toLocaleString('pt-BR')}</div>
          <div class="hero-kpi-sub">
            <span>Spot Mat: <strong>${Number(k.totalSpotMateriais || 0).toLocaleString('pt-BR')}</strong></span>
            <span>·</span>
            <span>Spot Serv: <strong>${Number(k.totalSpotServicos || 0).toLocaleString('pt-BR')}</strong></span>
            <span>·</span>
            <span>Estrat: <strong>${Number(k.totalEstrategicas || 0).toLocaleString('pt-BR')}</strong></span>
          </div>
        </div>

        <!-- CARD 2: BACKLOG ATIVO (FILA) -->
        <div class="hero-kpi-card kpi-amber">
          <div class="hero-kpi-header">
            <span class="hero-kpi-label" style="color:var(--amber);">Backlog Ativo (Fila)</span>
            <div class="hero-kpi-icon-wrap" style="background:var(--amber-bg); color:var(--amber);">
              <i data-lucide="clock" style="width:14px; height:14px;"></i>
            </div>
          </div>
          <div class="hero-kpi-val" style="color:var(--amber);">${Number(k.backlogAtivo || 0).toLocaleString('pt-BR')}</div>
          <div class="hero-kpi-sub" style="color:var(--amber);">
            <i data-lucide="check-circle-2" style="width:12px; height:12px;"></i>
            <strong>${Number(k.totalConcluidas || 0).toLocaleString('pt-BR')}</strong> solicitações concluídas
          </div>
        </div>

        <!-- CARD 3: SLA MÉDIO COTAÇÃO -->
        <div class="hero-kpi-card kpi-primary">
          <div class="hero-kpi-header">
            <span class="hero-kpi-label">SLA Médio de Cotação</span>
            <div class="hero-kpi-icon-wrap">
              <i data-lucide="timer" style="width:14px; height:14px;"></i>
            </div>
          </div>
          <div class="hero-kpi-val" style="color:var(--plx-accent);">${k.slaCotacaoMedio || 0}<span style="font-size:14px; font-weight:700; color:var(--text-muted); margin-left:2px;">dias</span></div>
          <div class="hero-kpi-sub">
            <span>Meta Geral: <strong>${k.metaSlaCotacao || 6}d</strong></span>
            <span class="sla-badge ${k.gapSlaCotacao <= 0 ? 'fast' : 'slow'}" style="font-size:10px; padding:2px 6px;">
              ${k.gapSlaCotacao <= 0 ? 'No Prazo' : `+${k.gapSlaCotacao}d acima`}
            </span>
          </div>
        </div>

        <!-- CARD 4: CONFORMIDADE DE SLA -->
        <div class="hero-kpi-card ${k.taxaConformidadePct >= 85 ? 'kpi-emerald' : 'kpi-amber'}">
          <div class="hero-kpi-header">
            <span class="hero-kpi-label">Taxa de Conformidade</span>
            <div class="hero-kpi-icon-wrap" style="background:${k.taxaConformidadePct >= 85 ? 'var(--emerald-bg)' : 'var(--amber-bg)'}; color:${k.taxaConformidadePct >= 85 ? 'var(--emerald)' : 'var(--amber)'};">
              <i data-lucide="shield-check" style="width:14px; height:14px;"></i>
            </div>
          </div>
          <div class="hero-kpi-val" style="color:${k.taxaConformidadePct >= 85 ? 'var(--emerald)' : 'var(--amber)'};">${k.taxaConformidadePct || 0}<span style="font-size:16px;">%</span></div>
          <div class="hero-kpi-sub">
            <span>Meta Oficial: <strong>85%</strong></span>
            <span class="sla-badge ${k.gapConformidade >= 0 ? 'fast' : 'slow'}" style="font-size:10px; padding:2px 6px;">
              ${k.gapConformidade >= 0 ? 'Meta Atingida' : 'Abaixo da meta'}
            </span>
          </div>
        </div>

      </div>

      <!-- =====================================================================
           NÍVEL 2: MODALIDADES DE COMPRA & RADAR DE RISCO (2 COLUNAS)
           ===================================================================== -->
      <div class="exec-grid-2" style="margin-bottom:20px;">
        
        <!-- COLUNA 1: MODALIDADES DE COMPRA -->
        <div class="card">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px;">
            <div>
              <div class="card-title">📦 Desempenho por Modalidade de Compra</div>
              <div class="card-subtitle">Volume, prazos médios e conformidade por modalidade de aquisição</div>
            </div>
            <span class="tag-pill" style="font-size:11px; font-weight:800;">Metas Oficiais</span>
          </div>

          <div style="display:flex; flex-direction:column; gap:10px;">
            <!-- Spot Materiais -->
            <div style="background:var(--surface-subtle); border:1px solid var(--border-subtle); border-radius:var(--radius-sm); padding:12px 14px; border-left:3px solid var(--plx-primary);">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
                <div style="display:flex; align-items:center; gap:8px;">
                  <strong style="font-size:13px; color:var(--text-primary);">Spot Materiais</strong>
                  <span class="tag-pill" style="font-size:10px; padding:2px 6px;">Meta: 10d</span>
                </div>
                <span class="sla-badge ${mod.spotMateriais?.conformidadePct >= 85 ? 'fast' : 'slow'}" style="font-size:11px;">
                  ${mod.spotMateriais?.conformidadePct || 0}% no prazo
                </span>
              </div>
              <div style="display:flex; justify-content:space-between; align-items:center; font-size:11.5px; color:var(--text-secondary);">
                <span>Volume: <strong>${Number(mod.spotMateriais?.total || 0).toLocaleString('pt-BR')}</strong> · Fila: <strong>${Number(mod.spotMateriais?.backlog || 0).toLocaleString('pt-BR')}</strong></span>
                <span>SLA Médio: <strong style="color:var(--plx-accent);">${mod.spotMateriais?.slaMedio || 0} dias</strong></span>
              </div>
            </div>

            <!-- Spot Serviços -->
            <div style="background:var(--surface-subtle); border:1px solid var(--border-subtle); border-radius:var(--radius-sm); padding:12px 14px; border-left:3px solid var(--plx-accent);">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
                <div style="display:flex; align-items:center; gap:8px;">
                  <strong style="font-size:13px; color:var(--text-primary);">Spot Serviços</strong>
                  <span class="tag-pill" style="font-size:10px; padding:2px 6px;">Meta: 15d</span>
                </div>
                <span class="sla-badge ${mod.spotServicos?.conformidadePct >= 85 ? 'fast' : 'slow'}" style="font-size:11px;">
                  ${mod.spotServicos?.conformidadePct || 0}% no prazo
                </span>
              </div>
              <div style="display:flex; justify-content:space-between; align-items:center; font-size:11.5px; color:var(--text-secondary);">
                <span>Volume: <strong>${Number(mod.spotServicos?.total || 0).toLocaleString('pt-BR')}</strong> · Fila: <strong>${Number(mod.spotServicos?.backlog || 0).toLocaleString('pt-BR')}</strong></span>
                <span>SLA Médio: <strong style="color:var(--plx-accent);">${mod.spotServicos?.slaMedio || 0} dias</strong></span>
              </div>
            </div>

            <!-- Estratégico -->
            <div style="background:var(--surface-subtle); border:1px solid var(--border-subtle); border-radius:var(--radius-sm); padding:12px 14px; border-left:3px solid var(--amber);">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
                <div style="display:flex; align-items:center; gap:8px;">
                  <strong style="font-size:13px; color:var(--text-primary);">Estratégico</strong>
                  <span class="tag-pill" style="font-size:10px; padding:2px 6px;">Meta: 45d</span>
                </div>
                <span class="sla-badge ${mod.estrategica?.conformidadePct >= 85 ? 'fast' : 'slow'}" style="font-size:11px;">
                  ${mod.estrategica?.conformidadePct || 0}% no prazo
                </span>
              </div>
              <div style="display:flex; justify-content:space-between; align-items:center; font-size:11.5px; color:var(--text-secondary);">
                <span>Volume: <strong>${Number(mod.estrategica?.total || 0).toLocaleString('pt-BR')}</strong> · Fila: <strong>${Number(mod.estrategica?.backlog || 0).toLocaleString('pt-BR')}</strong></span>
                <span>SLA Médio: <strong style="color:var(--plx-accent);">${mod.estrategica?.slaMedio || 0} dias</strong></span>
              </div>
            </div>
          </div>
        </div>

        <!-- COLUNA 2: RADAR DE RISCO & SLA (RESUMO OPERACIONAL ATIVO) -->
        <div class="card">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px;">
            <div>
              <div class="card-title">⚡ Radar de Risco &amp; Vencimentos</div>
              <div class="card-subtitle">Chamados ativos classificados por urgência de atendimento</div>
            </div>
            <button class="btn btn-subtle btn-sm btn-nav-to-alerts" style="font-size:11.5px; font-weight:700;">
              <span>Ver Radar Completo</span>
              <i data-lucide="arrow-right" style="width:12px; height:12px;"></i>
            </button>
          </div>

          <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:12px;">
            <div style="background:rgba(239, 68, 68, 0.1); border:1px solid rgba(239, 68, 68, 0.3); border-radius:var(--radius-sm); padding:12px; text-align:center;">
              <div style="font-size:22px; font-weight:900; color:var(--coral); line-height:1.1;">
                ${Number(radar.vencidos || 0).toLocaleString('pt-BR')}
              </div>
              <div style="font-size:11px; font-weight:800; color:var(--coral); text-transform:uppercase; margin-top:2px;">
                🔴 Já Estourados
              </div>
            </div>

            <div style="background:rgba(249, 115, 22, 0.1); border:1px solid rgba(249, 115, 22, 0.3); border-radius:var(--radius-sm); padding:12px; text-align:center;">
              <div style="font-size:22px; font-weight:900; color:#F97316; line-height:1.1;">
                ${Number(radar.critico24h || 0).toLocaleString('pt-BR')}
              </div>
              <div style="font-size:11px; font-weight:800; color:#F97316; text-transform:uppercase; margin-top:2px;">
                🟠 Vence em &lt; 24h
              </div>
            </div>

            <div style="background:rgba(245, 158, 11, 0.1); border:1px solid rgba(245, 158, 11, 0.3); border-radius:var(--radius-sm); padding:12px; text-align:center;">
              <div style="font-size:22px; font-weight:900; color:var(--amber); line-height:1.1;">
                ${Number(radar.alerta72h || 0).toLocaleString('pt-BR')}
              </div>
              <div style="font-size:11px; font-weight:800; color:var(--amber); text-transform:uppercase; margin-top:2px;">
                🟡 Vence em 24h-72h
              </div>
            </div>

            <div style="background:rgba(16, 185, 129, 0.1); border:1px solid rgba(16, 185, 129, 0.3); border-radius:var(--radius-sm); padding:12px; text-align:center;">
              <div style="font-size:22px; font-weight:900; color:var(--emerald); line-height:1.1;">
                ${Number(radar.noPrazo || 0).toLocaleString('pt-BR')}
              </div>
              <div style="font-size:11px; font-weight:800; color:var(--emerald); text-transform:uppercase; margin-top:2px;">
                🟢 No Prazo Seguro
              </div>
            </div>
          </div>

          <div style="background:var(--surface-subtle); border-radius:var(--radius-sm); padding:10px 12px; font-size:11.5px; color:var(--text-secondary); display:flex; justify-content:space-between; align-items:center;">
            <span>Total de chamados ativos sob gestão:</span>
            <strong style="color:var(--text-primary); font-size:12.5px;">${Number(radar.totalAtivos || 0).toLocaleString('pt-BR')} solicitações</strong>
          </div>
        </div>

      </div>

      <!-- =====================================================================
           NÍVEL 3: REDES INVESTIDAS & BALANÇO DA EQUIPE (2 COLUNAS)
           ===================================================================== -->
      <div class="exec-grid-2">
        
        <!-- COLUNA 1: REDES INVESTIDAS -->
        <div class="card">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px;">
            <div>
              <div class="card-title">🏢 Panorama por Rede Investida</div>
              <div class="card-subtitle">Demanda, fila e tempo médio de atendimento por unidade</div>
            </div>
            <span style="font-size:11.5px; color:var(--text-muted);">${rankingInvestidas.length} Redes</span>
          </div>

          <div style="display:flex; flex-direction:column; gap:8px;">
            ${rankingInvestidas.map(inv => `
              <div class="investida-rank-item btn-open-investida" data-investida="${inv.investida}" style="background:var(--surface-subtle); border:1px solid var(--border-subtle); border-radius:var(--radius-sm); padding:10px 12px; cursor:pointer;">
                <div style="display:flex; justify-content:space-between; width:100%; align-items:center; margin-bottom:4px;">
                  <div style="display:flex; align-items:center; gap:8px;">
                    <i data-lucide="store" style="width:14px; height:14px; color:var(--plx-accent);"></i>
                    <strong style="color:var(--text-primary); font-size:12.5px;">${inv.investida}</strong>
                  </div>
                  <span class="sla-badge ${inv.taxa_conformidade_pct >= 85 ? 'fast' : (inv.taxa_conformidade_pct >= 70 ? 'warning' : 'slow')}" style="font-size:10.5px;">
                    ${inv.taxa_conformidade_pct}% no prazo
                  </span>
                </div>
                <div style="display:flex; justify-content:space-between; align-items:center; font-size:11px; color:var(--text-secondary); margin-bottom:6px;">
                  <span>Volume: <strong>${Number(inv.total_solicitacoes).toLocaleString('pt-BR')}</strong> · Fila: <strong>${inv.backlog_ativo}</strong></span>
                  <span>SLA Médio: <strong>${inv.sla_cotacao_medio || 0}d</strong></span>
                </div>
                <div style="width:100%; background:rgba(255,255,255,0.06); height:4px; border-radius:2px; overflow:hidden;">
                  <div style="width:${inv.taxa_conformidade_pct}%; background:${inv.taxa_conformidade_pct >= 85 ? 'var(--emerald)' : (inv.taxa_conformidade_pct >= 70 ? 'var(--amber)' : 'var(--coral)')}; height:100%;"></div>
                </div>
              </div>
            `).join('')}
          </div>
        </div>

        <!-- COLUNA 2: GESTÃO DE CARGA DA EQUIPE (COMPRADORES) -->
        <div class="card">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px;">
            <div>
              <div class="card-title">👥 Gestão de Carga da Equipe de Compras</div>
              <div class="card-subtitle">Compradores com maior fila ativa no período para balanceamento</div>
            </div>
            <span style="font-size:11px; color:var(--text-muted);">Clique para ver Raio-X</span>
          </div>

          <div style="display:flex; flex-direction:column; gap:8px;">
            ${topBacklog.slice(0, 5).map((b, idx) => `
              <div class="buyer-lead-row btn-open-buyer" data-comprador="${b.comprador}" style="cursor:pointer;">
                <div style="display:flex; align-items:center; gap:10px;">
                  <span style="font-size:11.5px; font-weight:900; color:var(--text-muted); width:16px;">#${idx + 1}</span>
                  <div class="buyer-avatar" style="width:28px; height:28px; font-size:10px; background:var(--plx-primary);">${this.getInitials(b.comprador)}</div>
                  <div>
                    <div style="font-size:12.5px; font-weight:800; color:var(--text-primary);">${b.comprador}</div>
                    <div style="font-size:10.5px; color:var(--text-muted);">${b.total_solicitacoes} total · SLA: ${b.sla_cotacao_medio}d</div>
                  </div>
                </div>
                <div style="display:flex; align-items:center; gap:10px;">
                  <div style="text-align:right;">
                    <strong style="color:var(--amber); font-size:13px;">${Number(b.backlog_ativo).toLocaleString('pt-BR')}</strong>
                    <div style="font-size:9.5px; color:var(--text-muted);">em aberto</div>
                  </div>
                  <button class="btn btn-primary btn-sm" style="padding:4px 8px; font-size:11px;">
                    Raio-X
                  </button>
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
    const dest = data.destaquesExecutivos || {};

    container.innerHTML = `
      <!-- 4 CARDS DESTAQUES RÁPIDOS -->
      <div class="buyers-highlight-grid">
        
        <div class="buyer-highlight-card destaque-emerald">
          <div class="buyer-card-header" style="color:var(--emerald);">
            <i data-lucide="award" style="width:13px; height:13px;"></i>
            <span>🏆 Melhor SLA / Eficiência</span>
          </div>
          <div class="buyer-card-name">${dest.topPerformer?.comprador || 'Equipe em Nivelamento'}</div>
          <div class="buyer-card-sub">SLA Médio: <strong>${dest.topPerformer?.slaCotacaoMedio || 0} dias</strong> (${dest.topPerformer?.taxaConformidadePct || 100}% no prazo)</div>
        </div>

        <div class="buyer-highlight-card destaque-amber">
          <div class="buyer-card-header" style="color:var(--amber);">
            <i data-lucide="alert-octagon" style="width:13px; height:13px;"></i>
            <span>⚠️ Maior Sobrecarga / Fila</span>
          </div>
          <div class="buyer-card-name">${dest.sobrecarga?.comprador || 'Sem Sobrecarga'}</div>
          <div class="buyer-card-sub">Backlog: <strong>${Number(dest.sobrecarga?.backlogAtivo || 0).toLocaleString('pt-BR')} pendências</strong></div>
        </div>

        <div class="buyer-highlight-card destaque-accent">
          <div class="buyer-card-header" style="color:var(--plx-accent);">
            <i data-lucide="zap" style="width:13px; height:13px;"></i>
            <span>📈 Maior Produtividade</span>
          </div>
          <div class="buyer-card-name">${dest.maiorVolume?.comprador || 'N/A'}</div>
          <div class="buyer-card-sub">Volume: <strong>${Number(dest.maiorVolume?.totalSolicitacoes || 0).toLocaleString('pt-BR')} requisições</strong></div>
        </div>

        <div class="buyer-highlight-card destaque-coral">
          <div class="buyer-card-header" style="color:var(--coral);">
            <i data-lucide="clock" style="width:13px; height:13px;"></i>
            <span>⏱️ Atenção ao SLA</span>
          </div>
          <div class="buyer-card-name">${dest.necessitaSuporte?.comprador || 'N/A'}</div>
          <div class="buyer-card-sub">SLA Médio: <strong>${dest.necessitaSuporte?.slaCotacaoMedio || 0} dias</strong></div>
        </div>

      </div>

      <!-- TABELA DE COMPRADORES -->
      <div class="table-panel">
        <div class="table-toolbar">
          <div class="search-input-clean">
            <i data-lucide="search" style="width:13px; height:13px; color:var(--text-muted);"></i>
            <input type="text" id="buyerSearchInput" placeholder="Buscar comprador ou loja..." value="${this.state.buyerSearch || ''}">
          </div>

          <div style="display:flex; gap:4px;">
            <button class="btn-filter-tag ${this.state.buyerSort === 'volume' ? 'active' : ''}" data-sort="volume">Mais Volume</button>
            <button class="btn-filter-tag ${this.state.buyerSort === 'sla' ? 'active' : ''}" data-sort="sla">Menor SLA</button>
            <button class="btn-filter-tag ${this.state.buyerSort === 'backlog' ? 'active' : ''}" data-sort="backlog">Maior Backlog</button>
            <button class="btn-filter-tag ${this.state.buyerSort === 'conformidade' ? 'active' : ''}" data-sort="conformidade">% no Prazo</button>
          </div>
        </div>

        <div style="max-height: 520px; overflow-y: auto;">
          <table class="data-table">
            <thead>
              <tr>
                <th style="width:28%;">Comprador</th>
                <th style="width:24%;">Lojas Atendidas</th>
                <th style="text-align:center; width:12%;">Volume</th>
                <th style="text-align:center; width:12%;">Backlog</th>
                <th style="text-align:center; width:12%;">SLA Cotação</th>
                <th style="text-align:center; width:12%;">Ações</th>
              </tr>
            </thead>
            <tbody>
              ${buyers.map(b => {
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
      } catch (e) {
        console.warn('Fallback para objeto local na timeline:', e);
      }

      if (!solic && typeof solicitationIdOrObject === 'object') {
        solic = solicitationIdOrObject;
      }

      if (!solic) {
        throw new Error('Não foi possível recuperar os dados desta solicitação.');
      }

      const isFinished = !!(solic.data_finalizacao || ['Pedido Enviado', 'Encerrado'].includes(solic.status_nome));
      const isOver = (solic.aging_dias || solic.dias_atendimento_sla || 0) > (solic.meta_sla_dias || 10);

      if (title) title.textContent = `Solicitação ${solic.numero_solicitacao || `#ORG-${solic.id}`}`;
      if (badge) {
        badge.className = `sla-badge ${isFinished ? (isOver ? 'slow' : 'fast') : (isOver ? 'slow' : 'warning')}`;
        badge.textContent = isFinished ? 'Concluída' : (isOver ? `Estourou SLA (+${Math.round((solic.aging_dias || 0) - (solic.meta_sla_dias || 10))}d)` : solic.status_nome);
      }
      if (subtitle) {
        subtitle.textContent = `${solic.investida_nome} ${solic.unidade_nome ? `· Loja ${solic.unidade_nome}` : ''} · ${solic.categoria} · ${solic.modalidade_compra || 'Spot'}`;
      }

      const getDaysDiff = (d1, d2) => {
        if (!d1 || !d2) return null;
        const t1 = new Date(d1).getTime();
        const t2 = new Date(d2).getTime();
        if (isNaN(t1) || isNaN(t2)) return null;
        const diff = (t2 - t1) / (1000 * 60 * 60 * 24);
        return Math.max(0, parseFloat(diff.toFixed(1)));
      };

      const diff1_2 = getDaysDiff(solic.data_criacao, solic.data_aprovacao);
      const diff2_3 = getDaysDiff(solic.data_aprovacao || solic.data_criacao, solic.data_cotacao);
      const diff3_4 = getDaysDiff(solic.data_cotacao || solic.data_aprovacao || solic.data_criacao, solic.data_aprovacao_pedido);
      const diff4_5 = getDaysDiff(solic.data_aprovacao_pedido || solic.data_cotacao || solic.data_aprovacao || solic.data_criacao, solic.data_finalizacao);

      const formatStepDate = (dt) => {
        if (!dt) return '<span style="color:var(--text-muted); font-size:11.5px; font-style:italic;">Data não informada (null / pendente)</span>';
        return `<span style="color:var(--text-primary); font-weight:700; font-size:12.5px;">${this.formatDate(dt)}</span>`;
      };

      const formatCurrency = (v) => {
        if (v === null || v === undefined || isNaN(v)) return '—';
        return Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
      };

      body.innerHTML = `
        <!-- CARDS DE INFORMAÇÃO RÁPIDA -->
        <div class="timeline-info-grid">
          <div class="timeline-info-card">
            <span class="timeline-info-label">Comprador</span>
            <span class="timeline-info-val" style="color:var(--plx-accent);">${solic.comprador || 'Não Atribuído'}</span>
          </div>
          <div class="timeline-info-card">
            <span class="timeline-info-label">Rede / Loja</span>
            <span class="timeline-info-val">${solic.investida_nome} ${solic.unidade_nome ? `· ${solic.unidade_nome}` : ''}</span>
          </div>
          <div class="timeline-info-card">
            <span class="timeline-info-label">Tempo na Fila / Meta</span>
            <span class="timeline-info-val" style="color:${isOver ? 'var(--coral)' : 'var(--emerald)'};">
              ${Math.round(solic.aging_dias || solic.dias_atendimento_sla || 0)}d <span style="font-size:11px; color:var(--text-muted); font-weight:600;">(Meta: ${solic.meta_sla_dias || 10}d)</span>
            </span>
          </div>
          <div class="timeline-info-card">
            <span class="timeline-info-label">Economia (Saving API)</span>
            <span class="timeline-info-val" style="color:var(--emerald);">
              ${formatCurrency(solic.saving_operacional)} ${solic.saving_percentual > 0 ? `<span style="font-size:10.5px;">(${solic.saving_percentual}%)</span>` : ''}
            </span>
          </div>
        </div>

        <!-- LINHA DO TEMPO / STEPPER DE RASTREABILIDADE -->
        <div class="timeline-stepper-wrapper">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:18px;">
            <div style="font-size:13px; font-weight:800; color:var(--text-primary); display:flex; align-items:center; gap:6px;">
              <i data-lucide="clock" style="width:15px; height:15px; color:var(--plx-accent);"></i>
              Marcos Temporais do Workflow de Compras
            </div>
            <div style="font-size:11px; color:var(--text-muted);">Status Atual: <strong style="color:var(--text-primary);">${solic.status_nome}</strong></div>
          </div>

          <div class="timeline-stepper">
            <!-- ETAPA 1: CRIAÇÃO / ABERTURA -->
            <div class="timeline-step">
              <div class="timeline-step-connector ${solic.data_aprovacao || solic.data_cotacao || solic.data_finalizacao ? 'active' : ''}"></div>
              <div class="timeline-step-marker concluido">
                <i data-lucide="file-plus" style="width:15px; height:15px;"></i>
              </div>
              <div class="timeline-step-body">
                <div>
                  <div class="timeline-step-title">1. Abertura da Solicitação</div>
                  <div class="timeline-step-resp">Origem: ${solic.unidade_nome ? `Loja ${solic.unidade_nome}` : 'Solicitante da Loja'} · ${solic.departamento || 'Geral'}</div>
                </div>
                <div class="timeline-step-date">
                  <div class="timeline-step-date-val">${formatStepDate(solic.data_criacao)}</div>
                  <span class="timeline-step-duration" style="background:rgba(16,185,129,0.15); color:var(--emerald);">Etapa Inicial</span>
                </div>
              </div>
            </div>

            <!-- ETAPA 2: APROVAÇÃO DA SOLICITAÇÃO -->
            <div class="timeline-step">
              <div class="timeline-step-connector ${solic.data_cotacao || solic.data_finalizacao ? 'active' : ''}"></div>
              <div class="timeline-step-marker ${solic.data_aprovacao ? 'concluido' : (solic.status_nome === 'Solicitação' ? 'em_andamento' : 'pendente')}">
                <i data-lucide="${solic.data_aprovacao ? 'check' : (solic.status_nome === 'Solicitação' ? 'loader' : 'circle-dashed')}" style="width:15px; height:15px;"></i>
              </div>
              <div class="timeline-step-body">
                <div>
                  <div class="timeline-step-title">
                    2. Triagem &amp; Aprovação da Requisição
                    ${!solic.data_aprovacao && solic.status_nome !== 'Solicitação' ? '<span style="font-size:10px; font-weight:700; color:var(--text-muted); background:var(--surface-card); padding:1px 6px; border-radius:4px; margin-left:4px;">Aprovado Direto</span>' : ''}
                  </div>
                  <div class="timeline-step-resp">Alçada: Gestor da Área / Planejamento Orçamentário</div>
                </div>
                <div class="timeline-step-date">
                  <div class="timeline-step-date-val">${formatStepDate(solic.data_aprovacao)}</div>
                  ${diff1_2 !== null ? `<span class="timeline-step-duration" style="background:rgba(0,168,232,0.15); color:var(--plx-accent);">+${diff1_2}d após criação</span>` : (solic.data_aprovacao ? '<span class="timeline-step-duration" style="background:rgba(16,185,129,0.15); color:var(--emerald);">Concluído</span>' : '<span class="timeline-step-duration" style="background:rgba(100,116,139,0.15); color:var(--text-muted);">Pendente</span>')}
                </div>
              </div>
            </div>

            <!-- ETAPA 3: COTAÇÃO / NEGOCIAÇÃO -->
            <div class="timeline-step">
              <div class="timeline-step-connector ${solic.data_aprovacao_pedido || solic.data_finalizacao ? 'active' : ''}"></div>
              <div class="timeline-step-marker ${solic.data_cotacao ? 'concluido' : (['Cotacao', 'Em Cotação', 'Validação Técnica'].includes(solic.status_nome) ? 'em_andamento' : (isFinished ? 'concluido' : 'pendente'))}">
                <i data-lucide="${solic.data_cotacao || isFinished ? 'check' : (['Cotacao', 'Em Cotação', 'Validação Técnica'].includes(solic.status_nome) ? 'search' : 'circle-dashed')}" style="width:15px; height:15px;"></i>
              </div>
              <div class="timeline-step-body">
                <div>
                  <div class="timeline-step-title">3. Envio e Negociação de Cotação</div>
                  <div class="timeline-step-resp">Responsável: ${solic.comprador || 'Comprador Indiretas'} · Menor Proposta: ${formatCurrency(solic.valor_menor_cotado)}</div>
                </div>
                <div class="timeline-step-date">
                  <div class="timeline-step-date-val">${formatStepDate(solic.data_cotacao)}</div>
                  ${diff2_3 !== null ? `<span class="timeline-step-duration" style="background:rgba(0,168,232,0.15); color:var(--plx-accent);">+${diff2_3}d em negociação</span>` : (solic.dias_atendimento_sla > 0 ? `<span class="timeline-step-duration" style="background:rgba(0,168,232,0.15); color:var(--plx-accent);">${solic.dias_atendimento_sla}d SLA Cotação</span>` : (isFinished ? '<span class="timeline-step-duration" style="background:rgba(16,185,129,0.15); color:var(--emerald);">Concluído</span>' : '<span class="timeline-step-duration" style="background:rgba(100,116,139,0.15); color:var(--text-muted);">Pendente</span>'))}
                </div>
              </div>
            </div>

            <!-- ETAPA 4: APROVAÇÃO DO PEDIDO DE COMPRA -->
            <div class="timeline-step">
              <div class="timeline-step-connector ${solic.data_finalizacao ? 'active' : ''}"></div>
              <div class="timeline-step-marker ${solic.data_aprovacao_pedido ? 'concluido' : (['Aprovação', 'Em Aprovação'].includes(solic.status_nome) ? 'em_andamento' : (isFinished ? 'concluido' : 'pendente'))}">
                <i data-lucide="${solic.data_aprovacao_pedido || isFinished ? 'check' : (['Aprovação', 'Em Aprovação'].includes(solic.status_nome) ? 'hourglass' : 'circle-dashed')}" style="width:15px; height:15px;"></i>
              </div>
              <div class="timeline-step-body">
                <div>
                  <div class="timeline-step-title">4. Aprovação da Ordem de Compra</div>
                  <div class="timeline-step-resp">Alçada Financeira / Diretoria · Valor Negociado: ${formatCurrency(solic.valor_final_negociado)}</div>
                </div>
                <div class="timeline-step-date">
                  <div class="timeline-step-date-val">${formatStepDate(solic.data_aprovacao_pedido)}</div>
                  ${diff3_4 !== null ? `<span class="timeline-step-duration" style="background:rgba(0,168,232,0.15); color:var(--plx-accent);">+${diff3_4}d aprovação OC</span>` : (isFinished ? '<span class="timeline-step-duration" style="background:rgba(16,185,129,0.15); color:var(--emerald);">Concluído</span>' : '<span class="timeline-step-duration" style="background:rgba(100,116,139,0.15); color:var(--text-muted);">Pendente</span>')}
                </div>
              </div>
            </div>

            <!-- ETAPA 5: PEDIDO ENVIADO / CONCLUSÃO -->
            <div class="timeline-step">
              <div class="timeline-step-marker ${isFinished ? 'concluido' : 'pendente'}">
                <i data-lucide="${isFinished ? 'check-check' : 'circle-dashed'}" style="width:15px; height:15px;"></i>
              </div>
              <div class="timeline-step-body">
                <div>
                  <div class="timeline-step-title">5. Pedido Enviado / Encerramento</div>
                  <div class="timeline-step-resp">Fornecedor: ${solic.fornecedor_vencedor || 'Não informado'} ${solic.data_entrega_prevista ? `· Entrega Prevista: ${this.formatDate(solic.data_entrega_prevista)}` : ''}</div>
                </div>
                <div class="timeline-step-date">
                  <div class="timeline-step-date-val">${formatStepDate(solic.data_finalizacao)}</div>
                  ${isFinished ? `<span class="timeline-step-duration" style="background:rgba(16,185,129,0.15); color:var(--emerald);">${isOver ? 'Concluído com Atraso' : 'Finalizado no Prazo'}</span>` : '<span class="timeline-step-duration" style="background:rgba(245,158,11,0.15); color:var(--amber);">Em Aberto / Fila Ativa</span>'}
                </div>
              </div>
            </div>
          </div>
        </div>
      `;

      if (window.lucide) window.lucide.createIcons();

    } catch (err) {
      body.innerHTML = `
        <div style="padding:30px; text-align:center; color:var(--coral);">
          <div style="font-weight:800; font-size:14px; margin-bottom:6px;">Erro ao carregar Linha do Tempo</div>
          <div style="font-size:12px; color:var(--text-muted);">${err.message}</div>
        </div>
      `;
    }
  }

  // =====================================================================
  // =====================================================================
  // 🔍 RAIO-X EXECUTIVO DO COMPRADOR (FULL-PAGE DOSSIER VIEW)
  // =====================================================================
  async openBuyerDetailModal(compradorName) {
    this.openBuyerDetail(compradorName);
  }

  async openBuyerDetail(compradorName) {
    this._currentBuyerName = compradorName;
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

    try {
      const { mode, month, year } = this.state;
      const res = await fetch(`/api/v1/operacional/comprador-detalhe?comprador=${encodeURIComponent(compradorName)}&mode=${mode}&month=${month}&year=${year}`);
      if (!res.ok) throw new Error('Falha ao carregar dossiê do comprador');
      const data = await res.json();

      const r = data.resumo || {};
      const investidas = data.porInvestida || [];
      const chamados = data.chamadosEmAberto || [];

      // Estado dos chamados para filtro e busca interna
      this._buyerChamados = chamados;
      this._buyerFilterStatus = 'todos';
      this._buyerSearchQuery = '';

      const renderDossier = () => {
        let filtrados = this._buyerChamados;
        if (this._buyerFilterStatus !== 'todos') {
          if (this._buyerFilterStatus === 'concluidos') {
            filtrados = filtrados.filter(c => c.status_nome === 'Encerrado' || c.status_nome === 'Pedido Enviado');
          } else if (this._buyerFilterStatus === 'cotacao') {
            filtrados = filtrados.filter(c => c.status_nome === 'Cotacao');
          } else if (this._buyerFilterStatus === 'aprovacao') {
            filtrados = filtrados.filter(c => c.status_nome === 'Aprovacao');
          } else if (this._buyerFilterStatus === 'atrasados') {
            filtrados = filtrados.filter(c => (c.aging_dias || c.dias_na_etapa || 0) > (c.meta_sla_dias || 10));
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
          <!-- 1. CABEÇALHO EXECUTIVO DO COMPRADOR COM BOTÃO DE VOLTAR -->
          <div class="dossier-header-bar">
            <div style="display:flex; align-items:center; gap:16px; flex-wrap:wrap;">
              <button class="dossier-back-btn" id="btnBackFromBuyerDetail">
                <i data-lucide="arrow-left" style="width:14px; height:14px;"></i>
                <span>Voltar para Compradores</span>
              </button>

              <div class="dossier-user-info">
                <div class="dossier-user-avatar">${this.getInitials(compradorName)}</div>
                <div>
                  <div class="dossier-user-name">${compradorName}</div>
                  <div class="dossier-user-meta">
                    ${data.periodo} · <strong>${Number(r.total_solicitacoes || 0).toLocaleString('pt-BR')} requisições totais</strong> · SLA Médio: <strong>${r.sla_cotacao_medio || 0} dias</strong>
                  </div>
                </div>
              </div>
            </div>

            <div style="display:flex; align-items:center; gap:8px;">
              <span class="tag-pill" style="padding:4px 8px; font-size:11px; font-weight:800;">
                💼 Carteira: ${(r.mix?.spotMateriais || 0)} Mat · ${(r.mix?.spotServicos || 0)} Serv · ${(r.mix?.estrategica || 0)} Estrat
              </span>
            </div>
          </div>

          <!-- 2. OS 4 GRANDES NÚMEROS DO COMPRADOR (HERO KPIS EM TELA CHEIA) -->
          <div class="dossier-kpis-grid">
            <div class="dossier-kpi-card primary">
              <div class="dossier-kpi-title">Volume Total</div>
              <div class="dossier-kpi-number">${Number(r.total_solicitacoes || 0).toLocaleString('pt-BR')}</div>
              <div class="dossier-kpi-sub">
                Spot: <strong>${Number((r.mix?.spotMateriais || 0) + (r.mix?.spotServicos || 0)).toLocaleString('pt-BR')}</strong> · Estratégico: <strong>${Number(r.mix?.estrategica || 0).toLocaleString('pt-BR')}</strong>
              </div>
            </div>

            <div class="dossier-kpi-card amber">
              <div class="dossier-kpi-title" style="color:var(--amber);">Backlog Ativo (Fila)</div>
              <div class="dossier-kpi-number" style="color:var(--amber);">${Number(r.backlog_ativo || 0).toLocaleString('pt-BR')}</div>
              <div class="dossier-kpi-sub" style="color:var(--amber);">
                <i data-lucide="clock" style="width:11px; height:11px; display:inline-block; vertical-align:middle;"></i>
                <strong>${Number(r.total_atendidas || 0).toLocaleString('pt-BR')}</strong> solicitações concluídas
              </div>
            </div>

            <div class="dossier-kpi-card accent">
              <div class="dossier-kpi-title">SLA Médio de Cotação</div>
              <div class="dossier-kpi-number" style="color:var(--plx-accent);">${r.sla_cotacao_medio || 0}<span style="font-size:14px; color:var(--text-muted); margin-left:2px;">dias</span></div>
              <div class="dossier-kpi-sub">
                Mat: <strong>${r.mix?.spotMateriais || 0}</strong> · Serv: <strong>${r.mix?.spotServicos || 0}</strong>
              </div>
            </div>

            <div class="dossier-kpi-card ${r.taxa_conformidade_pct >= 85 ? 'emerald' : 'amber'}">
              <div class="dossier-kpi-title">Taxa de Conformidade</div>
              <div class="dossier-kpi-number" style="color:${r.taxa_conformidade_pct >= 85 ? 'var(--emerald)' : 'var(--amber)'};">${r.taxa_conformidade_pct || 100}%</div>
              <div class="dossier-kpi-sub">
                <span class="sla-badge ${r.taxa_conformidade_pct >= 85 ? 'fast' : 'slow'}" style="font-size:10px;">
                  ${r.taxa_conformidade_pct >= 85 ? 'Meta de 85% Atingida' : 'Abaixo da meta'}
                </span>
              </div>
            </div>
          </div>

          <!-- 3. PERFORMANCE POR REDE / LOJA ATENDIDA (ESPAÇOSA E VISUAL) -->
          <div class="card" style="margin-bottom:20px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px;">
              <div>
                <div class="card-title">🏢 Performance por Rede Atendida</div>
                <div class="card-subtitle">Volumetria, pendências e tempo de atendimento por rede atendida por este comprador</div>
              </div>
              <span style="font-size:11.5px; color:var(--text-muted);">${investidas.length} redes na carteira</span>
            </div>

            <div class="dossier-stores-grid">
              ${investidas.map(inv => {
                const isSlow = inv.alerta === 'Gargalo Crítico nesta Investida' || inv.sla_cotacao_medio > 15;
                return `
                  <div class="dossier-store-card" style="border-top:3px solid ${isSlow ? 'var(--coral)' : 'var(--emerald)'};">
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                      <div class="dossier-store-name">${inv.investida}</div>
                      <span class="sla-badge ${isSlow ? 'slow' : 'fast'}" style="font-size:10px;">
                        ${isSlow ? 'Atenção' : 'Ágil'}
                      </span>
                    </div>
                    <div style="font-size:11.5px; color:var(--text-muted); margin:4px 0 8px;">
                      Volume: <strong>${Number(inv.total_solicitacoes).toLocaleString('pt-BR')}</strong> · Fila: <strong>${Number(inv.backlog_ativo).toLocaleString('pt-BR')}</strong>
                    </div>
                    <div style="display:flex; justify-content:space-between; align-items:center; padding-top:6px; border-top:1px solid var(--border-subtle);">
                      <span style="font-size:11px; color:var(--text-secondary);">SLA Médio:</span>
                      <strong style="color:${isSlow ? 'var(--coral)' : 'var(--emerald)'}; font-size:13px;">${inv.sla_cotacao_medio}d</strong>
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          </div>

          <!-- 4. FILA E HISTÓRICO COMPLETO DE SOLICITAÇÕES (TABELA AMPLA COM BUSCA E FILTROS) -->
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
                    <th style="min-width:105px;">Criação</th>
                    <th style="min-width:105px;">Aprovação</th>
                    <th style="min-width:105px;">Cotação</th>
                    <th style="min-width:105px;">Aprov. OC</th>
                    <th style="min-width:110px;">Finalização</th>
                    <th style="min-width:130px;">Rede / Loja</th>
                    <th style="min-width:180px;">Categoria &amp; Modalidade</th>
                    <th style="min-width:110px;">Etapa Atual</th>
                    <th style="min-width:110px; text-align:center;">Dias / Meta</th>
                  </tr>
                </thead>
                <tbody>
                  ${filtrados.length === 0 ? `
                    <tr>
                      <td colspan="10" style="text-align:center; padding:30px; color:var(--text-muted);">
                        Nenhuma solicitação encontrada com os filtros selecionados.
                      </td>
                    </tr>
                  ` : filtrados.map(ch => {
                    const isOver = (ch.aging_dias || ch.dias_na_etapa || 0) > (ch.meta_sla_dias || 10);
                    const isFinished = ch.status_nome === 'Encerrado' || ch.status_nome === 'Pedido Enviado';
                    const dtCell = (val, color) => val
                      ? `<span style="font-size:11px; color:${color || 'var(--text-secondary)'}; font-weight:600;">${this.formatDate(val)}</span>`
                      : `<span style="font-size:11px; color:var(--text-dim); opacity:0.45;">—</span>`;
                    return `
                      <tr>
                        <td>
                          <strong style="color:var(--plx-accent); font-size:12px;">${ch.numero_solicitacao || `#ORG-${ch.id}`}</strong>
                        </td>
                        <td>${dtCell(ch.data_criacao, 'var(--text-secondary)')}</td>
                        <td>${dtCell(ch.data_aprovacao, 'var(--sky)')}</td>
                        <td>${dtCell(ch.data_cotacao, 'var(--amber)')}</td>
                        <td>${dtCell(ch.data_aprovacao_pedido, 'var(--violet)')}</td>
                        <td>
                          ${ch.data_finalizacao
                            ? `<span style="font-size:11px; color:var(--emerald); font-weight:700;">${this.formatDate(ch.data_finalizacao)}</span>`
                            : `<span style="font-size:10.5px; color:var(--amber); font-weight:700; background:var(--surface-subtle); padding:2px 6px; border-radius:4px;">Em aberto</span>`}
                        </td>
                        <td>
                          <strong style="color:var(--text-primary); font-size:12px;">${ch.investida_nome}</strong>
                        </td>
                        <td>
                          <div style="font-weight:700; color:var(--text-primary); font-size:12px;">${ch.categoria}</div>
                          <div style="font-size:10px; color:var(--text-muted); margin-top:1px;">
                            ${ch.modalidade_compra || 'Spot'} · <span style="color:var(--text-secondary);">Meta: ${ch.meta_sla_dias || 10}d</span>
                          </div>
                        </td>
                        <td>
                          <span class="sla-badge ${isFinished ? 'fast' : (ch.status_nome === 'Cotacao' ? 'warning' : 'regular')}">
                            ${ch.status_nome}
                          </span>
                        </td>
                        <td class="center">
                          <strong style="color:${isFinished ? (isOver ? 'var(--coral)' : 'var(--emerald)') : (isOver ? 'var(--coral)' : 'var(--amber)')}; font-size:12.5px;">
                            ${Math.round(ch.aging_dias || ch.dias_na_etapa || 0)}d
                          </strong>
                          <span style="font-size:10px; color:var(--text-muted);">/ ${ch.meta_sla_dias || 10}d</span>
                          <div style="font-size:9.5px; color:${isFinished ? 'var(--emerald)' : (isOver ? 'var(--coral)' : 'var(--text-muted)')}; font-weight:700;">
                            ${isFinished ? 'Atendido' : (isOver ? `+${Math.round((ch.aging_dias || ch.dias_na_etapa || 0) - (ch.meta_sla_dias || 10))}d atrasado` : 'No prazo')}
                          </div>
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
        const backBtn = document.getElementById('btnBackFromBuyerDetail');
        if (backBtn) {
          backBtn.addEventListener('click', () => {
            const targetTab = this.state.returnTab || 'compradores';
            this.switchTab(targetTab);
          });
        }

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

        container.querySelectorAll('.btn-filter-tag').forEach(btn => {
          btn.addEventListener('click', () => {
            this._buyerFilterStatus = btn.dataset.filter;
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

        if (window.lucide) window.lucide.createIcons();
      };

      renderDossier();

    } catch (err) {
      container.innerHTML = `
        <div style="padding:40px; text-align:center;">
          <div style="color:var(--coral); font-weight:800; margin-bottom:12px;">Erro ao carregar Raio-X: ${err.message}</div>
          <button class="dossier-back-btn" id="btnBackError">
            <i data-lucide="arrow-left" style="width:14px; height:14px;"></i>
            <span>Voltar para Compradores</span>
          </button>
        </div>
      `;
      const btnBack = document.getElementById('btnBackError');
      if (btnBack) {
        btnBack.addEventListener('click', () => this.switchTab(this.state.returnTab || 'compradores'));
      }
      if (window.lucide) window.lucide.createIcons();
    }
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
          <div style="font-size:13.5px; font-weight:800; color:var(--text-primary);">Fila Prioritária de Chamados (Mais Antigos)</div>
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
  // 4. RENDER: INVESTIDAS (REDES)
  // =====================================================================
  renderInvestidas() {
    const container = document.getElementById('investidasContent');
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

            <div style="display:flex; justify-content:space-between; font-size:11.5px; color:var(--text-secondary); margin-bottom:8px;">
              <span>SLA Cotação: <strong style="color:var(--plx-accent);">${inv.sla_cotacao_medio}d</strong></span>
              <span>Backlog: <strong style="color:var(--amber);">${inv.backlog_ativo}</strong></span>
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
                <th style="text-align:center;">Backlog</th>
                <th style="text-align:center;">SLA Médio</th>
                <th style="text-align:center;">% no Prazo</th>
                <th style="text-align:center;">Ações</th>
              </tr>
            </thead>
            <tbody>
              ${investidas.map(inv => `
                <tr>
                  <td><strong style="color:var(--text-primary); font-size:13px;">${inv.investida}</strong></td>
                  <td class="center">${Number(inv.total_solicitacoes).toLocaleString('pt-BR')}</td>
                  <td class="center"><strong style="color:var(--amber);">${Number(inv.backlog_ativo).toLocaleString('pt-BR')}</strong></td>
                  <td class="center"><strong style="color:var(--plx-accent); font-size:13px;">${inv.sla_cotacao_medio}d</strong></td>
                  <td class="center">
                    <span class="sla-badge ${inv.taxa_conformidade_pct >= 85 ? 'fast' : (inv.taxa_conformidade_pct >= 70 ? 'warning' : 'slow')}">
                      ${inv.taxa_conformidade_pct}%
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
  // 🏢 MODAL: DRILLDOWN DA INVESTIDA
  // =====================================================================
  async openInvestidaDetailModal(investidaName) {
    const modal = document.getElementById('investidaDetailModal');
    const nameElem = document.getElementById('modalInvestidaName');
    const metaElem = document.getElementById('modalInvestidaMeta');
    const bodyElem = document.getElementById('investidaModalBody');

    if (!modal || !bodyElem) return;

    nameElem.textContent = investidaName;
    metaElem.textContent = 'Carregando dados da rede...';
    bodyElem.innerHTML = '<div style="padding:30px; text-align:center; color:var(--text-muted);">Consultando...</div>';
    modal.classList.add('active');

    try {
      const { mode, month, year } = this.state;
      const res = await fetch(`/api/v1/operacional/investida-detalhe?investida=${encodeURIComponent(investidaName)}&mode=${mode}&month=${month}&year=${year}`);
      const data = await res.json();

      const r = data.resumo || {};
      const compradores = data.compradores || [];

      metaElem.textContent = `${data.periodo} · ${r.total_solicitacoes || 0} solicitações · SLA: ${r.sla_cotacao_medio || 0} dias`;

      bodyElem.innerHTML = `
        <div style="font-size:13px; font-weight:800; color:var(--text-primary); margin-bottom:8px;">
          Compradores Atuando nesta Unidade (${compradores.length})
        </div>

        <table class="data-table">
          <thead>
            <tr>
              <th>Comprador</th>
              <th style="text-align:center;">Volume</th>
              <th style="text-align:center;">Backlog</th>
              <th style="text-align:center;">SLA Cotação</th>
            </tr>
          </thead>
          <tbody>
            ${compradores.map(c => `
              <tr>
                <td><strong>${c.comprador}</strong></td>
                <td class="center">${Number(c.total_solicitacoes).toLocaleString('pt-BR')}</td>
                <td class="center"><strong style="color:var(--amber);">${c.backlog_ativo}</strong></td>
                <td class="center">${this.getSlaBadge(c.sla_cotacao_medio)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;

      if (window.lucide) window.lucide.createIcons();
    } catch (err) {
      bodyElem.innerHTML = `<div style="padding:20px; text-align:center; color:var(--coral);">Erro: ${err.message}</div>`;
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
              <div class="dossier-kpi-title" style="color:var(--amber);">Backlog Ativo (Fila)</div>
              <div class="dossier-kpi-number" style="color:var(--amber);">${Number(r.backlog_ativo || 0).toLocaleString('pt-BR')}</div>
              <div class="dossier-kpi-sub" style="color:var(--amber);">
                <i data-lucide="clock" style="width:11px; height:11px; display:inline-block; vertical-align:middle;"></i>
                <strong>${Number(r.total_atendidas || 0).toLocaleString('pt-BR')}</strong> solicitações concluídas
              </div>
            </div>

            <div class="dossier-kpi-card accent">
              <div class="dossier-kpi-title">SLA Médio de Cotação</div>
              <div class="dossier-kpi-number" style="color:var(--plx-accent);">${r.sla_cotacao_medio || 0}<span style="font-size:14px; color:var(--text-muted); margin-left:2px;">dias</span></div>
              <div class="dossier-kpi-sub">
                Meta Oficial: <strong>${r.meta_sla_dias || 10} dias</strong>
              </div>
            </div>

            <div class="dossier-kpi-card ${r.taxa_conformidade_pct >= 85 ? 'emerald' : 'amber'}">
              <div class="dossier-kpi-title">Taxa de Conformidade</div>
              <div class="dossier-kpi-number" style="color:${r.taxa_conformidade_pct >= 85 ? 'var(--emerald)' : 'var(--amber)'};">${r.taxa_conformidade_pct || 100}%</div>
              <div class="dossier-kpi-sub">
                <span class="sla-badge ${r.taxa_conformidade_pct >= 85 ? 'fast' : 'slow'}" style="font-size:10px;">
                  ${r.taxa_conformidade_pct >= 85 ? 'Meta de 85% Atingida' : 'Abaixo da meta'}
                </span>
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
                      Volume: <strong>${Number(inv.total_solicitacoes).toLocaleString('pt-BR')}</strong> · Fila: <strong>${Number(inv.backlog_ativo).toLocaleString('pt-BR')}</strong>
                    </div>
                    <div style="display:flex; justify-content:space-between; align-items:center; font-size:11px; padding-top:6px; border-top:1px dashed var(--border-subtle);">
                      <span style="color:var(--text-secondary);">SLA Médio:</span>
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
                      Volume: <strong>${Number(comp.total_solicitacoes).toLocaleString('pt-BR')}</strong> · Fila: <strong>${Number(comp.backlog_ativo).toLocaleString('pt-BR')}</strong>
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
                    <th style="min-width:105px;">Criação</th>
                    <th style="min-width:105px;">Aprovação</th>
                    <th style="min-width:105px;">Cotação</th>
                    <th style="min-width:105px;">Aprov. OC</th>
                    <th style="min-width:110px;">Finalização</th>
                    <th style="min-width:120px;">Investida</th>
                    <th style="min-width:120px;">Comprador</th>
                    <th style="min-width:100px;">Modalidade</th>
                    <th style="min-width:110px;">Etapa / Status</th>
                    <th style="min-width:110px; text-align:center;">Lead Time / SLA</th>
                  </tr>
                </thead>
                <tbody>
                  ${filtrados.length === 0 ? `
                    <tr>
                      <td colspan="11" style="text-align:center; padding:30px; color:var(--text-muted);">
                        Nenhuma solicitação encontrada com os filtros aplicados.
                      </td>
                    </tr>
                  ` : filtrados.map(ch => {
                    const isOver = (ch.aging_dias || ch.dias_na_etapa || 0) > (ch.meta_sla_dias || 10);
                    const isFinished = ch.status_nome === 'Encerrado' || ch.status_nome === 'Pedido Enviado';
                    const dtCell = (val, color) => val
                      ? `<span style="font-size:11px; color:${color || 'var(--text-secondary)'}; font-weight:600;">${this.formatDate(val)}</span>`
                      : `<span style="font-size:11px; color:var(--text-dim); opacity:0.45;">—</span>`;
                    return `
                      <tr>
                        <td>
                          <div style="font-weight:800; color:var(--plx-accent); font-size:12.5px;">
                            ${ch.numero_solicitacao || `#ORG-${ch.id}`}
                          </div>
                        </td>
                        <td>${dtCell(ch.data_criacao, 'var(--text-secondary)')}</td>
                        <td>${dtCell(ch.data_aprovacao, 'var(--sky)')}</td>
                        <td>${dtCell(ch.data_cotacao, 'var(--amber)')}</td>
                        <td>${dtCell(ch.data_aprovacao_pedido, 'var(--violet)')}</td>
                        <td>
                          ${ch.data_finalizacao ? `
                            <span style="font-size:11px; color:var(--emerald); font-weight:700;">
                              ${this.formatDate(ch.data_finalizacao)}
                            </span>
                          ` : `
                            <span style="font-size:11px; color:var(--amber); font-weight:700; background:var(--amber-bg); padding:2px 6px; border-radius:4px;">
                              Em aberto
                            </span>
                          `}
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
                        <td>
                          <span class="sla-badge ${isFinished ? 'fast' : (ch.status_nome === 'Cotacao' ? 'warning' : 'regular')}" style="font-size:11px;">
                            ${ch.status_nome}
                          </span>
                        </td>
                        <td class="center">
                          <strong style="color:${isFinished ? (isOver ? 'var(--coral)' : 'var(--emerald)') : (isOver ? 'var(--coral)' : 'var(--amber)')}; font-size:12.5px;">
                            ${Math.round(ch.aging_dias || ch.dias_na_etapa || 0)}d
                          </strong>
                          <span style="font-size:10px; color:var(--text-muted);">/ ${ch.meta_sla_dias || 10}d</span>
                          <div style="font-size:9.5px; color:${isFinished ? 'var(--emerald)' : (isOver ? 'var(--coral)' : 'var(--text-muted)')}; font-weight:700;">
                            ${isFinished ? 'Atendido' : (isOver ? `+${Math.round((ch.aging_dias || ch.dias_na_etapa || 0) - (ch.meta_sla_dias || 10))}d atrasado` : 'No prazo')}
                          </div>
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
    const container = document.getElementById('categoriasContent');
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
            <button class="btn-filter-tag ${this.state.categoriaSort === 'backlog' ? 'active' : ''}" data-catsort="backlog">Maior Backlog</button>
          </div>
        </div>

        <div style="max-height: 520px; overflow-y: auto;">
          <table class="data-table">
            <thead>
              <tr>
                <th style="width:26%;">Categoria</th>
                <th style="width:16%;">Modalidade</th>
                <th style="text-align:center; width:10%;">Volume</th>
                <th style="text-align:center; width:10%;">Backlog</th>
                <th style="text-align:center; width:12%;">SLA Médio</th>
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
                      <span>Chamados</span>
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
        this.fetchRemoteData().then(() => this.renderCategorias());
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
        <!-- 1. OS 4 CARDS DO RADAR DE URGÊNCIA -->
        <div class="radar-counters-grid">
          <div class="radar-counter-card danger ${this.state.alertasUrgencia === 'vencido' ? 'active' : ''}" data-urgency="vencido">
            <div class="radar-counter-icon"><i data-lucide="alert-octagon"></i></div>
            <div>
              <div class="radar-counter-val">${Number(t.vencidos || 0).toLocaleString('pt-BR')}</div>
              <div class="radar-counter-label">🔴 Já Estourados (Vencidos)</div>
            </div>
          </div>

          <div class="radar-counter-card warning-high ${this.state.alertasUrgencia === 'critico_24h' ? 'active' : ''}" data-urgency="critico_24h">
            <div class="radar-counter-icon"><i data-lucide="flame"></i></div>
            <div>
              <div class="radar-counter-val">${Number(t.critico24h || 0).toLocaleString('pt-BR')}</div>
              <div class="radar-counter-label">🟠 Crítico (Vence em < 24h)</div>
            </div>
          </div>

          <div class="radar-counter-card warning-mid ${this.state.alertasUrgencia === 'alerta_72h' ? 'active' : ''}" data-urgency="alerta_72h">
            <div class="radar-counter-icon"><i data-lucide="clock"></i></div>
            <div>
              <div class="radar-counter-val">${Number(t.alerta72h || 0).toLocaleString('pt-BR')}</div>
              <div class="radar-counter-label">🟡 Alerta (Vence em 24h-72h)</div>
            </div>
          </div>

          <div class="radar-counter-card success ${this.state.alertasUrgencia === 'no_prazo' ? 'active' : ''}" data-urgency="no_prazo">
            <div class="radar-counter-icon"><i data-lucide="check-circle-2"></i></div>
            <div>
              <div class="radar-counter-val">${Number(t.noPrazo || 0).toLocaleString('pt-BR')}</div>
              <div class="radar-counter-label">🟢 No Prazo Confortável</div>
            </div>
          </div>
        </div>

        <!-- 2. MINI-GRIDS DE CONCENTRAÇÃO DE RISCO -->
        <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(320px, 1fr)); gap:16px; margin-bottom:20px;">
          <!-- Top Compradores com Itens em Risco -->
          <div class="card">
            <div class="card-title" style="font-size:13.5px; margin-bottom:4px;">👤 Concentração de Risco por Comprador</div>
            <div class="card-subtitle" style="margin-bottom:12px;">Compradores com maior volume de solicitações vencidas ou próximas de estourar</div>
            <div style="display:flex; flex-direction:column; gap:8px;">
              ${topBuyers.length === 0 ? '<div style="color:var(--text-muted); font-size:12px;">Nenhum comprador em risco no momento.</div>' : topBuyers.map(b => `
                <div style="display:flex; justify-content:space-between; align-items:center; background:var(--surface-subtle); padding:8px 12px; border-radius:6px; cursor:pointer;" class="btn-risk-buyer" data-buyer="${b.comprador}">
                  <div style="display:flex; align-items:center; gap:8px;">
                    <div class="buyer-avatar" style="width:24px; height:24px; font-size:10px;">${this.getInitials(b.comprador)}</div>
                    <strong style="font-size:12px; color:var(--text-primary);">${b.comprador}</strong>
                  </div>
                  <div style="display:flex; align-items:center; gap:6px;">
                    <span class="pulse-badge vencido" style="font-size:10px;">${b.vencidos} vencidos</span>
                    <span class="pulse-badge critico_24h" style="font-size:10px;">${b.criticos} críticos</span>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>

          <!-- Top Investidas com Itens em Risco -->
          <div class="card">
            <div class="card-title" style="font-size:13.5px; margin-bottom:4px;">🏢 Concentração de Risco por Rede Investida</div>
            <div class="card-subtitle" style="margin-bottom:12px;">Redes com maior volume de chamados aguardando atendimento crítico</div>
            <div style="display:flex; flex-direction:column; gap:8px;">
              ${topStores.length === 0 ? '<div style="color:var(--text-muted); font-size:12px;">Nenhuma rede com gargalo crítico no momento.</div>' : topStores.map(s => `
                <div style="display:flex; justify-content:space-between; align-items:center; background:var(--surface-subtle); padding:8px 12px; border-radius:6px;">
                  <strong style="font-size:12px; color:var(--text-primary);">${s.investida}</strong>
                  <span class="pulse-badge vencido" style="font-size:10px;">${s.totalRisco} chamados em risco</span>
                </div>
              `).join('')}
            </div>
          </div>
        </div>

        <!-- 3. TABELA DETALHADA COM CONTAGEM REGRESSIVA DE SLA -->
        <div class="card">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px; flex-wrap:wrap; gap:12px;">
            <div>
              <div class="card-title">📋 Radar Ativo de Chamados (${chamados.length})</div>
              <div class="card-subtitle">Solicitações em aberto ordenadas pela urgência de atendimento</div>
            </div>

            <!-- Filtros de Urgência Rápidos e Busca -->
            <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
              <div class="filter-tag-group">
                <button class="btn-filter-tag ${this.state.alertasUrgencia === 'todos' ? 'active' : ''}" data-urgfilter="todos">Todos (${t.totalAtivos || 0})</button>
                <button class="btn-filter-tag ${this.state.alertasUrgencia === 'vencido' ? 'active' : ''}" data-urgfilter="vencido" style="color:var(--coral);">🔴 Vencidos (${t.vencidos || 0})</button>
                <button class="btn-filter-tag ${this.state.alertasUrgencia === 'critico_24h' ? 'active' : ''}" data-urgfilter="critico_24h" style="color:#F97316;">🟠 < 24h (${t.critico24h || 0})</button>
                <button class="btn-filter-tag ${this.state.alertasUrgencia === 'alerta_72h' ? 'active' : ''}" data-urgfilter="alerta_72h" style="color:var(--amber);">🟡 24h-72h (${t.alerta72h || 0})</button>
              </div>

              <div class="search-box-wrap" style="width:200px;">
                <i data-lucide="search" style="width:14px; height:14px;"></i>
                <input type="text" id="alertasSearchInput" placeholder="Buscar no radar..." value="${this.state.alertasSearch || ''}" style="padding:6px 8px 6px 28px; font-size:12px;">
              </div>
            </div>
          </div>

          <div class="table-container">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Solicitação</th>
                  <th>Criação</th>
                  <th>Modalidade & Meta</th>
                  <th style="text-align:center;">Aging Atual</th>
                  <th>Status de Urgência (Contagem Regressiva)</th>
                  <th>Investida</th>
                  <th>Comprador Responsável</th>
                  <th>Etapa Atual</th>
                </tr>
              </thead>
              <tbody>
                ${chamados.length === 0 ? `
                  <tr>
                    <td colspan="8" style="text-align:center; padding:30px; color:var(--text-muted);">
                      Nenhum chamado encontrado para o filtro selecionado.
                    </td>
                  </tr>
                ` : chamados.map(c => `
                  <tr class="clickable-solic-row" data-solic-id="${c.id}" title="Clique para abrir a Linha do Tempo e Rastreabilidade desta solicitação">
                    <td>
                      <div style="display:flex; align-items:center; gap:6px;">
                        <strong style="color:var(--plx-accent); font-size:12px;">${c.numero_solicitacao || `#ORG-${c.id}`}</strong>
                        <i data-lucide="git-commit" style="width:12px; height:12px; color:var(--text-muted); opacity:0.6;"></i>
                      </div>
                    </td>
                    <td>
                      <span style="font-size:11px; color:var(--text-secondary); font-weight:600;">${this.formatDate(c.data_criacao)}</span>
                    </td>
                    <td>
                      <span class="tag-pill" style="font-size:10.5px;">${c.modalidade_compra} (${c.meta_sla_dias}d)</span>
                    </td>
                    <td class="center">
                      <strong style="font-size:12px; color:${c.dias_restantes < 0 ? 'var(--coral)' : 'var(--text-primary)'};">${Math.round(c.aging_dias)}d</strong>
                    </td>
                    <td>
                      <span class="pulse-badge ${c.nivel_urgencia}">
                        ${c.label_urgencia}
                      </span>
                    </td>
                    <td>
                      <div style="font-size:11.5px; font-weight:700; color:var(--text-primary);">${c.investida_nome}</div>
                    </td>
                    <td>
                      <div style="font-size:11.5px; color:var(--text-primary);">${c.comprador || '<span style="color:var(--text-dim);">Não Atribuído</span>'}</div>
                    </td>
                    <td>
                      <span class="sla-badge regular" style="font-size:10.5px;">${c.status_nome}</span>
                    </td>
                  </tr>
                `).join('')}
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
