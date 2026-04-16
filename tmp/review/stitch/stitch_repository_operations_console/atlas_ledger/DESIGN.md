# Design System Strategy: The Editorial Intelligence Desk

## 1. Overview & Creative North Star
**Creative North Star: The Industrial Ledger**
This design system moves away from the ephemeral nature of modern SaaS and toward the permanence of a high-trust workshop ledger. It is designed for "autonomous repository maintenance"—a task requiring absolute clarity, historical weight, and technical precision. 

The experience is anchored in **The Industrial Ledger** aesthetic: a digital environment that feels like an intelligence officer’s desk. It rejects "template-style" layouts in favor of intentional density, utilizing asymmetrical groupings and tonal stacking to convey high-signal data without sterility. We prioritize "ink on parchment" legibility over flashy animations, ensuring every interaction feels as deliberate as a physical stamp on a work order.

---

## 2. Colors
Our palette is a disciplined collection of natural, aged materials. We use these not as mere accents, but as the structural foundation of the interface.

*   **Parchment & Ink (Base):** The `surface` (`#fef9eb`) and `on_surface` (`#1d1c13`) tokens form our primary contrast. This is not a "white" background; it is a warm, tactile base.
*   **Oxidized Copper (Tertiary):** Used for analytical sections and metadata backgrounds via `tertiary_container` (`#545c28`).
*   **Iron & Clay (Primary/Secondary):** `primary` (`#314356`) provides the "Iron" industrial blue for high-level controls, while `secondary` (`#944925`) acts as the "Clay" signal for active work states.

### The "No-Line" Rule
Prohibit 1px solid borders for sectioning. Structural boundaries must be defined solely through background color shifts. A `surface_container_low` section sitting on a `surface` background creates a clear, sophisticated division without the "boxiness" of standard UI.

### Surface Hierarchy & Nesting
Treat the UI as a series of stacked physical layers.
*   **Base Layer:** `background` / `surface`
*   **Nested Containers:** Place `surface_container_low` for secondary sidebars and `surface_container_highest` for the active focus area. 
*   **Work Orders:** Use `surface_container_lowest` (`#ffffff`) for cards to create a "bleached paper" look that pops against the parchment background.

### The Glass & Gradient Rule
For floating utility bars or intelligence overlays, use Glassmorphism. Apply `surface_variant` with a 70% opacity and a `20px` backdrop-blur. To provide a "professional polish," use a subtle linear gradient on primary CTAs moving from `primary` to `primary_container`. This adds a slight metallic sheen reminiscent of industrial equipment.

---

## 3. Typography
The system uses a high-contrast typographic pairing to balance editorial authority with technical rigor.

*   **Editorial Authority (Newsreader):** All `display` and `headline` levels use this transitional serif. Large, bold, and authoritative, it evokes a published ledger. It signals that the data presented is "final" and "trusted."
*   **Technical Rigor (Work Sans & Inter):** `title` and `body` levels use **Work Sans** for its balanced, industrial feel. **Inter** is reserved for `labels` and micro-data where maximum legibility at small sizes is required.
*   **Hierarchy:** Use `display-md` for repository titles to establish a "front-page news" importance. All data tables and repository paths must use `label-md` in semi-bold to maintain a "technical ledger" density.

---

## 4. Elevation & Depth
Elevation is achieved through **Tonal Layering**, mimicking the way sheets of paper create shadows and depth on a physical desk.

*   **The Layering Principle:** Avoid elevation shadows where possible. Instead, stack `surface_container_lowest` cards on a `surface_dim` workspace. The contrast in warmth and brightness provides a "natural lift."
*   **Ambient Shadows:** For floating modals or "Intelligence Desk" instruments, use a wide, diffused shadow. 
    *   *Spec:* `offset: 0 12px`, `blur: 32px`, `color: rgba(29, 28, 19, 0.06)`. This uses a tinted version of the `on_surface` color for a natural, ambient light effect.
*   **The Ghost Border:** If a separator is required for accessibility, use the `outline_variant` token at **15% opacity**. It should be felt, not seen.

---

## 5. Components

### Work Order Cards
Cards must not have visible borders. Use `surface_container_lowest` with a slightly tighter `roundedness-md` (`0.375rem`). Content should be dense, using `label-sm` for metadata and `title-sm` for headers.

### Ledger Data Tables
*   **Header:** `surface_container_high` background, `Newsreader` bold text.
*   **Rows:** Alternating `surface` and `surface_container_low` backgrounds. No horizontal dividers.
*   **Density:** Use `body-sm` for row data to maximize signal.

### Primary "Stamp" Buttons
Buttons are rectangular and heavy. 
*   **Primary:** `primary` background with `on_primary` text. `0.25rem` corner radius.
*   **Hover:** Shift to `primary_container`. 
*   **States:** Use a "pressed" state that shifts the background to `secondary` (Clay) to indicate an active process.

### Operational Chips
Use `tertiary_container` (Oxidized Copper) for status chips. They should be "restrained sans-serif" (`label-sm`) and avoid pill shapes; use `roundedness-sm` to maintain the industrial feel.

### Input Fields
Avoid the "floating label" trend. Use a persistent `label-md` in `on_surface_variant` above the field. The input background should be `surface_container_highest` with a `Ghost Border` focus state.

---

## 6. Do's and Don'ts

### Do
*   **DO** embrace density. Information is the priority; white space should be used for grouping, not just "breathing room."
*   **DO** use the `Newsreader` serif for any text that represents a "human-readable" decision or high-level summary.
*   **DO** utilize the "Oxidized Copper" (`tertiary`) colors for automated/autonomous log entries to distinguish them from human-led operations.

### Don't
*   **DON'T** use 100% black. All "ink" must be the `on_surface` (`#1d1c13`) to maintain the parchment-and-ink warmth.
*   **DON'T** use rounded corners above `0.75rem` (xl). This is an industrial desk, not a consumer social app; soft, bubbly shapes break the "High-Trust" persona.
*   **DON'T** use vibrant neon signal colors. If an error occurs, use the muted, earthy `error` (`#ba1a1a`) which feels like a red ink stamp.

---

## 7. Interaction Pattern: The Desk Instrument
Treat floating menus and tooltips as "Desk Instruments." They should appear to be physically placed on top of the ledger. This means using `surface_dim` for the background of tooltips with a sharp `surface_container_highest` edge, ensuring they feel heavier and more "mechanical" than standard tooltips.