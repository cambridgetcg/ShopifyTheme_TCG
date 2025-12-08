# Shopify Best Practices Implementation Progress

> Tracking implementation of best practices for Cambridge TCG theme

---

## Audit Summary (Completed)

### Accessibility Audit - PASS (8.5/10)
| Check | Status | Notes |
|-------|--------|-------|
| HTML lang attribute | PASS | Dynamic locale support |
| Viewport meta | PASS | No zoom restrictions |
| Skip links | PASS | Present and properly hidden |
| Focus styles | EXCELLENT | Uses :focus-visible with fallbacks |
| ARIA attributes | PASS | Good coverage on interactive elements |
| Form labels | PASS | Properly associated |
| Image alt text | PASS | Dynamic from product data |
| Touch targets | PASS | 48px default (configurable) |
| Color contrast | NEEDS TESTING | Uses CSS variables |

### JavaScript Audit - PASS (8/10)
| Check | Status | Notes |
|-------|--------|-------|
| Script defer/async | PASS | All external scripts deferred |
| Framework usage | EXCELLENT | Web Components, minimal jQuery |
| Global namespace | CONTROLLED | Organized under FoxTheme |
| Lazy loading | EXCELLENT | delayUntilInteraction patterns |
| Bundle size | GOOD | 57 modular files |

### Schema Markup Audit - NEEDS WORK (6/10)
| Schema Type | Status | Action Needed |
|-------------|--------|---------------|
| Product | PASS | Uses structured_data filter |
| Organization | FIX | Move to homepage only |
| WebSite | PASS | Homepage with SearchAction |
| Article | PASS | JSON-LD + microdata |
| BreadcrumbList | MISSING | Add to breadcrumbs.liquid |
| FAQPage | MISSING | Add to FAQ page |

### Image Optimization Audit - GOOD (7/10)
| Check | Status | Notes |
|-------|--------|-------|
| image_tag filter | GOOD | Main components use it |
| Lazy loading | EXCELLENT | Proper implementation |
| Width/height | GOOD | Via CSS variables |
| Preloading | GOOD | LCP images preloaded |
| Predictive search | FIX | Missing srcset/responsive |
| Swatch images | FIX | Using background-image |

### Liquid Performance Audit - GOOD (7/10)
| Issue | Severity | Files |
|-------|----------|-------|
| Filter chaining | Medium | mega-menu.liquid, menu-drawer-details.liquid |
| Unused assigns | Low | card-product.liquid (custom_tags) |
| Nested loops | Medium | mega-menu.liquid |
| Duplicate code | High | promo image concatenation |

### Theme Check Results
| Type | Count | Notes |
|------|-------|-------|
| Errors | 2 | Missing locale translations |
| Warnings | 1 | AssetPreload recommendation |
| Suggestions | 0 | - |

---

## Implementation Queue

### Priority 1: Schema Fixes
- [ ] Add BreadcrumbList schema to breadcrumbs.liquid
- [ ] Add FAQPage schema to collapsible-tabs.liquid or page.faq.json
- [ ] Move Organization schema to homepage only

### Priority 2: Image Fixes
- [ ] Fix predictive-search.liquid images (lines 97-105, 186-194)
- [ ] Consider swatch.liquid optimization

### Priority 3: Liquid Performance
- [ ] Remove unused custom_tags assign in card-product.liquid
- [ ] Extract promo image concatenation to shared snippet

### Priority 4: Translations
- [ ] Add missing translations to bg-BG.json
  - general.account.return_to_account
  - account.raffles.title

---

## Completed Implementations

### Phase 1 (Previous Session)
- [x] Fixed password.json typo ("lauch" → "launch")
- [x] Added testimonial authors to homepage
- [x] Enhanced slideshow content
- [x] Expanded scrolling promotions
- [x] Fixed product template placeholders
- [x] Removed empty CSS files
- [x] Added LCP image preload to theme.liquid
- [x] Integrated trade-in.css with CSS variables
- [x] Fixed collection card sizes (1:1 ratio)
- [x] Added strategic interlinking across pages

### Phase 2 (Current Session)
- [x] BreadcrumbList schema added to breadcrumbs.liquid
- [x] FAQPage schema added to collapsible-tabs.liquid
- [x] Organization schema restricted to homepage only
- [x] Predictive search images optimized with image_tag filter
- [x] Missing bg-BG.json translations added

---

## Files Modified

### This Session
| File | Change | Status |
|------|--------|--------|
| sections/breadcrumbs.liquid | Add BreadcrumbList JSON-LD schema | Done |
| sections/collapsible-tabs.liquid | Add FAQPage JSON-LD schema | Done |
| sections/header.liquid | Wrap Organization schema in homepage conditional | Done |
| snippets/predictive-search.liquid | Replace img tags with image_tag filter (responsive) | Done |
| locales/bg-BG.json | Add general.account.return_to_account, account.raffles | Done |

---

## Testing Checklist

After implementation:
- [ ] Run `shopify theme check` - target 0 errors
- [ ] Test Lighthouse Performance score (target ≥60)
- [ ] Test Lighthouse Accessibility score (target ≥90)
- [ ] Validate schema with Google Rich Results Test
- [ ] Test keyboard navigation
- [ ] Test on mobile devices

---

## Sources

- [Shopify Performance Best Practices](https://shopify.dev/docs/storefronts/themes/best-practices/performance)
- [Shopify Accessibility Best Practices](https://shopify.dev/docs/storefronts/themes/best-practices/accessibility)
- [Theme Check Documentation](https://shopify.dev/docs/themes/tools/theme-check)
- [Shopify Ecommerce Schema Guide](https://www.shopify.com/blog/ecommerce-schema)
