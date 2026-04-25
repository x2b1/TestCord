/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./styles.css";

import { addChatBarButton, ChatBarButton, ChatBarButtonFactory, removeChatBarButton } from "@api/ChatButtons";
import { EquicordDevs, TestcordDevs } from "@utils/constants";
import definePlugin from "@utils/types";
import { findByPropsLazy } from "@webpack";
import { ContextMenuApi, Menu, React } from "@webpack/common";

const FormatIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24">
        <path fill="currentColor" d="m21.18 2.82-.45-1.2a.25.25 0 0 0-.46 0l-.45 1.2-1.2.45a.25.25 0 0 0 0 .46l1.2.45.45 1.2c.08.21.38.21.46 0l.45-1.2 1.2-.45a.25.25 0 0 0 0-.46l-1.2-.45ZM6.97 4.25l.76 2.02 2.02.76a.5.5 0 0 1 0 .94l-2.02.76-.76 2.02a.5.5 0 0 1-.94 0l-.76-2.02-2.02-.76a.5.5 0 0 1 0-.94l2.02-.76.76-2.02a.5.5 0 0 1 .94 0ZM18.53 7.6c.3-.3.3-.78 0-1.07l-1.06-1.06a.75.75 0 0 0-1.06 0l-1.94 1.94c-.3.3-.3.77 0 1.06l1.06 1.06c.3.3.77.3 1.06 0l1.94-1.94ZM14.53 11.6c.3-.3.3-.78 0-1.07l-1.06-1.06a.75.75 0 0 0-1.06 0l-9.94 9.94c-.3.3-.3.77 0 1.06l1.06 1.06c.3.3.77.3 1.06 0l9.94-9.94ZM20.73 13.27l-.76-2.02a.5.5 0 0 0-.94 0l-.76 2.02-2.02.76a.5.5 0 0 0 0 .94l2.02.76.76 2.02a.5.5 0 0 0 .94 0l.76-2.02 2.02-.76a.5.5 0 0 0 0-.94l-2.02-.76ZM10.73 1.62l.45 1.2 1.2.45c.21.08.21.38 0 .46l-1.2.45-.45 1.2a.25.25 0 0 1-.46 0l-.45-1.2-1.2-.45a.25.25 0 0 1 0-.46l1.2-.45.45-1.2a.25.25 0 0 1 .46 0Z" />
    </svg>
);

const FORMAT_KEYS = [
    { label: "Bold", tag: "**" },
    { label: "Italic", tag: "*" },
    { label: "Strike", tag: "~~" },
    { label: "Underline", tag: "_" },
    { label: "Inline Code", tag: "`" },
    { label: "Codeblock", tag: "```" },
    { label: "Blockquote", tag: ">" },
    { label: "Unordered List", tag: "-" },
    { label: "Spoiler", tag: "||" },
    { label: "Superscript", tag: "ˢᵘᵖᵉʳˢᶜʳᶦᵖᵗ" },
    { label: "Smallcaps", tag: "SᴍᴀʟʟCᴀᴘs" },
    { label: "Fullwidth", tag: "Ｆｕｌｌｗｉｄｔｈ" },
    { label: "Upsidedown", tag: "uʍopǝpᴉsd∩" },
    { label: "Varied", tag: "VaRiEd CaPs" },
    { label: "Leet", tag: "1337" },
    { label: "Extra Thicc", tag: "乇乂下尺卂 下卄工匚匚" }
];

const allLanguages: Record<string, Record<string, string>> = {
    C: { cpp: "C++", csharp: "C#", coffeescript: "CoffeeScript", css: "CSS" },
    H: { html: "HTML/XML" },
    J: { java: "Java", js: "JavaScript", json: "JSON" },
    M: { markdown: "Markdown" },
    P: { perl: "Perl", php: "PHP", py: "Python" },
    R: { ruby: "Ruby" },
    S: { sql: "SQL" },
    V: { vbnet: "VB.NET", vhdl: "VHDL" },
};

const upsidedownChars = " ¡\"#$%℘,)(*+'-˙/0ƖᄅƐㄣϛ9ㄥ86:;>=<¿@∀qƆpƎℲפHIſʞ˥WNOԀQɹS┴∩ΛMXλZ]\\[^‾,ɐqɔpǝɟƃɥᴉɾʞlɯuodbɹsʇnʌʍxʎz}|{";

