import React, { useState } from 'react';
import {
  useSendEmail,
  useSendWhatsApp,
  useSendSMS,
  useTickets,
  useCreateTicket,
  useUpdateTicket,
  useAISuggestions,
} from '../hooks';
import { useCommunicationRemarks, useAddCommunicationRemark } from '../hooks/useCommunication';
import { Button, Card, Timeline, DataTable, LoadingSkeleton } from '@rof-crm/design-system';
import { colors, spacing } from '@rof-crm/design-system/theme';

const CHANNELS = ['call', 'email', 'whatsapp', 'sms', 'chat', 'in_person', 'system'] as const;

export function CommunicationsPage({ consumerId }: { consumerId: string }) {
  const [activeTab, setActiveTab] = useState<'remarks' | 'compose' | 'tickets'>('remarks');
  const [selectedChannel, setSelectedChannel] = useState<typeof CHANNELS[number]>('email');
  const [showNewRemarkForm, setShowNewRemarkForm] = useState(false);
  const [showNewTicketForm, setShowNewTicketForm] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<string[]>([]);

  // Fetch data
  const { data: remarks, isLoading: remarksLoading } = useCommunicationRemarks(consumerId);
  const { data: tickets, isLoading: ticketsLoading } = useTickets({ pageSize: 50 });

  // Mutations
  const addRemarkMutation = useAddCommunicationRemark();
  const sendEmailMutation = useSendEmail();
  const sendWhatsAppMutation = useSendWhatsApp();
  const sendSmsMutation = useSendSMS();
  const createTicketMutation = useCreateTicket();
  const updateTicketMutation = useUpdateTicket();
  const aiSuggestionsMutation = useAISuggestions();

  // Convert remarks to timeline format
  const timelineEntries = React.useMemo(() => {
    return (remarks || []).map((remark: any) => ({
      id: remark.id,
      timestamp: new Date(remark.timestamp),
      title: remark.subject || remark.channel,
      description: remark.notes,
      color: {
        call: 'info',
        email: 'info',
        whatsapp: 'success',
        sms: 'info',
        chat: 'success',
        in_person: 'warning',
        system: 'default',
      }[remark.channel] as any,
      tags: remark.tags || [remark.channel],
    }));
  }, [remarks]);

  const handleAddRemark = async (data: any) => {
    try {
      await addRemarkMutation.mutateAsync({
        consumerId,
        data,
      });
      setShowNewRemarkForm(false);
    } catch (err) {
      console.error('Failed to add remark:', err);
    }
  };

  const handleGetAISuggestions = async () => {
    try {
      const suggestions = await aiSuggestionsMutation.mutateAsync({
        consumerId,
        context: selectedChannel,
      });
      setAiSuggestions(suggestions);
    } catch (err) {
      console.error('Failed to get suggestions:', err);
    }
  };

  const ticketColumns = [
    { id: 'subject', header: 'Subject', accessorKey: 'subject' },
    {
      id: 'priority',
      header: 'Priority',
      accessorKey: 'priority',
      cell: (value: string) => (
        <span
          style={{
            padding: '4px 8px',
            borderRadius: 4,
            backgroundColor: {
              low: colors.info[50],
              medium: colors.warning[50],
              high: colors.error[50],
              critical: colors.error[100],
            }[value] || colors.neutral[50],
            color: {
              low: colors.info[700],
              medium: colors.warning[700],
              high: colors.error[700],
              critical: colors.error[700],
            }[value] || colors.neutral[700],
            fontSize: '12px',
            fontWeight: 600,
          }}
        >
          {value.toUpperCase()}
        </span>
      ),
    },
    {
      id: 'status',
      header: 'Status',
      accessorKey: 'status',
      cell: (value: string) => (
        <span
          style={{
            padding: '4px 8px',
            borderRadius: 4,
            backgroundColor: {
              open: colors.warning[50],
              in_progress: colors.info[50],
              resolved: colors.success[50],
              closed: colors.neutral[50],
            }[value] || colors.neutral[50],
            color: {
              open: colors.warning[700],
              in_progress: colors.info[700],
              resolved: colors.success[700],
              closed: colors.neutral[700],
            }[value] || colors.neutral[700],
            fontSize: '12px',
            fontWeight: 600,
          }}
        >
          {value.replace(/_/g, ' ').toUpperCase()}
        </span>
      ),
    },
    { id: 'createdAt', header: 'Created', accessorKey: 'created_at' },
  ];

  return (
    <div style={{ padding: spacing.lg }}>
      <h1 style={{ marginTop: 0 }}>Communications Center</h1>

      {/* Tabs */}
      <div
        style={{
          display: 'flex',
          gap: spacing.md,
          marginBottom: spacing.lg,
          borderBottom: `1px solid ${colors.neutral[200]}`,
        }}
      >
        {(['remarks', 'compose', 'tickets'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: `${spacing.md} ${spacing.lg}`,
              border: 'none',
              backgroundColor: 'transparent',
              borderBottom: activeTab === tab ? `2px solid ${colors.primary[600]}` : 'none',
              color: activeTab === tab ? colors.primary[600] : colors.neutral[600],
              fontWeight: activeTab === tab ? 600 : 400,
              cursor: 'pointer',
              fontSize: '14px',
            }}
          >
            {tab === 'remarks' && 'Remarks Log'}
            {tab === 'compose' && 'Compose Message'}
            {tab === 'tickets' && 'Support Tickets'}
          </button>
        ))}
      </div>

      {/* Remarks Tab */}
      {activeTab === 'remarks' && (
        <>
          <div style={{ marginBottom: spacing.lg }}>
            <Button variant="primary" onClick={() => setShowNewRemarkForm(true)}>
              Add Remark
            </Button>
          </div>

          {remarksLoading ? (
            <LoadingSkeleton height={400} />
          ) : timelineEntries.length > 0 ? (
            <Card>
              <Timeline entries={timelineEntries} />
            </Card>
          ) : (
            <Card>
              <div style={{ padding: spacing.lg, textAlign: 'center', color: colors.neutral[600] }}>
                No remarks recorded
              </div>
            </Card>
          )}

          {showNewRemarkForm && (
            <RemarkForm
              onSubmit={handleAddRemark}
              onCancel={() => setShowNewRemarkForm(false)}
              isLoading={addRemarkMutation.isPending}
            />
          )}
        </>
      )}

      {/* Compose Tab */}
      {activeTab === 'compose' && (
        <ComposeMessagePanel
          consumerId={consumerId}
          selectedChannel={selectedChannel}
          setSelectedChannel={setSelectedChannel}
          sendEmailMutation={sendEmailMutation}
          sendWhatsAppMutation={sendWhatsAppMutation}
          sendSmsMutation={sendSmsMutation}
          aiSuggestions={aiSuggestions}
          onGetSuggestions={handleGetAISuggestions}
          aiLoading={aiSuggestionsMutation.isPending}
        />
      )}

      {/* Tickets Tab */}
      {activeTab === 'tickets' && (
        <>
          <div style={{ marginBottom: spacing.lg }}>
            <Button variant="primary" onClick={() => setShowNewTicketForm(true)}>
              Create Ticket
            </Button>
          </div>

          {ticketsLoading ? (
            <LoadingSkeleton height={300} />
          ) : tickets && tickets.length > 0 ? (
            <Card>
              <DataTable columns={ticketColumns} data={tickets} selectable sortable />
            </Card>
          ) : (
            <Card>
              <div style={{ padding: spacing.lg, textAlign: 'center', color: colors.neutral[600] }}>
                No tickets
              </div>
            </Card>
          )}

          {showNewTicketForm && (
            <TicketForm
              consumerId={consumerId}
              onSubmit={async (data) => {
                await createTicketMutation.mutateAsync(data);
                setShowNewTicketForm(false);
              }}
              onCancel={() => setShowNewTicketForm(false)}
              isLoading={createTicketMutation.isPending}
            />
          )}
        </>
      )}
    </div>
  );
}

