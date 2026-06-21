#include <algorithm>
#include <filesystem>
#include <fstream>
#include <iostream>
#include <map>
#include <set>
#include <sstream>
#include <string>
#include <vector>

#include "../include/utils.h"

#ifndef GRAPH_H
#define GRAPH_H

inline std::string cache_dir = ".fpgahub";

bool update_head(const std::string &commit_hash);

std::string get_head();

class graph {
public:
  void load_from_file();
  void write_to_file(std::string &root_name);

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
      return ret;
    }
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
