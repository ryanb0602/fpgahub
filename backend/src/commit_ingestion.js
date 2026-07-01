const { v4: uuidv4 } = require("uuid");

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
  constructor(id, edit_script, module, edge, parent_commit) {
    this.id = id;
    this.edit_script = edit_script;
    this.module = module;
    this.edge = edge;
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
        const fileId = null;

        const newMod = new graph_module(
          modData.id || uuidv4(),
          modData.name,
          fileId,
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
      this.transactions.set(id, [commitInfo]);
    } else {
      this.transactions.get(id).push(commitInfo);
    }
  }
}

module.exports = ingester;
