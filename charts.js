/**
 * ApexCharts configurations for GymTracker.
 * Filled in as screens are built.
 */
const Charts = {
  // Common dark theme options
  baseOptions: {
    chart: {
      background: 'transparent',
      toolbar: { show: false },
      zoom: { enabled: false },
      fontFamily: "'JetBrains Mono', monospace",
    },
    theme: { mode: 'dark' },
    grid: {
      borderColor: 'rgba(255,255,255,0.06)',
      strokeDashArray: 3,
    },
    tooltip: {
      theme: 'dark',
      style: { fontFamily: "'Manrope', sans-serif", fontSize: '12px' },
    },
    colors: ['#5ac8fa'],
  },

  merge(custom) {
    const base = JSON.parse(JSON.stringify(this.baseOptions));
    for (const key of Object.keys(custom)) {
      if (typeof custom[key] === 'object' && !Array.isArray(custom[key]) && base[key]) {
        base[key] = {...base[key], ...custom[key]};
      } else {
        base[key] = custom[key];
      }
    }
    return base;
  }
};

Charts.renderE1rmChart = function(elementId, chartData) {
  const options = this.merge({
    chart: { type: 'area', height: 200, sparkline: { enabled: false } },
    series: [{ name: 'e1RM', data: chartData.map(d => ({ x: d.date, y: d.e1rm })) }],
    xaxis: { type: 'datetime', labels: { style: { colors: 'rgba(255,255,255,0.4)', fontSize: '10px' } } },
    yaxis: { labels: { style: { colors: 'rgba(255,255,255,0.4)', fontSize: '10px' }, formatter: v => v.toFixed(0) } },
    fill: { type: 'gradient', gradient: { shadeIntensity: 1, opacityFrom: 0.4, opacityTo: 0.05 } },
    stroke: { curve: 'smooth', width: 2 },
    dataLabels: { enabled: false },
  });
  const chart = new ApexCharts(document.getElementById(elementId), options);
  chart.render();
};
