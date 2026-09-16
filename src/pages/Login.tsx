import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { open } from "@tauri-apps/plugin-dialog";
import { Button } from "@/components/common/Button";
import { AppIntro } from "@/components/common/AppIntro";
import { AuthMethodToggle } from "@/components/login/AuthMethodToggle";
import { LoginHistoryPanel } from "@/components/login/LoginHistoryPanel";
import { FormField, FormSection } from "@/components/common/FormField";
import { useEc2Login } from "@/hooks/useEc2Login";
import {
  cachedFormToCredentials,
  consumeSkipAutoLogin,
  getDefaultLoginFormValues,
  loadLoginCache,
  loadLoginHistory,
  removeLoginHistoryEntry,
  type CachedLoginForm,
  type CachedLoginHistoryEntry,
} from "@/lib/loginCache";
import { useConnectionStore } from "@/stores/connectionStore";

type LoginFormValues = CachedLoginForm;

export function LoginPage() {
  const { login, isConnecting, errorMessage } = useEc2Login();
  const [history, setHistory] = useState<CachedLoginHistoryEntry[]>(() =>
    loadLoginHistory(),
  );
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    trigger,
    formState: { isValid },
  } = useForm<LoginFormValues>({
    mode: "onChange",
    defaultValues: getDefaultLoginFormValues(),
  });

  const authMethod = watch("authMethod");

  useEffect(() => {
    void trigger(["password", "privateKeyPath"]);
  }, [authMethod, trigger]);

  useEffect(() => {
    if (consumeSkipAutoLogin()) {
      return;
    }

    const cached = loadLoginCache();
    if (!cached) {
      return;
    }

    const { status } = useConnectionStore.getState();
    if (status === "connecting" || status === "connected") {
      return;
    }

    void login(cachedFormToCredentials(cached));
  }, [login]);

  async function pickPrivateKeyFile() {
    const selected = await open({
      multiple: false,
      filters: [{ name: "Private Key", extensions: ["pem", "key"] }],
    });

    if (typeof selected === "string") {
      setValue("privateKeyPath", selected, {
        shouldValidate: true,
        shouldDirty: true,
      });
    }
  }

  async function onSubmit(data: LoginFormValues) {
    const ok = await login(cachedFormToCredentials(data));
    if (ok) {
      setHistory(loadLoginHistory());
    }
  }

  async function loginFromHistory(entry: CachedLoginHistoryEntry) {
    setValue("host", entry.host, { shouldValidate: true });
    setValue("username", entry.username, { shouldValidate: true });
    setValue("port", entry.port, { shouldValidate: true });
    setValue("authMethod", entry.authMethod, { shouldValidate: true });
    setValue("privateKeyPath", entry.privateKeyPath, { shouldValidate: true });
    setValue("keyPassphrase", entry.keyPassphrase, { shouldValidate: true });
    setValue("password", entry.password, { shouldValidate: true });

    const ok = await login(cachedFormToCredentials(entry));
    if (ok) {
      setHistory(loadLoginHistory());
    }
  }

  function handleRemoveHistory(id: string) {
    setHistory(removeLoginHistoryEntry(id));
  }

  const canSubmit = isValid && !isConnecting;

  return (
    <div className="login-page">
      <div className="login-page__layout">
        <div className="login-card">
          <header className="login-card__header">
            <AppIntro
              eyebrow="SSH 접속"
              subtitle="PEM 키 또는 비밀번호로 EC2에 연결합니다."
              subtitleClassName="login-card__subtitle"
            />
          </header>

          <form className="login-form" onSubmit={handleSubmit(onSubmit)}>
            <FormSection title="서버 정보">
              <div className="login-form__grid">
                <FormField label="IP 주소" width="wide">
                  <input
                    type="text"
                    autoComplete="off"
                    placeholder="13.124.12.34"
                    disabled={isConnecting}
                    {...register("host", {
                      required: true,
                      validate: (value) =>
                        value.trim().length > 0 || "IP 주소를 입력해 주세요.",
                    })}
                  />
                </FormField>
                <FormField label="포트" width="narrow">
                  <input
                    type="number"
                    min={1}
                    max={65535}
                    disabled={isConnecting}
                    {...register("port", {
                      required: true,
                      valueAsNumber: true,
                      min: 1,
                      max: 65535,
                    })}
                  />
                </FormField>
              </div>
              <FormField label="아이디">
                <input
                  type="text"
                  autoComplete="username"
                  placeholder="root"
                  disabled={isConnecting}
                  {...register("username", {
                    required: true,
                    validate: (value) =>
                      value.trim().length > 0 || "아이디를 입력해 주세요.",
                  })}
                />
              </FormField>
            </FormSection>

            <FormSection title="인증">
              <input
                type="hidden"
                {...register("authMethod", { required: true })}
              />
              <AuthMethodToggle
                value={authMethod}
                disabled={isConnecting}
                onChange={(method) =>
                  setValue("authMethod", method, { shouldValidate: true })
                }
              />

              <div className="login-form__auth-panel">
                {authMethod === "pem" ? (
                  <>
                    <FormField label="개인 키 파일" as="div">
                      <div className="form-field__row">
                        <input
                          type="text"
                          readOnly
                          className="form-field__path"
                          placeholder="PEM 또는 KEY 파일"
                          disabled={isConnecting}
                          {...register("privateKeyPath", {
                            validate: (value) =>
                              authMethod !== "pem" ||
                              value.trim().length > 0 ||
                              "키 파일을 선택해 주세요.",
                          })}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          disabled={isConnecting}
                          onClick={() => void pickPrivateKeyFile()}
                        >
                          찾아보기
                        </Button>
                      </div>
                    </FormField>
                    <FormField label="키 암호 (선택)">
                      <input
                        type="password"
                        autoComplete="off"
                        placeholder="암호화된 키인 경우만 입력"
                        disabled={isConnecting}
                        {...register("keyPassphrase")}
                      />
                    </FormField>
                  </>
                ) : (
                  <FormField label="비밀번호">
                    <input
                      type="password"
                      autoComplete="current-password"
                      placeholder="SSH 비밀번호"
                      disabled={isConnecting}
                      {...register("password", {
                        validate: (value) =>
                          authMethod !== "password" ||
                          value.length > 0 ||
                          "비밀번호를 입력해 주세요.",
                      })}
                    />
                  </FormField>
                )}
              </div>
            </FormSection>

            {errorMessage ? (
              <p className="login-form__error" role="alert">
                {errorMessage}
              </p>
            ) : null}

            <Button
              type="submit"
              variant="primary"
              activateOnEnter
              className="login-form__submit"
              disabled={!canSubmit}
            >
              {isConnecting ? "접속 중..." : "접속하기"}
            </Button>
          </form>
        </div>

        <LoginHistoryPanel
          entries={history}
          disabled={isConnecting}
          onSelect={(entry) => void loginFromHistory(entry)}
          onRemove={handleRemoveHistory}
        />
      </div>
    </div>
  );
}
