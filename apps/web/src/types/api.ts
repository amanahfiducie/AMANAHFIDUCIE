export type TokenPair = {
  access: string;
  refresh: string;
};

export type UserProfileResponse = {
  display_name: string;
  phone: string;
  timezone: string;
  locale: string;
  created_at: string;
  updated_at: string;
};

export type MeResponse = {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  is_staff: boolean;
  is_superuser: boolean;
  is_active: boolean;
  profile: UserProfileResponse;
  roles: string[];
  case_links?: UserCaseLink[];
  /** Direction, admin ou comité charaïque : accès à tous les dossiers. */
  has_global_case_access?: boolean;
};

export type UserListItem = MeResponse;

export type CreateUserPayload = {
  email: string;
  password: string;
  phone: string;
  first_name?: string;
  last_name?: string;
  party_type?: string;
  is_staff?: boolean;
  roles: string[];
};

export type UpdateUserPayload = {
  email?: string;
  first_name?: string;
  last_name?: string;
  is_staff?: boolean;
  is_active?: boolean;
  roles?: string[];
  party_type?: string;
  profile?: {
    display_name?: string;
    phone?: string;
    timezone?: string;
    locale?: string;
  };
};

export type OnboardingStepStatus = "completed" | "skipped" | "pending";

export type OnboardingProgress = {
  case_type: string;
  case_type_label: string;
  current_step: string;
  steps: {
    id: string;
    label: string;
    description: string;
    required: boolean;
    skippable?: boolean;
    status: OnboardingStepStatus;
    completed: boolean;
    skipped: boolean;
  }[];
  pending_tasks: {
    id: string;
    label: string;
    status: OnboardingStepStatus;
    required: boolean;
  }[];
  completed: boolean;
  can_submit: boolean;
  onboarding_data: Record<string, unknown>;
};

export type ProfileInviteProfileType =
  | "donor"
  | "beneficiary"
  | "guardian"
  | "trusted_person";

export type UserCaseLink = {
  case_id: number;
  reference: string;
  title: string;
  profile_types: ProfileInviteProfileType[];
  stakeholder_roles?: string[];
  is_case_manager?: boolean;
};

export type ProfileAccessPreview = {
  status: "no_user" | "user_exists" | "already_in_case" | "missing_email";
  message: string;
  profile: {
    profile_type: ProfileInviteProfileType;
    profile_id: number;
    display_name: string;
    email: string;
    phone: string;
    case_id: number;
    case_reference: string;
    case_title: string;
  };
  user?: {
    id: number;
    username: string;
    email: string;
    first_name: string;
    last_name: string;
  };
  suggested_email?: string;
};

export type ProfileUserAccessRequestItem = {
  id: number;
  case: number;
  case_reference: string;
  case_title: string;
  profile_type: ProfileInviteProfileType;
  profile_type_label: string;
  profile_id: number;
  status: string;
  email: string;
  phone: string;
  display_name: string;
  preview_status: string;
  existing_user: number | null;
  existing_user_username: string | null;
  created_user: number | null;
  created_user_username: string | null;
  requested_by: number;
  requested_by_username: string;
  reviewed_by: number | null;
  reviewed_at: string | null;
  review_notes: string;
  created_at: string;
  updated_at: string;
};

export type ProfileAccessInviteResult = {
  status: string;
  created_user: boolean;
  user: {
    id: number;
    username: string;
    email: string;
    first_name: string;
    last_name: string;
  };
  stakeholder_id: number;
  email_sent_to: string | null;
  email_sent: boolean;
  email_error: string | null;
  temporary_password_sent: boolean;
};

export type FiduciaryCaseListItem = {
  id: number;
  reference: string;
  case_type?: string;
  title: string;
  case_origin?: string;
  status: string;
  onboarding_step?: string;
  onboarding_step_label?: string | null;
  onboarding_completed_at?: string | null;
  created_by: number;
  created_by_username: string;
  assigned_to: number | null;
  assigned_to_username?: string | null;
  primary_donor_name?: string | null;
  donors_count?: number;
  beneficiaries_count?: number;
  mandates_count?: number;
  created_at: string;
  updated_at: string;
};

export type Mandate = {
  id: number;
  mandate_type: string;
  title: string;
  reference_number: string;
  issuing_authority: string;
  signed_at: string | null;
  effective_from: string | null;
  effective_to: string | null;
  notes?: string;
  latest_decision?: string | null;
};

export type DonorTrustedPerson = {
  id: number;
  first_name: string;
  last_name: string;
  phone: string;
  email: string;
  relationship_label: string;
};

export type CaseDonor = {
  id: number;
  first_name: string;
  last_name: string;
  date_of_birth: string | null;
  nationality: string;
  identification_number: string;
  email: string;
  phone: string;
  address: string;
  notes: string;
  trusted_persons: DonorTrustedPerson[];
};

