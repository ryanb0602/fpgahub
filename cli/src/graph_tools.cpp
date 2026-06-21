#include "../include/graph.h"

void graph::load_from_file() {
  namespace fs = std::filesystem;

  std::string commit_hash = get_head();

  if (commit_hash == "")
    return;

  fs::path graph_file = fs::path(cache_dir) / commit_hash / "graph";

  std::ifstream in(graph_file);
  if (!in.is_open()) {
    std::cerr << "Error: Could not open graph file for commit " << commit_hash
              << "\n";
    return;
  }

  this->modules.clear();
  this->edges.clear();

  std::map<std::string, module *> name_to_module;

  std::map<std::string, std::vector<std::pair<std::string, std::string>>>
      deferred_children;

  module *current_mod = nullptr;
  std::string line;

  while (std::getline(in, line)) {
    std::stringstream ss(line);
    std::string token;
    ss >> token;

    if (token == "MODULE") {
      current_mod = new module();

      current_mod->id = generate_uuid_v4();

      ss >> current_mod->name >> current_mod->hash >> current_mod->merk_hash >>
          current_mod->interface_port_hash;

      this->modules.push_back(current_mod);
      name_to_module[current_mod->name] = current_mod;
    } else if (token == "FILE" && current_mod) {
      std::string filename;
      ss >> filename;

      if (current_mod->file.empty()) {
        current_mod->file = filename;
      }
    } else if (token == "CHILD" && current_mod) {
      std::string child_name, child_hash;
      ss >> child_name >> child_hash;
      deferred_children[current_mod->name].push_back({child_name, child_hash});
    } else if (token == "END_MODULE") {
      current_mod = nullptr;
    }
  }
  in.close();

  for (module *parent : this->modules) {
    auto &children_strings = deferred_children[parent->name];

    for (const auto &child_data : children_strings) {
      std::string child_name = child_data.first;
      std::string child_int_hash = child_data.second;

      if (name_to_module.find(child_name) != name_to_module.end()) {
        module *child_mod = name_to_module[child_name];

        parent->child_interfaces.push_back(
            compatibility_tracker{child_mod, child_int_hash});

        this->edges.push_back(new edge{parent, child_mod});
      } else {
        std::cerr << "Warning: Child module '" << child_name
                  << "' referenced by '" << parent->name
                  << "' was not found in the graph.\n";
      }
    }
  }
}

void graph::write_to_file(std::string &root_name) {
  namespace fs = std::filesystem;

  // find the root module
  auto it = std::find_if(
      this->modules.begin(), this->modules.end(),
      [&root_name](const module *m) { return m->name == root_name; });

  if (it == this->modules.end()) {
    std::cerr << "Error: Root module '" << root_name << "' not found.\n";
    return;
  }

  module *root_mod = *it;

  // commit hash is roots merkle hash because it represents all changes
  std::string commit_hash = root_mod->merk_hash;

  // storage structure, (cache_dir/commit_hash/files)
  fs::path commit_dir = fs::path(cache_dir) / commit_hash;
  fs::path files_dir = commit_dir / "files";

  try {
    fs::create_directories(files_dir);
  } catch (const fs::filesystem_error &e) {
    std::cerr << "Filesystem error: " << e.what() << "\n";
    return;
  }

  // merging nodes with the same name, this step is AST to DAG
  struct MergedNode {
    module *rep;
    std::set<std::string> files;
    std::set<std::string> child_edges;
  };

  std::map<std::string, MergedNode> dag_nodes;

  for (module *m : this->modules) {
    if (dag_nodes.find(m->name) == dag_nodes.end()) {
      dag_nodes[m->name].rep = m;
    }

    if (!m->file.empty()) {
      dag_nodes[m->name].files.insert(m->file);
    }

    for (const auto &child : m->child_interfaces) {
      if (child.to) {
        std::string edge_str = child.to->name + " " + child.interface_port_hash;
        dag_nodes[m->name].child_edges.insert(edge_str);
      }
    }
  }

  // write a text representation of this graph
  fs::path graph_file = commit_dir / "graph";
  std::ofstream out(graph_file);

  if (!out.is_open()) {
    std::cerr << "Error: Could not open " << graph_file << " for writing.\n";
    return;
  }

  for (const auto &[name, node] : dag_nodes) {
    module *rep = node.rep;

    out << "MODULE " << name << " " << rep->hash << " " << rep->merk_hash << " "
        << rep->interface_port_hash << "\n";

    for (const std::string &filepath : node.files) {
      fs::path src_path(filepath);

      out << "  FILE " << src_path.filename().string() << "\n";

      try {
        if (fs::exists(src_path)) {
          fs::path dest_path = files_dir / src_path.filename();
          fs::copy_file(src_path, dest_path,
                        fs::copy_options::overwrite_existing);
        } else {
          std::cerr << "Warning: Source file not found: " << src_path << "\n";
        }
      } catch (const fs::filesystem_error &e) {
        std::cerr << "Warning: Failed to copy " << src_path << " - " << e.what()
                  << "\n";
      }
    }

    for (const std::string &edge_str : node.child_edges) {
      out << "  CHILD " << edge_str << "\n";
    }

    out << "END_MODULE\n\n";
  }

  out.close();

  update_head(commit_hash);
}

bool update_head(const std::string &commit_hash) {
  namespace fs = std::filesystem;
  fs::path head_file = fs::path(cache_dir) / "HEAD";

  std::ofstream out(head_file);
  if (!out.is_open()) {
    std::cerr << "Error: Could not update HEAD file.\n";
    return false;
  }

  out << commit_hash << "\n";
  out.close();
  return true;
}

std::string get_head() {
  namespace fs = std::filesystem;
  fs::path head_file = fs::path(cache_dir) / "HEAD";

  if (!fs::exists(head_file)) {
    return "";
  }

  std::ifstream in(head_file);
  std::string current_head;

  if (in.is_open()) {
    in >> current_head;
    in.close();
  }

  return current_head;
}
