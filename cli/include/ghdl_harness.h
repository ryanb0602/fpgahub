#pragma once
#include <string>
#include <vector>

class GhdlHarness {
public:
    // Prints the AST/module tree for a given VHDL file
    void print_module_tree(const std::string& filename, const std::vector<std::string>& options = {});
};
