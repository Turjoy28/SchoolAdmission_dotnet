import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, type ApiError } from '../api/client';
import type { AdminHoldItem, ClassInfo, TransferHoldRequest } from '../api/types';
import { ErrorBanner } from '../components/ErrorBanner';

export const AdminStudentsPage: React.FC = () => {
  const queryClient = useQueryClient();

  const [searchFilter, setSearchFilter] = useState('');
  const [statusTab, setStatusTab] = useState<'ALL' | 'CONFIRMED' | 'HELD' | 'EXPIRED' | 'CANCELLED'>('ALL');
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Transfer Modal State
  const [transferTarget, setTransferTarget] = useState<AdminHoldItem | null>(null);
  const [selectedClassId, setSelectedClassId] = useState<string>('');

  // 1. Fetch all student applications (poll every 3s)
  const { data: holds, isLoading: isHoldsLoading } = useQuery<AdminHoldItem[]>({
    queryKey: ['admin-holds'],
    queryFn: () => api<AdminHoldItem[]>('/admin/holds'),
    refetchInterval: 3000,
  });

  // 2. Fetch all classes for transfer targets
  const { data: classes } = useQuery<ClassInfo[]>({
    queryKey: ['classes'],
    queryFn: () => api<ClassInfo[]>('/classes'),
    refetchInterval: 3000,
  });

  // 3. Transfer mutation
  const transferMutation = useMutation<
    AdminHoldItem,
    ApiError,
    { holdId: string; targetClassId: string }
  >({
    mutationFn: ({ holdId, targetClassId }) =>
      api<AdminHoldItem>(`/admin/holds/${holdId}/transfer`, {
        method: 'POST',
        body: { targetClassId } as TransferHoldRequest,
      }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['admin-holds'] });
      queryClient.invalidateQueries({ queryKey: ['classes'] });
      setSuccessMessage(
        `Successfully transferred student ${data.studentId} to "${data.className}".`
      );
      setTransferTarget(null);
      setSelectedClassId('');
    },
    onError: (err) => {
      setErrorMessage(err.message);
    },
  });

  // 4. Cancel / Release mutation
  const cancelMutation = useMutation<void, ApiError, string>({
    mutationFn: (holdId) =>
      api<void>(`/admin/holds/${holdId}`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-holds'] });
      queryClient.invalidateQueries({ queryKey: ['classes'] });
      setSuccessMessage('Student application / hold was cancelled and seat released.');
    },
    onError: (err) => {
      setErrorMessage(err.message);
    },
  });

  const handleOpenTransfer = (hold: AdminHoldItem) => {
    setErrorMessage(null);
    setSuccessMessage(null);
    setTransferTarget(hold);
    // Default to first other class with available seats
    const otherClasses = (classes || []).filter((c) => c.id !== hold.classId);
    const availableOption = otherClasses.find((c) => c.availableSeats > 0);
    setSelectedClassId(availableOption?.id || (otherClasses[0]?.id ?? ''));
  };

  const handleExecuteTransfer = () => {
    if (!transferTarget || !selectedClassId) return;
    transferMutation.mutate({
      holdId: transferTarget.holdId,
      targetClassId: selectedClassId,
    });
  };

  const handleCancelHold = (hold: AdminHoldItem) => {
    const isPaid = hold.status === 'CONFIRMED';
    const confirmPrompt = isPaid
      ? `Are you sure you want to cancel the CONFIRMED admission for Student ${hold.studentId} in "${hold.className}"?\n\nThis will release the confirmed seat back to the available pool.`
      : `Are you sure you want to release the active hold for Student ${hold.studentId}?`;

    if (window.confirm(confirmPrompt)) {
      setErrorMessage(null);
      setSuccessMessage(null);
      cancelMutation.mutate(hold.holdId);
    }
  };

  // Aggregates
  const totalCount = holds?.length ?? 0;
  const confirmedCount = holds?.filter((h) => h.status === 'CONFIRMED').length ?? 0;
  const heldCount = holds?.filter((h) => h.status === 'HELD').length ?? 0;
  const expiredCount = holds?.filter((h) => h.status === 'EXPIRED').length ?? 0;
  const cancelledCount = holds?.filter((h) => h.status === 'CANCELLED').length ?? 0;

  // Filtered list
  const filteredHolds = (holds || []).filter((h) => {
    // Status tab filter
    if (statusTab !== 'ALL' && h.status !== statusTab) {
      return false;
    }
    // Search filter
    if (searchFilter) {
      const q = searchFilter.toLowerCase();
      const matchesStudent = h.studentId.includes(q);
      const matchesClass = h.className.toLowerCase().includes(q);
      const matchesHoldId = h.holdId.toLowerCase().includes(q);
      return matchesStudent || matchesClass || matchesHoldId;
    }
    return true;
  });

  return (
    <div className="page-container">
      {/* Return & Breadcrumb Bar */}
      <div className="breadcrumb-bar">
        <Link to="/" className="breadcrumb-link">
          <span className="material-symbols-outlined text-sm">arrow_back</span>
          Return to Student View
        </Link>
        <div className="breadcrumb-meta">
          <Link to="/admin" className="breadcrumb-link" style={{ marginRight: '12px' }}>
            <span className="material-symbols-outlined text-sm">settings</span>
            Manage Cohorts
          </Link>
          <span className="role-tag">Registrar Admissions Ledger</span>
        </div>
      </div>

      {/* Admin Header Banner */}
      <div className="admin-header-card">
        <div className="admin-header-icon">
          <span className="material-symbols-outlined text-2xl">supervisor_account</span>
        </div>
        <div className="admin-header-text">
          <div className="flex-row items-center gap-sm">
            <h1 className="section-heading">Student Admissions & Reallocation Control</h1>
            <span className="admin-badge">Student Registry</span>
          </div>
          <p className="section-desc">
            Audit all individual student registrations by 17-digit ID. If a student mistakenly confirmed payment for the wrong class, transfer their enrollment to any cohort with available seats in one click.
          </p>
        </div>
      </div>

      {/* KPI Chips */}
      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-header">
            <span className="kpi-title">TOTAL APPLICATIONS</span>
            <span className="material-symbols-outlined text-muted text-sm">group</span>
          </div>
          <div className="kpi-number font-mono">{totalCount}</div>
          <span className="kpi-subtext">All submitted holds</span>
        </div>

        <div className="kpi-card">
          <div className="kpi-header">
            <span className="kpi-title">PAID / CONFIRMED</span>
            <span className="material-symbols-outlined text-success text-sm">check_circle</span>
          </div>
          <div className="kpi-number font-mono text-success">{confirmedCount}</div>
          <span className="kpi-subtext">Active student enrollments</span>
        </div>

        <div className="kpi-card">
          <div className="kpi-header">
            <span className="kpi-title">ACTIVE HOLDS</span>
            <span className="material-symbols-outlined text-warning text-sm">hourglass_top</span>
          </div>
          <div className="kpi-number font-mono text-warning">{heldCount}</div>
          <span className="kpi-subtext">Pending payment window</span>
        </div>

        <div className="kpi-card">
          <div className="kpi-header">
            <span className="kpi-title">EXPIRED / CANCELLED</span>
            <span className="material-symbols-outlined text-muted text-sm">history</span>
          </div>
          <div className="kpi-number font-mono text-muted">{expiredCount + cancelledCount}</div>
          <span className="kpi-subtext">Released allocations</span>
        </div>
      </div>

      <ErrorBanner message={errorMessage} onDismiss={() => setErrorMessage(null)} />

      {successMessage && (
        <div className="success-banner animate-fade-in">
          <span className="material-symbols-outlined">check_circle</span>
          <div className="flex-1">
            <strong>Action Executed: </strong>
            <span>{successMessage}</span>
          </div>
          <button className="btn btn-sm btn-outline" onClick={() => setSuccessMessage(null)}>
            Dismiss
          </button>
        </div>
      )}

      {/* Main Table Card */}
      <div className="form-card">
        {/* Controls Bar: Tabs & Search */}
        <div className="admin-ledger-controls">
          <div className="status-tabs-row">
            <button
              type="button"
              className={`status-tab-btn ${statusTab === 'ALL' ? 'active' : ''}`}
              onClick={() => setStatusTab('ALL')}
            >
              All Records ({totalCount})
            </button>
            <button
              type="button"
              className={`status-tab-btn tab-confirmed ${statusTab === 'CONFIRMED' ? 'active' : ''}`}
              onClick={() => setStatusTab('CONFIRMED')}
            >
              <span className="dot dot-success"></span>
              Paid / Confirmed ({confirmedCount})
            </button>
            <button
              type="button"
              className={`status-tab-btn tab-held ${statusTab === 'HELD' ? 'active' : ''}`}
              onClick={() => setStatusTab('HELD')}
            >
              <span className="dot dot-warning"></span>
              Active Holds ({heldCount})
            </button>
            <button
              type="button"
              className={`status-tab-btn ${statusTab === 'EXPIRED' ? 'active' : ''}`}
              onClick={() => setStatusTab('EXPIRED')}
            >
              Expired ({expiredCount})
            </button>
            <button
              type="button"
              className={`status-tab-btn ${statusTab === 'CANCELLED' ? 'active' : ''}`}
              onClick={() => setStatusTab('CANCELLED')}
            >
              Cancelled ({cancelledCount})
            </button>
          </div>

          <div className="ledger-search-box">
            <span className="material-symbols-outlined text-muted text-sm">search</span>
            <input
              type="text"
              placeholder="Filter by Student ID, Class, or Hold ID..."
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              className="ledger-search-input"
            />
            {searchFilter && (
              <button
                type="button"
                className="btn-clear-search"
                onClick={() => setSearchFilter('')}
                title="Clear search"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Ledger Table */}
        {isHoldsLoading ? (
          <div className="loading-state">
            <span className="material-symbols-outlined spin-icon text-2xl">sync</span>
            <span>Synchronizing admissions ledger...</span>
          </div>
        ) : filteredHolds.length === 0 ? (
          <div className="empty-state-box">
            <span className="material-symbols-outlined text-3xl text-muted">inventory_2</span>
            <p>No student applications found matching this view.</p>
            <span className="text-xs text-muted">
              {statusTab !== 'ALL' ? 'Try switching to "All Records" tab.' : 'Applications will show up here as students apply.'}
            </span>
          </div>
        ) : (
          <div className="admin-classes-table-wrapper">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Student ID (17-Digit BRN)</th>
                  <th>Current Cohort</th>
                  <th>Payment / Hold Status</th>
                  <th>Applied At</th>
                  <th style={{ textAlign: 'right' }}>Admin Management Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredHolds.map((h) => {
                  const isPaid = h.status === 'CONFIRMED';
                  const isHeld = h.status === 'HELD';
                  const canTransfer = isPaid || isHeld;
                  const canCancel = isPaid || isHeld;

                  return (
                    <tr key={h.holdId} className="admin-table-row">
                      <td>
                        <div className="student-cell">
                          <strong className="font-mono text-primary text-sm">
                            {h.studentId}
                          </strong>
                          <span className="font-mono text-xs text-muted">
                            Hold ID: {h.holdId.slice(0, 8)}...
                          </span>
                        </div>
                      </td>
                      <td>
                        <div className="table-class-info">
                          <strong className="table-class-name">{h.className}</strong>
                          <span className="font-mono text-xs text-muted">
                            Class ID: {h.classId.slice(0, 8)}...
                          </span>
                        </div>
                      </td>
                      <td>
                        {isPaid && (
                          <span className="badge badge-success-sm">
                            <span className="material-symbols-outlined text-xs">verified</span>
                            PAID & CONFIRMED
                          </span>
                        )}
                        {isHeld && (
                          <span className="badge badge-warning-sm">
                            <span className="material-symbols-outlined text-xs">hourglass_empty</span>
                            ACTIVE HOLD
                          </span>
                        )}
                        {h.status === 'EXPIRED' && (
                          <span className="badge badge-neutral-sm">
                            EXPIRED
                          </span>
                        )}
                        {h.status === 'CANCELLED' && (
                          <span className="badge badge-danger-sm">
                            CANCELLED
                          </span>
                        )}
                      </td>
                      <td className="text-xs text-muted">
                        {new Date(h.createdAt).toLocaleString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div className="admin-row-actions">
                          {canTransfer && (
                            <button
                              type="button"
                              className="btn btn-primary-outline-sm"
                              title="Transfer student to another class"
                              onClick={() => handleOpenTransfer(h)}
                            >
                              <span className="material-symbols-outlined text-sm">sync_alt</span>
                              Transfer Class
                            </button>
                          )}
                          {canCancel && (
                            <button
                              type="button"
                              className="btn btn-danger-sm"
                              title="Release hold or cancel admission"
                              disabled={cancelMutation.isPending && cancelMutation.variables === h.holdId}
                              onClick={() => handleCancelHold(h)}
                            >
                              <span className="material-symbols-outlined text-sm">cancel</span>
                              {isPaid ? 'Revoke Admission' : 'Release'}
                            </button>
                          )}
                          {!canTransfer && (
                            <span className="text-xs text-muted font-mono">Archived</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Transfer Class Modal */}
      {transferTarget && (
        <div className="modal-backdrop animate-fade-in" onClick={() => setTransferTarget(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-header-text">
                <h3 className="modal-title">Transfer Student Admission</h3>
                <span className="modal-subtitle">
                  Atomic row-locking re-allocation to a different cohort
                </span>
              </div>
              <button
                type="button"
                className="btn-close-modal"
                onClick={() => setTransferTarget(null)}
              >
                ✕
              </button>
            </div>

            <div className="modal-body">
              <div className="transfer-summary-box">
                <div className="summary-field">
                  <span className="field-label">Student ID:</span>
                  <strong className="font-mono text-primary">{transferTarget.studentId}</strong>
                </div>
                <div className="summary-field">
                  <span className="field-label">Current Cohort:</span>
                  <strong>{transferTarget.className}</strong>
                </div>
                <div className="summary-field">
                  <span className="field-label">Admission Status:</span>
                  <span className="font-bold">{transferTarget.status}</span>
                </div>
              </div>

              <div className="form-group" style={{ marginTop: '16px' }}>
                <label htmlFor="target-class-select" className="form-label">
                  Select Target Cohort to Move Into:
                </label>
                <select
                  id="target-class-select"
                  className="form-input font-medium"
                  value={selectedClassId}
                  onChange={(e) => setSelectedClassId(e.target.value)}
                >
                  <option value="" disabled>-- Select a Cohort --</option>
                  {(classes || [])
                    .filter((c) => c.id !== transferTarget.classId)
                    .map((c) => (
                      <option
                        key={c.id}
                        value={c.id}
                        disabled={c.availableSeats <= 0}
                      >
                        {c.name} — ({c.availableSeats} of {c.totalSeats} seats available) {c.availableSeats <= 0 ? '[FULL]' : ''}
                      </option>
                    ))}
                </select>
                <span className="field-hint">
                  Transfer will atomically release the seat in "{transferTarget.className}" and allocate a seat in the target class.
                </span>
              </div>
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => setTransferTarget(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={!selectedClassId || transferMutation.isPending}
                onClick={handleExecuteTransfer}
              >
                {transferMutation.isPending ? (
                  <>
                    <span className="material-symbols-outlined spin-icon text-sm">sync</span>
                    Transferring...
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-sm">check</span>
                    Confirm Transfer
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
