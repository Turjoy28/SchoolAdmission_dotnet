import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';
import type { MyHoldResponse } from '../api/types';
import { ErrorBanner } from '../components/ErrorBanner';

interface MyApplicationsPageProps {
  savedStudentId: string;
}

export const MyApplicationsPage: React.FC<MyApplicationsPageProps> = ({
  savedStudentId,
}) => {
  const [copied, setCopied] = useState(false);

  // Poll student applications every 5 seconds per PRD
  const { data: holds, isLoading, error, refetch, isFetching } = useQuery<MyHoldResponse[]>({
    queryKey: ['my-holds', savedStudentId],
    queryFn: () =>
      api<MyHoldResponse[]>('/me/holds', {
        studentId: savedStudentId,
      }),
    enabled: Boolean(savedStudentId && savedStudentId.length === 17),
    refetchInterval: 5000,
  });

  const handleCopyId = () => {
    if (savedStudentId) {
      navigator.clipboard.writeText(savedStudentId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (!savedStudentId || savedStudentId.length !== 17) {
    return (
      <div className="page-container">
        <div className="missing-id-card">
          <div className="missing-id-icon-box">
            <span className="material-symbols-outlined text-warning">warning</span>
          </div>
          <h2>Missing Student Verification Identifier</h2>
          <p>
            Please enter and save your 17-digit student Birth Registration Number (BRN) in the top bar to view your applications and hold history.
          </p>
          <button
            className="btn btn-primary"
            onClick={() => {
              const input = document.getElementById('student-brn-input');
              if (input) input.focus();
            }}
          >
            <span className="material-symbols-outlined">edit_note</span>
            Focus ID Input in Top Bar
          </button>
        </div>
      </div>
    );
  }

  // Calculate KPIs
  const total = holds?.length ?? 0;
  const confirmed = holds?.filter((h) => h.status === 'CONFIRMED').length ?? 0;
  const held = holds?.filter((h) => h.status === 'HELD').length ?? 0;
  const inactive = holds?.filter((h) => h.status === 'CANCELLED' || h.status === 'EXPIRED').length ?? 0;

  return (
    <div className="page-container">
      {/* Student Profile Header Block */}
      <div className="student-profile-card">
        <div className="profile-row">
          <div className="profile-identity">
            <div className="fingerprint-avatar">
              <span className="material-symbols-outlined text-2xl">fingerprint</span>
            </div>
            <div>
              <div className="flex-row items-center gap-xs">
                <span className="text-muted text-xs uppercase tracking-wider font-bold">Primary Record Holder</span>
                <span className="verification-badge">
                  <span className="pulse-dot"></span>
                  Active Verification
                </span>
              </div>
              <div className="flex-row items-center gap-sm mt-xs">
                <span className="student-id-display font-mono">{savedStudentId}</span>
                <button
                  type="button"
                  className="copy-button"
                  onClick={handleCopyId}
                  title="Copy Student ID"
                >
                  <span className="material-symbols-outlined text-sm">
                    {copied ? 'check' : 'content_copy'}
                  </span>
                  <span className="text-xs">{copied ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
              <span className="text-xs text-muted">Ministry Registered BRN • Automated Central Board Validation</span>
            </div>
          </div>

          <div className="server-sync-box">
            <div className="sync-status-indicator">
              <span className="pulse-dot-secondary"></span>
              <span className="font-mono text-xs font-bold">GET /me/holds</span>
            </div>
            <span className="text-xs text-muted">Polling every 5 seconds</span>
            <button
              type="button"
              className="btn btn-sm btn-outline mt-xs"
              onClick={() => refetch()}
              disabled={isFetching}
            >
              <span className={`material-symbols-outlined text-sm ${isFetching ? 'spin-icon' : ''}`}>
                sync
              </span>
              Sync Now
            </button>
          </div>
        </div>

        {/* KPI Summary Cards Grid */}
        <div className="kpi-grid">
          <div className="kpi-card">
            <div className="kpi-header">
              <span className="kpi-label">Total Applications</span>
              <span className="material-symbols-outlined text-muted">folder_open</span>
            </div>
            <div className="kpi-value-row">
              <span className="kpi-value font-mono">{total}</span>
              <span className="kpi-unit">records</span>
            </div>
          </div>

          <div className="kpi-card">
            <div className="kpi-header">
              <span className="kpi-label">Confirmed Seats</span>
              <span className="material-symbols-outlined text-success">verified</span>
            </div>
            <div className="kpi-value-row">
              <span className="kpi-value font-mono text-success">{confirmed}</span>
              <span className="kpi-unit">enrolled</span>
            </div>
          </div>

          <div className="kpi-card">
            <div className="kpi-header">
              <span className="kpi-label">Active Holds</span>
              <span className="material-symbols-outlined text-warning">hourglass_top</span>
            </div>
            <div className="kpi-value-row">
              <span className="kpi-value font-mono text-warning">{held}</span>
              <span className="kpi-unit">awaiting fee</span>
            </div>
          </div>

          <div className="kpi-card">
            <div className="kpi-header">
              <span className="kpi-label">Expired / Cancelled</span>
              <span className="material-symbols-outlined text-muted">history</span>
            </div>
            <div className="kpi-value-row">
              <span className="kpi-value font-mono text-muted">{inactive}</span>
              <span className="kpi-unit">released</span>
            </div>
          </div>
        </div>
      </div>

      <ErrorBanner message={error ? (error as Error).message : null} />

      {/* Applications List */}
      <div className="applications-section">
        <div className="section-header-bar">
          <div>
            <h2 className="section-heading">Application Roster</h2>
            <p className="section-desc">
              History of all admission holds registered for this student identifier.
            </p>
          </div>
          <Link to="/" className="btn btn-primary btn-sm">
            <span className="material-symbols-outlined text-sm">add</span>
            Apply to More Classes
          </Link>
        </div>

        {isLoading && (
          <div className="loading-card">
            <span className="material-symbols-outlined spin-icon">sync</span>
            <span>Loading application records...</span>
          </div>
        )}

        {!isLoading && total === 0 && (
          <div className="empty-state-card">
            <span className="material-symbols-outlined empty-icon">assignment_late</span>
            <h3>No applications found for this student ID</h3>
            <p>You have not initiated any class reservations yet. Select an available class to begin.</p>
            <Link to="/" className="btn btn-primary">
              Browse Available Classes
            </Link>
          </div>
        )}

        <div className="applications-list">
          {holds?.map((item) => {
            const isHeldStatus = item.status === 'HELD';
            const isConfirmedStatus = item.status === 'CONFIRMED';

            return (
              <div key={item.holdId} className="application-card">
                <div className="app-card-left">
                  <div className="app-card-icon">
                    <span className="material-symbols-outlined">
                      {isConfirmedStatus ? 'verified' : isHeldStatus ? 'timer' : 'history'}
                    </span>
                  </div>
                  <div>
                    <h3 className="app-class-name">{item.className}</h3>
                    <div className="app-meta-row font-mono text-xs text-muted">
                      <span>Hold ID: {item.holdId.slice(0, 8)}...</span>
                      <span>•</span>
                      <span>
                        Expires: {new Date(item.expiresAt).toLocaleTimeString()}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="app-card-right">
                  <span
                    className={`status-pill status-pill-${item.status.toLowerCase()}`}
                  >
                    {isHeldStatus && <span className="pulse-dot-amber"></span>}
                    {item.status}
                  </span>

                  <Link
                    to={`/holds/${item.holdId}`}
                    className={`btn btn-sm ${isHeldStatus ? 'btn-primary' : 'btn-outline'}`}
                  >
                    {isHeldStatus ? 'Complete Payment' : 'View Docket'}
                    <span className="material-symbols-outlined text-sm">arrow_forward</span>
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