export type Beneficiary = {
  id: number;
  first_name: string;
  last_name: string;
  date_of_birth: string | null;
  is_minor: boolean;
  nationality: string;
  identification_number?: string;
  notes?: string;
  patrimony_share_percent?: string | null;
  patrimony_share_value?: string | null;
  case_patrimony_total?: string;
  case_patrimony_currency?: string;
  donor: number | null;
  donor_name: string | null;
  guardian?: number | null;
  guardian_name?: string | null;
  relation_to_donor: string;
  relation_to_donor_label: string;
  gender?: "" | "M" | "F";
  father?: number | null;
  mother?: number | null;
  father_name?: string | null;
  mother_name?: string | null;
};

export type Guardian = {
  id: number;
  first_name: string;
  last_name: string;
  relationship_label: string;
  email: string;
  phone: string;
};

export type AssetValuation = {
  id: number;
  value: string;
  currency: string;
  valued_at: string;
  method: string;
  notes: string;
  created_at: string;
};

export type AssetEventType = "GAIN" | "EXPENSE" | "ESTIMATION" | "OTHER";

export type CategoryBillingKind = "FIXED" | "VARIABLE";

export type AssetEventCategory = {
  id: number;
  event_type: AssetEventType;
  name: string;
  description: string;
  billing_kind: CategoryBillingKind;
  default_amount: string | null;
  created_at: string;
};

export type AssetEvent = {
  id: number;
  event_type: AssetEventType;
  status: "ACTIVE" | "CANCELLED";
  category?: number | null;
  category_name?: string | null;
  category_description?: string | null;
  reference?: string;
  title?: string;
  description?: string;
  amount: string | null;
  currency: string;
  event_date: string | null;
  justification_filename?: string | null;
  has_justification?: boolean;
  expense_kind?: string;
  created_by_username?: string;
  created_at: string;
  updated_at?: string;
  cancelled_at?: string | null;
};

export type AssetRisk = {
  id: number;
  risk_level: string;
  category: string;
  description: string;
  identified_at: string;
};

export type Asset = {
  id: number;
  asset_type: string;
  label: string;
  description?: string;
  location?: string;
  currency: string;
  latest_currency?: string | null;
  latest_value: string | null;
  is_active: boolean;
  valuation_frequency: string;
  valuation_next_due: string | null;
  valuation_overdue?: boolean;
  valuations?: AssetValuation[];
  risks?: AssetRisk[];
  events?: AssetEvent[];
};

export type CaseAssignment = {
  id: number;
  user: number;
  username: string;
  display_name?: string;
  assigned_by: number | null;
  assigned_by_username: string | null;
  assigned_by_name?: string | null;
  started_at: string;
  ended_at: string | null;
  is_current: boolean;
};

export type AssignableCaseAgent = {
  id: number;
  username: string;
  display_name: string;
  email: string;
  is_current: boolean;
};

export type TimelineEvent = {
  id: number;
  event_type: string;
  actor_username: string | null;
  message: string;
  created_at: string;
};

export type FiduciaryCaseDetail = FiduciaryCaseListItem & {
  description: string;
  onboarding?: OnboardingProgress;
  assignment_history?: CaseAssignment[];
  stakeholders: { id: number; username: string; role: string }[];
  timeline_events: TimelineEvent[];
  mandates: Mandate[];
  donors: CaseDonor[];
  beneficiaries: Beneficiary[];
  guardians: Guardian[];
  assets: Asset[];
  documents?: DocumentItem[];
};

export type DocumentItem = {
  id: number;
  title: string;
  category: string;
  donor: number | null;
  beneficiary?: number | null;
  guardian?: number | null;
  mandate?: number | null;
  identity_kind: string;
  original_filename: string | null;
  created_at: string;
  is_confidential?: boolean;
};

export type PatrimonySummary = {
  case_id?: number;
  case_reference?: string;
  asset_count: number;
  total_estimated_value: string;
  currency: string;
  total_gains?: string;
  total_expenses?: string;
  net_benefit?: string;
  objectives?: string;
  remarks?: string;
  observations?: string;
  by_type: Record<
    string,
    | number
    | { count: number; total_value: string; currency: string }
  >;
  assets?: {
    id: number;
    label: string;
    asset_type: string;
    latest_value: string;
    currency: string;
    risk_count?: number;
  }[];
};

export type FinancialSummary = {
  account_count: number;
  total_balance: string;
  currency: string;
  accounts: {
    account_id: number;
    account_name: string;
    current_balance: string;
    pending_validation_count: number;
  }[];
};

export type ReportItem = {
  id: number;
  case: number;
  report_type: string;
  report_type_label: string;
  title: string;
  status: string;
  status_label: string;
  period_start?: string | null;
  period_end?: string | null;
  metadata_json?: ReportSnapshot | Record<string, unknown> | null;
  generated_by_username: string;
  approved_by_username: string | null;
  approved_at: string | null;
  can_download: boolean;
  created_at: string;
};

