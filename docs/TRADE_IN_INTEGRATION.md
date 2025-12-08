# Trade-In Integration: Theme ↔ Cardforum App

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           CUSTOMER JOURNEY                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐    ┌───────────┐ │
│  │ /pages/      │    │ /apps/       │    │ /pages/      │    │ /apps/    │ │
│  │ trade-in     │───▶│ trade-in/    │───▶│ trade-in-    │───▶│ trade-in/ │ │
│  │ (Landing)    │    │ submissions  │    │ track        │    │ track     │ │
│  └──────────────┘    └──────────────┘    └──────────────┘    └───────────┘ │
│        │                    │                   │                  │        │
│        ▼                    ▼                   ▼                  ▼        │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐    ┌───────────┐ │
│  │ Theme:       │    │ App:         │    │ Theme:       │    │ App:      │ │
│  │ trade-in-app │    │ Cardforum    │    │ track page   │    │ Track API │ │
│  │ .liquid      │    │ PostgreSQL   │    │ .liquid      │    │           │ │
│  └──────────────┘    └──────────────┘    └──────────────┘    └───────────┘ │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## API Endpoints (via Shopify App Proxy)

All endpoints are accessed via `/apps/trade-in/...`
The App Proxy routes to: `https://cardforum.vercel.app/api/storefront/...`

### Card Search
```
GET /apps/trade-in/cards/search?q=QUERY&limit=20&set=OP03

Response:
{
  "results": [{
    "id": "OP03-OP01-051-sp",
    "cardName": "Monkey D. Luffy",
    "setName": "OP03",
    "setCode": "OP03",
    "cardNumber": "051",
    "variant": "sp",
    "rarity": "SR",
    "imageUrl": "/card-images/...",
    "prices": {
      "NM": 4760,   // in pence
      "LP": 3740,
      "MP": 2720,
      "HP": 1700,
      "DMG": 680
    }
  }],
  "count": 1,
  "query": "luffy"
}
```

### Card Browse
```
GET /apps/trade-in/cards/browse?page=1&limit=12&set=OP03

Response:
{
  "cards": [...],
  "totalPages": 5,
  "currentPage": 1,
  "totalCards": 60
}
```

### Card Sets
```
GET /apps/trade-in/cards/sets

Response:
{
  "sets": [
    { "code": "OP01", "name": "Romance Dawn", "cardCount": 121 },
    { "code": "OP02", "name": "Paramount War", "cardCount": 121 },
    ...
  ]
}
```

### Create Submission
```
POST /apps/trade-in/submissions
Content-Type: application/json

{
  "email": "customer@example.com",
  "firstName": "John",
  "lastName": "Doe",
  "payoutType": "STORE_CREDIT",  // or "BANK", "PAYPAL"
  "items": [{
    "cardPriceId": "OP03-OP01-051-sp",  // Optional, for linking
    "cardName": "Monkey D. Luffy",
    "setName": "OP03",
    "setCode": "OP03",
    "variant": "sp",
    "quantity": 1,
    "conditionClaimed": "NM"  // NM, LP, MP, HP, DMG
  }]
}

Response (201):
{
  "success": true,
  "submission": {
    "id": "clx...",
    "submissionNumber": "TI-2024-ABC123",
    "status": "SUBMITTED",
    "payoutType": "STORE_CREDIT",
    "quotedTotal": 5236,  // pence
    "bonusAmount": 523,   // 10% bonus
    "items": [...],
    "createdAt": "2024-12-08T..."
  }
}
```

### Track Submission
```
GET /apps/trade-in/track?number=TI-2024-ABC123

Response:
{
  "found": true,
  "submission": {
    "submissionNumber": "TI-2024-ABC123",
    "status": "GRADING",
    "statusLabel": "Grading",
    "statusDescription": "Our team is verifying your cards",
    "payoutType": "STORE_CREDIT",
    "quotedTotal": 5236,
    "finalTotal": null,
    "bonusAmount": 523,
    "itemCount": 3,
    "createdAt": "...",
    "submittedAt": "...",
    "receivedAt": "...",
    ...
  },
  "timeline": [
    { "status": "SUBMITTED", "label": "Submitted", "isComplete": true, "isCurrent": false },
    { "status": "IN_TRANSIT", "label": "In Transit", "isComplete": true, "isCurrent": false },
    { "status": "RECEIVED", "label": "Received", "isComplete": true, "isCurrent": false },
    { "status": "GRADING", "label": "Grading", "isComplete": true, "isCurrent": true },
    ...
  ],
  "items": [
    {
      "cardName": "Monkey D. Luffy",
      "setCode": "OP03",
      "quantity": 1,
      "conditionClaimed": "NM",
      "conditionActual": null,
      "quotedPrice": 4760,
      "finalPrice": null,
      "status": "PENDING"
    }
  ],
  "gradingResults": null  // Only populated after grading
}
```

