"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  HomeIcon,
  FolderOpenIcon,
  ImageIcon,
  ShoppingCartIcon,
  PackageIcon,
  BookmarkIcon,
  LifeBuoyIcon,

  UserIcon,
  ShieldIcon,
  MonitorSmartphoneIcon,
  LayoutDashboardIcon,
  BoxIcon,
  UploadIcon,
} from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
} from "@dubai/ui/sidebar";

interface AppSidebarProps {
  userEmail: string;
  isRetailer?: boolean;
}

const mainNav = [
  { href: "/dashboard", label: "Dashboard", icon: HomeIcon },
  { href: "/projects", label: "Projects", icon: FolderOpenIcon },
  { href: "/gallery", label: "Gallery", icon: ImageIcon },
  { href: "/cart", label: "Cart", icon: ShoppingCartIcon },
  { href: "/orders", label: "Orders", icon: PackageIcon },
];

const accountNav = [
  { href: "/saved", label: "Saved Packages", icon: BookmarkIcon },
  { href: "/support", label: "Support", icon: LifeBuoyIcon },
  { href: "/settings/profile", label: "Profile", icon: UserIcon },
  { href: "/settings/security", label: "Security", icon: ShieldIcon },
  { href: "/settings/devices", label: "Devices", icon: MonitorSmartphoneIcon },
];

const retailerNav = [
  { href: "/retailer/dashboard", label: "Dashboard", icon: LayoutDashboardIcon },
  { href: "/retailer/catalog", label: "Catalog", icon: BoxIcon },
  { href: "/retailer/catalog/upload", label: "Upload", icon: UploadIcon },
];

export function AppSidebar({ userEmail, isRetailer }: AppSidebarProps) {
  const pathname = usePathname();

  function isActive(href: string): boolean {
    if (href === "/dashboard") return pathname === "/dashboard";
    return pathname.startsWith(href);
  }

  return (
    <Sidebar>
      <SidebarHeader>
        <Link
          href="/dashboard"
          className="flex items-center gap-2 px-2 py-1.5"
        >
          <span className="text-lg font-bold tracking-tight">
            Dubai <span className="text-primary">Furnishing</span>
          </span>
        </Link>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Main</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainNav.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton asChild isActive={isActive(item.href)} tooltip={item.label}>
                    <Link href={item.href}>
                      <item.icon />
                      <span>{item.label}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarSeparator />

        <SidebarGroup>
          <SidebarGroupLabel>Account</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {accountNav.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton asChild isActive={isActive(item.href)} tooltip={item.label}>
                    <Link href={item.href}>
                      <item.icon />
                      <span>{item.label}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {isRetailer && (
          <>
            <SidebarSeparator />
            <SidebarGroup>
              <SidebarGroupLabel>Retailer</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {retailerNav.map((item) => (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton asChild isActive={isActive(item.href)} tooltip={item.label}>
                        <Link href={item.href}>
                          <item.icon />
                          <span>{item.label}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </>
        )}
      </SidebarContent>

      <SidebarFooter>
        <div className="flex items-center gap-2 px-2 py-1.5">
          <div className="bg-primary text-primary-foreground flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-medium">
            {userEmail.charAt(0).toUpperCase()}
          </div>
          <span className="text-sidebar-foreground/70 truncate text-xs">
            {userEmail}
          </span>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
