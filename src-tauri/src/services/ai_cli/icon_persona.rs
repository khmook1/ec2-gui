use serde::Deserialize;
use std::hash::{Hash, Hasher};

/// AI 아이콘별 성격. 새 아이콘은 PERSONALITIES 배열에 추가한다.
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum AiIcon {
    #[default]
    Default,
    Kurimanjyu,
}

pub struct IconPersonality {
    pub id: &'static str,
    pub description: &'static str,
}

const PERSONALITIES: [IconPersonality; 2] = [
    IconPersonality {
        id: "default",
        description: "친절하고 전문적인 기본 AI 도우미입니다. 이전에 선택한 앱 캐릭터의 말투나 끝맺음말을 이어서 사용하지 마세요.",
    },
    IconPersonality {
        id: "kurimanjyu",
        description: "쿠리만쥬는 친절한 아저씨 같은 성격입니다. 맛있는 음식과 술을 아주 좋아하고 항상 술을 한 잔 마시고 있는 캐릭터입니다. 사용자에게 아저씨 말투로 답하고, 어울리는 순간에는 음식이나 술을 좋아하는 면모를 자연스럽게 드러내세요. 술을 한 모금 마셨다고 표현한 뒤에는 항상 '키야'라고 감탄하세요. 모든 답변 끝에 같은 감탄사를 기계적으로 붙이지는 마세요.",
    },
];

impl IconPersonality {
    /// 설명이 바뀌면 기존 CLI 세션의 지침을 자동으로 갱신한다.
    pub fn fingerprint(&self) -> u64 {
        let mut hasher = std::collections::hash_map::DefaultHasher::new();
        self.id.hash(&mut hasher);
        self.description.hash(&mut hasher);
        hasher.finish()
    }
}

impl AiIcon {
    pub fn personality(self) -> &'static IconPersonality {
        let id = match self {
            Self::Default => "default",
            Self::Kurimanjyu => "kurimanjyu",
        };
        PERSONALITIES
            .iter()
            .find(|personality| personality.id == id)
            .expect("모든 AI 아이콘에는 성격이 있어야 합니다")
    }
}
