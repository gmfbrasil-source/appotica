-- 0. Adicionar coluna customer_id em financial_records (se não existir)
ALTER TABLE financial_records 
ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES customers(id) ON DELETE SET NULL;

-- Adicionar coluna os_number para numeração manual de O.S.
ALTER TABLE service_orders
ADD COLUMN IF NOT EXISTS os_number TEXT;

-- 1. CASCADE delete: ao excluir O.S., financeiro vinculado é excluído
ALTER TABLE financial_records 
DROP CONSTRAINT IF EXISTS financial_records_order_id_fkey,
ADD CONSTRAINT financial_records_order_id_fkey 
  FOREIGN KEY (order_id) 
  REFERENCES service_orders(id) 
  ON DELETE CASCADE;


-- 2. Tabela de fechamento de caixa
CREATE TABLE IF NOT EXISTS cash_closing (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
    closing_date DATE NOT NULL,
    total_income DECIMAL(10,2) NOT NULL DEFAULT 0,
    total_expense DECIMAL(10,2) NOT NULL DEFAULT 0,
    balance DECIMAL(10,2) NOT NULL DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE cash_closing ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Cash closing access by shop" ON cash_closing
    FOR ALL USING (shop_id = get_my_shop_id());

-- 3. Tabela de métodos de pagamento configuráveis
CREATE TABLE IF NOT EXISTS payment_methods (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    fee_percent DECIMAL(5,2) NOT NULL DEFAULT 0,
    max_installments INTEGER NOT NULL DEFAULT 1,
    is_card BOOLEAN NOT NULL DEFAULT false,
    active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE payment_methods ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Payment methods access by shop" ON payment_methods
    FOR ALL USING (shop_id = get_my_shop_id());

-- Seed: métodos padrão para cada loja existente
INSERT INTO payment_methods (shop_id, name, fee_percent, max_installments, is_card, active)
SELECT id, 'Pix', 0, 1, false, true FROM shops
WHERE NOT EXISTS (SELECT 1 FROM payment_methods WHERE payment_methods.shop_id = shops.id);

INSERT INTO payment_methods (shop_id, name, fee_percent, max_installments, is_card, active)
SELECT id, 'Dinheiro', 0, 1, false, true FROM shops
WHERE NOT EXISTS (SELECT 1 FROM payment_methods WHERE payment_methods.shop_id = shops.id AND name = 'Dinheiro');

INSERT INTO payment_methods (shop_id, name, fee_percent, max_installments, is_card, active)
SELECT id, 'Cartão de Débito', 1.99, 1, true, true FROM shops
WHERE NOT EXISTS (SELECT 1 FROM payment_methods WHERE payment_methods.shop_id = shops.id AND name = 'Cartão de Débito');

INSERT INTO payment_methods (shop_id, name, fee_percent, max_installments, is_card, active)
SELECT id, 'Cartão de Crédito', 3.99, 12, true, true FROM shops
WHERE NOT EXISTS (SELECT 1 FROM payment_methods WHERE payment_methods.shop_id = shops.id AND name = 'Cartão de Crédito');

INSERT INTO payment_methods (shop_id, name, fee_percent, max_installments, is_card, active)
SELECT id, 'Boleto Bancário', 0, 1, false, true FROM shops
WHERE NOT EXISTS (SELECT 1 FROM payment_methods WHERE payment_methods.shop_id = shops.id AND name = 'Boleto Bancário');

INSERT INTO payment_methods (shop_id, name, fee_percent, max_installments, is_card, active)
SELECT id, 'Carnê', 0, 12, false, true FROM shops
WHERE NOT EXISTS (SELECT 1 FROM payment_methods WHERE payment_methods.shop_id = shops.id AND name = 'Carnê');
