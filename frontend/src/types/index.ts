export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
}
export interface Entity {
  id: string;
  created_at: string;
  updated_at?: string;
  [key: string]: unknown;
}
export interface User extends Entity {
  username: string;
  full_name: string;
  role: 'admin' | 'analyst' | 'viewer';
  must_change_password: boolean;
  is_active: boolean;
}
export interface Asset extends Entity {
  kind: string;
  original_filename: string;
  width: number;
  height: number;
  page_count: number;
  file_size: number;
  media_type: string;
  sha256: string;
  source_metadata: { roi_confirmed?: boolean; whole_source_confirmed?: boolean };
}
export interface Document extends Entity {
  file_asset_id: string;
  display_name: string;
  page_count: number;
  document_no?: string;
}
export interface Organization extends Entity {
  name: string;
  code: string | null;
  short_name: string | null;
  description: string | null;
  address: string | null;
  status: string;
}
export interface Design extends Entity {
  organization_id: string;
  name: string;
  design_code: string | null;
  seal_type: string;
  status: string;
  description: string | null;
  reference_notes: string | null;
}
export interface Impression extends Entity {
  seal_design_id: string;
  organization_id: string;
  seal_device_id: string | null;
  image_asset_id: string;
  verification_status: string;
  capture_method: string;
  note: string | null;
  design_name: string;
  organization_name: string;
  status: string;
  is_reference: boolean;
}
export interface Device extends Entity {
  seal_design_id: string;
  internal_device_code: string | null;
  provenance_note: string | null;
  inventory_note: string | null;
  source_confidence: string;
  status: string;
}
export interface ROI {
  x: number;
  y: number;
  width: number;
  height: number;
}
export interface Parameters {
  rotation: number;
  brightness: number;
  contrast: number;
  gamma: number;
  saturation: number;
  sharpen: number;
  denoise: number;
  grayscale: boolean;
  threshold_mode: 'off' | 'otsu' | 'adaptive' | 'manual';
  threshold_value: number;
  red_mask: boolean;
  hue_width: number;
  saturation_min: number;
  value_min: number;
  morphology: 'none' | 'open' | 'close';
  kernel_size: number;
  invert: boolean;
  background: 'none' | 'white' | 'transparent' | 'overlay';
  apply_mask: boolean;
}
export interface Profile extends Entity {
  name: string;
  parameters: Parameters;
  is_default: boolean;
}
export interface Run extends Entity {
  source_asset_id: string;
  output_asset_id: string;
  source_page: number;
  roi_geometry: ROI;
  parameters: Parameters;
  pipeline_version: string;
}
export interface Candidate {
  id?: string;
  reference_asset_id: string;
  reference_impression_id?: string | null;
}
export interface Analysis extends Entity {
  title: string;
  status: string;
  query_asset_id: string;
  mode: string;
  candidates: Candidate[];
  created_by: string;
}
export interface Evidence {
  category: string;
  description: string;
  strength: string;
  region_description: string;
}
export interface Comparison {
  status: string;
  verdict: string;
  visual_similarity_score: number | null;
  visual_confidence_label: string;
  same_design_plausible: boolean | null;
  summary_vi: string;
  observations_q: string[];
  observations_k: string[];
  matching_features: Evidence[];
  differing_features: Evidence[];
  uncertain_features: Evidence[];
  text_recognition_q: string[];
  text_recognition_k: string[];
  limitations: string[];
  recommendation_vi: string;
}
export interface Annotation extends Entity {
  label: string;
  image_role: 'Q' | 'K';
  geometry: ROI;
  note: string;
  source: string;
}
export interface Result extends Entity {
  session_id: string;
  candidate_id: string;
  model_name: string;
  provider_version: string;
  prompt_version: string;
  result_status: string;
  visual_similarity_score: number | null;
  verdict: string;
  structured_result: Comparison;
  error_summary: string | null;
  error_code: string | null;
  request_id_provider: string | null;
  duration_ms: number;
  token_usage: Record<string, unknown> | null;
  input_metadata: {
    query: { asset_id: string; sha256: string; preprocessing: Run };
    reference: { asset_id: string; sha256: string; preprocessing: Run };
  };
  annotations: Annotation[];
}
export interface OpenAIStatus {
  is_configured: boolean;
  model: string;
  max_candidates: number;
  timeout_seconds: number;
  max_image_side: number;
  max_upload_mb: number;
  max_pages: number;
  pipeline_version: string;
}
