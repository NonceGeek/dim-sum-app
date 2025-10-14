export function Footer() {
  return (
    <footer className="bg-transparent text-base-content">
      <div className="border-t border-base-300">
        <div className="container mx-auto px-6 py-6">
          <div className="flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0">
            <p className="text-sm text-base-content/60">
              © {new Date().getFullYear()} DIMSUM AI 实验室。保留所有权利。
            </p>
            <p className="text-sm text-base-content/60">苏ICP备2025170597号</p>
          </div>
        </div>
      </div>
    </footer>
  );
}
