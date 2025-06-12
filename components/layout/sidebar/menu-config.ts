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

export const menuItems = [
  { icon: Home, label: "Home", href: "/" },
  { icon: LibraryBig, label: "Library", href: "/library" },
  { icon: AppWindow, label: "App Store", href: "/appStore" },
  { icon: Compass, label: "Discover", href: "/discover" },
  { icon: FileCode2, label: "Docs", href: "/docs" },
];

export const accountSubmenuItems = [
  { icon: UserCircle, label: "My Account", href: "/profile" },
  { icon: Settings, label: "Preferences", href: "/preferences" },
  { icon: CreditCard, label: "Purchases", href: "/purchases" },
];

export const workplaceSubmenuItems = [
  { icon: Key, label: "API", href: "/api" },
]; 