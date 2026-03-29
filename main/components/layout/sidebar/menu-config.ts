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
  History,
  BookOpen,
  Gamepad2,
  Bot,
  MoreHorizontal
} from "lucide-react";
import { Role } from "@prisma/client";

interface MenuItemWithRoles {
  icon: any;
  labelKey: string;
  href: string;
  roles?: Role[];
  children?: Array<{ icon: any; labelKey: string; href: string }>;
}

export const menuItems = [
  { icon: Home, labelKey: "home", href: "/" },
  { icon: LibraryBig, labelKey: "library", href: "/library" },
  {
    icon: AppWindow,
    labelKey: "appStore",
    href: "/appStore",
    children: [
      { icon: BookOpen, labelKey: "learning", href: "/appStore?category=Learning" },
      { icon: Gamepad2, labelKey: "gaming", href: "/appStore?category=Gaming" },
      { icon: Bot, labelKey: "ai", href: "/appStore?category=AI" },
      { icon: MoreHorizontal, labelKey: "others", href: "/appStore?category=Others" },
    ],
  },
  // TODO: impl in the future.
  // { icon: Compass, labelKey: "discover", href: "/discover" },
  { icon: FileCode2, labelKey: "docs", href: "/docs" },
];

const baseAccountSubmenuItems: MenuItemWithRoles[] = [
  { icon: UserCircle, labelKey: "myAccount", href: "/account/profile" },
  { icon: History, labelKey: "myRecord", href: "/account/my-record" },
  // { icon: Settings, labelKey: "settings", href: "/account/preferences" },
  // { icon: CreditCard, labelKey: "purchases", href: "/account/purchases" },
  { icon: FileCode2, labelKey: "dataAnnotation", href: "/account/data-annotation", roles: [Role.TAGGER_PARTNER, Role.TAGGER_OUTSOURCING] },
];

export const getAccountSubmenuItems = (userRole?: Role) => {
  return baseAccountSubmenuItems.filter(item =>
    !item.roles || (userRole && item.roles.includes(userRole))
  );
};

// For backward compatibility - returns all items without role filtering
export const accountSubmenuItems = baseAccountSubmenuItems.filter(item => !item.roles);

export const workplaceSubmenuItems = [
  { icon: Key, labelKey: "api", href: "/workplace/api" },
];
