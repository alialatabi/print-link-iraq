import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import StatusBadge from '@/components/StatusBadge';
import { Button } from '@/components/ui/button';
import { ArrowRight, Upload, Send, User, Phone, MapPin, Briefcase, FileText } from 'lucide-react';
import { useState, useEffect } from 'react';
import type { OrderStatus } from '@/data/mockData';

const DesignerOrderDetails = () => {
  const { orderId } = useParams<{ orderId: string }>();
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [uploaded, setUploaded] = useState(false);

  const loadOrder = async () => {
    const { data } = await supabase
      .from('orders')
      .select('*, templates(name, service_type)')
      .eq('id', orderId || '')
      .maybeSingle();
    setOrder(data);
    setLoading(false);
  };

  useEffect(() => { loadOrder(); }, [orderId]);

  const handleUpload = async () => {
    setUploaded(true);
    await supabase.from('orders').update({ status: 'design_uploaded' as any }).eq('id', orderId || '');
    loadOrder();
  };

  const handleSendForApproval = async () => {
    await supabase.from('orders').update({ status: 'waiting_approval' as any }).eq('id', orderId || '');
    loadOrder();
  };

  if (loading) return <div className="py-20 text-center"><p className="text-muted-foreground">جاري التحميل...</p></div>;
  if (!order) return <div className="py-20 text-center"><p className="text-muted-foreground text-lg">لم يتم العثور على الطلب</p></div>;

  const details = (order.details || {}) as Record<string, any>;

  return (
    <div className="py-12">
      <div className="container max-w-3xl">
        <Link to="/designer/orders" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6 transition-colors">
          <ArrowRight className="w-4 h-4" />
          العودة للطلبات
        </Link>

        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-bold text-foreground">تفاصيل الطلب</h1>
            <StatusBadge status={order.status as OrderStatus} />
          </div>

          <div className="bg-card rounded-xl p-6 border border-border shadow-card mb-6">
            <h3 className="font-bold text-foreground mb-4">بيانات العميل</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              {details.name && (
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-muted-foreground" />
                  <span className="text-muted-foreground">الاسم:</span>
                  <span className="font-medium text-foreground">{details.name}</span>
                </div>
              )}
              {details.phone && (
                <div className="flex items-center gap-2">
                  <Phone className="w-4 h-4 text-muted-foreground" />
                  <span className="text-muted-foreground">الهاتف:</span>
                  <span className="font-medium text-foreground" dir="ltr">{details.phone}</span>
                </div>
              )}
              {details.job_title && (
                <div className="flex items-center gap-2">
                  <Briefcase className="w-4 h-4 text-muted-foreground" />
                  <span className="text-muted-foreground">الوظيفة:</span>
                  <span className="font-medium text-foreground">{details.job_title}</span>
                </div>
              )}
              {details.address && (
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-muted-foreground" />
                  <span className="text-muted-foreground">العنوان:</span>
                  <span className="font-medium text-foreground">{details.address}</span>
                </div>
              )}
            </div>
            {details.notes && (
              <div className="mt-4 pt-4 border-t border-border">
                <div className="flex items-start gap-2">
                  <FileText className="w-4 h-4 text-muted-foreground mt-0.5" />
                  <div>
                    <span className="text-muted-foreground text-sm">ملاحظات:</span>
                    <p className="text-foreground text-sm mt-1">{details.notes}</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="bg-card rounded-xl p-6 border border-border shadow-card mb-6">
            <h3 className="font-bold text-foreground mb-4">القالب</h3>
            <div className="flex items-center gap-4">
              <div className="w-24 h-32 rounded-lg bg-gradient-to-br from-primary/5 to-primary/10 border border-primary/20 flex items-center justify-center">
                <FileText className="w-8 h-8 text-primary/50" />
              </div>
              <div>
                <p className="font-bold text-foreground">{order.templates?.name}</p>
                <p className="text-muted-foreground text-sm">{order.templates?.service_type}</p>
              </div>
            </div>
          </div>

          <div className="bg-card rounded-xl p-6 border border-border shadow-card">
            <h3 className="font-bold text-foreground mb-4">رفع التصميم</h3>
            
            {!uploaded && order.status !== 'design_uploaded' && order.status !== 'waiting_approval' ? (
              <div className="text-center">
                <div
                  onClick={handleUpload}
                  className="border-2 border-dashed border-primary/30 rounded-xl p-10 cursor-pointer hover:border-primary/60 hover:bg-primary/5 transition-all"
                >
                  <Upload className="w-12 h-12 text-primary/50 mx-auto mb-3" />
                  <p className="text-foreground font-medium">اضغط لرفع ملف التصميم</p>
                  <p className="text-muted-foreground text-sm mt-1">PDF, PNG, JPG - حتى 10MB</p>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="bg-success/10 rounded-lg p-4 flex items-center gap-3">
                  <FileText className="w-6 h-6 text-success" />
                  <div>
                    <p className="font-medium text-foreground">تم رفع التصميم</p>
                    <p className="text-muted-foreground text-sm">design_final.pdf</p>
                  </div>
                </div>

                {order.status === 'design_uploaded' && (
                  <Button
                    onClick={handleSendForApproval}
                    size="lg"
                    className="w-full bg-accent hover:bg-accent/90 text-accent-foreground text-lg py-6 rounded-xl"
                  >
                    <Send className="w-5 h-5 ml-2" />
                    إرسال للعميل للموافقة
                  </Button>
                )}
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default DesignerOrderDetails;