### Customer Submissions List (Requires Login)
```
GET /apps/trade-in/submissions?limit=20&offset=0

Response:
{
  "submissions": [{
    "id": "clx...",
    "submissionNumber": "TI-2024-ABC123",
    "status": "GRADING",
    "payoutType": "STORE_CREDIT",
    "quotedTotal": 5236,
    "finalTotal": null,
    "itemCount": 3,
    "createdAt": "...",
    "submittedAt": "..."
  }],
  "total": 5,
  "limit": 20,
  "offset": 0
}
```

### Packing Slip (PDF)
```
GET /apps/trade-in/packing-slip/TI-2024-ABC123

Response: HTML page with printable packing slip
```

### Shipping Instructions
```
GET /apps/trade-in/shipping-instructions/TI-2024-ABC123

Response: HTML page with shipping instructions
```

---

## Submission Status Flow

```
DRAFT ──▶ SUBMITTED ──▶ IN_TRANSIT ──▶ RECEIVED ──▶ GRADING ──▶ PENDING_APPROVAL
                                                                        │
                                                    ┌───────────────────┤
                                                    ▼                   ▼
                                               APPROVED ──────▶ COMPLETED
                                                    │
                                                    ▼
                                               CANCELLED / RETURNED
```

---

## Theme Files

### Pages
| Template | Purpose |
|----------|---------|
| `page.trade-in-app.liquid` | Main trade-in form with search/browse |
| `page.trade-in-track.liquid` | Track submission status (NEW) |
| `page.trade-in-cart.liquid` | View cart items |
| `page.trade-in-checkout.liquid` | Checkout flow |
| `page.trade-in-confirmation.liquid` | Success page |

### Assets
| File | Purpose |
|------|---------|
| `trade-in-app.js` | Main application logic |
| `trade-in-app.css` | Full styling system |
| `trade-in-track.js` | Tracking page logic (NEW) |
| `trade-in-track.css` | Tracking page styles (NEW) |

---

## Condition Multipliers

Applied to base trade-in price:

| Condition | Multiplier | Example (£100 base) |
|-----------|------------|---------------------|
| Near Mint (NM) | 70% | £70.00 |
| Lightly Played (LP) | 55% | £55.00 |
| Moderately Played (MP) | 40% | £40.00 |
| Heavily Played (HP) | 25% | £25.00 |
| Damaged (DMG) | 10% | £10.00 |

---

## Store Credit Bonus

When customer selects Store Credit payout:
- **10% bonus** on final amount
- Example: £50 trade-in = £55 store credit

---

## Minimum Requirements

- Minimum submission value: **£5.00** (500 pence)
- Maximum items per submission: **100**
- Maximum quantity per item: **99**

---

## Shopify App Proxy Configuration

In `shopify.app.toml`:
```toml
[app_proxy]
url = "/api/storefront"
prefix = "apps"
subpath = "trade-in"
```

This routes:
- `https://{shop}.myshopify.com/apps/trade-in/*`
- To: `https://cardforum.vercel.app/api/storefront/*`

---

## Customer Account Integration

For logged-in customers:
1. Shopify passes `logged_in_customer_id` via App Proxy
2. App looks up internal customer by Shopify ID
3. Customer can view their submission history
4. Past submissions linked to their account

---

## Error Handling

All API errors return:
```json
{
  "error": "error_code",
  "message": "Human readable message",
  "details": ["Optional", "array", "of", "details"]
}
```

Common error codes:
- `validation_error` - Invalid input
- `unauthorized` - Missing/invalid signature
- `not_found` - Resource not found
- `creation_failed` - Could not create submission
