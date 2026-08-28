"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import {
  beneficiaryFormValid,
  beneficiaryToFormState,
  buildBeneficiaryRequestBody,
  buildBeneficiaryUpdateBody,
  emptyBeneficiaryForm,
  StepBeneficiary,
  type BeneficiaryFormState,
} from "@/components/case-onboarding/step-beneficiary";
import { PasswordConfirmModal } from "@/components/ui/password-confirm-modal";
import { filterIdentityDocuments } from "@/components/case-onboarding/person-identity-uploads";
import { PersonIdentityUploads } from "@/components/case-onboarding/person-identity-uploads";
import { ErrorAlert } from "@/components/ui/error-alert";
import { ApiError, apiRequest, verifyPassword } from "@/lib/api";
import {
  type CaseDocumentItem,
  fetchCaseDocuments,
} from "@/lib/case-onboarding";
import {
  uploadPendingIdentityDocuments,
  type PendingIdentityFiles,
} from "@/lib/upload-pending-identity";
import { computeCasePatrimonyFromAssets } from "@/lib/case-patrimony";
import { computePersonAge, formatMoney, formatSharePercent } from "@/lib/labels";
import { useAuth } from "@/providers/auth-provider";
import { userIsCaseReadOnly } from "@/lib/role-access";
import { useCaseDetail } from "@/providers/case-detail-provider";
import type { Beneficiary, Guardian } from "@/types/api";

function mapDocuments(
  docs: {
    id: number;
    title: string;
    category: string;
    donor?: number | null;
    beneficiary?: number | null;
    guardian?: number | null;
    mandate?: number | null;
    identity_kind?: string;
    original_filename?: string | null;
    created_at: string;
  }[],
): CaseDocumentItem[] {
  return docs.map((d) => ({
    id: d.id,
    title: d.title,
    category: d.category,
    donor: d.donor ?? null,
    beneficiary: d.beneficiary ?? null,
    guardian: d.guardian ?? null,
    mandate: d.mandate ?? null,
    identity_kind: d.identity_kind ?? "",
    original_filename: d.original_filename ?? null,
    created_at: d.created_at,
  }));
}

