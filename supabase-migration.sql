-- 0. Adicionar coluna customer_id em financial_records (se não existir)
ALTER TABLE financial_records 
ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES customers(id) ON DELETE SET NULL;

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
