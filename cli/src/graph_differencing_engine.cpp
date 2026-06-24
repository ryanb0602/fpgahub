#include "../include/graph_differencing_engine.h"

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
  std::vector<moduleEditType> edit_script =
      fpgahubgt.edit_script(&old_graph, this->current_graph, root_name);

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
  return;
}
