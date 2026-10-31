import type { Stats } from "node:fs";
import { relative } from "node:path";

const WATCHED_EXTENSIONS = /\.(java|tsx?|jsx?|py|go|rs|cs)$/;
const IGNORED_DIRECTORIES = /(^|[/\\])(node_modules|build|target|out|dist|\.git|__pycache__|vendor|bin|obj)([/\\]|$)/;

/**
 * chokidar (v4+) no longer understands globs, so watch mode filters paths with this predicate:
 * skip build/dependency directories below `root`, and for files keep only supported source
 * extensions. Paths are matched relative to `root` so a project that itself lives in e.g.
 * a `build/` directory is still watched.
 */
export function createWatchFilter(root: string): (path: string, stats?: Stats) => boolean {
  return (path, stats) => {
    const rel = relative(root, path);
    if (rel !== "" && IGNORED_DIRECTORIES.test(rel)) return true;
    if (!stats?.isFile()) return false;
    return !WATCHED_EXTENSIONS.test(path) || path.endsWith(".d.ts");
  };
}
