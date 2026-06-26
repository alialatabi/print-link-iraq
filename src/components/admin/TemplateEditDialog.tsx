import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Upload, X } from 'lucide-react';
import type { DbService, DbSpecialization } from '@/hooks/useServices';

interface Template {
  id: string;
  name: string;
  description: string | null;
  service_type: string;
  preview_url: string | null;
  preview_urls: string[];
  specializations: string[];
}

interface TemplateFormData {
  service_type: string;
  specializations: string[];
}

interface TemplateEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingTemplate: Template | null;
  form: TemplateFormData;
  setForm: React.Dispatch<React.SetStateAction<TemplateFormData>>;
  previewLocalUrls: string[];
  setPreviewLocalUrls: React.Dispatch<React.SetStateAction<string[]>>;
  previewFiles: File[];
  setPreviewFiles: React.Dispatch<React.SetStateAction<File[]>>;
  existingUrls: string[];
  setExistingUrls: React.Dispatch<React.SetStateAction<string[]>>;
  uploading: boolean;
  saving: boolean;
  uploadProgress: number;
  uploadStage: string;
  fileInputRef: React.RefObject<HTMLInputElement>;
  handleFileChange: (e: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
  handleSave: () => Promise<void>;
  services: DbService[];
  specializations: DbSpecialization[];
}

export function TemplateEditDialog({
  open, onOpenChange,
  editingTemplate,
  form, setForm,
  previewLocalUrls, setPreviewLocalUrls,
  previewFiles, setPreviewFiles,
  existingUrls, setExistingUrls,
  uploading, saving, uploadProgress, uploadStage,
  fileInputRef, handleFileChange, handleSave,
  services, specializations,
}: TemplateEditDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle>{editingTemplate ? 'تعديل القالب' : 'إضافة قالب جديد'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          {/* Preview Images Upload */}
          <div>
            <label className="text-sm font-medium text-foreground mb-2 block">صور القالب</label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={handleFileChange}
              className="hidden"
            />
            {previewLocalUrls.length > 0 && (
              <div className="grid grid-cols-3 gap-2 mb-2">
                {previewLocalUrls.map((url, idx) => (
                  <div key={idx} className="relative rounded-xl overflow-hidden border border-border aspect-square">
                    <img src={url} alt="preview" className="w-full h-full object-cover" />
                    <button
                      onClick={() => {
                        setPreviewLocalUrls(prev => prev.filter((_, i) => i !== idx));
                        // If it's a new file (not existing), remove from previewFiles too
                        const existingCount = existingUrls.filter(u => previewLocalUrls.includes(u)).length;
                        if (idx >= existingCount) {
                          setPreviewFiles(prev => prev.filter((_, i) => i !== (idx - existingCount)));
                        } else {
                          setExistingUrls(prev => prev.filter((_, i) => i !== idx));
                        }
                      }}
                      className="absolute top-1 left-1 w-6 h-6 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            {uploading ? (
              <div className="border-2 border-dashed border-primary/40 rounded-xl p-6 text-center bg-primary/5">
                <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">جاري تجهيز الصور...</p>
              </div>
            ) : (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-border rounded-xl p-6 text-center cursor-pointer hover:border-primary/40 hover:bg-primary/5 transition-all"
              >
                <Upload className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">اضغط لرفع صور (يمكنك اختيار أكثر من صورة)</p>
                <p className="text-xs text-muted-foreground mt-1">PNG, JPG — حتى 20MB لكل صورة</p>
              </div>
            )}
          </div>




          {/* Service Type */}
          <div>
            <label className="text-sm font-medium text-foreground mb-1 block">القسم *</label>
            <Select value={form.service_type} onValueChange={v => setForm(f => ({ ...f, service_type: v }))}>
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

          {/* Specializations (multi-select) */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-sm font-medium text-foreground">التخصصات</label>
              {specializations.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    const allSelected = form.specializations.length === specializations.length;
                    setForm(f => ({ ...f, specializations: allSelected ? [] : specializations.map(s => s.id) }));
                  }}
                  className="text-xs text-primary hover:underline"
                >
                  {form.specializations.length === specializations.length ? 'إلغاء الكل' : 'تحديد الكل'}
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-2 p-3 rounded-xl border border-border bg-background min-h-[44px]">
              {specializations.map(s => {
                const selected = form.specializations.includes(s.id);
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setForm(f => ({
                      ...f,
                      specializations: selected
                        ? f.specializations.filter(id => id !== s.id)
                        : [...f.specializations, s.id]
                    }))}
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
            {form.specializations.length > 0 && (
              <p className="text-xs text-muted-foreground mt-1">{form.specializations.length} تخصص محدد</p>
            )}
          </div>

          {/* Description (inherited from the sub-service, shared by all its templates) */}
          <div>
            <label className="text-sm font-medium text-foreground mb-1 block">وصف القسم</label>
            {(() => {
              const svcDescription = services.find(s => s.id === form.service_type)?.description?.trim();
              return svcDescription ? (
                <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line bg-muted/30 rounded-xl p-3 border border-border/40">
                  {svcDescription}
                </p>
              ) : (
                <p className="text-xs text-muted-foreground bg-muted/30 rounded-xl p-3 border border-border/40">
                  لا يوجد وصف لهذا القسم بعد.
                </p>
              );
            })()}
            <p className="text-[11px] text-muted-foreground mt-1">
              الوصف تابع للقسم (الخدمة الفرعية) ويظهر في جميع قوالبه. عدّله من قسم «الخدمات».
            </p>
          </div>

          {/* Upload Progress */}
          {saving && previewFiles.length > 0 && (
            <div className="space-y-2 pt-1">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{uploadStage}</span>
                <span>{uploadProgress}%</span>
              </div>
              <Progress value={uploadProgress} className="h-2" />
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            <Button onClick={handleSave} disabled={saving} className="flex-1 rounded-xl">
              {saving ? (previewFiles.length ? `جاري الرفع... ${uploadProgress}%` : 'جاري الحفظ...') : editingTemplate ? 'حفظ التغييرات' : 'إضافة القالب'}
            </Button>
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving} className="rounded-xl">
              إلغاء
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