export type ReportSnapshotPeriod = {
  start: string;
  end: string;
  label: string;
};

export type ReportSnapshot = {
  version?: number;
  generated_at?: string;
  report_type?: string;
  service?: {
    code: string;
    report_name: string;
    subtitle: string;
    people_label: string;
    donor_label: string;
    mandate_label: string;
    sections: Record<string, boolean>;
    kpis: string[];
  };
  period?: ReportSnapshotPeriod;
  case?: {
    id: number;
    reference: string;
    title: string;
    case_type: string;
    case_type_label: string;
    status: string;
    status_label: string;
    description?: string;
    assigned_to_name?: string;
  };
  kpis?: {
    patrimony_total?: string;
    liquidities?: string;
    invested_percent?: number;
    invested_amount?: string;
    available_amount?: string;
    annual_yield_percent?: number | null;
    currency?: string;
    period_net_flow?: string;
    period_patrimony_net?: string;
    beneficiaries_count?: number;
    minors_count?: number;
    heirs_count?: number;
    faraid_share_total?: number;
    zakatable_wealth?: string;
    zakat_due?: string;
  };
  people?: {
    label?: string;
    donor_label?: string;
    donors_count: number;
    beneficiaries_count: number;
    minors_count?: number;
    mandates_count: number;
    donors?: { name: string }[];
    beneficiaries?: { name: string; is_minor?: boolean }[];
    mandates?: { title: string; status?: string }[];
  };
  finance?: {
    total_balance?: string;
    account_count?: number;
    currency?: string;
    period_flows?: {
      income_total: string;
      expense_total: string;
      net_flow: string;
      movement_count: number;
      movements?: {
        id: number;
        date: string | null;
        type: string;
        amount: string;
        label: string;
        account: string;
        category: string;
      }[];
    };
  };
  patrimony?: {
    asset_count?: number;
    total_estimated_value?: string;
    currency?: string;
    by_type_slices?: {
      code: string;
      label: string;
      amount: string;
      count: number;
      percent: number;
    }[];
    period_events?: {
      period_gains: string;
      period_expenses: string;
      period_net: string;
    };
    assets?: {
      id: number;
      label: string;
      asset_type: string;
      latest_value: string;
      currency: string;
    }[];
  };
  investments?: {
    policy?: {
      planned_investment_amount?: string;
      patrimony_category?: {
        code: string;
        label: string;
        allocation_targets?: Record<string, number>;
      };
    };
    summary?: {
      total_value?: string;
      asset_count?: number;
      annual_yield_percent?: number | null;
      allocation_actual?: Record<string, number>;
      allocation_target?: Record<string, number>;
    };
    charts?: {
      category_distribution?: { code: string; label: string; amount: string; percent?: number }[];
      patrimony_evolution?: { date: string; value: string | number }[];
      invested_vs_available?: {
        invested_amount?: string;
        available_amount?: string;
        invested_percent?: number;
        currency?: string;
      };
    };
    allocation_rows?: {
      slug: string;
      target_percent: number;
      target_amount: string;
      invested_amount: string;
      remaining_amount: string;
    }[];
    positions?: {
      id: number;
      label: string;
      asset_class_slug: string;
      asset_class_label: string;
      amount_invested: string;
      current_value: string;
      status: string;
      annual_yield_percent?: number | null;
    }[];
  } | null;
  waqf?: {
    waqf_type: string;
    waqf_type_label: string;
    waqf_object: string;
    waqf_distribution_rules: string;
  } | null;
  zakat?: {
    assessments: {
      year: number;
      zakatable_wealth: string;
      zakat_due: string;
      currency: string;
      status: string;
      status_label: string;
    }[];
    latest: {
      year: number;
      zakatable_wealth: string;
      zakat_due: string;
      currency: string;
      status_label: string;
    } | null;
  } | null;
  faraid?: {
    heirs_count: number;
    share_total: number;
    heirs: {
      full_name: string;
      relationship_label: string;
      share_fraction: string;
      share_percent: number;
    }[];
    review?: {
      status: string;
      status_label: string;
      net_estate?: string;
      notes?: string;
    } | null;
  } | null;
  genealogy?: {
    deceased_name: string;
    deceased_gender: string | null;
    family_members: {
      id: number;
      first_name: string;
      last_name: string;
      date_of_birth: string | null;
      is_minor: boolean;
      nationality?: string;
      identification_number?: string;
      notes?: string;
      donor: number | null;
      donor_name: string | null;
      guardian?: number | null;
      guardian_name?: string | null;
      relation_to_donor: string;
      relation_to_donor_label: string;
      gender?: string;
      father?: number | null;
      mother?: number | null;
      father_name?: string | null;
      mother_name?: string | null;
      patrimony_share_percent?: string | null;
    }[];
    member_count: number;
    decisions: {
      id: number;
      beneficiary: number | null;
      full_name: string;
      relationship_label: string;
      faraid_role: string;
      status: string;
      share_fraction: string | null;
      share_amount: string | null;
      committee_notes: string;
      rejection_justification: string;
    }[];
    review_status: string | null;
    review_status_label: string | null;
    currency: string;
    trees: {
      base: boolean;
      with_decisions: boolean;
      final_share: boolean;
    };
  } | null;
};

