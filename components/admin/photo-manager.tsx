"use client";

import { useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import type { GalleryImage } from "@/lib/gallery";
import { FEATURED_CAP, FEATURED_CAP_ERROR } from "@/lib/gallery-invariants";
import { proposeGroupMove } from "@/lib/studio-layout";
import { galleryFingerprint } from "@/lib/studio-lock";
import {
  applyStudioLayoutAction,
  archivePhotoAction,
  archivePhotosAction,
  reorderPhotosAction,
  setAltAction,
  setFeaturedAction,
  setFeaturedManyAction,
  setHiddenAction,
  setHiddenManyAction,
  setHeroAction,
  uploadPhotoAction,
} from "@/app/admin/actions";
import type { StudioRun } from "./studio-types";

export function PhotoManager({
  images,
  pending,
  error,
  message,
  run,
}: {
  images: GalleryImage[];
  pending: boolean;
  error: string;
  message: string;
  run: StudioRun;
}) {
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [confirmBulkIds, setConfirmBulkIds] = useState<string[] | null>(null);
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [anchorId, setAnchorId] = useState<string | null>(null);
  const [selectMode, setSelectMode] = useState(false);
  const [workspaceOpen, setWorkspaceOpen] = useState(false);
  const [dragging, setDragging] = useState<string | null>(null);
  const [altDrafts, setAltDrafts] = useState<Record<string, string>>(() =>
    Object.fromEntries(images.map((image) => [image.publicId, image.alt])),
  );
  const skipClickRef = useRef(false);

  const shown = useMemo(() => images.filter((image) => !image.hidden), [images]);
  const held = useMemo(() => images.filter((image) => image.hidden), [images]);
  const featuredCount = useMemo(
    () => shown.filter((image) => image.featured).length,
    [shown],
  );
  const focused = images.find((image) => image.publicId === focusedId) ?? null;
  const selectedImages = images.filter((image) => selected.has(image.publicId));
  const bulkActive = selected.size >= 2;
  const selectedHidden = selectedImages.filter((image) => image.hidden);
  const selectedVisible = selectedImages.filter((image) => !image.hidden);
  const unfeaturedSelected = selectedVisible.filter((image) => !image.featured);
  const canFeature =
    selectedHidden.length === 0 &&
    unfeaturedSelected.length > 0 &&
    featuredCount + unfeaturedSelected.length <= FEATURED_CAP;
  const unpinable = selectedVisible.filter((image) => image.featured && !image.hero);
  const canUnpin = selectedHidden.length === 0 && unpinable.length > 0;
  const canHide = selectedVisible.length > 0 && shown.length - selectedVisible.length >= 1;
  const canShow = selectedHidden.length > 0;
  const canRemove = selectedHidden.length === 0 && selectedVisible.length > 0 && shown.length - selectedVisible.length >= 1;

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      const mobile = window.matchMedia("(max-width: 1023px)").matches;
      if (mobile && workspaceOpen) {
        setWorkspaceOpen(false);
        return;
      }
      if (selected.size > 0) {
        replaceSelection(new Set());
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selected.size, workspaceOpen]);

  function replaceSelection(next: Set<string>) {
    setSelected(next);
    setConfirmBulkIds(null);
  }

  function pruneSelection(nextImages: GalleryImage[], nextFocused = focusedId) {
    const live = new Set(nextImages.map((image) => image.publicId));
    replaceSelection(new Set([...selected].filter((id) => live.has(id))));
    setConfirmId((id) => (id && live.has(id) ? id : null));
    if (nextFocused && !live.has(nextFocused)) {
      setFocusedId(nextImages[0]?.publicId ?? null);
      setWorkspaceOpen(false);
    }
  }

  function runChange(label: string, work: () => Promise<{ ok: boolean; error?: string }>, next?: GalleryImage[]) {
    if (next) pruneSelection(next);
    run(label, work, next);
  }

  function clearSelection() {
    replaceSelection(new Set());
  }

  function toggleSelectMode() {
    setSelectMode((current) => {
      const next = !current;
      if (next) setWorkspaceOpen(false);
      return next;
    });
  }

  function onThumbActivate(event: MouseEvent, image: GalleryImage, group: GalleryImage[]) {
    if (skipClickRef.current) {
      skipClickRef.current = false;
      return;
    }

    const id = image.publicId;

    if (selectMode) {
      const next = new Set(selected);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      replaceSelection(next);
      setAnchorId(id);
      if (next.has(id) || !focusedId) setFocusedId(id);
      if (focusedId === id && !next.has(id)) {
        const remaining = [...next];
        setFocusedId(remaining.at(-1) ?? null);
      }
      return;
    }

    if (event.shiftKey && anchorId) {
      const from = group.findIndex((item) => item.publicId === anchorId);
      const to = group.findIndex((item) => item.publicId === id);
      if (from >= 0 && to >= 0) {
        const start = Math.min(from, to);
        const end = Math.max(from, to);
        replaceSelection(new Set(group.slice(start, end + 1).map((item) => item.publicId)));
        setFocusedId(id);
        return;
      }
    }

    if (event.metaKey || event.ctrlKey) {
      const next = new Set(selected);
      if (next.has(id)) {
        next.delete(id);
        if (focusedId === id) {
          const remaining = [...next];
          setFocusedId(remaining.at(-1) ?? null);
          if (remaining.length === 0) setWorkspaceOpen(false);
        }
      } else {
        next.add(id);
        if (!focusedId) setFocusedId(id);
      }
      replaceSelection(next);
      setAnchorId(id);
      return;
    }

    setFocusedId(id);
    replaceSelection(new Set([id]));
    setAnchorId(id);
    setWorkspaceOpen(true);
    setConfirmId(null);
  }

  function optimisticArchive(ids: Set<string>) {
    const remaining = images.filter((image) => !ids.has(image.publicId));
    if (!remaining.some((image) => image.hero && !image.hidden) && remaining.some((image) => !image.hidden)) {
      const replacement = remaining.find((image) => !image.hidden && image.featured) ?? remaining.find((image) => !image.hidden);
      if (!replacement) return remaining;
      return remaining.map((image) => ({
        ...image,
        hero: image.publicId === replacement.publicId,
        featured: image.publicId === replacement.publicId ? true : image.featured,
      }));
    }
    return remaining;
  }

  function optimisticHide(ids: Set<string>) {
    let next = images.map((image) =>
      ids.has(image.publicId) ? { ...image, hidden: true, featured: false, hero: false } : image,
    );
    if (!next.some((image) => image.hero && !image.hidden)) {
      const replacement = next.find((image) => !image.hidden && image.featured) ?? next.find((image) => !image.hidden);
      if (replacement) {
        next = next.map((image) =>
          image.publicId === replacement.publicId ? { ...image, hero: true, featured: true } : image,
        );
      }
    }
    return next;
  }

  function dropOnGroup(dest: "shown" | "hidden", beforeId?: string) {
    if (!dragging) return;
    const moving = images.find((image) => image.publicId === dragging);
    if (!moving) return;
    if (dest === "hidden" && !moving.hidden && shown.length <= 1) return;
    const proposed = proposeGroupMove(images, dragging, dest, beforeId);
    setDragging(null);
    if (!proposed.ok) {
      runChange("", async () => ({ ok: false, error: proposed.error }));
      return;
    }
    const sameGroup = dest === "hidden" ? moving.hidden : !moving.hidden;
    const label = sameGroup ? "Photo order saved." : dest === "hidden" ? "Held back from the homepage." : "Shown on the homepage.";
    runChange(label, () => applyStudioLayoutAction(proposed.value.plan, galleryFingerprint(images)), proposed.value.images);
  }

  function reorderWithin(group: GalleryImage[], fromId: string, toId: string) {
    const from = group.findIndex((item) => item.publicId === fromId);
    const to = group.findIndex((item) => item.publicId === toId);
    if (from < 0 || to < 0 || from === to) return;
    const nextGroup = group.slice();
    const [moved] = nextGroup.splice(from, 1);
    nextGroup.splice(to, 0, moved);
    const other = images.filter((image) => (group[0]?.hidden ? !image.hidden : image.hidden));
    const next = group[0]?.hidden ? [...other, ...nextGroup] : [...nextGroup, ...other];
    runChange(
      "Photo order saved.",
      () => reorderPhotosAction(
        next.map((item) => item.publicId),
        galleryFingerprint(images),
      ),
      next,
    );
  }

  return (
    <section className="admin-photos" aria-labelledby="photos-heading">
      <header className="admin-photos-head">
        <div>
          <h2 id="photos-heading">Photos</h2>
          <p>Pin up to eight featured faces. Hold seasonal photos back without removing them.</p>
        </div>
        <div className="admin-photos-tools">
          <button
            type="button"
            className={`admin-select-toggle${selectMode ? " is-on" : ""}`}
            aria-pressed={selectMode}
            onClick={toggleSelectMode}
          >
            {selectMode ? "Done" : "Select"}
          </button>
          <label className="admin-upload">
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              disabled={pending}
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (!file) return;
                const data = new FormData();
                data.set("file", file);
                runChange("Photo added.", async () => {
                  const result = await uploadPhotoAction(data);
                  if (result.ok) window.location.reload();
                  return result;
                });
              }}
            />
            {pending ? "Working…" : "Add photos"}
          </label>
        </div>
      </header>

      {error ? <p className="admin-error" role="alert">{error}</p> : null}
      {message ? <p className="admin-ok" role="status">{message}</p> : null}

      {bulkActive ? (
        <div className="admin-bulk" role="toolbar" aria-label="Selected photos">
          <p className="admin-bulk-count">{selected.size} selected</p>
          <button
            type="button"
            disabled={pending || !canFeature}
            onClick={() =>
              runChange(
                "Pinned as featured.",
                () => setFeaturedManyAction([...selected], true),
                images.map((item) =>
                  selected.has(item.publicId) && !item.featured && !item.hidden ? { ...item, featured: true } : item,
                ),
              )
            }
          >
            Feature
          </button>
          <button
            type="button"
            disabled={pending || !canUnpin}
            onClick={() =>
              runChange(
                "Unpinned.",
                () => setFeaturedManyAction([...selected], false),
                images.map((item) =>
                  unpinable.some((photo) => photo.publicId === item.publicId)
                    ? { ...item, featured: false }
                    : item,
                ),
              )
            }
          >
            Unpin
          </button>
          <button
            type="button"
            disabled={pending || !canHide}
            onClick={() =>
              runChange("Held back from the homepage.", () => setHiddenManyAction([...selectedVisible.map((item) => item.publicId)], true), optimisticHide(new Set(selectedVisible.map((item) => item.publicId))))
            }
          >
            Hide
          </button>
          <button
            type="button"
            disabled={pending || !canShow}
            onClick={() =>
              runChange(
                "Shown on the homepage.",
                () => setHiddenManyAction([...selectedHidden.map((item) => item.publicId)], false),
                images.map((item) => (selected.has(item.publicId) ? { ...item, hidden: false } : item)),
              )
            }
          >
            Show
          </button>
          {confirmBulkIds ? (
            <button
              type="button"
              className="is-danger"
              disabled={pending || !canRemove}
              onClick={() =>
                runChange(
                  "Photos removed from the site.",
                  () => archivePhotosAction(confirmBulkIds),
                  optimisticArchive(new Set(confirmBulkIds)),
                )
              }
            >
              Confirm remove
            </button>
          ) : (
            <button
              type="button"
              className="is-quiet"
              disabled={pending || !canRemove}
              onClick={() => setConfirmBulkIds([...selectedVisible.map((item) => item.publicId)])}
            >
              Remove
            </button>
          )}
          <button type="button" className="is-quiet" disabled={pending} onClick={clearSelection}>
            Clear selection
          </button>
          {!canFeature && unfeaturedSelected.length > 0 && selectedHidden.length === 0 ? (
            <p className="admin-bulk-hint">{FEATURED_CAP_ERROR}</p>
          ) : null}
          {selectedHidden.length > 0 ? (
            <p className="admin-bulk-hint">Show a photo first before featuring, sharing, or removing it.</p>
          ) : null}
          {selectedVisible.length > 0 && shown.length - selectedVisible.length < 1 ? (
            <p className="admin-bulk-hint">Keep at least one photo on the site.</p>
          ) : null}
        </div>
      ) : null}

      {images.length === 0 ? (
        error ? null : (
          <p className="admin-empty">Add Sue&rsquo;s first photo to fill the homepage mosaic.</p>
        )
      ) : (
        <div className="admin-photos-split">
          <div className={`admin-photo-groups${bulkActive ? " is-bulk" : ""}`}>
            <PhotoGroup
              title="On the homepage"
              hint="These faces appear on the card. Drag onto Held back to hide them for later."
              images={shown}
              dimmed={false}
              focusedId={focusedId}
              selected={selected}
              dragging={dragging}
              pending={pending}
              selectMode={selectMode}
              skipClickRef={skipClickRef}
              onActivate={onThumbActivate}
              onDragStart={setDragging}
              onReorder={(fromId, toId) => reorderWithin(shown, fromId, toId)}
              onDropOnGroup={(beforeId) => dropOnGroup("shown", beforeId)}
            />
            <PhotoGroup
              title="Held back"
              hint="Hidden from visitors. Drag back onto the homepage list, or Show, when the season returns."
              images={held}
              dimmed
              focusedId={focusedId}
              selected={selected}
              dragging={dragging}
              pending={pending}
              selectMode={selectMode}
              skipClickRef={skipClickRef}
              onActivate={onThumbActivate}
              onDragStart={setDragging}
              onReorder={(fromId, toId) => reorderWithin(held, fromId, toId)}
              onDropOnGroup={(beforeId) => dropOnGroup("hidden", beforeId)}
            />
          </div>

          <div className={`admin-workspace${workspaceOpen ? " is-open" : ""}`}>
            <div className="admin-workspace-bar">
              <button type="button" className="admin-workspace-back" onClick={() => setWorkspaceOpen(false)}>
                Back
              </button>
              <p>{focused ? "Edit photo" : "Photo"}</p>
            </div>

            {focused ? (
              <WorkspacePhoto
                image={focused}
                altValue={altDrafts[focused.publicId] ?? ""}
                featuredCount={featuredCount}
                pending={pending}
                confirmId={confirmId}
                canHide={shown.length > 1 || focused.hidden}
                onAltChange={(value) =>
                  setAltDrafts((current) => ({ ...current, [focused.publicId]: value }))
                }
                onAltBlur={(value) => {
                  if (value === focused.alt) return;
                  runChange(
                    "Description saved.",
                    () => setAltAction(focused.publicId, value),
                    images.map((item) =>
                      item.publicId === focused.publicId ? { ...item, alt: value, storedAlt: value } : item,
                    ),
                  );
                }}
                onFeature={() =>
                  runChange(
                    focused.featured ? "Unpinned." : "Pinned as featured.",
                    () => setFeaturedAction(focused.publicId, !focused.featured),
                    images.map((item) =>
                      item.publicId === focused.publicId ? { ...item, featured: !item.featured } : item,
                    ),
                  )
                }
                onShare={() =>
                  runChange(
                    "Share photo updated.",
                    () => setHeroAction(focused.publicId),
                    images.map((item) => ({
                      ...item,
                      hero: item.publicId === focused.publicId,
                      featured: item.publicId === focused.publicId ? true : item.featured,
                    })),
                  )
                }
                onHide={() =>
                  runChange(
                    focused.hidden ? "Shown on the homepage." : "Held back from the homepage.",
                    () => setHiddenAction(focused.publicId, !focused.hidden),
                    focused.hidden
                      ? images.map((item) => (item.publicId === focused.publicId ? { ...item, hidden: false } : item))
                      : optimisticHide(new Set([focused.publicId])),
                  )
                }
                onRemoveAsk={() => setConfirmId(focused.publicId)}
                onRemoveConfirm={() =>
                  runChange(
                    "Photo removed from the site.",
                    () => archivePhotoAction(focused.publicId),
                    optimisticArchive(new Set([focused.publicId])),
                  )
                }
              />
            ) : (
              <p className="admin-workspace-empty">Choose a photo to edit.</p>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

function PhotoGroup({
  title,
  hint,
  images,
  dimmed,
  focusedId,
  selected,
  dragging,
  pending,
  selectMode,
  skipClickRef,
  onActivate,
  onDragStart,
  onReorder,
  onDropOnGroup,
}: {
  title: string;
  hint: string;
  images: GalleryImage[];
  dimmed: boolean;
  focusedId: string | null;
  selected: Set<string>;
  dragging: string | null;
  pending: boolean;
  selectMode: boolean;
  skipClickRef: { current: boolean };
  onActivate: (event: MouseEvent, image: GalleryImage, group: GalleryImage[]) => void;
  onDragStart: (id: string) => void;
  onReorder: (fromId: string, toId: string) => void;
  onDropOnGroup: (beforeId?: string) => void;
}) {
  return (
    <section
      className={`admin-photo-group${dimmed ? " is-held" : ""}`}
      onDragOver={(event) => event.preventDefault()}
      onDrop={() => onDropOnGroup()}
    >
      <header className="admin-photo-group-head">
        <h3>{title}</h3>
        <p>{hint}</p>
      </header>
      {images.length === 0 ? (
        <p className="admin-photo-group-empty">{dimmed ? "Nothing held back." : "Add a photo to show on the homepage."}</p>
      ) : (
        <ul className="admin-thumbs">
          {images.map((image) => {
            const isFocused = focusedId === image.publicId;
            const isSelected = selected.has(image.publicId);
            return (
              <li
                key={image.publicId}
                className={[
                  "admin-thumb-item",
                  image.featured ? "is-featured" : "",
                  image.hero ? "is-hero" : "",
                  dimmed ? "is-hidden" : "",
                  dragging === image.publicId ? "is-dragging" : "",
                  isFocused ? "is-focused" : "",
                  isSelected ? "is-selected" : "",
                ].join(" ")}
                draggable={!pending && !selectMode}
                onDragStart={() => onDragStart(image.publicId)}
                onDragEnd={() => {
                  skipClickRef.current = true;
                  onDragStart("");
                }}
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                  event.stopPropagation();
                  if (!dragging || dragging === image.publicId) return;
                  const sameList = images.some((item) => item.publicId === dragging);
                  if (sameList) {
                    onReorder(dragging, image.publicId);
                    return;
                  }
                  onDropOnGroup(image.publicId);
                }}
              >
                <button
                  type="button"
                  className="admin-thumb"
                  aria-pressed={isSelected}
                  aria-current={isFocused ? "true" : undefined}
                  aria-label={image.alt || "Gallery photo"}
                  disabled={pending}
                  onClick={(event) => onActivate(event, image, images)}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={image.src} alt="" />
                  {dimmed ? <span className="admin-thumb-dim" aria-hidden /> : null}
                  {image.hero ? <span className="admin-chip">Share</span> : null}
                  {image.featured && !image.hero ? <span className="admin-chip admin-chip-quiet">Featured</span> : null}
                  {dimmed ? <span className="admin-chip admin-chip-held">Hidden</span> : null}
                  {isSelected ? <span className="admin-thumb-mark" aria-hidden /> : null}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function WorkspacePhoto({
  image,
  altValue,
  featuredCount,
  pending,
  confirmId,
  canHide,
  onAltChange,
  onAltBlur,
  onFeature,
  onShare,
  onHide,
  onRemoveAsk,
  onRemoveConfirm,
}: {
  image: GalleryImage;
  altValue: string;
  featuredCount: number;
  pending: boolean;
  confirmId: string | null;
  canHide: boolean;
  onAltChange: (value: string) => void;
  onAltBlur: (value: string) => void;
  onFeature: () => void;
  onShare: () => void;
  onHide: () => void;
  onRemoveAsk: () => void;
  onRemoveConfirm: () => void;
}) {
  const featuredLocked = featuredCount >= FEATURED_CAP && !image.featured;
  const hidden = image.hidden;

  return (
    <div className="admin-workspace-photo">
      <div className="admin-workspace-preview">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          className="admin-workspace-preview-fill"
          src={image.lightboxSrc || image.src}
          alt=""
          aria-hidden
        />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          className="admin-workspace-preview-photo"
          src={image.lightboxSrc || image.src}
          alt={image.alt}
        />
        {image.hero ? <span className="admin-chip">Share</span> : null}
        {image.featured && !image.hero ? <span className="admin-chip admin-chip-quiet">Featured</span> : null}
        {hidden ? <span className="admin-chip admin-chip-held">Hidden</span> : null}
      </div>
      <label className="admin-alt">
        Description
        <input
          value={altValue}
          disabled={pending || hidden}
          maxLength={160}
          onChange={(event) => onAltChange(event.target.value)}
          onBlur={(event) => onAltBlur(event.target.value)}
        />
      </label>
      <div className="admin-photo-actions">
        <button type="button" disabled={pending || hidden || featuredLocked || image.hero} onClick={onFeature}>
          {image.featured ? "Unpin" : "Feature"}
        </button>
        <button type="button" disabled={pending || hidden || image.hero} onClick={onShare}>
          {image.hero ? "Sharing" : "Share this"}
        </button>
        <button type="button" disabled={pending || !canHide} onClick={onHide}>
          {hidden ? "Show" : "Hide"}
        </button>
        {confirmId === image.publicId ? (
          <button type="button" className="is-danger" disabled={pending || hidden} onClick={onRemoveConfirm}>
            Confirm remove
          </button>
        ) : (
          <button type="button" className="is-quiet" disabled={pending || hidden} onClick={onRemoveAsk}>
            Remove
          </button>
        )}
      </div>
    </div>
  );
}
