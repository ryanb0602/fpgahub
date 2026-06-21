#include "./graph.h"
#include "./sha256.h"

#include <algorithm>
#include <map>
#include <queue>
#include <ranges>
#include <string>
#include <unordered_map>
#include <unordered_set>
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

  void test_function(std::string &root_name) {
    generate_merkles();

    for (graph::module *m : this->current_graph->modules) {
      std::cout << "Name: " << m->name << " ID: " << m->id
                << " Merk: " << m->merk_hash << std::endl;
    }

    for (graph::edge *e : this->current_graph->edges) {
      std::cout << "From: " << e->from->name << " - " << e->from->id
                << " To: " << e->to->name << " - " << e->to->id;
    }

    FPGAHub_gumtree fpgahubgt;
    fpgahubgt.edit_script(this->current_graph, this->current_graph, root_name);
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
    int minHeight = 2;
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

    void get_descendants(graph::module *current, u_edge_map &edge_map,
                         std::unordered_set<graph::module *> &descendants);
  };
};

#endif
