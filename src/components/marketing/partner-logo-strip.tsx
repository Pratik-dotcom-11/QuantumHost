export function PartnerLogoStrip() {
  return (
    <section
      aria-label="Supported ecosystem and infrastructure integrations"
      className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-10"
    >
      <div className="relative overflow-hidden border-y border-[#221c16] py-6">
        <div
          className="flex flex-wrap items-center justify-center gap-x-8 gap-y-4 sm:flex-nowrap sm:justify-between sm:gap-x-6"
          style={{
            maskImage:
              "linear-gradient(to right, rgba(0,0,0,0.25) 0%, rgba(0,0,0,1) 20%, rgba(0,0,0,1) 80%, rgba(0,0,0,0.25) 100%)",
            WebkitMaskImage:
              "linear-gradient(to right, rgba(0,0,0,0.25) 0%, rgba(0,0,0,1) 20%, rgba(0,0,0,1) 80%, rgba(0,0,0,0.25) 100%)",
          }}
        >
          <span className="font-display text-sm font-medium tracking-tight text-[#b8afa2]">
            Cloudflare R2
          </span>
          <span className="font-display text-sm font-medium tracking-tight text-[#d6cfc4]">
            Supabase
          </span>
          <span className="font-display text-xs font-semibold uppercase tracking-[0.2em] text-[#b8afa2]">
            NEXT.JS
          </span>
          <span className="font-display text-xs font-semibold uppercase tracking-[0.22em] text-[#d6cfc4]">
            BULLMQ
          </span>
          <span className="font-display text-xs font-semibold uppercase tracking-[0.2em] text-[#b8afa2]">
            GITHUB APPS
          </span>
          <span className="font-display text-sm font-medium tracking-tight text-[#b8afa2]">
            OpenAI · Gemini
          </span>
        </div>
      </div>
    </section>
  );
}