export type ValidationStep = {
  id: number;
  step_order: number;
  assigned_role: string;
  step_label: string;
  status: string;
  decisions: ValidationDecision[];
  created_at: string;
};

export type ValidationDecision = {
  id: number;
  step: number;
  decision: string;
  comment: string;
  decided_by: number;
  decided_by_username: string;
  /** Nom affiché (prénom/nom ou profil), sinon username. */
  decided_by_name?: string;
  created_at: string;
};

export type ValidationReturnTarget = {
  role: string;
  label: string;
  step_order: number;
  user_id: number | null;
  user_name: string;
};

export type ValidationRequest = {
  id: number;
  case: number;
  case_reference: string;
  case_title?: string;
  validation_type: string;
  subject_type: string;
  title: string;
  summary: string;
  status: string;
  financial_movement: number | null;
  mandate: number | null;
  requested_by: number;
  requested_by_username: string;
  steps: ValidationStep[];
  current_step: ValidationStep | null;
  can_decide?: boolean;
  latest_decision_comment?: string;
  return_targets?: ValidationReturnTarget[];
  created_at: string;
  updated_at: string;
};

export type ApiErrorBody = {
  error?: string;
  message?: string;
  detail?: string;
  details?: { field?: string; message?: string }[];
  [key: string]: unknown;
};

export type AuditLogItem = {
  id: number;
  actor_username: string | null;
  actor_role: string;
  action: string;
  entity_type: string;
  entity_id: string;
  case: number | null;
  case_reference: string | null;
  timestamp: string;
  metadata_json: Record<string, unknown>;
};

export type FiduciaryAccountListItem = {
  id: number;
  case: number;
  name: string;
  account_number: string;
  currency: string;
  opening_balance: string;
  current_balance: string;
  is_active: boolean;
  created_at: string;
};

export type EnterpriseAccount = {
  id: number;
  name: string;
  account_number: string;
  account_type: string;
  account_type_label: string;
  currency: string;
  opening_balance: string;
  current_balance: string;
  is_active: boolean;
  created_at: string;
};

export type EnterpriseFinancialSummary = {
  entity_name: string;
  currency: string;
  account_count: number;
  total_balance: string;
  accounts: {
    account_id: number;
    account_name: string;
    account_type: string;
    currency: string;
    current_balance: string;
    draft_count: number;
  }[];
  performance: EnterprisePerformance;
};

export type EnterprisePerformance = {
  year: number;
  month: number | null;
  period_label: string;
  chiffre_affaires: string;
  recettes: string;
  recettes_honoraires: string;
  recettes_autres: string;
  total_depenses: string;
  resultat_net: string;
  movement_count: number;
  /** Source du CA : factures validées */
  revenue_source?: "invoices" | string;
  revenue_by_service: {
    slug?: string;
    service_type: string;
    label: string;
    total: string;
  }[];
  expense_by_category: {
    slug: string;
    label: string;
    total: string;
  }[];
  monthly_trends: {
    month: number;
    label: string;
    revenue: string;
    expense: string;
    net: string;
  }[];
  revenue_monthly_by_category: {
    slug: string;
    label: string;
    values: string[];
  }[];
  expense_monthly_by_category: {
    slug: string;
    label: string;
    values: string[];
  }[];
  category_breakdown: {
    slug: string;
    label: string;
    movement_type: string;
    total: string;
  }[];
};

export type MovementCategory = {
  id: number;
  slug: string;
  label: string;
  movement_type: string;
  scope: string;
  service_type: string;
  service_type_label: string | null;
  sort_order: number;
  is_active: boolean;
  is_system: boolean;
  movement_count?: number;
};

export type EnterpriseJustificatif = {
  id: number;
  movement: number;
  title: string;
  original_filename: string;
  mime_type: string;
  size_bytes: number;
  download_url: string | null;
  created_at: string;
};

export type EnterpriseMovement = {
  id: number;
  account: number;
  account_name: string;
  movement_type: string;
  category: number | null;
  category_label: string | null;
  amount: string;
  signed_amount: string;
  currency: string;
  description: string;
  reference: string;
  movement_date: string;
  status: string;
  justificatif_count: number;
  justificatifs?: EnterpriseJustificatif[];
  created_at: string;
};

export type WaqfProfile = {
  id: number;
  case: number;
  waqf_type: string;
  waqf_object: string;
  waqf_distribution_rules: string;
  created_at: string;
  updated_at: string;
};

