import definePlugin from "@utils/types";

let clickListener: (e: MouseEvent) => void;

export default definePlugin({
    name: "DoubleEmoji",
    description: "Keeps the emoji picker open on click and highlights selected emojis with a blue border.",
    authors: [{ name: "Nightcord", id: 0n }],
    enabledByDefault: true,

    start() {
        clickListener = (e: MouseEvent) => {
            const target = e.target as HTMLElement;
            const emojiWrapper = target.closest("[class*='emojiItem'], [class*='EmojiItem']") as HTMLElement;
            if (!emojiWrapper) return;
            if (!target.closest("[class*='emojiPicker'], #emoji-picker-tab-panel, [class*='expressionPicker']")) return;

            emojiWrapper.style.border = "1px solid #5865f2";
            emojiWrapper.style.borderRadius = "4px";
            emojiWrapper.style.background = "rgba(88, 101, 242, 0.05)";
            
            try { Object.defineProperty(e, "shiftKey", { get: () => true, configurable: true }); } catch (err) {}
        };
        
        document.addEventListener("click", clickListener, { capture: true });
    },
    stop() {
        if (clickListener) {
            document.removeEventListener("click", clickListener, { capture: true });
        }
    }
});
