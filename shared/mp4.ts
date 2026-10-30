// Minimal ISO-BMFF (MP4/MOV) reader shared by the browser and the server: brand and duration
// checks, and in-place removal of location and other personal metadata.

export interface Mp4Info {
  majorBrand: string;
  durationMs: number;
}

interface Box {
  type: string;
  start: number; // offset of the size field
  header: number; // header length in bytes
  end: number;
}

const ascii = (b: Uint8Array, at: number, len = 4) => String.fromCharCode(...b.subarray(at, at + len));
const u32 = (b: Uint8Array, at: number) => ((b[at]! << 24) | (b[at + 1]! << 16) | (b[at + 2]! << 8) | b[at + 3]!) >>> 0;
const u64 = (b: Uint8Array, at: number) => u32(b, at) * 2 ** 32 + u32(b, at + 4);

/** Child boxes in [from, to). Stops quietly at anything malformed. */
function boxes(b: Uint8Array, from: number, to: number): Box[] {
  const out: Box[] = [];
  let at = from;
  while (at + 8 <= to) {
    let size = u32(b, at);
    let header = 8;
    if (size === 1) {
      if (at + 16 > to) break;
      size = u64(b, at + 8);
      header = 16;
    } else if (size === 0) {
      size = to - at;
    }
    if (size < header || at + size > to) break;
    out.push({ type: ascii(b, at + 4), start: at, header, end: at + size });
    at += size;
  }
  return out;
}

const find = (list: Box[], type: string) => list.find((x) => x.type === type);
const children = (b: Uint8Array, box: Box) => boxes(b, box.start + box.header, box.end);

/** Brand and duration of an MP4/MOV file, or null when it isn't one (or has no readable movie header). */
export function readMp4Info(bytes: Uint8Array): Mp4Info | null {
  const top = boxes(bytes, 0, bytes.length);
  const ftyp = top[0];
  if (!ftyp || ftyp.type !== 'ftyp' || ftyp.end - ftyp.start < 16) return null;
  const majorBrand = ascii(bytes, ftyp.start + ftyp.header);

  const moov = find(top, 'moov');
  const mvhd = moov && find(children(bytes, moov), 'mvhd');
  if (!mvhd) return null;
  const p = mvhd.start + mvhd.header;
  if (p + 20 > mvhd.end) return null;
  const version = bytes[p]!;
  let timescale: number;
  let duration: number;
  if (version === 1) {
    if (p + 32 > mvhd.end) return null;
    timescale = u32(bytes, p + 20);
    duration = u64(bytes, p + 24);
  } else {
    timescale = u32(bytes, p + 12);
    duration = u32(bytes, p + 16);
  }
  if (timescale === 0) return null;
  return { majorBrand, durationMs: Math.round((duration / timescale) * 1000) };
}

/**
 * A copy with location and other personal metadata hidden. The `udta` and `meta` boxes at the top level, under `moov`
 * and under each `trak` are retyped to `free` and zeroed, so no size or offset changes and the clip still plays.
 */
export function stripMp4Metadata(bytes: Uint8Array): Uint8Array {
  const out = bytes.slice();
  const top = boxes(out, 0, out.length);
  const free = (box: Box) => {
    out.set([0x66, 0x72, 0x65, 0x65], box.start + 4);
    out.fill(0, box.start + box.header, box.end); // a free box's payload is ignored, so wipe it
  };
  const hide = (list: Box[]) => list.filter((x) => x.type === 'udta' || x.type === 'meta').forEach(free);
  hide(top);
  const moov = find(top, 'moov');
  if (!moov) return out;

  const inMoov = children(out, moov);
  hide(inMoov);
  for (const trak of inMoov.filter((x) => x.type === 'trak')) hide(children(out, trak));
  return out;
}
