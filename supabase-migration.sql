-- Migration: Add ON DELETE CASCADE to financial_records.order_id
-- This ensures deleting a service_order also deletes its linked financial records

ALTER TABLE financial_records 
DROP CONSTRAINT IF EXISTS financial_records_order_id_fkey,
ADD CONSTRAINT financial_records_order_id_fkey 
  FOREIGN KEY (order_id) 
  REFERENCES service_orders(id) 
  ON DELETE CASCADE;
