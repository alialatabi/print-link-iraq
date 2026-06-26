import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { m as motion } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Minus, Plus, Loader2, ShoppingBag, Package, MapPin, Ruler, FileText, ArrowRight } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import SEOHead from '@/components/SEOHead';
import ImageLightbox from '@/components/ImageLightbox';
import AddressPicker, { type SavedAddress } from '@/components/AddressPicker';
import { useServices } from '@/hooks/useServices';
import { VaultItem, resolveVaultDisplayUrl, reorderVaultItem, isImageUrl } from '@/lib/designVault';
import { isNativeApp } from '@/lib/platform';

/**
 * Re-order a saved design: pick the print service, quantity, and a delivery address
 * from the address book, then create the order. Reached from the Design Vault with the
 * chosen item passed via navigation state.
 */
const ReorderDesignPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const { services } = useServices();

  const item = (location.state as { item?: VaultItem } | null)?.item ?? null;

  const [serviceType, setServiceType] = useState('');
  const [quantity, setQuantity] = useState(0);
  const [address, setAddress] = useState<SavedAddress | null>(null);
  const [displayUrl, setDisplayUrl] = useState<string | null>(item?.displayUrl ?? null);
  const [lightbox, setLightbox] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Printable services only (must carry a price to be ordered for print).
  const printable = useMemo(() => services.filter(s => (s.price || 0) > 0), [services]);
  const selectedSvc = printable.find(s => s.id === serviceType);
  const minQ = selectedSvc?.min_quantity || 1000;

  // Opened without an item (e.g. a hard refresh) — send the user back to the vault.
  useEffect(() => { if (!item) navigate('/design-vault', { replace: true }); }, [item, navigate]);

  // Default the service to the design's own service once the catalog loads.
  useEffect(() => {
    if (!printable.length || serviceType) return;
    const preferred = printable.find(s => s.id === item?.serviceType) || printable[0];
    setServiceType(preferred.id);
    setQuantity(preferred.min_quantity || 1000);
  }, [printable, serviceType, item]);

  // Snap quantity to the selected service's min/step when the service changes.
  useEffect(() => {
    if (selectedSvc) setQuantity(q => (q && q >= minQ ? Math.round(q / minQ) * minQ : minQ));
  }, [serviceType]); // eslint-disable-line react-hooks/exhaustive-deps

  // Resolve a viewable URL for the preview if the vault didn't pass one.
  useEffect(() => {
    if (displayUrl || !item) return;
    resolveVaultDisplayUrl(item).then(u => { if (u) setDisplayUrl(u); });
  }, [item, displayUrl]);

  if (!item) return null;

  const unitPrice = selectedSvc?.price || 0;
  const total = Math.ceil(unitPrice * (quantity / minQ));
  const showImage = displayUrl && isImageUrl(displayUrl);

  const handleConfirm = async () => {
    if (!user) { navigate('/auth'); return; }
    if (!serviceType) { toast({ title: 'اختر نوع الطباعة', variant: 'destructive' }); return; }
    if (!address) { toast({ title: 'اختر عنوان التوصيل', variant: 'destructive' }); return; }
    setSubmitting(true);
    try {
      const orderId = await reorderVaultItem(user.id, item, {
        serviceType,
        quantity,
        address: {
          phone: address.phone,
          province: address.province,
          area: address.area,
          landmark: address.landmark,
          label: address.label,
        },
      });
      toast({ title: 'تم إنشاء الطلب ✅' });
      navigate(`/order-success?order=${orderId}`);
    } catch (e) {
      toast({ title: 'فشل إنشاء الطلب', description: e instanceof Error ? e.message : 'حاول مرة أخرى', variant: 'destructive' });
      setSubmitting(false);
    }
  };

  return (
    <div className={isNativeApp ? 'pt-4 pb-10' : 'section-spacing-sm'}>
      <SEOHead title="طلب تصميم" description="اطلب طباعة تصميم من خزنتك — اختر الكمية وعنوان التوصيل." canonical="/reorder-design" noindex />
      <div className="container max-w-lg">
        {!isNativeApp && (
          <Link to="/design-vault" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-5 transition-colors">
            <ArrowRight className="w-4 h-4" />
            العودة للخزنة
          </Link>
        )}

        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
          <div>
            <h1 className="text-2xl font-extrabold text-foreground tracking-tight">طلب التصميم</h1>
            <p className="text-muted-foreground text-sm mt-1">اختر نوع الطباعة والكمية وعنوان التوصيل</p>
          </div>

          {/* Design preview */}
          <div className="bg-card rounded-2xl border border-border/60 shadow-card overflow-hidden">
            <div className="aspect-[16/10] bg-muted/30 flex items-center justify-center overflow-hidden">
              {showImage ? (
                <img
                  src={displayUrl!}
                  alt={item.label}
                  draggable={false}
                  onContextMenu={(e) => e.preventDefault()}
                  onClick={() => setLightbox(true)}
                  className="w-full h-full object-contain cursor-zoom-in select-none"
                />
              ) : displayUrl ? (
                <div className="flex flex-col items-center gap-2 text-muted-foreground">
                  <FileText className="w-12 h-12" />
                  <span className="text-xs">ملف التصميم</span>
                </div>
              ) : (
                <Loader2 className="w-6 h-6 text-muted-foreground/50 animate-spin" />
              )}
            </div>
            <div className="p-3 border-t border-border/50">
              <p className="text-sm font-bold text-foreground truncate">{item.label}</p>
            </div>
          </div>

          {/* Print service */}
          <div className="bg-card rounded-2xl border border-border/60 shadow-card p-5 space-y-3">
            <Label className="text-foreground font-bold flex items-center gap-2 text-sm">
              <Package className="w-4 h-4 text-primary" />
              نوع الطباعة
            </Label>
            <Select value={serviceType} onValueChange={setServiceType} disabled={submitting}>
              <SelectTrigger className="rounded-xl text-right h-12" dir="rtl">
                <SelectValue placeholder="اختر نوع الطباعة" />
              </SelectTrigger>
              <SelectContent dir="rtl">
                {printable.map(s => (
                  <SelectItem key={s.id} value={s.id}>
                    <span className="font-medium">{s.label}</span>
                    <span className="text-primary font-bold mr-1">
                      — {s.price.toLocaleString('en-US')} د.ع / {(s.min_quantity || 1000).toLocaleString('en-US')}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Quantity stepper */}
            <Label className="text-foreground font-bold flex items-center gap-2 text-sm pt-1">
              <Ruler className="w-4 h-4 text-primary" />
              الكمية
            </Label>
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-10 w-10 rounded-xl"
                  onClick={() => setQuantity(q => Math.max(minQ, q - minQ))}
                  disabled={submitting || quantity <= minQ}
                >
                  <Minus className="w-4 h-4" />
                </Button>
                <span className="text-base font-bold text-foreground min-w-[5rem] text-center">
                  {quantity.toLocaleString('en-US')}
                </span>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-10 w-10 rounded-xl"
                  onClick={() => setQuantity(q => q + minQ)}
                  disabled={submitting}
                >
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
              <div className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-success/10 border border-success/15">
                <span className="font-extrabold text-success">{total.toLocaleString('en-US')}</span>
                <span className="text-[11px] font-semibold text-success/70">د.ع</span>
              </div>
            </div>
          </div>

          {/* Delivery address */}
          <div className="bg-card rounded-2xl border border-border/60 shadow-card p-5">
            <Label className="text-foreground font-bold flex items-center gap-2 text-sm mb-4">
              <MapPin className="w-4 h-4 text-primary" />
              عنوان التوصيل
            </Label>
            <AddressPicker onChange={setAddress} />
          </div>

          {/* Confirm */}
          <Button
            onClick={handleConfirm}
            disabled={submitting || !serviceType || !address}
            size="lg"
            className="w-full h-13 bg-success hover:bg-success/90 text-success-foreground rounded-xl text-base font-bold gap-2"
          >
            {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <ShoppingBag className="w-5 h-5" />}
            تأكيد الطلب — {total.toLocaleString('en-US')} د.ع
          </Button>
        </motion.div>
      </div>

      <ImageLightbox
        src={displayUrl}
        alt={item.label}
        open={lightbox}
        onOpenChange={setLightbox}
      />
    </div>
  );
};

export default ReorderDesignPage;
