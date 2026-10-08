"use client";

import React, { useState } from "react";
import Link from "next/link";

// ============================================================================
// Types & Interfaces
// ============================================================================

interface SettingsSection {
  id: string;
  label: string;
  count: number;
  isActive?: boolean;
}

interface CategoryItem {
  id: string;
  name: string;
  detailText: string;
  colorClass: string;
}

const DEFAULT_SECTIONS: SettingsSection[] = [
  { id: "categories", label: "Transaction categories", count: 8, isActive: true },
  { id: "sub-categories", label: "Sub-categories", count: 24 },
  { id: "modes", label: "Modes of transaction", count: 5 },
  { id: "property-types", label: "Property types", count: 4 },
  { id: "property-statuses", label: "Property statuses", count: 7 },
  { id: "entity-types", label: "Entity types", count: 5 },
  { id: "document-types", label: "Document types", count: 6 },
  { id: "classification-rules", label: "Auto-classification rules", count: 142 },
];

const DEFAULT_CATEGORIES: CategoryItem[] = [
  { id: "rental-income", name: "Rental income", detailText: "1,842 transactions · 3 sub-categories", colorClass: "bg-[#0f766e]" },
  { id: "other-income", name: "Other income", detailText: "214 transactions · 2 sub-categories", colorClass: "bg-[#2563eb]" },
  { id: "maintenance", name: "Maintenance", detailText: "684 transactions · 6 sub-categories", colorClass: "bg-[#b45309]" },
  { id: "interest-loan", name: "Interest / loan repayments", detailText: "512 transactions · 2 sub-categories", colorClass: "bg-[#dc2626]" },
  { id: "mgmt-fees", name: "Management fees", detailText: "312 transactions · 1 sub-category", colorClass: "bg-[#7c3aed]" },
  { id: "insurance", name: "Insurance", detailText: "96 transactions · 1 sub-category", colorClass: "bg-[#0f766e]" },
  { id: "other-expenses", name: "Other expenses", detailText: "187 transactions · 3 sub-categories", colorClass: "bg-[#6b7280]" },
  { id: "land-tax", name: "Land tax", detailText: "0 transactions · added Jun 7, 2026", colorClass: "bg-[#b45309]" },
];

const PALETTE_COLORS = [
  { class: "bg-[#0f766e]", label: "Teal" },
  { class: "bg-[#2563eb]", label: "Blue" },
  { class: "bg-[#b45309]", label: "Brown" },
  { class: "bg-[#dc2626]", label: "Red" },
  { class: "bg-[#7c3aed]", label: "Purple" },
  { class: "bg-[#6b7280]", label: "Grey" },
];

// ============================================================================
// Main Component
// ============================================================================

