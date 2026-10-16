import { FormSection } from "@/components/common/FormField";
import { PageToolbar } from "@/components/common/PageToolbar";
import { AiConnectionSettings } from "@/components/settings/AiConnectionSettings";
import { AiIconSettings } from "@/components/settings/AiIconSettings";
import "../css/settings.css";

export function AiSettingsPage() {
  return (
    <section className="explorer settings-page">
      <PageToolbar>
        <p className="page-toolbar__hint">
          AI 도우미로 사용할 CLI(Codex CLI, Claude Code)를 연결합니다. 연결하면
          화면에 AI 캐릭터가 나타나고 ⇧ Space로 질문할 수 있습니다.
        </p>
      </PageToolbar>

      <div className="settings-page__content">
        <FormSection title="AI 연결">
          <AiConnectionSettings />
        </FormSection>
        <FormSection title="AI 아이콘">
          <AiIconSettings />
        </FormSection>
      </div>
    </section>
  );
}
