-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. SHOPS TABLE (Multi-tenancy)
CREATE TABLE shops (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. PROFILES TABLE (Linked to auth.users)
CREATE TABLE profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    shop_id UUID REFERENCES shops(id) ON DELETE SET NULL,
    full_name TEXT,
    role TEXT DEFAULT 'admin',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. CUSTOMERS TABLE
CREATE TABLE customers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    cpf TEXT,
    phone TEXT,
    email TEXT,
    address TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. PRESCRIPTIONS TABLE
CREATE TABLE prescriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
    
    -- Left Eye (Olho Esquerdo - OE)
    oe_sphere DECIMAL(5,2),
    oe_cylinder DECIMAL(5,2),
    oe_axis INTEGER,
    
    -- Right Eye (Olho Direito - OD)
    od_sphere DECIMAL(5,2),
    od_cylinder DECIMAL(5,2),
    od_axis INTEGER,
    
    addition DECIMAL(5,2),
    dp DECIMAL(5,2), -- Distância Pupilar
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. PRODUCTS TABLE
CREATE TABLE products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    category TEXT, -- Armação, Lente, Acessório
    price DECIMAL(10,2) NOT NULL,
    stock INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. SERVICE ORDERS (O.S.)
CREATE TYPE os_status AS ENUM ('Open', 'In_Laboratory', 'Ready', 'Delivered', 'Cancelled');

CREATE TABLE service_orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    status os_status DEFAULT 'Open',
    total_value DECIMAL(10,2),
    scheduled_date DATE,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. FINANCIAL RECORDS
CREATE TYPE financial_type AS ENUM ('Income', 'Expense');
CREATE TYPE financial_status AS ENUM ('Pending', 'Paid');

CREATE TABLE financial_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
    type financial_type NOT NULL,
    description TEXT NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    due_date DATE NOT NULL,
    payment_date DATE,
    status financial_status DEFAULT 'Pending',
    order_id UUID REFERENCES service_orders(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================
-- ROW LEVEL SECURITY (RLS)
-- ==========================================

-- Enable RLS on all tables
ALTER TABLE shops ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE prescriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE financial_records ENABLE ROW LEVEL SECURITY;

-- Helper function to get current user's shop_id
CREATE OR REPLACE FUNCTION get_my_shop_id() 
RETURNS UUID AS $$
    SELECT shop_id FROM profiles WHERE id = auth.uid();
$$ LANGUAGE sql STABLE;

-- Policies for shops
CREATE POLICY "Users can view their own shop" ON shops
    FOR SELECT USING (id = get_my_shop_id());

-- Policies for profiles
CREATE POLICY "Users can view their own profile" ON profiles
    FOR SELECT USING (id = auth.uid());

CREATE POLICY "Users can update their own profile" ON profiles
    FOR UPDATE USING (id = auth.uid());

-- General Policy for all other tables: Multi-tenancy check
CREATE POLICY "Customers access by shop" ON customers
    FOR ALL USING (shop_id = get_my_shop_id());

CREATE POLICY "Prescriptions access by shop" ON prescriptions
    FOR ALL USING (shop_id = get_my_shop_id());

CREATE POLICY "Products access by shop" ON products
    FOR ALL USING (shop_id = get_my_shop_id());

CREATE POLICY "Service Orders access by shop" ON service_orders
    FOR ALL USING (shop_id = get_my_shop_id());

CREATE POLICY "Financial Records access by shop" ON financial_records
    FOR ALL USING (shop_id = get_my_shop_id());
