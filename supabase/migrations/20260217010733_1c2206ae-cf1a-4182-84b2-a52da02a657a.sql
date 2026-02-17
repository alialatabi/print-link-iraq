
-- Notifications table
CREATE TABLE public.notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own notifications"
  ON public.notifications FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users update own notifications"
  ON public.notifications FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "System inserts notifications"
  ON public.notifications FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE INDEX idx_notifications_user_unread ON public.notifications(user_id, read) WHERE read = false;

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- Trigger function to create notification on order status change
CREATE OR REPLACE FUNCTION public.notify_order_status_change()
RETURNS TRIGGER AS $$
DECLARE
  _status_label TEXT;
  _template_name TEXT;
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    SELECT
      CASE NEW.status
        WHEN 'submitted' THEN 'تم استلام الطلب'
        WHEN 'assigned' THEN 'تم تعيين مصمم'
        WHEN 'design_uploaded' THEN 'تم رفع التصميم'
        WHEN 'waiting_approval' THEN 'بانتظار موافقتك'
        WHEN 'approved' THEN 'تمت الموافقة'
        WHEN 'print_ready' THEN 'جاهز للطباعة'
        WHEN 'printed' THEN 'تمت الطباعة'
        WHEN 'delivered' THEN 'تم التسليم'
        ELSE NEW.status::text
      END INTO _status_label;

    SELECT name INTO _template_name FROM public.templates WHERE id = NEW.template_id;

    INSERT INTO public.notifications (user_id, order_id, title, message)
    VALUES (
      NEW.customer_id,
      NEW.id,
      'تحديث حالة الطلب',
      COALESCE(_template_name, 'طلبك') || ': ' || _status_label
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_order_status_change
  AFTER UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_order_status_change();
