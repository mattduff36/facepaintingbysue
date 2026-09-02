"use client";

import { useCallback, useEffect } from "react";
import Image from "next/image";
import * as Dialog from "@radix-ui/react-dialog";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import type { GalleryImage } from "@/lib/gallery";

interface LightboxProps {
  images: GalleryImage[];
  openIndex: number | null;
  onClose: () => void;
  onNavigate: (index: number) => void;
}

export function Lightbox({ images, openIndex, onClose, onNavigate }: LightboxProps) {
  const isOpen = openIndex !== null;
  const total = images.length;

  const goTo = useCallback(
    (delta: number) => {
      if (openIndex === null || total === 0) return;
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

  return (
    <Dialog.Root open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-ink/85 backdrop-blur-md" />
        <Dialog.Content
          className="fixed inset-0 z-50 flex flex-col items-center justify-center p-3 focus:outline-none sm:p-6"
          aria-describedby={undefined}
        >
          <Dialog.Title className="sr-only">
            {current ? current.alt : "Photo viewer"}
          </Dialog.Title>

          {/* Close */}
          <Dialog.Close
            className="absolute right-3 top-3 z-10 flex h-11 w-11 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur transition-colors hover:bg-white/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white sm:right-6 sm:top-6"
            aria-label="Close"
          >
            <X className="h-6 w-6" aria-hidden />
          </Dialog.Close>

          {/* Prev */}
          <button
            type="button"
            onClick={() => goTo(-1)}
            aria-label="Previous photo"
            className="absolute left-2 top-1/2 z-10 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur transition-colors hover:bg-white/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white sm:left-6 sm:h-14 sm:w-14"
          >
            <ChevronLeft className="h-7 w-7" aria-hidden />
          </button>

          {/* Next */}
          <button
            type="button"
            onClick={() => goTo(1)}
            aria-label="Next photo"
            className="absolute right-2 top-1/2 z-10 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur transition-colors hover:bg-white/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white sm:right-6 sm:h-14 sm:w-14"
          >
            <ChevronRight className="h-7 w-7" aria-hidden />
          </button>

          {/* Image */}
          <div className="relative flex h-[80vh] w-[92vw] items-center justify-center sm:w-[86vw]">
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

          {/* Caption / counter */}
          {current && (
            <div className="mt-3 flex items-center gap-3 rounded-full bg-white/10 px-4 py-1.5 text-sm font-semibold text-white/90 backdrop-blur">
              <span>
                {openIndex! + 1} / {total}
              </span>
              <span className="h-3 w-px bg-white/30" />
              <span className="max-w-[60vw] truncate">{current.alt}</span>
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
