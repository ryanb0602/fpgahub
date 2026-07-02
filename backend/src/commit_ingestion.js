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
  ) {
    this.id = id;
    this.commit_id = commit_id;
    this.index_n = index_n;
    this.edit_type = edit_type;
    this.old_module = old_module;
    this.new_module = new_module;
    this.old_parent = old_parent;
    this.new_parent = new_parent;
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
        await this.finalizeTransaction(tx_id);
        return 201;
      } catch (err) {
        console.error("Failed to finalize transaction:", err);
        return 500;
      }
    }

    return 200;
  }

  async finalizeTransaction(tx_id) {
    console.log("Finished transaction: ");
    console.log(tx_id);
  }
}

module.exports = ingester;
