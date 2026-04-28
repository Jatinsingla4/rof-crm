import { useState, useRef } from 'react';
import { Card, spacing, colors } from '@rof-crm/design-system';
import { useAISuggestions } from '../../hooks/useCommunication';

interface Props {
  consumerId?: string;
}

export function CommunicationsPage({ consumerId = 'cons-001' }: Props) {
  const [replyText, setReplyText] = useState('');
  const [channel, setChannel] = useState<'email' | 'whatsapp'>('email');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const [suggestionError, setSuggestionError] = useState<string | null>(null);
  const textAreaRef = useRef<HTMLTextAreaElement>(null);

  const aiSuggestionsMutation = useAISuggestions();

  const handleGetSuggestions = async () => {
    if (!replyText.trim()) {
      setSuggestionError('Please enter a customer query first');
      return;
    }

    setSuggestionError(null);
    setIsLoadingSuggestions(true);

    try {
      const result = await aiSuggestionsMutation.mutateAsync({
        consumerId,
        consumerQuery: replyText,
        channel,
      });
      setSuggestions(result || []);
    } catch (error: any) {
      const message = error?.response?.data?.note || error?.message || 'Failed to get suggestions';
      setSuggestionError(message);
      setSuggestions([]);
    } finally {
      setIsLoadingSuggestions(false);
    }
  };

  const handleUseSuggestion = (suggestion: string) => {
    setReplyText(suggestion);
    setSuggestions([]);
    if (textAreaRef.current) {
      textAreaRef.current.focus();
    }
  };

  const handleSendReply = () => {
    if (!replyText.trim()) return;
    // TODO: Implement actual send logic when API is fully integrated
    console.log(`Sending ${channel} reply:`, replyText);
    setReplyText('');
    setSuggestions([]);
  };

  return (
    <div>
      <h1 style={{ fontSize: '32px', fontWeight: 700, marginBottom: spacing.lg }}>Communications</h1>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: spacing.lg,
        }}
      >
        {/* Remarks Timeline */}
        <Card variant="elevated">
          <div style={{ padding: spacing.lg }}>
            <h2 style={{ fontSize: '18px', fontWeight: 600, marginBottom: spacing.md }}>
              Communication History
            </h2>
            <div
              style={{
                height: '300px',
                overflowY: 'auto',
                borderTop: `1px solid ${colors.neutral[200]}`,
                paddingTop: spacing.md,
              }}
            >
              <p style={{ color: colors.neutral[500], textAlign: 'center', marginTop: spacing.lg }}>
                Communication history will be displayed here
              </p>
            </div>
          </div>
        </Card>

        {/* Reply Composer with AI Suggestions */}
        <Card variant="elevated">
          <div style={{ padding: spacing.lg }}>
            <h2 style={{ fontSize: '18px', fontWeight: 600, marginBottom: spacing.md }}>
              Compose Reply
            </h2>

            {/* Channel Selector */}
            <div style={{ marginBottom: spacing.md }}>
              <label style={{ display: 'block', fontWeight: 500, marginBottom: spacing.sm }}>
                Channel
              </label>
              <select
                value={channel}
                onChange={(e) => {
                  setChannel(e.target.value as 'email' | 'whatsapp');
                  setSuggestions([]);
                }}
                style={{
                  width: '100%',
                  padding: spacing.sm,
                  border: `1px solid ${colors.neutral[300]}`,
                  borderRadius: '4px',
                  fontSize: '14px',
                }}
              >
                <option value="email">📧 Email</option>
                <option value="whatsapp">💬 WhatsApp</option>
              </select>
            </div>

            {/* Reply Text Area */}
            <div style={{ marginBottom: spacing.md }}>
              <label style={{ display: 'block', fontWeight: 500, marginBottom: spacing.sm }}>
                Message
              </label>
              <textarea
                ref={textAreaRef}
                value={replyText}
                onChange={(e) => {
                  setReplyText(e.target.value);
                  setSuggestionError(null);
                }}
                placeholder="Type your reply here..."
                style={{
                  width: '100%',
                  minHeight: '100px',
                  padding: spacing.sm,
                  border: `1px solid ${colors.neutral[300]}`,
                  borderRadius: '4px',
                  fontSize: '14px',
                  fontFamily: 'monospace',
                  resize: 'vertical',
                }}
              />
            </div>

            {/* AI Suggestions Button */}
            <div style={{ marginBottom: spacing.lg }}>
              <button
                onClick={handleGetSuggestions}
                disabled={isLoadingSuggestions || !replyText.trim()}
                style={{
                  padding: `${spacing.sm} ${spacing.md}`,
                  background: '#722ED1',
                  color: '#FFFFFF',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: isLoadingSuggestions || !replyText.trim() ? 'not-allowed' : 'pointer',
                  opacity: isLoadingSuggestions || !replyText.trim() ? 0.6 : 1,
                  fontWeight: 500,
                  fontSize: '14px',
                }}
              >
                {isLoadingSuggestions ? '✨ Generating suggestions...' : '✨ Get AI Suggestions'}
              </button>
            </div>

            {/* Error Message */}
            {suggestionError && (
              <div
                style={{
                  padding: spacing.md,
                  background: '#FFF1F0',
                  border: '1px solid #FFCCC7',
                  borderRadius: '4px',
                  color: '#820014',
                  marginBottom: spacing.md,
                  fontSize: '13px',
                }}
              >
                {suggestionError}
              </div>
            )}

            {/* Suggestions Display */}
            {suggestions.length > 0 && (
              <div
                style={{
                  marginBottom: spacing.md,
                  paddingTop: spacing.md,
                  borderTop: `1px solid ${colors.neutral[200]}`,
                }}
              >
                <p style={{ fontSize: '12px', fontWeight: 600, color: colors.neutral[600], marginBottom: spacing.sm }}>
                  AI SUGGESTIONS ({suggestions.length})
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.sm }}>
                  {suggestions.map((suggestion, idx) => (
                    <div
                      key={idx}
                      style={{
                        padding: spacing.md,
                        background: '#F9F0FF',
                        border: '1px solid #F3D0FF',
                        borderRadius: '4px',
                      }}
                    >
                      <p
                        style={{
                          margin: 0,
                          marginBottom: spacing.sm,
                          fontSize: '13px',
                          lineHeight: '1.5',
                          color: colors.neutral[800],
                        }}
                      >
                        {suggestion}
                      </p>
                      <button
                        onClick={() => handleUseSuggestion(suggestion)}
                        style={{
                          padding: '4px 12px',
                          background: '#52C41A',
                          color: '#FFFFFF',
                          border: 'none',
                          borderRadius: '3px',
                          cursor: 'pointer',
                          fontSize: '12px',
                          fontWeight: 500,
                        }}
                      >
                        ✓ Use This
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Send Button */}
            <button
              onClick={handleSendReply}
              disabled={!replyText.trim()}
              style={{
                width: '100%',
                padding: spacing.md,
                background: '#52C41A',
                color: '#FFFFFF',
                border: 'none',
                borderRadius: '4px',
                cursor: !replyText.trim() ? 'not-allowed' : 'pointer',
                opacity: !replyText.trim() ? 0.6 : 1,
                fontWeight: 600,
                fontSize: '14px',
              }}
            >
              Send Reply
            </button>
          </div>
        </Card>
      </div>
    </div>
  );
}
