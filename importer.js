/* =====================================================================
   PLURIX DATA IMPORTER & SPREADSHEET ENGINE
   Parser inteligente de planilhas Excel (.xlsx/.csv) e JSON
   Com suporte a Backend Node.js e Fallback Local
   ===================================================================== */

class PlurixImporter {
  constructor() {
    this.initEvents();
  }

  initEvents() {
    const modal = document.getElementById('dataModal');
    const btnOpen = document.getElementById('btnOpenDataModal');
    const btnClose = document.getElementById('btnCloseDataModal');
    const dropzone = document.getElementById('dropzoneArea');
    const fileInput = document.getElementById('fileInput');
    const btnExport = document.getElementById('btnExportJSON');
    const btnReset = document.getElementById('btnResetDefault');

    if (btnOpen) btnOpen.addEventListener('click', () => modal.classList.add('active'));
    if (btnClose) btnClose.addEventListener('click', () => modal.classList.remove('active'));
    if (modal) modal.addEventListener('click', (e) => { if (e.target === modal) modal.classList.remove('active'); });

    if (btnExport) btnExport.addEventListener('click', () => window.plurixStore.exportJSON());
    if (btnReset) {
      btnReset.addEventListener('click', async () => {
        if (confirm('Deseja restaurar os dados originais do fechamento?')) {
          try {
            const res = await fetch('/api/reset', { method: 'POST' });
            if (res.ok) {
              const resData = await res.json();
              window.plurixStore.saveData(resData.data);
              window.plurixData = resData.data;
              plurixData = resData.data;
            }
          } catch (e) {
            window.plurixStore.resetToDefault();
            window.plurixData = window.plurixStore.data;
            plurixData = window.plurixStore.data;
          }
          if (modal) modal.classList.remove('active');
          if (window.plurixApp) window.plurixApp.renderAll();
          this.showToast('Dados restaurados com sucesso!', 'success');
        }
      });
    }

    if (dropzone && fileInput) {
      dropzone.addEventListener('click', () => fileInput.click());
      dropzone.addEventListener('dragover', (e) => { e.preventDefault(); dropzone.classList.add('dragover'); });
      dropzone.addEventListener('dragleave', () => dropzone.classList.remove('dragover'));
      dropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropzone.classList.remove('dragover');
        if (e.dataTransfer.files.length) this.processFile(e.dataTransfer.files[0]);
      });
      fileInput.addEventListener('change', (e) => {
        if (e.target.files.length) this.processFile(e.target.files[0]);
      });
    }
  }

  async processFile(file) {
    const modal = document.getElementById('dataModal');

    // 1. Tentar upload para o Backend Node.js primeiro
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      });

      if (res.ok) {
        const jsonRes = await res.json();
        if (jsonRes.success && jsonRes.data) {
          window.plurixStore.saveData(jsonRes.data);
          window.plurixData = jsonRes.data;
          plurixData = jsonRes.data;
          if (modal) modal.classList.remove('active');
          if (window.plurixApp) {
            if (jsonRes.type === 'estocaveis' && jsonRes.mes) {
              window.plurixApp.setMode('month');
              window.plurixApp.setMonth(jsonRes.mes);
              window.plurixApp.switchTab('estoque');
            } else {
              window.plurixApp.renderAll();
            }
          }
          this.showToast(jsonRes.message || 'Arquivo processado pelo servidor com sucesso!', 'success');
          return;
        }
      }
    } catch (err) {
      // Backend não disponível ou erro de rede -> continua para processamento local
    }

    // 2. Fallback: Processamento local no navegador
    const fileName = file.name.toLowerCase();
    if (fileName.endsWith('.json')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const json = JSON.parse(e.target.result);
          window.plurixStore.saveData(json);
          window.plurixData = json;
          plurixData = json;
          if (modal) modal.classList.remove('active');
          if (window.plurixApp) window.plurixApp.renderAll();
          this.showToast(`Arquivo JSON "${file.name}" importado com sucesso!`, 'success');
        } catch (err) {
          this.showToast('Erro ao ler JSON: ' + err.message, 'error');
        }
      };
      reader.readAsText(file);
    } else if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls') || fileName.endsWith('.csv')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target.result);
          const workbook = XLSX.read(data, { type: 'array' });
          this.parseExcelWorkbook(workbook, file.name);
          if (modal) modal.classList.remove('active');
        } catch (err) {
          this.showToast('Erro ao ler planilha: ' + err.message, 'error');
        }
      };
      reader.readAsArrayBuffer(file);
    } else {
      this.showToast('Formato não suportado. Envie um arquivo .xlsx, .csv ou .json', 'warning');
    }
  }

  parseExcelWorkbook(wb, fileName) {
    const sheetName = wb.SheetNames[0];
    const ws = wb.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });

    if (this.isEstocaveisSheet(rows, fileName)) {
      this.parseEstocaveis(rows, fileName);
    } else if (this.isRelatorioGeral(rows, fileName)) {
      this.parseRelatorioGeral(rows, fileName);
    } else {
      this.showToast(`Arquivo "${fileName}" carregado (${rows.length} registros).`, 'success');
    }
  }

  isEstocaveisSheet(rows, fileName) {
    const text = JSON.stringify(rows).toUpperCase();
    return text.includes('ESTOCÁVEIS') || text.includes('ESTOCAVEIS') || text.includes('TEMPO DE COBERTURA') || fileName.toLowerCase().includes('estocaveis');
  }

  isRelatorioGeral(rows, fileName) {
    const headerRow = (rows[0] || []).join(';').toUpperCase();
    return headerRow.includes('ORDEM DE COMPRA') || headerRow.includes('SLA REQUISIÇÃO') || headerRow.includes('SLA REQUISICAO') || fileName.toLowerCase().includes('relatoriogeral');
  }

  parseEstocaveis(rows, fileName) {
    let unidade = 'Avenida';
    let mesKey = 'jul';
    let coberturaVals = [0, 0, 0, 0, 0, 0];

    for (let r = 0; r < Math.min(rows.length, 12); r++) {
      const row = rows[r] || [];
      for (let c = 0; c < row.length; c++) {
        const cell = String(row[c] || '').trim();
        if (cell.includes('Unidade') && row[c + 1]) unidade = String(row[c + 1]).trim();
        if (cell.includes('Referência') && row[c + 1]) {
          const refStr = String(row[c + 1]);
          if (refStr.includes('/05/') || refStr.includes('-05-')) mesKey = 'mai';
          if (refStr.includes('/06/') || refStr.includes('-06-')) mesKey = 'jun';
          if (refStr.includes('/07/') || refStr.includes('-07-')) mesKey = 'jul';
        }
      }
    }

    let foundTable = false;
    for (let r = 0; r < rows.length; r++) {
      const row = rows[r] || [];
      const colB = String(row[1] || '').trim();
      const valE = parseFloat(row[4]);

      if (colB === '0-30') coberturaVals[0] = Math.round(valE * 10) / 10;
      if (colB === '31-60') coberturaVals[1] = Math.round(valE * 10) / 10;
      if (colB === '61-90') coberturaVals[2] = Math.round(valE * 10) / 10;
      if (colB === '91-120') coberturaVals[3] = Math.round(valE * 10) / 10;
      if (colB === '121-180') coberturaVals[4] = Math.round(valE * 10) / 10;
      if (colB === 'MAIOR 180') {
        coberturaVals[5] = Math.round(valE * 10) / 10;
        foundTable = true;
      }
    }

    if (foundTable) {
      const currentData = window.plurixData || plurixData;
      if (!currentData.agingDataByMonth) currentData.agingDataByMonth = {};
      if (!currentData.agingDataByMonth[mesKey]) currentData.agingDataByMonth[mesKey] = {};

      const currentColors = { 'Amigão': '#38B6FF', 'Avenida': '#F59E0B', 'Boa': '#8B5CF6', 'Paraná': '#EF4444' };
      currentData.agingDataByMonth[mesKey][unidade] = {
        color: currentColors[unidade] || '#38B6FF',
        vals: coberturaVals
      };

      window.plurixStore.saveData(currentData);
      window.plurixData = currentData;
      plurixData = currentData;

      if (window.plurixApp) {
        window.plurixApp.setMode('month');
        window.plurixApp.setMonth(mesKey);
        window.plurixApp.switchTab('estoque');
      }

      this.showToast(`Estocáveis (${unidade} · ${currentData.monthNames[mesKey]}) sincronizados!`, 'success');
    }
  }

  parseRelatorioGeral(rows, fileName) {
    let validReqs = rows.length - 1;
    let emergCount = 0;

    for (let r = 1; r < rows.length; r++) {
      const line = JSON.stringify(rows[r] || []).toLowerCase();
      if (line.includes('emergencial')) emergCount++;
    }

    if (window.plurixApp) window.plurixApp.renderAll();
    this.showToast(`Relatório Geral lido: ${validReqs.toLocaleString('pt-BR')} requisições (${emergCount} emergenciais).`, 'success');
  }

  showToast(message, type = 'info') {
    let container = document.getElementById('toastContainer');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toastContainer';
      container.style.cssText = 'position:fixed; bottom:24px; right:24px; z-index:99999; display:flex; flex-direction:column; gap:8px;';
      document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    const bg = type === 'success' ? 'var(--emerald)' : (type === 'error' ? 'var(--coral)' : 'var(--plx-navy)');
    toast.style.cssText = `
      background: ${bg};
      color: #FFF;
      padding: 12px 20px;
      border-radius: 10px;
      font-size: 13px;
      font-weight: 600;
      box-shadow: 0 10px 25px rgba(0,0,0,0.5);
      display: flex;
      align-items: center;
      gap: 10px;
      animation: toastIn 0.3s cubic-bezier(0.16, 1, 0.3, 1);
      border: 1px solid rgba(255,255,255,0.2);
    `;
    toast.textContent = message;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  }
}

// Instanciar
window.plurixImporter = new PlurixImporter();
