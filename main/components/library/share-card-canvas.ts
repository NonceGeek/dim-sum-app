/**
 * Draws the public share card with the Canvas 2D API so the preview and the saved
 * PNG are identical. Only public metadata is passed in.
 */
export type ShareCardContent = {
  brand: string;
  title: string;
  subtitle: string | null;
  description: string | null;
  tags: string[];
  summary: string[];
  url: string;
};

const W = 1080;
const H = 1350;
const PAD = 88;
// Canvas cannot read CSS tokens reliably; these are the design-system brand primitives.
const BRAND = {
  950: "#051f3f",
  900: "#052f61",
  600: "#007fff",
  200: "#b2d7ff",
  100: "#dbe9fc",
};
const FONT =
  '"PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Noto Sans CJK SC", system-ui, sans-serif';

function wrap(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines: number,
) {
  const lines: string[] = [];
  let line = "";
  // Character-level wrapping works for CJK and is acceptable for Latin text here.
  for (const char of [...text]) {
    if (ctx.measureText(line + char).width > maxWidth && line) {
      lines.push(line);
      line = char.trimStart();
      if (lines.length === maxLines) break;
    } else line += char;
  }
  if (lines.length < maxLines && line) lines.push(line);
  if (lines.length === maxLines && lines.join("").length < [...text].length) {
    let last = lines[maxLines - 1];
    while (last && ctx.measureText(`${last}…`).width > maxWidth)
      last = last.slice(0, -1);
    lines[maxLines - 1] = `${last}…`;
  }
  return lines;
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function drawShareCard(content: ShareCardContent): string {
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unavailable");

  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, BRAND[950]);
  bg.addColorStop(1, BRAND[900]);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = "rgba(255,255,255,0.06)";
  ctx.beginPath();
  ctx.arc(W - 120, 160, 260, 0, Math.PI * 2);
  ctx.fill();

  let y = PAD + 20;
  ctx.textBaseline = "top";
  ctx.fillStyle = BRAND[200];
  ctx.font = `600 30px ${FONT}`;
  ctx.fillText(content.brand, PAD, y);

  y += 120;
  ctx.fillStyle = "#ffffff";
  ctx.font = `700 76px ${FONT}`;
  for (const line of wrap(ctx, content.title, W - PAD * 2, 3)) {
    ctx.fillText(line, PAD, y);
    y += 96;
  }
  if (content.subtitle) {
    y += 8;
    ctx.fillStyle = BRAND[100];
    ctx.font = `400 36px ${FONT}`;
    for (const line of wrap(ctx, content.subtitle, W - PAD * 2, 2)) {
      ctx.fillText(line, PAD, y);
      y += 48;
    }
  }

  y += 40;
  let x = PAD;
  ctx.font = `500 30px ${FONT}`;
  for (const tag of content.tags.slice(0, 4)) {
    const w = ctx.measureText(tag).width + 48;
    if (x + w > W - PAD) break;
    ctx.fillStyle = "rgba(0,127,255,0.28)";
    roundRect(ctx, x, y, w, 56, 28);
    ctx.fill();
    ctx.fillStyle = BRAND[100];
    ctx.fillText(tag, x + 24, y + 12);
    x += w + 16;
  }

  y += 100;
  if (content.description) {
    ctx.fillStyle = BRAND[100];
    ctx.font = `400 32px ${FONT}`;
    for (const line of wrap(ctx, content.description, W - PAD * 2, 4)) {
      ctx.fillText(line, PAD, y);
      y += 46;
    }
    y += 30;
  }
  ctx.fillStyle = BRAND[100];
  ctx.font = `400 36px ${FONT}`;
  for (const item of content.summary.filter(Boolean).slice(0, 4)) {
    ctx.fillText(`· ${wrap(ctx, item, W - PAD * 2 - 40, 1)[0]}`, PAD, y);
    y += 58;
  }

  const footY = H - PAD - 120;
  ctx.strokeStyle = "rgba(255,255,255,0.2)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(PAD, footY);
  ctx.lineTo(W - PAD, footY);
  ctx.stroke();
  ctx.fillStyle = "#ffffff";
  ctx.font = `600 34px ${FONT}`;
  ctx.fillText("DimSum AI", PAD, footY + 36);
  ctx.fillStyle = BRAND[200];
  ctx.font = `400 26px ${FONT}`;
  ctx.fillText(wrap(ctx, content.url, W - PAD * 2, 1)[0], PAD, footY + 86);

  return canvas.toDataURL("image/png");
}
