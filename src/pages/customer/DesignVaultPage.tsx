import { useEffect, useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Archive, Sparkles, Upload, Palette, FileText, ShoppingBag, Loader2, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import SEOHead from '@/components/SEOHead';
import {
  VaultItem, VaultSource, loadVault, resolveVaultDisplayUrl,
  reorderVaultItem, deleteVaultDesign, isImageUrl,
} from '@/lib/designVault';

const SECTIONS: { source: VaultSource; title: string; icon: typeof Sparkles }[] = [
  { source: 'ai', title: 'تصاميم الذكاء الاصطناعي', icon: Sparkles },
  { source: 'uploaded', title: 'تصاميمي المرفوعة', icon: Upload },
  { source: 'designer', title: 'تصاميم صمّمناها لك', icon: Palette },
];

const VaultCard = ({ item, onReorder, onDelete, busy }: {
  item: VaultItem;
  onReorder: (item: VaultItem) => void;
  onDelete: (item: VaultItem) => void;
  busy: boolean;
}) => {
  const showImage = item.displayUrl && isImageUrl(item.displayUrl);
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      className="bg-card rounded-2xl border border-border/60 shadow-card overflow-hidden flex flex-col"
    >
      <div className="aspect-square bg-muted/30 flex items-center justify-center overflow-hidden relative">
        {showImage ? (
          <img
            src={item.displayUrl}
            alt={item.label}
            loading="lazy"
            className="w-full h-full object-contain cursor-pointer"
            onClick={() => window.open(item.displayUrl, '_blank')}
          />
        ) : item.displayUrl ? (
          <a href={item.displayUrl} target="_blank" rel="noreferrer" className="flex flex-col items-center gap-2 text-muted-foreground hover:text-primary">
            <FileText className="w-12 h-12" />
            <span className="text-xs">عرض الملف</span>
          </a>
        ) : (
          <Loader2 className="w-6 h-6 text-muted-foreground/50 animate-spin" />
        )}
        {item.vaultRowId && (
          <button
            onClick={() => onDelete(item)}
            disabled={busy}
            aria-label="حذف"
            className="absolute top-2 left-2 w-8 h-8 rounded-full bg-background/80 backdrop-blur text-destructive flex items-center justify-center hover:bg-destructive hover:text-destructive-foreground transition-colors"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>
      <div className="p-3 flex flex-col gap-2 flex-1">
        <div className="min-w-0">
          <p className="text-sm font-bold text-foreground truncate">{item.label}</p>
          <p className="text-[11px] text-muted-foreground">
            {new Date(item.createdAt).toLocaleDateString('ar-IQ', { year: 'numeric', month: 'short', day: 'numeric' })}
          </p>
        </div>
        <Button
          onClick={() => onReorder(item)}
          disabled={busy}
          size="sm"
          className="w-full bg-success hover:bg-success/90 text-success-foreground rounded-xl mt-auto"
        >
          {busy ? <Loader2 className="w-4 h-4 ml-1.5 animate-spin" /> : <ShoppingBag className="w-4 h-4 ml-1.5" />}
          اطلب هذا التصميم
        </Button>
      </div>
    </motion.div>
  );
};

const DesignVaultPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [items, setItems] = useState<VaultItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const list = await loadVault(user.id);
      setItems(list);
      // Resolve display URLs (signs private designer designs) progressively.
      list.forEach(async (it) => {
        const url = await resolveVaultDisplayUrl(it);
        if (url) setItems((prev) => prev.map((p) => (p.id === it.id ? { ...p, displayUrl: url } : p)));
      });
    } catch {
      toast({ title: 'تعذّر تحميل الخزنة', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [user, toast]);

  useEffect(() => { load(); }, [load]);

  const handleReorder = async (item: VaultItem) => {
    if (!user) { navigate('/auth'); return; }
    setBusyId(item.id);
    try {
      const orderId = await reorderVaultItem(user.id, item);
      toast({ title: 'تم إنشاء الطلب ✅' });
      navigate(`/order-success?order=${orderId}`);
    } catch (e) {
      toast({ title: 'فشل إنشاء الطلب', description: e instanceof Error ? e.message : 'حاول مرة أخرى', variant: 'destructive' });
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (item: VaultItem) => {
    if (!item.vaultRowId) return;
    setBusyId(item.id);
    try {
      await deleteVaultDesign(item.vaultRowId);
      setItems((prev) => prev.filter((p) => p.id !== item.id));
      toast({ title: 'تم حذف التصميم من الخزنة' });
    } catch {
      toast({ title: 'تعذّر الحذف', variant: 'destructive' });
    } finally {
      setBusyId(null);
    }
  };

  if (loading) return (
    <div className="py-24 text-center">
      <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mx-auto" />
    </div>
  );

  return (
    <div className="section-spacing-sm">
      <SEOHead title="خزنة التصاميم" description="كل تصاميمك في مكان واحد — اطلب أي تصميم سبق أن صمّمته أو رفعته أو صمّمناه لك." canonical="/design-vault" noindex />
      <div className="container max-w-4xl">
        <div className="mb-8 flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center text-primary flex-shrink-0">
            <Archive className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-foreground tracking-tight">خزنة التصاميم</h1>
            <p className="text-muted-foreground text-sm mt-0.5">{items.length} تصميم — اطلب أي تصميم بضغطة واحدة</p>
          </div>
        </div>

        {items.length === 0 ? (
          <div className="text-center py-24">
            <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4">
              <Archive className="w-8 h-8 text-muted-foreground/40" />
            </div>
            <p className="text-muted-foreground text-sm mb-6">خزنتك فارغة — صمّم أو ارفع تصميماً ليُحفظ هنا</p>
            <div className="flex gap-3 justify-center flex-wrap">
              <Link to="/ai-design"><Button className="rounded-xl"><Sparkles className="w-4 h-4 ml-1.5" />تصميم بالذكاء الاصطناعي</Button></Link>
              <Link to="/upload-design"><Button variant="outline" className="rounded-xl"><Upload className="w-4 h-4 ml-1.5" />ارفع تصميمك</Button></Link>
            </div>
          </div>
        ) : (
          <div className="space-y-10">
            {SECTIONS.map(({ source, title, icon: Icon }) => {
              const sectionItems = items.filter((i) => i.source === source);
              if (sectionItems.length === 0) return null;
              return (
                <section key={source}>
                  <div className="flex items-center gap-2 mb-4">
                    <Icon className="w-4 h-4 text-primary" />
                    <h2 className="font-bold text-foreground text-sm">{title}</h2>
                    <span className="text-[11px] text-muted-foreground bg-muted px-2 py-0.5 rounded-full">{sectionItems.length}</span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                    {sectionItems.map((item) => (
                      <VaultCard
                        key={item.id}
                        item={item}
                        onReorder={handleReorder}
                        onDelete={handleDelete}
                        busy={busyId === item.id}
                      />
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default DesignVaultPage;
