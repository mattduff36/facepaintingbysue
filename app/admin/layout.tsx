import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Studio | Facepainting by Sue",
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="admin-root">
      {/*
        THESIS: A studio clipboard for Sue — tabs for photos and details, not a SaaS dashboard.
        OWN-WORLD: Cream paper, ink type, paint-dot markers, purple only for the action that saves.
        STORY: Sign in, open a photo in the workspace, pin four, pick the share face, keep details true.
        FIRST VIEWPORT: Login card on cream; after login the photo gallery and workspace lead.
        FORM: Operate surface inside the Facepainting by Sue world.
        FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, and DESIGN.md
      */}
      {children}
    </div>
  );
}
