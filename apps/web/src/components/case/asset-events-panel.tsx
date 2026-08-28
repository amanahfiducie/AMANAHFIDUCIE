"use client";

import { useCallback, useEffect, useId, useMemo, useState, type ReactNode } from "react";

import { PatrimoineSection } from "@/components/case/patrimoine-layout";
import { PasswordConfirmModal } from "@/components/ui/password-confirm-modal";
import { ErrorAlert } from "@/components/ui/error-alert";
import { AssetEventPdfPreviewModal } from "@/components/ui/asset-event-pdf-preview-modal";
import { ApiError, apiRequest, verifyPassword } from "@/lib/api";
import {
  appendAssetEventFields,
  isPdfFile,
  type AssetEventFormFields,
} from "@/lib/asset-event-form";
import {
  categoriesForType,
  categoryFixedAmount,
  eventMatchesCategory,
  eventTypeLabel,
  isFixedCategory,
} from "@/lib/asset-event-categories";
import { EXPENSE_KIND_LABELS, formatDate, formatMoney } from "@/lib/labels";
import { userIsCaseReadOnly } from "@/lib/role-access";
import { useAuth } from "@/providers/auth-provider";
import { useOptionalCaseDetail } from "@/providers/case-detail-provider";
import type { AssetEvent, AssetEventCategory, AssetEventType } from "@/types/api";

type EventFormState = AssetEventFormFields;

type ModalMode = "add" | "view" | "edit";

function emptyFormForCategory(category: AssetEventCategory): EventFormState {
  const base: EventFormState = {
    reference: "OTHER",
    title: category.event_type === "OTHER" ? category.name : "",
    description: "",
    amount: isFixedCategory(category) ? categoryFixedAmount(category) : "",
    event_date: "",
    expense_kind: category.billing_kind,
  };
  return base;
}

const EMPTY_FORM: EventFormState = {
  reference: "RENT",
  title: "",
  description: "",
  amount: "",
  event_date: "",
  expense_kind: "FIXED",
};

function eventToForm(event: AssetEvent): EventFormState {
  return {
    reference: event.reference ?? "RENT",
    title: event.title ?? "",
    description: event.description ?? "",
    amount: event.amount ?? "",
    event_date: event.event_date ?? "",
    expense_kind: event.expense_kind ?? "FIXED",
  };
}

function buildEventFormData(
  type: AssetEventType,
  form: EventFormState,
  pdfFile: File,
  extra?: { password?: string; categoryId?: number },
): FormData {
  const body = new FormData();
  appendAssetEventFields(body, type, form, {
    categoryId: extra?.categoryId,
  });
  body.append("justification_file", pdfFile);
  if (extra?.password) body.append("password", extra.password);
  return body;
}

function formValid(
  category: AssetEventCategory | null,
  form: EventFormState,
  hasJustificationPdf: boolean,
  mode: ModalMode,
): boolean {
  if (!hasJustificationPdf || !form.event_date) return false;
  if (mode === "add" && !category) return false;
  if (category && isFixedCategory(category)) {
    return Boolean(category.default_amount);
  }
  return Boolean(form.amount);
}