export type ZakatAssessment = {
  id: number;
  case: number;
  assessment_year: number;
  nisab_amount: string;
  zakatable_wealth: string;
  zakat_due: string;
  currency: string;
  notes: string;
  status: string;
  prepared_by_username: string;
  created_at: string;
};

export type FaraidHeir = {
  id: number;
  case: number;
  beneficiary: number | null;
  full_name: string;
  relationship_label: string;
  share_fraction: string;
  notes: string;
};

export type FaraidHeirDecisionStatus = "PENDING" | "ACCEPTED" | "REJECTED";

export type FaraidHeirDecision = {
  id: number;
  beneficiary: number | null;
  source: "FROM_GENEALOGY" | "MANUAL";
  full_name: string;
  relationship_label: string;
  faraid_role: string;
  status: FaraidHeirDecisionStatus;
  rejection_justification: string;
  share_fraction: string | null;
  share_amount: string | null;
  committee_notes: string;
  created_at: string;
  updated_at: string;
};

export type FaraidSettlementActionType =
  | "ASSET_PURCHASE"
  | "ASSET_ALLOCATION"
  | "CASH_SETTLEMENT"
  | "OTHER";

export type FaraidSettlementAction = {
  id: number;
  action_type: FaraidSettlementActionType;
  title: string;
  description: string;
  beneficiary: number | null;
  asset: number | null;
  amount: string | null;
  currency: string;
  created_by: number;
  created_by_username: string;
  created_at: string;
  updated_at: string;
};

export type FaraidCommitteeReview = {
  id: number;
  case: number;
  status: "DRAFT" | "FINALIZED";
  net_estate: string | null;
  currency: string;
  committee_notes: string;
  requested_at: string | null;
  requested_by: number | null;
  requested_by_username: string | null;
  finalized_at: string | null;
  finalized_by: number | null;
  finalized_by_username: string | null;
  heir_decisions: FaraidHeirDecision[];
  settlement_actions: FaraidSettlementAction[];
  created_at: string;
  updated_at: string;
};

export type FinanceMovementOverview = {
  id: number;
  case_id: number;
  case_reference: string;
  account: number;
  account_name: string;
  movement_type: string;
  category_label: string | null;
  amount: string;
  signed_amount: string;
  currency: string;
  description: string;
  reference: string;
  movement_date: string;
  status: string;
  created_at: string;
};

export type NotificationItem = {
  id: number;
  case: number | null;
  notification_type: string;
  title: string;
  body: string;
  action_path: string;
  read_at: string | null;
  is_read: boolean;
  created_at: string;
};

export type CaseObservationKind = "SUBMISSION" | "REMARK";

export type CaseObservationStatus = "DRAFT" | "PENDING" | "APPROVED" | "REJECTED";

export type CaseObservation = {
  id: number;
  case?: number;
  case_reference?: string;
  case_title?: string;
  kind: CaseObservationKind;
  kind_label: string;
  status: CaseObservationStatus;
  status_label: string;
  body: string;
  author: number;
  author_username: string;
  author_display: string;
  shared_at: string | null;
  reviewed_by: number | null;
  reviewed_by_username: string | null;
  reviewed_at: string | null;
  review_reason: string;
  created_at: string;
  updated_at: string;
};

export type InvestmentAssetClass = {
  id: number;
  slug: string;
  label: string;
  description: string;
  weight_min: number;
  weight_max: number;
  sort_order: number;
  is_active?: boolean;
};

export type PatrimonyInvestmentCategory = {
  id: number;
  code: string;
  label: string;
  objective: string;
  target_yield_min: string;
  target_yield_max: string;
  allocation_targets: Record<string, number>;
  default_case_types: string[];
  sort_order: number;
  is_active?: boolean;
};

export type AmanahManagementProfile = {
  id: number;
  slug: string;
  label: string;
  code_ar: string;
  description: string;
  target_yield_min: string;
  target_yield_max: string;
  linked_category_code: string | null;
  sort_order: number;
};

export type InvestmentRecord = {
  id: number;
  case: number;
  asset_class: InvestmentAssetClass;
  label: string;
  reference: string;
  amount_invested: string;
  current_value: string;
  latent_gain: string;
  currency: string;
  start_date: string;
  maturity_date: string | null;
  status: string;
  annual_yield_percent: string | null;
  distributed_income: string;
  sharia_compliance_score: string | null;
  requires_purification: boolean;
  purification_amount: string | null;
  notes: string;
  risk_summary?: string;
  created_by_name: string | null;
  created_at: string;
  updated_at: string;
  participant_shares?: ParticipantShareSlice[];
};

export type ScheduledPayment = {
  id?: string;
  date: string;
  amount: string;
  label: string;
  /** Somme versée par le client pour investir. */
  status: "PENDING" | "PAID";
  notes?: string;
  paid_at?: string | null;
  beneficiary_id?: number | null;
  beneficiary_name?: string | null;
};

