/**
 * Crée ou ajuste les tables à partir des entités (développement : DB_SYNCHRONIZE=true dans backend/.env).
 * Lancement : npm run db:synchroniser
 */
import source from '../data-source';

async function main() {
  await source.initialize();
  if (!source.options.synchronize) await source.synchronize();
  const tables: { tablename: string }[] = await source.query(
    "SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename",
  );
  console.log(`Tables de la base ${source.options.database} : ${tables.map((t) => t.tablename).join(', ') || '(aucune)'}`);
  await source.destroy();
}

main().catch((e) => {
  console.error(e.message ?? e);
  process.exit(1);
});
