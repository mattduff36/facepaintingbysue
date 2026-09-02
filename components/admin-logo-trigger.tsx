"use client";

import { useRef } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { recordLogoTap } from "@/lib/admin-logo-taps";

export function AdminLogoTrigger({
  src,
  alt,
  width,
  height,
  className,
}: {
  src: string;
  alt: string;
  width: number;
  height: number;
  className?: string;
}) {
  const router = useRouter();
  const taps = useRef<number[]>([]);

  return (
    <span
      className="admin-logo-trigger"
      onPointerUp={(event) => {
        if (event.pointerType === "mouse" && event.button !== 0) return;
        const next = recordLogoTap(taps.current, Date.now());
        taps.current = next.times;
        if (next.unlocked) router.push("/admin");
      }}
    >
      <Image src={src} alt={alt} width={width} height={height} priority className={className} />
    </span>
  );
}