function JustificationPdfField({
  pendingFile,
  existingFilename,
  readOnly,
  onFileChange,
  onPreview,
}: {
  pendingFile: File | null;
  existingFilename: string | null;
  readOnly?: boolean;
  onFileChange: (file: File | null) => void;
  onPreview?: () => void;
}) {
  const label = pendingFile?.name ?? existingFilename;

  return (
    <div className="sm:col-span-2">
      <label className="block text-xs font-medium text-[var(--sf-green)]/55">
        Justificatif (PDF) *
      </label>
      {readOnly ? (
        <div className="mt-1.5 flex flex-wrap items-center gap-2">
          {label ? (
            <span className="text-sm text-[var(--sf-green-deep)]">{label}</span>
          ) : (
            <span className="text-sm text-[var(--sf-green)]/45">Aucun fichier</span>
          )}
          {onPreview && existingFilename ? (
            <button
              type="button"
              onClick={onPreview}
              className="text-xs font-medium text-[var(--sf-green-mid)] hover:underline"
            >
              Voir le PDF
            </button>
          ) : null}
        </div>
      ) : (
        <div className="mt-1.5 space-y-2">
          {label ? (
            <p className="text-xs text-[var(--sf-green)]/55">
              Fichier : <span className="font-medium text-[var(--sf-green-deep)]">{label}</span>
            </p>
          ) : null}
          <input
            type="file"
            accept="application/pdf,.pdf"
            className="block w-full text-xs text-[var(--sf-green)]/70 file:mr-3 file:rounded-md file:border-0 file:bg-[var(--sf-cream)] file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-[var(--sf-green-deep)]"
            onChange={(e) => {
              const file = e.target.files?.[0] ?? null;
              if (file && !isPdfFile(file)) {
                onFileChange(null);
                e.target.value = "";
                return;
              }
              onFileChange(file);
            }}
          />
          <p className="text-[10px] text-[var(--sf-green)]/45">Format accepté : PDF uniquement.</p>
        </div>
      )}
    </div>
  );
}

function eventTitle(event: AssetEvent): string {
  if (event.category_name) return event.category_name;
  if (event.event_type === "OTHER") return event.title || "Autre";
  return eventTypeLabel(event.event_type);
}

function EventFormFields({
  category,
  form,
  onChange,
  readOnly,
  mode,
  pendingPdf,
  existingPdfFilename,
  onPdfChange,
  onPreviewPdf,
}: {
  category: AssetEventCategory | null;
  form: EventFormState;
  onChange: (f: EventFormState) => void;
  readOnly?: boolean;
  mode: ModalMode;
  pendingPdf: File | null;
  existingPdfFilename: string | null;
  onPdfChange: (file: File | null) => void;
  onPreviewPdf?: () => void;
}) {
  const ro = readOnly ? "pointer-events-none opacity-90" : "";
  const fixed = category ? isFixedCategory(category) : false;

  const field = (label: string, node: ReactNode) => (
    <div>
      <label className="block text-xs font-medium text-[var(--sf-green)]/55">{label}</label>
      <div className={`mt-1 ${ro}`}>{node}</div>
    </div>
  );

  return (
    <div className="space-y-4">
      {category && mode === "add" ? (
        <div className="rounded-lg bg-[var(--sf-cream)]/40 px-3 py-2.5 text-sm">
          <p className="font-medium text-[var(--sf-green-deep)]">{category.name}</p>
          <p className="mt-0.5 text-xs text-[var(--sf-green)]/55">
            {EXPENSE_KIND_LABELS[category.billing_kind] ?? category.billing_kind}
            {category.description ? ` · ${category.description}` : ""}
          </p>
        </div>
      ) : null}

      <div className={`grid gap-3 sm:grid-cols-2 ${ro}`}>
        {field(
          "Date *",
          <input
            type="date"
            readOnly={readOnly}
            value={form.event_date}
            onChange={(e) => onChange({ ...form, event_date: e.target.value })}
            className="sf-input w-full"
          />,
        )}
        {field(
          fixed ? "Montant (automatique)" : "Somme (FCFA) *",
          <input
            type="number"
            readOnly={fixed || readOnly}
            min="0"
            value={form.amount}
            onChange={(e) => onChange({ ...form, amount: e.target.value })}
            className={`sf-input w-full ${fixed ? "bg-[var(--sf-cream)]/50" : ""}`}
          />,
        )}
      </div>

      <JustificationPdfField
        pendingFile={pendingPdf}
        existingFilename={existingPdfFilename}
        readOnly={readOnly}
        onFileChange={onPdfChange}
        onPreview={onPreviewPdf}
      />

      {fixed && mode === "add" ? (
        <p className="text-xs text-[var(--sf-green)]/50">
          Catégorie fixe : renseignez la date et joignez le justificatif PDF pour valider.
        </p>
      ) : null}
    </div>
  );
}

