export type VoiceFeedbackPriority = "critical" | "warning" | "info";
export type VoiceFeedbackStyle = "calm" | "balanced" | "strict";

type VoiceQueueItem = {
  message: string;
  priority: VoiceFeedbackPriority;
  signature: string;
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
  let style: VoiceFeedbackStyle = "balanced";
  let speaking = false;
  let lastSpokenAt = 0;
  let lastMessage = "";
  let lastSignature = "";
  const lastSpokenBySignature: Record<string, number> = {};
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
    utterance.rate = style === "strict" ? 0.98 : style === "calm" ? 0.86 : 0.92;
    utterance.pitch = style === "strict" ? 0.96 : style === "calm" ? 1.04 : 1;
    utterance.volume = style === "calm" ? 0.82 : 0.9;
    const voices = window.speechSynthesis.getVoices?.() ?? [];
    const preferredVoice = voices.find((voice) => /samantha|karen|moira|zira|female|google uk english female/i.test(voice.name)) ?? voices.find((voice) => /^en[-_]/i.test(voice.lang));
    if (preferredVoice) {
      utterance.voice = preferredVoice;
    }
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
    lastSignature = next.signature;
    lastSpokenBySignature[next.signature] = lastSpokenAt;
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
    setStyle(next: VoiceFeedbackStyle) {
      style = next;
    },
    speak(message: string, priority: VoiceFeedbackPriority, signature?: string) {
      if (!enabled || !message) {
        return;
      }

      const now = Date.now();
      const normalizedSignature = signature || message.trim().toLowerCase().replace(/\s+/g, " ");
      const lastForSignature = lastSpokenBySignature[normalizedSignature] ?? 0;
      if (message === lastMessage && now - lastSpokenAt < 10_000) {
        return;
      }
      if (normalizedSignature === lastSignature && now - lastForSignature < 12_000 && priority !== "critical") {
        return;
      }

      const cooldownMs = COOLDOWN_MS[priority];
      if (now - lastSpokenAt < cooldownMs && priority !== "critical") {
        return;
      }
      if (now - lastForSignature < (priority === "warning" ? 12_000 : 16_000) && priority !== "critical") {
        return;
      }
      if (queue.some((item) => item.signature === normalizedSignature)) {
        return;
      }

      queue.push({ message, priority, signature: normalizedSignature });
      queue.sort((a, b) => PRIORITY_WEIGHT[b.priority] - PRIORITY_WEIGHT[a.priority]);
      speakNext();
    },
    stop() {
      queue.length = 0;
      speaking = false;
      lastMessage = "";
      lastSignature = "";
      Object.keys(lastSpokenBySignature).forEach((key) => delete lastSpokenBySignature[key]);
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    },
  };
}
