"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { getSession } from "@/src/lib/session";
import { parseCsv } from "@/src/lib/csv";

interface SessionWithIdToken {
  getIdToken(): {
    getJwtToken(): string;
  };
}

interface BulkResult {
  row: number;
  email: string;
  role: string;
  success: boolean;
  temporaryPassword?: string;
  error?: string;
}

export default function SuperAdminBulkUploadPage() {
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [fileName, setFileName] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<BulkResult[]>([]);

  const hasRows = rows.length > 0;
  const template = useMemo(
    () =>
      [
        "organization,admin_email,full_name",
        "yexoria,admin1@example.com,Alex Morgan",
        "yexoria,admin2@example.com,Taylor Singh",
      ].join("\n"),
    [],
  );

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) {
      setRows([]);
      setFileName("");
      return;
    }

    const text = await file.text();
    setRows(parseCsv(text));
    setFileName(file.name);
    setResults([]);
  }

  async function handleUpload() {
    try {
      setLoading(true);
      const session = (await getSession()) as SessionWithIdToken | null;

      if (!session) {
        alert("Session expired. Please login again.");
        return;
      }

      const token = session.getIdToken().getJwtToken();
      const res = await fetch("/api/invite-user/bulk", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ rows }),
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data.error || "Bulk upload failed");
        return;
      }

      setResults(data.results || []);
    } catch (error) {
      console.error("Bulk upload error:", error);
      alert("Something went wrong during bulk upload.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="portal-page">
      <div className="portal-page-header">
        <div>
          <p className="portal-kicker">Bulk Upload</p>
          <h1>Bulk Invite Admins</h1>
          <p>
            Upload a CSV with organization and admin email to invite multiple
            admins at once.
          </p>
        </div>

        <Link href="/dashboard/super-admin" className="portal-secondary-link">
          Back to Dashboard
        </Link>
      </div>

      <div className="portal-list-card">
        <div className="portal-list-header">
          <div>
            <h2>CSV Format</h2>
            <p>
              Required columns: `organization`, `admin_email`. Optional:
              `full_name`.
            </p>
          </div>
          <span className="portal-list-count">{rows.length} rows</span>
        </div>

        <pre className="portal-code-block">{template}</pre>

        <div className="portal-upload-actions">
          <input type="file" accept=".csv" onChange={handleFileChange} />
          {fileName && (
            <span className="portal-upload-filename">{fileName}</span>
          )}
          <button
            type="button"
            className="portal-primary-link"
            onClick={handleUpload}
            disabled={loading || !hasRows}
          >
            {loading ? "Uploading..." : "Upload CSV"}
          </button>
        </div>
      </div>

      {hasRows && (
        <div className="portal-list-card">
          <div className="portal-list-header">
            <div>
              <h2>Preview</h2>
              <p>Review the parsed rows before sending invites.</p>
            </div>
          </div>

          <div className="portal-list-table">
            <div className="portal-list-head portal-list-head-admin">
              <div>Organization</div>
              <div>Email</div>
              <div>Name</div>
              <div>Role</div>
            </div>

            {rows.map((row, index) => (
              <article
                key={`${row.admin_email}-${index}`}
                className="portal-list-row portal-list-row-admin"
              >
                <div>
                  {row.organization ||
                    row.organization_id ||
                    row.org_name ||
                    "-"}
                </div>
                <div>{row.admin_email || row.email || "-"}</div>
                <div>{row.full_name || "-"}</div>
                <div>admin</div>
              </article>
            ))}
          </div>
        </div>
      )}

      {results.length > 0 && (
        <div className="portal-list-card">
          <div className="portal-list-header">
            <div>
              <h2>Results</h2>
              <p>Each row shows whether the invite succeeded.</p>
            </div>
          </div>

          <div className="portal-list-table">
            <div className="portal-list-head portal-list-head-admin">
              <div>Row</div>
              <div>Email</div>
              <div>Status</div>
              <div>Details</div>
            </div>

            {results.map((result) => (
              <article
                key={`${result.row}-${result.email}`}
                className="portal-list-row portal-list-row-admin"
              >
                <div>{result.row}</div>
                <div>{result.email}</div>
                <div>
                  <span
                    className={`portal-status${result.success ? "" : " is-pending"}`}
                  >
                    {result.success ? "SUCCESS" : "FAILED"}
                  </span>
                </div>
                <div>
                  {result.success
                    ? `Temp password: ${result.temporaryPassword}`
                    : result.error}
                </div>
              </article>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
