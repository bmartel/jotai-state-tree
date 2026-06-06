import { types, Instance } from 'jotai-state-tree';

export const Note = types
  .model('Note', {
    id: types.identifier,
    title: types.string,
    content: types.optional(types.string, ''),
    category: types.optional(types.string, 'General'),
    updatedAt: types.optional(types.number, () => Date.now()),
  })
  .actions((self) => ({
    updateTitle(title: string) {
      self.title = title;
      self.updatedAt = Date.now();
    },
    updateContent(content: string) {
      self.content = content;
      self.updatedAt = Date.now();
    },
    setCategory(cat: string) {
      self.category = cat;
      self.updatedAt = Date.now();
    },
  }));

export const NotesStore = types
  .model('NotesStore', {
    notes: types.optional(types.map(Note), {}),
    selectedNoteId: types.maybe(types.string),
  })
  .views((self) => ({
    get notesList() {
      return Array.from(self.notes.values()).sort((a, b) => b.updatedAt - a.updatedAt);
    },
    get selectedNote() {
      return self.selectedNoteId ? self.notes.get(self.selectedNoteId) : undefined;
    },
    searchNotes(query: string) {
      const q = query.toLowerCase().trim();
      if (!q) return this.notesList;
      return this.notesList.filter(
        (n) =>
          n.title.toLowerCase().includes(q) ||
          n.content.toLowerCase().includes(q)
      );
    },
  }))
  .actions((self) => ({
    addNote(title: string, content = '') {
      const id = 'note_' + Math.random().toString(36).substring(2, 9);
      self.notes.put(Note.create({
        id,
        title,
        content,
        category: 'General',
        updatedAt: Date.now(),
      }));
      self.selectedNoteId = id;
    },
    removeNote(id: string) {
      self.notes.delete(id);
      if (self.selectedNoteId === id) {
        self.selectedNoteId = undefined;
      }
    },
    selectNote(id: string | undefined) {
      self.selectedNoteId = id;
    },
  }));

export type INotesStore = Instance<typeof NotesStore>;
export type INote = Instance<typeof Note>;
