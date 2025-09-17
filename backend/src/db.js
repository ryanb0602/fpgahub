const { Pool } = require("pg");

const pool = new Pool({
  user: "myuser",
  host: "postgres",
  database: "mydb",
  password: "mypassword",
  port: 5432, // default PostgreSQL port
});

module.exports = pool;
