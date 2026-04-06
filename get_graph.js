const http = require('http');
const pool = require('./backend/src/db');

async function run() {
  const nodesResult = await pool.query(`SELECT DISTINCT module FROM (SELECT unnest(modules) AS module FROM files) t`);
  const edgesResult = await pool.query(`SELECT parent_module, child_module FROM edges`);
  
  const nodes = nodesResult.rows.map((r) => ({ id: r.module }));
  const links = edgesResult.rows.map((r) => ({
          source: r.parent_module,
          target: r.child_module,
  }));
  
  const fs = require('fs');
  fs.writeFileSync('graph.json', JSON.stringify({ nodes, links }, null, 2));
  console.log("Graph saved to graph.json");
  process.exit(0);
}
run();
