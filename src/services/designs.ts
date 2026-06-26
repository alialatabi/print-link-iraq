/**
 * Service layer — Designs domain.
 *
 * Thin wrappers around the existing `@/lib/designVault` and `@/lib/aiDesign` helpers,
 * collected here so the service layer has a single named entry-point for every design-related
 * I/O operation.  No logic is duplicated — each function delegates to the lib immediately.
 *
 * DesignVaultPage and AiDesignPage already go through these libs and therefore need no
 * direct-call migration; this module exists for coherence and is the right import target
 * for any new code that needs vault / AI-design operations.
 */
import {
  loadVault,
  resolveVaultDisplayUrl,
  deleteVaultDesign,
  saveAiDesignToVault,
  type VaultItem,
} from '@/lib/designVault';
import {
  generateAiDesign,
  uploadAiDraftImage,
  createAiEditOrder,
  type GenerateResult,
} from '@/lib/aiDesign';

// Re-export types so callers can import from one place.
export type { VaultItem, GenerateResult };

// ---------------------------------------------------------------------------
// Vault reads / writes
// ---------------------------------------------------------------------------

/**
 * Load and assemble the full design vault for a customer, aggregating AI designs,
 * customer uploads, and designer-finished designs from three Supabase sources.
 */
export async function loadVaultDesigns(userId: string): Promise<VaultItem[]> {
  return loadVault(userId);
}

/**
 * Resolve a viewable URL for a vault item.
 * For designer designs (private bucket) this creates a short-lived signed URL.
 * For AI / uploaded designs (public bucket) this returns the public URL directly.
 */
export async function resolveDesignDisplayUrl(item: VaultItem): Promise<string | null> {
  return resolveVaultDisplayUrl(item);
}

/**
 * Permanently delete a saved design from the vault (vault_designs table row).
 * Only items with a `vaultRowId` are deletable; the check must be done by the caller.
 */
export async function removeVaultDesign(rowId: string): Promise<void> {
  return deleteVaultDesign(rowId);
}

/**
 * Persist a freshly generated AI design to the customer's vault without placing an order.
 * Returns the new `vault_designs` row id so callers can replace it on re-generate.
 */
export async function saveAiDesign(
  args: Parameters<typeof saveAiDesignToVault>[0],
): Promise<string> {
  return saveAiDesignToVault(args);
}

// ---------------------------------------------------------------------------
// AI design generation & ordering
// ---------------------------------------------------------------------------

/**
 * Invoke the `ai-design-generate` edge function to produce a design image.
 * Throws an Error with an Arabic message on failure (rate-limit, API error, etc.).
 */
export async function generateDesign(
  params: Parameters<typeof generateAiDesign>[0],
): Promise<GenerateResult> {
  return generateAiDesign(params);
}

/**
 * Upload an accepted AI design (base64 data URL) to the public order-attachments bucket.
 * Returns the permanent public URL; the cart stores this instead of the raw data URL.
 */
export async function uploadAiImage(userId: string, imageDataUrl: string): Promise<string> {
  return uploadAiDraftImage(userId, imageDataUrl);
}

/**
 * Create an order so a human designer can refine an AI-generated design.
 * The order enters the normal designer → review → approve/revise pipeline.
 * Returns the new order id.
 */
export async function createAiDesignEditOrder(
  args: Parameters<typeof createAiEditOrder>[0],
): Promise<string> {
  return createAiEditOrder(args);
}
