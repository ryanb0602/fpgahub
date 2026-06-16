#include <string>
#include <vector>

#ifndef GRAPH_H
#define GRAPH_H

class graph {
public:
  struct compatibility_tracker;
  struct module {
    std::string name;
    std::string id;
    std::string hash;
    std::string file;
    std::string merk_hash;
    std::string interface_port_hash;
    std::vector<compatibility_tracker> child_interfaces;
  };

  struct compatibility_tracker {
    module *to;
    std::string interface_port_hash;
  };

  struct edge {
    module *from;
    module *to;
  };

  std::vector<module *> modules;
  std::vector<edge *> edges;
};

#endif
