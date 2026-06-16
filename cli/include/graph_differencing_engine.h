#include "./graph.h"

#include <string>
#include <variant>
#include <vector>

#ifndef GDE_H
#define GDE_H

class graph_differencing_engine {
public:
  void diff();
  void commit();

private:
  void generate_merkles();

  graph current_graph;
  graph commit_graph;

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
};

#endif
