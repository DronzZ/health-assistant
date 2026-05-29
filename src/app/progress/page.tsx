export const dynamic = 'force-dynamic';

import { db } from "@/lib/db";
import { getSignedUrl } from "@/lib/signed-url";

export default async function ProgressPage() {
  const { data } = await db
    .from("progress_photos")
    .select("*")
    .order("date", { ascending: false })
    .limit(20);

  const photos = data ?? [];

  const photosWithUrls = await Promise.all(
    photos.map(async (p) => ({
      ...p,
      signedUrl: await getSignedUrl(p.storage_path).catch(() => null),
    }))
  );

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-bold pt-2">Progress Photos</h1>

      {photosWithUrls.length === 0 ? (
        <div className="bg-zinc-900 rounded-xl p-6 text-center text-zinc-500 text-sm">
          <p className="mb-2">No progress photos yet.</p>
          <p>Send a photo as a <strong>file/document</strong> in Telegram to add one.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {photosWithUrls.map((photo) => (
            <div key={photo.id} className="bg-zinc-900 rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-zinc-800 text-sm text-zinc-400">
                {photo.date}
                {photo.file_size_kb && (
                  <span className="ml-2 text-zinc-600">{Math.round(photo.file_size_kb)}KB</span>
                )}
              </div>
              {photo.signedUrl && (
                <img
                  src={photo.signedUrl}
                  alt={`Progress ${photo.date}`}
                  className="w-full object-cover max-h-96"
                />
              )}
              {photo.claude_analysis && (
                <div className="px-4 py-3">
                  <div className="text-xs text-zinc-500 mb-1">Claude analysis</div>
                  <p className="text-sm text-zinc-300 whitespace-pre-wrap">{photo.claude_analysis}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <p className="text-xs text-zinc-600 text-center">
        Always send progress photos as files (ðŸ“Ž), not compressed images, for best analysis quality.
      </p>
    </div>
  );
}

