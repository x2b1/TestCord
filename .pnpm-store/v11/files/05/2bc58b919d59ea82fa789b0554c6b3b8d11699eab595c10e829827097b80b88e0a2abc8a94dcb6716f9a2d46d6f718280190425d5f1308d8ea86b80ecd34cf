import { t as Song } from "./types-DRQ6d925.js";

//#region src/handlers/helpers.d.ts
type MaybePromise<T> = Promise<T> | T;
interface SongParser {
  name: string;
  label: string;
  hosts: string[];
  parse(link: string, host: string, path: string[]): MaybePromise<Song | null>;
}
interface SongService extends SongParser {
  types: string[];
  render(type: string, id: string): MaybePromise<RenderSongInfo | null>;
  validate(type: string, id: string): MaybePromise<boolean>;
}
interface RenderInfoBase {
  label: string;
  sublabel: string;
  explicit: boolean;
  link: string;
}
interface RenderInfoEntry {
  audio?: {
    duration: number;
    previewUrl: string;
  };
}
type RenderInfoEntryBased = RenderInfoEntry & RenderInfoBase;
interface RenderSongSingle extends RenderInfoBase {
  form: "single";
  thumbnailUrl?: string;
  single: RenderInfoEntry;
}
interface RenderSongList extends RenderInfoBase {
  form: "list";
  thumbnailUrl?: string;
  list: RenderInfoEntryBased[];
}
type RenderSongInfo = RenderSongSingle | RenderSongList;
//#endregion
//#region src/handlers/core.d.ts
declare const services: SongService[];
declare const parsers: SongParser[];
//#endregion
//#region src/handlers/finders.d.ts
declare const $: {
  services: SongService[];
  parsers: SongParser[];
};
/**
 * Tries to parse the provided **link**. Returns a **Song** if successful, or `null` if nothing was found. Either response is temporarily cached.
 * @example ```ts
 * await parseLink("https://soundcloud.com/c0ncernn");
 * // { service: "soundcloud", type: "user", id: "914653456" }
 * ```
 */
declare function parseLink(link: string): Promise<Song | null>;
/**
 * Tries to render the provided **Song**. Returns `RenderSongInfo` if successful, or `null` if nothing was found. Either response is temporarily cached.
 * @example ```ts
 * await renderSong({ service: "soundcloud", type: "user", id: "914653456" });
 * // { label: "leroy", sublabel: "Top tracks", explicit: false, form: "list", ... }
 * ```
 */
declare function renderSong(song: Song): Promise<RenderSongInfo | null>;
/**
 * Validates if the provided **Song** exists. Returns a `boolean` depending on if the check was successful or not. Either response is temporarily cached.
 * @example ```ts
 * await renderSong({ service: "soundcloud", type: "user", id: "914653456" });
 * // true
 * ```
 */
declare function validateSong(song: Song): Promise<boolean>;
/** Clears the cache for all handler functions */
declare function clearCache(): void;
//#endregion
export { $, RenderInfoBase, RenderInfoEntry, RenderInfoEntryBased, RenderSongInfo, SongParser, SongService, clearCache, parseLink, parsers, renderSong, services, validateSong };