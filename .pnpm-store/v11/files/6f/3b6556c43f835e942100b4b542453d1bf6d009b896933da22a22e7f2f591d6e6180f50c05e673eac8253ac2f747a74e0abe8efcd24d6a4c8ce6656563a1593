import { c as request, o as PLAYLIST_LIMIT, r as parseLink, s as parseNextData, t as $ } from "./finders-DqxDg0Cd.js";

//#region src/handlers/defs/parsers/songdotlink.ts
const alphabeticRegex = /^[^-_][a-z0-9-_]+[^-_]$/i;
const songdotlink = {
	name: "song.link",
	label: "song.link",
	hosts: [
		"song.link",
		"album.link",
		"artist.link",
		"pods.link",
		"playlist.link",
		"mylink.page",
		"odesli.co"
	],
	async parse(link, _host, path) {
		const [first, second, third] = path;
		if (!first || third) return null;
		if (second && !alphabeticRegex.test(second)) return null;
		else if (!second && !alphabeticRegex.test(first)) return null;
		const html = (await request({ url: link })).text;
		const sections = parseNextData(html)?.props?.pageProps?.pageData?.sections;
		if (!sections) return null;
		const links = sections.flatMap((x) => x.links ?? []).filter((x) => x.url && x.platform);
		const valid = links.find((x) => x.platform === "spotify") ?? links.find((x) => x.platform === "soundcloud") ?? links.find((x) => x.platform === "appleMusic") ?? links.find((x) => x.platform === "tidal");
		if (!valid) return null;
		return await parseLink(valid.url);
	}
};

//#endregion
//#region src/handlers/defs/cache.ts
const handlerCache = /* @__PURE__ */ new Map();
function makeCache(name, retrieve) {
	return { retrieve(...args) {
		if (handlerCache.has(name)) return handlerCache.get(name);
		const res = retrieve(...args);
		if (res instanceof Promise) return res.then((ret) => {
			handlerCache.set(name, ret);
			return ret;
		});
		else {
			handlerCache.set(name, res);
			return res;
		}
	} };
}

//#endregion
//#region src/handlers/defs/services/applemusic.ts
const geo = "us", defaultName = "songspotlight";
function applemusicLink(type, id) {
	return `https://music.apple.com/${geo}/${type}/${defaultName}/${id}`;
}
const applemusicToken = makeCache("applemusicToken", async (html) => {
	html ??= (await request({ url: `https://music.apple.com/${geo}/new` })).text;
	const asset = html.match(/src="(\/assets\/index~\w+\.js)"/i)?.[1];
	if (!asset) return;
	return (await request({ url: `https://music.apple.com${asset}` })).text.match(/\w+="(ey.*?)"/i)?.[1];
});
const applemusic = {
	name: "applemusic",
	label: "Apple Music",
	hosts: ["music.apple.com", "geo.music.apple.com"],
	types: [
		"artist",
		"album",
		"playlist",
		"song"
	],
	async parse(_link, _host, path) {
		const [country, type, name, id, fourth] = path;
		if (!country || !type || !this.types.includes(type) || !name || !id || fourth) return null;
		const res = await request({ url: applemusicLink(type, id) });
		if (res.status !== 200) return null;
		await applemusicToken.retrieve(res.text);
		return {
			service: this.name,
			type,
			id
		};
	},
	async render(type, id) {
		const token = await applemusicToken.retrieve();
		if (!token) return null;
		const res = await request({
			url: `https://amp-api.music.apple.com/v1/catalog/${geo}/${type}s`,
			query: {
				include: "songs",
				ids: id
			},
			headers: {
				authorization: `Bearer ${token}`,
				origin: "https://music.apple.com"
			}
		});
		if (res.status !== 200) return null;
		const { attributes, relationships } = res.json.data[0];
		const base = {
			label: attributes.name,
			sublabel: attributes.artistName ?? "Top songs",
			link: attributes.url,
			explicit: attributes.contentRating === "explicit"
		};
		const thumbnailUrl = attributes.artwork?.url?.replace(/{[wh]}/g, "128");
		if (type === "song") {
			const duration = attributes.durationInMillis, previewUrl = attributes.previews?.[0]?.url;
			return {
				form: "single",
				...base,
				thumbnailUrl,
				single: { audio: previewUrl && duration ? {
					previewUrl,
					duration
				} : void 0 }
			};
		} else return {
			form: "list",
			...base,
			thumbnailUrl,
			list: (relationships.tracks?.data ?? relationships.songs?.data ?? []).slice(0, PLAYLIST_LIMIT).map(({ attributes }) => {
				const duration = attributes.durationInMillis, previewUrl = attributes.previews?.[0]?.url;
				return {
					label: attributes.name,
					sublabel: attributes.artistName,
					link: attributes.url,
					explicit: attributes.contentRating === "explicit",
					audio: previewUrl && duration ? {
						previewUrl,
						duration
					} : void 0
				};
			})
		};
	},
	async validate(type, id) {
		return (await request({ url: applemusicLink(type, id) })).status === 200;
	}
};