const replaceList = " !\"#$%&'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuvwxyz{|}";
const smallCapsList = " !\"#$%&'()*+,-./0123456789:;<=>?@ᴀʙᴄᴅᴇғɢʜɪᴊᴋʟᴍɴᴏᴘǫʀsᴛᴜᴠᴡxʏᴢ{|}";
const superscriptList = " !\"#$%&'⁽⁾*⁺,⁻./⁰¹²³⁴⁵⁶⁷⁸⁹:;<⁼>?@ᴬᴮᶜᴰᴱᶠᴳᴴᴵᴶᴷᴸᴹᴺᴼᴾQᴿˢᵀᵁνᵂˣʸᶻ[\\]^_`ᵃᵇᶜᵈᵉᶠᵍʰᶦʲᵏˡᵐⁿᵒᵖᑫʳˢᵗᵘᵛʷˣʸᶻ{|}";
const fullwidthList = "　！＂＃＄％＆＇（）＊＋，－．／０１２３４５６７８９：；＜＝＞？＠ＡＢＣＤＥＦＧＨＩＪＫＬＭＮＯＰＱＲＳＴＵＶＷＸＹＺ［＼］＾＿｀ａｂｃｄｅｆｇｈｉｊｋｌｍｎｏｐｑｒｓｔｕｖｗｘｙｚ｛｜｝";
const leetList = " !\"#$%&'()*+,-./0123456789:;<=>?@48CD3FG#IJK1MN0PQЯ57UVWXY2[\\]^_`48cd3fg#ijk1mn0pqЯ57uvwxy2{|}";
const thiccList = "　!\"#$%&'()*+,-./0123456789:;<=>?@卂乃匚刀乇下厶卄工丁长乚从ん口尸㔿尺丂丅凵リ山乂丫乙[\\]^_`卂乃匚刀乇下厶卄工丁长乚从ん口尸㔿尺丂丅凵リ山乂丫乙{|}";

const Transforms = findByPropsLazy("insertNodes", "select", "setSelection");
const Editor = findByPropsLazy("start", "end", "toSlateRange");

let editorRef: any = null;

function getSlateEditor() {
    if (!editorRef?.current?.ref?.current) return null;
    return editorRef.current.ref.current.getSlateEditor();
}

function wrapOrUnwrap(wrapper: string, text: string): string {
    if (text.startsWith(wrapper) && text.endsWith(wrapper)) {
        return text.slice(wrapper.length, -wrapper.length);
    }
    return `${wrapper}${text}${wrapper}`;
}

function mapLines(prefix: string, text: string): string {
    return text.split("\n").map(line => {
        if (line.startsWith(prefix)) {
            return line.slice(prefix.length);
        }
        return `${prefix}${line}`;
    }).join("\n");
}

function mapChars(list: string, text: string): string {
    return text.split("").map(char => {
        const index = replaceList.indexOf(char);
        return index !== -1 ? list[index] : char;
    }).join("");
}

function formatText(tag: string, currentText: string): string {
    switch (tag) {
        case "**":
        case "*":
        case "~~":
        case "_":
        case "`":
        case "||":
            return wrapOrUnwrap(tag, currentText);
        case "```":
            if (currentText.startsWith("```") && currentText.endsWith("```")) {
                return currentText.slice(3, -3).trim();
            }
            return `\`\`\`\n${currentText}\n\`\`\``;
        case ">":
            return mapLines("> ", currentText);
        case "-":
            return mapLines("- ", currentText);
        case "ˢᵘᵖᵉʳˢᶜʳᶦᵖᵗ":
            return mapChars(superscriptList, currentText);
        case "SᴍᴀʟʟCᴀᴘs":
            return mapChars(smallCapsList, currentText);
        case "Ｆｕｌｌｗｉｄｔḥ":
            return mapChars(fullwidthList, currentText);
        case "uʍopǝpᴉsd∩":
            return mapChars(upsidedownChars, currentText).split("").reverse().join("");
        case "VaRiEd CaPs":
            return currentText.split("").map((char, i) => i % 2 === 0 ? char.toUpperCase() : char.toLowerCase()).join("");
        case "1337":
            return mapChars(leetList, currentText);
        case "乇乂下尺卂 下卄工匚匚":
            return mapChars(thiccList, currentText);
        default:
            return currentText;
    }
}

