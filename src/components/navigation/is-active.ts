export function isActive(pathname: string, href: string) {
  return pathname === href || (href !== "/today" && pathname.startsWith(`${href}/`));
}
