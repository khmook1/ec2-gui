import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { Alert } from "@/components/common/Alert";
import { AppDialog } from "@/components/common/AppDialog";
import { Button } from "@/components/common/Button";
import { FormField } from "@/components/common/FormField";
import {
  useDiskExpandStatusQuery,
  useExpandDiskMutation,
} from "@/hooks/query";
import { useToast } from "@/providers/ToastProvider";
import { formatFileSize } from "@/utils/file";

interface ExpandDiskDialogProps {
  open: boolean;
  onClose: () => void;
}

interface ExpandDiskFormValues {
  mode: "unallocated" | "target";
  targetSizeGb: number;
}

export function ExpandDiskDialog({ open, onClose }: ExpandDiskDialogProps) {
  const toast = useToast();
  const statusQuery = useDiskExpandStatusQuery({ enabled: open });
  const expandMutation = useExpandDiskMutation();
  const status = statusQuery.data ?? null;

  const { register, handleSubmit, watch, reset } =
    useForm<ExpandDiskFormValues>({
      defaultValues: {
        mode: "unallocated",
        targetSizeGb: 20,
      },
    });

  useEffect(() => {
    if (!open) {
      expandMutation.reset();
      return;
    }
    if (!status) {
      return;
    }
    reset({
      mode: status.canGrowOs ? "unallocated" : "target",
      targetSizeGb: status.currentSizeGb + 1,
    });
    // expandMutation intentionally omitted — only reset on open/close
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, status, reset]);

  const mode = watch("mode");
  const targetSizeGb = watch("targetSizeGb");
  const submitting = expandMutation.isPending;

  const onSubmit = handleSubmit(async (values) => {
    const target =
      values.mode === "unallocated" ? null : Number(values.targetSizeGb);

    if (
      values.mode === "target" &&
      (!Number.isFinite(target) || (target ?? 0) <= (status?.currentSizeGb ?? 0))
    ) {
      toast.warning("현재 디스크보다 큰 GiB 값을 입력하세요.");
      return;
    }

    try {
      const result = await expandMutation.mutateAsync(target);
      if (result.success) {
        toast.success(result.message);
        onClose();
      } else {
        toast.error(result.message);
      }
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "디스크 확장에 실패했습니다.",
      );
    }
  });

  const steps = expandMutation.data?.steps ?? [];

  return (
    <AppDialog
      open={open}
      onClose={onClose}
      title="디스크 용량 확장"
      subtitle={
        status
          ? `${status.rootDevice ?? "—"} · 현재 ${status.currentSizeGb} GiB`
          : "상태 확인 중…"
      }
      busy={submitting || statusQuery.isPending}
      closeDisabled={submitting}
      size="wide"
    >
      <form className="dashboard-expand-disk" onSubmit={onSubmit}>
        {statusQuery.isError ? (
          <Alert variant="error" title="상태 조회 실패">
            {statusQuery.error instanceof Error
              ? statusQuery.error.message
              : "확장 상태를 불러오지 못했습니다."}
          </Alert>
        ) : null}

        {status?.notes && status.notes.length > 0 ? (
          <Alert variant="warning" title="확인 필요">
            <ul className="dashboard-expand-disk__notes">
              {status.notes.map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
          </Alert>
        ) : null}

        {status ? (
          <div className="dashboard-expand-disk__meta">
            <div>
              <span className="dashboard-expand-disk__label">미할당</span>
              <strong>{formatFileSize(status.unallocatedBytes)}</strong>
            </div>
            <div>
              <span className="dashboard-expand-disk__label">볼륨</span>
              <strong>{status.volumeId ?? "—"}</strong>
            </div>
            <div>
              <span className="dashboard-expand-disk__label">리전</span>
              <strong>{status.region ?? "—"}</strong>
            </div>
            <div>
              <span className="dashboard-expand-disk__label">파일시스템</span>
              <strong>{status.rootFstype ?? "—"}</strong>
            </div>
          </div>
        ) : null}

        <fieldset className="dashboard-expand-disk__modes" disabled={submitting}>
          <legend>확장 방식</legend>
          <label className="dashboard-expand-disk__radio">
            <input
              type="radio"
              value="unallocated"
              disabled={!status?.canGrowOs}
              {...register("mode")}
            />
            <span>
              미할당 공간 할당
              {!status?.canGrowOs ? " (사용 불가)" : ""}
            </span>
          </label>
          <label className="dashboard-expand-disk__radio">
            <input
              type="radio"
              value="target"
              disabled={!status?.canModifyEbs}
              {...register("mode")}
            />
            <span>목표 용량으로 EBS 확장 후 OS 할당</span>
          </label>
        </fieldset>

        {mode === "target" ? (
          <FormField label="목표 용량 (GiB)">
            <input
              type="number"
              min={(status?.currentSizeGb ?? 1) + 1}
              step={1}
              disabled={submitting}
              {...register("targetSizeGb", {
                valueAsNumber: true,
                required: true,
                min: (status?.currentSizeGb ?? 1) + 1,
              })}
            />
          </FormField>
        ) : null}

        {mode === "target" &&
        status &&
        targetSizeGb > status.currentSizeGb &&
        !status.canModifyEbs ? (
          <Alert variant="warning" title="EBS 확장 불가">
            aws CLI·인스턴스 프로파일·볼륨 ID가 필요합니다. 콘솔에서 볼륨을
            키운 뒤 미할당 공간 할당만 사용할 수 있습니다.
          </Alert>
        ) : null}

        <p className="dashboard-expand-disk__hint">
          EBS 축소는 지원하지 않습니다. ModifyVolume 후 growpart ·
          resize2fs/xfs_growfs를 순서대로 실행합니다.
        </p>

        {steps.length > 0 ? (
          <ul className="dashboard-expand-disk__steps" aria-label="실행 로그">
            {steps.map((step, index) => (
              <li
                key={`${step.name}-${index}`}
                className={
                  step.ok
                    ? "dashboard-expand-disk__step dashboard-expand-disk__step--ok"
                    : "dashboard-expand-disk__step dashboard-expand-disk__step--err"
                }
              >
                <strong>{step.name}</strong>
                <pre>{step.output}</pre>
              </li>
            ))}
          </ul>
        ) : null}

        <div className="dashboard-expand-disk__actions">
          <Button variant="ghost" type="button" disabled={submitting} onClick={onClose}>
            취소
          </Button>
          <Button type="submit" disabled={submitting || statusQuery.isPending}>
            {submitting ? "확장 중…" : "확장 실행"}
          </Button>
        </div>
      </form>
    </AppDialog>
  );
}
