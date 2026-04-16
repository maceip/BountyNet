# Design System Strategy: The Archive Laboratory

## 1. Overview & Creative North Star
**Creative North Star: "The Digital Curator"**

This design system rejects the ephemeral "Silicon Valley Startup" aesthetic in favor of something permanent, technical, and high-trust. It is a visual manifesto for the "Retro-Future Lab"—an environment where the tactile reliability of vintage instrumentation meets the modular complexity of modern information architecture. 

We break the "template" look by treating the interface as a physical console. We prioritize **intentional density**, where information is not hidden behind excessive white space but curated through sophisticated layering. Expect asymmetric layouts, overlapping "glass" panes, and a rigid adherence to technical precision. This is a space for deep work, not casual browsing.

---

## 2. Colors: The Oxidized Palette
The palette is a disciplined study in natural materials: clay, parchment, iron, ink, and the characterful patina of oxidized copper.

### Color Roles
- **Primary (`#4e6354`) & Primary Container (`#829987`):** Represents "Oxidized Copper." Use these for the core "mechanical" parts of the UI—headers, active states, and structural frames.
- **Secondary (`#665d4e`):** "Clay & Iron." Used for grounding elements and secondary utility controls.
- **Surface & Background (`#f8f9fc` to `#ffffff`):** "Parchment." The canvas for data.
- **Tertiary (`#a73a0e`):** "Signal Orange." A high-visibility alert color. This is the only "active" hue allowed for warnings or critical status updates. Use it sparingly to maintain its psychological impact.

### The "No-Line" Rule
**Explicit Instruction:** Traditional 1px solid borders for sectioning are prohibited. Boundaries must be defined solely through background color shifts. A `surface-container-low` section sitting on a `surface` background creates a clear, sophisticated edge without the visual noise of a line.

### Surface Hierarchy & Nesting
Treat the UI as a series of physical layers. 
- **Base Layer:** `surface`
- **In-set Sections:** `surface-container-low`
- **Interactive Cards:** `surface-container-lowest` (creates a "raised" paper effect)
- **Navigation/Controls:** `surface-container-high`

### The "Glass & Gradient" Rule
To achieve the "Lab Equipment" feel, use **Glassmorphism** for floating modular panels. Apply semi-transparent versions of `primary_container` or `surface_variant` with a `backdrop-blur` of 12px–20px. 
*Signature Polish:* Main CTAs should use a subtle vertical gradient from `primary` to `primary_container` to mimic the soft light catch on a physical plastic or metal button.

---

## 3. Typography: Technical Editorial
The typography system relies on the tension between a characterful serif and a rigid, high-legibility sans/mono.

- **Display & Headlines (Newsreader):** The "Editorial" voice. Used for high-level data labels, page titles, and narrative headers. The transitional serif conveys authority and history.
- **Titles, Body, & Labels (Space Grotesk):** The "Technical" voice. This font mimics the output of a high-end plotter or a modern IDE. Use it for all metrics, code snippets, and interface controls. 

**Hierarchy as Identity:**
- **Display-LG (3.5rem Newsreader):** Use for "hero" metrics or data points that demand gravitas.
- **Label-SM (0.6875rem Space Grotesk):** All-caps for "etched" hardware-style labels.

---

## 4. Elevation & Depth
Depth is achieved through **Tonal Layering** rather than structural lines or heavy shadows.

- **The Layering Principle:** Place a `surface-container-lowest` card on a `surface-container-low` section. This creates a "natural lift" as if sheets of heavy cardstock are stacked.
- **Ambient Shadows:** For floating dialogs or "glass" panes, use extra-diffused shadows. 
    - *Spec:* `box-shadow: 0 10px 30px rgba(25, 28, 30, 0.05);` 
    - The shadow color is a tinted version of `on-surface`, never pure black.
- **The "Ghost Border" Fallback:** If a border is required for accessibility, use `outline-variant` at **15% opacity**. This creates a "etched" look rather than a "drawn" look.
- **Subtle Glows:** Active modules should have a 1px inner-glow or a very soft outer-glow using `surface_tint` (20% opacity) to imply a powered-on state.

---

## 5. Components: Tactile Modules

### Buttons
- **Primary:** Gradient fill (`primary` to `primary_container`), `on-primary` text (Space Grotesk, Semi-bold). "Etched" look—no rounded corners larger than `DEFAULT` (0.25rem).
- **Secondary:** `surface-container-high` background with a `ghost border`.
- **Tertiary:** Text-only in `primary`, but wrapped in a `label-md` Space Grotesk style.

### Input Fields
- **Styling:** Inset appearance using `surface-container-highest` backgrounds. 
- **Active State:** Instead of a thick border change, use a `primary` subtle inner glow and a `Signal Orange` (Tertiary) cursor/caret.

### Cards & Lists
- **Rule:** Absolute prohibition of divider lines. 
- **Separation:** Use vertical white space from the spacing scale (e.g., 1.5rem between items) or alternating background shifts (`surface-container-low` vs `surface-container-lowest`).
- **Density:** Keep padding tight (e.g., `1rem`) to maintain the "modular IDE" feel.

### Additional Component: The "Status Monitor" (New)
A small, modular block used in corners of cards. It uses `Space Grotesk` (Label-SM) and a small circular glyph.
- **Active:** `primary` glow.
- **Warning:** `tertiary` (Signal Orange) pulse.

---

## 6. Do's and Don'ts

### Do:
- **Do** lean into asymmetry. If a panel is on the left, let the right side have more "breathing room" or a different container depth.
- **Do** use `Newsreader` for labels that feel like "Captions" in a vintage textbook.
- **Do** use "Glassmorphism" for any element that sits "above" the main workflow (e.g., search bars, command palettes).

### Don't:
- **Don't** use standard 100% opaque borders. It breaks the "etched" laboratory atmosphere.
- **Don't** use large border-radii. Stick to `DEFAULT` (0.25rem) or `none` to keep the technical, rigid feel.
- **Don't** use vibrant "Startup Blue" or "Success Green." Success is implied by the stable `primary` copper; alerts are strictly `Signal Orange`.
- **Don't** hide information. If the data is technical, show it. Density is a sign of power in this system.