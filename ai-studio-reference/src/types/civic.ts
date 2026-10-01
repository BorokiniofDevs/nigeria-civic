export type GeopoliticalZone =
  | 'North-West'
  | 'North-East'
  | 'North-Central'
  | 'South-West'
  | 'South-East'
  | 'South-South'
  | 'Federal Capital Territory';

export type JurisdictionTier =
  | 'FEDERAL'
  | 'STATE'
  | 'SENATORIAL'
  | 'LGA'
  | 'LCDA'
  | 'WARD';

export type OfficialSector =
  | 'SECURITY'
  | 'HEALTH'
  | 'INFRASTRUCTURE'
  | 'GOVERNANCE'
  | 'FINANCE'
  | 'JUDICIARY'
  | 'LEGISLATURE'
  | 'EDUCATION'
  | 'ENVIRONMENT';

export interface Jurisdiction {
  id: string;
  name: string;
  tier: JurisdictionTier;
  zone: GeopoliticalZone;
  parent_id?: string | null;
  capital?: string;
  lga_count?: number;
  lcda_count?: number;
  ward_count?: number;
  population_est?: string;
  svg_map_url?: string;
  code?: string;
  zipcode?: string;
  areas_covered?: string[];
  map_image_url?: string;
  flag_image_url?: string;
  seal_image_url?: string;
  council_leader?: string;
  vice_chairman?: string;
  slg_name?: string;
  dpo_name?: string;
  dpo_phone?: string;
  phc_name?: string;
  phc_phone?: string;
  phc_address?: string;
  councilor_name?: string;
  councilor_phone?: string;
  councilor_photo?: string;
}

export interface OfficialProfile {
  id: string;
  full_name: string;
  position_title: string;
  jurisdiction_id: string;
  jurisdiction_name?: string;
  sector: OfficialSector;
  public_phone: string;
  public_email: string;
  photo_url: string;
  citation_source: string;
  is_verified: boolean;
  last_synced_at: string;
  badge_title?: string;
  office_address?: string;
  rank?: string;
}

export type RequesterType = 'AUTO_GOOGLE_SYNC' | 'GOVERNMENT_AIDE' | 'CITIZEN_REPORT';
export type UpdateRequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface ProfileUpdateRequest {
  id: string;
  target_profile_id: string;
  requester_type: RequesterType;
  proposed_data: Partial<OfficialProfile>;
  existing_data?: Partial<OfficialProfile>;
  citation_url: string;
  source_snippet?: string;
  confidence_score?: number;
  status: UpdateRequestStatus;
  created_at: string;
  reviewed_at?: string;
  reviewed_by?: string;
}

export type IncidentStatus = 'SUBMITTED' | 'ESCALATED' | 'IN_PROGRESS' | 'RESOLVED';

export interface Incident {
  id: string;
  jurisdiction_id: string;
  jurisdiction_name?: string;
  ward_name?: string;
  sector: OfficialSector;
  title: string;
  description: string;
  media_urls: string[];
  vote_count_local: number;
  vote_count_external: number;
  escalation_level: number;
  escalation_score: number;
  assigned_official_id?: string;
  assigned_official_name?: string;
  assigned_role?: string;
  status: IncidentStatus;
  reported_by?: string;
  is_emergency?: boolean;
  created_at: string;
  last_updated_at?: string;
  official_response?: string;
  official_response_at?: string;
}

export interface BudgetCitizenProof {
  id: string;
  photo_url: string;
  caption: string;
  uploaded_by: string;
  uploaded_at: string;
  geotag: string;
  verified: boolean;
}

export interface BudgetProject {
  id: string;
  title: string;
  jurisdiction_id: string;
  jurisdiction_name: string;
  sector: OfficialSector;
  allocated_amount_ngn: number;
  disbursed_amount_ngn: number;
  contractor_name: string;
  completion_percentage: number;
  status: 'PROPOSED' | 'FUNDS_DISBURSED' | 'IN_EXECUTION' | 'CITIZEN_VERIFIED_COMPLETE';
  line_items: { item: string; amount_ngn: number; date: string }[];
  citizen_proofs: BudgetCitizenProof[];
  start_date: string;
  expected_end_date: string;
}
