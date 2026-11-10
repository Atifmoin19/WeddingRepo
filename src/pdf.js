// Minimal PDF writer: one full-page JPEG per page. No dependencies.
// pages: [{ data: Uint8Array (JPEG bytes), w, h }], pageWidthPt: page width in points (72 per inch).
export function jpegsToPdf(pages, pageWidthPt = 360) {
  const enc = new TextEncoder();
  const chunks = [];
  const offsets = [];
  let length = 0;
  const push = (d) => {
    const bytes = typeof d === "string" ? enc.encode(d) : d;
    chunks.push(bytes);
    length += bytes.length;
  };
  const obj = (n, write) => {
    offsets[n] = length;
    push(`${n} 0 obj\n`);
    write();
    push("\nendobj\n");
  };

  push("%PDF-1.4\n");
  obj(1, () => push("<< /Type /Catalog /Pages 2 0 R >>"));
  obj(2, () => push(`<< /Type /Pages /Count ${pages.length} /Kids [${pages.map((_, i) => `${3 + 3 * i} 0 R`).join(" ")}] >>`));
  pages.forEach((p, i) => {
    const W = pageWidthPt;
    const H = +((pageWidthPt * p.h) / p.w).toFixed(2);
    const content = `q ${W} 0 0 ${H} 0 0 cm /Im0 Do Q`;
    obj(3 + 3 * i, () => push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /XObject << /Im0 ${5 + 3 * i} 0 R >> >> /Contents ${4 + 3 * i} 0 R >>`));
    obj(4 + 3 * i, () => push(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`));
    obj(5 + 3 * i, () => {
      push(`<< /Type /XObject /Subtype /Image /Width ${p.w} /Height ${p.h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${p.data.length} >>\nstream\n`);
      push(p.data);
      push("\nendstream");
    });
  });

  const count = 3 * pages.length + 3;
  const xref = length;
  push(`xref\n0 ${count}\n0000000000 65535 f \n`);
  for (let n = 1; n < count; n++) push(`${String(offsets[n]).padStart(10, "0")} 00000 n \n`);
  push(`trailer\n<< /Size ${count} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`);

  const out = new Uint8Array(length);
  let at = 0;
  for (const c of chunks) { out.set(c, at); at += c.length; }
  return out;
}
