export function PartnerLogoStrip() {
  return (
    <section
      aria-label="Supported ecosystem and infrastructure integrations"
      className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-12"
    >
      <div className="relative overflow-hidden">
        <div
          className="flex flex-wrap items-center justify-center gap-x-8 gap-y-5 sm:flex-nowrap sm:justify-between sm:gap-x-6"
          style={{
            maskImage:
              "linear-gradient(to right, rgba(0,0,0,0.22) 0%, rgba(0,0,0,1) 20%, rgba(0,0,0,1) 80%, rgba(0,0,0,0.22) 100%)",
            WebkitMaskImage:
              "linear-gradient(to right, rgba(0,0,0,0.22) 0%, rgba(0,0,0,1) 20%, rgba(0,0,0,1) 80%, rgba(0,0,0,0.22) 100%)",
          }}
        >
          {/* 1. Cloudflare */}
          <div className="flex items-center gap-2 text-[#0b0f19]">
            <svg viewBox="0 0 28 28" className="h-6 w-6" aria-hidden="true">
              <circle cx="14" cy="14" r="10" fill="none" stroke="currentColor" strokeWidth="2.5" opacity="0.45" />
              <circle cx="14" cy="14" r="5" fill="currentColor" opacity="0.65" />
            </svg>
            <span className="text-base font-semibold tracking-tight text-[#0b0f19]/75">
              Cloudflare
            </span>
          </div>

          {/* 2. OpenAI */}
          <div className="flex items-center gap-1.5 text-[#0b0f19]">
            <span className="text-lg font-semibold tracking-tight">OpenAI</span>
          </div>

          {/* 3. NEXT.JS */}
          <div className="flex items-center gap-2 text-[#0b0f19]">
            <span className="text-base font-extrabold tracking-[0.18em] uppercase">
              NEXT.JS
            </span>
          </div>

          {/* 4. SUPABASE */}
          <div className="flex items-center gap-1.5 text-[#0b0f19]">
            <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
              <path d="M13 2L4 14h7l-1 8 10-12h-7l0-8z" fill="currentColor" />
            </svg>
            <span className="text-base font-black tracking-tight uppercase">
              SUPABASE
            </span>
          </div>

          {/* 5. GITHUB */}
          <div className="flex items-center gap-2 text-[#0b0f19]">
            <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
              <circle cx="12" cy="12" r="9.5" fill="none" stroke="currentColor" strokeWidth="2" />
              <circle cx="12" cy="10" r="2.2" fill="currentColor" />
              <path d="M8 17c1.1-2 2.4-2.8 4-2.8s2.9.8 4 2.8" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
            <div className="leading-none">
              <span className="block text-xs font-extrabold tracking-wide uppercase">
                GITHUB
              </span>
              <span className="block text-[9px] font-medium tracking-widest text-[#525b6c] uppercase">
                APPS &amp; HOOKS
              </span>
            </div>
          </div>

          {/* 6. BULLMQ */}
          <div className="flex items-center text-[#0b0f19]">
            <span className="text-sm font-semibold tracking-[0.28em] uppercase text-[#0b0f19]/85">
              BULLMQ
            </span>
          </div>

          {/* 7. DOCKER */}
          <div className="flex items-center gap-1.5 text-[#0b0f19]">
            <span className="text-base font-extrabold tracking-wide uppercase text-[#0b0f19]/70">
              DOCKER
            </span>
            <svg viewBox="0 0 24 24" className="h-5 w-5 text-[#0b0f19]/65" aria-hidden="true">
              <path d="M4 4h14v14H14V8H4V4z" fill="currentColor" />
              <path d="M4 11h6v7H4v-7z" fill="currentColor" opacity="0.6" />
            </svg>
          </div>
        </div>
      </div>
    </section>
  );
}
