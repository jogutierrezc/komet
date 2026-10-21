// Umbral mínimo aceptable del instrumento (escala 1,0 a 5,0). Un solo valor para Estadística, Informe y Presenta.
// Estadística e Informe ya usaban 3,7 (lectura MEN 00273); Presenta decía 3,5 en su prompt y en el texto del deck.
export const UMBRAL_ACEPTABLE = 3.7;

export const fmtScore = (n) => Number(n || 0).toFixed(2).replace('.', ',');
export const fmtUmbral = () => String(UMBRAL_ACEPTABLE).replace('.', ',');
