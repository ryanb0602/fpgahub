#include "./graph.h"

#ifndef GDE_H
#define GDE_H

class graph_differencing_engine {
public:
  void diff();
  void commit();

private:
  graph current_graph;
  graph commit_graph;

  void rebuild_commit_graph();
};

#endif
