/**
 * Upload a file to R2
 * Uses presigned URL for direct upload (bypasses Vercel 4.5MB body limit)
 * Falls back to /api/upload proxy for small files if presign fails
 */
export async function uploadFile(
  file: File | Blob,
  folder: string,
  filename: string,
  token: string,
): Promise<string> {
  const safeFilename = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
  const contentType = file.type || 'application/octet-stream';

  // Try presigned URL upload (no file size limit)
  try {
    const presignRes = await fetch('/api/presign-upload', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ filename: safeFilename, folder, contentType }),
    });

    if (presignRes.ok) {
      const { uploadUrl, publicUrl } = await presignRes.json();

      const uploadRes = await fetch(uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': contentType },
        body: file,
      });

      if (uploadRes.ok) return publicUrl;
      console.warn('Direct R2 upload failed, status:', uploadRes.status);
    }
  } catch (e) {
    console.warn('Presigned upload failed, trying fallback:', e);
  }

  // Fallback: upload via Vercel function (works for files < 4.5MB)
  const res = await fetch('/api/upload', {
    method: 'POST',
    headers: {
      'Content-Type': contentType,
      'Authorization': `Bearer ${token}`,
      'X-Filename': safeFilename,
      'X-Folder': folder,
    },
    body: file,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Upload failed (${res.status})`);
  }
  const data = await res.json();
  return data.url;
}
