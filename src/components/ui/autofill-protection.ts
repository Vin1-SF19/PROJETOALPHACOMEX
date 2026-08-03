/**
 * Hints understood by the most common password managers.
 * `autoComplete` remains field-specific and must be declared separately.
 */
export const AUTOFILL_PROTECTION_ATTRS = {
  'data-1p-ignore': 'true',
  'data-lpignore': 'true',
  'data-bwignore': 'true',
  'data-form-type': 'other',
} as const;
