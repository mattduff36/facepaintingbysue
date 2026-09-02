"use client";

import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";
import { Maximize2 } from "lucide-react";
import type { GalleryImage } from "@/lib/gallery";

const RING_COLORS = [
  "hover:ring-brand-red/60",
  "hover:ring-brand-orange/60",
  "hover:ring-brand-yellow/70",
  "hover:ring-brand-green/60",
  "hover:ring-brand-teal/60",
  "hover:ring-brand-blue/60",
  "hover:ring-brand-purple/60",
  "hover:ring-brand-pink/60",
];

interface PhotoTileProps {
  image: GalleryImage;
  onOpen: (index: number) => void;
  /** Load immediately (used for above-the-fold desktop mosaic tiles). */
  eager?: boolean;
  /** Crossfade when the image changes (used by rotating desktop tiles). */
  crossfade?: boolean;
  sizes?: string;
  colorSeed?: number;
  revealDelay?: number;
}

export function PhotoTile({
  image,
  onOpen,
  eager = false,
  crossfade = false,
  sizes = "(max-width: 1024px) 45vw, 16vw",
  colorSeed = 0,
  revealDelay = 0,
}: PhotoTileProps) {
  const ring = RING_COLORS[colorSeed % RING_COLORS.length];
  const loading = eager ? "eager" : "lazy";

  return (
    <motion.button
      type="button"
      onClick={() => onOpen(image.index)}
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      whileHover={{ scale: 1.05, zIndex: 5 }}
      whileTap={{ scale: 0.97 }}
      transition={{ duration: 0.35, ease: "easeOut", delay: revealDelay }}
      aria-label={`Open ${image.alt} in full screen`}
      className={[
        "group relative h-full w-full overflow-hidden rounded-2xl bg-ink/5",
        "shadow-[var(--shadow-tile)] ring-2 ring-transparent transition-shadow duration-300",
        "outline-none focus-visible:ring-4 focus-visible:ring-brand-purple",
        "touch-manipulation hover:shadow-2xl",
        ring,
      ].join(" ")}
    >
      {crossfade ? (
        <AnimatePresence initial={false}>
          <motion.span
            key={image.src}
            className="absolute inset-0"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.7, ease: "easeInOut" }}
          >
            <Image
              src={image.src}
              alt={image.alt}
              fill
              sizes={sizes}
              loading={loading}
              className="object-cover"
            />
          </motion.span>
        </AnimatePresence>
      ) : (
        <Image
          src={image.src}
          alt={image.alt}
          fill
          sizes={sizes}
          loading={loading}
          className="object-cover"
        />
      )}

      {/* darkening wash on hover (affordance, not a zoom) */}
      <span className="pointer-events-none absolute inset-0 bg-gradient-to-t from-ink/40 via-ink/0 to-ink/0 opacity-100 transition-opacity duration-300 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100" />

      <span className="pointer-events-none absolute bottom-2 right-2 flex h-8 w-8 translate-y-0 items-center justify-center rounded-full bg-white/90 text-ink opacity-100 shadow-md transition-all duration-300 [@media(hover:hover)]:translate-y-2 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:translate-y-0 [@media(hover:hover)]:group-hover:opacity-100">
        <Maximize2 className="h-4 w-4" aria-hidden />
      </span>

      {image.featured && (
        <span className="pointer-events-none absolute left-2 top-2 rounded-full bg-white/90 px-2 py-0.5 font-display text-[10px] font-bold uppercase tracking-wide text-brand-purple shadow-sm">
          Featured
        </span>
      )}
    </motion.button>
  );
}
