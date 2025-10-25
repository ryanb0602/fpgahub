#include "../include/module_tree_builder.h"
#include "../include/utils.h"

#include <algorithm>
#include <fstream>
#include <iostream>
#include <sstream>

ModuleTreeBuilder::~ModuleTreeBuilder() {
  for (auto node : allModules) {
    delete node;
  }
}

void ModuleTreeBuilder::buildTree() {

  std::string directory = "./";
  std::vector<std::string> current_files = list_files_recursive(directory);

  // scan each file, inputting into tree
  for (const auto &file : current_files) {
    scanFile(file);
  }

  // find roots
  this->root = findRoots();

  // print the tree
  this->printTree(this->root[0], 0);
}

void ModuleTreeBuilder::scanFile(const std::string &filePath) {
  // make sure to only scan vhdl files
  if (filePath.find(".vhd") == std::string::npos &&
      filePath.find(".vhdl") == std::string::npos) {
    return;
  }
  // open file, read to string
  std::ifstream file(filePath);
  if (!file) {
    throw std::runtime_error("Could not open file: " + filePath);
  }
  std::ostringstream buffer;
  buffer << file.rdbuf();
  std::string fileContent = buffer.str();

  // find each module listed in a file, get the dependencies
  size_t next_pos = 0;
  std::string running_text = fileContent;
  while (next_pos != std::string::npos) {
    running_text = running_text.substr(next_pos);
    std::string module_text = extractModuleText(running_text, next_pos);
    size_t module_text_name_end = module_text.find(" ", 7);
    ;
    std::string module_name = module_text.substr(7, module_text_name_end - 7);
    // extract modules
    std::vector<std::string> dependencies = extractDepends(module_text);

    ModuleTreeBuilder::moduleNode *currentNode = nullptr;
    // insert into tree
    for (const auto &node : this->allModules) {
      if (node->moduleName == module_name) {
        currentNode = node;
        break;
      }
    }
    if (currentNode == nullptr) {
      currentNode = new ModuleTreeBuilder::moduleNode;
      currentNode->moduleName = module_name;
      this->allModules.push_back(currentNode);
    }

    for (const auto &dep : dependencies) {
      ModuleTreeBuilder::moduleNode *depNode = nullptr;
      for (const auto &node : this->allModules) {
        if (node->moduleName == dep) {
          depNode = node;
          break;
        }
      }
      if (depNode == nullptr) {
        depNode = new ModuleTreeBuilder::moduleNode;
        depNode->moduleName = dep;
        this->allModules.push_back(depNode);
      }
      currentNode->children.push_back(depNode);
    }
  }
}

std::string ModuleTreeBuilder::extractModuleText(const std::string &fileContent,
                                                 size_t &next_pos) {
  // find the start and end of the module
  size_t module_start = fileContent.find("entity ");
  if (module_start == std::string::npos) {
    return "";
    next_pos = std::string::npos;
  }

  size_t module_end = fileContent.find("\nentity ", module_start);

  if (module_end == std::string::npos) {
    module_end = fileContent.length();
    next_pos = std::string::npos;
  } else {
    next_pos = module_end;
  }

  // return the module text
  return fileContent.substr(module_start, module_end - module_start);
}

std::vector<std::string>
ModuleTreeBuilder::extractDepends(const std::string &moduleText) {
  std::vector<std::string> dependencies;

  size_t current_pos = 0;
  std::string current_string = moduleText;
  std::string found_module;

  while (current_pos != std::string::npos) {
    current_pos = current_string.find("component ");
    if (current_pos != std::string::npos) {
      size_t name_end = std::min(current_string.find(" ", current_pos + 10),
                                 current_string.find("\n", current_pos + 10));
      if (name_end != std::string::npos) {
        found_module = current_string.substr(current_pos + 10,
                                             name_end - (current_pos + 10));
        dependencies.push_back(found_module);
        current_pos = name_end;
        current_string = current_string.substr(current_pos);
      } else {
        break;
      }
    } else {
      break;
    }
  }
  return dependencies;
}

std::vector<ModuleTreeBuilder::moduleNode *> ModuleTreeBuilder::findRoots() {
  std::unordered_set<ModuleTreeBuilder::moduleNode *> allChildren;

  // Collect all nodes that are referenced as children
  for (const auto &node : this->allModules) {
    for (const auto &child : node->children) {
      allChildren.insert(child);
    }
  }

  // Any node not in 'allChildren' is a root
  std::vector<ModuleTreeBuilder::moduleNode *> roots;
  for (const auto &node : this->allModules) {
    if (allChildren.find(node) == allChildren.end()) {
      roots.push_back(node);
    }
  }
  return roots;
}

void ModuleTreeBuilder::printRoots() {

  for (const auto &node : this->root) {
    std::cout << "Root Module: " << node->moduleName << std::endl;
  }
}

void ModuleTreeBuilder::printTree(ModuleTreeBuilder::moduleNode *node,
                                  int depth) {
  if (node == nullptr) {
    return;
  }

  // Print indentation based on depth
  for (int i = 0; i < depth; ++i) {
    std::cout << "--";
  }

  // Print the module name
  std::cout << node->moduleName << std::endl;

  // Recursively print each child
  for (const auto &child : node->children) {
    printTree(child, depth + 1);
  }
}
