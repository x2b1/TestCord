import { t as Song } from "./types-DRQ6d925.js";
import { RenderSongInfo } from "@song-spotlight/api/handlers";

//#region src/handlers/common.d.ts
/**
 * Lets you to set a custom `fetch()` function. Useful for passing requests through Electron's [net.fetch](https://www.electronjs.org/docs/latest/api/net#netfetchinput-init) for example.
 * @example ```ts
 * import { net } from "electron";
 *
 * setFetchHandler(net.fetch as unknown as typeof fetch);
 * ```
 */
declare function setFetchHandler(fetcher: typeof fetch): void;
//#endregion
//#region src/util.d.ts
/**
 * Returns whether the specified **Song** should have a tall layout (for **playlists**, **albums** and **artists**) or a short layout (for **tracks**).
 * @example ```ts
 * isListLayout({ service: "soundcloud", type: "user", id: "914653456" });
 * // true
 * ```
 */
declare function isListLayout(song: Song, render?: RenderSongInfo): boolean;
/**
 * Loops through all **services** and returns the corresponding **service**'s label.
 * @example ```ts
 * getServiceLabel("applemusic");
 * // "Apple Music"
 * ```
 */
declare function getServiceLabel(service: string): string | undefined;
/**
 * Helper function which stringifies a **Song**, useful for caching or for using as keys.
 * @example ```ts
 * sid({ service: "soundcloud", type: "user", id: "914653456" });
 * // "soundcloud:user:914653456"
 * ```
 */
declare function sid(song: Song): string;
//#endregion
export { getServiceLabel, isListLayout, setFetchHandler, sid };