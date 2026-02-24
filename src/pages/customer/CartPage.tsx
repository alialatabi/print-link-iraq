import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useCart } from '@/contexts/CartContext';
import { SERVICE_LABELS, ServiceType } from '@/data/mockData';
import { ArrowRight, Minus, Plus, Trash2, ShoppingCart, Palette, ShieldCheck, Truck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import SEOHead from '@/components/SEOHead';

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.06, duration: 0.4 } }),
};

const CartPage = () => {
  const { items, removeItem, updateQuantity, totalPrice, clearCart } = useCart();
  const navigate = useNavigate();

  if (items.length === 0) {
    return (
      <div className="py-32 text-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
        >
          <div className="w-24 h-24 rounded-3xl bg-muted/60 flex items-center justify-center mx-auto mb-6">
            <ShoppingCart className="w-10 h-10 text-muted-foreground/30" />
          </div>
          <h2 className="text-2xl font-extrabold text-foreground mb-2">السلة فارغة</h2>
          <p className="text-muted-foreground text-sm mb-10 max-w-xs mx-auto leading-relaxed">
            أضف قوالب من الخدمات المختلفة لبدء الطلب
          </p>
          <Link to="/">
            <Button variant="outline" size="lg" className="gap-2 rounded-xl h-12 px-8">
              <ArrowRight className="w-4 h-4" />
              تصفح الخدمات
            </Button>
          </Link>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="py-10 sm:py-16">
      <SEOHead title="سلة المشتريات" description="راجع طلباتك وأكمل عملية الشراء - مطبعتي" canonical="/cart" noindex />
      <div className="container max-w-3xl">
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-8 transition-all duration-200">
          <ArrowRight className="w-4 h-4" />
          متابعة التسوق
        </Link>

        <motion.h1
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-2xl font-extrabold text-foreground mb-10 tracking-tight"
        >
          سلة المشتريات
          <span className="text-muted-foreground font-normal text-base mr-3">({items.length})</span>
        </motion.h1>

        <div className="space-y-4 mb-10">
          <AnimatePresence>
            {items.map((item, i) => (
              <motion.div
                key={item.templateId}
                layout
                custom={i}
                initial="hidden"
                animate="visible"
                exit={{ opacity: 0, x: 100, transition: { duration: 0.25 } }}
                variants={fadeUp}
                className="flex gap-4 p-5 rounded-2xl bg-card/80 backdrop-blur-sm border border-border/50 shadow-sm hover:shadow-md hover:border-primary/20 transition-all duration-300"
              >
                {/* Thumbnail */}
                <div className="w-20 h-20 rounded-xl overflow-hidden bg-muted/40 shrink-0 flex items-center justify-center">
                  {item.previewUrl ? (
                    <img src={item.previewUrl} alt={item.templateName} className="w-full h-full object-cover" />
                  ) : (
                    <Palette className="w-7 h-7 text-muted-foreground/30" />
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
                      className="p-2 rounded-xl text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all duration-200 shrink-0"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="flex items-center justify-between mt-4">
                    {/* Quantity */}
                    <div className="flex items-center gap-1.5">
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8 rounded-lg"
                        onClick={() => updateQuantity(item.templateId, item.quantity - 1000)}
                        disabled={item.quantity <= 1000}
                      >
                        <Minus className="w-3 h-3" />
                      </Button>
                      <span className="text-sm font-bold text-foreground min-w-[3.5rem] text-center">
                        {item.quantity.toLocaleString('en-US')}
                      </span>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8 rounded-lg"
                        onClick={() => updateQuantity(item.templateId, item.quantity + 1000)}
                      >
                        <Plus className="w-3 h-3" />
                      </Button>
                    </div>

                    {/* Price */}
                    <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-success/10 border border-success/15">
                      <span className="font-extrabold text-success text-sm">
                        {Math.ceil(item.unitPrice * (item.quantity / 1000)).toLocaleString('en-US')}
                      </span>
                      <span className="text-[10px] font-semibold text-success/70">د.ع</span>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {/* Summary */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="p-6 sm:p-8 rounded-2xl bg-card/80 backdrop-blur-sm border border-border/50 shadow-sm"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-muted-foreground text-sm">المجموع الكلي</span>
            <span className="text-2xl font-extrabold text-success">
              {totalPrice.toLocaleString('en-US')} <span className="text-sm font-bold text-success/70">د.ع</span>
            </span>
          </div>

          {/* Trust badges */}
          <div className="flex items-center gap-4 mb-6 mt-4">
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span className="text-[11px]">دفع آمن</span>
            </div>
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Truck className="w-3.5 h-3.5" />
              <span className="text-[11px]">توصيل سريع</span>
            </div>
          </div>

          <Button
            onClick={() => navigate('/checkout')}
            className="w-full h-12 text-base font-bold gap-2 rounded-xl animate-cta-glow"
          >
            <ShoppingCart className="w-5 h-5" />
            متابعة الطلب
          </Button>
          <button
            onClick={clearCart}
            className="w-full text-center text-xs text-muted-foreground hover:text-destructive mt-5 transition-colors duration-200"
          >
            تفريغ السلة
          </button>
        </motion.div>
      </div>
    </div>
  );
};

export default CartPage;
