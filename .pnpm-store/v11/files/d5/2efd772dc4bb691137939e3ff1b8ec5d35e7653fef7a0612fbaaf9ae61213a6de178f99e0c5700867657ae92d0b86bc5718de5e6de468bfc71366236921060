import { n as services } from "./core-DFn42qV-.js";
import z from "zod";

//#region src/structs/zod.ts
const SongSchema = z.discriminatedUnion("service", services.map((service) => z.object({
	service: z.literal(service.name),
	type: z.union(service.types.map((type) => z.literal(type))),
	id: z.string()
})));
/** **UserDataSchema** does not have a limit by default */
const UserDataSchema = z.array(SongSchema);

//#endregion
export { SongSchema, UserDataSchema };