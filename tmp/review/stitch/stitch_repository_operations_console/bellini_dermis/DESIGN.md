```markdown
# Design System Strategy: Soft-Tech Late Modernism

## 1. Overview & Creative North Star: "The Synthetic Dermis"
This design system rejects the "flatness" of the modern web in favor of the tactile, sculptural industrialism of Mario Bellini’s 1970s era. Our Creative North Star is **The Synthetic Dermis**. 

We are not building pages; we are molding interfaces. The UI should feel as though it was vacuum-formed from a single sheet of high-end, matte-finish rubber. It is "Soft-Tech"—a marriage of high-precision computing and anthropomorphic warmth. We move away from rigid, boxy grids toward a "molded" layout where elements emerge from the background rather than sitting on top of it.

**Key Brand Pillars:**
*   **Monolithic Flow:** Seamless transitions between containers.
*   **Fleshy Tactility:** Buttons that invite a physical press, not just a click.
*   **Intellectual Contrast:** The tension between the romantic, transitional serif (`newsreader`) and the cold, efficient sans-serif (`manrope`).

---

## 2. Color & Surface Philosophy
The palette is rooted in the "New Domestic Landscape"—earthy, oxidized, and sophisticated. We use monochromatic depth to define structure rather than lines.

### The "No-Line" Rule
**Borders are strictly prohibited.** To section content, designers must use tonal shifts between `surface`, `surface-container-low`, and `surface-container-high`. A section change is a change in the material’s "density," not a stroke.

### Surface Hierarchy & Nesting
Treat the layout as a continuous molded surface. 
*   **Base Layer:** `surface` (#fff8f0) serves as the primary "floor."
*   **Recessed Areas:** Use `surface-dim` to create "wells" for secondary content.
*   **Elevated Formations:** Use `surface-container-lowest` (#ffffff) to create a subtle lift for primary cards.
*   **The "MAC" Signature:** Branding and high-impact accents should utilize `primary` (#854735) and `secondary` (#52625b) to mimic the "Control Room" buttons of 1973 Italian hardware.

### The "Glass & Gradient" Rule
To achieve the "molded rubber" look, use subtle inner shadows and soft gradients rather than flat fills. Use a linear gradient from `primary` to `primary-container` for CTAs to give them a convex, "dome" appearance.

---

## 3. Typography: The Editorial Tension
The typography reflects a dual personality: the humanistic scholar and the precision engineer.

*   **Display & Headlines (`newsreader`):** These must be used with generous leading and intentional asymmetry. Use `display-lg` to break the grid, overlapping onto different surface tiers to "stitch" the page together.
*   **Data & UI (`manrope`):** This is your functional workhorse. Use `label-md` for technical data points and `body-md` for instructional text. It should feel restrained, almost clinical, to balance the expressive headlines.
*   **Branding (MAC):** The letters 'MAC' should always be rendered in `headline-lg` newsreader, typeset with tight tracking to feel like a cast-metal emblem.

---

## 4. Elevation & Depth: Tonal Sculpting
Traditional shadows are too "digital." We use **Ambient Sculpting**.

*   **The Layering Principle:** Depth is achieved by "stacking" surface tokens. A `surface-container-highest` element placed on a `surface` background provides all the "lift" necessary.
*   **The Dome Effect:** For interactive elements, apply a 24px blur shadow using a 5% opacity of the `on-surface` color. This mimics the way light catches the edge of a rounded, molded plastic casing.
*   **Glassmorphism:** Use `surface-variant` with a 60% opacity and a `20px` backdrop-blur for floating navigation menus. This creates the illusion of translucent, frosted polycarbonate.
*   **The Ghost Border:** If extreme contrast is required for accessibility, use `outline-variant` at 15% opacity. Never use a 100% opaque stroke.

---

## 5. Components

### The "Dome" Button (Primary)
The core of the Soft-Tech aesthetic.
*   **Shape:** `rounded-lg` (2rem) to mimic molded thumb-rests.
*   **Color:** Gradient from `primary` to `primary-container`.
*   **Interaction:** On hover, the "dome" should appear to catch more light (shift to `primary-fixed-dim`). On press, use a subtle inner shadow to simulate the "fleshy" compression of rubber.

### Continuous Input Fields
*   **Style:** No boxes. Use a `surface-container-high` background with a `rounded-sm` bottom edge.
*   **Active State:** The background shifts to `surface-variant`. The cursor should be the `primary` color.
*   **Validation:** Errors use `error` text, but the field itself should never gain a red border—instead, use an `error-container` subtle background glow.

### Data Chips
*   **Style:** Small, pill-shaped (`rounded-full`) using `secondary-container`.
*   **Typography:** `label-sm` in `on-secondary-container`. These should look like labels printed directly onto a machine chassis.

### Segmented Controls
*   **Style:** A "well" created with `surface-dim`, where the active state is a `surface-container-lowest` "dome" that slides between options. No dividers between segments.

---

## 6. Do’s and Don’ts

### Do:
*   **Embrace Asymmetry:** Place headlines off-center to create a sense of organic, anthropomorphic movement.
*   **Use Generous Spacing:** Use the `xl` (3rem) corner radius for large layout containers to emphasize the "molded" feel.
*   **Think Monolithic:** Design components so they appear to grow out of the background, not sit "on" it.

### Don’t:
*   **Don't use 1px lines:** Ever. If you need a separator, use a 16px gap or a subtle shift in surface color.
*   **Don't use pure black:** Use `on-surface` (#1d1b17) for all text to maintain the soft, 1970s warmth.
*   **Don't use sharp corners:** Even the "none" radius should be avoided. Everything in the Soft-Tech world has been sanded down and smoothed by human touch.

---

## 7. Designer’s Note: The "MAC" Intent
When designing for 'MAC', remember that the 1970s Italian aesthetic was about making technology feel like a companion. The interface should feel "heavy," "expensive," and "silent." Every transition should be a slow, eased fade—never a snap. You are designing a piece of high-end furniture that happens to be a digital interface.```