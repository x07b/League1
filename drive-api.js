export async function uploadToDrive(blob, filename, folder, metadata, token) {
  if (blob.size > 2800000)
    throw new Error(
      "Drive upload exceeds 2.8 MB. The full-quality local file is preserved.",
    );
  const data = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(",")[1]);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
  const send = async (forceUpload) => {
    const response = await fetch("/api/drive", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token || ""}`,
      },
      body: JSON.stringify({
        data,
        filename,
        folder,
        mimeType: blob.type,
        metadata,
        forceUpload,
      }),
      signal: AbortSignal.timeout(30000),
    });
    const result = await response.json();
    if (!response.ok || !result.ok)
      throw new Error(result.error || "Drive did not confirm upload.");
    return result;
  };
  const result = await send(false);
  if (
    result.existing &&
    confirm(
      `${filename} already exists in Drive. Upload another copy? Cancel keeps the existing Drive file and your selected local image.`,
    )
  )
    return send(true);
  return result;
}
