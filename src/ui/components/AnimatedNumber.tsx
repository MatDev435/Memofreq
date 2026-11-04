import { useUiFeedback } from '../feedback/uiFeedbackContext';
import { useCountUp } from '../feedback/useCountUp';
import { formatNumber } from '../format';

/**
 * Conta de 0 até o valor. Durante a animação, o número que muda é só visual
 * (aria-hidden) e o valor final fica disponível à tecnologia assistiva.
 */
export function AnimatedNumber({ value }: { readonly value: number }) {
  const { motion } = useUiFeedback();
  const shown = useCountUp(value, motion);
  if (shown === value) return <>{formatNumber(value)}</>;
  return (
    <>
      <span aria-hidden="true" className="count-up">
        {formatNumber(shown)}
      </span>
      <span className="sr-only">{formatNumber(value)}</span>
    </>
  );
}
