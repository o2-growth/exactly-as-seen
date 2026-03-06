import { Year, YEARS } from './financialData';

export interface PnlNode {
  code: string;
  label: string;
  annual: Record<Year, number>; // R$ thousands
  monthly?: Record<Year, number[]>; // 12 monthly values per year, R$ thousands
  isSummary?: boolean;
  isMargin?: boolean;
  children?: PnlNode[];
}

// Monthly data for 2025 per revenue sub-BU (R$ thousands, derived from Excel)
export const MONTHLY_REVENUE_2025: Record<string, number[]> = {
  'CaaS Assessoria':  [0, 0, 0, 13, 18, 26, 36, 48, 62, 78, 96, 116],
  'CaaS Enterprise':  [558, 632, 336, 417, 459, 505, 555, 611, 672, 739, 813, 895],
  'CaaS Corporate':   [0, 0, 67, 83, 92, 101, 111, 122, 134, 148, 163, 179],
  'CaaS Setup':       [0, 0, 45, 240, 120, 150, 165, 195, 210, 240, 270, 300],
  'SaaS Oxy':         [0, 0, 0, 61, 70, 78, 87, 95, 104, 113, 121, 130],
  'SaaS Oxy+Gênio':   [0, 0, 0, 32, 48, 67, 89, 115, 143, 176, 212, 251],
  'Education Dono CFO':[0, 0, 0, 9, 10, 11, 12, 13, 15, 16, 18, 20],
  'BaaS Assinatura':  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
};

export const MONTHLY_TOTALS_2025: Record<string, number[]> = {
  grossRevenue:      [558, 632, 449, 856, 921, 1043, 1161, 1305, 1446, 1615, 1797, 1995],
  salesDeductions:   [-54, -61, -43, -83, -89, -101, -112, -126, -139, -156, -173, -193],
  netRevenue:        [504, 571, 405, 774, 833, 943, 1049, 1179, 1306, 1459, 1624, 1802],
  cogs:              [-115, -112, -86, -148, -167, -202, -242, -271, -301, -333, -362, -428],
  grossProfit:       [389, 459, 319, 626, 665, 741, 806, 908, 1005, 1126, 1262, 1374],
  commissions:       [0, 0, -13, -26, -28, -31, -35, -39, -43, -48, -54, -60],
  marketing:         [-67, -59, -812, -279, -328, -372, -420, -470, -523, -580, -640, -608],
  contributionMargin:[322, 400, -507, 321, 310, 337, 352, 399, 439, 497, 568, 707],
  adminExpenses:     [-66, -68, -64, -76, -79, -83, -88, -92, -96, -101, -106, -116],
  headcount:         [-120, -119, -121, -124, -126, -127, -129, -130, -131, -133, -134, -136],
  commercial:        [-15, -21, -21, -17, -17, -17, -17, -17, -17, -17, -17, -17],
  other:             [-2, -2, -2, -1, -1, -1, -1, -1, 0, 0, 0, 0],
  ebitda:            [119, 190, -715, 103, 87, 109, 118, 159, 195, 246, 311, 438],
};

