import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { m as motion } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';
import { MapPin, CheckCircle2, ChevronLeft } from 'lucide-react';
import AddressPicker, { type SavedAddress } from '@/components/AddressPicker';
import { isNativeApp } from '@/lib/platform';
import { getOrderDetailsOnly, approveOrderWithDelivery } from '@/services/orders';
import type { OrderDetailsJson } from '@/types/db';

const DeliveryAddressPage = () => {
  const { orderId } = useParams<{ orderId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [selected, setSelected] = useState<SavedAddress | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleConfirm = async () => {
    if (!orderId || !user || !selected) return;
    setSubmitting(true);

    // Fetch current order details to merge (pricing/attachments must be preserved).
    const { data: currentOrder } = await getOrderDetailsOnly(orderId);

    const currentDetails = (currentOrder?.details || {}) as OrderDetailsJson;

    const { error } = await approveOrderWithDelivery(orderId, {
      ...currentDetails,
      delivery_phone: selected.phone,
      delivery_province: selected.province,
      delivery_area: selected.area,
      delivery_landmark: selected.landmark,
      delivery_label: selected.label,
      approved_at: new Date().toISOString(),
    });

    if (error) {
      toast({ title: 'حدث خطأ', variant: 'destructive' });
      setSubmitting(false);
      return;
    }

    toast({ title: 'تمت الموافقة وتأكيد عنوان الاستلام ✅' });
    navigate(`/track-order/${orderId}`);
  };

  return (
    <div className={isNativeApp ? 'pt-4 pb-10' : 'section-spacing-sm'}>
      <div className="container max-w-lg">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
          {/* Header */}
          <div className="flex items-center gap-4 mb-8">
            <div className="w-12 h-12 rounded-2xl bg-success/10 flex items-center justify-center">
              <MapPin className="w-6 h-6 text-success" />
            </div>
            <div>
              <h1 className="text-2xl font-extrabold text-foreground tracking-tight">عنوان الاستلام</h1>
              <p className="text-muted-foreground text-sm">اختر العنوان الذي تريد استلام طلبك منه</p>
            </div>
          </div>

          <AddressPicker onChange={setSelected} />

          {/* Confirm button */}
          {selected && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3 mt-6">
              <div className="bg-success/8 rounded-xl p-4 border border-success/20 text-sm text-foreground">
                <p className="font-medium text-success mb-1">سيتم التوصيل إلى:</p>
                <p className="text-foreground/80">{selected.province} — {selected.area}{selected.landmark ? ` — ${selected.landmark}` : ''}</p>
                <p className="text-foreground/80 mt-0.5" dir="ltr">{selected.phone}</p>
              </div>
              <Button
                onClick={handleConfirm}
                disabled={submitting}
                size="lg"
                className="w-full h-12 bg-success hover:bg-success/90 text-success-foreground"
              >
                <CheckCircle2 className="w-5 h-5 ml-2" />
                {submitting ? 'جاري التأكيد...' : 'تأكيد الموافقة وتحديد العنوان'}
              </Button>
              {!isNativeApp && (
                <Button
                  variant="ghost"
                  className="w-full text-muted-foreground"
                  onClick={() => navigate(-1)}
                >
                  <ChevronLeft className="w-4 h-4 ml-1" /> رجوع
                </Button>
              )}
            </motion.div>
          )}
        </motion.div>
      </div>
    </div>
  );
};

export default DeliveryAddressPage;
