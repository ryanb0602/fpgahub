const { v4: uuidv4 } = require("uuid");
const minioClient = require("./minio");
const pool = require("./db");

const dataBucket = "data";
const tmpBucket = "tmp";

class graph_module {
  constructor(id, name, file_id, merkle_hash, hash) {
    this.id = id;
    this.name = name;
    this.file_id = file_id;
    this.merkle_hash = merkle_hash;
    this.hash = hash;
  }
}

class edge {
  constructor(id, from_id, to_id) {
    this.id = id;
    this.from_id = from_id;
    this.to_id = to_id;
  }
}

class edit_actions {
  constructor(
    id,
    commit_id,
    index_n,
    edit_type,
    old_module,
    new_module,
    old_parent,
    new_parent,
    module_name = null,
    parent_name = null,
    old_parent_name = null,
    new_parent_name = null,
  ) {
    this.id = id;
    this.commit_id = commit_id;
    this.index_n = index_n;
    this.edit_type = edit_type;
    this.old_module = old_module;
    this.new_module = new_module;
    this.old_parent = old_parent;
    this.new_parent = new_parent;
    this.module_name = module_name;
    this.parent_name = parent_name;
    this.old_parent_name = old_parent_name;
    this.new_parent_name = new_parent_name;
  }
}

class commit_info {
  constructor(id, edit_script, modules, edges, parent_commit) {
    this.id = id;
    this.edit_script = edit_script;
    this.modules = modules;
    this.edges = edges;
    this.parent_commit = parent_commit;
  }
}

class ingester {
  constructor() {
    this.transactions = new Map();
  }

  async ingest(commitPayload, id) {
    const commitId = commitPayload.new_commit;
    const parentCommit = commitPayload.parent_commit;

    const moduleMap = new Map();
    const modules = [];

    if (commitPayload.graph && commitPayload.graph.modules) {
      for (const modData of commitPayload.graph.modules) {
        const newMod = new graph_module(
          modData.id || uuidv4(),
          modData.name,
          modData.file,
          modData.merk_hash,
          modData.hash,
        );
        modules.push(newMod);
        moduleMap.set(modData.name, newMod.id);
      }
    }

    const edges = [];
    if (commitPayload.graph && commitPayload.graph.edges) {
      for (const edgeData of commitPayload.graph.edges) {
        const fromId = moduleMap.get(edgeData.from);
        const toId = moduleMap.get(edgeData.to);

        if (fromId && toId) {
          edges.push(new edge(uuidv4(), fromId, toId));
        }
      }
    }

    const editActions = [];
    if (commitPayload.edit_script) {
      commitPayload.edit_script.forEach((script, index) => {
        const actionType = script.action.toLowerCase();

        const targetModuleId =
          moduleMap.get(script.name || script.module) || null;
        const oldParentId = moduleMap.get(script.old_parent) || null;
        const newParentId =
          moduleMap.get(script.parent || script.new_parent) || null;

        const moduleName = script.name || script.module || null;
        const parentName = script.parent || null;
        const oldParentName =
          script.old_parent ||
          (actionType === "disconnect" ? parentName : null);
        const newParentName =
          script.new_parent || (actionType === "add" ? parentName : null);

        editActions.push(
          new edit_actions(
            uuidv4(),
            commitId,
            index,
            actionType,
            ["update", "disconnect"].includes(actionType)
              ? targetModuleId
              : null,
            ["update", "add", "move"].includes(actionType)
              ? targetModuleId
              : null,
            oldParentId || (actionType === "disconnect" ? newParentId : null),
            newParentId,
            moduleName,
            parentName,
            oldParentName,
            newParentName,
          ),
        );
      });
    }

    const commitInfo = new commit_info(
      commitId,
      editActions,
      modules,
      edges,
      parentCommit,
    );

    const tx = this.transactions.get(id);

    if (!tx) {
      this.transactions.set(id, { commits: [commitInfo] });
    } else {
      this.transactions.get(id).commits.push(commitInfo);
    }
  }

  async needed_files(id) {
    const tx = this.transactions.get(id).commits;

    let needed_files = new Set();

    for (const commit of tx) {
      for (const module of commit.modules) {
        const query = await pool.query(
          `SELECT COUNT(*) FROM files WHERE filename = $1 AND hash = $2`,
          [module.file_id, commit.id],
        );

        if (parseInt(query.rows[0].count) === 0) {
          needed_files.add(
            JSON.stringify({ file: module.file_id, hash: commit.id }),
          );
        }
      }
    }
    this.transactions.get(id).needed_files = needed_files;
    return [...needed_files].map(JSON.parse);
  }

