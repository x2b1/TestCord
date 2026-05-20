import { n as UserData, t as Song } from "./types-DRQ6d925.js";
import z, { ZodLiteral, ZodObject, ZodString, core } from "zod";

//#region src/structs/zod.d.ts
type SongDef = ZodObject<{
  service: ZodLiteral<string>;
  type: ZodLiteral<string>;
  id: ZodString;
}, core.$strip>;
declare const SongSchema: z.ZodDiscriminatedUnion<[SongDef], "service">;
/** **UserDataSchema** does not have a limit by default */
declare const UserDataSchema: z.ZodArray<z.ZodDiscriminatedUnion<[SongDef], "service">>;
//#endregion
export { Song, SongSchema, UserData, UserDataSchema };