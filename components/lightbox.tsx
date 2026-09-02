"use client";

import { useCallback, useEffect, useRef } from "react";
import Image from "next/image";
import * as Dialog from "@radix-ui/react-dialog";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import type { GalleryImage } from "@/lib/gallery";

const SWIPE_PX = 40;

interface LightboxProps {
  images: GalleryImage[];
  openIndex: number | null;
  onClose: () => void;
  onNavigate: (index: number) => void;
}

export function Lightbox({ images, openIndex, onClose, onNavigate }: LightboxProps) {
  const isOpen = openIndex !== null;
  const total = images.length;
  const touchStartX = useRef<number | null>(null);

  const goTo = useCallback(
    (delta: number) => {
      if (openIndex === null || total <= 1) return;
      onNavigate((openIndex + delta + total) % total);
    },
    [openIndex, total, onNavigate],
  );

  useEffect(() => {
    if (!isOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowLeft") goTo(-1);
      else if (e.key === "ArrowRight") goTo(1);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, goTo]);

  const current = openIndex !== null ? images[openIndex] : null;
  const showNav = total > 1;

  return (
    <Dialog.Root open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-ink/85 backdrop-blur-md" />
        <Dialog.Content className="fixed inset-0 z-50 flex flex-col items-center justify-center p-3 focus:outline-none sm:p-6">
          <Dialog.Title className="sr-only">
            {current ? current.alt : "Photo viewer"}
          </Dialog.Title>
          <Dialog.Description className="sr-only">
            Swipe or use the arrows to browse photos. Press Escape to close.
          </Dialog.Description>

          <Dialog.Close
            className="absolute right-3 top-3 z-10 flex h-11 w-11 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur transition-colors hover:bg-white/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white sm:right-6 sm:top-6"
            aria-label="Close"
          >
            <X className="h-6 w-6" aria-hidden />
          </Dialog.Close>

          <div
            className="relative mt-12 flex h-[70svh] w-[min(92vw,56rem)] items-center justify-center sm:mt-0"
            onTouchStart={(event) => {
              touchStartX.current = event.changedTouches[0]?.clientX ?? null;
            }}
            onTouchEnd={(event) => {
              const start = touchStartX.current;
              touchStartX.current = null;
              if (start == null) return;
              const dx = (event.changedTouches[0]?.clientX ?? start) - start;
              if (Math.abs(dx) < SWIPE_PX) return;
              goTo(dx < 0 ? 1 : -1);
            }}
          >
            <AnimatePresence mode="wait">
              {current && (
                <motion.div
                  key={current.src}
                  initial={{ opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  transition={{ duration: 0.22, ease: "easeOut" }}
                  className="relative h-full w-full"
                >
                  <Image
                    src={current.lightboxSrc}
                    alt={current.alt}
                    fill
                    sizes="90vw"
                    priority
                    className="rounded-2xl object-contain drop-shadow-2xl"
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {current && (
            <div className="mt-3 flex items-center gap-2 rounded-full bg-white/10 px-2 py-1.5 text-sm font-semibold text-white/90 backdrop-blur sm:gap-3 sm:px-4">
              {showNav ? (
                <button
                  type="button"
                  onClick={() => goTo(-1)}
                  aria-label="Previous photo"
                  className="flex h-11 w-11 items-center justify-center rounded-full bg-white/15 text-white transition-colors hover:bg-white/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                >
                  <ChevronLeft className="h-6 w-6" aria-hidden />
                </button>
              ) : null}
              <span>
                {openIndex! + 1} / {total}
              </span>
              <span className="h-3 w-px bg-white/30" />
              <span className="max-w-[46vw] truncate sm:max-w-[60vw]">{current.alt}</span>
              {showNav ? (
                <button
                  type="button"
                  onClick={() => goTo(1)}
                  aria-label="Next photo"
                  className="flex h-11 w-11 items-center justify-center rounded-full bg-white/15 text-white transition-colors hover:bg-white/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                >
                  <ChevronRight className="h-6 w-6" aria-hidden />
                </button>
              ) : null}
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
