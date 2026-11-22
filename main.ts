// EMBERFALL — the entrypoint (Node 22, standard library only).
// Hands the game in: copies game/ and screenshots/ into the output directory
// and writes the dossier there with the kit's buildDossier, byte for byte
// what the gate rebuilds. Runs twice, writes the same bytes both times.

import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

// The gate's caps for this bounty, as the competition bundle states them:
// 160 KiB of dossier text, at most 4 screenshots of 256 KiB each, game/ at
// most 993 entries and 48 MiB, every path at most 1,000 UTF-8 bytes.
const CAPS = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 48 * 1024 * 1024,
  game_path_max_bytes: 1000,
};

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)));
const outDir = resolve(process.env.MAKEFUN_OUTPUT_DIR || '/output');

function handIn(): void {
  rmSync(outDir, { recursive: true, force: true });
  mkdirSync(outDir, { recursive: true });
  for (const name of ['game', 'screenshots']) {
    const from = join(repoRoot, name);
    if (!existsSync(from)) throw new Error('missing ' + name + '/ in the repository');
    cpSync(from, join(outDir, name), { recursive: true });
  }
  const dossier = buildDossier(outDir, CAPS);
  writeFileSync(join(outDir, 'dossier.json'), dossier);
}

handIn();
