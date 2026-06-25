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
  std::vector<moduleEditType> edit_script =
      fpgahubgt.edit_script(old_treeified, this->current_graph, root_name);

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
  std::vector<moduleEditType> edit_script =
      fpgahubgt.edit_script(old_treeified, this->current_graph, root_name);

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
  new_mod->interface_port_hash = orig->interface_port_hash;

  tree_graph->modules.push_back(new_mod);

  // iterate over children and make standalone copies recursively
  for (const graph::compatibility_tracker &tracker : orig->child_interfaces) {

    graph::module *new_child = this->unfold_recursive(tracker.to, tree_graph);
    if (new_child) {
      graph::compatibility_tracker new_tracker;
      new_tracker.to = new_child;
      new_tracker.interface_port_hash = tracker.interface_port_hash;
      new_mod->child_interfaces.push_back(new_tracker);

      graph::edge *new_edge = new graph::edge();
      new_edge->from = new_mod;
      new_edge->to = new_child;
      tree_graph->edges.push_back(new_edge);
    }
  }
  return new_mod;
}
