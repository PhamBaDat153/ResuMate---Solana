export type JobMatch = {
  title: string; company: string; location: string; workMode: string; salary: string;
  url: string; matchScore: number; reason: string; matchedSkills: string[]; missingSkills: string[];
}
export type JobMatchResult = { profileSummary: string; matches: JobMatch[] }

export async function findJobMatches(formData: FormData, paymentFetch: typeof fetch = fetch): Promise<JobMatchResult> {
  const response = await paymentFetch('/api/jobs/match', { method: 'POST', body: formData })
  const body = await response.json().catch(() => null)
  if (!response.ok) throw new Error(body?.error ?? 'Không thể tìm việc phù hợp.')
  if (!body || !Array.isArray(body.matches) || typeof body.profileSummary !== 'string') throw new Error('Kết quả không hợp lệ.')
  return body
}
