/**
 * Card Detail Page JavaScript
 * PRISM - Individual Card Price History & Details
 */

(function() {
  'use strict';

  // Configuration
  const CONFIG = {
    apiBase: '/apps/trade-in/price-index/card',
    imageBase: 'https://tcg-tradein.s3.eu-west-2.amazonaws.com/card-images',
    historyPageSize: 10,
    defaultDays: 30,
    chartColors: {
      line: '#00d4aa',
      fill: 'rgba(0, 212, 170, 0.1)',
      grid: 'rgba(255, 255, 255, 0.1)',
      text: '#a0aec0'
    }
  };

  // State
  let state = {
    cardId: null,
    cardData: null,
    chart: null,
    currentRange: 30,
    historyPage: 1,
    isLoading: true,
    currency: 'GBP' // 'GBP' or 'JPY'
  };

  // DOM Elements
  const dom = {};

  /**
   * Initialize the page
   */
  function init() {
    // Get card ID from URL
    const urlParams = new URLSearchParams(window.location.search);
    state.cardId = urlParams.get('id');

    if (!state.cardId) {
      showError('No card ID provided');
      return;
    }

    // Cache DOM elements
    cacheDOMElements();

    // Set up event listeners
    setupEventListeners();

    // Load card data
    loadCardData(state.currentRange);
  }

  /**
   * Cache frequently accessed DOM elements
   */
  function cacheDOMElements() {
    dom.container = document.querySelector('[data-card-detail]');
    dom.loading = document.querySelector('[data-loading]');
    dom.error = document.querySelector('[data-error]');
    dom.errorMessage = document.querySelector('[data-error-message]');
    dom.content = document.querySelector('[data-content]');

    // Currency toggle
    dom.currencyToggle = document.querySelector('[data-currency-toggle]');
    dom.fxValue = document.querySelector('[data-fx-value]');
    dom.fxChange = document.querySelector('[data-fx-change]');

    // Breadcrumb
    dom.breadcrumbSet = document.querySelector('[data-breadcrumb-set]');
    dom.breadcrumbCard = document.querySelector('[data-breadcrumb-card]');

    // Card info
    dom.cardImage = document.querySelector('[data-card-image]');
    dom.cardName = document.querySelector('[data-card-name]');
    dom.cardNumber = document.querySelector('[data-card-number]');
    dom.cardVariant = document.querySelector('[data-card-variant]');
    dom.cardRarity = document.querySelector('[data-card-rarity]');
    dom.cardLanguage = document.querySelector('[data-card-language]');
    dom.variantBadge = document.querySelector('[data-variant-badge]');

    // Prices
    dom.pricePrimary = document.querySelector('[data-price-primary]');
    dom.priceSecondary = document.querySelector('[data-price-secondary]');
    dom.tradeinValue = document.querySelector('[data-tradein-value]');
    dom.tradeinPercent = document.querySelector('[data-tradein-percent]');
    dom.tradeinBtn = document.querySelector('[data-tradein-btn]');

    // Change indicators
    dom.change24h = document.querySelector('[data-change-24h]');
    dom.change7d = document.querySelector('[data-change-7d]');
    dom.change30d = document.querySelector('[data-change-30d]');

    // Stats
    dom.statHigh = document.querySelector('[data-stat-high]');
    dom.statLow = document.querySelector('[data-stat-low]');
    dom.statAvg = document.querySelector('[data-stat-avg]');
    dom.statVolatility = document.querySelector('[data-stat-volatility]');
    dom.statDays = document.querySelector('[data-stat-days]');
    dom.statUpdated = document.querySelector('[data-stat-updated]');

    // Chart
    dom.chartCanvas = document.querySelector('[data-price-chart]');
    dom.rangeToggle = document.querySelector('[data-range-toggle]');
    dom.chartLegendLabel = document.querySelector('[data-chart-legend-label]');

    // History table
    dom.historyBody = document.querySelector('[data-history-body]');
    dom.priceHeader = document.querySelector('[data-price-header]');
    dom.pagination = document.querySelector('[data-pagination]');
    dom.pageInfo = document.querySelector('[data-page-info]');
    dom.pagePrev = document.querySelector('[data-page-prev]');
    dom.pageNext = document.querySelector('[data-page-next]');
    dom.exportCsv = document.querySelector('[data-export-csv]');

    // Related cards
    dom.relatedSection = document.querySelector('[data-related-section]');
    dom.relatedGrid = document.querySelector('[data-related-grid]');

    // Zoom modal
    dom.zoomTrigger = document.querySelector('[data-zoom-trigger]');
    dom.zoomModal = document.querySelector('[data-zoom-modal]');
    dom.modalImage = document.querySelector('[data-modal-image]');
    dom.modalClose = document.querySelectorAll('[data-modal-close]');
  }

  /**
   * Set up event listeners
   */
  function setupEventListeners() {
    // Currency toggle
    if (dom.currencyToggle) {
      dom.currencyToggle.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-currency]');
        if (!btn) return;

        const currency = btn.dataset.currency;
        if (currency === state.currency) return;

        setCurrency(currency);
      });
    }

    // Range toggle buttons
    if (dom.rangeToggle) {
      dom.rangeToggle.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-range]');
        if (btn) {
          const range = parseInt(btn.dataset.range, 10);
          setActiveRange(range);
          loadCardData(range);
        }
      });
    }

    // Pagination
    if (dom.pagePrev) {
      dom.pagePrev.addEventListener('click', () => {
        if (state.historyPage > 1) {
          state.historyPage--;
          renderHistoryTable();
        }
      });
    }

    if (dom.pageNext) {
      dom.pageNext.addEventListener('click', () => {
        const totalPages = Math.ceil(state.cardData.history.length / CONFIG.historyPageSize);
        if (state.historyPage < totalPages) {
          state.historyPage++;
          renderHistoryTable();
        }
      });
    }

    // Export CSV
    if (dom.exportCsv) {
      dom.exportCsv.addEventListener('click', exportToCSV);
    }

    // Image zoom
    if (dom.zoomTrigger) {
      dom.zoomTrigger.addEventListener('click', openZoomModal);
    }

    if (dom.modalClose) {
      dom.modalClose.forEach(el => {
        el.addEventListener('click', closeZoomModal);
      });
    }

    // Close modal on escape
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && dom.zoomModal && !dom.zoomModal.hidden) {
        closeZoomModal();
      }
    });
  }

  /**
   * Set currency and re-render
   */
  function setCurrency(currency) {
    state.currency = currency;

    // Update toggle buttons
    if (dom.currencyToggle) {
      dom.currencyToggle.querySelectorAll('[data-currency]').forEach(btn => {
        btn.classList.toggle('card-detail__currency-btn--active', btn.dataset.currency === currency);
      });
    }

    // Re-render price-dependent elements
    if (state.cardData) {
      renderPricing(state.cardData.pricing);
      renderStats(state.cardData.stats, state.cardData.pricing);
      renderChart(state.cardData.history);
      renderHistoryTable();
      renderRelatedCards(state.cardData.related);
      updateLabels();
    }
  }

  /**
   * Update labels based on currency
   */
  function updateLabels() {
    const currencyLabel = state.currency === 'JPY' ? 'JPY' : 'GBP';
    const currencySymbol = state.currency === 'JPY' ? '¥' : '£';

    if (dom.chartLegendLabel) {
      dom.chartLegendLabel.textContent = `Price (${currencyLabel})`;
    }

    if (dom.priceHeader) {
      dom.priceHeader.textContent = `Price (${currencyLabel})`;
    }
  }

  /**
   * Load card data from API
   */
  async function loadCardData(days = CONFIG.defaultDays) {
    state.isLoading = true;
    state.currentRange = days;
    showLoading();

    try {
      const url = `${CONFIG.apiBase}/${encodeURIComponent(state.cardId)}?days=${days}`;
      const response = await fetch(url);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Failed to load card data (${response.status})`);
      }

      const data = await response.json();
      state.cardData = data;
      state.historyPage = 1;

      renderCardData();
      showContent();
    } catch (error) {
      console.error('Failed to load card data:', error);
      showError(error.message || 'Failed to load card data');
    } finally {
      state.isLoading = false;
    }
  }

  /**
   * Render all card data
   */
  function renderCardData() {
    const { card, pricing, stats, history, related, exchangeRate } = state.cardData;

    // Breadcrumb
    if (dom.breadcrumbSet) {
      dom.breadcrumbSet.textContent = card.releaseSet || card.setCode || 'Unknown Set';
    }
    if (dom.breadcrumbCard) {
      dom.breadcrumbCard.textContent = card.fullCardNumber || card.cardId;
    }

    // Exchange rate display
    renderExchangeRate(exchangeRate);

    // Card info
    renderCardInfo(card);
    renderPricing(pricing);
    renderStats(stats, pricing);
    renderChart(history);
    renderHistoryTable();
    renderRelatedCards(related);
    updateLabels();
  }

  /**
   * Render exchange rate display
   */
  function renderExchangeRate(exchangeRate) {
    if (!exchangeRate) return;

    if (dom.fxValue && exchangeRate.current) {
      dom.fxValue.textContent = (1 / exchangeRate.current).toFixed(1);
    }

    if (dom.fxChange && exchangeRate.change24h !== null) {
      const change = exchangeRate.change24h;
      const sign = change > 0 ? '+' : '';
      dom.fxChange.textContent = `${sign}${change.toFixed(2)}%`;
      dom.fxChange.className = 'card-detail__fx-change';
      if (change > 0) {
        dom.fxChange.classList.add('card-detail__fx-change--up');
      } else if (change < 0) {
        dom.fxChange.classList.add('card-detail__fx-change--down');
      }
    }
  }

  /**
   * Render card information
   */
  function renderCardInfo(card) {
    // Image
    if (dom.cardImage && card.imageUrl) {
      const imageUrl = `${CONFIG.imageBase}/${card.imageUrl}`;
      dom.cardImage.src = imageUrl;
      dom.cardImage.alt = card.name;
      dom.cardImage.onerror = () => {
        dom.cardImage.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjI4MCIgdmlld0JveD0iMCAwIDIwMCAyODAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjIwMCIgaGVpZ2h0PSIyODAiIGZpbGw9IiMxYTFhMmUiLz48dGV4dCB4PSI1MCUiIHk9IjUwJSIgZG9taW5hbnQtYmFzZWxpbmU9Im1pZGRsZSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZmlsbD0iIzY2NiIgZm9udC1zaXplPSIxNCIgZm9udC1mYW1pbHk9InNhbnMtc2VyaWYiPk5vIEltYWdlPC90ZXh0Pjwvc3ZnPg==';
      };
    }

    // Name
    if (dom.cardName) {
      dom.cardName.textContent = card.name;
    }

    // Number
    if (dom.cardNumber) {
      dom.cardNumber.textContent = card.fullCardNumber || card.cardId;
    }

    // Variant
    if (dom.cardVariant) {
      dom.cardVariant.textContent = formatVariant(card.variantType);
    }

    // Variant badge
    if (dom.variantBadge && card.variantType) {
      dom.variantBadge.textContent = formatVariant(card.variantType);
      dom.variantBadge.hidden = false;
    }

    // Rarity
    if (dom.cardRarity) {
      dom.cardRarity.textContent = card.rarity || 'Unknown';
    }

    // Language
    if (dom.cardLanguage) {
      dom.cardLanguage.textContent = card.language || 'EN';
    }

    // Update modal image
    if (dom.modalImage && card.imageUrl) {
      dom.modalImage.src = `${CONFIG.imageBase}/${card.imageUrl}`;
      dom.modalImage.alt = card.name;
    }
  }

  /**
   * Render pricing information
   */
  function renderPricing(pricing) {
    const isJpy = state.currency === 'JPY';

    // Primary price (selected currency)
    const primaryPrice = isJpy ? pricing.currentJpy : pricing.currentGbp;
    const secondaryPrice = isJpy ? pricing.currentGbp : pricing.currentJpy;

    if (dom.pricePrimary) {
      dom.pricePrimary.textContent = primaryPrice !== null
        ? formatCurrency(primaryPrice, state.currency)
        : '--';
    }

    if (dom.priceSecondary) {
      if (secondaryPrice !== null) {
        const secondaryCurrency = isJpy ? 'GBP' : 'JPY';
        dom.priceSecondary.textContent = formatCurrency(secondaryPrice, secondaryCurrency);
      } else {
        dom.priceSecondary.textContent = '';
      }
    }

    // Trade-in price (always in GBP for trade-in purposes)
    if (dom.tradeinValue) {
      dom.tradeinValue.textContent = formatCurrency(pricing.tradeinGbp, 'GBP');
    }

    if (dom.tradeinPercent) {
      dom.tradeinPercent.textContent = `(${pricing.tradeinPercent}% of market)`;
    }

    // Change indicators
    renderChangeIndicator(dom.change24h, pricing.change24h, '24h');
    renderChangeIndicator(dom.change7d, pricing.change7d, '7d');
    renderChangeIndicator(dom.change30d, pricing.change30d, '30d');
  }

  /**
   * Render a change indicator
   */
  function renderChangeIndicator(element, change, label) {
    if (!element) return;

    const formattedChange = change >= 0
      ? `+${change.toFixed(2)}%`
      : `${change.toFixed(2)}%`;

    element.textContent = `${formattedChange} (${label})`;
    element.className = 'card-detail__change-value';

    if (change > 0) {
      element.classList.add('card-detail__change-value--positive');
    } else if (change < 0) {
      element.classList.add('card-detail__change-value--negative');
    } else {
      element.classList.add('card-detail__change-value--neutral');
    }
  }

  /**
   * Render statistics
   */
  function renderStats(stats, pricing) {
    const isJpy = state.currency === 'JPY';

    if (dom.statHigh) {
      const high = isJpy && stats.highJpy !== null ? stats.highJpy : stats.highGbp;
      dom.statHigh.textContent = formatCurrency(high, isJpy && stats.highJpy !== null ? 'JPY' : 'GBP');
    }

    if (dom.statLow) {
      const low = isJpy && stats.lowJpy !== null ? stats.lowJpy : stats.lowGbp;
      dom.statLow.textContent = formatCurrency(low, isJpy && stats.lowJpy !== null ? 'JPY' : 'GBP');
    }

    if (dom.statAvg) {
      const avg = isJpy && stats.avgJpy !== null ? stats.avgJpy : stats.avgGbp;
      dom.statAvg.textContent = formatCurrency(avg, isJpy && stats.avgJpy !== null ? 'JPY' : 'GBP');
    }

    if (dom.statVolatility) {
      dom.statVolatility.textContent = `${stats.volatility.toFixed(1)}%`;
    }

    if (dom.statDays) {
      dom.statDays.textContent = stats.daysTracked.toString();
    }

    if (dom.statUpdated && pricing.updatedAt) {
      const date = new Date(pricing.updatedAt);
      dom.statUpdated.textContent = date.toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
      });
    }
  }

  /**
   * Render price chart
   */
  function renderChart(history) {
    if (!dom.chartCanvas || !window.Chart) {
      console.warn('Chart.js not loaded');
      return;
    }

    // Destroy existing chart
    if (state.chart) {
      state.chart.destroy();
    }

    const ctx = dom.chartCanvas.getContext('2d');
    const isJpy = state.currency === 'JPY';

    // Prepare data
    const labels = history.map(h => {
      const date = new Date(h.date);
      return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
    });

    const prices = history.map(h => {
      if (isJpy && h.priceJpy !== null) {
        return h.priceJpy;
      }
      return h.priceGbp;
    });

    // Create gradient
    const gradient = ctx.createLinearGradient(0, 0, 0, 300);
    gradient.addColorStop(0, 'rgba(0, 212, 170, 0.3)');
    gradient.addColorStop(1, 'rgba(0, 212, 170, 0)');

    const currencySymbol = isJpy ? '¥' : '£';

    state.chart = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: `Price (${state.currency})`,
          data: prices,
          borderColor: CONFIG.chartColors.line,
          backgroundColor: gradient,
          borderWidth: 2,
          fill: true,
          tension: 0.3,
          pointRadius: 0,
          pointHoverRadius: 6,
          pointHoverBackgroundColor: CONFIG.chartColors.line,
          pointHoverBorderColor: '#fff',
          pointHoverBorderWidth: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          intersect: false,
          mode: 'index'
        },
        plugins: {
          legend: {
            display: false
          },
          tooltip: {
            backgroundColor: 'rgba(26, 26, 46, 0.95)',
            titleColor: '#fff',
            bodyColor: CONFIG.chartColors.text,
            borderColor: 'rgba(255, 255, 255, 0.1)',
            borderWidth: 1,
            padding: 12,
            displayColors: false,
            callbacks: {
              label: (context) => {
                if (isJpy) {
                  return `¥${Math.round(context.parsed.y).toLocaleString()}`;
                }
                return `£${context.parsed.y.toFixed(2)}`;
              }
            }
          }
        },
        scales: {
          x: {
            grid: {
              color: CONFIG.chartColors.grid,
              drawBorder: false
            },
            ticks: {
              color: CONFIG.chartColors.text,
              maxTicksLimit: 8
            }
          },
          y: {
            grid: {
              color: CONFIG.chartColors.grid,
              drawBorder: false
            },
            ticks: {
              color: CONFIG.chartColors.text,
              callback: (value) => {
                if (isJpy) {
                  return `¥${Math.round(value).toLocaleString()}`;
                }
                return `£${value.toFixed(0)}`;
              }
            }
          }
        }
      }
    });
  }

  /**
   * Render history table
   */
  function renderHistoryTable() {
    if (!dom.historyBody || !state.cardData) return;

    const { history } = state.cardData;
    const totalPages = Math.ceil(history.length / CONFIG.historyPageSize);
    const startIndex = (state.historyPage - 1) * CONFIG.historyPageSize;
    const endIndex = startIndex + CONFIG.historyPageSize;
    const pageData = history.slice().reverse().slice(startIndex, endIndex);
    const isJpy = state.currency === 'JPY';

    if (pageData.length === 0) {
      dom.historyBody.innerHTML = `
        <tr>
          <td colspan="3" class="card-detail__td card-detail__td--empty">No price history available</td>
        </tr>
      `;
      if (dom.pagination) dom.pagination.hidden = true;
      return;
    }

    dom.historyBody.innerHTML = pageData.map(item => {
      const date = new Date(item.date);
      const formattedDate = date.toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
      });

      const price = isJpy && item.priceJpy !== null ? item.priceJpy : item.priceGbp;
      const change = isJpy && item.changeJpy !== null ? item.changeJpy : item.change;

      const changeClass = change > 0
        ? 'card-detail__change--positive'
        : change < 0
          ? 'card-detail__change--negative'
          : '';

      const changeText = change >= 0
        ? `+${change.toFixed(2)}%`
        : `${change.toFixed(2)}%`;

      const priceText = isJpy
        ? `¥${Math.round(price).toLocaleString()}`
        : `£${price.toFixed(2)}`;

      return `
        <tr>
          <td class="card-detail__td">${formattedDate}</td>
          <td class="card-detail__td card-detail__td--right">${priceText}</td>
          <td class="card-detail__td card-detail__td--right ${changeClass}">${changeText}</td>
        </tr>
      `;
    }).join('');

    // Update pagination
    if (dom.pagination && totalPages > 1) {
      dom.pagination.hidden = false;
      if (dom.pageInfo) {
        dom.pageInfo.textContent = `Page ${state.historyPage} of ${totalPages}`;
      }
      if (dom.pagePrev) {
        dom.pagePrev.disabled = state.historyPage <= 1;
      }
      if (dom.pageNext) {
        dom.pageNext.disabled = state.historyPage >= totalPages;
      }
    } else if (dom.pagination) {
      dom.pagination.hidden = true;
    }
  }

  /**
   * Render related cards
   */
  function renderRelatedCards(related) {
    if (!dom.relatedSection || !dom.relatedGrid) return;

    if (!related || related.length === 0) {
      dom.relatedSection.hidden = true;
      return;
    }

    dom.relatedSection.hidden = false;
    dom.relatedGrid.innerHTML = related.map(card => {
      const imageUrl = card.imageUrl
        ? `${CONFIG.imageBase}/${card.imageUrl}`
        : 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjE0MCIgdmlld0JveD0iMCAwIDEwMCAxNDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjEwMCIgaGVpZ2h0PSIxNDAiIGZpbGw9IiMxYTFhMmUiLz48dGV4dCB4PSI1MCUiIHk9IjUwJSIgZG9taW5hbnQtYmFzZWxpbmU9Im1pZGRsZSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZmlsbD0iIzY2NiIgZm9udC1zaXplPSIxMCIgZm9udC1mYW1pbHk9InNhbnMtc2VyaWYiPk5vIEltYWdlPC90ZXh0Pjwvc3ZnPg==';

      const changeClass = card.change24h > 0
        ? 'card-detail__related-change--positive'
        : card.change24h < 0
          ? 'card-detail__related-change--negative'
          : '';

      const changeText = card.change24h >= 0
        ? `+${card.change24h.toFixed(1)}%`
        : `${card.change24h.toFixed(1)}%`;

      // Always show GBP for related cards (for consistency)
      const priceText = `£${card.priceGbp.toFixed(2)}`;

      return `
        <a href="/pages/card-detail?id=${encodeURIComponent(card.cardId)}" class="card-detail__related-card">
          <div class="card-detail__related-image-wrapper">
            <img class="card-detail__related-image" src="${imageUrl}" alt="${card.name}" loading="lazy" />
            ${card.variantType ? `<span class="card-detail__related-badge">${formatVariant(card.variantType)}</span>` : ''}
          </div>
          <div class="card-detail__related-info">
            <div class="card-detail__related-name">${card.name}</div>
            <div class="card-detail__related-price">${priceText}</div>
            <div class="card-detail__related-change ${changeClass}">${changeText}</div>
          </div>
        </a>
      `;
    }).join('');
  }

  /**
   * Export price history to CSV
   */
  function exportToCSV() {
    if (!state.cardData) return;

    const { card, history } = state.cardData;
    const filename = `${card.cardId}_price_history.csv`;

    const headers = ['Date', 'Price (GBP)', 'Price (JPY)', 'Change GBP (%)', 'Change JPY (%)'];
    const rows = history.map(h => [
      h.date,
      h.priceGbp.toFixed(2),
      h.priceJpy?.toFixed(0) || '',
      h.change.toFixed(2),
      h.changeJpy?.toFixed(2) || ''
    ]);

    const csv = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  /**
   * Set active range button
   */
  function setActiveRange(range) {
    if (!dom.rangeToggle) return;

    const buttons = dom.rangeToggle.querySelectorAll('[data-range]');
    buttons.forEach(btn => {
      if (parseInt(btn.dataset.range, 10) === range) {
        btn.classList.add('card-detail__range-btn--active');
      } else {
        btn.classList.remove('card-detail__range-btn--active');
      }
    });
  }

  /**
   * Open zoom modal
   */
  function openZoomModal() {
    if (dom.zoomModal) {
      dom.zoomModal.hidden = false;
      document.body.style.overflow = 'hidden';
    }
  }

  /**
   * Close zoom modal
   */
  function closeZoomModal() {
    if (dom.zoomModal) {
      dom.zoomModal.hidden = true;
      document.body.style.overflow = '';
    }
  }

  /**
   * Show loading state
   */
  function showLoading() {
    if (dom.loading) dom.loading.hidden = false;
    if (dom.error) dom.error.hidden = true;
    if (dom.content) dom.content.hidden = true;
  }

  /**
   * Show content
   */
  function showContent() {
    if (dom.loading) dom.loading.hidden = true;
    if (dom.error) dom.error.hidden = true;
    if (dom.content) dom.content.hidden = false;
  }

  /**
   * Show error state
   */
  function showError(message) {
    if (dom.loading) dom.loading.hidden = true;
    if (dom.error) dom.error.hidden = false;
    if (dom.content) dom.content.hidden = true;
    if (dom.errorMessage) dom.errorMessage.textContent = message;
  }

  /**
   * Format currency
   */
  function formatCurrency(value, currency = 'GBP') {
    if (value === null || value === undefined) return '--';

    if (currency === 'JPY') {
      return new Intl.NumberFormat('ja-JP', {
        style: 'currency',
        currency: 'JPY',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
      }).format(value);
    }

    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value);
  }

  /**
   * Format variant type
   */
  function formatVariant(variant) {
    if (!variant) return 'Standard';

    const variantMap = {
      'parallel': 'Parallel',
      'sp': 'SP',
      'manga': 'Manga',
      'boxtopper': 'Box Topper',
      'spr': 'SPR',
      'tr': 'Treasure Rare',
      'wantedposter': 'Wanted Poster',
      'dashpack': 'Dash Pack'
    };

    return variantMap[variant.toLowerCase()] || variant.toUpperCase();
  }

  // Initialize on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
