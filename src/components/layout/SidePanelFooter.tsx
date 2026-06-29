/**
 * NEXA NautaX — SidePanelFooter
 */

export function SidePanelFooter() {
  return (
    <footer
      className="flex items-center justify-between px-4 border-t border-border-subtle text-xs text-foreground-muted"
      style={{ height: 'var(--sidepanel-footer-height)' }}
    >
      <span>NEXA NautaX ELITE v1.0.0</span>
      <span className="font-mono">© 2026 NEXA</span>
    </footer>
  );
}
