/**
 * Trade-In App - Optimized JavaScript
 * Performance: Lazy loading, request caching, debouncing, IntersectionObserver
 */

(function() {
  'use strict';

  // ============================================================================
  // Configuration
  // ============================================================================

  // Default configuration (used as fallback if API fails)
  const DEFAULT_CONFIG = {
    minimumValue: 500, // £5 in pence
    storeCreditBonus: 0.10, // 10%
    freeShippingThreshold: 5000, // £50 in pence
    conditions: [
      { code: 'NM', name: 'Near Mint', multiplier: 0.70 },
      { code: 'LP', name: 'Lightly Played', multiplier: 0.55 },
      { code: 'MP', name: 'Moderately Played', multiplier: 0.40 },
      { code: 'HP', name: 'Heavily Played', multiplier: 0.25 },
      { code: 'DMG', name: 'Damaged', multiplier: 0.10 }
    ]
  };

  const CONFIG = {
    apiBase: '/apps/trade-in',
    minSearchLength: 2,
    searchDebounceMs: 300,
    cacheMaxAge: 5 * 60 * 1000, // 5 minutes
    // Dynamic settings - will be loaded from API
    minimumValue: DEFAULT_CONFIG.minimumValue,
    storeCreditBonus: DEFAULT_CONFIG.storeCreditBonus,
    freeShippingThreshold: DEFAULT_CONFIG.freeShippingThreshold,
    conditions: [...DEFAULT_CONFIG.conditions],
    // Flag to track if config was loaded
    configLoaded: false
  };

  /**
   * Load configuration from the API
   * This fetches dynamic settings from the cardforum backend
   */
  async function loadConfig() {
    try {
      const response = await fetch(`${CONFIG.apiBase}/settings`);
      if (!response.ok) {
        console.warn('Failed to load config, using defaults');
        return;
      }

      const data = await response.json();

      // Update CONFIG with server values
      if (data.minimumValue !== undefined) {
        CONFIG.minimumValue = data.minimumValue;
      }
      if (data.storeCreditBonus !== undefined) {
        CONFIG.storeCreditBonus = data.storeCreditBonus;
      }
      if (data.freeShippingThreshold !== undefined) {
        CONFIG.freeShippingThreshold = data.freeShippingThreshold;
      }
      if (data.conditions && Array.isArray(data.conditions)) {
        CONFIG.conditions = data.conditions;
      }

      CONFIG.configLoaded = true;
      console.log('Trade-in config loaded from server');
    } catch (err) {
      console.warn('Failed to load config from server, using defaults:', err);
    }
  }

  // ============================================================================
  // State
  // ============================================================================

  const state = {
    cart: [],
    selectedCard: null,
    searchAbortController: null,
    browseAbortController: null,
    currentPage: 1,
    totalPages: 1,
    currentSet: '',
    sets: []
  };

  // ============================================================================
  // Cache
  // ============================================================================

  const cache = new Map();

  function getCached(key) {
    const entry = cache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expires) {
      cache.delete(key);
      return null;
    }
    return entry.data;
  }

  function setCache(key, data) {
    cache.set(key, {
      data,
      expires: Date.now() + CONFIG.cacheMaxAge
    });
  }

  function clearCache() {
    cache.clear();
  }

  // ============================================================================
  // Utilities
  // ============================================================================

  function formatPrice(pence) {
    return '£' + (pence / 100).toFixed(2);
  }

  function debounce(fn, delay) {
    let timeout;
    return function(...args) {
      clearTimeout(timeout);
      timeout = setTimeout(() => fn.apply(this, args), delay);
    };
  }

  function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  function showToast(message, type = 'default') {
    let toast = document.querySelector('.trade-in-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.className = 'trade-in-toast';
      document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.className = 'trade-in-toast' + (type === 'success' ? ' trade-in-toast--success' : '');

    requestAnimationFrame(() => {
      toast.classList.add('trade-in-toast--visible');
    });

    setTimeout(() => {
      toast.classList.remove('trade-in-toast--visible');
    }, 3000);
  }

  // ============================================================================
  // API Calls
  // ============================================================================

  async function fetchWithCache(url, options = {}) {
    const cacheKey = url;
    const cached = getCached(cacheKey);

    if (cached && !options.skipCache) {
      return cached;
    }

    const response = await fetch(url, options);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    setCache(cacheKey, data);
    return data;
  }

  /**
   * Normalize card data from different API endpoints to a consistent format
   *
   * API Response Formats:
   * - Search API: { id, cardName, bestPriceGbp, prices: { NM, LP, MP, HP, DMG } }
   * - Browse API: { cardId, name, prices: { market, tradein: { NM, LP, MP, HP, DMG } } }
   */
  function normalizeCardData(card, source = 'browse') {
    // Handle different field names between search and browse APIs
    const cardId = card.cardId || card.id;
    const name = card.name || card.cardName;
    const setCode = card.setCode || card.setName || '';
    const cardNumber = card.cardNumber || '';
    const variantType = card.variantType || card.variant || '';
    const fullCardNumber = cardNumber ? `${setCode}-${cardNumber}` : setCode;

    // Extract market price (in pence) for reference
    let bestPriceGbp = 0;
    if (typeof card.bestPriceGbp === 'number') {
      bestPriceGbp = card.bestPriceGbp;
    } else if (card.prices && typeof card.prices.market === 'number') {
      bestPriceGbp = card.prices.market;
    }

    // Extract pre-calculated condition prices from API
    // The API now returns correct prices (market × condition multiplier)
    let prices = null;
    if (card.prices) {
      if (typeof card.prices.NM === 'number') {
        // Search API format: { NM, LP, MP, HP, DMG } directly
        prices = {
          NM: card.prices.NM,
          LP: card.prices.LP,
          MP: card.prices.MP,
          HP: card.prices.HP,
          DMG: card.prices.DMG
        };
      } else if (card.prices.tradein && typeof card.prices.tradein.NM === 'number') {
        // Browse API format: { market, tradein: { NM, LP, ... } }
        prices = {
          NM: card.prices.tradein.NM,
          LP: card.prices.tradein.LP,
          MP: card.prices.tradein.MP,
          HP: card.prices.tradein.HP,
          DMG: card.prices.tradein.DMG
        };
      }
    }

    return {
      cardId,
      name,
      setCode,
      cardNumber,
      variantType,
      fullCardNumber,
      rarity: card.rarity || '',
      imageUrl: card.imageUrl || null,
      bestPriceGbp,
      // Pre-calculated condition prices from API (already includes multipliers)
      prices
    };
  }

  async function searchCards(query, limit = 10) {
    if (state.searchAbortController) {
      state.searchAbortController.abort();
    }
    state.searchAbortController = new AbortController();

    try {
      const url = `${CONFIG.apiBase}/cards/search?q=${encodeURIComponent(query)}&limit=${limit}`;
      const response = await fetch(url, { signal: state.searchAbortController.signal });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();

      // Normalize response: search API returns 'results', normalize to 'cards'
      const rawCards = data.cards || data.results || [];
      return {
        ...data,
        cards: rawCards.map(card => normalizeCardData(card, 'search'))
      };
    } catch (err) {
      if (err.name === 'AbortError') return null;
      throw err;
    }
  }

  /**
   * Full search - triggered by Enter key
   * Shows all matching cards in the browse grid area
   */
  async function fullSearch(query) {
    const browseGrid = document.querySelector('[data-browse-grid]');
    const browseSection = document.querySelector('[data-browse-section]');

    if (!browseGrid) return;

    // Show loading state in browse grid
    browseGrid.innerHTML = '<div class="trade-in-browse__loading"><div class="trade-in-spinner"></div> Searching for all matches...</div>';
    if (browseSection) browseSection.hidden = false;

    try {
      // Search with higher limit to get all matching cards
      const data = await searchCards(query, 50);

      if (data && data.cards && data.cards.length > 0) {
        // Update section title to show search results
        const sectionTitle = document.querySelector('[data-browse-title]');
        if (sectionTitle) {
          sectionTitle.textContent = `Search results for "${query}" (${data.cards.length} cards)`;
        }

        renderBrowseGrid(browseGrid, data.cards);
      } else {
        browseGrid.innerHTML = `<div class="trade-in-browse__empty">No cards found matching "${escapeHtml(query)}"</div>`;
      }
    } catch (err) {
      browseGrid.innerHTML = '<div class="trade-in-browse__empty">Search failed. Please try again.</div>';
    }
  }

  async function browseCards(page = 1, set = '') {
    if (state.browseAbortController) {
      state.browseAbortController.abort();
    }
    state.browseAbortController = new AbortController();

    try {
      let url = `${CONFIG.apiBase}/cards/browse?page=${page}&limit=12`;
      if (set) url += `&set=${encodeURIComponent(set)}`;

      const response = await fetch(url, { signal: state.browseAbortController.signal });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();

      // Normalize card data
      return {
        ...data,
        cards: (data.cards || []).map(card => normalizeCardData(card, 'browse'))
      };
    } catch (err) {
      if (err.name === 'AbortError') return null;
      throw err;
    }
  }

  async function fetchSets() {
    try {
      const data = await fetchWithCache(`${CONFIG.apiBase}/cards/sets`);
      return data.sets || [];
    } catch (err) {
      console.error('Failed to fetch sets:', err);
      return [];
    }
  }

  async function submitTradeIn(formData) {
    const response = await fetch(`${CONFIG.apiBase}/submissions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData)
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || 'Submission failed');
    }

    return await response.json();
  }

  // ============================================================================
  // Cart Management
  // ============================================================================

  // Cart version - increment when cart data structure changes
  const CART_VERSION = 2;

  function loadCart() {
    try {
      const saved = localStorage.getItem('tradeInCart');
      const savedVersion = localStorage.getItem('tradeInCartVersion');

      // Clear cart if version mismatch (data structure changed)
      if (savedVersion !== String(CART_VERSION)) {
        console.log('Trade-in cart version mismatch, clearing old cart data');
        localStorage.removeItem('tradeInCart');
        localStorage.setItem('tradeInCartVersion', String(CART_VERSION));
        state.cart = [];
        return;
      }

      if (saved) {
        const parsedCart = JSON.parse(saved);
        // Validate cart items have required fields
        state.cart = parsedCart.filter(item => {
          const isValid = item && item.cardId && item.name && item.condition;
          if (!isValid) {
            console.warn('Removing invalid cart item:', item);
          }
          return isValid;
        });
        // Re-save if we filtered out invalid items
        if (state.cart.length !== parsedCart.length) {
          saveCart();
        }
      }
    } catch (e) {
      console.error('Error loading cart:', e);
      state.cart = [];
    }
  }

  function saveCart() {
    try {
      localStorage.setItem('tradeInCart', JSON.stringify(state.cart));
      localStorage.setItem('tradeInCartVersion', String(CART_VERSION));
    } catch (e) {
      console.error('Error saving cart:', e);
    }
  }

  function clearCart() {
    state.cart = [];
    saveCart();
    renderCart();
    updateFormSections();
  }

  function addToCart(card, condition, quantity = 1) {
    const existingIndex = state.cart.findIndex(
      item => item.cardId === card.cardId && item.condition === condition
    );

    if (existingIndex >= 0) {
      state.cart[existingIndex].quantity += quantity;
    } else {
      // Use pre-calculated price from API (already has condition multiplier applied)
      // This avoids double-discount - API applies multipliers to market price
      let price = 0;
      if (card.prices && typeof card.prices[condition] === 'number') {
        // Price is in pence from API
        price = card.prices[condition];
      } else {
        // Fallback: calculate from market price if API didn't provide condition prices
        const conditionData = CONFIG.conditions.find(c => c.code === condition);
        if (conditionData && card.bestPriceGbp) {
          // bestPriceGbp is now in pence from API
          price = Math.floor(card.bestPriceGbp * conditionData.multiplier);
        }
      }

      state.cart.push({
        cardId: card.cardId,
        name: card.name,
        set: card.fullCardNumber || card.setCode,
        setCode: card.setCode || null,
        variantType: card.variantType || null,
        imageUrl: card.imageUrl,
        condition,
        quantity,
        pricePerItem: price,
        basePriceGbp: card.bestPriceGbp
      });
    }

    saveCart();
    renderCart();
    updateFormSections();
    showToast(`Added ${card.name} to trade-in`, 'success');
  }

  function removeFromCart(index) {
    state.cart.splice(index, 1);
    saveCart();
    renderCart();
    updateFormSections();
  }

  function updateCartQuantity(index, delta) {
    const item = state.cart[index];
    if (!item) return;

    item.quantity = Math.max(1, item.quantity + delta);
    saveCart();
    renderCart();
    updateFormSections();
  }

  function getCartTotals() {
    const itemCount = state.cart.reduce((sum, item) => sum + item.quantity, 0);
    const subtotal = state.cart.reduce((sum, item) => sum + (item.pricePerItem * item.quantity), 0);
    const storeCreditTotal = Math.floor(subtotal * (1 + CONFIG.storeCreditBonus));

    return { itemCount, subtotal, storeCreditTotal, bankTotal: subtotal };
  }

  // ============================================================================
  // Lazy Loading
  // ============================================================================

  const imageObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const img = entry.target;
        const src = img.dataset.src;
        if (src) {
          img.src = src;
          img.removeAttribute('data-src');
          img.classList.add('loaded');
        }
        imageObserver.unobserve(img);
      }
    });
  }, {
    rootMargin: '100px'
  });

  function lazyLoadImage(img) {
    if (img.dataset.src) {
      imageObserver.observe(img);
    }
  }

  // ============================================================================
  // Rendering
  // ============================================================================

  function renderSearchResults(container, results) {
    if (!results || results.length === 0) {
      container.innerHTML = '<div class="trade-in-search__no-results">No cards found</div>';
      return;
    }

    container.innerHTML = results.map((card, i) => `
      <button type="button" class="trade-in-search__result" data-index="${i}" tabindex="0">
        <div class="trade-in-search__result-image">
          ${card.imageUrl ? `<img src="${escapeHtml(card.imageUrl)}" alt="" loading="lazy">` : ''}
        </div>
        <div class="trade-in-search__result-info">
          <span class="trade-in-search__result-name">${escapeHtml(card.name)}</span>
          <span class="trade-in-search__result-set">${escapeHtml(card.fullCardNumber || card.setCode)} ${card.variantType ? `(${escapeHtml(card.variantType)})` : ''}</span>
        </div>
        <span class="trade-in-search__result-price">${formatPrice(card.prices && card.prices.NM ? card.prices.NM : Math.floor(card.bestPriceGbp * CONFIG.conditions[0].multiplier))}</span>
      </button>
    `).join('');

    // Store results for click handling
    container._results = results;
  }

  function renderBrowseGrid(container, cards) {
    if (!cards || cards.length === 0) {
      container.innerHTML = '<div class="trade-in-browse__empty">No cards available</div>';
      return;
    }

    container.innerHTML = cards.map((card, i) => `
      <div class="trade-in-card" data-card-index="${i}">
        <div class="trade-in-card__image">
          ${card.imageUrl
            ? `<img data-src="${escapeHtml(card.imageUrl)}" alt="${escapeHtml(card.name)}" class="skeleton">`
            : '<div class="skeleton skeleton-card"></div>'
          }
        </div>
        <div class="trade-in-card__info">
          <span class="trade-in-card__name">${escapeHtml(card.name)}</span>
          <span class="trade-in-card__set">${escapeHtml(card.fullCardNumber || card.setCode)}</span>
          <span class="trade-in-card__price">${formatPrice(card.prices && card.prices.NM ? card.prices.NM : Math.floor(card.bestPriceGbp * CONFIG.conditions[0].multiplier))}</span>
        </div>
        <div class="trade-in-card__actions">
          <button type="button" class="trade-in-card__quick-add" data-quick-add="${i}">
            <svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clip-rule="evenodd"/></svg>
            NM
          </button>
          <button type="button" class="trade-in-card__more" data-more="${i}" title="Choose condition">
            <svg viewBox="0 0 20 20" fill="currentColor"><path d="M6 10a2 2 0 11-4 0 2 2 0 014 0zM12 10a2 2 0 11-4 0 2 2 0 014 0zM16 12a2 2 0 100-4 2 2 0 000 4z"/></svg>
          </button>
        </div>
      </div>
    `).join('');

    // Store cards for event handling
    container._cards = cards;

    // Lazy load images
    container.querySelectorAll('img[data-src]').forEach(lazyLoadImage);
  }

  function renderPagination(container, currentPage, totalPages) {
    if (totalPages <= 1) {
      container.hidden = true;
      return;
    }

    container.hidden = false;
    const pages = [];

    // Always show first, last, current and neighbors
    for (let i = 1; i <= totalPages; i++) {
      if (i === 1 || i === totalPages || (i >= currentPage - 1 && i <= currentPage + 1)) {
        pages.push(i);
      } else if (pages[pages.length - 1] !== '...') {
        pages.push('...');
      }
    }

    container.innerHTML = `
      <button type="button" class="trade-in-pagination__btn" data-page="${currentPage - 1}" ${currentPage <= 1 ? 'disabled' : ''}>
        <svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clip-rule="evenodd"/></svg>
      </button>
      ${pages.map(p => p === '...'
        ? '<span class="trade-in-pagination__btn" style="border:none;cursor:default">...</span>'
        : `<button type="button" class="trade-in-pagination__btn${p === currentPage ? ' trade-in-pagination__btn--active' : ''}" data-page="${p}">${p}</button>`
      ).join('')}
      <button type="button" class="trade-in-pagination__btn" data-page="${currentPage + 1}" ${currentPage >= totalPages ? 'disabled' : ''}>
        <svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clip-rule="evenodd"/></svg>
      </button>
    `;
  }

  function renderCart() {
    const cartEl = document.querySelector('[data-cart]');
    if (!cartEl) return;

    const emptyEl = cartEl.querySelector('[data-cart-empty]');
    const itemsEl = cartEl.querySelector('[data-cart-items]');
    const summaryEl = cartEl.querySelector('[data-cart-summary]');
    const clearBtn = cartEl.querySelector('[data-cart-clear]');
    const badgeEl = cartEl.querySelector('.trade-in-cart__badge');

    const totals = getCartTotals();

    if (state.cart.length === 0) {
      if (emptyEl) emptyEl.hidden = false;
      if (itemsEl) itemsEl.innerHTML = '';
      if (summaryEl) summaryEl.hidden = true;
      if (clearBtn) clearBtn.hidden = true;
      if (badgeEl) badgeEl.textContent = '0';
      return;
    }

    if (emptyEl) emptyEl.hidden = true;
    if (clearBtn) clearBtn.hidden = false;
    if (badgeEl) badgeEl.textContent = totals.itemCount;

    if (itemsEl) {
      itemsEl.innerHTML = state.cart.map((item, i) => `
        <div class="trade-in-cart__item">
          <div class="trade-in-cart__item-image">
            ${item.imageUrl ? `<img src="${escapeHtml(item.imageUrl)}" alt="">` : ''}
          </div>
          <div class="trade-in-cart__item-info">
            <span class="trade-in-cart__item-name">${escapeHtml(item.name)}</span>
            <div class="trade-in-cart__item-meta">
              <span class="trade-in-cart__item-condition">${item.condition}</span>
              <span>${escapeHtml(item.set)}</span>
            </div>
          </div>
          <div class="trade-in-cart__item-controls">
            <span class="trade-in-cart__item-price">${formatPrice(item.pricePerItem * item.quantity)}</span>
            <div class="trade-in-cart__item-actions">
              <button type="button" class="trade-in-cart__qty-btn" data-qty-change="${i}" data-delta="-1">−</button>
              <span class="trade-in-cart__qty">${item.quantity}</span>
              <button type="button" class="trade-in-cart__qty-btn" data-qty-change="${i}" data-delta="1">+</button>
              <button type="button" class="trade-in-cart__item-remove" data-remove="${i}">
                <svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"/></svg>
              </button>
            </div>
          </div>
        </div>
      `).join('');
    }

    if (summaryEl) {
      summaryEl.hidden = false;
      const itemCountEl = summaryEl.querySelector('[data-item-count]');
      const totalEl = summaryEl.querySelector('[data-quoted-total]');
      if (itemCountEl) itemCountEl.textContent = totals.itemCount;
      if (totalEl) totalEl.textContent = formatPrice(totals.subtotal);
    }
  }

  function updateFormSections() {
    const customerSection = document.querySelector('[data-customer-section]');
    const payoutSection = document.querySelector('[data-payout-section]');
    const submitSection = document.querySelector('[data-submit-section]');

    const hasItems = state.cart.length > 0;

    if (customerSection) customerSection.hidden = !hasItems;
    if (payoutSection) payoutSection.hidden = !hasItems;
    if (submitSection) submitSection.hidden = !hasItems;

    // Update payout totals
    if (hasItems) {
      const totals = getCartTotals();
      const storeCreditEl = document.querySelector('[data-store-credit-total]');
      const bankEl = document.querySelector('[data-bank-total]');

      if (storeCreditEl) storeCreditEl.textContent = formatPrice(totals.storeCreditTotal);
      if (bankEl) bankEl.textContent = formatPrice(totals.bankTotal);

      // Check minimum
      const minimumNotice = document.querySelector('[data-minimum-notice]');
      const submitBtn = document.querySelector('[data-submit-button]');
      const meetsMinimum = totals.subtotal >= CONFIG.minimumValue;

      if (minimumNotice) {
        minimumNotice.hidden = meetsMinimum;
        if (!meetsMinimum) {
          const remaining = CONFIG.minimumValue - totals.subtotal;
          minimumNotice.textContent = `Add ${formatPrice(remaining)} more to meet the £5 minimum`;
        }
      }

      if (submitBtn) submitBtn.disabled = !meetsMinimum;
    }

    // Update progress indicator
    updateProgress();
  }

  function updateProgress() {
    const steps = document.querySelectorAll('.trade-in-progress__step');
    const hasItems = state.cart.length > 0;

    steps.forEach((step, i) => {
      step.classList.remove('trade-in-progress__step--active', 'trade-in-progress__step--complete');

      if (i === 0) {
        step.classList.add(hasItems ? 'trade-in-progress__step--complete' : 'trade-in-progress__step--active');
      } else if (i === 1 && hasItems) {
        step.classList.add('trade-in-progress__step--active');
      }
    });
  }

  // ============================================================================
  // Modal
  // ============================================================================

  function openConditionModal(card) {
    state.selectedCard = card;
    const modal = document.querySelector('[data-condition-modal]');
    if (!modal) return;

    // Populate modal
    const imgEl = modal.querySelector('[data-modal-card-image]');
    const nameEl = modal.querySelector('[data-modal-card-name]');
    const setEl = modal.querySelector('[data-modal-card-set]');
    const conditionsEl = modal.querySelector('[data-condition-options]');
    const qtyInput = modal.querySelector('[data-quantity-input]');

    if (imgEl && card.imageUrl) imgEl.src = card.imageUrl;
    if (nameEl) nameEl.textContent = card.name;
    if (setEl) setEl.textContent = `${card.fullCardNumber || card.setCode} ${card.variantType ? `(${card.variantType})` : ''}`;
    if (qtyInput) qtyInput.value = 1;

    // Render conditions with pre-calculated prices from API
    if (conditionsEl) {
      conditionsEl.innerHTML = CONFIG.conditions.map((cond, i) => {
        // Use pre-calculated price from API, fallback to calculation
        const price = card.prices && typeof card.prices[cond.code] === 'number'
          ? card.prices[cond.code]
          : Math.floor(card.bestPriceGbp * cond.multiplier);
        return `
          <button type="button" class="trade-in-condition${i === 0 ? ' trade-in-condition--selected' : ''}" data-condition="${cond.code}">
            <span class="trade-in-condition__code">${cond.code}</span>
            <span class="trade-in-condition__name">${cond.name}</span>
            <span class="trade-in-condition__price">${formatPrice(price)}</span>
          </button>
        `;
      }).join('');
    }

    updateModalPrice();
    modal.hidden = false;
    document.body.classList.add('trade-in-modal-open');
  }

  function closeModal() {
    const modal = document.querySelector('[data-condition-modal]');
    if (modal) {
      modal.hidden = true;
      document.body.classList.remove('trade-in-modal-open');
    }
    state.selectedCard = null;
  }

  function updateModalPrice() {
    const modal = document.querySelector('[data-condition-modal]');
    if (!modal || !state.selectedCard) return;

    const selectedBtn = modal.querySelector('.trade-in-condition--selected');
    const qtyInput = modal.querySelector('[data-quantity-input]');
    const priceEl = modal.querySelector('[data-modal-price]');

    if (!selectedBtn || !priceEl) return;

    const conditionCode = selectedBtn.dataset.condition;
    const condition = CONFIG.conditions.find(c => c.code === conditionCode);
    const quantity = parseInt(qtyInput?.value || 1, 10);

    // Use pre-calculated price from API, fallback to calculation
    const card = state.selectedCard;
    const price = card.prices && typeof card.prices[conditionCode] === 'number'
      ? card.prices[conditionCode]
      : Math.floor(card.bestPriceGbp * condition.multiplier);

    priceEl.textContent = formatPrice(price * quantity);
  }

  // ============================================================================
  // Form Submission
  // ============================================================================

  async function handleSubmit(form) {
    const loadingEl = document.querySelector('[data-loading-state]');
    const successEl = document.querySelector('[data-success-state]');
    const errorBanner = document.querySelector('[data-error-banner]');
    const formContent = form.querySelector('.trade-in-form__content');

    // Hide error
    if (errorBanner) errorBanner.hidden = true;

    // Get form data
    const email = form.querySelector('[name="email"]')?.value;
    const firstName = form.querySelector('[name="firstName"]')?.value || '';
    const lastName = form.querySelector('[name="lastName"]')?.value || '';
    const payoutType = form.querySelector('[name="payoutType"]:checked')?.value || 'STORE_CREDIT';
    const shopifyCustomerId = form.querySelector('[name="shopifyCustomerId"]')?.value;

    // Validate
    if (!email) {
      showError('Please enter your email address');
      return;
    }

    // Show loading
    if (formContent) formContent.style.display = 'none';
    document.querySelectorAll('[data-customer-section], [data-payout-section], [data-submit-section]').forEach(el => {
      el.hidden = true;
    });
    if (loadingEl) loadingEl.hidden = false;

    try {
      const result = await submitTradeIn({
        email,
        firstName,
        lastName,
        payoutType,
        shopifyCustomerId,
        items: state.cart.map(item => ({
          cardPriceId: item.cardId,
          cardName: item.name,
          setName: item.set || 'Unknown',
          setCode: item.setCode || null,
          variant: item.variantType || null,
          conditionClaimed: item.condition,
          quantity: item.quantity
        }))
      });

      // Success
      if (loadingEl) loadingEl.hidden = true;
      if (successEl) {
        successEl.hidden = false;
        const numberEl = successEl.querySelector('[data-submission-number]');
        if (numberEl) numberEl.textContent = result.submissionNumber;

        // Update links
        const packingLink = successEl.querySelector('[data-packing-slip-link]');
        const shippingLink = successEl.querySelector('[data-shipping-link]');
        const trackingLink = successEl.querySelector('[data-tracking-link]');

        if (packingLink) packingLink.href = `${CONFIG.apiBase}/packing-slip/${result.submissionNumber}`;
        if (shippingLink) shippingLink.href = `${CONFIG.apiBase}/shipping-instructions/${result.submissionNumber}`;
        if (trackingLink) trackingLink.href = `/pages/trade-in-track?number=${result.submissionNumber}`;
      }

      // Clear cart
      clearCart();
      localStorage.removeItem('tradeInCart');

    } catch (err) {
      console.error('Submission error:', err);
      if (loadingEl) loadingEl.hidden = true;
      if (formContent) formContent.style.display = '';
      updateFormSections();
      showError(err.message || 'Submission failed. Please try again.');
    }
  }

  function showError(message) {
    const banner = document.querySelector('[data-error-banner]');
    const msgEl = banner?.querySelector('[data-error-message]');
    if (banner && msgEl) {
      msgEl.textContent = message;
      banner.hidden = false;
      banner.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }

  // ============================================================================
  // Event Handlers
  // ============================================================================

  function setupEventListeners() {
    const form = document.querySelector('[data-trade-in-form]');
    if (!form) return;

    // Search
    const searchInput = form.querySelector('[data-search-input]');
    const searchResults = form.querySelector('[data-search-results]');
    const searchClear = form.querySelector('[data-search-clear]');

    if (searchInput && searchResults) {
      const debouncedSearch = debounce(async (query) => {
        if (query.length < CONFIG.minSearchLength) {
          searchResults.hidden = true;
          return;
        }

        searchResults.innerHTML = '<div class="trade-in-search__loading"><div class="trade-in-spinner trade-in-spinner--small"></div> Searching...</div>';
        searchResults.hidden = false;

        try {
          const data = await searchCards(query);
          if (data) {
            renderSearchResults(searchResults, data.cards || []);
          }
        } catch (err) {
          searchResults.innerHTML = '<div class="trade-in-search__no-results">Search failed</div>';
        }
      }, CONFIG.searchDebounceMs);

      searchInput.addEventListener('input', (e) => {
        const query = e.target.value.trim();
        if (searchClear) searchClear.hidden = query.length === 0;
        debouncedSearch(query);
      });

      searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          searchResults.hidden = true;
          searchInput.blur();
        } else if (e.key === 'Enter') {
          e.preventDefault();
          const query = searchInput.value.trim();
          if (query.length >= CONFIG.minSearchLength) {
            // Hide dropdown and perform full search
            searchResults.hidden = true;
            fullSearch(query);
            searchInput.blur();
          }
        }
      });

      searchResults.addEventListener('click', (e) => {
        const resultBtn = e.target.closest('.trade-in-search__result');
        if (resultBtn && searchResults._results) {
          const index = parseInt(resultBtn.dataset.index, 10);
          const card = searchResults._results[index];
          if (card) {
            openConditionModal(card);
            searchResults.hidden = true;
            searchInput.value = '';
            if (searchClear) searchClear.hidden = true;
          }
        }
      });

      if (searchClear) {
        searchClear.addEventListener('click', () => {
          searchInput.value = '';
          searchResults.hidden = true;
          searchClear.hidden = true;
          searchInput.focus();
        });
      }

      // Close on outside click
      document.addEventListener('click', (e) => {
        if (!e.target.closest('.trade-in-search')) {
          searchResults.hidden = true;
        }
      });
    }

    // Browse Grid
    const browseGrid = form.querySelector('[data-browse-grid]');
    if (browseGrid) {
      browseGrid.addEventListener('click', (e) => {
        const quickAddBtn = e.target.closest('[data-quick-add]');
        const moreBtn = e.target.closest('[data-more]');
        const cardEl = e.target.closest('.trade-in-card__image');

        if (quickAddBtn && browseGrid._cards) {
          const index = parseInt(quickAddBtn.dataset.quickAdd, 10);
          const card = browseGrid._cards[index];
          if (card) {
            addToCart(card, 'NM', 1);
            quickAddBtn.classList.add('trade-in-card__quick-add--success');
            setTimeout(() => quickAddBtn.classList.remove('trade-in-card__quick-add--success'), 500);
          }
        } else if (moreBtn && browseGrid._cards) {
          const index = parseInt(moreBtn.dataset.more, 10);
          const card = browseGrid._cards[index];
          if (card) openConditionModal(card);
        } else if (cardEl && browseGrid._cards) {
          const cardWrapper = cardEl.closest('.trade-in-card');
          const index = parseInt(cardWrapper?.dataset.cardIndex, 10);
          const card = browseGrid._cards[index];
          if (card) openConditionModal(card);
        }
      });
    }

    // Refresh Button
    const refreshBtn = form.querySelector('[data-refresh-cards]');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', async () => {
        refreshBtn.disabled = true;
        refreshBtn.classList.add('trade-in-browse__refresh--loading');
        await refreshCards();
        refreshBtn.disabled = false;
        refreshBtn.classList.remove('trade-in-browse__refresh--loading');
      });
    }

    // Set Filter
    const setFilter = form.querySelector('[data-set-filter]');
    if (setFilter) {
      setFilter.addEventListener('change', async (e) => {
        state.currentSet = e.target.value;
        state.currentPage = 1;
        await loadBrowseCards();
      });
    }

    // Pagination
    const pagination = form.querySelector('[data-browse-pagination]');
    if (pagination) {
      pagination.addEventListener('click', async (e) => {
        const btn = e.target.closest('[data-page]');
        if (btn && !btn.disabled) {
          const page = parseInt(btn.dataset.page, 10);
          if (page >= 1 && page <= state.totalPages) {
            state.currentPage = page;
            await loadBrowseCards();
          }
        }
      });
    }

    // Cart events
    const cartEl = form.querySelector('[data-cart]');
    if (cartEl) {
      cartEl.addEventListener('click', (e) => {
        const removeBtn = e.target.closest('[data-remove]');
        const qtyBtn = e.target.closest('[data-qty-change]');
        const clearBtn = e.target.closest('[data-cart-clear]');

        if (removeBtn) {
          const index = parseInt(removeBtn.dataset.remove, 10);
          removeFromCart(index);
        } else if (qtyBtn) {
          const index = parseInt(qtyBtn.dataset.qtyChange, 10);
          const delta = parseInt(qtyBtn.dataset.delta, 10);
          updateCartQuantity(index, delta);
        } else if (clearBtn) {
          if (confirm('Clear all items from your trade-in?')) {
            clearCart();
          }
        }
      });
    }

    // Modal events
    const modal = document.querySelector('[data-condition-modal]');
    if (modal) {
      // Condition selection
      modal.addEventListener('click', (e) => {
        const conditionBtn = e.target.closest('.trade-in-condition');
        if (conditionBtn) {
          modal.querySelectorAll('.trade-in-condition').forEach(btn => {
            btn.classList.remove('trade-in-condition--selected');
          });
          conditionBtn.classList.add('trade-in-condition--selected');
          updateModalPrice();
        }

        // Close buttons
        if (e.target.closest('[data-modal-close]') || e.target.closest('[data-modal-backdrop]')) {
          closeModal();
        }

        // Add button
        if (e.target.closest('[data-modal-add]')) {
          const selectedBtn = modal.querySelector('.trade-in-condition--selected');
          const qtyInput = modal.querySelector('[data-quantity-input]');
          if (selectedBtn && state.selectedCard) {
            const condition = selectedBtn.dataset.condition;
            const quantity = parseInt(qtyInput?.value || 1, 10);
            addToCart(state.selectedCard, condition, quantity);
            closeModal();
          }
        }

        // Quantity buttons
        const qtyDecrease = e.target.closest('[data-quantity-decrease]');
        const qtyIncrease = e.target.closest('[data-quantity-increase]');
        const qtyInput = modal.querySelector('[data-quantity-input]');

        if (qtyDecrease && qtyInput) {
          qtyInput.value = Math.max(1, parseInt(qtyInput.value, 10) - 1);
          updateModalPrice();
        } else if (qtyIncrease && qtyInput) {
          qtyInput.value = Math.min(99, parseInt(qtyInput.value, 10) + 1);
          updateModalPrice();
        }
      });

      // Quantity input change
      const qtyInput = modal.querySelector('[data-quantity-input]');
      if (qtyInput) {
        qtyInput.addEventListener('change', () => {
          qtyInput.value = Math.max(1, Math.min(99, parseInt(qtyInput.value, 10) || 1));
          updateModalPrice();
        });
      }

      // Escape to close
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !modal.hidden) {
          closeModal();
        }
      });
    }

    // Form submission
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      handleSubmit(form);
    });

    // Error banner dismiss
    const errorDismiss = form.querySelector('[data-error-dismiss]');
    if (errorDismiss) {
      errorDismiss.addEventListener('click', () => {
        const banner = document.querySelector('[data-error-banner]');
        if (banner) banner.hidden = true;
      });
    }

    // New submission button
    const newSubmissionBtn = document.querySelector('[data-new-submission]');
    if (newSubmissionBtn) {
      newSubmissionBtn.addEventListener('click', () => {
        const successEl = document.querySelector('[data-success-state]');
        const formContent = form.querySelector('.trade-in-form__content');
        if (successEl) successEl.hidden = true;
        if (formContent) formContent.style.display = '';
        updateFormSections();
      });
    }
  }

  // ============================================================================
  // Initialization
  // ============================================================================

  async function loadBrowseCards() {
    const grid = document.querySelector('[data-browse-grid]');
    const loading = document.querySelector('[data-browse-loading]');
    const pagination = document.querySelector('[data-browse-pagination]');

    if (!grid) return;

    if (loading) loading.hidden = false;
    grid.classList.add('trade-in-browse__grid--loading');

    try {
      const data = await browseCards(state.currentPage, state.currentSet);
      if (data) {
        state.totalPages = data.totalPages || 1;
        renderBrowseGrid(grid, data.cards || []);
        if (pagination) renderPagination(pagination, state.currentPage, state.totalPages);
      }
    } catch (err) {
      console.error('Failed to load cards:', err);
      grid.innerHTML = '<div class="trade-in-browse__empty">Failed to load cards</div>';
    } finally {
      if (loading) loading.hidden = true;
      grid.classList.remove('trade-in-browse__grid--loading');
    }
  }

  async function refreshCards() {
    // Clear the cache to force fresh data
    clearCache();

    // Reset to first page
    state.currentPage = 1;

    // Reload cards and sets
    await Promise.all([
      loadBrowseCards(),
      loadSets()
    ]);

    showToast('Cards refreshed', 'success');
  }

  async function loadSets() {
    const select = document.querySelector('[data-set-filter]');
    if (!select) return;

    try {
      const sets = await fetchSets();
      state.sets = sets;

      select.innerHTML = '<option value="">All Sets</option>' +
        sets.map(set => `<option value="${escapeHtml(set.code)}">${escapeHtml(set.name)}</option>`).join('');
    } catch (err) {
      console.error('Failed to load sets:', err);
    }
  }

  async function init() {
    const form = document.querySelector('[data-trade-in-form]');
    if (!form) return;

    // Load configuration from server first (non-blocking for UI)
    // This updates CONFIG with values from the merchant's settings
    loadConfig().catch(() => {
      console.warn('Config loading failed, continuing with defaults');
    });

    // Load saved cart
    loadCart();
    renderCart();
    updateFormSections();

    // Setup event listeners
    setupEventListeners();

    // Load browse cards and sets
    await Promise.all([
      loadBrowseCards(),
      loadSets()
    ]);
  }

  // Start when DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
