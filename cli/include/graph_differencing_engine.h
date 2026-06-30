#include "./graph.h"
#include "./sha256.h"

#include <algorithm>
#include <filesystem>
#include <fstream>
#include <iterator>
#include <map>
#include <queue>
#include <ranges>
#include <stack>
#include <string>
#include <unordered_map>
#include <unordered_set>
#include <variant>
#include <vector>

#include "./auth.h"
#include "./utils.h"

#ifndef GDE_H
#define GDE_H

#define CACHE_DIR ".fpgahub"

class graph_differencing_engine {
public:
  void diff();
  void commit();

  void load_current_graph(graph *current_graph) {
    this->current_graph = current_graph;
  }

  void print_edit_script(std::string &root_name);
  void commit_edit_script(std::string &root_name);

  void gde_push(Authenticator &auth);

private:
  std::vector<std::string> fetch_origin_commits(Authenticator &auth);
  std::vector<std::string>
  commits_to_send(std::vector<std::string> &repo_commits);

  // preprocessing step that turns dag into ast by duplicating nodes
  graph *expand_graph(graph *target, std::string &root);
  graph::module *unfold_recursive(graph::module *orig, graph *tree_graph);
  void prune_to_root_s(graph *g, std::string &root_name);

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
    graph::module parent;
  };

  struct disconnectModule {
    graph::module module_rem;
    graph::module parent;
  };

  struct moveModule {
    graph::module module_move;
    graph::module old_parent;
    graph::module new_parent;
  };

  using moduleEditType =
      std::variant<updateModule, addModule, disconnectModule, moveModule>;

  void coalesce_edit_script(std::vector<moduleEditType> &edit_script);
  void write_edit_script(std::vector<moduleEditType> &edit_script,
                         std::string &last_commit, std::string &this_commit);

  // mapping to simplify mouthful type
  using u_edge_map = std::map<std::string, std::vector<graph::edge *>>;

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
    u_edge_map edge_map;
    std::vector<graph::module *> roots;
  };

  class FPGAHub_gumtree {
  public:
    std::vector<moduleEditType> edit_script(graph *source_graph,
                                            graph *destination_graph,
                                            std::string &root_name);

  private:
    using mapping = std::pair<graph::module *, graph::module *>;
    std::unordered_map<graph::module *, graph::module *> M;
    std::vector<mapping> A;

    // where we will store the graphs we are creating edit script for
    graph *source_graph;
    graph *destination_graph;

    graph::module *sg_root;
    graph::module *dg_root;

    // precalc the graph heights
    int precalc_heights(graph::module *current, u_edge_map &traverse_map,
                        std::map<std::string, int> &height_map);

    // this may be silly because it is also done in the merkle generator, but
    // make an id indexed traversal map
    u_edge_map sg_edge_map;
    u_edge_map dg_edge_map;

    std::map<std::string, graph::module *> sg_parent_map;
    std::map<std::string, graph::module *> dg_parent_map;

    void generate_map(u_edge_map &target_map, graph *target_graph,
                      std::map<std::string, graph::module *> &parent_map);

    // to allow precalcuation of the heights
    std::map<std::string, int> sg_heights;
    std::map<std::string, int> dg_heights;

    // top down phase as described in falleri et al
    void top_down_phase();
    void bottom_up_phase();

    using pq_module = std::pair<int, graph::module *>;

    // needed for top down phase as described in falleri et al
    int minHeight = 0;
    std::priority_queue<pq_module> l1;
    std::priority_queue<pq_module> l2;

    // root finding function, helper, assumes non cyclical and connected
    graph::module *find_root(graph *target, std::string &root_name);

    // pop function as defined in gumtree by falleri et al
    // takes from the priority queue the top value and everything equal to it
    std::vector<graph::module *>
    gumtree_pop(std::priority_queue<pq_module> &target);

    // function to check isomorphism
    bool isomorphic(graph::module *t1, graph::module *t2);

    // tool to achieve O(1) ambiguity checks in runtime my counting equivalent
    // merkle hashes
    void count_hashes(graph *target_graph, std::map<std::string, int> &counts);
    std::map<std::string, int> sg_merk_counts;
    std::map<std::string, int> dg_merk_counts;

    bool is_uniquely_isomorphic(graph::module *t1, graph::module *t2);

    void map_subtree(graph::module *t1, graph::module *t2);

    double dice(graph::module *t1, graph::module *t2);
    double minDice = .25;
    int maxSize = 100;

    void get_descendants(graph::module *current, u_edge_map &edge_map,
                         std::unordered_set<graph::module *> &descendants);

    void post_order_dfs(graph::module *current,
                        std::vector<graph::module *> &post_order,
                        u_edge_map &edge_map);

    // helper to check if any children of a node exist in the M mapping
    bool has_matched_children(graph::module *t1);

    graph::module *
    find_candidate(graph::module *t1,
                   const std::unordered_set<graph::module *> &mapped_t2);

    int count_descendants(graph::module *target, u_edge_map &edge_map);

    void opt(graph::module *t1, graph::module *t2,
             std::unordered_set<graph::module *> &mapped_t2_nodes);

    void extract_mappings(const std::vector<graph::module *> &post_order_t1,
                          const std::vector<graph::module *> &post_order_t2,
                          const std::vector<std::vector<double>> &dist_matrix,
                          std::unordered_set<graph::module *> &mapped_t2_nodes);

    double cost_rename(graph::module *m1, graph::module *m2);

    // here down is action generator functions
    // all recover actions from the mapping
    std::vector<moduleEditType> actionGenerator();

    std::vector<graph::module *> sg_unmapped;
    std::vector<graph::module *> dg_unmapped;
    void populate_unmapped();

    std::vector<updateModule> extractEditActions();
    std::vector<moveModule> extractMoveActions();
    std::vector<addModule> extractAddActions();
    std::vector<disconnectModule> extractDisconnectActions();

    void coalesceDisconnects(std::vector<disconnectModule> &disconnects);

    void sort_edit_script(std::vector<moduleEditType> &edit_script);
  };
};

#endif
