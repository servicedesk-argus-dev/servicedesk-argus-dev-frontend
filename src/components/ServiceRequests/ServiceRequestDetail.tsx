import { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, CheckCircle2, XCircle, Clock, User2, Users, CalendarDays,
  FileText, Tag, Activity, Loader2, Send, ShieldCheck, ShieldX,
  Package, Layers, MessageSquare, Building2, Hash,
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
  useServiceRequest,
  useApproveServiceRequest,
  useRejectServiceRequest,
  useCloseServiceRequest,
  useReopenServiceRequest,
  useUpdateCatalogTask,
} from '../../hooks/useServiceRequests';
import { useAuth } from '../../hooks/useAuth';
import type { CatalogTask, CatalogTaskState, ServiceRequest, ServiceRequestState, RequestItem, Priority } from '../../types/index';

// =============================================================================
// Constants
// =============================================================================

const STATE_CONFIG: Record<ServiceRequestState, { label: string; color: string; bg: string; border: string; icon: React.ElementType }> = {
  NEW:         { label: 'New',         color: '#3B82F6', bg: 'rgba(59,130,246,0.10)',  border: '#3B82F6', icon: Clock },
  APPROVAL:    { label: 'Approval',    color: '#F59E0B', bg: 'rgba(245,158,11,0.10)',  border: '#F59E0B', icon: ShieldCheck },
  APPROVED:    { label: 'Approved',    color: '#22C55E', bg: 'rgba(34,197,94,0.10)',   border: '#22C55E', icon: CheckCircle2 },
  FULFILLMENT: { label: 'Fulfillment', color: '#6366F1', bg: 'rgba(99,102,241,0.10)',  border: '#6366F1', icon: Package },
  FULFILLED:   { label: 'Fulfilled',   color: '#10B981', bg: 'rgba(16,185,129,0.10)',  border: '#10B981', icon: CheckCircle2 },
  CLOSED:      { label: 'Closed',      color: '#64748B', bg: 'rgba(100,116,139,0.10)', border: '#64748B', icon: XCircle },
  CANCELLED:   { label: 'Cancelled',   color: '#EF4444', bg: 'rgba(239,68,68,0.10)',   border: '#EF4444', icon: XCircle },
};

const PRIORITY_CONFIG: Record<Priority, { label: string; color: string; bg: string; border: string }> = {
  P1: { label: 'Critical', color: '#EF4444', bg: 'rgba(239,68,68,0.12)',  border: '#EF4444' },
  P2: { label: 'High',     color: '#F59E0B', bg: 'rgba(245,158,11,0.12)', border: '#F59E0B' },
  P3: { label: 'Medium',   color: '#6366F1', bg: 'rgba(99,102,241,0.12)', border: '#6366F1' },
  P4: { label: 'Low',      color: '#10B981', bg: 'rgba(16,185,129,0.12)', border: '#10B981' },
};

const REQUEST_ITEM_STATE_CONFIG: Record<string, { label: string; color: string; bg: string; border: string }> = {
  PENDING:     { label: 'Pending',     color: '#F59E0B', bg: 'rgba(245,158,11,0.10)', border: '#F59E0B' },
  APPROVED:    { label: 'Approved',    color: '#22C55E', bg: 'rgba(34,197,94,0.10)',  border: '#22C55E' },
  IN_PROGRESS: { label: 'In Progress', color: '#6366F1', bg: 'rgba(99,102,241,0.10)', border: '#6366F1' },
  FULFILLED:   { label: 'Fulfilled',   color: '#10B981', bg: 'rgba(16,185,129,0.10)', border: '#10B981' },
  CLOSED:      { label: 'Closed',      color: '#64748B', bg: 'rgba(100,116,139,0.10)', border: '#64748B' },
  CANCELLED:   { label: 'Cancelled',   color: '#EF4444', bg: 'rgba(239,68,68,0.10)',  border: '#EF4444' },
};

