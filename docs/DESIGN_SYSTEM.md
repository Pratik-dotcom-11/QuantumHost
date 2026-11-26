# QuantumHost — Minimal Palette & Typography System

## 1. Typography System (Self-Hosted Variable Fonts)

| Role | Font Family | Package | Tracking & Sizing |
| --- | --- | --- | --- |
| **Display & Headings** | `Plus Jakarta Sans Variable` | `@fontsource-variable/plus-jakarta-sans` | `-0.025em` to `-0.03em`, `text-wrap: balance`, weights `600–700` |
| **UI & Body Copy** | `Inter Variable` | `@fontsource-variable/inter` | `cv02/cv03/cv04/cv11` stylistic alternates, `13px–15px`, `line-height: 1.6` |
| **Code, Metrics & Logs** | `JetBrains Mono Variable` | `@fontsource-variable/jetbrains-mono` | `tabular-nums`, crisp log streaming and deployment hashes |

All font assets are bundled locally via `@fontsource-variable/*` for zero external font requests, instant rendering, and offline build reliability.

---

## 2. Minimal Architectural Color Palette

| Token | Hex | Usage |
| --- | --- | --- |
| **Canvas** | `#F9FAFB` | Primary application and marketing page background |
| **Surface** | `#FFFFFF` | Elevated cards, forms, tables, and navigation surfaces |
| **Subtle Surface** | `#F1F4F9` / `#F3F5F8` | Secondary buttons, inset KPI tiles, muted tags |
| **Hairline Border** | `#E5E8EF` | 1px subtle boundaries across cards and dividers |
| **Ink Primary** | `#0A0E17` | Display headings, primary labels, dark CTA pills |
| **Ink Secondary** | `#556070` | Body copy, descriptions, secondary metadata |
| **Brand Accent** | `#1D5BFF` | Primary interactive CTAs, active nav indicators, focus rings |
| **Accent Tint** | `#EEF3FF` | Active sidebar highlight and soft informational badges |
| **Showcase Surface** | `#040509` | Hero showcase, trust highlight card, bottom CTA, build log terminal |
| **Semantic Status** | Emerald / Amber / Rose | Muted status indicators strictly on deployment & uptime badges |
