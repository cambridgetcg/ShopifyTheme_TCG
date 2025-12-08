document.addEventListener('DOMContentLoaded', function() {
  // Handle removing individual items
  const removeButtons = document.querySelectorAll('.remove-item-btn');
  removeButtons.forEach(button => {
    button.addEventListener('click', function() {
      const itemKey = this.getAttribute('data-item-key');
      removeTradeInItem(itemKey);
    });
  });
  
  // Handle clearing all trade-in items
  const clearButton = document.getElementById('clear-trade-ins');
  if (clearButton) {
    clearButton.addEventListener('click', clearAllTradeIns);
  }
  
  // Handle proceeding with trade-in
  const proceedButton = document.getElementById('proceed-trade-in');
  if (proceedButton) {
    proceedButton.addEventListener('click', proceedWithTradeIn);
  }
  
  // Add mobile data labels
  addMobileLabels();
  
  // Function to add mobile data labels
  function addMobileLabels() {
    const rows = document.querySelectorAll('.trade-in-cart-row');
    const headers = ['Item', 'Type', 'Quantity', 'Unit Value', 'Total Value', 'Actions'];
    
    rows.forEach(row => {
      const cells = row.querySelectorAll('.trade-in-cart-cell');
      cells.forEach((cell, index) => {
        // Skip the first cell (item column) which already has content
        if (!cell.classList.contains('item-col')) {
          cell.setAttribute('data-label', headers[index]);
        }
      });
    });
  }
  
  // Function to remove a trade-in item
  function removeTradeInItem(itemKey) {
    if (!confirm('Are you sure you want to remove this trade-in item?')) {
      return;
    }
    
    fetch('/cart/change.js', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: itemKey,
        quantity: 0
      })
    })
    .then(response => response.json())
    .then(data => {
      // Refresh the page to show updated cart
      window.location.reload();
    })
    .catch(error => {
      console.error('Error removing item:', error);
      alert('There was an error removing the item from your cart.');
    });
  }
  
  // Function to clear all trade-in items
  function clearAllTradeIns() {
    if (!confirm('Are you sure you want to remove all trade-in items?')) {
      return;
    }
    
    // Get all trade-in item keys
    const tradeInRows = document.querySelectorAll('.trade-in-cart-row');
    const updates = {};
    
    tradeInRows.forEach(row => {
      const itemKey = row.getAttribute('data-item-id');
      if (itemKey) {
        updates[itemKey] = 0;
      }
    });
    
    // Only proceed if we found items to remove
    if (Object.keys(updates).length === 0) {
      alert('No trade-in items found to remove.');
      return;
    }
    
    fetch('/cart/update.js', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ updates: updates })
    })
    .then(response => response.json())
    .then(data => {
      // Refresh the page to show updated cart
      window.location.reload();
    })
    .catch(error => {
      console.error('Error clearing items:', error);
      alert('There was an error removing the items from your cart.');
    });
  }
  
  
  // Function to proceed with trade-in
  function proceedWithTradeIn() {
    // Redirect to the trade-in checkout page
    window.location.href = '/pages/trade-in-checkout';
  }
});