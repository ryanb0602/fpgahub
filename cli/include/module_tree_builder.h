#include <string>
#include <vector>

#ifndef MODULE_TREE_BUILDER_H
#define MODULE_TREE_BUILDER_H

class ModuleTreeBuilder {

public:
  // ModuleTreeBuilder();
  //~ModuleTreeBuilder();

  void buildTree();

private:
  struct moduleNode {
    std::string moduleName;
    std::vector<moduleNode *> children;
    std::string container_filename;
  };

  std::vector<moduleNode *> root;

  void scanFile(const std::string &filePath);

  std::string extractModuleText(const std::string &fileContent,
                                size_t &pos_next);

  std::vector<std::string> extractDepends(const std::string &moduleText);
};

#endif // MODULE_TREE_BUILDER_H
