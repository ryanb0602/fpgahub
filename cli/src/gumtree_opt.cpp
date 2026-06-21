#include "../include/graph_differencing_engine.h"

// using a dynamic programming approach, find tree edit distance
void graph_differencing_engine::FPGAHub_gumtree::opt(
    graph::module *t1, graph::module *t2,
    std::unordered_set<graph::module *> &mapped_t2_nodes) {

  std::vector<graph::module *> post_order_t1;
  std::vector<graph::module *> post_order_t2;

  // fetch post order traversals
  this->post_order_dfs(t1, post_order_t1, this->sg_edge_map);
  this->post_order_dfs(t2, post_order_t2, this->dg_edge_map);

  // remove already mapped nodes
  std::erase_if(post_order_t1, [this](graph::module *m) {
    return this->M.find(m) != this->M.end();
  });
  std::erase_if(post_order_t2, [this](graph::module *m) {
    for (const auto &pair : this->M)
      if (pair.second == m)
        return true;
    return false;
  });

  int size_1 = post_order_t1.size();
  int size_2 = post_order_t2.size();

  // create dynamic programming matrix
  std::vector<std::vector<double>> dist_matrix(
      size_1 + 1, std::vector<double>(size_2 + 1, 0.0));

  for (int i = 1; i <= size_1; i++)
    dist_matrix[i][0] = i * 1.0;
  for (int j = 1; j <= size_2; j++)
    dist_matrix[0][j] = j * 1.0;

  // populate the matrix
  for (int i = 1; i <= size_1; i++) {
    for (int j = 1; j <= size_2; j++) {
      graph::module *mod1 = post_order_t1[i - 1];
      graph::module *mod2 = post_order_t2[j - 1];

      double cost_rename = this->cost_rename(mod1, mod2);

      double cost_delete = dist_matrix[i - 1][j] + 1.0;
      double cost_insert = dist_matrix[i][j - 1] + 1.0;
      double cost_match = dist_matrix[i - 1][j - 1] + cost_rename;

      dist_matrix[i][j] = std::min({cost_delete, cost_insert, cost_match});
    }
  }

  // recover the mappings from the table
  this->extract_mappings(post_order_t1, post_order_t2, dist_matrix,
                         mapped_t2_nodes);
}

void graph_differencing_engine::FPGAHub_gumtree::extract_mappings(
    const std::vector<graph::module *> &post_order_t1,
    const std::vector<graph::module *> &post_order_t2,
    const std::vector<std::vector<double>> &dist_matrix,
    std::unordered_set<graph::module *> &mapped_t2_nodes) {

  int i = post_order_t1.size();
  int j = post_order_t2.size();

  while (i > 0 && j > 0) {
    graph::module *mod1 = post_order_t1[i - 1];
    graph::module *mod2 = post_order_t2[j - 1];

    double cost_rename = this->cost_rename(mod1, mod2);

    if (dist_matrix[i][j] == dist_matrix[i - 1][j - 1] + cost_rename) {

      if (cost_rename < 1.0) {
        this->M[mod1] = mod2;
        mapped_t2_nodes.insert(mod2);
      }
      i--;
      j--;
    } else if (dist_matrix[i][j] == dist_matrix[i - 1][j] + 1.0) {
      i--;
    } else {
      j--;
    }
  }
}

// define transformation cost
double
graph_differencing_engine::FPGAHub_gumtree::cost_rename(graph::module *m1,
                                                        graph::module *m2) {

  return (m1->name == m2->name && m1->merk_hash == m2->merk_hash) ? 0.0
         : (m1->name == m2->name) ? 0.1
                                  : std::numeric_limits<double>::infinity();
}
