import { React, useState, useEffect, useRef, ReactDOM, createRoot, MessageActions, SelectedChannelStore, ComponentDispatch } from "@webpack/common";
import { getGroqKey } from "../../nightcordAI/groqManager";

const DICT_URLS = [
    "https://raw.githubusercontent.com/words/an-array-of-french-words/master/index.json",
    "https://raw.githubusercontent.com/nightcordoff/dicofr/refs/heads/main/dico.txt"
];

// Quelques mots de secours au cas où le chargement échoue
const FALLBACK_WORDS = ["maison", "chat", "chien", "soleil", "pomme", "banane", "ordinateur", "clavier", "souris", "ecran", "table", "chaise", "fenetre", "porte", "voiture", "avion", "bateau", "train", "velo", "moto"];

let overlayRoot: any = null;
let overlayContainer: HTMLDivElement | null = null;

const memStorage: Record<string, string> = {};
function getSetting(key: string, def: string) {
    try { if (window.localStorage && window.localStorage.getItem(key) !== null) return window.localStorage.getItem(key)!; } catch {}
    return memStorage[key] !== undefined ? memStorage[key] : def;
}
function setSetting(key: string, val: string) {
    memStorage[key] = val;
    try { if (window.localStorage) window.localStorage.setItem(key, val); } catch {}
}

export async function toggleWordBombOverlay() {
    if (overlayContainer) {
        unmountOverlay();
    } else {
        mountOverlay();
    }
}

function mountOverlay() {
    if (document.getElementById("nc-wb-root")) return;
    overlayContainer = document.createElement("div");
    overlayContainer.id = "nc-wb-root";
    document.body.appendChild(overlayContainer);

    try {
        if (createRoot) {
            overlayRoot = createRoot(overlayContainer);
            overlayRoot.render(<WordBombOverlay />);
        } else {
            ReactDOM.render(<WordBombOverlay />, overlayContainer);
        }
    } catch (e) {
        console.error("[WordBomb] Erreur de montage:", e);
    }
}

function unmountOverlay() {
    try { overlayRoot?.unmount(); } catch { }
    overlayContainer?.remove();
    overlayContainer = null;
    overlayRoot = null;
}

