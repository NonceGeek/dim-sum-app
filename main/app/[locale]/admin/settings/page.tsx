"use client";

export default function AdminSettingsPage() {
  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h2 className="text-3xl font-bold tracking-tight text-foreground">
          Settings
        </h2>
        <p className="text-muted-foreground mt-2">
          Configure system parameters and administrative settings.
        </p>
      </div>

      {/* Content placeholder */}
      <div className="flex items-center justify-center h-96 bg-card border-border border rounded-lg">
        <div className="text-center">
          <h3 className="text-xl font-medium text-muted-foreground mb-2">
            System Settings
          </h3>
        </div>
      </div>
    </div>
  );
}