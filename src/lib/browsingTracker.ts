/**
 * Lightweight localStorage-based browsing tracker.
 * Records which service types and specializations the user views
 * so we can serve personalised "You might also like" recommendations.
 */

const STORAGE_KEY = 'matbaty_browse_history';
const MAX_ENTRIES = 100;

interface BrowseEntry {
  templateId: string;
  serviceType: string;
  specializations: string[];
  ts: number; // timestamp
}

// ── Read / Write ──────────────────────────────────────────────────────────────
function getHistory(): BrowseEntry[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch {
    return [];
  }
}

function saveHistory(entries: BrowseEntry[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries.slice(-MAX_ENTRIES)));
}

// ── Public API ────────────────────────────────────────────────────────────────

/** Record that the user viewed a template */
export function trackView(templateId: string, serviceType: string, specializations: string[] = []) {
  const history = getHistory();
  // Don't duplicate consecutive views of the same template
  if (history.length && history[history.length - 1].templateId === templateId) return;
  history.push({ templateId, serviceType, specializations, ts: Date.now() });
  saveHistory(history);
}

/**
 * Return service types ranked by how often the user browsed them (most → least).
 * Excludes `excludeService` so we don't just repeat the current page's service.
 * Returns up to `limit` service type IDs.
 */
export function getPreferredServiceTypes(excludeService?: string, limit = 4): string[] {
  const history = getHistory();
  const counts: Record<string, number> = {};

  // Weight recent views more (last 30 entries count double)
  history.forEach((e, i) => {
    if (e.serviceType === excludeService) return;
    const weight = i >= history.length - 30 ? 2 : 1;
    counts[e.serviceType] = (counts[e.serviceType] || 0) + weight;
  });

  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([st]) => st);
}

/** IDs of recently viewed templates (newest first) */
export function getRecentlyViewed(limit = 20): string[] {
  return getHistory()
    .map(e => e.templateId)
    .reverse()
    .filter((id, i, arr) => arr.indexOf(id) === i)
    .slice(0, limit);
}