  async push_file(tx_id, file, hash, file_blob) {
    const tx = this.transactions.get(tx_id);
    if (!tx) return 403;

    const fileObjString = JSON.stringify({ file: file, hash: hash });
    if (!tx.needed_files.has(fileObjString)) {
      return 406;
    }

    const tmpExists = await minioClient
      .bucketExists(tmpBucket)
      .catch(() => false);
    if (!tmpExists) await minioClient.makeBucket(tmpBucket);

    const store_name = uuidv4();

    try {
      await minioClient.putObject("tmp", store_name, file_blob);
    } catch (err) {
      return 500;
    }

    if (!this.transactions.get(tx_id).have_files) {
      this.transactions.get(tx_id).have_files = [];
    }

    this.transactions
      .get(tx_id)
      .have_files.push({ file: file, hash: hash, stored_name: store_name });

    //check if we have everything we need, copy and finish if we do
    if (tx.have_files.length === tx.needed_files.size) {
      try {
        const successful = await this.finalizeTransaction(tx_id);
        if (!successful) {
          return 422;
        }
        return 201;
      } catch (err) {
        console.error("Failed to finalize transaction:", err);
        return 500;
      }
    }

    return 200;
  }

  async finalizeTransaction(tx_id) {
    const tx = this.transactions.get(tx_id);
    if (!tx || !tx.commits) return false;

    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      const fileMap = new Map();

      if (tx.have_files && tx.have_files.length > 0) {
        const dataExists = await minioClient
          .bucketExists(dataBucket)
          .catch(() => false);
        if (!dataExists) await minioClient.makeBucket(dataBucket);

        for (const fileObj of tx.have_files) {
          await minioClient.copyObject(
            dataBucket,
            fileObj.stored_name,
            `/${tmpBucket}/${fileObj.stored_name}`,
          );

          await minioClient
            .removeObject(tmpBucket, fileObj.stored_name)
            .catch(() => {});

          await client.query(
            `INSERT INTO files (id, filename, hash) VALUES ($1, $2, $3)`,
            [fileObj.stored_name, fileObj.file, fileObj.hash],
          );

          fileMap.set(`${fileObj.file}_${fileObj.hash}`, fileObj.stored_name);
          fileMap.set(fileObj.file, fileObj.stored_name);
        }
      }

      for (const commit of tx.commits) {
        await client.query(
          `INSERT INTO commits (id, parent_commit, timestamp) VALUES ($1, $2, NOW())
           ON CONFLICT (id) DO NOTHING`,
          [commit.id, commit.parent_commit || null],
        );

        for (const edit_action of commit.edit_script) {
          const targetMod =
            edit_action.module_name ||
            edit_action.new_module ||
            edit_action.old_module ||
            null;
          const oldMod = ["update", "disconnect", "move"].includes(
            edit_action.edit_type,
          )
            ? targetMod
            : null;
          const newMod = ["update", "add", "move"].includes(
            edit_action.edit_type,
          )
            ? targetMod
            : null;
          const oldPar =
            edit_action.old_parent_name || edit_action.old_parent || null;
          const newPar =
            edit_action.new_parent_name || edit_action.new_parent || null;

          await client.query(
            `INSERT INTO edit_actions (id, commit_id, index_n, action, old_module, new_module, old_parent, new_parent)
             VALUES ($1, $2, $3, $4::edit_type, $5, $6, $7, $8)
             ON CONFLICT (id) DO NOTHING`,
            [
              edit_action.id || uuidv4(),
              commit.id,
              edit_action.index_n,
              edit_action.edit_type.toLowerCase(),
              oldMod,
              newMod,
              oldPar,
              newPar,
            ],
          );

          if (edit_action.edit_type === "add") {
            const new_mod = commit.modules.find(
              (item) =>
                item.id === edit_action.new_module ||
                item.name === edit_action.module_name,
            );
            if (!new_mod) continue;

            const new_id = uuidv4();

            const fileUuid = await this.getFileUuid(
              client,
              fileMap,
              new_mod.file_id,
              commit.id,
            );

            const modRes = await client.query(
              `INSERT INTO modules (id, name, file_id, merkle_hash, hash, last_touched_commit_hash) 
               VALUES ($1, $2, $3, $4, $5, $6)
               ON CONFLICT (name) DO UPDATE SET 
                 file_id = EXCLUDED.file_id,
                 merkle_hash = EXCLUDED.merkle_hash,
                 hash = EXCLUDED.hash,
                 last_touched_commit_hash = EXCLUDED.last_touched_commit_hash
              RETURNING id
              `,
              [
                new_id,
                new_mod.name,
                fileUuid,
                new_mod.merkle_hash,
                new_mod.hash,
                commit.id,
              ],
            );

            const authoritativeModId = modRes.rows[0].id;

            if (edit_action.new_parent || edit_action.new_parent_name) {
              const parent_module = commit.modules.find(
                (item) =>
                  item.id === edit_action.new_parent ||
                  item.name === edit_action.new_parent_name,
              );
              const parentName = parent_module
                ? parent_module.name
                : edit_action.new_parent_name;

              if (parentName) {
                const { rows } = await client.query(
                  `SELECT id FROM modules WHERE name = $1`,
                  [parentName],
                );
                if (rows.length > 0) {
                  await client.query(
                    `INSERT INTO edges (id, from_id, to_id) VALUES ($1, $2, $3)
                     ON CONFLICT DO NOTHING`,
                    [uuidv4(), rows[0].id, authoritativeModId],
                  );
                }
              }
            }
          } else if (edit_action.edit_type === "update") {
            const mod = commit.modules.find(
              (item) =>
                item.id === edit_action.new_module ||
                item.name === edit_action.module_name,
            );
            if (!mod) continue;

            const fileUuid = await this.getFileUuid(
              client,
              fileMap,
              mod.file_id,
              commit.id,
            );

            await client.query(
              `UPDATE modules 
               SET file_id = $1, merkle_hash = $2, hash = $3, last_touched_commit_hash = $4 
               WHERE name = $5`,
              [fileUuid, mod.merkle_hash, mod.hash, commit.id, mod.name],
            );
          } else if (edit_action.edit_type === "move") {
            const modName =
              edit_action.module_name ||
              commit.modules.find((item) => item.id === edit_action.new_module)
                ?.name;
            const oldParentName =
              edit_action.old_parent_name ||
              commit.modules.find((item) => item.id === edit_action.old_parent)
                ?.name;
            const newParentName =
              edit_action.new_parent_name ||
              commit.modules.find((item) => item.id === edit_action.new_parent)
                ?.name;

            if (!modName) continue;

            const modRes = await client.query(
              `SELECT id FROM modules WHERE name = $1`,
              [modName],
            );
            if (modRes.rows.length === 0) continue;
            const modId = modRes.rows[0].id;

            if (oldParentName) {
              const oldParentRes = await client.query(
                `SELECT id FROM modules WHERE name = $1`,
                [oldParentName],
              );
              if (oldParentRes.rows.length > 0) {
                await client.query(
                  `DELETE FROM edges WHERE from_id = $1 AND to_id = $2`,
                  [oldParentRes.rows[0].id, modId],
                );
              }
            }

            if (newParentName) {
              const newParentRes = await client.query(
                `SELECT id FROM modules WHERE name = $1`,
                [newParentName],
              );
              if (newParentRes.rows.length > 0) {
                await client.query(
                  `INSERT INTO edges (id, from_id, to_id) VALUES ($1, $2, $3)
                   ON CONFLICT DO NOTHING`,
                  [uuidv4(), newParentRes.rows[0].id, modId],
                );
              }
            }

            await client.query(
              `UPDATE modules SET last_touched_commit_hash = $1 WHERE id = $2`,
              [commit.id, modId],
            );
          } else if (edit_action.edit_type === "disconnect") {
            const modName = edit_action.module_name;
            const parentName =
              edit_action.parent_name || edit_action.old_parent_name;

            if (!modName) continue;

            const modRes = await client.query(
              `SELECT id FROM modules WHERE name = $1`,
              [modName],
            );
            if (modRes.rows.length === 0) continue;
            const modId = modRes.rows[0].id;

            if (parentName) {
              const parentRes = await client.query(
                `SELECT id FROM modules WHERE name = $1`,
                [parentName],
              );
              if (parentRes.rows.length > 0) {
                await client.query(
                  `DELETE FROM edges WHERE from_id = $1 AND to_id = $2`,
                  [parentRes.rows[0].id, modId],
                );
              }
            } else {
              await client.query(
                `DELETE FROM edges WHERE from_id = $1 OR to_id = $1`,
                [modId],
              );
            }

            await client.query(
              `DELETE FROM edges WHERE from_id = $1 OR to_id = $1`,
              [modId],
            );
            await client.query(`DELETE FROM modules WHERE id = $1`, [modId]);
          }
        }
      }

      await client.query("COMMIT");

      this.transactions.delete(tx_id);
      return true;
    } catch (err) {
      await client.query("ROLLBACK");
      console.error("Error finalizing transaction:", err);
      return false;
    } finally {
      client.release();
    }
  }

  async getFileUuid(client, fileMap, filename, commitHash) {
    if (fileMap.has(`${filename}_${commitHash}`)) {
      return fileMap.get(`${filename}_${commitHash}`);
    }
    if (fileMap.has(filename)) {
      return fileMap.get(filename);
    }

    const resExact = await client.query(
      `SELECT id FROM files WHERE filename = $1 AND hash = $2 LIMIT 1`,
      [filename, commitHash],
    );
    if (resExact.rows.length > 0) {
      return resExact.rows[0].id;
    }

    const resAny = await client.query(
      `SELECT id FROM files WHERE filename = $1 LIMIT 1`,
      [filename],
    );
    if (resAny.rows.length > 0) {
      return resAny.rows[0].id;
    }

    return null;
  }
}

module.exports = ingester;
