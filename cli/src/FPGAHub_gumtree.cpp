#include "../include/graph_differencing_engine.h"
#include <algorithm>

// this is an implementation of the algorithm outline by Falleri et al., gumtree
// https://dl.acm.org/doi/10.1145/2642937.2642982

std::vector<graph_differencing_engine::moduleEditType>
graph_differencing_engine::FPGAHub_gumtree::edit_script(
    graph *source_graph, graph *destination_graph) {

  this->source_graph = source_graph;
  this->destination_graph = destination_graph;

  this->sg_root = find_root(this->source_graph);
  this->dg_root = find_root(this->destination_graph);

  this->generate_map(this->sg_edge_map, this->source_graph);
  this->generate_map(this->dg_edge_map, this->destination_graph);

  this->precalc_heights(this->sg_root, this->sg_edge_map, this->sg_heights);
  this->precalc_heights(this->dg_root, this->dg_edge_map, this->dg_heights);

  this->top_down_phase();
}

void graph_differencing_engine::FPGAHub_gumtree::top_down_phase() {}

graph::module *
graph_differencing_engine::FPGAHub_gumtree::find_root(graph *target) {

  // make sure not dealing with empty graph
  if (target->modules.size() < 1) {
    return nullptr;
  }

  // start at random module, here we will use the first module in the graph
  graph::module *m = target->modules[0];

  // traverse backwards until you cannot anymore
  while (1) {

    auto it =
        std::find_if(target->edges.begin(), target->edges.end(),
                     [m](const graph::edge *e) { return e->to->id == m->id; });

    if (it == target->edges.end()) {
      return m;
    }
    m = (*it)->from;
  }
}

void graph_differencing_engine::FPGAHub_gumtree::generate_map(
    std::map<std::string, std::vector<graph::edge *>> &target_map,
    graph *target_graph) {

  // populate the edge map
  for (graph::edge *e : target_graph->edges) {
    target_map[e->from->id].push_back(e);
  }
}

int graph_differencing_engine::FPGAHub_gumtree::precalc_heights(
    graph::module *current,
    std::map<std::string, std::vector<graph::edge *>> &traverse_map,
    std::map<std::string, int> &height_map) {

  // make sure module is valid
  if (current == nullptr)
    return 0;

  std::vector<graph::edge *> children = traverse_map[current->id];

  // if no children, we are a leaf node, and our height is 1
  if (children.size() == 0) {
    height_map[current->id] = 1;
    return 1;
  }

  // get all children heights
  std::vector<int> child_heights;
  for (const graph::edge *e : children) {
    int child_height = this->precalc_heights(e->to, traverse_map, height_map);
    child_heights.push_back(child_height);
  }

  // our height is max child + 1
  int max_child_height =
      *std::max_element(child_heights.begin(), child_heights.end());
  height_map[current->id] = max_child_height + 1;
  return max_child_height + 1;
}