export type EnvelopeContribution = {
  id: number;
  amount: string;
  previous_total: string;
  new_total: string;
  notes: string;
  created_by_name: string;
  created_at: string;
};

export type CaseInvestmentPolicy = {
  id: number;
  patrimony_category: PatrimonyInvestmentCategory;
  management_profile: AmanahManagementProfile;
  sharia_compliance_score: string | null;
  planned_investment_amount: string | null;
  amanah_management_share_percent: string | null;
  scheduled_payments: ScheduledPayment[];
  notes: string;
  envelope_history: EnvelopeContribution[];
  updated_at: string;
};

export type CaseInvestmentDashboard = {
  case_id: number;
  case_reference: string;
  case_title: string;
  case_type: string;
  policy: CaseInvestmentPolicy;
  investments: InvestmentRecord[];
  summary: {
    total_value: string;
    asset_count: number;
    beneficiary_count: number;
    annual_yield_percent: number | null;
    distributed_income: string;
    latent_gain: string;
    sharia_compliance_score: number | null;
    watchlist_count: number;
    purification_total: string;
    heirs_count: number;
    indivision_risk: string;
    allocation_actual: Record<string, number>;
    allocation_target: Record<string, number>;
  };
  watchlist: { id: number; label: string; reason: string }[];
  charts: InvestmentCharts;
};

export type InvestmentsOverview = {
  cases: {
    id: number;
    reference: string;
    title: string;
    case_type: string;
    investment_count: number;
    total_value: string;
    planned_investment_amount?: string | null;
  }[];
  categories: PatrimonyInvestmentCategory[];
  profiles: AmanahManagementProfile[];
  asset_classes: InvestmentAssetClass[];
  totals: {
    case_count: number;
    total_value: string;
    investment_count: number;
  };
};

export type InvestmentCatalog = {
  asset_classes: InvestmentAssetClass[];
  patrimony_categories: PatrimonyInvestmentCategory[];
  management_profiles: AmanahManagementProfile[];
};

export type InvestmentParticipantRecord = {
  id: number;
  beneficiary: number;
  beneficiary_name: string;
  patrimony_category: PatrimonyInvestmentCategory;
  allocated_amount: string;
  share_percent: string | null;
};

export type ParticipantShareSlice = {
  beneficiary_id: number;
  beneficiary_name: string;
  category_code: string;
  category_label: string;
  amount: string;
  percent: number;
};

export type PatrimonyEvolutionPoint = {
  date: string;
  value: string;
  investment_id?: number;
  label?: string;
  asset_class_slug?: string;
  asset_class_label?: string;
};

export type PatrimonyEvolutionSeries = {
  slug: string;
  label: string;
  points: PatrimonyEvolutionPoint[];
};

export type InvestmentCharts = {
  category_distribution: { code?: string; label: string; amount: string; percent: number }[];
  patrimony_evolution: PatrimonyEvolutionPoint[];
  patrimony_evolution_by_asset_class: PatrimonyEvolutionSeries[];
  invested_vs_available: {
    patrimony_total: string;
    planned_investment_amount?: string | null;
    invested_amount: string;
    available_amount: string;
    estimated_uninvested: string;
    invested_percent: number;
    currency: string;
  };
  participant_shares: {
    investment_id: number;
    label: string;
    participants: ParticipantShareSlice[];
  }[];
};

export type CaseBeneficiaryCapital = {
  case_id: number;
  patrimony_total: string;
  fiduciary_balance: string;
  currency: string;
  beneficiaries: {
    beneficiary_id: number;
    display_name: string;
    patrimony_share_percent: string | null;
    patrimony_limit: string;
    deployed_amount: string;
    available_amount: string;
    currency: string;
  }[];
};

export type ManagementInvestmentAllocation = {
  id: number;
  case_id: number | null;
  case_reference?: string | null;
  case_title?: string | null;
  amount_invested: string;
};

export type ManagementInvestment = {
  id: number;
  case_id: number | null;
  case_reference?: string | null;
  case_title?: string | null;
  label: string;
  amount_invested: string;
  current_value: string;
  latent_gain?: string;
  status: string;
  start_date: string;
  asset_class_slug?: string;
  asset_class_label: string;
  annual_yield_percent?: string | null;
  participant_shares: ParticipantShareSlice[];
  allocated_amount?: string;
  allocation_progress_percent?: number;
  is_allocation_complete?: boolean;
  is_envelope?: boolean;
  allocations?: ManagementInvestmentAllocation[];
};

export type InvestmentValuationRecord = {
  id: number;
  value: string;
  currency: string;
  valued_at: string;
  notes: string;
  created_by_name?: string | null;
  created_at: string;
};

export type ValuationEvolutionPoint = {
  date: string;
  value: string;
  label?: string;
  valuation_id?: number;
};

export type ValuationEvolutionChart = {
  window_months: number;
  window_start: string;
  window_end: string;
  activity_start?: string;
  from_activity_start?: boolean;
  start_value: string;
  end_value: string;
  change_percent: string;
  points: ValuationEvolutionPoint[];
};

