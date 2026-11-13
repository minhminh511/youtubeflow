export interface AssetOptions { root?: string; publicDir?: string; fontsDir?: string }
export interface AssetPreparation { restored: string[]; fonts: string[]; warnings: string[] }
export interface AssetCheck { ok: boolean; usesSystemFonts: boolean; items: { path: string; ok: boolean; description: string }[] }
export function preparePublicAssets(options?: AssetOptions): Promise<AssetPreparation>;
export function checkPublicAssets(options?: AssetOptions): Promise<AssetCheck>;
export function validWoff2(bytes: Buffer): boolean;
