-- Correção:_profiles já existe por trigger do Supabase, usar UPSERT
CREATE OR REPLACE FUNCTION public.create_user_with_shop(
    user_id UUID,
    full_name TEXT,
    shop_name TEXT
)
RETURNS JSON AS $$
DECLARE
    new_shop shops%ROWTYPE;
    new_profile profiles%ROWTYPE;
BEGIN
    INSERT INTO shops (name) VALUES (shop_name) RETURNING * INTO new_shop;

    INSERT INTO profiles (id, shop_id, full_name, role)
    VALUES (user_id, new_shop.id, full_name, 'admin')
    ON CONFLICT (id) DO UPDATE SET
        shop_id = EXCLUDED.shop_id,
        full_name = EXCLUDED.full_name,
        role = EXCLUDED.role
    RETURNING * INTO new_profile;

    INSERT INTO payment_methods (shop_id, name, fee_percent, max_installments, is_card, active, fee_by_installment)
    VALUES
        (new_shop.id, 'Pix', 0, 1, false, true, NULL),
        (new_shop.id, 'Dinheiro', 0, 1, false, true, NULL),
        (new_shop.id, 'Cartão de Débito', 1.99, 1, true, true, '{"1":1.99}'),
        (new_shop.id, 'Cartão de Crédito', 3.99, 12, true, true,
            '{"1":2.99,"2":3.49,"3":3.99,"4":4.49,"5":4.99,"6":5.49,"7":5.99,"8":6.49,"9":6.99,"10":7.49,"11":7.99,"12":8.49}'),
        (new_shop.id, 'Boleto Bancário', 0, 1, false, true, NULL),
        (new_shop.id, 'Carnê', 0, 12, false, true, NULL);

    RETURN json_build_object(
        'shop', row_to_json(new_shop),
        'profile', row_to_json(new_profile)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
