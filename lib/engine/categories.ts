import type { AgeCategory } from '../types/domain';

/**
 * Helper to determine senior eligibility.
 * Eligible categories for the senior draw are:
 * - 'plus14' (regular senior)
 * - 'sub14_promoted' (Sub-14 finalists promoted to senior)
 */
export function isSeniorEligible(category: AgeCategory | string | null | undefined): boolean {
  return category === 'plus14' || category === 'sub14_promoted';
}

/**
 * Determine official age category:
 * - 'sub14' (Junior): Players 14 years old or younger (<= 14)
 * - 'plus14' (Senior / Absoluta): Players older than 14 (> 14)
 */
/**
 * Determine official age category:
 * - 'sub14' (Junior): Players 14 years old or younger (<= 14) at tournament cutoff date
 * - 'plus14' (Senior / Absoluta): Players older than 14 (> 14) at tournament cutoff date
 * 
 * @param birthDateOrAge Birth date string, Date, or numeric age
 * @param referenceDate Tournament start date or cutoff date (defaults to Dec 31 of tournament year or today)
 */
export function determineAgeCategory(
  birthDateOrAge: string | number | Date,
  referenceDate?: string | number | Date
): AgeCategory {
  if (typeof birthDateOrAge === 'number') {
    return birthDateOrAge <= 14 ? 'sub14' : 'plus14';
  }

  if (typeof birthDateOrAge === 'string') {
    const num = Number(birthDateOrAge);
    if (
      !isNaN(num) &&
      num > 0 &&
      num < 120 &&
      !birthDateOrAge.includes('-') &&
      !birthDateOrAge.includes('/')
    ) {
      return num <= 14 ? 'sub14' : 'plus14';
    }
  }

  const birth = new Date(birthDateOrAge);
  if (isNaN(birth.getTime())) {
    throw new Error('Fecha de nacimiento o edad inválida');
  }

  const ref = referenceDate ? new Date(referenceDate) : new Date();
  const cutoff = isNaN(ref.getTime()) ? new Date() : ref;

  let age = cutoff.getFullYear() - birth.getFullYear();
  const m = cutoff.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && cutoff.getDate() < birth.getDate())) {
    age--;
  }

  return age <= 14 ? 'sub14' : 'plus14';
}

export function getCategoryLabel(category: AgeCategory): string {
  switch (category) {
    case 'sub14':
      return 'Sub-14 (Junior)';
    case 'plus14':
      return 'Absoluta (+14 / Senior)';
    case 'sub14_promoted':
      return 'Sub-14 Promocionado (+14)';
    default:
      return 'General';
  }
}
