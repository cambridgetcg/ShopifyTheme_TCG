# Shopify Theme Best Practices Research (2025)

> Research compiled for Cambridge TCG theme optimization

---

## Table of Contents
1. [Performance Requirements](#performance-requirements)
2. [Accessibility Standards](#accessibility-standards)
3. [SEO & Schema Markup](#seo--schema-markup)
4. [Liquid Code Optimization](#liquid-code-optimization)
5. [JavaScript Best Practices](#javascript-best-practices)
6. [CSS Best Practices](#css-best-practices)
7. [Image Optimization](#image-optimization)
8. [Theme Check Rules](#theme-check-rules)

---

## Performance Requirements

### Shopify Theme Store Minimums
- **Lighthouse Performance Score**: ≥60 average across home, product, and collection pages
- **JavaScript Bundle**: ≤16 KB minified
- **Core Web Vitals Targets**:
  - LCP (Largest Contentful Paint): <2.5s
  - FCP (First Contentful Paint): <1.8s
  - CLS (Cumulative Layout Shift): <0.1
  - Speed Index: <3s

### Key Statistics
- 0.1s speed improvement = 8.4% conversion increase (Deloitte)
- 1s delay = 7% conversion reduction (Google)
- 83% of themes have render-blocking Liquid adding 2-4s load time

**Sources:**
- [Shopify Performance Best Practices](https://shopify.dev/docs/storefronts/themes/best-practices/performance)
- [TinyIMG Fastest Themes](https://tiny-img.com/best-shopify-themes/fastest-themes/)

---

## Accessibility Standards

### Requirements
- **Lighthouse Accessibility Score**: ≥90 for Theme Store
- **WCAG 2.1 Level AA** compliance (legal standard)
- **Valid HTML** (W3C validated)

### Keyboard Navigation
- [ ] Focus indicator visible on all interactive elements
- [ ] Tab/Shift+Tab navigation works logically
- [ ] No mouse-hover dependency for visibility
- [ ] Avoid positive `tabindex` and `autofocus`

### Page Structure
- [ ] `lang` attribute on `<html>` element
- [ ] Viewport zoom enabled (no `maximum-scale` or `user-scalable="no"`)
- [ ] Skip links for content access
- [ ] Semantic heading hierarchy (h1-h6 in order)
- [ ] `<nav>` elements with `aria-current` for current page

### Color & Contrast
- Small text (<24px): **4.5:1** contrast ratio
- Large text (≥24px or ≥18.5px bold): **3.0:1** ratio
- Icons/input borders: **3.0:1** ratio
- Color alone never conveys information

### Touch Targets
- Minimum **44x44 pixels** for primary controls

### Forms
- [ ] All inputs have associated `<label>` elements
- [ ] `required` attribute on mandatory fields
- [ ] `aria-describedby` linking inputs to error messages
- [ ] `aria-live` for dynamic notifications

### Media
- [ ] No autoplaying media with sound
- [ ] Closed captions for video
- [ ] Space key pauses/plays media
- [ ] Transcripts for audio content

**Sources:**
- [Shopify Accessibility Best Practices](https://shopify.dev/docs/storefronts/themes/best-practices/accessibility)
- [Shopify Theme Store Accessibility Requirements](https://www.shopify.com/partners/blog/theme-store-accessibility-requirements)
- [WCAG 2.2 Compliance Guide](https://www.allaccessible.org/blog/shopify-accessibility-wcag-compliance-guide)

---

## SEO & Schema Markup

### Recommended Schema Types
1. **Organization** (homepage only)
2. **Product** with nested Offer, AggregateRating, Review
3. **BreadcrumbList** for navigation
4. **FAQPage** for FAQ content
5. **CollectionPage** for collections
6. **Article** for blog posts

### Implementation Rules
- Use **JSON-LD format** (Google recommended)
- Use Shopify's `structured_data` filter where available
- Never duplicate schema (theme + app conflicts)
- Nest Offer inside Product, not separate
- Test with Google's Rich Results Test

### Common Issues
- Microdata instead of JSON-LD
- Incomplete/missing schema
- Duplicate schema from apps + theme
- Organization schema on every page (should be homepage only)

**Sources:**
- [GoFish Digital Shopify Structured Data Guide](https://gofishdigital.com/blog/shopify-structured-data-guide/)
- [Shopify Ecommerce Schema Guide](https://www.shopify.com/blog/ecommerce-schema)
- [Charle Agency Schema Implementation](https://www.charleagency.com/articles/add-schema-product-data-seo/)

---

## Liquid Code Optimization

### Performance Rules
1. **Perform calculations before loops**, not inside
2. **Avoid unnecessary filters** - each filter adds processing
3. **Use `{% liquid %}` tag** to combine multiple operations
4. **Cache repeated calculations** with `{% assign %}` or `{% capture %}`
5. **Limit nested loops** - each level multiplies iterations

### Code Organization
```
templates/   → Page templates
sections/    → Reusable sections
snippets/    → Small reusable components
assets/      → CSS, JS, images
```

### Common Issues
- Unused `{% assign %}` variables
- Excessive filter chaining
- Complex logic inside loops
- Unused snippet templates

**Sources:**
- [Scale Shopify Liquid Optimization](https://scaleshopify.com/2025/01/04/liquid-code-optimization-tips-for-shopify/)
- [Speed Boostr Advanced Optimization Guide](https://speedboostr.com/advanced-shopify-liquid-optimization-speed-up-your-theme-by-40-2025-guide/)

---

## JavaScript Best Practices

### Core Principles
- **JS not required for basic functionality**
- Use CSS instead of JS when possible
- JS is **progressive enhancement only**

### Requirements
- **≤16 KB** minified bundle size
- Always use `defer` or `async` attributes
- Wrap in IIFE to prevent namespace collisions
- No React/Angular/Vue/jQuery

### Loading Strategies
```html
<!-- Defer: Execute after HTML parsed -->
<script src="app.js" defer></script>

<!-- Async: Execute when ready (non-blocking) -->
<script src="analytics.js" async></script>
```

### Import on Interaction
Load heavy components only when needed:
```javascript
button.addEventListener('click', async () => {
  const module = await import('./heavy-module.js');
  module.init();
});
```

**Sources:**
- [Shopify Performance Best Practices](https://shopify.dev/docs/storefronts/themes/best-practices/performance)
- [Codersy Speed Optimization](https://www.codersy.com/blog/shopify-speed-optimization/10-essential-shopify-speed-optimization-techniques-for-2025)

---

## CSS Best Practices

### Loading
- **Maximum 2 preload hints** per template
- Only preload render-blocking stylesheets
- Use `media` queries for conditional loading:
```html
<link rel="stylesheet" href="print.css" media="print">
```

### Organization
- Use CSS custom properties for theming
- Avoid hardcoded colors (use variables)
- Remove empty/unused CSS files
- Consider critical CSS inline for above-the-fold

### Performance
- Minify all CSS
- Remove unused selectors
- Avoid complex selectors (>3 levels)

---

## Image Optimization

### Requirements
- Use `image_tag` filter for automatic srcset
- Specify `width` and `height` attributes
- Use `loading: 'lazy'` for below-fold images
- **Never lazy-load above-fold images**

### Format Priority
1. WebP (best compression)
2. AVIF (newer, smaller but less support)
3. JPEG/PNG (fallback)

### Preloading
```liquid
{%- if template == 'index' -%}
  <link rel="preload" as="image" href="{{ hero_image | image_url: width: 1500 }}" fetchpriority="high">
{%- endif -%}
```

---

## Theme Check Rules

### Critical Errors
- [ ] Liquid syntax errors
- [ ] JSON syntax errors
- [ ] Missing required templates
- [ ] Parser-blocking JavaScript
- [ ] Non-Shopify CDN assets

### Performance Warnings
- [ ] Missing width/height on images
- [ ] Unused assign variables
- [ ] Excessive snippet nesting
- [ ] Template length exceeds limit

### Style Issues
- [ ] Missing spaces in `{% %}` and `{{ }}`
- [ ] Deprecated tags/filters
- [ ] Unknown translation keys

### Running Theme Check
```bash
shopify theme check
```

**Sources:**
- [GitHub Shopify Theme Check](https://github.com/Shopify/theme-check)
- [Theme Check Documentation](https://shopify.dev/docs/themes/tools/theme-check)

---

## Quick Reference Checklist

### Before Launch
- [ ] Lighthouse Performance ≥60
- [ ] Lighthouse Accessibility ≥90
- [ ] No console errors
- [ ] All forms have labels
- [ ] Skip links work
- [ ] Keyboard navigation complete
- [ ] Touch targets ≥44px
- [ ] Schema validated
- [ ] Images optimized
- [ ] JS deferred/async
- [ ] No unused CSS/JS

### Monitoring
- Run Lighthouse monthly
- Check Core Web Vitals in Search Console
- Monitor Theme Check in CI/CD
