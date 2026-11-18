"use client";

import { useActionState, useState } from "react";
import { submitReportAction, type ReportState } from "@/app/[locale]/report/actions";
import { Pill } from "@/components/guided/ui";
import type { ReportLabels } from "@/lib/report-labels";
import { REPORT_DETAILS_MAX, type ReportTargetType } from "@/lib/moderation/reasons";

/**
 * A quiet "Report a problem" link that opens a small form: pick what is wrong, add a few words, send. Nothing is
 * shown to the person reported. The server checks that the reporter can actually see the target.
 */
export function ReportButton({ targetType, targetId, labels }: { targetType: ReportTargetType; targetId: string; labels: ReportLabels }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [state, action, pending] = useActionState<ReportState, FormData>(submitReportAction, { status: "idle" });
  const idBase = `rep-${targetType}-${targetId}`;

  if (state.status === "sent") {
    return <p role="status" className="text-sm font-semibold text-ink-700">{state.already ? labels.already : labels.thanks}</p>;
  }
  if (!open) {
    return <button type="button" className="text-sm font-semibold text-ink-600 underline underline-offset-4 hover:text-brand-800" onClick={() => setOpen(true)}>{labels.open}</button>;
  }
  return (
    <form action={action} className="flex flex-col gap-4 rounded-[26px] bg-brand-50 p-5" aria-labelledby={`${idBase}-h`}>
      <h3 id={`${idBase}-h`} className="text-lg font-extrabold">{labels.title}</h3>
      <p className="text-sm text-ink-700">{labels.intro}</p>
      <input type="hidden" name="targetType" value={targetType} />
      <input type="hidden" name="targetId" value={targetId} />
      <input type="hidden" name="reason" value={reason} />
      <fieldset>
        <legend className="label">{labels.reasonLabel}</legend>
        <div className="flex flex-wrap gap-2.5">{labels.reasons.map((r) => <Pill key={r.key} on={reason === r.key} onClick={() => setReason(r.key)}>{r.label}</Pill>)}</div>
      </fieldset>
      <div>
        <label className="label" htmlFor={`${idBase}-d`}>{reason === "other" ? labels.detailsRequiredLabel : labels.detailsLabel}</label>
        <textarea id={`${idBase}-d`} name="details" rows={3} maxLength={REPORT_DETAILS_MAX} className="field" />
        <p className="hint">{labels.detailsHint}</p>
      </div>
      {state.status === "error" ? <p role="alert" className="notice-error">{labels.errors[state.code] ?? labels.errors.server}</p> : null}
      <div className="flex flex-wrap gap-3">
        <button type="submit" className="btn btn-primary" disabled={pending || reason === ""}>{pending ? labels.sending : labels.send}</button>
        <button type="button" className="btn btn-secondary" onClick={() => setOpen(false)}>{labels.close}</button>
      </div>
    </form>
  );
}
