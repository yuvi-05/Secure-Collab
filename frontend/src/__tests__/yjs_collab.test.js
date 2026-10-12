import { describe, it, expect } from 'vitest';
import * as Y from 'yjs';

describe('Yjs Real-Time Simultaneous Collaboration & Document Sync', () => {
  it('synchronizes concurrent edits between two independent client docs', () => {
    // Client 1 doc
    const doc1 = new Y.Doc();
    const text1 = doc1.getText('code');

    // Client 2 doc
    const doc2 = new Y.Doc();
    const text2 = doc2.getText('code');

    // Initial sync
    const initialUpdate = Y.encodeStateAsUpdate(doc1);
    Y.applyUpdate(doc2, initialUpdate);

    // Client 1 types
    text1.insert(0, 'def calculate():\n');

    // Client 2 simultaneously types at same time
    text2.insert(0, '# Python Module Header\n');

    // Exchange updates (simulating Socket.IO network sync)
    const updateFrom1 = Y.encodeStateAsUpdate(doc1);
    const updateFrom2 = Y.encodeStateAsUpdate(doc2);

    Y.applyUpdate(doc2, updateFrom1);
    Y.applyUpdate(doc1, updateFrom2);

    // Both documents must converge to identical content without conflict
    expect(text1.toString()).toBe(text2.toString());
    expect(text1.toString()).toContain('def calculate():');
    expect(text1.toString()).toContain('# Python Module Header');
  });

  it('restores document state on reconnection after disconnect', () => {
    const originalDoc = new Y.Doc();
    const origText = originalDoc.getText('code');
    origText.insert(0, 'import numpy as np\nprint("Online")\n');

    // Snapshot full Yjs CRDT state as Uint8Array
    const snapshot = Y.encodeStateAsUpdate(originalDoc);

    // Reconnecting client initializes fresh doc and applies saved snapshot
    const reconnectedDoc = new Y.Doc();
    Y.applyUpdate(reconnectedDoc, snapshot);

    const reconnectedText = reconnectedDoc.getText('code');
    expect(reconnectedText.toString()).toBe('import numpy as np\nprint("Online")\n');
  });
});
