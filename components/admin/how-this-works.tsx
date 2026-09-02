"use client";

import { useRef, useState, type KeyboardEvent } from "react";
import { ChevronDown } from "lucide-react";

const TOPICS = [
  { id: "photos", title: "Photos" },
  { id: "homepage", title: "Homepage" },
  { id: "badges", title: "The badges" },
  { id: "selecting", title: "Selecting more than one" },
  { id: "hiding", title: "Hiding and removing" },
  { id: "settings", title: "Site settings" },
  { id: "finding", title: "Finding the studio again" },
] as const;

type TopicId = (typeof TOPICS)[number]["id"];

function TopicBody({ id }: { id: TopicId }) {
  if (id === "photos") {
    return (
      <>
        <p>
          Click a thumbnail to open it on the right. On the homepage photos sit in one list; seasonal or spare
          faces sit in Held back. Drag between those two lists to show or hide a photo. Drag within a list to
          change the order. Use Add photos to drop in a JPEG, PNG, or WebP.
        </p>
        <p>
          The description under the big preview is what visitors hear from screen readers and what search engines
          read. Keep it short and true.
        </p>
      </>
    );
  }
  if (id === "homepage") {
    return (
      <>
        <p>
          Homepage is a true preview of the desktop card: the contact details in the middle, four featured
          faces along the bottom, four more along the top, and the other tiles around the edge. The first four
          featured sit below the card; the next four sit above. It does not shuffle while you work, so you can
          see the first picture visitors get.
        </p>
        <p>
          Drag a tile onto another to swap them. Drop onto an empty tile to move a face there. Drop onto Held
          back to hide it from the public site without removing it. Drag a held-back face back onto the mosaic,
          or tap Show, when you want it again.
        </p>
      </>
    );
  }
  if (id === "badges") {
    return (
      <>
        <p>
          <span className="admin-guide-chip">Share</span>
          This is the face used when someone posts the site. It is always one of the featured eight. Pick a
          different photo with Share this if you want to change it. You cannot unpin the share photo until
          another one is sharing.
        </p>
        <p>
          <span className="admin-guide-chip admin-guide-chip-quiet">Featured</span>
          These eight sit on the homepage card: four below the middle, then four above. Pin with Feature, take
          one off with Unpin. You can only have eight at a time. On Homepage, the share photo can sit in any of
          those slots.
        </p>
        <p>
          <span className="admin-guide-chip admin-guide-chip-held">Hidden</span>
          Held back from visitors. Christmas and Halloween faces can live here the rest of the year. Hide does
          not delete the photo.
        </p>
      </>
    );
  }
  if (id === "selecting") {
    return (
      <>
        <p>
          On a computer, hold Ctrl (or Cmd on a Mac) and click to add or remove photos. Hold Shift and click to
          take a run of photos between the last one you touched and this one. Escape clears the selection.
        </p>
        <p>
          On a phone, tap Select, then tap the photos you want. Tap Done when you are finished. The bar at the
          bottom can Feature, Unpin, Hide, Show, or Remove the ones you picked. The site always keeps at least
          one photo on the homepage.
        </p>
      </>
    );
  }
  if (id === "hiding") {
    return (
      <>
        <p>
          Hide holds a photo back from the homepage, the phone gallery, and the lightbox. It stays in the
          studio so you can Show it later. Drag it to Held back, or use Hide on the photo.
        </p>
        <p>
          Remove is different: after you confirm, the photo leaves the studio as well as the public site. Show
          a hidden photo first if you want to remove it. The site always keeps at least one photo visible.
        </p>
      </>
    );
  }
  if (id === "settings") {
    return (
      <p>
        Phone, email, Facebook, area, tagline, and availability appear on the homepage card. The booking
        subject and message fill the enquire email. Page title and description are for Google and sharing.
        Replace logo updates the palette at the top of the card.
      </p>
    );
  }
  return (
    <p>
      The studio is not linked from the public site. On the homepage, tap the logo five times within three
      seconds and you will land here. Bookmark /admin if you would rather skip the taps.
    </p>
  );
}

export function HowThisWorks() {
  const [active, setActive] = useState<TopicId>("photos");
  const topic = TOPICS.find((item) => item.id === active) ?? TOPICS[0];
  const buttonRefs = useRef<Partial<Record<TopicId, HTMLButtonElement | null>>>({});

  function selectTopic(id: TopicId) {
    setActive(id);
    buttonRefs.current[id]?.focus();
  }

  function onTopicKeyDown(event: KeyboardEvent<HTMLButtonElement>, current: TopicId) {
    const index = TOPICS.findIndex((item) => item.id === current);
    if (event.key === "ArrowDown" || event.key === "ArrowRight") {
      event.preventDefault();
      selectTopic(TOPICS[(index + 1) % TOPICS.length].id);
      return;
    }
    if (event.key === "ArrowUp" || event.key === "ArrowLeft") {
      event.preventDefault();
      selectTopic(TOPICS[(index - 1 + TOPICS.length) % TOPICS.length].id);
      return;
    }
    if (event.key === "Home") {
      event.preventDefault();
      selectTopic(TOPICS[0].id);
      return;
    }
    if (event.key === "End") {
      event.preventDefault();
      selectTopic(TOPICS[TOPICS.length - 1].id);
    }
  }

  return (
    <section className="admin-guide" aria-labelledby="guide-heading">
      <header className="admin-section-head">
        <div>
          <h2 id="guide-heading">How this works</h2>
          <p>A quick tour of the studio so you can pin faces, pick a share photo, and keep the card up to date.</p>
        </div>
      </header>

      <div className="admin-guide-split">
        <div className="admin-guide-toc" role="list">
          {TOPICS.map((item) => {
            const selected = item.id === active;
            return (
              <div key={item.id} className={`admin-guide-item${selected ? " is-active" : ""}`} role="listitem">
                <button
                  ref={(node) => {
                    buttonRefs.current[item.id] = node;
                  }}
                  type="button"
                  id={`admin-guide-tab-${item.id}`}
                  className="admin-guide-topic"
                  aria-current={selected ? "true" : undefined}
                  aria-controls="admin-guide-panel"
                  onClick={() => setActive(item.id)}
                  onKeyDown={(event) => onTopicKeyDown(event, item.id)}
                >
                  <span>{item.title}</span>
                  <ChevronDown className="admin-guide-chevron" aria-hidden />
                </button>
              </div>
            );
          })}
        </div>
        <div
          id="admin-guide-panel"
          className="admin-guide-panel"
          role="region"
          aria-labelledby={`admin-guide-tab-${active}`}
        >
          <h3 className="admin-guide-panel-title">{topic.title}</h3>
          <TopicBody id={active} />
        </div>
      </div>
    </section>
  );
}