// Full P&L hierarchy with annual data (R$ thousands)
export const PNL_TREE: PnlNode[] = [
  {
    code: '1', label: 'Receita Bruta de Vendas', 
    annual: { 2025: 13777, 2026: 34250, 2027: 103707, 2028: 337072, 2029: 785967, 2030: 1460172 },
    children: [
      {
        code: '1.1', label: 'CaaS', 
        annual: { 2025: 10822, 2026: 20803, 2027: 53703, 2028: 149777, 2029: 307998, 2030: 498643 },
        children: [
          { code: '1.1.1', label: 'Assessoria', annual: { 2025: 493, 2026: 1871, 2027: 4517, 2028: 12605, 2029: 27052, 2030: 45257 } },
          { code: '1.1.2', label: 'Enterprise', annual: { 2025: 7193, 2026: 14427, 2027: 34838, 2028: 97210, 2029: 208621, 2030: 349020 } },
          { code: '1.1.3', label: 'Corporate', annual: { 2025: 1201, 2026: 2885, 2027: 6968, 2028: 19442, 2029: 41725, 2030: 69805 } },
          { code: '1.1.4', label: 'Setup', annual: { 2025: 1935, 2026: 1620, 2027: 7380, 2028: 20520, 2029: 30600, 2030: 34560 } },
        ],
      },
      {
        code: '1.2', label: 'SaaS',
        annual: { 2025: 2831, 2026: 12966, 2027: 45487, 2028: 161044, 2029: 389680, 2030: 745825 },
        children: [
          { code: '1.2.1', label: 'Oxy', annual: { 2025: 859, 2026: 4501, 2027: 14574, 2028: 52281, 2029: 127281, 2030: 244571 } },
          { code: '1.2.2', label: 'Oxy + Gênio', annual: { 2025: 1132, 2026: 4466, 2027: 12914, 2028: 43764, 2029: 97399, 2030: 188254 } },
          { code: '1.2.4', label: 'Setup', annual: { 2025: 840, 2026: 4000, 2027: 17460, 2028: 64980, 2029: 141660, 2030: 242100 } },
        ],
      },
      {
        code: '1.3', label: 'Education',
        annual: { 2025: 124, 2026: 480, 2027: 1877, 2028: 7445, 2029: 18838, 2030: 36080 },
        children: [
          { code: '1.3.3', label: 'Dono CFO', annual: { 2025: 124, 2026: 480, 2027: 1877, 2028: 7445, 2029: 18838, 2030: 36080 } },
        ],
      },
      {
        code: '1.4', label: 'BaaS',
        annual: { 2025: 0, 2026: 0, 2027: 2640, 2028: 18806, 2029: 69451, 2030: 179624 },
        children: [
          { code: '1.4.1', label: 'Assinatura', annual: { 2025: 0, 2026: 0, 2027: 2640, 2028: 18806, 2029: 69451, 2030: 179624 } },
        ],
      },
    ],
  },
  {
    code: '2', label: 'Dedução de Vendas',
    annual: { 2025: -1329, 2026: -3305, 2027: -15815, 2028: -51404, 2029: -119860, 2030: -222676 },
  },
  {
    code: 'NR', label: '(=) Receita Líquida', isSummary: true,
    annual: { 2025: 12447, 2026: 30945, 2027: 87892, 2028: 285669, 2029: 666107, 2030: 1237496 },
  },
  {
    code: '3', label: 'Custo dos Serviços Prestados (COGS)',
    annual: { 2025: -2768, 2026: -7302, 2027: -19616, 2028: -55978, 2029: -125889, 2030: -226791 },
    children: [
      { code: '3.1.1', label: 'CaaS', annual: { 2025: -2158, 2026: -5624, 2027: -14490, 2028: -41046, 2029: -89980, 2030: -157994 } },
      { code: '3.1.2', label: 'Customer Service', annual: { 2025: -171, 2026: -596, 2027: -1960, 2028: -5536, 2029: -13148, 2030: -28320 } },
      { code: '3.1.3', label: 'SaaS (Tech)', annual: { 2025: -440, 2026: -1082, 2027: -1026, 2028: -1396, 2029: -1761, 2030: -2640 } },
      { code: '3.1.5', label: 'BaaS', annual: { 2025: 0, 2026: 0, 2027: -2140, 2028: -8001, 2029: -15001, 2030: -37837 } },
    ],
  },
  {
    code: 'GP', label: '(=) Lucro Bruto', isSummary: true,
    annual: { 2025: 9679, 2026: 23643, 2027: 68276, 2028: 229690, 2029: 540218, 2030: 1010705 },
  },
  {
    code: 'GM%', label: '% Margem Bruta', isMargin: true,
    annual: { 2025: 77.8, 2026: 76.4, 2027: 77.7, 2028: 80.4, 2029: 81.1, 2030: 81.7 },
  },
  {
    code: '3.1', label: 'Comissões sobre Vendas',
    annual: { 2025: -378, 2026: -1027, 2027: -3111, 2028: -10112, 2029: -23579, 2030: -43805 },
  },
  {
    code: '7', label: 'Despesas de Marketing',
    annual: { 2025: -5158, 2026: -11603, 2027: -51760, 2028: -184959, 2029: -440306, 2030: -785098 },
    children: [
      { code: '7.01', label: 'CaaS', annual: { 2025: -2111, 2026: -3509, 2027: -9138, 2028: -22098, 2029: -43247, 2030: -77400 } },
      { code: '7.02', label: 'SaaS', annual: { 2025: -2814, 2026: -7390, 2027: -29087, 2028: -105358, 2029: -265804, 2030: -493084 } },
      { code: '7.03', label: 'Education', annual: { 2025: -116, 2026: -215, 2027: -1139, 2028: -4817, 2029: -8527, 2030: -13887 } },
      { code: '7.04', label: 'BaaS', annual: { 2025: 0, 2026: 0, 2027: -5181, 2028: -30078, 2029: -84086, 2030: -201966 } },
    ],
  },
  {
    code: 'CM', label: '(=) Margem de Contribuição', isSummary: true,
    annual: { 2025: 4144, 2026: 11012, 2027: 13405, 2028: 34619, 2029: 76332, 2030: 181802 },
  },
  {
    code: 'CM%', label: '% Margem de Contribuição', isMargin: true,
    annual: { 2025: 33.3, 2026: 35.6, 2027: 15.3, 2028: 12.1, 2029: 11.5, 2030: 14.7 },
  },
  {
    code: '4', label: 'Despesas Administrativas (SG&A)',
    annual: { 2025: -1036, 2026: -1745, 2027: -3820, 2028: -10526, 2029: -23551, 2030: -43183 },
    children: [
      { code: '4.01', label: 'Água e Esgoto', annual: { 2025: 0, 2026: 0, 2027: 0, 2028: 0, 2029: 0, 2030: 0 } },
      { code: '4.02', label: 'Energia Elétrica', annual: { 2025: -15, 2026: -18, 2027: -20, 2028: -22, 2029: -24, 2030: -26 } },
      { code: '4.03', label: 'Internet/Telefone', annual: { 2025: -5, 2026: -6, 2027: -6, 2028: -7, 2029: -8, 2030: -8 } },
      { code: '4.04', label: 'Aluguel', annual: { 2025: -73, 2026: -82, 2027: -91, 2028: -100, 2029: -110, 2030: -121 } },
      { code: '4.05', label: 'Condomínio', annual: { 2025: -33, 2026: -37, 2027: -40, 2028: -44, 2029: -49, 2030: -54 } },
      { code: '4.06', label: 'IPTU', annual: { 2025: 0, 2026: 0, 2027: 0, 2028: 0, 2029: 0, 2030: 0 } },
      { code: '4.07', label: 'Materiais de Uso e Consumo', annual: { 2025: -18, 2026: -19, 2027: -21, 2028: -23, 2029: -25, 2030: -28 } },
      { code: '4.08', label: 'Serviço de Higiene e Limpeza', annual: { 2025: -24, 2026: -26, 2027: -29, 2028: -32, 2029: -35, 2030: -39 } },
      { code: '4.09', label: 'Manutenções e Reparos', annual: { 2025: 0, 2026: 0, 2027: 0, 2028: 0, 2029: 0, 2030: 0 } },
      { code: '4.10', label: 'Locação de Máquinas e Equip.', annual: { 2025: -106, 2026: -231, 2027: -548, 2028: -1497, 2029: -3330, 2030: -6966 } },
      { code: '4.11', label: 'Assessoria Contábil', annual: { 2025: -29, 2026: -30, 2027: -33, 2028: -36, 2029: -40, 2030: -43 } },
      { code: '4.12', label: 'Assessoria Financeira', annual: { 2025: 0, 2026: 0, 2027: 0, 2028: 0, 2029: 0, 2030: 0 } },
      { code: '4.13', label: 'Assessoria Jurídica', annual: { 2025: -13, 2026: -14, 2027: -16, 2028: -17, 2029: -19, 2030: -21 } },
      { code: '4.14', label: 'Assessoria RH', annual: { 2025: -3, 2026: -4, 2027: -4, 2028: -4, 2029: -4, 2030: -4 } },
      { code: '4.15', label: 'Seguros', annual: { 2025: -2, 2026: 0, 2027: 0, 2028: 0, 2029: 0, 2030: 0 } },
      { code: '4.16', label: 'Taxas e Emolumentos', annual: { 2025: 0, 2026: 0, 2027: 0, 2028: 0, 2029: 0, 2030: 0 } },
      { code: '4.17', label: 'Custas Judiciais', annual: { 2025: 0, 2026: 0, 2027: 0, 2028: 0, 2029: 0, 2030: 0 } },
      { code: '4.18', label: 'Eventos Internos', annual: { 2025: -23, 2026: -51, 2027: -121, 2028: -339, 2029: -737, 2030: -1488 } },
      { code: '4.19', label: 'Retenções IRRF Terceiros', annual: { 2025: 0, 2026: 0, 2027: 0, 2028: 0, 2029: 0, 2030: 0 } },
      { code: '4.20', label: 'Retenções PIS/COFINS/CSLL', annual: { 2025: 0, 2026: 0, 2027: 0, 2028: 0, 2029: 0, 2030: 0 } },
      { code: '4.21', label: 'Assessoria T.I.', annual: { 2025: 0, 2026: 0, 2027: 0, 2028: 0, 2029: 0, 2030: 0 } },
      { code: '4.22', label: 'Alimentação Administrativo', annual: { 2025: -255, 2026: -281, 2027: -309, 2028: -340, 2029: -374, 2030: -411 } },
      { code: '4.23', label: 'Deslocamento Administrativo', annual: { 2025: 0, 2026: 0, 2027: 0, 2028: 0, 2029: 0, 2030: 0 } },
      { code: '4.24', label: 'Hospedagem Administrativo', annual: { 2025: 0, 2026: 0, 2027: 0, 2028: 0, 2029: 0, 2030: 0 } },
      { code: '4.25', label: 'Softwares e Ferramentas', annual: { 2025: -172, 2026: -262, 2027: -548, 2028: -1418, 2029: -3108, 2030: -5874 } },
      { code: '4.26', label: 'Provisão para Devedores Duvidosos', annual: { 2025: -276, 2026: -685, 2027: -2074, 2028: -6742, 2029: -15719, 2030: -29215 } },
    ],
  },
  {
    code: '5', label: 'Despesas com Pessoal',
    annual: { 2025: -1528, 2026: -1909, 2027: -2736, 2028: -5218, 2029: -10632, 2030: -19914 },
    children: [
      { code: '5.01', label: 'Remuneração Equipe Interna', annual: { 2025: -1363, 2026: -1500, 2027: -1650, 2028: -1814, 2029: -1996, 2030: -2195 } },
      { code: '5.02', label: 'Salários', annual: { 2025: 0, 2026: 0, 2027: 0, 2028: 0, 2029: 0, 2030: 0 } },
      { code: '5.03', label: 'Benefícios', annual: { 2025: -165, 2026: -409, 2027: -1086, 2028: -3404, 2029: -8636, 2030: -17719 } },
      { code: '5.04', label: 'FGTS', annual: { 2025: 0, 2026: 0, 2027: 0, 2028: 0, 2029: 0, 2030: 0 } },
      { code: '5.05', label: 'INSS', annual: { 2025: 0, 2026: 0, 2027: 0, 2028: 0, 2029: 0, 2030: 0 } },
      { code: '5.06', label: 'Rescisões/Estagiários', annual: { 2025: 0, 2026: 0, 2027: 0, 2028: 0, 2029: 0, 2030: 0 } },
      { code: '5.07', label: 'Pró-labore Sócios', annual: { 2025: 0, 2026: 0, 2027: 0, 2028: 0, 2029: 0, 2030: 0 } },
      { code: '5.08', label: 'Distribuição de Lucros', annual: { 2025: 0, 2026: 0, 2027: 0, 2028: 0, 2029: 0, 2030: 0 } },
      { code: '5.09', label: 'Cursos e Treinamentos', annual: { 2025: 0, 2026: 0, 2027: 0, 2028: 0, 2029: 0, 2030: 0 } },
      { code: '5.10', label: 'Menor Aprendiz', annual: { 2025: 0, 2026: 0, 2027: 0, 2028: 0, 2029: 0, 2030: 0 } },
      { code: '5.11', label: 'Produtos O2 - Endomarketing', annual: { 2025: 0, 2026: 0, 2027: 0, 2028: 0, 2029: 0, 2030: 0 } },
    ],
  },
  {
    code: '6', label: 'Despesas Comerciais',
    annual: { 2025: -207, 2026: -222, 2027: -244, 2028: -268, 2029: -295, 2030: -324 },
    children: [
      { code: '6.01', label: 'Eventos Comerciais', annual: { 2025: 0, 2026: 0, 2027: 0, 2028: 0, 2029: 0, 2030: 0 } },
      { code: '6.03', label: 'Softwares e Ferramentas Comercial', annual: { 2025: -23, 2026: -19, 2027: -21, 2028: -23, 2029: -26, 2030: -28 } },
      { code: '6.04', label: 'Alimentação Comercial', annual: { 2025: -3, 2026: 0, 2027: 0, 2028: 0, 2029: 0, 2030: 0 } },
      { code: '6.05', label: 'Deslocamento Comercial', annual: { 2025: -16, 2026: -17, 2027: -19, 2028: -21, 2029: -23, 2030: -25 } },
      { code: '6.06', label: 'Hospedagem Comercial', annual: { 2025: -30, 2026: -35, 2027: -38, 2028: -42, 2029: -46, 2030: -51 } },
      { code: '6.07', label: 'Comissionamentos e Premiações', annual: { 2025: 0, 2026: 0, 2027: 0, 2028: 0, 2029: 0, 2030: 0 } },
      { code: '6.08', label: 'Assessoria Comercial', annual: { 2025: -136, 2026: -150, 2027: -165, 2028: -182, 2029: -200, 2030: -220 } },
      { code: '6.09', label: 'Comissão de Parceiros', annual: { 2025: 0, 2026: 0, 2027: 0, 2028: 0, 2029: 0, 2030: 0 } },
    ],
  },
  {
    code: '10', label: 'Outras Despesas',
    annual: { 2025: -13, 2026: 0, 2027: 0, 2028: 0, 2029: 0, 2030: 0 },
  },
  {
    code: '9', label: 'Depreciação & Amortização',
    annual: { 2025: 0, 2026: 0, 2027: 0, 2028: 0, 2029: 0, 2030: 0 },
  },
  {
    code: 'EBITDA', label: '(=) EBITDA', isSummary: true,
    annual: { 2025: 1360, 2026: 7136, 2027: 6605, 2028: 18606, 2029: 41855, 2030: 118380 },
  },
  {
    code: 'EBITDA%', label: '% EBITDA', isMargin: true,
    annual: { 2025: 10.9, 2026: 23.1, 2027: 7.5, 2028: 6.5, 2029: 6.3, 2030: 9.6 },
  },
  {
    code: '8', label: 'Resultado Financeiro',
    annual: { 2025: -35, 2026: -1, 2027: -4, 2028: -18, 2029: -56, 2030: -129 },
    children: [
      { code: '8.01', label: 'Juros Cheque Especial', annual: { 2025: -25, 2026: 0, 2027: 0, 2028: 0, 2029: 0, 2030: 0 } },
      { code: '8.02', label: 'Tarifas e Taxas Bancárias', annual: { 2025: 0, 2026: 0, 2027: 0, 2028: 0, 2029: 0, 2030: 0 } },
      { code: '8.03', label: 'IOF', annual: { 2025: -1, 2026: 0, 2027: 0, 2028: 0, 2029: 0, 2030: 0 } },
      { code: '8.04', label: 'Juros sobre Empréstimos', annual: { 2025: -2, 2026: 0, 2027: 0, 2028: 0, 2029: 0, 2030: 0 } },
      { code: '8.05', label: 'Tarifa de Boletos', annual: { 2025: -7, 2026: -1, 2027: -4, 2028: -18, 2029: -56, 2030: -129 } },
      { code: '8.06', label: 'Tarifa de PIX', annual: { 2025: 0, 2026: 0, 2027: 0, 2028: 0, 2029: 0, 2030: 0 } },
      { code: '8.07', label: 'Tarifa de Adquirência', annual: { 2025: 0, 2026: 0, 2027: 0, 2028: 0, 2029: 0, 2030: 0 } },
      { code: '8.08', label: 'Juros Antecipação de Recebíveis', annual: { 2025: 0, 2026: 0, 2027: 0, 2028: 0, 2029: 0, 2030: 0 } },
      { code: '8.09', label: 'Receita Financeira (Aplicações)', annual: { 2025: 0, 2026: 0, 2027: 0, 2028: 0, 2029: 0, 2030: 0 } },
      { code: '8.10', label: 'Multa e Juros por Atraso', annual: { 2025: 0, 2026: 0, 2027: 0, 2028: 0, 2029: 0, 2030: 0 } },
    ],
  },
  {
    code: 'EBT', label: '(=) Lucro antes do IR e CS', isSummary: true,
    annual: { 2025: 1325, 2026: 7135, 2027: 6601, 2028: 18588, 2029: 41799, 2030: 118251 },
  },
  {
    code: 'TAX', label: 'Impostos (IRPJ + CSLL)',
    annual: { 2025: -1499, 2026: -3726, 2027: -2244, 2028: -6320, 2029: -14210, 2030: -40205 },
    children: [
      { code: '10.01', label: 'IRPJ', annual: { 2025: -1102, 2026: -2740, 2027: -1650, 2028: -4647, 2029: -10450, 2030: -29563 } },
      { code: '10.02', label: 'CSLL', annual: { 2025: -397, 2026: -986, 2027: -594, 2028: -1673, 2029: -3760, 2030: -10642 } },
    ],
  },
  {
    code: 'NI', label: '(=) Lucro Líquido', isSummary: true,
    annual: { 2025: -174, 2026: 3409, 2027: 4357, 2028: 12268, 2029: 27589, 2030: 78046 },
  },
  {
    code: 'NM%', label: '% Margem Líquida', isMargin: true,
    annual: { 2025: -1.4, 2026: 11.0, 2027: 5.0, 2028: 4.3, 2029: 4.1, 2030: 6.3 },
  },
  {
    code: '11', label: 'Pagamento de Dívidas',
    annual: { 2025: -141, 2026: -110, 2027: -70, 2028: -39, 2029: -20, 2030: -10 },
    children: [
      { code: '11.01', label: 'Empréstimos e Financiamentos', annual: { 2025: -113, 2026: -85, 2027: -66, 2028: -39, 2029: -20, 2030: -10 } },
      { code: '11.02', label: 'Tributos Parcelados', annual: { 2025: 0, 2026: 0, 2027: 0, 2028: 0, 2029: 0, 2030: 0 } },
      { code: '11.03', label: 'Dívida com Fornecedores', annual: { 2025: -29, 2026: -25, 2027: -4, 2028: 0, 2029: 0, 2030: 0 } },
      { code: '11.04', label: 'Compra de Cotas', annual: { 2025: 0, 2026: 0, 2027: 0, 2028: 0, 2029: 0, 2030: 0 } },
    ],
  },
  {
    code: '12', label: 'Capex',
    annual: { 2025: -414, 2026: -1083, 2027: -1408, 2028: -3056, 2029: -5673, 2030: -9300 },
    children: [
      { code: '12.01', label: 'Máquinas e Equipamentos', annual: { 2025: 0, 2026: 0, 2027: 0, 2028: 0, 2029: 0, 2030: 0 } },
      { code: '12.02', label: 'Móveis e Utensílios', annual: { 2025: 0, 2026: 0, 2027: 0, 2028: 0, 2029: 0, 2030: 0 } },
      { code: '12.03', label: 'Software e Tecnologia', annual: { 2025: -412, 2026: -1083, 2027: -1408, 2028: -3056, 2029: -5673, 2030: -9300 } },
      { code: '12.04', label: 'Imóveis', annual: { 2025: -2, 2026: 0, 2027: 0, 2028: 0, 2029: 0, 2030: 0 } },
      { code: '12.05', label: 'Veículos', annual: { 2025: 0, 2026: 0, 2027: 0, 2028: 0, 2029: 0, 2030: 0 } },
      { code: '12.06', label: 'Reserva de Caixa', annual: { 2025: 0, 2026: 0, 2027: 0, 2028: 0, 2029: 0, 2030: 0 } },
    ],
  },
  {
    code: 'FCR', label: '(=) Resultado Final de Caixa', isSummary: true,
    annual: { 2025: -730, 2026: 2216, 2027: 2878, 2028: 9173, 2029: 21896, 2030: 68736 },
  },
];
