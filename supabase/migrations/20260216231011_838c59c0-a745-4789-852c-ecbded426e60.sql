
-- Create role enum
CREATE TYPE public.app_role AS ENUM ('customer', 'designer', 'admin');

-- Create order status enum
CREATE TYPE public.order_status AS ENUM (
  'draft', 'submitted', 'assigned', 'design_uploaded', 
  'waiting_approval', 'approved', 'print_ready', 'printed', 'delivered'
);

-- Create service type enum
CREATE TYPE public.service_type AS ENUM (
  'business_card', 'flyer', 'receipt', 'letterhead', 'menu', 'invitation'
);

-- Profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  phone TEXT,
  display_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- User roles table (separate from profiles per security requirement)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Templates table
CREATE TABLE public.templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  service_type service_type NOT NULL,
  preview_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.templates ENABLE ROW LEVEL SECURITY;

-- Orders table
CREATE TABLE public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  designer_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  template_id UUID REFERENCES public.templates(id),
  status order_status NOT NULL DEFAULT 'draft',
  details JSONB DEFAULT '{}',
  customer_name TEXT,
  customer_phone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- Designs table
CREATE TABLE public.designs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE NOT NULL,
  file_url TEXT,
  version INT NOT NULL DEFAULT 1,
  approved BOOLEAN DEFAULT false,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.designs ENABLE ROW LEVEL SECURITY;

-- Helper function: has_role
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Trigger for auto-creating profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, phone, display_name)
  VALUES (
    NEW.id,
    NEW.phone,
    COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.phone)
  );
  -- Default role: customer
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'customer');
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Updated_at trigger
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_orders_updated_at
  BEFORE UPDATE ON public.orders FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

-- RLS Policies

-- Profiles: anyone authenticated can read, users update own
CREATE POLICY "Anyone can read profiles"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users update own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

-- User roles: users can read own role, admins can manage
CREATE POLICY "Users read own roles"
  ON public.user_roles FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins manage roles"
  ON public.user_roles FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins delete roles"
  ON public.user_roles FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Templates: public read, admin manage
CREATE POLICY "Anyone can read templates"
  ON public.templates FOR SELECT
  USING (true);

CREATE POLICY "Admins manage templates"
  ON public.templates FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins update templates"
  ON public.templates FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Orders: customer sees own, designer sees assigned, admin sees all
CREATE POLICY "Customers read own orders"
  ON public.orders FOR SELECT
  TO authenticated
  USING (
    auth.uid() = customer_id
    OR auth.uid() = designer_id
    OR public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY "Customers create orders"
  ON public.orders FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = customer_id);

CREATE POLICY "Order updates"
  ON public.orders FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = customer_id
    OR auth.uid() = designer_id
    OR public.has_role(auth.uid(), 'admin')
  );

-- Designs: accessible by order owner, assigned designer, admin
CREATE POLICY "Read designs"
  ON public.designs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.orders
      WHERE orders.id = designs.order_id
      AND (orders.customer_id = auth.uid() OR orders.designer_id = auth.uid())
    )
    OR public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY "Designers upload designs"
  ON public.designs FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.orders
      WHERE orders.id = order_id AND orders.designer_id = auth.uid()
    )
    OR public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY "Designers update designs"
  ON public.designs FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.orders
      WHERE orders.id = designs.order_id AND orders.designer_id = auth.uid()
    )
    OR public.has_role(auth.uid(), 'admin')
  );

-- Storage bucket for design files
INSERT INTO storage.buckets (id, name, public) VALUES ('designs', 'designs', false);

CREATE POLICY "Authenticated users upload designs"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'designs');

CREATE POLICY "Authenticated users read designs"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'designs');

-- Seed templates
INSERT INTO public.templates (name, description, service_type) VALUES
  ('كلاسيك بزنس', 'تصميم كلاسيكي أنيق', 'business_card'),
  ('مودرن كارد', 'تصميم عصري حديث', 'business_card'),
  ('إبداعي', 'تصميم إبداعي ملفت', 'business_card'),
  ('بسيط وأنيق', 'بساطة مع أناقة', 'business_card'),
  ('فلاير عرض', 'فلاير لعروض خاصة', 'flyer'),
  ('فلاير حدث', 'فلاير لإعلان حدث', 'flyer'),
  ('فلاير منتج', 'فلاير عرض منتجات', 'flyer'),
  ('وصل رسمي', 'وصل رسمي معتمد', 'receipt'),
  ('وصل بسيط', 'وصل بسيط وعملي', 'receipt'),
  ('ترويسة رسمية', 'ترويسة لمراسلاتك الرسمية', 'letterhead'),
  ('منيو مطعم', 'قائمة طعام عصرية', 'menu'),
  ('دعوة زفاف', 'دعوة زفاف أنيقة', 'invitation');
