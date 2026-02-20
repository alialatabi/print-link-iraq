-- Update customer notification function to handle 'cancelled' status
CREATE OR REPLACE FUNCTION public.notify_customer_on_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  status_label TEXT;
  notif_title  TEXT;
  notif_msg    TEXT;
BEGIN
  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  IF NEW.status = 'draft' THEN
    RETURN NEW;
  END IF;

  CASE NEW.status
    WHEN 'submitted'        THEN status_label := 'تم إرسال الطلب بنجاح';
    WHEN 'assigned'         THEN status_label := 'تم تعيين مصمم لطلبك';
    WHEN 'design_uploaded'  THEN status_label := 'تم رفع التصميم';
    WHEN 'waiting_approval' THEN status_label := 'التصميم جاهز - بانتظار موافقتك';
    WHEN 'approved'         THEN status_label := 'تمت الموافقة على التصميم';
    WHEN 'print_ready'      THEN status_label := 'جاهز للطباعة';
    WHEN 'printed'          THEN status_label := 'تمت الطباعة بنجاح';
    WHEN 'delivered'        THEN status_label := 'تم التسليم - شكراً لك!';
    WHEN 'cancelled'        THEN status_label := 'تم إلغاء طلبك';
    ELSE status_label := NEW.status;
  END CASE;

  notif_title := CASE NEW.status WHEN 'cancelled' THEN 'تم إلغاء الطلب ❌' ELSE 'تحديث طلبك 🔔' END;
  notif_msg   := status_label;

  INSERT INTO public.notifications (user_id, order_id, title, message)
  VALUES (NEW.customer_id, NEW.id, notif_title, notif_msg);

  RETURN NEW;
END;
$$;
