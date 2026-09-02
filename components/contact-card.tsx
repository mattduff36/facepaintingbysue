import { Mail, MapPin, Phone, Sparkles } from "lucide-react";
import { AdminLogoTrigger } from "@/components/admin-logo-trigger";
import { bookingMailto, type SiteSettings } from "@/lib/site-settings";

function FacebookIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className={className}>
      <path d="M22 12.06C22 6.5 17.52 2 12 2S2 6.5 2 12.06c0 5.02 3.66 9.18 8.44 9.94v-7.03H7.9v-2.9h2.54V9.85c0-2.52 1.49-3.91 3.78-3.91 1.09 0 2.24.2 2.24.2v2.47h-1.26c-1.24 0-1.63.78-1.63 1.57v1.88h2.78l-.44 2.9h-2.34V22c4.78-.76 8.44-4.92 8.44-9.94Z" />
    </svg>
  );
}

export function ContactCard({
  compact = false,
  mosaic = false,
  settings,
  logoSrc,
}: {
  compact?: boolean;
  mosaic?: boolean;
  settings: SiteSettings;
  logoSrc: string;
}) {
  return (
    <div
      className={[
        "relative flex h-full w-full min-h-0 flex-col items-center justify-center overflow-hidden",
        "rounded-[28px] border border-white/70 bg-white/85 text-center shadow-[var(--shadow-card)] backdrop-blur-xl",
        "ring-1 ring-black/5",
        mosaic
          ? "gap-[clamp(0.12rem,2.2cqh,0.4rem)] px-[clamp(0.35rem,3cqw,0.9rem)] py-[clamp(0.2rem,2cqh,0.55rem)]"
          : compact
            ? "gap-3 px-6 py-8"
            : "gap-2 px-5 py-4 lg:gap-3 lg:px-8 lg:py-5",
      ].join(" ")}
    >
      {/* playful paint dots in the corners */}
      <span className={`pointer-events-none absolute rounded-full bg-brand-red/80 ${mosaic ? "left-2 top-2 h-1.5 w-1.5" : "left-4 top-4 h-2.5 w-2.5"}`} />
      <span className={`pointer-events-none absolute rounded-full bg-brand-teal/80 ${mosaic ? "right-2.5 top-3 h-1 w-1" : "right-5 top-6 h-2 w-2"}`} />
      <span className={`pointer-events-none absolute rounded-full bg-brand-yellow ${mosaic ? "bottom-2.5 left-3 h-1 w-1" : "bottom-5 left-6 h-2 w-2"}`} />
      <span className={`pointer-events-none absolute rounded-full bg-brand-purple/80 ${mosaic ? "bottom-2 right-2 h-1.5 w-1.5" : "bottom-4 right-4 h-2.5 w-2.5"}`} />

      <AdminLogoTrigger
        src={logoSrc}
        alt={`${settings.name} logo`}
        width={compact ? 132 : 120}
        height={compact ? 132 : 120}
        className={
          mosaic
            ? "h-[clamp(1.4rem,22cqh,3.4rem)] w-auto min-h-0 max-h-full"
            : compact
              ? "h-24 w-auto sm:h-28"
              : "h-[13vh] max-h-28 w-auto min-h-16"
        }
      />

      <h1
        className={[
          "font-display font-extrabold leading-none rainbow-text",
          mosaic ? "text-[clamp(0.7rem,6.5cqw,1.35rem)]" : compact ? "text-4xl" : "text-[clamp(1.5rem,2.4vw,2.4rem)]",
        ].join(" ")}
      >
        Facepainting
        <span className="mx-1 align-middle text-ink/80">by</span>
        Sue
      </h1>

      <p
        className={[
          "flex items-center gap-1.5 font-semibold text-muted",
          mosaic ? "text-[clamp(0.55rem,2.4cqh,0.75rem)]" : compact ? "text-sm" : "text-[clamp(0.72rem,1vw,0.9rem)]",
        ].join(" ")}
      >
        <Sparkles className="h-3.5 w-3.5 text-brand-orange" aria-hidden />
        {settings.tagline}
      </p>

      <div
        className={[
          "flex flex-col items-center gap-1.5 font-semibold text-ink",
          mosaic ? "text-[clamp(0.52rem,2.2cqh,0.72rem)]" : compact ? "text-base" : "text-[clamp(0.72rem,0.95vw,0.9rem)]",
        ].join(" ")}
      >
        <a
          href={settings.phoneHref}
          className="group inline-flex items-center gap-2 transition-colors hover:text-brand-red"
        >
          <Phone className="h-4 w-4 text-brand-red" aria-hidden />
          {settings.phoneDisplay}
        </a>
        <a
          href={bookingMailto(settings)}
          className="group inline-flex items-center gap-2 transition-colors hover:text-brand-blue"
        >
          <Mail className="h-4 w-4 text-brand-blue" aria-hidden />
          {settings.email}
        </a>
        <span className="inline-flex items-center gap-2 text-muted">
          <MapPin className="h-4 w-4 text-brand-green" aria-hidden />
          {settings.area}
        </span>
        {settings.availability ? (
          <span className="mt-1 max-w-[32ch] font-semibold text-brand-purple">
            {settings.availability}
          </span>
        ) : null}
      </div>

      <div className="mt-1 flex items-center gap-2">
        <a
          href={bookingMailto(settings)}
          className={[
            "inline-flex items-center gap-2 rounded-full bg-ink px-5 font-display font-bold text-cream",
            "shadow-lg shadow-ink/20 transition-transform duration-200 hover:-translate-y-0.5 hover:bg-brand-purple",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple focus-visible:ring-offset-2",
            mosaic
              ? "px-3 py-1 text-[clamp(0.55rem,2.2cqh,0.75rem)]"
              : compact
                ? "py-3 text-base"
                : "py-2 text-[clamp(0.8rem,1vw,0.95rem)]",
          ].join(" ")}
        >
          Book / Enquire
        </a>
        <a
          href={settings.facebook}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Facepainting by Sue on Facebook"
          className={[
            "inline-flex items-center justify-center rounded-full border border-brand-blue/30 bg-brand-blue/10 text-brand-blue",
            "transition-transform duration-200 hover:-translate-y-0.5 hover:bg-brand-blue hover:text-white",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue focus-visible:ring-offset-2",
            mosaic ? "h-7 w-7" : compact ? "h-11 w-11" : "h-9 w-9",
          ].join(" ")}
        >
          <FacebookIcon className={mosaic ? "h-3.5 w-3.5" : compact ? "h-5 w-5" : "h-4 w-4"} />
        </a>
      </div>
    </div>
  );
}
