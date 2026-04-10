import { useState } from 'react';
import { useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import {
  FlexibleColumnLayout,
  FlexibleColumnLayoutSize,
  Input,
  Button,
  Title,
  MessageStrip,
  Form,
  FormGroup,
  FormItem,
  Label,
} from '@ui5/webcomponents-react';
import { setTokens } from './authSlice';

const KEYCLOAK_URL = import.meta.env.VITE_KEYCLOAK_URL || 'http://localhost:8080';
const KEYCLOAK_REALM = import.meta.env.VITE_KEYCLOAK_REALM || 'warehouse';
const KEYCLOAK_CLIENT = import.meta.env.VITE_KEYCLOAK_CLIENT || 'warehouse-app';

export function LoginPage() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    if (!username || !password) {
      setError('Bitte Benutzername und Passwort eingeben');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const tokenUrl = `${KEYCLOAK_URL}/realms/${KEYCLOAK_REALM}/protocol/openid-connect/token`;
      const params = new URLSearchParams({
        grant_type: 'password',
        client_id: KEYCLOAK_CLIENT,
        username,
        password,
        scope: 'openid profile email',
      });

      const response = await fetch(tokenUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params.toString(),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error_description || 'Login fehlgeschlagen');
      }

      const data = await response.json();
      dispatch(setTokens({ accessToken: data.access_token, refreshToken: data.refresh_token }));
      navigate('/launchpad');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Unbekannter Fehler beim Login');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{
      display: 'flex', justifyContent: 'center', alignItems: 'center',
      height: '100vh', background: 'var(--sapBackgroundColor)'
    }}>
      <div style={{
        width: 400, padding: '2rem',
        background: 'var(--sapBaseColor)',
        borderRadius: '0.5rem',
        boxShadow: 'var(--sapContent_Shadow1)'
      }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <Title level="H2" style={{ color: 'var(--sapBrandColor)' }}>
            Warehouse App
          </Title>
          <Title level="H4" style={{ color: 'var(--sapContent_LabelColor)' }}>
            Anmeldung
          </Title>
        </div>

        {error && (
          <MessageStrip design="Negative" style={{ marginBottom: '1rem' }}>
            {error}
          </MessageStrip>
        )}

        <Form columnsM={1} columnsL={1} columnsXL={1}>
          <FormGroup>
            <FormItem label={<Label for="username">Benutzername</Label>}>
              <Input
                id="username"
                value={username}
                onInput={(e: any) => setUsername(e.target.value)}
                placeholder="Benutzername eingeben"
                style={{ width: '100%' }}
              />
            </FormItem>
            <FormItem label={<Label for="password">Passwort</Label>}>
              <Input
                id="password"
                type="Password"
                value={password}
                onInput={(e: any) => setPassword(e.target.value)}
                placeholder="Passwort eingeben"
                style={{ width: '100%' }}
                onKeyPress={(e: any) => e.key === 'Enter' && handleLogin()}
              />
            </FormItem>
          </FormGroup>
        </Form>

        <Button
          design="Emphasized"
          onClick={handleLogin}
          disabled={loading}
          style={{ width: '100%', marginTop: '1.5rem' }}
        >
          {loading ? 'Wird angemeldet...' : 'Anmelden'}
        </Button>
      </div>
    </div>
  );
}
