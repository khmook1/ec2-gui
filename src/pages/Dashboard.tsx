import { IconButton } from "@/components/common/IconButton";
import { PageToolbar } from "@/components/common/PageToolbar";
import { DiskCapacitySection } from "@/components/dashboard/DiskCapacitySection";
import { LargeDirectoriesSection } from "@/components/dashboard/LargeDirectoriesSection";
import {
  DashboardSummary,
  formatAppLabels,
} from "@/components/dashboard/Summary";
import { RefreshIcon } from "@/components/icons/ToolbarIcons";
import { getRemoteDiskOverview } from "@/services/tauri";
import { useAppStore } from "@/stores/appStore";
import type { DiskOverview } from "@/types/disk";
import { useCallback, useEffect, useState } from "react";
import "../components/dashboard/css/dashboard.css";

export function DashboardPage() {
  const status = useAppStore((state) => state.status);
  const appInfo = useAppStore((state) => state.appInfo);
  const appReady = status === "ready";
  const { appName, appVersion } = formatAppLabels(
    appInfo?.name,
    appInfo?.version,
  );

  const [diskOverview, setDiskOverview] = useState<DiskOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadDiskOverview = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const overview = await getRemoteDiskOverview();
      setDiskOverview(overview);
    } catch (err) {
      setDiskOverview(null);
      setError(
        err instanceof Error
          ? err.message
          : typeof err === "string"
            ? err
            : "디스크 정보를 불러오지 못했습니다.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadDiskOverview();
  }, [loadDiskOverview]);

  const filesystems = diskOverview?.filesystems ?? [];
  const directories = diskOverview?.largeDirectories ?? [];

  return (
    <section className="explorer dashboard-page">
      <PageToolbar
        actions={
          <IconButton
            tone="neutral"
            tooltip="새로고침"
            disabled={loading}
            onClick={() => void loadDiskOverview()}
            aria-label="디스크 정보 새로고침"
          >
            <RefreshIcon />
          </IconButton>
        }
      >
        <p className="page-toolbar__hint">
          원격 호스트 디스크 용량과 사용량이 큰 경로를 확인합니다.
        </p>
      </PageToolbar>

      <div className="dashboard-page__content">
        <DashboardSummary
          appName={appName}
          appVersion={appVersion}
          appReady={appReady}
          filesystems={filesystems}
          loading={loading}
        />

        <section className="dashboard-main" aria-label="상세">
          <DiskCapacitySection
            filesystems={filesystems}
            loading={loading}
            error={error}
          />
          <LargeDirectoriesSection
            directories={directories}
            loading={loading}
            error={error}
          />
        </section>
      </div>
    </section>
  );
}