export default function DataSettingsPage() {
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Dynamic State Hooks
  const [sections, setSections] = useState<SettingsSection[]>(DEFAULT_SECTIONS);
  const [categories, setCategories] = useState<CategoryItem[]>(DEFAULT_CATEGORIES);

  // Form State Hooks
  const [newCategoryName, setNewCategoryName] = useState("");
  const [selectedColorClass, setSelectedColorClass] = useState("bg-[#0f766e]");

  // Trigger Toast Notification Helper
  const showToast = (message: string) => {
    setToastMessage(message);
    setTimeout(() => {
      setToastMessage(null);
    }, 3000);
  };

  // Handle Add Category
  const handleAddCategory = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCategoryName.trim()) {
      showToast("Please enter a category name.");
      return;
    }

    showToast("Adding new category...");

    const localNewCategory: CategoryItem = {
      id: newCategoryName.trim().toLowerCase().replace(/\s+/g, "-"),
      name: newCategoryName.trim(),
      detailText: "0 transactions · added just now",
      colorClass: selectedColorClass,
    };

    setCategories((prev) => [...prev, localNewCategory]);
    setSections((prev) =>
      prev.map((sec) =>
        sec.id === "categories" ? { ...sec, count: sec.count + 1 } : sec
      )
    );

    setNewCategoryName("");
    showToast(`Category "${localNewCategory.name}" added successfully!`);
  };

  return (
    <div className="w-full max-w-[1280px] mx-auto px-6 py-6 transition-all duration-300 ease-in-out">

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-6 right-6 z-50 bg-[#0f172a] text-white text-xs font-medium px-4 py-3 rounded-xl shadow-lg flex items-center gap-2.5 animate-fadeIn">
          <svg className="animate-spin h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Page Header */}
      <div className="mb-8 select-none">
        <h1 className="text-[25px] font-medium text-[#0f172a] tracking-tight mb-1">Data settings</h1>
        <p className="text-[12.5px] text-[#64748b] font-normal leading-normal">
          Categories, types & labels
        </p>
      </div>

      {/* Info Alert Banner */}
      <div className="bg-[#eff6ff] border border-[#dbeafe] rounded-xl p-4 mb-6 shadow-sm flex items-start gap-3 select-none">
        <div className="text-[#2563eb] mt-0.5">
          <svg className="w-5 h-5 fill-none stroke-[2]" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <div>
          <h4 className="text-[13px] font-semibold text-[#1e40af] mb-0.5">Changes here apply organisation-wide</h4>
          <p className="text-[12.5px] text-[#1e40af]/85 font-normal leading-normal">
            Editing or removing an item used by existing transactions, properties, or entities won't delete historical data — it will be relabelled. Deleted items are logged in the audit trail.
          </p>
        </div>
      </div>

      {/* Two-Column Panel Container */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Left Card: Sections Navigation Menu (1/3 Width) */}
        <div className="bg-white border border-[#eaecf0] rounded-xl p-5 shadow-sm h-fit">
          <div className="space-y-1">
            {sections.map((sec) => (
              <div
                key={sec.id}
                className={`flex justify-between items-center h-10 px-3.5 rounded-lg text-[13px] font-medium transition cursor-pointer select-none ${sec.isActive
                  ? "bg-[#eff6ff] text-[#2563eb]"
                  : "text-[#475569] hover:bg-slate-50"
                  }`}
              >
                <span>{sec.label}</span>
                <span className={`text-[12.5px] font-normal ${sec.isActive ? "text-[#2563eb]" : "text-[#94a3b8]"}`}>
                  {sec.count}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Right Card: Category Breakdown Detail List (2/3 Width) */}
        <div className="lg:col-span-2 bg-white border border-[#eaecf0] rounded-xl p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-center mb-6 select-none">
              <h3 className="text-[15px] font-semibold text-[#0f172a]">Transaction categories</h3>
              <span className="text-xs text-[#94a3b8] font-normal">
                {categories.length} categories · used across 4,821 transactions
              </span>
            </div>

            {/* List of Category Items */}
            <div className="space-y-3">
              {categories.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center gap-3.5 h-12 px-4 bg-white border border-[#eaecf0] rounded-xl transition hover:border-slate-300"
                >
                  {/* Category Color Indicator Square */}
                  <div className={`w-3.5 h-3.5 rounded-[4px] ${item.colorClass} flex-shrink-0`} />

                  {/* Category Details */}
                  <div className="flex justify-between items-center flex-grow">
                    <span className="text-[13.5px] text-[#0f172a] font-medium">{item.name}</span>
                    <span className="text-[12.5px] text-[#64748b] font-normal">{item.detailText}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Add Category Form Container */}
          <div className="mt-8 pt-6 border-t border-slate-100">
            <form onSubmit={handleAddCategory} className="flex flex-col md:flex-row items-center gap-4">
              {/* Category Name Input */}
              <input
                type="text"
                placeholder="New category name..."
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                className="h-10 px-3.5 border border-slate-200 rounded-lg text-[13px] text-slate-800 focus:outline-none focus:border-blue-500 flex-grow w-full md:w-auto"
              />

              {/* Palette Color Pickers */}
              <div className="flex items-center gap-2.5">
                {PALETTE_COLORS.map((col) => (
                  <button
                    key={col.class}
                    type="button"
                    onClick={() => setSelectedColorClass(col.class)}
                    title={col.label}
                    className={`w-5 h-5 rounded-[4px] cursor-pointer transition select-none ${col.class} ${selectedColorClass === col.class
                      ? "ring-2 ring-blue-500 ring-offset-2 scale-110"
                      : "opacity-85 hover:opacity-100 hover:scale-105"
                      }`}
                  />
                ))}
              </div>

              {/* Add Button */}
              <button
                type="submit"
                className="h-10 px-6 bg-[#0f172a] hover:bg-slate-800 text-white font-medium text-[13px] rounded-lg transition cursor-pointer w-full md:w-auto select-none"
              >
                Add
              </button>
            </form>
          </div>
        </div>

      </div>

    </div>
  );
}