export type InvestmentDetail = ManagementInvestment & {
  reference?: string;
  notes?: string;
  risk_summary?: string;
  currency?: string;
  maturity_date?: string | null;
  distributed_income?: string;
  sharia_compliance_score?: string | null;
  requires_purification?: boolean;
  purification_amount?: string | null;
  created_by_name?: string | null;
  created_at?: string;
  updated_at?: string;
  remaining_amount?: string;
  allocation_count?: number;
  valuation_history?: InvestmentValuationRecord[];
  valuation_evolution?: ValuationEvolutionChart | null;
  latest_valuation_date?: string | null;
  latest_valuation_value?: string | null;
};

export type InvestmentsGlobalDashboard = {
  cases: InvestmentsOverview["cases"];
  asset_classes: InvestmentAssetClass[];
  totals: InvestmentsOverview["totals"];
  stats: {
    total_invested: string;
    total_current_value: string;
    latent_gain: string;
    total_gains: string;
    total_losses: string;
    total_planned_envelope: string;
    remaining_planned_envelope: string;
    uninvested_amount: string;
    currency: string;
  };
  distribution: { code?: string; label: string; amount: string; percent: number }[];
  patrimony_evolution_by_asset_class: PatrimonyEvolutionSeries[];
  management_investments: ManagementInvestment[];
};

export type CategoryDossierAllocation = {
  total_allocated: string;
  dossier_count: number;
  dossiers: {
    case_id: number;
    case_reference?: string | null;
    case_title?: string | null;
    amount: string;
  }[];
};

export type AssetClassDashboard = {
  asset_class: InvestmentAssetClass;
  stats: {
    investment_count: number;
    active_count?: number;
    total_invested: string;
    total_current_value: string;
    total_allocated?: string;
    unallocated_amount?: string;
    latent_gain: string;
    total_gains: string;
    total_losses: string;
    performance_percent?: number;
    allocation_progress_percent?: number;
    dossier_count?: number;
    incomplete_allocation_count?: number;
    complete_allocation_count?: number;
    target_weight_min: number;
    target_weight_max: number;
    currency: string;
    dossier_allocation?: CategoryDossierAllocation;
  };
  investments: ManagementInvestment[];
  cases: InvestmentsOverview["cases"];
  patrimony_evolution: PatrimonyEvolutionPoint[];
};

export type InvestmentsManagement = InvestmentsOverview & {
  management_investments: ManagementInvestment[];
};

export type BillingFormula =
  | "MANAGEMENT_FEE_AUM"
  | "PERFORMANCE_FEE"
  | "OPENING_FEE"
  | "MISSION_FEE"
  | "OTHER";

export type BillingPeriodicity = "ONCE" | "QUARTERLY" | "ANNUAL" | "ON_PROFIT";

export type ServiceBillingRule = {
  id: number;
  service: number;
  formula: BillingFormula;
  formula_label: string;
  label: string;
  description: string;
  rate_percent: string | null;
  rate_min_percent: string | null;
  rate_max_percent: string | null;
  fixed_amount: string | null;
  fixed_amount_min?: string | null;
  fixed_amount_max?: string | null;
  base_min?: string | null;
  base_max?: string | null;
  currency: string;
  periodicity: BillingPeriodicity;
  periodicity_label: string;
  is_active: boolean;
  sort_order: number;
  effective_from: string | null;
  effective_to: string | null;
  notes: string;
  created_by: number | null;
  created_by_username?: string | null;
  created_at: string;
  updated_at: string;
};

export type ServiceOfferListItem = {
  id: number;
  case_type: string;
  case_type_label: string;
  name: string;
  description: string;
  is_active: boolean;
  sort_order: number;
  active_rules_count: number;
  created_at: string;
  updated_at: string;
};

export type ServiceOfferDetail = Omit<ServiceOfferListItem, "active_rules_count"> & {
  billing_rules: ServiceBillingRule[];
};

export type ServiceBillingRulePayload = {
  formula: BillingFormula;
  label: string;
  description?: string;
  rate_percent?: string | null;
  rate_min_percent?: string | null;
  rate_max_percent?: string | null;
  fixed_amount?: string | null;
  fixed_amount_min?: string | null;
  fixed_amount_max?: string | null;
  base_min?: string | null;
  base_max?: string | null;
  currency?: string;
  periodicity: BillingPeriodicity;
  is_active?: boolean;
  sort_order?: number;
  effective_from?: string | null;
  effective_to?: string | null;
  notes?: string;
};

export type ServicesMeta = {
  formulas: { value: BillingFormula; label: string }[];
  periodicities: { value: BillingPeriodicity; label: string }[];
};

