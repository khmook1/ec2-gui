import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { AppDialog } from "@/components/common/AppDialog";
import { CodeBlock } from "@/components/common/CodeBlock";
import { IconButton } from "@/components/common/IconButton";
import { LoadingIndicator } from "@/components/common/LoadingIndicator";
import {
  CheckIcon,
  EditIcon,
} from "@/components/icons/ToolbarIcons";
import {
  useRemoteFileQuery,
  useWriteRemoteFileMutation,
} from "@/hooks/query";
import { queryKeys } from "@/hooks/query/keys";
import { useSessionKey } from "@/hooks/query/useSessionKey";
import { useToast } from "@/providers/ToastProvider";
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
  const toast = useToast();
  const queryClient = useQueryClient();
  const sessionKey = useSessionKey();
  const fileQuery = useRemoteFileQuery(path);
  const writeFile = useWriteRemoteFileMutation();
  const file = fileQuery.data ?? null;
  // 최초 로드만 로딩으로 취급 (백그라운드 refetch로 닫기가 막히지 않게)
  const isLoading =
    file == null && (fileQuery.isPending || fileQuery.isFetching);
  const isOpen = path != null;
  const errorMessage = fileQuery.isError
    ? fileQuery.error instanceof Error
      ? fileQuery.error.message
      : "파일 내용을 불러오지 못했습니다."
    : null;

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");

  useEffect(() => {
    setEditing(false);
    setDraft("");
  }, [path]);

  useEffect(() => {
    if (!editing && file && !file.isBinary && !file.isImage) {
      setDraft(file.content);
    }
  }, [editing, file]);

  const title = useMemo(
    () => file?.name ?? path?.split("/").pop() ?? path ?? "",
    [file?.name, path],
  );
  const languageLabel = useMemo(
    () => getHighlightLanguageLabel(getHighlightLanguage(title)),
    [title],
  );

  const canEdit =
    Boolean(file) &&
    !file?.isBinary &&
    !file?.isImage &&
    !file?.truncated &&
    !isLoading &&
    !errorMessage;
  const isSaving = writeFile.isPending;
  const isDirty = editing && file != null && draft !== file.content;
  const showImagePreview =
    Boolean(file?.isImage) && Boolean(file?.content) && !file?.truncated;
  const showBinaryUnavailable =
    Boolean(file?.isBinary) && !file?.isImage;
  const showImageUnavailable =
    Boolean(file?.isImage) && (!file?.content || file.truncated);

  function startEditing() {
    if (!file || file.isBinary || file.isImage || file.truncated) {
      return;
    }
    setDraft(file.content);
    setEditing(true);
  }

  function cancelEditing() {
    setDraft(file?.content ?? "");
    setEditing(false);
  }

  async function saveEditing() {
    if (!path || !file || file.isBinary || file.isImage || file.truncated) {
      return;
    }
    try {
      await writeFile.mutateAsync({ path, content: draft });
      toast.success("파일을 저장했습니다.");
      setEditing(false);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "파일을 저장하지 못했습니다.",
      );
    }
  }

  function handleClose() {
    // 저장 중에만 닫기 차단. 불러오는 중에는 언제든 닫을 수 있음.
    if (isSaving) {
      return;
    }
    if (sessionKey && path) {
      void queryClient.cancelQueries({
        queryKey: queryKeys.remoteFile(sessionKey, path),
      });
    }
    setEditing(false);
    onClose();
  }

  const meta = file ? (
    <>
      <span>{formatFileSize(file.size)}</span>
      {languageLabel && !file.isImage ? (
        <span className="file-dialog__meta-lang">{languageLabel}</span>
      ) : null}
      {file.isImage ? <span>이미지</span> : null}
      {file.truncated ? <span>미리보기 일부만 표시</span> : null}
      {file.isBinary && !file.isImage ? <span>이진 파일</span> : null}
      {editing ? <span>편집 중</span> : null}
    </>
  ) : isLoading ? (
    <span className="file-dialog__meta-loading">불러오는 중</span>
  ) : null;

  const headerActions =
    !isLoading && !errorMessage && file && !file.isBinary && !file.isImage ? (
      editing ? (
        <>
          <IconButton
            tone="success"
            tooltip="저장"
            disabled={isSaving || !isDirty}
            onClick={() => void saveEditing()}
          >
            <CheckIcon />
          </IconButton>
          <IconButton
            variant="close"
            tooltip="편집 취소"
            disabled={isSaving}
            onClick={cancelEditing}
          />
        </>
      ) : (
        <IconButton
          tone="accent"
          tooltip={
            file.truncated
              ? "파일이 커서 편집할 수 없습니다"
              : "편집"
          }
          disabled={!canEdit}
          onClick={startEditing}
        >
          <EditIcon />
        </IconButton>
      )
    ) : null;

  return (
    <AppDialog
      open={isOpen && path != null}
      onClose={handleClose}
      title={title}
      subtitle={path ?? undefined}
      busy={isSaving}
      closeDisabled={isSaving}
      meta={meta}
      headerActions={headerActions}
      bodyClassName={
        editing
          ? "file-dialog__body--editing"
          : showImagePreview
            ? "file-dialog__body--image"
            : undefined
      }
    >
      {isLoading ? (
        <LoadingIndicator layout="dialog" message="파일 내용을 불러오는 중" />
      ) : null}

      {!isLoading && errorMessage ? (
        <p className="file-dialog__error" role="alert">
          {errorMessage}
        </p>
      ) : null}

      {!isLoading && !errorMessage && showImagePreview ? (
        <div className="file-dialog__image-wrap">
          <img
            className="file-dialog__image"
            src={file!.content}
            alt={title}
          />
        </div>
      ) : null}

      {!isLoading && !errorMessage && showImageUnavailable ? (
        <p className="file-dialog__status">
          이미지가 커서 미리볼 수 없습니다.
        </p>
      ) : null}

      {!isLoading && !errorMessage && showBinaryUnavailable ? (
        <p className="file-dialog__status">이진 파일은 미리볼 수 없습니다.</p>
      ) : null}

      {!isLoading &&
      !errorMessage &&
      file &&
      !file.isBinary &&
      !file.isImage &&
      editing ? (
        <CodeBlock
          code={draft}
          filename={title}
          editable
          disabled={isSaving}
          aria-label="파일 내용 편집"
          onChange={setDraft}
        />
      ) : null}

      {!isLoading &&
      !errorMessage &&
      file &&
      !file.isBinary &&
      !file.isImage &&
      !editing ? (
        <CodeBlock code={file.content} filename={title} />
      ) : null}
    </AppDialog>
  );
}
