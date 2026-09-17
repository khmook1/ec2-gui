import { useMemo } from "react";
import { AppDialog } from "@/components/common/AppDialog";
import { CodeBlock } from "@/components/common/CodeBlock";
import { LoadingIndicator } from "@/components/common/LoadingIndicator";
import { useRemoteFileQuery } from "@/hooks/query";
import {
  getHighlightLanguage,
  getHighlightLanguageLabel,
} from "@/utils/highlightLanguage";
import { formatFileSize } from "@/utils/file";

interface FileContentDialogProps {
  path: string | null;
  onClose: () => void;
}

export function FileContentDialog({ path, onClose }: FileContentDialogProps) {
  const fileQuery = useRemoteFileQuery(path);
  const file = fileQuery.data ?? null;
  const isLoading = fileQuery.isPending || fileQuery.isFetching;
  const isOpen = path != null;
  const errorMessage = fileQuery.isError
    ? fileQuery.error instanceof Error
      ? fileQuery.error.message
      : "파일 내용을 불러오지 못했습니다."
    : null;

  const title = useMemo(
    () => file?.name ?? path?.split("/").pop() ?? path ?? "",
    [file?.name, path],
  );
  const languageLabel = useMemo(
    () => getHighlightLanguageLabel(getHighlightLanguage(title)),
    [title],
  );

  const meta = file ? (
    <>
      <span>{formatFileSize(file.size)}</span>
      {languageLabel ? (
        <span className="file-dialog__meta-lang">{languageLabel}</span>
      ) : null}
      {file.truncated ? <span>미리보기 일부만 표시</span> : null}
      {file.isBinary ? <span>이진 파일</span> : null}
    </>
  ) : isLoading ? (
    <span className="file-dialog__meta-loading">불러오는 중</span>
  ) : null;

  return (
    <AppDialog
      open={isOpen && path != null}
      onClose={onClose}
      title={title}
      subtitle={path ?? undefined}
      busy={isLoading}
      meta={meta}
    >
      {isLoading ? (
        <LoadingIndicator layout="dialog" message="파일 내용을 불러오는 중" />
      ) : null}

      {!isLoading && errorMessage ? (
        <p className="file-dialog__error" role="alert">
          {errorMessage}
        </p>
      ) : null}

      {!isLoading && !errorMessage && file?.isBinary ? (
        <p className="file-dialog__status">이진 파일은 미리볼 수 없습니다.</p>
      ) : null}

      {!isLoading && !errorMessage && file && !file.isBinary ? (
        <CodeBlock code={file.content} filename={title} />
      ) : null}
    </AppDialog>
  );
}
