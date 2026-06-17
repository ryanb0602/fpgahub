#include "./graph.h"
#include "./sha256.h"

#include <algorithm>
#include <map>
#include <string>
#include <variant>
#include <vector>

#ifndef GDE_H
#define GDE_H

class graph_differencing_engine {
public:
  void diff();
  void commit();

  void load_current_graph(graph *current_graph) {
    this->current_graph = current_graph;
  }

  void test_function() {
    generate_merkles();

    for (graph::module *m : this->current_graph->modules) {
      std::cout << "Name: " << m->name << " Merk: " << m->merk_hash
                << std::endl;
    }
  }

private:
  void generate_merkles();

  graph *current_graph;
  graph *commit_graph;

  void rebuild_commit_graph();

  struct updateModule {
    std::string name;
    graph::module_body module_body;
  };

  struct addModule {
    graph::module new_module;
    graph::edge new_edge;
  };

  struct deleteModule {
    graph::module module_rem;
  };

  struct moveModule {
    graph::module module_move;
    graph::module new_parent;
  };

  using moduleEditType =
      std::variant<updateModule, addModule, deleteModule, moveModule>;

  // helper class to explore graph recursively and create merkle hashes
  class merkle_generator {
  public:
    merkle_generator(graph *targ);

    graph *target_graph;

    void run_hasher();

    // recursive hasher
    std::string hasher(graph::module *m);
    // generate a map for easy edge loop (best way to explore graph with how we
    // store our info)
    void generate_map();
    std::map<std::string, std::vector<graph::edge *>> edge_map;
    std::vector<graph::module *> roots;
  };
};

#endif
