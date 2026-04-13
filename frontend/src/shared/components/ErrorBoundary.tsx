import React, { Component, ErrorInfo, ReactNode } from 'react';
import { MessageStrip, Button, Text } from '@ui5/webcomponents-react';

interface Props {
  children: ReactNode;
  moduleName?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
  showDetails: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null, showDetails: false };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, showDetails: false };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`[ErrorBoundary] ${this.props.moduleName ?? 'unknown'}:`, error, info);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div style={{ padding: '2rem', maxWidth: 600 }}>
        <MessageStrip design="Negative" hideCloseButton style={{ marginBottom: '1rem' }}>
          <strong>Etwas ist schiefgelaufen</strong>
          {this.props.moduleName && ` – Modul: ${this.props.moduleName}`}
        </MessageStrip>
        <Text>
          In diesem Modul ist ein unerwarteter Fehler aufgetreten.
          Andere Module sind weiterhin verfügbar.
        </Text>
        <div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem' }}>
          <Button
            design="Emphasized"
            onClick={() => this.setState({ hasError: false, error: null, showDetails: false })}
          >
            Neu laden
          </Button>
          <Button
            design="Transparent"
            onClick={() => this.setState(s => ({ ...s, showDetails: !s.showDetails }))}
          >
            {this.state.showDetails ? 'Details verbergen' : 'Fehlerdetails'}
          </Button>
        </div>
        {this.state.showDetails && this.state.error && (
          <pre style={{
            marginTop: '1rem',
            padding: '0.75rem',
            background: 'var(--sapNeutralBackground)',
            border: '1px solid var(--sapNeutralBorderColor)',
            borderRadius: '0.25rem',
            fontSize: '0.75rem',
            overflowX: 'auto',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-all',
          }}>
            {this.state.error.name}: {this.state.error.message}
            {'\n\n'}
            {this.state.error.stack}
          </pre>
        )}
      </div>
    );
  }
}
