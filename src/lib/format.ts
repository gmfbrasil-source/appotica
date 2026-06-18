export function formatCurrency(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export const companyInfo = {
  cnpj: '14.952.751/0001-12',
  razaoSocial: 'V. A. Miranda',
  nomeFantasia: 'Estyllus Ótica',
  endereco: {
    rua: 'Rua L - Conjunto Feira X, 36',
    bairro: 'Muchila',
    cidade: 'Feira de Santana',
    estado: 'BA',
    cep: '44006-000'
  },
  enderecoCompleto: 'Rua L - Conjunto Feira X, 36, Muchila, Feira de Santana - BA, 44006-000'
};
