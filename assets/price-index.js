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
    networkData: null,
    chart: null,
    moversTab: 'gainers',
    sortColumn: 'totalMarketCap',
    sortDirection: 'desc',
    currency: 'GBP', // 'GBP' or 'JPY'
    exchangeRate: null,
    exchangeRateChange: null,
    marketHealth: null,
    moversData: null,
    tcg100: null, // NASDAQ-style TCG-100 index data
    tcg100SortColumn: 'rank',
    tcg100SortDirection: 'asc',
    tcg100Language: 'ALL', // 'ALL', 'EN', 'JP'
    languageComparison: null, // EN vs JP comparison data
  };

  // ============================================================================
  // DOM Elements
  // ============================================================================

  const elements = {
    // Header
    lastUpdated: document.querySelector('[data-last-updated]'),
    refreshBtn: document.querySelector('[data-refresh-btn]'),

    // Currency Toggle
    currencyToggle: document.querySelector('[data-currency-toggle]'),
    fxRateDisplay: document.querySelector('[data-fx-rate]'),

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

  function formatCurrency(value, currency = state.currency) {
    if (typeof value !== 'number' || isNaN(value)) return currency === 'JPY' ? '¥--' : '£--';

    if (currency === 'JPY') {
      return new Intl.NumberFormat('ja-JP', {
        style: 'currency',
        currency: 'JPY',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(value);
    }

    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  }

  function formatCurrencyGBP(value) {
    return formatCurrency(value, 'GBP');
  }

  function formatCurrencyJPY(value) {
    return formatCurrency(value, 'JPY');
  }

  function getPrice(item, field = 'price') {
    if (state.currency === 'JPY') {
      return item[`${field}Jpy`] ?? item[field] ?? 0;
    }
    return item[`${field}Gbp`] ?? item[field] ?? 0;
  }

  function getChange(item, field = 'change') {
    if (state.currency === 'JPY') {
      return item[`${field}Jpy`] ?? item[field] ?? 0;
    }
    return item[`${field}Gbp`] ?? item[field] ?? 0;
  }

  /**
   * Generate SVG sparkline from data array
   */
  function generateSparkline(data, width = 60, height = 24) {
    if (!data || data.length < 2) return '';

    const values = data.slice(-7); // Last 7 data points
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;

    const points = values.map((v, i) => {
      const x = (i / (values.length - 1)) * width;
      const y = height - ((v - min) / range) * (height - 4) - 2;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(' ');

    const trend = values[values.length - 1] > values[0] ? 'up' :
                  values[values.length - 1] < values[0] ? 'down' : 'neutral';

    return `<div class="price-index__summary-sparkline price-index__summary-sparkline--${trend}">
      <svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="none">
        <polyline points="${points}" />
      </svg>
    </div>`;
  }

  /**
   * Get volatility class from label
   */
  function getVolatilityClass(label) {
    switch (label) {
      case 'Stable': return 'stable';
      case 'Moderate': return 'moderate';
      case 'Volatile': return 'volatile';
      case 'Highly Volatile': return 'extreme';
      default: return 'moderate';
    }
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

    const languageParam = state.tcg100Language !== 'ALL' ? `&language=${state.tcg100Language}` : '';

    const [indexData, moversData, healthData, tcg100Data, comparisonData] = await Promise.all([
      fetchAPI('/price-index'),
      fetchAPI('/price-index/movers?limit=10'),
      fetchAPI(`/price-index/health?game=${state.currentGame}`),
      fetchAPI(`/price-index/tcg100?game=${state.currentGame}&includeConstituents=true${languageParam}`),
      fetchAPI(`/price-index/tcg100/compare?game=${state.currentGame}`),
    ]);

    if (indexData) {
      state.indices = indexData.indices;
      state.setIndices = indexData.setIndices || [];
      renderSummary();
      renderSetsTable();
      populateFilters();
    }

    if (moversData) {
      state.moversData = moversData;
      renderMoversEnhanced(moversData.gainers, moversData.losers, moversData.mostVolume);
    }

    if (healthData) {
      state.marketHealth = healthData;
      renderMarketHealth(healthData);
    }

    if (comparisonData) {
      state.languageComparison = comparisonData;
      renderLanguageComparison(comparisonData);
    }

    if (tcg100Data) {
      state.tcg100 = tcg100Data;
      renderTCG100Summary(tcg100Data);
      renderTCG100Constituents(tcg100Data);
    }

    updateTimestamp();
    hideLoading();

    // Load crystal and network data for current game
    loadCrystalData();
    loadNetworkData();
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

  async function loadNetworkData() {
    const data = await fetchAPI(`/price-index/network?game=${state.currentGame}&minCorrelation=0.3&limit=150`);
    if (data) {
      state.networkData = data;
      // Update exchange rate from network data
      if (data.marketForces?.exchangeRate) {
        state.exchangeRate = data.marketForces.exchangeRate.current;
        state.exchangeRateChange = data.marketForces.exchangeRate.change24h;
        updateFxRateDisplay();
      }
      if (state.currentView === 'crystal') {
        renderCrystal();
      }
    }
  }

  function updateFxRateDisplay() {
    if (!elements.fxRateDisplay) return;

    const rate = state.exchangeRate;
    const change = state.exchangeRateChange;

    if (!rate) {
      elements.fxRateDisplay.innerHTML = `
        <span>FX:</span>
        <span class="price-index__fx-rate-value">--</span>
      `;
      return;
    }

    const changeClass = change > 0 ? 'up' : change < 0 ? 'down' : '';
    const changeSign = change > 0 ? '+' : '';
    const changeDisplay = change ? `
      <span class="price-index__fx-rate-change price-index__fx-rate-change--${changeClass}">
        ${changeSign}${change.toFixed(2)}%
      </span>
    ` : '';

    elements.fxRateDisplay.innerHTML = `
      <span>¥/£:</span>
      <span class="price-index__fx-rate-value">${(1 / rate).toFixed(1)}</span>
      ${changeDisplay}
    `;
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

      // Get change based on selected currency
      const change = state.currency === 'JPY'
        ? (node.changeJpy ?? node.change ?? 0)
        : (node.changeGbp ?? node.change ?? 0);

      // Get price for size calculation (use GBP for consistency)
      const price = node.priceGbp ?? node.price ?? 1;
      const size = Math.max(4, Math.min(12, Math.sqrt(price) * 2));

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

        // Get prices for both currencies
        const priceGbp = nearest.priceGbp ?? nearest.price ?? 0;
        const priceJpy = nearest.priceJpy ?? null;
        const changeGbp = nearest.changeGbp ?? nearest.change ?? 0;
        const changeJpy = nearest.changeJpy ?? null;

        // Show price based on selected currency
        const displayPrice = state.currency === 'JPY' && priceJpy !== null ? priceJpy : priceGbp;
        const displayChange = state.currency === 'JPY' && changeJpy !== null ? changeJpy : changeGbp;

        tooltip.querySelector('[data-tooltip-name]').textContent = nearest.name;
        tooltip.querySelector('[data-tooltip-set]').textContent = nearest.setCode || '';
        tooltip.querySelector('[data-tooltip-price]').textContent = formatCurrency(displayPrice);

        // Show secondary price in other currency if available
        const secondaryEl = tooltip.querySelector('[data-tooltip-secondary]');
        if (secondaryEl) {
          if (state.currency === 'JPY' && priceJpy !== null) {
            secondaryEl.textContent = formatCurrencyGBP(priceGbp);
            secondaryEl.hidden = false;
          } else if (state.currency === 'GBP' && priceJpy !== null) {
            secondaryEl.textContent = formatCurrencyJPY(priceJpy);
            secondaryEl.hidden = false;
          } else {
            secondaryEl.hidden = true;
          }
        }

        const changeEl = tooltip.querySelector('[data-tooltip-change]');
        changeEl.textContent = formatPercent(displayChange);
        changeEl.className = `price-index__tooltip-change price-index__mover-change--${getChangeClass(displayChange)}`;
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
  // Movers (Enhanced MTGGoldfish-inspired)
  // ============================================================================

  function renderMoversEnhanced(gainers, losers, mostVolume) {
    renderEnhancedMoversList(elements.moversGainers, gainers, 'gainer');
    renderEnhancedMoversList(elements.moversLosers, losers, 'loser');

    // Render most volume if container exists
    const volumeContainer = document.querySelector('[data-movers-volume]');
    if (volumeContainer) {
      renderEnhancedMoversList(volumeContainer, mostVolume, 'volume');
    }
  }

  function renderEnhancedMoversList(container, movers, type) {
    if (!container) return;

    if (!movers || movers.length === 0) {
      container.innerHTML = `
        <div class="price-index__movers-empty">
          No ${type === 'gainer' ? 'gainers' : type === 'loser' ? 'losers' : 'volume data'} today
        </div>
      `;
      return;
    }

    const html = movers.map((mover) => {
      const isGainer = type === 'gainer' || (type === 'volume' && mover.changePercent > 0);
      const typeClass = type === 'volume' ? (mover.changePercent > 0 ? 'gainer' : 'loser') : type;

      // Get prices based on currency
      const currentPrice = state.currency === 'JPY' && mover.priceJpy
        ? mover.priceJpy
        : mover.price;
      const previousPrice = state.currency === 'JPY' && mover.previousPriceJpy
        ? mover.previousPriceJpy
        : mover.previousPrice;
      const changeAmount = currentPrice - previousPrice;
      const changePercent = state.currency === 'JPY' && mover.changeJpy !== null
        ? mover.changeJpy
        : mover.changePercent;

      return `
        <div class="price-index__mover-item--enhanced price-index__mover-item--${typeClass}">
          <div class="price-index__mover-rank-badge">${mover.rank}</div>
          <div class="price-index__mover-details">
            <div class="price-index__mover-name-row">
              <span class="price-index__mover-name">${escapeHtml(mover.name)}</span>
              ${mover.setCode ? `<span class="price-index__mover-set-badge">${mover.setCode}</span>` : ''}
            </div>
            <div class="price-index__mover-prices">
              <span class="price-index__mover-previous">${formatCurrency(previousPrice)}</span>
              <span class="price-index__mover-arrow">→</span>
              <span class="price-index__mover-current">${formatCurrency(currentPrice)}</span>
            </div>
            ${mover.volumeRelative > 0 ? `
              <div class="price-index__mover-volume-bar">
                <div class="price-index__mover-volume-fill" style="width: ${mover.volumeRelative * 100}%"></div>
              </div>
            ` : ''}
          </div>
          <div class="price-index__mover-stats">
            <span class="price-index__mover-change-amount price-index__mover-change--${isGainer ? 'up' : 'down'}">
              ${isGainer ? '+' : ''}${formatCurrency(changeAmount)}
            </span>
            <span class="price-index__mover-change-percent price-index__mover-change--${isGainer ? 'up' : 'down'}">
              ${formatPercent(changePercent)}
            </span>
          </div>
        </div>
      `;
    }).join('');

    container.innerHTML = html;
  }

  // Keep original function for backwards compatibility
  function renderMovers(gainers, losers) {
    renderMoversEnhanced(gainers, losers, []);
  }

  // ============================================================================
  // Market Health
  // ============================================================================

  function renderMarketHealth(health) {
    const container = document.querySelector('[data-market-health]');
    if (!container) return;

    const sentimentIcon = health.sentiment === 'bullish' ? '▲' :
                          health.sentiment === 'bearish' ? '▼' : '●';
    const sentimentLabel = health.sentiment.charAt(0).toUpperCase() + health.sentiment.slice(1);

    const sparklineHtml = health.sparkline && health.sparkline.length > 1
      ? generateSparkline(health.sparkline, 100, 32)
          .replace('price-index__summary-sparkline', 'price-index__health-sparkline')
      : '';

    container.innerHTML = `
      <div class="price-index__health-header">
        <h3 class="price-index__health-title">Market Health</h3>
        <span class="price-index__health-sentiment price-index__health-sentiment--${health.sentiment}">
          ${sentimentIcon} ${sentimentLabel}
        </span>
      </div>
      <div class="price-index__health-stats">
        <div class="price-index__health-stat">
          <div class="price-index__health-stat-value price-index__health-stat-value--up">${health.gainersCount}</div>
          <div class="price-index__health-stat-label">Gainers</div>
        </div>
        <div class="price-index__health-stat">
          <div class="price-index__health-stat-value price-index__health-stat-value--down">${health.losersCount}</div>
          <div class="price-index__health-stat-label">Losers</div>
        </div>
        <div class="price-index__health-stat">
          <div class="price-index__health-stat-value">${health.unchangedCount}</div>
          <div class="price-index__health-stat-label">Unchanged</div>
        </div>
      </div>
      ${sparklineHtml ? `<div class="price-index__health-sparkline">${sparklineHtml}</div>` : ''}
      ${health.hotSets && health.hotSets.length > 0 ? `
        <div class="price-index__hot-sets">
          <div class="price-index__hot-sets-title">Hot Sets</div>
          ${health.hotSets.slice(0, 3).map(set => `
            <div class="price-index__hot-set">
              <span class="price-index__hot-set-code">${set.setCode}</span>
              <span class="price-index__hot-set-change price-index__hot-set-change--${set.change > 0 ? 'up' : 'down'}">
                ${formatPercent(set.change)}
              </span>
            </div>
          `).join('')}
        </div>
      ` : ''}
    `;
  }

  // ============================================================================
  // Language Comparison (EN vs JP)
  // ============================================================================

  function renderLanguageComparison(data) {
    const container = document.querySelector('[data-language-comparison]');
    if (!container) return;

    const { en, jp, comparison } = data;

    if (!en || !jp) {
      container.innerHTML = `
        <div class="language-comparison__empty">
          Insufficient data for language comparison
        </div>
      `;
      return;
    }

    const leaderIcon = comparison.leader === 'EN' ? '🇬🇧' : comparison.leader === 'JP' ? '🇯🇵' : '⚖️';
    const momentumIcon = comparison.momentum === 'EN' ? '🇬🇧' : comparison.momentum === 'JP' ? '🇯🇵' : '⚖️';

    container.innerHTML = `
      <div class="language-comparison">
        <div class="language-comparison__header">
          <h3 class="language-comparison__title">EN vs JP Market Comparison</h3>
          <div class="language-comparison__badges">
            <span class="language-comparison__badge language-comparison__badge--${comparison.leader.toLowerCase()}">
              Leader: ${leaderIcon} ${comparison.leader}
            </span>
            <span class="language-comparison__badge language-comparison__badge--momentum-${comparison.momentum.toLowerCase()}">
              Momentum: ${momentumIcon} ${comparison.momentum}
            </span>
          </div>
        </div>

        <div class="language-comparison__indices">
          <div class="language-comparison__index language-comparison__index--en">
            <div class="language-comparison__flag">🇬🇧</div>
            <div class="language-comparison__index-label">English TCG-100</div>
            <div class="language-comparison__index-value">${formatCurrency(en.value)}</div>
            <div class="language-comparison__index-change language-comparison__index-change--${getChangeClass(en.change24h)}">
              ${formatPercent(en.change24h)}
            </div>
            <div class="language-comparison__index-stats">
              <span>${en.constituentCount} cards</span>
              <span>${formatCurrency(en.totalMarketCap)} cap</span>
            </div>
          </div>

          <div class="language-comparison__vs">
            <div class="language-comparison__vs-diff">
              <span class="language-comparison__vs-label">Diff</span>
              <span class="language-comparison__vs-value language-comparison__vs-value--${comparison.indexDiff > 0 ? 'en' : 'jp'}">
                ${comparison.indexDiff > 0 ? '+' : ''}${formatPercent(comparison.indexDiffPercent)}
              </span>
            </div>
            <div class="language-comparison__vs-correlation">
              <span class="language-comparison__vs-label">7d Correlation</span>
              <span class="language-comparison__vs-value">
                ${comparison.correlation7d !== null ? comparison.correlation7d.toFixed(2) : '--'}
              </span>
            </div>
          </div>

          <div class="language-comparison__index language-comparison__index--jp">
            <div class="language-comparison__flag">🇯🇵</div>
            <div class="language-comparison__index-label">Japanese TCG-100</div>
            <div class="language-comparison__index-value">${formatCurrency(jp.value)}</div>
            <div class="language-comparison__index-change language-comparison__index-change--${getChangeClass(jp.change24h)}">
              ${formatPercent(jp.change24h)}
            </div>
            <div class="language-comparison__index-stats">
              <span>${jp.constituentCount} cards</span>
              <span>${formatCurrency(jp.totalMarketCap)} cap</span>
            </div>
          </div>
        </div>

        <div class="language-comparison__metrics">
          <div class="language-comparison__metric">
            <span class="language-comparison__metric-label">Price Ratio (EN:JP)</span>
            <span class="language-comparison__metric-value">${comparison.avgPriceRatio.toFixed(2)}x</span>
          </div>
          <div class="language-comparison__metric">
            <span class="language-comparison__metric-label">Market Cap Ratio</span>
            <span class="language-comparison__metric-value">${comparison.marketCapRatio.toFixed(2)}x</span>
          </div>
          <div class="language-comparison__metric">
            <span class="language-comparison__metric-label">Volatility Diff</span>
            <span class="language-comparison__metric-value">${comparison.volatilityDiff > 0 ? '+' : ''}${comparison.volatilityDiff.toFixed(2)}%</span>
          </div>
          <div class="language-comparison__metric">
            <span class="language-comparison__metric-label">24h Change Diff</span>
            <span class="language-comparison__metric-value">${comparison.change24hDiff > 0 ? '+' : ''}${comparison.change24hDiff.toFixed(2)}%</span>
          </div>
        </div>
      </div>
    `;
  }

  // ============================================================================
  // TCG-100 Index (NASDAQ-Style)
  // ============================================================================

  function renderTCG100Summary(data) {
    const container = document.querySelector('[data-tcg100-summary]');
    if (!container) return;

    const { index, market, weights, schedule, language } = data;

    const changeClass = getChangeClass(index.change24h);
    const change7dClass = getChangeClass(index.change7d);

    // Format next reconstitution date
    const nextRecon = schedule.nextReconstitution
      ? new Date(schedule.nextReconstitution).toLocaleDateString('en-GB', {
          day: 'numeric',
          month: 'short',
        })
      : '--';

    // Language indicator
    const languageLabel = language === 'EN' ? 'English TCG-100'
      : language === 'JP' ? 'Japanese TCG-100'
      : 'TCG-100 Index';
    const languageFlag = language === 'EN' ? '🇬🇧 '
      : language === 'JP' ? '🇯🇵 '
      : '';

    container.innerHTML = `
      <div class="tcg100-summary">
        <div class="tcg100-summary__main">
          <div class="tcg100-summary__value-container">
            <div class="tcg100-summary__label">${languageFlag}${languageLabel}</div>
            <div class="tcg100-summary__value">${formatCurrency(index.value)}</div>
            <div class="tcg100-summary__change tcg100-summary__change--${changeClass}">
              ${index.change24h > 0 ? '▲' : index.change24h < 0 ? '▼' : '●'}
              ${formatPercent(index.change24h)} (24h)
            </div>
            <div class="tcg100-summary__secondary">
              <span class="tcg100-summary__change--${change7dClass}">
                ${formatPercent(index.change7d)} (7d)
              </span>
            </div>
          </div>
          <div class="tcg100-summary__chart">
            ${generateSparkline([index.previousValue, index.value], 80, 40)}
          </div>
        </div>

        <div class="tcg100-summary__stats">
          <div class="tcg100-summary__stat">
            <div class="tcg100-summary__stat-label">Market Cap</div>
            <div class="tcg100-summary__stat-value">${formatCurrency(market.totalMarketCap)}</div>
          </div>
          <div class="tcg100-summary__stat">
            <div class="tcg100-summary__stat-label">Avg Price</div>
            <div class="tcg100-summary__stat-value">${formatCurrency(market.avgPrice)}</div>
          </div>
          <div class="tcg100-summary__stat">
            <div class="tcg100-summary__stat-label">Top 5 Weight</div>
            <div class="tcg100-summary__stat-value">${(weights.top5Weight * 100).toFixed(1)}%</div>
          </div>
          <div class="tcg100-summary__stat">
            <div class="tcg100-summary__stat-label">Constituents</div>
            <div class="tcg100-summary__stat-value">${market.constituentCount}</div>
          </div>
        </div>

        <div class="tcg100-summary__schedule">
          <div class="tcg100-summary__schedule-item">
            <span class="tcg100-summary__schedule-label">Next Rebalance:</span>
            <span>${nextRecon}</span>
          </div>
          <div class="tcg100-summary__schedule-item">
            <span class="tcg100-summary__schedule-label">Volatility:</span>
            <span>${weights.volatilityIndex.toFixed(2)}%</span>
          </div>
        </div>
      </div>
    `;
  }

  function renderTCG100Constituents(data) {
    const container = document.querySelector('[data-tcg100-table]');
    if (!container || !data.constituents?.data) return;

    const constituents = data.constituents.data;

    // Sort constituents
    const sorted = [...constituents].sort((a, b) => {
      const aVal = a[state.tcg100SortColumn] ?? 0;
      const bVal = b[state.tcg100SortColumn] ?? 0;

      if (state.tcg100SortColumn === 'name') {
        return state.tcg100SortDirection === 'asc'
          ? String(aVal).localeCompare(String(bVal))
          : String(bVal).localeCompare(String(aVal));
      }

      return state.tcg100SortDirection === 'asc' ? aVal - bVal : bVal - aVal;
    });

    // Calculate max weight for bar visualization
    const maxWeight = Math.max(...constituents.map((c) => c.cappedWeight));

    const rows = sorted.map((c) => {
      const rankChangeIcon = c.rankChange > 0 ? '↑' : c.rankChange < 0 ? '↓' : '';
      const rankChangeClass = c.rankChange > 0 ? 'up' : c.rankChange < 0 ? 'down' : '';
      const changeClass = getChangeClass(c.change24h);
      const weightPercent = (c.cappedWeight / maxWeight) * 100;
      const isCapped = c.rawWeight > c.cappedWeight;
      const bufferZoneClass = c.inBufferZone ? 'tcg100-table__row--buffer-zone' : '';

      return `
        <tr class="tcg100-table__row ${bufferZoneClass}">
          <td class="tcg100-table__cell tcg100-table__cell--rank">
            <span class="tcg100-table__rank">${c.rank}</span>
            ${c.rankChange !== 0 ? `
              <span class="tcg100-table__rank-change tcg100-table__rank-change--${rankChangeClass}">
                ${rankChangeIcon}${Math.abs(c.rankChange)}
              </span>
            ` : ''}
          </td>
          <td class="tcg100-table__cell tcg100-table__cell--card">
            <div class="tcg100-table__card-info">
              <span class="tcg100-table__card-name">${escapeHtml(c.name)}</span>
              ${c.setCode ? `<span class="tcg100-table__card-set">${c.setCode}</span>` : ''}
            </div>
          </td>
          <td class="tcg100-table__cell tcg100-table__cell--price">${formatCurrency(c.priceGbp)}</td>
          <td class="tcg100-table__cell tcg100-table__cell--change">
            <span class="tcg100-table__change tcg100-table__change--${changeClass}">
              ${formatPercent(c.change24h)}
            </span>
          </td>
          <td class="tcg100-table__cell tcg100-table__cell--weight">
            <div class="tcg100-table__weight-container">
              <div class="tcg100-table__weight-bar">
                <div class="tcg100-table__weight-fill ${isCapped ? 'tcg100-table__weight-fill--capped' : ''}"
                     style="width: ${weightPercent}%"></div>
              </div>
              <span class="tcg100-table__weight-value ${isCapped ? 'tcg100-table__weight-value--capped' : ''}">
                ${c.weightPercent.toFixed(2)}%
                ${isCapped ? '⚠' : ''}
              </span>
            </div>
          </td>
          <td class="tcg100-table__cell tcg100-table__cell--marketcap">${formatCurrency(c.marketCap)}</td>
        </tr>
      `;
    }).join('');

    container.innerHTML = `
      <table class="tcg100-table">
        <thead>
          <tr>
            <th class="tcg100-table__header tcg100-table__header--sortable" data-tcg100-sort="rank">Rank</th>
            <th class="tcg100-table__header tcg100-table__header--sortable" data-tcg100-sort="name">Card</th>
            <th class="tcg100-table__header tcg100-table__header--sortable tcg100-table__header--right" data-tcg100-sort="priceGbp">Price</th>
            <th class="tcg100-table__header tcg100-table__header--sortable tcg100-table__header--right" data-tcg100-sort="change24h">24h</th>
            <th class="tcg100-table__header tcg100-table__header--sortable tcg100-table__header--right" data-tcg100-sort="cappedWeight">Weight</th>
            <th class="tcg100-table__header tcg100-table__header--sortable tcg100-table__header--right" data-tcg100-sort="marketCap">Market Cap</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
      <div class="tcg100-table__legend">
        <div class="tcg100-table__legend-item">
          <span class="tcg100-table__legend-buffer"></span>
          <span>Buffer Zone (Ranks 76-100)</span>
        </div>
        <div class="tcg100-table__legend-item">
          <span class="tcg100-table__legend-capped"></span>
          <span>Weight Capped (NASDAQ-100 style)</span>
        </div>
      </div>
    `;

    // Set up sorting event listeners
    container.querySelectorAll('[data-tcg100-sort]').forEach((header) => {
      header.addEventListener('click', () => {
        const column = header.dataset.tcg100Sort;
        if (column === state.tcg100SortColumn) {
          state.tcg100SortDirection = state.tcg100SortDirection === 'asc' ? 'desc' : 'asc';
        } else {
          state.tcg100SortColumn = column;
          state.tcg100SortDirection = column === 'name' ? 'asc' : 'desc';
        }
        renderTCG100Constituents(data);
      });
    });
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

    // Currency toggle
    elements.currencyToggle?.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-currency]');
      if (!btn) return;

      const currency = btn.dataset.currency;
      if (currency === state.currency) return;

      // Update buttons
      elements.currencyToggle.querySelectorAll('[data-currency]').forEach((b) => {
        b.classList.toggle('price-index__currency-btn--active', b.dataset.currency === currency);
      });

      // Update state and re-render
      state.currency = currency;
      renderSummary();
      renderSetsTable();
      if (state.currentView === 'crystal') {
        renderCrystal();
      }
      if (state.moversTab) {
        // Re-fetch movers to update display
        fetchAPI('/price-index/movers?limit=10').then((moversData) => {
          if (moversData) {
            renderMovers(moversData.gainers, moversData.losers);
          }
        });
      }
    });

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

        // Handle volume tab
        const volumeContainer = document.querySelector('[data-movers-volume]');
        if (volumeContainer) {
          volumeContainer.hidden = tabName !== 'volume';
        }
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

    // TCG-100 language toggle
    const languageToggle = document.querySelector('[data-tcg100-language-toggle]');
    languageToggle?.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-language]');
      if (!btn) return;

      const language = btn.dataset.language;
      if (language === state.tcg100Language) return;

      // Update buttons
      languageToggle.querySelectorAll('[data-language]').forEach((b) => {
        b.classList.toggle('tcg100-language-btn--active', b.dataset.language === language);
      });

      // Update state
      state.tcg100Language = language;

      // Reload TCG-100 data with new language filter
      const languageParam = language !== 'ALL' ? `&language=${language}` : '';
      fetchAPI(`/price-index/tcg100?game=${state.currentGame}&includeConstituents=true${languageParam}`)
        .then((tcg100Data) => {
          if (tcg100Data) {
            state.tcg100 = tcg100Data;
            renderTCG100Summary(tcg100Data);
            renderTCG100Constituents(tcg100Data);
          }
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
