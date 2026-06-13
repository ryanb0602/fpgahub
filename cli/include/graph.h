#include <string>
#include <vector>

#ifndef GRAPH_H
#define GRAPH_H

struct module {
  std::string name;
  std::string id;
  std::string hash;
  std::string file;
  std::string merk_hash;
};

struct edge {
  module *from;
  module *to;
  std::string parent_port_hash;
  std::string child_port_hash;
};

class graph {
public:
  std::vector<module> modules;
  std::vector<edge> edges;
};

#endif
