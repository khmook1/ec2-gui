/** 말풍선에 표시되는 질문 1건과 스트리밍 중인 응답 */
export interface AiExchange {
  id: number;
  question: string;
  answer: string;
  /** 응답 본문이 오기 전 진행 상태 (생각 중, 명령 실행 중 등) */
  status: string | null;
  error: string | null;
  pending: boolean;
  cancelled: boolean;
}
