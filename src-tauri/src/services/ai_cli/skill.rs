use serde::Serialize;

/// 사용자가 질문에 `@id`로 지정할 수 있는 AI 도구
#[derive(Debug, Clone, Copy, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AiSkill {
    pub id: &'static str,
    pub label: &'static str,
    pub description: &'static str,
    /// 시스템 프롬프트의 도구 지침 섹션 이름
    #[serde(skip)]
    pub tool: &'static str,
    pub requires_ssh: bool,
}

pub const SKILLS: [AiSkill; 4] = [
    AiSkill {
        id: "server",
        label: "서버 조회",
        description: "SSH로 접속한 서버에서 조회 명령을 실행해 상태를 분석합니다.",
        tool: "서버 조회 도구",
        requires_ssh: true,
    },
    AiSkill {
        id: "docker",
        label: "Docker",
        description: "컨테이너·이미지·로그를 확인하고 Docker 설치를 돕습니다.",
        tool: "Docker 도구",
        requires_ssh: true,
    },
    AiSkill {
        id: "file",
        label: "서버 파일",
        description: "서버 파일을 읽고, 승인 후 생성·수정합니다.",
        tool: "서버 파일 도구",
        requires_ssh: true,
    },
    AiSkill {
        id: "github",
        label: "GitHub",
        description: "저장소·이슈·PR·Actions를 조회하고, 승인 후 변경합니다.",
        tool: "GitHub 도구",
        requires_ssh: false,
    },
];

pub fn prompt_section() -> String {
    let list = SKILLS
        .iter()
        .map(|skill| format!("`@{}`({})", skill.id, skill.tool))
        .collect::<Vec<_>>()
        .join(", ");
    format!(
        "\n\n[스킬 지정]\n질문에 {list}가 있으면 사용자가 그 도구를 지정한 것입니다. \
해당 도구를 우선 사용하고, 지금 쓸 수 없으면(예: SSH 미접속) 그 이유를 알려 주세요."
    )
}
