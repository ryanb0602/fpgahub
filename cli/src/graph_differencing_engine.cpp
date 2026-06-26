#include "../include/graph_differencing_engine.h"
#include <unordered_set>

template <class... Ts> struct overloaded : Ts... {
  using Ts::operator()...;
};
template <class... Ts> overloaded(Ts...) -> overloaded<Ts...>;

void graph_differencing_engine::generate_merkles() {
  merkle_generator m_gen(this->current_graph);
  m_gen.run_hasher();
}

graph_differencing_engine::merkle_generator::merkle_generator(graph *targ) {
  this->target_graph = targ;
  this->generate_map();
}

std::string
graph_differencing_engine::merkle_generator::hasher(graph::module *m) {
  // retrieve this nodes edge list
  std::vector<graph::edge *> children = this->edge_map[m->id];

  if (!m->merk_hash.empty()) {
    return m->merk_hash;
  }

  if (children.size() == 0) {
    m->merk_hash = m->hash;
    return m->hash;
  }

  // sort by the hash to give us a repeatable traversal order
  // we sort by hash because if something has changed, the sort order may change
  // but it doesnt matter because that is what the merkle hash represents anyway
  std::sort(children.begin(), children.end(),
            [](const graph::edge *one, const graph::edge *two) {
              return one->to->hash < two->to->hash;
            });

  std::string constructed_string;
  for (graph::edge *e : children) {
    // while extremely rare, these delimiters prevent a concatenation collisions
    constructed_string += "|";
    constructed_string += hasher(e->to);
    constructed_string += "|";
  }

  constructed_string += m->hash;

  // hash the constructed string
  SHA256 sha;
  sha.update(constructed_string);
  std::string merkle = sha.final();

  // save and return our generated merk_hash
  m->merk_hash = merkle;
  return merkle;
}

void graph_differencing_engine::merkle_generator::run_hasher() {
  for (graph::module *r : this->roots) {
    this->hasher(r);
  }
}

void graph_differencing_engine::merkle_generator::generate_map() {

  // trying to find root_nodes, we will pop nodes as we find them as a "to"
  std::map<std::string, graph::module *> root_nodes;
  for (graph::module *m : this->target_graph->modules) {
    root_nodes.insert({m->id, m});
  }

  // populate the edge map
  for (graph::edge *e : this->target_graph->edges) {
    this->edge_map[e->from->id].push_back(e);
    root_nodes.erase(e->to->id);
  }

  // save the found roots to the vector
  for (auto const &[id, m] : root_nodes) {
    this->roots.push_back(m);
  }
}

void graph_differencing_engine::print_edit_script(std::string &root_name) {
  generate_merkles();

  FPGAHub_gumtree fpgahubgt;
  graph old_graph;
  old_graph.load_from_file();
  graph *old_treeified = this->expand_graph(&old_graph, root_name);

  this->prune_to_root_s(this->current_graph, root_name);

  std::vector<moduleEditType> edit_script =
      fpgahubgt.edit_script(old_treeified, this->current_graph, root_name);

  this->coalesce_edit_script(edit_script);

  std::cout << "\n--- Edit Script ---\n";
  for (const auto &edit : edit_script) {
    std::visit(
        overloaded{[&](const updateModule &e) {
                     std::cout << "UPDATE: " << e.name << "\n";
                   },
                   [&](const addModule &e) {
                     if (e.parent.name == "") {

                       std::cout << "ADD: " << e.new_module.name
                                 << " as root\n";
                     } else {

                       std::cout << "ADD: " << e.new_module.name
                                 << " as child of " << e.parent.name << "\n";
                     }
                   },
                   [&](const disconnectModule &e) {
                     std::cout << "DISCONNECT: " << e.module_rem.name << "\n";
                   },
                   [&](const moveModule &e) {
                     std::cout << "MOVE: " << e.module_move.name
                               << " to new parent " << e.parent.name << "\n";
                   }},
        edit);
  }
  std::cout << "-----------------------------\n";
  delete old_treeified;
  return;
}

