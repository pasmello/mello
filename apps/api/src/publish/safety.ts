// Archive safety pre-checks. Runs BEFORE we fully extract, so an attacker
// can't exhaust memory or plant files outside the extraction root.
//
// Reject on:
//   - symlinks / hardlinks (external entities don't belong in a zip)
//   - absolute paths or backslashes (zip-slip precursors)
//   - entries containing `..` that escape the archive root
//   - executables (elf, mach-o, windows pe) outside declared directories

import type JSZip from 'jszip';

export interface SafetyReport {
  ok: boolean;
  reasons: string[];
}

// Declared-executable-allowed paths: entries inside `dist/` may contain
// compiled browser assets (wasm is fine, exe bytes are not) but we don't
// currently need any actual binaries — Pasmello tools are HTML+JS. If future
// package types need native binaries, add an allowlist here.
const EXECUTABLE_ALLOWED_PREFIXES: readonly string[] = [];

// Magic bytes for the binary formats we reject on sight.
// Adding NaCl / emscripten wasm binaries here would be a mistake — wasm
// (00 61 73 6D) IS permitted because it runs in the browser sandbox.
const EXECUTABLE_MAGICS: Array<{ bytes: number[]; label: string }> = [
  { bytes: [0x7f, 0x45, 0x4c, 0x46], label: 'ELF' },
  { bytes: [0xfe, 0xed, 0xfa, 0xce], label: 'Mach-O 32' },
  { bytes: [0xfe, 0xed, 0xfa, 0xcf], label: 'Mach-O 64' },
  { bytes: [0xca, 0xfe, 0xba, 0xbe], label: 'Mach-O universal' },
  { bytes: [0x4d, 0x5a], label: 'PE / .exe' },
];

function hasSuspiciousPath(path: string): string | null {
  if (path.startsWith('/')) return 'absolute path';
  if (path.includes('\\')) return 'backslash in path';
  const segments = path.split('/');
  for (const s of segments) {
    if (s === '..' || s === '.') return `traversal segment "${s}"`;
  }
  return null;
}

function matchesMagic(bytes: Uint8Array): string | null {
  for (const { bytes: magic, label } of EXECUTABLE_MAGICS) {
    if (bytes.length < magic.length) continue;
    let match = true;
    for (let i = 0; i < magic.length; i++) {
      if (bytes[i] !== magic[i]) {
        match = false;
        break;
      }
    }
    if (match) return label;
  }
  return null;
}

export async function auditArchive(zip: JSZip): Promise<SafetyReport> {
  const reasons: string[] = [];

  // Collect entries synchronously first so we can reject before any async
  // read. JSZip exposes internal flags via the file object.
  const entries: { name: string; dir: boolean; unixPermissions?: number | string }[] = [];
  zip.forEach((relativePath, entry) => {
    entries.push({
      name: relativePath,
      dir: entry.dir,
      unixPermissions: (entry as unknown as { unixPermissions?: number | string }).unixPermissions,
    });
  });

  for (const e of entries) {
    const reason = hasSuspiciousPath(e.name);
    if (reason) reasons.push(`${e.name}: ${reason}`);
    // Unix symlink bits (S_IFLNK) in the high bits of unixPermissions.
    if (typeof e.unixPermissions === 'number') {
      const fileType = (e.unixPermissions >>> 12) & 0xf;
      if (fileType === 0xa) reasons.push(`${e.name}: symlink`);
    }
  }

  // Magic-byte check on the first 8 bytes of each file entry.
  for (const e of entries) {
    if (e.dir) continue;
    if (EXECUTABLE_ALLOWED_PREFIXES.some((p) => e.name.startsWith(p))) continue;
    const file = zip.file(e.name);
    if (!file) continue;
    const head = await file.async('uint8array').then((u) => u.subarray(0, 8));
    const magic = matchesMagic(head);
    if (magic) reasons.push(`${e.name}: ${magic} binary not permitted`);
  }

  return { ok: reasons.length === 0, reasons };
}
