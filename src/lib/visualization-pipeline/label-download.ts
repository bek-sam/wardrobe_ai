import sharp from "sharp";

import { AI_TRYON_DISCLAIMER } from "@/lib/visualization";

const FOOTER_HEIGHT = 84;

function escapeXml(value: string): string {
  return value.replace(
    /[<>&'"]/g,
    (character) =>
      ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" })[character] ??
      character,
  );
}

/**
 * Burns the AI-preview label into a footer strip on the downloaded file. A
 * caption in the page is not enough: once the PNG leaves the app it must still
 * say what it is, or a style visualization can be mistaken for a photograph.
 */
export async function labelVisualizationDownload(bytes: Buffer): Promise<Buffer> {
  const image = sharp(bytes);
  const { width = 1024, height = 1536 } = await image.metadata();
  const fontSize = Math.max(16, Math.round(width / 46));

  const footer = Buffer.from(
    `<svg width="${width}" height="${FOOTER_HEIGHT}" xmlns="http://www.w3.org/2000/svg">
      <rect width="${width}" height="${FOOTER_HEIGHT}" fill="#f4f0e8"/>
      <text x="${width / 2}" y="${FOOTER_HEIGHT / 2 + fontSize / 3}" text-anchor="middle"
            font-family="Helvetica, Arial, sans-serif" font-size="${fontSize}" fill="#393632">
        ${escapeXml(AI_TRYON_DISCLAIMER)}
      </text>
    </svg>`,
  );

  return sharp({
    create: { width, height: height + FOOTER_HEIGHT, channels: 4, background: "#f4f0e8" },
  })
    .composite([
      { input: bytes, top: 0, left: 0 },
      { input: footer, top: height, left: 0 },
    ])
    .png({ compressionLevel: 9 })
    .toBuffer();
}
