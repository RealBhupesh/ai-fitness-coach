export type VoiceFeedbackPriority = "critical" | "warning" | "info";

type VoiceQueueItem = {
  message: string;
  priority: VoiceFeedbackPriority;
};

const PRIORITY_WEIGHT: Record<VoiceFeedbackPriority, number> = {
  critical: 3,
  warning: 2,
  info: 1,
};

const COOLDOWN_MS: Record<VoiceFeedbackPriority, number> = {
  critical: 1_500,
  warning: 3_500,
  info: 5_000,
};

export function createVoiceFeedbackController() {
  let enabled = true;
  let speaking = false;
  let lastSpokenAt = 0;
  let lastMessage = "";
  const queue: VoiceQueueItem[] = [];

  const speakNext = () => {
    if (!enabled || speaking || typeof window === "undefined" || !("speechSynthesis" in window)) {
      return;
    }

    const next = queue.shift();
    if (!next?.message) {
      return;
    }

    const utterance = new SpeechSynthesisUtterance(next.message);
    speaking = true;
    utterance.onend = () => {
      speaking = false;
      speakNext();
    };
    utterance.onerror = () => {
      speaking = false;
      speakNext();
    };

    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
    lastSpokenAt = Date.now();
    lastMessage = next.message;
  };

  return {
    getEnabled() {
      return enabled;
    },
    setEnabled(next: boolean) {
      enabled = next;
      if (!enabled && typeof window !== "undefined" && "speechSynthesis" in window) {
        queue.length = 0;
        speaking = false;
        window.speechSynthesis.cancel();
      }
    },
    speak(message: string, priority: VoiceFeedbackPriority) {
      if (!enabled || !message) {
        return;
      }

      const now = Date.now();
      if (message === lastMessage && now - lastSpokenAt < 10_000) {
        return;
      }

      const cooldownMs = COOLDOWN_MS[priority];
      if (now - lastSpokenAt < cooldownMs && priority !== "critical") {
        return;
      }

      queue.push({ message, priority });
      queue.sort((a, b) => PRIORITY_WEIGHT[b.priority] - PRIORITY_WEIGHT[a.priority]);
      speakNext();
    },
    stop() {
      queue.length = 0;
      speaking = false;
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    },
  };
}
