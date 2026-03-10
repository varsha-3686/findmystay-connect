
-- Laundry service types and pricing
CREATE TABLE public.laundry_services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  price numeric NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Laundry order status enum
CREATE TYPE public.laundry_order_status AS ENUM (
  'order_placed',
  'pickup_scheduled',
  'in_progress',
  'out_for_delivery',
  'delivered',
  'cancelled'
);

-- Laundry orders
CREATE TABLE public.laundry_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  hostel_id uuid REFERENCES public.hostels(id),
  status public.laundry_order_status NOT NULL DEFAULT 'order_placed',
  pickup_time timestamptz,
  delivery_time timestamptz,
  total_amount numeric NOT NULL DEFAULT 0,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Laundry order items
CREATE TABLE public.laundry_order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.laundry_orders(id) ON DELETE CASCADE,
  service_id uuid NOT NULL REFERENCES public.laundry_services(id),
  quantity integer NOT NULL DEFAULT 1,
  price numeric NOT NULL DEFAULT 0,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Laundry ratings
CREATE TABLE public.laundry_ratings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.laundry_orders(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  rating integer NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(order_id)
);

-- Enable RLS
ALTER TABLE public.laundry_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.laundry_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.laundry_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.laundry_ratings ENABLE ROW LEVEL SECURITY;

-- Laundry services: anyone can view, admins can manage
CREATE POLICY "Anyone can view active laundry services" ON public.laundry_services FOR SELECT TO public USING (true);
CREATE POLICY "Admins can insert laundry services" ON public.laundry_services FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update laundry services" ON public.laundry_services FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete laundry services" ON public.laundry_services FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'));

-- Laundry orders: users see own, admins see all
CREATE POLICY "Users can view own laundry orders" ON public.laundry_orders FOR SELECT TO authenticated USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'));
CREATE POLICY "Users can create laundry orders" ON public.laundry_orders FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users and admins can update laundry orders" ON public.laundry_orders FOR UPDATE TO authenticated USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'));

-- Laundry order items: follow order access
CREATE POLICY "Users can view own order items" ON public.laundry_order_items FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.laundry_orders WHERE id = order_id AND (user_id = auth.uid() OR has_role(auth.uid(), 'admin'))));
CREATE POLICY "Users can insert order items" ON public.laundry_order_items FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.laundry_orders WHERE id = order_id AND user_id = auth.uid()));

-- Laundry ratings: users see own, admins see all
CREATE POLICY "Anyone can view laundry ratings" ON public.laundry_ratings FOR SELECT TO public USING (true);
CREATE POLICY "Users can rate own orders" ON public.laundry_ratings FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id AND EXISTS (SELECT 1 FROM public.laundry_orders WHERE id = order_id AND user_id = auth.uid() AND status = 'delivered'));

-- Enable realtime for orders
ALTER PUBLICATION supabase_realtime ADD TABLE public.laundry_orders;

-- Seed default laundry services
INSERT INTO public.laundry_services (name, description, price) VALUES
  ('Wash', 'Regular wash cycle for everyday clothes', 30),
  ('Fold', 'Neat folding service for washed clothes', 15),
  ('Iron', 'Professional ironing and pressing', 20),
  ('Dry Clean', 'Dry cleaning for delicate fabrics and formal wear', 80);

-- Updated at trigger
CREATE TRIGGER update_laundry_orders_updated_at BEFORE UPDATE ON public.laundry_orders FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_laundry_services_updated_at BEFORE UPDATE ON public.laundry_services FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
