import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import "./css/ai-chatbot.css";

interface AiChatbotContextValue {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
}

const AiChatbotContext = createContext<AiChatbotContextValue | null>(null);

const ICON_SWAP_MS = 3200;

function AiChatbotToggle({
  isOpen,
  onToggle,
}: {
  isOpen: boolean;
  onToggle: () => void;
}) {
  const [showActiveIcon, setShowActiveIcon] = useState(false);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setShowActiveIcon((current) => !current);
    }, ICON_SWAP_MS);
    return () => window.clearInterval(timer);
  }, []);

  return createPortal(
    <button
      type="button"
      className={[
        "ai-chatbot-toggle",
        isOpen ? "ai-chatbot-toggle--open" : "",
        showActiveIcon ? "ai-chatbot-toggle--alt" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      aria-label={isOpen ? "AI 챗봇 닫기" : "AI 챗봇 열기"}
      aria-pressed={isOpen}
      onClick={onToggle}
    >
      <span className="ai-chatbot-toggle__icons" aria-hidden>
        <img
          className="ai-chatbot-toggle__icon ai-chatbot-toggle__icon--idle"
          src="/ai-icon2.png"
          alt=""
          draggable={false}
        />
        <img
          className="ai-chatbot-toggle__icon ai-chatbot-toggle__icon--active"
          src="/ai-icon1.png"
          alt=""
          draggable={false}
        />
      </span>
    </button>,
    document.body,
  );
}

export function AiChatbotProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);
  const toggle = useCallback(() => setIsOpen((current) => !current), []);

  const value = useMemo<AiChatbotContextValue>(
    () => ({ isOpen, open, close, toggle }),
    [isOpen, open, close, toggle],
  );

  return (
    <AiChatbotContext.Provider value={value}>
      {children}
      <AiChatbotToggle isOpen={isOpen} onToggle={toggle} />
    </AiChatbotContext.Provider>
  );
}

export function useAiChatbot(): AiChatbotContextValue {
  const context = useContext(AiChatbotContext);
  if (!context) {
    throw new Error("useAiChatbot must be used within AiChatbotProvider");
  }
  return context;
}
