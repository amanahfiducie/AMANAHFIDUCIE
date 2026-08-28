import { apiRequest } from "@/lib/api";
import type { Asset } from "@/types/api";

export type PatrimonyAssetFormState = {
  asset_type: string;
  label: string;
  description: string;
  location: string;
  estimated_value: string;
  valuation_frequency: string;
};

export const EMPTY_PATRIMONY_ASSET_FORM: PatrimonyAssetFormState = {
  asset_type: "REAL_ESTATE",
  label: "",
  description: "",
  location: "",
  estimated_value: "",
  valuation_frequency: "QUARTERLY",
};

function buildAssetPayload(form: PatrimonyAssetFormState) {
  const { estimated_value: _estimated, description, location, ...rest } = form;
  return {
    ...rest,
    ...(description.trim() ? { description: description.trim() } : {}),
    ...(location.trim() ? { location: location.trim() } : {}),
  };
}

async function maybeCreateIndicativeValuation(
  assetId: number,
  estimatedValue: string,
  notes: string,
) {
  if (!estimatedValue) return;
  try {
    await apiRequest(`/assets/${assetId}/valuations/`, {
      method: "POST",
      body: JSON.stringify({
        value: estimatedValue,
        valued_at: new Date().toISOString().slice(0, 10),
        method: "OTHER",
        notes,
      }),
    });
  } catch {
    // L'actif reste enregistré même si l'estimation indicative échoue.
  }
}

export function assetToPatrimonyForm(asset: Asset): PatrimonyAssetFormState {
  return {
    asset_type: asset.asset_type,
    label: asset.label,
    description: asset.description ?? "",
    location: asset.location ?? "",
    estimated_value: asset.latest_value ?? "",
    valuation_frequency: asset.valuation_frequency ?? "QUARTERLY",
  };
}

export async function createCaseAsset(
  caseId: string,
  form: PatrimonyAssetFormState,
  notes = "Estimation initiale",
): Promise<Asset> {
  const estimatedValue = form.estimated_value.trim();
  const created = await apiRequest<Asset>(`/cases/${caseId}/assets/`, {
    method: "POST",
    body: JSON.stringify(buildAssetPayload(form)),
  });
  await maybeCreateIndicativeValuation(created.id, estimatedValue, notes);
  return created;
}

export async function updateCaseAsset(
  assetId: number,
  form: PatrimonyAssetFormState,
): Promise<Asset> {
  return apiRequest<Asset>(`/assets/${assetId}/`, {
    method: "PATCH",
    body: JSON.stringify(buildAssetPayload(form)),
  });
}

export async function deleteCaseAsset(assetId: number): Promise<void> {
  await apiRequest(`/assets/${assetId}/`, {
    method: "PATCH",
    body: JSON.stringify({ is_active: false }),
  });
}
