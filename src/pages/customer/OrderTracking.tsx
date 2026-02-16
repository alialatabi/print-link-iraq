import { useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useApp } from '@/contexts/AppContext';
import StatusBadge from '@/components/StatusBadge';
import { Button } from '@/components/ui/button';
import { CheckCircle, Clock, FileText, Palette, Printer, Truck, Package } from 'lucide-react';

const STEPS = [
  { status: 'submitted', label: 'تم الإرسال', icon: FileText },
  { status: 'assigned', label: 'تم تعيين مصمم', icon: Palette },
  { status: 'design_uploaded', label: 'تم رفع التصميم', icon: Package },
  { status: 'waiting_approval', label: 'بانتظار الموافقة', icon: Clock },
  { status: 'approved', label: 'تمت الموافقة', icon: CheckCircle },
  { status: 'print_ready', label: 'جاهز للطباعة', icon: Printer },
  { status: 'printed', label: 'تمت الطباعة', icon: Printer },
  { status: 'delivered', label: 'تم التسليم', icon: Truck },
];

const OrderTracking = () => {
  const { orderId } = useParams<{ orderId: string }>();
  const { orders, updateOrderStatus } = useApp();
  const order = orders.find(o => o.id === orderId);

  if (!order) {
    return (
      <div className="py-20 text-center">
        <p className="text-muted-foreground text-lg">لم يتم العثور على الطلب</p>
      </div>
    );
  }

  const currentStepIndex = STEPS.findIndex(s => s.status === order.status);

  return (
    <div className="py-12">
      <div className="container max-w-3xl">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-2xl font-bold text-foreground">تتبع الطلب</h1>
              <p className="text-muted-foreground">رقم الطلب: {order.id}</p>
            </div>
            <StatusBadge status={order.status} />
          </div>

          {/* Order Info Card */}
          <div className="bg-card rounded-xl p-6 border border-border shadow-card mb-8">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">القالب:</span>
                <p className="font-semibold text-foreground">{order.template_name}</p>
              </div>
              <div>
                <span className="text-muted-foreground">الاسم:</span>
                <p className="font-semibold text-foreground">{order.customer_name}</p>
              </div>
              <div>
                <span className="text-muted-foreground">الهاتف:</span>
                <p className="font-semibold text-foreground" dir="ltr">{order.customer_phone}</p>
              </div>
              <div>
                <span className="text-muted-foreground">التاريخ:</span>
                <p className="font-semibold text-foreground">{order.created_at}</p>
              </div>
            </div>
          </div>

          {/* Progress Steps */}
          <div className="bg-card rounded-xl p-6 border border-border shadow-card mb-8">
            <h3 className="font-bold text-foreground mb-6">مراحل الطلب</h3>
            <div className="space-y-4">
              {STEPS.map((step, i) => {
                const isComplete = i <= currentStepIndex;
                const isCurrent = i === currentStepIndex;
                return (
                  <div key={step.status} className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                      isComplete ? 'bg-success text-success-foreground' : 'bg-muted text-muted-foreground'
                    } ${isCurrent ? 'ring-2 ring-success ring-offset-2' : ''}`}>
                      <step.icon className="w-5 h-5" />
                    </div>
                    <div className="flex-1">
                      <p className={`font-medium ${isComplete ? 'text-foreground' : 'text-muted-foreground'}`}>
                        {step.label}
                      </p>
                    </div>
                    {isComplete && <CheckCircle className="w-5 h-5 text-success flex-shrink-0" />}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Approve Button */}
          {order.status === 'waiting_approval' && (
            <Button
              onClick={() => updateOrderStatus(order.id, 'approved')}
              size="lg"
              className="w-full bg-success hover:bg-success/90 text-success-foreground text-lg py-6 rounded-xl"
            >
              <CheckCircle className="w-5 h-5 ml-2" />
              الموافقة على التصميم
            </Button>
          )}
        </motion.div>
      </div>
    </div>
  );
};

export default OrderTracking;
