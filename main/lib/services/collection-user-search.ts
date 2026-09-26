import { Prisma } from "@prisma/client";

export function collectionUserSearchWhere(
  query: string,
): Prisma.UserWhereInput {
  return {
    status: "ACTIVE",
    OR: [
      { id: { equals: query } },
      { name: { contains: query, mode: "insensitive" } },
      { email: { contains: query, mode: "insensitive" } },
      { phoneNumber: { contains: query } },
    ],
  };
}

// Contact hints disambiguate names without exposing complete contact details.
export function userSearchSummary(user: {
  id: string;
  name: string | null;
  email: string | null;
  phoneNumber: string | null;
  isSystemAdmin: boolean;
  isSuperAdmin: boolean;
}) {
  const emailParts = user.email?.split("@");
  return {
    id: user.id,
    name: user.name,
    emailHint:
      emailParts?.length === 2
        ? `${emailParts[0].slice(0, 1)}***@${emailParts[1]}`
        : null,
    phoneHint: user.phoneNumber
      ? user.phoneNumber.length > 7
        ? `${user.phoneNumber.slice(0, 3)}****${user.phoneNumber.slice(-4)}`
        : "****"
      : null,
    isSystemAdmin: user.isSystemAdmin || user.isSuperAdmin,
  };
}
