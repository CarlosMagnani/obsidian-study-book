/**
 * Vault helpers.
 *
 * The vault is described with a small structural interface instead of the
 * Obsidian types, so this module stays importable in the tests.
 */

export interface VaultLike {
	getAbstractFileByPath(path: string): unknown;
	createFolder(path: string): Promise<unknown>;
	create(path: string, data: string): Promise<unknown>;
}

/**
 * Creates a folder and every missing parent.
 */
export async function ensureFolder(vault: VaultLike, folderPath: string): Promise<void> {
	const parts = folderPath.split('/').filter((part) => part.length > 0);
	let current = '';
	for (const part of parts) {
		current = current ? `${current}/${part}` : part;
		if (!vault.getAbstractFileByPath(current)) {
			try {
				await vault.createFolder(current);
			} catch {
				// Another run created the folder in the meantime.
			}
		}
	}
}

/**
 * Creates a note, adding a counter when the name is already taken.
 */
export async function createNote(
	vault: VaultLike,
	folderPath: string,
	fileName: string,
	content: string,
): Promise<string> {
	const base = fileName.replace(/\.md$/i, '');
	let candidate = fileName;
	let counter = 2;
	while (vault.getAbstractFileByPath(joinPath(folderPath, candidate))) {
		candidate = `${base} ${counter}.md`;
		counter += 1;
	}
	const fullPath = joinPath(folderPath, candidate);
	await vault.create(fullPath, content);
	return fullPath;
}

/**
 * Joins a folder and a file name with the Obsidian path separator.
 */
export function joinPath(folderPath: string, fileName: string): string {
	const folder = folderPath.replace(/^\/+|\/+$/g, '');
	return folder ? `${folder}/${fileName}` : fileName;
}
