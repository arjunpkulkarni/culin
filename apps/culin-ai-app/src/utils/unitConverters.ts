// Height conversions
export function cmToFeetInches(cm: number): { feet: number; inches: number } {
  const totalInches = cm / 2.54;
  const feet = Math.floor(totalInches / 12);
  const inches = Math.round(totalInches % 12);
  return { feet, inches };
}

export function feetInchesToCm(feet: number, inches: number): number {
  const totalInches = feet * 12 + inches;
  return Math.round(totalInches * 2.54);
}

export function formatFeetInches(feet: number, inches: number): string {
  return `${feet}'${inches}"`;
}

// Weight conversions
export function kgToPounds(kg: number): number {
  return Math.round(kg * 2.20462);
}

export function poundsToKg(pounds: number): number {
  return Math.round(pounds / 2.20462);
}

