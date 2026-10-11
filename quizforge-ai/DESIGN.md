---
name: Academic Precision
colors:
  surface: '#f7f9fb'
  surface-dim: '#d8dadc'
  surface-bright: '#f7f9fb'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f2f4f6'
  surface-container: '#eceef0'
  surface-container-high: '#e6e8ea'
  surface-container-highest: '#e0e3e5'
  on-surface: '#191c1e'
  on-surface-variant: '#474556'
  inverse-surface: '#2d3133'
  inverse-on-surface: '#eff1f3'
  outline: '#787588'
  outline-variant: '#c8c4d9'
  surface-tint: '#5236f8'
  primary: '#3f15e8'
  on-primary: '#ffffff'
  primary-container: '#5940ff'
  on-primary-container: '#e4e0ff'
  inverse-primary: '#c5c0ff'
  secondary: '#565e74'
  on-secondary: '#ffffff'
  secondary-container: '#dae2fd'
  on-secondary-container: '#5c647a'
  tertiary: '#3e4e64'
  on-tertiary: '#ffffff'
  tertiary-container: '#56667d'
  on-tertiary-container: '#d4e4ff'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#e4dfff'
  primary-fixed-dim: '#c5c0ff'
  on-primary-fixed: '#140067'
  on-primary-fixed-variant: '#3800e0'
  secondary-fixed: '#dae2fd'
  secondary-fixed-dim: '#bec6e0'
  on-secondary-fixed: '#131b2e'
  on-secondary-fixed-variant: '#3f465c'
  tertiary-fixed: '#d3e4fe'
  tertiary-fixed-dim: '#b7c8e1'
  on-tertiary-fixed: '#0b1c30'
  on-tertiary-fixed-variant: '#38485d'
  background: '#f7f9fb'
  on-background: '#191c1e'
  surface-variant: '#e0e3e5'
typography:
  display:
    fontFamily: Inter
    fontSize: 3rem
    fontWeight: '700'
    lineHeight: 3.5rem
    letterSpacing: -0.025em
  headline-lg:
    fontFamily: Inter
    fontSize: 2.25rem
    fontWeight: '700'
    lineHeight: 2.75rem
    letterSpacing: -0.02em
  headline-lg-mobile:
    fontFamily: Inter
    fontSize: 1.75rem
    fontWeight: '700'
    lineHeight: 2.25rem
    letterSpacing: -0.015em
  headline-md:
    fontFamily: Inter
    fontSize: 1.5rem
    fontWeight: '600'
    lineHeight: 2rem
    letterSpacing: -0.015em
  headline-sm:
    fontFamily: Inter
    fontSize: 1.25rem
    fontWeight: '600'
    lineHeight: 1.75rem
    letterSpacing: -0.01em
  title-md:
    fontFamily: Inter
    fontSize: 1.125rem
    fontWeight: '600'
    lineHeight: 1.5rem
    letterSpacing: -0.005em
  body-lg:
    fontFamily: Inter
    fontSize: 1.125rem
    fontWeight: '400'
    lineHeight: 1.75rem
    letterSpacing: '0'
  body-md:
    fontFamily: Inter
    fontSize: 1rem
    fontWeight: '400'
    lineHeight: 1.5rem
    letterSpacing: '0'
  body-sm:
    fontFamily: Inter
    fontSize: 0.875rem
    fontWeight: '400'
    lineHeight: 1.25rem
    letterSpacing: '0'
  label-md:
    fontFamily: Inter
    fontSize: 0.875rem
    fontWeight: '500'
    lineHeight: 1.25rem
    letterSpacing: 0.01em
  label-sm:
    fontFamily: Inter
    fontSize: 0.75rem
    fontWeight: '600'
    lineHeight: 1rem
    letterSpacing: 0.025em
  code:
    fontFamily: Inter
    fontSize: 0.875rem
    fontWeight: '400'
    lineHeight: 1.25rem
    letterSpacing: '0'
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  gutter: 1.5rem
  gutter-mobile: 1rem
  margin: 2rem
  margin-mobile: 1rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2.5rem
---

## Brand & Style

This design system establishes an authoritative, composed, and high-efficiency atmosphere tailored for automated assessment generation and curriculum design. The audience encompasses higher-education instructors, enterprise instructional designers, and advanced learners who require precision, structural clarity, and zero visual friction.

The aesthetic philosophy draws on **Corporate / Modern** principles infused with refined educational editorial styling:
- **Calm, High-Information Surfaces:** Dense assessment data, complex question trees, and generation pipelines are organized using rigid structural rhythm rather than decorative effects.
- **Cognitive Clarity:** Distraction is minimized by avoiding heavy gradients, glassmorphism, or saturated multi-hue systems. Visual hierarchy is established via contrast, deliberate typographic scale, and structural grouping.
- **Quiet Intelligence:** System feedback, AI-assisted generation states, and parsing workflows convey reliability through instant micro-responses, crisp lines, and deliberate focal color application.

