import type { AgeCategory } from '../types/domain';

/**
 * Determine official age category:
 * - 'sub14' (Junior): Players 14 years old or younger (<= 14)
 * - 'plus14' (Senior / Absoluta): Players older than 14 (> 14)
 */
export function determineAgeCategory(birthDateOrAge: string | number | Date): AgeCategory {
  if (typeof birthDateOrAge === 'number') {
    return birthDateOrAge <= 14 ? 'sub14' : 'plus14';
  }

  const birth = new Date(birthDateOrAge);
  if (isNaN(birth.getTime())) {
    // Default fallback to plus14 if invalid date
    return 'plus14';
  }

  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
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
  }
}
