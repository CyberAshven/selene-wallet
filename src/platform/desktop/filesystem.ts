import {
  readTextFile,
  writeTextFile,
  mkdir,
  remove,
  readDir,
  rename,
  exists,
  stat,
  BaseDirectory,
} from "@tauri-apps/plugin-fs";
import { appLocalDataDir, appCacheDir } from "@tauri-apps/api/path";

// Capacitor Directory enum values
export const Directory = {
  Library: "LIBRARY",
  Cache: "CACHE",
  Data: "DATA",
  Documents: "DOCUMENTS",
  External: "EXTERNAL",
  ExternalStorage: "EXTERNAL_STORAGE",
} as const;
type Dir = (typeof Directory)[keyof typeof Directory];

export const Encoding = {
  UTF8: "utf8",
  ASCII: "ascii",
  UTF16: "utf16",
} as const;

function baseDir(dir: Dir): BaseDirectory {
  if (dir === Directory.Cache) return BaseDirectory.AppCache;
  return BaseDirectory.AppLocalData;
}

// Capacitor paths use a leading slash (e.g. "/selene/db/app.db").
// Tauri plugin-fs uses relative paths — strip the leading slash.
function normalize(path: string): string {
  return path.startsWith("/") ? path.slice(1) : path;
}

async function absPath(path: string, dir: Dir): Promise<string> {
  const base =
    dir === Directory.Cache ? await appCacheDir() : await appLocalDataDir();
  return base + normalize(path);
}

export const Filesystem = {
  async readFile(options: {
    path: string;
    directory: Dir;
    encoding?: string;
  }): Promise<{ data: string }> {
    const data = await readTextFile(normalize(options.path), {
      baseDir: baseDir(options.directory),
    });
    return { data };
  },

  async writeFile(options: {
    path: string;
    directory: Dir;
    data: string;
    encoding?: string;
    recursive?: boolean;
  }): Promise<{ uri: string }> {
    if (options.recursive) {
      const parts = normalize(options.path).split("/");
      if (parts.length > 1) {
        const dirPath = parts.slice(0, -1).join("/");
        await mkdir(dirPath, {
          baseDir: baseDir(options.directory),
          recursive: true,
        }).catch(() => {});
      }
    }
    await writeTextFile(normalize(options.path), options.data, {
      baseDir: baseDir(options.directory),
    });
    return { uri: await absPath(options.path, options.directory) };
  },

  async mkdir(options: {
    path: string;
    directory: Dir;
    recursive?: boolean;
  }): Promise<void> {
    await mkdir(normalize(options.path), {
      baseDir: baseDir(options.directory),
      recursive: options.recursive ?? false,
    });
  },

  async deleteFile(options: { path: string; directory: Dir }): Promise<void> {
    await remove(normalize(options.path), {
      baseDir: baseDir(options.directory),
    });
  },

  async rmdir(options: {
    path: string;
    directory: Dir;
    recursive?: boolean;
  }): Promise<void> {
    await remove(normalize(options.path), {
      baseDir: baseDir(options.directory),
      recursive: options.recursive ?? false,
    });
  },

  async readdir(options: {
    path: string;
    directory: Dir;
  }): Promise<{ files: { name: string; type: string; uri: string }[] }> {
    const entries = await readDir(normalize(options.path), {
      baseDir: baseDir(options.directory),
    });
    const base = await absPath(options.path, options.directory);
    const files = entries
      .filter((e) => e.name)
      .map((e) => ({
        name: e.name!,
        type: e.isDirectory ? "directory" : "file",
        uri: base + "/" + e.name,
      }));
    return { files };
  },

  async rename(options: {
    from: string;
    to: string;
    directory?: Dir;
    toDirectory?: Dir;
  }): Promise<void> {
    const dir = options.directory ?? Directory.Library;
    const toDir = options.toDirectory ?? dir;
    await rename(normalize(options.from), normalize(options.to), {
      fromPathBaseDir: baseDir(dir),
      toPathBaseDir: baseDir(toDir),
    });
  },

  async getUri(options: { path: string; directory: Dir }): Promise<{ uri: string }> {
    return { uri: await absPath(options.path, options.directory) };
  },

  async stat(options: {
    path: string;
    directory: Dir;
  }): Promise<{ size: number; ctime: number; mtime: number; type: string; uri: string }> {
    const s = await stat(normalize(options.path), {
      baseDir: baseDir(options.directory),
    });
    return {
      size: s.size ?? 0,
      ctime: s.birthtime ? new Date(s.birthtime).getTime() : 0,
      mtime: s.mtime ? new Date(s.mtime).getTime() : 0,
      type: s.isDirectory ? "directory" : "file",
      uri: await absPath(options.path, options.directory),
    };
  },

  async checkPermissions(): Promise<{ publicStorage: string }> {
    return { publicStorage: "granted" };
  },

  async requestPermissions(): Promise<{ publicStorage: string }> {
    return { publicStorage: "granted" };
  },
};
