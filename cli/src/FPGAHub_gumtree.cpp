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

// this is top down phase as described in falleri et al, read gumtree for more
// info
void graph_differencing_engine::FPGAHub_gumtree::top_down_phase() {

  std::string sg_root_id = this->sg_root->id;
  std::string dg_root_id = this->dg_root->id;

  auto sg_root_pair =
      std::make_pair(this->sg_heights[sg_root_id], this->sg_root);
  auto dg_root_pair =
      std::make_pair(this->dg_heights[dg_root_id], this->dg_root);

  this->l1.push(sg_root_pair);
  this->l2.push(dg_root_pair);

  while (std::min(this->l1.top().first, this->l2.top().first) >
         this->minHeight) {
    int l1_peek_max = this->l1.top().first;
    int l2_peek_max = this->l2.top().first;
    if (l1_peek_max != l2_peek_max) {
      if (l1_peek_max > l2_peek_max) {
        graph::module *t = this->l1.top().second;
        this->l1.pop();
        std::vector<graph::edge *> children = this->sg_edge_map[t->id];
        for (const graph::edge *e : children) {
          graph::module *child = e->to;
          pq_module child_pair =
              std::make_pair(this->sg_heights[child->id], child);
          this->l1.push(child_pair);
        }
      } else {
        graph::module *t = this->l2.top().second;
        this->l2.pop();
        std::vector<graph::edge *> children = this->dg_edge_map[t->id];
        for (const graph::edge *e : children) {
          graph::module *child = e->to;
          pq_module child_pair =
              std::make_pair(this->dg_heights[child->id], child);

          this->l2.push(child_pair);
        }
      }
    } else {
    }
  }
}

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
