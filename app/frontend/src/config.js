// The ONLY place the API address lives. The CI workflow bakes VITE_API_BASE into the build;
// locally it falls back to the API started by `bash app/testme.sh`.
export const API_BASE = (import.meta.env.VITE_API_BASE ?? 'http://localhost:8000').replace(/\/$/, '')