export function WordBombOverlay() {
    const [alphabet, setAlphabet] = useState<string[]>("abcdefghijklmnopqrstuvwxyz".split(""));
    const [dictionary, setDictionary] = useState<string[]>(FALLBACK_WORDS);
    const [syllable, setSyllable] = useState("");
    const [status, setStatus] = useState("Ready!");
    const [history, setHistory] = useState<{ alphabet: string[], word: string; }[]>([]);
    const [isTyping, setIsTyping] = useState(false);
    const isTypingRef = useRef(false);
    const [isDragging, setIsDragging] = useState(false);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [badWords, setBadWords] = useState<Set<string>>(new Set());
    const [definition, setDefinition] = useState("");
    const [pos, setPos] = useState({ x: 100, y: 100 });
    const dragOffset = useRef({ x: 0, y: 0 });
    const inputRef = useRef<HTMLInputElement>(null);

    // Calibrage supprimé — le clic est toujours au centre dynamique de la fenêtre Discord
    const [lps, setLps] = useState(() => parseFloat(getSetting("wb_lps", "50")));
    const [humanChance, setHumanChance] = useState(() => parseInt(getSetting("wb_humanChance", "0")));
    const [safeMode, setSafeMode] = useState(() => getSetting("wb_safeMode", "true") === "true");
    const [theme, setTheme] = useState(() => getSetting("wb_theme", ""));
    const [themeWords, setThemeWords] = useState<Set<string>>(new Set());
    const [playMode, setPlayMode] = useState(() => getSetting("wb_playMode", "Normal"));
    const [noSpace, setNoSpace] = useState(() => getSetting("wb_noSpace", "false") === "true");    // Load dictionary
    useEffect(() => {
        setStatus("Loading dictionaries...");
        Promise.all(DICT_URLS.map(url => fetch(url).then(async res => {
            if (!res.ok) return [];
            if (url.endsWith('.json')) return await res.json();
            const text = await res.text();
            // Handle frequency list (word frequency) or plain list
            return text.split(/[\r\n]+/).map(line => {
                const parts = line.trim().split(/\s+/);
                return parts[0]; // Take the word, ignore frequency for now (sorted by frequency in source)
            }).filter(w => w.length > 0);
        }).catch(() => [])))
            .then(results => {
                const allWords = results.flat() as string[];
                const uniqueWords = Array.from(new Set(allWords))
                    .filter(w => {
                        // 1. Filtrage par longueur (les mots trop longs sont souvent des lieux ou techniques)
                        if (w.length < 3 || w.length > 15) return false;
                        
                        // 2. Filtrage des Noms Propres : si le mot commence par une Majuscule dans la source
                        // c'est presque toujours un nom de lieu, de personne ou une marque.
                        if (w[0] === w[0].toUpperCase()) return false;
                        
                        // 3. Filtrage des abréviations (tout en majuscule)
                        if (w === w.toUpperCase() && w.length > 1) return false; 

                        // 4. Caractères français uniquement
                        return /^[a-zœæéèêëàâäîïôöùûüç]+$/i.test(w);
                    })
                    .map(w => w.toLowerCase());
                
                const finalSet = Array.from(new Set(uniqueWords));

                if (finalSet.length > 0) {
                    setDictionary(finalSet);
                    setStatus(`Ready! (${finalSet.length} words)`);
                } else {
                    setDictionary(FALLBACK_WORDS);
                    setStatus("Dict. unavailable");
                }
            })
            .catch(err => {
                console.error("[WordBomb] Dictionary load error:", err);
                setStatus("Dict. error (fallback active)");
            });
    }, []);

    // Theme logic
    useEffect(() => {
        if (!theme.trim()) {
            setThemeWords(new Set());
            return;
        }
        fetch(`https://fr.wikipedia.org/w/api.php?action=query&list=search&srsearch=${theme}&utf8=&format=json&srlimit=1`)
            .then(r => r.json())
            .then(d => {
                if (d.query?.search?.[0]?.pageid) {
                    const pageId = d.query.search[0].pageid;
                    return fetch(`https://fr.wikipedia.org/w/api.php?action=query&prop=extracts&explaintext=1&pageids=${pageId}&format=json`);
                }
                throw new Error("No page");
            })
            .then(r => r.json())
            .then(d => {
                const pages = d.query?.pages;
                if (pages) {
                    const text = Object.values(pages)[0] as any;
                    if (text && text.extract) {
                        const words = text.extract.toLowerCase().match(/[a-zàâçéèêëîïôûùüÿñæœ]+/g) || [];
                        const unique = new Set<string>(words.filter((w: string) => w.length > 3));
                        setThemeWords(unique);
                    }
                }
            }).catch(() => setThemeWords(new Set()));
    }, [theme]);

    // Draggable logic
    const handleMouseDown = (e: React.MouseEvent) => {
        setIsDragging(true);
        dragOffset.current = {
            x: e.clientX - pos.x,
            y: e.clientY - pos.y
        };
    };

    useEffect(() => {
        let rafId: number;
        
        const handleMouseMove = (e: MouseEvent) => {
            if (!isDragging) return;
            
            // On utilise requestAnimationFrame pour lisser le mouvement
            if (rafId) cancelAnimationFrame(rafId);
            rafId = requestAnimationFrame(() => {
                const newX = e.clientX - dragOffset.current.x;
                const newY = e.clientY - dragOffset.current.y;
                
                // On met à jour la position
                setPos({ x: newX, y: newY });
            });
        };
        
        const handleMouseUp = () => {
            setIsDragging(false);
            if (rafId) cancelAnimationFrame(rafId);
        };

        if (isDragging) {
            window.addEventListener("mousemove", handleMouseMove, { passive: true });
            window.addEventListener("mouseup", handleMouseUp);
        }
        return () => {
            window.removeEventListener("mousemove", handleMouseMove);
            window.removeEventListener("mouseup", handleMouseUp);
            if (rafId) cancelAnimationFrame(rafId);
        };
    }, [isDragging]);

    const startCalibrate = async () => {
        setIsCalibrating(true);
        setStatus("Place ta souris sur la zone de texte du jeu, puis appuie sur Espace...");

        const onKeyDown = async (e: KeyboardEvent) => {
            if (e.code !== "Space") return;
            e.preventDefault();
            e.stopPropagation();
            window.removeEventListener("keydown", onKeyDown, true);

            try {
                // VencordNative est exposé via contextBridge sous le nom "VencordNative"
                // Dans le renderer Electron packagé, il faut passer par window
                const nc = (window as any).VencordNative ?? (globalThis as any).VencordNative;
                const cursorPos = await nc?.wordBomb?.getCursorPos?.() || await nc?.worldBomb?.getCursorPos?.();
                if (cursorPos && typeof cursorPos.x === "number" && typeof cursorPos.y === "number") {
                    setCalibratedPos(cursorPos);
                    setSetting("wb_calibPos", JSON.stringify(cursorPos));
                    setStatus(`✅ Calibré: (${cursorPos.x}, ${cursorPos.y})`);
                } else {
                    // Fallback: essayer via ipcRenderer directement
                    const { ipcRenderer } = (window as any).require?.("electron") ?? {};
                    if (ipcRenderer) {
                        const pos = await ipcRenderer.invoke("WorldBombGetCursorPos");
                        if (pos && typeof pos.x === "number") {
                            setCalibratedPos(pos);
                            setSetting("wb_calibPos", JSON.stringify(pos));
                            setStatus(`✅ Calibré: (${pos.x}, ${pos.y})`);
                        } else {
                            setStatus("❌ Position invalide reçue: " + JSON.stringify(pos));
                        }
                    } else {
                        setStatus("❌ getCursorPos indisponible (nc=" + typeof nc + ")");
                    }
                }
            } catch (err) {
                setStatus("❌ Erreur calibrage: " + String(err));
            } finally {
                setIsCalibrating(false);
                setTimeout(() => inputRef.current?.focus(), 100);
            }
        };

        window.addEventListener("keydown", onKeyDown, true);
    };

    const processSearch = (syl: string, isReroll = false) => {
        if (isTypingRef.current) return;
        const query = syl || syllable;
        if (!query || dictionary.length === 0) return;

        const sylLower = query.toLowerCase();
        // Filtrer les mots qui contiennent la syllabe et ne sont pas dans les "bad words"
        let matches = dictionary.filter(w => {
            const low = w.toLowerCase();
            if (!low.includes(sylLower)) return false;
            if (badWords.has(low)) return false;
            if (noSpace && (low.includes(' ') || low.includes('-'))) return false;
            if (playMode === "Pro" && low.length < 13) return false;
            if (playMode === "Noob" && low.length > 7) return false;
            return true;
        });

        if (themeWords.size > 0) {
            const themeMatches = matches.filter(w => themeWords.has(w.toLowerCase()));
            if (themeMatches.length > 0) matches = themeMatches;
        }

        if (matches.length === 0) {
            setStatus("No words found");
            return;
        }

        // Priorisation : mots qui contiennent des lettres de l'alphabet restant
        const rareLetters = "zyxwvkq".split("");
        const sortedRemaining = [...alphabet].sort((a, b) => {
            const aIsRare = rareLetters.includes(a);
            const bIsRare = rareLetters.includes(b);
            if (aIsRare && !bIsRare) return -1;
            if (!aIsRare && bIsRare) return 1;
            if (aIsRare && bIsRare) return rareLetters.indexOf(a) - rareLetters.indexOf(b);
            return 0;
        });

        const computeScore = (w: string, currentMissing: string[], index: number) => {
            let score = 0;
            let found = new Set();
            for (let char of w) {
                if (currentMissing.includes(char) && !found.has(char)) {
                    score += 100; // Alphabet letters are priority #1
                    found.add(char);
                }
            }
            
            // Frequency score: words earlier in the dictionary (more frequent) get a bonus
            // We use a relative bonus based on the index
            const frequencyBonus = Math.max(0, 100 - (index / 1000)); 
            score += frequencyBonus;

            // Mode specific length adjustments
            if (playMode === "Pro") score += w.length * 5;
            else if (playMode === "Noob") score -= w.length * 10;

            if (themeWords.has(w)) score += 1000;
            return score;
        };

        let targetWord = "";
        let bestScore = -Infinity;

        for (let i = 0; i < matches.length; i++) {
            const w = matches[i];
            const s = computeScore(w, alphabet, i);
            if (s > bestScore) {
                bestScore = s;
                targetWord = w;
            }
        }


        if (!isReroll) {
            setHistory(prev => [...prev, { alphabet: [...alphabet], word: targetWord }]);
        }

        const newAlphabet = alphabet.filter(l => !targetWord.toLowerCase().includes(l));
        setAlphabet(newAlphabet.length === 0 ? "abcdefghijklmnopqrstuvwxyz".split("") : newAlphabet);

        sendWord(targetWord);
        if (!isReroll) setSyllable("");
    };

    const handleReroll = () => {
        if (history.length === 0) return;
        const last = history[history.length - 1];
        const newHistory = history.slice(0, -1);

        setBadWords(prev => new Set(prev).add(last.word.toLowerCase()));
        setAlphabet(last.alphabet);
        setHistory(newHistory);

        processSearch(syllable, true);
    };

    const sendWord = async (word: string) => {
        isTypingRef.current = true;
        setIsTyping(true);
        setStatus(`Typing: ${word}...`);

        if (safeMode) {
            setDefinition("Generating AI definition...");
            const groqKey = await getGroqKey().catch(() => "");
            if (!groqKey) {
                setDefinition("Error: Groq API key missing in NightcordAI.");
            } else {
                fetch("https://api.groq.com/openai/v1/chat/completions", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${groqKey}`,
                    },
                    body: JSON.stringify({
                        model: "llama-3.1-8b-instant",
                        temperature: 0.7,
                        max_tokens: 150,
                        messages: [{
                            role: "user",
                            content: `Donne une très courte définition (1 phrase simple) pour le mot suivant, en expliquant ce que c'est concrètement, sans donner sa nature grammaticale. Fais-le obligatoirement en français. Mot: "${word}"`
                        }]
                    }),
                })
                .then(r => r.json())
                .then(data => {
                    const ans = data.choices?.[0]?.message?.content?.trim();
                    if (ans) {
                        setDefinition(ans);
                    } else {
                        setDefinition("AI could not define this word.");
                    }
                }).catch(() => setDefinition("Network error (Groq API)."));
            }
        } else {
            setDefinition("");
        }

        const wbNative = (window as any).VencordNative?.wordBomb || (window as any).VencordNative?.worldBomb;

        try {
            if (wbNative?.sequence) {
                // Toujours -1,-1 : le main process calcule le centre de la fenêtre dynamiquement
                await wbNative.sequence(word, lps, humanChance, -1, -1);
            } else {
                // Fallback : mode chat Discord classique (pas en jeu)
                if (document.activeElement instanceof HTMLElement) {
                    document.activeElement.blur();
                }
                for (const char of word) {
                    ComponentDispatch.dispatchToLastSubscribed("INSERT_TEXT", {
                        rawText: char,
                        plainText: char
                    });
                    await new Promise(r => setTimeout(r, 30));
                }
                ComponentDispatch.dispatchToLastSubscribed("SUBMIT");
            }
            setStatus("Prêt !");
        } catch (e) {
            console.error("[WordBomb] Erreur saisie:", e);
            setStatus("Erreur de saisie");
        } finally {
            isTypingRef.current = false;
            setIsTyping(false);
            // Refocus the input field automatically so the user never has to use the mouse
            setTimeout(() => {
                inputRef.current?.focus();
            }, 50);
        }
    };

    return (
        <div
            className={`nc-wb-overlay ${isDragging ? 'dragging' : ''}`}
            style={{
                position: 'fixed',
                top: pos.y,
                left: pos.x,
                background: '#1f2937',
                color: 'white',
                borderRadius: '16px',
                padding: '16px',
                width: '300px',
                boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
                pointerEvents: isTyping ? 'none' : 'auto',
                opacity: isTyping ? 0.7 : 1,
                zIndex: 9999
            }}
        >
            <div className="nc-wb-header" onMouseDown={handleMouseDown} style={{ cursor: 'move', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                <h3 style={{ margin: 0, fontSize: '16px' }}>🎯 WordBomb Helper</h3>
                <div className="nc-wb-close" onClick={unmountOverlay} style={{ cursor: 'pointer', opacity: 0.7 }}>✕</div>
            </div>

            <div className="nc-wb-content">
                {!isSettingsOpen ? (
                    <>
                        <div className="nc-wb-alphabet" style={{ display: 'grid', gridTemplateColumns: 'repeat(9, 1fr)', gap: '4px', marginBottom: '15px' }}>
                            {alphabet.map((l, i) => (
                                <span key={i} className="nc-wb-letter" style={{ fontSize: '10px', textAlign: 'center', opacity: 0.8 }}>{l.toUpperCase()}</span>
                            ))}
                        </div>

                        <div className="nc-wb-input-container" style={{ marginBottom: '15px' }}>
                            <input
                                ref={inputRef}
                                type="text"
                                className="nc-wb-input"
                                placeholder="Syllable..."
                                value={syllable}
                                onChange={(e) => setSyllable(e.target.value)}
                                onKeyDown={(e) => e.key === "Enter" && processSearch(syllable)}
                                style={{ width: '100%', padding: '8px', borderRadius: '8px', border: 'none', background: '#374151', color: 'white' }}
                            />
                        </div>

                        <div style={{ display: 'flex', gap: '8px' }}>
                            <button className="nc-wb-button" onClick={() => processSearch(syllable)} style={{ flex: 1, padding: '10px', background: '#7c3aed', border: 'none', borderRadius: '8px', color: 'white', cursor: 'pointer' }}>
                                FIND
                            </button>
                            <button
                                style={{
                                    width: '45px',
                                    height: '45px',
                                    background: 'rgba(255, 255, 255, 0.1)',
                                    border: 'none',
                                    borderRadius: '12px',
                                    color: '#fff',
                                    cursor: 'pointer',
                                    fontSize: '18px'
                                }}
                                onClick={handleReroll}
                                title="Reroll (`)"
                            >
                                🔄
                            </button>

                        </div>
                        
                        {safeMode && definition && (
                            <div style={{ marginTop: '15px', fontSize: '11px', color: '#d1d5db', fontStyle: 'italic', background: '#374151', padding: '8px', borderRadius: '8px', maxHeight: '80px', overflowY: 'auto' }}>
                                <strong style={{color: '#60a5fa'}}>Definition:</strong> {definition}
                            </div>
                        )}
                    </>
                ) : (
                    <div className="nc-wb-settings">
                        <div className="nc-wb-setting-item" style={{ marginBottom: '10px' }}>
                            <label>Speed (LPS): {lps}</label>
                            <input
                                type="range"
                                min="10"
                                max="100"
                                step="1"
                                value={lps}
                                onChange={(e) => {
                                    setLps(parseFloat(e.target.value));
                                    setSetting("wb_lps", e.target.value);
                                }}
                                style={{ width: '100%' }}
                            />
                        </div>
                        <div className="nc-wb-setting-item" style={{ marginBottom: '10px' }}>
                            <label>Error (%): {humanChance}%</label>
                            <input
                                type="range"
                                min="0"
                                max="100"
                                step="1"
                                value={humanChance}
                                onChange={(e) => {
                                    setHumanChance(parseInt(e.target.value));
                                    setSetting("wb_humanChance", e.target.value);
                                }}
                                style={{ width: '100%' }}
                            />
                        </div>
                        <div className="nc-wb-setting-item" style={{ marginBottom: '10px' }}>
                            <label style={{ fontSize: '13px', color: '#f472b6', fontWeight: 'bold' }}>Theme (Optional)</label>
                            <input
                                type="text"
                                placeholder="e.g. sex, love..."
                                value={theme}
                                onChange={(e) => {
                                    setTheme(e.target.value.toLowerCase().trim());
                                    setSetting("wb_theme", e.target.value.toLowerCase().trim());
                                }}
                                style={{ width: '100%', padding: '6px', borderRadius: '6px', border: 'none', background: '#374151', color: 'white', marginTop: '5px' }}
                            />
                        </div>
                        <div className="nc-wb-setting-item" style={{ marginBottom: '10px' }}>
                            <label style={{ fontSize: '13px', color: '#fbbf24', fontWeight: 'bold' }}>Play Style</label>
                            <select
                                value={playMode}
                                onChange={(e) => {
                                    setPlayMode(e.target.value);
                                    setSetting("wb_playMode", e.target.value);
                                }}
                                style={{ width: '100%', padding: '6px', borderRadius: '6px', border: 'none', background: '#374151', color: 'white', marginTop: '5px', outline: 'none' }}
                            >
                                <option value="Normal">Normal</option>
                                <option value="Pro">Pro Mod (Long & Complex)</option>
                                <option value="Noob">Noob Mod (Short & Simple)</option>
                            </select>
                        </div>
                        <div className="nc-wb-setting-item" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px', borderTop: '1px solid #4b5563', paddingTop: '10px' }}>
                            <label style={{ fontSize: '13px', color: '#ef4444', fontWeight: 'bold' }}>🚫 No Spaces or Dashes</label>
                            <input
                                type="checkbox"
                                checked={noSpace}
                                onChange={(e) => {
                                    const checked = e.target.checked;
                                    setNoSpace(checked);
                                    setSetting("wb_noSpace", String(checked));
                                }}
                                style={{ transform: 'scale(1.2)' }}
                            />
                        </div>

                        <div className="nc-wb-setting-item" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px', borderTop: '1px solid #4b5563', paddingTop: '10px' }}>
                            <label style={{ fontSize: '13px', color: '#60a5fa', fontWeight: 'bold' }}>📚 Safe Mode (Def.)</label>
                            <input
                                type="checkbox"
                                checked={safeMode}
                                onChange={(e) => {
                                    const checked = e.target.checked;
                                    setSafeMode(checked);
                                    setSetting("wb_safeMode", String(checked));
                                    if (checked && streamProof) {
                                        setTimeout(() => {
                                            unmountOverlay();
                                            toggleWordBombOverlay();
                                        }, 300);
                                    }
                                }}
                                style={{ transform: 'scale(1.2)' }}
                            />
                        </div>
                        <div style={{ fontSize: '10px', opacity: 0.6, marginTop: '4px', marginBottom: '15px' }}>
                            Displays the definition of the word the bot just typed to pretend you know it.
                        </div>
                        <button className="nc-wb-button" style={{ width: '100%', padding: '8px', background: '#4b5563', border: 'none', borderRadius: '8px', color: 'white' }} onClick={() => setIsSettingsOpen(false)}>
                            BACK
                        </button>
                    </div>
                )}
            </div>

            <div className="nc-wb-footer" style={{ marginTop: '15px', paddingTop: '10px', borderTop: '1px solid #374151', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div
                    className="nc-wb-settings-btn"
                    title="Settings"
                    onClick={() => setIsSettingsOpen(!isSettingsOpen)}
                    style={{ cursor: 'pointer', fontSize: '18px' }}
                >
                    {isSettingsOpen ? '✕' : '⚙'}
                </div>
                <div className="nc-wb-status" style={{ fontSize: '10px', opacity: 0.6 }}>
                    {status} | LPS: {lps} | Human: {humanChance}%
                </div>
            </div>
        </div>
    );
}