interface ComposeMessagePanelProps {
  consumerId: string;
  selectedChannel: string;
  setSelectedChannel: (channel: string) => void;
  sendEmailMutation: any;
  sendWhatsAppMutation: any;
  sendSmsMutation: any;
  aiSuggestions: string[];
  onGetSuggestions: () => void;
  aiLoading: boolean;
}

function ComposeMessagePanel({
  consumerId,
  selectedChannel,
  setSelectedChannel,
  sendEmailMutation,
  sendWhatsAppMutation,
  sendSmsMutation,
  aiSuggestions,
  onGetSuggestions,
  aiLoading,
}: ComposeMessagePanelProps) {
  const [message, setMessage] = useState('');
  const [recipient, setRecipient] = useState('');
  const [subject, setSubject] = useState('');

  const handleSendMessage = async () => {
    try {
      const data = {
        consumerId,
        message,
        subject: selectedChannel === 'email' ? subject : undefined,
      };

      if (selectedChannel === 'email') {
        await sendEmailMutation.mutateAsync({
          ...data,
          recipientEmail: recipient,
        });
      } else if (selectedChannel === 'whatsapp') {
        await sendWhatsAppMutation.mutateAsync({
          ...data,
          recipientPhone: recipient,
        });
      } else if (selectedChannel === 'sms') {
        await sendSmsMutation.mutateAsync({
          ...data,
          recipientPhone: recipient,
        });
      }

      setMessage('');
      setRecipient('');
      setSubject('');
    } catch (err) {
      console.error('Failed to send message:', err);
    }
  };

  return (
    <Card>
      <h2>Compose Message</h2>

      {/* Channel Selection */}
      <div style={{ marginBottom: spacing.lg }}>
        <label style={{ display: 'block', marginBottom: spacing.sm, fontWeight: 600 }}>
          Channel
        </label>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: spacing.md }}>
          {['email', 'whatsapp', 'sms'].map((channel) => (
            <button
              key={channel}
              onClick={() => setSelectedChannel(channel)}
              style={{
                padding: spacing.md,
                borderRadius: 8,
                border: `2px solid ${selectedChannel === channel ? colors.primary[600] : colors.neutral[200]}`,
                backgroundColor:
                  selectedChannel === channel ? colors.primary[50] : colors.neutral[50],
                cursor: 'pointer',
                fontWeight: 600,
                color: selectedChannel === channel ? colors.primary[600] : colors.neutral[600],
              }}
            >
              {channel === 'email' && '📧 Email'}
              {channel === 'whatsapp' && '💬 WhatsApp'}
              {channel === 'sms' && '📱 SMS'}
            </button>
          ))}
        </div>
      </div>

      {/* Recipient */}
      <div style={{ marginBottom: spacing.lg }}>
        <label style={{ display: 'block', marginBottom: spacing.sm, fontWeight: 600 }}>
          {selectedChannel === 'email' ? 'Email Address' : 'Phone Number'}
        </label>
        <input
          type={selectedChannel === 'email' ? 'email' : 'tel'}
          value={recipient}
          onChange={(e) => setRecipient(e.target.value)}
          placeholder={selectedChannel === 'email' ? 'recipient@example.com' : '+91 XXXXXXXXXX'}
          style={{
            width: '100%',
            padding: spacing.md,
            borderRadius: 6,
            border: `1px solid ${colors.neutral[300]}`,
            fontSize: '14px',
          }}
        />
      </div>

      {/* Subject (email only) */}
      {selectedChannel === 'email' && (
        <div style={{ marginBottom: spacing.lg }}>
          <label style={{ display: 'block', marginBottom: spacing.sm, fontWeight: 600 }}>
            Subject
          </label>
          <input
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Message subject"
            style={{
              width: '100%',
              padding: spacing.md,
              borderRadius: 6,
              border: `1px solid ${colors.neutral[300]}`,
              fontSize: '14px',
            }}
          />
        </div>
      )}

      {/* Message */}
      <div style={{ marginBottom: spacing.lg }}>
        <label style={{ display: 'block', marginBottom: spacing.sm, fontWeight: 600 }}>
          Message
        </label>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Type your message..."
          style={{
            width: '100%',
            padding: spacing.md,
            borderRadius: 6,
            border: `1px solid ${colors.neutral[300]}`,
            minHeight: 150,
            fontSize: '14px',
            fontFamily: 'inherit',
          }}
        />
      </div>

      {/* AI Suggestions */}
      <Card style={{ backgroundColor: colors.info[50], marginBottom: spacing.lg }}>
        <h3 style={{ marginTop: 0, color: colors.info[700] }}>AI-Assisted Suggestions</h3>
        <Button variant="secondary" onClick={onGetSuggestions} disabled={aiLoading} style={{ marginBottom: spacing.md }}>
          {aiLoading ? 'Getting suggestions...' : 'Get Suggestions'}
        </Button>
        {aiSuggestions.length > 0 && (
          <div style={{ display: 'grid', gap: spacing.sm }}>
            {aiSuggestions.map((suggestion, idx) => (
              <button
                key={idx}
                onClick={() => setMessage(suggestion)}
                style={{
                  padding: spacing.md,
                  borderRadius: 6,
                  backgroundColor: 'white',
                  border: `1px solid ${colors.info[200]}`,
                  textAlign: 'left',
                  cursor: 'pointer',
                  color: colors.neutral[700],
                  fontSize: '13px',
                  transition: 'all 200ms',
                }}
                onMouseOver={(e) => {
                  (e.target as HTMLButtonElement).style.backgroundColor = colors.info[100];
                }}
                onMouseOut={(e) => {
                  (e.target as HTMLButtonElement).style.backgroundColor = 'white';
                }}
              >
                {suggestion}
              </button>
            ))}
          </div>
        )}
      </Card>

      {/* Send Button */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: spacing.md }}>
        <Button variant="primary" onClick={handleSendMessage} disabled={!message || !recipient}>
          Send Message
        </Button>
      </div>
    </Card>
  );
}

