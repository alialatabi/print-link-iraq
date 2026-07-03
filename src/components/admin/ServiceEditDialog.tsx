import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Upload, X, ImageIcon, Sparkles, Layers } from 'lucide-react';
import { cn } from '@/lib/utils';
import AiFieldsEditor from '@/components/admin/AiFieldsEditor';
import type { Service, Specialization, ServiceFormState } from '@/components/admin/adminTypes';

interface ServiceEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dialogType: 'service' | 'specialization';
  editing: Service | Specialization | null;
  form: ServiceFormState;
  setForm: React.Dispatch<React.SetStateAction<ServiceFormState>>;
  iconFile: File | null;
  iconPreview: string | null;
  existingIconUrl: string | null;
  saving: boolean;
  fileInputRef: React.RefObject<HTMLInputElement>;
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onRemoveIcon: () => void;
  onSave: () => Promise<void>;
  services: Service[];
}

const ServiceEditDialog = ({
  open,
  onOpenChange,
  dialogType,
  editing,
  form,
  setForm,
  iconPreview,
  existingIconUrl,
  saving,
  fileInputRef,
  onFileChange,
  onRemoveIcon,
  onSave,
  services,
}: ServiceEditDialogProps) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="max-w-md" dir="rtl">
      <DialogHeader>
        <DialogTitle>
          {editing ? 'تعديل' : 'إضافة'} {dialogType === 'service' ? 'خدمة' : 'تخصص'}
        </DialogTitle>
      </DialogHeader>
      <div className="space-y-4 mt-2">

        <div>
          <label className="text-sm font-medium text-foreground mb-1 block">الاسم *</label>
          <Input
            value={form.label}
            onChange={e => setForm(f => ({ ...f, label: e.target.value }))}
            placeholder={dialogType === 'service' ? 'مثال: كروت شخصية' : 'مثال: أطباء'}
            className="rounded-xl"
          />
        </div>

        {/* Icon Section */}
        <div>
          <label className="text-sm font-medium text-foreground mb-2 block">
            {dialogType === 'service' ? 'صورة الأيقونة *' : 'الأيقونة *'}
          </label>
          {dialogType === 'specialization' && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">إيموجي</p>
                <Input
                  value={form.icon}
                  onChange={e => setForm(f => ({ ...f, icon: e.target.value }))}
                  placeholder="💳"
                  className="rounded-xl text-2xl text-center h-14"
                  dir="ltr"
                />
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">أو صورة</p>
                <input ref={fileInputRef} type="file" accept="image/*" onChange={onFileChange} className="hidden" />
                {iconPreview || existingIconUrl ? (
                  <div className="relative h-14 rounded-xl border border-border overflow-hidden bg-muted/30 flex items-center justify-center">
                    <img src={iconPreview || existingIconUrl!} alt="" className="h-full w-full object-contain p-1" />
                    <button
                      onClick={onRemoveIcon}
                      className="absolute top-1 left-1 w-5 h-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ) : (
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="h-14 rounded-xl border-2 border-dashed border-border flex items-center justify-center gap-2 cursor-pointer hover:border-primary/40 hover:bg-primary/5 transition-all"
                  >
                    <Upload className="w-4 h-4 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">رفع صورة</span>
                  </div>
                )}
              </div>
            </div>
          )}
          {dialogType === 'service' && (
            <>
              <input ref={fileInputRef} type="file" accept="image/*" onChange={onFileChange} className="hidden" />
              {iconPreview || existingIconUrl ? (
                <div className="relative h-20 w-20 rounded-xl border border-border overflow-hidden bg-muted/30 flex items-center justify-center">
                  <img src={iconPreview || existingIconUrl!} alt="" className="h-full w-full object-contain p-1" />
                  <button
                    onClick={onRemoveIcon}
                    className="absolute top-1 left-1 w-5 h-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ) : (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="h-20 w-full rounded-xl border-2 border-dashed border-border flex items-center justify-center gap-2 cursor-pointer hover:border-primary/40 hover:bg-primary/5 transition-all"
                >
                  <ImageIcon className="w-5 h-5 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">اضغط لرفع صورة</span>
                </div>
              )}
            </>
          )}
          {(iconPreview || existingIconUrl) && dialogType === 'specialization' && (
            <p className="text-[11px] text-primary mt-1.5">✓ سيتم استخدام الصورة بدلاً من الإيموجي</p>
          )}
        </div>

        {dialogType === 'service' && (
          <>
            {/* Parent service selector */}
            <div>
              <label className="text-sm font-medium text-foreground mb-1 block">
                تابعة لخدمة عامة (اتركها فارغة لجعلها خدمة عامة)
              </label>
              <select
                value={form.parent_id}
                onChange={e => setForm(f => ({ ...f, parent_id: e.target.value }))}
                className="w-full h-10 rounded-xl border border-input bg-background px-3 text-sm"
              >
                <option value="">— خدمة عامة (رئيسية) —</option>
                {services.filter(s => !s.parent_id && s.id !== form.id).map(s => (
                  <option key={s.id} value={s.id}>{s.label}</option>
                ))}
              </select>
            </div>
            {/* Channels (print / AI) are only configurable for sub-services */}
            {form.parent_id && (
              <>
                <div className="flex items-center justify-between bg-muted/30 rounded-xl px-3 py-2.5">
                  <div>
                    <span className="text-sm font-medium text-foreground">يظهر في قسم الطباعة</span>
                    <p className="text-[11px] text-muted-foreground">يطلبه الزبون مطبوعاً بكمية</p>
                  </div>
                  <Switch
                    checked={form.print_enabled}
                    onCheckedChange={v => setForm(f => ({ ...f, print_enabled: v }))}
                  />
                </div>
                {form.print_enabled && (
                  <>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-sm font-medium text-foreground mb-1 block">السعر (لكل 1000)</label>
                        <Input
                          type="number"
                          value={form.price || ''}
                          onChange={e => setForm(f => ({ ...f, price: parseInt(e.target.value) || 0 }))}
                          placeholder="25000"
                          className="rounded-xl"
                          dir="ltr"
                          min="0"
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium text-foreground mb-1 block">التكلفة (لكل 1000)</label>
                        <Input
                          type="number"
                          value={form.cost || ''}
                          onChange={e => setForm(f => ({ ...f, cost: parseInt(e.target.value) || 0 }))}
                          placeholder="10000"
                          className="rounded-xl"
                          dir="ltr"
                          min="0"
                        />
                      </div>
                    </div>
                    {form.price > 0 && form.cost > 0 && (
                      form.cost > form.price ? (
                        <p className="text-[11px] text-destructive">
                          ⚠ التكلفة أعلى من السعر! الخسارة: {(form.cost - form.price).toLocaleString('en-US')} د.ع لكل ألف
                        </p>
                      ) : (
                        <p className="text-[11px] text-success">
                          ✓ هامش الربح: {((form.price - form.cost) / form.price * 100).toFixed(0)}% — صافي {(form.price - form.cost).toLocaleString('en-US')} د.ع لكل ألف
                        </p>
                      )
                    )}
                    <div>
                      <label className="text-sm font-medium text-foreground mb-1 block">فترة الإنجاز (بالأيام)</label>
                      <Input
                        type="number"
                        value={form.completion_days || ''}
                        onChange={e => setForm(f => ({ ...f, completion_days: parseInt(e.target.value) || 0 }))}
                        placeholder="3"
                        className="rounded-xl"
                        dir="ltr"
                        min="0"
                      />
                      {form.completion_days > 0 && (
                        <p className="text-[11px] text-muted-foreground mt-1">
                          ⏱ يتم إنجاز الطلب خلال {form.completion_days} {form.completion_days === 1 ? 'يوم' : 'أيام'}
                        </p>
                      )}
                    </div>
                    <div>
                      <label className="text-sm font-medium text-foreground mb-1 block">أقل كمية للطلب</label>
                      <Input
                        type="number"
                        value={form.min_quantity || ''}
                        onChange={e => setForm(f => ({ ...f, min_quantity: parseInt(e.target.value) || 1 }))}
                        placeholder="1000"
                        className="rounded-xl"
                        dir="ltr"
                        min="1"
                      />
                      <p className="text-[11px] text-muted-foreground mt-1">
                        الحد الأدنى: {form.min_quantity.toLocaleString('en-US')} نسخة
                      </p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-foreground mb-1 block">السيلفان</label>
                      <select
                        value={form.cellophane_type}
                        onChange={e => setForm(f => ({ ...f, cellophane_type: e.target.value }))}
                        className="w-full h-10 rounded-xl border border-input bg-background px-3 text-sm"
                      >
                        <option value="none">بدون سيلفان</option>
                        <option value="matte">طافي فقط</option>
                        <option value="glossy">لمّاع فقط</option>
                        <option value="both">طافي ولمّاع (يختار الزبون)</option>
                      </select>
                    </div>
                  </>
                )}

                {/* Faces: single-face vs two-face (front/back) product */}
                <div>
                  <label className="text-sm font-medium text-foreground mb-1.5 flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-primary" /> عدد الأوجه
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {([[1, 'وجه واحد'], [2, 'وجهان']] as const).map(([val, label]) => (
                      <button
                        key={val}
                        type="button"
                        onClick={() => setForm(f => ({ ...f, faces: val }))}
                        className={cn(
                          'h-11 rounded-xl border text-sm font-medium transition-all',
                          form.faces === val
                            ? 'border-primary bg-primary/10 text-primary'
                            : 'border-input bg-background text-muted-foreground hover:border-primary/40',
                        )}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    الوجهان: يرفع المصمم ملفين (أمامي وخلفي) لكل إصدار، ويعتمد الزبون الوجهين معاً.
                  </p>
                </div>

                {/* Channel: AI design */}
                <div className="flex items-center justify-between bg-primary/5 border border-primary/15 rounded-xl px-3 py-2.5">
                  <div>
                    <span className="text-sm font-medium text-foreground flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-primary" /> متاح للتصميم بالذكاء الاصطناعي
                    </span>
                    <p className="text-[11px] text-muted-foreground">يصممه الزبون على صفحة التصميم بالذكاء الاصطناعي</p>
                  </div>
                  <Switch
                    checked={form.ai_enabled}
                    onCheckedChange={v => setForm(f => ({ ...f, ai_enabled: v }))}
                  />
                </div>
                {form.ai_enabled && (
                  <div className="space-y-4 border border-primary/15 rounded-xl p-3">
                    <div>
                      <label className="text-sm font-medium text-foreground mb-1 block">
                        سعر التصميم بالذكاء الاصطناعي (د.ع)
                      </label>
                      <Input
                        type="number"
                        value={form.ai_fee || ''}
                        onChange={e => setForm(f => ({ ...f, ai_fee: parseInt(e.target.value) || 0 }))}
                        placeholder="1000"
                        className="rounded-xl"
                        dir="ltr"
                        min="0"
                      />
                    </div>
                    <AiFieldsEditor
                      value={form.aiFields}
                      onChange={af => setForm(f => ({ ...f, aiFields: af }))}
                    />
                  </div>
                )}
              </>
            )}
          </>
        )}
        <div className="flex gap-2 pt-2">
          <Button onClick={onSave} disabled={saving} className="flex-1 rounded-xl">
            {saving ? 'جاري الحفظ...' : editing ? 'حفظ التغييرات' : 'إضافة'}
          </Button>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving} className="rounded-xl">
            إلغاء
          </Button>
        </div>
      </div>
    </DialogContent>
  </Dialog>
);

export default ServiceEditDialog;
