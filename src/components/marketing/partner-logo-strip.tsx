import React from "react";

interface EcosystemBrand {
  name: string;
  tag?: string;
  renderIcon: () => React.ReactNode;
}

const BRANDS: EcosystemBrand[] = [
  {
    name: "Cloudflare R2",
    renderIcon: () => (
      <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0" fill="none" aria-hidden="true">
        <path
          d="M16.9 16.5H6.5a3.7 3.7 0 0 1-.4-7.38A5.2 5.2 0 0 1 16.1 7.6a4.1 4.1 0 0 1 3.7 4.08c0 2.66-1.3 4.82-2.9 4.82Z"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinejoin="round"
        />
        <path d="M9.5 13.5h6" stroke="#f4ba4a" strokeWidth="1.75" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    name: "Supabase",
    renderIcon: () => (
      <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0" fill="none" aria-hidden="true">
        <path
          d="M13.3 20.6c-.48.6-1.45.27-1.47-.5l-.17-6.6h6.45c1.17 0 1.82 1.34 1.1 2.26L13.3 20.6Z"
          fill="#f4ba4a"
        />
        <path
          d="M10.7 3.4c.48-.6 1.45-.27 1.47.5l.07 6.6H5.89c-1.17 0-1.82-1.34-1.1-2.26L10.7 3.4Z"
          fill="currentColor"
          opacity="0.9"
        />
      </svg>
    ),
  },
  {
    name: "Next.js",
    renderIcon: () => (
      <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0" fill="none" aria-hidden="true">
        <circle cx="12" cy="12" r="9.25" stroke="currentColor" strokeWidth="1.6" />
        <path
          d="M8.75 16V8.4L17.2 18.8M15.25 8.4v4.4"
          stroke="#f4ba4a"
          strokeWidth="1.65"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  {
    name: "BullMQ",
    renderIcon: () => (
      <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0" fill="none" aria-hidden="true">
        <path
          d="M4.5 7.5 12 3.5l7.5 4v9L12 20.5l-7.5-4v-9Z"
          stroke="currentColor"
          strokeWidth="1.65"
          strokeLinejoin="round"
        />
        <path
          d="M8.5 10.5 12 12.5l3.5-2M12 12.5v4.5"
          stroke="#f4ba4a"
          strokeWidth="1.65"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  {
    name: "GitHub Apps",
    renderIcon: () => (
      <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0" fill="currentColor" aria-hidden="true">
        <path
          fillRule="evenodd"
          clipRule="evenodd"
          d="M12 2.5a9.5 9.5 0 0 0-3 18.52c.48.09.65-.2.65-.45v-1.6c-2.66.58-3.22-1.13-3.22-1.13-.43-1.1-1.06-1.4-1.06-1.4-.87-.59.06-.58.06-.58.96.07 1.46.98 1.46.98.85 1.46 2.24 1.04 2.78.8.09-.62.33-1.04.6-1.28-2.12-.24-4.35-1.06-4.35-4.72 0-1.04.37-1.9.98-2.57-.1-.24-.43-1.22.09-2.54 0 0 .8-.26 2.62.98a9.1 9.1 0 0 1 4.76 0c1.82-1.24 2.62-.98 2.62-.98.52 1.32.19 2.3.09 2.54.61.67.98 1.53.98 2.57 0 3.67-2.23 4.48-4.36 4.71.34.3.65.88.65 1.77v2.62c0 .25.17.55.66.45A9.5 9.5 0 0 0 12 2.5Z"
        />
      </svg>
    ),
  },
  {
    name: "Redis",
    renderIcon: () => (
      <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0" fill="none" aria-hidden="true">
        <path
          d="m12 4.5 7.5 3.3L12 11.1 4.5 7.8 12 4.5Z"
          stroke="#f4ba4a"
          strokeWidth="1.65"
          strokeLinejoin="round"
        />
        <path
          d="M4.5 12 12 15.3 19.5 12M4.5 16.2 12 19.5l7.5-3.3"
          stroke="currentColor"
          strokeWidth="1.65"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  {
    name: "OpenAI",
    renderIcon: () => (
      <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0" fill="none" aria-hidden="true">
        <path
          d="M12 3.7a4.3 4.3 0 0 1 3.7 2.13 4.3 4.3 0 0 1 4.4 5.95 4.3 4.3 0 0 1-1.95 5.92 4.3 4.3 0 0 1-6.15 2.6 4.3 4.3 0 0 1-5.85-2.6A4.3 4.3 0 0 1 4.2 11.78a4.3 4.3 0 0 1 4.1-5.95A4.3 4.3 0 0 1 12 3.7Z"
          stroke="currentColor"
          strokeWidth="1.5"
        />
        <circle cx="12" cy="12" r="2.2" fill="#f4ba4a" />
      </svg>
    ),
  },
  {
    name: "Gemini",
    renderIcon: () => (
      <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0" fill="none" aria-hidden="true">
        <path
          d="M12 3.5c.65 4.6 3.9 7.85 8.5 8.5-4.6.65-7.85 3.9-8.5 8.5-.65-4.6-3.9-7.85-8.5-8.5 4.6-.65 7.85-3.9 8.5-8.5Z"
          fill="#f4ba4a"
        />
      </svg>
    ),
  },
];

function BrandPill({ brand }: { brand: EcosystemBrand }) {
  return (
    <div className="mx-2.5 flex shrink-0 items-center gap-2.5 rounded-full border border-[#282119] bg-[#14110e]/80 px-4 py-2 text-[#e7dfd3] transition-colors hover:border-[#d49b4b]/55 hover:bg-[#1a1510]">
      <span className="text-[#d7cfc3]">{brand.renderIcon()}</span>
      <span className="font-sans text-xs font-medium tracking-wide text-[#f2ece2]">
        {brand.name}
      </span>
    </div>
  );
}

export function PartnerLogoStrip() {
  return (
    <section
      aria-label="Supported ecosystem and infrastructure integrations"
      className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-10"
    >
      <div className="mb-3 text-center">
        <p className="font-sans text-[10px] font-medium uppercase tracking-[0.26em] text-[#8e857b]">
          Powered By Modern Cloud Infrastructure
        </p>
      </div>

      <div
        className="group relative overflow-hidden border-y border-[#221c16] py-5"
        style={{
          maskImage:
            "linear-gradient(to right, transparent 0%, black 12%, black 88%, transparent 100%)",
          WebkitMaskImage:
            "linear-gradient(to right, transparent 0%, black 12%, black 88%, transparent 100%)",
        }}
      >
        <div className="animate-qh-marquee items-center">
          <div className="flex shrink-0 items-center">
            {BRANDS.map((brand) => (
              <BrandPill key={`track-a-${brand.name}`} brand={brand} />
            ))}
          </div>
          <div className="flex shrink-0 items-center" aria-hidden="true">
            {BRANDS.map((brand) => (
              <BrandPill key={`track-b-${brand.name}`} brand={brand} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
