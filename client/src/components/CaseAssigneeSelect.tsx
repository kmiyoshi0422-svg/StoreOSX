import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { canAccessPrefecture } from "@shared/accessPolicy";
import { toast } from "sonner";
import type { ReactNode } from "react";

export type AssignableUser = {
  id: number;
  name: string | null;
  email: string | null;
  role: string;
  areaAccessMode: "all" | "selected";
  allowedPrefectures: string | null;
};

export function CaseAssigneeSelect({
  caseId,
  prefecture,
  currentAssigneeId,
  candidates,
  onUpdated,
  compact = false,
  triggerContent,
  triggerClassName,
}: {
  caseId: number;
  prefecture: string | null;
  currentAssigneeId: number | null;
  candidates: AssignableUser[];
  onUpdated: () => void;
  compact?: boolean;
  triggerContent?: ReactNode;
  triggerClassName?: string;
}) {
  const mutation = trpc.cases.update.useMutation({
    onSuccess: () => {
      toast.success("担当者を更新しました");
      onUpdated();
    },
    onError: (error) => toast.error(error.message),
  });
  const eligible = candidates.filter((candidate) => canAccessPrefecture(candidate, prefecture));
  const hasCurrent = currentAssigneeId !== null && eligible.some((candidate) => candidate.id === currentAssigneeId);

  return (
    <Select
      value={currentAssigneeId === null ? "__none__" : String(currentAssigneeId)}
      disabled={mutation.isPending}
      onValueChange={(value) => {
        const next = value === "__none__" ? null : Number(value);
        if (next === currentAssigneeId || (next !== null && !eligible.some((candidate) => candidate.id === next))) return;
        mutation.mutate({ id: caseId, data: { assigneeId: next } });
      }}
    >
      <SelectTrigger
        aria-label="社内担当者を割り当てる"
        className={triggerClassName ?? (compact ? "h-8 min-w-[112px] max-w-[170px] bg-background text-xs" : "w-full max-w-sm bg-background")}
        onClick={(event) => event.stopPropagation()}
        onPointerDown={(event) => event.stopPropagation()}
      >
        {triggerContent ?? <SelectValue placeholder="担当者を選択" />}
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="__none__">未割当（解除）</SelectItem>
        {!hasCurrent && currentAssigneeId !== null && (
          <SelectItem value={String(currentAssigneeId)} disabled>現在の担当者（候補外）</SelectItem>
        )}
        {eligible.map((candidate) => (
          <SelectItem key={candidate.id} value={String(candidate.id)}>
            {candidate.name || candidate.email || `User #${candidate.id}`}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
