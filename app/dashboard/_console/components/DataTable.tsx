"use client";

import { useMemo, useState, type ReactNode } from "react";
import { SortIcon } from "./icons";
import { Skeleton, cx } from "./ui";

export type Column<T> = {
  id: string;
  header: string;
  cell: (row: T) => ReactNode;
  /** Return a value to make the column sortable. */
  sortValue?: (row: T) => string | number;
  align?: "right";
  wrap?: boolean;
  width?: string;
};

type SortState = { id: string; direction: "asc" | "desc" } | null;

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  loading,
  empty,
  pageSize = 15,
  initialSort = null,
  selectable,
  selected,
  onSelectedChange,
  footer,
  caption,
}: {
  columns: Column<T>[];
  rows: readonly T[];
  rowKey: (row: T) => string;
  loading?: boolean;
  empty?: ReactNode;
  pageSize?: number;
  initialSort?: SortState;
  selectable?: boolean;
  selected?: Set<string>;
  onSelectedChange?: (next: Set<string>) => void;
  footer?: ReactNode;
  caption: string;
}) {
  const [sort, setSort] = useState<SortState>(initialSort);
  const [page, setPage] = useState(1);

  const sorted = useMemo(() => {
    if (!sort) return rows;
    const column = columns.find((item) => item.id === sort.id);
    if (!column?.sortValue) return rows;
    const factor = sort.direction === "asc" ? 1 : -1;
    return [...rows].sort((a, b) => {
      const left = column.sortValue!(a);
      const right = column.sortValue!(b);
      if (typeof left === "number" && typeof right === "number") return (left - right) * factor;
      return String(left).localeCompare(String(right)) * factor;
    });
  }, [rows, sort, columns]);

  const pageCount = Math.max(1, Math.ceil(sorted.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const visible = sorted.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  function toggleSort(id: string) {
    setSort((current) =>
      current?.id === id ? { id, direction: current.direction === "asc" ? "desc" : "asc" } : { id, direction: "desc" },
    );
  }

  const allVisibleSelected = selectable && visible.length > 0 && visible.every((row) => selected?.has(rowKey(row)));

  function toggleAll() {
    if (!onSelectedChange) return;
    const next = new Set(selected);
    for (const row of visible) {
      if (allVisibleSelected) next.delete(rowKey(row));
      else next.add(rowKey(row));
    }
    onSelectedChange(next);
  }

  function toggleRow(key: string) {
    if (!onSelectedChange) return;
    const next = new Set(selected);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    onSelectedChange(next);
  }

  return (
    <>
      <div className="cpc-table-wrap">
        <table className="cpc-table">
          <caption className="sr-only">{caption}</caption>
          <thead>
            <tr>
              {selectable ? (
                <th style={{ width: "2.6em" }}>
                  <input
                    type="checkbox"
                    className="cpc-check"
                    aria-label="Select all rows on this page"
                    checked={Boolean(allVisibleSelected)}
                    onChange={toggleAll}
                  />
                </th>
              ) : null}
              {columns.map((column) => (
                <th
                  key={column.id}
                  className={cx(column.align === "right" && "is-right")}
                  style={{ width: column.width }}
                  aria-sort={sort?.id === column.id ? (sort.direction === "asc" ? "ascending" : "descending") : undefined}
                >
                  {column.sortValue ? (
                    <button type="button" className="cpc-th-button" onClick={() => toggleSort(column.id)}>
                      {column.header}
                      <SortIcon sortDirection={sort?.id === column.id ? sort.direction : null} />
                    </button>
                  ) : (
                    column.header
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading
              ? Array.from({ length: 6 }).map((_, index) => (
                  <tr key={`skeleton-${index}`}>
                    {selectable ? <td /> : null}
                    {columns.map((column) => (
                      <td key={column.id}>
                        <Skeleton width={column.align === "right" ? "3em" : "70%"} />
                      </td>
                    ))}
                  </tr>
                ))
              : visible.map((row) => {
                  const key = rowKey(row);
                  const isSelected = Boolean(selected?.has(key));
                  return (
                    <tr key={key} className={cx(isSelected && "is-selected")}>
                      {selectable ? (
                        <td>
                          <input
                            type="checkbox"
                            aria-label="Select row"
                            checked={isSelected}
                            onChange={() => toggleRow(key)}
                          />
                        </td>
                      ) : null}
                      {columns.map((column) => (
                        <td key={column.id} className={cx(column.align === "right" && "is-right cpc-num", column.wrap && "is-wrap")}>
                          {column.cell(row)}
                        </td>
                      ))}
                    </tr>
                  );
                })}
          </tbody>
        </table>
      </div>
      {!loading && sorted.length === 0 ? empty : null}
      {!loading && (sorted.length > pageSize || footer) ? (
        <div className="cpc-table-foot">
          <span>
            {sorted.length > pageSize
              ? `Showing ${(currentPage - 1) * pageSize + 1}–${Math.min(currentPage * pageSize, sorted.length)} of ${sorted.length}`
              : footer}
          </span>
          {sorted.length > pageSize ? (
            <div className="cpc-pager">
              <button
                type="button"
                className="cpc-btn cpc-btn-sm"
                disabled={currentPage === 1}
                onClick={() => setPage(currentPage - 1)}
              >
                Previous
              </button>
              <span className="cpc-small cpc-num">
                {currentPage} / {pageCount}
              </span>
              <button
                type="button"
                className="cpc-btn cpc-btn-sm"
                disabled={currentPage === pageCount}
                onClick={() => setPage(currentPage + 1)}
              >
                Next
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
    </>
  );
}
