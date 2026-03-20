export function MinimalFooter() {
  return (
    <footer className="mt-auto px-6 py-4 flex justify-between items-center">
      <p className="text-xs text-muted-foreground">
        &copy; {new Date().getFullYear()} DimSum AI Labs
      </p>
      <p className="text-xs text-muted-foreground">
        苏ICP备2025170597号
      </p>
    </footer>
  );
}