//#endregion
//#region src/handlers/defs/services/soundcloud.ts
const client_id = "nIjtjiYnjkOhMyh5xrbqEW12DxeJVnic";
async function parseWidget(type, id, tracks) {
	return (await request({
		url: `https://api-widget.soundcloud.com/${type}s/${id}${tracks ? "/tracks" : ""}`,
		query: {
			format: "json",
			client_id,
			app_version: "1768986291",
			limit: "20"
		}
	})).json;
}
async function parsePreview(transcodings) {
	const preview = transcodings.sort((a, b) => {
		const isA = a.format.protocol === "progressive";
		const isB = b.format.protocol === "progressive";
		return isA && !isB ? -1 : isB && !isA ? 1 : 0;
	})?.[0];
	if (preview?.url && preview?.duration) {
		const link = (await request({
			url: preview.url,
			query: { client_id }
		})).json;
		if (!link?.url) return;
		return {
			duration: preview.duration,
			previewUrl: link.url
		};
	}
}
const soundcloud = {
	name: "soundcloud",
	label: "Soundcloud",
	hosts: [
		"soundcloud.com",
		"m.soundcloud.com",
		"on.soundcloud.com"
	],
	types: [
		"user",
		"track",
		"playlist"
	],
	async parse(link, host, path) {
		if (host === "on.soundcloud.com") {
			if (!path[0] || path[1]) return null;
			const { url, status } = await request({ url: link });
			return status === 200 ? await parseLink(url) : null;
		} else {
			const [user, second, track, fourth] = path;
			let valid = false;
			if (user && !second) valid = true;
			else if (user && second && second !== "sets" && !track) valid = true;
			else if (user && second === "sets" && track && !fourth) valid = true;
			if (!valid) return null;
			const data = (await request({
				url: "https://soundcloud.com/oembed",
				query: {
					format: "json",
					url: link
				}
			})).json;
			if (!data?.html) return null;
			const rawUrl = data.html.match(/w\.soundcloud\.com.*?url=(.*?)[&"]/)?.[1];
			if (!rawUrl) return null;
			const splits = decodeURIComponent(rawUrl).split(/\/+/);
			const kind = splits[2], id = splits[3];
			if (!kind || !id) return null;
			return {
				service: this.name,
				type: kind.slice(0, -1),
				id
			};
		}
	},
	async render(type, id) {
		const data = await parseWidget(type, id, false);
		if (!data?.id) return null;
		const base = {
			label: data.title ?? data.username,
			sublabel: data.user?.username ?? "Top tracks",
			link: data.permalink_url,
			explicit: Boolean(data.publisher_metadata?.explicit)
		};
		const thumbnailUrl = data.artwork_url ?? data.avatar_url;
		if (type === "track") {
			const audio = await parsePreview(data.media?.transcodings ?? []).catch(() => void 0);
			return {
				form: "single",
				...base,
				thumbnailUrl,
				single: { audio }
			};
		} else {
			let tracks = [];
			if (type === "user") {
				const got = await parseWidget(type, id, true).catch(() => void 0);
				if (got?.collection) tracks = got.collection;
			} else if (data.tracks) tracks = data.tracks;
			return {
				form: "list",
				...base,
				thumbnailUrl,
				list: await Promise.all(tracks.filter((x) => x.title).slice(0, PLAYLIST_LIMIT).map(async (track) => ({
					label: track.title,
					sublabel: track.user?.username ?? "unknown",
					link: track.permalink_url,
					explicit: Boolean(track.publisher_metadata.explicit),
					audio: await parsePreview(track.media?.transcodings ?? []).catch(() => void 0)
				})))
			};
		}
	},
	async validate(type, id) {
		return (await parseWidget(type, id, false))?.id !== void 0;
	}
};

//#endregion
//#region src/handlers/defs/services/spotify.ts
async function parseEmbed(type, id) {
	return parseNextData((await request({ url: `https://open.spotify.com/embed/${type}/${id}` })).text);
}
function fromUri(uri) {
	const [sanityCheck, type, id] = uri.split(":");
	if (sanityCheck === "spotify" && type && id) return `https://open.spotify.com/${type}/${id}`;
	else return null;
}
const spotify = {
	name: "spotify",
	label: "Spotify",
	hosts: ["open.spotify.com"],
	types: [
		"track",
		"album",
		"playlist",
		"artist"
	],
	async parse(_link, _host, path) {
		const [type, id, third] = path;
		if (!type || !this.types.includes(type) || !id || third) return null;
		if (!await this.validate(type, id)) return null;
		return {
			service: this.name,
			type,
			id
		};
	},
	async render(type, id) {
		const data = (await parseEmbed(type, id))?.props?.pageProps?.state?.data?.entity;
		if (!data) return null;
		const base = {
			label: data.title,
			sublabel: data.subtitle ?? data.artists?.map((x) => x.name).join(", "),
			link: fromUri(data.uri),
			explicit: Boolean(data.isExplicit)
		};
		const thumbnailUrl = data.visualIdentity.image.sort((a, b) => a.maxWidth - b.maxWidth)[0]?.url.replace(/:\/\/.*?\.spotifycdn\.com\/image/, "://i.scdn.co/image");
		if (type === "track") return {
			form: "single",
			...base,
			thumbnailUrl,
			single: { audio: data.audioPreview && data.duration ? {
				duration: data.duration,
				previewUrl: data.audioPreview.url
			} : void 0 }
		};
		else return {
			form: "list",
			...base,
			thumbnailUrl,
			list: (data.trackList ?? []).slice(0, PLAYLIST_LIMIT).map((track) => ({
				label: track.title,
				sublabel: track.subtitle ?? track.artists?.map((x) => x.name).join(", "),
				link: fromUri(track.uri),
				explicit: Boolean(track.isExplicit),
				audio: track.audioPreview && track.duration ? {
					duration: track.duration,
					previewUrl: track.audioPreview.url
				} : void 0
			}))
		};
	},
	async validate(type, id) {
		return !(await parseEmbed(type, id))?.props?.pageProps?.title;
	}
};

//#endregion
//#region src/handlers/defs/services/tidal.ts
const tidalToken = "vNVdglQOjFJJGG2U";
async function getInfo(type, id, path = "", query = {}) {
	return await request({
		url: `https://api.tidal.com/v1/${type}s/${id}/${path}`,
		query: {
			countryCode: "US",
			...query
		},
		headers: { "X-Tidal-Token": tidalToken }
	}).then((x) => x.ok ? x.json : void 0);
}
async function getAudioPreview(id) {
	const info = await getInfo("track", id, "playbackinfo", {
		audioquality: "HIGH",
		playbackmode: "STREAM",
		assetpresentation: "FULL"
	});
	if (!info?.manifest) return;
	return JSON.parse(atob(info.manifest)).urls[0];
}
function prettyLink(link) {
	try {
		const url = new URL(link);
		url.protocol = "https://";
		return url.toString();
	} catch {
		return link;
	}
}
const tidal = {
	name: "tidal",
	label: "Tidal",
	hosts: [
		"tidal.com",
		"www.tidal.com",
		"listen.tidal.com"
	],
	types: [
		"artist",
		"album",
		"playlist",
		"track"
	],
	async parse(_link, _host, path) {
		const [typeFoo, idFoo, typeBar, idBar] = path;
		const type = typeBar && idBar ? typeBar : typeFoo, id = typeBar && idBar ? idBar : idFoo;
		if (!type || !this.types.includes(type) || !id) return null;
		if (type === "playlist" && !/^[-a-f0-9]+$/.test(id)) return null;
		else if (type !== "playlist" && Number.isNaN(Number(id))) return null;
		if (!await this.validate(type, id)) return null;
		return {
			service: this.name,
			type,
			id
		};
	},
	async render(type, id) {
		const data = await getInfo(type, id);
		if (!data) return null;
		const defaultSublabel = data.type === "playlist" ? "TIDAL" : "Top tracks";
		const base = {
			label: data.title || data.name || "Unknown",
			sublabel: data.artists?.map((x) => x.name).join(", ") || data.creator?.name || defaultSublabel,
			link: prettyLink(data.url),
			explicit: Boolean(data.explicit)
		};
		const thumbnailKey = data.picture ?? data.squareImage ?? data.album?.cover;
		const thumbnailUrl = thumbnailKey ? `https://resources.tidal.com/images/${thumbnailKey.replace(/-/g, "/")}/160x160.jpg` : void 0;
		if (type === "track") {
			const previewUrl = data.duration && await getAudioPreview(id).catch(() => void 0);
			return {
				form: "single",
				...base,
				thumbnailUrl,
				single: { audio: previewUrl && data.duration ? {
					previewUrl,
					duration: data.duration * 1e3
				} : void 0 }
			};
		} else {
			const tracks = await getInfo(type, id, type === "artist" ? "toptracks" : "tracks", { limit: String(PLAYLIST_LIMIT) });
			return {
				form: "list",
				...base,
				thumbnailUrl,
				list: await Promise.all(tracks?.items.slice(0, PLAYLIST_LIMIT).map(async (track) => {
					const previewUrl = track.duration && await getAudioPreview(track.id).catch(() => void 0);
					return {
						label: track.title,
						sublabel: track.artists.map((x) => x.name).join(", "),
						link: prettyLink(track.url),
						explicit: Boolean(track.explicit),
						audio: previewUrl && track.duration ? {
							previewUrl,
							duration: track.duration * 1e3
						} : void 0
					};
				}) ?? [])
			};
		}
	},
	async validate(type, id) {
		return !!await getInfo(type, id);
	}
};

//#endregion
//#region src/handlers/core.ts
const services = [
	applemusic,
	soundcloud,
	spotify,
	tidal
];
$.services = services;
const parsers = [songdotlink, ...services];
$.parsers = parsers;

//#endregion
export { services as n, parsers as t };