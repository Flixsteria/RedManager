import { join } from "@tauri-apps/api/path";
import { readDir } from "@tauri-apps/plugin-fs";

// fs v2's readDir only returns names, so this rebuilds the v1 shape with full paths.
// `children` is set (possibly empty) for directories and undefined for files.
export type FileEntry = {
    name: string;
    path: string;
    children?: FileEntry[];
};

export async function listDir(dir: string, recursive = false): Promise<FileEntry[]> {
    const entries = await readDir(dir);
    return Promise.all(entries.map(async entry => {
        const entryPath = await join(dir, entry.name);
        return {
            name: entry.name,
            path: entryPath,
            children: entry.isDirectory ? (recursive ? await listDir(entryPath, true) : []) : undefined,
        };
    }));
}
