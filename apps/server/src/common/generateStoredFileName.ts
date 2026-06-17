import { randomBytes } from "crypto";
import { extname } from "path";

export function generateStoredFileName(originalName: string) {
  const extension = extname(originalName || "").toLowerCase() || ".bin";
  const randomPart = randomBytes(24).toString("hex");
  return `${randomPart}${extension}`;
}