export type CaseBillingRuleOption = {
  id: number;
  formula: BillingFormula;
  formula_label: string;
  label: string;
  description: string;
  rate_percent: string | null;
  rate_min_percent: string | null;
  rate_max_percent: string | null;
  fixed_amount: string | null;
  fixed_amount_min?: string | null;
  fixed_amount_max?: string | null;
  base_min?: string | null;
  base_max?: string | null;
  periodicity: BillingPeriodicity;
  periodicity_label: string;
  currency: string;
  applies_to_current_aum?: boolean;
};

export type CaseBillingCharge = {
  id: number;
  billing_rule_id: number | null;
  formula: BillingFormula;
  formula_label: string;
  label: string;
  base_amount: string | null;
  rate_percent: string | null;
  amount: string;
  currency: string;
  period_label: string;
  movement_date: string;
  status: "DRAFT" | "POSTED" | "CANCELLED";
  status_label: string;
  enterprise_movement_id: number | null;
  notes: string;
  created_by_username: string | null;
  created_at: string;
};

export type CaseBillingOverview = {
  case_id: number;
  case_type: string;
  case_type_label: string;
  service: {
    id: number;
    name: string;
    case_type: string;
    is_active: boolean;
  } | null;
  aum: {
    total_estimated_value: string;
    currency: string;
    asset_count: number;
    net_benefit?: string;
    total_gains?: string;
    total_expenses?: string;
  };
  available_rules: CaseBillingRuleOption[];
  charges: CaseBillingCharge[];
};

export type CaseBillingPreview = {
  formula: BillingFormula;
  label: string;
  amount: string;
  currency: string;
  base_amount: string | null;
  rate_percent: string | null;
  period_label: string;
  notes: string;
};

export type CaseBillingChargeCreatePayload = {
  billing_rule_id: number;
  period_label?: string;
  movement_date?: string;
  base_amount?: string | null;
  rate_percent?: string | null;
  fixed_amount?: string | null;
  notes?: string;
  post?: boolean;
};

export type ServiceBilledCase = {
  id: number;
  reference: string;
  title: string;
  status: string;
  status_label: string;
  charges_count: number;
  draft_count: number;
  posted_count: number;
  total_posted: string;
  currency: string;
  last_charge_label: string | null;
  last_charge_period: string | null;
  last_charge_status: string | null;
  last_charge_amount: string | null;
  updated_at: string;
};

export type ServiceBilledCasesResponse = {
  case_type: string;
  service: { id: number; name: string; case_type: string } | null;
  cases: ServiceBilledCase[];
  count: number;
};

export type PeriodicBillingGeneratePayload = {
  period_label?: string;
  rule_ids?: number[];
  case_ids?: number[];
  post?: boolean;
  dry_run?: boolean;
};

export type PeriodicBillingGenerateResult = {
  created: Record<string, unknown>[];
  skipped: Record<string, unknown>[];
  errors: Record<string, unknown>[];
  summary: { created: number; skipped: number; errors: number };
};

export type BillingInvoiceLinePreview = {
  billing_rule_id: number | null;
  formula: BillingFormula;
  formula_label: string;
  label: string;
  description: string;
  periodicity: BillingPeriodicity;
  periodicity_label: string;
  rate_percent: string | null;
  base_amount: string | null;
  amount: string;
  currency: string;
  applicable: boolean;
  selected: boolean;
  error: string | null;
  notes: string;
};

export type BillingInvoicePreview = {
  case_id: number;
  case_reference: string;
  case_title: string;
  case_type: string;
  case_type_label: string;
  period_label: string;
  aum: {
    total_estimated_value: string;
    net_benefit: string;
    currency: string;
    asset_count: number;
  };
  service: {
    id: number;
    name: string;
    case_type: string;
    description: string;
    is_active: boolean;
  } | null;
  lines: BillingInvoiceLinePreview[];
  existing_invoice_id: number | null;
  existing_invoice_status: string | null;
};

export type BillingInvoiceLineInput = {
  billing_rule_id?: number | null;
  formula?: BillingFormula | string;
  label: string;
  amount: string;
  rate_percent?: string | null;
  base_amount?: string | null;
  selected?: boolean;
  is_selected?: boolean;
  notes?: string;
};

export type PeriodBillingInvoiceLine = {
  id: number;
  billing_rule_id: number | null;
  formula: BillingFormula;
  formula_label: string;
  label: string;
  base_amount: string | null;
  rate_percent: string | null;
  amount: string;
  is_selected: boolean;
  sort_order: number;
  notes: string;
};

export type PeriodBillingInvoice = {
  id: number;
  case_id: number;
  case_reference: string;
  case_title: string;
  case_type: string;
  case_type_label: string;
  period_label: string;
  label: string;
  amount: string;
  currency: string;
  movement_date: string;
  status: "DRAFT" | "POSTED" | "CANCELLED";
  status_label: string;
  enterprise_movement_id: number | null;
  notes: string;
  lines: PeriodBillingInvoiceLine[];
  created_by_username: string | null;
  created_at: string;
  updated_at: string;
};
