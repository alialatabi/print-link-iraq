import type { Dispatch, SetStateAction } from 'react';
import { m as motion } from 'framer-motion';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Palette, CheckCircle, Trash2 } from 'lucide-react';
import { ROLE_LABELS } from '@/lib/constants';
import type { AdminUser } from './adminTypes';

interface DesignerForm {
  phone: string;
  display_name: string;
  password: string;
}

interface Props {
  allUsers: AdminUser[];
  isSuperAdmin: boolean;
  currentUserId: string | undefined;
  handleToggleRole: (userId: string, role: string, hasRole: boolean) => void;
  handleDeleteDesigner: (userId: string) => void;
  designerDialogOpen: boolean;
  setDesignerDialogOpen: (v: boolean) => void;
  designerForm: DesignerForm;
  setDesignerForm: Dispatch<SetStateAction<DesignerForm>>;
  handleCreateDesigner: () => void;
  creatingDesigner: boolean;
}

const AdminUsersTab = ({
  allUsers,
  isSuperAdmin,
  currentUserId,
  handleToggleRole,
  handleDeleteDesigner,
  designerDialogOpen,
  setDesignerDialogOpen,
  designerForm,
  setDesignerForm,
  handleCreateDesigner,
  creatingDesigner,
}: Props) => {
  return (
    <>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
              <Palette className="w-5 h-5 text-primary" />
              إدارة المصممين
            </h3>
            <p className="text-sm text-muted-foreground">إضافة وحذف المصممين وتغيير صلاحياتهم</p>
          </div>
          <Button onClick={() => setDesignerDialogOpen(true)} className="rounded-xl gap-1.5">
            <Palette className="w-4 h-4" />
            إضافة مصمم جديد
          </Button>
        </div>

        {allUsers.filter(u => u.roles.includes('designer')).length === 0 ? (
          <div className="text-center py-16">
            <Palette className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
            <p className="text-muted-foreground text-lg">لا يوجد مصممين</p>
          </div>
        ) : (
          <div className="space-y-3">
            {allUsers.filter(u => u.roles.includes('designer')).map((u, i) => (
              <motion.div
                key={u.user_id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i * 0.04, 0.3) }}
                className="bg-card rounded-xl p-4 border border-border shadow-sm"
              >
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-secondary/30 flex items-center justify-center">
                      <Palette className="w-5 h-5 text-secondary-foreground" />
                    </div>
                    <div>
                      <h4 className="font-bold text-foreground text-sm">
                        {u.display_name || u.phone || 'مستخدم'}
                      </h4>
                      {u.phone && <p className="text-xs text-muted-foreground mt-0.5" dir="ltr">{u.phone}</p>}
                      <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                        {u.roles.map((r: string) => (
                          <Badge key={r} variant={r === 'admin' ? 'default' : r === 'designer' ? 'secondary' : 'outline'} className="text-[10px]">
                            {r === 'admin' ? 'أدمن' : r === 'designer' ? 'مصمم' : 'زبون'}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    {(['customer', 'designer', ...(isSuperAdmin ? ['admin'] : [])] as string[]).map(role => {
                      const has = u.roles.includes(role);
                      return (
                        <button
                          key={role}
                          onClick={() => handleToggleRole(u.user_id, role, has)}
                          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium border transition-colors ${
                            has
                              ? 'bg-primary/10 border-primary/30 text-primary'
                              : 'bg-muted/50 border-border text-muted-foreground hover:border-primary/30'
                          }`}
                        >
                          {has ? <CheckCircle className="w-3 h-3" /> : <span className="w-3 h-3 rounded-full border border-current" />}
                          {ROLE_LABELS[role]}
                        </button>
                      );
                    })}
                    {/* Never offer delete for your own row or a super admin (mirrors the Admins tab guard). */}
                    {!u.is_super_admin && u.user_id !== currentUserId && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button size="sm" variant="outline" className="text-xs h-8 rounded-lg text-destructive border-destructive/30 hover:bg-destructive/10">
                            <Trash2 className="w-3 h-3 ml-1" />
                            حذف
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent dir="rtl">
                          <AlertDialogHeader>
                            <AlertDialogTitle>حذف حساب المصمم</AlertDialogTitle>
                            <AlertDialogDescription>
                              هل أنت متأكد من حذف حساب "{u.display_name || u.phone}"؟ سيتم حذف الحساب نهائياً.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>إلغاء</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDeleteDesigner(u.user_id)} className="bg-destructive hover:bg-destructive/90">
                              حذف نهائي
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Create Designer Dialog */}
      <Dialog open={designerDialogOpen} onOpenChange={setDesignerDialogOpen}>
        <DialogContent className="max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle>إضافة حساب مصمم جديد</DialogTitle>
            <DialogDescription>
              أدخل بيانات المصمم ليتمكن من استلام الطلبات وتصميمها.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <label className="text-sm font-medium text-foreground mb-1 block">رقم الهاتف *</label>
              <Input
                value={designerForm.phone}
                onChange={e => setDesignerForm(f => ({ ...f, phone: e.target.value }))}
                placeholder="07xxxxxxxxx"
                className="rounded-xl"
                dir="ltr"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground mb-1 block">الاسم</label>
              <Input
                value={designerForm.display_name}
                onChange={e => setDesignerForm(f => ({ ...f, display_name: e.target.value }))}
                placeholder="اسم المصمم"
                className="rounded-xl"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground mb-1 block">كلمة المرور *</label>
              <Input
                type="password"
                value={designerForm.password}
                onChange={e => setDesignerForm(f => ({ ...f, password: e.target.value }))}
                placeholder="6 أحرف على الأقل"
                className="rounded-xl"
                dir="ltr"
              />
            </div>
            <p className="text-[11px] text-muted-foreground bg-muted/50 rounded-lg p-3">
              سيتم إنشاء حساب مصمم جديد. يمكن للمصمم تسجيل الدخول عبر صفحة طاقم العمل باستخدام رقم الهاتف وكلمة المرور.
            </p>
            <div className="flex gap-2 pt-2">
              <Button onClick={handleCreateDesigner} disabled={creatingDesigner} className="flex-1 rounded-xl">
                {creatingDesigner ? 'جاري الإنشاء...' : 'إنشاء حساب مصمم'}
              </Button>
              <Button variant="outline" onClick={() => setDesignerDialogOpen(false)} disabled={creatingDesigner} className="rounded-xl">
                إلغاء
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default AdminUsersTab;
