import AppLayout from '@/layouts/AppLayout';

/** Page provisoire en attendant le développement de la fonctionnalité. */
export default function PagePlaceholder({ titre, description }: { titre: string; description: string }) {
  return (
    <AppLayout>
      <h1 style={{ margin: 0, fontSize: '2rem' }}>{titre}</h1>
      <p style={{ margin: '0.5rem 0 0', maxWidth: '60ch', color: 'var(--ink-soft)' }}>{description}</p>
    </AppLayout>
  );
}
