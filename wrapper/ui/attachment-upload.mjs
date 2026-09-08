export async function uploadAttachmentBatch(entries, { projectId, read, send, success, failure, finish }) {
  for (const entry of entries) {
    try {
      const file = entry.file;
      if (file.size > 24e6) throw new Error("Maximal 24 MB pro Datei.");
      const base64 = await read(file);
      const result = await send({ name: file.name, base64, projectId });
      await success(entry, { ...result, image: /^image\/(png|jpeg|gif|webp)$/.test(file.type) });
    } catch (error) {
      failure(entry, error);
    } finally {
      finish(entry);
    }
  }
}
