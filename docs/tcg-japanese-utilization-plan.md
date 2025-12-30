# TCG + Japanese Design System Utilization Plan

> **Project:** Cambridge TCG Shopify Theme
> **Phase:** Implementation & Utilization
> **Date:** December 30, 2025
> **Status:** In Progress

---

## Table of Contents

1. [Overview](#overview)
2. [Implementation Roadmap](#implementation-roadmap)
3. [Global CSS Integration](#global-css-integration)
4. [Tier Icon Assets](#tier-icon-assets)
5. [Homepage Enhancements](#homepage-enhancements)
6. [Brand Page Theming](#brand-page-theming)
7. [Membership Page Enhancement](#membership-page-enhancement)
8. [Authenticity Badges](#authenticity-badges)
9. [Progress Tracking](#progress-tracking)

---

## Overview

This document tracks the utilization of the Japanese TCG design foundation across the Cambridge TCG Shopify theme. The goal is to apply the design system consistently to create a premium, Japan-inspired shopping experience for trading card collectors.

### Design Assets Available

| Asset | File | Purpose |
|-------|------|---------|
| Japanese Design CSS | `assets/japanese-design.css` | Patterns, badges, typography |
| TCG Rarity Styles | `assets/tcg-rarity-styles.css` | Membership tier styling |
| Multicolumn Card CSS | `assets/component-multicolumn-card.css` | Tier icon animations |
| Color Schemes | `config/settings_data.json` | Brand & tier color palettes |

### Color Scheme Reference

| Scheme | Purpose | Key Colors |
|--------|---------|------------|
| scheme-1 | Base TCG | Japanese Carmine (#c41e3a), Ink Black (#1a1a1a) |
| scheme-4 | One Piece | Warm cream (#fff8f0), Red buttons |
| scheme-6 | Gold/SR Tier | Gold tints (#fef9c3), Amber accents |
| scheme-8 | Pokemon | Sky blue (#f5f8ff), Pokemon blue buttons |
| scheme-inverse | Premium Tier | Dark (#1a1a1a), Gold accents (#d4af37) |

---

## Implementation Roadmap

### Phase 1: Global Integration
- [x] Create japanese-design.css
- [x] Create tcg-rarity-styles.css
- [x] Update color schemes
- [ ] Load CSS in theme.liquid
- [ ] Create tier icon SVG assets

### Phase 2: Homepage Application
- [ ] Add Asanoha pattern to hero section
- [ ] Apply Seigaiha to One Piece collection list
- [ ] Enhance trust signals with Hanko styling
- [ ] Update scrolling promotion bar

### Phase 3: Brand Page Theming
- [ ] Apply scheme-4 to One Piece page
- [ ] Apply scheme-8 to Pokemon page
- [ ] Add brand-specific patterns

### Phase 4: Membership Enhancement
- [ ] Apply tier styling to membership cards
- [ ] Add tier icon SVGs
- [ ] Implement shimmer/glow effects

### Phase 5: Trust & Authenticity
- [ ] Create Japan import badge snippet
- [ ] Add authenticity Hanko badges
- [ ] Enhance product badges

---

## Global CSS Integration

### theme.liquid Modification

**Location:** `layout/theme.liquid` (Line 61)

**Current:**
```liquid
echo 'theme.css' | asset_url | stylesheet_tag: preload: true
```

**Updated:**
```liquid
echo 'theme.css' | asset_url | stylesheet_tag: preload: true
echo 'japanese-design.css' | asset_url | stylesheet_tag: preload: true
echo 'tcg-rarity-styles.css' | asset_url | stylesheet_tag: preload: true
```

---

## Tier Icon Assets

### SVG Icons Required

Create minimalist icons inspired by Japanese Kamon (family crests) for each tier:

#### Basic Tier Icon (`icon-tier-basic.svg`)
- Simple circle design
- Represents entry-level membership
- Color: Neutral gray (#6b7280)

#### SR Tier Icon (`icon-tier-sr.svg`)
- Star/diamond design
- Represents "Super Rare" achievement
- Color: Amber/gold (#d97706)

#### SSR Tier Icon (`icon-tier-ssr.svg`)
- Multi-pointed star with inner detail
- Represents "Super Super Rare" prestige
- Color: Gold (#f59e0b)

#### Premium Tier Icon (`icon-tier-premium.svg`)
- Crown or crest design
- Represents top-tier membership
- Color: Gold on dark (#d4af37)

---

## Homepage Enhancements

### Section-by-Section Application

#### 1. Slideshow (Hero)
- Add subtle Asanoha pattern overlay
- Pattern opacity: 0.02 (very subtle)
- Maintains image focus while adding Japanese texture

#### 2. Feature List (Trust Signals)
- Keep current clean design
- Consider Hanko-style badges for future enhancement

#### 3. One Piece Collection List
- Apply `seigaiha-pattern` class (ocean waves theme)
- Use scheme-4 (warm cream background)
- Adds thematic relevance to pirate/ocean content

#### 4. Pokemon Collection List
- Use scheme-8 (sky blue tones)
- Clean, modern aesthetic matching Pokemon brand

#### 5. Scrolling Promotion Bar
- Add subtle pattern background
- Maintain readability with low opacity

#### 6. Featured Products Tab
- Apply scheme-4 for One Piece products
- Clean presentation for card visibility

#### 7. Testimonials
- Use washi paper texture background
- Adds premium, handcrafted feel

#### 8. Membership CTA
- Apply gold scheme (scheme-6)
- Emphasizes premium value proposition

---

## Brand Page Theming

### One Piece Page (`page.one-piece-card-game.json`)

**Theme Application:**
- Primary color scheme: scheme-4 (One Piece)
- Pattern: Seigaiha (ocean waves)
- Accent color: Luffy's Hat Red (#c41e3a)

**Sections to Update:**
- Hero/Banner: Ocean wave pattern overlay
- Collection grid: Warm cream background
- CTA buttons: Red primary color

### Pokemon Page (`page.pokemon-card-game.json`)

**Theme Application:**
- Primary color scheme: scheme-8 (Pokemon)
- Background: Light sky blue (#f5f8ff)
- Accent color: Pokemon Blue (#3d7dca)

**Sections to Update:**
- Hero/Banner: Clean, modern look
- Collection grid: Light blue tints
- CTA buttons: Pokemon blue

---

## Membership Page Enhancement

### Current Structure
```
rich_text_QNyxMC - Header introduction
multicolumn_ff6GU6 - 4 membership tiers (Basic, SR, SSR, Premium)
layered_images_with_text_CXWtQB - Mystery Pack Raffle
image_with_text_HKi796 - Raffle Benefits
membership_explore - Explore More section
```

### Tier Card Enhancements

#### Basic Tier
- Icon: `icon-tier-basic`
- Background: Light gray gradient
- Border: Subtle gray
- No special effects

#### SR Tier
- Icon: `icon-tier-sr`
- Background: Gold tint gradient
- Border: Amber (#fbbf24)
- Subtle glow on hover

#### SSR Tier
- Icon: `icon-tier-ssr`
- Background: Rich gold gradient
- Border: Gold (#f59e0b)
- Animated shimmer effect
- Enhanced glow on hover

#### Premium Tier
- Icon: `icon-tier-premium`
- Background: Dark luxury gradient
- Border: Gold (#d4af37)
- Holographic animation
- Pulsing gold glow on hover

---

## Authenticity Badges

### Japan Import Badge Snippet

**File:** `snippets/japan-badge.liquid`

**Usage:**
```liquid
{% render 'japan-badge', style: 'default' %}
{% render 'japan-badge', style: 'compact' %}
{% render 'japan-badge', style: 'hanko' %}
```

**Styles:**
1. **Default** - Full badge with "Imported from Japan" text
2. **Compact** - Small icon-only version
3. **Hanko** - Red seal stamp style for authenticity

### Placement Recommendations
- Product cards: Compact badge
- Product page: Full badge near price
- Cart drawer: Hanko style next to items
- Footer: Trust signal row

---

## Progress Tracking

### Completed Items - Phase 1 (Foundation)
- [x] Create japanese-design.css (445 lines)
- [x] Create tcg-rarity-styles.css (complete tier styling)
- [x] Update component-multicolumn-card.css (tier icons)
- [x] Update settings_data.json (12 color schemes)
- [x] Create foundation plan document
- [x] Create Sleek theme guide

### Completed Items - Phase 2 (Utilization)
- [x] Load CSS files in theme.liquid
- [x] Create tier icon SVG assets (Basic, SR, SSR, Premium)
- [x] Create service icon SVGs (Trade-In, FAQ, About, Cart)
- [x] Apply brand schemes to homepage sections
- [x] One Piece collection list → scheme-4 (warm cream, red accents)
- [x] Pokemon collection list → scheme-8 (sky blue, Pokemon blue)
- [x] Membership CTA → scheme-6 (gold tier styling)
- [x] Create japan-badge.liquid snippet (5 badge styles)

### Pending
- [ ] Apply patterns to product pages
- [ ] Announcement bar Japanese styling

### Future Enhancements
- [ ] Holographic product card effects
- [ ] Animated rarity indicators
- [ ] Japanese language toggle styling
- [ ] Mobile-specific pattern adjustments

---

## Technical Notes

### CSS Class Usage

**Japanese Patterns:**
```html
<div class="asanoha-pattern">Content with hemp leaf pattern</div>
<div class="seigaiha-pattern">Content with wave pattern</div>
<div class="washi-texture">Content with paper texture</div>
```

**Hanko Badges:**
```html
<span class="hanko-stamp">Authentic</span>
<span class="hanko-stamp hanko-stamp--gold">Premium</span>
```

**Rarity Borders:**
```html
<div class="rarity-border--sr">SR content</div>
<div class="rarity-border--ssr">SSR content</div>
<div class="rarity-border--premium">Premium content</div>
```

**Tier Cards:**
```html
<div class="membership-tier-card tier-basic">...</div>
<div class="membership-tier-card tier-sr">...</div>
<div class="membership-tier-card tier-ssr">...</div>
<div class="membership-tier-card tier-premium">...</div>
```

### Color Scheme Application

In Shopify sections, apply schemes via settings:
```json
"settings": {
  "color_scheme": "scheme-4"
}
```

Or in Liquid templates:
```liquid
<div class="color-{{ section.settings.color_scheme }}">
```

---

## File Change Log

| Date | File | Change |
|------|------|--------|
| 2025-12-30 | assets/japanese-design.css | Created |
| 2025-12-30 | assets/tcg-rarity-styles.css | Created |
| 2025-12-30 | assets/component-multicolumn-card.css | Enhanced |
| 2025-12-30 | config/settings_data.json | Updated schemes |
| 2025-12-30 | docs/tcg-japanese-foundation-plan.md | Created |
| 2025-12-30 | docs/sleek-theme-guide.md | Created |
| 2025-12-30 | layout/theme.liquid | Pending CSS load |
| 2025-12-30 | assets/icon-tier-*.svg | Pending creation |

---

*This document will be updated as implementation progresses.*
