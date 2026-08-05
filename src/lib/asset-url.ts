// Vite's `base` config (set for subpath IIS deployments, e.g. '/DrumPath/')
// only rewrites paths it processes itself — index.html references and JS
// `import`s. A literal absolute string like '/drum-kit/kick.png' written in
// application code is NOT rewritten and would 404 once the app runs from a
// subpath. `import.meta.env.BASE_URL` is Vite's own resolved `base` value
// (always ends with '/'), so prefixing with it keeps these paths correct in
// both dev (BASE_URL === '/') and any deployed subpath.
export function withBaseUrl(path: string): string {
  return `${import.meta.env.BASE_URL}${path}`
}