const TASK_STATE_CONFIG: Record<CatalogTaskState, { label: string; color: string; bg: string; border: string }> = {
  OPEN: { label: 'Open', color: '#3B82F6', bg: 'rgba(59,130,246,0.10)', border: '#3B82F6' },
  IN_PROGRESS: { label: 'Work in Progress', color: '#6366F1', bg: 'rgba(99,102,241,0.10)', border: '#6366F1' },
  CLOSED_COMPLETE: { label: 'Closed Complete', color: '#10B981', bg: 'rgba(16,185,129,0.10)', border: '#10B981' },
  CLOSED_INCOMPLETE: { label: 'Closed Incomplete', color: '#EF4444', bg: 'rgba(239,68,68,0.10)', border: '#EF4444' },
  CLOSED_SKIPPED: { label: 'Closed Skipped', color: '#64748B', bg: 'rgba(100,116,139,0.10)', border: '#64748B' },
};

// =============================================================================
// Helpers
// =============================================================================

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return formatDate(dateStr);
}

// =============================================================================
// Sub-components
// =============================================================================

function StateBadge({ state }: { state: ServiceRequestState }) {
  const cfg = STATE_CONFIG[state];
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '4px 12px',
        borderRadius: 9999,
        fontSize: 13,
        fontWeight: 600,
        color: cfg.color,
        backgroundColor: cfg.bg,
        border: `1px solid ${cfg.border}`,
      }}
    >
      <span style={{ width: 7, height: 7, borderRadius: '50%', backgroundColor: cfg.color }} />
      {cfg.label}
    </span>
  );
}

function PriorityBadge({ priority }: { priority: Priority }) {
  const cfg = PRIORITY_CONFIG[priority];
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '4px 12px',
        borderRadius: 9999,
        fontSize: 13,
        fontWeight: 600,
        color: cfg.color,
        backgroundColor: cfg.bg,
        border: `1px solid ${cfg.border}`,
      }}
    >
      {priority} - {cfg.label}
    </span>
  );
}

function ItemStateBadge({ state }: { state: string }) {
  const cfg = REQUEST_ITEM_STATE_CONFIG[state] ?? { label: state, color: '#64748B', bg: 'rgba(100,116,139,0.10)', border: '#64748B' };
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        padding: '3px 10px',
        borderRadius: 9999,
        fontSize: 12,
        fontWeight: 600,
        color: cfg.color,
        backgroundColor: cfg.bg,
        border: `1px solid ${cfg.border}`,
      }}
    >
      <span style={{ width: 5, height: 5, borderRadius: '50%', backgroundColor: cfg.color }} />
      {cfg.label}
    </span>
  );
}

function TaskStateBadge({ state }: { state: CatalogTaskState }) {
  const cfg = TASK_STATE_CONFIG[state] ?? { label: state, color: '#64748B', bg: 'rgba(100,116,139,0.10)', border: '#64748B' };
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        padding: '3px 10px',
        borderRadius: 9999,
        fontSize: 12,
        fontWeight: 600,
        color: cfg.color,
        backgroundColor: cfg.bg,
        border: `1px solid ${cfg.border}`,
        whiteSpace: 'nowrap',
      }}
    >
      <span style={{ width: 5, height: 5, borderRadius: '50%', backgroundColor: cfg.color }} />
      {cfg.label}
    </span>
  );
}

function formatVariables(values?: Record<string, unknown> | null) {
  if (!values || typeof values !== 'object') return [];
  return Object.entries(values).filter(([, value]) => value !== null && value !== undefined && String(value).trim() !== '');
}

function DetailField({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
      <div
        style={{
          width: 34,
          height: 34,
          borderRadius: 8,
          backgroundColor: '#F1F5F9',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          marginTop: 1,
        }}
      >
        <Icon size={16} style={{ color: '#64748b' }} />
      </div>
      <div>
        <div style={{ fontSize: 12, color: '#94a3b8', fontWeight: 500, marginBottom: 2 }}>{label}</div>
        <div style={{ fontSize: 14, color: '#0f172a', fontWeight: 500 }}>{value || '-'}</div>
      </div>
    </div>
  );
}

