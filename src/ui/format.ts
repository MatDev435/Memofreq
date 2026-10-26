const decimal = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export const formatNumber = (value: number): string => decimal.format(value);
export const formatHz = (value: number): string =>
  `${decimal.format(value)} Hz`;
