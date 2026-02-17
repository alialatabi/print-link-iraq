import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useCart } from '@/contexts/CartContext';
import { SERVICE_LABELS, TEMPLATE_ASPECT_RATIOS, ServiceType } from '@/data/mockData';
import { ArrowRight, Minus, Plus, Trash2, ShoppingCart, Palette } from 'lucide-react';
import { Button } from '@/components/ui/button';

const CartPage = () => {
  const { items, removeItem, updateQuantity, totalPrice, clearCart } = useCart();
  const navigate = useNavigate();

  if (items.length === 0) {
    return (
      <div className="py-20 text-center">
        <ShoppingCart className="w-20 h-20 text-muted-foreground mx-auto mb-4 opacity-30" />
        <h2 className="text-xl font-bold text-foreground mb-2">السلة فارغة</h2>
        <p className="text-muted-foreground mb-6">أضف قوالب من الخدمات المختلفة لبدء الطلب</p>
        <Link to="/">
          <Button variant="outline" className="rounded-xl gap-2">
            <ArrowRight className="w-4 h-4" />
            تصفح الخدمات
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="py-8 sm:py-12">
      <div className="container max-w-3xl">
        <Link to="/" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6 transition-colors">
          <ArrowRight className="w-4 h-4" />
          متابعة التسوق
        </Link>

        <h1 className="text-2xl font-bold text-foreground mb-6">
          سلة المشتريات ({items.length})
        </h1>

        <div className="space-y-4 mb-8">
          <AnimatePresence>
            {items.map(item => (
              <motion.div
                key={item.templateId}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: 100 }}
                className="flex gap-4 p-4 rounded-2xl bg-card border border-border shadow-sm"
              >
                {/* Thumbnail */}
                <div className="w-20 h-20 rounded-xl overflow-hidden bg-muted shrink-0 flex items-center justify-center">
                  {item.previewUrl ? (
                    <img src={item.previewUrl} alt={item.templateName} className="w-full h-full object-cover" />
                  ) : (
                    <Palette className="w-8 h-8 text-muted-foreground" />
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="font-bold text-foreground text-sm truncate">{item.templateName}</h3>
                      <span className="text-xs text-muted-foreground">
                        {SERVICE_LABELS[item.serviceType as ServiceType] || item.serviceType}
                      </span>
                    </div>
                    <button
                      onClick={() => removeItem(item.templateId)}
                      className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors shrink-0"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="flex items-center justify-between mt-3">
                    {/* Quantity */}
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8 rounded-lg"
                        onClick={() => updateQuantity(item.templateId, item.quantity - 1)}
                        disabled={item.quantity <= 1}
                      >
                        <Minus className="w-3 h-3" />
                      </Button>
                      <span className="text-sm font-bold text-foreground min-w-[3rem] text-center">
                        {item.quantity} ألف
                      </span>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8 rounded-lg"
                        onClick={() => updateQuantity(item.templateId, item.quantity + 1)}
                      >
                        <Plus className="w-3 h-3" />
                      </Button>
                    </div>

                    {/* Price */}
                    <span className="font-bold text-primary text-sm">
                      {(item.unitPrice * item.quantity).toLocaleString('ar-IQ')} د.ع
                    </span>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {/* Summary */}
        <div className="p-5 rounded-2xl bg-gradient-to-br from-primary/10 to-accent/10 border border-primary/20">
          <div className="flex items-center justify-between mb-4">
            <span className="text-muted-foreground font-medium">المجموع الكلي</span>
            <span className="text-2xl font-bold text-primary">
              {totalPrice.toLocaleString('ar-IQ')} <span className="text-sm font-medium">د.ع</span>
            </span>
          </div>
          <Button
            onClick={() => navigate('/checkout')}
            className="w-full h-12 rounded-xl text-base font-bold gap-2"
          >
            <ShoppingCart className="w-5 h-5" />
            متابعة الطلب
          </Button>
          <button
            onClick={clearCart}
            className="w-full text-center text-sm text-muted-foreground hover:text-destructive mt-3 transition-colors"
          >
            تفريغ السلة
          </button>
        </div>
      </div>
    </div>
  );
};

export default CartPage;
