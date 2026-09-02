"use client";

import { useEffect, useState } from "react";
import { ContactCard } from "./contact-card";
import { Lightbox } from "./lightbox";
import { PhotoTile } from "./photo-tile";
import type { GalleryImage } from "@/lib/gallery";
import { FEATURED_CELLS, ROTATING_CELLS } from "@/lib/mosaic-layout";
import type { SiteSettings } from "@/lib/site-settings";

const ROTATE_INTERVAL_MS = 4000;

export function BusinessCard({
  images,
  featured,
  rotating,
  settings,
  logoSrc,
}: {
  images: GalleryImage[];
  featured: GalleryImage[];
  rotating: GalleryImage[];
  settings: SiteSettings;
  logoSrc: string;
}) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const [rotatingVisible, setRotatingVisible] = useState(() =>
    rotating.slice(0, ROTATING_CELLS.length),
  );

  useEffect(() => {
    if (rotating.length <= ROTATING_CELLS.length) return;

    const desktopMq = window.matchMedia("(min-width: 1024px)");
    const reduceMq = window.matchMedia("(prefers-reduced-motion: reduce)");
    let timer: ReturnType<typeof setInterval> | undefined;

    const rotateOne = () => {
      setRotatingVisible((prev) => {
        const visible = new Set(prev.map((img) => img.src));
        const candidates = rotating.filter((img) => !visible.has(img.src));
        if (candidates.length === 0) return prev;
        const slot = Math.floor(Math.random() * prev.length);
        const pick = candidates[Math.floor(Math.random() * candidates.length)];
        const next = prev.slice();
        next[slot] = pick;
        return next;
      });
    };

    const sync = () => {
      const shouldRun = desktopMq.matches && !reduceMq.matches;
      if (shouldRun && !timer) {
        timer = setInterval(rotateOne, ROTATE_INTERVAL_MS);
      } else if (!shouldRun && timer) {
        clearInterval(timer);
        timer = undefined;
      }
    };

    sync();
    desktopMq.addEventListener("change", sync);
    reduceMq.addEventListener("change", sync);
    return () => {
      if (timer) clearInterval(timer);
      desktopMq.removeEventListener("change", sync);
      reduceMq.removeEventListener("change", sync);
    };
  }, [rotating]);

  return (
    <div className="home-root">
      <main>
        <div className="hidden h-[100svh] w-full grid-cols-6 grid-rows-6 gap-2.5 overflow-hidden p-2.5 lg:grid">
          <div className="z-10 col-start-2 col-span-4 row-start-3 row-span-2">
            <ContactCard settings={settings} logoSrc={logoSrc} />
          </div>

          {featured.slice(0, FEATURED_CELLS.length).map((image, i) => (
            <div
              key={`feat-${image.publicId}`}
              style={{ gridColumn: FEATURED_CELLS[i].col, gridRow: FEATURED_CELLS[i].row }}
            >
              <PhotoTile
                image={image}
                onOpen={setOpenIndex}
                eager
                colorSeed={i}
                revealDelay={i * 0.04}
                sizes="16vw"
              />
            </div>
          ))}

          {rotatingVisible.map((image, i) => (
            <div
              key={`rot-${i}`}
              style={{ gridColumn: ROTATING_CELLS[i].col, gridRow: ROTATING_CELLS[i].row }}
            >
              <PhotoTile
                image={image}
                onOpen={setOpenIndex}
                eager
                crossfade
                colorSeed={i + FEATURED_CELLS.length}
                revealDelay={Math.min((i + FEATURED_CELLS.length) * 0.02, 0.5)}
                sizes="16vw"
              />
            </div>
          ))}
        </div>

        <div className="min-h-[100svh] px-4 pb-10 pt-6 lg:hidden">
          <div className="mx-auto max-w-md">
            <ContactCard compact settings={settings} logoSrc={logoSrc} />
          </div>

          <div className="mx-auto mt-8 max-w-md">
            <h2 className="mb-3 text-center font-display text-2xl font-extrabold">
              <span className="rainbow-text">Sue&rsquo;s work</span>
            </h2>
            {images.length === 0 ? (
              <p className="text-center text-sm text-muted">
                Photos will appear here soon.
              </p>
            ) : (
              <>
                <p className="mb-4 text-center text-sm text-muted">
                  Tap any photo to view it full screen
                </p>
                <div className="grid grid-cols-2 gap-3">
                  {images.map((image, i) => (
                    <div key={image.publicId} className="relative aspect-[3/4]">
                      <PhotoTile
                        image={image}
                        onOpen={setOpenIndex}
                        eager={i < 4}
                        colorSeed={i}
                        sizes="45vw"
                      />
                    </div>
                  ))}
                </div>
              </>
            )}
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
        </div>
      </main>

      <Lightbox
        images={images}
        openIndex={openIndex}
        onClose={() => setOpenIndex(null)}
        onNavigate={setOpenIndex}
      />
    </div>
  );
}
