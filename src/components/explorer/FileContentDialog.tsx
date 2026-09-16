import { useId, useMemo } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/common/Button";
import { CodeBlock } from "@/components/common/CodeBlock";
import { LoadingIndicator } from "@/components/common/LoadingIndicator";
import { useDeferredAsyncResource } from "@/hooks/useDeferredAsyncResource";
import { useEscapeKey } from "@/hooks/useEscapeKey";
import { readRemoteFile } from "@/services/tauri/filesystem";
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
  const titleId = useId();
  const {
    data: file,
    isLoading,
    errorMessage,
    isOpen,
  } = useDeferredAsyncResource({
    key: path,
    load: readRemoteFile,
    fallbackErrorMessage: "파일 내용을 불러오지 못했습니다.",
  });

  useEscapeKey(isOpen, onClose);

  const title = useMemo(
    () => file?.name ?? path?.split("/").pop() ?? path ?? "",
    [file?.name, path],
  );
  const languageLabel = useMemo(
    () => getHighlightLanguageLabel(getHighlightLanguage(title)),
    [title],
  );

  if (!isOpen || path == null) {
    return null;
  }

  return createPortal(
    <div
      className="file-dialog-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        className="file-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-busy={isLoading}
      >
        <header className="file-dialog__header">
          <div className="file-dialog__heading">
            <h2 id={titleId} className="file-dialog__title">
              {title}
            </h2>
            <p className="file-dialog__path">{path}</p>
          </div>
          <Button variant="ghost" onClick={onClose}>
            닫기
          </Button>
        </header>

        <div className="file-dialog__meta">
          {file ? (
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
          ) : null}
        </div>

        <div className="file-dialog__body">
          {isLoading ? (
            <LoadingIndicator
              layout="dialog"
              message="파일 내용을 불러오는 중"
            />
          ) : null}

          {!isLoading && errorMessage ? (
            <p className="file-dialog__error" role="alert">
              {errorMessage}
            </p>
          ) : null}

          {!isLoading && !errorMessage && file?.isBinary ? (
            <p className="file-dialog__status">
              이진 파일은 미리볼 수 없습니다.
            </p>
          ) : null}

          {!isLoading && !errorMessage && file && !file.isBinary ? (
            <CodeBlock code={file.content} filename={title} />
          ) : null}
        </div>
      </div>
    </div>,
    document.body,
  );
}
