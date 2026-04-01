"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FiMap, FiCamera, FiTrendingUp, FiActivity } from "react-icons/fi";
import styles from "./Navbar.module.css";

export default function Navbar() {
  const pathname = usePathname();

  const navLinks = [
    { name: "Live Map", href: "/map", icon: <FiMap className={styles.icon} /> },
    { name: "AI Detector", href: "/detect", icon: <FiCamera className={styles.icon} /> },
    { name: "Tracer", href: "/tracer", icon: <FiTrendingUp className={styles.icon} /> },
    { name: "Biodiversity", href: "/biodiversity", icon: <FiActivity className={styles.icon} /> },
  ];

  return (
    <nav className={styles.navbar}>
      <div className={styles.container}>
        <Link href="/" className={styles.brand}>
          <div className={styles.logo}>
            <span className={styles.logoMark}></span>
          </div>
          <span className={styles.brandName}>Neptune<span style={{color: 'var(--slate-800)'}}>Trace</span></span>
        </Link>

        <div className={styles.navLinks}>
          {navLinks.map((link) => {
            const isActive = pathname === link.href || (pathname.startsWith(link.href) && link.href !== '/');
            return (
              <Link
                key={link.name}
                href={link.href}
                className={`${styles.navLink} ${isActive ? styles.active : ""}`}
              >
                {link.icon}
                <span>{link.name}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
