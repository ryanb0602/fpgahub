const pool = require('./backend/src/db');
async function query() {
  const nodes = await pool.query('SELECT DISTINCT module FROM (SELECT unnest(modules) AS module FROM files) t');
  console.log("NODES:", nodes.rows);
  const edges = await pool.query('SELECT parent_module, child_module FROM edges');
  console.log("EDGES:", edges.rows);
  process.exit(0);
}
query();
