export const GALLERY_PREFIX = "facepaintingbysue/gallery";
export const BRAND_PREFIX = "facepaintingbysue/brand";

export function deliveryUrl(options: {
  cloudName: string;
  publicId: string;
  version?: number;
  transform?: string;
}): string {
  const transform = options.transform ?? "f_auto,q_auto";
  const version = options.version ? `/v${options.version}` : "";
  return `https://res.cloudinary.com/${options.cloudName}/image/upload/${transform}${version}/${options.publicId}`;
}

export function tileUrl(cloudName: string, publicId: string, version?: number): string {
  return deliveryUrl({
    cloudName,
    publicId,
    version,
    transform: "f_auto,q_auto,c_fill,w_800,h_1067",
  });
}

export function lightboxUrl(cloudName: string, publicId: string, version?: number): string {
  return deliveryUrl({
    cloudName,
    publicId,
    version,
    transform: "f_auto,q_auto,c_fit,w_1600",
  });
}

export function logoUrl(cloudName: string, publicId: string, version?: number): string {
  return deliveryUrl({
    cloudName,
    publicId,
    version,
    transform: "f_auto,q_auto,h_240",
  });
}

export function ogUrl(cloudName: string, publicId: string, version?: number): string {
  return deliveryUrl({
    cloudName,
    publicId,
    version,
    transform: "f_auto,q_auto,c_fill,w_1000,h_1333",
  });
}

export function rawUrl(cloudName: string, publicId: string, version?: number): string {
  const versionPart = version ? `/v${version}` : "";
  return `https://res.cloudinary.com/${cloudName}/raw/upload${versionPart}/${publicId}`;
}
