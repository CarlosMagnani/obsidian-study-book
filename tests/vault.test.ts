import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { createNote, ensureFolder, joinPath, type VaultLike } from '../src/vault.ts';

class FakeVault implements VaultLike {
	readonly folders = new Set<string>();
	readonly files = new Map<string, string>();

	getAbstractFileByPath(path: string): unknown {
		if (this.folders.has(path) || this.files.has(path)) {
			return { path };
		}
		return null;
	}

	async createFolder(path: string): Promise<unknown> {
		this.folders.add(path);
		return { path };
	}

	async create(path: string, data: string): Promise<unknown> {
		this.files.set(path, data);
		return { path };
	}
}

describe('ensureFolder', () => {
	it('creates every missing parent', async () => {
		const vault = new FakeVault();
		await ensureFolder(vault, 'Study Book/2026');
		assert.ok(vault.folders.has('Study Book'));
		assert.ok(vault.folders.has('Study Book/2026'));
	});

	it('does not create a folder that already exists', async () => {
		const vault = new FakeVault();
		await ensureFolder(vault, 'Study Book');
		await ensureFolder(vault, 'Study Book');
		assert.equal(vault.folders.size, 1);
	});
});

describe('createNote', () => {
	it('creates the note inside the folder', async () => {
		const vault = new FakeVault();
		const path = await createNote(vault, 'Study Book', 'A note.md', 'content');
		assert.equal(path, 'Study Book/A note.md');
		assert.equal(vault.files.get(path), 'content');
	});

	it('adds a counter when the name is taken', async () => {
		const vault = new FakeVault();
		await createNote(vault, 'Study Book', 'A note.md', 'first');
		const path = await createNote(vault, 'Study Book', 'A note.md', 'second');
		assert.equal(path, 'Study Book/A note 2.md');
		assert.equal(vault.files.get('Study Book/A note.md'), 'first');
	});

	it('creates the note in the vault root when there is no folder', async () => {
		const vault = new FakeVault();
		const path = await createNote(vault, '', 'A note.md', 'content');
		assert.equal(path, 'A note.md');
	});
});

describe('joinPath', () => {
	it('joins with a single slash', () => {
		assert.equal(joinPath('Study Book', 'A note.md'), 'Study Book/A note.md');
		assert.equal(joinPath('/Study Book/', 'A note.md'), 'Study Book/A note.md');
		assert.equal(joinPath('', 'A note.md'), 'A note.md');
	});
});
