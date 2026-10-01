import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { Alert } from "@/components/common/Alert";
import { Button } from "@/components/common/Button";
import { FormField } from "@/components/common/FormField";
import { AiProviderIcon } from "@/components/icons/AiProviderIcons";
import { useCheckAiCliMutation } from "@/hooks/query";
import { useSettingsStore } from "@/stores/settingsStore";
import {
  AI_PROVIDER_OPTIONS,
  getAiProviderLabel,
  type AiProvider,
} from "@/types/settings";
import "./css/ai-connection.css";

interface AiConnectionFormValues {
  provider: AiProvider | null;
  binaryPath: string;
}

type Feedback = { variant: "success" | "error"; text: string };

interface AiConnectionTipStep {
  label: string;
  text: string;
  commands?: string[];
}

const AI_CONNECTION_TIPS: Record<AiProvider, AiConnectionTipStep[]> = {
  codex: [
    {
      label: "설치",
      text: "터미널에서 둘 중 하나로 설치합니다. npm은 Node.js 18 이상이 필요합니다.",
      commands: [
        "npm install -g @openai/codex",
        "brew install --cask codex",
      ],
    },
    {
      label: "로그인",
      text: "아래 명령을 실행하면 브라우저가 열립니다. ChatGPT 계정(Plus·Pro·Team 등)으로 로그인하세요.",
      commands: ["codex login"],
    },
    {
      label: "API 키 (선택)",
      text: "ChatGPT 구독 대신 API 요금제를 쓰려면 platform.openai.com/api-keys 에서 키를 발급받아 등록합니다.",
      commands: ["printenv OPENAI_API_KEY | codex login --with-api-key"],
    },
    {
      label: "확인",
      text: "버전이 출력되면 위에서 '연결'을 누르세요.",
      commands: ["codex --version"],
    },
  ],
  claude: [
    {
      label: "설치",
      text: "터미널에서 둘 중 하나로 설치합니다. npm은 Node.js 18 이상이 필요합니다.",
      commands: [
        "curl -fsSL https://claude.ai/install.sh | bash",
        "npm install -g @anthropic-ai/claude-code",
      ],
    },
    {
      label: "로그인",
      text: "claude를 한 번 실행하고 안내에 따라(또는 /login 입력) Claude Pro·Max 계정으로 로그인하세요.",
      commands: ["claude"],
    },
    {
      label: "API 키 (선택)",
      text: "구독 대신 API 요금제를 쓰려면 로그인 화면에서 Anthropic Console 계정을 고르세요. console.anthropic.com 의 키로 자동 연결됩니다.",
    },
    {
      label: "확인",
      text: "버전이 출력되면 위에서 '연결'을 누르세요.",
      commands: ["claude --version"],
    },
  ],
};

