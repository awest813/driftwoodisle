import { MobileControls } from "./MobileControls";

/** Desktop vs touch phrasing for prompts, hints, and notifications. */
export class InputCopy {
    static prefersTouch(): boolean {
        return document.body.classList.contains("mobile-active")
            || MobileControls.isLikelyTouchDevice();
    }

    static primaryAction(): string {
        return this.prefersTouch() ? "Tap" : "Click";
    }

    static formatInteractPrompt(prompt: string): string {
        const primary = this.primaryAction();
        return prompt
            .replace(/\[Click\]\s*/gi, `${primary} - `)
            .replace(/\bClick\b/g, primary);
    }

    static attackAction(): string {
        return `${this.primaryAction()} - Attack`;
    }

    static reelPrompt(): string {
        return this.prefersTouch()
            ? "Bite! Tap the Fish button to reel!"
            : "Bite! Right-click to reel!";
    }

    static buildingModeHint(type: string): string {
        const action = this.primaryAction();
        if (this.prefersTouch()) {
            return `Building mode: Place ${type}. ${action} to place · ESC to cancel.`;
        }
        return `Building mode: Place ${type}. ${action} to place, R to rotate, ESC to cancel.`;
    }

    static formatConsumeLabel(label: string): string {
        return label.replace(/\bClick\b/gi, this.primaryAction());
    }
}
