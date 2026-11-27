# QuantumHost — Obsidian & Solar-Amber Design System

## 1. Typography System (Self-Hosted Variable Fonts)

| Role | Font Family | Package | Tracking & Sizing |
| --- | --- | --- | --- |
| **Display & Headings** | `Plus Jakarta Sans Variable` | `@fontsource-variable/plus-jakarta-sans` | `-0.025em` tracking, weights `500–600`, `text-wrap: balance` |
| **UI & Body Copy** | `Inter Variable` | `@fontsource-variable/inter` | `cv02/cv03/cv04/cv11` alternates, `13px–15px` |
| **Brand Wordmark & Eyebrows** | `Plus Jakarta Sans Variable` | — | Uppercase, `0.22em–0.24em` letter-spacing |
| **Code, Metrics & Logs** | `JetBrains Mono Variable` | `@fontsource-variable/jetbrains-mono` | `tabular-nums`, log terminal and artifact paths |

## 2. Reference-Matched Color Palette

| Token | Hex | Usage |
| --- | --- | --- |
| **Canvas (`background`)** | `#0B0907` | Primary obsidian espresso background across public and console pages |
| **Elevated Card (`card`)** | `#14110E` | Primary cards, workbench container, auth forms |
| **Inset Surface (`muted`)** | `#0F0C0A` / `#181410` | Input fields, nested list rows, segmented switcher rails |
| **Hairline Border (`border`)** | `#26201A` | Subtle warm hairline boundaries |
| **Ink Primary (`foreground`)** | `#F7F3EC` | Primary cream-white headings and primary labels |
| **Ink Muted (`muted-foreground`)** | `#9A9084` | Warm stone descriptions, secondary labels, timestamps |
| **Solar Amber (`primary`)** | `#F4BA4A` | Primary rounded-pill CTAs, active nav badges, switch accents |
| **Contrast Preview Surface** | `#F6F2EA` | Warm cream interior preview canvas inside the interactive workbench |
