export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
  count?: number;
  fromCache?: boolean;
}

export interface BareActSection {
  _id?: string;
  id?: string;
  section_number: string;
  sectionNumber?: string;
  title: string;
  clean_title?: string;
  title_hi?: string;
  clean_title_hi?: string;
  introduction_text?: string;
  introduction_text_hi?: string;
  content?: string;
  content_hi?: string;
  text?: string;
  text_hi?: string;
  content_blocks?: Array<{
    type?: string;
    text: string | Record<string, any>;
  }>;
  content_blocks_hi?: Array<{
    type?: string;
    text: string | Record<string, any>;
  }>;
}

export interface BareActChapter {
  _id?: string;
  chapterNumber: string;
  chapter_number?: string;
  title: string;
  sections?: BareActSection[];
}

export interface BareAct {
  _id?: string;
  id?: string;
  shortName: string;
  actName: string;
  name?: string;       // legacy fallback
  title?: string;      // legacy fallback
  year: number;
  description?: string;
  preamble?: string;
  chapterCount?: number;
  sectionCount?: number;
  chapters?: BareActChapter[];
  // Gazette & Regulatory Metadata
  jurisdiction?: string;
  category?: string;
  ministry?: string;
  assentDate?: string;
  commencementDate?: string;
  gazetteRef?: string;
  actNumber?: string;
  tags?: string;
  // Performance pre-calculated cache
  cachedChapterCount?: number;
  cachedSectionCount?: number;
  // Legacy & Alias Resolution Metadata
  legacy_short_names?: string[];
  act_code?: string;
  hierarchical_id?: string;
}

export interface CreateActForm {
  actName: string;
  shortName: string;
  year: number;
  actNumber: string;
  jurisdiction: string;
  category: string;
  ministry: string;
  assentDate: string;
  commencementDate: string;
  gazetteRef: string;
  description: string;
  tags: string;
  initialChapterTitle: string;
  initialSectionTitle: string;
  initialSectionContent: string;
}

export interface CreateActPayload {
  actName: string;
  shortName: string;
  year: number;
  description: string;
  chapters: BareActChapter[];
}

export interface EditMetaForm {
  actName: string;
  shortName: string;
  year: number;
  description: string;
  originalShortName: string;
  jurisdiction?: string;
  category?: string;
  ministry?: string;
  assentDate?: string;
  commencementDate?: string;
  gazetteRef?: string;
  actNumber?: string;
}

export interface EditMetaPayload {
  actName?: string;
  newShortName?: string;
  year?: number;
  description?: string;
  jurisdiction?: string;
  category?: string;
  ministry?: string;
  assentDate?: string;
  commencementDate?: string;
  gazetteRef?: string;
  actNumber?: string;
}

// ═════════════════════════════════════════════════════════════════
// SECTION EDIT & AI DTOs
// ═════════════════════════════════════════════════════════════════

export interface EditSectionFormData {
  section_number: string;
  title: string;
  title_hi: string;
  introduction_text: string;
  introduction_text_hi: string;
}

export interface EditSectionSaveEvent {
  section: BareActSection | any;
  formData: EditSectionFormData;
}

export interface UpdateSectionPayload {
  shortName: string;
  section_number: string;
  title: string;
  clean_title?: string;
  title_hi?: string;
  clean_title_hi?: string;
  content: string;
  introduction_text: string;
  content_hi?: string;
  introduction_text_hi?: string;
}

export interface AiTranslateSectionRequest {
  actName: string;
  shortName: string;
  section_number: string;
  title: string;
  introduction_text: string;
}

export interface AiTranslateSectionData {
  title_hi: string;
  introduction_text_hi: string;
}

export interface AiTranslateSectionResponse {
  success: boolean;
  data?: AiTranslateSectionData;
  fromCache?: boolean;
  message?: string;
}

export interface AiEnhanceSectionRequest {
  actName: string;
  shortName: string;
  section_number: string;
  title: string;
  introduction_text: string;
}

