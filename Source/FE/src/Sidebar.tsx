import { NavLink } from "react-router";
import { PropsWithChildren } from "react";

const links = [
  { to: "/", label: "Trang chủ" },
  { to: "/evaluate", label: "Đánh giá CV" },
];

export function Sidebar({ children }: PropsWithChildren) {
  return (
    <div className="flex min-h-screen bg-bg1 text-foreground">
      <aside className="sticky top-0 flex h-screen w-60 shrink-0 flex-col border-r border-border-low bg-card px-4 py-6">
        <div className="mb-8 px-2 text-lg font-semibold tracking-tight">
          ResuMate
        </div>
        <nav className="flex flex-col gap-1">
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.to === "/"}
              className={({ isActive }) =>
                "rounded-lg px-3 py-2 text-sm font-medium transition " +
                (isActive
                  ? "bg-cream text-foreground"
                  : "text-muted hover:bg-cream/60 hover:text-foreground")
              }
            >
              {link.label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
