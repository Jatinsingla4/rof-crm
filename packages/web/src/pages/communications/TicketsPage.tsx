import { useState, useEffect } from 'react';
import { Card, LoadingSkeleton } from '@rof-crm/design-system';
import { colors, spacing } from '@rof-crm/design-system/theme';
import { apiClient } from '../../api/client';

interface Ticket {
  id: string;
  consumer_id: string;
  consumer_name: string;
  subject: string;
  description: string;
  priority: string;
  status: string;
  created_at: string;
  updated_at: string;
  assigned_to?: string;
}

interface TicketFormData {
  consumerId: string;
  subject: string;
  description: string;
  priority: string;
}

interface CreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: TicketFormData) => void;
  isLoading: boolean;
}

function CreateTicketModal({ isOpen, onClose, onSubmit, isLoading }: CreateModalProps) {
  const [formData, setFormData] = useState<TicketFormData>({
    consumerId: '',
    subject: '',
    description: '',
    priority: 'medium',
  });

  if (!isOpen) return null;

  const handleSubmit = () => {
    if (formData.consumerId && formData.subject && formData.description) {
      onSubmit(formData);
      setFormData({ consumerId: '', subject: '', description: '', priority: 'medium' });
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
      onClick={onClose}
    >
      <Card
        style={{
          width: '90%',
          maxWidth: '500px',
          background: '#FFFFFF',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ padding: spacing.lg }}>
          <h2 style={{ fontSize: '18px', fontWeight: 600, marginTop: 0, marginBottom: spacing.md }}>
            Create Support Ticket
          </h2>

          <div style={{ marginBottom: spacing.md }}>
            <label style={{ display: 'block', fontWeight: 500, marginBottom: spacing.sm }}>
              Consumer ID
            </label>
            <input
              type="text"
              placeholder="Enter consumer ID"
              value={formData.consumerId}
              onChange={(e) => setFormData({ ...formData, consumerId: e.target.value })}
              style={{
                width: '100%',
                padding: spacing.sm,
                border: `1px solid ${colors.neutral[300]}`,
                borderRadius: '4px',
                fontSize: '14px',
              }}
            />
          </div>

          <div style={{ marginBottom: spacing.md }}>
            <label style={{ display: 'block', fontWeight: 500, marginBottom: spacing.sm }}>
              Subject
            </label>
            <input
              type="text"
              placeholder="Ticket subject"
              value={formData.subject}
              onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
              style={{
                width: '100%',
                padding: spacing.sm,
                border: `1px solid ${colors.neutral[300]}`,
                borderRadius: '4px',
                fontSize: '14px',
              }}
            />
          </div>

          <div style={{ marginBottom: spacing.md }}>
            <label style={{ display: 'block', fontWeight: 500, marginBottom: spacing.sm }}>
              Description
            </label>
            <textarea
              placeholder="Ticket description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              style={{
                width: '100%',
                minHeight: '80px',
                padding: spacing.sm,
                border: `1px solid ${colors.neutral[300]}`,
                borderRadius: '4px',
                fontSize: '14px',
                fontFamily: 'monospace',
                resize: 'vertical',
              }}
            />
          </div>

          <div style={{ marginBottom: spacing.lg }}>
            <label style={{ display: 'block', fontWeight: 500, marginBottom: spacing.sm }}>
              Priority
            </label>
            <select
              value={formData.priority}
              onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
              style={{
                width: '100%',
                padding: spacing.sm,
                border: `1px solid ${colors.neutral[300]}`,
                borderRadius: '4px',
                fontSize: '14px',
              }}
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
          </div>

          <div style={{ display: 'flex', gap: spacing.md, justifyContent: 'flex-end' }}>
            <button
              onClick={onClose}
              disabled={isLoading}
              style={{
                padding: `${spacing.sm} ${spacing.md}`,
                background: colors.neutral[200],
                color: colors.neutral[800],
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontWeight: 500,
                fontSize: '14px',
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={isLoading || !formData.consumerId || !formData.subject}
              style={{
                padding: `${spacing.sm} ${spacing.md}`,
                background: '#1890FF',
                color: '#FFFFFF',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: '14px',
                opacity: isLoading || !formData.consumerId || !formData.subject ? 0.6 : 1,
              }}
            >
              {isLoading ? 'Creating...' : 'Create Ticket'}
            </button>
          </div>
        </div>
      </Card>
    </div>
  );
}

export function TicketsPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('');

  // Fetch tickets on mount
  useEffect(() => {
    fetchTickets();
  }, []);

  const fetchTickets = async () => {
    setIsLoading(true);
    try {
      const response = await apiClient.get('/communications/tickets');
      if (response.data.success) {
        setTickets(response.data.data || []);
      }
    } catch (error) {
      console.error('Failed to fetch tickets:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateTicket = async (formData: TicketFormData) => {
    setIsCreating(true);
    try {
      const response = await apiClient.post('/communications/tickets', formData);
      if (response.data.success) {
        await fetchTickets();
        setShowCreateModal(false);
      }
    } catch (error) {
      console.error('Failed to create ticket:', error);
    } finally {
      setIsCreating(false);
    }
  };

  const filteredTickets = statusFilter
    ? tickets.filter((t) => t.status === statusFilter)
    : tickets;

  const statusColors: { [key: string]: { bg: string; text: string } } = {
    open: { bg: '#FFF1F0', text: '#820014' },
    in_progress: { bg: '#FFFBE6', text: '#6F4E37' },
    resolved: { bg: '#E6FFED', text: '#274916' },
    closed: { bg: '#F5F5F5', text: '#595959' },
  };

  const priorityColors: { [key: string]: string } = {
    low: '#52C41A',
    medium: '#FAAD14',
    high: '#F5222D',
    urgent: '#AA0000',
  };

  return (
    <div style={{ padding: spacing.lg }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.lg }}>
        <h1 style={{ marginTop: 0 }}>Support Tickets</h1>
        <button
          onClick={() => setShowCreateModal(true)}
          style={{
            padding: `${spacing.sm} ${spacing.md}`,
            background: '#1890FF',
            color: '#FFFFFF',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontWeight: 600,
            fontSize: '14px',
          }}
        >
          + Create Ticket
        </button>
      </div>

      {/* Filter */}
      <div style={{ marginBottom: spacing.lg }}>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          style={{
            padding: spacing.sm,
            border: `1px solid ${colors.neutral[300]}`,
            borderRadius: '4px',
            fontSize: '13px',
          }}
        >
          <option value="">All Statuses</option>
          <option value="open">Open</option>
          <option value="in_progress">In Progress</option>
          <option value="resolved">Resolved</option>
          <option value="closed">Closed</option>
        </select>
      </div>

      {/* Tickets Table */}
      {isLoading ? (
        <Card>
          <div style={{ padding: spacing.lg }}>
            <LoadingSkeleton height={200} />
          </div>
        </Card>
      ) : filteredTickets.length === 0 ? (
        <Card>
          <div style={{ padding: spacing.lg, textAlign: 'center', color: colors.neutral[600] }}>
            No tickets found
          </div>
        </Card>
      ) : (
        <Card>
          <div style={{ padding: spacing.lg }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr style={{ borderBottom: `2px solid ${colors.neutral[200]}` }}>
                    <th style={{ textAlign: 'left', padding: spacing.md }}>Subject</th>
                    <th style={{ textAlign: 'left', padding: spacing.md }}>Consumer</th>
                    <th style={{ textAlign: 'center', padding: spacing.md }}>Priority</th>
                    <th style={{ textAlign: 'center', padding: spacing.md }}>Status</th>
                    <th style={{ textAlign: 'center', padding: spacing.md }}>Created</th>
                    <th style={{ textAlign: 'left', padding: spacing.md }}>Assigned To</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTickets.map((ticket) => {
                    const statusColor = statusColors[ticket.status] || statusColors['open'];

                    return (
                      <tr
                        key={ticket.id}
                        onClick={() => setSelectedTicket(ticket)}
                        style={{
                          borderBottom: `1px solid ${colors.neutral[100]}`,
                          cursor: 'pointer',
                          background: selectedTicket?.id === ticket.id ? '#F0F5FF' : 'transparent',
                        }}
                      >
                        <td style={{ padding: spacing.md, fontWeight: 500 }}>
                          {ticket.subject}
                        </td>
                        <td style={{ padding: spacing.md }}>
                          {ticket.consumer_name}
                        </td>
                        <td style={{ textAlign: 'center', padding: spacing.md }}>
                          <span
                            style={{
                              display: 'inline-block',
                              width: '12px',
                              height: '12px',
                              borderRadius: '50%',
                              background: priorityColors[ticket.priority] || '#999',
                            }}
                            title={ticket.priority}
                          />
                        </td>
                        <td style={{ textAlign: 'center', padding: spacing.md }}>
                          <span
                            style={{
                              display: 'inline-block',
                              padding: '4px 8px',
                              background: statusColor.bg,
                              color: statusColor.text,
                              borderRadius: '3px',
                              fontSize: '11px',
                              fontWeight: 600,
                              textTransform: 'capitalize',
                            }}
                          >
                            {ticket.status.replace(/_/g, ' ')}
                          </span>
                        </td>
                        <td style={{ textAlign: 'center', padding: spacing.md }}>
                          {new Date(ticket.created_at).toLocaleDateString('en-IN', {
                            year: '2-digit',
                            month: '2-digit',
                            day: '2-digit',
                          })}
                        </td>
                        <td style={{ padding: spacing.md }}>
                          {ticket.assigned_to || '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </Card>
      )}

      {/* Detail View */}
      {selectedTicket && (
        <Card style={{ marginTop: spacing.lg }}>
          <div style={{ padding: spacing.lg }}>
            <div style={{ marginBottom: spacing.md }}>
              <button
                onClick={() => setSelectedTicket(null)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: colors.primary[500],
                  cursor: 'pointer',
                  fontSize: '14px',
                  textDecoration: 'underline',
                  marginBottom: spacing.md,
                }}
              >
                ← Back to list
              </button>
            </div>

            <h2 style={{ fontSize: '18px', fontWeight: 600, marginTop: 0, marginBottom: spacing.md }}>
              {selectedTicket.subject}
            </h2>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: spacing.md, marginBottom: spacing.lg }}>
              <div>
                <div style={{ fontSize: '12px', fontWeight: 600, marginBottom: spacing.sm, color: colors.neutral[600] }}>
                  CONSUMER
                </div>
                <div style={{ fontSize: '14px' }}>{selectedTicket.consumer_name}</div>
              </div>
              <div>
                <div style={{ fontSize: '12px', fontWeight: 600, marginBottom: spacing.sm, color: colors.neutral[600] }}>
                  PRIORITY
                </div>
                <span
                  style={{
                    display: 'inline-block',
                    padding: '4px 8px',
                    background: priorityColors[selectedTicket.priority],
                    color: '#FFFFFF',
                    borderRadius: '3px',
                    fontSize: '12px',
                    fontWeight: 600,
                    textTransform: 'capitalize',
                  }}
                >
                  {selectedTicket.priority}
                </span>
              </div>
            </div>

            <div style={{ marginBottom: spacing.lg }}>
              <div style={{ fontSize: '12px', fontWeight: 600, marginBottom: spacing.sm, color: colors.neutral[600] }}>
                DESCRIPTION
              </div>
              <div style={{ fontSize: '14px', lineHeight: 1.6, color: colors.neutral[800] }}>
                {selectedTicket.description}
              </div>
            </div>

            <div style={{ paddingTop: spacing.md, borderTop: `1px solid ${colors.neutral[300]}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: colors.neutral[600] }}>
                <span>Created: {new Date(selectedTicket.created_at).toLocaleString('en-IN')}</span>
                <span>Status: {selectedTicket.status.replace(/_/g, ' ')}</span>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Modal */}
      <CreateTicketModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSubmit={handleCreateTicket}
        isLoading={isCreating}
      />
    </div>
  );
}
