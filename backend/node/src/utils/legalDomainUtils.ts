/**
 * LegalConnect Domain Utilities & Canonical Constants
 * Single source of truth for legal categories, specializations, and validation constraints.
 */

// ── Canonical Enum Values ───────────────────────────────────────────────────

export const VALID_RESOURCE_TYPES = [
  'LegalAid',
  'Court',
  'GovernmentOffice',
  'PoliceStation',
  'Helpline',
  'Notary',
  'LokAdalat',
  'MediationCenter',
  'BarAssociation'
] as const;

export type ValidResourceType = typeof VALID_RESOURCE_TYPES[number];

export const VALID_FEE_TYPES = [
  'FreeLegalAid',
  'ProBono',
  'StatutoryNotary',
  'Subsidized',
  'StandardGovt'
] as const;

export type ValidFeeType = typeof VALID_FEE_TYPES[number];

export const VALID_OPERATING_DAYS = [
  'Mon-Fri',
  'Mon-Sat',
  'AllWeek',
  'WeekendsOnly',
  '24x7Emergency'
] as const;

export type ValidOperatingDays = typeof VALID_OPERATING_DAYS[number];

export const VALID_SUBMITTER_ROLES = [
  'Advocate',
  'CourtOfficial',
  'NGO',
  'Citizen'
] as const;

export type ValidSubmitterRole = typeof VALID_SUBMITTER_ROLES[number];

// ── Type Guard Functions ────────────────────────────────────────────────────

export function isValidResourceType(type: string): type is ValidResourceType {
  return (VALID_RESOURCE_TYPES as readonly string[]).includes(type);
}

export function isValidFeeType(feeType: string): feeType is ValidFeeType {
  return (VALID_FEE_TYPES as readonly string[]).includes(feeType);
}

export function isValidOperatingDays(days: string): days is ValidOperatingDays {
  return (VALID_OPERATING_DAYS as readonly string[]).includes(days);
}

export function isValidSubmitterRole(role: string): role is ValidSubmitterRole {
  return (VALID_SUBMITTER_ROLES as readonly string[]).includes(role);
}

// ── Domain Validation Constraints ───────────────────────────────────────────

export const RESOURCE_VALIDATION_RULES = {
  name: { min: 3, max: 200 },
  type: { max: 30 },
  city: { max: 100 },
  district: { max: 100 },
  state: { max: 60 },
  pincode: { length: 6, regex: /^\d{6}$/ },
  address: { max: 500 },
  website: { max: 200 },
  operatingHours: { max: 100 },
  operatingDays: { max: 30 },
  lunchBreak: { max: 50 },
  feeType: { max: 30 },
  notes: { max: 1000 },
  contactNumber: { max: 50 },
  emailRegex: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  coordinateBounds: {
    minLat: -90,
    maxLat: 90,
    minLng: -180,
    maxLng: 180
  },
  imageUpload: {
    maxSizeBytes: 5 * 1024 * 1024, // 5MB
    allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp']
  }
} as const;

// ── Stop Words for Duplicate Detection ──────────────────────────────────────

/** Stop words that are generic in legal/civic registries and shouldn't trigger broad false duplicates */
export const LEGAL_STOP_WORDS = new Set([
  'police', 'station', 'court', 'district', 'legal', 'aid', 'clinic', 'center', 'centre',
  'office', 'dlsa', 'slsa', 'tlsc', 'notary', 'cell', 'unit', 'desk', 'complex', 'bhavan',
  'bhawan', 'authority', 'department', 'thana', 'chowki', 'test', 'help', 'services',
  'room', 'branch', 'sub', 'division', 'tribunal', 'board', 'near', 'road', 'street'
]);

// ── Category to Lawyer Specialization Regex Resolver ─────────────────────────

/** Helper: Map category name / id to lawyer specialization matching regex */
export function getCategorySpecializationRegex(categoryId: string): RegExp {
  switch (categoryId) {
    case 'Property Dispute':
      return /Property|Real Estate|Civil|Land/i;
    case 'Family Law':
    case 'Domestic Violence':
      return /Family|Divorce|Domestic|Women|Criminal/i;
    case 'Consumer Complaint':
      return /Consumer|Civil|Insurance/i;
    case 'Cyber Crime':
      return /Cyber|Criminal|IT Law|Information Technology/i;
    case 'Labour Issue':
      return /Labour|Employment|Service Law/i;
    case 'Criminal Matter':
      return /Criminal|Bail/i;
    case 'Business Dispute':
      return /Corporate|Commercial|Contract|Business/i;
    default:
      return new RegExp(categoryId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
  }
}