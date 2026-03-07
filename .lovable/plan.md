

# Plan: Apply O2 Inc Brand Identity

## Brand Book Summary
From the parsed PDF:
- **Primary color**: Vivid Green `#6BF169` (HSL ~119 85% 68%)
- **Secondary color**: Intense Gray `#494949` (HSL 0 0% 29%)
- **Fonts**: Tusker Grotesk (display) + Codec Pro (body) — both commercial/unavailable on Google Fonts, will use **Space Grotesk** (closest free geometric sans) for headings and keep **Inter** for body

## Changes

### 1. Color System (`src/index.css`)
Remap all CSS custom properties:
- `--primary`: blue → O2 green (#6BF169, ~119 85% 68%)
- `--accent`: keep green-aligned (same as primary for brand consistency)
- `--sidebar-primary`: → O2 green
- `--ring`: → O2 green
- Chart palette: update CaaS to green, keep others as complementary
- `--success` stays green (naturally aligned now)
- Background, card, border tones stay dark navy (works well with vivid green)

### 2. Font Addition (`src/index.css`)
Add Google Font import for **Space Grotesk** (closest to Tusker Grotesk). Apply to sidebar brand name and section headings.

### 3. Tailwind Config (`tailwind.config.ts`)
Add `'Space Grotesk'` to font families as `display` variant.

### 4. Sidebar Branding (`src/components/layout/AppSidebar.tsx`)
Update "O2 Inc" text to use Space Grotesk font and O2 green color for consistency with brand book logo styling.

### 5. Gradient Cards (`src/index.css`)
Update `.gradient-card` and `.kpi-card` hover border to use green instead of blue primary.

## Files Changed
| File | Change |
|------|--------|
| `src/index.css` | Update all `--primary`, `--accent`, `--ring`, `--sidebar-primary` to green; add Space Grotesk import |
| `tailwind.config.ts` | Add `display` font family with Space Grotesk |
| `src/components/layout/AppSidebar.tsx` | Apply display font to brand name |
| `src/components/layout/AppHeader.tsx` | Minor: scenario button active states use new green primary naturally |

