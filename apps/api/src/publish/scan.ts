// Malware-scan hook. MVP is a no-op — the publish pipeline runs it before
// the DB commit so a drop-in (ClamAV / VirusTotal / Cloudflare R2 Object
// Scan) stays on the hot path without needing route-level changes.

export interface ScanResult {
  clean: boolean;
  detections?: string[];
}

export async function scanArchive(_zipBytes: Uint8Array): Promise<ScanResult> {
  return { clean: true };
}
