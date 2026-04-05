"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { Shield, Map, Layers3, Camera, Radio, Menu, X, LogOut, User } from "lucide-react";
import styles from "./Navbar.module.css";

export default function Navbar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user, logout } = useAuth();

  const navLinks = [
    { name: "Map", href: "/map", icon: <Map size={16} strokeWidth={1.5} /> },
    { name: "Command Center", href: "/command-center", icon: <Layers3 size={16} strokeWidth={1.5} /> },
    { name: "Live Feed", href: "/live-feed", icon: <Radio size={16} strokeWidth={1.5} /> },
    { name: "Reporting", href: "/reporting", icon: <Camera size={16} strokeWidth={1.5} /> },
  ];

  return (
    <nav className={styles.navbar}>
      <div className={styles.container}>
        <Link href="/" className={styles.brand} onClick={() => setMobileOpen(false)}>
          <Shield size={22} strokeWidth={1.5} className={styles.logoIcon} />
          <span className={styles.brandName}>
            Flood<span className={styles.brandAccent}>Mind</span>
          </span>
        </Link>

        <div className={`${styles.navLinks} ${mobileOpen ? styles.navLinksOpen : ""}`}>
          {navLinks.map((link) => {
            const isActive = pathname === link.href || (pathname.startsWith(link.href) && link.href !== "/");
            return (
              <Link
                key={link.name}
                href={link.href}
                className={`${styles.navLink} ${isActive ? styles.active : ""}`}
                onClick={() => setMobileOpen(false)}
              >
                {link.icon}
                <span>{link.name}</span>
              </Link>
            );
          })}
          
          <div className={styles.authSection}>
            {user ? (
              <div className={styles.userProfile}>
                <span className={styles.avatar}>{user.avatar}</span>
                <div className={styles.userInfo}>
                  <span className={styles.userName}>{user.name}</span>
                  <span className={styles.userRole}>{user.role}</span>
                </div>
                <button onClick={() => void logout()} className={styles.logoutBtn} title="Logout">
                  <LogOut size={16} strokeWidth={1.5} />
                </button>
              </div>
            ) : (
              <Link href="/login" className={styles.loginBtn} onClick={() => setMobileOpen(false)}>
                <User size={14} strokeWidth={1.5} /> <span>Sign In</span>
              </Link>
            )}
          </div>
        </div>

        <button
          className={styles.hamburger}
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label="Toggle navigation"
        >
          {mobileOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>
    </nav>
  );
}
