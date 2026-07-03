import React from 'react';
import { Layers } from 'lucide-react';
import DesignUploadZone from '@/components/designer/DesignUploadZone';
import { FACE_LABELS, type DesignFace } from '@/lib/designUtils';

/**
 * Two side-by-side upload zones (الوجه الأمامي / الوجه الخلفي) for two-face products
 * (services.faces === 2). Reuses DesignUploadZone per face so each keeps the exact
 * retry/progress/failure behaviour. Shared by DesignItemCard (per-item uploads) and
 * ItemlessOrderPanel (order-level uploads).
 *
 * The parent owns the <input> refs (keyed `${keyPrefix}:${face}`) and the per-face state,
 * so this component is purely presentational — it never holds upload state itself.
 */

export interface FaceZoneState {
  uploading: boolean;
  info: { name: string; size: number } | null;
  failed: File | null;
  /** true when this face already has an uploaded design (label: "رفع إصدار جديد"). */
  hasExisting: boolean;
}

interface FaceUploadZonesProps {
  canUpload: boolean;
  /** Namespaces the input refs so multiple items/panels don't collide (itemId or 'order'). */
  keyPrefix: string;
  front: FaceZoneState;
  back: FaceZoneState;
  inputRefs: React.MutableRefObject<Record<string, HTMLInputElement | null>>;
  onFileSelect: (e: React.ChangeEvent<HTMLInputElement>, face: DesignFace) => void;
  onRetry: (face: DesignFace) => void;
}

const FaceUploadZones = ({
  canUpload,
  keyPrefix,
  front,
  back,
  inputRefs,
  onFileSelect,
  onRetry,
}: FaceUploadZonesProps) => {
  if (!canUpload) return null;

  const faces: { face: DesignFace; state: FaceZoneState }[] = [
    { face: 'front', state: front },
    { face: 'back', state: back },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {faces.map(({ face, state }) => {
        const refKey = `${keyPrefix}:${face}`;
        return (
          <div key={face}>
            <p className="text-xs font-bold text-foreground mb-1.5 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-primary" />
              {FACE_LABELS[face]}
            </p>
            <DesignUploadZone
              canUpload={canUpload}
              uploading={state.uploading}
              uploadingInfo={state.info}
              failedFile={state.failed}
              hasExisting={state.hasExisting}
              inputRef={(el) => { inputRefs.current[refKey] = el; }}
              onFileSelect={(e) => onFileSelect(e, face)}
              onPick={() => inputRefs.current[refKey]?.click()}
              onRetry={() => onRetry(face)}
            />
          </div>
        );
      })}
    </div>
  );
};

export default FaceUploadZones;
