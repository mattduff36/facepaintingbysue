"use client";

import { useState } from "react";
import { ContactCard } from "./contact-card";
import { Lightbox } from "./lightbox";
import { PhotoTile } from "./photo-tile";
import type { GalleryImage } from "@/lib/gallery";

interface BusinessCardProps {
  /** Full deduped set, shown in the lightbox. */
  images: GalleryImage[];
  /** The subset placed around the central contact block on desktop. */
  tiles: GalleryImage[];
}

export function BusinessCard({ images, tiles }: BusinessCardProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <>
      {/* ---------- Desktop: viewport-locked 6x6 mosaic ---------- */}
      <main className="hidden h-[100svh] w-full grid-cols-6 grid-rows-6 gap-2.5 overflow-hidden p-2.5 lg:grid">
        <div className="z-10 col-start-2 col-span-4 row-start-3 row-span-2">
          <ContactCard />
        </div>

        {tiles.map((image, i) => (
          <PhotoTile
            key={`tile-${i}`}
            image={image}
            onOpen={setOpenIndex}
            colorSeed={i}
            priority={i < 6}
            revealDelay={Math.min(i * 0.025, 0.5)}
            sizes="16vw"
          />
        ))}
      </main>

      {/* ---------- Mobile / tablet: hero card + scrollable gallery ---------- */}
      <main className="min-h-[100svh] px-4 pb-10 pt-6 lg:hidden">
        <div className="mx-auto max-w-md">
          <ContactCard compact />
        </div>

        <div className="mx-auto mt-8 max-w-md">
          <h2 className="mb-3 text-center font-display text-2xl font-extrabold">
            <span className="rainbow-text">Sue&rsquo;s work</span>
          </h2>
          <p className="mb-4 text-center text-sm text-muted">
            Tap any photo to view it full screen
          </p>

          <div className="grid grid-cols-2 gap-3">
            {images.map((image, i) => (
              <div key={image.src} className="relative aspect-[3/4]">
                <PhotoTile
                  image={image}
                  onOpen={setOpenIndex}
                  colorSeed={i}
                  priority={i < 4}
                  revealDelay={0}
                  sizes="45vw"
                />
              </div>
            ))}
          </div>
        </div>

        <footer className="mt-10 text-center text-xs text-muted">
          Website by{" "}
          <a
            href="https://mpdee.co.uk"
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold underline-offset-2 hover:underline"
          >
            mpdee.co.uk
          </a>{" "}
          &copy; {new Date().getFullYear()}
        </footer>
      </main>

      <Lightbox
        images={images}
        openIndex={openIndex}
        onClose={() => setOpenIndex(null)}
        onNavigate={setOpenIndex}
      />
    </>
  );
}
