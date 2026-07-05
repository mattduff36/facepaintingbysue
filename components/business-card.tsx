"use client";

import { useEffect, useState } from "react";
import { ContactCard } from "./contact-card";
import { Lightbox } from "./lightbox";
import { PhotoTile } from "./photo-tile";
import { featuredImages, galleryImages, rotatingImages } from "@/lib/gallery";

interface Cell {
  col: number;
  row: number;
}

// Desktop is a 6x6 grid. The contact card sits in the centre (cols 2-5, rows 3-4).
// Featured photos sit directly underneath it, so the set reads as one balanced
// strip below the contact section.
const FEATURED_CELLS: Cell[] = [
  { col: 2, row: 5 },
  { col: 3, row: 5 },
  { col: 4, row: 5 },
  { col: 5, row: 5 },
];

// Remaining photo cells: the rest of the ring (continuing anticlockwise) then the
// outer top and bottom rows. These rotate through the wider gallery over time.
const ROTATING_CELLS: Cell[] = [
  // rest of the ring, anticlockwise
  { col: 1, row: 5 }, // lower-left outer tile
  { col: 6, row: 5 }, // bottom-right corner
  { col: 6, row: 4 },
  { col: 6, row: 3 },
  { col: 6, row: 2 }, // top-right corner
  { col: 5, row: 2 },
  { col: 4, row: 2 },
  { col: 3, row: 2 },
  { col: 2, row: 2 },
  { col: 1, row: 2 }, // top-left corner
  { col: 1, row: 3 },
  { col: 1, row: 4 },
  // outer top row
  { col: 1, row: 1 },
  { col: 2, row: 1 },
  { col: 3, row: 1 },
  { col: 4, row: 1 },
  { col: 5, row: 1 },
  { col: 6, row: 1 },
  // outer bottom row
  { col: 1, row: 6 },
  { col: 2, row: 6 },
  { col: 3, row: 6 },
  { col: 4, row: 6 },
  { col: 5, row: 6 },
  { col: 6, row: 6 },
];

const ROTATE_INTERVAL_MS = 4000;

export function BusinessCard() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const [rotating, setRotating] = useState(() =>
    rotatingImages.slice(0, ROTATING_CELLS.length),
  );

  // Desktop-only: swap one non-featured tile for an unseen photo every few seconds,
  // so the whole gallery gets a turn. Featured tiles never rotate.
  useEffect(() => {
    if (rotatingImages.length <= ROTATING_CELLS.length) return;

    const desktopMq = window.matchMedia("(min-width: 1024px)");
    const reduceMq = window.matchMedia("(prefers-reduced-motion: reduce)");
    let timer: ReturnType<typeof setInterval> | undefined;

    const rotateOne = () => {
      setRotating((prev) => {
        const visible = new Set(prev.map((img) => img.src));
        const candidates = rotatingImages.filter((img) => !visible.has(img.src));
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
  }, []);

  return (
    <>
      {/* ---------- Desktop: viewport-locked 6x6 mosaic ---------- */}
      <main className="hidden h-[100svh] w-full grid-cols-6 grid-rows-6 gap-2.5 overflow-hidden p-2.5 lg:grid">
        <div className="z-10 col-start-2 col-span-4 row-start-3 row-span-2">
          <ContactCard />
        </div>

        {featuredImages.map((image, i) => (
          <div
            key={`feat-${i}`}
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

        {rotating.map((image, i) => (
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
            {galleryImages.map((image, i) => (
              <div key={image.src} className="relative aspect-[3/4]">
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
        images={galleryImages}
        openIndex={openIndex}
        onClose={() => setOpenIndex(null)}
        onNavigate={setOpenIndex}
      />
    </>
  );
}
