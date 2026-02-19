
-- Allow service role (triggers) to insert notifications
CREATE POLICY "Service role insert notifications"
ON public.notifications
FOR INSERT
TO service_role
WITH CHECK (true);

-- Function to notify customer on order status change
CREATE OR REPLACE FUNCTION public.notify_customer_on_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  status_label TEXT;
  notif_title  TEXT;
  notif_msg    TEXT;
BEGIN
  -- Only fire when status actually changes
  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  -- Map status to Arabic label
  CASE NEW.status
    WHEN 'submitted'        THEN status_label := 'تم إرسال الطلب';
    WHEN 'assigned'         THEN status_label := 'تم تعيين مصمم';
    WHEN 'design_uploaded'  THEN status_label := 'تم رفع التصميم';
    WHEN 'waiting_approval' THEN status_label := 'بانتظار موافقتك';
    WHEN 'approved'         THEN status_label := 'تمت الموافقة';
    WHEN 'print_ready'      THEN status_label := 'جاهز للطباعة';
    WHEN 'printed'          THEN status_label := 'تمت الطباعة';
    WHEN 'delivered'        THEN status_label := 'تم التسليم';
    ELSE status_label := NEW.status;
  END CASE;

  notif_title := 'تحديث طلبك 🔔';
  notif_msg   := 'حالة طلبك تغيرت إلى: ' || status_label;

  INSERT INTO public.notifications (user_id, order_id, title, message)
  VALUES (NEW.customer_id, NEW.id, notif_title, notif_msg);

  RETURN NEW;
END;
$$;

-- Attach trigger to orders table
CREATE TRIGGER trg_notify_customer_on_status_change
AFTER UPDATE OF status ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.notify_customer_on_status_change();