function applyFormat(tag: string) {
    const slate = getSlateEditor();
    console.log("[BFR] applyFormat slate:", !!slate, "selection:", !!slate?.selection);
    if (!slate || !slate.selection) {
        return;
    }

    const selection = slate.selection;
    const selectedText = Editor.string(slate, selection);
    console.log("[BFR] selectedText:", JSON.stringify(selectedText));
    if (!selectedText) return;

    const formattedText = formatText(tag, selectedText);
    console.log("[BFR] formattedText:", JSON.stringify(formattedText));

    slate.apply({ type: "deleteBackward", distance: selectedText.length });
    slate.apply({ type: "insert_text", text: formattedText, path: selection.anchor.path, offset: selection.anchor.offset });

    slate.selection = {
        anchor: { path: selection.anchor.path, offset: selection.anchor.offset + formattedText.length },
        focus: { path: selection.anchor.path, offset: selection.anchor.offset + formattedText.length }
    };
}

function CodeblockLanguageMenu({ onClose }: { onClose: () => void; }) {
    const handleInsertCodeblock = (lang: string) => {
        const slate = getSlateEditor();
        if (!slate) {
            onClose();
            return;
        }

        if (slate.selection) {
            const selectedText = Editor.string(slate, slate.selection);
            slate.apply({ type: "deleteBackward", distance: selectedText.length });
            slate.apply({ type: "insert_text", text: `\`\`\`${lang}\n${selectedText}\n\`\`\``, path: slate.selection.anchor.path, offset: slate.selection.anchor.offset });
        } else {
            slate.apply({ type: "insert_text", text: `\`\`\`${lang}\n\n\`\`\``, at: { path: [0], offset: 0 } });
        }
        onClose();
    };

    return (
        <Menu.Menu navId="bfr-codeblock-languages" onClose={onClose}>
            {Object.entries(allLanguages).map(([letter, langs]) => (
                <Menu.MenuGroup key={letter} label={letter}>
                    {Object.entries(langs).map(([lang, label]) => (
                        <Menu.MenuItem
                            key={lang}
                            id={`lang-${lang}`}
                            label={label}
                            onClick={() => handleInsertCodeblock(lang)}
                        />
                    ))}
                </Menu.MenuGroup>
            ))}
        </Menu.Menu>
    );
}

function FormatPopup({ onClose }: { onClose: () => void; }) {
    const handleFormat = (tag: string) => {
        if (tag === "```") {
            ContextMenuApi.openContextMenu(undefined as unknown as React.MouseEvent, () => (
                <CodeblockLanguageMenu onClose={ContextMenuApi.closeContextMenu} />
            ));
            return;
        }

        applyFormat(tag);
        onClose();
    };

    return (
        <Menu.Menu navId="bfr-format-menu" onClose={onClose}>
            <Menu.MenuGroup>
                {FORMAT_KEYS.slice(0, 9).map(({ label, tag }) => (
                    <Menu.MenuItem
                        key={tag}
                        id={`format-${tag}`}
                        label={label}
                        onClick={() => handleFormat(tag)}
                    />
                ))}
            </Menu.MenuGroup>
            <Menu.MenuSeparator />
            <Menu.MenuGroup label="Text Transforms">
                {FORMAT_KEYS.slice(9).map(({ label, tag }) => (
                    <Menu.MenuItem
                        key={tag}
                        id={`format-${tag}`}
                        label={label}
                        onClick={() => handleFormat(tag)}
                    />
                ))}
            </Menu.MenuGroup>
        </Menu.Menu>
    );
}

const FormatButton: ChatBarButtonFactory = ({ isMainChat }) => {
    if (!isMainChat) return null;

    return (
        <ChatBarButton
            tooltip="Text Formatting"
            onClick={e => {
                ContextMenuApi.openContextMenu(e as unknown as React.MouseEvent, () => (
                    <FormatPopup onClose={ContextMenuApi.closeContextMenu} />
                ));
            }}
        >
            <FormatIcon />
        </ChatBarButton>
    );
};

export default definePlugin({
    name: "BetterFormattingRedux",
    description: "Adds a button to enable different text formatting options in the input-bar.",
    tags: ["Chat", "Utility"],
    authors: [TestcordDevs.x2b, EquicordDevs.omaw],
    dependencies: ["ChatInputButtonAPI"],

    patches: [
        {
            find: ".CREATE_FORUM_POST||",
            replacement: {
                match: /(?<=,editorRef:(\i),.{0,200}textValue:(\i),editorHeight:\i,channelId:\i\.id\}\)),\i/,
                replace: "$self.setEditorRef($1);"
            }
        }
    ],

    setEditorRef(ref: any) {
        editorRef = { current: ref };
        console.log("[BFR] setEditorRef called:", !!ref, "ref type:", typeof ref);
    },

    start: () => {
        addChatBarButton("BetterFormattingRedux", FormatButton, FormatIcon);
    },
    stop: () => {
        removeChatBarButton("BetterFormattingRedux");
        editorRef = null;
    }
});
