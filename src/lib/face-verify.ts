import ZAI from 'z-ai-web-dev-sdk'

/**
 * Verifikasi dua foto wajah menggunakan VLM (Vision Language Model).
 * Membandingkan foto wajah terdaftar dengan foto yang baru ditangkap.
 *
 * @param fotoTerdaftar  Data URL base64 foto wajah terdaftar
 * @param fotoCapture    Data URL base64 foto wajah yang baru ditangkap
 * @returns { match: boolean, confidence: 'TINGGI'|'SEDANG'|'RENDAH', reason: string }
 */
export async function verifyFace(
  fotoTerdaftar: string,
  fotoCapture: string,
): Promise<{ match: boolean; confidence: 'TINGGI' | 'SEDANG' | 'RENDAH'; reason: string }> {
  try {
    const zai = await ZAI.create()

    const prompt = `Anda adalah sistem verifikasi wajah yang sangat teliti. Bandingkan DUA foto berikut:

FOTO PERTAMA: foto wajah terdaftar (referensi).
FOTO KEDUA: foto wajah yang baru ditangkap saat absensi.

Tugas Anda:
1. Analisis apakah KEDUA foto menunjukkan ORANG YANG SAMA.
2. Perhatikan: bentuk wajah, mata, hidung, mulut, alis, struktur tulang, telinga.
3. Abaikan perbedaan pencahayaan, ekspresi, sudut, atau aksesori (kacamata/topi).
4. Pastikan KEDUA foto benar-benar memuat wajah manusia yang jelas (bukan foto kosong/bukan wajah).

Jawab HANYA dengan format JSON valid (tanpa markdown, tanpa penjelasan tambahan):
{
  "match": true | false,
  "confidence": "TINGGI" | "SEDANG" | "RENDAH",
  "reason": "penjelasan singkat 1 kalimat"
}`

    const response = await zai.chat.completions.createVision({
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            { type: 'image_url', image_url: { url: fotoTerdaftar } },
            { type: 'image_url', image_url: { url: fotoCapture } },
          ],
        },
      ],
      thinking: { type: 'disabled' },
    })

    const content = response.choices?.[0]?.message?.content ?? ''
    // Coba parse JSON dari respons (kadang VLM bungkus dengan markdown)
    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      console.error('[verifyFace] Tidak ada JSON di respons VLM:', content.slice(0, 200))
      return { match: false, confidence: 'RENDAH', reason: 'Respons VLM tidak valid' }
    }

    let parsed: any = null
    try {
      parsed = JSON.parse(jsonMatch[0])
    } catch {
      console.error('[verifyFace] Gagal parse JSON:', jsonMatch[0].slice(0, 200))
      return { match: false, confidence: 'RENDAH', reason: 'Gagal parse respons VLM' }
    }

    return {
      match: parsed.match === true,
      confidence: ['TINGGI', 'SEDANG', 'RENDAH'].includes(parsed.confidence)
        ? parsed.confidence
        : 'RENDAH',
      reason: String(parsed.reason ?? '-'),
    }
  } catch (e: any) {
    console.error('[verifyFace] error:', e?.message ?? e)
    return {
      match: false,
      confidence: 'RENDAH',
      reason: `Error verifikasi: ${e?.message ?? 'unknown'}`,
    }
  }
}
