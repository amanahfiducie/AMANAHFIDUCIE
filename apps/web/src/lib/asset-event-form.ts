import type { AssetEventType } from "@/types/api";

export type AssetEventFormFields = {
  reference: string;
  title: string;
  description: string;
  amount: string;
  event_date: string;
  expense_kind: string;
};

export function appendAssetEventFields(
  form: FormData,
  type: AssetEventType,
  fields: AssetEventFormFields,
  options?: { categoryId?: number },
) {
  form.append("event_type", type);
  form.append("currency", "XOF");
  form.append("description", fields.description.trim());
  if (options?.categoryId) {
    form.append("category_id", String(options.categoryId));
  }

  if (type === "GAIN") {
    form.append("reference", fields.reference);
    form.append("amount", fields.amount);
    form.append("event_date", fields.event_date);
  } else if (type === "EXPENSE") {
    form.append("expense_kind", fields.expense_kind);
    form.append("amount", fields.amount);
    form.append("event_date", fields.event_date);
  } else if (type === "ESTIMATION") {
    form.append("amount", fields.amount);
    form.append("event_date", fields.event_date);
  } else {
    form.append("title", fields.title.trim());
  }
}

export function isPdfFile(file: File): boolean {
  const name = file.name.toLowerCase();
  return name.endsWith(".pdf") || file.type === "application/pdf";
}
