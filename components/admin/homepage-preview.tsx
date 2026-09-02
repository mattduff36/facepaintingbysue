"use client";

import { useState } from "react";
import { applyStudioLayoutAction, setHiddenAction } from "@/app/admin/actions";
import { ContactCard } from "@/components/contact-card";
import type { GalleryImage } from "@/lib/gallery";
import { FEATURED_CELLS, ROTATING_CELLS } from "@/lib/mosaic-layout";
import type { SiteSettings } from "@/lib/site-settings";
import { mosaicSnapshot, proposeStudioDrop, type DropSource } from "@/lib/studio-layout";
import type { StudioRun } from "./studio-types";

export function HomepagePreview({
  images,
  settings,
  logoSrc,
  pending,
  error,
  message,
  run,
}: {
  images: GalleryImage[];
  settings: SiteSettings;
  logoSrc: string;
  pending: boolean;
  error: string;
  message: string;
  run: StudioRun;
}) {
  const [dragging, setDragging] = useState<DropSource | null>(null);
  const snapshot = mosaicSnapshot(images);

  function persistDrop(source: DropSource, dest: Parameters<typeof proposeStudioDrop>[2]) {
    const proposed = proposeStudioDrop(images, source, dest);
    setDragging(null);
    if (!proposed.ok) {
      run("", async () => ({ ok: false, error: proposed.error }));
      return;
    }
    const label = dest.to === "tray" ? "Held back from the homepage." : "Homepage layout saved.";
    run(label, () => applyStudioLayoutAction(proposed.value.plan), proposed.value.images);
  }

  return (
    <section className="admin-homepage" aria-labelledby="homepage-heading">
      <header className="admin-photos-head">
        <div>
          <h2 id="homepage-heading">Homepage</h2>
          <p>This is the desktop card visitors see. Drag faces to rearrange them, or drop one on Held back to hide it.</p>
        </div>
      </header>

      {error ? <p className="admin-error" role="alert">{error}</p> : null}
      {message ? <p className="admin-ok" role="status">{message}</p> : null}

      <div className="admin-mosaic-frame">
        <div className="admin-mosaic" aria-label="Homepage mosaic preview">
          <div className="admin-mosaic-card">
            <ContactCard settings={settings} logoSrc={logoSrc} />
          </div>
          {snapshot.featuredSlots.map((image, index) => (
            <MosaicSlot
              key={`feat-${index}`}
              cell={FEATURED_CELLS[index]}
              image={image}
              kind="featured"
              index={index}
              pending={pending}
              dragging={dragging}
              onDragStart={() => image && setDragging({ from: "featured", index })}
              onDrop={(source) => persistDrop(source, { to: "featured", index })}
            />
          ))}
          {snapshot.rotatingSlots.map((image, index) => (
            <MosaicSlot
              key={`rot-${index}`}
              cell={ROTATING_CELLS[index]}
              image={image}
              kind="rotating"
              index={index}
              pending={pending}
              dragging={dragging}
              onDragStart={() => image && setDragging({ from: "rotating", index })}
              onDrop={(source) => persistDrop(source, { to: "rotating", index })}
            />
          ))}
        </div>
      </div>

      <section
        className="admin-holdback"
        aria-labelledby="holdback-heading"
        onDragOver={(event) => event.preventDefault()}
        onDrop={() => {
          if (!dragging) return;
          persistDrop(dragging, { to: "tray" });
        }}
      >
        <header className="admin-photo-group-head">
          <h3 id="holdback-heading">Held back</h3>
          <p>Drop a face here to hide it from the homepage. Show it again, or drag it back onto the mosaic.</p>
        </header>
        {snapshot.hidden.length === 0 ? (
          <p className="admin-photo-group-empty">Nothing held back.</p>
        ) : (
          <ul className="admin-thumbs admin-holdback-thumbs">
            {snapshot.hidden.map((image) => (
              <li
                key={image.publicId}
                className="admin-thumb-item is-hidden"
                draggable={!pending}
                onDragStart={() => setDragging({ from: "tray", publicId: image.publicId })}
                onDragEnd={() => setDragging(null)}
              >
                <div className="admin-thumb">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={image.src} alt={image.alt} />
                  <span className="admin-thumb-dim" aria-hidden />
                  <span className="admin-chip admin-chip-held">Hidden</span>
                  <button
                    type="button"
                    className="admin-holdback-show"
                    disabled={pending}
                    onClick={() => {
                      run(
                        "Shown on the homepage.",
                        () => setHiddenAction(image.publicId, false),
                        images.map((item) =>
                          item.publicId === image.publicId ? { ...item, hidden: false } : item,
                        ),
                      );
                    }}
                  >
                    Show
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </section>
  );
}

function MosaicSlot({
  cell,
  image,
  kind,
  pending,
  dragging,
  onDragStart,
  onDrop,
}: {
  cell: { col: number; row: number };
  image: GalleryImage | null;
  kind: "featured" | "rotating";
  index: number;
  pending: boolean;
  dragging: DropSource | null;
  onDragStart: () => void;
  onDrop: (source: DropSource) => void;
}) {
  return (
    <div
      className={`admin-mosaic-slot${image ? "" : " is-empty"}${kind === "featured" ? " is-featured-slot" : ""}`}
      style={{ gridColumn: cell.col, gridRow: cell.row }}
      onDragOver={(event) => event.preventDefault()}
      onDrop={() => dragging && onDrop(dragging)}
    >
      {image ? (
        <button
          type="button"
          className="admin-mosaic-tile"
          draggable={!pending}
          disabled={pending}
          onDragStart={onDragStart}
          onDragEnd={() => undefined}
          aria-label={image.alt || "Gallery photo"}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={image.src} alt="" />
          {image.hero ? <span className="admin-chip">Share</span> : null}
          {image.featured && !image.hero ? <span className="admin-chip admin-chip-quiet">Featured</span> : null}
        </button>
      ) : (
        <span className="admin-mosaic-empty">Drop here</span>
      )}
    </div>
  );
}
