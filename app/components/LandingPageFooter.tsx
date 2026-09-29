"use client";

import React from "react";
import Link from "next/link";

export default function LandingPageFooter() {
  const scrollToSection = (e: React.MouseEvent, targetId: string) => {
    if (e) {
      e.preventDefault();
    }

    if (!targetId || targetId === "#" || targetId === "/" || targetId === "#top") {
      window.scrollTo({ top: 0, behavior: "smooth" });
      if (typeof window !== "undefined" && window.history.pushState) {
        window.history.pushState(null, "", window.location.pathname);
      }
      return;
    }

    const cleanId = targetId.replace(/^#/, "");

    const aliasMap: Record<string, string> = {
      "how-it-works": "how-it-works",
      "challenges": "how-it-works",
      "preview": "metrics",
      "metrics": "metrics",
      "get-started": "contact",
      "privacy": "contact",
      "terms": "contact",
      "security": "contact",
      "disclaimer": "contact",
    };

    const targetElementId = aliasMap[cleanId] || cleanId;
    const element =
      document.getElementById(targetElementId) ||
      document.getElementById(cleanId);

    if (element) {
      const header = document.querySelector(".ct-header");
      const headerHeight = header ? header.getBoundingClientRect().height : 70;
      const elementPosition = element.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.pageYOffset - headerHeight - 12;

      window.scrollTo({
        top: Math.max(0, offsetPosition),
        behavior: "smooth",
      });

      if (typeof window !== "undefined" && window.history.pushState) {
        window.history.pushState(null, "", `#${cleanId}`);
      }
    }
  };

  return (
    <footer className="ct-footer">
      <div className="ct-footer-container">
        {/* ================= DESKTOP FOOTER (>= 769px) ================= */}
        <div className="ct-footer-desktop">
          <div className="ct-footer-main-grid">
            {/* Column 1: Brand */}
            <div className="ct-footer-col ct-footer-brand-col">
              <Link
                href="/"
                className="ct-footer-logo-link"
                onClick={(e) => scrollToSection(e, "#top")}
              >
                <img
                  src="/clear-tax-logo.svg"
                  alt="ClearTax"
                  className="ct-footer-brand-logo"
                />
              </Link>
              <p className="ct-footer-brand-desc">
                The property investment portfolio platform from the ClearTax family. Built for disciplined Australian real estate investors and accountants.
              </p>
            </div>

            {/* Column 2: Platform */}
            <div className="ct-footer-col">
              <h4 className="ct-footer-col-title">PLATFORM</h4>
              <ul className="ct-footer-nav-list">
                <li>
                  <Link
                    href="#overview"
                    className="ct-footer-nav-link"
                    onClick={(e) => scrollToSection(e, "#overview")}
                  >
                    Overview
                  </Link>
                </li>
                <li>
                  <Link
                    href="#how-it-works"
                    className="ct-footer-nav-link"
                    onClick={(e) => scrollToSection(e, "#how-it-works")}
                  >
                    How it works
                  </Link>
                </li>
                <li>
                  <Link
                    href="#features"
                    className="ct-footer-nav-link"
                    onClick={(e) => scrollToSection(e, "#features")}
                  >
                    Features
                  </Link>
                </li>
                <li>
                  <Link
                    href="#faqs"
                    className="ct-footer-nav-link"
                    onClick={(e) => scrollToSection(e, "#faqs")}
                  >
                    FAQs
                  </Link>
                </li>
              </ul>
            </div>

            {/* Column 3: Trust & Legal */}
            <div className="ct-footer-col">
              <h4 className="ct-footer-col-title">TRUST &amp; LEGAL</h4>
              <ul className="ct-footer-nav-list">
                <li>
                  <Link
                    href="#contact"
                    className="ct-footer-nav-link"
                    onClick={(e) => scrollToSection(e, "#contact")}
                  >
                    Privacy Policy
                  </Link>
                </li>
                <li>
                  <Link
                    href="#contact"
                    className="ct-footer-nav-link"
                    onClick={(e) => scrollToSection(e, "#contact")}
                  >
                    Terms of Service
                  </Link>
                </li>
                <li>
                  <Link
                    href="#contact"
                    className="ct-footer-nav-link"
                    onClick={(e) => scrollToSection(e, "#contact")}
                  >
                    Security &amp; Encryption
                  </Link>
                </li>
                <li>
                  <a
                    href="mailto:contact@clearportfolio.com.au"
                    className="ct-footer-nav-link"
                  >
                    contact@clearportfolio.com.au
                  </a>
                </li>
              </ul>
            </div>
          </div>

          {/* Desktop Divider */}
          <div className="ct-footer-divider" />

          {/* Desktop Bottom Row */}
          <div className="ct-footer-bottom-row">
            <p className="ct-footer-copyright">
              © 2025 ClearPortfolio by ClearTax. All rights reserved.
            </p>
            <p className="ct-footer-tagline">
              Engineered with <span className="highlight-orange">financial precision</span>.
            </p>
          </div>
        </div>

        {/* ================= MOBILE FOOTER (<= 768px) ================= */}
        <div className="ct-footer-mobile">
          {/* Brand Row with ClearTax Portfolio Badge */}
          <div className="ct-mobile-footer-brand">
            <Link
              href="/"
              className="ct-footer-logo-link"
              onClick={(e) => scrollToSection(e, "#top")}
            >
              <div className="ct-mobile-brand-wrapper">
                <img
                  src="/clear-tax-logo.svg"
                  alt="ClearTax"
                  className="ct-footer-brand-logo"
                />
                <span className="ct-brand-separator">|</span>
                <span className="ct-brand-portfolio-text">Portfolio</span>
              </div>
            </Link>
            <p className="ct-mobile-brand-desc">
              Intelligent property tracking built specifically for Australian real estate investors and ClearTax clients.
            </p>
          </div>

          {/* 2-Column Links Grid */}
          <div className="ct-mobile-footer-grid">
            {/* Column 1: Platform */}
            <div className="ct-mobile-col">
              <h4 className="ct-mobile-col-title">PLATFORM</h4>
              <ul className="ct-mobile-links-list">
                <li>
                  <Link
                    href="#overview"
                    className="ct-mobile-link"
                    onClick={(e) => scrollToSection(e, "#overview")}
                  >
                    Portfolio Tracker
                  </Link>
                </li>
                <li>
                  <Link
                    href="#features"
                    className="ct-mobile-link"
                    onClick={(e) => scrollToSection(e, "#features")}
                  >
                    Yield Calculator
                  </Link>
                </li>
                <li>
                  <Link
                    href="#features"
                    className="ct-mobile-link"
                    onClick={(e) => scrollToSection(e, "#features")}
                  >
                    Lease Management
                  </Link>
                </li>
                <li>
                  <Link
                    href="#features"
                    className="ct-mobile-link"
                    onClick={(e) => scrollToSection(e, "#features")}
                  >
                    Document Vault
                  </Link>
                </li>
              </ul>
            </div>

            {/* Column 2: Legal & Trust */}
            <div className="ct-mobile-col">
              <h4 className="ct-mobile-col-title">LEGAL &amp; TRUST</h4>
              <ul className="ct-mobile-links-list">
                <li>
                  <Link
                    href="#contact"
                    className="ct-mobile-link"
                    onClick={(e) => scrollToSection(e, "#contact")}
                  >
                    Privacy Policy
                  </Link>
                </li>
                <li>
                  <Link
                    href="#contact"
                    className="ct-mobile-link"
                    onClick={(e) => scrollToSection(e, "#contact")}
                  >
                    Terms of Service
                  </Link>
                </li>
                <li>
                  <Link
                    href="#contact"
                    className="ct-mobile-link"
                    onClick={(e) => scrollToSection(e, "#contact")}
                  >
                    CDR Security
                  </Link>
                </li>
                <li>
                  <Link
                    href="#contact"
                    className="ct-mobile-link"
                    onClick={(e) => scrollToSection(e, "#contact")}
                  >
                    Financial Disclaimer
                  </Link>
                </li>
              </ul>
            </div>
          </div>

          {/* Mobile Divider */}
          <div className="ct-mobile-footer-divider" />

          {/* Mobile Disclaimer & Copyright */}
          <div className="ct-mobile-disclaimer-block">
            <p className="ct-mobile-disclaimer-text">
              Disclaimer: ClearPortfolio provides general portfolio analytics and does not constitute licensed personal financial, taxation or credit advice.
            </p>
            <p className="ct-mobile-copyright-text">
              © 2025 ClearPortfolio by ClearTax. All rights reserved.
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
