"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { FiMap, FiCamera, FiTrendingUp, FiActivity, FiShield, FiAward, FiBookOpen, FiMenu, FiX } from "react-icons/fi";
import styles from "./Navbar.module.css";

export default function Navbar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const navLinks = [
    { name: "Live Map", href: "/map", icon: <FiMap /> },
    { name: "Report", href: "/report", icon: <FiShield /> },
    { name: "AI Detector", href: "/detect", icon: <FiCamera /> },
    { name: "Tracer", href: "/tracer", icon: <FiTrendingUp /> },
    { name: "Biodiversity", href: "/biodiversity", icon: <FiActivity /> },
    { name: "Dashboard", href: "/dashboard", icon: <FiAward /> },
    { name: "Ledger", href: "/ledger", icon: <FiBookOpen /> },
  ];

  return (
    <nav className={styles.navbar}>
      <div className={styles.container}>
        <Link href="/" className={styles.brand} onClick={() => setMobileOpen(false)}>
          <div className={styles.logo}>
            <span className={styles.logoMark}>🛡</span>
          </div>
          <span className={styles.brandName}>
            Ocean<span className={styles.brandAccent}>Sentinel</span>
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
        </div>

        <button
          className={styles.hamburger}
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label="Toggle navigation"
        >
          {mobileOpen ? <FiX /> : <FiMenu />}
        </button>
      </div>
    </nav>
  );
}
