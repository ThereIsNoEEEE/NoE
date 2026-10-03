// React's profile object can be passed unchanged to these functions.
// This module is an integration example; the supplied compiled HTML is NOT patched.
async function request(path, method = 'GET', profile) {
  const response = await fetch(path, { method, headers: { 'Content-Type': 'application/json' }, ...(profile ? { body: JSON.stringify(profile) } : {}), signal: AbortSignal.timeout(15000) });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error?.message || '학사 정보 저장 실패');
  return data;
}

export const createProfile = profile => request('/api/db/profiles', 'POST', profile);
export const getProfile = id => request(`/api/db/profiles/${encodeURIComponent(id)}`);
export const updateProfile = (id, profile) => request(`/api/db/profiles/${encodeURIComponent(id)}`, 'PUT', profile);

// onSearch/onSubmit integration:
// Disable the submit button while awaiting to prevent duplicate POST requests.
// const saved = profileId ? await updateProfile(profileId, profile) : await createProfile(profile);
// localStorage.setItem('kmu-pick-profile-id-v1', saved.id);
// Only AFTER the awaited request succeeds, set onboarded=true and navigate home.
// Display an error and stay on the form if saving fails. Do not silently mark saved.
