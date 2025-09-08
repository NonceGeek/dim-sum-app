"use client";

export default function AdminSettingsPage() {
  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h2 className="text-3xl font-bold tracking-tight text-white">
          Settings
        </h2>
        <p className="text-gray-400 mt-2">
          Configure system parameters and administrative settings.
        </p>
      </div>

      {/* Content placeholder */}
      <div className="flex items-center justify-center h-96 bg-gray-800 border-gray-700 border rounded-lg">
        <div className="text-center">
          <h3 className="text-xl font-medium text-gray-300 mb-2">
            System Settings
          </h3>
        </div>
      </div>
    </div>
  );
}