export interface AiEnhanceSectionData {
  title: string;
  introduction_text: string;
}

export interface AiEnhanceSectionResponse {
  success: boolean;
  data?: AiEnhanceSectionData;
  fromCache?: boolean;
  message?: string;
}

// ═════════════════════════════════════════════════════════════════
// PINNED SECTIONS & FAVORITES DTOs
// ═════════════════════════════════════════════════════════════════

export interface PinnedSectionsResponse {
  success: boolean;
  data: string[];
}

export interface TogglePinnedSectionResponse {
  success: boolean;
  message: string;
  isPinned: boolean;
  sectionId: string;
}

export interface ToggleFavoriteResponse {
  success: boolean;
  message: string;
  isFavorite: boolean;
  shortName: string;
}

// ═════════════════════════════════════════════════════════════════
// LEGAL RESOURCES & HELPLINES DTOs
// ═════════════════════════════════════════════════════════════════

export interface LegalResourceFacilities {
  hasEfiling?: boolean;
  hasLADCS?: boolean;
  hasVCRoom?: boolean;
  hasLegalAidClinic?: boolean;
  isWheelchairAccessible?: boolean;
}

export interface LegalResourceItem {
  _id?: string;
  id?: string;
  name: string;
  name_hi?: string;
  type: 'LegalAid' | 'Court' | 'GovernmentOffice' | 'PoliceStation' | 'Helpline' | string;
  categories?: string[];
  subcategories?: string[];
  city: string;
  district?: string;
  state?: string;
  pincode?: string;
  pincodeCoverage?: string[];
  address: string;
  address_hi?: string;
  alternateAddress?: string;
  contactNumber?: string[] | string;
  faxNumber?: string[] | string;
  email?: string[] | string;
  website?: string;
  operatingHours?: string;
  operatingHours_hi?: string;
  description?: string;
  description_hi?: string;
  parentAuthorityId?: string;
  parentAuthority?: any;
  feedback?: {
    upvotes: number;
    downvotes: number;
    helpfulnessScore: number;
    reasons?: Array<{ reason: string; count: number }>;
  };
  lunchBreak?: string;
  isOpenNow?: boolean;
  isVerified?: boolean;
  languages?: string[];
  coordinates?: {
    lat: number;
    lng: number;
  };
  status?: 'approved' | 'pending' | string;
  source?: 'admin_dashboard' | 'user_suggestion' | 'bulk_import' | string;
  jurisdictionLevel?: 'National' | 'State' | 'District' | 'Taluka' | 'SpecialTribunal' | string;
  facilities?: LegalResourceFacilities;
  isStateAuthority?: boolean;
  isNationalAuthority?: boolean;
  executiveChairman?: string;
  memberSecretary?: string;
  patronInChief?: string;
  sclscChairman?: string;
  sclscSecretary?: string;
  sclscAddress?: string;
  additionalStaff?: Array<{ name: string; role: string }>;
  tags?: string[];
  lastAuditDate?: string | Date;
  verificationExpiry?: string | Date;
  verifiedByAdmin?: string;
  auditNotes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface HelplineItem {
  _id?: string;
  id?: string;
  name: string;
  title?: string;
  category: string;
  number: string;
  phone?: string;
  description?: string;
  priorityTier?: 'P0_CRITICAL' | 'P1_URGENT' | 'P2_ADVISORY';
  isActive?: boolean;
  is24x7?: boolean;
  operatingHours?: string;
  operatingDays?: string[];
  languages?: string[];
  state?: string;
  tollFree?: boolean;
  alternateNumbers?: string[];
  lastVerifiedAt?: string | Date;
  verifiedBy?: string;
  verificationNotes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface LegalTemplateItem {
  _id?: string;
  id?: string;
  title: string;
  category: string;
  description?: string;
  templateContent?: string;
  downloadsCount?: number;
}