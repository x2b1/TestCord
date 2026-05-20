import { l as setFetchHandler, t as $ } from "./finders-DqxDg0Cd.js";

//#region src/util.ts
/**
* Returns whether the specified **Song** should have a tall layout (for **playlists**, **albums** and **artists**) or a short layout (for **tracks**).
* @example ```ts
* isListLayout({ service: "soundcloud", type: "user", id: "914653456" });
* // true
* ```
*/
function isListLayout(song, render) {
	return render?.form === "list" || !["track", "song"].includes(song.type);
}
/**
* Loops through all **services** and returns the corresponding **service**'s label.
* @example ```ts
* getServiceLabel("applemusic");
* // "Apple Music"
* ```
*/
function getServiceLabel(service) {
	for (const serviced of $.services) if (serviced.name === service) return serviced.label;
}
/**
* Helper function which stringifies a **Song**, useful for caching or for using as keys.
* @example ```ts
* sid({ service: "soundcloud", type: "user", id: "914653456" });
* // "soundcloud:user:914653456"
* ```
*/
function sid(song) {
	return [
		song.service,
		song.type,
		song.id
	].join(":");
}

//#endregion
export { getServiceLabel, isListLayout, setFetchHandler, sid };