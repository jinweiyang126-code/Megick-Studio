/** Detect common video containers from magic bytes. */
export function sniffVideoContentType(buf: Buffer): string | null {
  if (buf.length >= 12 && buf.toString("ascii", 4, 8) === "ftyp") {
    return "video/mp4";
  }
  if (
    buf.length >= 4 &&
    buf[0] === 0x1a &&
    buf[1] === 0x45 &&
    buf[2] === 0xdf &&
    buf[3] === 0xa3
  ) {
    return "video/webm";
  }
  if (
    buf.length >= 12 &&
    buf.toString("ascii", 0, 4) === "RIFF" &&
    buf.toString("ascii", 8, 12) === "AVI "
  ) {
    return "video/avi";
  }
  return null;
}

/** Detect common still-image formats from magic bytes. */
export function sniffImageContentType(buf: Buffer): string | null {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    buf.length >= 8 &&
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47
  ) {
    return "image/png";
  }
  if (
    buf.length >= 12 &&
    buf.toString("ascii", 0, 4) === "RIFF" &&
    buf.toString("ascii", 8, 12) === "WEBP"
  ) {
    return "image/webp";
  }
  if (buf.length >= 6 && buf.toString("ascii", 0, 6) === "GIF87a") {
    return "image/gif";
  }
  if (buf.length >= 6 && buf.toString("ascii", 0, 6) === "GIF89a") {
    return "image/gif";
  }
  return null;
}

/** OSS keys / content types that look like still images (not playable video). */
export function isStillImageAsset(asset: {
  key?: string | null;
  contentType?: string | null;
}) {
  const contentType = asset.contentType?.trim().toLowerCase() ?? "";
  if (contentType.startsWith("image/")) return true;
  const key = asset.key?.trim() ?? "";
  return /\.(jpe?g|png|gif|webp|bmp|avif)(\?|#|$)/i.test(key);
}