interface RemarkFormProps {
  onSubmit: (data: any) => void;
  onCancel: () => void;
  isLoading: boolean;
}

function RemarkForm({ onSubmit, onCancel, isLoading }: RemarkFormProps) {
  const [formData, setFormData] = useState({
    channel: 'call',
    subject: '',
    notes: '',
    followUpDate: '',
    tags: [],
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Card
        style={{
          width: '90%',
          maxWidth: 500,
          padding: spacing.lg,
        }}
      >
        <h2 style={{ marginTop: 0 }}>Add Remark</h2>
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: spacing.md }}>
            <label>Channel*</label>
            <select
              value={formData.channel}
              onChange={(e) => setFormData({ ...formData, channel: e.target.value })}
              style={{
                width: '100%',
                padding: `${spacing.sm} ${spacing.md}`,
                marginTop: spacing.sm,
                borderRadius: 4,
                border: `1px solid ${colors.neutral[300]}`,
              }}
            >
              {CHANNELS.map((ch) => (
                <option key={ch} value={ch}>
                  {ch.replace(/_/g, ' ').toUpperCase()}
                </option>
              ))}
            </select>
          </div>

          <div style={{ marginBottom: spacing.md }}>
            <label>Subject</label>
            <input
              type="text"
              value={formData.subject}
              onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
              style={{
                width: '100%',
                padding: `${spacing.sm} ${spacing.md}`,
                marginTop: spacing.sm,
                borderRadius: 4,
                border: `1px solid ${colors.neutral[300]}`,
              }}
            />
          </div>

          <div style={{ marginBottom: spacing.md }}>
            <label>Notes</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              style={{
                width: '100%',
                padding: `${spacing.sm} ${spacing.md}`,
                marginTop: spacing.sm,
                borderRadius: 4,
                border: `1px solid ${colors.neutral[300]}`,
                minHeight: 100,
              }}
            />
          </div>

          <div style={{ marginBottom: spacing.md }}>
            <label>Follow-up Date</label>
            <input
              type="date"
              value={formData.followUpDate}
              onChange={(e) => setFormData({ ...formData, followUpDate: e.target.value })}
              style={{
                width: '100%',
                padding: `${spacing.sm} ${spacing.md}`,
                marginTop: spacing.sm,
                borderRadius: 4,
                border: `1px solid ${colors.neutral[300]}`,
              }}
            />
          </div>

          <div style={{ display: 'flex', gap: spacing.md, justifyContent: 'flex-end' }}>
            <Button variant="secondary" onClick={onCancel} disabled={isLoading}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" disabled={isLoading}>
              {isLoading ? 'Saving...' : 'Save Remark'}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}