function EventModal({
  open,
  mode,
  eventType,
  category,
  event,
  form,
  onFormChange,
  pendingPdf,
  existingPdfFilename,
  onPdfChange,
  onPreviewPdf,
  busy,
  error,
  onClose,
  onStartEdit,
  onSaveAdd,
  onSaveEdit,
  onRequestCancel,
  readOnly = false,
}: {
  open: boolean;
  mode: ModalMode;
  eventType: AssetEventType;
  category: AssetEventCategory | null;
  event: AssetEvent | null;
  form: EventFormState;
  onFormChange: (f: EventFormState) => void;
  pendingPdf: File | null;
  existingPdfFilename: string | null;
  onPdfChange: (file: File | null) => void;
  onPreviewPdf?: () => void;
  busy: boolean;
  error: string | null;
  onClose: () => void;
  onStartEdit: () => void;
  onSaveAdd: () => void;
  onSaveEdit: () => void;
  onRequestCancel: () => void;
  readOnly?: boolean;
}) {
  const titleId = useId();
  if (!open) return null;

  const hasPdf = Boolean(pendingPdf || existingPdfFilename);
  const typeLabel = eventTypeLabel(eventType);
  const title =
    mode === "add"
      ? `Nouvel événement — ${typeLabel}`
      : mode === "edit"
        ? `Modifier — ${eventTitle(event!)}`
        : eventTitle(event!);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-[var(--sf-cream-dark)] bg-white p-5 shadow-xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <h2 id={titleId} className="text-base font-semibold text-[var(--sf-green-deep)]">
          {title}
        </h2>
        {event?.status === "CANCELLED" ? (
          <p className="mt-1 text-xs text-red-800">Événement annulé</p>
        ) : null}

        {mode === "view" && onPreviewPdf ? (
          <button
            type="button"
            onClick={onPreviewPdf}
            className="mt-3 w-full rounded-lg border border-[var(--sf-cream-dark)] bg-[var(--sf-cream)]/40 px-3 py-2.5 text-sm font-medium text-[var(--sf-green-deep)] hover:bg-[var(--sf-cream)]/70"
          >
            Aperçu du justificatif PDF
          </button>
        ) : null}

        <div className="mt-4">
          <EventFormFields
            category={category}
            form={form}
            onChange={onFormChange}
            readOnly={mode === "view"}
            mode={mode}
            pendingPdf={pendingPdf}
            existingPdfFilename={existingPdfFilename}
            onPdfChange={onPdfChange}
            onPreviewPdf={onPreviewPdf}
          />
        </div>

        {error ? (
          <div className="mt-3">
            <ErrorAlert message={error} />
          </div>
        ) : null}

        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={onClose}
            className="sf-btn-secondary text-sm"
          >
            Fermer
          </button>
          {mode === "view" && event?.status === "ACTIVE" && !readOnly ? (
            <>
              <button
                type="button"
                disabled={busy}
                onClick={onRequestCancel}
                className="text-sm font-medium text-red-800 hover:underline"
              >
                Annuler l&apos;événement
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={onStartEdit}
                className="sf-btn-primary text-sm"
              >
                Modifier
              </button>
            </>
          ) : null}
          {mode === "add" ? (
            <button
              type="button"
              disabled={busy || !formValid(category, form, hasPdf, mode)}
              onClick={onSaveAdd}
              className="sf-btn-primary text-sm"
            >
              {busy ? "Enregistrement…" : "Enregistrer"}
            </button>
          ) : null}
          {mode === "edit" ? (
            <button
              type="button"
              disabled={busy || !formValid(category, form, hasPdf, mode)}
              onClick={onSaveEdit}
              className="sf-btn-primary text-sm"
            >
              {busy ? "Enregistrement…" : "Enregistrer (mot de passe)"}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function CategoryAddModal({
  open,
  eventType,
  busy,
  error,
  onClose,
  onSubmit,
}: {
  open: boolean;
  eventType: AssetEventType;
  busy: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: (
    name: string,
    description: string,
    billingKind: "FIXED" | "VARIABLE",
    defaultAmount: string,
  ) => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [billingKind, setBillingKind] = useState<"FIXED" | "VARIABLE">("VARIABLE");
  const [defaultAmount, setDefaultAmount] = useState("");
  const titleId = useId();

  useEffect(() => {
    if (open) {
      setName("");
      setDescription("");
      setBillingKind("VARIABLE");
      setDefaultAmount("");
    }
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="w-full max-w-md rounded-xl border border-[var(--sf-cream-dark)] bg-white p-5 shadow-xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <h2 id={titleId} className="text-base font-semibold text-[var(--sf-green-deep)]">
          Nouvelle catégorie — {eventTypeLabel(eventType)}
        </h2>
        <div className="mt-4 space-y-3">
          <div>
            <label className="block text-xs font-medium text-[var(--sf-green)]/55">
              Nom *
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="sf-input mt-1 w-full"
              placeholder="Ex. Entretien annuel"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[var(--sf-green)]/55">
              Description
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="sf-input mt-1 w-full resize-y"
              placeholder="Précisez le type d’opérations attendues…"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[var(--sf-green)]/55">
              Nature *
            </label>
            <select
              value={billingKind}
              onChange={(e) =>
                setBillingKind(e.target.value as "FIXED" | "VARIABLE")
              }
              className="sf-input mt-1 w-full"
            >
              <option value="FIXED">Fixe (montant automatique)</option>
              <option value="VARIABLE">Variable (montant à chaque saisie)</option>
            </select>
          </div>
          {billingKind === "FIXED" ? (
            <div>
              <label className="block text-xs font-medium text-[var(--sf-green)]/55">
                Montant fixe (FCFA) *
              </label>
              <input
                type="number"
                min="0"
                value={defaultAmount}
                onChange={(e) => setDefaultAmount(e.target.value)}
                className="sf-input mt-1 w-full"
              />
            </div>
          ) : null}
        </div>
        {error ? (
          <div className="mt-3">
            <ErrorAlert message={error} />
          </div>
        ) : null}
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" disabled={busy} onClick={onClose} className="sf-btn-secondary text-sm">
            Annuler
          </button>
          <button
            type="button"
            disabled={
              busy ||
              !name.trim() ||
              (billingKind === "FIXED" && !defaultAmount.trim())
            }
            onClick={() =>
              onSubmit(name.trim(), description.trim(), billingKind, defaultAmount.trim())
            }
            className="sf-btn-primary text-sm"
          >
            {busy ? "Création…" : "Créer la catégorie"}
          </button>
        </div>
      </div>
    </div>
  );
}

function countEventsInCategory(events: AssetEvent[], category: AssetEventCategory): number {
  return events.filter((e) => eventMatchesCategory(e, category)).length;
}

export function AssetEventsPanel({
  assetId,
  eventType,
  events: initialEvents,
  onChanged,
}: {
  assetId: number;
  eventType: AssetEventType;
  events: AssetEvent[];
  onChanged: () => void;
}) {
  const { user } = useAuth();
  const caseDetail = useOptionalCaseDetail();
  const readOnly = userIsCaseReadOnly(user, caseDetail?.data?.status);
  const [events, setEvents] = useState(initialEvents);
  const [categories, setCategories] = useState<AssetEventCategory[]>([]);
  const [activeCategory, setActiveCategory] = useState<AssetEventCategory | null>(null);
  const [filterQuery, setFilterQuery] = useState("");
  const [showCancelled, setShowCancelled] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<ModalMode>("add");
  const [modalType, setModalType] = useState<AssetEventType>("GAIN");
  const [addCategoryOpen, setAddCategoryOpen] = useState(false);
  const [addCategoryBusy, setAddCategoryBusy] = useState(false);
  const [addCategoryError, setAddCategoryError] = useState<string | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<AssetEvent | null>(null);
  const [form, setForm] = useState<EventFormState>({ ...EMPTY_FORM, reference: "RENT" });
  const [addCategoryId, setAddCategoryId] = useState<number | undefined>(undefined);
  const [pendingPdf, setPendingPdf] = useState<File | null>(null);
  const [pdfPreviewOpen, setPdfPreviewOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [passwordOpen, setPasswordOpen] = useState(false);
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<
    { kind: "update" } | { kind: "cancel"; eventId: number } | null
  >(null);

  const visibleEvents = useMemo(() => {
    const list = showCancelled
      ? events
      : events.filter((e) => e.status !== "CANCELLED");
    return [...list].sort((a, b) =>
      (b.event_date ?? b.created_at).localeCompare(a.event_date ?? a.created_at),
    );
  }, [events, showCancelled]);

  const typeCategories = useMemo(
    () => categoriesForType(categories, eventType),
    [categories, eventType],
  );

  const typeEvents = useMemo(
    () => visibleEvents.filter((e) => e.event_type === eventType),
    [visibleEvents, eventType],
  );

  useEffect(() => {
    setEvents(initialEvents);
  }, [initialEvents]);

  const loadCategories = useCallback(async () => {
    const list = await apiRequest<AssetEventCategory[]>(
      `/assets/${assetId}/event-categories/`,
    );
    setCategories(list);
  }, [assetId]);

  useEffect(() => {
    void loadCategories();
  }, [loadCategories]);

  useEffect(() => {
    if (typeCategories.length === 0) {
      setActiveCategory(null);
      return;
    }
    if (!activeCategory || activeCategory.event_type !== eventType) {
      setActiveCategory(typeCategories[0]!);
      return;
    }
    const still = typeCategories.find((c) => c.id === activeCategory.id);
    if (!still) setActiveCategory(typeCategories[0]!);
  }, [eventType, typeCategories, activeCategory]);

  const refreshEvents = useCallback(async () => {
    const list = await apiRequest<AssetEvent[]>(
      `/assets/${assetId}/events/?include_cancelled=1`,
    );
    setEvents(list);
    onChanged();
  }, [assetId, onChanged]);

  const filteredEvents = useMemo(() => {
    if (!activeCategory) return [];
    const q = filterQuery.trim().toLowerCase();
    return visibleEvents.filter((event) => {
      if (!eventMatchesCategory(event, activeCategory)) return false;
      if (!q) return true;
      const hay = [
        eventTitle(event),
        event.description,
        event.event_date ? formatDate(event.event_date) : "",
        event.amount ? formatMoney(event.amount, event.currency) : "",
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [visibleEvents, activeCategory, filterQuery]);

  function closeModal() {
    setModalOpen(false);
    setSelectedEvent(null);
    setPendingPdf(null);
    setAddCategoryId(undefined);
    setError(null);
    setModalMode("add");
  }

  function openAdd() {
    if (!activeCategory) return;
    setModalType(eventType);
    setModalMode("add");
    setSelectedEvent(null);
    setForm(emptyFormForCategory(activeCategory));
    setAddCategoryId(activeCategory.id);
    setPendingPdf(null);
    setError(null);
    setModalOpen(true);
  }

  function openView(event: AssetEvent) {
    setModalType(event.event_type);
    setSelectedEvent(event);
    setForm(eventToForm(event));
    setPendingPdf(null);
    setModalMode("view");
    setError(null);
    setModalOpen(true);
  }

  function openPdfPreview(event: AssetEvent) {
    setSelectedEvent(event);
    setPdfPreviewOpen(true);
  }

  async function submitNewCategory(
    name: string,
    description: string,
    billingKind: "FIXED" | "VARIABLE",
    defaultAmount: string,
  ) {
    setAddCategoryBusy(true);
    setAddCategoryError(null);
    try {
      const created = await apiRequest<AssetEventCategory>(
        `/assets/${assetId}/event-categories/`,
        {
          method: "POST",
          body: JSON.stringify({
            event_type: eventType,
            name,
            description,
            billing_kind: billingKind,
            default_amount: billingKind === "FIXED" ? defaultAmount : null,
          }),
        },
      );
      await loadCategories();
      setActiveCategory(created);
      setAddCategoryOpen(false);
    } catch (err) {
      setAddCategoryError(
        err instanceof ApiError ? err.message : "Impossible de créer la catégorie.",
      );
    } finally {
      setAddCategoryBusy(false);
    }
  }

  const existingPdfFilename =
    pendingPdf?.name ??
    selectedEvent?.justification_filename ??
    null;

  async function submitAdd() {
    if (!pendingPdf || !formValid(activeCategory, form, true, "add")) return;
    setBusy(true);
    setError(null);
    try {
      const body = buildEventFormData(modalType, form, pendingPdf, {
        categoryId: addCategoryId,
      });
      await apiRequest<AssetEvent>(`/assets/${assetId}/events/`, {
        method: "POST",
        body,
      });
      await refreshEvents();
      closeModal();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Erreur lors de l’ajout.");
    } finally {
      setBusy(false);
    }
  }

  function requestEditSave() {
    const hasPdf = Boolean(pendingPdf || selectedEvent?.has_justification);
    const editCategory =
      activeCategory ??
      (selectedEvent?.category
        ? categories.find((c) => c.id === selectedEvent.category) ?? null
        : null);
    if (!selectedEvent || !formValid(editCategory, form, hasPdf, "edit")) return;
    setPendingAction({ kind: "update" });
    setPasswordError(null);
    setPasswordOpen(true);
  }

  function requestCancelFromModal() {
    if (!selectedEvent) return;
    setPendingAction({ kind: "cancel", eventId: selectedEvent.id });
    setPasswordError(null);
    setPasswordOpen(true);
  }

  async function runPendingAction(password: string) {
    if (!pendingAction) return;
    setPasswordBusy(true);
    setPasswordError(null);
    try {
      await verifyPassword(password);
      if (pendingAction.kind === "update" && selectedEvent) {
        const pdf = pendingPdf;
        if (!pdf && !selectedEvent.has_justification) {
          throw new ApiError(400, {
            justification_file: ["Le justificatif PDF est obligatoire."],
          });
        }
        const body =
          pdf != null
            ? buildEventFormData(modalType, form, pdf, { password })
            : (() => {
                const fd = new FormData();
                appendAssetEventFields(fd, modalType, form);
                fd.append("password", password);
                return fd;
              })();
        await apiRequest<AssetEvent>(
          `/assets/${assetId}/events/${selectedEvent.id}/`,
          {
            method: "PATCH",
            body,
          },
        );
        await refreshEvents();
        closeModal();
      } else if (pendingAction.kind === "cancel") {
        await apiRequest<AssetEvent>(
          `/assets/${assetId}/events/${pendingAction.eventId}/cancel/`,
          {
            method: "POST",
            body: JSON.stringify({ password }),
          },
        );
        await refreshEvents();
        closeModal();
      }
      setPasswordOpen(false);
      setPendingAction(null);
    } catch (err) {
      setPasswordError(
        err instanceof ApiError
          ? err.message
          : "Mot de passe incorrect ou erreur.",
      );
    } finally {
      setPasswordBusy(false);
    }
  }

  return (
    <PatrimoineSection
      title={eventTypeLabel(eventType)}
      description="Créez des catégories (fixe ou variable), puis enregistrez les opérations avec justificatif PDF."
      action={
        <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-[var(--sf-cream-dark)] bg-white px-3 py-1.5 text-xs text-[var(--sf-green)]/60">
          <input
            type="checkbox"
            checked={showCancelled}
            onChange={(e) => setShowCancelled(e.target.checked)}
            className="rounded border-[var(--sf-cream-dark)]"
          />
          Afficher annulés
        </label>
      }
    >
      <div className="flex min-h-[28rem] flex-col overflow-hidden rounded-xl border border-[var(--sf-cream-dark)] bg-white shadow-sm lg:flex-row">
        <aside className="flex w-full shrink-0 flex-col border-b border-[var(--sf-cream-dark)] lg:w-72 lg:border-b-0 lg:border-r">
          <div className="flex items-center justify-between gap-2 border-b border-[var(--sf-cream-dark)] px-3 py-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--sf-green)]/40">
              Catégories
            </p>
            {!readOnly ? (
              <button
                type="button"
                onClick={() => {
                  setAddCategoryError(null);
                  setAddCategoryOpen(true);
                }}
                className="text-[10px] font-semibold text-[var(--sf-green-mid)] hover:underline"
              >
                + Ajouter
              </button>
            ) : null}
          </div>
          <ul className="max-h-[28rem] flex-1 overflow-y-auto p-2 lg:max-h-none">
            {typeCategories.length === 0 ? (
              <li className="px-2 py-8 text-center text-xs text-[var(--sf-green)]/45">
                Aucune catégorie.
                {!readOnly ? (
                  <button
                    type="button"
                    onClick={() => setAddCategoryOpen(true)}
                    className="mt-2 block w-full font-medium text-[var(--sf-green-mid)] hover:underline"
                  >
                    Créer une catégorie
                  </button>
                ) : null}
              </li>
            ) : (
              typeCategories.map((cat) => {
                const count = countEventsInCategory(typeEvents, cat);
                const selected = activeCategory?.id === cat.id;
                return (
                  <li key={cat.id}>
                    <button
                      type="button"
                      onClick={() => setActiveCategory(cat)}
                      className={`mb-1 w-full rounded-lg px-3 py-2.5 text-left transition ${
                        selected
                          ? "bg-[var(--sf-green)]/10 ring-1 ring-[var(--sf-green)]/25"
                          : "hover:bg-[var(--sf-cream)]/40"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-xs font-semibold text-[var(--sf-green-deep)]">
                          {cat.name}
                        </span>
                        <span className="shrink-0 rounded-full bg-white px-1.5 py-0.5 text-[10px] text-[var(--sf-green)]/50 ring-1 ring-[var(--sf-cream-dark)]">
                          {count}
                        </span>
                      </div>
                      <p className="mt-1 text-[10px] text-[var(--sf-green-mid)]">
                        {EXPENSE_KIND_LABELS[cat.billing_kind]}
                        {cat.billing_kind === "FIXED" && cat.default_amount
                          ? ` · ${formatMoney(cat.default_amount, "XOF")}`
                          : ""}
                      </p>
                      {cat.description ? (
                        <p className="mt-0.5 line-clamp-2 text-[10px] leading-snug text-[var(--sf-green)]/45">
                          {cat.description}
                        </p>
                      ) : null}
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        </aside>

        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          {activeCategory ? (
            <>
              <div className="border-b border-[var(--sf-cream-dark)] px-4 py-3 sm:px-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="text-sm font-semibold text-[var(--sf-green-deep)]">
                      {activeCategory.name}
                    </h3>
                    <p className="mt-1 text-xs text-[var(--sf-green)]/55">
                      {EXPENSE_KIND_LABELS[activeCategory.billing_kind]}
                      {activeCategory.billing_kind === "FIXED" && activeCategory.default_amount
                        ? ` · ${formatMoney(activeCategory.default_amount, "XOF")}`
                        : ""}
                      {activeCategory.description ? ` — ${activeCategory.description}` : ""}
                    </p>
                  </div>
                  {!readOnly ? (
                    <button
                      type="button"
                      onClick={openAdd}
                      disabled={!activeCategory}
                      className="sf-btn-primary shrink-0 text-sm disabled:opacity-50"
                    >
                      + Nouvel événement
                    </button>
                  ) : null}
                </div>
                <div className="mt-3">
                  <input
                    type="search"
                    value={filterQuery}
                    onChange={(e) => setFilterQuery(e.target.value)}
                    placeholder="Filtrer par libellé, date, montant…"
                    className="sf-input w-full max-w-md text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-[minmax(0,1fr)_5.5rem_5.5rem] gap-x-3 border-b border-[var(--sf-cream-dark)]/70 bg-[var(--sf-cream)]/25 px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--sf-green)]/40 sm:px-5">
                <span>Libellé</span>
                <span>Date</span>
                <span className="text-right">Montant</span>
              </div>

              <ul className="flex-1 divide-y divide-[var(--sf-cream-dark)] overflow-y-auto">
                {filteredEvents.length === 0 ? (
                  <li className="px-5 py-12 text-center text-sm text-[var(--sf-green)]/45">
                    Aucun événement dans cette catégorie.
                    {!readOnly ? (
                      <button
                        type="button"
                        onClick={openAdd}
                        className="mt-2 block w-full text-xs font-medium text-[var(--sf-green-mid)] hover:underline"
                      >
                        Ajouter un événement
                      </button>
                    ) : null}
                  </li>
                ) : (
                  filteredEvents.map((event) => (
                    <li
                      key={event.id}
                      className={`grid grid-cols-1 gap-2 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_5.5rem_5.5rem_auto] sm:items-center sm:gap-x-3 sm:px-5 ${
                        event.status === "CANCELLED" ? "opacity-50" : ""
                      }`}
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-[var(--sf-green-deep)]">
                          {eventTitle(event)}
                          {event.status === "CANCELLED" ? (
                            <span className="ml-1 text-xs font-normal text-red-700">
                              (annulé)
                            </span>
                          ) : null}
                        </p>
                        {event.description ? (
                          <p className="mt-0.5 line-clamp-1 text-xs text-[var(--sf-green)]/45">
                            {event.description}
                          </p>
                        ) : null}
                      </div>
                      <p className="text-xs text-[var(--sf-green)]/60 sm:text-center">
                        {event.event_date ? formatDate(event.event_date) : "—"}
                      </p>
                      <p className="font-mono text-xs font-medium text-[var(--sf-green-deep)] sm:text-right">
                        {event.amount
                          ? formatMoney(event.amount, event.currency)
                          : "—"}
                      </p>
                      <button
                        type="button"
                        onClick={() =>
                          event.has_justification
                            ? openPdfPreview(event)
                            : openView(event)
                        }
                        className="justify-self-start text-xs font-medium text-[var(--sf-green-mid)] hover:underline sm:justify-self-end"
                      >
                        Voir détail
                      </button>
                    </li>
                  ))
                )}
              </ul>
            </>
          ) : (
            <div className="flex flex-1 items-center justify-center p-8 text-sm text-[var(--sf-green)]/45">
              Créez une catégorie à gauche pour commencer.
            </div>
          )}
        </div>
      </div>

      <CategoryAddModal
        open={addCategoryOpen}
        eventType={eventType}
        busy={addCategoryBusy}
        error={addCategoryError}
        onClose={() => {
          if (!addCategoryBusy) setAddCategoryOpen(false);
        }}
        onSubmit={(name, description, billingKind, defaultAmount) =>
          void submitNewCategory(name, description, billingKind, defaultAmount)
        }
      />

      <EventModal
        open={modalOpen}
        mode={modalMode}
        eventType={modalType}
        category={
          modalMode === "add"
            ? activeCategory
            : selectedEvent?.category
              ? categories.find((c) => c.id === selectedEvent.category) ?? null
              : null
        }
        event={selectedEvent}
        form={form}
        onFormChange={setForm}
        pendingPdf={pendingPdf}
        existingPdfFilename={existingPdfFilename}
        onPdfChange={setPendingPdf}
        onPreviewPdf={
          selectedEvent?.has_justification
            ? () => {
                setPdfPreviewOpen(true);
              }
            : undefined
        }
        busy={busy}
        error={error}
        onClose={closeModal}
        onStartEdit={() => setModalMode("edit")}
        onSaveAdd={() => void submitAdd()}
        onSaveEdit={requestEditSave}
        onRequestCancel={requestCancelFromModal}
        readOnly={readOnly}
      />

      <AssetEventPdfPreviewModal
        open={pdfPreviewOpen}
        assetId={assetId}
        eventId={selectedEvent?.id ?? null}
        title={selectedEvent?.justification_filename ?? "Justificatif PDF"}
        onClose={() => setPdfPreviewOpen(false)}
      />

      <PasswordConfirmModal
        open={passwordOpen}
        title={
          pendingAction?.kind === "cancel"
            ? "Confirmer l’annulation"
            : "Confirmer la modification"
        }
        description={
          pendingAction?.kind === "cancel"
            ? "Saisissez votre mot de passe pour annuler cet événement."
            : "Saisissez votre mot de passe pour enregistrer les modifications."
        }
        confirmLabel={pendingAction?.kind === "cancel" ? "Annuler l’événement" : "Enregistrer"}
        busy={passwordBusy || busy}
        error={passwordError}
        onClose={() => {
          if (!passwordBusy) {
            setPasswordOpen(false);
            setPendingAction(null);
            setPasswordError(null);
          }
        }}
        onConfirm={runPendingAction}
      />
    </PatrimoineSection>
  );
}