void graph_differencing_engine::commit_edit_script(std::string &root_name) {
  generate_merkles();

  FPGAHub_gumtree fpgahubgt;
  graph old_graph;
  old_graph.load_from_file();
  graph *old_treeified = this->expand_graph(&old_graph, root_name);

  this->prune_to_root_s(this->current_graph, root_name);

  std::vector<moduleEditType> edit_script =
      fpgahubgt.edit_script(old_treeified, this->current_graph, root_name);

  this->coalesce_edit_script(edit_script);

  if (edit_script.size() == 0) {
    std::cout << "No changes to commit!" << std::endl;
    return;
  }

  std::cout << "Writing cache..." << std::endl;

  this->current_graph->write_to_file(root_name);

  std::cout << "Done writing cache, saving edit actions..." << std::endl;

  delete old_treeified;
  return;
}

graph *graph_differencing_engine::expand_graph(graph *target,
                                               std::string &root) {

  graph *new_graph;

  graph::module *root_node = nullptr;
  for (graph::module *m : target->modules) {
    if (m->name == root) {
      root_node = m;
      break;
    }
  }

  if (!root_node) {
    return nullptr;
  }
  graph *tree_graph = new graph();

  unfold_recursive(root_node, tree_graph);
  return tree_graph;
}

graph::module *graph_differencing_engine::unfold_recursive(graph::module *orig,
                                                           graph *tree_graph) {

  // copy module
  if (!orig)
    return nullptr;
  graph::module *new_mod = new graph::module();

  new_mod->name = orig->name;
  new_mod->id = generate_uuid_v4();
  new_mod->hash = orig->hash;
  new_mod->file = orig->file;
  new_mod->merk_hash = orig->merk_hash;

  tree_graph->modules.push_back(new_mod);

  // iterate over children and make standalone copies recursively
  for (graph::module *m : orig->child_interfaces) {

    graph::module *new_child = this->unfold_recursive(m, tree_graph);
    if (new_child) {
      new_mod->child_interfaces.push_back(new_child);

      graph::edge *new_edge = new graph::edge();
      new_edge->from = new_mod;
      new_edge->to = new_child;
      tree_graph->edges.push_back(new_edge);
    }
  }
  return new_mod;
}

void graph_differencing_engine::prune_to_root_s(graph *g,
                                                std::string &root_name) {

  if (!g)
    return;

  graph::module *root_node = nullptr;
  for (graph::module *m : g->modules) {
    if (m->name == root_name) {
      root_node = m;
      break;
    }
  }

  if (!root_node) {
    return;
  }

  std::unordered_set<graph::module *> reachable;
  std::vector<graph::module *> stack = {root_node};
  reachable.insert(root_node);

  while (!stack.empty()) {
    graph::module *curr = stack.back();
    stack.pop_back();

    for (graph::module *child : curr->child_interfaces) {
      if (reachable.insert(child).second) {
        stack.push_back(child);
      }
    }
  }

  for (auto it = g->modules.begin(); it != g->modules.end();) {
    if (reachable.find(*it) == reachable.end()) {
      delete *it;
      it = g->modules.erase(it);
    } else {
      ++it;
    }
  }

  for (auto it = g->edges.begin(); it != g->edges.end();) {
    if (reachable.find((*it)->from) == reachable.end() ||
        reachable.find((*it)->to) == reachable.end()) {
      delete *it;
      it = g->edges.erase(it);
    } else {
      ++it;
    }
  }
}

void graph_differencing_engine::coalesce_edit_script(
    std::vector<moduleEditType> &edit_script) {
  std::vector<moduleEditType> coalesced_script;

  std::unordered_set<std::string> seen_updates;
  std::unordered_set<std::string> seen_adds;
  std::unordered_set<std::string> seen_disconnects;
  std::unordered_set<std::string> seen_moves;

  for (const auto &edit : edit_script) {
    std::visit(overloaded{[&](const updateModule &e) {
                            if (seen_updates.insert(e.name).second) {
                              coalesced_script.push_back(edit);
                            }
                          },
                          [&](const addModule &e) {
                            std::string sig =
                                e.parent.name + "->" + e.new_module.name;
                            if (seen_adds.insert(sig).second) {
                              coalesced_script.push_back(edit);
                            }
                          },
                          [&](const disconnectModule &e) {
                            std::string sig =
                                e.parent.name + "->" + e.module_rem.name;
                            if (seen_disconnects.insert(sig).second) {
                              coalesced_script.push_back(edit);
                            }
                          },
                          [&](const moveModule &e) {
                            std::string sig =
                                e.parent.name + "->" + e.module_move.name;
                            if (seen_moves.insert(sig).second) {
                              coalesced_script.push_back(edit);
                            }
                          }},
               edit);
  }

  edit_script = std::move(coalesced_script);
}