function SectionCard({ title, icon: Icon, children }: { title: string; icon: React.ElementType; children: React.ReactNode }) {
  return (
    <div
      style={{
        background: '#ffffff',
        borderRadius: 12,
        border: '1px solid #e2e8f0',
        boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
        marginBottom: 20,
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          padding: '16px 20px',
          borderBottom: '1px solid #e2e8f0',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          backgroundColor: '#F8FAFC',
        }}
      >
        <Icon size={18} style={{ color: '#6366f1' }} />
        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: '#0f172a' }}>{title}</h3>
      </div>
      <div style={{ padding: 20 }}>{children}</div>
    </div>
  );
}

// =============================================================================
// Main Component
// =============================================================================

function ServiceRequestDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { canManage, isClient } = useAuth();

  const { data, isLoading, isError } = useServiceRequest(id!);
  const approveRequest = useApproveServiceRequest();
  const rejectRequest = useRejectServiceRequest();
  const updateTask = useUpdateCatalogTask();
  const closeRequest = useCloseServiceRequest();
  const reopenRequest = useReopenServiceRequest();

  const [showRejectForm, setShowRejectForm] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  const sr: ServiceRequest | undefined = data?.data ?? data;
  const catalogTasks: CatalogTask[] = useMemo(
    () => sr?.requestItems?.flatMap((item) => item.tasks ?? []) ?? [],
    [sr?.requestItems],
  );

  const handleApprove = async () => {
    if (!id) return;
    try {
      await approveRequest.mutateAsync(id);
      toast.success('Service request approved successfully');
    } catch {
      toast.error('Failed to approve service request');
    }
  };

  const handleReject = async () => {
    if (!id || !rejectReason.trim()) {
      toast.error('Please provide a rejection reason');
      return;
    }
    try {
      await rejectRequest.mutateAsync({ id, reason: rejectReason.trim() });
      toast.success('Service request rejected');
      setShowRejectForm(false);
      setRejectReason('');
    } catch {
      toast.error('Failed to reject service request');
    }
  };

  const handleTaskState = async (task: CatalogTask, state: CatalogTaskState) => {
    if (!id) return;
    try {
      await updateTask.mutateAsync({ id: task.id, serviceRequestId: id, data: { state } });
      toast.success(`${task.number} updated`);
    } catch (error: any) {
      toast.error(error?.response?.data?.message ?? 'Failed to update catalog task');
    }
  };

  const handleCloseRequest = async () => {
    if (!id) return;
    try {
      await closeRequest.mutateAsync(id);
      toast.success('Service request closed');
    } catch (error: any) {
      toast.error(error?.response?.data?.message ?? 'Failed to close service request');
    }
  };

  const handleReopenRequest = async () => {
    if (!id) return;
    try {
      await reopenRequest.mutateAsync(id);
      toast.success('Service request reopened');
    } catch (error: any) {
      toast.error(error?.response?.data?.message ?? 'Failed to reopen service request');
    }
  };

  // =========================================================================
  // Loading / Error states
  // =========================================================================

  if (isLoading) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: '#F8FAFC', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', color: '#94a3b8' }}>
          <Loader2 size={32} style={{ animation: 'spin 1s linear infinite', marginBottom: 12 }} />
          <p style={{ fontSize: 14 }}>Loading service request...</p>
        </div>
      </div>
    );
  }

  if (isError || !sr) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: '#F8FAFC', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <XCircle size={40} style={{ color: '#EF4444', marginBottom: 12 }} />
          <p style={{ fontSize: 14, color: '#EF4444' }}>Failed to load service request.</p>
          <button
            onClick={() => navigate('/service-requests')}
            style={{
              marginTop: 16,
              padding: '8px 20px',
              borderRadius: 8,
              border: '1px solid #e2e8f0',
              background: '#ffffff',
              fontSize: 14,
              color: '#0f172a',
              cursor: 'pointer',
            }}
          >
            Back to list
          </button>
        </div>
      </div>
    );
  }

  const showApprovalActions = sr.state === 'NEW' || sr.state === 'APPROVAL';
  const canWorkTasks = !isClient && canManage('catalog');
  const canClose = sr.state === 'FULFILLED' || sr.state === 'FULFILLMENT';
  const canReopen = sr.state === 'CLOSED' || sr.state === 'FULFILLED';

  // =========================================================================
  // Render
  // =========================================================================

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#F8FAFC' }}>
      {/* Hero Header */}
      <div
        style={{
          background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #334155 100%)',
          padding: '28px 40px 28px',
        }}
      >
        {/* Back button */}
        <button
          onClick={() => navigate('/service-requests')}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '6px 14px',
            borderRadius: 8,
            border: '1px solid rgba(255,255,255,0.15)',
            background: 'rgba(255,255,255,0.08)',
            color: '#cbd5e1',
            fontSize: 13,
            cursor: 'pointer',
            marginBottom: 18,
            transition: 'background 0.15s',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.14)')}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.08)')}
        >
          <ArrowLeft size={15} />
          Back to Service Requests
        </button>

        {/* Title row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <h1 style={{ margin: 0, fontSize: 26, fontWeight: 700, color: '#ffffff', letterSpacing: '-0.01em' }}>
            {sr.number}
          </h1>
          <StateBadge state={sr.state} />
          <PriorityBadge priority={sr.priority} />
        </div>
        <p style={{ margin: '8px 0 0', fontSize: 15, color: '#cbd5e1' }}>{sr.shortDescription}</p>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 18 }}>
          {canClose && (
            <button
              onClick={handleCloseRequest}
              disabled={closeRequest.isPending}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '8px 16px',
                borderRadius: 8,
                border: '1px solid rgba(16,185,129,0.45)',
                background: 'rgba(16,185,129,0.12)',
                color: '#bbf7d0',
                fontSize: 13,
                fontWeight: 700,
                cursor: closeRequest.isPending ? 'not-allowed' : 'pointer',
              }}
            >
              <CheckCircle2 size={15} />
              Close Request
            </button>
          )}
          {canReopen && (
            <button
              onClick={handleReopenRequest}
              disabled={reopenRequest.isPending}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '8px 16px',
                borderRadius: 8,
                border: '1px solid rgba(99,102,241,0.45)',
                background: 'rgba(99,102,241,0.16)',
                color: '#c7d2fe',
                fontSize: 13,
                fontWeight: 700,
                cursor: reopenRequest.isPending ? 'not-allowed' : 'pointer',
              }}
            >
              <Clock size={15} />
              Reopen
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: '28px 40px 40px', maxWidth: 1100, margin: '0 auto' }}>
        {/* Details Section */}
        <SectionCard title="Details" icon={FileText}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 24 }}>
            <DetailField icon={Hash} label="Number" value={sr.number} />
            <DetailField icon={Tag} label="Short Description" value={sr.shortDescription} />
            <DetailField icon={Package} label="Catalog Item" value={sr.catalogItemName || sr.requestItems?.[0]?.catalogItem?.name} />
            <DetailField icon={Layers} label="Category" value={sr.category || sr.requestItems?.[0]?.catalogItem?.category?.name || sr.requestItems?.[0]?.catalogItem?.type} />
            <DetailField icon={CalendarDays} label="Estimated Delivery" value={sr.estimatedDelivery} />
            <DetailField
              icon={User2}
              label="Requested By"
              value={sr.requestedBy ? `${sr.requestedBy.firstName} ${sr.requestedBy.lastName}` : null}
            />
            <DetailField
              icon={User2}
              label="Assigned To"
              value={sr.assignedTo ? `${sr.assignedTo.firstName} ${sr.assignedTo.lastName}` : null}
            />
            <DetailField
              icon={Users}
              label="Assignment Group"
              value={sr.assignmentGroup?.name}
            />
            <DetailField icon={CalendarDays} label="Created At" value={formatDate(sr.createdAt)} />
            <DetailField icon={CalendarDays} label="Updated At" value={sr.updatedAt ? formatDate(sr.updatedAt) : null} />
            {sr.approvedBy && (
              <DetailField
                icon={ShieldCheck}
                label="Approved By"
                value={`${sr.approvedBy.firstName} ${sr.approvedBy.lastName}`}
              />
            )}
          </div>

          {sr.description && (
            <div style={{ marginTop: 24, paddingTop: 20, borderTop: '1px solid #f1f5f9' }}>
              <div style={{ fontSize: 12, color: '#94a3b8', fontWeight: 500, marginBottom: 6 }}>Description</div>
              <div
                style={{
                  fontSize: 14,
                  color: '#334155',
                  lineHeight: 1.7,
                  backgroundColor: '#F8FAFC',
                  borderRadius: 8,
                  padding: '14px 18px',
                  border: '1px solid #f1f5f9',
                  whiteSpace: 'pre-wrap',
                }}
              >
                {sr.description}
              </div>
            </div>
          )}
        </SectionCard>

        <SectionCard title="ServiceNow-Style Fulfillment Flow" icon={Activity}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 14 }}>
            {[
              { label: 'REQ', value: sr.number, help: 'Request container created from the catalog order.' },
              { label: 'RITM', value: `${sr.requestItems?.length ?? 0} item(s)`, help: 'Requested item records hold form variables and item status.' },
              { label: 'Approval', value: sr.approvedAt ? 'Approved' : (sr.state === 'APPROVAL' ? 'Waiting' : 'Not required / passed'), help: 'Approval gates fulfillment when required.' },
              { label: 'SCTASK', value: `${catalogTasks.length} task(s)`, help: 'Fulfillment tasks assigned to resolver teams or engineers.' },
            ].map((step) => (
              <div key={step.label} style={{ border: '1px solid #e2e8f0', borderRadius: 10, padding: 16, background: '#F8FAFC' }}>
                <div style={{ fontSize: 11, color: '#64748b', fontWeight: 800, letterSpacing: '0.08em' }}>{step.label}</div>
                <div style={{ marginTop: 6, fontSize: 18, color: '#0f172a', fontWeight: 800 }}>{step.value}</div>
                <div style={{ marginTop: 6, fontSize: 12, color: '#64748b', lineHeight: 1.5 }}>{step.help}</div>
              </div>
            ))}
          </div>
        </SectionCard>

        {/* Request Items Section */}
        {sr.requestItems && sr.requestItems.length > 0 && (
          <SectionCard title="Request Items" icon={Layers}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                    {['Catalog Item', 'Type', 'Quantity', 'State', 'Catalog Tasks'].map((h) => (
                      <th
                        key={h}
                        style={{
                          padding: '10px 14px',
                          textAlign: 'left',
                          fontSize: 12,
                          fontWeight: 600,
                          color: '#64748b',
                          textTransform: 'uppercase',
                          letterSpacing: '0.04em',
                          backgroundColor: '#F8FAFC',
                        }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sr.requestItems.map((item: RequestItem) => (
                    <tr key={item.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '12px 14px', fontSize: 13, color: '#0f172a', fontWeight: 500 }}>
                        {item.catalogItem?.name ?? item.catalogItemId}
                      </td>
                      <td style={{ padding: '12px 14px', fontSize: 13, color: '#475569' }}>
                        {item.catalogItem?.type ?? '-'}
                      </td>
                      <td style={{ padding: '12px 14px', fontSize: 13, color: '#475569' }}>
                        {item.quantity}
                      </td>
                      <td style={{ padding: '12px 14px' }}>
                        <ItemStateBadge state={item.state} />
                      </td>
                      <td style={{ padding: '12px 14px', fontSize: 13, color: '#475569' }}>
                        {item.tasks?.length ?? 0}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </SectionCard>
        )}

        {sr.requestItems?.some((item) => formatVariables(item.formData ?? item.variables).length > 0 || item.notes) && (
          <SectionCard title="Request Variables" icon={FileText}>
            <div style={{ display: 'grid', gap: 14 }}>
              {sr.requestItems.map((item) => {
                const variables = formatVariables(item.formData ?? item.variables);
                if (variables.length === 0 && !item.notes) return null;
                return (
                  <div key={item.id} style={{ border: '1px solid #e2e8f0', borderRadius: 10, overflow: 'hidden' }}>
                    <div style={{ padding: '10px 14px', background: '#F8FAFC', borderBottom: '1px solid #e2e8f0', fontSize: 13, fontWeight: 700, color: '#0f172a' }}>
                      {item.number} - {item.catalogItem?.name ?? 'Requested item'}
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12, padding: 14 }}>
                      {variables.map(([key, value]) => (
                        <div key={key}>
                          <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 700, marginBottom: 3 }}>{key.replace(/_/g, ' ')}</div>
                          <div style={{ fontSize: 13, color: '#0f172a', whiteSpace: 'pre-wrap' }}>{String(value)}</div>
                        </div>
                      ))}
                      {item.notes && (
                        <div>
                          <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 700, marginBottom: 3 }}>Notes</div>
                          <div style={{ fontSize: 13, color: '#0f172a', whiteSpace: 'pre-wrap' }}>{item.notes}</div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </SectionCard>
        )}

        <SectionCard title="Catalog Tasks" icon={Package}>
          {catalogTasks.length === 0 ? (
            <div style={{ padding: 18, borderRadius: 10, background: '#FFFBEB', border: '1px solid #FDE68A', color: '#92400E', fontSize: 13 }}>
              No SCTASK has been generated yet. If this request needs approval, tasks will appear after approval.
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                    {['Task', 'Short Description', 'Assignment Group', 'Assigned To', 'State', 'Actions'].map((h) => (
                      <th
                        key={h}
                        style={{
                          padding: '10px 14px',
                          textAlign: 'left',
                          fontSize: 12,
                          fontWeight: 600,
                          color: '#64748b',
                          textTransform: 'uppercase',
                          letterSpacing: '0.04em',
                          backgroundColor: '#F8FAFC',
                        }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {catalogTasks.map((task) => (
                    <tr key={task.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '12px 14px', fontSize: 13, color: '#0f172a', fontWeight: 700 }}>{task.number}</td>
                      <td style={{ padding: '12px 14px', fontSize: 13, color: '#475569' }}>{task.shortDescription ?? task.short_description}</td>
                      <td style={{ padding: '12px 14px', fontSize: 13, color: '#475569' }}>{task.assignmentGroup?.name ?? '-'}</td>
                      <td style={{ padding: '12px 14px', fontSize: 13, color: '#475569' }}>
                        {task.assignedTo ? `${task.assignedTo.firstName ?? ''} ${task.assignedTo.lastName ?? ''}`.trim() || task.assignedTo.email : '-'}
                      </td>
                      <td style={{ padding: '12px 14px' }}>
                        <TaskStateBadge state={task.state} />
                      </td>
                      <td style={{ padding: '12px 14px' }}>
                        {canWorkTasks ? (
                          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                            {task.state === 'OPEN' && (
                              <button
                                type="button"
                                onClick={() => handleTaskState(task, 'IN_PROGRESS')}
                                className="sn-soft-button"
                                disabled={updateTask.isPending}
                              >
                                Start
                              </button>
                            )}
                            {task.state !== 'CLOSED_COMPLETE' && (
                              <button
                                type="button"
                                onClick={() => handleTaskState(task, 'CLOSED_COMPLETE')}
                                className="sn-primary-button"
                                disabled={updateTask.isPending}
                              >
                                Complete
                              </button>
                            )}
                          </div>
                        ) : (
                          <span style={{ fontSize: 12, color: '#94a3b8' }}>Read only</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </SectionCard>

        {/* Approval Actions */}
        {canManage('catalog') && !isClient && showApprovalActions && (
          <SectionCard title="Approval" icon={ShieldCheck}>
            {!showRejectForm ? (
              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                <button
                  onClick={handleApprove}
                  disabled={approveRequest.isPending}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '10px 24px',
                    borderRadius: 8,
                    border: 'none',
                    background: 'linear-gradient(135deg, #22C55E, #16A34A)',
                    color: '#ffffff',
                    fontSize: 14,
                    fontWeight: 600,
                    cursor: approveRequest.isPending ? 'not-allowed' : 'pointer',
                    opacity: approveRequest.isPending ? 0.7 : 1,
                    boxShadow: '0 2px 8px rgba(34,197,94,0.3)',
                  }}
                >
                  {approveRequest.isPending ? (
                    <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
                  ) : (
                    <CheckCircle2 size={16} />
                  )}
                  Approve
                </button>
                <button
                  onClick={() => setShowRejectForm(true)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '10px 24px',
                    borderRadius: 8,
                    border: '1px solid #FCA5A5',
                    background: 'rgba(239,68,68,0.06)',
                    color: '#EF4444',
                    fontSize: 14,
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  <XCircle size={16} />
                  Reject
                </button>
              </div>
            ) : (
              <div style={{ maxWidth: 520 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#334155', marginBottom: 8 }}>
                  Rejection Reason
                </label>
                <textarea
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="Please provide a reason for rejecting this service request..."
                  rows={4}
                  style={{
                    width: '100%',
                    padding: '12px 14px',
                    borderRadius: 8,
                    border: '1px solid #e2e8f0',
                    fontSize: 14,
                    color: '#0f172a',
                    backgroundColor: '#F8FAFC',
                    resize: 'vertical',
                    outline: 'none',
                    fontFamily: 'inherit',
                  }}
                />
                <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
                  <button
                    onClick={handleReject}
                    disabled={rejectRequest.isPending || !rejectReason.trim()}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '9px 20px',
                      borderRadius: 8,
                      border: 'none',
                      background: '#EF4444',
                      color: '#ffffff',
                      fontSize: 14,
                      fontWeight: 600,
                      cursor: rejectRequest.isPending || !rejectReason.trim() ? 'not-allowed' : 'pointer',
                      opacity: rejectRequest.isPending || !rejectReason.trim() ? 0.6 : 1,
                    }}
                  >
                    {rejectRequest.isPending ? (
                      <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
                    ) : (
                      <Send size={14} />
                    )}
                    Submit Rejection
                  </button>
                  <button
                    onClick={() => { setShowRejectForm(false); setRejectReason(''); }}
                    style={{
                      padding: '9px 20px',
                      borderRadius: 8,
                      border: '1px solid #e2e8f0',
                      background: '#ffffff',
                      color: '#64748b',
                      fontSize: 14,
                      cursor: 'pointer',
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </SectionCard>
        )}

        {/* Activity Timeline */}
        {sr.activities && sr.activities.length > 0 && (
          <SectionCard title="Activity Timeline" icon={Activity}>
            <div style={{ position: 'relative', paddingLeft: 28 }}>
              {/* Vertical line */}
              <div
                style={{
                  position: 'absolute',
                  left: 9,
                  top: 6,
                  bottom: 6,
                  width: 2,
                  backgroundColor: '#e2e8f0',
                  borderRadius: 1,
                }}
              />
              {sr.activities.map((activity, idx) => (
                <div
                  key={activity.id ?? idx}
                  style={{
                    position: 'relative',
                    paddingBottom: idx < sr.activities!.length - 1 ? 24 : 0,
                  }}
                >
                  {/* Dot */}
                  <div
                    style={{
                      position: 'absolute',
                      left: -23,
                      top: 4,
                      width: 10,
                      height: 10,
                      borderRadius: '50%',
                      backgroundColor: '#6366f1',
                      border: '2px solid #ffffff',
                      boxShadow: '0 0 0 2px #e2e8f0',
                    }}
                  />
                  <div>
                    <div style={{ fontSize: 14, color: '#0f172a', fontWeight: 500 }}>
                      {activity.description ?? activity.action ?? 'Activity'}
                    </div>
                    <div style={{ display: 'flex', gap: 12, marginTop: 4, fontSize: 12, color: '#94a3b8' }}>
                      {activity.user && (
                        <span>{activity.user.firstName} {activity.user.lastName}</span>
                      )}
                      {activity.createdAt && <span>{relativeTime(activity.createdAt)}</span>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>
        )}
      </div>

      {/* Spin keyframe for loader */}
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

export default ServiceRequestDetail;
