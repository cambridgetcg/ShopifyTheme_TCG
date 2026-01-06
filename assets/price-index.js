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
    currentRarity: '', // Rarity filter
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
    priceAlerts: [], // User's price alerts (stored in localStorage)
    triggeredAlerts: [], // Alerts that have been triggered
    selectedAlertCard: null, // Currently selected card for alert modal
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

    // Network View
    networkView: document.querySelector('[data-network-view]'),
    networkContainer: document.querySelector('[data-network-container]'),
    networkCanvas: document.querySelector('[data-network-canvas]'),
    networkTooltip: document.querySelector('[data-network-tooltip]'),
    networkNodes: document.querySelector('[data-network-nodes]'),
    networkEdges: document.querySelector('[data-network-edges]'),
    networkAvgCorrelation: document.querySelector('[data-network-avg-correlation]'),
    networkClusters: document.querySelector('[data-network-clusters]'),

    // Rarity Filter
    rarityFilter: document.querySelector('[data-rarity-filter]'),

    // Volatility Widget
    volatilityWidget: document.querySelector('[data-volatility-widget]'),
    volatilityFill: document.querySelector('[data-volatility-fill]'),
    volatilityValue: document.querySelector('[data-volatility-value]'),
    highVolCount: document.querySelector('[data-high-vol-count]'),
    avgMovement: document.querySelector('[data-avg-movement]'),

    // Price Alerts
    alertsSection: document.querySelector('[data-alerts-section]'),
    alertsList: document.querySelector('[data-alerts-list]'),
    alertsEmpty: document.querySelector('[data-alerts-empty]'),
    addAlertBtn: document.querySelector('[data-add-alert-btn]'),
    alertsTriggered: document.querySelector('[data-alerts-triggered]'),
    triggeredList: document.querySelector('[data-triggered-list]'),
    clearTriggeredBtn: document.querySelector('[data-clear-triggered]'),

    // Alert Modal
    alertModal: document.querySelector('[data-alert-modal]'),
    alertSearch: document.querySelector('[data-alert-search]'),
    alertSearchResults: document.querySelector('[data-alert-search-results]'),
    selectedCardInfo: document.querySelector('[data-selected-card-info]'),
    selectedCard: document.querySelector('[data-selected-card]'),
    alertType: document.querySelector('[data-alert-type]'),
    alertPrefix: document.querySelector('[data-alert-prefix]'),
    alertValue: document.querySelector('[data-alert-value]'),
    saveAlertBtn: document.querySelector('[data-save-alert]'),
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
    let url = `/price-index/crystal?game=${state.currentGame}&limit=150`;
    if (state.currentSet) {
      url += `&set=${encodeURIComponent(state.currentSet)}`;
    }
    if (state.currentRarity) {
      url += `&rarity=${encodeURIComponent(state.currentRarity)}`;
    }

    const data = await fetchAPI(url);
    if (data) {
      state.crystalData = data;
      if (state.currentView === 'crystal') {
        renderCrystal();
      }
      // Check price alerts against current data
      if (data.cards) {
        checkAlerts(data.cards);
      }
      // Update volatility widget
      if (data.statistics) {
        renderVolatilityWidget(data.statistics);
      }
    }
  }

  async function loadNetworkData() {
    const loading = elements.networkContainer?.querySelector('.price-index__network-loading');
    if (loading && state.currentView === 'network') loading.style.display = 'flex';

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
      if (state.currentView === 'network') {
        renderNetwork();
      }
    }

    if (loading) loading.style.display = 'none';
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

  /**
   * Render treemap heatmap visualization (familiar price tracker format)
   * Similar to finviz stock heatmap - rectangles sized by market cap, colored by change
   */
  function renderCrystal() {
    const container = elements.crystalContainer;
    if (!container || !state.crystalData) return;

    const nodes = state.crystalData.nodes || [];
    if (nodes.length === 0) return;

    // Hide loading
    const loading = container.querySelector('.price-index__crystal-loading');
    if (loading) loading.hidden = true;

    // Hide canvas, use DOM-based treemap instead
    if (elements.crystalCanvas) {
      elements.crystalCanvas.style.display = 'none';
    }

    // Get or create treemap container
    let treemapEl = container.querySelector('.treemap');
    if (!treemapEl) {
      treemapEl = document.createElement('div');
      treemapEl.className = 'treemap';
      container.appendChild(treemapEl);
    }

    // Group by set for hierarchical treemap
    const setGroups = new Map();
    let totalValue = 0;

    nodes.forEach((node) => {
      const set = node.setCode || 'Other';
      if (!setGroups.has(set)) {
        setGroups.set(set, { cards: [], totalValue: 0 });
      }
      const group = setGroups.get(set);
      const value = node.priceGbp ?? node.price ?? 1;
      group.cards.push({ ...node, value });
      group.totalValue += value;
      totalValue += value;
    });

    // Sort sets by total value
    const sortedSets = Array.from(setGroups.entries())
      .sort((a, b) => b[1].totalValue - a[1].totalValue);

    // Calculate treemap layout
    const rect = container.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;

    // Build treemap HTML
    let html = '';
    const setRects = squarify(
      sortedSets.map(([name, data]) => ({ name, value: data.totalValue, cards: data.cards })),
      { x: 0, y: 0, width, height }
    );

    setRects.forEach((setRect) => {
      // Calculate card positions within set
      const cardRects = squarify(
        setRect.data.cards.map((c) => ({ ...c, value: c.value })),
        { x: 0, y: 0, width: setRect.width, height: setRect.height }
      );

      html += `<div class="treemap__set" style="left:${setRect.x}px;top:${setRect.y}px;width:${setRect.width}px;height:${setRect.height}px;">`;
      html += `<div class="treemap__set-label">${escapeHtml(setRect.data.name)}</div>`;

      cardRects.forEach((cardRect) => {
        const card = cardRect.data;
        const change = state.currency === 'JPY'
          ? (card.changeJpy ?? card.change ?? 0)
          : (card.changeGbp ?? card.change ?? 0);
        const price = state.currency === 'JPY'
          ? (card.priceJpy ?? card.priceGbp ?? card.price ?? 0)
          : (card.priceGbp ?? card.price ?? 0);

        const colorClass = getHeatmapColorClass(change);
        const showLabel = cardRect.width > 50 && cardRect.height > 40;
        const showPrice = cardRect.width > 40 && cardRect.height > 30;

        html += `
          <div class="treemap__card treemap__card--${colorClass}"
               style="left:${cardRect.x}px;top:${cardRect.y}px;width:${cardRect.width}px;height:${cardRect.height}px;"
               data-card-id="${escapeHtml(card.id)}"
               data-card-name="${escapeHtml(card.name || card.id)}"
               data-card-set="${escapeHtml(card.setCode || '')}"
               data-card-price="${price}"
               data-card-change="${change}">
            ${showLabel ? `<div class="treemap__card-name">${escapeHtml(truncateName(card.name || card.id, cardRect.width))}</div>` : ''}
            ${showPrice ? `<div class="treemap__card-change">${formatPercent(change)}</div>` : ''}
          </div>
        `;
      });

      html += '</div>';
    });

    treemapEl.innerHTML = html;

    // Set up hover tooltips
    setupTreemapHover(treemapEl);
  }

  /**
   * Squarified treemap algorithm
   * Creates aesthetically pleasing rectangles with aspect ratios close to 1
   */
  function squarify(items, rect) {
    if (items.length === 0) return [];

    const totalValue = items.reduce((sum, item) => sum + item.value, 0);
    if (totalValue === 0) return items.map((item) => ({
      ...rect,
      width: rect.width / items.length,
      data: item,
    }));

    const results = [];
    let remaining = [...items].sort((a, b) => b.value - a.value);
    let currentRect = { ...rect };

    while (remaining.length > 0) {
      const isWide = currentRect.width >= currentRect.height;
      const side = isWide ? currentRect.height : currentRect.width;

      // Find best row
      let row = [remaining[0]];
      let rowValue = remaining[0].value;
      let remainingValue = totalValue - rowValue;

      for (let i = 1; i < remaining.length; i++) {
        const newRow = [...row, remaining[i]];
        const newRowValue = rowValue + remaining[i].value;

        if (worstRatio(row, side, totalValue) >= worstRatio(newRow, side, totalValue)) {
          row = newRow;
          rowValue = newRowValue;
        } else {
          break;
        }
      }

      // Layout row
      const rowSize = (rowValue / totalValue) * (isWide ? currentRect.width : currentRect.height);
      let offset = 0;

      row.forEach((item) => {
        const itemSize = (item.value / rowValue) * side;
        if (isWide) {
          results.push({
            x: currentRect.x,
            y: currentRect.y + offset,
            width: rowSize,
            height: itemSize,
            data: item,
          });
        } else {
          results.push({
            x: currentRect.x + offset,
            y: currentRect.y,
            width: itemSize,
            height: rowSize,
            data: item,
          });
        }
        offset += itemSize;
      });

      // Update remaining rect
      if (isWide) {
        currentRect.x += rowSize;
        currentRect.width -= rowSize;
      } else {
        currentRect.y += rowSize;
        currentRect.height -= rowSize;
      }

      remaining = remaining.slice(row.length);
    }

    return results;
  }

  function worstRatio(row, side, totalValue) {
    const rowValue = row.reduce((sum, item) => sum + item.value, 0);
    const rowSize = (rowValue / totalValue) * side;

    let worst = 0;
    row.forEach((item) => {
      const itemSize = (item.value / rowValue) * side;
      const ratio = Math.max(rowSize / itemSize, itemSize / rowSize);
      worst = Math.max(worst, ratio);
    });

    return worst;
  }

  function getHeatmapColorClass(change) {
    if (change >= 10) return 'gain-5';
    if (change >= 5) return 'gain-4';
    if (change >= 2) return 'gain-3';
    if (change >= 0.5) return 'gain-2';
    if (change > 0) return 'gain-1';
    if (change > -0.5) return 'neutral';
    if (change > -2) return 'loss-1';
    if (change > -5) return 'loss-2';
    if (change > -10) return 'loss-3';
    return 'loss-4';
  }

  function truncateName(name, width) {
    const maxChars = Math.floor(width / 7);
    if (name.length <= maxChars) return name;
    return name.substring(0, maxChars - 1) + '…';
  }

  function setupTreemapHover(container) {
    const tooltip = elements.crystalTooltip;
    if (!tooltip) return;

    container.addEventListener('mousemove', (e) => {
      const card = e.target.closest('.treemap__card');
      if (!card) {
        tooltip.hidden = true;
        return;
      }

      const rect = container.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      tooltip.hidden = false;
      tooltip.style.left = `${Math.min(x + 15, rect.width - 180)}px`;
      tooltip.style.top = `${Math.min(y - 10, rect.height - 100)}px`;

      const name = card.dataset.cardName;
      const set = card.dataset.cardSet;
      const price = parseFloat(card.dataset.cardPrice);
      const change = parseFloat(card.dataset.cardChange);

      const nameEl = tooltip.querySelector('[data-tooltip-name]');
      const setEl = tooltip.querySelector('[data-tooltip-set]');
      const priceEl = tooltip.querySelector('[data-tooltip-price]');
      const changeEl = tooltip.querySelector('[data-tooltip-change]');

      if (nameEl) nameEl.textContent = name;
      if (setEl) setEl.textContent = set;
      if (priceEl) priceEl.textContent = formatCurrency(price);
      if (changeEl) {
        changeEl.textContent = formatPercent(change);
        changeEl.className = `price-index__tooltip-change price-index__summary-change--${getChangeClass(change)}`;
      }
    });

    container.addEventListener('mouseleave', () => {
      tooltip.hidden = true;
    });

    // Click-through to card detail page
    container.addEventListener('click', (e) => {
      const card = e.target.closest('.treemap__card');
      if (!card) return;

      const cardId = card.dataset.cardId;
      if (cardId) {
        window.location.href = `/pages/card-detail?id=${encodeURIComponent(cardId)}`;
      }
    });
  }

  // Legacy crystal functions kept for backwards compatibility
  function calculateNodePositions(nodes, width, height) {
    const positions = new Map();
    const centerX = width / 2;
    const centerY = height / 2;
    const maxRadius = Math.min(width, height) * 0.4;

    const setGroups = new Map();
    nodes.forEach((node) => {
      const set = node.setCode || 'unknown';
      if (!setGroups.has(set)) setGroups.set(set, []);
      setGroups.get(set).push(node);
    });

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

  function setupCrystalHover(canvas, nodes, positions) {
    const tooltip = elements.crystalTooltip;
    if (!tooltip) return;

    canvas.addEventListener('mousemove', (e) => {
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      let nearest = null;
      let nearestDist = 20;

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
        <div class="price-index__mover-item--enhanced price-index__mover-item--${typeClass} price-index__mover-item--clickable"
             data-card-id="${escapeHtml(mover.cardId || '')}">
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

    // Set up click-through to card detail
    container.querySelectorAll('[data-card-id]').forEach((item) => {
      item.addEventListener('click', () => {
        const cardId = item.dataset.cardId;
        if (cardId) {
          window.location.href = `/pages/card-detail?id=${encodeURIComponent(cardId)}`;
        }
      });
    });
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
        <tr class="tcg100-table__row tcg100-table__row--clickable ${bufferZoneClass}" data-card-id="${escapeHtml(c.cardId)}">
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

    // Set up click-through to card detail
    container.querySelectorAll('[data-card-id]').forEach((row) => {
      row.addEventListener('click', (e) => {
        // Don't navigate if clicking on a sortable header
        if (e.target.closest('[data-tcg100-sort]')) return;
        const cardId = row.dataset.cardId;
        if (cardId) {
          window.location.href = `/pages/card-detail?id=${encodeURIComponent(cardId)}`;
        }
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
      if (elements.networkView) elements.networkView.hidden = view !== 'network';

      // Load data if needed
      if (view === 'chart') {
        loadChartData();
      } else if (view === 'crystal' && state.crystalData) {
        renderCrystal();
      } else if (view === 'network') {
        loadNetworkData();
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
        if (state.currentView === 'network' && state.networkData) {
          renderNetwork();
        }
      }, 250);
    });

    // Rarity filter
    elements.rarityFilter?.addEventListener('change', (e) => {
      state.currentRarity = e.target.value;
      loadCrystalData();
    });

    // Set filter (update to include rarity)
    elements.setFilter?.addEventListener('change', (e) => {
      state.currentSet = e.target.value;
      loadCrystalData();
    });

    // Price Alerts - Add alert button
    elements.addAlertBtn?.addEventListener('click', () => {
      openAlertModal();
    });

    // Price Alerts - Modal close handlers
    elements.alertModal?.querySelectorAll('[data-modal-close]').forEach((el) => {
      el.addEventListener('click', closeAlertModal);
    });

    // Price Alerts - Save alert
    elements.saveAlertBtn?.addEventListener('click', saveAlert);

    // Price Alerts - Clear triggered
    elements.clearTriggeredBtn?.addEventListener('click', clearTriggeredAlerts);

    // Price Alerts - Search input
    elements.alertSearch?.addEventListener('input', debounce(handleAlertSearch, 300));

    // Price Alerts - Alert type change (update prefix)
    elements.alertType?.addEventListener('change', (e) => {
      const prefix = elements.alertPrefix;
      if (prefix) {
        prefix.textContent = e.target.value === 'change' ? '%' : '£';
      }
    });

    // Load alerts from localStorage
    loadAlertsFromStorage();
  }

  // ============================================================================
  // Utilities
  // ============================================================================

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  function debounce(fn, delay) {
    let timeoutId;
    return function (...args) {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => fn.apply(this, args), delay);
    };
  }

  // ============================================================================
  // Network Visualization
  // ============================================================================

  function renderNetwork() {
    const canvas = elements.networkCanvas;
    const container = elements.networkContainer;
    if (!canvas || !container || !state.networkData) return;

    const ctx = canvas.getContext('2d');
    const rect = container.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height - 150; // Account for legend and stats

    canvas.width = width * window.devicePixelRatio;
    canvas.height = height * window.devicePixelRatio;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

    // Clear canvas
    ctx.fillStyle = '#0f1419';
    ctx.fillRect(0, 0, width, height);

    const { nodes, edges } = state.networkData;
    if (!nodes || !edges) return;

    // Position nodes using force-directed layout simulation
    const positions = calculateNetworkPositions(nodes, edges, width, height);

    // Draw edges
    ctx.globalAlpha = 0.3;
    edges.forEach((edge) => {
      const source = positions[edge.source];
      const target = positions[edge.target];
      if (!source || !target) return;

      const strength = Math.abs(edge.correlation || 0.5);
      ctx.beginPath();
      ctx.moveTo(source.x, source.y);
      ctx.lineTo(target.x, target.y);
      ctx.strokeStyle = strength > 0.7 ? '#4ade80' : '#94a3b8';
      ctx.lineWidth = strength * 2;
      ctx.stroke();
    });

    // Draw nodes
    ctx.globalAlpha = 1;
    nodes.forEach((node) => {
      const pos = positions[node.id];
      if (!pos) return;

      const radius = Math.max(8, Math.min(20, (node.marketCap || 100) / 500));
      const change = node.change24h || 0;

      // Node color based on 24h change
      if (change > 0) {
        ctx.fillStyle = '#4ade80';
      } else if (change < 0) {
        ctx.fillStyle = '#f87171';
      } else {
        ctx.fillStyle = '#3b82f6';
      }

      ctx.beginPath();
      ctx.arc(pos.x, pos.y, radius, 0, Math.PI * 2);
      ctx.fill();

      // Node border
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.lineWidth = 1;
      ctx.stroke();
    });

    // Update stats
    if (elements.networkNodes) elements.networkNodes.textContent = nodes.length;
    if (elements.networkEdges) elements.networkEdges.textContent = edges.length;
    if (elements.networkAvgCorrelation) {
      const avgCorr = edges.reduce((sum, e) => sum + (e.correlation || 0), 0) / (edges.length || 1);
      elements.networkAvgCorrelation.textContent = avgCorr.toFixed(2);
    }
    if (elements.networkClusters) {
      // Simple cluster estimation
      elements.networkClusters.textContent = Math.ceil(nodes.length / 10);
    }
  }

  function calculateNetworkPositions(nodes, edges, width, height) {
    const positions = {};
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.min(width, height) * 0.35;

    // Simple circular layout with some randomization
    nodes.forEach((node, i) => {
      const angle = (2 * Math.PI * i) / nodes.length;
      const r = radius * (0.7 + Math.random() * 0.3);
      positions[node.id] = {
        x: centerX + r * Math.cos(angle),
        y: centerY + r * Math.sin(angle),
      };
    });

    return positions;
  }

  // ============================================================================
  // Volatility Widget
  // ============================================================================

  function renderVolatilityWidget(data) {
    if (!elements.volatilityWidget) return;

    const volatility = data?.volatility || 0;
    const highVolCards = data?.highVolatilityCards || 0;
    const avgMovement = data?.averageMovement || 0;

    // Update gauge fill (0-100%)
    const fillPercent = Math.min(100, Math.max(0, volatility * 10));
    if (elements.volatilityFill) {
      elements.volatilityFill.style.width = `${fillPercent}%`;
    }

    // Update value
    if (elements.volatilityValue) {
      elements.volatilityValue.textContent = `${volatility.toFixed(1)}%`;
    }

    // Update breakdown
    if (elements.highVolCount) {
      elements.highVolCount.textContent = highVolCards;
    }
    if (elements.avgMovement) {
      elements.avgMovement.textContent = `${avgMovement > 0 ? '+' : ''}${avgMovement.toFixed(2)}%`;
    }
  }

  // ============================================================================
  // Price Alerts
  // ============================================================================

  const ALERTS_STORAGE_KEY = 'prism_price_alerts';
  const TRIGGERED_STORAGE_KEY = 'prism_triggered_alerts';

  function loadAlertsFromStorage() {
    try {
      const alertsJson = localStorage.getItem(ALERTS_STORAGE_KEY);
      const triggeredJson = localStorage.getItem(TRIGGERED_STORAGE_KEY);
      state.priceAlerts = alertsJson ? JSON.parse(alertsJson) : [];
      state.triggeredAlerts = triggeredJson ? JSON.parse(triggeredJson) : [];
      renderAlerts();
    } catch (err) {
      console.error('Failed to load alerts:', err);
      state.priceAlerts = [];
      state.triggeredAlerts = [];
    }
  }

  function saveAlertsToStorage() {
    try {
      localStorage.setItem(ALERTS_STORAGE_KEY, JSON.stringify(state.priceAlerts));
      localStorage.setItem(TRIGGERED_STORAGE_KEY, JSON.stringify(state.triggeredAlerts));
    } catch (err) {
      console.error('Failed to save alerts:', err);
    }
  }

  function renderAlerts() {
    if (!elements.alertsList) return;

    // Show/hide empty state
    if (elements.alertsEmpty) {
      elements.alertsEmpty.hidden = state.priceAlerts.length > 0;
    }

    // Render active alerts
    if (state.priceAlerts.length > 0) {
      const alertsHtml = state.priceAlerts.map((alert, index) => `
        <div class="price-index__alert-item">
          <div class="price-index__alert-info">
            <div class="price-index__alert-name">${escapeHtml(alert.cardName)}</div>
            <div class="price-index__alert-condition">
              ${alert.type === 'above' ? 'Above' : alert.type === 'below' ? 'Below' : 'Change'}
              ${alert.type === 'change' ? alert.value + '%' : '£' + alert.value.toFixed(2)}
            </div>
          </div>
          <button type="button" class="price-index__alert-delete" data-delete-alert="${index}">
            <svg viewBox="0 0 20 20" fill="currentColor" width="14" height="14">
              <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"/>
            </svg>
          </button>
        </div>
      `).join('');

      // Replace empty state with alerts
      const container = elements.alertsList;
      container.innerHTML = alertsHtml + (elements.alertsEmpty?.outerHTML || '');

      // Add delete handlers
      container.querySelectorAll('[data-delete-alert]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const index = parseInt(btn.dataset.deleteAlert, 10);
          deleteAlert(index);
        });
      });
    }

    // Render triggered alerts
    if (elements.alertsTriggered && elements.triggeredList) {
      elements.alertsTriggered.hidden = state.triggeredAlerts.length === 0;

      if (state.triggeredAlerts.length > 0) {
        elements.triggeredList.innerHTML = state.triggeredAlerts.map((alert) => `
          <div class="price-index__triggered-item">
            <span class="price-index__triggered-icon">🔔</span>
            <span>${escapeHtml(alert.cardName)}: ${alert.message}</span>
          </div>
        `).join('');
      }
    }
  }

  function openAlertModal() {
    if (!elements.alertModal) return;

    // Reset form
    state.selectedAlertCard = null;
    if (elements.alertSearch) elements.alertSearch.value = '';
    if (elements.alertSearchResults) elements.alertSearchResults.hidden = true;
    if (elements.selectedCardInfo) elements.selectedCardInfo.hidden = true;
    if (elements.alertValue) elements.alertValue.value = '';
    if (elements.alertType) elements.alertType.value = 'above';
    if (elements.alertPrefix) elements.alertPrefix.textContent = '£';

    elements.alertModal.hidden = false;
    document.body.style.overflow = 'hidden';
    elements.alertSearch?.focus();
  }

  function closeAlertModal() {
    if (!elements.alertModal) return;
    elements.alertModal.hidden = true;
    document.body.style.overflow = '';
  }

  async function handleAlertSearch(e) {
    const query = e.target.value.trim();
    if (query.length < 2) {
      if (elements.alertSearchResults) elements.alertSearchResults.hidden = true;
      return;
    }

    try {
      const results = await fetchAPI(`/price-index/crystal?game=${state.currentGame}&limit=100`);
      if (!results || !results.cards) return;

      // Filter cards by search query
      const filtered = results.cards
        .filter((card) => card.name.toLowerCase().includes(query.toLowerCase()))
        .slice(0, 5);

      if (filtered.length === 0) {
        if (elements.alertSearchResults) elements.alertSearchResults.hidden = true;
        return;
      }

      // Render search results
      if (elements.alertSearchResults) {
        elements.alertSearchResults.innerHTML = filtered.map((card) => `
          <div class="price-index__search-result" data-card-id="${escapeHtml(card.cardId)}">
            <div class="price-index__search-result-name">${escapeHtml(card.name)}</div>
            <div class="price-index__search-result-info">
              ${escapeHtml(card.setCode || '')} • ${formatCurrencyGBP(card.priceGbp || card.price || 0)}
            </div>
          </div>
        `).join('');

        elements.alertSearchResults.hidden = false;

        // Add click handlers
        elements.alertSearchResults.querySelectorAll('.price-index__search-result').forEach((el) => {
          el.addEventListener('click', () => {
            const cardId = el.dataset.cardId;
            const card = filtered.find((c) => c.cardId === cardId);
            if (card) {
              selectAlertCard(card);
            }
          });
        });
      }
    } catch (err) {
      console.error('Alert search failed:', err);
    }
  }

  function selectAlertCard(card) {
    state.selectedAlertCard = card;

    if (elements.alertSearchResults) elements.alertSearchResults.hidden = true;
    if (elements.alertSearch) elements.alertSearch.value = '';

    if (elements.selectedCardInfo && elements.selectedCard) {
      elements.selectedCard.innerHTML = `
        <div class="price-index__selected-card-info">
          <div class="price-index__selected-card-name">${escapeHtml(card.name)}</div>
          <div class="price-index__selected-card-price">
            Current: ${formatCurrencyGBP(card.priceGbp || card.price || 0)}
          </div>
        </div>
      `;
      elements.selectedCardInfo.hidden = false;
    }
  }

  function saveAlert() {
    if (!state.selectedAlertCard) {
      alert('Please select a card first');
      return;
    }

    const type = elements.alertType?.value || 'above';
    const value = parseFloat(elements.alertValue?.value || '0');

    if (isNaN(value) || value <= 0) {
      alert('Please enter a valid target value');
      return;
    }

    const newAlert = {
      id: Date.now().toString(),
      cardId: state.selectedAlertCard.cardId,
      cardName: state.selectedAlertCard.name,
      type,
      value,
      currentPrice: state.selectedAlertCard.priceGbp || state.selectedAlertCard.price || 0,
      createdAt: new Date().toISOString(),
    };

    state.priceAlerts.push(newAlert);
    saveAlertsToStorage();
    renderAlerts();
    closeAlertModal();
  }

  function deleteAlert(index) {
    state.priceAlerts.splice(index, 1);
    saveAlertsToStorage();
    renderAlerts();
  }

  function clearTriggeredAlerts() {
    state.triggeredAlerts = [];
    saveAlertsToStorage();
    renderAlerts();
  }

  function checkAlerts(cards) {
    if (!cards || state.priceAlerts.length === 0) return;

    const cardMap = new Map(cards.map((c) => [c.cardId, c]));

    state.priceAlerts.forEach((alert, index) => {
      const card = cardMap.get(alert.cardId);
      if (!card) return;

      const currentPrice = card.priceGbp || card.price || 0;
      let triggered = false;
      let message = '';

      switch (alert.type) {
        case 'above':
          if (currentPrice >= alert.value) {
            triggered = true;
            message = `Price is now ${formatCurrencyGBP(currentPrice)} (above ${formatCurrencyGBP(alert.value)})`;
          }
          break;
        case 'below':
          if (currentPrice <= alert.value) {
            triggered = true;
            message = `Price is now ${formatCurrencyGBP(currentPrice)} (below ${formatCurrencyGBP(alert.value)})`;
          }
          break;
        case 'change':
          const changePercent = ((currentPrice - alert.currentPrice) / alert.currentPrice) * 100;
          if (Math.abs(changePercent) >= alert.value) {
            triggered = true;
            message = `Price changed ${changePercent > 0 ? '+' : ''}${changePercent.toFixed(2)}%`;
          }
          break;
      }

      if (triggered) {
        state.triggeredAlerts.push({
          ...alert,
          message,
          triggeredAt: new Date().toISOString(),
        });
        state.priceAlerts.splice(index, 1);
      }
    });

    if (state.triggeredAlerts.length > 0) {
      saveAlertsToStorage();
      renderAlerts();
    }
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
