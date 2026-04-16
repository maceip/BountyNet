```markdown
# Design System: The Synthetic Dermis

## 1. Overview & Creative North Star
The Creative North Star for this system is **"The Synthetic Dermis."** 

Inspired by the 1970s Italian industrial design of Mario Bellini (specifically the *Camaleonda* and the *Divisumma 18*), this system rejects the "flatness" of modern web design in favor of a tactile, anthropomorphic experience. We are not building a digital interface; we are crafting a continuous piece of molded, pressurized rubber. 

The design breaks the standard template through **Organic Late Modernism**. Layouts should feel extruded rather than layered. Elements should appear to emerge from a single, unified skin. We achieve this through "The Continuous Surface" philosophy: avoiding harsh breaks and instead using deep organic bevels and tonal shifts to imply function.

---

## 2. Colors: Living Clay
The palette is a monochromatic study in `primary` (#8c4d3a). It is warm, fleshy, and industrial.

### The "No-Line" Rule
**Explicit Instruction:** Designers are strictly prohibited from using 1px solid borders for sectioning or containment. Traditional lines represent a "cut" in the dermis. Instead, boundaries must be defined solely through:
- **Tonal Shifts:** Transitioning from `surface` (#fff8f5) to `surface-container-low` (#fdf1ec).
- **Extrusion:** Using gradients and shadows to suggest the surface is bending.

### Surface Hierarchy & Nesting
Treat the UI as a single sheet of molded material. 
- **The Base:** Use `surface` for the primary background.
- **The Recess:** Use `surface-container-high` (#f5e5de) for areas that should feel "pressed into" the machine, like input fields or sunken content areas.
- **The Protrusion:** Use `primary-container` (#ffdbd1) for elements that are "pushed out" toward the user.

### Signature Textures
To mimic the matte finish of 1970s injection-molded plastics, apply a subtle linear gradient to large interactive surfaces: `primary` (#8c4d3a) transitioning to `primary-dim` (#7e4230) at a 145-degree angle. This creates a "specular" highlight that feels tactile and premium.

---

## 3. Typography: Authoritative Clinicalism
The typography is a tension between the humanistic and the machine.

- **The Voice (Headlines):** Use **Newsreader**. This serif is bold and authoritative. It represents the "Editorial" layer—the human intent. Use `display-lg` for hero statements to create a high-contrast, magazine-like feel.
- **The Engine (Data & Labels):** Use **Inter**. It is sharp, clinical, and neutral. This represents the machine's output. 
- **Hierarchy:** Maintain a massive scale contrast. A `display-lg` headline should often sit adjacent to a `label-sm` data point to emphasize the "Soft-Tech" juxtaposition.

---

## 4. Elevation & Depth: The Molded Form
Traditional "Material" shadows are too ethereal for this system. We require "Physical Displacement."

### The Layering Principle
Instead of stacking cards, "extrude" the surface. A card isn't an object on a background; it is a raised portion of the background. Use `surface-container-highest` (#f1dfd7) to create these soft, pillowy plateaus.

### Ambient Shadows
When an element must float (like a modal or a floating action button), use an **"Atmospheric Sinker"** shadow:
- **Color:** `#8c4d3a` (Primary) at 12% opacity.
- **Blur:** 40px to 60px.
- **Spread:** -10px.
This creates a soft glow that feels like the object is displacing the air around it.

### The "Dome" Effect
For primary interactions, mimic a rubber membrane button. This is achieved by combining a `primary` background with a subtle inner shadow (`inset 0 4px 10px rgba(0,0,0,0.1)`) and a `primary-fixed-dim` (#ffc8b8) top-down outer shadow. The result is a "tactile dome" that looks pushed out from the back of the skin.

---

## 5. Components

### Buttons: The Tactile Dome
- **Primary:** High-pill (`rounded-full`), `primary` background. Must look convex. On hover, the "dome" should appear to flatten slightly (reduce shadow spread).
- **Secondary:** `surface-container-highest` with `on-surface` text. These are subtle indentations in the rubber.
- **Tertiary:** No background. Only `Newsreader` type with a `primary` underline that glows on hover.

### Input Fields: The Sunken Channel
Forbid the 1px border. Use `surface-container-high` (#f5e5de) as the background with a 4px `rounded-sm` corner. The input should feel like a carved-out channel in the surface. Use `Newsreader` for labels to give them an "embossed" quality.

### Cards: The Pillowy Plateau
Cards must never have borders or harsh shadows. Use `surface-container-low` with a `rounded-xl` (3rem) corner radius. The large radius is critical to the "Bellini" aesthetic—it mimics the soft, over-stuffed corners of 1970s modular sofas.

### Chips: The Molded Toggle
Chips should look like small rubber nubs. Use `secondary-container` (#ffdbd1) when active. They should be "pushed-in" (inner shadow) when selected, signifying a physical state change.

### Lists & Dividers
**Divider lines are strictly forbidden.** Separate list items using `body-md` typography and generous vertical spacing (at least 24px). If separation is visually required, use a tonal shift in the background color of the list item itself (`surface-container-lowest` to `surface-container-low`).

---

## 6. Do's and Don'ts

### Do:
- **Embrace Asymmetry:** Place headlines off-center to create a sense of organic growth.
- **Use "Fleshy" Spacing:** Give elements room to "breathe" as if they are part of a living organism.
- **Prioritize Tactility:** If it doesn't look like you can touch it and feel the rubber give way, it’s not finished.

### Don't:
- **Don't use Pure Black/White:** Use the `surface` and `on-surface` tokens. Pure black (#000) breaks the "Synthetic Dermis" illusion.
- **Don't use Sharp Corners:** Nothing in this system is "sharp." Even the "clinical" sans-serif should be surrounded by the soft curves of the containers.
- **Don't use Flat Color Blocks:** Always favor a subtle, 2% tonal gradient to imply 3D form and "Soft-Tech" luxury.