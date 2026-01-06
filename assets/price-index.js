/**
 * TCG Price Index Page
 * PRISM - Price Index System for Market Intelligence
 */

(function() {
  'use strict';

  // ============================================================================
  // Configuration
  // ============================================================================

  const API_BASE = '/apps/trade-in';
  const REFRESH_INTERVAL = 5 * 60 * 1000; // 5 minutes

  // ============================================================================
  // State
  // ============================================================================

  const state = {
    currentView: 'crystal',
    currentGame: 'onepiece',
    currentSet: '',
    chartRange: 30,
    chartIndex: 'GAME_onepiece',
    indices: null,
    setIndices: [],
    crystalData: null,
    chart: null,
    moversTab: 'gainers',
    sortColumn: 'totalMarketCap',
    sortDirection: 'desc',
  };

  // ============================================================================
  // DOM Elements
  // ============================================================================

  const elements = {
    // Header
    lastUpdated: document.querySelector('[data-last-updated]'),
    refreshBtn: document.querySelector('[data-refresh-btn]'),

    // Summary
    summaryBar: document.querySelector('[data-summary-bar]'),
    summaryCards: document.querySelector('[data-summary-cards]'),

    // View Toggle
    viewToggle: document.querySelector('[data-view-toggle]'),

    // Crystal View
    crystalView: document.querySelector('[data-crystal-view]'),
    crystalContainer: document.querySelector('[data-crystal-container]'),
    crystalCanvas: document.querySelector('[data-crystal-canvas]'),
    crystalTooltip: document.querySelector('[data-crystal-tooltip]'),

    // Chart View
    chartView: document.querySelector('[data-chart-view]'),
    chartSelect: document.querySelector('[data-chart-index]'),
    chartRange: document.querySelector('[data-chart-range]'),
    chartCanvas: document.querySelector('[data-chart-canvas]'),
    chartStats: document.querySelector('[data-chart-stats]'),

    // Table View
    tableView: document.querySelector('[data-table-view]'),

    // Filters
    gameFilter: document.querySelector('[data-game-filter]'),
    setFilter: document.querySelector('[data-set-filter]'),

    // Movers
    moversGainers: document.querySelector('[data-movers-gainers]'),
    moversLosers: document.querySelector('[data-movers-losers]'),

    // Sets Table
    setsBody: document.querySelector('[data-sets-body]'),
  };

  // ============================================================================
  // Utilities
  // ============================================================================

  function formatCurrency(value) {
    if (typeof value !== 'number' || isNaN(value)) return '£--';
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  }

  function formatPercent(value) {
    if (typeof value !== 'number' || isNaN(value)) return '--';
    const sign = value > 0 ? '+' : '';
    return `${sign}${value.toFixed(2)}%`;
  }

  function formatNumber(value) {
    if (typeof value !== 'number' || isNaN(value)) return '--';
    return new Intl.NumberFormat('en-GB').format(value);
  }

  function getChangeClass(value) {
    if (value > 0) return 'up';
    if (value < 0) return 'down';
    return 'neutral';
  }

  async function fetchAPI(endpoint) {
    try {
      const response = await fetch(`${API_BASE}${endpoint}`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    } catch (error) {
      console.error(`API Error (${endpoint}):`, error);
      return null;
    }
  }

  // ============================================================================
  // Data Loading
  // ============================================================================

  async function loadAllData() {
    showLoading();

    const [indexData, moversData] = await Promise.all([
      fetchAPI('/price-index'),
      fetchAPI('/price-index/movers?limit=10'),
    ]);

    if (indexData) {
      state.indices = indexData.indices;
      state.setIndices = indexData.setIndices || [];
      renderSummary();
      renderSetsTable();
      populateFilters();
    }

    if (moversData) {
      renderMovers(moversData.gainers, moversData.losers);
    }

    updateTimestamp();
    hideLoading();

    // Load crystal data for current game
    loadCrystalData();
  }

  async function loadCrystalData() {
    const data = await fetchAPI(`/price-index/crystal?game=${state.currentGame}&limit=150`);
    if (data) {
      state.crystalData = data;
      if (state.currentView === 'crystal') {
        renderCrystal();
      }
    }
  }

  async function loadChartData() {
    const [type, key] = state.chartIndex.includes('_')
      ? state.chartIndex.split('_')
      : ['GAME', state.chartIndex];

    const data = await fetchAPI(`/price-index/${type}/${key}?range=${state.chartRange}`);
    if (data) {
      renderChart(data);
    }
  }

  function showLoading() {
    const loading = elements.summaryBar?.querySelector('.price-index__summary-loading');
    if (loading) loading.hidden = false;
    if (elements.summaryCards) elements.summaryCards.hidden = true;
  }

  function hideLoading() {
    const loading = elements.summaryBar?.querySelector('.price-index__summary-loading');
    if (loading) loading.hidden = true;
    if (elements.summaryCards) elements.summaryCards.hidden = false;
  }

  function updateTimestamp() {
    if (elements.lastUpdated) {
      const now = new Date();
      elements.lastUpdated.textContent = `Updated ${now.toLocaleTimeString('en-GB', {
        hour: '2-digit',
        minute: '2-digit',
      })}`;
    }
  }

  // ============================================================================
  // Summary Bar
  // ============================================================================

  function renderSummary() {
    if (!elements.summaryCards || !state.indices) return;

    const cards = [
      {
        label: 'One Piece Index',
        key: 'GAME_onepiece',
        format: 'currency',
      },
      {
        label: 'Top 100',
        key: 'TOP_100',
        format: 'currency',
      },
      {
        label: 'Cards Tracked',
        key: 'GAME_onepiece',
        field: 'cardCount',
        format: 'number',
      },
      {
        label: 'Market Volatility',
        key: 'GAME_onepiece',
        field: 'volatility',
        format: 'percent',
      },
    ];

    let html = '';
    for (const card of cards) {
      const data = state.indices[card.key];
      if (!data) continue;

      const field = card.field || 'value';
      const value = data[field];
      const change = data.change24h || 0;

      let displayValue;
      switch (card.format) {
        case 'currency':
          displayValue = formatCurrency(value);
          break;
        case 'percent':
          displayValue = formatPercent(value);
          break;
        case 'number':
        default:
          displayValue = formatNumber(value);
      }

      const changeClass = getChangeClass(change);
      const showChange = card.format === 'currency' && change !== 0;

      html += `
        <div class="price-index__summary-card">
          <div class="price-index__summary-label">${card.label}</div>
          <div class="price-index__summary-value">${displayValue}</div>
          ${showChange ? `
            <div class="price-index__summary-change price-index__summary-change--${changeClass}">
              ${change > 0 ? '▲' : '▼'} ${formatPercent(change)}
            </div>
          ` : ''}
        </div>
      `;
    }

    elements.summaryCards.innerHTML = html;
  }

  // ============================================================================
  // Crystal Visualization
  // ============================================================================

  function renderCrystal() {
    if (!elements.crystalCanvas || !state.crystalData) return;

    const canvas = elements.crystalCanvas;
    const ctx = canvas.getContext('2d');
    const container = elements.crystalContainer;

    // Set canvas size
    const rect = container.getBoundingClientRect();
    canvas.width = rect.width * window.devicePixelRatio;
    canvas.height = rect.height * window.devicePixelRatio;
    canvas.style.width = rect.width + 'px';
    canvas.style.height = rect.height + 'px';
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

    const width = rect.width;
    const height = rect.height;
    const nodes = state.crystalData.nodes || [];

    // Hide loading
    const loading = container.querySelector('.price-index__crystal-loading');
    if (loading) loading.hidden = true;

    // Calculate positions using simple force layout
    const positions = calculateNodePositions(nodes, width, height);

    // Clear canvas
    ctx.fillStyle = '#0f1419';
    ctx.fillRect(0, 0, width, height);

    // Draw background lattice
    drawLattice(ctx, width, height);

    // Draw edges (correlations)
    if (state.crystalData.edges) {
      drawEdges(ctx, state.crystalData.edges, positions);
    }

    // Draw nodes
    drawNodes(ctx, nodes, positions);

    // Set up hover handling
    setupCrystalHover(canvas, nodes, positions);
  }

  function calculateNodePositions(nodes, width, height) {
    const positions = new Map();
    const centerX = width / 2;
    const centerY = height / 2;
    const maxRadius = Math.min(width, height) * 0.4;

    // Group nodes by set
    const setGroups = new Map();
    nodes.forEach((node) => {
      const set = node.setCode || 'unknown';
      if (!setGroups.has(set)) setGroups.set(set, []);
      setGroups.get(set).push(node);
    });

    // Position sets in a circle, cards within each set in smaller circles
    const sets = Array.from(setGroups.keys());
    const setAngleStep = (2 * Math.PI) / sets.length;

    sets.forEach((set, setIndex) => {
      const setAngle = setAngleStep * setIndex - Math.PI / 2;
      const setCenterX = centerX + Math.cos(setAngle) * maxRadius * 0.6;
      const setCenterY = centerY + Math.sin(setAngle) * maxRadius * 0.6;

      const cards = setGroups.get(set);
      const cardRadius = Math.min(80, maxRadius * 0.3);
      const cardAngleStep = (2 * Math.PI) / Math.max(cards.length, 1);

      cards.forEach((card, cardIndex) => {
        const cardAngle = cardAngleStep * cardIndex;
        const x = setCenterX + Math.cos(cardAngle) * cardRadius;
        const y = setCenterY + Math.sin(cardAngle) * cardRadius;
        positions.set(card.id, { x, y, node: card });
      });
    });

    return positions;
  }

  function drawLattice(ctx, width, height) {
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.05)';
    ctx.lineWidth = 1;

    // Hexagonal grid
    const spacing = 40;
    for (let y = 0; y < height + spacing; y += spacing * Math.sqrt(3) / 2) {
      const offset = (Math.floor(y / (spacing * Math.sqrt(3) / 2)) % 2) * spacing / 2;
      for (let x = offset; x < width + spacing; x += spacing) {
        ctx.beginPath();
        ctx.arc(x, y, 1, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
  }

  function drawEdges(ctx, edges, positions) {
    edges.forEach((edge) => {
      const source = positions.get(edge.source);
      const target = positions.get(edge.target);
      if (!source || !target) return;

      const correlation = edge.correlation || 0;
      const alpha = Math.abs(correlation) * 0.5;
      const color = correlation > 0
        ? `rgba(0, 255, 136, ${alpha})`
        : `rgba(255, 68, 68, ${alpha})`;

      ctx.strokeStyle = color;
      ctx.lineWidth = Math.abs(correlation) * 2;
      ctx.beginPath();
      ctx.moveTo(source.x, source.y);
      ctx.lineTo(target.x, target.y);
      ctx.stroke();
    });
  }

  function drawNodes(ctx, nodes, positions) {
    nodes.forEach((node) => {
      const pos = positions.get(node.id);
      if (!pos) return;

      const change = node.change || 0;
      const size = Math.max(4, Math.min(12, Math.sqrt(node.price) * 2));

      // Node color based on price change
      let color;
      if (change > 5) color = '#00ff88';
      else if (change > 0) color = '#4ade80';
      else if (change > -5) color = '#94a3b8';
      else if (change > -10) color = '#f87171';
      else color = '#ff4444';

      // Glow effect
      const gradient = ctx.createRadialGradient(pos.x, pos.y, 0, pos.x, pos.y, size * 2);
      gradient.addColorStop(0, color);
      gradient.addColorStop(1, 'transparent');

      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, size * 2, 0, Math.PI * 2);
      ctx.fill();

      // Core node
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, size, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  function setupCrystalHover(canvas, nodes, positions) {
    const tooltip = elements.crystalTooltip;
    if (!tooltip) return;

    canvas.addEventListener('mousemove', (e) => {
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      // Find nearest node
      let nearest = null;
      let nearestDist = 20; // Max hover distance

      positions.forEach((pos) => {
        const dist = Math.sqrt(Math.pow(pos.x - x, 2) + Math.pow(pos.y - y, 2));
        if (dist < nearestDist) {
          nearestDist = dist;
          nearest = pos.node;
        }
      });

      if (nearest) {
        tooltip.hidden = false;
        tooltip.style.left = `${x + 15}px`;
        tooltip.style.top = `${y - 10}px`;

        tooltip.querySelector('[data-tooltip-name]').textContent = nearest.name;
        tooltip.querySelector('[data-tooltip-set]').textContent = nearest.setCode || '';
        tooltip.querySelector('[data-tooltip-price]').textContent = formatCurrency(nearest.price);

        const changeEl = tooltip.querySelector('[data-tooltip-change]');
        changeEl.textContent = formatPercent(nearest.change);
        changeEl.className = `price-index__tooltip-change price-index__mover-change--${getChangeClass(nearest.change)}`;
      } else {
        tooltip.hidden = true;
      }
    });

    canvas.addEventListener('mouseleave', () => {
      tooltip.hidden = true;
    });
  }

  // ============================================================================
  // Chart
  // ============================================================================

  function renderChart(data) {
    if (!elements.chartCanvas || !window.Chart) return;

    const ctx = elements.chartCanvas.getContext('2d');

    // Destroy existing chart
    if (state.chart) {
      state.chart.destroy();
    }

    const labels = data.history.map((h) => h.date);
    const values = data.history.map((h) => h.value);

    state.chart = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: 'Index Value',
          data: values,
          borderColor: '#3b82f6',
          backgroundColor: 'rgba(59, 130, 246, 0.1)',
          borderWidth: 2,
          fill: true,
          tension: 0.3,
          pointRadius: 0,
          pointHoverRadius: 4,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          mode: 'index',
          intersect: false,
        },
        plugins: {
          legend: {
            display: false,
          },
          tooltip: {
            backgroundColor: '#1a1f26',
            titleColor: '#e5e7eb',
            bodyColor: '#e5e7eb',
            borderColor: '#2d3640',
            borderWidth: 1,
            callbacks: {
              label: (ctx) => formatCurrency(ctx.parsed.y),
            },
          },
        },
        scales: {
          x: {
            grid: {
              color: 'rgba(45, 54, 64, 0.5)',
            },
            ticks: {
              color: '#9ca3af',
              maxTicksLimit: 7,
            },
          },
          y: {
            grid: {
              color: 'rgba(45, 54, 64, 0.5)',
            },
            ticks: {
              color: '#9ca3af',
              callback: (value) => formatCurrency(value),
            },
          },
        },
      },
    });

    // Update stats
    if (data.stats) {
      const statHigh = document.querySelector('[data-stat-high]');
      const statLow = document.querySelector('[data-stat-low]');
      const statAvg = document.querySelector('[data-stat-avg]');
      const statVolatility = document.querySelector('[data-stat-volatility]');

      if (statHigh) statHigh.textContent = formatCurrency(data.stats.high);
      if (statLow) statLow.textContent = formatCurrency(data.stats.low);
      if (statAvg) statAvg.textContent = formatCurrency(data.stats.avg);
      if (statVolatility) statVolatility.textContent = formatPercent(data.stats.volatility);
    }
  }

  // ============================================================================
  // Movers
  // ============================================================================

  function renderMovers(gainers, losers) {
    renderMoversList(elements.moversGainers, gainers, true);
    renderMoversList(elements.moversLosers, losers, false);
  }

  function renderMoversList(container, movers, isGainers) {
    if (!container) return;

    if (!movers || movers.length === 0) {
      container.innerHTML = `
        <div class="price-index__movers-empty">
          No ${isGainers ? 'gainers' : 'losers'} today
        </div>
      `;
      return;
    }

    const html = movers.map((mover, index) => `
      <div class="price-index__mover-item">
        <span class="price-index__mover-rank">${index + 1}</span>
        <div class="price-index__mover-info">
          <div class="price-index__mover-name">${escapeHtml(mover.name)}</div>
          <div class="price-index__mover-set">${mover.setCode || ''}</div>
        </div>
        <span class="price-index__mover-change price-index__mover-change--${isGainers ? 'up' : 'down'}">
          ${formatPercent(mover.changePercent)}
        </span>
      </div>
    `).join('');

    container.innerHTML = html;
  }

  // ============================================================================
  // Sets Table
  // ============================================================================

  function renderSetsTable() {
    if (!elements.setsBody || !state.setIndices) return;

    const sorted = [...state.setIndices].sort((a, b) => {
      const aVal = a[state.sortColumn] ?? 0;
      const bVal = b[state.sortColumn] ?? 0;

      if (state.sortColumn === 'key') {
        return state.sortDirection === 'asc'
          ? String(aVal).localeCompare(String(bVal))
          : String(bVal).localeCompare(String(aVal));
      }

      return state.sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
    });

    if (sorted.length === 0) {
      elements.setsBody.innerHTML = `
        <tr>
          <td colspan="7" class="price-index__sets-td">No set data available</td>
        </tr>
      `;
      return;
    }

    const html = sorted.map((set) => {
      const change7d = set.change7d || 0;
      const trendWidth = Math.min(Math.abs(change7d) * 5, 100);
      const trendClass = change7d >= 0 ? 'positive' : 'negative';

      return `
        <tr>
          <td class="price-index__sets-td">${set.key}</td>
          <td class="price-index__sets-td price-index__sets-td--right">${formatNumber(set.cardCount)}</td>
          <td class="price-index__sets-td price-index__sets-td--right">${formatCurrency(set.avgPrice)}</td>
          <td class="price-index__sets-td price-index__sets-td--right">
            <span class="price-index__mover-change--${getChangeClass(set.change24h)}">
              ${formatPercent(set.change24h)}
            </span>
          </td>
          <td class="price-index__sets-td price-index__sets-td--right">
            <span class="price-index__mover-change--${getChangeClass(change7d)}">
              ${formatPercent(change7d)}
            </span>
          </td>
          <td class="price-index__sets-td price-index__sets-td--right">${formatCurrency(set.totalMarketCap)}</td>
          <td class="price-index__sets-td price-index__sets-td--right">
            <div class="price-index__trend">
              <div class="price-index__trend-bar">
                <div class="price-index__trend-fill price-index__trend-fill--${trendClass}"
                     style="width: ${trendWidth}%"></div>
              </div>
            </div>
          </td>
        </tr>
      `;
    }).join('');

    elements.setsBody.innerHTML = html;
  }

  // ============================================================================
  // Filters
  // ============================================================================

  function populateFilters() {
    if (!elements.setFilter || !state.setIndices) return;

    const sets = state.setIndices.map((s) => s.key).sort();
    const options = ['<option value="">All Sets</option>'];
    sets.forEach((set) => {
      options.push(`<option value="${set}">${set}</option>`);
    });

    elements.setFilter.innerHTML = options.join('');
  }

  // ============================================================================
  // Event Handlers
  // ============================================================================

  function setupEventListeners() {
    // Refresh button
    elements.refreshBtn?.addEventListener('click', loadAllData);

    // View toggle
    elements.viewToggle?.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-view]');
      if (!btn) return;

      const view = btn.dataset.view;
      if (view === state.currentView) return;

      // Update buttons
      elements.viewToggle.querySelectorAll('[data-view]').forEach((b) => {
        b.classList.toggle('price-index__view-btn--active', b.dataset.view === view);
      });

      // Update views
      state.currentView = view;
      elements.crystalView.hidden = view !== 'crystal';
      elements.chartView.hidden = view !== 'chart';
      elements.tableView.hidden = view !== 'table';

      // Load data if needed
      if (view === 'chart') {
        loadChartData();
      } else if (view === 'crystal' && state.crystalData) {
        renderCrystal();
      }
    });

    // Chart index select
    elements.chartSelect?.addEventListener('change', (e) => {
      state.chartIndex = e.target.value;
      loadChartData();
    });

    // Chart range buttons
    elements.chartRange?.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-range]');
      if (!btn) return;

      const range = parseInt(btn.dataset.range, 10);
      if (range === state.chartRange) return;

      elements.chartRange.querySelectorAll('[data-range]').forEach((b) => {
        b.classList.toggle('price-index__range-btn--active', b.dataset.range === btn.dataset.range);
      });

      state.chartRange = range;
      loadChartData();
    });

    // Game filter
    elements.gameFilter?.addEventListener('change', (e) => {
      state.currentGame = e.target.value;
      loadCrystalData();
    });

    // Movers tabs
    document.querySelectorAll('[data-movers-tab]').forEach((tab) => {
      tab.addEventListener('click', () => {
        const tabName = tab.dataset.moversTab;
        if (tabName === state.moversTab) return;

        document.querySelectorAll('[data-movers-tab]').forEach((t) => {
          t.classList.toggle('price-index__movers-tab--active', t.dataset.moversTab === tabName);
        });

        state.moversTab = tabName;
        elements.moversGainers.hidden = tabName !== 'gainers';
        elements.moversLosers.hidden = tabName !== 'losers';
      });
    });

    // Table sorting
    document.querySelectorAll('.price-index__sets-th--sortable').forEach((th) => {
      th.addEventListener('click', () => {
        const column = th.dataset.sort;
        if (column === state.sortColumn) {
          state.sortDirection = state.sortDirection === 'asc' ? 'desc' : 'asc';
        } else {
          state.sortColumn = column;
          state.sortDirection = 'desc';
        }
        renderSetsTable();
      });
    });

    // Window resize for crystal
    let resizeTimeout;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => {
        if (state.currentView === 'crystal' && state.crystalData) {
          renderCrystal();
        }
      }, 250);
    });
  }

  // ============================================================================
  // Utilities
  // ============================================================================

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // ============================================================================
  // Initialization
  // ============================================================================

  function init() {
    setupEventListeners();
    loadAllData();

    // Set up periodic refresh
    setInterval(loadAllData, REFRESH_INTERVAL);
  }

  // Start when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
