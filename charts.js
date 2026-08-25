/* =====================================================================
   PLURIX PROCUREMENT CHARTS ENGINE (ApexCharts)
   Visualizações financeiras refinadas para diretoria
   ===================================================================== */

class PlurixCharts {
  constructor() {
    this.instances = {};
  }

  destroyChart(id) {
    if (this.instances[id]) {
      this.instances[id].destroy();
      delete this.instances[id];
    }
  }

  renderEvolucao(elementId, plurixData) {
    const el = document.getElementById(elementId);
    if (!el) return;

    this.destroyChart(elementId);

    const categories = plurixData.monthsOrder.map(m => plurixData.monthNames[m].slice(0, 3));
    const metaSeries = plurixData.monthsOrder.map(m => (plurixData.monthData[m].meta / 1000000).toFixed(2));
    const realSeries = plurixData.monthsOrder.map(m => {
      const d = plurixData.monthData[m];
      return d.closed ? (d.realizado / 1000000).toFixed(2) : null;
    });

    const options = {
      chart: {
        type: 'line',
        height: 310,
        fontFamily: 'Plus Jakarta Sans, sans-serif',
        toolbar: { show: false },
        background: 'transparent',
        animations: { enabled: true, easing: 'easeinout', speed: 400 }
      },
      theme: { mode: 'dark' },
      colors: ['#38B6FF', '#F59E0B'],
      stroke: { width: [3, 2], curve: 'smooth', dashArray: [0, 5] },
      series: [
        { name: 'Realizado OPEX (R$ MM)', data: realSeries, type: 'area' },
        { name: 'Meta Orçada (R$ MM)', data: metaSeries, type: 'line' }
      ],
      fill: {
        type: ['gradient', 'solid'],
        gradient: {
          shade: 'dark',
          type: 'vertical',
          shadeIntensity: 0.3,
          gradientToColors: ['#001489'],
          opacityFrom: 0.35,
          opacityTo: 0.02
        }
      },
      markers: { size: [4, 0], strokeWidth: 0, hover: { size: 6 } },
      xaxis: {
        categories: categories,
        labels: { style: { colors: '#64748B', fontSize: '11px', fontWeight: 600 } },
        axisBorder: { show: false },
        axisTicks: { show: false }
      },
      yaxis: {
        labels: {
          style: { colors: '#64748B', fontSize: '11px' },
          formatter: (v) => 'R$ ' + v + 'M'
        }
      },
      legend: { position: 'top', horizontalAlign: 'right', labels: { colors: '#94A3B8' } },
      tooltip: {
        theme: 'dark',
        y: { formatter: (v) => v ? 'R$ ' + v + ' MM' : 'Em aberto' }
      },
      grid: { borderColor: 'rgba(255, 255, 255, 0.05)', strokeDashArray: 4 }
    };

    this.instances[elementId] = new ApexCharts(el, options);
    this.instances[elementId].render();
  }

  renderDonutModalidade(elementId, opex, capex) {
    const el = document.getElementById(elementId);
    if (!el) return;

    this.destroyChart(elementId);

    const options = {
      chart: {
        type: 'donut',
        height: 270,
        fontFamily: 'Plus Jakarta Sans, sans-serif',
        background: 'transparent'
      },
      theme: { mode: 'dark' },
      colors: ['#38B6FF', '#8B5CF6'],
      labels: ['OPEX (Recorrente)', 'CAPEX (Investimentos)'],
      series: [opex, capex],
      legend: { position: 'bottom', labels: { colors: '#94A3B8' }, fontSize: '12px' },
      plotOptions: {
        pie: {
          donut: {
            size: '65%',
            labels: {
              show: true,
              total: {
                show: true,
                label: 'Total Saving',
                color: '#94A3B8',
                formatter: () => 'R$ ' + ((opex + capex) / 1000000).toFixed(1) + ' MM'
              }
            }
          }
        }
      },
      dataLabels: { enabled: true, formatter: (val) => val.toFixed(1) + '%' },
      tooltip: {
        theme: 'dark',
        y: { formatter: (v) => 'R$ ' + (v / 1000000).toFixed(2) + ' MM' }
      },
      stroke: { show: false }
    };

    this.instances[elementId] = new ApexCharts(el, options);
    this.instances[elementId].render();
  }

  renderBarInvestidas(elementId, investidaList) {
    const el = document.getElementById(elementId);
    if (!el) return;

    this.destroyChart(elementId);

    const labels = investidaList.map(i => i.label);
    const values = investidaList.map(i => (i.value / 1000000).toFixed(2));

    const options = {
      chart: {
        type: 'bar',
        height: 270,
        fontFamily: 'Plus Jakarta Sans, sans-serif',
        toolbar: { show: false },
        background: 'transparent'
      },
      theme: { mode: 'dark' },
      colors: ['#001489'],
      plotOptions: {
        bar: {
          horizontal: true,
          borderRadius: 4,
          barHeight: '50%',
          colors: {
            ranges: [
              { from: 0, to: 10, color: '#38B6FF' }
            ]
          }
        }
      },
      series: [{ name: 'Saving OPEX (R$ MM)', data: values }],
      xaxis: {
        categories: labels,
        labels: { style: { colors: '#64748B', fontSize: '11px' } },
        axisBorder: { show: false }
      },
      yaxis: {
        labels: { style: { colors: '#E2E8F0', fontSize: '12px', fontWeight: 600 } }
      },
      tooltip: {
        theme: 'dark',
        y: { formatter: (v) => 'R$ ' + v + ' MM' }
      },
      grid: { borderColor: 'rgba(255, 255, 255, 0.05)', strokeDashArray: 4 }
    };

    this.instances[elementId] = new ApexCharts(el, options);
    this.instances[elementId].render();
  }

  renderAgingEstoque(elementId, agingDataByMonth, agingBuckets, monthKey = 'jul') {
    const el = document.getElementById(elementId);
    if (!el) return;

    this.destroyChart(elementId);

    const dataM = agingDataByMonth[monthKey] || agingDataByMonth.mai;
    if (!dataM) return;

    const series = Object.entries(dataM).map(([inv, obj]) => ({
      name: inv,
      data: obj.vals
    }));

    const options = {
      chart: {
        type: 'bar',
        height: 290,
        stacked: true,
        fontFamily: 'Plus Jakarta Sans, sans-serif',
        toolbar: { show: false },
        background: 'transparent'
      },
      theme: { mode: 'dark' },
      colors: ['#38B6FF', '#F59E0B', '#8B5CF6', '#F43F5E'],
      plotOptions: { bar: { horizontal: false, borderRadius: 4, columnWidth: '45%' } },
      series: series,
      xaxis: {
        categories: agingBuckets,
        labels: { style: { colors: '#64748B', fontSize: '11px', fontWeight: 600 } },
        axisBorder: { show: false }
      },
      yaxis: {
        labels: {
          style: { colors: '#64748B', fontSize: '11px' },
          formatter: (v) => 'R$ ' + Math.round(v) + 'k'
        }
      },
      legend: { position: 'top', horizontalAlign: 'right', labels: { colors: '#94A3B8' } },
      tooltip: {
        theme: 'dark',
        y: { formatter: (v) => 'R$ ' + Number(v).toLocaleString('pt-BR') + ' mil' }
      },
      grid: { borderColor: 'rgba(255, 255, 255, 0.05)', strokeDashArray: 4 }
    };

    this.instances[elementId] = new ApexCharts(el, options);
    this.instances[elementId].render();
  }
}

// Instanciar
window.plurixCharts = new PlurixCharts();