export function AiConnectionSettings() {
  const ai = useSettingsStore((state) => state.ai);
  const setAiSettings = useSettingsStore((state) => state.setAiSettings);
  const checkMutation = useCheckAiCliMutation();
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [saving, setSaving] = useState(false);

  const { register, watch, setValue, reset, handleSubmit } =
    useForm<AiConnectionFormValues>({
      defaultValues: {
        provider: ai.provider,
        binaryPath: ai.binaryPath ?? "",
      },
    });

  useEffect(() => {
    reset({ provider: ai.provider, binaryPath: ai.binaryPath ?? "" });
  }, [ai.provider, ai.binaryPath, reset]);

  const formProvider = watch("provider");
  const formBinaryPath = watch("binaryPath");
  const selectedOption = AI_PROVIDER_OPTIONS.find(
    (option) => option.id === formProvider,
  );
  const busy = saving || checkMutation.isPending;
  const alreadyConnected =
    ai.provider !== null &&
    ai.provider === formProvider &&
    (ai.binaryPath ?? "") === formBinaryPath.trim();

  function selectProvider(provider: AiProvider) {
    setFeedback(null);
    setValue("provider", provider, { shouldDirty: true });
    if (provider !== ai.provider) {
      setValue("binaryPath", "");
    } else {
      setValue("binaryPath", ai.binaryPath ?? "");
    }
  }

  const handleConnect = handleSubmit(async ({ provider, binaryPath }) => {
    if (!provider) return;
    setFeedback(null);
    setSaving(true);
    try {
      const status = await checkMutation.mutateAsync({
        provider,
        binaryPath: binaryPath.trim() || null,
      });
      await setAiSettings({ provider, binaryPath: binaryPath.trim() || null });
      setFeedback({
        variant: "success",
        text: `${getAiProviderLabel(provider)} 연결됨 · ${status.version} (${status.path})`,
      });
    } catch (err) {
      setFeedback({
        variant: "error",
        text: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setSaving(false);
    }
  });

  async function handleDisconnect() {
    setFeedback(null);
    await setAiSettings({ provider: null, binaryPath: null });
    setFeedback({ variant: "success", text: "AI 연결을 해제했습니다." });
  }

  return (
    <form
      className="ai-connection"
      onSubmit={(event) => void handleConnect(event)}
    >
      <div
        className="ai-connection__providers"
        role="radiogroup"
        aria-label="AI 도구"
      >
        {AI_PROVIDER_OPTIONS.map((option) => {
          const selected = formProvider === option.id;
          const connected = ai.provider === option.id;
          const connecting = busy && selected;
          return (
            <button
              key={option.id}
              type="button"
              role="radio"
              aria-checked={selected}
              className={[
                "ai-provider-card",
                `ai-provider-card--${option.id}`,
                selected ? "ai-provider-card--selected" : "",
                connected ? "ai-provider-card--connected" : "",
                connecting ? "ai-provider-card--connecting" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              disabled={busy}
              onClick={() => selectProvider(option.id)}
            >
              <span className="ai-provider-card__logo">
                <AiProviderIcon provider={option.id} />
              </span>
              <span className="ai-provider-card__text">
                <span className="ai-provider-card__name">{option.label}</span>
                <span className="ai-provider-card__vendor">
                  {option.description} · <code>{option.command}</code>
                </span>
              </span>
              {connected ? (
                <span className="ai-provider-card__badge">연결됨</span>
              ) : null}
              <span className="ai-provider-card__check" aria-hidden />
            </button>
          );
        })}
      </div>

      {selectedOption ? (
        <div className="ai-connection__detail" key={selectedOption.id}>
          <FormField label="실행 파일 경로 (선택)" width="wide">
            <input
              type="text"
              spellCheck={false}
              autoComplete="off"
              placeholder={`비우면 PATH에서 '${selectedOption.command}'를 자동으로 찾습니다`}
              disabled={busy}
              {...register("binaryPath")}
            />
          </FormField>

          <div className="ai-connection__actions">
            <Button type="submit" disabled={busy || alreadyConnected}>
              {busy ? "연결 중…" : alreadyConnected ? "연결됨" : "연결"}
            </Button>
            {ai.provider ? (
              <Button
                variant="ghost"
                disabled={busy}
                onClick={() => void handleDisconnect()}
              >
                연결 해제
              </Button>
            ) : null}
          </div>

          {ai.provider !== selectedOption.id ? (
            <Alert
              variant="info"
              title={`${selectedOption.label} 연결 팁`}
              className="ai-connection__tip"
            >
              <ol className="ai-connection__tip-steps">
                {AI_CONNECTION_TIPS[selectedOption.id].map((step) => (
                  <li key={step.label}>
                    <strong>{step.label}</strong>
                    <span>{step.text}</span>
                    {step.commands?.map((command) => (
                      <code key={command}>{command}</code>
                    ))}
                  </li>
                ))}
              </ol>
            </Alert>
          ) : null}
        </div>
      ) : (
        <p className="ai-connection__hint">연결할 AI 도구를 선택하세요.</p>
      )}

      {feedback ? (
        <Alert
          variant={feedback.variant}
          role={feedback.variant === "error" ? "alert" : "status"}
        >
          {feedback.text}
        </Alert>
      ) : null}
    </form>
  );
}
