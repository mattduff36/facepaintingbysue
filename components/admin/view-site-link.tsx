import Link from "next/link";
import { ExternalLink } from "lucide-react";

export function ViewSiteLink() {
  return (
    <Link href="/" className="admin-nav-link">
      <ExternalLink className="admin-nav-icon" aria-hidden />
      View site
    </Link>
  );
}
