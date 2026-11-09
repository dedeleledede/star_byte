import React from 'react';

interface PlainTextRendererProps {
  content: string;
  sender?: string;
  timestamp?: string;
}

export const PlainTextRenderer: React.FC<PlainTextRendererProps> = ({ content, sender, timestamp }) => {
  return (
    <div style={{ fontFamily: 'monospace', fontSize: '0.9rem', padding: '2px 0' }}>
      {timestamp && <span style={{ color: '#888', marginRight: '6px' }}>[{timestamp}]</span>}
      {sender && <span style={{ fontWeight: 'bold', marginRight: '6px' }}>{"<"}{sender}{">"}</span>}
      <span>{content}</span>
    </div>
  );
};