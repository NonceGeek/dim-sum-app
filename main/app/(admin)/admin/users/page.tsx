"use client";

export default function AdminUsersPage() {
  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h2 className="text-3xl font-bold tracking-tight text-white">
          Users
        </h2>
        <p className="text-gray-400 mt-2">
          Manage user accounts and permissions.
        </p>
      </div>

      {/* Content placeholder */}
      <div className="flex items-center justify-center h-96 bg-gray-800 border-gray-700 border rounded-lg">
        <div className="text-center">
          <h3 className="text-xl font-medium text-gray-300 mb-2">
            Users Management
          </h3>
        </div>
      </div>
    </div>
  );
}