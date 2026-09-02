import Image from "next/image";

export function BrandMark({
  logoSrc,
  size = "compact",
}: {
  logoSrc: string;
  size?: "compact" | "login";
}) {
  const dim = size === "login" ? 56 : 36;

  return (
    <span className={`brand-mark brand-mark-${size}`}>
      <Image
        src={logoSrc}
        alt=""
        width={dim}
        height={dim}
        className="brand-mark-logo"
        priority
      />
      <span className="brand-mark-word font-display font-extrabold leading-none rainbow-text">
        Facepainting
        <span className="brand-mark-by">by</span>
        Sue
      </span>
    </span>
  );
}
