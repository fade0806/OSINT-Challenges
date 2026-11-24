export type PannellumViewer = {
  destroy: () => void;
};

declare global {
  interface Window {
    pannellum?: {
      viewer: (
        container: HTMLElement,
        config: Record<string, unknown>,
      ) => PannellumViewer;
    };
  }
}
