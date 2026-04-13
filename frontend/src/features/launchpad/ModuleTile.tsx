import { Card, CardHeader, Button } from '@ui5/webcomponents-react';

interface ModuleTileProps {
  icon: string;
  title: string;
  description: string;
  onClick: () => void;
  disabled?: boolean;
}

export function ModuleTile({ icon, title, description, onClick, disabled }: ModuleTileProps) {
  return (
    <Card
      style={{
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        transition: 'box-shadow 0.2s',
      }}
      onClick={disabled ? undefined : onClick}
      header={
        <CardHeader
          titleText={title}
          subtitleText={description}
          avatar={<ui5-icon name={icon} style={{ color: 'var(--sapBrandColor)', fontSize: '2rem' }} />}
          interactive={!disabled}
        />
      }
    />
  );
}