## Layout & Spacing

The layout model relies on a structured, fluid-hybrid grid with an 8px base rhythmic scale. 

### Grid & Breakpoints
- **Desktop (≥ 1280px):** 12-column layout. Margin: `2rem`, Gutter: `1.5rem`. Ideal for split-pane interfaces (Source Document Viewer on the left, Generated Assessment Canvas on the right).
- **Tablet (768px – 1279px):** 8-column layout. Margin: `1.5rem`, Gutter: `1rem`. Secondary sidebars collapse into toggleable slide-over panels.
- **Mobile (< 768px):** 4-column layout. Margin: `1rem`, Gutter: `1rem`. Dual-pane generation flows convert to sequential, tab-navigated panels.

### Component Spacing Rhythm
- **Micro Spacing (`space-xs`, `space-sm`):** Internal component padding, icon-to-label spacing, and tag borders.
- **Structural Spacing (`space-md`, `space-lg`):** Gap between card fields, question answer stacks, and container interior padding.
- **Section Spacing (`space-xl`):** Major page groupings, step-wise wizard transitions, and module demarcations.

## Elevation & Depth

Visual hierarchy is maintained via tonal planes and low-contrast outlines rather than deep or ambient shadows. Glassmorphism, blurred overlays, and volumetric gradients are strictly prohibited.

### Tiers of Depth
- **Level 0 (Base Canvas):** `#F8FAFC`. Unbordered substrate.
- **Level 1 (Structural Cards & Panes):** `#FFFFFF` fill with a continuous 1px `#E2E8F0` hairline border. No shadow in resting state.
- **Level 2 (Hover / Active Interactive Containers):** `#FFFFFF` fill with 1px `#CBD5E1` border and a minimal, flat utility shadow: `0 1px 3px 0 rgba(15, 23, 42, 0.06), 0 1px 2px 0 rgba(15, 23, 42, 0.04)`.
- **Level 3 (Dropdown Menus & Popovers):** `#FFFFFF` fill with 1px `#E2E8F0` border and an ultra-clean floating shadow: `0 4px 6px -1px rgba(15, 23, 42, 0.08), 0 2px 4px -2px rgba(15, 23, 42, 0.04)`.
- **Level 4 (Modals & Parsing Overlays):** `#FFFFFF` elevated above a `#0F172A` backdrop dimmed to 40% opacity. Border: 1px `#E2E8F0`. Shadow: `0 10px 15px -3px rgba(15, 23, 42, 0.1), 0 4px 6px -4px rgba(15, 23, 42, 0.05)`.

## Components

### Buttons
- **Primary:** Background `#5940FF`, text `#FFFFFF`, border none. Hover state `#4A32E6`, pressed state `#3E26D1`. Focus ring: 2px `#5940FF` with a 2px offset.
- **Secondary:** Background `#FFFFFF`, text `#0F172A`, border 1px solid `#E2E8F0`. Hover state `#F8FAFC` with border `#CBD5E1`.
- **Tertiary / Ghost:** Background transparent, text `#64748B`. Hover state `#F1F5F9`, text `#0F172A`.

### Cards & Question Item Containers
- **Resting:** Background `#FFFFFF`, border 1px solid `#E2E8F0`, corner radius `0.75rem`, padding `1.5rem`.
- **Selected / Correct Mode:** Border 1.5px solid `#5940FF`, background `#FAF9FF`.
- **Review / Flagged Mode:** Border 1.5px solid `#F59E0B`, background `#FFFBEB`.

### Input Fields & Textareas
- **Resting:** Background `#FFFFFF`, border 1px solid `#E2E8F0`, text `#0F172A`, placeholder `#94A3B8`. Padding `0.625rem 0.875rem`, corner radius `0.5rem`.
- **Focus:** Border 1.5px solid `#5940FF`, outline none, box-shadow `0 0 0 1px #5940FF`.

### Selection Controls (Checkboxes & Radios)
- **Resting:** Width/height 1rem, border 1.5px solid `#CBD5E1`, background `#FFFFFF`.
- **Checked:** Background `#5940FF`, border `#5940FF`, check/dot icon pure white.

### Chips & Metadata Badges
- **General Badge:** Height 1.5rem, padding `0 0.5rem`, font `label-sm`, corner radius 9999px. Background `#F1F5F9`, text `#475569`.
- **AI-Confidence Tag:** Background `#EEF2FF`, text `#5940FF`, border 1px solid `#E0E7FF`.

### Document Upload & Ingestion Dropzone
- Border 1.5px dashed `#CBD5E1`, background `#F8FAFC`, corner radius `0.75rem`, padding `2.5rem 1.5rem`.
- **Drag Hover State:** Border color `#5940FF`, background `#FAF9FF`.
