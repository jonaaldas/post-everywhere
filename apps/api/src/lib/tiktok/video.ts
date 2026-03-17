import { execFile } from 'node:child_process';
import { writeFile, unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';

import ffprobeStatic from 'ffprobe-static';

const execFileAsync = promisify(execFile);

export async function getVideoDurationSeconds(buffer: Buffer): Promise<number> {
  const filePath = join(tmpdir(), `post-everywhere-${crypto.randomUUID()}.mp4`);
  await writeFile(filePath, buffer);

  try {
    const { stdout } = await execFileAsync(ffprobeStatic.path, [
      '-v',
      'error',
      '-show_entries',
      'format=duration',
      '-of',
      'default=noprint_wrappers=1:nokey=1',
      filePath,
    ]);

    return Number(stdout.trim());
  } finally {
    await unlink(filePath).catch(() => undefined);
  }
}
