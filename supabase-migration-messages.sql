-- Tabela de templates de mensagens por estágio da O.S.
CREATE TABLE IF NOT EXISTS message_templates (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
    stage TEXT NOT NULL CHECK (stage IN ('created', 'preparing', 'ready', 'delivered', 'overdue')),
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(shop_id, stage)
);

-- RLS
ALTER TABLE message_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own templates" ON message_templates
    FOR SELECT TO authenticated
    USING (shop_id = (SELECT shop_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can insert own templates" ON message_templates
    FOR INSERT TO authenticated
    WITH CHECK (shop_id = (SELECT shop_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can update own templates" ON message_templates
    FOR UPDATE TO authenticated
    USING (shop_id = (SELECT shop_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can delete own templates" ON message_templates
    FOR DELETE TO authenticated
    USING (shop_id = (SELECT shop_id FROM profiles WHERE id = auth.uid()));

-- Função para criar templates padrão (pega shop_id do perfil do usuário)
CREATE OR REPLACE FUNCTION public.create_default_message_templates()
RETURNS VOID AS $$
DECLARE
    user_shop UUID;
BEGIN
    SELECT shop_id INTO user_shop FROM profiles WHERE id = auth.uid();
    IF user_shop IS NULL THEN RETURN; END IF;

    INSERT INTO message_templates (shop_id, stage, title, message, active)
    SELECT user_shop, v.stage, v.title, v.message, true
    FROM (VALUES
        ('created', 'OS Criada',
         'Olá {cliente}! Sua OS {numero} foi criada com sucesso na {loja}. Valor: {valor}. Prazo estimado: {prazo}. Qualquer dúvida, entre em contato!'),
        ('preparing', 'Em Preparo',
         'Olá {cliente}! Sua OS {numero} está em preparo na {loja}. Prazo estimado: {prazo}. Agradecemos a paciência!'),
        ('ready', 'Pronto para Retirada',
         'Olá {cliente}! Seu pedido da OS {numero} está pronto para retirada na {loja}! Venha quando quiser. Horário: 09h às 18h.'),
        ('delivered', 'Entregue',
         'Olá {cliente}! Sua OS {numero} foi entregue. Obrigado pela confiança na {loja}! Estamos à disposição para o que precisar.'),
        ('overdue', 'Em Atraso',
         'Olá {cliente}! Sua OS {numero} está com prazo ultrapassado na {loja}. Por favor, entre em contato para regularização.')
    ) AS v(stage, title, message)
    WHERE NOT EXISTS (SELECT 1 FROM message_templates WHERE shop_id = user_shop);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
