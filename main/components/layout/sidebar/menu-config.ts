import {
  Home,
  LibraryBig,
  AppWindow,
  Compass,
  FileCode2,
  UserCircle,
  Settings,
  CreditCard,
  Key,
} from "lucide-react";
import { Role } from "@prisma/client";

interface MenuItemWithRoles {
  icon: any;
  label: string;
  href: string;
  roles?: Role[];
}

export const menuItems = [
  { icon: Home, label: "Home", href: "/" },
  { icon: LibraryBig, label: "Library", href: "/library" },
  { icon: AppWindow, label: "App Store", href: "/appStore" },
  // TODO: impl in the future.
  // { icon: Compass, label: "Discover", href: "/discover" },
  { icon: FileCode2, label: "Docs", href: "/docs" },
];

const baseAccountSubmenuItems: MenuItemWithRoles[] = [
  { icon: UserCircle, label: "My Account", href: "/account/profile" },
  // { icon: Settings, label: "Preferences", href: "/account/preferences" },
  // { icon: CreditCard, label: "Purchases", href: "/account/purchases" },
  { icon: FileCode2, label: "Data Annotation", href: "/account/data-annotation", roles: [Role.TAGGER_PARTNER, Role.TAGGER_OUTSOURCING] },
];

export const getAccountSubmenuItems = (userRole?: Role) => {
  return baseAccountSubmenuItems.filter(item => 
    !item.roles || (userRole && item.roles.includes(userRole))
  );
};

// For backward compatibility - returns all items without role filtering
export const accountSubmenuItems = baseAccountSubmenuItems.filter(item => !item.roles);

export const workplaceSubmenuItems = [
  { icon: Key, label: "API", href: "/workplace/api" },
]; 