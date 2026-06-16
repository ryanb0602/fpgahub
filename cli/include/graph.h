#include <iostream>
#include <string>
#include <vector>

#ifndef GRAPH_H
#define GRAPH_H

class graph {
public:
  struct compatibility_tracker;

  // module body struct, a helper struct to make things in the graph
  // differencing engine look a little cleaner
  struct module_body {
    std::string hash;
    std::string file;
    std::string merk_hash;
    std::string interface_port_hash;
    std::vector<compatibility_tracker> child_interfaces;
  };

  struct module {
    std::string name;
    std::string id;
    std::string hash;
    std::string file;
    std::string merk_hash;
    std::string interface_port_hash;
    std::vector<compatibility_tracker> child_interfaces;
    module_body getModuleBody() {
      module_body ret = {.hash = this->hash,
                         .file = this->file,
                         .merk_hash = this->merk_hash,
                         .interface_port_hash = this->interface_port_hash,
                         .child_interfaces = this->child_interfaces};
    };
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

  friend std::ostream &operator<<(std::ostream &os, const graph &target);
};

#endif
