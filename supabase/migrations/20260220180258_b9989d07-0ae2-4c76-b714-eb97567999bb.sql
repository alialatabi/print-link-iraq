-- 1. Drop the duplicate customer notification trigger
DROP TRIGGER IF EXISTS on_order_status_change ON public.orders;
DROP FUNCTION IF EXISTS public.notify_order_status_change();

-- 2. Fix draft label & improve customer notification function
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

  -- Skip draft status notifications to customer (internal state)
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
    ELSE status_label := NEW.status;
  END CASE;

  notif_title := 'تحديث طلبك 🔔';
  notif_msg   := status_label;

  INSERT INTO public.notifications (user_id, order_id, title, message)
  VALUES (NEW.customer_id, NEW.id, notif_title, notif_msg);

  RETURN NEW;
END;
$$;

-- 3. Notify ALL admins when a new order is submitted
CREATE OR REPLACE FUNCTION public.notify_admin_on_new_order()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  admin_id uuid;
BEGIN
  -- Fire when status becomes 'submitted' (new order)
  IF NEW.status = 'submitted' AND (OLD.status IS NULL OR OLD.status != 'submitted') THEN
    FOR admin_id IN
      SELECT user_id FROM public.user_roles WHERE role = 'admin'
    LOOP
      INSERT INTO public.notifications (user_id, order_id, title, message)
      VALUES (
        admin_id,
        NEW.id,
        'طلب جديد 🆕',
        'وصل طلب جديد من: ' || COALESCE(NEW.customer_name, 'زبون')
      );
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$;

-- 4. Notify designer when assigned to an order
CREATE OR REPLACE FUNCTION public.notify_designer_on_assignment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Fire when designer_id is set or changed
  IF NEW.designer_id IS NOT NULL AND (OLD.designer_id IS DISTINCT FROM NEW.designer_id) THEN
    INSERT INTO public.notifications (user_id, order_id, title, message)
    VALUES (
      NEW.designer_id,
      NEW.id,
      'طلب جديد معيّن لك 🎨',
      'تم تعيين طلب جديد لك: ' || COALESCE(
        (SELECT name FROM public.templates WHERE id = NEW.template_id),
        'طلب تصميم'
      )
    );
  END IF;
  RETURN NEW;
END;
$$;

-- 5. Create triggers for admin & designer notifications
DROP TRIGGER IF EXISTS trg_notify_admin_on_new_order ON public.orders;
CREATE TRIGGER trg_notify_admin_on_new_order
  AFTER INSERT OR UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_admin_on_new_order();

DROP TRIGGER IF EXISTS trg_notify_designer_on_assignment ON public.orders;
CREATE TRIGGER trg_notify_designer_on_assignment
  AFTER UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_designer_on_assignment();