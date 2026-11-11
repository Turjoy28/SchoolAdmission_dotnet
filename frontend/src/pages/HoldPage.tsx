import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, type ApiError } from '../api/client';
import type { HoldDetailsResponse, ConfirmHoldResponse } from '../api/types';
import { useCountdown } from '../hooks/useCountdown';
import { ErrorBanner } from '../components/ErrorBanner';

interface HoldPageProps {
  savedStudentId: string;
}

export const HoldPage: React.FC<HoldPageProps> = ({ savedStudentId }) => {
  const { holdId } = useParams<{ holdId: string }>();
  const queryClient = useQueryClient();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Poll hold state every 5 seconds per PRD
  const { data: hold, isLoading, error, refetch } = useQuery<HoldDetailsResponse>({
    queryKey: ['hold', holdId],
    queryFn: () => api<HoldDetailsResponse>(`/holds/${holdId}`),
    enabled: Boolean(holdId),
    refetchInterval: 5000,
  });

  // Calculate live countdown with server-skew offset
  const { formatted, isExpired, progressPercent } = useCountdown(
    hold?.expiresAt,
    hold?.serverTime
  );

  // Derive effective status: if server says HELD but local countdown expired -> EXPIRED
  const effectiveStatus =
    hold?.status === 'HELD' && isExpired ? 'EXPIRED' : hold?.status || 'UNKNOWN';

  // Trigger refetch once when timer expires to synchronize server state
  useEffect(() => {
    if (isExpired && hold?.status === 'HELD') {
      refetch();
    }
  }, [isExpired, hold?.status, refetch]);

  // Confirm Mutation (POST /holds/{holdId}/confirm)
  const confirmMutation = useMutation<ConfirmHoldResponse, ApiError>({
    mutationFn: () =>
      api<ConfirmHoldResponse>(`/holds/${holdId}/confirm`, {
        method: 'POST',
        studentId: savedStudentId,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hold', holdId] });
      queryClient.invalidateQueries({ queryKey: ['classes'] });
      queryClient.invalidateQueries({ queryKey: ['my-holds'] });
    },
    onError: (err) => {
      setErrorMessage(err.message);
    },
  });

  // Cancel Mutation (DELETE /holds/{holdId})
  const cancelMutation = useMutation<void, ApiError>({
    mutationFn: () =>
      api<void>(`/holds/${holdId}`, {
        method: 'DELETE',
        studentId: savedStudentId,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hold', holdId] });
      queryClient.invalidateQueries({ queryKey: ['classes'] });
      queryClient.invalidateQueries({ queryKey: ['my-holds'] });
    },
    onError: (err) => {
      setErrorMessage(err.message);
    },
  });

  const handleConfirm = () => {
    setErrorMessage(null);
    if (!savedStudentId) {
      setErrorMessage('Please save your 17-digit student ID in the top bar to verify ownership.');
      return;
    }
    confirmMutation.mutate();
  };

  const handleCancel = () => {
    setErrorMessage(null);
    if (!savedStudentId) {
      setErrorMessage('Please save your 17-digit student ID in the top bar to verify ownership.');
      return;
    }
    if (window.confirm('Are you sure you want to cancel this application? The held seat will return to the available pool.')) {
      cancelMutation.mutate();
    }
  };

  if (isLoading) {
    return (
      <div className="page-container">
        <div className="loading-card">
          <span className="material-symbols-outlined spin-icon">sync</span>
          <span>Loading hold docket from admission ledger...</span>
        </div>
      </div>
    );
  }

  if (error || !hold) {
    return (
      <div className="page-container">
        <div className="empty-state-card">
          <span className="material-symbols-outlined empty-icon text-error">error</span>
          <h2>Application Not Found</h2>
          <p>{error ? (error as Error).message : 'The requested reservation hold does not exist in the database.'}</p>
          <Link to="/" className="btn btn-primary">
            Return to Available Classes
          </Link>
        </div>
      </div>
    );
  }

  const isHeld = effectiveStatus === 'HELD';
  const isConfirmed = effectiveStatus === 'CONFIRMED';
  const isCancelled = effectiveStatus === 'CANCELLED';
  const isExp = effectiveStatus === 'EXPIRED';
  const isActionPending = confirmMutation.isPending || cancelMutation.isPending;

  return (
    <div className="page-container">
      {/* Breadcrumb Navigation */}
      <div className="breadcrumb-bar">
        <Link to="/" className="breadcrumb-link">
          <span className="material-symbols-outlined text-sm">arrow_back</span>
          Class Roster
        </Link>
        <span className="text-muted">/</span>
        <span className="text-muted">Reservation Hold Docket</span>
        <span className="text-muted">/</span>
        <span className="font-mono font-bold text-primary">{holdId?.slice(0, 8)}</span>
      </div>

      <ErrorBanner
        message={errorMessage}
        onDismiss={() => setErrorMessage(null)}
      />

      <div className="hold-layout-grid">
        {/* Left Column: Countdown & Status Details */}
        <div className="hold-main-column">
          {/* Active Hold Countdown Hero */}
          {isHeld && (
            <div className="countdown-card">
              <div className="countdown-accent-strip"></div>
              <div className="countdown-header">
                <span className="status-badge-held">
                  <span className="pulse-dot-amber"></span>
                  HELD — SEAT TIME-LOCKED
                </span>
                <span className="sync-note font-mono">
                  <span className="material-symbols-outlined text-xs">sync</span>
                  Live Syncing (5s poll)
                </span>
              </div>

              <div className="countdown-hero-block">
                <div>
                  <span className="countdown-subtitle">Time Remaining to Complete Reservation</span>
                  <div className="timer-display-row">
                    <span className="timer-digits font-mono">{formatted}</span>
                    <span className="timer-unit font-mono">MIN : SEC</span>
                  </div>
                  <div className="timer-meta-info font-mono text-xs">
                    <span className="material-symbols-outlined text-xs">schedule</span>
                    Expires: {new Date(hold.expiresAt).toLocaleTimeString()}
                  </div>
                </div>

                {/* Circular / Bar Progress Visualizer */}
                <div className="circular-progress-box">
                  <div className="progress-ring-container">
                    <svg className="progress-ring" viewBox="0 0 36 36">
                      <path
                        className="progress-ring-bg"
                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                      />
                      <path
                        className="progress-ring-fill"
                        strokeDasharray="100, 100"
                        strokeDashoffset={100 - progressPercent}
                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                      />
                    </svg>
                    <div className="progress-ring-center">
                      <span className="material-symbols-outlined text-secondary">hourglass_top</span>
                      <span className="font-mono text-xs">{Math.round(progressPercent)}%</span>
                    </div>
                  </div>
                  <span className="text-xs text-muted">Seat Lock Window</span>
                </div>
              </div>

              <div className="countdown-warning-note">
                <span className="material-symbols-outlined text-warning">warning</span>
                <span>
                  Your seat is temporarily reserved. If the timer reaches <strong>00:00</strong>, the hold expires immediately and returns the seat back to the cohort pool.
                </span>
              </div>
            </div>
          )}

          {/* Confirmed State Hero */}
          {isConfirmed && (
            <div className="state-banner state-banner-confirmed animate-fade-in">
              <span className="material-symbols-outlined text-3xl">verified</span>
              <div>
                <h2>Admission Confirmed!</h2>
                <p>
                  Your seat in <strong>{hold.className}</strong> has been secured and permanently recorded in the institutional database.
                </p>
              </div>
            </div>
          )}

          {/* Expired State Hero */}
          {isExp && (
            <div className="state-banner state-banner-expired animate-fade-in">
              <span className="material-symbols-outlined text-3xl">timer_off</span>
              <div>
                <h2>Reservation Hold Expired</h2>
                <p>
                  The 10-minute hold window for this seat has elapsed. The seat has automatically returned to the class pool. You may return to the class list and apply again.
                </p>
              </div>
            </div>
          )}

          {/* Cancelled State Hero */}
          {isCancelled && (
            <div className="state-banner state-banner-cancelled animate-fade-in">
              <span className="material-symbols-outlined text-3xl">cancel</span>
              <div>
                <h2>Application Cancelled</h2>
                <p>
                  You cancelled this reservation hold. The seat was released immediately and is now available for other applicants.
                </p>
              </div>
            </div>
          )}

          {/* Class & Hold Record Details Card */}
          <div className="details-card">
            <div className="details-card-header">
              <div>
                <h3 className="details-heading">Application & Class Record</h3>
                <span className="details-subheading">
                  Cryptographic reservation token registered under Institutional Admissions API
                </span>
              </div>
              <span className="status-pill status-pill-active font-mono text-xs">
                <span className="material-symbols-outlined text-xs">fingerprint</span>
                Token Verified
              </span>
            </div>

            <div className="details-meta-grid">
              <div className="meta-item">
                <span className="meta-label">APPLIED CLASS</span>
                <span className="meta-value font-bold text-primary">{hold.className}</span>
              </div>
              <div className="meta-item">
                <span className="meta-label">CURRENT STATUS</span>
                <span className={`status-pill status-pill-${effectiveStatus.toLowerCase()}`}>
                  {effectiveStatus}
                </span>
              </div>
              <div className="meta-item">
                <span className="meta-label">HOLD DOCKET ID</span>
                <span className="meta-value font-mono text-xs">{hold.holdId}</span>
              </div>
              <div className="meta-item">
                <span className="meta-label">CLASS COHORT ID</span>
                <span className="meta-value font-mono text-xs">{hold.classId}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Actions & Payment Simulation */}
        <div className="hold-actions-column">
          <div className="actions-card">
            <h3 className="actions-title">Reservation Actions</h3>
            <p className="actions-desc">
              Per PRD specifications, pressing "Pay Admission Fee" simulates payment and confirms admission immediately.
            </p>

            <div className="action-button-group">
              <button
                type="button"
                className={`btn btn-lg ${isHeld ? 'btn-success' : 'btn-disabled'}`}
                disabled={!isHeld || isActionPending}
                onClick={handleConfirm}
              >
                {confirmMutation.isPending ? (
                  <>
                    <span className="material-symbols-outlined spin-icon">sync</span>
                    Confirming Admission...
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined">credit_score</span>
                    Pay Admission Fee
                  </>
                )}
              </button>

              <button
                type="button"
                className={`btn btn-lg ${isHeld ? 'btn-danger-outline' : 'btn-disabled'}`}
                disabled={!isHeld || isActionPending}
                onClick={handleCancel}
              >
                {cancelMutation.isPending ? (
                  <>
                    <span className="material-symbols-outlined spin-icon">sync</span>
                    Cancelling...
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined">close</span>
                    Cancel Application
                  </>
                )}
              </button>
            </div>

            <div className="actions-help-note">
              <span className="material-symbols-outlined text-sm text-secondary">verified_user</span>
              <span>
                Actions require your 17-digit student ID saved in the top bar to verify ownership (via <code>X-Student-Id</code> header).
              </span>
            </div>
          </div>

          <div className="quick-links-card">
            <Link to="/my-applications" className="quick-link-item">
              <span className="material-symbols-outlined">folder_shared</span>
              <span>View All My Applications</span>
            </Link>
            <Link to="/" className="quick-link-item">
              <span className="material-symbols-outlined">list_alt</span>
              <span>Browse Other Classes</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};
