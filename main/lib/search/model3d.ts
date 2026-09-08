export function isEmbeddableModel3dViewerUrl(url: string): boolean {
  try {
    const pathname = new URL(url).pathname.toLowerCase();
    return !/\.(?:glb|gltf|usdz)$/.test(pathname);
  } catch {
    return false;
  }
}
