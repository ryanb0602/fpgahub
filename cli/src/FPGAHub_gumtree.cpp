#include "../include/graph_differencing_engine.h"
#include <algorithm>
#include <queue>

// this is an implementation of the algorithm outline by Falleri et al., gumtree
// https://dl.acm.org/doi/10.1145/2642937.2642982

std::vector<graph_differencing_engine::moduleEditType>
graph_differencing_engine::FPGAHub_gumtree::edit_script(
    graph *source_graph, graph *destination_graph) {

  this->source_graph = source_graph;
  this->destination_graph = destination_graph;

  this->sg_root = find_root(this->source_graph);
  this->dg_root = find_root(this->destination_graph);

  this->generate_map(this->sg_edge_map, this->source_graph,
                     this->sg_parent_map);
  this->generate_map(this->dg_edge_map, this->destination_graph,
                     this->dg_parent_map);

  this->precalc_heights(this->sg_root, this->sg_edge_map, this->sg_heights);
  this->precalc_heights(this->dg_root, this->dg_edge_map, this->dg_heights);

  this->count_hashes(this->source_graph, sg_merk_counts);
  this->count_hashes(this->destination_graph, dg_merk_counts);

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

      std::vector<graph::module *> h1 = this->gumtree_pop(this->l1);
      std::vector<graph::module *> h2 = this->gumtree_pop(this->l2);

      std::unordered_set<graph::module *> matched_h1;
      std::unordered_set<graph::module *> matched_h2;

      for (auto [t_1, t_2] : std::views::cartesian_product(h1, h2)) {

        if (this->isomorphic(t_1, t_2)) {
          if (this->is_uniquely_isomorphic(t_1, t_2)) {
            this->map_subtree(t_1, t_2);
          } else {
            this->A.push_back(std::make_pair(t_1, t_2));
          }
          matched_h1.insert(t_1);
          matched_h2.insert(t_2);
        }
      }

      for (graph::module *t_1 : h1) {
        if (matched_h1.find(t_1) == matched_h1.end()) {
          for (graph::edge *e : this->sg_edge_map[t_1->id]) {
            this->l1.push(std::make_pair(this->sg_heights[e->to->id], e->to));
          }
        }
      }

      for (graph::module *t_2 : h2) {
        if (matched_h2.find(t_2) == matched_h2.end()) {
          for (graph::edge *e : this->dg_edge_map[t_2->id]) {
            this->l2.push(std::make_pair(this->dg_heights[e->to->id], e->to));
          }
        }
      }
    }
  }
  std::sort(this->A.begin(), this->A.end(),
            [this](const mapping &pair_a, const mapping &pair_b) {
              graph::module *parent_a1 = this->sg_parent_map[pair_a.first->id];
              graph::module *parent_a2 = this->dg_parent_map[pair_a.second->id];
              double score_a = this->dice(parent_a1, parent_a2);

              graph::module *parent_b1 = this->sg_parent_map[pair_b.first->id];
              graph::module *parent_b2 = this->dg_parent_map[pair_b.second->id];
              double score_b = this->dice(parent_b1, parent_b2);

              return score_a > score_b;
            });

  while (!this->A.empty()) {
    auto [t1, t2] = this->A.front();
    this->A.erase(this->A.begin());

    this->map_subtree(t1, t2);

    std::erase_if(this->A, [t1, t2](const mapping &pair) {
      return pair.first == t1 || pair.second == t2;
    });
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
    u_edge_map &target_map, graph *target_graph,
    std::map<std::string, graph::module *> &parent_map) {

  // populate the edge map
  for (graph::edge *e : target_graph->edges) {
    target_map[e->from->id].push_back(e);
    parent_map[e->to->id] = e->from;
  }
}

int graph_differencing_engine::FPGAHub_gumtree::precalc_heights(
    graph::module *current, u_edge_map &traverse_map,
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

std::vector<graph::module *>
graph_differencing_engine::FPGAHub_gumtree::gumtree_pop(
    std::priority_queue<pq_module> &target) {

  std::vector<graph::module *> ret;

  if (target.empty()) {
    return ret;
  }

  int current_top_val = target.top().first;

  while (!target.empty() && target.top().first == current_top_val) {
    ret.push_back(target.top().second);
    target.pop();
  }

  return ret;
}

bool graph_differencing_engine::FPGAHub_gumtree::isomorphic(graph::module *t1,
                                                            graph::module *t2) {
  if (t1 == nullptr && t2 == nullptr) {
    return true;
  }

  if (t1 == nullptr || t2 == nullptr) {
    return false;
  }

  return t1->merk_hash == t2->merk_hash;
}

void graph_differencing_engine::FPGAHub_gumtree::count_hashes(
    graph *target_graph, std::map<std::string, int> &counts) {
  for (graph::module *m : target_graph->modules) {
    counts[m->merk_hash]++;
  }
}

bool graph_differencing_engine::FPGAHub_gumtree::is_uniquely_isomorphic(
    graph::module *t1, graph::module *t2) {
  if (t1->merk_hash != t2->merk_hash) {
    return false;
  }

  bool unique_in_source = (this->sg_merk_counts[t1->merk_hash] == 1);
  bool unique_in_dest = (this->dg_merk_counts[t2->merk_hash] == 1);

  return unique_in_source && unique_in_dest;
}

void graph_differencing_engine::FPGAHub_gumtree::map_subtree(
    graph::module *t1, graph::module *t2) {
  this->M[t1] = t2;

  std::vector<graph::edge *> children1 = this->sg_edge_map[t1->id];
  std::vector<graph::edge *> children2 = this->dg_edge_map[t2->id];

  auto hash_sorter = [](const graph::edge *a, const graph::edge *b) {
    return a->to->merk_hash < b->to->merk_hash;
  };
  std::sort(children1.begin(), children1.end(), hash_sorter);
  std::sort(children2.begin(), children2.end(), hash_sorter);

  for (size_t i = 0; i < children1.size(); ++i) {
    this->map_subtree(children1[i]->to, children2[i]->to);
  }
}

double graph_differencing_engine::FPGAHub_gumtree::dice(graph::module *t1,
                                                        graph::module *t2) {

  if (t1 == nullptr || t2 == nullptr)
    return 0.0;

  if (t1->merk_hash == t2->merk_hash) {
    return 1.0;
  }

  std::unordered_set<graph::module *> desc1;
  this->get_descendants(t1, this->sg_edge_map, desc1);

  std::unordered_set<graph::module *> desc2;
  this->get_descendants(t2, this->dg_edge_map, desc2);

  int denominator = desc1.size() + desc2.size();

  if (denominator == 0) {
    return 0.0;
  }

  int common_mappings = 0;
  for (graph::module *d1 : desc1) {
    if (this->M.find(d1) != this->M.end()) {
      graph::module *mapped_to = this->M[d1];

      if (desc2.find(mapped_to) != desc2.end()) {
        common_mappings++;
      }
    }
  }

  return (2.0 * common_mappings) / static_cast<double>(denominator);
}

void graph_differencing_engine::FPGAHub_gumtree::get_descendants(
    graph::module *current, u_edge_map &edge_map,
    std::unordered_set<graph::module *> &descendants) {

  if (edge_map.find(current->id) == edge_map.end()) {
    return;
  }

  for (graph::edge *e : edge_map[current->id]) {
    descendants.insert(e->to);
    this->get_descendants(e->to, edge_map, descendants);
  }
}