function formatBirthDate(value: string | null): string | null {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function DocsBadge({ ready, total }: { ready: number; total: number }) {
  if (ready >= total) {
    return (
      <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-800">
        Pièces {ready}/{total}
      </span>
    );
  }
  return (
    <span className="rounded-full bg-[var(--sf-cream)] px-2 py-0.5 text-[10px] font-medium text-[var(--sf-green)]/45">
      Pièces {ready}/{total}
    </span>
  );
}

function BeneficiaryCard({
  beneficiary,
  guardian,
  caseId,
  documents,
  onDocumentsChange,
  onEdit,
  readOnly = false,
}: {
  beneficiary: Beneficiary;
  guardian?: Guardian;
  caseId: number;
  documents: CaseDocumentItem[];
  onDocumentsChange: () => void;
  onEdit: () => void;
  readOnly?: boolean;
}) {
  const benDocs = filterIdentityDocuments(documents, "beneficiary", beneficiary.id);
  const totalKinds = 4;

  const ageLabel = computePersonAge(beneficiary.date_of_birth);

  const infoRows: { label: string; value: string }[] = [
    { label: "Lien donateur", value: beneficiary.relation_to_donor_label || "—" },
  ];
  if (beneficiary.donor_name) {
    infoRows.push({ label: "Donateur", value: beneficiary.donor_name });
  }
  if (ageLabel) {
    infoRows.push({ label: "Âge", value: ageLabel });
  }
  if (beneficiary.date_of_birth) {
    infoRows.push({
      label: "Naissance",
      value: formatBirthDate(beneficiary.date_of_birth) ?? beneficiary.date_of_birth,
    });
  }
  if (beneficiary.nationality) {
    infoRows.push({ label: "Nationalité", value: beneficiary.nationality });
  }
  if (beneficiary.identification_number) {
    infoRows.push({ label: "N° pièce", value: beneficiary.identification_number });
  }
  const shareLabel = formatSharePercent(beneficiary.patrimony_share_percent);
  const currency = beneficiary.case_patrimony_currency ?? "XOF";
  if (shareLabel) {
    infoRows.push({ label: "Part patrimoine", value: shareLabel });
    if (beneficiary.patrimony_share_value && beneficiary.case_patrimony_total) {
      const totalNum = Number(beneficiary.case_patrimony_total);
      infoRows.push({
        label: "Valeur de la part",
        value: `${formatMoney(beneficiary.patrimony_share_value)} ${currency}`,
      });
      infoRows.push({
        label: "Patrimoine dossier",
        value: `${formatMoney(beneficiary.case_patrimony_total)} ${currency}`,
      });
      if (!Number.isNaN(totalNum) && totalNum > 0) {
        const pct = Number(beneficiary.patrimony_share_percent);
        if (!Number.isNaN(pct)) {
          infoRows.push({
            label: "Rapport",
            value: `${formatSharePercent(String(pct))} du patrimoine total`,
          });
        }
      }
    } else {
      infoRows.push({
        label: "Valeur de la part",
        value: "En attente (valorisez le patrimoine du dossier)",
      });
    }
  }

  const guardianRows: { label: string; value: string }[] = [];
  if (beneficiary.guardian_name || guardian) {
    guardianRows.push({
      label: "Nom",
      value:
        beneficiary.guardian_name ??
        `${guardian?.first_name ?? ""} ${guardian?.last_name ?? ""}`.trim(),
    });
  }
  if (guardian?.relationship_label) {
    guardianRows.push({ label: "Lien", value: guardian.relationship_label });
  }
  if (guardian?.phone) {
    guardianRows.push({ label: "Téléphone", value: guardian.phone });
  }
  if (guardian?.email) {
    guardianRows.push({ label: "E-mail", value: guardian.email });
  }

  return (
    <article className="rounded-xl border border-[var(--sf-cream-dark)] bg-white p-3 shadow-sm sm:p-4">
      <div className="grid gap-3 lg:grid-cols-[1fr_minmax(240px,340px)] lg:items-start lg:gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-1.5">
              {ageLabel ? (
                <span className="rounded-full bg-[var(--sf-green-deep)]/10 px-2 py-0.5 text-[10px] font-semibold text-[var(--sf-green-deep)]">
                  {ageLabel}
                </span>
              ) : null}
              {beneficiary.is_minor ? (
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-900">
                  Mineur
                </span>
              ) : null}
              <DocsBadge ready={benDocs.length} total={totalKinds} />
            </div>
            {!readOnly ? (
              <button
                type="button"
                onClick={onEdit}
                className="text-xs font-medium text-[var(--sf-green-mid)] hover:underline"
              >
                Modifier
              </button>
            ) : null}
          </div>
          <h3 className="mt-1.5 text-sm font-semibold text-[var(--sf-green-deep)] sm:text-base">
            {beneficiary.first_name} {beneficiary.last_name}
          </h3>
          <dl className="mt-2 grid gap-1.5 sm:grid-cols-2">
            {infoRows.map((row) => (
              <div key={row.label} className="rounded-md bg-[var(--sf-cream)]/40 px-2 py-1.5">
                <dt className="text-[10px] font-medium uppercase tracking-wide text-[var(--sf-green)]/45">
                  {row.label}
                </dt>
                <dd className="text-xs font-medium text-[var(--sf-green-deep)]">{row.value}</dd>
              </div>
            ))}
          </dl>
          <div className="mt-2 rounded-md border border-[var(--sf-cream-dark)]/80 bg-[var(--sf-cream)]/30 px-2.5 py-2">
            <p className="text-[10px] font-medium uppercase tracking-wide text-[var(--sf-green)]/45">
              Situation de la personne
            </p>
            {beneficiary.notes?.trim() ? (
              <p className="mt-1 whitespace-pre-wrap text-xs leading-relaxed text-[var(--sf-green-deep)]">
                {beneficiary.notes.trim()}
              </p>
            ) : (
              <p className="mt-1 text-xs italic text-[var(--sf-green)]/45">
                Non renseignée — utilisez Modifier pour décrire le contexte.
              </p>
            )}
          </div>
          {guardianRows.length > 0 ? (
            <div className="mt-2 rounded-md border border-amber-200/60 bg-amber-50/40 px-2.5 py-2">
              <p className="text-[10px] font-medium uppercase tracking-wide text-amber-900/70">
                Tuteur
              </p>
              <dl className="mt-1.5 grid gap-1 sm:grid-cols-2">
                {guardianRows.map((row) => (
                  <div key={row.label}>
                    <dt className="text-[10px] text-amber-900/55">{row.label}</dt>
                    <dd className="text-xs font-medium text-amber-950">{row.value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          ) : beneficiary.is_minor ? (
            <p className="mt-2 rounded-md border border-dashed border-amber-200/80 bg-amber-50/50 px-2 py-1.5 text-[10px] text-amber-900/80">
              Tuteur non renseigné
            </p>
          ) : null}
        </div>
        <div className="space-y-2.5">
          <PersonIdentityUploads
            caseId={caseId}
            subject="beneficiary"
            entityId={beneficiary.id}
            firstName={beneficiary.first_name}
            lastName={beneficiary.last_name}
            documents={documents}
            onUploaded={onDocumentsChange}
            title="Pièces héritier"
            compact
            readOnly
          />
          {guardian ? (
            <PersonIdentityUploads
              caseId={caseId}
              subject="guardian"
              entityId={guardian.id}
              firstName={guardian.first_name}
              lastName={guardian.last_name}
              documents={documents}
              onUploaded={onDocumentsChange}
              title="Pièces tuteur"
              compact
              readOnly
            />
          ) : null}
        </div>
      </div>
    </article>
  );
}

export function CaseBeneficiariesHub({
  readOnly: readOnlyProp,
  successionView = false,
}: {
  readOnly?: boolean;
  successionView?: boolean;
} = {}) {
  const { user } = useAuth();
  const { data, caseId, reload } = useCaseDetail();
  const readOnly = readOnlyProp ?? userIsCaseReadOnly(user, data?.status);
  const numericCaseId = caseId ? Number(caseId) : null;
  const [documents, setDocuments] = useState<CaseDocumentItem[]>([]);
  const [form, setForm] = useState<BeneficiaryFormState>(emptyBeneficiaryForm());
  const [pendingBenDocs, setPendingBenDocs] = useState<PendingIdentityFiles>({});
  const [pendingGuardDocs, setPendingGuardDocs] = useState<PendingIdentityFiles>({});
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showNewForm, setShowNewForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const primaryDonor = data?.donors[0] ?? null;
  const requireGuardian = form.is_minor;

  const reloadDocuments = useCallback(async () => {
    if (!numericCaseId) return;
    const docs = await fetchCaseDocuments(numericCaseId);
    setDocuments(docs);
  }, [numericCaseId]);

  useEffect(() => {
    if (data?.documents?.length) {
      setDocuments(mapDocuments(data.documents));
      return;
    }
    void reloadDocuments();
  }, [data?.documents, reloadDocuments]);

  const guardiansById = useMemo(() => {
    const map = new Map<number, Guardian>();
    if (!data) return map;
    for (const g of data.guardians) map.set(g.id, g);
    return map;
  }, [data]);

  const stats = useMemo(() => {
    if (!data) return { total: 0, minors: 0 };
    return {
      total: data.beneficiaries.length,
      minors: data.beneficiaries.filter((b) => b.is_minor).length,
    };
  }, [data]);

  const casePatrimony = useMemo(
    () => (data ? computeCasePatrimonyFromAssets(data.assets) : null),
    [data],
  );

  if (!data || !numericCaseId) return null;

  async function addBeneficiary() {
    if (!numericCaseId) return;
    if (
      !beneficiaryFormValid(form, requireGuardian, data!.guardians)
    ) {
      return;
    }
    setAdding(true);
    setError(null);
    try {
      const body = buildBeneficiaryRequestBody(
        form,
        primaryDonor?.id ?? null,
        requireGuardian,
      );
      const created = await apiRequest<Beneficiary>(`/cases/${numericCaseId}/beneficiaries/`, {
        method: "POST",
        body: JSON.stringify(body),
      });

      await uploadPendingIdentityDocuments(
        numericCaseId,
        "beneficiary",
        created.id,
        created.first_name,
        created.last_name,
        pendingBenDocs,
      );

      const guardianId =
        created.guardian ??
        (form.guardian_mode === "existing" && form.guardian_id
          ? Number(form.guardian_id)
          : null);

      if (guardianId && Object.keys(pendingGuardDocs).length > 0) {
        const g =
          guardiansById.get(guardianId) ??
          (form.guardian_mode === "new"
            ? {
                id: guardianId,
                first_name: form.guardian_first_name,
                last_name: form.guardian_last_name,
                relationship_label: form.guardian_relationship_label,
                email: form.guardian_email,
                phone: form.guardian_phone,
              }
            : undefined);
        if (g) {
          await uploadPendingIdentityDocuments(
            numericCaseId,
            "guardian",
            guardianId,
            g.first_name,
            g.last_name,
            pendingGuardDocs,
          );
        }
      }

      await reload();
      await reloadDocuments();
      cancelForm();
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Erreur lors de l'ajout de l'héritier.",
      );
    } finally {
      setAdding(false);
    }
  }

  function openNewForm() {
    setEditingId(null);
    setForm(emptyBeneficiaryForm());
    setPendingBenDocs({});
    setPendingGuardDocs({});
    setError(null);
    setShowNewForm(true);
  }

  function openEditForm(beneficiary: Beneficiary) {
    const guardian = beneficiary.guardian
      ? guardiansById.get(beneficiary.guardian)
      : undefined;
    setEditingId(beneficiary.id);
    setForm(beneficiaryToFormState(beneficiary, guardian));
    setPendingBenDocs({});
    setPendingGuardDocs({});
    setError(null);
    setShowNewForm(true);
  }

  function cancelForm() {
    setForm(emptyBeneficiaryForm());
    setPendingBenDocs({});
    setPendingGuardDocs({});
    setShowNewForm(false);
    setEditingId(null);
    setError(null);
    setPasswordModalOpen(false);
    setPasswordError(null);
  }

  async function updateBeneficiary() {
    if (!editingId) return;
    if (!beneficiaryFormValid(form, requireGuardian, data!.guardians)) return;

    setAdding(true);
    setError(null);
    try {
      let guardianId: number | null =
        form.guardian_mode === "existing" && form.guardian_id
          ? Number(form.guardian_id)
          : null;

      if (form.is_minor && form.guardian_mode === "new") {
        const createdGuardian = await apiRequest<Guardian>(
          `/cases/${numericCaseId}/guardians/`,
          {
            method: "POST",
            body: JSON.stringify({
              first_name: form.guardian_first_name.trim(),
              last_name: form.guardian_last_name.trim(),
              relationship_label: form.guardian_relationship_label.trim(),
              email: form.guardian_email.trim(),
              phone: form.guardian_phone.trim(),
            }),
          },
        );
        guardianId = createdGuardian.id;
        if (Object.keys(pendingGuardDocs).length > 0) {
          await uploadPendingIdentityDocuments(
            numericCaseId!,
            "guardian",
            createdGuardian.id,
            createdGuardian.first_name,
            createdGuardian.last_name,
            pendingGuardDocs,
          );
        }
      }

      const body = buildBeneficiaryUpdateBody(
        form,
        primaryDonor?.id ?? null,
        requireGuardian,
      );
      if (form.is_minor && guardianId) {
        body.guardian_id = guardianId;
      }

      await apiRequest<Beneficiary>(`/beneficiaries/${editingId}/`, {
        method: "PATCH",
        body: JSON.stringify(body),
      });

      await reload();
      await reloadDocuments();
      cancelForm();
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Erreur lors de la modification de l'héritier.",
      );
    } finally {
      setAdding(false);
    }
  }

  function requestSave() {
    if (!data || !beneficiaryFormValid(form, requireGuardian, data.guardians)) return;
    if (editingId) {
      setPasswordError(null);
      setPasswordModalOpen(true);
      return;
    }
    void addBeneficiary();
  }

  async function confirmPasswordAndSave(password: string) {
    setPasswordBusy(true);
    setPasswordError(null);
    try {
      await verifyPassword(password);
      setPasswordModalOpen(false);
      await updateBeneficiary();
    } catch (err) {
      setPasswordError(
        err instanceof ApiError
          ? err.message
          : "Mot de passe incorrect ou erreur de vérification.",
      );
    } finally {
      setPasswordBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold text-[var(--sf-green-deep)]">
          {successionView ? "Informations" : "Héritiers / bénéficiaires"}
          {stats.total > 0 ? (
            <span className="ml-2 text-xs font-normal text-[var(--sf-green)]/50">
              {stats.total}
              {stats.minors > 0 ? ` · ${stats.minors} mineur${stats.minors > 1 ? "s" : ""}` : ""}
            </span>
          ) : null}
        </h2>
        {!readOnly && !showNewForm ? (
          <button type="button" onClick={openNewForm} className="sf-btn-primary shrink-0 text-sm">
            + Nouvel héritier
          </button>
        ) : null}
      </div>

      {error ? <ErrorAlert message={error} /> : null}

      {!showNewForm && data.beneficiaries.length > 0 ? (
        <ul className="space-y-2.5">
          {data.beneficiaries.map((b) => (
            <li key={b.id}>
              <BeneficiaryCard
                beneficiary={b}
                guardian={b.guardian ? guardiansById.get(b.guardian) : undefined}
                caseId={numericCaseId}
                documents={documents}
                onDocumentsChange={() => void reloadDocuments()}
                onEdit={() => openEditForm(b)}
                readOnly={readOnly}
              />
            </li>
          ))}
        </ul>
      ) : null}

      {!showNewForm && data.beneficiaries.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--sf-cream-dark)] bg-[var(--sf-cream)]/25 px-4 py-6 text-center">
          <p className="text-sm font-medium text-[var(--sf-green-deep)]">Aucun héritier</p>
          <p className="mt-1 text-xs text-[var(--sf-green)]/50">
            {readOnly ? (
              <>
                Aucun membre enregistré. Utilisez l&apos;assistant d&apos;enregistrement pour
                compléter la famille.
              </>
            ) : (
              <>
                Cliquez sur <strong>+ Nouvel héritier</strong> pour ouvrir le formulaire.
              </>
            )}
          </p>
          {!readOnly ? (
            <button type="button" onClick={openNewForm} className="mt-3 sf-btn-primary text-sm">
              + Nouvel héritier
            </button>
          ) : null}
        </div>
      ) : null}

      {!readOnly && showNewForm ? (
        <section className="rounded-xl border border-[var(--sf-green-mid)]/20 bg-white shadow-sm">
          <div className="flex items-center justify-between gap-2 border-b border-[var(--sf-cream-dark)] px-3 py-2.5 sm:px-4">
            <h3 className="text-sm font-semibold text-[var(--sf-green-deep)]">
              {editingId ? "Modifier l'héritier" : "Nouvel héritier"}
            </h3>
            <button
              type="button"
              onClick={cancelForm}
              className="text-xs font-medium text-[var(--sf-green-mid)] hover:underline"
            >
              Fermer
            </button>
          </div>
          <div className="p-3 sm:p-4">
            <StepBeneficiary
              variant="embed"
              form={form}
              onChange={setForm}
              existing={[]}
              existingGuardians={data.guardians}
              donor={primaryDonor}
              requireGuardian={requireGuardian}
              caseId={numericCaseId}
              documents={documents}
              onDocumentsChange={() => void reloadDocuments()}
              deferNewBeneficiaryUpload={!editingId}
              editingBeneficiaryId={editingId}
              pendingBeneficiaryFiles={pendingBenDocs}
              onPendingBeneficiaryFilesChange={setPendingBenDocs}
              pendingGuardianFiles={pendingGuardDocs}
              onPendingGuardianFilesChange={setPendingGuardDocs}
              casePatrimonyTotal={casePatrimony?.total ?? null}
              casePatrimonyCurrency={casePatrimony?.currency ?? "XOF"}
            />
          </div>
          <div className="flex flex-wrap justify-end gap-2 border-t border-[var(--sf-cream-dark)] px-3 py-2.5 sm:px-4">
            <button
              type="button"
              disabled={adding}
              onClick={cancelForm}
              className="sf-btn-secondary text-sm"
            >
              Annuler
            </button>
            <button
              type="button"
              disabled={
                adding ||
                !beneficiaryFormValid(form, requireGuardian, data.guardians)
              }
              onClick={() => requestSave()}
              className="sf-btn-primary text-sm"
            >
              {adding
                ? "Enregistrement…"
                : editingId
                  ? "Enregistrer les modifications"
                  : "Enregistrer l'héritier"}
            </button>
          </div>
        </section>
      ) : null}

      <PasswordConfirmModal
        open={passwordModalOpen}
        title="Confirmer la modification"
        description="Saisissez votre mot de passe pour enregistrer les changements sur cet héritier."
        confirmLabel="Enregistrer"
        busy={passwordBusy || adding}
        error={passwordError}
        onClose={() => {
          if (!passwordBusy && !adding) {
            setPasswordModalOpen(false);
            setPasswordError(null);
          }
        }}
        onConfirm={confirmPasswordAndSave}
      />

      {readOnly || successionView ? (
        <p className="text-center text-[11px] text-[var(--sf-green)]/40">
          <Link
            href={`/dossiers/${caseId}/enregistrement?step=beneficiaries`}
            className="font-medium text-[var(--sf-green-mid)] hover:underline"
          >
            Modifier via l&apos;assistant d&apos;enregistrement
          </Link>
        </p>
      ) : (
        <p className="text-center text-[11px] text-[var(--sf-green)]/40">
          <Link
            href={`/dossiers/${caseId}/enregistrement?step=beneficiaries`}
            className="font-medium text-[var(--sf-green-mid)] hover:underline"
          >
            Assistant d&apos;enregistrement
          </Link>
        </p>
      )}
    </div>
  );
}
