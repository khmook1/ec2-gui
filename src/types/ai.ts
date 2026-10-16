import type { AiProvider } from "@/types/settings";

/** 승인이 필요한 이유: 삭제·되돌릴 수 없음 / 상태 변경 / 비밀정보 노출 조회 / Docker 설치 / 서버 파일 쓰기 */
export type AiApprovalRisk =
  | "destructive"
  | "mutating"
  | "sensitive"
  | "dockerInstall"
  | "fileWrite";

/** 승인 카드에 표시할 명령 1건 (`command`는 실제로 실행될 명령·스크립트) */
export interface AiApprovalCommand {
  command: string;
  risk: AiApprovalRisk;
  reason: string;
  /** 파일 변경 전/후 unified diff */
  diff?: string;
}

/** 승인된 파일 쓰기에 필요한 sudo 비밀번호 요청 */
export interface AiSudoPrompt {
  id: number;
  path: string;
}

/** 실행 전 사용자 승인이 필요한 원격 명령 묶음 */
export interface AiCommandApproval {
  id: number;
  commands: AiApprovalCommand[];
}

export type AiChatRole = "user" | "assistant";

/** 대화 파일에 저장된 메시지 1건 */
export interface AiStoredMessage {
  role: AiChatRole;
  content: string;
  /** 이 답변을 만들 때 실행한 도구 결과 요약 */
  toolContext?: string;
  createdAt: string;
}

/** 대화 목록에 표시되는 요약 */
export interface AiConversationSummary {
  id: string;
  title: string;
  provider: AiProvider;
  messageCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface AiConversation {
  id: string;
  title: string;
  provider: AiProvider;
  sessionId: string | null;
  contextFingerprint: string | null;
  messages: AiStoredMessage[];
  createdAt: string;
  updatedAt: string;
}

/** 말풍선에 표시되는 질문 1건과 스트리밍 중인 응답 */
export interface AiExchange {
  id: number;
  /** 이 질문 이전에 대화에 쌓여 있던 메시지 수 (말풍선의 이전 대화 표시용) */
  historyCount: number;
  question: string;
  answer: string;
  /** 응답 본문이 오기 전 진행 상태 (생각 중, 명령 실행 중 등) */
  status: string | null;
  error: string | null;
  pending: boolean;
  cancelled: boolean;
  approval: AiCommandApproval | null;
  sudoPrompt: AiSudoPrompt | null;
}
