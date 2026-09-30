import { useForm } from "react-hook-form";
import { Button } from "@/components/common/Button";
import { PaginatedContent } from "@/components/common/Pagination";
import { MarkdownHtml } from "@/components/github/atoms/MarkdownHtml";
import {
  useCreateGitHubCommentMutation,
  useGitHubCommentsQuery,
} from "@/hooks/query";
import { usePagination } from "@/hooks/usePagination";
import { formatGitHubTime, githubErrorMessage } from "@/lib/github";
import type { GitHubUser } from "@/types/github";

interface CommentCardProps {
  user: GitHubUser;
  createdAt: string;
  bodyHtml: string | null;
  /** 본문(이슈·PR 설명) 카드 */
  isBody?: boolean;
}

export function CommentCard({
  user,
  createdAt,
  bodyHtml,
  isBody = false,
}: CommentCardProps) {
  return (
    <article
      className={[
        "github-comment",
        isBody ? "github-comment--body" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <img
        className="github-comment__avatar"
        src={user.avatarUrl}
        alt=""
        width={36}
        height={36}
      />
      <div className="github-comment__box">
        <header className="github-comment__header">
          <strong>{user.login}</strong>
          <span>{formatGitHubTime(createdAt)}</span>
        </header>
        <MarkdownHtml
          html={bodyHtml}
          emptyText="설명이 없습니다."
          className="github-comment__body"
        />
      </div>
    </article>
  );
}

interface CommentThreadProps {
  repo: string;
  number: number;
  /** 잠긴 저장소(아카이브)면 입력 폼을 숨긴다 */
  canComment: boolean;
}

interface CommentFormValues {
  body: string;
}

/** 이슈·PR 공통 댓글 목록 + 작성 폼 */
export function CommentThread({ repo, number, canComment }: CommentThreadProps) {
  const { page, setPage } = usePagination({ resetDeps: [repo, number] });
  const commentsQuery = useGitHubCommentsQuery(repo, number, page);
  const createComment = useCreateGitHubCommentMutation(repo);
  const {
    register,
    handleSubmit,
    reset,
    formState: { isValid },
  } = useForm<CommentFormValues>({
    mode: "onChange",
    defaultValues: { body: "" },
  });

  const comments = commentsQuery.data?.items ?? [];
  const totalPages = commentsQuery.data?.totalPages ?? 1;

  return (
    <section className="github-thread" aria-label="댓글">
      {commentsQuery.error ? (
        <p className="explorer-error" role="alert">
          {githubErrorMessage(commentsQuery.error, "댓글을 불러오지 못했습니다.")}
        </p>
      ) : null}

      <PaginatedContent
        page={page}
        totalPages={totalPages}
        onChangePage={setPage}
        isFetching={commentsQuery.isFetching}
        loadingMessage="댓글을 불러오는 중"
        ariaLabel="댓글 페이지"
        className="github-thread__list"
      >
        {comments.map((comment) => (
          <CommentCard
            key={comment.id}
            user={comment.user}
            createdAt={comment.createdAt}
            bodyHtml={comment.bodyHtml}
          />
        ))}
      </PaginatedContent>

      {canComment ? (
        <form
          className="github-thread__form"
          onSubmit={handleSubmit((values) => {
            createComment.mutate(
              { number, body: values.body },
              {
                onSuccess: () => {
                  reset({ body: "" });
                  if (page !== totalPages) {
                    setPage(totalPages);
                  }
                },
              },
            );
          })}
        >
          <textarea
            className="github-textarea"
            rows={4}
            placeholder="댓글 작성 (Markdown 지원)"
            disabled={createComment.isPending}
            {...register("body", {
              validate: (value) => value.trim().length > 0,
            })}
          />
          <div className="github-thread__actions">
            <Button
              type="submit"
              disabled={!isValid || createComment.isPending}
            >
              {createComment.isPending ? "등록 중…" : "댓글 등록"}
            </Button>
          </div>
        </form>
      ) : null}
    </section>
  );
}
