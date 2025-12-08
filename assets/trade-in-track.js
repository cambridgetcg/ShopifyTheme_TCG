/**
 * Trade-In Tracking Page
 * Fetches and displays submission status from the cardforum API
 */

(function() {
  'use strict';

  // ============================================================================
  // Configuration
  // ============================================================================

  const CONFIG = {
    apiBase: '/apps/trade-in',
    endpoints: {
      track: '/track',
      packingSlip: '/packing-slip'
    }
  };

  // ============================================================================
  // DOM Elements
  // ============================================================================

  const elements = {
    form: document.getElementById('trackingForm'),
    input: document.getElementById('trackingNumber'),
    submitBtn: null,
    submitText: null,
    submitLoading: null,
    error: document.getElementById('trackingError'),
    errorMessage: document.getElementById('trackingErrorMessage'),
    results: document.getElementById('trackingResults'),
    // Results elements
    resultNumber: document.getElementById('resultNumber'),
    resultStatusBadge: document.getElementById('resultStatusBadge'),
    resultStatus: document.getElementById('resultStatus'),
    resultDescription: document.getElementById('resultDescription'),
    timeline: document.getElementById('timeline'),
    resultItemCount: document.getElementById('resultItemCount'),
    resultQuotedTotal: document.getElementById('resultQuotedTotal'),
    resultPayoutType: document.getElementById('resultPayoutType'),
    bonusCard: document.getElementById('bonusCard'),
    resultBonus: document.getElementById('resultBonus'),
    gradingResults: document.getElementById('gradingResults'),
    gradingOriginal: document.getElementById('gradingOriginal'),
    gradingAdjustmentRow: document.getElementById('gradingAdjustmentRow'),
    gradingAdjustedCount: document.getElementById('gradingAdjustedCount'),
    gradingAdjustment: document.getElementById('gradingAdjustment'),
    gradingFinal: document.getElementById('gradingFinal'),
    itemsCount: document.getElementById('itemsCount'),
    itemsList: document.getElementById('itemsList'),
    printPackingSlip: document.getElementById('printPackingSlip')
  };

  // ============================================================================
  // State
  // ============================================================================

  let currentSubmissionNumber = null;

  // ============================================================================
  // Utilities
  // ============================================================================

  function formatPrice(pence) {
    return '£' + (pence / 100).toFixed(2);
  }

  function formatPayoutType(type) {
    const types = {
      'STORE_CREDIT': 'Store Credit',
      'BANK': 'Bank Transfer',
      'PAYPAL': 'PayPal'
    };
    return types[type] || type;
  }

  function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // ============================================================================
  // API
  // ============================================================================

  async function fetchTrackingInfo(number) {
    const url = new URL(CONFIG.apiBase + CONFIG.endpoints.track, window.location.origin);
    url.searchParams.set('number', number);

    const response = await fetch(url.toString());
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Failed to fetch tracking info');
    }

    return data;
  }

  // ============================================================================
  // UI Updates
  // ============================================================================

  function showError(message) {
    elements.errorMessage.textContent = message;
    elements.error.hidden = false;
    elements.results.hidden = true;
  }

  function hideError() {
    elements.error.hidden = true;
  }

  function setLoading(loading) {
    if (!elements.submitText) {
      elements.submitText = document.querySelector('.trade-in-track__submit-text');
      elements.submitLoading = document.querySelector('.trade-in-track__submit-loading');
    }

    elements.submitText.hidden = loading;
    elements.submitLoading.hidden = !loading;
    elements.form.querySelector('button').disabled = loading;
    elements.input.disabled = loading;
  }

  function renderTimeline(timeline) {
    elements.timeline.innerHTML = timeline.map(step => {
      const checkIcon = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>`;
      const dotContent = step.isComplete ? checkIcon : '';

      return `
        <div class="trade-in-track__timeline-step" data-complete="${step.isComplete}" data-current="${step.isCurrent}">
          <div class="trade-in-track__timeline-dot">${dotContent}</div>
          <div class="trade-in-track__timeline-label">${escapeHtml(step.label)}</div>
        </div>
      `;
    }).join('');
  }

  function renderItems(items) {
    elements.itemsList.innerHTML = items.map(item => {
      const hasAdjustment = item.finalPrice !== null && item.finalPrice !== item.quotedPrice;
      const displayPrice = item.finalPrice !== null ? item.finalPrice : item.quotedPrice;

      return `
        <div class="trade-in-track__item">
          <div class="trade-in-track__item-info">
            <p class="trade-in-track__item-name">${escapeHtml(item.cardName)}</p>
            <div class="trade-in-track__item-meta">
              ${item.setCode ? escapeHtml(item.setCode) + ' · ' : ''}
              ${item.quantity}x ·
              ${item.conditionClaimed}
              ${item.conditionActual && item.conditionActual !== item.conditionClaimed
                ? ` → ${item.conditionActual}`
                : ''}
            </div>
          </div>
          <div class="trade-in-track__item-price">
            ${hasAdjustment
              ? `<div class="trade-in-track__item-final trade-in-track__item-final--adjusted">${formatPrice(item.quotedPrice * item.quantity)}</div>`
              : ''}
            <div class="trade-in-track__item-quoted">${formatPrice(displayPrice * item.quantity)}</div>
            ${item.status !== 'PENDING'
              ? `<span class="trade-in-track__item-status" data-status="${item.status}">${item.status}</span>`
              : ''}
          </div>
        </div>
      `;
    }).join('');

    elements.itemsCount.textContent = items.reduce((sum, item) => sum + item.quantity, 0);
  }

  function renderGradingResults(results) {
    if (!results) {
      elements.gradingResults.hidden = true;
      return;
    }

    elements.gradingOriginal.textContent = formatPrice(results.originalTotal);
    elements.gradingFinal.textContent = formatPrice(results.adjustedTotal);

    if (results.hasAdjustments) {
      const adjustment = results.adjustedTotal - results.originalTotal;
      elements.gradingAdjustedCount.textContent = results.adjustedItemCount;
      elements.gradingAdjustment.textContent = formatPrice(adjustment);
      elements.gradingAdjustmentRow.hidden = false;
    } else {
      elements.gradingAdjustmentRow.hidden = true;
    }

    elements.gradingResults.hidden = false;
  }

  function renderResults(data) {
    const { submission, timeline, items, gradingResults } = data;

    currentSubmissionNumber = submission.submissionNumber;

    // Header
    elements.resultNumber.textContent = submission.submissionNumber;
    elements.resultStatusBadge.dataset.status = submission.status;
    elements.resultStatus.textContent = submission.statusLabel;
    elements.resultDescription.textContent = submission.statusDescription;

    // Timeline
    renderTimeline(timeline);

    // Summary
    elements.resultItemCount.textContent = submission.itemCount;
    elements.resultQuotedTotal.textContent = formatPrice(submission.quotedTotal);
    elements.resultPayoutType.textContent = formatPayoutType(submission.payoutType);

    // Bonus (for store credit)
    if (submission.bonusAmount && submission.bonusAmount > 0) {
      elements.resultBonus.textContent = '+' + formatPrice(submission.bonusAmount);
      elements.bonusCard.hidden = false;
    } else {
      elements.bonusCard.hidden = true;
    }

    // Grading results
    renderGradingResults(gradingResults);

    // Items
    renderItems(items);

    // Show results
    hideError();
    elements.results.hidden = false;

    // Scroll to results
    elements.results.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // ============================================================================
  // Event Handlers
  // ============================================================================

  async function handleSubmit(e) {
    e.preventDefault();

    const number = elements.input.value.trim().toUpperCase();
    if (!number) {
      showError('Please enter a submission number');
      return;
    }

    setLoading(true);
    hideError();
    elements.results.hidden = true;

    try {
      const data = await fetchTrackingInfo(number);

      if (!data.found) {
        showError(data.error || 'Submission not found');
        return;
      }

      renderResults(data);

      // Update URL without reload
      const url = new URL(window.location);
      url.searchParams.set('number', number);
      window.history.replaceState({}, '', url);

    } catch (error) {
      console.error('Tracking error:', error);
      showError(error.message || 'An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  function handlePrintPackingSlip() {
    if (!currentSubmissionNumber) return;

    const url = CONFIG.apiBase + CONFIG.endpoints.packingSlip + '/' + currentSubmissionNumber;
    window.open(url, '_blank');
  }

  // ============================================================================
  // Initialization
  // ============================================================================

  function init() {
    // Event listeners
    elements.form.addEventListener('submit', handleSubmit);
    elements.printPackingSlip.addEventListener('click', handlePrintPackingSlip);

    // Check for number in URL
    const urlParams = new URLSearchParams(window.location.search);
    const number = urlParams.get('number');
    if (number) {
      elements.input.value = number;
      elements.form.dispatchEvent(new Event('submit'));
    }
  }

  // Start when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
