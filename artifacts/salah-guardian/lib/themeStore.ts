type Theme = "dark" | "light" | "system";
type Listener = () => void;

let _theme: Theme = "system";
const _listeners = new Set<Listener>();

export function getStoredTheme(): Theme {
  return _theme;
}

export function setStoredTheme(t: Theme): void {
  if (_theme === t) return;
  _theme = t;
  _listeners.forEach((l) => l());
}

export function subscribeTheme(l: Listener): () => void {
  _listeners.add(l);
  return () => _listeners.delete(l);
}
