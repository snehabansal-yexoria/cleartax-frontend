"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import LandingPageFooter from "./components/LandingPageFooter";
import "./landing.css";

export default function Home() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  // Smooth scroll handler that works across all devices with header offset compensation
  const scrollToSection = (e?: React.MouseEvent, targetId?: string) => {
    if (e) {
      e.preventDefault();
    }
    setMobileMenuOpen(false);

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

  // Lock body scroll when mobile drawer is open
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileMenuOpen]);

  // Handle direct hash navigation on initial page load
  useEffect(() => {
    if (typeof window !== "undefined" && window.location.hash) {
      const hash = window.location.hash;
      const timer = setTimeout(() => {
        scrollToSection(undefined, hash);
      }, 150);
      return () => clearTimeout(timer);
    }
  }, []);

  const faqs = [
    {
      question: "What is ClearPortfolio?",
      mobileQuestion: "How does ClearPortfolio calculate property values?",
      answer:
        "ClearPortfolio is a comprehensive real-time property intelligence and portfolio management platform built specifically for Australian property investors. It brings your loans, valuations, rental income, and tax-deductible expenses into one live, synchronized dashboard.",
    },
    {
      question: "Who can use ClearPortfolio?",
      mobileQuestion: "Can I connect properties held in Trusts and SMSFs?",
      answer:
        "Whether you own one investment property, a growing residential portfolio, commercial assets, or properties held across Trusts and SMSFs, ClearPortfolio is engineered to scale with your wealth strategy.",
    },
    {
      question: "How do I get started?",
      mobileQuestion: "Does it synchronize with my Australian bank loans?",
      answer:
        "Getting started takes under 2 minutes. Simply create your account, connect your property addresses, and link your banking institutions or upload your initial settlement and lease documents. Our engine automatically reconciles your current equity and cash flow.",
    },
    {
      question: "What can I track in ClearPortfolio?",
      mobileQuestion: "How does ClearTax integration work for my tax return?",
      answer:
        "You can track live property valuations via CoreLogic, mortgage balances, interest rates, LVR drift, rental yields, tenant lease expiry schedules, deductible maintenance expenses, and depreciation schedules.",
    },
    {
      question: "Is my information secure?",
      mobileQuestion: "Can I invite my mortgage broker or property manager?",
      answer:
        "Yes. ClearPortfolio uses bank-grade 256-bit AES encryption and SOC 2 Type II compliant cloud infrastructure. We maintain strict read-only banking integrations through regulated Open Banking partners, ensuring your credentials and assets remain 100% protected.",
    },
    {
      question: "Does ClearPortfolio replace my accountant?",
      mobileQuestion: "Is my financial and personal data safe?",
      answer:
        "No, ClearPortfolio is designed to empower both you and your accountant. It automates record keeping, categorizes expenses according to ATO rules, and generates one-click tax packs that save your accountant hours during tax season.",
    },
  ];

  return (
    <div className="ct-landing-wrapper">
      {/* ================= HEADER / NAVBAR ================= */}
      <header className="ct-header">
        <div className="ct-nav-container">
          {/* Logo */}
          <Link
            href="/"
            className="ct-logo-link"
            onClick={(e) => scrollToSection(e, "#top")}
          >
            <img
              src="/clear-tax-logo.svg"
              alt="ClearTax Accountants"
              className="ct-brand-logo"
            />
          </Link>

          {/* Desktop Nav Links */}
          <nav className="ct-nav-links">
            <Link
              href="#overview"
              className="ct-nav-link"
              onClick={(e) => scrollToSection(e, "#overview")}
            >
              Overview
            </Link>
            <Link
              href="#how-it-works"
              className="ct-nav-link"
              onClick={(e) => scrollToSection(e, "#how-it-works")}
            >
              How it works
            </Link>
            <Link
              href="#features"
              className="ct-nav-link"
              onClick={(e) => scrollToSection(e, "#features")}
            >
              Features
            </Link>
            <Link
              href="#faqs"
              className="ct-nav-link"
              onClick={(e) => scrollToSection(e, "#faqs")}
            >
              FAQs
            </Link>
          </nav>

          {/* Header Action Buttons */}
          <div className="ct-nav-actions">
            <Link
              href="#contact"
              className="ct-contact-link"
              onClick={(e) => scrollToSection(e, "#contact")}
            >
              Contact
            </Link>
            <Link
              href="#contact"
              className="ct-btn-primary"
              onClick={(e) => scrollToSection(e, "#contact")}
            >
              Get Started
            </Link>
            {/* Mobile Hamburger Toggle */}
            <button
              className="ct-mobile-toggle"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Toggle Navigation Menu"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                {mobileMenuOpen ? (
                  <>
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </>
                ) : (
                  <>
                    <line x1="4" y1="7" x2="20" y2="7" />
                    <line x1="4" y1="12" x2="20" y2="12" />
                    <line x1="4" y1="17" x2="20" y2="17" />
                  </>
                )}
              </svg>
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Navigation Drawer Backdrop Overlay */}
      <div
        className={`ct-drawer-backdrop ${mobileMenuOpen ? "open" : ""}`}
        onClick={() => setMobileMenuOpen(false)}
        aria-hidden={!mobileMenuOpen}
      />

      {/* Mobile Navigation Right-to-Left Slide-in Drawer */}
      <aside
        className={`ct-drawer-panel ${mobileMenuOpen ? "open" : ""}`}
        aria-label="Mobile Navigation"
      >
        {/* Drawer Header */}
        <div className="ct-drawer-header">
          <Link
            href="/"
            className="ct-logo-link"
            onClick={(e) => scrollToSection(e, "#top")}
          >
            <img
              src="/clear-tax-logo.svg"
              alt="ClearTax Accountants"
              className="ct-brand-logo"
            />
          </Link>
          <button
            className="ct-drawer-close-btn"
            onClick={() => setMobileMenuOpen(false)}
            aria-label="Close menu"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Drawer Links */}
        <div className="ct-drawer-body">
          <nav className="ct-drawer-nav">
            <Link
              href="#overview"
              className="ct-drawer-link"
              onClick={(e) => scrollToSection(e, "#overview")}
            >
              <span>Overview</span>
              <svg className="ct-drawer-link-arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </Link>
            <Link
              href="#how-it-works"
              className="ct-drawer-link"
              onClick={(e) => scrollToSection(e, "#how-it-works")}
            >
              <span>How it works</span>
              <svg className="ct-drawer-link-arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </Link>
            <Link
              href="#features"
              className="ct-drawer-link"
              onClick={(e) => scrollToSection(e, "#features")}
            >
              <span>Features</span>
              <svg className="ct-drawer-link-arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </Link>
            <Link
              href="#faqs"
              className="ct-drawer-link"
              onClick={(e) => scrollToSection(e, "#faqs")}
            >
              <span>FAQs</span>
              <svg className="ct-drawer-link-arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </Link>
            <Link
              href="#contact"
              className="ct-drawer-link"
              onClick={(e) => scrollToSection(e, "#contact")}
            >
              <span>Contact</span>
              <svg className="ct-drawer-link-arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </Link>
          </nav>
        </div>

        {/* Drawer Bottom Action */}
        <div className="ct-drawer-footer">
          <Link
            href="#contact"
            className="ct-btn-primary ct-drawer-cta"
            onClick={(e) => scrollToSection(e, "#contact")}
          >
            <span>Get Started</span>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="5" y1="12" x2="19" y2="12" />
              <polyline points="12 5 19 12 12 19" />
            </svg>
          </Link>
          <p className="ct-drawer-tagline">Property Portfolio Management</p>
        </div>
      </aside>

      {/* ================= HERO SECTION ================= */}
      <main id="top" className="ct-hero-section">
        {/* Top Tag Pill */}
        <div className="ct-badge-pill">
          <span className="ct-badge-dot" />
          <span>PROPERTY PORTFOLIO MANAGEMENT</span>
        </div>

        {/* Main Heading */}
        <h1 className="ct-hero-title">
          A clear view of your{" "}
          <span className="highlight-orange">entire portfolio.</span>
        </h1>

        {/* Subtitle */}
        <p className="ct-hero-subtitle">
          ClearPortfolio brings every property you own into a single, live view, so you always know exactly how your portfolio is performing.
        </p>

        {/* CTA Buttons */}
        <div className="ct-hero-actions">
          <Link
            href="#contact"
            className="ct-btn-primary"
            onClick={(e) => scrollToSection(e, "#contact")}
          >
            <span>Get Started Free</span>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="5" y1="12" x2="19" y2="12" />
              <polyline points="12 5 19 12 12 19" />
            </svg>
          </Link>
          <Link
            href="#metrics"
            className="ct-btn-secondary"
            onClick={(e) => scrollToSection(e, "#metrics")}
          >
            Explore live preview
          </Link>
        </div>

        {/* ================= MOCKUP IMAGE & FLOATING ELEMENTS ================= */}
        <div className="ct-mockup-wrapper">
          {/* Desktop Floating Badge: Top Right */}
          <div className="ct-floating-badge badge-top-right">
            <div className="ct-badge-icon-box">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="M13.73 21a2 2 0 0 1-3.46 0" />
              </svg>
            </div>
            <div className="ct-floating-badge-content">
              <span className="ct-floating-badge-label">LEASE REVIEWS ALERT</span>
              <span className="ct-floating-badge-value">
                2 upcoming <span className="accent">in next 30 days</span>
              </span>
            </div>
          </div>

          {/* Desktop Floating Badge: Bottom Left */}
          <div className="ct-floating-badge badge-bottom-left">
            <div className="ct-badge-icon-box">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
                <polyline points="17 6 23 6 23 12" />
              </svg>
            </div>
            <div className="ct-floating-badge-content">
              <span className="ct-floating-badge-label">LIVE EQUITY TRACKING</span>
              <span className="ct-floating-badge-value">
                +$340,000 <span className="accent">YoY (+8.4%)</span>
              </span>
            </div>
          </div>

          {/* Mobile Floating Pill: Top */}
          <div className="ct-mobile-top-pill">
            <span className="dot" />
            <span>Live Equity: +$340k</span>
          </div>

          {/* Mobile Floating Pill: Bottom */}
          <div className="ct-mobile-bottom-pill">
            <span className="dot" />
            <span>
              Lease Review: <span className="highlight">2 upcoming</span>
            </span>
          </div>

          <img
            src="/Image1.png"
            alt="ClearPortfolio Dashboard Preview"
            className="ct-mockup-img"
          />
        </div>
      </main>

      {/* ================= SECTION 2: CORE PLATFORM / FEATURES ================= */}
      <section id="overview" className="ct-features-section">
        <div className="ct-features-container">
          {/* Section Tag */}
          <div className="ct-features-badge">CLEARPORTFOLIO</div>

          {/* Section Title */}
          <h2 className="ct-features-title">
            Your portfolio, finally in one place.
          </h2>

          {/* Section Description */}
          <p className="ct-features-subtitle">
            ClearPortfolio is a portfolio tracking tool built for property investors. It replaces scattered spreadsheets, folders and email threads with one live dashboard, so you always know how each property is performing and how your whole portfolio is tracking.
          </p>

          {/* 4 Feature Cards Grid */}
          <div className="ct-features-grid">
            {/* Card 01 */}
            <div className="ct-feature-card">
              <div className="ct-card-header">
                <span className="ct-card-number">01</span>
                <span className="ct-card-dot" />
              </div>
              <h3 className="ct-card-title">Portfolio-wide overview</h3>
              <p className="ct-card-desc">
                Aggregate net equity, loan-to-value ratios, and total gross valuation across your entire property holdings in real-time.
              </p>
            </div>

            {/* Card 02 */}
            <div className="ct-feature-card">
              <div className="ct-card-header">
                <span className="ct-card-number">02</span>
                <span className="ct-card-dot" />
              </div>
              <h3 className="ct-card-title">Property-by-property performance</h3>
              <p className="ct-card-desc">
                Deep dive into rental yields, cash flow, tax-deductible expenses, and capital appreciation for each individual asset.
              </p>
            </div>

            {/* Card 03 */}
            <div className="ct-feature-card">
              <div className="ct-card-header">
                <span className="ct-card-number">03</span>
                <span className="ct-card-dot" />
              </div>
              <h3 className="ct-card-title">Reminders for key dates</h3>
              <p className="ct-card-desc">
                Automated alerts for upcoming lease expiries, rent reviews, council rates, insurance renewals, and mortgage fixed-rate rollovers.
              </p>
            </div>

            {/* Card 04 */}
            <div className="ct-feature-card">
              <div className="ct-card-header">
                <span className="ct-card-number">04</span>
                <span className="ct-card-dot" />
              </div>
              <h3 className="ct-card-title">Simple, secure record keeping</h3>
              <p className="ct-card-desc">
                Store leases, depreciation schedules, inspection reports, and purchase contracts directly tied to each property.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ================= SECTION 3: THE STATUS QUO / CURRENT CHALLENGES ================= */}
      <section id="how-it-works" className="ct-challenges-section">
        <div className="ct-challenges-container">
          {/* Left Column: Heading & Info */}
          <div className="ct-challenges-left">
            {/* Desktop Badge */}
            <div className="ct-challenges-badge desktop-only">THE STATUS QUO</div>
            {/* Mobile Pill Badge */}
            <div className="ct-badge-pill mobile-only ct-challenges-mobile-pill">
              <span className="ct-badge-dot" />
              <span>CURRENT CHALLENGES</span>
            </div>

            <h2 className="ct-challenges-title">
              Property information is everywhere.{" "}
              <span className="highlight-orange">Your portfolio shouldn’t be.</span>
            </h2>
            <p className="ct-challenges-desc">
              Scattered data across property managers, banking portals, and manual spreadsheets leaves investors blind to actual returns.
            </p>
            <div className="ct-challenges-divider" />
            <p className="ct-challenges-footer-note">
              Built by ClearTax to solve real property accounting and tracking hurdles.
            </p>
          </div>

          {/* Right Column: Challenges List / Cards */}
          <div className="ct-challenges-right">
            {/* Card 01 */}
            <div className="ct-challenge-item">
              <div className="ct-challenge-item-header">
                <span className="ct-card-number">01</span>
                <h3 className="ct-challenge-item-title">No portfolio tracking</h3>
              </div>
              <p className="ct-challenge-item-desc">
                Investors toggle between 3 different bank apps, messy spreadsheets, and property manager portals just to calculate their net balance.
              </p>
            </div>

            {/* Card 02 */}
            <div className="ct-challenge-item">
              <div className="ct-challenge-item-header">
                <span className="ct-card-number">02</span>
                <h3 className="ct-challenge-item-title">No visibility on performance</h3>
              </div>
              <p className="ct-challenge-item-desc">
                LVR drift goes unnoticed and real gross vs. net yields are often calculated incorrectly or outdated by months.
              </p>
            </div>

            {/* Card 03 */}
            <div className="ct-challenge-item">
              <div className="ct-challenge-item-header">
                <span className="ct-card-number">03</span>
                <h3 className="ct-challenge-item-title">Key dates get missed</h3>
              </div>
              <p className="ct-challenge-item-desc">
                Lease renewals lapse without rate adjustments, costing Australian property owners thousands in uncollected market rent.
              </p>
            </div>

            {/* Card 04 */}
            <div className="ct-challenge-item">
              <div className="ct-challenge-item-header">
                <span className="ct-card-number">04</span>
                <h3 className="ct-challenge-item-title">Record keeping is everywhere</h3>
              </div>
              <p className="ct-challenge-item-desc">
                Tax time becomes an annual frantic chase for missing settlement sheets, QS reports, and repair tax receipts.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ================= SECTION 4: DESIGNED FOR CLARITY / DETAILED FEATURES ================= */}
      <section id="features" className="ct-clarity-section">
        <div className="ct-clarity-container">
          {/* ================= DESKTOP LAYOUT (>= 901px) ================= */}
          <div className="ct-clarity-desktop">
            {/* Top Section Header */}
            <div className="ct-clarity-header">
              <div className="ct-clarity-badge">
                <span className="ct-badge-dot" />
                <span>DESIGNED FOR CLARITY</span>
              </div>
              <h2 className="ct-clarity-title">
                Everything you need to see the{" "}
                <span className="highlight-orange">bigger picture</span>
                <span className="ct-title-period">.</span>
              </h2>
              <p className="ct-clarity-subtitle">
                A dedicated system engineered for precision, clarity, and continuous visibility.
              </p>
            </div>

            {/* Alternating 4 Feature Rows */}
            <div className="ct-clarity-grid">
              {/* ---------------- FEATURE 01 ---------------- */}
              <div className="ct-clarity-row ct-clarity-row-1">
                {/* Left: Text Content */}
                <div className="ct-clarity-text-col">
                  <span className="ct-feature-tag">FEATURE 01</span>
                  <h3 className="ct-clarity-row-title">Your whole portfolio, one view</h3>
                  <p className="ct-clarity-row-desc">
                    See every property side by side, plus how they add up together as a portfolio. Real-time balance sheets, combined LVR, and accurate total net wealth calculations.
                  </p>
                  <ul className="ct-feature-checklist">
                    <li>
                      <svg className="ct-check-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                      <span>Consolidated equity and mortgage ledger</span>
                    </li>
                    <li>
                      <svg className="ct-check-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                      <span>State and asset class distribution tracking</span>
                    </li>
                  </ul>
                </div>

                {/* Right: Dashboard Mockup Image */}
                <div className="ct-clarity-visual-col">
                  <div className="ct-clarity-img-wrapper">
                    <img
                      src="/Image1.png"
                      alt="ClearPortfolio Dashboard Preview"
                      className="ct-clarity-mockup-img"
                    />
                  </div>
                </div>
              </div>

              {/* ---------------- FEATURE 02 ---------------- */}
              <div className="ct-clarity-row ct-clarity-row-2">
                {/* Left: Cashflow Dark Card */}
                <div className="ct-clarity-visual-col">
                  <div className="ct-cashflow-card">
                    {/* Top Stats */}
                    <div className="ct-cashflow-top">
                      <div className="ct-cf-top-left">
                        <span className="cf-metric-label">TOTAL RENTAL RETURN</span>
                        <div className="cf-val-group">
                          <span className="cf-main-val">$214,000</span>
                          <span className="cf-pill-badge">+5.2% vs ly</span>
                        </div>
                      </div>
                      <div className="ct-cf-top-right">
                        <span className="cf-metric-label">AVERAGE NET YIELD</span>
                        <span className="cf-yield-val">4.8%</span>
                      </div>
                    </div>

                    {/* 3 Sub-Cards Row */}
                    <div className="ct-cashflow-subcards">
                      <div className="ct-cf-subcard">
                        <span className="cf-sub-label">Gross Monthly Rent</span>
                        <span className="cf-sub-val">$17,833</span>
                        <div className="cf-sub-bar orange-bar" />
                      </div>
                      <div className="ct-cf-subcard">
                        <span className="cf-sub-label">Operating Expenses</span>
                        <span className="cf-sub-val">$5,200 <span className="period">/mo</span></span>
                        <div className="cf-sub-bar gray-bar" />
                      </div>
                      <div className="ct-cf-subcard">
                        <span className="cf-sub-label">Pre-Tax CashFlow</span>
                        <span className="cf-sub-val highlight-val">+$3,183 <span className="period">/mo</span></span>
                        <div className="cf-sub-bar orange-bar" />
                      </div>
                    </div>

                    {/* Footer Row */}
                    <div className="ct-cashflow-footer">
                      <span className="cf-updated-text">Updated with latest tenant disbursements</span>
                      <Link
                        href="#metrics"
                        className="cf-tax-link"
                        onClick={(e) => scrollToSection(e, "#metrics")}
                      >
                        Download Tax Summary →
                      </Link>
                    </div>
                  </div>
                </div>

                {/* Right: Text Content */}
                <div className="ct-clarity-text-col">
                  <span className="ct-feature-tag">FEATURE 02</span>
                  <h3 className="ct-clarity-row-title">Clear performance at a glance</h3>
                  <p className="ct-clarity-row-desc">
                    See income, expenses and profit and loss for every property, updated in one view, without doing the maths yourself. Understand exact gross vs net yield across each dwelling.
                  </p>
                  {/* Callout Box */}
                  <div className="ct-clarity-callout-card">
                    <div className="ct-callout-icon">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10" />
                        <line x1="12" y1="16" x2="12" y2="12" />
                        <line x1="12" y1="8" x2="12.01" y2="8" />
                      </svg>
                    </div>
                    <div className="ct-callout-content">
                      <h4 className="ct-callout-title">Tax Deductible Categorisation</h4>
                      <p className="ct-callout-desc">Automated ATO categories for council, water, interest, and management fees.</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* ---------------- FEATURE 03 ---------------- */}
              <div className="ct-clarity-row ct-clarity-row-3">
                {/* Left: Text Content */}
                <div className="ct-clarity-text-col">
                  <span className="ct-feature-tag">FEATURE 03</span>
                  <h3 className="ct-clarity-row-title">Never miss a date</h3>
                  <p className="ct-clarity-row-desc">
                    Get reminders ahead of insurance renewals, lease reviews and other key dates, so nothing catches you off guard or leaves money on the table.
                  </p>
                  <div className="ct-clarity-footer-note">
                    Integrated proactive compliance engine
                  </div>
                </div>

                {/* Right: Upcoming Calendar Deadlines Card */}
                <div className="ct-clarity-visual-col">
                  <div className="ct-deadlines-card">
                    {/* Card Header */}
                    <div className="ct-card-top-header">
                      <span className="ct-header-badge-title">UPCOMING CALENDAR DEADLINES</span>
                      <span className="ct-actions-pending-badge">2 Actions Pending</span>
                    </div>

                    {/* Deadlines List */}
                    <div className="ct-deadlines-list">
                      {/* Item 1 (Highlighted) */}
                      <div className="ct-deadline-item highlighted">
                        <div className="deadline-dot-title">
                          <span className="deadline-dot orange" />
                          <div className="deadline-texts">
                            <h4 className="deadline-title">Upcoming Lease Review</h4>
                            <span className="deadline-sub">14 Victoria St, Paddington NSW 2021</span>
                          </div>
                        </div>
                        <span className="deadline-due-badge">Due in 21 days</span>
                      </div>

                      {/* Item 2 */}
                      <div className="ct-deadline-item">
                        <div className="deadline-dot-title">
                          <span className="deadline-dot slate" />
                          <div className="deadline-texts">
                            <h4 className="deadline-title">Landlord Insurance Renewal</h4>
                            <span className="deadline-sub">88 Marine Pde, Cottesloe WA 6011</span>
                          </div>
                        </div>
                        <span className="deadline-date-badge">Oct 15</span>
                      </div>

                      {/* Item 3 */}
                      <div className="ct-deadline-item">
                        <div className="deadline-dot-title">
                          <span className="deadline-dot slate" />
                          <div className="deadline-texts">
                            <h4 className="deadline-title">Fixed Rate Mortgage Rollover</h4>
                            <span className="deadline-sub">Loan Acct ••4821 (CBA - 2.19% exp.)</span>
                          </div>
                        </div>
                        <span className="deadline-date-badge">Nov 28</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* ---------------- FEATURE 04 ---------------- */}
              <div className="ct-clarity-row ct-clarity-row-4">
                {/* Left: Document Vault Card */}
                <div className="ct-clarity-visual-col">
                  <div className="ct-vault-card">
                    {/* Card Header */}
                    <div className="ct-card-top-header">
                      <span className="ct-header-badge-title">DOCUMENT VAULT & TENANCY RECORDS</span>
                      <span className="ct-storage-badge">Encrypted Cloud Storage</span>
                    </div>

                    {/* Documents Grid */}
                    <div className="ct-vault-grid">
                      <div className="ct-vault-chip">
                        <svg className="doc-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                          <polyline points="14 2 14 8 20 8" />
                        </svg>
                        <span className="doc-name">Lease_Paddington.pdf</span>
                      </div>

                      <div className="ct-vault-chip">
                        <svg className="doc-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                          <polyline points="14 2 14 8 20 8" />
                        </svg>
                        <span className="doc-name">Depreciation_2024.pdf</span>
                      </div>

                      <div className="ct-vault-chip">
                        <svg className="doc-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                          <polyline points="14 2 14 8 20 8" />
                        </svg>
                        <span className="doc-name">Valuation_Report.pdf</span>
                      </div>

                      <div className="ct-vault-chip">
                        <svg className="doc-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                          <polyline points="14 2 14 8 20 8" />
                        </svg>
                        <span className="doc-name">Strata_Minutes.pdf</span>
                      </div>

                      <div className="ct-vault-chip">
                        <svg className="doc-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                          <polyline points="14 2 14 8 20 8" />
                        </svg>
                        <span className="doc-name">Insurance_WA.pdf</span>
                      </div>

                      <div className="ct-vault-chip upload-chip">
                        <span>+ Upload New</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right: Text Content */}
                <div className="ct-clarity-text-col">
                  <span className="ct-feature-tag">FEATURE 04</span>
                  <h3 className="ct-clarity-row-title">Everything in one place</h3>
                  <p className="ct-clarity-row-desc">
                    ClearPortfolio brings your property records into a single, secure dashboard, so nothing is scattered across emails and folders again. Ready at tax time for instant sharing with your accountant.
                  </p>
                  <div className="ct-clarity-footer-note uppercase">
                    BACKED BY CLEARTAX INFRASTRUCTURE
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ================= MOBILE LAYOUT (<= 900px) ================= */}
          <div className="ct-clarity-mobile">
            {/* Mobile Section Header */}
            <div className="ct-mobile-clarity-header">
              <div className="ct-clarity-badge">
                <span className="ct-badge-dot" />
                <span>FEATURE BREAKDOWN</span>
              </div>
              <h2 className="ct-mobile-clarity-title">
                Everything you need to see the<br />bigger picture.
              </h2>
            </div>

            {/* Mobile Stacked 4 Cards */}
            <div className="ct-mobile-cards-list">
              {/* CARD 01: Consolidated Portfolio View */}
              <div className="ct-mcard ct-mcard-white">
                <span className="ct-mcard-tag-pill">Dashboard</span>
                <h3 className="ct-mcard-title">Consolidated Portfolio View</h3>
                <p className="ct-mcard-desc">
                  Real-time equity valuation across Paddington, Cottesloe and London properties.
                </p>
                <div className="ct-mcard-img-wrap">
                  <img
                    src="/Image1.png"
                    alt="Consolidated Portfolio View"
                    className="ct-mcard-img"
                  />
                </div>
              </div>

              {/* CARD 02: Financial Performance (Theme Blue #28336e) */}
              <div className="ct-mcard ct-mcard-blue">
                {/* Header Row */}
                <div className="ct-mcard-blue-header">
                  <span className="ct-mcard-perf-badge">FINANCIAL PERFORMANCE</span>
                  <span className="ct-mcard-year-badge">FY 2024–25</span>
                </div>

                {/* 2 Stat Boxes */}
                <div className="ct-mcard-stats-grid">
                  <div className="ct-mstat-box">
                    <span className="ct-mstat-label">Total Rental Return</span>
                    <span className="ct-mstat-val-orange">$214,000</span>
                    <span className="ct-mstat-trend-green">↑ +3.52% YoY</span>
                  </div>
                  <div className="ct-mstat-box">
                    <span className="ct-mstat-label">Average Net Yield</span>
                    <span className="ct-mstat-val-white">4.8%</span>
                    <span className="ct-mstat-sub-orange">Benchmark 4.2%</span>
                  </div>
                </div>

                {/* Monthly Inflow Breakdown */}
                <div className="ct-mcard-inflow-section">
                  <div className="ct-minflow-header">
                    <span className="ct-minflow-title">Monthly Inflow Breakdown</span>
                    <span className="ct-minflow-avg">$17,833 / mo avg</span>
                  </div>
                  {/* Multi-segment Progress Bar */}
                  <div className="ct-minflow-bar">
                    <span className="bar-segment seg-residential" style={{ width: "68%" }} />
                    <span className="bar-segment seg-commercial" style={{ width: "22%" }} />
                    <span className="bar-segment seg-sundry" style={{ width: "10%" }} />
                  </div>
                  {/* Legend */}
                  <div className="ct-minflow-legend">
                    <div className="legend-item">
                      <span className="legend-dot dot-residential" />
                      <span>Residential</span>
                    </div>
                    <div className="legend-item">
                      <span className="legend-dot dot-commercial" />
                      <span>Commercial</span>
                    </div>
                    <div className="legend-item">
                      <span className="legend-dot dot-sundry" />
                      <span>Sundry</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* CARD 03: Critical Milestones & Actions */}
              <div className="ct-mcard ct-mcard-white">
                <div className="ct-mcard-header-flex">
                  <h3 className="ct-mcard-title ct-no-margin">Critical Milestones & Actions</h3>
                  <span className="ct-mcard-action-badge">Action Required</span>
                </div>

                <div className="ct-mdeadlines-list">
                  {/* Item 1 */}
                  <div className="ct-mdeadline-row">
                    <div className="ct-mdeadline-info">
                      <span className="mdeadline-dot orange" />
                      <div className="mdeadline-texts">
                        <h4 className="mdeadline-title">14 Victoria St, Paddington</h4>
                        <span className="mdeadline-sub">Residential Lease Expiry</span>
                      </div>
                    </div>
                    <span className="mdeadline-badge-orange">In 18 days</span>
                  </div>

                  {/* Item 2 */}
                  <div className="ct-mdeadline-row">
                    <div className="ct-mdeadline-info">
                      <span className="mdeadline-dot navy" />
                      <div className="mdeadline-texts">
                        <h4 className="mdeadline-title">88 Marine Pde, Cottesloe</h4>
                        <span className="mdeadline-sub">Fixed Rate Expiry (2.19%)</span>
                      </div>
                    </div>
                    <span className="mdeadline-badge-neutral">In 42 days</span>
                  </div>
                </div>
              </div>

              {/* CARD 04: Encrypted Property Document Vault */}
              <div className="ct-mcard ct-mcard-white">
                <h3 className="ct-mcard-title">Encrypted Property Document Vault</h3>
                <p className="ct-mcard-desc">
                  Instant 1-tap download of tax-deductible schedules.
                </p>

                <div className="ct-mdocs-list">
                  <div className="ct-mdoc-item">
                    <svg className="mdoc-icon orange" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                    </svg>
                    <span className="mdoc-name">Lease Agreements (4)</span>
                  </div>

                  <div className="ct-mdoc-item highlighted-doc">
                    <svg className="mdoc-icon amber" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                    </svg>
                    <span className="mdoc-name">BMT Depreciation (3)</span>
                  </div>

                  <div className="ct-mdoc-item">
                    <svg className="mdoc-icon green" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                    </svg>
                    <span className="mdoc-name">Bank Valuations (5)</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ================= SECTION 5: LIVE METRICS DEMONSTRATION / AUTOMATED INTELLIGENCE ================= */}
      <section id="metrics" className="ct-metrics-demo-section">
        <div className="ct-metrics-demo-container">
          {/* Section Header */}
          <div className="ct-metrics-demo-header">
            {/* Tag / Badge Pill */}
            <div className="ct-metrics-demo-badge">
              <span className="ct-demo-badge-dot" />
              <span className="ct-demo-badge-text-desktop">LIVE METRICS DEMONSTRATION</span>
              <span className="ct-demo-badge-text-mobile">AUTOMATED INTELLIGENCE</span>
            </div>

            {/* Main Title */}
            <h2 className="ct-metrics-demo-title">
              See the numbers without doing the maths.
            </h2>

            {/* Subtitle */}
            <p className="ct-metrics-demo-subtitle">
              <span className="ct-demo-sub-desktop">
                Income, expenses, loans and property performance — brought together in one clear view.
              </span>
              <span className="ct-demo-sub-mobile">
                Continuous auto-reconciliation across your loan balances, interest rates, capital gains, and real cash positions.
              </span>
            </p>
          </div>

          {/* Metric Cards 6-Card Grid */}
          <div className="ct-metrics-cards-grid">
            {/* Card 1: Net Equity */}
            <div className="ct-metric-card ct-metric-card-accent">
              <span className="ct-metric-card-label">NET EQUITY</span>
              <div className="ct-metric-card-val-group">
                <span className="ct-metric-val ct-val-gold val-desktop">$2,920,000</span>
                <span className="ct-metric-val val-mobile">$2.92M</span>
              </div>
              <div className="ct-metric-sub">
                <span className="sub-desktop ct-trend-positive">↑ +4.2%</span>
                <span className="sub-mobile ct-ratio-gold">60.2% Net Ratio</span>
              </div>
            </div>

            {/* Card 2: Market Value */}
            <div className="ct-metric-card">
              <span className="ct-metric-card-label">MARKET VALUE</span>
              <div className="ct-metric-card-val-group">
                <span className="ct-metric-val val-desktop">$4,850,000</span>
                <span className="ct-metric-val ct-val-gold val-mobile">$4.85M</span>
              </div>
              <div className="ct-metric-sub">
                <span className="sub-desktop ct-sub-muted">5 Properties</span>
                <span className="sub-mobile ct-sub-emerald">CoreLogic Verified</span>
              </div>
            </div>

            {/* Card 3: Total Loans */}
            <div className="ct-metric-card">
              <span className="ct-metric-card-label">TOTAL LOANS</span>
              <div className="ct-metric-card-val-group">
                <span className="ct-metric-val val-desktop">$1,930,000</span>
                <span className="ct-metric-val val-mobile">$1.93M</span>
              </div>
              <div className="ct-metric-sub">
                <span className="sub-desktop ct-sub-muted">Avg LVR: 58%</span>
                <span className="sub-mobile ct-sub-muted">Avg Rate 5.84%</span>
              </div>
            </div>

            {/* Card 4: Rental Income */}
            <div className="ct-metric-card ct-metric-card-accent">
              <span className="ct-metric-card-label">RENTAL INCOME</span>
              <div className="ct-metric-card-val-group">
                <span className="ct-metric-val val-desktop">$214,000</span>
                <span className="ct-metric-val val-mobile">$214k</span>
              </div>
              <div className="ct-metric-sub">
                <span className="sub-desktop ct-sub-gold">Per annum</span>
                <span className="sub-mobile ct-sub-gold">Annualised</span>
              </div>
            </div>

            {/* Card 5: Total Expenses */}
            <div className="ct-metric-card">
              <span className="ct-metric-card-label">TOTAL EXPENSES</span>
              <div className="ct-metric-card-val-group">
                <span className="ct-metric-val val-desktop">$62,400</span>
                <span className="ct-metric-val val-mobile">$62.4k</span>
              </div>
              <div className="ct-metric-sub">
                <span className="sub-desktop ct-sub-muted">Interest &amp; ops</span>
                <span className="sub-mobile ct-sub-muted">Strata &amp; Council</span>
              </div>
            </div>

            {/* Card 6: Net Cash Flow */}
            <div className="ct-metric-card">
              <span className="ct-metric-card-label">NET CASH FLOW</span>
              <div className="ct-metric-card-val-group">
                <span className="ct-metric-val ct-val-gold val-desktop">+$38,200</span>
                <span className="ct-metric-val ct-val-gold val-mobile">+$38.2k</span>
              </div>
              <div className="ct-metric-sub">
                <span className="sub-desktop ct-sub-gold">Positive</span>
                <span className="sub-mobile ct-sub-muted">After all debt service</span>
              </div>
            </div>
          </div>

          {/* Desktop Dashboard Mockup Window Frame (Desktop Only) */}
          <div className="ct-demo-window-frame desktop-only">
            {/* Desktop Top Bar */}
            <div className="ct-demo-window-topbar">
              <div className="ct-demo-window-title-left">
                <span className="ct-demo-pulse-dot" />
                <span className="ct-demo-mono-title">Portfolio Data Engine — Synced Daily</span>
              </div>
              <div className="ct-demo-status-pill">
                <span>Live Session Active</span>
              </div>
            </div>

            {/* Window Content: Dashboard Image */}
            <div className="ct-demo-window-content">
              <img
                src="/Image1.png"
                alt="ClearPortfolio Live Dashboard - Real-time metrics and portfolio tracking"
                className="ct-demo-dashboard-img"
              />
            </div>
          </div>

          {/* Mobile Live Session Bar (Mobile Only) */}
          <div className="ct-demo-mobile-bar mobile-only">
            <div className="ct-demo-mobile-status">
              <span className="ct-demo-pulse-dot" />
              <span>Live Session Active</span>
            </div>
            <div className="ct-demo-mobile-sync-pill">
              <span>Sync: CoreLogic &amp; CBA</span>
            </div>
          </div>
        </div>
      </section>

      {/* ================= SECTION 6: INVESTOR PERSPECTIVES (TESTIMONIALS) ================= */}
      <section id="testimonials" className="ct-testimonials-section">
        <div className="ct-testimonials-container">
          {/* Section Header */}
          <div className="ct-testimonials-header">
            {/* Pill Badge */}
            <div className="ct-badge-pill ct-testimonials-pill">
              <span className="ct-badge-dot" />
              <span>INVESTOR PERSPECTIVES</span>
            </div>

            {/* Main Title */}
            <h2 className="ct-testimonials-title">
              Built for <span className="highlight-orange">serious property investors</span>.
            </h2>

            {/* Subtitle */}
            <p className="ct-testimonials-subtitle">
              <span className="desktop-desc">
                How private landlords, syndicates, and multi-property owners manage their portfolios with confidence.
              </span>
              <span className="mobile-desc">
                How multi-property owners track wealth and cash flow with confidence.
              </span>
            </p>
          </div>

          {/* Testimonial Cards Grid */}
          <div className="ct-testimonials-grid">
            {/* Card 1: Marcus Vance */}
            <div className="ct-testimonial-card">
              <div className="ct-testimonial-top">
                <div className="ct-stars-group">
                  {[...Array(5)].map((_, i) => (
                    <svg key={i} className="ct-star-icon" width="16" height="16" viewBox="0 0 24 24" fill="#f59e0b" stroke="#f59e0b" strokeWidth="1.5">
                      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                    </svg>
                  ))}
                </div>
                <span className="ct-verified-badge">Verified Investor</span>
              </div>

              <blockquote className="ct-testimonial-quote">
                <span className="desktop-quote">
                  “Before ClearPortfolio, every quarter was an agonizing scramble across five bank portals and accountant spreadsheets. Now my entire portfolio equity and cash flow are live and indisputable.”
                </span>
                <span className="mobile-quote">
                  “Before ClearPortfolio, every quarter was an agonizing scramble across bank portals and spreadsheets. Now my entire equity and cash flow are live and indisputable.”
                </span>
              </blockquote>

              <div className="ct-testimonial-author">
                <div className="ct-author-avatar">
                  <span>MV</span>
                </div>
                <div className="ct-author-details">
                  <h4 className="ct-author-name">Marcus Vance</h4>
                  <p className="ct-author-meta">
                    <span className="desktop-meta">Multi-property Investor (6 Properties)</span>
                    <span className="mobile-meta">6 Properties, Melbourne</span>
                  </p>
                </div>
              </div>
            </div>

            {/* Card 2: Sarah Chen */}
            <div className="ct-testimonial-card">
              <div className="ct-testimonial-top">
                <div className="ct-stars-group">
                  {[...Array(5)].map((_, i) => (
                    <svg key={i} className="ct-star-icon" width="16" height="16" viewBox="0 0 24 24" fill="#f59e0b" stroke="#f59e0b" strokeWidth="1.5">
                      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                    </svg>
                  ))}
                </div>
                <span className="ct-verified-badge">Verified Investor</span>
              </div>

              <blockquote className="ct-testimonial-quote">
                <span className="desktop-quote">
                  “The automated lease review and rate expiration alerts alone saved us over $14,000 in unindexed rents last financial year. It's the most high-signal wealth tool we use.”
                </span>
                <span className="mobile-quote">
                  “The automated lease review alerts saved us over $14,000 in unindexed rents last financial year. It's the most high-signal tool we use.”
                </span>
              </blockquote>

              <div className="ct-testimonial-author">
                <div className="ct-author-avatar">
                  <span>SC</span>
                </div>
                <div className="ct-author-details">
                  <h4 className="ct-author-name">Sarah Chen</h4>
                  <p className="ct-author-meta">
                    <span className="desktop-meta">Commercial &amp; Residential Portfolio</span>
                    <span className="mobile-meta">Sydney</span>
                  </p>
                </div>
              </div>
            </div>

            {/* Card 3: David O'Reilly */}
            <div className="ct-testimonial-card">
              <div className="ct-testimonial-top">
                <div className="ct-stars-group">
                  {[...Array(5)].map((_, i) => (
                    <svg key={i} className="ct-star-icon" width="16" height="16" viewBox="0 0 24 24" fill="#f59e0b" stroke="#f59e0b" strokeWidth="1.5">
                      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                    </svg>
                  ))}
                </div>
                <span className="ct-verified-badge">Verified Investor</span>
              </div>

              <blockquote className="ct-testimonial-quote">
                <span className="desktop-quote">
                  “Having bank-ready LVR and tax dossiers generated with one click made our last refinance cycle effortless. My mortgage broker and CPA were genuinely stunned.”
                </span>
                <span className="mobile-quote">
                  “Having bank-ready LVR and tax dossiers ready in one click made our refinance effortless. My broker and CPA were stunned.”
                </span>
              </blockquote>

              <div className="ct-testimonial-author">
                <div className="ct-author-avatar">
                  <span>DO</span>
                </div>
                <div className="ct-author-details">
                  <h4 className="ct-author-name">David O’Reilly</h4>
                  <p className="ct-author-meta">
                    <span className="desktop-meta">SMSF Property Investor (Brisbane)</span>
                    <span className="mobile-meta">SMSF Investor, Brisbane</span>
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ================= SECTION 7: FREQUENTLY ASKED QUESTIONS ================= */}
      <section id="faqs" className="ct-faqs-section">
        <div className="ct-faqs-container">
          {/* Section Header */}
          <div className="ct-faqs-header">
            {/* Pill Badge */}
            <div className="ct-badge-pill ct-faqs-pill">
              <span className="ct-badge-dot" />
              <span className="desktop-tag">FREQUENTLY ASKED QUESTIONS</span>
              <span className="mobile-tag">GOT QUESTIONS?</span>
            </div>

            {/* Main Title */}
            <h2 className="ct-faqs-title">
              <span className="desktop-title">
                Questions, <span className="highlight-orange">answered</span>.
              </span>
              <span className="mobile-title">
                Frequently Asked Questions
              </span>
            </h2>

            {/* Subtitle */}
            <p className="ct-faqs-subtitle">
              Everything you need to know about getting started with ClearPortfolio.
            </p>
          </div>

          {/* FAQ Accordion List */}
          <div className="ct-faqs-accordion">
            {faqs.map((faq, index) => {
              const isOpen = openFaq === index;
              return (
                <div
                  key={index}
                  className={`ct-faq-item ${isOpen ? "open" : ""}`}
                >
                  <button
                    type="button"
                    className="ct-faq-question-btn"
                    onClick={() => setOpenFaq(isOpen ? null : index)}
                    aria-expanded={isOpen}
                    aria-controls={`faq-answer-${index}`}
                  >
                    <span className="ct-faq-q-text">
                      <span className="desktop-q">{faq.question}</span>
                      <span className="mobile-q">{faq.mobileQuestion || faq.question}</span>
                    </span>
                    <span className="ct-faq-icon-wrapper" aria-hidden="true">
                      <svg
                        className="ct-faq-plus-icon"
                        width="18"
                        height="18"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="#f59e0b"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <line x1="12" y1="5" x2="12" y2="19" />
                        <line x1="5" y1="12" x2="19" y2="12" />
                      </svg>
                    </span>
                  </button>
                  <div
                    id={`faq-answer-${index}`}
                    className="ct-faq-answer-collapse"
                  >
                    <div className="ct-faq-answer-inner">
                      <p className="ct-faq-answer-text">{faq.answer}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ================= SECTION 8: CONTACT / LET'S TALK ================= */}
      <section id="contact" className="ct-contact-section">
        <div className="ct-contact-container">
          {/* Card container on mobile, centered content on desktop */}
          <div className="ct-contact-card">
            {/* Pill Badge */}
            <div className="ct-badge-pill ct-contact-pill">
              <span className="ct-badge-dot desktop-only-inline" />
              <span className="desktop-contact-tag">SPEAK WITH US</span>
              <span className="mobile-contact-tag">START IN 2 MINUTES</span>
            </div>

            {/* Main Heading */}
            <h2 className="ct-contact-title">
              Have questions about ClearPortfolio?{" "}
              <span className="highlight-orange">Let’s talk.</span>
            </h2>

            {/* Subtitle */}
            <p className="ct-contact-subtitle">
              <span className="desktop-contact-desc">
                Speak directly with our product team to see how ClearPortfolio can bring complete visibility to your property investments.
              </span>
              <span className="mobile-contact-desc">
                Get in touch with our Australian property specialist team for a guided portfolio setup or data import walkthrough.
              </span>
            </p>

            {/* CTA Button */}
            <div className="ct-contact-cta-wrapper">
              <Link href="mailto:contact@clearportfolio.com.au" className="ct-btn-contact">
                {/* Desktop Envelope Icon */}
                <svg className="desktop-btn-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                  <polyline points="22,6 12,13 2,6" />
                </svg>
                <span>Get in touch</span>
                {/* Mobile Right Arrow Icon */}
                <svg className="mobile-btn-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="5" y1="12" x2="19" y2="12" />
                  <polyline points="12 5 19 12 12 19" />
                </svg>
              </Link>
            </div>

            {/* Direct Email note */}
            <div className="ct-contact-email-note">
              <span className="desktop-email-prefix">Direct email: </span>
              <span className="mobile-email-prefix">Or email us directly at </span>
              <a href="mailto:contact@clearportfolio.com.au" className="ct-contact-email-link">
                contact@clearportfolio.com.au
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ================= FOOTER COMPONENT ================= */}
      <LandingPageFooter />
    </div>
  );
}

