import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Upload, X } from 'lucide-react';
import type { DbService, DbSpecialization } from '@/hooks/useServices';

interface BulkUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  services: DbService[];
  specializations: DbSpecialization[];
  bulkServiceType: string;
  setBulkServiceType: (v: string) => void;
  bulkUploadSpecs: string[];
  setBulkUploadSpecs: React.Dispatch<React.SetStateAction<string[]>>;
  bulkFiles: File[];
  bulkPreviews: string[];
  bulkUploading: boolean;
  bulkPreparing: boolean;
  bulkProgress: number;
  bulkDone: number;
  bulkFileInputRef: React.RefObject<HTMLInputElement>;
  handleBulkFileChange: (e: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
  removeBulkFile: (idx: number) => void;
  handleBulkUpload: () => Promise<void>;
}

export function BulkUploadDialog({
  open, onOpenChange,
  services, specializations,
  bulkServiceType, setBulkServiceType,
  bulkUploadSpecs, setBulkUploadSpecs,
  bulkFiles, bulkPreviews,
  bulkUploading, bulkPreparing, bulkProgress, bulkDone,
  bulkFileInputRef, handleBulkFileChange, removeBulkFile, handleBulkUpload,
}: BulkUploadDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle>رفع قوالب بالجملة</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          <p className="text-xs text-muted-foreground">
            كل صورة تُنشئ قالباً مستقلاً ضمن القسم والتخصصات المختارة.
          </p>

          {/* Service Type */}
          <div>
            <label className="text-sm font-medium text-foreground mb-1 block">القسم *</label>
            <Select value={bulkServiceType} onValueChange={setBulkServiceType}>
              <SelectTrigger className="rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {services.filter(s => s.parent_id).map(s => (
                  <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Specializations */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-sm font-medium text-foreground">التخصصات</label>
              {specializations.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    const allSelected = bulkUploadSpecs.length === specializations.length;
                    setBulkUploadSpecs(allSelected ? [] : specializations.map(s => s.id));
                  }}
                  className="text-xs text-primary hover:underline"
                >
                  {bulkUploadSpecs.length === specializations.length ? 'إلغاء الكل' : 'تحديد الكل'}
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-2 p-3 rounded-xl border border-border bg-background min-h-[44px]">
              {specializations.map(s => {
                const selected = bulkUploadSpecs.includes(s.id);
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setBulkUploadSpecs(prev => selected ? prev.filter(id => id !== s.id) : [...prev, s.id])}
                    className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      selected
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-muted-foreground hover:bg-muted/80'
                    }`}
                  >
                    {s.icon} {s.label}
                  </button>
                );
              })}
              {specializations.length === 0 && (
                <span className="text-xs text-muted-foreground">لا توجد تخصصات</span>
              )}
            </div>
          </div>

          {/* Images */}
          <div>
            <label className="text-sm font-medium text-foreground mb-2 block">الصور</label>
            <input
              ref={bulkFileInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={handleBulkFileChange}
              className="hidden"
            />
            {bulkPreviews.length > 0 && (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 mb-2">
                {bulkPreviews.map((url, idx) => (
                  <div key={idx} className="relative rounded-lg overflow-hidden border border-border aspect-square">
                    <img src={url} alt="preview" className="w-full h-full object-cover" />
                    {!bulkUploading && (
                      <button
                        onClick={() => removeBulkFile(idx)}
                        className="absolute top-1 left-1 w-5 h-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
            {bulkPreparing ? (
              <div className="border-2 border-dashed border-primary/40 rounded-xl p-6 text-center bg-primary/5">
                <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">جاري تجهيز الصور...</p>
              </div>
            ) : (
              <div
                onClick={() => bulkFileInputRef.current?.click()}
                className="border-2 border-dashed border-border rounded-xl p-6 text-center cursor-pointer hover:border-primary/40 hover:bg-primary/5 transition-all"
              >
                <Upload className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">اضغط لاختيار عدة صور</p>
                <p className="text-xs text-muted-foreground mt-1">كل صورة = قالب — PNG, JPG حتى 20MB</p>
              </div>
            )}
            {bulkFiles.length > 0 && (
              <p className="text-xs text-muted-foreground mt-1">{bulkFiles.length} صورة محددة</p>
            )}
          </div>

          {/* Upload Progress */}
          {bulkUploading && (
            <div className="space-y-2 pt-1">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>جاري إنشاء القوالب... ({bulkDone}/{bulkFiles.length})</span>
                <span>{bulkProgress}%</span>
              </div>
              <Progress value={bulkProgress} className="h-2" />
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-col-reverse sm:flex-row gap-2 pt-2">
            <Button onClick={handleBulkUpload} disabled={bulkUploading || bulkPreparing || bulkFiles.length === 0} className="flex-1 rounded-xl">
              {bulkUploading ? `جاري الرفع... ${bulkProgress}%` : `إنشاء ${bulkFiles.length || ''} قالب`}
            </Button>
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={bulkUploading} className="rounded-xl">
              إلغاء
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
