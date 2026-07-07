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
import { ShieldCheck, Crown, CheckCircle, Trash2 } from 'lucide-react';
import { ROLE_LABELS } from '@/lib/constants';
import type { AdminUser } from './adminTypes';

interface AdminForm {
  phone: string;
  display_name: string;
  password: string;
}

interface Props {
  allUsers: AdminUser[];
  isSuperAdmin: boolean;
  currentUserId: string | undefined;
  handleToggleSuperAdmin: (userId: string, currentlySuper: boolean) => void;
  handleToggleRole: (userId: string, role: string, hasRole: boolean) => void;
  handleDeleteAdmin: (userId: string) => void;
  adminDialogOpen: boolean;
  setAdminDialogOpen: (v: boolean) => void;
  adminForm: AdminForm;
  setAdminForm: Dispatch<SetStateAction<AdminForm>>;
  handleCreateAdmin: () => void;
  creatingAdmin: boolean;
}

const AdminAdminsTab = ({
  allUsers,
  isSuperAdmin,
  currentUserId,
  handleToggleSuperAdmin,
  handleToggleRole,
  handleDeleteAdmin,
  adminDialogOpen,
  setAdminDialogOpen,
  adminForm,
  setAdminForm,
  handleCreateAdmin,
  creatingAdmin,
}: Props) => {
  return (
    <>
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-primary" />
              إدارة حسابات الأدمن
            </h3>
            <p className="text-sm text-muted-foreground">هذه الصفحة متاحة فقط للسوبر أدمن</p>
          </div>
          <Button onClick={() => setAdminDialogOpen(true)} className="rounded-xl gap-1.5 w-full sm:w-auto">
            <ShieldCheck className="w-4 h-4" />
            إضافة أدمن جديد
          </Button>
        </div>

        {/* Current admins list */}
        <div className="space-y-3">
          {allUsers.filter(u => u.roles.includes('admin')).map((u, i) => {
            const isSuperAdminUser = u.is_super_admin === true;
            const isMe = u.user_id === currentUserId;
            return (
              <motion.div
                key={u.user_id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i * 0.04, 0.3) }}
                className="bg-card rounded-xl p-4 border border-border shadow-sm"
              >
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isSuperAdminUser ? 'bg-primary/15' : 'bg-muted'}`}>
                      {isSuperAdminUser ? <Crown className="w-5 h-5 text-primary" /> : <ShieldCheck className={`w-5 h-5 text-muted-foreground`} />}
                    </div>
                    <div>
                      <h4 className="font-bold text-foreground text-sm flex items-center gap-2">
                        {u.display_name || u.phone || 'مستخدم'}
                        {isSuperAdminUser && (
                          <Badge variant="default" className="text-[10px]">سوبر أدمن</Badge>
                        )}
                      </h4>
                      {u.phone && <p className="text-xs text-muted-foreground mt-0.5" dir="ltr">{u.phone}</p>}
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        {u.roles.map((r: string) => (
                          <Badge key={r} variant={r === 'admin' ? 'default' : r === 'designer' ? 'secondary' : 'outline'} className="text-[10px]">
                            {r === 'admin' ? 'أدمن' : r === 'designer' ? 'مصمم' : 'زبون'}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    {/* Super admin toggle with confirmation dialog */}
                    {isSuperAdmin && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <button
                            disabled={isSuperAdminUser && !isMe}
                            className={`flex items-center gap-1.5 px-2.5 py-1.5 sm:py-1 rounded-lg text-[11px] font-medium border transition-colors ${
                              isSuperAdminUser
                                ? 'bg-amber-500/10 border-amber-500/30 text-amber-600'
                                : 'bg-muted/50 border-border text-muted-foreground hover:border-amber-500/30'
                            } ${isSuperAdminUser && !isMe ? 'opacity-50 cursor-not-allowed' : ''}`}
                          >
                            <Crown className="w-3 h-3" />
                            سوبر أدمن
                          </button>
                        </AlertDialogTrigger>
                        <AlertDialogContent dir="rtl">
                          <AlertDialogHeader>
                            <AlertDialogTitle className="flex items-center gap-2">
                              <Crown className={`w-5 h-5 ${isSuperAdminUser ? 'text-destructive' : 'text-amber-500'}`} />
                              {isSuperAdminUser ? 'إزالة صلاحية السوبر أدمن' : 'منح صلاحية السوبر أدمن'}
                            </AlertDialogTitle>
                            <AlertDialogDescription className="text-right">
                              {isSuperAdminUser ? (
                                <span className="space-y-2 block">
                                  <span className="block text-destructive font-bold">⚠️ تحذير: هذا إجراء خطير!</span>
                                  <span className="block">أنت على وشك إزالة صلاحية السوبر أدمن من <strong>{u.display_name || u.phone || 'هذا المستخدم'}</strong>.</span>
                                  <span className="block">سيفقد القدرة على إدارة حسابات الأدمن الأخرى وتعديل الصلاحيات الحساسة.</span>
                                </span>
                              ) : (
                                <span className="space-y-2 block">
                                  <span className="block">هل تريد منح صلاحية السوبر أدمن لـ <strong>{u.display_name || u.phone || 'هذا المستخدم'}</strong>؟</span>
                                  <span className="block text-muted-foreground">سيحصل على كامل الصلاحيات بما فيها إدارة حسابات الأدمن وتعديل الأدوار الحساسة.</span>
                                </span>
                              )}
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter className="flex-col-reverse sm:flex-row-reverse gap-2">
                            <AlertDialogCancel>تراجع</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleToggleSuperAdmin(u.user_id, isSuperAdminUser)}
                              className={isSuperAdminUser
                                ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90'
                                : 'bg-amber-500 text-white hover:bg-amber-600'
                              }
                            >
                              {isSuperAdminUser ? 'نعم، إزالة الصلاحية' : 'نعم، منح الصلاحية'}
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                    {/* Role toggles: disabled for other super admins */}
                    {(!isSuperAdminUser || isMe) && (
                      <>
                        {(['customer', 'designer', 'admin'] as string[]).map(role => {
                          const has = u.roles.includes(role);
                          return (
                            <button
                              key={role}
                              onClick={() => handleToggleRole(u.user_id, role, has)}
                              className={`flex items-center gap-1.5 px-2.5 py-1.5 sm:py-1 rounded-lg text-[11px] font-medium border transition-colors ${
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
                      </>
                    )}
                    {isSuperAdminUser && !isMe && (
                      <span className="text-[10px] text-muted-foreground">محمي — فقط هو يمكنه تعديل صلاحياته</span>
                    )}
                    {/* Delete admin — super admin only; never for a super admin or yourself (server-enforced too). */}
                    {!isSuperAdminUser && !isMe && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button size="sm" variant="outline" className="text-xs h-9 sm:h-7 rounded-lg text-destructive border-destructive/30 hover:bg-destructive/10 gap-1">
                            <Trash2 className="w-3 h-3" /> حذف
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent dir="rtl">
                          <AlertDialogHeader>
                            <AlertDialogTitle>حذف حساب الأدمن</AlertDialogTitle>
                            <AlertDialogDescription>
                              هل أنت متأكد من حذف حساب الأدمن <strong>{u.display_name || u.phone}</strong> نهائياً؟ لا يمكن التراجع عن هذا الإجراء.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter className="flex-col-reverse sm:flex-row-reverse gap-2">
                            <AlertDialogCancel>تراجع</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDeleteAdmin(u.user_id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                              نعم، حذف نهائي
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Create Admin Dialog */}
      <Dialog open={adminDialogOpen} onOpenChange={setAdminDialogOpen}>
        <DialogContent className="max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle>إضافة حساب أدمن جديد</DialogTitle>
            <DialogDescription>
              أدخل بيانات الأدمن الجديد ليتمكن من الوصول إلى لوحة الإدارة.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <label className="text-sm font-medium text-foreground mb-1 block">رقم الهاتف *</label>
              <Input
                value={adminForm.phone}
                onChange={e => setAdminForm(f => ({ ...f, phone: e.target.value }))}
                placeholder="07xxxxxxxxx"
                className="rounded-xl"
                dir="ltr"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground mb-1 block">الاسم</label>
              <Input
                value={adminForm.display_name}
                onChange={e => setAdminForm(f => ({ ...f, display_name: e.target.value }))}
                placeholder="اسم المستخدم"
                className="rounded-xl"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground mb-1 block">كلمة المرور *</label>
              <Input
                type="password"
                value={adminForm.password}
                onChange={e => setAdminForm(f => ({ ...f, password: e.target.value }))}
                placeholder="6 أحرف على الأقل"
                className="rounded-xl"
                dir="ltr"
              />
            </div>
            <p className="text-[11px] text-muted-foreground bg-muted/50 rounded-lg p-3">
              سيتم إنشاء حساب أدمن جديد. يمكن للمستخدم تسجيل الدخول عبر صفحة طاقم العمل باستخدام رقم الهاتف وكلمة المرور.
            </p>
            <div className="flex gap-2 pt-2">
              <Button onClick={handleCreateAdmin} disabled={creatingAdmin} className="flex-1 rounded-xl">
                {creatingAdmin ? 'جاري الإنشاء...' : 'إنشاء حساب أدمن'}
              </Button>
              <Button variant="outline" onClick={() => setAdminDialogOpen(false)} disabled={creatingAdmin} className="rounded-xl">
                إلغاء
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default AdminAdminsTab;