interface TicketFormProps {
  consumerId: string;
  onSubmit: (data: any) => void;
  onCancel: () => void;
  isLoading: boolean;
}

function TicketForm({ consumerId, onSubmit, onCancel, isLoading }: TicketFormProps) {
  const [formData, setFormData] = useState({
    consumerId,
    subject: '',
    description: '',
    priority: 'medium',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Card
        style={{
          width: '90%',
          maxWidth: 500,
          padding: spacing.lg,
        }}
      >
        <h2 style={{ marginTop: 0 }}>Create Support Ticket</h2>
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: spacing.md }}>
            <label>Subject*</label>
            <input
              type="text"
              value={formData.subject}
              onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
              required
              style={{
                width: '100%',
                padding: `${spacing.sm} ${spacing.md}`,
                marginTop: spacing.sm,
                borderRadius: 4,
                border: `1px solid ${colors.neutral[300]}`,
              }}
            />
          </div>

          <div style={{ marginBottom: spacing.md }}>
            <label>Description*</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              required
              style={{
                width: '100%',
                padding: `${spacing.sm} ${spacing.md}`,
                marginTop: spacing.sm,
                borderRadius: 4,
                border: `1px solid ${colors.neutral[300]}`,
                minHeight: 100,
              }}
            />
          </div>

          <div style={{ marginBottom: spacing.md }}>
            <label>Priority</label>
            <select
              value={formData.priority}
              onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
              style={{
                width: '100%',
                padding: `${spacing.sm} ${spacing.md}`,
                marginTop: spacing.sm,
                borderRadius: 4,
                border: `1px solid ${colors.neutral[300]}`,
              }}
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </select>
          </div>

          <div style={{ display: 'flex', gap: spacing.md, justifyContent: 'flex-end' }}>
            <Button variant="secondary" onClick={onCancel} disabled={isLoading}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" disabled={isLoading}>
              {isLoading ? 'Creating...' : 'Create Ticket'}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
